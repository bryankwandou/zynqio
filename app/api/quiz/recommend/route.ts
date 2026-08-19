import { NextResponse } from 'next/server';
import { handle } from '@/lib/api-guard';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quiz/recommend?quizId=...
 *
 * Saran kuis lain yang sejenis. Hanya kuis publik yang muncul, dan hanya
 * keterangannya — tidak ada soal, tidak ada jawaban.
 */
export const GET = handle(async (req) => {
  const { searchParams } = new URL(req.url);
  const quizId = searchParams.get('quizId');

  const rows = (await sql`
    WITH acuan AS (
      SELECT category FROM quizzes WHERE id = ${quizId} LIMIT 1
    )
    SELECT q.id, q.title, q.author, q.category, q.cover_image, q.plays,
           CASE WHEN q.rating_count = 0 THEN 0
                ELSE ROUND(q.rating_sum::numeric / q.rating_count, 2)
           END AS rating,
           (SELECT count(*)::int FROM questions WHERE quiz_id = q.id) AS question_count
    FROM quizzes q
    WHERE q.visibility = 'public'
      AND q.id IS DISTINCT FROM ${quizId}
    ORDER BY
      (q.category = (SELECT category FROM acuan)) DESC,
      q.plays DESC
    LIMIT 8
  `) as Record<string, unknown>[];

  return NextResponse.json({ quizzes: rows }, { headers: { 'Cache-Control': 'no-store' } });
});
