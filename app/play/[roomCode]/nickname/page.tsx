"use client";

import { useBahasa } from "@/lib/bahasa";
import { useState, use, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { AVATARS, getAvatar } from "@/lib/avatars";
import { saveSession, readSession, clearSession, verifySession } from "@/lib/player-session";

export default function NicknamePage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { tt } = useBahasa();
  const router = useRouter();
  const unwrappedParams = use(params);
  const roomCode = unwrappedParams.roomCode.toUpperCase();

  const [nickname, setNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[Math.floor(Math.random() * AVATARS.length)].id);
  const [isLoading, setIsLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Menyambung kembali peserta yang sudah pernah bergabung di ruangan ini.
  //
  // Keabsahan sesi ditanyakan ke server dengan menyodorkan token, bukan
  // dengan mencari token sendiri di dalam daftar peserta seperti dulu.
  // Daftar itu terbuka untuk siapa saja, jadi cara lama menuntut token
  // semua orang ikut terkirim ke semua orang.
  useEffect(() => {
    const session = readSession(roomCode);

    const focusInput = () => setTimeout(() => inputRef.current?.focus(), 50);

    if (!session) {
      focusInput();
      return;
    }

    let cancelled = false;

    verifySession(roomCode, session.token).then((player) => {
      if (cancelled) return;

      if (player) {
        setRedirecting(true);
        router.replace(`/play/${roomCode}/lobby`);
      } else {
        clearSession();
        focusInput();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [roomCode, router]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          playerName: nickname.trim(),
          avatarId: selectedAvatar,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Token peserta hanya muncul sekali, pada tanggapan ini. Yang
        // tersimpan di server adalah hash-nya, jadi tidak ada cara
        // mengambilnya kembali nanti.
        saveSession({
          token: data.playerToken,
          roomCode,
          name: data.player.name,
          id: data.player.id,
          avatarId: data.player.avatarId ?? selectedAvatar,
        });
        router.push(`/play/${roomCode}/lobby`);
      } else {
        setErrorMsg(data.error || "Gagal bergabung ke ruangan.");
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch {
      setErrorMsg("Sambungan terputus. Coba lagi.");
      setIsLoading(false);
    }
  };

  if (redirecting) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-raw)" }}>
        <div className="zy-stack" style={{ alignItems: "center", gap: "var(--sp-4)" }}>
          <Loader2 size={30} className="animate-spin" style={{ color: "var(--p)" }} aria-hidden="true" />
          <p className="zy-muted" role="status">{tt("Menyambungkan kembali ke ruangan…", "Reconnecting to the room…")}</p>
        </div>
      </div>
    );
  }

  const avatarTerpilih = getAvatar(selectedAvatar);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "var(--sp-5)",
        background: "var(--bg-raw)",
      }}
    >
      <div className="zy-berurut" style={{ width: "100%", maxWidth: 520 }}>
        {/*
          Kode ruangan diletakkan paling atas dan dibiarkan besar.
          Murid membacanya dari layar di depan kelas lalu mencocokkannya
          dengan yang di tangannya; kalau kodenya kecil, pencocokan itu
          jadi pekerjaan tersendiri di tengah kelas yang ramai.
        */}
        <div style={{ textAlign: "center", marginBottom: "var(--sp-5)" }}>
          <div className="zy-label">{tt("Kode ruangan", "Room code")}</div>
          <div
            className="zy-num"
            style={{
              fontSize: "var(--fs-2xl)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "0.18em",
              color: "var(--t1)",
              marginTop: "var(--sp-1)",
            }}
          >
            {roomCode}
          </div>
        </div>

        <div className="zy-panel" style={{ padding: "var(--sp-6)" }}>
          <h1 className="zy-h2" style={{ textAlign: "center" }}>
            {tt("Pilih avatar dan tulis nama", "Pick an avatar and type a name")}
          </h1>
          <p className="zy-muted" style={{ textAlign: "center", marginTop: "var(--sp-2)" }}>
            {tt("Nama ini yang muncul di papan peringkat", "This name appears on the leaderboard")}
          </p>

          {/*
            Pemilihan avatar adalah kelompok radio, bukan sekumpulan
            tombol lepas. Sebelumnya tiap avatar berupa <button> tanpa
            keterangan apa pun, sehingga pembaca layar hanya mengumumkan
            "tombol" sepuluh kali berturut-turut tanpa memberi tahu
            avatar mana yang sedang terpilih.
          */}
          <div
            role="radiogroup"
            aria-label={tt("Pilihan avatar", "Avatar options")}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "var(--sp-2)",
              marginTop: "var(--sp-5)",
            }}
          >
            {AVATARS.map((avatar) => {
              const terpilih = selectedAvatar === avatar.id;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  role="radio"
                  aria-checked={terpilih}
                  aria-label={avatar.id}
                  onClick={() => setSelectedAvatar(avatar.id)}
                  className="zy-motion"
                  style={{
                    display: "grid",
                    placeItems: "center",
                    aspectRatio: "1",
                    borderRadius: "var(--r-md)",
                    fontSize: "var(--fs-xl)",
                    background: terpilih ? "var(--p-soft)" : "var(--bg2-raw)",
                    // Terpilih ditandai tepi tebal DAN latar berbeda,
                    // bukan warna saja. Sekitar satu dari dua belas
                    // murid laki-laki sulit membedakan warna, dan
                    // pilihan yang hanya ditandai warna tidak terbaca
                    // oleh mereka.
                    border: terpilih
                      ? "2px solid var(--p)"
                      : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  {avatar.emoji}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleJoin} style={{ marginTop: "var(--sp-5)" }}>
            <label htmlFor="nama" className="zy-label" style={{ display: "block", marginBottom: "var(--sp-2)" }}>
              {tt("Nama panggilan", "Nickname")}
            </label>
            <input
              id="nama"
              ref={inputRef}
              type="text"
              placeholder={tt(`Nama kamu, mis. ${avatarTerpilih.id}`, `Your name, e.g. ${avatarTerpilih.id}`)}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={50}
              required
              autoComplete="off"
              aria-describedby={errorMsg ? "galat-gabung" : undefined}
              aria-invalid={errorMsg ? true : undefined}
              className="zy-input"
              style={{
                width: "100%",
                textAlign: "center",
                fontSize: "var(--fs-lg)",
                padding: "var(--sp-4)",
              }}
            />

            {errorMsg && (
              <p
                id="galat-gabung"
                role="alert"
                className="zy-naik"
                style={{
                  color: "var(--red)",
                  fontSize: "var(--fs-sm)",
                  fontWeight: "var(--fw-medium)",
                  textAlign: "center",
                  marginTop: "var(--sp-3)",
                }}
              >
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={!nickname.trim() || isLoading}
              className="zy-btn zy-btn-primary zy-btn-lg"
              style={{ width: "100%", marginTop: "var(--sp-5)", justifyContent: "center" }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  {tt("Menggabungkan…", "Joining…")}
                </>
              ) : (
                <>
                  {tt("Masuk ke permainan", "Enter the game")}
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
