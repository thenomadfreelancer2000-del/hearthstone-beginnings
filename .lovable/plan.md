This is a large multi-system update. I'll extend existing systems without rebuilding any of them. Here's the proposed scope, grouped so you can trim what you don't want before I start.

## Phase 1 — Housing Foundation (core of this update)
1. **Residential building metadata** (`src/game/data/content.ts`): add `quality` (1–5) and `capacity` to tent, cabin (new tier), house, large-house. Tent=Q1/cap2, Cabin=Q2/cap4, House=Q3/cap6, Large House=Q4/cap10. Manor (Q5) left as future stub.
2. **Housing assignment store actions** (`src/game/store.ts`): `assignSurvivorToHome`, `moveSurvivor`, `assignFamilyToHome`, `reserveHome`, `unassignHome`. Survivor gains `homeId`. Building gains `occupantIds[]` and `reserved` flag.
3. **Auto-assignment**: when a survivor arrives or marries, auto-place into best available home (spouse's home first, else least-crowded highest-quality). Founder can override.
4. **Housing Panel** (new `HousingPanel.tsx` in Inspector when a residential building is selected): occupants list, capacity bar, quality stars, satisfaction readout, assign/remove buttons, "reserve" toggle.

## Phase 2 — Satisfaction & Expectations
5. **Satisfaction calc** (`src/game/sim/housing.ts`, new): per-survivor `housingSatisfaction` (0–100) from quality, crowding ratio, family-presence, privacy (married couple alone = bonus).
6. **Overcrowding penalties**: occupants > capacity drains mood/comfort/privacy each tick; chronicle complaints at thresholds.
7. **Gratitude decay**: on home upgrade, +10 founder opinion that decays linearly over ~1 year back to baseline. Track `expectationBaseline` per survivor that drifts upward with tenure.
8. **Family-weighted expectations**: parents with children get satisfaction penalty multiplied by family size; child-in-tent triggers stronger complaints.

## Phase 3 — Relationship Stages
9. **Relationship stage label** (`src/game/sim/ai.ts`): derive Stranger → Acquaintance → Friend → Close Friend → Romantic Interest → Dating → Engaged → Married from existing trust/affection/attraction values. Pure derivation, no schema change beyond a `stage` cached on Relationship for display.
10. **Marriage flow**: keep existing auto-marriage but route through Romantic Interest → Dating (lasts a season) → Engaged (lasts a season) → Married. Display in Inspector.

## Phase 4 — Children & Life Stages
11. Existing aging + birth code already handles infant/child/teen/adult/elder and parent links — wire children to inherit parents' home, not perform adult work until `youth` (already partially there; verify and tighten).
12. **Family Tree screen** (new `FamilyTreeOverlay.tsx`): rooted at founder, shows spouses, children, descendants recursively. Triggered from TopBar/Dynasty area.

## Phase 5 — Profile & Dynasty UI
13. Extend Survivor Inspector tab: Home (with link), Housing Satisfaction bar, Spouse, Children, Parents, Family Name, Relationship Status.
14. Extend Dynasty Overlay: per-family Living Members, Births, Marriages, Deaths counters (from chronicle).

## Technical notes
- No new dependencies.
- Saves preserved: new fields are optional; loader fills defaults (`homeId=null`, `occupantIds=[]`, etc.).
- All new logic gated behind existing systems — no rebuild.
- Founding phase unchanged.

## Out of scope (call out so you can confirm)
- Inheritance & politics (you noted "not yet").
- Manor building (stub only).
- Manual matchmaking by founder.
- Divorce / remarriage.

**Before I build:** this is roughly 15 files touched and ~800 LOC. Do you want me to ship all five phases in one pass, or split (e.g., Phase 1+2 first, then 3+4+5 in a follow-up so you can test housing in isolation)?