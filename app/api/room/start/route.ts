import { NextResponse } from 'next/server';
import { handle, readJson, requireUser } from '@/lib/api-guard';
import { assertHost, normalizeRoomCode, updateRoomState, logEvent } from '@/lib/room';
import { pusherServer } from '@/lib/pusher';

/**
 * POST /api/room/start
 *
 * Sebelumnya route ini hanya menerima roomCode lalu menjalankan permainan.
 * Tidak ada pemeriksaan sama sekali. Kode ruangan justru sengaja
 * ditampilkan besar-besar di layar agar peserta bisa bergabung, jadi
 * setiap orang di ruangan itu memegang semua yang dibutuhkan untuk
 * memulai permainan orang lain — atau memulai ulang permainan sendiri
 * dari soal pertama di tengah sesi.
 *
 * assertHost menutup itu: hanya pemilik ruangan yang bisa menjalankannya.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ roomCode?: string; gameMode?: string; settings?: Record<string, unknown> }>(req);

  const code = normalizeRoomCode(body.roomCode);
  const room = await assertHost(code, user.id);

  const updated = await updateRoomState(code, room.version, {
    status: 'playing',
    currentQuestionIndex: 0,
    questionStartedAt: new Date(),
    settings: { ...room.settings, ...(body.settings ?? {}) },
    // Ragam ikut disimpan di sini. Sebelumnya field ini diterima lalu
    // dibuang, sehingga pilihan guru di dialog mulai tidak pernah
    // berlaku dan setiap sesi berjalan sebagai Klasik.
    gameMode: body.gameMode,
  });

  await logEvent(code, room.session_id, 'game_started', { gameMode: updated.game_mode });

  try {
    await pusherServer.trigger(`room-${code}`, 'game_started', {
      status: updated.status,
      gameMode: updated.game_mode,
      settings: updated.settings,
      version: updated.version,
    });
  } catch (err) {
    // Penyiaran gagal bukan alasan menggagalkan permainan. Klien yang
    // tidak menerima siaran tetap akan menyusul lewat polling keadaan.
    console.error('[Pusher] gagal menyiarkan game_started:', err);
  }

  return NextResponse.json({ success: true, version: updated.version });
});
