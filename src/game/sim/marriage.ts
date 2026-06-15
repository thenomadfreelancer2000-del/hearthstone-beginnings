// Dynastic Marriage — proposal queue, House Head approval, marriage execution.
// Additive layer on top of the existing family / housing / memory systems.

import { nanoid } from "nanoid";
import type {
  Family, ID, MarriageProposal, Relationship, Survivor,
} from "../types";
import { chance } from "./rng";
import { findRelationship, markAsSpouses } from "./ai";
import { headOfFamily } from "./families";
import { addChronicle, emitMemory, assignSpousesToShared, type Engine } from "./engine";
import { isResidential, homeCapacity } from "./housing";

/** True if either spouse has a home, or any vacant residence is available. */
function hasHomeFor(eng: Engine, a: Survivor, b: Survivor): boolean {
  if (a.homeId || b.homeId) return true;
  for (const bld of eng.buildings) {
    if (!isResidential(bld.kind) || bld.builtProgress < 1) continue;
    if ((bld.occupantIds?.length ?? 0) < homeCapacity(bld)) return true;
  }
  return false;
}

// ── Helpers ─────────────────────────────────────────────────────

function emitMem(
  eng: Engine,
  s: Survivor,
  text: string,
  emotion: Parameters<typeof emitMemory>[2],
  weight: number,
  aboutId?: string,
  opts?: { kind?: string; decayRate?: number; floor?: number },
) {
  emitMemory(s, text, emotion, weight, aboutId, {
    ...opts,
    at: { tick: eng.time.tick, year: eng.time.year, season: eng.time.season, day: eng.time.day },
  });
}

function familyOf(eng: Engine, sid: ID): Family | undefined {
  const s = eng.survivors.find(x => x.id === sid);
  if (!s) return undefined;
  return eng.families.find(f => f.id === s.familyId);
}

function addToFamily(family: Family, survivor: Survivor) {
  if (!family.memberIds.includes(survivor.id)) family.memberIds.push(survivor.id);
  survivor.familyId = family.id;
}

function isFounderHouse(eng: Engine, familyId: ID): boolean {
  const founder = eng.survivors.find(s => s.id === eng.founderId);
  return !!founder && founder.familyId === familyId;
}

// ── Scoring ─────────────────────────────────────────────────────

/** 0..100 compatibility from shared values, similar age, social skills. */
export function compatibilityScore(a: Survivor, b: Survivor): number {
  const valuesShared = a.values.filter(v => b.values.includes(v)).length;
  const ageGap = Math.abs(a.age - b.age);
  const ageScore = Math.max(0, 35 - ageGap * 1.4);
  const socialAvg = ((a.skills.social ?? 1) + (b.skills.social ?? 1)) / 2;
  const moodAvg = (a.mood + b.mood) / 2;
  const base = 25 + valuesShared * 10 + ageScore + Math.min(15, socialAvg) + Math.max(-15, Math.min(15, moodAvg / 4));
  return Math.max(0, Math.min(100, Math.round(base)));
}

/** Blended -100..100 — how the two House Heads feel about the union. */
export function familyApproval(eng: Engine, a: Survivor, b: Survivor): number {
  const fa = familyOf(eng, a.id);
  const fb = familyOf(eng, b.id);
  if (!fa || !fb) return 0;
  const prestigeDiff = Math.abs(fa.prestige - fb.prestige);
  const interRel = ((fa.relations[fb.id] ?? 0) + (fb.relations[fa.id] ?? 0)) / 2;
  // Heads' opinions of partner
  const headA = headOfFamily(fa, eng.survivors);
  const headB = headOfFamily(fb, eng.survivors);
  let headOpinion = 0;
  if (headA && headA.id !== a.id) {
    const r = findRelationship(eng.relationships, headA.id, b.id);
    if (r) headOpinion += r.affection * 0.5 + r.respect * 0.3;
  }
  if (headB && headB.id !== b.id) {
    const r = findRelationship(eng.relationships, headB.id, a.id);
    if (r) headOpinion += r.affection * 0.5 + r.respect * 0.3;
  }
  // Big prestige gaps grate on the higher house.
  const gapPenalty = prestigeDiff > 30 ? -Math.min(40, (prestigeDiff - 30) * 0.6) : 0;
  const score = 15 + interRel * 0.4 + headOpinion * 0.5 + gapPenalty;
  return Math.max(-100, Math.min(100, Math.round(score)));
}

