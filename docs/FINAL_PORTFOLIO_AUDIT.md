# Portfolio audit after the CST–Fort gameplay pass

2026-10-15. Covers the first pass of the gamified open-world brief: the CST–Fort vertical slice. The remaining districts are tracked in [DISTRICT_IMPLEMENTATION_MATRIX.md](DISTRICT_IMPLEMENTATION_MATRIX.md).

## Verification run

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | 25 files, 217 passed (202 before; 15 new in `tests/gameplay.test.ts`) |
| New browser journeys (`tests/gameplay.spec.ts`) | 4 passed: departure board → waypoint → arrival → journal; gradient check retry and solve; guided tour; theatre keyboard and exit |
| Full browser suite, SwiftShader (`playwright.cloud.config.ts`) | 38 passed, 7 failed in the full run. Classified below |

### Browser failures and their cause

| Test | Cause | Same on base `7702bd3`? |
|---|---|---|
| first-person walking accelerates… | Walk must cover 0.7 m in 12 s at 0.3 fps software rendering | Fails on base |
| taxi can be boarded… | 3D canvas not visible within 12 s | Fails on base |
| keyboard look changes walking direction… | Canvas not ready within 12 s | Fails on base |
| a moving ride can be exited… | Timeout during the ride | Fails on base |
| WebGL context loss… | Canvas not visible within 12 s | Passed on base in its rerun; passed on this branch in its rerun |
| reduced-motion transport… | Loader takes about 19–20 s here on both branches against a 12 s wait | Already recorded as failing on base |
| mobile guided exploration | **Real regression, fixed**: the orientation card covered the phone's interaction prompt. On phones it is now one line under the ride buttons | Passed on base; passes after the fix |

Load times measured on both branches are the same within noise (see [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md#gamified-cstfort-pass--2026-10-15)).

## Brief coverage in this pass

| Brief item | State |
|---|---|
| Phase 0 audit, baseline, reference research | Done: [baseline](GAMIFIED_PORTFOLIO_BASELINE.md), [research](PORTFOLIO_REFERENCE_RESEARCH.md) |
| Bruno-style interaction (throttled targeting, clear prompt, hover marker) | Done |
| Taxi/auto loop | Unchanged and working; rides now count toward the journal; the departure board can start one |
| Taha-style Fort interior with a research activity | Done: furnished room, six exhibits, gradient-check activity |
| Station board as navigation | Done |
| Onboarding with Skip Intro | Done |
| Journal, achievements, quest | Done, local only |
| Guided tours | CST and Fort |
| Theatre controls | Restart, skip to the end, exit, keyboard |
| Other districts' mechanics, walk-in cinema, map waypoints, driving mode | Not started. See the matrix |
| Realistic visual overhaul beyond the Fort room | Not in this pass |

## Known gaps

- Shader program count rose at the review poses; the gold marker accounts for one. Textures and programs were already over the review ceilings because of the cast.
- Furniture is primitive-built.
- BKC, Andheri and Dadar achievements fire on opening the district guide until those districts get their own activities.
- No hardware GPU measurement exists; all counts come from software rendering.
