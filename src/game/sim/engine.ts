import { nanoid } from "nanoid";
import type {
  Animal, Building, ChronicleEntry, Family, GameTime, ID, LivestockRequest,
  MarriageProposal, Minister, MinisterRequest, MinisterReport, ResourceKind, ResourceNode,
  Survivor, Relationship, SettlementStats, Tile, Memory,
} from "../types";
import {
  DAYS_PER_SEASON, SEASONS, TICKS_PER_DAY,
  decayNeeds, tickSurvivor, touchRelationship, markAsSpouses, markAsKin,
  findRelationship, decayMemoriesDaily, opinionScore,
} from "./ai";
import { normalizeConstructionBuilding, recoverStalledConstruction } from "./construction";
import { CHRONICLE_OPENERS, FERTILE_MAX, FERTILE_MIN, NATURAL_DEATH_AGE } from "../data/content";
import { makeRng, chance, pick } from "./rng";
import { makeChild, stageFromAge } from "./world";
import { dailyHousingTick, findBestHome, homeCapacity, isResidential } from "./housing";
import { dailyFamilyTick } from "./families";
import { dailyEducationTick, pickSuccessor } from "./heirs";
import { applyAgingEffects, applyLeadershipTransition, lifeStageLabel } from "./legacy";
import { BUILDINGS } from "../data/content";
import { enqueueProposalsForSeason, resolveProposalsDaily } from "./marriage";
import { dailyLivestockTick } from "./livestock";
import { dailyMinistersTick } from "./ministers";

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
  preferredHeirId?: ID | null;
  chronicle: ChronicleEntry[];
  stats: SettlementStats;
  seed: number;
  /** Dynastic marriage proposals queue. */
  proposals: MarriageProposal[];
  /** Livestock (v4). */
  animals: Animal[];
  livestockRequests: LivestockRequest[];
  /** Ministers (v5). */
  ministers: Minister[];
  ministerRequests: MinisterRequest[];
  ministerReports: MinisterReport[];
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
  opts?: { kind?: string; decayRate?: number; floor?: number; at?: { tick: number; year: number; season: import("../types").Season; day: number } },
) {
  const at = opts?.at;
  s.memories.unshift({
    id: nanoid(6),
    tick: at?.tick ?? 0,
    year: at?.year,
    season: at?.season,
    day: at?.day,
    text, emotion, weight,
    aboutSurvivorId: aboutId ?? null,
    kind: opts?.kind,
    decayRate: opts?.decayRate,
    floor: opts?.floor,
  });
  if (s.memories.length > 64) s.memories.pop();
}

