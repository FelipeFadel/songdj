// ─── Win98 style kit ──────────────────────────────────────────────────────────
// Tokens from the "Unofficial Windows 98 UI Kit" (Figma), at 1× scale.
// Title-bar gradient comes from the Music Player reference; layout from "Camelot DJ v2".

import type { CSSProperties } from "react";

export const CA   = "#001CF5"; // deck A (kit blue 50)
export const CB   = "#EB3323"; // deck B (kit red 100)
export const FACE = "#C3C3C3";
export const DESK = "#008080";
export const DIM  = "#7E7E7E";
export const FONT = "W95FA, 'MS Sans Serif', Tahoma, sans-serif";

const OUT     = "inset -1px -1px #262626, inset 1px 1px #F0F0F0, inset -2px -2px #7E7E7E";
const IN      = "inset -1px -1px #F0F0F0, inset 1px 1px #262626, inset -2px -2px #B1B1B1, inset 2px 2px #7E7E7E";

// Raised: buttons, panels.
export const raised: CSSProperties = { background: FACE, boxShadow: OUT };
// Window frame: raised + inner light edge.
export const windowFrame: CSSProperties = {
  background: FACE, padding: 3,
  boxShadow: "inset -1px -1px #262626, inset 1px 1px #B1B1B1, inset -2px -2px #7E7E7E, inset 2px 2px #F0F0F0",
};
// Sunken grey area (pressed button, status panels).
export const sunken: CSSProperties = { background: FACE, boxShadow: IN };
// Shallow sunken (status-bar cells).
export const status: CSSProperties = { boxShadow: "inset -1px -1px #F0F0F0, inset 1px 1px #7E7E7E", padding: "1px 6px" };
// White text field / list / display.
export const field: CSSProperties = {
  background: "#fff", padding: 2,
  boxShadow: "inset 1px 1px #7E7E7E, inset -1px -1px #F0F0F0, inset 2px 2px #262626, inset -2px -2px #B1B1B1",
};

export function btn(active = false): CSSProperties {
  return {
    ...(active ? sunken : raised),
    border: "none", borderRadius: 0, color: "#000",
    fontFamily: FONT, fontSize: 12, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    padding: active ? "1px 5px 0 7px" : "0 6px",
  };
}

export function titleBar(active = true): CSSProperties {
  return {
    background: active ? "linear-gradient(90deg, #000080, #1084D0)" : DIM,
    color: active ? "#fff" : FACE, height: 18, flexShrink: 0,
    display: "flex", alignItems: "center", gap: 3, padding: "0 2px 0 3px",
    fontFamily: FONT, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden",
  };
}

// Small square title-bar button (min / max / close).
export const capBtn: CSSProperties = { ...btn(), width: 16, height: 14, padding: 0 };
