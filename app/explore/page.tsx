"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Search, Filter, Play, Star, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ExplorePage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQuizzes() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.append('q', search);
        if (category) params.append('category', category);
        
        const res = await fetch(`/api/quiz/explore?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setQuizzes(data);
        }
      } catch (err) {
        console.error("Explore fetch error", err);
      } finally {
        setLoading(false);
      }
    }
    const debounce = setTimeout(fetchQuizzes, 300);
    return () => clearTimeout(debounce);
  }, [search, category]);

  const CATEGORIES = ["General", "Math", "Science", "History", "Tech", "Language", "Gaming"];

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white">
      <Navbar />
      
      {/* Hero Header */}
      <div className="bg-slate-900 border-b border-slate-800 py-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -mr-64 -mt-64" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">Explore the <span className="text-blue-500">Zynqio</span> Library</h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10">Discover community-created quizzes to sharpen your mind and compete with friends.</p>
          
          <div className="max-w-3xl mx-auto relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={24} />
            <input 
              type="text" 
              placeholder="Search by quiz title, topic, or creator..."
              className="w-full bg-slate-950 border border-slate-800 rounded-3xl py-6 pl-16 pr-8 text-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-12 flex-1">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-12 items-center">
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 mr-4">
            <Filter size={20} className="text-slate-500" />
          </div>
          <button 
            onClick={() => setCategory("")}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${!category ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button 
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${category === cat ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-3xl h-[400px] animate-pulse" />
            ))}
          </div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-32 bg-slate-900/20 rounded-[3rem] border border-slate-900 border-dashed">
            <div className="text-6xl mb-6 opacity-20">🔍</div>
            <h2 className="text-2xl font-bold text-slate-300">No quizzes found</h2>
            <p className="text-slate-500 mt-2">Try a different search term or category.</p>
            <Button onClick={() => {setSearch(""); setCategory("");}} variant="link" className="mt-4 text-blue-500">Reset Filters</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {quizzes.map((quiz, i) => (
              <div key={i} className="group bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden hover:border-blue-500/50 transition-all shadow-xl hover:shadow-blue-900/10 flex flex-col h-full">
                <div className="h-48 bg-slate-800 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent z-10" />
                  <div className="absolute top-4 left-4 z-20 px-4 py-2 bg-blue-600/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                    {quiz.category}
                  </div>
                  {/* Image Placeholder */}
                  <div className="w-full h-full bg-gradient-to-br from-blue-900/20 to-purple-900/20 flex items-center justify-center text-5xl">
                    {quiz.category === 'Math' ? '📐' : quiz.category === 'Science' ? '🧪' : '📚'}
                  </div>
                </div>
                
                <div className="p-8 flex flex-col flex-1">
                  <h3 className="text-2xl font-bold mb-3 group-hover:text-blue-400 transition-colors line-clamp-2">{quiz.title}</h3>
                  <div className="flex items-center gap-3 text-slate-500 text-xs mb-8">
                    <div className="flex items-center gap-1.5"><Users size={14} /> by {quiz.author}</div>
                    <div className="w-1 h-1 rounded-full bg-slate-700" />
                    <div className="flex items-center gap-1.5"><Clock size={14} /> {quiz.questionCount} Questions</div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-yellow-500 font-bold">
                      <Star size={16} fill="currentColor" /> {quiz.rating || "New"}
                    </div>
                    <Link href={`/quiz/${quiz.hostId}/${quiz.id}`}>
                      <Button className="bg-white text-slate-900 font-black px-8 rounded-2xl hover:scale-105 transition-transform">
                        <Play size={16} className="mr-2" /> Open
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
