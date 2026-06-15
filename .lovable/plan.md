# Fix Pack: Assignments, Factions, Marriage, Livestock, UX

Thirteen targeted fixes across the simulation and UI. Most are small, scoped to one or two files each.

## Scope by item

1. **Assign people to houses** — `Inspector.tsx` / `store.ts`: expose `assignHome(survivorId, buildingId)` action and add a "Move in" button on residential buildings + a "Home" picker on survivor card.

2. **Collapsible resources on ranch name** — `TopBar.tsx`: clicking the ranch name toggles a small panel showing food/fiber/wood/stone/eggs/milk/wool counts.

3. **No factions until after first council** — `factions.ts` + `store.ts`: gate `computeFactions` behind `state.flags.firstCouncilHeld`. Set the flag inside the council resolution path.

4. **Survivors stopped coming** — `engine.ts` arrival logic: investigate `arrivalCooldownTick`/cap conditions and ensure new arrivals continue past early game when housing exists. Likely the cap currently keys off founding mood; loosen so arrivals resume when housing capacity > pop.

5. **Assign workers to livestock buildings** — `Inspector.tsx`: livestock pen inspector currently lacks worker-assign UI. Add the same assignment row used by farms, calling `assignWorker(buildingId, survivorId)`.

6. **Livestock requests state the offer** — `livestock.ts` + `LivestockRequestsPanel.tsx`: add `tributeOffer` field (e.g. `{ resource: "eggs", perMonth: 1 }`) and render it ("I'll send 1 chicken to the ranch each month").

7. **Show approved family livestock buildings on the map** — `MapView.tsx`: render `livestockOwnerFamilyId` pens with the owning family's color/initial.

8. **Reduce livestock-request frequency** — `livestock.ts` `generateLivestockRequests`: drop tick gate from 3 days → 8, and base probability 0.04 → 0.015.

9. **Farm manager auto-assigns farm workers** — `ministers.ts` / `engine.ts`: when a farming minister exists, idle adults near farms get auto-assigned without founder action; founder can still override.

10. **Notifications come late** — find toast/notification dispatcher; surface chronicle events the same tick they happen instead of next day.

11. **Marriage requires home** — `marriage.ts`: weddings (including founder) blocked until one spouse has `homeId` set; show pending reason in marriage panel.

12. **Children can't join factions until adult** — `factions.ts`: exclude `stage !== "adult" && stage !== "elder"` from membership/affinity computation.

13. **Sex next to child's name** — `Inspector.tsx` / `MapView.tsx`: append (M)/(F) to child & teen names where listed.

## Technical notes
- All changes are frontend + sim layer; no schema/migration changes.
- Add `state.flags = { firstCouncilHeld?: boolean }` if not present.
- Tribute offers stored on the request, executed monthly in `dailyLivestockTick`.
- After edits, verify build succeeds (auto-run) and spot-check UI in preview.
