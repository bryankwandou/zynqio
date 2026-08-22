import { NextResponse, type NextRequest } from 'next/server';

/**
 * middleware.ts — pengalihan awal untuk halaman yang menuntut akun.
 *
 * Sebelumnya berkas ini memakai withAuth dari next-auth/middleware.
 * Bundel edge-nya rusak di Next.js 16: setiap permintaan ke rute yang
 * cocok berakhir dengan "ReferenceError: _server is not defined", dan
 * peladen menjawab 500. Artinya /dashboard, /create, dan /host — tiga
 * halaman yang paling dibutuhkan pengajar — tidak pernah bisa dibuka
 * sama sekali, bukan gagal masuk, melainkan galat peladen.
 *
 * Penggantinya sengaja sederhana: memeriksa apakah kuki sesi ada, lalu
 * mengalihkan ke halaman masuk bila tidak ada.
 *
 * Pemeriksaan ini TIDAK memvalidasi isi kukinya, dan memang tidak
 * dimaksudkan begitu. Ia hanya menghemat satu perjalanan bagi orang
 * yang jelas belum masuk. Penjagaan yang sebenarnya ada di dua tempat
 * yang tidak bisa dilewati: setiap route API memanggil requireUser(),
 * dan setiap halaman memeriksa sesinya sendiri lewat useSession. Kuki
 * karangan akan lolos dari middleware ini lalu ditolak di sana —
 * dengan data yang kosong dan tanpa satu pun tindakan yang berhasil.
 */

/**
 * Nama kuki sesi berbeda menurut protokol. Di HTTPS, next-auth memberi
 * awalan __Secure- yang membuat peramban menolak menuliskannya lewat
 * sambungan tak terenkripsi. Keduanya perlu diperiksa supaya
 * pengembangan di localhost dan produksi sama-sama bekerja.
 */
const NAMA_KUKI_SESI = [
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
];

export function middleware(req: NextRequest) {
  const punyaSesi = NAMA_KUKI_SESI.some((nama) => req.cookies.has(nama));

  if (punyaSesi) return NextResponse.next();

  // Alamat yang dituju dibawa serta, supaya setelah masuk orang
  // kembali ke tempat yang tadi ia coba buka — bukan dilempar ke
  // beranda dan harus menelusuri ulang.
  const tujuan = new URL('/auth/signin', req.url);
  tujuan.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);

  return NextResponse.redirect(tujuan);
}

export const config = {
  matcher: ['/dashboard/:path*', '/create/:path*', '/host/:path*'],
};
