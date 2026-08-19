import { NextResponse } from 'next/server';
import { handle } from '@/lib/api-guard';
import { normalizeRoomCode, getRoom, RoomError } from '@/lib/room';
import { getLeaderboard } from '@/lib/answers';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/room/results?roomCode=...  atau  ?sessionId=...
 *
 * Hasil dibaca dari catatan sesi bila permainannya sudah selesai, dan
 * dari tabel peserta bila masih berjalan. Keduanya dihitung dari data
 * yang sama, jadi angkanya tidak berbeda antara layar akhir dan riwayat.
 */
export const GET = handle(async (req) => {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const roomCode = searchParams.get('roomCode');

  if (sessionId) {
    const saved = (await sql`
      SELECT payload, finished_at FROM session_results WHERE session_id = ${sessionId} LIMIT 1
    `) as { payload: Record<string, unknown>; finished_at: string }[];

    if (saved[0]) {
      return NextResponse.json({ ...saved[0].payload, finishedAt: saved[0].finished_at });
    }
  }

  if (!roomCode) throw new RoomError('Perlu roomCode atau sessionId.', 400);

  const code = normalizeRoomCode(roomCode);
  const room = await getRoom(code);
  if (!room) throw new RoomError('Ruangan tidak ditemukan.', 404);

  const leaderboard = await getLeaderboard(code, 500);

  return NextResponse.json({
    sessionId: room.session_id,
    status: room.status,
    gameMode: room.game_mode,
    leaderboard,
  });
});
