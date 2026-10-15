# Performance evidence and acceptance

## Test profile

Cloud Linux, Node24.19, system Chromium, SwiftShader software WebGL. One browser worker; native screenshot review at 1440×900 and 1920×1080, phone390×844. Desktop review uses `?debug&review=1` and reduced motion for repeatable poses, exposure1.12, FOV68 and eye1.68m. This holds full scale instead of allowing adaptive fallback to make screenshots misleadingly faster. It is **not** the required representative laptop GPU profile.

Final on-demand static measurements are in `screenshots/production-overhaul/after/measurements.json`; continuous-rendering measurements remain in `screenshots/production-overhaul/iteration-4/measurements.json`, including frame rate, draws, submitted triangles, texture count, shader programs, JS heap, render scale and pose. Development canvas data also exposes navigation status and separately measured NPC/traffic update milliseconds. Screenshot values are static/reduced-motion samples; they cannot certify active animation/traffic CPU cost.

Baseline native street frames: up to82 draws/179,028 triangles/eight textures/fourteen programs, software0.4–1.0FPS. The first complete overhaul iteration's spawn sample after face batching:87 draws/168,111 triangles/23textures/21programs,50MBJS, software0.3FPS. Changes in triangles include new CSG and lower-cost folded leaves; independent skinned humans add bone-texture cost; High postprocessing adds render targets. Final captures supersede iteration numbers. Renderer totals include all effect passes and tracked render targets, not just source image textures; texture counts must not be misrepresented as texture memory.

## Budgets and unverified gates

Provisional Medium ceiling:110 draws,230k submitted triangles,32 tracked textures,26 programs in steady cached-shadow street frames. High adds normal/SSAO passes, so it must be separately sampled. This ceiling is a review budget, not a performance acceptance claim. Adaptive quality disables effects/shadows and reduces scale after sustained slow frames; Low remains available manually. The continuous skinned garment surface adds approximately38k submitted triangles compared with the prior segmented-shirt iteration; the budget reflects that actual asset choice. This is not permission to expand or a passing GPU result. The increased rendering overhead compared with baseline is explicitly a risk requiring laptop review.

Required hardware profile: a representative modern laptop with integrated or discrete GPU identified by model, browser/version,1080p, plugged-in power profile,60Hz. Warm the scene, then record p50/p95/p99 frame times over walking, crossing crowd, taxi/auto rides, Fort room and theatre playback. Target60FPS with stable frame times; no universal60FPS claim. Cloud SwiftShader cannot satisfy this test, so expansion remains blocked.

The lazy WASM compatibility chunk is726.36KB raw/217.70KB gzip. World engine chunk is316.87KB raw/93.49KB gzip; Three522.58KB raw/132.74KB gzip; physics85.56KB raw/24.87KB gzip. Accessible initial content remains independent of 3D chunks. Vite reports chunks above500KB; no warning is hidden. No downloaded GLB/texture payload is added. Full skeleton geometry LOD, district streaming and compressed external assets are not claimed.

CPU-only authored-world simulation (779 samples, Node, concurrent browser workload): construction1034ms; whole street update mean0.481/p950.649/p994.380ms; crowd mean0.127/p950.164/p990.409ms; traffic mean0.027/p950.038/p990.094ms. See cpu-profile.json. These are simulation costs, not browser frame times or GPU measurements.

Known owned texture-storage estimate (RGBA8 canvas maps with full mip chains): six256²surface maps≈2MiB,2048²sign atlas≈21.33MiB,2048²packed directional shadow≈16MiB, the256-face half-float PMREM atlas≈6MiB, or≈45.33MiB before driver overhead, depth renderbuffers and additional renderer-managed targets. Bump/color reuse is counted once. High's two full-resolution RGBA16F composition buffers add at least31.64MiB at1920×1080, plus normal/depth/AO buffers. These are format/dimension-based estimates, not measured GPU allocation; tracked texture counts include additional internal resources.

