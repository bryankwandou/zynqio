"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { History, TrendingUp, Star, Search, PlayCircle, Award, Shield, Zap, BarChart2, Users, Trophy, Target } from "lucide-react";
import Link from "next/link";

const BADGES = [
  { name: "First Flight",     icon: <PlayCircle size={18} />, color: "text-blue-400",   unlock: (h: any[]) => h.length >= 1 },
  { name: "Accuracy Master",  icon: <Star size={18} />,       color: "text-green-400",  unlock: (h: any[]) => h.some((x) => x.accuracy >= 95) },
  { name: "Marathoner",       icon: <History size={18} />,    color: "text-purple-400", unlock: (h: any[]) => h.length >= 5 },
  { name: "Top 3",            icon: <Award size={18} />,      color: "text-yellow-400", unlock: (h: any[]) => h.some((x) => x.rank <= 3) },
  { name: "The Survivor",     icon: <Shield size={18} />,     color: "text-red-400",    unlock: (_: any[]) => false },
  { name: "Speed Demon",      icon: <Zap size={18} />,        color: "text-cyan-400",   unlock: (h: any[]) => h.length >= 3 },
];

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-md">
      <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">{label}</div>
      <div className={`text-4xl font-black ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function AccBadge({ acc }: { acc: number }) {
  const cls = acc >= 90 ? "text-green-500" : acc >= 70 ? "text-amber-500" : "text-red-500";
  return <span className={`font-bold text-sm ${cls}`}>{acc}%</span>;
}

function RankBadge({ rank }: { rank: number }) {
  const colors = ["bg-yellow-500 text-yellow-950", "bg-slate-400 text-white", "bg-amber-700 text-white"];
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${colors[rank - 1] || "bg-muted text-muted-foreground"}`}>
      #{rank}
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
    async function load() {
      setLoading(true);
      try {
        const [histRes, recRes, quizRes] = await Promise.all([
          fetch("/api/player/history"),
          fetch("/api/quiz/recommend"),
          fetch("/api/quiz/list"),
        ]);
        if (histRes.ok) setPlayerHistory(await histRes.json());
        if (recRes.ok)  setRecommendations(await recRes.json());
        if (quizRes.ok) setHostedQuizzes(await quizRes.json());
      } catch {}
      setLoading(false);
    }
    if (status === "authenticated") load();
  }, [status]);

  // Player aggregates
  const avgAccuracy = playerHistory.length
    ? Math.round(playerHistory.reduce((s, h) => s + (h.accuracy || 0), 0) / playerHistory.length)
    : 0;
  const bestRank = playerHistory.length ? Math.min(...playerHistory.map((h) => h.rank || 999)) : 0;

  // Host aggregates
  const totalHosted = hostedQuizzes.length;
  const totalQuestions = hostedQuizzes.reduce((s, q) => s + (q.questions?.length || 0), 0);

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-3xl font-black mb-1">My Journey</h1>
        <p className="text-muted-foreground mb-6">Track your stats and find new challenges</p>

        {/* ── Tab switcher ─────────────────────────────────────── */}
        <div className="flex border-b border-border mb-8">
          <button
            type="button"
            onClick={() => setTab("player")}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-sm transition-colors ${tab === "player" ? "text-blue-500 border-b-2 border-blue-500" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Trophy size={15} /> Player History
          </button>
          <button
            type="button"
            onClick={() => setTab("host")}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-sm transition-colors ${tab === "host" ? "text-blue-500 border-b-2 border-blue-500" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Users size={15} /> Hosted Quizzes
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Left: Main content ───────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* ══ PLAYER TAB ══════════════════════════════════════ */}
            {tab === "player" && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <StatCard label="Quizzes Played" value={playerHistory.length} color="text-blue-500" />
                  <StatCard label="Avg Accuracy"   value={`${avgAccuracy}%`}    color="text-green-500" />
                  <StatCard label="Best Rank"      value={bestRank ? `#${bestRank}` : "—"} color="text-yellow-500" />
                </div>

                {/* Accuracy progress */}
                {playerHistory.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-md">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="font-bold flex items-center gap-2 text-sm">
                        <BarChart2 size={15} className="text-blue-500" /> Accuracy Trend
                      </h2>
                      <span className={`text-sm font-black ${avgAccuracy >= 80 ? "text-green-500" : avgAccuracy >= 50 ? "text-amber-500" : "text-red-500"}`}>
                        {avgAccuracy}% average
                      </span>
                    </div>
                    <div className="flex items-end gap-1.5 h-20">
                      {playerHistory.slice(-15).map((h, i) => {
                        const pct = Math.max(6, Math.round(h.accuracy * 0.8));
                        const barClass =
                          h.accuracy >= 80 ? "bg-green-500" :
                          h.accuracy >= 50 ? "bg-amber-500" : "bg-red-500";
                        // Map pct to nearest Tailwind h-[] class (6–80 range, step 4)
                        const hMap: Record<number, string> = {
                          6: "h-[6%]", 10: "h-[10%]", 16: "h-[16%]", 20: "h-[20%]",
                          24: "h-[24%]", 28: "h-[28%]", 32: "h-[32%]", 36: "h-[36%]",
                          40: "h-[40%]", 44: "h-[44%]", 48: "h-[48%]", 52: "h-[52%]",
                          56: "h-[56%]", 60: "h-[60%]", 64: "h-[64%]", 68: "h-[68%]",
                          72: "h-[72%]", 76: "h-[76%]", 80: "h-[80%]",
                        };
                        const rounded = Math.round(pct / 4) * 4;
                        const hClass = hMap[Math.min(80, Math.max(6, rounded))] ?? "h-[40%]";
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end">
                            <div
                              className={`w-full rounded-sm ${barClass} ${hClass}`}
                              title={`${h.title}: ${h.accuracy}%`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 text-right">Last {Math.min(15, playerHistory.length)} sessions</div>
                  </div>
                )}

                {/* Badges */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-md">
                  <h2 className="font-bold mb-4 flex items-center gap-2 text-sm">
                    <Award size={15} className="text-amber-500" /> Badges
                  </h2>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {BADGES.map((b, i) => {
                      const unlocked = b.unlock(playerHistory);
                      return (
                        <div
                          key={i}
                          title={b.name}
                          className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                            unlocked ? "bg-accent/40 border-border" : "bg-background border-border/30 opacity-30 grayscale"
                          }`}
                        >
                          <div className={`mb-1.5 p-2 rounded-lg bg-card ${b.color}`}>{b.icon}</div>
                          <span className="text-[10px] font-bold text-center text-muted-foreground leading-tight">{b.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* History list */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-md">
                  <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                    <History size={15} className="text-purple-500" />
                    <h2 className="font-bold text-sm">Recent Games</h2>
                    <span className="ml-auto text-xs text-muted-foreground">{playerHistory.length} sessions</span>
                  </div>
                  {playerHistory.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground text-sm">
                      <PlayCircle size={32} className="mx-auto mb-3 opacity-30" />
                      No games played yet. Join a quiz to get started!
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {playerHistory.map((h, i) => (
                        <div key={i} className="flex items-center gap-3 px-5 py-4 hover:bg-accent/30 transition-colors">
                          <RankBadge rank={h.rank || 99} />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-foreground truncate">{h.title || "Quiz Session"}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {new Date(h.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                              {h.totalPlayers ? ` · ${h.totalPlayers} players` : ""}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <AccBadge acc={h.accuracy || 0} />
                            <div className="text-xs text-muted-foreground">{(h.score || 0).toLocaleString()} pts</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ══ HOST TAB ════════════════════════════════════════ */}
            {tab === "host" && (
              <>
                {/* Host stats */}
                <div className="grid grid-cols-3 gap-4">
                  <StatCard label="Quizzes Created" value={totalHosted}    color="text-blue-500" />
                  <StatCard label="Total Questions" value={totalQuestions} color="text-purple-500" />
                  <StatCard label="Sessions Run"    value="—"              color="text-green-500" sub="Coming soon" />
                </div>

                {/* Quiz library with stats */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-md">
                  <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                    <Target size={15} className="text-blue-500" />
                    <h2 className="font-bold text-sm">Your Quiz Library</h2>
                    <span className="ml-auto text-xs text-muted-foreground">{totalHosted} quizzes</span>
                  </div>
                  {hostedQuizzes.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground text-sm">
                      <Trophy size={32} className="mx-auto mb-3 opacity-30" />
                      No quizzes created yet.{" "}
                      <Link href="/create" className="text-blue-500 hover:underline">Create your first quiz</Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {hostedQuizzes.map((q: any, i: number) => (
                        <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-accent/30 transition-colors">
                          <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-500 font-black text-sm shrink-0">
                            {(q.questions?.length || 0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-foreground truncate">{q.title || "Untitled Quiz"}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {q.questions?.length || 0} questions
                              {q.updatedAt ? ` · Updated ${new Date(q.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${q.visibility === "public" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                              {q.visibility || "private"}
                            </span>
                            <Link
                              href={`/create?quizId=${q.id}`}
                              className="text-xs text-blue-500 hover:underline font-medium"
                            >
                              Edit
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Growth tips */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-md">
                  <h2 className="font-bold mb-4 flex items-center gap-2 text-sm">
                    <TrendingUp size={15} className="text-amber-500" /> Host Tips
                  </h2>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {[
                      "Use Battle Royale mode for max excitement with large groups.",
                      "Set timer to 15s for speed rounds, 45s for harder questions.",
                      "Enable Shuffle Questions to prevent answer sharing.",
                      "Use the Analytics tab after each session to spot tricky questions.",
                    ].map((tip, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-blue-500 font-black shrink-0">{i + 1}.</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Right: Recommendations ────────────────────────── */}
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-lg sticky top-24">
              <h2 className="font-bold mb-5 flex items-center gap-2 text-sm">
                <Star size={15} className="text-yellow-500" /> Recommended for You
              </h2>
              <div className="space-y-3">
                {recommendations.slice(0, 6).map((rec: any, i: number) => (
                  <div key={i} className="group cursor-pointer">
                    <div className="bg-background border border-border p-3 rounded-xl hover:border-blue-500 transition-all relative overflow-hidden">
                      <div className="font-bold text-foreground text-sm mb-0.5 group-hover:text-blue-500 transition-colors line-clamp-1">{rec.title}</div>
                      <div className="text-xs text-muted-foreground flex justify-between">
                        <span>by {rec.author}</span>
                        <span>{(rec.plays || 0).toLocaleString()} plays</span>
                      </div>
                      <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-blue-600 to-transparent opacity-0 group-hover:opacity-100 flex items-center justify-end pr-2 transition-all">
                        <PlayCircle className="text-white" size={16} />
                      </div>
                    </div>
                  </div>
                ))}
                {recommendations.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-6">
                    <Search size={24} className="mx-auto mb-2 opacity-30" />
                    No recommendations yet
                  </div>
                )}
              </div>
              <div className="mt-5 pt-4 border-t border-border">
                <Link href="/explore" className="flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
                  <Search size={14} /> Explore all quizzes
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
