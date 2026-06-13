// Personality trait catalog. Each survivor carries 2–4 of these.
// Traits drive: work speed, opinion drift, marriage matchmaking, refugee
// reaction. Save-safe: traits are stored as plain strings.

import type { Trait } from "../types";

export type TraitTier = "positive" | "neutral" | "negative";

export interface TraitInfo {
  name: Trait;
  tier: TraitTier;
  blurb: string;
  /** Traits that cannot coexist on the same survivor. */
  opposites?: Trait[];
  /** Multiplier on physical work output (1.0 = baseline). */
  workSpeed?: number;
  /** Daily opinion drift added to relationships with everyone. */
  opinionBias?: number;
  /** Affects marriage compatibility scoring. */
  marriageWeight?: number;
  /** Mood swing when the founder accepts/rejects refugees (positive = pro-accept). */
  refugeeBias?: number;
  /** How strongly they seek out social contact. */
  socialPull?: number;
}

export const TRAIT_CATALOG: TraitInfo[] = [
  // ── Positive ─────────────────────────────────────────────
  { name: "Hardworking",   tier: "positive", blurb: "Finishes what they start. Resents idleness in others.", opposites: ["Lazy"], workSpeed: 1.2, marriageWeight: 4 },
  { name: "Loyal",         tier: "positive", blurb: "Slow to change allegiances. Defends allies at cost.", marriageWeight: 6 },
  { name: "Compassionate", tier: "positive", blurb: "Feels the suffering of strangers as their own.", opposites: ["Selfish"], refugeeBias: 12, marriageWeight: 3 },
  { name: "Brave",         tier: "positive", blurb: "Volunteers for danger. Confronts problems directly.", opposites: ["Cowardly"], workSpeed: 1.05, marriageWeight: 3 },
  { name: "Honest",        tier: "positive", blurb: "Will not lie, even when it would be kinder.", opposites: ["Greedy"], opinionBias: 1, marriageWeight: 2 },
  { name: "Friendly",      tier: "positive", blurb: "Warms to strangers. Easy laughter.", opposites: ["Aggressive"], opinionBias: 2, socialPull: 1.4, marriageWeight: 4 },
  { name: "Generous",      tier: "positive", blurb: "Shares freely. Builds trust through gifts.", opposites: ["Greedy", "Selfish"], refugeeBias: 6 },
  { name: "Principled",    tier: "positive", blurb: "Will not act against stated values, whatever the cost.", opinionBias: 1 },
  { name: "Idealistic",    tier: "positive", blurb: "Believes in the collective good. Easily disillusioned.", refugeeBias: 8 },
  { name: "Ambitious",     tier: "positive", blurb: "Seeks advancement. Resents being passed over.", workSpeed: 1.08 },

  // ── Neutral ──────────────────────────────────────────────
  { name: "Quiet",         tier: "neutral",  blurb: "Speaks little. Listens more.", socialPull: 0.6 },
  { name: "Curious",       tier: "neutral",  blurb: "Wanders, asks, wonders.", socialPull: 1.1 },
  { name: "Independent",   tier: "neutral",  blurb: "Prefers their own counsel to a council's.", socialPull: 0.7 },
  { name: "Traditional",   tier: "neutral",  blurb: "Resists change. Values custom and precedent." },
  { name: "Paranoid",      tier: "neutral",  blurb: "Sees threats in neutral events. Builds personal security.", opinionBias: -1 },

  // ── Negative ─────────────────────────────────────────────
  { name: "Lazy",          tier: "negative", blurb: "Saves their strength for nothing in particular.", opposites: ["Hardworking"], workSpeed: 0.75 },
  { name: "Greedy",        tier: "negative", blurb: "Accumulates. Resists redistribution.", opposites: ["Generous", "Honest"], opinionBias: -1, refugeeBias: -6 },
  { name: "Aggressive",    tier: "negative", blurb: "Quick to anger. Slower to forget it.", opposites: ["Friendly"], opinionBias: -2, marriageWeight: -3 },
  { name: "Jealous",       tier: "negative", blurb: "Resents the fortune of others.", opinionBias: -1 },
  { name: "Selfish",       tier: "negative", blurb: "Self before settlement.", opposites: ["Compassionate", "Generous"], refugeeBias: -10 },
  { name: "Cowardly",      tier: "negative", blurb: "Avoids any risk, however small.", opposites: ["Brave"], workSpeed: 0.92 },
  { name: "Bitter",        tier: "negative", blurb: "Holds grudges. Interprets through past injustice.", opinionBias: -2 },
];

