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
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { TombolBahasa } from "@/lib/bahasa";
import { Logo } from "./Logo";

/**
 * Menu samping.
 *
 * Butir "Settings" dibuang: app/settings/page.tsx tidak pernah ada di
 * proyek ini, sehingga tautannya selalu berujung di halaman "tidak
 * ditemukan". Menu yang menjanjikan halaman yang tidak ada lebih buruk
 * daripada menu yang lebih pendek.
 */
const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Kuis saya" },
  { href: "/create",    icon: Plus,            label: "Susun kuis" },
  { href: "/explore",   icon: Compass,         label: "Jelajahi" },
  { href: "/history",   icon: Clock,           label: "Riwayat" },
  { href: "/analytics", icon: BarChart2,       label: "Laporan" },
];

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
        <Logo size={30} />
        <span
          style={{
            fontSize: "var(--fs-lg)",
            fontWeight: "var(--fw-bold)",
            letterSpacing: "0.03em",
            color: "var(--t1)",
          }}
        >
          ZYNQIO
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
            aria-current={active ? "page" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-3)",
              padding: "var(--sp-3)",
              borderRadius: "var(--r-md)",
              fontSize: "var(--fs-sm)",
              fontWeight: active ? "var(--fw-medium)" : "var(--fw-normal)",
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
              {session.user?.name || "Pengajar"}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
              {session.user?.email}
            </div>
          </div>
        )}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="zy-btn zy-btn-secondary"
          style={{ flex: 1, padding: "var(--sp-2)", fontSize: "var(--fs-xs)", justifyContent: "center" }}
        >
          {theme === "dark" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
          {theme === "dark" ? "Terang" : "Gelap"}
        </button>
        {/* Pengalih bahasa diletakkan bersebelahan dengan pengalih tema:
            keduanya mengubah tampilan seluruh aplikasi, bukan halaman
            yang sedang dibuka, jadi tempatnya sama-sama di kaki bilah
            samping dan bukan di dalam isi halaman. */}
        <TombolBahasa className="zy-btn zy-btn-secondary" />
        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="zy-btn zy-btn-danger"
          style={{ padding: "var(--sp-2) var(--sp-3)" }}
          aria-label="Keluar dari akun"
        >
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );

  return (
    <div style={{ position: "relative", zIndex: 2, minHeight: "100vh", display: "flex" }}>
      {/* Desktop sidebar */}
      <div className="zy-bilah-samping" style={{ position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        {Sidebar}
      </div>

      {/* Mobile top bar */}
      <div
        className="zy-bilah-atas"
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
          <Logo size={26} />
          <span style={{ fontSize: "var(--fs-base)", fontWeight: "var(--fw-bold)", letterSpacing: "0.03em", color: "var(--t1)" }}>ZYNQIO</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
          style={{ color: "var(--t1)", padding: "var(--sp-1)" }}
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
      {/* overflow:hidden dibuang. Ia memotong apa pun yang melebar —
          tabel lebar dan menu yang mengembang ikut terpotong, dan
          tidak ada cara menggulungnya karena hidden juga meniadakan
          gulungan. Yang dibutuhkan hanya min-width:0 supaya anak
          flex tidak memaksa induknya melebar, dan itu sudah ada di
          .zy-isi-utama. */}
      <main className="zy-isi-utama">
        {children}
      </main>
    </div>
  );
}
