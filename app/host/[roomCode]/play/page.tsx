"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, use, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getAvatar } from "@/lib/avatars";
import { Users, SkipForward, Trophy, Eye, Flame, Square, Zap } from "lucide-react";
import { getPusherClient } from "@/lib/pusher-client";
import GameMusicPlayer from "@/components/GameMusicPlayer";
import { useBahasa } from "@/lib/bahasa";

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
  // Layar guru selama ini menulis kalimatnya langsung di kode — sebagian
  // Inggris, sebagian Indonesia — sehingga menekan tombol bahasa tidak
  // menggerakkan apa pun di sini.
  const { t } = useBahasa();

  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [totalTime, setTotalTime] = useState(30);
  const [roomState, setRoomState] = useState<any>(null);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [advanceCountdown, setAdvanceCountdown] = useState<number | null>(null);

  const autoEndScheduledRef = useRef(false);
  const autoEndClassicRef = useRef(false);
  const autoRevealScheduledRef = useRef(false);
  const autoAdvanceScheduledRef = useRef(false);
  const prevIndexRef = useRef<number | null>(null);
  const lastUpdatedAtRef = useRef(0);
  // Nomor versi keadaan ruangan yang terakhir terbaca, dipakai sebagai
  // syarat saat meminta perpindahan soal.
  const roomVersionRef = useRef(0);
  const countdownTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Timeout refs — kept across renders so cleanup only fires on unmount or explicit reset
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

/* Nama ragam permainan sebagaimana dibaca pengajar. Pengenalnya
   tersimpan di basis data dan tidak boleh ikut diterjemahkan. */
