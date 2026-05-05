import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { saveQuizData, redis, getQuizData } from '@/lib/kv';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id || 'admin';
    const body = await req.json();
    const { quizId: rawQuizId, title, questions, visibility, category, description, coverImage, hideAnswer } = body;

    if (!title) {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 });
    }

    const quizId =
      typeof rawQuizId === 'string' && rawQuizId.trim().length > 0
        ? rawQuizId.trim()
        : Math.random().toString(36).substring(2, 9);

    const existingQuiz = await getQuizData(userId, quizId);

    const quizData = {
      id: quizId,
      title,
      questions: questions || [],
      visibility: visibility || 'private',
      category: category || 'General',
      description: description || existingQuiz?.description || '',
      coverImage: coverImage || existingQuiz?.coverImage || '',
      hideAnswer: !!hideAnswer,
      author: session?.user?.name || 'Anonymous',
      createdAt: existingQuiz?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      plays: existingQuiz?.plays || 0,
      rating: existingQuiz?.rating || 0,
    };

    await saveQuizData(userId, quizId, quizData);

    // Index for Explore Page (public quizzes)
    if (quizData.visibility === 'public') {
      try {
        await (redis as any).zadd('public_quizzes_sorted', {
          score: Date.now(),
          member: quizId,
        });
        await redis.set(`public_quiz_data:${quizId}`, {
          id: quizId,
          title: quizData.title,
          author: quizData.author,
          category: quizData.category,
          questionCount: questions?.length || 0,
          createdAt: quizData.createdAt,
          plays: 0,
          rating: 0,
        });
      } catch (e) {
        console.error('Failed to index public quiz (non-fatal):', e);
      }
    } else {
      try {
        await (redis as any).zrem('public_quizzes_sorted', quizId);
        await redis.del(`public_quiz_data:${quizId}`);
      } catch (e) {
        console.error('Failed to remove public quiz index (non-fatal):', e);
      }
    }

    return NextResponse.json({ success: true, quizId });
  } catch (error) {
    console.error('Error saving quiz:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
