import crypto from 'crypto';
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
  const body = await readJson<{
    roomCode?: string;
    playerToken?: string;
    questionId?: string;
    selectedAnswer?: unknown;
  }>(req);

  /*
    Jatah menjawab mengikuti peserta, bukan alamat IP.

    Sebelumnya tiga puluh jawaban per menit dihitung per alamat. Satu
    kelas berbagi satu alamat publik keluar, jadi jatah itu terbagi
    rata-rata satu jawaban per murid — kuis dua puluh soal berhenti di
    soal pertama, dan yang tampil di layar murid hanyalah "Terlalu
    banyak permintaan" tanpa sebab yang terlihat.

    Yang dipakai sebagai kunci adalah sidik ringkas token peserta, bukan
    tokennya sendiri, supaya penanda yang sesungguhnya tidak ikut
    tersimpan di tabel pembatas. Permintaan tanpa token jatuh kembali ke
    alamat IP: di sanalah banjir yang tidak membawa identitas apa pun
    perlu ditahan.
  */
  const penanda =
    typeof body.playerToken === 'string' && body.playerToken
      ? 'p:' + crypto.createHash('sha256').update(body.playerToken).digest('hex').slice(0, 32)
      : 'ip:' + getIP(req);

  if (!(await rateLimit(penanda, 'answer', 60, 60))) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan. Tunggu sebentar.' }, { status: 429 });
  }

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
