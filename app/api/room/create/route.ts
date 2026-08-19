import { NextResponse } from 'next/server';
import { handle, readJson, requireUser } from '@/lib/api-guard';
import { createRoom, RoomError } from '@/lib/room';
import { getQuizMeta } from '@/lib/quiz';
import { sql } from '@/lib/db';

/**
 * POST /api/room/create
 *
 * Versi lama menerima hostId dari badan permintaan dan memakainya bila
 * ada, dengan id sesi hanya sebagai cadangan. Artinya pengguna yang sudah
 * masuk bisa membuat ruangan yang tercatat atas nama orang lain.
 * Sekarang pemiliknya selalu diambil dari sesi.
 *
 * Kepemilikan kuis juga diperiksa: tanpa itu, siapa pun bisa membuka
 * ruangan untuk kuis pribadi milik orang lain hanya dengan menebak id-nya,
 * lalu menayangkan seluruh soalnya lewat layar permainan.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson<{
    quizId?: string;
    gameMode?: string;
    settings?: Record<string, unknown>;
  }>(req);

  if (typeof body.quizId !== 'string' || !body.quizId) {
    throw new RoomError('quizId wajib diisi.', 400);
  }

  const quiz = await getQuizMeta(body.quizId);
  if (!quiz) throw new RoomError('Kuis tidak ditemukan.', 404);

  // Kuis publik boleh dibawakan siapa saja; selain itu hanya pemiliknya.
  if (quiz.visibility === 'private' && quiz.hostId !== user.id) {
    throw new RoomError('Kuis tidak ditemukan.', 404);
  }

  const questionCount = (await sql`
    SELECT count(*)::int AS n FROM questions WHERE quiz_id = ${body.quizId}
  `) as { n: number }[];

  if ((questionCount[0]?.n ?? 0) === 0) {
    throw new RoomError('Kuis ini belum punya soal.', 409);
  }

  const settings = {
    timer: 30,
    maxPlayers: 300,
    showAnswerAfterQuestion: true,
    showLeaderboardBetweenQuestions: true,
    ...(body.settings ?? {}),
  };

  const { code, sessionId } = await createRoom({
    quizId: body.quizId,
    hostId: user.id,
    gameMode: body.gameMode ?? 'classic',
    settings,
  });

  return NextResponse.json({
    roomCode: code,
    sessionId,
    totalQuestions: questionCount[0].n,
  });
});
