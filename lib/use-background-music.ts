"use client";
import { useEffect, useRef, useCallback } from "react";

export type MusicScene = "lobby" | "game";

interface MusicRef {
  ctx: AudioContext | null;
  gain: GainNode | null;
  timer: ReturnType<typeof setTimeout> | null;
  active: boolean;
  nextAt: number;
}

// All note frequencies used
const N: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
};

function tone(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  start: number,
  dur: number,
  vol = 0.15,
  wave: OscillatorType = "triangle"
) {
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(dest);
    osc.type = wave;
    osc.frequency.value = freq;
    const s = Math.max(ctx.currentTime + 0.001, start);
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(vol, s + 0.025);
    const release = Math.max(s + 0.03, s + dur * 0.78);
    g.gain.setValueAtTime(vol * 0.9, release);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    osc.start(s);
    osc.stop(s + dur + 0.02);
  } catch { /* non-fatal */ }
}

// ─── LOBBY: calm C major arpeggio, 100 BPM, I–V–vi–IV ────────────────────────
function lobbyBar(ctx: AudioContext, dest: AudioNode, t: number): number {
  const e = 60 / 100 / 2; // eighth note @ 100 BPM = 0.3s

  const melody: [number, number][] = [
    // I: C major
    [N.E4, 0],  [N.G4, 1],  [N.C5, 2],  [N.E5, 3],
    // V: G major
    [N.D4, 4],  [N.G4, 5],  [N.B4, 6],  [N.D5, 7],
    // vi: A minor
    [N.C4, 8],  [N.E4, 9],  [N.A4, 10], [N.C5, 11],
    // IV: F major
    [N.C4, 12], [N.F4, 13], [N.A4, 14], [N.C5, 15],
  ];
  melody.forEach(([f, step]) =>
    tone(ctx, dest, f, t + step * e, e * 0.88, 0.10, "triangle")
  );

  // Sustained bass notes
  const bass: [number, number][] = [
    [N.C3, 0], [N.G3, 4], [N.A3, 8], [N.F3, 12],
  ];
  bass.forEach(([f, step]) =>
    tone(ctx, dest, f, t + step * e, e * 3.6, 0.13, "sine")
  );

  // Gentle pad chords (high register, very soft)
  const pads: [number, number][] = [
    [N.G4, 0], [N.D5, 4], [N.E4, 8], [N.C5, 12],
  ];
  pads.forEach(([f, step]) =>
    tone(ctx, dest, f, t + step * e, e * 3.8, 0.04, "sine")
  );

  return 16 * e; // full 4-chord phrase
}

// ─── GAME: upbeat C major, 128 BPM, driving quiz feel ────────────────────────
function gameBar(ctx: AudioContext, dest: AudioNode, t: number): number {
  const s = 60 / 128 / 4; // sixteenth note @ 128 BPM ≈ 0.117s

  // Lead melody (square — retro game feel)
  const melody: [number, number][] = [
    [N.C5, 0],  [N.E5, 2],  [N.G5, 4],  [N.E5, 6],
    [N.D5, 8],  [N.G4, 10], [N.B4, 12], [N.D5, 14],
    [N.C5, 16], [N.E5, 18], [N.G5, 20], [N.A5, 22],
    [N.G5, 24], [N.E5, 26], [N.C5, 28], [N.G4, 30],
  ];
  melody.forEach(([f, step]) =>
    tone(ctx, dest, f, t + step * s, s * 1.7, 0.09, "square")
  );

  // Bassline (sine — warm low end)
  const bass: [number, number][] = [
    [N.C3, 0],  [N.C3, 4],  [N.G3, 8],  [N.G3, 12],
    [N.A3, 16], [N.A3, 20], [N.F3, 24], [N.G3, 28],
  ];
  bass.forEach(([f, step]) =>
    tone(ctx, dest, f, t + step * s, s * 3.5, 0.19, "sine")
  );

  // Counter-melody (triangle — softer 2nd voice)
  const counter: [number, number][] = [
    [N.G4, 1],  [N.C5, 5],  [N.E4, 9],  [N.G4, 13],
    [N.A4, 17], [N.D5, 21], [N.F4, 25], [N.E4, 29],
  ];
  counter.forEach(([f, step]) =>
    tone(ctx, dest, f, t + step * s, s * 1.4, 0.055, "triangle")
  );

  // Hi-hat (every 8th note)
  for (let i = 0; i < 32; i += 2) {
    tone(ctx, dest, 7000, t + i * s, s * 0.05, 0.015, "sawtooth");
  }

  // Kick-ish accent (low pulse every beat)
  for (let i = 0; i < 32; i += 8) {
    tone(ctx, dest, 60, t + i * s, s * 1.5, 0.12, "sine");
  }

  return 32 * s; // 2-bar phrase
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useBackgroundMusic(scene: MusicScene | null, masterVol = 0.30) {
  const r = useRef<MusicRef>({ ctx: null, gain: null, timer: null, active: false, nextAt: 0 });

  const stop = useCallback(() => {
    const ref = r.current;
    ref.active = false;
    if (ref.timer) { clearTimeout(ref.timer); ref.timer = null; }
    const ctx = ref.ctx;
    const gain = ref.gain;
    if (ctx && gain) {
      try {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      } catch { /* non-fatal */ }
    }
    ref.ctx = null;
    ref.gain = null;
    if (ctx) setTimeout(() => ctx.close().catch(() => {}), 600);
  }, []);

  useEffect(() => {
    if (!scene) return;

    const ACtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!ACtx) return;

    let ctx: AudioContext;
    try { ctx = new ACtx(); } catch { return; }

    r.current.ctx = ctx;
    r.current.active = true;
    ctx.resume().catch(() => {});

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(masterVol, ctx.currentTime + 2.5);
    master.connect(ctx.destination);
    r.current.gain = master;
    r.current.nextAt = ctx.currentTime + 0.08;

    const barFn = scene === "lobby" ? lobbyBar : gameBar;

    function schedule() {
      if (!r.current.active || !r.current.ctx) return;
      const now = ctx.currentTime;
      while (r.current.nextAt < now + 3.5) {
        r.current.nextAt += barFn(ctx, master, r.current.nextAt);
      }
      r.current.timer = setTimeout(schedule, 800);
    }
    schedule();

    // Resume on user interaction (iOS Safari autoplay policy)
    const resume = () => {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    };
    document.addEventListener("touchstart", resume, { passive: true });
    document.addEventListener("click", resume, { passive: true });
    document.addEventListener("keydown", resume, { passive: true });

    return () => {
      document.removeEventListener("touchstart", resume);
      document.removeEventListener("click", resume);
      document.removeEventListener("keydown", resume);
      stop();
    };
  }, [scene, masterVol, stop]);

  const setVolume = useCallback((v: number) => {
    const ref = r.current;
    if (ref.gain && ref.ctx) {
      ref.gain.gain.cancelScheduledValues(ref.ctx.currentTime);
      ref.gain.gain.setValueAtTime(v, ref.ctx.currentTime);
    }
  }, []);

  return { setVolume };
}
