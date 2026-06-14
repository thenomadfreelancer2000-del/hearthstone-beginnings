# Livestock, Ranching & Family Livestock Update

Additive layer on top of the existing game. Nothing rebuilt; saves migrate v3 → v4 with empty livestock arrays so old saves keep working. Existing construction, family, marriage, prestige, housing, authority and opinion systems are untouched except for additive hooks (new memory kinds, prestige bumps, request events).

## 1. Data model (src/game/types.ts)

New types, all optional on `SaveGame`:

```ts
type AnimalSpecies = "chicken" | "goat" | "sheep" | "cattle";
type AnimalSex = "m" | "f";

interface Animal {
  id: ID;
  species: AnimalSpecies;
  name?: string | null;          // optional, cattle/goats often named
  sex: AnimalSex;
  ageDays: number;
  bornTick: number;
  health: number;                // 0..100
  hunger: number;                // 0..100 (higher = hungrier)
  ownerFamilyId: ID;             // every animal belongs to a House
  buildingId: ID | null;         // pen/coop/pasture it lives in (null = wild/unhoused)
  pregnant: boolean;
  pregnancyTick?: number | null;
  lastProducedTick?: number | null;
  dead?: boolean;
  deathTick?: number | null;
  deathCause?: "starvation" | "illness" | "old-age" | "slaughter" | null;
}

interface LivestockRequest {
  id: ID;
  familyId: ID;
  requesterId: ID;               // survivor who wants it
  kind: "start-raising" | "build-pen" | "expand";
  species: AnimalSpecies;
  buildingKind?: BuildingKind;   // e.g. "goat-pen"
  createdTick: number; createdYear: number;
  status: "pending" | "approved" | "rejected" | "postponed";
}
```

`SaveGame` gains `animals?: Animal[]`, `livestockRequests?: LivestockRequest[]`, version bumps to 4. Persistence migrates v3 → v4 by defaulting both to `[]`.

