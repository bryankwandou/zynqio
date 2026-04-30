"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

export default function PlayerLobby({ params }: { params: Promise<{ roomCode: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const [nickname, setNickname] = useState("");
  const [playerCount, setPlayerCount] = useState(1);
  const [gameMode, setGameMode] = useState("classic");
  const [team, setTeam] = useState<string | null>(null);

  useEffect(() => {
    const savedName = localStorage.getItem("zynqio_nickname");
    if (!savedName) {
      router.push(`/play/${unwrappedParams.roomCode}/nickname`);
    } else {
      setNickname(savedName);
      
      // Native polling to check player count and game start
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/room/state?code=${unwrappedParams.roomCode}`);
          if (res.ok) {
            const state = await res.json();
            if (state && state.players) {
              setPlayerCount(state.players.length);
              
              if (state.gameMode === 'team') {
                setGameMode('team');
                // Simple deterministic team assignment for MVP
                const playerIdx = state.players.findIndex((p: any) => p.name === savedName);
                if (playerIdx !== -1) {
                  setTeam(playerIdx % 2 === 0 ? 'Red Team' : 'Blue Team');
                }
              }
            }
            if (state && state.status === 'playing') {
              router.push(`/play/${unwrappedParams.roomCode}/game`);
            }
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 2000);
      
      return () => clearInterval(pollInterval);
    }
  }, [unwrappedParams.roomCode, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950"></div>
      
      <div className="relative z-10 flex flex-col items-center text-center space-y-8">
        <div className="inline-block px-6 py-2 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-sm font-semibold mb-8">
          Room PIN: <span className="text-white ml-2 tracking-widest">{unwrappedParams.roomCode}</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white">
          You're in, <span className="text-blue-400">{nickname.slice(0, 20)}{nickname.length > 20 ? '...' : ''}</span>!
        </h1>
        
        <p className="text-xl text-slate-400">See your nickname on the screen?</p>
        
        <div className="mt-12 flex flex-col items-center">
          {gameMode === 'team' && team && (
            <div className={`mb-8 px-8 py-4 rounded-2xl border-2 animate-bounce ${team === 'Red Team' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-blue-500/20 border-blue-500 text-blue-400'}`}>
              <span className="text-sm font-bold uppercase tracking-widest block mb-1">Your Team</span>
              <span className="text-3xl font-black">{team}</span>
            </div>
          )}
          <div className="w-16 h-16 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="mt-6 text-slate-500 font-medium">Waiting for host to start...</p>
        </div>
      </div>
      
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <span className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg text-slate-400 font-medium">
          {playerCount} player{playerCount !== 1 ? 's' : ''} in lobby
        </span>
      </div>
    </div>
  );
}
