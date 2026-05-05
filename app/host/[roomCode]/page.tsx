"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import QRCode from "react-qr-code";
import { Users, Settings, Play, Copy, X } from "lucide-react";
import { getPusherClient } from "@/lib/pusher-client";
import { getAvatar } from "@/lib/avatars";

export default function HostLobby({ params }: { params: Promise<{ roomCode: string }> }) {
  const { status } = useSession();
  const router = useRouter();
  const unwrappedParams = use(params);
  const [players, setPlayers] = useState<{id: string, name: string, avatarId?: string}[]>([]);
  const [copySuccess, setCopySuccess] = useState("");
  const [isFullScreenQR, setIsFullScreenQR] = useState(false);
  const [gameMode, setGameMode] = useState<'classic' | 'speed_rush' | 'gold_quest' | 'battle_royale' | 'team' | 'survival'>('classic');
  const [showSettings, setShowSettings] = useState(false);
  const [globalTimer, setGlobalTimer] = useState(30);
  const [teams, setTeams] = useState<Record<string, any>>({});
  const [memeMode, setMemeMode] = useState(false);
  const [oneAttemptOnly, setOneAttemptOnly] = useState(true);

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

    const fetchPlayers = async () => {
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
    };

    const interval = setInterval(fetchPlayers, 2000);
    fetchPlayers();

    // Pusher Real-time Integration
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`room-${unwrappedParams.roomCode}`);
    
    channel.bind('player_joined', (data: any) => {
      console.log("[Pusher] Player joined:", data);
      // Immediately fetch players to ensure data consistency
      fetchPlayers();
    });

    return () => {
      clearInterval(interval);
      pusher.unsubscribe(`room-${unwrappedParams.roomCode}`);
    };
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
            revealAtEnd: true,
            memeMode,
            oneAttemptOnly,
          }
        })
      });
      router.push(`/host/${unwrappedParams.roomCode}/play`);
    } catch (err) {
      console.error("Failed to start game", err);
    }
  };

  const handleKickPlayer = async (playerId: string, playerName: string) => {
    try {
      await fetch('/api/room/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: unwrappedParams.roomCode, playerId: playerName }),
      });
      setPlayers(prev => prev.filter(p => p.name !== playerName && p.id !== playerId));
    } catch (err) {
      console.error("Kick failed", err);
    }
  };

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${unwrappedParams.roomCode}` : '';

  const copyJoinLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopySuccess("Copied!");
      setTimeout(() => setCopySuccess(""), 2000);
    } catch {
      setCopySuccess("Failed");
    }
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(unwrappedParams.roomCode);
      setCopySuccess("Code copied!");
      setTimeout(() => setCopySuccess(""), 2000);
    } catch {}
  };

  if (status === "loading") return <div className="min-h-screen bg-background" />;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground overflow-hidden">
      {/* Top Header */}
      <header className="p-4 border-b border-border flex justify-between items-center bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">Z</div>
          <span className="font-bold">Host Control</span>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="border-border text-muted-foreground hover:bg-accent"
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
        <div className="w-full md:w-1/3 flex flex-col bg-card border border-border rounded-2xl p-8 items-center justify-center relative shadow-xl shadow-blue-500/10">
          <h2 className="text-xl text-muted-foreground mb-2 font-medium">Join at</h2>
          <div className="text-2xl font-bold text-blue-600 mb-8">{typeof window !== 'undefined' ? window.location.host : 'zynqio.vercel.app'}</div>
          
          <div className="text-muted-foreground mb-2 font-medium">with Game Code</div>
          <div className="text-6xl font-black tracking-widest text-foreground mb-12 bg-background py-4 px-8 rounded-2xl border-2 border-border">
            {unwrappedParams.roomCode}
          </div>

          <div className="bg-white p-4 rounded-xl cursor-pointer hover:scale-105 transition-transform" onClick={() => setIsFullScreenQR(true)}>
            <QRCode value={joinUrl} size={180} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Scan QR or click to enlarge</p>

          {/* Copy buttons */}
          <div className="flex gap-2 mt-4 w-full">
            <button
              onClick={copyJoinLink}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all"
            >
              <Copy size={12} /> Copy Link
            </button>
            <button
              onClick={copyRoomCode}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-accent hover:bg-accent/70 text-foreground rounded-lg border border-border transition-all"
            >
              <Copy size={12} /> Copy Code
            </button>
          </div>
          {copySuccess && (
            <div className="mt-2 text-xs text-green-400 font-bold">{copySuccess}</div>
          )}
        </div>

        {/* Right Panel: Players List */}
        <div className="w-full md:w-2/3 flex flex-col bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-accent/50 p-4 border-b border-border flex justify-between items-center">
            <div className="flex items-center gap-2 font-bold text-lg text-foreground">
              <Users className="text-blue-500" />
              Players in Lobby
            </div>
            <div className="bg-blue-600 text-white px-3 py-1 rounded-full font-bold text-sm">
              {players.length}
            </div>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto">
            {players.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <div className="w-16 h-16 border-4 border-accent border-t-blue-500 rounded-full animate-spin mb-6"></div>
                <p className="text-lg">Waiting for players to join...</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {players.map(p => {
                  const av = getAvatar(p.avatarId);
                  return (
                    <div key={p.id} className="group flex items-center gap-2 bg-accent/30 hover:bg-accent/50 px-3 py-2 rounded-xl font-medium transition-colors cursor-default border border-border">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${av.bg} flex items-center justify-center text-base shrink-0`}>
                        {av.emoji}
                      </div>
                      <span className="text-sm">{p.name.length > 16 ? p.name.slice(0, 16) + '…' : p.name}</span>
                      <button
                        onClick={() => handleKickPlayer(p.id, p.name)}
                        className="ml-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                        title="Kick player"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Fullscreen QR Modal */}
      {isFullScreenQR && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center">
          <button 
            className="absolute top-8 right-8 text-muted-foreground hover:text-foreground bg-card border border-border p-3 rounded-full transition-colors"
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
          
          <div className="text-2xl text-muted-foreground font-medium">Or enter Game Code</div>
          <div className="text-8xl font-black tracking-widest text-white mt-4 uppercase">
            {unwrappedParams.roomCode}
          </div>
        </div>
      )}

      {/* Settings & Game Mode Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-border flex justify-between items-center bg-accent/30">
              <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Settings className="text-blue-500" /> Game Settings
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-foreground">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              {/* Game Mode Selection */}
              <div>
                <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider block mb-4">Select Game Mode</label>
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
                      className={`p-4 rounded-xl border-2 text-left transition-all group ${gameMode === mode.id ? 'border-blue-500 bg-blue-500/10' : 'border-border bg-accent/30 hover:border-muted-foreground/30'}`}
                    >
                      <div className="text-2xl mb-2">{mode.icon}</div>
                      <div className={`font-bold text-sm ${gameMode === mode.id ? 'text-blue-500' : 'text-foreground'}`}>{mode.name}</div>
                      <div className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors leading-tight mt-1">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Team Management Modal (Section 10.6) */}
              {gameMode === 'team' && (
                <div className="bg-accent/10 border border-border rounded-2xl p-6 animate-in slide-in-from-top-4">
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
                          className="border-border text-xs"
                        >
                          Auto {n}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(teams).map(([teamId, players]: [string, any]) => (
                      <div key={teamId} className="bg-card rounded-xl p-4 border border-border shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-bold text-sm uppercase tracking-widest">{teamId}</span>
                          <span className="text-xs text-slate-500">{players.length}</span>
                        </div>
                        <div className="space-y-1">
                          {players.map((p: any) => (
                            <div key={p.id} className="text-xs text-muted-foreground flex justify-between group">
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
                <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider block mb-4">Global Question Timer</label>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {[0, 10, 20, 30, 45, 60, 90].map(t => (
                    <button
                      key={t}
                      onClick={() => setGlobalTimer(t)}
                      className={`px-4 py-2 rounded-lg font-bold border transition-all whitespace-nowrap ${globalTimer === t ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-background border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'}`}
                    >
                      {t === 0 ? 'Off' : `${t}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider block mb-2">Extra Options</label>
                <div className="flex items-center justify-between p-4 bg-accent/20 border border-border rounded-xl">
                  <div>
                    <div className="font-bold text-foreground text-sm">🎭 Meme Mode</div>
                    <div className="text-xs text-muted-foreground">Show funny GIFs between questions</div>
                  </div>
                  <button
                    onClick={() => setMemeMode(v => !v)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${memeMode ? 'bg-blue-600' : 'bg-accent border border-border'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${memeMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 bg-accent/20 border border-border rounded-xl">
                  <div>
                    <div className="font-bold text-foreground text-sm">🔒 1× Play Limit</div>
                    <div className="text-xs text-muted-foreground">Each player can only answer once per question</div>
                  </div>
                  <button
                    onClick={() => setOneAttemptOnly(v => !v)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${oneAttemptOnly ? 'bg-blue-600' : 'bg-accent border border-border'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${oneAttemptOnly ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
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
