import type {
  Building, Relationship, ResourceKind, ResourceNode, Survivor, Tile,
} from "../types";

export const TICKS_PER_DAY = 240; // 4 hour-blocks of 60 ticks roughly
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
  const speed = 0.04 * dt; // tiles per tick
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
  let best: Building | null = null;
  let bestD = Infinity;
  for (const b of buildings) {
    if (b.builtProgress >= 1) continue;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const d = dist(s.x, s.y, cx, cy);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
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

// ── Needs decay (per tick) ──────────────────────────────────────
export function decayNeeds(s: Survivor, dt: number) {
  const k = dt / TICKS_PER_DAY;
  s.needs.food = Math.max(0, s.needs.food - 18 * k);
  s.needs.water = Math.max(0, s.needs.water - 24 * k);
  s.needs.rest = Math.max(0, s.needs.rest - 12 * k);
  s.needs.shelter = Math.max(0, s.needs.shelter - 6 * k);
  s.needs.belonging = Math.max(0, s.needs.belonging - 5 * k);
  s.needs.purpose = Math.max(0, s.needs.purpose - 4 * k);

  // Health bleeds when needs are critical
  if (s.needs.food < 10 || s.needs.water < 10) {
    s.health = Math.max(0, s.health - 8 * k);
  } else if (s.health < 100 && s.needs.food > 50 && s.needs.water > 50 && s.needs.rest > 40) {
    s.health = Math.min(100, s.health + 4 * k);
  }

  // Mood drifts toward composite
  const want = (s.needs.food + s.needs.water + s.needs.rest + s.needs.belonging + s.needs.purpose) / 5 - 40;
  s.mood = s.mood + (want - s.mood) * 0.02 * k * TICKS_PER_DAY;
  s.mood = Math.max(-100, Math.min(100, s.mood));
}

// ── Per-survivor AI step ────────────────────────────────────────
export interface SimDeps {
  buildings: Building[];
  nodes: ResourceNode[];
  tiles: Tile[];
  mapW: number;
  resources: Record<ResourceKind, number>;
  survivors: Survivor[];
  relationships: Relationship[];
  emitMemory: (s: Survivor, text: string, emotion: import("../types").Memory["emotion"], weight: number) => void;
}

const CARRY_CAP = 12;

export function tickSurvivor(s: Survivor, dt: number, deps: SimDeps) {
  if (s.health <= 0) return;

  // While moving — keep moving until at target
  if (s.state === "moving") {
    moveToward(s, dt);
    return;
  }

  // Urgent need overrides
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
      // sleep where they stand
      s.needs.rest = Math.min(100, s.needs.rest + 2);
      s.state = "resting";
      s.action = "Sleeping on the ground.";
      return;
    }
  }

  // Carrying? Drop at stockpile.
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
      // no stockpile yet — drop into global pool anyway (homestead implicitly)
      deps.resources[s.carrying.resource] += s.carrying.amount;
      s.carrying = null;
    }
  }

  // Occupation behavior
  switch (s.occupation) {
    case "builder": {
      const b = nearestUnfinished(s, deps.buildings);
      if (b) {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        if (dist(s.x, s.y, cx, cy) < 1.3) {
          const work = (1 + s.skills.build * 0.18) * (dt / 30);
          b.effortRemaining = Math.max(0, b.effortRemaining - work);
          const def = (1 - b.effortRemaining / Math.max(1, getBuildEffort(b)));
          b.builtProgress = Math.max(b.builtProgress, def);
          if (b.effortRemaining <= 0) b.builtProgress = 1;
          s.skills.build = Math.min(10, s.skills.build + 0.002 * dt);
          s.state = "working";
          s.action = `Building the ${b.kind}.`;
        } else {
          setTarget(s, cx, cy);
          s.action = `Walking to the ${b.kind} build site.`;
        }
        return;
      }
      // nothing to build, fall through to forage
    }
    /* falls through */
    case "forager":
    case "woodcutter":
    case "miner":
    case "farmer":
    case "hauler":
    case "leader":
    case "idle": {
      const wants: ResourceKind =
        s.occupation === "woodcutter" ? "wood" :
        s.occupation === "miner" ? "stone" :
        s.occupation === "farmer" ? "food" :
        s.occupation === "forager" ? "food" : "wood";
      const node = nearestNode(s, deps.nodes, wants);
      if (node && node.amount > 0) {
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
          // skill grows
          if (wants === "wood") s.skills.cut = Math.min(10, s.skills.cut + 0.0015 * dt);
          else if (wants === "stone") s.skills.mine = Math.min(10, s.skills.mine + 0.0015 * dt);
          else s.skills.forage = Math.min(10, s.skills.forage + 0.0015 * dt);
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
      // socialize when nothing else to do and there's a campfire
      const fire = nearestCampfire(s, deps.buildings);
      if (fire && s.needs.belonging < 70) {
        const cx = fire.x + fire.w / 2, cy = fire.y + fire.h / 2;
        if (dist(s.x, s.y, cx, cy) < 1.4) {
          s.needs.belonging = Math.min(100, s.needs.belonging + 0.6);
          s.needs.purpose = Math.min(100, s.needs.purpose + 0.2);
          s.state = "socializing";
          s.action = "Sitting by the fire.";
          // small relationship pulse
          for (const o of deps.survivors) {
            if (o.id === s.id) continue;
            if (dist(s.x, s.y, o.x, o.y) < 2) {
              touchRelationship(deps.relationships, s.id, o.id, +0.02 * dt, +0.005 * dt);
            }
          }
        } else {
          setTarget(s, cx, cy);
          s.action = "Wandering to the fire.";
        }
        return;
      }
      // truly idle: drift
      s.action = "Idling.";
      s.state = "idle";
      return;
    }
  }
}

function getBuildEffort(b: Building): number {
  // recovery for percentage; we store effortRemaining and need original
  // we approximate with current builtProgress + remaining. Avoid div by 0.
  if (b.builtProgress >= 1) return 1;
  if (b.effortRemaining <= 0) return 1;
  return b.effortRemaining / (1 - b.builtProgress);
}

// ── Relationships ───────────────────────────────────────────────
export function touchRelationship(
  rels: Relationship[],
  a: string,
  b: string,
  dAffection: number,
  dTrust: number,
) {
  let r = findRelationship(rels, a, b);
  if (!r) {
    r = { a, b, affection: 0, trust: 0, tag: "stranger", interactions: 0 };
    rels.push(r);
  }
  r.affection = clamp(r.affection + dAffection, -100, 100);
  r.trust = clamp(r.trust + dTrust, -100, 100);
  r.interactions += 1;
  // tag re-evaluated
  if (r.affection > 60 && r.trust > 40) r.tag = "close-friend";
  else if (r.affection > 25) r.tag = "friend";
  else if (r.affection < -40) r.tag = "enemy";
  else if (r.affection < -15) r.tag = "rival";
  else if (r.interactions > 4) r.tag = "acquaintance";
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
