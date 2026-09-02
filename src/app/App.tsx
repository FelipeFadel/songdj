import { useState, useRef, useEffect, type DragEvent } from "react";
import { Play, Pause, Upload, Zap, Link2, Music, Music2, Minus, Square, X, Disc3, Youtube, FileAudio } from "lucide-react";
import {
  CA, CB, BG, MONO, COND, UI,
  desktopBg, glass, well, glossyBtn, orbSheen, chromeFrame, titleBar,
} from "./aero";
import demoDuelUrl from "../assets/demo/duel-of-the-fates.mp3";
import demoFlexUrl from "../assets/demo/flex-up.mp3";
import { detectBpm } from "./bpm-detector";
import { YouTubeController, YouTubeState, parseYouTubeUrl } from "./youtube";

// ─── Camelot data ──────────────────────────────────────────────────────────────
const CAMELOT = [
  { pos: 1,  A: "Am",  B: "C"  },
  { pos: 2,  A: "Em",  B: "G"  },
  { pos: 3,  A: "Bm",  B: "D"  },
  { pos: 4,  A: "F#m", B: "A"  },
  { pos: 5,  A: "C#m", B: "E"  },
  { pos: 6,  A: "G#m", B: "B"  },
  { pos: 7,  A: "Ebm", B: "F#" },
  { pos: 8,  A: "Bbm", B: "Db" },
  { pos: 9,  A: "Fm",  B: "Ab" },
  { pos: 10, A: "Cm",  B: "Eb" },
  { pos: 11, A: "Gm",  B: "Bb" },
  { pos: 12, A: "Dm",  B: "F"  },
] as const;

type KeyType = "A" | "B";

type DeckSource = "local" | "youtube";

interface DeckInfo {
  camelotPos:  number;
  camelotType: KeyType;
  bpm:         number;
  tempo:       number;
  trackName:   string;
  loaded:      boolean;
  source:      DeckSource;
}

// ─── Demo tracks ──────────────────────────────────────────────────────────────
// Bundled so the app is testable without uploading. Camelot/BPM values are
// rough tags for these two files, not analysed — adjust in-app if it matters.
const DEMOS: Record<"A" | "B", { url: string; name: string; bpm: number; pos: number; type: KeyType }> = {
  A: { url: demoDuelUrl, name: "John Williams — Duel of the Fates", bpm: 100, pos: 4, type: "A" },
  B: { url: demoFlexUrl, name: "Lil Yachty, Future, Playboi Carti — Flex Up", bpm: 130, pos: 11, type: "A" },
};

async function fetchAsFile(url: string, name: string): Promise<File> {
  const res  = await fetch(url);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "audio/mpeg" });
}

// ─── Compatibility ─────────────────────────────────────────────────────────────
function getCompat(p1: number, t1: KeyType, p2: number, t2: KeyType) {
  if (p1 === p2 && t1 === t2) return "PERFECT";
  if (p1 === p2) return "HARMONIC";
  const d = Math.abs(p1 - p2);
  if ((d === 1 || d === 11) && t1 === t2) return "HARMONIC";
  return "CLASH";
}
function compatColor(c: string) {
  return c === "PERFECT" ? "#00ff9d" : c === "HARMONIC" ? "#ffd700" : "#ff4455";
}

// ─── Audio helpers ─────────────────────────────────────────────────────────────
function computePeaks(buf: AudioBuffer, n = 4000) {
  const ch   = buf.getChannelData(0);
  const step = Math.floor(ch.length / n);
  return Array.from({ length: n }, (_, i) => {
    let m = 0;
    for (let j = i * step; j < Math.min((i + 1) * step, ch.length); j++)
      m = Math.max(m, Math.abs(ch[j]));
    return m;
  });
}

let _ctx: AudioContext | null = null;
function getCtx() {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

// ─── Audio engine ──────────────────────────────────────────────────────────────
class DeckAudio {
  ctx:      AudioContext;
  buffer:   AudioBuffer | null = null;
  src:      AudioBufferSourceNode | null = null;
  gain:     GainNode;
  cfGain:   GainNode;
  analyser: AnalyserNode;
  eqLow:    BiquadFilterNode;
  eqMid:    BiquadFilterNode;
  eqHigh:   BiquadFilterNode;
  private _rate   = 1;
  private _t0     = 0;
  private _offset = 0;
  private _on     = false;

  constructor(ctx: AudioContext) {
    this.ctx      = ctx;
    this.gain     = ctx.createGain();
    this.cfGain   = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.eqLow  = ctx.createBiquadFilter(); this.eqLow.type  = "lowshelf";  this.eqLow.frequency.value  = 200;
    this.eqMid  = ctx.createBiquadFilter(); this.eqMid.type  = "peaking";   this.eqMid.frequency.value  = 1000; this.eqMid.Q.value = 1;
    this.eqHigh = ctx.createBiquadFilter(); this.eqHigh.type = "highshelf"; this.eqHigh.frequency.value = 8000;
    this.gain.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.analyser);
    this.analyser.connect(this.cfGain);
    this.cfGain.connect(ctx.destination);
  }

  async load(file: File) {
    const ab    = await file.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(ab);
    this._offset = 0;
    return this.buffer;
  }

  get playing()  { return this._on; }
  get duration() { return this.buffer?.duration ?? 0; }

  currentTime() {
    if (!this.buffer) return 0;
    if (this._on) return ((this.ctx.currentTime - this._t0) * this._rate) % this.buffer.duration;
    return this._offset;
  }

  play() {
    if (!this.buffer || this._on) return;
    this.ctx.resume();
    this.src = this.ctx.createBufferSource();
    this.src.buffer = this.buffer;
    this.src.loop   = true;
    this.src.playbackRate.value = this._rate;
    this.src.connect(this.gain);
    this.src.start(0, this._offset % this.buffer.duration);
    this._t0 = this.ctx.currentTime - this._offset / this._rate;
    this._on = true;
  }

  pause() {
    if (!this._on) return;
    this._offset = this.currentTime();
    this.src?.stop();
    this.src = null;
    this._on = false;
  }

  seek(t: number) {
    if (!this.buffer) return;
    const was = this._on;
    if (was) { try { this.src?.stop(); } catch {} this.src = null; this._on = false; }
    this._offset = Math.max(0, Math.min(t, this.buffer.duration - 0.01));
    if (was) this.play();
  }

  setVol(v: number)  { this.gain.gain.setTargetAtTime(v,  this.ctx.currentTime, 0.01); }
  setCF(v: number)   { this.cfGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
  setRate(r: number) {
    this._rate = r;
    this.src?.playbackRate.setTargetAtTime(r, this.ctx.currentTime, 0.05);
  }
  setEQ(lo: number, mi: number, hi: number) {
    this.eqLow.gain.setTargetAtTime(lo,  this.ctx.currentTime, 0.02);
    this.eqMid.gain.setTargetAtTime(mi,  this.ctx.currentTime, 0.02);
    this.eqHigh.gain.setTargetAtTime(hi, this.ctx.currentTime, 0.02);
  }
  freq() {
    const d = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(d);
    return d;
  }
}

// ─── Camelot Wheel ─────────────────────────────────────────────────────────────
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r0, a0), p1 = polar(cx, cy, r0, a1);
  const p2 = polar(cx, cy, r1, a1), p3 = polar(cx, cy, r1, a0);
  return `M${p0.x},${p0.y} A${r0},${r0} 0 0,1 ${p1.x},${p1.y} L${p2.x},${p2.y} A${r1},${r1} 0 0,0 ${p3.x},${p3.y} Z`;
}
function CamelotWheel({ aPos, aType, bPos, bType }: {
  aPos: number; aType: KeyType; bPos: number; bType: KeyType;
}) {
  const C = 130, R0 = 38, R1 = 70, R2 = 102;
  return (
    <svg width={168} height={168} viewBox="0 0 260 260" style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.55))", flexShrink: 0 }}>
      <defs>
        <radialGradient id="wheelGloss" cx="50%" cy="34%" r="70%">
          <stop offset="0%"  stopColor="rgba(255,255,255,0.28)" />
          <stop offset="45%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.20)" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={R2 + 6} fill="#0c1120" stroke="rgba(255,255,255,0.14)" strokeWidth={2} />
      {CAMELOT.map(({ pos }) => {
        const a0  = (pos - 1) * 30 - 14.5, a1 = a0 + 29, mid = (a0 + a1) / 2;
        const isAa = pos === aPos && aType === "A", isAb = pos === bPos && bType === "A";
        const isBa = pos === aPos && aType === "B", isBb = pos === bPos && bType === "B";
        const fillA = isAa ? CA : isAb ? CB : "#151a30";
        const fillB = isBa ? CA : isBb ? CB : "#1d2440";
        const tA    = (isAa || isAb) ? BG : "#7a86c0";
        const tB    = (isBa || isBb) ? BG : "#8a96d0";
        const cA    = polar(C, C, (R0 + R1) / 2, mid);
        const cB    = polar(C, C, (R1 + R2) / 2, mid);
        return (
          <g key={pos}>
            <path d={arcPath(C, C, R0, R1, a0, a1)} fill={fillA} stroke="#0a0e1c" strokeWidth={1.5} style={{ transition: "fill 0.25s" }} />
            <path d={arcPath(C, C, R1, R2, a0, a1)} fill={fillB} stroke="#0a0e1c" strokeWidth={1.5} style={{ transition: "fill 0.25s" }} />
            <text x={cA.x} y={cA.y} textAnchor="middle" dominantBaseline="middle" fontSize={7}   fill={tA} fontFamily={MONO} fontWeight={700} style={{ pointerEvents: "none", userSelect: "none" }}>{pos}A</text>
            <text x={cB.x} y={cB.y} textAnchor="middle" dominantBaseline="middle" fontSize={6.5} fill={tB} fontFamily={MONO} fontWeight={600} style={{ pointerEvents: "none", userSelect: "none" }}>{pos}B</text>
          </g>
        );
      })}
      <circle cx={C} cy={C} r={R2 + 6} fill="url(#wheelGloss)" style={{ pointerEvents: "none" }} />
      <circle cx={C} cy={C} r={R0 - 2} fill="#0a0e1c" stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
      <text x={C} y={C - 7} textAnchor="middle" fontSize={7.5} fill="#5a5a9a" fontFamily={MONO}>CAMELOT</text>
      <text x={C} y={C + 7} textAnchor="middle" fontSize={6.5} fill="#4a4a7a" fontFamily={MONO}>WHEEL</text>
    </svg>
  );
}

