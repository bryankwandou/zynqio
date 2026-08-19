#!/usr/bin/env node
/**
 * scripts/seed.mjs — mengisi kuis contoh.
 *
 * Dulu ini berupa endpoint POST /api/admin/seed yang dijaga satu kunci
 * tetap, "zynqio-seed-2026", yang tertulis langsung di berkas sumber pada
 * repositori publik. Artinya penjaganya tidak menjaga apa pun: siapa saja
 * yang membaca repositori bisa menulis ke basis data produksi.
 *
 * Mengisi data contoh adalah pekerjaan operator, bukan permintaan web.
 * Bentuknya sekarang skrip yang dijalankan orang yang sudah memegang
 * kredensial basis data — jadi tidak perlu penjaga tambahan sama sekali.
 *
 * Pakai:
 *   node scripts/seed.mjs --email demo@zynqio.app
 */

import pg from 'pg';
import { randomUUID } from 'node:crypto';

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL belum diisi.');
  process.exit(1);
}

const emailArg = process.argv.indexOf('--email');
const OWNER_EMAIL = emailArg > -1 ? process.argv[emailArg + 1] : 'demo@zynqio.app';

const QUIZZES = [
  {
    slug: 'umum-001', title: 'Pengetahuan Umum Kilat', category: 'Umum',
    description: 'Delapan pertanyaan pemanasan untuk membuka sesi.',
    questions: [
      ['Apa ibu kota Prancis?', ['Berlin', 'London', 'Paris', 'Roma'], 2, 30],
      ['Planet mana yang dijuluki Planet Merah?', ['Venus', 'Mars', 'Jupiter', 'Saturnus'], 1, 30],
      ['Berapa hasil 7 × 8?', ['54', '56', '58', '60'], 1, 20],
      ['Siapa pelukis Mona Lisa?', ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Donatello'], 2, 30],
      ['Apa lambang kimia air?', ['H2O', 'CO2', 'NaCl', 'O2'], 0, 20],
      ['Ada berapa benua di bumi?', ['5', '6', '7', '8'], 2, 20],
      ['Samudra terluas di dunia adalah?', ['Atlantik', 'Hindia', 'Arktik', 'Pasifik'], 3, 20],
      ['Perang Dunia II berakhir pada tahun?', ['1943', '1944', '1945', '1946'], 2, 30],
    ],
  },
  {
    slug: 'teknologi-001', title: 'Dasar Teknologi dan Pemrograman', category: 'Teknologi',
    description: 'Istilah yang sering muncul di kelas pengantar informatika.',
    questions: [
      ['HTML adalah singkatan dari?', ['HyperText Markup Language', 'High Tech Modern Language', 'Hyper Transfer Markup Logic', 'HyperText Machine Learning'], 0, 30],
      ['Bahasa apa yang dipakai menata tampilan halaman web?', ['JavaScript', 'Python', 'CSS', 'SQL'], 2, 20],
      ['CPU adalah singkatan dari?', ['Central Processing Unit', 'Computer Personal Unit', 'Core Processing Utility', 'Central Power Unit'], 0, 20],
      ['Perusahaan mana yang melahirkan bahasa JavaScript?', ['Microsoft', 'Google', 'Netscape', 'Apple'], 2, 30],
      ['Di JavaScript, typeof null menghasilkan?', ['null', 'undefined', 'object', 'string'], 2, 30],
      ['API adalah singkatan dari?', ['Application Programming Interface', 'Automated Program Integration', 'Advanced Processing Interface', 'Application Protocol Index'], 0, 20],
    ],
  },
  {
    slug: 'sains-001', title: 'Adu Cepat Sains', category: 'Sains',
    description: 'Fisika, biologi, dan kimia tingkat sekolah menengah.',
    questions: [
      ['Berapa kecepatan cahaya kira-kira?', ['300.000 km/detik', '150.000 km/detik', '500.000 km/detik', '1.000.000 km/detik'], 0, 30],
      ['Gas apa yang diserap tumbuhan saat fotosintesis?', ['Oksigen', 'Nitrogen', 'Karbon dioksida', 'Hidrogen'], 2, 20],
      ['Berapa nomor atom karbon?', ['4', '6', '8', '12'], 1, 20],
      ['Organ apa yang memompa darah?', ['Hati', 'Otak', 'Paru-paru', 'Jantung'], 3, 20],
      ['Hukum pertama Newton berbicara tentang?', ['Gravitasi', 'Inersia', 'Percepatan', 'Gesekan'], 1, 30],
      ['Planet dengan satelit alami terbanyak adalah?', ['Jupiter', 'Saturnus', 'Uranus', 'Neptunus'], 1, 30],
    ],
  },
  {
    slug: 'matematika-001', title: 'Tantangan Matematika', category: 'Matematika',
    description: 'Hitungan cepat tanpa kalkulator.',
    questions: [
      ['Berapa nilai π sampai dua angka di belakang koma?', ['3,12', '3,14', '3,16', '3,18'], 1, 20],
      ['Berapa akar kuadrat dari 144?', ['11', '12', '13', '14'], 1, 20],
      ['Selesaikan 2x + 4 = 12. Berapa x?', ['2', '3', '4', '5'], 2, 30],
      ['Berapa 15% dari 200?', ['25', '30', '35', '40'], 1, 20],
      ['Luas lingkaran berjari-jari 5 (π ≈ 3,14) adalah?', ['78,5', '31,4', '62,8', '25'], 0, 30],
      ['Berapa hasil 2 pangkat 10?', ['512', '1024', '2048', '256'], 1, 20],
    ],
  },
  {
    slug: 'sejarah-001', title: 'Menyusuri Sejarah', category: 'Sejarah',
    description: 'Peristiwa dan tokoh yang membentuk dunia modern.',
    questions: [
      ['Revolusi Prancis dimulai pada tahun?', ['1776', '1789', '1804', '1815'], 1, 30],
      ['Siapa presiden pertama Amerika Serikat?', ['Thomas Jefferson', 'John Adams', 'George Washington', 'Benjamin Franklin'], 2, 20],
      ['Tembok Besar Tiongkok terutama dibangun menahan serangan siapa?', ['Persia', 'Romawi', 'Mongol', 'Turki'], 2, 30],
      ['Revolusi Industri bermula di negara mana?', ['Prancis', 'Jerman', 'Amerika Serikat', 'Inggris'], 3, 30],
      ['Siapa penulis Manifesto Komunis?', ['Lenin', 'Stalin', 'Marx dan Engels', 'Trotsky'], 2, 20],
      ['Proklamasi kemerdekaan Indonesia dibacakan pada tahun?', ['1942', '1945', '1949', '1950'], 1, 20],
    ],
  },
  {
    slug: 'permainan-001', title: 'Trivia Dunia Gim', category: 'Permainan',
    description: 'Untuk kelas yang butuh pemecah suasana.',
    questions: [
      ['Gim mana yang menampilkan tokoh bernama Master Chief?', ['Call of Duty', 'Halo', 'Doom', 'Battlefield'], 1, 20],
      ['Gim terlaris sepanjang masa adalah?', ['Tetris', 'GTA V', 'Minecraft', 'Mario Kart'], 2, 30],
      ['PlayStation pertama dirilis di Jepang pada tahun?', ['1992', '1993', '1994', '1995'], 2, 30],
      ['Gim mana yang mempopulerkan genre battle royale?', ['Fortnite', 'PUBG', 'H1Z1', 'Warzone'], 1, 20],
      ['Seri gim mana yang menampilkan Link dan Zelda?', ['Final Fantasy', 'Fire Emblem', 'The Legend of Zelda', 'Skyrim'], 2, 20],
      ['Dalam gim RPG, HP adalah singkatan dari?', ['High Power', 'Hit Points', 'Hero Points', 'Health Percentage'], 1, 20],
    ],
  },
];

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30_000,
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [owner] } = await client.query(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, 'Tim Zynqio', NULL)
       ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
       RETURNING id, email`,
      [OWNER_EMAIL]
    );

    console.log(`Pemilik kuis contoh: ${owner.email}`);
    console.log('Akun ini tanpa kata sandi. Pakai alur "lupa kata sandi" bila ingin memakainya.\n');

    let totalQuestions = 0;

    for (const quiz of QUIZZES) {
      const quizId = `quiz_demo_${quiz.slug}`;

      await client.query(
        `INSERT INTO quizzes (id, host_id, title, description, author, category, visibility)
         VALUES ($1, $2, $3, $4, 'Tim Zynqio', $5, 'public')
         ON CONFLICT (id) DO UPDATE
           SET title = EXCLUDED.title,
               description = EXCLUDED.description,
               category = EXCLUDED.category,
               visibility = EXCLUDED.visibility`,
        [quizId, owner.id, quiz.title, quiz.description, quiz.category]
      );

      // Soal ditulis ulang seluruhnya supaya urutan dan isinya pasti
      // sesuai berkas ini, bukan campuran dengan sisa penyemaian lama.
      await client.query('DELETE FROM questions WHERE quiz_id = $1', [quizId]);

      for (const [index, [text, options, correctIndex, timeLimit]] of quiz.questions.entries()) {
        await client.query(
          `INSERT INTO questions (quiz_id, position, type, text, options, correct_answer, points, time_limit)
           VALUES ($1, $2, 'MCQ', $3, $4::jsonb, $5::jsonb, 1, $6)`,
          [quizId, index, text, JSON.stringify(options), JSON.stringify(String(correctIndex)), timeLimit]
        );
      }

      totalQuestions += quiz.questions.length;
      console.log(`  ${quiz.title} — ${quiz.questions.length} soal`);
    }

    await client.query('COMMIT');
    console.log(`\n${QUIZZES.length} kuis, ${totalQuestions} soal tersimpan.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error('Penyemaian gagal:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
