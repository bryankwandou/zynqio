/**
 * scripts/verify-hasil.mjs — layar hasil akhir.
 *
 * Lima cacat yang dilaporkan Hakim berasal dari satu sebab: /api/room/results
 * mengembalikan baris apa adanya dari SQL (avatar_id, total_correct) sementara
 * layarnya membaca ejaan unta, dan meminta dua kolom yang tidak ada di tabel
 * mana pun — rank dan accuracy.
 *
 * Tidak ada galat yang dilempar. Yang muncul hanya undefined, dan undefined
 * tampil sebagai balok podium tanpa tinggi (PODIUM_H[NaN]), medali yang
 * hilang (MEDALS[NaN]), seluruh peserta berupa satu makhluk yang sama
 * (getAvatar(undefined) → AVATARS[0]), "0/0 correct", dan "% acc" tanpa
 * angka. Karena itu pemeriksaan di sini menuntut kolomnya ada dan masuk
 * akal, bukan sekadar permintaannya menjawab 200.
 */
import pg from 'pg';

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

let lulus = 0, gagal = 0;
const catat = (judul, ok, ket) => {
  console.log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${judul}${ket ? ' — ' + ket : ''}`);
  ok ? lulus++ : gagal++;
};

const panggil = async (path, opsi = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...opsi,
    headers: { 'Content-Type': 'application/json', ...(opsi.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};

const TAG = Date.now().toString(36).toUpperCase().slice(-4);
const KODE = `H${TAG}Z`.toUpperCase().slice(0, 6).padEnd(6, 'X');

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30_000 });
const sesiId = `sesi_hasil_${TAG}`;
let hostId = null;

try {
  const { rows: [host] } = await pool.query(
    `INSERT INTO users (email, username) VALUES ($1, 'Host Hasil') RETURNING id`,
    [`hasil_${TAG}@example.test`]
  );
  hostId = host.id;

  const quizId = `quiz_hasil_${TAG}`;
  await pool.query(
    `INSERT INTO quizzes (id, host_id, title, visibility, category)
     VALUES ($1, $2, 'Kuis Uji Hasil', 'public', 'Umum')`,
    [quizId, hostId]
  );
  const { rows: [soal] } = await pool.query(
    `INSERT INTO questions (quiz_id, position, type, text, options, correct_answer, points, time_limit)
     VALUES ($1, 0, 'MCQ', 'Ibu kota Indonesia?', '["Jakarta","Bandung","Surabaya","Medan"]'::jsonb, '"0"'::jsonb, 100, 30)
     RETURNING id`,
    [quizId]
  );
  await pool.query(
    `INSERT INTO rooms (code, session_id, quiz_id, host_id, status, game_mode,
                        current_question_index, question_started_at, expires_at)
     VALUES ($1, $2, $3, $4, 'waiting', 'wayground_classic', 0, NULL, now() + interval '2 hours')`,
    [KODE, sesiId, quizId, hostId]
  );

  // Rupa singa dipilih dengan sengaja. Cacat yang dilaporkan berbunyi
  // "avatar tetap naga walau hakim menggunakan avatar singa", jadi yang
  // diperiksa adalah rupa pilihan itu selamat sampai layar hasil.
  const gabung = await panggil('/api/room/join', {
    method: 'POST',
    body: JSON.stringify({ roomCode: KODE, playerName: 'Hakim', avatarId: 'lion' }),
  });
  const token = gabung.body?.playerToken;
  if (!token) throw new Error('token peserta tidak terbit — status ' + gabung.status + ' ' + JSON.stringify(gabung.body));

  // Ruangan dibuka dulu supaya peserta bisa masuk, baru dijalankan —
  // urutan yang sama dengan yang dilakukan pengajar sungguhan.
  await pool.query(
    `UPDATE rooms SET status = 'playing', question_started_at = now() WHERE code = $1`,
    [KODE]
  );

  await panggil('/api/answer/submit', {
    method: 'POST',
    body: JSON.stringify({ roomCode: KODE, playerToken: token, questionId: soal.id, selectedAnswer: '0' }),
  });

  // ── Papan peringkat yang masih berjalan ────────────────────────────
  const hidup = await panggil(`/api/room/results?roomCode=${KODE}`);
  const baris = (hidup.body?.leaderboard || [])[0];

  catat('Papan peringkat berisi peserta', !!baris, baris ? baris.name : 'kosong');
  catat('Peringkat dihitung — balok podium punya tinggi', baris?.rank === 1, `rank=${baris?.rank}`);
  catat('Rupa pilihan ikut terkirim, bukan bawaan naga', baris?.avatarId === 'lion', `avatarId=${baris?.avatarId}`);
  catat('Ketepatan dihitung, bukan "% acc" kosong', baris?.accuracy === 100, `accuracy=${baris?.accuracy}`);
  catat('Soal terjawab tercatat, bukan 0/0', baris?.totalAnswered === 1 && baris?.totalCorrect === 1, `${baris?.totalCorrect}/${baris?.totalAnswered}`);

  // ── Sesi yang belum tersimpan tidak boleh "Hasil tidak ditemukan" ──
  const belum = await panggil(`/api/room/results?sessionId=${encodeURIComponent(sesiId)}`);
  catat(
    'Sesi yang belum tersimpan tetap menemukan hasilnya',
    belum.status === 200 && (belum.body?.leaderboard || []).length > 0,
    `status ${belum.status}, ${belum.body?.leaderboard?.length ?? 0} peserta`
  );

  // ── Setelah ditutup, bentuknya harus sama ──────────────────────────
  await panggil('/api/room/end', { method: 'POST', body: JSON.stringify({ roomCode: KODE }) });
  const simpan = await panggil(`/api/room/results?sessionId=${encodeURIComponent(sesiId)}`);
  const b2 = (simpan.body?.leaderboard || [])[0];
  catat(
    'Hasil tersimpan dirapikan dengan bentuk yang sama',
    b2?.rank === 1 && b2?.avatarId === 'lion' && b2?.accuracy === 100,
    `rank=${b2?.rank} avatarId=${b2?.avatarId} accuracy=${b2?.accuracy}`
  );
} finally {
  if (hostId) await pool.query('DELETE FROM users WHERE id = $1', [hostId]).catch(() => {});
  await pool.end().catch(() => {});
}

console.log(`${lulus}/${lulus + gagal} pembuktian lulus.`);
process.exit(gagal ? 1 : 0);
