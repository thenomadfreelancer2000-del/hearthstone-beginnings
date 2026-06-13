// Crop catalog for the farming system.
export type CropId =
  | "corn" | "potatoes" | "beans"
  | "tomatoes" | "wheat" | "pumpkin" | "herbs" | "fruit";

export interface CropDef {
  id: CropId;
  name: string;
  blurb: string;
  growthDays: number;   // base days from planted → mature
  baseYield: number;    // food units at neutral skill (≈ skill 10)
  starter: boolean;     // unlocked at game start
  color: string;        // visual tint on the map
  rarity: "common" | "uncommon" | "rare";
  knowledgeLine: string; // text shown on arrival events
}

export const CROPS: Record<CropId, CropDef> = {
  corn: {
    id: "corn", name: "Corn",
    blurb: "Tall stalks. High yield, slow growth.",
    growthDays: 10, baseYield: 36, starter: true,
    color: "#d4a83a", rarity: "common",
    knowledgeLine: "Brings Corn Cultivation",
  },
  potatoes: {
    id: "potatoes", name: "Potatoes",
    blurb: "Reliable tubers. Steady food for hard winters.",
    growthDays: 7, baseYield: 24, starter: true,
    color: "#a78258", rarity: "common",
    knowledgeLine: "Brings Potato Cultivation",
  },
  beans: {
    id: "beans", name: "Beans",
    blurb: "Quick climbers. Modest harvest, fast turnaround.",
    growthDays: 4, baseYield: 14, starter: true,
    color: "#6a8a3a", rarity: "common",
    knowledgeLine: "Brings Bean Cultivation",
  },
  tomatoes: {
    id: "tomatoes", name: "Tomatoes",
    blurb: "Bright fruit on the vine. Fragile but generous.",
    growthDays: 6, baseYield: 22, starter: false,
    color: "#b13c2e", rarity: "uncommon",
    knowledgeLine: "Carries Tomato Seeds",
  },
  wheat: {
    id: "wheat", name: "Wheat",
    blurb: "Bread for the years to come.",
    growthDays: 9, baseYield: 30, starter: false,
    color: "#e2c66b", rarity: "uncommon",
    knowledgeLine: "Brings Wheat Cultivation",
  },
  pumpkin: {
    id: "pumpkin", name: "Pumpkin",
    blurb: "Heavy gourds for cellar storage.",
    growthDays: 11, baseYield: 40, starter: false,
    color: "#d9722a", rarity: "rare",
    knowledgeLine: "Carries Pumpkin Seeds",
  },
  herbs: {
    id: "herbs", name: "Medicinal Herbs",
    blurb: "For the sick room. Small but vital.",
    growthDays: 5, baseYield: 12, starter: false,
    color: "#6f9558", rarity: "uncommon",
    knowledgeLine: "Brings Medicinal Herbs",
  },
  fruit: {
    id: "fruit", name: "Fruit Trees",
    blurb: "Year-round abundance, once rooted.",
    growthDays: 14, baseYield: 50, starter: false,
    color: "#a44060", rarity: "rare",
    knowledgeLine: "Brings Fruit Tree Saplings",
  },
};

export const ALL_CROP_IDS: CropId[] = Object.keys(CROPS) as CropId[];
export const STARTER_CROP_IDS: CropId[] = ALL_CROP_IDS.filter(id => CROPS[id].starter);

export function isCropId(s: string | undefined | null): s is CropId {
  return !!s && (s in CROPS);
}

// Skill is 0..30. Yield scales 0.6× → 1.5×.
export function expectedYield(crop: CropDef, farmerSkill: number) {
  const s = Math.max(0, Math.min(30, farmerSkill));
  const mult = 0.6 + (s / 30) * 0.9;
  return Math.round(crop.baseYield * mult);
}

// Growth speed multiplier from farming skill (0.5× → 1.3×).
export function growthRateMultiplier(farmerSkill: number) {
  const s = Math.max(0, Math.min(30, farmerSkill));
  return 0.5 + (s / 30) * 0.8;
}

export function skillTierLabel(v: number) {
  const r = Math.round(v);
  if (r <= 5)  return "Beginner";
  if (r <= 15) return "Competent";
  if (r <= 25) return "Experienced";
  return "Expert";
}
