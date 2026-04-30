import { NextResponse } from 'next/server';
import { getQuizData } from '@/lib/kv';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const quizId = searchParams.get('quizId');
    const indexStr = searchParams.get('index');
    
    if (!quizId || indexStr === null) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const index = parseInt(indexStr);
    
    // In a real app, you'd get the hostId from the session or room state
    // For simplicity, we search public quizzes or use 'admin' fallback
    const quiz = await getQuizData('admin', quizId); 
    
    if (!quiz || !quiz.questions || !quiz.questions[index]) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json(quiz.questions[index]);
  } catch (error) {
    console.error('Error fetching question:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
