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
