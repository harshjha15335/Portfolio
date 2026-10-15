# Full-stack game audit, 15 Oct 2026

Prompted by four reports from Harsh after walking the live world: it lags, the visitor walks through cars and
buildings, NPCs and traffic pass through things, and every NPC is a white figure. This audit covers the whole
stack (deploy headers, asset loading, physics, simulation, rendering, UI, tests, dependencies) and records what
was fixed on `claude/fpv-collision-perf-vrq8j1` and what is still open.

## 1. White NPCs: a deploy bug, not the PC

**Cause.** `vercel.json` sent `connect-src 'self'`. Every Rocketbox character and modelled vehicle is a GLB with
embedded textures; in Chromium, `GLTFLoader` decodes those images through `ImageBitmapLoader`, which calls
`fetch()` on a `blob:` URL. The CSP refused it (`Refused to connect to 'blob:…'`), the texture promise rejected,
and three.js drew the meshes with a bare white material. Any machine, fast or slow, saw the same thing on the
live site; `npm run dev` has no CSP header, which is why it never showed up locally.

**Proof.** Serving the production `dist/` with the exact `vercel.json` headers reproduced the white cast plus the
console errors; adding `blob:` to `connect-src` removed every error and the cast rendered textured.

**Fix.** `connect-src 'self' blob:` (`img-src` already allowed `blob:`). `tests/collision.test.ts` now fails if
either directive loses `blob:`.

## 2. First-person collision

The camera was already first-person; the body behind it was a stack of cannon-es spheres. Gaps found by a
walk probe (8 headings from ~75 start points per zone, 240 steps each, testing whether the camera ends up
inside a closed mesh):

| Gap | Cause | Fix |
| --- | --- | --- |
| Walking through cars, buses, autos, people | Traffic and crowds are animated meshes with no bodies | `DynamicBlockers`: an oriented footprint per vehicle and a circle per person, collected each frame near the visitor and resolved after every physics step |
| Squeezing into facades and through compound walls | Soft physics contact: pushing into a wall every step sinks the spheres 30–40 cm, enough to see inside or pop through a 25 cm wall | Static boxes are also resolved as hard blockers after each step (`collectStaticBlockers`) |
| Walking through stalls, kiosks, plinths, hedges | District builders drew them without a collider | `DistrictKit` turns any upright ground-level box/cylinder without one into a static body |
| Climbing onto stalls and into awnings | Spheres ride up box edges | The visitor stays on the street floor unless jumping (Space) |
| Parked motorcycles and scooters | Props without bodies | One box per parked two-wheeler |

Probe result: about 60 pass-throughs across the eight zones before, 0 at CST and in six districts after; the
three left are buses, where the probe collects blockers once per start and the bus was out of range at that moment; in play blockers are collected every frame.

Also added: Shift to run, Space to jump, updated control hints.

## 3. NPCs and traffic passing through things

* District walkers steer: they drift left around oncoming walkers and idlers, and side-step or turn round at
  stalls (`Crowd.steer`, tested against a stall and an oncoming walker).
* The CST crowd already used the recast crowd with obstacles; unchanged.
* Lane traffic keeps to its lanes; the visitor now blocks against it instead of passing through.

## 4. Lag

Measured in a SwiftShader browser (CPU only, so absolute numbers are pessimistic, ratios are what matter):
physics 0.03–0.2 ms, world update 1.5–1.9 ms, render CPU 2.7–4.5 ms at CST with ~87 draws and ~218k triangles.
The steady frame was never the problem; the hitches were.

| Hitch | Cause | Fix |
| --- | --- | --- |
| Repeating stalls every few seconds on mid-range GPUs | `AdaptiveQuality` dropped to the low tier, recovered, dropped again; each flip recompiled every shader | Low tier is one-way for the session; reconfiguration only on an actual change |
| 1–2 s freeze entering a district or when the cast loads | New materials compiled on their first draw | `renderer.compile` warms a district, the cast and vehicle models as soon as they are built |
| GPU fill on high-DPI laptops | Pixel ratio up to 2 | Capped at 1.25 (1.5 only on the High preset on desktop) |
| GC pauses | Per-frame `Matrix4`/`Vector3` allocations in street instancing and district crowds | Scratch objects |
| Physics broadphase | Naive pair test over every body | `VisitorBroadphase`: only awake dynamic bodies are tested, O(n) per frame |

## 5. Project pages

* Every case study had a blank band under the gallery: the margin note took a whole grid row. It now sits beside
  "My contribution".
* RideFlow's depot had an empty left column and an unlabeled map: the column lists the picked route's legs,
  time, fare, walking, carbon, safety, reliability and stored score; the map is framed to the paths, with a grid,
  leg mode labels, transfer points and named endpoints.
* Other labs checked at 1440×900 with no blank regions.

## 6. Stack health

* `npm audit`: 0 vulnerabilities. `tsc --noEmit`: clean. Vitest: 27 files, 234 tests passing.
* Bundles (minified): `index` 756 kB, `recast` 726 kB, `three` 589 kB, `WorldEngine` 569 kB, `dist/` 22 MB
  (mostly GLB and texture assets).

## 7. Open items

1. **Main bundle size.** `index` (756 kB) carries all portfolio UI and data; splitting labs and case studies by
   route would cut first paint. Not touched here to keep this change about the world.
2. **Recast WASM (726 kB)** loads for the CST crowd only; it could be deferred until the visitor first nears it.
3. **Collision against non-box shapes.** Hard push-out covers upright boxes; cylinders and trimesh colliders
   still rely on soft physics contact (none found reachable in the probe).
4. **District traffic vs. walkers.** Walkers and lane vehicles do not negotiate with each other at crossings; the
   lanes and footpaths rarely overlap, but a crossing rule would remove the last overlap.
5. **Real-GPU numbers.** All timings here are SwiftShader; a run of `docs/GPU_BENCHMARK.md` on real hardware
   after deploy would confirm the hitch fixes.
