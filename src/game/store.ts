import { create } from "zustand";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import type {
  ArrivalEvent, Building, BuildingKind, ChronicleEntry, Family, GameSpeed, GameTime, ID,
  Relationship, ResourceKind, ResourceNode, SaveGame, SettlementStats,
  Survivor, Tile,
} from "./types";
import {
  MAP_W, MAP_H, generateWorld, makeFounder, makeHomesteadBuilding,
  makeFounderFamily, generateArrival, type FounderInput,
} from "./sim/world";
import { advance, type Engine } from "./sim/engine";
import { BUILDINGS } from "./data/content";
import { saveToLocal, loadFromLocal } from "./persistence";
import { makeRng } from "./sim/rng";

export type Screen = "menu" | "founder" | "game";
export type Overlay = "tree" | "family" | "chronicle" | null;

export interface SelectionNone { kind: "none" }
export interface SelectionSurvivor { kind: "survivor"; id: string }
export interface SelectionBuilding { kind: "building"; id: string }
export interface SelectionTile { kind: "tile"; x: number; y: number }
export interface SelectionFamily { kind: "family"; id: string }
export type Selection = SelectionNone | SelectionSurvivor | SelectionBuilding | SelectionTile | SelectionFamily;

export type BuildPlacement = { kind: BuildingKind } | null;

interface GameState {
  screen: Screen;
  overlay: Overlay;
  ranchName: string;
  seed: number;
  time: GameTime;
  speed: GameSpeed;

  tiles: Tile[];
  mapW: number;
  mapH: number;
  nodes: ResourceNode[];
  buildings: Building[];
  resources: Record<ResourceKind, number>;
  survivors: Survivor[];
  relationships: Relationship[];
  families: Family[];
  founderId: ID;
  currentLeaderId: ID;
  chronicle: ChronicleEntry[];
  stats: SettlementStats;

  selection: Selection;
  buildPlacement: BuildPlacement;

  // Arrival event (transient — pauses the simulation while open)
  pendingArrival: ArrivalEvent | null;
  reputation: number; // -100..100, affects future arrivals
  lastChronicleId: ID | null;

  // actions
  setScreen: (s: Screen) => void;
  setOverlay: (o: Overlay) => void;
  setSpeed: (s: GameSpeed) => void;
  selectSurvivor: (id: string) => void;
  selectBuilding: (id: string) => void;
  selectTile: (x: number, y: number) => void;
  selectFamily: (id: string) => void;
  clearSelection: () => void;
  startBuild: (kind: BuildingKind) => void;
  cancelBuild: () => void;
  placeBuilding: (x: number, y: number) => boolean;
  setOccupation: (id: string, occ: Survivor["occupation"]) => void;
  newGame: (ranchName: string, founderInput: FounderInput) => void;
  resumeFromSave: () => boolean;
  save: () => boolean;
  tickReal: (deltaMs: number) => void;
  acceptArrival: () => void;
  rejectArrival: () => void;
}

const emptyResources = (): Record<ResourceKind, number> => ({
  wood: 18, stone: 8, food: 70, water: 60, fiber: 8, tools: 1,
});

const emptyStats = (year: number, dynasty: string): SettlementStats => ({
  population: 0, morale: 0, prestige: 0,
  foundedYear: year, generations: 0, dynastyName: dynasty,
  totalBorn: 0, totalDied: 0,
});

// arrivals roughly every ~6 game days at 1x speed
const ARRIVAL_CHECK_TICKS = 240 * 3; // every 3 days


