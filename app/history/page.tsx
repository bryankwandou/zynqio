"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { History, TrendingUp, Star, Search, PlayCircle, Award, Shield, Zap, BarChart2 } from "lucide-react";
import Link from "next/link";

export default function HistoryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const histRes = await fetch('/api/player/history');
        if (histRes.ok) {
          const histData = await histRes.json();
          setHistory(histData);
        }

        const recRes = await fetch('/api/quiz/recommend');
        if (recRes.ok) {
          const recData = await recRes.json();
          setRecommendations(recData);
        }
      } catch (err) {
        console.error("Failed to fetch history data", err);
      }
    }
    fetchData();
  }, []);

  const avgAccuracy = history.length > 0 
    ? Math.round(history.reduce((acc, h) => acc + (h.accuracy || 0), 0) / history.length) 
    : 0;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-200">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-3xl font-bold text-white mb-2">My Journey</h1>
        <p className="text-slate-400 mb-8">Track your quiz history and find new challenges</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Analytics & History */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Player Analytics Widget */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="text-blue-400" /> Your Performance
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-xl text-center">
                  <div className="text-sm text-slate-400 mb-1">Avg Accuracy</div>
                  <div className="text-3xl font-bold text-green-400">{avgAccuracy}%</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl text-center">
                  <div className="text-sm text-slate-400 mb-1">Quizzes Played</div>
                  <div className="text-3xl font-bold text-blue-400">{history.length}</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl text-center border border-amber-500/20">
                  <div className="text-sm text-slate-400 mb-1">Best Topic</div>
                  <div className="text-lg font-bold text-amber-400 mt-1">Science</div>
                </div>
              </div>
            </div>

            {/* Badges & Achievements (Phase 3) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Award className="text-amber-400" /> Badges & Achievements
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { name: 'First Flight', icon: <PlayCircle size={20}/>, color: 'text-blue-400', unlocked: history.length > 0 },
                  { name: 'Accuracy Master', icon: <Star size={20}/>, color: 'text-green-400', unlocked: history.some(h => h.accuracy >= 95) },
                  { name: 'Marathoner', icon: <History size={20}/>, color: 'text-purple-400', unlocked: history.length >= 5 },
                  { name: 'Golden Child', icon: <Award size={20}/>, color: 'text-yellow-400', unlocked: true }, // Mock
                  { name: 'The Survivor', icon: <Shield size={20}/>, color: 'text-red-400', unlocked: false },
                  { name: 'Speed Demon', icon: <Zap size={20}/>, color: 'text-cyan-400', unlocked: true },
                ].map((badge, i) => (
                  <div key={i} className={`flex flex-col items-center p-4 rounded-xl border transition-all ${badge.unlocked ? 'bg-slate-800 border-slate-700 opacity-100' : 'bg-slate-950 border-slate-900 opacity-30 grayscale'}`}>
                    <div className={`mb-2 p-2 rounded-lg bg-slate-900 ${badge.color}`}>
                      {badge.icon}
                    </div>
                    <span className="text-xs font-bold text-center text-slate-300">{badge.name}</span>
                  </div>
                ))}
              </div>
            </div>

          {/* Analytics Overview (Section 13.2) */}
          {history.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 animate-in slide-in-from-top-4 duration-700">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-all" />
                <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                  <BarChart2 size={14} className="text-blue-500" /> Topic Performance
                </h3>
                <div className="space-y-4">
                  {Object.entries(
                    history.reduce((acc: any, h: any) => {
                      const cat = h.category || 'General';
                      if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
                      acc[cat].total += h.accuracy || 0;
                      acc[cat].count += 1;
                      return acc;
                    }, {})
                  ).map(([cat, stats]: [string, any]) => {
                    const avg = Math.round(stats.total / stats.count);
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                          <span>{cat}</span>
                          <span className="text-blue-400">{avg}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full" style={{ width: `${avg}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-amber-500/20 transition-all" />
                <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                  <TrendingUp size={14} className="text-amber-500" /> Growth Areas
                </h3>
                <div className="space-y-3">
                  {avgAccuracy < 80 ? (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                      <div className="text-amber-400 font-bold text-xs">Accuracy Focus</div>
                      <div className="text-slate-500 text-[10px] mt-1">Review your mistakes in the "Review Soal" section to boost your {avgAccuracy}% accuracy.</div>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-xl">
                      <div className="text-green-400 font-bold text-xs">Consistency Legend</div>
                      <div className="text-slate-500 text-[10px] mt-1">Maintaining a high {avgAccuracy}% average. Keep it up!</div>
                    </div>
                  )}
                  <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                    <div className="text-blue-400 font-bold text-xs">Recent Progress</div>
                    <div className="text-slate-500 text-[10px] mt-1">You've completed {history.length} sessions. Every quiz makes you sharper!</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History List */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <History className="text-purple-400" /> Recent Games
                </h2>
              </div>
              <div className="divide-y divide-slate-800/50">
                {history.map((h, i) => (
                  <div key={i} className="p-6 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-lg text-white">{h.title}</h3>
                      <div className="text-sm text-slate-400">{new Date(h.date).toLocaleDateString()} • {h.totalPlayers} Players</div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-slate-400">Accuracy</div>
                        <div className={`font-bold ${h.accuracy >= 90 ? 'text-green-400' : h.accuracy >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                          {h.accuracy}%
                        </div>
                      </div>
                      <div className="text-right w-16">
                        <div className="text-sm text-slate-400">Rank</div>
                        <div className="font-bold text-xl text-white">#{h.rank}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Recommendations */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg sticky top-24">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Star className="text-yellow-400" /> Recommended for You
              </h2>
              
              <div className="space-y-4">
                {recommendations.map((rec, i) => (
                  <div key={i} className="group cursor-pointer">
                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl hover:border-blue-500 transition-colors relative overflow-hidden">
                      <h3 className="font-bold text-white mb-1 group-hover:text-blue-400 transition-colors line-clamp-1">{rec.title}</h3>
                      <div className="text-xs text-slate-400 flex justify-between items-center">
                        <span>by {rec.author}</span>
                        <span>{rec.plays.toLocaleString()} plays</span>
                      </div>
                      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-blue-600 to-transparent opacity-0 group-hover:opacity-100 flex items-center justify-end pr-2 transition-all">
                        <PlayCircle className="text-white" size={20} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800">
                <Link href="/" className="flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <Search size={16} /> Explore more public quizzes
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
