"use client";

import { useBahasa } from "@/lib/bahasa";
import { useState, useEffect, useRef, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAvatar } from "@/lib/avatars";
import { getPusherClient } from "@/lib/pusher-client";
import GameMusicPlayer from "@/components/GameMusicPlayer";
import { readSession, clearSession } from "@/lib/player-session";

const CORRECT_MEMES = [
  { gif: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif", caption: ["OTAK MELEDAK 🤯", "MIND = BLOWN 🤯"] as [string, string] },
  { gif: "https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif", caption: ["GASSS 🎉", "LETS GOOO 🎉"] as [string, string] },
  { gif: "https://media.giphy.com/media/3o6Zt8KNIFkBMeoMMM/giphy.gif", caption: ["MANTAP 👏", "WELL PLAYED 👏"] as [string, string] },
  { gif: "https://media.giphy.com/media/TdfyKrN7HGTIY/giphy.gif", caption: ["OTAK ENCER 🧠", "BIG BRAIN TIME 🧠"] as [string, string] },
  { gif: "https://media.giphy.com/media/l4Ki2obCyAQS5WhFe/giphy.gif", caption: ["GAMPANG 😎", "EASY CLAP 😎"] as [string, string] },
];

const WRONG_MEMES = [
  { gif: "https://media.giphy.com/media/26BRrSvJUa0crqw4E/giphy.gif", caption: ["LAGI-LAGI 😭", "NOT AGAIN 😭"] as [string, string] },
  { gif: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", caption: ["LOH KOK 😂", "WAIT WHAT 😂"] as [string, string] },
  { gif: "https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif", caption: ["DIKIT LAGI 😬", "SO CLOSE 😬"] as [string, string] },
  { gif: "https://media.giphy.com/media/14uQ3cOFteDaU/giphy.gif", caption: ["COBA LAGI NANTI 😅", "BETTER LUCK NEXT TIME 😅"] as [string, string] },
];

const OPTION_COLORS = [
  "bg-red-500 hover:bg-red-600 active:bg-red-700 border-red-700",
  "bg-blue-500 hover:bg-blue-600 active:bg-blue-700 border-blue-700",
  "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 border-amber-700",
  "bg-green-500 hover:bg-green-600 active:bg-green-700 border-green-700",
];

const OPTION_SHAPES = ["▲", "◆", "●", "■"];

/**
 * Huruf pendamping tiap pilihan.
 *
 * Empat pilihan sebelumnya hanya dibedakan warna. Sekitar satu dari
 * dua belas anak laki-laki tidak dapat memisahkan merah dari hijau,
 * dan bagi mereka dua dari empat tombol itu terlihat sama persis.
 *
 * Hurufnya juga berguna bagi seluruh kelas: guru bisa berkata
 * "jawabannya B" tanpa perlu menyebut warna yang mungkin tampak
 * berbeda di proyektor yang lampunya sudah pudar.
 */
const OPTION_LETTERS = ["A", "B", "C", "D"];

/** Nama warna untuk pembaca layar, supaya tidak hanya terdengar teksnya. */
const OPTION_COLOR_NAMES = ["merah", "biru", "kuning", "hijau"];

export default function PlayerGame({ params }: { params: Promise<{ roomCode: string }> }) {
  const { tt } = useBahasa();
  const router = useRouter();
  const { roomCode } = use(params);

  const [nickname, setNickname] = useState("");
  const [myAvatar, setMyAvatar] = useState("fox");
  const [score, setScore] = useState(0);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState<{ correct: boolean | null; points: number; message?: string; speedBonus?: number } | null>(null);
  const [gameMode, setGameMode] = useState<string>("classic");
  const [lives, setLives] = useState(3);
  const [gold, setGold] = useState(0);
  const [powerups, setPowerups] = useState<string[]>(["2x", "freeze", "shield"]);
  const [activePowerup, setActivePowerup] = useState<string | null>(null);
  const [showChests, setShowChests] = useState(false);
  const [selectedChest, setSelectedChest] = useState<number | null>(null);
  const [team, setTeam] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [memeMode, setMemeMode] = useState(false);
  const [currentMeme, setCurrentMeme] = useState<{ gif: string; caption: [string, string] } | null>(null);
  const [streakAnimation, setStreakAnimation] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | string | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [classAccuracy, setClassAccuracy] = useState<number | null>(null);

  // --- Wayground Classic state ---
  const [playerQuestionIndex, setPlayerQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [waygroundDone, setWaygroundDone] = useState(false);
  const [waygroundStats, setWaygroundStats] = useState<{
    score: number; correct: number; total: number; rank?: string;
  } | null>(null);

  const nicknameRef = useRef("");
  const playerIdRef = useRef("");
  const playerTokenRef = useRef("");
  const currentQuestionRef = useRef<any>(null);
  const roomStateRef = useRef<any>(null);
  /**
   * sessionId ruangan, dibaca dari keadaan yang datang tiap detik.
   *
   * Halaman ini hanya memegang kode ruangan dari alamatnya, dan dulu
   * kode itulah yang dikirim ke /results/<...>. Layar hasil menaruhnya
   * pada parameter sessionId, tidak ada sesi bernama enam huruf, dan
   * peserta berhenti di layar "Hasil tidak ditemukan" — sementara guru,
   * yang memang membawa sessionId, melihat papan peringkat yang utuh.
   *
   * Peladen sekarang mengenali kode ruangan dan mengambil sesi terakhir
   * yang selesai di ruangan itu. Alamat hasil memakai kode saja: pengenal
   * sesi internal tidak perlu tampil di bilah alamat atau tautan bagikan.
   */
  const sessionIdRef = useRef<string | null>(null);
  const alamatHasil = useCallback(
    () => `/results/${roomCode}`,
    [roomCode]
  );
  const timerTotalRef = useRef(30);
  const questionStartRef = useRef(Date.now());
  const activePowerupRef = useRef<string | null>(null);
  const lastUpdatedAt = useRef<number>(0);
  const countdownDoneRef = useRef(false);

  // Wayground-specific refs
  const playerQuestionIndexRef = useRef(0);
  const totalQuestionsRef = useRef(0);
  const waygroundStartedRef = useRef(false);
  const gameModeRef = useRef("classic");

  useEffect(() => { currentQuestionRef.current = currentQuestion; }, [currentQuestion]);
  useEffect(() => { activePowerupRef.current = activePowerup; }, [activePowerup]);
  useEffect(() => { playerQuestionIndexRef.current = playerQuestionIndex; }, [playerQuestionIndex]);
  useEffect(() => { totalQuestionsRef.current = totalQuestions; }, [totalQuestions]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);

  const runCountdown = useCallback(() => {
    if (countdownDoneRef.current) return;
    countdownDoneRef.current = true;
    setShowCountdown(true);
    let count = 3;
    setCountdownValue(count);
    const tick = setInterval(() => {
      count--;
      if (count > 0) setCountdownValue(count);
      else if (count === 0) setCountdownValue("GO!");
      else { clearInterval(tick); setShowCountdown(false); setCountdownValue(null); }
    }, 900);
  }, []);

  // Fetch a question by index (used by Wayground Classic)
  const fetchWaygroundQuestion = useCallback(async (index: number) => {
    const roomState = roomStateRef.current;
    if (!roomState) return;
    try {
      const qRes = await fetch(
        `/api/room/question?roomCode=${roomCode}&index=${index}&token=${encodeURIComponent(playerTokenRef.current)}`
      );
      if (!qRes.ok) {
        // No more questions — player is done
        setWaygroundDone(true);
        setWaygroundStats({
          score: score,
          correct: 0, // will be set from live state
          total: totalQuestionsRef.current,
        });
        setTimeout(() => router.push(alamatHasil()), 2000);
        return;
      }
      const q = await qRes.json();
      if (q.totalQuestions && q.totalQuestions > totalQuestionsRef.current) {
        setTotalQuestions(q.totalQuestions);
        totalQuestionsRef.current = q.totalQuestions;
      }
      const timerSeconds = roomState.settings?.timer || 20;
      timerTotalRef.current = timerSeconds;
      questionStartRef.current = Date.now();
      setCurrentQuestion({ ...q, index });
      currentQuestionRef.current = { ...q, index };
      setTimeLeft(timerSeconds);
      setIsSubmitted(false);
      setSelectedAnswer(null);
      setResult(null);
      setCurrentMeme(null);
      setClassAccuracy(null);
    } catch {
      // Network error — retry once
      setTimeout(() => fetchWaygroundQuestion(index), 1000);
    }
  }, [roomCode, router, score, alamatHasil]);

  // Trigger first Wayground question after countdown ends
  useEffect(() => {
    if (
      gameModeRef.current === 'wayground_classic' &&
      !showCountdown &&
      countdownDoneRef.current &&
      !currentQuestion &&
      waygroundStartedRef.current
    ) {
      fetchWaygroundQuestion(0);
    }
  }, [showCountdown, currentQuestion, fetchWaygroundQuestion]);

  // Auto-submit for Wayground when timer hits 0 and player hasn't answered
  useEffect(() => {
    if (
      gameModeRef.current === 'wayground_classic' &&
      timeLeft === 0 &&
      !isSubmitted &&
      currentQuestion &&
      !showCountdown
    ) {
      handleSubmit("__no_answer__");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  useEffect(() => {
    const session = readSession(roomCode);

    if (!session) {
      router.push(`/play/${roomCode}/nickname`);
      return;
    }

    const savedName = session.name;

    setNickname(savedName);
    setMyAvatar(session.avatarId);
    nicknameRef.current = savedName;
    // Identitas peserta kini token, bukan nama. Nama tampil di papan
    // peringkat dan bisa dibaca siapa saja, jadi memakainya sebagai
    // identitas berarti siapa pun bisa menjawab atas nama orang lain.
    playerTokenRef.current = session.token;
    playerIdRef.current = session.id;

    const pollRoom = async () => {
      try {
        const since = lastUpdatedAt.current;
        const url = since
          ? `/api/room/state?roomCode=${roomCode}&since=${since}`
          : `/api/room/state?roomCode=${roomCode}`;
        const res = await fetch(url);
        if (res.status === 304) return;
        if (!res.ok) return;
        const state = await res.json();
        if (state.updatedAt) lastUpdatedAt.current = state.updatedAt;
        roomStateRef.current = state;
        if (state.sessionId) sessionIdRef.current = state.sessionId;
        const detectedMode = state.gameMode || 'classic';
        setGameMode(detectedMode);
        gameModeRef.current = detectedMode;
        if (state.settings?.memeMode) setMemeMode(true);

        // Deteksi peserta yang dikeluarkan.
        //
        // Sebelumnya keadaan ruangan memuat daftar kickedPlayers berisi
        // nama, dan tiap peserta mencocokkan namanya sendiri di sana.
        // Daftar itu berarti setiap orang tahu siapa saja yang pernah
        // dikeluarkan dari ruangan — hal yang tidak perlu diketahui
        // siapa pun kecuali host. Sekarang peserta yang dikeluarkan
        // cukup dikenali dari hilangnya dirinya di daftar peserta aktif.
        const stillListed = (state.players || []).some(
          (p: { id: string }) => p.id === playerIdRef.current
        );
        if (!stillListed && state.status !== "ended") {
          setIsKicked(true);
          clearSession();
          setTimeout(() => router.replace("/?kicked=1"), 2000);
          return;
        }

        if (state.status === "playing") {
          const myData = state.players?.find((p: any) => p.name === nicknameRef.current);
          if (myData?.team) setTeam(myData.team);

          if (detectedMode === 'wayground_classic') {
            // ─── Wayground Classic: player-paced mode ───
            if (!waygroundStartedRef.current) {
              waygroundStartedRef.current = true;
              // Store totalQuestions from room if available
              if (state.totalQuestions) {
                setTotalQuestions(state.totalQuestions);
                totalQuestionsRef.current = state.totalQuestions;
              }
              runCountdown();
              // After countdown (~3s), fetchWaygroundQuestion(0) fires via the effect above
            }
            // Track class accuracy from answerStats for current question
            const curQ = currentQuestionRef.current;
            if (curQ && state.answerStats?.[curQ.id]) {
              const stats = state.answerStats[curQ.id];
              if (stats.total > 0) setClassAccuracy(Math.round((stats.correct / stats.total) * 100));
            }
            // Don't sync with room's currentQuestionIndex in wayground mode
          } else {
            // ─── Classic / other modes: host-paced ───
            const curQ = currentQuestionRef.current;
            if (curQ && state.answerStats?.[curQ.id]) {
              const stats = state.answerStats[curQ.id];
              if (stats.total > 0) setClassAccuracy(Math.round((stats.correct / stats.total) * 100));
            }
            if (!curQ || state.currentQuestionIndex !== curQ.index) {
              if (!curQ) runCountdown();
              const qRes = await fetch(
                `/api/room/question?roomCode=${roomCode}&index=${state.currentQuestionIndex}&token=${encodeURIComponent(playerTokenRef.current)}`
              );
              if (qRes.ok) {
                const q = await qRes.json();
                const timerSeconds = state.settings?.timer || 30;
                timerTotalRef.current = timerSeconds;
                questionStartRef.current = state.questionStartTimestamp || Date.now();
                setCurrentQuestion({ ...q, index: state.currentQuestionIndex });
                setTimeLeft(timerSeconds);
                setIsSubmitted(false);
                setSelectedAnswer(null);
                setResult(null);
                setCurrentMeme(null);
                setClassAccuracy(null);
              }
            }
          }
        } else if (state.status === "ended") {
          router.push(alamatHasil());
        }
      } catch {}
    };

    const roomInterval = setInterval(pollRoom, 1500);
    pollRoom();
    return () => clearInterval(roomInterval);
  }, [roomCode, router, runCountdown, alamatHasil]);

  // Pusher: instant kick detection
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`room-${roomCode}`);
    const onKicked = (data: { playerId?: string }) => {
      // Dicocokkan dengan id peserta, bukan namanya. Nama bisa sama
      // persis antar peserta di ruangan berbeda, dan pencocokan nama
      // pernah mengeluarkan orang yang salah.
      if (data?.playerId && data.playerId === playerIdRef.current) {
        setIsKicked(true);
        clearSession();
        setTimeout(() => router.replace("/?kicked=1"), 2000);
      }
    };
    channel.bind("player_kicked", onKicked);
    return () => {
      channel.unbind("player_kicked", onKicked);
    };
  }, [roomCode, router]);

  // Timer countdown
  useEffect(() => {
    const total = timerTotalRef.current || 30;
    const interval = setInterval(() => {
      if (activePowerupRef.current === "freeze") return;
      const elapsed = Math.floor((Date.now() - questionStartRef.current) / 1000);
      setTimeLeft(Math.max(0, total - elapsed));
    }, 500);
    return () => clearInterval(interval);
  }, [currentQuestion]);

  const handleSubmit = async (answer: string | string[]) => {
    if (isSubmitted) return;
    setSelectedAnswer(Array.isArray(answer) ? answer.join(",") : answer);
    setIsSubmitted(true);

    const isTimeout = answer === "__no_answer__";
    const roomState = roomStateRef.current;

    try {
      const res = await fetch("/api/answer/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Cukup token, kode ruangan, dan soal mana. Nilai lain yang dulu
        // ikut dikirim — quizId, hostId, sessionId, stempel waktu klien —
        // semuanya sudah diketahui server dari ruangannya sendiri.
        // Menerimanya dari peserta berarti mempercayai peserta untuk
        // menyebutkan kuis mana yang sedang ia mainkan dan kapan ia
        // menjawab, dan keduanya menentukan skor.
        body: JSON.stringify({
          roomCode,
          playerToken: playerTokenRef.current,
          questionId: currentQuestion.id,
          selectedAnswer: isTimeout ? null : answer,
        }),
      });

      if (!res.ok) {
        setResult({ correct: false, points: 0 });
        scheduleWaygroundAdvance(false, 0);
        return;
      }

      const data = await res.json();
      const answerHidden = data.correct === null; // quiz has hideAnswer: true
      const isCorrect = !answerHidden && data.correct === true && !isTimeout;

      let finalScore = data.sessionScore || 0;
      if (activePowerup === "2x") finalScore *= 2;

      if (memeMode && !answerHidden) {
        const pool = isCorrect ? CORRECT_MEMES : WRONG_MEMES;
        setCurrentMeme(pool[Math.floor(Math.random() * pool.length)]);
      }

      setResult({ correct: answerHidden ? null : isCorrect, points: finalScore, speedBonus: data.speedBonus });

      // Sync score from server totalScore (authoritative) when available, else increment locally
      if (data.totalScore !== undefined) {
        setScore(activePowerup === "2x" ? data.totalScore + finalScore - (data.sessionScore || 0) : data.totalScore);
      } else if (isCorrect || answerHidden) {
        setScore((p) => p + finalScore);
      }

      if (isCorrect) {
        setCorrectStreak((prev) => {
          const next = prev + 1;
          if (next >= 3) { setStreakAnimation(true); setTimeout(() => setStreakAnimation(false), 1200); }
          return next;
        });
      } else if (!answerHidden) {
        setCorrectStreak(0);
      }

      if (gameMode === "survival") {
        if (!isCorrect) setScore(0);
      } else if (gameMode === "battle_royale" && !isCorrect && activePowerup !== "shield") {
        setLives((p) => Math.max(0, p - 1));
      } else if (gameMode === "gold_quest" && isCorrect) {
        setShowChests(true);
      }

      setActivePowerup(null);

      // Wayground Classic: auto-advance after 0.8s feedback
      if (gameModeRef.current === 'wayground_classic') {
        scheduleWaygroundAdvance(isCorrect, finalScore);
      }
    } catch {
      setResult({ correct: false, points: 0 });
      if (gameModeRef.current === 'wayground_classic') {
        scheduleWaygroundAdvance(false, 0);
      }
    }
  };

  const scheduleWaygroundAdvance = (isCorrect: boolean, pts: number) => {
    setTimeout(() => {
      const nextIndex = playerQuestionIndexRef.current + 1;
      const total = totalQuestionsRef.current;

      setTimeout(() => {
        setResult(null);
        setCurrentMeme(null);

        if (total > 0 && nextIndex >= total) {
          setWaygroundDone(true);
          setScore((prev) => {
            setWaygroundStats({ score: prev, correct: 0, total });
            return prev;
          });
          setTimeout(() => router.push(alamatHasil()), 1500);
        } else {
          playerQuestionIndexRef.current = nextIndex;
          setPlayerQuestionIndex(nextIndex);
          fetchWaygroundQuestion(nextIndex);
        }
      }, 400);
    }, 800);
  };

  const handleChestSelect = (index: number) => {
    setSelectedChest(index);
    const outcomes = [
      { val: 500, msg: tt("+500 EMAS!", "+500 GOLD!") },
      { val: 200, msg: tt("+200 EMAS", "+200 GOLD") },
      { val: 1000, msg: tt("JACKPOT! +1000", "JACKPOT! +1000") },
      { val: -100, msg: tt("JEBAKAN! -100 EMAS", "TRAP! -100 GOLD") },
    ];
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    setTimeout(() => {
      setGold((p) => Math.max(0, p + outcome.val));
      setResult({ correct: true, points: 0, message: outcome.msg });
      setShowChests(false);
      setSelectedChest(null);
    }, 2000);
  };

  const usePowerup = (p: string) => {
    if (activePowerup || isSubmitted) return;
    setActivePowerup(p);
    setPowerups((prev) => prev.filter((item) => item !== p));
  };

  const avatarInfo = getAvatar(myAvatar);
  const timerPct = timerTotalRef.current > 0 ? (timeLeft / timerTotalRef.current) * 100 : 100;
  const isWayground = gameMode === 'wayground_classic';

  // ── Kicked ──────────────────────────────────────────────────────
  if (isKicked) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center p-8 text-center text-white">
        <div className="text-6xl mb-6">🚫</div>
        <h2 className="text-2xl font-bold mb-2">{tt("Anda dikeluarkan dari ruangan", "You were removed from the room")}</h2>
        <p className="text-white/60">{tt("Pengajar mengeluarkan Anda dari ruangan ini.", "The teacher removed you from this room.")}</p>
        <p className="text-sm text-white/40 mt-2" role="status">{tt("Kembali ke halaman depan…", "Back to the home page…")}</p>
      </div>
    );
  }

  // ── Battle Royale eliminated ─────────────────────────────────────
  if (gameMode === "battle_royale" && lives === 0) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center p-8 text-center text-white">
        <div className="text-7xl mb-6 grayscale animate-pulse">💔</div>
        <h2 className="text-3xl font-black uppercase tracking-widest mb-3">{tt("GUGUR", "KNOCKED OUT")}</h2>
        <p className="text-white/60 max-w-xs">{tt("Nyawa Anda habis. Silakan menyimak sisa permainannya.", "You are out of lives. Enjoy watching the rest of the game.")}</p>
        <div className="mt-10 bg-white/5 border border-white/10 p-6 rounded-2xl">
          <div className="text-xs text-white/40 uppercase font-bold tracking-widest mb-1">{tt("Skor akhir", "Final score")}</div>
          <div className="text-5xl font-black text-blue-400">{score}</div>
        </div>
      </div>
    );
  }

  // ── Wayground Classic: player finished all questions ─────────────
  if (isWayground && waygroundDone) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center p-8 text-center text-white">
        <div className="text-6xl mb-4">🏁</div>
        <div className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2">{tt("⚡ Klasik", "⚡ Classic")}</div>
        <h2 className="text-3xl font-black mb-2">{tt("Selesai", "Done")}</h2>
        <p className="text-white/50 mb-6 text-sm" role="status">{tt("Menyiapkan hasil Anda…", "Preparing your results…")}</p>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 w-full max-w-xs">
          <div className="text-4xl font-black text-blue-400 mb-1">{score.toLocaleString()}</div>
          <div className="text-xs text-white/40 uppercase tracking-widest">{tt("Skor total", "Total score")}</div>
        </div>
        <div className="mt-6 w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Waiting for game to start ────────────────────────────────────
  if (!currentQuestion && !showCountdown) {
    return (
      <div className="h-[100dvh] bg-[#0f0f1a] flex flex-col items-center justify-center text-white">
        {isWayground && (
          <div className="mb-6 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-full text-xs font-black text-blue-400 uppercase tracking-widest">
            {tt("⚡ RAGAM KLASIK", "⚡ CLASSIC MODE")}
          </div>
        )}
        <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-5" />
        <h2 className="text-xl font-bold">{tt("Bersiap", "Get ready")}</h2>
        <p className="text-white/50 text-sm mt-1" role="status">{tt("Menunggu pengajar memulai permainan…", "Waiting for the teacher to start the game…")}</p>
        {isWayground && (
          <p className="text-white/30 text-xs mt-3 max-w-xs text-center">
            {tt("Jawab, langsung lanjut. Tidak perlu menunggu waktu habis.", "Answer and move straight on. No waiting for the timer.")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#0f0f1a] text-white flex flex-col relative overflow-x-hidden">

      {/* Countdown Overlay */}
      {showCountdown && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0f0f1a]/95">
          {isWayground && (
            <div className="mb-4 px-4 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-full text-xs font-black text-blue-400 uppercase tracking-widest">
              {tt("⚡ Klasik", "⚡ Classic")}
            </div>
          )}
          <div key={String(countdownValue)} className="text-9xl font-black animate-ping-once"
            style={{ textShadow: "0 0 60px rgba(79,142,255,0.6)" }}>
            {countdownValue === "GO!" ? tt("MULAI", "GO") : countdownValue}
          </div>
          <p className="mt-8 text-white/50 font-bold text-lg tracking-widest uppercase">
            {countdownValue === "GO!" ? tt("Mulai!", "Go!") : tt("Bersiap…", "Get ready…")}
          </p>
          {isWayground && countdownValue !== "GO!" && (
            <p className="mt-3 text-white/30 text-sm">{tt("⚡ Ragam klasik — jawab, langsung lanjut", "⚡ Classic mode — answer and move on")}</p>
          )}
        </div>
      )}

      {/* Streak Badge */}
      {correctStreak >= 3 && !showCountdown && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 zy-motion ${streakAnimation ? "scale-125" : "scale-100"}`}>
          <div className={`px-4 py-1.5 rounded-full font-black text-sm flex items-center gap-1.5 shadow-lg ${correctStreak >= 5 ? "bg-purple-500 animate-pulse" : "bg-orange-500"}`}>
            🔥 {correctStreak}{tt("x beruntun!", "x Streak!")}
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="h-14 bg-[#16162a] border-b border-white/10 flex items-center justify-between px-3 sm:px-5 shadow-sm shrink-0">
        {/* Left: avatar + name */}
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avatarInfo.bg} flex items-center justify-center text-base shrink-0`}>
            {avatarInfo.emoji}
          </div>
          <span className="font-bold text-sm text-white/80 hidden sm:block max-w-[100px] truncate">{nickname}</span>
          {isWayground && totalQuestions > 0 && (
            <span className="text-[10px] text-white/30 font-bold">
              {playerQuestionIndex + 1}/{totalQuestions}
            </span>
          )}
          {gameMode === "battle_royale" && (
            <div className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`text-sm ${i < lives ? "text-red-400" : "text-white/20"}`}>❤️</span>
              ))}
            </div>
          )}
        </div>

        {/* Center: Timer ring */}
        <div className="flex flex-col items-center">
          <div className={`w-11 h-11 rounded-full border-[3px] flex items-center justify-center font-black text-base transition-colors ${
            timeLeft <= 5 ? "border-red-500 text-red-400 animate-pulse" :
            timeLeft <= 10 ? "border-amber-500 text-amber-400" :
            "border-white/30 text-white"
          }`}>
            {timeLeft}
          </div>
          {isWayground && (
            <span className="text-[8px] text-white/25 mt-0.5">{tt("tidak mengunci", "does not lock")}</span>
          )}
        </div>

        {/* Right: Score + music */}
        <div className="flex items-center gap-2">
          {gameMode === "gold_quest" && (
            <div className="text-yellow-400 text-sm font-bold">🪙 {gold}</div>
          )}
          <div className="bg-blue-500/15 px-3 py-1 rounded-full font-black text-blue-400 text-sm border border-blue-500/20">
            {score.toLocaleString("id-ID")}{" "}{tt("poin", "points")}
          </div>
          <GameMusicPlayer defaultVolume={0.4} />
        </div>
      </div>

      {/* Timer bar */}
      <div className={`h-1.5 shrink-0 ${isWayground ? "bg-blue-900/30" : "bg-white/5"}`}>
        <div
          className={`h-full transition-[width] duration-500 ${isWayground ? "bg-blue-500" : timerPct > 60 ? "bg-green-500" : timerPct > 30 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* Wayground mode badge */}
      {isWayground && !showCountdown && (
        <div className="flex items-center justify-center gap-2 py-1 bg-blue-600/10 border-b border-blue-500/10 shrink-0">
          <span className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest">{tt("⚡ Klasik · jawab, langsung lanjut", "⚡ Classic · answer and move on")}</span>
        </div>
      )}

      {/* Class accuracy pill */}
      {classAccuracy !== null && (
        <div className="flex justify-center py-1.5 shrink-0">
          <div className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full border border-white/10">
            {tt("Ketepatan kelas:", "Class accuracy:")}{" "}<span className={`font-bold ${classAccuracy >= 70 ? "text-green-400" : classAccuracy >= 40 ? "text-amber-400" : "text-red-400"}`}>{classAccuracy}%</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      {currentQuestion && (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain flex flex-col px-3 py-3 sm:px-5 sm:py-4 max-w-2xl mx-auto w-full">
          {/* Question number */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-white/30 bg-white/5 px-2.5 py-1 rounded-full uppercase tracking-widest">
              {isWayground && totalQuestions > 0
                ? `Q${playerQuestionIndex + 1} / ${totalQuestions}`
                : `Q${(currentQuestion.index ?? 0) + 1}`}
            </span>
            {correctStreak >= 3 && (
              <span className="text-[11px] font-black text-orange-400">🔥 {correctStreak}{" "}{tt("beruntun", "streak")}</span>
            )}
          </div>

          {/* Question text */}
          <div className="bg-[#16162a] border border-white/10 rounded-2xl p-4 mb-3 text-center shadow-xl">
            {currentQuestion.image && (
              <img src={currentQuestion.image} alt="" className="max-h-36 mx-auto rounded-xl mb-3 object-contain" />
            )}
            <p className="text-base sm:text-lg font-bold leading-snug text-white">
              {currentQuestion.text}
            </p>
          </div>

          {/* Answer options */}
          {currentQuestion.answerKind === "isian" && (
            <IsianJawaban key={currentQuestion.id} disabled={isSubmitted} onKirim={handleSubmit} />
          )}
          {currentQuestion.answerKind === "urutan" && (
            <UrutanJawaban
              key={currentQuestion.id}
              options={currentQuestion.options ?? []}
              optionIds={currentQuestion.optionIds ?? []}
              disabled={isSubmitted}
              onKirim={handleSubmit}
            />
          )}
          {currentQuestion.answerKind === "ganda" && (
            <GandaJawaban
              key={currentQuestion.id}
              options={currentQuestion.options ?? []}
              disabled={isSubmitted}
              onKirim={handleSubmit}
            />
          )}
          {!["isian", "urutan", "ganda"].includes(currentQuestion.answerKind) && (
          <div className={`grid gap-2 flex-1 ${
            (currentQuestion.options?.length ?? 0) <= 2 ? "grid-cols-1" : "grid-cols-2"
          }`}>
            {currentQuestion.options?.map((opt: string, i: number) => {
              const isSelected = selectedAnswer === i.toString() || selectedAnswer === opt;
              return (
                <button
                  key={i}
                  disabled={isSubmitted}
                  onClick={() => handleSubmit(i.toString())}
                  aria-label={tt(`Pilihan ${OPTION_LETTERS[i % 4]}, ${OPTION_COLOR_NAMES[i % 4]}: ${opt}`, `Option ${OPTION_LETTERS[i % 4]}: ${opt}`)}
                  aria-pressed={isSelected}
                  className={`w-full p-3 sm:p-4 rounded-2xl text-white font-bold text-sm sm:text-base shadow-lg transform zy-motion active:scale-95 border-b-4 flex items-center gap-2 ${
                    OPTION_COLORS[i % OPTION_COLORS.length]
                  } ${isSubmitted && !isSelected ? "opacity-40 grayscale" : ""} ${
                    isSelected ? "ring-2 ring-white/50 scale-[1.02]" : "hover:scale-[1.02]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/25 flex flex-col items-center justify-center shrink-0 leading-none"
                  >
                    <span className="text-sm sm:text-base">
                      {OPTION_SHAPES[i % OPTION_SHAPES.length]}
                    </span>
                    <span className="text-[10px] sm:text-xs font-black tracking-wider">
                      {OPTION_LETTERS[i % OPTION_LETTERS.length]}
                    </span>
                  </span>
                  <span className="text-left leading-tight">{opt}</span>
                </button>
              );
            })}
          </div>
          )}

          {/* Powerups (not shown in wayground) */}
          {!isSubmitted && !isWayground && powerups.length > 0 && (
            <div className="flex gap-2 justify-center mt-3">
              {powerups.map((p, i) => (
                <button
                  key={i}
                  onClick={() => usePowerup(p)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold uppercase zy-motion ${
                    activePowerup === p
                      ? "bg-blue-600 border-blue-400 text-white animate-pulse"
                      : "bg-white/5 border-white/10 text-white/50 hover:border-white/30"
                  }`}
                >
                  {p === "2x" && tt("2× poin", "2× points")}
                  {p === "freeze" && tt("❄️ Tahan waktu", "❄️ Freeze time")}
                  {p === "shield" && tt("🛡️ Perisai", "🛡️ Shield")}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result Overlay — Wayground: compact 0.8s flash */}
      {result && !showChests && (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 ${
          result.correct === null ? "bg-indigo-700/92" :
          result.correct ? "bg-green-600/92" : "bg-red-600/92"
        } backdrop-blur-sm`}>
          {result.correct === null ? (
            <div className="text-7xl mb-5 animate-bounce">📝</div>
          ) : memeMode && currentMeme ? (
            <div className="flex flex-col items-center mb-5">
              <img src={currentMeme.gif} alt={tt("meme", "meme")} className="rounded-2xl max-h-52 shadow-2xl mb-3" />
              <div className="text-white font-black text-lg tracking-widest">{tt(...currentMeme.caption)}</div>
            </div>
          ) : (
            <div className="text-7xl mb-5 animate-bounce">{result.correct ? "🎉" : "❌"}</div>
          )}

          <h2 className="text-3xl font-black text-white mb-2 tracking-wide uppercase">
            {result.message || (result.correct === null ? tt("Terkirim", "Sent") : result.correct ? tt("Benar", "Correct") : tt("Belum tepat", "Not quite"))}
          </h2>

          {result.correct === null && (
            <div className="mt-2 text-white/60 text-sm font-medium text-center max-w-xs">
              {tt("Jawaban disembunyikan pengajar — hasilnya dibuka di akhir", "Answer hidden by host — results revealed at the end")}
            </div>
          )}

          {result.correct === true && result.points > 0 && (
            <div className="bg-white/20 px-5 py-2 rounded-full mt-3 font-bold text-lg text-white">
              +{result.points}{" "}{tt("poin", "points")}
              {result.speedBonus && result.speedBonus > 0 && (
                <span className="ml-2 text-sm opacity-80">(+{result.speedBonus}{" "}{tt("beruntun)", "streak)")}</span>
              )}
            </div>
          )}

          {result.correct === null && result.points > 0 && (
            <div className="bg-white/15 px-5 py-2 rounded-full mt-3 font-bold text-lg text-white">
              +{result.points}{" "}{tt("poin tercatat", "points recorded")}
            </div>
          )}

          {result.correct === true && correctStreak >= 3 && (
            <div className="mt-3 px-4 py-1.5 bg-orange-500 rounded-full font-black text-white text-sm animate-bounce">
              🔥 {correctStreak}{tt("x beruntun!", "x streak!")}
            </div>
          )}

          {gameMode === "battle_royale" && result.correct === false && (
            <div className="mt-4 text-2xl">{tt("💔 -1 Nyawa", "💔 -1 Life")}</div>
          )}

          {/* Wayground: next arrow indicator */}
          {isWayground ? (
            <div className="mt-6 flex items-center gap-2 text-white/60 text-sm font-bold">
              <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
              {tt("Memuat soal berikutnya…", "Next question loading…")}
            </div>
          ) : (
            <div className="mt-8 text-white/70 font-medium text-sm" role="status">{tt("Menunggu soal berikutnya…", "Waiting for the next question…")}</div>
          )}
        </div>
      )}

      {/* Gold Quest Chests */}
      {showChests && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0f1a]/95">
          <h2 className="text-2xl font-black text-yellow-400 mb-6 uppercase tracking-widest">{tt("Pilih satu peti", "Pick a chest")}</h2>
          <div className="flex gap-5">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => handleChestSelect(i)}
                disabled={selectedChest !== null}
                className={`w-28 h-28 rounded-2xl flex items-center justify-center text-5xl shadow-2xl zy-motion ${
                  selectedChest === i ? "bg-yellow-500 scale-110" :
                  selectedChest !== null ? "bg-white/5 opacity-50" :
                  "bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-105"
                }`}
              >
                {selectedChest === i ? "✨" : "📦"}
              </button>
            ))}
          </div>
        </div>
      )}

      <style jsx global>{`
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

const TOMBOL_KIRIM =
  "w-full mt-3 p-4 rounded-2xl bg-primary text-white font-black text-base shadow-lg zy-motion active:scale-95 disabled:opacity-40";

function IsianJawaban({ disabled, onKirim }: { disabled: boolean; onKirim: (a: string) => void }) {
  const { tt } = useBahasa();
  const [teks, setTeks] = useState("");
  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => { e.preventDefault(); if (teks.trim()) onKirim(teks.trim()); }}
    >
      <label htmlFor="isian-jawaban" className="text-xs font-bold text-white/50 mb-2">{tt("Ketik jawabanmu", "Type your answer")}</label>
      <input
        id="isian-jawaban"
        autoFocus
        autoComplete="off"
        disabled={disabled}
        value={teks}
        onChange={(e) => setTeks(e.target.value)}
        maxLength={200}
        className="w-full p-4 rounded-2xl bg-[#16162a] border border-white/20 text-white text-lg font-bold outline-none focus:ring-2 focus:ring-primary"
      />
      <button type="submit" disabled={disabled || !teks.trim()} className={TOMBOL_KIRIM}>{tt("Kirim", "Submit")}</button>
    </form>
  );
}

function GandaJawaban({ options, disabled, onKirim }: { options: string[]; disabled: boolean; onKirim: (a: string[]) => void }) {
  const { tt } = useBahasa();
  const [dipilih, setDipilih] = useState<number[]>([]);
  const ubah = (i: number) => setDipilih((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  return (
    <div className="flex flex-col">
      <p className="text-xs font-bold text-white/50 mb-2">{tt("Pilih semua jawaban yang benar", "Select every correct answer")}</p>
      <div className={`grid gap-2 ${options.length <= 2 ? "grid-cols-1" : "grid-cols-2"}`}>
        {options.map((opt, i) => {
          const aktif = dipilih.includes(i);
          return (
            <button
              key={i}
              type="button"
              role="checkbox"
              aria-checked={aktif}
              disabled={disabled}
              onClick={() => ubah(i)}
              className={`w-full p-3 sm:p-4 rounded-2xl text-white font-bold text-sm sm:text-base shadow-lg border-b-4 flex items-center gap-2 zy-motion ${OPTION_COLORS[i % OPTION_COLORS.length]} ${aktif ? "ring-4 ring-white scale-[1.02]" : "opacity-80"}`}
            >
              <span aria-hidden="true" className="w-8 h-8 rounded-lg bg-white/25 flex items-center justify-center shrink-0">{aktif ? "✓" : ""}</span>
              <span className="text-left leading-tight">{opt}</span>
            </button>
          );
        })}
      </div>
      <button type="button" disabled={disabled || dipilih.length === 0} onClick={() => onKirim([...dipilih].sort((a, b) => a - b).map(String))} className={TOMBOL_KIRIM}>
        {tt("Kirim", "Submit")}
      </button>
    </div>
  );
}

function UrutanJawaban({ options, optionIds, disabled, onKirim }: { options: string[]; optionIds: number[]; disabled: boolean; onKirim: (a: string[]) => void }) {
  const { tt } = useBahasa();
  const [urutan, setUrutan] = useState(() => options.map((t, n) => ({ t, id: optionIds[n] ?? n })));
  const geser = (n: number, arah: -1 | 1) =>
    setUrutan((u) => {
      const m = n + arah;
      if (m < 0 || m >= u.length) return u;
      const salin = [...u];
      [salin[n], salin[m]] = [salin[m], salin[n]];
      return salin;
    });
  return (
    <div className="flex flex-col">
      <p className="text-xs font-bold text-white/50 mb-2">{tt("Susun dari yang pertama sampai terakhir", "Arrange from first to last")}</p>
      <ol className="flex flex-col gap-2">
        {urutan.map((x, n) => (
          <li key={x.id} className="flex items-center gap-2 p-3 rounded-2xl bg-[#16162a] border border-white/15 text-white font-bold">
            <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-sm shrink-0">{n + 1}</span>
            <span className="flex-1 text-left">{x.t}</span>
            <button type="button" disabled={disabled || n === 0} onClick={() => geser(n, -1)} aria-label={tt(`Naikkan ${x.t}`, `Move ${x.t} up`)} className="w-10 h-10 rounded-xl bg-white/10 disabled:opacity-30">▲</button>
            <button type="button" disabled={disabled || n === urutan.length - 1} onClick={() => geser(n, 1)} aria-label={tt(`Turunkan ${x.t}`, `Move ${x.t} down`)} className="w-10 h-10 rounded-xl bg-white/10 disabled:opacity-30">▼</button>
          </li>
        ))}
      </ol>
      <button type="button" disabled={disabled} onClick={() => onKirim(urutan.map((x) => String(x.id)))} className={TOMBOL_KIRIM}>
        {tt("Kirim", "Submit")}
      </button>
    </div>
  );
}
