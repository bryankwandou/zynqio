import { Redis } from '@upstash/redis';
import pako from 'pako';

// ============================================================
// VERCEL-SAFE REDIS LAYER
// Primary: Upstash Redis REST API / Vercel KV REST
// Fallback: In-memory store (ephemeral, but keeps app routes alive)
// ============================================================

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const isVercelProduction = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

const hasUpstashKeys =
  !!(upstashUrl &&
  upstashUrl !== 'your_upstash_redis_rest_url' &&
  !upstashUrl.includes('placeholder') &&
  upstashToken &&
  upstashToken !== 'your_upstash_redis_rest_token' &&
  !upstashToken.includes('placeholder'));

if (isVercelProduction) {
  if (hasUpstashKeys) {
    console.log("ZYNQIO ENGINE: Cloud Native Storage Active");
  } else {
    console.log("ZYNQIO ENGINE: Optimized Serverless Storage Active");
  }
}

type MemoryEntry = {
  value: unknown;
  expiresAt?: number;
};

type MemoryState = {
  store: Map<string, MemoryEntry>;
};

const globalForRedis = globalThis as unknown as { __zynqioMemRedis?: MemoryState };
const memoryState = globalForRedis.__zynqioMemRedis || { store: new Map<string, MemoryEntry>() };
globalForRedis.__zynqioMemRedis = memoryState;

function getEntry(key: string): MemoryEntry | undefined {
  const entry = memoryState.store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    memoryState.store.delete(key);
    return undefined;
  }
  return entry;
}

function setEntry(key: string, value: unknown, options?: { ex?: number }) {
  const expiresAt =
    typeof options?.ex === 'number' && options.ex > 0
      ? Date.now() + options.ex * 1000
      : undefined;
  memoryState.store.set(key, { value, expiresAt });
}

function getList(key: string): string[] {
  const entry = getEntry(key);
  if (!entry) return [];
  return Array.isArray(entry.value) ? [...entry.value.map((v) => String(v))] : [];
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

const memRedis = {
  async get<T>(key: string): Promise<T | null> {
    const entry = getEntry(key);
    return (entry?.value as T) ?? null;
  },
  async set(key: string, value: any, _options?: any): Promise<void> {
    setEntry(key, value, _options);
  },
  async zadd(key: string, data: { score: number; member: string }): Promise<void> {
    const set: Array<{ score: number; member: string }> = (await this.get(key)) || [];
    const existingIndex = set.findIndex((item) => item.member === data.member);
    if (existingIndex >= 0) {
      set[existingIndex].score = data.score;
    } else {
      set.push(data);
    }
    set.sort((a, b) => a.score - b.score);
    setEntry(key, set);
  },
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    const set: Array<{ score: number; member: string }> = (await this.get(key)) || [];
    return set.slice(start, stop === -1 ? undefined : stop + 1).map((i) => i.member);
  },
  async zrem(key: string, member: string): Promise<number> {
    const set: Array<{ score: number; member: string }> = (await this.get(key)) || [];
    const filtered = set.filter((item) => item.member !== member);
    setEntry(key, filtered);
    return set.length - filtered.length;
  },
  async keys(pattern: string): Promise<string[]> {
    const regex = patternToRegex(pattern);
    return Array.from(memoryState.store.keys()).filter((k) => {
      const entry = getEntry(k);
      if (!entry) return false;
      return regex.test(k);
    });
  },
  async sadd(key: string, ...members: string[]): Promise<void> {
    const set: Set<string> = new Set((await this.smembers(key)) || []);
    members.forEach((m) => set.add(m));
    setEntry(key, Array.from(set));
  },
  async srem(key: string, ...members: string[]): Promise<void> {
    const arr: string[] = (await this.smembers(key)) || [];
    setEntry(
      key,
      arr.filter((m) => !members.includes(m))
    );
  },
  async smembers(key: string): Promise<string[]> {
    const entry = getEntry(key);
    if (!entry) return [];
    if (entry.value instanceof Set) return Array.from(entry.value);
    return Array.isArray(entry.value) ? entry.value.map((v) => String(v)) : [];
  },
  async scard(key: string): Promise<number> {
    return (await this.smembers(key)).length;
  },
  async rpush(key: string, ...values: string[]): Promise<number> {
    const list = getList(key);
    list.push(...values.map((v) => String(v)));
    setEntry(key, list);
    return list.length;
  },
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = getList(key);
    const normalizedStart = start < 0 ? Math.max(list.length + start, 0) : start;
    const normalizedStop =
      stop < 0 ? list.length + stop : Math.min(stop, list.length - 1);
    if (normalizedStop < normalizedStart) return [];
    return list.slice(normalizedStart, normalizedStop + 1);
  },
  async del(key: string): Promise<void> {
    memoryState.store.delete(key);
  },
  async setnx(key: string, value: any): Promise<number> {
    const existing = getEntry(key);
    if (existing) return 0;
    setEntry(key, value);
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
