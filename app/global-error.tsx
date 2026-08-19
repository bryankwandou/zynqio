"use client";

/**
 * app/global-error.tsx — jaring pengaman paling luar.
 *
 * Berkas ini menangkap galat yang terjadi di root layout, tempat
 * app/error.tsx sudah tidak bisa menolong karena kerangka halamannya
 * sendiri yang gagal. Karena itu komponen ini menuliskan <html> dan
 * <body> miliknya sendiri, dan tidak bergantung pada penyedia konteks
 * mana pun — termasuk tema dan sesi. Ketergantungan apa pun di sini
 * berarti halaman galat ikut gagal saat paling dibutuhkan.
 *
 * Sebelumnya berkas ini tidak ada, dan Next menyusun versi bawaannya
 * sendiri. Versi bawaan itulah yang menggagalkan build.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#07060f",
          color: "#f5f3ff",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <main style={{ maxWidth: 460, textAlign: "center" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              margin: "0 auto 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 26,
              color: "#fff",
              background:
                "conic-gradient(from 0deg, #7c6ffd, #a78bfa, #22d3ee, #7c6ffd)",
            }}
          >
            Z
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 12px" }}>
            Ada yang tidak beres di sisi kami
          </h1>

          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "#c5c0e0",
              margin: "0 0 28px",
            }}
          >
            Halaman ini gagal dimuat sepenuhnya. Coba muat ulang; kalau masih
            sama, kembali sebentar lagi.
          </p>

          <button
            onClick={reset}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: 10,
              padding: "11px 22px",
              fontSize: 15,
              fontWeight: 600,
              color: "#fff",
              background: "#7c6ffd",
            }}
          >
            Muat ulang halaman
          </button>

          {/*
            Penanda galat ditampilkan supaya pengguna bisa menyebutkannya
            saat melapor. Isi pesan galatnya sendiri tidak ditampilkan —
            pesan itu kerap memuat nama berkas atau tabel.
          */}
          {error.digest ? (
            <p
              style={{
                marginTop: 28,
                fontSize: 12,
                color: "#4f4a6b",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              Penanda kejadian: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
