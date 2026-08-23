"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Search, Play, Star, User, FileQuestion } from "lucide-react";
import Link from "next/link";
import { SampulKuis } from "@/components/SampulKuis";

/**
 * Kategori yang bisa disaring.
 *
 * Daftarnya harus sama persis dengan nilai kolom category di basis
 * data. Versi sebelumnya berisi "Math", "Science", "History" dan
 * seterusnya dalam bahasa Inggris, sementara seluruh isi katalog
 * berkategori Indonesia — sehingga menekan chip mana pun selalu
 * menghasilkan daftar kosong, dan tidak ada pesan galat yang muncul
 * karena secara teknis tidak ada yang gagal.
 */
const KATEGORI = [
  "Matematika",
  "Fisika",
  "Kimia",
  "Biologi",
  "Sains",
  "Sejarah",
  "Geografi",
  "PPKn",
  "Ekonomi",
  "Bahasa Indonesia",
  "Bahasa Inggris",
  "Teknologi",
  "Seni Budaya",
  "Olahraga",
  "Karakter",
  "Umum",
];

interface Quiz {
  id: string;
  hostId: string;
  title: string;
  author?: string;
  category?: string;
  questionCount?: number;
  rating?: number;
}

export default function ExplorePage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append("q", search);
    if (category) params.append("category", category);

    // Ditunda sebentar supaya tiap ketukan papan ketik tidak menjadi
    // satu permintaan tersendiri ke peladen.
    const timeout = setTimeout(() => {
      fetch(`/api/quiz/explore?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setQuizzes(Array.isArray(data) ? data : (data.quizzes ?? [])))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, category]);

  const adaSaringan = Boolean(search || category);

  return (
    <AppShell>
      <div style={{ marginBottom: "var(--sp-5)" }}>
        <h1 className="zy-h1">Jelajahi</h1>
        <p className="zy-muted" style={{ marginTop: "var(--sp-1)" }}>
          Kuis siap pakai yang bisa langsung dibawakan atau disalin lalu diubah
        </p>
      </div>

      <div style={{ position: "relative", marginBottom: "var(--sp-4)" }}>
        <label htmlFor="cari" className="sr-only">
          Cari kuis
        </label>
        <Search
          size={16}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "var(--sp-4)",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--t3)",
            pointerEvents: "none",
          }}
        />
        <input
          id="cari"
          type="search"
          placeholder="Cari judul kuis"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="zy-input"
          style={{ paddingLeft: "var(--sp-8)" }}
        />
      </div>

      {/*
        Chip penyaring. Kelompoknya diberi label supaya pembaca layar
        menyebutkannya sebagai satu himpunan pilihan, bukan deretan
        tombol lepas tanpa hubungan.
      */}
      <div
        role="group"
        aria-label="Saring menurut mata pelajaran"
        className="zy-row"
        style={{ flexWrap: "wrap", gap: "var(--sp-2)", marginBottom: "var(--sp-5)" }}
      >
        <button
          onClick={() => setCategory("")}
          aria-pressed={!category}
          className="zy-motion"
          style={chipStyle(!category)}
        >
          Semua
        </button>
        {KATEGORI.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(category === cat ? "" : cat)}
            aria-pressed={category === cat}
            className="zy-motion"
            style={chipStyle(category === cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--sp-3)" }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="zy-panel" style={{ height: 168, animation: "pulse 1.5s infinite" }} aria-hidden="true" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div
          className="zy-stack"
          style={{
            alignItems: "center",
            padding: "var(--sp-8) var(--sp-5)",
            border: "1.5px dashed var(--border-raw)",
            borderRadius: "var(--r-lg)",
            textAlign: "center",
          }}
        >
          <h2 className="zy-h3">Tidak ada yang cocok</h2>
          <p className="zy-body" style={{ maxWidth: "40ch" }}>
            {adaSaringan
              ? "Coba kata kunci lain, atau lepas saringan mata pelajarannya."
              : "Katalog umum masih kosong."}
          </p>
          {adaSaringan && (
            <button
              onClick={() => {
                setSearch("");
                setCategory("");
              }}
              className="zy-btn zy-btn-secondary"
            >
              Tampilkan semua
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--sp-3)" }}>
          {quizzes.map((quiz) => (
            <article
              key={quiz.id}
              className="zy-panel-interactive zy-angkat"
              style={{ padding: "var(--sp-5)", display: "flex", flexDirection: "column" }}
            >
              {/*
                Sampul emoji setinggi 120 piksel dulu ada di sini dan
                dibuang karena mendorong judul turun ke bawah lipatan
                layar. Penggantinya 64 piksel dan rupanya diturunkan
                dari mata pelajaran, jadi kartunya punya ciri tanpa
                mengusir isi yang dibaca orang saat memilih.
              */}
              <SampulKuis kategori={quiz.category ?? null} judul={quiz.title} />
              <div className="zy-row-between" style={{ alignItems: "flex-start", marginBottom: "var(--sp-3)" }}>
                <span className="zy-badge">{quiz.category ?? "Umum"}</span>
                {quiz.rating ? (
                  <span
                    className="zy-row zy-num"
                    style={{ gap: "var(--sp-1)", fontSize: "var(--fs-xs)", color: "var(--gold)", fontWeight: "var(--fw-medium)" }}
                  >
                    <Star size={12} fill="currentColor" aria-hidden="true" />
                    {quiz.rating}
                  </span>
                ) : (
                  <span className="zy-label">Baru</span>
                )}
              </div>

              <h2
                className="zy-h3"
                style={{
                  marginBottom: "var(--sp-3)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {quiz.title}
              </h2>

              <div className="zy-row" style={{ gap: "var(--sp-4)", marginBottom: "var(--sp-4)" }}>
                <span className="zy-label zy-row" style={{ gap: "var(--sp-1)" }}>
                  <User size={12} aria-hidden="true" /> {quiz.author ?? "Anonim"}
                </span>
                <span className="zy-label zy-row zy-num" style={{ gap: "var(--sp-1)" }}>
                  <FileQuestion size={12} aria-hidden="true" /> {quiz.questionCount ?? 0} soal
                </span>
              </div>

              <Link
                href={`/quiz/${quiz.hostId}/${quiz.id}`}
                className="zy-btn zy-btn-primary"
                style={{ marginTop: "auto" }}
                aria-label={`Buka kuis ${quiz.title}`}
              >
                <Play size={13} aria-hidden="true" /> Buka
              </Link>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function chipStyle(aktif: boolean): React.CSSProperties {
  return {
    padding: "var(--sp-2) var(--sp-4)",
    borderRadius: "var(--r-full)",
    fontSize: "var(--fs-xs)",
    fontWeight: "var(--fw-medium)",
    cursor: "pointer",
    background: aktif ? "var(--p)" : "var(--bg2-raw)",
    color: aktif ? "#fff" : "var(--t2)",
    border: `1px solid ${aktif ? "var(--p)" : "var(--border-raw)"}`,
  };
}
