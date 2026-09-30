import { useState, useRef, useEffect, type DragEvent } from "react";
import {
  PlayIcon, PauseIcon, PrevIcon, NextIcon, NoteIcon, CaretIcon, UpIcon, DownIcon,
  MinIcon, MaxIcon, CloseIcon, DeskIcon, type DeskKind,
} from "./icons";
import {
  CA, CB, FACE, DESK, DIM, FONT,
  raised, windowFrame, status, field, btn, titleBar, capBtn,
} from "./win98";
import demoDuelUrl from "../assets/demo/duel-of-the-fates.mp3";
import demoFlexUrl from "../assets/demo/flex-up.mp3";
import { detectBpm } from "./bpm-detector";
import { SoundTouch, SimpleFilter, WebAudioBufferSource, getWebAudioNode } from "soundtouchjs";
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
  cover?:      string;
  shift:       number;  // semitones the audio is transposed by (camelotPos is the key you hear)
  keyLock:     boolean; // tempo changes don't change pitch
}

// One semitone moves 7 steps round the Camelot wheel (a fifth); 7 is its own inverse mod 12.
const camShift = (pos: number, semis: number) => ((pos - 1 + 7 * semis) % 12 + 12) % 12 + 1;
const semisTo  = (from: number, to: number) => { const s = ((7 * (to - from)) % 12 + 12) % 12; return s > 6 ? s - 12 : s; };

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

