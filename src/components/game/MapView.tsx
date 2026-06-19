import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGame, territoryDims } from "@/game/store";
import { useView } from "@/game/viewStore";
import { BUILDINGS } from "@/game/data/content";
import { useIsMobile } from "@/hooks/use-mobile";
import { ZombieLayer } from "./ZombieLayer";
import { IsoBuilding } from "./IsoBuilding";
import type { ResourceNode, Tile } from "@/game/types";

const TILE = 28;
const LAYER_CHUNK = 1024;

// ── Isometric projection ────────────────────────────────────────
// The simulation stays a square grid (tile (x,y) lives at pixel
// (x*TILE, y*TILE) in "world" space). For presentation we apply a single
// 2:1 isometric matrix to the root <g>, so every child — terrain canvas,
// buildings, fences, survivors — is projected to a diamond grid without
// touching its draw code. The matrix below maps:
//   world (TILE, 0) → iso ( TILE,  TILE/2)
//   world (0, TILE) → iso (-TILE,  TILE/2)
// which is the classic TheoTown-style 2:1 diamond.
// The translate component shifts the projected map so its min x lands at 0
// (the western tile of the grid is at world (0, mapH) → iso (-mapH*TILE, …)).
const ISO_MATRIX_A = 1;
const ISO_MATRIX_B = 0.5;
const ISO_MATRIX_C = -1;
const ISO_MATRIX_D = 0.5;
const isoTx = (mapH: number) => mapH * TILE;
const isoBounds = (mapW: number, mapH: number) => ({
  w: (mapW + mapH) * TILE,
  h: (mapW + mapH) * TILE * 0.5,
});
const isoMatrixString = (mapH: number) =>
  `matrix(${ISO_MATRIX_A}, ${ISO_MATRIX_B}, ${ISO_MATRIX_C}, ${ISO_MATRIX_D}, ${isoTx(mapH)}, 0)`;

// Counter-transform: inside the iso parent group, applying this matrix
// to a child group cancels the iso shear so that child renders
// "screen-upright" while still anchored at the iso projection of world
// point (worldX, worldY). Used to draw upright buildings, fences,
// trees and survivors on top of the diamond ground.
// Derivation: parent matrix P = [[1,-1,tx],[0.5,0.5,0]]; child C
// = P⁻¹ ∘ translate(P·anchor). The translate component simplifies to
// exactly (worldX, worldY).
const isoUpright = (worldX: number, worldY: number) =>
  `matrix(0.5, -0.5, 1, 1, ${worldX}, ${worldY})`;


type LayerImage = {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Unified, muted palette — everything reads as one painted board.
const PAL = {
  ink: "#1a1208",
  inkSoft: "#2a1d10",
  highlight: "rgba(255,232,180,0.06)",
  shadow: "rgba(0,0,0,0.35)",
  gold: "#c9a14a",
  parchment: "#c4ae90",
};


// TheoTown-inspired warm, readable palette. Each tile has a base, a
// dither alt for non-flat coverage, and a detail color for tufts/pebbles.
const TILE_PAL: Record<Tile["kind"], { base: string; alt: string; detail: string }> = {
  grass:        { base: "#6b8a3c", alt: "#7a9947", detail: "#94b558" },
  "tall-grass": { base: "#5c7d33", alt: "#6b8d3d", detail: "#88a64a" },
  dirt:         { base: "#94632a", alt: "#a17132", detail: "#b88947" },
  forest:       { base: "#3e5c2a", alt: "#476833", detail: "#5e8240" },
  stone:        { base: "#8a8278", alt: "#9a9388", detail: "#b0a89c" },
  water:        { base: "#2e5874", alt: "#3a6a86", detail: "#a8d0e0" },
  road:         { base: "#6b4a26", alt: "#78532b", detail: "#8a6432" },
  ruin:         { base: "#5c4d3a", alt: "#6a5944", detail: "#8a7558" },
};


function rand(x: number, y: number, salt = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 13.37) * 43758.5453;
  return n - Math.floor(n);
}

function layerChunks(width: number, height: number) {
  const chunks: Omit<LayerImage, "url">[] = [];
  for (let y = 0; y < height; y += LAYER_CHUNK) {
    for (let x = 0; x < width; x += LAYER_CHUNK) {
      chunks.push({
        id: `${x}-${y}`,
        x,
        y,
        width: Math.min(LAYER_CHUNK, width - x),
        height: Math.min(LAYER_CHUNK, height - y),
      });
    }
  }
  return chunks;
}

function canvasToObjectUrl(canvas: HTMLCanvasElement) {
  return new Promise<string | null>((resolve) => {
    // Some Android WebViews (APK wrappers) return null from toBlob for large
    // canvases or throw on memory pressure. Fall back to a data URL so the
    // terrain and resource layers still render.
    let settled = false;
    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      resolve(url);
    };
    try {
      if (typeof canvas.toBlob === "function") {
        canvas.toBlob((blob) => {
          if (blob) {
            finish(URL.createObjectURL(blob));
            return;
          }
          try { finish(canvas.toDataURL("image/png")); }
          catch { finish(null); }
        }, "image/png");
        // Safety net if toBlob never invokes its callback (seen in some WebViews).
        setTimeout(() => {
          if (settled) return;
          try { finish(canvas.toDataURL("image/png")); }
          catch { finish(null); }
        }, 2000);
      } else {
        finish(canvas.toDataURL("image/png"));
      }
    } catch {
      try { finish(canvas.toDataURL("image/png")); }
      catch { finish(null); }
    }
  });
}

// ── Ranch fence (auto-connecting) ────────────────────────────────
type FenceStyleKey = "natural" | "dark" | "white" | "weathered";
type FenceConn = { n: boolean; e: boolean; s: boolean; w: boolean };

const FENCE_PALETTES: Record<FenceStyleKey, {
  rail: string; railShade: string; railLight: string;
  post: string; postShade: string; postCap: string;
}> = {
  natural:   { rail: "#a87642", railShade: "#6b4521", railLight: "#c98f5a", post: "#5a3820", postShade: "#2f1d10", postCap: "#7a4f2a" },
  dark:      { rail: "#5b3a22", railShade: "#2f1d10", railLight: "#754a2a", post: "#2b1a0d", postShade: "#1a0f06", postCap: "#3d2410" },
  white:     { rail: "#efe6d4", railShade: "#9a8e76", railLight: "#fffaf0", post: "#d9cdb4", postShade: "#7a6e57", postCap: "#fffaf0" },
  weathered: { rail: "#8d8472", railShade: "#56503f", railLight: "#a8a08c", post: "#5a5340", postShade: "#332f24", postCap: "#7a7460" },
};

// Render a single fence tile. The visual is a soft top-down/oblique
// perspective: horizontal rails span tile-edge-to-tile-edge along the
// connected axes, posts stand at junctions/ends, and a small cap +
// shadow give it depth.
function FenceArt({ w, h, connections, style }: { w: number; h: number; connections: FenceConn; style: FenceStyleKey }) {
  const pal = FENCE_PALETTES[style];
  const cx = w / 2;
  const cy = h / 2;
  const min = Math.min(w, h);
  const railT = Math.max(2.2, min * 0.16);       // rail visual thickness
  const postR = Math.max(2.4, min * 0.18);       // post radius (round-ish)
  const postLift = Math.max(2, min * 0.18);      // how far the post "rises" above the rail line
  const { n, e, s, w: cw } = connections;
  const anyConn = n || e || s || cw;
  // Decide which posts to draw. Posts go at endpoints (where a rail stops)
  // and at every junction; for a straight run we only need posts at the
  // segment-end tiles to avoid a wall of stakes.
  const horizontalRun = (cw || e);
  const verticalRun = (n || s);
  const isStraightH = horizontalRun && !verticalRun;
  const isStraightV = verticalRun && !horizontalRun;
  const isJunction = horizontalRun && verticalRun; // corner, T, or cross
  const isSingle = !anyConn;

  // Endpoint flags: this side has no connection (rail terminates here).
  const endLeft = !cw;
  const endRight = !e;
  const endTop = !n;
  const endBottom = !s;

  // Where the rail visually ends inside the tile (pull back so a post can sit on the end)
  const railPad = postR * 0.4;
  const hLeft = cw ? 0 : (isStraightH ? railPad : cx - postR * 0.2);
  const hRight = e ? w : (isStraightH ? w - railPad : cx + postR * 0.2);
  const vTop = n ? 0 : (isStraightV ? railPad : cy - postR * 0.2);
  const vBottom = s ? h : (isStraightV ? h - railPad : cy + postR * 0.2);

  // Rail Y bands (two stacked rails, like classic post-and-rail).
  const railTopY = cy - railT * 0.55 - railT * 0.6;
  const railBotY = cy + railT * 0.55 - railT * 0.05;
  // For vertical runs we draw rails as vertical bands instead.
  const railLeftX = cx - railT * 0.55 - railT * 0.6;
  const railRightX = cx + railT * 0.55 - railT * 0.05;

  const posts: Array<{ x: number; y: number }> = [];
  if (isSingle) {
    posts.push({ x: cx, y: cy });
  } else if (isJunction) {
    // Post at center for corners/T/cross + ends of every terminating arm
    posts.push({ x: cx, y: cy });
    if (endLeft && cw === false && (n || s)) {/* no left arm */}
    if (cw && !e && !n && !s) posts.push({ x: 0, y: cy }); // unlikely
    // For terminal arms in a junction, add a post at the tile edge:
    if (cw && endRight && (n || s) && !e) posts.push({ x: w - postR * 0.3, y: cy });
    if (e && endLeft && (n || s) && !cw) posts.push({ x: postR * 0.3, y: cy });
    if (n && endBottom && (cw || e) && !s) posts.push({ x: cx, y: h - postR * 0.3 });
    if (s && endTop && (cw || e) && !n) posts.push({ x: cx, y: postR * 0.3 });
  } else if (isStraightH) {
    if (endLeft) posts.push({ x: railPad + postR * 0.2, y: cy });
    if (endRight) posts.push({ x: w - railPad - postR * 0.2, y: cy });
    if (!endLeft && !endRight) {
      // mid-run: occasional post so a long fence has rhythm (only every other tile)
      // skip — keep mid clean; junctions/ends carry posts
    }
  } else if (isStraightV) {
    if (endTop) posts.push({ x: cx, y: railPad + postR * 0.2 });
    if (endBottom) posts.push({ x: cx, y: h - railPad - postR * 0.2 });
  }

  return (
    <g>
      {/* soft ground shadow */}
      <ellipse cx={cx} cy={cy + railT * 0.9} rx={Math.max(w, h) * 0.42} ry={railT * 0.55} fill={PAL.shadow} opacity={0.28} />

      {/* HORIZONTAL rails (two stacked) — drawn when there's a horizontal run, OR for a single tile (decorative) */}
      {(horizontalRun || isSingle) && (
        <g>
          {/* top rail */}
          <rect x={hLeft} y={railTopY} width={Math.max(0, hRight - hLeft)} height={railT} rx={railT * 0.35}
            fill={pal.rail} stroke={pal.railShade} strokeWidth={0.6} />
          <rect x={hLeft} y={railTopY} width={Math.max(0, hRight - hLeft)} height={railT * 0.35} rx={railT * 0.3}
            fill={pal.railLight} opacity={0.55} />
          {/* bottom rail */}
          <rect x={hLeft} y={railBotY} width={Math.max(0, hRight - hLeft)} height={railT} rx={railT * 0.35}
            fill={pal.rail} stroke={pal.railShade} strokeWidth={0.6} />
          <rect x={hLeft} y={railBotY} width={Math.max(0, hRight - hLeft)} height={railT * 0.35} rx={railT * 0.3}
            fill={pal.railLight} opacity={0.5} />
        </g>
      )}

      {/* VERTICAL rails — drawn for vertical runs */}
      {verticalRun && (
        <g>
          <rect x={railLeftX} y={vTop} width={railT} height={Math.max(0, vBottom - vTop)} rx={railT * 0.35}
            fill={pal.rail} stroke={pal.railShade} strokeWidth={0.6} />
          <rect x={railLeftX} y={vTop} width={railT * 0.35} height={Math.max(0, vBottom - vTop)} rx={railT * 0.3}
            fill={pal.railLight} opacity={0.55} />
          <rect x={railRightX} y={vTop} width={railT} height={Math.max(0, vBottom - vTop)} rx={railT * 0.35}
            fill={pal.rail} stroke={pal.railShade} strokeWidth={0.6} />
          <rect x={railRightX} y={vTop} width={railT * 0.35} height={Math.max(0, vBottom - vTop)} rx={railT * 0.3}
            fill={pal.railLight} opacity={0.5} />
        </g>
      )}

      {/* POSTS — drawn LAST so they sit on top, and we lift them slightly to look 3D */}
      {posts.map((p, i) => {
        const px = p.x - postR * 0.55;
        const py = p.y - postR * 0.9 - postLift;
        const pw = postR * 1.1;
        const ph = postR * 1.9 + postLift;
        return (
          <g key={i}>
            {/* post shadow */}
            <ellipse cx={p.x} cy={p.y + postR * 0.55} rx={postR * 0.7} ry={postR * 0.28} fill={PAL.shadow} opacity={0.45} />
            {/* post body */}
            <rect x={px} y={py} width={pw} height={ph} rx={postR * 0.35}
              fill={pal.post} stroke={pal.postShade} strokeWidth={0.7} />
            {/* lit edge */}
            <rect x={px} y={py} width={pw * 0.32} height={ph} rx={postR * 0.3}
              fill={pal.postCap} opacity={0.55} />
            {/* cap */}
            <ellipse cx={p.x} cy={py + 0.6} rx={pw * 0.55} ry={pw * 0.28} fill={pal.postCap} stroke={pal.postShade} strokeWidth={0.5} />
          </g>
        );
      })}
    </g>
  );
}

// ── Road tile renderer ─────────────────────────────────────────
// Draws a single 1×1 road segment in world space (the parent iso
// transform shears it into a diamond). The look is chosen by `kind`,
// neighbor connections decide where the strip extends, and a darker
// "shoulder" rim is drawn ONLY on edges without a neighbor so joints
// between tiles stay seamless. When neighbors are mixed tiers the
// higher tier wins at the joint: the half-strip facing that neighbor
// adopts the wider width and the neighbor's palette, so a dirt path
// meeting a stone road blends into the stone road instead of leaving
// a visible step. Stripes and surface detail are clipped to the
// drawn strips so they don't bleed into the grass at open edges.
type RoadConn = { n: boolean; e: boolean; s: boolean; w: boolean };
type RoadNeighbors = {
  n?: { kind: string; tier: number };
  e?: { kind: string; tier: number };
  s?: { kind: string; tier: number };
  w?: { kind: string; tier: number };
};
function RoadTile({
  x, y, t, kind, tier, connections, neighbors,
}: {
  x: number; y: number; t: number;
  kind: string; tier: number; connections: RoadConn;
  neighbors?: RoadNeighbors;
}) {
  // Palette per tier (1=dirt-path .. 5=stone-road)
  const PAL_ROAD: Record<string, { base: string; alt: string; rim: string; stripe?: string }> = {
    "dirt-path":   { base: "#8a6b3e", alt: "#7a5a30", rim: "#5a3e1e" },
    "dirt-road":   { base: "#7a5b2a", alt: "#684b22", rim: "#4a3414" },
    "gravel-road": { base: "#9a907c", alt: "#7e7461", rim: "#4a4438", stripe: "#bcb29c" },
    "paved-road":  { base: "#8e8a82", alt: "#74706a", rim: "#3a3833", stripe: "#d9d5cb" },
    "stone-road":  { base: "#a8a098", alt: "#7e756a", rim: "#3a342c", stripe: "#cfc7b8" },
  };
  const p = PAL_ROAD[kind] ?? PAL_ROAD["dirt-path"];
  const { n, e, s, w } = connections;
  const cx = t / 2, cy = t / 2;
  // Width of the road strip — paths are narrower than full roads.
  const widthFromTier = (ti: number) => (ti <= 1 ? 0.40 : ti === 2 ? 0.65 : ti === 3 ? 0.78 : 0.88);
  const selfHalf = (t * widthFromTier(tier)) / 2;

  // Resolve per-direction joint: the wider/higher tier wins so a narrow
  // path appears to "feed into" the wider road at the seam — no step,
  // no overlap.
  type Dir = "n" | "e" | "s" | "w";
  const sides: Dir[] = ["n", "e", "s", "w"];
  const jointFor = (d: Dir) => {
    const has = connections[d];
    const nb = neighbors?.[d];
    const winnerTier = has ? Math.max(tier, nb?.tier ?? tier) : tier;
    const winnerKind = has && nb && nb.tier > tier ? nb.kind : kind;
    const pal = PAL_ROAD[winnerKind] ?? p;
    const half = (t * widthFromTier(winnerTier)) / 2;
    return { has, pal, half, tier: winnerTier };
  };
  const J = { n: jointFor("n"), e: jointFor("e"), s: jointFor("s"), w: jointFor("w") };
  const hasAny = n || e || s || w;

  // Center cap radius = widest tier touching this tile, so junctions
  // sit flush regardless of which arm you came in on.
  const centerHalf = Math.max(selfHalf, J.n.half, J.e.half, J.s.half, J.w.half);
  // Pick the highest-tier palette present at this tile for the cap so
  // mixed junctions adopt the upgraded surface.
  const capJ = sides
    .map((d) => J[d])
    .filter((j) => j.has)
    .reduce((best, j) => (j.tier > best.tier ? j : best), { tier, pal: p, half: selfHalf, has: true });

  // Build directional strips. For arms WITH a neighbor we run flush to
  // the tile edge and only stroke the two long sides (no end-cap line
  // across the seam). For arms WITHOUT a neighbor we draw a stub and
  // stroke 3 sides so the road reads finished against grass.
  const arms = sides.map((d) => {
    const j = J[d];
    const h = j.half;
    let rx = 0, ry = 0, rw = 0, rh = 0;
    let longSides: Array<[number, number, number, number]> = [];
    let endCap: [number, number, number, number] | null = null;
    if (d === "e") {
      const x0 = cx, x1 = j.has ? t : cx + selfHalf;
      rx = x0; ry = cy - h; rw = x1 - x0; rh = h * 2;
      longSides = [[x0, cy - h, x1, cy - h], [x0, cy + h, x1, cy + h]];
      if (!j.has) endCap = [x1, cy - h, x1, cy + h];
    } else if (d === "w") {
      const x0 = j.has ? 0 : cx - selfHalf, x1 = cx;
      rx = x0; ry = cy - h; rw = x1 - x0; rh = h * 2;
      longSides = [[x0, cy - h, x1, cy - h], [x0, cy + h, x1, cy + h]];
      if (!j.has) endCap = [x0, cy - h, x0, cy + h];
    } else if (d === "s") {
      const y0 = cy, y1 = j.has ? t : cy + selfHalf;
      rx = cx - h; ry = y0; rw = h * 2; rh = y1 - y0;
      longSides = [[cx - h, y0, cx - h, y1], [cx + h, y0, cx + h, y1]];
      if (!j.has) endCap = [cx - h, y1, cx + h, y1];
    } else {
      const y0 = j.has ? 0 : cy - selfHalf, y1 = cy;
      rx = cx - h; ry = y0; rw = h * 2; rh = y1 - y0;
      longSides = [[cx - h, y0, cx - h, y1], [cx + h, y0, cx + h, y1]];
      if (!j.has) endCap = [cx - h, y0, cx + h, y0];
    }
    return { d, j, rect: { x: rx, y: ry, w: rw, h: rh }, longSides, endCap };
  });

  // Stripe range across the tile (tier 4 paved dashed line). Runs the
  // full road extent so dashes line up across joints.
  const ewLeft = w ? 0 : (e ? cx - selfHalf : cx - selfHalf);
  const ewRight = e ? t : (w ? cx + selfHalf : cx + selfHalf);
  const nsTop = n ? 0 : (s ? cy - selfHalf : cy - selfHalf);
  const nsBot = s ? t : (n ? cy + selfHalf : cy + selfHalf);

  // Clip path id (unique per tile position) so surface detail never
  // bleeds outside the drawn pavement.
  const clipId = `roadclip-${x}-${y}`;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        <clipPath id={clipId}>
          {arms.map((a, i) => (
            <rect key={i} x={a.rect.x} y={a.rect.y} width={a.rect.w} height={a.rect.h} />
          ))}
          <rect x={cx - centerHalf} y={cy - centerHalf} width={centerHalf * 2} height={centerHalf * 2} />
        </clipPath>
      </defs>

      {/* directional arms — each painted with the winning tier's color */}
      {arms.map((a, i) => (
        <rect key={`arm-${i}`} x={a.rect.x} y={a.rect.y} width={a.rect.w} height={a.rect.h}
          fill={a.j.pal.base} />
      ))}
      {/* center cap — flush junction in the dominant palette */}
      {hasAny ? (
        <rect x={cx - centerHalf} y={cy - centerHalf} width={centerHalf * 2} height={centerHalf * 2}
          fill={capJ.pal.base} />
      ) : (
        <rect x={cx - selfHalf} y={cy - selfHalf} width={selfHalf * 2} height={selfHalf * 2}
          fill={p.base} stroke={p.rim} strokeWidth={0.6} />
      )}

      {/* shoulder rims — only on open edges; never across a joint */}
      {arms.map((a, i) => (
        <g key={`rim-${i}`}>
          {a.longSides.map(([x1, y1, x2, y2], k) => (
            <line key={k} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={a.j.pal.rim} strokeWidth={0.6} strokeLinecap="square" />
          ))}
          {a.endCap && (
            <line x1={a.endCap[0]} y1={a.endCap[1]} x2={a.endCap[2]} y2={a.endCap[3]}
              stroke={a.j.pal.rim} strokeWidth={0.6} strokeLinecap="square" />
          )}
        </g>
      ))}

      {/* surface detail — clipped to pavement so nothing leaks onto grass */}
      <g clipPath={`url(#${clipId})`}>
        {tier === 1 && Array.from({ length: 8 }).map((_, i) => {
          const u = ((i * 23 + 11) % 100) / 100;
          const v = ((i * 41 + 17) % 100) / 100;
          return <circle key={i} cx={u * t} cy={v * t} r={0.55} fill={p.alt} opacity={0.6} />;
        })}
        {tier === 2 && Array.from({ length: 6 }).map((_, i) => {
          const u = (i + 0.5) / 6;
          if (e || w) return <line key={i} x1={ewLeft + (ewRight - ewLeft) * u} y1={cy - selfHalf * 0.7} x2={ewLeft + (ewRight - ewLeft) * u} y2={cy + selfHalf * 0.7} stroke={p.alt} strokeWidth={0.5} opacity={0.7} />;
          if (n || s) return <line key={i} x1={cx - selfHalf * 0.7} y1={nsTop + (nsBot - nsTop) * u} x2={cx + selfHalf * 0.7} y2={nsTop + (nsBot - nsTop) * u} stroke={p.alt} strokeWidth={0.5} opacity={0.7} />;
          return null;
        })}
        {tier === 3 && Array.from({ length: 12 }).map((_, i) => {
          const u = ((i * 37) % 100) / 100;
          const v = ((i * 73) % 100) / 100;
          return <circle key={i} cx={u * t} cy={v * t} r={0.55} fill={p.stripe ?? p.alt} opacity={0.85} />;
        })}
        {tier === 4 && p.stripe && (
          <>
            {(e || w) && !((n || s) && (e || w)) && (
              <line x1={ewLeft + 2} y1={cy} x2={ewRight - 2} y2={cy}
                stroke={p.stripe} strokeWidth={0.6} strokeDasharray="3 2" opacity={0.85} />
            )}
            {(n || s) && !((n || s) && (e || w)) && (
              <line x1={cx} y1={nsTop + 2} x2={cx} y2={nsBot - 2}
                stroke={p.stripe} strokeWidth={0.6} strokeDasharray="3 2" opacity={0.85} />
            )}
            {/* at a junction, leave a gap in the middle so dashes don't cross */}
            {(n || s) && (e || w) && (
              <>
                {(e) && <line x1={cx + centerHalf + 1} y1={cy} x2={ewRight - 2} y2={cy} stroke={p.stripe} strokeWidth={0.6} strokeDasharray="3 2" opacity={0.85} />}
                {(w) && <line x1={ewLeft + 2} y1={cy} x2={cx - centerHalf - 1} y2={cy} stroke={p.stripe} strokeWidth={0.6} strokeDasharray="3 2" opacity={0.85} />}
                {(s) && <line x1={cx} y1={cy + centerHalf + 1} x2={cx} y2={nsBot - 2} stroke={p.stripe} strokeWidth={0.6} strokeDasharray="3 2" opacity={0.85} />}
                {(n) && <line x1={cx} y1={nsTop + 2} x2={cx} y2={cy - centerHalf - 1} stroke={p.stripe} strokeWidth={0.6} strokeDasharray="3 2" opacity={0.85} />}
              </>
            )}
          </>
        )}
        {tier === 5 && (
          <g>
            {Array.from({ length: 4 }).map((_, r) =>
              Array.from({ length: 4 }).map((_, c) => {
                const u = (c + 0.5) / 4, v = (r + 0.5) / 4;
                return <rect key={`${r}${c}`} x={u * t - 1.8} y={v * t - 1.8} width={3.6} height={3.6}
                  fill={p.alt} stroke={p.rim} strokeWidth={0.3} opacity={0.85} />;
              }),
            )}
          </g>
        )}
      </g>
    </g>
  );
}

