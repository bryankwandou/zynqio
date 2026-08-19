import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/api-guard';
import { createUser, validatePassword } from '@/lib/user';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { RoomError } from '@/lib/room';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/auth/signup
 *
 * Batas kata sandi dinaikkan dari enam menjadi delapan karakter, sejalan
 * dengan anjuran NIST SP 800-63B. Enam karakter bisa ditebak habis dengan
 * peralatan biasa dalam hitungan menit.
 *
 * Tanggapannya juga tidak lagi membedakan email yang sudah terdaftar dari
 * yang belum. Perbedaan itu membuat halaman pendaftaran berfungsi sebagai
 * alat memeriksa keanggotaan: siapa pun bisa menguji daftar email dan
 * mengetahui mana yang punya akun di sini.
 */
export const POST = handle(async (req) => {
  const ip = getIP(req);
  if (!(await rateLimit(ip, 'signup', 5, 600))) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan pendaftaran. Coba lagi nanti.' },
      { status: 429 }
    );
  }

  const body = await readJson<{ email?: string; username?: string; password?: string }>(req);

  const email = String(body.email ?? '').trim().toLowerCase();
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new RoomError('Alamat email tidak sah.', 400);
  }

  if (username.length < 2 || username.length > 60) {
    throw new RoomError('Nama tampilan harus 2 sampai 60 karakter.', 400);
  }

  const problem = validatePassword(password);
  if (problem) throw new RoomError(problem, 400);

  try {
    await createUser(email, username, password);
  } catch (err) {
    if (err instanceof Error && err.message === 'User already exists') {
      // Sengaja dibalas seperti pendaftaran yang berhasil.
      return NextResponse.json({ success: true });
    }
    throw err;
  }

  return NextResponse.json({ success: true });
});
