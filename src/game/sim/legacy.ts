// Aging, legacy epithets, and leadership transition effects.
// Powers the "Founder Death & Leadership Transition" update.

import type { ChronicleEntry, Family, ID, Relationship, SettlementStats, Survivor } from "../types";
import { findRelationship, opinionScore } from "./ai";
import { dominantTitle, type ReputationProfile } from "./reputation";

// ── Life stage sub-tier labels ────────────────────────────────────
export function lifeStageLabel(s: Pick<Survivor, "age" | "stage">): string {
  switch (s.stage) {
    case "child": return "Child";
    case "teen": return "Teen";
    case "youth": return "Young Adult";
    case "adult":
      return s.age >= 45 ? "Mature Adult" : "Adult";
    case "elder":
      return s.age >= 75 ? "Very Elderly" : "Elder";
  }
}

// ── Seasonal aging side effects ───────────────────────────────────
// Called once per season after age increments. Older bodies slow down;
// leadership instinct sharpens with years.
const PHYSICAL_SKILLS: (keyof Survivor["skills"])[] = ["forage", "cut", "mine", "build", "farm"];

export function applyAgingEffects(s: Survivor) {
  if (s.health <= 0) return;
  // Leadership experience grows quietly with adulthood.
  if (s.stage === "adult" || s.stage === "elder") {
    const gain = s.occupation === "leader" ? 0.18 : 0.05;
    s.skills.lead = Math.min(30, (s.skills.lead ?? 1) + gain);
  }
  // Physical decline kicks in for elders, harder for the very elderly.
  if (s.stage === "elder") {
    const decay = s.age >= 75 ? 0.18 : 0.07;
    for (const k of PHYSICAL_SKILLS) {
      s.skills[k] = Math.max(1, (s.skills[k] ?? 1) - decay);
    }
  }
}

// ── Founder legacy / epithet ──────────────────────────────────────
// Computed when the founder dies. Prefers their reputation profile,
// falls back to play-shaped heuristics, and finally to "The Founder".
export function computeFounderEpithet(
  founder: Survivor,
  rep: ReputationProfile | null | undefined,
  stats: SettlementStats,
  families: Family[],
): string {
  const titled = dominantTitle(rep ?? null);
  if (titled) return titled;
  // Fallback heuristics.
  if (stats.generations >= 3) return "The Patriarch";
  if (stats.totalBorn >= 6) return "The Patriarch";
  if ((founder.achievements?.length ?? 0) >= 4) return "The Visionary";
  if ((founder.skills.build ?? 0) >= 12) return "The Builder";
  if ((founder.skills.farm ?? 0) >= 12) return "The Provider";
  if ((founder.skills.lead ?? 0) >= 14) return "The Visionary";
  // House prestige
  const fam = families.find((f) => f.id === founder.familyId);
  if (fam && fam.prestige >= 80) return "The Honoured";
  return "The Founder";
}

// ── Leadership transition ─────────────────────────────────────────
// Each surviving soul evaluates the new leader. Their loyalty shifts by
// a small amount in the direction of acceptance — nothing dramatic, but
// it lays the political groundwork for what follows.
export interface TransitionResult {
  applied: number;
  rejections: number;
  swearings: number;
}

export interface TransitionDeps {
  survivors: Survivor[];
  relationships: Relationship[];
  families: Family[];
  newLeader: Survivor;
  oldLeader: Survivor | null;
  wasPreferred: boolean;
  emitMemory: (s: Survivor, text: string, emotion: import("../types").Memory["emotion"],
               weight: number, aboutId?: ID, opts?: { kind?: string; floor?: number; decayRate?: number }) => void;
}

export function applyLeadershipTransition(deps: TransitionDeps): TransitionResult {
  const { survivors, relationships, families, newLeader, oldLeader, wasPreferred } = deps;
  const heirCap = Math.round(
    ((newLeader.skills.lead ?? 1) * 2
      + (newLeader.skills.build ?? 1)
      + (newLeader.skills.farm ?? 1)
      + (newLeader.skills.social ?? 1)
      + (newLeader.skills.medic ?? 1)) / 6,
  );
  let applied = 0, rejections = 0, swearings = 0;

  for (const s of survivors) {
    if (s.health <= 0 || s.id === newLeader.id) continue;

    // Personal bond with the heir
    const rel = findRelationship(relationships, s.id, newLeader.id);
    const bond = rel ? opinionScore(rel) : 0;

    // Acceptance score, centered ~50.
    let accept = 45;
    if (wasPreferred) accept += 12;                       // the late leader chose them
    if (s.familyId === newLeader.familyId) accept += 14;  // same house
    accept += heirCap * 0.6;                              // visibly capable
    accept += bond * 0.35;                                // personal opinion
    if (rel?.tag === "kin") accept += 6;
    if (rel?.tag === "spouse") accept += 12;
    // Loyalty toward the old line carries through.
    accept += (s.loyaltyToFounder - 50) * 0.15;

    // Family standing of the new leader
    const fam = families.find((f) => f.id === newLeader.familyId);
    if (fam) accept += (fam.prestige - 50) * 0.1;

    accept = Math.max(0, Math.min(100, accept));

    // Translate to a small loyalty swing (-12..+15).
    const swing = Math.round((accept - 50) * 0.3);
    s.loyaltyToFounder = Math.max(-100, Math.min(100, s.loyaltyToFounder + swing));

    if (accept >= 70) {
      swearings++;
      deps.emitMemory(s, `${newLeader.name} took the porch. I will follow.`, "trust", 55, newLeader.id,
        { kind: "leader-accepted", floor: 22, decayRate: 0.4 });
    } else if (accept <= 32) {
      rejections++;
      deps.emitMemory(s, `${newLeader.name} took the porch. We will see.`, "fear", 45, newLeader.id,
        { kind: "leader-doubted", floor: 18, decayRate: 0.4 });
    } else {
      deps.emitMemory(s, `${oldLeader?.name ?? "The leader"} is gone. ${newLeader.name} stands in their place.`,
        "trust", 30, newLeader.id, { kind: "leader-changed", floor: 10, decayRate: 0.5 });
    }
    applied++;
  }

  return { applied, rejections, swearings };
}

// Chronicle title for a founder's death.
export function founderDeathTitle(founder: Survivor, epithet: string): string {
  return `${founder.name} ${founder.surname} — ${epithet} — has died`;
}

export function founderDeathBody(founder: Survivor, epithet: string, year: number): string {
  const at = Math.floor(founder.age);
  return `Year ${year}. The founder of the ranch, known to all as ${epithet}, ` +
    `passed at the age of ${at}. The porch is empty for a moment, and then it is not.`;
}

// Silence unused warning in type-only environments.
export type _Touch = ChronicleEntry;
