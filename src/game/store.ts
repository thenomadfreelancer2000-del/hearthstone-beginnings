import { create } from "zustand";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import type {
  ArrivalEvent, Building, BuildingKind, ChronicleEntry, Family, GameSpeed, GameTime, ID,
  Relationship, ResourceKind, ResourceNode, SaveGame, SettlementStats,
  Survivor, Territory, Tile,
} from "./types";
import {
  MAP_W, MAP_H, generateWorld, makeFounder, makeHomesteadBuilding,
  makeFounderFamily, generateArrival, type FounderInput,
} from "./sim/world";
import { advance, type Engine } from "./sim/engine";
import { BUILDINGS } from "./data/content";
import { saveToLocal, loadFromLocal } from "./persistence";
import { makeRng } from "./sim/rng";
import { normalizeConstructionBuilding } from "./sim/construction";
import { CROPS, STARTER_CROP_IDS, isCropId, type CropId } from "./data/crops";

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
  // Building awaiting builder assignment (transient)
  pendingBuildAssignment: ID | null;
  // Farm plot awaiting crop+farmer selection (transient)
  pendingFarmSetup: ID | null;
  // Crops the settlement currently knows how to grow.
  unlockedCrops: string[];
  reputation: number; // -100..100, affects future arrivals
  lastChronicleId: ID | null;

  // ── Founding Phase ────────────────────────────────────────────
  foundingPhase: boolean;
  territory: Territory | null;
  borderMode: boolean;

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
  assignBuilder: (buildingId: ID, survivorId: ID | null) => void;
  autoAssignBuilder: (buildingId: ID) => void;
  closeBuildAssignment: () => void;
  configureFarm: (buildingId: ID, cropId: string, farmerId: ID | null) => void;
  assignFarmer: (buildingId: ID, farmerId: ID | null) => void;
  setFarmCrop: (buildingId: ID, cropId: string) => void;
  closeFarmSetup: () => void;
  // Housing
  assignSurvivorToHome: (survivorId: ID, buildingId: ID | null) => void;
  setHomeReserved: (buildingId: ID, reserved: boolean) => void;
  autoAssignHomeless: () => void;
  newGame: (ranchName: string, founderInput: FounderInput) => void;
  resumeFromSave: () => boolean;
  save: () => boolean;
  tickReal: (deltaMs: number) => void;
  acceptArrival: () => void;
  rejectArrival: () => void;
  // Founding phase
  enterBorderMode: () => void;
  exitBorderMode: () => void;
  setBorderFromClick: (x: number, y: number) => void;
  completeFounding: () => void;
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
  pendingBuildAssignment: null,
  pendingFarmSetup: null,
  unlockedCrops: [...STARTER_CROP_IDS],
  reputation: 0,
  lastChronicleId: null,
  foundingPhase: false,
  territory: null,
  borderMode: false,

  setScreen: (s) => set({ screen: s }),
  setOverlay: (o) => set({ overlay: o }),
  setSpeed: (s) => set({ speed: s }),
  selectSurvivor: (id) => set({ selection: { kind: "survivor", id } }),
  selectBuilding: (id) => set({ selection: { kind: "building", id } }),
  selectTile: (x, y) => set({ selection: { kind: "tile", x, y } }),
  selectFamily: (id) => set({ selection: { kind: "family", id } }),
  clearSelection: () => set({ selection: { kind: "none" } }),
  startBuild: (kind) => {
    const st = get();
    // First-time fence during founding: auto-encircle the territory.
    if (
      kind === "fence" &&
      st.foundingPhase &&
      st.territory &&
      st.territory.radius > 0 &&
      !st.buildings.some((b) => b.kind === "fence")
    ) {
      const { cx, cy, radius } = st.territory;
      const used = new Set<string>();
      // Sample circle densely; round to integer tiles, dedupe.
      const steps = Math.max(48, Math.ceil(2 * Math.PI * radius * 1.2));
      const tiles: { x: number; y: number }[] = [];
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(a) * radius - 0.5);
        const y = Math.round(cy + Math.sin(a) * radius - 0.5);
        if (x < 0 || y < 0 || x >= st.mapW || y >= st.mapH) continue;
        const key = `${x},${y}`;
        if (used.has(key)) continue;
        // skip if collides with existing building
        if (st.buildings.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) continue;
        const t = st.tiles[y * st.mapW + x];
        if (!t || t.kind === "water" || t.kind === "stone") continue;
        used.add(key);
        tiles.push({ x, y });
      }
      const newFences: Building[] = tiles.map((p) => ({
        id: nanoid(10),
        kind: "fence",
        x: p.x, y: p.y, w: 1, h: 1,
        builtProgress: 1,
        effortRemaining: 0,
        buildEffortTotal: BUILDINGS.fence.buildEffort,
        completedYear: st.time.year,
        assignedBuilderId: null,
        resourcesDelivered: { wood: BUILDINGS.fence.cost.wood ?? 0 },
        lastWorkedTick: null,
        stalledTicks: 0,
        occupantIds: [],
        stored: {},
        farm: null,
      }));
      set({
        buildings: [...st.buildings, ...newFences],
        buildPlacement: null,
        selection: { kind: "none" },
      });
      toast.success(`Fence raised around the ranch (${newFences.length} segments)`);
      return;
    }
    set({ buildPlacement: { kind }, selection: { kind: "none" } });
  },
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
    // Restrict to claimed territory (when one has been defined).
    if (st.territory && st.territory.radius > 0) {
      const tx = x + def.size.w / 2;
      const ty = y + def.size.h / 2;
      if (Math.hypot(tx - st.territory.cx, ty - st.territory.cy) > st.territory.radius) {
        toast.error("Outside ranch territory");
        return false;
      }
    }
    for (const [r, amt] of Object.entries(def.cost)) {
      if ((st.resources as any)[r] < (amt ?? 0)) return false;
    }
    const newResources = { ...st.resources };
    for (const [r, amt] of Object.entries(def.cost)) {
      (newResources as any)[r] -= amt ?? 0;
    }
    const isInstant = def.buildEffort === 0;
    const resourcesDelivered = Object.fromEntries(
      Object.entries(def.cost).map(([resource, amount]) => [resource, amount ?? 0]),
    ) as Partial<Record<ResourceKind, number>>;
    const b: Building = {
      id: nanoid(10),
      kind: bp.kind,
      x, y,
      w: def.size.w, h: def.size.h,
      builtProgress: isInstant ? 1 : 0,
      effortRemaining: def.buildEffort,
      buildEffortTotal: def.buildEffort,
      completedYear: isInstant ? st.time.year : null,
      assignedBuilderId: null,
      resourcesDelivered,
      lastWorkedTick: null,
      stalledTicks: 0,
      occupantIds: [],
      stored: {},
      farm: bp.kind === "farm-plot"
        ? {
            cropId: "corn",
            stage: "empty",
            growth: 0,
            plantedTick: null,
            plantedYear: null,
            assignedFarmerId: null,
            lastYield: null,
            totalHarvests: 0,
          }
        : null,
    };
    set({
      buildings: [...st.buildings, b],
      resources: newResources,
      buildPlacement: null,
      // Open assignment modal only for buildings that actually need labor.
      pendingBuildAssignment: isInstant || bp.kind === "farm-plot" ? null : b.id,
      // Open farm setup once a plot is placed.
      pendingFarmSetup: bp.kind === "farm-plot" ? b.id : st.pendingFarmSetup,
    });
    return true;
  },

  setOccupation: (id, occ) => {
    const st = get();
    set({
      survivors: st.survivors.map(s => s.id === id ? { ...s, occupation: occ } : s),
    });
  },

  assignBuilder: (buildingId, survivorId) => {
    const st = get();
    set({
      buildings: st.buildings.map(b =>
        b.id === buildingId ? { ...b, assignedBuilderId: survivorId } : b
      ),
      pendingBuildAssignment: st.pendingBuildAssignment === buildingId ? null : st.pendingBuildAssignment,
    });
  },

  autoAssignBuilder: (buildingId) => {
    const st = get();
    const b = st.buildings.find(x => x.id === buildingId);
    if (!b) return;
    const candidates = st.survivors.filter(s =>
      s.health > 0 && (s.stage === "adult" || s.stage === "youth" || s.stage === "elder" || s.isFounder)
    );
    // Pick highest build skill; ties broken by closer to site, then non-leader preference.
    candidates.sort((a, b2) => {
      const sa = a.skills.build ?? 1;
      const sb = b2.skills.build ?? 1;
      if (sa !== sb) return sb - sa;
      const da = Math.hypot(a.x - (b.x + b.w/2), a.y - (b.y + b.h/2));
      const db = Math.hypot(b2.x - (b.x + b.w/2), b2.y - (b.y + b.h/2));
      return da - db;
    });
    const pick = candidates[0];
    set({
      buildings: st.buildings.map(x =>
        x.id === buildingId ? { ...x, assignedBuilderId: pick?.id ?? null } : x
      ),
      pendingBuildAssignment: st.pendingBuildAssignment === buildingId ? null : st.pendingBuildAssignment,
    });
  },

  closeBuildAssignment: () => set({ pendingBuildAssignment: null }),

  configureFarm: (buildingId, cropId, farmerId) => {
    const st = get();
    const finalCrop = isCropId(cropId) && st.unlockedCrops.includes(cropId) ? cropId : "corn";
    set({
      buildings: st.buildings.map(b => {
        if (b.id !== buildingId) return b;
        const farm = b.farm ?? {
          cropId: finalCrop, stage: "empty" as const, growth: 0,
          plantedTick: null, plantedYear: null, assignedFarmerId: null,
          lastYield: null, totalHarvests: 0,
        };
        return {
          ...b,
          farm: {
            ...farm,
            cropId: finalCrop,
            assignedFarmerId: farmerId ?? null,
          },
        };
      }),
      pendingFarmSetup: st.pendingFarmSetup === buildingId ? null : st.pendingFarmSetup,
    });
  },

  assignFarmer: (buildingId, farmerId) => {
    const st = get();
    set({
      buildings: st.buildings.map(b =>
        b.id === buildingId && b.farm
          ? { ...b, farm: { ...b.farm, assignedFarmerId: farmerId } }
          : b
      ),
    });
  },

  setFarmCrop: (buildingId, cropId) => {
    const st = get();
    if (!isCropId(cropId) || !st.unlockedCrops.includes(cropId)) return;
    set({
      buildings: st.buildings.map(b => {
        if (b.id !== buildingId || !b.farm) return b;
        // Changing crop on a non-empty plot resets growth (replanting).
        const reset = b.farm.stage !== "empty";
        return {
          ...b,
          farm: {
            ...b.farm,
            cropId,
            stage: reset ? "empty" : b.farm.stage,
            growth: reset ? 0 : b.farm.growth,
            plantedTick: reset ? null : b.farm.plantedTick,
          },
        };
      }),
    });
  },

  closeFarmSetup: () => set({ pendingFarmSetup: null }),

  assignSurvivorToHome: (survivorId, buildingId) => {
    const st = get();
    let buildings = st.buildings;
    const survivors = st.survivors.map(s => {
      if (s.id !== survivorId) return s;
      const prev = s.homeId;
      if (prev === buildingId) return s;
      // remove from old
      if (prev) {
        buildings = buildings.map(b => b.id === prev ? { ...b, occupantIds: b.occupantIds.filter(id => id !== s.id) } : b);
      }
      // add to new (capacity check)
      if (buildingId) {
        const tgt = buildings.find(b => b.id === buildingId);
        if (!tgt) return s;
        const cap = BUILDINGS[tgt.kind]?.housingCapacity ?? 0;
        if ((tgt.occupantIds?.length ?? 0) >= cap) {
          toast.warning("Home is full");
          return s;
        }
        buildings = buildings.map(b => b.id === buildingId ? { ...b, occupantIds: [...b.occupantIds, s.id] } : b);
        const prevKind = s.lastHomeKind ?? null;
        const prevQ = prevKind ? (BUILDINGS[prevKind]?.housingQuality ?? 0) : 0;
        const newQ = BUILDINGS[tgt.kind]?.housingQuality ?? 0;
        return {
          ...s,
          homeId: buildingId,
          lastHomeKind: tgt.kind,
          housingGratitude: newQ > prevQ ? (s.housingGratitude ?? 0) + 10 : (s.housingGratitude ?? 0),
        };
      }
      return { ...s, homeId: null };
    });
    set({ buildings, survivors });
  },

  setHomeReserved: (buildingId, reserved) => {
    const st = get();
    set({
      buildings: st.buildings.map(b =>
        b.id === buildingId ? { ...b, reserved } : b
      ),
    });
  },

  autoAssignHomeless: () => {
    const st = get();
    const buildings = st.buildings.map(b => ({ ...b, occupantIds: [...b.occupantIds] }));
    const survivors = st.survivors.map(s => ({ ...s }));
    // First re-seed occupantIds from homeIds
    for (const b of buildings) b.occupantIds = [];
    for (const s of survivors) {
      if (s.health <= 0) continue;
      if (s.homeId) {
        const b = buildings.find(x => x.id === s.homeId);
        if (b) b.occupantIds.push(s.id);
        else s.homeId = null;
      }
    }
    for (const s of survivors) {
      if (s.health <= 0 || s.homeId) continue;
      const home = findBestHomeFor(s, buildings, survivors);
      if (home) {
        home.occupantIds.push(s.id);
        s.homeId = home.id;
        s.lastHomeKind = home.kind;
      }
    }
    set({ buildings, survivors });
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
      pendingArrival: null,
      pendingBuildAssignment: null,
      pendingFarmSetup: null,
      unlockedCrops: [...STARTER_CROP_IDS],
      reputation: 0,
      lastChronicleId: null,
      foundingPhase: true,
      territory: {
        cx: homestead.x + homestead.w / 2,
        cy: homestead.y + homestead.h / 2,
        radius: 14,
      },
      borderMode: false,
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
      buildings: save.buildings.map(b => ({
        assignedBuilderId: null,
        ...b,
        // Repair legacy saves missing buildEffortTotal so progress never stalls
        buildEffortTotal: b.buildEffortTotal || Math.max(1, b.effortRemaining + (b.builtProgress > 0 ? 1 : 0)),
      })).map(b => {
        normalizeConstructionBuilding(b);
        return b;
      }),
      resources: save.resources,
      survivors: save.survivors.map(s => ({
        ...s,
        skills: { ...{ social: 1 }, ...s.skills, social: s.skills?.social ?? 1 },
      })),
      relationships: save.relationships,
      families: save.families,
      founderId: save.founderId,
      currentLeaderId: save.currentLeaderId,
      chronicle: save.chronicle,
      stats: save.stats,
      selection: { kind: "none" },
      buildPlacement: null,
      unlockedCrops: (save.unlockedCrops && save.unlockedCrops.length > 0)
        ? save.unlockedCrops
        : [...STARTER_CROP_IDS],
      // Existing saves predate the Founding Phase — skip it.
      foundingPhase: false,
      territory: null,
      borderMode: false,
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
      unlockedCrops: [...st.unlockedCrops],
      factions: [], laws: [], externalSettlements: [],
    };
    return saveToLocal(data);
  },

  tickReal: (deltaMs) => {
    const st = get();
    if (st.speed === 0 || st.screen !== "game") return;
    if (st.pendingArrival) return; // pause while the player decides
    const tps = 8 * (st.speed === 1 ? 1 : st.speed === 2 ? 2 : 4);
    const n = Math.max(1, Math.floor((deltaMs / 1000) * tps));

    const eng: Engine = {
      time: { ...st.time },
      tiles: st.tiles, mapW: st.mapW, mapH: st.mapH,
      nodes: st.nodes.map(n => ({ ...n })),
      buildings: st.buildings.map(b => ({
        ...b,
        stored: { ...b.stored },
        occupantIds: [...b.occupantIds],
        resourcesDelivered: { ...(b.resourcesDelivered ?? {}) },
        farm: b.farm ? { ...b.farm } : null,
      })),
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
      foundingPhase: st.foundingPhase,
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

    // Arrival roll — checked on cadence ticks crossed during this advance.
    // No arrivals occur during the Founding Phase.
    let pendingArrival: ArrivalEvent | null = st.pendingArrival;
    if (!pendingArrival && !st.foundingPhase) {
      const crossed = Math.floor(newTick / ARRIVAL_CHECK_TICKS) - Math.floor(prevTick / ARRIVAL_CHECK_TICKS);
      if (crossed > 0) {
        const rng = makeRng(eng.seed ^ Math.floor(newTick / ARRIVAL_CHECK_TICKS));
        const h = eng.buildings.find(b => b.kind === "homestead");
        const alive = eng.survivors.filter(s => s.health > 0).length;
        // base probability per cadence: lower than before, capped by pop
        const reputationMod = st.reputation * 0.002;
        const popMod = -Math.min(0.35, alive * 0.025);
        const moodMod = eng.stats.morale > 0 ? 0.05 : -0.05;
        const p = Math.max(0.05, 0.315 + reputationMod + popMod + moodMod);
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
    if (st.foundingPhase) maybeCompleteFounding(get, set);
  },

  acceptArrival: () => {
    const st = get();
    const ev = st.pendingArrival;
    if (!ev) return;
    const newResources = { ...st.resources };
    for (const [r, amt] of Object.entries(ev.gifts)) {
      (newResources as any)[r] = ((newResources as any)[r] ?? 0) + (amt ?? 0);
    }
    const newKnown = new Set(st.unlockedCrops);
    const newlyUnlocked: string[] = [];
    for (const cid of ev.cropKnowledge ?? []) {
      if (!newKnown.has(cid)) { newKnown.add(cid); newlyUnlocked.push(cid); }
    }
    const unlockedSummary = newlyUnlocked.length
      ? ` New crops to plant: ${newlyUnlocked.map(c => CROPS[c as CropId]?.name ?? c).join(", ")}.`
      : "";
    const newChronicle: ChronicleEntry = {
      id: nanoid(8),
      tick: st.time.tick,
      year: st.time.year, season: st.time.season, day: st.time.day,
      category: "arrival",
      title: `${ev.title} — welcomed in`,
      body: `${ev.survivors.length} new soul${ev.survivors.length === 1 ? "" : "s"} joined the ranch. ${ev.blurb}${unlockedSummary}`,
      involvedIds: ev.survivors.map(s => s.id),
      involvedFamilyIds: [ev.family.id],
    };
    toast.success(`Welcomed ${ev.survivors.length} to the ranch`);
    if (newlyUnlocked.length) {
      toast(`New crops unlocked: ${newlyUnlocked.map(c => CROPS[c as CropId]?.name ?? c).join(", ")}`);
    }
    set({
      survivors: [...st.survivors, ...ev.survivors],
      families: [...st.families, ev.family],
      resources: newResources,
      chronicle: [newChronicle, ...st.chronicle],
      pendingArrival: null,
      reputation: Math.min(100, st.reputation + 4),
      lastChronicleId: newChronicle.id,
      unlockedCrops: Array.from(newKnown),
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

  enterBorderMode: () => set({ borderMode: true, buildPlacement: null }),
  exitBorderMode: () => set({ borderMode: false }),
  setBorderFromClick: (x, y) => {
    const st = get();
    if (!st.borderMode) return;
    const t = st.territory;
    if (!t) return;
    const r = Math.max(3, Math.min(40, Math.round(Math.hypot(x - t.cx, y - t.cy))));
    set({ territory: { ...t, radius: r }, borderMode: false });
    toast.success(`Ranch border claimed — ${territoryAcres(r)} acres`);
    maybeCompleteFounding(get, set);
  },
  completeFounding: () => {
    const st = get();
    if (!st.foundingPhase) return;
    const t = st.territory;
    const founder = st.survivors.find(s => s.id === st.founderId);
    const firstBuilt = st.buildings
      .filter(b => b.kind !== "homestead" && b.builtProgress >= 1)
      .slice(0, 5)
      .map(b => BUILDINGS[b.kind].name);
    const entry: ChronicleEntry = {
      id: nanoid(8),
      tick: st.time.tick,
      year: st.time.year, season: st.time.season, day: st.time.day,
      category: "founding",
      title: "The Ranch Has Been Founded",
      body: `${founder?.name ?? "The Founder"} ${founder?.surname ?? ""} founded ${st.ranchName}. ` +
        `Population: ${st.survivors.filter(s => s.health > 0).length}. ` +
        `Territory: ${t ? territoryAcres(t.radius) : 0} acres. ` +
        `First structures: ${firstBuilt.join(", ") || "—"}.`,
      involvedIds: [st.founderId],
    };
    toast.success("The Ranch Has Been Founded", {
      description: "The simulation begins in earnest.",
    });
    set({
      foundingPhase: false,
      chronicle: [entry, ...st.chronicle],
      lastChronicleId: entry.id,
    });
  },
}));

function territoryAcres(radius: number): number {
  // 1 tile ≈ 0.1 acre (arbitrary but readable scale).
  return Math.max(1, Math.round(Math.PI * radius * radius * 0.1));
}

function maybeCompleteFounding(
  get: () => GameState,
  set: (partial: Partial<GameState>) => void,
) {
  const st = get();
  if (!st.foundingPhase) return;
  const objs = computeFoundingObjectives(st);
  if (objs.every(o => o.done)) {
    // Defer slightly so toasts stack properly.
    setTimeout(() => useGame.getState().completeFounding(), 100);
  }
  void set;
}

export interface FoundingObjective { id: string; label: string; done: boolean }

export function computeFoundingObjectives(st: GameState): FoundingObjective[] {
  const has = (kinds: BuildingKind[]) =>
    st.buildings.some(b => kinds.includes(b.kind) && b.builtProgress >= 1);
  return [
    { id: "home",   label: "Build a home (Tent or Cabin)",            done: has(["tent", "cabin"]) },
    { id: "water",  label: "Secure water (Well or Water Collector)",  done: has(["well", "water-collector"]) },
    { id: "food",   label: "Secure food (Farm Plot or Foraging Camp)", done: has(["farm-plot", "foraging-camp"]) },
    { id: "fence",  label: "Build a fence to mark the ranch",         done: has(["fence"]) },
  ];
}


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

