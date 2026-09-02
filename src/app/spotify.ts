// ─── Spotify auth + API (browser-only, Authorization Code + PKCE) ─────────────
// No backend: the PKCE flow lets a public client obtain a user token entirely in
// the browser. Tokens live in localStorage and are refreshed on demand.
//
// Setup: create an app at https://developer.spotify.com/dashboard, add the
// redirect URI shown by redirectUri() below, and put the Client ID in
// VITE_SPOTIFY_CLIENT_ID (a .env file) — or call setClientId() at runtime.

const LS_TOKEN     = "spotify.token";
const LS_VERIFIER  = "spotify.pkce_verifier";
const LS_CLIENT_ID = "spotify.client_id";

const SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
].join(" ");

export function getClientId(): string {
  return (
    localStorage.getItem(LS_CLIENT_ID) ||
    (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) ||
    ""
  );
}
export function setClientId(id: string) {
  localStorage.setItem(LS_CLIENT_ID, id.trim());
}

// Redirect back to the app on the #/spotify route so the router lands there.
export function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}#/spotify/callback`;
}

// ── PKCE helpers ────────────────────────────────────────────────────────────
function randomString(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}
async function sha256base64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ── Token shape ────────────────────────────────────────────────────────────
interface StoredToken {
  access_token:  string;
  refresh_token?: string;
  expires_at:    number; // epoch ms
}

function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(LS_TOKEN);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch { return null; }
}
function writeToken(t: StoredToken) {
  localStorage.setItem(LS_TOKEN, JSON.stringify(t));
}
export function clearToken() {
  localStorage.removeItem(LS_TOKEN);
}
export function isConnected(): boolean {
  return !!readToken();
}

