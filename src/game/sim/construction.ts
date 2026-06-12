import { BUILDINGS } from "../data/content";
import type { Building, ResourceKind, Survivor } from "../types";

export type ConstructionStatus =
  | "Waiting For Builder"
  | "Waiting For Resources"
  | "Under Construction"
  | "Completed";

export const STALL_RECOVERY_TICKS = 180;

const LABOR_STAGES = new Set(["youth", "adult", "elder"]);

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function canConstruct(s: Survivor): boolean {
  return s.health > 0 && (s.isFounder || LABOR_STAGES.has(s.stage));
}

export function requiredConstructionResources(b: Building): Partial<Record<ResourceKind, number>> {
  return { ...BUILDINGS[b.kind].cost };
}

export function normalizeConstructionBuilding(b: Building) {
  const def = BUILDINGS[b.kind];
  if (!b.resourcesDelivered) {
    b.resourcesDelivered = Object.fromEntries(
      Object.entries(def.cost).map(([resource, amount]) => [resource, amount ?? 0]),
    ) as Partial<Record<ResourceKind, number>>;
  } else {
    for (const [resource, amount] of Object.entries(b.resourcesDelivered) as [ResourceKind, number][]) {
      b.resourcesDelivered[resource] = clamp(amount ?? 0, 0, def.cost[resource] ?? amount ?? 0);
    }
  }

  if (def.buildEffort <= 0) {
    b.buildEffortTotal = 0;
    b.effortRemaining = 0;
    b.builtProgress = 1;
    b.stalledTicks = 0;
    return;
  }

  const total = Math.max(1, b.buildEffortTotal || def.buildEffort || b.effortRemaining || 1);
  b.buildEffortTotal = total;
  b.builtProgress = clamp(b.builtProgress || 0, 0, 1);
  b.effortRemaining = clamp(b.effortRemaining ?? total, 0, total);

  const progressRemaining = total * (1 - b.builtProgress);
  if (b.builtProgress > 0 && b.effortRemaining > progressRemaining) {
    b.effortRemaining = progressRemaining;
  }

  if (b.effortRemaining <= 0 || b.builtProgress >= 1) {
    b.effortRemaining = 0;
    b.builtProgress = 1;
    b.stalledTicks = 0;
    return;
  }

  b.builtProgress = Math.max(b.builtProgress, clamp(1 - b.effortRemaining / total, 0, 0.999));
  b.stalledTicks = b.stalledTicks ?? 0;
}

export function missingConstructionResources(b: Building): Partial<Record<ResourceKind, number>> {
  normalizeConstructionBuilding(b);
  const missing: Partial<Record<ResourceKind, number>> = {};
  for (const [resource, amount] of Object.entries(requiredConstructionResources(b)) as [ResourceKind, number][]) {
    const need = Math.max(0, (amount ?? 0) - (b.resourcesDelivered?.[resource] ?? 0));
    if (need > 0) missing[resource] = need;
  }
  return missing;
}

export function hasConstructionResources(b: Building): boolean {
  return Object.keys(missingConstructionResources(b)).length === 0;
}

export function constructionEffortCompleted(b: Building): number {
  normalizeConstructionBuilding(b);
  return Math.max(0, b.buildEffortTotal - b.effortRemaining);
}

export function constructionStatus(b: Building, survivors: Survivor[]): ConstructionStatus {
  normalizeConstructionBuilding(b);
  if (b.builtProgress >= 1) return "Completed";
  if (!hasConstructionResources(b)) return "Waiting For Resources";
  const builder = b.assignedBuilderId ? survivors.find(s => s.id === b.assignedBuilderId && canConstruct(s)) : null;
  const anyoneCanHelp = survivors.some(canConstruct);
  if (!builder && !anyoneCanHelp) return "Waiting For Builder";
  if (builder && builder.workTarget?.kind === "building" && builder.workTarget.id === b.id) return "Under Construction";
  return b.builtProgress > 0 || (b.stalledTicks ?? 0) > 0 ? "Under Construction" : "Waiting For Builder";
}

export function applyConstructionWork(b: Building, amount: number, tick: number) {
  normalizeConstructionBuilding(b);
  if (b.builtProgress >= 1 || amount <= 0 || !hasConstructionResources(b)) return 0;
  const before = b.effortRemaining;
  b.effortRemaining = Math.max(0, b.effortRemaining - amount);
  b.builtProgress = b.effortRemaining <= 0
    ? 1
    : clamp(1 - b.effortRemaining / Math.max(1, b.buildEffortTotal), 0, 0.999);
  const worked = Math.max(0, before - b.effortRemaining);
  if (worked > 0) {
    b.lastWorkedTick = tick;
    b.stalledTicks = 0;
  }
  return worked;
}

export function recoverStalledConstruction(
  buildings: Building[],
  survivors: Survivor[],
  tick: number,
  previousEffort: Map<string, number>,
) {
  const workers = survivors.filter(canConstruct);
  for (const b of buildings) {
    normalizeConstructionBuilding(b);
    if (b.builtProgress >= 1 || !hasConstructionResources(b)) continue;
    const before = previousEffort.get(b.id);
    if (before != null && b.effortRemaining < before - 0.0001) {
      b.lastWorkedTick = tick;
      b.stalledTicks = 0;
      continue;
    }

    let builder = b.assignedBuilderId ? workers.find(s => s.id === b.assignedBuilderId) : null;
    if (b.assignedBuilderId && !builder) {
      builder = bestBuilderForSite(workers, b);
      b.assignedBuilderId = builder?.id ?? null;
    }
    if (!builder && (b.stalledTicks ?? 0) >= STALL_RECOVERY_TICKS) {
      builder = bestBuilderForSite(workers, b);
      b.assignedBuilderId = builder?.id ?? null;
    }
    if (!builder) continue;

    b.stalledTicks = (b.stalledTicks ?? 0) + 1;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    builder.workTarget = { kind: "building", id: b.id };
    if (dist(builder.x, builder.y, cx, cy) > 1.6) {
      builder.targetX = cx;
      builder.targetY = cy;
      builder.state = "moving";
      builder.action = `Returning to the ${b.kind} build site.`;
      if ((b.stalledTicks ?? 0) >= STALL_RECOVERY_TICKS * 2) {
        const skillMult = 1 + (builder.skills.build ?? 1) * 0.08;
        applyConstructionWork(b, skillMult * (1 / 48), tick);
      }
      continue;
    }

    if ((b.stalledTicks ?? 0) >= STALL_RECOVERY_TICKS) {
      const skillMult = 1 + (builder.skills.build ?? 1) * 0.16;
      applyConstructionWork(b, skillMult * (1 / 24), tick);
      builder.state = "working";
      builder.action = `Recovering stalled work on the ${b.kind}.`;
    }
  }
}

function bestBuilderForSite(workers: Survivor[], b: Building): Survivor | null {
  if (workers.length === 0) return null;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return [...workers].sort((a, c) => {
    const skill = (c.skills.build ?? 1) - (a.skills.build ?? 1);
    if (skill !== 0) return skill;
    return dist(a.x, a.y, cx, cy) - dist(c.x, c.y, cx, cy);
  })[0] ?? null;
}