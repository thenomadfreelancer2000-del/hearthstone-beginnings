# People, Personalities & Memories Update

Building on the existing Skills / Houses / Marriage / Children / Opinions systems, this update gives survivors *reasons* to like, dislike, remember, and react. Everything extends current systems — no rebuilds, saves stay forward-compatible (new fields optional with defaults).

---

## Phase 1 — Personality Traits

**Files:** `src/game/data/traits.ts` (new), `src/game/types.ts`, `src/game/sim/world.ts` (survivor generation)

- Replace the current narrow `Trait` union with a richer catalog split into **Positive / Neutral / Negative** tiers (Hardworking, Loyal, Compassionate, Brave, Honest, Friendly, Quiet, Curious, Independent, Lazy, Greedy, Aggressive, Jealous, Selfish, Cowardly, plus keep the existing ones).
- Each trait gets metadata: `tier`, `opposites[]` (e.g. Hardworking ↔ Lazy), `synergies[]`, and small numeric modifiers `{ workSpeed?, opinionBias?, marriageWeight?, courageMod?, refugeeBias? }`.
- Survivor generation: roll **2–4** traits with no contradictions (never both Hardworking + Lazy on the same person).
- Effects wired into:
  - **Work** (`ai.ts` / `engine.ts`): Hardworking +work speed, Lazy −work speed, Brave/Cowardly affect dangerous tasks.
  - **Opinions** (Phase 5): trait-pair bias on every interaction.
  - **Marriage** (`housing.ts` matchmaking): compatibility multiplier from trait synergy/opposition.
  - **Refugee decisions**: Compassionate survivors get a mood penalty when the founder rejects arrivals; Selfish get a small bonus.

## Phase 2 — Memory System

**Files:** `src/game/sim/memory.ts` (new), `src/game/types.ts` (extend `Memory`), hooks in arrival/birth/marriage/death/construction code.

- Extend `Memory` with: `kind` (founder-accepted, founder-rejected-kin, survived-drought, first-house, child-born, spouse-died, helped-by, wronged-by, …), `decayRate`, `floor` (minimum weight it decays to — major memories never vanish).
- New `addMemory(survivor, kind, opts)` helper called from existing event sites (arrival accept/reject, birth, marriage, death, harvest, starvation, construction completion).
- Daily tick: weight decays toward `floor` (big events floor at ~30%, trivial ones at 0).
- Memories surface in the Survivor Inspector as a scrollable "Recollections" list, newest first, color-coded by emotion.

## Phase 3 — Founder Reputation

**Files:** `src/game/sim/reputation.ts` (new), `src/game/store.ts`, `src/components/game/LeaderProfile.tsx`.

- Replace the single `reputation` number with a **reputation profile**: `{ compassionate, ruthless, builder, provider, warlike, honest }` each 0–100.
- Actions push scores: accept refugees → Compassionate; reject → Ruthless; finish a house → Builder; full granary / good harvest → Provider; etc.
- Derive a public **title** ("The Compassionate", "The Builder", "The Ruthless") from the dominant axis once any score crosses 60.
- Display in LeaderProfile and TopBar (small badge). Arrivals' opening blurb varies by reputation (compassionate ranches attract more refugees, ruthless ones attract drifters/soldiers).

## Phase 4 — Important Events & Settlement Mood

**Files:** `src/game/sim/events.ts` (new thin layer), `src/game/store.ts`, chronicle hooks.

- Centralize event reactions so every system fires through one function `recordEvent(kind, payload)` which:
  1. Adds chronicle entry (already exists).
  2. Adjusts settlement mood (+ birth/marriage/good harvest, − death/starvation/rejection).
  3. Adds memories to involved + witnessing survivors (proximity-based).
  4. Bumps founder reputation axes.
- Starvation and child-deaths get **large** penalties with long-lasting memories ("My child starved under your roof").

## Phase 5 — Friends & Rivals

**Files:** `src/game/sim/relationships.ts` (extend), `src/components/game/Inspector.tsx`.

- Derive tag from existing `affection` / `friendship` / `rivalry` values:
  - ≥ +80 → **Best Friend**
  - +40..+79 → Friend
  - −40..−79 → Rival
  - ≤ −80 → **Enemy**
- Trait interactions modify daily relationship drift: Hardworking↔Lazy −1/day, Loyal↔Honest +1/day, Jealous near a higher-status survivor +rivalry, etc.
- Behaviors:
  - **Friends** seek each other for `socialize` actions, give small mood boosts.
  - **Enemies** avoid sharing tasks; occasional "argument" tick → mood penalty and a `wronged-by` memory.
  - **Rumors** (lightweight): low chance per day an Enemy spreads a `wronged-by` memory to a mutual Friend, nudging that third party's opinion of the target.
- Inspector shows "Friends" and "Rivals" lists with the derived tag.

---

## Technical notes

- No new dependencies.
- All new fields on `Survivor` / `Relationship` are optional; loader fills defaults so old saves still work.
- Each phase ships behind a feature flag in `store.ts` so we can disable any single layer if balance breaks.
- Roughly 12 files touched, ~900 LOC.

## Out of scope (confirm before I expand)

- Faction-level politics or laws (still parked under Phase 3+ placeholders in types).
- Player-driven matchmaking or arranged marriages.
- Combat between rivals (only verbal arguments here).
- Visual portraits reacting to mood.

---

**Shipping options — pick one:**

1. **All five phases in one pass** (big PR, fully integrated).
2. **Split A:** Phases 1–2 first (Traits + Memory) so you can feel it, then 3–5.
3. **Split B:** Phases 1, 2, 5 first (the "felt" personality loop), then 3 + 4 (founder-facing reputation and event mood).

Which split, and is anything in "Out of scope" actually in scope for you?
