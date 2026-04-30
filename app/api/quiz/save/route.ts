import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { saveQuizData } from '@/lib/kv';
import { kv } from "@vercel/kv";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'admin';
    const body = await req.json();
    const { title, questions, visibility, category } = body;

    if (!title) {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 });
    }

    const quizId = Math.random().toString(36).substring(2, 9);
    
    const quizData = {
      id: quizId,
      title,
      questions,
      visibility: visibility || 'private',
      category: category || 'General',
      author: session?.user?.name || 'Anonymous',
      createdAt: new Date().toISOString(),
      plays: 0,
      rating: 0
    };

    await saveQuizData(userId, quizId, quizData);

    // Phase 3: Index for Explore Page (Section 15.3)
    if (quizData.visibility === 'public') {
      await kv.zadd('public_quizzes', { score: Date.now(), member: quizId });
      await kv.set(`public_quiz_data:${quizId}`, {
        id: quizId,
        title: quizData.title,
        author: quizData.author,
        category: quizData.category,
        questionCount: questions.length,
        createdAt: quizData.createdAt,
        plays: 0,
        rating: 0
      });
    }

    return NextResponse.json({ success: true, quizId });
  } catch (error) {
    console.error('Error saving quiz:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
