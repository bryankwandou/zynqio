import { Redis } from '@upstash/redis';
import pako from 'pako';

// ============================================================
// VERCEL-SAFE REDIS LAYER
// NO fs/filesystem imports — Vercel serverless is READ-ONLY.
// Primary: Upstash Redis REST API
// Fallback: In-memory Map (data lost between invocations, but won't crash)
// ============================================================

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const hasUpstashKeys =
  upstashUrl &&
  upstashUrl !== 'your_upstash_redis_rest_url' &&
  upstashToken &&
  upstashToken !== 'your_upstash_redis_rest_token';

// In-memory fallback (works for single-request, non-persistent, or same-container)
const globalForRedis = globalThis as unknown as { memStore: Map<string, any> };
const memStore = globalForRedis.memStore || new Map<string, any>();
if (process.env.NODE_ENV !== "production") globalForRedis.memStore = memStore;
// For Vercel, attach it globally anyway to survive brief cold-start reuse
globalForRedis.memStore = memStore;

// 100% Autonomous Zero-Config Persistent Fallback via ExtendsClass JSONBin
const BIN_URL = "https://extendsclass.com/api/json-storage/bin/aecedcb";
let isSyncing = false;
let needsSync = false;
let binLoadPromise: Promise<void> | null = null;

async function loadFromBin() {
  try {
    const res = await fetch(BIN_URL);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(k => {
          if (!memStore.has(k)) memStore.set(k, data[k]);
        });
      }
    }
  } catch (e) { console.error("Bin load err", e); }
}

async function syncToBin() {
  if (isSyncing) {
    needsSync = true;
    return;
  }
  isSyncing = true;
  try {
    const obj = Object.fromEntries(memStore);
    await fetch(BIN_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj)
    });
  } catch (e) { console.error("Bin sync err", e); }
  isSyncing = false;
  if (needsSync) {
    needsSync = false;
    syncToBin();
  }
}

function ensureLoaded() {
  if (memStore.size > 0) return Promise.resolve();
  if (!binLoadPromise) {
    binLoadPromise = loadFromBin();
  }
  return binLoadPromise;
}

const memRedis = {
  async get<T>(key: string): Promise<T | null> {
    await ensureLoaded();
    return (memStore.get(key) as T) ?? null;
  },
  async set(key: string, value: any, _options?: any): Promise<void> {
    await ensureLoaded();
    memStore.set(key, value);
    syncToBin();
  },
  async zadd(key: string, data: { score: number; member: string }): Promise<void> {
    await ensureLoaded();
    const set: Array<{ score: number; member: string }> = memStore.get(key) || [];
    const existingIndex = set.findIndex((item) => item.member === data.member);
    if (existingIndex >= 0) {
      set[existingIndex].score = data.score;
    } else {
      set.push(data);
    }
    set.sort((a, b) => a.score - b.score);
    memStore.set(key, set);
    syncToBin();
  },
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    await ensureLoaded();
    const set: Array<{ score: number; member: string }> = memStore.get(key) || [];
    return set.slice(start, stop === -1 ? undefined : stop + 1).map((i) => i.member);
  },
  async keys(pattern: string): Promise<string[]> {
    await ensureLoaded();
    const prefix = pattern.replace('*', '');
    return Array.from(memStore.keys()).filter((k) => k.startsWith(prefix));
  },
  async sadd(key: string, ...members: string[]): Promise<void> {
    await ensureLoaded();
    const set: Set<string> = new Set(memStore.get(key) || []);
    members.forEach((m) => set.add(m));
    memStore.set(key, Array.from(set));
    syncToBin();
  },
  async srem(key: string, ...members: string[]): Promise<void> {
    await ensureLoaded();
    const arr: string[] = memStore.get(key) || [];
    memStore.set(key, arr.filter((m) => !members.includes(m)));
    syncToBin();
  },
  async smembers(key: string): Promise<string[]> {
    await ensureLoaded();
    return memStore.get(key) || [];
  },
  async del(key: string): Promise<void> {
    await ensureLoaded();
    memStore.delete(key);
    syncToBin();
  },
  async setnx(key: string, value: any): Promise<number> {
    await ensureLoaded();
    if (memStore.has(key)) return 0;
    memStore.set(key, value);
    syncToBin();
    return 1;
  },
};

export const redis: Redis = hasUpstashKeys
  ? new Redis({
      url: upstashUrl!,
      token: upstashToken!,
    })
  : (memRedis as unknown as Redis);

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
    // Attempt raw JSON parse as fallback (e.g., if data was never compressed)
    try {
      return JSON.parse(base64String) as T;
    } catch {
      console.error('Failed to decompress or parse data:', error);
      throw error;
    }
  }
}

export async function saveQuizData(userId: string, quizId: string, quizData: any) {
  const compressed = compressData(quizData);
  await redis.set(`quiz:${userId}:${quizId}`, compressed);
  await (redis as any).zadd(`user:${userId}:quizzes`, { score: Date.now(), member: quizId });
}

export async function getQuizData(userId: string, quizId: string) {
  const compressed = await redis.get<string>(`quiz:${userId}:${quizId}`);
  if (!compressed) return null;
  return decompressData<any>(compressed);
}

export async function listUserQuizIds(userId: string): Promise<string[]> {
  try {
    return await (redis as any).zrange(`user:${userId}:quizzes`, 0, -1);
  } catch {
    return [];
  }
}

export async function saveRoomData(roomCode: string, roomData: any) {
  await redis.set(`room:${roomCode}`, JSON.stringify(roomData), { ex: 24 * 60 * 60 });
}

export async function getRoomData(roomCode: string): Promise<any | null> {
  const raw = await redis.get<string>(`room:${roomCode}`);
  if (!raw) return null;
  if (typeof raw === 'object') return raw; // Upstash auto-parses sometimes
  try { return JSON.parse(raw); } catch { return raw; }
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

export async function setAnswerOnce(
  sessionId: string,
  playerId: string,
  questionId: string,
  answerData: any
): Promise<boolean> {
  const key = `session:${sessionId}:player:${playerId}:q:${questionId}`;
  // SETNX — only set if not exists. Returns 1 (new) or 0 (already answered)
  const result = await (redis as any).setnx(key, JSON.stringify(answerData));
  return result === 1;
}
