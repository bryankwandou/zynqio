"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Users, Timer, SkipForward, Pause, Play, Trophy } from "lucide-react";

export default function HostGame({ params }: { params: Promise<{ roomCode: string }> }) {
  const { status } = useSession();
  const router = useRouter();
  const unwrappedParams = use(params);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [answersCount, setAnswersCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [roomState, setRoomState] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }

    const pollState = async () => {
      try {
        const res = await fetch(`/api/room/state?code=${unwrappedParams.roomCode}`);
        if (res.ok) {
          const state = await res.json();
          setRoomState(state);
          setTotalPlayers(state.players?.length || 0);
          setAnswersCount(state.answersCount || 0);
          
          if (!currentQuestion || state.currentQuestionIndex !== roomState?.currentQuestionIndex) {
            const qRes = await fetch(
              `/api/quiz/get-question?quizId=${state.quizId}&index=${state.currentQuestionIndex}&roomCode=${unwrappedParams.roomCode}`
            );
            if (qRes.ok) {
              const q = await qRes.json();
              setCurrentQuestion(q);
              setIsRevealed(false);
              const timer = state.settings?.timer || 30;
              setTimeLeft(timer);
            }
          }

          if (state.status === 'ended') {
            router.push(`/results/${unwrappedParams.roomCode}`);
          }

          // Fetch logs
          const logRes = await fetch(`/api/room/get-logs?code=${unwrappedParams.roomCode}`);
          if (logRes.ok) {
            const logData = await logRes.json();
            setLogs(logData);
          }
        }
      } catch (err) {
        console.error("Poll error", err);
      }
    };

    const interval = setInterval(pollState, 2000);
    pollState();

    return () => clearInterval(interval);
  }, [status, router, unwrappedParams.roomCode, currentQuestion, roomState]);

  useEffect(() => {
    if (timeLeft > 0 && !isRevealed) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !isRevealed) {
      setIsRevealed(true);
    }
  }, [timeLeft, isRevealed]);

  const handleNextQuestion = async () => {
    try {
      await fetch('/api/room/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: unwrappedParams.roomCode })
      });
    } catch (err) {
      console.error("Next question error", err);
    }
  };

  if (status === "loading" || !currentQuestion) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-foreground font-black uppercase tracking-widest animate-pulse">Loading Question...</div>;
  }

  // Same colors as player view
  const colors = [
    "bg-red-500",
    "bg-blue-500",
    "bg-amber-500",
    "bg-green-500"
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground overflow-hidden">
      {/* Top Header */}
      <header className="p-4 border-b border-border flex justify-between items-center bg-card shadow-sm">
        <div className="flex items-center gap-6">
          <div className="bg-accent/50 px-4 py-2 rounded-lg font-bold text-lg tracking-widest border border-border text-foreground">
            {unwrappedParams.roomCode}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users size={20} className="text-blue-400" />
            <span className="font-bold text-foreground">{answersCount} / {totalPlayers}</span> Answers
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-border text-muted-foreground hover:bg-accent">
            <Pause size={18} className="mr-2" /> Pause
          </Button>
          {isRevealed ? (
            <Button className="bg-blue-600 hover:bg-blue-700 font-bold" onClick={handleNextQuestion}>
              Next <SkipForward size={18} className="ml-2" />
            </Button>
          ) : (
            <Button className="bg-amber-600 hover:bg-amber-700 font-bold" onClick={() => setIsRevealed(true)}>
              Reveal Answer
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col p-6 max-w-6xl mx-auto w-full">
        {/* Timer Bar */}
        <div className="w-full bg-accent/30 rounded-full h-2 mb-8 overflow-hidden">
          <div 
            className="bg-blue-500 h-full transition-all ease-linear duration-1000" 
            style={{ width: `${(timeLeft / (roomState?.settings?.timer || 30)) * 100}%` }}
          />
        </div>

        {/* Question Text */}
        <div className="flex-1 flex flex-col items-center justify-center mb-12 relative">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-center leading-tight">
            {currentQuestion.text}
          </h1>
          
          {/* Circular Timer (Absolute center if we want that Kahoot feel) */}
          {!isRevealed && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-4 border-border flex items-center justify-center text-3xl font-black bg-card shadow-xl text-foreground">
              {timeLeft}
            </div>
          )}
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-64">
          {currentQuestion.options?.map((opt: string, i: number) => {
            const isCorrect = currentQuestion.correctAnswer === i.toString();
            const bgClass = colors[i % colors.length];
            
            // Dim wrong answers if revealed
            const revealStateClass = isRevealed 
              ? (isCorrect ? 'ring-4 ring-white scale-[1.02] z-10' : 'opacity-20 grayscale')
              : '';

            return (
              <div
                key={i}
                className={`w-full rounded-2xl flex items-center p-6 text-2xl font-bold border-b-8 shadow-lg transition-all duration-500 ${bgClass} ${revealStateClass}`}
                style={{ borderColor: 'rgba(0,0,0,0.2)' }}
              >
                {/* Option shape indicator (mock) */}
                <div className="w-10 h-10 bg-white/20 mr-4 rounded-sm flex-shrink-0" />
                <span className="break-words line-clamp-2">{opt}</span>
                
                {isRevealed && isCorrect && (
                  <div className="ml-auto bg-white/20 p-2 rounded-full">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Side Logs Panel (Phase 2/3) */}
      <div className="fixed right-4 bottom-4 w-64 max-h-96 bg-card/90 border border-border rounded-2xl p-4 overflow-y-auto z-50 backdrop-blur-md shadow-2xl">
        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
          <Shield size={14} className="text-blue-500" /> Security Logs
        </h3>
        <div className="space-y-3">
          {logs.filter(l => l.event === 'tab_switch').map((log, i) => (
            <div key={i} className="text-[10px] bg-red-500/10 border border-red-500/20 p-2 rounded-lg text-red-400">
              <span className="font-bold">{log.playerId}</span> switched tabs
            </div>
          ))}
          {logs.length === 0 && <div className="text-[10px] text-muted-foreground/50 text-center py-4">No incidents detected</div>}
        </div>
      </div>
    </div>
  );
}

function Shield({ size, className }: { size: number, className?: string }) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
