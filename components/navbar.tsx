"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
            Z
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            Zynqio
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/explore" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Explore</Link>
          {session && <Link href="/history" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">My Journey</Link>}
        </nav>

        <nav className="flex items-center gap-4">
          {session ? (
            <>
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
            </>
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
