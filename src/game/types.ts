// THE RANCH — Domain Types
// Phase 1 + Phase 2. Phase 3+ fields (factionId, lawIds, etc.) remain nullable
// so save schema can grow without migration breakage.

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
  | "grass" | "tall-grass" | "dirt" | "forest"
  | "stone" | "water" | "road" | "ruin";

export interface Tile {
  x: number;
  y: number;
  kind: TileKind;
  resourceNodeId?: ID | null;
  buildingId?: ID | null;
  variant: number;
}

export type ResourceKind =
  | "wood" | "stone" | "food" | "water" | "fiber" | "tools"
  | "eggs" | "milk" | "wool";

export interface ResourceNode {
  id: ID;
  kind: "trees" | "rocks" | "berries" | "well" | "fiber-grass";
  x: number;
  y: number;
  yields: ResourceKind;
  amount: number;
  max: number;
  regrowsPerDay: number;
}

// ── Survivors ────────────────────────────────────────────────────
// Trait names are open-ended strings; the catalog in
// src/game/data/traits.ts owns the canonical list + metadata.
export type Trait = string;

export type Background =
  | "rancher" | "soldier" | "medic" | "scholar" | "carpenter"
  | "farmer" | "drifter" | "criminal" | "native-born";

export type LifeStage = "child" | "teen" | "youth" | "adult" | "elder";

export type Occupation =
  | "idle" | "forager" | "woodcutter" | "miner"
  | "farmer" | "builder" | "hauler" | "leader" | "rancher";

export interface Needs {
  food: number; water: number; rest: number;
  shelter: number; belonging: number; purpose: number;
}

export interface Skills {
  // ── Modern, player-facing skills (0..30) ────────────────────
  // Kept in sync with the legacy fields below via syncSkills().
  leadership?: number;
  building?: number;
  farming?: number;
  healing?: number;
  strength?: number;
  intelligence?: number;
  finance?: number;

  // ── Legacy fields (still consumed by the simulation) ────────
  forage: number; cut: number; mine: number;
  build: number; farm: number; medic: number; lead: number;
  social: number;
  /** Ranching skill, capped 0..30 at use sites. */
  ranch?: number;
}

export interface Memory {
  id: ID;
  tick: number;
  text: string;
  emotion: "joy" | "fear" | "grief" | "pride" | "anger" | "trust" | "betrayal" | "love";
  weight: number;
  aboutSurvivorId?: ID | null;
  /** Optional categorical kind: "founder-accepted", "founder-rejected", "spouse-died", etc. */
  kind?: string;
  /** Weight drained per day. Defaults to 2 when absent. */
  decayRate?: number;
  /** Minimum weight a memory can decay to. Defaults to 0. */
  floor?: number;
  /** Chronicle date stamp (set by emitMemory). */
  year?: number;
  season?: Season;
  day?: number;
}

export type AIState =
  | "idle" | "moving" | "working"
  | "resting" | "eating" | "drinking"
  | "socializing";

export interface Survivor {
  id: string;
  name: string;
  surname: string;
  age: number;                  // in years, fractional
  stage: LifeStage;
  gender: "m" | "f";
  background: Background;
  isFounder: boolean;
  bornTick: number;             // when added to the world
  bornYear: number;             // year of birth (chronicle convenience)
  deathTick?: number | null;
  deathYear?: number | null;
  /** Portrait identifier from PORTRAITS list. Optional; null for procedurally generated NPCs. */
  portraitId?: string | null;

  // Pregnancy (mothers only). When pregnant, the child is not yet spawned;
  // delivery happens after ~9 in-game months.
  pregnant?: boolean;
  pregnancyTick?: number | null;

  // Position
  x: number;
  y: number;
  targetX?: number | null;
  targetY?: number | null;
  state: AIState;
  workTarget?: { kind: "node" | "building"; id: ID } | null;
  carrying?: { resource: ResourceKind; amount: number } | null;
  // Long-running commitment (e.g. assigned construction). When set, the AI
  // resists task-switching and resumes the commitment after critical needs.
  commitment?: {
    kind: "construction";
    buildingId: ID;
    phase: "building" | "going_to_eat" | "eating" | "going_to_drink" | "drinking" | "returning" | "resting";
    sinceTick: number;
  } | null;
  action: string;
  lastMealTick?: number | null;
  lastDrinkTick?: number | null;

  traits: Trait[];
  values: ("Family" | "Freedom" | "Security" | "Status" | "Community")[];

