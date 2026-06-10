import { nanoid } from "nanoid";
import { chance, makeRng, pick, pickN, rangeInt } from "./rng";
import type {
  ResourceNode, Skills, Survivor, Tile, TileKind, Trait, Background,
  LifeStage, Building, Family, ID,
} from "../types";
import {
  BACKGROUNDS, FIRST_NAMES_F, FIRST_NAMES_M, SURNAMES, TRAITS, BUILDINGS,
  LIFE_STAGE_THRESHOLDS,
} from "../data/content";

export const MAP_W = 36;
export const MAP_H = 28;

interface GenOut {
  tiles: Tile[];
  nodes: ResourceNode[];
  homesteadTile: { x: number; y: number };
}

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

  for (let i = 0; i < 8; i++) {
    const rx = rangeInt(rng, 2, w - 3);
    const ry = rangeInt(rng, 2, h - 3);
    if (Math.abs(rx - cx) + Math.abs(ry - cy) < 5) continue;
    const t = tiles[ry * w + rx];
    if (t.kind === "grass" || t.kind === "dirt" || t.kind === "tall-grass") t.kind = "ruin";
  }

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

  return { tiles, nodes, homesteadTile: { x: cx, y: cy } };
}

// ── Survivor & Family creation ─────────────────────────────────
export interface FounderInput {
  firstName: string;
  surname: string;
  gender: "m" | "f";
  background: Background;
  traits: Trait[];
  values: ("Family" | "Freedom" | "Security" | "Status" | "Community")[];
}

function emptySkills(): Skills {
  return { forage: 1, cut: 1, mine: 1, build: 1, farm: 1, medic: 1, lead: 1 };
}

function applyBackground(s: Skills, bg: Background): Skills {
  const def = BACKGROUNDS.find(b => b.id === bg);
  if (!def) return s;
  const out = { ...s };
  for (const [k, v] of Object.entries(def.skills)) {
    (out as any)[k] = Math.max((out as any)[k], v);
  }
  return out;
}

export function stageFromAge(age: number): LifeStage {
  if (age < LIFE_STAGE_THRESHOLDS.teen) return "child";
  if (age < LIFE_STAGE_THRESHOLDS.youth) return "teen";
  if (age < LIFE_STAGE_THRESHOLDS.adult) return "youth";
  if (age < LIFE_STAGE_THRESHOLDS.elder) return "adult";
  return "elder";
}

export function makeFounder(input: FounderInput, spawn: { x: number; y: number }): Survivor {
  const id = nanoid(10);
  return {
    id,
    name: input.firstName,
    surname: input.surname,
    age: 32,
    stage: "adult",
    gender: input.gender,
    background: input.background,
    isFounder: true,
    bornTick: 0,
    bornYear: 1 - 32, // for chronicle context
    deathTick: null,
    deathYear: null,
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
    familyId: "", // assigned after Family is created
    parentIds: [],
    childrenIds: [],
    spouseId: null,
    marriedTick: null,
    marriedYear: null,
    generation: 0,
    achievements: ["Founded the ranch"],
    factionId: null,
    politicalLean: 0,
  };
}

export function makeFounderFamily(founder: Survivor, year: number): Family {
  const fam: Family = {
    id: nanoid(10),
    name: founder.surname,
    founderId: founder.id,
    memberIds: [founder.id],
    prestige: 20,
    wealth: 0,
    motto: null,
    foundedYear: year,
    extinctYear: null,
    relations: {},
  };
  return fam;
}

export function makeWandererFamily(survivor: Survivor, year: number): Family {
  return {
    id: nanoid(10),
    name: survivor.surname,
    founderId: survivor.id,
    memberIds: [survivor.id],
    prestige: 5,
    wealth: 0,
    motto: null,
    foundedYear: year,
    extinctYear: null,
    relations: {},
  };
}

