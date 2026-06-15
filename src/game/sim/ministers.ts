// Ministers / Administration system.
//
// Ministers are Founder-appointed department heads. They do not directly
// command workers; instead they generate requests the Founder can approve
// (fully or partially), reject, or postpone. They track satisfaction based
// on staffing levels and approval history; satisfaction in turn shapes
// their loyalty to the Founder and the periodic reports they issue.

import { nanoid } from "nanoid";
import type {
  Building, ID, Minister, MinisterRequest, MinisterReport, MinisterRole,
  Animal, Family, Survivor, Memory, Season,
} from "../types";

export const TICKS_PER_DAY = 24;

export const ROLE_LABEL: Record<MinisterRole, string> = {
  "head-farmer": "Farm Manager",
  "head-builder": "Build Manager",
  "head-rancher": "Ranch Manager",
  "quartermaster": "Stores Manager",
};

export const ROLE_BLURB: Record<MinisterRole, string> = {
  "head-farmer": "Oversees fields, crops, and harvests. Assigns farmers.",
  "head-builder": "Directs construction and repairs. Assigns builders.",
  "head-rancher": "Tends livestock and pens. Assigns ranchers.",
  "quartermaster": "Runs storage, hauling, and supply. Assigns haulers.",
};


export const ROLE_OCCUPATION: Record<MinisterRole, Survivor["occupation"]> = {
  "head-farmer": "farmer",
  "head-builder": "builder",
  "head-rancher": "rancher",
  "quartermaster": "hauler",
};

export const ROLE_SKILL: Record<MinisterRole, keyof Survivor["skills"]> = {
  "head-farmer": "farm",
  "head-builder": "build",
  "head-rancher": "ranch" as any,
  "quartermaster": "lead",
};

export const ALL_ROLES: MinisterRole[] = [
  "head-farmer", "head-builder", "head-rancher", "quartermaster",
];

const PRODUCTION_KINDS = new Set([
  "workbench", "well", "water-collector", "foraging-camp", "stockpile",
]);

export interface DepartmentStatus {
  role: MinisterRole;
  needed: number;
  assigned: number;
  ratio: number;     // assigned / max(1, needed)
  status: "understaffed" | "adequate" | "well-staffed";
}

export function computeDepartments(deps: {
  survivors: Survivor[];
  buildings: Building[];
  animals: Animal[];
}): DepartmentStatus[] {
  const alive = deps.survivors.filter((s) => s.health > 0);
  const counts: Record<Survivor["occupation"], number> = {
    idle: 0, forager: 0, woodcutter: 0, miner: 0, farmer: 0,
    builder: 0, hauler: 0, leader: 0, rancher: 0,
  };
  for (const s of alive) counts[s.occupation] = (counts[s.occupation] ?? 0) + 1;

  const builtFarms = deps.buildings.filter(
    (b) => b.kind === "farm-plot" && b.builtProgress >= 1,
  ).length;
  const inProgress = deps.buildings.filter((b) => b.builtProgress < 1).length;
  const liveAnimals = deps.animals.filter((a) => !a.dead).length;
  const prod = deps.buildings.filter(
    (b) => b.builtProgress >= 1 && PRODUCTION_KINDS.has(b.kind),
  ).length;

  const need: Record<MinisterRole, number> = {
    "head-farmer": Math.max(1, builtFarms),
    "head-builder": Math.max(0, Math.ceil(inProgress * 0.6)),
    "head-rancher": liveAnimals > 0 ? Math.max(1, Math.ceil(liveAnimals / 6)) : 0,
    "quartermaster": Math.max(1, Math.ceil(prod / 2)),
  };

  return ALL_ROLES.map<DepartmentStatus>((role) => {
    const occ = ROLE_OCCUPATION[role];
    const assigned = counts[occ];
    const needed = need[role];
    const ratio = needed > 0 ? assigned / needed : 1;
    const status: DepartmentStatus["status"] =
      ratio < 0.7 ? "understaffed" : ratio > 1.25 ? "well-staffed" : "adequate";
    return { role, needed, assigned, ratio, status };
  });
}

