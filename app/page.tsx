"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowRight, Zap, Shield, Compass, Sun, Moon } from "lucide-react";

function LogoMark() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 9,
        background: "conic-gradient(from 0deg, var(--p), var(--p2), var(--acc), var(--p))",
        boxShadow: "0 4px 16px rgba(124,111,253,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 800,
        fontSize: 18,
        flexShrink: 0,
      }}
    >
      Z
    </div>
  );
}

const MODES = [
  { icon: "⚡", label: "Classic",    desc: "Points for speed & accuracy" },
  { icon: "🚀", label: "Speed",      desc: "Fastest answer wins all" },
  { icon: "💰", label: "Gold Hunt",  desc: "Grab treasure chests" },
  { icon: "⚔️", label: "Battle",     desc: "Last player standing" },
  { icon: "🤝", label: "Team Play",  desc: "Collaborate to win" },
  { icon: "💀", label: "Survival",   desc: "One wrong = eliminated" },
];

const FEATURES = [
  { icon: <Zap size={20} />,    title: "Real-time Play",       desc: "Sub-second answer sync across hundreds of players." },
  { icon: <Shield size={20} />, title: "Scored Insights",      desc: "Accuracy, speed, and class-level breakdowns live." },
  { icon: <Compass size={20} />,title: "6 Game Modes",         desc: "From casual fun to competitive elimination rounds." },
];

