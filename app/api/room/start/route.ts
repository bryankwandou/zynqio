import { NextResponse } from 'next/server';
import { getRoomState, setRoomState } from '@/lib/kv';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roomCode, gameMode, settings } = body;

    if (!roomCode) {
      return NextResponse.json({ error: 'Missing room code' }, { status: 400 });
    }

    const state = await getRoomState(roomCode);
    
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    state.status = 'playing';
    state.gameMode = gameMode || 'classic';
    state.settings = settings || state.settings || {};
    await setRoomState(roomCode, state);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error starting game:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
