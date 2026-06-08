import { nanoid } from "nanoid";
import { chance, makeRng, pick, pickN, rangeInt } from "./rng";
import type {
  ResourceNode, Skills, Survivor, Tile, TileKind, Trait, Background,
  LifeStage, Building,
} from "../types";
import {
  BACKGROUNDS, FIRST_NAMES_F, FIRST_NAMES_M, SURNAMES, TRAITS, BUILDINGS,
} from "../data/content";

export const MAP_W = 36;
export const MAP_H = 28;

interface GenOut {
  tiles: Tile[];
  nodes: ResourceNode[];
  homesteadTile: { x: number; y: number };
}

// Simple noise: smoothed random fields
function field(rng: () => number, w: number, h: number, scale = 5): number[][] {
  const lo: number[][] = [];
  const cw = Math.ceil(w / scale) + 1;
  const ch = Math.ceil(h / scale) + 1;
  for (let y = 0; y < ch; y++) {
    const row: number[] = [];
    for (let x = 0; x < cw; x++) row.push(rng());
    lo.push(row);
  }
  const out: number[][] = [];
  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    const fy = y / scale;
    const y0 = Math.floor(fy), y1 = y0 + 1;
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = x / scale;
      const x0 = Math.floor(fx), x1 = x0 + 1;
      const tx = fx - x0;
      const a = lo[y0][x0] * (1 - tx) + lo[y0][x1] * tx;
      const b = lo[y1][x0] * (1 - tx) + lo[y1][x1] * tx;
      row.push(a * (1 - ty) + b * ty);
    }
    out.push(row);
  }
  return out;
}

export function generateWorld(seed: number): GenOut {
  const rng = makeRng(seed);
  const tiles: Tile[] = [];
  const nodes: ResourceNode[] = [];
  const w = MAP_W, h = MAP_H;
  const elevation = field(rng, w, h, 6);
  const moisture = field(rng, w, h, 7);
  const forestN = field(rng, w, h, 4);

  // tile assignment
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = elevation[y][x];
      const m = moisture[y][x];
      const f = forestN[y][x];
      let kind: TileKind = "grass";
      if (e < 0.18 && m > 0.55) kind = "water";
      else if (e > 0.78) kind = "stone";
      else if (f > 0.66 && e > 0.25) kind = "forest";
      else if (m < 0.32) kind = "dirt";
      else if (m > 0.6) kind = "tall-grass";
      tiles.push({ x, y, kind, variant: Math.floor(rng() * 4) });
    }
  }

  // Carve a clearing near center for the homestead
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const t = tiles[(cy + dy) * w + (cx + dx)];
      if (t) {
        t.kind = Math.abs(dx) + Math.abs(dy) < 2 ? "dirt" : "grass";
      }
    }
  }

  // A few ruin tiles for atmosphere
  for (let i = 0; i < 8; i++) {
    const rx = rangeInt(rng, 2, w - 3);
    const ry = rangeInt(rng, 2, h - 3);
    if (Math.abs(rx - cx) + Math.abs(ry - cy) < 5) continue;
    const t = tiles[ry * w + rx];
    if (t.kind === "grass" || t.kind === "dirt" || t.kind === "tall-grass") t.kind = "ruin";
  }

  // Resource nodes from terrain
  for (const t of tiles) {
    if (t.kind === "forest" && chance(rng, 0.7)) {
      const n: ResourceNode = {
        id: nanoid(8), kind: "trees", x: t.x, y: t.y,
        yields: "wood", amount: rangeInt(rng, 30, 60), max: 60, regrowsPerDay: 0.4,
      };
      nodes.push(n);
      t.resourceNodeId = n.id;
    } else if (t.kind === "stone" && chance(rng, 0.55)) {
      const n: ResourceNode = {
        id: nanoid(8), kind: "rocks", x: t.x, y: t.y,
        yields: "stone", amount: rangeInt(rng, 30, 70), max: 70, regrowsPerDay: 0,
      };
      nodes.push(n);
      t.resourceNodeId = n.id;
    } else if (t.kind === "tall-grass" && chance(rng, 0.18)) {
      const n: ResourceNode = {
        id: nanoid(8), kind: "berries", x: t.x, y: t.y,
        yields: "food", amount: rangeInt(rng, 20, 40), max: 40, regrowsPerDay: 1.5,
      };
      nodes.push(n);
      t.resourceNodeId = n.id;
    }
  }

  // Place a default well marker near water if any close-by
  return { tiles, nodes, homesteadTile: { x: cx, y: cy } };
}

