// THE RANCH — Visual mood system.
// Maps the numeric -100..100 `mood` score onto an 8-level face scale and
// derives human-readable reasons from observable survivor state.

import type { Building, Survivor } from "../types";
import { homeQuality, homeCapacity, isResidential } from "./housing";

export type MoodLevel =
  | "over-the-moon"
  | "very-happy"
  | "happy"
  | "content"
  | "neutral"
  | "annoyed"
  | "angry"
  | "furious";

export interface MoodFaceInfo {
  level: MoodLevel;
  emoji: string;
  label: string;
  /** Tailwind text color class. */
  tone: string;
}

export function moodFace(mood: number): MoodFaceInfo {
  const m = mood ?? 0;
  if (m >= 70)  return { level: "over-the-moon", emoji: "😇", label: "Over the Moon", tone: "text-success" };
  if (m >= 45)  return { level: "very-happy",    emoji: "😁", label: "Very Happy",    tone: "text-success" };
  if (m >= 20)  return { level: "happy",         emoji: "🙂", label: "Happy",         tone: "text-success" };
  if (m >= 5)   return { level: "content",       emoji: "😐", label: "Content",       tone: "text-amber" };
  if (m >= -10) return { level: "neutral",       emoji: "😑", label: "Neutral",       tone: "text-dust-light" };
  if (m >= -30) return { level: "annoyed",       emoji: "😒", label: "Annoyed",       tone: "text-dust" };
  if (m >= -60) return { level: "angry",         emoji: "😠", label: "Angry",         tone: "text-danger" };
  return            { level: "furious",       emoji: "🤬", label: "Furious",       tone: "text-danger" };
}

/** Round a settlement-wide average (e.g. family avg mood) to a face. */
export function moodFaceFromAvg(avg: number): MoodFaceInfo {
  // Family/settlement averages are typically tighter; widen the buckets a bit.
  return moodFace(avg * 1.2);
}

export interface MoodReason {
  label: string;
  weight: number;   // signed; magnitude roughly comparable to per-day mood drift
  category:
    | "housing" | "food" | "family" | "relationships"
    | "politics" | "work" | "health" | "memory";
}

export interface MoodReasonsCtx {
  buildings: Building[];
  survivors: Survivor[];
}

/** Build a human-readable reason list for the survivor's current mood. */
export function computeMoodReasons(s: Survivor, ctx: MoodReasonsCtx): MoodReason[] {
  const out: MoodReason[] = [];
  const home = s.homeId ? ctx.buildings.find(b => b.id === s.homeId) ?? null : null;

  // ── Housing ────────────────────────────────────────────────
  if (!home || !isResidential(home.kind)) {
    out.push({ label: "Homeless — sleeping rough", weight: -18, category: "housing" });
  } else {
    const q = homeQuality(home);
    const cap = homeCapacity(home);
    const occ = ctx.survivors.filter(o => o.homeId === home.id && o.health > 0);
    const over = occ.length - cap;
    if (over > 0) {
      out.push({ label: `Overcrowded home (+${over} over capacity)`, weight: -6 - over * 3, category: "housing" });
    }
    if (q >= 4) {
      out.push({ label: "Excellent housing", weight: 8, category: "housing" });
    } else if (q <= 1 && over <= 0) {
      out.push({ label: "Cramped, low-quality shelter", weight: -4, category: "housing" });
    }
    const grat = s.housingGratitude ?? 0;
    if (grat > 2) {
      out.push({ label: "Recently upgraded home", weight: Math.round(grat), category: "housing" });
    }
  }

  // ── Food / water ───────────────────────────────────────────
  const food = s.needs?.food ?? 100;
  if (food <= 25) out.push({ label: "Starving", weight: -16, category: "food" });
  else if (food <= 45) out.push({ label: "Hungry", weight: -8, category: "food" });
  else if (food >= 85) out.push({ label: "Well fed", weight: 4, category: "food" });

  const water = s.needs?.water ?? 100;
  if (water <= 30) out.push({ label: "Thirsty", weight: -6, category: "food" });

  const rest = s.needs?.rest ?? 100;
  if (rest <= 25) out.push({ label: "Exhausted", weight: -6, category: "work" });

  // ── Family ─────────────────────────────────────────────────
  if (s.spouseId) {
    const sp = ctx.survivors.find(x => x.id === s.spouseId);
    if (sp && sp.health > 0) {
      out.push({ label: `Married to ${sp.name}`, weight: 6, category: "family" });
    }
  }
  if (s.fianceId) {
    const f = ctx.survivors.find(x => x.id === s.fianceId);
    if (f && f.health > 0) {
      out.push({ label: `Engaged to ${f.name}`, weight: 3, category: "family" });
    }
  }

  // ── Health ─────────────────────────────────────────────────
  if (s.health > 0 && s.health < 30) {
    out.push({ label: "Badly injured", weight: -10, category: "health" });
  } else if (s.health > 0 && s.health < 60) {
    out.push({ label: "Recovering from injury", weight: -3, category: "health" });
  } else if (s.health >= 95) {
    out.push({ label: "In fine health", weight: 2, category: "health" });
  }

  // ── Relationships / belonging ──────────────────────────────
  const belonging = s.needs?.belonging ?? 50;
  if (belonging <= 25) out.push({ label: "Lonely — few close ties", weight: -5, category: "relationships" });
  else if (belonging >= 80) out.push({ label: "Surrounded by close friends", weight: 4, category: "relationships" });

  const purpose = s.needs?.purpose ?? 50;
  if (s.occupation === "idle") {
    out.push({ label: "Unemployed, no role to fill", weight: -5, category: "work" });
  } else if (purpose >= 75) {
    out.push({ label: `Enjoys work as ${s.occupation}`, weight: 3, category: "work" });
  } else if (purpose <= 25) {
    out.push({ label: "Feels their work is meaningless", weight: -4, category: "work" });
  }

  // ── Recent memories (top weighted) ─────────────────────────
  const mems = (s.memories ?? [])
    .slice()
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 4);
  for (const m of mems) {
    if (Math.abs(m.weight) < 2) continue;
    const sign = m.emotion === "grief" || m.emotion === "anger" || m.emotion === "fear" || m.emotion === "betrayal" ? -1 :
                 m.emotion === "joy" || m.emotion === "love" || m.emotion === "pride" || m.emotion === "trust" ? 1 :
                 m.weight >= 0 ? 1 : -1;
    out.push({
      label: m.text,
      weight: Math.round(sign * Math.min(20, Math.abs(m.weight))),
      category: "memory",
    });
  }

  // Sort: strongest magnitude first.
  out.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  return out;
}

export function topMoodReasons(reasons: MoodReason[], n = 3): MoodReason[] {
  return reasons.slice(0, n);
}