  occupation: Occupation;
  skills: Skills;
  health: number;
  mood: number;
  needs: Needs;

  loyaltyToFounder: number;
  memories: Memory[];

  // ── Family / lineage ───────────────────────────────────────────
  familyId: ID;
  parentIds: ID[];              // 0..2
  childrenIds: ID[];
  spouseId?: ID | null;
  marriedTick?: number | null;
  marriedYear?: number | null;
  // ── Engagement (Dynastic Marriage update) ───────────────────
  fianceId?: ID | null;
  engagedTick?: number | null;
  engagedYear?: number | null;
  generation: number;           // 0 = founder, 1 = first child, etc.

  // achievements & legacy
  achievements?: string[];
  // Crops this survivor knows how to cultivate. Unioned into the
  // settlement's unlockedCrops when they're welcomed in.
  cropKnowledge?: string[];

  // ── Housing (Housing & Family update) ──────────────────────
  homeId?: ID | null;
  lastHomeKind?: BuildingKind | null;
  /** 0..100, recomputed daily. */
  housingSatisfaction?: number;
  /** Founder-opinion bonus from a recent housing upgrade — decays linearly. */
  housingGratitude?: number;
  /** Rising baseline: the longer they live here, the more they expect. */
  expectationBaseline?: number;
  /** Tick they joined the ranch — drives expectation drift. */
  arrivalTick?: number | null;

  // ── Heirs & education ──────────────────────────────────────
  /** A parent or leader has assigned this child a skill focus. */
  educationFocus?: "build" | "farm" | "lead" | "social" | "medic" | null;

  // ── Legacy ─────────────────────────────────────────────────
  /** Set when a founder (or notable leader) dies. e.g. "The Builder". */
  epithet?: string | null;

  // ── Leader-issued chat directive (Sims-style "Talk to") ─────
  /** When set, this survivor (typically the leader) walks to the target and
   *  performs the chat. Cleared when finished, interrupted by critical needs,
   *  or invalidated (target dead / out of range). */
  directive?: {
    kind: "talk";
    targetId: ID;
    topic: ChatTopic;
    issuedTick: number;
    phase: "going" | "talking" | "done";
    talkStartTick?: number | null;
  } | null;

  // ── Phase 3+ placeholders (nullable for forward-compat) ──
  factionId?: ID | null;
  politicalLean?: number | null;
}

/** Conversation flavors the player can pick from the survivor card. */
export type ChatTopic =
  | "joke"        // light humor — loved by Friendly, disliked by Paranoid/Bitter
  | "smalltalk"   // safe filler — mildly positive for everyone
  | "compliment"  // flatters — broad affection bump
  | "serious"     // weighty topic — respected by Principled/Traditional
  | "vent";       // listen to them — trust + belonging

// ── Relationships ────────────────────────────────────────────────
export type RelationshipTag =
  | "stranger" | "acquaintance" | "friend" | "close-friend"
  | "rival" | "enemy" | "kin" | "spouse";

export interface Relationship {
  a: ID;
  b: ID;
  affection: number;   // -100..100 (general warmth)
  trust: number;       // -100..100
  respect: number;     // -100..100 (admiration of competence/standing)
  attraction: number;  // -100..100 (romantic interest; gated by stage/gender)
  friendship: number;  // -100..100 (peer bond strength)
  rivalry: number;     // 0..100   (one-sided competitive tension)
  tag: RelationshipTag;
  interactions: number;
  marriedTick?: number | null;
  engagedTick?: number | null;
}

// ── Marriage proposals (Dynastic Marriage update) ───────────────
export type ProposalStatus = "pending" | "approved" | "rejected" | "postponed";

export interface MarriageProposal {
  id: ID;
  aId: ID;
  bId: ID;
  aFamilyId: ID;
  bFamilyId: ID;
  createdTick: number;
  createdYear: number;
  attraction: number;        // 0..100
  compatibility: number;     // 0..100
  familyApproval: number;    // -100..100, blended from both house heads
  prestigeA: number;
  prestigeB: number;
  /** Prestige delta the higher-prestige house can expect from the union. */
  expectedPrestigeDelta: number;
  /** Inter-family relation delta both houses will see. */
  expectedRelationDelta: number;
  status: ProposalStatus;
  /** Founder House is involved — player must decide. */
  requiresPlayer: boolean;
  /** True when arranged by the player (founder side already approves). */
  arranged?: boolean;
  /** Re-checked next tick after this. */
  resolveAfterTick?: number;
}


