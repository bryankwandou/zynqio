import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/api-guard';
import { addPlayer, normalizeRoomCode, getRoom, RoomError, logEvent } from '@/lib/room';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { pusherServer } from '@/lib/pusher';

/**
 * POST /api/room/join
 *
 * Route ini memang terbuka tanpa perlu masuk — peserta bergabung lewat
 * kode di layar, dan memaksa mereka membuat akun akan mematikan alasan
 * produk ini dipakai di kelas.
 *
 * Yang berubah: penyelesaian nama ganda tidak lagi bergantung pada
 * membaca daftar peserta lalu menulis balik. Nama unik ditegakkan indeks
 * basis data, jadi dua orang yang menekan tombol pada detik yang sama
 * tidak bisa keduanya masuk sebagai "Budi".
 *
 * Token yang dikembalikan adalah satu-satunya bukti identitas peserta
 * sesudah ini. Nilainya hanya muncul sekali di tanggapan ini; yang
 * tersimpan di basis data adalah hash-nya.
 */
export const POST = handle(async (req) => {
  const ip = getIP(req);
  /*
    Batasnya dulu sepuluh permintaan per menit per alamat. Di sekolah
    itu berarti sepuluh murid: seluruh ponsel di satu ruang kelas keluar
    lewat satu alamat publik yang sama, dan murid kesebelas dan
    seterusnya dijawab "Terlalu banyak percobaan bergabung" — persis
    ketika guru sedang menunggu kelasnya masuk.

    Angkanya sekarang dipasang di atas ukuran ruangan terbesar (300),
    jadi satu kelas penuh yang masuk bersamaan tidak pernah menyentuhnya,
    sementara banjir permintaan dari satu naskah tetap tertahan.
  */
  if (!(await rateLimit(ip, 'join', 400, 60))) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan bergabung. Tunggu sebentar.' },
      { status: 429 }
    );
  }

  const body = await readJson<{
    roomCode?: string;
    playerName?: string;
    nickname?: string;
    avatarId?: string;
  }>(req);

  const code = normalizeRoomCode(body.roomCode);
  const rawName = body.playerName ?? body.nickname;

  if (typeof rawName !== 'string' || !rawName.trim()) {
    throw new RoomError('Nama peserta wajib diisi.', 400);
  }

  const room = await getRoom(code);
  if (!room) throw new RoomError('Ruangan tidak ditemukan.', 404);

  const { player, token } = await addPlayer({
    code,
    name: rawName,
    avatarId: body.avatarId,
  });

  await logEvent(code, room.session_id, 'player_joined', { playerId: player.id });

  try {
    await pusherServer.trigger(`room-${code}`, 'player_joined', {
      player: { id: player.id, name: player.name, avatarId: player.avatar_id },
    });
  } catch (err) {
    console.error('[Pusher] gagal menyiarkan player_joined:', err);
  }

  return NextResponse.json({
    success: true,
    player: { id: player.id, name: player.name, avatarId: player.avatar_id },
    playerToken: token,
    room: { roomCode: code, status: room.status },
  });
});
