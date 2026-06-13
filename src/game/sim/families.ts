// Family system — turn families into meaningful social groups.
// Pure helpers + a daily tick that drifts family.prestige toward a derived
// "standing", spreads mood/loyalty within kin, and applies expectation
// pressure when large families live in poor conditions.

import type { Building, Family, ID, Survivor } from "../types";
import { BUILDINGS } from "../data/content";
import { isResidential } from "./housing";

export type FamilyRole = "head" | "elder" | "spouse" | "adult" | "child";

export interface FamilyStanding {
  familyId: ID;
  name: string;
  living: number;
  totalMembers: number;
  prestige: number;          // derived 0..100
  avgLoyalty: number;        // -100..100
  avgMood: number;           // -100..100
  avgHousingQuality: number; // 0..5
  homelessCount: number;
  hasLeader: boolean;
  isFounderFamily: boolean;
  yearsOnRanch: number;
  expectationGap: number;    // 0..100, higher = more dissatisfied
  headId: ID | null;
  reasons: { label: string; weight: number }[];
}

interface Ctx {
  survivors: Survivor[];
  buildings: Building[];
  currentLeaderId: ID;
  founderId: ID;
  currentYear: number;
}

/** The unofficial head of the family — oldest adult, tiebreak by lead skill. */
export function headOfFamily(family: Family, survivors: Survivor[]): Survivor | null {
  const alive = family.memberIds
    .map((id) => survivors.find((s) => s.id === id))
    .filter((s): s is Survivor =>
      !!s && s.health > 0 && (s.stage === "adult" || s.stage === "elder" || s.stage === "youth"),
    );
  if (alive.length === 0) {
    // fall back to any alive member
    return (
      family.memberIds
        .map((id) => survivors.find((s) => s.id === id))
        .find((s): s is Survivor => !!s && s.health > 0) ?? null
    );
  }
  alive.sort((a, b) => {
    if (b.age !== a.age) return b.age - a.age;
    return (b.skills.lead ?? 0) - (a.skills.lead ?? 0);
  });
  return alive[0];
}

export function computeFamilyStanding(family: Family, ctx: Ctx): FamilyStanding {
  const members = family.memberIds
    .map((id) => ctx.survivors.find((s) => s.id === id))
    .filter((s): s is Survivor => !!s);
  const living = members.filter((m) => m.health > 0);
  const homeQ = (homeId?: ID | null) => {
    if (!homeId) return 0;
    const b = ctx.buildings.find((x) => x.id === homeId);
    if (!b || !isResidential(b.kind)) return 0;
    return BUILDINGS[b.kind].housingQuality ?? 0;
  };

  const avgLoyalty =
    living.length > 0
      ? living.reduce((a, b) => a + b.loyaltyToFounder, 0) / living.length
      : 0;
  const avgMood =
    living.length > 0 ? living.reduce((a, b) => a + b.mood, 0) / living.length : 0;
  const housings = living.map((s) => homeQ(s.homeId));
  const avgHousing =
    housings.length > 0 ? housings.reduce((a, b) => a + b, 0) / housings.length : 0;
  const homelessCount = living.filter((s) => !s.homeId).length;
  const hasLeader = living.some((s) => s.id === ctx.currentLeaderId);
  const isFounderFamily = members.some((m) => m.id === ctx.founderId);
  const yearsOnRanch = Math.max(0, ctx.currentYear - family.foundedYear);

  // ── Prestige formula (0..100) ──
  const reasons: { label: string; weight: number }[] = [];
  let prestige = 20;
  reasons.push({ label: "Base", weight: 20 });

  const memberBonus = Math.min(20, living.length * 3);
  if (memberBonus > 0) { prestige += memberBonus; reasons.push({ label: `${living.length} living members`, weight: memberBonus }); }

  const housingBonus = Math.round(avgHousing * 4);
  if (housingBonus !== 0) { prestige += housingBonus; reasons.push({ label: `Avg housing ${avgHousing.toFixed(1)}/5`, weight: housingBonus }); }

  const historyBonus = Math.min(15, Math.round(yearsOnRanch * 1.2));
  if (historyBonus > 0) { prestige += historyBonus; reasons.push({ label: `${yearsOnRanch}y on the ranch`, weight: historyBonus }); }

  if (hasLeader) { prestige += 20; reasons.push({ label: "Holds leadership", weight: 20 }); }
  if (isFounderFamily) { prestige += 10; reasons.push({ label: "Founder line", weight: 10 }); }

  const wealthBonus = Math.min(15, Math.round((family.wealth ?? 0) * 0.4));
  if (wealthBonus > 0) { prestige += wealthBonus; reasons.push({ label: "Family wealth", weight: wealthBonus }); }

  if (homelessCount > 0) {
    const w = -Math.min(20, homelessCount * 6);
    prestige += w; reasons.push({ label: `${homelessCount} without a home`, weight: w });
  }
  if (avgMood < -20) { prestige -= 6; reasons.push({ label: "Family unhappy", weight: -6 }); }
  if (family.extinctYear) { prestige = 0; }

  prestige = Math.max(0, Math.min(100, Math.round(prestige)));

  // Expectation gap: large families in tents (Q<=1) generate pressure.
  let expectationGap = 0;
  if (living.length >= 3 && avgHousing < 2.5) {
    expectationGap = Math.min(100, Math.round((living.length - 2) * 10 + (2.5 - avgHousing) * 15));
  }
  if (homelessCount > 0) expectationGap = Math.min(100, expectationGap + homelessCount * 12);

  return {
    familyId: family.id,
    name: family.name,
    living: living.length,
    totalMembers: members.length,
    prestige,
    avgLoyalty,
    avgMood,
    avgHousingQuality: avgHousing,
    homelessCount,
    hasLeader,
    isFounderFamily,
    yearsOnRanch,
    expectationGap,
    headId: headOfFamily(family, ctx.survivors)?.id ?? null,
    reasons,
  };
}

