"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { Search, Rocket, Zap, Globe, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const [roomCode, setRoomCode] = useState("");
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim().length === 6) {
      router.push(`/join/${roomCode.toUpperCase()}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#050510] selection:bg-blue-500/30 selection:text-blue-200 overflow-x-hidden">
      <Navbar />
      
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Advanced Background Effects */}
        <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />
        
        <div className="w-full max-w-xl relative z-10">
          <div className="text-center mb-12 space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-bold mb-4">
              <Zap size={16} className="fill-blue-400" />
              <span>NEXT-GEN INTERACTIVE QUIZ PLATFORM</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none">
              THINK <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">FAST.</span><br />
              PLAY <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">SMART.</span>
            </h1>
          </div>

          <div className="relative group animate-in zoom-in duration-700">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
            <div className="relative bg-slate-950/90 backdrop-blur-xl rounded-[2.3rem] p-8 md:p-12 border border-white/5">
              <form onSubmit={handleJoin} className="space-y-10">
                <div className="space-y-6">
                  <div className="flex flex-col items-center">
                    <label className="text-slate-400 font-black text-center block uppercase tracking-[0.3em] text-xs mb-4">Enter Game Code</label>
                    <input
                      type="text"
                      placeholder="000000"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="w-full text-center text-6xl md:text-7xl font-black tracking-[0.2em] bg-transparent text-white border-none focus:ring-0 outline-none transition-all placeholder:text-slate-900 selection:bg-blue-500/50"
                      autoFocus
                    />
                  </div>
                  <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
                </div>
                
                <Button 
                  type="submit" 
                  disabled={roomCode.length !== 6}
                  className="w-full py-10 text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl disabled:bg-slate-900 disabled:text-slate-700 transition-all shadow-[0_20px_50px_rgba(37,99,235,0.3)] group overflow-hidden relative border-none"
                >
                  <span className="relative z-10 flex items-center justify-center gap-4">
                    JOIN THE BATTLE <Rocket size={28} className="group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform duration-500" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                </Button>
              </form>
            </div>
          </div>

          {/* Features Row */}
          <div className="grid grid-cols-3 gap-4 mt-16 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
            {[
              { icon: Globe, label: "GLOBAL", href: "#" },
              { icon: ShieldCheck, label: "SECURE", href: "#" },
              { icon: Search, label: "EXPLORE", href: "/explore" }
            ].map((f, i) => (
              <Link key={i} href={f.href} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <f.icon className="text-slate-400" size={20} />
                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">{f.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="p-8 text-center text-slate-600 text-xs font-medium uppercase tracking-[0.3em]">
        &copy; 2026 ZYNQIO &bull; POWERED BY VERCEL
      </footer>
    </div>
  );
}
