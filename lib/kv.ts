/**
 * lib/kv.ts — Vercel-Safe Storage Layer
 *
 * Delegates ALL storage to lib/redis.ts (Upstash REST API or in-memory fallback).
 * NEVER imports @vercel/kv directly — it throws when KV_REST_API_URL is absent.
 */

import {
  redis,
  compressData,
  decompressData,
  saveQuizData as redisSaveQuiz,
  getQuizData as redisGetQuiz,
  listUserQuizIds,
  saveRoomData,
  getRoomData,
  saveSessionResults,
  getSessionResults,
  setAnswerOnce,
} from './redis';

// Re-export direct primitives
export {
  redis,
  compressData,
  decompressData,
  listUserQuizIds,
  saveRoomData,
  getRoomData,
  saveSessionResults,
  getSessionResults,
  setAnswerOnce,
};

// --- QUIZ OPERATIONS ---

export async function saveQuizData(userId: string, quizId: string, data: any) {
  await redisSaveQuiz(userId, quizId, data);

  // Index public quizzes (set + lightweight metadata cache)
  try {
    if (data.visibility === 'public') {
      await Promise.all([
        (redis as any).sadd('public_quizzes', `${userId}:${quizId}`),
        redis.set(`public_quiz_data:${quizId}`, {
          id: quizId,
          title: data.title,
          author: data.author || 'Anonymous',
          plays: data.plays || 0,
          rating: data.rating || 0,
          category: data.category || 'General',
          questionCount: data.questions?.length || 0,
          hostId: userId,
          createdAt: data.createdAt,
        }),
      ]);
    } else {
      await Promise.all([
        (redis as any).srem('public_quizzes', `${userId}:${quizId}`),
        (redis as any).del(`public_quiz_data:${quizId}`),
      ]);
    }
  } catch (e) {
    console.error('Failed to update public quiz index:', e);
  }
}

export async function getQuizData(userId: string, quizId: string) {
  return redisGetQuiz(userId, quizId);
}

export async function listPublicQuizzes() {
  try {
    // Fast path: use pre-indexed metadata from public_quiz_data:* (no decompression needed)
    // Collect IDs from both indexes: public_quizzes (set, userId:quizId) + public_quizzes_sorted (sorted set, quizId only)
    const [legacyIds, sortedIds]: [string[], string[]] = await Promise.all([
      (redis as any).smembers('public_quizzes').catch(() => [] as string[]),
      (redis as any).zrange('public_quizzes_sorted', 0, -1).catch(() => [] as string[]),
    ]);

    // Parse legacy set entries (format: "userId:quizId")
    const legacyEntries = (legacyIds as string[]).map((id: string) => {
      const parts = id.split(':');
      return parts.length >= 2 ? { userId: parts[0], quizId: parts.slice(1).join(':') } : null;
    }).filter(Boolean) as Array<{ userId: string; quizId: string }>;

    // Fetch quiz data in parallel — try fast-path first (pre-indexed metadata)
    const results = await Promise.all(
      legacyEntries.map(async ({ userId, quizId }) => {
        try {
          // Fast-path: pre-indexed lightweight metadata
          const cached = await redis.get<any>(`public_quiz_data:${quizId}`);
          if (cached) {
            return { ...cached, hostId: userId, id: quizId };
          }
          // Fallback: decompress full quiz (slower, but complete)
          const data = await redisGetQuiz(userId, quizId);
          if (!data) return null;
          return {
            id: data.id || quizId,
            title: data.title,
            author: data.author || 'Anonymous',
            plays: data.plays || 0,
            rating: data.rating || 0,
            category: data.category || 'General',
            questionCount: data.questions?.length || 0,
            hostId: userId,
            createdAt: data.createdAt,
          };
        } catch {
          return null;
        }
      })
    );

    return results.filter(Boolean).sort((a: any, b: any) => (b.plays || 0) - (a.plays || 0));
  } catch (e) {
    console.error('Failed to list public quizzes:', e);
    return [];
  }
}

export async function updateQuizRating(
  userId: string,
  quizId: string,
  rating: number,
  review?: string
) {
  const ratingKey = `ratings:${quizId}`;
  try {
    const current = (await redis.get<any>(ratingKey)) || { total: 0, count: 0, reviews: [] };
    current.total += rating;
    current.count += 1;
    if (review) current.reviews.push({ rating, review, date: new Date().toISOString() });
    await redis.set(ratingKey, current);

    const quiz = await redisGetQuiz(userId, quizId);
    if (quiz) {
      quiz.rating = parseFloat((current.total / current.count).toFixed(1));
      await redisSaveQuiz(userId, quizId, quiz);
    }
  } catch (e) {
    console.error('Failed to update quiz rating:', e);
  }
}

export async function listUserQuizzes(userId: string) {
  try {
    const quizIds = await listUserQuizIds(userId);
    const quizzes = [];
    for (const quizId of quizIds) {
      const data = await redisGetQuiz(userId, quizId);
      if (data) {
        quizzes.push({
          id: data.id,
          title: data.title,
          questionCount: data.questions?.length || 0,
          status: data.visibility || 'private',
          createdAt: data.createdAt || new Date().toISOString(),
          plays: data.plays || 0,
          category: data.category || 'General',
          author: data.author,
        });
      }
    }
    return quizzes;
  } catch (e) {
    console.error('Failed to list user quizzes:', e);
    return [];
  }
}

// --- ROOM OPERATIONS ---

export async function setRoomState(roomCode: string, state: any) {
  await saveRoomData(roomCode, state);
}

export async function getRoomState(roomCode: string) {
  return getRoomData(roomCode);
}
