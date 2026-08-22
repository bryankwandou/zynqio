import { NextResponse } from 'next/server';
import { handle, requireUser } from '@/lib/api-guard';
import { assertHost, normalizeRoomCode, RoomError } from '@/lib/room';
import { sql, type FullQuestionRow } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quiz/get-question?roomCode=...&index=...
 *
 * Satu soal beserta kunci jawabannya, untuk layar host.
 *
 * Host memang perlu kunci jawaban — layarnya menampilkan jawaban benar
 * saat pembahasan. Karena itu route ini tidak menyembunyikannya, tetapi
 * menutup pintunya rapat-rapat: pemanggilnya harus sudah masuk dan harus
 * benar-benar host ruangan yang disebut.
 *
 * Bentuk lamanya menerima quizId apa adanya tanpa pemeriksaan siapa pun,
 * jadi peserta bisa memanggilnya sendiri dan membaca kunci jawaban soal
 * yang sedang berjalan.
 */
export const GET = handle(async (req) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);

  const code = normalizeRoomCode(searchParams.get('roomCode'));
  const room = await assertHost(code, user.id);

  const index = Number(searchParams.get('index') ?? room.current_question_index);
  if (!Number.isInteger(index) || index < 0) {
    throw new RoomError('Nomor soal tidak sah.', 400);
  }

  const counted = (await sql`
    SELECT count(*)::int AS n FROM questions WHERE quiz_id = ${room.quiz_id}
  `) as { n: number }[];

  const rows = (await sql`
    SELECT id, quiz_id, position, type, text, options, correct_answer,
           explanation, image_url, points, time_limit
    FROM questions
    WHERE quiz_id = ${room.quiz_id} AND position = ${index}
    LIMIT 1
  `) as FullQuestionRow[];

  if (!rows[0]) throw new RoomError('Soal tidak ditemukan.', 404);

  const q = rows[0];

  return NextResponse.json(
    {
      id: q.id,
      index: q.position,
      type: q.type,
      text: q.text,
      options: q.options,
      correctAnswer: q.correct_answer,
      explanation: q.explanation,
      imageUrl: q.image_url,
      points: q.points,
      timeLimit: q.time_limit,
      totalQuestions: counted[0]?.n ?? 0,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});
