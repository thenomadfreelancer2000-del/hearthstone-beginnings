// Political factions of the ranch.
//
// Factions are emergent — every survivor is sorted into 0..2 factions by their
// traits, and each enacted law shifts faction sentiment. Faction strength is
// member count weighted by their family's prestige.

import type { Family, ID, Survivor, Trait } from "../types";
import type { EnactedLaw, FactionId, LawDef } from "./laws";
import { getLawDef } from "./laws";

export interface FactionDef {
  id: FactionId;
  name: string;
  motto: string;
  /** Traits that draw a survivor into the faction; weight = pull strength. */
  traitPull: Partial<Record<Trait, number>>;
  /** Plain-language agenda summary. */
  agenda: string;
}

export const FACTION_DEFS: Record<FactionId, FactionDef> = {
  traditionalists: {
    id: "traditionalists",
    name: "The Old Hearth",
    motto: "What our fathers held, we keep.",
    traitPull: { Traditional: 4, Loyal: 2, Principled: 2, Quiet: 1, Honest: 1 },
    agenda: "Custom, inheritance, the founder's bloodline.",
  },
  reformists: {
    id: "reformists",
    name: "The New Road",
    motto: "The ranch can be more.",
    traitPull: { Idealistic: 4, Curious: 3, Ambitious: 2, Independent: 2, Honest: 1 },
    agenda: "Open council, free vows, change in the long room.",
  },
  hawks: {
    id: "hawks",
    name: "The Iron Fence",
    motto: "Strength keeps the fence.",
    traitPull: { Aggressive: 4, Paranoid: 3, Brave: 2, Loyal: 1 },
    agenda: "Hard punishment, closed borders, strong leadership.",
  },
  merchants: {
    id: "merchants",
    name: "The Tally Stick",
    motto: "What I earn, I keep.",
    traitPull: { Greedy: 4, Ambitious: 3, Independent: 2, Curious: 1 },
    agenda: "Free trade, light tithe, private wealth.",
  },
  commons: {
    id: "commons",
    name: "The Open Hand",
    motto: "No one eats alone.",
    traitPull: { Compassionate: 4, Generous: 3, Friendly: 2, Idealistic: 2 },
    agenda: "Hospitality, common stores, mercy in justice.",
  },
};

const FACTION_LIST: FactionId[] = ["traditionalists", "reformists", "hawks", "merchants", "commons"];

export interface SurvivorFactionAffinity {
  survivorId: ID;
  /** Sorted desc; first entry is primary affiliation when score >= 3. */
  scores: { faction: FactionId; score: number }[];
  primary: FactionId | null;
  secondary: FactionId | null;
}

export function affinityFor(s: Survivor): SurvivorFactionAffinity {
  // Children and teens have no political affiliation yet.
  if (s.stage === "child" || s.stage === "teen") {
    return { survivorId: s.id, scores: [], primary: null, secondary: null };
  }
  const scores: { faction: FactionId; score: number }[] = [];
  for (const fid of FACTION_LIST) {
    let score = 0;
    const pull = FACTION_DEFS[fid].traitPull;
    for (const t of s.traits ?? []) score += pull[t] ?? 0;
    if (score > 0) scores.push({ faction: fid, score });
  }
  scores.sort((a, b) => b.score - a.score);
  const primary = scores[0]?.score >= 3 ? scores[0].faction : null;
  const secondary = scores[1]?.score >= 3 ? scores[1].faction : null;
  return { survivorId: s.id, scores, primary, secondary };
}

export interface FactionSnapshot {
  id: FactionId;
  def: FactionDef;
  /** Member count (primary affiliations). */
  members: number;
  /** Sympathizers — secondary affiliations. */
  sympathizers: number;
  /** Strength 0..100, prestige-weighted. */
  strength: number;
  /** Family ids with the most members in this faction (top 3). */
  leadingHouseIds: ID[];
  leadingHouseNames: string[];
  /** Faction "leader" — head/oldest adult of the most influential supporting house. */
  leaderId: ID | null;
  leaderName: string | null;
  /** Average mood drift across members caused by the active laws. */
  netLawSentiment: number;
  /** Laws this faction loves / hates that are currently enacted. */
  lovedLaws: { lawId: string; title: string }[];
  hatedLaws: { lawId: string; title: string }[];
}

export interface FactionsView {
  factions: FactionSnapshot[];
  /** Every survivor's affinity, keyed by survivor id. */
  affinity: Record<ID, SurvivorFactionAffinity>;
}