// ── Families ─────────────────────────────────────────────────────
export interface Family {
  id: ID;
  name: string;                 // surname or chosen
  founderId: ID;                // the first member of this family in the chronicle
  memberIds: ID[];              // all living + dead members (filter alive at runtime)
  prestige: number;             // grows from achievements / marriages / generations
  wealth: number;               // future: own assets
  motto?: string | null;
  foundedYear: number;
  extinctYear?: number | null;  // set when all members are dead
  // Family-to-family relations: keyed by other family id, -100..100
  relations: Record<ID, number>;
}

// ── Buildings ────────────────────────────────────────────────────
export type BuildingKind =
  | "homestead" | "tent" | "family-tent" | "cabin" | "family-cabin"
  | "house" | "family-house" | "large-house"
  | "manor" | "founder-manor"
  | "bunkhouse" | "guest-house" | "orphan-house" | "elder-house"
  | "campfire" | "stockpile"
  | "workbench" | "well" | "watchtower" | "field" | "farm-plot"
  | "water-collector" | "foraging-camp"
  | "fence" | "palisade" | "stone-wall" | "gate" | "guard-post"
  | "chicken-coop" | "goat-pen" | "sheep-pen" | "cattle-pasture"
  | "large-field" | "orchard" | "greenhouse"
  | "dairy-barn" | "breeding-barn" | "livestock-shelter"
  | "food-stockpile" | "warehouse" | "granary" | "root-cellar" | "cold-storage"
  | "water-barrel" | "stone-well" | "deep-well" | "water-tower" | "reservoir"
  | "learning-tent" | "schoolhouse" | "academy" | "library"
  | "medical-tent" | "clinic" | "infirmary" | "hospital";

export interface Territory {
  cx: number;     // center tile x (usually homestead center)
  cy: number;     // center tile y
  radius: number; // tiles; 0 = not yet defined. Effective max(halfW, halfH).
  /** Optional rectangular half-width (tiles). Falls back to radius. */
  halfW?: number;
  /** Optional rectangular half-height (tiles). Falls back to radius. */
  halfH?: number;
}

// ── Farm plots ───────────────────────────────────────────────────
export type FarmStage =
  | "empty" | "planting" | "growing" | "mature" | "harvesting";

export interface FarmState {
  cropId: string;               // CropId from data/crops.ts
  stage: FarmStage;
  growth: number;               // 0..1, 1 = mature
  plantedTick: number | null;
  plantedYear?: number | null;
  assignedFarmerId: ID | null;
  lastYield: number | null;
  lastHarvestYear?: number | null;
  lastHarvestDay?: number | null;
  totalHarvests: number;
  /** Tick the plot first became mature (for spoilage timing). */
  matureSinceTick?: number | null;
}

export type AnimalSpecies = "chicken" | "goat" | "sheep" | "cattle";
export type AnimalSex = "m" | "f";

export interface Animal {
  id: ID;
  species: AnimalSpecies;
  name?: string | null;
  sex: AnimalSex;
  ageDays: number;
  bornTick: number;
  health: number;          // 0..100
  hunger: number;          // 0..100 (higher = hungrier)
  ownerFamilyId: ID;
  buildingId: ID | null;
  pregnant: boolean;
  pregnancyTick?: number | null;
  lastProducedTick?: number | null;
  dead?: boolean;
  deathTick?: number | null;
  deathCause?: "starvation" | "illness" | "old-age" | "slaughter" | null;
}

export type LivestockRequestStatus = "pending" | "approved" | "rejected" | "postponed";

export interface LivestockRequest {
  id: ID;
  familyId: ID;
  requesterId: ID;
  kind: "start-raising" | "build-pen" | "expand";
  species: AnimalSpecies;
  buildingKind?: BuildingKind;
  createdTick: number;
  createdYear: number;
  status: LivestockRequestStatus;
  resolveAfterTick?: number;
  /** Tribute the family offers to the ranch in return — paid monthly when approved. */
  tributeOffer?: { resource: ResourceKind; perMonth: number };
  /** Tick the next tribute is due (set when approved). */
  nextTributeTick?: number;
}

// ── Ministers / Administration (v5) ──────────────────────────────
export type MinisterRole =
  | "head-farmer" | "head-builder" | "head-rancher" | "quartermaster";

export interface Minister {
  id: ID;
  role: MinisterRole;
  survivorId: ID;
  appointedTick: number;
  /** 0..100, drives loyalty drift and report tone. */
  satisfaction: number;
  requestsApproved: number;
  requestsRejected: number;
  lastRequestTick?: number | null;
  lastReportTick?: number | null;
}

