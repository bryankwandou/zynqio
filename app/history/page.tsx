"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import Link from "next/link";
import {
  History, TrendingUp, Star, Search, PlayCircle, Award, Shield,
  Zap, BarChart2, Users, Trophy, Target, Loader2,
} from "lucide-react";

const BADGES = [
  { name: "First Flight",    icon: <PlayCircle size={16}/>, unlock: (h: any[]) => h.length >= 1,                            color: "var(--p)"      },
  { name: "Accuracy 95%",   icon: <Star size={16}/>,        unlock: (h: any[]) => h.some((x) => x.accuracy >= 95),          color: "var(--green)"  },
  { name: "Marathoner",     icon: <History size={16}/>,     unlock: (h: any[]) => h.length >= 5,                            color: "var(--p2)"     },
  { name: "Top 3",          icon: <Award size={16}/>,       unlock: (h: any[]) => h.some((x) => x.rank <= 3),               color: "var(--gold)"   },
  { name: "Survivor",       icon: <Shield size={16}/>,      unlock: (_: any[]) => false,                                    color: "var(--red)"    },
  { name: "Speed Demon",    icon: <Zap size={16}/>,         unlock: (h: any[]) => h.length >= 3,                            color: "var(--acc)"    },
];

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="zy-card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color }}>{value}</div>
    </div>
  );
}

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"player" | "host">("player");
  const [playerHistory, setPlayerHistory] = useState<any[]>([]);
  const [hostedQuizzes, setHostedQuizzes] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/player/history").then(r => (r.ok ? r.json() : { sessions: [] })),
      fetch("/api/quiz/recommend").then(r => (r.ok ? r.json() : { quizzes: [] })),
      fetch("/api/quiz/list").then(r => (r.ok ? r.json() : { quizzes: [] })),
    ]).then(([hist, rec, quizzes]) => {
      // Riwayat kini berupa catatan sesi milik pengguna ini saja —
      // penyaringannya terjadi di query, bukan setelah data terbaca.
      setPlayerHistory(hist.sessions ?? []);
      setRecommendations(rec.quizzes ?? []);
      setHostedQuizzes(quizzes.quizzes ?? []);
    }).finally(() => setLoading(false));
  }, [status]);

  const avgAcc = playerHistory.length
    ? Math.round(playerHistory.reduce((s, h) => s + (h.accuracy || 0), 0) / playerHistory.length) : 0;
  const bestRank = playerHistory.length ? Math.min(...playerHistory.map(h => h.rank || 999)) : 0;

  if (status === "loading" || loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={32} className="animate-spin" style={{ color: "var(--p)" }}/></div>;
  }

  return (
    <AppShell>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--t1)" }}>History</h1>
        <p style={{ fontSize: 14, color: "var(--t3)", marginTop: 4 }}>Track your stats and find new challenges</p>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-raw)", marginBottom: 24 }}>
        {([["player", <Trophy size={14}/>, "Player History"], ["host", <Users size={14}/>, "Hosted Quizzes"]] as const).map(([k, icon, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", fontSize: 14, fontWeight: 600,
            color: tab === k ? "var(--t1)" : "var(--t3)",
            borderBottom: tab === k ? "2px solid var(--p)" : "2px solid transparent",
            marginBottom: -1, background: "none", border: "none", borderBottomWidth: 2,
            borderBottomStyle: "solid", borderBottomColor: tab === k ? "var(--p)" : "transparent",
            cursor: "pointer",
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }} className="history-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {tab === "player" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                <StatCard label="Quizzes Played" value={playerHistory.length} color="var(--p)" />
                <StatCard label="Avg Accuracy" value={`${avgAcc}%`} color="var(--green)" />
                <StatCard label="Best Rank" value={bestRank ? `#${bestRank}` : "—"} color="var(--gold)" />
              </div>

              {playerHistory.length > 0 && (
                <div className="zy-card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t2)", display: "flex", alignItems: "center", gap: 6 }}>
                      <BarChart2 size={14} style={{ color: "var(--p)" }}/> Accuracy Trend
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: avgAcc >= 80 ? "var(--green)" : avgAcc >= 50 ? "var(--gold)" : "var(--red)" }}>
                      {avgAcc}% avg
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
                    {playerHistory.slice(-15).map((h, i) => {
                      const pct = Math.max(6, Math.round((h.accuracy / 100) * 80));
                      const color = h.accuracy >= 80 ? "var(--green)" : h.accuracy >= 50 ? "var(--gold)" : "var(--red)";
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-end", height: "100%" }}>
                          <div title={`${h.accuracy}%`} style={{ width: "100%", height: `${pct}px`, borderRadius: 4, background: color, transition: "height 0.3s" }}/>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--t4)", marginTop: 8, textAlign: "right" }}>
                    Last {Math.min(15, playerHistory.length)} sessions
                  </div>
                </div>
              )}

              {/* Badges */}
              <div className="zy-card" style={{ padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t2)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <Award size={14} style={{ color: "var(--gold)" }}/> Badges
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8 }}>
                  {BADGES.map((b, i) => {
                    const unlocked = b.unlock(playerHistory);
                    return (
                      <div key={i} title={b.name} style={{
                        display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 4px",
                        borderRadius: 10, border: "1px solid var(--border-raw)",
                        background: unlocked ? "var(--bg2-raw)" : "transparent",
                        opacity: unlocked ? 1 : 0.3, filter: unlocked ? "none" : "grayscale(1)",
                        gap: 6,
                      }}>
                        <div style={{ color: unlocked ? b.color : "var(--t4)" }}>{b.icon}</div>
                        <span style={{ fontSize: 9, fontWeight: 600, color: "var(--t3)", textAlign: "center", lineHeight: 1.2 }}>{b.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* History list */}
              <div className="zy-card" style={{ overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-raw)", display: "flex", alignItems: "center", gap: 8 }}>
                  <History size={14} style={{ color: "var(--p)" }}/>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>Recent Games</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--t3)" }}>{playerHistory.length} sessions</span>
                </div>
                {playerHistory.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--t3)", fontSize: 13 }}>
                    <PlayCircle size={28} style={{ marginInline: "auto", marginBottom: 10, opacity: 0.3 }}/>
                    No games played yet. Join a quiz to get started!
                  </div>
                ) : (
                  playerHistory.map((h, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i < playerHistory.length - 1 ? "1px solid var(--border-raw)" : "none" }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0,
                        background: h.rank === 1 ? "var(--gold)" : h.rank === 2 ? "#a0aec0" : h.rank === 3 ? "#cd7f32" : "var(--bg2-raw)",
                        color: h.rank <= 3 ? "#000" : "var(--t3)",
                      }}>
                        #{h.rank || "—"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title || "Quiz Session"}</div>
                        <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
                          {new Date(h.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          {h.totalPlayers ? ` · ${h.totalPlayers} players` : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: h.accuracy >= 80 ? "var(--green)" : h.accuracy >= 50 ? "var(--gold)" : "var(--red)" }}>
                          {h.accuracy || 0}%
                        </div>
                        <div style={{ fontSize: 11, color: "var(--t3)" }}>{(h.score || 0).toLocaleString()} pts</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {tab === "host" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                <StatCard label="Quizzes" value={hostedQuizzes.length} color="var(--p)" />
                <StatCard label="Questions" value={hostedQuizzes.reduce((s, q) => s + (q.questions?.length || 0), 0)} color="var(--p2)" />
                <StatCard label="Sessions" value="—" color="var(--green)" />
              </div>

              <div className="zy-card" style={{ overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-raw)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Target size={14} style={{ color: "var(--p)" }}/>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>Your Quiz Library</span>
                </div>
                {hostedQuizzes.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--t3)", fontSize: 13 }}>
                    <Trophy size={28} style={{ marginInline: "auto", marginBottom: 10, opacity: 0.3 }}/>
                    No quizzes created yet.{" "}
                    <Link href="/create" style={{ color: "var(--p2)", fontWeight: 600, textDecoration: "none" }}>Create your first</Link>
                  </div>
                ) : (
                  hostedQuizzes.map((q, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i < hostedQuizzes.length - 1 ? "1px solid var(--border-raw)" : "none" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--bg2-raw)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--p)", flexShrink: 0 }}>
                        {q.questions?.length || 0}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.title || "Untitled"}</div>
                        <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{q.questions?.length || 0} questions</div>
                      </div>
                      <Link href={`/create?quizId=${q.id}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--p2)", textDecoration: "none" }}>Edit</Link>
                    </div>
                  ))
                )}
              </div>

              <div className="zy-card" style={{ padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t2)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <TrendingUp size={14} style={{ color: "var(--gold)" }}/> Host Tips
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {["Use Battle Royale mode for max excitement.", "15s timer for speed, 45s for harder questions.", "Shuffle Questions to prevent answer sharing.", "Check Analytics after each session for insights."].map((tip, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 13, color: "var(--t3)" }}>
                      <span style={{ color: "var(--p)", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                      {tip}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar: recommendations */}
        <div>
          <div className="zy-card" style={{ padding: 18, position: "sticky", top: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t2)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <Star size={13} style={{ color: "var(--gold)" }}/> Recommended
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recommendations.slice(0, 6).map((rec, i) => (
                <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg2-raw)", border: "1px solid var(--border-raw)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.title}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 3, display: "flex", justifyContent: "space-between" }}>
                    <span>by {rec.author}</span>
                    <span>{(rec.plays || 0).toLocaleString()} plays</span>
                  </div>
                </div>
              ))}
              {recommendations.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--t3)", fontSize: 12, padding: "24px 0" }}>
                  <Search size={20} style={{ marginInline: "auto", marginBottom: 8, opacity: 0.4 }}/>
                  No recommendations yet
                </div>
              )}
            </div>
            <Link href="/explore" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-raw)", fontSize: 13, color: "var(--t3)", textDecoration: "none" }}>
              <Search size={13}/> Explore all quizzes
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
