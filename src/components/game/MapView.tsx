import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { useView } from "@/game/viewStore";
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
      // Post and rail
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.45} ry={1.6} fill={PAL.shadow} />
          <rect x={1.5} y={h * 0.35} width={w - 3} height={1.3} fill="#7a5028" stroke={PAL.ink} strokeWidth={0.5} />
          <rect x={1.5} y={h * 0.62} width={w - 3} height={1.3} fill="#7a5028" stroke={PAL.ink} strokeWidth={0.5} />
          {[0.18, 0.5, 0.82].map((p, i) => (
            <rect key={i} x={w * p - 0.7} y={h * 0.2} width={1.5} height={h * 0.7} fill="#5a3820" stroke={PAL.ink} strokeWidth={0.5} />
          ))}
        </g>
      );
    }
    case "palisade": {
      // Row of sharpened upright logs
      const count = 4;
      const stepW = (w - 2) / count;
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.45} ry={1.6} fill={PAL.shadow} />
          {Array.from({ length: count }).map((_, i) => {
            const x0 = 1 + stepW * i + stepW * 0.1;
            const lw = stepW * 0.8;
            const topY = h * 0.12;
            const baseY = h - 2;
            return (
              <g key={i}>
                <polygon
                  points={`${x0},${topY + 3} ${x0 + lw / 2},${topY} ${x0 + lw},${topY + 3} ${x0 + lw},${baseY} ${x0},${baseY}`}
                  fill="#7a5028"
                  stroke={PAL.ink}
                  strokeWidth={0.7}
                />
                <line x1={x0 + lw / 2} y1={topY + 3} x2={x0 + lw / 2} y2={baseY} stroke={PAL.inkSoft} strokeWidth={0.4} opacity={0.6} />
              </g>
            );
          })}
          {/* binding rope */}
          <line x1={1.5} y1={h * 0.55} x2={w - 1.5} y2={h * 0.55} stroke="#3d2810" strokeWidth={0.6} opacity={0.8} />
        </g>
      );
    }
    case "stone-wall": {
      // Stacked masonry
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.45} ry={1.6} fill={PAL.shadow} />
          <rect x={1.5} y={h * 0.18} width={w - 3} height={h * 0.74} fill="#8a8078" stroke={PAL.ink} strokeWidth={1} />
          {/* crenellation notches */}
          {[0.18, 0.42, 0.66].map((p, i) => (
            <rect key={`cr${i}`} x={w * p} y={h * 0.12} width={w * 0.16} height={h * 0.1} fill="#8a8078" stroke={PAL.ink} strokeWidth={0.8} />
          ))}
          {/* mortar */}
          <line x1={2} y1={h * 0.42} x2={w - 2} y2={h * 0.42} stroke={PAL.inkSoft} strokeWidth={0.5} opacity={0.7} />
          <line x1={2} y1={h * 0.66} x2={w - 2} y2={h * 0.66} stroke={PAL.inkSoft} strokeWidth={0.5} opacity={0.7} />
          <line x1={w * 0.35} y1={h * 0.22} x2={w * 0.35} y2={h * 0.42} stroke={PAL.inkSoft} strokeWidth={0.4} opacity={0.6} />
          <line x1={w * 0.65} y1={h * 0.42} x2={w * 0.65} y2={h * 0.66} stroke={PAL.inkSoft} strokeWidth={0.4} opacity={0.6} />
          <line x1={w * 0.45} y1={h * 0.66} x2={w * 0.45} y2={h * 0.9} stroke={PAL.inkSoft} strokeWidth={0.4} opacity={0.6} />
        </g>
      );
    }
    case "gate": {
      // Two stone pillars + heavy timber doors
      const pillarW = w * 0.16;
      return (
        <g>
          <ellipse cx={cx} cy={h - 1.5} rx={w * 0.48} ry={2} fill={PAL.shadow} />
          {/* pillars */}
          <rect x={1} y={h * 0.08} width={pillarW} height={h * 0.86} fill="#8a8078" stroke={PAL.ink} strokeWidth={1} />
          <rect x={w - 1 - pillarW} y={h * 0.08} width={pillarW} height={h * 0.86} fill="#8a8078" stroke={PAL.ink} strokeWidth={1} />
          <line x1={1} y1={h * 0.45} x2={1 + pillarW} y2={h * 0.45} stroke={PAL.inkSoft} strokeWidth={0.4} opacity={0.7} />
          <line x1={w - 1 - pillarW} y1={h * 0.45} x2={w - 1} y2={h * 0.45} stroke={PAL.inkSoft} strokeWidth={0.4} opacity={0.7} />
          {/* doors */}
          <rect x={1 + pillarW} y={h * 0.22} width={(w - 2 - pillarW * 2) / 2} height={h * 0.72} fill="#5a3820" stroke={PAL.ink} strokeWidth={1} />
          <rect x={cx} y={h * 0.22} width={(w - 2 - pillarW * 2) / 2} height={h * 0.72} fill="#5a3820" stroke={PAL.ink} strokeWidth={1} />
          {/* plank lines */}
          {[0.35, 0.55, 0.75].map((p, i) => (
            <line key={`pl${i}`} x1={1 + pillarW + 0.5} y1={h * p} x2={w - 1 - pillarW - 0.5} y2={h * p} stroke={PAL.inkSoft} strokeWidth={0.4} opacity={0.65} />
          ))}
          {/* iron bands */}
          <rect x={1 + pillarW} y={h * 0.32} width={w - 2 - pillarW * 2} height={1.2} fill="#3a3530" />
          <rect x={1 + pillarW} y={h * 0.78} width={w - 2 - pillarW * 2} height={1.2} fill="#3a3530" />
          {/* knockers */}
          <circle cx={cx - w * 0.06} cy={h * 0.58} r={1} fill="#3a3530" stroke={PAL.ink} strokeWidth={0.3} />
          <circle cx={cx + w * 0.06} cy={h * 0.58} r={1} fill="#3a3530" stroke={PAL.ink} strokeWidth={0.3} />
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
function SurvivorArt({ founder, dead, female }: { founder: boolean; dead: boolean; female: boolean }) {
  const skin = "#d9b48a";
  const shirt = female
    ? (founder ? "#9a4a6a" : "#6a4a8a")
    : (founder ? "#7a3a2a" : "#3a5a6a");
  const pants = "#3d2810";
  const hairColor = founder ? "#4a2818" : "#3a2410";

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


export function MapView() {
  const tiles = useGame((s) => s.tiles);
  const mapW = useGame((s) => s.mapW);
  const mapH = useGame((s) => s.mapH);
  const nodes = useGame((s) => s.nodes);
  const buildings = useGame((s) => s.buildings);
  const survivors = useGame((s) => s.survivors);
  const animals = useGame((s) => s.animals);
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
  const expandWorldToCurrentSize = useGame((s) => s.expandWorldToCurrentSize);

  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<SVGSVGElement>(null);

  const zoom = useView((s) => s.mapZoom);
  const W = mapW * TILE;
  const H = mapH * TILE;
  const VW = W * zoom;
  const VH = H * zoom;

  useEffect(() => {
    expandWorldToCurrentSize();
  }, [expandWorldToCurrentSize]);

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
    <div
      className="flex-1 relative overflow-auto scroll-amber grain"
      style={{ backgroundColor: TILE_PAL.grass.base }}
    >
      <div style={{ width: VW, height: VH, position: "relative" }}>
      <svg
        ref={ref}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
          transition: "transform 180ms ease-out",
          backgroundColor: TILE_PAL.grass.base,
        }}
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

        {/* Territory bounds (rectangle) */}
        {territory && territory.radius > 0 && (
          <rect
            x={(territory.cx - territory.radius) * TILE}
            y={(territory.cy - territory.radius) * TILE}
            width={territory.radius * 2 * TILE}
            height={territory.radius * 2 * TILE}
            fill="rgba(201,161,74,0.04)"
            stroke={PAL.gold}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            pointerEvents="none"
          />
        )}
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
                <BuildingArt kind={b.kind} w={w} h={h} farmStage={b.farm?.stage} farmGrowth={b.farm?.growth} />
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
                <g key={a.id} transform={`translate(${cx}, ${cy})`} pointerEvents="none">
                  <AnimalArt species={a.species} dead={a.dead ?? false} adult={adult} />
                </g>,
              );
            });
          }
          return out;
        })()}



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
              <SurvivorArt founder={!!s.isFounder} dead={dead} female={s.gender === "f"} />
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
    </div>
  );
}
