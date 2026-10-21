# World performance report: Mumbai After Hours

This report covers what the After Hours pass costs: the traffic safety layer (PR #21), the fare meter (#22), trees and signs (#25) and brake lamps with the traffic overlay (this PR). Statuses: PASS, PARTIAL, FAIL, BLOCKED, NOT TESTED.

## Method and limits

- The numbers come from `/?bench&seconds=1`, the visitor benchmark (see `GPU_BENCHMARK.md`). Each run used headless Chromium on the dev server at 960×640, Medium preset with adaptive quality on.
- The only GPU here is **SwiftShader**, a software renderer that runs at about 1 fps. Frame times are therefore smoke evidence and say nothing about a real device.
- The resource counts can be compared: draws, triangles on screen, textures, shader programs, and fetched bytes.
- Every benched commit dropped to the low tier at 0.60 scale ("L"), so the bench compares like with like.
- The bench counts what is on screen at the end of each stop's pan. The static geometry budget is checked separately, in Node, by `tests/districts.test.ts`.
- Four commits of `main` were benched one after another on 21 October 2026, so each change can be credited to the right PR:

| Label | Commit | What it contains |
| --- | --- | --- |
| Before | `b0c54c6` | main before this pass |
| +Traffic, meter | `9251b35` | PRs #21, #22 |
| +Characters | `e4e97a7` | PRs #23, #24 (another thread's character models, not part of this pass) |
| After | `7b25663` + this PR | PR #25 and the brake lamps |

## Results

Shader programs, counted cumulatively at each stop (the CST and BKC columns are the first and the last stop to compile new programs):

| | Before | +Traffic, meter | +Characters | After |
| --- | --- | --- | --- | --- |
| CST programs | 58 | 62 | 64 | 66 |
| BKC programs | 79 | 82 | 84 | 88 |
| Film City programs | 73 | 77 | 79 | 82 |
| CST draws | 89 | 90 | 88 | 90 |
| Fort draws | 50 | 49 | 48 | 48 |
| Districts' draws (BKC → Film City) | 77, 54, 61, 71, 77, 74, 59 | same | same | same |
| Models and textures fetched | 18.7 MB | 18.7 MB | 36.3 MB | 36.3 MB |
| JS | 5183 kB | 5183 kB | 5183 kB | 5183 kB |

| Check | Status | Evidence |
| --- | --- | --- |
| Draw calls stay flat | PASS | at most ±2 per stop across all four commits; the brake lamps are one instanced mesh per street (one draw) |
| Shader programs | PARTIAL | by commit order (which program belongs to which feature is inferred): +4 from traffic and meter (meter faceplate, LED windows, glass), +4 from this pass's trees and lamps (the shared foliage-wind variant, the lamp material) and +2 from the character PRs. Each district links at most 6 new programs on arrival, and no jump gave up waiting on them (`gaveup` = no everywhere) |
| Static triangles per district under 180,000 | PASS | `tests/districts.test.ts`. Dadar is the closest at 177,706 after the leaf trim (see `ENVIRONMENT_VISUAL_AUDIT.md`) |
| On-screen triangles | PASS | within ±3k per stop (e.g. Dadar 209k in all four) |
| Download size | PASS for this pass | the +17.6 MB came from the character models in #23/#24; this pass adds no assets (meter, trees and lamps are generated in code) |
| Traffic update cost | PASS (inferred) | the safety layer runs in `traffic-safety.test.ts` long runs at 4 simulated minutes per street within the test timeout; the in-game `trafficUpdateMs` is shown in `/?debug` but not recorded for this report |
| Frame rate on a real laptop or phone | NOT TESTED | no real GPU here; targets in `GPU_BENCHMARK.md` (desktop p95 ≤ 16.7 ms, phone p95 ≤ 33 ms) still need a run of `/?bench` on real devices |
| District build time | PARTIAL | SwiftShader build waits ranged from 1.3 to 4.3 s, with BKC the slowest, before and after alike; no real-device numbers |

## Raw tables

The full tables (p50/p95/p99, hitch, build, textures, programs, arrival breakdown) are not committed, because their
frame times only describe SwiftShader. To reproduce them, open `/?bench&seconds=1` on each commit and press Copy
results.
