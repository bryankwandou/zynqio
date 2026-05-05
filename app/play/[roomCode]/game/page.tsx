"use client";

import { useState, useEffect, useRef, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAvatar } from "@/lib/avatars";

const MEMES = [
  { gif: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif", caption: "MIND = BLOWN 🤯" },
  { gif: "https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif", caption: "LETS GOOO 🎉" },
  { gif: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", caption: "WAIT WHAT 😂" },
  { gif: "https://media.giphy.com/media/3o6Zt8KNIFkBMeoMMM/giphy.gif", caption: "WELL PLAYED 👏" },
  { gif: "https://media.giphy.com/media/26BRrSvJUa0crqw4E/giphy.gif", caption: "NOT AGAIN 😭" },
  { gif: "https://media.giphy.com/media/TdfyKrN7HGTIY/giphy.gif", caption: "BIG BRAIN TIME 🧠" },
  { gif: "https://media.giphy.com/media/l4Ki2obCyAQS5WhFe/giphy.gif", caption: "EASY CLAP 😎" },
];

const OPTION_COLORS = [
  "bg-red-500 hover:bg-red-600 border-red-700",
  "bg-blue-500 hover:bg-blue-600 border-blue-700",
  "bg-amber-500 hover:bg-amber-600 border-amber-700",
  "bg-green-500 hover:bg-green-600 border-green-700",
];

export default function PlayerGame({ params }: { params: Promise<{ roomCode: string }> }) {
  const router = useRouter();
  const { roomCode } = use(params);

  // Identity
  const [nickname, setNickname] = useState("");
  const [myAvatar, setMyAvatar] = useState("fox");

  // Game state
  const [score, setScore] = useState(0);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; points: number; message?: string; speedBonus?: number } | null>(null);
  const [gameMode, setGameMode] = useState<string>("classic");
  const [lives, setLives] = useState(3);
  const [gold, setGold] = useState(0);
  const [powerups, setPowerups] = useState<string[]>(["2x", "freeze", "shield"]);
  const [activePowerup, setActivePowerup] = useState<string | null>(null);
  const [showChests, setShowChests] = useState(false);
  const [selectedChest, setSelectedChest] = useState<number | null>(null);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);
  const [team, setTeam] = useState<string | null>(null);
  const [isMusicOn, setIsMusicOn] = useState(true);
  const [timeLeft, setTimeLeft] = useState(30);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [memeMode, setMemeMode] = useState(false);
  const [currentMeme, setCurrentMeme] = useState<(typeof MEMES)[0] | null>(null);
  const [streakAnimation, setStreakAnimation] = useState(false);

  // Countdown overlay (3-2-1-GO!)
  const [countdownValue, setCountdownValue] = useState<number | string | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const countdownDoneRef = useRef(false);

  // Kicked detection
  const [isKicked, setIsKicked] = useState(false);

  // Refs to avoid stale closures
  const nicknameRef = useRef("");
  const currentQuestionRef = useRef<any>(null);
  const roomStateRef = useRef<any>(null);
  const timerTotalRef = useRef(30);
  const questionStartRef = useRef(Date.now());
  const activePowerupRef = useRef<string | null>(null);
  const seenLogIds = useRef<Set<string>>(new Set());
  const lastUpdatedAt = useRef<number>(0);

  useEffect(() => { currentQuestionRef.current = currentQuestion; }, [currentQuestion]);
  useEffect(() => { activePowerupRef.current = activePowerup; }, [activePowerup]);

  // Countdown animation helper
  const runCountdown = useCallback(() => {
    if (countdownDoneRef.current) return;
    countdownDoneRef.current = true;
    setShowCountdown(true);
    let count = 3;
    setCountdownValue(count);
    const tick = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdownValue(count);
      } else if (count === 0) {
        setCountdownValue("GO!");
      } else {
        clearInterval(tick);
        setShowCountdown(false);
        setCountdownValue(null);
      }
    }, 900);
  }, []);

  // Main polling
  useEffect(() => {
    const savedName = localStorage.getItem("zynqio_nickname");
    const savedAvatar = localStorage.getItem("zynqio_avatar") || "fox";
    const savedToken = localStorage.getItem("zynqio_session_token");

    if (!savedName || !savedToken) {
      router.push(`/play/${roomCode}/nickname`);
      return;
    }

    setNickname(savedName);
    setMyAvatar(savedAvatar);
    nicknameRef.current = savedName;

    const pollRoom = async () => {
      try {
        const since = lastUpdatedAt.current;
        const url = since
          ? `/api/room/state?code=${roomCode}&since=${since}`
          : `/api/room/state?code=${roomCode}`;

        const res = await fetch(url);

        // 304 = no change
        if (res.status === 304) return;
        if (!res.ok) return;

        const state = await res.json();
        if (state.updatedAt) lastUpdatedAt.current = state.updatedAt;

        roomStateRef.current = state;
        setGameMode(state.gameMode || "classic");
        if (state.settings?.memeMode) setMemeMode(true);

        // Kicked detection
        const kicked = (state.kickedPlayers || []).some(
          (k: string) => k === savedName || k === savedName.toLowerCase() || k === savedToken
        );
        if (kicked) {
          setIsKicked(true);
          localStorage.removeItem("zynqio_nickname");
          localStorage.removeItem("zynqio_session_token");
          localStorage.removeItem("zynqio_player_id");
          localStorage.removeItem("zynqio_room_code");
          setTimeout(() => router.replace("/?kicked=1"), 2000);
          return;
        }

        if (state.status === "playing") {
          const myData = state.players?.find((p: any) => p.name === nicknameRef.current);
          if (myData?.team) setTeam(myData.team);

          const curQ = currentQuestionRef.current;
          if (!curQ || state.currentQuestionIndex !== curQ.index) {
            // New question — run countdown only on first question
            if (!curQ) runCountdown();

            const qRes = await fetch(
              `/api/quiz/get-question?quizId=${state.quizId}&index=${state.currentQuestionIndex}&roomCode=${roomCode}`
            );
            if (qRes.ok) {
              const q = await qRes.json();
              const timerSeconds = state.settings?.timer || 30;
              timerTotalRef.current = timerSeconds;
              const qStart = state.questionStartTimestamp || Date.now();
              questionStartRef.current = qStart;
              setCurrentQuestion({ ...q, index: state.currentQuestionIndex });
              setTimeLeft(timerSeconds);
              setIsSubmitted(false);
              setSelectedAnswer(null);
              setResult(null);
              setCurrentMeme(null);
            }
          }
        } else if (state.status === "ended") {
          router.push(`/results/${roomCode}`);
        }
      } catch (err) {
        console.error("Poll error", err);
      }
    };

    const pollLogs = async () => {
      try {
        const logRes = await fetch(`/api/room/get-logs?code=${roomCode}`);
        if (!logRes.ok) return;
        const logs = await logRes.json();
        const now = Date.now();
        logs.forEach((l: any) => {
          if (seenLogIds.current.has(l.timestamp)) return;
          const age = now - new Date(l.timestamp).getTime();
          if (age > 4000) return;
          seenLogIds.current.add(l.timestamp);
          if (l.event === "steal") {
            setNotifications((prev) => {
              setTimeout(() => setNotifications((p) => p.slice(1)), 3000);
              return [...prev, "Someone stole gold!"];
            });
          }
          if (l.event === "reaction") {
            const id = l.timestamp;
            setReactions((prev) => [...prev, { id, emoji: l.data, x: Math.random() * 80 + 10 }]);
            setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2500);
          }
        });
      } catch {}
    };

    const roomInterval = setInterval(pollRoom, 1500);
    const logsInterval = setInterval(pollLogs, 3000);
    pollRoom();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        fetch("/api/room/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode, playerId: nicknameRef.current, event: "tab_switch" }),
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(roomInterval);
      clearInterval(logsInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [roomCode, router, runCountdown]);

  // Timer
  useEffect(() => {
    const total = timerTotalRef.current || 30;
    const interval = setInterval(() => {
      if (activePowerupRef.current === "freeze") return;
      const elapsed = Math.floor((Date.now() - questionStartRef.current) / 1000);
      setTimeLeft(Math.max(0, total - elapsed));
    }, 500);
    return () => clearInterval(interval);
  }, [currentQuestion]);

  const handleSubmit = async (answer: string) => {
    if (isSubmitted) return;
    setSelectedAnswer(answer);
    setIsSubmitted(true);
    if (memeMode) setCurrentMeme(MEMES[Math.floor(Math.random() * MEMES.length)]);

    const roomState = roomStateRef.current;
    try {
      const res = await fetch("/api/answer/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: nicknameRef.current,
          questionId: currentQuestion.id,
          selectedAnswer: answer,
          clientTimestamp: Date.now(),
          roomCode,
          quizId: roomState?.quizId,
          hostId: roomState?.hostId,
          sessionId: roomState?.sessionId,
        }),
      });
      const data = await res.json();

      let finalScore = data.sessionScore || 0;
      if (activePowerup === "2x") finalScore *= 2;

      setResult({
        correct: data.correct,
        points: finalScore,
        speedBonus: data.speedBonus,
      });

      // Streak tracking
      if (data.correct) {
        setCorrectStreak((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            setStreakAnimation(true);
            setTimeout(() => setStreakAnimation(false), 1200);
          }
          return next;
        });
      } else {
        setCorrectStreak(0);
      }

      if (gameMode === "survival") {
        if (data.correct) {
          setScore((p) => p + finalScore);
        } else {
          setScore(0);
        }
      } else {
        setScore((p) => p + finalScore);
      }

      if (gameMode === "battle_royale" && !data.correct && activePowerup !== "shield") {
        setLives((p) => Math.max(0, p - 1));
      } else if (gameMode === "gold_quest" && data.correct) {
        setShowChests(true);
      }

      setActivePowerup(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChestSelect = (index: number) => {
    setSelectedChest(index);
    const outcomes = [
      { val: 500, msg: "+500 GOLD!" },
      { val: 200, msg: "+200 GOLD" },
      { val: 1000, msg: "JACKPOT! +1000" },
      { val: -100, msg: "TRAP! -100 GOLD" },
    ];
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    setTimeout(() => {
      setGold((p) => Math.max(0, p + outcome.val));
      setResult({ correct: true, points: 0, message: outcome.msg });
      setShowChests(false);
      setSelectedChest(null);
    }, 2000);
  };

  const sendReaction = (emoji: string) => {
    const id = Date.now().toString();
    setReactions((prev) => [...prev, { id, emoji, x: Math.random() * 80 + 10 }]);
    fetch("/api/room/log-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCode, playerId: nicknameRef.current, event: "reaction", data: emoji }),
    }).catch(() => {});
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 3000);
  };

  const usePowerup = (p: string) => {
    if (activePowerup || isSubmitted) return;
    setActivePowerup(p);
    setPowerups((prev) => prev.filter((item) => item !== p));
  };

  const avatarInfo = getAvatar(myAvatar);
  const timerPct = timerTotalRef.current > 0 ? (timeLeft / timerTotalRef.current) * 100 : 100;

  // ── Kicked screen ──
  if (isKicked) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <div className="text-6xl mb-6">🚫</div>
        <h2 className="text-2xl font-bold text-foreground mb-2">You were removed</h2>
        <p className="text-muted-foreground">The host removed you from this game.</p>
        <p className="text-sm text-muted-foreground mt-2">Redirecting...</p>
      </div>
    );
  }

  // ── Battle Royale eliminated ──
  if (gameMode === "battle_royale" && lives === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <div className="text-8xl mb-8 grayscale animate-pulse">💔</div>
        <h2 className="text-4xl font-black uppercase tracking-widest mb-4">ELIMINATED</h2>
        <p className="text-muted-foreground max-w-md text-lg">
          You&apos;ve lost all your lives. Watch as others battle it out!
        </p>
        <div className="mt-12 bg-card border border-border p-6 rounded-2xl">
          <div className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Final Score</div>
          <div className="text-5xl font-black text-blue-500">{score}</div>
        </div>
      </div>
    );
  }

  // ── Waiting for first question ──
  if (!currentQuestion && !showCountdown) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-2xl font-bold">Get Ready!</h2>
        <p className="text-muted-foreground">Waiting for host to start the game...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">

      {/* ── Countdown Overlay ── */}
      {showCountdown && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
          <div className="relative">
            <div
              key={String(countdownValue)}
              className="text-9xl font-black text-foreground animate-ping-once"
              style={{ textShadow: "0 0 60px rgba(79,142,255,0.6)" }}
            >
              {countdownValue}
            </div>
          </div>
          <p className="mt-8 text-muted-foreground font-bold text-xl tracking-widest uppercase">
            {countdownValue === "GO!" ? "Game On!" : "Get Ready..."}
          </p>
        </div>
      )}

      {/* ── Streak Badge ── */}
      {correctStreak >= 2 && !showCountdown && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${streakAnimation ? "scale-125" : "scale-100"}`}>
          <div className={`px-5 py-2 rounded-full font-black text-sm flex items-center gap-2 shadow-lg ${
            correctStreak >= 5 ? "bg-purple-500 text-white animate-pulse" :
            correctStreak >= 3 ? "bg-orange-500 text-white" :
            "bg-orange-400 text-white"
          }`}>
            🔥 {correctStreak}x Streak!
            {correctStreak >= 5 && <span className="text-xs">+BONUS</span>}
          </div>
        </div>
      )}

      {/* ── Top Bar ── */}
      <div className="h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-8 shadow-sm shrink-0">
        {/* Left: Player identity */}
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarInfo.bg} flex items-center justify-center text-lg shrink-0`}>
            {avatarInfo.emoji}
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="font-bold text-foreground text-sm leading-none">{nickname.slice(0, 16)}</span>
            {gameMode === "team" && team && (
              <span className={`text-[10px] font-bold ${team.includes("Red") ? "text-red-400" : "text-blue-400"}`}>{team}</span>
            )}
          </div>
          {gameMode === "battle_royale" && (
            <div className="flex gap-0.5 ml-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`text-lg ${i < lives ? "text-red-500" : "text-muted-foreground/30"}`}>❤️</span>
              ))}
            </div>
          )}
        </div>

        {/* Center: Timer */}
        <div className="flex flex-col items-center">
          <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center font-black text-lg transition-colors ${
            timeLeft <= 5 ? "border-red-500 text-red-500 animate-pulse" :
            timeLeft <= 10 ? "border-amber-500 text-amber-500" :
            "border-border text-foreground"
          }`}>
            {timeLeft}
          </div>
          <div className="w-12 h-1 bg-accent rounded-full mt-1 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${timerPct > 50 ? "bg-green-500" : timerPct > 25 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
        </div>

        {/* Right: Score */}
        <div className="flex items-center gap-3">
          {gameMode === "gold_quest" && (
            <div className="bg-yellow-500/20 px-3 py-1 rounded-full font-bold text-yellow-500 text-sm border border-yellow-500/30">
              🪙 {gold}
            </div>
          )}
          <div className="bg-blue-500/10 px-4 py-1.5 rounded-full font-black text-blue-500 text-sm border border-blue-500/20">
            {score} pts
          </div>
          <button
            onClick={() => setIsMusicOn((v) => !v)}
            className="w-8 h-8 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition-all flex items-center justify-center text-sm"
          >
            {isMusicOn ? "🔊" : "🔇"}
          </button>
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-1.5 bg-accent">
        <div
          className={`h-full transition-all duration-500 ${timerPct > 50 ? "bg-green-500" : timerPct > 25 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* Background Music */}
      <audio
        src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
        autoPlay
        loop
        muted={!isMusicOn}
        style={{ display: "none" }}
      />

      {/* Main Content */}
      {currentQuestion && (
        <div className="flex-1 flex flex-col container mx-auto px-4 py-6 max-w-4xl">
          {/* Question number & type */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted-foreground bg-accent/50 px-3 py-1 rounded-full">
              Q{(currentQuestion.index ?? 0) + 1}
            </span>
            {correctStreak >= 3 && (
              <span className="text-xs font-black text-orange-400 bg-orange-400/10 px-3 py-1 rounded-full border border-orange-400/20">
                🔥 {correctStreak} streak!
              </span>
            )}
          </div>

          {/* Question text */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6 text-center shadow-xl">
            {currentQuestion.image && (
              <img
                src={currentQuestion.image}
                alt="question"
                className="max-h-48 mx-auto rounded-xl mb-4 object-contain"
              />
            )}
            <h1 className="text-xl sm:text-2xl font-bold leading-relaxed">
              {currentQuestion.text}
            </h1>
          </div>

          {/* Answer options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            {currentQuestion.options?.map((opt: string, i: number) => {
              const isSelected = selectedAnswer === i.toString() || selectedAnswer === opt;
              return (
                <button
                  key={i}
                  disabled={isSubmitted}
                  onClick={() => handleSubmit(i.toString())}
                  className={`w-full p-6 rounded-2xl text-white font-bold text-lg sm:text-xl shadow-lg transform transition-all active:scale-95 border-b-4 flex items-center justify-center gap-3 ${
                    OPTION_COLORS[i % OPTION_COLORS.length]
                  } ${isSubmitted && !isSelected ? "opacity-40 grayscale" : ""} ${
                    isSelected ? "ring-4 ring-white/40 scale-[1.02]" : ""
                  }`}
                >
                  <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-sm font-black shrink-0">
                    {["A", "B", "C", "D"][i]}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Power-ups */}
      {!isSubmitted && powerups.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex gap-2 z-40">
          {powerups.map((p, i) => (
            <button
              key={i}
              onClick={() => usePowerup(p)}
              className={`px-4 py-2 rounded-xl border text-sm font-bold uppercase transition-all ${
                activePowerup === p
                  ? "bg-blue-600 border-blue-400 text-white animate-pulse"
                  : "bg-background border-border text-muted-foreground hover:border-foreground"
              }`}
            >
              {p === "2x" && "2× Pts"}
              {p === "freeze" && "❄️ Freeze"}
              {p === "shield" && "🛡️ Shield"}
            </button>
          ))}
        </div>
      )}

      {/* Reaction Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-4 z-40">
        {["👍", "❤️", "🔥", "😂", "😮"].map((emoji) => (
          <button key={emoji} onClick={() => sendReaction(emoji)} className="text-2xl hover:scale-125 transition-transform">
            {emoji}
          </button>
        ))}
      </div>

      {/* Floating reactions */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
        {reactions.map((r) => (
          <div key={r.id} className="absolute bottom-0 text-4xl" style={{ left: `${r.x}%`, animation: "floatUp 3s ease-out forwards" }}>
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Notifications */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2">
        {notifications.map((n, i) => (
          <div key={i} className="bg-amber-500 text-black px-6 py-2 rounded-full font-black text-sm shadow-2xl animate-bounce">
            ⚠️ {n}
          </div>
        ))}
      </div>

      {/* Result Overlay */}
      {result && !showChests && (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${
          result.correct ? "bg-green-600/90" : "bg-red-600/90"
        } backdrop-blur-sm`}>
          {memeMode && currentMeme ? (
            <div className="flex flex-col items-center mb-6">
              <img src={currentMeme.gif} alt="meme" className="rounded-2xl max-h-64 shadow-2xl mb-3" />
              <div className="text-white font-black text-xl tracking-widest">{currentMeme.caption}</div>
            </div>
          ) : (
            <div className="text-7xl mb-6 animate-bounce">{result.correct ? "🎉" : "❌"}</div>
          )}

          <h2 className="text-4xl font-black text-white mb-2 tracking-wide uppercase">
            {result.message || (result.correct ? "Correct!" : "Incorrect")}
          </h2>

          {result.correct && result.points > 0 && (
            <div className="bg-white/20 px-6 py-2 rounded-full mt-4 font-bold text-xl text-white">
              +{result.points} pts
              {result.speedBonus && result.speedBonus > 0 && (
                <span className="ml-2 text-sm opacity-80">(+{result.speedBonus} speed)</span>
              )}
            </div>
          )}

          {/* Streak badge on correct */}
          {result.correct && correctStreak >= 2 && (
            <div className="mt-4 px-5 py-2 bg-orange-500 rounded-full font-black text-white text-sm animate-bounce">
              🔥 {correctStreak} streak!
              {correctStreak >= 5 && " BONUS!"}
            </div>
          )}

          {gameMode === "battle_royale" && !result.correct && (
            <div className="mt-4 text-3xl">💔 -1 Life</div>
          )}

          <div className="mt-10 text-white/70 font-medium text-sm">Waiting for next question...</div>
        </div>
      )}

      {/* Gold Quest Chests */}
      {showChests && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
          <h2 className="text-3xl font-black text-yellow-400 mb-8 uppercase tracking-widest">
            Choose a Chest!
          </h2>
          <div className="flex gap-6">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => handleChestSelect(i)}
                disabled={selectedChest !== null}
                className={`w-32 h-32 rounded-2xl flex items-center justify-center text-6xl shadow-2xl transition-all ${
                  selectedChest === i
                    ? "bg-yellow-500 scale-110"
                    : selectedChest !== null
                    ? "bg-accent/50 opacity-50"
                    : "bg-card border border-border hover:bg-accent hover:scale-105"
                }`}
              >
                {selectedChest === i ? "✨" : "📦"}
              </button>
            ))}
          </div>
          {selectedChest !== null && (
            <div className="mt-12 text-2xl font-bold animate-bounce">Revealing reward...</div>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-100vh) scale(1.5); opacity: 0; }
        }
        @keyframes ping-once {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-ping-once { animation: ping-once 0.6s ease-out forwards; }
      `}</style>
    </div>
  );
}
