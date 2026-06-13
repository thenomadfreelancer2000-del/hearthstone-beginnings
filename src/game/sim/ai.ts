import type {
  Building, Relationship, ResourceKind, ResourceNode, Survivor, Tile,
} from "../types";
import { applyConstructionWork, hasConstructionResources, normalizeConstructionBuilding } from "./construction";

export const TICKS_PER_DAY = 240;
export const DAYS_PER_SEASON = 12;
export const SEASONS: ("spring" | "summer" | "autumn" | "winter")[] = [
  "spring", "summer", "autumn", "winter",
];

// ── Helpers ─────────────────────────────────────────────────────
export function relKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function findRelationship(rels: Relationship[], a: string, b: string): Relationship | undefined {
  return rels.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function moveToward(s: Survivor, dt: number) {
  if (s.targetX == null || s.targetY == null) return;
  const dx = s.targetX - s.x;
  const dy = s.targetY - s.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const speed = 0.04 * dt;
  if (d <= speed) {
    s.x = s.targetX;
    s.y = s.targetY;
    s.targetX = null;
    s.targetY = null;
    s.state = "idle";
  } else {
    s.x += (dx / d) * speed;
    s.y += (dy / d) * speed;
    s.state = "moving";
  }
}

function nearestNode(s: Survivor, nodes: ResourceNode[], wants: ResourceKind): ResourceNode | null {
  let best: ResourceNode | null = null;
  let bestD = Infinity;
  for (const n of nodes) {
    if (n.yields !== wants) continue;
    if (n.amount <= 0) continue;
    const d = dist(s.x, s.y, n.x, n.y);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

function nearestStockpile(s: Survivor, buildings: Building[]): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const b of buildings) {
    if (b.kind !== "stockpile" && b.kind !== "homestead") continue;
    if (b.builtProgress < 1) continue;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const d = dist(s.x, s.y, cx, cy);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

function nearestUnfinished(s: Survivor, buildings: Building[]): Building | null {
  // Completion-priority boost: prefer sites at >=75% progress so nearly-done
  // buildings get finished before new ones are started.
  let bestNear: Building | null = null; let bestNearD = Infinity;
  let bestFar: Building | null = null; let bestFarD = Infinity;
  for (const b of buildings) {
    if (b.builtProgress >= 1) continue;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const d = dist(s.x, s.y, cx, cy);
    if (b.builtProgress >= 0.75) {
      if (d < bestNearD) { bestNearD = d; bestNear = b; }
    } else {
      if (d < bestFarD) { bestFarD = d; bestFar = b; }
    }
  }
  return bestNear ?? bestFar;
}

function nearestWater(s: Survivor, tiles: Tile[], mapW: number): Tile | null {
  let best: Tile | null = null;
  let bestD = Infinity;
  for (const t of tiles) {
    if (t.kind !== "water") continue;
    const d = dist(s.x, s.y, t.x, t.y);
    if (d < bestD) { bestD = d; best = t; }
  }
  void mapW;
  return best;
}

function nearestCampfire(s: Survivor, buildings: Building[]): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const b of buildings) {
    if (b.kind !== "campfire" || b.builtProgress < 1) continue;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const d = dist(s.x, s.y, cx, cy);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

function nearestShelter(s: Survivor, buildings: Building[]): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const b of buildings) {
    if (b.builtProgress < 1) continue;
    if (!["tent", "cabin", "homestead"].includes(b.kind)) continue;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const d = dist(s.x, s.y, cx, cy);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

function setTarget(s: Survivor, x: number, y: number) {
  s.targetX = x;
  s.targetY = y;
  s.state = "moving";
}

// ── Needs decay ──────────────────────────────────────────────────
export function decayNeeds(s: Survivor, dt: number) {
  const k = dt / TICKS_PER_DAY;
  // Children consume less, elders more
  const ageMod = s.stage === "child" ? 0.55 : s.stage === "elder" ? 1.1 : 1;
  s.needs.food = Math.max(0, s.needs.food - 13 * k * ageMod);
  s.needs.water = Math.max(0, s.needs.water - 18 * k * ageMod);
  s.needs.rest = Math.max(0, s.needs.rest - 11 * k);
  s.needs.shelter = Math.max(0, s.needs.shelter - 6 * k);
  s.needs.belonging = Math.max(0, s.needs.belonging - 5 * k);
  s.needs.purpose = Math.max(0, s.needs.purpose - 4 * k);

  if (s.needs.food < 10 || s.needs.water < 10) {
    s.health = Math.max(0, s.health - 6 * k);
  } else if (s.health < 100 && s.needs.food > 50 && s.needs.water > 50 && s.needs.rest > 40) {
    s.health = Math.min(100, s.health + 4 * k);
  }

  const want = (s.needs.food + s.needs.water + s.needs.rest + s.needs.belonging + s.needs.purpose) / 5 - 40;
  s.mood = s.mood + (want - s.mood) * 0.02 * k * TICKS_PER_DAY;
  s.mood = Math.max(-100, Math.min(100, s.mood));
}

// ── Per-survivor AI ──────────────────────────────────────────────
export interface SimDeps {
  buildings: Building[];
  nodes: ResourceNode[];
  tiles: Tile[];
  mapW: number;
  tick: number;
  resources: Record<ResourceKind, number>;
  survivors: Survivor[];
  relationships: Relationship[];
  emitMemory: (s: Survivor, text: string, emotion: import("../types").Memory["emotion"], weight: number) => void;
}

const CARRY_CAP = 12;

export function tickSurvivor(s: Survivor, dt: number, deps: SimDeps) {
  if (s.health <= 0) return;

  // Children just follow parents / wander, no labor
  if (s.stage === "child" || s.stage === "teen") {
    if (s.state === "moving") { moveToward(s, dt); return; }
    if (s.needs.water < 28) {
      const w = nearestWater(s, deps.tiles, deps.mapW);
      if (w) {
        if (dist(s.x, s.y, w.x, w.y) < 1.2) {
          s.needs.water = Math.min(100, s.needs.water + 60);
          s.action = "Drinking.";
        } else { setTarget(s, w.x, w.y); s.action = "Going for water."; }
        return;
      }
    }
    if (s.needs.food < 30 && deps.resources.food > 0) {
      const sp = nearestStockpile(s, deps.buildings);
      if (sp) {
        const cx = sp.x + sp.w / 2, cy = sp.y + sp.h / 2;
        if (dist(s.x, s.y, cx, cy) < 1.5) {
          const eat = Math.min(deps.resources.food, 3);
          deps.resources.food -= eat;
          s.needs.food = Math.min(100, s.needs.food + eat * 12);
          s.action = "Eating beside the elders.";
        } else { setTarget(s, cx, cy); s.action = "Going to eat."; }
        return;
      }
    }
    // follow a parent if available
    const parent = deps.survivors.find(p => s.parentIds.includes(p.id) && p.health > 0);
    if (parent && dist(s.x, s.y, parent.x, parent.y) > 3) {
      setTarget(s, parent.x + (Math.random() - 0.5), parent.y + (Math.random() - 0.5));
      s.action = `Following ${parent.name}.`;
      return;
    }
    s.action = s.stage === "child" ? "Playing in the dirt." : "Learning the work.";
    s.state = "idle";
    // skill drift (slow learning)
    s.skills.forage = Math.min(30, s.skills.forage + 0.0004 * dt);
    s.skills.build = Math.min(30, s.skills.build + 0.0003 * dt);
    return;
  }

  if (s.state === "moving") {
    moveToward(s, dt);
    return;
  }

  // ── Construction commitment: assigned builders stay focused on their site,
  //    only interrupted by *critical* needs, and resume after eating/drinking.
  if (handleConstructionCommitment(s, dt, deps)) return;


  if (s.needs.water < 28) {
    const w = nearestWater(s, deps.tiles, deps.mapW);
    if (w) {
      if (dist(s.x, s.y, w.x, w.y) < 1.2) {
        s.needs.water = Math.min(100, s.needs.water + 60);
        s.state = "drinking";
        s.action = "Drinking at the water's edge.";
      } else {
        setTarget(s, w.x, w.y);
        s.action = "Going for water.";
      }
      return;
    }
  }

  if (s.needs.food < 30 && deps.resources.food > 0) {
    const sp = nearestStockpile(s, deps.buildings);
    if (sp) {
      const cx = sp.x + sp.w / 2, cy = sp.y + sp.h / 2;
      if (dist(s.x, s.y, cx, cy) < 1.5) {
        const eat = Math.min(deps.resources.food, 6);
        deps.resources.food -= eat;
        s.needs.food = Math.min(100, s.needs.food + eat * 10);
        s.state = "eating";
        s.action = "Eating from the stores.";
      } else {
        setTarget(s, cx, cy);
        s.action = "Heading to the stockpile to eat.";
      }
      return;
    }
  }

  if (s.needs.rest < 22) {
    const sh = nearestShelter(s, deps.buildings);
    if (sh) {
      const cx = sh.x + sh.w / 2, cy = sh.y + sh.h / 2;
      if (dist(s.x, s.y, cx, cy) < 1.0) {
        s.needs.rest = Math.min(100, s.needs.rest + 4);
        s.needs.shelter = Math.min(100, s.needs.shelter + 2);
        s.state = "resting";
        s.action = "Resting indoors.";
      } else {
        setTarget(s, cx, cy);
        s.action = "Going to rest.";
      }
      return;
    } else {
      s.needs.rest = Math.min(100, s.needs.rest + 2);
      s.state = "resting";
      s.action = "Sleeping on the ground.";
      return;
    }
  }

  if (s.carrying && s.carrying.amount > 0) {
    const sp = nearestStockpile(s, deps.buildings);
    if (sp) {
      const cx = sp.x + sp.w / 2, cy = sp.y + sp.h / 2;
      if (dist(s.x, s.y, cx, cy) < 1.2) {
        deps.resources[s.carrying.resource] += s.carrying.amount;
        s.action = `Dropped ${s.carrying.amount} ${s.carrying.resource}.`;
        s.carrying = null;
        s.state = "idle";
      } else {
        setTarget(s, cx, cy);
        s.action = "Hauling to the stockpile.";
      }
      return;
    } else {
      deps.resources[s.carrying.resource] += s.carrying.amount;
      s.carrying = null;
    }
  }

  // Construction priority:
  //   1. If this survivor is the assigned builder of any unfinished building → go there.
  //   2. Otherwise, builders / idle / leader / hauler / forager pitch in on the
  //      nearest unfinished site so construction never stalls when there's free labor.
  const assigned = deps.buildings.find(b => b.builtProgress < 1 && b.assignedBuilderId === s.id);
  const helpsBuild =
    !!assigned ||
    s.occupation === "builder" || s.occupation === "idle" ||
    s.occupation === "leader" || s.occupation === "hauler" ||
    s.occupation === "forager" || s.isFounder;
  if (helpsBuild) {
    const b = assigned ?? nearestUnfinished(s, deps.buildings);
    if (b) {
      normalizeConstructionBuilding(b);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      s.workTarget = { kind: "building", id: b.id };
      const isAssigned = assigned?.id === b.id;
      // Establish a long-running commitment for the assigned builder so they
      // stop thrashing between tasks each tick.
      if (isAssigned && (!s.commitment || s.commitment.buildingId !== b.id)) {
        s.commitment = { kind: "construction", buildingId: b.id, phase: "building", sinceTick: deps.tick };
      }
      if (!hasConstructionResources(b)) {
        s.action = `Waiting on materials for the ${b.kind}.`;
        s.state = "idle";
        return;
      }
      if (dist(s.x, s.y, cx, cy) < 1.6) {
        const isBuilder = s.occupation === "builder";
        const nearDone = b.builtProgress >= 0.75;
        const skillMult = 1 + (s.skills.build ?? 1) * 0.18;
        // Assigned = 100% priority. Helpers = lower. Near-completion bonus
        // makes everyone push to finish the last quarter.
        const roleMult = isAssigned ? 1.25 : isBuilder ? 0.85 : 0.6;
        const finishMult = nearDone ? 1.4 : 1.0;
        const work = skillMult * roleMult * finishMult * (dt / 24);
        applyConstructionWork(b, work, deps.tick);
        s.skills.build = Math.min(30, (s.skills.build ?? 1) + 0.003 * dt);
        s.state = "working";
        s.action = isAssigned ? `Building — ${b.kind}.` : `Lending hands at the ${b.kind}.`;
        if (b.builtProgress >= 1 && s.commitment?.buildingId === b.id) s.commitment = null;
      } else {
        setTarget(s, cx, cy);
        s.action = `Walking to the ${b.kind} build site.`;
      }
      return;
    }
  }


  {
    // Leaders do not chop wood themselves — they walk, talk, and tend the line.
    const isLeader = s.occupation === "leader" || s.isFounder;
    const wants: ResourceKind | null =
      isLeader ? null :
      s.occupation === "woodcutter" ? "wood" :
      s.occupation === "miner" ? "stone" :
      s.occupation === "farmer" ? "food" :
      s.occupation === "forager" ? "food" : "wood";
    const node = wants ? nearestNode(s, deps.nodes, wants) : null;
    if (wants && node && node.amount > 0) {
      if (dist(s.x, s.y, node.x, node.y) < 1.3) {
        const skill =
          wants === "wood" ? s.skills.cut :
          wants === "stone" ? s.skills.mine :
          wants === "food" ? s.skills.forage :
          1;
        const yieldAmt = Math.min(node.amount, Math.max(1, Math.floor((1 + skill * 0.4) * (dt / 24))));
        node.amount -= yieldAmt;
        s.carrying = {
          resource: wants,
          amount: (s.carrying?.amount ?? 0) + yieldAmt,
        };
        if (wants === "wood") s.skills.cut = Math.min(30, s.skills.cut + 0.0015 * dt);
        else if (wants === "stone") s.skills.mine = Math.min(30, s.skills.mine + 0.0015 * dt);
        else s.skills.forage = Math.min(30, s.skills.forage + 0.0015 * dt);
        s.state = "working";
        s.action = `Working at ${node.kind}.`;
        if ((s.carrying?.amount ?? 0) >= CARRY_CAP) {
          const sp = nearestStockpile(s, deps.buildings);
          if (sp) setTarget(s, sp.x + sp.w / 2, sp.y + sp.h / 2);
        }
      } else {
        setTarget(s, node.x, node.y);
        s.action = `Going to ${node.kind}.`;
      }
      return;
    }
    const fire = nearestCampfire(s, deps.buildings);
    if (fire && (s.needs.belonging < 70 || isLeader)) {
      const cx = fire.x + fire.w / 2, cy = fire.y + fire.h / 2;
      if (dist(s.x, s.y, cx, cy) < 1.4) {
        s.needs.belonging = Math.min(100, s.needs.belonging + 0.6);
        s.needs.purpose = Math.min(100, s.needs.purpose + 0.2);
        s.skills.social = Math.min(30, (s.skills.social ?? 1) + 0.0015 * dt);
        s.state = "socializing";
        s.action = "Sitting by the fire.";
        for (const o of deps.survivors) {
          if (o.id === s.id) continue;
          if (o.health <= 0) continue;
          if (dist(s.x, s.y, o.x, o.y) < 2) {
            // friendship + trust drift
            touchRelationship(deps.relationships, s.id, o.id, {
              affection: +0.02 * dt,
              trust: +0.005 * dt,
              friendship: +0.025 * dt,
              respect: +0.005 * dt,
            });
            // attraction only between fertile adults of opposite gender, both single
            const bothAdults =
              (s.stage === "adult" || s.stage === "youth") &&
              (o.stage === "adult" || o.stage === "youth");
            const oppositeGender = s.gender !== o.gender;
            const bothSingle = !s.spouseId && !o.spouseId;
            const notKin = !s.parentIds.includes(o.id) && !o.parentIds.includes(s.id)
              && !(s.parentIds.length > 0 && o.parentIds.length > 0
                   && s.parentIds.some(p => o.parentIds.includes(p)));
            if (bothAdults && oppositeGender && bothSingle && notKin) {
              touchRelationship(deps.relationships, s.id, o.id, {
                attraction: +0.04 * dt,
              });
            }
          }
        }
      } else {
        setTarget(s, cx, cy);
        s.action = "Wandering to the fire.";
      }
      return;
    }
    s.action = "Idling.";
    s.state = "idle";
    return;
  }
}

function getBuildEffort(b: Building): number {
  if (b.builtProgress >= 1) return 1;
  if (b.effortRemaining <= 0) return 1;
  return b.effortRemaining / (1 - b.builtProgress);
}

// ── Relationships ───────────────────────────────────────────────
export interface RelationshipDelta {
  affection?: number;
  trust?: number;
  respect?: number;
  attraction?: number;
  friendship?: number;
  rivalry?: number;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function ensureRelationship(rels: Relationship[], a: string, b: string): Relationship {
  let r = findRelationship(rels, a, b);
  if (!r) {
    r = {
      a, b,
      affection: 0, trust: 0, respect: 0,
      attraction: 0, friendship: 0, rivalry: 0,
      tag: "stranger", interactions: 0, marriedTick: null,
    };
    rels.push(r);
  }
  return r;
}

export function touchRelationship(
  rels: Relationship[],
  a: string,
  b: string,
  deltaOrAffection: number | RelationshipDelta,
  dTrust = 0,
) {
  const r = ensureRelationship(rels, a, b);
  const d: RelationshipDelta = typeof deltaOrAffection === "number"
    ? { affection: deltaOrAffection, trust: dTrust }
    : deltaOrAffection;

  if (d.affection) r.affection = clamp(r.affection + d.affection, -100, 100);
  if (d.trust)     r.trust     = clamp(r.trust + d.trust, -100, 100);
  if (d.respect)   r.respect   = clamp(r.respect + d.respect, -100, 100);
  if (d.attraction)r.attraction= clamp(r.attraction + d.attraction, -100, 100);
  if (d.friendship)r.friendship= clamp(r.friendship + d.friendship, -100, 100);
  if (d.rivalry)   r.rivalry   = clamp(r.rivalry + d.rivalry, 0, 100);
  r.interactions += 1;

  // Tag re-evaluated, respecting marriage/kin
  if (r.tag !== "spouse" && r.tag !== "kin") {
    if (r.affection > 60 && r.trust > 40) r.tag = "close-friend";
    else if (r.friendship > 30 || r.affection > 25) r.tag = "friend";
    else if (r.rivalry > 40 || r.affection < -40) r.tag = "enemy";
    else if (r.affection < -15) r.tag = "rival";
    else if (r.interactions > 4) r.tag = "acquaintance";
  }
}

export function markAsSpouses(rels: Relationship[], a: string, b: string, tick: number) {
  const r = ensureRelationship(rels, a, b);
  r.tag = "spouse";
  r.marriedTick = tick;
  r.affection = Math.max(r.affection, 70);
  r.trust = Math.max(r.trust, 60);
  r.respect = Math.max(r.respect, 40);
}

export function markAsKin(rels: Relationship[], a: string, b: string) {
  const r = ensureRelationship(rels, a, b);
  r.tag = "kin";
  r.affection = Math.max(r.affection, 50);
  r.trust = Math.max(r.trust, 40);
}

// ── Opinion summary ──────────────────────────────────────────────
// Combine affection + friendship + trust into a single -100..+100 score
// and label it for the UI per the design spec.
export function opinionScore(r: import("../types").Relationship): number {
  const raw = r.affection * 0.55 + r.friendship * 0.25 + r.trust * 0.2 - r.rivalry * 0.3;
  return Math.max(-100, Math.min(100, raw));
}

export function opinionLabel(score: number, tag?: import("../types").RelationshipTag): string {
  if (tag === "spouse") return "Spouse";
  if (tag === "kin") return "Kin";
  if (score >= 75) return "Best Friend";
  if (score >= 40) return "Friend";
  if (score >= 10) return "Acquaintance";
  if (score > -10) return "Neutral";
  if (score > -40) return "Dislikes";
  if (score > -75) return "Rival";
  return "Enemy";
}
