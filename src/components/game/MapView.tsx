import React, { useMemo, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { BUILDINGS } from "@/game/data/content";
import type { Tile } from "@/game/types";

const TILE = 28;

// Unified, muted palette — everything reads as one painted board.
const PAL = {
  ink: "#1a1208",
  inkSoft: "#2a1d10",
  highlight: "rgba(255,232,180,0.06)",
  shadow: "rgba(0,0,0,0.35)",
  gold: "#c9a14a",
  parchment: "#c4ae90",
};

const TILE_PAL: Record<Tile["kind"], { base: string; alt: string; detail: string }> = {
  grass:        { base: "#4a5a2e", alt: "#536432", detail: "#6b7d3f" },
  "tall-grass": { base: "#566a32", alt: "#62763a", detail: "#7d9048" },
  dirt:         { base: "#6e4920", alt: "#7a5326", detail: "#8e6730" },
  forest:       { base: "#2f4327", alt: "#37502d", detail: "#4a6235" },
  stone:        { base: "#6b6258", alt: "#766c61", detail: "#8a8175" },
  water:        { base: "#3a5868", alt: "#456676", detail: "#5e8294" },
  road:         { base: "#4a3418", alt: "#553c1c", detail: "#6a4a26" },
  ruin:         { base: "#46392a", alt: "#504232", detail: "#665540" },
};

function rand(x: number, y: number, salt = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 13.37) * 43758.5453;
  return n - Math.floor(n);
}

