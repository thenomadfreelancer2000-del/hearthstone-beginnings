// Relationship display ladder for the Dynastic Marriage update.
// Pure derivation from existing Relationship numbers + survivor flags.
// No "Dating" stage — replaced by "Romantic Interest" and "Engaged".

import type { Relationship, Survivor } from "../types";

export type RelationshipStage =
  | "Stranger"
  | "Acquaintance"
  | "Friend"
  | "Close Friend"
  | "Romantic Interest"
  | "Engaged"
  | "Married";

export function relationshipStage(
  r: Relationship,
  a: Survivor,
  b: Survivor,
): RelationshipStage {
  if (a.spouseId === b.id || b.spouseId === a.id || r.tag === "spouse") return "Married";
  if (a.fianceId === b.id || b.fianceId === a.id || r.engagedTick) return "Engaged";
  // Romantic interest needs mutual eligibility + strong attraction.
  const oppositeSex = a.gender !== b.gender;
  const bothAdult = (a.stage === "adult" || a.stage === "youth" || a.stage === "elder")
                 && (b.stage === "adult" || b.stage === "youth" || b.stage === "elder");
  if (oppositeSex && bothAdult && r.attraction >= 30 && r.affection >= 10 && !a.spouseId && !b.spouseId) {
    return "Romantic Interest";
  }
  if (r.affection >= 60 && r.trust >= 40) return "Close Friend";
  if (r.affection >= 25 || r.friendship >= 30) return "Friend";
  if (r.interactions >= 3) return "Acquaintance";
  return "Stranger";
}

export function stageColor(stage: RelationshipStage): string {
  switch (stage) {
    case "Married": return "text-family";
    case "Engaged": return "text-rust-light";
    case "Romantic Interest": return "text-rust-light";
    case "Close Friend": return "text-success";
    case "Friend": return "text-amber";
    case "Acquaintance": return "text-dust-light";
    case "Stranger": return "text-dust";
  }
}
