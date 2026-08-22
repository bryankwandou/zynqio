"use client";

// Halaman ini membaca token dari URL, jadi tidak ada gunanya diprerender.
export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { AuthShell, AuthNotice } from "@/components/AuthShell";

/** Harus sama dengan MIN_PASSWORD_LENGTH di lib/user.ts. */
const MIN_KATA_SANDI = 8;

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Tautan ini tidak lengkap atau sudah kedaluwarsa. Silakan minta tautan baru.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < MIN_KATA_SANDI) {
      setError(`Kata sandi minimal ${MIN_KATA_SANDI} karakter.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Kedua kata sandi belum sama.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/auth/signin"), 2200);
        return;
      }

      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Penggantian gagal. Tautannya mungkin sudah dipakai atau kedaluwarsa.");
    } catch {
      setError("Sambungan bermasalah. Periksa jaringan Anda lalu coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell title="Kata sandi diganti" subtitle="Anda akan diarahkan ke halaman masuk">
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
            <CheckCircle2 size={26} />
          </span>
          <p className="zy-body">Silakan masuk dengan kata sandi yang baru.</p>
        </div>
      </AuthShell>
    );
  }

  if (!token) {
    return (
      <AuthShell
        title="Tautan tidak berlaku"
        subtitle="Tautan penggantian ini tidak bisa dipakai"
        footer={
          <Link href="/auth/forgot-password" style={{ color: "var(--p2)", fontWeight: "var(--fw-medium)" }}>
            Minta tautan baru
          </Link>
        }
      >
        <AuthNotice kind="error">{error}</AuthNotice>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Kata sandi baru"
      subtitle="Pilih kata sandi yang belum pernah Anda pakai di layanan lain"
      footer={
        <Link href="/auth/signin" style={{ color: "var(--p2)", fontWeight: "var(--fw-medium)" }}>
          Kembali ke halaman masuk
        </Link>
      }
    >
      {error && <AuthNotice kind="error">{error}</AuthNotice>}

      <form onSubmit={handleSubmit} className="zy-stack-sm">
        <div className="zy-stack-sm" style={{ gap: "var(--sp-1)" }}>
          <label htmlFor="password" className="zy-label">
            Kata sandi baru
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

        <div className="zy-stack-sm" style={{ gap: "var(--sp-1)" }}>
          <label htmlFor="confirm" className="zy-label">
            Ulangi kata sandi
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="zy-input"
            placeholder="••••••••"
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
              Menyimpan
            </>
          ) : (
            <>
              Simpan kata sandi <ArrowRight size={15} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