export const TRAIT_INFO: Record<string, TraitInfo> =
  Object.fromEntries(TRAIT_CATALOG.map((t) => [t.name, t]));

export const ALL_TRAITS: Trait[] = TRAIT_CATALOG.map((t) => t.name);
export const POSITIVE_TRAITS: Trait[] = TRAIT_CATALOG.filter(t => t.tier === "positive").map(t => t.name);
export const NEUTRAL_TRAITS:  Trait[] = TRAIT_CATALOG.filter(t => t.tier === "neutral").map(t => t.name);
export const NEGATIVE_TRAITS: Trait[] = TRAIT_CATALOG.filter(t => t.tier === "negative").map(t => t.name);

export const TRAIT_BLURBS: Record<string, string> =
  Object.fromEntries(TRAIT_CATALOG.map((t) => [t.name, t.blurb]));

export function traitInfo(t: Trait): TraitInfo | undefined {
  return TRAIT_INFO[t];
}

export function traitTier(t: Trait): TraitTier {
  return TRAIT_INFO[t]?.tier ?? "neutral";
}

export function areOpposed(a: Trait, b: Trait): boolean {
  return !!(TRAIT_INFO[a]?.opposites?.includes(b) || TRAIT_INFO[b]?.opposites?.includes(a));
}

/** Roll 2–4 traits, biased toward positive, never picking opposites together. */
export function pickTraits(rng: () => number, target = 3): Trait[] {
  const n = Math.max(2, Math.min(4, target));
  const out: Trait[] = [];
  for (let i = 0; i < 24 && out.length < n; i++) {
    const r = rng();
    const pool = r < 0.5 ? POSITIVE_TRAITS : r < 0.8 ? NEUTRAL_TRAITS : NEGATIVE_TRAITS;
    const candidate = pool[Math.floor(rng() * pool.length)];
    if (!candidate) continue;
    if (out.includes(candidate)) continue;
    if (out.some(t => areOpposed(t, candidate))) continue;
    out.push(candidate);
  }
  while (out.length < 2) {
    const c = POSITIVE_TRAITS[Math.floor(rng() * POSITIVE_TRAITS.length)];
    if (!out.includes(c) && !out.some(t => areOpposed(t, c))) out.push(c);
  }
  return out;
}

/** Combined work-speed multiplier from all traits. */
export function traitWorkSpeed(traits: Trait[] | undefined): number {
  if (!traits) return 1;
  return traits.reduce((m, t) => m * (TRAIT_INFO[t]?.workSpeed ?? 1), 1);
}

/** Per-interaction opinion drift bias between two survivors. */
export function traitPairBias(a: Trait[] | undefined, b: Trait[] | undefined): number {
  if (!a || !b) return 0;
  let bias = 0;
  for (const ta of a) {
    for (const tb of b) {
      if (ta === tb) bias += 0.5;
      if (areOpposed(ta, tb)) bias -= 1.2;
    }
  }
  for (const ta of a) bias += (TRAIT_INFO[ta]?.opinionBias ?? 0) * 0.3;
  return bias;
}

/** Mood reaction to founder accepting (+) or rejecting (-) refugees. */
export function traitRefugeeBias(traits: Trait[] | undefined): number {
  if (!traits) return 0;
  return traits.reduce((m, t) => m + (TRAIT_INFO[t]?.refugeeBias ?? 0), 0);
}

/** Compatibility score for matchmaking between two adults. */
export function traitMarriageScore(a: Trait[] | undefined, b: Trait[] | undefined): number {
  if (!a || !b) return 0;
  let s = 0;
  for (const ta of a) s += TRAIT_INFO[ta]?.marriageWeight ?? 0;
  for (const tb of b) s += TRAIT_INFO[tb]?.marriageWeight ?? 0;
  // Opposites tank compatibility.
  for (const ta of a) for (const tb of b) if (areOpposed(ta, tb)) s -= 6;
  return s;
}