// Embedded cover art from an ID3v2.3/2.4 APIC frame (mp3). Returns the image bytes or null.
// ponytail: no v2.2 "PIC", extended headers or unsynchronisation; FLAC/M4A covers need their own readers.
function coverBytes(t: Uint8Array): Uint8Array | null {
  if (t[0] !== 0x49 || t[1] !== 0x44 || t[2] !== 0x33 || t[3] < 3) return null;
  const ss = (i: number) => ((t[i] & 127) << 21) | ((t[i + 1] & 127) << 14) | ((t[i + 2] & 127) << 7) | (t[i + 3] & 127);
  const end = Math.min(t.length, 10 + ss(6));
  for (let i = 10; i + 10 <= end && t[i]; ) {
    const n = t[3] === 4 ? ss(i + 4) : ((t[i + 4] << 24) | (t[i + 5] << 16) | (t[i + 6] << 8) | t[i + 7]) >>> 0;
    if (String.fromCharCode(t[i], t[i + 1], t[i + 2], t[i + 3]) === "APIC") {
      const d = t.subarray(i + 10, Math.min(end, i + 10 + n));
      // skip encoding/mime/type/description by jumping to the JPEG or PNG signature
      for (let k = 0; k < d.length - 3; k++)
        if ((d[k] === 0xFF && d[k + 1] === 0xD8 && d[k + 2] === 0xFF) || (d[k] === 0x89 && d[k + 1] === 0x50 && d[k + 2] === 0x4E && d[k + 3] === 0x47))
          return d.subarray(k);
      return null;
    }
    i += 10 + n;
  }
  return null;
}
async function readCover(file: File) {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head[0] !== 0x49) return undefined;
  const size = 10 + (((head[6] & 127) << 21) | ((head[7] & 127) << 14) | ((head[8] & 127) << 7) | (head[9] & 127));
  const img = coverBytes(new Uint8Array(await file.slice(0, size).arrayBuffer()));
  return img ? URL.createObjectURL(new Blob([img.slice()])) : undefined;
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
  return c === "PERFECT" ? "#008000" : c === "HARMONIC" ? "#806000" : "#C00000";
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
// Master = the audience mix (ctx.destination). Booth = the DJ's headphones: the master
// at `mon` level plus any deck cued pre-crossfader, played through its own <audio> so
// it can go to a different output device.
let _bus: { master: GainNode; mon: GainNode; booth: GainNode; boothEl: HTMLAudioElement } | null = null;
function getBus() { getCtx(); return _bus!; }
function getCtx() {
  if (!_ctx) {
    _ctx = new AudioContext();
    const master = _ctx.createGain(), mon = _ctx.createGain(), booth = _ctx.createGain(), dest = _ctx.createMediaStreamDestination();
    master.connect(_ctx.destination); master.connect(mon); mon.connect(booth); booth.connect(dest);
    const boothEl = new Audio(); boothEl.srcObject = dest.stream;
    _bus = { master, mon, booth, boothEl };
  }
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

const ST_BUF = 4096;


// ─── Audio engine ──────────────────────────────────────────────────────────────
class DeckAudio {
  ctx:      AudioContext;
  buffer:   AudioBuffer | null = null;
  src:      AudioBufferSourceNode | null = null;
  gain:     GainNode;
  cfGain:   GainNode;
  cue:      GainNode;
  analyser: AnalyserNode;
  eqLow:    BiquadFilterNode;
  eqMid:    BiquadFilterNode;
  eqHigh:   BiquadFilterNode;
  private _rate   = 1;
  private _t0     = 0;
  private _offset = 0;
  private _on     = false;
  // Key shift / key lock go through SoundTouch (time-stretch + pitch-shift in a ScriptProcessor).
  // With neither on, the native playbackRate path is used: cheaper and artefact-free.
  private _semis  = 0;
  private _lock   = false;
  private st:     any = null; // SoundTouch (untyped lib)
  private stNode: ScriptProcessorNode | null = null;
  private get stLat() { return ST_BUF / this.ctx.sampleRate; } // ScriptProcessor output delay
  private get useST() { return this._lock || this._semis !== 0; }
  private stPitch() { return this._semis + (this._lock ? 0 : 12 * Math.log2(this._rate)); }

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
    this.cfGain.connect(getBus().master);
    this.cue = ctx.createGain(); this.cue.gain.value = 0;
    this.analyser.connect(this.cue);
    this.cue.connect(getBus().booth);
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
    if (this._on) return Math.max(0, (this.ctx.currentTime - this._t0) * this._rate) % this.buffer.duration;
    return this._offset;
  }

  play() {
    if (!this.buffer || this._on) return;
    this.ctx.resume();
    if (this.useST) return this.playST();
    this.src = this.ctx.createBufferSource();
    this.src.buffer = this.buffer;
    this.src.loop   = true;
    this.src.playbackRate.value = this._rate;
    this.src.connect(this.gain);
    this.src.start(0, this._offset % this.buffer.duration);
    this._t0 = this.ctx.currentTime - this._offset / this._rate;
    this._on = true;
  }

  private playST() {
    const buf = this.buffer!, sr = buf.sampleRate;
    this.st = new SoundTouch();
    this.st.tempo = this._rate;
    this.st.pitchSemitones = this.stPitch();
    const filter = new SimpleFilter(new WebAudioBufferSource(buf), this.st);
    filter.sourcePosition = Math.round(this._offset * sr);
    this.stNode = getWebAudioNode(this.ctx, filter, undefined, ST_BUF);
    // loop like the native path: rewind the source when it runs dry
    filter.callback = () => { filter.sourcePosition = 0; this._t0 = this.ctx.currentTime + this.stLat; };
    this.stNode.connect(this.gain);
    // ponytail: fixed output-latency guess so the playhead matches what you hear; tune stLat if beats look early/late
    this._t0 = this.ctx.currentTime + this.stLat - this._offset / this._rate;
    this._on = true;
  }

  private stop() {
    try { this.src?.stop(); } catch {}
    this.stNode?.disconnect();
    if (this.stNode) this.stNode.onaudioprocess = null;
    this.src = null; this.stNode = null; this.st = null;
    this._on = false;
  }

  pause() {
    if (!this._on) return;
    this._offset = this.currentTime();
    this.stop();
  }

  seek(t: number) {
    if (!this.buffer) return;
    const was = this._on;
    if (was) this.stop();
    this._offset = Math.max(0, Math.min(t, this.buffer.duration - 0.01));
    if (was) this.play();
  }

  // Rebuild the chain when switching between native and SoundTouch; otherwise just retune live.
  private retune(wasST: boolean) {
    if (this._on && wasST !== this.useST) { this.pause(); this.play(); return; }
    if (this.st) { this.st.tempo = this._rate; this.st.pitchSemitones = this.stPitch(); }
    else this.src?.playbackRate.setTargetAtTime(this._rate, this.ctx.currentTime, 0.05);
  }
  setKey(semis: number, lock: boolean) {
    const wasST = this.useST;
    this._semis = semis; this._lock = lock;
    this.retune(wasST);
  }

  setVol(v: number)  { this.gain.gain.setTargetAtTime(v,  this.ctx.currentTime, 0.01); }
  setCF(v: number)   { this.cfGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
  setRate(r: number) {
    // re-anchor the clock so the playhead doesn't jump when the rate changes mid-play
    if (this._on) this._t0 = this.ctx.currentTime - this.currentTime() / r;
    this._rate = r;
    this.retune(this.useST);
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

// ─── Shared bits ──────────────────────────────────────────────────────────────
const COMPAT_OK = "#008000", COMPAT_MID = "#806000", COMPAT_BAD = "#C00000";

function fmtTime(s: number) {
  s = Math.max(0, Math.floor(s || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// "Artist — Title" (demo names, most file names, YouTube titles) → two fields.
function splitName(n: string) {
  const parts = n.split(/\s+[—–-]\s+/);
  return parts.length > 1 ? { artist: parts[0], title: parts.slice(1).join(" - ") } : { artist: "—", title: n || "—" };
}

function Labeled({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ whiteSpace: "nowrap", overflow: "hidden" }}>{label}</span>
      {children}
    </div>
  );
}

const textField = (fontSize: number, height: number, color = "#000"): React.CSSProperties => ({
  ...field, height, boxSizing: "border-box", padding: "0 6px", display: "flex", alignItems: "center",
  overflow: "hidden", whiteSpace: "nowrap", fontSize, color,
});

const groupBox: React.CSSProperties = {
  margin: 0, padding: "4px 6px 6px", minWidth: 0,
  border: "1px solid #7E7E7E", boxShadow: "inset 1px 1px #F0F0F0, 1px 1px #F0F0F0",
};

// Greyed-out, non-interactive (controls that don't apply to a YouTube deck).
const inert: React.CSSProperties = { opacity: 0.45, pointerEvents: "none" };

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
// Click a segment to set the focused deck's key. Centre shows the key distance.
function CamelotWheel({ aPos, aType, bPos, bType, onPick }: {
  aPos: number; aType: KeyType; bPos: number; bType: KeyType;
  onPick: (pos: number, type: KeyType) => void;
}) {
  const C = 102;
  let dn = ((bPos - aPos) % 12 + 12) % 12;
  if (dn > 6) dn -= 12;
  const dif = `${dn > 0 ? "+" : ""}${dn}${aType !== bType ? "↕" : ""}`;
  return (
    <div style={{ ...field, height: 216, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={204} height={204} viewBox="0 0 204 204">
        {(["B", "A"] as KeyType[]).map(t => {
          const [r0, r1] = t === "B" ? [70, 100] : [40, 70];
          return CAMELOT.map(({ pos }) => {
            const a0 = (pos - 1) * 30 - 15;
            const isA = pos === aPos && aType === t, isB = pos === bPos && bType === t;
            const fill = isA && isB ? "#000080" : isA ? CA : isB ? CB : "#fff";
            const c = polar(C, C, (r0 + r1) / 2, a0 + 15);
            return (
              <g key={t + pos} onClick={() => onPick(pos, t)} style={{ cursor: "pointer" }}>
                <path d={arcPath(C, C, r0, r1, a0, a0 + 30)} fill={fill} stroke={DIM} strokeWidth={1} />
                <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central" fontSize={10} fontFamily={FONT}
                  fill={fill === "#fff" ? "#000" : "#fff"} style={{ pointerEvents: "none" }}>{pos}{t}</text>
              </g>
            );
          });
        })}
        <circle cx={C} cy={C} r={40} fill={FACE} stroke={DIM} />
        <text x={C} y={C - 9} textAnchor="middle" dominantBaseline="central" fontSize={12} fontFamily={FONT} fill={DIM}>Dif.</text>
        <text x={C} y={C + 8} textAnchor="middle" dominantBaseline="central" fontSize={18} fontFamily={FONT}
          fill={compatColor(getCompat(aPos, aType, bPos, bType))}>{dif}</text>
      </svg>
    </div>
  );
}

// ─── Transition View (two-lane waveform canvas) ────────────────────────────────
function TransitionView({
  peaksA, peaksB, durationA, durationB,
  bpmA, bpmB, loadedA, loadedB, nameA, nameB,
  audioARef, audioBRef, checkpoints,
}: {
  peaksA: number[]; peaksB: number[];
  durationA: number; durationB: number;
  bpmA: number; bpmB: number;
  loadedA: boolean; loadedB: boolean;
  nameA: string; nameB: string;
  audioARef: React.RefObject<DeckAudio | null>;
  audioBRef: React.RefObject<DeckAudio | null>;
  checkpoints: { id: number; tA: number; tB: number }[];
}) {
  const H = 100;
  const wrapRef   = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef   = useRef<{ which: "A" | "B"; startX: number; startT: number } | null>(null);
  const [winSec, setWinSec] = useState(8);
  const [cw, setCw] = useState(800);

  // Size the canvas to its box so pixels stay 1:1 (crisp, no stretching).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCw(Math.max(1, el.clientWidth - 4)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      const W = canvas.width, lane = Math.floor(H / 2);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);

      const tA = audioARef.current?.currentTime() ?? 0;
      const tB = audioBRef.current?.currentTime() ?? 0;
      const pxPerSec = W / (winSec * 2);

      function drawLane(peaks: number[], duration: number, t: number, y0: number, bpm: number, color: string, loaded: boolean) {
        const mid = y0 + lane / 2;
        if (bpm) {
          const beat = 60 / bpm;
          ctx.fillStyle = "#B1B1B1";
          for (let bt = Math.ceil((t - winSec) / beat) * beat; bt <= t + winSec; bt += beat) {
            const x = Math.round(W / 2 + (bt - t) * pxPerSec);
            if (Math.round(bt / beat) % 4 === 0) ctx.fillRect(x, y0 + 5, 1, lane - 10);
            else ctx.fillRect(x, mid - 4, 1, 8);
          }
        }
        if (!loaded || !peaks.length || !duration) return;
        const pps = peaks.length / duration;
        ctx.fillStyle = color;
        for (let x = 0; x < W; x++) {
          // max over every peak this pixel covers, so zooming out doesn't drop transients
          const r0 = Math.floor((t + (x - W / 2) / pxPerSec) * pps);
          if (r0 < 0 || r0 >= peaks.length) continue;
          const i1 = Math.min(peaks.length, Math.max(r0 + 1, Math.floor((t + (x + 1 - W / 2) / pxPerSec) * pps)));
          const i0 = r0;
          let m = 0;
          for (let i = i0; i < i1; i++) if (peaks[i] > m) m = peaks[i];
          const h = Math.max(1, Math.round(m * (lane / 2 - 6)));
          ctx.fillRect(x, mid - h, 1, h * 2);
        }
      }
      drawLane(peaksA, durationA, tA, 0,    bpmA, CA, loadedA);
      drawLane(peaksB, durationB, tB, lane, bpmB, CB, loadedB);

      // Saved checkpoint positions: a line plus a numbered flag per deck lane.
      function drawCheckpoint(savedT: number, t: number, yTop: number, color: string, label: string) {
        const x = Math.round(W / 2 + (savedT - t) * pxPerSec);
        if (x < 0 || x > W) return;
        ctx.fillStyle = color;
        ctx.fillRect(x, yTop, 1, lane);
        ctx.fillRect(x, yTop + lane - 13, 10, 13);
        ctx.fillStyle = "#fff";
        ctx.font = `12px ${FONT}`;
        ctx.textBaseline = "top";
        ctx.fillText(label, x + 2, yTop + lane - 12);
      }
      cpRef.current.forEach((cp, i) => {
        if (loadedA) drawCheckpoint(cp.tA, tA, 0,    CA, String(i + 1));
        if (loadedB) drawCheckpoint(cp.tB, tB, lane, CB, String(i + 1));
      });

      ctx.fillStyle = FACE;
      ctx.fillRect(0, lane, W, 1);
      ctx.fillStyle = "#000";
      ctx.fillRect(Math.floor(W / 2), 0, 1, H);

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, [peaksA, peaksB, durationA, durationB, bpmA, bpmB, loadedA, loadedB, audioARef, audioBRef, winSec, cw]);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect  = e.currentTarget.getBoundingClientRect();
    const which = e.clientY - rect.top < rect.height / 2 ? "A" : "B";
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
  const tag: React.CSSProperties = { position: "absolute", left: 6, padding: "0 3px", background: "#fff", whiteSpace: "nowrap", pointerEvents: "none" };

  return (
    <div ref={wrapRef} style={{ ...field, height: H + 4, boxSizing: "border-box", position: "relative", flexShrink: 0, overflow: "hidden" }}>
      <canvas ref={canvasRef} width={cw} height={H}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        style={{ display: "block", width: cw, height: H, cursor: "ew-resize" }} />
      <span style={{ ...tag, top: 3, color: CA }}>A — {loadedA ? nameA : "sem faixa"}</span>
      <span style={{ ...tag, bottom: 3, color: CB }}>B — {loadedB ? nameB : "sem faixa"}</span>
      <div style={{ position: "absolute", right: 6, top: 4, display: "flex", alignItems: "center", gap: 4, background: "#fff", paddingLeft: 4 }}>
        {beatOffsetMs !== null && (
          <span style={{ color: Math.abs(beatOffsetMs) < 20 ? COMPAT_OK : Math.abs(beatOffsetMs) < 80 ? COMPAT_MID : COMPAT_BAD }}>
            {beatOffsetMs > 0 ? "+" : ""}{beatOffsetMs} ms ·
          </span>
        )}
        <span>{barsShown} compassos</span>
        <button onClick={() => setWinSec(s => Math.max(2, s / 2))} title="aproximar" style={{ ...capBtn }}>+</button>
        <button onClick={() => setWinSec(s => Math.min(32, s * 2))} title="afastar" style={{ ...capBtn }}>–</button>
      </div>
    </div>
  );
}

// ─── Win98 trackbar ───────────────────────────────────────────────────────────
// Channel + raised thumb; the native input sits invisible on top.
// `thick` = seek-bar channel, `tick` = centre mark, no `color` = no fill.
// Double-click anywhere on the track snaps back to `reset`.
function SRange({ min, max, step = 1, value, onChange, color, pct, reset, thick, tick }: {
  min: number; max: number; step?: number; value: number;
  onChange: (v: number) => void; color?: string; pct: number; reset?: number;
  thick?: boolean; tick?: boolean;
}) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div
      onDoubleClick={reset !== undefined ? () => onChange(reset) : undefined}
      title={reset !== undefined ? "duplo clique para resetar" : undefined}
      style={{ position: "relative", height: 21 }}>
      {thick
        ? <div style={{ position: "absolute", left: 0, right: 0, top: 6, height: 9, ...field, padding: 0 }} />
        : <div style={{ position: "absolute", left: 0, right: 0, top: 8, height: 4, boxShadow: "inset -1px -1px #F0F0F0, inset 1px 1px #7E7E7E" }} />}
      {tick && <div style={{ position: "absolute", left: "50%", top: 15, width: 1, height: 5, background: "#000" }} />}
      {color && (
        <div style={{ position: "absolute", left: thick ? 2 : 1, top: thick ? 8 : 9, height: thick ? 5 : 2,
          width: `max(0px, calc(${p}% - ${thick ? 2 : 1}px))`, background: color }} />
      )}
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0 }} />
      <div style={{ position: "absolute", top: 0, left: `calc(${p}% - 5px)`, width: 11, height: 21, ...raised, pointerEvents: "none" }} />
    </div>
  );
}

// ─── EQ vertical slider ───────────────────────────────────────────────────────
// A trackbar turned on its side. Double-click resets the band to flat (0 dB).
function EQSlider({ label, value, onChange, color }: {
  label: string; value: number; onChange: (v: number) => void; color: string;
}) {
  const H = 84;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span>{label}</span>
      <div style={{ width: 21, height: H, position: "relative" }}>
        <div style={{ position: "absolute", width: H, left: (21 - H) / 2, top: (H - 21) / 2, transform: "rotate(-90deg)" }}>
          <SRange min={-12} max={12} step={0.5} value={value} onChange={onChange} color={color}
            pct={((value + 12) / 24) * 100} reset={0} tick />
        </div>
      </div>
      <span style={{ color }}>{value > 0 ? `+${value}` : value}</span>
    </div>
  );
}

