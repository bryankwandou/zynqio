"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NotFound() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError("Please enter a 6-character game code.");
      return;
    }
    setError("");
    router.push(`/join/${trimmed}`);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
      style={{ backgroundColor: "#0f0f1a", color: "#ffffff" }}
    >
      {/* 404 */}
      <div
        className="text-[10rem] md:text-[14rem] font-black leading-none select-none"
        style={{
          background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #a855f7 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        404
      </div>

      <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight mt-2 mb-3">
        Oops! Page not found
      </h1>
      <p className="text-white/50 font-medium mb-10 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      {/* Go Home */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm text-white mb-12 transition-all hover:scale-105"
        style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
      >
        Go Home
      </Link>

      {/* Join a Game */}
      <div
        className="w-full max-w-sm rounded-[2rem] p-8 border"
        style={{ backgroundColor: "#16162a", borderColor: "#2a2a45" }}
      >
        <p className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-4">
          Or Join a Game
        </p>
        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
            maxLength={6}
            placeholder="ENTER CODE"
            className="w-full text-center text-2xl font-black tracking-[0.3em] rounded-xl py-4 outline-none transition-all"
            style={{
              backgroundColor: "#0f0f1a",
              border: "1px solid #2a2a45",
              color: "#ffffff",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a45")}
          />
          {error && (
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest">{error}</p>
          )}
          <button
            type="submit"
            disabled={code.length !== 6}
            className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm text-white transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
          >
            Join Battle
          </button>
        </form>
      </div>
    </div>
  );
}
