import { create } from "zustand";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import type {
  Animal, AnimalSpecies, ArrivalEvent, Building, BuildingKind, ChronicleEntry, Family,
  GameSpeed, GameTime, ID, LivestockRequest, Minister, MinisterRequest, MinisterReport, MinisterRole,
  MarriageProposal, Relationship, ResourceKind, ResourceNode, SaveGame, SettlementStats,
  Survivor, Territory, Tile,
} from "./types";
import {
  MAP_W, MAP_H, generateWorld, makeFounder, makeHomesteadBuilding,
  makeFounderFamily, makeWanderer, makeWandererFamily, makeChild, stageFromAge,
  generateArrival, type FounderInput,
} from "./sim/world";

import { advance, type Engine } from "./sim/engine";
import { createArrangedProposal } from "./sim/marriage";
import { BUILDINGS } from "./data/content";
import { makeAnimal, SPECIES_BUILDING, SPECIES_LABEL } from "./sim/livestock";
import {
  ROLE_OCCUPATION, makeMinister, applyApproval, applyRejection,
} from "./sim/ministers";
import { saveToLocal, loadFromLocal } from "./persistence";
import { makeRng } from "./sim/rng";
import { normalizeConstructionBuilding } from "./sim/construction";
import { CROPS, STARTER_CROP_IDS, isCropId, type CropId } from "./data/crops";
import { findBestHome as findBestHomeFor, homeCapacity } from "./sim/housing";
import { getPortrait } from "./data/portraits";
import { TRAIT_INFO, traitRefugeeBias } from "./data/traits";
import { computeFounderEpithet, founderDeathTitle, founderDeathBody } from "./sim/legacy";
import {
  generateCouncilVote, resolveCouncilVote as resolveCouncilVoteLogic,
  buildReactionLog,
  type CouncilVoteEvent, type CouncilAction, type CouncilReactionLogEntry,
} from "./sim/councilVote";
import { LAW_BY_ID, type EnactedLaw } from "./sim/laws";
import { computeFactions, mostHatedLaw, pressingLawDemands } from "./sim/factions";

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
  preferredHeirId: ID | null;
  chronicle: ChronicleEntry[];
  stats: SettlementStats;
  proposals: MarriageProposal[];
  animals: Animal[];
  livestockRequests: LivestockRequest[];
  ministers: Minister[];
  ministerRequests: MinisterRequest[];
  ministerReports: MinisterReport[];




  selection: Selection;
  buildPlacement: BuildPlacement;

  // Arrival event (transient — pauses the simulation while open)
  pendingArrival: ArrivalEvent | null;
  // Annual Council vote (transient — pauses the simulation while open)
  pendingCouncilVote: CouncilVoteEvent | null;
  councilReactionLog: CouncilReactionLogEntry[];
  // Laws of the ranch, enacted at the first Council Charter and amended thereafter.
  laws: import("./sim/laws").EnactedLaw[];
  hasHeldFirstCouncil: boolean;
  // First-council "Founding Charter": founder picks laws when 10+ houses exist.
  pendingFoundingCharter: boolean;
  // Building awaiting builder assignment (transient)
  pendingBuildAssignment: ID | null;
  // Farm plot awaiting crop+farmer selection (transient)
  pendingFarmSetup: ID | null;
  // Crops the settlement currently knows how to grow.
  unlockedCrops: string[];
  reputation: number; // -100..100, affects future arrivals
  reputationProfile: import("./sim/reputation").ReputationProfile;
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
  assignWorker: (buildingId: ID, survivorId: ID | null) => void;
  assignToNode: (nodeId: ID, survivorId: ID | null) => void;
  // Housing
  assignSurvivorToHome: (survivorId: ID, buildingId: ID | null) => void;
  setHomeReserved: (buildingId: ID, reserved: boolean) => void;
  autoAssignHomeless: () => void;
  setPreferredHeir: (id: ID | null) => void;
  setEducationFocus: (childId: ID, focus: "build" | "farm" | "lead" | "social" | "medic" | null) => void;
  newGame: (ranchName: string, founderInput: FounderInput) => void;
  setSurvivorPortrait: (survivorId: ID, portraitId: string) => void;
  expandWorldToCurrentSize: () => void;
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
  // Marriage
  decideProposal: (id: ID, decision: "approve" | "reject" | "postpone") => void;
  arrangeMarriage: (initiatorId: ID, targetId: ID) => boolean;
  // Livestock
  decideLivestockRequest: (id: ID, decision: "approve" | "reject" | "postpone") => void;
  assignRancher: (buildingId: ID, survivorId: ID | null) => void;
  setPenOwner: (buildingId: ID, familyId: ID | null) => void;
  // Ministers
  appointMinister: (role: MinisterRole, survivorId: ID) => void;
  dismissMinister: (ministerId: ID) => void;
  decideMinisterRequest: (id: ID, decision: "approve" | "partial" | "reject" | "postpone", transferIds?: ID[]) => void;
  reassignWorker: (survivorId: ID, occupation: Survivor["occupation"]) => void;
  // Council
  resolveCouncilVote: (action: CouncilAction, demandIndex?: number) => void;
  // Laws
  enactFoundingCharter: (lawIds: string[]) => void;
  repealLaw: (lawId: string) => void;
}

const emptyResources = (): Record<ResourceKind, number> => ({
  wood: 18, stone: 8, food: 70, water: 60, fiber: 8, tools: 1,
  eggs: 0, milk: 0, wool: 0,
});

const emptyStats = (year: number, dynasty: string): SettlementStats => ({
  population: 0, morale: 0, prestige: 0,
  foundedYear: year, generations: 0, dynastyName: dynasty,
  totalBorn: 0, totalDied: 0,
});

function expandSavedWorld(save: SaveGame): SaveGame {
  if (save.mapW >= MAP_W && save.mapH >= MAP_H) return save;
  const base = generateWorld(save.seed);
  const dx = Math.floor((MAP_W - save.mapW) / 2);
  const dy = Math.floor((MAP_H - save.mapH) / 2);
  const inOldFootprint = (x: number, y: number) => x >= dx && x < dx + save.mapW && y >= dy && y < dy + save.mapH;
  const shiftedTiles = save.tiles.map((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  const tileByKey = new Map(shiftedTiles.map((t) => [`${t.x}-${t.y}`, t]));
  const tiles = base.tiles.map((t) => tileByKey.get(`${t.x}-${t.y}`) ?? t);
  const resourceNodes = [
    ...base.nodes.filter((n) => !inOldFootprint(n.x, n.y)),
    ...save.resourceNodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy })),
  ];

  return {
    ...save,
    mapW: MAP_W,
    mapH: MAP_H,
    tiles,
    resourceNodes,
    buildings: save.buildings.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy })),
    survivors: save.survivors.map((s) => ({
      ...s,
      x: s.x + dx,
      y: s.y + dy,
      ...(s.targetX == null ? {} : { targetX: s.targetX + dx }),
      ...(s.targetY == null ? {} : { targetY: s.targetY + dy }),
    })),
    territory: save.territory ? { ...save.territory, cx: save.territory.cx + dx, cy: save.territory.cy + dy } : null,
  };
}

