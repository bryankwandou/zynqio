import { NextResponse } from 'next/server';
import { getRoomState, setRoomState, getQuizData } from '@/lib/kv';
import { pusherServer } from '@/lib/pusher';

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
    state.currentQuestionIndex = 0;
    state.questionStartTimestamp = Date.now();
    state.updatedAt = Date.now();

    // Store totalQuestions for all modes so host can track last question and auto-recap works
    if (state.quizId && state.hostId) {
      try {
        const quiz = await getQuizData(state.hostId, state.quizId);
        if (quiz?.questions?.length) {
          state.totalQuestions = quiz.questions.length;
        }
      } catch { /* non-fatal */ }
    }

    await setRoomState(roomCode, state);
    
    // Trigger Pusher event
    try {
      await pusherServer.trigger(`room-${roomCode}`, 'game_started', {
        status: state.status,
        gameMode: state.gameMode,
        settings: state.settings
      });
    } catch (e) {
      console.error("[Pusher] Start trigger error:", e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error starting game:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
