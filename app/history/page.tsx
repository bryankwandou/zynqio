"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useBahasa } from "@/lib/bahasa";
import Link from "next/link";
import { Loader2, User, FileQuestion, Search, Pencil } from "lucide-react";

interface Sesi {
  sessionId: string;
  roomCode: string;
  title: string;
  category: string | null;
  date: string;
  totalPlayers: number;
  accuracy: number;
  totalAnswers: number;
  topName: string | null;
  topScore: number;
}

interface Kuis {
  id: string;
  title: string;
  questionCount: number;
}

interface Rekomendasi {
  id: string;
  hostId: string;
  title: string;
  author?: string;
}

/**
 * Grafik ketepatan tiap sesi.
 *
 * Versi sebelumnya hanya deretan div dengan atribut title, yang tidak
 * pernah dibacakan pembaca layar dan tidak pernah muncul di perangkat
 * sentuh. Angkanya kini juga tersedia sebagai tabel yang disembunyikan
 * secara visual, sehingga isinya tetap terbaca oleh siapa pun yang
 * tidak bisa melihat batangnya.
 */
function GrafikKetepatan({ sesi }: { sesi: Sesi[] }) {
  const { t } = useBahasa();
  const terakhir = sesi.slice(0, 15).reverse();
  if (terakhir.length === 0) return null;

  return (
    <div className="zy-panel" style={{ padding: "var(--sp-5)" }}>
      <h2 className="zy-label" style={{ marginBottom: "var(--sp-4)" }}>
        KETEPATAN {terakhir.length} SESI TERAKHIR
      </h2>

      <div
        aria-hidden="true"
        style={{ display: "flex", alignItems: "flex-end", gap: "var(--sp-1)", height: 88 }}
      >
        {terakhir.map((s) => (
          <div key={s.sessionId} style={{ flex: 1, display: "flex", alignItems: "flex-end", height: "100%" }}>
            <div
              style={{
                width: "100%",
                // Batang terpendek tetap enam piksel, supaya sesi dengan
                // ketepatan nol tetap terlihat sebagai sesi yang ada.
                height: `${Math.max(6, Math.round((s.accuracy / 100) * 88))}px`,
                borderRadius: "var(--r-sm) var(--r-sm) 0 0",
                background: "var(--p)",
                opacity: 0.35 + (s.accuracy / 100) * 0.65,
              }}
            />
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>{t("ketepatanTiapSesi")}</caption>
        <tbody>
          {terakhir.map((s) => (
            <tr key={s.sessionId}>
              <th scope="row">
                {s.title}, {new Date(s.date).toLocaleDateString("id-ID")}
              </th>
              <td>{s.accuracy} persen</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

function IsiRiwayat() {
  const { t } = useBahasa();
  const { data: session, status } = useSession();
  const router = useRouter();
  const paramCari = useSearchParams();

  // Tab awal diambil dari alamat, supaya "Riwayat" dan "Laporan"
  // di menu samping membuka bagian yang berbeda. Nilai yang tidak
  // dikenali jatuh ke "sesi" — alamat yang diketik tangan tidak
  // boleh membuat halamannya kosong.
  const tabAwal = paramCari.get("tab") === "kuis" ? "kuis" : "sesi";
  const [tab, setTab] = useState<"sesi" | "kuis">(tabAwal);
  const [sesi, setSesi] = useState<Sesi[]>([]);
  const [kuis, setKuis] = useState<Kuis[]>([]);
  const [rekomendasi, setRekomendasi] = useState<Rekomendasi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/player/history").then((r) => (r.ok ? r.json() : { sessions: [] })),
      fetch("/api/quiz/recommend").then((r) => (r.ok ? r.json() : { quizzes: [] })),
      fetch("/api/quiz/list").then((r) => (r.ok ? r.json() : { quizzes: [] })),
    ])
      .then(([hist, rec, milik]) => {
        setSesi(hist.sessions ?? []);
        setRekomendasi(rec.quizzes ?? []);
        setKuis(milik.quizzes ?? []);
      })
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--p)" }} aria-label={t("memuat")} />
      </div>
    );
  }

  if (!session) return null;

  const rataKetepatan = sesi.length
    ? Math.round(sesi.reduce((s, h) => s + h.accuracy, 0) / sesi.length)
    : 0;
  const totalPeserta = sesi.reduce((s, h) => s + h.totalPlayers, 0);

  // questionCount, bukan questions.length. Versi sebelumnya membaca
  // q.questions?.length pada data yang tidak pernah membawa larik itu,
  // sehingga setiap kuis selalu tertulis nol soal dan kartu ringkasan
  // selalu menunjukkan angka nol.
  const totalSoal = kuis.reduce((s, q) => s + (q.questionCount || 0), 0);

  return (
    <AppShell>
      <div style={{ marginBottom: "var(--sp-5)" }}>
        <h1 className="zy-h1">{t("navRiwayat")}</h1>
        <p className="zy-muted" style={{ marginTop: "var(--sp-1)" }}>
          {t("riwayatKet")}
        </p>
      </div>

      {/*
        Tab diberi peran yang benar supaya pembaca layar mengumumkan
        mana yang sedang terpilih. Sebelumnya keduanya hanya tombol
        biasa yang dibedakan garis bawah — tidak terbaca sama sekali
        oleh siapa pun yang tidak melihat garis itu.
      */}
      <div
        role="tablist"
        aria-label={t("bagianRiwayat")}
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-raw)",
          marginBottom: "var(--sp-5)",
        }}
      >
        {(
          [
            ["sesi", t("tabSesi")],
            ["kuis", t("navKuisSaya")],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            onClick={() => setTab(k)}
            className="zy-motion"
            style={{
              padding: "var(--sp-3) var(--sp-5)",
              fontSize: "var(--fs-sm)",
              fontWeight: tab === k ? "var(--fw-medium)" : "var(--fw-normal)",
              color: tab === k ? "var(--t1)" : "var(--t3)",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === k ? "var(--p)" : "transparent"}`,
              marginBottom: -1,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/*
        Dua kolom di layar lebar, satu kolom di ponsel.

        Versi sebelumnya memakai gridTemplateColumns tetap "1fr 280px"
        dengan kelas .history-grid yang aturan CSS-nya tidak pernah
        ditulis di mana pun. Sisi kanan selebar 280 piksel tetap memaksa
        dirinya masuk di layar selebar 360 piksel dan menghimpit kolom
        utama sampai judul kuis hampir tidak terbaca.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]" style={{ gap: "var(--sp-5)" }}>
        <div className="zy-stack">
          {tab === "sesi" && (
            <div id="panel-sesi" role="tabpanel" aria-labelledby="tab-sesi" className="zy-stack zy-berurut">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "var(--sp-3)",
                }}
              >
                <Ringkasan label="Sesi selesai" value={sesi.length} />
                <Ringkasan label="Rata ketepatan" value={`${rataKetepatan}%`} />
                <Ringkasan label="Peserta terlayani" value={totalPeserta} />
              </div>

              <GrafikKetepatan sesi={sesi} />

              <div className="zy-panel" style={{ overflow: "hidden" }}>
                <div
                  className="zy-row-between"
                  style={{ padding: "var(--sp-4) var(--sp-5)", borderBottom: "1px solid var(--border-raw)" }}
                >
                  <h2 className="zy-h3" style={{ fontSize: "var(--fs-base)" }}>
                    {t("sesiTerakhir")}
                  </h2>
                  <span className="zy-label zy-num">{sesi.length} tercatat</span>
                </div>

                {sesi.length === 0 ? (
                  <p className="zy-body" style={{ padding: "var(--sp-7) var(--sp-5)", textAlign: "center" }}>
                    {t("belumAdaSesi")}
                  </p>
                ) : (
                  sesi.map((h, i) => (
                    <div
                      key={h.sessionId}
                      className="zy-row"
                      style={{
                        gap: "var(--sp-4)",
                        padding: "var(--sp-4) var(--sp-5)",
                        borderBottom: i < sesi.length - 1 ? "1px solid var(--border-raw)" : "none",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "var(--fs-sm)",
                            fontWeight: "var(--fw-medium)",
                            color: "var(--t1)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h.title}
                        </div>
                        <div className="zy-label zy-num" style={{ marginTop: "var(--sp-1)" }}>
                          {new Date(h.date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {h.totalPlayers > 0 ? ` · ${h.totalPlayers} peserta` : ""}
                          {h.topName ? ` · teratas ${h.topName}` : ""}
                        </div>
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div
                          className="zy-num"
                          style={{
                            fontSize: "var(--fs-base)",
                            fontWeight: "var(--fw-bold)",
                            color: "var(--t1)",
                          }}
                        >
                          {h.accuracy}%
                        </div>
                        <div className="zy-label">{t("ketepatanKelasKecil")}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "kuis" && (
            <div id="panel-kuis" role="tabpanel" aria-labelledby="tab-kuis" className="zy-stack zy-berurut">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "var(--sp-3)",
                }}
              >
                <Ringkasan label={t("ringkasKuis")} value={kuis.length} />
                <Ringkasan label={t("ringkasSoal")} value={totalSoal} />
              </div>

              <div className="zy-panel" style={{ overflow: "hidden" }}>
                <div style={{ padding: "var(--sp-4) var(--sp-5)", borderBottom: "1px solid var(--border-raw)" }}>
                  <h2 className="zy-h3" style={{ fontSize: "var(--fs-base)" }}>
                    {t("koleksiKuis")}
                  </h2>
                </div>

                {kuis.length === 0 ? (
                  <p className="zy-body" style={{ padding: "var(--sp-7) var(--sp-5)", textAlign: "center" }}>
                    {t("belumAdaKuisTitik")}{" "}
                    <Link href="/create" style={{ color: "var(--p2)", fontWeight: "var(--fw-medium)" }}>
                      {t("susunYangPertama")}
                    </Link>
                  </p>
                ) : (
                  kuis.map((q, i) => (
                    <div
                      key={q.id}
                      className="zy-row"
                      style={{
                        gap: "var(--sp-4)",
                        padding: "var(--sp-4) var(--sp-5)",
                        borderBottom: i < kuis.length - 1 ? "1px solid var(--border-raw)" : "none",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "var(--fs-sm)",
                            fontWeight: "var(--fw-medium)",
                            color: "var(--t1)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {q.title}
                        </div>
                        <div
                          className="zy-label zy-row zy-num"
                          style={{ gap: "var(--sp-1)", marginTop: "var(--sp-1)" }}
                        >
                          <FileQuestion size={12} aria-hidden="true" /> {q.questionCount} soal
                        </div>
                      </div>

                      <Link
                        href={`/create?quizId=${encodeURIComponent(q.id)}`}
                        className="zy-btn zy-btn-secondary"
                        aria-label={`Ubah kuis ${q.title}`}
                        style={{ padding: "var(--sp-2) var(--sp-3)" }}
                      >
                        <Pencil size={13} aria-hidden="true" />
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <aside>
          <div className="zy-panel" style={{ padding: "var(--sp-5)", position: "sticky", top: "var(--sp-6)" }}>
            <h2 className="zy-label" style={{ marginBottom: "var(--sp-4)" }}>
              {t("kuisMungkinCocok")}
            </h2>

            {rekomendasi.length === 0 ? (
              <p className="zy-muted">{t("belumAdaSaran")}</p>
            ) : (
              <div className="zy-stack-sm">
                {rekomendasi.slice(0, 6).map((rec) => (
                  <Link
                    key={rec.id}
                    href={`/quiz/${rec.hostId}/${rec.id}`}
                    className="zy-motion"
                    style={{
                      display: "block",
                      padding: "var(--sp-3)",
                      borderRadius: "var(--r-md)",
                      background: "var(--bg3-raw)",
                      border: "1px solid var(--border-raw)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "var(--fs-sm)",
                        fontWeight: "var(--fw-medium)",
                        color: "var(--t1)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {rec.title}
                    </div>
                    <div
                      className="zy-label zy-row"
                      style={{ gap: "var(--sp-1)", marginTop: "var(--sp-1)" }}
                    >
                      <User size={11} aria-hidden="true" /> {rec.author ?? "Anonim"}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <Link
              href="/explore"
              className="zy-btn zy-btn-quiet"
              style={{ width: "100%", marginTop: "var(--sp-4)" }}
            >
              <Search size={13} aria-hidden="true" /> Jelajahi katalog
            </Link>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

/*
  useSearchParams memaksa halaman ini dirender di peramban. Next 16
  menolak membangun halaman semacam itu bila tidak dibungkus batas
  Suspense — tanpa pembungkus ini, seluruh halaman gagal dibangun,
  bukan hanya bagian yang membaca alamat.

  Cadangannya sengaja dibuat menyerupai kerangka halaman, bukan layar
  kosong, supaya jeda sepersekian detik itu tidak terbaca seperti
  aplikasi yang mati.
*/
export default function HistoryPage() {
  const { t } = useBahasa();
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="zy-stack" style={{ alignItems: "center", padding: "var(--sp-7) 0", gap: "var(--sp-3)" }}>
            <Loader2 size={22} className="animate-spin" style={{ color: "var(--p)" }} aria-hidden="true" />
            <p className="zy-muted" role="status">{t("memuatRiwayat")}</p>
          </div>
        </AppShell>
      }
    >
      <IsiRiwayat />
    </Suspense>
  );
}