export function expectedPrestigeDelta(fa: Family, fb: Family): number {
  const high = Math.max(fa.prestige, fb.prestige);
  const low = Math.min(fa.prestige, fb.prestige);
  const gap = high - low;
  // Equal high houses: meaningful bump. Big gap: small bump for high house.
  if (high >= 60 && low >= 60) return 12;
  if (gap > 40) return 2;
  return 5 + Math.floor(low * 0.05);
}

export function expectedRelationDelta(fa: Family, fb: Family): number {
  return Math.max(10, Math.min(40, 25 - Math.floor(Math.abs(fa.prestige - fb.prestige) / 6)));
}

// ── Proposal lifecycle ─────────────────────────────────────────

function pairKey(aId: ID, bId: ID) {
  return aId < bId ? `${aId}::${bId}` : `${bId}::${aId}`;
}

function hasOpenProposal(eng: Engine, aId: ID, bId: ID): boolean {
  const key = pairKey(aId, bId);
  return (eng.proposals ?? []).some(p =>
    p.status !== "rejected" && pairKey(p.aId, p.bId) === key,
  );
}

function makeProposal(
  eng: Engine,
  a: Survivor, b: Survivor,
  fa: Family, fb: Family,
  arranged: boolean,
): MarriageProposal {
  const r = findRelationship(eng.relationships, a.id, b.id);
  const requiresPlayer = isFounderHouse(eng, fa.id) || isFounderHouse(eng, fb.id);
  return {
    id: nanoid(8),
    aId: a.id, bId: b.id,
    aFamilyId: fa.id, bFamilyId: fb.id,
    createdTick: eng.time.tick, createdYear: eng.time.year,
    attraction: r ? Math.round(Math.max(0, r.attraction)) : 0,
    compatibility: compatibilityScore(a, b),
    familyApproval: familyApproval(eng, a, b),
    prestigeA: Math.round(fa.prestige),
    prestigeB: Math.round(fb.prestige),
    expectedPrestigeDelta: expectedPrestigeDelta(fa, fb),
    expectedRelationDelta: expectedRelationDelta(fa, fb),
    status: "pending",
    requiresPlayer,
    arranged,
  };
}

/** Called from the seasonal marriage scan. Replaces direct auto-marry. */
export function enqueueProposalsForSeason(eng: Engine, rng: () => number) {
  if (!eng.proposals) eng.proposals = [];
  const eligible = eng.survivors.filter(s =>
    s.health > 0 && !s.spouseId && !s.fianceId &&
    (s.stage === "adult" || s.stage === "youth") && s.age >= 18,
  );
  for (const a of eligible) {
    for (const b of eligible) {
      if (a.id >= b.id) continue;
      if (a.gender === b.gender) continue;
      const sharedParent = a.parentIds.some(p => b.parentIds.includes(p));
      if (a.parentIds.includes(b.id) || b.parentIds.includes(a.id) || sharedParent) continue;
      const r = findRelationship(eng.relationships, a.id, b.id);
      if (!r) continue;
      if (r.attraction < 55 || r.affection < 35) continue;
      if (hasOpenProposal(eng, a.id, b.id)) continue;
      if (!chance(rng, 0.55)) continue;
      const fa = familyOf(eng, a.id);
      const fb = familyOf(eng, b.id);
      if (!fa || !fb) continue;
      const prop = makeProposal(eng, a, b, fa, fb, false);
      eng.proposals.push(prop);
      // Mood ping that something stirs.
      emitMem(eng, a, `Started to think seriously about ${b.name}.`, "love", 25, b.id,
        { kind: "courtship", floor: 5, decayRate: 0.8 });
      emitMem(eng, b, `Started to think seriously about ${a.name}.`, "love", 25, a.id,
        { kind: "courtship", floor: 5, decayRate: 0.8 });
    }
  }
}

