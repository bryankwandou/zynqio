import { NextResponse } from 'next/server';
import { getRoomState, setRoomState } from '@/lib/kv';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roomCode, nickname } = body;

    if (!roomCode || !nickname) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Get current state
    const state = await getRoomState(roomCode) || { players: [], status: 'waiting' };
    
    // Check if player already exists
    const existingPlayer = state.players.find((p: any) => p.name.toLowerCase() === nickname.toLowerCase());
    
    let finalName = nickname;
    if (existingPlayer) {
      finalName = `${nickname} (2)`; // Handle duplicate name logic per spec
    }

    // Add player
    const newPlayer: any = {
      id: Math.random().toString(36).substr(2, 9),
      name: finalName,
      joinedAt: Date.now(),
      score: 0,
      accuracy: 0
    };

    // Deterministic Team Assignment (Section 10.4)
    if (state.gameMode === 'team') {
      const teams = ['Team Red', 'Team Blue', 'Team Green', 'Team Yellow'];
      newPlayer.team = teams[state.players.length % 4];
    }

    state.players.push(newPlayer);

    // Save back to KV
    await setRoomState(roomCode, state);

    return NextResponse.json({ success: true, player: newPlayer });
  } catch (error) {
    console.error('Error joining room:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
