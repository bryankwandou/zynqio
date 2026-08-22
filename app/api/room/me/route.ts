import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/api-guard';
import { assertPlayer, normalizeRoomCode, getRoom, RoomError } from '@/lib/room';

export const dynamic = 'force-dynamic';

/**
 * POST /api/room/me
 *
 * Memberi tahu peserta siapa dirinya di ruangan ini, berdasarkan token
 * yang ia pegang.
 *
 * Endpoint ini ada karena /api/room/state tidak lagi menyertakan token
 * peserta mana pun. Versi lama menyertakannya, dan halaman peserta
 * memanfaatkannya untuk memeriksa apakah sesinya masih berlaku — dengan
 * cara mencari token miliknya di dalam daftar. Cara itu bekerja, tetapi
 * berarti daftar peserta yang bisa dibaca siapa saja memuat token semua
 * orang. Siapa pun yang membuka alamat itu bisa mengambil token peserta
 * lain dan bertindak atas namanya.
 *
 * Sekarang tokennya dikirim, bukan diterima: peserta menyodorkan token
 * miliknya, dan server menjawab satu baris tentang dirinya sendiri.
 */
export const POST = handle(async (req) => {
  const body = await readJson<{ roomCode?: string; playerToken?: string }>(req);
  const code = normalizeRoomCode(body.roomCode);

  const room = await getRoom(code);
  if (!room) throw new RoomError('Ruangan tidak ditemukan.', 404);

  const player = await assertPlayer(code, body.playerToken);

  return NextResponse.json(
    {
      player: {
        id: player.id,
        name: player.name,
        avatarId: player.avatar_id,
        score: player.score,
        streak: player.streak,
      },
      room: {
        roomCode: room.code,
        status: room.status,
        currentQuestionIndex: room.current_question_index,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});
