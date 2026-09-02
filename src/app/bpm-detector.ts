// ─── BPM detection ────────────────────────────────────────────────────────────
// Onset-strength envelope → autocorrelation. This is the standard robust tempo
// estimator: build a signal that spikes whenever energy rises (a note/kick
// attack), then find the lag at which that signal most resembles a delayed copy
// of itself — that lag is the beat period.
//
// Autocorrelation beats peak-interval histograms on real music because it uses
// every sample of the envelope, not just the handful that clear a peak
// threshold, so syncopation and soft attacks don't drag the estimate down.
//
// Runs in a Web Worker (see detectBpm() below) so long tracks never block the UI.

export interface BpmResult {
  bpm:        number;   // best guess, folded into [90, 180)
  confidence: number;   // 0..1 — autocorrelation strength at the winning lag
  candidates: { bpm: number; score: number }[];
}

const BPM_MIN = 70;
const BPM_MAX = 200;
const FOLD_LO = 90;   // final answer folded into [FOLD_LO, FOLD_HI)
const FOLD_HI = 180;

// ── Onset-strength envelope ──────────────────────────────────────────────────
// Short-time energy in overlapping frames, then half-wave-rectified first
// difference (spectral-flux-lite): we only care about energy *increases*.
// Returns the envelope plus its effective sample rate (frames per second).
function onsetEnvelope(data: Float32Array, sampleRate: number): { env: Float32Array; envRate: number } {
  const hop      = Math.max(1, Math.round(sampleRate * 0.01)); // 10 ms → 100 fps
  const frameLen = hop * 2;
  const frames   = Math.floor((data.length - frameLen) / hop);
  if (frames < 8) return { env: new Float32Array(0), envRate: sampleRate / hop };

  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const base = f * hop;
    for (let i = 0; i < frameLen; i++) {
      const s = data[base + i];
      sum += s * s;
    }
    energy[f] = Math.sqrt(sum / frameLen);
  }

  // Log-compress so quiet and loud sections contribute comparably, then take the
  // positive first difference.
  const env = new Float32Array(frames);
  let prev = Math.log1p(energy[0] * 20);
  for (let f = 1; f < frames; f++) {
    const cur  = Math.log1p(energy[f] * 20);
    const diff = cur - prev;
    env[f] = diff > 0 ? diff : 0;
    prev = cur;
  }

  // Subtract a local mean (≈0.4 s window) to flatten slow swells, keeping sharp
  // onsets. Then normalise.
  const win = Math.max(1, Math.round(0.4 * (sampleRate / hop)));
  const out = new Float32Array(frames);
  let acc = 0;
  for (let f = 0; f < frames; f++) {
    acc += env[f];
    if (f >= win) acc -= env[f - win];
    const localMean = acc / Math.min(f + 1, win);
    const v = env[f] - localMean;
    out[f] = v > 0 ? v : 0;
  }
  let max = 0;
  for (let f = 0; f < frames; f++) if (out[f] > max) max = out[f];
  if (max > 0) for (let f = 0; f < frames; f++) out[f] /= max;

  return { env: out, envRate: sampleRate / hop };
}

// ── Autocorrelation over the beat-period range ───────────────────────────────
// For each candidate BPM, correlate the envelope with itself shifted by that
// period's worth of frames. A perceptual weight favours tempi near 120 BPM
// (Moelants' resonance curve) so we don't lock onto a slow sub-harmonic.
function autocorrTempo(env: Float32Array, envRate: number) {
  const n = env.length;
  const lagMin = Math.floor((60 / BPM_MAX) * envRate);
  const lagMax = Math.ceil((60 / BPM_MIN) * envRate);

  // Raw autocorrelation across every candidate lag.
  const nLags = lagMax - lagMin + 1;
  const ac    = new Float32Array(nLags);
  for (let k = 0; k < nLags; k++) {
    const lag = lagMin + k;
    if (lag >= n) break;
    let dot = 0;
    for (let i = lag; i < n; i++) dot += env[i] * env[i - lag];
    ac[k] = dot / (n - lag);
  }

  const acAt = (lag: number) => {
    const k = Math.round(lag) - lagMin;
    return k >= 0 && k < nLags ? ac[k] : 0;
  };

  const scores: { bpm: number; raw: number; weighted: number }[] = [];
  for (let k = 0; k < nLags; k++) {
    const lag = lagMin + k;
    if (lag >= n) break;
    const bpm = 60 * envRate / lag;
    // Sub-harmonic sum: a real beat period repeats, so a true tempo has
    // autocorrelation mass at 2×, 3×, 4× its lag too. Comb-summing these
    // suppresses spurious mid-range shelves that only peak once.
    // Comb-sum only true integer multiples of this lag (2×,3×,4×). A spurious
    // 3:2 shelf has no matching mass at 2× its lag, so this de-emphasises it
    // relative to a genuine beat period.
    const combed =
      ac[k] +
      0.5  * acAt(lag * 2) +
      0.33 * acAt(lag * 3) +
      0.25 * acAt(lag * 4);
    // Very gentle resonance weight — just enough to break ties toward musical
    // tempi without inventing peaks. Wide Gaussian around 125 BPM.
    const l = Math.log2(bpm / 125);
    const w = 0.85 + 0.15 * Math.exp(-0.5 * (l / 1.1) ** 2);
    scores.push({ bpm, raw: ac[k], weighted: combed * w });
  }
  return scores;
}

