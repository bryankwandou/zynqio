#!/usr/bin/env node
/**
 * scripts/verify-login.mjs — pembuktian masuk lewat email dan kata sandi.
 *
 * Dijalankan sepenuhnya lewat HTTP, persis seperti peramban: mengambil
 * token CSRF, mengirim kredensial, memungut kuki sesi dari tanggapan,
 * lalu memakai kuki itu untuk membuka halaman yang dijaga.
 *
 *   node scripts/verify-login.mjs https://zynqio.vercel.app
 */

import pg from 'pg';

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

const hasil = [];
function catat(nama, lulus, rinci) {
  hasil.push({ nama, lulus });
  console.log(`  ${lulus ? 'LULUS' : 'GAGAL'}  ${nama}${rinci ? ` — ${rinci}` : ''}`);
}

/** Mengumpulkan kuki dari sebuah tanggapan ke dalam satu kantong. */
function pungutKuki(res, kantong) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const baris of raw) {
    const [pasangan] = baris.split(';');
    const pisah = pasangan.indexOf('=');
    if (pisah > 0) kantong[pasangan.slice(0, pisah).trim()] = pasangan.slice(pisah + 1).trim();
  }
  return kantong;
}

const rangkaiKuki = (kantong) =>
  Object.entries(kantong).map(([k, v]) => `${k}=${v}`).join('; ');

const TAG = Date.now().toString(36);
const EMAIL = `masuk_${TAG}@example.test`;
const SANDI = 'KataSandiUji123';

async function main() {
  console.log(`\nPembuktian masuk lewat email terhadap ${BASE}\n`);

  const pool = connectionString
    ? new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30_000 })
    : null;

  try {
    // ---- 1. hanya penyedia yang benar-benar dikonfigurasi ------------
    {
      const res = await fetch(`${BASE}/api/auth/providers`);
      const d = await res.json();
      const nama = Object.keys(d ?? {});
      catat(
        'Penyedia yang diumumkan hanya yang benar-benar dikonfigurasi',
        nama.includes('credentials'),
        nama.join(', ') || '(kosong)'
      );
    }

    // ---- 2. mendaftar lewat HTTP -------------------------------------
    {
      const res = await fetch(`${BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, username: 'Pengajar Uji', password: SANDI }),
      });
      catat('Akun baru dapat didaftarkan', res.status === 200, `status ${res.status}`);
    }

    // ---- 3. masuk dengan kata sandi yang benar -----------------------
    const kuki = {};
    {
      const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
      pungutKuki(csrfRes, kuki);
      const { csrfToken } = await csrfRes.json();

      const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: rangkaiKuki(kuki),
        },
        body: new URLSearchParams({ email: EMAIL, password: SANDI, csrfToken, json: 'true' }),
        redirect: 'manual',
      });
      pungutKuki(res, kuki);

      const punyaSesi = Object.keys(kuki).some((k) => k.includes('session-token'));
      catat('Masuk dengan kata sandi benar menerbitkan kuki sesi', punyaSesi, `status ${res.status}`);
    }

    // ---- 4. sesi terbaca dan menyebut orang yang benar ---------------
    {
      const res = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: rangkaiKuki(kuki) } });
      const sesi = await res.json();
      catat(
        'Sesi terbaca dan menyebut akun yang benar',
        sesi?.user?.email === EMAIL,
        sesi?.user?.email ?? '(kosong)'
      );
    }

    // ---- 5. halaman yang dijaga terbuka dengan kuki itu --------------
    {
      const res = await fetch(`${BASE}/dashboard`, {
        headers: { Cookie: rangkaiKuki(kuki) },
        redirect: 'manual',
      });
      catat('Halaman kuis saya terbuka setelah masuk', res.status === 200, `status ${res.status}`);
    }

    // ---- 6. kendali host menerima sesi ini ---------------------------
    {
      const res = await fetch(`${BASE}/api/quiz/list`, { headers: { Cookie: rangkaiKuki(kuki) } });
      catat('API milik host menerima sesi ini', res.status === 200, `status ${res.status}`);
    }

    // ---- 7. kata sandi keliru ditolak --------------------------------
    {
      const kuki2 = {};
      const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
      pungutKuki(csrfRes, kuki2);
      const { csrfToken } = await csrfRes.json();

      const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: rangkaiKuki(kuki2) },
        body: new URLSearchParams({ email: EMAIL, password: 'salah-sekali', csrfToken, json: 'true' }),
        redirect: 'manual',
      });
      pungutKuki(res, kuki2);
      const punyaSesi = Object.keys(kuki2).some((k) => k.includes('session-token'));
      catat('Kata sandi keliru tidak menerbitkan sesi', !punyaSesi, punyaSesi ? 'SESI TERBIT' : 'ditolak');
    }

    // ---- 8. akun tanpa kata sandi tidak bisa dipakai masuk -----------
    //
    // Pemilik bank soal dibuat tanpa password_hash. Kalau jalur masuk
    // memperlakukan hash kosong sebagai cocok, akun itu jadi pintu
    // masuk ke dua puluh kuis publik tanpa perlu tahu apa pun.
    {
      const kuki3 = {};
      const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
      pungutKuki(csrfRes, kuki3);
      const { csrfToken } = await csrfRes.json();

      const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: rangkaiKuki(kuki3) },
        body: new URLSearchParams({
          email: 'bank-soal@zynqio.app',
          password: '',
          csrfToken,
          json: 'true',
        }),
        redirect: 'manual',
      });
      pungutKuki(res, kuki3);
      const punyaSesi = Object.keys(kuki3).some((k) => k.includes('session-token'));
      catat('Akun tanpa kata sandi tidak bisa dipakai masuk', !punyaSesi, punyaSesi ? 'SESI TERBIT' : 'ditolak');
    }
  } finally {
    if (pool) {
      await pool.query(`DELETE FROM users WHERE email = $1`, [EMAIL]).catch(() => {});
      await pool.end();
    }
  }

  const lulus = hasil.filter((r) => r.lulus).length;
  console.log(`\n${lulus}/${hasil.length} pembuktian lulus.\n`);
  if (lulus !== hasil.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nPembuktian terhenti:', err.message);
  process.exitCode = 1;
});
