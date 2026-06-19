# Isometric Camera & Rendering Overhaul

Visual-only refactor of `src/components/game/MapView.tsx` (~2856 lines). Simulation, coordinates, pathfinding, building placement, AI, fences logic, store — all untouched. Only the projection from grid → screen changes.

## Approach

Add a single projection layer: `worldToIso(tx, ty)` mapping grid cell `(tx, ty)` to a screen point on a 2:1 diamond. Tile size becomes `ISO_W=56, ISO_H=28` (W:H = 2:1). Every existing draw call is rewritten in terms of this projection. Hit-testing inverts it.

```text
square grid (x,y)         iso screen
                          screen.x = (x - y) * ISO_W/2 + originX
                          screen.y = (x + y) * ISO_H/2 + originY
```

Internal tile coords stay `(x, y)` integers — only pixels move.

## Passes

### Pass 1 — Projection + terrain canvas (diamonds)
- Add `ISO_W`, `ISO_H`, `worldToIso`, `isoToWorld` helpers + new map pixel bounds (`(W+H)*ISO_W/2` wide, `(W+H)*ISO_H/2` tall).
- Resize the layer canvas, regenerate chunks in iso space.
- Rewrite `drawTile` to fill a diamond polygon instead of a square rect, with subtle NW-lit / SE-shaded edge bevels for depth.
- Convert noise/dither passes (grass blades, dirt scuffs, stone pebbles, forest blobs, water ripples, film grain) so they sit inside the diamond mask.
- Update pan clamping, center-on-ranch math, and zoom origin to iso bounds.

### Pass 2 — Buildings, fences, resource nodes
- Replace per-building SVG `<g transform="translate(px, py)">` with iso-projected anchor; redraw each building (tent, cabin, house, manor, homestead, campfire, well, watchtower, guard post, water collector, foraging camp) as 2.5D blocks: top diamond + two visible faces (front-SE, side-SW) with consistent light direction (NW lit, SE shadowed).
- Footprint diamonds (w×h grid) drawn as a single larger iso diamond outline for placement halo.
- Fence/wall/gate: re-derive the four connection directions (already in code) and draw rails/posts along the iso edges of the tile diamond; corners and T-junctions reuse existing neighbor data.
- Trees, rocks, berries, fiber tufts: redraw as iso billboards (vertical sprite anchored at tile center bottom).
- Sort all entities by `(tx + ty)` then `ty` for correct back-to-front painter's order.

### Pass 3 — Survivors, zombies, farm plots, hit testing
- Farm plot rows: rotate soil/sprout/crop strokes to follow the diamond axes (NE-SW rows).
- Survivor markers: place at `worldToIso(s.x, s.y)` minus a small vertical offset; keep current animation/state.
- Zombie layer: same projection helper exported for consistency.
- Hit testing: convert pointer screen coords back via `isoToWorld` (inverse of the 2:1 affine) — this restores click-to-select on tiles/buildings.
- Selection/placement halos (the existing ghost-on-hover) become diamond outlines.

## What stays exactly the same

- All grid coordinates, tile data, `MAP_W=180`, `MAP_H=140`, building footprints `(w,h)`, pathfinding, AI tick, store.
- Fence connection logic (N/E/S/W neighbor lookup).
- Pan + zoom controls, viewStore, center-on-ranch action.
- The Canvas + SVG split (terrain on canvas, entities on SVG) — only what they draw changes.

## Risk

Large diff (~1500 lines touched across the three passes), but each pass leaves the app rendering. Pass 1 alone produces a fully playable isometric map; Passes 2 and 3 polish buildings/entities. If anything breaks (hit testing is the highest-risk piece), it's isolated to the new projection helpers and easy to revert.

## Question

Ship all three passes in one go, or one pass per turn (recommended — you see iso terrain immediately and confirm direction before I redo every building)?
