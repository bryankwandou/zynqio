"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import {
  LayoutDashboard,
  Plus,
  Compass,
  Clock,
  BarChart2,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/create",    icon: Plus,            label: "Create"    },
  { href: "/explore",   icon: Compass,         label: "Explore"   },
  { href: "/history",   icon: Clock,           label: "History"   },
  { href: "/analytics", icon: BarChart2,        label: "Analytics" },
  { href: "/settings",  icon: Settings,         label: "Settings"  },
];

function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: "conic-gradient(from 0deg, var(--p), var(--p2), var(--acc), var(--p))",
        boxShadow: "0 4px 16px rgba(124,111,253,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 800,
        fontSize: size * 0.55,
        flexShrink: 0,
        fontFamily: "var(--font-space-grotesk)",
      }}
    >
      Z
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const Sidebar = (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        padding: "20px 12px",
        borderRight: "1px solid var(--border-raw)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: "var(--bg-raw)",
      }}
    >
      <Link
        href="/dashboard"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "4px 8px 20px",
          textDecoration: "none",
        }}
      >
        <LogoMark size={32} />
        <span
          style={{
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--t1)",
          }}
        >
          zynqio
        </span>
      </Link>

      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              color: active ? "var(--t1)" : "var(--t2)",
              background: active ? "var(--bg2-raw)" : "transparent",
              textDecoration: "none",
              transition: "color 0.15s, background-color 0.15s, border-color 0.15s, opacity 0.15s",
              border: active ? "1px solid var(--border-raw)" : "1px solid transparent",
            }}
          >
            <item.icon size={17} strokeWidth={active ? 2.2 : 1.8} />
            {item.label}
          </Link>
        );
      })}

      <div style={{ marginTop: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {session && (
          <div
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--bg2-raw)",
              border: "1px solid var(--border-raw)",
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session.user?.name || "Host"}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
              {session.user?.email}
            </div>
          </div>
        )}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="zy-btn zy-btn-secondary"
          style={{ flex: 1, padding: "8px", fontSize: 12, justifyContent: "center" }}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="zy-btn zy-btn-secondary"
          style={{ padding: "8px 10px", color: "var(--red)" }}
          title="Sign out"
        >
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );

  return (
    <div style={{ position: "relative", zIndex: 2, minHeight: "100vh", display: "flex" }}>
      {/* Desktop sidebar */}
      <div className="hidden md:flex" style={{ position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        {Sidebar}
      </div>

      {/* Mobile top bar */}
      <div
        className="md:hidden"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "12px 16px",
          background: "var(--nav-bg)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-raw)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <LogoMark size={28} />
          <span style={{ fontSize: 16, fontWeight: 800, color: "var(--t1)" }}>zynqio</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ color: "var(--t1)", padding: 4 }}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,0.5)",
          }}
          onClick={() => setMobileOpen(false)}
        >
          <div
            style={{ width: 260, height: "100%", background: "var(--bg-raw)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {Sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <main
        style={{
          flex: 1,
          padding: "28px 32px",
          maxWidth: "100%",
          overflow: "hidden",
        }}
        className="md:pt-7 pt-20"
      >
        {children}
      </main>
    </div>
  );
}