export function makeMinister(role: MinisterRole, survivorId: ID, tick: number): Minister {
  return {
    id: nanoid(8),
    role,
    survivorId,
    appointedTick: tick,
    satisfaction: 60,
    requestsApproved: 0,
    requestsRejected: 0,
    lastRequestTick: null,
    lastReportTick: null,
  };
}

export function dailyMinistersTick(deps: {
  time: { tick: number; year: number; season: Season; day: number };
  ministers: Minister[];
  ministerRequests: MinisterRequest[];
  ministerReports: MinisterReport[];
  survivors: Survivor[];
  buildings: Building[];
  animals: Animal[];
  families: Family[];
  founderId: ID;
}, rng: () => number) {
  const departments = computeDepartments(deps);
  const depByRole = new Map(departments.map((d) => [d.role, d] as const));

  // Drop ministers whose survivor died.
  deps.ministers.splice(
    0, deps.ministers.length,
    ...deps.ministers.filter((m) => {
      const s = deps.survivors.find((x) => x.id === m.survivorId);
      return s && s.health > 0;
    }),
  );

  for (const m of deps.ministers) {
    const dept = depByRole.get(m.role);
    if (!dept) continue;
    const ratio = dept.needed > 0 ? Math.min(2, dept.assigned / dept.needed) : 1;
    const target = Math.max(0, Math.min(100, Math.round(ratio * 60 + 20)));
    m.satisfaction = m.satisfaction + Math.sign(target - m.satisfaction)
      * Math.min(1.2, Math.abs(target - m.satisfaction) * 0.15);
    if (dept.status === "understaffed") m.satisfaction = Math.max(0, m.satisfaction - 0.4);

    const s = deps.survivors.find((x) => x.id === m.survivorId);
    if (s) {
      const delta = (m.satisfaction - 50) / 50 * 0.25;
      s.loyaltyToFounder = Math.max(-100, Math.min(100, s.loyaltyToFounder + delta));
    }

    // Periodic reports (~ every 30 days). No staffing requests — managers
    // handle their own labor (see autoAssignWorkers).
    if (m.lastReportTick == null || deps.time.tick - m.lastReportTick >= TICKS_PER_DAY * 30) {
      m.lastReportTick = deps.time.tick;
      const report: MinisterReport = {
        id: nanoid(8),
        ministerId: m.id,
        role: m.role,
        tick: deps.time.tick,
        year: deps.time.year,
        season: deps.time.season,
        day: deps.time.day,
        text: composeReport(m.role, dept, m.satisfaction),
        tone: dept.status === "understaffed" ? "negative" :
              dept.status === "well-staffed" ? "positive" : "neutral",
      };
      deps.ministerReports.unshift(report);
      while (deps.ministerReports.length > 40) deps.ministerReports.pop();
    }
  }
}




function composeReport(role: MinisterRole, dept: DepartmentStatus, sat: number): string {
  const status = dept.status === "understaffed"
    ? "We are short-handed"
    : dept.status === "well-staffed"
      ? "We are well-staffed"
      : "Staffing is adequate";
  const mood = sat >= 70 ? "and morale is good." :
               sat <= 30 ? "and patience is wearing thin." :
                           "and we hold steady.";
  switch (role) {
    case "head-farmer": return `${status} in the fields — ${dept.assigned}/${dept.needed} hands ${mood}`;
    case "head-builder": return `${status} on the sites — ${dept.assigned}/${dept.needed} hands ${mood}`;
    case "head-rancher": return `${status} with the herds — ${dept.assigned}/${dept.needed} hands ${mood}`;
    case "quartermaster": return `${status} at the stores — ${dept.assigned}/${dept.needed} hands ${mood}`;
    default: return `${status} — ${dept.assigned}/${dept.needed} hands ${mood}`;
  }
}

