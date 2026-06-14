# Dynastic Marriage & House Prestige

This is an additive update layered on top of the existing Families, Housing, Memories, Opinions, Prestige and Authority systems. **Nothing in those systems is rebuilt or replaced.** The existing `Family` already maps 1:1 to a "House" — we surface it as such in the UI and add a proposal/approval flow on top of the current `attraction`/`affection`-driven marriage in `engine.ts`.

## What changes (functional)

1. **Houses = Families, surfaced explicitly.**
   - No new data model. `Family` becomes "House of {name}" in UI strings.
   - "House Head" already exists via `headOfFamily()` in `families.ts` — we expose it on the family panel header and use it for approval decisions.

2. **Relationship stages — remove "Dating".**
   - Currently `RelationshipTag` has no "dating" stage, but Inspector / labels may mention it. New display ladder derived from existing numeric stats (no schema change):
     - Stranger → Acquaintance → Friend → Close Friend → Romantic Interest → Engaged → Married
   - Mapped from `interactions`, `affection`, `attraction`, plus new `engagedTick` flag.

3. **New: engagement step before marriage.**
   - Add optional fields on `Survivor`: `fianceId?`, `engagedTick?`, `engagedYear?`.
   - Add optional fields on `Relationship`: `engagedTick?`.
   - In `processMarriages` (engine.ts): when a pair passes the existing attraction/affection threshold, **don't auto-marry**. Instead create a `MarriageProposal`.

4. **New: MarriageProposal queue (transient, persisted in save).**
   ```ts
   interface MarriageProposal {
     id; aId; bId;
     aFamilyId; bFamilyId;
     createdTick; createdYear;
     attraction; compatibility; familyApproval;
     prestigeA; prestigeB;
     expectedPrestigeDelta; expectedRelationDelta;
     status: "pending" | "approved" | "rejected" | "postponed";
     // Founder dynasty proposals require player decision; others auto-resolve via House Heads.
     requiresPlayer: boolean;
   }
   ```
   - Added to `SaveGame` (version bumped to 3; old saves migrate with empty `proposals: []`).

5. **Resolution logic.**
   - **Non-founder houses:** auto-resolved by simulated House Head decision using prestige delta, family relation, compatibility. Same tick (no UI required).
   - **Founder's House involvement:** `requiresPlayer = true`, sim pauses marriage of that pair until player acts (Approve / Reject / Postpone). Other proposals continue normally.

6. **Prestige-based effects on marriage outcome** (executed in `marry()`):
   - Equal-prestige union (both ≥ 60): +bonus prestige to both, +30 relation, chronicle "prestigious union".
   - Big gap (>40): smaller bonus for high house, family-dissatisfaction memories for high-house kin, mild loyalty hit, chronicle "married beneath their status".
   - Already-implemented basics in `marry()` are kept; we just extend the deltas.

7. **Arranged marriages (Founder only).**
   - New action on Founder-house single adult inspector: "Arrange marriage…" → modal lists eligible candidates (opposite gender, of age, not kin, not married) with: name/age/House/House Prestige/Attraction/Compatibility/Family Approval/expected prestige delta/expected relation delta.
   - Choosing one creates a player-initiated proposal that is auto-approved on the Founder side; the other House Head still decides (simulated).

8. **Family reactions / memories.**
   - On marriage resolution add categorical memories ("married-beneath", "prestigious-union", "founder-arranged") to relatives of both houses, fueling existing mood/loyalty/contagion in `families.ts`.

9. **UI surfaces.**
   - `FamilyPanel.tsx`: header reads "House of {name}", show House Head row + House Prestige (already shown) + member count.
   - New `MarriageProposalsPanel` shown in the top dock when at least one player-required proposal exists. Cards show all comparison stats; Approve / Reject / Postpone buttons.
   - New `ArrangeMarriageModal` opened from Inspector on Founder-house single adults.
   - `Inspector.tsx` relationship row: show new stage labels and "Engaged" / "Fiancé" badge.

## Technical details

- Files added:
  - `src/game/sim/marriage.ts` — proposal generation, compatibility calc, House Head approval AI, resolution.
  - `src/components/game/MarriageProposalsPanel.tsx`
  - `src/components/game/ArrangeMarriageModal.tsx`
  - `src/game/sim/relationshipStages.ts` — pure helper mapping `(Relationship, survivors)` → stage label, reused by Inspector and panels.
- Files edited:
  - `src/game/types.ts` — add `MarriageProposal`, optional `fianceId/engagedTick/engagedYear` on `Survivor`, `engagedTick` on `Relationship`, `proposals: MarriageProposal[]` on `SaveGame` (version → 3).
  - `src/game/store.ts` — actions: `decideProposal(id, "approve"|"reject"|"postpone")`, `arrangeMarriage(initiatorId, targetId)`; selectors for player-required proposals.
  - `src/game/persistence.ts` — migrate v2 → v3 (add empty `proposals`).
  - `src/game/sim/engine.ts` — replace direct `marry()` in `processMarriages` with `enqueueProposal()`; tick `resolveAutoProposals()` each day.
  - `src/components/game/Inspector.tsx` — new stage labels, "Arrange marriage" action for Founder house.
  - `src/components/game/FamilyPanel.tsx` — "House of" wording, House Head row stays as already implemented.
  - `src/components/game/TopBar.tsx` or `BottomDock.tsx` — mount `MarriageProposalsPanel` indicator/badge when pending player proposals exist.

- Children/dynasty: **no changes needed.** Existing `processBirths` already inherits `familyId`, surname (via `marry()` lead-house rule), and generation. Documented as preserved.

- Save migration: bump `SaveGame.version` from `2` to `3`, default `proposals: []` and treat missing `fianceId` etc. as absent. Old saves load.

## Out of scope (preserve as-is)

Housing logic, family/relations contagion, memory decay, opinion/authority, prestige drift, heirs/succession, family trees, children inheritance. All untouched except for additive memory emits and additive prestige bumps inside the existing `marry()` function.
