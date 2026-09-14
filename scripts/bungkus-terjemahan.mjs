/**
 * scripts/bungkus-terjemahan.mjs — sekali jalan: membungkus teks layar yang
 * belum melewati kamus dengan tt("id", "en") memakai
 * scripts/terjemahan-antarmuka.json, lalu memasang useBahasa() pada
 * komponen yang memuatnya. Teks templat (`...${x}...`) dilaporkan untuk
 * dikerjakan tangan.
 */
import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const KAMUS = JSON.parse(readFileSync('scripts/terjemahan-antarmuka.json', 'utf8'));
const ATRIBUT = new Set(['placeholder', 'title', 'alt', 'aria-label', 'label', 'aria-description']);
const rapi = (s) => s.replace(/\s+/g, ' ').trim();

function cari(teks) {
  const r = rapi(teks);
  let pasangan = KAMUS[r];
  if (!pasangan) {
    const kunci = Object.keys(KAMUS).find((k) => k.length >= 60 && r.startsWith(k));
    if (kunci) pasangan = KAMUS[kunci];
  }
  if (!pasangan) return null;
  let [id, en] = pasangan;
  if (id === '@@asli') id = r;
  if (id.startsWith('@@id:')) id = id.slice(5);
  if (en === '@@asli') en = r;
  if (en.startsWith('@@en:')) en = en.slice(5);
  return [id, en];
}

function telusuri(dir, keluar = []) {
  for (const nama of readdirSync(dir)) {
    const penuh = join(dir, nama);
    if (statSync(penuh).isDirectory()) { if (nama !== 'api') telusuri(penuh, keluar); }
    else if (nama.endsWith('.tsx')) keluar.push(penuh);
  }
  return keluar;
}

const panggil = ([id, en]) => `tt(${JSON.stringify(id)}, ${JSON.stringify(en)})`;
const sisa = [];

