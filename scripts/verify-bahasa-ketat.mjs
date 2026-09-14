/**
 * scripts/verify-bahasa-ketat.mjs — cakupan terjemahan yang ketat.
 *
 * verify-bahasa.mjs hanya memeriksa bahwa sebuah halaman MENGIMPOR kamus.
 * Halaman yang mengimpor kamus lalu tetap menulis "Share Results" langsung
 * di JSX lulus dari pemeriksaan itu, padahal tombol bahasanya tidak
 * menggerakkan kata tersebut.
 *
 * Pemeriksaan ini membaca pohon sintaks setiap berkas .tsx di app/ dan
 * components/, lalu melaporkan setiap teks yang sampai ke layar tanpa
 * melewati kamus:
 *   - teks JSX di antara tag (<p>Halo</p>)
 *   - atribut yang dibaca manusia: placeholder, title, alt, aria-label, label
 *   - string di dalam {…} yang langsung dirender ({"Kirim"}, {x ? "Ya" : "Tidak"})
 *
 * Yang tidak dihitung: tanda baca, angka, emoji, satu huruf, nama merek
 * (ZYNQIO, Zynqio), nama format dan platform, alamat situs, kode CSS di
 * dalam <style>, dan berkas api/. Semuanya sama di kedua bahasa.
 * Lulus berarti nol temuan.
 */
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const AKAR = ['app', 'components'];
const ATRIBUT = new Set(['placeholder', 'title', 'alt', 'aria-label', 'label', 'aria-description']);
const MEREK = /^(zynqio|ZYNQIO|Zynqio|MCQ|CSV|XLSX|PIN|QR|ID|EN|OK|Google|GitHub|Excel)$/;

function telusuri(dir, keluar = []) {
  for (const nama of readdirSync(dir)) {
    const penuh = join(dir, nama);
    if (statSync(penuh).isDirectory()) { if (nama !== 'api') telusuri(penuh, keluar); }
    else if (nama.endsWith('.tsx')) keluar.push(penuh);
  }
  return keluar;
}

/** Teks yang layak diterjemahkan: memuat setidaknya dua huruf berurutan. */
function bermakna(s) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!/[A-Za-z]{2,}/.test(t)) return false;
  if (MEREK.test(t)) return false;
  if (/@keyframes /.test(t) && /[{};]/.test(t)) return false; // CSS di <style>
  if (/^(https?:\/\/\S*|[a-z0-9-]+\.vercel\.app)$/i.test(t)) return false; // alamat
  if (/^[A-Za-z]+( *[·,] *[A-Za-z]+)+$/.test(t) && t.split(/[·,]/).every((x) => /^(Quizizz|Kahoot|Blooket|CSV|XLSX|XLS)$/.test(x.trim()))) return false;
  return true;
}

const temuan = new Map();
const catat = (berkas, sf, node, teks, jenis) => {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  const daftar = temuan.get(berkas) ?? [];
  daftar.push({ baris: line + 1, jenis, teks: teks.replace(/\s+/g, ' ').trim().slice(0, 70) });
  temuan.set(berkas, daftar);
};

/** String yang dirender dari dalam {…}: literal, cabang ternary, dan a || "x". */
function periksaEkspresi(berkas, sf, e) {
  if (!e) return;
  if (ts.isParenthesizedExpression(e)) return periksaEkspresi(berkas, sf, e.expression);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
    if (bermakna(e.text)) catat(berkas, sf, e, e.text, 'ekspresi');
  } else if (ts.isTemplateExpression(e)) {
    const potongan = [e.head.text, ...e.templateSpans.map((s) => s.literal.text)].join(' ');
    if (bermakna(potongan)) catat(berkas, sf, e, potongan, 'templat');
  } else if (ts.isConditionalExpression(e)) {
    periksaEkspresi(berkas, sf, e.whenTrue);
    periksaEkspresi(berkas, sf, e.whenFalse);
  } else if (ts.isBinaryExpression(e) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(e.operatorToken.kind)) {
    periksaEkspresi(berkas, sf, e.right);
  }
}

const berkas = AKAR.flatMap((a) => telusuri(a));
for (const b of berkas) {
  const nama = b.split(sep).join('/');
  const sf = ts.createSourceFile(b, readFileSync(b, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const kunjungi = (n) => {
    if (ts.isJsxText(n)) {
      if (bermakna(n.text)) catat(nama, sf, n, n.text, 'teks');
    } else if (ts.isJsxAttribute(n)) {
      const kunci = n.name.getText(sf);
      if (ATRIBUT.has(kunci) && n.initializer) {
        if (ts.isStringLiteral(n.initializer)) {
          if (bermakna(n.initializer.text)) catat(nama, sf, n, n.initializer.text, kunci);
        } else if (ts.isJsxExpression(n.initializer)) {
          periksaEkspresi(nama, sf, n.initializer.expression);
        }
      }
      return;
    } else if (ts.isJsxExpression(n) && n.parent && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
      periksaEkspresi(nama, sf, n.expression);
    }
    ts.forEachChild(n, kunjungi);
  };
  kunjungi(sf);
}

const semua = [...temuan.entries()].sort((a, b) => b[1].length - a[1].length);
const total = semua.reduce((t, [, d]) => t + d.length, 0);
const rinci = process.argv.includes('--rinci');
for (const [b, d] of semua) {
  console.log(`  GAGAL  ${b} — ${d.length} teks tanpa kamus`);
  if (rinci) for (const x of d) console.log(`           ${x.baris}: [${x.jenis}] ${x.teks}`);
}
const bersih = berkas.length - semua.length;
console.log(`\n${bersih}/${berkas.length} berkas bersih, ${total} teks belum melewati kamus.`);
process.exit(total ? 1 : 0);
