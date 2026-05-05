"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Play, Edit, Copy, Trash2, BarChart2 } from "lucide-react";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<any[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
    
    async function fetchMyQuizzes() {
      try {
        const res = await fetch('/api/quiz/list');
        if (res.ok) {
          const data = await res.json();
          setQuizzes(data);
        }
      } catch (err) {
        console.error("Failed to fetch quizzes", err);
      }
    }
    
    if (session) fetchMyQuizzes();
  }, [status, router, session]);

  const handleHost = async (quizId: string) => {
    try {
      const res = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId })
      });
      if (res.ok) {
        const { roomCode } = await res.json();
        router.push(`/host/${roomCode}`);
      }
    } catch (err) {
      console.error("Failed to create room", err);
    }
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  if (!session) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-12 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-black uppercase tracking-tight">My Quizzes</h1>
              <Link href="/setup">
                <div className="px-3 py-1 rounded-full bg-blue-600/10 border border-blue-600/20 text-blue-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-blue-600/20 transition-all cursor-pointer">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Zynqio Advanced
                </div>
              </Link>
            </div>
            <p className="text-muted-foreground font-medium">Manage and host your professional quiz sessions</p>
          </div>
          <Link href="/create">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-black py-7 px-10 rounded-2xl flex items-center gap-3 shadow-lg shadow-blue-900/20 transform hover:scale-105 transition-all">
              <Plus size={24} />
              CREATE NEW QUIZ
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {quizzes.map(quiz => (
            <div key={quiz.id} className="group bg-card border border-border rounded-[2.5rem] p-8 flex flex-col transition-all hover:border-blue-500/50 hover:shadow-2xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl -mr-16 -mt-16 group-hover:bg-blue-600/10 transition-colors" />
              
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-black text-foreground line-clamp-1 uppercase tracking-tight">{quiz.title}</h3>
                <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${quiz.status === 'published' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                  {quiz.status}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-8 font-bold uppercase tracking-widest">
                <span className="text-blue-500">{quiz.questionCount} Questions</span>
                <span className="opacity-30">•</span>
                <span>{quiz.createdAt}</span>
              </div>
              
              <div className="mt-auto grid grid-cols-2 gap-3">
                <Button 
                  className="w-full bg-blue-600 text-white hover:bg-blue-700 font-black rounded-xl py-6 shadow-md" 
                  disabled={quiz.status === 'draft'}
                  onClick={() => handleHost(quiz.id)}
                >
                  <Play size={18} className="mr-2 fill-white" /> HOST
                </Button>
                <Link href={`/create?quizId=${encodeURIComponent(quiz.id)}`} className="w-full">
                  <Button variant="outline" className="w-full border-border text-muted-foreground hover:bg-accent font-black rounded-xl py-6">
                    <Edit size={18} className="mr-2" /> EDIT
                  </Button>
                </Link>
              </div>
              
              <div className="flex justify-between mt-6 pt-6 border-t border-border text-muted-foreground">
                <button className="hover:text-blue-500 transition-colors p-2" title="Duplicate"><Copy size={18} /></button>
                <button className="hover:text-blue-500 transition-colors p-2" title="Analytics"><BarChart2 size={18} /></button>
                <button className="hover:text-red-500 transition-colors p-2" title="Delete"><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
          
          {quizzes.length === 0 && (
            <div className="col-span-full py-24 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-[3rem] bg-card/50 shadow-inner">
              <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mb-6 text-blue-500">
                <Plus size={40} />
              </div>
              <h3 className="text-3xl font-black text-foreground mb-3 uppercase tracking-tight">No quizzes yet</h3>
              <p className="text-muted-foreground mb-10 text-center max-w-md font-medium">Create your first professional quiz to start hosting engaging real-time sessions today.</p>
              <Link href="/create">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-black py-7 px-12 rounded-2xl shadow-xl shadow-blue-900/20 transform hover:scale-105 transition-all">
                  START CREATING
                </Button>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