New `Occupation` value: `"rancher"`. New `Skills` field: `ranch: number` (0..30 clamp at use site to honor the doc's range; storage stays the existing 0..100 to avoid touching every skill helper).

## 2. Buildings (src/game/data/content.ts + types.ts)

New `BuildingKind`s + defs (all non-residential, social=false, with `livestock?: { species; capacity }` meta on the def):

- `chicken-coop`  cap 8   produces eggs
- `goat-pen`      cap 6   produces milk
- `sheep-pen`     cap 6   produces wool + fiber
- `cattle-pasture` cap 4  produces milk (large footprint)

Buildings get an optional `livestockOwnerFamilyId` on the `Building` instance (assigned at placement / arranged on first delivery). `assignedWorkerId` already exists and is reused for the assigned Rancher. New resources: `eggs`, `milk`, `wool`. (Wool can later feed cloth; for now it just accumulates.)

Construction flow, costs, builder assignment, stockpile delivery — all reuse the existing `construction.ts` pipeline. We just register new defs.

UI: Build menu groups by category; we add a new `"Livestock"` group in `BottomDock`/build palette filtered on `def.category === "livestock"` (new optional field on `BuildingDef`).

## 3. Simulation (src/game/sim/livestock.ts — new)

Pure daily/seasonal ticks called from `engine.ts`:

- `tickAnimals(state)` — per animal: increment `ageDays`, raise `hunger`, decay `health` when starving / no shelter, consume `food` from the pen's `stored` or settlement `resources` (rancher present multiplies efficiency, capped by skill 0..30).
- `tickProduction(state)` — adult healthy animals produce eggs/milk/wool into the pen's `stored`; ranchers collect on visit.
- `tickBreeding(state)` — per pen, if ≥1 adult male + ≥1 adult female, food ok, space available, roll pregnancy. Gestation per species. Offspring inherits `ownerFamilyId`, base stats from parents with small variance. Births recorded in chronicle + ranch stats.
- `tickHealth(state)` — illness chance increases when hunger high, overcrowded, or no rancher. Deaths recorded.

All called once per in-game day in `engine.ts` right after existing daily blocks. No realtime per-tick movement to keep perf simple; visual movement is decorative (see §6).

## 4. Rancher AI (src/game/sim/ai.ts)

Add a job branch parallel to `farmer`: ranchers walk to assigned pen, perform `feed` (consumes food from stockpile/pen), `collect` (moves produced resources from pen `stored` → main `resources` if pen is owned by founder house; otherwise keeps it in pen as family asset), and `health-check` (raises pen health bonus). Reuses existing pathing + commitment system.

## 5. Family ownership, requests & social consequences

- Every animal has `ownerFamilyId`. `families.ts` exposes `familyLivestockSummary(state, familyId)` → `{ chickens, goats, sheep, cattle }` used by `FamilyPanel` ("House Carter: 12 chickens, 4 goats").
- Specialization: derived selector — the species a family owns most of over time; surfaces as a "Known for cattle" tag on `FamilyPanel`. Pure read; no extra state.
- Prestige: in `livestock.ts` daily tick, herds above thresholds add small prestige to the owning family (existing `family.prestige`). Rare events ("twin calves", "champion ram") emit chronicle + bigger bumps.
- Requests: a low daily probability per non-founder house with an adult, scaled by happiness/loyalty, queues a `LivestockRequest`. Founder house never auto-requests. Bottom dock badge surfaces pending requests.
- Decision: `decideLivestockRequest(id, "approve"|"reject"|"postpone")` on the store. Approve grants the request (gifts a starter pair for "start-raising", or unlocks/queues a building plan for "build-pen") and applies founder-opinion bonuses + small prestige; reject emits "request-rejected" memory to the requester + relatives (reuses memory/contagion in `families.ts`). Repeated rejections damage relations naturally through existing systems.

## 6. UI

- **New `LivestockPanel.tsx`** (top-dock / sidebar tab): totals by species, pregnancies this season, births/deaths this year, production/day, ranchers assigned, per-family ownership table.
- **New `LivestockRequestsPanel.tsx`** mirroring the marriage proposals panel style; Approve/Reject/Postpone buttons.
- **`FamilyPanel`**: new "Livestock" row + specialization tag.
- **`Inspector` on a livestock building**: capacity, current animals (list), food consumption, production/day, assigned rancher, "Assign rancher…" action.
- **`MapView`**: render small animated dots/sprites near each livestock building (count proportional to occupants), purely visual — randomized within building footprint, no per-tick movement.
- **Build palette**: new "Livestock" category section.

## 7. Arrivals & acquisition

`world.ts` arrival generation occasionally bundles `Animal[]` with an `ArrivalEvent` (e.g. "A family arrives with 2 goats and 6 chickens."). On accept, animals are added to `state.animals` with `ownerFamilyId = arrivalFamily.id`; if no pen exists yet, animals are flagged `buildingId: null` (health drains faster, prompting the family to request a pen — feeding back into §5).

## 8. Save migration

`persistence.ts`: version 3 → 4 sets `animals: []`, `livestockRequests: []`. Loader accepts versions 2, 3, 4. Old saves load and play unchanged until first arrival/request triggers livestock content.

## 9. Files

**New**
- `src/game/sim/livestock.ts`
- `src/components/game/LivestockPanel.tsx`
- `src/components/game/LivestockRequestsPanel.tsx`

**Edited**
- `src/game/types.ts` (Animal, LivestockRequest, SaveGame v4, Occupation "rancher", Skills.ranch, BuildingKind additions, Resource additions, BuildingDef.category & .livestock)
- `src/game/data/content.ts` (new building defs, category metadata)
- `src/game/persistence.ts` (v3 → v4)
- `src/game/sim/engine.ts` (call livestock ticks + request generator)
- `src/game/sim/ai.ts` (rancher branch)
- `src/game/sim/world.ts` (arrivals can include animals)
- `src/game/sim/families.ts` (livestock summary, specialization, request memories)
- `src/game/store.ts` (`decideLivestockRequest`, `assignRancher`, selectors)
- `src/components/game/MapView.tsx` (render animals)
- `src/components/game/FamilyPanel.tsx`, `Inspector.tsx`, `BottomDock.tsx`, `GameShell.tsx`

## 10. Out of scope (foundations only)

Meat, leather, processing chains, cloth from wool, livestock trade, inheritance transfer of animals on death (animals stay with `ownerFamilyId`; future update will handle hand-off). Hooks (`ownerFamilyId`, family prestige bumps, specialization selector) are in place so those updates plug in without refactors.