function expandLiveWorld(st: GameState): Partial<GameState> | null {
  if (st.mapW >= MAP_W && st.mapH >= MAP_H) return null;
  const base = generateWorld(st.seed);
  const dx = Math.floor((MAP_W - st.mapW) / 2);
  const dy = Math.floor((MAP_H - st.mapH) / 2);
  const inOldFootprint = (x: number, y: number) => x >= dx && x < dx + st.mapW && y >= dy && y < dy + st.mapH;
  const shiftedTiles = st.tiles.map((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  const tileByKey = new Map(shiftedTiles.map((t) => [`${t.x}-${t.y}`, t]));
  return {
    mapW: MAP_W,
    mapH: MAP_H,
    tiles: base.tiles.map((t) => tileByKey.get(`${t.x}-${t.y}`) ?? t),
    nodes: [
      ...base.nodes.filter((n) => !inOldFootprint(n.x, n.y)),
      ...st.nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy })),
    ],
    buildings: st.buildings.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy })),
    survivors: st.survivors.map((s) => ({
      ...s,
      x: s.x + dx,
      y: s.y + dy,
      ...(s.targetX == null ? {} : { targetX: s.targetX + dx }),
      ...(s.targetY == null ? {} : { targetY: s.targetY + dy }),
    })),
    territory: st.territory ? { ...st.territory, cx: st.territory.cx + dx, cy: st.territory.cy + dy } : null,
  };
}

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
  preferredHeirId: null,
  chronicle: [],
  stats: emptyStats(1, ""),
  proposals: [],
  animals: [],
  livestockRequests: [],
  ministers: [],
  ministerRequests: [],
  ministerReports: [],
  selection: { kind: "none" },
  buildPlacement: null,
  pendingArrival: null,
  pendingCouncilVote: null,
  councilReactionLog: [],
  laws: [],
  hasHeldFirstCouncil: false,
  pendingFoundingCharter: false,
  pendingBuildAssignment: null,
  pendingFarmSetup: null,
  unlockedCrops: [...STARTER_CROP_IDS],
  reputation: 0,
  reputationProfile: { compassionate: 0, ruthless: 0, builder: 0, provider: 0, honest: 0 },
  lastChronicleId: null,
  foundingPhase: false,
  territory: null,
  borderMode: false,

  expandWorldToCurrentSize: () => {
    const expanded = expandLiveWorld(get());
    if (expanded) set(expanded);
  },

  setScreen: (s) => set({ screen: s }),
  setOverlay: (o) => set({ overlay: o }),
  setSpeed: (s) => set({ speed: s }),
  selectSurvivor: (id) => set({ selection: { kind: "survivor", id } }),
  selectBuilding: (id) => set({ selection: { kind: "building", id } }),
  selectTile: (x, y) => set({ selection: { kind: "tile", x, y } }),
  selectFamily: (id) => set({ selection: { kind: "family", id } }),
  clearSelection: () => set({ selection: { kind: "none" } }),
  setSurvivorPortrait: (survivorId, portraitId) => {
    const st = get();
    const portrait = getPortrait(portraitId);
    set({
      survivors: st.survivors.map(s => {
        if (s.id !== survivorId) return s;
        if (!portrait) return { ...s, portraitId };
        const age = portrait.age;
        return {
          ...s,
          portraitId,
          age,
          stage: stageFromAge(age),
          bornYear: s.bornYear, // keep recorded birth year stable
        };
      }),
    });
  },
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
      // Rectangular perimeter: walk the four sides of the square bbox.
      const x0 = Math.round(cx - radius);
      const y0 = Math.round(cy - radius);
      const x1 = Math.round(cx + radius);
      const y1 = Math.round(cy + radius);
      const tiles: { x: number; y: number }[] = [];
      const pushTile = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= st.mapW || y >= st.mapH) return;
        const key = `${x},${y}`;
        if (used.has(key)) return;
        if (st.buildings.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) return;
        const t = st.tiles[y * st.mapW + x];
        if (!t || t.kind === "water" || t.kind === "stone") return;
        used.add(key);
        tiles.push({ x, y });
      };
      for (let x = x0; x <= x1; x++) { pushTile(x, y0); pushTile(x, y1); }
      for (let y = y0 + 1; y < y1; y++) { pushTile(x0, y); pushTile(x1, y); }

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
      if (Math.max(Math.abs(tx - st.territory.cx), Math.abs(ty - st.territory.cy)) > st.territory.radius) {
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
      survivors: farmerId
        ? st.survivors.map(s => s.id === farmerId ? { ...s, occupation: "farmer" as const } : s)
        : st.survivors,
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
      survivors: farmerId
        ? st.survivors.map(s => s.id === farmerId ? { ...s, occupation: "farmer" as const } : s)
        : st.survivors,
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

  assignWorker: (buildingId, survivorId) => {
    const st = get();
    const b = st.buildings.find(x => x.id === buildingId);
    if (!b) return;
    const occMap: Partial<Record<BuildingKind, Survivor["occupation"]>> = {
      "workbench": "builder",
      "foraging-camp": "forager",
      "well": "hauler",
      "water-collector": "hauler",
      "stockpile": "hauler",
      "watchtower": "idle",
    };
    const occ = occMap[b.kind];
    set({
      buildings: st.buildings.map(x =>
        x.id === buildingId ? { ...x, assignedWorkerId: survivorId } : x
      ),
      survivors: survivorId && occ
        ? st.survivors.map(s => s.id === survivorId ? { ...s, occupation: occ } : s)
        : st.survivors,
    });
  },

  assignToNode: (nodeId, survivorId) => {
    const st = get();
    const node = st.nodes.find(n => n.id === nodeId);
    if (!node || !survivorId) return;
    const occ: Survivor["occupation"] =
      node.kind === "trees" ? "woodcutter" :
      node.kind === "rocks" ? "miner" :
      node.kind === "berries" ? "forager" : "hauler";
    set({
      survivors: st.survivors.map(s => s.id === survivorId ? { ...s, occupation: occ } : s),
    });
    const who = st.survivors.find(s => s.id === survivorId);
    if (who) toast.success(`${who.name} sent to ${node.kind === "trees" ? "chop wood" : node.kind}`);
  },


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
        const upgraded = newQ > prevQ;
        const downgraded = newQ < prevQ && !!prevKind;
        const newMemory = upgraded
          ? { id: nanoid(6), tick: st.time.tick, year: st.time.year, season: st.time.season, day: st.time.day,
              text: `The Founder gave us a ${BUILDINGS[tgt.kind]?.name ?? tgt.kind}.`,
              emotion: "trust" as const, weight: 55, aboutSurvivorId: st.currentLeaderId,
              kind: "housing-upgrade", floor: 12, decayRate: 0.4 }
          : downgraded
          ? { id: nanoid(6), tick: st.time.tick, year: st.time.year, season: st.time.season, day: st.time.day,
              text: `Moved from our ${BUILDINGS[prevKind!]?.name ?? prevKind} to a ${BUILDINGS[tgt.kind]?.name ?? tgt.kind}.`,
              emotion: "anger" as const, weight: 60, aboutSurvivorId: st.currentLeaderId,
              kind: "housing-downgrade", floor: 20, decayRate: 0.3 }
          : null;
        return {
          ...s,
          homeId: buildingId,
          lastHomeKind: tgt.kind,
          housingGratitude: upgraded ? (s.housingGratitude ?? 0) + 10 : (s.housingGratitude ?? 0),
          memories: newMemory ? [newMemory, ...s.memories].slice(0, 64) : s.memories,
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

  setPreferredHeir: (id) => set({ preferredHeirId: id }),
  setEducationFocus: (childId, focus) => {
    const st = get();
    set({
      survivors: st.survivors.map((s) =>
        s.id === childId ? { ...s, educationFocus: focus } : s,
      ),
    });
  },






  newGame: (ranchName, founderInput) => {
    const seed = Math.floor(Math.random() * 0xffffffff);
    const { tiles, nodes, homesteadTile } = generateWorld(seed);
    const founder = makeFounder(founderInput, homesteadTile);
    const family = makeFounderFamily(founder, 1);
    founder.familyId = family.id;
    const homestead = makeHomesteadBuilding(homesteadTile);
    // Founder lives in the homestead
    founder.homeId = homestead.id;
    founder.lastHomeKind = "homestead";
    founder.arrivalTick = 0;
    homestead.occupantIds = [founder.id];

    // ── Starting companions ─────────────────────────────────
    const choice = founderInput.companions ?? "alone";
    const compRng = makeRng((seed ^ 0xC0FFEE) >>> 0);
    const extraSurvivors: Survivor[] = [];
    const extraFamilies: Family[] = [];
    const spawn = { x: homesteadTile.x, y: homesteadTile.y };

    if (choice === "spouse" || choice === "family") {
      const spouse = makeWanderer(compRng, spawn, 0, 1);
      spouse.gender = founder.gender === "m" ? "f" : "m";
      spouse.surname = founder.surname;
      spouse.name = (spouse.gender === "m" ? "Sam" : "Mara");
      spouse.familyId = family.id;
      spouse.spouseId = founder.id;
      spouse.marriedTick = 0;
      spouse.marriedYear = 1;
      spouse.loyaltyToFounder = 90;
      spouse.age = Math.max(22, Math.min(50, founder.age - 2 + Math.floor((compRng() - 0.5) * 8)));
      spouse.stage = stageFromAge(spouse.age);
      spouse.homeId = homestead.id;
      spouse.lastHomeKind = "homestead";
      spouse.arrivalTick = 0;
      spouse.action = "Standing on the porch beside the founder.";
      founder.spouseId = spouse.id;
      founder.marriedTick = 0;
      founder.marriedYear = 1;
      family.memberIds.push(spouse.id);
      homestead.occupantIds.push(spouse.id);
      extraSurvivors.push(spouse);

      if (choice === "family") {
        const nKids = 1 + Math.floor(compRng() * 2); // 1 or 2
        for (let i = 0; i < nKids && homestead.occupantIds.length < 4; i++) {
          const child = makeChild(compRng, [founder, spouse], 0, 1, family.id, founder.surname, 1, spawn);
          child.age = 4 + Math.floor(compRng() * 9);
          child.stage = stageFromAge(child.age);
          child.homeId = homestead.id;
          child.lastHomeKind = "homestead";
          child.arrivalTick = 0;
          founder.childrenIds.push(child.id);
          spouse.childrenIds.push(child.id);
          family.memberIds.push(child.id);
          homestead.occupantIds.push(child.id);
          extraSurvivors.push(child);
        }
      }
    } else if (choice === "friends") {
      const friends: Survivor[] = [];
      for (let i = 0; i < 2; i++) {
        const f = makeWanderer(compRng, spawn, 0, 1);
        f.loyaltyToFounder = 70;
        f.homeId = homestead.id;
        f.lastHomeKind = "homestead";
        f.arrivalTick = 0;
        f.action = "Came west with the founder.";
        homestead.occupantIds.push(f.id);
        friends.push(f);
      }
      // Each friend gets their own (small) family line.
      for (const f of friends) {
        const fam = makeWandererFamily(f, 1);
        f.familyId = fam.id;
        extraFamilies.push(fam);
        extraSurvivors.push(f);
      }
    }

    const allSurvivors: Survivor[] = [founder, ...extraSurvivors];
    const allFamilies: Family[] = [family, ...extraFamilies];
    const pop = allSurvivors.length;

    const foundingBody =
      choice === "alone"
        ? `The road is empty behind them. The fields are empty in front. They put down the bag. They start to count what they have.`
        : choice === "spouse"
          ? `Two figures on the porch. The road is empty behind them. They put down their bags together.`
          : choice === "family"
            ? `A family arrives at the porch — children underfoot, a spouse beside. The fields are empty. The work begins together.`
            : `Three travelers stop at the porch. Friends from the road, ready to put down their bags and call this home.`;

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
      survivors: allSurvivors,
      relationships: [],
      families: allFamilies,
      founderId: founder.id,
      currentLeaderId: founder.id,
      preferredHeirId: null,
      chronicle: [
        {
          id: nanoid(8),
          tick: 0, year: 1, season: "spring", day: 1,
          category: "founding",
          title: `${founder.name} ${founder.surname} stands on the porch`,
          body: foundingBody,
          involvedIds: allSurvivors.map(s => s.id),
          involvedFamilyIds: allFamilies.map(f => f.id),
        },
      ],
      stats: { ...emptyStats(1, family.name), population: pop, morale: 20, prestige: family.prestige },

      selection: { kind: "survivor", id: founder.id },
      buildPlacement: null,
      pendingArrival: null,
      pendingBuildAssignment: null,
      pendingFarmSetup: null,
      unlockedCrops: [...STARTER_CROP_IDS],
      reputation: 0,
      reputationProfile: { compassionate: 0, ruthless: 0, builder: 0, provider: 0, honest: 0 },
      lastChronicleId: null,
      foundingPhase: true,
      territory: {
        cx: homestead.x + homestead.w / 2,
        cy: homestead.y + homestead.h / 2,
        radius: 14,
      },
      borderMode: false,
      proposals: [],
      animals: [],
      livestockRequests: [],
      ministers: [],
      ministerRequests: [],
      ministerReports: [],
    });
  },

  resumeFromSave: () => {
    const rawSave = loadFromLocal();
    if (!rawSave) return false;
    const save = expandSavedWorld(rawSave);
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
        occupantIds: b.occupantIds ?? [],
        stored: b.stored ?? {},
        buildEffortTotal: b.buildEffortTotal || Math.max(1, b.effortRemaining + (b.builtProgress > 0 ? 1 : 0)),
      })).map(b => {
        normalizeConstructionBuilding(b);
        return b;
      }),
      resources: {
        ...save.resources,
        eggs: save.resources.eggs ?? 0,
        milk: save.resources.milk ?? 0,
        wool: save.resources.wool ?? 0,
      },
      survivors: save.survivors.map(s => ({
        ...s,
        skills: { ...{ social: 1 }, ...s.skills, social: s.skills?.social ?? 1 },
      })),
      relationships: save.relationships,
      families: save.families,
      founderId: save.founderId,
      currentLeaderId: save.currentLeaderId,
      preferredHeirId: save.preferredHeirId ?? null,
      chronicle: save.chronicle,
      stats: save.stats,
      selection: { kind: "none" },
      buildPlacement: null,
      unlockedCrops: (save.unlockedCrops && save.unlockedCrops.length > 0)
        ? save.unlockedCrops
        : [...STARTER_CROP_IDS],
      // Preserve founding phase if the save was created during it; legacy saves default to completed.
      foundingPhase: save.foundingPhase ?? false,
      territory: save.territory ?? null,
      proposals: save.proposals ?? [],
      animals: save.animals ?? [],
      livestockRequests: save.livestockRequests ?? [],
      ministers: save.ministers ?? [],
      ministerRequests: save.ministerRequests ?? [],
      ministerReports: save.ministerReports ?? [],
      borderMode: false,
    });
    return true;
  },

  save: () => {
    const st = get();
    const data: SaveGame = {
      version: 5,
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
      preferredHeirId: st.preferredHeirId,
      buildings: st.buildings,
      resources: st.resources,
      chronicle: st.chronicle,
      stats: st.stats,
      unlockedCrops: [...st.unlockedCrops],
      foundingPhase: st.foundingPhase,
      territory: st.territory,
      proposals: st.proposals,
      animals: st.animals,
      livestockRequests: st.livestockRequests,
      ministers: st.ministers,
      ministerRequests: st.ministerRequests,
      ministerReports: st.ministerReports,
      factions: [], laws: [], externalSettlements: [],
    };
    return saveToLocal(data);
  },

  resolveCouncilVote: (action, demandIndex) => {
    const st = get();
    const ev0 = st.pendingCouncilVote;
    if (!ev0) return;
    // Apply the picked demand index onto the event so the logic + log read it.
    const ev = (typeof demandIndex === "number" && ev0.lawDemands?.[demandIndex])
      ? { ...ev0, activeDemandIndex: demandIndex }
      : ev0;
    const leader = st.survivors.find(s => s.id === st.currentLeaderId);
    const leadSkill = leader?.skills.lead ?? 0;
    const outcome = resolveCouncilVoteLogic(ev, action, {
      resources: st.resources,
      leaderLeadSkill: leadSkill,
    });
    if (!outcome.ok) {
      toast.error(outcome.title, { description: outcome.body });
      return;
    }
    // Apply effects.
    const newResources = { ...st.resources };
    for (const [r, amt] of Object.entries(outcome.resourceCost)) {
      (newResources as any)[r] = Math.max(0, ((newResources as any)[r] ?? 0) - (amt ?? 0));
    }
    // Family prestige + wealth, plus mutual relations between leader & challenger houses.
    const newFamilies = st.families.map(f => {
      const dp = outcome.prestigeDeltas[f.id] ?? 0;
      const dw = outcome.wealthDeltas[f.id] ?? 0;
      const rel = outcome.relationsDelta;
      const newRelations = { ...f.relations };
      if (rel) {
        if (f.id === rel.a) newRelations[rel.b] = Math.max(-100, Math.min(100, (newRelations[rel.b] ?? 0) + rel.delta));
        if (f.id === rel.b) newRelations[rel.a] = Math.max(-100, Math.min(100, (newRelations[rel.a] ?? 0) + rel.delta));
      }
      if (!dp && !dw && (!rel || (f.id !== rel.a && f.id !== rel.b))) return f;
      return {
        ...f,
        prestige: Math.max(0, Math.min(200, f.prestige + dp)),
        wealth: Math.max(0, (f.wealth ?? 0) + dw),
        relations: newRelations,
      };
    });
    // Survivor-level effects: loyalty, mood, optional memory.
    const leaderHouseId = ev.leaderHouseId;
    const challengerHouseId = ev.challengerHouseId;
    let newLeaderId = st.currentLeaderId;
    const newSurvivors = st.survivors.map(s => {
      if (s.health <= 0) return s;
      const inLeaderHouse = s.familyId === leaderHouseId;
      const inChallengerHouse = challengerHouseId != null && s.familyId === challengerHouseId;
      let dLoy = outcome.loyaltyDeltas.all ?? 0;
      if (inLeaderHouse) dLoy += outcome.loyaltyDeltas.leaderHouse ?? 0;
      if (inChallengerHouse) dLoy += outcome.loyaltyDeltas.challengerHouse ?? 0;
      let dMood = outcome.moodDeltas.all ?? 0;
      if (inLeaderHouse) dMood += outcome.moodDeltas.leaderHouse ?? 0;
      if (inChallengerHouse) dMood += outcome.moodDeltas.challengerHouse ?? 0;

      let occ = s.occupation;
      if (outcome.newLeaderId) {
        if (s.id === st.currentLeaderId && s.occupation === "leader") occ = "idle";
        if (s.id === outcome.newLeaderId) occ = "leader";
      }

      let memories = s.memories;
      const isAdult = s.stage === "adult" || s.stage === "elder" || s.stage === "youth";
      if (isAdult && outcome.memoryText && outcome.memoryEmotion) {
        memories = [
          {
            id: nanoid(6),
            tick: st.time.tick,
            year: st.time.year, season: st.time.season, day: st.time.day,
            text: outcome.memoryText,
            emotion: outcome.memoryEmotion,
            weight: outcome.memoryWeight,
            aboutSurvivorId: st.currentLeaderId,
            kind: "council-vote",
            floor: Math.round(outcome.memoryWeight * 0.3),
            decayRate: 0.4,
          },
          ...s.memories,
        ].slice(0, 64);
      }

      if (!dLoy && !dMood && occ === s.occupation && memories === s.memories) return s;
      return {
        ...s,
        occupation: occ,
        loyaltyToFounder: Math.max(-100, Math.min(100, s.loyaltyToFounder + dLoy)),
        mood: Math.max(-100, Math.min(100, s.mood + dMood)),
        memories,
      };
    });
    if (outcome.newLeaderId) newLeaderId = outcome.newLeaderId;

    // Reputation profile axis shifts.
    const newRep = { ...st.reputationProfile };
    for (const [axis, delta] of Object.entries(outcome.reputationDeltas)) {
      const ax = axis as keyof typeof newRep;
      newRep[ax] = Math.max(0, Math.min(100, (newRep[ax] ?? 0) + (delta ?? 0)));
    }

    const newChronicle: ChronicleEntry = {
      id: nanoid(8),
      tick: st.time.tick,
      year: st.time.year, season: st.time.season, day: st.time.day,
      category: "succession",
      title: outcome.title,
      body: outcome.body,
      involvedIds: [ev.leaderId, ...(ev.challengerHeadId ? [ev.challengerHeadId] : [])],
      involvedFamilyIds: [ev.leaderHouseId, ...(ev.challengerHouseId ? [ev.challengerHouseId] : [])],
    };
    if (outcome.tone === "good") toast.success(outcome.title, { description: outcome.body });
    else if (outcome.tone === "bad") toast.error(outcome.title, { description: outcome.body });
    else toast(outcome.title, { description: outcome.body });
    const logEntry = buildReactionLog(ev, action, outcome, {
      tick: st.time.tick, day: st.time.day, season: st.time.season,
    });
    // Apply law changes for repeal / enact concessions.
    let newLaws = st.laws;
    if (action === "repeal-law" && ev.lawRepealRequest) {
      newLaws = st.laws.filter((l) => l.lawId !== ev.lawRepealRequest!.lawId);
    } else if (action === "enact-law") {
      const d = ev.lawDemands?.[ev.activeDemandIndex ?? 0];
      if (d && d.kind === "enact" && !st.laws.some((l) => l.lawId === d.lawId)) {
        newLaws = [
          ...st.laws,
          { id: nanoid(8), lawId: d.lawId, yearEnacted: st.time.year },
        ];
      }
    }
    set({
      pendingCouncilVote: null,
      resources: newResources,
      families: newFamilies,
      currentLeaderId: newLeaderId,
      survivors: newSurvivors,
      reputationProfile: newRep,
      laws: newLaws,
      chronicle: [newChronicle, ...st.chronicle].slice(0, 600),
      councilReactionLog: [logEntry, ...st.councilReactionLog].slice(0, 60),
    });
  },

  enactFoundingCharter: (lawIds) => {
    const st = get();
    if (!st.pendingFoundingCharter || st.hasHeldFirstCouncil) return;
    
    const valid = lawIds.filter((id) => LAW_BY_ID[id]);
    if (valid.length === 0) return;

    const enacted: import("./sim/laws").EnactedLaw[] = valid.map((lawId) => ({
      id: nanoid(8),
      lawId,
      yearEnacted: st.time.year,
    }));

    // Apply trait-driven mood / loyalty drift across the population.
    const newSurvivors = st.survivors.map((s) => {
      if (s.health <= 0) return s;
      let dMood = 0;
      let dLoy = 0;
      for (const e of enacted) {
        const def = LAW_BY_ID[e.lawId];
        if (!def) continue;
        for (const t of s.traits ?? []) {
          dMood += def.traitMood[t] ?? 0;
          dLoy += def.traitLoyalty[t] ?? 0;
        }
      }
      if (!dMood && !dLoy) return s;
      return {
        ...s,
        mood: Math.max(-100, Math.min(100, s.mood + dMood)),
        loyaltyToFounder: Math.max(-100, Math.min(100, s.loyaltyToFounder + dLoy)),
      };
    });

    const titles = enacted.map((e) => LAW_BY_ID[e.lawId]?.title).filter(Boolean).join(" · ");
    const charterEntry: ChronicleEntry = {
      id: nanoid(8),
      tick: st.time.tick,
      year: st.time.year, season: st.time.season, day: st.time.day,
      category: "succession",
      title: "The Founder's Charter",
      body: `The ten houses gather. The founder names the law: ${titles}.`,
      involvedIds: [st.founderId],
      involvedFamilyIds: [],
    };

    toast.success("The Charter is signed", { description: `${enacted.length} laws written into the founding.` });
    set({
      laws: enacted,
      hasHeldFirstCouncil: true,
      pendingFoundingCharter: false,
      survivors: newSurvivors,
      chronicle: [charterEntry, ...st.chronicle].slice(0, 600),
    });
  },

  repealLaw: (lawId) => {
    const st = get();
    const law = st.laws.find((l) => l.lawId === lawId);
    if (!law) return;
    
    const def = LAW_BY_ID[law.lawId];
    // Reverse half of the original trait drift on repeal (sentiments fade, don't snap).
    const newSurvivors = st.survivors.map((s) => {
      if (s.health <= 0 || !def) return s;
      let dMood = 0;
      let dLoy = 0;
      for (const t of s.traits ?? []) {
        dMood -= (def.traitMood[t] ?? 0) * 0.5;
        dLoy -= (def.traitLoyalty[t] ?? 0) * 0.5;
      }
      if (!dMood && !dLoy) return s;
      return {
        ...s,
        mood: Math.max(-100, Math.min(100, s.mood + Math.round(dMood))),
        loyaltyToFounder: Math.max(-100, Math.min(100, s.loyaltyToFounder + Math.round(dLoy))),
      };
    });
    const entry: ChronicleEntry = {
      id: nanoid(8),
      tick: st.time.tick,
      year: st.time.year, season: st.time.season, day: st.time.day,
      category: "succession",
      title: `Repealed: ${def?.title ?? law.lawId}`,
      body: `The council strikes the law from the long room's wall.`,
      involvedIds: [],
      involvedFamilyIds: [],
    };
    toast(`Repealed: ${def?.title ?? law.lawId}`);
    set({
      laws: st.laws.filter((l) => l.lawId !== lawId),
      survivors: newSurvivors,
      chronicle: [entry, ...st.chronicle].slice(0, 600),
    });
  },

  tickReal: (deltaMs) => {
    const st = get();
    if (st.speed === 0 || st.screen !== "game") return;
    if (st.pendingArrival) return; // pause while the player decides
    if (st.pendingCouncilVote) return; // pause during a council vote
    if (st.pendingFoundingCharter) return; // pause during the Founding Charter
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
      preferredHeirId: st.preferredHeirId,
      chronicle: [...st.chronicle],
      stats: { ...st.stats },
      seed: st.seed,
      proposals: st.proposals.map(p => ({ ...p })),
      animals: st.animals.map(a => ({ ...a })),
      livestockRequests: st.livestockRequests.map(r => ({ ...r })),
      ministers: st.ministers.map(m => ({ ...m })),
      ministerRequests: st.ministerRequests.map(r => ({ ...r })),
      ministerReports: st.ministerReports.map(r => ({ ...r })),
      foundingPhase: st.foundingPhase,
    };

    const prevTick = st.time.tick;
    const prevFounderAlive = (st.survivors.find(s => s.id === st.founderId)?.health ?? 0) > 0;
    advance(eng, n);
    const newTick = eng.time.tick;

    // Founder legacy — bestow an epithet at the moment of death and add a
    // dedicated chronicle entry remembered by future generations.
    const founder = eng.survivors.find(s => s.id === eng.founderId);
    if (prevFounderAlive && founder && founder.health <= 0 && !founder.epithet) {
      const epithet = computeFounderEpithet(founder, st.reputationProfile, eng.stats, eng.families);
      founder.epithet = epithet;
      eng.chronicle.unshift({
        id: nanoid(8),
        tick: eng.time.tick,
        year: eng.time.year, season: eng.time.season, day: eng.time.day,
        category: "death",
        title: founderDeathTitle(founder, epithet),
        body: founderDeathBody(founder, epithet, eng.time.year),
        involvedIds: [founder.id],
        involvedFamilyIds: [founder.familyId],
      });
      toast(`${founder.name} ${founder.surname} — ${epithet} — has died`, {
        description: "The Ranch enters a transition.",
      });
    }

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

    // ── Council triggers ────────────────────────────────────
    // (a) First council: once the ranch has 10+ houses, the founder holds the
    //     Founding Charter — picks the laws of the ranch. Cannot be deposed.
    // (b) After the charter, an annual council convenes each spring; rivals
    //     may also demand a hated law be repealed.
    let pendingCouncilVote: CouncilVoteEvent | null = st.pendingCouncilVote;
    let pendingFoundingCharter: boolean = st.pendingFoundingCharter;
    let hasHeldFirstCouncil: boolean = st.hasHeldFirstCouncil;
    const livingFamilies = eng.families.filter(
      (f) => f.memberIds.some((id) => eng.survivors.find((s) => s.id === id && s.health > 0))
    );
    const crossedYear = eng.time.year > st.time.year;

    if (
      !hasHeldFirstCouncil &&
      !pendingFoundingCharter &&
      !pendingArrival &&
      !st.foundingPhase &&
      livingFamilies.length >= 10
    ) {
      pendingFoundingCharter = true;
      toast("The Ten Houses gather", {
        description: "Call the Founding Charter — set the laws of the ranch.",
      });
    }

    if (
      hasHeldFirstCouncil &&
      !pendingCouncilVote && !pendingArrival && !pendingFoundingCharter && !st.foundingPhase &&
      crossedYear && eng.time.year > st.stats.foundedYear
    ) {
      const ev = generateCouncilVote({
        survivors: eng.survivors,
        families: eng.families,
        buildings: eng.buildings,
        animals: eng.animals,
        ministers: eng.ministers,
        resources: eng.resources,
        currentLeaderId: eng.currentLeaderId,
        founderId: eng.founderId,
        currentYear: eng.time.year,
      });
      if (ev) {
        // Gather every pressing demand (both repeals and new-law petitions).
        const view = computeFactions(eng.survivors, eng.families, st.laws);
        const raw = pressingLawDemands(view, st.laws, { threshold: 18 });
        // Cap to top 4 so the council scene stays readable.
        const top = raw.slice(0, 4);
        if (top.length > 0) {
          ev.lawDemands = top.map((d) => {
            // Other factions that will resent this concession.
            const opposedBy = view.factions
              .filter((f) => {
                if (f.id === d.faction.id) return false;
                if (f.strength < 15) return false;
                if (d.kind === "repeal") return d.lawDef.factionLikes.includes(f.id);
                return d.lawDef.factionHates.includes(f.id);
              })
              .map((f) => f.def.name);
            return {
              kind: d.kind,
              lawId: d.lawDef.id,
              lawTitle: d.lawDef.title,
              lawBlurb: d.lawDef.blurb,
              factionId: d.faction.id,
              factionName: d.faction.def.name,
              opposedBy,
              intensity: d.intensity,
              pitch: d.pitch,
            };
          });
          // Default active demand = strongest one.
          ev.activeDemandIndex = 0;
          // Mirror top demand of each kind for back-compat displays.
          const topRepeal = ev.lawDemands.find((d) => d.kind === "repeal");
          if (topRepeal) {
            ev.lawRepealRequest = {
              lawId: topRepeal.lawId,
              lawTitle: topRepeal.lawTitle,
              factionId: topRepeal.factionId,
              factionName: topRepeal.factionName,
              intensity: topRepeal.intensity,
            };
          }
          const topEnact = ev.lawDemands.find((d) => d.kind === "enact");
          if (topEnact) {
            ev.lawEnactRequest = {
              lawId: topEnact.lawId,
              lawTitle: topEnact.lawTitle,
              factionId: topEnact.factionId,
              factionName: topEnact.factionName,
              intensity: topEnact.intensity,
            };
          }
          ev.challengerAgenda = ev.lawDemands[0].pitch;
        }
        pendingCouncilVote = ev;
        const hasDemands = (ev.lawDemands?.length ?? 0) > 0;
        const desc = hasDemands
          ? `${ev.lawDemands!.length} faction demand${ev.lawDemands!.length > 1 ? "s" : ""} press the porch.`
          : ev.contested
            ? `House ${ev.challengerHouseName ?? "—"} challenges the porch.`
            : `Year ${ev.year}. The houses gather.`;
        toast(ev.contested || hasDemands ? "Council in uproar" : "The Council convenes", {
          description: desc,
        });
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
      preferredHeirId: eng.preferredHeirId ?? null,
      chronicle: eng.chronicle,
      stats: eng.stats,
      proposals: eng.proposals,
      animals: eng.animals,
      livestockRequests: eng.livestockRequests,
      ministers: eng.ministers,
      ministerRequests: eng.ministerRequests,
      ministerReports: eng.ministerReports,
      pendingArrival,
      pendingCouncilVote,
      pendingFoundingCharter,
      hasHeldFirstCouncil,
      lastChronicleId: lastId,
    });

    // Toast newly-required player proposals.
    const prevPending = new Set(st.proposals.filter(p => p.requiresPlayer && p.status === "pending").map(p => p.id));
    for (const p of eng.proposals) {
      if (p.requiresPlayer && p.status === "pending" && !prevPending.has(p.id)) {
        const a = eng.survivors.find(s => s.id === p.aId);
        const b = eng.survivors.find(s => s.id === p.bId);
        if (a && b) toast(`Marriage proposal: ${a.name} & ${b.name}`, { description: "A House awaits your blessing." });
      }
    }
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
    // Auto-assign homes to the newcomers + emit memories for existing survivors.
    const buildings = st.buildings.map(b => ({ ...b, occupantIds: [...b.occupantIds] }));
    const bias0 = (traits: string[] | undefined) =>
      (traits ?? []).reduce((m, t) => m + (TRAIT_INFO[t]?.refugeeBias ?? 0), 0);
    const nid = nanoid;
    const existing = st.survivors.map((s) => {
      if (s.health <= 0) return s;
      const bias = traitRefugeeBias(s.traits);
      const moodShift = 2 + Math.max(0, bias) * 0.3;
      const memText = bias > 4
        ? `The founder welcomed strangers. That is who we are.`
        : bias < -4
          ? `More mouths to feed. The founder says yes too easily.`
          : `New faces at the gate. Welcomed in.`;
      const memories = [
        { id: nid(6), tick: st.time.tick, year: st.time.year, season: st.time.season, day: st.time.day,
          text: memText,
          emotion: (bias >= 0 ? "trust" : "anger") as "trust" | "anger",
          weight: 30 + Math.abs(bias),
          kind: "founder-accepted", decayRate: 1, floor: 5 },
        ...s.memories,
      ].slice(0, 64);
      return { ...s, memories, mood: Math.max(-100, Math.min(100, s.mood + moodShift)) };
    });
    const allSurvivors = [...existing, ...ev.survivors.map(s => ({
      ...s,
      arrivalTick: st.time.tick,
      housingGratitude: 5, // small welcome bonus
      memories: [
        { id: nid(6), tick: st.time.tick, year: st.time.year, season: st.time.season, day: st.time.day,
          text: `The founder welcomed me in.`,
          emotion: "trust" as const, weight: 80, aboutSurvivorId: st.founderId,
          kind: "founder-accepted-me", decayRate: 0.4, floor: 35 },
        ...s.memories,
      ],
    }))];
    for (const s of ev.survivors) {
      const fresh = allSurvivors.find(x => x.id === s.id);
      if (!fresh) continue;
      const home = findBestHomeFor(fresh, buildings, allSurvivors);
      if (home && (home.occupantIds?.length ?? 0) < homeCapacity(home)) {
        fresh.homeId = home.id;
        fresh.lastHomeKind = home.kind;
        home.occupantIds.push(fresh.id);
      }
    }
    set({
      survivors: allSurvivors,
      families: [...st.families, ev.family],
      buildings,
      resources: newResources,
      chronicle: [newChronicle, ...st.chronicle],
      pendingArrival: null,
      reputation: Math.min(100, st.reputation + 4),
      reputationProfile: {
        ...st.reputationProfile,
        compassionate: Math.min(100, st.reputationProfile.compassionate + 8),
        ruthless: Math.max(0, st.reputationProfile.ruthless - 2),
      },
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
    const nid = nanoid;
    const survivors = st.survivors.map((s) => {
      if (s.health <= 0) return s;
      const bias = traitRefugeeBias(s.traits);
      // Compassionate survivors grieve the turning away; cold ones approve.
      const compassion = bias > 4;
      const memText = compassion
        ? `The Founder turned hungry strangers away. I will not forget that road.`
        : bias < -4
          ? `The Founder was right to send them on. Fewer mouths at our table.`
          : `Strangers came to the gate. The Founder sent them on.`;
      const memory = {
        id: nid(6), tick: st.time.tick, year: st.time.year, season: st.time.season, day: st.time.day,
        text: memText,
        emotion: (compassion ? "grief" : bias < -4 ? "trust" : "fear") as "grief" | "trust" | "fear",
        weight: 25 + Math.abs(bias) * 1.5,
        aboutSurvivorId: st.currentLeaderId,
        kind: "founder-rejected",
        decayRate: compassion ? 0.3 : 1,
        floor: compassion ? 20 : 5,
      };
      return { ...s, memories: [memory, ...s.memories].slice(0, 64) };
    });
    set({
      chronicle: [newChronicle, ...st.chronicle],
      pendingArrival: null,
      survivors,
      reputation: Math.max(-100, st.reputation - 3),
      reputationProfile: {
        ...st.reputationProfile,
        ruthless: Math.min(100, st.reputationProfile.ruthless + 8),
        compassionate: Math.max(0, st.reputationProfile.compassionate - 2),
      },
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
    const r = Math.max(3, Math.min(40, Math.round(Math.max(Math.abs(x - t.cx), Math.abs(y - t.cy)))));
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

  decideProposal: (id, decision) => {
    const st = get();
    const POSTPONE_TICKS = 30 * 24;
    const next: MarriageProposal[] = [];
    for (const p of st.proposals) {
      if (p.id !== id) { next.push(p); continue; }
      if (decision === "approve") {
        next.push({ ...p, status: "approved", requiresPlayer: false });
      } else if (decision === "reject") {
        // drop entirely
        const a = st.survivors.find(s => s.id === p.aId);
        const b = st.survivors.find(s => s.id === p.bId);
        if (a && b) toast.warning(`Rejected the union of ${a.name} and ${b.name}`);
      } else {
        next.push({ ...p, status: "postponed", resolveAfterTick: st.time.tick + POSTPONE_TICKS });
      }
    }
    set({ proposals: next });
  },

  arrangeMarriage: (initiatorId, targetId) => {
    const st = get();
    // Build a temporary engine view to use createArrangedProposal.
    const eng: Engine = {
      time: { ...st.time },
      tiles: st.tiles, mapW: st.mapW, mapH: st.mapH,
      nodes: st.nodes, buildings: st.buildings, resources: st.resources,
      survivors: st.survivors, relationships: st.relationships,
      families: st.families.map(f => ({ ...f, memberIds: [...f.memberIds], relations: { ...f.relations } })),
      founderId: st.founderId, currentLeaderId: st.currentLeaderId,
      preferredHeirId: st.preferredHeirId,
      chronicle: st.chronicle, stats: st.stats, seed: st.seed,
      proposals: st.proposals.map(p => ({ ...p })),
      animals: st.animals.map(a => ({ ...a })),
      livestockRequests: st.livestockRequests.map(r => ({ ...r })),
      ministers: st.ministers.map(m => ({ ...m })),
      ministerRequests: st.ministerRequests.map(r => ({ ...r })),
      ministerReports: st.ministerReports.map(r => ({ ...r })),
      foundingPhase: st.foundingPhase,
    };
    const prop = createArrangedProposal(eng, initiatorId, targetId);
    if (!prop) { toast.error("Cannot arrange that marriage"); return false; }
    set({ proposals: eng.proposals, families: eng.families });
    const a = st.survivors.find(s => s.id === initiatorId);
    const b = st.survivors.find(s => s.id === targetId);
    if (a && b) toast.success(`Arranged: ${a.name} & ${b.name}`, { description: "The other House will respond." });
    return true;
  },

  decideLivestockRequest: (id, decision) => {
    const st = get();
    const POSTPONE = 30 * 24;
    const req = st.livestockRequests.find(r => r.id === id);
    if (!req) return;
    const fam = st.families.find(f => f.id === req.familyId);
    const requester = st.survivors.find(s => s.id === req.requesterId);
    if (decision === "postpone") {
      set({
        livestockRequests: st.livestockRequests.map(r =>
          r.id === id ? { ...r, status: "postponed", resolveAfterTick: st.time.tick + POSTPONE } : r,
        ),
      });
      toast(`Postponed ${SPECIES_LABEL[req.species]} request from House ${fam?.name ?? "—"}`);
      return;
    }
    if (decision === "reject") {
      // remove + memory + small loyalty hit on requester
      const survivors = st.survivors.map(s => {
        if (s.id !== requester?.id) return s;
        return {
          ...s,
          loyaltyToFounder: Math.max(-100, s.loyaltyToFounder - 6),
          mood: Math.max(-100, s.mood - 5),
          memories: [
            {
              id: nanoid(6), tick: st.time.tick, year: st.time.year, season: st.time.season, day: st.time.day,
              text: `The Founder refused my request to raise ${SPECIES_LABEL[req.species].toLowerCase()}.`,
              emotion: "anger" as const, weight: 40, aboutSurvivorId: st.currentLeaderId,
              kind: "livestock-rejected", floor: 10, decayRate: 0.5,
            },
            ...s.memories,
          ].slice(0, 64),
        };
      });
      set({
        livestockRequests: st.livestockRequests.filter(r => r.id !== id),
        survivors,
      });
      toast.warning(`Refused House ${fam?.name ?? "—"}'s request`);
      return;
    }
    // approve
    let buildings = st.buildings;
    let animals = st.animals;
    if (req.kind === "start-raising") {
      // Gift a starter pair into any existing pen of theirs, or unhoused.
      const pen = buildings.find(b =>
        b.builtProgress >= 1 && b.kind === SPECIES_BUILDING[req.species] &&
        (b.livestockOwnerFamilyId === fam?.id || b.livestockOwnerFamilyId == null),
      );
      const penId = pen?.id ?? null;
      const newAnimals: Animal[] = [
        makeAnimal(req.species, "f", req.familyId, penId, st.time.tick, 40),
        makeAnimal(req.species, "m", req.familyId, penId, st.time.tick, 40),
      ];
      animals = [...animals, ...newAnimals];
      if (pen && !pen.livestockOwnerFamilyId) {
        buildings = buildings.map(b => b.id === pen.id ? { ...b, livestockOwnerFamilyId: req.familyId } : b);
      }
    }
    // Founder opinion + prestige bump for the family
    const survivors = st.survivors.map(s => {
      const inFam = s.familyId === req.familyId && s.health > 0;
      if (!inFam) return s;
      return {
        ...s,
        loyaltyToFounder: Math.min(100, s.loyaltyToFounder + (s.id === requester?.id ? 10 : 4)),
        mood: Math.min(100, s.mood + 4),
        memories: s.id === requester?.id ? [
          {
            id: nanoid(6), tick: st.time.tick, year: st.time.year, season: st.time.season, day: st.time.day,
            text: `The Founder granted my wish to raise ${SPECIES_LABEL[req.species].toLowerCase()}.`,
            emotion: "trust" as const, weight: 60, aboutSurvivorId: st.currentLeaderId,
            kind: "livestock-approved", floor: 20, decayRate: 0.3,
          },
          ...s.memories,
        ].slice(0, 64) : s.memories,
      };
    });
    const families = st.families.map(f =>
      f.id === req.familyId ? { ...f, prestige: Math.min(200, f.prestige + 3) } : f,
    );
    set({
      livestockRequests: st.livestockRequests.filter(r => r.id !== id),
      buildings,
      animals,
      survivors,
      families,
    });
    toast.success(`Granted House ${fam?.name ?? "—"}'s ${SPECIES_LABEL[req.species]} request`);
  },

  assignRancher: (buildingId, survivorId) => {
    const st = get();
    set({
      buildings: st.buildings.map(b =>
        b.id === buildingId ? { ...b, assignedWorkerId: survivorId } : b,
      ),
      survivors: survivorId
        ? st.survivors.map(s => s.id === survivorId ? { ...s, occupation: "rancher" as const } : s)
        : st.survivors,
    });
  },

  setPenOwner: (buildingId, familyId) => {
    const st = get();
    set({
      buildings: st.buildings.map(b =>
        b.id === buildingId ? { ...b, livestockOwnerFamilyId: familyId } : b,
      ),
    });
  },

  appointMinister: (role, survivorId) => {
    const st = get();
    if (survivorId === st.founderId) {
      toast.error("The Founder cannot also be a Minister.");
      return;
    }
    const survivor = st.survivors.find(s => s.id === survivorId);
    if (!survivor || survivor.health <= 0) return;
    // Remove any existing minister in this role or holding this survivor.
    const filtered = st.ministers.filter(m => m.role !== role && m.survivorId !== survivorId);
    const minister = makeMinister(role, survivorId, st.time.tick);
    set({
      ministers: [...filtered, minister],
      survivors: st.survivors.map(s =>
        s.id === survivorId
          ? {
              ...s,
              loyaltyToFounder: Math.min(100, s.loyaltyToFounder + 10),
              mood: Math.min(100, s.mood + 6),
              memories: [{
                id: nanoid(6), tick: st.time.tick, year: st.time.year,
                season: st.time.season, day: st.time.day,
                text: `The Founder appointed me to lead.`,
                emotion: "pride" as const, weight: 60,
                aboutSurvivorId: st.currentLeaderId,
                kind: "minister-appointed", floor: 25, decayRate: 0.2,
              }, ...s.memories].slice(0, 64),
            }
          : s,
      ),
    });
    toast.success(`${survivor.name} ${survivor.surname} appointed.`);
  },

  dismissMinister: (ministerId) => {
    const st = get();
    const m = st.ministers.find(x => x.id === ministerId);
    if (!m) return;
    const survivor = st.survivors.find(s => s.id === m.survivorId);
    set({
      ministers: st.ministers.filter(x => x.id !== ministerId),
      ministerRequests: st.ministerRequests.filter(r => r.ministerId !== ministerId),
      survivors: survivor
        ? st.survivors.map(s =>
            s.id === m.survivorId
              ? {
                  ...s,
                  loyaltyToFounder: Math.max(-100, s.loyaltyToFounder - 15),
                  mood: Math.max(-100, s.mood - 10),
                  memories: [{
                    id: nanoid(6), tick: st.time.tick, year: st.time.year,
                    season: st.time.season, day: st.time.day,
                    text: `The Founder dismissed me from my post.`,
                    emotion: "anger" as const, weight: 70,
                    aboutSurvivorId: st.currentLeaderId,
                    kind: "minister-dismissed", floor: 35, decayRate: 0.25,
                  }, ...s.memories].slice(0, 64),
                }
              : s,
          )
        : st.survivors,
    });
    if (survivor) toast(`${survivor.name} dismissed from post.`);
  },

  decideMinisterRequest: (id, decision, transferIds) => {
    const st = get();
    const POSTPONE = 14 * 24;
    const req = st.ministerRequests.find(r => r.id === id);
    if (!req) return;
    const minister = st.ministers.find(m => m.id === req.ministerId);
    if (!minister) {
      set({ ministerRequests: st.ministerRequests.filter(r => r.id !== id) });
      return;
    }
    if (decision === "postpone") {
      set({
        ministerRequests: st.ministerRequests.map(r =>
          r.id === id ? { ...r, status: "postponed", resolveAfterTick: st.time.tick + POSTPONE } : r,
        ),
        ministers: st.ministers.map(m =>
          m.id === minister.id ? { ...m, satisfaction: Math.max(0, m.satisfaction - 4) } : m,
        ),
      });
      toast(`Postponed ${minister.role.replace("-", " ")} request`);
      return;
    }
    // Work on copies that we mutate, then commit via set().
    const survivors = st.survivors.map(s => ({ ...s, memories: [...s.memories] }));
    const ministersCopy = st.ministers.map(m => ({ ...m }));
    const reqCopy = { ...req };
    const minCopy = ministersCopy.find(m => m.id === minister.id)!;

    if (decision === "reject") {
      applyRejection({
        request: reqCopy, minister: minCopy, survivors,
        founderId: st.founderId,
        time: { tick: st.time.tick, year: st.time.year, season: st.time.season, day: st.time.day },
      });
      set({
        ministers: ministersCopy,
        ministerRequests: st.ministerRequests.filter(r => r.id !== id),
        survivors,
      });
      toast.warning(`Refused ${minister.role.replace("-", " ")} request`);
      return;
    }
    // approve / partial
    const ids = (transferIds ?? []).slice(0, req.requestedWorkers);
    const targetOcc = ROLE_OCCUPATION[req.role];
    for (const sid of ids) {
      const s = survivors.find(x => x.id === sid);
      if (s) s.occupation = targetOcc;
    }
    applyApproval({
      request: reqCopy, minister: minCopy, survivors,
      founderId: st.founderId,
      time: { tick: st.time.tick, year: st.time.year, season: st.time.season, day: st.time.day },
      approvedCount: ids.length,
      transferredIds: ids,
    });
    set({
      ministers: ministersCopy,
      ministerRequests: st.ministerRequests.filter(r => r.id !== id),
      survivors,
    });
    if (ids.length >= req.requestedWorkers) {
      toast.success(`Approved — ${ids.length} reassigned`);
    } else {
      toast.success(`Partially approved — ${ids.length} reassigned`);
    }
  },

  reassignWorker: (survivorId, occupation) => {
    const st = get();
    set({
      survivors: st.survivors.map(s =>
        s.id === survivorId ? { ...s, occupation } : s,
      ),
    });
  },
}));

function territoryAcres(radius: number): number {
  // Square bbox: side = 2*radius. 1 tile ≈ 0.1 acre (arbitrary but readable).
  const side = 2 * radius;
  return Math.max(1, Math.round(side * side * 0.1));
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

