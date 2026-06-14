// Annual Council Vote — once a year, the council of houses votes on whether
// the current leader keeps the porch, or whether a rival challenges them.
// Pure event generation; resolution happens in the store.

import type { Animal, Building, Family, ID, Minister, ResourceKind, Survivor } from "../types";
import type { ReputationProfile } from "./reputation";
import { computePolitics } from "./politics";

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
  challengerName: string | null;
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

  const voters = [...snap.council];
  if (!voters.some((h) => h.familyId === leaderHouse.familyId)) voters.push(leaderHouse);

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
    if (h.familyId === leaderHouse.familyId) { score += 70; reasons.push("Loyal to our house"); }
    if (alliedFamilies.has(h.familyId)) { score += 30; reasons.push("Bound by marriage"); }
    if (h.officesHeld.length > 0) { score += 12 * h.officesHeld.length; reasons.push("Holds an office"); }
    if (h.reputationTags.includes("Loyal")) { score += 18; reasons.push("Loyal to the founder"); }
    if (h.reputationTags.includes("Discontent")) { score -= 32; reasons.push("Discontented"); }
    if (h.reputationTags.includes("Founder Line")) { score += 10; }
    const gap = h.politicalPower - leaderHouse.politicalPower;
    if (gap > 5) { score -= Math.min(45, gap * 1.4); reasons.push("Hungers for the porch"); }
    else if (gap < -10) { score += 8; reasons.push("Knows their place"); }
    if (h.agenda.startsWith("Gain")) { score -= 12; reasons.push("Wants an office"); }
    if (h.agenda.startsWith("Secure housing")) { score -= 18; reasons.push("Their kin live rough"); }
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

  const rivals = snap.houses.filter((h) => h.familyId !== leaderHouse.familyId);
  rivals.sort((a, b) => b.politicalPower - a.politicalPower);
  const challenger = rivals[0] ?? null;
  const challengerStrong =
    challenger != null && challenger.politicalPower >= leaderHouse.politicalPower * 0.75;
  const contested = againstCount >= forCount || (challengerStrong && againstCount >= 1);

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

// ── Action effect spec & costs ────────────────────────────────────

export interface ActionInfo {
  label: string;
  hint: string;
  cost: Partial<Record<ResourceKind, number>>;
  /** Plain-language effects the player should expect (success path). */
  effects: string[];
  /** Plain-language risks. Empty array = safe. */
  risks: string[];
}

export const COUNCIL_ACTION_INFO: Record<CouncilAction, ActionInfo> = {
  speech: {
    label: "Speak with authority",
    hint: "Sway the hall with your words.",
    cost: {},
    effects: [
      "On success: +8 prestige to your house, +6 loyalty across the ranch",
      "+4 'honest' reputation",
    ],
    risks: [
      "On failure: −8 prestige, −10 loyalty, challenger gains +6 prestige",
      "Outcome scales with your Lead skill and the vote tally",
    ],
  },
  bribe: {
    label: "Grease the wheel",
    hint: "Buy the vote outright with grain and tools.",
    cost: { food: 40, tools: 6 },
    effects: [
      "Vote secured this year, no challenger backlash",
      "Challenger's house gains +6 wealth (paid off)",
    ],
    risks: [
      "−4 prestige to your house (dignity cost)",
      "+5 'ruthless' reputation, −3 'honest'",
      "Food and tools deducted immediately — pressure on the stores",
    ],
  },
  office: {
    label: "Promise the challenger an office",
    hint: "Feed ambition. They join the table.",
    cost: {},
    effects: [
      "Challenger's house: +12 prestige, +20 relations with your house",
      "Your house: +2 prestige, +6 loyalty (statesmanship)",
      "Removes the threat without bloodshed",
    ],
    risks: [
      "Other rival houses see you as easily pressed (−5 prestige to your house long-term flavor only)",
    ],
  },
  crush: {
    label: "Crush the challenger",
    hint: "Break them publicly. High risk, decisive if it lands.",
    cost: {},
    effects: [
      "On success: challenger −25 prestige, −10 wealth, −40 relations",
      "Loyalty across the ranch drops by 8 (fear, not love)",
      "+10 'ruthless' reputation, −5 'compassionate'",
    ],
    risks: [
      "On failure: your house −18 prestige, challenger +15 prestige, −15 loyalty",
      "Either way: stability drops (homes feel less safe)",
      "Outcome scales with Lead skill",
    ],
  },
  stepdown: {
    label: "Step down — yield the porch",
    hint: "Hand the settlement to the challenger.",
    cost: {},
    effects: [
      "Challenger becomes the new leader of the ranch",
      "Your house keeps +6 prestige (dignified exit)",
      "Challenger's house: +18 prestige, +30 loyalty within their kin",
    ],
    risks: [
      "You lose leadership — the founder's line may not return",
    ],
  },
  "abdicate-peace": {
    label: "Adjourn quietly",
    hint: "No promises made. The year turns.",
    cost: {},
    effects: ["No effect. The houses go home grumbling."],
    risks: [],
  },
};

