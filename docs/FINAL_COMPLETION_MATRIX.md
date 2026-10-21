# Final completion matrix: Mumbai After Hours

Tracks every requirement of the "Mumbai After Hours full completion" brief (21 October 2026) against what is actually in the code and what proves it. Work that already existed and was already tested is marked PASS with its existing evidence and was not rebuilt; see [PROJECT_STATE.md](PROJECT_STATE.md) for that baseline (PRs #1 to #27).

Status words: **PASS** (built and proven by the evidence named), **PARTIAL** (built, but some of the brief is missing or unproven), **NOT TESTED** (needs hardware, a person or a capture this container does not have), **NOT BUILT**.

SwiftShader (the software renderer in the cloud container) gives honest resource counts (draws, triangles, textures, programs) but not real frame rates. No frame-rate claim below comes from it.

## C. Real India time, day and night

| Requirement | Status | Evidence | Remaining |
| --- | --- | --- | --- |
| Live IST for every visitor, from an epoch instant, independent of the visitor's time zone | PASS | `src/game/World/time/IndiaWorldClock.ts`; `tests/india-clock.test.ts` checks the same instant under Los Angeles, London, Tokyo and UTC | |
| Solar position, sunrise, sunset and twilight for Mumbai | PASS | NOAA equations; tests match published times within 4 min on 21 Oct, 21 Jun and 21 Dec | Moon not modelled |
| Phase from sun altitude, not fixed hours | PASS | `dayPhase`; the brief's 8 sample times on two dates, expected phase computed from the model | |
| Device-clock drift check with fallback | PASS | `checkServer` (Date header, 90 s threshold); unit tests for drift and failure | |
| `?debug&time=HH:MM[&date=]` override, not stored | PASS | `parseOverride`; HUD shows TIME OVERRIDE | |
| Sky, sun, bounce, hemisphere, fog, exposure and shadows driven by the clock | PASS | `src/core/EnvironmentTime.ts`, `time/environmentState.ts`; `tests/environment-time.test.ts`; reference comparisons at 07:15, 15:30, 18:25, 23:00 against Harsh's four photos | |
| Full dark night that stays legible: lamp pools, lit windows, floodlit station, head and tail lamps | PASS | `time/nightLights.ts`, `traffic/BrakeLights.ts`; street test asserts pools hidden by day and lit at night; captures of all nine districts at 12:30, 18:25 and 23:00 | |
| Crossfade without pops at sunset; long sessions and sleeping tabs keep time | PASS | crossfade test samples every minute through sunset; `visibilitychange` forces an update; the clock is read every 5 s, never accumulated | |
| Same live time after rides, fast travel, tours, cinema, Quick View, preset change, context loss | PASS | one clock singleton for the page; engine reads it each update, nothing stores a copy | WebGL context-loss recovery re-creates the engine, which reads the same clock |
| No extra lit shader variants or dynamic lights at night | PASS | three lights at all times; night meshes hidden by day; measured against `main`: same programs in view at CST, BKC and Juhu by day | Dusk compiles the few night programs once |
| Time-varying crowd and traffic density | NOT BUILT | Density switching removes extra vehicles at once, which would pop them out in view; left as is rather than risk that | City sound does follow the hour (see D) |
| Interiors switch lights by time | NOT BUILT | Interiors keep their fixed lighting | |
| Live weather | NOT BUILT (by design) | Haze is artistic; no weather source is claimed | |

## D. Sound

| Requirement | Status | Evidence | Remaining |
| --- | --- | --- | --- |
| Web Audio engine with buses (master, ambience, traffic, effects, interface) and a limiter | PASS | `src/core/audio/Soundscape.ts`; `tests/audio.test.ts` | No voice or music bus (no voices are generated, by rule) |
| Starts only after a user gesture; off by default; remembered setting waits for the first press or tap | PASS | `App.tsx` sound chip and menu toggle; `tests/redesign.spec.ts` | |
| Mute, per-bus levels, saved in this browser | PASS | `audioSettings.ts`; unit tests for round trip, clamping and blocked storage; e2e checks a slider persists | |
| District and IST-hour ambience (all nine districts) | PASS | `soundscapeMix.ts` profiles and `cityActivity`; unit tests for silence in unloaded districts, insects at night only, busier evening peak | Synthesized, so it is impressionistic rather than recorded city sound |
| Traffic bed, panned pass-bys, horns with cooldown, cab engine (taxi and auto timbre) | PASS | unit test: no two horns within the cooldown; none in empty streets | |
| Footsteps by surface (stone, asphalt, tile, sand), none when standing, airborne or riding; jump and landing | PASS | unit test of cadence and silence cases | No gravel surface |
| Indoors and in-cab muffling of outdoor sound | PASS | unit test of the filter target (750 Hz cab, 1100 Hz indoors) | |
| Interface cues: map, journal, achievement, menu, meter flag, arrival | PASS | `cues.ts`; unit test that page cues reach the running soundscape and stop after dispose | |
| Voice cap and teardown | PASS | `MAX_VOICES = 14`, unit tested; dispose closes the context | |
| Dev overlay: context state, voices | PASS | `?debug` diagnostics line | |
| Suspends when hidden, paused or in Quick View | PASS | `setActive` from the engine's visibility and pause handling; Quick View never loads the engine | |
| No AudioContext available | PASS | the engine catches construction failure and stays silent | |
| Provenance | PASS | `docs/ASSET_PROVENANCE.md`: every sound synthesized, no recordings or samples | |
| How it actually sounds on headphones and phone speakers | NOT TESTED | the container has no audio output | Needs a listen on a real device |

## E. Physics, traffic, rides and meter

| Requirement | Status | Evidence | Remaining |
| --- | --- | --- | --- |
| Visitor collision with buildings, props, people, vehicles | PASS (existing) | `tests/collision.test.ts`, PR #15/#16 | |
| Collision-safe traffic, signals, zebras, brake lamps, no pop-in | PASS (existing) | `tests/traffic-safety.test.ts` (4-minute runs on all 8 streets), `crossings.test.ts`, `brake-lights.test.ts` | |
| Head and tail lamps at night | PASS | `tests/brake-lights.test.ts` night case | |
| Lane changes and overtaking | NOT BUILT | Single-lane following kept, as the brief allows when overtaking cannot be proven safe | |
| Taxi and auto rides end to end | PASS (existing) | `tests/city.spec.ts` | |
| Physical three-row meter, ₹28 demo taxi fare, no HUD fare card | PASS (existing) | `tests/fare-meter.test.ts`, `city.spec.ts` fare assertion | |
| WAITING in a real running ride, and meter continuity across the district change | PASS | `scripts/check-ride-continuity.mjs`, 21 Oct, taxi CST → BKC at live IST: meter went READY, HIRED, RUNNING, WAITING (held in traffic after the district change), RUNNING, COMPLETED; fare ₹28 → ₹283, distance 0 → 14.9 km and waiting 0 → 2.4 s never went backwards, the IST clock ran on (13:39 → 13:45) and no page errors. An auto ride CST → Fort ran READY → COMPLETED at ₹23 with no stop long enough to wait | Waiting counts simulation time (capped per frame), so under 1 fps software rendering it counts less than wall time; on a real device the two match |
| Meter readability on a real phone | NOT TESTED | | |

## F. Art and districts

| Requirement | Status | Evidence | Remaining |
| --- | --- | --- | --- |
| Nine districts, eight named people, tours, journal, 12 achievements, map, film, contact | PASS (existing) | `PROJECT_STATE.md` sections 3 to 5 | |
| Exhibit boards: free reading spot, nothing in front, legible up close | PASS | `tests/exhibit-boards.test.ts`: all 30 boards in the seven outer districts readable at 183 px or more from a free spot 1.9 m out or closer; self-lit material, so the same by night | CST departure board and Fort room exhibits are street signs, covered by `signs.test.ts`; phone-size legibility not separately measured |
| Street signs | PASS (existing) | `tests/signs.test.ts` (216 signs) | |
| Tree species and LOD | PARTIAL (existing) | rain tree and Indian almond only, no LOD | |
| Distinct Powai buildings, varied façades, Indian outfits, furniture | PARTIAL (existing) | unchanged in this pass | |
| One continuous city map | NOT BUILT | Districts are joined by rides with a cut, which the ride keeps readable | |

## G. Performance

| Requirement | Status | Evidence | Remaining |
| --- | --- | --- | --- |
| Draws, static triangles, textures within ceilings | PASS (existing) | `PROJECT_STATE.md` section 7 | |
| Night cost | PASS | a few more draws and one or two programs after dark (`docs/TIME_OF_DAY.md`) | |
| Programs in view ≤26 and CST on-screen triangles ≤230k on Harsh's PC | PARTIAL (existing) | 29 and 233k on 20 October | |
| First-view shader stalls at CST, Fort and BKC | NOT TESTED | Warm-up and the arrival shader wait already exist (PR #20). The stall can only be measured on a real GPU with `/?bench` | Needs a bench run on Harsh's PC |
| Real-device frame rate after these changes | NOT TESTED | last runs were 20 October | Run `/?bench` on the phone and the PC |
| Audio cost | PASS | no downloads (all synthesized, about 1.4 MB of noise buffers in memory at 48 kHz), at most 14 one-shot voices | |

## H and I. Controls, accessibility, tests

| Requirement | Status | Evidence | Remaining |
| --- | --- | --- | --- |
| Typecheck, lint, unit tests, build | PASS | CI on every PR | |
| CI browser smoke on five browsers | PASS | CI | |
| Full Playwright suite | PASS | 57/57 on 21 Oct on the PR #28 code: 54 in one run, plus `overhaul.spec` (failed only in a worktree whose symlinked node_modules broke the navmesh .wasm) and two `district-gameplay` tests fixed in PR #28 (they still used board spots from before PR #19 moved the boards indoors) | ~48 min under software rendering |
| Sound controls reachable by keyboard and labelled | PASS | native buttons and labelled range inputs; `a11y.spec.ts` | |
| Real phone controls and panels | NOT TESTED | | |
