import { useState, useRef, useEffect, type DragEvent } from "react";
import { Play, Pause, Upload, Zap, Link2, Music } from "lucide-react";

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

const CA   = "#00e5ff";
const CB   = "#ff6b1a";
const BG   = "#07070f";
const MONO = "'JetBrains Mono', monospace";
const COND = "'Barlow Condensed', sans-serif";

type KeyType = "A" | "B";

interface DeckInfo {
  camelotPos:  number;
  camelotType: KeyType;
  bpm:         number;
  tempo:       number;
  trackName:   string;
  loaded:      boolean;
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
    <svg width={260} height={260} viewBox="0 0 260 260">
      {CAMELOT.map(({ pos }) => {
        const a0  = (pos - 1) * 30 - 14.5, a1 = a0 + 29, mid = (a0 + a1) / 2;
        const isAa = pos === aPos && aType === "A", isAb = pos === bPos && bType === "A";
        const isBa = pos === aPos && aType === "B", isBb = pos === bPos && bType === "B";
        const fillA = isAa ? CA : isAb ? CB : "#111128";
        const fillB = isBa ? CA : isBb ? CB : "#181832";
        const tA    = (isAa || isAb) ? BG : "#50508a";
        const tB    = (isBa || isBb) ? BG : "#60609a";
        const cA    = polar(C, C, (R0 + R1) / 2, mid);
        const cB    = polar(C, C, (R1 + R2) / 2, mid);
        return (
          <g key={pos}>
            <path d={arcPath(C, C, R0, R1, a0, a1)} fill={fillA} stroke={BG} strokeWidth={1.5} style={{ transition: "fill 0.25s" }} />
            <path d={arcPath(C, C, R1, R2, a0, a1)} fill={fillB} stroke={BG} strokeWidth={1.5} style={{ transition: "fill 0.25s" }} />
            <text x={cA.x} y={cA.y} textAnchor="middle" dominantBaseline="middle" fontSize={7}   fill={tA} fontFamily={MONO} fontWeight={700} style={{ pointerEvents: "none", userSelect: "none" }}>{pos}A</text>
            <text x={cB.x} y={cB.y} textAnchor="middle" dominantBaseline="middle" fontSize={6.5} fill={tB} fontFamily={MONO} fontWeight={600} style={{ pointerEvents: "none", userSelect: "none" }}>{pos}B</text>
          </g>
        );
      })}
      <circle cx={C} cy={C} r={R0 - 2} fill={BG} stroke="#12122a" strokeWidth={1} />
      <text x={C} y={C - 7} textAnchor="middle" fontSize={7.5} fill="#3a3a6a" fontFamily={MONO}>CAMELOT</text>
      <text x={C} y={C + 7} textAnchor="middle" fontSize={6.5} fill="#2a2a4a" fontFamily={MONO}>WHEEL</text>
    </svg>
  );
}

// ─── Transition View ───────────────────────────────────────────────────────────
function TransitionView({
  peaksA, peaksB, durationA, durationB,
  bpmA, bpmB, loadedA, loadedB,
  audioARef, audioBRef,
}: {
  peaksA: number[]; peaksB: number[];
  durationA: number; durationB: number;
  bpmA: number; bpmB: number;
  loadedA: boolean; loadedB: boolean;
  audioARef: React.RefObject<DeckAudio | null>;
  audioBRef: React.RefObject<DeckAudio | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef   = useRef<{ which: "A" | "B"; startX: number; startT: number } | null>(null);
  const [winSec,  setWinSec]  = useState(8);

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
    <div style={{ position: "relative", borderBottom: "1px solid #111128", background: "#060612", userSelect: "none" }}>
      <div style={{ position: "absolute", top: 5, left: 10, zIndex: 2, pointerEvents: "none" }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: CA + "bb", letterSpacing: "0.12em" }}>
          A {loadedA ? "← drag to seek →" : "— drop a track —"}
        </span>
      </div>
      <div style={{ position: "absolute", bottom: 5, left: 10, zIndex: 2, pointerEvents: "none" }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: CB + "bb", letterSpacing: "0.12em" }}>
          B {loadedB ? "← drag to seek →" : "— drop a track —"}
        </span>
      </div>
      {beatOffsetMs !== null && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 2, pointerEvents: "none", textAlign: "center" }}>
          <div style={{ background: "#0d0d1f", border: "1px solid #1a1a35", borderRadius: 6, padding: "3px 10px" }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: Math.abs(beatOffsetMs) < 20 ? "#00ff9d" : Math.abs(beatOffsetMs) < 80 ? "#ffd700" : "#ff4455" }}>
              {beatOffsetMs > 0 ? "+" : ""}{beatOffsetMs} ms
            </span>
          </div>
        </div>
      )}
      <div style={{ position: "absolute", top: 6, right: 10, zIndex: 2, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: "#33335a" }}>{barsShown} bars</span>
        <button onClick={() => setWinSec(s => Math.max(2, s / 2))}
          style={{ width: 20, height: 20, background: "#12122a", border: "1px solid #1a1a35", color: "#6b6b8a", fontFamily: MONO, fontSize: 13, borderRadius: 3, cursor: "pointer", lineHeight: 1, padding: 0 }}>+</button>
        <button onClick={() => setWinSec(s => Math.min(32, s * 2))}
          style={{ width: 20, height: 20, background: "#12122a", border: "1px solid #1a1a35", color: "#6b6b8a", fontFamily: MONO, fontSize: 13, borderRadius: 3, cursor: "pointer", lineHeight: 1, padding: 0 }}>−</button>
      </div>
      <canvas
        ref={canvasRef}
        width={1600} height={200}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ width: "100%", height: 200, display: "block", cursor: "ew-resize" }}
      />
    </div>
  );
}