export type MinisterRequestStatus =
  | "pending" | "approved" | "partial" | "rejected" | "postponed";

export interface MinisterRequest {
  id: ID;
  ministerId: ID;
  role: MinisterRole;
  survivorId: ID;
  requestedWorkers: number;
  approvedWorkers: number;
  createdTick: number;
  createdYear: number;
  status: MinisterRequestStatus;
  reason: string;
  resolveAfterTick?: number;
}

export interface MinisterReport {
  id: ID;
  ministerId: ID;
  role: MinisterRole;
  tick: number;
  year: number;
  season: Season;
  day: number;
  text: string;
  tone: "positive" | "neutral" | "negative";
}

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  blurb: string;
  size: { w: number; h: number };
  cost: Partial<Record<ResourceKind, number>>;
  buildEffort: number;
  housingCapacity: number;
  /** 0 = non-residential, 1..5 = housing tier (1 tent → 5 manor). */
  housingQuality?: number;
  storageCapacity: number;
  social: boolean;
  produces?: { resource: ResourceKind; perDay: number } | null;
  /** Livestock buildings: which species + how many fit. */
  livestock?: { species: AnimalSpecies; capacity: number } | null;
}

export interface Building {
  id: ID;
  kind: BuildingKind;
  x: number; y: number;
  w: number; h: number;
  builtProgress: number;
  effortRemaining: number;
  buildEffortTotal: number;
  completedYear?: number | null;
  assignedBuilderId?: ID | null;
  /** Persistent worker assignment for completed production buildings. */
  assignedWorkerId?: ID | null;
  resourcesDelivered?: Partial<Record<ResourceKind, number>>;
  lastWorkedTick?: number | null;
  stalledTicks?: number;
  occupantIds: ID[];
  /** Founder may reserve a home for a particular survivor or future family. */
  reserved?: boolean;
  reservedFor?: ID | null;
  stored: Partial<Record<ResourceKind, number>>;
  farm?: FarmState | null;
  /** Livestock buildings: which House owns this pen/coop/pasture. */
  livestockOwnerFamilyId?: ID | null;
}

// ── Arrival events (transient, not persisted) ───────────────────
export type ArrivalKind =
  | "lone" | "couple" | "parent-child"
  | "small-family" | "travelers" | "injured" | "refugees";

export interface ArrivalEvent {
  id: ID;
  kind: ArrivalKind;
  title: string;
  blurb: string;
  survivors: Survivor[];
  family: Family;
  gifts: Partial<Record<ResourceKind, number>>;
  cropKnowledge?: string[]; // CropIds unlocked by accepting this party
  arrivedTick: number;
}

// ── Chronicle ────────────────────────────────────────────────────
export type ChronicleCategory =
  | "founding" | "arrival" | "departure" | "death"
  | "birth" | "marriage" | "succession" | "coming-of-age"
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
  involvedFamilyIds?: ID[];
}

// ── Settlement / dynasty aggregates ──────────────────────────────
export interface SettlementStats {
  population: number;
  morale: number;
  prestige: number;
  foundedYear: number;
  generations: number;          // highest generation number alive
  dynastyName: string;          // founder's family name
  totalBorn: number;
  totalDied: number;
}

// ── Save Game ────────────────────────────────────────────────────
import type { Expedition } from "./sim/expeditions";

export interface SaveGame {
  version: 2 | 3 | 4 | 5 | 6;
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
  families: Family[];
  founderId: ID;
  currentLeaderId: ID;
  preferredHeirId?: ID | null;
  buildings: Building[];
  resources: Record<ResourceKind, number>;
  chronicle: ChronicleEntry[];
  stats: SettlementStats;
  unlockedCrops?: string[];
  foundingPhase?: boolean;
  territory?: { cx: number; cy: number; radius: number } | null;
  // Marriage proposals (v3+)
  proposals?: MarriageProposal[];
  // Livestock (v4+)
  animals?: Animal[];
  livestockRequests?: LivestockRequest[];
  // Ministers (v5+)
  ministers?: Minister[];
  ministerRequests?: MinisterRequest[];
  ministerReports?: MinisterReport[];
  // Expeditions (v6+) — full persistence including active trips,
  // per-member fates, rewards, and stories.
  expeditions?: Expedition[];
  // Phase 3+ reservations (always present, empty for now):
  factions: unknown[];
  laws: unknown[];
  externalSettlements: unknown[];
}