export const useGame = create<GameState>((set, get) => ({
  screen: "menu",
  overlay: null,
  ranchName: "The Hollow Ranch",
  seed: 1,
  time: { tick: 0, day: 1, season: "spring", year: 1 },
  speed: 1,
  tiles: [], mapW: MAP_W, mapH: MAP_H,
  nodes: [], buildings: [],
  resources: emptyResources(),
  survivors: [], relationships: [], families: [],
  founderId: "", currentLeaderId: "",
  chronicle: [],
  stats: emptyStats(1, ""),
  selection: { kind: "none" },
  buildPlacement: null,
  pendingArrival: null,
  reputation: 0,
  lastChronicleId: null,

  setScreen: (s) => set({ screen: s }),
  setOverlay: (o) => set({ overlay: o }),
  setSpeed: (s) => set({ speed: s }),
  selectSurvivor: (id) => set({ selection: { kind: "survivor", id } }),
  selectBuilding: (id) => set({ selection: { kind: "building", id } }),
  selectTile: (x, y) => set({ selection: { kind: "tile", x, y } }),
  selectFamily: (id) => set({ selection: { kind: "family", id } }),
  clearSelection: () => set({ selection: { kind: "none" } }),
  startBuild: (kind) => set({ buildPlacement: { kind }, selection: { kind: "none" } }),
  cancelBuild: () => set({ buildPlacement: null }),

  placeBuilding: (x, y) => {
    const st = get();
    const bp = st.buildPlacement;
    if (!bp) return false;
    const def = BUILDINGS[bp.kind];
    if (x < 0 || y < 0 || x + def.size.w > st.mapW || y + def.size.h > st.mapH) return false;
    for (const b of st.buildings) {
      if (x + def.size.w <= b.x || y + def.size.h <= b.y || b.x + b.w <= x || b.y + b.h <= y) continue;
      return false;
    }
    for (let dy = 0; dy < def.size.h; dy++) {
      for (let dx = 0; dx < def.size.w; dx++) {
        const t = st.tiles[(y + dy) * st.mapW + (x + dx)];
        if (!t) return false;
        if (t.kind === "water" && bp.kind !== "well") return false;
        if (t.kind === "stone" && bp.kind !== "well") return false;
      }
    }
    for (const [r, amt] of Object.entries(def.cost)) {
      if ((st.resources as any)[r] < (amt ?? 0)) return false;
    }
    const newResources = { ...st.resources };
    for (const [r, amt] of Object.entries(def.cost)) {
      (newResources as any)[r] -= amt ?? 0;
    }
    const b: Building = {
      id: nanoid(10),
      kind: bp.kind,
      x, y,
      w: def.size.w, h: def.size.h,
      builtProgress: def.buildEffort === 0 ? 1 : 0,
      effortRemaining: def.buildEffort,
      buildEffortTotal: def.buildEffort,
      completedYear: def.buildEffort === 0 ? st.time.year : null,
      occupantIds: [],
      stored: {},
    };
    set({
      buildings: [...st.buildings, b],
      resources: newResources,
      buildPlacement: null,
    });
    return true;
  },

  setOccupation: (id, occ) => {
    const st = get();
    set({
      survivors: st.survivors.map(s => s.id === id ? { ...s, occupation: occ } : s),
    });
  },

  newGame: (ranchName, founderInput) => {
    const seed = Math.floor(Math.random() * 0xffffffff);
    const { tiles, nodes, homesteadTile } = generateWorld(seed);
    const founder = makeFounder(founderInput, homesteadTile);
    const family = makeFounderFamily(founder, 1);
    founder.familyId = family.id;
    const homestead = makeHomesteadBuilding(homesteadTile);
    set({
      screen: "game",
      overlay: null,
      ranchName,
      seed,
      time: { tick: 0, day: 1, season: "spring", year: 1 },
      speed: 1,
      tiles, mapW: MAP_W, mapH: MAP_H, nodes,
      buildings: [homestead],
      resources: emptyResources(),
      survivors: [founder],
      relationships: [],
      families: [family],
      founderId: founder.id,
      currentLeaderId: founder.id,
      chronicle: [
        {
          id: nanoid(8),
          tick: 0, year: 1, season: "spring", day: 1,
          category: "founding",
          title: `${founder.name} ${founder.surname} stands on the porch`,
          body: `The road is empty behind them. The fields are empty in front. They put down the bag. They start to count what they have.`,
          involvedIds: [founder.id],
          involvedFamilyIds: [family.id],
        },
      ],
      stats: { ...emptyStats(1, family.name), population: 1, morale: 20, prestige: family.prestige },
      selection: { kind: "survivor", id: founder.id },
      buildPlacement: null,
    });
  },

  resumeFromSave: () => {
    const save = loadFromLocal();
    if (!save) return false;
    set({
      screen: "game",
      overlay: null,
      ranchName: save.ranchName,
      seed: save.seed,
      time: save.time,
      speed: save.speed,
      tiles: save.tiles, mapW: save.mapW, mapH: save.mapH,
      nodes: save.resourceNodes,
      buildings: save.buildings,
      resources: save.resources,
      survivors: save.survivors,
      relationships: save.relationships,
      families: save.families,
      founderId: save.founderId,
      currentLeaderId: save.currentLeaderId,
      chronicle: save.chronicle,
      stats: save.stats,
      selection: { kind: "none" },
      buildPlacement: null,
    });
    return true;
  },

  save: () => {
    const st = get();
    const data: SaveGame = {
      version: 2,
      ranchName: st.ranchName,
      seed: st.seed,
      time: st.time,
      speed: st.speed,
      tiles: st.tiles,
      mapW: st.mapW, mapH: st.mapH,
      resourceNodes: st.nodes,
      survivors: st.survivors,
      relationships: st.relationships,
      families: st.families,
      founderId: st.founderId,
      currentLeaderId: st.currentLeaderId,
      buildings: st.buildings,
      resources: st.resources,
      chronicle: st.chronicle,
      stats: st.stats,
      factions: [], laws: [], externalSettlements: [],
    };
    return saveToLocal(data);
  },

  tickReal: (deltaMs) => {
    const st = get();
    if (st.speed === 0 || st.screen !== "game") return;
    if (st.pendingArrival) return; // pause while the player decides
    const tps = 12 * (st.speed === 1 ? 1 : st.speed === 2 ? 2 : 4);
    const n = Math.max(1, Math.floor((deltaMs / 1000) * tps));

    const eng: Engine = {
      time: { ...st.time },
      tiles: st.tiles, mapW: st.mapW, mapH: st.mapH,
      nodes: st.nodes.map(n => ({ ...n })),
      buildings: st.buildings.map(b => ({ ...b, stored: { ...b.stored }, occupantIds: [...b.occupantIds] })),
      resources: { ...st.resources },
      survivors: st.survivors.map(s => ({
        ...s,
        needs: { ...s.needs },
        skills: { ...s.skills },
        memories: [...s.memories],
        parentIds: [...s.parentIds],
        childrenIds: [...s.childrenIds],
        achievements: s.achievements ? [...s.achievements] : [],
        carrying: s.carrying ? { ...s.carrying } : null,
      })),
      relationships: st.relationships.map(r => ({ ...r })),
      families: st.families.map(f => ({
        ...f,
        memberIds: [...f.memberIds],
        relations: { ...f.relations },
      })),
      founderId: st.founderId,
      currentLeaderId: st.currentLeaderId,
      chronicle: [...st.chronicle],
      stats: { ...st.stats },
      seed: st.seed,
    };

    const prevTick = st.time.tick;
    advance(eng, n);
    const newTick = eng.time.tick;

    // Notifications for new chronicle entries
    let lastId = st.lastChronicleId;
    if (eng.chronicle.length > 0) {
      const idxLast = lastId ? eng.chronicle.findIndex(c => c.id === lastId) : eng.chronicle.length;
      const fresh = idxLast === -1 ? eng.chronicle.slice(0, 5) : eng.chronicle.slice(0, idxLast);
      for (let i = fresh.length - 1; i >= 0; i--) {
        const c = fresh[i];
        notifyChronicle(c);
      }
      lastId = eng.chronicle[0]?.id ?? lastId;
    }

    // Arrival roll — checked on cadence ticks crossed during this advance
    let pendingArrival: ArrivalEvent | null = st.pendingArrival;
    if (!pendingArrival) {
      const crossed = Math.floor(newTick / ARRIVAL_CHECK_TICKS) - Math.floor(prevTick / ARRIVAL_CHECK_TICKS);
      if (crossed > 0) {
        const rng = makeRng(eng.seed ^ Math.floor(newTick / ARRIVAL_CHECK_TICKS));
        const h = eng.buildings.find(b => b.kind === "homestead");
        const alive = eng.survivors.filter(s => s.health > 0).length;
        // base probability per cadence: lower than before, capped by pop
        const reputationMod = st.reputation * 0.002;
        const popMod = -Math.min(0.35, alive * 0.025);
        const moodMod = eng.stats.morale > 0 ? 0.05 : -0.05;
        const p = Math.max(0.05, 0.35 + reputationMod + popMod + moodMod);
        if (h && Math.random() < p) {
          const around = { x: h.x + h.w / 2, y: h.y + h.h / 2 };
          pendingArrival = generateArrival(rng, newTick, eng.time.year, around);
          toast(pendingArrival.title, {
            description: "Strangers at the gate — decide their fate.",
          });
        }
      }
    }

    set({
      time: eng.time,
      nodes: eng.nodes,
      buildings: eng.buildings,
      resources: eng.resources,
      survivors: eng.survivors,
      relationships: eng.relationships,
      families: eng.families,
      currentLeaderId: eng.currentLeaderId,
      chronicle: eng.chronicle,
      stats: eng.stats,
      pendingArrival,
      lastChronicleId: lastId,
    });
  },

  acceptArrival: () => {
    const st = get();
    const ev = st.pendingArrival;
    if (!ev) return;
    const newResources = { ...st.resources };
    for (const [r, amt] of Object.entries(ev.gifts)) {
      (newResources as any)[r] = ((newResources as any)[r] ?? 0) + (amt ?? 0);
    }
    const newChronicle: ChronicleEntry = {
      id: nanoid(8),
      tick: st.time.tick,
      year: st.time.year, season: st.time.season, day: st.time.day,
      category: "arrival",
      title: `${ev.title} — welcomed in`,
      body: `${ev.survivors.length} new soul${ev.survivors.length === 1 ? "" : "s"} joined the ranch. ${ev.blurb}`,
      involvedIds: ev.survivors.map(s => s.id),
      involvedFamilyIds: [ev.family.id],
    };
    toast.success(`Welcomed ${ev.survivors.length} to the ranch`);
    set({
      survivors: [...st.survivors, ...ev.survivors],
      families: [...st.families, ev.family],
      resources: newResources,
      chronicle: [newChronicle, ...st.chronicle],
      pendingArrival: null,
      reputation: Math.min(100, st.reputation + 4),
      lastChronicleId: newChronicle.id,
    });
  },

  rejectArrival: () => {
    const st = get();
    const ev = st.pendingArrival;
    if (!ev) return;
    const newChronicle: ChronicleEntry = {
      id: nanoid(8),
      tick: st.time.tick,
      year: st.time.year, season: st.time.season, day: st.time.day,
      category: "departure",
      title: `${ev.title} — turned away`,
      body: `The Founder sent them on. The road that took them away takes their story with it.`,
      involvedFamilyIds: [],
    };
    toast.warning(`Sent ${ev.survivors.length} away`);
    set({
      chronicle: [newChronicle, ...st.chronicle],
      pendingArrival: null,
      reputation: Math.max(-100, st.reputation - 3),
      lastChronicleId: newChronicle.id,
    });
  },
}));

function notifyChronicle(c: ChronicleEntry) {
  switch (c.category) {
    case "birth": toast.success(c.title); break;
    case "marriage": toast.success(c.title); break;
    case "death": toast.error(c.title); break;
    case "construction": toast(c.title, { description: "Construction complete." }); break;
    case "succession": toast(c.title, { description: "A new hand on the porch." }); break;
    case "coming-of-age": toast(c.title); break;
    case "arrival": toast(c.title); break;
    case "season": /* quiet */ break;
    default: break;
  }
}

