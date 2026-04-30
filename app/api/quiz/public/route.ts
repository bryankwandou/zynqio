import { NextResponse } from 'next/server';
import { listPublicQuizzes, updateQuizRating } from '@/lib/kv';

export async function GET() {
  try {
    const quizzes = await listPublicQuizzes();
    return NextResponse.json(quizzes);
  } catch (error) {
    console.error('Error fetching public quizzes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { quizId, rating, review, hostId } = await req.json();
    
    if (!quizId || !rating) {
      return NextResponse.json({ error: 'Missing rating data' }, { status: 400 });
    }

    await updateQuizRating(hostId, quizId, rating, review);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error rating quiz:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
