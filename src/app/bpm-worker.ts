// Web Worker: runs the (potentially slow) BPM analysis off the UI thread.
import { analyzeBpm } from "./bpm-detector";

self.onmessage = (e: MessageEvent) => {
  const { id, channel, sampleRate } = e.data as {
    id: number; channel: Float32Array; sampleRate: number;
  };
  try {
    const result = analyzeBpm(channel, sampleRate);
    (self as unknown as Worker).postMessage({ id, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id, error: err instanceof Error ? err.message : String(err),
    });
  }
};
