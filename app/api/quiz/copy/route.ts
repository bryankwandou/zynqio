import { NextResponse } from 'next/server';
import { handle, readJson, requireUser } from '@/lib/api-guard';
import { sql } from '@/lib/db';
import { createQuiz, getQuizMeta } from '@/lib/quiz';
import { RoomError } from '@/lib/room';

/**
 * POST /api/quiz/copy — menyalin kuis publik ke akun sendiri.
 *
 * Tombol "Salin ke kuis saya" di halaman kuis sebelumnya tidak
 * tersambung ke apa pun: ia tergambar, bisa ditekan, dan tidak terjadi
 * apa-apa.
 *
 * Penyalinannya tidak bisa dikerjakan di peramban. /api/quiz/get sengaja
 * menahan kunci jawaban dari siapa pun yang bukan pemilik kuis, jadi
 * salinan yang disusun di sisi peramban akan berisi soal tanpa jawaban —
 * kuis yang tampak utuh tetapi tidak bisa dinilai. Karena itu seluruh
 * penyalinan terjadi di sini, di dalam basis data, dan kunci jawabannya
 * tidak pernah melewati jaringan sekali pun.
 *
 * Yang boleh disalin hanya kuis publik. Kuis pribadi dijawab sama persis
 * dengan kuis yang tidak ada, seperti di endpoint lain, supaya penebak
 * id tidak bisa menyimpulkan apa pun dari perbedaan jawabannya.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ quizId?: string }>(req);

  const quizId = String(body.quizId ?? '').trim();
  if (!quizId) throw new RoomError('Parameter quizId wajib diisi.', 400);

  const asal = await getQuizMeta(quizId);
  if (!asal || asal.visibility === 'private') {
    throw new RoomError('Kuis tidak ditemukan.', 404);
  }

  const judul = `${asal.title} (salinan)`.slice(0, 200);

  // Salinan selalu lahir pribadi. Menyalin kuis orang lain lalu
  // menerbitkannya kembali atas nama sendiri tanpa diminta bukan
  // keputusan yang boleh diambil aplikasi untuk penggunanya.
  const salinanId = await createQuiz(user.id, {
    title: judul,
    description: asal.description ?? null,
    author: user.name ?? null,
    category: asal.category ?? undefined,
    visibility: 'private',
  });

  // Soalnya disalin baris ke baris di dalam basis data. Tidak ada
  // kolom yang dibaca ke dalam proses ini, termasuk correct_answer.
  const disalin = (await sql`
    INSERT INTO questions
      (quiz_id, position, type, text, options, correct_answer, explanation, image_url, points, time_limit)
    SELECT ${salinanId}, position, type, text, options, correct_answer,
           explanation, image_url, points, time_limit
    FROM questions
    WHERE quiz_id = ${quizId}
    ORDER BY position
    RETURNING id
  `) as { id: string }[];

  return NextResponse.json({ quizId: salinanId, soal: disalin.length });
});
