import { NextResponse } from 'next/server';
import { handle, readJson, requireUser } from '@/lib/api-guard';
import { assertHost, normalizeRoomCode, endRoom, logEvent } from '@/lib/room';
import { getLeaderboard } from '@/lib/answers';
import { incrementPlays } from '@/lib/quiz';
import { sql } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';

/**
 * POST /api/room/end
 *
 * Versi lama menerima roomCode dari siapa saja dan langsung menutup
 * permainan. Satu permintaan dari peserta cukup untuk membubarkan sesi
 * satu kelas.
 *
 * Selain memasang penjaga, route ini sekarang juga mengabadikan hasilnya.
 * Sebelumnya hasil hanya menumpang pada keadaan ruangan yang berumur
 * tujuh hari, lalu hilang bersama ruangannya. Riwayat permainan jadi
 * kosong tanpa ada yang menghapus apa pun.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ roomCode?: string }>(req);

  const code = normalizeRoomCode(body.roomCode);
  const room = await assertHost(code, user.id);

  const leaderboard = await getLeaderboard(code, 500);

  const stats = (await sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE is_correct)::int AS benar
    FROM answers WHERE session_id = ${room.session_id}
  `) as { total: number; benar: number }[];

  // Rincian per soal ikut disalin: tabel jawaban terhapus bersama
  // ruangannya, sedangkan tab Review dan Analytics tetap membutuhkannya.
  const perSoal = (await sql`
    SELECT q.id, q.type, q.text,
           count(a.id)::int AS answered,
           count(a.id) FILTER (WHERE a.is_correct)::int AS correct
    FROM questions q
    JOIN answers a ON a.question_id = q.id AND a.session_id = ${room.session_id}
    GROUP BY q.id
    ORDER BY q.position
  `) as { id: string; type: string; text: string; answered: number; correct: number }[];
  const questions = perSoal.map((q) => ({
    ...q,
    accuracy: q.answered > 0 ? Math.round((q.correct / q.answered) * 100) : 0,
  }));

  // Hasil disimpan sebagai catatan tersendiri supaya tetap ada setelah
  // ruangannya kedaluwarsa dan terhapus.
  await sql`
    INSERT INTO session_results (session_id, room_code, quiz_id, host_id, payload)
    VALUES (
      ${room.session_id}, ${code}, ${room.quiz_id}, ${room.host_id}::uuid,
      ${JSON.stringify({
        gameMode: room.game_mode,
        settings: room.settings,
        leaderboard,
        questions,
        answers: stats[0] ?? { total: 0, benar: 0 },
        endedAt: new Date().toISOString(),
      })}::jsonb
    )
    ON CONFLICT (session_id) DO UPDATE SET payload = EXCLUDED.payload, finished_at = now()
  `;

  await endRoom(code);
  await incrementPlays(room.quiz_id);
  await logEvent(code, room.session_id, 'game_ended', { players: leaderboard.length });

  try {
    await pusherServer.trigger(`room-${code}`, 'game_ended', {
      status: 'ended',
      sessionId: room.session_id,
    });
  } catch (err) {
    console.error('[Pusher] gagal menyiarkan game_ended:', err);
  }

  return NextResponse.json({
    success: true,
    sessionId: room.session_id,
    players: leaderboard.length,
  });
});
