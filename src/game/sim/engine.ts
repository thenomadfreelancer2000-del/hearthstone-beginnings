import { nanoid } from "nanoid";
import type {
  Building, ChronicleEntry, Family, GameTime, ID, ResourceKind, ResourceNode,
  Survivor, Relationship, SettlementStats, Tile, Memory,
} from "../types";
import {
  DAYS_PER_SEASON, SEASONS, TICKS_PER_DAY,
  decayNeeds, tickSurvivor, touchRelationship, markAsSpouses, markAsKin,
  findRelationship,
} from "./ai";
import { normalizeConstructionBuilding, recoverStalledConstruction } from "./construction";
import { CHRONICLE_OPENERS, FERTILE_MAX, FERTILE_MIN, NATURAL_DEATH_AGE } from "../data/content";
import { makeRng, chance, pick } from "./rng";
import { makeChild, stageFromAge } from "./world";
import { dailyHousingTick, findBestHome, homeCapacity, isResidential } from "./housing";

export interface Engine {
  time: GameTime;
  tiles: Tile[];
  mapW: number;
  mapH: number;
  nodes: ResourceNode[];
  buildings: Building[];
  resources: Record<ResourceKind, number>;
  survivors: Survivor[];
  relationships: Relationship[];
  families: Family[];
  founderId: ID;
  currentLeaderId: ID;
  chronicle: ChronicleEntry[];
  stats: SettlementStats;
  seed: number;
  /** During the Founding Phase, needs do not decay and arrivals are paused. */
  foundingPhase?: boolean;
}

function nextTime(t: GameTime): GameTime {
  const tick = t.tick + 1;
  const ticksIntoDay = tick % TICKS_PER_DAY;
  if (ticksIntoDay !== 0) return { ...t, tick };
  let day = t.day + 1;
  let season = t.season;
  let year = t.year;
  if (day > DAYS_PER_SEASON) {
    day = 1;
    const si = SEASONS.indexOf(season);
    if (si === SEASONS.length - 1) {
      season = "spring";
      year += 1;
    } else {
      season = SEASONS[si + 1];
    }
  }
  return { tick, day, season, year };
}

export function addChronicle(
  eng: Engine,
  category: ChronicleEntry["category"],
  title: string,
  body: string,
  involvedIds?: string[],
  involvedFamilyIds?: string[],
) {
  const e: ChronicleEntry = {
    id: nanoid(8),
    tick: eng.time.tick,
    year: eng.time.year, season: eng.time.season, day: eng.time.day,
    category, title, body, involvedIds, involvedFamilyIds,
  };
  eng.chronicle.unshift(e);
  if (eng.chronicle.length > 600) eng.chronicle.pop();
}

export function emitMemory(
  s: Survivor,
  text: string,
  emotion: Memory["emotion"],
  weight: number,
  aboutId?: string,
) {
  s.memories.unshift({
    id: nanoid(6),
    tick: 0,
    text, emotion, weight,
    aboutSurvivorId: aboutId ?? null,
  });
  if (s.memories.length > 24) s.memories.pop();
}

function recomputeStats(eng: Engine) {
  const alive = eng.survivors.filter(s => s.health > 0);
  const moraleAvg = alive.length
    ? alive.reduce((a, s) => a + s.mood, 0) / alive.length
    : 0;
  eng.stats.population = alive.length;
  eng.stats.morale = moraleAvg;
  eng.stats.generations = alive.reduce((m, s) => Math.max(m, s.generation), 0);
  const founderFamily = eng.families.find(f => f.id === eng.survivors.find(s => s.id === eng.founderId)?.familyId);
  if (founderFamily) eng.stats.dynastyName = founderFamily.name;
  eng.stats.prestige = eng.families.reduce((a, f) => a + f.prestige, 0);
}

