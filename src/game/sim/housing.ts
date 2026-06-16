// THE RANCH — Housing satisfaction, overcrowding, expectations.
//
// Pure functions + a daily tick. Designed to be called from the engine's
// dailyTick. Mutates survivor.mood, survivor.needs.shelter,
// survivor.loyaltyToFounder (via gratitude) and several optional fields.

import type { Building, BuildingKind, Survivor } from "../types";
import { BUILDINGS } from "../data/content";

export const HOME_KINDS: BuildingKind[] = [
  "homestead", "tent", "family-tent", "cabin", "family-cabin",
  "house", "family-house", "large-house",
  "manor", "founder-manor",
  "bunkhouse", "guest-house", "orphan-house", "elder-house",
];

export function isResidential(kind: BuildingKind): boolean {
  return HOME_KINDS.includes(kind);
}

export function homeQuality(b: Building): number {
  return BUILDINGS[b.kind].housingQuality ?? 0;
}

export function homeCapacity(b: Building): number {
  return BUILDINGS[b.kind].housingCapacity ?? 0;
}

export interface HousingReport {
  satisfaction: number;
  label: string;
  reasons: string[];
}

/**
 * Compute housing satisfaction for a survivor in the given home (or homeless).
 * Considers quality, crowding, family size, privacy, expectations.
 */
export function computeHousingSatisfaction(
  s: Survivor,
  home: Building | null,
  occupants: Survivor[],
): HousingReport {
  const reasons: string[] = [];
  if (!home) {
    return { satisfaction: 10, label: "Homeless", reasons: ["No assigned home"] };
  }
  const q = homeQuality(home);
  const cap = homeCapacity(home);
  const n = occupants.length;
  const crowding = cap > 0 ? n / cap : 99;

  // Base from quality (1→40, 2→55, 3→70, 4→85, 5→95)
  let v = 25 + q * 15;
  reasons.push(`Quality ${q}/5`);

  // Crowding
  if (crowding > 1) {
    const over = n - cap;
    v -= over * 18;
    reasons.push(`Overcrowded by ${over}`);
  } else if (crowding > 0.85) {
    v -= 5;
    reasons.push("Cramped");
  } else if (crowding < 0.5 && n > 0) {
    v += 5;
    reasons.push("Roomy");
  }

  // Privacy: married couple alone (or with own kids only) = bonus
  if (s.spouseId && occupants.some(o => o.id === s.spouseId)) {
    const outsiders = occupants.filter(o =>
      o.id !== s.id && o.id !== s.spouseId &&
      !s.childrenIds.includes(o.id),
    );
    if (outsiders.length === 0) {
      v += 8;
      reasons.push("Private family home");
    } else {
      v -= 4;
      reasons.push("Sharing with outsiders");
    }
  }

  // Family weighting: parents with children care more about poor housing.
  const kidsHere = occupants.filter(o => s.childrenIds.includes(o.id)).length;
  if (kidsHere > 0 && q <= 1) {
    v -= 10 + kidsHere * 3;
    reasons.push(`${kidsHere} child${kidsHere > 1 ? "ren" : ""} in poor housing`);
  }

  // Expectations: long-tenured survivors expect more.
  const baseline = s.expectationBaseline ?? 0;
  v -= baseline;
  if (baseline > 5) reasons.push(`Expects more (${Math.round(baseline)})`);

  v = Math.max(0, Math.min(100, v));
  const label =
    v >= 80 ? "Comfortable" :
    v >= 60 ? "Adequate" :
    v >= 40 ? "Acceptable" :
    v >= 20 ? "Crowded" : "Overcrowded";
  return { satisfaction: v, label, reasons };
}

export interface HousingTickDeps {
  buildings: Building[];
  survivors: Survivor[];
  tick: number;
}

/**
 * Daily housing tick — recomputes satisfaction, applies mood/shelter effects,
 * decays gratitude, drifts expectation baseline upward with tenure.
 */
