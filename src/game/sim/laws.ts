// Laws of the Ranch — enacted by the founder at the first council (when ten
// houses have settled) and contested by factions in every council thereafter.
//
// Each law tilts the settlement along several axes (faction stances) and
// produces concrete mood / loyalty drift on survivors with matching traits.

import type { ID, Trait } from "../types";

export type LawDomain =
  | "property"
  | "justice"
  | "marriage"
  | "hospitality"
  | "labor"
  | "faith";

export type FactionId =
  | "traditionalists"
  | "reformists"
  | "hawks"
  | "merchants"
  | "commons";

export interface LawDef {
  id: string;
  domain: LawDomain;
  title: string;
  blurb: string;
  /** Faction-level stances this law triggers. */
  factionLikes: FactionId[];
  factionHates: FactionId[];
  /** Per-trait mood reaction when the law is enacted. */
  traitMood: Partial<Record<Trait, number>>;
  /** Per-trait loyalty drift (toward the founder) when the law is enacted. */
  traitLoyalty: Partial<Record<Trait, number>>;
  /** Short flavor for chronicle / faction agenda lines. */
  flavor: string;
}

export interface EnactedLaw {
  id: ID;
  lawId: string;
  yearEnacted: number;
}

export const LAW_CATALOG: LawDef[] = [
  // ── Property ─────────────────────────────────────────────
  {
    id: "law-eldest-inherits",
    domain: "property",
    title: "Eldest Inherits the Hearth",
    blurb: "Pen, plough, and porch pass to the firstborn. No partition of houses.",
    factionLikes: ["traditionalists"],
    factionHates: ["reformists", "commons"],
    traitMood:    { Traditional: 12, Loyal: 6, Principled: 5, Ambitious: -8, Idealistic: -10, Jealous: -6 },
    traitLoyalty: { Traditional: 8, Loyal: 5, Ambitious: -6, Idealistic: -8 },
    flavor: "The hearth stays whole. The young must build their own.",
  },
  {
    id: "law-common-stores",
    domain: "property",
    title: "Common Stores",
    blurb: "Surplus grain and tools are pooled and rationed by the council in lean seasons.",
    factionLikes: ["commons", "reformists"],
    factionHates: ["merchants", "traditionalists"],
    traitMood:    { Compassionate: 10, Generous: 12, Idealistic: 8, Greedy: -15, Ambitious: -6, Traditional: -5 },
    traitLoyalty: { Compassionate: 6, Generous: 8, Greedy: -10 },
    flavor: "What one house has, the ranch may need.",
  },

  // ── Justice ──────────────────────────────────────────────
  {
    id: "law-blood-for-blood",
    domain: "justice",
    title: "Blood for Blood",
    blurb: "Killers are hanged. Thieves lose a hand. The founder holds the rope.",
    factionLikes: ["hawks", "traditionalists"],
    factionHates: ["commons"],
    traitMood:    { Brave: 6, Paranoid: 8, Aggressive: 10, Compassionate: -15, Friendly: -8, Generous: -6 },
    traitLoyalty: { Brave: 4, Aggressive: 6, Compassionate: -10, Friendly: -5 },
    flavor: "An eye, a hand, a neck — the price is plain.",
  },
  {
    id: "law-council-judges",
    domain: "justice",
    title: "The Council Judges",
    blurb: "All quarrels are heard by the house heads sitting together. No private feud.",
    factionLikes: ["reformists", "commons"],
    factionHates: ["hawks"],
    traitMood:    { Idealistic: 10, Honest: 8, Friendly: 4, Aggressive: -10, Paranoid: -6, Independent: -4 },
    traitLoyalty: { Honest: 6, Idealistic: 5, Aggressive: -6 },
    flavor: "Quarrels are settled in the long room, not in the dust.",
  },

  // ── Marriage ─────────────────────────────────────────────
  {
    id: "law-head-consent",
    domain: "marriage",
    title: "Marriage by House Head",
    blurb: "No marriage without the consent of both house heads.",
    factionLikes: ["traditionalists"],
    factionHates: ["reformists"],
    traitMood:    { Traditional: 10, Loyal: 5, Principled: 4, Idealistic: -10, Independent: -8, Curious: -4 },
    traitLoyalty: { Traditional: 6, Loyal: 4, Independent: -5 },
    flavor: "No vows without the heads' word.",
  },
  {
    id: "law-free-vows",
    domain: "marriage",
    title: "Free Vows",
    blurb: "Two adults of age may wed without leave from any head.",
    factionLikes: ["reformists", "commons"],
    factionHates: ["traditionalists"],
    traitMood:    { Idealistic: 10, Curious: 6, Independent: 8, Friendly: 4, Traditional: -12, Loyal: -4 },
    traitLoyalty: { Idealistic: 6, Independent: 5, Traditional: -6 },
    flavor: "Love is its own warrant.",
  },

  // ── Hospitality ─────────────────────────────────────────
  {
    id: "law-open-gate",
    domain: "hospitality",
    title: "The Gate Stands Open",
    blurb: "Wanderers are fed for a night and a day. Refusal is shame.",
    factionLikes: ["commons", "reformists"],
    factionHates: ["hawks", "merchants"],
    traitMood:    { Compassionate: 12, Generous: 10, Idealistic: 8, Friendly: 6, Paranoid: -10, Selfish: -12, Greedy: -8 },
    traitLoyalty: { Compassionate: 6, Generous: 5, Paranoid: -6, Selfish: -6 },
    flavor: "No traveller sleeps in the cold.",
  },
  {
    id: "law-closed-border",
    domain: "hospitality",
    title: "Closed Border",
    blurb: "No stranger crosses the fence without leave. Watchers stand by night.",
    factionLikes: ["hawks", "traditionalists"],
    factionHates: ["commons"],
    traitMood:    { Paranoid: 10, Brave: 4, Traditional: 6, Aggressive: 6, Compassionate: -12, Idealistic: -10, Friendly: -6 },
    traitLoyalty: { Paranoid: 6, Aggressive: 4, Compassionate: -8 },
    flavor: "The fence holds, or the ranch falls.",
  },

  // ── Labor ────────────────────────────────────────────────
  {
    id: "law-tithe-labor",
    domain: "labor",
    title: "Tithe of Labor",
    blurb: "Every able adult gives one day in ten to public works.",
    factionLikes: ["commons", "reformists"],
    factionHates: ["merchants"],
    traitMood:    { Hardworking: 8, Generous: 6, Idealistic: 6, Lazy: -15, Greedy: -10, Independent: -6 },
    traitLoyalty: { Hardworking: 6, Lazy: -8, Greedy: -6 },
    flavor: "Ten parts kept, one part given.",
  },
  {
    id: "law-free-trade",
    domain: "labor",
    title: "Free Trade in Pen and Pasture",
    blurb: "Goods, animals, and tools may be bartered freely between houses without council leave.",
    factionLikes: ["merchants", "reformists"],
    factionHates: ["commons", "traditionalists"],
    traitMood:    { Greedy: 12, Ambitious: 10, Independent: 6, Curious: 4, Generous: -6, Traditional: -8 },
    traitLoyalty: { Ambitious: 6, Greedy: 6, Traditional: -4 },
    flavor: "What is mine I may trade.",
  },

  // ── Faith / Tradition ───────────────────────────────────
  {
    id: "law-day-of-rest",
    domain: "faith",
    title: "A Day of Rest",
    blurb: "Every seventh day, no labor — only kin, hearth, and quiet.",
    factionLikes: ["traditionalists", "commons"],
    factionHates: ["merchants"],
    traitMood:    { Traditional: 10, Quiet: 6, Friendly: 5, Compassionate: 4, Hardworking: -4, Ambitious: -6, Greedy: -8 },
    traitLoyalty: { Traditional: 6, Compassionate: 4, Ambitious: -4 },
    flavor: "Six days of work; the seventh for the hearth.",
  },
  {
    id: "law-founders-word",
    domain: "faith",
    title: "The Founder's Word Is Law",
    blurb: "Where custom is silent, the founder speaks. The council bows to the porch.",
    factionLikes: ["hawks", "traditionalists"],
    factionHates: ["reformists", "commons"],
    traitMood:    { Loyal: 10, Traditional: 8, Principled: 4, Paranoid: 4, Idealistic: -10, Independent: -10, Curious: -4 },
    traitLoyalty: { Loyal: 10, Traditional: 6, Idealistic: -8, Independent: -8 },
    flavor: "One voice from the porch carries the ranch.",
  },
];

export const LAW_BY_ID: Record<string, LawDef> =
  Object.fromEntries(LAW_CATALOG.map((l) => [l.id, l]));

export function getLawDef(lawId: string): LawDef | undefined {
  return LAW_BY_ID[lawId];
}

/** Group laws by domain for the founding charter UI. */
export function lawsByDomain(): Record<LawDomain, LawDef[]> {
  const out = {} as Record<LawDomain, LawDef[]>;
  for (const l of LAW_CATALOG) {
    (out[l.domain] ??= []).push(l);
  }
  return out;
}

export const DOMAIN_LABEL: Record<LawDomain, string> = {
  property:     "Property & Inheritance",
  justice:      "Justice & Punishment",
  marriage:     "Marriage & Kin",
  hospitality:  "Hospitality & Strangers",
  labor:        "Labor & Trade",
  faith:        "Faith & Authority",
};