/** Convenience: emit a memory stamped with the engine's current date. */
function emitMem(
  eng: Engine,
  s: Survivor,
  text: string,
  emotion: Memory["emotion"],
  weight: number,
  aboutId?: string,
  opts?: { kind?: string; decayRate?: number; floor?: number },
) {
  emitMemory(s, text, emotion, weight, aboutId, {
    ...opts,
    at: { tick: eng.time.tick, year: eng.time.year, season: eng.time.season, day: eng.time.day },
  });
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
        emitMem(eng, s, text, emotion, weight),
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
  dailyFamilyTick({
    families: eng.families,
    survivors: eng.survivors,
    buildings: eng.buildings,
    currentLeaderId: eng.currentLeaderId,
    founderId: eng.founderId,
    time: { year: eng.time.year },
  });
  dailyEducationTick(eng.survivors);

  // Livestock (Livestock & Family Livestock update)
  dailyLivestockTick({
    time: { tick: eng.time.tick, year: eng.time.year },
    buildings: eng.buildings,
    survivors: eng.survivors,
    families: eng.families,
    resources: eng.resources,
    founderId: eng.founderId,
    animals: eng.animals,
    livestockRequests: eng.livestockRequests,
  }, rng);

  // Ministers (Administration update)
  dailyMinistersTick({
    time: { tick: eng.time.tick, year: eng.time.year, season: eng.time.season, day: eng.time.day },
    ministers: eng.ministers,
    ministerRequests: eng.ministerRequests,
    ministerReports: eng.ministerReports,
    survivors: eng.survivors,
    buildings: eng.buildings,
    animals: eng.animals,
    families: eng.families,
    founderId: eng.founderId,
  }, rng);

  // Memories decay daily — major events have a floor that keeps them alive.
  for (const s of eng.survivors) {
    if (s.health <= 0) continue;
    decayMemoriesDaily(s);
    // Hardship memories — at most one per kind per 5 days.
    const recentKind = (kind: string, withinTicks: number) =>
      s.memories.some(m => m.kind === kind && (eng.time.tick - (m.tick ?? 0)) < withinTicks);
    const FIVE_DAYS = 5 * 24; // TICKS_PER_DAY assumed 24
    if (s.needs.food < 10 && !recentKind("starved", FIVE_DAYS)) {
      emitMem(eng, s, `I went hungry. The ranch could not feed us.`, "fear", 40, eng.currentLeaderId,
        { kind: "starved", floor: 15, decayRate: 0.5 });
    }
    if (s.needs.water < 10 && !recentKind("thirsted", FIVE_DAYS)) {
      emitMem(eng, s, `I went thirsty. The wells ran dry.`, "fear", 35, eng.currentLeaderId,
        { kind: "thirsted", floor: 12, decayRate: 0.5 });
    }
  }








  // ── Lifecycle: aging happens at season change ─────────────────
  const seasonChange = eng.time.day === 1;
  if (seasonChange) {
    for (const s of eng.survivors) {
      if (s.health <= 0) continue;
      const prevStage = s.stage;
      const prevLabel = lifeStageLabel(s);
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
      // Sub-tier crossings (Mature Adult, Elder, Very Elderly).
      const newLabel = lifeStageLabel(s);
      if (newLabel !== prevLabel && (newLabel === "Mature Adult" || newLabel === "Elder" || newLabel === "Very Elderly")) {
        addChronicle(
          eng, "coming-of-age",
          `${s.name} ${s.surname} grows into ${newLabel}`,
          `Year ${eng.time.year}. The years have settled on their shoulders.`,
          [s.id], [s.familyId],
        );
      }
      applyAgingEffects(s);
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

  // ── Marriage proposals (Dynastic Marriage update) ─────────────
  if (seasonChange) {
    enqueueProposalsForSeason(eng, rng);
  }
  resolveProposalsDaily(eng, rng);


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
  // Grief memories with high floor — these scar.
  if (s.spouseId) {
    const sp = eng.survivors.find(x => x.id === s.spouseId);
    if (sp && sp.health > 0) {
      emitMem(eng, sp, `${s.name} died. The bed is cold.`, "grief", 100, s.id,
        { kind: "spouse-died", floor: 50, decayRate: 0.3 });
      sp.mood = Math.max(-100, sp.mood - 35);
    }
  }
  for (const pid of s.parentIds) {
    const p = eng.survivors.find(x => x.id === pid);
    if (p && p.health > 0) {
      emitMem(eng, p, `Lost ${s.name}. A child should outlive their parents.`, "grief", 100, s.id,
        { kind: "child-died", floor: 60, decayRate: 0.2 });
      p.mood = Math.max(-100, p.mood - 45);
    }
  }
  for (const cid of s.childrenIds) {
    const c = eng.survivors.find(x => x.id === cid);
    if (c && c.health > 0) {
      emitMem(eng, c, `${s.name} is gone.`, "grief", 90, s.id,
        { kind: "parent-died", floor: 40, decayRate: 0.3 });
      c.mood = Math.max(-100, c.mood - 25);
    }
  }
  // Friend grief — best friends suffer deeply, friends are wounded.
  for (const r of eng.relationships) {
    if (r.a !== s.id && r.b !== s.id) continue;
    if (r.tag === "spouse" || r.tag === "kin") continue;
    const otherId = r.a === s.id ? r.b : r.a;
    const other = eng.survivors.find(x => x.id === otherId);
    if (!other || other.health <= 0) continue;
    const score = opinionScore(r);
    if (score >= 80) {
      emitMem(eng, other, `${s.name} — my closest friend — is gone.`, "grief", 90, s.id,
        { kind: "friend-died", floor: 45, decayRate: 0.3 });
      other.mood = Math.max(-100, other.mood - 30);
    } else if (score >= 60) {
      emitMem(eng, other, `Mourned ${s.name}. A friend lost.`, "grief", 70, s.id,
        { kind: "friend-died", floor: 25, decayRate: 0.4 });
      other.mood = Math.max(-100, other.mood - 18);
    } else if (score <= -60) {
      // Even rivals feel something — a quiet relief, an empty space.
      emitMem(eng, other, `${s.name} is dead. We will not quarrel again.`, "fear", 30, s.id,
        { kind: "rival-died", floor: 8, decayRate: 0.6 });
    }
  }
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
  const heir = pickSuccessor({
    leader: oldLeader ?? null,
    founderId: eng.founderId,
    preferredHeirId: eng.preferredHeirId ?? null,
    survivors: eng.survivors,
    relationships: eng.relationships,
    families: eng.families,
  });
  if (!heir) return; // dynasty ends in silence
  const wasPreferred = eng.preferredHeirId === heir.id;
  eng.currentLeaderId = heir.id;
  eng.preferredHeirId = null; // consumed
  heir.occupation = "leader";
  heir.achievements = [...(heir.achievements ?? []), `Inherited the ranch in Year ${eng.time.year}`];
  const fam = familyOf(eng, heir.id);
  if (fam) fam.prestige = Math.min(200, fam.prestige + 10);

  // Transition: every soul reassesses the new leader.
  const tr = applyLeadershipTransition({
    survivors: eng.survivors,
    relationships: eng.relationships,
    families: eng.families,
    newLeader: heir,
    oldLeader: oldLeader ?? null,
    wasPreferred,
    emitMemory: (s, text, emotion, weight, aboutId, opts) =>
      emitMem(eng, s, text, emotion, weight, aboutId, opts),
  });

  const reign = oldLeader
    ? `${oldLeader.epithet ? `, ${oldLeader.epithet},` : ""}`
    : "";
  const moodNote =
    tr.swearings > tr.rejections * 2
      ? `Most of the ranch swears to the new line.`
      : tr.rejections > tr.swearings
        ? `Doubt walks the porch — not all welcome the change.`
        : `The settlement watches in silence to see what kind of leader stands here.`;

  addChronicle(
    eng, "succession",
    `${heir.name} ${heir.surname} takes the porch`,
    `With ${oldLeader?.name ?? "the leader"}${reign} gone, ${heir.name} ${heir.surname} ` +
      `stands at the door of the homestead and the dust settles around them.` +
      (wasPreferred ? ` Named heir by ${oldLeader?.name ?? "the late leader"}.` : "") +
      ` ${moodNote}`,
    [heir.id, ...(oldLeader ? [oldLeader.id] : [])],
    [heir.familyId],
  );
}

// processMarriages now lives in ./marriage and is queued, not auto-executed.
// Daily resolution + seasonal enqueue are imported here.


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
    // Cousins start with a small positive bond (children of parents' siblings).
    const parentSiblingIds = new Set<string>();
    for (const parent of [mother, father]) {
      for (const gpId of parent.parentIds) {
        const gp = eng.survivors.find(x => x.id === gpId);
        if (!gp) continue;
        for (const auntUncleId of gp.childrenIds) {
          if (auntUncleId === parent.id) continue;
          parentSiblingIds.add(auntUncleId);
        }
      }
    }
    for (const auId of parentSiblingIds) {
      const au = eng.survivors.find(x => x.id === auId);
      if (!au) continue;
      for (const cousinId of au.childrenIds) {
        const cousin = eng.survivors.find(x => x.id === cousinId);
        if (!cousin || cousin.id === child.id || cousin.health <= 0) continue;
        touchRelationship(eng.relationships, child.id, cousin.id, {
          affection: 18, trust: 10, friendship: 12,
        });
      }
    }
    fam.prestige = Math.min(200, fam.prestige + 2);
    eng.stats.totalBorn += 1;
    // Parents' core memory
    emitMem(eng, mother, `Our child ${child.name} was born.`, "joy", 90, child.id,
      { kind: "child-born", floor: 50, decayRate: 0.15 });
    emitMem(eng, father, `Our child ${child.name} was born.`, "joy", 90, child.id,
      { kind: "child-born", floor: 50, decayRate: 0.15 });
    mother.mood = Math.min(100, mother.mood + 20);
    father.mood = Math.min(100, father.mood + 15);
    // Family lore — grandparents remember too.
    for (const gp of [...mother.parentIds, ...father.parentIds]) {
      const g = eng.survivors.find(x => x.id === gp);
      if (g && g.health > 0) {
        emitMem(eng, g, `${child.name} was born to ${mother.name} and ${father.name}. Our line lengthens.`,
          "pride", 55, child.id, { kind: "grandchild-born", floor: 20, decayRate: 0.3 });
      }
    }
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

function assignHomeWithGratitude(eng: Engine, s: Survivor, b: Building) {
  const prevKind = s.lastHomeKind;
  s.homeId = b.id;
  if (!b.occupantIds.includes(s.id)) b.occupantIds.push(s.id);
  // Upgrade detection: higher quality than last home → gratitude + memory
  const prevQ = prevKind ? (BUILDINGS[prevKind]?.housingQuality ?? 0) : 0;
  const newQ = BUILDINGS[b.kind]?.housingQuality ?? 0;
  const def = BUILDINGS[b.kind];
  if (newQ > prevQ) {
    s.housingGratitude = (s.housingGratitude ?? 0) + 10;
    emitMem(eng, s, `The Founder gave us a ${def?.name ?? b.kind}.`, "trust", 55, eng.currentLeaderId,
      { kind: "housing-upgrade", floor: 12, decayRate: 0.4 });
  } else if (newQ < prevQ && prevKind) {
    const prevDef = BUILDINGS[prevKind];
    emitMem(eng, s, `Moved from our ${prevDef?.name ?? prevKind} to a ${def?.name ?? b.kind}.`, "anger", 60, eng.currentLeaderId,
      { kind: "housing-downgrade", floor: 20, decayRate: 0.3 });
  }
  s.lastHomeKind = b.kind;
}


export function assignSpousesToShared(eng: Engine, a: Survivor, b: Survivor) {
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
    assignHomeWithGratitude(eng, mover, h);
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
      assignHomeWithGratitude(eng, sp, home);
    }
  }
}