export function dailyHousingTick(deps: HousingTickDeps) {
  const homeById = new Map(deps.buildings.filter(b => isResidential(b.kind)).map(b => [b.id, b] as const));

  // Build occupant lookups from survivor.homeId (canonical) and seed building.occupantIds.
  const occByHome = new Map<string, Survivor[]>();
  for (const s of deps.survivors) {
    if (s.health <= 0) continue;
    if (!s.homeId) continue;
    if (!homeById.has(s.homeId)) { s.homeId = null; continue; }
    const arr = occByHome.get(s.homeId) ?? [];
    arr.push(s);
    occByHome.set(s.homeId, arr);
  }
  for (const b of homeById.values()) {
    b.occupantIds = (occByHome.get(b.id) ?? []).map(o => o.id);
  }

  for (const s of deps.survivors) {
    if (s.health <= 0) continue;
    const home = s.homeId ? homeById.get(s.homeId) ?? null : null;
    const occ = home ? occByHome.get(home.id) ?? [] : [];
    const rep = computeHousingSatisfaction(s, home, occ);
    s.housingSatisfaction = rep.satisfaction;

    // Shelter need follows satisfaction (slow nudge toward it)
    s.needs.shelter = s.needs.shelter * 0.85 + rep.satisfaction * 0.15;

    // Mood drift from housing
    const moodTarget = (rep.satisfaction - 50) * 0.4; // -20..+20
    s.mood = Math.max(-100, Math.min(100, s.mood + (moodTarget - s.mood) * 0.05));

    // Overcrowding bites loyalty over time
    if (home) {
      const over = occ.length - homeCapacity(home);
      if (over > 0) {
        s.loyaltyToFounder = Math.max(-100, s.loyaltyToFounder - over * 0.15);
      }
    } else {
      s.loyaltyToFounder = Math.max(-100, s.loyaltyToFounder - 0.2);
    }

    // Gratitude decay (linear, ~one year = 48 days to zero)
    const g = s.housingGratitude ?? 0;
    if (g > 0) {
      s.housingGratitude = Math.max(0, g - 10 / 48);
      s.loyaltyToFounder = Math.min(100, s.loyaltyToFounder + g * 0.01);
    }

    // Expectation drift: +0.05 per day; capped at 20.
    s.expectationBaseline = Math.min(20, (s.expectationBaseline ?? 0) + 0.05);
  }
}

/** Find the best home for a survivor (preferring spouse's home, then highest quality with space). */
export function findBestHome(
  s: Survivor,
  buildings: Building[],
  survivors: Survivor[],
  prefer?: { spouseHome?: boolean },
): Building | null {
  const homes = buildings.filter(b => isResidential(b.kind) && b.builtProgress >= 1 && !b.reserved);
  // Spouse's home first if has space
  if (prefer?.spouseHome !== false && s.spouseId) {
    const spouse = survivors.find(x => x.id === s.spouseId);
    if (spouse?.homeId) {
      const h = homes.find(b => b.id === spouse.homeId);
      if (h && (h.occupantIds?.length ?? 0) < homeCapacity(h)) return h;
    }
  }
  // Parent's home for children
  if (s.stage === "child" || s.stage === "teen") {
    for (const pid of s.parentIds) {
      const p = survivors.find(x => x.id === pid);
      if (p?.homeId) {
        const h = homes.find(b => b.id === p.homeId);
        if (h && (h.occupantIds?.length ?? 0) < homeCapacity(h)) return h;
      }
    }
  }
  // Highest quality with space, ties by least crowded
  const ranked = homes
    .filter(h => (h.occupantIds?.length ?? 0) < homeCapacity(h))
    .sort((a, b) => {
      const qa = homeQuality(a), qb = homeQuality(b);
      if (qa !== qb) return qb - qa;
      const ca = (a.occupantIds?.length ?? 0) / Math.max(1, homeCapacity(a));
      const cb = (b.occupantIds?.length ?? 0) / Math.max(1, homeCapacity(b));
      return ca - cb;
    });
  return ranked[0] ?? null;
}