// ── Risk forecasting ─────────────────────────────────────────────

export interface ActionRisk {
  score: number;             // 0..100, perceived risk
  label: "Low" | "Moderate" | "High" | "Reckless";
  backlash: string[];        // faction/house reactions in plain language
  repShifts: { axis: keyof ReputationProfile; delta: number; reason: string }[];
}

export function forecastActionRisk(
  ev: CouncilVoteEvent,
  action: CouncilAction,
  leaderLeadSkill: number,
): ActionRisk {
  const opposing = ev.votes.filter(v => !v.forLeader);
  const supporting = ev.votes.filter(v => v.forLeader);
  const challengerName = ev.challengerHouseName ?? "the rival";
  let score = 5;
  const backlash: string[] = [];
  const repShifts: ActionRisk["repShifts"] = [];

  switch (action) {
    case "speech": {
      // Risk = chance of failure.
      const target = 35 + leaderLeadSkill * 2 +
        (ev.forCount - ev.againstCount) * 6 +
        (ev.leaderPower - ev.challengerPower) * 0.4;
      const failChance = Math.max(5, Math.min(95, 100 - target));
      score = Math.round(failChance);
      backlash.push(`${Math.round(failChance)}% chance the hall is unmoved`);
      if (ev.againstCount > ev.forCount) backlash.push(`Opposing houses outnumber loyalists`);
      if (leaderLeadSkill < 3) backlash.push(`Leader's oratory is weak (Lead ${leaderLeadSkill.toFixed(1)})`);
      repShifts.push({ axis: "honest", delta: 4, reason: "speaks plainly" });
      break;
    }
    case "bribe": {
      score = 35;
      backlash.push(`Discontented houses will remember the gold`);
      if (opposing.length > 0)
        backlash.push(`${opposing.map(o => `House ${o.houseName}`).join(", ")} take payment but lose respect`);
      backlash.push(`Loyalty across the ranch drops slightly`);
      repShifts.push({ axis: "ruthless", delta: 5, reason: "buys silence" });
      repShifts.push({ axis: "honest", delta: -3, reason: "deals under the table" });
      break;
    }
    case "office": {
      score = 15;
      if (!ev.challengerHouseId) { score = 100; backlash.push("No challenger to placate"); break; }
      backlash.push(`House ${challengerName} gains real power on the council`);
      if (supporting.length > 0)
        backlash.push(`Loyalists may feel taken for granted (no friction now, friction later)`);
      repShifts.push({ axis: "compassionate", delta: 3, reason: "shares power" });
      repShifts.push({ axis: "honest", delta: 2, reason: "honors ambition openly" });
      break;
    }
    case "crush": {
      const successTarget = 40 + leaderLeadSkill * 3;
      const failChance = Math.max(5, Math.min(95, 100 - successTarget));
      // Crush is dangerous even on success — ranch-wide fear.
      score = Math.round(Math.max(60, failChance + 20));
      backlash.push(`${Math.round(failChance)}% chance the crackdown backfires`);
      backlash.push(`House ${challengerName} becomes a long-term rival`);
      backlash.push(`Loyalty drops across every house (fear, not love)`);
      if (opposing.length >= 2)
        backlash.push(`${opposing.length} opposing houses may close ranks together`);
      repShifts.push({ axis: "ruthless", delta: 10, reason: "uses force" });
      repShifts.push({ axis: "compassionate", delta: -5, reason: "breaks a house publicly" });
      break;
    }
    case "stepdown": {
      score = 80;
      backlash.push(`You lose leadership of the ranch`);
      backlash.push(`Your house keeps its dignity but loses the porch`);
      backlash.push(`The founder's bloodline may never lead again`);
      repShifts.push({ axis: "honest", delta: 5, reason: "yields with grace" });
      break;
    }
    case "abdicate-peace": {
      score = 5;
      backlash.push(`Nothing changes; rivals will return next year`);
      break;
    }
  }

  const label: ActionRisk["label"] =
    score >= 75 ? "Reckless" :
    score >= 50 ? "High" :
    score >= 25 ? "Moderate" : "Low";

  return { score: Math.max(0, Math.min(100, score)), label, backlash, repShifts };
}

