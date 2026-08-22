#!/usr/bin/env node
/**
 * scripts/seed-bank.mjs — mengisi ulang bank soal.
 *
 * Alat operator, dijalankan dari baris perintah. Sengaja bukan endpoint
 * web: versi lama proyek ini menyediakan /api/admin/seed yang dijaga
 * kunci tertulis di dalam repositori publik, sehingga siapa pun yang
 * membaca repo bisa menimpa seluruh isi basis data.
 *
 *   npm run seed:bank            # tulis atau perbarui semua kuis
 *   npm run seed:bank -- --ukur  # hanya hitung ukurannya, tanpa menulis
 *
 * Penulisan bersifat idempoten: menjalankannya dua kali tidak
 * menggandakan apa pun, karena tiap kuis dan soal punya id tetap.
 */

import pg from 'pg';
import { sains } from '../db/seed-data/sains.mjs';
import { sosial } from '../db/seed-data/sosial.mjs';
import { bahasa } from '../db/seed-data/bahasa.mjs';
import { umum } from '../db/seed-data/umum.mjs';
import { lainnya } from '../db/seed-data/lainnya.mjs';

const SEMUA = [...sains, ...sosial, ...bahasa, ...umum, ...lainnya];

const PEMILIK_EMAIL = 'bank-soal@zynqio.app';
const PEMILIK_NAMA = 'Bank Soal ZYNQIO';

const hanyaUkur = process.argv.includes('--ukur');


/**
 * Mengacak urutan pilihan jawaban.
 *
 * Pada berkas sumber, jawaban benar selalu ditulis sebagai pilihan
 * pertama supaya mudah ditinjau manusia. Kalau urutan itu ikut masuk ke
 * basis data apa adanya, peserta yang menyadari polanya bisa menang
 * tanpa membaca satu soal pun.
 *
 * Pengacakannya memakai benih tetap yang diturunkan dari teks soal, jadi
 * hasilnya sama setiap kali skrip dijalankan. Tanpa itu, menjalankan
 * ulang penyemaian akan menggeser jawaban benar pada soal yang sedang
 * dipakai orang di kelas.
 */
function acakPilihan(teks, pilihan, indeksBenar) {
  // Benih sederhana dan stabil dari teks soal.
  let benih = 0;
  for (let i = 0; i < teks.length; i++) {
    benih = (benih * 31 + teks.charCodeAt(i)) >>> 0;
  }
  const acak = () => {
    benih = (benih * 1103515245 + 12345) >>> 0;
    return benih / 4294967296;
  };

  const jawabanBenar = pilihan[indeksBenar];
  const hasil = [...pilihan];

  for (let i = hasil.length - 1; i > 0; i--) {
    const j = Math.floor(acak() * (i + 1));
    [hasil[i], hasil[j]] = [hasil[j], hasil[i]];
  }

  return { pilihan: hasil, indeks: hasil.indexOf(jawabanBenar) };
}

/** Perkiraan ukuran muatan sebelum menyentuh basis data. */
function ukurMuatan() {
  let bytes = 0;
  let soal = 0;

  for (const kuis of SEMUA) {
    bytes += Buffer.byteLength(kuis.title + kuis.description + kuis.category, 'utf8');
    for (const q of kuis.questions) {
      soal++;
      bytes += Buffer.byteLength(q.t + JSON.stringify(q.o) + (q.e ?? ''), 'utf8');
      // Tiap baris Postgres membawa ongkos tetap: header baris, id, kolom
      // waktu, dan indeks. Angka ini perkiraan kasar yang sengaja
      // dilebihkan supaya hasilnya tidak terlalu optimistis.
      bytes += 180;
    }
  }
  return { bytes, soal, kuis: SEMUA.length };
}

