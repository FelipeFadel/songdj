import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, LogOut, Music2, ListMusic, Clock, RefreshCw } from "lucide-react";
import { FONT, DESK, DIM, windowFrame, field, btn, titleBar, capBtn } from "./win98";
import { CloseIcon } from "./icons";
import {
  isConnected, beginLogin, handleRedirectCallback, clearToken,
  getClientId, setClientId,
  getMe, getMyPlaylists, getPlaylistTracks,
  type SpotifyUser, type SimplePlaylist, type SimpleTrack,
} from "./spotify";

const GREEN = "#008000";

function fmtDur(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// ─── Client ID setup (shown when no VITE_SPOTIFY_CLIENT_ID / stored id) ───────
function ClientIdSetup({ onSaved }: { onSaved: () => void }) {
  const [val, setVal] = useState(getClientId());
  return (
    <Dialog title="Configurar Spotify" width={460}>
      <p style={{ margin: "0 0 8px", lineHeight: 1.4 }}>
        Crie um app em developer.spotify.com/dashboard e adicione este Redirect URI:
      </p>
      <div style={{ ...field, padding: "3px 4px", marginBottom: 10, wordBreak: "break-all", userSelect: "all" }}>
        {`${window.location.origin}${window.location.pathname}#/spotify/callback`}
      </div>
      <label>Client ID :</label>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="cole o Client ID do seu app"
        style={{ ...field, width: "100%", boxSizing: "border-box", marginTop: 2, marginBottom: 12,
          border: "none", outline: "none", fontFamily: FONT, fontSize: 12, padding: "3px 4px" }}
      />
      <div style={{ textAlign: "right" }}>
        <button onClick={() => { if (val.trim()) { setClientId(val); onSaved(); } }}
          style={{ ...btn(), height: 23, minWidth: 75, outline: "1px solid #000" }}>
          <u>S</u>alvar
        </button>
      </div>
    </Dialog>
  );
}

// ─── Win98 dialog window ─────────────────────────────────────────────────────
function Dialog({ title, width, children }: { title: string; width: number; children: React.ReactNode }) {
  return (
    <div style={{ ...windowFrame, maxWidth: width, width: "100%", alignSelf: "center" }}>
      <div style={titleBar()}>
        <span style={{ flex: 1 }}>{title}</span>
        <button style={capBtn}><CloseIcon /></button>
      </div>
      <div style={{ padding: 10 }}>{children}</div>
    </div>
  );
}

// ─── Track list for one playlist ─────────────────────────────────────────────
function TrackList({ playlist, onBack }: { playlist: SimplePlaylist; onBack: () => void }) {
  const [tracks, setTracks] = useState<SimpleTrack[] | null>(null);
  const [err, setErr]       = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setTracks(null); setErr("");
    getPlaylistTracks(playlist.id)
      .then(t => { if (alive) setTracks(t); })
      .catch(e => { if (alive) setErr(String(e.message ?? e)); });
    return () => { alive = false; };
  }, [playlist.id]);

  const cols = "28px 1fr 56px 48px 44px";
  return (
    <div style={{ ...windowFrame, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={titleBar()}>
        <ListMusic size={12} />
        <span style={{ flex: 1 }}>{playlist.name} - {playlist.tracks.total} faixas</span>
      </div>
      <div style={{ display: "flex", gap: 4, padding: 4 }}>
        <button onClick={onBack} style={{ ...btn(), gap: 4, height: 23 }}>
          <ArrowLeft size={11} /> Playlists
        </button>
      </div>

      <div style={{ ...field, flex: 1, minHeight: 0, overflowY: "auto", margin: "0 4px 4px" }}>
        {err && <div style={{ color: "#C00000", padding: 6 }}>{err}</div>}
        {!tracks && !err && (
          <div style={{ padding: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={11} className="spin" /> carregando faixas + BPM/tom…
          </div>
        )}
        {tracks && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: cols, position: "sticky", top: 0 }}>
              {["#", "Faixa", "BPM", "Tom"].map(h => <span key={h} style={{ ...btn(), justifyContent: "flex-start", height: 18, cursor: "default" }}>{h}</span>)}
              <span style={{ ...btn(), height: 18, cursor: "default" }}><Clock size={10} /></span>
            </div>
            {tracks.map((t, i) => {
              const on = selected === t.id;
              return (
                <button
                  key={t.id + i}
                  className="flat"
                  onClick={() => setSelected(t.id)}
                  style={{
                    width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                    display: "grid", gridTemplateColumns: cols, alignItems: "center", padding: "2px 0",
                    fontFamily: FONT, fontSize: 12,
                    background: on ? "#000080" : "transparent", color: on ? "#fff" : "#000",
                  }}>
                  <span style={{ paddingLeft: 6 }}>{i + 1}</span>
                  <span style={{ overflow: "hidden", whiteSpace: "nowrap", paddingLeft: 6 }}>
                    {t.name} <span style={{ color: on ? "#fff" : DIM }}>- {t.artists}</span>
                  </span>
                  <span style={{ paddingLeft: 6 }}>{t.bpm ?? "—"}</span>
                  <span style={{ paddingLeft: 6, color: on ? "#fff" : t.camelot && t.camelot !== "—" ? GREEN : DIM }}>{t.camelot ?? "—"}</span>
                  <span style={{ textAlign: "right", paddingRight: 6 }}>{fmtDur(t.durationMs)}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
      {selected && (
        <div style={{ margin: "0 4px 2px", boxShadow: "inset -1px -1px #F0F0F0, inset 1px 1px #7E7E7E", padding: "1px 6px" }}>
          faixa selecionada (ilustrativo) — {tracks?.find(t => t.id === selected)?.name}
        </div>
      )}
    </div>
  );
}

// ─── Playlist grid ──────────────────────────────────────────────────────────
function PlaylistGrid({ onOpen }: { onOpen: (p: SimplePlaylist) => void }) {
  const [lists, setLists] = useState<SimplePlaylist[] | null>(null);
  const [err, setErr]     = useState("");

  const load = useCallback(() => {
    setLists(null); setErr("");
    getMyPlaylists().then(setLists).catch(e => setErr(String(e.message ?? e)));
  }, []);
  useEffect(load, [load]);

  return (
    <div style={{ ...windowFrame, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={titleBar()}>
        <ListMusic size={12} />
        <span style={{ flex: 1 }}>Suas playlists</span>
      </div>
      <div style={{ display: "flex", gap: 4, padding: 4 }}>
        <button onClick={load} style={{ ...btn(), gap: 4, height: 23 }}>
          <RefreshCw size={10} /><span><u>A</u>tualizar</span>
        </button>
      </div>
      <div style={{ ...field, flex: 1, minHeight: 0, overflowY: "auto", margin: "0 4px 4px", padding: 8 }}>
        {err && <div style={{ color: "#C00000" }}>{err}</div>}
        {!lists && !err && <div>carregando…</div>}
        {lists && lists.length === 0 && <div>nenhuma playlist encontrada</div>}
        {lists && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
            {lists.map(p => (
              <button
                key={p.id}
                className="flat"
                onClick={() => onOpen(p)}
                style={{
                  border: "none", cursor: "pointer", background: "transparent", padding: 2,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  fontFamily: FONT, fontSize: 12, color: "#000",
                }}>
                <div style={{ ...field, width: 96, height: 96, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p.images?.[0]?.url
                    ? <img src={p.images[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated" }} />
                    : <Music2 size={28} color={DIM} />}
                </div>
                <span style={{ maxWidth: "100%", overflow: "hidden", whiteSpace: "nowrap" }}>{p.name}</span>
                <span style={{ color: DIM }}>{p.tracks.total} faixas</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root Spotify view ──────────────────────────────────────────────────────
export default function SpotifyView({ onExit }: { onExit: () => void }) {
  const [connected, setConnected] = useState(isConnected());
  const [me, setMe]               = useState<SpotifyUser | null>(null);
  const [open, setOpen]           = useState<SimplePlaylist | null>(null);
  const [authErr, setAuthErr]     = useState("");
  const [needsClientId, setNeedsClientId] = useState(!getClientId());
  const [busy, setBusy]           = useState(false);

  // On mount: if we came back from Spotify with ?code=..., finish the exchange.
  useEffect(() => {
    (async () => {
      try {
        const did = await handleRedirectCallback();
        if (did) setConnected(true);
      } catch (e) {
        setAuthErr(String((e as Error).message ?? e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!connected) { setMe(null); return; }
    getMe().then(setMe).catch(e => setAuthErr(String(e.message ?? e)));
  }, [connected]);

  async function connect() {
    setAuthErr(""); setBusy(true);
    try { await beginLogin(); }
    catch (e) { setAuthErr(String((e as Error).message ?? e)); setBusy(false); }
  }
  function disconnect() {
    clearToken();
    setConnected(false);
    setOpen(null);
  }

  return (
    <div style={{ background: DESK, position: "fixed", inset: 0, fontFamily: FONT, fontSize: 12, display: "flex", flexDirection: "column" }}>
      {/* body */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: connected ? "stretch" : "center", justifyContent: "center", padding: 16 }}>
        {authErr && (
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 5 }}>
            <Dialog title="Erro" width={420}>{authErr}</Dialog>
          </div>
        )}

        {!connected ? (
          needsClientId ? (
            <ClientIdSetup onSaved={() => setNeedsClientId(false)} />
          ) : (
            <Dialog title="Spotify" width={400}>
              <p style={{ margin: "0 0 12px", lineHeight: 1.4 }}>
                Faça login para ver suas playlists e escolher faixas. O BPM e o tom
                vêm direto do Spotify.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                <button onClick={() => setNeedsClientId(true)} style={{ ...btn(), height: 23 }}>Client ID…</button>
                <button onClick={connect} disabled={busy} style={{ ...btn(), gap: 4, height: 23, minWidth: 75, outline: "1px solid #000" }}>
                  <Music2 size={12} /> {busy ? "Redirecionando…" : "Logar"}
                </button>
              </div>
            </Dialog>
          )
        ) : open ? (
          <TrackList playlist={open} onBack={() => setOpen(null)} />
        ) : (
          <PlaylistGrid onOpen={setOpen} />
        )}
      </div>

      {/* taskbar */}
      <div style={{
        height: 28, flexShrink: 0, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 4, padding: 2,
        background: "#C3C3C3", boxShadow: "inset 0 1px #C3C3C3, inset 0 2px #fff",
      }}>
        <button onClick={onExit} style={{ ...btn(), gap: 4, height: 22, width: 160, justifyContent: "flex-start" }}>
          <ArrowLeft size={12} /> songdj
        </button>
        <button style={{ ...btn(true), gap: 4, height: 22, width: 160, justifyContent: "flex-start", background: "#E3E3E3" }}>
          <Music2 size={12} /> Spotify
        </button>
        {connected && (
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            {me?.display_name ?? "…"}
            <button onClick={disconnect} style={{ ...btn(), gap: 4, height: 22 }}>
              <LogOut size={10} /> Sair
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
