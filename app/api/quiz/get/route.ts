import { NextResponse } from 'next/server';
import { getQuizData } from '@/lib/kv';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hostId = searchParams.get('hostId');
  const quizId = searchParams.get('quizId');

  if (!hostId || !quizId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const quiz = await getQuizData(hostId, quizId);
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }
    return NextResponse.json(quiz);
  } catch (error) {
    console.error('Error fetching quiz:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
