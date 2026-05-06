"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, use, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getAvatar } from "@/lib/avatars";
import { Users, SkipForward, Trophy, Eye, Flame, Square, Waves } from "lucide-react";
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
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const autoEndScheduledRef = useRef(false);
  const autoAdvanceRef = useRef(false);
  const autoAdvanceScheduledRef = useRef(false);
  const prevIndexRef = useRef<number | null>(null);
  const lastUpdatedAtRef = useRef(0);

  const isWaygroundClassic = roomState?.gameMode === "wayground_classic";

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
        // HIGH-007: read totalQuestions from room state (set by /api/room/start for all modes)
        if (state.totalQuestions && state.totalQuestions > 0) {
          setTotalQuestions(state.totalQuestions);
        }
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

  // Pusher: real-time per-player score updates
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

  // Timer countdown
  useEffect(() => {
    if (isRevealed || timeLeft <= 0) {
      if (timeLeft <= 0 && !isRevealed) setIsRevealed(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, isRevealed]);

  // Auto-advance after reveal
  useEffect(() => {
    if (!isRevealed || !autoAdvanceRef.current || autoAdvanceScheduledRef.current) return;
    autoAdvanceScheduledRef.current = true;
    const t = setTimeout(() => handleNextQuestion(), 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed]);

  // Auto-recap: last question + all players answered → end game after 4s
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

  // ── Derived data ─────────────────────────────────────────────────
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

  // For Wayground Classic header: count players who finished all questions
  const playersFinished = isWaygroundClassic
    ? leaderboard.filter((p: any) => (p.totalAnswered || 0) >= (totalQuestions || 1)).length
    : totalAnswered;

  if (status === "loading" || !currentQuestion) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/60 font-bold animate-pulse">Loading game...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f1a] text-white overflow-hidden">

      {/* ── End Game Confirm Modal ───────────────────────────────── */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#16162a] border border-red-500/30 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-4xl mb-4 text-center">⚠️</div>
            <h3 className="text-xl font-black text-white text-center mb-2">End Game Now?</h3>
            <p className="text-white/50 text-sm text-center mb-6">
              All players will be redirected to results immediately. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowEndConfirm(false)}
                variant="outline"
                className="flex-1 border-white/20 text-white/60"
              >
                Cancel
              </Button>
              <Button
                onClick={() => { setShowEndConfirm(false); handleEndGame(); }}
                className="flex-1 bg-red-600 hover:bg-red-500 font-bold"
              >
                Yes, End Game
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-3 bg-[#16162a] border-b border-white/10 shadow-lg shrink-0">
        <div className="flex items-center gap-3 mr-auto">
          <div className="bg-blue-600 px-3 py-1.5 rounded-lg font-black tracking-widest text-sm">
            {roomCode}
          </div>
          {isWaygroundClassic ? (
            <>
              <div className="flex items-center gap-1.5 text-sm text-white/50">
                <Waves size={13} className="text-blue-400" />
                <span className="font-bold text-white">{playersFinished}</span>
                <span>/ {totalPlayers} done</span>
              </div>
              <div className="text-[10px] px-2 py-0.5 bg-blue-600/20 rounded-full text-blue-400 font-black uppercase tracking-widest">
                🌊 Wayground Classic
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-sm text-white/50">
                <Users size={14} className="text-blue-400" />
                <span className="font-bold text-white">{totalAnswered}</span>
                <span>/ {totalPlayers} answered</span>
              </div>
              <div className="text-xs text-white/30 font-bold">
                Q{qIndex + 1}{totalQuestions > 0 ? `/${totalQuestions}` : ""}
              </div>
            </>
          )}
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

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!isRevealed ? (
            <Button
              onClick={() => { setIsRevealed(true); setTimeLeft(0); }}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm"
            >
              <Eye size={15} className="mr-1" /> Reveal
            </Button>
          ) : totalQuestions > 0 && qIndex >= totalQuestions - 1 ? (
            <Button
              onClick={handleEndGame}
              className="bg-green-600 hover:bg-green-500 font-bold text-sm"
            >
              <Trophy size={13} className="mr-1" /> View Results
            </Button>
          ) : (
            <Button
              onClick={handleNextQuestion}
              className="bg-blue-600 hover:bg-blue-500 font-bold text-sm"
            >
              Next <SkipForward size={15} className="ml-1" />
            </Button>
          )}
          {/* End Now button — always visible, requires confirm modal */}
          <Button
            onClick={() => setShowEndConfirm(true)}
            variant="outline"
            className="border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold text-xs px-2"
            title="End game now"
          >
            <Square size={12} />
          </Button>
        </div>
      </header>

      {/* ── Timer bar ─────────────────────────────────────────────── */}
      <div className="h-1.5 w-full bg-white/5 shrink-0">
        <div
          className={`h-full ${timerColor} transition-all ease-linear duration-1000`}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* ── Split-Screen Main ─────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden">

        {/* ═══ LEFT PANEL: Live Leaderboard ═══════════════════════ */}
        <div className="w-[280px] lg:w-[320px] flex flex-col border-r border-white/10 overflow-hidden shrink-0">

          {/* Class accuracy bar + circle */}
          <div className="flex items-center px-4 pt-4 pb-3 gap-2 shrink-0">
            <div className="flex-1 h-4 bg-green-900/30 rounded-l-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-l-full transition-all duration-700"
                style={{ width: `${classAccuracyPct ?? 0}%` }}
              />
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-white/20 bg-[#0f0f1a] flex flex-col items-center justify-center shrink-0 shadow-xl">
              <span className="text-base font-black text-white leading-none">
                {classAccuracyPct !== null ? `${classAccuracyPct}%` : "—"}
              </span>
              <span className="text-[8px] font-black text-white/40 uppercase tracking-wide mt-0.5">
                Class Acc
              </span>
            </div>
            <div className="flex-1 h-4 bg-red-900/30 rounded-r-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-r-full transition-all duration-700"
                style={{ width: `${classAccuracyPct !== null ? 100 - classAccuracyPct : 0}%` }}
              />
            </div>
          </div>

          {/* Leaderboard legend */}
          <div className="px-4 pb-2 flex items-center justify-between shrink-0">
            <h2 className="text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center gap-1">
              <Trophy size={10} className="text-yellow-400" /> Live Rankings
            </h2>
            <span className="text-[10px] font-black text-white/20">{totalPlayers} players</span>
          </div>

          {/* Player rows */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
            {leaderboard.slice(0, 15).map((p: any, i: number) => {
              const av = getAvatar(p.avatarId);
              const totalAns = p.totalAnswered || 0;
              const correct = p.totalCorrect || 0;
              const wrong = totalAns - correct;
              const questionsAsked = qIndex + 1;
              const correctPct = questionsAsked > 0 ? (correct / questionsAsked) * 100 : 0;
              const wrongPct = questionsAsked > 0 ? (wrong / questionsAsked) * 100 : 0;

              const rankBg =
                i === 0 ? "bg-yellow-500/15 border-yellow-500/40" :
                i === 1 ? "bg-slate-400/10 border-slate-400/20" :
                i === 2 ? "bg-amber-700/10 border-amber-600/20" :
                "bg-white/[0.03] border-white/5";
              const rankBadge =
                i === 0 ? "bg-yellow-500 text-yellow-950" :
                i === 1 ? "bg-slate-400 text-white" :
                i === 2 ? "bg-amber-700 text-white" :
                "bg-white/10 text-white/50";

              return (
                <div
                  key={p.id || p.name}
                  className={`flex items-center gap-2 px-2.5 py-2.5 rounded-xl border transition-all ${rankBg}`}
                >
                  {/* Rank badge */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${rankBadge}`}>
                    {i + 1}
                  </div>

                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${av.bg} flex items-center justify-center text-base shrink-0`}>
                    {av.emoji}
                  </div>

                  {/* Name + bar + score */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white truncate">{p.name}</span>
                      <span className="text-xs font-black text-blue-400 ml-1 shrink-0">
                        {(p.score || 0).toLocaleString()}
                      </span>
                    </div>
                    {/* Correct/Wrong bar */}
                    <div className="h-2 flex rounded-full overflow-hidden bg-white/5">
                      <div className="bg-green-500 transition-all duration-500" style={{ width: `${correctPct}%` }} />
                      <div className="bg-red-500 transition-all duration-500" style={{ width: `${wrongPct}%` }} />
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-white/20">
                        <span className="text-green-400">{correct}✓</span>
                        {wrong > 0 && <span className="text-red-400 ml-1">{wrong}✗</span>}
                        <span className="ml-1 text-white/20">{p.accuracy ?? 0}%</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {leaderboard.length > 15 && (
              <div className="text-center text-[10px] text-white/20 py-2">
                +{leaderboard.length - 15} more players
              </div>
            )}
            {leaderboard.length === 0 && (
              <div className="text-center py-10 text-white/20 text-xs">No players yet</div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT PANEL ════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* --- Classic / non-Wayground: Question + answer distribution --- */}
          {!isWaygroundClassic && (
            <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">

              {/* Question card */}
              <div className="bg-[#16162a] border border-white/10 rounded-2xl p-5 text-center shrink-0 shadow-xl">
                <div className="text-xs font-black text-white/30 uppercase tracking-widest mb-2">
                  Q{qIndex + 1}{totalQuestions > 0 ? ` of ${totalQuestions}` : ""} · {currentQuestion.type}
                </div>
                <h1 className="text-xl md:text-2xl font-black leading-tight">
                  {currentQuestion.text}
                </h1>
              </div>

              {/* MCQ / TF answer distribution */}
              {(currentQuestion.type === "MCQ" || currentQuestion.type === "TF") && (
                <div className="grid grid-cols-1 gap-3 flex-1">
                  {(currentQuestion.options || []).map((opt: string, i: number) => {
                    const col = COLORS[i % COLORS.length];
                    const count = Number(answerStats.byAnswer?.[String(i)] || 0);
                    const pct = totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0;
                    const isCorrect = String(currentQuestion.correctAnswer) === String(i);
                    return (
                      <div
                        key={i}
                        className={`rounded-2xl overflow-hidden border-2 transition-all duration-500 ${
                          isRevealed
                            ? isCorrect
                              ? "border-green-400 shadow-[0_0_24px_rgba(74,222,128,0.25)]"
                              : "border-white/10 opacity-50"
                            : "border-white/20"
                        }`}
                      >
                        <div className={`${col.bg} px-4 py-3 flex items-center gap-3`}>
                          <span className="text-white font-black text-lg w-7 text-center">{col.shape}</span>
                          <span className="font-bold text-white text-base flex-1 leading-snug">{opt}</span>
                          {isRevealed && isCorrect && (
                            <span className="bg-white/25 rounded-full w-7 h-7 flex items-center justify-center text-white font-black">✓</span>
                          )}
                          <span className="text-white/80 font-black text-base shrink-0">{pct}%</span>
                        </div>
                        <div className="bg-black/40 px-4 py-2.5">
                          <div className="flex justify-between text-xs font-bold mb-1.5 text-white/50">
                            <span>{count} players</span>
                          </div>
                          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
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

              {/* FIB / Open: show accepted answers after reveal */}
              {(currentQuestion.type === "FIB" || currentQuestion.type === "OPEN") && isRevealed && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
                  <div className="text-xs font-black text-green-400 uppercase tracking-widest mb-2">
                    Accepted Answers
                  </div>
                  <div className="font-bold text-white text-lg">
                    {currentQuestion.correctAnswer || "Open ended — no fixed answer"}
                  </div>
                </div>
              )}

              {/* Correct / Wrong / No-answer summary (after reveal) */}
              {isRevealed && (
                <div className="flex gap-6 justify-center py-2 shrink-0">
                  {[
                    { label: "Correct", val: answerStats.correct || 0, color: "text-green-400" },
                    { label: "Wrong", val: totalAnswered - (answerStats.correct || 0), color: "text-red-400" },
                    { label: "No answer", val: totalPlayers - totalAnswered, color: "text-white/40" },
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

          {/* --- Wayground Classic: per-player progress tracker --- */}
          {isWaygroundClassic && (
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Mode badge */}
              <div className="mx-4 mt-4 mb-3 px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center gap-2 shrink-0">
                <Waves size={14} className="text-blue-400" />
                <span className="text-xs font-black text-blue-400 uppercase tracking-widest">
                  WAYGROUND CLASSIC — Player-paced · each player advances at their own speed
                </span>
              </div>

              {/* Column headers */}
              <div className="flex items-center justify-between px-5 mb-2 shrink-0">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                  Player Progress · {totalPlayers} players
                </span>
                <span className="text-[10px] font-black text-white/20 uppercase">
                  {totalQuestions > 0 ? `${playersFinished}/${totalPlayers} finished` : "loading..."}
                </span>
              </div>

              {/* Player progress rows */}
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                {[...leaderboard]
                  .sort((a, b) => (b.totalAnswered || 0) - (a.totalAnswered || 0))
                  .map((p: any, i: number) => {
                    const av = getAvatar(p.avatarId);
                    const answered = p.totalAnswered || 0;
                    const correct = p.totalCorrect || 0;
                    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
                    const totalQs = totalQuestions || roomState?.totalQuestions || 1;
                    const progressPct = Math.min(100, (answered / totalQs) * 100);
                    const isDone = totalQs > 0 && answered >= totalQs;

                    return (
                      <div
                        key={p.id || p.name}
                        className={`flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all ${
                          isDone
                            ? "bg-green-500/10 border-green-500/30"
                            : "bg-white/[0.03] border-white/5"
                        }`}
                      >
                        {/* Rank */}
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center font-black text-[10px] shrink-0 text-white/50">
                          {i + 1}
                        </div>

                        {/* Avatar */}
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${av.bg} flex items-center justify-center text-lg shrink-0`}>
                          {av.emoji}
                        </div>

                        {/* Name + progress */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-sm text-white truncate">{p.name}</span>
                            <div className="flex items-center gap-2 text-xs shrink-0 ml-2">
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
                          {/* Mini stats */}
                          <div className="flex items-center gap-3 mt-1 text-[9px]">
                            <span className="text-white/20">
                              Acc: <span className={accuracy >= 70 ? "text-green-400" : accuracy >= 40 ? "text-amber-400" : "text-red-400"}>{accuracy}%</span>
                            </span>
                            <span className="flex items-center gap-0.5 text-orange-400">
                              <Flame size={9} />
                              <span className="font-bold">{p.streak || 0}</span>
                            </span>
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
        </div>
      </main>

      {/* ── Bottom Stats Bar ─────────────────────────────────────── */}
      <div className="shrink-0 bg-[#16162a] border-t border-white/10 px-4 py-2.5 flex items-center gap-6 text-xs">
        {/* Class accuracy */}
        <div className="flex items-center gap-1.5">
          <span className="text-white/30 font-black uppercase tracking-widest">Class Acc</span>
          <span className={`font-black ${
            classAccuracyPct === null ? "text-white/40" :
            classAccuracyPct >= 70 ? "text-green-400" :
            classAccuracyPct >= 40 ? "text-amber-400" : "text-red-400"
          }`}>
            {classAccuracyPct !== null ? `${classAccuracyPct}%` : "—"}
          </span>
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* Players answered */}
        <div className="flex items-center gap-1.5">
          <Users size={11} className="text-blue-400" />
          <span className="text-white/30 font-black uppercase tracking-widest">
            {isWaygroundClassic ? "Finished" : "Answered"}
          </span>
          <span className="font-black text-white">
            {isWaygroundClassic ? playersFinished : totalAnswered}
          </span>
          <span className="text-white/30">/{totalPlayers}</span>
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* Correct count */}
        <div className="flex items-center gap-1.5">
          <Flame size={11} className="text-orange-400" />
          <span className="text-white/30 font-black uppercase tracking-widest">Correct</span>
          <span className="font-black text-green-400">{answerStats.correct || 0}</span>
        </div>

        {/* Game mode badge — right side */}
        <div className="ml-auto flex items-center gap-2">
          {isWaygroundClassic && (
            <span className="px-2 py-0.5 bg-blue-600/20 rounded-full text-blue-400 font-black text-[10px] uppercase tracking-widest">
              🌊 Wayground Classic
            </span>
          )}
          <span className="text-white/20 font-bold capitalize">
            {roomState?.gameMode?.replace("_", " ") || "classic"}
          </span>
        </div>
      </div>
    </div>
  );
}
