"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Zap, ArrowRight, User, Mail, Lock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      router.push("/auth/signin?registered=true");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-4 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="fixed top-6 right-6 z-[100]">
        <ThemeToggle />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[480px] space-y-6 relative z-10"
      >
        <div className="bg-card backdrop-blur-3xl border border-border rounded-[2.5rem] p-10 md:p-12 shadow-[0_30px_100px_rgba(0,0,0,0.3)]">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-6">
              <Zap className="text-white fill-white" size={32} />
            </div>
            <h1 className="text-3xl font-black text-foreground tracking-tight mb-2 uppercase">Create Account</h1>
            <p className="text-muted-foreground font-medium">Join Zynqio and start hosting quizzes</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs font-bold text-red-500 uppercase tracking-wider text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address" 
                className="w-full bg-background border border-border text-foreground rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500 outline-none transition-all font-medium"
              />
            </div>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username" 
                className="w-full bg-background border border-border text-foreground rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500 outline-none transition-all font-medium"
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min. 6 characters)" 
                className="w-full bg-background border border-border text-foreground rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500 outline-none transition-all font-medium"
              />
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-7 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-blue-900/20 uppercase tracking-widest mt-4"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : <>REGISTER NOW <ArrowRight size={18} className="ml-2" /></>}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground font-medium">
              Already have an account?{" "}
              <Link href="/auth/signin" className="text-blue-500 hover:underline font-bold">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
