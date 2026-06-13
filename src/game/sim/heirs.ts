// Heir & succession scoring.
// Identifies potential heirs and scores them so the player can see who is
// shaping up to lead the ranch — and choose a preferred successor that
// will be honored (when alive & of age) on succession.

import type { Family, ID, Relationship, Survivor } from "../types";
import { opinionScore } from "./ai";

export type EducationFocus = "build" | "farm" | "lead" | "social" | "medic";

export const EDUCATION_LABEL: Record<EducationFocus, string> = {
  build: "Building",
  farm: "Farming",
  lead: "Leadership",
  social: "Social",
  medic: "Medicine",
};

export interface HeirCandidate {
  survivor: Survivor;
  score: number;          // 0..100
  ageReady: boolean;      // adult or elder
  isDescendant: boolean;
  isChildOfLeader: boolean;
  capability: number;     // skill avg
  ambition: number;       // trait-driven 0..30
  reputation: number;     // -50..50, avg of opinions about them
  familySupport: number;  // -50..50, avg loyaltyToFounder of own family
  notes: string[];        // surface-level reasons
}

const AMBITIOUS_TRAITS = ["Ambitious", "Driven", "Charismatic", "Proud", "Strong-willed", "Bold"];
const LAZY_TRAITS = ["Lazy", "Reckless", "Cowardly", "Quarrelsome", "Cruel"];

export function isDescendantOf(s: Survivor, ancestorId: ID, all: Survivor[]): boolean {
  if (s.id === ancestorId) return true;
  if (!s.parentIds || s.parentIds.length === 0) return false;
  return s.parentIds.some((pid) => {
    const p = all.find((x) => x.id === pid);
    return p ? isDescendantOf(p, ancestorId, all) : false;
  });
}

function ambitionFor(s: Survivor): number {
  let v = 0;
  for (const t of s.traits) {
    if (AMBITIOUS_TRAITS.includes(t)) v += 8;
    if (LAZY_TRAITS.includes(t)) v -= 6;
  }
  return Math.max(-15, Math.min(30, v));
}

function reputationOf(s: Survivor, relationships: Relationship[], survivors: Survivor[]): number {
  const rels = relationships.filter((r) => r.a === s.id || r.b === s.id);
  if (rels.length === 0) return 0;
  let sum = 0, n = 0;
  for (const r of rels) {
    const otherId = r.a === s.id ? r.b : r.a;
    const other = survivors.find((x) => x.id === otherId);
    if (!other || other.health <= 0) continue;
    sum += opinionScore(r);
    n++;
  }
  return n > 0 ? Math.max(-50, Math.min(50, sum / n / 2)) : 0;
}

export function scoreHeir(
  s: Survivor,
  ctx: {
    leader: Survivor | null;
    founderId: ID;
    survivors: Survivor[];
    relationships: Relationship[];
    families: Family[];
  },
): HeirCandidate {
  const notes: string[] = [];
  const isDescendant = isDescendantOf(s, ctx.founderId, ctx.survivors);
  const isChildOfLeader = ctx.leader ? s.parentIds.includes(ctx.leader.id) : false;
  const ageReady = s.stage === "adult" || s.stage === "elder";

  const sk = s.skills;
  const capability = Math.round(
    ((sk.lead ?? 1) * 2 + (sk.build ?? 1) + (sk.farm ?? 1) + (sk.social ?? 1) + (sk.medic ?? 1)) / 6,
  );
  const ambition = ambitionFor(s);
  const reputation = reputationOf(s, ctx.relationships, ctx.survivors);

  const family = ctx.families.find((f) => f.id === s.familyId);
  let familySupport = 0;
  if (family) {
    const kin = ctx.survivors.filter((x) => family.memberIds.includes(x.id) && x.health > 0 && x.id !== s.id);
    if (kin.length > 0) {
      familySupport = Math.max(-50, Math.min(50, kin.reduce((a, b) => a + b.loyaltyToFounder, 0) / kin.length / 2));
    }
  }

  // ── Score (0..100) ──
  let score = 30;
  if (isDescendant) { score += 18; notes.push("Of the founder's line"); }
  if (isChildOfLeader) { score += 6; notes.push("Child of the leader"); }
  if (ageReady) { score += 8; notes.push("Of age"); }
  else if (s.stage === "youth") { score += 2; notes.push("Nearly of age"); }
  else { score -= 6; notes.push("Still young"); }

  score += capability * 0.8;
  if (capability >= 18) notes.push(`Capable (skill ${capability})`);
  else if (capability < 6) notes.push("Untested");

  score += ambition * 0.5;
  if (ambition >= 12) notes.push("Ambitious by temperament");
  else if (ambition <= -6) notes.push("Lacks fire");

  score += reputation * 0.4;
  if (reputation >= 20) notes.push("Well-regarded");
  else if (reputation <= -15) notes.push("Mistrusted by peers");

  score += familySupport * 0.3;
  if (familySupport >= 25) notes.push("Family stands behind them");
  else if (familySupport <= -20) notes.push("Family unhappy");

  if (s.health <= 0) score = 0;

  return {
    survivor: s,
    score: Math.max(0, Math.min(100, Math.round(score))),
    ageReady,
    isDescendant,
    isChildOfLeader,
    capability,
    ambition,
    reputation,
    familySupport,
    notes,
  };
}

