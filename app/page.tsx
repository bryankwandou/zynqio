"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, ArrowRight, Loader2, Compass } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useBahasa, TombolBahasa } from "@/lib/bahasa";

/**
 * Ragam permainan.
 *
 * Keterangannya menyebut aturan yang berlaku, bukan janji suasana.
 * "Grab treasure chests" tidak memberi tahu guru apa pun tentang cara
 * skor dihitung; "peti berisi poin muncul di sela soal" memberi tahu.
 */
const RAGAM = [
  { nama: "klasik",    ket: "klasikKet" },
  { nama: "aduCepat",  ket: "aduCepatKet" },
  { nama: "buruHarta", ket: "buruHartaKet" },
  { nama: "sisaSatu",  ket: "sisaSatuKet" },
  { nama: "beregu",    ket: "bereguKet" },
  { nama: "bertahan",  ket: "bertahanKet" },
] as const;

/**
 * Angka yang menghitung naik saat pertama terlihat.
 *
 * Hitungannya berjalan sekali, saat bagian itu benar-benar masuk ke
 * layar — bukan saat halaman dimuat. Angka yang sudah selesai berhitung
 * sebelum orang menggulung ke sana hanya membuang gerak.
 *
 * IntersectionObserver dipakai supaya tidak ada penghitung yang jalan
 * di belakang layar. Kalau peramban tidak punya IntersectionObserver
 * (sangat jarang, tapi mungkin di mesin sekolah yang tua), angkanya
 * langsung ditampilkan penuh — tidak ada yang hilang, hanya geraknya.
 */
function AngkaNaik({ target, durasi = 1200 }: { target: number; durasi?: number }) {
  const [nilai, setNilai] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const sudahJalan = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Orang yang meminta gerak dikurangi langsung diberi angka akhirnya.
    const kurangiGerak = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (kurangiGerak || typeof IntersectionObserver === "undefined") {
      setNilai(target);
      return;
    }

    const mulai = () => {
      if (sudahJalan.current) return;
      sudahJalan.current = true;
      const t0 = performance.now();

      const langkah = (t: number) => {
        const p = Math.min(1, (t - t0) / durasi);
        // Melambat di ujung, seperti sesuatu yang berhenti karena
        // gesekan. Laju rata terbaca seperti mesin, bukan seperti
        // hitungan yang selesai.
        const halus = 1 - Math.pow(1 - p, 3);
        setNilai(Math.round(target * halus));
        if (p < 1) requestAnimationFrame(langkah);
      };
      requestAnimationFrame(langkah);
    };

    const pengamat = new IntersectionObserver(
      (entri) => entri.forEach((e) => e.isIntersecting && mulai()),
      { threshold: 0.4 }
    );
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [target, durasi]);

  return <span ref={ref}>{nilai}</span>;
}