// ── Hand-drawn building renderers — keep below ──────────────────
function _RoadTileSpacer(){return null;}


// ── Hand-drawn building renderers (unified style) ────────────────
function BuildingArt({ kind, w, h, farmStage, farmGrowth }: { kind: string; w: number; h: number; farmStage?: string; farmGrowth?: number }) {
  // All buildings share: dark ink outline, warm wood tones, simple silhouettes.
  const cx = w / 2;
  switch (kind) {
    case "homestead": {
      // Top-down family estate: yard with fence, garden, shed, well, firewood,
      // trees and a substantial pitched-roof main house with a small porch.
      const pad = Math.max(1.5, w * 0.04);
      const yardX = pad, yardY = pad;
      const yardW = w - pad * 2, yardH = h - pad * 2;
      // Main house occupies the upper portion of the yard — wide and prominent
      const houseW = yardW * 0.78;
      const houseH = yardH * 0.5;
      const houseX = yardX + (yardW - houseW) / 2;
      const houseY = yardY + pad * 0.5;
      const roofOverhang = Math.min(2.5, houseW * 0.06);
      const porchH = houseH * 0.18;
      const porchY = houseY + houseH;
      const porchX = houseX + houseW * 0.22;
      const porchW = houseW * 0.55;
      // Shed lower-right
      const shedW = yardW * 0.24;
      const shedH = yardH * 0.22;
      const shedX = yardX + yardW - shedW - pad * 0.6;
      const shedY = yardY + yardH - shedH - pad * 0.6;
      // Well lower-left
      const wellR = Math.min(yardW, yardH) * 0.07;
      const wellCx = yardX + yardW * 0.15;
      const wellCy = yardY + yardH - yardH * 0.18;
      // Path from south gate to porch
      const gateX = yardX + yardW * 0.5;
      const pathW = Math.max(3, w * 0.06);
      // Firewood stack near house
      const fwX = houseX - pad * 0.2;
      const fwY = porchY + porchH * 1.4;
      // Fence posts around yard perimeter
      const postR = Math.max(0.9, w * 0.014);
      const perim: { x: number; y: number }[] = [];
      const steps = Math.max(6, Math.round(yardW / 6));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        perim.push({ x: yardX + t * yardW, y: yardY });           // top
        perim.push({ x: yardX + t * yardW, y: yardY + yardH });   // bottom
      }
      const vSteps = Math.max(5, Math.round(yardH / 6));
      for (let i = 1; i < vSteps; i++) {
        const t = i / vSteps;
        perim.push({ x: yardX, y: yardY + t * yardH });
        perim.push({ x: yardX + yardW, y: yardY + t * yardH });
      }
      return (
        <g>
          {/* ground shadow */}
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.47} ry={3} fill={PAL.shadow} />
          {/* yard ground — trampled grass / dirt */}
          <rect x={yardX} y={yardY} width={yardW} height={yardH} rx={2}
            fill="#4a5a2e" stroke="#4a3a1f" strokeWidth={0.9} opacity={0.95} />
          <rect x={yardX + 1} y={yardY + 1} width={yardW - 2} height={yardH - 2} rx={1.5}
            fill="#536432" opacity={0.55} />


          {/* dirt path from south gate up to porch */}
          <path d={`M${gateX} ${yardY + yardH} L${gateX} ${porchY + porchH * 0.5} L${porchX + porchW / 2 - pathW / 2} ${porchY + porchH * 0.5}`}
            stroke="#b08a55" strokeWidth={pathW} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d={`M${gateX} ${yardY + yardH} L${gateX} ${porchY + porchH * 0.5}`}
            stroke="#c9a06a" strokeWidth={pathW * 0.5} strokeLinecap="round" fill="none" opacity={0.7} />

          {/* vegetable garden removed */}


          {/* storage shed */}
          <rect x={shedX} y={shedY + shedH * 0.35} width={shedW} height={shedH * 0.65}
            fill="#7a5028" stroke={PAL.ink} strokeWidth={0.9} />
          <polygon points={`${shedX - 1},${shedY + shedH * 0.38} ${shedX + shedW / 2},${shedY + shedH * 0.05} ${shedX + shedW + 1},${shedY + shedH * 0.38}`}
            fill="#4a2f18" stroke={PAL.ink} strokeWidth={0.9} />
          <rect x={shedX + shedW * 0.4} y={shedY + shedH * 0.55} width={shedW * 0.2} height={shedH * 0.4} fill="#2f1d0c" />

          {/* well */}
          <ellipse cx={wellCx} cy={wellCy + wellR * 0.9} rx={wellR * 1.15} ry={wellR * 0.4} fill={PAL.shadow} />
          <circle cx={wellCx} cy={wellCy} r={wellR} fill="#6e6258" stroke={PAL.ink} strokeWidth={0.9} />
          <circle cx={wellCx} cy={wellCy} r={wellR * 0.55} fill="#1a1410" />
          <rect x={wellCx - wellR * 0.15} y={wellCy - wellR * 1.6} width={wellR * 0.3} height={wellR * 1.4} fill="#5a3820" stroke={PAL.ink} strokeWidth={0.4} />
          <rect x={wellCx - wellR * 1.1} y={wellCy - wellR * 1.7} width={wellR * 2.2} height={wellR * 0.25} fill="#3d2810" />

          {/* stacked firewood */}
          {Array.from({ length: 3 }).map((_, i) => (
            <g key={`fw${i}`}>
              <rect x={fwX} y={fwY + i * 2.2} width={6} height={2} fill="#7a5028" stroke={PAL.ink} strokeWidth={0.4} />
              <circle cx={fwX + 0.8} cy={fwY + i * 2.2 + 1} r={0.7} fill="#c9a06a" />
              <circle cx={fwX + 5.2} cy={fwY + i * 2.2 + 1} r={0.7} fill="#c9a06a" />
            </g>
          ))}

          {/* a barrel near the porch */}
          <ellipse cx={houseX + houseW + pad * 0.4} cy={porchY + porchH * 0.3} rx={2.2} ry={2.6} fill="#7a5028" stroke={PAL.ink} strokeWidth={0.6} />
          <line x1={houseX + houseW + pad * 0.4 - 2.1} y1={porchY + porchH * 0.3} x2={houseX + houseW + pad * 0.4 + 2.1} y2={porchY + porchH * 0.3} stroke="#3d2810" strokeWidth={0.5} />

          {/* decorative bushes in multiple corners and along fence */}
          {[
            [yardX + 3, yardY + 3],
            [yardX + yardW - 3, yardY + 3],
            [yardX + 3, yardY + yardH - 3],
            [wellCx + wellR * 2.2, wellCy - wellR * 0.4],
            [shedX - 3.5, shedY + shedH * 0.4],
            [yardX + yardW * 0.32, yardY + yardH - 4],
          ].map(([bx, by], i) => (
            <g key={`bush${i}`}>
              <circle cx={bx} cy={by + 1} r={2.4} fill={PAL.shadow} />
              <circle cx={bx} cy={by} r={2.6} fill="#3d5226" stroke={PAL.ink} strokeWidth={0.6} />
              <circle cx={bx - 0.6} cy={by - 0.6} r={1.1} fill="#4a6235" />
            </g>
          ))}

          {/* wooden crates stacked near the shed */}
          {[
            { x: shedX - 5, y: shedY + shedH * 0.55, s: 3.4 },
            { x: shedX - 5 + 3.6, y: shedY + shedH * 0.55 + 0.4, s: 3.0 },
            { x: shedX - 5 + 1.2, y: shedY + shedH * 0.55 - 3.2, s: 2.8 },
          ].map((c, i) => (
            <g key={`crate${i}`}>
              <rect x={c.x} y={c.y + c.s * 0.9} width={c.s} height={c.s * 0.3} fill={PAL.shadow} opacity={0.5} />
              <rect x={c.x} y={c.y} width={c.s} height={c.s} fill="#8a5a30" stroke={PAL.ink} strokeWidth={0.6} />
              <line x1={c.x} y1={c.y + c.s * 0.5} x2={c.x + c.s} y2={c.y + c.s * 0.5} stroke="#3d2810" strokeWidth={0.4} />
              <line x1={c.x + c.s * 0.5} y1={c.y} x2={c.x + c.s * 0.5} y2={c.y + c.s} stroke="#3d2810" strokeWidth={0.4} />
            </g>
          ))}

          {/* extra barrels by the well */}
          {[
            { cx: wellCx - wellR * 2.4, cy: wellCy + wellR * 1.1 },
            { cx: wellCx - wellR * 2.4 + 5, cy: wellCy + wellR * 1.4 },
          ].map((b, i) => (
            <g key={`bar${i}`}>
              <ellipse cx={b.cx} cy={b.cy + 2.6} rx={2.4} ry={0.8} fill={PAL.shadow} opacity={0.6} />
              <ellipse cx={b.cx} cy={b.cy} rx={2.2} ry={2.6} fill="#7a5028" stroke={PAL.ink} strokeWidth={0.6} />
              <line x1={b.cx - 2.1} y1={b.cy - 0.6} x2={b.cx + 2.1} y2={b.cy - 0.6} stroke="#3d2810" strokeWidth={0.5} />
              <line x1={b.cx - 2.1} y1={b.cy + 0.6} x2={b.cx + 2.1} y2={b.cy + 0.6} stroke="#3d2810" strokeWidth={0.5} />
            </g>
          ))}

          {/* second firewood stack along the east side */}
          {Array.from({ length: 4 }).map((_, i) => {
            const fx = shedX - 9;
            const fy = shedY - 2 + i * 2.2;
            return (
              <g key={`fw2-${i}`}>
                <rect x={fx} y={fy} width={7} height={2} fill="#6b4322" stroke={PAL.ink} strokeWidth={0.4} />
                <circle cx={fx + 0.8} cy={fy + 1} r={0.7} fill="#c9a06a" />
                <circle cx={fx + 6.2} cy={fy + 1} r={0.7} fill="#a87a3e" />
              </g>
            );
          })}

          {/* small hay/feed sack pile near porch */}
          {[
            { x: porchX - 4, y: porchY + porchH * 0.4 },
            { x: porchX - 4 + 2.2, y: porchY + porchH * 0.4 - 0.4 },
          ].map((s, i) => (
            <g key={`sack${i}`}>
              <ellipse cx={s.x + 1.2} cy={s.y + 2.6} rx={1.6} ry={0.6} fill={PAL.shadow} opacity={0.6} />
              <ellipse cx={s.x + 1.2} cy={s.y + 1.2} rx={1.5} ry={2.0} fill="#c9a06a" stroke={PAL.ink} strokeWidth={0.5} />
              <line x1={s.x + 0.2} y1={s.y + 0.2} x2={s.x + 2.2} y2={s.y + 0.2} stroke="#8a5a30" strokeWidth={0.4} />
            </g>
          ))}

          {/* a small wagon wheel leaning against the shed */}
          <g>
            <circle cx={shedX - 1.6} cy={shedY + shedH - 2} r={2.4} fill="none" stroke="#3d2810" strokeWidth={0.9} />
            <circle cx={shedX - 1.6} cy={shedY + shedH - 2} r={0.6} fill="#3d2810" />
            {[0, 60, 120].map((deg, i) => {
              const r = 2.4;
              const a = (deg * Math.PI) / 180;
              return <line key={`sp${i}`} x1={shedX - 1.6 - Math.cos(a) * r} y1={shedY + shedH - 2 - Math.sin(a) * r}
                x2={shedX - 1.6 + Math.cos(a) * r} y2={shedY + shedH - 2 + Math.sin(a) * r}
                stroke="#3d2810" strokeWidth={0.6} />;
            })}
          </g>


          {/* MAIN HOUSE — wide, prominent */}
          {/* porch */}
          <rect x={porchX} y={porchY - 0.6} width={porchW} height={porchH + 1.2}
            fill="#a87a3e" stroke={PAL.ink} strokeWidth={0.9} />
          <line x1={porchX + 1} y1={porchY + porchH * 0.5} x2={porchX + porchW - 1} y2={porchY + porchH * 0.5}
            stroke="#3d2810" strokeWidth={0.4} opacity={0.7} />
          {/* porch posts */}
          {[porchX + 0.6, porchX + porchW - 0.6].map((px, i) => (
            <rect key={`pp${i}`} x={px - 0.6} y={porchY - 1.2} width={1.2} height={porchH + 1.8} fill="#5a3820" stroke={PAL.ink} strokeWidth={0.4} />
          ))}

          {/* house walls (log) */}
          <rect x={houseX} y={houseY + houseH * 0.32} width={houseW} height={houseH * 0.68}
            fill="#8a5a30" stroke={PAL.ink} strokeWidth={1.1} />
          {/* log seams */}
          {[0.48, 0.66, 0.84].map((t, i) => (
            <line key={`ls${i}`} x1={houseX + 1} y1={houseY + houseH * t} x2={houseX + houseW - 1} y2={houseY + houseH * t}
              stroke={PAL.inkSoft} strokeWidth={0.4} opacity={0.6} />
          ))}
          {/* windows */}
          {[0.18, 0.62].map((t, i) => (
            <g key={`w${i}`}>
              <rect x={houseX + houseW * t} y={houseY + houseH * 0.5} width={houseW * 0.18} height={houseH * 0.18}
                fill="#d9c98a" stroke={PAL.ink} strokeWidth={0.5} />
              <line x1={houseX + houseW * (t + 0.09)} y1={houseY + houseH * 0.5} x2={houseX + houseW * (t + 0.09)} y2={houseY + houseH * 0.68}
                stroke={PAL.ink} strokeWidth={0.4} />
            </g>
          ))}
          {/* door */}
          <rect x={houseX + houseW * 0.42} y={houseY + houseH * 0.74} width={houseW * 0.16} height={houseH * 0.26}
            fill="#3d2810" stroke={PAL.ink} strokeWidth={0.6} />
          <circle cx={houseX + houseW * 0.56} cy={houseY + houseH * 0.87} r={0.5} fill="#d4a93a" />

          {/* pitched roof — drawn as a wide hipped slab with ridge line */}
          <polygon
            points={`${houseX - roofOverhang},${houseY + houseH * 0.36} ${houseX + houseW * 0.18},${houseY - 0.5} ${houseX + houseW * 0.82},${houseY - 0.5} ${houseX + houseW + roofOverhang},${houseY + houseH * 0.36}`}
            fill="#4a2f18" stroke={PAL.ink} strokeWidth={1.2} />
          {/* roof shade band */}
          <polygon
            points={`${houseX - roofOverhang + 1},${houseY + houseH * 0.34} ${houseX + houseW * 0.2},${houseY + 0.4} ${houseX + houseW * 0.8},${houseY + 0.4} ${houseX + houseW + roofOverhang - 1},${houseY + houseH * 0.34}`}
            fill="#5a3820" opacity={0.55} />
          {/* ridge */}
          <line x1={houseX + houseW * 0.18} y1={houseY - 0.5} x2={houseX + houseW * 0.82} y2={houseY - 0.5}
            stroke="#2a1808" strokeWidth={1.2} strokeLinecap="round" />
          {/* shingles hint */}
          {[0.12, 0.22, 0.32].map((t, i) => (
            <line key={`sh${i}`} x1={houseX - roofOverhang + 2} y1={houseY + houseH * t + houseH * 0.04}
              x2={houseX + houseW + roofOverhang - 2} y2={houseY + houseH * t + houseH * 0.04}
              stroke="#2a1808" strokeWidth={0.3} opacity={0.5} />
          ))}
          {/* chimney with smoke wisp */}
          <rect x={houseX + houseW * 0.74} y={houseY - houseH * 0.18} width={houseW * 0.1} height={houseH * 0.32}
            fill="#6e6258" stroke={PAL.ink} strokeWidth={0.7} />
          <rect x={houseX + houseW * 0.73} y={houseY - houseH * 0.21} width={houseW * 0.12} height={houseH * 0.04} fill="#3d2810" />

          {/* fence around yard perimeter (with gate gap at south) */}
          {/* rails */}
          <rect x={yardX} y={yardY - 0.4} width={yardW} height={0.9} fill="#7a5028" />
          <rect x={yardX} y={yardY + yardH - 0.5} width={(gateX - yardX) - pathW * 0.7} height={0.9} fill="#7a5028" />
          <rect x={gateX + pathW * 0.7} y={yardY + yardH - 0.5} width={(yardX + yardW) - (gateX + pathW * 0.7)} height={0.9} fill="#7a5028" />
          <rect x={yardX - 0.4} y={yardY} width={0.9} height={yardH} fill="#7a5028" />
          <rect x={yardX + yardW - 0.5} y={yardY} width={0.9} height={yardH} fill="#7a5028" />
          {/* fence posts */}
          {perim.map((p, i) => {
            // skip posts inside gate gap
            if (Math.abs(p.y - (yardY + yardH)) < 0.1 && Math.abs(p.x - gateX) < pathW * 0.8) return null;
            return (
              <rect key={`fp${i}`} x={p.x - postR} y={p.y - postR} width={postR * 2} height={postR * 2.4}
                fill="#5a3820" stroke={PAL.ink} strokeWidth={0.3} />
            );
          })}
          {/* gate posts (taller) */}
          <rect x={gateX - pathW * 0.7 - 0.7} y={yardY + yardH - 2} width={1.4} height={3.2} fill="#3d2810" stroke={PAL.ink} strokeWidth={0.4} />
          <rect x={gateX + pathW * 0.7 - 0.7} y={yardY + yardH - 2} width={1.4} height={3.2} fill="#3d2810" stroke={PAL.ink} strokeWidth={0.4} />
        </g>
      );
    }
    case "campfire": {
      // Stone ring + crossed logs + flame
      const r = Math.min(w, h) * 0.32;
      return (
        <g>
          <ellipse cx={cx} cy={h - 3} rx={r * 1.1} ry={r * 0.35} fill={PAL.shadow} />
          <ellipse cx={cx} cy={h * 0.7} rx={r} ry={r * 0.45} fill="#5e564c" stroke={PAL.ink} strokeWidth={1} />
          <line x1={cx - r * 0.7} y1={h * 0.65} x2={cx + r * 0.7} y2={h * 0.55} stroke="#3d2810" strokeWidth={2.2} strokeLinecap="round" />
          <line x1={cx - r * 0.6} y1={h * 0.55} x2={cx + r * 0.65} y2={h * 0.68} stroke="#5a3820" strokeWidth={2.2} strokeLinecap="round" />
          {/* flame */}
          <path d={`M${cx} ${h * 0.55} q-${r * 0.4} -${r * 0.5} 0 -${r * 0.95} q${r * 0.4} ${r * 0.45} 0 ${r * 0.95} z`}
            fill="#e8a04a" stroke={PAL.ink} strokeWidth={0.8} />
          <path d={`M${cx} ${h * 0.5} q-${r * 0.18} -${r * 0.25} 0 -${r * 0.5} q${r * 0.18} ${r * 0.25} 0 ${r * 0.5} z`}
            fill="#f5d98a" />
        </g>
      );
    }
    case "farm-plot": {
      // Stage-aware rendering: empty → planting → growing → mature → harvesting
      const rows = 4;
      const stage = farmStage ?? "empty";
      const growth = Math.max(0, Math.min(1, farmGrowth ?? 0));
      const rowYs = Array.from({ length: rows }, (_, i) => 3 + ((h - 6) / rows) * (i + 0.5));
      // soil tone shifts as crops grow
      const soilFill = stage === "empty" ? "#6e4920" : "#5a3818";
      return (
        <g>
          <rect x={1} y={1} width={w - 2} height={h - 2} fill={soilFill} stroke={PAL.ink} strokeWidth={1} />
          {/* furrows */}
          {rowYs.map((y, i) => (
            <g key={`f${i}`}>
              <line x1={3} y1={y} x2={w - 3} y2={y} stroke="#3d2810" strokeWidth={1.4} />
              <line x1={3} y1={y - 1} x2={w - 3} y2={y - 1} stroke="#8e6730" strokeWidth={0.5} opacity={0.6} />
            </g>
          ))}
          {/* corner posts */}
          {[[2, 2], [w - 2, 2], [2, h - 2], [w - 2, h - 2]].map(([x, y], i) => (
            <rect key={i} x={x - 1} y={y - 1} width={2} height={2} fill="#3d2810" />
          ))}
          {/* crops per stage */}
          {stage !== "empty" && rowYs.map((y, i) => {
            const seedsPerRow = 5;
            return Array.from({ length: seedsPerRow }).map((_, j) => {
              const cxc = 4 + ((w - 8) / (seedsPerRow - 1)) * j;
              if (stage === "planting") {
                return <circle key={`s${i}${j}`} cx={cxc} cy={y} r={0.8} fill="#3d2810" />;
              }
              if (stage === "growing") {
                const sproutH = 2 + growth * 3;
                return (
                  <g key={`s${i}${j}`}>
                    <line x1={cxc} y1={y} x2={cxc} y2={y - sproutH} stroke="#4a6235" strokeWidth={0.9} strokeLinecap="round" />
                    <circle cx={cxc} cy={y - sproutH} r={0.9} fill="#566e3e" />
                  </g>
                );
              }
              if (stage === "mature") {
                return (
                  <g key={`s${i}${j}`}>
                    <line x1={cxc} y1={y} x2={cxc} y2={y - 5.5} stroke="#3d5226" strokeWidth={1} strokeLinecap="round" />
                    <ellipse cx={cxc} cy={y - 6} rx={1.6} ry={2} fill="#d4a93a" stroke={PAL.ink} strokeWidth={0.4} />
                    <line x1={cxc - 1.2} y1={y - 6.5} x2={cxc + 1.2} y2={y - 6.5} stroke="#e8c462" strokeWidth={0.4} />
                  </g>
                );
              }
              // harvesting — partly removed, sheaves stacked
              const removed = j >= Math.ceil(seedsPerRow * (1 - growth));
              if (removed) {
                return <line key={`s${i}${j}`} x1={cxc} y1={y} x2={cxc} y2={y - 1.2} stroke="#3d2810" strokeWidth={0.8} />;
              }
              return (
                <g key={`s${i}${j}`}>
                  <line x1={cxc} y1={y} x2={cxc} y2={y - 5} stroke="#a78436" strokeWidth={1} strokeLinecap="round" />
                  <ellipse cx={cxc} cy={y - 5.5} rx={1.4} ry={1.8} fill="#c9a14a" stroke={PAL.ink} strokeWidth={0.4} />
                </g>
              );
            });
          })}
          {/* stage tag dot */}
          <circle cx={w - 3} cy={3} r={1.6} fill={
            stage === "empty" ? "#5e564c" :
            stage === "planting" ? "#8e6730" :
            stage === "growing" ? "#566e3e" :
            stage === "mature" ? "#c9a14a" : "#a83a3a"
          } stroke={PAL.ink} strokeWidth={0.4} />
        </g>
      );
    }
    case "water-collector": {
      // Stone well with wooden roof, rope, bucket, water surface
      const rimY = h * 0.42;
      return (
        <g>
          <ellipse cx={cx} cy={h - 2} rx={w * 0.45} ry={3.5} fill={PAL.shadow} />
          {/* stone base */}
          <rect x={w * 0.14} y={rimY} width={w * 0.72} height={h * 0.5} fill="#7a7068" stroke={PAL.ink} strokeWidth={1.2} />
          {/* mortar lines */}
          {[0, 1, 2].map(row => (
            <line key={`mr${row}`} x1={w * 0.14} y1={rimY + (h * 0.5) * ((row + 1) / 3)} x2={w * 0.86} y2={rimY + (h * 0.5) * ((row + 1) / 3)} stroke={PAL.inkSoft} strokeWidth={0.5} opacity={0.7} />
          ))}
          {[0.3, 0.55, 0.78].map((p, i) => (
            <line key={`mv${i}`} x1={w * p} y1={rimY + h * 0.08} x2={w * (p - 0.02)} y2={rimY + h * 0.25} stroke={PAL.inkSoft} strokeWidth={0.5} opacity={0.6} />
          ))}
          {/* rim */}
          <ellipse cx={cx} cy={rimY} rx={w * 0.36} ry={h * 0.08} fill="#5e564c" stroke={PAL.ink} strokeWidth={1} />
          {/* water surface */}
          <ellipse cx={cx} cy={rimY + 1.2} rx={w * 0.28} ry={h * 0.055} fill="#2f4a5a" stroke={PAL.ink} strokeWidth={0.6} />
          <path d={`M${cx - w*0.18} ${rimY + 1.2} Q${cx} ${rimY - 0.2} ${cx + w*0.18} ${rimY + 1.2}`} stroke="#6c93a8" strokeWidth={0.5} fill="none" opacity={0.85} />
          <ellipse cx={cx - w*0.06} cy={rimY + 1} rx={w*0.04} ry={h*0.015} fill="#9bc0d4" opacity={0.7} />
          {/* roof posts */}
          <rect x={w * 0.16} y={h * 0.1} width={w * 0.05} height={rimY - h * 0.1} fill="#3d2810" stroke={PAL.ink} strokeWidth={0.6} />
          <rect x={w * 0.79} y={h * 0.1} width={w * 0.05} height={rimY - h * 0.1} fill="#3d2810" stroke={PAL.ink} strokeWidth={0.6} />
          {/* roof */}
          <polygon points={`${w*0.06},${h*0.14} ${cx},${h*0.02} ${w*0.94},${h*0.14}`} fill="#5a3820" stroke={PAL.ink} strokeWidth={1.2} />
          <line x1={cx} y1={h*0.04} x2={cx} y2={h*0.14} stroke={PAL.inkSoft} strokeWidth={0.5} opacity={0.7} />
          {/* shingle lines */}
          <line x1={w*0.18} y1={h*0.1} x2={w*0.82} y2={h*0.1} stroke={PAL.inkSoft} strokeWidth={0.4} opacity={0.6} />
          {/* crossbar + rope + bucket */}
          <line x1={w * 0.22} y1={h * 0.17} x2={w * 0.78} y2={h * 0.17} stroke="#3d2810" strokeWidth={1.4} />
          <circle cx={w * 0.78} cy={h * 0.17} r={1} fill="#3a3530" />
          <line x1={cx - w*0.02} y1={h * 0.18} x2={cx - w*0.02} y2={rimY - 1} stroke="#d9c89a" strokeWidth={0.6} />
          {/* bucket hanging just above rim */}
          <rect x={cx - w*0.07} y={rimY - h*0.08} width={w*0.14} height={h*0.09} fill="#6b4a24" stroke={PAL.ink} strokeWidth={0.8} />
          <rect x={cx - w*0.07} y={rimY - h*0.06} width={w*0.14} height={1.2} fill="#3a3530" />
          <rect x={cx - w*0.07} y={rimY - h*0.02} width={w*0.14} height={1.2} fill="#3a3530" />
          <path d={`M${cx - w*0.06} ${rimY - h*0.08} Q${cx} ${rimY - h*0.14} ${cx + w*0.06} ${rimY - h*0.08}`} stroke="#3a3530" strokeWidth={0.6} fill="none" />
        </g>
      );
    }

    case "foraging-camp": {
      // Tent — clearly a triangle on poles, not a house
      return (
        <g>
          <ellipse cx={cx} cy={h - 2} rx={w * 0.45} ry={3} fill={PAL.shadow} />
          {/* support poles */}
          <line x1={w * 0.1} y1={h - 4} x2={cx} y2={h * 0.1} stroke="#3d2810" strokeWidth={1} />
          <line x1={w * 0.9} y1={h - 4} x2={cx} y2={h * 0.1} stroke="#3d2810" strokeWidth={1} />
          {/* canvas */}
          <polygon points={`${w * 0.08},${h - 4} ${cx},${h * 0.15} ${w * 0.92},${h - 4}`}
            fill="#8a6a3a" stroke={PAL.ink} strokeWidth={1.2} />
          {/* center seam */}
          <line x1={cx} y1={h * 0.15} x2={cx} y2={h - 4} stroke={PAL.inkSoft} strokeWidth={0.8} opacity={0.7} />
          {/* opening flap */}
          <polygon points={`${cx - w * 0.1},${h - 4} ${cx},${h * 0.45} ${cx + w * 0.1},${h - 4}`}
            fill="#3d2810" stroke={PAL.ink} strokeWidth={0.8} />
          {/* tip */}
          <circle cx={cx} cy={h * 0.13} r={1.2} fill={PAL.ink} />
        </g>
      );
    }
    case "fence": {
      // Standalone single-tile fence (used as fallback). Connected variants
      // are rendered by <FenceArt> directly in the main map loop.
      return <FenceArt w={w} h={h} connections={{ n: false, e: false, s: false, w: false }} style="natural" />;
    }
    case "palisade": {
      // TOP-DOWN: a ring of sharpened log-ends (circles with point dots).
      // 4-way symmetric — looks the same in any orientation.
      const inset = Math.max(1.2, Math.min(w, h) * 0.1);
      const r = Math.max(1.2, Math.min(w, h) * 0.11);
      // 8 logs around the perimeter
      const slots: Array<[number, number]> = [
        [inset + r, inset + r], [cx, inset + r], [w - inset - r, inset + r],
        [inset + r, h / 2], [w - inset - r, h / 2],
        [inset + r, h - inset - r], [cx, h - inset - r], [w - inset - r, h - inset - r],
      ];
      return (
        <g>
          <rect x={inset} y={inset} width={w - inset * 2} height={h - inset * 2} fill={PAL.shadow} opacity={0.22} />
          {slots.map(([px, py], i) => (
            <g key={i}>
              <circle cx={px} cy={py} r={r} fill="#7a5028" stroke={PAL.ink} strokeWidth={0.6} />
              <circle cx={px} cy={py} r={r * 0.55} fill="#9a6a3a" />
              {/* sharpened point */}
              <circle cx={px} cy={py} r={r * 0.22} fill="#3d2810" />
            </g>
          ))}
        </g>
      );
    }
    case "stone-wall": {
      // TOP-DOWN: tight stone slab pattern, 4-way symmetric. A central
      // mortar cross + corner cobbles read as masonry from above.
      const cy = h / 2;
      const inset = Math.max(0.8, Math.min(w, h) * 0.06);
      const slabW = (w - inset * 2) / 2;
      const slabH = (h - inset * 2) / 2;
      const slabs: Array<[number, number]> = [
        [inset, inset], [inset + slabW, inset],
        [inset, inset + slabH], [inset + slabW, inset + slabH],
      ];
      return (
        <g>
          {/* base */}
          <rect x={inset} y={inset} width={w - inset * 2} height={h - inset * 2} fill="#8a8078" stroke={PAL.ink} strokeWidth={1} />
          {/* 4 stone slabs */}
          {slabs.map(([sx, sy], i) => (
            <rect key={i} x={sx + 0.4} y={sy + 0.4} width={slabW - 0.8} height={slabH - 0.8}
              fill={i % 2 === 0 ? "#968b81" : "#7e756d"} stroke={PAL.inkSoft} strokeWidth={0.4} rx={0.6} />
          ))}
          {/* mortar cross */}
          <line x1={inset} y1={cy} x2={w - inset} y2={cy} stroke={PAL.ink} strokeWidth={0.7} opacity={0.85} />
          <line x1={cx} y1={inset} x2={cx} y2={h - inset} stroke={PAL.ink} strokeWidth={0.7} opacity={0.85} />
          {/* highlight pebbles */}
          <circle cx={inset + slabW * 0.5} cy={inset + slabH * 0.5} r={0.7} fill="#b0a89e" opacity={0.7} />
          <circle cx={w - inset - slabW * 0.5} cy={h - inset - slabH * 0.5} r={0.7} fill="#b0a89e" opacity={0.7} />
        </g>
      );
    }
    case "gate": {
      // TOP-DOWN: stone frame around the four corners + a heavy timber door
      // panel across the middle with an iron ring. Symmetric across both
      // axes so it sits in any wall run.
      const inset = Math.max(0.8, Math.min(w, h) * 0.06);
      const pillar = Math.max(2.4, Math.min(w, h) * 0.22);
      const cy = h / 2;
      return (
        <g>
          {/* 4 stone corner pillars */}
          <rect x={inset} y={inset} width={pillar} height={pillar} fill="#8a8078" stroke={PAL.ink} strokeWidth={0.8} rx={0.5} />
          <rect x={w - inset - pillar} y={inset} width={pillar} height={pillar} fill="#8a8078" stroke={PAL.ink} strokeWidth={0.8} rx={0.5} />
          <rect x={inset} y={h - inset - pillar} width={pillar} height={pillar} fill="#8a8078" stroke={PAL.ink} strokeWidth={0.8} rx={0.5} />
          <rect x={w - inset - pillar} y={h - inset - pillar} width={pillar} height={pillar} fill="#8a8078" stroke={PAL.ink} strokeWidth={0.8} rx={0.5} />
          {/* timber door slab in the middle (square so orientation is moot) */}
          <rect x={cx - pillar * 0.9} y={cy - pillar * 0.9} width={pillar * 1.8} height={pillar * 1.8}
            fill="#5a3820" stroke={PAL.ink} strokeWidth={0.9} rx={0.6} />
          {/* plank seam — show both axes so it reads as a door from any side */}
          <line x1={cx - pillar * 0.9} y1={cy} x2={cx + pillar * 0.9} y2={cy} stroke={PAL.inkSoft} strokeWidth={0.5} opacity={0.7} />
          <line x1={cx} y1={cy - pillar * 0.9} x2={cx} y2={cy + pillar * 0.9} stroke={PAL.inkSoft} strokeWidth={0.5} opacity={0.7} />
          {/* iron ring */}
          <circle cx={cx} cy={cy} r={pillar * 0.32} fill="none" stroke="#2a2520" strokeWidth={0.9} />
          <circle cx={cx} cy={cy} r={pillar * 0.14} fill="#3a3530" />
        </g>
      );
    }
    case "watchtower": {
      // Tall scaffolded tower with platform + roof
      const baseY = h - 2;
      const platY = h * 0.42;
      const roofY = h * 0.12;
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.45} ry={2.5} fill={PAL.shadow} />
          {/* legs */}
          <line x1={w * 0.22} y1={baseY} x2={w * 0.32} y2={platY} stroke="#5a3820" strokeWidth={1.4} />
          <line x1={w * 0.78} y1={baseY} x2={w * 0.68} y2={platY} stroke="#5a3820" strokeWidth={1.4} />
          <line x1={w * 0.32} y1={platY} x2={w * 0.22} y2={baseY} stroke={PAL.ink} strokeWidth={0.4} />
          {/* cross braces */}
          <line x1={w * 0.22} y1={baseY} x2={w * 0.68} y2={platY} stroke="#7a5028" strokeWidth={0.8} opacity={0.8} />
          <line x1={w * 0.78} y1={baseY} x2={w * 0.32} y2={platY} stroke="#7a5028" strokeWidth={0.8} opacity={0.8} />
          {/* platform */}
          <rect x={w * 0.18} y={platY} width={w * 0.64} height={h * 0.08} fill="#7a5028" stroke={PAL.ink} strokeWidth={1} />
          {/* railing posts */}
          <rect x={w * 0.22} y={platY - h * 0.12} width={1.2} height={h * 0.12} fill="#3d2810" />
          <rect x={w * 0.5 - 0.6} y={platY - h * 0.12} width={1.2} height={h * 0.12} fill="#3d2810" />
          <rect x={w * 0.78 - 1.2} y={platY - h * 0.12} width={1.2} height={h * 0.12} fill="#3d2810" />
          <line x1={w * 0.22} y1={platY - h * 0.06} x2={w * 0.78} y2={platY - h * 0.06} stroke="#5a3820" strokeWidth={0.8} />
          {/* roof */}
          <polygon points={`${w * 0.16},${platY - h * 0.12} ${cx},${roofY} ${w * 0.84},${platY - h * 0.12}`} fill="#5a3820" stroke={PAL.ink} strokeWidth={1.2} />
          <line x1={cx} y1={roofY + 1.5} x2={cx} y2={platY - h * 0.12} stroke={PAL.inkSoft} strokeWidth={0.5} opacity={0.6} />
          {/* flag */}
          <line x1={cx} y1={roofY} x2={cx} y2={roofY - h * 0.08} stroke={PAL.ink} strokeWidth={0.6} />
          <polygon points={`${cx},${roofY - h * 0.08} ${cx + w * 0.12},${roofY - h * 0.06} ${cx},${roofY - h * 0.03}`} fill="#a83a3a" stroke={PAL.ink} strokeWidth={0.4} />
        </g>
      );
    }
    case "guard-post": {
      // Small shack with a window and torch
      const wallY = h * 0.38;
      return (
        <g>
          <ellipse cx={cx} cy={h - 2} rx={w * 0.45} ry={2.5} fill={PAL.shadow} />
          {/* wall */}
          <rect x={w * 0.18} y={wallY} width={w * 0.64} height={h - wallY - 2} fill="#7a5028" stroke={PAL.ink} strokeWidth={1.1} />
          {/* plank lines */}
          <line x1={w * 0.2} y1={wallY + (h - wallY) * 0.5} x2={w * 0.8} y2={wallY + (h - wallY) * 0.5} stroke={PAL.inkSoft} strokeWidth={0.5} opacity={0.6} />
          {/* window */}
          <rect x={cx - w * 0.1} y={wallY + h * 0.08} width={w * 0.2} height={h * 0.14} fill="#1f2a30" stroke={PAL.ink} strokeWidth={0.8} />
          <line x1={cx} y1={wallY + h * 0.08} x2={cx} y2={wallY + h * 0.22} stroke={PAL.inkSoft} strokeWidth={0.4} />
          <line x1={cx - w * 0.1} y1={wallY + h * 0.15} x2={cx + w * 0.1} y2={wallY + h * 0.15} stroke={PAL.inkSoft} strokeWidth={0.4} />
          {/* slanted roof */}
          <polygon points={`${w * 0.12},${wallY + 1} ${cx},${h * 0.08} ${w * 0.88},${wallY + 1}`} fill="#5a3820" stroke={PAL.ink} strokeWidth={1.1} />
          {/* torch on the side */}
          <line x1={w * 0.86} y1={wallY + h * 0.05} x2={w * 0.94} y2={wallY - h * 0.05} stroke="#3d2810" strokeWidth={1} />
          <circle cx={w * 0.95} cy={wallY - h * 0.07} r={1.4} fill="#e8a04a" stroke={PAL.ink} strokeWidth={0.4} />
          <circle cx={w * 0.95} cy={wallY - h * 0.08} r={0.7} fill="#f5d98a" />
        </g>
      );
    }
    // ── Housing: tent variants ────────────────────────────────────
    case "tent":
    case "family-tent": {
      const big = kind === "family-tent";
      const pad = Math.max(1.5, w * 0.08);
      const yx = pad, yy = pad;
      const yw = w - pad * 2, yh = h - pad * 2;
      const peakX = yx + yw / 2;
      const peakY = yy + yh * 0.08;
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.45} ry={2.5} fill={PAL.shadow} />
          {/* trampled dirt yard */}
          <rect x={yx} y={yy} width={yw} height={yh} rx={2} fill="#5a4a2a" stroke={PAL.ink} strokeWidth={0.6} opacity={0.7} />
          {/* tent body — diamond top-down */}
          <polygon points={`${peakX},${peakY} ${yx + yw - pad * 0.5},${yy + yh * 0.5} ${peakX},${yy + yh - pad * 0.5} ${yx + pad * 0.5},${yy + yh * 0.5}`}
            fill={big ? "#a87a3e" : "#8a6a3a"} stroke={PAL.ink} strokeWidth={1.1} />
          {/* ridge seams from peak */}
          <line x1={peakX} y1={peakY} x2={yx + pad * 0.5} y2={yy + yh * 0.5} stroke={PAL.inkSoft} strokeWidth={0.6} opacity={0.75} />
          <line x1={peakX} y1={peakY} x2={yx + yw - pad * 0.5} y2={yy + yh * 0.5} stroke={PAL.inkSoft} strokeWidth={0.6} opacity={0.75} />
          <line x1={peakX} y1={peakY} x2={peakX} y2={yy + yh - pad * 0.5} stroke={PAL.inkSoft} strokeWidth={0.6} opacity={0.75} />
          {/* shaded half */}
          <polygon points={`${peakX},${peakY} ${peakX},${yy + yh - pad * 0.5} ${yx + pad * 0.5},${yy + yh * 0.5}`}
            fill="#000" opacity={0.18} />
          {/* door flap on south */}
          <polygon points={`${peakX - w * 0.07},${yy + yh - pad * 0.5} ${peakX},${yy + yh * 0.62} ${peakX + w * 0.07},${yy + yh - pad * 0.5}`}
            fill="#3d2810" stroke={PAL.ink} strokeWidth={0.5} />
          {/* tent peg dots */}
          {[[yx, yy], [yx + yw, yy], [yx, yy + yh], [yx + yw, yy + yh]].map(([px, py], i) => (
            <circle key={i} cx={px} cy={py} r={0.7} fill={PAL.ink} />
          ))}
          {/* second tent if family */}
          {big && (
            <circle cx={peakX} cy={peakY} r={1.4} fill="#d4a93a" stroke={PAL.ink} strokeWidth={0.4} />
          )}
        </g>
      );
    }

    // ── Housing: cabin variants ───────────────────────────────────
    case "cabin":
    case "family-cabin":
    case "guest-house": {
      const pad = Math.max(1.5, w * 0.06);
      const yx = pad, yy = pad;
      const yw = w - pad * 2, yh = h - pad * 2;
      const wallY = yy + yh * 0.32;
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.45} ry={3} fill={PAL.shadow} />
          {/* yard */}
          <rect x={yx} y={yy} width={yw} height={yh} rx={2} fill="#566432" stroke={PAL.ink} strokeWidth={0.6} opacity={0.75} />
          {/* log walls */}
          <rect x={yx + pad * 0.3} y={wallY} width={yw - pad * 0.6} height={yh - (wallY - yy) - pad * 0.3}
            fill="#8a5a30" stroke={PAL.ink} strokeWidth={1} />
          {/* log seams */}
          {[0.55, 0.72, 0.88].map((t, i) => (
            <line key={i} x1={yx + pad * 0.5} y1={yy + yh * t}
              x2={yx + yw - pad * 0.5} y2={yy + yh * t} stroke={PAL.inkSoft} strokeWidth={0.4} opacity={0.55} />
          ))}
          {/* door */}
          <rect x={cx - w * 0.06} y={yy + yh * 0.74} width={w * 0.12} height={yh * 0.24}
            fill="#3d2810" stroke={PAL.ink} strokeWidth={0.5} />
          {/* small window */}
          <rect x={cx - w * 0.22} y={yy + yh * 0.5} width={w * 0.1} height={yh * 0.1}
            fill="#d9c98a" stroke={PAL.ink} strokeWidth={0.4} />
          {/* pitched roof */}
          <polygon points={`${yx},${wallY + 1} ${cx},${yy + 0.5} ${yx + yw},${wallY + 1}`}
            fill="#4a2f18" stroke={PAL.ink} strokeWidth={1.1} />
          <polygon points={`${yx + 1.2},${wallY} ${cx},${yy + 2.5} ${yx + yw - 1.2},${wallY}`}
            fill="#5a3820" opacity={0.55} />
          <line x1={cx} y1={yy + 0.5} x2={cx} y2={wallY} stroke="#2a1808" strokeWidth={0.6} opacity={0.7} />
          {/* chimney */}
          <rect x={yx + yw * 0.7} y={yy + yh * 0.05} width={w * 0.07} height={yh * 0.22}
            fill="#6e6258" stroke={PAL.ink} strokeWidth={0.5} />
        </g>
      );
    }

    // ── Housing: house variants ───────────────────────────────────
    case "house":
    case "family-house":
    case "large-house":
    case "orphan-house":
    case "elder-house": {
      const big = kind === "large-house" || kind === "orphan-house";
      const pad = Math.max(1.5, w * 0.05);
      const yx = pad, yy = pad;
      const yw = w - pad * 2, yh = h - pad * 2;
      const wallY = yy + yh * 0.3;
      const porchH = yh * 0.12;
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.46} ry={3} fill={PAL.shadow} />
          {/* yard */}
          <rect x={yx} y={yy} width={yw} height={yh} rx={2}
            fill={big ? "#566432" : "#5e6a36"} stroke={PAL.ink} strokeWidth={0.6} opacity={0.75} />
          {/* walls */}
          <rect x={yx + pad * 0.4} y={wallY} width={yw - pad * 0.8} height={yh - (wallY - yy) - porchH - pad * 0.2}
            fill={big ? "#b0784a" : "#9a6c40"} stroke={PAL.ink} strokeWidth={1} />
          {/* clapboard seams */}
          {[0.5, 0.62, 0.74].map((t, i) => (
            <line key={i} x1={yx + pad * 0.6} y1={yy + yh * t}
              x2={yx + yw - pad * 0.6} y2={yy + yh * t}
              stroke={PAL.inkSoft} strokeWidth={0.35} opacity={0.45} />
          ))}
          {/* porch */}
          <rect x={yx + yw * 0.2} y={yy + yh - porchH - pad * 0.2} width={yw * 0.6} height={porchH}
            fill="#a87a3e" stroke={PAL.ink} strokeWidth={0.7} />
          {/* porch posts */}
          <rect x={yx + yw * 0.21} y={yy + yh - porchH - pad * 0.6} width={1} height={porchH + pad * 0.4} fill="#5a3820" />
          <rect x={yx + yw * 0.79 - 1} y={yy + yh - porchH - pad * 0.6} width={1} height={porchH + pad * 0.4} fill="#5a3820" />
          {/* door */}
          <rect x={cx - w * 0.06} y={yy + yh - porchH - pad * 0.2 - yh * 0.18} width={w * 0.12} height={yh * 0.18}
            fill="#3d2810" stroke={PAL.ink} strokeWidth={0.5} />
          {/* windows */}
          {[0.22, 0.78].map((t, i) => (
            <g key={i}>
              <rect x={yx + yw * t - w * 0.06} y={yy + yh * 0.45} width={w * 0.12} height={yh * 0.12}
                fill="#d9c98a" stroke={PAL.ink} strokeWidth={0.4} />
              <line x1={yx + yw * t} y1={yy + yh * 0.45} x2={yx + yw * t} y2={yy + yh * 0.57} stroke={PAL.ink} strokeWidth={0.3} />
            </g>
          ))}
          {/* hipped roof */}
          <polygon points={`${yx - 0.5},${wallY + 0.5} ${yx + yw * 0.18},${yy} ${yx + yw * 0.82},${yy} ${yx + yw + 0.5},${wallY + 0.5}`}
            fill="#4a2f18" stroke={PAL.ink} strokeWidth={1.1} />
          <polygon points={`${yx + 1},${wallY - 0.2} ${yx + yw * 0.2},${yy + 1.5} ${yx + yw * 0.8},${yy + 1.5} ${yx + yw - 1},${wallY - 0.2}`}
            fill="#5a3820" opacity={0.55} />
          <line x1={yx + yw * 0.18} y1={yy} x2={yx + yw * 0.82} y2={yy}
            stroke="#2a1808" strokeWidth={0.9} strokeLinecap="round" />
          {/* shingle hint */}
          {[0.08, 0.16].map((t, i) => (
            <line key={i} x1={yx} y1={wallY - yh * t} x2={yx + yw} y2={wallY - yh * t}
              stroke="#2a1808" strokeWidth={0.3} opacity={0.4} />
          ))}
          {/* chimney */}
          <rect x={yx + yw * 0.74} y={yy - yh * 0.06} width={w * 0.08} height={yh * 0.2}
            fill="#6e6258" stroke={PAL.ink} strokeWidth={0.5} />
          <rect x={yx + yw * 0.73} y={yy - yh * 0.08} width={w * 0.1} height={yh * 0.03} fill="#3d2810" />
        </g>
      );
    }

    // ── Housing: manor variants ───────────────────────────────────
    case "manor":
    case "founder-manor": {
      const founder = kind === "founder-manor";
      const pad = Math.max(1.5, w * 0.05);
      const yx = pad, yy = pad;
      const yw = w - pad * 2, yh = h - pad * 2;
      const wallY = yy + yh * 0.28;
      const porchH = yh * 0.16;
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.47} ry={3.2} fill={PAL.shadow} />
          {/* manicured yard */}
          <rect x={yx} y={yy} width={yw} height={yh} rx={2}
            fill="#62763a" stroke={PAL.ink} strokeWidth={0.7} opacity={0.85} />
          <rect x={yx + 1} y={yy + 1} width={yw - 2} height={yh - 2} rx={1.5}
            fill="#6e8442" opacity={0.5} />
          {/* path to porch */}
          <rect x={cx - w * 0.04} y={yy + yh * 0.62} width={w * 0.08} height={yh * 0.38}
            fill="#c9a06a" stroke="#8a5a30" strokeWidth={0.4} />
          {/* wraparound porch */}
          <rect x={yx + yw * 0.08} y={yy + yh - porchH - pad * 0.2} width={yw * 0.84} height={porchH}
            fill="#a87a3e" stroke={PAL.ink} strokeWidth={0.8} />
          {/* porch posts */}
          {[0.1, 0.32, 0.5, 0.68, 0.9].map((t, i) => (
            <rect key={i} x={yx + yw * t - 0.6} y={yy + yh - porchH - pad * 0.7} width={1.2} height={porchH + pad * 0.5}
              fill="#5a3820" stroke={PAL.ink} strokeWidth={0.3} />
          ))}
          {/* main walls */}
          <rect x={yx + yw * 0.1} y={wallY} width={yw * 0.8} height={(yy + yh - porchH - pad * 0.2) - wallY}
            fill={founder ? "#c08854" : "#a87642"} stroke={PAL.ink} strokeWidth={1.1} />
          {/* clapboard seams */}
          {[0.42, 0.52, 0.62, 0.72].map((t, i) => (
            <line key={i} x1={yx + yw * 0.12} y1={yy + yh * t} x2={yx + yw * 0.88} y2={yy + yh * t}
              stroke={PAL.inkSoft} strokeWidth={0.4} opacity={0.5} />
          ))}
          {/* double door */}
          <rect x={cx - w * 0.08} y={yy + yh - porchH - pad * 0.2 - yh * 0.2} width={w * 0.16} height={yh * 0.2}
            fill="#3d2810" stroke={PAL.ink} strokeWidth={0.6} />
          <line x1={cx} y1={yy + yh - porchH - pad * 0.2 - yh * 0.2} x2={cx} y2={yy + yh - porchH - pad * 0.2}
            stroke={PAL.inkSoft} strokeWidth={0.5} />
          {/* windows — 4 across upper half */}
          {[0.2, 0.4, 0.6, 0.8].map((t, i) => (
            <g key={i}>
              <rect x={yx + yw * t - w * 0.05} y={yy + yh * 0.4} width={w * 0.1} height={yh * 0.12}
                fill="#d9c98a" stroke={PAL.ink} strokeWidth={0.4} />
              <line x1={yx + yw * t} y1={yy + yh * 0.4} x2={yx + yw * t} y2={yy + yh * 0.52} stroke={PAL.ink} strokeWidth={0.3} />
              <line x1={yx + yw * t - w * 0.05} y1={yy + yh * 0.46} x2={yx + yw * t + w * 0.05} y2={yy + yh * 0.46} stroke={PAL.ink} strokeWidth={0.3} />
            </g>
          ))}
          {/* hipped roof */}
          <polygon points={`${yx + yw * 0.04},${wallY + 0.5} ${yx + yw * 0.2},${yy} ${yx + yw * 0.8},${yy} ${yx + yw * 0.96},${wallY + 0.5}`}
            fill={founder ? "#5a2f18" : "#4a2f18"} stroke={PAL.ink} strokeWidth={1.2} />
          <polygon points={`${yx + yw * 0.06},${wallY} ${yx + yw * 0.22},${yy + 1.5} ${yx + yw * 0.78},${yy + 1.5} ${yx + yw * 0.94},${wallY}`}
            fill="#6b3a1f" opacity={0.55} />
          <line x1={yx + yw * 0.2} y1={yy} x2={yx + yw * 0.8} y2={yy}
            stroke="#2a1808" strokeWidth={1.1} strokeLinecap="round" />
          {/* shingle bands */}
          {[0.05, 0.1, 0.15, 0.2].map((t, i) => (
            <line key={i} x1={yx + yw * 0.04} y1={wallY - yh * t} x2={yx + yw * 0.96} y2={wallY - yh * t}
              stroke="#2a1808" strokeWidth={0.3} opacity={0.45} />
          ))}
          {/* twin chimneys */}
          <rect x={yx + yw * 0.18} y={yy - yh * 0.06} width={w * 0.07} height={yh * 0.18}
            fill="#6e6258" stroke={PAL.ink} strokeWidth={0.5} />
          <rect x={yx + yw * 0.75} y={yy - yh * 0.06} width={w * 0.07} height={yh * 0.18}
            fill="#6e6258" stroke={PAL.ink} strokeWidth={0.5} />
          {/* founder accent: flag on roof ridge */}
          {founder && (
            <g>
              <line x1={cx} y1={yy} x2={cx} y2={yy - yh * 0.18} stroke={PAL.ink} strokeWidth={0.7} />
              <polygon points={`${cx},${yy - yh * 0.18} ${cx + w * 0.1},${yy - yh * 0.14} ${cx},${yy - yh * 0.1}`}
                fill="#a83a3a" stroke={PAL.ink} strokeWidth={0.4} />
            </g>
          )}
        </g>
      );
    }

    // ── Bunkhouse: long low building with multiple doors ──────────
    case "bunkhouse": {
      const pad = Math.max(1.5, w * 0.04);
      const yx = pad, yy = pad;
      const yw = w - pad * 2, yh = h - pad * 2;
      const wallY = yy + yh * 0.35;
      const doors = 3;
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.47} ry={3} fill={PAL.shadow} />
          <rect x={yx} y={yy} width={yw} height={yh} rx={2} fill="#5a6a32" stroke={PAL.ink} strokeWidth={0.6} opacity={0.7} />
          {/* walls */}
          <rect x={yx + pad * 0.3} y={wallY} width={yw - pad * 0.6} height={yh - (wallY - yy) - pad * 0.3}
            fill="#8a5a30" stroke={PAL.ink} strokeWidth={1} />
          {/* plank seams */}
          {[0.55, 0.7, 0.85].map((t, i) => (
            <line key={i} x1={yx + pad * 0.5} y1={yy + yh * t}
              x2={yx + yw - pad * 0.5} y2={yy + yh * t} stroke={PAL.inkSoft} strokeWidth={0.4} opacity={0.55} />
          ))}
          {/* doors */}
          {Array.from({ length: doors }).map((_, i) => {
            const t = (i + 1) / (doors + 1);
            return (
              <rect key={i} x={yx + yw * t - w * 0.04} y={yy + yh * 0.78}
                width={w * 0.08} height={yh * 0.2} fill="#3d2810" stroke={PAL.ink} strokeWidth={0.4} />
            );
          })}
          {/* slanted long roof */}
          <polygon points={`${yx},${wallY + 0.5} ${yx + yw * 0.1},${yy} ${yx + yw * 0.9},${yy} ${yx + yw},${wallY + 0.5}`}
            fill="#4a2f18" stroke={PAL.ink} strokeWidth={1.1} />
          <line x1={yx + yw * 0.1} y1={yy} x2={yx + yw * 0.9} y2={yy}
            stroke="#2a1808" strokeWidth={0.9} strokeLinecap="round" />
        </g>
      );
    }

    // ── Livestock pens: grassy yard + plank fence + corner shed/trough ─
    case "chicken-coop":
    case "goat-pen":
    case "sheep-pen":
    case "cattle-pasture": {
      const pad = Math.max(1.2, w * 0.04);
      const yx = pad, yy = pad;
      const yw = w - pad * 2, yh = h - pad * 2;
      const grass = kind === "chicken-coop" ? "#8aa64a"
        : kind === "goat-pen" ? "#94a648"
        : kind === "sheep-pen" ? "#9bb058"
        : "#7d9a3e";
      const grassDark = "#5e7a2e";
      // shed dims (top-left corner)
      const shedW = Math.max(6, yw * (kind === "chicken-coop" ? 0.45 : kind === "cattle-pasture" ? 0.28 : 0.34));
      const shedH = Math.max(5, yh * (kind === "chicken-coop" ? 0.55 : 0.42));
      const shedRoofY = yy + shedH * 0.42;
      // trough dims (opposite corner)
      const trW = Math.max(4, yw * 0.28);
      const trH = Math.max(1.6, yh * 0.10);
      const trX = yx + yw - trW - 1;
      const trY = yy + yh - trH - 1.5;
      // posts at corners + midpoints
      const posts: [number, number][] = [
        [yx, yy], [yx + yw, yy], [yx, yy + yh], [yx + yw, yy + yh],
        [yx + yw / 2, yy], [yx + yw / 2, yy + yh],
        [yx, yy + yh / 2], [yx + yw, yy + yh / 2],
      ];
      // grass tufts deterministic
      const tufts: { x: number; y: number; r: number }[] = [];
      const seedN = kind.charCodeAt(0) + Math.floor(w * 7 + h * 13);
      const tuftCount = Math.floor(yw * yh / 9);
      for (let i = 0; i < tuftCount; i++) {
        const r1 = ((seedN * (i + 1) * 9301 + 49297) % 233280) / 233280;
        const r2 = ((seedN * (i + 1) * 1597 + 51749) % 233280) / 233280;
        const x = yx + 2 + r1 * (yw - 4);
        const y = yy + 2 + r2 * (yh - 4);
        // skip if under shed or trough
        if (x < yx + shedW && y < yy + shedH) continue;
        if (x > trX - 1 && y > trY - 1) continue;
        tufts.push({ x, y, r: 0.35 + r1 * 0.5 });
      }
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.47} ry={3} fill={PAL.shadow} />
          {/* grassy yard */}
          <rect x={yx} y={yy} width={yw} height={yh} fill={grass} stroke={PAL.ink} strokeWidth={0.8} />
          {/* tufts */}
          {tufts.map((t, i) => (
            <circle key={`t${i}`} cx={t.x} cy={t.y} r={t.r} fill={grassDark} opacity={0.7} />
          ))}
          {/* trough (water for goats/cattle/sheep) or feed for chickens */}
          <rect x={trX} y={trY} width={trW} height={trH}
            fill={kind === "chicken-coop" ? "#8a5a30" : "#4a3018"}
            stroke={PAL.ink} strokeWidth={0.5} />
          {kind !== "chicken-coop" && (
            <rect x={trX + 0.6} y={trY + 0.4} width={trW - 1.2} height={trH - 0.8}
              fill="#5589a6" opacity={0.85} />
          )}
          {kind === "chicken-coop" && (
            <line x1={trX + 0.6} y1={trY + trH / 2} x2={trX + trW - 0.6} y2={trY + trH / 2}
              stroke="#d4a83a" strokeWidth={0.6} />
          )}
          {/* shed: wood walls + pitched dark roof */}
          <rect x={yx + 0.5} y={shedRoofY} width={shedW} height={yy + shedH - shedRoofY}
            fill="#8a5a30" stroke={PAL.ink} strokeWidth={0.7} />
          <polygon points={`${yx + 0.5},${shedRoofY + 0.4} ${yx + shedW * 0.18},${yy + 0.6} ${yx + shedW * 0.85},${yy + 0.6} ${yx + shedW + 0.5},${shedRoofY + 0.4}`}
            fill="#4a2818" stroke={PAL.ink} strokeWidth={0.8} />
          {/* shed door */}
          <rect x={yx + shedW * 0.42} y={shedRoofY + (yy + shedH - shedRoofY) * 0.35}
            width={shedW * 0.22} height={(yy + shedH - shedRoofY) * 0.65}
            fill="#3d2810" stroke={PAL.ink} strokeWidth={0.3} />
          {/* species accent on shed (small icon) */}
          {kind === "chicken-coop" && (
            <circle cx={yx + shedW * 0.78} cy={shedRoofY + 1.2} r={0.6} fill="#3d2810" />
          )}
          {/* fence rails (two horizontal-ish on each side) */}
          {[yy, yy + yh].map((py, i) => (
            <g key={`hr${i}`}>
              <line x1={yx} y1={py} x2={yx + yw} y2={py} stroke="#8a5a30" strokeWidth={0.9} />
              <line x1={yx} y1={py + (i === 0 ? 0.9 : -0.9)} x2={yx + yw} y2={py + (i === 0 ? 0.9 : -0.9)}
                stroke="#8a5a30" strokeWidth={0.7} opacity={0.8} />
            </g>
          ))}
          {[yx, yx + yw].map((px, i) => (
            <g key={`vr${i}`}>
              <line x1={px} y1={yy} x2={px} y2={yy + yh} stroke="#8a5a30" strokeWidth={0.9} />
              <line x1={px + (i === 0 ? 0.9 : -0.9)} y1={yy} x2={px + (i === 0 ? 0.9 : -0.9)} y2={yy + yh}
                stroke="#8a5a30" strokeWidth={0.7} opacity={0.8} />
            </g>
          ))}
          {/* gate gap on bottom edge */}
          <line x1={yx + yw * 0.45} y1={yy + yh} x2={yx + yw * 0.55} y2={yy + yh}
            stroke={grass} strokeWidth={2} />
          {/* fence posts */}
          {posts.map(([px, py], i) => (
            <rect key={`p${i}`} x={px - 0.7} y={py - 0.7} width={1.4} height={1.4}
              fill="#4a2f18" stroke={PAL.ink} strokeWidth={0.3} />
          ))}
        </g>
      );
    }

    // ── Orchard: rows of fruit trees, stage-aware via farmGrowth ─────
    case "orchard": {
      const pad = Math.max(1.2, w * 0.04);
      const yx = pad, yy = pad;
      const yw = w - pad * 2, yh = h - pad * 2;
      const stage = farmStage ?? "growing";
      const growth = Math.max(0, Math.min(1, farmGrowth ?? 0.5));
      const cols = Math.max(3, Math.round(w / 8));
      const rows = Math.max(3, Math.round(h / 8));
      const trees: { x: number; y: number }[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          trees.push({
            x: yx + (yw / cols) * (c + 0.5),
            y: yy + (yh / rows) * (r + 0.5),
          });
        }
      }
      const canopyR = Math.min(yw / cols, yh / rows) * 0.36 * (0.55 + growth * 0.45);
      const hasFruit = stage === "mature" || stage === "harvesting";
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.47} ry={3} fill={PAL.shadow} />
          <rect x={yx} y={yy} width={yw} height={yh} fill="#7a9947" stroke={PAL.ink} strokeWidth={0.7} />
          {/* tilled rows between trees */}
          {Array.from({ length: rows + 1 }).map((_, i) => (
            <line key={`row${i}`} x1={yx + 1} y1={yy + (yh / rows) * i}
              x2={yx + yw - 1} y2={yy + (yh / rows) * i}
              stroke="#5e7a2e" strokeWidth={0.4} opacity={0.65} />
          ))}
          {trees.map((t, i) => (
            <g key={`tr${i}`}>
              {/* trunk shadow */}
              <ellipse cx={t.x} cy={t.y + canopyR * 0.85} rx={canopyR * 0.9} ry={canopyR * 0.25}
                fill={PAL.shadow} />
              {/* trunk */}
              <rect x={t.x - 0.5} y={t.y - canopyR * 0.2} width={1} height={canopyR * 0.9}
                fill="#4a2f18" />
              {/* canopy */}
              <circle cx={t.x} cy={t.y - canopyR * 0.1} r={canopyR}
                fill={stage === "empty" || stage === "planting" ? "#5e7a2e" : "#4a6235"}
                stroke={PAL.ink} strokeWidth={0.45} />
              <circle cx={t.x - canopyR * 0.3} cy={t.y - canopyR * 0.35} r={canopyR * 0.5}
                fill="#566e3e" opacity={0.85} />
              {/* fruit dots */}
              {hasFruit && (
                <>
                  <circle cx={t.x + canopyR * 0.35} cy={t.y - canopyR * 0.05} r={0.7} fill="#c44a3a" />
                  <circle cx={t.x - canopyR * 0.2} cy={t.y - canopyR * 0.25} r={0.6} fill="#d96a3a" />
                  <circle cx={t.x + canopyR * 0.1} cy={t.y - canopyR * 0.45} r={0.55} fill="#c44a3a" />
                </>
              )}
            </g>
          ))}
          {/* fence */}
          <rect x={yx} y={yy} width={yw} height={yh} fill="none" stroke="#5a3a1c" strokeWidth={0.6} />
        </g>
      );
    }

    // ── Large field: many furrows + crop rows, stage-aware ───────────
    case "large-field": {
      const pad = Math.max(1.2, w * 0.03);
      const yx = pad, yy = pad;
      const yw = w - pad * 2, yh = h - pad * 2;
      const stage = farmStage ?? "growing";
      const growth = Math.max(0, Math.min(1, farmGrowth ?? 0.5));
      const rows = Math.max(6, Math.round(h / 4));
      const cropColor = stage === "mature" ? "#d4a83a"
        : stage === "harvesting" ? "#a7843a"
        : "#566e3e";
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.47} ry={3} fill={PAL.shadow} />
          <rect x={yx} y={yy} width={yw} height={yh}
            fill={stage === "empty" ? "#6e4920" : "#5a3818"} stroke={PAL.ink} strokeWidth={0.8} />
          {Array.from({ length: rows }).map((_, i) => {
            const ry = yy + (yh / rows) * (i + 0.5);
            return (
              <g key={`fr${i}`}>
                <line x1={yx + 1} y1={ry} x2={yx + yw - 1} y2={ry}
                  stroke="#3d2810" strokeWidth={0.9} />
                {stage !== "empty" && stage !== "planting" && (
                  <line x1={yx + 1} y1={ry - 0.6 - growth * 0.6} x2={yx + yw - 1} y2={ry - 0.6 - growth * 0.6}
                    stroke={cropColor} strokeWidth={0.7 + growth * 0.6} opacity={0.9} />
                )}
              </g>
            );
          })}
          {/* corner posts */}
          {[[yx, yy], [yx + yw, yy], [yx, yy + yh], [yx + yw, yy + yh]].map(([px, py], i) => (
            <rect key={i} x={px - 0.7} y={py - 0.7} width={1.4} height={1.4} fill="#3d2810" />
          ))}
        </g>
      );
    }

    // ── Greenhouse: glass pitched roof over rows ─────────────────────
    case "greenhouse": {
      const pad = Math.max(1.2, w * 0.05);
      const yx = pad, yy = pad;
      const yw = w - pad * 2, yh = h - pad * 2;
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.47} ry={3} fill={PAL.shadow} />
          {/* base soil */}
          <rect x={yx} y={yy} width={yw} height={yh} fill="#5a3818" stroke={PAL.ink} strokeWidth={0.8} />
          {/* glass roof panes */}
          <rect x={yx + 0.5} y={yy + 0.5} width={yw - 1} height={yh - 1}
            fill="#a8d4d6" opacity={0.55} stroke={PAL.ink} strokeWidth={0.5} />
          {/* roof ridge */}
          <line x1={yx + yw / 2} y1={yy + 0.5} x2={yx + yw / 2} y2={yy + yh - 0.5}
            stroke="#3d2810" strokeWidth={1} />
          {/* mullions */}
          {[0.2, 0.4, 0.6, 0.8].map((t, i) => (
            <g key={`m${i}`}>
              <line x1={yx + yw * t} y1={yy + 0.5} x2={yx + yw * t} y2={yy + yh - 0.5}
                stroke="#3d2810" strokeWidth={0.4} opacity={0.7} />
            </g>
          ))}
          {[0.33, 0.66].map((t, i) => (
            <line key={`mh${i}`} x1={yx + 0.5} y1={yy + yh * t} x2={yx + yw - 0.5} y2={yy + yh * t}
              stroke="#3d2810" strokeWidth={0.4} opacity={0.7} />
          ))}
          {/* highlight glints */}
          <line x1={yx + yw * 0.15} y1={yy + yh * 0.15} x2={yx + yw * 0.3} y2={yy + yh * 0.3}
            stroke="#ffffff" strokeWidth={0.6} opacity={0.55} />
          <line x1={yx + yw * 0.6} y1={yy + yh * 0.1} x2={yx + yw * 0.72} y2={yy + yh * 0.2}
            stroke="#ffffff" strokeWidth={0.5} opacity={0.45} />
          {/* door */}
          <rect x={yx + yw * 0.44} y={yy + yh - 2.2} width={yw * 0.12} height={2}
            fill="#4a2f18" stroke={PAL.ink} strokeWidth={0.4} />
        </g>
      );
    }

    default:
      return <rect x={2} y={2} width={w - 4} height={h - 4} fill="#6b4a24" stroke={PAL.ink} strokeWidth={1} />;
  }
}

