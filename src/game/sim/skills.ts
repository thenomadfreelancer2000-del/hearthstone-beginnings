// THE RANCH — Skill normalization & gameplay multipliers
//
// The save-format historically stored skills as: forage, cut, mine, build,
// farm, medic, lead, social, ranch. The player-facing system is now:
//   Leadership, Building, Farming, Healing, Strength, Intelligence,
//   Finance, Social.
//
// To avoid a destructive rewrite of every consumer, the new keys live
// ALONGSIDE the legacy keys and are kept in sync. UI surfaces the new
// names; simulation code can continue to read the legacy keys until
// it migrates. `syncSkills` makes both views consistent in O(1) and
// must be called whenever a Skills object is created or mutated.

import type { Skills, Survivor } from "../types";

const CAP = 30;

function clamp(v: number): number {
  return Math.min(CAP, Math.max(0, v));
}

/**
 * Mirror legacy <-> modern skill fields so every consumer sees a coherent
 * value. Mutates in place and returns the same object.
 *
 * Mapping:
 *   leadership ⇄ lead
 *   building   ⇄ build
 *   farming    ⇄ farm (also feeds ranch)
 *   healing    ⇄ medic
 *   strength   ⇄ max(cut, mine, forage)
 *   social     ⇄ social
 *   intelligence — new, default 1
 *   finance      — new, default 1
 */
export function syncSkills(s: Skills): Skills {
  // Ensure all legacy keys exist
  s.forage = s.forage ?? 1;
  s.cut = s.cut ?? 1;
  s.mine = s.mine ?? 1;
  s.build = s.build ?? 1;
  s.farm = s.farm ?? 1;
  s.medic = s.medic ?? 1;
  s.lead = s.lead ?? 1;
  s.social = s.social ?? 1;
  s.ranch = s.ranch ?? 1;

  // Pick max(legacy, modern) so growth on either side is preserved.
  const leadership = Math.max(s.leadership ?? 0, s.lead);
  const building = Math.max(s.building ?? 0, s.build);
  const farming = Math.max(s.farming ?? 0, s.farm, s.ranch ?? 0);
  const healing = Math.max(s.healing ?? 0, s.medic);
  const strength = Math.max(
    s.strength ?? 0,
    s.cut,
    s.mine,
    s.forage,
  );

  s.leadership = clamp(leadership);
  s.building = clamp(building);
  s.farming = clamp(farming);
  s.healing = clamp(healing);
  s.strength = clamp(strength);
  s.intelligence = clamp(s.intelligence ?? 1);
  s.finance = clamp(s.finance ?? 1);

  // Push back to legacy fields so existing sim code keeps working.
  s.lead = s.leadership;
  s.build = s.building;
  s.farm = s.farming;
  s.ranch = s.farming;
  s.medic = s.healing;
  s.cut = s.strength;
  s.mine = s.strength;
  s.forage = s.strength;
  s.social = clamp(s.social);

  return s;
}

/** Intelligence acts as a learning-rate multiplier (1.0 at int=1 → 2.0 at int=30). */
export function learningRate(s: Skills): number {
  const i = s.intelligence ?? 1;
  return 1 + (i / 30) * 1.0;
}

/** Bump one of the modern skills (and the legacy mirror) by `amount`. */
export function bumpSkill(
  s: Skills,
  key:
    | "leadership"
    | "building"
    | "farming"
    | "healing"
    | "strength"
    | "intelligence"
    | "finance"
    | "social",
  amount: number,
): void {
  const cur = (s as any)[key] ?? 1;
  (s as any)[key] = clamp(cur + amount);
  syncSkills(s);
}

/** One-shot migration helper for save files / freshly created survivors. */
export function ensureSurvivorSkills(sv: Survivor): void {
  if (!sv.skills) {
    sv.skills = {
      forage: 1, cut: 1, mine: 1, build: 1, farm: 1, medic: 1, lead: 1, social: 1,
    } as Skills;
  }
  syncSkills(sv.skills);
}
