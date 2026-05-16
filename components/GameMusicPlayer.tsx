"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  autoPlay?: boolean;
  defaultVolume?: number;
}

// ─── Note frequencies (jazz-friendly keys) ────────────────────────────
const N: Record<string, number> = {
  F2: 87.31, G2: 98.00, A2: 110.00, Bb2: 116.54, C3: 130.81, D3: 146.83,
  Eb3: 155.56, F3: 174.61, G3: 196.00, A3: 220.00, Bb3: 233.08, B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, G4: 392.00,
  A4: 440.00, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, Bb5: 932.33,
};

// ─── Tone with ADSR envelope ──────────────────────────────────────────
function tone(
  ctx: AudioContext, dest: AudioNode, freq: number, start: number,
  dur: number, vol: number, wave: OscillatorType,
  attack = 0.02, release = 0.18
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
    g.gain.exponentialRampToValueAtTime(vol, s + attack);
    g.gain.setValueAtTime(vol, Math.max(s + attack + 0.01, s + dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    osc.start(s);
    osc.stop(s + dur + 0.05);
  } catch { /* non-fatal */ }
}

// ─── 4-voice piano-ish chord with slight detune & 2nd harmonic ────────
function chord(ctx: AudioContext, dest: AudioNode, freqs: number[], start: number, dur: number, vol: number) {
  freqs.forEach((f) => {
    tone(ctx, dest, f, start, dur, vol * 0.75, "sine", 0.025, 0.45);
    tone(ctx, dest, f * 1.003, start, dur, vol * 0.25, "triangle", 0.035, 0.45);
    tone(ctx, dest, f * 2, start + 0.002, dur * 0.7, vol * 0.16, "sine", 0.03, 0.3);
  });
}

// ─── Brush snare via highpass-filtered noise ──────────────────────────
function brushSnare(ctx: AudioContext, dest: AudioNode, start: number, vol = 0.04) {
  try {
    const bufSize = Math.floor(ctx.sampleRate * 0.16);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(start);
    src.stop(start + 0.18);
  } catch { /* non-fatal */ }
}

// ─── Soft kick ────────────────────────────────────────────────────────
function softKick(ctx: AudioContext, dest: AudioNode, start: number, vol = 0.06) {
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(dest);
    osc.type = "sine";
    osc.frequency.setValueAtTime(70, start);
    osc.frequency.exponentialRampToValueAtTime(40, start + 0.13);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.start(start);
    osc.stop(start + 0.25);
  } catch { /* non-fatal */ }
}

// ─── Smooth jazz progression: ii-V-I in F (Gm7 → C7 → Fmaj7 → Bbmaj7) ─
// 82 BPM, soft brush-jazz feel for quiz focus
function jazzBar(ctx: AudioContext, dest: AudioNode, t: number): number {
  const bpm = 82;
  const beat = 60 / bpm;
  const bar = beat * 4;

  // 4-bar progression with rootless 7th voicings
  const progression = [
    { root: N.F2, voicing: [N.F3, N.A3, N.C4, N.E4] },  // Fmaj7
    { root: N.Bb2, voicing: [N.Bb3, N.D4, N.F4, N.A4] }, // Bbmaj7
    { root: N.G2, voicing: [N.G3, N.Bb3, N.D4, N.F4] },  // Gm7
    { root: N.C3, voicing: [N.C4, N.E4, N.G4, N.Bb4] },  // C7
  ];

  progression.forEach((ch, barIdx) => {
    const tBar = t + barIdx * bar;

    // Piano chord on beats 1 and 3 (with subtle "comping" feel)
    chord(ctx, dest, ch.voicing, tBar, beat * 1.7, 0.06);
    chord(ctx, dest, ch.voicing, tBar + beat * 2, beat * 1.7, 0.05);

    // Walking bass — quarter notes (root, 2, 5, leading-tone-ish)
    const bassWalk = [ch.root, ch.root * 1.122, ch.root * 1.498, ch.root * 1.587];
    bassWalk.forEach((bf, bi) => {
      tone(ctx, dest, bf, tBar + bi * beat, beat * 0.78, 0.13, "sine", 0.012, 0.12);
      tone(ctx, dest, bf * 2, tBar + bi * beat, beat * 0.6, 0.05, "triangle", 0.015, 0.12);
    });

    // Brush snare on 2 and 4
    brushSnare(ctx, dest, tBar + beat, 0.028);
    brushSnare(ctx, dest, tBar + beat * 3, 0.028);

    // Soft kick on 1
    softKick(ctx, dest, tBar, 0.04);

    // Sparse melody floats over bars 0 & 2 only (chord tones, swung)
    if (barIdx === 0 || barIdx === 2) {
      const melody = barIdx === 0
        ? [N.A4, N.C5, N.E5, N.A4]
        : [N.G4, N.Bb4, N.D5, N.G4];
      melody.forEach((mn, mi) => {
        const tNote = tBar + (0.5 + mi * 0.85) * beat;
        tone(ctx, dest, mn, tNote, beat * 0.55, 0.04, "triangle", 0.025, 0.2);
        tone(ctx, dest, mn * 2, tNote, beat * 0.45, 0.014, "sine", 0.025, 0.2);
      });
    }

    // Whispery hi-hat every 8th
    for (let h = 0; h < 8; h++) {
      tone(ctx, dest, 9000, tBar + h * (beat / 2), 0.02, 0.006, "sawtooth", 0.001, 0.01);
    }
  });

  return bar * 4;
}

