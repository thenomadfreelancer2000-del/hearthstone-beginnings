// Livestock simulation — daily ticks for animals, production, breeding,
// health, and family request generation. Pure functions over Engine.
import { nanoid } from "nanoid";
import type {
  Animal, AnimalSex, AnimalSpecies, Building, BuildingKind, Family,
  ID, LivestockRequest, ResourceKind, Survivor,
} from "../types";
import { BUILDINGS } from "../data/content";

const TICKS_PER_DAY = 24;

export interface LivestockEngine {
  time: { tick: number; year: number };
  buildings: Building[];
  survivors: Survivor[];
  families: Family[];
  resources: Record<ResourceKind, number>;
  founderId: ID;
  animals: Animal[];
  livestockRequests: LivestockRequest[];
}

export const SPECIES_BUILDING: Record<AnimalSpecies, BuildingKind> = {
  chicken: "chicken-coop",
  goat: "goat-pen",
  sheep: "sheep-pen",
  cattle: "cattle-pasture",
};

export const SPECIES_LABEL: Record<AnimalSpecies, string> = {
  chicken: "Chicken",
  goat: "Goat",
  sheep: "Sheep",
  cattle: "Cattle",
};

const ADULT_AGE_DAYS: Record<AnimalSpecies, number> = {
  chicken: 30,
  goat: 90,
  sheep: 120,
  cattle: 240,
};

const GESTATION_DAYS: Record<AnimalSpecies, number> = {
  chicken: 12,
  goat: 45,
  sheep: 55,
  cattle: 90,
};

const MAX_AGE_DAYS: Record<AnimalSpecies, number> = {
  chicken: 720,
  goat: 1800,
  sheep: 1800,
  cattle: 2700,
};

const FOOD_PER_DAY: Record<AnimalSpecies, number> = {
  chicken: 0.2,
  goat: 0.5,
  sheep: 0.5,
  cattle: 1.2,
};

const PRODUCT: Record<AnimalSpecies, { resource: ResourceKind; perDay: number }> = {
  chicken: { resource: "eggs", perDay: 0.6 },
  goat: { resource: "milk", perDay: 0.5 },
  sheep: { resource: "wool", perDay: 0.3 },
  cattle: { resource: "milk", perDay: 1.2 },
};

export function makeAnimal(
  species: AnimalSpecies,
  sex: AnimalSex,
  familyId: ID,
  buildingId: ID | null,
  tick: number,
  ageDays = 0,
): Animal {
  return {
    id: nanoid(8),
    species,
    sex,
    ageDays,
    bornTick: tick,
    health: 90 + Math.random() * 10,
    hunger: 20,
    ownerFamilyId: familyId,
    buildingId,
    pregnant: false,
  };
}

function ranchSkill(s: Survivor | undefined | null): number {
  if (!s) return 0;
  return Math.min(30, Math.max(0, s.skills.ranch ?? 0));
}

function adultsBySex(animals: Animal[], buildingId: ID): { males: Animal[]; females: Animal[] } {
  const here = animals.filter(
    (a) => !a.dead && a.buildingId === buildingId &&
      a.ageDays >= ADULT_AGE_DAYS[a.species],
  );
  return {
    males: here.filter((a) => a.sex === "m"),
    females: here.filter((a) => a.sex === "f"),
  };
}

