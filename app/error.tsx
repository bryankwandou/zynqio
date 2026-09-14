"use client";
import { useBahasa } from "@/lib/bahasa";
import { useEffect } from "react";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const { tt } = useBahasa();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground p-8 text-center">
      <div className="text-6xl mb-6">⚠️</div>
      <h2 className="text-2xl font-black mb-3">{tt("Ada yang tidak beres", "Something went wrong")}</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">{error.message || tt("Terjadi kesalahan yang tidak terduga. Coba muat ulang halaman ini.", "An unexpected error occurred. Try reloading this page.")}</p>
      <div className="flex gap-4">
        <button onClick={reset} className="zy-btn zy-btn-primary zy-btn-lg">{tt("Coba lagi", "Try again")}</button>
        <a href="/" className="zy-btn zy-btn-ghost zy-btn-lg">{tt("Kembali ke halaman depan", "Back to the home page")}</a>
      </div>
    </div>
  );
}
