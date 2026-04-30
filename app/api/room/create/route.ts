import { NextResponse } from 'next/server';
import { setRoomState } from '@/lib/kv';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { quizId } = body;

    if (!quizId) {
      return NextResponse.json({ error: 'Missing quiz ID' }, { status: 400 });
    }

    // Generate 6-digit alphanumeric room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const initialState = {
      roomCode,
      quizId,
      hostId: session?.user?.id || 'admin',
      status: 'waiting',
      players: [],
      gameMode: 'classic',
      currentQuestionIndex: 0,
      createdAt: new Date().toISOString()
    };

    await setRoomState(roomCode, initialState);

    return NextResponse.json({ roomCode });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
