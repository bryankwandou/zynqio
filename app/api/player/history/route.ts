import { NextResponse } from 'next/server';
import { handle, requireUser } from '@/lib/api-guard';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/player/history
 *
 * Riwayat sesi yang dibawakan pengguna yang sedang masuk.
 *
 * Penyaringan berdasarkan host_id ditulis di dalam query, bukan
 * dikerjakan setelah data terbaca. Menyaring setelah membaca berarti
 * seluruh riwayat semua orang sempat berada di memori proses ini, dan
 * satu kekeliruan kecil pada penyusunan tanggapan sudah cukup untuk
 * membocorkannya.
 *
 * Angka ringkasannya dihitung di sini, dari payload yang tersimpan.
 *
 * Sebelumnya route ini mengirim baris mentah, sementara halaman riwayat
 * membaca h.accuracy, h.rank, h.score, dan h.totalPlayers — empat nama
 * yang tidak satu pun ada di dalamnya. Akibatnya seluruh tab riwayat
 * menampilkan nol persen, peringkat "—", dan grafik yang seluruh
 * batangnya rata di dasar. Tidak ada galat yang muncul, karena membaca
 * bidang yang tidak ada hanya menghasilkan undefined.
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
  `) as {
    session_id: string;
    room_code: string;
    finished_at: string;
    payload: {
      leaderboard?: { name: string; score: number }[];
      answers?: { total?: number; benar?: number };
      gameMode?: string;
    } | null;
    title: string | null;
    category: string | null;
  }[];

  const sessions = rows.map((r) => {
    const papan = r.payload?.leaderboard ?? [];
    const jawaban = r.payload?.answers ?? {};
    const total = Number(jawaban.total ?? 0);
    const benar = Number(jawaban.benar ?? 0);

    return {
      sessionId: r.session_id,
      roomCode: r.room_code,
      title: r.title ?? 'Kuis yang sudah dihapus',
      category: r.category,
      date: r.finished_at,
      gameMode: r.payload?.gameMode ?? 'classic',
      totalPlayers: papan.length,
      // Ketepatan seluruh kelas pada sesi itu, bukan milik satu orang.
      accuracy: total > 0 ? Math.round((benar / total) * 100) : 0,
      totalAnswers: total,
      // Peserta dengan skor tertinggi. Papan peringkat sudah terurut
      // menurun saat disimpan, jadi yang teratas adalah yang dicari.
      topName: papan[0]?.name ?? null,
      topScore: papan[0]?.score ?? 0,
    };
  });

  return NextResponse.json({ sessions }, { headers: { 'Cache-Control': 'no-store' } });
});
