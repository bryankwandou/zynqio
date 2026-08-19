import { NextResponse } from 'next/server';
import { handle, readJson, requireUser } from '@/lib/api-guard';
import { deleteQuiz } from '@/lib/quiz';
import { RoomError } from '@/lib/room';

/** POST /api/quiz/delete — hanya pemilik yang bisa menghapus. */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ quizId?: string }>(req);

  if (typeof body.quizId !== 'string' || !body.quizId) {
    throw new RoomError('quizId wajib diisi.', 400);
  }

  const removed = await deleteQuiz(body.quizId, user.id);
  if (!removed) throw new RoomError('Kuis tidak ditemukan atau bukan milik Anda.', 404);

  return NextResponse.json({ success: true });
});
