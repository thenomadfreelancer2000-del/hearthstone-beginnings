// Annual Council Vote — once a year, the council of houses votes on whether
// the current leader keeps the porch, or whether a rival challenges them.
// Pure event generation; resolution happens in the store.

import type { Animal, Building, Family, ID, Minister, ResourceKind, Survivor } from "../types";
import { computePolitics, type HousePolitics } from "./politics";

export type CouncilAction = "speech" | "bribe" | "office" | "crush" | "stepdown" | "abdicate-peace";

export interface CouncilVote {
  familyId: ID;
  houseName: string;
  forLeader: boolean;
  reason: string;
}

export interface CouncilVoteEvent {
  id: string;
  year: number;
  leaderId: ID;
  leaderName: string;
  leaderHouseId: ID;
  leaderHouseName: string;
  leaderPower: number;
  challengerHouseId: ID | null;
  challengerName: string | null;       // head name
  challengerHeadId: ID | null;
  challengerHouseName: string | null;
  challengerPower: number;
  challengerAgenda: string | null;
  votes: CouncilVote[];
  forCount: number;
  againstCount: number;
  contested: boolean;
  flavor: string;
}

interface GenInput {
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

function shortYearId(year: number) {
  return `cv-${year}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function generateCouncilVote(input: GenInput): CouncilVoteEvent | null {
  const snap = computePolitics(input);
  if (snap.houses.length < 2) return null;

  const leader = input.survivors.find((s) => s.id === input.currentLeaderId && s.health > 0);
  if (!leader) return null;
  const leaderHouse = snap.houses.find((h) => h.familyId === leader.familyId);
  if (!leaderHouse) return null;

  // Voting body: every council seat plus leader's house (if not on it).
  const voters = [...snap.council];
  if (!voters.some((h) => h.familyId === leaderHouse.familyId)) voters.push(leaderHouse);

  // Marriage tie set — built from survivors of leader's family.
  const leaderFamilyMembers = input.survivors.filter(
    (s) => s.familyId === leader.familyId && s.health > 0,
  );
  const alliedFamilies = new Set<ID>();
  for (const m of leaderFamilyMembers) {
    if (!m.spouseId) continue;
    const sp = input.survivors.find((x) => x.id === m.spouseId);
    if (sp?.familyId && sp.familyId !== leader.familyId) alliedFamilies.add(sp.familyId);
  }

  const votes: CouncilVote[] = [];
  for (const h of voters) {
    let score = 0;
    const reasons: string[] = [];
    if (h.familyId === leaderHouse.familyId) {
      score += 70; reasons.push("Loyal to our house");
    }
    if (alliedFamilies.has(h.familyId)) {
      score += 30; reasons.push("Bound by marriage");
    }
    if (h.officesHeld.length > 0) {
      score += 12 * h.officesHeld.length; reasons.push("Holds an office");
    }
    if (h.reputationTags.includes("Loyal")) { score += 18; reasons.push("Loyal to the founder"); }
    if (h.reputationTags.includes("Discontent")) { score -= 32; reasons.push("Discontented"); }
    if (h.reputationTags.includes("Founder Line")) { score += 10; }
    // Ambition: stronger houses than the leader push against.
    const gap = h.politicalPower - leaderHouse.politicalPower;
    if (gap > 5) { score -= Math.min(45, gap * 1.4); reasons.push("Hungers for the porch"); }
    else if (gap < -10) { score += 8; reasons.push("Knows their place"); }
    // Agenda pressure.
    if (h.agenda.startsWith("Gain")) { score -= 12; reasons.push("Wants an office"); }
    if (h.agenda.startsWith("Secure housing")) { score -= 18; reasons.push("Their kin live rough"); }
    // Random conviction.
    score += (Math.random() - 0.5) * 20;

    votes.push({
      familyId: h.familyId,
      houseName: h.name,
      forLeader: score >= 0,
      reason: reasons[0] ?? (score >= 0 ? "Sees no better hand" : "Whispers of change"),
    });
  }

  const forCount = votes.filter((v) => v.forLeader).length;
  const againstCount = votes.length - forCount;

  // Top rival (most powerful non-leader house) — only matters if there is dissent
  // OR if a rival is at least 80% of the leader's power.
  const rivals = snap.houses.filter((h) => h.familyId !== leaderHouse.familyId);
  rivals.sort((a, b) => b.politicalPower - a.politicalPower);
  const challenger = rivals[0] ?? null;
  const challengerStrong =
    challenger != null && challenger.politicalPower >= leaderHouse.politicalPower * 0.75;
  const contested = againstCount >= forCount || (challengerStrong && againstCount >= 1);

  // Skip the modal in quiet years — uncontested overwhelming majority, no strong rival.
  if (!contested && againstCount === 0 && (challenger?.politicalPower ?? 0) < leaderHouse.politicalPower * 0.6) {
    return null;
  }

  const flavor = contested
    ? `House ${challenger?.name ?? rivals[0]?.name ?? "—"} rises before the council. The hall is loud.`
    : `The council assembles in the long room. A few hands are slow to raise.`;

  return {
    id: shortYearId(input.currentYear),
    year: input.currentYear,
    leaderId: leader.id,
    leaderName: `${leader.name} ${leader.surname}`,
    leaderHouseId: leaderHouse.familyId,
    leaderHouseName: leaderHouse.name,
    leaderPower: leaderHouse.politicalPower,
    challengerHouseId: challenger?.familyId ?? null,
    challengerName: challenger?.headName ?? null,
    challengerHeadId: challenger?.headId ?? null,
    challengerHouseName: challenger?.name ?? null,
    challengerPower: challenger?.politicalPower ?? 0,
    challengerAgenda: challenger?.agenda ?? null,
    votes,
    forCount,
    againstCount,
    contested,
    flavor,
  };
}

// ── Action helpers (pure logic, used by store) ────────────────────

export interface ResolutionOutcome {
  ok: boolean;
  title: string;
  body: string;
  /** Family-id → prestige delta. */
  prestigeDeltas: Record<ID, number>;
  /** Family-id → wealth delta. */
  wealthDeltas: Record<ID, number>;
  /** Resource costs to subtract. */
  resourceCost: Partial<Record<ResourceKind, number>>;
  /** If non-null, leader changes to this survivor id. */
  newLeaderId: ID | null;
  /** Toast tone */
  tone: "good" | "bad" | "neutral";
}

const D = (deltas: Record<ID, number>, id: ID, n: number) => {
  deltas[id] = (deltas[id] ?? 0) + n;
};

export function resolveCouncilVote(
  ev: CouncilVoteEvent,
  action: CouncilAction,
  ctx: { resources: Record<ResourceKind, number>; leaderLeadSkill: number },
): ResolutionOutcome {
  const out: ResolutionOutcome = {
    ok: true,
    title: "",
    body: "",
    prestigeDeltas: {},
    wealthDeltas: {},
    resourceCost: {},
    newLeaderId: null,
    tone: "neutral",
  };
  const chId = ev.challengerHouseId;

  switch (action) {
    case "speech": {
      // lead skill + votes for + leader power vs challenger.
      const roll = Math.random() * 100;
      const target =
        35 + ctx.leaderLeadSkill * 2 +
        (ev.forCount - ev.againstCount) * 6 +
        (ev.leaderPower - ev.challengerPower) * 0.4;
      const success = roll <= target;
      if (success) {
        out.title = `${ev.leaderName} sways the hall`;
        out.body = `Words like iron. The council bows their heads and the year goes on.`;
        D(out.prestigeDeltas, ev.leaderHouseId, 8);
        if (chId) D(out.prestigeDeltas, chId, -4);
        out.tone = "good";
      } else {
        out.title = `${ev.leaderName}'s words fall flat`;
        out.body = `The hall is unmoved. The challenger gains face.`;
        D(out.prestigeDeltas, ev.leaderHouseId, -6);
        if (chId) D(out.prestigeDeltas, chId, 6);
        out.tone = "bad";
      }
      return out;
    }
    case "bribe": {
      const cost = { food: 40, tools: 6 };
      if ((ctx.resources.food ?? 0) < cost.food || (ctx.resources.tools ?? 0) < cost.tools) {
        out.ok = false;
        out.title = "Not enough to grease the wheel";
        out.body = `A bribe needs ${cost.food} food and ${cost.tools} tools.`;
        out.tone = "bad";
        return out;
      }
      out.resourceCost = cost;
      out.title = `Coin and grain change hands`;
      out.body = `The houses leave the hall with full satchels. The vote is yours — for this year.`;
      if (chId) D(out.wealthDeltas, chId, 6);
      D(out.prestigeDeltas, ev.leaderHouseId, -3); // dignity cost
      out.tone = "neutral";
      return out;
    }
    case "office": {
      if (!chId) {
        out.ok = false; out.title = "No challenger to placate"; out.body = "";
        return out;
      }
      out.title = `An office for House ${ev.challengerHouseName}`;
      out.body = `${ev.challengerName} is promised a seat at the table. Ambition is fed, not crushed.`;
      D(out.prestigeDeltas, chId, 12);
      D(out.prestigeDeltas, ev.leaderHouseId, 2);
      out.tone = "good";
      return out;
    }
    case "crush": {
      // High-risk: needs lead skill to avoid backlash.
      const roll = Math.random() * 100;
      const target = 40 + ctx.leaderLeadSkill * 3;
      const success = roll <= target;
      if (success) {
        out.title = `The challenger is broken`;
        out.body = `House ${ev.challengerHouseName} leaves the hall in silence. No one rises against the porch this year.`;
        if (chId) D(out.prestigeDeltas, chId, -25);
        if (chId) D(out.wealthDeltas, chId, -10);
        D(out.prestigeDeltas, ev.leaderHouseId, -2); // dread costs respect
        out.tone = "neutral";
      } else {
        out.title = `The hall turns against the porch`;
        out.body = `The crackdown backfires. Other houses close ranks with the challenger.`;
        if (chId) D(out.prestigeDeltas, chId, 14);
        D(out.prestigeDeltas, ev.leaderHouseId, -15);
        out.tone = "bad";
      }
      return out;
    }
    case "stepdown": {
      if (!ev.challengerHeadId) {
        out.ok = false; out.title = "No clear successor"; out.body = "";
        return out;
      }
      out.title = `${ev.leaderName} steps down`;
      out.body = `The porch is given to ${ev.challengerName} of House ${ev.challengerHouseName}. The settlement watches in silence.`;
      out.newLeaderId = ev.challengerHeadId;
      if (chId) D(out.prestigeDeltas, chId, 18);
      D(out.prestigeDeltas, ev.leaderHouseId, 6); // dignified exit
      out.tone = "neutral";
      return out;
    }
    case "abdicate-peace": {
      out.title = "The council disperses";
      out.body = "No grand promises. The year turns and the houses wait.";
      return out;
    }
  }
  return out;
}