for (const b of ['app', 'components'].flatMap((a) => telusuri(a))) {
  const nama = b.split(sep).join('/');
  if (nama === 'app/global-error.tsx') continue; // di luar penyedia; dikerjakan tangan
  const asli = readFileSync(b, 'utf8');
  const sf = ts.createSourceFile(b, asli, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ganti = []; // {mulai, akhir, teks}
  const komponen = new Set();

  const komponenDari = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if ((ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p)) && p.name && /^[A-Z]/.test(p.name.text)) return p;
      if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent) && /^[A-Z]/.test(p.parent.name.getText(sf))) return p;
      if (ts.isFunctionDeclaration(p) && !p.name && p.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) return p;
    }
    return null;
  };

  const pasang = (node, teksBaru, asal) => {
    const k = komponenDari(node);
    if (!k || !k.body || !ts.isBlock(k.body)) { sisa.push(`${nama}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} tanpa komponen — ${rapi(asal)}`); return; }
    komponen.add(k);
    ganti.push({ mulai: node.getStart(sf), akhir: node.getEnd(), teks: teksBaru });
  };

  const ekspresi = (e) => {
    if (!e) return;
    if (ts.isParenthesizedExpression(e)) return ekspresi(e.expression);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
      if (!/[A-Za-z]{2,}/.test(e.text)) return;
      const p = cari(e.text);
      if (p) pasang(e, panggil(p), e.text);
      else sisa.push(`${nama}:${sf.getLineAndCharacterOfPosition(e.getStart(sf)).line + 1} tanpa terjemahan — ${rapi(e.text).slice(0, 60)}`);
    } else if (ts.isTemplateExpression(e)) {
      sisa.push(`${nama}:${sf.getLineAndCharacterOfPosition(e.getStart(sf)).line + 1} templat — ${e.getText(sf).slice(0, 70)}`);
    } else if (ts.isConditionalExpression(e)) { ekspresi(e.whenTrue); ekspresi(e.whenFalse); }
    else if (ts.isBinaryExpression(e) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(e.operatorToken.kind)) ekspresi(e.right);
  };

  const kunjungi = (n) => {
    if (ts.isJsxText(n)) {
      if (/[A-Za-z]{2,}/.test(n.text)) {
        const p = cari(n.text);
        if (p) {
          const t = n.getFullText(sf);
          const depan = t.match(/^\s*/)[0], belakang = t.match(/\s*$/)[0];
          const d = depan.includes('\n') ? depan : depan ? ' ' : '';
          const bl = belakang.includes('\n') ? belakang : belakang ? ' ' : '';
          // Spasi di tepi teks JSX sebaris bermakna; dipertahankan sebagai {" "}.
          const teks = `${d && !d.includes('\n') ? '{" "}' : d}{${panggil(p)}}${bl && !bl.includes('\n') ? '{" "}' : bl}`;
          const k = komponenDari(n);
          if (k && k.body && ts.isBlock(k.body)) {
            komponen.add(k);
            ganti.push({ mulai: n.getFullStart(), akhir: n.getEnd(), teks });
          } else sisa.push(`${nama} tanpa komponen — ${rapi(n.text)}`);
        } else sisa.push(`${nama}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1} tanpa terjemahan — ${rapi(n.text).slice(0, 60)}`);
      }
    } else if (ts.isJsxAttribute(n)) {
      if (ATRIBUT.has(n.name.getText(sf)) && n.initializer) {
        if (ts.isStringLiteral(n.initializer)) {
          if (/[A-Za-z]{2,}/.test(n.initializer.text)) {
            const p = cari(n.initializer.text);
            if (p) pasang(n.initializer, `{${panggil(p)}}`, n.initializer.text);
            else sisa.push(`${nama}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1} tanpa terjemahan — ${n.initializer.text.slice(0, 60)}`);
          }
        } else if (ts.isJsxExpression(n.initializer)) ekspresi(n.initializer.expression);
      }
      return;
    } else if (ts.isJsxExpression(n) && n.parent && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
      ekspresi(n.expression);
    }
    ts.forEachChild(n, kunjungi);
  };
  kunjungi(sf);
  if (!ganti.length) continue;

  // Kait useBahasa pada tiap komponen yang disentuh.
  for (const k of komponen) {
    const badan = k.body;
    const teksBadan = badan.getText(sf);
    const ada = teksBadan.match(/const\s*\{([^}]*)\}\s*=\s*useBahasa\(\)/);
    if (ada) {
      if (!/\btt\b/.test(ada[1])) {
        const mulai = badan.getStart(sf) + ada.index + ada[0].indexOf('{') + 1;
        ganti.push({ mulai, akhir: mulai, teks: ' tt,' });
      }
    } else {
      const mulai = badan.getStart(sf) + 1;
      ganti.push({ mulai, akhir: mulai, teks: '\n  const { tt } = useBahasa();' });
    }
  }

  let hasil = asli;
  for (const g of ganti.sort((a, b) => b.mulai - a.mulai || b.akhir - a.akhir)) {
    hasil = hasil.slice(0, g.mulai) + g.teks + hasil.slice(g.akhir);
  }
  if (!/import\s*\{[^}]*\buseBahasa\b[^}]*\}\s*from\s*["']@\/lib\/bahasa["']/.test(hasil)) {
    const imp = hasil.match(/import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/bahasa["'];?/);
    if (imp) hasil = hasil.replace(imp[0], imp[0].replace('{', '{ useBahasa,'));
    else {
      const arahan = hasil.match(/^\s*["']use client["'];?\s*\n/);
      const pos = arahan ? arahan[0].length : 0;
      hasil = hasil.slice(0, pos) + 'import { useBahasa } from "@/lib/bahasa";\n' + hasil.slice(pos);
    }
  }
  writeFileSync(b, hasil);
  console.log(`  ${nama}: ${ganti.length} suntingan`);
}
console.log(`\nSisa untuk dikerjakan tangan (${sisa.length}):`);
for (const s of sisa) console.log('  ' + s);
