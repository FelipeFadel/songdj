// ─── Win98 pixel icons ────────────────────────────────────────────────────────
// Each icon is a pixel path on a tiny grid. `s` is an integer scale so edges stay crisp.

function px(w: number, h: number, d: string) {
  return ({ s = 1 }: { s?: number }) => (
    <svg width={w * s} height={h * s} viewBox={`0 0 ${w} ${h}`} fill="currentColor"
      shapeRendering="crispEdges" aria-hidden style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

export const PlayIcon  = px(7, 9, "M1 0h1v9H1zM2 1h1v7H2zM3 2h1v5H3zM4 3h1v3H4zM5 4h1v1H5z");
export const PauseIcon = px(8, 9, "M1 1h2v7H1zM5 1h2v7H5z");
export const PrevIcon  = px(10, 9, "M0 4h1v1H0zM1 3h1v3H1zM2 2h1v5H2zM3 1h1v7H3zM4 0h1v9H4zM5 4h1v1H5zM6 3h1v3H6zM7 2h1v5H7zM8 1h1v7H8zM9 0h1v9H9z");
export const NextIcon  = px(10, 9, "M0 0h1v9H0zM1 1h1v7H1zM2 2h1v5H2zM3 3h1v3H3zM4 4h1v1H4zM5 0h1v9H5zM6 1h1v7H6zM7 2h1v5H7zM8 3h1v3H8zM9 4h1v1H9z");
export const NoteIcon  = px(8, 9, "M3 0h5v2H3zM3 2h1v5H3zM7 2h1v4H7zM1 6h3v2H1zM5 5h3v2H5z");
export const UploadIcon = px(5, 5, "M2 0h1v3H2zM1 1h3v1H1zM0 4h5v1H0z");
export const CaretIcon = px(7, 4, "M0 0h7v1H0zM1 1h5v1H1zM2 2h3v1H2zM3 3h1v1H3z");
export const UpIcon    = px(5, 3, "M2 0h1v1H2zM1 1h3v1H1zM0 2h5v1H0z");
export const DownIcon  = px(5, 3, "M0 0h5v1H0zM1 1h3v1H1zM2 2h1v1H2z");

// title-bar buttons
export const MinIcon   = px(6, 2, "M0 0h6v2H0z");
export const MaxIcon   = px(9, 8, "M0 0h9v2H0zM0 2h1v6H0zM8 2h1v6H8zM0 7h9v1H0z");
export const CloseIcon = px(8, 7, "M0 0h2v1H0zM6 0h2v1H6zM1 1h2v1H1zM5 1h2v1H5zM2 2h4v1H2zM3 3h2v1H3zM2 4h4v1H2zM1 5h2v1H1zM5 5h2v1H5zM0 6h2v1H0zM6 6h2v1H6z");

// 16×16 desktop icons: [body, detail, outline(black), bodyColor, detailColor]
const DESK = {
  pc:    ["M3 2h10v8H3zM3 13h10v2H3z", "M4 3h8v6H4z", "M2 1h12v1H2zM2 1h1v10H2zM13 1h1v10h-1zM2 10h12v1H2zM6 11h4v2H6zM2 12h12v1H2zM2 15h12v1H2zM2 12h1v4H2zM13 12h1v4h-1z", "#C3C3C3", "#1084D0"],
  trash: ["M4 4h8v10H4z", "M6 5h1v8H6zM9 5h1v8H9z", "M3 3h10v1H3zM6 1h4v1H6zM6 1h1v2H6zM9 1h1v2H9zM4 4h1v10H4zM11 4h1v10h-1zM4 14h8v1H4z", "#FFFFFF", "#7E7E7E"],
  dj:    ["M1 1h14v14H1z", "M6 3h7v2H6zM6 5h1v6H6zM12 5h1v5h-1zM3 10h4v3H3zM9 9h4v3H9z", "M0 0h16v1H0zM0 15h16v1H0zM0 0h1v16H0zM15 0h1v16h-1z", "#001CF5", "#FFFFFF"],
  milk:  ["M1 2h14v10H1z", "M2 8h2v1H2zM4 6h2v2H4zM6 4h2v2H6zM8 6h2v2H8zM10 8h2v2h-2zM12 6h2v2h-2z", "M0 1h16v1H0zM0 12h16v1H0zM0 1h1v12H0zM15 1h1v12h-1zM6 13h4v1H6zM4 14h8v1H4z", "#000080", "#FF00FF"],
  cd:    ["M5 1h6v1H5zM3 2h10v2H3zM2 4h12v8H2zM3 12h10v2H3zM5 14h6v1H5z", "M4 4h3v2H4z", "M7 7h2v2H7z", "#B1B1B1", "#F0F0F0"],
} as const;
export type DeskKind = keyof typeof DESK;

export function DeskIcon({ kind, s = 2 }: { kind: DeskKind; s?: number }) {
  const [p1, p2, p3, c1, c2] = DESK[kind];
  return (
    <svg width={16 * s} height={16 * s} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden style={{ flexShrink: 0 }}>
      <path d={p1} fill={c1} /><path d={p2} fill={c2} /><path d={p3} fill="#000" />
    </svg>
  );
}
