"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, use } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Download, BarChart2, Users, Share2, Copy, Trophy } from "lucide-react";
import { getAvatar } from "@/lib/avatars";

/* ── Confetti ──────────────────────────────────────────────────── */
function Confetti() {
  const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];
  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {Array.from({ length: 60 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-sm"
          style={{
            width: Math.random() > 0.5 ? 8 : 5,
            height: Math.random() > 0.5 ? 14 : 8,
            left: `${Math.random() * 100}%`,
            top: `-${10 + Math.random() * 20}%`,
            backgroundColor: COLORS[i % COLORS.length],
            opacity: 0.85,
            animation: `confettiFall ${2.5 + Math.random() * 2.5}s linear ${Math.random() * 2}s infinite`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0)   rotate(0deg);   opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ── Medal config ──────────────────────────────────────────────── */
const MEDALS = ["🥇", "🥈", "🥉", "🎖️", "🎖️"];
const PODIUM_H = [176, 112, 80, 56, 44]; // px heights for positions 1-5
const PODIUM_COLORS = [
  "from-yellow-500 to-yellow-400 shadow-[0_0_60px_rgba(234,179,8,0.35)]",
  "from-slate-500 to-slate-400",
  "from-amber-700 to-amber-600",
  "from-blue-700 to-blue-600",
  "from-indigo-700 to-indigo-600",
];
const AVATAR_SIZE = ["w-24 h-24 text-5xl", "w-16 h-16 text-3xl", "w-14 h-14 text-2xl", "w-12 h-12 text-xl", "w-10 h-10 text-lg"];

/* ── Position layout for 1-5 winners ──────────────────────────── */
// visual order for podium slots (left → right): 2,1,3 / 2,1 / 1 / etc.
function podiumOrder(winners: any[]) {
  const n = winners.length;
  if (n === 1) return [winners[0]];
  if (n === 2) return [winners[1], winners[0]];
  if (n === 3) return [winners[1], winners[0], winners[2]];
  if (n === 4) return [winners[1], winners[0], winners[2], winners[3]];
  return [winners[1], winners[0], winners[2], winners[3], winners[4]];
}

function PodiumSlot({ player, rank, delay, visible }: { player: any; rank: number; delay: number; visible: boolean }) {
  const av = getAvatar(player.avatarId);
  const isFirst = rank === 1;
  return (
    <div
      className={`flex flex-col items-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Avatar */}
      <div className="relative mb-2">
        {isFirst && <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-3xl animate-bounce">👑</div>}
        <div
          className={`${AVATAR_SIZE[rank - 1]} rounded-2xl bg-gradient-to-br ${av.bg} flex items-center justify-center shadow-2xl ${
            isFirst ? "ring-4 ring-yellow-400/60" : "ring-2 ring-white/20"
          }`}
        >
          {av.emoji}
        </div>
      </div>
      {/* Medal */}
      <div className="text-2xl mb-1">{MEDALS[rank - 1]}</div>
      {/* Podium block */}
      <div
        className={`bg-gradient-to-t ${PODIUM_COLORS[rank - 1]} rounded-t-2xl flex flex-col items-center justify-center text-white shadow-2xl w-20 md:w-28`}
        style={{ height: PODIUM_H[rank - 1] }}
      >
        <span className="text-3xl font-black">{rank}</span>
        <span className="text-xs opacity-80 font-semibold">{(player.score || 0).toLocaleString()} pts</span>
      </div>
      {/* Name */}
      <div className={`mt-2 font-bold text-center text-sm truncate w-24 ${isFirst ? "text-yellow-400 font-black uppercase tracking-wide" : "text-muted-foreground"}`}>
        {player.name}
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */
export default function ResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { data: session } = useSession();
  const unwrappedParams = use(params);
  const [tab, setTab] = useState<"leaderboard" | "review" | "analytics">("leaderboard");
  const [results, setResults] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);
  const [myNickname, setMyNickname] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [podiumVisible, setPodiumVisible] = useState(false);

  // Rating
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [ratingDone, setRatingDone] = useState(false);

  useEffect(() => {
    const nick = localStorage.getItem("zynqio_nickname") || "";
    setMyNickname(nick);

    async function load() {
      try {
        const res = await fetch(`/api/room/results?code=${unwrappedParams.sessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        setResults(data);

        const amHost =
          (session?.user as any)?.id === data.hostId ||
          localStorage.getItem("zynqio_host_id") === data.hostId;
        setIsHost(amHost);
        if (!amHost) setShowRating(true);

        // Save player history
        if ((session?.user as any)?.id && !amHost) {
          const me = data.leaderboard?.find((p: any) => p.name === nick);
          if (me) {
            fetch("/api/player/history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                quizId: data.quizId,
                title: data.quizTitle || "Quiz Session",
                score: me.score,
                accuracy: me.accuracy,
                rank: me.rank,
                totalPlayers: data.leaderboard.length,
              }),
            }).catch(() => {});
          }
        }

        setTimeout(() => setPodiumVisible(true), 200);
        setTimeout(() => setShowConfetti(true), 500);
        setTimeout(() => setShowConfetti(false), 7000);
      } catch {}
    }
    load();
  }, [unwrappedParams.sessionId, session]);

  const submitRating = async () => {
    await fetch("/api/quiz/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId: results.quizId, hostId: results.hostId, rating, review: reviewText }),
    }).catch(() => {});
    setRatingDone(true);
    setTimeout(() => setShowRating(false), 1800);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: "Zynqio Results", url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  const exportCSV = () => {
    if (!results?.leaderboard) return;
    const rows = [
      ["Rank", "Name", "Score", "Accuracy", "Correct", "Total Answered"].join(","),
      ...results.leaderboard.map((p: any) =>
        [p.rank, `"${p.name}"`, p.score, `${p.accuracy}%`, p.totalCorrect || 0, p.totalAnswered || 0].join(",")
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${results.quizTitle || "results"}.csv`;
    a.click();
  };

  if (!results) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-foreground font-bold animate-pulse">Calculating Results...</p>
      </div>
    );
  }

  const winnerCount = results.settings?.winnerCount || 3;
  const winners = (results.leaderboard || []).slice(0, winnerCount);
  const orderedPodium = podiumOrder(winners);

  const tabs = ["leaderboard", "review", ...(isHost ? ["analytics"] : [])];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {showConfetti && <Confetti />}
      <Navbar />

      {/* ── Podium Section ─────────────────────────────────────── */}
      <section className="bg-card border-b border-border py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.12),transparent_70%)] pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 max-w-4xl">
          <h1 className="text-3xl font-black text-center mb-1">🏆 Final Results</h1>
          {results.quizTitle && (
            <p className="text-center text-muted-foreground text-sm mb-8">{results.quizTitle}</p>
          )}

          {/* Dynamic Podium */}
          <div className="flex justify-center items-end gap-2 md:gap-6 min-h-[260px] flex-wrap">
            {orderedPodium.map((player: any) => (
              <PodiumSlot
                key={player.rank}
                player={player}
                rank={player.rank}
                delay={player.rank === 1 ? 400 : player.rank === 2 ? 200 : player.rank * 100}
                visible={podiumVisible}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex justify-center mt-8 gap-3 flex-wrap">
            <Button onClick={handleShare} variant="outline" className="border-border gap-2">
              <Share2 size={15} /> Share Results
            </Button>
            {isHost && (
              <Button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${results.roomCode}`)}
                variant="outline"
                className="border-border gap-2"
              >
                <Copy size={15} /> Copy Join Link
              </Button>
            )}
          </div>
        </div>

        {/* ── Rating Modal ──────────────────────────────────────── */}
        {!isHost && showRating && !ratingDone && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl mx-4">
              <div className="text-4xl mb-3">🌟</div>
              <h2 className="text-xl font-black mb-1">Rate this Quiz</h2>
              <p className="text-muted-foreground text-sm mb-5">Help the host improve!</p>
              <div className="flex justify-center gap-2 mb-5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className={`text-4xl transition-transform hover:scale-125 ${star <= (hoverRating || rating) ? "text-yellow-400" : "text-muted-foreground/30"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                className="w-full bg-background border border-border rounded-xl p-3 text-sm text-foreground mb-4 outline-none resize-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave a short review (optional)"
                rows={2}
                maxLength={120}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
              />
              <div className="flex gap-3">
                <Button onClick={() => setShowRating(false)} variant="ghost" className="flex-1 text-muted-foreground">Skip</Button>
                <Button onClick={submitRating} disabled={rating === 0} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">Submit</Button>
              </div>
            </div>
          </div>
        )}
        {ratingDone && showRating && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border p-8 rounded-3xl text-center">
              <div className="text-5xl mb-3">🙏</div>
              <h2 className="text-xl font-black">Thanks for rating!</h2>
            </div>
          </div>
        )}
      </section>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex border-b border-border mb-8 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`px-5 py-3 font-bold whitespace-nowrap capitalize transition-colors text-sm ${
                tab === t ? "text-blue-500 border-b-2 border-blue-500" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "analytics" ? "📊 Analytics" : t === "review" ? "📝 Review" : "🏅 Leaderboard"}
            </button>
          ))}
        </div>

        {/* ── Leaderboard ─────────────────────────────────────── */}
        {tab === "leaderboard" && (
          <div className="space-y-4">
            {results.gameMode === "team" && results.teamLeaderboard?.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-lg mb-4">
                <h2 className="font-bold mb-3 flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-widest">
                  <Users size={14} className="text-blue-500" /> Team Rankings
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {results.teamLeaderboard.map((t: any, i: number) => (
                    <div key={i} className="bg-accent/30 px-4 py-3 rounded-xl flex justify-between items-center border border-border">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white ${
                          t.name.includes("Red") ? "bg-red-500" : t.name.includes("Blue") ? "bg-blue-500" : "bg-green-500"
                        }`}>{i + 1}</div>
                        <span className="font-bold text-sm">{t.name}</span>
                      </div>
                      <span className="text-blue-400 font-bold text-sm">{t.avgAccuracy}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-lg">Individual Rankings</h2>
              {isHost && (
                <Button onClick={exportCSV} variant="outline" size="sm" className="border-border text-muted-foreground gap-2">
                  <Download size={14} /> Export CSV
                </Button>
              )}
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
              {(results.leaderboard || []).map((p: any, i: number) => {
                const av = getAvatar(p.avatarId);
                const isMe = p.name === myNickname;
                const medalColors = ["bg-yellow-500 text-yellow-950", "bg-slate-400 text-white", "bg-amber-700 text-white"];
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-4 border-b border-border last:border-0 transition-colors ${
                      isMe ? "bg-blue-500/5 border-l-4 border-l-blue-500" : i === 0 ? "bg-yellow-500/5" : "hover:bg-accent/30"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${medalColors[i] || "bg-muted text-muted-foreground"}`}>
                      {p.rank}
                    </div>
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${av.bg} flex items-center justify-center text-lg shrink-0`}>
                      {av.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm truncate ${isMe ? "text-blue-400" : "text-foreground"}`}>
                        {p.name}
                        {isMe && <span className="ml-1 text-xs font-normal text-blue-300">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.totalCorrect || 0}/{p.totalAnswered || 0} correct</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-blue-500 text-sm">{(p.score || 0).toLocaleString()} pts</div>
                      <div className="text-xs text-muted-foreground">{p.accuracy}% acc</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Analytics ───────────────────────────────────────── */}
        {tab === "analytics" && isHost && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Class Accuracy", val: `${results.stats?.avgAccuracy || 0}%`, color: "text-green-500" },
                { label: "Participants",   val: results.stats?.totalPlayers || 0,     color: "text-blue-500" },
                { label: "Top Score",      val: `${(results.leaderboard?.[0]?.score || 0).toLocaleString()} pts`, color: "text-yellow-500" },
              ].map((stat) => (
                <div key={stat.label} className="bg-card border border-border p-5 rounded-2xl shadow-lg">
                  <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">{stat.label}</div>
                  <div className={`text-4xl font-black ${stat.color}`}>{stat.val}</div>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
              <h3 className="font-black mb-5 flex items-center gap-2">
                <BarChart2 size={16} className="text-blue-500" /> Question Difficulty
              </h3>
              <div className="space-y-4">
                {results.questions?.map((q: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-foreground line-clamp-1 flex-1 pr-4">{q.text}</span>
                      <span className={`font-black shrink-0 ${q.accuracy < 40 ? "text-red-500" : q.accuracy < 70 ? "text-amber-500" : "text-green-500"}`}>
                        {q.accuracy}%
                      </span>
                    </div>
                    <div className="h-2 bg-accent rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${q.accuracy < 40 ? "bg-red-500" : q.accuracy < 70 ? "bg-amber-500" : "bg-green-500"}`}
                        style={{ width: `${q.accuracy}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-player grid */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-lg overflow-x-auto">
              <h3 className="font-black mb-5 flex items-center gap-2">
                <Trophy size={16} className="text-yellow-500" /> Player Breakdown
              </h3>
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="text-muted-foreground text-xs uppercase tracking-widest border-b border-border">
                    <th className="py-2 text-left font-black">Player</th>
                    <th className="py-2 text-right font-black">Score</th>
                    <th className="py-2 text-right font-black">Correct</th>
                    <th className="py-2 text-right font-black">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(results.leaderboard || []).map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-accent/30 transition-colors">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-5 text-right text-xs">{p.rank}</span>
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getAvatar(p.avatarId).bg} flex items-center justify-center text-sm`}>
                            {getAvatar(p.avatarId).emoji}
                          </div>
                          <span className="font-medium text-foreground">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-bold text-blue-500">{p.score.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{p.totalCorrect || 0}/{p.totalAnswered || 0}</td>
                      <td className="py-2.5 text-right">
                        <span className={`font-bold ${p.accuracy >= 80 ? "text-green-500" : p.accuracy >= 50 ? "text-amber-500" : "text-red-500"}`}>
                          {p.accuracy}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Review ──────────────────────────────────────────── */}
        {tab === "review" && (
          <div className="space-y-4">
            {results.questions?.length === 0 && (
              <p className="text-muted-foreground text-center py-12">No question review data available.</p>
            )}
            {results.questions?.map((q: any, i: number) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-md">
                <div className="flex justify-between items-start mb-3 gap-3">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-muted-foreground bg-accent px-2 py-1 rounded">
                      Q{i + 1} · {q.type || "MCQ"}
                    </span>
                    <h3 className="font-bold mt-2 text-foreground">{q.text}</h3>
                  </div>
                  <div className={`text-xs font-black px-2 py-1 rounded-lg ${
                    q.accuracy < 40 ? "bg-red-500/10 text-red-500" : q.accuracy < 70 ? "bg-amber-500/10 text-amber-500" : "bg-green-500/10 text-green-500"
                  }`}>
                    {q.accuracy}% correct
                  </div>
                </div>
                <div className="h-1.5 bg-accent rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${q.accuracy < 40 ? "bg-red-500" : q.accuracy < 70 ? "bg-amber-500" : "bg-green-500"}`}
                    style={{ width: `${q.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
