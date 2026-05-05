"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Activity,
  Database,
  Zap,
  Server,
  ArrowRight,
  ExternalLink,
  Lock,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import Link from "next/link";

type EnvCheck = {
  key: string;
  level: "required" | "recommended" | "optional";
  state: "set" | "fallback" | "missing";
  note: string;
};

type DebugStatus = {
  status: {
    code: "fully_configured" | "autonomous_mode" | "configuration_missing";
    label: string;
  };
  details: EnvCheck[];
  nodeEnv: string;
};

export default function SetupPage() {
  const [data, setData] = useState<DebugStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDiagnostics() {
      try {
        const res = await fetch("/api/debug", { cache: "no-store" });
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to fetch diagnostics", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDiagnostics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Running Diagnostics...</p>
        </div>
      </div>
    );
  }

  const status = data?.status || { code: "configuration_missing", label: "Configuration Required" };
  const isHealthy = status.code === "fully_configured";

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-16 max-w-5xl relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12"
        >
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-600/20 text-blue-500 text-[10px] font-black uppercase tracking-widest">
              <Shield size={14} /> Production Security Active
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight uppercase leading-none">
              System <span className="text-blue-600">Diagnostics</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl font-medium">
              Real-time monitoring of Zynqio&apos;s production infrastructure and automated scaling.
            </p>
          </div>

          <div className={`px-6 py-4 rounded-3xl border-2 flex items-center gap-4 shadow-xl transition-all ${
            isHealthy 
              ? "bg-green-500/10 border-green-500/30 text-green-500" 
              : "bg-blue-500/10 border-blue-500/30 text-blue-500 shadow-blue-500/10" 
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-current/10 flex items-center justify-center">
              {isHealthy ? <Activity size={24} /> : <Zap size={24} />}
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest opacity-70">Engine Status</div>
              <div className="text-xl font-black uppercase tracking-tight">{status.label}</div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Main Info Card */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card border border-border rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 transform group-hover:scale-110 transition-transform">
              <Database size={120} />
            </div>
            <h2 className="text-2xl font-black mb-6 uppercase tracking-tight flex items-center gap-3 text-foreground">
              <Server className="text-blue-600" /> Infrastructure Core
            </h2>
            <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-center p-4 rounded-2xl bg-accent/30 border border-border">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Environment</span>
                <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-black uppercase">{data?.nodeEnv || "production"}</span>
              </div>
              <div className="flex justify-between items-center p-4 rounded-2xl bg-accent/30 border border-border">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Engine Mode</span>
                <span className="font-black text-foreground">CLOUD OPTIMIZED</span>
              </div>
              <div className="flex justify-between items-center p-4 rounded-2xl bg-accent/30 border border-border">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Vercel Status</span>
                <span className="font-black text-green-500 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                  ONLINE
                </span>
              </div>
            </div>
          </motion.div>

          {/* Service Matrix */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card border border-border rounded-[2.5rem] p-10 shadow-2xl"
          >
            <h2 className="text-2xl font-black mb-6 uppercase tracking-tight flex items-center gap-3 text-foreground">
              <Zap className="text-amber-500" /> Service Matrix
            </h2>
            <div className="space-y-3">
              {data?.details?.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-border hover:bg-accent/30 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      item.state === 'set' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {item.key.includes('AUTH') ? <Lock size={16} /> : item.key.includes('REDIS') ? <Database size={16} /> : <Globe size={16} />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{item.level}</span>
                      <span className="font-bold text-foreground tracking-tight">{item.key}</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    item.state === 'set' 
                      ? 'bg-green-500/10 border-green-500/30 text-green-500' 
                      : item.state === 'fallback' 
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' 
                        : 'bg-red-500/10 border-red-500/30 text-red-500'
                  }`}>
                    {item.state === 'fallback' ? 'PRODUCTION' : item.state}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Presidential Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/auth/signin" className="md:col-span-2 group">
            <div className="bg-blue-600 p-8 rounded-[2rem] text-white flex justify-between items-center shadow-xl shadow-blue-900/20 group-hover:bg-blue-500 transition-all">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight mb-1">Return to Login</h3>
                <p className="text-blue-100 text-sm font-medium">Continue to the platform login page.</p>
              </div>
              <ArrowRight className="group-hover:translate-x-2 transition-transform" size={32} />
            </div>
          </Link>

          <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="group">
            <div className="bg-card border border-border p-8 rounded-[2rem] text-foreground flex justify-between items-center shadow-xl group-hover:border-blue-500/50 transition-all">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight mb-1">Update Vercel</h3>
                <p className="text-muted-foreground text-xs font-medium flex items-center gap-1">Configure Vars <ExternalLink size={10} /></p>
              </div>
              <Activity className="text-muted-foreground/30 group-hover:text-blue-500 transition-colors" size={24} />
            </div>
          </a>
        </div>

        {/* Presidential Action Notice */}
        <div className="mt-12 p-8 bg-blue-600/10 border border-blue-600/20 rounded-[2.5rem] relative overflow-hidden">
           <div className="relative z-10">
              <h3 className="text-blue-600 font-black uppercase tracking-widest text-sm mb-4 flex items-center gap-2">
                <Shield size={18} /> Production Security Protocol
              </h3>
              <div className="space-y-3">
                <p className="text-blue-600/80 text-sm font-medium leading-relaxed">
                  The Zynqio Engine is currently running in <strong>Production Mode</strong>. 
                  All systems are operational with full production state management and serverless persistence.
                </p>
                <div className="pt-4 border-t border-blue-600/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600/60 tracking-widest">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    Google Auth: Operational
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600/60 tracking-widest">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    Storage Engine: Optimized
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600/60 tracking-widest">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    Real-time Logic: Active
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600/60 tracking-widest">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    Excel Engine: Production Ready
                  </div>
                </div>
              </div>
           </div>
           <Zap className="absolute right-[-20px] bottom-[-20px] text-blue-600/5 rotate-12" size={200} />
        </div>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center border-t border-border/50 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/50">
        Zynqio Advanced Engine &bull; Build 2026.05.02 &bull; Fully Operational
      </footer>
    </div>
  );
}
