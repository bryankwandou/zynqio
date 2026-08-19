#!/usr/bin/env node
/**
 * scripts/verify-db.mjs — pembuktian jaminan skema.
 *
 * Berkas ini tidak memeriksa "apakah kodenya jalan". Yang diuji adalah
 * apakah aturan yang dulu dititipkan ke kode aplikasi sekarang benar-benar
 * ditegakkan oleh database — termasuk saat permintaan datang bersamaan,
 * keadaan yang justru menjatuhkan versi sebelumnya.
 *
 * Semua yang dibuat di sini dihapus lagi di akhir.
 */

import pg from 'pg';

const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL belum diisi.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 24,
  connectionTimeoutMillis: 30_000,
});

const results = [];
function record(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`  ${passed ? 'LULUS' : 'GAGAL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const TAG = `verify_${Date.now()}`;

async function main() {
  console.log(`\nPembuktian jaminan skema (penanda ${TAG})\n`);

  // ---- persiapan --------------------------------------------------
  const { rows: [user] } = await pool.query(
    `INSERT INTO users (email, username, password_hash)
     VALUES ($1, $2, 'x') RETURNING id`,
    [`${TAG}@example.test`, 'Penguji']
  );

  const quizId = `quiz_${TAG}`;
  await pool.query(
    `INSERT INTO quizzes (id, host_id, title, visibility) VALUES ($1, $2, $3, 'public')`,
    [quizId, user.id, 'Kuis Pembuktian']
  );

  const { rows: [question] } = await pool.query(
    `INSERT INTO questions (quiz_id, position, type, text, options, correct_answer, points)
     VALUES ($1, 0, 'MCQ', 'Ibu kota Indonesia?',
             '["Bandung","Jakarta","Surabaya","Medan"]'::jsonb, '1'::jsonb, 1)
     RETURNING id`,
    [quizId]
  );

  const roomCode = 'ZQ' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const sessionId = `session_${TAG}`;
  await pool.query(
    `INSERT INTO rooms (code, session_id, quiz_id, host_id, status, settings)
     VALUES ($1, $2, $3, $4, 'playing', '{"timer":30}'::jsonb)`,
    [roomCode, sessionId, quizId, user.id]
  );

  // ---- 1. kunci jawaban tidak ikut pada pembacaan publik ----------
  {
    const { rows } = await pool.query(
      `SELECT id, position, type, text, options, image_url, points, time_limit
       FROM questions WHERE quiz_id = $1`,
      [quizId]
    );
    const leaked = rows.some((r) => 'correct_answer' in r || 'explanation' in r);
    record(
      'Pembacaan soal untuk peserta tidak membawa kunci jawaban',
      !leaked,
      `kolom: ${Object.keys(rows[0]).join(', ')}`
    );
  }

  // ---- 2. nama peserta unik per ruangan, di bawah tekanan ---------
  {
    // Dua belas permintaan bersamaan memakai nama yang persis sama.
    // Versi lama menambal ini dengan membaca ulang sesaat sebelum menulis,
    // yang tetap menyisakan celah. Sekarang indeks yang memutuskan.
    const attempts = Array.from({ length: 12 }, (_, i) =>
      pool
        .query(
          `INSERT INTO room_players (id, room_code, name, token_hash)
           VALUES ($1, $2, 'Budi', $3)`,
          [`p_${TAG}_${i}`, roomCode, `hash_${TAG}_${i}`]
        )
        .then(() => 'ok')
        .catch((e) => (e.code === '23505' ? 'ditolak' : `galat:${e.code}`))
    );
    const outcome = await Promise.all(attempts);
    const accepted = outcome.filter((o) => o === 'ok').length;
    record(
      'Dua belas peserta bernama sama serentak: hanya satu diterima',
      accepted === 1,
      `${accepted} diterima, ${outcome.filter((o) => o === 'ditolak').length} ditolak`
    );
  }

  // peserta tetap untuk pengujian berikutnya
  const playerId = `p_${TAG}_main`;
  await pool.query(
    `INSERT INTO room_players (id, room_code, name, token_hash, score)
     VALUES ($1, $2, 'Peserta Utama', $3, 0)`,
    [playerId, roomCode, `hash_${TAG}_main`]
  );

  // ---- 3. satu kali jawab, di bawah tekanan ----------------------
  {
    // Sepuluh pengiriman serentak untuk soal yang sama oleh peserta yang
    // sama. Ini persis keadaan yang tidak bisa dijamin SETNX ketika
    // cadangan memori aktif, karena tiap instance punya memorinya sendiri.
    const attempts = Array.from({ length: 10 }, () =>
      pool
        .query(
          `INSERT INTO answers (session_id, room_code, player_id, question_id, choice, is_correct, points)
           VALUES ($1, $2, $3, $4, '1'::jsonb, true, 100)`,
          [sessionId, roomCode, playerId, question.id]
        )
        .then(() => 'ok')
        .catch((e) => (e.code === '23505' ? 'ditolak' : `galat:${e.code}`))
    );
    const outcome = await Promise.all(attempts);
    const accepted = outcome.filter((o) => o === 'ok').length;
    record(
      'Sepuluh jawaban serentak untuk soal yang sama: hanya satu tercatat',
      accepted === 1,
      `${accepted} tercatat, ${outcome.filter((o) => o === 'ditolak').length} ditolak`
    );
  }

  // ---- 4. penambahan skor tidak kehilangan pembaruan --------------
  {
    // Tiga puluh penambahan serentak, masing-masing 100 poin.
    // Baca-ubah-tulis pada satu gumpalan JSON akan kehilangan sebagian
    // besar di antaranya. Penambahan relatif tidak.
    await pool.query(`UPDATE room_players SET score = 0 WHERE id = $1`, [playerId]);
    await Promise.all(
      Array.from({ length: 30 }, () =>
        pool.query(`UPDATE room_players SET score = score + 100 WHERE id = $1`, [playerId])
      )
    );
    const { rows } = await pool.query(`SELECT score FROM room_players WHERE id = $1`, [playerId]);
    record(
      'Tiga puluh penambahan skor serentak: tidak ada yang hilang',
      rows[0].score === 3000,
      `skor akhir ${rows[0].score}, seharusnya 3000`
    );
  }

  // ---- 5. penguncian optimistis pada keadaan ruangan --------------
  {
    const { rows: [before] } = await pool.query(`SELECT version FROM rooms WHERE code = $1`, [roomCode]);
    // Dua host menekan "soal berikutnya" bersamaan dengan versi yang sama.
    const attempts = Array.from({ length: 8 }, () =>
      pool
        .query(
          `UPDATE rooms SET current_question_index = current_question_index + 1,
                            version = version + 1
           WHERE code = $1 AND version = $2 RETURNING version`,
          [roomCode, before.version]
        )
        .then((r) => (r.rowCount === 1 ? 'ok' : 'ditolak'))
    );
    const outcome = await Promise.all(attempts);
    const accepted = outcome.filter((o) => o === 'ok').length;
    record(
      'Delapan perpindahan soal serentak: hanya satu yang berlaku',
      accepted === 1,
      `${accepted} berlaku, ${outcome.filter((o) => o === 'ditolak').length} ditolak`
    );
  }

  // ---- 6. rentang nilai ditolak di tingkat basis data -------------
  {
    const checks = [
      ['rating di luar 1..5', `INSERT INTO quiz_ratings (quiz_id, user_id, rating) VALUES ('${quizId}', '${user.id}', 9)`],
      ['batas waktu soal 3 detik', `INSERT INTO questions (quiz_id, position, text, time_limit) VALUES ('${quizId}', 99, 'x', 3)`],
      ['visibilitas karangan', `INSERT INTO quizzes (id, host_id, title, visibility) VALUES ('${TAG}_bad', '${user.id}', 'x', 'semi-rahasia')`],
      ['kode ruangan huruf kecil', `INSERT INTO rooms (code, session_id, quiz_id, host_id) VALUES ('abc123', '${TAG}_s2', '${quizId}', '${user.id}')`],
    ];
    let rejected = 0;
    for (const [label, statement] of checks) {
      try {
        await pool.query(statement);
        console.log(`         catatan: "${label}" justru diterima`);
      } catch {
        rejected++;
      }
    }
    record('Nilai di luar batas ditolak database', rejected === checks.length, `${rejected}/${checks.length} ditolak`);
  }

  // ---- 7. penghapusan berantai -----------------------------------
  {
    await pool.query(`DELETE FROM rooms WHERE code = $1`, [roomCode]);
    const { rows } = await pool.query(
      `SELECT (SELECT count(*)::int FROM room_players WHERE room_code = $1) AS pemain,
              (SELECT count(*)::int FROM answers      WHERE room_code = $1) AS jawaban`,
      [roomCode]
    );
    record(
      'Menghapus ruangan ikut membersihkan peserta dan jawabannya',
      rows[0].pemain === 0 && rows[0].jawaban === 0,
      `sisa: ${rows[0].pemain} peserta, ${rows[0].jawaban} jawaban`
    );
  }

  // ---- bersih-bersih ---------------------------------------------
  await pool.query(`DELETE FROM users WHERE id = $1`, [user.id]);
  const { rows: [sisa] } = await pool.query(
    `SELECT (SELECT count(*)::int FROM quizzes  WHERE id = $1) AS kuis,
            (SELECT count(*)::int FROM questions WHERE quiz_id = $1) AS soal`,
    [quizId]
  );
  record(
    'Menghapus pengguna ikut membersihkan kuis dan soalnya',
    sisa.kuis === 0 && sisa.soal === 0,
    `sisa: ${sisa.kuis} kuis, ${sisa.soal} soal`
  );

  // ---- ringkasan --------------------------------------------------
  const lulus = results.filter((r) => r.passed).length;
  console.log(`\n${lulus}/${results.length} pembuktian lulus.\n`);
  if (lulus !== results.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('\nPembuktian terhenti:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
