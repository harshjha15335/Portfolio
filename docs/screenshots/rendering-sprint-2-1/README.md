# Sprint 2.1 rendering evidence

[Full performance review](../../ART_PRODUCTION_PERFORMANCE_REVIEW.md). Base `fdae57a`, optimized branch `feature/cst-fort-rendering-optimization`. All controlled cameras/framebuffers1920×1080, Medium/scale1.00, DPR1, normal actors sampled at8simulated seconds. Each cached image is followed by a forced-refresh image with no simulation step. Native files are actual rendered output.

| View | Before cached | Before refresh | After cached | After refresh |
| --- | --- | --- | --- | --- |
| spawn | [image](before/spawn-cached.png) | [image](before/spawn-refresh.png) | [image](after/spawn-cached.png) | [image](after/spawn-refresh.png) |
| station | [image](before/station-cached.png) | [image](before/station-refresh.png) | [image](after/station-cached.png) | [image](after/station-refresh.png) |
| junction | [image](before/junction-cached.png) | [image](before/junction-refresh.png) | [image](after/junction-cached.png) | [image](after/junction-refresh.png) |
| hero-wide | [image](before/hero-wide-cached.png) | [image](before/hero-wide-refresh.png) | [image](after/hero-wide-cached.png) | [image](after/hero-wide-refresh.png) |
| npc | [image](before/npc-cached.png) | [image](before/npc-refresh.png) | [image](after/npc-cached.png) | [image](after/npc-refresh.png) |
| fort-room | [image](before/fort-room-cached.png) | [image](before/fort-room-refresh.png) | [image](after/fort-room-cached.png) | [image](after/fort-room-refresh.png) |
| return | [image](before/return-cached.png) | [image](before/return-refresh.png) | [image](after/return-cached.png) | [image](after/return-refresh.png) |
| taxi | [image](before/taxi-cached.png) | [image](before/taxi-refresh.png) | [image](after/taxi-cached.png) | [image](after/taxi-refresh.png) |
| auto | [image](before/auto-cached.png) | [image](before/auto-refresh.png) | [image](after/auto-cached.png) | [image](after/auto-refresh.png) |

[Before pass counters](before/measurements.json) and [after pass counters](after/measurements.json) include exact public shadow-hook counts, total submissions, CPU render-call observations and matching camera/time metadata. Medium has one non-shadow scene pass. High main-and-other counters also include normal/effect passes.

The separate `static-after` folder repeats the original1440×900 pedestrian review and390×844 mobile framing; its limits remain110draws /230,000submitted triangles /32textures /26programs. Earlier Sprint1/2 artifacts remain in their original folders.

The `continuous-before` and `continuous-after` profiles are actual1920×1080 continuous software observations of the same stationary camera/crowd scenario, not hardware/laptop evidence. Warmup10seconds, requested observation48seconds, fixed Medium/scale1.00. Small sample counts and GPU timer unavailability prevent representative frame-time claims.

## Additional animation step

Matched actor snapshots at8.4seconds complement the8.0second set. They preserve the same cameras/settings and verify changing poses retain shadow/culling cues. This is not real-time hardware motion acceptance.

| View | Before8.4 refresh | After8.4 refresh |
| --- | --- | --- |
| spawn | [image](temporal-before/spawn-refresh.png) | [image](temporal-after/spawn-refresh.png) |
| hero-wide | [image](temporal-before/hero-wide-refresh.png) | [image](temporal-after/hero-wide-refresh.png) |
| taxi | [image](temporal-before/taxi-refresh.png) | [image](temporal-after/taxi-refresh.png) |
| auto | [image](temporal-before/auto-refresh.png) | [image](temporal-after/auto-refresh.png) |

[Complete browser log](browser-full.txt):37passes in one run. [Unit log](unit-tests.txt):78passes, including all75 original cases. [Admission log](asset-admission.txt):4passes. TypeScript/build logs and the initially timed-out new vertex assertion are retained. Browser-suite PNGs are saved separately; earlier root/sprint artifacts were preserved.