// ── Hand-drawn resource node ────────────────────────────────────
function NodeArt({ kind, size, seed }: { kind: string; size: number; seed: number }) {
  const s = size;
  if (kind === "trees") {
    // Stylized tree — shaded canopy with NW highlight + SE shadow + trunk
    const variant = seed % 3;
    return (
      <g>
        <ellipse cx={s / 2} cy={s * 0.92} rx={s * 0.32} ry={s * 0.07} fill={PAL.shadow} />
        <rect x={s * 0.46} y={s * 0.62} width={s * 0.08} height={s * 0.3} fill="#3d2810" stroke={PAL.ink} strokeWidth={0.6} />
        <rect x={s * 0.46} y={s * 0.62} width={s * 0.025} height={s * 0.3} fill="#5a3820" opacity={0.7} />
        {variant === 0 ? (
          <g>
            {/* layered pine tiers — darker base, lighter top, lit crescent */}
            <polygon points={`${s/2},${s*0.08} ${s*0.18},${s*0.55} ${s*0.82},${s*0.55}`} fill="#2f4220" stroke={PAL.ink} strokeWidth={0.8} />
            <polygon points={`${s/2},${s*0.12} ${s*0.22},${s*0.5} ${s*0.78},${s*0.5}`} fill="#3d5226" />
            <polygon points={`${s/2},${s*0.22} ${s*0.24},${s*0.65} ${s*0.76},${s*0.65}`} fill="#4a6235" stroke={PAL.ink} strokeWidth={0.8} />
            <polygon points={`${s/2},${s*0.26} ${s*0.28},${s*0.6} ${s*0.72},${s*0.6}`} fill="#5e7842" />
            {/* NW lit edge */}
            <polygon points={`${s/2},${s*0.08} ${s*0.18},${s*0.55} ${s*0.36},${s*0.55} ${s*0.46},${s*0.18}`} fill="#7a9c52" opacity={0.45} />
          </g>
        ) : variant === 1 ? (
          <g>
            <polygon points={`${s/2},${s*0.05} ${s*0.16},${s*0.45} ${s*0.84},${s*0.45}`} fill="#2f4220" stroke={PAL.ink} strokeWidth={0.8} />
            <polygon points={`${s/2},${s*0.2} ${s*0.2},${s*0.6} ${s*0.8},${s*0.6}`} fill="#3d5226" stroke={PAL.ink} strokeWidth={0.8} />
            <polygon points={`${s/2},${s*0.35} ${s*0.24},${s*0.7} ${s*0.76},${s*0.7}`} fill="#4a6235" stroke={PAL.ink} strokeWidth={0.8} />
            <polygon points={`${s/2},${s*0.05} ${s*0.16},${s*0.45} ${s*0.32},${s*0.45} ${s*0.45},${s*0.15}`} fill="#7a9c52" opacity={0.5} />
            <polygon points={`${s/2},${s*0.35} ${s*0.24},${s*0.7} ${s*0.4},${s*0.7} ${s*0.46},${s*0.42}`} fill="#88a85a" opacity={0.4} />
          </g>
        ) : (
          <g>
            {/* broadleaf — shadow + body + NW highlight + small accent leaves */}
            <circle cx={s * 0.52} cy={s * 0.46} r={s * 0.34} fill="#2f4220" opacity={0.7} />
            <circle cx={s/2} cy={s * 0.4} r={s * 0.32} fill="#3d5226" stroke={PAL.ink} strokeWidth={0.8} />
            <circle cx={s * 0.4} cy={s * 0.5} r={s * 0.18} fill="#4a6235" />
            <circle cx={s * 0.62} cy={s * 0.48} r={s * 0.16} fill="#566e3e" />
            <circle cx={s * 0.4} cy={s * 0.32} r={s * 0.14} fill="#7a9c52" opacity={0.7} />
            <circle cx={s * 0.55} cy={s * 0.28} r={s * 0.08} fill="#9ab86a" opacity={0.6} />
          </g>
        )}
      </g>
    );
  }

  if (kind === "rocks") {
    return (
      <g>
        <ellipse cx={s / 2} cy={s * 0.9} rx={s * 0.36} ry={s * 0.07} fill={PAL.shadow} />
        {/* base mass — dark silhouette */}
        <polygon points={`${s*0.18},${s*0.82} ${s*0.28},${s*0.38} ${s*0.55},${s*0.28} ${s*0.8},${s*0.44} ${s*0.84},${s*0.82}`}
          fill="#5e564c" stroke={PAL.ink} strokeWidth={1} />
        {/* lit NW facet */}
        <polygon points={`${s*0.28},${s*0.38} ${s*0.55},${s*0.28} ${s*0.5},${s*0.55} ${s*0.32},${s*0.6}`}
          fill="#b8aea0" />
        <polygon points={`${s*0.28},${s*0.38} ${s*0.4},${s*0.34} ${s*0.36},${s*0.5}`} fill="#d4ccc0" opacity={0.8} />
        {/* shadow SE facet */}
        <polygon points={`${s*0.55},${s*0.28} ${s*0.8},${s*0.44} ${s*0.68},${s*0.65} ${s*0.5},${s*0.55}`}
          fill="#3a342c" />
        {/* cracks */}
        <line x1={s*0.4} y1={s*0.45} x2={s*0.46} y2={s*0.62} stroke={PAL.ink} strokeWidth={0.4} opacity={0.6} />
        {/* small pebble at base */}
        <ellipse cx={s*0.72} cy={s*0.82} rx={s*0.08} ry={s*0.05} fill="#7a7164" stroke={PAL.ink} strokeWidth={0.4} />
      </g>
    );
  }

  if (kind === "fiber-grass") {
    // Tall reedy stalks with seed-tufts — flax/hemp hint
    return (
      <g>
        <ellipse cx={s / 2} cy={s * 0.92} rx={s * 0.26} ry={s * 0.05} fill={PAL.shadow} />
        <line x1={s*0.35} y1={s*0.9} x2={s*0.32} y2={s*0.15} stroke="#8a7a3a" strokeWidth={0.9} />
        <line x1={s*0.5}  y1={s*0.9} x2={s*0.52} y2={s*0.08} stroke="#a89548" strokeWidth={1.0} />
        <line x1={s*0.65} y1={s*0.9} x2={s*0.7}  y2={s*0.18} stroke="#8a7a3a" strokeWidth={0.9} />
        <circle cx={s*0.32} cy={s*0.15} r={s*0.06} fill="#d8c878" stroke={PAL.ink} strokeWidth={0.4} />
        <circle cx={s*0.52} cy={s*0.08} r={s*0.07} fill="#e6d68a" stroke={PAL.ink} strokeWidth={0.4} />
        <circle cx={s*0.7}  cy={s*0.18} r={s*0.06} fill="#d8c878" stroke={PAL.ink} strokeWidth={0.4} />
      </g>
    );
  }
  // berries
  return (
    <g>
      <ellipse cx={s / 2} cy={s * 0.9} rx={s * 0.28} ry={s * 0.05} fill={PAL.shadow} />
      <circle cx={s / 2} cy={s * 0.6} r={s * 0.3} fill="#3d5226" stroke={PAL.ink} strokeWidth={0.8} />
      <circle cx={s * 0.4} cy={s * 0.55} r={s * 0.07} fill="#a83a3a" stroke={PAL.ink} strokeWidth={0.5} />
      <circle cx={s * 0.6} cy={s * 0.5} r={s * 0.07} fill="#a83a3a" stroke={PAL.ink} strokeWidth={0.5} />
      <circle cx={s * 0.52} cy={s * 0.7} r={s * 0.07} fill="#a83a3a" stroke={PAL.ink} strokeWidth={0.5} />
    </g>
  );
}

