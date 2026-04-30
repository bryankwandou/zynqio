"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function NicknamePage({ params }: { params: Promise<{ roomCode: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const [nickname, setNickname] = useState("");

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim()) {
      try {
        const res = await fetch('/api/room/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: unwrappedParams.roomCode, nickname: nickname.trim() })
        });
        
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem("zynqio_nickname", data.player.name);
          router.push(`/play/${unwrappedParams.roomCode}/lobby`);
        }
      } catch (err) {
        console.error("Failed to join", err);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-6 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-white mb-2">You are joining</h1>
          <div className="text-4xl font-black text-blue-400 tracking-widest mb-8 uppercase">
            {unwrappedParams.roomCode}
          </div>
          
          <form onSubmit={handleJoin} className="space-y-4">
            <input
              type="text"
              placeholder="Enter your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full text-center text-xl bg-slate-950 border-2 border-slate-700 text-white rounded-xl py-4 focus:border-purple-500 outline-none transition-all placeholder:text-slate-600"
              required
              maxLength={500} // As per spec, large max length
            />
            <Button 
              type="submit" 
              disabled={!nickname.trim()}
              className="w-full py-6 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:bg-slate-800 transition-all"
            >
              Enter Game
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
