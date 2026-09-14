"use client";

import { useBahasa } from "@/lib/bahasa";
import { useEffect } from "react";

export default function PlayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { tt } = useBahasa();
  useEffect(() => {
    console.error("[PlayError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
      <div className="text-6xl mb-6">🔌</div>
      <h2 className="text-2xl font-bold text-foreground mb-2">{tt("Sambungan ke permainan terputus", "Lost connection to the game")}</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">
        {tt("Ponsel Anda kehilangan sambungan ke ruangan. Skor yang sudah masuk tetap tersimpan.", "Your phone lost its connection to the room. Scores already recorded are kept.")}
      </p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold zy-motion"
        >
          {tt("Sambungkan lagi", "Reconnect")}
        </button>
        <a
          href="/"
          className="px-6 py-3 border border-border text-foreground rounded-xl font-bold hover:bg-accent zy-motion"
        >
          {tt("Ke beranda", "Go home")}
        </a>
      </div>
    </div>
  );
}
