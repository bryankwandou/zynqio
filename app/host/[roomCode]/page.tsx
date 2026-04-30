"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import QRCode from "react-qr-code";
import { Users, Play, Settings, X, Expand } from "lucide-react";

export default function HostLobby({ params }: { params: Promise<{ roomCode: string }> }) {
  const { status } = useSession();
  const router = useRouter();
  const unwrappedParams = use(params);
  const [players, setPlayers] = useState<{id: string, name: string}[]>([]);
  const [isFullScreenQR, setIsFullScreenQR] = useState(false);
  const [gameMode, setGameMode] = useState<'classic' | 'speed_rush' | 'gold_quest' | 'battle_royale' | 'team' | 'survival'>('classic');
  const [showSettings, setShowSettings] = useState(false);
  const [globalTimer, setGlobalTimer] = useState(30);
  const [teams, setTeams] = useState<Record<string, any>>({});

  const autoAssignTeams = (count: number) => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const newTeams: Record<string, any> = {};
    for (let i = 0; i < count; i++) {
      newTeams[`Team ${i + 1}`] = [];
    }
    shuffled.forEach((p, index) => {
      newTeams[`Team ${(index % count) + 1}`].push(p);
    });
    setTeams(newTeams);
    // Persist to room state via API
    fetch('/api/room/update-teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: unwrappedParams.roomCode, teams: newTeams })
    });
  };

  const removeFromTeam = (playerId: string) => {
    const newTeams = { ...teams };
    for (const teamId in newTeams) {
      newTeams[teamId] = newTeams[teamId].filter((p: any) => p.id !== playerId);
    }
    setTeams(newTeams);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }

    // Native polling for realtime state without Pusher
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/room/state?code=${unwrappedParams.roomCode}`);
        if (res.ok) {
          const state = await res.json();
          if (state && state.players) {
            setPlayers(state.players);
          }
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [status, router, unwrappedParams.roomCode]);

  const handleStartGame = async () => {
    try {
      await fetch('/api/room/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomCode: unwrappedParams.roomCode,
          gameMode,
          settings: {
            timer: globalTimer,
            showAnswer: true,
            revealAtEnd: true
          }
        })
      });
      router.push(`/host/${unwrappedParams.roomCode}/play`);
    } catch (err) {
      console.error("Failed to start game", err);
    }
  };

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${unwrappedParams.roomCode}` : '';

  if (status === "loading") return <div className="min-h-screen bg-slate-950" />;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Top Header */}
      <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">Z</div>
          <span className="font-bold">Host Control</span>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={18} className="mr-2" /> Settings
          </Button>
          <Button 
            className="bg-green-600 hover:bg-green-700 text-white font-bold"
            disabled={players.length === 0}
            onClick={handleStartGame}
          >
            <Play size={18} className="mr-2" /> Start Game
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row p-6 gap-6 h-[calc(100vh-73px)]">
        {/* Left Panel: Join Info */}
        <div className="w-full md:w-1/3 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl p-8 items-center justify-center relative shadow-xl shadow-blue-900/10">
          <h2 className="text-xl text-slate-400 mb-2 font-medium">Join at</h2>
          <div className="text-2xl font-bold text-blue-400 mb-8">{typeof window !== 'undefined' ? window.location.host : 'zynqio.vercel.app'}</div>
          
          <div className="text-slate-400 mb-2 font-medium">with Game Code</div>
          <div className="text-6xl font-black tracking-widest text-white mb-12 bg-slate-950 py-4 px-8 rounded-2xl border-2 border-slate-800">
            {unwrappedParams.roomCode}
          </div>

          <div className="bg-white p-4 rounded-xl cursor-pointer hover:scale-105 transition-transform" onClick={() => setIsFullScreenQR(true)}>
            <QRCode value={joinUrl} size={180} />
          </div>
          <p className="mt-4 text-sm text-slate-500">Scan QR or click to enlarge</p>
        </div>

        {/* Right Panel: Players List */}
        <div className="w-full md:w-2/3 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-slate-800/50 p-4 border-b border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2 font-bold text-lg">
              <Users className="text-blue-400" />
              Players in Lobby
            </div>
            <div className="bg-blue-600 text-white px-3 py-1 rounded-full font-bold text-sm">
              {players.length}
            </div>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto">
            {players.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <div className="w-16 h-16 border-4 border-slate-800 border-t-slate-500 rounded-full animate-spin mb-6"></div>
                <p className="text-lg">Waiting for players to join...</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {players.map(p => (
                  <div key={p.id} className="group flex items-center bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-lg font-medium transition-colors cursor-default border border-slate-700">
                    {p.name.length > 20 ? p.name.slice(0, 20) + '...' : p.name}
                    <button className="ml-3 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Fullscreen QR Modal */}
      {isFullScreenQR && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center">
          <button 
            className="absolute top-8 right-8 text-slate-400 hover:text-white bg-slate-900 p-3 rounded-full transition-colors"
            onClick={() => setIsFullScreenQR(false)}
          >
            <X size={32} />
          </button>
          
          <div className="text-4xl font-bold text-white mb-12">
            Join at <span className="text-blue-400">{typeof window !== 'undefined' ? window.location.host : 'zynqio.vercel.app'}</span>
          </div>
          
          <div className="bg-white p-8 rounded-3xl mb-12">
            <QRCode value={joinUrl} size={400} />
          </div>
          
          <div className="text-2xl text-slate-400 font-medium">Or enter Game Code</div>
          <div className="text-8xl font-black tracking-widest text-white mt-4 uppercase">
            {unwrappedParams.roomCode}
          </div>
        </div>
      )}

      {/* Settings & Game Mode Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings className="text-blue-400" /> Game Settings
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              {/* Game Mode Selection */}
              <div>
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block mb-4">Select Game Mode</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'classic', name: 'Classic', icon: '🏆', desc: 'Standard quiz' },
                    { id: 'speed_rush', name: 'Speed Rush', icon: '⚡', desc: 'Faster = More Points' },
                    { id: 'gold_quest', name: 'Gold Quest', icon: '💰', desc: 'Chests & Stealing' },
                    { id: 'battle_royale', name: 'Battle Royale', icon: '⚔️', desc: 'Elimination' },
                    { id: 'team', name: 'Team Mode', icon: '👥', desc: 'Work together' },
                    { id: 'survival', name: 'Survival', icon: '🏔️', desc: 'Don\'t miss!' },
                  ].map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => setGameMode(mode.id as any)}
                      className={`p-4 rounded-xl border-2 text-left transition-all group ${gameMode === mode.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-800/30 hover:border-slate-700'}`}
                    >
                      <div className="text-2xl mb-2">{mode.icon}</div>
                      <div className={`font-bold text-sm ${gameMode === mode.id ? 'text-blue-400' : 'text-slate-200'}`}>{mode.name}</div>
                      <div className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors leading-tight mt-1">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Team Management Modal (Section 10.6) */}
              {gameMode === 'team' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-in slide-in-from-top-4">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Users className="text-blue-500" /> Team Assignments
                    </h2>
                    <div className="flex gap-2">
                      {[2, 3, 4, 6].map(n => (
                        <Button 
                          key={n}
                          variant="outline"
                          size="sm"
                          onClick={() => autoAssignTeams(n)}
                          className="border-slate-700 text-xs"
                        >
                          Auto {n}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(teams).map(([teamId, players]: [string, any]) => (
                      <div key={teamId} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-bold text-sm uppercase tracking-widest">{teamId}</span>
                          <span className="text-xs text-slate-500">{players.length}</span>
                        </div>
                        <div className="space-y-1">
                          {players.map((p: any) => (
                            <div key={p.id} className="text-xs text-slate-300 flex justify-between group">
                              <span>{p.name}</span>
                              <button className="hidden group-hover:block text-red-500" onClick={() => removeFromTeam(p.id)}>×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timer Setting */}
              <div>
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block mb-4">Global Question Timer</label>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {[0, 10, 20, 30, 45, 60, 90].map(t => (
                    <button
                      key={t}
                      onClick={() => setGlobalTimer(t)}
                      className={`px-4 py-2 rounded-lg font-bold border transition-all whitespace-nowrap ${globalTimer === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      {t === 0 ? 'Off' : `${t}s`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-blue-900/20"
                  onClick={() => setShowSettings(false)}
                >
                  Confirm Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