// ── Animal sprite ────────────────────────────────────────────────
function AnimalArt({ species, dead, adult }: { species: "chicken" | "goat" | "sheep" | "cattle"; dead: boolean; adult: boolean }) {
  const scale = adult ? 1 : 0.7;
  const op = dead ? 0.35 : 1;
  if (species === "chicken") {
    return (
      <g opacity={op} transform={`scale(${scale})`}>
        <ellipse cx={0} cy={3.5} rx={3} ry={0.8} fill={PAL.shadow} />
        {/* body */}
        <ellipse cx={0} cy={1} rx={2.6} ry={2} fill="#e8d8b8" stroke={PAL.ink} strokeWidth={0.4} />
        {/* wing */}
        <path d="M-1.6,1 Q0,-0.5 1.8,1 Q0,2 -1.6,1 Z" fill="#c4ae90" stroke={PAL.ink} strokeWidth={0.3} />
        {/* head */}
        <circle cx={2.2} cy={-1.2} r={1.3} fill="#e8d8b8" stroke={PAL.ink} strokeWidth={0.4} />
        {/* comb */}
        <path d="M1.6,-2.3 q0.4,-0.6 0.8,0 q0.4,-0.6 0.8,0" stroke="#a83a3a" strokeWidth={0.7} fill="none" />
        {/* beak */}
        <polygon points={`3.4,-1.1 4.4,-0.8 3.4,-0.6`} fill="#c9a14a" stroke={PAL.ink} strokeWidth={0.2} />
        {/* eye */}
        <circle cx={2.5} cy={-1.5} r={0.2} fill={PAL.ink} />
        {/* legs */}
        <line x1={-0.6} y1={2.8} x2={-0.6} y2={3.6} stroke="#c9a14a" strokeWidth={0.5} />
        <line x1={0.6} y1={2.8} x2={0.6} y2={3.6} stroke="#c9a14a" strokeWidth={0.5} />
      </g>
    );
  }
  if (species === "goat") {
    return (
      <g opacity={op} transform={`scale(${scale})`}>
        <ellipse cx={0} cy={4} rx={4} ry={0.9} fill={PAL.shadow} />
        {/* body */}
        <ellipse cx={-0.5} cy={1} rx={3.4} ry={1.8} fill="#b8a48a" stroke={PAL.ink} strokeWidth={0.4} />
        {/* head */}
        <ellipse cx={2.6} cy={-0.6} rx={1.5} ry={1.2} fill="#c4b094" stroke={PAL.ink} strokeWidth={0.4} />
        {/* horns */}
        <path d="M2.2,-1.6 q0.4,-1.2 1.2,-1.6" stroke={PAL.ink} strokeWidth={0.5} fill="none" />
        <path d="M3.0,-1.6 q0.6,-1.0 1.4,-1.2" stroke={PAL.ink} strokeWidth={0.5} fill="none" />
        {/* beard */}
        <line x1={3.4} y1={0.2} x2={3.6} y2={1.4} stroke="#8a7a5e" strokeWidth={0.6} />
        {/* legs */}
        {[-2.4, -1.0, 0.6, 2.0].map((lx, i) => (
          <line key={i} x1={lx} y1={2.5} x2={lx} y2={4} stroke={PAL.ink} strokeWidth={0.7} />
        ))}
        {/* eye */}
        <circle cx={3.0} cy={-0.8} r={0.2} fill={PAL.ink} />
        {/* tail */}
        <line x1={-3.8} y1={0.3} x2={-4.6} y2={-0.2} stroke="#8a7a5e" strokeWidth={0.6} />
      </g>
    );
  }
  if (species === "sheep") {
    return (
      <g opacity={op} transform={`scale(${scale})`}>
        <ellipse cx={0} cy={4} rx={4.2} ry={0.9} fill={PAL.shadow} />
        {/* fluffy body */}
        <ellipse cx={-0.5} cy={0.6} rx={3.6} ry={2.2} fill="#ece4d4" stroke={PAL.ink} strokeWidth={0.4} />
        <circle cx={-2.2} cy={-0.4} r={1.1} fill="#f4ecdc" stroke={PAL.ink} strokeWidth={0.3} />
        <circle cx={0.4} cy={-1.0} r={1.1} fill="#f4ecdc" stroke={PAL.ink} strokeWidth={0.3} />
        <circle cx={-1.2} cy={-1.2} r={0.9} fill="#f4ecdc" stroke={PAL.ink} strokeWidth={0.3} />
        {/* head */}
        <ellipse cx={2.6} cy={-0.2} rx={1.3} ry={1.1} fill="#3a2410" stroke={PAL.ink} strokeWidth={0.4} />
        {/* ears */}
        <ellipse cx={2.0} cy={-1.2} rx={0.5} ry={0.3} fill="#3a2410" />
        {/* eye */}
        <circle cx={3.0} cy={-0.4} r={0.2} fill="#f4ecdc" />
        {/* legs */}
        {[-2.2, -0.8, 0.8, 2.0].map((lx, i) => (
          <line key={i} x1={lx} y1={2.5} x2={lx} y2={4} stroke="#3a2410" strokeWidth={0.7} />
        ))}
      </g>
    );
  }
  // cattle
  return (
    <g opacity={op} transform={`scale(${scale})`}>
      <ellipse cx={0} cy={5} rx={5.5} ry={1.1} fill={PAL.shadow} />
      {/* body */}
      <ellipse cx={-0.5} cy={1.2} rx={4.6} ry={2.4} fill="#c4ae90" stroke={PAL.ink} strokeWidth={0.5} />
      {/* brown patches */}
      <ellipse cx={-2.2} cy={0.4} rx={1.4} ry={0.9} fill="#5a3820" />
      <ellipse cx={1.4} cy={1.8} rx={1.6} ry={1.0} fill="#5a3820" />
      {/* head */}
      <ellipse cx={3.6} cy={-0.4} rx={1.7} ry={1.4} fill="#c4ae90" stroke={PAL.ink} strokeWidth={0.5} />
      {/* horns */}
      <path d="M2.8,-1.6 q0.4,-0.8 1.2,-0.6" stroke={PAL.ink} strokeWidth={0.6} fill="none" />
      <path d="M4.4,-1.6 q-0.2,-0.8 -1.0,-0.6" stroke={PAL.ink} strokeWidth={0.6} fill="none" />
      {/* snout */}
      <ellipse cx={4.6} cy={0.2} rx={0.8} ry={0.6} fill="#e8d8b8" stroke={PAL.ink} strokeWidth={0.3} />
      <circle cx={4.5} cy={0.1} r={0.18} fill={PAL.ink} />
      <circle cx={4.8} cy={0.3} r={0.18} fill={PAL.ink} />
      {/* eye */}
      <circle cx={3.8} cy={-0.7} r={0.22} fill={PAL.ink} />
      {/* legs */}
      {[-3.2, -1.4, 0.6, 2.6].map((lx, i) => (
        <line key={i} x1={lx} y1={3.2} x2={lx} y2={5} stroke={PAL.ink} strokeWidth={0.9} />
      ))}
      {/* tail */}
      <line x1={-4.8} y1={0.6} x2={-5.6} y2={2.2} stroke={PAL.ink} strokeWidth={0.6} />
    </g>
  );
}

