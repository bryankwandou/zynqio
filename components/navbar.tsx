"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Sun, Moon, LogOut } from "lucide-react";

export function Navbar() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "12px 24px",
        background: "var(--nav-bg)",
        WebkitBackdropFilter: "blur(20px)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border-raw)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "conic-gradient(from 0deg, var(--p), var(--p2), var(--acc), var(--p))",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 800, fontSize: 15,
          boxShadow: "0 2px 8px rgba(124,111,253,0.3)",
        }}>Z</div>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--t1)" }}>zynqio</span>
      </Link>

      <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Link href="/explore" style={{ fontSize: 13, fontWeight: 500, color: "var(--t2)", textDecoration: "none", padding: "6px 12px", borderRadius: 8, transition: "color 0.15s" }}>Explore</Link>

        {session ? (
          <>
            <Link href="/dashboard" style={{ fontSize: 13, fontWeight: 500, color: "var(--t2)", textDecoration: "none", padding: "6px 12px", borderRadius: 8 }}>Dashboard</Link>
            <Link href="/history" style={{ fontSize: 13, fontWeight: 500, color: "var(--t2)", textDecoration: "none", padding: "6px 12px", borderRadius: 8 }}>Analytics</Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="zy-btn-ghost"
              style={{ padding: "7px 10px", gap: 6, fontSize: 13 }}
              aria-label="Sign out"
            >
              <LogOut size={14} />
            </button>
          </>
        ) : (
          <>
            <Link href="/auth/signin" className="zy-btn-ghost" style={{ textDecoration: "none", fontSize: 13, padding: "7px 14px" }}>Sign in</Link>
            <Link href="/auth/signup" className="zy-btn-primary" style={{ textDecoration: "none", fontSize: 13, padding: "7px 14px" }}>Get started</Link>
          </>
        )}

        <button
          className="zy-btn-ghost"
          style={{ padding: "7px 9px", marginLeft: 4 }}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </nav>
    </header>
  );
}
