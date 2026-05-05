import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redis } from '@/lib/kv';

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const quizId = searchParams.get('quizId');
    if (!quizId) return NextResponse.json({ error: 'Missing quizId' }, { status: 400 });

    await redis.del(`quiz:${userId}:${quizId}`);
    // Remove from user's quiz index
    try { await (redis as any).lrem(`user:${userId}:quizzes`, 0, quizId); } catch {}
    // Remove from public index
    try { await (redis as any).zrem('public_quizzes_sorted', quizId); await redis.del(`public_quiz_data:${quizId}`); } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
