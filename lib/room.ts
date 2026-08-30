/**
 * lib/room.ts — ruangan permainan di atas Postgres.
 *
 * Dua hal yang berubah sikapnya dibanding versi Redis:
 *
 * 1. Kendali host punya penjaga. Sebelumnya route seperti start, end,
 *    next-question, dan kick hanya menerima kode ruangan dari badan
 *    permintaan lalu menuruti. Siapa pun yang tahu kode enam huruf itu —
 *    dan kode itu terpampang di layar untuk semua peserta — bisa
 *    menghentikan atau melompati soal di permainan orang lain.
 *    assertHost() menutup itu.
 *
 * 2. Peserta membuktikan diri lewat token. Token yang tersimpan hanya
 *    hash-nya, dan pencocokannya memakai perbandingan waktu tetap.
 */

import crypto from 'crypto';
import { sql, isUniqueViolation, type RoomRow, type RoomPlayerRow, type RoomStatus } from './db';

export class RoomError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'RoomError';
  }
}

const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

// Huruf dan angka yang mudah tertukar dibuang: 0/O, 1/I/L.
// Peserta mengetik kode ini dari layar proyektor, sering dari jauh.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function normalizeRoomCode(input: unknown): string {
  const code = String(input ?? '').trim().toUpperCase();
  if (!ROOM_CODE_PATTERN.test(code)) {
    throw new RoomError('Format kode ruangan tidak sah.', 400);
  }
  return code;
}

