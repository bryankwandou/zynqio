import { NextResponse } from 'next/server';
import { handle, readJson, requireUser } from '@/lib/api-guard';
import { rateQuiz } from '@/lib/quiz';
import { RoomError } from '@/lib/room';

/**
 * POST /api/quiz/rate
 *
 * Penilaian sekarang menuntut akun. Versi lama menerimanya tanpa
 * identitas, jadi satu orang bisa mengirim penilaian berkali-kali dan
 * menaikkan atau menjatuhkan kuis mana pun sesuka hati.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ quizId?: string; rating?: number }>(req);

  if (typeof body.quizId !== 'string' || !body.quizId) {
    throw new RoomError('quizId wajib diisi.', 400);
  }

  const ok = await rateQuiz(body.quizId, user.id, Number(body.rating));
  if (!ok) throw new RoomError('Nilai harus antara 1 sampai 5.', 400);

  return NextResponse.json({ success: true });
});
