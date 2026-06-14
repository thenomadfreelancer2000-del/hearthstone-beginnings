// Expedition system — sending parties beyond the ranch in search of resources,
// people, animals, knowledge, and stories. Self-contained and pure: takes a
// snapshot, returns mutations the store applies.

import { nanoid } from "nanoid";
import type {
  Animal, AnimalSpecies, ChronicleEntry, Family, ID, ResourceKind, Survivor,
} from "../types";
import { makeRng } from "./rng";
import { makeWanderer, makeWandererFamily } from "./world";

export const TICKS_PER_DAY = 24;

export type ExpeditionStatus = "planned" | "active" | "complete";

export type ExpeditionFateKind =
  | "ok" | "minor-injury" | "major-injury" | "illness" | "disabled" | "dead";

export interface ExpeditionMemberFate {
  survivorId: ID;
  name: string;
  fate: ExpeditionFateKind;
  prestigeGain: number;        // contributes to leader's family prestige + survivor mood
  story: string;
}

export interface ExpeditionReward {
  resources: Partial<Record<ResourceKind, number>>;
  animals: { species: AnimalSpecies; count: number }[];
  newCrops: string[];
  recruits: number;
  locationName: string | null;
  prestigeForLeaderHouse: number;
}

export type ExpeditionTone = "triumph" | "loss" | "mixed" | "quiet";

export interface ExpeditionStory {
  title: string;
  body: string;
  tone: ExpeditionTone;
  highlights: string[];
}

export interface Expedition {
  id: ID;
  leaderId: ID;
  leaderName: string;
  leaderFamilyId: ID;
  memberIds: ID[];
  memberNames: string[];
  supplies: number;
  durationDays: number;
  startTick: number;
  returnTick: number;
  startedYear: number;
  startedDay: number;
  startedSeason: string;
  forecast: ExpeditionForecast;
  status: ExpeditionStatus;
  story?: ExpeditionStory;
  fates?: ExpeditionMemberFate[];
  reward?: ExpeditionReward;
  resolvedYear?: number;
}

export interface ExpeditionForecast {
  successChance: number; // 0..100
  dangerLevel: number;   // 0..100
  supplyConsumption: number; // total food expected
  estimatedReturnDays: number;
  teamStrength: number;  // arbitrary 0..100 scale
}

export interface ExpeditionPlanInput {
  leaderId: ID;
  memberIds: ID[]; // includes leader
  supplies: number;
  durationDays: number;
}

// ── Forecasting ──────────────────────────────────────────────────────

export function teamStrength(members: Survivor[]): number {
  if (members.length === 0) return 0;
  let s = 0;
  for (const m of members) {
    const survival = (m.skills.forage ?? 1) * 1.3;
    const farming  = (m.skills.farm ?? 1) * 0.6;
    const building = (m.skills.build ?? 1) * 0.6;
    const medicine = (m.skills.medic ?? 1) * 1.2;
    const social   = (m.skills.social ?? 1) * 0.8;
    const leadership = (m.skills.lead ?? 1) * 0.6;
    const healthMod = m.health / 100;
    const stageMod =
      m.stage === "adult" ? 1 :
      m.stage === "youth" ? 0.85 :
      m.stage === "elder" ? 0.7 :
      m.stage === "teen"  ? 0.55 : 0;
    s += (survival + farming + building + medicine + social + leadership) * healthMod * stageMod;
  }
  return Math.round(s);
}

export function forecastExpedition(
  members: Survivor[],
  leader: Survivor | undefined,
  supplies: number,
  durationDays: number,
): ExpeditionForecast {
  const ts = teamStrength(members);
  const leadBonus = leader ? (leader.skills.lead ?? 1) * 3 : 0;
  // Each member eats ~1 food/day. Anything less raises danger.
  const expectedFood = members.length * durationDays * 1;
  const supplyRatio = expectedFood > 0 ? Math.min(2, supplies / expectedFood) : 1;
  // Success: scales with team strength + leadership + supplies, falls with duration.
  const base = 30 + Math.min(50, ts) + leadBonus + (supplyRatio - 1) * 25;
  const durationPenalty = Math.max(0, durationDays - 7) * 2;
  const success = Math.max(5, Math.min(95, Math.round(base - durationPenalty)));
  // Danger: rises with duration, falls with strength and supplies.
  const danger = Math.max(5, Math.min(95, Math.round(
    20 + durationDays * 3 - ts * 0.6 + (1 - supplyRatio) * 30
  )));
  return {
    successChance: success,
    dangerLevel: danger,
    supplyConsumption: Math.round(expectedFood),
    estimatedReturnDays: durationDays,
    teamStrength: ts,
  };
}