export interface HeirRating {
  rating: "High" | "Strong" | "Moderate" | "Low" | "None";
  tone: "text-success" | "text-amber" | "text-dust-light" | "text-warning" | "text-danger";
}

export function heirRating(score: number): HeirRating {
  if (score >= 75) return { rating: "High", tone: "text-success" };
  if (score >= 60) return { rating: "Strong", tone: "text-amber" };
  if (score >= 40) return { rating: "Moderate", tone: "text-dust-light" };
  if (score >= 20) return { rating: "Low", tone: "text-warning" };
  return { rating: "None", tone: "text-danger" };
}

/** Ranked candidate list — descendants/kin only, alive, not the current leader. */
export function rankHeirs(ctx: {
  leader: Survivor | null;
  founderId: ID;
  survivors: Survivor[];
  relationships: Relationship[];
  families: Family[];
}): HeirCandidate[] {
  const leaderId = ctx.leader?.id ?? "";
  const list = ctx.survivors
    .filter((s) => s.health > 0 && s.id !== leaderId)
    .map((s) => scoreHeir(s, ctx))
    // Keep descendants OR same-family kin of the leader (or just descendants if no leader).
    .filter((c) =>
      c.isDescendant ||
      (ctx.leader && c.survivor.familyId === ctx.leader.familyId) ||
      false,
    );
  list.sort((a, b) => {
    // Of-age first, then by score, then by age desc.
    if (a.ageReady !== b.ageReady) return a.ageReady ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.survivor.age - a.survivor.age;
  });
  return list;
}

/** Pick the actual successor: preferred (if eligible) else top-ranked. */
export function pickSuccessor(ctx: {
  leader: Survivor | null;
  founderId: ID;
  preferredHeirId: ID | null;
  survivors: Survivor[];
  relationships: Relationship[];
  families: Family[];
}): Survivor | null {
  if (ctx.preferredHeirId) {
    const pref = ctx.survivors.find((s) => s.id === ctx.preferredHeirId);
    if (pref && pref.health > 0 && (pref.stage === "adult" || pref.stage === "elder")) {
      return pref;
    }
  }
  const ranked = rankHeirs(ctx);
  const eligible = ranked.find((c) => c.ageReady);
  return eligible?.survivor ?? null;
}

/** Daily education tick — each child/teen with a focus and a parent gains a little skill. */
export function dailyEducationTick(survivors: Survivor[]) {
  for (const s of survivors) {
    if (s.health <= 0) continue;
    if (s.stage !== "child" && s.stage !== "teen") continue;
    const focus = s.educationFocus;
    if (!focus) continue;
    const hasParent = s.parentIds.some((pid) => {
      const p = survivors.find((x) => x.id === pid);
      return p && p.health > 0;
    });
    if (!hasParent) continue;
    const cur = s.skills[focus] ?? 1;
    const gain = s.stage === "teen" ? 0.18 : 0.1;
    s.skills[focus] = Math.min(30, cur + gain);
  }
}
