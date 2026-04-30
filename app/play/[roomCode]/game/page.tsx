"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function PlayerGame({ params }: { params: Promise<{ roomCode: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const [nickname, setNickname] = useState("");
  const [score, setScore] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState<{ correct: boolean, points: number, message?: string, score?: number, accuracyPoints?: number } | null>(null);
  
  // Phase 2/3 Additions
  const [gameMode, setGameMode] = useState<'classic' | 'gold_quest' | 'battle_royale' | 'team' | 'survival'>('classic');
  const [lives, setLives] = useState(3);
  const [survivalStreak, setSurvivalStreak] = useState(0);
  const [gold, setGold] = useState(0);
  const [powerups, setPowerups] = useState<string[]>(['2x', 'freeze', 'shield']);
  const [activePowerup, setActivePowerup] = useState<string | null>(null);
  const [showChests, setShowChests] = useState(false);
  const [selectedChest, setSelectedChest] = useState<number | null>(null);
  const [reactions, setReactions] = useState<{id: string, emoji: string, x: number}[]>([]);
  const [team, setTeam] = useState<string | null>(null);
  const [isMusicOn, setIsMusicOn] = useState(true);
  const [timeLeft, setTimeLeft] = useState(30);
  const [questionStart, setQuestionStart] = useState(Date.now());
  const [notifications, setNotifications] = useState<string[]>([]);

  useEffect(() => {
    const savedName = localStorage.getItem("zynqio_nickname");
    if (!savedName) router.push(`/play/${unwrappedParams.roomCode}/nickname`);
    else setNickname(savedName);

    const pollRoom = async () => {
      try {
        const res = await fetch(`/api/room/state?code=${unwrappedParams.roomCode}`);
        if (res.ok) {
          const state = await res.json();
          setGameMode(state.gameMode || 'classic');
          
          if (state.status === 'playing') {
            const myData = state.players?.find((p: any) => p.name === savedName);
            if (myData) {
              if (myData.team) setTeam(myData.team);
              // Server-side lives sync if needed, but client usually tracks for immediate UI
            }
            
            if (!currentQuestion || state.currentQuestionIndex !== currentQuestion.index) {
              // Fetch new question
              const qRes = await fetch(`/api/quiz/get-question?quizId=${state.quizId}&index=${state.currentQuestionIndex}`);
              if (qRes.ok) {
                const q = await qRes.json();
                setCurrentQuestion({ ...q, index: state.currentQuestionIndex });
                setQuestionStart(state.questionStartTimestamp || Date.now());
                setIsSubmitted(false);
                setSelectedAnswer(null);
                setResult(null);
              }
            }
            } else if (state.status === 'ended') {
              router.push(`/results/${unwrappedParams.roomCode}`);
            }

            // Check for new events
            const logRes = await fetch(`/api/room/get-logs?code=${unwrappedParams.roomCode}`);
            if (logRes.ok) {
              const logs = await logRes.json();
              const recentSteal = logs.find((l: any) => l.event === 'steal' && (Date.now() - new Date(l.timestamp).getTime()) < 3000);
              if (recentSteal && !notifications.includes(recentSteal.timestamp)) {
                setNotifications(prev => [...prev, `${recentSteal.playerId} stole some gold!`]);
                setTimeout(() => setNotifications(prev => prev.slice(1)), 3000);
              }

              // Sync reactions
              const newReactions = logs.filter((l: any) => l.event === 'reaction' && (Date.now() - new Date(l.timestamp).getTime()) < 3000);
              newReactions.forEach((r: any) => {
                if (!reactions.find(existing => existing.id === r.timestamp)) { // Using timestamp as ID for sync
                   const id = r.timestamp;
                   setReactions(prev => [...prev, { id, emoji: r.data, x: Math.random() * 80 + 10 }]);
                   setTimeout(() => setReactions(prev => prev.filter(rx => rx.id !== id)), 2000);
                }
              });
            }
          } else if (state.status === 'ended') {
            router.push(`/results/${unwrappedParams.roomCode}`);
          }
        }
      } catch (err) {
        console.error("Poll error", err);
      }
    };

    const interval = setInterval(pollRoom, 2000);
    pollRoom();

    const timerInterval = setInterval(() => {
      if (activePowerup === 'freeze') return;
      const elapsed = Math.floor((Date.now() - questionStart) / 1000);
      const total = 30;
      setTimeLeft(Math.max(0, total - elapsed));
    }, 1000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        fetch('/api/room/log-event', {
          method: 'POST',
          body: JSON.stringify({ roomCode: unwrappedParams.roomCode, playerId: savedName, event: 'tab_switch' })
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      clearInterval(timerInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [unwrappedParams.roomCode, router, currentQuestion, questionStart, activePowerup, nickname, reactions]);

  const handleSubmit = async (answer: string) => {
    if (isSubmitted) return;
    
    setSelectedAnswer(answer);
    setIsSubmitted(true);

    try {
      const res = await fetch('/api/answer/submit', {
        method: 'POST',
        body: JSON.stringify({
          playerId: nickname,
          questionId: currentQuestion.id,
          selectedAnswer: answer,
          clientTimestamp: Date.now(),
          roomCode: unwrappedParams.roomCode
        })
      });
      const data = await res.json();
      
      let finalScore = data.sessionScore || 0;
      if (activePowerup === '2x') finalScore *= 2;

      setResult({
        correct: data.correct,
        points: finalScore
      });
      
      if (gameMode === 'survival') {
        if (data.correct) {
          setSurvivalStreak(prev => prev + 1);
          setScore(prev => prev + finalScore);
        } else {
          setSurvivalStreak(0);
          setScore(0);
        }
      } else {
        setScore(prev => prev + finalScore);
      }

      if (gameMode === 'battle_royale' && !data.correct && activePowerup !== 'shield') {
        setLives(prev => Math.max(0, prev - 1));
      } else if (gameMode === 'gold_quest' && data.correct) {
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
      { type: 'gold', val: 500, msg: '+500 GOLD!' },
      { type: 'gold', val: 200, msg: '+200 GOLD' },
      { type: 'gold', val: 1000, msg: 'JACKPOT! +1000' },
      { type: 'steal', val: 300, msg: 'STOLE 300 GOLD!' },
      { type: 'loss', val: -100, msg: 'TRAP! -100 GOLD' }
    ];
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    
    setTimeout(() => {
      if (outcome.type === 'steal') {
        fetch('/api/room/log-event', {
          method: 'POST',
          body: JSON.stringify({ roomCode: unwrappedParams.roomCode, playerId: nickname, event: 'steal', data: 300 })
        }).catch(() => {});
      }
      
      setGold(prev => Math.max(0, prev + outcome.val));
      setResult({ correct: true, points: 0, score: score, accuracyPoints: 1, message: outcome.msg });
      setShowChests(false);
      setSelectedChest(null);
    }, 2000);
  };

  const sendReaction = async (emoji: string) => {
    const id = Date.now().toString();
    setReactions(prev => [...prev, { id, emoji, x: Math.random() * 80 + 10 }]);
    
    // Broadcast reaction (Section 19.6)
    fetch('/api/room/log-event', {
      method: 'POST',
      body: JSON.stringify({ roomCode: unwrappedParams.roomCode, playerId: nickname, event: 'reaction', data: emoji })
    }).catch(() => {});

    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  };

  const usePowerup = (p: string) => {
    if (activePowerup) return;
    setActivePowerup(p);
    setPowerups(prev => prev.filter(item => item !== p));
  };

  if (gameMode === 'battle_royale' && lives === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-8">
        <div className="text-8xl mb-8 grayscale animate-pulse">💔</div>
        <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-widest text-center">ELIMINATED</h2>
        <p className="text-slate-400 text-center max-w-md text-lg">
          You've lost all your lives. You can still watch the game, but you can't answer anymore questions.
        </p>
        <div className="mt-12 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <div className="text-sm text-slate-500 uppercase font-bold tracking-tighter mb-1">Final Score</div>
          <div className="text-5xl font-black text-blue-500">{score}</div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-bold">Get Ready!</h2>
        <p className="text-slate-400">Loading next question...</p>
      </div>
    );
  }

  // Define Kahoot/Wayground style colors for options
  const colors = [
    "bg-red-500 hover:bg-red-600 border-red-700",
    "bg-blue-500 hover:bg-blue-600 border-blue-700",
    "bg-amber-500 hover:bg-amber-600 border-amber-700",
    "bg-green-500 hover:bg-green-600 border-green-700"
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col relative overflow-hidden">
      {/* Top Bar */}
      <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sm:px-8">
        <div className="font-bold text-slate-300 flex items-center gap-4">
          {nickname}
          {gameMode === 'team' && team && (
            <span className={`text-xs px-2 py-1 rounded ${
              team.includes('Red') ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
              team.includes('Blue') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
              team.includes('Green') ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
              'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            }`}>
              {team}
            </span>
          )}
          {gameMode === 'battle_royale' && (
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <span key={i} className={`text-xl ${i < lives ? 'text-red-500' : 'text-slate-700'}`}>❤️</span>
              ))}
            </div>
          )}
          {gameMode === 'survival' && (
            <div className="text-orange-500 font-bold flex items-center gap-1 bg-orange-500/10 px-2 py-1 rounded">
              🔥 {survivalStreak} Streak
            </div>
          )}
        </div>
        <div className="w-10 h-10 rounded-full border-2 border-slate-700 flex items-center justify-center font-black text-sm bg-slate-950 text-white">
          {timeLeft}
        </div>
        <div className="flex items-center gap-4">
          {gameMode === 'gold_quest' && (
            <div className="bg-yellow-500/20 px-4 py-1 rounded-full font-bold text-yellow-500 border border-yellow-500/30 flex items-center gap-2">
              <span className="text-lg">🪙</span> {gold}
            </div>
          )}
          <div className="bg-slate-800 px-4 py-1 rounded-full font-bold text-blue-400 border border-slate-700">
            Score: {score}
          </div>
          <button 
            onClick={() => setIsMusicOn(!isMusicOn)}
            className="p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-all"
          >
            {isMusicOn ? <Zap size={18} className="fill-blue-400 text-blue-400" /> : <Zap size={18} className="grayscale" />}
          </button>
        </div>
      </div>

      {/* Background Music Loop (Royalty Free Placeholder) */}
      <audio 
        src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" 
        autoPlay 
        loop 
        muted={!isMusicOn}
        style={{ display: 'none' }}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8 text-center shadow-xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-relaxed">
            {currentQuestion.text}
          </h1>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          {currentQuestion.options?.map((opt: string, i: number) => {
            const isSelected = selectedAnswer === i.toString() || selectedAnswer === opt;
            const bgClass = colors[i % colors.length];
            
            return (
              <button
                key={i}
                disabled={isSubmitted}
                onClick={() => handleSubmit(i.toString())}
                className={`w-full p-8 rounded-2xl text-white font-bold text-xl sm:text-2xl shadow-lg transform transition-all active:scale-95 flex items-center justify-center border-b-4 ${bgClass} ${isSubmitted && !isSelected ? 'opacity-40 grayscale' : ''}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Power-ups Bar (Phase 2) */}
      {!isSubmitted && powerups.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-40">
          {powerups.map((p, i) => (
            <button
              key={i}
              onClick={() => usePowerup(p)}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black shadow-[0_0_15px_rgba(0,0,0,0.5)] transform transition-transform hover:scale-110 ${activePowerup === p ? 'bg-blue-500 ring-4 ring-white' : p === '2x' ? 'bg-amber-500' : p === 'freeze' ? 'bg-cyan-500' : 'bg-purple-500'}`}
            >
              {p === '2x' ? '2x' : p === 'freeze' ? '❄️' : '🛡️'}
            </button>
          ))}
        </div>
      )}

      {/* Live Reactions UI (Phase 3) */}
      {result && !showChests && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-50">
          {['👍', '❤️', '🔥', '😂'].map(emoji => (
            <button 
              key={emoji} 
              onClick={() => sendReaction(emoji)}
              className="text-3xl hover:scale-125 transition-transform bg-white/10 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Notifications */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2">
        {notifications.map((n, i) => (
          <div key={i} className="bg-amber-500 text-slate-900 px-6 py-2 rounded-full font-black text-sm shadow-2xl animate-bounce">
            ⚠️ {n}
          </div>
        ))}
      </div>

      {/* Floating Reaction Animations */}
      {reactions.map(r => (
        <div 
          key={r.id} 
          className="absolute text-4xl animate-[floatUp_2s_ease-out_forwards] pointer-events-none z-50"
          style={{ left: `${r.x}%`, bottom: '100px' }}
        >
          {r.emoji}
        </div>
      ))}

      {/* Result Overlay */}
      {result && !showChests && (
        <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center ${result.correct ? 'bg-green-600/90' : 'bg-red-600/90'} backdrop-blur-sm animate-in fade-in duration-300`}>
          <div className="text-6xl mb-6">{result.correct ? '🎉' : '❌'}</div>
          <h2 className="text-4xl font-black text-white mb-2 tracking-wide uppercase">
            {result.correct ? 'Correct!' : 'Incorrect'}
          </h2>
          {result.correct && (
            <div className="bg-white/20 px-6 py-2 rounded-full mt-4 font-bold text-xl text-white">
              +{result.points} Points
            </div>
          )}
          {gameMode === 'battle_royale' && !result.correct && (
            <div className="mt-4 text-3xl">💔 -1 Life</div>
          )}
          <div className="mt-12 text-white/80 font-medium">Waiting for host...</div>
        </div>
      )}

      {/* Gold Quest Chest Selection (Phase 2) */}
      {showChests && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-md animate-in fade-in">
          <h2 className="text-3xl font-black text-yellow-400 mb-8 uppercase tracking-widest">Choose a Chest!</h2>
          <div className="flex gap-6">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => handleChestSelect(i)}
                disabled={selectedChest !== null}
                className={`w-32 h-32 rounded-2xl flex items-center justify-center text-6xl shadow-2xl transition-all ${selectedChest === i ? 'bg-yellow-500 scale-110' : selectedChest !== null ? 'bg-slate-800 opacity-50' : 'bg-slate-700 hover:bg-slate-600 hover:scale-105'}`}
              >
                {selectedChest === i ? '✨' : '📦'}
              </button>
            ))}
          </div>
          {selectedChest !== null && (
            <div className="mt-12 text-2xl font-bold text-white animate-bounce">
              Revealing reward...
            </div>
          )}
        </div>
      )}
      {/* Reactions Display */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
        {reactions.map(r => (
          <div 
            key={r.id} 
            className="absolute bottom-0 text-4xl animate-float-up"
            style={{ left: `${r.x}%` }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Footer / Controls */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/80 backdrop-blur-lg border-t border-slate-800 flex flex-col items-center gap-4">
        {/* Reactions Bar */}
        <div className="flex gap-4">
          {['👍', '❤️', '🔥', '😂', '😮'].map(emoji => (
            <button 
              key={emoji} 
              onClick={() => sendReaction(emoji)}
              className="text-2xl hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Power-ups Bar */}
        <div className="flex gap-2">
          {powerups.map((p, i) => (
            <button 
              key={i} 
              onClick={() => usePowerup(p)}
              disabled={!!activePowerup}
              className={`px-4 py-2 rounded-xl border text-sm font-bold uppercase transition-all ${
                activePowerup === p ? 'bg-blue-600 border-blue-400 text-white animate-pulse' :
                'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {p === '2x' && 'Double Points'}
              {p === 'freeze' && 'Freeze Time'}
              {p === 'shield' && 'Shield'}
            </button>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-100vh) scale(1.5); opacity: 0; }
        }
        .animate-float-up {
          animation: float-up 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
