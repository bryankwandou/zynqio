"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, ArrowRight, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";

/**
 * Ragam permainan.
 *
 * Keterangannya menyebut aturan yang berlaku, bukan janji suasana.
 * "Grab treasure chests" tidak memberi tahu guru apa pun tentang cara
 * skor dihitung; "peti berisi poin muncul di sela soal" memberi tahu.
 */
const RAGAM = [
  { label: "Klasik", desc: "Poin dari benar dan cepatnya menjawab" },
  { label: "Adu cepat", desc: "Penjawab tercepat mengambil seluruh poin soal" },
  { label: "Buru harta", desc: "Peti berisi poin muncul di sela soal" },
  { label: "Sisa satu", desc: "Salah sekali, gugur dari babak" },
  { label: "Beregu", desc: "Skor dijumlahkan per kelompok" },
  { label: "Bertahan", desc: "Skor kembali nol setiap kali salah" },
];

export default function Home() {
  const [roomCode, setRoomCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) return;

    setJoinError("");
    setIsJoining(true);

    try {
      const res = await fetch(`/api/room/state?roomCode=${code}`);
      if (res.status === 404) {
        setJoinError("Ruangan tidak ditemukan. Periksa lagi kodenya.");
        setIsJoining(false);
        return;
      }
      if (!res.ok) {
        setJoinError("Gagal memeriksa status ruangan. Coba lagi sebentar lagi.");
        setIsJoining(false);
        return;
      }
      const data = await res.json();
      if (data.status === "ended") {
        setJoinError("Permainan di ruangan ini sudah selesai.");
        setIsJoining(false);
        return;
      }
      if (data.status === "playing") {
        setJoinError("Permainan sudah dimulai, jadi ruangannya tertutup.");
        setIsJoining(false);
        return;
      }
      router.push(`/join/${code}`);
    } catch {
      setJoinError("Sambungan bermasalah. Periksa jaringan Anda lalu coba lagi.");
      setIsJoining(false);
    }
  };

  const kodeLengkap = roomCode.length === 6;

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflowX: "hidden" }}>
      <div className="ambient" />

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          padding: "var(--sp-3) var(--sp-5)",
          background: "var(--nav-bg)",
          WebkitBackdropFilter: "blur(20px)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-raw)",
        }}
      >
        <div
          className="zy-row-between"
          style={{ maxWidth: 1120, margin: "0 auto" }}
        >
          <span className="zy-row" style={{ gap: "var(--sp-2)" }}>
            <Logo size={30} />
            <span
              style={{
                fontSize: "var(--fs-lg)",
                fontWeight: "var(--fw-bold)",
                letterSpacing: "0.03em",
                color: "var(--t1)",
              }}
            >
              ZYNQIO
            </span>
          </span>

          <span className="zy-row" style={{ gap: "var(--sp-2)" }}>
            <button
              className="zy-btn zy-btn-quiet"
              style={{ padding: "var(--sp-2)" }}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Beralih ke tampilan terang" : "Beralih ke tampilan gelap"}
            >
              {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            </button>
            <Link href="/auth/signin" className="zy-btn zy-btn-quiet">
              Masuk
            </Link>
            <Link href="/auth/signup" className="zy-btn zy-btn-primary">
              Daftar
            </Link>
          </span>
        </div>
      </header>

      {/*
        Bagian pembuka.

        Yang paling sering dilakukan orang di halaman ini adalah
        memasukkan kode ruangan dari layar di depan kelas — bukan
        membaca ajakan. Karena itu kolom kodenya diletakkan tinggi dan
        diberi ukuran besar, dan sisanya menyusul di bawahnya.

        Judulnya menyebut hal yang benar-benar terjadi. Versi sebelumnya
        berbunyi "Think Fast. Play Smart. Quiz Harder." — kalimat yang
        bisa ditempelkan ke produk apa pun tanpa berubah maknanya.
      */}
      <section
        className="zy-enter"
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "var(--sp-8) var(--sp-5) var(--sp-7)",
          textAlign: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h1
          style={{
            fontSize: "clamp(2.25rem, 6vw, 4rem)",
            fontWeight: "var(--fw-bold)",
            lineHeight: "var(--lh-tight)",
            letterSpacing: "-0.03em",
            color: "var(--t1)",
            textWrap: "balance",
          }}
        >
          Kuis langsung untuk satu kelas penuh
        </h1>

        <p
          className="zy-prose"
          style={{
            fontSize: "var(--fs-base)",
            color: "var(--t2)",
            marginTop: "var(--sp-4)",
            marginInline: "auto",
            lineHeight: "var(--lh-relaxed)",
          }}
        >
          Tampilkan soal di proyektor, murid menjawab dari ponsel masing-masing, dan peringkatnya
          bergerak seketika. Tidak perlu memasang apa pun.
        </p>

        <form
          onSubmit={handleJoin}
          style={{
            marginTop: "var(--sp-7)",
            display: "flex",
            gap: "var(--sp-2)",
            maxWidth: 440,
            marginInline: "auto",
            padding: "var(--sp-2)",
            background: "var(--bg2-raw)",
            border: "1px solid var(--border-raw)",
            borderRadius: "var(--r-lg)",
          }}
        >
          <label htmlFor="kode" className="sr-only">
            Kode ruangan, enam karakter
          </label>
          <input
            id="kode"
            value={roomCode}
            onChange={(e) => {
              setRoomCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
              setJoinError("");
            }}
            placeholder="KODE"
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            aria-describedby={joinError ? "galat-gabung" : undefined}
            aria-invalid={joinError ? true : undefined}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "var(--sp-4)",
              fontSize: "var(--fs-xl)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "0.2em",
              background: "transparent",
              border: "none",
              color: "var(--t1)",
              fontFamily: "var(--font-space-mono)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!kodeLengkap || isJoining}
            className="zy-btn zy-btn-primary zy-btn-lg"
          >
            {isJoining ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <>
                Gabung <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        {/*
          Galat diumumkan pembaca layar tanpa menunggu fokus berpindah.
          Tanpa role="alert", orang yang memakai pembaca layar menekan
          Gabung lalu tidak mendengar apa-apa sama sekali.
        */}
        {joinError && (
          <p
            id="galat-gabung"
            role="alert"
            style={{
              color: "var(--red)",
              fontSize: "var(--fs-sm)",
              fontWeight: "var(--fw-medium)",
              marginTop: "var(--sp-3)",
            }}
          >
            {joinError}
          </p>
        )}

        <p className="zy-muted" style={{ marginTop: "var(--sp-4)" }}>
          Murid tidak perlu punya akun untuk ikut.{" "}
          <Link href="/auth/signup" style={{ color: "var(--p2)", fontWeight: "var(--fw-medium)" }}>
            Buat akun pengajar
          </Link>
        </p>
      </section>

      {/*
        Angka nyata, bukan janji.

        Ketiganya diambil dari isi basis data yang sebenarnya. Baris
        seperti "sub-second answer sync across hundreds of players"
        yang dulu ada di sini tidak pernah diukur siapa pun.
      */}
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "0 var(--sp-5) var(--sp-7)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          className="zy-panel"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            padding: "var(--sp-5)",
            gap: "var(--sp-4)",
            textAlign: "center",
          }}
        >
          {[
            { angka: "520", label: "soal siap pakai" },
            { angka: "20", label: "kuis dari 16 mata pelajaran" },
            { angka: "6", label: "ragam permainan" },
          ].map((s) => (
            <div key={s.label}>
              <div
                className="zy-num"
                style={{
                  fontSize: "var(--fs-2xl)",
                  fontWeight: "var(--fw-bold)",
                  color: "var(--t1)",
                  lineHeight: 1,
                }}
              >
                {s.angka}
              </div>
              <div className="zy-label" style={{ marginTop: "var(--sp-2)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 var(--sp-5) var(--sp-8)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h2 className="zy-h2" style={{ marginBottom: "var(--sp-5)" }}>
          Enam cara membawakannya
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--sp-3)",
          }}
        >
          {RAGAM.map((m) => (
            <div key={m.label} className="zy-panel" style={{ padding: "var(--sp-5)" }}>
              <h3 className="zy-h3" style={{ fontSize: "var(--fs-base)" }}>
                {m.label}
              </h3>
              <p className="zy-muted" style={{ marginTop: "var(--sp-2)" }}>
                {m.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer
        style={{
          borderTop: "1px solid var(--border-raw)",
          padding: "var(--sp-6) var(--sp-5)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          className="zy-row-between"
          style={{ maxWidth: 1120, margin: "0 auto", flexWrap: "wrap", gap: "var(--sp-4)" }}
        >
          <span className="zy-row" style={{ gap: "var(--sp-2)" }}>
            <Logo size={22} />
            <span className="zy-label">ZYNQIO</span>
          </span>
          <span className="zy-row" style={{ gap: "var(--sp-5)" }}>
            <Link href="/explore" className="zy-label">
              Jelajahi kuis
            </Link>
            <Link href="/auth/signin" className="zy-label">
              Masuk
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
