// ─── YouTube IFrame player wrapper ───────────────────────────────────────────
// The YouTube player runs in a cross-origin iframe, so its audio can never reach
// a Web Audio graph — no waveform, BPM, EQ or crossfader for a YouTube deck.
// What we can drive: load / play / pause / seek / volume / playlist navigation
// and read back current time + duration. This module owns the IFrame API script
// load and gives each deck a thin controller object.

let apiPromise: Promise<void> | null = null;

// Load https://www.youtube.com/iframe_api once; resolves when window.YT is ready.
export function loadYouTubeApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    // Already present (e.g. hot reload).
    if ((window as any).YT?.Player) { resolve(); return; }

    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      document.head.appendChild(s);
    }
  });
  return apiPromise;
}

// ── URL parsing ─────────────────────────────────────────────────────────────
export interface ParsedYouTube {
  videoId?:  string;
  listId?:   string;
  kind: "video" | "playlist" | "video-in-playlist" | "invalid";
}

export function parseYouTubeUrl(raw: string): ParsedYouTube {
  const s = raw.trim();
  if (!s) return { kind: "invalid" };

  let url: URL;
  try {
    url = new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    // Bare 11-char id?
    if (/^[\w-]{11}$/.test(s)) return { videoId: s, kind: "video" };
    return { kind: "invalid" };
  }

  const host = url.hostname.replace(/^www\./, "");
  let videoId: string | undefined;
  let listId  = url.searchParams.get("list") || undefined;

  if (host === "youtu.be") {
    videoId = url.pathname.slice(1) || undefined;
  } else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    if (url.pathname === "/watch") videoId = url.searchParams.get("v") || undefined;
    else if (url.pathname.startsWith("/embed/")) videoId = url.pathname.split("/")[2] || undefined;
    else if (url.pathname.startsWith("/shorts/")) videoId = url.pathname.split("/")[2] || undefined;
    else if (url.pathname === "/playlist") { /* listId only */ }
  } else {
    return { kind: "invalid" };
  }

  if (videoId && listId) return { videoId, listId, kind: "video-in-playlist" };
  if (listId)            return { listId, kind: "playlist" };
  if (videoId)           return { videoId, kind: "video" };
  return { kind: "invalid" };
}

// ── Controller ──────────────────────────────────────────────────────────────
export interface YouTubeState {
  ready:     boolean;
  playing:   boolean;
  duration:  number;
  title:     string;
  index:     number;   // position in playlist, -1 if single video
  listCount: number;   // 0 if single video
}

type Listener = (s: YouTubeState) => void;

export class YouTubeController {
  private player: any = null;
  private el: HTMLElement;
  private listeners = new Set<Listener>();
  private pollId: number | null = null;
  private _volume = 80;

  state: YouTubeState = {
    ready: false, playing: false, duration: 0, title: "",
    index: -1, listCount: 0,
  };

  constructor(el: HTMLElement) {
    this.el = el;
  }

  onChange(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn({ ...this.state });
  }

  async load(parsed: ParsedYouTube) {
    if (parsed.kind === "invalid") return;
    await loadYouTubeApi();
    const YT = (window as any).YT;

    const vars: Record<string, unknown> = {
      playsinline: 1,
      modestbranding: 1,
      rel: 0,
    };
    if (parsed.listId) {
      vars.list = parsed.listId;
      vars.listType = "playlist";
    }

    const applyStart = () => {
      // Once the player exists, load the right content.
      if (parsed.kind === "playlist") {
        this.player.loadPlaylist({ list: parsed.listId, listType: "playlist", index: 0 });
      } else if (parsed.kind === "video-in-playlist") {
        // Load the playlist, then jump to the clicked video if we can find it.
        this.player.loadPlaylist({ list: parsed.listId, listType: "playlist", index: 0 });
      } else if (parsed.videoId) {
        this.player.loadVideoById(parsed.videoId);
      }
    };

    if (this.player) {
      applyStart();
      return;
    }

    this.player = new YT.Player(this.el, {
      width: "100%",
      height: "100%",
      videoId: parsed.videoId,
      playerVars: vars,
      events: {
        onReady: () => {
          this.player.setVolume(this._volume);
          this.state.ready = true;
          this.refresh();
          this.startPolling();
          this.emit();
        },
        onStateChange: (e: any) => {
          // 1 = playing, 2 = paused, 0 = ended
          this.state.playing = e.data === 1;
          this.refresh();
          this.emit();
        },
      },
    });
  }

  private refresh() {
    if (!this.player) return;
    try {
      this.state.duration = this.player.getDuration() || 0;
      const data = this.player.getVideoData?.() ?? {};
      this.state.title = data.title || "";
      const list = this.player.getPlaylist?.() ?? null;
      this.state.listCount = Array.isArray(list) ? list.length : 0;
      this.state.index = this.state.listCount
        ? (this.player.getPlaylistIndex?.() ?? -1)
        : -1;
    } catch { /* player not fully ready */ }
  }

  private startPolling() {
    if (this.pollId != null) return;
    const tick = () => {
      if (this.state.playing) this.emit(); // time advanced
      this.pollId = window.setTimeout(tick, 250);
    };
    tick();
  }

  // ── Transport (mirrors the subset of DeckAudio the UI calls) ──────────────
  get playing()  { return this.state.playing; }
  get duration() { return this.state.duration; }
  currentTime()  { return this.player?.getCurrentTime?.() ?? 0; }

  play()  { this.player?.playVideo?.(); }
  pause() { this.player?.pauseVideo?.(); }
  seek(t: number) {
    this.player?.seekTo?.(Math.max(0, t), true);
  }
  setVol(v01: number) {
    this._volume = Math.round(v01 * 100);
    this.player?.setVolume?.(this._volume);
  }

  next() { this.player?.nextVideo?.(); }
  prev() { this.player?.previousVideo?.(); }

  destroy() {
    if (this.pollId != null) window.clearTimeout(this.pollId);
    this.pollId = null;
    try { this.player?.destroy?.(); } catch {}
    this.player = null;
    this.listeners.clear();
  }
}
