import { NextResponse } from 'next/server';
import { handle, readJson, requireUser } from '@/lib/api-guard';
import { updateQuizMeta, replaceQuestions, type QuestionInput } from '@/lib/quiz';
import { RoomError } from '@/lib/room';

/**
 * POST /api/quiz/save
 *
 * Menyimpan keterangan kuis sekaligus seluruh soalnya.
 *
 * Kepemilikan diperiksa di dalam kedua fungsi yang dipanggil, bukan di
 * sini. Pemeriksaan yang menempel pada operasinya sendiri tidak bisa
 * terlewat ketika suatu saat ada pemanggil baru.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson<{
    quizId?: string;
    title?: string;
    description?: string;
    category?: string;
    visibility?: string;
    questions?: QuestionInput[];
  }>(req);

  if (typeof body.quizId !== 'string' || !body.quizId) {
    throw new RoomError('quizId wajib diisi.', 400);
  }

  const updated = await updateQuizMeta(body.quizId, user.id, {
    title: body.title,
    description: body.description,
    category: body.category,
    visibility: body.visibility,
  });

  if (!updated) throw new RoomError('Kuis tidak ditemukan atau bukan milik Anda.', 404);

  let saved = 0;
  if (Array.isArray(body.questions)) {
    saved = await replaceQuestions(body.quizId, user.id, body.questions);
  }

  return NextResponse.json({ success: true, questions: saved });
});