// ─── YouTube ─────────────────────────────────────────────────────────────────
// Mounted in the deck's cover slot when its source is "youtube". Owns the
// YouTubeController and mirrors its state up. No waveform, EQ or tempo — the
// audio lives in a cross-origin iframe we can't tap.
const YT0: YouTubeState = { ready: false, playing: false, duration: 0, title: "", index: -1, listCount: 0 };

function YouTubeCover({ ctrlRef, vol, onState, onInfoChange, onPlayingChange }: {
  ctrlRef: React.MutableRefObject<YouTubeController | null>;
  vol: number;
  onState: (s: YouTubeState) => void;
  onInfoChange: (p: Partial<DeckInfo>) => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [yt, setYt] = useState<YouTubeState>(YT0);

  useEffect(() => {
    if (!hostRef.current || ctrlRef.current) return;
    const c = new YouTubeController(hostRef.current);
    ctrlRef.current = c;
    const off = c.onChange(setYt);
    return () => { off(); c.destroy(); ctrlRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { ctrlRef.current?.setVol(vol / 100); }, [vol, ctrlRef]);

  // Push ready/title into DeckInfo and the player's own play/pause into the
  // deck's playing state (the user can drive it from inside the iframe too).
  useEffect(() => {
    onInfoChange({ loaded: yt.ready, trackName: yt.title || (yt.ready ? "YouTube" : "") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yt.ready, yt.title]);
  useEffect(() => {
    onPlayingChange(yt.playing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yt.playing]);
  useEffect(() => {
    onState(yt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yt]);

  return <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />;
}

function LinkDialog({ onSubmit, onClose }: { onSubmit: (link: string) => string | void; onClose: () => void }) {
  const [v, setV]     = useState("");
  const [err, setErr] = useState("");
  const ok = () => { const e = onSubmit(v); if (e) setErr(e); else onClose(); };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...windowFrame, width: 340 }}>
        <div style={titleBar()}>
          <span style={{ flex: 1 }}>Abrir do YouTube</span>
          <button onClick={onClose} style={capBtn}><CloseIcon /></button>
        </div>
        <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <span>Link de vídeo ou playlist :</span>
          <input autoFocus value={v} onChange={e => setV(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") ok(); if (e.key === "Escape") onClose(); }}
            style={{ ...field, border: "none", outline: "none", fontFamily: FONT, fontSize: 12, padding: "3px 4px" }} />
          {err && <span style={{ color: COMPAT_BAD }}>{err}</span>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
            <button onClick={ok} style={{ ...btn(), height: 23, minWidth: 75, outline: "1px solid #000" }}>OK</button>
            <button onClick={onClose} style={{ ...btn(), height: 23, minWidth: 75 }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Deck panel ───────────────────────────────────────────────────────────────
interface LibItem { id: number; name: string; bpm?: number; pos?: number; type?: KeyType; file?: File; url?: string }
interface DeckApi { loadItem: (item: LibItem) => void }

function DeckPanel({
  side, color, info, onInfoChange, audioRef, ytRef, onLoad, playing, onToggle, onSourceChange, onPlayingChange,
  focused, onFocus, otherBpm, onOpenLibrary, onLibraryAdd, apiRef, resetPos,
}: {
  side: "A" | "B"; color: string;
  info: DeckInfo; onInfoChange: (p: Partial<DeckInfo>) => void;
  audioRef: React.RefObject<DeckAudio | null>;
  ytRef: React.MutableRefObject<YouTubeController | null>;
  onLoad: (peaks: number[], duration: number) => void;
  playing: boolean;
  onToggle: () => void;
  onSourceChange: (s: DeckSource) => void;
  onPlayingChange: (playing: boolean) => void;
  focused: boolean;
  onFocus: () => void;
  otherBpm: number;
  onOpenLibrary: () => void;
  onLibraryAdd: (item: Omit<LibItem, "id">) => void;
  apiRef: React.MutableRefObject<DeckApi | null>;
  resetPos: number;
}) {
  const [vol,  setVol]  = useState(80);
  const [eqLo, setEqLo] = useState(0);
  const [eqMi, setEqMi] = useState(0);
  const [eqHi, setEqHi] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [askLink,  setAskLink]  = useState(false);
  const [yt, setYt] = useState<YouTubeState>(YT0);
  const [, force]   = useState(0);
  const isYt = info.source === "youtube";

  useEffect(() => { audioRef.current?.setVol(vol / 100); }, [vol, audioRef]);
  useEffect(() => { audioRef.current?.setRate(1 + info.tempo / 100); }, [info.tempo, audioRef]);
  useEffect(() => { audioRef.current?.setKey(info.shift, info.keyLock); }, [info.shift, info.keyLock, audioRef]);
  // Tom selector: "Marcar" tags the key you hear; "Transpor" pitch-shifts the track to the clicked key.
  const [transpose, setTranspose] = useState(false);
  const origPos = camShift(info.camelotPos, -info.shift);
  useEffect(() => { audioRef.current?.setEQ(eqLo, eqMi, eqHi); }, [eqLo, eqMi, eqHi, audioRef]);
  useEffect(() => { if (!isYt) setYt(YT0); }, [isYt]);

  // Re-render while playing so the clock and seek bar move.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => force(n => n + 1), 250);
    return () => clearInterval(id);
  }, [playing]);

  // Close the load menu on any click outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const on = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest?.("[data-menu]")) setMenuOpen(false); };
    document.addEventListener("pointerdown", on);
    return () => document.removeEventListener("pointerdown", on);
  }, [menuOpen]);

  const [bpmDetecting, setBpmDetecting] = useState(false);
  // Bumped on every load so a slow analysis from a previous track can't write
  // its BPM onto whatever got loaded after it.
  const loadTokenRef = useRef(0);

  async function loadFile(file: File, extra?: Partial<DeckInfo>, fromLibrary = false) {
    const audio = audioRef.current;
    if (!audio) return;
    const token = ++loadTokenRef.current;
    const name  = file.name.replace(/\.[^.]+$/, "");
    try {
      const buf = await audio.load(file);
      if (token !== loadTokenRef.current) return;
      onLoad(computePeaks(buf, Math.ceil(buf.duration * 200)), buf.duration); // 200/s: finer than a screen pixel at any zoom
      if (info.cover) URL.revokeObjectURL(info.cover);
      const cover = await readCover(file).catch(() => undefined);
      if (token !== loadTokenRef.current) return;
      onInfoChange({ trackName: name, loaded: true, cover, shift: 0, ...extra });
      setCues(Array(8).fill(null));

      // Analyse the real tempo in a worker; overwrite the placeholder/demo BPM
      // once we have a usable estimate.
      setBpmDetecting(true);
      let found: number | undefined;
      detectBpm(buf)
        .then(res => {
          if (token !== loadTokenRef.current) return;
          if (res.bpm >= 60 && res.bpm <= 200 && res.confidence >= 0.12) {
            found = res.bpm;
            onInfoChange({ bpm: res.bpm });
          }
        })
        .catch(e => console.error("BPM detect failed:", e))
        .finally(() => {
          if (token === loadTokenRef.current) setBpmDetecting(false);
          if (!fromLibrary) onLibraryAdd({ name, file, bpm: found });
        });
    } catch (e) { console.error("Decode error:", e); }
  }

  function toLocal() { if (isYt) onSourceChange("local"); }


  async function loadItem(item: LibItem) {
    toLocal();
    try {
      const file = item.file ?? await fetchAsFile(item.url!, item.name);
      const extra: Partial<DeckInfo> = {};
      if (item.bpm) extra.bpm = item.bpm;
      if (item.pos && item.type) { extra.camelotPos = item.pos; extra.camelotType = item.type; }
      await loadFile(file, extra, true);
    } catch (e) { console.error("Library load failed:", e); }
  }
  apiRef.current = { loadItem };

  function submitLink(link: string) {
    const parsed = parseYouTubeUrl(link);
    if (parsed.kind === "invalid") return "Link do YouTube inválido";
    ytRef.current?.load(parsed);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { toLocal(); loadFile(f); }
  }

  // Transport — whichever engine backs this deck; both expose currentTime/seek.
  const tr   = isYt ? ytRef.current : audioRef.current;
  const cur  = tr?.currentTime() ?? 0;

  // Hot-cue pads: empty pad stores the current position, a set pad jumps back to it; double-click (or right-click) clears.
  // Keys: deck A 1–4 (+Shift = pads 5–8), deck B 5–8 (+Shift).
  const [cues, setCues] = useState<(number | null)[]>(() => Array(8).fill(null));
  function pressPad(i: number) {
    if (!info.loaded || !tr) return;
    const c = cues[i];
    if (c == null) setCues(cs => cs.map((x, j) => j === i ? tr.currentTime() : x));
    else seekTo(c);
  }
  const clearPad = (i: number) => setCues(cs => cs.map((x, j) => j === i ? null : x));
  const padRef = useRef(pressPad);
  padRef.current = pressPad;
  useEffect(() => {
    const base = side === "A" ? 1 : 5;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.tagName === "SELECT" || el?.isContentEditable) return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const n = +e.code.replace("Digit", "") - base; // e.code: Shift+1 is still "Digit1"
      if (!(n >= 0 && n < 4)) return;
      e.preventDefault();
      padRef.current(n + (e.shiftKey ? 4 : 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [side]);
  const dur  = isYt ? yt.duration : (audioRef.current?.duration ?? 0);
  const beat = 60 / info.bpm;
  function seekTo(t: number) {
    if (!dur) return;
    tr?.seek(Math.max(0, Math.min(dur - 0.01, t)));
    force(n => n + 1);
  }
  function stop() { if (playing) onToggle(); seekTo(0); }
  function sync() {
    const needed = (otherBpm / info.bpm - 1) * 100;
    onInfoChange({ tempo: parseFloat(Math.max(-8, Math.min(8, needed)).toFixed(1)) });
  }

  const effBpm   = info.bpm * (1 + info.tempo / 100);
  const keyName  = CAMELOT.find(c => c.pos === info.camelotPos)?.[info.camelotType] ?? "";
  const tempoPct = ((info.tempo + 8) / 16) * 100;
  const { title, artist } = info.loaded ? splitName(info.trackName) : { title: "—", artist: "—" };

  const menu: [string, () => void][] = [
    ["Do YouTube…", () => { if (!isYt) onSourceChange("youtube"); setAskLink(true); }],
    ["Da biblioteca", onOpenLibrary],
    ...(isYt && yt.listCount > 0 ? [
      ["Anterior da playlist", () => ytRef.current?.prev()],
      ["Próxima da playlist", () => ytRef.current?.next()],
    ] as [string, () => void][] : []),
  ];

  const drag = useDrag(resetPos);

  return (
    <div
      onPointerDown={onFocus}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      style={{ ...windowFrame, ...drag.win, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden",
        outline: dragOver ? "1px dotted #000" : "none", outlineOffset: -6 }}>
      <div {...drag.bar} style={{ ...titleBar(focused), cursor: "move" }}>
        <span style={{ width: 9, height: 9, background: color, boxShadow: "0 0 0 1px #fff", flexShrink: 0, margin: "0 2px" }} />
        <span style={{ flex: 1 }}>Deck {side}</span>
        <span>{info.camelotPos}{info.camelotType} · {effBpm.toFixed(1)}</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 8, padding: "8px 6px 6px", overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "174px minmax(0, 1fr)", gap: 10 }}>
          {/* cover + transport */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ ...field, width: 174, height: 150, boxSizing: "border-box", position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center", background: isYt ? "#000" : "#fff" }}>
              {isYt ? (
                <>
                  {!yt.ready && <span style={{ color: "#fff" }}>sem vídeo</span>}
                  <YouTubeCover ctrlRef={ytRef} vol={vol} onState={setYt}
                    onInfoChange={onInfoChange} onPlayingChange={onPlayingChange} />
                </>
              ) : (
                info.cover
                  ? <img src={info.cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ opacity: info.loaded ? 1 : 0.4 }}><DeskIcon kind="cd" s={4} /></span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
              <button onClick={() => seekTo(cur - 16 * beat)} disabled={!info.loaded} title="voltar 16 tempos" style={{ ...btn(), height: 30 }}><PrevIcon s={2} /></button>
              <button onClick={onToggle} disabled={!info.loaded}
                title={`${playing ? "pausar" : "tocar"} deck ${side}  (tecla: ${side === "A" ? "A" : "D"})`}
                style={{ ...btn(playing), height: 30, color: playing ? color : "#000" }}>
                {playing ? <PauseIcon s={2} /> : <PlayIcon s={2} />}
              </button>
              <button onClick={() => seekTo(cur + 16 * beat)} disabled={!info.loaded} title="avançar 16 tempos" style={{ ...btn(), height: 30 }}><NextIcon s={2} /></button>
              <button onClick={() => seekTo(0)} disabled={!info.loaded} style={{ ...btn(), height: 23 }}><u>C</u>ue</button>
              <button onClick={stop} disabled={!info.loaded} style={{ ...btn(), height: 23 }}>S<u>t</u>op</button>
              <button onClick={sync} disabled={isYt} title={`igualar ao BPM do outro deck (${otherBpm.toFixed(1)})`} style={{ ...btn(), height: 23 }}><u>S</u>ync</button>
            </div>
          </div>

          {/* track info */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 6 }}>
            <Labeled label="Faixa :"><div style={textField(16, 24)}>{title}</div></Labeled>
            <Labeled label="Artista :"><div style={textField(16, 24)}>{artist}</div></Labeled>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)", gap: 6, alignItems: "end" }}>
              <Labeled label={<>BPM : {bpmDetecting && <span style={{ color: DIM, animation: "blink 1s step-end infinite" }}>detectando…</span>}</>}>
                <div style={textField(32, 42, color)}>{effBpm.toFixed(1)}</div>
              </Labeled>
              <Labeled label="Base :">
                <div style={{ ...field, display: "flex", height: 22, width: 58, boxSizing: "border-box" }}>
                  <input value={info.bpm}
                    onChange={e => onInfoChange({ bpm: Math.max(60, Math.min(220, parseInt(e.target.value) || 128)) })}
                    onDoubleClick={() => onInfoChange({ bpm: 128 })}
                    title="duplo clique para resetar"
                    style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: FONT, fontSize: 12, padding: "0 0 0 3px" }} />
                  <div style={{ width: 14, display: "flex", flexDirection: "column" }}>
                    <button onClick={() => onInfoChange({ bpm: Math.min(220, Math.round(info.bpm) + 1) })} style={{ ...btn(), flex: 1, padding: 0 }}><UpIcon /></button>
                    <button onClick={() => onInfoChange({ bpm: Math.max(60, Math.round(info.bpm) - 1) })} style={{ ...btn(), flex: 1, padding: 0 }}><DownIcon /></button>
                  </div>
                </div>
              </Labeled>
              <Labeled label={<>Tom : <span style={{ color: DIM }}>{keyName}</span></>}>
                <div style={textField(32, 42, color)}>{info.camelotPos}{info.camelotType}</div>
              </Labeled>
            </div>
            <div data-menu style={{ position: "relative", display: "grid" }}>
              {menuOpen && (
                <div style={{ ...windowFrame, position: "absolute", left: 0, top: 25, zIndex: 5, minWidth: 210, display: "flex", flexDirection: "column" }}>
                  {menu.map(([label, fn]) => (
                    <button key={label} className="flat menu-item" onClick={() => { setMenuOpen(false); fn(); }}
                      style={{ height: 20, border: "none", padding: "0 20px", textAlign: "left", background: "transparent", color: "#000", fontFamily: FONT, fontSize: 12, cursor: "pointer" }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setMenuOpen(o => !o)} title="YouTube, biblioteca, playlist" style={{ ...btn(menuOpen), height: 23, gap: 5 }}>
                <span><u>F</u>onte</span><CaretIcon />
              </button>
            </div>
          </div>
        </div>

        {/* seek */}
        <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 16 }}>{fmtTime(cur)}</span>
          <SRange min={0} max={dur || 1} step={0.01} value={Math.min(cur, dur || 1)} onChange={seekTo}
            color={color} pct={dur ? (cur / dur) * 100 : 0} thick />
          <span style={{ fontSize: 16 }}>{fmtTime(dur)}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={isYt ? inert : undefined}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Tempo : {info.tempo > 0 ? "+" : ""}{info.tempo.toFixed(1)}%</span>
              <button onClick={() => onInfoChange({ keyLock: !info.keyLock })} title="mudar o tempo sem mudar o tom"
                style={{ ...btn(info.keyLock), height: 16, padding: "0 4px", color: info.keyLock ? color : "#000" }}>Key lock</button>
              <button className="flat" onClick={() => onInfoChange({ tempo: 0 })}
                style={{ fontFamily: FONT, fontSize: 12, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>resetar</button>
            </div>
            <SRange min={-8} max={8} step={0.1} value={info.tempo} onChange={v => onInfoChange({ tempo: v })}
              color={color} pct={tempoPct} reset={0} tick />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Volume :</span><span>{vol}%</span>
            </div>
            <SRange min={0} max={100} value={vol} onChange={setVol} color={color} pct={vol} reset={80} />
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)", gap: 8, paddingTop: 6 }}>
          <fieldset style={{ ...groupBox, ...(isYt ? inert : {}) }}>
            <legend style={{ padding: "0 3px" }}>Equalizador</legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
              <EQSlider label="Lo"  value={eqLo} onChange={setEqLo} color={color} />
              <EQSlider label="Mid" value={eqMi} onChange={setEqMi} color={color} />
              <EQSlider label="Hi"  value={eqHi} onChange={setEqHi} color={color} />
            </div>
          </fieldset>
          <fieldset style={{ ...groupBox, display: "flex", flexDirection: "column", gap: 4 }}>
            <legend style={{ padding: "0 3px" }}>Tom Camelot</legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)" }}>
              {CAMELOT.map(({ pos }) => {
                const on = info.camelotPos === pos;
                return (
                  <button key={pos} onClick={() => onInfoChange(transpose ? { camelotPos: pos, shift: semisTo(origPos, pos) } : { camelotPos: pos })}
                    style={{ ...btn(on), height: 23, color: on ? color : "#000" }}>{pos}</button>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              {(["A", "B"] as KeyType[]).map(t => {
                const on = info.camelotType === t;
                return (
                  <button key={t} onClick={() => onInfoChange({ camelotType: t })}
                    style={{ ...btn(on), height: 23, color: on ? color : "#000" }}>
                    {t === "A" ? "A – menor" : "B – maior"}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <button onClick={() => setTranspose(false)} title="clicar num tom só marca o tom da faixa" style={{ ...btn(!transpose), height: 23 }}>Marcar</button>
              <button onClick={() => setTranspose(true)} disabled={isYt} title="clicar num tom muda o tom do áudio" style={{ ...btn(transpose), height: 23 }}>Transpor</button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: info.shift ? color : DIM }}>
              <span>original {origPos}{info.camelotType} · {info.shift > 0 ? "+" : ""}{info.shift} st</span>
              {info.shift !== 0 && (
                <button className="flat" onClick={() => onInfoChange({ camelotPos: origPos, shift: 0 })}
                  style={{ fontFamily: FONT, fontSize: 12, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>original</button>
              )}
            </div>
          </fieldset>
        </div>

        <fieldset style={{ ...groupBox, flex: "none" }}>
          <legend style={{ padding: "0 3px" }}>Pads</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
            {cues.map((c, i) => {
              const key = `${i >= 4 ? "⇧" : ""}${(side === "A" ? 1 : 5) + (i % 4)}`;
              return (
                <button key={i} onClick={() => pressPad(i)} disabled={!info.loaded}
                  onDoubleClick={() => clearPad(i)}
                  onContextMenu={e => { e.preventDefault(); clearPad(i); }}
                  title={c == null ? `marcar ponto (tecla ${key})` : `voltar para ${fmtTime(c)} (tecla ${key}) · duplo clique apaga`}
                  style={{ ...btn(), height: 44, position: "relative", fontSize: 14,
                    background: c == null ? undefined : color, color: c == null ? "#000" : "#fff" }}>
                  {c != null && fmtTime(c)}
                  <span style={{ position: "absolute", right: 4, bottom: 2, fontSize: 11, color: c == null ? DIM : "#fff" }}>{key}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      {askLink && <LinkDialog onSubmit={submitLink} onClose={() => setAskLink(false)} />}
    </div>
  );
}

// ─── Clock ────────────────────────────────────────────────────────────────────
// Drag a window by its title bar; it moves freely over the desktop. Double-click the bar to snap it back.
let zTop = 1;
// Bumping `reset` snaps it back too (the main window resets its children this way).
function useDrag(reset = 0) {
  const [p, setP] = useState({ x: 0, y: 0, z: 0 });
  useEffect(() => setP({ x: 0, y: 0, z: 0 }), [reset]);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    const sx = e.clientX - p.x, sy = e.clientY - p.y, z = ++zTop;
    const move = (ev: PointerEvent) => setP({ x: ev.clientX - sx, y: ev.clientY - sy, z });
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
    setP(q => ({ ...q, z }));
  };
  return {
    // moved = floating: shrink to content instead of stretching down the grid row
    win: p.x || p.y
      ? { position: "relative", zIndex: p.z || undefined, transform: `translate(${p.x}px, ${p.y}px)`, alignSelf: "start", height: "auto" }
      : { position: "relative", zIndex: p.z || undefined } as React.CSSProperties,
    bar: { onPointerDown, onDoubleClick: () => setP({ x: 0, y: 0, z: 0 }) },
  };
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ─── App ─────────────────────────────────────────────────────────────────────
const initDeck = (bpm: number, pos: number, type: KeyType): DeckInfo => ({
  camelotPos: pos, camelotType: type, bpm, tempo: 0, trackName: "", loaded: false,
  source: "local", shift: 0, keyLock: false,
});

// Free-floating desktop window (opened from a desktop icon).
function FloatWin({ kind, title, left, top, onClose, children }: {
  kind: DeskKind; title: string; left: number; top: number; onClose: () => void; children: React.ReactNode;
}) {
  const drag = useDrag();
  return (
    <div style={{ ...windowFrame, ...drag.win, position: "fixed", left, top, zIndex: 1000 + (drag.win.zIndex as number || 0),
      display: "flex", flexDirection: "column" }}>
      <div {...drag.bar} style={{ ...titleBar(), cursor: "move" }}>
        <DeskIcon kind={kind} s={1} />
        <span style={{ flex: 1 }}>{title}</span>
        <button onClick={onClose} style={capBtn}><CloseIcon /></button>
      </div>
      {children}
    </div>
  );
}

// Milkdrop (butterchurn) fed from the master bus. Loaded on demand: the presets are ~600 KB.
function Milkdrop({ onClose }: { onClose: () => void }) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const next = useRef<() => void>(() => {});
  const [preset, setPreset] = useState("carregando…");
  useEffect(() => {
    let raf = 0, viz: any, dead = false;
    const node = getBus().master;
    Promise.all([import("butterchurn"), import("butterchurn-presets")]).then(([bc, bp]) => {
      if (dead || !cvs.current) return;
      const presets = (bp.default ?? bp).getPresets(), names = Object.keys(presets);
      viz = (bc.default ?? bc).createVisualizer(getCtx(), cvs.current, { width: 480, height: 300 });
      viz.connectAudio(node);
      next.current = () => { const n = names[Math.floor(Math.random() * names.length)]; viz.loadPreset(presets[n], 2); setPreset(n); };
      next.current();
      const loop = () => { viz.render(); raf = requestAnimationFrame(loop); };
      loop();
    }).catch(e => { console.error("Milkdrop failed:", e); setPreset("erro ao carregar"); });
    return () => { dead = true; cancelAnimationFrame(raf); viz?.disconnectAudio(node); };
  }, []);
  return (
    <FloatWin kind="milk" title="Milkdrop" left={160} top={90} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 4 }}>
        <canvas ref={cvs} width={480} height={300} onDoubleClick={() => next.current()} title="duplo clique: próximo preset"
          style={{ ...field, padding: 0, display: "block", background: "#000" }} />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ ...status, flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap" }}>{preset}</span>
          <button onClick={() => next.current()} style={{ ...btn(), height: 23, padding: "0 8px" }}><u>P</u>róximo</button>
        </div>
      </div>
    </FloatWin>
  );
}

// "Meu Computador": pick a folder (local disk or pen drive) and send its tracks to either deck.
type Track = { name: string; path: string; file?: File; url?: string };
function SetList({ onLoad, onClose }: { onLoad: (side: "A" | "B", t: Track) => void; onClose: () => void }) {
  const [files, setFiles] = useState<Track[]>([]);
  const add = (list: Track[]) => setFiles(fs => [...fs, ...list.filter(a => !fs.some(f => f.path === a.path))]
    .sort((a, b) => a.name.localeCompare(b.name)));
  // Dev server exposes ~/Músicas (or MUSIC_DIR) at /__music — preload it; files are fetched only when loaded.
  useEffect(() => {
    fetch("/__music").then(r => r.ok ? r.json() : []).then((paths: string[]) => add(paths.map(p => ({
      name: p.split("/").pop()!, path: "/" + p, url: "/__music/" + p.split("/").map(encodeURIComponent).join("/"),
    })))).catch(() => {});
  }, []);
  return (
    <FloatWin kind="pc" title="Set list – Meu Computador" left={110} top={60} onClose={onClose}>
      <div style={{ width: 428, display: "flex", flexDirection: "column", gap: 6, padding: 6 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <label style={{ ...btn(), height: 23, padding: "0 8px" }}>
            <span><u>A</u>dicionar pasta…</span>
            <input type="file" hidden multiple ref={el => el?.setAttribute("webkitdirectory", "")}
              onChange={e => {
                add([...(e.target.files ?? [])].filter(f => f.type.startsWith("audio/") || /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(f.name))
                  .map(f => ({ name: f.name, path: f.webkitRelativePath || f.name, file: f })));
                e.target.value = "";
              }} />
          </label>
          <button onClick={() => setFiles([])} disabled={!files.length} style={{ ...btn(), height: 23, padding: "0 8px" }}>Limpar</button>
          <span style={{ color: DIM, marginLeft: "auto" }}>{files.length} faixas</span>
        </div>
        <div style={{ ...field, height: 340, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {files.length === 0 && <span style={{ padding: "3px 4px", color: DIM }}>Escolha uma pasta do computador ou do pen drive</span>}
          {files.map((f, i) => (
            <div key={f.path} title={f.path}
              style={{ height: 20, flex: "none", display: "grid", gridTemplateColumns: "22px 1fr auto auto auto", gap: 2, alignItems: "center", padding: "0 2px 0 4px" }}>
              <span style={{ color: DIM }}>{i + 1}</span>
              <span style={{ overflow: "hidden", whiteSpace: "nowrap" }}>{f.name.replace(/\.[^.]+$/, "")}</span>
              <button onClick={() => onLoad("A", f)} title="carregar no Deck A" style={{ ...capBtn, width: 18, color: CA }}>A</button>
              <button onClick={() => onLoad("B", f)} title="carregar no Deck B" style={{ ...capBtn, width: 18, color: CB }}>B</button>
              <button onClick={() => setFiles(fs => fs.filter(x => x !== f))} title="remover" style={capBtn}><CloseIcon /></button>
            </div>
          ))}
        </div>
      </div>
    </FloatWin>
  );
}

const DESK_ICONS: [DeskKind, string][] =[["pc", "Meu Computador"], ["trash", "Lixeira"], ["dj", "songdj"], ["cd", "Spotify"], ["milk", "Milkdrop"]];

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
  const [focus, setFocus] = useState<"A" | "B">("A");
  const [tab, setTab] = useState<"cp" | "lib" | "out">("cp");
  const [deskSel, setDeskSel] = useState<DeskKind>("dj");
  const [checkpoints, setCheckpoints] = useState<{ id: number; tA: number; tB: number }[]>([]);
  const [cpSel, setCpSel] = useState<number | null>(null);
  const cpIdRef = useRef(1);
  // Library: the demos plus every file loaded this session.
  const [lib, setLib] = useState<LibItem[]>(() => (["A", "B"] as const).map((s, i) => ({
    id: i, name: DEMOS[s].name, bpm: DEMOS[s].bpm, pos: DEMOS[s].pos, type: DEMOS[s].type, url: DEMOS[s].url,
  })));
  const libIdRef = useRef(2);
  const apiARef = useRef<DeckApi | null>(null);
  const apiBRef = useRef<DeckApi | null>(null);
  const audioARef = useRef<DeckAudio | null>(null);
  const audioBRef = useRef<DeckAudio | null>(null);
  // YouTube controllers — created lazily by YouTubeCover when a deck switches
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
  // source, otherwise its Web Audio engine. Both expose play/pause/currentTime/seek.
  const transport = (side: "A" | "B") => {
    const src = side === "A" ? deckA.source : deckB.source;
    if (src === "youtube") return side === "A" ? ytARef.current : ytBRef.current;
    return side === "A" ? audioARef.current : audioBRef.current;
  };

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
      if (pa) { transport("A")?.pause(); setPlayingA(false); }
      else    { transport("A")?.play();  setPlayingA(true); }
    } else {
      if (!lb) return;
      if (pb) { transport("B")?.pause(); setPlayingB(false); }
      else    { transport("B")?.play();  setPlayingB(true); }
    }
  }

  // Master: if anything is playing → stop both; otherwise → start every loaded deck.
  function masterToggle() {
    const { la, lb, pa, pb } = stateRef.current;
    if (pa || pb) {
      transport("A")?.pause(); transport("B")?.pause();
      setPlayingA(false); setPlayingB(false);
    } else {
      if (la) { transport("A")?.play(); setPlayingA(true); }
      if (lb) { transport("B")?.play(); setPlayingB(true); }
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
  // Enter snapshots both decks' current positions as one numbered checkpoint.
  function addCheckpoint() {
    const { la, lb } = stateRef.current;
    if (!la && !lb) return;
    const tA = transport("A")?.currentTime() ?? 0;
    const tB = transport("B")?.currentTime() ?? 0;
    const id = cpIdRef.current++;
    setCheckpoints(cs => [...cs, { id, tA, tB }]);
    setCpSel(id);
  }
  // Jump both decks to a checkpoint's positions — playback state is untouched.
  function jumpCheckpoint(id: number) {
    const cp = checkpoints.find(c => c.id === id);
    if (!cp) return;
    setCpSel(id);
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
  const cpRef = useRef({ add: addCheckpoint });
  cpRef.current = { add: addCheckpoint };

  // Keyboard: Space = master, A = deck A, D = deck B, Enter = checkpoint,
  // Digits belong to the deck pads (see DeckPanel). Ignored while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Space" || e.key === " ") { e.preventDefault(); masterToggle(); return; }
      if (e.key === "Enter") { e.preventDefault(); cpRef.current.add(); return; }
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

  function addToLib(item: Omit<LibItem, "id">) {
    setLib(l => l.some(x => x.name === item.name) ? l : [...l, { ...item, id: libIdRef.current++ }]);
  }

  const compat = getCompat(deckA.camelotPos, deckA.camelotType, deckB.camelotPos, deckB.camelotType);
  const cc     = compatColor(compat);
  const effA   = deckA.bpm * (1 + deckA.tempo / 100);
  const effB   = deckB.bpm * (1 + deckB.tempo / 100);
  const keyA   = CAMELOT.find(c => c.pos === deckA.camelotPos)?.[deckA.camelotType] ?? "";
  const keyB   = CAMELOT.find(c => c.pos === deckB.camelotPos)?.[deckB.camelotType] ?? "";
  const other  = focus === "A" ? deckB : deckA;
  const xfv    = Math.round(cf - 50);
  const setFocused = focus === "A" ? setDeckA : setDeckB;
  const [resetPos, setResetPos] = useState(0);
  const [setListOpen, setSetListOpen] = useState(false);
  const [milkOpen, setMilkOpen] = useState(false);

  // Outputs: master → speakers (AudioContext sink), booth → headphones (its own <audio> sink).
  const [devs, setDevs] = useState<MediaDeviceInfo[]>([]);
  const [out, setOut] = useState({ master: "", booth: "", mon: 100, vol: 80, cueA: false, cueB: false });
  const setO = (p: Partial<typeof out>) => setOut(o => ({ ...o, ...p }));
  async function listDevs() {
    // Chrome only reveals device names after a mic permission grant; the stream is dropped right away.
    try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach(t => t.stop()); } catch {}
    setDevs((await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audiooutput"));
  }
  useEffect(() => { (getCtx() as any).setSinkId?.(out.master).catch(console.error); }, [out.master]);
  useEffect(() => {
    const el = getBus().boothEl as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (!out.booth) { el.pause(); return; }
    (el.setSinkId?.(out.booth) ?? Promise.resolve()).then(() => el.play()).catch(console.error);
  }, [out.booth]);
  useEffect(() => {
    const b = getBus();
    b.mon.gain.value = out.mon / 100;
    b.booth.gain.value = out.vol / 100;
    if (audioARef.current) audioARef.current.cue.gain.value = out.cueA ? 1 : 0;
    if (audioBRef.current) audioBRef.current.cue.gain.value = out.cueB ? 1 : 0;
  }, [out.mon, out.vol, out.cueA, out.cueB]);
  const mainDrag = useDrag(resetPos), mixDrag = useDrag(resetPos);

  const deckProps = (side: "A" | "B") => {
    const A = side === "A";
    return {
      side, color: A ? CA : CB, info: A ? deckA : deckB,
      onInfoChange: (p: Partial<DeckInfo>) => (A ? setDeckA : setDeckB)(d => ({ ...d, ...p })),
      audioRef: A ? audioARef : audioBRef, ytRef: A ? ytARef : ytBRef,
      onLoad: (pk: number[], dur: number) => { if (A) { setPeaksA(pk); setDurA(dur); } else { setPeaksB(pk); setDurB(dur); } },
      playing: A ? playingA : playingB, onToggle: () => toggleDeck(side),
      onSourceChange: (s: DeckSource) => changeSource(side, s),
      onPlayingChange: A ? setPlayingA : setPlayingB,
      focused: focus === side, onFocus: () => setFocus(side),
      otherBpm: A ? effB : effA,
      onOpenLibrary: () => { setFocus(side); setTab("lib"); },
      onLibraryAdd: addToLib,
      apiRef: A ? apiARef : apiBRef,
      resetPos,
    } as const;
  };

  const tabBtn = (k: "cp" | "lib" | "out", label: string) => (
    <button onClick={() => setTab(k)} style={{ ...btn(tab === k), height: 23 }}>{label}</button>
  );

  return (
    <div style={{ background: DESK, position: "fixed", inset: 0, overflow: "auto", fontFamily: FONT, fontSize: 12, userSelect: "none" }}>
      <div style={{ minWidth: 1300, minHeight: 820, height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, minHeight: 0, padding: "16px 20px 20px 8px", display: "flex", gap: 12 }}>
          {/* desktop icons */}
          <div style={{ width: 76, flex: "none", display: "flex", flexDirection: "column", gap: 18, paddingTop: 4 }}>
            {DESK_ICONS.map(([k, label]) => {
              const sel = deskSel === k;
              return (
                <div key={k} onClick={() => setDeskSel(k)} onDoubleClick={k === "cd" ? onOpenSpotify : k === "pc" ? () => setSetListOpen(true) : k === "milk" ? () => setMilkOpen(true) : undefined}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "default" }}>
                  <DeskIcon kind={k} />
                  <span style={{ padding: "1px 3px", textAlign: "center", color: "#fff",
                    background: sel ? "#000080" : "transparent", outline: sel ? "1px dotted #fff" : "none" }}>{label}</span>
                </div>
              );
            })}
          </div>

          {/* ── The window ── */}
          <div style={{ ...windowFrame, ...mainDrag.win, flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div {...mainDrag.bar} onDoubleClick={() => setResetPos(n => n + 1)} style={{ ...titleBar(), cursor: "move" }}>
              <NoteIcon s={2} />
              <span style={{ flex: 1, overflow: "hidden" }}>songdj – harmonic mixer</span>
              <button style={capBtn}><MinIcon /></button>
              <button style={capBtn}><MaxIcon /></button>
              <button style={{ ...capBtn, marginLeft: 2 }}><CloseIcon /></button>
            </div>
            <div style={{ height: 20, flex: "none", display: "flex", alignItems: "center", gap: 2, padding: "0 2px" }}>
              {[<><u>A</u>rquivo</>, <><u>D</u>ecks</>, <><u>M</u>ixer</>, <><u>E</u>xibir</>, <>Aj<u>u</u>da</>].map((l, i) => (
                <span key={i} style={{ padding: "2px 6px" }}>{l}</span>
              ))}
            </div>

            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 6, padding: "2px 2px 4px" }}>
              <TransitionView
                peaksA={peaksA} peaksB={peaksB}
                durationA={durA} durationB={durB}
                bpmA={effA} bpmB={effB}
                loadedA={deckA.loaded && deckA.source === "local"}
                loadedB={deckB.loaded && deckB.source === "local"}
                nameA={splitName(deckA.trackName).title} nameB={splitName(deckB.trackName).title}
                audioARef={audioARef} audioBRef={audioBRef}
                checkpoints={checkpoints}
              />
              <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 272px minmax(0, 1fr)", gap: 6 }}>
                <DeckPanel {...deckProps("A")} />

                {/* ── Mixer column ── */}
                <div style={{ ...windowFrame, ...mixDrag.win, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div {...mixDrag.bar} style={{ ...titleBar(false), cursor: "move" }}>Mixer</div>
                  <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 8, padding: "8px 6px 6px" }}>
                    <CamelotWheel aPos={deckA.camelotPos} aType={deckA.camelotType} bPos={deckB.camelotPos} bType={deckB.camelotType}
                      onPick={(pos, type) => setFocused(d => ({ ...d, camelotPos: pos, camelotType: type }))} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <Labeled label="Deck A :">
                        <div style={{ ...textField(18, 28), gap: 4 }}>
                          <span style={{ color: CA }}>{deckA.camelotPos}{deckA.camelotType}</span><span style={{ color: DIM, fontSize: 12 }}>{keyA}</span>
                        </div>
                      </Labeled>
                      <Labeled label="Deck B :">
                        <div style={{ ...textField(18, 28), gap: 4 }}>
                          <span style={{ color: CB }}>{deckB.camelotPos}{deckB.camelotType}</span><span style={{ color: DIM, fontSize: 12 }}>{keyB}</span>
                        </div>
                      </Labeled>
                    </div>
                    <div style={{ ...textField(18, 30, cc), justifyContent: "center" }}>{compat}</div>
                    <button onClick={syncBpm} style={{ ...btn(), height: 23, flex: "none" }}>
                      <span><u>S</u>incronizar BPM A → B</span>
                    </button>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: CA }}>A</span>
                        <span>Crossfader : {xfv === 0 ? "centro" : xfv < 0 ? `A ${Math.abs(xfv * 2)}%` : `B ${xfv * 2}%`}</span>
                        <span style={{ color: CB }}>B</span>
                      </div>
                      <SRange min={0} max={100} value={cf} onChange={setCf} pct={cf} reset={50} tick />
                      <div style={{ display: "flex", justifyContent: "center", paddingTop: 2 }}>
                        <button onClick={() => setCf(50)} style={{ ...btn(), height: 23, width: 76 }}><span>C<u>e</u>ntro</span></button>
                      </div>
                    </div>

                    <div style={{ flex: 1, minHeight: 120, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                        {tabBtn("cp", "Checkpoints")}
                        {tabBtn("lib", "Biblioteca")}
                        {tabBtn("out", "Saídas")}
                      </div>

                      {tab === "out" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {([["master", "Master (público) :", "padrão do sistema"], ["booth", "Booth (fone) :", "desligado"]] as const).map(([k, label, none]) => (
                            <Labeled key={k} label={label}>
                              <select value={out[k]} onChange={e => setO({ [k]: e.target.value })}
                                style={{ ...field, height: 22, width: "100%", fontFamily: FONT, fontSize: 12 }}>
                                <option value="">{none}</option>
                                {devs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId.slice(0, 8)}</option>)}
                              </select>
                            </Labeled>
                          ))}
                          <button onClick={listDevs} style={{ ...btn(), height: 23 }}><span><u>P</u>rocurar saídas</span></button>
                          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 4, alignItems: "center" }}>
                            <span>Cue no fone :</span>
                            <button onClick={() => setO({ cueA: !out.cueA })} style={{ ...btn(out.cueA), height: 23, color: CA }}>A</button>
                            <button onClick={() => setO({ cueB: !out.cueB })} style={{ ...btn(out.cueB), height: 23, color: CB }}>B</button>
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Master no fone :</span><span>{out.mon}%</span></div>
                            <SRange min={0} max={100} value={out.mon} onChange={v => setO({ mon: v })} pct={out.mon} reset={100} />
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Volume booth :</span><span>{out.vol}%</span></div>
                            <SRange min={0} max={100} value={out.vol} onChange={v => setO({ vol: v })} pct={out.vol} reset={80} />
                          </div>
                        </div>
                      ) : tab === "lib" ? (
                        <>
                          <span style={{ color: DIM }}>Clique para carregar no Deck {focus}</span>
                          <div style={{ ...field, flex: 1, minHeight: 0, overflowY: "scroll" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 2 }}>
                              {lib.map(t => {
                                const cur = (focus === "A" ? deckA : deckB).trackName === t.name;
                                const known = !!(t.pos && t.type);
                                const kc = cur ? "#fff" : known ? compatColor(getCompat(t.pos!, t.type!, other.camelotPos, other.camelotType)) : DIM;
                                return (
                                  <button key={t.id} className="flat" title={t.name}
                                    onClick={() => (focus === "A" ? apiARef : apiBRef).current?.loadItem(t)}
                                    style={{ border: "none", padding: 2, display: "flex", flexDirection: "column", gap: 2, textAlign: "left", cursor: "pointer",
                                      fontFamily: FONT, fontSize: 12, background: cur ? "#000080" : "transparent", color: cur ? "#fff" : "#000" }}>
                                    <div style={{ width: "100%", height: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                      background: "#fff", boxShadow: "inset -1px -1px #F0F0F0, inset 1px 1px #7E7E7E" }}>
                                      <span style={{ fontSize: 18, color: kc }}>{known ? `${t.pos}${t.type}` : "?"}</span>
                                      <span style={{ color: DIM }}>{t.bpm ? `${Math.round(t.bpm)} BPM` : "— BPM"}</span>
                                    </div>
                                    <span style={{ width: "100%", overflow: "hidden", whiteSpace: "nowrap" }}>{splitName(t.name).title}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: DIM }}>{checkpoints.length ? `${checkpoints.length} marcados` : "nenhum"}</span>
                            <button onClick={addCheckpoint} disabled={!deckA.loaded && !deckB.loaded} style={{ ...btn(), height: 23, padding: "0 8px" }}>
                              <span>+ <u>M</u>arcar (Enter)</span>
                            </button>
                          </div>
                          <div style={{ ...field, flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
                            {checkpoints.length === 0 && (
                              <span style={{ padding: "3px 4px", color: DIM }}>Enter salva os dois decks · clique para pular</span>
                            )}
                            {checkpoints.map((cp, i) => {
                              const sel = cpSel === cp.id;
                              return (
                                <div key={cp.id} onClick={() => jumpCheckpoint(cp.id)} title="pular os dois decks para cá"
                                  style={{ height: 18, flex: "none", padding: "0 0 0 4px", display: "grid", gridTemplateColumns: "18px 1fr 1fr auto auto",
                                    alignItems: "center", cursor: "pointer", background: sel ? "#000080" : "transparent", color: sel ? "#fff" : "#000" }}>
                                  <span>{i + 1 <= 9 ? i + 1 : "·"}</span>
                                  <span>A {fmtTime(cp.tA)}</span>
                                  <span>B {fmtTime(cp.tB)}</span>
                                  <button onClick={e => { e.stopPropagation(); syncFromCheckpoint(cp.id); }} title="sincronizar B em A por este checkpoint"
                                    style={{ ...capBtn, width: 18 }}>⇄</button>
                                  <button onClick={e => { e.stopPropagation(); removeCheckpoint(cp.id); }} title="apagar"
                                    style={capBtn}><CloseIcon /></button>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <DeckPanel {...deckProps("B")} />
              </div>
            </div>

            {/* status bar */}
            <div style={{ height: 22, flex: "none", display: "grid", gridTemplateColumns: "110px minmax(0, 1fr) 90px", gap: 2 }}>
              <div style={{ ...status, display: "flex", alignItems: "center", color: cc }}>{compat}</div>
              <div style={{ ...status, display: "flex", alignItems: "center", overflow: "hidden", whiteSpace: "nowrap" }}>
                A {deckA.camelotPos}{deckA.camelotType} {keyA} · {effA.toFixed(1)} BPM{"   ⇔   "}B {deckB.camelotPos}{deckB.camelotType} {keyB} · {effB.toFixed(1)} BPM
              </div>
              <div style={{ ...status, display: "flex", alignItems: "center" }}>{playing ? "Tocando" : "Parado"}</div>
            </div>
          </div>
        </div>

        {milkOpen && <Milkdrop onClose={() => setMilkOpen(false)} />}
        {setListOpen && <SetList onClose={() => setSetListOpen(false)}
          onLoad={(side, t) => (side === "A" ? apiARef : apiBRef).current?.loadItem({ id: -1, name: t.name, file: t.file, url: t.url })} />}

        {/* ── Taskbar ── */}
        <div style={{ height: 28, flex: "none", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 4, padding: 2,
          background: FACE, boxShadow: "inset 0 1px #C3C3C3, inset 0 2px #F0F0F0" }}>
          <button style={{ ...btn(), height: 22, padding: "0 6px", gap: 4 }}><NoteIcon s={2} /><span>Start</span></button>
          <div style={{ width: 2, height: 22, boxShadow: "inset 1px 0 #7E7E7E, inset -1px 0 #F0F0F0" }} />
          <button style={{ ...btn(true), height: 22, width: 160, justifyContent: "flex-start", gap: 4 }}><NoteIcon s={2} /><span>songdj</span></button>
          {onOpenSpotify && (
            <button onClick={onOpenSpotify} style={{ ...btn(), height: 22, width: 160, justifyContent: "flex-start", gap: 4 }}><NoteIcon s={2} /><span>Spotify</span></button>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ ...status, height: 22, boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 10px" }}>
            {clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    </div>
  );
}