/**
 * Manager autonomy — simple model:
 *  • A manager is always working their department's job (Head Builder = builder).
 *  • Each day they pull idle survivors into the department until staffing meets need.
 *  • They NEVER reassign survivors the Founder or another manager already placed.
 *  • The Founder may freely reassign or remove anyone — including workers a
 *    manager recruited — and the manager will not yank them back unless they
 *    return to "idle".
 */
export function autoAssignWorkers(deps: {
  ministers: Minister[];
  survivors: Survivor[];
  buildings: Building[];
  animals: Animal[];
  founderId: ID;
}) {
  const depByRole = new Map(
    computeDepartments({
      survivors: deps.survivors,
      buildings: deps.buildings,
      animals: deps.animals,
    }).map((d) => [d.role, d] as const),
  );

  for (const m of deps.ministers) {
    const dept = depByRole.get(m.role);
    if (!dept) continue;
    const targetOcc = ROLE_OCCUPATION[m.role];
    const skillKey = ROLE_SKILL[m.role];
    const minS = deps.survivors.find((s) => s.id === m.survivorId);

    // Manager always works their role.
    if (minS && minS.health > 0 && minS.occupation !== targetOcc) {
      minS.occupation = targetOcc;
    }

    // Recruit idle survivors to fill the gap. Workers count includes the
    // manager themselves since they are doing the job.
    const teamSize = deps.survivors.filter(
      (s) => s.health > 0 && s.occupation === targetOcc,
    ).length;
    const gap = Math.max(0, dept.needed - teamSize);

    if (gap > 0) {
      const takenIds = new Set(deps.ministers.map((x) => x.survivorId));
      const candidates = deps.survivors.filter((s) =>
        s.health > 0 &&
        (s.stage === "adult" || s.stage === "youth" || s.stage === "elder") &&
        s.id !== deps.founderId &&
        !takenIds.has(s.id) &&
        s.occupation === "idle" &&
        !s.workTarget,
      );
      candidates.sort((a, b) => {
        const sa = ((a.skills as any)[skillKey]) ?? 1;
        const sb = ((b.skills as any)[skillKey]) ?? 1;
        return sb - sa;
      });
      const pick = candidates.slice(0, gap);
      for (const s of pick) s.occupation = targetOcc;
      if (pick.length > 0) {
        m.satisfaction = Math.min(100, m.satisfaction + 2 * pick.length);
      }
    }


    // Managers also stick hands to specific stations so production starts.
    if (m.role === "head-farmer") {
      const farmers = deps.survivors.filter(
        (s) => s.health > 0 && s.occupation === "farmer",
      );
      const taken = new Set(
        deps.buildings
          .filter((b) => b.kind === "farm-plot" && b.farm?.assignedFarmerId)
          .map((b) => b.farm!.assignedFarmerId!),
      );
      const free = farmers.filter((s) => !taken.has(s.id));
      for (const b of deps.buildings) {
        if (b.kind !== "farm-plot" || !b.farm || b.builtProgress < 1) continue;
        if (b.farm.assignedFarmerId) continue;
        const f = free.shift();
        if (!f) break;
        b.farm.assignedFarmerId = f.id;
      }
    }
    if (m.role === "head-rancher") {
      const ranchers = deps.survivors.filter(
        (s) => s.health > 0 && s.occupation === "rancher",
      );
      const taken = new Set(
        deps.buildings.filter((b) => b.assignedWorkerId).map((b) => b.assignedWorkerId!),
      );
      const free = ranchers.filter((s) => !taken.has(s.id));
      for (const b of deps.buildings) {
        const isPen = b.kind === "chicken-coop" || b.kind === "goat-pen" ||
          b.kind === "sheep-pen" || b.kind === "cattle-pasture";
        if (!isPen || b.builtProgress < 1) continue;
        if (b.assignedWorkerId) continue;
        const f = free.shift();
        if (!f) break;
        b.assignedWorkerId = f.id;
      }
    }
  }
}


