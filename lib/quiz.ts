/**
 * lib/quiz.ts — kuis dan soal di atas Postgres.
 *
 * Pemisahan yang jadi inti berkas ini: ada dua jalan membaca soal.
 *
 *   getQuizForPlayers()  — tanpa kunci jawaban. Untuk siapa pun.
 *   getQuizForOwner()    — lengkap. Hanya untuk pemilik kuis.
 *   getGradingKey()      — kunci jawaban saja, tidak pernah dikirim keluar.
 *
 * Versi sebelumnya menyimpan kuis sebagai satu gumpalan JSON terkompresi,
 * sehingga membacanya berarti membaca kunci jawabannya sekalian. Route
 * publik lalu meneruskan gumpalan itu apa adanya, dan peserta bisa
 * mengambil kunci jawaban di tengah permainan hanya dengan memanggil API.
 * Bentuk di bawah membuat kebocoran seperti itu perlu disengaja: kolom
 * correct_answer harus disebut namanya untuk bisa ikut terbaca.
 */

import { randomUUID } from 'crypto';
import {
  sql,
  type PublicQuestionRow,
  type FullQuestionRow,
  type QuizRow,
  type Visibility,
} from './db';

export interface QuizSummary {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  author: string | null;
  category: string;
  visibility: Visibility;
  coverImage: string | null;
  plays: number;
  rating: number;
  ratingCount: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionInput {
  type?: string;
  text: string;
  options?: unknown[];
  correctAnswer?: unknown;
  explanation?: string | null;
  imageUrl?: string | null;
  points?: number;
  timeLimit?: number;
}

const ALLOWED_TYPES = new Set(['MCQ', 'TRUE_FALSE', 'TYPE_ANSWER', 'POLL']);
const ALLOWED_VISIBILITY = new Set<Visibility>(['private', 'unlisted', 'public']);

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeType(type: unknown): string {
  const t = String(type ?? 'MCQ').toUpperCase();
  return ALLOWED_TYPES.has(t) ? t : 'MCQ';
}

export function normalizeVisibility(value: unknown): Visibility {
  const v = String(value ?? 'private').toLowerCase() as Visibility;
  return ALLOWED_VISIBILITY.has(v) ? v : 'private';
}

function toSummary(row: QuizRow & { question_count?: number }): QuizSummary {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    description: row.description,
    author: row.author,
    category: row.category,
    visibility: row.visibility,
    coverImage: row.cover_image,
    plays: row.plays,
    rating: row.rating_count === 0 ? 0 : Math.round((row.rating_sum / row.rating_count) * 100) / 100,
    ratingCount: row.rating_count,
    questionCount: Number(row.question_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ------------------------------------------------------------------
// Membaca
// ------------------------------------------------------------------

export async function getQuizMeta(quizId: string): Promise<QuizSummary | null> {
  const rows = (await sql`
    SELECT q.*, (SELECT count(*) FROM questions WHERE quiz_id = q.id) AS question_count
    FROM quizzes q
    WHERE q.id = ${quizId}
    LIMIT 1
  `) as (QuizRow & { question_count: number })[];
  return rows[0] ? toSummary(rows[0]) : null;
}

/**
 * Soal dalam bentuk yang aman dikirim ke peserta.
 * Perhatikan daftar kolomnya: correct_answer dan explanation tidak ada.
 */
export async function getQuizForPlayers(
  quizId: string
): Promise<{ quiz: QuizSummary; questions: PublicQuestionRow[] } | null> {
  const quiz = await getQuizMeta(quizId);
  if (!quiz) return null;

  const questions = (await sql`
    SELECT id, quiz_id, position, type, text, options, image_url, points, time_limit
    FROM questions
    WHERE quiz_id = ${quizId}
    ORDER BY position
  `) as PublicQuestionRow[];

  return { quiz, questions };
}

/** Kuis lengkap. Pemanggilnya wajib sudah memastikan penanya adalah pemilik. */
export async function getQuizForOwner(
  quizId: string,
  ownerId: string
): Promise<{ quiz: QuizSummary; questions: FullQuestionRow[] } | null> {
  const rows = (await sql`
    SELECT q.*, (SELECT count(*) FROM questions WHERE quiz_id = q.id) AS question_count
    FROM quizzes q
    WHERE q.id = ${quizId} AND q.host_id = ${ownerId}::uuid
    LIMIT 1
  `) as (QuizRow & { question_count: number })[];

  if (!rows[0]) return null;

  const questions = (await sql`
    SELECT id, quiz_id, position, type, text, options, correct_answer,
           explanation, image_url, points, time_limit
    FROM questions
    WHERE quiz_id = ${quizId}
    ORDER BY position
  `) as FullQuestionRow[];

  return { quiz: toSummary(rows[0]), questions };
}

/**
 * Kunci jawaban untuk penilaian di server.
 * Hasilnya tidak boleh ikut masuk ke tanggapan HTTP mana pun.
 */
export async function getGradingKey(
  quizId: string
): Promise<Map<string, { correctAnswer: unknown; points: number; type: string }>> {
  const rows = (await sql`
    SELECT id, correct_answer, points, type
    FROM questions
    WHERE quiz_id = ${quizId}
  `) as { id: string; correct_answer: unknown; points: number; type: string }[];

  return new Map(
    rows.map((r) => [r.id, { correctAnswer: r.correct_answer, points: r.points, type: r.type }])
  );
}

export async function listQuizzesByHost(hostId: string): Promise<QuizSummary[]> {
  const rows = (await sql`
    SELECT q.*, (SELECT count(*) FROM questions WHERE quiz_id = q.id) AS question_count
    FROM quizzes q
    WHERE q.host_id = ${hostId}::uuid
    ORDER BY q.updated_at DESC
  `) as (QuizRow & { question_count: number })[];
  return rows.map(toSummary);
}

export async function listPublicQuizzes(options: {
  category?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
} = {}): Promise<QuizSummary[]> {
  const limit = clamp(options.limit, 1, 60, 24);
  const offset = clamp(options.offset, 0, 10_000, 0);
  const category = options.category?.trim() || null;
  const search = options.search?.trim() || null;

  const rows = (await sql`
    SELECT q.*, (SELECT count(*) FROM questions WHERE quiz_id = q.id) AS question_count
    FROM quizzes q
    WHERE q.visibility = 'public'
      AND (${category}::text IS NULL OR q.category = ${category})
      AND (${search}::text IS NULL OR q.title ILIKE '%' || ${search} || '%')
    ORDER BY q.plays DESC, q.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `) as (QuizRow & { question_count: number })[];

  return rows.map(toSummary);
}

// ------------------------------------------------------------------
// Menulis
// ------------------------------------------------------------------

export async function createQuiz(
  hostId: string,
  data: {
    title: string;
    description?: string | null;
    author?: string | null;
    category?: string;
    visibility?: unknown;
    coverImage?: string | null;
  }
): Promise<string> {
  const id = `quiz_${randomUUID()}`;
  await sql`
    INSERT INTO quizzes (id, host_id, title, description, author, category, visibility, cover_image)
    VALUES (
      ${id},
      ${hostId}::uuid,
      ${data.title.trim().slice(0, 200)},
      ${data.description?.slice(0, 2000) ?? null},
      ${data.author?.slice(0, 120) ?? null},
      ${(data.category ?? 'General').slice(0, 60)},
      ${normalizeVisibility(data.visibility)},
      ${data.coverImage ?? null}
    )
  `;
  return id;
}

export async function updateQuizMeta(
  quizId: string,
  hostId: string,
  data: {
    title?: string;
    description?: string | null;
    category?: string;
    visibility?: unknown;
    coverImage?: string | null;
  }
): Promise<boolean> {
  const rows = (await sql`
    UPDATE quizzes SET
      title       = COALESCE(${data.title?.trim().slice(0, 200) ?? null}, title),
      description = COALESCE(${data.description?.slice(0, 2000) ?? null}, description),
      category    = COALESCE(${data.category?.slice(0, 60) ?? null}, category),
      visibility  = COALESCE(${data.visibility === undefined ? null : normalizeVisibility(data.visibility)}, visibility),
      cover_image = COALESCE(${data.coverImage ?? null}, cover_image)
    WHERE id = ${quizId} AND host_id = ${hostId}::uuid
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

/**
 * Mengganti seluruh daftar soal sebuah kuis.
 *
 * Hapus-lalu-sisipkan dijalankan dalam satu transaksi. Kalau salah satu
 * sisipan ditolak, tidak ada kuis yang berakhir kehilangan soalnya.
 */
export async function replaceQuestions(
  quizId: string,
  hostId: string,
  questions: QuestionInput[]
): Promise<number> {
  const owned = (await sql`
    SELECT id FROM quizzes WHERE id = ${quizId} AND host_id = ${hostId}::uuid LIMIT 1
  `) as { id: string }[];
  if (owned.length === 0) throw new Error('Kuis tidak ditemukan atau bukan milik Anda.');

  const cleaned = questions
    .filter((q) => typeof q?.text === 'string' && q.text.trim().length > 0)
    .slice(0, 500)
    .map((q, index) => ({
      position: index,
      type: normalizeType(q.type),
      text: q.text.trim().slice(0, 1000),
      options: JSON.stringify(Array.isArray(q.options) ? q.options.slice(0, 12) : []),
      correctAnswer: JSON.stringify(q.correctAnswer ?? null),
      explanation: q.explanation?.slice(0, 1000) ?? null,
      imageUrl: q.imageUrl ?? null,
      points: clamp(q.points, 0, 10_000, 1),
      timeLimit: clamp(q.timeLimit, 5, 600, 30),
    }));

  const statements = [
    sql`DELETE FROM questions WHERE quiz_id = ${quizId}`,
    ...cleaned.map(
      (q) => sql`
        INSERT INTO questions
          (quiz_id, position, type, text, options, correct_answer, explanation, image_url, points, time_limit)
        VALUES (
          ${quizId}, ${q.position}, ${q.type}, ${q.text},
          ${q.options}::jsonb, ${q.correctAnswer}::jsonb,
          ${q.explanation}, ${q.imageUrl}, ${q.points}, ${q.timeLimit}
        )
      `
    ),
  ];

  await sql.transaction(statements);
  await sql`UPDATE quizzes SET updated_at = now() WHERE id = ${quizId}`;

  return cleaned.length;
}

export async function deleteQuiz(quizId: string, hostId: string): Promise<boolean> {
  const rows = (await sql`
    DELETE FROM quizzes WHERE id = ${quizId} AND host_id = ${hostId}::uuid RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function incrementPlays(quizId: string): Promise<void> {
  await sql`UPDATE quizzes SET plays = plays + 1 WHERE id = ${quizId}`;
}

/**
 * Menyimpan penilaian bintang. Satu akun satu suara per kuis; suara kedua
 * memperbarui yang pertama, tidak menambah. Penjumlah di tabel quizzes
 * disesuaikan pada pernyataan yang sama supaya tidak melenceng.
 */
export async function rateQuiz(quizId: string, userId: string, rating: number): Promise<boolean> {
  const value = clamp(rating, 1, 5, 0);
  if (value === 0) return false;

  const previous = (await sql`
    SELECT rating FROM quiz_ratings WHERE quiz_id = ${quizId} AND user_id = ${userId}::uuid
  `) as { rating: number }[];

  await sql`
    INSERT INTO quiz_ratings (quiz_id, user_id, rating)
    VALUES (${quizId}, ${userId}::uuid, ${value})
    ON CONFLICT (quiz_id, user_id) DO UPDATE SET rating = EXCLUDED.rating
  `;

  if (previous.length > 0) {
    await sql`
      UPDATE quizzes SET rating_sum = rating_sum - ${previous[0].rating} + ${value}
      WHERE id = ${quizId}
    `;
  } else {
    await sql`
      UPDATE quizzes SET rating_sum = rating_sum + ${value}, rating_count = rating_count + 1
      WHERE id = ${quizId}
    `;
  }

  return true;
}
