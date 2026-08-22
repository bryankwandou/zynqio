/**
 * components/Logo.tsx — tanda ZYNQIO.
 *
 * Versi sebelumnya adalah huruf Z di atas gumpalan conic-gradient,
 * disalin apa adanya ke empat halaman. Bentuk itu tidak mengatakan
 * apa pun tentang produknya, dan gradien kerucut ungu ke sian adalah
 * hal pertama yang dihasilkan mesin ketika diminta membuat logo.
 *
 * Tanda ini diambil dari produknya sendiri: empat bentuk pilihan
 * jawaban — segitiga, wajik, lingkaran, persegi — yang dilihat setiap
 * murid di layar mereka pada setiap soal. Menyusunnya dalam satu bidang
 * membuat tandanya berarti sesuatu bagi orang yang pernah memakai
 * aplikasi ini, dan tetap terbaca sebagai bentuk utuh bagi yang belum.
 *
 * Dibuat agar bertahan di ukuran kecil: tidak ada garis tipis, tidak
 * ada gradien, dan bentuknya tetap terbedakan pada 16 piksel di tab
 * peramban. Warnanya boleh diwarisi dari induk (currentColor) supaya
 * bisa dipakai satu warna di tempat yang menuntutnya — kop surat,
 * stempel, atau latar gelap.
 */

interface LogoProps {
  /** Sisi bidang dalam piksel. */
  size?: number;
  /** Satu warna saja, mengikuti warna teks induknya. */
  mono?: boolean;
  className?: string;
}

export function Logo({ size = 40, mono = false, className }: LogoProps) {
  // Warna yang sama dengan tombol jawaban, supaya tandanya dan
  // permainannya terbaca sebagai satu hal.
  const warna = mono
    ? { a: 'currentColor', b: 'currentColor', c: 'currentColor', d: 'currentColor' }
    : { a: '#dc2626', b: '#2563eb', c: '#d97706', d: '#059669' };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="ZYNQIO"
    >
      {/* Bidang dasar. Radius 12 dari 48 menjaga sudutnya tetap tegas
          pada ukuran kecil — radius yang lebih besar membuatnya luruh
          jadi lingkaran dan kehilangan ciri. */}
      <rect width="48" height="48" rx="12" fill={mono ? 'none' : '#15131f'} />

      {/* Segitiga, kiri atas. */}
      <path d="M14 20 L9.5 27.5 L18.5 27.5 Z" fill={warna.a} opacity={mono ? 0.9 : 1} />

      {/* Wajik, kanan atas. */}
      <path d="M34 15.5 L38.5 20 L34 24.5 L29.5 20 Z" fill={warna.b} opacity={mono ? 0.7 : 1} />

      {/* Lingkaran, kiri bawah. */}
      <circle cx="14" cy="34" r="4.5" fill={warna.c} opacity={mono ? 0.5 : 1} />

      {/* Persegi, kanan bawah. */}
      <rect x="29.5" y="29.5" width="9" height="9" rx="1.5" fill={warna.d} opacity={mono ? 0.85 : 1} />

      {/* Titik tengah. Satu-satunya unsur yang bukan bentuk jawaban —
          menandai layar yang dilihat bersama, tempat keempatnya bertemu. */}
      <circle cx="24" cy="27" r="2" fill={mono ? 'currentColor' : '#fafaf9'} opacity="0.9" />
    </svg>
  );
}

/**
 * Tanda beserta nama, untuk bilah navigasi dan kop halaman.
 * Namanya diberi jarak huruf sedikit renggang; ZYNQIO seluruhnya
 * kapital dan tanpa itu huruf-hurufnya terlihat berdesakan.
 */
export function LogoLockup({ size = 32 }: { size?: number }) {
  return (
    <span className="zy-row" style={{ gap: 'var(--sp-3)' }}>
      <Logo size={size} />
      <span
        style={{
          fontSize: 'var(--fs-lg)',
          fontWeight: 'var(--fw-bold)',
          letterSpacing: '0.04em',
          color: 'var(--t1)',
          lineHeight: 1,
        }}
      >
        ZYNQIO
      </span>
    </span>
  );
}