// ── Resolution ───────────────────────────────────────────────────────

const POSSIBLE_LOCATIONS = [
  "an abandoned homestead", "a quiet lake", "a wind-scoured ruin",
  "a forest hollow", "a forgotten orchard", "a stranger's old farm",
  "a wagon-broken trail", "a half-buried granary", "a creekside camp",
];

const POSSIBLE_CROPS = ["wheat", "potatoes", "barley", "beans", "squash"];

export interface ResolveInput {
  expedition: Expedition;
  members: Survivor[]; // current state (only living)
  founderId: ID;
  currentYear: number;
  currentTick: number;
  currentSeason: string;
  currentDay: number;
  unlockedCrops: string[];
}

export interface ResolveOutput {
  story: ExpeditionStory;
  fates: ExpeditionMemberFate[];
  reward: ExpeditionReward;
  newSurvivors: Survivor[];
  newFamilies: Family[];
  newAnimals: Animal[];
  chronicleEntry: ChronicleEntry;
}

export function resolveExpedition(input: ResolveInput): ResolveOutput {
  const { expedition, members, currentYear, currentSeason, currentDay, currentTick } = input;
  const rng = makeRng((expedition.startTick ^ expedition.returnTick ^ 0xEAD9) >>> 0);

  const ts = teamStrength(members);
  void ts;
  const successRoll = rng() * 100;
  // Effective success: 0..100
  const eff = Math.min(100, Math.max(0,
    expedition.forecast.successChance + (rng() - 0.5) * 20,
  ));
  const succeeded = successRoll < eff;
  const dangerEff = expedition.forecast.dangerLevel;

  // Per-member fate roll.
  const fates: ExpeditionMemberFate[] = members.map((m) => {
    const roll = rng() * 100;
    // Higher danger -> worse fate. Better survival skill -> better fate.
    const survivalMod = (m.skills.forage ?? 1) * 1.5 + (m.skills.medic ?? 1);
    const threshold = dangerEff - survivalMod * 2 - (succeeded ? 5 : -15);
    let fate: ExpeditionFateKind = "ok";
    if (roll < threshold - 35) fate = "dead";
    else if (roll < threshold - 22) fate = "disabled";
    else if (roll < threshold - 12) fate = "major-injury";
    else if (roll < threshold - 4) fate = "illness";
    else if (roll < threshold + 4) fate = "minor-injury";

    const gain = fate === "ok"
      ? (succeeded ? 4 + Math.floor(rng() * 4) : 1)
      : fate === "dead" ? 0 : Math.max(0, 2 - (fate === "disabled" ? 2 : 1));

    const story =
      fate === "dead" ? "fell on the road and did not rise" :
      fate === "disabled" ? "returned changed — a limb that will not heal" :
      fate === "major-injury" ? "limped home, bound and pale" :
      fate === "illness" ? "took fever on the road and walks slow" :
      fate === "minor-injury" ? "came back bandaged but standing" :
      succeeded ? "returned hale and full of stories" : "returned weary and quiet";
    return {
      survivorId: m.id,
      name: `${m.name} ${m.surname}`,
      fate,
      prestigeGain: gain,
      story,
    };
  });

  const anyDead = fates.some((f) => f.fate === "dead");
  const allDead = fates.every((f) => f.fate === "dead");

  // Rewards scale with success and team strength.
  const reward: ExpeditionReward = {
    resources: {},
    animals: [],
    newCrops: [],
    recruits: 0,
    locationName: null,
    prestigeForLeaderHouse: 0,
  };

  const tone: ExpeditionTone =
    allDead ? "loss" :
    succeeded && !anyDead ? "triumph" :
    succeeded && anyDead ? "mixed" :
    anyDead ? "loss" : "quiet";

  const highlights: string[] = [];

  if (!allDead) {
    const scale = (succeeded ? 1.0 : 0.35) * (0.6 + ts / 80);

    const addRes = (k: ResourceKind, max: number) => {
      const amt = Math.max(0, Math.round((rng() * max + max * 0.3) * scale));
      if (amt > 0) {
        reward.resources[k] = (reward.resources[k] ?? 0) + amt;
        return amt;
      }
      return 0;
    };

    // Always-on chance of basic resources.
    const food = addRes("food", 18);
    if (food > 0) highlights.push(`+${food} food`);
    const wood = addRes("wood", 14);
    if (wood > 0) highlights.push(`+${wood} wood`);
    if (rng() < 0.5 * scale) { const s = addRes("stone", 10); if (s) highlights.push(`+${s} stone`); }
    if (rng() < 0.4 * scale) { const w = addRes("water", 16); if (w) highlights.push(`+${w} water`); }
    if (rng() < 0.25 * scale) { const t = addRes("tools", 2); if (t) highlights.push(`+${t} tools`); }
    if (rng() < 0.2 * scale)  { const f = addRes("fiber", 8); if (f) highlights.push(`+${f} fiber`); }

    // Animals.
    if (rng() < 0.35 * scale) {
      const species: AnimalSpecies = (["chicken", "goat", "sheep", "cattle"] as AnimalSpecies[])[Math.floor(rng() * 4)];
      const count = species === "chicken" ? 1 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 2);
      reward.animals.push({ species, count });
      highlights.push(`${count} ${species}${count > 1 ? "s" : ""}`);
    }

    // Crops knowledge.
    if (rng() < 0.25 * scale) {
      const candidate = POSSIBLE_CROPS[Math.floor(rng() * POSSIBLE_CROPS.length)];
      if (!input.unlockedCrops.includes(candidate)) {
        reward.newCrops.push(candidate);
        highlights.push(`new crop: ${candidate}`);
      }
    }

    // Recruits.
    if (rng() < 0.35 * scale) {
      reward.recruits = 1 + Math.floor(rng() * 3);
      highlights.push(`${reward.recruits} new soul${reward.recruits > 1 ? "s" : ""}`);
    }

    // Discovered location.
    if (rng() < 0.5) {
      reward.locationName = POSSIBLE_LOCATIONS[Math.floor(rng() * POSSIBLE_LOCATIONS.length)];
      highlights.push(`discovered ${reward.locationName}`);
    }

    reward.prestigeForLeaderHouse = succeeded ? 4 + Math.floor(rng() * 6) : 1;
  }

  // Generate recruit survivors + their family.
  const newSurvivors: Survivor[] = [];
  const newFamilies: Family[] = [];
  if (reward.recruits > 0) {
    const recRng = makeRng((expedition.returnTick ^ 0xFEED) >>> 0);
    const spawn = { x: 90, y: 70 };
    for (let i = 0; i < reward.recruits; i++) {
      const w = makeWanderer(recRng, spawn, currentTick, currentYear);
      w.loyaltyToFounder = 35 + Math.floor(recRng() * 30);
      w.arrivalTick = currentTick;
      newSurvivors.push(w);
    }
    // Group them into a single family with the first as head.
    if (newSurvivors.length > 0) {
      const head = newSurvivors[0];
      const fam = makeWandererFamily(head, currentYear);
      head.familyId = fam.id;
      for (let i = 1; i < newSurvivors.length; i++) {
        newSurvivors[i].familyId = fam.id;
        fam.memberIds.push(newSurvivors[i].id);
      }
      newFamilies.push(fam);
    }
  }

  // Animals get instantiated by the store (so it can pick a pen / owner family).
  const newAnimals: Animal[] = [];

  // Story copy.
  const title = buildTitle(expedition, tone, reward, fates);
  const body = buildBody(expedition, tone, succeeded, fates, reward);
  const story: ExpeditionStory = { title, body, tone, highlights };

  const chronicleEntry: ChronicleEntry = {
    id: nanoid(8),
    tick: currentTick,
    year: currentYear,
    season: currentSeason as ChronicleEntry["season"],
    day: currentDay,
    category: "event",
    title,
    body,
    involvedIds: [expedition.leaderId, ...expedition.memberIds.filter((id) => id !== expedition.leaderId)],
  };

  return { story, fates, reward, newSurvivors, newFamilies, newAnimals, chronicleEntry };
}

