"use client";

// Halaman ini membaca token dari URL, jadi tidak ada gunanya diprerender.
export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { AuthShell, AuthNotice } from "@/components/AuthShell";
import { useBahasa } from "@/lib/bahasa";

/** Harus sama dengan MIN_PASSWORD_LENGTH di lib/user.ts. */
const MIN_KATA_SANDI = 8;

function ResetForm() {
  const { t } = useBahasa();
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
      setError(t("tautanTakLengkap"));
    }
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < MIN_KATA_SANDI) {
      setError(t("minKarakter").replace("{n}", String(MIN_KATA_SANDI)));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("sandiBelumSama"));
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
      setError(data?.error ?? t("galatGantiSandi"));
    } catch {
      setError(t("sambunganBermasalah"));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell title={t("sandiDigantiJudul")} subtitle={t("sandiDigantiSub")}>
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
          <p className="zy-body">{t("sandiDigantiKet")}</p>
        </div>
      </AuthShell>
    );
  }

  if (!token) {
    return (
      <AuthShell
        title={t("tautanMatiJudul")}
        subtitle={t("tautanMatiSub")}
        footer={
          <Link href="/auth/forgot-password" style={{ color: "var(--p2)", fontWeight: "var(--fw-medium)" }}>
            {t("mintaTautanBaru")}
          </Link>
        }
      >
        <AuthNotice kind="error">{error}</AuthNotice>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("sandiBaruJudul")}
      subtitle={t("sandiBaruSub")}
      footer={
        <Link href="/auth/signin" style={{ color: "var(--p2)", fontWeight: "var(--fw-medium)" }}>
          {t("kembaliMasuk")}
        </Link>
      }
    >
      {error && <AuthNotice kind="error">{error}</AuthNotice>}

      <form onSubmit={handleSubmit} className="zy-stack-sm">
        <div className="zy-stack-sm" style={{ gap: "var(--sp-1)" }}>
          <label htmlFor="password" className="zy-label">
            {t("labelSandiBaru")}
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
            {t("minKarakter").replace("{n}", String(MIN_KATA_SANDI))}
          </p>
        </div>

        <div className="zy-stack-sm" style={{ gap: "var(--sp-1)" }}>
          <label htmlFor="confirm" className="zy-label">
            {t("labelSandiUlang")}
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
              {t("sedangMenyimpan")}
            </>
          ) : (
            <>
              {t("simpanSandi")} <ArrowRight size={15} aria-hidden="true" />
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
