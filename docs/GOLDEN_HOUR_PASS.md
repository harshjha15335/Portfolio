# Golden-hour light and weathering pass

Branch `claude/mumbai-visual-overhaul-wsa2hm`, based on `feature/cst-fort-rendering-optimization` (`6216c5b`). This is P0 of [the transformation plan](TRANSFORMATION_PLAN.md).

## What changed

- **Sun and fill.** The sun now sits low (≈12°) in the north-west, looking down the street axis. It is warmer (`#ffa86c`) and stronger (4.4). The hemisphere fill is cooler and weaker (0.80, was 1.15), and the RoomEnvironment reflection drops from 0.22 to 0.14. Exposure goes from 1.12 to 1.30. Shaded street now reads cool, and upper floors catch orange light. All values live in `streetMood.ts`.
- **Shadow coverage.** The old ±24 m light-space box missed the spawn, station forecourt and return views, which got no building shadows. The box is now sized from the street bounds in light space (±52 × −12…41 m, far 120). It uses the same 2048² map and the same cached refresh.
- **Shadowless balance.** When directional shadows are off (mobile, Low preset or adaptive Low), the sun is scaled to 0.35 and the fill to 1.35, so the low sun does not flood the whole street. Light intensity changes need no shader recompile.
- **Atmosphere.** Fog now starts at 18 m instead of 72 m, thins with height and tints toward the sun direction. The sky dome has a sun glow and warm horizon haze in the same colours (`StreetAtmosphere.ts`).
- **Weathering.** A world-space shader layer on every lit material adds patchy discolouration, mould, soot streaks, a dirty splash band at wall bases, ledge grime, asphalt wear and oil stains. Strength comes from each material's surface type: plaster 1.0, stone 0.85, asphalt 0.8, paving 0.75, café batch 0.35, patina 0.4. People, vehicles and glass get 0. The research-room interior gets 20% of the strength.

## Budget

The same injection, under the same cache key, is applied to every `MeshStandardMaterial`, and strength is a per-material uniform. Program variants therefore stay at **26** (mobile 21). No texture is added, so tracked textures stay at 32. Draw and triangle counts are identical at all 13 review poses. Example, `return`: 97 draws, 208,637 triangles, before and after. The spawn pose reports 27 tracked textures, where the old pose reported 26. That extra texture is an existing 8×8 NPC bone texture. It now uploads because the larger shadow frustum includes a pedestrian that the old box culled. No new texture asset is involved.

The weathering adds fragment noise: about 8 value-noise lookups on near façades, a single lookup beyond 55 m, and 2 on the ground. In continuous SwiftShader software rendering, this is roughly a 10–15% frame-time cost (for example, walking at 0.5 vs 0.6 fps, and taxi arrival reached in about 67 s vs 59 s). It has not been measured on a real GPU, so the laptop profiling gate in `GPU_BENCHMARK.md` still applies.

## Evidence

`screenshots/golden-hour/before` comes from a clean worktree of `6216c5b` on port 5175. `after` comes from this branch on port 5173. Both use the same capture script (`scripts/capture-art-sprint-2.mjs`), the same poses, 1440×900, reduced motion, Medium, scale 1.00, and the same 390×844 mobile and fallback pages. `side-by-side/` has halved before/after pairs.

| View | Visible difference |
| --- | --- |
| Spawn | The vista down the street now glows warm with depth haze. The near street sits in cool shade, where before it was evenly lit. |
| Shops / return | Upper façades on the sun side catch raking orange light, with hard diagonal building shadows. The shutter on the left of the return view is sunlit with a crisp shadow edge. |
| Station | The forecourt now gets building shadows. The station is back-lit, and its dome picks up warm light. The shaded front face is darker and less legible than before. |
| Junction / hero | The change is moderate: cooler shade, warm sky and haze, and some tonal variation on walls. |
| Taxi / auto | Street seen through the cabin is warmer and hazier. Cabin interiors are unchanged. |
| Mobile | No shadows, so it is a warmer, hazier grade without the shadow contrast. |
| Fort room | Nearly unchanged on purpose: the interior keeps light ageing only. |

## Honest limits

This pass changes light, air and surface tone. Geometry, people and vehicles are untouched, so the primitive silhouettes and mannequin crowd remain (plan P3–P5). Procedural weathering cannot follow real window or ledge positions, and its streaks are subtle beyond about 15 m. The darker near street suits the mood, but it should be checked on a real display. ## Verification

- Unit tests: 81 pass, including 3 new atmosphere tests. Typecheck and production build pass.
- Browser suite (`playwright.cloud.config.ts`, SwiftShader): **35 passed, 2 failed.**
  - *A moving ride can be exited…* fails the same way on the untouched base `6216c5b`, so it is pre-existing.
  - *Taxi can be boarded… exited at its destination* passes on the base in 78 s of its 90 s budget. On this branch it exceeds 90 s, because the software renderer is slower per frame. A manual run of the same steps completes and the guide dialog opens, so the failure is the timeout, not broken behaviour. It needs a decision: cheaper or optional weathering, or a longer timeout for the software config. It has not been papered over.
