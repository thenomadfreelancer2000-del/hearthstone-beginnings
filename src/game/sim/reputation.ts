// Founder reputation profile. The single -100..100 reputation number is kept
// in the store for back-compat, but the richer profile drives the founder's
// public title and (later) flavored arrivals.

export type ReputationAxis =
  | "compassionate" | "ruthless" | "builder" | "provider" | "honest";

export type ReputationProfile = Record<ReputationAxis, number>;

export const REPUTATION_AXES: ReputationAxis[] = [
  "compassionate", "ruthless", "builder", "provider", "honest",
];

export const REPUTATION_TITLES: Record<ReputationAxis, string> = {
  compassionate: "The Compassionate",
  ruthless:      "The Ruthless",
  builder:       "The Builder",
  provider:      "The Provider",
  honest:        "The Honest",
};

export const REPUTATION_BLURBS: Record<ReputationAxis, string> = {
  compassionate: "Has opened the gate when others would have shut it.",
  ruthless:      "Has turned away the desperate. Word travels.",
  builder:       "The skyline of the ranch is theirs.",
  provider:      "Their stores never empty for long.",
  honest:        "Their word is the law of the porch.",
};

export function emptyReputation(): ReputationProfile {
  return { compassionate: 0, ruthless: 0, builder: 0, provider: 0, honest: 0 };
}

export function bumpReputation(
  rep: ReputationProfile,
  axis: ReputationAxis,
  amount: number,
): ReputationProfile {
  const next = { ...rep };
  next[axis] = Math.max(0, Math.min(100, (next[axis] ?? 0) + amount));
  return next;
}

const TITLE_THRESHOLD = 55;

export function dominantTitle(rep: ReputationProfile | undefined | null): string | null {
  if (!rep) return null;
  let best: ReputationAxis | null = null;
  let bestV = TITLE_THRESHOLD;
  for (const ax of REPUTATION_AXES) {
    const v = rep[ax] ?? 0;
    if (v > bestV) { best = ax; bestV = v; }
  }
  return best ? REPUTATION_TITLES[best] : null;
}

export function dominantAxis(rep: ReputationProfile | undefined | null): ReputationAxis | null {
  if (!rep) return null;
  let best: ReputationAxis | null = null;
  let bestV = TITLE_THRESHOLD;
  for (const ax of REPUTATION_AXES) {
    const v = rep[ax] ?? 0;
    if (v > bestV) { best = ax; bestV = v; }
  }
  return best;
}
