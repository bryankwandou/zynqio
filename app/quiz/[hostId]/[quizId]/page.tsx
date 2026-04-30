"use client";

import { useState, useEffect, use } from "react";
import { Navbar } from "@/components/navbar";
import { Play, Share2, Copy, Star, Users, Calendar, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function QuizDetailPage({ params }: { params: Promise<{ hostId: string, quizId: string }> }) {
  const unwrappedParams = use(params);
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchQuiz() {
      try {
        const res = await fetch(`/api/quiz/get?hostId=${unwrappedParams.hostId}&quizId=${unwrappedParams.quizId}`);
        if (res.ok) {
          const data = await res.json();
          setQuiz(data);
        }
      } catch (err) {
        console.error("Failed to fetch quiz", err);
      } finally {
        setLoading(false);
      }
    }
    fetchQuiz();
  }, [unwrappedParams.hostId, unwrappedParams.quizId]);

  const handleHost = async () => {
    try {
      const res = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz.id, hostId: unwrappedParams.hostId })
      });
      if (res.ok) {
        const { roomCode } = await res.json();
        router.push(`/host/${roomCode}`);
      }
    } catch (err) {
      console.error("Failed to create room", err);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading Quiz...</div>;
  if (!quiz) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Quiz not found.</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left: Info Card */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 uppercase tracking-widest">
                  {quiz.category}
                </span>
              </div>
              
              <h1 className="text-4xl font-black text-white mb-4 mt-4 tracking-tight">{quiz.title}</h1>
              <p className="text-slate-400 text-lg mb-8 leading-relaxed">{quiz.description || "No description provided for this quiz."}</p>
              
              <div className="flex flex-wrap gap-6 text-sm text-slate-500 mb-8 pt-6 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-blue-500" />
                  <span className="font-bold text-slate-300">{(quiz.plays || 0).toLocaleString()}</span> plays
                </div>
                <div className="flex items-center gap-2">
                  <Star size={18} className="text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-slate-300">{quiz.rating || "N/A"}</span> rating
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-purple-500" />
                  <span>Created {new Date(quiz.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex gap-4">
                <Button onClick={handleHost} className="flex-1 py-6 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-2xl group transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  HOST NOW <Play size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button variant="outline" className="px-6 border-slate-700 text-slate-300 hover:bg-slate-800 rounded-2xl">
                  <Share2 size={20} />
                </Button>
              </div>
            </div>

            {/* Questions Preview */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2 px-2">
                Questions <span className="text-slate-500 text-lg font-medium">({quiz.questions?.length || 0})</span>
              </h2>
              {quiz.questions?.map((q: any, i: number) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Question {i + 1} • {q.type}</span>
                    <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded">{q.points} pt</span>
                  </div>
                  <p className="text-lg text-white font-medium mb-4">{q.text}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options?.map((opt: string, oi: number) => (
                      <div key={oi} className={`text-sm p-3 rounded-xl border ${q.correctAnswer === oi.toString() ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sticky top-24">
              <h3 className="font-bold text-white mb-4 uppercase tracking-widest text-xs text-slate-500">About Author</h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-black text-white">
                  {quiz.author?.[0] || "A"}
                </div>
                <div>
                  <div className="font-bold text-white">{quiz.author || "Anonymous"}</div>
                  <div className="text-xs text-slate-500">Creator</div>
                </div>
              </div>
              <Button variant="outline" className="w-full border-slate-800 text-slate-400 hover:text-white rounded-xl py-5 group">
                <Copy size={18} className="mr-2" /> Copy to My Library
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
