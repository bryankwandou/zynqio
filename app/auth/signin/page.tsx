"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Shield, ArrowRight, Zap, Trophy, Layout } from "lucide-react";
import { motion } from "framer-motion";

export default function SignIn() {
  const [username, setUsername] = useState("admin");
  const [isLazarusMode, setIsLazarusMode] = useState(false);

  const hasGoogleConfig = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && 
                         process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID !== 'your_google_client_id';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050508] p-4 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="fixed top-6 right-6 z-[100]">
        <ThemeToggle />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-[480px] p-1 space-y-6 relative z-10"
      >
        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-10 md:p-12 shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
          <div className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)] mb-8"
            >
              <Zap className="text-white fill-white" size={40} />
            </motion.div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">Zynqio Admin</h1>
            <p className="text-slate-400 font-medium tracking-wide">Enter the platform control center</p>
          </div>

          <div className="space-y-4">
            <Button 
              className={`w-full py-8 text-lg font-bold transition-all rounded-2xl flex items-center justify-center gap-3 shadow-xl ${
                hasGoogleConfig ? "bg-white text-black hover:bg-slate-200" : "bg-slate-800 text-slate-500 hover:bg-slate-700"
              }`}
              onClick={() => {
                if (hasGoogleConfig) {
                  signIn("google", { callbackUrl: "/dashboard" });
                } else {
                  // EMERGENCY REDIRECT TO SETUP
                  window.location.href = "/setup";
                }
              }}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" opacity="0.8"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor" opacity="0.6"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" opacity="0.8"/>
              </svg>
              <span>{hasGoogleConfig ? "Continue with Google" : "Setup Google Login"}</span>
            </Button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-[0.3em] font-black">
                <span className="px-4 bg-[#0a0a14] text-slate-600">Secure Access</span>
              </div>
            </div>

            {!isLazarusMode ? (
              <Button 
                variant="outline" 
                className="w-full py-6 border-white/5 bg-white/5 text-slate-300 hover:bg-white/10 rounded-2xl transition-all"
                onClick={() => setIsLazarusMode(true)}
              >
                Enterprise Admin Bypass
              </Button>
            ) : (
              <motion.form 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  signIn("credentials", { username, password: "any", callbackUrl: "/dashboard" });
                }}
                className="space-y-4"
              >
                <div className="relative group">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Admin Username" 
                    className="w-full bg-slate-950/50 border border-white/5 text-white rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500 outline-none transition-all placeholder:text-slate-700"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-900/20">
                  Access Dashboard <ArrowRight size={18} className="ml-2" />
                </Button>
                <button 
                  type="button" 
                  onClick={() => setIsLazarusMode(false)}
                  className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors font-bold uppercase tracking-widest"
                >
                  Cancel Bypass
                </button>
              </motion.form>
            )}
          </div>
        </div>

        {/* Dynamic Proof of Excellence Footer */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-900/30 backdrop-blur-md border border-white/5 p-4 rounded-3xl text-center">
            <Trophy className="text-yellow-500/50 mx-auto mb-1" size={16} />
            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Global</div>
          </div>
          <div className="bg-slate-900/30 backdrop-blur-md border border-white/5 p-4 rounded-3xl text-center">
            <Layout className="text-blue-500/50 mx-auto mb-1" size={16} />
            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Premium</div>
          </div>
          <div className="bg-slate-900/30 backdrop-blur-md border border-white/5 p-4 rounded-3xl text-center">
            <Shield className="text-green-500/50 mx-auto mb-1" size={16} />
            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Secure</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