// ─── Styled range ──────────────────────────────────────────────────────────────
function SRange({ min, max, step = 1, value, onChange, color, pct }: {
  min: number; max: number; step?: number; value: number;
  onChange: (v: number) => void; color: string; pct: number;
}) {
  return (
    <div style={{ position: "relative", height: 18, display: "flex", alignItems: "center" }}>
      <div style={{ position: "absolute", left: 0, right: 0, height: 3, borderRadius: 2, background: `linear-gradient(to right, ${color} ${pct}%, #12122a ${pct}%)` }} />
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ position: "absolute", left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0 }} />
      <div style={{ position: "absolute", left: `calc(${pct}% - 6px)`, width: 12, height: 12, borderRadius: 2, background: color, boxShadow: `0 0 8px ${color}88`, pointerEvents: "none", transition: "left 0.04s" }} />
    </div>
  );
}

// ─── EQ vertical slider ────────────────────────────────────────────────────────
function EQSlider({ label, value, onChange, color }: {
  label: string; value: number; onChange: (v: number) => void; color: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span style={{ fontFamily: MONO, fontSize: 9, color: color + "66" }}>{label}</span>
      <div style={{ height: 72, width: 24, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <input type="range" min={-12} max={12} step={0.5} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ writingMode: "vertical-lr" as const, direction: "rtl" as const, width: 20, height: 68, accentColor: color, cursor: "pointer" }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 9, color: color + "88" }}>{value > 0 ? `+${value}` : value}</span>
    </div>
  );
}

