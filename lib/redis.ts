import { Redis } from '@upstash/redis';
import pako from 'pako';
import fs from 'fs';
import path from 'path';

// Local File Fallback for "Akalin" zero-config requirement
const LOCAL_DB_FILE = path.join(process.cwd(), 'local_database.json');

// Helper to initialize local DB
function initLocalDb() {
  if (!fs.existsSync(LOCAL_DB_FILE)) {
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify({}), 'utf-8');
  }
}

// Local mock for Redis client
const localRedis = {
  async get<T>(key: string): Promise<T | null> {
    initLocalDb();
    const data = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf-8'));
    return data[key] || null;
  },
  async set(key: string, value: any, options?: any): Promise<void> {
    initLocalDb();
    const data = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf-8'));
    data[key] = value;
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  },
  async zadd(key: string, data: { score: number; member: string }): Promise<void> {
    initLocalDb();
    const dbData = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf-8'));
    if (!dbData[key]) dbData[key] = [];
    
    // Simple mock for sorted set
    const set = dbData[key];
    const existingIndex = set.findIndex((item: any) => item.member === data.member);
    if (existingIndex >= 0) {
      set[existingIndex].score = data.score;
    } else {
      set.push(data);
    }
    set.sort((a: any, b: any) => a.score - b.score);
    dbData[key] = set;
    
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
  }
};

const hasUpstashKeys = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_URL !== 'your_upstash_redis_rest_url';

export const redis = hasUpstashKeys 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    })
  : localRedis as unknown as Redis; // Use local file mock if no keys are provided

/**
 * Compresses a JSON object using pako (gzip) and encodes it to base64.
 */
export function compressData<T>(data: T): string {
  try {
    const jsonString = JSON.stringify(data);
    const uint8Array = new TextEncoder().encode(jsonString);
    const compressed = pako.gzip(uint8Array, { level: 6 });
    return Buffer.from(compressed).toString('base64');
  } catch (error) {
    console.error('Failed to compress data:', error);
    throw error;
  }
}

/**
 * Decodes a base64 string, decompresses it using pako (gzip), and parses the JSON.
 */
export function decompressData<T>(base64String: string): T {
  try {
    const buffer = Buffer.from(base64String, 'base64');
    const uint8Array = new Uint8Array(buffer);
    const decompressed = pako.ungzip(uint8Array);
    const jsonString = new TextDecoder().decode(decompressed);
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('Failed to decompress data:', error);
    throw error;
  }
}

export async function saveQuizData(userId: string, quizId: string, quizData: any) {
  const compressed = compressData(quizData);
  await redis.set(`quiz:${userId}:${quizId}`, compressed);
  await redis.zadd(`user:${userId}:quizzes`, { score: Date.now(), member: quizId });
}

export async function getQuizData(userId: string, quizId: string) {
  const compressed = await redis.get<string>(`quiz:${userId}:${quizId}`);
  if (!compressed) return null;
  return decompressData<any>(compressed);
}

export async function saveRoomData(roomCode: string, roomData: any) {
  await redis.set(`room:${roomCode}`, roomData, { ex: 24 * 60 * 60 });
}

export async function getRoomData(roomCode: string) {
  return await redis.get<any>(`room:${roomCode}`);
}

export async function saveSessionResults(sessionId: string, results: any) {
  const compressed = compressData(results);
  await redis.set(`session:${sessionId}:results`, compressed);
}

export async function getSessionResults(sessionId: string) {
  const compressed = await redis.get<string>(`session:${sessionId}:results`);
  if (!compressed) return null;
  return decompressData<any>(compressed);
}
