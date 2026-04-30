import { kv } from '@vercel/kv';
import pako from 'pako';

// Constants for cache keys
const PREFIX = {
  QUIZ: 'quiz:',
  ROOM: 'room:',
  SESSION: 'session:',
  PUBLIC: 'public_quizzes',
  RATINGS: 'ratings:'
};

/**
 * Compresses and base64 encodes data to save Vercel KV storage limit.
 */
function compressData(data: any): string {
  const jsonStr = JSON.stringify(data);
  const compressed = pako.gzip(jsonStr);
  return Buffer.from(compressed).toString('base64');
}

/**
 * Decodes base64 and decompresses data back to JSON.
 */
function decompressData(base64Str: string): any {
  try {
    const compressed = Buffer.from(base64Str, 'base64');
    const decompressed = pako.ungzip(compressed, { to: 'string' });
    return JSON.parse(decompressed);
  } catch (e) {
    console.error("Decompression failed, falling back to raw JSON parse", e);
    // Fallback if data wasn't compressed
    return JSON.parse(base64Str);
  }
}

// --- QUIZ OPERATIONS ---

export async function saveQuizData(userId: string, quizId: string, data: any) {
  const key = `${PREFIX.QUIZ}${userId}:${quizId}`;
  
  if (process.env.KV_REST_API_URL) {
    const compressed = compressData(data);
    await kv.set(key, compressed);

    // Maintain Public Index
    if (data.visibility === 'public') {
      await kv.sadd(PREFIX.PUBLIC, `${userId}:${quizId}`);
    } else {
      await kv.srem(PREFIX.PUBLIC, `${userId}:${quizId}`);
    }
  } else {
    console.warn("[Vercel KV] KV_REST_API_URL missing, save action mocked.");
  }
}

export async function listPublicQuizzes() {
  if (process.env.KV_REST_API_URL) {
    const quizIds = await kv.smembers(PREFIX.PUBLIC);
    const quizzes = [];
    
    for (const id of quizIds) {
      const [userId, qId] = id.split(':');
      const data = await getQuizData(userId, qId);
      if (data) {
        // Extract only metadata for listing
        quizzes.push({
          id: data.id,
          title: data.title,
          author: data.author || 'Anonymous',
          plays: data.plays || 0,
          rating: data.rating || 0,
          category: data.category || 'General',
          questions: data.questions?.length || 0,
          hostId: userId
        });
      }
    }
    return quizzes;
  }
  return [];
}

export async function updateQuizRating(userId: string, quizId: string, rating: number, review?: string) {
  const ratingKey = `${PREFIX.RATINGS}${quizId}`;
  if (process.env.KV_REST_API_URL) {
    // Basic aggregation
    const current = await kv.get<any>(ratingKey) || { total: 0, count: 0, reviews: [] };
    current.total += rating;
    current.count += 1;
    if (review) current.reviews.push({ rating, review, date: new Date().toISOString() });
    
    await kv.set(ratingKey, current);
    
    // Sync back to quiz data
    const quiz = await getQuizData(userId, quizId);
    if (quiz) {
      quiz.rating = parseFloat((current.total / current.count).toFixed(1));
      await saveQuizData(userId, quizId, quiz);
    }
  }
}

export async function getQuizData(userId: string, quizId: string) {
  const key = `${PREFIX.QUIZ}${userId}:${quizId}`;
  
  if (process.env.KV_REST_API_URL) {
    const compressed = await kv.get<string>(key);
    if (!compressed) return null;
    return decompressData(compressed);
  }
  return null;
}

export async function listUserQuizzes(userId: string) {
  if (process.env.KV_REST_API_URL) {
    const keys = await kv.keys(`${PREFIX.QUIZ}${userId}:*`);
    const quizzes = [];
    for (const key of keys) {
      const compressed = await kv.get<string>(key);
      if (compressed) {
        const data = decompressData(compressed);
        quizzes.push({
          id: data.id,
          title: data.title,
          questionCount: data.questions?.length || 0,
          status: data.visibility || 'private',
          createdAt: data.createdAt || new Date().toISOString()
        });
      }
    }
    return quizzes;
  }
  return [];
}

// --- ROOM OPERATIONS ---

export async function setRoomState(roomCode: string, state: any) {
  const key = `${PREFIX.ROOM}${roomCode}`;
  if (process.env.KV_REST_API_URL) {
    await kv.set(key, state, { ex: 86400 }); // Expire in 24 hours
  } else {
    // In a real environment without KV, this wouldn't persist across requests.
    // We rely on memory (bad for serverless) just for basic dev testing if KV missing.
    (global as any)[key] = state;
  }
}

export async function getRoomState(roomCode: string) {
  const key = `${PREFIX.ROOM}${roomCode}`;
  if (process.env.KV_REST_API_URL) {
    return await kv.get<any>(key);
  }
  return (global as any)[key] || { players: [{id: '1', name: 'Mock Player'}] };
}

// Ensure the local dev state exists
if (!(global as any).roomStates) {
  (global as any).roomStates = {};
}