function generateCode(): string {
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ------------------------------------------------------------------
// Membaca
// ------------------------------------------------------------------

export async function getRoom(code: string): Promise<RoomRow | null> {
  const rows = (await sql`
    SELECT * FROM rooms WHERE code = ${code} AND expires_at > now() LIMIT 1
  `) as RoomRow[];
  return rows[0] ?? null;
}

export async function getPlayers(code: string): Promise<RoomPlayerRow[]> {
  return (await sql`
    SELECT id, room_code, user_id, name, avatar_id, score, total_answered,
           total_correct, streak, is_kicked, joined_at
    FROM room_players
    WHERE room_code = ${code} AND is_kicked = false
    ORDER BY score DESC, joined_at ASC
  `) as RoomPlayerRow[];
}

/**
 * Memastikan pemanggilnya benar-benar host ruangan ini.
 * Semua kendali permainan wajib lewat sini lebih dulu.
 */
export async function assertHost(code: string, userId: string | undefined): Promise<RoomRow> {
  if (!userId) throw new RoomError('Perlu masuk terlebih dahulu.', 401);

  const room = await getRoom(code);
  if (!room) throw new RoomError('Ruangan tidak ditemukan.', 404);

  if (room.host_id !== userId) {
    // Pesannya sengaja sama dengan ruangan yang tidak ada. Membedakan
    // keduanya akan memberi tahu penebak bahwa kodenya benar.
    throw new RoomError('Ruangan tidak ditemukan.', 404);
  }

  return room;
}

/**
 * Memastikan token peserta sah untuk ruangan ini.
 * Dipakai oleh pengiriman jawaban dan setiap tindakan atas nama peserta.
 */
export async function assertPlayer(code: string, token: unknown): Promise<RoomPlayerRow> {
  if (typeof token !== 'string' || token.length < 16) {
    throw new RoomError('Sesi peserta tidak sah.', 401);
  }

  const rows = (await sql`
    SELECT id, room_code, user_id, name, avatar_id, score, total_answered,
           total_correct, streak, is_kicked, joined_at
    FROM room_players
    WHERE room_code = ${code} AND token_hash = ${hashToken(token)}
    LIMIT 1
  `) as RoomPlayerRow[];

  const player = rows[0];
  if (!player) throw new RoomError('Sesi peserta tidak sah.', 401);
  if (player.is_kicked) throw new RoomError('Anda telah dikeluarkan dari ruangan ini.', 403);

  return player;
}

// ------------------------------------------------------------------
// Menulis
// ------------------------------------------------------------------

export async function createRoom(params: {
  quizId: string;
  hostId: string;
  gameMode?: string;
  settings?: Record<string, unknown>;
}): Promise<{ code: string; sessionId: string }> {
  const sessionId = `session_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;

  // Tabrakan kode ditangkap oleh kunci primer, bukan oleh pemeriksaan
  // "sudah ada belum" sebelum menulis — pemeriksaan seperti itu selalu
  // menyisakan celah antara membaca dan menulis.
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateCode();
    try {
      await sql`
        INSERT INTO rooms (code, session_id, quiz_id, host_id, game_mode, settings)
        VALUES (
          ${code}, ${sessionId}, ${params.quizId}, ${params.hostId}::uuid,
          ${params.gameMode ?? 'classic'},
          ${JSON.stringify(params.settings ?? {})}::jsonb
        )
      `;
      return { code, sessionId };
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }

  throw new RoomError('Gagal membuat kode ruangan yang unik.', 503);
}

export async function addPlayer(params: {
  code: string;
  name: string;
  avatarId?: string;
  userId?: string | null;
}): Promise<{ player: RoomPlayerRow; token: string }> {
  const room = await getRoom(params.code);
  if (!room) throw new RoomError('Ruangan tidak ditemukan.', 404);
  if (room.status !== 'waiting') throw new RoomError(`Ruangan sedang ${room.status}.`, 409);

  const maxPlayers = Number(room.settings?.maxPlayers ?? 300);
  const current = (await sql`
    SELECT count(*)::int AS n FROM room_players WHERE room_code = ${params.code}
  `) as { n: number }[];
  if (current[0].n >= maxPlayers) throw new RoomError('Ruangan sudah penuh.', 409);

  const base = params.name.replace(/[<>"'&]/g, '').trim().slice(0, 40);
  if (!base) throw new RoomError('Nama tidak boleh kosong.', 400);

  const token = `${params.code}.${crypto.randomBytes(24).toString('hex')}`;
  const avatarId = (params.avatarId ?? 'fox').slice(0, 40);

  // Nama ganda diselesaikan dengan mencoba lalu menanggapi penolakan
  // indeks unik. Dua peserta yang mengirim nama sama di saat yang sama
  // tidak bisa lolos berdua, berapa pun instance yang melayani.
  for (let suffix = 1; suffix <= 60; suffix++) {
    const name = suffix === 1 ? base : `${base} (${suffix})`;
    const playerId = `player_${crypto.randomBytes(6).toString('hex')}`;

    try {
      const rows = (await sql`
        INSERT INTO room_players (id, room_code, user_id, name, avatar_id, token_hash)
        VALUES (
          ${playerId}, ${params.code},
          ${params.userId ?? null}, ${name}, ${avatarId}, ${hashToken(token)}
        )
        RETURNING id, room_code, user_id, name, avatar_id, score, total_answered,
                  total_correct, streak, is_kicked, joined_at
      `) as RoomPlayerRow[];
      return { player: rows[0], token };
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }

  throw new RoomError('Nama itu sudah terlalu banyak dipakai di ruangan ini.', 409);
}

/**
 * Mengubah keadaan ruangan dengan penguncian optimistis.
 * Penulis yang membawa nomor versi basi ditolak, bukan menimpa diam-diam.
 */
/**
 * Ragam permainan yang benar-benar dikenali mesin permainan.
 *
 * Nilai dari peramban tidak pernah dipercaya apa adanya: ragam menentukan
 * cara skor dihitung, jadi nilai karangan harus jatuh ke Klasik, bukan
 * masuk ke basis data dan membuat penilaiannya tidak terdefinisi.
 *
 * 'classic' adalah nilai bawaan kolomnya sejak awal dan masih tersimpan
 * di ruangan-ruangan lama, jadi ia dipetakan ke ragam yang sama supaya
 * sesi lama tetap terbaca.
 */
const RAGAM_SAH = new Set([
  'wayground_classic',
  'speed_rush',
  'battle_royale',
  'survival',
  'gold_quest',
  'team',
]);

export function normalizeGameMode(value: unknown): string {
  const v = String(value ?? '').trim();
  if (v === 'classic') return 'wayground_classic';
  return RAGAM_SAH.has(v) ? v : 'wayground_classic';
}

export async function updateRoomState(
  code: string,
  expectedVersion: number,
  patch: {
    status?: RoomStatus;
    currentQuestionIndex?: number;
    questionStartedAt?: Date | null;
    settings?: Record<string, unknown>;
    gameMode?: unknown;
  }
): Promise<RoomRow> {
  const rows = (await sql`
    UPDATE rooms SET
      status                 = COALESCE(${patch.status ?? null}, status),
      current_question_index = COALESCE(${patch.currentQuestionIndex ?? null}, current_question_index),
      question_started_at    = CASE
                                 WHEN ${patch.questionStartedAt === undefined} THEN question_started_at
                                 ELSE ${patch.questionStartedAt?.toISOString() ?? null}::timestamptz
                               END,
      settings               = COALESCE(${patch.settings ? JSON.stringify(patch.settings) : null}::jsonb, settings),
      game_mode              = COALESCE(${patch.gameMode === undefined ? null : normalizeGameMode(patch.gameMode)}, game_mode),
      version                = version + 1,
      updated_at             = now()
    WHERE code = ${code} AND version = ${expectedVersion}
    RETURNING *
  `) as RoomRow[];

  if (rows.length === 0) {
    throw new RoomError('Keadaan ruangan sudah berubah. Muat ulang lalu coba lagi.', 409);
  }

  return rows[0];
}

export async function kickPlayer(code: string, playerId: string): Promise<boolean> {
  const rows = (await sql`
    UPDATE room_players SET is_kicked = true
    WHERE room_code = ${code} AND id = ${playerId}
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function endRoom(code: string): Promise<void> {
  await sql`
    UPDATE rooms SET status = 'ended', version = version + 1, updated_at = now()
    WHERE code = ${code}
  `;
}

export async function logEvent(
  code: string,
  sessionId: string | null,
  type: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    await sql`
      INSERT INTO room_events (room_code, session_id, type, payload)
      VALUES (${code}, ${sessionId}, ${type.slice(0, 60)}, ${JSON.stringify(payload)}::jsonb)
    `;
  } catch {
    // Jejak kejadian bersifat pelengkap. Gagal mencatat tidak boleh
    // menggagalkan permainan yang sedang berjalan.
  }
}

export async function getEvents(code: string, afterId = 0, limit = 200) {
  return (await sql`
    SELECT id, type, payload, created_at
    FROM room_events
    WHERE room_code = ${code} AND id > ${afterId}
    ORDER BY id
    LIMIT ${Math.min(Math.max(limit, 1), 500)}
  `) as { id: number; type: string; payload: unknown; created_at: string }[];
}

/**
 * Membersihkan ruangan yang sudah lewat masa berlakunya.
 * Baris turunannya ikut terhapus lewat ON DELETE CASCADE.
 */
export async function purgeExpiredRooms(): Promise<number> {
  const rows = (await sql`
    DELETE FROM rooms WHERE expires_at < now() RETURNING code
  `) as { code: string }[];
  return rows.length;
}
