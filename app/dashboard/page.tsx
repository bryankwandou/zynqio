"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import Link from "next/link";
import { Plus, Play, Edit, Trash2, Book, Zap, Users, Target, Loader2 } from "lucide-react";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="zy-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{label}</div>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--bg2-raw)", display: "flex", alignItems: "center", justifyContent: "center", color }}>
          <Icon size={16} />
        </div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--t1)" }}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/quiz/list")
      .then(r => r.ok ? r.json() : { quizzes: [] })
      .then(data => setQuizzes(data.quizzes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  const handleHost = async (quizId: string) => {
    const res = await fetch("/api/room/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId }),
    });
    if (res.ok) {
      const { roomCode } = await res.json();
      router.push(`/host/${roomCode}`);
    }
  };

  const handleDelete = async (quizId: string) => {
    if (!confirm("Hapus kuis ini? Tindakan ini tidak bisa dibatalkan.")) return;
    // Penghapusan lewat POST, bukan DELETE dengan id di querystring.
    // Alamat lengkap beserta querystring ikut tercatat di log peladen
    // dan riwayat peramban; badan permintaan tidak.
    const res = await fetch("/api/quiz/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId }),
    });
    if (res.ok) setQuizzes(p => p.filter(q => q.id !== quizId));
  };

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} className="animate-spin" style={{ color: "var(--p)" }} />
      </div>
    );
  }

  if (!session) return null;

  return (
    <AppShell>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--t1)" }}>Dashboard</h1>
          <p style={{ fontSize: 14, color: "var(--t3)", marginTop: 4 }}>
            Welcome back, {session.user?.name?.split(" ")[0] || "Host"}
          </p>
        </div>
        <Link href="/create" className="zy-btn-primary" style={{ textDecoration: "none", fontSize: 14 }}>
          <Plus size={16} /> New quiz
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
        <StatCard label="Quizzes" value={quizzes.length} icon={Book} color="var(--p)" />
        <StatCard label="Questions" value={quizzes.reduce((s, q) => s + (q.questionCount || 0), 0)} icon={Zap} color="var(--acc)" />
        <StatCard label="Public" value={quizzes.filter(q => q.status !== "private").length} icon={Users} color="var(--green)" />
        <StatCard label="Total plays" value="—" icon={Target} color="var(--orange)" />
      </div>

      <div>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--t2)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>
          My Quizzes
        </h2>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="zy-card" style={{ height: 180, animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : quizzes.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", border: "1.5px dashed var(--border-raw)", borderRadius: 16, background: "var(--card-raw)", textAlign: "center", gap: 14 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: "var(--bg2-raw)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)" }}>
              <Book size={26} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>No quizzes yet</h3>
              <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 6, maxWidth: 320, lineHeight: 1.6 }}>
                Create your first quiz to start hosting real-time sessions.
              </p>
            </div>
            <Link href="/create" className="zy-btn-primary" style={{ textDecoration: "none", marginTop: 6, fontSize: 14 }}>
              <Plus size={15} /> Create quiz
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {quizzes.map(quiz => (
              <div key={quiz.id} className="zy-card" style={{ padding: 18, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: "var(--bg2-raw)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    📚
                  </div>
                  <span style={{
                    padding: "3px 9px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: quiz.status !== "private" ? "rgba(52,211,153,0.15)" : "var(--bg2-raw)",
                    color: quiz.status !== "private" ? "var(--green)" : "var(--t3)",
                  }}>
                    {quiz.status !== "private" ? "● PUBLIC" : "PRIVATE"}
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {quiz.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 16 }}>
                  {quiz.questionCount} questions · {new Date(quiz.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <button onClick={() => handleHost(quiz.id)} className="zy-btn-primary" style={{ flex: 1, padding: "9px", fontSize: 13 }}>
                    <Play size={14} /> Host
                  </button>
                  <Link href={`/create?quizId=${encodeURIComponent(quiz.id)}`} className="zy-btn-ghost" style={{ padding: "9px 12px", textDecoration: "none", fontSize: 13 }}>
                    <Edit size={14} />
                  </Link>
                  <button onClick={() => handleDelete(quiz.id)} className="zy-btn-ghost" style={{ padding: "9px 12px", color: "var(--red)" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