// ─── Deck panel ────────────────────────────────────────────────────────────────
function DeckPanel({ side, color, info, onInfoChange, audioRef, onLoad, playing }: {
  side: "A" | "B"; color: string;
  info: DeckInfo; onInfoChange: (p: Partial<DeckInfo>) => void;
  audioRef: React.RefObject<DeckAudio | null>;
  onLoad: (peaks: number[], duration: number) => void;
  playing: boolean;
}) {
  const [vol, setVol] = useState(80);
  const [eqLo,    setEqLo]    = useState(0);
  const [eqMi,    setEqMi]    = useState(0);
  const [eqHi,    setEqHi]    = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { audioRef.current?.setVol(vol / 100); }, [vol, audioRef]);
  useEffect(() => { audioRef.current?.setRate(1 + info.tempo / 100); }, [info.tempo, audioRef]);
  useEffect(() => { audioRef.current?.setEQ(eqLo, eqMi, eqHi); }, [eqLo, eqMi, eqHi, audioRef]);

  async function loadFile(file: File) {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      const buf = await audio.load(file);
      onLoad(computePeaks(buf, 4000), buf.duration);
      onInfoChange({ trackName: file.name.replace(/\.[^.]+$/, ""), loaded: true });
    } catch (e) { console.error("Decode error:", e); }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }

  const effBpm   = Math.round(info.bpm * (1 + info.tempo / 100));
  const keyName  = CAMELOT.find(c => c.pos === info.camelotPos)?.[info.camelotType] ?? "";
  const tempoPct = ((info.tempo + 8) / 16) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 18px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 10px ${color}` }} />
        <span style={{ fontFamily: MONO, fontSize: 11, color, letterSpacing: "0.18em", fontWeight: 700 }}>DECK {side}</span>
      </div>
      <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        style={{ border: `1px dashed ${color}30`, borderRadius: 5, cursor: "pointer", padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: color + "05", transition: "border-color 0.2s" }}>
        <Upload size={14} style={{ color: color + "55" }} />
        <span style={{ fontFamily: MONO, fontSize: 9, color: color + "44", letterSpacing: "0.12em" }}>
          {info.loaded ? info.trackName.slice(0, 22) + (info.trackName.length > 22 ? "…" : "") : "DROP AUDIO / CLICK TO LOAD"}
        </span>
      </div>
      <input ref={fileRef} type="file" accept="audio/*" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#44446a", marginBottom: 2, letterSpacing: "0.12em" }}>BPM</div>
          <div style={{ fontFamily: MONO, fontSize: 40, fontWeight: 700, lineHeight: 1, color, textShadow: `0 0 24px ${color}55` }}>{effBpm}</div>
          <input type="number" value={info.bpm} min={60} max={220}
            onChange={e => onInfoChange({ bpm: Math.max(60, Math.min(220, parseInt(e.target.value) || 128)) })}
            style={{ marginTop: 4, width: 60, background: color + "10", border: `1px solid ${color}22`, borderRadius: 3, color: color + "aa", fontFamily: MONO, fontSize: 10, padding: "2px 5px", outline: "none", textAlign: "center" }}
          />
        </div>
        <div style={{ paddingBottom: 24 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#44446a", marginBottom: 2, letterSpacing: "0.12em" }}>KEY</div>
          <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, lineHeight: 1, color }}>{info.camelotPos}{info.camelotType}</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: color + "88", marginTop: 3 }}>{keyName}</div>
        </div>
      </div>
      <button onClick={() => fileRef.current?.click()}
        style={{ padding: "0 14px", height: 32, borderRadius: 4, background: color + "10", border: `1px solid ${color}28`, color: color + "88", fontFamily: MONO, fontSize: 10, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", letterSpacing: "0.1em", alignSelf: "flex-start" }}>
        <Upload size={10} /> LOAD TRACK
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: info.loaded ? 1 : 0.3 }}>
        <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 16 }}>
          {[0.4, 0.7, 1, 0.7, 0.4].map((h, i) => (
            <div key={i} style={{
              width: 3, borderRadius: 2, background: color,
              height: playing ? `${h * 100}%` : "20%",
              transition: "height 0.15s",
              animation: playing ? `bounce-${i} ${0.5 + i * 0.1}s ease-in-out infinite alternate` : "none",
              opacity: playing ? 0.9 : 0.3,
            }} />
          ))}
        </div>
        <span style={{ fontFamily: MONO, fontSize: 9, color: playing ? color : color + "44", letterSpacing: "0.15em" }}>
          {playing ? "PLAYING" : "PAUSED"}
        </span>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: "#44446a" }}>TEMPO {info.tempo > 0 ? `+${info.tempo.toFixed(1)}` : info.tempo.toFixed(1)}%</span>
          <button onClick={() => onInfoChange({ tempo: 0 })} style={{ fontFamily: MONO, fontSize: 9, color: color + "44", background: "none", border: "none", cursor: "pointer", padding: 0 }}>RESET</button>
        </div>
        <SRange min={-8} max={8} step={0.1} value={info.tempo} onChange={v => onInfoChange({ tempo: v })} color={color} pct={tempoPct} />
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: "#44446a" }}>VOLUME</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: color + "88" }}>{vol}%</span>
        </div>
        <SRange min={0} max={100} value={vol} onChange={setVol} color={color} pct={vol} />
      </div>
      <div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: "#44446a", marginBottom: 6, letterSpacing: "0.1em" }}>EQ</div>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          <EQSlider label="HI"  value={eqHi} onChange={setEqHi} color={color} />
          <EQSlider label="MID" value={eqMi} onChange={setEqMi} color={color} />
          <EQSlider label="LO"  value={eqLo} onChange={setEqLo} color={color} />
        </div>
      </div>
      <div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: "#44446a", marginBottom: 6, letterSpacing: "0.1em" }}>CAMELOT KEY</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
          {CAMELOT.map(({ pos }) => (
            <button key={pos} onClick={() => onInfoChange({ camelotPos: pos })}
              style={{ width: 26, height: 22, background: info.camelotPos === pos ? color : color + "10", border: `1px solid ${info.camelotPos === pos ? color : color + "22"}`, color: info.camelotPos === pos ? BG : color + "88", fontFamily: MONO, fontSize: 10, fontWeight: 700, borderRadius: 3, cursor: "pointer", transition: "all 0.15s" }}>
              {pos}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {(["A", "B"] as KeyType[]).map(t => (
            <button key={t} onClick={() => onInfoChange({ camelotType: t })}
              style={{ flex: 1, height: 28, background: info.camelotType === t ? color : color + "10", border: `1px solid ${info.camelotType === t ? color : color + "22"}`, color: info.camelotType === t ? BG : color + "88", fontFamily: MONO, fontSize: 11, fontWeight: 700, borderRadius: 3, cursor: "pointer", transition: "all 0.15s" }}>
              {t === "A" ? "A — MINOR" : "B — MAJOR"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────
const initDeck = (bpm: number, pos: number, type: KeyType): DeckInfo => ({
  camelotPos: pos, camelotType: type, bpm, tempo: 0, trackName: "", loaded: false,
});

export default function App() {
  const [deckA,   setDeckA]   = useState<DeckInfo>(initDeck(128, 8, "B"));
  const [deckB,   setDeckB]   = useState<DeckInfo>(initDeck(128, 5, "A"));
  const [peaksA,  setPeaksA]  = useState<number[]>([]);
  const [peaksB,  setPeaksB]  = useState<number[]>([]);
  const [durA,    setDurA]    = useState(0);
  const [durB,    setDurB]    = useState(0);
  const [cf,      setCf]      = useState(50);
  const [playing, setPlaying] = useState(false);
  const audioARef = useRef<DeckAudio | null>(null);
  const audioBRef = useRef<DeckAudio | null>(null);

  if (!audioARef.current && typeof AudioContext !== "undefined") {
    const ctx = getCtx();
    audioARef.current = new DeckAudio(ctx);
    audioBRef.current = new DeckAudio(ctx);
  }

  useEffect(() => {
    const t = cf / 100;
    audioARef.current?.setCF(t < 0.5 ? 1 : 1 - (t - 0.5) * 2);
    audioBRef.current?.setCF(t > 0.5 ? 1 : t * 2);
  }, [cf]);

  function masterToggle() {
    const a = audioARef.current, b = audioBRef.current;
    if (playing) {
      a?.pause(); b?.pause(); setPlaying(false);
    } else {
      if (deckA.loaded) a?.play();
      if (deckB.loaded) b?.play();
      setPlaying(true);
    }
  }

  function syncBpm() {
    const target = deckA.bpm * (1 + deckA.tempo / 100);
    const needed = ((target / deckB.bpm) - 1) * 100;
    setDeckB(d => ({ ...d, tempo: parseFloat(Math.max(-8, Math.min(8, needed)).toFixed(1)) }));
  }

  const compat = getCompat(deckA.camelotPos, deckA.camelotType, deckB.camelotPos, deckB.camelotType);
  const cc     = compatColor(compat);
  const effA   = deckA.bpm * (1 + deckA.tempo / 100);
  const effB   = deckB.bpm * (1 + deckB.tempo / 100);
  const diff   = Math.abs(effA - effB).toFixed(1);
  const keyA   = CAMELOT.find(c => c.pos === deckA.camelotPos)?.[deckA.camelotType] ?? "";
  const keyB   = CAMELOT.find(c => c.pos === deckB.camelotPos)?.[deckB.camelotType] ?? "";

  return (
    <div style={{ background: BG, height: "100vh", color: "#e8e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ borderBottom: "1px solid #12122a", padding: "9px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Music size={17} style={{ color: CA }} />
          <span style={{ fontFamily: COND, fontSize: 21, fontWeight: 800, letterSpacing: "0.22em", color: "#e8e8f0" }}>CAMELOT DJ</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: cc, boxShadow: `0 0 8px ${cc}` }} />
          <span style={{ fontFamily: MONO, fontSize: 11, color: cc, letterSpacing: "0.12em" }}>{compat}</span>
        </div>
      </div>
      <TransitionView
        peaksA={peaksA} peaksB={peaksB}
        durationA={durA} durationB={durB}
        bpmA={effA} bpmB={effB}
        loadedA={deckA.loaded} loadedB={deckB.loaded}
        audioARef={audioARef} audioBRef={audioBRef}
      />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 248px 1fr", minHeight: 0, overflow: "hidden" }}>
        <div style={{ borderRight: `1px solid ${CA}14`, overflowY: "auto" }}>
          <DeckPanel side="A" color={CA} info={deckA}
            onInfoChange={p => setDeckA(d => ({ ...d, ...p }))}
            audioRef={audioARef}
            onLoad={(pk, dur) => { setPeaksA(pk); setDurA(dur); }}
            playing={playing} />
        </div>
        <div style={{ borderRight: `1px solid ${CB}14`, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, overflowY: "auto" }}>
          <CamelotWheel aPos={deckA.camelotPos} aType={deckA.camelotType} bPos={deckB.camelotPos} bType={deckB.camelotType} />
          <button onClick={masterToggle}
            disabled={!deckA.loaded && !deckB.loaded}
            style={{
              width: 64, height: 64, borderRadius: "50%",
              background: playing ? `linear-gradient(135deg, ${CA}cc, ${CB}cc)` : `linear-gradient(135deg, ${CA}22, ${CB}22)`,
              border: `2px solid ${playing ? "#ffffff44" : "#333358"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: (!deckA.loaded && !deckB.loaded) ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: playing ? `0 0 24px ${CA}44, 0 0 24px ${CB}44` : "none",
              opacity: (!deckA.loaded && !deckB.loaded) ? 0.35 : 1,
              flexShrink: 0,
            }}>
            {playing ? <Pause size={26} color="#ffffff" /> : <Play size={26} color="#ffffff" />}
          </button>
          <div style={{ padding: "4px 16px", borderRadius: 20, background: cc + "16", border: `1px solid ${cc}40`, fontFamily: MONO, fontSize: 11, color: cc, letterSpacing: "0.15em" }}>
            {compat}
          </div>
          <div style={{ display: "flex", gap: 5, width: "100%", alignItems: "center" }}>
            <div style={{ flex: 1, textAlign: "center", padding: "7px 4px", borderRadius: 6, background: CA + "0e", border: `1px solid ${CA}22` }}>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: CA }}>{deckA.camelotPos}{deckA.camelotType}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: CA + "70", marginTop: 2 }}>{keyA}</div>
            </div>
            <Link2 size={12} style={{ color: "#33335a", flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: "center", padding: "7px 4px", borderRadius: 6, background: CB + "0e", border: `1px solid ${CB}22` }}>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: CB }}>{deckB.camelotPos}{deckB.camelotType}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: CB + "70", marginTop: 2 }}>{keyB}</div>
            </div>
          </div>
          <div style={{ width: "100%", padding: "7px 10px", borderRadius: 6, background: "#0e0e20", border: "1px solid #1a1a35", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: "#44446a" }}>A</div>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: CA }}>{Math.round(effA)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: "#44446a" }}>DIFF</div>
              <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: parseFloat(diff) < 1 ? "#00ff9d" : parseFloat(diff) < 4 ? "#ffd700" : "#ff4455" }}>{diff}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: "#44446a" }}>B</div>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: CB }}>{Math.round(effB)}</div>
            </div>
          </div>
          <button onClick={syncBpm}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#ffd70028"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#ffd70014"; }}
            style={{ width: "100%", padding: "8px", borderRadius: 6, background: "#ffd70014", border: "1px solid #ffd70038", color: "#ffd700", fontFamily: MONO, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", letterSpacing: "0.1em", transition: "background 0.18s" }}>
            <Zap size={12} /> SYNC BPM A → B
          </button>
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: CA }}>A</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: "#44446a" }}>CROSSFADER</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: CB }}>B</span>
            </div>
            <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
              <div style={{ position: "absolute", left: 0, right: 0, height: 6, borderRadius: 3, background: `linear-gradient(to right, ${CA}, #1a1a35 40%, #1a1a35 60%, ${CB})` }} />
              <input type="range" min={0} max={100} value={cf} onChange={e => setCf(+e.target.value)}
                style={{ position: "absolute", left: 0, width: "100%", height: "100%", opacity: 0, cursor: "ew-resize", margin: 0 }} />
              <div style={{ position: "absolute", left: `calc(${cf}% - 10px)`, width: 20, height: 28, borderRadius: 4, background: "#c8c8e0", border: "2px solid #555577", boxShadow: "0 2px 8px rgba(0,0,0,0.6)", pointerEvents: "none", transition: "left 0.04s" }} />
            </div>
          </div>
          <button onClick={() => setCf(50)}
            style={{ padding: "5px 14px", borderRadius: 4, background: "#12122a", border: "1px solid #1a1a35", color: "#44446a", fontFamily: MONO, fontSize: 10, cursor: "pointer" }}>
            CENTER
          </button>
        </div>
        <div style={{ overflowY: "auto" }}>
          <DeckPanel side="B" color={CB} info={deckB}
            onInfoChange={p => setDeckB(d => ({ ...d, ...p }))}
            audioRef={audioBRef}
            onLoad={(pk, dur) => { setPeaksB(pk); setDurB(dur); }}
            playing={playing} />
        </div>
      </div>
    </div>
  );
}
