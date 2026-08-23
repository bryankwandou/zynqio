/**
 * components/Logo.tsx — tanda ZYNQIO.
 *
 * Riwayat dua kali ganti, dan alasan keduanya perlu dicatat.
 *
 * Versi pertama: huruf Z di atas gumpalan conic-gradient, disalin apa
 * adanya ke empat halaman. Gradien kerucut ungu-ke-sian adalah hal
 * pertama yang dihasilkan mesin ketika diminta membuat logo.
 *
 * Versi kedua: empat bentuk jawaban (segitiga, wajik, lingkaran,
 * persegi) tersebar di satu bidang. Gagasannya benar — tanda yang
 * diambil dari produknya sendiri — tapi pelaksanaannya keliru dan
 * kekeliruannya bisa dihitung. Lima unsur terpisah dalam bidang 48
 * piksel membuat tiap bentuk hanya sekitar 9 piksel. Dipasang di bilah
 * navigasi pada 30 piksel, tiap bentuk tinggal 5,6 piksel — di bawah
 * ambang mata bisa membedakan segitiga dari wajik. Hasilnya terbaca
 * sebagai gumpalan titik, bukan sebagai tanda.
 *
 * Versi ini bertolak dari batas itu: pada 16 piksel, mata hanya sanggup
 * memisahkan tiga sampai empat bidang. Maka tandanya dibangun dari tiga
 * bidang besar yang membentuk huruf Z — dua palang dan satu diagonal.
 * Masing-masing selebar 8 dari 48, jadi tetap sekitar 2,7 piksel pada
 * 16 piksel: tipis, tapi utuh sebagai bentuk, karena yang dibaca mata
 * adalah siluet Z-nya, bukan tiap palang satu per satu.
 *
 * Warna jawaban tidak dibuang, hanya dipindah ke tempat yang muat:
 * tombol pilihan di layar murid, tempat tiap bentuk mendapat ruang
 * puluhan piksel dan memang bisa dibedakan.
 */

interface LogoProps {
  /** Sisi bidang dalam piksel. */
  size?: number;
  /** Satu warna saja, mengikuti warna teks induknya. */
  mono?: boolean;
  className?: string;
}

export function Logo({ size = 40, mono = false, className }: LogoProps) {
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
          pada ukuran kecil — radius lebih besar meluruhkannya jadi
          lingkaran dan tandanya kehilangan ciri. */}
      <rect
        width="48"
        height="48"
        rx="12"
        fill={mono ? 'none' : '#6d5efc'}
        stroke={mono ? 'currentColor' : 'none'}
        strokeWidth={mono ? 3 : 0}
      />

      {/* Huruf Z, tiga bidang. Palang atas dan bawah adalah persegi
          panjang; diagonalnya jajaran genjang yang ujung-ujungnya
          bertemu dengan kedua palang, sehingga ketiganya terbaca
          sebagai satu goresan utuh dan bukan tiga potongan lepas. */}
      <g fill={mono ? 'currentColor' : '#ffffff'}>
        <rect x="12" y="12" width="24" height="8" rx="1.5" />
        <path d="M36 12 L36 20 L12 36 L12 28 Z" />
        <rect x="12" y="28" width="24" height="8" rx="1.5" />
      </g>
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