// Advance the world by `n` ticks
export function advance(eng: Engine, n: number, opts?: { onArrival?: (s: Survivor) => Survivor | null }) {
  for (let i = 0; i < n; i++) {
    eng.time = nextTime(eng.time);
    const dt = 1;
    const previousConstructionEffort = new Map(
      eng.buildings.map(b => {
        normalizeConstructionBuilding(b);
        return [b.id, b.effortRemaining] as const;
      }),
    );
    const deps = {
      buildings: eng.buildings,
      nodes: eng.nodes,
      tiles: eng.tiles,
      mapW: eng.mapW,
      tick: eng.time.tick,
      resources: eng.resources,
      survivors: eng.survivors,
      relationships: eng.relationships,
      emitMemory: (s: Survivor, text: string, emotion: Memory["emotion"], weight: number) =>
        emitMemory(s, text, emotion, weight),
    };

    for (const s of eng.survivors) {
      if (s.health <= 0) continue;
      if (!eng.foundingPhase) decayNeeds(s, dt);
      tickSurvivor(s, dt, deps);
    }

    recoverStalledConstruction(eng.buildings, eng.survivors, eng.time.tick, previousConstructionEffort);

    // Construction completion notifications
    for (const b of eng.buildings) {
      normalizeConstructionBuilding(b);
      if (b.builtProgress >= 1 && b.completedYear == null) {
        b.completedYear = eng.time.year;
        if (b.kind !== "homestead") {
          addChronicle(
            eng, "construction",
            `New ${b.kind} stands on the ranch`,
            `The frame held, the dust settled, and another shape on the horizon is theirs.`,
          );
        }
      }
    }

    if (eng.time.tick % TICKS_PER_DAY === 0) {
      dailyTick(eng, opts);
    }
  }
  recomputeStats(eng);
}

function familyOf(eng: Engine, survivorId: ID): Family | undefined {
  const s = eng.survivors.find(x => x.id === survivorId);
  if (!s) return undefined;
  return eng.families.find(f => f.id === s.familyId);
}

function addToFamily(family: Family, survivor: Survivor) {
  if (!family.memberIds.includes(survivor.id)) {
    family.memberIds.push(survivor.id);
  }
  survivor.familyId = family.id;
}

