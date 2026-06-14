// Grand Politics — Phase 1
// PURE / DERIVED. Reads the existing world state and computes Political Power,
// House Wealth, Council seats, Reputation tags and Settlement Stability.
// Nothing here mutates the store. Existing systems (families, ministers,
// authority, marriage) keep their behavior unchanged.

import type {
  Animal,
  Building,
  Family,
  ID,
  Minister,
  ResourceKind,
  Survivor,
} from "../types";
import { computeFamilyStanding, headOfFamily } from "./families";
import { computeAuthority } from "./authority";

export type MinisterRoleLike = string;

export interface HousePolitics {
  familyId: ID;
  name: string;
  headId: ID | null;
  headName: string | null;
  living: number;
  prestige: number;        // 0..100  (stored, drifted by families tick)
  influence: number;       // 0..100  (derived: avg loyalty + offices + head skill)
  wealth: number;          // arbitrary points (animals + farms + stored + family.wealth)
  population: number;
  officesHeld: { role: string; survivorId: ID }[];
  marriageAllianceCount: number; // unique other families linked by marriage
  achievements: number;
  politicalPower: number;  // 0..100 composite
  reputationTags: string[];
  agenda: string;
  councilSeat: boolean;
}

export interface PoliticsSnapshot {
  houses: HousePolitics[];          // sorted desc by politicalPower
  council: HousePolitics[];         // top seats
  totalCouncilSeats: number;
  stability: {
    score: number;                  // 0..100
    label: string;
    factors: { label: string; weight: number }[];
  };
}

interface ComputeInput {
  survivors: Survivor[];
  families: Family[];
  buildings: Building[];
  animals?: Animal[];
  ministers?: Minister[];
  resources: Record<ResourceKind, number>;
  currentLeaderId: ID;
  founderId: ID;
  currentYear: number;
}

const COUNCIL_SEATS = 5;

export function computeHouseWealth(
  family: Family,
  ctx: { animals?: Animal[]; buildings: Building[]; survivors: Survivor[] }
): number {
  const animals = (ctx.animals ?? []).filter(
    (a) => !a.dead && a.ownerFamilyId === family.id
  ).length;
  // Farm plots (Building has familyId on plots per types.ts L315). Best-effort.
  const farms = ctx.buildings.filter((b: any) => b?.familyId === family.id).length;
  // Family wealth field already stored.
  const base = family.wealth ?? 0;
  return Math.round(base * 2 + animals * 3 + farms * 4);
}

function uniqueAllianceCount(family: Family, survivors: Survivor[]): number {
  const set = new Set<ID>();
  for (const id of family.memberIds) {
    const s = survivors.find((x) => x.id === id);
    if (!s || s.health <= 0 || !s.spouseId) continue;
    const sp = survivors.find((x) => x.id === s.spouseId);
    if (!sp || !sp.familyId || sp.familyId === family.id) continue;
    set.add(sp.familyId);
  }
  return set.size;
}

function deriveReputationTags(
  family: Family,
  living: Survivor[],
  power: number,
  wealth: number,
  alliances: number,
  offices: number,
  isFounderFamily: boolean
): string[] {
  const tags: string[] = [];
  const avgLoyalty =
    living.length > 0
      ? living.reduce((a, b) => a + b.loyaltyToFounder, 0) / living.length
      : 0;
  if (isFounderFamily) tags.push("Founder Line");
  if (avgLoyalty >= 40) tags.push("Loyal");
  if (avgLoyalty <= -25) tags.push("Discontent");
  if (wealth >= 30) tags.push("Wealthy");
  if (alliances >= 2) tags.push("Well-Connected");
  if (offices >= 2) tags.push("Influential");
  if (power >= 70) tags.push("Dominant");
  if (family.memberIds.length >= 6) tags.push("Numerous");
  if (tags.length === 0) tags.push("Quiet");
  return tags;
}

function deriveAgenda(
  standing: ReturnType<typeof computeFamilyStanding>,
  offices: number,
  alliances: number,
  living: Survivor[]
): string {
  if (standing.homelessCount > 0) return "Secure housing";
  if (standing.expectationGap > 30) return "Improve living conditions";
  const youths = living.filter((s) => s.stage === "youth").length;
  if (youths >= 2 && alliances < 2) return "Secure marriages";
  if (offices === 0 && standing.living >= 3) return "Gain an office";
  if (standing.prestige < 35) return "Raise the family's prestige";
  return "Expand wealth and influence";
}

