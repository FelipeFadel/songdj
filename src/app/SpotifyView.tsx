import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, LogOut, Music2, ListMusic, Clock, RefreshCw } from "lucide-react";
import { MONO, COND, UI, desktopBg, glass, well, glossyBtn, chromeFrame, titleBar } from "./aero";
import {
  isConnected, beginLogin, handleRedirectCallback, clearToken,
  getClientId, setClientId,
  getMe, getMyPlaylists, getPlaylistTracks,
  type SpotifyUser, type SimplePlaylist, type SimpleTrack,
} from "./spotify";

const GREEN = "#1db954";

function fmtDur(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// ─── Client ID setup (shown when no VITE_SPOTIFY_CLIENT_ID / stored id) ───────
function ClientIdSetup({ onSaved }: { onSaved: () => void }) {
  const [val, setVal] = useState(getClientId());
  return (
    <div style={{ ...glass("rgba(10,14,28,0.7)"), borderRadius: 12, padding: 20, maxWidth: 460, width: "100%" }}>
      <div style={{ fontFamily: COND, fontSize: 20, fontWeight: 800, letterSpacing: "0.1em", color: "#fff", marginBottom: 8 }}>
        CONFIGURAR SPOTIFY
      </div>
      <p style={{ fontFamily: MONO, fontSize: 11, color: "#aab2d8", lineHeight: 1.6, margin: "0 0 12px" }}>
        Crie um app em <span style={{ color: GREEN }}>developer.spotify.com/dashboard</span>,
        adicione este Redirect URI:
      </p>
      <code style={{
        display: "block", fontFamily: MONO, fontSize: 10, color: "#dfe7ff",
        background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 6, padding: "8px 10px", marginBottom: 14, wordBreak: "break-all",
      }}>
        {`${window.location.origin}${window.location.pathname}#/spotify/callback`}
      </code>
      <label style={{ fontFamily: MONO, fontSize: 10, color: "#8a92c8", letterSpacing: "0.1em" }}>CLIENT ID</label>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="cole o Client ID do seu app"
        style={{
          width: "100%", marginTop: 5, marginBottom: 14,
          background: "rgba(0,0,0,0.4)", border: `1px solid ${GREEN}55`, borderRadius: 6,
          color: "#dfe7ff", fontFamily: MONO, fontSize: 11, padding: "8px 10px", outline: "none",
        }}
      />
      <button
        onClick={() => { if (val.trim()) { setClientId(val); onSaved(); } }}
        style={{ ...glossyBtn(GREEN), width: "100%", padding: "9px", fontSize: 11 }}>
        SALVAR
      </button>
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

  return (
    <div style={{ ...chromeFrame, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{ ...titleBar("#1a7f3c"), padding: "6px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ ...glossyBtn("#2f6fbf"), padding: "3px 8px", fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={11} /> PLAYLISTS
        </button>
        <span style={{ fontFamily: COND, fontSize: 17, fontWeight: 800, letterSpacing: "0.08em" }}>
          {playlist.name.toUpperCase()}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, opacity: 0.8, marginLeft: "auto" }}>
          {playlist.tracks.total} faixas
        </span>
      </div>

      {selected && (
        <div style={{
          fontFamily: MONO, fontSize: 10, color: GREEN, background: "rgba(29,185,84,0.12)",
          borderBottom: "1px solid rgba(29,185,84,0.3)", padding: "6px 12px",
        }}>
          faixa selecionada (ilustrativo) — {tracks?.find(t => t.id === selected)?.name}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 8px" }}>
        {err && <div style={{ fontFamily: MONO, fontSize: 10, color: "#ff6a6a", padding: 10 }}>{err}</div>}
        {!tracks && !err && (
          <div style={{ fontFamily: MONO, fontSize: 10, color: "#8a92c8", padding: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={11} className="spin" /> carregando faixas + BPM/tom…
          </div>
        )}
        {tracks && (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: "28px 1fr 64px 52px 44px",
              gap: 8, padding: "4px 8px", fontFamily: MONO, fontSize: 8,
              color: "#6a6a9a", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <span>#</span><span>FAIXA</span><span>BPM</span><span>TOM</span>
              <span style={{ textAlign: "right" }}><Clock size={9} /></span>
            </div>
            {tracks.map((t, i) => (
              <button
                key={t.id + i}
                onClick={() => setSelected(t.id)}
                style={{
                  width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                  display: "grid", gridTemplateColumns: "28px 1fr 64px 52px 44px", gap: 8,
                  alignItems: "center", padding: "6px 8px", borderRadius: 5,
                  background: selected === t.id ? "rgba(29,185,84,0.18)" : "transparent",
                  fontFamily: MONO, color: "#cdd4f0",
                }}
                onMouseEnter={e => { if (selected !== t.id) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (selected !== t.id) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ fontSize: 9, color: "#6a6a9a" }}>{i + 1}</span>
                <span style={{ overflow: "hidden" }}>
                  <span style={{ fontSize: 10, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                  <span style={{ fontSize: 8, color: "#8a92c8", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.artists}</span>
                </span>
                <span style={{ fontSize: 10, color: t.bpm ? "#fff" : "#555" }}>{t.bpm ?? "—"}</span>
                <span style={{ fontSize: 10, color: t.camelot && t.camelot !== "—" ? GREEN : "#555" }}>{t.camelot ?? "—"}</span>
                <span style={{ fontSize: 9, color: "#8a92c8", textAlign: "right" }}>{fmtDur(t.durationMs)}</span>
              </button>
            ))}
          </>
        )}
      </div>
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
    <div style={{ ...chromeFrame, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{ ...titleBar("#1a7f3c"), padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <ListMusic size={14} />
        <span style={{ fontFamily: COND, fontSize: 17, fontWeight: 800, letterSpacing: "0.1em" }}>SUAS PLAYLISTS</span>
        <button onClick={load} style={{ ...glossyBtn("#2f6fbf"), padding: "3px 8px", fontSize: 10, marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <RefreshCw size={10} /> ATUALIZAR
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12 }}>
        {err && <div style={{ fontFamily: MONO, fontSize: 10, color: "#ff6a6a" }}>{err}</div>}
        {!lists && !err && <div style={{ fontFamily: MONO, fontSize: 10, color: "#8a92c8" }}>carregando…</div>}
        {lists && lists.length === 0 && <div style={{ fontFamily: MONO, fontSize: 10, color: "#8a92c8" }}>nenhuma playlist encontrada</div>}
        {lists && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            {lists.map(p => (
              <button
                key={p.id}
                onClick={() => onOpen(p)}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, cursor: "pointer",
                  background: "rgba(255,255,255,0.04)", padding: 8, textAlign: "left",
                  display: "flex", flexDirection: "column", gap: 6,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(29,185,84,0.14)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}>
                <div style={{ aspectRatio: "1", borderRadius: 6, overflow: "hidden", ...well, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p.images?.[0]?.url
                    ? <img src={p.images[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <Music2 size={28} color="#4a4a70" />}
                </div>
                <span style={{ fontFamily: MONO, fontSize: 10, color: "#dfe7ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: "#8a92c8" }}>{p.tracks.total} faixas · {p.owner.display_name}</span>
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
    <div style={{ ...desktopBg, position: "fixed", inset: 0, fontFamily: UI, display: "flex", flexDirection: "column" }}>
      {/* top bar */}
      <div style={{ ...titleBar("#2f6fbf"), height: 34, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onExit} style={{ ...glossyBtn("#2f6fbf"), padding: "3px 10px", fontSize: 10, display: "flex", alignItems: "center", gap: 5 }}>
            <ArrowLeft size={12} /> MIXER
          </button>
          <span style={{ fontFamily: COND, fontSize: 16, fontWeight: 800, letterSpacing: "0.2em" }}>SPOTIFY</span>
        </div>
        {connected && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {me?.images?.[0]?.url && <img src={me.images[0].url} alt="" style={{ width: 22, height: 22, borderRadius: "50%" }} />}
            <span style={{ fontFamily: MONO, fontSize: 10 }}>{me?.display_name ?? "…"}</span>
            <button onClick={disconnect} style={{ ...glossyBtn("#7a3a3a"), padding: "3px 8px", fontSize: 9, display: "flex", alignItems: "center", gap: 4 }}>
              <LogOut size={10} /> SAIR
            </button>
          </div>
        )}
      </div>

      {/* body */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: connected ? "stretch" : "center", justifyContent: "center", padding: 16 }}>
        {authErr && (
          <div style={{ position: "absolute", top: 44, left: "50%", transform: "translateX(-50%)", zIndex: 5,
            fontFamily: MONO, fontSize: 10, color: "#ff8a8a", background: "rgba(40,10,10,0.85)",
            border: "1px solid rgba(255,80,80,0.4)", borderRadius: 6, padding: "6px 12px" }}>
            {authErr}
          </div>
        )}

        {!connected ? (
          needsClientId ? (
            <ClientIdSetup onSaved={() => setNeedsClientId(false)} />
          ) : (
            <div style={{ ...glass("rgba(10,14,28,0.7)"), borderRadius: 14, padding: 28, textAlign: "center", maxWidth: 400 }}>
              <div style={{ fontFamily: COND, fontSize: 24, fontWeight: 800, letterSpacing: "0.08em", color: "#fff", marginBottom: 6 }}>
                CONECTE SUA CONTA
              </div>
              <p style={{ fontFamily: MONO, fontSize: 10, color: "#aab2d8", lineHeight: 1.6, margin: "0 0 18px" }}>
                Faça login para ver suas playlists e escolher faixas. O BPM e o tom
                vêm direto do Spotify.
              </p>
              <button onClick={connect} disabled={busy}
                style={{ ...glossyBtn(GREEN), width: "100%", padding: "11px", fontSize: 12,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.6 : 1 }}>
                <Music2 size={14} /> {busy ? "REDIRECIONANDO…" : "LOGAR COM SPOTIFY"}
              </button>
              <button onClick={() => setNeedsClientId(true)}
                style={{ marginTop: 10, background: "none", border: "none", cursor: "pointer",
                  fontFamily: MONO, fontSize: 9, color: "#6a6a9a", textDecoration: "underline" }}>
                reconfigurar Client ID
              </button>
            </div>
          )
        ) : open ? (
          <TrackList playlist={open} onBack={() => setOpen(null)} />
        ) : (
          <PlaylistGrid onOpen={setOpen} />
        )}
      </div>
    </div>
  );
}