export default function Home() {
  const [roomCode, setRoomCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useBahasa();

  // Angka isi produk diambil dari basis data. Sebelumnya ketiganya
  // ditulis mati (520 soal, 20 kuis) dan dua di antaranya sudah
  // keliru — isinya 558 soal dan 26 kuis — serta akan makin keliru
  // tiap kali seseorang menambah kuis.
  const [angka, setAngka] = useState<{ soal: number; kuis: number; mapel: number; ragam: number } | null>(null);
  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAngka(d))
      .catch(() => {});
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) return;

    setJoinError("");
    setIsJoining(true);

    try {
      const res = await fetch(`/api/room/state?roomCode=${code}`);
      if (res.status === 404) {
        setJoinError(t("ruangTakAda"));
        setIsJoining(false);
        return;
      }
      if (!res.ok) {
        setJoinError(t("ruangGagalPeriksa"));
        setIsJoining(false);
        return;
      }
      const data = await res.json();
      if (data.status === "ended") {
        setJoinError(t("ruangSelesai"));
        setIsJoining(false);
        return;
      }
      if (data.status === "playing") {
        setJoinError(t("ruangSudahMulai"));
        setIsJoining(false);
        return;
      }
      router.push(`/join/${code}`);
    } catch {
      setJoinError(t("sambunganBermasalah"));
      setIsJoining(false);
    }
  };

  const kodeLengkap = roomCode.length === 6;

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflowX: "hidden" }}>
      {/*
        Dua bidang warna yang bernapas pelan di belakang halaman.

        Halaman ini sebelumnya latar rata gelap dari atas sampai bawah,
        dan itulah yang membuatnya terbaca kosong: tidak ada apa pun
        yang memberi tahu mata bahwa halamannya hidup. Napas delapan
        belas detik terlalu lambat untuk ditangkap sebagai animasi —
        yang terasa hanya bahwa layarnya tidak beku.
      */}
      <div
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}
      >
        <div
          className="zy-napas"
          style={{
            position: "absolute",
            top: "-18%",
            left: "50%",
            width: "min(900px, 120vw)",
            height: "min(900px, 120vw)",
            marginLeft: "min(-450px, -60vw)",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(109,94,252,0.20), transparent 66%)",
            filter: "blur(30px)",
          }}
        />
        <div
          className="zy-napas"
          style={{
            position: "absolute",
            bottom: "-24%",
            right: "-14%",
            width: "min(680px, 96vw)",
            height: "min(680px, 96vw)",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.14), transparent 68%)",
            filter: "blur(34px)",
            animationDelay: "-9s",
          }}
        />
      </div>

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          padding: "var(--sp-3) var(--sp-5)",
          background: "var(--nav-bg)",
          WebkitBackdropFilter: "blur(20px)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-raw)",
        }}
      >
        <div className="zy-row-between" style={{ maxWidth: 1120, margin: "0 auto" }}>
          <span className="zy-row" style={{ gap: "var(--sp-2)" }}>
            <Logo size={30} />
            <span
              style={{
                fontSize: "var(--fs-lg)",
                fontWeight: "var(--fw-bold)",
                letterSpacing: "0.03em",
                color: "var(--t1)",
              }}
            >
              ZYNQIO
            </span>
          </span>

          <span className="zy-row" style={{ gap: "var(--sp-1)" }}>
            <Link href="/explore" className="zy-btn zy-btn-quiet" aria-label={t("jelajahiKuis")}>
              <Compass size={16} aria-hidden="true" />
              <span className="zy-sempit-sembunyi">{t("jelajahi")}</span>
            </Link>
            <TombolBahasa />
            <button
              className="zy-btn zy-btn-quiet"
              style={{ padding: "var(--sp-2)" }}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? t("keTerang") : t("keGelap")}
            >
              {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            </button>
            <Link href="/auth/signin" className="zy-btn zy-btn-quiet">
              {t("masuk")}
            </Link>
            <Link href="/auth/signup" className="zy-btn zy-btn-primary">
              {t("daftar")}
            </Link>
          </span>
        </div>
      </header>

      {/*
        Bagian pembuka.

        Yang paling sering dilakukan orang di halaman ini adalah
        memasukkan kode ruangan dari layar di depan kelas — bukan
        membaca ajakan. Karena itu kolom kodenya diletakkan tinggi dan
        diberi ukuran besar, dan sisanya menyusul di bawahnya.

        Isinya masuk berurutan dari atas: judul, penjelasan, kolom kode.
        Urutan itu sama dengan urutan bacanya, jadi geraknya menuntun
        mata alih-alih sekadar menghias.
      */}
      <section
        className="zy-berurut"
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "var(--sp-7) var(--sp-5) var(--sp-6)",
          textAlign: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          className="zy-row"
          style={{
            justifyContent: "center",
            gap: "var(--sp-2)",
            marginBottom: "var(--sp-4)",
          }}
        >
          <span
            className="zy-badge zy-row"
            style={{ gap: "var(--sp-2)", padding: "var(--sp-2) var(--sp-4)" }}
          >
            <span
              className="zy-denyut"
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: "var(--r-full)",
                background: "var(--green)",
                display: "inline-block",
              }}
            />
            {angka ? angka.soal + " " + t("soalSiap") : t("soalSiap")}
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(2.25rem, 6vw, 4rem)",
            fontWeight: "var(--fw-bold)",
            lineHeight: "var(--lh-tight)",
            letterSpacing: "-0.03em",
            color: "var(--t1)",
            textWrap: "balance",
          }}
        >
          {t("judulUtama")}
        </h1>

        <p
          className="zy-prose"
          style={{
            fontSize: "var(--fs-base)",
            color: "var(--t2)",
            marginTop: "var(--sp-4)",
            marginInline: "auto",
            lineHeight: "var(--lh-relaxed)",
          }}
        >
          {t("penjelasan")}
        </p>

        {/*
          Kolom kode menyala saat difokus dan saat enam karakternya
          lengkap. Nyala kedua itu memberi tahu bahwa kodenya sudah utuh
          tanpa perlu menghitung karakter satu per satu.
        */}
        <form
          onSubmit={handleJoin}
          className="zy-motion"
          style={{
            marginTop: "var(--sp-6)",
            display: "flex",
            gap: "var(--sp-2)",
            maxWidth: 440,
            marginInline: "auto",
            padding: "var(--sp-2)",
            background: "var(--bg2-raw)",
            border: `1px solid ${kodeLengkap ? "var(--p)" : "var(--border-raw)"}`,
            borderRadius: "var(--r-lg)",
            boxShadow: kodeLengkap ? "0 0 0 4px rgba(109,94,252,0.14)" : "none",
            transition:
              "border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)",
          }}
        >
          <label htmlFor="kode" className="sr-only">
            {t("labelKode")}
          </label>
          <input
            id="kode"
            value={roomCode}
            onChange={(e) => {
              setRoomCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
              setJoinError("");
            }}
            placeholder={t("kodeRuangan")}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            aria-describedby={joinError ? "galat-gabung" : undefined}
            aria-invalid={joinError ? true : undefined}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "var(--sp-4)",
              fontSize: "var(--fs-xl)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "0.2em",
              background: "transparent",
              border: "none",
              color: "var(--t1)",
              fontFamily: "var(--font-space-mono)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!kodeLengkap || isJoining}
            className={`zy-btn zy-btn-primary zy-btn-lg${kodeLengkap && !isJoining ? " zy-sapu" : ""}`}
          >
            {isJoining ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <>
                {t("gabung")} <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        {/*
          Galat diumumkan pembaca layar tanpa menunggu fokus berpindah.
          Tanpa role="alert", orang yang memakai pembaca layar menekan
          Gabung lalu tidak mendengar apa-apa sama sekali.
        */}
        {joinError && (
          <p
            id="galat-gabung"
            role="alert"
            className="zy-naik"
            style={{
              color: "var(--red)",
              fontSize: "var(--fs-sm)",
              fontWeight: "var(--fw-medium)",
              marginTop: "var(--sp-3)",
            }}
          >
            {joinError}
          </p>
        )}

        <p className="zy-muted" style={{ marginTop: "var(--sp-4)" }}>
          {t("tanpaAkun")}{" "}
          <Link
            href="/auth/signup"
            className="zy-garis"
            style={{ color: "var(--p2)", fontWeight: "var(--fw-medium)" }}
          >
            {t("buatAkun")}
          </Link>
        </p>
      </section>

      {/*
        Angka nyata, bukan janji.

        Ketiganya diambil dari isi basis data yang sebenarnya, dan
        berhitung naik saat bagian ini masuk layar — gerak yang
        menerangkan bahwa angkanya hasil hitungan, bukan hiasan.
      */}
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "0 var(--sp-5) var(--sp-7)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          className="zy-panel"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            padding: "var(--sp-5)",
            gap: "var(--sp-4)",
            textAlign: "center",
          }}
        >
          {[
            { angka: angka?.soal ?? 0, label: t("soalSiapPakai") },
            { angka: angka?.kuis ?? 0, label: t("kuisMapel") },
            { angka: angka?.ragam ?? 6, label: t("ragamPermainan") },
          ].map((s) => (
            <div key={s.label}>
              <div
                className="zy-num"
                style={{
                  fontSize: "var(--fs-2xl)",
                  fontWeight: "var(--fw-bold)",
                  color: "var(--t1)",
                  lineHeight: 1,
                }}
              >
                <AngkaNaik target={s.angka} />
              </div>
              <div className="zy-label" style={{ marginTop: "var(--sp-2)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 var(--sp-5) var(--sp-8)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h2 className="zy-h2" style={{ marginBottom: "var(--sp-5)" }}>
          {t("enamCara")}
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--sp-3)",
          }}
        >
          {RAGAM.map((m) => (
            <div
              key={m.nama}
              className="zy-panel zy-angkat"
              style={{ padding: "var(--sp-5)" }}
            >
              <h3 className="zy-h3" style={{ fontSize: "var(--fs-base)" }}>
                {t(m.nama)}
              </h3>
              <p className="zy-muted" style={{ marginTop: "var(--sp-2)" }}>
                {t(m.ket)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer
        style={{
          borderTop: "1px solid var(--border-raw)",
          padding: "var(--sp-6) var(--sp-5)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          className="zy-row-between"
          style={{ maxWidth: 1120, margin: "0 auto", flexWrap: "wrap", gap: "var(--sp-4)" }}
        >
          <span className="zy-row" style={{ gap: "var(--sp-2)" }}>
            <Logo size={22} />
            <span className="zy-label">ZYNQIO</span>
          </span>
          <span className="zy-row" style={{ gap: "var(--sp-5)" }}>
            <Link href="/explore" className="zy-label zy-garis">
              {t("jelajahiKuis")}
            </Link>
            <Link href="/auth/signin" className="zy-label zy-garis">
              {t("masuk")}
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
