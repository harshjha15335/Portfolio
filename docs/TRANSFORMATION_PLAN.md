# Mumbai world: visual transformation plan

Repository `harshjha15335/Portfolio`, base `feature/cst-fort-rendering-optimization` (`6216c5b`). Written 2026-10-11 after reading every review in `docs/`, running the street locally (Chromium + SwiftShader, 1440×900, review poses, Medium preset) and comparing native captures against the Gulmohar Local reference notes in `docs/GULMOHAR_REFERENCE_AUDIT.md`.

The reference reel itself is not in the repository (the audit says it was a local file, `Recording 2026-10-06 175859.mp4`, and the live site was proxy-blocked). The targets below therefore come from the written audit of the reel plus the existing art reviews.

---

## 1. Why it still reads as a procedural low-poly simulation

Ranked by how much each one costs the image, judged from the current captures, not from test results.

| # | Problem | What you see | Cause |
|---|---|---|---|
| 1 | **Sourceless, flat lighting** | Every façade has the same brightness. The sunlit side and the shaded side differ only slightly. Nothing looks like 17:40 even though the HUD says "golden hour". | The hemisphere fill (1.15) was almost as strong as the sun (2.25). The sun shone mostly *along* the street. **The shadow frustum (±24 m) only covered the middle of the street**, so the spawn, station forecourt and return views got no building shadows at all. |
| 2 | **Factory-clean surfaces** | Big uniform planes of plaster, perfectly even asphalt, no dirt where walls meet the ground. | Most surfaces get a single colour each. The 256 px procedural maps tile and are too faint to read beyond 5 m. There is no ambient occlusion on Medium. |
| 3 | **No atmospheric depth** | Buildings 80 m away have the same contrast as buildings 8 m away. The sky is a flat gradient with no sun in it. | Linear fog only started at 72 m, and its colour was not tied to the sun. |
| 4 | **Primitive silhouettes and perfect edges** | Every edge is a razor-sharp box corner. Balconies, rails and cornices are repeated boxes, and the same bay rhythm repeats down the street. | Everything is built from code primitives. There are no bevels, no sagging or wonky geometry, and no unique hero buildings beyond the café. |
| 5 | **Mannequin people** | Smooth-skinned figures with no face detail, hair cards, cloth folds or believable gait. | 16-bone procedural skins and a marching-cubes garment surface. This is already flagged as the largest open gap in Sprint 2. |
| 6 | **Thin street life** | Shops share the same shelf props. There are almost no parked two-wheelers, handcarts, hanging laundry, posters, wire bundles or rubbish. | Clutter is placed by hand from primitives, so density stays low. |
| 7 | **Vehicles look like toys** | Clean bodies, simple wheels, primitive drivers. | Lofted procedural bodywork with no wear, decals or interior detail. |

## 2. What code can fix and what needs authored assets

### Fixable in Three.js / shader code (no artist needed)

- **Light direction, colour, balance and shadow coverage** (problem 1). *Done in this pass, see section 4.*
- **Weathering: grime, streaks, splash bands at wall bases, ledge soot, oil stains** as world-space shader layers (problem 2). *First version done in this pass.* It is limited because it has no idea where windows or ledges are. An authored grime mask beats it.
- **Aerial perspective and sun haze** (problem 3). *Done in this pass.*
- **Ambient occlusion on Medium.** Options: a baked per-vertex AO attribute for the static batches (one-off cost at build time), or GTAO at half resolution. SSAO already exists on High.
- **Cheap bloom on emissive shop lights and the sun disc** (one mip-chain pass). The renderer currently rules out bloom. Revisit with a hardware frame-time check.
- **Edge wear**: bevel-like highlights through a normal-bent rim term on box geometry, or switch common boxes to `RoundedBoxGeometry` with 1 segment (small triangle cost).
- **Procedural clutter scattering**: instanced wires, posters, laundry lines, potted plants, AC drip stains and two-wheelers placed by rules. The geometry quality is still limited by primitives.
- **Silhouette breakup**: random parapet heights, rooftop water tanks, antenna and sign masts on the skyline.
- **Colour grading**: a small 3D LUT authored once in Resolve or Photoshop from a reference still, applied in the existing tone-mapping pass.

### Needs professionally authored content (Blender / Substance / scanning)

These are the items that make the jump from "convincing stylised" to "photographic". No amount of Three.js code replaces them.

