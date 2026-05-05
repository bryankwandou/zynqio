"use client";

import { useState, useEffect, use } from "react";
import { Navbar } from "@/components/navbar";
import { Play, Share2, Copy, Star, Users, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function QuizDetailPage({ params }: { params: Promise<{ hostId: string, quizId: string }> }) {
  const unwrappedParams = use(params);
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hosting, setHosting] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);
  const router = useRouter();
  const { status } = useSession();

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
    if (status !== "authenticated") {
      router.push(`/auth/signin?callbackUrl=/quiz/${unwrappedParams.hostId}/${unwrappedParams.quizId}`);
      return;
    }
    setHosting(true);
    setHostError(null);
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id, hostId: unwrappedParams.hostId }),
      });
      if (res.ok) {
        const { roomCode } = await res.json();
        router.push(`/host/${roomCode}`);
      } else if (res.status === 401) {
        router.push(`/auth/signin?callbackUrl=/quiz/${unwrappedParams.hostId}/${unwrappedParams.quizId}`);
      } else {
        setHostError("Failed to create room. Please try again.");
      }
    } catch {
      setHostError("Network error. Please try again.");
    } finally {
      setHosting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground font-bold animate-pulse uppercase tracking-widest">Loading Quiz...</div>;
  if (!quiz) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground font-bold uppercase tracking-widest">Quiz not found.</div>;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-blue-500/30">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left: Info Card */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 uppercase tracking-widest">
                  {quiz.category}
                </span>
              </div>
              
              <h1 className="text-4xl font-black text-foreground mb-4 mt-4 tracking-tight">{quiz.title}</h1>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">{quiz.description || "No description provided for this quiz."}</p>
              
              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground mb-8 pt-6 border-t border-border">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-blue-500" />
                  <span className="font-bold text-foreground">{(quiz.plays || 0).toLocaleString()}</span> plays
                </div>
                <div className="flex items-center gap-2">
                  <Star size={18} className="text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-foreground">{quiz.rating || "N/A"}</span> rating
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-purple-500" />
                  <span>Created {new Date(quiz.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {hostError && (
                <div className="mb-4 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                  {hostError}
                </div>
              )}
              <div className="flex gap-4">
                <Button
                  onClick={handleHost}
                  disabled={hosting}
                  className="flex-1 py-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-black text-lg rounded-2xl group transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                >
                  {hosting ? (
                    <Loader2 size={20} className="animate-spin mr-2" />
                  ) : null}
                  {status !== "authenticated" ? "SIGN IN TO HOST" : "HOST NOW"}
                  {!hosting && <Play size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />}
                </Button>
                <Button variant="outline" className="px-6 border-border text-muted-foreground hover:bg-accent rounded-2xl">
                  <Share2 size={20} />
                </Button>
              </div>
            </div>

            {/* Questions Preview — answers hidden for integrity */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 px-2">
                Questions <span className="text-muted-foreground text-lg font-medium">({quiz.questions?.length || 0})</span>
              </h2>
              <div className="text-xs text-muted-foreground px-2 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                Correct answers are hidden — join a live session to play.
              </div>
              {quiz.questions?.map((q: any, i: number) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-6 hover:border-blue-500/30 transition-colors shadow-lg">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Question {i + 1} • {q.type}</span>
                    <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded">{q.points} pt</span>
                  </div>
                  <p className="text-lg text-foreground font-medium mb-4">{q.text}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options?.map((opt: string, oi: number) => (
                      <div key={oi} className="text-sm p-3 rounded-xl border bg-background border-border text-muted-foreground">
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
            <div className="bg-card border border-border rounded-3xl p-6 sticky top-24 shadow-xl">
              <h3 className="font-bold text-foreground mb-4 uppercase tracking-widest text-xs text-muted-foreground">About Author</h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-black text-white">
                  {quiz.author?.[0] || "A"}
                </div>
                <div>
                  <div className="font-bold text-foreground">{quiz.author || "Anonymous"}</div>
                  <div className="text-xs text-muted-foreground">Creator</div>
                </div>
              </div>
              <Button variant="outline" className="w-full border-border text-muted-foreground hover:text-foreground rounded-xl py-5 group">
                <Copy size={18} className="mr-2" /> Copy to My Library
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
