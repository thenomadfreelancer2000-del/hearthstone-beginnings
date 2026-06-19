import React from "react";

// ──────────────────────────────────────────────────────────────
// Isometric building primitives + per-kind visual config.
//
// All shapes are drawn in the SAME local space the MapView uses
// after applying the iso counter-transform: local (0,0) is the
// SOUTH corner of the iso ground rhombus for the building's
// (gridW, gridH) footprint. X grows screen-right, Y grows
// screen-down. The iso ground diamond corners are derived from
// `gridW`, `gridH`, `tile` and walls/roofs rise upward (negative Y).
//
// Light convention: NW is brightest, SE is darkest.
//   • Top (roof)          → lit
//   • Left (SW) wall face → mid-lit
//   • Right (SE) wall face→ shaded
// ──────────────────────────────────────────────────────────────

type P = [number, number];

const INK = "#1a1208";
const INK_SOFT = "#2f2114";
const SHADOW = "rgba(0,0,0,0.32)";
const HILITE = "rgba(255,235,190,0.10)";

const poly = (...pts: P[]) => pts.map((p) => `${p[0]},${p[1]}`).join(" ");
const lift = (p: P, by: number): P => [p[0], p[1] - by];
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

interface IsoCorners { S: P; E: P; N: P; W: P; C: P; }

function isoCorners(gridW: number, gridH: number, T: number, inset = 0): IsoCorners {
  const S: P = [0, 0];
  const E: P = [gridH * T, -gridH * T / 2];
  const N: P = [(gridH - gridW) * T, -(gridW + gridH) * T / 2];
  const W: P = [-gridW * T, -gridW * T / 2];
  const C: P = [(S[0] + E[0] + N[0] + W[0]) / 4, (S[1] + E[1] + N[1] + W[1]) / 4];
  if (inset > 0) {
    const k = 1 - inset;
    const shrink = (p: P): P => [C[0] + (p[0] - C[0]) * k, C[1] + (p[1] - C[1]) * k];
    return { S: shrink(S), E: shrink(E), N: shrink(N), W: shrink(W), C };
  }
  return { S, E, N, W, C };
}

// ──────────────────────────────────────────────────────────────
// Roof styles
// ──────────────────────────────────────────────────────────────

type RoofStyle =
  | { type: "flat"; color: string; trim?: string }
  | { type: "peaked"; color: string; shade: string; pitch?: number }
  | { type: "gable"; color: string; shade: string; ridge: "ne" | "nw"; pitch?: number; gable?: string }
  | { type: "canvas"; color: string; shade: string; stripe?: string }
  | { type: "glass"; frame: string; pane?: string }
  | { type: "hip"; color: string; shade: string; pitch?: number };

function Roof({ corners, wallH, style, T }: {
  corners: IsoCorners; wallH: number; style: RoofStyle; T: number;
}) {
  const { S, E, N, W } = corners;
  const Su = lift(S, wallH);
  const Eu = lift(E, wallH);
  const Nu = lift(N, wallH);
  const Wu = lift(W, wallH);
  const center: P = [(Su[0] + Eu[0] + Nu[0] + Wu[0]) / 4, (Su[1] + Eu[1] + Nu[1] + Wu[1]) / 4];

  if (style.type === "flat") {
    return (
      <g>
        {/* slim cornice — slightly outset, gives the eave shadow */}
        <polygon points={poly(Nu, Eu, Su, Wu)}
          fill={style.color} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
        {style.trim && (
          <polygon points={poly(lift(Nu, -0.6), lift(Eu, -0.6), lift(Su, -0.6), lift(Wu, -0.6))}
            fill="none" stroke={style.trim} strokeWidth={0.7} opacity={0.7} strokeLinejoin="round" />
        )}
        <polygon points={poly(Nu, mid(Nu, Eu), center, mid(Nu, Wu))}
          fill={HILITE} opacity={0.7} />
      </g>
    );
  }

  if (style.type === "peaked" || style.type === "hip") {
    const pitch = style.pitch ?? 0.55;
    const apex: P = [center[0], center[1] - wallH * pitch];
    // 4 triangular slopes. NW + NE are lit, SW + SE are shaded.
    return (
      <g>
        {/* SE slope (shaded) */}
        <polygon points={poly(Eu, Su, apex)}
          fill={style.shade} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
        {/* SW slope (mid) */}
        <polygon points={poly(Su, Wu, apex)}
          fill={style.color} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />

        {/* NW slope (lit) */}
        <polygon points={poly(Wu, Nu, apex)}
          fill={style.color} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
        {/* NE slope (lit-mid) */}
        <polygon points={poly(Nu, Eu, apex)}
          fill={style.color} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" opacity={0.96} />
        {/* shingle hint lines on SW slope */}
        {[0.3, 0.55, 0.8].map((t, i) => (
          <line key={i}
            x1={lerp(Su, apex, t)[0]} y1={lerp(Su, apex, t)[1]}
            x2={lerp(Wu, apex, t)[0]} y2={lerp(Wu, apex, t)[1]}
            stroke={INK_SOFT} strokeWidth={0.35} opacity={0.5} />
        ))}
      </g>
    );
  }

  if (style.type === "gable") {
    // Ridge runs along one diagonal of the top diamond.
    // ridge "ne" = ridge from Nu to Eu (NE-SW gable). Two long slopes (NW+SE)
    //              and two short gable triangles (NE+SW).
    const pitch = style.pitch ?? 0.6;
    const apexHeight = wallH * pitch;
    const gableFill = style.gable ?? style.shade;
    if (style.ridge === "ne") {
      const ridgeA: P = lift(Nu, apexHeight);
      const ridgeB: P = lift(Eu, apexHeight);
      return (
        <g>
          {/* NW slope (lit) */}
          <polygon points={poly(Nu, Wu, ridgeA)}
            fill={style.color} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
          <polygon points={poly(Wu, ridgeB, ridgeA)}
            fill={style.color} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
          {/* SE slope (shaded) */}
          <polygon points={poly(Eu, Nu, ridgeA, ridgeB)}
            fill={style.shade} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
          <polygon points={poly(Su, Eu, ridgeB)}
            fill={style.shade} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
          {/* Gable triangles (end walls) */}
          <polygon points={poly(Wu, Su, ridgeB, ridgeA)}
            fill={gableFill} stroke={INK} strokeWidth={0.8} opacity={0.85} />
          {/* Ridge line */}
          <line x1={ridgeA[0]} y1={ridgeA[1]} x2={ridgeB[0]} y2={ridgeB[1]}
            stroke={INK} strokeWidth={1} />
        </g>
      );
    }
    // ridge "nw" = ridge from Nu to Wu
    const ridgeA: P = lift(Nu, apexHeight);
    const ridgeB: P = lift(Wu, apexHeight);
    return (
      <g>
        {/* NE slope (lit) */}
        <polygon points={poly(Nu, Eu, ridgeA)}
          fill={style.color} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
        <polygon points={poly(Eu, ridgeB, ridgeA)}
          fill={style.color} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" opacity={0.92} />
        {/* SW slope (shaded) */}
        <polygon points={poly(Wu, Nu, ridgeA, ridgeB)}
          fill={style.shade} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
        <polygon points={poly(Su, Wu, ridgeB)}
          fill={style.shade} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
        {/* Gable triangle */}
        <polygon points={poly(Eu, Su, ridgeB, ridgeA)}
          fill={gableFill} stroke={INK} strokeWidth={0.8} opacity={0.85} />
        <line x1={ridgeA[0]} y1={ridgeA[1]} x2={ridgeB[0]} y2={ridgeB[1]}
          stroke={INK} strokeWidth={1} />
      </g>
    );
  }

  if (style.type === "canvas") {
    // Curved canvas drape across the long axis.
    const pitch = 0.7;
    const apex: P = [center[0], center[1] - wallH * pitch];
    return (
      <g>
        {/* shaded back drape */}
        <path
          d={`M${Eu[0]},${Eu[1]} Q${apex[0]},${apex[1] - 1.5} ${Wu[0]},${Wu[1]} L${Nu[0]},${Nu[1]} Z`}
          fill={style.color} stroke={INK} strokeWidth={0.9} />
        {/* lit front drape */}
        <path
          d={`M${Wu[0]},${Wu[1]} Q${apex[0]},${apex[1] - 1.5} ${Eu[0]},${Eu[1]} L${Su[0]},${Su[1]} Z`}
          fill={style.shade} stroke={INK} strokeWidth={0.9} />
        {/* center seam */}
        <line x1={apex[0]} y1={apex[1] - 1.5} x2={Su[0]} y2={Su[1]} stroke={INK_SOFT} strokeWidth={0.6} opacity={0.7} />
        {style.stripe && (
          <line x1={apex[0]} y1={apex[1] - 1.5} x2={Nu[0]} y2={Nu[1]}
            stroke={style.stripe} strokeWidth={0.8} opacity={0.85} />
        )}
      </g>
    );
  }

  if (style.type === "glass") {
    // Glass roof: pale translucent diamond + frame lattice.
    const pitch = 0.35;
    const apex: P = [center[0], center[1] - wallH * pitch];
    return (
      <g>
        <polygon points={poly(Nu, Eu, Su, Wu)}
          fill={style.pane ?? "#9bc5d4"} stroke={style.frame} strokeWidth={0.8} opacity={0.85} strokeLinejoin="round" />
        {/* frame lattice: ridge + cross */}
        <line x1={Wu[0]} y1={Wu[1]} x2={Eu[0]} y2={Eu[1]} stroke={style.frame} strokeWidth={0.7} />
        <line x1={Nu[0]} y1={Nu[1]} x2={Su[0]} y2={Su[1]} stroke={style.frame} strokeWidth={0.7} />
        {/* pane highlights */}
        <polygon points={poly(Nu, mid(Nu, Eu), center, mid(Nu, Wu))}
          fill="rgba(255,255,255,0.35)" />
        <polygon points={poly(mid(Wu, Su), Su, mid(Su, Eu), center)}
          fill="rgba(255,255,255,0.10)" />
        {/* slight ridge crest */}
        <line x1={apex[0]} y1={apex[1]} x2={apex[0]} y2={apex[1] + 0.01} stroke="none" />
      </g>
    );
  }

  return null;
}

// ──────────────────────────────────────────────────────────────
// Walls (always rectangular blocks of constant pixel height)
// Door + windows are placed on the SW (left) face which is more
// front-facing and slightly more lit.
// ──────────────────────────────────────────────────────────────

interface WallProps {
  corners: IsoCorners;
  wallH: number;
  lit: string;     // SW face fill
  shade: string;   // SE face fill
  T: number;
  door?: "wood" | "double" | "barn" | "arch" | "open" | "none";
  doorColor?: string;
  windows?: number;
  windowColor?: string;
  trim?: string;        // horizontal trim line color (log seam etc.)
  trimRows?: number;    // number of seam lines per face
  banner?: { color: string; symbol?: "+" | "books" | "wheat" | "leaf" };
  chimney?: boolean;
  /** Suppress the dark ground ellipse under the building. */
  noShadow?: boolean;
  /** Render a porch slab + posts + lintel in front of the SW door. */
  porch?: "none" | "stoop" | "covered" | "grand";
  porchColor?: string;
}

