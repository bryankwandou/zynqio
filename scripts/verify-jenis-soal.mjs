/**
 * scripts/verify-jenis-soal.mjs — soal isian, pilihan ganda, dan urutan.
 *
 * Kuis dari templat Excel menyimpan kunci sebagai huruf ("B"), beberapa
 * huruf ("B;D"), teks isian, dan urutan ("10,20,30,40"), sementara peserta
 * mengirim nomor pilihan. Peserta yang menjawab benar dulu tercatat salah.
 * Pemeriksaan ini memakai bentuk kunci persis seperti templat itu.
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
  const res = await fetch(`${BASE}${path}`, { ...opsi, headers: { 'Content-Type': 'application/json' } });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const TAG = Date.now().toString(36).toUpperCase().slice(-4);
const KODE = `J${TAG}Q`.slice(0, 6).padEnd(6, 'X');
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
let hostId = null;

const SOAL = [
  { text: 'Bumi datar?', options: ['True', 'False'], key: 'B', points: 1, benar: '1', salah: '0', jenis: 'tunggal' },
  { text: 'Bahasa pemrograman?', options: ['HTML', 'JavaScript', 'CSS', 'Python'], key: 'B;D', points: 3, benar: ['1', '3'], salah: ['0', '1'], jenis: 'ganda' },
  { text: 'Zynqio terbaik ___', options: ['', ''], key: 'ever;in the world', points: 1, benar: 'In The World', salah: 'kemarin', jenis: 'isian' },
  { text: 'Urutkan naik', options: ['10', '20', '30', '40'], key: '10,20,30,40', points: 1, benar: ['0', '1', '2', '3'], salah: ['1', '0', '2', '3'], jenis: 'urutan' },
];

try {
  const { rows: [host] } = await pool.query(
    `INSERT INTO users (email, username) VALUES ($1, 'Host Jenis') RETURNING id`, [`jenis_${TAG}@example.test`]);
  hostId = host.id;
  const quizId = `quiz_jenis_${TAG}`;
  await pool.query(`INSERT INTO quizzes (id, host_id, title) VALUES ($1, $2, 'Uji Jenis Soal')`, [quizId, hostId]);
  const ids = [];
  for (const [i, s] of SOAL.entries()) {
    const { rows: [q] } = await pool.query(
      `INSERT INTO questions (quiz_id, position, type, text, options, correct_answer, points, time_limit)
       VALUES ($1, $2, 'MCQ', $3, $4::jsonb, $5::jsonb, $6, 30) RETURNING id`,
      [quizId, i, s.text, JSON.stringify(s.options), JSON.stringify(s.key), s.points]);
    ids.push(q.id);
  }
  await pool.query(
    `INSERT INTO rooms (code, session_id, quiz_id, host_id, status, game_mode, expires_at)
     VALUES ($1, $2, $3, $4, 'waiting', 'wayground_classic', now() + interval '2 hours')`,
    [KODE, `sesi_jenis_${TAG}`, quizId, hostId]);

  const gabung = async (nama) => (await panggil('/api/room/join', {
    method: 'POST', body: JSON.stringify({ roomCode: KODE, playerName: nama, avatarId: 'fox' }),
  })).body?.playerToken;
  const tBenar = await gabung('Benar');
  const tSalah = await gabung('Salah');
  await pool.query(`UPDATE rooms SET status = 'playing', question_started_at = now() WHERE code = $1`, [KODE]);

  for (const [i, s] of SOAL.entries()) {
    const soal = await panggil(`/api/room/question?roomCode=${KODE}&index=${i}&token=${encodeURIComponent(tBenar)}`);
    catat(`Soal ${i + 1} dikenali sebagai ${s.jenis}`, soal.body?.answerKind === s.jenis, `answerKind=${soal.body?.answerKind}`);
    catat(`Soal ${i + 1} tidak membawa kunci`, !JSON.stringify(soal.body).includes(JSON.stringify(s.key)), '');
    if (s.jenis === 'urutan') {
      const asli = soal.body?.optionIds?.join(',');
      catat('Pilihan urutan dikirim teracak', asli && asli !== '0,1,2,3', `optionIds=${asli}`);
    }
    const kirim = async (token, jawab) => (await panggil('/api/answer/submit', {
      method: 'POST', body: JSON.stringify({ roomCode: KODE, playerToken: token, questionId: ids[i], selectedAnswer: jawab }),
    })).body;
    const b = await kirim(tBenar, s.benar);
    const x = await kirim(tSalah, s.salah);
    catat(`Soal ${i + 1}: jawaban benar dinilai benar`, b?.correct === true, `skor ${b?.sessionScore}`);
    catat(`Soal ${i + 1}: jawaban salah dinilai salah`, x?.correct === false, '');
    if (i === 0) catat('Bobot templat 1 memberi skor wajar, bukan 8 poin', b?.sessionScore >= 500, `skor ${b?.sessionScore}`);
  }

  await pool.query(`UPDATE rooms SET status = 'ended' WHERE code = $1`, [KODE]);
  const hasil = await panggil(`/api/room/results?roomCode=${KODE}`);
  const q = hasil.body?.questions ?? [];
  catat('Review menandai False sebagai benar', q[0]?.options?.[1]?.correct === true && q[0]?.options?.[0]?.correct === false, '');
  catat('Review menandai JavaScript dan Python', q[1]?.options?.filter((o) => o.correct).map((o) => o.text).join() === 'JavaScript,Python', '');
  catat('Review menampilkan jawaban isian', q[2]?.correctAnswer === 'ever / in the world', q[2]?.correctAnswer);
  catat('Review menampilkan urutan benar', q[3]?.correctAnswer === '10 → 20 → 30 → 40', q[3]?.correctAnswer);
} finally {
  if (hostId) await pool.query('DELETE FROM users WHERE id = $1', [hostId]).catch(() => {});
  await pool.end().catch(() => {});
}

console.log(`${lulus}/${lulus + gagal} pembuktian lulus.`);
process.exit(gagal ? 1 : 0);
