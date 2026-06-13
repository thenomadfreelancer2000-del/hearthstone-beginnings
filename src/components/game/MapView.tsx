import React, { useMemo, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { BUILDINGS } from "@/game/data/content";
import { CROPS, type CropId } from "@/game/data/crops";
import type { Tile } from "@/game/types";

const TILE = 24;

const TILE_FILL: Record<Tile["kind"], string> = {
  grass: "#3d4a26",
  "tall-grass": "#4f5e2c",
  dirt: "#5c3d1a",
  forest: "#2a3d20",
  stone: "#6b6258",
  water: "#3a5868",
  road: "#3d2a10",
  ruin: "#3a3022",
};

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
        onMouseMove={(e) => {
          const p = svgToTile(e);
          if (p) setHover(p);
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const p = svgToTile(e);
          if (!p) return;
          if (buildPlacement) {
            placeBuilding(p.x, p.y);
            return;
          }
          // pick survivor first
          const s = survivors.find(s => Math.abs(s.x - p.x) < 0.7 && Math.abs(s.y - p.y) < 0.7);
          if (s) return selectSurvivor(s.id);
          const b = buildings.find(b => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h);
          if (b) return selectBuilding(b.id);
          selectTile(p.x, p.y);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (buildPlacement) cancelBuild();
        }}
        style={{ cursor: buildPlacement ? "crosshair" : "default" }}
      >
        {/* tiles */}
        {tiles.map((t) => (
          <rect
            key={`${t.x}-${t.y}`}
            x={t.x * TILE}
            y={t.y * TILE}
            width={TILE}
            height={TILE}
            fill={TILE_FILL[t.kind]}
            opacity={0.9 + (t.variant % 4) * 0.025}
          />
        ))}
        {/* subtle grid */}
        <g stroke="rgba(196,135,42,0.06)" strokeWidth="0.5">
          {Array.from({ length: mapW + 1 }).map((_, i) => (
            <line key={`v${i}`} x1={i * TILE} y1={0} x2={i * TILE} y2={H} />
          ))}
          {Array.from({ length: mapH + 1 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * TILE} x2={W} y2={i * TILE} />
          ))}
        </g>
        {/* resource nodes */}
        {nodes.map((n) => {
          const cx = n.x * TILE + TILE / 2;
          const cy = n.y * TILE + TILE / 2;
          if (n.amount <= 0) return null;
          if (n.kind === "trees") {
            return (
              <g key={n.id}>
                <circle cx={cx} cy={cy + 2} r={9} fill="#2a3d20" />
                <circle cx={cx - 3} cy={cy - 2} r={6} fill="#4a6840" />
                <circle cx={cx + 4} cy={cy - 1} r={5} fill="#3a5430" />
                <rect x={cx - 1} y={cy + 6} width={2} height={4} fill="#3d2a10" />
              </g>
            );
          }
          if (n.kind === "rocks") {
            return (
              <g key={n.id}>
                <polygon points={`${cx-7},${cy+6} ${cx-4},${cy-4} ${cx+3},${cy-5} ${cx+7},${cy+4}`} fill="#8a8878" />
                <polygon points={`${cx-4},${cy+5} ${cx-2},${cy} ${cx+2},${cy-1} ${cx+5},${cy+4}`} fill="#a8a698" />
              </g>
            );
          }
          // berries
          return (
            <g key={n.id}>
              <circle cx={cx - 2} cy={cy} r={3} fill="#8b3a2a" />
              <circle cx={cx + 3} cy={cy + 2} r={2} fill="#b04d38" />
              <circle cx={cx} cy={cy + 4} r={2} fill="#8b3a2a" />
            </g>
          );
        })}
        {/* buildings */}
        {buildings.map((b) => {
          const sel = selection.kind === "building" && selection.id === b.id;
          const x = b.x * TILE;
          const y = b.y * TILE;
          const w = b.w * TILE;
          const h = b.h * TILE;
          const built = b.builtProgress >= 1;
          return (
            <g key={b.id}>
              <rect
                x={x + 2} y={y + 2} width={w - 4} height={h - 4}
                fill={b.kind === "homestead" ? "#5c3d1a" : "#3d2a10"}
                stroke={built ? "#c4872a" : "#8b6a1a"}
                strokeWidth={sel ? 2 : 1}
                strokeDasharray={built ? "0" : "3 2"}
                opacity={built ? 1 : 0.55}
              />
              {b.kind === "homestead" && (
                <polygon
                  points={`${x + 2},${y + h/2} ${x + w/2},${y + 2} ${x + w - 2},${y + h/2}`}
                  fill="#8b3a2a"
                />
              )}
              {b.kind === "farm-plot" && built && b.farm && (() => {
                const crop = CROPS[b.farm.cropId as CropId] ?? CROPS.corn;
                const growth = b.farm.stage === "mature" ? 1 : b.farm.stage === "growing" ? b.farm.growth : 0;
                const dots: React.ReactElement[] = [];
                for (let r = 0; r < 3; r++) {
                  for (let cc = 0; cc < 3; cc++) {
                    const dx = x + 6 + cc * ((w - 12) / 2);
                    const dy = y + 6 + r * ((h - 12) / 2);
                    dots.push(
                      <circle key={`${r}-${cc}`} cx={dx} cy={dy}
                        r={1 + growth * 2.5}
                        fill={crop.color}
                        opacity={0.3 + growth * 0.7}
                      />
                    );
                  }
                }
                return <g>{dots}</g>;
              })()}

              {b.kind === "campfire" && (
                <g>
                  <circle cx={x + w/2} cy={y + h/2} r={4} fill="#c4872a" className="pulse-amber" />
                  <circle cx={x + w/2} cy={y + h/2} r={2} fill="#f5d98a" />
                </g>
              )}
              {!built && (
                <rect
                  x={x + 3} y={y + h - 5} width={(w - 6) * b.builtProgress} height={2}
                  fill="#c4872a"
                />
              )}
              <text
                x={x + w / 2}
                y={y - 2}
                textAnchor="middle"
                fontFamily="Oswald"
                fontSize="8"
                fill="#c4ae90"
                opacity={sel ? 1 : 0.6}
              >
                {b.kind.toUpperCase()}
              </text>
            </g>
          );
        })}
        {/* survivors */}
        {survivors.map((s) => {
          const sel = selection.kind === "survivor" && selection.id === s.id;
          const cx = s.x * TILE + TILE / 2;
          const cy = s.y * TILE + TILE / 2;
          const color = s.isFounder ? "#c4872a" : s.health <= 0 ? "#4a3520" : "#e8dcc8";
          return (
            <g key={s.id} style={{ pointerEvents: "all", cursor: "pointer" }}>
              {sel && (
                <circle cx={cx} cy={cy} r={11} fill="none" stroke="#c4872a" strokeWidth={1.5} />
              )}
              <circle cx={cx} cy={cy + 2} r={4} fill={color} />
              <rect x={cx - 2} y={cy + 4} width={4} height={6} fill={s.isFounder ? "#8b3a2a" : "#4a6741"} />
              {s.isFounder && (
                <circle cx={cx} cy={cy - 4} r={1.5} fill="#c4872a" />
              )}
            </g>
          );
        })}
        {/* ghost placement */}
        {ghost && (
          <rect
            x={ghost.x * TILE} y={ghost.y * TILE}
            width={ghost.w * TILE} height={ghost.h * TILE}
            fill="rgba(196,135,42,0.2)"
            stroke="#c4872a"
            strokeDasharray="3 2"
            strokeWidth="1.5"
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
}
