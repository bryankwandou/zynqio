/**
 * lib/db.ts — sambungan Postgres (Neon).
 *
 * Menggantikan lib/redis.ts.
 *
 * Perbedaan sikap yang disengaja terhadap lapisan lama: bila kredensial
 * tidak ada, modul ini melempar galat, bukan diam-diam beralih ke
 * penyimpanan dalam memori. Cadangan memori itu terlihat menolong di
 * layar, tetapi di serverless tiap instance punya salinan sendiri —
 * hasilnya data yang tampak tersimpan padahal hilang, dan penguncian
 * yang tampak bekerja padahal tidak. Lebih baik gagal terang-terangan.
 */

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL belum diisi. Salin dari dasbor Neon, lalu jalankan ' +
      '`vercel env pull .env.local` atau isi berkas .env.local secara manual.'
  );
}

/**
 * Klien SQL bertag. Nilai yang disisipkan lewat interpolasi template
 * selalu dikirim sebagai parameter terpisah, jadi bukan penyambungan
 * string — tidak ada celah injeksi selama pemanggilnya memakai bentuk
 * bertag ini dan bukan merakit string sendiri.
 */
export const sql = neon(connectionString);

// ------------------------------------------------------------------
// Tipe baris
// ------------------------------------------------------------------

export type Role = 'user' | 'admin';
export type Visibility = 'private' | 'unlisted' | 'public';
export type RoomStatus = 'waiting' | 'playing' | 'paused' | 'ended';
export type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'TYPE_ANSWER' | 'POLL';

export interface UserRow {
  id: string;
  email: string;
  username: string;
  password_hash: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface QuizRow {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  author: string | null;
  category: string;
  visibility: Visibility;
  cover_image: string | null;
  plays: number;
  rating_sum: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

/** Soal tanpa kunci jawaban. Bentuk inilah yang boleh menyeberang ke peserta. */
export interface PublicQuestionRow {
  id: string;
  quiz_id: string;
  position: number;
  type: QuestionType;
  text: string;
  options: unknown[];
  image_url: string | null;
  points: number;
  time_limit: number;
}

/** Soal lengkap. Hanya untuk penilaian di server dan untuk pemiliknya. */
export interface FullQuestionRow extends PublicQuestionRow {
  correct_answer: unknown;
  explanation: string | null;
}

export interface RoomRow {
  code: string;
  session_id: string;
  quiz_id: string;
  host_id: string;
  status: RoomStatus;
  game_mode: string;
  settings: Record<string, unknown>;
  current_question_index: number;
  question_started_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface RoomPlayerRow {
  id: string;
  room_code: string;
  user_id: string | null;
  name: string;
  avatar_id: string;
  score: number;
  total_answered: number;
  total_correct: number;
  streak: number;
  is_kicked: boolean;
  joined_at: string;
}

// ------------------------------------------------------------------
// Bantuan kecil
// ------------------------------------------------------------------

/** Kode galat Postgres untuk pelanggaran keunikan. */
export const UNIQUE_VIOLATION = '23505';

/** Kode galat Postgres untuk pelanggaran kunci asing. */
export const FOREIGN_KEY_VIOLATION = '23503';

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION;
}

export function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === FOREIGN_KEY_VIOLATION;
}

/**
 * Memeriksa apakah database dapat dihubungi dan skemanya sudah terpasang.
 * Dipakai oleh endpoint kesehatan.
 */
export async function checkDatabase(): Promise<{ ok: boolean; tables: number; error?: string }> {
  try {
    const rows = (await sql`
      SELECT count(*)::int AS n
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `) as { n: number }[];
    return { ok: true, tables: rows[0]?.n ?? 0 };
  } catch (err) {
    return { ok: false, tables: 0, error: err instanceof Error ? err.message : 'gagal terhubung' };
  }
}
