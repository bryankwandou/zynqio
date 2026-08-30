import { NextResponse } from 'next/server';
import { handle } from '@/lib/api-guard';
import { getRoom, getPlayers, normalizeRoomCode, RoomError } from '@/lib/room';
import { getQuizForPlayers } from '@/lib/quiz';
import { getQuestionStats } from '@/lib/answers';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/room/state?roomCode=...
 *
 * Keadaan ruangan yang dibaca peserta.
 *
 * Yang dikirim hanya soal yang sedang berjalan, dan hanya dalam bentuk
 * tanpa kunci jawaban. Versi sebelumnya menyertakan seluruh daftar soal
 * sekaligus supaya klien bisa berpindah sendiri tanpa menunggu jaringan.
 * Itu memang terasa mulus, tetapi seluruh kuis — termasuk jawabannya —
 * sudah berada di peramban peserta sejak detik pertama.
 */
export const GET = handle(async (req) => {
  const { searchParams } = new URL(req.url);
  const code = normalizeRoomCode(searchParams.get('roomCode'));

  const room = await getRoom(code);
  if (!room) throw new RoomError('Ruangan tidak ditemukan.', 404);

  const players = await getPlayers(code);

  const session = await getServerSession(authOptions);
  const isHost = (session?.user as { id?: string } | undefined)?.id === room.host_id;

  const quiz = await getQuizForPlayers(room.quiz_id);
  const totalQuestions = quiz?.questions.length ?? 0;

  // Hanya satu soal yang menyeberang, dan hanya ketika permainan berjalan.
  const current =
    room.status === 'playing' && quiz
      ? quiz.questions[room.current_question_index] ?? null
      : null;

  /*
    Statistik jawaban soal yang sedang berjalan, dihitung dari tabel
    jawaban — bukan dari penghitung terpisah yang bisa melenceng.

    Hanya sebaran pilihannya yang ikut, tidak pernah pilihan mana yang
    benar: peserta memanggil route ini juga, dan mengirimkan penanda
    is_correct ke sana sama saja dengan membocorkan kunci jawaban lewat
    pintu belakang. Yang menyeberang cuma "berapa orang memilih apa",
    ditambah jumlah yang benar sebagai satu angka gabungan untuk
    ketepatan kelas — angka yang tidak memberi tahu pilihan mana pun.
  */
  let answerStats: Record<string, { total: number; correct: number; byAnswer: Record<string, number> }> = {};
  if (current && room.session_id) {
    try {
      const stats = await getQuestionStats(room.session_id, current.id);
      const byAnswer: Record<string, number> = {};
      for (const baris of stats.distribution) {
        const kunci = typeof baris.choice === 'string' ? baris.choice : JSON.stringify(baris.choice);
        if (kunci !== null && kunci !== undefined) byAnswer[kunci] = (byAnswer[kunci] ?? 0) + baris.n;
      }
      answerStats = { [current.id]: { total: stats.total, correct: stats.correct, byAnswer } };
    } catch {
      // Statistik yang gagal dihitung tidak boleh menjatuhkan seluruh
      // keadaan ruangan; layar tetap berjalan tanpa angka sebarannya.
    }
  }

  return NextResponse.json(
    {
      roomCode: room.code,
      sessionId: room.session_id,
      status: room.status,
      gameMode: room.game_mode,
      settings: room.settings,
      version: room.version,
      currentQuestionIndex: room.current_question_index,
      questionStartedAt: room.question_started_at,
      totalQuestions,
      isHost,
      question: current,
      // Sebaran jawaban hanya berarti bagi layar guru, tetapi tidak
      // berbahaya bagi murid: tidak ada kunci jawaban di dalamnya.
      answerStats,
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        avatarId: p.avatar_id,
        score: p.score,
        streak: p.streak,
        totalAnswered: p.total_answered,
        totalCorrect: p.total_correct,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});