| Need | Exact asset spec | Workflow |
|---|---|---|
| **Pedestrians (largest gap)** | 6–8 base characters (men and women, kurta, shirt-trousers, sari, school uniform, delivery rider), ≤12k tris, one 1024² atlas each (albedo, normal, ORM), 30–50 bone humanoid rig, clips: Idle, Walk, Talk, Sit, PhoneIdle, plus a 2k-tri LOD | MakeHuman (CC0 output) or Character Creator base → Blender retopology and clothing → Mixamo or Cascadeur animation → glTF export through the existing `scripts/import-character.mjs` admission path |
| **Façade kit (Fort heritage + chawl + Art Deco)** | ~25 modular pieces on a 3.2 m storey / 2.64 m bay grid: window bays (3 styles), balcony with cast-iron rail, cornice, parapet, shopfront frame, rolling shutter, pilaster, AC unit, drain pipe. ≤1.5k tris each, beveled edges, trim-sheet UVs | Blender modular kit with trim sheets → bake AO and curvature → Substance Painter smart materials (dust, rain streaks, peeling paint) → 2 trim sheets at 2048² (plaster/stone, metal/wood) |
| **Tileable PBR surfaces** | Weathered lime plaster ×2, basalt/stone masonry, Mumbai asphalt with patches, interlocking paver blocks, kerb stone. 1024² albedo + normal + ORM each | Poly Haven / ambientCG CC0 scans (when reachable) or Substance Designer. Add a vertex-colour or mask blend for grime. |
| **Hero landmarks** | CST station façade (simplified, ≤40k tris, with unique bake), Irani café exterior, Fort institute entrance | Blender from public reference photos with a baked 2k lightmap or AO |
| **Vehicles** | Premier Padmini taxi and Bajaj RE auto: ≤15k tris each, 1 atlas, interior visible through windows, worn decals; plus a BEST bus and a scooter at ≤8k | Blender hard-surface → Substance wear pass |
| **Street props** | Handcart, chai stall, newspaper stand, bicycle, Activa-type scooter, garbage bags, water tank, wire bundles, hanging signs | Blender, sharing one prop atlas |
| **Vegetation** | Gulmohar and rain trees: 2 species × 2 sizes, alpha-card leaves, ≤8k tris, plus wind vertex colours | SpeedTree or Blender sapling → leaf-card atlas |
| **Grime decals** | 12–16 decals (water stains, posters, paan stains, oil spots, cracks) in one 2048² atlas | Substance Designer or photo-sourced CC0 |
| **Sky and IBL** | One 2k HDRI of a hazy tropical late afternoon, to replace RoomEnvironment | Poly Haven CC0 HDRI |

**Budget consequence:** the current ceilings (110 draws, 230k tris, 32 textures, 26 programs) have no texture or program headroom left. Real assets need the budget rebased. Atlases, KTX2 compression and fewer procedural bone textures (18 today) would pay for it. That rebasing must come with the laptop GPU profiling run in `docs/GPU_BENCHMARK.md`.

## 3. Prioritised roadmap

Each step should be judged by matched before/after captures, not by tests passing.

| Priority | Step | Kind | Visual impact | Prerequisite |
|---|---|---|---|---|
| **P0** ✅ | Golden-hour light, full shadow coverage, sun haze, world-space weathering (this pass) | Code | High: changes every frame | none |
| **P1** | Medium-preset AO (baked vertex AO for static batches) + LUT grade + restrained bloom on practicals | Code | High: grounds every object | P0, hardware frame check |
| **P2** | Tileable PBR plaster, stone, asphalt and paver sets + 1 decal atlas | Assets (CC0 scans or Substance) | High at walking distance | texture budget rebase, KTX2 loader |
| **P3** | Modular façade kit with trim sheets replacing the procedural grammars on CST–Fort | Blender + Substance | Very high: removes the "boxes" look | P2 trim sheets, grid spec above |
| **P4** | 6–8 rigged pedestrians through the existing GLB admission path | Character art + animation | Very high at close range | rig/clip spec above; per-character visual review |
| **P5** | Taxi, auto and scooter hero vehicles; prop pack; Gulmohar trees | Blender | Medium–high | shared atlases |
| **P6** | Procedural clutter scatter using the P5 props (laundry, posters, wires, two-wheelers) | Code + assets | Medium–high | P5 |
| **P7** | Hardware profiling and budget rebase, then district expansion | Measurement | none (gate) | representative laptop |

Suggested split: code work (P1, P6) can run in parallel with commissioning or authoring P2–P5. Once P2 is done, P3 is the single largest remaining visual step, and P4 is the largest for close-up shots.

## 4. What this pass changed (P0)

Draft PR against `feature/cst-fort-rendering-optimization`. Captures are under `docs/screenshots/golden-hour/{before,after}`.

- **Sun**: moved to a low (≈12°) north-western position down the street axis, warmer (`#ffa86c`) and stronger (4.4). The hemisphere fill is cooler and weaker (0.80), and the RoomEnvironment reflection is reduced (0.22 → 0.14). Shaded streets now read cool, while upper floors catch orange light.
- **Shadow frustum**: recomputed in light space (±52 × −12…41 m) so the station forecourt, spawn and return views receive building shadows. Before, they had none because the old ±24 m box missed them. Same 2048² map, same cached-shadow refresh.
- **Atmosphere**: fog now starts at 18 m instead of 72 m, thins with height and tints toward the sun direction. The sky dome gains a sun glow and warm horizon haze that match the fog.
- **Weathering**: a world-space shader layer on all lit materials adds patchy discolouration, mould, soot streaks, a dirty splash band at wall bases, ledge grime, oil stains and asphalt wear. Strength comes from each material's surface type, and people, vehicles and glass are excluded.
- **Budget**: the same injection goes into every MeshStandardMaterial, so the program count stays at 26 and no textures are added. Draw and triangle counts are unchanged at the review poses. The software renderer pays about 10–15% more per frame for the noise, which pushes one tight browser timing test (taxi arrival, 78 s of 90 s on base) over its timeout. Details are in `docs/GOLDEN_HOUR_PASS.md`.

Known limits of P0: the weathering is procedural, so it cannot follow real window or ledge positions; streaks are subtle at distance. The low sun makes the near street darker, which is intentional for the mood but should be reviewed on a real display. Mobile has no directional shadows, so it gets the colour and haze without the shadow contrast. None of this changes the people, vehicles or geometry, which remain P3–P5.
