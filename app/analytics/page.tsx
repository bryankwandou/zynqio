"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AnalyticsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/history?tab=kuis");
  }, [router]);

  return (
    <div className="zy-stack" style={{ minHeight: "100vh", alignItems: "center", justifyContent: "center", gap: "var(--sp-4)" }}>
      <Loader2 size={28} className="animate-spin" style={{ color: "var(--p)" }} aria-hidden="true" />
      <p className="zy-muted" role="status">Membuka Riwayat…</p>
    </div>
  );
}
