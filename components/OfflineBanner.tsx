"use client";

import { useBahasa } from "@/lib/bahasa";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const { tt } = useBahasa();
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 2500);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // Initial check
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] text-center text-sm font-bold py-2.5 zy-motion duration-300 ${
        isOnline
          ? "bg-green-500 text-white"
          : "bg-red-500 text-white animate-pulse"
      }`}
    >
      {isOnline ? tt("✓ Tersambung!", "✓ Connected!") : tt("⚠️ Tidak ada sambungan — mencoba menyambung lagi…", "⚠️ No connection — trying to reconnect…")}
    </div>
  );
}