function Walls({
  corners, wallH, lit, shade, door = "wood", doorColor = "#3d2810",
  windows = 1, windowColor = "#dec97a", trim, trimRows = 0, banner,
  noShadow = false, porch = "stoop", porchColor = "#6a4724",
}: WallProps) {

  const { S, E, N, W } = corners;
  const Su = lift(S, wallH);
  const Eu = lift(E, wallH);
  const Nu = lift(N, wallH);
  const Wu = lift(W, wallH);

  // Helper: place a child element along a wall face, given t in [0..1]
  // along the bottom edge and a fractional height h_t in [0..1] up the wall.
  // Returns the polygon points for a rectangular feature.
  const featureOnSWFace = (t0: number, t1: number, hBot: number, hTop: number) => {
    // SW face = quad (S, W, Wu, Su) — but in iso the bottom edge runs S→W
    const A = lerp(S, W, t0);
    const B = lerp(S, W, t1);
    const At = lift(A, wallH * hBot);
    const Bt = lift(B, wallH * hBot);
    const Au = lift(A, wallH * hTop);
    const Bu = lift(B, wallH * hTop);
    return poly(At, Bt, Bu, Au);
  };
  const featureOnSEFace = (t0: number, t1: number, hBot: number, hTop: number) => {
    const A = lerp(S, E, t0);
    const B = lerp(S, E, t1);
    const At = lift(A, wallH * hBot);
    const Bt = lift(B, wallH * hBot);
    const Au = lift(A, wallH * hTop);
    const Bu = lift(B, wallH * hTop);
    return poly(At, Bt, Bu, Au);
  };

  return (
    <g>
      {/* ground shadow */}
      {!noShadow && (
        <ellipse cx={(W[0] + E[0]) / 2} cy={S[1] + 1.5}
          rx={Math.abs(E[0] - W[0]) / 2 * 0.92} ry={Math.max(2.4, wallH * 0.08)}
          fill={SHADOW} />
      )}


      {/* SE face (shaded / right wall) */}
      <polygon points={poly(S, E, Eu, Su)}
        fill={shade} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
      {/* SW face (lit / front-left wall) */}
      <polygon points={poly(S, W, Wu, Su)}
        fill={lit} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />

      {/* trim lines (log seams / siding bands) */}
      {trim && trimRows > 0 && Array.from({ length: trimRows }).map((_, i) => {
        const h = (i + 1) / (trimRows + 1);
        const sw_A = lift(S, wallH * h);
        const sw_B = lift(W, wallH * h);
        const se_A = lift(S, wallH * h);
        const se_B = lift(E, wallH * h);
        return (
          <g key={`tr${i}`}>
            <line x1={sw_A[0]} y1={sw_A[1]} x2={sw_B[0]} y2={sw_B[1]}
              stroke={trim} strokeWidth={0.4} opacity={0.65} />
            <line x1={se_A[0]} y1={se_A[1]} x2={se_B[0]} y2={se_B[1]}
              stroke={trim} strokeWidth={0.4} opacity={0.5} />
          </g>
        );
      })}

      {/* Windows on SE face (small, evenly spaced) */}
      {windows > 0 && Array.from({ length: windows }).map((_, i) => {
        const slot = (i + 1) / (windows + 1);
        const halfW = 0.10 / Math.max(1, windows);
        return (
          <polygon key={`wse${i}`}
            points={featureOnSEFace(slot - halfW, slot + halfW, 0.45, 0.78)}
            fill={windowColor} stroke={INK} strokeWidth={0.5} />
        );
      })}

      {/* Windows on SW face flanking the door */}
      {windows > 0 && (
        <>
          <polygon points={featureOnSWFace(0.15, 0.30, 0.45, 0.78)}
            fill={windowColor} stroke={INK} strokeWidth={0.5} />
          {windows > 1 && (
            <polygon points={featureOnSWFace(0.70, 0.85, 0.45, 0.78)}
              fill={windowColor} stroke={INK} strokeWidth={0.5} />
          )}
        </>
      )}

      {/* Porch / stoop projecting from the SW face under the door
          — acts as the universal entrance marker so players can spot the
          door from any iso angle. */}
      {door !== "none" && porch !== "none" && (() => {
        const A = lerp(S, W, 0.36);          // left edge of porch on SW face
        const B = lerp(S, W, 0.64);          // right edge
        const depth = porch === "grand" ? 4.5 : porch === "covered" ? 3.5 : 2.6;
        // Project outward from SW face (perpendicular to S→W, away from C)
        const outX = (A[0] - corners.C[0]); const outY = (A[1] - corners.C[1]);
        const outLen = Math.hypot(outX, outY) || 1;
        const ox = (outX / outLen) * depth;
        const oy = (outY / outLen) * depth * 0.6 + 1.4;
        const A2: P = [A[0] + ox, A[1] + oy];
        const B2: P = [B[0] + ox, B[1] + oy];
        const slabFill = porchColor;
        const slabShade = "#3a2410";
        return (
          <g>
            {/* slab top */}
            <polygon points={poly(A, B, B2, A2)}
              fill={slabFill} stroke={INK} strokeWidth={0.6} strokeLinejoin="round" />
            {/* slab front edge (thickness) */}
            <polygon points={poly(A2, B2, [B2[0], B2[1] + 1.6] as P, [A2[0], A2[1] + 1.6] as P)}
              fill={slabShade} stroke={INK} strokeWidth={0.5} />
            {/* step plank line */}
            <line x1={(A[0] + A2[0]) / 2} y1={(A[1] + A2[1]) / 2}
              x2={(B[0] + B2[0]) / 2} y2={(B[1] + B2[1]) / 2}
              stroke={INK_SOFT} strokeWidth={0.4} opacity={0.6} />
            {porch !== "stoop" && (
              <>
                {/* porch posts */}
                <rect x={A2[0] - 0.5} y={A2[1] - wallH * 0.85} width={1} height={wallH * 0.85}
                  fill={slabShade} stroke={INK} strokeWidth={0.4} />
                <rect x={B2[0] - 0.5} y={B2[1] - wallH * 0.85} width={1} height={wallH * 0.85}
                  fill={slabShade} stroke={INK} strokeWidth={0.4} />
                {/* porch awning */}
                <polygon points={poly(
                  [A2[0] - 0.8, A2[1] - wallH * 0.85] as P,
                  [B2[0] + 0.8, B2[1] - wallH * 0.85] as P,
                  lift(B, wallH * 0.85),
                  lift(A, wallH * 0.85),
                )} fill="#4a2f18" stroke={INK} strokeWidth={0.6} />
              </>
            )}
          </g>
        );
      })()}

      {/* Door on SW face (front) */}
      {door !== "none" && (() => {
        const dWidth = door === "double" || door === "barn" ? 0.20 : 0.12;
        const dt0 = 0.5 - dWidth / 2;
        const dt1 = 0.5 + dWidth / 2;
        const top = door === "arch" ? 0.78 : door === "barn" ? 0.82 : 0.72;
        return (
          <>
            {/* bright doorframe so the entrance reads at any zoom */}
            <polygon points={featureOnSWFace(dt0 - 0.025, dt1 + 0.025, 0, top + 0.04)}
              fill="none" stroke="#f4d27a" strokeWidth={1.1} strokeLinejoin="round" opacity={0.95} />
            <polygon points={featureOnSWFace(dt0, dt1, 0, top)}
              fill={doorColor} stroke={INK} strokeWidth={0.7} />
            {door === "arch" && (
              <polygon points={featureOnSWFace(dt0, dt1, top - 0.06, top + 0.04)}
                fill="#2a1808" stroke={INK} strokeWidth={0.5} />
            )}
            {door === "double" && (
              <line
                x1={lerp(lerp(S, W, 0.5), lift(lerp(S, W, 0.5), wallH * top), 0.0)[0]}
                y1={lerp(lerp(S, W, 0.5), lift(lerp(S, W, 0.5), wallH * top), 0.0)[1]}
                x2={lerp(lerp(S, W, 0.5), lift(lerp(S, W, 0.5), wallH * top), 1.0)[0]}
                y2={lerp(lerp(S, W, 0.5), lift(lerp(S, W, 0.5), wallH * top), 1.0)[1]}
                stroke={INK} strokeWidth={0.5}
              />
            )}
            {door === "barn" && (
              <>
                <line
                  x1={lerp(S, W, dt0)[0]}
                  y1={lerp(S, W, dt0)[1] - wallH * top * 0.5}
                  x2={lerp(S, W, dt1)[0]}
                  y2={lerp(S, W, dt1)[1] - wallH * top * 0.5}
                  stroke={INK_SOFT} strokeWidth={0.5}
                />
              </>
            )}
            {/* door knob — small warm dot, reinforces "this is the entrance" */}
            <circle
              cx={lerp(lerp(S, W, dt0 + (dt1 - dt0) * 0.78), lift(lerp(S, W, dt0 + (dt1 - dt0) * 0.78), wallH * top * 0.45), 1)[0]}
              cy={lerp(lerp(S, W, dt0 + (dt1 - dt0) * 0.78), lift(lerp(S, W, dt0 + (dt1 - dt0) * 0.78), wallH * top * 0.45), 1)[1]}
              r={0.55} fill="#f4d27a" stroke={INK} strokeWidth={0.3} />
          </>
        );
      })()}


      {/* Hanging banner / sign above the door */}
      {banner && (() => {
        const A = lerp(S, W, 0.40);
        const B = lerp(S, W, 0.60);
        const At = lift(A, wallH * 0.86);
        const Bt = lift(B, wallH * 0.86);
        const Au = lift(A, wallH * 0.98);
        const Bu = lift(B, wallH * 0.98);
        const midTop: P = [(At[0] + Bt[0]) / 2, (At[1] + Bt[1]) / 2 - 1];
        return (
          <g>
            <polygon points={poly(At, Bt, Bu, Au)}
              fill={banner.color} stroke={INK} strokeWidth={0.5} />
            {banner.symbol === "+" && (
              <>
                <rect x={midTop[0] - 0.4} y={midTop[1] - 1.6} width={0.8} height={3.2} fill="#fff" />
                <rect x={midTop[0] - 1.6} y={midTop[1] - 0.4} width={3.2} height={0.8} fill="#fff" />
              </>
            )}
            {banner.symbol === "books" && (
              <rect x={midTop[0] - 1.2} y={midTop[1] - 0.8} width={2.4} height={1.6} fill="#f1e4b7" stroke={INK} strokeWidth={0.3} />
            )}
            {banner.symbol === "wheat" && (
              <g stroke="#f1c64a" strokeWidth={0.5}>
                <line x1={midTop[0]} y1={midTop[1] - 1.5} x2={midTop[0]} y2={midTop[1] + 1.3} />
                <line x1={midTop[0] - 0.8} y1={midTop[1] - 0.4} x2={midTop[0] + 0.8} y2={midTop[1] - 0.8} />
              </g>
            )}
            {banner.symbol === "leaf" && (
              <ellipse cx={midTop[0]} cy={midTop[1]} rx={1} ry={1.6} fill="#9bc060" stroke={INK} strokeWidth={0.3} />
            )}
          </g>
        );
      })()}
    </g>
  );
}

// ──────────────────────────────────────────────────────────────
// Chimney prop — placed on the roof, lit-side
// ──────────────────────────────────────────────────────────────

function Chimney({ corners, wallH, color = "#6a594a", apex }: {
  corners: IsoCorners; wallH: number; color?: string; apex?: number;
}) {
  const { N, E, W } = corners;
  const Nu = lift(N, wallH);
  const Eu = lift(E, wallH);
  const Wu = lift(W, wallH);
  const baseCenter: P = [
    (Nu[0] + Eu[0] + Wu[0]) / 3 + (Eu[0] - Nu[0]) * 0.15,
    (Nu[1] + Eu[1] + Wu[1]) / 3 - (apex ?? wallH * 0.3),
  ];
  const cw = 2.2, ch = 5;
  return (
    <g>
      <rect x={baseCenter[0] - cw / 2} y={baseCenter[1] - ch} width={cw} height={ch}
        fill={color} stroke={INK} strokeWidth={0.6} />
      <rect x={baseCenter[0] - cw / 2 - 0.3} y={baseCenter[1] - ch - 0.6}
        width={cw + 0.6} height={0.9} fill={INK_SOFT} />
      <circle cx={baseCenter[0]} cy={baseCenter[1] - ch - 1.5} r={1.1}
        fill="rgba(220,220,220,0.6)" />
    </g>
  );
}

// ──────────────────────────────────────────────────────────────
// Ground rhombus — used for plots that have no walls
// (farm plot, field, pasture, reservoir, ground for stockpile).
// ──────────────────────────────────────────────────────────────

function GroundRhombus({ corners, fill, stroke = INK }: {
  corners: IsoCorners; fill: string; stroke?: string;
}) {
  const { S, E, N, W } = corners;
  return <polygon points={poly(N, E, S, W)} fill={fill} stroke={stroke} strokeWidth={0.8} strokeLinejoin="round" />;
}

// ──────────────────────────────────────────────────────────────
// Standard IsoBlock = walls + roof + optional chimney
// ──────────────────────────────────────────────────────────────

interface BlockProps {
  gridW: number; gridH: number; T: number; inset?: number;
  walls: { lit: string; shade: string };
  roof: RoofStyle;
  story: number;
  door?: WallProps["door"];
  doorColor?: string;
  windows?: number;
  windowColor?: string;
  trim?: string;
  trimRows?: number;
  banner?: WallProps["banner"];
  chimney?: boolean;
  chimneyColor?: string;
  noShadow?: boolean;
  porch?: WallProps["porch"];
  porchColor?: string;
}

function IsoBlock(props: BlockProps) {
  const c = isoCorners(props.gridW, props.gridH, props.T, props.inset ?? 0.05);
  const wallH = props.story * props.T;
  return (
    <g>
      <Walls
        corners={c} wallH={wallH}
        lit={props.walls.lit} shade={props.walls.shade}
        T={props.T}
        door={props.door} doorColor={props.doorColor}
        windows={props.windows} windowColor={props.windowColor}
        trim={props.trim} trimRows={props.trimRows ?? 0}
        banner={props.banner}
        noShadow={props.noShadow}
        porch={props.porch}
        porchColor={props.porchColor}
      />

      <Roof corners={c} wallH={wallH} style={props.roof} T={props.T} />
      {props.chimney && <Chimney corners={c} wallH={wallH} color={props.chimneyColor} />}
    </g>
  );
}

// ──────────────────────────────────────────────────────────────
// Special primitives
// ──────────────────────────────────────────────────────────────

