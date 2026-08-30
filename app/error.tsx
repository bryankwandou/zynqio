"use client";
import { useEffect } from "react";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground p-8 text-center">
      <div className="text-6xl mb-6">⚠️</div>
      <h2 className="text-2xl font-black mb-3">Ada yang tidak beres</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">{error.message || "Terjadi kesalahan yang tidak terduga. Coba muat ulang halaman ini."}</p>
      <div className="flex gap-4">
        <button onClick={reset} className="zy-btn zy-btn-primary zy-btn-lg">Coba lagi</button>
        <a href="/" className="zy-btn zy-btn-ghost zy-btn-lg">Kembali ke halaman depan</a>
      </div>
    </div>
  );
}
