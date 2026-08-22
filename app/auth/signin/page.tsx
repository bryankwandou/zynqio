"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthShell, AuthNotice } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.4-.2-2.1H12v3.9h5.9c-.1.9-.8 2.3-2.3 3.3L18 19.5c2.2-2 3.5-5 3.5-7.2z"/>
      <path fill="#34A853" d="M12 23c3.2 0 5.8-1 7.7-2.8l-3.7-2.9c-1 .7-2.3 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9l-4 3C3.4 20.5 7.4 23 12 23z"/>
      <path fill="#FBBC04" d="M5.4 13.5C5.2 12.9 5.1 12.2 5.1 11.5s.1-1.4.3-2L1.4 6.5C.5 8 0 9.7 0 11.5s.5 3.5 1.4 5l4-3z"/>
      <path fill="#EA4335" d="M12 4.6c1.8 0 3 .8 3.7 1.4l2.7-2.6C16.7 1.9 14.4 1 12 1 7.4 1 3.4 3.5 1.4 6.5l4 3C6.3 6.7 8.9 4.6 12 4.6z"/>
    </svg>
  );
}

function SignInForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const registered = searchParams.get("registered");
  const router = useRouter();

  /**
   * Alamat tujuan setelah berhasil masuk.
   *
   * Middleware menitipkannya saat mengalihkan orang yang belum masuk,
   * supaya guru yang menekan tautan ruangan langsung kembali ke sana
   * dan tidak dilempar ke daftar kuis lalu harus menelusuri ulang.
   *
   * Hanya lintasan internal yang diterima. Tanpa pemeriksaan ini,
   * seseorang bisa mengirimkan tautan masuk yang berujung memantulkan
   * korbannya ke situs lain begitu ia berhasil masuk — dan pantulan itu
   * terlihat sah karena berangkat dari alamat ZYNQIO yang benar.
   */
  const tujuanMentah = searchParams.get("callbackUrl") ?? "/dashboard";
  const tujuan = tujuanMentah.startsWith("/") && !tujuanMentah.startsWith("//")
    ? tujuanMentah
    : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  // Pesan yang sama untuk email keliru maupun kata sandi keliru.
  // Membedakan keduanya memberi tahu orang asing bahwa sebuah email
  // terdaftar di sini, dan itu keterangan yang tidak perlu ia miliki.
  const errorMsg =
    localError ||
    (urlError === "CredentialsSignin"
      ? "Email atau kata sandi tidak cocok."
      : urlError
        ? "Proses masuk gagal. Coba lagi sebentar lagi."
        : "");

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLocalError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setLocalError(
        result.error === "CredentialsSignin"
          ? "Email atau kata sandi tidak cocok."
          : "Proses masuk gagal. Coba lagi sebentar lagi."
      );
      setIsLoading(false);
    } else {
      router.push(tujuan);
    }
  };

  return (
    <AuthShell
      title="Masuk"
      subtitle="Lanjutkan ke ruang kerja Anda"
      footer={
        <>
          Belum punya akun?{" "}
          <Link href="/auth/signup" style={{ color: "var(--p2)", fontWeight: "var(--fw-medium)" }}>
            Buat sekarang
          </Link>
        </>
      }
    >
      {registered && <AuthNotice kind="success">Akun Anda sudah dibuat. Silakan masuk.</AuthNotice>}
      {errorMsg && <AuthNotice kind="error">{errorMsg}</AuthNotice>}

      {/*
        Masuk lewat Google belum tersedia.

        GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum pernah diisi,
        sehingga penyedia itu tidak pernah terdaftar di next-auth —
        /api/auth/providers hanya menyebut "credentials". Tombol yang
        sebelumnya ada di sini memanggil signIn("google") yang langsung
        berujung di halaman galat, tanpa penjelasan apa pun bagi orang
        yang menekannya.

        Tombol dinonaktifkan, bukan disembunyikan, supaya jelas bahwa
        jalur ini memang direncanakan dan bukan sesuatu yang hilang.
      */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="zy-btn zy-btn-secondary"
        style={{ width: "100%" }}
      >
        <GoogleIcon /> Masuk dengan Google
        <span className="zy-badge" style={{ marginLeft: "var(--sp-1)" }}>
          Segera
        </span>
      </button>

      <div
        className="zy-row"
        aria-hidden="true"
        style={{
          margin: "var(--sp-5) 0",
          color: "var(--t4)",
          fontSize: "var(--fs-xs)",
          fontWeight: "var(--fw-medium)",
          letterSpacing: "0.1em",
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--border-raw)" }} />
        ATAU
        <span style={{ flex: 1, height: 1, background: "var(--border-raw)" }} />
      </div>

      {/*
        Tiap kolom punya label sungguhan, bukan hanya placeholder.
        Placeholder lenyap begitu orang mulai mengetik — persis saat
        keterangan itu paling dibutuhkan untuk memeriksa ulang isian.
      */}
      <form onSubmit={handleEmailLogin} className="zy-stack-sm">
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
          <label htmlFor="password" className="zy-label">
            Kata sandi
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="zy-input"
            placeholder="••••••••"
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link
            href="/auth/forgot-password"
            style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-medium)", color: "var(--p2)" }}
          >
            Lupa kata sandi?
          </Link>
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
              Sedang masuk
            </>
          ) : (
            <>
              Masuk <ArrowRight size={15} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