Reduced-motion scenes render on demand after the initial frame. Static diagnostics therefore read `idle`, not a sustained GPU FPS result. This avoids repeatedly submitting frozen crowds while preserving movement and interaction. The earlier continuous software-renderer samples remain evidence of the real rendering cost. Most of Medium’s tracked texture increase is the 18 original skeleton bone textures (16 bones, 8×8 RGBA32F: approximately1KiB each), not new photographic textures or Medium postprocessing.

Final on-demand captures may report a transient FPS value after a camera jump, or `idle` once the frame settles. Those transition-window numbers are not a continuous animation benchmark. Static geometry/draw/texture counters remain from the last submitted frame.

Final static desktop maxima: 98 draws,224,050 submitted triangles,27 tracked textures,21 shader programs; every desktop pose retained full render scale and ready authored navigation. These meet the provisional Medium count ceiling. They do not establish the laptop frame-time or final-art gate.

## 2026-10-10 polish

The latest evidence is in CST_FORT_POLISH.md and screenshots/cst-fort-polish/. Two authored pedestrian geometry detail levels reuse the same skeleton; distant geometry has fewer radial segments and a lower-resolution garment surface. Drivers are static baked poses with no per-vehicle bone texture. Added cloth, patina and foliage stay batched; woven upholstery adds one shared128×128RGBA8 map (approximately85KiB including mipmaps). Current counts are checked in fresh native captures. The laptop GPU acceptance remains unverified.

The initial polish capture exceeded the existing Medium ceiling (112 draws/265,676 triangles). It is retained as cst-fort-polish/iteration-3/. No budget increase is used to hide this result. Ambient vehicles now use lower-detail baked driver geometry and basic seating; close vehicle interiors remain in the boarded models.

Final CST–Fort native desktop review: maximum 102 draws, 231,164 triangles, 28 textures and 24 shader programs at scale1.00. The return view exceeds the unchanged provisional 230,000 triangle ceiling by 1,164 (0.51%); this pass therefore does not claim the Medium budget gate is fully satisfied. CPU-only construction1486ms; street mean0.259ms/p950.283ms/p990.387ms. Counts and CPU timings are not hardware FPS measurements.

## Art Production Sprint 1 — 2026-10-10

Fresh identical-pose baseline versus final evidence: `screenshots/art-production-sprint-1/`. Ten measured walk/boundary camera poses match; full-scale Medium desktop maxima are101 draws,224,754 submitted triangles,28 tracked textures and24 shaders. This passes the unchanged110/230,000/32/26 provisional ceilings. The prior231,164 triangle overrun is removed by distant garment topology, shared through-window geometry, fewer repeated rail posts and two-triangle distant window faces, while new backdrop architecture is added. These are static cached-shadow counts; no complete High-pass budget profile or laptop GPU acceptance is inferred.

Node CPU profile (779 samples, concurrent software-browser workload): construction1326ms; street mean0.547/p954.199/p994.442ms; crowd mean0.112/p950.100/p994.070ms; traffic mean0.064/p950.025/p990.099ms. The long-tail outliers are retained; this profile does not prove improved simulation stability. Hardware laptop FPS remains unmeasured.

Final build: WorldEngine336.28KB raw/100.36KB gzip; Three583.86/148.83KB; lazy GLB library5.71/2.45KB, character1.44/0.75KB, GLTFLoader43.92/12.95KB. WASM remains726.36/217.70KB. The Three shared chunk grows because additional loader/animation exports are retained; separate lazy chunks do not eliminate that overhead. No downloaded asset payload or new package is added. See ART_PRODUCTION_SPRINT_1.md for visual review and full functional verification.

## Sprint 2 checkpoint

Review-scale1.00 Medium static walk/room views currently peak at102 draws,226,429 submitted triangles,32 textures and26 programs, against the unchanged110/230,000/32/26 ceilings. Verified passenger/static and final regression results are summarized in [the Sprint 2 review](ART_PRODUCTION_SPRINT_2.md). Texture/program headroom is zero; a future humanoid asset requires a fresh resource/count pass before approval. Normal/roughness maps are shared across the existing material clones; no texture is re-created per façade.