export default function Home() {
  const [roomCode, setRoomCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) return;

    setJoinError("");
    setIsJoining(true);

    try {
      const res = await fetch(`/api/room/state?roomCode=${code}`);
      if (res.status === 404) { setJoinError("Ruangan tidak ditemukan. Periksa kodenya."); setIsJoining(false); return; }
      if (!res.ok)             { setJoinError("Gagal memeriksa status ruangan."); setIsJoining(false); return; }
      const data = await res.json();
      if (data.status === "ended")   { setJoinError("Permainan ini sudah berakhir."); setIsJoining(false); return; }
      if (data.status === "playing") { setJoinError("Permainan sudah dimulai."); setIsJoining(false); return; }
      router.push(`/join/${code}`);
    } catch {
      setJoinError("Sambungan bermasalah. Coba lagi.");
      setIsJoining(false);
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflowX: "hidden" }}>
      {/* Ambient background */}
      <div className="ambient" />

      {/* Top nav */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          padding: "14px 24px",
          background: "var(--nav-bg)",
          WebkitBackdropFilter: "blur(20px)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-raw)",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LogoMark />
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--t1)" }}>zynqio</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="zy-btn zy-btn-secondary"
              style={{ padding: "8px 10px" }}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link href="/auth/signin" className="zy-btn zy-btn-secondary" style={{ textDecoration: "none", fontSize: 14 }}>
              Sign in
            </Link>
            <Link href="/auth/signup" className="zy-btn zy-btn-primary" style={{ textDecoration: "none", fontSize: 14 }}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px 60px", textAlign: "center", position: "relative", zIndex: 2 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: 99,
            border: "1px solid var(--border-a)",
            background: "var(--card-raw)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--t2)",
            marginBottom: 32,
            animation: "fadeUp 0.5s ease both",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse 1.5s infinite" }} />
          Live multiplayer quiz platform
        </div>

        <h1
          style={{
            fontSize: "clamp(48px, 8vw, 90px)",
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: "-0.04em",
            animation: "fadeUp 0.6s ease both",
            color: "var(--t1)",
          }}
        >
          Think Fast.{" "}
          <br />
          Play Smart.{" "}
          <br />
          <span
            className=""
            style={{
              fontStyle: "italic",
              fontFamily: "Georgia, serif",
              fontWeight: 400,
              fontSize: "1.1em",
            }}
          >
            Quiz Harder.
          </span>
        </h1>

        <p
          style={{
            fontSize: 18,
            color: "var(--t2)",
            marginTop: 28,
            maxWidth: 600,
            marginInline: "auto",
            lineHeight: 1.55,
            animation: "fadeUp 0.7s ease both",
          }}
        >
          Host live quiz battles for your class, team, or audience — with
          real-time leaderboards, 6 game modes, and zero setup.
        </p>

        {/* Join code input */}
        <form
          onSubmit={handleJoin}
          style={{
            marginTop: 48,
            display: "flex",
            gap: 8,
            maxWidth: 460,
            marginInline: "auto",
            padding: 8,
            background: "var(--card-raw)",
            WebkitBackdropFilter: "blur(20px)",
            backdropFilter: "blur(20px)",
            border: "1px solid var(--border-raw)",
            borderRadius: 16,
            boxShadow: "var(--shadow)",
            animation: "fadeUp 0.8s ease both",
          }}
        >
          <input
            value={roomCode}
            onChange={(e) => { setRoomCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()); setJoinError(""); }}
            placeholder="GAME CODE"
            maxLength={6}
            autoCapitalize="characters"
            style={{
              flex: 1,
              padding: "14px 18px",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.2em",
              background: "transparent",
              border: "none",
              color: "var(--t1)",
              fontFamily: "var(--font-space-mono)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={roomCode.length !== 6 || isJoining}
            className="zy-btn zy-btn-primary"
            style={{ padding: "0 22px", fontSize: 15, borderRadius: 10, opacity: roomCode.length !== 6 ? 0.5 : 1 }}
          >
            {isJoining ? "…" : <>Join <ArrowRight size={16} /></>}
          </button>
        </form>

        {joinError && (
          <p style={{ color: "var(--red)", fontSize: 13, fontWeight: 600, marginTop: 12, animation: "fadeUp 0.2s ease both" }}>
            {joinError}
          </p>
        )}

        <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 14, animation: "fadeUp 0.9s ease both" }}>
          No account needed to join ·{" "}
          <Link href="/auth/signup" style={{ color: "var(--p2)", fontWeight: 600, textDecoration: "underline" }}>
            Host a quiz for free
          </Link>
        </div>
      </section>

      {/* Game modes */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px", position: "relative", zIndex: 2 }}>
        <div style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, textAlign: "center", marginBottom: 24 }}>
          6 GAME MODES
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {MODES.map((m, i) => (
            <div
              key={m.label}
              className="zy-panel-interactive"
              style={{
                padding: 18,
                textAlign: "center",
                animation: `fadeUp 0.4s ease ${0.3 + i * 0.05}s both`,
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 10 }}>{m.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{m.label}</div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px", position: "relative", zIndex: 2 }}>
        <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-0.03em", maxWidth: 600, lineHeight: 1.1, color: "var(--t1)" }}>
          Everything you need to{" "}
          <span className="">run better quizzes</span>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 40 }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="zy-panel-interactive" style={{ padding: 24 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 11,
                  background: "var(--bg2-raw)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--p2)",
                  marginBottom: 16,
                }}
              >
                {f.icon}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "var(--t3)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section
        style={{
          maxWidth: 880,
          margin: "0 auto 80px",
          padding: "48px 32px",
          borderRadius: 24,
          background: "linear-gradient(135deg, var(--bg2-raw), var(--bg3-raw))",
          border: "1px solid var(--border-a)",
          textAlign: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h3 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, letterSpacing: "-0.025em", color: "var(--t1)" }}>
          Ready to host your first quiz?
        </h3>
        <p style={{ color: "var(--t3)", marginTop: 14, fontSize: 15, maxWidth: 480, marginInline: "auto" }}>
          Free forever for educators. No credit card required.
        </p>
        <Link
          href="/auth/signup"
          className="zy-btn zy-btn-primary"
          style={{ display: "inline-flex", marginTop: 28, padding: "14px 26px", fontSize: 15, textDecoration: "none" }}
        >
          Create free account <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "30px 24px",
          borderTop: "1px solid var(--border-raw)",
          textAlign: "center",
          color: "var(--t3)",
          fontSize: 12,
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LogoMark />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t2)" }}>zynqio</span>
        </div>
        <div>© 2026 Zynqio · Think Fast. Play Smart. Quiz Harder.</div>
        <div style={{ display: "flex", gap: 16 }}>
          <Link href="/explore" style={{ color: "var(--t3)", textDecoration: "none" }}>Explore</Link>
          <Link href="/auth/signin" style={{ color: "var(--t3)", textDecoration: "none" }}>Sign in</Link>
          <Link href="/auth/signup" style={{ color: "var(--t3)", textDecoration: "none" }}>Sign up</Link>
        </div>
      </footer>
    </div>
  );
}
