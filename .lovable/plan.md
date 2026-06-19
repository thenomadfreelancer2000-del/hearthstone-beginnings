## Visual Style Overhaul — TheoTown-Inspired

A pure rendering refresh of `src/components/game/MapView.tsx`. No gameplay, types, store, or content changes. The map is drawn in two layers: a Canvas terrain layer and an SVG building/entity layer — both live in MapView.tsx (2100 lines).

This is large. I want to scope it before charging in.

### What I propose to ship in this pass

**1. Terrain layer (Canvas, ~lines 1330-1400)**
- New warmer palette per tile kind (grass / tall-grass / dirt / forest / stone / water / ruin / road).
- Per-tile dithered noise + a second blended color so tiles read with subtle texture instead of flat fills.
- Soft edge blending between adjacent kinds (e.g. grass→dirt) using a 1px lighter rim.
- Water gets gentle horizontal ripple stripes; stone gets speckle; forest floor a darker green.

**2. Resource nodes (Canvas, ~1444)**
- Trees: layered canopy circles + trunk + ground shadow.
- Rocks: clustered polygons with highlight.
- Fiber grass: tufts instead of dots.

**3. Buildings (SVG, lines 249-799)**
Redraw each kind for clearer silhouettes at zoom-out. One pass per building:
- Tent — canvas triangle with pole and door flap.
- Cabin — square log hut, pitched roof, chimney.
- House — taller wooden home, two windows, door, chimney.
- Manor — wide ranch residence with wraparound porch.
- Homestead — keep current yard composition but redraw house with stronger outline and ranch trim.
- Campfire, Water collector, Foraging camp, Watchtower, Guard post, Well — restyle for consistency (thicker outline, same shading rules).

**3b. Fences / walls / gate (1842 + 652-737)**
- Real connected ranch fence: posts at corners + two horizontal rails between, computed from neighbor fence tiles for end/corner/T/cross pieces (the data for this is already in MapView via neighbor lookup).
- Palisade, stone-wall, gate restyled to match.

**4. Farm plots (518)**
- Soil rows visible at all stages.
- Stage visuals: fresh soil (dark brown rows) → sprouts (tiny green dots) → mature (taller green strokes) → harvested (stubble).
- Orchards (if farm type is tree-crop): render a grid of small trees instead of rows.

**5. Livestock (new small render block in the entity layer)**
- For each livestock building, render N small animal sprites inside its footprint, slowly drifting positions each frame using existing animation tick. Chicken, sheep, goat, cattle silhouettes.

**6. Shared style constants**
- A `TILE_PALETTES`, `BUILDING_STROKE`, `BUILDING_FILL` block near the top so all buildings share outline weight, shadow direction, and roof tones — this is what makes TheoTown read as one set.

### What I'm NOT doing
- No new building types, no new tile kinds, no gameplay or type changes.
- No sprite-sheet assets — staying with SVG + Canvas vector art, so it ships without binary uploads.
- No zoom-dependent LOD swap this pass (current zoom logic stays; we just draw better at every zoom).

### Risk / size

`MapView.tsx` is 2100 lines and each of the 6 sections above is a non-trivial edit. Doing the whole list in one turn produces a huge diff that's hard for you to review and easy for me to break. I'd rather ship this in 2-3 passes.

### Suggested order (one pass each)

1. **Pass A — Terrain + resource nodes + shared palette constants.** Biggest visual lift, lowest risk. You'll see the map transform immediately.
2. **Pass B — Buildings (all kinds) + fences/walls/gate connected pieces.**
3. **Pass C — Farm growth stages + livestock animals on the map.**

If you'd rather I do all three in a single mega-pass, say the word and I'll do it — just know the diff will be large.

### Questions before I start

- Confirm the order above, or tell me to do it all at once.
- Any building you want me to prioritize (e.g. Homestead stays as-is since we just reworked it)?
