import { NextResponse } from 'next/server';
import { getRoomState } from '@/lib/kv';
import { kv } from '@vercel/kv';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const roomCode = searchParams.get('code');

  if (!roomCode) {
    return NextResponse.json({ error: 'Missing room code' }, { status: 400 });
  }

  try {
    const state = await getRoomState(roomCode);
    if (state && state.status === 'playing') {
      const qId = state.currentQuestionId || `q${state.currentQuestionIndex + 1}`; // Fallback logic
      const answersCount = await kv.scard(`room:${roomCode}:q:${qId}:answers`);
      state.answersCount = answersCount;
    }
    return NextResponse.json(state);
  } catch (error) {
    console.error('Error fetching room state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