function dailyTick(eng: Engine, opts?: { onArrival?: (s: Survivor) => Survivor | null }) {
  const rng = makeRng(eng.seed ^ eng.time.tick);

  // Resource node regrowth
  for (const n of eng.nodes) {
    if (n.regrowsPerDay > 0) n.amount = Math.min(n.max, n.amount + n.regrowsPerDay);
  }

  // Building production
  for (const b of eng.buildings) {
    if (b.builtProgress < 1) continue;
    if (b.kind === "well") eng.resources.water += 8;
    if (b.kind === "water-collector") eng.resources.water += 5;
    if (b.kind === "field") eng.resources.food += 6;
    if (b.kind === "foraging-camp") eng.resources.food += 4;
    if (b.kind === "workbench" && eng.resources.wood >= 2) {
      eng.resources.wood -= 2;
      eng.resources.tools += 1;
    }
  }

  processFarms(eng);
  dailyHousingTick({ buildings: eng.buildings, survivors: eng.survivors, tick: eng.time.tick });







  // ── Lifecycle: aging happens at season change ─────────────────
  const seasonChange = eng.time.day === 1;
  if (seasonChange) {
    for (const s of eng.survivors) {
      if (s.health <= 0) continue;
      const prevStage = s.stage;
      s.age += 0.25;
      const newStage = stageFromAge(s.age);
      if (newStage !== prevStage) {
        s.stage = newStage;
        if (newStage === "adult") {
          addChronicle(
            eng, "coming-of-age",
            `${s.name} ${s.surname} comes of age`,
            `${s.name} is reckoned an adult of the ranch at year ${eng.time.year}.`,
            [s.id], [s.familyId],
          );
        }
      }
    }
  }

  // Season banner
  if (seasonChange) {
    addChronicle(
      eng, "season",
      `${cap(eng.time.season)} of Year ${eng.time.year}`,
      `${pick(rng, CHRONICLE_OPENERS)} the season turned, and the ranch breathed with it.`,
    );
  }

  // ── Marriages ─────────────────────────────────────────────────
  if (seasonChange) {
    processMarriages(eng, rng);
  }

  // ── Births ────────────────────────────────────────────────────
  if (seasonChange) {
    processBirths(eng, rng);
  }

  // ── Natural death ─────────────────────────────────────────────
  if (seasonChange) {
    for (const s of eng.survivors) {
      if (s.health <= 0) continue;
      if (s.age < NATURAL_DEATH_AGE) continue;
      const over = s.age - NATURAL_DEATH_AGE;
      const p = Math.min(0.95, 0.08 + over * 0.04);
      if (chance(rng, p)) {
        killSurvivor(eng, s, `Passed peacefully at ${Math.floor(s.age)}.`);
      }
    }
  }

  // Arrivals are now handled at the store layer via structured ArrivalEvents.
  void opts;

  // First night chronicle if founder alone
  if (eng.time.tick === TICKS_PER_DAY && eng.survivors.length === 1) {
    const f = eng.survivors[0];
    addChronicle(
      eng, "founding",
      "The first night",
      `${f.name} ${f.surname} slept alone under a roof that wasn't theirs yet — and was, by morning.`,
      [f.id], [f.familyId],
    );
  }

  // Slow random relationship drift
  if (eng.survivors.length > 1 && chance(rng, 0.6)) {
    const a = eng.survivors[Math.floor(rng() * eng.survivors.length)];
    const b = eng.survivors[Math.floor(rng() * eng.survivors.length)];
    if (a.id !== b.id && a.health > 0 && b.health > 0) {
      touchRelationship(eng.relationships, a.id, b.id, {
        affection: (rng() - 0.5) * 2,
        trust: (rng() - 0.5),
        respect: (rng() - 0.5),
      });
    }
  }

  // Starvation / dehydration → death (non-founder is the chronicle convention, founder dies too)
  for (const s of eng.survivors) {
    if (s.health <= 0 && (s.deathTick == null)) {
      killSurvivor(eng, s, "Hunger or the cold or both.");
    }
  }

  // ── Succession check ──────────────────────────────────────────
  const leader = eng.survivors.find(s => s.id === eng.currentLeaderId);
  if (!leader || leader.health <= 0) {
    succeed(eng);
  }
}

function killSurvivor(eng: Engine, s: Survivor, cause: string) {
  if (s.deathTick != null) return;
  s.deathTick = eng.time.tick;
  s.deathYear = eng.time.year;
  s.health = 0;
  s.action = "Dead.";
  addChronicle(
    eng, "death",
    `${s.name} ${s.surname} is gone`,
    cause + " The ranch is one quieter.",
    [s.id], [s.familyId],
  );
  eng.stats.totalDied += 1;
  // Mark family extinct if no living members
  const fam = eng.families.find(f => f.id === s.familyId);
  if (fam) {
    const anyAlive = fam.memberIds.some(id => {
      const m = eng.survivors.find(x => x.id === id);
      return m && m.health > 0;
    });
    if (!anyAlive && fam.extinctYear == null) {
      fam.extinctYear = eng.time.year;
    }
  }
}

