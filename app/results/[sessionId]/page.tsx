"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, use } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Download, BarChart2, Users, Share2, Copy } from "lucide-react";
import { getAvatar } from "@/lib/avatars";

function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-3 rounded-sm opacity-80"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-${Math.random() * 20}%`,
            backgroundColor: ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"][i % 6],
            animation: `confettiFall ${2 + Math.random() * 3}s linear ${Math.random() * 2}s infinite`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function ResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { data: session } = useSession();
  const unwrappedParams = use(params);
  const [activeTab, setActiveTab] = useState<"leaderboard" | "analytics" | "review">("leaderboard");
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
  const [hasSubmittedRating, setHasSubmittedRating] = useState(false);

  useEffect(() => {
    const nick = localStorage.getItem("zynqio_nickname") || "";
    setMyNickname(nick);

    async function fetchResults() {
      try {
        const res = await fetch(`/api/room/results?code=${unwrappedParams.sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);

          const hostId = localStorage.getItem("zynqio_host_id");
          const amIHost = hostId === data.hostId || (session?.user as any)?.id === data.hostId;
          setIsHost(amIHost);
          setShowRating(!amIHost);

          // Auto-save to history
          if ((session?.user as any)?.id && !amIHost) {
            const myResult = data.leaderboard?.find((p: any) => p.name === nick);
            if (myResult) {
              fetch("/api/player/history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  quizId: data.quizId,
                  title: data.quizTitle || "Quiz Session",
                  score: myResult.score,
                  accuracy: myResult.accuracy,
                  rank: myResult.rank,
                  totalPlayers: data.leaderboard.length,
                }),
              }).catch(() => {});
            }
          }

          // Trigger podium & confetti
          setTimeout(() => setPodiumVisible(true), 200);
          setTimeout(() => setShowConfetti(true), 600);
          setTimeout(() => setShowConfetti(false), 6000);
        }
      } catch (err) {
        console.error("Failed to fetch results", err);
      }
    }
    fetchResults();
  }, [unwrappedParams.sessionId, session]);

  const submitRating = async () => {
    try {
      await fetch("/api/quiz/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: results.quizId,
          hostId: results.hostId,
          rating,
          review: reviewText,
        }),
      });
      setHasSubmittedRating(true);
      setTimeout(() => setShowRating(false), 2000);
    } catch {
      console.error("Failed to submit rating");
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: "Zynqio Results", url });
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  if (!results) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-foreground text-lg font-bold animate-pulse">Calculating Results...</p>
      </div>
    );
  }

  const top3 = (results.leaderboard || []).slice(0, 3);
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {showConfetti && <Confetti />}
      <Navbar />

      {/* Podium Section */}
      <div className="bg-card border-b border-border py-12 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <h1 className="text-3xl font-bold text-center mb-2">🏆 Final Results</h1>
          {results.quizTitle && (
            <p className="text-center text-muted-foreground mb-8 text-sm">{results.quizTitle}</p>
          )}

          {/* Animated Podium */}
          <div className="flex justify-center items-end gap-3 md:gap-8 h-72">
            {/* 2nd Place */}
            {second && (
              <div
                className={`flex flex-col items-center transition-all duration-700 ${podiumVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{ transitionDelay: "200ms" }}
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getAvatar(second.avatarId).bg} flex items-center justify-center text-3xl mb-2 shadow-lg border-2 border-muted-foreground/20`}>
                  {getAvatar(second.avatarId).emoji}
                </div>
                <div className="text-2xl mb-1">🥈</div>
                <div className="bg-gradient-to-t from-slate-600 to-slate-500 w-24 md:w-32 h-28 rounded-t-2xl flex flex-col items-center justify-center text-white shadow-2xl">
                  <span className="text-3xl font-black">2</span>
                  <span className="text-xs opacity-70">{second.score} pts</span>
                </div>
                <div className="text-muted-foreground font-bold mt-2 text-sm text-center w-24 truncate">{second.name}</div>
              </div>
            )}

            {/* 1st Place */}
            {first && (
              <div
                className={`flex flex-col items-center transition-all duration-700 ${podiumVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
                style={{ transitionDelay: "400ms" }}
              >
                <div className="relative">
                  <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${getAvatar(first.avatarId).bg} flex items-center justify-center text-5xl mb-2 shadow-2xl ring-4 ring-yellow-500/50`}>
                    {getAvatar(first.avatarId).emoji}
                  </div>
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-3xl animate-bounce">👑</div>
                </div>
                <div className="text-3xl mb-1">🥇</div>
                <div className="bg-gradient-to-t from-yellow-600 to-yellow-400 w-28 md:w-36 h-44 rounded-t-2xl flex flex-col items-center justify-center shadow-[0_0_60px_rgba(234,179,8,0.4)]">
                  <span className="text-5xl font-black text-yellow-950">1</span>
                  <span className="text-sm text-yellow-900 font-bold">{first.score} pts</span>
                </div>
                <div className="text-yellow-500 font-black mt-2 text-center w-28 truncate uppercase tracking-wide">{first.name}</div>
              </div>
            )}

            {/* 3rd Place */}
            {third && (
              <div
                className={`flex flex-col items-center transition-all duration-700 ${podiumVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
                style={{ transitionDelay: "100ms" }}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatar(third.avatarId).bg} flex items-center justify-center text-2xl mb-2 shadow-md border-2 border-amber-600/30`}>
                  {getAvatar(third.avatarId).emoji}
                </div>
                <div className="text-2xl mb-1">🥉</div>
                <div className="bg-gradient-to-t from-amber-800 to-amber-700 w-20 md:w-28 h-20 rounded-t-2xl flex flex-col items-center justify-center text-amber-200 shadow-xl">
                  <span className="text-3xl font-black">3</span>
                  <span className="text-xs opacity-70">{third.score} pts</span>
                </div>
                <div className="text-amber-600 font-bold mt-2 text-sm text-center w-20 truncate">{third.name}</div>
              </div>
            )}
          </div>

          {/* Share button */}
          <div className="flex justify-center mt-8 gap-3">
            <Button onClick={handleShare} variant="outline" className="border-border gap-2">
              <Share2 size={16} /> Share Results
            </Button>
            {isHost && (
              <Button
                onClick={() => navigator.clipboard.writeText(window.location.origin + "/join/" + results.roomCode)}
                variant="outline"
                className="border-border gap-2"
              >
                <Copy size={16} /> Copy Join Link
              </Button>
            )}
          </div>
        </div>

        {/* Rating Modal */}
        {!isHost && showRating && !hasSubmittedRating && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="bg-card border border-border p-8 rounded-3xl max-w-md w-full text-center shadow-2xl">
              <h2 className="text-2xl font-black text-foreground mb-2">Enjoyed the Quiz?</h2>
              <p className="text-muted-foreground mb-6">Rate your experience!</p>
              <div className="flex justify-center gap-3 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className={`text-4xl transition-transform hover:scale-125 ${star <= (hoverRating || rating) ? "text-yellow-400" : "text-muted/30"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                className="w-full bg-background border border-border rounded-xl p-3 text-foreground text-sm mb-4 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="Leave a short review (optional)"
                rows={2}
                maxLength={100}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
              />
              <div className="flex gap-3">
                <Button onClick={() => setShowRating(false)} variant="ghost" className="flex-1">Skip</Button>
                <Button onClick={submitRating} disabled={rating === 0} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">Submit</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Tabs */}
        <div className="flex border-b border-border mb-8 overflow-x-auto">
          {["leaderboard", "review", ...(isHost ? ["analytics"] : [])].map((tab) => (
            <button
              key={tab}
              className={`px-6 py-3 font-bold whitespace-nowrap capitalize transition-colors ${
                activeTab === tab ? "text-blue-500 border-b-2 border-blue-500" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab as any)}
            >
              {tab === "analytics" ? "📊 Analytics" : tab === "review" ? "📝 Review" : "🏅 Leaderboard"}
            </button>
          ))}
        </div>

        {/* Leaderboard Tab */}
        {activeTab === "leaderboard" && (
          <div className="space-y-4">
            {results.gameMode === "team" && results.teamLeaderboard && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-xl mb-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Users size={18} className="text-blue-500" /> Team Rankings
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {results.teamLeaderboard.map((t: any, i: number) => (
                    <div key={i} className="bg-accent/30 p-4 rounded-xl flex justify-between items-center border border-border">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                          t.name.includes("Red") ? "bg-red-500" : t.name.includes("Blue") ? "bg-blue-500" : "bg-green-500"
                        }`}>{i + 1}</div>
                        <span className="font-bold">{t.name}</span>
                      </div>
                      <span className="text-blue-400 font-bold">{t.avgAccuracy}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Individual Rankings</h2>
              {isHost && (
                <Button variant="outline" className="border-border text-muted-foreground hover:bg-accent gap-2">
                  <Download size={16} /> Export CSV
                </Button>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
              {(results.leaderboard || []).map((p: any, i: number) => {
                const av = getAvatar(p.avatarId);
                const isMe = p.name === myNickname;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-4 border-b border-border ${
                      isMe ? "bg-blue-500/5 border-l-2 border-l-blue-500" : i === 0 ? "bg-yellow-500/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        i === 0 ? "bg-yellow-500 text-yellow-950" :
                        i === 1 ? "bg-slate-400 text-white" :
                        i === 2 ? "bg-amber-600 text-white" :
                        "bg-muted text-muted-foreground"
                      }`}>{p.rank}</div>
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${av.bg} flex items-center justify-center text-lg`}>
                        {av.emoji}
                      </div>
                      <div>
                        <span className={`font-bold ${isMe ? "text-blue-400" : "text-foreground"}`}>
                          {p.name}
                          {isMe && <span className="ml-1 text-xs">(you)</span>}
                        </span>
                        {p.team && <div className="text-[10px] text-muted-foreground uppercase">{p.team}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-500">{p.score} pts</div>
                      <div className="text-xs text-muted-foreground">{p.accuracy}% acc</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && isHost && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card border border-border p-6 rounded-2xl shadow-xl">
                <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Class Accuracy</div>
                <div className="text-4xl font-black text-green-500">{results.stats?.avgAccuracy}%</div>
                <div className="mt-3 h-1.5 w-full bg-accent rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full" style={{ width: `${results.stats?.avgAccuracy}%` }} />
                </div>
              </div>
              <div className="bg-card border border-border p-6 rounded-2xl shadow-xl">
                <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Participants</div>
                <div className="text-4xl font-black text-blue-500">{results.stats?.totalPlayers}</div>
              </div>
              <div className="bg-card border border-border p-6 rounded-2xl shadow-xl">
                <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Top Performer</div>
                <div className="text-xl font-black text-purple-500 truncate">{results.leaderboard?.[0]?.name}</div>
                <div className="text-muted-foreground text-xs mt-1">{results.leaderboard?.[0]?.score} pts</div>
              </div>
            </div>

            {/* Question Difficulty */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                <BarChart2 className="text-blue-500" /> Question Difficulty
              </h3>
              <div className="space-y-5">
                {results.questions?.map((q: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-foreground line-clamp-1">{q.text}</span>
                      <span className={`text-xs font-black ml-2 shrink-0 ${
                        q.accuracy < 40 ? "text-red-500" : q.accuracy < 70 ? "text-amber-500" : "text-green-500"
                      }`}>
                        {q.accuracy}% ({q.difficultyLabel})
                      </span>
                    </div>
                    <div className="h-2 bg-accent rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          q.accuracy < 40 ? "bg-red-500" : q.accuracy < 70 ? "bg-amber-500" : "bg-green-500"
                        }`}
                        style={{ width: `${q.accuracy}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Review Tab */}
        {activeTab === "review" && (
          <div className="space-y-4">
            {results.questions?.map((q: any, i: number) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 shadow-md">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded">Q{i + 1} • {q.type}</span>
                    <h3 className="text-lg font-bold mt-2">{q.text}</h3>
                  </div>
                  <div className={`text-2xl ${q.isCorrect ? "text-green-500" : "text-red-500"}`}>
                    {q.isCorrect ? "✓" : "✗"}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <div className="text-xs text-green-500 font-bold uppercase mb-1">Correct Answer</div>
                    <div className="font-medium">{q.correctAnswer}</div>
                  </div>
                  {!q.isCorrect && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <div className="text-xs text-red-500 font-bold uppercase mb-1">Your Answer</div>
                      <div className="font-medium">{q.playerAnswer || "No Answer"}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
