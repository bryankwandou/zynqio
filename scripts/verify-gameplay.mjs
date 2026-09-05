#!/usr/bin/env node
/**
 * scripts/verify-gameplay.mjs — pembuktian alur permainan dari ujung ke ujung.
 *
 * verify-api.mjs membuktikan pintu-pintu yang tertutup. Berkas ini
 * membuktikan yang sebaliknya: bahwa jalur yang memang harus terbuka
 * benar-benar berjalan sampai selesai, dan skornya benar.
 *
 * Sisi host disiapkan langsung lewat basis data, karena membuat sesi
 * NextAuth dari skrip menuntut memalsukan kuki yang ditandatangani —
 * dan kemampuan itu justru yang tidak boleh dimiliki siapa pun. Sisi
 * peserta dijalankan sepenuhnya lewat HTTP, persis seperti peramban.
 *
 *   node scripts/verify-gameplay.mjs https://zynqio.vercel.app
 */

import pg from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

const hasil = [];
function catat(nama, lulus, rinci) {
  hasil.push({ nama, lulus });
  console.log(`  ${lulus ? 'LULUS' : 'GAGAL'}  ${nama}${rinci ? ` — ${rinci}` : ''}`);
}

async function panggil(path, opsi = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opsi,
    headers: { 'Content-Type': 'application/json', ...(opsi.headers || {}) },
  });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

const TAG = Date.now().toString(36).toUpperCase().slice(-4);
const KODE = `T${TAG}Z`.toUpperCase().slice(0, 6).padEnd(6, 'X');