// ── Survivor sprite ──────────────────────────────────────────────
function SurvivorArt({ founder, dead, female, stage, pregnant }: { founder: boolean; dead: boolean; female: boolean; stage?: import("@/game/types").LifeStage; pregnant?: boolean }) {
  const scale =
    stage === "child" ? 0.55 :
    stage === "teen"  ? 0.78 :
    stage === "elder" ? 0.95 : 1;
  const elderTint = stage === "elder";
  const stageBadge =
    stage === "child" ? "#7ec8a8" :
    stage === "teen"  ? "#c9a14a" :
    stage === "elder" ? "#b8b8b8" : null;
  return (
    <g>
      <g transform={`scale(${scale})`}>
        <SurvivorArtCore founder={founder} dead={dead} female={female} elderTint={elderTint} pregnant={!!pregnant && female} />
      </g>
      {stageBadge && !dead && (
        <circle cx={5} cy={-7} r={1.2} fill={stageBadge} stroke={PAL.ink} strokeWidth={0.3} />
      )}
    </g>
  );
}

// ── Activity glyph above the survivor's head ─────────────────────
// Shows what they're doing right now: ZZZ for sleep, fork for eating,
// droplet for drinking, hammer/sickle/axe/pick for working, speech
// bubble for socializing. Pure SVG, no extra deps.
// Brief on/off speech bubble for coworkers chatting *while* they work.
// Sits to the upper-right of the work glyph so it doesn't replace it,
// and stays visible only ~0.9s every 6s so it reads as "small talk".
function WorkSmallTalkBubble({ begin }: { begin: string }) {
  return (
    <g transform="translate(4 -10)" pointerEvents="none">
      <path d="M-2 -1.3 Q-2 -2.2 -1.2 -2.2 L1.3 -2.2 Q2.1 -2.2 2.1 -1.3 L2.1 0.3 Q2.1 1.2 1.3 1.2 L-0.1 1.2 L-0.7 2 L-0.9 1.2 L-1.2 1.2 Q-2 1.2 -2 0.3 Z"
            fill="#f1e2bf" stroke={PAL.ink} strokeWidth={0.3} />
      <circle cx={-0.7} cy={-0.5} r={0.22} fill={PAL.ink} />
      <circle cx={0.25} cy={-0.5} r={0.22} fill={PAL.ink} />
      <circle cx={1.2}  cy={-0.5} r={0.22} fill={PAL.ink} />
      <animate attributeName="opacity"
        values="0;0;1;1;0;0"
        keyTimes="0;0.05;0.1;0.25;0.3;1"
        dur="6s" begin={begin} repeatCount="indefinite" />
    </g>
  );
}

