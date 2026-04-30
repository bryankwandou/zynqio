import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

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
      timestamp: Date.now()
    };

    await kv.rpush(logKey, JSON.stringify(logEntry));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Log event error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
