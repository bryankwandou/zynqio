"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { Search, Rocket, Zap, Globe, Shield } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/ThemeToggle";

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
    <div className="flex flex-col min-h-screen bg-background selection:bg-blue-500/30 selection:text-blue-200 overflow-x-hidden relative">
      <div className="fixed top-6 right-6 z-[100] animate-in fade-in slide-in-from-right-8 duration-1000">
        <ThemeToggle />
      </div>
      <Navbar />
      
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Advanced Background Effects */}
        <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />
        
        <div className="w-full max-w-xl relative z-10">
          <div className="text-center mb-12 space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tighter leading-none uppercase">
              THINK <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">FAST.</span><br />
              PLAY <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">SMART.</span>
            </h1>
          </div>

          <div className="relative group animate-in zoom-in duration-700">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
            <div className="relative bg-card/80 backdrop-blur-2xl rounded-[2.3rem] p-8 md:p-12 border border-border shadow-[0_30px_100px_rgba(0,0,0,0.1)] dark:shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
              <form onSubmit={handleJoin} className="space-y-10">
                <div className="space-y-6">
                  <div className="flex flex-col items-center">
                    <label className="text-muted-foreground font-black text-center block uppercase tracking-[0.4em] text-[10px] mb-4 opacity-70">Enter Game Code</label>
                    <input
                      type="text"
                      placeholder="000000"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="w-full text-center text-6xl md:text-7xl font-black tracking-[0.25em] bg-transparent text-foreground border-none focus:ring-0 outline-none transition-all placeholder:text-muted-foreground/10 selection:bg-blue-500/20"
                      autoFocus
                    />
                  </div>
                  <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-border to-transparent" />
                </div>
                
                <Button 
                  type="submit" 
                  disabled={roomCode.length !== 6}
                  className="w-full py-10 text-2xl font-black bg-blue-600 hover:bg-blue-500 text-white rounded-2xl disabled:bg-muted disabled:text-muted-foreground transition-all shadow-2xl shadow-blue-900/20 group overflow-hidden relative border-none"
                >
                  <span className="relative z-10 flex items-center justify-center gap-4 tracking-widest">
                    JOIN BATTLE <Rocket size={28} className="group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform duration-500" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                </Button>
              </form>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
            <Link href="/auth/signup" className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-blue-600 text-white hover:bg-blue-500 transition-all text-sm font-black uppercase tracking-widest shadow-lg">
              <Zap size={16} className="fill-white" /> Get Started for Free
            </Link>
            
            <div className="flex justify-center gap-4 w-full">
              {[
                { icon: Globe, label: "GLOBAL", href: "#" },
                { icon: Zap, label: "FAST", href: "#" },
                { icon: Search, label: "EXPLORE", href: "/explore" }
              ].map((f, i) => (
                <Link key={i} href={f.href} className="flex-1 flex flex-col items-center gap-2 p-5 rounded-[2rem] bg-card border border-border hover:bg-accent/50 transition-all transform hover:scale-105 shadow-sm">
                  <f.icon className="text-blue-500" size={24} />
                  <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">{f.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="p-8 text-center text-muted-foreground/50 text-[10px] font-black uppercase tracking-[0.4em]">
        &copy; 2026 ZYNQIO &bull; ADVANCED QUIZ PLATFORM
      </footer>
    </div>
  );
}
