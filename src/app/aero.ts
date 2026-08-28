// ─── Aero / XP-Vista style kit ────────────────────────────────────────────────
// Neon-on-dark DJ palette kept, wrapped in glossy chrome + glass surfaces.

import type { CSSProperties } from "react";

export const CA   = "#00e5ff"; // deck A neon (cyan)
export const CB   = "#ff6b1a"; // deck B neon (orange)
export const BG   = "#07070f";
export const MONO = "'JetBrains Mono', monospace";
export const COND = "'Barlow Condensed', sans-serif";
export const UI   = "'Segoe UI', 'Barlow Condensed', system-ui, sans-serif";

// Desktop wallpaper — an Aero-ish aurora gradient (no external asset).
export const desktopBg: CSSProperties = {
  background: `
    radial-gradient(1200px 700px at 18% 12%, rgba(0,229,255,0.18), transparent 60%),
    radial-gradient(1000px 800px at 88% 88%, rgba(255,107,26,0.16), transparent 60%),
    radial-gradient(900px 600px at 60% 40%, rgba(80,120,255,0.14), transparent 65%),
    linear-gradient(160deg, #0a1530 0%, #0b1020 45%, #140a1e 100%)`,
};

// Frosted glass panel (Aero).
export function glass(tint = "rgba(20,26,48,0.55)"): CSSProperties {
  return {
    background: `linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 42%, rgba(0,0,0,0.10)), ${tint}`,
    backdropFilter: "blur(18px) saturate(1.4)",
    WebkitBackdropFilter: "blur(18px) saturate(1.4)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.25), 0 10px 30px rgba(0,0,0,0.45)",
  };
}

// Recessed inset well (for sliders / screens).
export const well: CSSProperties = {
  background: "linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.18))",
  border: "1px solid rgba(0,0,0,0.55)",
  boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(255,255,255,0.05)",
  borderRadius: 6,
};

// Glossy pill/rectangular button in a given accent color.
export function glossyBtn(accent: string, active = false): CSSProperties {
  return {
    position: "relative",
    borderRadius: 8,
    cursor: "pointer",
    color: "#fff",
    fontFamily: MONO,
    letterSpacing: "0.08em",
    border: `1px solid ${accent}`,
    background: active
      ? `linear-gradient(180deg, ${accent} 0%, ${accent}cc 46%, ${accent}88 47%, ${accent} 100%)`
      : `linear-gradient(180deg, ${accent}55 0%, ${accent}22 46%, ${accent}11 47%, ${accent}33 100%)`,
    boxShadow: active
      ? `inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -8px 14px ${accent}55, 0 0 18px ${accent}66, 0 2px 6px rgba(0,0,0,0.5)`
      : `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -6px 12px rgba(0,0,0,0.25), 0 2px 5px rgba(0,0,0,0.45)`,
    transition: "background .15s, box-shadow .15s, transform .05s",
  };
}

// The signature XP "glass highlight" — a bright semicircle sheen for round buttons.
export const orbSheen: CSSProperties = {
  position: "absolute",
  left: "12%",
  right: "12%",
  top: "6%",
  height: "42%",
  borderRadius: "50%",
  background: "linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.05))",
  pointerEvents: "none",
};

// Chrome bevel frame (deck headers, mixer body).
export const chromeFrame: CSSProperties = {
  background: "linear-gradient(180deg, #2b3350 0%, #171d30 8%, #10131f 92%, #232a42 100%)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.5), 0 6px 20px rgba(0,0,0,0.5)",
  borderRadius: 10,
};

// Aero title-bar gradient (used by the window chrome + panel captions).
export function titleBar(accent = "#3a7bd5"): CSSProperties {
  return {
    background: `linear-gradient(180deg, rgba(255,255,255,0.35) 0%, ${accent}dd 8%, ${accent}99 48%, ${accent}cc 52%, ${accent}66 100%)`,
    borderBottom: "1px solid rgba(0,0,0,0.35)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.25)",
    color: "#fff",
    textShadow: "0 1px 2px rgba(0,0,0,0.55)",
  };
}
