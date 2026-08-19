import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/api-guard';
import { normalizeRoomCode } from '@/lib/room';
import { submitAnswer, getQuestionStats } from '@/lib/answers';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { pusherServer } from '@/lib/pusher';
import { RoomError } from '@/lib/room';

/**
 * POST /api/answer/submit
 *
 * Perubahan terpenting ada pada cara peserta dikenali.
 *
 * Versi lama memakai playerId yang dikirim dalam badan permintaan, apa
 * adanya, lalu mencocokkannya dengan id atau nama peserta di ruangan.
 * Nama peserta terpampang di papan peringkat, jadi mengirim jawaban atas
 * nama orang lain — atau menaikkan skor sendiri berkali-kali — hanya
 * perlu menyalin nama dari layar.
 *
 * Sekarang yang menentukan adalah token peserta, yang diterbitkan saat
 * bergabung dan hanya disimpan dalam bentuk hash. Nama tidak lagi
 * berfungsi sebagai identitas.
 */
export const POST = handle(async (req) => {
  const ip = getIP(req);
  if (!(await rateLimit(ip, 'answer', 30, 60))) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan. Tunggu sebentar.' }, { status: 429 });
  }

  const body = await readJson<{
    roomCode?: string;
    playerToken?: string;
    questionId?: string;
    selectedAnswer?: unknown;
  }>(req);

  const code = normalizeRoomCode(body.roomCode);

  if (typeof body.questionId !== 'string' || !body.questionId) {
    throw new RoomError('questionId wajib diisi.', 400);
  }

  const result = await submitAnswer({
    roomCode: code,
    playerToken: body.playerToken,
    questionId: body.questionId,
    selectedAnswer: body.selectedAnswer ?? null,
  });

  // Layar host butuh tahu berapa banyak yang sudah menjawab. Angkanya
  // dihitung dari tabel jawaban, bukan dari penghitung terpisah yang
  // bisa melenceng dari isinya.
  try {
    const stats = await getQuestionStats(result.sessionId, body.questionId);
    await pusherServer.trigger(`room-${code}`, 'answer_submitted', {
      questionId: body.questionId,
      answered: stats.total,
      correct: stats.correct,
    });
  } catch (err) {
    console.error('[Pusher] gagal menyiarkan answer_submitted:', err);
  }

  return NextResponse.json({
    correct: result.correct,
    sessionScore: result.sessionScore,
    totalScore: result.totalScore,
    speedBonus: result.speedBonus,
    streak: result.streak,
    gameMode: result.gameMode,
  });
});
