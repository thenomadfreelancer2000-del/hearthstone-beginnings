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
}

const emptyResources = (): Record<ResourceKind, number> => ({
  wood: 12, stone: 6, food: 30, water: 30, fiber: 6, tools: 1,
});

const emptyStats = (year: number, dynasty: string): SettlementStats => ({
  population: 0, morale: 0, prestige: 0,
  foundedYear: year, generations: 0, dynastyName: dynasty,
  totalBorn: 0, totalDied: 0,
});

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

    const rng = makeRng(eng.seed ^ Math.floor(eng.time.tick / 240));

    advance(eng, n, {
      onArrival: () => {
        const h = eng.buildings.find(b => b.kind === "homestead");
        if (!h) return null;
        const sx = h.x + Math.floor(rng() * h.w);
        const sy = h.y + Math.floor(rng() * h.h);
        const wanderer = makeWanderer(rng, { x: sx, y: sy }, eng.time.tick, eng.time.year);
        const wf = makeWandererFamily(wanderer, eng.time.year);
        wanderer.familyId = wf.id;
        eng.families.push(wf);
        return wanderer;
      },
    });

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
    });
  },
}));