async function main() {
  const ukuran = ukurMuatan();
  const mb = ukuran.bytes / 1024 / 1024;

  console.log(`\nBank soal ZYNQIO`);
  console.log(`  kuis            : ${ukuran.kuis}`);
  console.log(`  soal            : ${ukuran.soal}`);
  console.log(`  perkiraan ukuran: ${mb.toFixed(2)} MB`);
  console.log(`  batas yang diminta: 2,50 MB (1% dari kuota gratis Neon 250 MB)`);

  if (mb > 2.5) {
    console.error(`\n  Muatan melampaui batas. Penulisan dibatalkan.`);
    process.exitCode = 1;
    return;
  }
  console.log(`  status          : dalam batas\n`);

  if (hanyaUkur) {
    console.log('Mode ukur saja. Tidak ada yang ditulis ke basis data.\n');
    return;
  }

  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL belum diisi.');
    process.exitCode = 1;
    return;
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
    statement_timeout: 120_000,
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Pemilik bank soal. Tidak diberi kata sandi sama sekali — akun ini
    // hanya menampung kepemilikan kuis, dan tidak dimaksudkan untuk
    // dipakai masuk. Kolom password_hash yang NULL membuat jalur masuk
    // lewat kata sandi menolaknya dengan sendirinya.
    const { rows: [pemilik] } = await client.query(
      `INSERT INTO users (email, username, role)
       VALUES ($1, $2, 'user')
       ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
       RETURNING id`,
      [PEMILIK_EMAIL, PEMILIK_NAMA]
    );

    let kuisDitulis = 0;
    let soalDitulis = 0;

    for (const kuis of SEMUA) {
      const quizId = `bank_${kuis.id}`;

      await client.query(
        `INSERT INTO quizzes (id, host_id, title, description, author, category, visibility)
         VALUES ($1, $2, $3, $4, $5, $6, 'public')
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           category = EXCLUDED.category,
           visibility = 'public'`,
        [quizId, pemilik.id, kuis.title, kuis.description, PEMILIK_NAMA, kuis.category]
      );

      // Soal ditulis ulang seluruhnya agar urutannya selalu rapat dari
      // nol. Menambal satu per satu meninggalkan lubang pada kolom
      // position ketika sebuah soal dibuang, dan lubang itu membuat
      // permainan berhenti di tengah karena indeksnya tidak ketemu.
      await client.query(`DELETE FROM questions WHERE quiz_id = $1`, [quizId]);

      let posisi = 0;
      for (const q of kuis.questions) {
        const diacak = acakPilihan(q.t, q.o, q.a);
        await client.query(
          `INSERT INTO questions
             (quiz_id, position, type, text, options, correct_answer, explanation, points, time_limit)
           VALUES ($1, $2, 'MCQ', $3, $4::jsonb, $5::jsonb, $6, 100, 30)`,
          [
            quizId,
            posisi,
            q.t,
            JSON.stringify(diacak.pilihan),
            JSON.stringify(String(diacak.indeks)),
            q.e ?? null,
          ]
        );
        posisi++;
        soalDitulis++;
      }

      kuisDitulis++;
      process.stdout.write(`  ${String(kuisDitulis).padStart(2)}/${SEMUA.length}  ${kuis.title.slice(0, 46).padEnd(46)} ${posisi} soal\n`);
    }

    await client.query('COMMIT');

    // Ukuran sebenarnya di basis data, bukan perkiraan.
    const { rows: [nyata] } = await client.query(`
      SELECT pg_size_pretty(
               pg_total_relation_size('questions') + pg_total_relation_size('quizzes')
             ) AS ukuran,
             (pg_total_relation_size('questions') + pg_total_relation_size('quizzes'))::bigint AS bytes
    `);

    const { rows: [hitung] } = await client.query(`
      SELECT (SELECT count(*) FROM quizzes WHERE visibility = 'public')::int AS kuis,
             (SELECT count(*) FROM questions)::int AS soal
    `);

    console.log(`\nSelesai.`);
    console.log(`  kuis ditulis    : ${kuisDitulis}`);
    console.log(`  soal ditulis    : ${soalDitulis}`);
    console.log(`  kuis publik kini: ${hitung.kuis}`);
    console.log(`  total soal kini : ${hitung.soal}`);
    console.log(`  ukuran nyata di basis data: ${nyata.ukuran} (${(Number(nyata.bytes) / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`  porsi dari kuota 250 MB   : ${((Number(nyata.bytes) / 1024 / 1024 / 250) * 100).toFixed(2)}%\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\nPenyemaian gagal:', err.message);
  process.exitCode = 1;
});