export interface CouncilReactionEntry {
  familyId: ID;
  houseName: string;
  /** "leader" = leader's own house, "challenger" = challenger's house, "other" = bystander */
  role: "leader" | "challenger" | "other";
  voted: "for" | "against" | "absent";
  reason: string;
  /** Net relationship change toward the leader's house (-100..+100). */
  relationsDelta: number;
  /** Prestige change to this house from the vote. */
  prestigeDelta: number;
  /** Wealth change to this house from the vote. */
  wealthDelta: number;
  /** Loyalty change for members of this house. */
  loyaltyDelta: number;
  /** Mood change for members of this house. */
  moodDelta: number;
  /** Short, human-readable sentiment summary. */
  sentiment: "elated" | "pleased" | "neutral" | "uneasy" | "wronged" | "enraged";
  note: string;
}

export interface CouncilReactionLogEntry {
  id: string;
  year: number;
  tick: number;
  day: number;
  season: string;
  action: CouncilAction;
  actionLabel: string;
  title: string;
  body: string;
  tone: "good" | "bad" | "neutral";
  leaderName: string;
  leaderHouseId: ID;
  leaderHouseName: string;
  challengerHouseId: ID | null;
  challengerHouseName: string | null;
  reactions: CouncilReactionEntry[];
  reputationDeltas: Partial<ReputationProfile>;
}

export interface ResolutionOutcome {
  ok: boolean;
  title: string;
  body: string;
  prestigeDeltas: Record<ID, number>;
  wealthDeltas: Record<ID, number>;
  /** Family-id pair (a→b and b→a both applied). */
  relationsDelta: { a: ID; b: ID; delta: number } | null;
  /** Loyalty change applied to alive members of the named houses. */
  loyaltyDeltas: { leaderHouse?: number; challengerHouse?: number; all?: number };
  /** Mood change applied to alive members of the named houses. */
  moodDeltas: { leaderHouse?: number; challengerHouse?: number; all?: number };
  /** Reputation profile axis deltas (-100..100 each, clamped at store). */
  reputationDeltas: Partial<ReputationProfile>;
  resourceCost: Partial<Record<ResourceKind, number>>;
  /** Memory recorded on every adult survivor about this event. */
  memoryText: string | null;
  memoryEmotion: "trust" | "fear" | "anger" | "pride" | "grief" | "betrayal" | null;
  memoryWeight: number;
  newLeaderId: ID | null;
  tone: "good" | "bad" | "neutral";
}

const D = (deltas: Record<ID, number>, id: ID, n: number) => {
  deltas[id] = (deltas[id] ?? 0) + n;
};

const emptyOutcome = (): ResolutionOutcome => ({
  ok: true,
  title: "",
  body: "",
  prestigeDeltas: {},
  wealthDeltas: {},
  relationsDelta: null,
  loyaltyDeltas: {},
  moodDeltas: {},
  reputationDeltas: {},
  resourceCost: {},
  memoryText: null,
  memoryEmotion: null,
  memoryWeight: 0,
  newLeaderId: null,
  tone: "neutral",
});