function succeed(eng: Engine) {
  const oldLeader = eng.survivors.find(s => s.id === eng.currentLeaderId);
  // Find heir: alive adult descendant of founder (preferred), then spouse, then any adult kin
  const isDescendantOfFounder = (s: Survivor): boolean => {
    if (s.id === eng.founderId) return true;
    if (!s.parentIds || s.parentIds.length === 0) return false;
    return s.parentIds.some(pid => {
      const p = eng.survivors.find(x => x.id === pid);
      return p ? isDescendantOfFounder(p) : false;
    });
  };
  const candidates = eng.survivors.filter(s =>
    s.health > 0 && s.id !== eng.currentLeaderId && (s.stage === "adult" || s.stage === "elder")
  );
  // Sort by: descendant > non-descendant; older first
  candidates.sort((a, b) => {
    const da = isDescendantOfFounder(a) ? 0 : 1;
    const db = isDescendantOfFounder(b) ? 0 : 1;
    if (da !== db) return da - db;
    return b.age - a.age;
  });
  const heir = candidates[0];
  if (!heir) return; // dynasty ends in silence
  eng.currentLeaderId = heir.id;
  heir.occupation = "leader";
  heir.achievements = [...(heir.achievements ?? []), `Inherited the ranch in Year ${eng.time.year}`];
  // Prestige bump
  const fam = familyOf(eng, heir.id);
  if (fam) fam.prestige = Math.min(200, fam.prestige + 10);
  addChronicle(
    eng, "succession",
    `${heir.name} ${heir.surname} takes the porch`,
    `With ${oldLeader?.name ?? "the leader"} gone, ${heir.name} ${heir.surname} stands at the door of the homestead and the dust settles around them.`,
    [heir.id, ...(oldLeader ? [oldLeader.id] : [])],
    [heir.familyId],
  );
}

function processMarriages(eng: Engine, rng: () => number) {
  // Scan for eligible pairs
  const eligible = eng.survivors.filter(s =>
    s.health > 0 && !s.spouseId && (s.stage === "adult" || s.stage === "youth") && s.age >= 18
  );
  // Build candidate list of pairs with strong attraction
  const seen = new Set<string>();
  for (const a of eligible) {
    for (const b of eligible) {
      if (a.id >= b.id) continue;
      if (a.gender === b.gender) continue;
      // skip kin
      const sharedParent = a.parentIds.some(p => b.parentIds.includes(p));
      if (a.parentIds.includes(b.id) || b.parentIds.includes(a.id) || sharedParent) continue;
      const r = findRelationship(eng.relationships, a.id, b.id);
      if (!r) continue;
      if (r.attraction < 55 || r.affection < 35) continue;
      const key = a.id + "::" + b.id;
      if (seen.has(key)) continue;
      seen.add(key);
      if (chance(rng, 0.55)) {
        marry(eng, a, b);
      }
    }
  }
}

function marry(eng: Engine, a: Survivor, b: Survivor) {
  a.spouseId = b.id;
  b.spouseId = a.id;
  a.marriedTick = eng.time.tick;
  b.marriedTick = eng.time.tick;
  a.marriedYear = eng.time.year;
  b.marriedYear = eng.time.year;

  // Higher-prestige family is the leading line; the other spouse adopts that surname/family.
  const fa = familyOf(eng, a.id)!;
  const fb = familyOf(eng, b.id)!;
  let lead: Family, follow: Family, leadSpouse: Survivor, followSpouse: Survivor;
  if (fa.prestige >= fb.prestige) {
    lead = fa; follow = fb; leadSpouse = a; followSpouse = b;
  } else {
    lead = fb; follow = fa; leadSpouse = b; followSpouse = a;
  }
  // Move follower into lead family
  followSpouse.surname = lead.name;
  follow.memberIds = follow.memberIds.filter(id => id !== followSpouse.id);
  addToFamily(lead, followSpouse);
  if (follow.memberIds.length === 0) {
    follow.extinctYear = eng.time.year;
  }
  lead.prestige = Math.min(200, lead.prestige + 5 + Math.floor(follow.prestige * 0.1));
  // Inter-family bond
  lead.relations[follow.id] = Math.min(100, (lead.relations[follow.id] ?? 0) + 25);
  follow.relations[lead.id] = Math.min(100, (follow.relations[lead.id] ?? 0) + 25);

  markAsSpouses(eng.relationships, a.id, b.id, eng.time.tick);

  // Couples prefer to share a home. If one already has a home with room, the
  // other moves in; otherwise auto-assign the best available together.
  assignSpousesToShared(eng, a, b);


  a.mood = Math.min(100, a.mood + 30);
  b.mood = Math.min(100, b.mood + 30);
  a.needs.belonging = 100;
  b.needs.belonging = 100;
  emitMemory(a, `Married ${b.name} ${b.surname}.`, "love", 90, b.id);
  emitMemory(b, `Married ${a.name} ${a.surname}.`, "love", 90, a.id);

  addChronicle(
    eng, "marriage",
    `${leadSpouse.name} of ${lead.name} weds ${followSpouse.name}`,
    `Under the year of ${eng.time.year}, ${a.name} and ${b.name} swore to share roof, ration, and grave. The ${lead.name} line gains a new hand.`,
    [a.id, b.id], [lead.id, follow.id],
  );
}