function ActivityGlyph({ survivor: s, partnerNearby, speakOffset = "0s" }: {
  survivor: import("@/game/types").Survivor;
  partnerNearby: boolean;
  speakOffset?: string;
}) {
  const st = s.state;
  // Position the glyph above head (head is ~y -5 in core sprite).
  const gy = -10;
  const stroke = PAL.ink;
  const wrap = (children: React.ReactNode, fill: string) => (
    <g transform={`translate(0 ${gy})`} pointerEvents="none">
      {/* parchment chip backing for legibility */}
      <circle cx={0} cy={0} r={2.6} fill="#f1e2bf" stroke={stroke} strokeWidth={0.35} opacity={0.92} />
      <g fill={fill} stroke={stroke} strokeWidth={0.35}>{children}</g>
    </g>
  );

  if (st === "resting") {
    // Floating ZZZ
    return (
      <g transform={`translate(2 ${gy - 1})`} pointerEvents="none"
         fontFamily="ui-serif, Georgia, serif" fontWeight={700} fill="#f1e2bf"
         stroke={PAL.ink} strokeWidth={0.25}>
        <text x={0} y={0} fontSize={3.6} opacity={0.95}>z
          <animate attributeName="y" values="0;-3;0" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.95;0.2;0.95" dur="2.2s" repeatCount="indefinite" />
        </text>
        <text x={2.4} y={-2} fontSize={2.8} opacity={0.85}>z
          <animate attributeName="y" values="-2;-5;-2" dur="2.2s" begin="0.3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.85;0.15;0.85" dur="2.2s" begin="0.3s" repeatCount="indefinite" />
        </text>
        <text x={4.4} y={-4} fontSize={2.2} opacity={0.75}>z
          <animate attributeName="y" values="-4;-7;-4" dur="2.2s" begin="0.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.75;0.1;0.75" dur="2.2s" begin="0.6s" repeatCount="indefinite" />
        </text>
      </g>
    );
  }
  if (st === "eating") {
    // Fork + knife crossed
    return wrap(
      <>
        <line x1={-1.4} y1={-1.7} x2={-1.4} y2={1.6} strokeWidth={0.5} />
        <line x1={-1.9} y1={-1.7} x2={-1.9} y2={-0.4} strokeWidth={0.4} />
        <line x1={-0.9} y1={-1.7} x2={-0.9} y2={-0.4} strokeWidth={0.4} />
        <line x1={1.4} y1={-1.7} x2={1.4} y2={1.6} strokeWidth={0.5} />
        <path d="M0.9 -1.7 Q1.4 -0.6 1.9 -1.7 L1.9 -0.2 L0.9 -0.2 Z" fill="#7a3a2a" strokeWidth={0.3} />
      </>, "#7a3a2a"
    );
  }
  if (st === "drinking") {
    // Water droplet
    return wrap(
      <path d="M0 -1.9 Q1.6 -0.2 1.4 1 Q1 2 0 2 Q-1 2 -1.4 1 Q-1.6 -0.2 0 -1.9 Z" fill="#3a7aa8" />,
      "#3a7aa8"
    );
  }
  if (st === "socializing" || partnerNearby) {
    // Pick a glyph that fits what they're saying. The AI writes phrases
    // like "Laughing with X." / "Sharing stories with X." / "Chatting...".
    const a = (s.action || "").toLowerCase();
    const mood: "laugh" | "love" | "story" | "curious" | "chat" =
      a.includes("laugh")             ? "laugh" :
      a.includes("sharing stories")   ? "story" :
      a.includes("getting to know")   ? "curious" :
      (s.mood ?? 50) >= 70 && partnerNearby ? "love" :
                                        "chat";
    const bubble = (() => {
      switch (mood) {
        case "laugh":
          return (
            <text x={0} y={0.6} fontSize={2.2} textAnchor="middle"
                  fontFamily="ui-serif, Georgia, serif" fontWeight={700}
                  fill={PAL.ink}>Ha!</text>
          );
        case "love":
          return (
            <path d="M0 1 L-1.1 0 Q-1.7 -0.6 -1.1 -1.2 Q-0.5 -1.7 0 -1 Q0.5 -1.7 1.1 -1.2 Q1.7 -0.6 1.1 0 Z"
                  fill="#b14a3a" stroke={PAL.ink} strokeWidth={0.2} />
          );
        case "story":
          return (
            <text x={0} y={0.7} fontSize={2.6} textAnchor="middle"
                  fontFamily="ui-serif, Georgia, serif" fill={PAL.ink}>♪</text>
          );
        case "curious":
          return (
            <text x={0} y={0.8} fontSize={2.4} textAnchor="middle"
                  fontFamily="ui-serif, Georgia, serif" fontWeight={700}
                  fill={PAL.ink}>?</text>
          );
        case "chat":
        default:
          return (
            <g fill={PAL.ink}>
              <circle cx={-1} cy={-0.4} r={0.3} />
              <circle cx={0.1} cy={-0.4} r={0.3} />
              <circle cx={1.2} cy={-0.4} r={0.3} />
            </g>
          );
      }
    })();
    return (
      <g transform={`translate(0 ${gy})`} pointerEvents="none">
        <g>
          <path d="M-2.4 -1.6 Q-2.4 -2.6 -1.4 -2.6 L1.6 -2.6 Q2.6 -2.6 2.6 -1.6 L2.6 0.4 Q2.6 1.4 1.6 1.4 L0 1.4 L-0.8 2.4 L-1 1.4 L-1.4 1.4 Q-2.4 1.4 -2.4 0.4 Z"
                fill="#f1e2bf" stroke={PAL.ink} strokeWidth={0.35} />
          <g transform="translate(0 -0.6)">{bubble}</g>
          <animate attributeName="opacity"
            values="0;1;1;0;0"
            keyTimes="0;0.1;0.5;0.55;1"
            dur="2.8s" begin={speakOffset} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="scale"
            values="0.2;1;1;0.2;0.2"
            keyTimes="0;0.1;0.5;0.55;1"
            dur="2.8s" begin={speakOffset} repeatCount="indefinite"
            additive="sum" />
        </g>
        {/* Floating heart on top of long, warm chats */}
        {(mood === "love" || mood === "laugh") && (
          <g>
            <path d="M0 1 L-0.9 0.1 Q-1.4 -0.4 -0.9 -0.9 Q-0.4 -1.3 0 -0.7 Q0.4 -1.3 0.9 -0.9 Q1.4 -0.4 0.9 0.1 Z"
                  fill="#b14a3a" opacity={0.85} transform="translate(3.2 -1)" />
            <animateTransform attributeName="transform" type="translate"
              values="0 0; 0 -4" dur="2.6s" begin="1.2s" repeatCount="indefinite" additive="sum" />
            <animate attributeName="opacity" values="0;0.9;0" dur="2.6s" begin="1.2s" repeatCount="indefinite" />
          </g>
        )}
      </g>
    );
  }
  if (st === "working") {
    const occ = s.occupation;
    if (occ === "builder") {
      // Hammer
      return wrap(
        <g>
          <rect x={-1.6} y={-1.7} width={3.2} height={1.2} fill="#6a4a2a" />
          <line x1={0} y1={-0.5} x2={0} y2={1.9} strokeWidth={0.6} stroke="#3a2410" />
        </g>, "#6a4a2a"
      );
    }
    if (occ === "farmer") {
      // Sickle
      return wrap(
        <g fill="none" stroke="#6a8a3a" strokeWidth={0.5}>
          <path d="M-1.6 1.5 Q-1.6 -1.6 1.5 -1.5" />
          <line x1={-1.6} y1={1.5} x2={-1.9} y2={1.9} stroke="#3a2410" strokeWidth={0.5} />
        </g>, "#6a8a3a"
      );
    }
    if (occ === "woodcutter") {
      // Axe
      return wrap(
        <g>
          <line x1={-1.6} y1={1.8} x2={1.4} y2={-1.6} stroke="#3a2410" strokeWidth={0.6} />
          <path d="M0.6 -1.8 L1.9 -1 L1.4 0.2 L0.2 -0.6 Z" fill="#9aa0a8" stroke={PAL.ink} strokeWidth={0.3} />
        </g>, "#9aa0a8"
      );
    }
    if (occ === "miner") {
      // Pickaxe
      return wrap(
        <g>
          <path d="M-1.8 -1.6 Q0 -0.6 1.8 -1.6" fill="none" stroke="#9aa0a8" strokeWidth={0.6} />
          <line x1={0} y1={-0.8} x2={0} y2={1.9} stroke="#3a2410" strokeWidth={0.55} />
        </g>, "#9aa0a8"
      );
    }
    if (occ === "forager" || occ === "hauler") {
      // Basket / berries
      return wrap(
        <g>
          <path d="M-1.8 -0.4 L1.8 -0.4 L1.4 1.7 L-1.4 1.7 Z" fill="#7a5a2a" />
          <circle cx={-0.6} cy={-0.8} r={0.45} fill="#b14a3a" />
          <circle cx={0.5} cy={-0.9} r={0.45} fill="#b14a3a" />
        </g>, "#7a5a2a"
      );
    }
    if (occ === "rancher") {
      // Horseshoe
      return wrap(
        <path d="M-1.4 1.6 L-1.6 -0.6 Q-1.6 -1.8 0 -1.8 Q1.6 -1.8 1.6 -0.6 L1.4 1.6"
              fill="none" stroke="#6a4a2a" strokeWidth={0.55} />,
        "#6a4a2a"
      );
    }
    // Generic working "spark"
    return wrap(
      <g stroke="#c9a14a" strokeWidth={0.45}>
        <line x1={-1.4} y1={0} x2={1.4} y2={0} />
        <line x1={0} y1={-1.4} x2={0} y2={1.4} />
      </g>, "#c9a14a"
    );
  }
  // idle / moving — no glyph
  return null;
}



function SurvivorArtCore({ founder, dead, female, elderTint, pregnant }: { founder: boolean; dead: boolean; female: boolean; elderTint?: boolean; pregnant?: boolean }) {
  const skin = "#d9b48a";
  const shirt = female
    ? (founder ? "#9a4a6a" : "#6a4a8a")
    : (founder ? "#7a3a2a" : "#3a5a6a");
  const pants = "#3d2810";
  const hairColor = elderTint ? "#c8c0b0" : (founder ? "#4a2818" : "#3a2410");


  if (female) {
    // Distinctly feminine silhouette: narrower shoulders, wider hip flare,
    // visible bust line, long flowing hair past the shoulders.
    const dressDark = founder ? "#7a3550" : "#4d3670";
    return (
      <g opacity={dead ? 0.4 : 1}>
        <ellipse cx={0} cy={9} rx={5.2} ry={1.7} fill={PAL.shadow} />
        {/* legs peeking under skirt */}
        <rect x={-2} y={5} width={1.6} height={3.2} fill={pants} stroke={PAL.ink} strokeWidth={0.4} />
        <rect x={0.4} y={5} width={1.6} height={3.2} fill={pants} stroke={PAL.ink} strokeWidth={0.4} />
        {/* long hair flowing past shoulders (back layer) */}
        <path
          d="M-3.6,-5.5 Q-5.4,-1 -4.6,4 Q-2.8,5.5 0,5.2 Q2.8,5.5 4.6,4 Q5.4,-1 3.6,-5.5 Z"
          fill={hairColor} stroke={PAL.ink} strokeWidth={0.4}
        />
        {/* skirt — A-line flare from cinched waist */}
        <path
          d="M-2.4,0.5 L2.4,0.5 L5,5.6 Q0,6.4 -5,5.6 Z"
          fill={shirt} stroke={PAL.ink} strokeWidth={0.5}
        />
        {/* fitted bodice — narrower shoulders + bust curve */}
        <path
          d="M-2.6,-3.2 Q-3.2,-1.2 -2.6,0.6 L2.6,0.6 Q3.2,-1.2 2.6,-3.2 Q1.5,-3.6 0,-3.4 Q-1.5,-3.6 -2.6,-3.2 Z"
          fill={shirt} stroke={PAL.ink} strokeWidth={0.5}
        />
        {/* bust line */}
        <path d="M-2,-1.4 Q-1,-0.6 0,-1 Q1,-0.6 2,-1.4" stroke={dressDark} strokeWidth={0.5} fill="none" opacity={0.7} />
        {/* waist sash / belt */}
        <rect x={-2.6} y={0.4} width={5.2} height={0.7} fill={dressDark} opacity={0.9} />
        {/* pregnancy belly */}
        {pregnant && (
          <ellipse cx={0} cy={0.6} rx={3.2} ry={2.2} fill={shirt} stroke={PAL.ink} strokeWidth={0.4} />
        )}
        {/* apron hint */}
        <polygon points="-1.5,-1.8 1.5,-1.8 2,5.3 -2,5.3" fill="#e8d8b8" opacity={0.3} />
        {/* neck */}
        <rect x={-0.6} y={-3.6} width={1.2} height={1} fill={skin} stroke={PAL.ink} strokeWidth={0.3} />
        {/* head — slightly smaller and more oval */}
        <ellipse cx={0} cy={-5.6} rx={2.3} ry={2.6} fill={skin} stroke={PAL.ink} strokeWidth={0.5} />
        {/* fringe / side-parted hair on top */}
        <path
          d="M-2.4,-6.4 Q-1,-8.3 0.6,-7.8 Q2.4,-8 2.6,-6 Q1.2,-5.4 0,-5.7 Q-1.2,-5.4 -2.4,-6.4 Z"
          fill={hairColor} stroke={PAL.ink} strokeWidth={0.4}
        />
        {/* small lash / eye hint */}
        <circle cx={-0.8} cy={-5.4} r={0.25} fill={PAL.ink} />
        <circle cx={0.8} cy={-5.4} r={0.25} fill={PAL.ink} />
        {/* subtle lip */}
        <path d="M-0.7,-4.4 Q0,-4 0.7,-4.4" stroke="#a8475a" strokeWidth={0.4} fill="none" />
        {founder && (
          <ellipse cx={0} cy={-7.6} rx={2.6} ry={0.6} fill={PAL.gold} stroke={PAL.ink} strokeWidth={0.4} />
        )}
      </g>
    );
  }


  // Male
  const hat = founder ? "#c9a14a" : "#5a3820";
  return (
    <g opacity={dead ? 0.4 : 1}>
      <ellipse cx={0} cy={9} rx={5} ry={1.6} fill={PAL.shadow} />
      {/* legs */}
      <rect x={-3} y={3} width={2.4} height={5} fill={pants} stroke={PAL.ink} strokeWidth={0.4} />
      <rect x={0.6} y={3} width={2.4} height={5} fill={pants} stroke={PAL.ink} strokeWidth={0.4} />
      {/* body — square shoulders */}
      <rect x={-3.8} y={-3} width={7.6} height={6.5} rx={1} fill={shirt} stroke={PAL.ink} strokeWidth={0.5} />
      {/* belt */}
      <rect x={-3.8} y={2} width={7.6} height={1} fill={PAL.ink} opacity={0.6} />
      {/* head */}
      <circle cx={0} cy={-5.5} r={2.8} fill={skin} stroke={PAL.ink} strokeWidth={0.5} />
      {/* short beard hint for non-founder males */}
      {!founder && <path d={`M-1.8,-4.5 Q0,-3 1.8,-4.5`} stroke={hairColor} strokeWidth={0.6} fill="none" />}
      {/* hat */}
      <ellipse cx={0} cy={-7.5} rx={4.2} ry={1} fill={hat} stroke={PAL.ink} strokeWidth={0.5} />
      <rect x={-2} y={-9} width={4} height={2} rx={0.5} fill={hat} stroke={PAL.ink} strokeWidth={0.5} />
    </g>
  );
}