/** Called once per game day from engine.ts. */
export function dailyLivestockTick(eng: LivestockEngine, rng: () => number) {
  if (!eng.animals) eng.animals = [];
  if (!eng.livestockRequests) eng.livestockRequests = [];

  // Index pens by id, only completed livestock buildings.
  const pens = new Map<ID, Building>();
  for (const b of eng.buildings) {
    if (b.builtProgress < 1) continue;
    const def = BUILDINGS[b.kind];
    if (def.livestock) pens.set(b.id, b);
  }

  // ── 1) Aging + hunger ─────────────────────────────────────────
  for (const a of eng.animals) {
    if (a.dead) continue;
    a.ageDays += 1;
    a.hunger = Math.min(100, a.hunger + 14);
  }

  // ── 2) Feed: rancher / pen food / settlement food ─────────────
  for (const pen of pens.values()) {
    const def = BUILDINGS[pen.kind];
    const species = def.livestock!.species;
    const here = eng.animals.filter((a) => !a.dead && a.buildingId === pen.id);
    if (here.length === 0) continue;
    const worker = pen.assignedWorkerId
      ? eng.survivors.find((s) => s.id === pen.assignedWorkerId && s.health > 0)
      : null;
    const skill = ranchSkill(worker);
    const efficiency = 0.6 + skill / 60; // 0.6 .. 1.1
    const need = here.length * FOOD_PER_DAY[species];
    let from = pen.stored?.food ?? 0;
    let consume = Math.min(need, from);
    if (consume < need) {
      const extra = Math.min(need - consume, eng.resources.food);
      eng.resources.food -= extra;
      consume += extra;
    } else {
      pen.stored = { ...pen.stored, food: (from - consume) };
    }
    const fed = (consume / need) * efficiency;
    for (const a of here) {
      a.hunger = Math.max(0, a.hunger - 30 * fed);
      if (a.hunger > 80) {
        a.health = Math.max(0, a.health - 4);
      } else if (a.hunger < 30) {
        a.health = Math.min(100, a.health + 1.5);
      }
    }
    if (worker) {
      worker.skills.ranch = Math.min(30, (worker.skills.ranch ?? 0) + 0.05);
    }
  }

  // Unhoused animals: drain fast
  for (const a of eng.animals) {
    if (a.dead || a.buildingId) continue;
    a.health = Math.max(0, a.health - 6);
    a.hunger = Math.min(100, a.hunger + 10);
  }

  // ── 3) Production ─────────────────────────────────────────────
  for (const pen of pens.values()) {
    const def = BUILDINGS[pen.kind];
    const species = def.livestock!.species;
    const here = eng.animals.filter(
      (a) => !a.dead && a.buildingId === pen.id &&
        a.ageDays >= ADULT_AGE_DAYS[a.species] &&
        a.health > 30,
    );
    if (here.length === 0) continue;
    const prod = PRODUCT[species];
    const skill = ranchSkill(
      pen.assignedWorkerId ? eng.survivors.find((s) => s.id === pen.assignedWorkerId) : null,
    );
    const mult = 0.7 + skill / 40;
    const total = here.length * prod.perDay * mult;
    // Founder-house pens deliver to settlement stockpile; other houses keep
    // production in the pen as a family asset.
    const ownerId = pen.livestockOwnerFamilyId ?? here[0].ownerFamilyId;
    const founderFamilyId = eng.survivors.find((s) => s.id === eng.founderId)?.familyId;
    if (ownerId === founderFamilyId) {
      eng.resources[prod.resource] = (eng.resources[prod.resource] ?? 0) + total;
    } else {
      pen.stored = {
        ...pen.stored,
        [prod.resource]: (pen.stored?.[prod.resource] ?? 0) + total,
      };
    }
  }

  // ── 4) Breeding ───────────────────────────────────────────────
  for (const pen of pens.values()) {
    const def = BUILDINGS[pen.kind];
    const cap = def.livestock!.capacity;
    const here = eng.animals.filter((a) => !a.dead && a.buildingId === pen.id);
    if (here.length >= cap) continue;
    const species = def.livestock!.species;
    const { males, females } = adultsBySex(eng.animals, pen.id);
    if (males.length === 0 || females.length === 0) continue;
    // Tick pregnancies
    for (const f of females) {
      if (f.pregnant && f.pregnancyTick != null) {
        if (eng.time.tick - f.pregnancyTick >= GESTATION_DAYS[species] * TICKS_PER_DAY) {
          // birth
          const sex: AnimalSex = rng() < 0.5 ? "m" : "f";
          const baby = makeAnimal(species, sex, f.ownerFamilyId, pen.id, eng.time.tick);
          eng.animals.push(baby);
          f.pregnant = false;
          f.pregnancyTick = null;
          const fam = eng.families.find((x) => x.id === f.ownerFamilyId);
          if (fam) fam.prestige = Math.min(200, fam.prestige + 1);
        }
      } else if (rng() < 0.06) {
        const skill = ranchSkill(
          pen.assignedWorkerId ? eng.survivors.find((s) => s.id === pen.assignedWorkerId) : null,
        );
        const odds = 0.4 + skill / 60;
        if (rng() < odds) {
          f.pregnant = true;
          f.pregnancyTick = eng.time.tick;
        }
      }
    }
  }

  // ── 5) Death from age / starvation / illness ─────────────────
  for (const a of eng.animals) {
    if (a.dead) continue;
    if (a.ageDays > MAX_AGE_DAYS[a.species] && rng() < 0.02) {
      a.dead = true;
      a.deathTick = eng.time.tick;
      a.deathCause = "old-age";
      continue;
    }
    if (a.health <= 0) {
      a.dead = true;
      a.deathTick = eng.time.tick;
      a.deathCause = a.hunger > 80 ? "starvation" : "illness";
    }
  }

  // ── 6) Family prestige from healthy herds ────────────────────
  // Once per ~30 days roughly
  if (eng.time.tick % (30 * TICKS_PER_DAY) === 0) {
    const byFamily = new Map<ID, number>();
    for (const a of eng.animals) {
      if (a.dead) continue;
      byFamily.set(a.ownerFamilyId, (byFamily.get(a.ownerFamilyId) ?? 0) + 1);
    }
    for (const [fid, count] of byFamily) {
      const fam = eng.families.find((f) => f.id === fid);
      if (!fam) continue;
      if (count >= 12) fam.prestige = Math.min(200, fam.prestige + 2);
      else if (count >= 6) fam.prestige = Math.min(200, fam.prestige + 1);
    }
  }

  // ── 7) Generate livestock requests (rare) ────────────────────
  generateLivestockRequests(eng, rng);

  // ── 8) Auto-resolve postponed requests at expiry ─────────────
  for (const r of eng.livestockRequests) {
    if (r.status === "postponed" && r.resolveAfterTick != null && eng.time.tick >= r.resolveAfterTick) {
      r.status = "pending";
      r.resolveAfterTick = undefined;
    }
  }
}

