import type { Background, BuildingDef, BuildingKind, Trait } from "../types";

export const FIRST_NAMES_M = [
  "Eli", "Jonah", "Caleb", "Marcus", "Silas", "Owen", "Wyatt", "Bishop",
  "August", "Cyrus", "Hollis", "Rhett", "Asa", "Levi", "Boone", "Tobias",
  "Ezra", "Theo", "Amos", "Reuben", "Isaac", "Jude", "Finn", "Roland",
];
export const FIRST_NAMES_F = [
  "Hattie", "June", "Mae", "Cora", "Wren", "Sage", "Eleanor", "Maren",
  "Ruth", "Tess", "Imogen", "Annika", "Della", "Beatrix", "Iris", "Opal",
  "Linnea", "Clemmie", "Edith", "Marigold", "Astrid", "Nell", "Vera", "Lula",
];
export const SURNAMES = [
  "Hollow", "Greer", "Vance", "Marrow", "Ashby", "Crane", "Whitlock",
  "Pike", "Holloway", "Thorne", "Crowder", "Beckett", "Stark", "Quill",
  "Reyes", "Okafor", "Sato", "Calder", "Mendel", "Voss",
];

export const TRAITS: Trait[] = [
  "Ambitious", "Loyal", "Generous", "Greedy", "Principled",
  "Paranoid", "Traditional", "Idealistic", "Bitter", "Brave",
];

export const TRAIT_BLURBS: Record<Trait, string> = {
  Ambitious: "Seeks advancement. Resents being passed over.",
  Loyal: "Slow to change allegiances. Defends allies at cost.",
  Generous: "Shares freely. Builds trust through gifts.",
  Greedy: "Accumulates. Resists taxation and redistribution.",
  Principled: "Will not act against stated values, whatever the cost.",
  Paranoid: "Sees threats in neutral events. Builds personal security.",
  Traditional: "Resists change. Values custom and precedent.",
  Idealistic: "Believes in collective good. Easily disillusioned.",
  Bitter: "Holds grudges. Interprets events through past injustice.",
  Brave: "Volunteers for danger. Confronts problems directly.",
};

export const BACKGROUNDS: { id: Background; name: string; blurb: string; skills: Partial<Record<keyof import("../types").Skills, number>> }[] = [
  { id: "rancher", name: "Rancher", blurb: "Knew this land before the world ended.", skills: { farm: 5, build: 3, lead: 2 } },
  { id: "soldier", name: "Soldier", blurb: "Carries discipline like a weight.", skills: { lead: 4, build: 2, mine: 3 } },
  { id: "medic", name: "Medic", blurb: "Has seen the worst hours of bodies.", skills: { medic: 6, forage: 2 } },
  { id: "scholar", name: "Scholar", blurb: "Useless and indispensable in equal turns.", skills: { lead: 3, medic: 2, farm: 1 } },
  { id: "carpenter", name: "Carpenter", blurb: "Frames a wall by feel.", skills: { build: 6, cut: 3 } },
  { id: "farmer", name: "Farmer", blurb: "Reads weather like scripture.", skills: { farm: 6, forage: 3 } },
  { id: "drifter", name: "Drifter", blurb: "Has nothing and almost likes it that way.", skills: { forage: 4, cut: 2, mine: 2 } },
  { id: "criminal", name: "Criminal", blurb: "Survives by the angles others won't see.", skills: { forage: 3, lead: 2, mine: 2 } },
  { id: "native-born", name: "Born on the Ranch", blurb: "Knows no other world but this one.", skills: { farm: 2, build: 2, forage: 2 } },
];

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  homestead: {
    kind: "homestead", name: "Homestead", blurb: "The original house. Where it all began.",
    size: { w: 3, h: 3 },
    cost: {}, buildEffort: 0, housingCapacity: 4, storageCapacity: 200, social: true,
    produces: null,
  },
  tent: {
    kind: "tent", name: "Canvas Tent", blurb: "Sleep under stitched cloth.",
    size: { w: 2, h: 2 },
    cost: { wood: 8, fiber: 4 }, buildEffort: 40, housingCapacity: 2, storageCapacity: 0, social: false,
    produces: null,
  },
  cabin: {
    kind: "cabin", name: "Log Cabin", blurb: "A real roof. Walls that hold the cold out.",
    size: { w: 3, h: 3 },
    cost: { wood: 30, stone: 8 }, buildEffort: 140, housingCapacity: 3, storageCapacity: 40, social: false,
    produces: null,
  },
  campfire: {
    kind: "campfire", name: "Campfire", blurb: "Where the day ends and stories start.",
    size: { w: 1, h: 1 },
    cost: { wood: 5, stone: 4 }, buildEffort: 20, housingCapacity: 0, storageCapacity: 0, social: true,
    produces: null,
  },
  stockpile: {
    kind: "stockpile", name: "Stockpile", blurb: "Wood pallets and tarps. A place for the haul.",
    size: { w: 2, h: 2 },
    cost: { wood: 6 }, buildEffort: 24, housingCapacity: 0, storageCapacity: 250, social: false,
    produces: null,
  },
  workbench: {
    kind: "workbench", name: "Workbench", blurb: "Coarse tools take shape here.",
    size: { w: 2, h: 1 },
    cost: { wood: 10, stone: 4 }, buildEffort: 50, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: { resource: "tools", perDay: 1 },
  },
  well: {
    kind: "well", name: "Well", blurb: "Dug deep. Water that won't quit in summer.",
    size: { w: 2, h: 2 },
    cost: { stone: 16, wood: 4 }, buildEffort: 80, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: { resource: "water", perDay: 8 },
  },
  watchtower: {
    kind: "watchtower", name: "Watchtower", blurb: "Eyes on the horizon. For what's coming.",
    size: { w: 2, h: 2 },
    cost: { wood: 24, stone: 8 }, buildEffort: 100, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: null,
  },
  field: {
    kind: "field", name: "Tilled Field", blurb: "Furrows opened by hand and sweat. Replaced by the Farm Plot.",
    size: { w: 3, h: 3 },
    cost: { wood: 6, fiber: 4 }, buildEffort: 60, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: { resource: "food", perDay: 6 },
  },
  "farm-plot": {
    kind: "farm-plot", name: "Farm Plot", blurb: "Tilled soil ready for seed. Choose a crop and assign a farmer.",
    size: { w: 2, h: 2 },
    cost: { wood: 4, fiber: 3 }, buildEffort: 30, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: null,
  },
};

export const BUILDABLE_KINDS: BuildingKind[] = [
  "tent", "cabin", "campfire", "stockpile", "workbench", "farm-plot", "well",
];

export const CHRONICLE_OPENERS = [
  "And so it was written",
  "Recorded in the ledger",
  "Memory keeps that",
  "It is told that",
  "The chronicle marks",
];

// ── Lifecycle thresholds ─────────────────────────────────────────
export const LIFE_STAGE_THRESHOLDS = {
  child: 0,
  teen: 13,
  youth: 17,
  adult: 21,
  elder: 60,
} as const;

export const COMING_OF_AGE = LIFE_STAGE_THRESHOLDS.adult;
export const FERTILE_MIN = 19;
export const FERTILE_MAX = 48;
export const NATURAL_DEATH_AGE = 70;
