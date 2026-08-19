import { NextResponse } from 'next/server';
import { handle, readJson, requireUser } from '@/lib/api-guard';
import { assertHost, normalizeRoomCode, logEvent, RoomError } from '@/lib/room';
import { sql } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';

/**
 * POST /api/room/update-teams
 *
 * Pembagian regu adalah kendali host, tetapi versi lama menerimanya dari
 * siapa saja yang tahu kode ruangan. Peserta bisa memindahkan dirinya ke
 * regu yang sedang unggul, atau mengacak seluruh pembagian di tengah
 * permainan.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ roomCode?: string; teams?: Record<string, { id: string }[]> }>(req);

  const code = normalizeRoomCode(body.roomCode);
  if (!body.teams || typeof body.teams !== 'object') {
    throw new RoomError('Susunan regu wajib disertakan.', 400);
  }

  const room = await assertHost(code, user.id);

  // Peta peserta ke regu disusun lebih dulu, lalu ditulis dalam satu
  // transaksi. Kalau salah satu penulisan ditolak, pembagiannya tidak
  // berakhir separuh berubah.
  const assignments: { playerId: string; team: string }[] = [];

  for (const [teamName, members] of Object.entries(body.teams)) {
    if (!Array.isArray(members)) continue;
    const clean = teamName.trim().slice(0, 40);
    if (!clean) continue;
    for (const member of members) {
      if (member && typeof member.id === 'string') {
        assignments.push({ playerId: member.id, team: clean });
      }
    }
  }

  await sql.transaction([
    sql`UPDATE room_players SET team = NULL WHERE room_code = ${code}`,
    ...assignments.map(
      (a) => sql`
        UPDATE room_players SET team = ${a.team}
        WHERE room_code = ${code} AND id = ${a.playerId}
      `
    ),
  ]);

  await logEvent(code, room.session_id, 'teams_updated', { count: assignments.length });

  try {
    await pusherServer.trigger(`room-${code}`, 'teams_updated', {
      teams: Object.keys(body.teams),
    });
  } catch (err) {
    console.error('[Pusher] gagal menyiarkan teams_updated:', err);
  }

  return NextResponse.json({ success: true, assigned: assignments.length });
});
