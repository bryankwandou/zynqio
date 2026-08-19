import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/api-guard';
import { getUserByEmail, issuePasswordResetToken } from '@/lib/user';
import { rateLimit, getIP } from '@/lib/rate-limit';

/**
 * POST /api/auth/forgot-password
 *
 * Token pemulihan sekarang tersimpan di tabel tersendiri dengan hash dan
 * masa berlaku, bukan di Redis yang bisa jatuh ke memori per-instance.
 * Pada susunan lama, token yang diterbitkan oleh satu instance tidak
 * dikenali instance lain, sehingga tautan pemulihan sering gagal tanpa
 * sebab yang terlihat.
 *
 * Tanggapannya selalu sama, terlepas dari emailnya terdaftar atau tidak.
 */
export const POST = handle(async (req) => {
  const ip = getIP(req);
  if (!(await rateLimit(ip, 'forgot', 5, 900))) {
    return NextResponse.json({ success: true });
  }

  const body = await readJson<{ email?: string }>(req);
  const email = String(body.email ?? '').trim().toLowerCase();

  if (email) {
    const user = await getUserByEmail(email);
    if (user) {
      const token = await issuePasswordResetToken(user.id);
      const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      const link = `${base}/auth/reset-password?token=${token}`;

      // Pengiriman surel belum terpasang. Selama itu belum ada, tautannya
      // hanya muncul di catatan server — tempat yang bisa dilihat operator
      // dan bukan pengunjung.
      console.log(`[pemulihan sandi] ${user.email} → ${link}`);
    }
  }

  return NextResponse.json({ success: true });
});
