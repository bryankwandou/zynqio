"use client";

import { useEffect, useRef, useState } from "react";

// Royalty-free jazz tracks (Bensound.com — free with attribution)
const JAZZ_TRACKS = [
  "https://www.bensound.com/bensound-music/bensound-jazzyfrenchy.mp3",
  "https://www.bensound.com/bensound-music/bensound-thejazzpiano.mp3",
  "https://www.bensound.com/bensound-music/bensound-tenderness.mp3",
];

interface Props {
  autoPlay?: boolean;
  defaultVolume?: number;
}

export default function GameMusicPlayer({ autoPlay = true, defaultVolume = 0.18 }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackIndexRef = useRef(0);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = defaultVolume;
    audio.loop = false;
    audioRef.current = audio;

    const loadTrack = (idx: number) => {
      audio.src = JAZZ_TRACKS[idx % JAZZ_TRACKS.length];
      audio.load();
    };

    const playNext = () => {
      trackIndexRef.current = (trackIndexRef.current + 1) % JAZZ_TRACKS.length;
      loadTrack(trackIndexRef.current);
      audio.play().catch(() => {});
    };

    audio.addEventListener("ended", playNext);
    audio.addEventListener("error", playNext);
    loadTrack(0);

    if (autoPlay) {
      // Browsers require a user gesture before autoplay — try silently,
      // fall back to starting on first user interaction
      const tryPlay = () => {
        audio.play().then(() => setStarted(true)).catch(() => {
          const startOnInteraction = () => {
            audio.play().then(() => setStarted(true)).catch(() => {});
            document.removeEventListener("click", startOnInteraction);
            document.removeEventListener("keydown", startOnInteraction);
            document.removeEventListener("touchstart", startOnInteraction);
          };
          document.addEventListener("click", startOnInteraction, { once: true });
          document.addEventListener("keydown", startOnInteraction, { once: true });
          document.addEventListener("touchstart", startOnInteraction, { once: true });
        });
      };
      tryPlay();
    }

    return () => {
      audio.pause();
      audio.removeEventListener("ended", playNext);
      audio.removeEventListener("error", playNext);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!started) {
      audio.play().then(() => setStarted(true)).catch(() => {});
      return;
    }
    if (muted) {
      audio.volume = defaultVolume;
      setMuted(false);
    } else {
      audio.volume = 0;
      setMuted(true);
    }
  };

  return (
    <button
      onClick={toggleMute}
      title={muted ? "Unmute jazz music" : started ? "Mute music" : "Play jazz music"}
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs border border-white/10 bg-white/5 hover:bg-white/10 transition-all shrink-0"
      style={{ fontSize: "14px" }}
    >
      {!started ? "🎵" : muted ? "🔇" : "🎷"}
    </button>
  );
}
