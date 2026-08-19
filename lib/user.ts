/**
 * lib/user.ts — akun pengguna di atas Postgres.
 *
 * Tanda tangan fungsinya sengaja dipertahankan sama seperti versi Redis
 * supaya route yang memanggilnya tidak perlu ikut berubah.
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sql, isUniqueViolation, type Role, type UserRow } from './db';

export interface User {
  id: string;
  email: string;
  username: string;
  role: Role;
  passwordHash?: string;
}

/**
 * Biaya hashing. 10 adalah warisan dari data lama; 12 adalah anjuran OWASP
 * yang berlaku sekarang. Kata sandi lama tetap bisa diperiksa karena biaya
 * ikut tersimpan di dalam hash bcrypt, dan akan naik sendiri saat pemiliknya
 * berhasil masuk (lihat verifyUser).
 */
const BCRYPT_COST = 12;
const LEGACY_COST_PATTERN = /^\$2[aby]\$0?([0-9]|1[01])\$/;

/** Panjang minimum kata sandi. Sejalan dengan NIST SP 800-63B. */
export const MIN_PASSWORD_LENGTH = 8;

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role,
    passwordHash: row.password_hash ?? undefined,
  };
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string') return 'Kata sandi tidak sah.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }
  if (password.length > 200) {
    return 'Kata sandi terlalu panjang.';
  }
  return null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = (await sql`
    SELECT id, email, username, password_hash, role, created_at, updated_at
    FROM users
    WHERE email = ${email.trim()}
    LIMIT 1
  `) as UserRow[];
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getUserById(id: string): Promise<User | null> {
  // id datang dari token sesi; bila bentuknya bukan uuid, Postgres akan
  // menolak pembandingannya. Disaring lebih dulu supaya tidak jadi galat.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  const rows = (await sql`
    SELECT id, email, username, password_hash, role, created_at, updated_at
    FROM users
    WHERE id = ${id}::uuid
    LIMIT 1
  `) as UserRow[];
  return rows[0] ? toUser(rows[0]) : null;
}

export async function createUser(
  email: string,
  username: string,
  passwordPlain: string
): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim().slice(0, 60) || normalizedEmail.split('@')[0];
  const passwordHash = await bcrypt.hash(passwordPlain, BCRYPT_COST);

  try {
    const rows = (await sql`
      INSERT INTO users (email, username, password_hash)
      VALUES (${normalizedEmail}, ${cleanUsername}, ${passwordHash})
      RETURNING id, email, username, password_hash, role, created_at, updated_at
    `) as UserRow[];
    return toUser(rows[0]);
  } catch (err) {
    // Keunikan email ditegakkan indeks, bukan pemeriksaan sebelum menulis.
    // Dua pendaftaran bersamaan dengan email sama tidak bisa lolos berdua.
    if (isUniqueViolation(err)) {
      throw new Error('User already exists');
    }
    throw err;
  }
}

/**
 * Membuat akun untuk pengguna yang masuk lewat penyedia luar (Google).
 * Akun seperti ini tidak punya kata sandi lokal, jadi password_hash
 * dibiarkan kosong alih-alih diisi nilai acak yang tidak pernah dipakai.
 */
export async function createOAuthUser(email: string, username: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim().slice(0, 60) || normalizedEmail.split('@')[0];

  const rows = (await sql`
    INSERT INTO users (email, username, password_hash)
    VALUES (${normalizedEmail}, ${cleanUsername}, NULL)
    ON CONFLICT (email) DO UPDATE SET username = users.username
    RETURNING id, email, username, password_hash, role, created_at, updated_at
  `) as UserRow[];
  return toUser(rows[0]);
}

export async function verifyUser(email: string, passwordPlain: string): Promise<User | null> {
  const user = await getUserByEmail(email);

  if (!user?.passwordHash) {
    // Tetap jalankan satu perbandingan tiruan supaya lama tanggapan untuk
    // email yang tidak terdaftar mirip dengan yang terdaftar. Tanpa ini,
    // selisih waktunya bisa dipakai memetakan email mana yang ada.
    await bcrypt.compare(passwordPlain, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    return null;
  }

  const isValid = await bcrypt.compare(passwordPlain, user.passwordHash);
  if (!isValid) return null;

  // Naikkan biaya hashing milik akun lama secara diam-diam saat pemiliknya
  // berhasil masuk. Tidak ada yang perlu mengganti kata sandinya.
  if (LEGACY_COST_PATTERN.test(user.passwordHash)) {
    try {
      const upgraded = await bcrypt.hash(passwordPlain, BCRYPT_COST);
      await sql`UPDATE users SET password_hash = ${upgraded} WHERE id = ${user.id}::uuid`;
    } catch {
      // Gagal memperbarui bukan alasan menolak login yang sah.
    }
  }

  return user;
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const problem = validatePassword(newPassword);
  if (problem) throw new Error(problem);

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  const rows = (await sql`
    UPDATE users SET password_hash = ${passwordHash}
    WHERE id = ${userId}::uuid
    RETURNING id
  `) as { id: string }[];

  if (rows.length === 0) throw new Error('User not found');
}

// ------------------------------------------------------------------
// Pemulihan kata sandi
// ------------------------------------------------------------------

const RESET_TOKEN_TTL_MINUTES = 60;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Menerbitkan token pemulihan dan mengembalikan bentuk mentahnya sekali saja.
 * Yang masuk ke database hanya hash-nya.
 */
export async function issuePasswordResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');

  // Token lama milik akun yang sama dibatalkan, supaya permintaan pemulihan
  // berulang tidak meninggalkan beberapa token hidup sekaligus.
  await sql`
    UPDATE password_reset_tokens SET used_at = now()
    WHERE user_id = ${userId}::uuid AND used_at IS NULL
  `;

  await sql`
    INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
    VALUES (
      ${hashToken(token)},
      ${userId}::uuid,
      now() + (${RESET_TOKEN_TTL_MINUTES} || ' minutes')::interval
    )
  `;

  return token;
}

/**
 * Menukar token dengan kata sandi baru.
 *
 * Penandaan terpakai dan penggantian kata sandi berjalan sebagai satu
 * pernyataan bersyarat: token yang sudah dipakai atau kedaluwarsa tidak
 * akan cocok, jadi dua permintaan bersamaan dengan token yang sama hanya
 * bisa berhasil satu.
 */
export async function consumePasswordResetToken(
  token: string,
  newPassword: string
): Promise<boolean> {
  const problem = validatePassword(newPassword);
  if (problem) throw new Error(problem);

  const claimed = (await sql`
    UPDATE password_reset_tokens
    SET used_at = now()
    WHERE token_hash = ${hashToken(token)}
      AND used_at IS NULL
      AND expires_at > now()
    RETURNING user_id
  `) as { user_id: string }[];

  if (claimed.length === 0) return false;

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await sql`
    UPDATE users SET password_hash = ${passwordHash}
    WHERE id = ${claimed[0].user_id}::uuid
  `;

  return true;
}
