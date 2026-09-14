"use client";

import { useBahasa } from "@/lib/bahasa";
/**
 * components/navbar.tsx — bilah navigasi utama.
 *
 * Tiga hal yang diperbaiki dari versi sebelumnya:
 *
 * 1. Tanda ZYNQIO tidak lagi digambar ulang di sini. Sebelumnya
 *    huruf Z di atas conic-gradient ditulis lagi di berkas ini dan di
 *    empat halaman autentikasi — lima salinan yang harus diubah
 *    bersamaan setiap kali tandanya bergeser sedikit.
 *
 * 2. Halaman yang sedang dibuka ditandai. Sebelumnya semua tautan
 *    tampak sama, jadi tidak ada cara mengetahui posisi kita selain
 *    membaca alamat di bilah peramban.
 *
 * 3. Di layar sempit, tautan teks disembunyikan dan digantikan ikon.
 *    Sebelumnya lima tautan berjejalan sampai keluar layar ponsel —
 *    dan ponsel justru perangkat yang dipakai peserta.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Sun, Moon, LogOut, Compass, LayoutGrid, History } from "lucide-react";
import { Logo } from "./Logo";

const TAUTAN = [
  { href: "/explore", label: ["Jelajahi", "Explore"] as [string, string], Icon: Compass, perluMasuk: false },
  { href: "/dashboard", label: ["Kuis saya", "My quizzes"] as [string, string], Icon: LayoutGrid, perluMasuk: true },
  // Dulu tertulis "Analytics" padahal isinya riwayat permainan.
  { href: "/history", label: ["Riwayat", "History"] as [string, string], Icon: History, perluMasuk: true },
];

export function Navbar() {
  const { tt } = useBahasa();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "var(--sp-3) var(--sp-5)",
        background: "var(--nav-bg)",
        // Buram di sini punya alasan: isi halaman menggulung di
        // belakangnya, dan tanpa buram teksnya saling menembus.
        WebkitBackdropFilter: "blur(20px)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border-raw)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--sp-3)",
      }}
    >
      <Link href="/" className="zy-row" style={{ gap: "var(--sp-2)" }} aria-label={tt("ZYNQIO, ke beranda", "ZYNQIO, go home")}>
        <Logo size={28} />
        <span
          style={{
            fontSize: "var(--fs-base)",
            fontWeight: "var(--fw-bold)",
            letterSpacing: "0.03em",
            color: "var(--t1)",
          }}
        >
          ZYNQIO
        </span>
      </Link>

      <nav className="zy-row" style={{ gap: "var(--sp-1)" }}>
        {TAUTAN.filter((t) => !t.perluMasuk || session).map(({ href, label, Icon }) => {
          const aktif = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              // Diumumkan pembaca layar sebagai halaman saat ini,
              // bukan sekadar diberi warna berbeda.
              aria-current={aktif ? "page" : undefined}
              className="zy-motion"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                fontSize: "var(--fs-sm)",
                fontWeight: aktif ? "var(--fw-medium)" : "var(--fw-normal)",
                color: aktif ? "var(--t1)" : "var(--t3)",
                padding: "var(--sp-2) var(--sp-3)",
                borderRadius: "var(--r-md)",
                background: aktif ? "var(--bg3-raw)" : "transparent",
              }}
            >
              <Icon size={15} aria-hidden="true" />
              <span className="hidden sm:inline">{tt(...label)}</span>
            </Link>
          );
        })}

        {session ? (
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="zy-btn zy-btn-quiet"
            style={{ padding: "var(--sp-2)" }}
            aria-label={tt("Keluar dari akun", "Sign out")}
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        ) : (
          <>
            <Link href="/auth/signin" className="zy-btn zy-btn-quiet">
              {tt("Masuk", "Sign in")}
            </Link>
            <Link href="/auth/signup" className="zy-btn zy-btn-primary">
              {tt("Mulai", "Start")}
            </Link>
          </>
        )}

        <button
          className="zy-btn zy-btn-quiet"
          style={{ padding: "var(--sp-2)" }}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? tt("Beralih ke tampilan terang", "Switch to light theme") : tt("Beralih ke tampilan gelap", "Switch to dark theme")}
        >
          {theme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
        </button>
      </nav>
    </header>
  );
}
