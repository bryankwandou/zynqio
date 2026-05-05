"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, use, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getAvatar } from "@/lib/avatars";
import { Users, SkipForward, Trophy, LayoutList, Eye } from "lucide-react";

const COLORS = [
  { bg: "bg-red-500",   bar: "bg-red-400",   ring: "ring-red-400",   shape: "▲", label: "bg-red-600" },
  { bg: "bg-blue-500",  bar: "bg-blue-400",  ring: "ring-blue-400",  shape: "◆", label: "bg-blue-600" },
  { bg: "bg-amber-500", bar: "bg-amber-400", ring: "ring-amber-400", shape: "●", label: "bg-amber-600" },
  { bg: "bg-green-500", bar: "bg-green-400", ring: "ring-green-400", shape: "■", label: "bg-green-600" },
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

  // PERSISTENT toggle — state never resets on question change
  const [viewMode, setViewMode] = useState<"question" | "leaderboard">("question");
  const autoAdvanceRef = useRef(false);

  const prevIndexRef = useRef<number | null>(null);
  const lastUpdatedAtRef = useRef(0);

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
        const t = state.settings?.timer || 30;
        setTotalTime(t);
        setTimeLeft(t);
        autoAdvanceRef.current = state.settings?.autoAdvance || false;
        prevIndexRef.current = state.currentQuestionIndex;
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

  // Timer countdown + auto-advance
  useEffect(() => {
    if (isRevealed || timeLeft <= 0) {
      if (timeLeft <= 0 && !isRevealed) {
        setIsRevealed(true);
        if (autoAdvanceRef.current) {
          const t = setTimeout(() => handleNextQuestion(), 3000);
          return () => clearTimeout(t);
        }
      }
      return;
    }
    const t = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, isRevealed]);

  const handleNextQuestion = async () => {
    try {
      await fetch("/api/room/next-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode }),
      });
    } catch {}
  };

  // ── Derived data ─────────────────────────────────────────
  const questionId = currentQuestion?.id;
  const answerStats = roomState?.answerStats?.[questionId] || { total: 0, correct: 0, byAnswer: {} };
  const totalAnswered = answerStats.total || 0;
  const classAccuracyPct = totalAnswered > 0
    ? Math.round(((answerStats.correct || 0) / totalAnswered) * 100)
    : null;
  const leaderboard = [...(roomState?.players || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
  const totalPlayers = leaderboard.length;

  const timerPct = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const timerColor = timerPct > 60 ? "bg-green-400" : timerPct > 30 ? "bg-amber-400" : "bg-red-500";

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
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex items-center gap-4 px-4 py-3 bg-[#16162a] border-b border-white/10 shadow-lg">
        {/* Room + count */}
        <div className="flex items-center gap-3 mr-auto">
          <div className="bg-blue-600 px-3 py-1.5 rounded-lg font-black tracking-widest text-sm">{roomCode}</div>
          <div className="text-sm text-white/50 flex items-center gap-1.5">
            <Users size={14} className="text-blue-400" />
            <span className="font-bold text-white">{totalAnswered}</span>
            <span>/ {totalPlayers}</span>
          </div>
          {/* Class accuracy */}
          {isRevealed && classAccuracyPct !== null && (
            <div className={`px-3 py-1 rounded-full text-xs font-black border ${
              classAccuracyPct >= 70 ? "bg-green-500/15 border-green-500/30 text-green-400" :
              classAccuracyPct >= 40 ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
              "bg-red-500/15 border-red-500/30 text-red-400"
            }`}>
              {classAccuracyPct}% Class Accuracy
            </div>
          )}
          {/* Timer circle */}
          <div className={`w-10 h-10 rounded-full border-[3px] flex items-center justify-center font-black text-sm ${
            isRevealed ? "border-white/20 text-white/40" : timerPct > 30 ? "border-blue-500 text-white" : "border-red-500 text-red-400 animate-pulse"
          }`}>
            {isRevealed ? "✓" : timeLeft}
          </div>
        </div>

        {/* ── View toggle — PERSISTENT ────────────────────────── */}
        <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10">
          <button
            onClick={() => setViewMode("question")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "question" ? "bg-blue-600 text-white shadow" : "text-white/40 hover:text-white"
            }`}
          >
            <LayoutList size={13} /> Per Question
          </button>
          <button
            onClick={() => setViewMode("leaderboard")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "leaderboard" ? "bg-blue-600 text-white shadow" : "text-white/40 hover:text-white"
            }`}
          >
            <Trophy size={13} /> Leaderboard
          </button>
        </div>

        {/* Action buttons */}
        {!isRevealed ? (
          <Button
            onClick={() => { setIsRevealed(true); setTimeLeft(0); }}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm"
          >
            <Eye size={15} className="mr-1" /> Reveal
          </Button>
        ) : (
          <Button onClick={handleNextQuestion} className="bg-blue-600 hover:bg-blue-500 font-bold text-sm">
            Next <SkipForward size={15} className="ml-1" />
          </Button>
        )}
      </header>

      {/* ── Timer bar ───────────────────────────────────────── */}
      <div className="h-1.5 w-full bg-white/5">
        <div
          className={`h-full ${timerColor} transition-all ease-linear duration-1000`}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* ── Main content ────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden">

        {/* === Per-Question View (Blooket-style) === */}
        {viewMode === "question" && (
          <div className="flex-1 flex flex-col p-5 gap-5 overflow-y-auto">
            {/* Question */}
            <div className="bg-[#16162a] border border-white/10 rounded-2xl p-6 text-center shadow-xl">
              <div className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">
                Q{(roomState?.currentQuestionIndex ?? 0) + 1} · {currentQuestion.type}
              </div>
              <h1 className="text-2xl md:text-3xl font-black leading-tight">{currentQuestion.text}</h1>
            </div>

            {/* Answer tiles */}
            {(currentQuestion.type === "MCQ" || currentQuestion.type === "TF") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
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
                            : "border-white/10 opacity-40"
                          : "border-white/20"
                      }`}
                    >
                      {/* Color header */}
                      <div className={`${col.bg} px-4 py-3 flex items-center gap-3`}>
                        <span className="text-white font-black text-lg w-7 text-center">{col.shape}</span>
                        <span className="font-bold text-white text-base flex-1 leading-snug">{opt}</span>
                        {isRevealed && isCorrect && (
                          <span className="bg-white/25 rounded-full w-7 h-7 flex items-center justify-center text-white font-black">✓</span>
                        )}
                      </div>

                      {/* Distribution bar (always visible, fills after reveal) */}
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

            {/* FIB / OPEN type — show accepted answers on reveal */}
            {(currentQuestion.type === "FIB" || currentQuestion.type === "OPEN") && isRevealed && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
                <div className="text-xs font-black text-green-400 uppercase tracking-widest mb-2">Accepted Answers</div>
                <div className="font-bold text-white text-lg">{currentQuestion.correctAnswer || "Open ended — no fixed answer"}</div>
              </div>
            )}

            {/* Summary row */}
            {isRevealed && (
              <div className="flex gap-4 justify-center py-2">
                {[
                  { label: "Correct", val: answerStats.correct || 0, color: "text-green-400" },
                  { label: "Wrong",   val: totalAnswered - (answerStats.correct || 0), color: "text-red-400" },
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

        {/* === Cumulative Leaderboard View (Wayground-style) === */}
        {viewMode === "leaderboard" && (
          <div className="flex-1 flex flex-col p-5 overflow-hidden">
            {/* Mini question pill */}
            <div className="mb-4 px-4 py-2 bg-[#16162a] border border-white/10 rounded-xl text-sm text-white/50 line-clamp-1 flex-shrink-0">
              <span className="text-white/30 mr-2">Q{(roomState?.currentQuestionIndex ?? 0) + 1}:</span>
              {currentQuestion.text}
            </div>

            <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-3 flex items-center gap-1.5 flex-shrink-0">
              <Trophy size={12} className="text-yellow-400" /> Live Rankings
            </h2>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {leaderboard.map((p: any, i: number) => {
                const av = getAvatar(p.avatarId);
                const accPct = p.totalAnswered > 0 ? Math.round(((p.totalCorrect || 0) / p.totalAnswered) * 100) : 0;
                const rankStyle =
                  i === 0 ? "bg-yellow-500/20 border-yellow-500/30" :
                  i === 1 ? "bg-slate-400/10 border-slate-400/20" :
                  i === 2 ? "bg-amber-700/10 border-amber-600/20" :
                  "bg-white/[0.03] border-white/5";
                const rankNum =
                  i === 0 ? "bg-yellow-500 text-yellow-950" :
                  i === 1 ? "bg-slate-400 text-white" :
                  i === 2 ? "bg-amber-700 text-white" :
                  "bg-white/10 text-white/50";

                return (
                  <div key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${rankStyle}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${rankNum}`}>
                      {i + 1}
                    </div>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${av.bg} flex items-center justify-center text-xl shrink-0`}>
                      {av.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-white truncate">{p.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${accPct}%` }} />
                        </div>
                        <span className="text-[10px] text-white/40 shrink-0">
                          {p.totalCorrect || 0}/{p.totalAnswered || 0} correct
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-blue-400 text-sm">{(p.score || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-white/30">{accPct}% acc</div>
                    </div>
                  </div>
                );
              })}

              {leaderboard.length === 0 && (
                <div className="text-center py-12 text-white/30 text-sm">No players have answered yet</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