export function makeWanderer(
  rng: () => number,
  spawn: { x: number; y: number },
  bornTick: number,
  year: number,
): Survivor {
  const gender = chance(rng, 0.5) ? "m" : "f";
  const name = pick(rng, gender === "m" ? FIRST_NAMES_M : FIRST_NAMES_F);
  const surname = pick(rng, SURNAMES);
  const bgList = BACKGROUNDS.filter(b => b.id !== "native-born");
  const bg = pick(rng, bgList).id;
  const traits = pickN(rng, TRAITS, 2 + Math.floor(rng() * 2));
  const values = pickN(rng, ["Family", "Freedom", "Security", "Status", "Community"] as const, 2);
  const age = rangeInt(rng, 17, 44);
  return {
    id: nanoid(10),
    name, surname, age, stage: stageFromAge(age), gender, background: bg,
    isFounder: false,
    bornTick, bornYear: year - age, deathTick: null, deathYear: null,
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
    familyId: "",
    parentIds: [], childrenIds: [], spouseId: null,
    marriedTick: null, marriedYear: null,
    generation: 0,
    factionId: null, politicalLean: rangeInt(rng, -30, 30),
  };
}

// Create a child from two parents, inheriting traits.
export function makeChild(
  rng: () => number,
  parents: [Survivor, Survivor],
  bornTick: number,
  year: number,
  familyId: ID,
  surname: string,
  generation: number,
  spawn: { x: number; y: number },
): Survivor {
  const gender = chance(rng, 0.5) ? "m" : "f";
  const name = pick(rng, gender === "m" ? FIRST_NAMES_M : FIRST_NAMES_F);

  // Trait inheritance: pick a mix from both parents + small chance of a fresh trait
  const pool = Array.from(new Set([...parents[0].traits, ...parents[1].traits]));
  const inherited = pickN(rng, pool, Math.min(2, pool.length));
  if (chance(rng, 0.35) && inherited.length < 3) {
    const fresh = pick(rng, TRAITS);
    if (!inherited.includes(fresh)) inherited.push(fresh);
  }

  // Value inheritance: pick one from each parent
  const valSet = new Set<"Family" | "Freedom" | "Security" | "Status" | "Community">();
  if (parents[0].values[0]) valSet.add(parents[0].values[0]);
  if (parents[1].values[0]) valSet.add(parents[1].values[0]);
  const values = Array.from(valSet).slice(0, 2);
  if (values.length < 2) values.push("Family");

  // Skill inheritance: average parent skills * 0.3 (start lower than parents)
  const skills = emptySkills();
  (Object.keys(skills) as (keyof Skills)[]).forEach((k) => {
    const avg = (parents[0].skills[k] + parents[1].skills[k]) / 2;
    skills[k] = Math.max(1, avg * 0.3 + rng() * 0.5);
  });

  return {
    id: nanoid(10),
    name, surname,
    age: 0,
    stage: "child",
    gender,
    background: "native-born",
    isFounder: false,
    bornTick, bornYear: year, deathTick: null, deathYear: null,
    x: spawn.x, y: spawn.y, state: "idle", action: "A first cry beneath the eaves.",
    traits: inherited,
    values: values as Survivor["values"],
    occupation: "idle",
    skills,
    health: rangeInt(rng, 75, 95),
    mood: 40,
    needs: { food: 80, water: 80, rest: 90, shelter: 70, belonging: 80, purpose: 40 },
    loyaltyToFounder: 60,
    memories: [],
    familyId,
    parentIds: [parents[0].id, parents[1].id],
    childrenIds: [],
    spouseId: null,
    marriedTick: null, marriedYear: null,
    generation,
    factionId: null, politicalLean: 0,
  };
}

export function makeHomesteadBuilding(spawn: { x: number; y: number }): Building {
  const def = BUILDINGS.homestead;
  return {
    id: nanoid(10),
    kind: "homestead",
    x: spawn.x - 1, y: spawn.y - 1,
    w: def.size.w, h: def.size.h,
    builtProgress: 1, effortRemaining: 0, buildEffortTotal: 0,
    completedYear: 1,
    occupantIds: [], stored: {},
  };
}
