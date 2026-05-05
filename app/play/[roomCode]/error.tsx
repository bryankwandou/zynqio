"use client";

import { useEffect } from "react";

export default function PlayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PlayError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
      <div className="text-6xl mb-6">🔌</div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Game connection error</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">
        Lost connection to the game. Try reconnecting.
      </p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all"
        >
          Reconnect
        </button>
        <a
          href="/"
          className="px-6 py-3 border border-border text-foreground rounded-xl font-bold hover:bg-accent transition-all"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
