import type { BuildingKind, ResourceKind } from "../types";

export type WorkshopCategory =
  | "housing"
  | "homestead"
  | "farm"
  | "livestock"
  | "storage"
  | "water"
  | "school"
  | "medical"
  | "decoration"
  | "road"
  | "fence";

export const WORKSHOP_CATEGORIES: { id: WorkshopCategory; label: string }[] = [
  { id: "housing", label: "Housing" },
  { id: "homestead", label: "Homesteads" },
  { id: "farm", label: "Farms" },
  { id: "livestock", label: "Livestock" },
  { id: "storage", label: "Storage" },
  { id: "water", label: "Water" },
  { id: "school", label: "Schools" },
  { id: "medical", label: "Medical" },
  { id: "decoration", label: "Decorations" },
  { id: "road", label: "Roads" },
  { id: "fence", label: "Fences" },
];

/** Procedural style — palette/material applied to a base iso block. */
export type ProceduralStyle =
  | "wood-cabin"
  | "stone-house"
  | "brick-house"
  | "white-manor"
  | "canvas-tent"
  | "log-barn"
  | "slate-tower"
  | "thatch-cottage";

export const PROCEDURAL_STYLES: { id: ProceduralStyle; label: string; baseKind: BuildingKind }[] = [
  { id: "wood-cabin",     label: "Wood Cabin",     baseKind: "cabin" },
  { id: "stone-house",    label: "Stone House",    baseKind: "house" },
  { id: "brick-house",    label: "Brick House",    baseKind: "large-house" },
  { id: "white-manor",    label: "White Manor",    baseKind: "manor" },
  { id: "canvas-tent",    label: "Canvas Tent",    baseKind: "tent" },
  { id: "log-barn",       label: "Log Barn",       baseKind: "dairy-barn" },
  { id: "slate-tower",    label: "Slate Tower",    baseKind: "watchtower" },
  { id: "thatch-cottage", label: "Thatch Cottage", baseKind: "family-cabin" },
];

export type WorkshopVisual =
  | { type: "sprite"; dataUrl: string }
  | { type: "procedural"; style: ProceduralStyle; tint?: string };

export interface WorkshopBuilding {
  /** Unique within the pack. */
  id: string;
  name: string;
  description: string;
  category: WorkshopCategory;
  size: { w: number; h: number };
  cost: Partial<Record<ResourceKind, number>>;
  buildEffort: number;
  /** Housing capacity for residential categories, storage otherwise. */
  capacity: number;
  /** Prestige value (vanity stat surfaced in the inspector). */
  prestige: number;
  visual: WorkshopVisual;
}

export interface WorkshopPack {
  /** Stable id used in the custom BuildingKind `wsp:<packId>:<buildingId>`. */
  id: string;
  name: string;
  author?: string;
  version: string;
  description?: string;
  buildings: WorkshopBuilding[];
}

/** Encoded kind string used in BUILDINGS / Building.kind. */
export function workshopKindOf(packId: string, buildingId: string): BuildingKind {
  return `wsp:${packId}:${buildingId}` as BuildingKind;
}

export function parseWorkshopKind(kind: string): { packId: string; buildingId: string } | null {
  if (!kind.startsWith("wsp:")) return null;
  const rest = kind.slice(4);
  const i = rest.indexOf(":");
  if (i < 0) return null;
  return { packId: rest.slice(0, i), buildingId: rest.slice(i + 1) };
}

export const WORKSHOP_PACK_VERSION = 1;
