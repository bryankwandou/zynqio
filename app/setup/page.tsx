"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle2, AlertTriangle, Terminal, ArrowRight, ExternalLink, Database, Zap, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function SetupPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkConfig() {
      try {
        const res = await fetch('/api/debug');
        const data = await res.json();
        setConfig(data);
      } catch (e) {
        console.error("Failed to fetch debug info", e);
      } finally {
        setLoading(false);
      }
    }
    checkConfig();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const envs = config?.details || {};
  const isFullyConfigured = config?.status === 'Fully Configured 🚀';
  const isAutonomous = config?.status === 'Autonomous Mode Active ⚡';
  const isMissing = !isFullyConfigured && !isAutonomous;

  return (
    <div className="min-h-screen bg-[#050508] text-white p-6 md:p-12 selection:bg-blue-500/30">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 mb-2"
            >
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-black shadow-[0_0_15px_rgba(37,99,235,0.4)]">Z</div>
              <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Zynqio Diagnostics</span>
            </motion.div>
            <h1 className="text-4xl font-black tracking-tight">System Configuration</h1>
          </div>
          
          <div className={`px-6 py-3 rounded-2xl border flex items-center gap-3 font-bold ${
            isFullyConfigured ? 'bg-green-500/10 border-green-500/20 text-green-400' : 
            isAutonomous ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 
            'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            {isFullyConfigured ? <CheckCircle2 size={20} /> : isAutonomous ? <Zap size={20} /> : <AlertTriangle size={20} />}
            {config?.status}
          </div>
        </div>

        {/* Info Box */}
        {isMissing && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 bg-gradient-to-br from-amber-600 to-orange-700 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden"
          >
            <div className="relative z-10">
              <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
                <Terminal size={28} /> ACTION REQUIRED: RESOLVE SERVER ERRORS
              </h2>
              <p className="text-amber-100 font-medium mb-6 leading-relaxed max-w-2xl">
                The platform is currently running in "Lazarus Emergency Mode". To enable full production features and resolve 500 errors, you must set the following environment variables in your Vercel Dashboard.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="inline-block">
                  <Button className="bg-white text-orange-700 hover:bg-slate-100 font-bold px-8 py-6 rounded-xl">
                    Go to Vercel Dashboard <ExternalLink className="ml-2" size={18} />
                  </Button>
                </a>
              </div>
            </div>
            <Terminal className="absolute bottom-[-20px] right-[-20px] opacity-10 rotate-12" size={240} />
          </motion.div>
        )}

        {isAutonomous && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden"
          >
            <div className="relative z-10">
              <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
                <Zap size={28} /> AUTONOMOUS MODE ACTIVE
              </h2>
              <p className="text-blue-100 font-medium mb-6 leading-relaxed max-w-2xl">
                Zynqio is running in 100% Autonomous Zero-Config Mode! It is using public cloud fallbacks for Database and Real-time functionality. No manual Vercel KV or Pusher configuration is required.
              </p>
            </div>
            <Shield className="absolute bottom-[-20px] right-[-20px] opacity-10 rotate-12" size={240} />
          </motion.div>
        )}

        {/* Env Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {Object.entries(envs).map(([key, status]: [string, any], i) => {
            const isSet = status.includes('SET');
            const isAuto = status.includes('AUTONOMOUS');
            
            return (
            <motion.div 
              key={key}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-slate-900/50 border rounded-3xl p-6 flex items-center justify-between group transition-all ${isAuto ? 'border-blue-500/30' : 'border-white/5 hover:border-blue-500/30'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  isSet ? 'bg-green-500/10 text-green-400' : 
                  isAuto ? 'bg-blue-500/10 text-blue-400' : 
                  'bg-red-500/10 text-red-400'
                }`}>
                  {key.includes('KV') ? <Database size={22} /> : 
                   key.includes('BLOB') ? <Globe size={22} /> : 
                   key.includes('AUTH') ? <Lock size={22} /> : <Zap size={22} />}
                </div>
                <div>
                  <div className="text-xs font-black text-slate-500 uppercase tracking-widest">{key}</div>
                  <div className={`font-bold ${isSet ? 'text-white' : isAuto ? 'text-blue-300' : 'text-red-400 animate-pulse'}`}>{status}</div>
                </div>
              </div>
              {!isSet && !isAuto && (
                <div className="text-[10px] font-black bg-red-500/20 text-red-400 px-3 py-1 rounded-full border border-red-500/20">REQUIRED</div>
              )}
            </motion.div>
          )})}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col md:flex-row gap-4 justify-center border-t border-white/5 pt-12">
          <Link href="/auth/signin">
            <Button variant="ghost" className="text-slate-400 hover:text-white font-bold py-6 px-8 rounded-2xl">
              Back to Login
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="text-slate-400 hover:text-white font-bold py-6 px-8 rounded-2xl">
              Main Menu
            </Button>
          </Link>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-12 rounded-2xl shadow-lg shadow-blue-900/20" onClick={() => window.location.reload()}>
            Refresh Status
          </Button>
        </div>

      </div>
    </div>
  );
}
