import { NextResponse } from 'next/server';
import { handle, readJson, requireUser } from '@/lib/api-guard';
import { createQuiz } from '@/lib/quiz';
import { RoomError } from '@/lib/room';

/** POST /api/quiz/create — membuat kuis kosong milik pengguna yang masuk. */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson<{
    title?: string;
    description?: string;
    category?: string;
    visibility?: string;
  }>(req);

  const title = String(body.title ?? '').trim();
  if (title.length < 3 || title.length > 200) {
    throw new RoomError('Judul kuis harus 3 sampai 200 karakter.', 400);
  }

  // Pemiliknya diambil dari sesi, tidak pernah dari badan permintaan.
  const quizId = await createQuiz(user.id, {
    title,
    description: body.description ?? null,
    author: user.name ?? null,
    category: body.category,
    visibility: body.visibility,
  });

  return NextResponse.json({ quizId });
});