export function computeFactions(
  survivors: Survivor[],
  families: Family[],
  enacted: EnactedLaw[],
): FactionsView {
  const alive = survivors.filter((s) => s.health > 0);
  const affinity: Record<ID, SurvivorFactionAffinity> = {};
  for (const s of alive) affinity[s.id] = affinityFor(s);

  const familyById = new Map(families.map((f) => [f.id, f]));
  const lawDefs = enacted
    .map((e) => getLawDef(e.lawId))
    .filter((x): x is LawDef => !!x);

  const snapshots: FactionSnapshot[] = FACTION_LIST.map((fid) => {
    const def = FACTION_DEFS[fid];
    let members = 0;
    let sympathizers = 0;
    let strengthRaw = 0;
    const houseMemberCount = new Map<ID, number>();

    for (const s of alive) {
      const aff = affinity[s.id];
      if (!aff) continue;
      const isPrimary = aff.primary === fid;
      const isSecondary = aff.secondary === fid;
      if (!isPrimary && !isSecondary) continue;
      if (isPrimary) members++;
      else sympathizers++;
      const fam = familyById.get(s.familyId);
      const weight = (1 + (fam?.prestige ?? 0) / 60) * (isPrimary ? 1 : 0.4);
      strengthRaw += weight;
      houseMemberCount.set(s.familyId, (houseMemberCount.get(s.familyId) ?? 0) + (isPrimary ? 1 : 0.4));
    }

    const totalAlive = Math.max(1, alive.length);
    const strength = Math.round(Math.min(100, (strengthRaw / totalAlive) * 110));

    const leadingHouses = [...houseMemberCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([fid2]) => fid2);
    const leadingHouseNames = leadingHouses
      .map((fid2) => familyById.get(fid2)?.name ?? "—");

    // Leader: head of the strongest supporting family, else any primary member.
    let leaderId: ID | null = null;
    let leaderName: string | null = null;
    const topHouseId = leadingHouses[0];
    if (topHouseId) {
      const topFam = familyById.get(topHouseId);
      // Family head = oldest living adult in that family, preferring known founderId.
      const founderAlive = topFam ? alive.find((x) => x.id === topFam.founderId) : null;
      const candidate = founderAlive ?? alive
        .filter((s) => s.familyId === topHouseId && affinity[s.id]?.primary === fid)
        .sort((a, b) => b.age - a.age)[0]
        ?? null;
      if (candidate) {
        leaderId = candidate.id;
        leaderName = `${candidate.name} ${candidate.surname}`;
      }
    }

    const lovedLaws = lawDefs
      .filter((l) => l.factionLikes.includes(fid))
      .map((l) => ({ lawId: l.id, title: l.title }));
    const hatedLaws = lawDefs
      .filter((l) => l.factionHates.includes(fid))
      .map((l) => ({ lawId: l.id, title: l.title }));
    const netLawSentiment = lovedLaws.length * 12 - hatedLaws.length * 14;

    return {
      id: fid,
      def,
      members,
      sympathizers,
      strength,
      leadingHouseIds: leadingHouses,
      leadingHouseNames,
      leaderId,
      leaderName,
      netLawSentiment,
      lovedLaws,
      hatedLaws,
    };
  });

  snapshots.sort((a, b) => b.strength - a.strength);
  return { factions: snapshots, affinity };
}

/** Find the most-opposed enacted law given the current factions and laws. */
export function mostHatedLaw(
  view: FactionsView,
  enacted: EnactedLaw[],
): { lawId: string; lawDef: LawDef; opposingFaction: FactionSnapshot; intensity: number } | null {
  const list = pressingLawDemands(view, enacted, { repealOnly: true, threshold: 18 });
  const top = list.find((d) => d.kind === "repeal");
  if (!top || !top.lawDef) return null;
  return {
    lawId: top.lawId,
    lawDef: top.lawDef,
    opposingFaction: top.faction,
    intensity: top.intensity,
  };
}

// ── Pressing demands (drives council dilemmas) ───────────────────

import { LAW_CATALOG } from "./laws";

export interface LawDemand {
  kind: "repeal" | "enact";
  lawId: string;
  lawDef: LawDef;
  faction: FactionSnapshot;
  /** Sorting weight — higher = more politically urgent. */
  intensity: number;
  /** Short, plain-language demand line. */
  pitch: string;
}

/**
 * Returns ranked political demands the council brings before the founder.
 *
 * Repeal demands — a strong faction wants an active law struck.
 * Enact demands  — a strong faction wants a beloved law written into the book.
 *
 * The dilemma: every demand has at least one rival faction that will resent
 * conceding to it. The founder can only address one demand per council; the
 * rest hang in the air and intensify if ignored.
 */
export function pressingLawDemands(
  view: FactionsView,
  enacted: EnactedLaw[],
  opts: { repealOnly?: boolean; threshold?: number } = {},
): LawDemand[] {
  const threshold = opts.threshold ?? 18;
  const demands: LawDemand[] = [];
  const enactedIds = new Set(enacted.map((e) => e.lawId));
  const enactedDomains = new Set(enacted.map((e) => getLawDef(e.lawId)?.domain).filter(Boolean));

  // ── Repeal demands ──
  for (const e of enacted) {
    const def = getLawDef(e.lawId);
    if (!def) continue;
    for (const f of view.factions) {
      if (!def.factionHates.includes(f.id)) continue;
      if (f.strength < threshold) continue;
      demands.push({
        kind: "repeal",
        lawId: def.id,
        lawDef: def,
        faction: f,
        intensity: f.strength + f.members * 2,
        pitch: `${f.def.name} demand: strike "${def.title}"`,
      });
    }
  }

  if (opts.repealOnly) {
    demands.sort((a, b) => b.intensity - a.intensity);
    return demands;
  }

  // ── Enact demands — only after the charter is signed ──
  if (enacted.length > 0) {
    for (const def of LAW_CATALOG) {
      if (enactedIds.has(def.id)) continue;
      // Avoid pushing a second law into a domain that already has one — those
      // are competing options, not gaps.
      if (enactedDomains.has(def.domain)) continue;
      for (const f of view.factions) {
        if (!def.factionLikes.includes(f.id)) continue;
        if (f.strength < threshold + 8) continue; // enact bar is a touch higher
        demands.push({
          kind: "enact",
          lawId: def.id,
          lawDef: def,
          faction: f,
          intensity: f.strength + f.members,
          pitch: `${f.def.name} demand: write "${def.title}" into law`,
        });
      }
    }
  }

  // Deduplicate by (kind, lawId) — keep the strongest sponsoring faction.
  const byKey = new Map<string, LawDemand>();
  for (const d of demands) {
    const key = `${d.kind}:${d.lawId}`;
    const existing = byKey.get(key);
    if (!existing || d.intensity > existing.intensity) byKey.set(key, d);
  }

  return [...byKey.values()].sort((a, b) => b.intensity - a.intensity);
}

