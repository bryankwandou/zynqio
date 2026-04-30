"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function SignIn() {
  const [username, setUsername] = useState("admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="w-16 h-16 bg-blue-600 rounded-xl mx-auto flex items-center justify-center font-bold text-3xl text-white mb-6">
            Z
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Host Login</h1>
          <p className="text-slate-400 mb-8">Sign in to manage and host your quizzes</p>
          
          <Button 
            className="w-full py-6 text-lg bg-white text-slate-900 hover:bg-slate-200 mb-4"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-900 text-slate-400">Or use Developer Fallback</span>
            </div>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              signIn("credentials", { username, password: "any", callbackUrl: "/dashboard" });
            }}
            className="space-y-4"
          >
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username (admin)" 
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl py-3 px-4 focus:border-blue-500 outline-none"
            />
            <Button type="submit" className="w-full py-6 text-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
              Developer Login (Zero Config)
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
