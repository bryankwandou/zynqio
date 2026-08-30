import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * Angka yang ditampilkan di beranda.
 *
 * Sebelumnya ketiganya ditulis mati di app/page.tsx: 520 soal, 20 kuis,
 * 6 ragam. Dua di antaranya sudah keliru — basis data berisi 558 soal
 * dan 26 kuis — dan akan makin keliru setiap kali seseorang menambah
 * kuis. Angka yang dipajang di halaman muka sebagai bukti isi produk
 * tidak boleh berupa tebakan yang membusuk.
 *
 * Hanya kuis publik yang dihitung, karena itulah yang benar-benar bisa
 * dibuka pengunjung. Menghitung kuis pribadi orang lain akan membuat
 * angkanya menjanjikan sesuatu yang tidak bisa diakses.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [baris] = await sql`
      SELECT
        (SELECT count(*) FROM quizzes  WHERE visibility = 'public')::int AS kuis,
        (SELECT count(*) FROM questions q
           JOIN quizzes z ON z.id = q.quiz_id
          WHERE z.visibility = 'public')::int AS soal,
        (SELECT count(DISTINCT category) FROM quizzes
          WHERE visibility = 'public' AND category IS NOT NULL)::int AS mapel
    `;

    return NextResponse.json(
      { soal: baris?.soal ?? 0, kuis: baris?.kuis ?? 0, mapel: baris?.mapel ?? 0, ragam: 6 },
      // Angka ini berubah pelan. Satu menit di tepi jaringan sudah
      // cukup untuk menahan lonjakan tanpa membuat angkanya basi.
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } }
    );
  } catch {
    // Beranda harus tetap tampil walau basis data sedang tak terjangkau,
    // tetapi ia tidak boleh menampilkan nol. Nol bukan "belum tahu",
    // nol adalah pernyataan bahwa bank soalnya kosong — dan pengunjung
    // yang membacanya akan pergi. Dengan 503 tanpa isi, beranda tetap
    // memuat dan panel angkanya menahan diri pada tanda pisah.
    return new NextResponse(null, { status: 503 });
  }
}