// ── Farms ──────────────────────────────────────────────────────
import { CROPS, expectedYield, growthRateMultiplier, isCropId, type CropId } from "../data/crops";

const SPOIL_DAYS = 5;

function processFarms(eng: Engine) {
  for (const b of eng.buildings) {
    if (b.kind !== "farm-plot" || !b.farm || b.builtProgress < 1) continue;
    const farm = b.farm;
    const cid = isCropId(farm.cropId) ? farm.cropId : "corn";
    const crop = CROPS[cid as CropId];

    // The assigned farmer is only "effective" while their occupation is still
    // farmer — if the player reassigned them elsewhere, the plot waits.
    const assigned = farm.assignedFarmerId
      ? eng.survivors.find(s => s.id === farm.assignedFarmerId && s.health > 0)
      : null;
    const effectiveFarmer = assigned && assigned.occupation === "farmer" ? assigned : null;
    const skill = effectiveFarmer?.skills.farm ?? 0;
    const rate = growthRateMultiplier(skill);

    // Empty → planted (needs the assigned farmer actively working)
    if (farm.stage === "empty") {
      if (effectiveFarmer) {
        farm.stage = "growing";
        farm.growth = 0;
        farm.plantedTick = eng.time.tick;
        farm.plantedYear = eng.time.year;
        farm.matureSinceTick = null;
      }
      continue;
    }

    if (farm.stage === "growing") {
      // Crops keep growing even without a tender, just slower if no skill.
      farm.growth = Math.min(1, farm.growth + rate / Math.max(1, crop.growthDays));
      if (farm.growth >= 1) {
        farm.stage = "mature";
        farm.matureSinceTick = eng.time.tick;
      }
      continue;
    }

    if (farm.stage === "mature") {
      if (farm.matureSinceTick == null) farm.matureSinceTick = eng.time.tick;

      // Pick a harvester: the effective farmer, or any unassigned idle hand.
      let harvester = effectiveFarmer;
      if (!harvester) {
        harvester = eng.survivors.find(s =>
          s.health > 0 &&
          s.occupation === "idle" &&
          (s.stage === "adult" || s.stage === "youth" || s.stage === "elder" || s.isFounder),
        ) ?? null;
      }

      if (harvester) {
        const hSkill = harvester.skills.farm ?? 0;
        const base = expectedYield(crop, hSkill);
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
        farm.matureSinceTick = null;
        harvester.skills.farm = Math.min(30, (harvester.skills.farm ?? 1) + (harvester === effectiveFarmer ? 0.8 : 0.3));
        harvester.needs.purpose = Math.min(100, harvester.needs.purpose + 12);
        addChronicle(
          eng, "milestone",
          `${harvester.name} brings in ${crop.name}`,
          `${harvested} food gathered from the ${crop.name.toLowerCase()} plot.`,
          [harvester.id],
        );
        continue;
      }

      // No one to harvest — crop spoils if it sits mature too long.
      const waited = eng.time.tick - (farm.matureSinceTick ?? eng.time.tick);
      if (waited >= SPOIL_DAYS * TICKS_PER_DAY) {
        farm.stage = "empty";
        farm.growth = 0;
        farm.plantedTick = null;
        farm.matureSinceTick = null;
        farm.lastYield = 0;
        addChronicle(
          eng, "event",
          `${crop.name} spoils in the field`,
          `With no one tending the plot, the ${crop.name.toLowerCase()} rotted before it could be brought in.`,
        );
      }
    }
  }
}