function processBirths(eng: Engine, rng: () => number) {
  // Iterate copy to allow push during loop
  const couples = new Set<string>();
  for (const s of [...eng.survivors]) {
    if (s.health <= 0) continue;
    if (!s.spouseId) continue;
    const spouse = eng.survivors.find(x => x.id === s.spouseId);
    if (!spouse || spouse.health <= 0) continue;
    const pairKey = s.id < spouse.id ? s.id + spouse.id : spouse.id + s.id;
    if (couples.has(pairKey)) continue;
    couples.add(pairKey);
    // age check
    const mother = s.gender === "f" ? s : spouse.gender === "f" ? spouse : null;
    const father = s.gender === "m" ? s : spouse.gender === "m" ? spouse : null;
    if (!mother || !father) continue;
    if (mother.age < FERTILE_MIN || mother.age > FERTILE_MAX) continue;
    // Conception chance per season — modulated by number of existing children
    const existing = mother.childrenIds.length;
    const base = 0.42;
    const p = Math.max(0.05, base - existing * 0.08);
    if (!chance(rng, p)) continue;
    // Spawn near mother
    const spawnX = mother.x + (rng() - 0.5);
    const spawnY = mother.y + (rng() - 0.5);
    const fam = familyOf(eng, father.id) ?? familyOf(eng, mother.id);
    if (!fam) continue;
    const generation = Math.max(mother.generation, father.generation) + 1;
    const child = makeChild(
      rng, [mother, father], eng.time.tick, eng.time.year,
      fam.id, fam.name, generation,
      { x: spawnX, y: spawnY },
    );
    eng.survivors.push(child);
    // Child inherits parent's home if there's space.
    const parentHome = eng.buildings.find(b =>
      b.id === (mother.homeId ?? father.homeId) && isResidential(b.kind)
    );
    if (parentHome && (parentHome.occupantIds?.length ?? 0) < homeCapacity(parentHome)) {
      child.homeId = parentHome.id;
      if (!parentHome.occupantIds.includes(child.id)) parentHome.occupantIds.push(child.id);
    }
    addToFamily(fam, child);
    mother.childrenIds.push(child.id);
    father.childrenIds.push(child.id);
    // kin relationships
    markAsKin(eng.relationships, mother.id, child.id);
    markAsKin(eng.relationships, father.id, child.id);
    // siblings as kin
    for (const sibId of [...mother.childrenIds, ...father.childrenIds]) {
      if (sibId === child.id) continue;
      markAsKin(eng.relationships, sibId, child.id);
    }
    fam.prestige = Math.min(200, fam.prestige + 2);
    eng.stats.totalBorn += 1;
    addChronicle(
      eng, "birth",
      `A child is born to ${mother.name} and ${father.name}`,
      `${child.name} ${child.surname} drew first breath in the year of ${eng.time.year}. The ${fam.name} line lengthens.`,
      [child.id, mother.id, father.id], [fam.id],
    );
  }
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}

function assignHomeWithGratitude(s: Survivor, b: Building) {
  const prevKind = s.lastHomeKind;
  s.homeId = b.id;
  if (!b.occupantIds.includes(s.id)) b.occupantIds.push(s.id);
  // Upgrade detection: higher quality than last home → gratitude
  const prevQ = prevKind ? (require("../data/content").BUILDINGS[prevKind]?.housingQuality ?? 0) : 0;
  const newQ = require("../data/content").BUILDINGS[b.kind]?.housingQuality ?? 0;
  if (newQ > prevQ) {
    s.housingGratitude = (s.housingGratitude ?? 0) + 10;
  }
  s.lastHomeKind = b.kind;
}

