import { NextResponse } from 'next/server';
import { handle } from '@/lib/api-guard';
import { listPublicQuizzes } from '@/lib/quiz';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quiz/public — katalog kuis publik.
 *
 * Yang dikembalikan hanya keterangan kuis. Soal dan jawabannya tidak
 * ikut, jadi katalog ini tidak bisa dipakai memanen isi kuis.
 */
export const GET = handle(async (req) => {
  const { searchParams } = new URL(req.url);

  const quizzes = await listPublicQuizzes({
    category: searchParams.get('category'),
    search: searchParams.get('q'),
    limit: Number(searchParams.get('limit') ?? 24),
    offset: Number(searchParams.get('offset') ?? 0),
  });

  return NextResponse.json(quizzes, { headers: { 'Cache-Control': 'no-store' } });
});
