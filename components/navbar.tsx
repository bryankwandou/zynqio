"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-border bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
            Z
          </div>
          <span className="text-xl font-black uppercase tracking-tighter text-foreground">
            Zynqio
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/explore" className="text-sm font-black uppercase tracking-widest text-muted-foreground hover:text-blue-500 transition-colors">Explore</Link>
          <Link href="/dashboard" className="text-sm font-black uppercase tracking-widest text-muted-foreground hover:text-blue-500 transition-colors">
            Dashboard
          </Link>
        </nav>

        <nav className="flex items-center gap-4">
          {session ? (
            <div className="flex items-center gap-4">
              <div className="hidden lg:flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Authenticated</span>
                <span className="text-sm font-bold text-foreground truncate max-w-[150px]">
                  {session.user?.name || session.user?.email}
                </span>
              </div>
              <Link href="/dashboard">
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground">Dashboard</Button>
              </Link>
              <Button
                variant="outline"
                className="border-border text-muted-foreground hover:bg-accent"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <Link href="/auth/signin">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                Host Login
              </Button>
            </Link>
          )}
          <div className="pl-2 border-l border-border">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
