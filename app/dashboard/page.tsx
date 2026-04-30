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
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>;
  }

  if (!session) return null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">My Quizzes</h1>
            <p className="text-slate-400">Manage and host your quiz sessions</p>
          </div>
          <Link href="/create">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-6 rounded-xl flex items-center gap-2">
              <Plus size={20} />
              Create New Quiz
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map(quiz => (
            <div key={quiz.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col transition-all hover:border-slate-700 hover:shadow-lg hover:shadow-blue-900/10">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-white line-clamp-1">{quiz.title}</h3>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${quiz.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {quiz.status}
                </span>
              </div>
              
              <p className="text-slate-400 text-sm mb-6">{quiz.questionCount} Questions • Created {quiz.createdAt}</p>
              
              <div className="mt-auto grid grid-cols-2 gap-2">
                <Button 
                  className="w-full bg-white text-slate-900 hover:bg-slate-200" 
                  disabled={quiz.status === 'draft'}
                  onClick={() => handleHost(quiz.id)}
                >
                  <Play size={16} className="mr-2" /> Host
                </Button>
                <Link href={`/create/${quiz.id}`} className="w-full">
                  <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
                    <Edit size={16} className="mr-2" /> Edit
                  </Button>
                </Link>
              </div>
              
              <div className="flex justify-between mt-4 pt-4 border-t border-slate-800 text-slate-400">
                <button className="hover:text-white transition-colors p-1" title="Duplicate"><Copy size={16} /></button>
                <button className="hover:text-white transition-colors p-1" title="Analytics"><BarChart2 size={16} /></button>
                <button className="hover:text-red-400 transition-colors p-1" title="Delete"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          
          {quizzes.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-400">
                <Plus size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No quizzes yet</h3>
              <p className="text-slate-400 mb-6 text-center max-w-md">Create your first quiz to start hosting engaging real-time sessions.</p>
              <Link href="/create">
                <Button className="bg-blue-600 hover:bg-blue-700">Create Quiz</Button>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
