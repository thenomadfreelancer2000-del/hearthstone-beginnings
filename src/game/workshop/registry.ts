import type { BuildingDef } from "../types";
import { BUILDINGS } from "../data/content";
import {
  parseWorkshopKind,
  PROCEDURAL_STYLES,
  workshopKindOf,
  type WorkshopBuilding,
  type WorkshopPack,
  type WorkshopVisual,
} from "./types";

/**
 * Workshop registry — bridges community packs to the rest of the sim.
 *
 *   - syncBuildings() rebuilds BUILDINGS entries for every ENABLED pack.
 *   - getWorkshopVisual(kind) returns render hints for IsoBuilding.
 *
 * Custom kinds use the `wsp:<packId>:<buildingId>` format so they stay
 * stringly compatible with the BuildingKind union without forcing every
 * consumer through a generated type.
 */

const visualByKind = new Map<string, WorkshopVisual>();
const buildingByKind = new Map<string, WorkshopBuilding>();
const packByBuildingKind = new Map<string, WorkshopPack>();
const registeredKinds = new Set<string>();

function defFor(pack: WorkshopPack, b: WorkshopBuilding): BuildingDef {
  const isHousing = b.category === "housing" || b.category === "homestead";
  return {
    kind: workshopKindOf(pack.id, b.id),
    name: b.name,
    blurb: b.description || `From ${pack.name}.`,
    size: { w: Math.max(1, b.size.w | 0), h: Math.max(1, b.size.h | 0) },
    cost: b.cost ?? {},
    buildEffort: Math.max(0, b.buildEffort | 0),
    housingCapacity: isHousing ? Math.max(0, b.capacity | 0) : 0,
    housingQuality: b.category === "homestead" ? 4 : isHousing ? 2 : 0,
    storageCapacity: isHousing ? 0 : Math.max(0, b.capacity | 0),
    social: b.category === "homestead" || b.category === "school" || b.category === "medical",
    produces: null,
  };
}

/** Apply enabled packs to the live BUILDINGS map + visual cache. */
export function syncWorkshopRegistry(packs: WorkshopPack[], enabled: Record<string, boolean>) {
  // Drop any previously-registered workshop kinds.
  for (const k of registeredKinds) {
    delete (BUILDINGS as unknown as Record<string, BuildingDef>)[k];
  }
  registeredKinds.clear();
  visualByKind.clear();
  buildingByKind.clear();
  packByBuildingKind.clear();

  for (const pack of packs) {
    if (!enabled[pack.id]) continue;
    for (const b of pack.buildings) {
      const kind = workshopKindOf(pack.id, b.id);
      (BUILDINGS as unknown as Record<string, BuildingDef>)[kind] = defFor(pack, b);
      registeredKinds.add(kind);
      visualByKind.set(kind, b.visual);
      buildingByKind.set(kind, b);
      packByBuildingKind.set(kind, pack);
    }
  }
}

export function getWorkshopVisual(kind: string): WorkshopVisual | null {
  return visualByKind.get(kind) ?? null;
}

export function getWorkshopBuilding(kind: string): { pack: WorkshopPack; building: WorkshopBuilding } | null {
  const b = buildingByKind.get(kind);
  const p = packByBuildingKind.get(kind);
  if (!b || !p) return null;
  return { pack: p, building: b };
}

export function isWorkshopKind(kind: string): boolean {
  return kind.startsWith("wsp:");
}

export function workshopBaseKind(kind: string): string | null {
  const v = visualByKind.get(kind);
  if (!v) {
    // Unknown wsp:* kind — fall back to a plain cabin so it still renders.
    if (parseWorkshopKind(kind)) return "cabin";
    return null;
  }
  if (v.type === "procedural") {
    return PROCEDURAL_STYLES.find((s) => s.id === v.style)?.baseKind ?? "cabin";
  }
  return null; // sprite — handled by IsoSprite
}
