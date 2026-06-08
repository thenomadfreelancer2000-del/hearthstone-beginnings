import { nanoid } from "nanoid";
import type {
  Building, ChronicleEntry, GameTime, ResourceKind, ResourceNode,
  Survivor, Relationship, SettlementStats, Tile, Memory,
} from "../types";
import { DAYS_PER_SEASON, SEASONS, TICKS_PER_DAY, decayNeeds, tickSurvivor, touchRelationship } from "./ai";
import { CHRONICLE_OPENERS } from "../data/content";
import { makeRng, chance } from "./rng";

interface Engine {
  time: GameTime;
  tiles: Tile[];
  mapW: number;
  mapH: number;
  nodes: ResourceNode[];
  buildings: Building[];
  resources: Record<ResourceKind, number>;
  survivors: Survivor[];
  relationships: Relationship[];
  chronicle: ChronicleEntry[];
  stats: SettlementStats;
  seed: number;
}

function nextTime(t: GameTime): GameTime {
  const tick = t.tick + 1;
  const ticksIntoDay = tick % TICKS_PER_DAY;
  if (ticksIntoDay !== 0) return { ...t, tick };
  // new day
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
) {
  const e: ChronicleEntry = {
    id: nanoid(8),
    tick: eng.time.tick,
    year: eng.time.year, season: eng.time.season, day: eng.time.day,
    category, title, body, involvedIds,
  };
  eng.chronicle.unshift(e);
  if (eng.chronicle.length > 400) eng.chronicle.pop();
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
    text,
    emotion,
    weight,
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
}

// Advance the world by `n` ticks
export function advance(eng: Engine, n: number, opts?: { onArrival?: (s: Survivor) => Survivor | null }) {
  for (let i = 0; i < n; i++) {
    eng.time = nextTime(eng.time);
    const dt = 1;
    const deps = {
      buildings: eng.buildings,
      nodes: eng.nodes,
      tiles: eng.tiles,
      mapW: eng.mapW,
      resources: eng.resources,
      survivors: eng.survivors,
      relationships: eng.relationships,
      emitMemory: (s: Survivor, text: string, emotion: Memory["emotion"], weight: number) =>
        emitMemory(s, text, emotion, weight),
    };

    for (const s of eng.survivors) {
      if (s.health <= 0) continue;
      decayNeeds(s, dt);
      tickSurvivor(s, dt, deps);
    }

    // periodic events happen at day boundaries
    if (eng.time.tick % TICKS_PER_DAY === 0) {
      dailyTick(eng, opts);
    }
  }
  recomputeStats(eng);
}

function dailyTick(eng: Engine, opts?: { onArrival?: (s: Survivor) => Survivor | null }) {
  const rng = makeRng(eng.seed ^ eng.time.tick);

  // Resource node regrowth
  for (const n of eng.nodes) {
    if (n.regrowsPerDay > 0) n.amount = Math.min(n.max, n.amount + n.regrowsPerDay);
  }

  // Building daily production (well, field, workbench)
  for (const b of eng.buildings) {
    if (b.builtProgress < 1) continue;
    if (b.kind === "well") eng.resources.water += 8;
    if (b.kind === "field") eng.resources.food += 6;
    if (b.kind === "workbench" && eng.resources.wood >= 2) {
      eng.resources.wood -= 2;
      eng.resources.tools += 1;
    }
  }

  // Survivor aging — only at season change to keep it slow
  if (eng.time.day === 1) {
    for (const s of eng.survivors) {
      // age advances every 4 seasons; we track in fractional year per season tick
      // (Phase 1: age does not progress in real time to avoid death of founder mid-Phase-1)
      void s;
    }
  }

  // Chronicle season banner
  if (eng.time.day === 1) {
    addChronicle(
      eng, "season",
      `${cap(eng.time.season)} of Year ${eng.time.year}`,
      `${pick(rng, CHRONICLE_OPENERS)} the season turned, and the ranch breathed with it.`,
    );
  }

  // Newcomer arrival chance — only after a homestead exists, scales with morale and prestige
  const homestead = eng.buildings.find(b => b.kind === "homestead");
  if (homestead) {
    const baseP = 0.18;
    const moodMod = eng.stats.morale > 0 ? 0.08 : -0.05;
    const popMod = -Math.min(0.12, eng.survivors.length * 0.015);
    const p = baseP + moodMod + popMod;
    if (chance(rng, p)) {
      // place near homestead edge
      const sx = homestead.x - 2 + Math.floor(rng() * (homestead.w + 4));
      const sy = homestead.y - 2 + Math.floor(rng() * (homestead.h + 4));
      const candidate = opts?.onArrival
        ? opts.onArrival({ x: sx, y: sy } as unknown as Survivor)
        : null;
      if (candidate) {
        eng.survivors.push(candidate);
        addChronicle(
          eng, "arrival",
          `${candidate.name} ${candidate.surname} arrives`,
          `A ${candidate.background} walked in from the road with the dust still on them. They asked to stay.`,
          [candidate.id],
        );
      }
    }
  }

  // First night chronicle if founder alone
  if (eng.time.tick === TICKS_PER_DAY && eng.survivors.length === 1) {
    const f = eng.survivors[0];
    addChronicle(
      eng, "founding",
      "The first night",
      `${f.name} ${f.surname} slept alone under a roof that wasn't theirs yet — and was, by morning.`,
      [f.id],
    );
  }

  // Slow random relationship drift
  if (eng.survivors.length > 1 && chance(rng, 0.6)) {
    const a = eng.survivors[Math.floor(rng() * eng.survivors.length)];
    const b = eng.survivors[Math.floor(rng() * eng.survivors.length)];
    if (a.id !== b.id) {
      touchRelationship(eng.relationships, a.id, b.id, (rng() - 0.5) * 2, (rng() - 0.5) * 1);
    }
  }

  // Death from starvation/dehydration
  for (const s of eng.survivors) {
    if (s.health <= 0 && !s.isFounder) {
      // ensure chronicled once
      if (s.action !== "Dead.") {
        s.action = "Dead.";
        addChronicle(
          eng, "death",
          `${s.name} ${s.surname} is gone`,
          `Hunger or the cold or both. The ranch is one quieter.`,
          [s.id],
        );
      }
    }
  }
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
