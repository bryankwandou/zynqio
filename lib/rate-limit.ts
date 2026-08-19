/**
 * lib/rate-limit.ts — pembatasan laju permintaan di atas Postgres.
 *
 * Versi sebelumnya bersandar pada Redis, dan ketika Redis tidak tersedia
 * ia diam-diam memakai penghitung dalam memori. Di serverless itu berarti
 * pembatasnya praktis mati: tiap instance punya penghitung sendiri, jadi
 * penyerang cukup mengirim permintaan cukup cepat sampai penyedia
 * menyalakan instance baru, dan jatahnya kembali penuh.
 *
 * Penghitung sekarang satu baris di basis data, dinaikkan lewat satu
 * pernyataan atomik. Semua instance berbagi penghitung yang sama.
 */

import { sql } from './db';

/** Mengambil alamat IP pemanggil dari header proksi. */
export function getIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // Header ini bisa memuat rantai alamat. Yang pertama adalah klien;
    // sisanya ditambahkan oleh proksi di jalur.
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'tidak-diketahui';
}

/**
 * Menaikkan penghitung untuk satu kunci dan memberi tahu apakah
 * permintaannya masih dalam jatah.
 *
 * Jendelanya bergulir per potongan waktu: saat window_start sudah lebih
 * tua dari panjang jendela, penghitungnya disetel ulang pada pernyataan
 * yang sama. Tidak ada pekerjaan pembersihan terpisah yang perlu berjalan.
 *
 * Bila basis data sedang tidak terjawab, permintaannya diloloskan.
 * Menolak semua orang karena pembatas lajunya bermasalah akan mengubah
 * gangguan kecil menjadi padam total.
 */
export async function rateLimit(
  identifier: string,
  action: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const bucket = `${action}:${identifier}`;

  try {
    const rows = (await sql`
      INSERT INTO rate_limits (bucket, hits, window_start)
      VALUES (${bucket}, 1, now())
      ON CONFLICT (bucket) DO UPDATE SET
        hits = CASE
                 WHEN rate_limits.window_start < now() - (${windowSeconds} || ' seconds')::interval
                 THEN 1
                 ELSE rate_limits.hits + 1
               END,
        window_start = CASE
                         WHEN rate_limits.window_start < now() - (${windowSeconds} || ' seconds')::interval
                         THEN now()
                         ELSE rate_limits.window_start
                       END
      RETURNING hits
    `) as { hits: number }[];

    return (rows[0]?.hits ?? 1) <= limit;
  } catch (err) {
    console.error('[rate-limit] penghitung tidak terjawab, permintaan diloloskan:', err);
    return true;
  }
}

/**
 * Membuang baris pembatas yang jendelanya sudah lama lewat.
 * Dipanggil sesekali oleh tugas pemeliharaan, bukan di jalur permintaan.
 */
export async function purgeRateLimits(olderThanHours = 24): Promise<number> {
  const rows = (await sql`
    DELETE FROM rate_limits
    WHERE window_start < now() - (${olderThanHours} || ' hours')::interval
    RETURNING bucket
  `) as { bucket: string }[];
  return rows.length;
}
