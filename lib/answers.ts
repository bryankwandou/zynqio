import { nilaiJawaban } from './kunci';

/**
 * Bobot soal sebagai pengali. Penyunting menyimpan 100 untuk soal biasa,
 * sedangkan templat Excel menulis 1, 2, atau 3. Membagi keduanya dengan 100
 * membuat soal dari templat bernilai seperseratus — jawaban benar hanya
 * memberi 8 poin. Angka kecil karena itu dibaca langsung sebagai pengali.
 */
export function bobotSoal(points: unknown): number {
  const p = Number(points);
  if (!Number.isFinite(p) || p <= 0) return 1;
  return p < 50 ? p : p / 100;
}
/**
 * lib/answers.ts — penerimaan dan penilaian jawaban.
 *
 * Tiga hal yang diperbaiki dibanding alur lama:
 *
 * 1. Peserta dibuktikan lewat token, bukan lewat playerId yang dikirim
 *    dalam badan permintaan. Sebelumnya siapa pun bisa mengirim jawaban
 *    atas nama peserta lain hanya dengan menuliskan namanya.
 *
 * 2. Penambahan skor dilakukan dengan UPDATE ... SET score = score + n,
 *    bukan membaca seluruh keadaan ruangan lalu menulisnya kembali.
 *    Cara lama kehilangan pembaruan saat banyak jawaban tiba berbarengan:
 *    tiga puluh peserta menjawab bersamaan, sebagian besar tulisan saling
 *    menimpa, dan skornya melenceng.
 *
 * 3. Waktu jawab dihitung dari question_started_at milik server, bukan
 *    dari angka yang dikirim peserta. Bonus kecepatan jadi tidak bisa
 *    dikarang sendiri.
 */

import { sql, isUniqueViolation } from './db';
import { assertPlayer, getRoom, RoomError, logEvent } from './room';
import { getGradingKey } from './quiz';
import { calculateScore, type GameMode } from './scoring';

export interface SubmitResult {
  correct: boolean | null;
  sessionScore: number;
  totalScore: number;
  speedBonus: number;
  streak: number;
  gameMode: string;
  sessionId: string;
}


export async function submitAnswer(params: {
  roomCode: string;
  playerToken: unknown;
  questionId: string;
  selectedAnswer: unknown;
}): Promise<SubmitResult> {
  const player = await assertPlayer(params.roomCode, params.playerToken);

  const room = await getRoom(params.roomCode);
  if (!room) throw new RoomError('Ruangan tidak ditemukan.', 404);
  if (room.status !== 'playing') throw new RoomError('Ruangan sedang tidak bermain.', 409);

  const key = await getGradingKey(room.quiz_id);
  const question = key.get(params.questionId);
  if (!question) throw new RoomError('Soal tidak ditemukan pada kuis ini.', 404);

  const correct = nilaiJawaban(question.type, question.options, question.correctAnswer, params.selectedAnswer);

  // Jam server yang dipakai, bukan angka kiriman peserta.
  const startedAt = room.question_started_at ? new Date(room.question_started_at).getTime() : Date.now();
  const totalTime = Number(room.settings?.timer ?? 30);
  const elapsedSeconds = (Date.now() - startedAt) / 1000;
  const timeLeft = Math.max(0, totalTime - elapsedSeconds);

  const scoring = calculateScore({
    isCorrect: correct,
    gameMode: (room.game_mode ?? 'classic') as GameMode,
    timeLeft,
    totalTime,
    // Kolom points menyimpan bobot soal dengan 100 sebagai bobot normal,
    // dan calculateScore mengharapkan pengali — 1 untuk soal biasa, 2
    // untuk soal berbobot ganda.
    //
    // Sebelumnya nilai itu diteruskan mentah-mentah, sehingga soal biasa
    // dihitung sebagai 600 × 100. Satu soal menghasilkan hampir seratus
    // ribu poin, dan papan peringkat penuh angka yang tidak berarti apa-apa
    // bagi siapa pun yang melihatnya.
    pointsWeight: bobotSoal(question.points),
    streak: player.streak,
  });

  // Sisipan ini yang menegakkan aturan satu kali jawab. Kalau baris untuk
  // (sesi, peserta, soal) sudah ada, indeks unik menolaknya — dan
  // penolakan itulah yang kita jadikan jawaban, bukan hasil pemeriksaan
  // sebelumnya yang selalu punya celah waktu.
  try {
    await sql`
      INSERT INTO answers
        (session_id, room_code, player_id, question_id, choice, is_correct, points, response_ms)
      VALUES (
        ${room.session_id}, ${params.roomCode}, ${player.id}, ${params.questionId}::uuid,
        ${JSON.stringify(params.selectedAnswer ?? null)}::jsonb,
        ${correct}, ${scoring.totalScore},
        ${Math.max(0, Math.round((totalTime - timeLeft) * 1000))}
      )
    `;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new RoomError('Soal ini sudah Anda jawab.', 409);
    }
    throw err;
  }

  // Satu pernyataan, dihitung relatif terhadap nilai yang tersimpan.
  // Tidak ada jendela antara membaca dan menulis untuk diperebutkan.
  const survival = room.game_mode === 'survival';
  const updated = (await sql`
    UPDATE room_players SET
      total_answered = total_answered + 1,
      total_correct  = total_correct + ${correct ? 1 : 0},
      streak         = ${correct ? sql`streak + 1` : sql`0`},
      score          = ${
        survival && !correct ? sql`0` : sql`score + ${scoring.totalScore}`
      }
    WHERE id = ${player.id}
    RETURNING score, streak
  `) as { score: number; streak: number }[];

  await logEvent(params.roomCode, room.session_id, 'answer', {
    playerId: player.id,
    questionId: params.questionId,
    isCorrect: correct,
  });

  return {
    // Bila host memilih menyembunyikan koreksi, nilainya null — bukan
    // dikirim lalu disembunyikan di sisi peramban.
    correct: room.settings?.showAnswerAfterQuestion === false ? null : correct,
    sessionScore: scoring.totalScore,
    totalScore: updated[0]?.score ?? scoring.totalScore,
    speedBonus: scoring.speedBonus,
    streak: updated[0]?.streak ?? 0,
    gameMode: room.game_mode,
    sessionId: room.session_id,
  };
}

