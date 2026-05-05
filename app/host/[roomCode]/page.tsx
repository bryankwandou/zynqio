"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import QRCode from "react-qr-code";
import { Users, Play, Copy, X, Rocket, Trophy, Shuffle, Eye, Lock, Clock } from "lucide-react";
import { getPusherClient } from "@/lib/pusher-client";
import { getAvatar } from "@/lib/avatars";

const GAME_MODES = [
  { id: "classic",      name: "Classic",      icon: "🏆", desc: "Standard scoring" },
  { id: "speed_rush",   name: "Speed Rush",   icon: "⚡", desc: "Faster = more pts" },
  { id: "battle_royale",name: "Battle Royale",icon: "⚔️", desc: "Elimination rounds" },
  { id: "survival",     name: "Survival",     icon: "🏔️", desc: "Don't miss or reset" },
  { id: "gold_quest",   name: "Gold Quest",   icon: "💰", desc: "Chests & stealing" },
  { id: "team",         name: "Team Mode",    icon: "👥", desc: "Collaborate to win" },
];

const TIMERS = [10, 15, 20, 30, 45, 60, 90];

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${on ? "bg-blue-600" : "bg-white/10"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-6" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function HostLobby({ params }: { params: Promise<{ roomCode: string }> }) {
  const { status } = useSession();
  const router = useRouter();
  const unwrappedParams = use(params);
  const roomCode = unwrappedParams.roomCode;

  const [players, setPlayers] = useState<{ id: string; name: string; avatarId?: string }[]>([]);
  const [copySuccess, setCopySuccess] = useState("");
  const [isFullScreenQR, setIsFullScreenQR] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // Launch modal
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [gameMode, setGameMode] = useState<string>("classic");
  const [globalTimer, setGlobalTimer] = useState(30);
  const [winnerCount, setWinnerCount] = useState(3);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [showAnswerAfter, setShowAnswerAfter] = useState(true);
  const [oneAttemptOnly, setOneAttemptOnly] = useState(true);
  const [memeMode, setMemeMode] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);

  // Team auto-assign (team mode only)
  const [teams, setTeams] = useState<Record<string, any[]>>({});

  const autoAssignTeams = (count: number) => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const newTeams: Record<string, any[]> = {};
    for (let i = 0; i < count; i++) newTeams[`Team ${i + 1}`] = [];
    shuffled.forEach((p, idx) => newTeams[`Team ${(idx % count) + 1}`].push(p));
    setTeams(newTeams);
    fetch("/api/room/update-teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCode, teams: newTeams }),
    });
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch(`/api/room/state?code=${roomCode}`);
        if (res.ok) {
          const state = await res.json();
          if (state?.players) setPlayers(state.players);
        }
      } catch {}
    };

    fetchPlayers();
    const interval = setInterval(fetchPlayers, 2000);

    const pusher = getPusherClient();
    const channel = pusher.subscribe(`room-${roomCode}`);
    channel.bind("player_joined", () => fetchPlayers());

    return () => {
      clearInterval(interval);
      pusher.unsubscribe(`room-${roomCode}`);
    };
  }, [roomCode]);

  const handleLaunch = async () => {
    setIsLaunching(true);
    try {
      await fetch("/api/room/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          gameMode,
          settings: {
            timer: globalTimer,
            showAnswerAfter,
            winnerCount,
            shuffleQuestions,
            memeMode,
            oneAttemptOnly,
            autoAdvance,
            maxPlayers: 300,
          },
        }),
      });
      router.push(`/host/${roomCode}/play`);
    } catch {
      setIsLaunching(false);
    }
  };

  const handleKickPlayer = async (playerId: string, playerName: string) => {
    await fetch("/api/room/kick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCode, playerId: playerName }),
    });
    setPlayers((prev) => prev.filter((p) => p.name !== playerName && p.id !== playerId));
  };

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${roomCode}` : "";

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(""), 2000);
  };

  if (status === "loading") return <div className="min-h-screen bg-[#0f0f1a]" />;

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f1a] text-white overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10 bg-[#16162a] flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-black text-lg">Z</div>
          <span className="font-bold text-white/80">Host Control</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-white/50 flex items-center gap-1.5">
            <Users size={14} className="text-blue-400" />
            <span className="font-bold text-white">{players.length}</span> players
          </div>
          <Button
            onClick={() => setShowLaunchModal(true)}
            className="bg-green-500 hover:bg-green-400 text-black font-black px-6 rounded-xl shadow-lg shadow-green-900/30"
          >
            <Rocket size={16} className="mr-2" /> Start Game
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row p-6 gap-6 overflow-hidden">
        {/* Left: Join Info */}
        <div className="w-full md:w-80 shrink-0 flex flex-col gap-4">
          <div className="bg-[#16162a] border border-white/10 rounded-2xl p-6 flex flex-col items-center shadow-xl">
            <div className="text-white/50 text-sm font-medium mb-1">Join at</div>
            <div className="text-blue-400 font-bold text-base mb-4">zynqio.vercel.app</div>

            <div className="text-white/40 text-xs uppercase tracking-widest mb-2">Game Code</div>
            <div className="text-5xl font-black tracking-[0.2em] text-white mb-6 bg-white/5 px-6 py-3 rounded-2xl border border-white/10 w-full text-center">
              {roomCode}
            </div>

            <div
              className="bg-white p-3 rounded-xl cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setIsFullScreenQR(true)}
            >
              <QRCode value={joinUrl} size={160} />
            </div>
            <p className="mt-2 text-xs text-white/30">Tap to enlarge</p>

            <div className="flex gap-2 mt-4 w-full">
              <button
                onClick={() => copyText(joinUrl, "Link copied!")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 rounded-xl transition-all"
              >
                <Copy size={12} /> Copy Link
              </button>
              <button
                onClick={() => copyText(roomCode, "Code copied!")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-white/10 hover:bg-white/15 rounded-xl border border-white/10 transition-all"
              >
                <Copy size={12} /> Copy Code
              </button>
            </div>
            {copySuccess && <div className="mt-2 text-xs text-green-400 font-bold">{copySuccess}</div>}
          </div>

          {/* Game info preview */}
          <div className="bg-[#16162a] border border-white/10 rounded-2xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/40">Mode</span>
              <span className="font-bold text-blue-400">{GAME_MODES.find((m) => m.id === gameMode)?.name || "Classic"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Timer</span>
              <span className="font-bold text-white">{globalTimer}s / question</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Podium</span>
              <span className="font-bold text-yellow-400">Top {winnerCount}</span>
            </div>
          </div>
        </div>

        {/* Right: Player Grid */}
        <div className="flex-1 flex flex-col bg-[#16162a] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center">
            <span className="font-bold text-white flex items-center gap-2">
              <Users size={16} className="text-blue-400" /> Players in Lobby
            </span>
            <span className="bg-blue-600 text-white text-xs font-black px-3 py-1 rounded-full">{players.length}</span>
          </div>

          <div className="flex-1 p-5 overflow-y-auto">
            {players.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-white/30">
                <div className="w-12 h-12 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin mb-4" />
                <p>Waiting for players...</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {players.map((p) => {
                  const av = getAvatar(p.avatarId);
                  return (
                    <div
                      key={p.id}
                      className="group flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl border border-white/10 transition-colors cursor-default"
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${av.bg} flex items-center justify-center text-base shrink-0`}>
                        {av.emoji}
                      </div>
                      <span className="text-sm font-medium text-white/80">{p.name.slice(0, 16)}{p.name.length > 16 ? "…" : ""}</span>
                      <button
                        onClick={() => handleKickPlayer(p.id, p.name)}
                        className="ml-1 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Fullscreen QR ───────────────────────── */}
      {isFullScreenQR && (
        <div className="fixed inset-0 z-50 bg-[#0f0f1a] flex flex-col items-center justify-center">
          <button
            className="absolute top-6 right-6 text-white/40 hover:text-white bg-white/10 p-3 rounded-full"
            onClick={() => setIsFullScreenQR(false)}
          >
            <X size={28} />
          </button>
          <p className="text-white/50 text-lg mb-2">Join at</p>
          <p className="text-blue-400 text-2xl font-bold mb-8">zynqio.vercel.app</p>
          <div className="bg-white p-6 rounded-3xl mb-8">
            <QRCode value={joinUrl} size={360} />
          </div>
          <p className="text-white/40 text-sm uppercase tracking-widest mb-2">or enter code</p>
          <p className="text-white text-7xl font-black tracking-[0.2em]">{roomCode}</p>
        </div>
      )}

      {/* ── Launch Modal ─────────────────────────── */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16162a] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#16162a] z-10">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2">
                  <Rocket className="text-green-400" size={20} /> Launch Settings
                </h2>
                <p className="text-white/40 text-sm mt-0.5">{players.length} players ready</p>
              </div>
              <button onClick={() => setShowLaunchModal(false)} className="text-white/40 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* Game Mode */}
              <div>
                <label className="text-xs font-black text-white/40 uppercase tracking-widest block mb-3">Game Mode</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {GAME_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setGameMode(mode.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        gameMode === mode.id
                          ? "border-blue-500 bg-blue-500/15 shadow-lg shadow-blue-900/20"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="text-xl mb-1">{mode.icon}</div>
                      <div className={`font-bold text-sm ${gameMode === mode.id ? "text-blue-400" : "text-white/80"}`}>{mode.name}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{mode.desc}</div>
                    </button>
                  ))}
                </div>

                {gameMode === "team" && (
                  <div className="mt-3 p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-white/70">Auto-assign teams</span>
                      <div className="flex gap-2">
                        {[2, 3, 4].map((n) => (
                          <Button key={n} size="sm" variant="outline" onClick={() => autoAssignTeams(n)} className="border-white/20 text-xs text-white/70">
                            {n} teams
                          </Button>
                        ))}
                      </div>
                    </div>
                    {Object.entries(teams).map(([teamId, members]) => (
                      <div key={teamId} className="text-xs text-white/50 mb-1">
                        <span className="font-bold text-white/70">{teamId}:</span>{" "}
                        {(members as any[]).map((p) => p.name).join(", ") || "—"}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Timer */}
              <div>
                <label className="text-xs font-black text-white/40 uppercase tracking-widest block mb-3">
                  <Clock size={12} className="inline mr-1" /> Timer per Question
                </label>
                <div className="flex gap-2 flex-wrap">
                  {TIMERS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setGlobalTimer(t)}
                      className={`px-4 py-2 rounded-xl font-bold text-sm border transition-all ${
                        globalTimer === t ? "bg-blue-600 border-blue-500 text-white" : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                      }`}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Winner Count */}
              <div>
                <label className="text-xs font-black text-white/40 uppercase tracking-widest block mb-3">
                  <Trophy size={12} className="inline mr-1" /> Podium Winners (1 – 5)
                </label>
                <div className="flex gap-3 items-end">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const heights = [48, 40, 32, 24, 20];
                    return (
                      <button
                        key={n}
                        onClick={() => setWinnerCount(n)}
                        className={`flex flex-col items-center gap-1 transition-all ${winnerCount >= n ? "opacity-100" : "opacity-25"}`}
                      >
                        <div
                          className={`w-10 rounded-t-lg flex items-end justify-center pb-1 text-xs font-black transition-all ${
                            winnerCount >= n
                              ? n === 1 ? "bg-yellow-400 text-yellow-900" : n === 2 ? "bg-slate-400 text-white" : n === 3 ? "bg-amber-700 text-white" : "bg-blue-600 text-white"
                              : "bg-white/10 text-white/30"
                          }`}
                          style={{ height: heights[n - 1] }}
                        >
                          {n}
                        </div>
                      </button>
                    );
                  })}
                  <div className="ml-3 text-white/60 text-sm font-medium">Top <span className="text-white font-black">{winnerCount}</span> on podium</div>
                </div>
              </div>

              {/* Toggles */}
              <div>
                <label className="text-xs font-black text-white/40 uppercase tracking-widest block mb-3">Options</label>
                <div className="space-y-2">
                  {[
                    { icon: <Eye size={15} />, label: "Show answer after reveal", sub: "Players see correct answer when timer ends", val: showAnswerAfter, set: () => setShowAnswerAfter((v) => !v) },
                    { icon: <Lock size={15} />, label: "One attempt per question", sub: "Prevent changing answers", val: oneAttemptOnly, set: () => setOneAttemptOnly((v) => !v) },
                    { icon: <Shuffle size={15} />, label: "Shuffle questions", sub: "Randomize question order", val: shuffleQuestions, set: () => setShuffleQuestions((v) => !v) },
                    { icon: <span className="text-base">⏭️</span>, label: "Auto-advance questions", sub: "Next question starts automatically after timer", val: autoAdvance, set: () => setAutoAdvance((v) => !v) },
                    { icon: <span className="text-base">🎭</span>, label: "Meme mode", sub: "Different GIFs for correct vs wrong answers", val: memeMode, set: () => setMemeMode((v) => !v) },
                  ].map((opt, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="text-white/50">{opt.icon}</div>
                        <div>
                          <div className="font-bold text-sm text-white/80">{opt.label}</div>
                          <div className="text-xs text-white/40">{opt.sub}</div>
                        </div>
                      </div>
                      <Toggle on={opt.val} onChange={opt.set} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch Button */}
            <div className="p-6 border-t border-white/10 sticky bottom-0 bg-[#16162a]">
              <Button
                onClick={handleLaunch}
                disabled={isLaunching}
                className="w-full bg-green-500 hover:bg-green-400 text-black font-black text-lg py-7 rounded-2xl shadow-2xl shadow-green-900/30 transition-all"
              >
                {isLaunching ? (
                  <span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> Launching...</span>
                ) : (
                  <span className="flex items-center gap-2"><Rocket size={20} /> Launch with {players.length} Players</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
