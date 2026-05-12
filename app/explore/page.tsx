"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Search, Play, Star, Users, Clock, Loader2 } from "lucide-react";
import Link from "next/link";

const CATEGORIES = ["All", "General", "Math", "Science", "History", "Tech", "Language", "Gaming", "Geography", "Entertainment", "Sports", "Indonesia"];

const EMOJI: Record<string, string> = {
  General: "🌍", Math: "📐", Science: "🧪", History: "🏛️", Tech: "💻",
  Language: "🗣️", Gaming: "🎮", Geography: "🗺️", Entertainment: "🎬", Sports: "⚽", Indonesia: "🇮🇩",
};

export default function ExplorePage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append("q", search);
    if (category) params.append("category", category);
    const timeout = setTimeout(() => {
      fetch(`/api/quiz/explore?${params.toString()}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => setQuizzes(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, category]);

  return (
    <AppShell>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--t1)" }}>Explore</h1>
        <p style={{ fontSize: 14, color: "var(--t3)", marginTop: 4 }}>Discover community-created quizzes</p>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--t3)", pointerEvents: "none" }} />
        <input
          type="text"
          placeholder="Search quizzes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="zy-input"
          style={{ paddingLeft: 40 }}
        />
      </div>

      {/* Category chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
        {CATEGORIES.map(cat => {
          const active = cat === "All" ? !category : category === cat;
          return (
            <button key={cat} onClick={() => setCategory(cat === "All" ? "" : cat)} style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: active ? "var(--p)" : "var(--bg2-raw)",
              color: active ? "#fff" : "var(--t2)",
              border: `1px solid ${active ? "var(--p)" : "var(--border-raw)"}`,
              transition: "all 0.15s",
            }}>
              {cat}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="zy-card" style={{ height: 200, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", border: "1.5px dashed var(--border-raw)", borderRadius: 16, background: "var(--card-raw)", textAlign: "center", gap: 14 }}>
          <div style={{ fontSize: 40, opacity: 0.3 }}>🔍</div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>No quizzes found</h3>
            <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 6 }}>Try a different search term or category.</p>
          </div>
          <button onClick={() => { setSearch(""); setCategory(""); }} className="zy-btn-ghost" style={{ fontSize: 13 }}>
            Reset filters
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {quizzes.map((quiz, i) => (
            <div key={i} className="zy-card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Cover */}
              <div style={{ height: 120, background: "linear-gradient(135deg, var(--bg2-raw), var(--bg3-raw))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, position: "relative" }}>
                {EMOJI[quiz.category] ?? "📚"}
                <div style={{ position: "absolute", top: 10, left: 10, padding: "3px 9px", borderRadius: 8, background: "var(--p)", color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>
                  {quiz.category}
                </div>
              </div>

              <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {quiz.title}
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--t3)", marginBottom: 14 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={11}/> {quiz.author}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={11}/> {quiz.questionCount} Qs</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border-raw)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>
                    <Star size={12} fill="currentColor" /> {quiz.rating || "NEW"}
                  </div>
                  <Link href={`/quiz/${quiz.hostId}/${quiz.id}`} className="zy-btn-primary" style={{ padding: "7px 14px", fontSize: 12, textDecoration: "none" }}>
                    <Play size={12} /> Open
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
