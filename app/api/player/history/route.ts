import { NextResponse } from 'next/server';
import { handle, requireUser } from '@/lib/api-guard';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/player/history
 *
 * Riwayat sesi milik pengguna yang sedang masuk.
 *
 * Penyaringan berdasarkan host_id ditulis di dalam query, bukan
 * dikerjakan setelah data terbaca. Menyaring setelah membaca berarti
 * seluruh riwayat semua orang sempat berada di memori proses ini, dan
 * satu kekeliruan kecil pada penyusunan tanggapan sudah cukup untuk
 * membocorkannya.
 */
export const GET = handle(async () => {
  const user = await requireUser();

  const rows = (await sql`
    SELECT r.session_id, r.room_code, r.finished_at, r.payload,
           q.title, q.category
    FROM session_results r
    LEFT JOIN quizzes q ON q.id = r.quiz_id
    WHERE r.host_id = ${user.id}::uuid
    ORDER BY r.finished_at DESC
    LIMIT 50
  `) as Record<string, unknown>[];

  return NextResponse.json({ sessions: rows }, { headers: { 'Cache-Control': 'no-store' } });
});
