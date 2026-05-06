"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, use, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getAvatar } from "@/lib/avatars";
import { Users, SkipForward, Trophy, LayoutList, Eye, Flame, Waves, Square } from "lucide-react";
import { getPusherClient } from "@/lib/pusher-client";

const COLORS = [
  { bg: "bg-red-500",   bar: "bg-red-400",   shape: "▲" },
  { bg: "bg-blue-500",  bar: "bg-blue-400",  shape: "◆" },
  { bg: "bg-amber-500", bar: "bg-amber-400", shape: "●" },
  { bg: "bg-green-500", bar: "bg-green-400", shape: "■" },
];

export default function HostGame({ params }: { params: Promise<{ roomCode: string }> }) {
  const { status } = useSession();
  const router = useRouter();
  const { roomCode } = use(params);

  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [totalTime, setTotalTime] = useState(30);
  const [roomState, setRoomState] = useState<any>(null);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const autoEndScheduledRef = useRef(false);

  const [viewMode, setViewMode] = useState<"question" | "leaderboard" | "wayground">("question");
  const autoAdvanceRef = useRef(false);
  const autoAdvanceScheduledRef = useRef(false);
  const prevIndexRef = useRef<number | null>(null);
  const lastUpdatedAtRef = useRef(0);

  const isWaygroundClassic = roomState?.gameMode === 'wayground_classic';

  // Auto-switch to wayground view when mode is detected
  useEffect(() => {
    if (isWaygroundClassic && viewMode === "question") {
      setViewMode("wayground");
    }
  }, [isWaygroundClassic, viewMode]);

  const fetchQuestion = useCallback(
    async (state: any) => {
      if (state.currentQuestionIndex == null) return;
      try {
        const res = await fetch(
          `/api/quiz/get-question?quizId=${state.quizId}&index=${state.currentQuestionIndex}&roomCode=${roomCode}`
        );
        if (!res.ok) return;
        const q = await res.json();
        setCurrentQuestion(q);
        setIsRevealed(false);
        autoAdvanceScheduledRef.current = false;
        autoEndScheduledRef.current = false;
        const t = state.settings?.timer || 30;
        setTotalTime(t);
        setTimeLeft(t);
        autoAdvanceRef.current = state.settings?.autoAdvance || false;
        prevIndexRef.current = state.currentQuestionIndex;
        if (q.totalQuestions) setTotalQuestions(q.totalQuestions);
      } catch {}
    },
    [roomCode]
  );

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  // Poll room state every 2s
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const poll = async () => {
      try {
        const since = lastUpdatedAtRef.current;
        const url = since
          ? `/api/room/state?code=${roomCode}&since=${since}`
          : `/api/room/state?code=${roomCode}`;
        const res = await fetch(url);
        if (res.status === 304) return;
        if (!res.ok) return;
        const state = await res.json();
        if (state.updatedAt) lastUpdatedAtRef.current = state.updatedAt;
        setRoomState(state);
        if (state.currentQuestionIndex !== prevIndexRef.current) {
          await fetchQuestion(state);
        }
        if (state.status === "ended") {
          clearInterval(interval);
          router.push(`/results/${roomCode}`);
        }
      } catch {}
    };
    poll();
    interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [roomCode, router, fetchQuestion]);

  // Pusher: real-time per-player score updates without waiting for poll
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`room-${roomCode}`);

    channel.bind("answer_submitted", (data: any) => {
      setRoomState((prev: any) => {
        if (!prev?.players) return prev;
        const players = prev.players.map((p: any) => {
          if (p.id !== data.playerId && p.name !== data.playerId) return p;
          const newAnswered = (p.totalAnswered || 0) + 1;
          const newCorrect = (p.totalCorrect || 0) + (data.isCorrect ? 1 : 0);
          return {
            ...p,
            score: data.totalScore,
            totalAnswered: newAnswered,
            totalCorrect: newCorrect,
            accuracy: Math.round((newCorrect / newAnswered) * 100),
          };
        });
        return { ...prev, players };
      });
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`room-${roomCode}`);
    };
  }, [roomCode]);

  // Timer countdown (separate from auto-advance to avoid cleanup race)
  useEffect(() => {
    if (isRevealed || timeLeft <= 0) {
      if (timeLeft <= 0 && !isRevealed) setIsRevealed(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, isRevealed]);

  // Auto-advance: fires once when isRevealed flips to true
  useEffect(() => {
    if (!isRevealed || !autoAdvanceRef.current || autoAdvanceScheduledRef.current) return;
    autoAdvanceScheduledRef.current = true;
    const t = setTimeout(() => handleNextQuestion(), 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed]);

  // Auto-recap: when revealed + all players answered + this is the last question
  useEffect(() => {
    if (!isRevealed || autoEndScheduledRef.current) return;
    if (totalQuestions === 0) return;
    const isLastQuestion = qIndex >= totalQuestions - 1;
    if (!isLastQuestion) return;
    const allAnswered = totalPlayers > 0 && totalAnswered >= totalPlayers;
    if (!allAnswered) return;
    autoEndScheduledRef.current = true;
    const t = setTimeout(() => handleEndGame(), 4000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, totalAnswered, totalPlayers, qIndex, totalQuestions]);

  const handleNextQuestion = async () => {
    try {
      await fetch("/api/room/next-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode }),
      });
    } catch {}
  };

  const handleEndGame = async () => {
    try {
      await fetch("/api/room/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode }),
      });
      router.push(`/results/${roomCode}`);
    } catch {}
  };

  // ── Derived data ─────────────────────────────────────────
  const questionId = currentQuestion?.id;
  const answerStats = roomState?.answerStats?.[questionId] || { total: 0, correct: 0, byAnswer: {} };
  const totalAnswered = answerStats.total || 0;
  const classAccuracyPct =
    totalAnswered > 0 ? Math.round(((answerStats.correct || 0) / totalAnswered) * 100) : null;

  const leaderboard = [...(roomState?.players || [])].sort(
    (a, b) => (b.score || 0) - (a.score || 0)
  );
  const totalPlayers = leaderboard.length;
  const qIndex = roomState?.currentQuestionIndex ?? 0;

  const timerPct = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const timerColor =
    timerPct > 60 ? "bg-green-400" : timerPct > 30 ? "bg-amber-400" : "bg-red-500";

  if (status === "loading" || !currentQuestion) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/60 font-bold animate-pulse">Loading Question...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f1a] text-white overflow-hidden">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-3 bg-[#16162a] border-b border-white/10 shadow-lg">
        <div className="flex items-center gap-3 mr-auto">
          <div className="bg-blue-600 px-3 py-1.5 rounded-lg font-black tracking-widest text-sm">
            {roomCode}
          </div>
          <div className="text-sm text-white/50 flex items-center gap-1.5">
            <Users size={14} className="text-blue-400" />
            <span className="font-bold text-white">{totalAnswered}</span>
            <span>/ {totalPlayers}</span>
          </div>
          {/* Timer circle */}
          <div
            className={`w-10 h-10 rounded-full border-[3px] flex items-center justify-center font-black text-sm ${
              isRevealed
                ? "border-white/20 text-white/40"
                : timerPct > 30
                ? "border-blue-500 text-white"
                : "border-red-500 text-red-400 animate-pulse"
            }`}
          >
            {isRevealed ? "✓" : timeLeft}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10">
          {!isWaygroundClassic && (
            <button
              onClick={() => setViewMode("question")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "question"
                  ? "bg-blue-600 text-white shadow"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <LayoutList size={13} /> Per Question
            </button>
          )}
          <button
            onClick={() => setViewMode("leaderboard")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "leaderboard"
                ? "bg-blue-600 text-white shadow"
                : "text-white/40 hover:text-white"
            }`}
          >
            <Trophy size={13} /> Leaderboard
          </button>
          {isWaygroundClassic && (
            <button
              onClick={() => setViewMode("wayground")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "wayground"
                  ? "bg-blue-600 text-white shadow"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <Waves size={13} /> Progress
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!isRevealed ? (
            <Button
              onClick={() => {
                setIsRevealed(true);
                setTimeLeft(0);
              }}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm"
            >
              <Eye size={15} className="mr-1" /> Reveal
            </Button>
          ) : totalQuestions > 0 && qIndex >= totalQuestions - 1 ? (
            <Button
              onClick={handleEndGame}
              className="bg-green-600 hover:bg-green-500 font-bold text-sm"
            >
              <Square size={13} className="mr-1" /> End Game
            </Button>
          ) : (
            <Button
              onClick={handleNextQuestion}
              className="bg-blue-600 hover:bg-blue-500 font-bold text-sm"
            >
              Next <SkipForward size={15} className="ml-1" />
            </Button>
          )}
          <Button
            onClick={() => {
              if (confirm("End game now and go to results?")) handleEndGame();
            }}
            variant="outline"
            className="border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold text-xs px-2"
            title="End game now"
          >
            <Square size={12} />
          </Button>
        </div>
      </header>

      {/* ── Timer bar ─────────────────────────────────────────── */}
      <div className="h-1.5 w-full bg-white/5">
        <div
          className={`h-full ${timerColor} transition-all ease-linear duration-1000`}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden">

        {/* === Per-Question View === */}
        {viewMode === "question" && (
          <div className="flex-1 flex flex-col p-5 gap-5 overflow-y-auto">
            <div className="bg-[#16162a] border border-white/10 rounded-2xl p-6 text-center shadow-xl">
              <div className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">
                Q{qIndex + 1} · {currentQuestion.type}
              </div>
              <h1 className="text-2xl md:text-3xl font-black leading-tight">
                {currentQuestion.text}
              </h1>
            </div>

            {(currentQuestion.type === "MCQ" || currentQuestion.type === "TF") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                {(currentQuestion.options || []).map((opt: string, i: number) => {
                  const col = COLORS[i % COLORS.length];
                  const count = Number(answerStats.byAnswer?.[String(i)] || 0);
                  const pct =
                    totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0;
                  const isCorrect =
                    String(currentQuestion.correctAnswer) === String(i);
                  return (
                    <div
                      key={i}
                      className={`rounded-2xl overflow-hidden border-2 transition-all duration-500 ${
                        isRevealed
                          ? isCorrect
                            ? "border-green-400 shadow-[0_0_24px_rgba(74,222,128,0.25)]"
                            : "border-white/10 opacity-40"
                          : "border-white/20"
                      }`}
                    >
                      <div className={`${col.bg} px-4 py-3 flex items-center gap-3`}>
                        <span className="text-white font-black text-lg w-7 text-center">
                          {col.shape}
                        </span>
                        <span className="font-bold text-white text-base flex-1 leading-snug">
                          {opt}
                        </span>
                        {isRevealed && isCorrect && (
                          <span className="bg-white/25 rounded-full w-7 h-7 flex items-center justify-center text-white font-black">
                            ✓
                          </span>
                        )}
                      </div>
                      <div className="bg-black/40 px-4 py-3">
                        <div className="flex justify-between text-xs font-bold mb-1.5 text-white/60">
                          <span>{count} players</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${col.bar} rounded-full transition-all duration-700`}
                            style={{ width: isRevealed ? `${pct}%` : "0%" }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(currentQuestion.type === "FIB" || currentQuestion.type === "OPEN") &&
              isRevealed && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
                  <div className="text-xs font-black text-green-400 uppercase tracking-widest mb-2">
                    Accepted Answers
                  </div>
                  <div className="font-bold text-white text-lg">
                    {currentQuestion.correctAnswer || "Open ended — no fixed answer"}
                  </div>
                </div>
              )}

            {isRevealed && (
              <div className="flex gap-6 justify-center py-2">
                {[
                  {
                    label: "Correct",
                    val: answerStats.correct || 0,
                    color: "text-green-400",
                  },
                  {
                    label: "Wrong",
                    val: totalAnswered - (answerStats.correct || 0),
                    color: "text-red-400",
                  },
                  {
                    label: "No answer",
                    val: totalPlayers - totalAnswered,
                    color: "text-white/40",
                  },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className={`text-3xl font-black ${s.color}`}>{s.val}</div>
                    <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === Leaderboard View (Quizizz/Wayground style) === */}
        {viewMode === "leaderboard" && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Class accuracy bar + circle */}
            <div className="flex items-center px-5 pt-4 pb-2 gap-3 flex-shrink-0">
              {/* Green bar (correct %) */}
              <div className="flex-1 h-5 bg-green-900/30 rounded-l-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-l-full transition-all duration-700"
                  style={{ width: `${classAccuracyPct ?? 0}%` }}
                />
              </div>

              {/* Circle badge */}
              <div className="w-20 h-20 rounded-full border-4 border-white/20 bg-[#16162a] flex flex-col items-center justify-center shrink-0 shadow-xl">
                <span className="text-xl font-black text-white leading-none">
                  {classAccuracyPct !== null ? `${classAccuracyPct}%` : "—"}
                </span>
                <span className="text-[9px] font-black text-white/40 uppercase tracking-wide mt-0.5">
                  Class Acc
                </span>
              </div>

              {/* Red bar (wrong %) */}
              <div className="flex-1 h-5 bg-red-900/30 rounded-r-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-r-full transition-all duration-700"
                  style={{
                    width: `${classAccuracyPct !== null ? 100 - classAccuracyPct : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Mini question pill */}
            <div className="mx-5 mb-2 px-4 py-2 bg-[#16162a] border border-white/10 rounded-xl text-sm text-white/50 line-clamp-1 flex-shrink-0">
              <span className="text-white/30 mr-2">Q{qIndex + 1}:</span>
              {currentQuestion.text}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between px-5 mb-2 flex-shrink-0">
              <h2 className="text-xs font-black text-white/30 uppercase tracking-widest flex items-center gap-1.5">
                <Trophy size={12} className="text-yellow-400" /> Live Rankings ·{" "}
                {totalPlayers} players
              </h2>
              <div className="flex gap-3 text-[10px] font-black text-white/20 uppercase">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full" /> Correct
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full" /> Wrong
                </span>
              </div>
            </div>

            {/* Player rows */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
              {leaderboard.map((p: any, i: number) => {
                const av = getAvatar(p.avatarId);
                const totalAns = p.totalAnswered || 0;
                const correct = p.totalCorrect || 0;
                const wrong = totalAns - correct;
                const questionsAsked = qIndex + 1;
                const correctPct =
                  questionsAsked > 0 ? (correct / questionsAsked) * 100 : 0;
                const wrongPct =
                  questionsAsked > 0 ? (wrong / questionsAsked) * 100 : 0;

                const rankBg =
                  i === 0
                    ? "bg-yellow-500/15 border-yellow-500/40"
                    : i === 1
                    ? "bg-slate-400/10 border-slate-400/20"
                    : i === 2
                    ? "bg-amber-700/10 border-amber-600/20"
                    : "bg-white/[0.03] border-white/5";
                const rankBadge =
                  i === 0
                    ? "bg-yellow-500 text-yellow-950"
                    : i === 1
                    ? "bg-slate-400 text-white"
                    : i === 2
                    ? "bg-amber-700 text-white"
                    : "bg-white/10 text-white/50";

                return (
                  <div
                    key={p.id || p.name}
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all ${rankBg}`}
                  >
                    {/* Rank */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${rankBadge}`}
                    >
                      {i + 1}
                    </div>

                    {/* Avatar */}
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${av.bg} flex items-center justify-center text-xl shrink-0`}
                    >
                      {av.emoji}
                    </div>

                    {/* Name + bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-sm text-white truncate">
                          {p.name}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-white/50 shrink-0 ml-2">
                          <Flame size={12} className="text-orange-400" />
                          <span className="font-bold text-white">{correct}</span>
                          <span className="text-white/30">/{totalAns}</span>
                        </div>
                      </div>
                      {/* Correct / Wrong / Unanswered bar */}
                      <div className="h-2.5 flex rounded-full overflow-hidden bg-white/5">
                        <div
                          className="bg-green-500 transition-all duration-500"
                          style={{ width: `${correctPct}%` }}
                        />
                        <div
                          className="bg-red-500 transition-all duration-500"
                          style={{ width: `${wrongPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right shrink-0 ml-2">
                      <div className="font-black text-xl text-blue-400 leading-none">
                        {(p.score || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-white/30 mt-0.5">pts</div>
                    </div>
                  </div>
                );
              })}

              {leaderboard.length === 0 && (
                <div className="text-center py-12 text-white/30 text-sm">
                  No players have answered yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* === Wayground Classic: Per-Player Progress View === */}
        {viewMode === "wayground" && isWaygroundClassic && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Class Accuracy bar */}
            <div className="flex items-center px-5 pt-4 pb-2 gap-3 flex-shrink-0">
              <div className="flex-1 h-5 bg-green-900/30 rounded-l-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-l-full transition-all duration-700"
                  style={{ width: `${classAccuracyPct ?? 0}%` }}
                />
              </div>
              <div className="w-20 h-20 rounded-full border-4 border-white/20 bg-[#16162a] flex flex-col items-center justify-center shrink-0 shadow-xl">
                <span className="text-xl font-black text-white leading-none">
                  {classAccuracyPct !== null ? `${classAccuracyPct}%` : "—"}
                </span>
                <span className="text-[9px] font-black text-white/40 uppercase tracking-wide mt-0.5">
                  Accuracy
                </span>
              </div>
              <div className="flex-1 h-5 bg-red-900/30 rounded-r-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-r-full transition-all duration-700"
                  style={{ width: `${classAccuracyPct !== null ? 100 - classAccuracyPct : 0}%` }}
                />
              </div>
            </div>

            {/* Mode badge */}
            <div className="mx-5 mb-2 px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center gap-2 flex-shrink-0">
              <Waves size={14} className="text-blue-400" />
              <span className="text-xs font-black text-blue-400 uppercase tracking-widest">WAYGROUND CLASSIC — Player-paced mode</span>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between px-5 mb-2 flex-shrink-0">
              <h2 className="text-xs font-black text-white/30 uppercase tracking-widest">
                Player Progress · {totalPlayers} players
              </h2>
              <div className="text-[10px] font-black text-white/20 uppercase">
                Questions completed / total
              </div>
            </div>

            {/* Player progress rows */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
              {[...leaderboard]
                .sort((a, b) => (b.totalAnswered || 0) - (a.totalAnswered || 0))
                .map((p: any, i: number) => {
                  const av = getAvatar(p.avatarId);
                  const answered = p.totalAnswered || 0;
                  const correct = p.totalCorrect || 0;
                  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
                  const totalQs = roomState?.totalQuestions || answered || 1;
                  const progressPct = Math.min(100, (answered / totalQs) * 100);
                  const isDone = answered >= totalQs && totalQs > 0;

                  return (
                    <div
                      key={p.id || p.name}
                      className={`flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all ${
                        isDone
                          ? "bg-green-500/10 border-green-500/30"
                          : "bg-white/[0.03] border-white/5"
                      }`}
                    >
                      {/* Rank by progress */}
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center font-black text-xs shrink-0 text-white/50">
                        {i + 1}
                      </div>

                      {/* Avatar */}
                      <div
                        className={`w-9 h-9 rounded-xl bg-gradient-to-br ${av.bg} flex items-center justify-center text-lg shrink-0`}
                      >
                        {av.emoji}
                      </div>

                      {/* Name + progress bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-sm text-white truncate">{p.name}</span>
                          <div className="flex items-center gap-1.5 text-xs shrink-0 ml-2">
                            {isDone ? (
                              <span className="text-green-400 font-black text-[10px] uppercase">✓ Done</span>
                            ) : (
                              <span className="text-white/40 font-bold">{answered}/{totalQs}</span>
                            )}
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isDone ? "bg-green-500" : "bg-blue-500"}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        {/* Accuracy mini */}
                        <div className="flex items-center gap-1 mt-1">
                          <div className="text-[9px] text-white/20 font-bold">
                            Acc: <span className={accuracy >= 70 ? "text-green-400" : accuracy >= 40 ? "text-amber-400" : "text-red-400"}>{accuracy}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right shrink-0 ml-1">
                        <div className="font-black text-lg text-blue-400 leading-none">
                          {(p.score || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-white/30 mt-0.5">pts</div>
                      </div>
                    </div>
                  );
                })}

              {leaderboard.length === 0 && (
                <div className="text-center py-12 text-white/30 text-sm">
                  No players have answered yet
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
