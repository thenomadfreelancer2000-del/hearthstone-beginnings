// THE RANCH — Domain Types
// Phase 1 active. Phase 2 fields (spouseId, childrenIds, factionId, lawIds, etc.)
// are present but nullable so save schema can grow without migration breakage.

export type ID = string;

export type Season = "spring" | "summer" | "autumn" | "winter";
export type GameSpeed = 0 | 1 | 2 | 3; // paused, 1x, 2x, 4x

export interface GameTime {
  tick: number;       // absolute simulation tick
  day: number;        // 1-based, day of season
  season: Season;
  year: number;       // year of the founding (1 = year of arrival)
}

// ── Map ──────────────────────────────────────────────────────────
export type TileKind =
  | "grass"
  | "tall-grass"
  | "dirt"
  | "forest"
  | "stone"
  | "water"
  | "road"
  | "ruin";

export interface Tile {
  x: number;
  y: number;
  kind: TileKind;
  // resource node attached to this tile (trees, rocks, berry bushes)
  resourceNodeId?: ID | null;
  buildingId?: ID | null;
  variant: number; // 0-3, visual variation
}

export type ResourceKind = "wood" | "stone" | "food" | "water" | "fiber" | "tools";

export interface ResourceNode {
  id: ID;
  kind: "trees" | "rocks" | "berries" | "well";
  x: number;
  y: number;
  yields: ResourceKind;
  amount: number;
  max: number;
  regrowsPerDay: number; // 0 means non-renewable
}

// ── Survivors ────────────────────────────────────────────────────
export type Trait =
  | "Ambitious" | "Loyal" | "Generous" | "Greedy" | "Principled"
  | "Paranoid" | "Traditional" | "Idealistic" | "Bitter" | "Brave";

export type Background =
  | "rancher" | "soldier" | "medic" | "scholar" | "carpenter"
  | "farmer" | "drifter" | "criminal";

export type LifeStage = "child" | "youth" | "adult" | "elder";

export type Occupation =
  | "idle" | "forager" | "woodcutter" | "miner"
  | "farmer" | "builder" | "hauler" | "leader";

export interface Needs {
  food: number;     // 0-100
  water: number;    // 0-100
  rest: number;     // 0-100
  shelter: number;  // 0-100 (cumulative comfort from sleeping in a roof)
  belonging: number;// 0-100
  purpose: number;  // 0-100
}

export interface Skills {
  forage: number; cut: number; mine: number;
  build: number; farm: number; medic: number; lead: number;
}

export interface Memory {
  id: ID;
  tick: number;
  text: string;
  emotion: "joy" | "fear" | "grief" | "pride" | "anger" | "trust" | "betrayal";
  weight: number; // 1-100
  aboutSurvivorId?: ID | null;
}

export type AIState =
  | "idle" | "moving" | "working"
  | "resting" | "eating" | "drinking"
  | "socializing";

export interface Survivor {
  id: ID;
  name: string;
  surname: string;
  age: number;
  stage: LifeStage;
  gender: "m" | "f";
  background: Background;
  isFounder: boolean;

  // Position (tile coords, can be fractional during movement)
  x: number;
  y: number;
  targetX?: number | null;
  targetY?: number | null;
  state: AIState;
  workTarget?: { kind: "node" | "building"; id: ID } | null;
  carrying?: { resource: ResourceKind; amount: number } | null;
  // last action visible label
  action: string;

  // inner world
  traits: Trait[];
  values: ("Family" | "Freedom" | "Security" | "Status" | "Community")[];

  occupation: Occupation;
  skills: Skills;
  health: number;     // 0-100
  mood: number;       // -100..100
  needs: Needs;

  loyaltyToFounder: number; // -100..100
  // memory ring buffer (cap ~24 for perf in phase 1)
  memories: Memory[];

  // ── Phase 2 placeholders (kept nullable for forward-compat) ──
  spouseId?: ID | null;
  parentIds?: ID[];
  childrenIds?: ID[];
  factionId?: ID | null;
  politicalLean?: number | null;
}

// Relationship edge between two survivors
export interface Relationship {
  // canonical key: `${min(idA,idB)}::${max(idA,idB)}`
  a: ID;
  b: ID;
  affection: number; // -100..100
  trust: number;     // -100..100
  tag: "stranger" | "acquaintance" | "friend" | "close-friend" | "rival" | "enemy";
  interactions: number;
}

// ── Buildings ────────────────────────────────────────────────────
export type BuildingKind =
  | "homestead"          // founder's house, starting structure
  | "tent"               // basic shelter
  | "cabin"              // proper housing
  | "campfire"           // social + warmth
  | "stockpile"          // resource cache
  | "workbench"          // tools production
  | "well"               // water (when placed next to water tile)
  | "watchtower"         // future combat hook
  | "field"              // farming (phase 1 lite)
  ;

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  blurb: string;
  size: { w: number; h: number };
  cost: Partial<Record<ResourceKind, number>>;
  buildEffort: number;   // worker-ticks
  housingCapacity: number;
  storageCapacity: number;
  social: boolean;
  produces?: { resource: ResourceKind; perDay: number } | null;
}

export interface Building {
  id: ID;
  kind: BuildingKind;
  x: number; y: number;
  w: number; h: number;
  builtProgress: number; // 0..1
  effortRemaining: number;
  occupantIds: ID[]; // for housing assignments
  stored: Partial<Record<ResourceKind, number>>;
}

// ── Chronicle ────────────────────────────────────────────────────
export type ChronicleCategory =
  | "founding" | "arrival" | "departure" | "death"
  | "construction" | "milestone" | "event" | "season";

export interface ChronicleEntry {
  id: ID;
  tick: number;
  year: number;
  season: Season;
  day: number;
  category: ChronicleCategory;
  title: string;
  body: string;
  involvedIds?: ID[];
}

// ── Settlement / aggregate ───────────────────────────────────────
export interface SettlementStats {
  population: number;
  morale: number;        // weighted avg mood
  prestige: number;      // grows from milestones — used later for factions
  foundedYear: number;
}

// ── Save Game ────────────────────────────────────────────────────
export interface SaveGame {
  version: 1;
  ranchName: string;
  seed: number;
  time: GameTime;
  speed: GameSpeed;
  tiles: Tile[];
  mapW: number;
  mapH: number;
  resourceNodes: ResourceNode[];
  survivors: Survivor[];
  relationships: Relationship[];
  buildings: Building[];
  resources: Record<ResourceKind, number>; // global stockpile (Phase 1 simplification)
  chronicle: ChronicleEntry[];
  stats: SettlementStats;
  // Phase 2 reservations (always present, empty in Phase 1):
  factions: unknown[];
  laws: unknown[];
  externalSettlements: unknown[];
}