// ── Flow: begin login ──────────────────────────────────────────────────────
export async function beginLogin(): Promise<void> {
  const clientId = getClientId();
  if (!clientId) throw new Error("Spotify Client ID não configurado");

  const verifier  = randomString(64);
  const challenge = await sha256base64url(verifier);
  localStorage.setItem(LS_VERIFIER, verifier);

  const params = new URLSearchParams({
    client_id:             clientId,
    response_type:         "code",
    redirect_uri:          redirectUri(),
    scope:                 SCOPES,
    code_challenge_method: "S256",
    code_challenge:        challenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

// ── Flow: handle the redirect back (?code=... in the URL) ───────────────────
// Returns true if a code was present and exchanged.
export async function handleRedirectCallback(): Promise<boolean> {
  // The code comes back as a normal query string, but our redirect URI puts it
  // after the hash route, e.g. #/spotify/callback?code=...  — parse from both.
  const hash   = window.location.hash;
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return false;

  const search = new URLSearchParams(hash.slice(qIndex + 1));
  const code   = search.get("code");
  const err    = search.get("error");
  if (err) throw new Error(`Spotify negou o acesso: ${err}`);
  if (!code) return false;

  const verifier = localStorage.getItem(LS_VERIFIER);
  if (!verifier) throw new Error("PKCE verifier ausente — refaça o login");

  const body = new URLSearchParams({
    client_id:     getClientId(),
    grant_type:    "authorization_code",
    code,
    redirect_uri:  redirectUri(),
    code_verifier: verifier,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Falha ao obter token (${res.status})`);
  const json = await res.json();

  writeToken({
    access_token:  json.access_token,
    refresh_token: json.refresh_token,
    expires_at:    Date.now() + (json.expires_in ?? 3600) * 1000 - 30_000,
  });
  localStorage.removeItem(LS_VERIFIER);

  // Strip the code from the URL, stay on #/spotify.
  window.history.replaceState(null, "", `${window.location.pathname}#/spotify`);
  return true;
}

// ── Token access with refresh ──────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  const t = readToken();
  if (!t) throw new Error("Não conectado ao Spotify");
  if (Date.now() < t.expires_at) return t.access_token;

  if (!t.refresh_token) { clearToken(); throw new Error("Sessão expirada — reconecte"); }

  const body = new URLSearchParams({
    client_id:     getClientId(),
    grant_type:    "refresh_token",
    refresh_token: t.refresh_token,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) { clearToken(); throw new Error("Falha ao renovar sessão"); }
  const json = await res.json();
  const next: StoredToken = {
    access_token:  json.access_token,
    refresh_token: json.refresh_token ?? t.refresh_token,
    expires_at:    Date.now() + (json.expires_in ?? 3600) * 1000 - 30_000,
  };
  writeToken(next);
  return next.access_token;
}

async function api<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) { clearToken(); throw new Error("Sessão inválida — reconecte"); }
  if (!res.ok) throw new Error(`Spotify API ${res.status} em ${path}`);
  return res.json() as Promise<T>;
}

// ── Domain types ───────────────────────────────────────────────────────────
export interface SpotifyUser {
  display_name: string;
  images: { url: string }[];
}
export interface SimplePlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
  owner: { display_name: string };
}
export interface SimpleTrack {
  id: string;
  name: string;
  artists: string;
  durationMs: number;
  previewUrl: string | null;
  // filled from audio-features
  bpm?: number;
  camelot?: string;
}

// Musical key (0=C..11=B) + mode (0=minor,1=major) → Camelot code.
const CAMELOT_MAJOR = ["8B","3B","10B","5B","12B","7B","2B","9B","4B","11B","6B","1B"];
const CAMELOT_MINOR = ["5A","12A","7A","2A","9A","4A","11A","6A","1A","8A","3A","10A"];
export function toCamelot(key: number, mode: number): string {
  if (key < 0) return "—";
  return mode === 1 ? CAMELOT_MAJOR[key] : CAMELOT_MINOR[key];
}

// ── API calls ──────────────────────────────────────────────────────────────
export function getMe() {
  return api<SpotifyUser>("/me");
}

export async function getMyPlaylists(): Promise<SimplePlaylist[]> {
  const out: SimplePlaylist[] = [];
  let url = "/me/playlists?limit=50";
  // paginate
  for (let guard = 0; guard < 10; guard++) {
    const page = await api<{ items: SimplePlaylist[]; next: string | null }>(url);
    out.push(...page.items.filter(Boolean));
    if (!page.next) break;
    url = page.next.replace("https://api.spotify.com/v1", "");
  }
  return out;
}

export async function getPlaylistTracks(playlistId: string): Promise<SimpleTrack[]> {
  interface RawItem {
    track: {
      id: string;
      name: string;
      duration_ms: number;
      preview_url: string | null;
      artists: { name: string }[];
    } | null;
  }
  const tracks: SimpleTrack[] = [];
  let url = `/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,duration_ms,preview_url,artists(name))),next`;
  for (let guard = 0; guard < 10; guard++) {
    const page = await api<{ items: RawItem[]; next: string | null }>(url);
    for (const it of page.items) {
      const t = it.track;
      if (!t || !t.id) continue;
      tracks.push({
        id: t.id,
        name: t.name,
        artists: t.artists.map(a => a.name).join(", "),
        durationMs: t.duration_ms,
        previewUrl: t.preview_url,
      });
    }
    if (!page.next) break;
    url = page.next.replace("https://api.spotify.com/v1", "");
  }

  // Enrich with BPM + key in batches of 100.
  for (let i = 0; i < tracks.length; i += 100) {
    const slice = tracks.slice(i, i + 100);
    const ids   = slice.map(t => t.id).join(",");
    try {
      const feats = await api<{ audio_features: ({ tempo: number; key: number; mode: number; id: string } | null)[] }>(
        `/audio-features?ids=${ids}`,
      );
      const byId = new Map(feats.audio_features.filter(Boolean).map(f => [f!.id, f!]));
      for (const t of slice) {
        const f = byId.get(t.id);
        if (f) {
          t.bpm = Math.round(f.tempo);
          t.camelot = toCamelot(f.key, f.mode);
        }
      }
    } catch { /* features are best-effort */ }
  }

  return tracks;
}
