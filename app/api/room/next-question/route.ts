import { NextResponse } from 'next/server';
import { getRoomState, setRoomState, getQuizData } from '@/lib/kv';
import { pusherServer } from '@/lib/pusher';

export async function POST(req: Request) {
  try {
    const { roomCode } = await req.json();
    
    if (!roomCode) {
      return NextResponse.json({ error: 'Missing room code' }, { status: 400 });
    }

    const state = await getRoomState(roomCode);
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Move to next question
    state.currentQuestionIndex = (state.currentQuestionIndex ?? -1) + 1;
    state.questionStartTimestamp = Date.now();
    state.updatedAt = Date.now();
    state.status = 'playing';

    // Check if game should end
    const quiz = await getQuizData(state.hostId, state.quizId);
    if (!quiz || state.currentQuestionIndex >= quiz.questions.length) {
      state.status = 'ended';
    }

    await setRoomState(roomCode, state);
    
    // Trigger Pusher event
    try {
      await pusherServer.trigger(`room-${roomCode}`, 'question_started', {
        index: state.currentQuestionIndex,
        status: state.status,
        timestamp: state.questionStartTimestamp
      });
    } catch (e) {
      console.error("[Pusher] Next-question trigger error:", e);
    }

    return NextResponse.json({ success: true, state });
  } catch (error) {
    console.error('Next question error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
