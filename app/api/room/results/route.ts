import { NextResponse } from 'next/server';
import { handle } from '@/lib/api-guard';
import { normalizeRoomCode, getRoomForResults, RoomError } from '@/lib/room';
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

const POLA_KODE = /^[A-Z0-9]{6}$/;

/**
 * Alamat layar hasil peserta adalah /results/<KODE RUANGAN>, bukan
 * /results/<sessionId>: halaman permainan peserta tidak pernah memegang
 * sessionId — yang ada di tangannya hanya kode enam huruf yang ia ketik
 * saat masuk. Halaman hasil lalu mengirim kode itu pada tempat sessionId.
 *
 * Sebelumnya kode tersebut dicari sebagai session_id di dua tabel,
 * tidak ditemukan di keduanya, dan permintaannya berakhir 400. Layar
 * peserta menjawabnya dengan mengulang delapan kali lalu berhenti pada
 * "Hasil tidak ditemukan" — sementara papan peringkatnya utuh, dan
 * layar guru yang membawa sessionId sebenarnya menampilkannya dengan
 * baik. Karena itu penanda yang masuk diperiksa bentuknya dulu: enam
 * huruf besar berarti kode ruangan, apa pun nama parameternya.
 */
function sebagaiKodeRuangan(nilai: unknown): string | null {
  const kode = String(nilai ?? '').trim().toUpperCase();
  return POLA_KODE.test(kode) ? kode : null;
}

type CatatanSesi = {
  session_id: string;
  room_code: string | null;
  quiz_id: string | null;
  host_id: string | null;
  payload: Record<string, unknown>;
  finished_at: string;
  quiz_title: string | null;
};

function jawabanCatatan(baris: CatatanSesi) {
  return NextResponse.json({
    ...baris.payload,
    sessionId: baris.session_id,
    roomCode: baris.room_code,
    quizId: baris.quiz_id,
    quizTitle: baris.quiz_title,
    hostId: baris.host_id,
    status: 'ended',
    leaderboard: rapikanPapan(baris.payload?.leaderboard),
    finishedAt: baris.finished_at,
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

  // Peserta menaruh kode ruangan pada tempat sessionId; keduanya
  // dipisahkan di sini, sebelum satu pun basis data disentuh.
  const kodeDariSessionId = sebagaiKodeRuangan(sessionId);
  const kode = roomCode ? normalizeRoomCode(roomCode) : kodeDariSessionId;
  const sesiSebenarnya = kodeDariSessionId ? null : sessionId;

  // 1. Catatan yang sudah diabadikan, dicari lewat session_id.
  if (sesiSebenarnya) {
    const saved = (await sql`
      SELECT r.session_id, r.room_code, r.quiz_id, r.host_id, r.payload,
             r.finished_at, q.title AS quiz_title
      FROM session_results r
      LEFT JOIN quizzes q ON q.id = r.quiz_id
      WHERE r.session_id = ${sesiSebenarnya}
      LIMIT 1
    `) as CatatanSesi[];

    if (saved[0]) return jawabanCatatan(saved[0]);
  }

  // 2. Catatan yang sama, dicari lewat kode ruangan. Inilah jalan yang
  //    dipakai peserta: ruangannya sudah ditutup, barisnya sudah
  //    terhapus, tetapi hasilnya tersimpan tersendiri dan masih terbaca.
  //    Kode ruangan dapat terpakai ulang oleh sesi berikutnya, jadi yang
  //    diambil selalu yang terakhir selesai.
  if (kode) {
    const saved = (await sql`
      SELECT r.session_id, r.room_code, r.quiz_id, r.host_id, r.payload,
             r.finished_at, q.title AS quiz_title
      FROM session_results r
      LEFT JOIN quizzes q ON q.id = r.quiz_id
      WHERE r.room_code = ${kode}
      ORDER BY r.finished_at DESC
      LIMIT 1
    `) as CatatanSesi[];

    if (saved[0]) return jawabanCatatan(saved[0]);
  }

  // 3. Permainan yang belum ditutup: angkanya dibaca langsung dari
  //    tabel peserta.
  let code: string | null = kode;
  if (!code && sesiSebenarnya) {
    const ruang = (await sql`
      SELECT code FROM rooms WHERE session_id = ${sesiSebenarnya} LIMIT 1
    `) as { code: string }[];
    if (ruang[0]) code = ruang[0].code;
  }

  if (!code) throw new RoomError('Perlu roomCode atau sessionId.', 400);

  // Sengaja memakai getRoomForResults, bukan getRoom: yang terakhir
  // menolak ruangan yang sudah lewat masa berlakunya, dan hasil sebuah
  // sesi harus tetap terbaca lama setelah ruangannya ditutup.
  const room = await getRoomForResults(code);
  if (!room) throw new RoomError('Ruangan tidak ditemukan.', 404);

  const leaderboard = await getLeaderboard(code, 500);

  const judul = (await sql`
    SELECT title FROM quizzes WHERE id = ${room.quiz_id} LIMIT 1
  `) as { title: string }[];

  return NextResponse.json({
    sessionId: room.session_id,
    roomCode: code,
    status: room.status,
    gameMode: room.game_mode,
    settings: room.settings,
    quizId: room.quiz_id,
    quizTitle: judul[0]?.title ?? null,
    hostId: room.host_id,
    leaderboard: rapikanPapan(leaderboard),
  });
});
