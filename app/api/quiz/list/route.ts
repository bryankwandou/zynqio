import { NextResponse } from 'next/server';
import { handle, requireUser } from '@/lib/api-guard';
import { listQuizzesByHost } from '@/lib/quiz';

export const dynamic = 'force-dynamic';

/** GET /api/quiz/list — kuis milik pengguna yang sedang masuk. */
export const GET = handle(async () => {
  const user = await requireUser();
  const quizzes = await listQuizzesByHost(user.id);
  return NextResponse.json({ quizzes }, { headers: { 'Cache-Control': 'no-store' } });
});