async function main() {
  console.log(`\nPembuktian alur permainan terhadap ${BASE}\n`);

  if (!connectionString) {
    console.error('DATABASE_URL belum diisi.');
    process.exitCode = 1;
    return;
  }

  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30_000 });
  const sesiId = `sesi_uji_${TAG}`;
  let hostId = null;

  try {
    // ---- persiapan: host, kuis, dan ruangan yang sedang berjalan ----
    const { rows: [host] } = await pool.query(
      `INSERT INTO users (email, username) VALUES ($1, 'Host Uji') RETURNING id`,
      [`gameplay_${TAG}@example.test`]
    );
    hostId = host.id;

    const quizId = `quiz_uji_${TAG}`;
    await pool.query(
      `INSERT INTO quizzes (id, host_id, title, visibility, category)
       VALUES ($1, $2, 'Kuis Uji Alur', 'public', 'Umum')`,
      [quizId, hostId]
    );

    // Dua soal: satu untuk dijawab benar, satu untuk dijawab salah.
    const { rows: soal } = await pool.query(
      `INSERT INTO questions (quiz_id, position, type, text, options, correct_answer, points, time_limit)
       VALUES
         ($1, 0, 'MCQ', 'Ibu kota Indonesia?', '["Jakarta","Bandung","Surabaya","Medan"]'::jsonb, '"0"'::jsonb, 100, 30),
         ($1, 1, 'MCQ', 'Dua tambah dua?', '["3","4","5","6"]'::jsonb, '"1"'::jsonb, 100, 30)
       RETURNING id, position`,
      [quizId]
    );
    const soal0 = soal.find((s) => s.position === 0);
    const soal1 = soal.find((s) => s.position === 1);

    await pool.query(
      `INSERT INTO rooms (code, session_id, quiz_id, host_id, status, game_mode,
                          current_question_index, question_started_at, expires_at)
       VALUES ($1, $2, $3, $4, 'waiting', 'classic', 0, NULL, now() + interval '2 hours')`,
      [KODE, sesiId, quizId, hostId]
    );

    console.log(`  (ruangan uji ${KODE} disiapkan, 2 soal)\n`);

    // ---- 1. peserta bergabung lewat HTTP -----------------------------
    const gabung = await panggil('/api/room/join', {
      method: 'POST',
      body: JSON.stringify({ roomCode: KODE, playerName: 'Peserta Uji', avatarId: 'fox' }),
    });
    const token = gabung.body?.playerToken;
    const playerId = gabung.body?.player?.id;
    catat('Peserta dapat bergabung dan menerima token', gabung.status === 200 && !!token, `status ${gabung.status}`);

    if (!token) throw new Error('token peserta tidak diterbitkan, pembuktian tidak bisa dilanjutkan');

    // Bergabung sengaja hanya dibuka selagi ruangan menunggu. Peserta
    // yang terputus di tengah permainan tidak mendaftar ulang, melainkan
    // memulihkan sesinya lewat token yang sudah ia pegang.
    {
      // Nama yang sudah dipakai tidak menolak peserta, melainkan
      // dibedakan otomatis. Keunikannya ditegakkan indeks basis data,
      // jadi dua orang yang menekan tombol pada detik yang sama tidak
      // bisa keduanya masuk dengan nama yang sama persis.
      const kembar = await panggil('/api/room/join', {
        method: 'POST',
        body: JSON.stringify({ roomCode: KODE, playerName: 'Peserta Uji', avatarId: 'cat' }),
      });
      catat(
        'Peserta bernama sama tetap bisa masuk dengan nama dibedakan',
        kembar.status === 200 && !!kembar.body?.player?.name && kembar.body.player.name !== 'Peserta Uji',
        `menjadi "${kembar.body?.player?.name}"`
      );

      const terlambat = await panggil('/api/room/join', {
        method: 'POST',
        body: JSON.stringify({ roomCode: KODE, playerName: 'Penyelinap' }),
      });
      await pool.query(`UPDATE rooms SET status = 'playing', question_started_at = now() WHERE code = $1`, [KODE]);
      const setelahMulai = await panggil('/api/room/join', {
        method: 'POST',
        body: JSON.stringify({ roomCode: KODE, playerName: 'Penyelinap Kedua' }),
      });
      catat(
        'Bergabung ditutup setelah permainan dimulai',
        terlambat.status === 200 && setelahMulai.status === 409,
        `sebelum mulai ${terlambat.status}, sesudah mulai ${setelahMulai.status}`
      );
    }

    // ---- 2. token tidak pernah muncul di keadaan ruangan --------------
    {
      const st = await panggil(`/api/room/state?roomCode=${KODE}`);
      const teks = JSON.stringify(st.body ?? {});
      catat(
        'Keadaan ruangan tidak memuat token peserta mana pun',
        st.status === 200 && !teks.includes(token),
        teks.includes(token) ? 'TOKEN BOCOR' : 'bersih'
      );

      // ---- 3. soal yang dikirim ke peserta tanpa kunci jawaban --------
      const bocor = /correctAnswer|correct_answer/i.test(teks);
      catat(
        'Soal berjalan dikirim tanpa kunci jawaban',
        st.body?.question && !bocor,
        bocor ? 'KUNCI BOCOR' : `soal: "${st.body?.question?.text ?? '-'}"`
      );

      // ---- 4. hanya satu soal yang menyeberang ------------------------
      catat(
        'Hanya soal yang sedang berjalan yang dikirim, bukan seluruh kuis',
        !Array.isArray(st.body?.questions),
        `totalQuestions dilaporkan ${st.body?.totalQuestions}`
      );
    }

    // ---- 5. verifikasi sesi lewat /api/room/me ------------------------
    {
      const me = await panggil('/api/room/me', {
        method: 'POST',
        body: JSON.stringify({ roomCode: KODE, playerToken: token }),
      });
      catat('Peserta dapat memverifikasi sesinya sendiri', me.status === 200 && me.body?.player?.id === playerId, `status ${me.status}`);

      const palsu = await panggil('/api/room/me', {
        method: 'POST',
        body: JSON.stringify({ roomCode: KODE, playerToken: 'token-karangan' }),
      });
      catat('Token karangan ditolak', palsu.status === 401, `status ${palsu.status}`);
    }

    // ---- 6. jawaban benar dinilai server ------------------------------
    const jawab1 = await panggil('/api/answer/submit', {
      method: 'POST',
      body: JSON.stringify({ roomCode: KODE, playerToken: token, questionId: soal0.id, selectedAnswer: '0' }),
    });
    // Batas atas ikut diperiksa. Tanpa itu, bug pengali skor yang membuat
    // satu soal bernilai puluhan ribu poin lolos begitu saja, karena
    // angka sebesar apa pun tetap "lebih besar dari nol".
    catat(
      'Jawaban benar dinilai benar dengan poin yang masuk akal',
      jawab1.status === 200 &&
        jawab1.body?.correct === true &&
        jawab1.body?.sessionScore > 0 &&
        jawab1.body?.sessionScore <= 1000,
      `skor sesi ${jawab1.body?.sessionScore} (batas wajar 1000), total ${jawab1.body?.totalScore}`
    );

    // ---- 7. tanggapan tidak membocorkan kunci -------------------------
    catat(
      'Tanggapan jawaban tidak menyertakan kunci jawaban',
      !/correctAnswer|correct_answer/i.test(JSON.stringify(jawab1.body ?? {})),
      Object.keys(jawab1.body ?? {}).join(', ')
    );

    // ---- 8. jawaban kedua untuk soal sama ditolak ---------------------
    const jawabUlang = await panggil('/api/answer/submit', {
      method: 'POST',
      body: JSON.stringify({ roomCode: KODE, playerToken: token, questionId: soal0.id, selectedAnswer: '0' }),
    });
    catat('Menjawab soal yang sama dua kali ditolak', jawabUlang.status === 409, `status ${jawabUlang.status}`);

    // ---- 9. sepuluh pengiriman serentak hanya satu yang tercatat ------
    {
      await pool.query(`UPDATE rooms SET current_question_index = 1, question_started_at = now() WHERE code = $1`, [KODE]);

      const serentak = await Promise.all(
        Array.from({ length: 10 }, () =>
          panggil('/api/answer/submit', {
            method: 'POST',
            body: JSON.stringify({ roomCode: KODE, playerToken: token, questionId: soal1.id, selectedAnswer: '1' }),
          })
        )
      );
      const diterima = serentak.filter((r) => r.status === 200).length;
      catat('Sepuluh pengiriman serentak hanya satu yang tercatat', diterima === 1, `${diterima} diterima, ${10 - diterima} ditolak`);
    }

    // ---- 10. skor di basis data cocok dengan yang dilaporkan ----------
    {
      const { rows: [p] } = await pool.query(
        `SELECT score, total_answered, total_correct FROM room_players WHERE id = $1`,
        [playerId]
      );
      const { rows: [a] } = await pool.query(
        `SELECT count(*)::int AS n FROM answers WHERE player_id = $1`,
        [playerId]
      );
      catat(
        'Skor tersimpan konsisten dengan jumlah jawaban',
        p && a.n === 2 && p.total_answered === 2 && p.total_correct === 2,
        `skor ${p?.score}, dijawab ${p?.total_answered}, benar ${p?.total_correct}, baris jawaban ${a.n}`
      );
    }

    // ---- 11. riwayat per-soal tidak menyeberang ke peserta ------------
    //
    // Layar guru menerima riwayat jawaban tiap peserta supaya kisi
    // berwarnanya tetap utuh setelah halaman dimuat ulang. Riwayat itu
    // memuat penanda benar-salah untuk tiap soal yang sudah dijawab.
    //
    // Peserta memanggil route yang sama. Kalau riwayatnya ikut berangkat
    // ke mereka, seorang murid bisa membaca soal mana yang dijawab benar
    // oleh temannya — dan pada mode Klasik, tempat setiap orang berjalan
    // di soal berbeda, itu berarti kunci jawaban soal yang belum ia
    // kerjakan. Pemeriksaan ini berjalan setelah dua jawaban tercatat,
    // jadi riwayat yang bocor pasti terlihat.
    {
      const st = await panggil(`/api/room/state?roomCode=${KODE}`);
      const daftar = st.body?.players ?? [];
      const adaRiwayat = daftar.some(
        (p) => p.answerHistory && Object.keys(p.answerHistory).length > 0
      );
      const teks = JSON.stringify(st.body ?? {});
      const adaPenanda = /"status"\s*:\s*"(correct|wrong)"/i.test(teks);
      catat(
        'Riwayat per-soal tidak dikirim ke peserta',
        !adaRiwayat && !adaPenanda,
        adaRiwayat || adaPenanda ? 'RIWAYAT BOCOR' : `${daftar.length} peserta, riwayat kosong`
      );
    }

    // ---- 11b. guru justru harus menerimanya --------------------------
    //
    // Pemeriksaan di atas hanya membuktikan riwayatnya tidak bocor. Kalau
    // berhenti di situ, cara termudah untuk lulus adalah tidak pernah
    // mengirimkannya kepada siapa pun — dan kisi berwarna di layar guru
    // tetap kosong seperti semula. Jadi sisi sebaliknya ikut dibuktikan:
    // guru yang sah menerima riwayat kedua soal yang sudah dijawab.
    {
      const sandi = `Uji-${TAG}-${crypto.randomBytes(4).toString('hex')}!`;
      await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
        await bcrypt.hash(sandi, 10),
        hostId,
      ]);
      const { rows: [u] } = await pool.query(`SELECT email FROM users WHERE id = $1`, [hostId]);

      const kuki = {};
      const pungut = (res) => {
        for (const b of res.headers.getSetCookie?.() ?? []) {
          const [pasangan] = b.split(';');
          const i = pasangan.indexOf('=');
          if (i > 0) kuki[pasangan.slice(0, i).trim()] = pasangan.slice(i + 1).trim();
        }
      };
      const rangkai = () => Object.entries(kuki).map(([k, v]) => `${k}=${v}`).join('; ');

      const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
      pungut(csrfRes);
      const { csrfToken } = await csrfRes.json();
      const masuk = await fetch(`${BASE}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: rangkai() },
        body: new URLSearchParams({ email: u.email, password: sandi, csrfToken, json: 'true' }),
        redirect: 'manual',
      });
      pungut(masuk);

      const st = await panggil(`/api/room/state?roomCode=${KODE}`, { headers: { Cookie: rangkai() } });
      const punyaRiwayat = (st.body?.players ?? []).some(
        (p) => p.answerHistory && Object.keys(p.answerHistory).length === 2
      );
      catat(
        'Guru menerima riwayat per-soal setelah memuat ulang',
        st.body?.isHost === true && punyaRiwayat,
        `isHost=${st.body?.isHost}, riwayat ${(st.body?.players ?? []).map((p) => Object.keys(p.answerHistory ?? {}).length).join('/')}`
      );
    }

    // ---- 12. peserta yang dikeluarkan kehilangan aksesnya -------------
    {
      await pool.query(`UPDATE room_players SET is_kicked = true WHERE id = $1`, [playerId]);
      const setelahKick = await panggil('/api/room/me', {
        method: 'POST',
        body: JSON.stringify({ roomCode: KODE, playerToken: token }),
      });
      catat(
        'Peserta yang dikeluarkan langsung kehilangan akses',
        setelahKick.status === 403,
        `status ${setelahKick.status} — ${setelahKick.body?.error ?? ''}`
      );
    }

    // ---- 13. papan peringkat tidak memuat yang dikeluarkan ------------
    {
      const st = await panggil(`/api/room/state?roomCode=${KODE}`);
      const adaYangDikick = (st.body?.players ?? []).some((p) => p.id === playerId);
      catat('Peserta yang dikeluarkan tidak muncul di daftar peserta', !adaYangDikick, `${st.body?.players?.length ?? 0} peserta terdaftar`);
    }
  } finally {
    // Semua jejak uji dibersihkan. Penghapusan berjenjang di skema ikut
    // membuang ruangan, peserta, jawaban, dan soalnya.
    await pool.query(`DELETE FROM rooms WHERE code = $1`, [KODE]).catch(() => {});
    if (hostId) await pool.query(`DELETE FROM users WHERE id = $1`, [hostId]).catch(() => {});
    await pool.end();
  }

  const lulus = hasil.filter((r) => r.lulus).length;
  console.log(`\n${lulus}/${hasil.length} pembuktian lulus.\n`);
  if (lulus !== hasil.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nPembuktian terhenti:', err.message);
  process.exitCode = 1;
});