function IsoCampfire({ gridW, gridH, T }: { gridW: number; gridH: number; T: number }) {
  const c = isoCorners(gridW, gridH, T, 0.25);
  const center: P = [c.C[0], c.C[1]];
  const r = Math.min(Math.abs(c.E[0] - c.W[0]), Math.abs(c.N[1] - c.S[1])) * 0.35;
  return (
    <g>
      <ellipse cx={center[0]} cy={center[1] + 1.5} rx={r * 1.2} ry={r * 0.45} fill={SHADOW} />
      <ellipse cx={center[0]} cy={center[1]} rx={r} ry={r * 0.45} fill="#5e564c" stroke={INK} strokeWidth={0.9} />
      <ellipse cx={center[0]} cy={center[1] - 0.3} rx={r * 0.72} ry={r * 0.32} fill="#2a1d10" />
      <line x1={center[0] - r * 0.7} y1={center[1] - 0.2} x2={center[0] + r * 0.7} y2={center[1] - 0.6}
        stroke="#3d2810" strokeWidth={1.8} strokeLinecap="round" />
      <line x1={center[0] - r * 0.6} y1={center[1] - 0.6} x2={center[0] + r * 0.65} y2={center[1] - 0.1}
        stroke="#5a3820" strokeWidth={1.8} strokeLinecap="round" />
      <path d={`M${center[0]} ${center[1] - 1.2} q-${r * 0.45} -${r * 0.6} 0 -${r * 1.1}
        q${r * 0.45} ${r * 0.5} 0 ${r * 1.1} z`}
        fill="#f08a2a" stroke={INK} strokeWidth={0.7} />
      <path d={`M${center[0]} ${center[1] - 1.6} q-${r * 0.2} -${r * 0.3} 0 -${r * 0.6}
        q${r * 0.2} ${r * 0.25} 0 ${r * 0.6} z`}
        fill="#f7e36a" />
    </g>
  );
}

function IsoWell({ gridW, gridH, T, deep = false }: {
  gridW: number; gridH: number; T: number; deep?: boolean;
}) {
  const c = isoCorners(gridW, gridH, T, 0.18);
  const wallH = T * (deep ? 1.0 : 0.55);
  const { S, E, N, W } = c;
  const Su = lift(S, wallH), Eu = lift(E, wallH), Nu = lift(N, wallH), Wu = lift(W, wallH);
  const center: P = [(Su[0] + Eu[0] + Nu[0] + Wu[0]) / 4, (Su[1] + Eu[1] + Nu[1] + Wu[1]) / 4];
  return (
    <g>
      <ellipse cx={c.C[0]} cy={S[1] + 1.5} rx={Math.abs(E[0] - W[0]) / 2 * 0.9} ry={3} fill={SHADOW} />
      <polygon points={poly(S, E, Eu, Su)} fill="#6a615a" stroke={INK} strokeWidth={0.9} />
      <polygon points={poly(S, W, Wu, Su)} fill="#80766b" stroke={INK} strokeWidth={0.9} />
      {/* mortar */}
      {[0.33, 0.66].map((h, i) => (
        <g key={i}>
          <line x1={lift(S, wallH * h)[0]} y1={lift(S, wallH * h)[1]}
            x2={lift(W, wallH * h)[0]} y2={lift(W, wallH * h)[1]} stroke={INK_SOFT} strokeWidth={0.4} opacity={0.6} />
          <line x1={lift(S, wallH * h)[0]} y1={lift(S, wallH * h)[1]}
            x2={lift(E, wallH * h)[0]} y2={lift(E, wallH * h)[1]} stroke={INK_SOFT} strokeWidth={0.4} opacity={0.5} />
        </g>
      ))}
      {/* rim */}
      <polygon points={poly(Nu, Eu, Su, Wu)} fill="#5a514a" stroke={INK} strokeWidth={0.9} />
      {/* water opening */}
      <polygon
        points={poly(
          lerp(center, Nu, 0.55), lerp(center, Eu, 0.55),
          lerp(center, Su, 0.55), lerp(center, Wu, 0.55),
        )}
        fill="#1d3548" stroke={INK} strokeWidth={0.5} />
      {/* arch posts */}
      <rect x={Wu[0] + 0.6} y={Wu[1] - T * 0.9} width={1.4} height={T * 0.9} fill="#3d2810" stroke={INK} strokeWidth={0.4} />
      <rect x={Eu[0] - 2.0} y={Eu[1] - T * 0.9} width={1.4} height={T * 0.9} fill="#3d2810" stroke={INK} strokeWidth={0.4} />
      <line x1={Wu[0] + 1.3} y1={Wu[1] - T * 0.9} x2={Eu[0] - 1.3} y2={Eu[1] - T * 0.9}
        stroke="#3d2810" strokeWidth={1.3} strokeLinecap="round" />
      {/* tiny roof */}
      <polygon points={poly(
        [Wu[0] + 0.4, Wu[1] - T * 0.9 - 0.4] as P,
        [(Wu[0] + Eu[0]) / 2, Wu[1] - T * 1.25] as P,
        [Eu[0] - 0.4, Eu[1] - T * 0.9 - 0.4] as P,
      )} fill="#4a2f18" stroke={INK} strokeWidth={0.7} />
      {/* bucket on rope */}
      <line x1={center[0]} y1={Wu[1] - T * 0.88} x2={center[0]} y2={center[1] - 0.8}
        stroke="#bba775" strokeWidth={0.5} />
      <rect x={center[0] - 1.5} y={center[1] - 1.5} width={3} height={2.2}
        fill="#6b4a24" stroke={INK} strokeWidth={0.6} />
    </g>
  );
}

function IsoWatchtower({ gridW, gridH, T }: { gridW: number; gridH: number; T: number }) {
  const inset = 0.32;
  const c = isoCorners(gridW, gridH, T, inset);
  const wallH = T * 2.7;
  return (
    <g>
      <IsoBlock
        gridW={gridW} gridH={gridH} T={T} inset={inset}
        walls={{ lit: "#9a7a4a", shade: "#6e5230" }}
        roof={{ type: "flat", color: "#5a3820" }}
        story={2.7}
        door="wood" doorColor="#3d2810"
        windows={1} windowColor="#dec97a"
        trim={INK_SOFT} trimRows={3}
      />
      {/* platform rail above */}
      {(() => {
        const { S, E, N, W } = c;
        const Su = lift(S, wallH + 0.5), Eu = lift(E, wallH + 0.5);
        const Nu = lift(N, wallH + 0.5), Wu = lift(W, wallH + 0.5);
        const rail = 5;
        return (
          <g>
            <polygon points={poly(Nu, Eu, Su, Wu)} fill="#7a5028" stroke={INK} strokeWidth={0.9} />
            <polygon points={poly(lift(Nu, rail), lift(Eu, rail), lift(Su, rail), lift(Wu, rail))}
              fill="none" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
            {/* posts */}
            {[Nu, Eu, Su, Wu].map((p, i) => (
              <rect key={i} x={p[0] - 0.4} y={p[1] - rail} width={0.8} height={rail} fill={INK_SOFT} />
            ))}
            {/* small pitched roof on top */}
            <polygon points={poly(
              lift(Nu, rail + 0.5),
              [(Wu[0] + Eu[0]) / 2, lift(Nu, rail + 5)[1]] as P,
              lift(Eu, rail + 0.5),
              [(Wu[0] + Eu[0]) / 2, lift(Su, rail + 5)[1]] as P,
            )} fill="#4a2f18" stroke={INK} strokeWidth={0.9} />
            <polygon points={poly(
              [(Wu[0] + Eu[0]) / 2, lift(Nu, rail + 5)[1]] as P,
              lift(Nu, rail + 0.5),
              [(Wu[0] + Eu[0]) / 2, lift(Nu, rail + 0.5)[1] - 5] as P,
            )} fill="#3d2810" stroke={INK} strokeWidth={0.7} opacity={0.85} />
          </g>
        );
      })()}
    </g>
  );
}

function IsoWaterTower({ gridW, gridH, T }: { gridW: number; gridH: number; T: number }) {
  const inset = 0.3;
  const c = isoCorners(gridW, gridH, T, inset);
  const legH = T * 1.8;
  const { S, E, N, W } = c;
  const Su = lift(S, legH), Eu = lift(E, legH), Nu = lift(N, legH), Wu = lift(W, legH);
  // tank sits above legs
  return (
    <g>
      <ellipse cx={c.C[0]} cy={S[1] + 1.5} rx={Math.abs(E[0] - W[0]) / 2} ry={3} fill={SHADOW} />
      {/* legs */}
      {[S, E, N, W].map((p, i) => (
        <line key={i} x1={p[0]} y1={p[1]} x2={lift(p, legH)[0]} y2={lift(p, legH)[1]}
          stroke="#5a3820" strokeWidth={2.2} strokeLinecap="round" />
      ))}
      {/* cross-bracing */}
      <line x1={S[0]} y1={S[1]} x2={lift(E, legH)[0]} y2={lift(E, legH)[1]} stroke="#5a3820" strokeWidth={0.8} opacity={0.6} />
      <line x1={E[0]} y1={E[1]} x2={lift(W, legH)[0]} y2={lift(W, legH)[1]} stroke="#5a3820" strokeWidth={0.8} opacity={0.6} />
      {/* tank platform */}
      <polygon points={poly(Nu, Eu, Su, Wu)} fill="#6e6258" stroke={INK} strokeWidth={0.9} />
      {/* tank: stout iso block + peaked top */}
      <g>
        {(() => {
          const tH = T * 1.1;
          const sw: P = lerp(Su, c.C, 0.05);
          const se: P = lerp(Eu, c.C, 0.05);
          const nw: P = lerp(Wu, c.C, 0.05);
          const ne: P = lerp(Nu, c.C, 0.05);
          const swU = lift(sw, tH), seU = lift(se, tH), nwU = lift(nw, tH), neU = lift(ne, tH);
          const apex: P = [(swU[0] + seU[0] + nwU[0] + neU[0]) / 4, (swU[1] + seU[1] + nwU[1] + neU[1]) / 4 - tH * 0.45];
          return (
            <>
              <polygon points={poly(sw, se, seU, swU)} fill="#7a8a78" stroke={INK} strokeWidth={0.9} />
              <polygon points={poly(sw, nw, nwU, swU)} fill="#94a48f" stroke={INK} strokeWidth={0.9} />
              {/* bands */}
              {[0.35, 0.7].map((h, i) => (
                <g key={i}>
                  <line x1={lift(sw, tH * h)[0]} y1={lift(sw, tH * h)[1]} x2={lift(nw, tH * h)[0]} y2={lift(nw, tH * h)[1]} stroke={INK_SOFT} strokeWidth={0.5} opacity={0.7} />
                  <line x1={lift(sw, tH * h)[0]} y1={lift(sw, tH * h)[1]} x2={lift(se, tH * h)[0]} y2={lift(se, tH * h)[1]} stroke={INK_SOFT} strokeWidth={0.5} opacity={0.6} />
                </g>
              ))}
              {/* conical top */}
              <polygon points={poly(seU, swU, apex)} fill="#3d2810" stroke={INK} strokeWidth={0.8} />
              <polygon points={poly(swU, nwU, apex)} fill="#4a2f18" stroke={INK} strokeWidth={0.8} />
              <polygon points={poly(nwU, neU, apex)} fill="#3d2810" stroke={INK} strokeWidth={0.8} opacity={0.92} />
              {/* spigot pipe */}
              <line x1={sw[0]} y1={sw[1]} x2={sw[0] - 2} y2={sw[1] + 4} stroke="#3d2810" strokeWidth={1.2} />
            </>
          );
        })()}
      </g>
    </g>
  );
}

function IsoWaterBarrels({ gridW, gridH, T, barrels = 4 }: {
  gridW: number; gridH: number; T: number; barrels?: number;
}) {
  const c = isoCorners(gridW, gridH, T, 0.18);
  const W_ = c.W, E_ = c.E, S_ = c.S, N_ = c.N;
  // Lay barrels in a 2x2 grid (or as configured)
  const slots: P[] = [];
  const cols = Math.min(3, Math.max(1, Math.floor(Math.sqrt(barrels))));
  const rows = Math.ceil(barrels / cols);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols && slots.length < barrels; col++) {
      const u = (col + 0.5) / cols;
      const v = (r + 0.5) / rows;
      // bilinear within the W-S-E-N rhombus
      const a = lerp(W_, S_, u);
      const b = lerp(N_, E_, u);
      slots.push(lerp(a, b, v));
    }
  }
  const bw = Math.max(3, T * 0.4);
  return (
    <g>
      <ellipse cx={c.C[0]} cy={S_[1] + 1.5} rx={Math.abs(E_[0] - W_[0]) / 2 * 0.92} ry={3} fill={SHADOW} />
      <polygon points={poly(N_, E_, S_, W_)} fill="#6e5c3e" stroke={INK} strokeWidth={0.8} />
      {slots
        .slice()
        .sort((a, b) => a[1] - b[1])
        .map((p, i) => (
          <g key={i} transform={`translate(${p[0]}, ${p[1]})`}>
            <ellipse cx={0} cy={3.5} rx={bw * 0.55} ry={bw * 0.18} fill={SHADOW} />
            <ellipse cx={0} cy={0} rx={bw * 0.5} ry={bw * 0.65} fill="#7a5028" stroke={INK} strokeWidth={0.6} />
            <line x1={-bw * 0.48} y1={-bw * 0.18} x2={bw * 0.48} y2={-bw * 0.18} stroke="#3d2810" strokeWidth={0.5} />
            <line x1={-bw * 0.48} y1={bw * 0.18} x2={bw * 0.48} y2={bw * 0.18} stroke="#3d2810" strokeWidth={0.5} />
            <ellipse cx={0} cy={-bw * 0.55} rx={bw * 0.5} ry={bw * 0.18} fill="#1d3548" stroke={INK} strokeWidth={0.4} />
          </g>
        ))}
    </g>
  );
}

