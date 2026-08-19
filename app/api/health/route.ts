import { NextResponse } from 'next/server';
import { checkDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * Menggantikan /api/debug, yang terbuka untuk umum dan merinci peubah
 * lingkungan mana yang sudah terpasang dan mana yang belum. Rincian itu
 * tidak berguna bagi pengunjung biasa, tetapi sangat berguna bagi orang
 * yang sedang mencari celah: ia langsung tahu penyimpanan mana yang
 * dipakai, layanan mana yang sedang berjalan dengan cadangan, dan bagian
 * mana yang paling mungkin belum tergarap.
 *
 * Yang tersisa di sini hanya satu hal yang memang perlu diketahui dari
 * luar: aplikasinya hidup dan basis datanya terjawab. Tidak ada nama
 * peubah, tidak ada nama layanan, tidak ada versi.
 */
export async function GET() {
  const started = Date.now();
  const db = await checkDatabase();

  const healthy = db.ok && db.tables > 0;

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
