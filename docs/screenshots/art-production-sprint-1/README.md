# Sprint 1 native comparison evidence

Baseline: detached worktree at `1c9e097`. After: `feature/cst-fort-art-production`.

Desktop 1440×900, fixed eye-level poses, FOV68, exposure1.12, reduced motion and review scale1.00. Mobile/fallback 390×844. No reference reel frames are shipped.

Ten measured walk/boundary poses match exactly; see [pose-comparison.json](pose-comparison.json). Passenger screenshots hail both vehicles from the same Fort pavement position, retaining the same cabin camera offsets.

| View | Before | After |
| --- | --- | --- |
| 1440-auto | [PNG](before/1440-auto.png) | [PNG](after/1440-auto.png) |
| 1440-fort | [PNG](before/1440-fort.png) | [PNG](after/1440-fort.png) |
| 1440-junction | [PNG](before/1440-junction.png) | [PNG](after/1440-junction.png) |
| 1440-north-limit | [PNG](before/1440-north-limit.png) | [PNG](after/1440-north-limit.png) |
| 1440-npc | [PNG](before/1440-npc.png) | [PNG](after/1440-npc.png) |
| 1440-return | [PNG](before/1440-return.png) | [PNG](after/1440-return.png) |
| 1440-shops | [PNG](before/1440-shops.png) | [PNG](after/1440-shops.png) |
| 1440-side-gap | [PNG](before/1440-side-gap.png) | [PNG](after/1440-side-gap.png) |
| 1440-south-look | [PNG](before/1440-south-look.png) | [PNG](after/1440-south-look.png) |
| 1440-spawn | [PNG](before/1440-spawn.png) | [PNG](after/1440-spawn.png) |
| 1440-station | [PNG](before/1440-station.png) | [PNG](after/1440-station.png) |
| 1440-taxi | [PNG](before/1440-taxi.png) | [PNG](after/1440-taxi.png) |
| 390-fallback-theatre | [PNG](before/390-fallback-theatre.png) | [PNG](after/390-fallback-theatre.png) |
| 390-mobile | [PNG](before/390-mobile.png) | [PNG](after/390-mobile.png) |

## Measurements

- [Baseline standard views](before/measurements.json) and [extra boundary views](before/boundary-measurements.json).
- [Final scene measurements](after/measurements.json):101 draws /224,754 triangles /28 textures /24 shaders maximum.
- [CPU-only profile](cpu-profile.json):simulation, not browser/GPU FPS.

## Retained iterations

- `iteration-1/`: 11 native images; intermediate source, never substituted for final evidence.
- `iteration-2/`: 11 native images; intermediate source, never substituted for final evidence.
- `iteration-3/`: 10 native images; intermediate source, never substituted for final evidence.
- `iteration-4/`: 10 native images; intermediate source, never substituted for final evidence.
- `iteration-5/`: 0 native images; intermediate source, never substituted for final evidence.
- `iteration-6/`: 14 native images; intermediate source, never substituted for final evidence.

Iterations expose budget failures, blocked shop stock, missing alley closure and the bare southern horizon. Some captures were intentionally stopped before all views completed. An empty intermediate directory is not tracked as evidence.

See [written visual review](../../ART_PRODUCTION_SPRINT_1.md) and [asset production pipeline](../../GLB_ASSET_PIPELINE.md).

## Browser regression evidence

The full run passed33/35; taxi passed its unchanged focused retry. Fort repeated a12-second polling timeout, then passed the same assertions using a temporary30-second cloud polling window. This is coverage across runs, not a clean full-suite pass.

- [Full run](browser-full-run.txt)
- [Unchanged focused retry](browser-retry.txt)
- [Fort30-second retry](browser-fort-30s.txt) and [exact temporary configuration](fort-retry-config.txt)
