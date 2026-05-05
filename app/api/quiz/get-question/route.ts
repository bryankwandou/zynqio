import { NextResponse } from 'next/server';
import { getQuizData, getRoomState } from '@/lib/kv';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const quizId = searchParams.get('quizId');
    const indexStr = searchParams.get('index');
    
    if (!quizId || indexStr === null) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const index = parseInt(indexStr);
    const roomCode = searchParams.get('roomCode');
    
    let hostId = searchParams.get('hostId') || 'admin';
    
    if (roomCode) {
      const room = await getRoomState(roomCode);
      if (room && room.hostId) {
        hostId = room.hostId;
      }
    }

    const quiz = await getQuizData(hostId, quizId); 
    
    if (!quiz || !quiz.questions || !quiz.questions[index]) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json(quiz.questions[index]);
  } catch (error) {
    console.error('Error fetching question:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