const RAGAM: Record<string, string> = {
  wayground_classic: "Klasik",
  speed_rush: "Adu cepat",
  battle_royale: "Gugur",
  survival: "Sisa satu",
  gold_quest: "Buru harta",
  team: "Beregu",
};

  // "Classic" mode = wayground_classic (self-paced per player)
  const isClassicMode = roomState?.gameMode === "wayground_classic";

  const fetchQuestion = useCallback(
    async (state: any) => {
      if (state.currentQuestionIndex == null) return;
      try {
        // quizId tidak lagi ikut dikirim. Server menurunkannya sendiri
        // dari ruangan, jadi tidak ada gunanya menerima dari klien nilai
        // yang menentukan soal mana yang tampil.
        const res = await fetch(
          `/api/quiz/get-question?roomCode=${roomCode}&index=${state.currentQuestionIndex}`
        );
        if (!res.ok) return;
        const q = await res.json();
        setCurrentQuestion(q);
        setIsRevealed(false);
        autoAdvanceScheduledRef.current = false;
        autoEndScheduledRef.current = false;
        autoEndClassicRef.current = false;
        autoRevealScheduledRef.current = false;
        setAdvanceCountdown(null);
        if (countdownTickRef.current) { clearTimeout(countdownTickRef.current as any); countdownTickRef.current = null; }
        // Clear any pending timeouts from previous question
        if (revealTimeoutRef.current) { clearTimeout(revealTimeoutRef.current); revealTimeoutRef.current = null; }
        if (advanceTimeoutRef.current) { clearTimeout(advanceTimeoutRef.current); advanceTimeoutRef.current = null; }
        if (endTimeoutRef.current) { clearTimeout(endTimeoutRef.current); endTimeoutRef.current = null; }
        const t = state.settings?.timer || 30;
        setTotalTime(t);
        setTimeLeft(t);
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
          ? `/api/room/state?roomCode=${roomCode}&since=${since}`
          : `/api/room/state?roomCode=${roomCode}`;
        const res = await fetch(url);
        if (res.status === 304) return;
        if (!res.ok) return;
        const state = await res.json();
        if (state.updatedAt) lastUpdatedAtRef.current = state.updatedAt;
        setRoomState(state);
        if (typeof state.version === "number") roomVersionRef.current = state.version;
        // HIGH-007: read totalQuestions from room state (set by /api/room/start for all modes)
        if (state.totalQuestions && state.totalQuestions > 0) {
          setTotalQuestions(state.totalQuestions);
        }
        if (state.currentQuestionIndex !== prevIndexRef.current) {
          autoRevealScheduledRef.current = false;
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

  // Pusher: real-time per-player score + answerStats update
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`room-${roomCode}`);
    channel.bind("answer_submitted", (data: any) => {
      setRoomState((prev: any) => {
        if (!prev?.players) return prev;

        // Update player row + append to per-question answerHistory
        const players = prev.players.map((p: any) => {
          if (p.id !== data.playerId && p.name !== data.playerId) return p;
          const newAnswered = (p.totalAnswered || 0) + 1;
          const newCorrect = (p.totalCorrect || 0) + (data.isCorrect ? 1 : 0);
          const histStatus = data.selectedAnswer === null
            ? "unattempted"
            : data.isCorrect
              ? "correct"
              : "wrong";
          const answerHistory = {
            ...(p.answerHistory || {}),
            [data.questionId]: {
              status: histStatus,
              selectedAnswer: data.selectedAnswer,
              points: data.sessionScore,
              questionIndex: data.questionIndex,
            },
          };
          return {
            ...p,
            score: data.totalScore,
            totalAnswered: newAnswered,
            totalCorrect: newCorrect,
            accuracy: Math.round((newCorrect / newAnswered) * 100),
            answerHistory,
          };
        });

        // Also update answerStats so totalAnswered immediately reflects new answer
        // (avoids waiting for the 2s REST poll before auto-reveal triggers)
        const qId = data.questionId;
        if (!qId) return { ...prev, players };
        const prevStats = prev.answerStats?.[qId] || { total: 0, correct: 0, byAnswer: {} };
        const ansKey = String(data.selectedAnswer ?? "null");
        const updatedStats = {
          total: prevStats.total + 1,
          correct: prevStats.correct + (data.isCorrect ? 1 : 0),
          byAnswer: {
            ...prevStats.byAnswer,
            [ansKey]: (prevStats.byAnswer?.[ansKey] || 0) + 1,
          },
        };
        return {
          ...prev,
          players,
          answerStats: { ...(prev.answerStats || {}), [qId]: updatedStats },
        };
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

  // ── Derived data (must be above useEffects that use them) ─────────
  const questionId = currentQuestion?.id;
  const answerStats = roomState?.answerStats?.[questionId] || { total: 0, correct: 0, byAnswer: {} };
  const totalAnswered = answerStats.total || 0;

  const leaderboard = [...(roomState?.players || [])].sort(
    (a, b) => (b.score || 0) - (a.score || 0)
  );

  /**
   * Ketepatan kelas.
   *
   * Sebelumnya angka ini selalu diambil dari answerStats, yang hanya
   * berisi satu soal: soal yang sedang ditunjuk guru. Pada mode Langsung
   * itu benar, karena semua orang memang mengerjakan soal yang sama.
   *
   * Pada mode Klasik tidak ada "soal yang sama" — setiap peserta berjalan
   * di soal berbeda, dan soal yang ditunjuk guru boleh jadi belum dijawab
   * siapa pun. Hasilnya sebuah layar yang menampilkan 20 jawaban masuk
   * dengan 4 benar dan 2 benar di sebelahnya, lalu menulis ketepatan kelas
   * 0% di atasnya. Angkanya tidak kosong, ia salah — dan itu lebih buruk,
   * karena tidak ada yang terlihat rusak.
   *
   * Di mode Klasik ketepatan dihitung dari seluruh jawaban yang sudah
   * masuk, persis penjumlahan angka yang sudah tampil di baris peserta.
   */
  const jawabanKelas = leaderboard.reduce(
    (n, p: any) => n + (p.totalAnswered || 0),
    0
  );
  const benarKelas = leaderboard.reduce(
    (n, p: any) => n + (p.totalCorrect || 0),
    0
  );
  const classAccuracyPct = isClassicMode
    ? jawabanKelas > 0
      ? Math.round((benarKelas / jawabanKelas) * 100)
      : null
    : totalAnswered > 0
      ? Math.round(((answerStats.correct || 0) / totalAnswered) * 100)
      : null;
  const totalPlayers = leaderboard.length;
  const qIndex = roomState?.currentQuestionIndex ?? 0;

  // For Wayground Classic header: count players who finished all questions
  const playersFinished = isClassicMode
    ? leaderboard.filter((p: any) => (p.totalAnswered || 0) >= (totalQuestions || 1)).length
    : totalAnswered;

  const timerPct = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const timerColor =
    timerPct > 60 ? "bg-green-400" : timerPct > 30 ? "bg-amber-400" : "bg-red-500";

  const handleNextQuestion = async () => {
    try {
      // Nomor versi yang sedang terlihat ikut dikirim. Server menolak
      // permintaan yang membawa versi basi, sehingga tombol yang
      // tertekan dua kali — atau permintaan yang terkirim ulang karena
      // jaringan lambat — tidak melompati satu soal tanpa menampilkannya.
      await fetch("/api/room/next-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode, expectedVersion: roomVersionRef.current }),
      });
    } catch {}
  };

  const handleEndGame = async () => {
    try {
      const res = await fetch("/api/room/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode }),
      });

      // Halaman hasil dialamatkan dengan sessionId, bukan kode ruangan.
      // Kode ruangan berumur pendek dan bisa terpakai ulang; sessionId
      // menandai satu permainan tertentu dan bertahan di riwayat.
      await res.json().catch(() => null);
      router.push(`/results/${roomCode}`);
    } catch {}
  };

  // Auto-advance after reveal — ALWAYS seamless for non-Classic modes (Blooket-style), 2s delay
  // NOTE: No cleanup function — timeout must survive prop changes from rapid Pusher events.
  useEffect(() => {
    if (isClassicMode || !isRevealed || autoAdvanceScheduledRef.current) return;
    autoAdvanceScheduledRef.current = true;
    setAdvanceCountdown(2);
    advanceTimeoutRef.current = setTimeout(() => {
      setAdvanceCountdown(1);
      advanceTimeoutRef.current = setTimeout(() => {
        setAdvanceCountdown(null);
        handleNextQuestion();
      }, 1000);
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isClassicMode]);

  // Auto-reveal when ALL players have answered (even before timer ends)
  // NOTE: No cleanup — otherwise rapid totalAnswered changes cancel the 1s reveal timeout.
  useEffect(() => {
    if (isClassicMode || isRevealed || autoRevealScheduledRef.current) return;
    if (totalPlayers === 0) return;
    if (totalAnswered < totalPlayers) return;
    autoRevealScheduledRef.current = true;
    revealTimeoutRef.current = setTimeout(() => { setIsRevealed(true); setTimeLeft(0); }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalAnswered, totalPlayers, isRevealed, isClassicMode]);

  // Auto-recap: last question + all players answered → end game after 4s (classic modes)
  useEffect(() => {
    if (isClassicMode || !isRevealed || autoEndScheduledRef.current) return;
    if (totalQuestions === 0) return;
    const isLastQuestion = qIndex >= totalQuestions - 1;
    if (!isLastQuestion) return;
    const allAnswered = totalPlayers > 0 && totalAnswered >= totalPlayers;
    if (!allAnswered) return;
    autoEndScheduledRef.current = true;
    endTimeoutRef.current = setTimeout(() => handleEndGame(), 4000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, totalAnswered, totalPlayers, qIndex, totalQuestions, isClassicMode]);

  // Auto-end for Classic: all players finished all questions → end after 4s
  useEffect(() => {
    if (!isClassicMode || autoEndClassicRef.current) return;
    if (totalPlayers === 0 || totalQuestions === 0) return;
    if (playersFinished < totalPlayers) return;
    autoEndClassicRef.current = true;
    endTimeoutRef.current = setTimeout(() => handleEndGame(), 4000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClassicMode, playersFinished, totalPlayers, totalQuestions]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
      if (endTimeoutRef.current) clearTimeout(endTimeoutRef.current);
      if (countdownTickRef.current) clearTimeout(countdownTickRef.current as any);
    };
  }, []);

  if (status === "loading" || !currentQuestion) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/60 font-bold animate-pulse" role="status">Menyiapkan permainan…</p>
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
            <h3 className="text-xl font-black text-white text-center mb-2">Hentikan permainan sekarang?</h3>
            <p className="text-white/50 text-sm text-center mb-6">
              Semua peserta langsung dibawa ke halaman hasil. Langkah ini tidak bisa dibatalkan.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowEndConfirm(false)}
                variant="outline"
                className="flex-1 border-white/25 bg-white/5 text-white hover:bg-white/10"
              >
                Tahan dulu
              </Button>
              <Button
                onClick={() => { setShowEndConfirm(false); handleEndGame(); }}
                className="flex-1 bg-red-600 hover:bg-red-500 font-bold"
              >
                Ya, hentikan
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
          {isClassicMode ? (
            <>
              {/*
                  Ragam klasik membiarkan tiap peserta maju sendiri, jadi
                  angka ini menghitung yang sudah menamatkan SELURUH soal —
                  bukan yang sudah menjawab. Sepanjang kelas masih di
                  tengah jalan, angkanya memang nol, dan "0 / 2 selesai"
                  di layar proyektor terbaca seperti tidak ada jawaban yang
                  tercatat sama sekali. Jumlah jawaban yang sudah masuk
                  ditulis berdampingan supaya pengajar melihat kelasnya
                  memang sedang bergerak.
              */}
              <div className="flex items-center gap-1.5 text-sm text-white/50">
                <Zap size={13} className="text-blue-400" />
                <span className="font-bold text-white">{playersFinished}</span>
                <span>/ {totalPlayers} tamat</span>
              </div>
              {totalQuestions > 0 && (
                <div className="text-xs text-white/40 font-bold">
                  {leaderboard.reduce((n: number, p: any) => n + (p.totalAnswered || 0), 0)} jawaban masuk
                </div>
              )}
              {playersFinished > 0 && totalPlayers > 0 && playersFinished >= totalPlayers ? (
                <div className="text-[10px] px-2 py-0.5 bg-green-600/20 rounded-full text-green-400 font-black uppercase tracking-widest animate-pulse">
                  ✓ Semua selesai — permainan ditutup
                </div>
              ) : (
                <div className="text-[10px] px-2 py-0.5 bg-blue-600/20 rounded-full text-blue-400 font-black uppercase tracking-widest">
                  ⚡ Klasik
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-sm text-white/50">
                <Users size={14} className="text-blue-400" />
                <span className="font-bold text-white">{totalAnswered}</span>
                <span>/ {totalPlayers} menjawab</span>
              </div>
              <div className="text-xs text-white/30 font-bold">
                Q{qIndex + 1}{totalQuestions > 0 ? `/${totalQuestions}` : ""}
              </div>
              {advanceCountdown !== null && (
                <div className="text-[10px] px-2 py-0.5 bg-amber-500/20 rounded-full text-amber-400 font-black uppercase tracking-widest animate-pulse">
                  Lanjut dalam {advanceCountdown} detik…
                </div>
              )}
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
              <Eye size={15} className="mr-1" aria-hidden="true" /> Buka jawaban
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
              Lanjut <SkipForward size={15} className="ml-1" aria-hidden="true" />
            </Button>
          )}
          {/* Music player */}
          <GameMusicPlayer />
          {/* End Now button — always visible, requires confirm modal */}
          <Button
            onClick={() => setShowEndConfirm(true)}
            variant="outline"
            className="border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold text-xs px-2"
            title="Hentikan permainan sekarang"
          >
            <Square size={12} />
          </Button>
        </div>
      </header>

      {/* ── Timer bar ─────────────────────────────────────────────── */}
      <div className="h-1.5 w-full bg-white/5 shrink-0">
        <div
          className={`h-full ${timerColor} transition-[width] ease-linear duration-1000`}
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
                className="h-full bg-green-500 rounded-l-full transition-[width] duration-700"
                style={{ width: `${classAccuracyPct ?? 0}%` }}
              />
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-white/20 bg-[#0f0f1a] flex flex-col items-center justify-center shrink-0 shadow-xl">
              <span className="text-base font-black text-white leading-none">
                {classAccuracyPct !== null ? `${classAccuracyPct}%` : "—"}
              </span>
              <span className="text-[8px] font-black text-white/40 uppercase tracking-wide mt-0.5">
                {t("ketepatanKecil")}
              </span>
            </div>
            <div className="flex-1 h-4 bg-red-900/30 rounded-r-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-r-full transition-[width] duration-700"
                style={{ width: `${classAccuracyPct !== null ? 100 - classAccuracyPct : 0}%` }}
              />
            </div>
          </div>

          {/* Leaderboard legend */}
          <div className="px-4 pb-2 flex items-center justify-between shrink-0">
            <h2 className="text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center gap-1">
              <Trophy size={10} className="text-yellow-400" aria-hidden="true" /> {t("peringkatLangsung")}
            </h2>
            <span className="text-[10px] font-black text-white/20">{totalPlayers} {t("pesertaKecil")}</span>
          </div>

          {/* Legend: status colors (Wayground-style) */}
          <div className="px-3 pb-2 flex items-center gap-2 flex-wrap shrink-0 text-[8px] font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-green-500 rounded-sm" /><span className="text-white/40">{t("benarKecil")}</span></div>
            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-red-500 rounded-sm" /><span className="text-white/40">{t("salahKecil")}</span></div>
            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-amber-500 rounded-sm" /><span className="text-white/40">{t("sebagianBenarKecil")}</span></div>
            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-white/10 rounded-sm" /><span className="text-white/40">N/A</span></div>
          </div>

          {/* Player rows — Wayground-style with per-question colored grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
            {leaderboard.slice(0, 15).map((p: any, i: number) => {
              const av = getAvatar(p.avatarId);
              const totalAns = p.totalAnswered || 0;
              const correct = p.totalCorrect || 0;
              const totalQs = totalQuestions || 1;
              const accuracy = totalAns > 0 ? Math.round((correct / totalAns) * 100) : 0;
              const history = p.answerHistory || {};

              // Build per-question status array by questionIndex (0..totalQs-1)
              const historyByIndex: Record<number, string> = {};
              Object.values(history).forEach((h: any) => {
                if (h && typeof h.questionIndex === "number") {
                  historyByIndex[h.questionIndex] = h.status;
                }
              });

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
                  className={`flex flex-col gap-1.5 px-2.5 py-2.5 rounded-xl border zy-motion ${rankBg}`}
                >
                  {/* Top row: rank + avatar + name + score */}
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${rankBadge}`}>
                      {i + 1}
                    </div>
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${av.bg} flex items-center justify-center text-base shrink-0`}>
                      {av.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-white truncate">{p.name}</span>
                        <span className="text-xs font-black text-blue-400 shrink-0">
                          {(p.score || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[9px]">
                        <span className={`font-black ${accuracy >= 70 ? "text-green-400" : accuracy >= 40 ? "text-amber-400" : accuracy > 0 ? "text-red-400" : "text-white/30"}`}>
                          {totalAns > 0 ? `${accuracy}%` : "—"}
                        </span>
                        <span className="text-white/20">·</span>
                        <span className="text-green-400 font-bold">{correct}</span>
                        <span className="text-white/20">/</span>
                        <span className="text-white/40">{totalAns}</span>
                        {(p.streak || 0) >= 3 && (
                          <span className="ml-auto flex items-center gap-0.5 text-orange-400 font-bold">
                            <Flame size={9} /> {p.streak}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Per-question colored grid (Wayground-style) */}
                  {totalQs > 0 && (
                    <div className="flex items-center gap-[3px] flex-wrap pl-9">
                      {Array.from({ length: Math.min(totalQs, 30) }).map((_, qi) => {
                        const status = historyByIndex[qi];
                        const cellColor =
                          status === "correct" ? "bg-green-500" :
                          status === "wrong" ? "bg-red-500" :
                          status === "partial" ? "bg-amber-500" :
                          status === "unattempted" ? "bg-red-900/50" :
                          "bg-white/[0.06]";
                        return (
                          <div
                            key={qi}
                            title={`Q${qi + 1}: ${status || "not answered yet"}`}
                            className={`h-3 flex-1 min-w-[6px] max-w-[14px] rounded-sm ${cellColor} zy-motion`}
                          />
                        );
                      })}
                      {totalQs > 30 && (
                        <span className="text-[8px] text-white/30 ml-1">+{totalQs - 30}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {leaderboard.length > 15 && (
              <div className="text-center text-[10px] text-white/20 py-2">
                +{leaderboard.length - 15} more players
              </div>
            )}
            {leaderboard.length === 0 && (
              <div className="text-center py-10 text-white/20 text-xs">Belum ada peserta</div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT PANEL ════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* --- Classic / non-Wayground: Question + answer distribution --- */}
          {!isClassicMode && (
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
                        className={`rounded-2xl overflow-hidden border-2 zy-motion duration-500 ${
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
                          <span className="text-white font-black text-xl md:text-2xl shrink-0 zy-num">{pct}%</span>
                        </div>
                        <div className="bg-black/40 px-4 py-2.5">
                          <div className="flex justify-between text-xs font-bold mb-1.5 text-white/50">
                            <span>{count} peserta</span>
                          </div>
                          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${col.bar} rounded-full transition-[width] duration-700`}
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
                    { label: "Benar", val: answerStats.correct || 0, color: "text-green-400" },
                    { label: "Salah", val: totalAnswered - (answerStats.correct || 0), color: "text-red-400" },
                    { label: "Belum menjawab", val: totalPlayers - totalAnswered, color: "text-white/40" },
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
          {isClassicMode && (
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Mode badge */}
              <div className="mx-4 mt-4 mb-3 px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center gap-2 shrink-0">
                <Zap size={14} className="text-blue-400" />
                <span className="text-xs font-black text-blue-400 uppercase tracking-widest">
                  {t("klasikSpanduk")}
                </span>
              </div>

              {/* Column headers */}
              <div className="flex items-center justify-between px-5 mb-2 shrink-0">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                  Kemajuan peserta · {totalPlayers} peserta
                </span>
                <span className="text-[10px] font-black text-white/20 uppercase">
                  {totalQuestions > 0
                    ? `${playersFinished}/${totalPlayers} ${t("tamatKecil")}`
                    : t("memuatKecil")}
                </span>
              </div>

              {/* Legend */}
              <div className="px-5 pb-2 flex items-center gap-3 flex-wrap shrink-0 text-[9px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-sm" /><span className="text-white/40">Benar</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-sm" /><span className="text-white/40">Salah</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-900/50 rounded-sm" /><span className="text-white/40">Belum menjawab</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-white/10 rounded-sm" /><span className="text-white/40">Belum dijawab</span></div>
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
                    const isDone = totalQs > 0 && answered >= totalQs;

                    // Build per-question status array
                    const history = p.answerHistory || {};
                    const historyByIndex: Record<number, string> = {};
                    Object.values(history).forEach((h: any) => {
                      if (h && typeof h.questionIndex === "number") {
                        historyByIndex[h.questionIndex] = h.status;
                      }
                    });

                    /**
                     * Riwayat per-soal hanya terbentuk dari kabar langsung
                     * yang tiba selagi tab ini terbuka; ia tidak ikut
                     * dikirim /api/room/state. Guru yang memuat ulang
                     * halamannya kehilangan seluruhnya, sementara angka di
                     * sebelahnya tetap dibaca dari peladen.
                     *
                     * Akibatnya satu baris bisa berkata "10/45" sambil
                     * menggambar empat puluh lima kotak yang semuanya
                     * berarti "belum dijawab". Selama kotak-kotak itu belum
                     * bisa dipulihkan dari peladen, lebih jujur menampilkan
                     * apa yang memang diketahui — berapa banyak — daripada
                     * mengarang soal mana.
                     */
                    const riwayatDiketahui = Object.keys(historyByIndex).length > 0;
                    const riwayatHilang = !riwayatDiketahui && answered > 0;

                    return (
                      <div
                        key={p.id || p.name}
                        className={`flex items-center gap-3 px-3 py-3 rounded-2xl border zy-motion ${
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

                        {/* Name + per-question grid */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-sm text-white truncate">{p.name}</span>
                            <div className="flex items-center gap-2 text-xs shrink-0 ml-2">
                              {isDone ? (
                                <span className="text-green-400 font-black text-[10px] uppercase">✓ {t("tamatKecil")}</span>
                              ) : (
                                <span className="text-white/40 font-bold">{answered}/{totalQs}</span>
                              )}
                            </div>
                          </div>
                          {/* Wayground-style colored grid (one cell per question) */}
                          {riwayatHilang ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-3.5 rounded-sm bg-white/[0.07] overflow-hidden">
                                <div
                                  className="h-full bg-sky-500/70 zy-motion"
                                  style={{ width: `${Math.min(100, Math.round((answered / totalQs) * 100))}%` }}
                                />
                              </div>
                              <span className="text-[8px] text-white/30 font-bold uppercase tracking-wider shrink-0">
                                {t("riwayatSoalTakTermuat")}
                              </span>
                            </div>
                          ) : (
                          <div className="flex items-center gap-[3px]">
                            {Array.from({ length: Math.min(totalQs, 25) }).map((_, qi) => {
                              const status = historyByIndex[qi];
                              const cellColor =
                                status === "correct" ? "bg-green-500" :
                                status === "wrong" ? "bg-red-500" :
                                status === "partial" ? "bg-amber-500" :
                                status === "unattempted" ? "bg-red-900/50" :
                                "bg-white/[0.07]";
                              return (
                                <div
                                  key={qi}
                                  title={`Q${qi + 1}: ${status || "not yet"}`}
                                  className={`h-3.5 flex-1 min-w-[8px] rounded-sm ${cellColor} zy-motion`}
                                />
                              );
                            })}
                            {totalQs > 25 && (
                              <span className="text-[8px] text-white/30 ml-1">+{totalQs - 25}</span>
                            )}
                          </div>
                          )}
                          {/* Mini stats */}
                          <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                            <span className="text-white/30">
                              {t("ketepatanSingkat")} <span className={`font-black ${accuracy >= 70 ? "text-green-400" : accuracy >= 40 ? "text-amber-400" : accuracy > 0 ? "text-red-400" : "text-white/30"}`}>{accuracy}%</span>
                            </span>
                            <span className="text-white/30">
                              <span className="text-green-400 font-bold">{correct}</span>/{answered}
                            </span>
                            <span className="flex items-center gap-0.5 text-orange-400">
                              <Flame size={10} />
                              <span className="font-bold">{p.streak || 0}</span>
                            </span>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="text-right shrink-0 ml-1">
                          <div className="font-black text-lg text-blue-400 leading-none">
                            {(p.score || 0).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-white/30 mt-0.5">poin</div>
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
          <span className="text-white/30 font-black uppercase tracking-widest">Ketepatan kelas</span>
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
            {isClassicMode ? "Selesai" : "Sudah menjawab"}
          </span>
          <span className="font-black text-white">
            {isClassicMode ? playersFinished : totalAnswered}
          </span>
          <span className="text-white/30">/{totalPlayers}</span>
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* Correct count */}
        <div className="flex items-center gap-1.5">
          <Flame size={11} className="text-orange-400" />
          <span className="text-white/30 font-black uppercase tracking-widest">Benar</span>
          <span className="font-black text-green-400">{answerStats.correct || 0}</span>
        </div>

        {/* Game mode badge — right side */}
        <div className="ml-auto flex items-center gap-2">
          {isClassicMode && (
            <span className="px-2 py-0.5 bg-blue-600/20 rounded-full text-blue-400 font-black text-[10px] uppercase tracking-widest">
              ⚡ Classic
            </span>
          )}
          <span className="text-white/20 font-bold capitalize">
            {isClassicMode ? "Klasik" : (RAGAM[roomState?.gameMode ?? ""] ?? "Klasik")}
          </span>
        </div>
      </div>
    </div>
  );
}
