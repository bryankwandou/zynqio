"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { AuthShell, AuthNotice } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Tanggapan yang sama entah emailnya terdaftar atau tidak.
      // Membedakannya akan memberi tahu orang asing alamat mana yang
      // punya akun di sini.
      if (res.ok) setSubmitted(true);
      else setError("Permintaan gagal diproses. Coba lagi sebentar lagi.");
    } catch {
      setError("Sambungan bermasalah. Periksa jaringan Anda lalu coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthShell
        title="Periksa kotak masuk"
        subtitle="Tautan penggantian sudah dikirim bila email itu terdaftar"
        footer={
          <Link href="/auth/signin" style={{ color: "var(--p2)", fontWeight: "var(--fw-medium)" }}>
            Kembali ke halaman masuk
          </Link>
        }
      >
        <div className="zy-stack" style={{ alignItems: "center", textAlign: "center" }}>
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: 56,
              height: 56,
              borderRadius: "var(--r-full)",
              background: "rgba(5,150,105,0.12)",
              color: "var(--green)",
            }}
          >
            <MailCheck size={26} />
          </span>
          <p className="zy-body zy-prose">
            Kami mengirim tautan ke <strong style={{ color: "var(--t1)" }}>{email}</strong> apabila
            alamat itu terdaftar. Tautannya berlaku satu jam. Bila tidak ada di kotak masuk, coba
            periksa folder spam.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Lupa kata sandi"
      subtitle="Masukkan email Anda untuk menerima tautan penggantian"
      footer={
        <Link href="/auth/signin" style={{ color: "var(--p2)", fontWeight: "var(--fw-medium)" }}>
          Kembali ke halaman masuk
        </Link>
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

        <button
          type="submit"
          disabled={isLoading}
          className="zy-btn zy-btn-primary"
          style={{ width: "100%", marginTop: "var(--sp-1)" }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Mengirim
            </>
          ) : (
            <>
              Kirim tautan <ArrowRight size={15} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
