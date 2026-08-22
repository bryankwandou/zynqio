"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthShell, AuthNotice } from "@/components/AuthShell";

/**
 * Panjang minimum kata sandi.
 *
 * Angkanya sengaja diambil dari satu tempat dan disebut di teks bantuan
 * maupun di atribut minLength. Sebelumnya halaman ini menjanjikan
 * "min. 6 characters" sementara peladen menolak apa pun di bawah
 * delapan — orang mengetik enam karakter, menekan Daftar, lalu ditolak
 * tanpa pernah diberi tahu aturan yang sebenarnya.
 *
 * Nilainya harus sama dengan MIN_PASSWORD_LENGTH di lib/user.ts.
 */
const MIN_KATA_SANDI = 8;

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Diperiksa di peramban lebih dulu supaya orang tidak perlu
    // menunggu perjalanan ke peladen untuk tahu kata sandinya kurang
    // panjang. Peladen tetap memeriksanya sendiri — pemeriksaan di sisi
    // peramban adalah kemudahan, bukan penjagaan.
    if (password.length < MIN_KATA_SANDI) {
      setError(`Kata sandi minimal ${MIN_KATA_SANDI} karakter.`);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });

      if (res.ok) {
        router.push("/auth/signin?registered=1");
        return;
      }

      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Pendaftaran gagal. Coba lagi sebentar lagi.");
    } catch {
      setError("Sambungan bermasalah. Periksa jaringan Anda lalu coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Buat akun"
      subtitle="Mulai susun kuis untuk kelas Anda"
      footer={
        <>
          Sudah punya akun?{" "}
          <Link href="/auth/signin" style={{ color: "var(--p2)", fontWeight: "var(--fw-medium)" }}>
            Masuk di sini
          </Link>
        </>
      }
    >
      {error && <AuthNotice kind="error">{error}</AuthNotice>}

      <form onSubmit={handleSubmit} className="zy-stack-sm">
        <div className="zy-stack-sm" style={{ gap: "var(--sp-1)" }}>
          <label htmlFor="email" className="zy-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="zy-input"
            placeholder="nama@sekolah.sch.id"
          />
        </div>

        <div className="zy-stack-sm" style={{ gap: "var(--sp-1)" }}>
          <label htmlFor="username" className="zy-label">
            Nama tampilan
          </label>
          <input
            id="username"
            type="text"
            required
            minLength={2}
            maxLength={60}
            autoComplete="nickname"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="zy-input"
            placeholder="Nama yang dilihat peserta"
          />
        </div>

        <div className="zy-stack-sm" style={{ gap: "var(--sp-1)" }}>
          <label htmlFor="password" className="zy-label">
            Kata sandi
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={MIN_KATA_SANDI}
            autoComplete="new-password"
            aria-describedby="bantuan-sandi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="zy-input"
            placeholder="••••••••"
          />
          <p id="bantuan-sandi" className="zy-label" style={{ color: "var(--t4)" }}>
            Minimal {MIN_KATA_SANDI} karakter.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="zy-btn zy-btn-primary"
          style={{ width: "100%", marginTop: "var(--sp-1)" }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Sedang mendaftar
            </>
          ) : (
            <>
              Daftar <ArrowRight size={15} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
