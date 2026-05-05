import { redis } from "./redis";

/**
 * Rate limiter using Upstash Redis.
 * Returns true if request is allowed, false if rate limit exceeded.
 */
export async function rateLimit(
  ip: string,
  key: string,
  max: number,
  windowSec: number
): Promise<boolean> {
  try {
    const windowId = Math.floor(Date.now() / 1000 / windowSec);
    const redisKey = `rate:${key}:${ip}:${windowId}`;

    const count = await (redis as any).incr(redisKey);
    if (count === 1) {
      await (redis as any).expire(redisKey, windowSec);
    }
    return count <= max;
  } catch {
    // Fail open — don't block users if Redis is unavailable
    return true;
  }
}

export function getIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
