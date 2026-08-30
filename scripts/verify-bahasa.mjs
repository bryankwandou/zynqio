/**
 * scripts/verify-bahasa.mjs — membuktikan tombol bahasa benar-benar
 * mengubah layar tempat ia berada.
 *
 * Cacat yang membuat pemeriksaan ini ada: tombol pengalih dipasang di
 * AuthShell dan AppShell sejak awal, sehingga ia tampil di halaman
 * masuk, daftar, dan seluruh halaman guru — tetapi tidak satu pun dari
 * halaman itu membaca kamus. Menekannya mengubah label ID menjadi EN,
 * mengubah atribut lang, lalu tidak menggerakkan satu kata pun di
 * layar. Empat puluh delapan pembuktian lain lulus sementara itu
 * terjadi, karena semuanya hanya memeriksa halaman depan.
 *
 * Aturannya sederhana dan bisa diperiksa mesin: berkas yang menampilkan
 * TombolBahasa — atau memakai kerangka yang menampilkannya — harus
 * memakai kamus. Tombol yang tidak mengubah apa pun adalah tombol
 * rusak, sebaik apa pun halaman lain bekerja.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const AKAR = ['app', 'components'];
let lulus = 0;
let gagal = 0;

/** Jalur Windows dirapikan supaya laporannya terbaca sama di mana pun. */
const rapikan = (b) => b.split(sep).join('/');

const catat = (ok, judul, ket) => {
  console.log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${judul}${ket ? ' — ' + ket : ''}`);
  ok ? lulus++ : gagal++;
};

function telusuri(dir, keluar = []) {
  for (const nama of readdirSync(dir)) {
    const penuh = join(dir, nama);
    if (statSync(penuh).isDirectory()) telusuri(penuh, keluar);
    else if (nama.endsWith('.tsx')) keluar.push(penuh);
  }
  return keluar;
}

const berkas = AKAR.flatMap((a) => telusuri(a));
const isi = new Map(berkas.map((b) => [b, readFileSync(b, 'utf8')]));

// ── 1. Kerangka mana yang memasang tombolnya ────────────────────────
const kerangkaBertombol = berkas.filter(
  (b) => b.includes('components') && isi.get(b).includes('<TombolBahasa')
);
catat(
  kerangkaBertombol.length > 0,
  'Tombol bahasa terpasang di kerangka bersama',
  kerangkaBertombol.map((b) => b.split(/[\/]/).pop()).join(', ')
);

// ── 2. Halaman yang memakai kerangka itu harus memakai kamus ────────
const namaKerangka = kerangkaBertombol.map((b) => rapikan(b).split('/').pop().replace('.tsx', ''));
const halamanTerpengaruh = berkas.filter((b) => {
  const t = isi.get(b);
  if (!b.includes('page.tsx')) return false;
  return namaKerangka.some((k) => t.includes(`from '@/components/${k}'`) || t.includes(`from "@/components/${k}"`));
});

const buta = halamanTerpengaruh.filter((b) => !isi.get(b).includes('useBahasa'));
catat(
  buta.length === 0,
  'Setiap halaman yang menampilkan tombol bahasa membaca kamus',
  buta.length ? `${buta.length} halaman tidak: ${buta.map(rapikan).join(', ')}` : `${halamanTerpengaruh.length} halaman diperiksa`
);

// ── 3. Kerangkanya sendiri tidak boleh menyimpan kalimat keras ──────
const kerangkaButa = kerangkaBertombol.filter((b) => !isi.get(b).includes('useBahasa'));
catat(
  kerangkaButa.length === 0,
  'Kerangka yang memasang tombolnya juga membaca kamus',
  kerangkaButa.length ? kerangkaButa.join(', ') : 'semua'
);

// ── 4. Tidak ada kunci yang dipanggil tetapi tidak ada di kamus ─────
const sumberKamus = readFileSync('lib/bahasa.tsx', 'utf8');

// Hanya blok KAMUS yang dibaca. Tanpa batas ini, kolom pada tipe
// konteks di bawahnya (bahasa, ganti, t) ikut terhitung sebagai kunci
// dan dilaporkan tidak punya terjemahan — padahal memang bukan teks.
const mulai = sumberKamus.indexOf('const KAMUS = {');
const selesai = sumberKamus.indexOf('} as const;', mulai);
if (mulai < 0 || selesai < 0) {
  console.log('  GAGAL  Blok KAMUS tidak ditemukan di lib/bahasa.tsx');
  process.exit(1);
}
const kamus = sumberKamus.slice(mulai, selesai);
const kunciAda = new Set([...kamus.matchAll(/^ {2}([a-zA-Z]+):/gm)].map((m) => m[1]));
const dipakai = new Set();
for (const [, t] of isi) for (const m of t.matchAll(/\bt\("([a-zA-Z]+)"\)/g)) dipakai.add(m[1]);
const hilang = [...dipakai].filter((k) => !kunciAda.has(k));
catat(hilang.length === 0, 'Setiap kunci yang dipanggil ada di kamus', hilang.length ? hilang.join(', ') : `${dipakai.size} kunci dipakai dari ${kunciAda.size} tersedia`);

// ── 5. Setiap kunci punya kedua bahasa, dan tidak identik asal-asalan ─
// Tanda kutip yang di-escape di dalam kalimat ikut diterima. Tanpa ini,
// kunci seperti konfirmasiHapus — yang menyebut judul kuis dalam tanda
// kutip — dilaporkan tidak punya terjemahan padahal punya.
const isiTeks = String.raw`"((?:[^"\\]|\\.)*)"`;
const polaKunci = new RegExp(String.raw`^ {2}([a-zA-Z]+):\s*\{\s*id:\s*${isiTeks},\s*\n?\s*en:\s*${isiTeks}`, 'gm');
const barisKunci = [...kamus.matchAll(polaKunci)];
const takLengkap = [...kunciAda].filter((k) => !barisKunci.some((m) => m[1] === k));
catat(takLengkap.length === 0, 'Setiap kunci punya versi Indonesia dan Inggris', takLengkap.length ? takLengkap.join(', ') : `${barisKunci.length} kunci lengkap`);

// ── 6. Terjemahan yang persis sama menandakan kunci yang terlewat ───
// Kata seperti "Email" memang sama di kedua bahasa; yang dicurigai
// hanya kalimat panjang yang tidak berubah sama sekali.
const kembar = barisKunci.filter((m) => m[2] === m[3] && m[2].length > 14).map((m) => m[1]);
catat(kembar.length === 0, 'Tidak ada kalimat panjang yang lupa diterjemahkan', kembar.length ? kembar.join(', ') : 'tidak ada');

console.log(`${lulus}/${lulus + gagal} pembuktian lulus.`);
process.exit(gagal ? 1 : 0);
