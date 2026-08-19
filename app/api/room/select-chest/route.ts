import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/api-guard';
import { assertPlayer, getRoom, normalizeRoomCode, logEvent, RoomError } from '@/lib/room';
import { sql, isUniqueViolation } from '@/lib/db';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { pusherServer } from '@/lib/pusher';
import crypto from 'crypto';

/**
 * POST /api/room/select-chest — mode Gold Quest.
 *
 * Dua hal yang dulu membuat mode ini bisa dicurangi sepenuhnya.
 *
 * Pertama, peserta disebutkan lewat playerId di badan permintaan. Tidak
 * ada yang memastikan pengirimnya memang orang itu, jadi peti bisa dibuka
 * atas nama siapa pun.
 *
 * Kedua, tidak ada batas berapa kali boleh dipanggil. Hadiah terbesarnya
 * seribu poin, jadi memanggil endpoint ini berulang-ulang adalah cara
 * tercepat memenangkan permainan tanpa menjawab satu soal pun.
 *
 * Sekarang peserta dibuktikan lewat token, dan satu putaran hanya bisa
 * diambil sekali — dijamin indeks unik, bukan pemeriksaan yang bisa
 * dilewati dengan mengirim beberapa permintaan sekaligus.
 */

const OUTCOMES = [
  { type: 'gold', amount: 500, label: 'Peti berisi 500 emas.' },
  { type: 'gold', amount: 200, label: 'Peti berisi 200 emas.' },
  { type: 'steal', amount: 100, label: 'Kesempatan mengambil 100 emas peserta lain.' },
  { type: 'jackpot', amount: 1000, label: 'Peti besar. Seribu emas sekaligus.' },
  { type: 'gold', amount: -100, label: 'Peti kosong, dan seratus emas melayang.' },
] as const;

export const POST = handle(async (req) => {
  const ip = getIP(req);
  if (!(await rateLimit(ip, 'chest', 20, 60))) {
    return NextResponse.json({ error: 'Terlalu cepat. Tunggu sebentar.' }, { status: 429 });
  }

  const body = await readJson<{ roomCode?: string; playerToken?: string }>(req);
  const code = normalizeRoomCode(body.roomCode);

  const player = await assertPlayer(code, body.playerToken);
  const room = await getRoom(code);
  if (!room) throw new RoomError('Ruangan tidak ditemukan.', 404);
  if (room.status !== 'playing') throw new RoomError('Ruangan sedang tidak bermain.', 409);
  if (room.game_mode !== 'gold_quest') {
    throw new RoomError('Mode permainan ini tidak memakai peti.', 409);
  }

  // Hasil ditentukan server memakai sumber acak kriptografis, bukan
  // Math.random, dan tidak pernah dikirimkan sebelum tercatat.
  const outcome = OUTCOMES[crypto.randomInt(0, OUTCOMES.length)];

  try {
    await sql`
      INSERT INTO chest_picks (session_id, room_code, player_id, question_index, outcome, awarded)
      VALUES (
        ${room.session_id}, ${code}, ${player.id}, ${room.current_question_index},
        ${JSON.stringify(outcome)}::jsonb, ${outcome.amount}
      )
    `;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new RoomError('Peti untuk putaran ini sudah Anda ambil.', 409);
    }
    throw err;
  }

  let stolenFrom: string | null = null;

  if (outcome.type === 'steal') {
    // Korban dipilih dan dikurangi dalam satu pernyataan, jadi tidak ada
    // celah antara memilih dan mengurangi yang bisa dipakai dua kali.
    const victim = (await sql`
      UPDATE room_players SET score = GREATEST(0, score - ${outcome.amount})
      WHERE id = (
        SELECT id FROM room_players
        WHERE room_code = ${code} AND id <> ${player.id} AND is_kicked = false AND score > 0
        ORDER BY random() LIMIT 1
      )
      RETURNING name
    `) as { name: string }[];
    stolenFrom = victim[0]?.name ?? null;
  }

  const updated = (await sql`
    UPDATE room_players SET score = GREATEST(0, score + ${outcome.amount})
    WHERE id = ${player.id}
    RETURNING score
  `) as { score: number }[];

  await logEvent(code, room.session_id, 'chest_opened', {
    playerId: player.id,
    amount: outcome.amount,
  });

  try {
    await pusherServer.trigger(`room-${code}`, 'chest_opened', {
      playerName: player.name,
      label: outcome.label,
      stolenFrom,
    });
  } catch (err) {
    console.error('[Pusher] gagal menyiarkan chest_opened:', err);
  }

  return NextResponse.json({
    outcome: { type: outcome.type, amount: outcome.amount, label: outcome.label },
    stolenFrom,
    totalScore: updated[0]?.score ?? 0,
  });
});
