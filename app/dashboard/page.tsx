"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useBahasa } from "@/lib/bahasa";
import { Plus, Play, Edit, Trash2, Loader2, BookOpen } from "lucide-react";

interface Quiz {
  id: string;
  title: string;
  questionCount: number;
  status?: string;
  createdAt: string;
}

/**
 * Kartu ringkasan.
 *
 * Warnanya sengaja satu untuk semua. Versi sebelumnya memberi tiap
 * kartu warna aksen sendiri — ungu, sian, hijau, jingga — sehingga
 * tidak ada yang menonjol dan tidak ada yang bisa dibaca sebagai lebih
 * penting. Warna sebanyak itu tanpa urutan justru membuat mata tidak
 * tahu harus berhenti di mana.
 */
function Ringkasan({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="zy-panel" style={{ padding: "var(--sp-5)" }}>
      <div className="zy-label" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div
        className="zy-num"
        style={{
          fontSize: "var(--fs-2xl)",
          fontWeight: "var(--fw-bold)",
          letterSpacing: "-0.02em",
          color: "var(--t1)",
          marginTop: "var(--sp-2)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useBahasa();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [menghapus, setMenghapus] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/quiz/list")
      .then((r) => (r.ok ? r.json() : { quizzes: [] }))
      .then((data) => setQuizzes(data.quizzes ?? []))
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

  const handleDelete = async (quizId: string, judul: string) => {
    // Judulnya disebut dalam pertanyaan. "Hapus kuis ini?" tidak
    // menolong siapa pun yang punya belasan kuis dengan nama mirip.
    if (!confirm(t("konfirmasiHapus").replace("{judul}", judul))) {
      return;
    }
    setMenghapus(quizId);
    const res = await fetch("/api/quiz/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId }),
    });
    if (res.ok) setQuizzes((p) => p.filter((q) => q.id !== quizId));
    setMenghapus(null);
  };

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--p)" }} aria-label={t("memuat")} />
      </div>
    );
  }

  if (!session) return null;

  const totalSoal = quizzes.reduce((s, q) => s + (q.questionCount || 0), 0);
  const jumlahPublik = quizzes.filter((q) => q.status !== "private").length;

  return (
    <AppShell>
      <div className="zy-row-between zy-naik" style={{ alignItems: "flex-end", marginBottom: "var(--sp-6)", flexWrap: "wrap" }}>
        <div>
          <h1 className="zy-h1">{t("navKuisSaya")}</h1>
          <p className="zy-muted" style={{ marginTop: "var(--sp-1)" }}>
            {t("selamatDatang").replace("{nama}", session.user?.name?.split(" ")[0] || t("pengajar"))}
          </p>
        </div>
        <Link href="/create" className="zy-btn zy-btn-primary">
          <Plus size={16} aria-hidden="true" /> {t("kuisBaru")}
        </Link>
      </div>

      {/*
        Tiga angka, bukan empat. Kartu "Total plays" dulu selalu
        menampilkan tanda hubung karena datanya memang belum pernah
        dihitung — kotak yang tidak pernah berisi apa pun hanya
        menambah yang harus dilewati mata.
      */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "var(--sp-3)",
          marginBottom: "var(--sp-6)",
        }}
      >
        <Ringkasan label={t("ringkasKuis")} value={quizzes.length} />
        <Ringkasan label={t("ringkasSoal")} value={totalSoal} />
        <Ringkasan label={t("ringkasPublik")} value={jumlahPublik} />
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--sp-3)" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="zy-panel"
              style={{ height: 176, animation: "pulse 1.5s infinite" }}
              aria-hidden="true"
            />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div
          className="zy-stack"
          style={{
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--sp-8) var(--sp-5)",
            border: "1.5px dashed var(--border-raw)",
            borderRadius: "var(--r-lg)",
            textAlign: "center",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: 56,
              height: 56,
              borderRadius: "var(--r-lg)",
              background: "var(--bg3-raw)",
              color: "var(--t3)",
            }}
          >
            <BookOpen size={24} />
          </span>
          <div>
            <h2 className="zy-h3">{t("belumAdaKuis")}</h2>
            <p className="zy-body zy-prose" style={{ marginTop: "var(--sp-2)", maxWidth: "36ch" }}>
              {t("belumAdaKuisKet")}
            </p>
          </div>
          <div className="zy-row">
            <Link href="/create" className="zy-btn zy-btn-primary">
              <Plus size={15} aria-hidden="true" /> {t("navSusunKuis")}
            </Link>
            <Link href="/explore" className="zy-btn zy-btn-secondary">
              {t("lihatKatalog")}
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--sp-3)" }}>
          {quizzes.map((quiz) => {
            const publik = quiz.status !== "private";
            return (
              <div
                key={quiz.id}
                className="zy-panel-interactive zy-angkat"
                style={{ padding: "var(--sp-5)", display: "flex", flexDirection: "column" }}
              >
                <div className="zy-row-between" style={{ alignItems: "flex-start", marginBottom: "var(--sp-3)" }}>
                  <span className="zy-badge">{publik ? t("badgeUmum") : t("badgePribadi")}</span>
                  <span className="zy-label zy-num">
                    {new Date(quiz.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  </span>
                </div>

                <h2
                  className="zy-h3"
                  style={{
                    marginBottom: "var(--sp-1)",
                    // Judul panjang dipotong dua baris, bukan satu.
                    // Satu baris memotong terlalu dini pada judul
                    // seperti "Sejarah Indonesia: Dari Kerajaan…".
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {quiz.title}
                </h2>

                <p className="zy-label zy-num" style={{ marginBottom: "var(--sp-4)" }}>
                  {quiz.questionCount} {t("satuanSoal")}
                </p>

                <div className="zy-row" style={{ marginTop: "auto", gap: "var(--sp-2)" }}>
                  <button onClick={() => handleHost(quiz.id)} className="zy-btn zy-btn-primary" style={{ flex: 1 }}>
                    <Play size={14} aria-hidden="true" /> {t("mulai")}
                  </button>

                  {/* Tombol berikut hanya berisi ikon, jadi namanya
                      harus dititipkan lewat aria-label — tanpa itu
                      pembaca layar hanya menyebutnya "tombol". */}
                  <Link
                    href={`/create?quizId=${encodeURIComponent(quiz.id)}`}
                    className="zy-btn zy-btn-secondary"
                    aria-label={t("ubahKuis").replace("{judul}", quiz.title)}
                    style={{ padding: "var(--sp-3)" }}
                  >
                    <Edit size={14} aria-hidden="true" />
                  </Link>

                  <button
                    onClick={() => handleDelete(quiz.id, quiz.title)}
                    disabled={menghapus === quiz.id}
                    className="zy-btn zy-btn-danger"
                    aria-label={t("hapusKuis").replace("{judul}", quiz.title)}
                    style={{ padding: "var(--sp-3)" }}
                  >
                    {menghapus === quiz.id ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 size={14} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
