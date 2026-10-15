# Sprint 2 matched visual evidence

Baseline: `ab0b0c6`. Final working branch captures: `feature/cst-fort-art-production-sprint-2`. Desktop1440×900, mobile390×844. See [written visual review](../../ART_PRODUCTION_SPRINT_2.md) for limitations and methods.

| View | Before | After |
| --- | --- | --- |
| 1440-auto | [before](before/1440-auto.png) | [after](after/1440-auto.png) |
| 1440-fort-room | [before](before/1440-fort-room.png) | [after](after/1440-fort-room.png) |
| 1440-fort | [before](before/1440-fort.png) | [after](after/1440-fort.png) |
| 1440-hero-wide | [before](before/1440-hero-wide.png) | [after](after/1440-hero-wide.png) |
| 1440-hero | [before](before/1440-hero.png) | [after](after/1440-hero.png) |
| 1440-junction | [before](before/1440-junction.png) | [after](after/1440-junction.png) |
| 1440-north-limit | [before](before/1440-north-limit.png) | [after](after/1440-north-limit.png) |
| 1440-npc | [before](before/1440-npc.png) | [after](after/1440-npc.png) |
| 1440-research-sources | [before](before/1440-research-sources.png) | [after](after/1440-research-sources.png) |
| 1440-research | [before](before/1440-research.png) | [after](after/1440-research.png) |
| 1440-return | [before](before/1440-return.png) | [after](after/1440-return.png) |
| 1440-shops | [before](before/1440-shops.png) | [after](after/1440-shops.png) |
| 1440-side-gap | [before](before/1440-side-gap.png) | [after](after/1440-side-gap.png) |
| 1440-south-look | [before](before/1440-south-look.png) | [after](after/1440-south-look.png) |
| 1440-spawn | [before](before/1440-spawn.png) | [after](after/1440-spawn.png) |
| 1440-station | [before](before/1440-station.png) | [after](after/1440-station.png) |
| 1440-taxi | [before](before/1440-taxi.png) | [after](after/1440-taxi.png) |
| 390-fallback-theatre | [before](before/390-fallback-theatre.png) | [after](after/390-fallback-theatre.png) |
| 390-mobile | [before](before/390-mobile.png) | [after](after/390-mobile.png) |
| 390-research | [before](before/390-research.png) | [after](after/390-research.png) |

[Matched pose metadata](pose-comparison.json), [final renderer measurements](after/measurements.json), [research scroll metadata](after/research-measurements.json). Thirteen pedestrian camera poses match exactly. Passenger offsets and hailing procedure remain unchanged.

Iterations1–5 retain intermediate art/shader work; they are not final acceptance captures. The initial full browser run had36passes andone canvas-startup timeout; its retained trace documents the failure. [Final focused regression](focused-browser.txt): six passes, including walking, both rides, original Fort doorway polling and desktop/mobile exhibition. All37 scenarios passed across the initial and focused runs; a clean single full run is not claimed. Unit, build, typecheck and audit logs are retained here. Software benchmark evidence, when generated, is labelled separately and cannot substitute for laptop measurements.

[Completed production software smoke](software-smoke/summary.json): five scenarios, no page errors,1–6 samples each; shortened moving rides. Continuous peak195draws /456,636triangles exceeds provisional limits. This is not hardware acceptance.
