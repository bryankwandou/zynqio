import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const roomCode = searchParams.get('code');

  if (!roomCode) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const logKey = `room:${roomCode}:logs`;
    const logs = await kv.lrange(logKey, 0, -1);
    
    const parsedLogs = logs.map(l => typeof l === 'string' ? JSON.parse(l) : l);
    
    return NextResponse.json(parsedLogs);
  } catch (error) {
    console.error('Get logs error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