function IsoCratePile({ gridW, gridH, T, food = false }: {
  gridW: number; gridH: number; T: number; food?: boolean;
}) {
  const c = isoCorners(gridW, gridH, T, 0.12);
  const baseColor = food ? "#9a6a3a" : "#7a5028";
  const tarp = food ? "#c9a14a" : "#7a8a78";
  return (
    <g>
      <ellipse cx={c.C[0]} cy={c.S[1] + 1.5} rx={Math.abs(c.E[0] - c.W[0]) / 2 * 0.92} ry={3} fill={SHADOW} />
      <polygon points={poly(c.N, c.E, c.S, c.W)} fill="#4a3820" stroke={INK} strokeWidth={0.8} />
      {/* pallet boards */}
      {[0.3, 0.5, 0.7].map((t, i) => {
        const a = lerp(c.W, c.S, t);
        const b = lerp(c.N, c.E, t);
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={INK_SOFT} strokeWidth={0.5} opacity={0.6} />;
      })}
      {/* crates: small iso boxes stacked */}
      {(() => {
        const positions: { p: P; size: number; h: number; tilt: number }[] = [];
        const sample = 5;
        for (let i = 0; i < sample; i++) {
          const u = (i * 0.18 + 0.18) % 0.8 + 0.1;
          const v = ((i * 0.31) % 0.8) + 0.1;
          const a = lerp(c.W, c.S, u);
          const b = lerp(c.N, c.E, u);
          positions.push({ p: lerp(a, b, v), size: 3.2 + (i % 2) * 0.6, h: 2.6 + (i % 3) * 0.4, tilt: (i % 3 - 1) * 6 });
        }
        positions.sort((a, b) => a.p[1] - b.p[1]);
        return positions.map((c2, i) => (
          <g key={i} transform={`translate(${c2.p[0]}, ${c2.p[1]}) rotate(${c2.tilt})`}>
            <polygon points={`${-c2.size},0 0,${c2.size * 0.5} ${c2.size},0 0,${-c2.size * 0.5}`}
              fill={baseColor} stroke={INK} strokeWidth={0.5} />
            <polygon points={`${-c2.size},0 ${-c2.size},${-c2.h} 0,${-c2.h - c2.size * 0.5} 0,${-c2.size * 0.5}`}
              fill="#8a6a3a" stroke={INK} strokeWidth={0.5} />
            <polygon points={`0,${-c2.size * 0.5} 0,${-c2.h - c2.size * 0.5} ${c2.size},${-c2.h} ${c2.size},0`}
              fill="#5a3820" stroke={INK} strokeWidth={0.5} />
          </g>
        ));
      })()}
      {/* tarp covering one corner */}
      <polygon points={poly(c.N, lerp(c.N, c.E, 0.5), c.C, lerp(c.N, c.W, 0.5))}
        fill={tarp} stroke={INK} strokeWidth={0.6} opacity={0.85} />
    </g>
  );
}

function IsoGroundPlot({ gridW, gridH, T, ground, rim, rows, rowColor = "#3d2810", rowAlt = "#8e6730" }: {
  gridW: number; gridH: number; T: number;
  ground: string; rim?: string; rows?: number; rowColor?: string; rowAlt?: string;
}) {
  const c = isoCorners(gridW, gridH, T, 0.05);
  const { S, E, N, W } = c;
  return (
    <g>
      <ellipse cx={c.C[0]} cy={S[1] + 1.2} rx={Math.abs(E[0] - W[0]) / 2 * 0.95} ry={2.4} fill={SHADOW} />
      <polygon points={poly(N, E, S, W)} fill={ground} stroke={rim ?? INK} strokeWidth={0.9} strokeLinejoin="round" />
      {rows && rows > 0 && Array.from({ length: rows }).map((_, i) => {
        const t = (i + 1) / (rows + 1);
        const a = lerp(W, N, t);
        const b = lerp(S, E, t);
        return (
          <g key={i}>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={rowColor} strokeWidth={1.2} />
            <line x1={a[0]} y1={a[1] - 0.7} x2={b[0]} y2={b[1] - 0.7} stroke={rowAlt} strokeWidth={0.4} opacity={0.6} />
          </g>
        );
      })}
    </g>
  );
}

function IsoFarmPlot({ gridW, gridH, T, stage = "empty", growth = 0 }: {
  gridW: number; gridH: number; T: number;
  stage?: string; growth?: number;
}) {
  const c = isoCorners(gridW, gridH, T, 0.04);
  const { S, E, N, W } = c;
  const soilFill = stage === "empty" ? "#6e4920" : "#5a3818";
  const rows = 4;
  const rowsArr = Array.from({ length: rows }, (_, i) => (i + 1) / (rows + 1));
  return (
    <g>
      <ellipse cx={c.C[0]} cy={S[1] + 1.2} rx={Math.abs(E[0] - W[0]) / 2 * 0.95} ry={2.4} fill={SHADOW} />
      <polygon points={poly(N, E, S, W)} fill={soilFill} stroke={INK} strokeWidth={0.9} />
      {/* furrow lines */}
      {rowsArr.map((t, i) => {
        const a = lerp(W, N, t);
        const b = lerp(S, E, t);
        return (
          <g key={i}>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#3d2810" strokeWidth={1.3} />
            <line x1={a[0]} y1={a[1] - 0.7} x2={b[0]} y2={b[1] - 0.7} stroke="#8e6730" strokeWidth={0.4} opacity={0.6} />
          </g>
        );
      })}
      {/* corner posts */}
      {[S, E, N, W].map((p, i) => (
        <rect key={i} x={p[0] - 0.7} y={p[1] - 1.6} width={1.4} height={1.6} fill="#3d2810" />
      ))}
      {/* crops per stage */}
      {stage !== "empty" && rowsArr.map((t, i) => {
        const a = lerp(W, N, t);
        const b = lerp(S, E, t);
        const seedsPerRow = 5;
        return Array.from({ length: seedsPerRow }).map((_, j) => {
          const u = (j + 1) / (seedsPerRow + 1);
          const pt = lerp(a, b, u);
          if (stage === "planting") {
            return <circle key={`s${i}${j}`} cx={pt[0]} cy={pt[1]} r={0.8} fill="#3d2810" />;
          }
          if (stage === "growing") {
            const h = 2 + growth * 3.5;
            return (
              <g key={`s${i}${j}`}>
                <line x1={pt[0]} y1={pt[1]} x2={pt[0]} y2={pt[1] - h} stroke="#4a6235" strokeWidth={0.9} strokeLinecap="round" />
                <circle cx={pt[0]} cy={pt[1] - h} r={0.9} fill="#6a8a3e" stroke={INK} strokeWidth={0.3} />
              </g>
            );
          }
          if (stage === "mature") {
            return (
              <g key={`s${i}${j}`}>
                <line x1={pt[0]} y1={pt[1]} x2={pt[0]} y2={pt[1] - 5.5} stroke="#3d5226" strokeWidth={1} strokeLinecap="round" />
                <ellipse cx={pt[0]} cy={pt[1] - 6.2} rx={1.5} ry={2} fill="#d4a93a" stroke={INK} strokeWidth={0.4} />
              </g>
            );
          }
          const removed = j >= Math.ceil(seedsPerRow * (1 - growth));
          if (removed) return <line key={`s${i}${j}`} x1={pt[0]} y1={pt[1]} x2={pt[0]} y2={pt[1] - 1.2} stroke="#3d2810" strokeWidth={0.8} />;
          return (
            <g key={`s${i}${j}`}>
              <line x1={pt[0]} y1={pt[1]} x2={pt[0]} y2={pt[1] - 4.5} stroke="#a78436" strokeWidth={1} strokeLinecap="round" />
              <ellipse cx={pt[0]} cy={pt[1] - 5} rx={1.3} ry={1.7} fill="#c9a14a" stroke={INK} strokeWidth={0.4} />
            </g>
          );
        });
      })}
    </g>
  );
}

function IsoOrchard({ gridW, gridH, T }: { gridW: number; gridH: number; T: number }) {
  const c = isoCorners(gridW, gridH, T, 0.05);
  const { S, E, N, W } = c;
  // Grass-tone ground
  return (
    <g>
      <ellipse cx={c.C[0]} cy={S[1] + 1.2} rx={Math.abs(E[0] - W[0]) / 2 * 0.95} ry={2.4} fill={SHADOW} />
      <polygon points={poly(N, E, S, W)} fill="#5e7a36" stroke={INK} strokeWidth={0.9} />
      {/* tree rows along NE-SW axis */}
      {(() => {
        const trees: P[] = [];
        const cols = Math.max(2, Math.round(gridW * 1.2));
        const rows = Math.max(2, Math.round(gridH * 1.2));
        for (let r = 0; r < rows; r++) {
          for (let cc = 0; cc < cols; cc++) {
            const u = (cc + 0.5) / cols;
            const v = (r + 0.5) / rows;
            const a = lerp(W, N, v);
            const b = lerp(S, E, v);
            trees.push(lerp(a, b, u));
          }
        }
        trees.sort((p, q) => p[1] - q[1]);
        return trees.map((p, i) => (
          <g key={i} transform={`translate(${p[0]}, ${p[1]})`}>
            <ellipse cx={0} cy={1.6} rx={2.2} ry={0.7} fill={SHADOW} />
            <rect x={-0.6} y={-1} width={1.2} height={2.5} fill="#5a3820" stroke={INK} strokeWidth={0.3} />
            <circle cx={0} cy={-3.4} r={3.2} fill="#3e5c2a" stroke={INK} strokeWidth={0.5} />
            <circle cx={-0.8} cy={-4} r={1.4} fill="#6a8a3e" />
            <circle cx={0.7} cy={-2.6} r={0.5} fill="#d24a2a" />
            <circle cx={-1.1} cy={-3} r={0.5} fill="#d24a2a" />
          </g>
        ));
      })()}
    </g>
  );
}