export function resolveCouncilVote(
  ev: CouncilVoteEvent,
  action: CouncilAction,
  ctx: { resources: Record<ResourceKind, number>; leaderLeadSkill: number },
): ResolutionOutcome {
  const out = emptyOutcome();
  const chId = ev.challengerHouseId;

  switch (action) {
    case "speech": {
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
        out.loyaltyDeltas.all = 6;
        out.moodDeltas.all = 4;
        out.reputationDeltas.honest = 4;
        out.memoryText = `${ev.leaderName} spoke and the hall went quiet.`;
        out.memoryEmotion = "pride";
        out.memoryWeight = 35;
        out.tone = "good";
      } else {
        out.title = `${ev.leaderName}'s words fall flat`;
        out.body = `The hall is unmoved. The challenger gains face.`;
        D(out.prestigeDeltas, ev.leaderHouseId, -8);
        if (chId) D(out.prestigeDeltas, chId, 6);
        out.loyaltyDeltas.all = -10;
        out.moodDeltas.all = -5;
        out.memoryText = `The leader tried to talk us round. It didn't take.`;
        out.memoryEmotion = "fear";
        out.memoryWeight = 30;
        out.tone = "bad";
      }
      return out;
    }
    case "bribe": {
      const cost = COUNCIL_ACTION_INFO.bribe.cost;
      if ((ctx.resources.food ?? 0) < (cost.food ?? 0) ||
          (ctx.resources.tools ?? 0) < (cost.tools ?? 0)) {
        out.ok = false;
        out.title = "Not enough to grease the wheel";
        out.body = `A bribe needs ${cost.food} food and ${cost.tools} tools.`;
        out.tone = "bad";
        return out;
      }
      out.resourceCost = { ...cost };
      out.title = `Coin and grain change hands`;
      out.body = `The houses leave the hall with full satchels. The vote is yours — for this year.`;
      if (chId) D(out.wealthDeltas, chId, 6);
      D(out.prestigeDeltas, ev.leaderHouseId, -4);
      out.reputationDeltas.ruthless = 5;
      out.reputationDeltas.honest = -3;
      out.memoryText = `The founder bought the council with grain. Word gets out.`;
      out.memoryEmotion = "betrayal";
      out.memoryWeight = 20;
      out.loyaltyDeltas.all = -3;
      out.tone = "neutral";
      return out;
    }
    case "office": {
      if (!chId) { out.ok = false; out.title = "No challenger to placate"; out.body = ""; return out; }
      out.title = `An office for House ${ev.challengerHouseName}`;
      out.body = `${ev.challengerName} is promised a seat at the table. Ambition is fed, not crushed.`;
      D(out.prestigeDeltas, chId, 12);
      D(out.prestigeDeltas, ev.leaderHouseId, 2);
      out.relationsDelta = { a: ev.leaderHouseId, b: chId, delta: 20 };
      out.loyaltyDeltas.leaderHouse = 4;
      out.loyaltyDeltas.challengerHouse = 12;
      out.loyaltyDeltas.all = 2;
      out.moodDeltas.challengerHouse = 8;
      out.reputationDeltas.compassionate = 3;
      out.reputationDeltas.honest = 2;
      out.memoryText = `The leader made room at the table for ${ev.challengerHouseName}.`;
      out.memoryEmotion = "trust";
      out.memoryWeight = 30;
      out.tone = "good";
      return out;
    }
    case "crush": {
      const roll = Math.random() * 100;
      const target = 40 + ctx.leaderLeadSkill * 3;
      const success = roll <= target;
      if (success) {
        out.title = `The challenger is broken`;
        out.body = `House ${ev.challengerHouseName} leaves the hall in silence. No one rises against the porch this year.`;
        if (chId) {
          D(out.prestigeDeltas, chId, -25);
          D(out.wealthDeltas, chId, -10);
          out.relationsDelta = { a: ev.leaderHouseId, b: chId, delta: -40 };
        }
        D(out.prestigeDeltas, ev.leaderHouseId, -2);
        out.loyaltyDeltas.all = -8;
        out.loyaltyDeltas.challengerHouse = -25;
        out.moodDeltas.challengerHouse = -20;
        out.moodDeltas.all = -5;
        out.reputationDeltas.ruthless = 10;
        out.reputationDeltas.compassionate = -5;
        out.memoryText = `The leader crushed ${ev.challengerHouseName}. We watched in silence.`;
        out.memoryEmotion = "fear";
        out.memoryWeight = 60;
        out.tone = "neutral";
      } else {
        out.title = `The hall turns against the porch`;
        out.body = `The crackdown backfires. Other houses close ranks with the challenger.`;
        if (chId) {
          D(out.prestigeDeltas, chId, 15);
          out.relationsDelta = { a: ev.leaderHouseId, b: chId, delta: -25 };
        }
        D(out.prestigeDeltas, ev.leaderHouseId, -18);
        out.loyaltyDeltas.all = -15;
        out.moodDeltas.all = -10;
        out.reputationDeltas.ruthless = 6;
        out.reputationDeltas.honest = -4;
        out.memoryText = `The leader tried to break ${ev.challengerHouseName} — and failed.`;
        out.memoryEmotion = "anger";
        out.memoryWeight = 55;
        out.tone = "bad";
      }
      return out;
    }
    case "stepdown": {
      if (!ev.challengerHeadId || !chId) { out.ok = false; out.title = "No clear successor"; out.body = ""; return out; }
      out.title = `${ev.leaderName} steps down`;
      out.body = `The porch is given to ${ev.challengerName} of House ${ev.challengerHouseName}. The settlement watches in silence.`;
      out.newLeaderId = ev.challengerHeadId;
      D(out.prestigeDeltas, chId, 18);
      D(out.prestigeDeltas, ev.leaderHouseId, 6);
      out.relationsDelta = { a: ev.leaderHouseId, b: chId, delta: 15 };
      out.loyaltyDeltas.challengerHouse = 30;
      out.loyaltyDeltas.leaderHouse = -10;
      out.moodDeltas.all = -3;
      out.reputationDeltas.honest = 5;
      out.memoryText = `The founder's line stepped aside. The porch belongs to ${ev.challengerHouseName} now.`;
      out.memoryEmotion = "grief";
      out.memoryWeight = 70;
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

function sentimentFor(rel: number, loy: number, mood: number): CouncilReactionEntry["sentiment"] {
  const score = rel + loy + mood;
  if (score >= 25) return "elated";
  if (score >= 8) return "pleased";
  if (score <= -25) return "enraged";
  if (score <= -10) return "wronged";
  if (score <= -3) return "uneasy";
  return "neutral";
}

/** Build the per-house reaction log for an event + its resolved outcome. */
export function buildReactionLog(
  ev: CouncilVoteEvent,
  action: CouncilAction,
  outcome: ResolutionOutcome,
  meta: { tick: number; day: number; season: string },
): CouncilReactionLogEntry {
  const leaderHouseId = ev.leaderHouseId;
  const chId = ev.challengerHouseId;
  const rel = outcome.relationsDelta;

  const reactions: CouncilReactionEntry[] = ev.votes.map((v) => {
    const role: CouncilReactionEntry["role"] =
      v.familyId === leaderHouseId ? "leader" :
      chId && v.familyId === chId ? "challenger" : "other";

    // Relations toward leader's house, taken from outcome.relationsDelta.
    let relationsDelta = 0;
    if (rel) {
      if (v.familyId === rel.a && leaderHouseId === rel.b) relationsDelta = rel.delta;
      else if (v.familyId === rel.b && leaderHouseId === rel.a) relationsDelta = rel.delta;
    }

    const prestigeDelta = outcome.prestigeDeltas[v.familyId] ?? 0;
    const wealthDelta = outcome.wealthDeltas[v.familyId] ?? 0;

    const baseLoy = outcome.loyaltyDeltas.all ?? 0;
    const baseMood = outcome.moodDeltas.all ?? 0;
    const loyaltyDelta =
      baseLoy +
      (role === "leader" ? (outcome.loyaltyDeltas.leaderHouse ?? 0) : 0) +
      (role === "challenger" ? (outcome.loyaltyDeltas.challengerHouse ?? 0) : 0);
    const moodDelta =
      baseMood +
      (role === "leader" ? (outcome.moodDeltas.leaderHouse ?? 0) : 0) +
      (role === "challenger" ? (outcome.moodDeltas.challengerHouse ?? 0) : 0);

    const sentiment = sentimentFor(relationsDelta, loyaltyDelta, moodDelta);

    let note = "";
    switch (sentiment) {
      case "elated":   note = "Toasts the leader's name in the hall."; break;
      case "pleased":  note = "Nods quiet approval."; break;
      case "neutral":  note = "Keeps its counsel."; break;
      case "uneasy":   note = "Mutters in the back rows."; break;
      case "wronged":  note = "Will not forget this season."; break;
      case "enraged":  note = "Speaks openly of revenge."; break;
    }

    return {
      familyId: v.familyId,
      houseName: v.houseName,
      role,
      voted: v.forLeader ? "for" : "against",
      reason: v.reason,
      relationsDelta,
      prestigeDelta,
      wealthDelta,
      loyaltyDelta,
      moodDelta,
      sentiment,
      note,
    };
  });

  return {
    id: `crl-${ev.year}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    year: ev.year,
    tick: meta.tick,
    day: meta.day,
    season: meta.season,
    action,
    actionLabel: COUNCIL_ACTION_INFO[action].label,
    title: outcome.title,
    body: outcome.body,
    tone: outcome.tone,
    leaderName: ev.leaderName,
    leaderHouseId: ev.leaderHouseId,
    leaderHouseName: ev.leaderHouseName,
    challengerHouseId: ev.challengerHouseId,
    challengerHouseName: ev.challengerHouseName,
    reactions,
    reputationDeltas: { ...outcome.reputationDeltas },
  };
}