// ─── Transition View (waveform canvas — unchanged engine) ──────────────────────
function TransitionView({
  peaksA, peaksB, durationA, durationB,
  bpmA, bpmB, loadedA, loadedB,
  audioARef, audioBRef, checkpoints,
}: {
  peaksA: number[]; peaksB: number[];
  durationA: number; durationB: number;
  bpmA: number; bpmB: number;
  loadedA: boolean; loadedB: boolean;
  audioARef: React.RefObject<DeckAudio | null>;
  audioBRef: React.RefObject<DeckAudio | null>;
  checkpoints: { id: number; tA: number; tB: number }[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef   = useRef<{ which: "A" | "B"; startX: number; startT: number } | null>(null);
  const [winSec,  setWinSec]  = useState(8);

  // Live ref so the rAF draw loop always sees the current checkpoint list
  // without the effect below having to re-subscribe on every change.
  const cpRef = useRef(checkpoints);
  cpRef.current = checkpoints;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    function draw() {
      const W   = canvas.width;
      const H   = canvas.height;
      const trkH = Math.floor(H * 0.41);
      const gapY = trkH;
      const gapH = H - trkH * 2;
      const bY   = gapY + gapH;

      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = "#060612";
      ctx.fillRect(0, 0, W, trkH);
      ctx.fillStyle = "#07070e";
      ctx.fillRect(0, bY, W, trkH);
      ctx.fillStyle = "#0a0a18";
      ctx.fillRect(0, gapY, W, gapH);

      const aAudio = audioARef.current;
      const bAudio = audioBRef.current;
      const tA = aAudio?.currentTime() ?? 0;
      const tB = bAudio?.currentTime() ?? 0;
      const pxPerSec = W / (winSec * 2);

      function drawWave(
        peaks: number[], duration: number, currentT: number,
        yCenter: number, trackHeight: number, color: string,
      ) {
        if (!peaks.length || !duration) return;
        const pps = peaks.length / duration;
        const grad = ctx.createLinearGradient(0, yCenter - trackHeight * 0.5, 0, yCenter + trackHeight * 0.5);
        grad.addColorStop(0,   color + "08");
        grad.addColorStop(0.3, color + "50");
        grad.addColorStop(0.5, color + "70");
        grad.addColorStop(0.7, color + "50");
        grad.addColorStop(1,   color + "08");
        for (let px = 0; px < W; px++) {
          const t   = currentT + (px - W / 2) / pxPerSec;
          const idx = Math.floor(t * pps);
          if (idx < 0 || idx >= peaks.length) continue;
          const h = peaks[idx] * trackHeight * 0.88;
          ctx.fillStyle = grad;
          ctx.fillRect(px, yCenter - h, 1, h * 2);
        }
      }

      if (loadedA) drawWave(peaksA, durationA, tA, trkH / 2,      trkH, CA);
      if (loadedB) drawWave(peaksB, durationB, tB, bY + trkH / 2, trkH, CB);

      if (aAudio && loadedA) {
        const fr = aAudio.freq();
        const bw = W / fr.length;
        for (let i = 0; i < fr.length; i++) {
          const v = fr[i] / 255;
          if (v < 0.01) continue;
          ctx.fillStyle = CA + Math.floor(v * 80).toString(16).padStart(2, "0");
          ctx.fillRect(W / 2 + i * bw - fr.length * bw / 2, trkH / 2 - v * trkH * 0.5, bw, v * trkH);
        }
      }
      if (bAudio && loadedB) {
        const fr = bAudio.freq();
        const bw = W / fr.length;
        for (let i = 0; i < fr.length; i++) {
          const v = fr[i] / 255;
          if (v < 0.01) continue;
          ctx.fillStyle = CB + Math.floor(v * 80).toString(16).padStart(2, "0");
          ctx.fillRect(W / 2 + i * bw - fr.length * bw / 2, bY + trkH / 2 - v * trkH * 0.5, bw, v * trkH);
        }
      }

      function drawBeats(bpm: number, currentT: number, yStart: number, h: number, color: string) {
        if (!bpm) return;
        const beat = 60 / bpm;
        const firstBeat = Math.ceil((currentT - winSec) / beat) * beat;
        for (let bt = firstBeat; bt <= currentT + winSec; bt += beat) {
          const x       = W / 2 + (bt - currentT) * pxPerSec;
          if (x < 0 || x > W) continue;
          const beatN   = Math.round(bt / beat);
          const isBar   = beatN % 4 === 0;
          const tickH   = isBar ? h - 4 : Math.floor(h * 0.55);
          ctx.fillStyle = isBar ? color + "ee" : color + "77";
          ctx.fillRect(x - (isBar ? 1 : 0.5), yStart + (isBar ? 2 : (h - tickH) / 2), isBar ? 2 : 1, tickH);
        }
      }

      drawBeats(bpmA, tA, gapY,                Math.floor(gapH / 2), CA);
      drawBeats(bpmB, tB, gapY + Math.ceil(gapH / 2), Math.floor(gapH / 2), CB);

      // Saved checkpoint positions — one vertical line per deck track, drawn
      // where that deck's stored time currently sits in its scrolling window.
      function drawCheckpoint(savedT: number, currentT: number, yTop: number, h: number, color: string, label: string) {
        const x = W / 2 + (savedT - currentT) * pxPerSec;
        if (x < 0 || x > W) return;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur  = 8;
        ctx.fillStyle   = color;
        ctx.fillRect(x - 1, yTop, 2, h);
        ctx.restore();
        // flag tab at the top of the track
        ctx.fillStyle = color;
        ctx.fillRect(x - 1, yTop, 12, 9);
        ctx.fillStyle = "#060612";
        ctx.font = `700 7px ${MONO}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(label, x + 1.5, yTop + 1.5);
      }
      for (let i = 0; i < cpRef.current.length; i++) {
        const cp  = cpRef.current[i];
        const lbl = String(i + 1);
        if (loadedA) drawCheckpoint(cp.tA, tA, 0,  trkH, CA, lbl);
        if (loadedB) drawCheckpoint(cp.tB, tB, bY, trkH, CB, lbl);
      }

      ctx.fillStyle = CA + "28";
      ctx.fillRect(0, gapY, W, 1);
      ctx.fillStyle = CB + "28";
      ctx.fillRect(0, gapY + gapH, W, 1);
      ctx.fillStyle = "#1a1a35";
      ctx.fillRect(0, gapY + Math.floor(gapH / 2), W, 1);

      ctx.save();
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur  = 10;
      ctx.fillStyle   = "#ffffff44";
      ctx.fillRect(W / 2 - 1, 0, 2, H);
      ctx.restore();

      const secInterval = winSec >= 16 ? 4 : winSec >= 8 ? 2 : 1;
      const firstSec = Math.ceil((tA - winSec) / secInterval) * secInterval;
      for (let s = firstSec; s <= tA + winSec; s += secInterval) {
        const x = W / 2 + (s - tA) * pxPerSec;
        if (x < 4 || x > W - 4) continue;
        ctx.fillStyle = "#2a2a50";
        ctx.fillRect(x - 0.5, gapY + Math.floor(gapH / 2) - 3, 1, 6);
      }

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, [peaksA, peaksB, durationA, durationB, bpmA, bpmB, loadedA, loadedB, audioARef, audioBRef, winSec]);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect  = e.currentTarget.getBoundingClientRect();
    const yRel  = e.clientY - rect.top;
    const which = yRel < rect.height / 2 ? "A" : "B";
    const audio = which === "A" ? audioARef.current : audioBRef.current;
    dragRef.current = { which, startX: e.clientX, startT: audio?.currentTime() ?? 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const W     = e.currentTarget.getBoundingClientRect().width;
    const dt    = -(e.clientX - drag.startX) / (W / (winSec * 2));
    const audio = drag.which === "A" ? audioARef.current : audioBRef.current;
    const dur   = drag.which === "A" ? durationA : durationB;
    if (audio && dur) audio.seek(Math.max(0, Math.min(dur - 0.01, drag.startT + dt)));
  }
  function onPointerUp() { dragRef.current = null; }

  const beatOffsetMs = loadedA && loadedB && bpmA > 0
    ? (() => {
        const tA = audioARef.current?.currentTime() ?? 0;
        const tB = audioBRef.current?.currentTime() ?? 0;
        const beat = 60 / bpmA;
        const raw  = ((tA - tB) % beat + beat) % beat;
        const off  = raw > beat / 2 ? raw - beat : raw;
        return Math.round(off * 1000);
      })()
    : null;

  const avgBpm    = ((bpmA || 128) + (bpmB || 128)) / 2;
  const barsShown = Math.round((winSec * 2 * avgBpm) / 60 / 4);

  return (
    <div style={{ position: "relative", margin: "6px 8px", borderRadius: 10, overflow: "hidden", flexShrink: 0, ...well, userSelect: "none" }}>
      <div style={{ position: "absolute", top: 4, left: 10, zIndex: 2, pointerEvents: "none" }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: CA + "dd", letterSpacing: "0.12em", textShadow: `0 0 8px ${CA}88` }}>
          A {loadedA ? "← drag to seek →" : "— drop a track —"}
        </span>
      </div>
      <div style={{ position: "absolute", bottom: 4, left: 10, zIndex: 2, pointerEvents: "none" }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: CB + "dd", letterSpacing: "0.12em", textShadow: `0 0 8px ${CB}88` }}>
          B {loadedB ? "← drag to seek →" : "— drop a track —"}
        </span>
      </div>
      {beatOffsetMs !== null && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 2, pointerEvents: "none", textAlign: "center" }}>
          <div style={{ ...glass("rgba(10,12,28,0.7)"), borderRadius: 8, padding: "3px 12px" }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: Math.abs(beatOffsetMs) < 20 ? "#00ff9d" : Math.abs(beatOffsetMs) < 80 ? "#ffd700" : "#ff4455" }}>
              {beatOffsetMs > 0 ? "+" : ""}{beatOffsetMs} ms
            </span>
          </div>
        </div>
      )}
      <div style={{ position: "absolute", top: 4, right: 10, zIndex: 2, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: "#5a5a8a" }}>{barsShown} bars</span>
        <button onClick={() => setWinSec(s => Math.max(2, s / 2))}
          style={{ ...glossyBtn("#3a7bd5"), width: 18, height: 18, fontSize: 12, borderRadius: 4, lineHeight: 1, padding: 0 }}>+</button>
        <button onClick={() => setWinSec(s => Math.min(32, s * 2))}
          style={{ ...glossyBtn("#3a7bd5"), width: 18, height: 18, fontSize: 12, borderRadius: 4, lineHeight: 1, padding: 0 }}>−</button>
      </div>
      <canvas
        ref={canvasRef}
        width={1600} height={150}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ width: "100%", height: 108, display: "block", cursor: "ew-resize" }}
      />
    </div>
  );
}

// ─── Styled range (glossy chrome handle) ──────────────────────────────────────
// Double-click anywhere on the track snaps back to `reset`.
function SRange({ min, max, step = 1, value, onChange, color, pct, reset }: {
  min: number; max: number; step?: number; value: number;
  onChange: (v: number) => void; color: string; pct: number; reset?: number;
}) {
  return (
    <div
      onDoubleClick={reset !== undefined ? () => onChange(reset) : undefined}
      title={reset !== undefined ? "double-click to reset" : undefined}
      style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
      <div style={{ position: "absolute", left: 0, right: 0, height: 8, borderRadius: 4, ...well }} />
      <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 8, borderRadius: 4,
        background: `linear-gradient(180deg, ${color}, ${color}88)`, boxShadow: `0 0 10px ${color}66, inset 0 1px 0 rgba(255,255,255,0.4)` }} />
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        onDoubleClick={reset !== undefined ? () => onChange(reset) : undefined}
        style={{ position: "absolute", left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0 }} />
      <div style={{ position: "absolute", left: `calc(${pct}% - 8px)`, width: 16, height: 16, borderRadius: "50%",
        background: "linear-gradient(180deg, #ffffff, #c2c8dc 55%, #7d8399)",
        border: "1px solid rgba(0,0,0,0.4)",
        boxShadow: `0 2px 6px rgba(0,0,0,0.55), 0 0 10px ${color}66, inset 0 1px 0 rgba(255,255,255,0.9)`,
        pointerEvents: "none", transition: "left 0.04s" }} />
    </div>
  );
}

// ─── EQ vertical slider ───────────────────────────────────────────────────────
// Double-click resets the band to flat (0 dB).
function EQSlider({ label, value, onChange, color }: {
  label: string; value: number; onChange: (v: number) => void; color: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <span style={{ fontFamily: MONO, fontSize: 8, color: color + "aa", textShadow: `0 0 6px ${color}55` }}>{label}</span>
      <div
        onDoubleClick={() => onChange(0)}
        title="double-click to reset"
        style={{ height: 56, width: 26, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, ...well }}>
        <input type="range" min={-12} max={12} step={0.5} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          onDoubleClick={() => onChange(0)}
          style={{ writingMode: "vertical-lr" as const, direction: "rtl" as const, width: 20, height: 50, accentColor: color, cursor: "pointer" }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 8, color: color + "cc" }}>{value > 0 ? `+${value}` : value}</span>
    </div>
  );
}

// ─── Panel caption (Aero title strip) ─────────────────────────────────────────
function Caption({ text, accent, right }: { text: string; accent: string; right?: React.ReactNode }) {
  return (
    <div style={{
      ...titleBar(accent),
      borderRadius: "8px 8px 0 0",
      padding: "4px 10px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
    }}>
      <span>{text}</span>
      {right}
    </div>
  );
}

// ─── YouTube deck body ───────────────────────────────────────────────────────
// Mounted when a deck's source is "youtube". Owns a YouTubeController and the
// link box / transport / playlist nav. No waveform, EQ, tempo or BPM — the
// audio lives in a cross-origin iframe we can't tap.
function YouTubeDeckBody({ side, color, info, onInfoChange, onPlayingChange, ctrlRef, vol, setVol }: {
  side: "A" | "B"; color: string;
  info: DeckInfo; onInfoChange: (p: Partial<DeckInfo>) => void;
  onPlayingChange: (playing: boolean) => void;
  ctrlRef: React.MutableRefObject<YouTubeController | null>;
  vol: number; setVol: (v: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [link, setLink] = useState("");
  const [yt, setYt] = useState<YouTubeState>({
    ready: false, playing: false, duration: 0, title: "", index: -1, listCount: 0,
  });
  const [err, setErr] = useState("");

  // Create the controller once the host div exists.
  useEffect(() => {
    if (!hostRef.current || ctrlRef.current) return;
    const c = new YouTubeController(hostRef.current);
    ctrlRef.current = c;
    const off = c.onChange(setYt);
    return () => { off(); c.destroy(); ctrlRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep player volume in sync with the deck's volume slider.
  useEffect(() => { ctrlRef.current?.setVol(vol / 100); }, [vol, ctrlRef]);

  // Push YouTube's ready / title state up into the shared DeckInfo so the rest
  // of the app (status strip, master toggle) sees a loaded, named deck.
  useEffect(() => {
    onInfoChange({
      loaded: yt.ready,
      trackName: yt.title || (yt.ready ? "YouTube" : ""),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yt.ready, yt.title]);

  // Mirror the player's own play/pause (the user can drive it from inside the
  // iframe too) into the deck's playing state.
  useEffect(() => {
    onPlayingChange(yt.playing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yt.playing]);

  function submit() {
    const parsed = parseYouTubeUrl(link);
    if (parsed.kind === "invalid") { setErr("Link do YouTube inválido"); return; }
    setErr("");
    ctrlRef.current?.load(parsed);
  }

  const c   = ctrlRef.current;
  const cur = c?.currentTime() ?? 0;
  const dur = yt.duration || 0;
  const pct = dur ? (cur / dur) * 100 : 0;
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 12px 10px", flex: 1, minHeight: 0, overflowY: "auto" }}>
      {/* link box */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={link}
          onChange={e => setLink(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          placeholder="cole link de vídeo ou playlist do YouTube"
          style={{
            flex: 1, background: "rgba(0,0,0,0.4)", border: `1px solid ${color}55`,
            borderRadius: 6, color: "#dfe7ff", fontFamily: MONO, fontSize: 9,
            padding: "6px 8px", outline: "none",
          }}
        />
        <button onClick={submit}
          style={{ ...glossyBtn(side === "A" ? "#1f6fae" : "#c85a1e"), padding: "0 14px", height: 30, fontSize: 9 }}>
          LOAD
        </button>
      </div>
      {err && <span style={{ fontFamily: MONO, fontSize: 8, color: "#ff6a6a" }}>{err}</span>}

      {/* the actual iframe — kept small; audio is what matters here */}
      <div style={{ borderRadius: 8, overflow: "hidden", ...well, aspectRatio: "16 / 9", position: "relative" }}>
        <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
        {!yt.ready && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: MONO, fontSize: 9, color: "#5a5a8a" }}>
            {link ? "carregando…" : "sem vídeo"}
          </div>
        )}
      </div>

      {/* now playing */}
      <div style={{ padding: "6px 10px", borderRadius: 8, ...well }}>
        <div style={{ fontFamily: MONO, fontSize: 8, color: "#6a6a9a", letterSpacing: "0.12em", marginBottom: 2 }}>
          TOCANDO {yt.listCount > 0 && <span style={{ color: color + "aa" }}>· {yt.index + 1}/{yt.listCount}</span>}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {yt.title || "—"}
        </div>
      </div>

      {/* transport */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => c?.prev()} disabled={yt.listCount === 0}
          style={{ ...glossyBtn("#3a3f66"), flex: 1, height: 28, fontSize: 11, opacity: yt.listCount ? 1 : 0.35 }}>
          ⏮
        </button>
        <button onClick={() => (yt.playing ? c?.pause() : c?.play())} disabled={!yt.ready}
          style={{ ...glossyBtn(color, yt.playing), flex: 2, height: 28, fontSize: 10,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: yt.ready ? 1 : 0.35 }}>
          {yt.playing ? <Pause size={11} /> : <Play size={11} />} {yt.playing ? "PAUSE" : "PLAY"}
        </button>
        <button onClick={() => c?.next()} disabled={yt.listCount === 0}
          style={{ ...glossyBtn("#3a3f66"), flex: 1, height: 28, fontSize: 11, opacity: yt.listCount ? 1 : 0.35 }}>
          ⏭
        </button>
      </div>

      {/* seek bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontFamily: MONO, fontSize: 8, color: "#7a7aaa" }}>
          <span>{fmt(cur)}</span><span>{fmt(dur)}</span>
        </div>
        <div
          onPointerDown={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const f = (e.clientX - rect.left) / rect.width;
            if (dur) c?.seek(f * dur);
          }}
          style={{ position: "relative", height: 14, display: "flex", alignItems: "center", cursor: "pointer" }}>
          <div style={{ position: "absolute", left: 0, right: 0, height: 8, borderRadius: 4, ...well }} />
          <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 8, borderRadius: 4,
            background: `linear-gradient(180deg, ${color}, ${color}88)`, boxShadow: `0 0 10px ${color}66` }} />
        </div>
      </div>

      {/* volume */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: "#7a7aaa" }}>VOLUME</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: color + "cc" }}>{vol}%</span>
        </div>
        <SRange min={0} max={100} value={vol} onChange={setVol} color={color} pct={vol} reset={80} />
      </div>

      <div style={{ fontFamily: MONO, fontSize: 8, color: "#4a4a70", lineHeight: 1.5 }}>
        modo YouTube: sem waveform, BPM, EQ ou crossfader — o áudio fica no player.
        controle a mixagem pelo volume e de ouvido.
      </div>
    </div>
  );
}

// ─── Deck panel ───────────────────────────────────────────────────────────────
function DeckPanel({ side, color, info, onInfoChange, audioRef, ytRef, onLoad, playing, onToggle, onSourceChange, onPlayingChange }: {
  side: "A" | "B"; color: string;
  info: DeckInfo; onInfoChange: (p: Partial<DeckInfo>) => void;
  audioRef: React.RefObject<DeckAudio | null>;
  ytRef: React.MutableRefObject<YouTubeController | null>;
  onLoad: (peaks: number[], duration: number) => void;
  playing: boolean;
  onToggle: () => void;
  onSourceChange: (s: DeckSource) => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const [vol, setVol] = useState(80);
  const [eqLo,    setEqLo]    = useState(0);
  const [eqMi,    setEqMi]    = useState(0);
  const [eqHi,    setEqHi]    = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { audioRef.current?.setVol(vol / 100); }, [vol, audioRef]);
  useEffect(() => { audioRef.current?.setRate(1 + info.tempo / 100); }, [info.tempo, audioRef]);
  useEffect(() => { audioRef.current?.setEQ(eqLo, eqMi, eqHi); }, [eqLo, eqMi, eqHi, audioRef]);

  const [loadingDemo, setLoadingDemo] = useState(false);
  const [bpmDetecting, setBpmDetecting] = useState(false);
  // Bumped on every load so a slow analysis from a previous track can't write
  // its BPM onto whatever got loaded after it.
  const loadTokenRef = useRef(0);

  async function loadFile(file: File, extra?: Partial<DeckInfo>) {
    const audio = audioRef.current;
    if (!audio) return;
    const token = ++loadTokenRef.current;
    try {
      const buf = await audio.load(file);
      if (token !== loadTokenRef.current) return;
      onLoad(computePeaks(buf, 4000), buf.duration);
      onInfoChange({ trackName: file.name.replace(/\.[^.]+$/, ""), loaded: true, ...extra });

      // Analyse the real tempo in a worker; overwrite the placeholder/demo BPM
      // once we have a usable estimate.
      setBpmDetecting(true);
      detectBpm(buf)
        .then(res => {
          if (token !== loadTokenRef.current) return;
          if (res.bpm >= 60 && res.bpm <= 200 && res.confidence >= 0.12) {
            onInfoChange({ bpm: res.bpm });
          }
        })
        .catch(e => console.error("BPM detect failed:", e))
        .finally(() => { if (token === loadTokenRef.current) setBpmDetecting(false); });
    } catch (e) { console.error("Decode error:", e); }
  }

  async function loadDemo() {
    const d = DEMOS[side];
    setLoadingDemo(true);
    try {
      const file = await fetchAsFile(d.url, d.name);
      await loadFile(file, { bpm: d.bpm, camelotPos: d.pos, camelotType: d.type });
    } catch (e) { console.error("Demo load failed:", e); }
    finally { setLoadingDemo(false); }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }

  const effBpm   = Math.round(info.bpm * (1 + info.tempo / 100));
  const keyName  = CAMELOT.find(c => c.pos === info.camelotPos)?.[info.camelotType] ?? "";
  const tempoPct = ((info.tempo + 8) / 16) * 100;

  return (
    <div style={{ ...chromeFrame, margin: 6, display: "flex", flexDirection: "column", overflow: "hidden", height: "calc(100% - 12px)" }}>
      <Caption
        text={`DECK ${side}`}
        accent={side === "A" ? "#1f6fae" : "#c85a1e"}
        right={
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 9, letterSpacing: "0.15em" }}>
            {/* source toggle: local file vs YouTube */}
            <span style={{ display: "flex", borderRadius: 5, overflow: "hidden", border: "1px solid rgba(255,255,255,0.25)" }}>
              {([["local", FileAudio], ["youtube", Youtube]] as const).map(([s, Icon]) => (
                <button key={s}
                  onClick={e => { e.stopPropagation(); if (info.source !== s) onSourceChange(s); }}
                  title={s === "local" ? "arquivo local" : "YouTube"}
                  style={{
                    width: 24, height: 18, padding: 0, border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: info.source === s ? "#fff" : "#8a92c8",
                    background: info.source === s
                      ? `linear-gradient(180deg, #ffffff44, ${color}cc)`
                      : "rgba(0,0,0,0.25)",
                  }}>
                  <Icon size={11} />
                </button>
              ))}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: playing ? color : "#556",
                boxShadow: playing ? `0 0 8px ${color}` : "none" }} />
              {playing ? "PLAYING" : "PAUSED"}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onToggle(); }}
              disabled={!info.loaded}
              title={`${playing ? "pause" : "play"} deck ${side}  (key: ${side === "A" ? "A" : "D"})`}
              style={{
                width: 26, height: 20, borderRadius: 5, padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: info.loaded ? "pointer" : "not-allowed",
                opacity: info.loaded ? 1 : 0.4,
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.4)",
                background: playing
                  ? `linear-gradient(180deg, #ffffff66, ${color}cc 55%, ${color})`
                  : "linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0.08) 55%, rgba(0,0,0,0.2))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.4)",
              }}>
              {playing ? <Pause size={11} /> : <Play size={11} />}
            </button>
          </span>
        }
      />
      {info.source === "youtube" ? (
        <YouTubeDeckBody
          side={side} color={color} info={info}
          onInfoChange={onInfoChange} onPlayingChange={onPlayingChange}
          ctrlRef={ytRef} vol={vol} setVol={setVol}
        />
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 12px 10px", flex: 1, minHeight: 0, justifyContent: "space-between", overflowY: "auto" }}>
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          style={{
            borderRadius: 8, cursor: "pointer", padding: "6px 10px",
            display: "flex", alignItems: "center", gap: 8,
            ...glass(dragOver ? `${color}22` : "rgba(20,26,48,0.4)"),
            border: `1px dashed ${dragOver ? color : color + "55"}`,
            transition: "border-color .2s, background .2s",
          }}>
          <Upload size={14} style={{ color: color + "cc", flexShrink: 0 }} />
          <span style={{ fontFamily: MONO, fontSize: 9, color: color + "cc", letterSpacing: "0.1em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {info.loaded ? info.trackName : "DROP AUDIO / CLICK TO LOAD"}
          </span>
        </div>
        <input ref={fileRef} type="file" accept="audio/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />

        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "6px 12px", borderRadius: 8, ...well }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, color: "#6a6a9a", marginBottom: 1, letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: 4 }}>
              BPM
              {bpmDetecting && (
                <span style={{ color: color + "cc", letterSpacing: 0, animation: "pulse 1s ease-in-out infinite" }}>· detecting…</span>
              )}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, lineHeight: 1, color,
              textShadow: `0 0 24px ${color}66, 0 2px 4px rgba(0,0,0,0.6)` }}>{effBpm}</div>
          </div>
          <input type="number" value={info.bpm} min={60} max={220}
            onChange={e => onInfoChange({ bpm: Math.max(60, Math.min(220, parseInt(e.target.value) || 128)) })}
            onDoubleClick={() => onInfoChange({ bpm: 128 })}
            title="double-click to reset"
            style={{ width: 52, background: "rgba(0,0,0,0.4)", border: `1px solid ${color}44`, borderRadius: 4, color: color, fontFamily: MONO, fontSize: 10, padding: "3px 4px", outline: "none", textAlign: "center", alignSelf: "flex-end", marginBottom: 4 }}
          />
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: "#6a6a9a", marginBottom: 1, letterSpacing: "0.12em" }}>KEY</div>
            <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, lineHeight: 1, color,
              textShadow: `0 0 16px ${color}55` }}>{info.camelotPos}{info.camelotType}</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: color + "aa", marginTop: 2 }}>{keyName}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => fileRef.current?.click()}
            style={{ ...glossyBtn(side === "A" ? "#1f6fae" : "#c85a1e"), flex: 1, padding: "0 14px", height: 24, fontSize: 9,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Upload size={10} /> LOAD TRACK
          </button>
          <button onClick={loadDemo} disabled={loadingDemo}
            title={`load demo: ${DEMOS[side].name}`}
            style={{ ...glossyBtn(side === "A" ? "#1f6fae" : "#c85a1e"), padding: "0 12px", height: 24, fontSize: 9,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              opacity: loadingDemo ? 0.6 : 1, cursor: loadingDemo ? "wait" : "pointer" }}>
            <Disc3 size={10} /> {loadingDemo ? "…" : "DEMO"}
          </button>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: "#7a7aaa" }}>TEMPO {info.tempo > 0 ? `+${info.tempo.toFixed(1)}` : info.tempo.toFixed(1)}%</span>
            <button onClick={() => onInfoChange({ tempo: 0 })} style={{ fontFamily: MONO, fontSize: 9, color: color + "88", background: "none", border: "none", cursor: "pointer", padding: 0 }}>RESET</button>
          </div>
          <SRange min={-8} max={8} step={0.1} value={info.tempo} onChange={v => onInfoChange({ tempo: v })} color={color} pct={tempoPct} reset={0} />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: "#7a7aaa" }}>VOLUME</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: color + "cc" }}>{vol}%</span>
          </div>
          <SRange min={0} max={100} value={vol} onChange={setVol} color={color} pct={vol} reset={80} />
        </div>

        <div style={{ padding: "5px 12px 6px", borderRadius: 8, ...well }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: "#7a7aaa", letterSpacing: "0.1em" }}>EQ</span>
            <div style={{ display: "flex", justifyContent: "space-around", flex: 1 }}>
              <EQSlider label="HI"  value={eqHi} onChange={setEqHi} color={color} />
              <EQSlider label="MID" value={eqMi} onChange={setEqMi} color={color} />
              <EQSlider label="LO"  value={eqLo} onChange={setEqLo} color={color} />
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#7a7aaa", marginBottom: 4, letterSpacing: "0.1em" }}>CAMELOT KEY</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 3, marginBottom: 5 }}>
            {CAMELOT.map(({ pos }) => (
              <button key={pos} onClick={() => onInfoChange({ camelotPos: pos })}
                style={{ ...glossyBtn(color, info.camelotPos === pos), height: 22, fontSize: 9, fontWeight: 700, borderRadius: 4, padding: 0 }}>
                {pos}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["A", "B"] as KeyType[]).map(t => (
              <button key={t} onClick={() => onInfoChange({ camelotType: t })}
                style={{ ...glossyBtn(color, info.camelotType === t), flex: 1, height: 26, fontSize: 10, fontWeight: 700 }}>
                {t === "A" ? "A — MINOR" : "B — MAJOR"}
              </button>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// ─── Window chrome (drag + fake OS controls) ─────────────────────────────────
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ─── App ─────────────────────────────────────────────────────────────────────
const initDeck = (bpm: number, pos: number, type: KeyType): DeckInfo => ({
  camelotPos: pos, camelotType: type, bpm, tempo: 0, trackName: "", loaded: false,
  source: "local",
});

export default function App({ onOpenSpotify }: { onOpenSpotify?: () => void }) {
  const [deckA,   setDeckA]   = useState<DeckInfo>(initDeck(128, 8, "B"));
  const [deckB,   setDeckB]   = useState<DeckInfo>(initDeck(128, 5, "A"));
  const [peaksA,  setPeaksA]  = useState<number[]>([]);
  const [peaksB,  setPeaksB]  = useState<number[]>([]);
  const [durA,    setDurA]    = useState(0);
  const [durB,    setDurB]    = useState(0);
  const [cf,      setCf]      = useState(50);
  const [playingA, setPlayingA] = useState(false);
  const [playingB, setPlayingB] = useState(false);
  const playing = playingA || playingB;
  const [maximized, setMaximized] = useState(true);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [checkpoints, setCheckpoints] = useState<{ id: number; tA: number; tB: number }[]>([]);
  const cpIdRef = useRef(1);
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const audioARef = useRef<DeckAudio | null>(null);
  const audioBRef = useRef<DeckAudio | null>(null);
  // YouTube controllers — created lazily by YouTubeDeckBody when a deck switches
  // to that source, torn down when it switches back.
  const ytARef = useRef<YouTubeController | null>(null);
  const ytBRef = useRef<YouTubeController | null>(null);
  const clock = useClock();

  if (!audioARef.current && typeof AudioContext !== "undefined") {
    const ctx = getCtx();
    audioARef.current = new DeckAudio(ctx);
    audioBRef.current = new DeckAudio(ctx);
  }

  // The active transport for a deck: its YouTube controller when that's the
  // source, otherwise its Web Audio engine. Both expose play/pause/currentTime.
  function engine(side: "A" | "B"): { play(): void; pause(): void } | null {
    const src = side === "A" ? deckA.source : deckB.source;
    if (src === "youtube") return side === "A" ? ytARef.current : ytBRef.current;
    return side === "A" ? audioARef.current : audioBRef.current;
  }

  useEffect(() => {
    const t = cf / 100;
    audioARef.current?.setCF(t < 0.5 ? 1 : 1 - (t - 0.5) * 2);
    audioBRef.current?.setCF(t > 0.5 ? 1 : t * 2);
  }, [cf]);

  // Live refs so the keyboard listener (mounted once) never sees stale state.
  const stateRef = useRef({ la: false, lb: false, pa: false, pb: false });
  stateRef.current = { la: deckA.loaded, lb: deckB.loaded, pa: playingA, pb: playingB };

  // Toggle a single deck's playback.
  function toggleDeck(side: "A" | "B") {
    const { la, lb, pa, pb } = stateRef.current;
    if (side === "A") {
      if (!la) return;
      if (pa) { engine("A")?.pause(); setPlayingA(false); }
      else    { engine("A")?.play();  setPlayingA(true); }
    } else {
      if (!lb) return;
      if (pb) { engine("B")?.pause(); setPlayingB(false); }
      else    { engine("B")?.play();  setPlayingB(true); }
    }
  }

  // Master: if anything is playing → stop both; otherwise → start every loaded deck.
  function masterToggle() {
    const { la, lb, pa, pb } = stateRef.current;
    if (pa || pb) {
      engine("A")?.pause(); engine("B")?.pause();
      setPlayingA(false); setPlayingB(false);
    } else {
      if (la) { engine("A")?.play(); setPlayingA(true); }
      if (lb) { engine("B")?.play(); setPlayingB(true); }
    }
  }

  // Switching source: stop whatever's playing on that deck and reset its slot.
  function changeSource(side: "A" | "B", next: DeckSource) {
    if (side === "A") {
      audioARef.current?.pause(); ytARef.current?.pause();
      setPlayingA(false);
      setPeaksA([]); setDurA(0);
      setDeckA(d => ({ ...d, source: next, loaded: false, trackName: "" }));
    } else {
      audioBRef.current?.pause(); ytBRef.current?.pause();
      setPlayingB(false);
      setPeaksB([]); setDurB(0);
      setDeckB(d => ({ ...d, source: next, loaded: false, trackName: "" }));
    }
  }

  // ── Checkpoints ────────────────────────────────────────────────────────────
  // Whichever transport currently backs a deck, for time read/seek. YouTube and
  // Web Audio both expose currentTime() and seek().
  const transport = (side: "A" | "B") => {
    const src = side === "A" ? deckA.source : deckB.source;
    if (src === "youtube") return side === "A" ? ytARef.current : ytBRef.current;
    return side === "A" ? audioARef.current : audioBRef.current;
  };

  // Enter snapshots both decks' current positions as one numbered checkpoint.
  function addCheckpoint() {
    const { la, lb } = stateRef.current;
    if (!la && !lb) return;
    const tA = transport("A")?.currentTime() ?? 0;
    const tB = transport("B")?.currentTime() ?? 0;
    setCheckpoints(cs => [...cs, { id: cpIdRef.current++, tA, tB }]);
  }
  // Jump both decks to a checkpoint's positions — playback state is untouched.
  function jumpCheckpoint(id: number) {
    const cp = checkpoints.find(c => c.id === id);
    if (!cp) return;
    transport("A")?.seek(cp.tA);
    transport("B")?.seek(cp.tB);
  }
  // Sync B onto A using a checkpoint: at that CP both decks were meant to be at
  // the same musical point, so shift B by the A/B offset recorded there.
  function syncFromCheckpoint(id: number) {
    const cp = checkpoints.find(c => c.id === id);
    const b  = transport("B");
    if (!cp || !b) return;
    b.seek(b.currentTime() + (cp.tA - cp.tB));
  }
  function removeCheckpoint(id: number) {
    setCheckpoints(cs => cs.filter(c => c.id !== id));
  }

  // Keep a live ref for the keyboard handler (mounted once).
  const cpRef = useRef<{ jump: (i: number) => void; add: () => void }>({ jump: () => {}, add: () => {} });
  cpRef.current = {
    add: addCheckpoint,
    jump: (idx: number) => { const cp = checkpoints[idx]; if (cp) jumpCheckpoint(cp.id); },
  };

  // Keyboard: Space = master, A = deck A, D = deck B, Enter = checkpoint,
  // 1-9 = jump to checkpoint N (ignored while typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Space" || e.key === " ") { e.preventDefault(); masterToggle(); return; }
      if (e.key === "Enter") { e.preventDefault(); cpRef.current.add(); return; }
      if (e.key >= "1" && e.key <= "9") { e.preventDefault(); cpRef.current.jump(+e.key - 1); return; }
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft")  { e.preventDefault(); toggleDeck("A"); return; }
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") { e.preventDefault(); toggleDeck("B"); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncBpm() {
    const target = deckA.bpm * (1 + deckA.tempo / 100);
    const needed = ((target / deckB.bpm) - 1) * 100;
    setDeckB(d => ({ ...d, tempo: parseFloat(Math.max(-8, Math.min(8, needed)).toFixed(1)) }));
  }

  function onTitleDown(e: React.PointerEvent) {
    if (maximized) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onTitleMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setPos({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) });
  }
  function onTitleUp() { dragRef.current = null; }

  const compat = getCompat(deckA.camelotPos, deckA.camelotType, deckB.camelotPos, deckB.camelotType);
  const cc     = compatColor(compat);
  const effA   = deckA.bpm * (1 + deckA.tempo / 100);
  const effB   = deckB.bpm * (1 + deckB.tempo / 100);
  const diff   = Math.abs(effA - effB).toFixed(1);
  const keyA   = CAMELOT.find(c => c.pos === deckA.camelotPos)?.[deckA.camelotType] ?? "";
  const keyB   = CAMELOT.find(c => c.pos === deckB.camelotPos)?.[deckB.camelotType] ?? "";

  const winStyle: React.CSSProperties = maximized
    ? { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
        width: "calc(100vw - 16px)", maxWidth: 1600,
        height: "calc(100vh - 50px)", maxHeight: 820 }
    : { position: "absolute", left: "50%", top: "50%",
        width: "min(1200px, 94vw)", height: "min(720px, 88vh)",
        transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` };

  return (
    <div style={{ ...desktopBg, position: "fixed", inset: 0, overflow: "hidden", fontFamily: UI }}>
      {/* floating desktop bubbles (Frutiger Aero) */}
      {[
        { s: 220, l: "6%",  t: "10%", d: 26 },
        { s: 140, l: "82%", t: "18%", d: 32 },
        { s: 90,  l: "70%", t: "70%", d: 20 },
        { s: 160, l: "20%", t: "68%", d: 38 },
      ].map((b, i) => (
        <div key={i} style={{
          position: "absolute", left: b.l, top: b.t, width: b.s, height: b.s, borderRadius: "50%",
          background: "radial-gradient(circle at 32% 30%, rgba(255,255,255,0.5), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 70%)",
          filter: "blur(0.5px)", pointerEvents: "none",
          animation: `float-${i % 2} ${b.d}s ease-in-out infinite alternate`,
        }} />
      ))}

      {/* ── The Aero window ── */}
      <div style={{
        ...winStyle,
        display: "flex", flexDirection: "column",
        borderRadius: 12, overflow: "hidden",
        ...glass("rgba(12,16,32,0.72)"),
      }}>
        {/* title bar */}
        <div
          onPointerDown={onTitleDown}
          onPointerMove={onTitleMove}
          onPointerUp={onTitleUp}
          onDoubleClick={() => setMaximized(m => !m)}
          style={{
            ...titleBar("#2f6fbf"),
            height: 28, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 6px 0 12px",
            cursor: maximized ? "default" : "grab",
            userSelect: "none",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Music size={14} />
            <span style={{ fontFamily: COND, fontSize: 15, fontWeight: 800, letterSpacing: "0.24em" }}>CAMELOT DJ</span>
            <span style={{ fontFamily: MONO, fontSize: 9, opacity: 0.75, marginLeft: 6 }}>harmonic mixer</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { icon: <Minus size={11} />, key: "min" },
              { icon: <Square size={9} />, key: "max", onClick: () => setMaximized(m => !m) },
              { icon: <X size={11} />, key: "close" },
            ].map(b => (
              <button key={b.key} onClick={b.onClick}
                style={{
                  width: 24, height: 19, borderRadius: 5,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", cursor: "pointer",
                  border: "1px solid rgba(255,255,255,0.35)",
                  background: b.key === "close"
                    ? "linear-gradient(180deg, #ff8a7a, #d63a2a 55%, #b52a1c)"
                    : "linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0.08) 55%, rgba(0,0,0,0.15))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.4)",
                }}>
                {b.icon}
              </button>
            ))}
          </div>
        </div>

        {/* status strip */}
        <div style={{
          flexShrink: 0, height: 24, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 14px",
          background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(0,0,0,0.10))",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: cc, boxShadow: `0 0 10px ${cc}` }} />
            <span style={{ fontFamily: MONO, fontSize: 10, color: cc, letterSpacing: "0.14em", textShadow: `0 0 8px ${cc}88` }}>{compat}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: MONO, fontSize: 9, color: "#9aa2c8" }}>
            <span>A {keyA} · {Math.round(effA)} BPM</span>
            <Link2 size={10} style={{ color: "#5a6088" }} />
            <span>B {keyB} · {Math.round(effB)} BPM</span>
          </div>
        </div>

        {/* body */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: BG }}>
          <TransitionView
            peaksA={peaksA} peaksB={peaksB}
            durationA={durA} durationB={durB}
            bpmA={effA} bpmB={effB}
            loadedA={deckA.loaded && deckA.source === "local"}
            loadedB={deckB.loaded && deckB.source === "local"}
            audioARef={audioARef} audioBRef={audioBRef}
            checkpoints={checkpoints}
          />
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 272px 1fr", minHeight: 0 }}>
            <div style={{ minHeight: 0 }}>
              <DeckPanel side="A" color={CA} info={deckA}
                onInfoChange={p => setDeckA(d => ({ ...d, ...p }))}
                audioRef={audioARef} ytRef={ytARef}
                onLoad={(pk, dur) => { setPeaksA(pk); setDurA(dur); }}
                playing={playingA} onToggle={() => toggleDeck("A")}
                onSourceChange={s => changeSource("A", s)}
                onPlayingChange={setPlayingA} />
            </div>

            {/* ── Mixer column ── */}
            <div style={{ ...chromeFrame, margin: 6, display: "flex", flexDirection: "column", overflow: "hidden", height: "calc(100% - 12px)" }}>
              <Caption text="MIXER" accent="#3a3f66" />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "8px 12px", flex: 1, minHeight: 0 }}>
                <CamelotWheel aPos={deckA.camelotPos} aType={deckA.camelotType} bPos={deckB.camelotPos} bType={deckB.camelotType} />

                <button onClick={masterToggle}
                  disabled={!deckA.loaded && !deckB.loaded}
                  style={{
                    position: "relative",
                    width: 54, height: 54, borderRadius: "50%",
                    border: `2px solid ${playing ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)"}`,
                    background: playing
                      ? `radial-gradient(circle at 50% 30%, #ffffff55, ${CA} 45%, ${CB} 100%)`
                      : "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.3), #2a3050 55%, #171c30)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: (!deckA.loaded && !deckB.loaded) ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    boxShadow: playing
                      ? `0 0 28px ${CA}66, 0 0 28px ${CB}66, inset 0 2px 4px rgba(255,255,255,0.5)`
                      : "0 4px 12px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.25)",
                    opacity: (!deckA.loaded && !deckB.loaded) ? 0.4 : 1,
                    flexShrink: 0,
                  }}>
                  <span style={orbSheen} />
                  {playing ? <Pause size={22} color="#fff" /> : <Play size={22} color="#fff" />}
                </button>

                <div style={{ display: "flex", gap: 6, width: "100%", alignItems: "center" }}>
                  <div style={{ flex: 1, textAlign: "center", padding: "5px 4px", borderRadius: 8, ...well }}>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: CA, textShadow: `0 0 10px ${CA}66` }}>{deckA.camelotPos}{deckA.camelotType}</div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: CA + "99", marginTop: 1 }}>{keyA}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: "#6a6a9a" }}>DIFF</div>
                    <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: parseFloat(diff) < 1 ? "#00ff9d" : parseFloat(diff) < 4 ? "#ffd700" : "#ff4455" }}>{diff}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", padding: "5px 4px", borderRadius: 8, ...well }}>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: CB, textShadow: `0 0 10px ${CB}66` }}>{deckB.camelotPos}{deckB.camelotType}</div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: CB + "99", marginTop: 1 }}>{keyB}</div>
                  </div>
                </div>

                <div style={{ width: "100%", padding: "5px 12px", borderRadius: 8, ...well, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: CA }}>{Math.round(effA)}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: cc, letterSpacing: "0.14em", textShadow: `0 0 8px ${cc}88` }}>{compat}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: CB }}>{Math.round(effB)}</span>
                </div>

                <button onClick={syncBpm}
                  style={{ ...glossyBtn("#c9a227"), width: "100%", padding: "7px", fontSize: 10,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Zap size={11} /> SYNC BPM A → B
                </button>

                <div style={{ width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: CA }}>A</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: "#6a6a9a" }}>CROSSFADER</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: CB }}>B</span>
                  </div>
                  <div onDoubleClick={() => setCf(50)} title="double-click to center"
                    style={{ position: "relative", height: 26, display: "flex", alignItems: "center" }}>
                    <div style={{ position: "absolute", left: 0, right: 0, height: 10, borderRadius: 5, ...well }} />
                    <div style={{ position: "absolute", left: 0, right: 0, height: 10, borderRadius: 5,
                      background: `linear-gradient(to right, ${CA}, transparent 42%, transparent 58%, ${CB})`, opacity: 0.5 }} />
                    <input type="range" min={0} max={100} value={cf} onChange={e => setCf(+e.target.value)}
                      onDoubleClick={() => setCf(50)}
                      style={{ position: "absolute", left: 0, width: "100%", height: "100%", opacity: 0, cursor: "ew-resize", margin: 0 }} />
                    <div style={{ position: "absolute", left: `calc(${cf}% - 11px)`, width: 22, height: 26, borderRadius: 6,
                      background: "linear-gradient(180deg, #ffffff, #c2c8dc 50%, #7d8399)",
                      border: "1px solid rgba(0,0,0,0.45)",
                      boxShadow: "0 3px 10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 4px rgba(0,0,0,0.3)",
                      pointerEvents: "none", transition: "left 0.04s" }} />
                  </div>
                </div>

                <button onClick={() => setCf(50)}
                  style={{ ...glossyBtn("#3a3f66"), padding: "5px 16px", fontSize: 9 }}>
                  CENTER
                </button>

                {/* ── Checkpoints ── */}
                <div style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", ...well, borderRadius: 8, padding: "6px 8px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: "#7a7aaa", letterSpacing: "0.12em" }}>
                      CHECKPOINTS
                    </span>
                    <button onClick={addCheckpoint}
                      disabled={!deckA.loaded && !deckB.loaded}
                      title="mark checkpoint (Enter)"
                      style={{ ...glossyBtn("#3a7bd5"), padding: "2px 8px", fontSize: 8, letterSpacing: "0.1em",
                        opacity: (!deckA.loaded && !deckB.loaded) ? 0.4 : 1 }}>
                      + SET · ⏎
                    </button>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                    {checkpoints.length === 0 && (
                      <span style={{ fontFamily: MONO, fontSize: 8, color: "#4a4a70", lineHeight: 1.5 }}>
                        press ⏎ to snapshot both decks · keys 1-9 jump
                      </span>
                    )}
                    {checkpoints.map((cp, i) => (
                      <div key={cp.id} style={{
                        display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", alignItems: "center", gap: 5,
                        padding: "3px 5px", borderRadius: 5,
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: "#8a92c8" }}>
                          {i + 1 <= 9 ? i + 1 : "·"}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 8, color: "#7a7aaa" }}>
                          <span style={{ color: CA }}>{cp.tA.toFixed(1)}</span>
                          {" / "}
                          <span style={{ color: CB }}>{cp.tB.toFixed(1)}</span>
                        </span>
                        <button onClick={() => jumpCheckpoint(cp.id)} title="jump both decks here"
                          style={{ ...glossyBtn("#3a7bd5"), width: 22, height: 18, fontSize: 10, padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center" }}>↦</button>
                        <button onClick={() => syncFromCheckpoint(cp.id)} title="sync B onto A using this checkpoint"
                          style={{ ...glossyBtn("#c9a227"), width: 22, height: 18, fontSize: 10, padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center" }}>⇄</button>
                        <button onClick={() => removeCheckpoint(cp.id)} title="delete"
                          style={{ ...glossyBtn("#7a3a3a"), width: 22, height: 18, fontSize: 9, padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ minHeight: 0 }}>
              <DeckPanel side="B" color={CB} info={deckB}
                onInfoChange={p => setDeckB(d => ({ ...d, ...p }))}
                audioRef={audioBRef} ytRef={ytBRef}
                onLoad={(pk, dur) => { setPeaksB(pk); setDurB(dur); }}
                playing={playingB} onToggle={() => toggleDeck("B")}
                onSourceChange={s => changeSource("B", s)}
                onPlayingChange={setPlayingB} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Taskbar ── */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: 34,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 8px",
        background: "linear-gradient(180deg, #3a7bd5 0%, #2a5fb0 6%, #16396e 55%, #0d2140 100%)",
        borderTop: "1px solid rgba(255,255,255,0.4)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 -2px 10px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button style={{
            display: "flex", alignItems: "center", gap: 7, height: 26, padding: "0 16px 0 10px",
            borderRadius: "6px 14px 14px 6px", cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.35)",
            background: "linear-gradient(180deg, #7dd36a 0%, #3fa02f 45%, #2f7f22 55%, #256b1c 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 6px rgba(0,0,0,0.4)",
            color: "#fff", fontFamily: COND, fontSize: 15, fontWeight: 800, fontStyle: "italic",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)", letterSpacing: "0.04em",
          }}>
            <Music size={15} /> start
          </button>
          {onOpenSpotify && (
            <button onClick={onOpenSpotify} style={{
              display: "flex", alignItems: "center", gap: 6, height: 24, padding: "0 12px",
              borderRadius: 5, cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.3)",
              background: "linear-gradient(180deg, rgba(29,185,84,0.9), rgba(20,120,55,0.9))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 5px rgba(0,0,0,0.4)",
              color: "#fff", fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            }}>
              <Music2 size={12} /> SPOTIFY
            </button>
          )}
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, height: 24, padding: "0 12px",
          borderRadius: 5, color: "#dfe7ff", fontFamily: MONO, fontSize: 10,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.15), rgba(0,0,0,0.15))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
        }}>
          {playing
            ? <><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5dff9d", boxShadow: "0 0 8px #5dff9d" }} /> MIXING</>
            : <>IDLE</>}
          <span style={{ marginLeft: 8, opacity: 0.85 }}>
            {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}
