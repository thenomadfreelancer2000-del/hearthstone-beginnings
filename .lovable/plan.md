# Grand Politics, Power & Governance — Phased Plan

This update is **additive**. Existing systems (Families, Ministers, Authority, Reputation, Marriage, Heirs, Livestock, Memories) keep their current behavior. New politics layers read from them and write back into them.

The 24 requested systems are grouped into 5 phases. Each phase is independently shippable and playable. After each phase we pause so you can play it and steer the next one.

---

## Shared foundation (built once, used by every phase)

A new module `src/game/sim/politics.ts` plus types added (not replaced) on `Family` in `src/game/types.ts`:

- `politicalPower: number` — derived each year from prestige, influence, wealth, population, offices held, marriage alliances, achievements.
- `reputationTags: string[]` — derived labels (Loyal, Ambitious, Wealthy, Ruthless…) computed from existing reputation + behavior.
- `agenda: { primary, secondary }` — short list, recomputed yearly from family state.
- `favors: { fromFamilyId, kind, year, weight }[]` — favors & insults ledger.
- `alliances: { withFamilyId, source, strength, since }[]`
- `rivalries: { withFamilyId, cause, intensity, since }[]`
- `blocId: string | null`
- `history: { year, kind, text }[]` — per-family chronicle.

A new top-level store slice `politics`:
- `councilSeats: { familyId, seat, since }[]`
- `blocs: { id, name, kind, memberFamilyIds }[]`
- `officeVacancies: { office, candidates, openedYear }[]`
- `familyDemands: { id, fromFamilyId, kind, payload, status }[]`
- `heirSupport: { heirId: percent }`
- `successionFactions: { heirId, supporters }[]`
- `politicalChronicle: { year, kind, text }[]`
- `stability: number` (0–100)

None of this overwrites existing `family.prestige`, `family.wealth`, `family.relations`, survivor `memories`, or the ministers system — they are inputs.

---

## Phase 1 — Power, Council, Reputation surface (systems 1, 2, 11, 12, 13, 17)

Goal: every house has a visible Political Power score; major houses sit on a Council; Authority and Influence become first-class political dials.

- Compute `politicalPower` yearly in `politics.ts` from existing prestige + new wealth roll-up + population + offices + marriage alliances + achievements.
- House Wealth roll-up: sum of family-owned farm plots, livestock shares, building stored resources attributed to occupants.
- Add a "Politics" tab to BottomDock with three sub-panels:
  - **Council** — list of seated houses with Head, Power, Prestige, Influence, current office.
  - **Houses** — every family ranked by Political Power with reputation tags.
  - **Stability** — Authority, Influence, food, housing, satisfaction, inequality bars.
- Authority/Influence: hook existing Authority into stability and cooperation modifier on demands.

Ship checkpoint: you can open Politics → see house rankings and the first Council form.

---

## Phase 2 — Offices, Candidates, Demands, Negotiation (systems 3, 4, 5, 6, 7, 14, 15)

Goal: ministers become political offices families compete for, and families file demands you must decide.

- Extend the existing minister system with the full office list (Steward, Head Farmer, Head Builder, Head Rancher, Quartermaster, Trade Master, Marshal, Healer, Council Speaker). Existing ministers stay; new offices are added.
- Vacancy flow: when an office opens, generate 2–4 candidates with Skill / Prestige / Influence / Family. Founder appoints. Appointment writes a `favor` to that family and a small `insult` to losing families.
- Family Agendas: each year set `agenda.primary` from family state (e.g., land-poor → "Expand farmland"; many youths → "Secure marriages").
- Family Demands panel (modeled on the existing LivestockRequestsPanel): families submit demands tied to agenda. Player can Approve / Reject / Delay / Negotiate (counter-offer with reduced amount).
- Favors ledger: every Approve/Reject/counter writes a memory to the family with decay over decades.
- Favoritism detection: rolling window over favors; if one house dominates appointments/grants, raise a "Favoritism" reputation tag and reduce Authority.

Ship checkpoint: governance gameplay loop — appointments, demands, counter-offers, consequences.

---

## Phase 3 — Alliances, Rivalries, Blocs (systems 8, 9, 10)

Goal: the political map of the settlement.

- Alliance formation: marriage between two families auto-creates/strengthens an alliance; shared agenda + positive relation passes a threshold → alliance.
- Rivalry formation: lost office, rejected marriage, blocked demand, resource conflict → rivalry with intensity that decays slowly.
- Blocs: cluster families by shared agenda + alliance graph each year; name blocs by dominant agenda (Expansion / Traditionalist / Agricultural / Merchant).
- Council voting: when demands or appointments are contested, allied families vote with the requester; rivals vote against.
- Visualization: a simple relations graph (allies green, rivals red) in the Politics tab.

Ship checkpoint: you can see and feel coalitions.

---

## Phase 4 — Heirs, Succession Factions, Crisis (systems 18, 19, 20)

Goal: succession becomes a political event, not a lookup.

- For every potential heir (existing heirs logic), compute support % from each family based on marriage ties, friendships, prestige, past favors.
- Display heir support breakdown on the leader profile / dynasty overlay.
- On founder death: snapshot factions. If top heir support < 50% and runner-up within 15% → trigger a Succession Crisis event with three resolutions (Negotiation, Compromise, Deadlock) — outcomes feed Authority, alliances, rivalries.

Ship checkpoint: dynasties get dramatic turning points.

---

## Phase 5 — Political Events, History, Chronicle, Generational depth (systems 21, 22, 23, 24, 16)

Goal: long-game texture.

- Event generator: weekly roll using current alliances/rivalries/agendas to pick from a table (marriage negotiation, office dispute, worker allocation conflict, land request, livestock rights, trade disagreement). Each event is a structured Demand-like decision.
- Family history: every meaningful state change appends to `family.history` (founded, first minister, alliance formed, supported X heir…).
- Political Chronicle: settlement-wide log surfaced in a Chronicle panel; searchable by family/year.
- Generational inheritance: children inherit family's prestige bonus, reputation tags decayed by one step, rivalries and alliances at half strength — guaranteeing a 150-year settlement reads differently from a 10-year one.
- Stability score finalized: feeds back into engine tick (low stability → more events, lower cooperation).

Ship checkpoint: the full simulator.

---

## Technical notes (for me, not the player)

- All new state lives in the existing zustand `useGame` store as a `politics` slice + new fields on Family. No replacement of `family.prestige`, `family.relations`, `survivor.memories`, ministers, marriage, or heirs modules.
- All derived metrics (politicalPower, agenda, blocs, stability) recomputed in the yearly tick of `src/game/sim/engine.ts`; demands and events on weekly tick.
- Persistence: extend `src/game/persistence.ts` with migrations so old saves get sensible defaults (no data loss).
- UI: one new top-level "Politics" entry in BottomDock containing Council / Houses / Demands / Offices / Chronicle sub-tabs. Existing panels (Authority, Ministers, Family, Livestock, Marriage) stay where they are and link into the Politics tab where relevant.

---

## What I need from you

1. **Confirm phase order** above, or reorder.
2. **Start point**: ship Phase 1 first (recommended) or a different slice?
3. **Demands volume**: should families file demands often (every few weeks) or rarely (a few per year)? This sets the gameplay tempo.
4. **Crisis frequency**: should Succession Crises be rare-but-memorable (default) or common?
