"use client";

import { useEffect, useState } from "react";

interface Props {
  message?: string;
  timeout?: number; // ms before showing error
  onTimeout?: () => void;
}

export function LoadingScreen({
  message = "Loading...",
  timeout = 10000,
  onTimeout,
}: Props) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!timeout) return;
    const t = setTimeout(() => {
      setTimedOut(true);
      onTimeout?.();
    }, timeout);
    return () => clearTimeout(t);
  }, [timeout, onTimeout]);

  if (timedOut) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <div className="text-5xl mb-6">⚠️</div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Connection Lost</h2>
        <p className="text-muted-foreground mb-6">
          Could not reach the server. Please check your connection.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      {/* Zynqio logo pulse */}
      <div className="relative mb-8">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-white text-2xl shadow-2xl animate-pulse">
          Z
        </div>
        <div className="absolute inset-0 bg-blue-600/30 rounded-2xl blur-xl animate-ping" />
      </div>

      {/* Spinner */}
      <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6" />

      {/* Contextual message */}
      <p className="text-muted-foreground font-medium text-center max-w-xs">{message}</p>
    </div>
  );
}