Original hero props are transform-baked into one opaque surface batch with per-vertex roughness/metalness plus a transparent glass batch. A public Three `compile()` call warms only visible mesh descriptors against the real scene's light state; it avoids redundant zero-light shadow-depth variants and does not precompile invisible human contact proxies. No shader cache entry is manually deleted and no reported budget is raised. Early intermediate captures exceeded the shader ceiling and are retained as iterations, not substituted for final evidence.

Walking now uses bounded250ms fixed-step catch-up, separate from the80ms visual interpolation budget. It still steps Cannon at60Hz, caps stalls and clears input/accumulation on pause/visibility change. This addresses slow software-frame walking, not a claimed GPU optimization. The unchanged doorway assertion must pass its original12second poll in browser evidence.

See [GPU benchmark protocol](GPU_BENCHMARK.md) for1920×1080 continuous animation, real walking/crowd/transit/Fort scenarios, raw RAF/JS/GPU-query samples and device metadata. No real laptop measurement exists here. Software smoke output is labeled separately; unavailable GPU timer queries are never invented.

The production1920×1080 continuous software walking smoke records an animated-shadow peak of146 draws /396,360 submitted triangles. That exceeds the existing110 /230,000 provisional ceilings and is an unresolved defect, despite the cached-shadow static captures fitting. No budget was raised. Software timing is not laptop evidence; see the Sprint 2 review and raw smoke reports.

Final five-scenario production software smoke completed without page errors. Observed maximum:195draws /456,636triangles (auto passenger sample),32textures /26programs. Every scenario remained1920×1080, Medium/scale1.00, continuous, DPR1. Samples were only1–6 frames and rides were truncated smoke samples; this does not establish representative percentiles or full-route hardware performance. Raw evidence and exact scenario counts are linked in the Sprint 2 review.

## Sprint 2.1 rendering categories

See [production rendering review](ART_PRODUCTION_PERFORMANCE_REVIEW.md). Original cached-shadow limits remain110draws /230,000submitted triangles /32textures /26programs. Refreshed frames are now measured separately with exact public shadow-hook counts; a continuous budget is unapproved until hardware profiling. Preserved original caster flags reduce matched pedestrian shadow submissions198,139→147,219 (25.7%). Conservative moving-object culling reduces cached work; the repeated original review peaks97draws /208,637triangles /32textures /26programs. Hardware speedup is not claimed. Earlier Sprint 2 counts and its comparison against static ceilings remain historical evidence.

## Gamified CST–Fort pass — 2026-10-15

Main-pass counts with a cached shadow map (`scripts/capture-districts.mjs`, `?benchmark=1`, Medium, 1440×900, reduced motion, SwiftShader), base `7702bd3` against this branch at the same review poses. Raw data: `screenshots/gamified-after/benchmark-base.json` and `benchmark-after.json`.

| Pose | Draws base → after | Triangles base → after | Textures | Programs base → after |
|---|---|---|---|---|
| spawn | 86 → 88 | 229,179 → 230,111 | 40 → 40 | 35 → 41 |
| station | 68 → 68 | 183,811 → 184,639 | 41 → 41 | 35 → 41 |
| fort (doorway) | 33 → 35 | 143,500 → 144,432 | 42 → 42 | 35 → 41 |
| fort-room | 33 → 35 | 134,956 → 135,888 | 42 → 42 | 35 → 41 |
| return | 106 → 106 | 222,381 → 223,209 | 42 → 42 | 35 → 41 |