export function computePolitics(input: ComputeInput): PoliticsSnapshot {
  const {
    survivors,
    families,
    buildings,
    animals,
    ministers,
    resources,
    currentLeaderId,
    founderId,
    currentYear,
  } = input;

  const livingSurvivors = survivors.filter((s) => s.health > 0);

  const ministerByFamily = new Map<ID, { role: string; survivorId: ID }[]>();
  for (const m of ministers ?? []) {
    const sur = survivors.find((s) => s.id === m.survivorId);
    if (!sur) continue;
    const arr = ministerByFamily.get(sur.familyId) ?? [];
    arr.push({ role: m.role, survivorId: sur.id });
    ministerByFamily.set(sur.familyId, arr);
  }

  const houses: HousePolitics[] = [];

  for (const fam of families) {
    if (fam.extinctYear) continue;
    const standing = computeFamilyStanding(fam, {
      survivors,
      buildings,
      currentLeaderId,
      founderId,
      currentYear,
    });
    const head = headOfFamily(fam, survivors);
    const members = fam.memberIds
      .map((id) => survivors.find((s) => s.id === id))
      .filter((s): s is Survivor => !!s && s.health > 0);
    if (members.length === 0) continue;

    const offices = ministerByFamily.get(fam.id) ?? [];
    const wealth = computeHouseWealth(fam, { animals, buildings, survivors });
    const alliances = uniqueAllianceCount(fam, survivors);
    const achievements = members.reduce(
      (a, s) => a + (s.achievements?.length ?? 0),
      0
    );
    const isFounderFamily = members.some((m) => m.id === founderId);

    // Influence: head skill + avg loyalty + offices contribution.
    const avgLoyalty =
      members.length > 0
        ? members.reduce((a, b) => a + b.loyaltyToFounder, 0) / members.length
        : 0;
    const headSkill = head ? (head.skills.lead ?? 0) : 0;
    let influence =
      30 +
      Math.round(headSkill * 4) +
      Math.round(avgLoyalty * 0.15) +
      offices.length * 8 +
      alliances * 4;
    influence = Math.max(0, Math.min(100, influence));

    // Population contribution (capped).
    const popPts = Math.min(20, members.length * 2.5);

    // Composite Political Power 0..100.
    let power =
      standing.prestige * 0.35 +
      influence * 0.20 +
      Math.min(100, wealth * 1.2) * 0.18 +
      popPts +
      offices.length * 4 +
      alliances * 3 +
      Math.min(8, achievements);
    if (isFounderFamily) power += 6;
    if (standing.hasLeader) power += 8;
    power = Math.max(0, Math.min(100, Math.round(power)));

    const reputationTags = deriveReputationTags(
      fam,
      members,
      power,
      wealth,
      alliances,
      offices.length,
      isFounderFamily
    );
    const agenda = deriveAgenda(standing, offices.length, alliances, members);

    houses.push({
      familyId: fam.id,
      name: fam.name,
      headId: head?.id ?? null,
      headName: head?.name ?? null,
      living: members.length,
      prestige: Math.round(standing.prestige),
      influence,
      wealth,
      population: members.length,
      officesHeld: offices,
      marriageAllianceCount: alliances,
      achievements,
      politicalPower: power,
      reputationTags,
      agenda,
      councilSeat: false,
    });
  }

  houses.sort((a, b) => b.politicalPower - a.politicalPower);
  const council = houses.slice(0, COUNCIL_SEATS);
  for (const h of council) h.councilSeat = true;

  // Stability — combines authority, food, housing, satisfaction, inequality.
  const auth = computeAuthority({ survivors, families, buildings, resources });
  const pop = livingSurvivors.length;
  const homeless = livingSurvivors.filter((s) => !s.homeId).length;
  const sats = livingSurvivors.map((s) => s.housingSatisfaction ?? 50);
  const avgSat = sats.length ? sats.reduce((a, b) => a + b, 0) / sats.length : 50;
  const foodPerHead = pop > 0 ? resources.food / pop : 0;

  // Wealth inequality among houses (gini-ish): top vs median.
  const powers = houses.map((h) => h.politicalPower).sort((a, b) => b - a);
  const top = powers[0] ?? 0;
  const median = powers[Math.floor(powers.length / 2)] ?? 0;
  const inequality = Math.max(0, top - median); // 0..100

  const factors: { label: string; weight: number }[] = [];
  let score = 50;
  score += (auth.score - 50) * 0.5; factors.push({ label: "Authority", weight: Math.round((auth.score - 50) * 0.5) });
  if (foodPerHead >= 4) { score += 8; factors.push({ label: "Food secure", weight: 8 }); }
  else if (foodPerHead < 1.5) { score -= 10; factors.push({ label: "Food insecure", weight: -10 }); }
  if (homeless > 0) { const w = -Math.min(15, homeless * 3); score += w; factors.push({ label: `${homeless} homeless`, weight: w }); }
  if (avgSat >= 70) { score += 6; factors.push({ label: "Comfortable homes", weight: 6 }); }
  else if (avgSat < 35) { score -= 8; factors.push({ label: "Poor homes", weight: -8 }); }
  if (inequality >= 40) { score -= 6; factors.push({ label: "Power concentrated in one house", weight: -6 }); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label =
    score >= 80 ? "Stable" :
    score >= 60 ? "Mostly Stable" :
    score >= 40 ? "Tense" :
    score >= 20 ? "Restive" : "Unstable";

  return {
    houses,
    council,
    totalCouncilSeats: COUNCIL_SEATS,
    stability: { score, label, factors },
  };
}
