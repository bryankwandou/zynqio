import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/api-guard';
import { consumePasswordResetToken, validatePassword } from '@/lib/user';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { RoomError } from '@/lib/room';

/**
 * POST /api/auth/reset-password
 *
 * Penukaran token dan penggantian kata sandi berlangsung sebagai satu
 * pernyataan bersyarat di basis data, jadi token yang sama tidak bisa
 * dipakai dua kali walau dikirim bersamaan.
 */
export const POST = handle(async (req) => {
  const ip = getIP(req);
  if (!(await rateLimit(ip, 'reset', 10, 900))) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan.' }, { status: 429 });
  }

  const body = await readJson<{ token?: string; password?: string }>(req);
  const token = String(body.token ?? '');
  const password = String(body.password ?? '');

  if (!token) throw new RoomError('Token pemulihan tidak sah.', 400);

  const problem = validatePassword(password);
  if (problem) throw new RoomError(problem, 400);

  const changed = await consumePasswordResetToken(token, password);
  if (!changed) {
    throw new RoomError('Token pemulihan tidak berlaku atau sudah kedaluwarsa.', 400);
  }

  return NextResponse.json({ success: true });
});
