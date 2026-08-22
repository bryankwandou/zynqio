"use client";

/**
 * components/AuthShell.tsx — kerangka bersama halaman masuk dan daftar.
 *
 * Empat halaman autentikasi sebelumnya menyalin kerangka yang sama:
 * pembungkus tengah, latar ambient, tombol ganti tema di pojok, kartu
 * selebar 400 piksel, dan tanda di atasnya. Empat salinan berarti empat
 * tempat yang harus diubah setiap kali satu hal digeser — dan pada
 * praktiknya tidak pernah keempatnya ikut berubah, sehingga halaman
 * yang terlewat perlahan menyimpang dari yang lain.
 *
 * Bentuk kartunya juga diperbaiki di sini: panelnya tidak lagi
 * mengangkat diri saat disentuh. Kartu masuk bukan sesuatu yang bisa
 * diklik, dan gerakan naik pada benda yang tidak bisa ditekan
 * menjanjikan sesuatu yang tidak terjadi.
 */

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Logo } from './Logo';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  /** Baris di bawah kartu, biasanya tautan ke halaman lawannya. */
  footer?: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--sp-5)',
        gap: 'var(--sp-5)',
      }}
    >
      <div className="ambient" />

      <button
        className="zy-btn zy-btn-quiet"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label={theme === 'dark' ? 'Beralih ke tampilan terang' : 'Beralih ke tampilan gelap'}
        style={{ position: 'fixed', top: 'var(--sp-5)', right: 'var(--sp-5)', zIndex: 100, padding: 'var(--sp-2)' }}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div
        className="zy-panel zy-enter"
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 'var(--sp-6) var(--sp-6)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
          <Link
            href="/"
            aria-label="Kembali ke beranda"
            style={{ display: 'inline-block', marginBottom: 'var(--sp-4)' }}
          >
            <Logo size={44} />
          </Link>
          <h1 className="zy-h2">{title}</h1>
          <p className="zy-muted" style={{ marginTop: 'var(--sp-1)' }}>
            {subtitle}
          </p>
        </div>

        {children}
      </div>

      {footer && (
        <div className="zy-muted" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Pemberitahuan di dalam kartu autentikasi.
 *
 * Warna saja tidak cukup menandai kegagalan: bagi orang yang tidak
 * membedakan merah dari hijau, kotak galat dan kotak berhasil terlihat
 * sama. Karena itu tiap ragam membawa ikonnya sendiri, dan yang
 * bersifat galat diberi role="alert" supaya pembaca layar
 * mengumumkannya tanpa menunggu fokus berpindah.
 */
export function AuthNotice({
  kind,
  children,
}: {
  kind: 'error' | 'success' | 'info';
  children: React.ReactNode;
}) {
  const gaya = {
    error: { warna: 'var(--red)', latar: 'rgba(220,38,38,0.10)', tepi: 'rgba(220,38,38,0.28)', tanda: '!' },
    success: { warna: 'var(--green)', latar: 'rgba(5,150,105,0.10)', tepi: 'rgba(5,150,105,0.28)', tanda: '✓' },
    info: { warna: 'var(--t2)', latar: 'var(--bg3-raw)', tepi: 'var(--border-raw)', tanda: 'i' },
  }[kind];

  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        gap: 'var(--sp-2)',
        alignItems: 'flex-start',
        marginBottom: 'var(--sp-4)',
        padding: 'var(--sp-3) var(--sp-4)',
        borderRadius: 'var(--r-md)',
        background: gaya.latar,
        border: `1px solid ${gaya.tepi}`,
        fontSize: 'var(--fs-sm)',
        lineHeight: 'var(--lh-snug)',
        color: gaya.warna,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 18,
          height: 18,
          borderRadius: 'var(--r-full)',
          border: `1.5px solid ${gaya.warna}`,
          display: 'grid',
          placeItems: 'center',
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {gaya.tanda}
      </span>
      <span>{children}</span>
    </div>
  );
}