/** Daily — auto-resolve non-founder proposals & approved (player-decided) ones. */
export function resolveProposalsDaily(eng: Engine, rng: () => number) {
  if (!eng.proposals || eng.proposals.length === 0) return;
  const survive: MarriageProposal[] = [];
  for (const p of eng.proposals) {
    if (p.status === "rejected") continue;
    const a = eng.survivors.find(s => s.id === p.aId);
    const b = eng.survivors.find(s => s.id === p.bId);
    if (!a || !b || a.health <= 0 || b.health <= 0 || a.spouseId || b.spouseId) continue;

    if (p.status === "approved") {
      // Wait for a home before holding the wedding.
      if (!hasHomeFor(eng, a, b)) { survive.push(p); continue; }
      marryPair(eng, a, b, p);
      continue;
    }
    if (p.status === "postponed") {
      if (eng.time.tick < (p.resolveAfterTick ?? 0)) { survive.push(p); continue; }
      p.status = "pending";
    }
    if (p.requiresPlayer) { survive.push(p); continue; }
    // Auto decision by House Heads — score 0..1
    const compatNorm = p.compatibility / 100;
    const approveNorm = (p.familyApproval + 100) / 200;
    const attractionNorm = p.attraction / 100;
    const score = compatNorm * 0.35 + approveNorm * 0.4 + attractionNorm * 0.25;
    if (score > 0.55 && chance(rng, 0.6)) {
      if (!hasHomeFor(eng, a, b)) {
        // Council-approved internally, but no shelter — wait for one.
        p.status = "approved";
        survive.push(p);
        continue;
      }
      marryPair(eng, a, b, p);
      continue;
    }
    if (score < 0.25) {
      p.status = "rejected";
      continue;
    }
    // age the proposal — drop after 90 days if still pending
    if (eng.time.tick - p.createdTick > 90 * 24) continue;
    survive.push(p);
  }
  eng.proposals = survive;
}

/** Player initiates a marriage proposal from the Founder house. */
export function createArrangedProposal(eng: Engine, aId: ID, bId: ID): MarriageProposal | null {
  if (!eng.proposals) eng.proposals = [];
  const a = eng.survivors.find(s => s.id === aId);
  const b = eng.survivors.find(s => s.id === bId);
  if (!a || !b) return null;
  if (a.spouseId || b.spouseId || a.fianceId || b.fianceId) return null;
  const fa = familyOf(eng, aId); const fb = familyOf(eng, bId);
  if (!fa || !fb) return null;
  if (hasOpenProposal(eng, aId, bId)) return null;
  const prop = makeProposal(eng, a, b, fa, fb, true);
  prop.status = "approved";       // founder approves up-front
  prop.requiresPlayer = false;
  eng.proposals.push(prop);
  return prop;
}

// ── Execute a marriage ─────────────────────────────────────────