function buildTitle(
  ex: Expedition,
  tone: ExpeditionTone,
  reward: ExpeditionReward,
  fates: ExpeditionMemberFate[],
): string {
  const dead = fates.filter((f) => f.fate === "dead").length;
  if (tone === "loss" && dead === fates.length) {
    return `Expedition Lost — ${ex.leaderName}'s party did not return`;
  }
  if (tone === "loss") {
    return `Expedition Returns Bloodied — ${dead} lost`;
  }
  if (tone === "triumph") {
    if (reward.locationName) return `${ex.leaderName} Discovered ${reward.locationName}`;
    if (reward.recruits > 0) return `${ex.leaderName} Brought ${reward.recruits} Home`;
    return `${ex.leaderName} Led a Successful Expedition`;
  }
  if (tone === "mixed") return `${ex.leaderName}'s Expedition Returned at a Cost`;
  return `${ex.leaderName}'s Expedition Returned Quiet-Handed`;
}

function buildBody(
  ex: Expedition,
  tone: ExpeditionTone,
  succeeded: boolean,
  fates: ExpeditionMemberFate[],
  reward: ExpeditionReward,
): string {
  const dead = fates.filter((f) => f.fate === "dead");
  const hurt = fates.filter((f) => f.fate !== "ok" && f.fate !== "dead");
  const parts: string[] = [];
  parts.push(`${ex.memberIds.length} set out for ${ex.durationDays} days under ${ex.leaderName}.`);
  if (succeeded) parts.push(`They came back with stories.`);
  else parts.push(`They came back with little.`);
  if (reward.locationName) parts.push(`The party found ${reward.locationName}.`);
  if (reward.recruits > 0) parts.push(`${reward.recruits} stranger${reward.recruits > 1 ? "s" : ""} walked home with them.`);
  if (reward.animals.length > 0) {
    parts.push(`Livestock returned with the party: ${reward.animals.map(a => `${a.count} ${a.species}${a.count > 1 ? "s" : ""}`).join(", ")}.`);
  }
  if (reward.newCrops.length > 0) parts.push(`They learned to grow ${reward.newCrops.join(", ")}.`);
  if (dead.length > 0) parts.push(`The dead: ${dead.map(d => d.name).join(", ")}.`);
  if (hurt.length > 0) parts.push(`The wounded: ${hurt.map(d => d.name).join(", ")}.`);
  void tone;
  return parts.join(" ");
}