const StaticTileLayers = React.memo(function StaticTileLayers({ tiles, width, height }: { tiles: Tile[]; width: number; height: number }) {
  const [terrainImages, setTerrainImages] = useState<LayerImage[]>([]);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const chunks = layerChunks(width, height);
    const tileByChunk = chunks.map((chunk) => ({
      chunk,
      tiles: tiles.filter((t) => {
        const px = t.x * TILE;
        const py = t.y * TILE;
        return px < chunk.x + chunk.width && px + TILE > chunk.x && py < chunk.y + chunk.height && py + TILE > chunk.y;
      }),
    }));

    (async () => {
      const images: LayerImage[] = [];
      // Spatial lookup so we can blend tile edges against neighbors.
      const tileMap = new Map<string, Tile>();
      for (const t of tiles) tileMap.set(`${t.x},${t.y}`, t);
      const at = (x: number, y: number) => tileMap.get(`${x},${y}`);

      for (const { chunk, tiles: chunkTiles } of tileByChunk) {
        const canvas = document.createElement("canvas");
        canvas.width = chunk.width;
        canvas.height = chunk.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.translate(-chunk.x, -chunk.y);

        // ── Pass 1: base + checker dither (no tile is a flat single color)
        for (const t of chunkTiles) {
          const pal = TILE_PAL[t.kind];
          const px = t.x * TILE;
          const py = t.y * TILE;
          ctx.fillStyle = pal.base;
          ctx.fillRect(px, py, TILE, TILE);
          if (t.kind !== "water") {
            // 2x2 sub-tile dither: each quadrant flips to alt when noise > 0.5
            const half = TILE / 2;
            ctx.fillStyle = pal.alt;
            for (let qy = 0; qy < 2; qy++) {
              for (let qx = 0; qx < 2; qx++) {
                if (rand(t.x * 2 + qx, t.y * 2 + qy, 7) > 0.55) {
                  ctx.fillRect(px + qx * half, py + qy * half, half, half);
                }
              }
            }
          } else {
            // Water: depth-shaded — tiles touching land get a lighter shallow
            // tint; tiles surrounded by water get a deeper tone. Then layer
            // soft horizontal ripple bands of varying alpha so the surface
            // reads as water rather than a flat blue square.
            let landNeighbors = 0;
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const) {
              const nb = at(t.x + dx, t.y + dy);
              if (nb && nb.kind !== "water") landNeighbors++;
            }
            // Deep-water darkening when no land touches this tile
            if (landNeighbors === 0) {
              ctx.fillStyle = "#1f4360";
              ctx.globalAlpha = 0.55;
              ctx.fillRect(px, py, TILE, TILE);
              ctx.globalAlpha = 1;
            } else {
              // Shallow tint near shore
              ctx.fillStyle = "#5a8aa6";
              ctx.globalAlpha = Math.min(0.45, 0.12 + landNeighbors * 0.07);
              ctx.fillRect(px, py, TILE, TILE);
              ctx.globalAlpha = 1;
            }
            // Two ripple bands per tile, offsets jittered by tile coord
            ctx.fillStyle = pal.alt;
            for (let b = 0; b < 2; b++) {
              const r = rand(t.x, t.y, 17 + b);
              const bandY = Math.floor(r * (TILE - 3));
              const bandH = 1 + Math.floor(rand(t.x, t.y, 31 + b) * 2);
              ctx.globalAlpha = 0.35 + r * 0.2;
              const xOff = Math.floor(rand(t.x, t.y, 41 + b) * 4);
              const xLen = TILE - xOff - Math.floor(rand(t.x, t.y, 53 + b) * 4);
              ctx.fillRect(px + xOff, py + bandY, xLen, bandH);
            }
            ctx.globalAlpha = 1;
          }
        }

        // ── Pass 2: edge blending — soft 2px rim of neighbor's base color
        // so biomes feather into each other instead of hard-cutting.
        ctx.globalAlpha = 0.5;
        for (const t of chunkTiles) {
          const px = t.x * TILE;
          const py = t.y * TILE;
          const neighbors: [number, number, "n" | "s" | "e" | "w"][] = [
            [t.x, t.y - 1, "n"], [t.x, t.y + 1, "s"],
            [t.x + 1, t.y, "e"], [t.x - 1, t.y, "w"],
          ];
          for (const [nx, ny, dir] of neighbors) {
            const nb = at(nx, ny);
            if (!nb || nb.kind === t.kind) continue;
            // Skip water-vs-ground (handled by shoreline detail below).
            if (nb.kind === "water" || t.kind === "water") continue;
            ctx.fillStyle = TILE_PAL[nb.kind].base;
            const rim = 2.5;
            if (dir === "n") ctx.fillRect(px, py, TILE, rim);
            else if (dir === "s") ctx.fillRect(px, py + TILE - rim, TILE, rim);
            else if (dir === "e") ctx.fillRect(px + TILE - rim, py, rim, TILE);
            else ctx.fillRect(px, py, rim, TILE);
          }
        }
        ctx.globalAlpha = 1;

        // ── Pass 2b: shoreline — irregular sandy/shallow edge so water
        // doesn't look like a square swimming pool. We draw on BOTH sides:
        // bumpy sand on the land tile, and a shallow-water lighter band
        // (with land-colored nibbles) on the water tile.
        const drawShoreEdge = (
          px: number, py: number, dir: "n" | "s" | "e" | "w",
          color: string, alpha: number, baseDepth: number, jitterSeed: number,
          tx: number, ty: number,
        ) => {
          ctx.fillStyle = color;
          ctx.globalAlpha = alpha;
          const steps = 8;
          const step = TILE / steps;
          for (let i = 0; i < steps; i++) {
            const j = rand(tx + i * 0.37, ty + jitterSeed, jitterSeed + i);
            const depth = Math.max(0.6, baseDepth + (j - 0.5) * baseDepth * 1.6);
            if (dir === "n")      ctx.fillRect(px + i * step, py,                       step + 0.5, depth);
            else if (dir === "s") ctx.fillRect(px + i * step, py + TILE - depth,        step + 0.5, depth);
            else if (dir === "e") ctx.fillRect(px + TILE - depth, py + i * step,        depth,      step + 0.5);
            else                  ctx.fillRect(px,                py + i * step,        depth,      step + 0.5);
          }
        };

        // Land-side: bumpy sand rim
        for (const t of chunkTiles) {
          if (t.kind === "water") continue;
          const px = t.x * TILE;
          const py = t.y * TILE;
          const edges: [number, number, "n" | "s" | "e" | "w"][] = [
            [t.x, t.y - 1, "n"], [t.x, t.y + 1, "s"],
            [t.x + 1, t.y, "e"], [t.x - 1, t.y, "w"],
          ];
          for (const [nx, ny, dir] of edges) {
            const nb = at(nx, ny);
            if (!nb || nb.kind !== "water") continue;
            drawShoreEdge(px, py, dir, "#d6c184", 0.9, 2.2, 11, t.x, t.y);
            drawShoreEdge(px, py, dir, "#b89868", 0.55, 1.1, 23, t.x, t.y);
          }
        }

        // Water-side: shallow lighter band + nibbles of land color so the
        // shoreline reads as an organic edge instead of a straight tile seam.
        for (const t of chunkTiles) {
          if (t.kind !== "water") continue;
          const px = t.x * TILE;
          const py = t.y * TILE;
          const edges: [number, number, "n" | "s" | "e" | "w"][] = [
            [t.x, t.y - 1, "n"], [t.x, t.y + 1, "s"],
            [t.x + 1, t.y, "e"], [t.x - 1, t.y, "w"],
          ];
          for (const [nx, ny, dir] of edges) {
            const nb = at(nx, ny);
            if (!nb || nb.kind === "water") continue;
            if (!nb) continue;
            // Shallow turquoise band where land meets water
            drawShoreEdge(px, py, dir, "#7ab0c4", 0.65, 3.2, 31, t.x, t.y);
            drawShoreEdge(px, py, dir, "#a8d0e0", 0.4, 1.4, 37, t.x, t.y);
            // a few irregular nibbles of the land color biting into the water
            drawShoreEdge(px, py, dir, TILE_PAL[nb.kind].base, 0.85, 1.2, 47, t.x, t.y);
            // tiny sand fleck on top
            drawShoreEdge(px, py, dir, "#d6c184", 0.6, 0.8, 59, t.x, t.y);
          }
        }
        ctx.globalAlpha = 1;

        // ── Pass 3: per-tile details (tufts, pebbles, ripples)
        ctx.lineCap = "round";
        for (const t of chunkTiles) {
          const px = t.x * TILE;
          const py = t.y * TILE;
          const pal = TILE_PAL[t.kind];
          ctx.strokeStyle = pal.detail;
          ctx.fillStyle = pal.detail;
          if (t.kind === "water") {
            // Curved wave highlights — varied, fewer than the old grid
            ctx.strokeStyle = pal.detail;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 0.7;
            const nWaves = 2 + Math.floor(rand(t.x, t.y, 3) * 2);
            for (let i = 0; i < nWaves; i++) {
              const wy = py + 4 + rand(t.x, t.y, 70 + i) * (TILE - 8);
              const wx = px + 2 + rand(t.x, t.y, 80 + i) * (TILE * 0.4);
              const wlen = 5 + rand(t.x, t.y, 90 + i) * 7;
              ctx.beginPath();
              ctx.moveTo(wx, wy);
              ctx.quadraticCurveTo(wx + wlen / 2, wy - 1.2, wx + wlen, wy);
              ctx.stroke();
            }
            // Tiny sun-sparkle dots — sparse, give the surface life
            if (rand(t.x, t.y, 200) > 0.7) {
              ctx.fillStyle = "#e8f4fa";
              ctx.globalAlpha = 0.75;
              const sx = px + 3 + rand(t.x, t.y, 201) * (TILE - 6);
              const sy = py + 3 + rand(t.x, t.y, 202) * (TILE - 6);
              ctx.fillRect(sx, sy, 1.2, 1.2);
              ctx.fillRect(sx + 1.5, sy + 0.5, 0.8, 0.8);
            }
            ctx.globalAlpha = 1;
          } else if (t.kind === "grass" || t.kind === "tall-grass") {
            const n = t.kind === "tall-grass" ? 7 : 5;
            const len = t.kind === "tall-grass" ? 4.8 : 3.2;
            // Paired blades: darker shadow blade offset behind a brighter lit
            // blade — produces depth instead of flat scribbles.
            ctx.lineWidth = 0.8;
            for (let i = 0; i < n; i++) {
              const rx = px + rand(t.x, t.y, i) * (TILE - 4) + 2;
              const ry = py + rand(t.x, t.y, i + 10) * (TILE - 4) + 2;
              ctx.strokeStyle = "#3d4f1f";
              ctx.globalAlpha = 0.55;
              ctx.beginPath();
              ctx.moveTo(rx + 0.5, ry + 0.4); ctx.lineTo(rx - 0.5, ry - len + 0.4);
              ctx.moveTo(rx + 0.5, ry + 0.4); ctx.lineTo(rx + 0.5, ry - len - 0.1);
              ctx.moveTo(rx + 0.5, ry + 0.4); ctx.lineTo(rx + 1.5, ry - len + 0.4);
              ctx.stroke();
              ctx.strokeStyle = pal.detail;
              ctx.globalAlpha = 0.95;
              ctx.beginPath();
              ctx.moveTo(rx, ry); ctx.lineTo(rx - 1, ry - len);
              ctx.moveTo(rx, ry); ctx.lineTo(rx, ry - len - 0.5);
              ctx.moveTo(rx, ry); ctx.lineTo(rx + 1, ry - len);
              ctx.stroke();
              ctx.fillStyle = "#b8d878";
              ctx.globalAlpha = 0.7;
              ctx.fillRect(rx - 0.3, ry - len - 0.8, 0.6, 0.6);
            }
            if (rand(t.x, t.y, 99) > 0.82) {
              const fx = px + rand(t.x, t.y, 101) * (TILE - 6) + 3;
              const fy = py + rand(t.x, t.y, 102) * (TILE - 6) + 3;
              ctx.strokeStyle = "#3d4f1f";
              ctx.globalAlpha = 0.7;
              ctx.lineWidth = 0.5;
              ctx.beginPath(); ctx.moveTo(fx, fy + 1.4); ctx.lineTo(fx, fy); ctx.stroke();
              const palette = ["#e8c060", "#d97474", "#e8d8ec", "#c890e0"];
              ctx.fillStyle = palette[Math.floor(rand(t.x, t.y, 103) * palette.length)];
              ctx.globalAlpha = 0.95;
              ctx.beginPath(); ctx.arc(fx, fy, 1.0, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = "#fff4c0";
              ctx.globalAlpha = 0.9;
              ctx.fillRect(fx - 0.3, fy - 0.3, 0.6, 0.6);
            }
          } else if (t.kind === "dirt" || t.kind === "road") {
            // Curved scuff strokes + pebbles + dark speck — looks tilled
            ctx.strokeStyle = "#5e3a18";
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 2; i++) {
              const sx = px + rand(t.x, t.y, i * 7 + 1) * (TILE - 8) + 4;
              const sy = py + rand(t.x, t.y, i * 7 + 2) * (TILE - 8) + 4;
              const sl = 3 + rand(t.x, t.y, i * 7 + 3) * 4;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.quadraticCurveTo(sx + sl * 0.5, sy + 0.8, sx + sl, sy + 0.3);
              ctx.stroke();
            }
            for (let i = 0; i < 4; i++) {
              if (rand(t.x, t.y, i) < 0.4) continue;
              ctx.fillStyle = i === 2 ? "#5e3a18" : pal.detail;
              ctx.globalAlpha = i === 2 ? 0.55 : 0.85;
              ctx.beginPath();
              ctx.arc(px + rand(t.x, t.y, i * 2) * (TILE - 6) + 3, py + rand(t.x, t.y, i * 2 + 1) * (TILE - 6) + 3, 0.8, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (t.kind === "stone") {
            // Clustered pebbles with shadow + lit highlight
            for (let i = 0; i < 3; i++) {
              if (rand(t.x, t.y, i) < 0.3) continue;
              const cx = px + rand(t.x, t.y, i * 3 + 2) * (TILE - 8) + 4;
              const cy = py + rand(t.x, t.y, i * 3 + 3) * (TILE - 8) + 4;
              const r = 1.2 + rand(t.x, t.y, i * 5) * 0.8;
              ctx.fillStyle = "#3a342c";
              ctx.globalAlpha = 0.55;
              ctx.beginPath(); ctx.arc(cx + 0.4, cy + 0.6, r, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = pal.detail;
              ctx.globalAlpha = 0.95;
              ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = "#d4ccc0";
              ctx.globalAlpha = 0.8;
              ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.4, r * 0.45, 0, Math.PI * 2); ctx.fill();
            }
          } else if (t.kind === "forest") {
            // Canopy with under-shadow + northwest highlight crescent
            for (let i = 0; i < 4; i++) {
              const ccx = px + rand(t.x, t.y, i * 2) * (TILE - 6) + 3;
              const ccy = py + rand(t.x, t.y, i * 2 + 1) * (TILE - 6) + 3;
              const r = 1.8 + rand(t.x, t.y, i + 50) * 1.4;
              ctx.fillStyle = "#1f2e15";
              ctx.globalAlpha = 0.55;
              ctx.beginPath(); ctx.arc(ccx + 0.5, ccy + 0.7, r, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = i % 2 === 0 ? pal.detail : "#6f9148";
              ctx.globalAlpha = 0.9;
              ctx.beginPath(); ctx.arc(ccx, ccy, r, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = "#a4c878";
              ctx.globalAlpha = 0.55;
              ctx.beginPath(); ctx.arc(ccx - r * 0.3, ccy - r * 0.35, r * 0.55, 0, Math.PI * 2); ctx.fill();
            }
          } else if (t.kind === "ruin") {
            ctx.globalAlpha = 0.75;
            ctx.lineWidth = 0.8;
            ctx.strokeStyle = pal.detail;
            ctx.beginPath();
            ctx.moveTo(px + 4, py + TILE - 5);
            ctx.lineTo(px + 9, py + TILE - 9);
            ctx.lineTo(px + 13, py + TILE - 6);
            ctx.stroke();
            ctx.fillStyle = "#3a2a18";
            ctx.beginPath();
            ctx.arc(px + TILE - 7, py + 7, 1.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;

        // ── Pass 4: ambient film-grain speckle — breaks the per-tile grid
        // at distance so the map reads as one painted board.
        for (const t of chunkTiles) {
          if (t.kind === "water") continue;
          const px = t.x * TILE;
          const py = t.y * TILE;
          for (let i = 0; i < 5; i++) {
            const r = rand(t.x, t.y, 130 + i);
            if (r < 0.5) continue;
            const sx = px + rand(t.x, t.y, 140 + i) * TILE;
            const sy = py + rand(t.x, t.y, 150 + i) * TILE;
            ctx.fillStyle = r > 0.85 ? "#ffe8b4" : "#140c04";
            ctx.globalAlpha = r > 0.85 ? 0.09 : 0.10;
            ctx.fillRect(sx, sy, 1, 1);
          }
        }
        ctx.globalAlpha = 1;



        const url = await canvasToObjectUrl(canvas);
        if (!url) continue;
        if (cancelled) {
          URL.revokeObjectURL(url);
          continue;
        }
        urls.push(url);
        images.push({ ...chunk, url });
      }
      if (!cancelled) setTerrainImages(images);
    })();

    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [tiles, width, height]);

  if (terrainImages.length === 0) return <rect x={0} y={0} width={width} height={height} fill={TILE_PAL.grass.base} />;
  return <>{terrainImages.map((image) => <image key={image.id} href={image.url} x={image.x} y={image.y} width={image.width} height={image.height} preserveAspectRatio="none" />)}</>;
});

const StaticResourceLayer = React.memo(function StaticResourceLayer({ nodes }: { nodes: ResourceNode[]; width: number; height: number }) {
  // Render resource nodes as inline SVG via NodeArt. The previous canvas-to-blob
  // rasterization silently failed on some mobile WebViews (colored tiles showed
  // through but the stone/tree shapes never appeared).
  return (
    <g pointerEvents="none">
      {nodes.map((n) => {
        if (n.amount <= 0) return null;
        const size = TILE * (n.kind === "trees" ? 1.3 : n.kind === "rocks" ? 1.05 : 0.95);
        const depleted = n.amount < 30;
        const seed = (n.x * 73856093) ^ (n.y * 19349663);
        // Anchor at the south corner of the tile's iso diamond so trees
        // and rocks visually stand on the front of the ground tile.
        const anchorX = (n.x + 1) * TILE;
        const anchorY = (n.y + 1) * TILE;
        return (
          <g key={n.id} transform={isoUpright(anchorX, anchorY)} opacity={depleted ? 0.6 : 1}>
            <g transform={`translate(${-size / 2}, ${-size})`}>
              <NodeArt kind={n.kind} size={size} seed={Math.abs(seed)} />
            </g>
          </g>
        );
      })}
    </g>
  );
}, (prev, next) => {
  if (prev.nodes.length !== next.nodes.length) return false;
  for (let i = 0; i < prev.nodes.length; i++) {
    const a = prev.nodes[i];
    const b = next.nodes[i];
    if (a.id !== b.id || a.amount !== b.amount || a.x !== b.x || a.y !== b.y || a.kind !== b.kind) return false;
  }
  return true;
});


export function MapView() {
  const tiles = useGame((s) => s.tiles);
  const mapW = useGame((s) => s.mapW);
  const mapH = useGame((s) => s.mapH);
  const nodes = useGame((s) => s.nodes);
  const buildings = useGame((s) => s.buildings);
  const survivors = useGame((s) => s.survivors);
  const animals = useGame((s) => s.animals);
  const wornPaths = useGame((s) => s.wornPaths);

  const selection = useGame((s) => s.selection);
  const selectSurvivor = useGame((s) => s.selectSurvivor);
  const selectBuilding = useGame((s) => s.selectBuilding);
  const selectTile = useGame((s) => s.selectTile);
  const buildPlacement = useGame((s) => s.buildPlacement);
  const placeBuilding = useGame((s) => s.placeBuilding);
  const cancelBuild = useGame((s) => s.cancelBuild);
  const territory = useGame((s) => s.territory);
  const resources = useGame((s) => s.resources);
  const borderMode = useGame((s) => s.borderMode);
  const exitBorderMode = useGame((s) => s.exitBorderMode);
  const setBorderFromClick = useGame((s) => s.setBorderFromClick);
  const expandWorldToCurrentSize = useGame((s) => s.expandWorldToCurrentSize);
  const isMobile = useIsMobile();

  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const isoGroupRef = useRef<SVGGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const zoom = useView((s) => s.mapZoom);
  const smoothZoom = useView((s) => s.smooth);
  const setMapZoom = useView((s) => s.setMapZoom);
  const centerRequestId = useView((s) => s.centerRequestId);
  const W = mapW * TILE;
  const H = mapH * TILE;
  const ISO = isoBounds(mapW, mapH);
  const VW = ISO.w * zoom;
  const VH = ISO.h * zoom;
  const initialCenterDone = useRef(false);


  useEffect(() => {
    expandWorldToCurrentSize();
  }, [expandWorldToCurrentSize]);

  function scrollToRanch(behavior: ScrollBehavior) {
    const el = scrollRef.current;
    if (!el) return;
    const state = useGame.getState();
    let cx = mapW / 2;
    let cy = mapH / 2;
    if (state.territory) { cx = state.territory.cx; cy = state.territory.cy; }
    else {
      const h = state.buildings.find(b => b.kind === "homestead");
      if (h) { cx = h.x + h.w / 2; cy = h.y + h.h / 2; }
    }
    requestAnimationFrame(() => {
      const target = scrollRef.current;
      if (!target) return;
      // Project ranch center through the iso matrix.
      const wx = cx * TILE;
      const wy = cy * TILE;
      const ix = ISO_MATRIX_A * wx + ISO_MATRIX_C * wy + isoTx(mapH);
      const iy = ISO_MATRIX_B * wx + ISO_MATRIX_D * wy;
      const sx = ix * zoom - target.clientWidth / 2;
      const sy = iy * zoom - target.clientHeight / 2;
      target.scrollTo({
        left: Math.max(0, sx),
        top: Math.max(0, sy),
        behavior,
      });
    });
  }

  useEffect(() => {
    if (initialCenterDone.current || buildings.length === 0) return;
    initialCenterDone.current = true;
    scrollToRanch("auto");
  }, [buildings.length, mapW, mapH]);

  // Center on the ranch when the player requests it (button next to zoom).
  useEffect(() => {
    if (centerRequestId === 0) return;
    scrollToRanch("smooth");
  }, [centerRequestId, mapW, mapH]);



  // Wheel + pinch zoom, anchored to pointer so the world doesn't slide away.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const MIN = 0.2, MAX = 1.5;
    const clamp = (z: number) => Math.max(MIN, Math.min(MAX, z));

    const zoomAt = (clientX: number, clientY: number, nextZoom: number, smooth = false) => {
      const cur = useView.getState().mapZoom;
      const next = clamp(nextZoom);
      if (next === cur) return;
      const rect = el.getBoundingClientRect();
      // World coord under pointer (in pre-zoom px)
      const wx = (el.scrollLeft + (clientX - rect.left)) / cur;
      const wy = (el.scrollTop + (clientY - rect.top)) / cur;
      setMapZoom(next, smooth);
      // After paint, restore pointer anchor
      requestAnimationFrame(() => {
        el.scrollLeft = wx * next - (clientX - rect.left);
        el.scrollTop = wy * next - (clientY - rect.top);
      });
    };

    const onWheel = (e: WheelEvent) => {
      // Ctrl/Cmd+wheel or trackpad pinch (ctrlKey is set by browsers for pinch)
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const cur = useView.getState().mapZoom;
      // Exponential feel; small steps even for large deltas
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAt(e.clientX, e.clientY, cur * factor, false);
    };

    // Touch pinch
    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let pinchCenter = { x: 0, y: 0 };
    const dist = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDist = dist(e.touches[0], e.touches[1]);
        pinchStartZoom = useView.getState().mapZoom;
        pinchCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        pinchCenter = { x: cx, y: cy };
        zoomAt(cx, cy, pinchStartZoom * (d / pinchStartDist), false);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchStartDist = 0;
      void pinchCenter;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [setMapZoom]);


  // Clear pending placement when the build selection changes or is cancelled.
  useEffect(() => { setPendingPlacement(null); }, [buildPlacement?.kind]);

  const ghost = useMemo(() => {
    if (!buildPlacement) return null;
    const origin = pendingPlacement ?? hover;
    if (!origin) return null;
    const def = BUILDINGS[buildPlacement.kind];
    const x = origin.x, y = origin.y, w = def.size.w, h = def.size.h;

    // Validity rules (mirror placeBuilding in store).
    const reasons: string[] = [];
    if (x < 0 || y < 0 || x + w > mapW || y + h > mapH) reasons.push("Off map");
    for (const b of buildings) {
      if (x + w <= b.x || y + h <= b.y || b.x + b.w <= x || b.y + b.h <= y) continue;
      reasons.push("Overlaps a building");
      break;
    }
    outer: for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const t = tiles[(y + dy) * mapW + (x + dx)];
        if (!t) { reasons.push("Off map"); break outer; }
        if (t.kind === "water" && buildPlacement.kind !== "well") { reasons.push("On water"); break outer; }
        if (t.kind === "stone" && buildPlacement.kind !== "well") { reasons.push("On stone"); break outer; }
      }
    }
    if (territory && territory.radius > 0) {
      const tx = x + w / 2, ty = y + h / 2;
      const { halfW, halfH } = territoryDims(territory);
      if (Math.abs(tx - territory.cx) > halfW || Math.abs(ty - territory.cy) > halfH) {
        reasons.push("Outside territory");
      }
    }
    if (!buildPlacement.free) {
      const def2 = BUILDINGS[buildPlacement.kind];
      for (const [r, amt] of Object.entries(def2.cost)) {
        if ((resources as any)[r] < (amt ?? 0)) { reasons.push(`Need more ${r}`); break; }
      }
    }
    return { x, y, w, h, valid: reasons.length === 0, reason: reasons[0] ?? "" };
  }, [buildPlacement, hover, pendingPlacement, buildings, tiles, mapW, mapH, territory, resources]);

  function svgToTile(e: React.MouseEvent) {
    // Hit-test against the iso-projected world group so the inverse CTM
    // accounts for the isometric transform; coordinates in that group's
    // local space are still the original square-grid pixel space, so
    // dividing by TILE recovers the integer tile under the pointer.
    const g = isoGroupRef.current;
    if (!g) return null;
    const owner = g.ownerSVGElement ?? ref.current;
    if (!owner) return null;
    const pt = owner.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = g.getScreenCTM();
    if (!m) return null;
    const p = pt.matrixTransform(m.inverse());
    return { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 relative overflow-auto scroll-amber grain"
      style={{ backgroundColor: TILE_PAL.grass.base, touchAction: "pan-x pan-y" }}
    >
      <div style={{ width: VW, height: VH, position: "relative" }}>
      <svg
        ref={ref}
        width={ISO.w}
        height={ISO.h}
        viewBox={`0 0 ${ISO.w} ${ISO.h}`}
        className="block"
        shapeRendering="geometricPrecision"
        onMouseMove={(e) => {
          const p = svgToTile(e);
          if (p) setHover(p);
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const p = svgToTile(e);
          if (!p) return;
          if (borderMode) {
            setBorderFromClick(p.x + 0.5, p.y + 0.5);
            return;
          }
          if (buildPlacement) {
            // On mobile (no hover), first tap previews; second tap on same tile confirms.
            // On desktop, the hovered ghost already shows the preview; click confirms.
            if (isMobile) {
              if (pendingPlacement && pendingPlacement.x === p.x && pendingPlacement.y === p.y) {
                const ok = placeBuilding(p.x, p.y);
                if (ok) setPendingPlacement(null);
              } else {
                setPendingPlacement(p);
              }
            } else {
              placeBuilding(p.x, p.y);
            }
            return;
          }
          const s = survivors.find(s => Math.abs(s.x - p.x) < 0.7 && Math.abs(s.y - p.y) < 0.7);
          if (s) return selectSurvivor(s.id);
          const b = buildings.find(b => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h);
          if (b) return selectBuilding(b.id);
          selectTile(p.x, p.y);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (borderMode) { exitBorderMode(); return; }
          if (buildPlacement) cancelBuild();
        }}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
          transition: smoothZoom ? "transform 180ms ease-out" : "none",
          backgroundColor: TILE_PAL.grass.base,
          cursor: (buildPlacement || borderMode) ? "crosshair" : "default",
        }}
      >
        <defs>
          <pattern id="water-pat" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#3a5868" />
            <path d="M0 4 Q2.5 2 5 4 T10 4" stroke="#5e8294" strokeWidth="0.6" fill="none" opacity="0.6" />
            <path d="M0 8 Q2.5 6 5 8 T10 8" stroke="#456676" strokeWidth="0.5" fill="none" opacity="0.5" />
          </pattern>
          <radialGradient id="vignette" cx="50%" cy="50%" r="65%">
            <stop offset="60%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
          </radialGradient>
          {/* Surveyor hatch — valid (amber/parchment) */}
          <pattern id="ghost-hatch-ok" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(201,161,74,0.14)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#c9a14a" strokeWidth="0.6" opacity="0.55" />
          </pattern>
          {/* Surveyor hatch — invalid (rusted iron) */}
          <pattern id="ghost-hatch-bad" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(140,40,30,0.18)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#b14a3a" strokeWidth="0.6" opacity="0.6" />
            <line x1="3" y1="0" x2="3" y2="6" stroke="#1a1208" strokeWidth="0.4" opacity="0.4" />
          </pattern>
        </defs>

        {/* Isometric world projection — everything inside this group is
            drawn in square world space and projected to 2:1 diamonds. */}
        <g ref={isoGroupRef} transform={isoMatrixString(mapH)}>


        <StaticTileLayers tiles={tiles} width={W} height={H} />

        {/* Territory bounds (rectangle) */}
        {territory && territory.radius > 0 && (() => {
          const halfW = territory.halfW ?? territory.radius;
          const halfH = territory.halfH ?? territory.radius;
          return (
            <rect
              x={(territory.cx - halfW) * TILE}
              y={(territory.cy - halfH) * TILE}
              width={halfW * 2 * TILE}
              height={halfH * 2 * TILE}
              fill="rgba(201,161,74,0.04)"
              stroke={PAL.gold}
              strokeWidth={1.5}
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          );
        })()}
        {borderMode && territory && hover && (() => {
          const r = Math.max(3, Math.min(40, Math.round(
            Math.max(Math.abs(hover.x + 0.5 - territory.cx), Math.abs(hover.y + 0.5 - territory.cy))
          )));
          return (
            <rect
              x={(territory.cx - r) * TILE}
              y={(territory.cy - r) * TILE}
              width={r * 2 * TILE}
              height={r * 2 * TILE}
              fill="rgba(201,161,74,0.08)"
              stroke="#f5d98a"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          );
        })()}


        {/* Resource nodes (trees / rocks / berries / fiber) are merged
            into the depth-sorted entity list below so buildings, fences
            and props in front correctly cover them. */}


        {/* Worn footpaths — tiles repeatedly walked over darken into a
            visible dirt trail. Intensity rises with traffic and caps so
            very busy routes feel like proper paths. */}
        {(() => {
          if (!wornPaths) return null;
          const PATH_MIN = 60;      // wear threshold before a tile starts to show
          const PATH_FULL = 360;    // wear level at which it is fully visible
          const out: React.ReactElement[] = [];
          for (const key in wornPaths) {
            const w = wornPaths[key];
            if (w < PATH_MIN) continue;
            const [sx, sy] = key.split(",");
            const tx = Number(sx), ty = Number(sy);
            if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
            // Don't draw under a road or building footprint.
            const covered = buildings.some(b =>
              b.builtProgress >= 1 &&
              tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h,
            );
            if (covered) continue;
            const t = Math.min(1, (w - PATH_MIN) / (PATH_FULL - PATH_MIN));
            out.push(
              <g key={key} transform={`translate(${tx * TILE}, ${ty * TILE})`} opacity={0.25 + t * 0.5}>
                <rect x={TILE * 0.18} y={TILE * 0.18}
                  width={TILE * 0.64} height={TILE * 0.64}
                  fill="#6e4d22" stroke="#4a3414" strokeWidth={0.5} rx={TILE * 0.15} />
              </g>,
            );
          }
          return out;
        })()}

        {/* Buildings — drawn back-to-front so closer buildings overlap
            farther ones in the iso projection. Each built building is
            wrapped in a counter-transform so it stands upright on top of
            its diamond footprint instead of being sheared. */}

        {(() => {
          // Tile-occupancy maps for auto-connecting visuals.
          //   • fenceAt: any wall/gate kind (so mixed runs connect cleanly)
          //   • roadAt:  any road kind, plus the material at each tile so
          //              joints render with the higher-tier surface visible.
          const FENCE_KINDS = new Set(["fence", "palisade", "stone-wall", "gate"]);
          const ROAD_TIER: Record<string, number> = {
            "dirt-path": 1, "dirt-road": 2, "gravel-road": 3, "paved-road": 4, "stone-road": 5,
          };
          const fenceAt = new Set<string>();
          const roadAt = new Map<string, string>();
          for (const b of buildings) {
            if (b.builtProgress < 1) continue;
            if (FENCE_KINDS.has(b.kind)) {
              for (let dy = 0; dy < b.h; dy++)
                for (let dx = 0; dx < b.w; dx++)
                  fenceAt.add(`${b.x + dx},${b.y + dy}`);
            } else if (ROAD_TIER[b.kind]) {
              for (let dy = 0; dy < b.h; dy++)
                for (let dx = 0; dx < b.w; dx++)
                  roadAt.set(`${b.x + dx},${b.y + dy}`, b.kind);
            }
          }
          const hasFence = (tx: number, ty: number) => fenceAt.has(`${tx},${ty}`);
          const hasRoad = (tx: number, ty: number) => roadAt.has(`${tx},${ty}`);
          // Painter's order: sum of south-east corner coords approximates
          // depth in iso space. Fences are NOT sorted as one big sprite —
          // each fence tile becomes its own sortable entry so trees and
          // other small props that sit in front of a long fence run
          // render on top of it instead of being covered.
          const ordered = [...buildings].sort(
            (a, b) => (a.x + a.w + a.y + a.h) - (b.x + b.w + b.y + b.h),
          );

          const entries: { sort: number; node: React.ReactNode }[] = [];
          for (const b of ordered) {
            const sel = selection.kind === "building" && selection.id === b.id;
            const x = b.x * TILE;
            const y = b.y * TILE;
            const w = b.w * TILE;
            const h = b.h * TILE;
            const built = b.builtProgress >= 1;

            // Under construction: keep the dashed footprint in iso space
            // (renders as a diamond outline on the ground) plus an upright
            // progress label.
            if (!built) {
              entries.push({ sort: b.x + b.w + b.y + b.h, node: (
                <g key={b.id} opacity={0.85}>
                  <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4}
                    fill="rgba(60,42,16,0.55)" stroke="#8b6a1a" strokeWidth={1} strokeDasharray="3 2" />
                  <line x1={x + 2} y1={y + 2} x2={x + w - 2} y2={y + h - 2} stroke="#8b6a1a" strokeWidth={0.5} opacity={0.5} />
                  <line x1={x + w - 2} y1={y + 2} x2={x + 2} y2={y + h - 2} stroke="#8b6a1a" strokeWidth={0.5} opacity={0.5} />
                  <rect x={x + 3} y={y + h - 5} width={(w - 6) * b.builtProgress} height={2} fill={PAL.gold} />
                  <g transform={isoUpright(x + w / 2, y)}>
                    <text x={0} y={-6} textAnchor="middle" fontFamily="Oswald"
                      fontSize="8" fill={PAL.parchment} opacity={0.8}>
                      {b.kind.toUpperCase()}
                    </text>
                  </g>
                </g>
              ) });
              continue;
            }

            // Fences render per-tile with auto-connecting variants.
            // Each tile is its own upright sprite anchored at the south
            // corner of the tile diamond so posts read as standing rails.
            // Roads — render as iso ground tiles with auto-connecting
            // edges. We draw them in raw world space (no isoUpright counter
            // transform) so the rectangle projects naturally into a diamond.
            if (ROAD_TIER[b.kind]) {
              const tx = b.x, ty = b.y;
              const here = b.kind;
              const tierHere = ROAD_TIER[here];
              // Connect to any neighbor road. The renderer picks the
              // higher tier at each joint so seams read clean.
              const nKind = roadAt.get(`${tx},${ty - 1}`);
              const eKind = roadAt.get(`${tx + 1},${ty}`);
              const sKind = roadAt.get(`${tx},${ty + 1}`);
              const wKind = roadAt.get(`${tx - 1},${ty}`);
              const conn = { n: !!nKind, e: !!eKind, s: !!sKind, w: !!wKind };
              const nbInfo = (k?: string) => (k ? { kind: k, tier: ROAD_TIER[k] ?? 1 } : undefined);
              const neighbors = { n: nbInfo(nKind), e: nbInfo(eKind), s: nbInfo(sKind), w: nbInfo(wKind) };
              entries.push({ sort: b.x + b.w + b.y + b.h, node: (
                <g key={b.id}>
                  <RoadTile
                    x={tx * TILE} y={ty * TILE} t={TILE}
                    kind={here} tier={tierHere} connections={conn}
                    neighbors={neighbors}
                  />
                  {sel && (
                    <rect x={tx * TILE + 1} y={ty * TILE + 1} width={TILE - 2} height={TILE - 2}
                      fill="none" stroke={PAL.gold} strokeWidth={1.5} strokeDasharray="3 2" />
                  )}
                </g>
              ) });
              continue;
            }

            // Fences / walls / gates render per-tile with auto-connecting
            // variants. We render them in world space (no isoUpright wrap)
            // so the rails project onto the iso ground axes — that is, an
            // "east" rail runs along the NE-SW iso edge, matching the
            // neighbor relationship. Posts pick up a vertical lift in the
            // FenceArt sprite so they still read as standing rails.
            if (FENCE_KINDS.has(b.kind)) {
              const style: FenceStyleKey =
                b.kind === "stone-wall" ? "weathered"
                : b.kind === "palisade" ? "dark"
                : b.kind === "gate" ? "white"
                : (b.fenceStyle ?? "natural");
              for (let dy = 0; dy < b.h; dy++) {
                for (let dx = 0; dx < b.w; dx++) {
                  const tx = b.x + dx;
                  const ty = b.y + dy;
                  const conn: FenceConn = {
                    n: hasFence(tx, ty - 1),
                    e: hasFence(tx + 1, ty) || (dx + 1 < b.w),
                    s: hasFence(tx, ty + 1),
                    w: hasFence(tx - 1, ty) || dx > 0,
                  };
                  // Per-tile sort key (matches a 1×1 building at this tile)
                  // so trees and props in front of a long fence run can
                  // correctly draw on top of it.
                  entries.push({ sort: tx + ty + 2, node: (
                    <g key={`${b.id}-${tx}-${ty}`}
                       transform={`translate(${tx * TILE}, ${ty * TILE})`}>
                      <FenceArt w={TILE} h={TILE} connections={conn} style={style} />
                    </g>
                  ) });
                }
              }
              if (sel) {
                entries.push({ sort: b.x + b.w + b.y + b.h + 0.5, node: (
                  <rect key={`${b.id}-sel`} x={x + 1} y={y + 1} width={w - 2} height={h - 2}
                    fill="none" stroke={PAL.gold} strokeWidth={1.5} strokeDasharray="3 2" />
                ) });
              }
              continue;
            }

            // Built building: selection halo stays in iso space (diamond
            // footprint on the ground); the art itself is counter-rotated
            // to screen-upright and anchored at the south corner of the
            // iso footprint so the building "sits" on its plot.
            // A black "paved" foundation tile is rendered under every
            // built building so the ground under it always reads as a
            // solid platform — this also lifts the building above water
            // tiles by hiding the water behind an opaque diamond.
            const foundationKinds = new Set<string>([
              "dirt-path", "dirt-road", "gravel-road", "paved-road", "stone-road",
              "fence", "palisade", "stone-wall", "gate",
              "farm-plot", "field", "large-field", "orchard",
            ]);
            const showFoundation = !foundationKinds.has(b.kind);
            entries.push({ sort: b.x + b.w + b.y + b.h, node: (
              <g key={b.id}>
                {showFoundation && (
                  <g>
                    <rect x={x} y={y} width={w} height={h}
                      fill="#0d0a06" />
                    <rect x={x + 0.6} y={y + 0.6}
                      width={w - 1.2} height={h - 1.2}
                      fill="#1a140d" stroke="#2a2014" strokeWidth={0.5} />
                  </g>
                )}
                {sel && (
                  <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2}
                    fill="none" stroke={PAL.gold} strokeWidth={1.5} strokeDasharray="3 2" />
                )}
                <g transform={isoUpright(x + w, y + h)}>

                  <IsoBuilding kind={b.kind} gridW={b.w} gridH={b.h} tile={TILE}
                    farmStage={b.farm?.stage} farmGrowth={b.farm?.growth} />
                  <text
                    x={(b.h - b.w) * TILE / 2}
                    y={-(b.w + b.h) * TILE * 0.5 - 8}
                    textAnchor="middle" fontFamily="Oswald"
                    fontSize="8" fill={PAL.parchment} opacity={sel ? 1 : 0.55}>
                    {b.kind.replace("-", " ").toUpperCase()}
                  </text>
                </g>
              </g>
            ) });
          }
          // Merge resource nodes into the same depth-sorted list so a
          // tree on tile (tx,ty) draws BEHIND any building/fence whose
          // south corner is further down-right, and IN FRONT of those
          // further up-left. Treat each node as a 1×1 footprint.
          for (const n of nodes) {
            if (n.amount <= 0) continue;
            const size = TILE * (n.kind === "trees" ? 1.3 : n.kind === "rocks" ? 1.05 : 0.95);
            const depleted = n.amount < 30;
            const seed = Math.abs((n.x * 73856093) ^ (n.y * 19349663));
            const anchorX = (n.x + 1) * TILE;
            const anchorY = (n.y + 1) * TILE;
            entries.push({ sort: n.x + n.y + 2, node: (
              <g key={`node-${n.id}`} transform={isoUpright(anchorX, anchorY)}
                 opacity={depleted ? 0.6 : 1} pointerEvents="none">
                <g transform={`translate(${-size / 2}, ${-size})`}>
                  <NodeArt kind={n.kind} size={size} seed={seed} />
                </g>
              </g>
            ) });
          }
          entries.sort((a, c) => a.sort - c.sort);
          return entries.map((e, i) => <React.Fragment key={i}>{e.node}</React.Fragment>);
        })()}


        {/* Animals — clustered around their pen */}
        {(() => {
          const ADULT_DAYS: Record<string, number> = { chicken: 30, goat: 90, sheep: 120, cattle: 240 };
          const penById = new Map(buildings.map((b) => [b.id, b]));
          // Group by building to spread positions
          const byPen = new Map<string, typeof animals>();
          for (const a of animals) {
            if (a.dead) continue;
            if (!a.buildingId) continue;
            const pen = penById.get(a.buildingId);
            if (!pen || pen.builtProgress < 1) continue;
            const arr = byPen.get(a.buildingId) ?? [];
            arr.push(a);
            byPen.set(a.buildingId, arr);
          }
          const out: React.ReactElement[] = [];
          for (const [penId, list] of byPen) {
            const pen = penById.get(penId)!;
            const px = pen.x * TILE;
            const py = pen.y * TILE;
            const pw = pen.w * TILE;
            const ph = pen.h * TILE;
            // Reserve a thin inset border so animals stay inside the pen art
            const padX = Math.min(8, pw * 0.18);
            const padY = Math.min(10, ph * 0.35);
            list.forEach((a, i) => {
              const seed = (a.id.charCodeAt(0) * 17 + a.id.charCodeAt(a.id.length - 1) * 31 + i * 53) % 1000;
              const r1 = ((seed * 9301 + 49297) % 233280) / 233280;
              const r2 = ((seed * 1597 + 51749) % 233280) / 233280;
              const cx = px + padX + r1 * (pw - padX * 2);
              const cy = py + padY + r2 * (ph - padY * 1.2);
              const adult = a.ageDays >= (ADULT_DAYS[a.species] ?? 60);
              out.push(
                <g key={a.id} transform={isoUpright(cx, cy)} pointerEvents="none">
                  <AnimalArt species={a.species} dead={a.dead ?? false} adult={adult} />
                </g>,
              );
            });
          }
          return out;
        })()}



        {/* Conversation links — Sims-style "they're chatting" arcs */}
        {(() => {
          const links: { a: typeof survivors[number]; b: typeof survivors[number]; key: string }[] = [];
          const seen = new Set<string>();
          for (const a of survivors) {
            if (a.health <= 0 || a.state !== "socializing") continue;
            for (const b of survivors) {
              if (b.id === a.id || b.health <= 0) continue;
              if (b.state !== "socializing") continue;
              const dx = b.x - a.x, dy = b.y - a.y;
              if (dx * dx + dy * dy > 2.6 * 2.6) continue;
              const k = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
              if (seen.has(k)) continue;
              seen.add(k);
              links.push({ a, b, key: k });
            }
          }
          return links.map(({ a, b, key }) => {
            const ax = a.x * TILE + TILE / 2;
            const ay = a.y * TILE + TILE / 2 - 6;
            const bx = b.x * TILE + TILE / 2;
            const by = b.y * TILE + TILE / 2 - 6;
            const mx = (ax + bx) / 2;
            const my = (ay + by) / 2 - 4;
            return (
              <g key={`talk-${key}`} pointerEvents="none">
                <path d={`M${ax} ${ay} Q${mx} ${my} ${bx} ${by}`}
                  fill="none" stroke="#c9a14a" strokeWidth={0.4}
                  strokeDasharray="0.8 1.2" opacity={0.55} />
              </g>
            );
          });
        })()}

        {/* Survivors */}
        {survivors.map((s, idx) => {
          const sel = selection.kind === "survivor" && selection.id === s.id;
          const cx = s.x * TILE + TILE / 2;
          const cy = s.y * TILE + TILE / 2;
          const dead = s.health <= 0;
          const sleeping = !dead && s.state === "resting";
          // Find a nearby chat partner (Sims-style pairing).
          let partner: typeof survivors[number] | undefined;
          if (!dead && s.state === "socializing") {
            for (const o of survivors) {
              if (o.id === s.id || o.health <= 0) continue;
              if (o.state !== "socializing") continue;
              const dx = o.x - s.x, dy = o.y - s.y;
              if (dx * dx + dy * dy <= 2.6 * 2.6) { partner = o; break; }
            }
          }
          // Coworker small-talk: when working, a nearby worker triggers a
          // brief, intermittent speech bubble — without hiding the work icon.
          let workMate: typeof survivors[number] | undefined;
          if (!dead && s.state === "working") {
            for (const o of survivors) {
              if (o.id === s.id || o.health <= 0) continue;
              if (o.state !== "working" && o.state !== "socializing") continue;
              const dx = o.x - s.x, dy = o.y - s.y;
              if (dx * dx + dy * dy <= 1.8 * 1.8) { workMate = o; break; }
            }
          }
          // Face the partner: mirror sprite if partner sits to the left.
          const faceLeft = partner ? (partner.x < s.x) : false;
          // Stagger speech-bubble timing so the conversation looks turn-based.
          const speakOffset = partner
            ? ((s.id < partner.id) ? "0s" : "1.4s")
            : "0s";
          // Stagger work small-talk by hashing id so coworkers don't sync.
          const workTalkOffset = workMate
            ? `${(s.id.charCodeAt(0) % 6) * 0.7}s`
            : "0s";
          return (
            <g key={s.id} style={{ pointerEvents: "all", cursor: "pointer" }} transform={isoUpright(cx, cy)}>
              {sel && (
                <circle cx={0} cy={1} r={10} fill="none" stroke={PAL.gold} strokeWidth={1.3} strokeDasharray="2 2" />
              )}
              <g transform={
                sleeping
                  ? "rotate(-78) translate(0,-1)"
                  : (faceLeft ? "scale(-1,1)" : undefined)
              }>
                <SurvivorArt founder={!!s.isFounder} dead={dead} female={s.gender === "f"} stage={s.stage} pregnant={!!s.pregnant} />
              </g>
              {dead && (
                <line x1={-4} y1={-3} x2={4} y2={3} stroke={PAL.ink} strokeWidth={0.8} />
              )}
              {!dead && <ActivityGlyph survivor={s} partnerNearby={!!partner} speakOffset={speakOffset} />}
              {!dead && workMate && <WorkSmallTalkBubble begin={workTalkOffset} />}
            </g>
          );
        })}

        {/* Outside threat — wandering zombies beyond the perimeter */}
        <ZombieLayer />

        {/* Ghost placement — surveyor's stake, parchment-styled */}
        {ghost && (() => {
          const px = ghost.x * TILE;
          const py = ghost.y * TILE;
          const pw = ghost.w * TILE;
          const ph = ghost.h * TILE;
          const accent = ghost.valid ? "#c9a14a" : "#b14a3a";
          const ink = ghost.valid ? "#3a2a12" : "#2a0e0a";
          const bracket = Math.min(8, Math.min(pw, ph) * 0.32);
          return (
            <g pointerEvents="none">
              {/* Hatched fill */}
              <rect x={px} y={py} width={pw} height={ph}
                fill={`url(#ghost-hatch-${ghost.valid ? "ok" : "bad"})`} />
              {/* Dashed survey outline */}
              <rect x={px + 0.5} y={py + 0.5} width={pw - 1} height={ph - 1}
                fill="none" stroke={accent} strokeWidth="0.9"
                strokeDasharray="2.5 1.8" opacity="0.95" />
              {/* Inner ink shadow line for parchment feel */}
              <rect x={px + 1.6} y={py + 1.6} width={pw - 3.2} height={ph - 3.2}
                fill="none" stroke={ink} strokeWidth="0.4" opacity="0.45"
                strokeDasharray="1 2" />
              {/* Corner brackets (mirrors UI corner-brackets style) */}
              {[
                [px, py, 1, 1],
                [px + pw, py, -1, 1],
                [px, py + ph, 1, -1],
                [px + pw, py + ph, -1, -1],
              ].map(([cx, cy, sx, sy], i) => (
                <g key={i}>
                  <line x1={cx} y1={cy} x2={cx + sx * bracket} y2={cy}
                    stroke={accent} strokeWidth="1.4" strokeLinecap="square" />
                  <line x1={cx} y1={cy} x2={cx} y2={cy + sy * bracket}
                    stroke={accent} strokeWidth="1.4" strokeLinecap="square" />
                </g>
              ))}
              {/* Invalid: charcoal cross-out */}
              {!ghost.valid && (
                <>
                  <line x1={px + 2} y1={py + 2} x2={px + pw - 2} y2={py + ph - 2}
                    stroke={ink} strokeWidth="1.1" opacity="0.55" />
                  <line x1={px + pw - 2} y1={py + 2} x2={px + 2} y2={py + ph - 2}
                    stroke={ink} strokeWidth="1.1" opacity="0.55" />
                </>
              )}
              {/* Surveyor's stake label */}
              {pendingPlacement && (
                <g>
                  <rect x={px + pw / 2 - Math.max(28, pw * 0.6)} y={py - 11}
                    width={Math.max(56, pw * 1.2)} height={9}
                    fill="#1a1208" stroke={accent} strokeWidth="0.6" opacity="0.92" rx="0.5" />
                  <text x={px + pw / 2} y={py - 4.5}
                    textAnchor="middle" fontSize="5.5" fill={accent}
                    fontFamily="ui-serif, Georgia, serif"
                    style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {ghost.valid ? "Tap again — break ground" : (ghost.reason || "No good")}
                  </text>
                </g>
              )}
            </g>
          );
        })()}
        </g>

        <rect x={0} y={0} width={ISO.w} height={ISO.h} fill="url(#vignette)" pointerEvents="none" />
      </svg>
      </div>
    </div>
  );
}
