"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { AuthShell, AuthNotice } from "@/components/AuthShell";
import { useBahasa } from "@/lib/bahasa";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const { t } = useBahasa();
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
      else setError(t("galatPermintaan"));
    } catch {
      setError(t("sambunganBermasalah"));
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthShell
        title={t("periksaJudul")}
        subtitle={t("periksaSub")}
        footer={
          <Link href="/auth/signin" style={{ color: "var(--p2)", fontWeight: "var(--fw-medium)" }}>
            {t("kembaliMasuk")}
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
            {t("tautanTerkirimKet").split("{email}")[0]}
            <strong style={{ color: "var(--t1)" }}>{email}</strong>
            {t("tautanTerkirimKet").split("{email}")[1]}
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("lupaJudul")}
      subtitle={t("lupaSub")}
      footer={
        <Link href="/auth/signin" style={{ color: "var(--p2)", fontWeight: "var(--fw-medium)" }}>
          {t("kembaliMasuk")}
        </Link>
      }
    >
      {error && <AuthNotice kind="error">{error}</AuthNotice>}

      <form onSubmit={handleSubmit} className="zy-stack-sm">
        <div className="zy-stack-sm" style={{ gap: "var(--sp-1)" }}>
          <label htmlFor="email" className="zy-label">
            {t("labelEmail")}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="zy-input"
            placeholder={t("isiEmail")}
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
              {t("sedangMengirim")}
            </>
          ) : (
            <>
              {t("kirimTautan")} <ArrowRight size={15} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