function IsoPasture({ gridW, gridH, T, kind }: { gridW: number; gridH: number; T: number; kind: string }) {
  const c = isoCorners(gridW, gridH, T, 0.05);
  const { S, E, N, W } = c;
  const grass = kind === "chicken-coop" ? "#8aa64a"
    : kind === "goat-pen" ? "#94a64a"
    : kind === "sheep-pen" ? "#9bb058"
    : "#7a8e3a";
  // Small shed in the NE corner of the plot
  const shedCenter: P = lerp(c.N, c.E, 0.5);
  const shedSize = Math.min(Math.abs(E[0] - W[0]), Math.abs(N[1] - S[1])) * 0.28;
  return (
    <g>
      <ellipse cx={c.C[0]} cy={S[1] + 1.2} rx={Math.abs(E[0] - W[0]) / 2 * 0.95} ry={2.4} fill={SHADOW} />
      <polygon points={poly(N, E, S, W)} fill={grass} stroke="#4a5520" strokeWidth={0.9} />
      {/* grass tufts */}
      {Array.from({ length: 12 }).map((_, i) => {
        const u = (i * 0.31 + 0.1) % 0.85 + 0.075;
        const v = (i * 0.47 + 0.2) % 0.85 + 0.075;
        const a = lerp(W, N, v);
        const b = lerp(S, E, v);
        const p = lerp(a, b, u);
        return <line key={i} x1={p[0]} y1={p[1]} x2={p[0]} y2={p[1] - 1.6} stroke="#3d5226" strokeWidth={0.5} strokeLinecap="round" />;
      })}
      {/* perimeter fence — simple iso rails */}
      {[
        [N, E], [E, S], [S, W], [W, N],
      ].map(([a, b], i) => (
        <g key={i}>
          <line x1={a[0]} y1={a[1] - 0.4} x2={b[0]} y2={b[1] - 0.4} stroke="#7a5028" strokeWidth={1} strokeLinecap="round" />
          <line x1={a[0]} y1={a[1] - 1.8} x2={b[0]} y2={b[1] - 1.8} stroke="#a87a3e" strokeWidth={0.8} strokeLinecap="round" />
          {Array.from({ length: 3 }).map((_, k) => {
            const t = (k + 1) / 4;
            const p = lerp(a as P, b as P, t);
            return <rect key={k} x={p[0] - 0.4} y={p[1] - 2.2} width={0.8} height={2.4} fill="#5a3820" />;
          })}
        </g>
      ))}
      {/* GATE on SW edge — clear entrance marker for pens/pastures */}
      {(() => {
        const gm = lerp(S, W, 0.5);
        const gl = lerp(S, W, 0.38);
        const gr = lerp(S, W, 0.62);
        const postH = 4.4;
        return (
          <g>
            {/* knock-out the rails behind the gate */}
            <rect x={gm[0] - 4} y={gm[1] - 2.4} width={8} height={2.4} fill={grass} />
            {/* tall gate posts */}
            <rect x={gl[0] - 0.6} y={gl[1] - postH} width={1.2} height={postH}
              fill="#3d2810" stroke={INK} strokeWidth={0.4} />
            <rect x={gr[0] - 0.6} y={gr[1] - postH} width={1.2} height={postH}
              fill="#3d2810" stroke={INK} strokeWidth={0.4} />
            {/* crossbar / lintel */}
            <rect x={gl[0]} y={gl[1] - postH - 0.6}
              width={gr[0] - gl[0]} height={1}
              fill="#5a3820" stroke={INK} strokeWidth={0.4} />
            {/* swung open gate panel */}
            <polygon points={poly(
              [gl[0] + 0.6, gl[1] - 0.2] as P,
              [gl[0] + 3.2, gl[1] - 0.8] as P,
              [gl[0] + 3.2, gl[1] - postH * 0.85] as P,
              [gl[0] + 0.6, gl[1] - postH * 0.85 + 0.4] as P,
            )} fill="#a87a3e" stroke={INK} strokeWidth={0.5} />
            {/* gate plaque */}
            <rect x={(gl[0] + gr[0]) / 2 - 1.6} y={gl[1] - postH - 0.4}
              width={3.2} height={1.4} fill="#c9a06a" stroke={INK} strokeWidth={0.4} />
          </g>
        );
      })()}

      {/* shed */}
      <g transform={`translate(${shedCenter[0]}, ${shedCenter[1]})`}>
        <rect x={-shedSize / 2} y={-shedSize * 0.4} width={shedSize} height={shedSize * 0.4}
          fill={kind === "chicken-coop" ? "#9a6a3a" : "#7a5028"} stroke={INK} strokeWidth={0.8} />
        <polygon points={`${-shedSize / 2 - 1},${-shedSize * 0.4} 0,${-shedSize * 0.85} ${shedSize / 2 + 1},${-shedSize * 0.4}`}
          fill="#4a2f18" stroke={INK} strokeWidth={0.8} />
        <rect x={-shedSize * 0.12} y={-shedSize * 0.32} width={shedSize * 0.24} height={shedSize * 0.32}
          fill="#2a1808" stroke={INK} strokeWidth={0.4} />
        {kind === "chicken-coop" && (
          <circle cx={shedSize * 0.2} cy={-shedSize * 0.55} r={1.2} fill="#d24a2a" />
        )}
      </g>
    </g>
  );
}

function IsoLeanTo({ gridW, gridH, T }: { gridW: number; gridH: number; T: number }) {
  const c = isoCorners(gridW, gridH, T, 0.15);
  const { S, E, N, W } = c;
  const wallH = T * 0.5;
  const ridge: P = [lift(N, wallH * 2.4)[0], lift(N, wallH * 2.4)[1]];
  return (
    <g>
      <ellipse cx={c.C[0]} cy={S[1] + 1.2} rx={Math.abs(E[0] - W[0]) / 2 * 0.9} ry={2.4} fill={SHADOW} />
      {/* ground plot */}
      <polygon points={poly(N, E, S, W)} fill="#6a5a3a" stroke={INK} strokeWidth={0.8} />
      {/* lean-to canvas: ridge above N, slopes down to S edge */}
      <polygon points={poly(W, ridge, lift(S, wallH * 0.1))}
        fill="#8a6a3a" stroke={INK} strokeWidth={0.9} />
      <polygon points={poly(ridge, E, lift(S, wallH * 0.1))}
        fill="#6e5028" stroke={INK} strokeWidth={0.9} />
      <line x1={ridge[0]} y1={ridge[1]} x2={lift(S, wallH * 0.1)[0]} y2={lift(S, wallH * 0.1)[1]} stroke={INK_SOFT} strokeWidth={0.6} opacity={0.7} />
      {/* poles */}
      <line x1={W[0]} y1={W[1]} x2={ridge[0]} y2={ridge[1]} stroke="#3d2810" strokeWidth={1} />
      <line x1={E[0]} y1={E[1]} x2={ridge[0]} y2={ridge[1]} stroke="#3d2810" strokeWidth={1} />
      {/* small basket */}
      <ellipse cx={lerp(c.C, S, 0.5)[0]} cy={lerp(c.C, S, 0.5)[1]} rx={2.5} ry={1.2} fill="#a87a3e" stroke={INK} strokeWidth={0.5} />
      <ellipse cx={lerp(c.C, S, 0.5)[0]} cy={lerp(c.C, S, 0.5)[1] - 0.6} rx={2.5} ry={0.9} fill="#c9a06a" stroke={INK} strokeWidth={0.4} />
    </g>
  );
}

// ──────────────────────────────────────────────────────────────
// Visual config per building kind
// ──────────────────────────────────────────────────────────────

type VisualKind =
  | { type: "block"; cfg: Omit<BlockProps, "gridW" | "gridH" | "T"> }
  | { type: "special"; render: (gridW: number, gridH: number, T: number, opt: { farmStage?: string; farmGrowth?: number }) => React.ReactElement };

const WOOD_LIT = "#b78449";
const WOOD_SHADE = "#7e552a";
const PLANK_LIT = "#9a6e3e";
const PLANK_SHADE = "#6b4724";
const STONE_LIT = "#a8a098";
const STONE_SHADE = "#6e655a";
const BRICK_LIT = "#a8503a";
const BRICK_SHADE = "#6d301f";
const CANVAS_LIT = "#d8c79a";
const CANVAS_SHADE = "#9c8a5a";
const ROOF_RUST = "#a14a2a";
const ROOF_RUST_SHADE = "#6a2d18";
const ROOF_SLATE = "#4a4540";
const ROOF_SLATE_SHADE = "#2a2620";
const ROOF_THATCH = "#b9853f";
const ROOF_THATCH_SHADE = "#7a5524";
const ROOF_CEDAR = "#5a3820";
const ROOF_CEDAR_SHADE = "#3a2210";
const ROOF_GREEN = "#566e3e";
const ROOF_GREEN_SHADE = "#3a4a24";
const TRIM_DARK = "#3d2810";
const WINDOW_WARM = "#f1d97e";
const WINDOW_COOL = "#bcd0e0";

