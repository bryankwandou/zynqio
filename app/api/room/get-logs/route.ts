import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const roomCode = searchParams.get('code');

  if (!roomCode) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const logKey = `room:${roomCode}:logs`;
    let logs: any[] = [];

    try {
      const raw = await (redis as any).lrange(logKey, 0, -1);
      logs = (raw || []).map((l: any) => (typeof l === 'string' ? JSON.parse(l) : l));
    } catch {
      // Fallback if lrange not available
      const raw = await redis.get<any[]>(logKey);
      logs = (raw || []).map((l: any) => (typeof l === 'string' ? JSON.parse(l) : l));
    }

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Get logs error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
