import React, { useMemo, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { BUILDINGS } from "@/game/data/content";
import type { Tile } from "@/game/types";
import treeSprite from "@/assets/sprites/tree.png";
import rockSprite from "@/assets/sprites/rock.png";
import berriesSprite from "@/assets/sprites/berries.png";
import homesteadSprite from "@/assets/sprites/homestead.png";
import campfireSprite from "@/assets/sprites/campfire.png";
import farmSprite from "@/assets/sprites/farm.png";
import waterCollectorSprite from "@/assets/sprites/water-collector.png";
import foragingCampSprite from "@/assets/sprites/foraging-camp.png";
import survivorSprite from "@/assets/sprites/survivor.png";
import survivorFounderSprite from "@/assets/sprites/survivor-founder.png";

const BUILDING_SPRITES: Record<string, string> = {
  homestead: homesteadSprite,
  campfire: campfireSprite,
  "farm-plot": farmSprite,
  "water-collector": waterCollectorSprite,
  "foraging-camp": foragingCampSprite,
};

const TILE = 28;

// Two-tone palettes for richer tile shading (base + accent)
const TILE_PAL: Record<Tile["kind"], { a: string; b: string; c: string }> = {
  grass:        { a: "#3d4a26", b: "#4a5a2e", c: "#5a6b36" },
  "tall-grass": { a: "#4f5e2c", b: "#5e6f36", c: "#728242" },
  dirt:         { a: "#5c3d1a", b: "#6e4920", c: "#825828" },
  forest:       { a: "#243520", b: "#2f4327", c: "#3b5230" },
  stone:        { a: "#5e564c", b: "#6b6258", c: "#7d7466" },
  water:        { a: "#2f4d5e", b: "#3a5868", c: "#4a6e80" },
  road:         { a: "#3d2a10", b: "#4a3418", c: "#5a4220" },
  ruin:         { a: "#3a3022", b: "#46392a", c: "#544632" },
};

// Deterministic pseudo-random from coords for texture detail placement
function rand(x: number, y: number, salt = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 13.37) * 43758.5453;
  return n - Math.floor(n);
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
          {/* Water ripples */}
          <pattern id="water-pat" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#3a5868" />
            <path d="M0 3 Q2 1 4 3 T8 3" stroke="#5a7e90" strokeWidth="0.5" fill="none" opacity="0.5" />
            <path d="M0 6 Q2 4 4 6 T8 6" stroke="#4a6e80" strokeWidth="0.5" fill="none" opacity="0.4" />
          </pattern>
          {/* Shingle roof pattern */}
          <pattern id="shingle" x="0" y="0" width="6" height="4" patternUnits="userSpaceOnUse">
            <rect width="6" height="4" fill="#6b2a1f" />
            <path d="M0 4 Q3 2 6 4" stroke="#451a13" strokeWidth="0.6" fill="none" />
            <path d="M-3 2 Q0 0 3 2 T9 2" stroke="#451a13" strokeWidth="0.4" fill="none" opacity="0.6" />
          </pattern>
          {/* Plank wall pattern */}
          <pattern id="planks" x="0" y="0" width="8" height="5" patternUnits="userSpaceOnUse">
            <rect width="8" height="5" fill="#6b4a24" />
            <line x1="0" y1="0" x2="8" y2="0" stroke="#3d2a10" strokeWidth="0.5" />
            <line x1="0" y1="5" x2="8" y2="5" stroke="#3d2a10" strokeWidth="0.4" opacity="0.6" />
            <line x1="0" y1="2.5" x2="8" y2="2.5" stroke="#5a3d1c" strokeWidth="0.3" opacity="0.5" />
          </pattern>
          {/* Stone wall pattern */}
          <pattern id="stones" x="0" y="0" width="10" height="6" patternUnits="userSpaceOnUse">
            <rect width="10" height="6" fill="#7d7466" />
            <path d="M0 3 H4 M4 0 V3 M4 3 H10 M7 3 V6" stroke="#4a4338" strokeWidth="0.6" />
          </pattern>
          {/* Drop shadow for entities */}
          <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          {/* Tree foliage gradient */}
          <radialGradient id="foliage" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#6a8a4e" />
            <stop offset="60%" stopColor="#4a6735" />
            <stop offset="100%" stopColor="#243a1a" />
          </radialGradient>
          {/* Rock gradient */}
          <linearGradient id="rock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b8b3a4" />
            <stop offset="100%" stopColor="#6b6458" />
          </linearGradient>
          {/* Vignette */}
          <radialGradient id="vignette" cx="50%" cy="50%" r="65%">
            <stop offset="60%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
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
          // Variant-driven base color
          const baseFill = t.variant % 3 === 0 ? pal.b : pal.a;
          return (
            <g key={`${t.x}-${t.y}`}>
              <rect x={px} y={py} width={TILE} height={TILE} fill={baseFill} />
              {/* Soft diagonal highlight */}
              <rect x={px} y={py} width={TILE} height={TILE} fill="rgba(255,230,170,0.025)" />
            </g>
          );
        })}

        {/* Tile detail layer — tufts, pebbles, cracks (deterministic) */}
        {tiles.map((t) => {
          const px = t.x * TILE;
          const py = t.y * TILE;
          const pal = TILE_PAL[t.kind];
          const details: React.ReactElement[] = [];
          if (t.kind === "grass" || t.kind === "tall-grass") {
            const n = t.kind === "tall-grass" ? 4 : 2;
            for (let i = 0; i < n; i++) {
              const rx = px + rand(t.x, t.y, i) * (TILE - 4) + 2;
              const ry = py + rand(t.x, t.y, i + 10) * (TILE - 4) + 2;
              details.push(
                <path key={`g${i}`} d={`M${rx} ${ry} l-1 -3 M${rx} ${ry} l0 -4 M${rx} ${ry} l1 -3`}
                  stroke={pal.c} strokeWidth={0.6} opacity={0.7} />
              );
            }
          } else if (t.kind === "dirt") {
            if (rand(t.x, t.y, 1) > 0.5) {
              const rx = px + rand(t.x, t.y, 2) * (TILE - 6) + 3;
              const ry = py + rand(t.x, t.y, 3) * (TILE - 6) + 3;
              details.push(<circle key="p" cx={rx} cy={ry} r={1} fill={pal.c} opacity={0.6} />);
            }
          } else if (t.kind === "stone") {
            if (rand(t.x, t.y, 1) > 0.4) {
              const rx = px + rand(t.x, t.y, 2) * (TILE - 6) + 3;
              const ry = py + rand(t.x, t.y, 3) * (TILE - 6) + 3;
              details.push(<circle key="s" cx={rx} cy={ry} r={1.2} fill={pal.c} opacity={0.7} />);
            }
          } else if (t.kind === "forest") {
            if (rand(t.x, t.y, 1) > 0.3) {
              const rx = px + rand(t.x, t.y, 2) * (TILE - 4) + 2;
              const ry = py + rand(t.x, t.y, 3) * (TILE - 4) + 2;
              details.push(<circle key="f" cx={rx} cy={ry} r={1.5} fill={pal.c} opacity={0.5} />);
            }
          } else if (t.kind === "ruin") {
            details.push(
              <path key="r" d={`M${px+4} ${py+TILE-4} l4 -3 l3 2`} stroke={pal.c} strokeWidth={0.5} fill="none" opacity={0.6} />
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
            stroke="#c9a14a"
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
          const cx = n.x * TILE + TILE / 2;
          const cy = n.y * TILE + TILE / 2;
          if (n.amount <= 0) return null;
          const depleted = n.amount < 30;
          if (n.kind === "trees") {
            return (
              <g key={n.id} opacity={depleted ? 0.7 : 1}>
                <ellipse cx={cx} cy={cy + 10} rx={9} ry={2.5} fill="url(#shadow)" />
                <rect x={cx - 1.5} y={cy + 2} width={3} height={7} fill="#3d2a10" />
                <rect x={cx - 1.5} y={cy + 2} width={1} height={7} fill="#5a3d1c" opacity={0.6} />
                <circle cx={cx} cy={cy - 2} r={10} fill="url(#foliage)" />
                <circle cx={cx - 4} cy={cy - 5} r={5} fill="#6a8a4e" opacity={0.7} />
                <circle cx={cx + 5} cy={cy - 3} r={4} fill="#7a9a5e" opacity={0.6} />
                <circle cx={cx - 2} cy={cy - 7} r={2} fill="#a8c878" opacity={0.5} />
              </g>
            );
          }
          if (n.kind === "rocks") {
            return (
              <g key={n.id} opacity={depleted ? 0.7 : 1}>
                <ellipse cx={cx} cy={cy + 8} rx={10} ry={2.5} fill="url(#shadow)" />
                <polygon points={`${cx-9},${cy+7} ${cx-5},${cy-5} ${cx+2},${cy-7} ${cx+8},${cy-2} ${cx+9},${cy+6}`}
                  fill="url(#rock)" stroke="#3d3528" strokeWidth={0.6} strokeLinejoin="round" />
                <polygon points={`${cx-4},${cy+5} ${cx-2},${cy-1} ${cx+3},${cy-3} ${cx+5},${cy+3}`}
                  fill="#c4bea8" opacity={0.6} />
                <path d={`M${cx-6} ${cy+2} L${cx-3} ${cy-3}`} stroke="#3d3528" strokeWidth={0.5} opacity={0.7} />
              </g>
            );
          }
          // berries
          return (
            <g key={n.id} opacity={depleted ? 0.7 : 1}>
              <ellipse cx={cx} cy={cy + 7} rx={8} ry={2} fill="url(#shadow)" />
              <circle cx={cx} cy={cy + 2} r={6} fill="#3a5230" />
              <circle cx={cx - 4} cy={cy} r={4} fill="#4a6840" opacity={0.85} />
              <circle cx={cx + 4} cy={cy + 1} r={4} fill="#4a6840" opacity={0.85} />
              <circle cx={cx - 2} cy={cy} r={1.5} fill="#b04d38" />
              <circle cx={cx + 3} cy={cy + 2} r={1.5} fill="#c25540" />
              <circle cx={cx} cy={cy + 4} r={1.3} fill="#8b3a2a" />
              <circle cx={cx - 3} cy={cy + 3} r={1.2} fill="#b04d38" />
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
          const opacity = built ? 1 : 0.6;

          // Scaffolding / ghost frame
          if (!built) {
            return (
              <g key={b.id} opacity={opacity}>
                <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4}
                  fill="rgba(60,42,16,0.5)" stroke="#8b6a1a" strokeWidth={1} strokeDasharray="3 2" />
                <line x1={x + 2} y1={y + 2} x2={x + w - 2} y2={y + h - 2} stroke="#8b6a1a" strokeWidth={0.5} opacity={0.5} />
                <line x1={x + w - 2} y1={y + 2} x2={x + 2} y2={y + h - 2} stroke="#8b6a1a" strokeWidth={0.5} opacity={0.5} />
                <rect x={x + 3} y={y + h - 5} width={(w - 6) * b.builtProgress} height={2} fill="#c9a14a" />
                <text x={x + w / 2} y={y - 2} textAnchor="middle" fontFamily="Oswald"
                  fontSize="8" fill="#c4ae90" opacity={0.7}>{b.kind.toUpperCase()}</text>
              </g>
            );
          }

          // Built renderers per kind
          return (
            <g key={b.id}>
              <ellipse cx={x + w/2} cy={y + h - 1} rx={w/2 - 2} ry={3} fill="url(#shadow)" />
              {b.kind === "homestead" && (
                <g>
                  <rect x={x + 2} y={y + h/3} width={w - 4} height={(h * 2)/3 - 2} fill="url(#planks)" stroke="#2a1a08" strokeWidth={0.8} />
                  <polygon points={`${x},${y + h/3 + 2} ${x + w/2},${y + 2} ${x + w},${y + h/3 + 2}`}
                    fill="url(#shingle)" stroke="#2a1a08" strokeWidth={0.8} />
                  <rect x={x + w/2 - 3} y={y + h - 8} width={6} height={7} fill="#3a2a10" stroke="#1a1208" strokeWidth={0.5} />
                  <circle cx={x + w/2 + 1.5} cy={y + h - 4} r={0.6} fill="#c9a14a" />
                  <rect x={x + 5} y={y + h/3 + 5} width={4} height={4} fill="#2a3a4a" stroke="#1a1208" strokeWidth={0.5} />
                  <rect x={x + w - 9} y={y + h/3 + 5} width={4} height={4} fill="#2a3a4a" stroke="#1a1208" strokeWidth={0.5} />
                  <rect x={x + w - 7} y={y + 4} width={2.5} height={6} fill="#5a4030" />
                </g>
              )}
              {b.kind === "campfire" && (
                <g>
                  <circle cx={x + w/2} cy={y + h/2} r={w/2 - 3} fill="#2a1a08" opacity={0.6} />
                  <path d={`M${x + w/2 - 5} ${y + h/2 + 3} L${x + w/2} ${y + h/2 - 1} L${x + w/2 + 5} ${y + h/2 + 3}`}
                    stroke="#4a2a10" strokeWidth={1.5} fill="none" />
                  <ellipse cx={x + w/2} cy={y + h/2 - 1} rx={4} ry={5} fill="#e8a040" className="pulse-amber" />
                  <ellipse cx={x + w/2} cy={y + h/2 - 2} rx={2} ry={3} fill="#f5d98a" />
                </g>
              )}
              {b.kind === "farm-plot" && b.farm && (() => {
                const crop = CROPS[b.farm.cropId as CropId] ?? CROPS.corn;
                const growth = b.farm.stage === "mature" ? 1 : b.farm.stage === "growing" ? b.farm.growth : 0.05;
                const rows = 4, cols = 4;
                const els: React.ReactElement[] = [];
                els.push(<rect key="soil" x={x + 2} y={y + 2} width={w - 4} height={h - 4} fill="#4a3018" stroke="#2a1a08" strokeWidth={0.6} />);
                for (let r = 0; r < rows; r++) {
                  els.push(<line key={`fr${r}`} x1={x + 3} y1={y + 4 + r * ((h - 6) / (rows - 1))} x2={x + w - 3} y2={y + 4 + r * ((h - 6) / (rows - 1))} stroke="#3a2410" strokeWidth={0.5} />);
                }
                for (let r = 0; r < rows; r++) {
                  for (let cc = 0; cc < cols; cc++) {
                    const dx = x + 4 + cc * ((w - 8) / (cols - 1));
                    const dy = y + 4 + r * ((h - 8) / (rows - 1));
                    els.push(
                      <circle key={`c${r}-${cc}`} cx={dx} cy={dy} r={0.6 + growth * 2}
                        fill={crop.color} opacity={0.4 + growth * 0.6} />
                    );
                    if (growth > 0.6) {
                      els.push(<line key={`s${r}-${cc}`} x1={dx} y1={dy} x2={dx} y2={dy + 2 + growth * 2} stroke="#4a6735" strokeWidth={0.4} />);
                    }
                  }
                }
                return <g>{els}</g>;
              })()}
              {b.kind === "water-collector" && (
                <g>
                  <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} fill="#3a2a10" stroke="#1a1208" strokeWidth={0.8} />
                  <rect x={x + 5} y={y + 5} width={w - 10} height={h - 10} fill="url(#water-pat)" />
                  <rect x={x + 5} y={y + 5} width={w - 10} height={2} fill="#9ec6d8" opacity={0.5} />
                </g>
              )}
              {b.kind === "foraging-camp" && (
                <g>
                  <polygon points={`${x + w/2},${y + 3} ${x + 4},${y + h - 4} ${x + w - 4},${y + h - 4}`}
                    fill="#5a4230" stroke="#2a1a08" strokeWidth={0.8} />
                  <line x1={x + w/2} y1={y + 3} x2={x + w/2} y2={y + h - 4} stroke="#3a2a10" strokeWidth={0.5} />
                  <circle cx={x + w/2 - 3} cy={y + h - 7} r={1.5} fill="#b04d38" />
                  <circle cx={x + w/2 + 2} cy={y + h - 6} r={1.2} fill="#c9a14a" />
                </g>
              )}
              {/* Generic fallback for any other kind */}
              {!["homestead","campfire","farm-plot","water-collector","foraging-camp"].includes(b.kind) && (
                <g>
                  <rect x={x + 2} y={y + h/3} width={w - 4} height={(h * 2)/3 - 2} fill="url(#planks)" stroke="#2a1a08" strokeWidth={0.6} />
                  <polygon points={`${x},${y + h/3 + 2} ${x + w/2},${y + 2} ${x + w},${y + h/3 + 2}`} fill="url(#shingle)" stroke="#2a1a08" strokeWidth={0.6} />
                </g>
              )}
              {/* Selection ring */}
              {sel && (
                <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2}
                  fill="none" stroke="#c9a14a" strokeWidth={1.5} strokeDasharray="3 2" />
              )}
              <text x={x + w / 2} y={y - 2} textAnchor="middle" fontFamily="Oswald"
                fontSize="8" fill="#c4ae90" opacity={sel ? 1 : 0.55}>
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
          const skin = dead ? "#5a4a3a" : "#d8b896";
          const shirt = s.isFounder ? "#8b3a2a" : "#4a6741";
          const pants = "#3a2a18";
          const hat = s.isFounder ? "#3a2a18" : "#5a4230";
          return (
            <g key={s.id} style={{ pointerEvents: "all", cursor: "pointer" }}>
              <ellipse cx={cx} cy={cy + 7} rx={4} ry={1.5} fill="url(#shadow)" />
              {sel && (
                <circle cx={cx} cy={cy + 1} r={9} fill="none" stroke="#c9a14a" strokeWidth={1.2} strokeDasharray="2 2" />
              )}
              {/* Legs */}
              <rect x={cx - 2} y={cy + 3} width={1.6} height={4} fill={pants} />
              <rect x={cx + 0.4} y={cy + 3} width={1.6} height={4} fill={pants} />
              {/* Body */}
              <rect x={cx - 2.5} y={cy - 1} width={5} height={5} rx={1} fill={shirt} />
              {/* Belt */}
              <rect x={cx - 2.5} y={cy + 2.4} width={5} height={0.8} fill="#2a1a08" />
              {/* Arms hint */}
              <rect x={cx - 3.2} y={cy} width={0.8} height={3} fill={shirt} />
              <rect x={cx + 2.4} y={cy} width={0.8} height={3} fill={shirt} />
              {/* Head */}
              <circle cx={cx} cy={cy - 3} r={2.3} fill={skin} />
              {/* Hat brim & crown */}
              <ellipse cx={cx} cy={cy - 4.3} rx={3.5} ry={0.7} fill={hat} />
              <rect x={cx - 1.6} y={cy - 6.2} width={3.2} height={2} rx={0.4} fill={hat} />
              {s.isFounder && (
                <rect x={cx - 1.6} y={cy - 4.8} width={3.2} height={0.4} fill="#c9a14a" />
              )}
              {dead && (
                <line x1={cx - 3} y1={cy - 3} x2={cx + 3} y2={cy + 3} stroke="#1a1208" strokeWidth={0.6} />
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
              stroke="#c9a14a"
              strokeDasharray="3 2"
              strokeWidth="1.5"
              pointerEvents="none" />
          </g>
        )}

        {/* Vignette overlay */}
        <rect x={0} y={0} width={W} height={H} fill="url(#vignette)" pointerEvents="none" />
      </svg>
    </div>
  );
}