// ─── Component ────────────────────────────────────────────────────────
export default function GameMusicPlayer({ autoPlay = true, defaultVolume = 0.18 }: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const dryBusRef = useRef<GainNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextAtRef = useRef(0);
  const activeRef = useRef(false);

  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);

  const buildReverb = useCallback((ctx: AudioContext) => {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * 1.4);
    const impulse = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const decay = Math.pow(1 - i / len, 2.5);
        data[i] = (Math.random() * 2 - 1) * decay * 0.45;
      }
    }
    return impulse;
  }, []);

  const startMusic = useCallback(() => {
    if (activeRef.current) return;
    const ACtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!ACtx) return;
    let ctx: AudioContext;
    try { ctx = new ACtx(); } catch { return; }
    ctxRef.current = ctx;
    activeRef.current = true;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(defaultVolume, ctx.currentTime + 2.5);
    master.connect(ctx.destination);
    gainRef.current = master;

    // Dry bus — feeds both straight to master AND through reverb
    const dryBus = ctx.createGain();
    dryBus.gain.value = 1;
    dryBus.connect(master);
    dryBusRef.current = dryBus;

    // Reverb send (subtle ambience)
    try {
      const conv = ctx.createConvolver();
      conv.buffer = buildReverb(ctx);
      const wet = ctx.createGain();
      wet.gain.value = 0.2;
      dryBus.connect(conv);
      conv.connect(wet);
      wet.connect(master);
    } catch { /* non-fatal */ }

    nextAtRef.current = ctx.currentTime + 0.1;

    const schedule = () => {
      if (!activeRef.current || !ctxRef.current || !dryBusRef.current) return;
      const now = ctxRef.current.currentTime;
      while (nextAtRef.current < now + 4) {
        nextAtRef.current += jazzBar(ctxRef.current, dryBusRef.current, nextAtRef.current);
      }
      timerRef.current = setTimeout(schedule, 1500);
    };
    schedule();

    setStarted(true);
  }, [defaultVolume, buildReverb]);

  const stopMusic = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (ctx && gain) {
      try {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      } catch { /* non-fatal */ }
    }
    ctxRef.current = null;
    gainRef.current = null;
    dryBusRef.current = null;
    if (ctx) setTimeout(() => ctx.close().catch(() => {}), 500);
  }, []);

  useEffect(() => {
    if (!autoPlay) return;

    // Browsers require a user gesture for AudioContext.
    // We delay startMusic() until first user interaction.
    const tryStart = () => {
      if (!activeRef.current) startMusic();
      else if (ctxRef.current?.state === "suspended") {
        ctxRef.current.resume().catch(() => {});
      }
    };

    document.addEventListener("click", tryStart);
    document.addEventListener("keydown", tryStart);
    document.addEventListener("touchstart", tryStart);

    return () => {
      document.removeEventListener("click", tryStart);
      document.removeEventListener("keydown", tryStart);
      document.removeEventListener("touchstart", tryStart);
      stopMusic();
    };
  }, [autoPlay, startMusic, stopMusic]);

  const toggleMute = () => {
    const gain = gainRef.current;
    const ctx = ctxRef.current;
    if (!gain || !ctx) {
      startMusic();
      return;
    }
    if (muted) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value || 0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(defaultVolume, ctx.currentTime + 0.4);
      setMuted(false);
    } else {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      setMuted(true);
    }
  };

  return (
    <button
      onClick={toggleMute}
      title={muted ? "Unmute lo-fi jazz" : started ? "Mute music" : "Play lo-fi jazz"}
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs border border-white/10 bg-white/5 hover:bg-white/10 transition-all shrink-0"
      style={{ fontSize: "14px" }}
    >
      {!started ? "🎵" : muted ? "🔇" : "🎷"}
    </button>
  );
}
