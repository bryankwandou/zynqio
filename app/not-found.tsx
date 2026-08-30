"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Home } from "lucide-react";

/**
 * Halaman 404.
 *
 * Halaman inilah yang paling sering dilihat murid yang salah mengetik
 * kode ruangan di papan tulis — bukan halaman depan. Karena itu ia
 * tidak berhenti pada "halaman tidak ditemukan": kotak kode ruangan
 * dipasang langsung di sini supaya murid bisa mencoba lagi tanpa
 * kembali dulu ke mana pun.
 *
 * Versi sebelumnya dipaku gelap dan berbahasa Inggris, padahal seluruh
 * situs mengikuti tema perangkat dan berbahasa Indonesia. Murid yang
 * memakai tema terang tiba-tiba menemui layar hitam dan mengira
 * aplikasinya rusak, bukan alamatnya yang salah.
 */
export default function NotFound() {
  const [kode, setKode] = useState("");
  const [galat, setGalat] = useState("");
  const router = useRouter();

  const gabung = (e: React.FormEvent) => {
    e.preventDefault();
    const bersih = kode.trim().toUpperCase();
    if (bersih.length !== 6) {
      setGalat("Kode ruangan terdiri dari 6 karakter.");
      return;
    }
    setGalat("");
    router.push(`/join/${bersih}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "var(--sp-5)",
        background: "var(--bg-raw)",
      }}
    >
      <div
        className="zy-berurut"
        style={{ width: "100%", maxWidth: 420, textAlign: "center" }}
      >
        <div
          className="zy-num"
          aria-hidden="true"
          style={{
            fontSize: "clamp(4.5rem, 22vw, 7rem)",
            fontWeight: "var(--fw-bold)",
            lineHeight: 1,
            color: "var(--p)",
            letterSpacing: "-0.04em",
          }}
        >
          404
        </div>

        <h1 className="zy-h1" style={{ marginTop: "var(--sp-3)", fontSize: "var(--fs-2xl)" }}>
          Halaman ini tidak ada
        </h1>
        <p className="zy-muted" style={{ marginTop: "var(--sp-2)" }}>
          Alamatnya mungkin salah ketik, atau halamannya sudah dipindahkan.
        </p>

        <Link
          href="/"
          className="zy-btn zy-btn-ghost"
          style={{ marginTop: "var(--sp-5)", justifyContent: "center" }}
        >
          <Home size={16} aria-hidden="true" />
          Kembali ke halaman depan
        </Link>

        <div
          className="zy-panel"
          style={{ marginTop: "var(--sp-6)", padding: "var(--sp-6)", textAlign: "left" }}
        >
          <label htmlFor="kode-ruangan" className="zy-label" style={{ display: "block" }}>
            Atau masuk ke ruangan
          </label>

          <form onSubmit={gabung} className="zy-stack" style={{ gap: "var(--sp-3)", marginTop: "var(--sp-3)" }}>
            <input
              id="kode-ruangan"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              value={kode}
              onChange={(e) => {
                setKode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
                if (galat) setGalat("");
              }}
              maxLength={6}
              placeholder="KODE 6 HURUF"
              aria-describedby={galat ? "galat-kode" : undefined}
              aria-invalid={galat ? true : undefined}
              className="zy-input zy-num"
              style={{
                width: "100%",
                textAlign: "center",
                fontSize: "var(--fs-lg)",
                letterSpacing: "0.28em",
                padding: "var(--sp-4)",
              }}
            />

            {galat && (
              <p
                id="galat-kode"
                role="alert"
                style={{
                  color: "var(--red)",
                  fontSize: "var(--fs-sm)",
                  fontWeight: "var(--fw-medium)",
                }}
              >
                {galat}
              </p>
            )}

            <button
              type="submit"
              disabled={kode.length !== 6}
              className="zy-btn zy-btn-primary zy-btn-lg"
              style={{ width: "100%", justifyContent: "center" }}
            >
              Masuk ruangan
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