// ── Survivor creation ──────────────────────────────────────────
export interface FounderInput {
  firstName: string;
  surname: string;
  gender: "m" | "f";
  background: Background;
  traits: Trait[]; // exactly 3
  values: ("Family" | "Freedom" | "Security" | "Status" | "Community")[];
}

function emptySkills(): Skills {
  return { forage: 1, cut: 1, mine: 1, build: 1, farm: 1, medic: 1, lead: 1 };
}

function applyBackground(s: Skills, bg: Background): Skills {
  const def = BACKGROUNDS.find(b => b.id === bg)!;
  const out = { ...s };
  for (const [k, v] of Object.entries(def.skills)) {
    (out as any)[k] = Math.max((out as any)[k], v);
  }
  return out;
}

function stageFromAge(age: number): LifeStage {
  if (age < 14) return "child";
  if (age < 19) return "youth";
  if (age < 55) return "adult";
  return "elder";
}

export function makeFounder(input: FounderInput, spawn: { x: number; y: number }): Survivor {
  return {
    id: nanoid(10),
    name: input.firstName,
    surname: input.surname,
    age: 32,
    stage: "adult",
    gender: input.gender,
    background: input.background,
    isFounder: true,
    x: spawn.x, y: spawn.y,
    state: "idle",
    action: "Standing on the porch.",
    traits: input.traits,
    values: input.values,
    occupation: "leader",
    skills: applyBackground(emptySkills(), input.background),
    health: 100, mood: 20,
    needs: { food: 80, water: 80, rest: 90, shelter: 70, belonging: 60, purpose: 80 },
    loyaltyToFounder: 100,
    memories: [],
    parentIds: [],
    childrenIds: [],
    spouseId: null,
    factionId: null,
    politicalLean: 0,
  };
}

export function makeWanderer(rng: () => number, spawn: { x: number; y: number }): Survivor {
  const gender = chance(rng, 0.5) ? "m" : "f";
  const name = pick(rng, gender === "m" ? FIRST_NAMES_M : FIRST_NAMES_F);
  const surname = pick(rng, SURNAMES);
  const bg = pick(rng, BACKGROUNDS).id;
  const traits = pickN(rng, TRAITS, 2 + Math.floor(rng() * 2));
  const values = pickN(rng, ["Family", "Freedom", "Security", "Status", "Community"] as const, 2);
  const age = rangeInt(rng, 17, 54);
  return {
    id: nanoid(10),
    name, surname, age, stage: stageFromAge(age), gender, background: bg,
    isFounder: false,
    x: spawn.x, y: spawn.y, state: "idle", action: "Just arrived. Looking around.",
    traits, values,
    occupation: "idle",
    skills: applyBackground(emptySkills(), bg),
    health: rangeInt(rng, 60, 95),
    mood: rangeInt(rng, -10, 30),
    needs: {
      food: rangeInt(rng, 30, 70),
      water: rangeInt(rng, 30, 70),
      rest: rangeInt(rng, 30, 70),
      shelter: 20, belonging: 10, purpose: 30,
    },
    loyaltyToFounder: rangeInt(rng, 10, 60),
    memories: [],
    parentIds: [], childrenIds: [], spouseId: null,
    factionId: null, politicalLean: rangeInt(rng, -30, 30),
  };
}

// Place the starting homestead building
export function makeHomesteadBuilding(spawn: { x: number; y: number }): Building {
  const def = BUILDINGS.homestead;
  return {
    id: nanoid(10),
    kind: "homestead",
    x: spawn.x - 1, y: spawn.y - 1,
    w: def.size.w, h: def.size.h,
    builtProgress: 1, effortRemaining: 0,
    occupantIds: [], stored: {},
  };
}
