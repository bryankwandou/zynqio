import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';

export async function POST(req: Request) {
  try {
    const { roomCode, playerId, event } = await req.json();

    if (!roomCode || !playerId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const logKey = `room:${roomCode}:logs`;
    const logEntry = {
      playerId,
      event,
      timestamp: Date.now(),
    };

    try {
      await (redis as any).rpush(logKey, JSON.stringify(logEntry));
    } catch {
      // rpush is only available on Upstash; fallback: append to a list stored as JSON
      const existing: string[] = (await redis.get<string[]>(logKey)) || [];
      existing.push(JSON.stringify(logEntry));
      await redis.set(logKey, existing, { ex: 86400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Log event error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
