import { NextResponse } from 'next/server';
import { handle, readJson, requireUser } from '@/lib/api-guard';
import { assertHost, normalizeRoomCode, updateRoomState, logEvent } from '@/lib/room';
import { sql } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';

/**
 * POST /api/room/next-question
 *
 * Dua masalah pada versi sebelumnya, dan keduanya terasa oleh peserta.
 *
 * Pertama, tidak ada pemeriksaan siapa yang memanggil. Peserta mana pun
 * bisa melompatkan soal, dan pada mode yang menampilkan soal serentak
 * satu orang iseng bisa menghabiskan seluruh kuis dalam beberapa detik.
 *
 * Kedua, indeks soal dinaikkan dengan membaca keadaan lalu menuliskannya
 * kembali. Dua penekanan tombol yang berdekatan — atau satu penekanan
 * yang terkirim dua kali karena jaringan lambat — sama-sama membaca angka
 * yang sama, lalu menulis angka yang sama pula. Akibatnya satu soal
 * terlewat tanpa pernah tampil. Penambahan bersyarat versi menutup itu:
 * penekanan kedua membawa versi yang sudah basi dan ditolak.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ roomCode?: string; expectedVersion?: number }>(req);

  const code = normalizeRoomCode(body.roomCode);
  const room = await assertHost(code, user.id);

  const counted = (await sql`
    SELECT count(*)::int AS n FROM questions WHERE quiz_id = ${room.quiz_id}
  `) as { n: number }[];
  const totalQuestions = counted[0]?.n ?? 0;

  const nextIndex = room.current_question_index + 1;
  const finished = nextIndex >= totalQuestions;

  // Bila klien menyertakan versi yang ia lihat, versi itulah yang dipakai
  // sebagai syarat. Tanpa itu, versi terbaca dipakai — masih menolak
  // pengiriman ganda yang datang setelah perubahan pertama tersimpan.
  const expected = Number.isInteger(body.expectedVersion)
    ? Number(body.expectedVersion)
    : room.version;

  const updated = await updateRoomState(code, expected, {
    status: finished ? 'ended' : 'playing',
    currentQuestionIndex: finished ? room.current_question_index : nextIndex,
    questionStartedAt: finished ? null : new Date(),
  });

  await logEvent(code, room.session_id, finished ? 'game_ended' : 'question_started', {
    index: updated.current_question_index,
  });

  try {
    await pusherServer.trigger(
      `room-${code}`,
      finished ? 'game_ended' : 'question_started',
      {
        index: updated.current_question_index,
        status: updated.status,
        version: updated.version,
        startedAt: updated.question_started_at,
        totalQuestions,
      }
    );
  } catch (err) {
    console.error('[Pusher] gagal menyiarkan perpindahan soal:', err);
  }

  return NextResponse.json({
    success: true,
    status: updated.status,
    index: updated.current_question_index,
    version: updated.version,
    totalQuestions,
  });
});
