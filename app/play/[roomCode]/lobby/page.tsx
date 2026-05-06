"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAvatar } from "@/lib/avatars";

type Player = {
  id: string;
  name: string;
  avatarId?: string;
};

export default function PlayerLobby({ params }: { params: Promise<{ roomCode: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const roomCode = unwrappedParams.roomCode.toUpperCase();

  const [nickname, setNickname] = useState("");
  const [myAvatar, setMyAvatar] = useState("fox");
  const [players, setPlayers] = useState<Player[]>([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [gameMode, setGameMode] = useState("classic");
  const [team, setTeam] = useState<string | null>(null);
  const [isKicked, setIsKicked] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(0);
  const [connectionError, setConnectionError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const savedName = localStorage.getItem("zynqio_nickname");
    const savedAvatar = localStorage.getItem("zynqio_avatar") || "fox";
    const savedToken = localStorage.getItem("zynqio_session_token");

    if (!savedName || !savedToken) {
      router.replace(`/play/${roomCode}/nickname`);
      return;
    }

    setNickname(savedName);
    setMyAvatar(savedAvatar);
  }, [roomCode, router]);

  const poll = useCallback(async () => {
    try {
      const url = lastUpdatedAt
        ? `/api/room/state?code=${roomCode}&since=${lastUpdatedAt}`
        : `/api/room/state?code=${roomCode}`;

      const res = await fetch(url);

      if (res.status === 304) {
        setConnectionError(false);
        return; // No change, skip
      }

      if (!res.ok) {
        setConnectionError(true);
        return;
      }

      const state = await res.json();
      setConnectionError(false);

      if (state.updatedAt) setLastUpdatedAt(state.updatedAt);

      // Kicked detection
      const savedName = localStorage.getItem("zynqio_nickname") || "";
      const savedToken = localStorage.getItem("zynqio_session_token") || "";
      const kicked = (state.kickedPlayers || []).some(
        (k: string) => k === savedName || k === savedName.toLowerCase() || k === savedToken
      );

      if (kicked) {
        setIsKicked(true);
        // Clear session data
        localStorage.removeItem("zynqio_nickname");
        localStorage.removeItem("zynqio_session_token");
        localStorage.removeItem("zynqio_player_id");
        localStorage.removeItem("zynqio_room_code");
        setTimeout(() => router.replace("/?kicked=1"), 2000);
        return;
      }

      if (state.players) {
        setPlayers(state.players);

        if (state.gameMode === "team") {
          setGameMode("team");
          const playerIdx = state.players.findIndex((p: Player) => p.name === savedName);
          if (playerIdx !== -1) {
            setTeam(playerIdx % 2 === 0 ? "Red Team" : "Blue Team");
          }
        }
      }

      if (state.quizTitle) setQuizTitle(state.quizTitle);

      if (state.status === "playing") {
        router.push(`/play/${roomCode}/game`);
      }

      setRetryCount(0);
    } catch {
      setRetryCount((c) => c + 1);
      if (retryCount > 3) setConnectionError(true);
    }
  }, [roomCode, router, lastUpdatedAt, retryCount]);

  useEffect(() => {
    if (!nickname) return;
    poll();
    const interval = setInterval(poll, 2500);
    return () => clearInterval(interval);
  }, [nickname, poll]);

  const avatarInfo = getAvatar(myAvatar);

  if (isKicked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="text-6xl">😔</div>
          <h2 className="text-2xl font-bold text-foreground">You were removed</h2>
          <p className="text-muted-foreground">The host removed you from this room.</p>
          <p className="text-sm text-muted-foreground">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground overflow-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-background to-background pointer-events-none" />

      {/* Connection error banner */}
      {connectionError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white text-center text-sm font-bold py-2">
          Connection lost — retrying...
        </div>
      )}


<div className="relative z-10 flex flex-col items-center flex-1 p-4 pt-8">
        {/* Room code pill */}
        <div className="inline-block px-5 py-2 rounded-full bg-card border border-border text-sm font-bold mb-8 text-muted-foreground">
          Room: <span className="text-foreground tracking-widest ml-1">{roomCode}</span>
        </div>

        {/* Player identity */}
        <div className="flex flex-col items-center mb-8">
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarInfo.bg} flex items-center justify-center text-4xl shadow-2xl mb-3 ring-4 ring-white/20`}>
            {avatarInfo.emoji}
          </div>
          <h1 className="text-3xl font-black text-foreground">
            You&apos;re in,{" "}
            <span className="text-blue-400">
              {nickname.slice(0, 20)}{nickname.length > 20 ? "..." : ""}
            </span>
            !
          </h1>
          {quizTitle && (
            <p className="text-muted-foreground mt-2 text-sm">
              Quiz: <span className="font-semibold text-foreground">{quizTitle}</span>
            </p>
          )}
        </div>

        {/* Team badge */}
        {gameMode === "team" && team && (
          <div className={`mb-6 px-8 py-4 rounded-2xl border-2 ${
            team === "Red Team"
              ? "bg-red-500/20 border-red-500 text-red-400"
              : "bg-blue-500/20 border-blue-500 text-blue-400"
          }`}>
            <span className="text-xs font-black uppercase tracking-widest block mb-1">Your Team</span>
            <span className="text-2xl font-black">{team}</span>
          </div>
        )}

        {/* Players grid */}
        <div className="w-full max-w-2xl bg-card border border-border rounded-2xl overflow-hidden shadow-xl mb-8">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-accent/30">
            <span className="font-bold text-sm text-foreground">Players in lobby</span>
            <span className="bg-blue-600 text-white text-xs font-black px-2.5 py-1 rounded-full">
              {players.length}
            </span>
          </div>

          <div className="p-4">
            {players.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No players yet...
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {players.map((p) => {
                  const av = getAvatar(p.avatarId);
                  const isMe = p.name === nickname;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                        isMe
                          ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30"
                          : "border-border bg-accent/20"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${av.bg} flex items-center justify-center text-base`}>
                        {av.emoji}
                      </div>
                      <span className={`text-sm font-medium ${isMe ? "text-blue-400 font-bold" : "text-foreground"}`}>
                        {p.name.slice(0, 16)}{p.name.length > 16 ? "..." : ""}
                        {isMe && <span className="ml-1 text-[10px] text-blue-300">(you)</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Waiting animation */}
        <div className="flex flex-col items-center">
          <div className="flex gap-1.5 mb-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-muted-foreground font-medium text-sm">
            Host will start soon...
          </p>
        </div>
      </div>
    </div>
  );
}
