#!/usr/bin/env node
/**
 * scripts/verify-api.mjs — pembuktian di tingkat HTTP.
 *
 * verify-db.mjs membuktikan jaminan skema. Berkas ini membuktikan hal
 * yang berbeda dan sama pentingnya: bahwa jalan pintas yang dulu terbuka
 * memang sudah tertutup ketika diketuk lewat HTTP, persis seperti
 * penyerang akan melakukannya.
 *
 * Dijalankan terhadap peladen yang sedang hidup:
 *   node scripts/verify-api.mjs http://localhost:3000
 */

import pg from 'pg';

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

const results = [];

/**
 * Memanggil endpoint pendaftaran, menunggu bila pembatas laju menyala.
 *
 * Pendaftaran dijaga pembatas laju per alamat IP. Menjalankan berkas
 * ini tepat setelah verify-login.mjs membuat kuota itu sudah terpakai,
 * dan pemanggilan berikutnya dijawab 429. Tanpa penungguan, dua
 * pembuktian pendaftaran melaporkan GAGAL padahal yang terjadi justru
 * penjagaan bekerja sebagaimana mestinya.
 *
 * Yang tidak dilakukan di sini: menganggap 429 sebagai lulus. Kalau
 * setelah menunggu jawabannya masih 429, pembuktiannya tetap gagal,
 * karena sifat yang ingin dibuktikan memang belum terbukti.
 */
