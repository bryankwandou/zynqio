"use client";
import { useEffect } from "react";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground p-8 text-center">
      <div className="text-6xl mb-6">⚠️</div>
      <h2 className="text-2xl font-black mb-3">Something went wrong</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">{error.message || "An unexpected error occurred."}</p>
      <div className="flex gap-4">
        <button onClick={reset} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl">Try Again</button>
        <a href="/" className="px-6 py-3 bg-white/10 hover:bg-white/20 font-bold rounded-xl">Go Home</a>
      </div>
    </div>
  );
}