/**
 * Ringkasan sebaran jawaban satu soal, untuk layar host.
 * Dihitung dari tabel jawaban, jadi angkanya selalu cocok dengan isinya.
 */
export async function getQuestionStats(sessionId: string, questionId: string) {
  const rows = (await sql`
    SELECT choice, count(*)::int AS n, bool_or(is_correct) AS is_correct
    FROM answers
    WHERE session_id = ${sessionId} AND question_id = ${questionId}::uuid
    GROUP BY choice
  `) as { choice: unknown; n: number; is_correct: boolean }[];

  const total = rows.reduce((sum, r) => sum + r.n, 0);
  const correct = rows.filter((r) => r.is_correct).reduce((sum, r) => sum + r.n, 0);

  return { total, correct, distribution: rows };
}

/**
 * Riwayat jawaban tiap peserta dalam satu sesi, untuk kisi per-soal di
 * layar guru.
 *
 * Sebelumnya kisi itu hanya terisi dari kabar langsung yang tiba selagi
 * tab guru terbuka. Riwayatnya tidak pernah tersimpan di mana pun selain
 * memori peramban, jadi memuat ulang halaman — atau membukanya di
 * perangkat lain — menghapus seluruhnya, sementara angka di sebelahnya
 * tetap dibaca dari peladen. Satu baris bisa berkata "10/45" sambil
 * menggambar empat puluh lima kotak yang semuanya berarti "belum
 * dijawab".
 *
 * Yang keluar dari sini memuat is_correct, jadi ia hanya boleh diberikan
 * kepada guru. Route yang memanggilnya wajib memeriksa itu lebih dulu;
 * mengirimkannya ke peserta sama saja membocorkan kunci jawaban.
 */
export async function getAnswerHistory(sessionId: string) {
  return (await sql`
    SELECT player_id, question_id, is_correct, choice, points
    FROM answers
    WHERE session_id = ${sessionId}
    ORDER BY answered_at ASC
  `) as {
    player_id: string;
    question_id: string;
    is_correct: boolean;
    choice: unknown;
    points: number;
  }[];
}

/** Papan peringkat langsung dari tabel peserta. */
export async function getLeaderboard(roomCode: string, limit = 100) {
  return (await sql`
    SELECT id, name, avatar_id, score, total_answered, total_correct, streak
    FROM room_players
    WHERE room_code = ${roomCode} AND is_kicked = false
    ORDER BY score DESC, joined_at ASC
    LIMIT ${Math.min(Math.max(limit, 1), 500)}
  `) as {
    id: string;
    name: string;
    avatar_id: string;
    score: number;
    total_answered: number;
    total_correct: number;
    streak: number;
  }[];
}
