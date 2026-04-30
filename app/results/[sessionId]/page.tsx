"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, use } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Trophy, Download, BarChart2, Star, Users } from "lucide-react";

export default function ResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { data: session } = useSession();
  const unwrappedParams = use(params);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'analytics' | 'review'>('leaderboard');
  const [results, setResults] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);
  
  // Phase 3: Rating System
  const [showRating, setShowRating] = useState(false); 
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [hasSubmittedRating, setHasSubmittedRating] = useState(false);

  useEffect(() => {
    async function fetchResults() {
      try {
        const res = await fetch(`/api/room/results?code=${unwrappedParams.sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          
          // Determine if user is host
          const hostId = localStorage.getItem('zynqio_host_id');
          const amIHost = hostId === data.hostId || (session?.user as any)?.id === data.hostId;
          setIsHost(amIHost);
          setShowRating(!amIHost);

          // AUTO-SAVE TO HISTORY (Section 13.1)
          if ((session?.user as any)?.id && !amIHost) {
            const nickname = localStorage.getItem("zynqio_nickname");
            const myResult = data.leaderboard.find((p: any) => p.name === nickname);
            if (myResult) {
              fetch('/api/player/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  quizId: data.quizId,
                  title: data.quizTitle || 'Quiz Session',
                  score: myResult.score,
                  accuracy: myResult.accuracy,
                  rank: myResult.rank,
                  totalPlayers: data.leaderboard.length
                })
              }).catch(e => console.error("History save failed", e));
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch results", err);
      }
    }
    fetchResults();
  }, [unwrappedParams.sessionId, session]);

  const submitRating = async () => {
    try {
      await fetch('/api/quiz/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: results.quizId,
          hostId: results.hostId,
          rating,
          review: reviewText
        })
      });
      setHasSubmittedRating(true);
      setTimeout(() => setShowRating(false), 2000);
    } catch (err) {
      console.error("Failed to submit rating", err);
    }
  };

  if (!results) return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><div className="text-white text-2xl font-bold animate-pulse">Calculating Results...</div></div>;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white">
      <Navbar />
      
      {/* Podium Section */}
      <div className="bg-slate-900 border-b border-slate-800 py-12 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <h1 className="text-3xl font-bold text-center mb-12">Final Results</h1>
          
          <div className="flex justify-center items-end gap-2 md:gap-6 h-64 mt-8 animate-in fade-in zoom-in duration-1000">
            {/* 2nd Place */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-300 flex items-center justify-center text-xl font-bold mb-2">
                {results.leaderboard[1]?.name?.[0] || '2'}
              </div>
              <div className="bg-gradient-to-t from-slate-800 to-slate-700 w-24 md:w-32 h-32 rounded-t-xl flex items-center justify-center text-3xl font-black text-slate-300 shadow-2xl">
                2
              </div>
              <div className="text-slate-400 font-bold mt-2 truncate w-24 text-center">{results.leaderboard[1]?.name || '—'}</div>
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center scale-110 -translate-y-4">
              <div className="w-20 h-20 rounded-full bg-slate-800 border-4 border-yellow-500 flex items-center justify-center text-2xl font-bold mb-2 relative">
                <span className="absolute -top-6 text-3xl animate-bounce">👑</span>
                {results.leaderboard[0]?.name?.[0] || '1'}
              </div>
              <div className="bg-gradient-to-t from-yellow-600 to-yellow-400 w-28 md:w-36 h-48 rounded-t-xl flex items-center justify-center text-5xl font-black text-yellow-900 shadow-[0_0_50px_rgba(234,179,8,0.3)]">
                1
              </div>
              <div className="text-yellow-500 font-black mt-2 truncate w-28 text-center uppercase tracking-widest">{results.leaderboard[0]?.name || '—'}</div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-amber-600 flex items-center justify-center text-xl font-bold mb-2">
                {results.leaderboard[2]?.name?.[0] || '3'}
              </div>
              <div className="bg-gradient-to-t from-amber-800 to-amber-700 w-24 md:w-32 h-24 rounded-t-xl flex items-center justify-center text-3xl font-black text-amber-600 shadow-2xl">
                3
              </div>
              <div className="text-amber-700 font-bold mt-2 truncate w-24 text-center">{results.leaderboard[2]?.name || '—'}</div>
            </div>
          </div>
        </div>

        {/* Rating Modal (Section 19.1) */}
        {!isHost && showRating && !hasSubmittedRating && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] max-w-md w-full text-center shadow-2xl">
              <h2 className="text-2xl font-black text-white mb-2">Enjoyed the Quiz?</h2>
              <p className="text-slate-400 mb-8">Rate your experience to help the creator!</p>
              <div className="flex justify-center gap-4 mb-8">
                {[1, 2, 3, 4, 5].map(star => (
                  <button 
                    key={star} 
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)} 
                    className={`text-4xl transition-transform hover:scale-125 ${star <= (hoverRating || rating) ? 'opacity-100' : 'opacity-30'}`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
              <textarea 
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm mb-6 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Write a quick review..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
              />
              <div className="flex gap-4">
                <Button 
                  onClick={() => setShowRating(false)}
                  variant="ghost"
                  className="flex-1 text-slate-500"
                >
                  Skip
                </Button>
                <Button 
                  onClick={submitRating}
                  disabled={rating === 0}
                  className="flex-1 bg-white text-slate-900 font-bold"
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Tabs */}
        <div className="flex border-b border-slate-800 mb-8 overflow-x-auto no-scrollbar">
          <button 
            className={`px-6 py-3 font-bold whitespace-nowrap transition-colors ${activeTab === 'leaderboard' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            Leaderboard
          </button>
          <button 
            className={`px-6 py-3 font-bold whitespace-nowrap transition-colors ${activeTab === 'review' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
            onClick={() => setActiveTab('review')}
          >
            Review Answers
          </button>
          {isHost && (
            <button 
              className={`px-6 py-3 font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'analytics' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart2 size={18} /> Analytics
            </button>
          )}
        </div>

        {activeTab === 'leaderboard' && (
          <div className="space-y-8">
            {results.gameMode === 'team' && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Users size={20} className="text-blue-500" /> Team Rankings
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.teamLeaderboard.map((t: any, i: number) => (
                    <div key={i} className="bg-slate-800/50 p-4 rounded-xl flex justify-between items-center border border-slate-700/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          t.name.includes('Red') ? 'bg-red-500' :
                          t.name.includes('Blue') ? 'bg-blue-500' :
                          t.name.includes('Green') ? 'bg-green-500' : 'bg-yellow-500'
                        } text-white`}>
                          {i + 1}
                        </div>
                        <span className="font-bold">{t.name}</span>
                      </div>
                      <div className="text-blue-400 font-bold">{t.avgAccuracy}% Acc</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Individual Rankings</h2>
              {isHost && (
                <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  <Download size={16} className="mr-2" /> Export CSV
                </Button>
              )}
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {results.leaderboard.map((p: any, i: number) => (
                <div key={i} className={`flex items-center justify-between p-4 border-b border-slate-800/50 ${i === 0 ? 'bg-yellow-500/10' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${i === 0 ? 'bg-yellow-500 text-slate-900' : i === 1 ? 'bg-slate-300 text-slate-900' : i === 2 ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {p.rank}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-lg">{p.name}</span>
                      {p.team && <span className="text-[10px] text-slate-500 uppercase font-black">{p.team}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-400">{p.score} pts</div>
                    <div className="text-xs text-slate-500">{p.accuracy}% Accuracy</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && isHost && (
          <div className="space-y-12 animate-in fade-in duration-700">
            {/* Class Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-green-500/20 transition-all" />
                <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Class Accuracy</div>
                <div className="text-5xl font-black text-green-400">{results.stats.avgAccuracy}%</div>
                <div className="mt-4 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full transition-all duration-1000" style={{ width: `${results.stats.avgAccuracy}%` }} />
                </div>
              </div>
              
              <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-all" />
                <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Participants</div>
                <div className="text-5xl font-black text-blue-400">{results.stats.totalPlayers}</div>
                <p className="text-slate-500 text-xs mt-4">Active engagement in this session.</p>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-all" />
                <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Top Performer</div>
                <div className="text-2xl font-black text-purple-400 truncate">{results.leaderboard[0]?.name}</div>
                <div className="text-slate-500 text-xs mt-2">{results.leaderboard[0]?.score} Points reached</div>
              </div>
            </div>

            {/* Difficulty Analysis (Section 12.2) */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
              <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3">
                <BarChart2 className="text-blue-500" /> Question Difficulty Analysis
              </h3>
              <div className="space-y-6">
                {results.questions?.map((q: any, i: number) => (
                  <div key={i} className="group">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-600 bg-slate-800 w-8 h-8 flex items-center justify-center rounded-lg">Q{i+1}</span>
                        <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{q.text}</span>
                      </div>
                      <span className={`text-xs font-black ${q.accuracy < 40 ? 'text-red-400' : q.accuracy < 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {q.accuracy}% Correct ({q.difficultyLabel})
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-800/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${q.accuracy < 40 ? 'bg-red-500' : q.accuracy < 70 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                        style={{ width: `${q.accuracy}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-Player Performance Matrix (Section 12.2) */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
              <div className="p-6 bg-slate-800/30 border-b border-slate-800">
                <h3 className="text-xl font-black text-white">Performance Matrix</h3>
                <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">Detailed player-by-player breakdown</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-950/50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Player</th>
                      {results.questions?.map((q: any, i: number) => (
                        <th key={i} className="px-3 py-4 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Q{i+1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {results.matrix?.map((p: any, i: number) => (
                      <tr key={i} className="hover:bg-blue-500/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-200">{p.name}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-tighter">{p.team || "Independent"}</div>
                        </td>
                        {p.answers.map((a: any, qi: number) => (
                          <td key={qi} className="px-3 py-4 text-center">
                            <div className={`w-8 h-8 mx-auto rounded-xl flex items-center justify-center border ${a.isCorrect ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                              {a.isCorrect ? '✓' : '✗'}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Review Answers Tab (Phase 2) */}
        {activeTab === 'review' && (
          <div className="space-y-4">
            {results.questions?.map((q: any, i: number) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-sm font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded">Q{i+1} • {q.type}</span>
                    <h3 className="text-xl font-bold mt-3">{q.text}</h3>
                  </div>
                  <div className={`text-2xl ${q.isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                    {q.isCorrect ? '✓' : '✗'}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="text-xs text-green-500 font-bold uppercase mb-1">Correct Answer</div>
                    <div className="font-medium">{q.correctAnswer}</div>
                  </div>
                  {!q.isCorrect && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                      <div className="text-xs text-red-500 font-bold uppercase mb-1">Your Answer</div>
                      <div className="font-medium text-slate-300">{q.playerAnswer}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Quiz Rating Modal (Phase 3) */}
      {showRating && !isHost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            {hasSubmittedRating ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4 animate-bounce">💖</div>
                <h3 className="text-2xl font-bold text-white mb-2">Thank you!</h3>
                <p className="text-slate-400">Your feedback helps the creator.</p>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => setShowRating(false)}
                  className="absolute top-4 right-4 text-slate-500 hover:text-white"
                >
                  ✕
                </button>
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">Rate this Quiz!</h3>
                  <p className="text-slate-400 text-sm">Did you enjoy playing? Let the host know.</p>
                </div>
                
                <div className="flex justify-center gap-2 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className={`text-4xl transition-transform hover:scale-125 ${
                        star <= (hoverRating || rating) ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'text-slate-700'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <div className="mb-6">
                  <textarea
                    placeholder="Leave a short review (optional)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    rows={3}
                    maxLength={100}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                  />
                  <div className="text-right text-xs text-slate-500 mt-1">{reviewText.length}/100</div>
                </div>

                <button
                  disabled={rating === 0}
                  onClick={submitRating}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  Submit Feedback
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