const VISUALS: Record<string, VisualKind> = {
  // ── Founders / housing ────────────────────────────
  homestead: {
    type: "block",
    cfg: {
      // Painted clapboard manor — creamy white walls, deep forest-green
      // trim, classic barn-red roof. Reads as a prestige building even
      // when zoomed out.
      walls: { lit: "#f3e4c2", shade: "#c8a87a" },
      roof: { type: "gable", color: "#9a2a1c", shade: "#5e160c", ridge: "ne", gable: "#f3e4c2" },
      story: 1.6,
      door: "double", doorColor: "#1f3a2a",
      windows: 4, windowColor: "#ffd87a",
      trim: "#1f3a2a", trimRows: 5,
      // Rooftop chimney is OFF — a bespoke stone side-chimney is drawn
      // separately by HomesteadFlair so it dominates the silhouette.
      chimney: false,
      banner: { color: "#1f3a2a" },
      inset: 0.10,
      noShadow: true,
      porch: "grand", porchColor: "#1f3a2a",
    },
  },
  tent: {
    type: "block",
    cfg: {
      walls: { lit: CANVAS_LIT, shade: CANVAS_SHADE },
      roof: { type: "canvas", color: CANVAS_LIT, shade: CANVAS_SHADE, stripe: "#7a3a2a" },
      story: 0.55,
      door: "open", doorColor: TRIM_DARK,
      windows: 0,
      inset: 0.18,
    },
  },
  "family-tent": {
    type: "block",
    cfg: {
      walls: { lit: CANVAS_LIT, shade: CANVAS_SHADE },
      roof: { type: "canvas", color: CANVAS_LIT, shade: CANVAS_SHADE, stripe: "#7a3a2a" },
      story: 0.7,
      door: "open", doorColor: TRIM_DARK,
      windows: 1, windowColor: WINDOW_WARM,
      inset: 0.12,
    },
  },
  cabin: {
    type: "block",
    cfg: {
      walls: { lit: WOOD_LIT, shade: WOOD_SHADE },
      roof: { type: "gable", color: ROOF_CEDAR, shade: ROOF_CEDAR_SHADE, ridge: "ne", gable: WOOD_SHADE },
      story: 1.1,
      door: "wood", doorColor: TRIM_DARK,
      windows: 1, windowColor: WINDOW_WARM,
      trim: TRIM_DARK, trimRows: 4,
      chimney: true,
      inset: 0.12,
    },
  },
  "family-cabin": {
    type: "block",
    cfg: {
      walls: { lit: WOOD_LIT, shade: WOOD_SHADE },
      roof: { type: "gable", color: ROOF_CEDAR, shade: ROOF_CEDAR_SHADE, ridge: "ne", gable: WOOD_SHADE },
      story: 1.25,
      door: "wood", doorColor: TRIM_DARK,
      windows: 2, windowColor: WINDOW_WARM,
      trim: TRIM_DARK, trimRows: 4,
      chimney: true,
      inset: 0.10,
    },
  },
  "guest-house": {
    type: "block",
    cfg: {
      walls: { lit: PLANK_LIT, shade: PLANK_SHADE },
      roof: { type: "gable", color: ROOF_CEDAR, shade: ROOF_CEDAR_SHADE, ridge: "nw", gable: PLANK_SHADE },
      story: 1.1,
      door: "wood", doorColor: TRIM_DARK,
      windows: 2, windowColor: WINDOW_WARM,
      banner: { color: "#3a5a72" },
      inset: 0.10,
    },
  },
  house: {
    type: "block",
    cfg: {
      walls: { lit: PLANK_LIT, shade: PLANK_SHADE },
      roof: { type: "gable", color: ROOF_RUST, shade: ROOF_RUST_SHADE, ridge: "ne", gable: PLANK_SHADE },
      story: 1.4,
      door: "wood", doorColor: TRIM_DARK,
      windows: 2, windowColor: WINDOW_WARM,
      trim: TRIM_DARK, trimRows: 2,
      chimney: true,
      inset: 0.10,
    },
  },
  "family-house": {
    type: "block",
    cfg: {
      walls: { lit: PLANK_LIT, shade: PLANK_SHADE },
      roof: { type: "gable", color: ROOF_RUST, shade: ROOF_RUST_SHADE, ridge: "ne", gable: PLANK_SHADE },
      story: 1.5,
      door: "wood", doorColor: TRIM_DARK,
      windows: 2, windowColor: WINDOW_WARM,
      trim: TRIM_DARK, trimRows: 2,
      chimney: true,
      inset: 0.08,
    },
  },
  "large-house": {
    type: "block",
    cfg: {
      walls: { lit: "#c08a52", shade: "#825428" },
      roof: { type: "gable", color: ROOF_RUST, shade: ROOF_RUST_SHADE, ridge: "ne", gable: "#825428" },
      story: 1.75,
      door: "double", doorColor: TRIM_DARK,
      windows: 2, windowColor: WINDOW_WARM,
      trim: TRIM_DARK, trimRows: 3,
      chimney: true,
      inset: 0.06,
    },
  },
  "orphan-house": {
    type: "block",
    cfg: {
      walls: { lit: "#c8a87a", shade: "#8a6840" },
      roof: { type: "gable", color: "#a14a2a", shade: ROOF_RUST_SHADE, ridge: "nw", gable: "#8a6840" },
      story: 1.5,
      door: "wood", doorColor: TRIM_DARK,
      windows: 2, windowColor: WINDOW_WARM,
      banner: { color: "#5a8a6a" },
      inset: 0.08,
    },
  },
  "elder-house": {
    type: "block",
    cfg: {
      walls: { lit: "#b09474", shade: "#7a5e44" },
      roof: { type: "gable", color: ROOF_SLATE, shade: ROOF_SLATE_SHADE, ridge: "ne", gable: "#7a5e44" },
      story: 1.3,
      door: "wood", doorColor: TRIM_DARK,
      windows: 2, windowColor: WINDOW_WARM,
      chimney: true,
      inset: 0.10,
    },
  },
  manor: {
    type: "block",
    cfg: {
      walls: { lit: "#d0bc94", shade: "#8a7654" },
      roof: { type: "hip", color: ROOF_SLATE, shade: ROOF_SLATE_SHADE, pitch: 0.7 },
      story: 1.9,
      door: "double", doorColor: "#2a1808",
      windows: 2, windowColor: WINDOW_WARM,
      trim: TRIM_DARK, trimRows: 2,
      chimney: true,
      inset: 0.06,
    },
  },
  "founder-manor": {
    type: "block",
    cfg: {
      walls: { lit: "#dcc8a0", shade: "#94805c" },
      roof: { type: "hip", color: "#3a3530", shade: "#1d1814", pitch: 0.75 },
      story: 2.1,
      door: "double", doorColor: "#1a0c04",
      windows: 2, windowColor: WINDOW_WARM,
      trim: "#6a4a28", trimRows: 3,
      chimney: true, chimneyColor: "#6a4a30",
      banner: { color: "#a8a05c" },
      inset: 0.05,
    },
  },
  bunkhouse: {
    type: "block",
    cfg: {
      walls: { lit: PLANK_LIT, shade: PLANK_SHADE },
      roof: { type: "gable", color: ROOF_CEDAR, shade: ROOF_CEDAR_SHADE, ridge: "ne", gable: PLANK_SHADE },
      story: 1.25,
      door: "double", doorColor: TRIM_DARK,
      windows: 2, windowColor: WINDOW_WARM,
      trim: TRIM_DARK, trimRows: 3,
      inset: 0.08,
    },
  },

  // ── Civic ─────────────────────────────────────────
  "learning-tent": {
    type: "block",
    cfg: {
      walls: { lit: CANVAS_LIT, shade: CANVAS_SHADE },
      roof: { type: "canvas", color: CANVAS_LIT, shade: CANVAS_SHADE, stripe: "#3a5a72" },
      story: 0.85,
      door: "open", doorColor: TRIM_DARK,
      windows: 1, windowColor: WINDOW_WARM,
      banner: { color: "#3a5a72", symbol: "books" },
      inset: 0.10,
    },
  },
  schoolhouse: {
    type: "block",
    cfg: {
      walls: { lit: "#c0623a", shade: "#7a3a1c" },
      roof: { type: "gable", color: ROOF_CEDAR, shade: ROOF_CEDAR_SHADE, ridge: "ne", gable: "#7a3a1c" },
      story: 1.4,
      door: "wood", doorColor: TRIM_DARK,
      windows: 2, windowColor: WINDOW_WARM,
      chimney: true,
      banner: { color: "#f1d97e", symbol: "books" },
      inset: 0.08,
    },
  },
  academy: {
    type: "block",
    cfg: {
      walls: { lit: "#dccfa6", shade: "#9a8d68" },
      roof: { type: "hip", color: ROOF_SLATE, shade: ROOF_SLATE_SHADE, pitch: 0.65 },
      story: 1.9,
      door: "arch", doorColor: "#3a2410",
      windows: 2, windowColor: WINDOW_WARM,
      trim: "#7a6740", trimRows: 2,
      banner: { color: "#5a3a72", symbol: "books" },
      inset: 0.05,
    },
  },
  library: {
    type: "block",
    cfg: {
      walls: { lit: "#a89274", shade: "#6e5a40" },
      roof: { type: "hip", color: ROOF_SLATE, shade: ROOF_SLATE_SHADE, pitch: 0.55 },
      story: 1.65,
      door: "arch", doorColor: "#2a1808",
      windows: 2, windowColor: WINDOW_WARM,
      trim: TRIM_DARK, trimRows: 2,
      banner: { color: "#7a3a2a", symbol: "books" },
      inset: 0.07,
    },
  },

  // ── Medical ───────────────────────────────────────
  "medical-tent": {
    type: "block",
    cfg: {
      walls: { lit: "#f0e8d6", shade: "#a89e84" },
      roof: { type: "canvas", color: "#f0e8d6", shade: "#a89e84", stripe: "#b04a3a" },
      story: 0.75,
      door: "open", doorColor: TRIM_DARK,
      windows: 1, windowColor: WINDOW_COOL,
      banner: { color: "#b04a3a", symbol: "+" },
      inset: 0.12,
    },
  },
  clinic: {
    type: "block",
    cfg: {
      walls: { lit: "#e6dcc4", shade: "#9c9176" },
      roof: { type: "gable", color: "#b04a3a", shade: "#7a2a1c", ridge: "ne", gable: "#9c9176" },
      story: 1.25,
      door: "wood", doorColor: "#3a2410",
      windows: 2, windowColor: WINDOW_COOL,
      banner: { color: "#b04a3a", symbol: "+" },
      inset: 0.10,
    },
  },
  infirmary: {
    type: "block",
    cfg: {
      walls: { lit: "#f0e6cc", shade: "#a09678" },
      roof: { type: "gable", color: "#b04a3a", shade: "#7a2a1c", ridge: "ne", gable: "#a09678" },
      story: 1.5,
      door: "double", doorColor: "#3a2410",
      windows: 2, windowColor: WINDOW_COOL,
      trim: TRIM_DARK, trimRows: 2,
      banner: { color: "#b04a3a", symbol: "+" },
      inset: 0.07,
    },
  },
  hospital: {
    type: "block",
    cfg: {
      walls: { lit: "#f4ead0", shade: "#a89e80" },
      roof: { type: "hip", color: "#b04a3a", shade: "#7a2a1c", pitch: 0.55 },
      story: 1.85,
      door: "double", doorColor: "#3a2410",
      windows: 2, windowColor: WINDOW_COOL,
      trim: "#7a6c50", trimRows: 3,
      chimney: true,
      banner: { color: "#b04a3a", symbol: "+" },
      inset: 0.05,
    },
  },

  // ── Storage ───────────────────────────────────────
  warehouse: {
    type: "block",
    cfg: {
      walls: { lit: "#9a7a4a", shade: "#6e5230" },
      roof: { type: "gable", color: ROOF_SLATE, shade: ROOF_SLATE_SHADE, ridge: "ne", gable: "#6e5230" },
      story: 1.7,
      door: "barn", doorColor: TRIM_DARK,
      windows: 2, windowColor: WINDOW_WARM,
      trim: TRIM_DARK, trimRows: 3,
      inset: 0.06,
    },
  },
  granary: {
    type: "block",
    cfg: {
      walls: { lit: "#c89a4a", shade: "#8a6420" },
      roof: { type: "peaked", color: ROOF_THATCH, shade: ROOF_THATCH_SHADE, pitch: 0.7 },
      story: 1.6,
      door: "wood", doorColor: TRIM_DARK,
      windows: 0,
      trim: TRIM_DARK, trimRows: 4,
      banner: { color: "#5a8a3a", symbol: "wheat" },
      inset: 0.10,
    },
  },
  "root-cellar": {
    type: "block",
    cfg: {
      walls: { lit: "#7a6a54", shade: "#4a3e30" },
      roof: { type: "peaked", color: ROOF_GREEN, shade: ROOF_GREEN_SHADE, pitch: 0.4 },
      story: 0.7,
      door: "wood", doorColor: "#2a1808",
      windows: 0,
      inset: 0.18,
    },
  },
  "cold-storage": {
    type: "block",
    cfg: {
      walls: { lit: "#a4bccd", shade: "#6c8294" },
      roof: { type: "gable", color: "#3a5466", shade: "#1f3340", ridge: "ne", gable: "#6c8294" },
      story: 1.4,
      door: "barn", doorColor: "#1d2a36",
      windows: 1, windowColor: "#dceaf2",
      trim: "#2a3a48", trimRows: 4,
      inset: 0.08,
    },
  },

  // ── Farming structures ────────────────────────────
  greenhouse: {
    type: "block",
    cfg: {
      walls: { lit: "#a8b8c4", shade: "#6a7a86" },
      roof: { type: "glass", frame: "#5a4a36", pane: "#b8d8e0" },
      story: 1.2,
      door: "wood", doorColor: "#3a2410",
      windows: 0,
      trim: "#3a3024", trimRows: 0,
      inset: 0.07,
    },
  },
  "dairy-barn": {
    type: "block",
    cfg: {
      walls: { lit: "#b04a3a", shade: "#7a2a1c" },
      roof: { type: "gable", color: ROOF_CEDAR, shade: ROOF_CEDAR_SHADE, ridge: "ne", gable: "#7a2a1c" },
      story: 1.6,
      door: "barn", doorColor: TRIM_DARK,
      windows: 2, windowColor: WINDOW_WARM,
      trim: TRIM_DARK, trimRows: 3,
      inset: 0.07,
    },
  },
  "breeding-barn": {
    type: "block",
    cfg: {
      walls: { lit: "#a8503a", shade: "#6d301f" },
      roof: { type: "gable", color: ROOF_CEDAR, shade: ROOF_CEDAR_SHADE, ridge: "ne", gable: "#6d301f" },
      story: 1.5,
      door: "barn", doorColor: TRIM_DARK,
      windows: 2, windowColor: WINDOW_WARM,
      trim: TRIM_DARK, trimRows: 3,
      inset: 0.08,
    },
  },
  "livestock-shelter": {
    type: "block",
    cfg: {
      walls: { lit: WOOD_LIT, shade: WOOD_SHADE },
      roof: { type: "gable", color: ROOF_CEDAR, shade: ROOF_CEDAR_SHADE, ridge: "nw", gable: WOOD_SHADE },
      story: 0.9,
      door: "open", doorColor: TRIM_DARK,
      windows: 0,
      inset: 0.14,
    },
  },

  // ── Defense ───────────────────────────────────────
  "guard-post": {
    type: "block",
    cfg: {
      walls: { lit: PLANK_LIT, shade: PLANK_SHADE },
      roof: { type: "gable", color: ROOF_CEDAR, shade: ROOF_CEDAR_SHADE, ridge: "ne", gable: PLANK_SHADE },
      story: 0.9,
      door: "open", doorColor: TRIM_DARK,
      windows: 1, windowColor: WINDOW_WARM,
      banner: { color: "#7a3a2a" },
      inset: 0.20,
    },
  },

  // ── Misc small props ──────────────────────────────
  workbench: {
    type: "block",
    cfg: {
      walls: { lit: WOOD_LIT, shade: WOOD_SHADE },
      roof: { type: "flat", color: WOOD_SHADE, trim: TRIM_DARK },
      story: 0.5,
      door: "none",
      windows: 0,
      inset: 0.20,
    },
  },
};

