"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Zap, ArrowRight, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function SignInContent() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const registered = searchParams.get("registered");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [localError, setLocalError] = useState("");

  const error = localError || urlError;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setLocalError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setLocalError(result.error === "CredentialsSignin" ? "CredentialsSignin" : result.error);
      setIsAuthenticating(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-4 relative overflow-hidden">
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
        <div className="bg-card backdrop-blur-3xl border border-border rounded-[2.5rem] p-10 md:p-12 shadow-[0_30px_100px_rgba(0,0,0,0.3)]">
          <div className="text-center mb-10">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-xl mb-8"
            >
              <Zap className="text-white fill-white" size={40} />
            </motion.div>
            <h1 className="text-3xl font-black text-foreground tracking-tight mb-2 uppercase">Sign In</h1>
            <p className="text-muted-foreground font-medium tracking-wide">Access your host dashboard</p>
          </div>

          {registered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-center"
            >
              <div className="text-xs font-bold text-green-500 uppercase tracking-wider">
                Account created! Sign in below.
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3"
            >
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <div className="text-xs font-bold text-red-500 uppercase tracking-wider">
                {error === "CredentialsSignin"
                  ? "Invalid email or password. Please try again."
                  : "Authentication failed. Please try again."}
              </div>
            </motion.div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4">
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
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-background border border-border text-foreground rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500 outline-none transition-all font-medium"
              />
            </div>
            <Button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-7 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-blue-900/20 uppercase tracking-widest"
            >
              {isAuthenticating ? <Loader2 className="animate-spin" /> : <>SIGN IN <ArrowRight size={18} className="ml-2" /></>}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground font-medium">
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="text-blue-500 hover:underline font-bold">
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SignInSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[480px] p-1 space-y-6 relative z-10">
        <div className="bg-card backdrop-blur-3xl border border-border rounded-[2.5rem] p-10 md:p-12 shadow-[0_30px_100px_rgba(0,0,0,0.3)]">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-xl mb-8">
              <Zap className="text-white fill-white" size={40} />
            </div>
            <h1 className="text-3xl font-black text-foreground tracking-tight mb-2 uppercase">Sign In</h1>
            <p className="text-muted-foreground font-medium tracking-wide">Access your host dashboard</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <div className="w-full bg-background border border-border rounded-2xl py-4 pl-12 pr-4 animate-pulse">
                <div className="h-5 bg-muted rounded-lg w-2/3" />
              </div>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <div className="w-full bg-background border border-border rounded-2xl py-4 pl-12 pr-4 animate-pulse">
                <div className="h-5 bg-muted rounded-lg w-1/2" />
              </div>
            </div>
            <div className="w-full py-7 bg-blue-600/60 rounded-2xl animate-pulse" />
          </div>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <div className="h-4 bg-muted rounded-lg w-3/4 mx-auto animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={<SignInSkeleton />}>
      <SignInContent />
    </Suspense>
  );
}
