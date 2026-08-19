import { NextResponse } from 'next/server';
import { handle, readJson, requireUser } from '@/lib/api-guard';
import { assertHost, normalizeRoomCode, kickPlayer, logEvent, RoomError } from '@/lib/room';
import { pusherServer } from '@/lib/pusher';

/**
 * POST /api/room/kick
 *
 * Route ini sudah memeriksa host sejak semula. Yang berubah hanya
 * penandaannya: peserta ditandai is_kicked, bukan dibuang dari daftar.
 * Menghapus barisnya akan ikut menghapus jawaban dan skornya, sehingga
 * rekap sesi jadi tidak cocok dengan apa yang benar-benar terjadi.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ roomCode?: string; playerId?: string }>(req);

  const code = normalizeRoomCode(body.roomCode);
  if (typeof body.playerId !== 'string' || !body.playerId) {
    throw new RoomError('playerId wajib diisi.', 400);
  }

  const room = await assertHost(code, user.id);
  const removed = await kickPlayer(code, body.playerId);

  if (!removed) throw new RoomError('Peserta tidak ditemukan di ruangan ini.', 404);

  await logEvent(code, room.session_id, 'player_kicked', { playerId: body.playerId });

  try {
    await pusherServer.trigger(`room-${code}`, 'player_kicked', { playerId: body.playerId });
  } catch (err) {
    console.error('[Pusher] gagal menyiarkan player_kicked:', err);
  }

  return NextResponse.json({ success: true });
});
