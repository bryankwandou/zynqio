/**
 * components/SampulKuis.tsx — penanda visual kartu kuis.
 *
 * Tidak ada satu pun dari 26 kuis di basis data yang punya cover_image,
 * dan kolom itu memang tidak pernah terisi. Menunggu guru mengunggah
 * gambar untuk tiap kuis bukan jawaban: katalog akan tetap polos
 * sampai entah kapan, dan gambar unggahan justru membuat halaman berat
 * serta tampilannya tidak seragam.
 *
 * Jadi penandanya diturunkan dari mata pelajarannya. Kuis Matematika
 * selalu mendapat rupa yang sama di mana pun ia muncul, dan mata yang
 * sudah terbiasa akan mengenali kartunya sebelum membaca judulnya.
 *
 * Sebelumnya pernah ada sampul emoji setinggi 120 piksel di sini, dan
 * itu dibuang karena mendorong judul serta jumlah soal turun ke bawah
 * lipatan layar. Versi ini menahan diri di 64 piksel — cukup untuk
 * memberi ciri, tidak cukup untuk mengusir isi yang benar-benar dibaca
 * orang saat memilih kuis.
 */

interface SampulProps {
  kategori: string | null;
  judul: string;
  tinggi?: number;
}

/**
 * Rona warna dari nama mata pelajaran.
 *
 * Memakai penjumlahan berbobot posisi, bukan sekadar menjumlahkan kode
 * karakter. Penjumlahan polos memberi hasil sama untuk kata yang
 * hurufnya diacak — "Fisika" dan "Fiskia" akan bertabrakan — dan di
 * daftar enam belas mata pelajaran tabrakan semacam itu tampak jelas
 * sebagai dua kartu berwarna kembar.
 */
function rona(teks: string): number {
  let n = 0;
  for (let i = 0; i < teks.length; i++) {
    n = (n * 31 + teks.charCodeAt(i)) % 360;
  }
  return n;
}

/**
 * Huruf yang dipampang.
 *
 * Diambil dari kata pertama mata pelajaran, bukan dari judul kuisnya.
 * Judul "Matematika Dasar: Bilangan dan Operasi" dan "Geometri dan
 * Pengukuran" sama-sama pelajaran Matematika, dan keduanya memang
 * sebaiknya membawa huruf yang sama.
 */
function huruf(kategori: string | null, judul: string): string {
  const sumber = (kategori ?? judul).trim();
  if (!sumber) return "?";
  const kata = sumber.split(/\s+/);
  // Dua kata pertama untuk nama majemuk seperti "Seni Budaya" dan
  // "Bahasa Indonesia", supaya keduanya tidak sama-sama jadi "B" atau
  // "S" dan tertukar di daftar.
  if (kata.length > 1) {
    return (kata[0][0] + kata[1][0]).toUpperCase();
  }
  return sumber.slice(0, 2).toUpperCase();
}

export function SampulKuis({ kategori, judul, tinggi = 64 }: SampulProps) {
  const h = rona(kategori ?? judul);
  const inisial = huruf(kategori, judul);

  return (
    <div
      // Sepenuhnya hiasan: mata pelajaran sudah tertulis pada lencana di
      // bawahnya dan judulnya ada di sebelahnya. Membacakannya lagi
      // hanya menambah satu perhentian tanpa keterangan baru.
      aria-hidden="true"
      style={{
        height: tinggi,
        borderRadius: "var(--r-md)",
        marginBottom: "var(--sp-4)",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        position: "relative",
        // Dua rona bertetangga, bukan satu warna rata. Warna rata pada
        // bidang selebar ini terbaca seperti tempat gambar yang gagal
        // dimuat; landaian membuatnya terbaca sebagai pilihan.
        background: `linear-gradient(135deg,
          hsl(${h} 62% 58%) 0%,
          hsl(${(h + 38) % 360} 58% 48%) 100%)`,
      }}
    >
      {/* Garis serong tipis. Tanpa ini, enam belas kartu dengan rona
          berbeda tetap terbaca sebagai enam belas persegi datar. */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 9px)",
        }}
      />
      <span
        style={{
          position: "relative",
          fontFamily: "var(--font-space-mono), monospace",
          fontWeight: "var(--fw-bold)",
          fontSize: "var(--fs-lg)",
          letterSpacing: "0.06em",
          color: "#ffffff",
          // Rona di sekitar kuning memberi latar terang, dan putih di
          // atasnya nyaris tak terbaca. Bayangan tipis menjaga hurufnya
          // tetap terbaca di seluruh lingkaran warna tanpa harus
          // menggelapkan latarnya.
          textShadow: "0 1px 3px rgba(0,0,0,0.42)",
        }}
      >
        {inisial}
      </span>
    </div>
  );
}