/**
 * Daily family tick — runs after housing tick.
 * - Drifts family.prestige toward derived standing.
 * - Mood/loyalty contagion among kin (a sad spouse drags the family).
 * - Expectation pressure: large families in poor housing lose loyalty.
 */
export function dailyFamilyTick(eng: {
  families: Family[];
  survivors: Survivor[];
  buildings: Building[];
  currentLeaderId: ID;
  founderId: ID;
  time: { year: number };
}) {
  const ctx: Ctx = {
    survivors: eng.survivors,
    buildings: eng.buildings,
    currentLeaderId: eng.currentLeaderId,
    founderId: eng.founderId,
    currentYear: eng.time.year,
  };

  for (const fam of eng.families) {
    const standing = computeFamilyStanding(fam, ctx);
    // Drift stored prestige toward derived value (keeps event bumps relevant but stable).
    const target = standing.prestige;
    fam.prestige = fam.prestige + (target - fam.prestige) * 0.08;

    const members = fam.memberIds
      .map((id) => eng.survivors.find((s) => s.id === id))
      .filter((s): s is Survivor => !!s && s.health > 0);
    if (members.length < 2) continue;

    // Contagion — gently pull each member toward family avg mood & loyalty.
    const avgMood = standing.avgMood;
    const avgLoy = standing.avgLoyalty;
    for (const m of members) {
      // Stronger pull if spouse is the unhappy one.
      const spouseUnhappy =
        m.spouseId &&
        members.find((x) => x.id === m.spouseId && x.mood < -20);
      const moodPull = spouseUnhappy ? 0.08 : 0.04;
      m.mood = Math.max(-100, Math.min(100, m.mood + (avgMood - m.mood) * moodPull));
      m.loyaltyToFounder = Math.max(
        -100,
        Math.min(100, m.loyaltyToFounder + (avgLoy - m.loyaltyToFounder) * 0.03),
      );
    }

    // Expectation pressure — large families in poor housing slowly sour on the Founder.
    if (standing.expectationGap > 20) {
      const drag = standing.expectationGap / 600; // ~0.16/day at max
      for (const m of members) {
        m.loyaltyToFounder = Math.max(-100, m.loyaltyToFounder - drag);
      }
    }
  }
}
