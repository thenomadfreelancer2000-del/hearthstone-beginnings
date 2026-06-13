// Authority — how much the settlement respects and trusts the Founder.
// Pure, derived from current world state. Avg loyalty changes slowly,
// so authority naturally feels "earned over years".

import type { Family, Survivor, ResourceKind } from "../types";

export type AuthorityStatus =
  | "Legendary Founder"
  | "Highly Respected"
  | "Trusted Leader"
  | "Accepted Leader"
  | "Weak Leader"
  | "Discredited Leader";

export interface AuthorityFactor {
  label: string;
  weight: number; // signed, rough magnitude
}

export interface FamilySupport {
  familyId: string;
  name: string;
  avg: number; // -100..100
}

export interface AuthoritySnapshot {
  score: number;            // 0..100
  status: AuthorityStatus;
  supporters: number;       // opinion >= +25
  neutral: number;          // -25..25
  opponents: number;        // <= -25
  mostLoyal: FamilySupport[];
  mostDissatisfied: FamilySupport[];
  positive: AuthorityFactor[];
  negative: AuthorityFactor[];
}

export function authorityStatus(score: number): AuthorityStatus {
  if (score >= 90) return "Legendary Founder";
  if (score >= 75) return "Highly Respected";
  if (score >= 60) return "Trusted Leader";
  if (score >= 40) return "Accepted Leader";
  if (score >= 20) return "Weak Leader";
  return "Discredited Leader";
}

interface ComputeInput {
  survivors: Survivor[];
  families: Family[];
  buildings: { kind: string; occupantIds: string[] }[];
  resources: Record<ResourceKind, number>;
}

export function computeAuthority({
  survivors,
  families,
  buildings,
  resources,
}: ComputeInput): AuthoritySnapshot {
  const living = survivors.filter((s) => s.health > 0 && !s.isFounder);
  const opinions = living.map((s) => s.loyaltyToFounder);
  const avg =
    opinions.length > 0
      ? opinions.reduce((a, b) => a + b, 0) / opinions.length
      : 50;

  // Base 0..100 from average opinion (-100..100 → 0..100), then nudge.
  let score = 50 + avg / 2;

  const positive: AuthorityFactor[] = [];
  const negative: AuthorityFactor[] = [];

  // ── Food / water ────────────────────────────────────────────────
  const pop = living.length;
  const foodPerHead = pop > 0 ? resources.food / pop : 0;
  const waterPerHead = pop > 0 ? resources.water / pop : 0;
  if (foodPerHead >= 5) { score += 4; positive.push({ label: "Granaries full", weight: 4 }); }
  else if (foodPerHead < 1.5) { score -= 6; negative.push({ label: "Food shortage", weight: -6 }); }
  if (waterPerHead >= 5) { score += 3; positive.push({ label: "Wells overflow", weight: 3 }); }
  else if (waterPerHead < 1.5) { score -= 6; negative.push({ label: "Water shortage", weight: -6 }); }

  // ── Housing ────────────────────────────────────────────────────
  const homeless = living.filter((s) => !s.homeId).length;
  if (homeless === 0 && pop > 0) {
    score += 3; positive.push({ label: "Everyone housed", weight: 3 });
  } else if (homeless > 0) {
    const w = -Math.min(10, homeless * 2);
    score += w; negative.push({ label: `${homeless} without a home`, weight: w });
  }

  // Overcrowding
  const overcrowded = buildings.filter((b) => {
    const capByKind: Record<string, number> = {
      tent: 2, cabin: 4, house: 5, "large-house": 8, homestead: 4,
    };
    const cap = capByKind[b.kind] ?? 0;
    return cap > 0 && b.occupantIds.length > cap;
  }).length;
  if (overcrowded > 0) {
    const w = -Math.min(8, overcrowded * 2);
    score += w; negative.push({ label: "Overcrowded shelters", weight: w });
  }

  // ── Population growth ──────────────────────────────────────────
  if (pop >= 20) { score += 5; positive.push({ label: "Thriving population", weight: 5 }); }
  else if (pop >= 10) { score += 2; positive.push({ label: "Growing settlement", weight: 2 }); }

  // Avg housing satisfaction
  const sats = living.map((s) => s.housingSatisfaction ?? 50);
  const avgSat = sats.length > 0 ? sats.reduce((a, b) => a + b, 0) / sats.length : 50;
  if (avgSat >= 75) { score += 3; positive.push({ label: "Comfortable homes", weight: 3 }); }
  else if (avgSat < 35) { score -= 4; negative.push({ label: "Poor living conditions", weight: -4 }); }

  // ── Supporters / opponents ────────────────────────────────────
  let supporters = 0, neutral = 0, opponents = 0;
  for (const s of living) {
    if (s.loyaltyToFounder >= 25) supporters++;
    else if (s.loyaltyToFounder <= -25) opponents++;
    else neutral++;
  }

  // ── Family rollups ─────────────────────────────────────────────
  const famAgg = new Map<string, { name: string; sum: number; n: number }>();
  for (const s of living) {
    const fam = families.find((f) => f.id === s.familyId);
    if (!fam) continue;
    const cur = famAgg.get(fam.id) ?? { name: fam.name, sum: 0, n: 0 };
    cur.sum += s.loyaltyToFounder;
    cur.n += 1;
    famAgg.set(fam.id, cur);
  }
  const famArr: FamilySupport[] = [...famAgg.entries()].map(([id, v]) => ({
    familyId: id,
    name: v.name,
    avg: v.sum / Math.max(1, v.n),
  }));
  const mostLoyal = [...famArr].sort((a, b) => b.avg - a.avg).slice(0, 3);
  const mostDissatisfied = [...famArr].sort((a, b) => a.avg - b.avg).slice(0, 2);

  // Clamp
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    status: authorityStatus(score),
    supporters,
    neutral,
    opponents,
    mostLoyal,
    mostDissatisfied,
    positive,
    negative,
  };
}
