import { NextResponse } from 'next/server';
import { handle } from '@/lib/api-guard';
import { assertPlayer, getRoom, normalizeRoomCode, RoomError } from '@/lib/room';
import { sql, type FullQuestionRow } from '@/lib/db';
import { bacaKunci, teksOpsi } from '@/lib/kunci';

export const dynamic = 'force-dynamic';

/**
 * GET /api/room/question?roomCode=...&token=...&index=...
 *
 * Satu soal untuk peserta, tanpa kunci jawaban.
 *
 * Layar permainan murid sebelumnya memanggil /api/quiz/get-question,
 * yang memang mengembalikan kunci jawaban dan karena itu ditutup rapat
 * untuk host saja. Setelah pintunya ditutup, halaman muridnya tidak
 * ikut dipindahkan: setiap permintaan soal dijawab 401, hitung mundur
 * selesai, lalu layarnya kembali ke "Menunggu pengajar memulai" dan
 * berhenti di situ. Permainannya berjalan di layar guru sementara
 * seluruh kelas menatap layar tunggu.
 *
 * Route ini menutup jarak itu tanpa membuka kembali kunci jawabannya:
 *   - pemanggilnya dikenali lewat token peserta, sama seperti saat
 *     mengirim jawaban, jadi orang luar tidak bisa membaca soal;
 *   - kolom correct_answer dan explanation tidak pernah ikut terkirim;
 *   - selama ruangan belum berjalan, tidak ada soal yang keluar sama
 *     sekali.
 *
 * Ragam "Klasik" membuat tiap murid maju dengan kecepatannya sendiri,
 * jadi nomor soalnya diminta lewat parameter, bukan diambil dari nomor
 * soal ruangan. Batas atasnya tetap jumlah soal kuis itu — bukan angka
 * bebas yang dikirim peramban.
 */
export const GET = handle(async (req) => {
  const { searchParams } = new URL(req.url);

  const code = normalizeRoomCode(searchParams.get('roomCode'));
  const room = await getRoom(code);
  if (!room) throw new RoomError('Ruangan tidak ditemukan.', 404);

  // Token peserta wajib. Tanpa ini, siapa pun yang tahu kode ruangan
  // bisa membaca soal sebelum kelasnya dimulai.
  await assertPlayer(code, searchParams.get('token'));

  if (room.status !== 'playing') {
    throw new RoomError('Permainan belum berjalan.', 409);
  }

  const mentah = searchParams.get('index');
  const index = mentah === null ? room.current_question_index : Number(mentah);
  if (!Number.isInteger(index) || index < 0) {
    throw new RoomError('Nomor soal tidak sah.', 400);
  }

  const dihitung = (await sql`
    SELECT count(*)::int AS n FROM questions WHERE quiz_id = ${room.quiz_id}
  `) as { n: number }[];
  const total = dihitung[0]?.n ?? 0;

  const rows = (await sql`
    SELECT id, quiz_id, position, type, text, options, correct_answer, image_url, points, time_limit
    FROM questions
    WHERE quiz_id = ${room.quiz_id} AND position = ${index}
    LIMIT 1
  `) as FullQuestionRow[];

  // Soal ke-27 dari kuis 26 soal berarti murid ini sudah selesai,
  // bukan kesalahan. Halaman muridnya membaca 404 sebagai tanda habis.
  if (!rows[0]) throw new RoomError('Soal tidak ditemukan.', 404);

  const q = rows[0];

  // Kunci dibaca hanya untuk mengetahui bentuk soalnya; isinya tidak
  // ikut terkirim. Layar peserta membutuhkan bentuk itu untuk memilih
  // antara tombol pilihan, kotak isian, centang ganda, atau susunan urutan.
  const k = bacaKunci(q.type, q.options, q.correct_answer);
  const answerKind =
    q.type === 'POLL' ? 'polling'
    : k.jenis === 'isian' ? 'isian'
    : k.jenis === 'urutan' ? 'urutan'
    : k.jenis === 'pilihan' && k.indeks.length > 1 ? 'ganda'
    : 'tunggal';

  // Pada soal urutan, urutan simpanan pilihannya adalah jawabannya, jadi
  // pilihan dikirim teracak bersama nomor aslinya.
  let options: unknown = answerKind === 'isian' ? [] : q.options;
  let optionIds: number[] | undefined;
  if (answerKind === 'urutan') {
    const teks = teksOpsi(q.options);
    const acak = teks.map((t, i) => ({ t, i }));
    for (let n = acak.length - 1; n > 0; n--) {
      const j = Math.floor(Math.random() * (n + 1));
      [acak[n], acak[j]] = [acak[j], acak[n]];
    }
    if (acak.every((x, n) => x.i === n) && acak.length > 1) acak.push(acak.shift()!);
    options = acak.map((x) => x.t);
    optionIds = acak.map((x) => x.i);
  }

  return NextResponse.json(
    {
      id: q.id,
      index: q.position,
      type: q.type,
      text: q.text,
      options,
      optionIds,
      answerKind,
      imageUrl: q.image_url,
      points: q.points,
      timeLimit: q.time_limit,
      totalQuestions: total,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});