// Apply fate to a survivor (returns mutated copy).
export function applyFateToSurvivor(
  s: Survivor,
  fate: ExpeditionMemberFate,
  currentTick: number,
  currentYear: number,
): Survivor {
  let health = s.health;
  let deathTick: number | null | undefined = s.deathTick;
  let deathYear: number | null | undefined = s.deathYear;
  let mood = s.mood;
  let loyalty = s.loyaltyToFounder;
  const ach = s.achievements ? [...s.achievements] : [];

  switch (fate.fate) {
    case "dead":
      health = 0; deathTick = currentTick; deathYear = currentYear; break;
    case "disabled":
      health = Math.max(20, health - 50); mood -= 20; break;
    case "major-injury":
      health = Math.max(25, health - 35); mood -= 12; break;
    case "illness":
      health = Math.max(35, health - 20); mood -= 6; break;
    case "minor-injury":
      health = Math.max(50, health - 10); break;
    case "ok":
      mood += 6; loyalty += 4;
      if (fate.prestigeGain >= 4) ach.push(`Survived an expedition (Y${currentYear})`);
      break;
  }
  mood = Math.max(-100, Math.min(100, mood));
  loyalty = Math.max(-100, Math.min(100, loyalty));
  return { ...s, health, deathTick, deathYear, mood, loyaltyToFounder: loyalty, achievements: ach };
}