function assignSpousesToShared(eng: Engine, a: Survivor, b: Survivor) {
  // If one has room at home, the other moves in.
  const tryMoveInto = (target: Survivor, mover: Survivor) => {
    if (!target.homeId) return false;
    const h = eng.buildings.find(x => x.id === target.homeId);
    if (!h || !isResidential(h.kind)) return false;
    if ((h.occupantIds?.length ?? 0) >= homeCapacity(h)) return false;
    // remove mover from old home
    if (mover.homeId) {
      const old = eng.buildings.find(x => x.id === mover.homeId);
      if (old) old.occupantIds = old.occupantIds.filter(id => id !== mover.id);
    }
    assignHomeWithGratitude(mover, h);
    return true;
  };
  if (tryMoveInto(a, b)) return;
  if (tryMoveInto(b, a)) return;
  // Otherwise find best home for the couple together.
  const home = findBestHome(a, eng.buildings, eng.survivors);
  if (!home) return;
  for (const sp of [a, b]) {
    if (sp.homeId) {
      const old = eng.buildings.find(x => x.id === sp.homeId);
      if (old) old.occupantIds = old.occupantIds.filter(id => id !== sp.id);
    }
    if ((home.occupantIds?.length ?? 0) < homeCapacity(home)) {
      assignHomeWithGratitude(sp, home);
    }
  }
}


// ── Farms ──────────────────────────────────────────────────────
import { CROPS, expectedYield, growthRateMultiplier, isCropId, type CropId } from "../data/crops";

function processFarms(eng: Engine) {
  for (const b of eng.buildings) {
    if (b.kind !== "farm-plot" || !b.farm || b.builtProgress < 1) continue;
    const farm = b.farm;
    const cid = isCropId(farm.cropId) ? farm.cropId : "corn";
    const crop = CROPS[cid as CropId];
    const farmer = farm.assignedFarmerId
      ? eng.survivors.find(s => s.id === farm.assignedFarmerId && s.health > 0)
      : null;
    const skill = farmer?.skills.farm ?? 0;
    const rate = growthRateMultiplier(skill);

    // Empty → planted (someone needs to be assigned; otherwise wait)
    if (farm.stage === "empty") {
      if (farmer) {
        farm.stage = "growing";
        farm.growth = 0;
        farm.plantedTick = eng.time.tick;
        farm.plantedYear = eng.time.year;
      }
      continue;
    }

    if (farm.stage === "growing") {
      farm.growth = Math.min(1, farm.growth + rate / Math.max(1, crop.growthDays));
      if (farm.growth >= 1) {
        farm.stage = "mature";
      }
      continue;
    }

    if (farm.stage === "mature") {
      if (!farmer) continue; // wait for someone to harvest
      // Harvest!
      const base = expectedYield(crop, skill);
      const variance = 0.85 + Math.random() * 0.3;
      const harvested = Math.max(1, Math.round(base * variance));
      eng.resources.food += harvested;
      farm.lastYield = harvested;
      farm.lastHarvestYear = eng.time.year;
      farm.lastHarvestDay = eng.time.day;
      farm.totalHarvests = (farm.totalHarvests ?? 0) + 1;
      farm.stage = "empty";
      farm.growth = 0;
      farm.plantedTick = null;
      // Skill gain for the farmer
      farmer.skills.farm = Math.min(30, (farmer.skills.farm ?? 1) + 0.8);
      farmer.needs.purpose = Math.min(100, farmer.needs.purpose + 12);
      addChronicle(
        eng, "milestone",
        `${farmer.name} brings in ${crop.name}`,
        `${harvested} food gathered from the ${crop.name.toLowerCase()} plot.`,
        [farmer.id],
      );
    }
  }
}