export function marryPair(eng: Engine, a: Survivor, b: Survivor, proposal?: MarriageProposal) {
  a.spouseId = b.id; b.spouseId = a.id;
  a.fianceId = null; b.fianceId = null;
  a.marriedTick = eng.time.tick; b.marriedTick = eng.time.tick;
  a.marriedYear = eng.time.year; b.marriedYear = eng.time.year;

  const fa = familyOf(eng, a.id)!;
  const fb = familyOf(eng, b.id)!;
  let lead: Family, follow: Family, leadSpouse: Survivor, followSpouse: Survivor;
  if (fa.prestige >= fb.prestige) {
    lead = fa; follow = fb; leadSpouse = a; followSpouse = b;
  } else {
    lead = fb; follow = fa; leadSpouse = b; followSpouse = a;
  }
  followSpouse.surname = lead.name;
  follow.memberIds = follow.memberIds.filter(id => id !== followSpouse.id);
  addToFamily(lead, followSpouse);
  if (follow.memberIds.length === 0) follow.extinctYear = eng.time.year;

  // ── Prestige & relations: dynastic effects ───────────────────
  const highP = Math.max(fa.prestige, fb.prestige);
  const lowP = Math.min(fa.prestige, fb.prestige);
  const gap = highP - lowP;
  let prestigeBump = 5 + Math.floor(follow.prestige * 0.1);
  let chronicleFlavor = `The ${lead.name} line gains a new hand.`;
  const prestigious = highP >= 60 && lowP >= 60;
  const beneath = gap > 40 && lead.prestige === highP;

  if (prestigious) {
    prestigeBump += 10;
    follow.prestige = Math.min(200, follow.prestige + 6);
    chronicleFlavor = `Two respected Houses are bound — a prestigious union.`;
  } else if (beneath) {
    prestigeBump = Math.max(1, prestigeBump - 4);
    chronicleFlavor = `Tongues wag — the ${lead.name} have married beneath their standing.`;
    // High-house kin grumble
    for (const mid of lead.memberIds) {
      if (mid === leadSpouse.id) continue;
      const m = eng.survivors.find(s => s.id === mid);
      if (!m || m.health <= 0) continue;
      emitMem(eng, m, `${leadSpouse.name} married beneath us.`, "anger", 35, leadSpouse.id,
        { kind: "married-beneath", floor: 12, decayRate: 0.4 });
      m.mood = Math.max(-100, m.mood - 4);
    }
  }

  lead.prestige = Math.min(200, lead.prestige + prestigeBump);
  const relDelta = proposal?.expectedRelationDelta ?? 25;
  lead.relations[follow.id] = Math.min(100, (lead.relations[follow.id] ?? 0) + relDelta);
  follow.relations[lead.id] = Math.min(100, (follow.relations[lead.id] ?? 0) + relDelta);

  markAsSpouses(eng.relationships, a.id, b.id, eng.time.tick);
  assignSpousesToShared(eng, a, b);

  a.mood = Math.min(100, a.mood + 30);
  b.mood = Math.min(100, b.mood + 30);
  a.needs.belonging = 100;
  b.needs.belonging = 100;

  const arrangedNote = proposal?.arranged ? " (Arranged by the Founder.)" : "";
  emitMem(eng, a, `Married ${b.name} ${b.surname}.${arrangedNote}`, "love", 95, b.id,
    { kind: proposal?.arranged ? "founder-arranged" : "married", floor: 40, decayRate: 0.5 });
  emitMem(eng, b, `Married ${a.name} ${a.surname}.${arrangedNote}`, "love", 95, a.id,
    { kind: proposal?.arranged ? "founder-arranged" : "married", floor: 40, decayRate: 0.5 });

  // Prestigious union — joyful family memory for both Houses
  if (prestigious) {
    for (const fid of [lead.id, follow.id]) {
      const fam = eng.families.find(f => f.id === fid);
      if (!fam) continue;
      for (const mid of fam.memberIds) {
        const m = eng.survivors.find(s => s.id === mid);
        if (!m || m.health <= 0 || m.id === a.id || m.id === b.id) continue;
        emitMem(eng, m, `Our House joined with the ${fid === lead.id ? follow.name : lead.name} in a proud match.`,
          "pride", 40, leadSpouse.id, { kind: "prestigious-union", floor: 14, decayRate: 0.3 });
        m.mood = Math.min(100, m.mood + 3);
      }
    }
  }

  addChronicle(
    eng, "marriage",
    `${leadSpouse.name} of ${lead.name} weds ${followSpouse.name}`,
    `Under the year of ${eng.time.year}, ${a.name} and ${b.name} swore to share roof, ration, and grave. ${chronicleFlavor}${arrangedNote}`,
    [a.id, b.id], [lead.id, follow.id],
  );

  if (proposal) proposal.status = "approved";
}