// Pick the winner, then check its octave: if the half or double tempo scores
// nearly as well *and* lands closer to the comfortable 90–180 band, prefer it.
function resolveOctave(scores: { bpm: number; raw: number; weighted: number }[]) {
  const sorted = [...scores].sort((a, b) => b.weighted - a.weighted);
  let best = sorted[0];
  if (!best) return { bpm: 0, confidence: 0, ranked: sorted };

  const near   = (a: number, b: number) => Math.abs(a - b) / b < 0.04;
  const inBand = (x: number) => x >= FOLD_LO && x < FOLD_HI;
  // Tempo and its double are perceptually ambiguous; the autocorrelation peak at
  // the half-lag is often as tall as the true one because energy recurs every
  // half-beat. Convention (and how people tap) favours the slower reading, so
  // when a half-tempo sibling scores comparably, take it — unless that would
  // drop us below the usable band while the faster one sits inside it.
  for (const alt of sorted.slice(1, 16)) {
    const isHalf = near(alt.bpm, best.bpm / 2);
    if (!isHalf) continue;
    const comparable = alt.weighted > best.weighted * 0.6;
    const stillUsable = alt.bpm >= BPM_MIN;
    const losesBand  = inBand(best.bpm) && !inBand(alt.bpm) && alt.bpm < FOLD_LO * 0.8;
    if (comparable && stillUsable && !losesBand) best = alt;
  }
  // Then, if the winner is still outside the comfortable band but its double
  // isn't and scores decently, step up.
  for (const alt of sorted.slice(1, 16)) {
    if (near(alt.bpm, best.bpm * 2) && inBand(alt.bpm) && !inBand(best.bpm)
        && alt.weighted > best.weighted * 0.7) {
      best = alt;
    }
  }


  // Confidence: winning raw correlation relative to the mean — how much it
  // stands out from the noise floor.
  const meanRaw = scores.reduce((s, x) => s + x.raw, 0) / (scores.length || 1);
  const confidence = meanRaw > 0 ? Math.min(1, (best.raw / meanRaw - 1) / 3) : 0;

  return { bpm: best.bpm, confidence, ranked: sorted };
}

// Refine an integer-ish BPM by parabolic interpolation around the winning lag
// would need lag context; instead just snap to 0.1 precision.
function foldBpm(bpm: number) {
  let b = bpm;
  while (b && b < FOLD_LO) b *= 2;
  while (b && b >= FOLD_HI) b /= 2;
  return b;
}

// Core analysis, callable from either a worker or the main thread.
export function analyzeBpm(channel: Float32Array, sampleRate: number): BpmResult {
  const { env, envRate } = onsetEnvelope(channel, sampleRate);
  if (env.length < 16) return { bpm: 0, confidence: 0, candidates: [] };

  const scores = autocorrTempo(env, envRate);
  if (!scores.length) return { bpm: 0, confidence: 0, candidates: [] };

  const { bpm, confidence, ranked } = resolveOctave(scores);
  const folded = foldBpm(bpm);

  return {
    bpm:        Math.round(folded * 10) / 10,
    confidence: +confidence.toFixed(3),
    candidates: ranked.slice(0, 4).map(r => ({
      bpm:   Math.round(foldBpm(r.bpm) * 10) / 10,
      score: +(r.weighted).toFixed(4),
    })),
  };
}

// ─── Main-thread entry: spins up the worker, returns a promise ────────────────
let _worker: Worker | null = null;
function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(new URL("./bpm-worker.ts", import.meta.url), { type: "module" });
  }
  return _worker;
}

let _reqId = 0;

/**
 * Detect the BPM of an AudioBuffer off the main thread. Copies channel 0 into a
 * transferable buffer and hands it to the worker; resolves with the estimate.
 */
export function detectBpm(buffer: AudioBuffer): Promise<BpmResult> {
  const src = buffer.getChannelData(0);
  // Copy so the transfer doesn't neuter the live AudioBuffer's backing store.
  const copy = new Float32Array(src.length);
  copy.set(src);

  const id = ++_reqId;
  const worker = getWorker();

  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.result as BpmResult);
    };
    const onError = (e: ErrorEvent) => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      reject(e.error ?? new Error("BPM worker error"));
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage(
      { id, channel: copy, sampleRate: buffer.sampleRate },
      [copy.buffer],
    );
  });
}