// ──────────────────────────────────────────────────────────────
// Ranch yard — the homestead's full estate dressing: picket fence
// with a front gate, dirt path to the porch, large shade tree,
// kitchen garden, benches, storage shed, crates, water barrel and
// firewood pile. Drawn in BACK + FRONT layers so the building
// naturally occludes anything behind it.
// ──────────────────────────────────────────────────────────────
function RanchYard({
  gridW, gridH, T, layer,
}: { gridW: number; gridH: number; T: number; layer: "back" | "front" }) {
  // Fence sits flush with the tile footprint; the building inside
  // is rendered at inset 0.17 so the ring between them is the yard.
  const outer = isoCorners(gridW, gridH, T, -0.02);
  const inner = isoCorners(gridW, gridH, T, 0.10);
  const PICKET = "#efe2bf";
  const PICKET_SHADE = "#a89366";
  const RAIL = "#c9b282";
  const ph = T * 0.42;

  // Picket-fence edge renderer (with optional centered gate gap).
  const renderEdge = (A: P, B: P, gate = false) => {
    const segLen = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const N = Math.max(5, Math.round(segLen / (T * 0.26)));
    const nodes: React.ReactNode[] = [];
    const railAt = (h: number) => {
      const a = lift(A, h), b = lift(B, h);
      if (!gate) {
        return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
          stroke={RAIL} strokeWidth={0.9} strokeLinecap="round" />;
      }
      const g1 = lerp(a, b, 0.40), g2 = lerp(a, b, 0.60);
      return (
        <>
          <line x1={a[0]} y1={a[1]} x2={g1[0]} y2={g1[1]}
            stroke={RAIL} strokeWidth={0.9} strokeLinecap="round" />
          <line x1={g2[0]} y1={g2[1]} x2={b[0]} y2={b[1]}
            stroke={RAIL} strokeWidth={0.9} strokeLinecap="round" />
        </>
      );
    };
    for (let i = 0; i <= N; i++) {
      const tt = i / N;
      if (gate && tt > 0.40 && tt < 0.60) continue;
      const p = lerp(A, B, tt);
      const isGatePost = gate && (Math.abs(tt - 0.40) < 0.02 || Math.abs(tt - 0.60) < 0.02);
      const h = isGatePost ? ph * 1.20 : ph;
      const topY = p[1] - h;
      nodes.push(
        <line key={`p${i}`} x1={p[0]} y1={p[1]} x2={p[0]} y2={topY}
          stroke={PICKET} strokeWidth={isGatePost ? 1.4 : 0.95} strokeLinecap="round" />,
      );
      nodes.push(
        <circle key={`c${i}`} cx={p[0]} cy={topY - 0.2} r={0.6}
          fill={PICKET_SHADE} />,
      );
    }
    return <g>{railAt(ph * 0.7)}{railAt(ph * 0.35)}{nodes}</g>;
  };

  // ── decorations ──────────────────────────────────────────────
  const INK_DARK = INK;

  const flowerBox = (p: P, w: number, palette: string[]) => (
    <g transform={`translate(${p[0]}, ${p[1]})`}>
      <rect x={-w / 2} y={-1.6} width={w} height={2.4}
        fill="#4a3320" stroke={INK_DARK} strokeWidth={0.35} rx={0.3} />
      {Array.from({ length: 4 }).map((_, i) => {
        const cxp = -w / 2 + (i + 0.5) * (w / 4);
        return (
          <g key={i}>
            <line x1={cxp} y1={-1.6} x2={cxp} y2={-3.0}
              stroke="#3a5a2a" strokeWidth={0.45} />
            <circle cx={cxp} cy={-3.2} r={1.0} fill={palette[i % palette.length]} />
            <circle cx={cxp} cy={-3.2} r={0.35} fill="#fff5cc" />
          </g>
        );
      })}
    </g>
  );

  // Big shade tree — bushy oak silhouette with NW lighting.
  const tree = (p: P, scale = 1.0) => {
    const S = T * scale;
    return (
      <g transform={`translate(${p[0]}, ${p[1]})`}>
        <ellipse cx={0} cy={2} rx={S * 0.55} ry={S * 0.18}
          fill="rgba(0,0,0,0.28)" />
        <rect x={-S * 0.10} y={-S * 0.70} width={S * 0.20} height={S * 0.70}
          fill="#4a2e16" stroke={INK_DARK} strokeWidth={0.4} />
        <circle cx={-S * 0.30} cy={-S * 0.90} r={S * 0.42} fill="#3e6228" stroke={INK_DARK} strokeWidth={0.4} />
        <circle cx={ S * 0.28} cy={-S * 1.00} r={S * 0.46} fill="#4a7a30" stroke={INK_DARK} strokeWidth={0.4} />
        <circle cx={ 0}          cy={-S * 1.20} r={S * 0.44} fill="#5e9038" stroke={INK_DARK} strokeWidth={0.4} />
        <circle cx={-S * 0.18} cy={-S * 1.20} r={S * 0.34} fill="#6fa642" />
        <circle cx={ S * 0.10} cy={-S * 1.32} r={S * 0.28} fill="#7eb84a" />
      </g>
    );
  };

  // Iso-styled storage shed (two visible faces + diamond roof).
  const shed = (p: P) => {
    const u = T * 0.45;
    const baseS: P = [0, 0];
    const baseW: P = [-u, -u * 0.5];
    const baseE: P = [u, -u * 0.5];
    const baseN: P = [0, -u];
    const wh = T * 0.65;
    const topS = lift(baseS, wh), topW = lift(baseW, wh), topE = lift(baseE, wh), topN = lift(baseN, wh);
    const peak = lift(topN, T * 0.05);
    const ridgeS = lift(topS, T * 0.05);
    return (
      <g transform={`translate(${p[0]}, ${p[1]})`}>
        <ellipse cx={0} cy={1.2} rx={u * 1.1} ry={u * 0.35} fill="rgba(0,0,0,0.25)" />
        {/* SW wall (lit) */}
        <polygon points={poly(baseS, baseW, topW, topS)}
          fill="#b78449" stroke={INK_DARK} strokeWidth={0.5} />
        {/* SE wall (shade) */}
        <polygon points={poly(baseS, baseE, topE, topS)}
          fill="#7e552a" stroke={INK_DARK} strokeWidth={0.5} />
        {/* roof — peaked along N-S ridge */}
        <polygon points={poly(topW, peak, ridgeS, topS)}
          fill="#a14a2a" stroke={INK_DARK} strokeWidth={0.5} />
        <polygon points={poly(topE, peak, ridgeS, topS)}
          fill="#6a2d18" stroke={INK_DARK} strokeWidth={0.5} />
        {/* door on SW face */}
        <rect x={-u * 0.55} y={-wh + 1} width={u * 0.35} height={wh - 2}
          fill="#3a2210" stroke={INK_DARK} strokeWidth={0.3} />
        <circle cx={-u * 0.28} cy={-wh / 2} r={0.4} fill="#e7c693" />
      </g>
    );
  };

  // Garden patch — diamond plot with green rows.
  const garden = (p: P) => {
    const w = T * 1.05;
    const corners: P[] = [[0, 0], [w, -w / 2], [0, -w], [-w, -w / 2]];
    const rows = [0.22, 0.45, 0.68];
    return (
      <g transform={`translate(${p[0]}, ${p[1]})`}>
        <polygon points={poly(...corners)}
          fill="#5a3a1a" stroke={INK_DARK} strokeWidth={0.45} />
        {rows.map((tt, ri) => {
          const a = lerp(corners[0], corners[1], tt);
          const b = lerp(corners[3], corners[2], tt);
          return (
            <g key={ri}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
                stroke="#6a4a20" strokeWidth={0.5} />
              {[0.15, 0.35, 0.55, 0.75].map((u, ui) => {
                const q = lerp(a, b, u);
                const col = ri === 1 ? "#d94a4a" : "#7ec84a";
                return <circle key={ui} cx={q[0]} cy={q[1] - 0.4} r={0.85} fill={col} stroke={INK_DARK} strokeWidth={0.2} />;
              })}
            </g>
          );
        })}
      </g>
    );
  };

  // Wooden bench — simple two-plank seat with legs.
  const bench = (p: P, angle: "sw" | "se") => {
    const w = T * 0.55, h = T * 0.18;
    const rot = angle === "sw" ? -26 : 26;
    return (
      <g transform={`translate(${p[0]}, ${p[1]}) rotate(${rot})`}>
        <rect x={-w / 2} y={-h - 0.5} width={w} height={1.4}
          fill="#7a5028" stroke={INK_DARK} strokeWidth={0.3} rx={0.3} />
        <rect x={-w / 2} y={-h - 2.4} width={w} height={1.4}
          fill="#8a5a30" stroke={INK_DARK} strokeWidth={0.3} rx={0.3} />
        <rect x={-w / 2 + 0.4} y={-h - 0.5} width={0.6} height={h + 0.5} fill="#3a2210" />
        <rect x={w / 2 - 1.0} y={-h - 0.5} width={0.6} height={h + 0.5} fill="#3a2210" />
      </g>
    );
  };

  // Water barrel — blue water surface, wooden staves.
  const waterBarrel = (p: P) => (
    <g transform={`translate(${p[0]}, ${p[1]})`}>
      <ellipse cx={0} cy={0.6} rx={2.8} ry={1.0} fill="rgba(0,0,0,0.28)" />
      <rect x={-2.4} y={-5.6} width={4.8} height={5.6} rx={0.6}
        fill="#7a4f24" stroke={INK_DARK} strokeWidth={0.4} />
      <ellipse cx={0} cy={-5.6} rx={2.4} ry={1.0}
        fill="#2a5c78" stroke={INK_DARK} strokeWidth={0.4} />
      <ellipse cx={0} cy={-5.9} rx={1.6} ry={0.5} fill="#4a8aa8" opacity={0.7} />
      <line x1={-2.4} y1={-4.0} x2={2.4} y2={-4.0} stroke="#3a2210" strokeWidth={0.5} />
      <line x1={-2.4} y1={-1.8} x2={2.4} y2={-1.8} stroke="#3a2210" strokeWidth={0.5} />
    </g>
  );

  // Stack of crates.
  const crates = (p: P) => (
    <g transform={`translate(${p[0]}, ${p[1]})`}>
      <ellipse cx={0.5} cy={0.6} rx={3.6} ry={1.0} fill="rgba(0,0,0,0.25)" />
      {[
        { x: -2.6, y: -3.0 },
        { x:  0.4, y: -3.0 },
        { x: -1.1, y: -6.4 },
      ].map((c, i) => (
        <g key={i}>
          <rect x={c.x} y={c.y} width={3.0} height={3.0}
            fill="#a07a44" stroke={INK_DARK} strokeWidth={0.35} rx={0.3} />
          <line x1={c.x} y1={c.y + 1.5} x2={c.x + 3.0} y2={c.y + 1.5}
            stroke="#3a2210" strokeWidth={0.3} />
          <line x1={c.x + 1.5} y1={c.y} x2={c.x + 1.5} y2={c.y + 3.0}
            stroke="#3a2210" strokeWidth={0.3} />
        </g>
      ))}
    </g>
  );

  // Firewood pile with an axe.
  const firewood = (p: P) => (
    <g transform={`translate(${p[0]}, ${p[1]})`}>
      <ellipse cx={0} cy={0.6} rx={5.5} ry={1.0} fill="rgba(0,0,0,0.25)" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((i) => {
          const off = row % 2 ? 0.9 : 0;
          const lx = -4 + i * 1.9 + off;
          const ly = -1.4 - row * 1.5;
          return (
            <g key={`${row}-${i}`}>
              <rect x={lx} y={ly} width={1.7} height={1.3} rx={0.5}
                fill="#7a4f24" stroke={INK_DARK} strokeWidth={0.3} />
              <circle cx={lx + 0.85} cy={ly + 0.65} r={0.35} fill="#d8a45a" />
            </g>
          );
        }),
      )}
      <line x1={-5.5} y1={0} x2={-4.2} y2={-4.8}
        stroke="#3a2410" strokeWidth={0.5} strokeLinecap="round" />
      <polygon points={`${-4.2},${-4.8} ${-3.2},${-5.4} ${-3.6},${-4.0}`}
        fill="#9aa0a8" stroke={INK_DARK} strokeWidth={0.3} />
    </g>
  );

  // Dirt path from front gate to porch.
  const dirtPath = () => {
    const start = mid(outer.S, outer.W);  // gate
    const end   = mid(inner.S, inner.W);  // porch foot
    const dx = end[0] - start[0], dy = end[1] - start[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const off = T * 0.22;
    const p1: P = [start[0] + nx * off, start[1] + ny * off];
    const p2: P = [start[0] - nx * off, start[1] - ny * off];
    const p3: P = [end[0]   - nx * off, end[1]   - ny * off];
    const p4: P = [end[0]   + nx * off, end[1]   + ny * off];
    return (
      <g>
        <polygon points={poly(p1, p2, p3, p4)}
          fill="#8a6b3e" stroke="#5a3e1e" strokeWidth={0.4} />
        {/* faint pebble accents */}
        {[0.25, 0.5, 0.75].map((tt, i) => {
          const c1 = lerp(p1, p4, tt), c2 = lerp(p2, p3, tt);
          return (
            <g key={i}>
              <circle cx={lerp(c1, c2, 0.3)[0]} cy={lerp(c1, c2, 0.3)[1]} r={0.45} fill="#a88a55" />
              <circle cx={lerp(c1, c2, 0.7)[0]} cy={lerp(c1, c2, 0.7)[1]} r={0.4}  fill="#6b4a26" />
            </g>
          );
        })}
      </g>
    );
  };

  // Yard quadrant anchor points (midpoint of inner→outer along each side).
  const nwAnchor = lerp(mid(inner.W, inner.N), mid(outer.W, outer.N), 0.55);
  const neAnchor = lerp(mid(inner.N, inner.E), mid(outer.N, outer.E), 0.55);
  const seAnchor = lerp(mid(inner.E, inner.S), mid(outer.E, outer.S), 0.55);

  if (layer === "back") {
    return (
      <g>
        {/* back fence segments */}
        {renderEdge(outer.W, outer.N)}
        {renderEdge(outer.N, outer.E)}
        {/* big shade tree NW of the house */}
        {tree([nwAnchor[0] - T * 0.15, nwAnchor[1] + T * 0.05], 1.2)}
        {/* storage shed NE of the house */}
        {shed([neAnchor[0] + T * 0.05, neAnchor[1] + T * 0.15])}
        {/* crates beside shed */}
        {crates([neAnchor[0] - T * 0.55, neAnchor[1] + T * 0.40])}
        {/* water barrel between shed and front */}
        {waterBarrel([neAnchor[0] + T * 0.55, neAnchor[1] + T * 0.55])}
      </g>
    );
  }

  // FRONT layer
  const sw_q1 = lerp(outer.S, outer.W, 0.18);
  const sw_q2 = lerp(outer.S, outer.W, 0.82);
  const benchA = lerp(inner.S, inner.W, 0.30);
  const benchB = lerp(inner.S, inner.W, 0.70);

  return (
    <g>
      {/* path first so fence + benches sit on top */}
      {dirtPath()}
      {/* front fence with gate on SW edge */}
      {renderEdge(outer.S, outer.W, true)}
      {renderEdge(outer.E, outer.S)}
      {/* kitchen garden in the SE front yard */}
      {garden([seAnchor[0] - T * 0.10, seAnchor[1] + T * 0.05])}
      {/* firewood pile near the SE fence */}
      {firewood([seAnchor[0] + T * 0.45, seAnchor[1] + T * 0.55])}
      {/* benches flanking the porch */}
      {bench([benchA[0], benchA[1] - 1], "sw")}
      {bench([benchB[0], benchB[1] - 1], "se")}
      {/* flower boxes along the front fence */}
      {flowerBox(sw_q1, T * 0.36, ["#d94a4a", "#f1c64a", "#e57ab3", "#f08a3a"])}
      {flowerBox(sw_q2, T * 0.36, ["#e57ab3", "#d94a4a", "#f1c64a", "#a86ad6"])}
    </g>
  );
}


