"use client";

import { useState, use, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AVATARS, getAvatar } from "@/lib/avatars";

export default function NicknamePage({ params }: { params: Promise<{ roomCode: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const roomCode = unwrappedParams.roomCode.toUpperCase();

  const [nickname, setNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[Math.floor(Math.random() * AVATARS.length)].id);
  const [isLoading, setIsLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Check for existing session — redirect if reconnecting (non-blocking)
  useEffect(() => {
    const existingToken = localStorage.getItem("zynqio_session_token");
    const existingRoom = localStorage.getItem("zynqio_room_code");
    const existingNick = localStorage.getItem("zynqio_nickname");

    if (existingToken && existingRoom === roomCode && existingNick) {
      setRedirecting(true);
      router.replace(`/play/${roomCode}/lobby`);
    } else {
      // Focus input immediately once form is mounted
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [roomCode, router]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          playerName: nickname.trim(),
          avatarId: selectedAvatar,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("zynqio_nickname", data.player.name);
        localStorage.setItem("zynqio_player_id", data.player.id);
        localStorage.setItem("zynqio_session_token", data.player.token);
        localStorage.setItem("zynqio_room_code", roomCode);
        localStorage.setItem("zynqio_avatar", selectedAvatar);
        router.push(`/play/${roomCode}/lobby`);
      } else {
        setErrorMsg(data.error || "Failed to join room.");
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch {
      setErrorMsg("Connection error. Please try again.");
      setIsLoading(false);
    }
  };

  if (redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 font-medium">Reconnecting to room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] p-4">
      <div className="w-full max-w-lg">
        {/* Room code badge */}
        <div className="text-center mb-6">
          <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-sm font-bold tracking-widest uppercase">
            Room: {roomCode}
          </span>
        </div>

        <div className="bg-[#16162a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center">
            <h1 className="text-2xl font-black text-white">Choose Your Avatar</h1>
            <p className="text-blue-200 text-sm mt-1">Pick a character and enter your name</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Avatar Grid */}
            <div className="grid grid-cols-5 gap-2">
              {AVATARS.map((avatar) => {
                const isSelected = selectedAvatar === avatar.id;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar.id)}
                    className={`relative flex flex-col items-center justify-center rounded-xl p-2 transition-all duration-200 ${
                      isSelected
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#16162a] scale-110 shadow-lg"
                        : "hover:scale-105 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatar.bg} flex items-center justify-center text-2xl shadow`}>
                      {avatar.emoji}
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#16162a]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected avatar display */}
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatar(selectedAvatar).bg} flex items-center justify-center text-xl`}>
                {getAvatar(selectedAvatar).emoji}
              </div>
              <span className="text-sm text-white/50">
                Selected: <span className="font-bold text-white capitalize">{selectedAvatar}</span>
              </span>
            </div>

            {/* Nickname input */}
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-white/40 uppercase tracking-wider block mb-2">
                  Your Nickname
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter your nickname..."
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full text-center text-xl bg-white/5 border-2 border-white/10 text-white rounded-xl py-4 focus:border-blue-500 focus:bg-white/8 outline-none transition-all placeholder:text-white/20"
                  maxLength={50}
                  required
                />
              </div>

              {errorMsg && (
                <div className="text-red-400 text-sm text-center font-medium bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  {errorMsg}
                </div>
              )}

              <Button
                type="submit"
                disabled={!nickname.trim() || isLoading}
                className="w-full py-6 text-lg font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-40 transition-all"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Joining...
                  </span>
                ) : (
                  "Enter Game →"
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