- Draws and triangles: the departure board, the furnished room and the four painted panels add at most 2 draws and about 930 triangles at these poses. Furniture is batched into the existing static surface batches, and every board, screen and cork panel shares the one sign-atlas texture and material, so **no texture was added**.
- Programs rose by 6 in this run, and that is unresolved. Program counts are noisy here: they include whichever Rocketbox characters happen to be visible and the shadow-depth variants compiled so far, and two runs of the base at the same pose gave 26 and 29. A direct comparison of program cache keys at `fort-room` found one certain addition, the gold interaction marker: it uses the shared glow material, but its program differs from the batched glow program in the tone-mapping parameter. The remaining differences at spawn were shadow-depth variants and cast materials. Textures (40–42) and programs were already over the 32 / 26 ceilings before this pass because of the cast (see `STREET_CAST.md`); no ceiling was raised.
- At the gameplay capture poses the debug overlay (main pass plus any shadow refresh) read: board-close 161 draws / 405,462 triangles (a shadow refresh frame, matching the base's 159 / 404,322 first frame), fort-room close-up 82 / 227,392, kiosk 54 / 163,969, contribution board 37 / 164,477.
- World load in this container (time to the first canvas, then to the loader clearing), two runs each: base 12.0 / 25.0 s and 15.3 / 30.0 s; this branch 15.1 / 27.7 s and 14.1 / 27.2 s. With reduced motion: base 12.7 / 18.9 s and 13.8 / 20.0 s; this branch 13.3 / 19.9 s and 13.9 / 19.9 s. No measurable change. Several existing browser tests wait 12 s for the canvas or the loader and fail intermittently on both branches for that reason.
- Interaction targeting now runs only after 5 cm of movement or a turn instead of every frame. No frame-time claim is made from software rendering.

## District exhibits pass — 2026-10-15

Main-pass counts with a cached shadow map (`scripts/capture-districts.mjs`, `?benchmark=1`, Medium, 1440×900, reduced motion, SwiftShader) at the district review poses, base `872ec34` against this branch. Raw data: `screenshots/district-exhibits/benchmark-base.json` and `benchmark-after.json`.

| Pose | Draws | Triangles | Textures | Programs |
|---|---|---|---|---|
| bkc | 65 → 64 | 186,649 → 182,577 | 30 → 31 | 50 → 50 |
| bkc-plaza | 73 → 73 | 194,373 → 192,580 | 30 → 31 | 50 → 50 |
| andheri | 53 → 54 | 209,032 → 208,307 | 30 → 31 | 52 → 52 |
| andheri-stalls | 60 → 61 | 241,861 → 231,775 | 30 → 31 | 52 → 52 |
| powai | 57 → 57 | 125,365 → 124,774 | 31 → 32 | 53 → 53 |
| powai-towers | 48 → 48 | 113,295 → 111,634 | 31 → 32 | 53 → 53 |
| dadar | 67 → 67 | 203,307 → 199,534 | 31 → 32 | 53 → 53 |
| dadar-station | 57 → 58 | 190,355 → 188,049 | 31 → 32 | 53 → 53 |
| worli | 73 → 74 | 198,299 → 198,760 | 31 → 32 | 53 → 53 |
| worli-promenade | 59 → 61 | 160,154 → 161,454 | 31 → 32 | 53 → 53 |
| juhu | 68 → 70 | 123,325 → 124,849 | 31 → 32 | 54 → 54 |
| juhu-stalls | 70 → 72 | 128,302 → 130,289 | 31 → 32 | 54 → 54 |
| filmcity | 52 → 51 | 151,652 → 153,840 | 31 → 32 | 52 → 52 |
| filmcity-talkies | 53 → 48 | 161,756 → 162,510 | 31 → 32 | 52 → 52 |

- Each district gains exactly one texture: the 1024² atlas its exhibit boards paint into (the district sign atlas had no room in Andheri). Board frames merge into the district's existing surface batches and all boards share one draw, so draws move by −5 to +2, within the crowd's run-to-run variation (the pavement crowds also shift slightly because they now keep clear of the boards). Programs are unchanged.
- Textures now reach the 32 ceiling at most poses and programs remain over it (50–54, cumulative and cast-driven, as before). No ceiling was raised.
