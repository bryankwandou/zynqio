import { NextResponse } from 'next/server';
import { handle } from '@/lib/api-guard';
import { normalizeRoomCode, getRoom, RoomError } from '@/lib/room';
import { getLeaderboard } from '@/lib/answers';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Basis data memakai garis bawah (avatar_id, total_correct); layar hasil
 * membaca unta (avatarId, totalCorrect) dan juga meminta dua kolom yang
 * tidak ada di tabel mana pun: rank dan accuracy.
 *
 * Selisih penamaan itu tidak pernah melempar galat — ia hanya menghasilkan
 * undefined, dan undefined tampil sebagai layar yang salah:
 *
 *   rank        → PODIUM_H[NaN] tidak bertinggi, sehingga balok podium
 *                 lenyap; MEDALS[NaN] menghapus medali; mahkota juara
 *                 tidak pernah muncul karena rank === 1 tak pernah benar
 *   avatarId    → getAvatar(undefined) mengembalikan AVATARS[0], jadi
 *                 seluruh peserta memakai satu rupa yang sama, apa pun
 *                 yang mereka pilih
 *   totalCorrect→ "0/0 correct" pada tiap baris
 *   accuracy    → "% acc" tanpa angka di depannya
 *
 * Perapian dilakukan saat dibaca, bukan saat ditulis, supaya hasil yang
 * terlanjur tersimpan mentah di session_results ikut pulih tanpa migrasi.
 */
type BarisMentah = Record<string, unknown>;

function angka(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function rapikanPapan(mentah: unknown): unknown[] {
  if (!Array.isArray(mentah)) return [];

  // Peringkat mengikuti skor. Baris yang sudah terurut dari SQL tetap
  // diurutkan lagi di sini supaya hasil lama yang tersimpan dengan
  // urutan apa pun ikut benar.
  const urut = [...mentah].sort((a: BarisMentah, b: BarisMentah) => {
    const sa = angka((a as BarisMentah).score);
    const sb = angka((b as BarisMentah).score);
    return sb - sa;
  });

  return urut.map((p: BarisMentah, i) => {
    // Kedua ejaan diterima: baris baru dari SQL memakai garis bawah,
    // baris lama yang pernah tersimpan bisa memakai keduanya.
    const dijawab = angka(p.totalAnswered ?? p.total_answered);
    const benar = angka(p.totalCorrect ?? p.total_correct);

    return {
      id: p.id,
      name: p.name,
      avatarId: p.avatarId ?? p.avatar_id ?? null,
      score: angka(p.score),
      streak: angka(p.streak),
      totalAnswered: dijawab,
      totalCorrect: benar,
      rank: i + 1,
      accuracy: dijawab > 0 ? Math.round((benar / dijawab) * 100) : 0,
    };
  });
}

/**
 * GET /api/room/results?roomCode=...  atau  ?sessionId=...
 *
 * Hasil dibaca dari catatan sesi bila permainannya sudah selesai, dan
 * dari tabel peserta bila masih berjalan. Keduanya dihitung dari data
 * yang sama, jadi angkanya tidak berbeda antara layar akhir dan riwayat.
 */
export const GET = handle(async (req) => {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const roomCode = searchParams.get('roomCode');

  if (sessionId) {
    const saved = (await sql`
      SELECT payload, finished_at FROM session_results WHERE session_id = ${sessionId} LIMIT 1
    `) as { payload: Record<string, unknown>; finished_at: string }[];

    if (saved[0]) {
      return NextResponse.json({
        ...saved[0].payload,
        leaderboard: rapikanPapan(saved[0].payload?.leaderboard),
        finishedAt: saved[0].finished_at,
      });
    }
  }

  // Halaman hasil hanya memegang sessionId — alamatnya /results/session_x
  // dan tidak memuat kode ruangan sama sekali. Sebelumnya, sesi yang
  // belum sempat tersimpan langsung dijawab 400 dan layarnya menulis
  // "Hasil tidak ditemukan", padahal papan peringkatnya masih utuh di
  // tabel peserta. Ruangannya dicari lewat sessionId dulu sebelum
  // menyerah.
  let code: string | null = null;
  if (roomCode) {
    code = normalizeRoomCode(roomCode);
  } else if (sessionId) {
    const ruang = (await sql`
      SELECT code FROM rooms WHERE session_id = ${sessionId} LIMIT 1
    `) as { code: string }[];
    if (ruang[0]) code = ruang[0].code;
  }

  if (!code) throw new RoomError('Perlu roomCode atau sessionId.', 400);

  const room = await getRoom(code);
  if (!room) throw new RoomError('Ruangan tidak ditemukan.', 404);

  const leaderboard = await getLeaderboard(code, 500);

  return NextResponse.json({
    sessionId: room.session_id,
    roomCode: code,
    status: room.status,
    gameMode: room.game_mode,
    leaderboard: rapikanPapan(leaderboard),
  });
});
