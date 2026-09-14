/**
 * Membaca kunci jawaban dalam semua bentuk yang pernah tersimpan.
 *
 * Penyunting dan templat Excel menulis kunci sebagai huruf ("B"), beberapa
 * huruf ("B;D"), teks isian ("ever;in the world"), atau urutan
 * ("10,20,30,40"); layar peserta mengirim nomor pilihan ("1"). Penilai lama
 * hanya membandingkan kedua string itu apa adanya, sehingga "B" tidak pernah
 * sama dengan "1" — peserta yang menjawab benar tercatat salah.
 */

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

export function teksOpsi(options: unknown): string[] {
  return (Array.isArray(options) ? options : []).map((o) =>
    typeof o === 'object' && o !== null ? String((o as { text?: unknown }).text ?? '') : String(o ?? '')
  );
}

export type KunciTerbaca =
  | { jenis: 'pilihan'; indeks: number[] }
  | { jenis: 'urutan'; indeks: number[] }
  | { jenis: 'isian'; diterima: string[] }
  | { jenis: 'kosong' };

export function bacaKunci(type: string, options: unknown, correct: unknown): KunciTerbaca {
  if (type === 'POLL' || correct === null || correct === undefined || norm(correct) === '') {
    return { jenis: 'kosong' };
  }
  const opsi = teksOpsi(options);
  const adaOpsi = opsi.some((t) => t.trim() !== '');
  const mentah = Array.isArray(correct) ? correct.map(String) : null;
  const teks = String(correct);

  if (!adaOpsi) {
    return { jenis: 'isian', diterima: (mentah ?? teks.split(';')).map(norm).filter(Boolean) };
  }

  const keIndeks = (token: string): number | null => {
    const t = token.trim();
    if (/^\d+$/.test(t) && Number(t) < opsi.length) return Number(t);
    if (/^[a-z]$/i.test(t)) {
      const i = t.toUpperCase().charCodeAt(0) - 65;
      if (i < opsi.length) return i;
    }
    const i = opsi.findIndex((o) => norm(o) === norm(t));
    return i >= 0 ? i : null;
  };

  // Urutan: dipisah koma dan menyebut lebih dari satu pilihan.
  if (!mentah && teks.includes(',') && !teks.includes(';')) {
    const indeks = teks.split(',').map(keIndeks);
    if (indeks.length > 1 && indeks.every((i) => i !== null)) {
      return { jenis: 'urutan', indeks: indeks as number[] };
    }
  }

  const indeks = (mentah ?? teks.split(';'))
    .map(keIndeks)
    .filter((i): i is number => i !== null);
  return indeks.length ? { jenis: 'pilihan', indeks } : { jenis: 'isian', diterima: [norm(teks)] };
}

/** Benar atau salah untuk satu kiriman peserta. */
export function nilaiJawaban(type: string, options: unknown, correct: unknown, submitted: unknown): boolean {
  if (submitted === undefined || submitted === null) return false;
  const k = bacaKunci(type, options, correct);
  const opsi = teksOpsi(options);

  const kirimanKeIndeks = (v: unknown): number | null => {
    const t = norm(v);
    if (/^\d+$/.test(t)) return Number(t);
    const i = opsi.findIndex((o) => norm(o) === t);
    return i >= 0 ? i : null;
  };

  switch (k.jenis) {
    case 'pilihan': {
      if (Array.isArray(submitted)) {
        const s = new Set(submitted.map(kirimanKeIndeks));
        return s.size === k.indeks.length && k.indeks.every((i) => s.has(i));
      }
      // Layar peserta saat ini hanya mengirim satu pilihan; pada soal
      // berkunci ganda, memilih salah satu yang benar dihitung benar.
      const i = kirimanKeIndeks(submitted);
      return i !== null && k.indeks.includes(i);
    }
    case 'urutan': {
      if (!Array.isArray(submitted)) return false;
      const s = submitted.map(kirimanKeIndeks);
      return s.length === k.indeks.length && s.every((v, i) => v === k.indeks[i]);
    }
    case 'isian':
      return k.diterima.includes(norm(submitted));
    default:
      return false;
  }
}