async function daftarSabar(opsi, percobaan = 4) {
  for (let i = 0; i < percobaan; i++) {
    const res = await call('/api/auth/signup', opsi);
    if (res.status !== 429) return res;
    await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
  }
  return call('/api/auth/signup', opsi);
}
function record(name, passed, detail) {
  results.push({ name, passed });
  console.log(`  ${passed ? 'LULUS' : 'GAGAL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function call(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

const TAG = `apitest_${Date.now()}`;
const pool = connectionString
  ? new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30_000 })
  : null;

async function main() {
  console.log(`\nPembuktian lapisan HTTP terhadap ${BASE}\n`);

  // ---- 1. endpoint yang dihapus benar-benar hilang -----------------
  {
    const gone = [];
    for (const path of ['/api/debug', '/api/admin/seed', '/api/setup']) {
      const res = await fetch(`${BASE}${path}`);
      if (res.status === 404) gone.push(path);
    }
    record(
      'Endpoint diagnostik dan penyemaian sudah tidak ada',
      gone.length === 3,
      `${gone.length}/3 menjawab 404`
    );
  }

  // ---- 2. kesehatan tidak membocorkan konfigurasi ------------------
  {
    const { status, body } = await call('/api/health');
    const text = JSON.stringify(body ?? {});
    const leaks = /NEXTAUTH|UPSTASH|REDIS|DATABASE_URL|PUSHER|GOOGLE_|region|engine/i.test(text);
    record(
      'Endpoint kesehatan tidak menyebut satu pun nama peubah lingkungan',
      status === 200 && !leaks,
      text.slice(0, 90)
    );
  }

  // ---- 3. katalog publik tidak membawa soal ------------------------
  {
    const { status, body } = await call('/api/quiz/public');
    const text = JSON.stringify(body ?? []);
    const hasQuestions = /"questions"|correctAnswer|correct_answer/i.test(text);
    record(
      'Katalog kuis publik tidak menyertakan soal maupun jawaban',
      status === 200 && !hasQuestions,
      `${Array.isArray(body) ? body.length : 0} kuis`
    );
  }

  // ---- 4. kuis publik terbaca tanpa kunci jawaban ------------------
  {
    const list = await call('/api/quiz/public');
    const first = Array.isArray(list.body) ? list.body[0] : null;

    if (!first) {
      record('Membaca kuis publik tanpa kunci jawaban', false, 'tidak ada kuis publik untuk diuji');
    } else {
      const { status, body } = await call(`/api/quiz/get?quizId=${encodeURIComponent(first.id)}`);
      const text = JSON.stringify(body ?? {});
      const leaked = /correctAnswer|correct_answer/i.test(text);
      record(
        'Kuis publik terbaca tanpa kunci jawaban, tanpa perlu masuk',
        status === 200 && !leaked && Array.isArray(body?.questions),
        leaked ? 'KUNCI JAWABAN BOCOR' : `${body?.questions?.length ?? 0} soal, tanpa kunci`
      );
    }
  }

  // ---- 5. kuis pribadi tidak terbaca orang lain --------------------
  if (pool) {
    const { rows: [owner] } = await pool.query(
      `INSERT INTO users (email, username) VALUES ($1, 'Pemilik Uji') RETURNING id`,
      [`${TAG}@example.test`]
    );
    const privateId = `quiz_${TAG}_rahasia`;
    await pool.query(
      `INSERT INTO quizzes (id, host_id, title, visibility) VALUES ($1, $2, 'Kuis Rahasia', 'private')`,
      [privateId, owner.id]
    );
    await pool.query(
      `INSERT INTO questions (quiz_id, position, text, options, correct_answer)
       VALUES ($1, 0, 'Rahasia?', '["a","b"]'::jsonb, '1'::jsonb)`,
      [privateId]
    );

    const { status, body } = await call(`/api/quiz/get?quizId=${encodeURIComponent(privateId)}`);
    record(
      'Kuis pribadi menjawab sama dengan kuis yang tidak ada',
      status === 404,
      `status ${status}${body?.error ? ` — ${body.error}` : ''}`
    );

    await pool.query(`DELETE FROM users WHERE id = $1`, [owner.id]);
  }

  // ---- 6. kendali ruangan menolak orang tanpa sesi -----------------
  {
    const checks = [
      ['start', '/api/room/start'],
      ['end', '/api/room/end'],
      ['soal berikutnya', '/api/room/next-question'],
      ['keluarkan peserta', '/api/room/kick'],
      ['ubah regu', '/api/room/update-teams'],
    ];

    let blocked = 0;
    for (const [label, path] of checks) {
      const { status } = await call(path, {
        method: 'POST',
        body: JSON.stringify({ roomCode: 'ABC234', playerId: 'x', teams: {} }),
      });
      // 401 berarti ditolak karena tanpa sesi. Itu yang diharapkan.
      if (status === 401) blocked++;
      else console.log(`         catatan: ${label} menjawab ${status}, bukan 401`);
    }
    record('Semua kendali host menolak pemanggil tanpa sesi', blocked === checks.length, `${blocked}/${checks.length}`);
  }

  // ---- 7. jawaban tanpa token peserta ditolak ----------------------
  {
    const { status } = await call('/api/answer/submit', {
      method: 'POST',
      body: JSON.stringify({ roomCode: 'ABC234', questionId: 'x', selectedAnswer: '1' }),
    });
    record('Pengiriman jawaban tanpa token peserta ditolak', status === 401, `status ${status}`);
  }

  // ---- 8. peti tanpa token ditolak ---------------------------------
  {
    const { status } = await call('/api/room/select-chest', {
      method: 'POST',
      body: JSON.stringify({ roomCode: 'ABC234' }),
    });
    record('Pengambilan peti tanpa token peserta ditolak', status === 401, `status ${status}`);
  }

  // ---- 9. jejak kejadian tidak terbuka untuk peserta ---------------
  {
    const { status } = await call('/api/room/get-logs?roomCode=ABC234');
    record('Jejak kejadian ruangan tertutup bagi non-host', status === 401, `status ${status}`);
  }

  // ---- 10. daftar dan pembuatan kuis menuntut akun -----------------
  {
    const list = await call('/api/quiz/list');
    const create = await call('/api/quiz/create', {
      method: 'POST',
      body: JSON.stringify({ title: 'Kuis Selundupan' }),
    });
    const rate = await call('/api/quiz/rate', {
      method: 'POST',
      body: JSON.stringify({ quizId: 'x', rating: 5 }),
    });
    const history = await call('/api/player/history');

    const all = [list.status, create.status, rate.status, history.status];
    record(
      'Daftar, pembuatan, penilaian, dan riwayat menuntut akun',
      all.every((s) => s === 401),
      `status: ${all.join(', ')}`
    );
  }

  // ---- 11. kode ruangan cacat ditolak sebelum menyentuh basis data --
  {
    const bad = ['abc', 'ABCDEFG', "'; DROP TABLE rooms; --", ''];
    let rejected = 0;
    for (const code of bad) {
      const { status } = await call(`/api/room/state?roomCode=${encodeURIComponent(code)}`);
      if (status === 400) rejected++;
    }
    record('Kode ruangan cacat ditolak sebagai permintaan tidak sah', rejected === bad.length, `${rejected}/${bad.length}`);
  }

  // ---- 12. pendaftaran tidak membocorkan email yang terdaftar ------
  {
    const email = `${TAG}_daftar@example.test`;
    const first = await daftarSabar({
      method: 'POST',
      body: JSON.stringify({ email, username: 'Penguji', password: 'katasandi-panjang' }),
    });
    const second = await daftarSabar({
      method: 'POST',
      body: JSON.stringify({ email, username: 'Penguji', password: 'katasandi-panjang' }),
    });
    record(
      'Pendaftaran ulang email yang sama tidak dibedakan tanggapannya',
      first.status === second.status && first.status === 200,
      `pertama ${first.status}, kedua ${second.status}`
    );

    const short = await daftarSabar({
      method: 'POST',
      body: JSON.stringify({ email: `${TAG}_pendek@example.test`, username: 'X', password: 'abc123' }),
    });
    record('Kata sandi pendek ditolak', short.status === 400, `status ${short.status}`);

    if (pool) await pool.query(`DELETE FROM users WHERE email = $1`, [email]);
  }

  // ---- halaman terlindungi mengalihkan, bukan runtuh ----------------
  //
  // Ditambahkan setelah menemukan bahwa withAuth dari next-auth v4
  // runtuh di runtime edge Next.js 16 dengan "_server is not defined".
  // Akibatnya /dashboard, /create, dan /host menjawab 500 kepada siapa
  // pun — bukan menolak masuk, melainkan galat peladen — dan tidak ada
  // satu pun pembuktian yang menangkapnya karena semuanya menguji API,
  // bukan halaman.
  {
    const terlindungi = ['/dashboard', '/create', '/host/ZZZZZZ'];
    const hasil = [];
    for (const lintasan of terlindungi) {
      const res = await fetch(`${BASE}${lintasan}`, { redirect: 'manual' });
      hasil.push({ lintasan, status: res.status, tujuan: res.headers.get('location') ?? '' });
    }

    const semuaMengalihkan = hasil.every(
      (h) => h.status >= 300 && h.status < 400 && h.tujuan.includes('/auth/signin')
    );
    record(
      'Halaman terlindungi mengalihkan ke masuk, bukan menjawab galat',
      semuaMengalihkan,
      hasil.map((h) => `${h.lintasan} ${h.status}`).join(', ')
    );

    // Alamat asal ikut dibawa, supaya orang kembali ke tempat yang
    // tadi ia tuju setelah berhasil masuk.
    const membawaTujuan = hasil.every((h) => h.tujuan.includes('callbackUrl='));
    record(
      'Alamat yang dituju dibawa serta ke halaman masuk',
      membawaTujuan,
      hasil[0]?.tujuan?.slice(-46) ?? '-'
    );
  }

  // ---- rekomendasi tidak pernah menyebut kuis pribadi ---------------
  //
  // Endpoint ini terbuka tanpa perlu masuk. Kalau penyaring visibility
  // pernah lepas, judul kuis pribadi milik guru lain akan muncul di
  // sini kepada siapa pun yang memanggilnya.
  {
    const res = await fetch(`${BASE}/api/quiz/recommend`);
    const d = await res.json().catch(() => ({}));
    const daftar = d.quizzes ?? [];
    const adaPribadi = daftar.some(
      (q) => q.visibility === 'private' || q.status === 'private'
    );
    record(
      'Rekomendasi terbuka tidak pernah menyebut kuis pribadi',
      res.status === 200 && !adaPribadi,
      `${daftar.length} kuis, semuanya publik`
    );
  }

  // ---- hasil sesi tidak membawa kunci maupun token ------------------
  {
    const res = await fetch(`${BASE}/api/room/results?sessionId=tidak-ada-sesi-ini`);
    const teks = JSON.stringify(await res.json().catch(() => ({})));
    const bocor = /correctAnswer|correct_answer|playerToken|token_hash|password/i.test(teks);
    record(
      'Hasil sesi tidak pernah membawa kunci jawaban atau token',
      !bocor,
      bocor ? 'BOCOR' : `status ${res.status}, bersih`
    );
  }

  // ---- ringkasan ---------------------------------------------------
  const lulus = results.filter((r) => r.passed).length;
  console.log(`\n${lulus}/${results.length} pembuktian lulus.\n`);
  if (lulus !== results.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('\nPembuktian terhenti:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool?.end());
