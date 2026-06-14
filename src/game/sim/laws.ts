// Laws of the Ranch — enacted by the founder at the first council (when ten
// houses have settled) and contested by factions in every council thereafter.
//
// Each law tilts the settlement along several axes (faction stances) and
// produces concrete mood / loyalty drift on survivors with matching traits.

import type { ID, Trait } from "../types";

export type LawDomain =
  | "leadership"
  | "succession"
  | "marriage"
  | "immigration"
  | "housing"
  | "farmland"
  | "justice-theft"
  | "justice-blood"
  | "trade"
  | "military"
  | "taxation"
  | "emergency"
  | "exploration";

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
  // ── Leadership ─────────────────────────────────────────────
  {
    id: "law-absolute-rule",
    domain: "leadership",
    title: "Absolute Founder Rule",
    blurb: "The founder's word is final. The council speaks only when spoken to.",
    factionLikes: ["hawks", "traditionalists"],
    factionHates: ["reformists", "commons"],
    traitMood:    { Loyal: 12, Traditional: 8, Paranoid: 4, Idealistic: -12, Independent: -10, Ambitious: -6 },
    traitLoyalty: { Loyal: 10, Traditional: 6, Idealistic: -8, Independent: -8 },
    flavor: "One porch. One voice. One law.",
  },
  {
    id: "law-advisory-council",
    domain: "leadership",
    title: "Advisory Council",
    blurb: "House heads counsel the founder. The founder may still rule against them.",
    factionLikes: ["traditionalists", "merchants"],
    factionHates: [],
    traitMood:    { Honest: 6, Principled: 5, Traditional: 4, Friendly: 3, Aggressive: -4 },
    traitLoyalty: { Honest: 4, Principled: 3 },
    flavor: "The heads are heard. The founder decides.",
  },
  {
    id: "law-shared-governance",
    domain: "leadership",
    title: "Shared Governance",
    blurb: "Founder and council rule together. Neither acts alone on great matters.",
    factionLikes: ["reformists", "commons"],
    factionHates: ["hawks"],
    traitMood:    { Idealistic: 12, Honest: 6, Friendly: 5, Independent: 4, Loyal: -6, Paranoid: -5 },
    traitLoyalty: { Idealistic: 6, Honest: 4, Loyal: -5 },
    flavor: "Two hands on the rope.",
  },
  {
    id: "law-council-dominance",
    domain: "leadership",
    title: "Council Dominance",
    blurb: "The council leads. The founder presides but cannot overrule a sitting vote.",
    factionLikes: ["reformists", "commons", "merchants"],
    factionHates: ["hawks", "traditionalists"],
    traitMood:    { Idealistic: 14, Independent: 8, Curious: 4, Loyal: -12, Traditional: -10, Paranoid: -6 },
    traitLoyalty: { Idealistic: 6, Independent: 5, Loyal: -10, Traditional: -6 },
    flavor: "The long room is the law.",
  },

  // ── House Succession ───────────────────────────────────────
  {
    id: "law-eldest-succession",
    domain: "succession",
    title: "Eldest Child Succession",
    blurb: "When a head dies, the eldest living child takes the hearth.",
    factionLikes: ["traditionalists"],
    factionHates: ["reformists"],
    traitMood:    { Traditional: 10, Loyal: 4, Ambitious: -6, Idealistic: -6 },
    traitLoyalty: { Traditional: 6, Ambitious: -4 },
    flavor: "Eldest born, hearth sworn.",
  },
  {
    id: "law-prestige-succession",
    domain: "succession",
    title: "Prestige Succession",
    blurb: "The most renowned heir of the house inherits, regardless of age.",
    factionLikes: ["merchants", "hawks"],
    factionHates: ["traditionalists", "commons"],
    traitMood:    { Ambitious: 14, Brave: 5, Hardworking: 5, Traditional: -10, Jealous: -6, Lazy: -8 },
    traitLoyalty: { Ambitious: 6, Hardworking: 4, Traditional: -6 },
    flavor: "Names earn the porch, not birthdays.",
  },
  {
    id: "law-family-election",
    domain: "succession",
    title: "Family Election",
    blurb: "Each house chooses its next head from among its adult kin.",
    factionLikes: ["reformists", "commons"],
    factionHates: ["traditionalists"],
    traitMood:    { Idealistic: 10, Independent: 8, Honest: 4, Traditional: -10, Loyal: -4 },
    traitLoyalty: { Idealistic: 5, Independent: 4, Traditional: -6 },
    flavor: "The hearth answers to its kin.",
  },
  {
    id: "law-founder-designates",
    domain: "succession",
    title: "Founder Designates Heir",
    blurb: "The founder names the next head of every house. None may contest it.",
    factionLikes: ["hawks"],
    factionHates: ["reformists", "commons", "traditionalists"],
    traitMood:    { Loyal: 10, Paranoid: 4, Traditional: -8, Idealistic: -12, Independent: -10, Ambitious: -6 },
    traitLoyalty: { Loyal: 10, Idealistic: -10, Independent: -8 },
    flavor: "The porch names the heir. The kin obey.",
  },

  // ── Marriage ───────────────────────────────────────────────
  {
    id: "law-free-marriage",
    domain: "marriage",
    title: "Free Marriage",
    blurb: "Two adults of age may wed without any leave but their own.",
    factionLikes: ["reformists", "commons"],
    factionHates: ["traditionalists"],
    traitMood:    { Idealistic: 12, Independent: 8, Curious: 6, Friendly: 4, Traditional: -12, Loyal: -4 },
    traitLoyalty: { Idealistic: 6, Independent: 5, Traditional: -6 },
    flavor: "Love is its own warrant.",
  },
  {
    id: "law-head-consent",
    domain: "marriage",
    title: "House Head Approval Required",
    blurb: "No marriage without the consent of both house heads.",
    factionLikes: ["traditionalists"],
    factionHates: ["reformists"],
    traitMood:    { Traditional: 10, Loyal: 5, Principled: 4, Idealistic: -10, Independent: -8, Curious: -4 },
    traitLoyalty: { Traditional: 6, Loyal: 4, Independent: -5 },
    flavor: "No vows without the heads' word.",
  },
  {
    id: "law-founder-marriage",
    domain: "marriage",
    title: "Founder Approval Required",
    blurb: "Every marriage is brought to the porch for the founder's blessing.",
    factionLikes: ["hawks", "traditionalists"],
    factionHates: ["reformists", "commons"],
    traitMood:    { Loyal: 10, Traditional: 6, Idealistic: -10, Independent: -10, Curious: -4 },
    traitLoyalty: { Loyal: 8, Idealistic: -8, Independent: -8 },
    flavor: "The founder ties the knot or none is tied.",
  },
  {
    id: "law-prestige-marriages",
    domain: "marriage",
    title: "Prestige Marriages Encouraged",
    blurb: "Matches between great houses are favored. Modest matches are quietly discouraged.",
    factionLikes: ["merchants", "traditionalists"],
    factionHates: ["commons"],
    traitMood:    { Ambitious: 12, Greedy: 8, Jealous: -6, Compassionate: -6, Idealistic: -8, Generous: -4 },
    traitLoyalty: { Ambitious: 5, Compassionate: -4 },
    flavor: "Great houses marry great houses.",
  },

  // ── Immigration ────────────────────────────────────────────
  {
    id: "law-open-settlement",
    domain: "immigration",
    title: "Open Settlement",
    blurb: "Any soul who reaches the gate may stay. None are turned away.",
    factionLikes: ["commons", "reformists"],
    factionHates: ["hawks", "traditionalists", "merchants"],
    traitMood:    { Compassionate: 14, Generous: 10, Idealistic: 10, Friendly: 5, Paranoid: -14, Selfish: -12, Greedy: -8 },
    traitLoyalty: { Compassionate: 8, Generous: 5, Paranoid: -8, Selfish: -6 },
    flavor: "The gate stands open. Always.",
  },
  {
    id: "law-selective-admission",
    domain: "immigration",
    title: "Selective Admission",
    blurb: "Wanderers are weighed at the gate. The unsound are turned back.",
    factionLikes: ["hawks", "merchants"],
    factionHates: ["commons"],
    traitMood:    { Paranoid: 8, Ambitious: 5, Principled: 3, Compassionate: -10, Idealistic: -8 },
    traitLoyalty: { Paranoid: 5, Compassionate: -5 },
    flavor: "We pick who shares our salt.",
  },
  {
    id: "law-skills-first",
    domain: "immigration",
    title: "Skills First",
    blurb: "Only those with a trade or craft the ranch needs are admitted.",
    factionLikes: ["merchants", "hawks"],
    factionHates: ["commons", "traditionalists"],
    traitMood:    { Hardworking: 8, Ambitious: 8, Greedy: 6, Compassionate: -10, Lazy: -8, Generous: -4 },
    traitLoyalty: { Hardworking: 5, Ambitious: 4, Compassionate: -5 },
    flavor: "Show your hands. Then your face.",
  },
  {
    id: "law-closed-border",
    domain: "immigration",
    title: "Closed Border",
    blurb: "No stranger crosses the fence without leave. Watchers stand by night.",
    factionLikes: ["hawks", "traditionalists"],
    factionHates: ["commons", "reformists"],
    traitMood:    { Paranoid: 10, Brave: 4, Traditional: 6, Aggressive: 6, Compassionate: -14, Idealistic: -12, Friendly: -6 },
    traitLoyalty: { Paranoid: 6, Aggressive: 4, Compassionate: -8 },
    flavor: "The fence holds, or the ranch falls.",
  },

  // ── Housing ────────────────────────────────────────────────
  {
    id: "law-housing-need",
    domain: "housing",
    title: "Housing By Need",
    blurb: "The biggest families and the sickest sleepers get the roofs first.",
    factionLikes: ["commons", "reformists"],
    factionHates: ["merchants", "traditionalists"],
    traitMood:    { Compassionate: 12, Generous: 8, Idealistic: 8, Greedy: -10, Ambitious: -5, Selfish: -8 },
    traitLoyalty: { Compassionate: 6, Generous: 4, Greedy: -6 },
    flavor: "A roof for the one who needs it most.",
  },
  {
    id: "law-housing-prestige",
    domain: "housing",
    title: "Housing By Prestige",
    blurb: "Great houses claim the best lots. Lesser kin take what is left.",
    factionLikes: ["traditionalists", "merchants"],
    factionHates: ["commons", "reformists"],
    traitMood:    { Ambitious: 12, Greedy: 10, Traditional: 6, Compassionate: -10, Jealous: -8, Idealistic: -8 },
    traitLoyalty: { Ambitious: 5, Greedy: 4, Compassionate: -5 },
    flavor: "The proud porch sits highest.",
  },
  {
    id: "law-housing-contribution",
    domain: "housing",
    title: "Housing By Contribution",
    blurb: "The roofs go to those who have given the most labor, grain, or blood.",
    factionLikes: ["merchants", "hawks", "reformists"],
    factionHates: ["traditionalists"],
    traitMood:    { Hardworking: 12, Ambitious: 8, Brave: 5, Lazy: -14, Traditional: -5, Greedy: -4 },
    traitLoyalty: { Hardworking: 6, Lazy: -8 },
    flavor: "A roof is a wage.",
  },
  {
    id: "law-founder-allocation",
    domain: "housing",
    title: "Founder Allocation",
    blurb: "Every lot is given by the founder's hand alone.",
    factionLikes: ["hawks", "traditionalists"],
    factionHates: ["reformists", "commons", "merchants"],
    traitMood:    { Loyal: 10, Traditional: 4, Idealistic: -10, Independent: -10, Ambitious: -4 },
    traitLoyalty: { Loyal: 8, Idealistic: -6, Independent: -6 },
    flavor: "Every key hangs on the porch wall.",
  },

  // ── Farmland ───────────────────────────────────────────────
  {
    id: "law-community-farms",
    domain: "farmland",
    title: "Community Farms",
    blurb: "All fields are tended together. The harvest fills common stores.",
    factionLikes: ["commons", "reformists"],
    factionHates: ["merchants", "traditionalists"],
    traitMood:    { Compassionate: 10, Generous: 12, Idealistic: 10, Hardworking: 4, Greedy: -16, Ambitious: -8, Selfish: -10 },
    traitLoyalty: { Generous: 6, Idealistic: 5, Greedy: -10 },
    flavor: "One field. One harvest. One people.",
  },
  {
    id: "law-family-farms",
    domain: "farmland",
    title: "Family Farms",
    blurb: "Each house tills its own ground. What grows on it, stays on it.",
    factionLikes: ["traditionalists", "merchants"],
    factionHates: ["commons", "reformists"],
    traitMood:    { Independent: 12, Greedy: 10, Traditional: 8, Ambitious: 6, Generous: -6, Idealistic: -10 },
    traitLoyalty: { Independent: 5, Traditional: 5, Idealistic: -6 },
    flavor: "My fence. My furrow. My grain.",
  },
  {
    id: "law-founder-grants",
    domain: "farmland",
    title: "Founder Grants Farmland",
    blurb: "Fields are parcelled by the founder's hand. Tenure can be revoked.",
    factionLikes: ["hawks"],
    factionHates: ["reformists", "commons", "merchants"],
    traitMood:    { Loyal: 10, Paranoid: 4, Independent: -10, Idealistic: -8, Greedy: -6 },
    traitLoyalty: { Loyal: 8, Independent: -6 },
    flavor: "The furrow you stand on is on loan.",
  },

  // ── Justice — Theft ───────────────────────────────────────
  {
    id: "law-theft-restitution",
    domain: "justice-theft",
    title: "Restitution For Theft",
    blurb: "A thief repays twice what was taken. No body is harmed.",
    factionLikes: ["reformists", "commons", "merchants"],
    factionHates: ["hawks"],
    traitMood:    { Compassionate: 10, Honest: 8, Idealistic: 8, Friendly: 4, Aggressive: -8, Paranoid: -5 },
    traitLoyalty: { Compassionate: 5, Honest: 4, Aggressive: -4 },
    flavor: "Pay it back, twice over.",
  },
  {
    id: "law-theft-brand",
    domain: "justice-theft",
    title: "Brand The Thief",
    blurb: "A thief is marked on the hand so every porch knows them.",
    factionLikes: ["traditionalists", "merchants"],
    factionHates: ["commons"],
    traitMood:    { Greedy: 6, Principled: 4, Paranoid: 6, Compassionate: -10, Friendly: -6, Idealistic: -8 },
    traitLoyalty: { Principled: 3, Compassionate: -5 },
    flavor: "The hand that took, wears the mark.",
  },
  {
    id: "law-theft-hand",
    domain: "justice-theft",
    title: "A Hand For A Theft",
    blurb: "The thieving hand is taken. Twice-thieves leave both at the post.",
    factionLikes: ["hawks", "traditionalists"],
    factionHates: ["reformists", "commons"],
    traitMood:    { Paranoid: 8, Aggressive: 10, Brave: 4, Traditional: 4, Compassionate: -16, Friendly: -10, Idealistic: -12, Generous: -6 },
    traitLoyalty: { Aggressive: 5, Paranoid: 4, Compassionate: -10 },
    flavor: "The price of grain is a wrist.",
  },
  {
    id: "law-theft-exile",
    domain: "justice-theft",
    title: "Exile The Thief",
    blurb: "Theft costs a roof and a name. The thief is walked to the fence.",
    factionLikes: ["traditionalists", "merchants"],
    factionHates: ["commons"],
    traitMood:    { Principled: 6, Honest: 5, Paranoid: 4, Compassionate: -8, Generous: -5 },
    traitLoyalty: { Honest: 4, Compassionate: -4 },
    flavor: "Take from us, sleep elsewhere.",
  },

  // ── Justice — Blood ───────────────────────────────────────
  {
    id: "law-blood-mediation",
    domain: "justice-blood",
    title: "Family Mediation For Blood",
    blurb: "Killings are weighed by the heads of the houses involved. Coin may settle a death.",
    factionLikes: ["traditionalists", "commons"],
    factionHates: ["hawks"],
    traitMood:    { Compassionate: 6, Friendly: 6, Traditional: 6, Quiet: 3, Aggressive: -10, Paranoid: -6 },
    traitLoyalty: { Compassionate: 4, Traditional: 3, Aggressive: -5 },
    flavor: "Two heads and a purse can close a grave.",
  },
  {
    id: "law-blood-council",
    domain: "justice-blood",
    title: "The Council Judges Blood",
    blurb: "Killers stand before the long room. The council names the sentence.",
    factionLikes: ["reformists", "commons"],
    factionHates: ["hawks"],
    traitMood:    { Idealistic: 12, Honest: 8, Principled: 6, Friendly: 4, Aggressive: -10, Independent: -4 },
    traitLoyalty: { Honest: 5, Idealistic: 5, Aggressive: -5 },
    flavor: "No blood is judged in the dust.",
  },
  {
    id: "law-blood-for-blood",
    domain: "justice-blood",
    title: "Blood For Blood",
    blurb: "A killer hangs from the same beam they swung beneath.",
    factionLikes: ["hawks", "traditionalists"],
    factionHates: ["reformists", "commons"],
    traitMood:    { Brave: 6, Paranoid: 8, Aggressive: 12, Traditional: 4, Compassionate: -16, Friendly: -10, Idealistic: -10, Generous: -6 },
    traitLoyalty: { Aggressive: 6, Paranoid: 4, Compassionate: -10, Idealistic: -6 },
    flavor: "A neck for a neck.",
  },

  // ── Trade ──────────────────────────────────────────────────
  {
    id: "law-open-trade",
    domain: "trade",
    title: "Open Trade",
    blurb: "Houses barter, sell, and bargain as they please. No leave required.",
    factionLikes: ["merchants", "reformists"],
    factionHates: ["commons", "traditionalists"],
    traitMood:    { Greedy: 12, Ambitious: 10, Independent: 6, Curious: 4, Generous: -6, Traditional: -8 },
    traitLoyalty: { Ambitious: 5, Greedy: 5, Traditional: -4 },
    flavor: "What is mine I may sell.",
  },
  {
    id: "law-controlled-trade",
    domain: "trade",
    title: "Council Approved Trade",
    blurb: "Every major bargain is brought before the council for blessing.",
    factionLikes: ["reformists", "commons"],
    factionHates: ["merchants"],
    traitMood:    { Idealistic: 8, Honest: 5, Generous: 4, Greedy: -12, Ambitious: -8, Independent: -6 },
    traitLoyalty: { Honest: 4, Greedy: -6 },
    flavor: "No deal closes without the long room.",
  },
  {
    id: "law-founder-trade-monopoly",
    domain: "trade",
    title: "Founder Trade Monopoly",
    blurb: "All trade with outsiders passes through the founder's hand. None deal alone.",
    factionLikes: ["hawks"],
    factionHates: ["merchants", "reformists", "commons"],
    traitMood:    { Loyal: 8, Paranoid: 4, Greedy: -14, Ambitious: -10, Independent: -8, Idealistic: -6 },
    traitLoyalty: { Loyal: 8, Greedy: -8, Ambitious: -6 },
    flavor: "Every coin from outside touches the porch first.",
  },

  // ── Military ───────────────────────────────────────────────
  {
    id: "law-volunteer-service",
    domain: "military",
    title: "Volunteer Service",
    blurb: "Any kin may take up arms; none are pressed.",
    factionLikes: ["commons", "reformists"],
    factionHates: ["hawks"],
    traitMood:    { Brave: 8, Independent: 6, Idealistic: 6, Cowardly: 4, Paranoid: -6, Aggressive: -4 },
    traitLoyalty: { Brave: 4, Independent: 3 },
    flavor: "The willing stand the wall.",
  },
  {
    id: "law-family-levies",
    domain: "military",
    title: "Family Levies",
    blurb: "Each house owes the ranch fighters in proportion to its kin.",
    factionLikes: ["hawks", "traditionalists"],
    factionHates: ["commons", "merchants"],
    traitMood:    { Brave: 6, Loyal: 6, Traditional: 6, Aggressive: 4, Cowardly: -10, Idealistic: -6, Generous: -4 },
    traitLoyalty: { Loyal: 4, Brave: 3, Cowardly: -6 },
    flavor: "Every porch gives a son.",
  },
  {
    id: "law-professional-guard",
    domain: "military",
    title: "Professional Guard",
    blurb: "A standing band is fed and paid year-round to keep the fence.",
    factionLikes: ["hawks", "merchants"],
    factionHates: ["commons", "reformists"],
    traitMood:    { Brave: 10, Ambitious: 6, Aggressive: 8, Paranoid: 6, Generous: -6, Idealistic: -8, Lazy: -4 },
    traitLoyalty: { Brave: 5, Aggressive: 4, Idealistic: -4 },
    flavor: "Wages for the watch.",
  },
  {
    id: "law-founder-command",
    domain: "military",
    title: "Founder Command",
    blurb: "All fighters answer to the porch alone. The council names no captains.",
    factionLikes: ["hawks", "traditionalists"],
    factionHates: ["reformists", "commons"],
    traitMood:    { Loyal: 12, Brave: 6, Traditional: 4, Idealistic: -10, Independent: -10, Honest: -3 },
    traitLoyalty: { Loyal: 10, Idealistic: -8, Independent: -8 },
    flavor: "One throat shouts the charge.",
  },

  // ── Taxation & Contribution ────────────────────────────────
  {
    id: "law-equal-contribution",
    domain: "taxation",
    title: "Equal Contribution",
    blurb: "Every house gives the same. Big or small, the tithe is one.",
    factionLikes: ["traditionalists", "merchants"],
    factionHates: ["commons", "reformists"],
    traitMood:    { Independent: 6, Greedy: 4, Traditional: 4, Compassionate: -8, Generous: -6, Idealistic: -8 },
    traitLoyalty: { Independent: 3, Compassionate: -4 },
    flavor: "One tithe for every porch.",
  },
  {
    id: "law-wealth-contribution",
    domain: "taxation",
    title: "Wealth-Based Contribution",
    blurb: "Great houses give more. The poor give little.",
    factionLikes: ["commons", "reformists"],
    factionHates: ["merchants", "traditionalists"],
    traitMood:    { Compassionate: 10, Generous: 12, Idealistic: 10, Friendly: 4, Greedy: -16, Ambitious: -8, Selfish: -8 },
    traitLoyalty: { Generous: 6, Compassionate: 4, Greedy: -10 },
    flavor: "The full barn gives more grain.",
  },
  {
    id: "law-tithe-labor",
    domain: "taxation",
    title: "Tithe Of Labor",
    blurb: "Every able adult gives one day in ten to common works.",
    factionLikes: ["commons", "reformists"],
    factionHates: ["merchants"],
    traitMood:    { Hardworking: 8, Generous: 6, Idealistic: 6, Lazy: -16, Greedy: -10, Independent: -6 },
    traitLoyalty: { Hardworking: 5, Lazy: -8, Greedy: -6 },
    flavor: "Ten parts kept, one part given.",
  },
  {
    id: "law-voluntary-contribution",
    domain: "taxation",
    title: "Voluntary Contribution",
    blurb: "No tithe is demanded. The ranch lives on what kin freely give.",
    factionLikes: ["merchants", "reformists"],
    factionHates: ["commons", "hawks"],
    traitMood:    { Independent: 10, Greedy: 12, Ambitious: 6, Generous: 4, Idealistic: -6, Loyal: -4 },
    traitLoyalty: { Greedy: 5, Independent: 4 },
    flavor: "Give if you will. None will ask twice.",
  },

  // ── Emergency Powers ───────────────────────────────────────
  {
    id: "law-founder-emergency",
    domain: "emergency",
    title: "Founder Emergency Powers",
    blurb: "In raid, plague, or famine the founder rules without council until the danger passes.",
    factionLikes: ["hawks", "traditionalists"],
    factionHates: ["reformists", "commons"],
    traitMood:    { Loyal: 10, Paranoid: 6, Brave: 4, Idealistic: -10, Independent: -8 },
    traitLoyalty: { Loyal: 8, Idealistic: -6 },
    flavor: "When the wolves come, one voice.",
  },
  {
    id: "law-council-emergency",
    domain: "emergency",
    title: "Council Emergency Powers",
    blurb: "In crisis the council sits day and night and rules together. The founder is one voice among them.",
    factionLikes: ["reformists", "commons"],
    factionHates: ["hawks"],
    traitMood:    { Idealistic: 10, Honest: 6, Independent: 4, Loyal: -8, Paranoid: -4 },
    traitLoyalty: { Idealistic: 5, Honest: 4, Loyal: -6 },
    flavor: "Many hands hold the rope in the storm.",
  },
  {
    id: "law-no-emergency",
    domain: "emergency",
    title: "No Emergency Powers",
    blurb: "Law does not bend, even in plague or raid. Custom holds the ranch together.",
    factionLikes: ["reformists", "traditionalists"],
    factionHates: ["hawks"],
    traitMood:    { Principled: 10, Honest: 6, Traditional: 4, Idealistic: 5, Paranoid: -8, Aggressive: -6 },
    traitLoyalty: { Principled: 4, Honest: 4, Paranoid: -4 },
    flavor: "The law does not bend for the wind.",
  },

  // ── Exploration ────────────────────────────────────────────
  {
    id: "law-exploration-founder",
    domain: "exploration",
    title: "Founder Monopoly On Exploration",
    blurb: "Only the founder may send a party beyond the fence.",
    factionLikes: ["hawks", "traditionalists"],
    factionHates: ["reformists", "merchants", "commons"],
    traitMood:    { Loyal: 10, Paranoid: 6, Traditional: 4, Idealistic: -10, Independent: -8, Ambitious: -6 },
    traitLoyalty: { Loyal: 8, Independent: -6, Ambitious: -4 },
    flavor: "The road begins at the porch.",
  },
  {
    id: "law-exploration-ministers",
    domain: "exploration",
    title: "Minister Recommendation",
    blurb: "Ministers may propose expeditions; the founder still decides.",
    factionLikes: ["traditionalists", "merchants"],
    factionHates: [],
    traitMood:    { Honest: 6, Principled: 5, Ambitious: 4, Aggressive: -3 },
    traitLoyalty: { Honest: 4, Ambitious: 2 },
    flavor: "Counsel walks before the wagon.",
  },
  {
    id: "law-exploration-council",
    domain: "exploration",
    title: "Council Approved Exploration",
    blurb: "No expedition leaves without the long room's blessing.",
    factionLikes: ["reformists", "commons"],
    factionHates: ["hawks"],
    traitMood:    { Idealistic: 10, Honest: 6, Friendly: 4, Loyal: -6, Paranoid: -4 },
    traitLoyalty: { Idealistic: 5, Honest: 4, Loyal: -5 },
    flavor: "The long room sets the road.",
  },
  {
    id: "law-exploration-family-sponsored",
    domain: "exploration",
    title: "Family Sponsored Expeditions",
    blurb: "Powerful houses may bankroll their own parties to the wilds.",
    factionLikes: ["merchants", "traditionalists"],
    factionHates: ["commons"],
    traitMood:    { Ambitious: 10, Greedy: 8, Independent: 5, Idealistic: -6, Generous: -4 },
    traitLoyalty: { Ambitious: 5, Independent: 3 },
    flavor: "Great houses ride for their own.",
  },
  {
    id: "law-exploration-open",
    domain: "exploration",
    title: "Open Exploration Rights",
    blurb: "Any qualified kin may organize a party. The fence is not a leash.",
    factionLikes: ["reformists", "commons", "merchants"],
    factionHates: ["hawks", "traditionalists"],
    traitMood:    { Idealistic: 12, Independent: 10, Curious: 6, Brave: 5, Loyal: -8, Paranoid: -6, Traditional: -8 },
    traitLoyalty: { Independent: 5, Idealistic: 4, Loyal: -6 },
    flavor: "The road belongs to whoever walks it.",
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
  leadership:      "Leadership & Authority",
  succession:      "House Succession",
  marriage:        "Marriage & Kin",
  immigration:     "Immigration & The Gate",
  housing:         "Housing & Lots",
  farmland:        "Farmland & Fields",
  "justice-theft": "Justice — Theft",
  "justice-blood": "Justice — Blood & Killing",
  trade:           "Trade & Coin",
  military:        "Military & The Watch",
  taxation:        "Taxation & Contribution",
  emergency:       "Emergency Powers",
  exploration:     "Exploration & Expeditions",
};

export const DOMAIN_ORDER: LawDomain[] = [
  "leadership",
  "succession",
  "marriage",
  "immigration",
  "housing",
  "farmland",
  "justice-theft",
  "justice-blood",
  "trade",
  "military",
  "taxation",
  "emergency",
  "exploration",
];