function generateLivestockRequests(eng: LivestockEngine, rng: () => number) {
  const founderFamilyId = eng.survivors.find((s) => s.id === eng.founderId)?.familyId;
  // ~ once per 3 game-days per family attempt
  if (eng.time.tick % (3 * TICKS_PER_DAY) !== 0) return;
  for (const fam of eng.families) {
    if (fam.id === founderFamilyId) continue;
    if (fam.extinctYear != null) continue;
    // already has a pending request?
    if (eng.livestockRequests.some((r) => r.familyId === fam.id && r.status === "pending")) continue;
    const alive = fam.memberIds
      .map((id) => eng.survivors.find((s) => s.id === id))
      .filter((s): s is Survivor => !!s && s.health > 0 && (s.stage === "adult" || s.stage === "elder"));
    if (alive.length === 0) continue;
    const loyaltyAvg = alive.reduce((a, s) => a + s.loyaltyToFounder, 0) / alive.length;
    // base 4% chance, modulated by loyalty
    const p = 0.04 + Math.max(0, loyaltyAvg) * 0.0006;
    if (rng() > p) continue;
    const requester = alive[Math.floor(rng() * alive.length)];
    // pick species: avoid one already owned heavily; else random
    const owned: Record<AnimalSpecies, number> = { chicken: 0, goat: 0, sheep: 0, cattle: 0 };
    for (const a of eng.animals) {
      if (a.dead) continue;
      if (a.ownerFamilyId === fam.id) owned[a.species]++;
    }
    const speciesPool: AnimalSpecies[] = ["chicken", "goat", "sheep", "cattle"];
    const species = speciesPool[Math.floor(rng() * speciesPool.length)];
    const hasPen = eng.buildings.some(
      (b) => b.builtProgress >= 1 && b.livestockOwnerFamilyId === fam.id &&
        b.kind === SPECIES_BUILDING[species],
    );
    const kind: LivestockRequest["kind"] = hasPen
      ? (owned[species] >= 4 ? "expand" : "build-pen")
      : (owned[species] === 0 ? "start-raising" : "build-pen");
    eng.livestockRequests.push({
      id: nanoid(8),
      familyId: fam.id,
      requesterId: requester.id,
      kind,
      species,
      buildingKind: SPECIES_BUILDING[species],
      createdTick: eng.time.tick,
      createdYear: eng.time.year,
      status: "pending",
    });
  }
}
