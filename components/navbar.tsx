"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
            Z
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Zynqio
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/explore" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Explore</Link>
          {session && <Link href="/history" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">My Journey</Link>}
        </nav>

        <nav className="flex items-center gap-4">
          {session ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" className="text-slate-300 hover:text-white">Dashboard</Button>
              </Link>
              <Button 
                variant="outline" 
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign Out
              </Button>
            </>
          ) : (
            <Link href="/api/auth/signin">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                Host Login
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