/** Apply an approval (full or partial) to a minister request. */
export function applyApproval(deps: {
  request: MinisterRequest;
  minister: Minister;
  survivors: Survivor[];
  founderId: ID;
  time: { tick: number; year: number; season: Season; day: number };
  approvedCount: number;
  transferredIds: ID[]; // survivors being reassigned
}) {
  const { request: req, minister: m, approvedCount } = deps;
  req.approvedWorkers = approvedCount;
  req.status = approvedCount >= req.requestedWorkers ? "approved" : "partial";
  m.requestsApproved += 1;
  // satisfaction bump scaled to coverage
  const cov = approvedCount / Math.max(1, req.requestedWorkers);
  m.satisfaction = Math.min(100, m.satisfaction + 8 + 12 * cov);

  const minS = deps.survivors.find((s) => s.id === m.survivorId);
  if (minS) {
    minS.loyaltyToFounder = Math.min(100, minS.loyaltyToFounder + 6 + Math.round(8 * cov));
    minS.mood = Math.min(100, minS.mood + 6);
    pushMemory(minS, deps.time, deps.founderId,
      cov >= 0.99
        ? `The Founder gave me everything I asked for.`
        : `The Founder granted part of what I asked.`,
      "trust", 50, "minister-approved", 18, 0.3,
    );
  }
}

export function applyRejection(deps: {
  request: MinisterRequest;
  minister: Minister;
  survivors: Survivor[];
  founderId: ID;
  time: { tick: number; year: number; season: Season; day: number };
}) {
  const { request: req, minister: m } = deps;
  req.status = "rejected";
  m.requestsRejected += 1;
  m.satisfaction = Math.max(0, m.satisfaction - 14);
  const minS = deps.survivors.find((s) => s.id === m.survivorId);
  if (minS) {
    minS.loyaltyToFounder = Math.max(-100, minS.loyaltyToFounder - 8);
    minS.mood = Math.max(-100, minS.mood - 6);
    const repeated = m.requestsRejected >= 2;
    pushMemory(minS, deps.time, deps.founderId,
      repeated
        ? `The Founder has repeatedly ignored my requests.`
        : `The Founder refused my request for workers.`,
      "anger", repeated ? 60 : 40, "minister-rejected",
      repeated ? 25 : 12, 0.4,
    );
  }
}

function pushMemory(
  s: Survivor,
  time: { tick: number; year: number; season: Season; day: number },
  aboutId: ID,
  text: string,
  emotion: Memory["emotion"],
  weight: number,
  kind: string,
  floor: number,
  decayRate: number,
) {
  s.memories.unshift({
    id: nanoid(6),
    tick: time.tick,
    year: time.year,
    season: time.season,
    day: time.day,
    text, emotion, weight,
    aboutSurvivorId: aboutId,
    kind, floor, decayRate,
  });
  if (s.memories.length > 64) s.memories.pop();
}

/** Pick the best candidate survivor for a ministerial role (excluding the founder). */
export function suggestMinisterCandidates(
  role: MinisterRole,
  survivors: Survivor[],
  ministers: Minister[],
  founderId: ID,
): Survivor[] {
  const skill = ROLE_SKILL[role];
  const taken = new Set(ministers.map((m) => m.survivorId));
  return survivors
    .filter((s) =>
      s.health > 0 &&
      (s.stage === "adult" || s.stage === "elder" || s.stage === "youth") &&
      !taken.has(s.id) &&
      s.id !== founderId,
    )
    .sort((a, b) => {
      const sa = (a.skills as any)[skill] ?? 1;
      const sb = (b.skills as any)[skill] ?? 1;
      if (sa !== sb) return sb - sa;
      return (b.skills.lead ?? 1) - (a.skills.lead ?? 1);
    });
}