// ── Hand-drawn building renderers (unified style) ────────────────
function BuildingArt({ kind, w, h, farmStage, farmGrowth }: { kind: string; w: number; h: number; farmStage?: string; farmGrowth?: number }) {
  // All buildings share: dark ink outline, warm wood tones, simple silhouettes.
  const cx = w / 2;
  switch (kind) {
    case "homestead": {
      // Solid log cabin with peaked roof, chimney
      const roofH = h * 0.45;
      const wallY = roofH;
      const wallH = h - roofH;
      return (
        <g>
          {/* shadow */}
          <ellipse cx={cx} cy={h - 2} rx={w * 0.45} ry={3} fill={PAL.shadow} />
          {/* walls */}
          <rect x={2} y={wallY} width={w - 4} height={wallH - 2} fill="#7a5028" stroke={PAL.ink} strokeWidth={1.2} />
          {/* log lines */}
          <line x1={3} y1={wallY + wallH * 0.35} x2={w - 3} y2={wallY + wallH * 0.35} stroke={PAL.inkSoft} strokeWidth={0.6} opacity={0.6} />
          <line x1={3} y1={wallY + wallH * 0.7} x2={w - 3} y2={wallY + wallH * 0.7} stroke={PAL.inkSoft} strokeWidth={0.6} opacity={0.6} />
          {/* door */}
          <rect x={cx - w * 0.1} y={wallY + wallH * 0.4} width={w * 0.2} height={wallH * 0.55} fill="#3d2810" stroke={PAL.ink} strokeWidth={0.8} />
          {/* roof */}
          <polygon points={`0,${wallY + 2} ${cx},2 ${w},${wallY + 2}`} fill="#5a3820" stroke={PAL.ink} strokeWidth={1.2} />
          <line x1={cx} y1={4} x2={cx} y2={wallY} stroke={PAL.inkSoft} strokeWidth={0.5} opacity={0.5} />
          {/* chimney */}
          <rect x={w * 0.72} y={roofH * 0.2} width={w * 0.1} height={roofH * 0.5} fill="#5e564c" stroke={PAL.ink} strokeWidth={0.8} />
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
      // Furrowed soil, fence posts at corners
      const rows = 4;
      return (
        <g>
          <rect x={1} y={1} width={w - 2} height={h - 2} fill="#5a3818" stroke={PAL.ink} strokeWidth={1} />
          {Array.from({ length: rows }).map((_, i) => {
            const y = 3 + ((h - 6) / rows) * (i + 0.5);
            return <line key={i} x1={3} y1={y} x2={w - 3} y2={y} stroke="#3d2810" strokeWidth={1.4} />;
          })}
          {Array.from({ length: rows }).map((_, i) => {
            const y = 3 + ((h - 6) / rows) * (i + 0.5);
            return <line key={`h${i}`} x1={3} y1={y - 1} x2={w - 3} y2={y - 1} stroke="#8e6730" strokeWidth={0.5} opacity={0.6} />;
          })}
          {/* corner posts */}
          {[[2, 2], [w - 2, 2], [2, h - 2], [w - 2, h - 2]].map(([x, y], i) => (
            <rect key={i} x={x - 1} y={y - 1} width={2} height={2} fill="#3d2810" />
          ))}
        </g>
      );
    }
    case "water-collector": {
      // Wooden barrel
      return (
        <g>
          <ellipse cx={cx} cy={h - 2} rx={w * 0.35} ry={3} fill={PAL.shadow} />
          <rect x={w * 0.18} y={h * 0.2} width={w * 0.64} height={h * 0.72} rx={w * 0.06} fill="#6b4a24" stroke={PAL.ink} strokeWidth={1.2} />
          <ellipse cx={cx} cy={h * 0.2} rx={w * 0.32} ry={h * 0.08} fill="#456676" stroke={PAL.ink} strokeWidth={1} />
          {/* metal bands */}
          <rect x={w * 0.16} y={h * 0.38} width={w * 0.68} height={2} fill="#3a3530" />
          <rect x={w * 0.16} y={h * 0.72} width={w * 0.68} height={2} fill="#3a3530" />
          {/* vertical planks */}
          {[0.35, 0.5, 0.65].map((p, i) => (
            <line key={i} x1={w * p} y1={h * 0.22} x2={w * p} y2={h * 0.9} stroke={PAL.inkSoft} strokeWidth={0.5} opacity={0.6} />
          ))}
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
    default:
      return <rect x={2} y={2} width={w - 4} height={h - 4} fill="#6b4a24" stroke={PAL.ink} strokeWidth={1} />;
  }
}

// ── Hand-drawn resource node ────────────────────────────────────
function NodeArt({ kind, size, seed }: { kind: string; size: number; seed: number }) {
  const s = size;
  if (kind === "trees") {
    // Stylized pine — triangular tiers
    const variant = seed % 3;
    return (
      <g>
        <ellipse cx={s / 2} cy={s * 0.92} rx={s * 0.28} ry={s * 0.06} fill={PAL.shadow} />
        <rect x={s * 0.46} y={s * 0.62} width={s * 0.08} height={s * 0.3} fill="#3d2810" stroke={PAL.ink} strokeWidth={0.6} />
        {variant === 0 ? (
          <>
            <polygon points={`${s/2},${s*0.08} ${s*0.18},${s*0.55} ${s*0.82},${s*0.55}`} fill="#3d5226" stroke={PAL.ink} strokeWidth={0.8} />
            <polygon points={`${s/2},${s*0.22} ${s*0.24},${s*0.65} ${s*0.76},${s*0.65}`} fill="#4a6235" stroke={PAL.ink} strokeWidth={0.8} />
          </>
        ) : variant === 1 ? (
          <>
            <polygon points={`${s/2},${s*0.05} ${s*0.16},${s*0.45} ${s*0.84},${s*0.45}`} fill="#3d5226" stroke={PAL.ink} strokeWidth={0.8} />
            <polygon points={`${s/2},${s*0.2} ${s*0.2},${s*0.6} ${s*0.8},${s*0.6}`} fill="#4a6235" stroke={PAL.ink} strokeWidth={0.8} />
            <polygon points={`${s/2},${s*0.35} ${s*0.24},${s*0.7} ${s*0.76},${s*0.7}`} fill="#566e3e" stroke={PAL.ink} strokeWidth={0.8} />
          </>
        ) : (
          <>
            <circle cx={s/2} cy={s * 0.4} r={s * 0.32} fill="#3d5226" stroke={PAL.ink} strokeWidth={0.8} />
            <circle cx={s * 0.4} cy={s * 0.5} r={s * 0.18} fill="#4a6235" />
            <circle cx={s * 0.62} cy={s * 0.48} r={s * 0.16} fill="#566e3e" />
          </>
        )}
      </g>
    );
  }
  if (kind === "rocks") {
    return (
      <g>
        <ellipse cx={s / 2} cy={s * 0.88} rx={s * 0.32} ry={s * 0.06} fill={PAL.shadow} />
        <polygon points={`${s*0.2},${s*0.8} ${s*0.3},${s*0.4} ${s*0.55},${s*0.3} ${s*0.78},${s*0.45} ${s*0.82},${s*0.8}`}
          fill="#8a8175" stroke={PAL.ink} strokeWidth={1} />
        <polygon points={`${s*0.3},${s*0.4} ${s*0.55},${s*0.3} ${s*0.5},${s*0.55} ${s*0.35},${s*0.6}`}
          fill="#aaa094" />
        <polygon points={`${s*0.55},${s*0.3} ${s*0.78},${s*0.45} ${s*0.65},${s*0.6} ${s*0.5},${s*0.55}`}
          fill="#766c61" />
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

// ── Survivor sprite ──────────────────────────────────────────────
function SurvivorArt({ founder, dead }: { founder: boolean; dead: boolean }) {
  const skin = "#d9b48a";
  const shirt = founder ? "#7a3a2a" : "#3a5a6a";
  const pants = "#3d2810";
  const hat = founder ? "#c9a14a" : "#5a3820";
  return (
    <g opacity={dead ? 0.4 : 1}>
      <ellipse cx={0} cy={9} rx={5} ry={1.6} fill={PAL.shadow} />
      {/* legs */}
      <rect x={-3} y={3} width={2.4} height={5} fill={pants} stroke={PAL.ink} strokeWidth={0.4} />
      <rect x={0.6} y={3} width={2.4} height={5} fill={pants} stroke={PAL.ink} strokeWidth={0.4} />
      {/* body */}
      <rect x={-3.5} y={-3} width={7} height={6.5} rx={1} fill={shirt} stroke={PAL.ink} strokeWidth={0.5} />
      {/* belt */}
      <rect x={-3.5} y={2} width={7} height={1} fill={PAL.ink} opacity={0.6} />
      {/* head */}
      <circle cx={0} cy={-5.5} r={2.8} fill={skin} stroke={PAL.ink} strokeWidth={0.5} />
      {/* hat */}
      <ellipse cx={0} cy={-7.5} rx={4} ry={1} fill={hat} stroke={PAL.ink} strokeWidth={0.5} />
      <rect x={-2} y={-9} width={4} height={2} rx={0.5} fill={hat} stroke={PAL.ink} strokeWidth={0.5} />
    </g>
  );
}

export function MapView() {
  const tiles = useGame((s) => s.tiles);
  const mapW = useGame((s) => s.mapW);
  const mapH = useGame((s) => s.mapH);
  const nodes = useGame((s) => s.nodes);
  const buildings = useGame((s) => s.buildings);
  const survivors = useGame((s) => s.survivors);
  const selection = useGame((s) => s.selection);
  const selectSurvivor = useGame((s) => s.selectSurvivor);
  const selectBuilding = useGame((s) => s.selectBuilding);
  const selectTile = useGame((s) => s.selectTile);
  const buildPlacement = useGame((s) => s.buildPlacement);
  const placeBuilding = useGame((s) => s.placeBuilding);
  const cancelBuild = useGame((s) => s.cancelBuild);
  const territory = useGame((s) => s.territory);
  const borderMode = useGame((s) => s.borderMode);
  const exitBorderMode = useGame((s) => s.exitBorderMode);
  const setBorderFromClick = useGame((s) => s.setBorderFromClick);

  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<SVGSVGElement>(null);

  const W = mapW * TILE;
  const H = mapH * TILE;

  const ghost = useMemo(() => {
    if (!buildPlacement || !hover) return null;
    const def = BUILDINGS[buildPlacement.kind];
    return { x: hover.x, y: hover.y, w: def.size.w, h: def.size.h };
  }, [buildPlacement, hover]);

  function svgToTile(e: React.MouseEvent) {
    const svg = ref.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = pt.matrixTransform(m.inverse());
    return { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
  }

  return (
    <div className="flex-1 relative overflow-auto scroll-amber bg-coal grain">
      <svg
        ref={ref}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
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
            placeBuilding(p.x, p.y);
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
        style={{ cursor: (buildPlacement || borderMode) ? "crosshair" : "default" }}
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
        </defs>

        {/* Base tiles */}
        {tiles.map((t) => {
          const pal = TILE_PAL[t.kind];
          const px = t.x * TILE;
          const py = t.y * TILE;
          if (t.kind === "water") {
            return <rect key={`${t.x}-${t.y}`} x={px} y={py} width={TILE} height={TILE} fill="url(#water-pat)" />;
          }
          const baseFill = t.variant % 3 === 0 ? pal.alt : pal.base;
          return <rect key={`${t.x}-${t.y}`} x={px} y={py} width={TILE} height={TILE} fill={baseFill} />;
        })}

        {/* Tile detail layer */}
        {tiles.map((t) => {
          if (t.kind === "water") return null;
          const px = t.x * TILE;
          const py = t.y * TILE;
          const pal = TILE_PAL[t.kind];
          const details: React.ReactElement[] = [];
          if (t.kind === "grass" || t.kind === "tall-grass") {
            const n = t.kind === "tall-grass" ? 5 : 3;
            for (let i = 0; i < n; i++) {
              const rx = px + rand(t.x, t.y, i) * (TILE - 4) + 2;
              const ry = py + rand(t.x, t.y, i + 10) * (TILE - 4) + 2;
              const len = t.kind === "tall-grass" ? 4 : 2.5;
              details.push(
                <g key={`g${i}`}>
                  <line x1={rx} y1={ry} x2={rx - 1} y2={ry - len} stroke={pal.detail} strokeWidth={0.7} strokeLinecap="round" />
                  <line x1={rx} y1={ry} x2={rx} y2={ry - len - 0.5} stroke={pal.detail} strokeWidth={0.7} strokeLinecap="round" />
                  <line x1={rx} y1={ry} x2={rx + 1} y2={ry - len} stroke={pal.detail} strokeWidth={0.7} strokeLinecap="round" />
                </g>
              );
            }
          } else if (t.kind === "dirt" || t.kind === "road") {
            if (rand(t.x, t.y, 1) > 0.4) {
              const rx = px + rand(t.x, t.y, 2) * (TILE - 6) + 3;
              const ry = py + rand(t.x, t.y, 3) * (TILE - 6) + 3;
              details.push(<circle key="p" cx={rx} cy={ry} r={0.8} fill={pal.detail} opacity={0.7} />);
              const r2x = px + rand(t.x, t.y, 4) * (TILE - 6) + 3;
              const r2y = py + rand(t.x, t.y, 5) * (TILE - 6) + 3;
              details.push(<circle key="p2" cx={r2x} cy={r2y} r={0.6} fill={pal.detail} opacity={0.5} />);
            }
          } else if (t.kind === "stone") {
            if (rand(t.x, t.y, 1) > 0.3) {
              const rx = px + rand(t.x, t.y, 2) * (TILE - 6) + 3;
              const ry = py + rand(t.x, t.y, 3) * (TILE - 6) + 3;
              details.push(<circle key="s" cx={rx} cy={ry} r={1.1} fill={pal.detail} stroke={PAL.ink} strokeWidth={0.3} opacity={0.7} />);
            }
          } else if (t.kind === "forest") {
            if (rand(t.x, t.y, 1) > 0.4) {
              const rx = px + rand(t.x, t.y, 2) * (TILE - 4) + 2;
              const ry = py + rand(t.x, t.y, 3) * (TILE - 4) + 2;
              details.push(<circle key="f" cx={rx} cy={ry} r={1.3} fill={pal.detail} opacity={0.55} />);
            }
          } else if (t.kind === "ruin") {
            details.push(
              <path key="r" d={`M${px+4} ${py+TILE-4} l4 -3 l3 2`} stroke={pal.detail} strokeWidth={0.7} fill="none" opacity={0.7} />
            );
          }
          return details.length ? <g key={`d-${t.x}-${t.y}`}>{details}</g> : null;
        })}

        {/* Territory ring */}
        {territory && territory.radius > 0 && (
          <circle
            cx={territory.cx * TILE}
            cy={territory.cy * TILE}
            r={territory.radius * TILE}
            fill="rgba(201,161,74,0.04)"
            stroke={PAL.gold}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            pointerEvents="none"
          />
        )}
        {borderMode && territory && hover && (() => {
          const r = Math.max(3, Math.min(40, Math.round(
            Math.hypot(hover.x + 0.5 - territory.cx, hover.y + 0.5 - territory.cy)
          )));
          return (
            <circle
              cx={territory.cx * TILE}
              cy={territory.cy * TILE}
              r={r * TILE}
              fill="rgba(201,161,74,0.08)"
              stroke="#f5d98a"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          );
        })()}

        {/* Resource nodes */}
        {nodes.map((n) => {
          if (n.amount <= 0) return null;
          const depleted = n.amount < 30;
          const cx = n.x * TILE + TILE / 2;
          const cy = n.y * TILE + TILE / 2;
          const seed = (n.id.charCodeAt(0) + n.id.charCodeAt(n.id.length - 1)) % 100;
          const size = TILE * (n.kind === "trees" ? 1.3 : n.kind === "rocks" ? 1.05 : 0.95);
          return (
            <g key={n.id} transform={`translate(${cx - size / 2}, ${cy - size * 0.7})`} opacity={depleted ? 0.6 : 1}>
              <NodeArt kind={n.kind} size={size} seed={seed} />
            </g>
          );
        })}

        {/* Buildings */}
        {buildings.map((b) => {
          const sel = selection.kind === "building" && selection.id === b.id;
          const x = b.x * TILE;
          const y = b.y * TILE;
          const w = b.w * TILE;
          const h = b.h * TILE;
          const built = b.builtProgress >= 1;

          if (!built) {
            return (
              <g key={b.id} opacity={0.75}>
                <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4}
                  fill="rgba(60,42,16,0.55)" stroke="#8b6a1a" strokeWidth={1} strokeDasharray="3 2" />
                <line x1={x + 2} y1={y + 2} x2={x + w - 2} y2={y + h - 2} stroke="#8b6a1a" strokeWidth={0.5} opacity={0.5} />
                <line x1={x + w - 2} y1={y + 2} x2={x + 2} y2={y + h - 2} stroke="#8b6a1a" strokeWidth={0.5} opacity={0.5} />
                <rect x={x + 3} y={y + h - 5} width={(w - 6) * b.builtProgress} height={2} fill={PAL.gold} />
                <text x={x + w / 2} y={y - 2} textAnchor="middle" fontFamily="Oswald"
                  fontSize="8" fill={PAL.parchment} opacity={0.75}>{b.kind.toUpperCase()}</text>
              </g>
            );
          }

          return (
            <g key={b.id}>
              <g transform={`translate(${x}, ${y})`}>
                <BuildingArt kind={b.kind} w={w} h={h} />
              </g>
              {sel && (
                <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2}
                  fill="none" stroke={PAL.gold} strokeWidth={1.5} strokeDasharray="3 2" />
              )}
              <text x={x + w / 2} y={y - 2} textAnchor="middle" fontFamily="Oswald"
                fontSize="8" fill={PAL.parchment} opacity={sel ? 1 : 0.55}>
                {b.kind.replace("-", " ").toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Survivors */}
        {survivors.map((s) => {
          const sel = selection.kind === "survivor" && selection.id === s.id;
          const cx = s.x * TILE + TILE / 2;
          const cy = s.y * TILE + TILE / 2;
          const dead = s.health <= 0;
          return (
            <g key={s.id} style={{ pointerEvents: "all", cursor: "pointer" }} transform={`translate(${cx}, ${cy})`}>
              {sel && (
                <circle cx={0} cy={1} r={10} fill="none" stroke={PAL.gold} strokeWidth={1.3} strokeDasharray="2 2" />
              )}
              <SurvivorArt founder={!!s.isFounder} dead={dead} />
              {dead && (
                <line x1={-4} y1={-3} x2={4} y2={3} stroke={PAL.ink} strokeWidth={0.8} />
              )}
            </g>
          );
        })}

        {/* Ghost placement */}
        {ghost && (
          <g>
            <rect x={ghost.x * TILE} y={ghost.y * TILE}
              width={ghost.w * TILE} height={ghost.h * TILE}
              fill="rgba(201,161,74,0.18)"
              stroke={PAL.gold}
              strokeDasharray="3 2"
              strokeWidth="1.5"
              pointerEvents="none" />
          </g>
        )}

        <rect x={0} y={0} width={W} height={H} fill="url(#vignette)" pointerEvents="none" />
      </svg>
    </div>
  );
}
