import type { Background, BuildingDef, BuildingKind, Trait } from "../types";
import { ALL_TRAITS, TRAIT_BLURBS as CATALOG_BLURBS } from "./traits";

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
  // +50
  "Bramble", "Cordell", "Dunmore", "Eastwood", "Fairburn", "Garrick",
  "Hatcher", "Ironside", "Jessup", "Kettle", "Larkin", "Mosley",
  "Norwood", "Ostler", "Penrose", "Quarles", "Ridley", "Sutter",
  "Tindall", "Underhill", "Varnell", "Wexler", "Yardley", "Zimmer",
  "Alder", "Brockman", "Caldwell", "Drummond", "Ellery", "Fenwick",
  "Goodrow", "Hargrave", "Inman", "Jericho", "Kessler", "Lockhart",
  "Maddox", "Nash", "Orman", "Pruitt", "Renfield", "Shaw",
  "Tully", "Usher", "Vance-Hill", "Whitfield", "Yates", "Zane",
  "Carrow", "Doss",
];

// Re-export the trait catalog for back-compat with existing imports.
export const TRAITS: Trait[] = ALL_TRAITS;
export const TRAIT_BLURBS: Record<string, string> = CATALOG_BLURBS;

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
    size: { w: 14, h: 14 },
    cost: {}, buildEffort: 0, housingCapacity: 4, housingQuality: 3, storageCapacity: 200, social: true,
    produces: null,
  },
  tent: {
    kind: "tent", name: "Canvas Tent", blurb: "Sleep under stitched cloth. Cramped, but it's a roof.",
    size: { w: 2, h: 2 },
    cost: { wood: 8, fiber: 4 }, buildEffort: 40, housingCapacity: 2, housingQuality: 1, storageCapacity: 0, social: false,
    produces: null,
  },
  cabin: {
    kind: "cabin", name: "Log Cabin", blurb: "A real roof. Walls that hold the cold out. Snug for one or two.",
    size: { w: 2, h: 2 },
    cost: { wood: 22, stone: 6 }, buildEffort: 110, housingCapacity: 2, housingQuality: 2, storageCapacity: 30, social: false,
    produces: null,
  },
  house: {
    kind: "house", name: "House", blurb: "Two rooms, a hearth, and a door that latches.",
    size: { w: 3, h: 3 },
    cost: { wood: 60, stone: 20 }, buildEffort: 260, housingCapacity: 4, housingQuality: 3, storageCapacity: 60, social: false,
    produces: null,
  },
  "family-tent": {
    kind: "family-tent", name: "Family Tent", blurb: "A larger canvas shelter stitched for a whole family.",
    size: { w: 3, h: 2 },
    cost: { wood: 14, fiber: 8 }, buildEffort: 70, housingCapacity: 5, housingQuality: 1, storageCapacity: 0, social: false,
    produces: null,
  },
  "family-cabin": {
    kind: "family-cabin", name: "Family Cabin", blurb: "A roomier log cabin built for a family.",
    size: { w: 3, h: 3 },
    cost: { wood: 55, stone: 14 }, buildEffort: 220, housingCapacity: 5, housingQuality: 2, storageCapacity: 50, social: false,
    produces: null,
  },
  "family-house": {
    kind: "family-house", name: "Family House", blurb: "Three rooms, a hearth, and space for the kids.",
    size: { w: 4, h: 3 },
    cost: { wood: 85, stone: 30 }, buildEffort: 360, housingCapacity: 7, housingQuality: 3, storageCapacity: 80, social: false,
    produces: null,
  },
  "large-house": {
    kind: "large-house", name: "Large House", blurb: "Room enough for a whole family and then some.",
    size: { w: 4, h: 4 },
    cost: { wood: 110, stone: 45 }, buildEffort: 460, housingCapacity: 10, housingQuality: 4, storageCapacity: 100, social: false,
    produces: null,
  },
  manor: {
    kind: "manor", name: "Manor", blurb: "A house head's residence. Carved beams and a wide hearth.",
    size: { w: 5, h: 4 },
    cost: { wood: 160, stone: 80 }, buildEffort: 640, housingCapacity: 8, housingQuality: 5, storageCapacity: 140, social: true,
    produces: null,
  },
  "founder-manor": {
    kind: "founder-manor", name: "Founder's Manor", blurb: "The seat of the founding family. Built to outlast generations.",
    size: { w: 5, h: 5 },
    cost: { wood: 220, stone: 140 }, buildEffort: 900, housingCapacity: 10, housingQuality: 5, storageCapacity: 200, social: true,
    produces: null,
  },
  bunkhouse: {
    kind: "bunkhouse", name: "Bunkhouse", blurb: "Rows of cots for the work crews. Cheap and dense.",
    size: { w: 4, h: 3 },
    cost: { wood: 70, stone: 12 }, buildEffort: 300, housingCapacity: 12, housingQuality: 1, storageCapacity: 30, social: false,
    produces: null,
  },
  "guest-house": {
    kind: "guest-house", name: "Guest House", blurb: "A small cottage for newcomers and travelers.",
    size: { w: 3, h: 2 },
    cost: { wood: 40, stone: 10 }, buildEffort: 160, housingCapacity: 4, housingQuality: 2, storageCapacity: 20, social: false,
    produces: null,
  },
  "orphan-house": {
    kind: "orphan-house", name: "Orphan House", blurb: "A safe roof for children with no family left.",
    size: { w: 3, h: 3 },
    cost: { wood: 60, stone: 20, fiber: 6 }, buildEffort: 260, housingCapacity: 8, housingQuality: 2, storageCapacity: 40, social: true,
    produces: null,
  },
  "elder-house": {
    kind: "elder-house", name: "Elder House", blurb: "A quiet home where the old ones see out their days.",
    size: { w: 3, h: 3 },
    cost: { wood: 55, stone: 18 }, buildEffort: 240, housingCapacity: 6, housingQuality: 3, storageCapacity: 40, social: true,
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
  "water-collector": {
    kind: "water-collector", name: "Water Collector", blurb: "Tarps and barrels to catch the rain. Quicker than a well.",
    size: { w: 2, h: 2 },
    cost: { wood: 6, fiber: 4 }, buildEffort: 35, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: { resource: "water", perDay: 5 },
  },
  "foraging-camp": {
    kind: "foraging-camp", name: "Foraging Camp", blurb: "A base for gathering from the wild. Low yield, fast to build.",
    size: { w: 2, h: 2 },
    cost: { wood: 6, fiber: 3 }, buildEffort: 30, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: { resource: "food", perDay: 4 },
  },
  fence: {
    kind: "fence", name: "Wooden Fence", blurb: "A simple post-and-rail barrier. Marks the edge of the ranch.",
    size: { w: 1, h: 1 },
    cost: { wood: 4 }, buildEffort: 10, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: null,
  },
  palisade: {
    kind: "palisade", name: "Palisade Wall", blurb: "Sharpened logs driven into the earth. Slows raiders.",
    size: { w: 1, h: 1 },
    cost: { wood: 10 }, buildEffort: 28, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: null,
  },
  "stone-wall": {
    kind: "stone-wall", name: "Stone Wall", blurb: "Mortared stone. The kind of wall that outlives the mason.",
    size: { w: 1, h: 1 },
    cost: { stone: 14, wood: 2 }, buildEffort: 70, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: null,
  },
  gate: {
    kind: "gate", name: "Reinforced Gate", blurb: "A heavy timber gate. Swings shut when night falls.",
    size: { w: 2, h: 1 },
    cost: { wood: 16, stone: 4 }, buildEffort: 60, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: null,
  },
  "guard-post": {
    kind: "guard-post", name: "Guard Post", blurb: "A small shack where a sentry waits out the cold.",
    size: { w: 2, h: 2 },
    cost: { wood: 14, stone: 4 }, buildEffort: 55, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: null,
  },
  "chicken-coop": {
    kind: "chicken-coop", name: "Chicken Coop", blurb: "Nesting boxes and a wire run. Eggs at dawn.",
    size: { w: 2, h: 2 },
    cost: { wood: 12, fiber: 4 }, buildEffort: 45, housingCapacity: 0, storageCapacity: 30, social: false,
    produces: { resource: "eggs", perDay: 4 },
    livestock: { species: "chicken", capacity: 8 },
  },
  "goat-pen": {
    kind: "goat-pen", name: "Goat Pen", blurb: "Fenced yard and a small shed. Milk and stubborn company.",
    size: { w: 3, h: 2 },
    cost: { wood: 20, stone: 4, fiber: 4 }, buildEffort: 80, housingCapacity: 0, storageCapacity: 40, social: false,
    produces: { resource: "milk", perDay: 3 },
    livestock: { species: "goat", capacity: 6 },
  },
  "sheep-pen": {
    kind: "sheep-pen", name: "Sheep Pen", blurb: "Shaded paddock for the flock. Wool to weave.",
    size: { w: 3, h: 3 },
    cost: { wood: 22, fiber: 6 }, buildEffort: 90, housingCapacity: 0, storageCapacity: 40, social: false,
    produces: { resource: "wool", perDay: 2 },
    livestock: { species: "sheep", capacity: 6 },
  },
  "cattle-pasture": {
    kind: "cattle-pasture", name: "Cattle Pasture", blurb: "Open grazing fenced off for the herd.",
    size: { w: 4, h: 3 },
    cost: { wood: 32, stone: 6 }, buildEffort: 140, housingCapacity: 0, storageCapacity: 60, social: false,
    produces: { resource: "milk", perDay: 5 },
    livestock: { species: "cattle", capacity: 4 },
  },
  "large-field": {
    kind: "large-field", name: "Large Field", blurb: "A wide tract of tilled soil. Bigger yields, more labor.",
    size: { w: 4, h: 4 },
    cost: { wood: 12, fiber: 8 }, buildEffort: 90, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: { resource: "food", perDay: 10 },
  },
  orchard: {
    kind: "orchard", name: "Orchard", blurb: "Rows of fruit trees. Slow to mature, generous when they bear.",
    size: { w: 4, h: 4 },
    cost: { wood: 24, fiber: 6 }, buildEffort: 160, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: { resource: "food", perDay: 8 },
  },
  greenhouse: {
    kind: "greenhouse", name: "Greenhouse", blurb: "Glass-roofed shelter. Crops through every season.",
    size: { w: 3, h: 3 },
    cost: { wood: 30, stone: 10, tools: 4 }, buildEffort: 200, housingCapacity: 0, storageCapacity: 20, social: false,
    produces: { resource: "food", perDay: 12 },
  },
  "dairy-barn": {
    kind: "dairy-barn", name: "Dairy Barn", blurb: "Stalls, churns, and pails. Steady milk through the year.",
    size: { w: 4, h: 3 },
    cost: { wood: 40, stone: 10 }, buildEffort: 180, housingCapacity: 0, storageCapacity: 50, social: false,
    produces: { resource: "milk", perDay: 8 },
    livestock: { species: "cattle", capacity: 6 },
  },
  "breeding-barn": {
    kind: "breeding-barn", name: "Breeding Barn", blurb: "Pens for pairing stock. Grows the herd over seasons.",
    size: { w: 4, h: 3 },
    cost: { wood: 36, stone: 8, fiber: 6 }, buildEffort: 170, housingCapacity: 0, storageCapacity: 40, social: false,
    produces: null,
    livestock: { species: "cattle", capacity: 6 },
  },
  "livestock-shelter": {
    kind: "livestock-shelter", name: "Livestock Shelter", blurb: "A simple roofed shed for any animal caught in the cold.",
    size: { w: 3, h: 2 },
    cost: { wood: 18, fiber: 4 }, buildEffort: 70, housingCapacity: 0, storageCapacity: 20, social: false,
    produces: null,
    livestock: { species: "sheep", capacity: 4 },
  },
  "food-stockpile": {
    kind: "food-stockpile", name: "Food Stockpile", blurb: "Crates and sacks for the harvest. Keeps food off the dirt.",
    size: { w: 2, h: 2 },
    cost: { wood: 8, fiber: 3 }, buildEffort: 30, housingCapacity: 0, storageCapacity: 200, social: false,
    produces: null,
  },
  warehouse: {
    kind: "warehouse", name: "Warehouse", blurb: "A timber-and-stone hall for the settlement's haul.",
    size: { w: 4, h: 3 },
    cost: { wood: 50, stone: 20 }, buildEffort: 220, housingCapacity: 0, storageCapacity: 800, social: false,
    produces: null,
  },
  granary: {
    kind: "granary", name: "Granary", blurb: "Raised bins that keep grain dry and out of reach of vermin.",
    size: { w: 3, h: 3 },
    cost: { wood: 30, stone: 8 }, buildEffort: 130, housingCapacity: 0, storageCapacity: 400, social: false,
    produces: null,
  },
  "root-cellar": {
    kind: "root-cellar", name: "Root Cellar", blurb: "A cool, earthen hold for tubers and preserves.",
    size: { w: 2, h: 2 },
    cost: { wood: 10, stone: 18 }, buildEffort: 100, housingCapacity: 0, storageCapacity: 250, social: false,
    produces: null,
  },
  "cold-storage": {
    kind: "cold-storage", name: "Cold Storage", blurb: "Ice-packed walls. Even meat keeps through summer.",
    size: { w: 3, h: 2 },
    cost: { wood: 24, stone: 30, tools: 4 }, buildEffort: 240, housingCapacity: 0, storageCapacity: 350, social: false,
    produces: null,
  },
  "water-barrel": {
    kind: "water-barrel", name: "Water Barrel", blurb: "A staved barrel under the eaves. Catches what the sky gives.",
    size: { w: 1, h: 1 },
    cost: { wood: 4 }, buildEffort: 10, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: { resource: "water", perDay: 2 },
  },
  "stone-well": {
    kind: "stone-well", name: "Stone Well", blurb: "Mortared stone shaft. Cleaner draw, longer life.",
    size: { w: 2, h: 2 },
    cost: { stone: 28, wood: 6 }, buildEffort: 140, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: { resource: "water", perDay: 12 },
  },
  "deep-well": {
    kind: "deep-well", name: "Deep Well", blurb: "Driven far below the dry layer. Water in any season.",
    size: { w: 2, h: 2 },
    cost: { stone: 40, wood: 10, tools: 4 }, buildEffort: 220, housingCapacity: 0, storageCapacity: 0, social: false,
    produces: { resource: "water", perDay: 18 },
  },
  "water-tower": {
    kind: "water-tower", name: "Water Tower", blurb: "A raised tank that feeds the ranch by gravity.",
    size: { w: 2, h: 2 },
    cost: { wood: 40, stone: 20, tools: 6 }, buildEffort: 260, housingCapacity: 0, storageCapacity: 300, social: false,
    produces: null,
  },
  reservoir: {
    kind: "reservoir", name: "Reservoir", blurb: "A lined basin holding water through the dry months.",
    size: { w: 4, h: 4 },
    cost: { stone: 60, wood: 18 }, buildEffort: 340, housingCapacity: 0, storageCapacity: 600, social: false,
    produces: null,
  },
  "learning-tent": {
    kind: "learning-tent", name: "Learning Tent", blurb: "A canvas roof, a slate, and a teacher. The first letters.",
    size: { w: 2, h: 2 },
    cost: { wood: 8, fiber: 4 }, buildEffort: 40, housingCapacity: 0, storageCapacity: 0, social: true,
    produces: null,
  },
  schoolhouse: {
    kind: "schoolhouse", name: "Schoolhouse", blurb: "Benches, a chalkboard, real walls. Lessons through the seasons.",
    size: { w: 3, h: 3 },
    cost: { wood: 50, stone: 16 }, buildEffort: 220, housingCapacity: 0, storageCapacity: 0, social: true,
    produces: null,
  },
  academy: {
    kind: "academy", name: "Academy", blurb: "Halls of learning. Where future leaders and scholars are shaped.",
    size: { w: 4, h: 4 },
    cost: { wood: 110, stone: 60, tools: 6 }, buildEffort: 480, housingCapacity: 0, storageCapacity: 40, social: true,
    produces: null,
  },
  library: {
    kind: "library", name: "Library", blurb: "Shelves of salvaged books. Knowledge preserved across generations.",
    size: { w: 3, h: 3 },
    cost: { wood: 70, stone: 40, tools: 4 }, buildEffort: 320, housingCapacity: 0, storageCapacity: 0, social: true,
    produces: null,
  },
  "medical-tent": {
    kind: "medical-tent", name: "Medical Tent", blurb: "Cots, bandages, boiled water. The first line against fever.",
    size: { w: 2, h: 2 },
    cost: { wood: 8, fiber: 6 }, buildEffort: 45, housingCapacity: 0, storageCapacity: 10, social: false,
    produces: null,
  },
  clinic: {
    kind: "clinic", name: "Clinic", blurb: "A proper room for the sick. Salves, stitches, and a watchful healer.",
    size: { w: 3, h: 2 },
    cost: { wood: 40, stone: 12, tools: 3 }, buildEffort: 180, housingCapacity: 0, storageCapacity: 20, social: false,
    produces: null,
  },
  infirmary: {
    kind: "infirmary", name: "Infirmary", blurb: "Rows of beds, trained hands. Few die here that don't have to.",
    size: { w: 4, h: 3 },
    cost: { wood: 70, stone: 28, tools: 6 }, buildEffort: 300, housingCapacity: 0, storageCapacity: 40, social: false,
    produces: null,
  },
  hospital: {
    kind: "hospital", name: "Hospital", blurb: "A full hall of healing. The settlement's bulwark against death.",
    size: { w: 5, h: 4 },
    cost: { wood: 140, stone: 80, tools: 12 }, buildEffort: 600, housingCapacity: 0, storageCapacity: 80, social: true,
    produces: null,
  },
};

export const BUILDABLE_KINDS: BuildingKind[] = [
  "tent", "family-tent", "cabin", "family-cabin",
  "house", "family-house", "large-house",
  "manor", "founder-manor",
  "bunkhouse", "guest-house", "orphan-house", "elder-house",
  "campfire", "stockpile", "workbench",
  "farm-plot", "field", "large-field", "orchard", "greenhouse", "foraging-camp",
  "well", "stone-well", "deep-well", "water-collector", "water-barrel", "water-tower", "reservoir",
  "fence", "palisade", "stone-wall", "gate", "watchtower", "guard-post",
  "chicken-coop", "goat-pen", "sheep-pen", "cattle-pasture",
  "dairy-barn", "breeding-barn", "livestock-shelter",
  "food-stockpile", "warehouse", "granary", "root-cellar", "cold-storage",
  "learning-tent", "schoolhouse", "academy", "library",
  "medical-tent", "clinic", "infirmary", "hospital",
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