// ──────────────────────────────────────────────────────────────
// HomesteadFlair — bespoke overlays that give the homestead its
// signature silhouette: a tall stone side-chimney rising past the
// roofline, a front dormer with a lit window, and a ridge weather
// vane. Drawn on top of the IsoBlock body.
// ──────────────────────────────────────────────────────────────
function HomesteadFlair({ gridW, gridH, T }: { gridW: number; gridH: number; T: number }) {
  const c = isoCorners(gridW, gridH, T, 0.10);
  const wallH = 1.6 * T; // must match VISUALS.homestead.story

  // ── Stone side-chimney at the NE side of the house.
  // Anchored on the ground at the midpoint of the NE wall (N→E),
  // pushed slightly outward so it kisses the wall instead of
  // poking through it. Rises past the roof ridge for impact.
  const ne = mid(c.N, c.E);
  // outward direction = away from building center
  const outX = ne[0] - c.C[0], outY = ne[1] - c.C[1];
  const outLen = Math.hypot(outX, outY) || 1;
  const push = T * 0.18;
  const chBase: P = [ne[0] + (outX / outLen) * push, ne[1] + (outY / outLen) * push];
  const d = T * 0.55;   // chimney footprint half-diagonal
  const H = wallH + T * 0.95; // taller than the roof peak

  const fS: P = chBase;
  const fW: P = [chBase[0] - d, chBase[1] - d / 2];
  const fE: P = [chBase[0] + d, chBase[1] - d / 2];
  const fN: P = [chBase[0],     chBase[1] - d];
  const tS = lift(fS, H), tW = lift(fW, H), tE = lift(fE, H), tN = lift(fN, H);
  const STONE_LIT2 = "#cdc3b5";
  const STONE_MID  = "#9a9189";
  const STONE_SHD  = "#6e655a";
  const MORTAR = "#4a443a";

  const chimney = (
    <g>
      {/* shadow on ground */}
      <ellipse cx={chBase[0]} cy={chBase[1] + 1} rx={d * 1.3} ry={d * 0.45}
        fill="rgba(0,0,0,0.32)" />
      {/* SW face (lit stone) */}
      <polygon points={poly(fS, fW, tW, tS)}
        fill={STONE_MID} stroke={INK} strokeWidth={0.5} />
      {/* SE face (shaded stone) */}
      <polygon points={poly(fS, fE, tE, tS)}
        fill={STONE_SHD} stroke={INK} strokeWidth={0.5} />
      {/* random stone block pattern on SW face */}
      {[0.18, 0.36, 0.56, 0.76].map((tt, i) => {
        const a = lerp(fS, tS, tt), b = lerp(fW, tW, tt);
        return <line key={`hw${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
          stroke={MORTAR} strokeWidth={0.4} />;
      })}
      {[0.18, 0.36, 0.56, 0.76].map((tt, i) => {
        const a = lerp(fS, tS, tt), b = lerp(fE, tE, tt);
        return <line key={`he${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
          stroke={MORTAR} strokeWidth={0.4} opacity={0.7} />;
      })}
      {/* offset stone joints */}
      {[0.27, 0.46, 0.66].map((tt, i) => {
        const a = lerp(fS, fW, 0.5), top = lerp(tS, tW, 0.5);
        const p1 = lerp(a, top, tt);
        return <line key={`vw${i}`} x1={p1[0] - 1.5} y1={p1[1] - 0.5}
          x2={p1[0] - 1.5} y2={p1[1] - 4} stroke={MORTAR} strokeWidth={0.35} />;
      })}
      {/* cap rim (overhang) */}
      {(() => {
        const r = 1.6;
        const rim = (p: P): P => [p[0], p[1] - r];
        return (
          <polygon points={poly(rim(tS), rim(tE), rim(tN), rim(tW))}
            fill={STONE_LIT2} stroke={INK} strokeWidth={0.5} />
        );
      })()}
      {/* top diamond (flue opening) */}
      <polygon points={poly(tS, tE, tN, tW)}
        fill={STONE_LIT2} stroke={INK} strokeWidth={0.5} />
      <polygon points={poly(
        lerp(tS, tN, 0.30),
        lerp(tE, tW, 0.30),
        lerp(tN, tS, 0.30),
        lerp(tW, tE, 0.30),
      )} fill="#1a1208" />
      {/* wisp of smoke */}
      <path d={`M ${(tS[0] + tN[0]) / 2} ${(tS[1] + tN[1]) / 2 - 2}
                 q -3 -4 0 -7 q 3 -3 0 -6`}
        stroke="rgba(220,220,220,0.55)" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <path d={`M ${(tS[0] + tN[0]) / 2 + 1.5} ${(tS[1] + tN[1]) / 2 - 4}
                 q -3 -3 0 -6`}
        stroke="rgba(220,220,220,0.4)" strokeWidth={1.0} fill="none" strokeLinecap="round" />
    </g>
  );

  // ── Front-facing dormer on the SW roof slope ──
  // The SW roof slope runs from the eave (between S and W on the
  // wall top) up to the ridge. Place the dormer at the midpoint of
  // the SW eave, pushed slightly up the slope.
  const swEaveMid = lift(mid(c.S, c.W), wallH);
  const dormerBase: P = [swEaveMid[0], swEaveMid[1] - T * 0.25];
  const dW = T * 0.55, dH = T * 0.45;
  const dormer = (
    <g>
      {/* dormer side walls — small rectangle facing camera */}
      <polygon points={poly(
        [dormerBase[0] - dW / 2, dormerBase[1]],
        [dormerBase[0] + dW / 2, dormerBase[1]],
        [dormerBase[0] + dW / 2, dormerBase[1] - dH],
        [dormerBase[0] - dW / 2, dormerBase[1] - dH],
      )} fill="#f3e4c2" stroke={INK} strokeWidth={0.5} />
      {/* dormer roof — small triangle peak */}
      <polygon points={poly(
        [dormerBase[0] - dW / 2 - 1, dormerBase[1] - dH],
        [dormerBase[0] + dW / 2 + 1, dormerBase[1] - dH],
        [dormerBase[0],              dormerBase[1] - dH - T * 0.30],
      )} fill="#9a2a1c" stroke={INK} strokeWidth={0.5} />
      {/* lit window */}
      <rect x={dormerBase[0] - dW / 2 + 2} y={dormerBase[1] - dH + 2}
        width={dW - 4} height={dH - 4}
        fill="#ffd87a" stroke="#1f3a2a" strokeWidth={0.5} />
      <line x1={dormerBase[0]} y1={dormerBase[1] - dH + 2}
        x2={dormerBase[0]} y2={dormerBase[1] - 2}
        stroke="#1f3a2a" strokeWidth={0.4} />
      <line x1={dormerBase[0] - dW / 2 + 2} y1={dormerBase[1] - dH / 2}
        x2={dormerBase[0] + dW / 2 - 2} y2={dormerBase[1] - dH / 2}
        stroke="#1f3a2a" strokeWidth={0.4} />
    </g>
  );

  // ── Weather vane on the ridge ──
  // Approximate the ridge peak as lifted center-top of the building.
  const ridgePeak: P = [c.C[0], c.C[1] - wallH - T * 0.85];
  const vane = (
    <g>
      <line x1={ridgePeak[0]} y1={ridgePeak[1]}
        x2={ridgePeak[0]} y2={ridgePeak[1] - T * 0.55}
        stroke="#1a1208" strokeWidth={0.7} strokeLinecap="round" />
      {/* directional N/E arrow + rooster silhouette */}
      <polygon points={poly(
        [ridgePeak[0] - 3.5, ridgePeak[1] - T * 0.45],
        [ridgePeak[0] + 3.5, ridgePeak[1] - T * 0.45],
        [ridgePeak[0] + 5,   ridgePeak[1] - T * 0.50],
        [ridgePeak[0] + 3.5, ridgePeak[1] - T * 0.55],
        [ridgePeak[0] - 3.5, ridgePeak[1] - T * 0.55],
        [ridgePeak[0] - 5,   ridgePeak[1] - T * 0.50],
      )} fill="#3a2210" stroke={INK} strokeWidth={0.4} />
      {/* rooster on top */}
      <ellipse cx={ridgePeak[0]} cy={ridgePeak[1] - T * 0.62}
        rx={2.2} ry={1.5} fill="#3a2210" />
      <line x1={ridgePeak[0] + 1.5} y1={ridgePeak[1] - T * 0.68}
        x2={ridgePeak[0] + 3.2} y2={ridgePeak[1] - T * 0.78}
        stroke="#3a2210" strokeWidth={0.7} />
      <circle cx={ridgePeak[0] + 3.2} cy={ridgePeak[1] - T * 0.78} r={0.9} fill="#3a2210" />
      <polygon points={`${ridgePeak[0] + 3.5},${ridgePeak[1] - T * 0.80}
                        ${ridgePeak[0] + 4.2},${ridgePeak[1] - T * 0.78}
                        ${ridgePeak[0] + 3.5},${ridgePeak[1] - T * 0.76}`}
        fill="#c94a2a" />
      {/* small star at base */}
      <circle cx={ridgePeak[0]} cy={ridgePeak[1] - 0.5} r={1.2} fill="#e8c060" stroke={INK} strokeWidth={0.3} />
    </g>
  );

  return (
    <g>
      {dormer}
      {chimney}
      {vane}
    </g>
  );
}


// ──────────────────────────────────────────────────────────────
// Top-level dispatcher
// ──────────────────────────────────────────────────────────────

export function IsoBuilding({
  kind, gridW, gridH, tile, farmStage, farmGrowth,
}: {
  kind: string;
  gridW: number;
  gridH: number;
  tile: number;
  farmStage?: string;
  farmGrowth?: number;
}) {
  // Special-case dispatchers first
  switch (kind) {
    case "homestead": {
      const cfg = (VISUALS.homestead as Extract<VisualKind, { type: "block" }>).cfg;
      return (
        <g>
          <RanchYard gridW={gridW} gridH={gridH} T={tile} layer="back" />
          <IsoBlock {...cfg} gridW={gridW} gridH={gridH} T={tile} />
          <HomesteadFlair gridW={gridW} gridH={gridH} T={tile} />
          <RanchYard gridW={gridW} gridH={gridH} T={tile} layer="front" />
        </g>
      );
    }
    case "campfire": return <IsoCampfire gridW={gridW} gridH={gridH} T={tile} />;
    case "well": return <IsoWell gridW={gridW} gridH={gridH} T={tile} />;
    case "stone-well": return <IsoWell gridW={gridW} gridH={gridH} T={tile} />;
    case "deep-well": return <IsoWell gridW={gridW} gridH={gridH} T={tile} deep />;
    case "watchtower": return <IsoWatchtower gridW={gridW} gridH={gridH} T={tile} />;
    case "water-tower": return <IsoWaterTower gridW={gridW} gridH={gridH} T={tile} />;
    case "water-collector":
    case "water-barrel":
      return <IsoWaterBarrels gridW={gridW} gridH={gridH} T={tile} barrels={kind === "water-collector" ? 4 : 1} />;
    case "reservoir":
      return (
        <IsoGroundPlot gridW={gridW} gridH={gridH} T={tile}
          ground="#2f4a5a" rim="#1d3548" rows={0} />
      );
    case "stockpile":
      return <IsoCratePile gridW={gridW} gridH={gridH} T={tile} />;
    case "food-stockpile":
      return <IsoCratePile gridW={gridW} gridH={gridH} T={tile} food />;
    case "foraging-camp":
      return <IsoLeanTo gridW={gridW} gridH={gridH} T={tile} />;
    case "farm-plot":
      return <IsoFarmPlot gridW={gridW} gridH={gridH} T={tile} stage={farmStage} growth={farmGrowth} />;
    case "field":
      return <IsoGroundPlot gridW={gridW} gridH={gridH} T={tile} ground="#7a5b2a" rows={5} />;
    case "large-field":
      return <IsoGroundPlot gridW={gridW} gridH={gridH} T={tile} ground="#7a5b2a" rows={7} />;
    case "orchard":
      return <IsoOrchard gridW={gridW} gridH={gridH} T={tile} />;
    case "chicken-coop":
    case "goat-pen":
    case "sheep-pen":
    case "cattle-pasture":
      return <IsoPasture gridW={gridW} gridH={gridH} T={tile} kind={kind} />;
  }

  const cfg = VISUALS[kind];
  if (cfg && cfg.type === "block") {
    return <IsoBlock {...cfg.cfg} gridW={gridW} gridH={gridH} T={tile} />;
  }

  // Fallback — plain wooden block for any kind not yet configured.
  return (
    <IsoBlock
      gridW={gridW} gridH={gridH} T={tile}
      walls={{ lit: WOOD_LIT, shade: WOOD_SHADE }}
      roof={{ type: "gable", color: ROOF_CEDAR, shade: ROOF_CEDAR_SHADE, ridge: "ne", gable: WOOD_SHADE }}
      story={1.1}
      door="wood" doorColor={TRIM_DARK}
      windows={1} windowColor={WINDOW_WARM}
      inset={0.10}
    />
  );
}
