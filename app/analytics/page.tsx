"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AnalyticsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/history");
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Loader2 size={28} className="animate-spin" style={{ color: "var(--p)" }} />
      <p style={{ fontSize: 14, color: "var(--t3)" }}>Redirecting to History &amp; Analytics…</p>
    </div>
  );
}
