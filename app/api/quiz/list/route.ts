import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { listUserQuizzes } from '@/lib/kv';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id || 'admin';
    const quizzes = await listUserQuizzes(userId);
    return NextResponse.json(quizzes);
  } catch (error) {
    console.error('Error listing quizzes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
