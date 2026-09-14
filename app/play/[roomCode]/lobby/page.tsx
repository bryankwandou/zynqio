"use client";

import { useBahasa } from "@/lib/bahasa";
import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAvatar } from "@/lib/avatars";
import { getPusherClient } from "@/lib/pusher-client";
import { readSession, clearSession } from "@/lib/player-session";

type Player = {
  id: string;
  name: string;
  avatarId?: string;
};

export default function PlayerLobby({ params }: { params: Promise<{ roomCode: string }> }) {
  const { tt } = useBahasa();
  const router = useRouter();
  const unwrappedParams = use(params);
  const roomCode = unwrappedParams.roomCode.toUpperCase();

  const [nickname, setNickname] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [myAvatar, setMyAvatar] = useState("fox");
  const [players, setPlayers] = useState<Player[]>([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [gameMode, setGameMode] = useState("classic");
  const [team, setTeam] = useState<string | null>(null);
  const [isKicked, setIsKicked] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(0);
  const [connectionError, setConnectionError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const session = readSession(roomCode);

    if (!session) {
      router.replace(`/play/${roomCode}/nickname`);
      return;
    }

    setNickname(session.name);
    setMyAvatar(session.avatarId);
    setPlayerId(session.id);
  }, [roomCode, router]);

  const poll = useCallback(async () => {
    try {
      const url = lastUpdatedAt
        ? `/api/room/state?roomCode=${roomCode}&since=${lastUpdatedAt}`
        : `/api/room/state?roomCode=${roomCode}`;

      const res = await fetch(url);

      if (res.status === 304) {
        setConnectionError(false);
        return; // No change, skip
      }

      if (!res.ok) {
        setConnectionError(true);
        return;
      }

      const state = await res.json();
      setConnectionError(false);

      if (state.updatedAt) setLastUpdatedAt(state.updatedAt);

      // Peserta yang dikeluarkan dikenali dari hilangnya dirinya di
      // daftar peserta aktif. Keadaan ruangan tidak lagi menyiarkan
      // daftar nama yang pernah dikeluarkan ke semua orang.
      const session = readSession(roomCode);
      const savedName = session?.name ?? "";

      if (session && state.players && !state.players.some((p: Player) => p.id === session.id)) {
        setIsKicked(true);
        clearSession();
        setTimeout(() => router.replace("/?kicked=1"), 2000);
        return;
      }

      if (state.players) {
        setPlayers(state.players);

        if (state.gameMode === "team") {
          setGameMode("team");
          const playerIdx = state.players.findIndex((p: Player) => p.name === savedName);
          if (playerIdx !== -1) {
            setTeam(playerIdx % 2 === 0 ? "Red Team" : "Blue Team");
          }
        }
      }

      if (state.quizTitle) setQuizTitle(state.quizTitle);

      if (state.status === "playing") {
        router.push(`/play/${roomCode}/game`);
      }

      setRetryCount(0);
    } catch {
      setRetryCount((c) => c + 1);
      if (retryCount > 3) setConnectionError(true);
    }
  }, [roomCode, router, lastUpdatedAt, retryCount]);

  useEffect(() => {
    if (!nickname) return;
    poll();
    const interval = setInterval(poll, 2500);
    return () => clearInterval(interval);
  }, [nickname, poll]);

  // Pusher: instant kick detection without waiting for next poll
  useEffect(() => {
    if (!nickname) return;
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`room-${roomCode}`);
    const onKicked = (data: { playerId?: string }) => {
      const session = readSession(roomCode);
      if (session && data?.playerId === session.id) {
        setIsKicked(true);
        clearSession();
        setTimeout(() => router.replace("/?kicked=1"), 2000);
      }
    };
    channel.bind("player_kicked", onKicked);
    return () => {
      channel.unbind("player_kicked", onKicked);
    };
  }, [nickname, roomCode, router]);

  const avatarInfo = getAvatar(myAvatar);

  if (isKicked) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "var(--sp-5)", background: "var(--bg-raw)" }}>
        <div className="zy-stack" style={{ alignItems: "center", textAlign: "center", gap: "var(--sp-3)", maxWidth: 380 }}>
          <h2 className="zy-h2">{tt("Anda dikeluarkan dari ruangan", "You were removed from the room")}</h2>
          <p className="zy-muted">
            {tt("Pengajar mengeluarkan Anda dari ruangan ini. Bila ini keliru, mintalah kode ruangannya lagi.", "The teacher removed you from this room. If this was a mistake, ask them to let you back in.")}
          </p>
          <p className="zy-label" role="status">{tt("Kembali ke halaman depan…", "Back to the home page…")}</p>
        </div>
      </div>
    );
  }

  const namaPendek = nickname.length > 20 ? nickname.slice(0, 20) + "…" : nickname;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-raw)", position: "relative" }}>
      {/*
        Putusnya sambungan diumumkan pembaca layar tanpa menunggu fokus
        berpindah. Di ruang kelas, murid yang sambungannya putus perlu
        tahu segera — kalau tidak, ia mengira permainannya belum mulai
        padahal soalnya sudah berjalan.
      */}
      {connectionError && (
        <div
          role="alert"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--red)",
            color: "#ffffff",
            textAlign: "center",
            fontSize: "var(--fs-sm)",
            fontWeight: "var(--fw-medium)",
            padding: "var(--sp-2)",
          }}
        >
          {tt("Sambungan terputus — sedang mencoba lagi…", "Connection lost — trying again…")}
        </div>
      )}

      <div
        className="zy-berurut"
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "var(--sp-7) var(--sp-5)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div className="zy-label">{tt("Kode ruangan", "Room code")}</div>
          <div
            className="zy-num"
            style={{
              fontSize: "var(--fs-xl)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "0.18em",
              color: "var(--t1)",
              marginTop: "var(--sp-1)",
            }}
          >
            {roomCode}
          </div>
        </div>

        <div
          className="zy-stack"
          style={{ alignItems: "center", gap: "var(--sp-3)", marginTop: "var(--sp-6)" }}
        >
          <div
            className={`bg-gradient-to-br ${avatarInfo.bg}`}
            aria-hidden="true"
            style={{
              width: 76,
              height: 76,
              borderRadius: "var(--r-lg)",
              display: "grid",
              placeItems: "center",
              fontSize: "2.25rem",
            }}
          >
            {avatarInfo.emoji}
          </div>

          <h1 className="zy-h1" style={{ textAlign: "center", fontSize: "var(--fs-2xl)" }}>
            {tt("Kamu sudah masuk,", "You're in,")}{" "}{namaPendek}
          </h1>

          {quizTitle && (
            <p className="zy-muted" style={{ textAlign: "center" }}>
              {tt("Kuis:", "Quiz:")}{" "}<span style={{ color: "var(--t1)", fontWeight: "var(--fw-medium)" }}>{quizTitle}</span>
            </p>
          )}
        </div>

        {/*
          Regu ditandai warna sekaligus namanya dieja. Versi sebelumnya
          hanya membedakan merah dan biru lewat warna, dan itu justru
          pasangan warna yang paling sering tertukar bagi murid dengan
          buta warna merah-hijau.
        */}
        {gameMode === "team" && team && (
          <div
            className="zy-panel"
            style={{
              marginTop: "var(--sp-5)",
              padding: "var(--sp-4) var(--sp-6)",
              textAlign: "center",
              borderColor: team === "Red Team" ? "var(--red)" : "var(--p)",
              borderWidth: 2,
            }}
          >
            <div className="zy-label">{tt("Regu Anda", "Your team")}</div>
            <div
              style={{
                fontSize: "var(--fs-xl)",
                fontWeight: "var(--fw-bold)",
                color: team === "Red Team" ? "var(--red)" : "var(--p2)",
                marginTop: "var(--sp-1)",
              }}
            >
              {team === "Red Team" ? tt("Regu Merah", "Red Team") : tt("Regu Biru", "Blue Team")}
            </div>
          </div>
        )}

        <div className="zy-panel" style={{ width: "100%", marginTop: "var(--sp-6)", padding: 0, overflow: "hidden" }}>
          <div
            className="zy-row-between"
            style={{
              padding: "var(--sp-3) var(--sp-4)",
              borderBottom: "1px solid var(--border-raw)",
            }}
          >
            <span className="zy-label">{tt("Peserta di ruangan", "Players in the room")}</span>
            <span
              className="zy-badge zy-num"
              // Jumlahnya berubah saat orang lain masuk. aria-live
              // membuat perubahannya diumumkan tanpa memindahkan fokus.
              aria-live="polite"
            >
              {players.length}
            </span>
          </div>

          <div style={{ padding: "var(--sp-4)" }}>
            {players.length === 0 ? (
              <p className="zy-muted" style={{ textAlign: "center", padding: "var(--sp-4) 0" }}>
                {tt("Belum ada yang bergabung", "Nobody has joined yet")}
              </p>
            ) : (
              <ul
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--sp-2)",
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                }}
              >
                {players.map((pemain) => {
                  const av = getAvatar(pemain.avatarId);
                  const sayaSendiri = pemain.name === nickname;
                  const nama = pemain.name.length > 16 ? pemain.name.slice(0, 16) + "…" : pemain.name;
                  return (
                    <li
                      key={pemain.id}
                      className="zy-row zy-motion"
                      style={{
                        gap: "var(--sp-2)",
                        padding: "var(--sp-2) var(--sp-3)",
                        borderRadius: "var(--r-md)",
                        background: sayaSendiri ? "var(--p-soft)" : "var(--bg2-raw)",
                        border: sayaSendiri ? "1px solid var(--p)" : "1px solid var(--border-raw)",
                      }}
                    >
                      <span aria-hidden="true" style={{ fontSize: "var(--fs-base)" }}>{av.emoji}</span>
                      <span
                        style={{
                          fontSize: "var(--fs-sm)",
                          fontWeight: sayaSendiri ? "var(--fw-medium)" : "var(--fw-normal)",
                          color: "var(--t1)",
                        }}
                      >
                        {nama}
                        {sayaSendiri && <span className="zy-label" style={{ marginLeft: "var(--sp-1)" }}>{tt("(Anda)", "(You)")}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/*
          Tiga titik yang berdenyut. Fungsinya bukan hiasan: layar ini
          bisa diam berpuluh detik sementara pengajar menunggu kelas
          lengkap, dan tanpa sesuatu yang bergerak murid mengira
          ponselnya membeku lalu memuat ulang halaman — yang berarti
          keluar dari ruangan.
        */}
        <div className="zy-stack" style={{ alignItems: "center", marginTop: "var(--sp-6)", gap: "var(--sp-3)" }}>
          <div className="zy-row" style={{ gap: "var(--sp-1)" }} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="zy-denyut"
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "var(--r-full)",
                  background: "var(--p)",
                  display: "inline-block",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
          <p className="zy-muted" role="status">{tt("Menunggu pengajar memulai", "Waiting for the teacher to start")}</p>
        </div>
      </div>
    </div>
  );
}
