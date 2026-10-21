# Project state: Harsh Jha's Mumbai portfolio

**Snapshot:** 21 October 2026, `main` at `65b812c` (merge of PR #26). Live at <https://portfolio-beta-murex-52.vercel.app/>.

Statuses used below: **PASS** (checked, with the evidence named), **PARTIAL** (some of it checked, or it works with a known gap), **FAIL**, and **NOT TESTED** (no evidence either way). "Inferred" means reasoned from code or nearby evidence rather than measured.

## 1. Summary

- The site is a first-person, golden-hour Mumbai you walk through to read Harsh's portfolio, plus a plain HTML "Quick View" of the same content that never loads the 3D engine.
- All nine canonical districts are walkable. Each has a guide, exhibit boards opened with E, a guided tour and journal entries. Several have working interactive demos ported from the real projects.
- Eight named people stand in the city: Harsh hosts at CST and seven friends and family members have one district each.
- PRs #1 to #26 are all merged. No PR is open.
- On `main` today, 348 of 348 unit tests pass (run locally for this report), and CI is green on the latest commit.
- The weakest area is real-hardware evidence. Harsh ran `/?bench` on a phone and a PC on 20 October, before PRs #20 to #26, and nothing has been measured on a real device since.

## 2. The site

| Item | State |
| --- | --- |
| Live URL | <https://portfolio-beta-murex-52.vercel.app/> |
| Production deploy | Vercel deployed `65b812c` to Production at 03:57 UTC, 21 October 2026 (GitHub deployments API) |
| Ways in | The 3D world (`#world`), or Quick View, an HTML portfolio with projects, case studies, experience, skills, résumé and contact |
| Fallback | Quick View also covers a WebGL failure or a lost GPU context; `/?webgl=off#world` exercises it |
| Deep links | `#/project/<id>` opens a project page without the 3D world; `#/place/fort` opens the HTML guide |
| SEO | Canonical URL, Open Graph image, sitemap and robots point at the Vercel origin; `tests/seo.test.ts` guards them |

## 3. The nine districts

CST and Fort share one street. The other seven are built one at a time, 600 m apart, and stream in when you ride or fast travel there.

| District | Portfolio content | What you find there |
| --- | --- | --- |
| CST Arrival Terminus | Intro and orientation | Station front, Radio House benchmark façade, a departure board that indexes every district, taxi and auto stands, crowd and traffic. Harsh is the host. |
| Fort Research Institute | GSoC 2026, QC-Devs / Theochem, FFprime | Furnished research room: gradient-check activity, FFprime coordinate workstation (Stone-convention conversions), FFprime terminal, contribution board. Aarush Shetty stands here. |
| BKC Systems Office | CCIEeXpert internship | Boulevard, plaza and a walk-in lobby floor with reception, desks, a glass meeting room and a rate-limit console activity. Pavit Singh. |
| Andheri Tech Bazaar | Skills with evidence | A lane of five skill shops (AI, backend, DevOps, frontend, language), each running real logic with fixtures recorded from Harsh's code. Anuj Deshpande. |
| Powai Builder's District | Flagship projects | A walk-in workplace per project along the lake. Working labs for NORTHSTAR, MoneyMetrics, Meeting Intelligence, RideFlow, RepoLens and ASTFLOW, plus a RECO case study. Arham Jain. |
| Dadar Junction | Education and timeline | Station, chawl and maidan with six platform boards and rain trees. Ranjan Jha. |
| Worli Proof Deck | Achievements and hackathons | Sea face with four evidence cases; you name the evidence behind each claim. Rina Jha. |
| Juhu Studio | About, résumé, contact | Beach, stalls, almond trees and a walk-in studio with work table, bookshelf, sofa, notice board, résumé stand and contact terminal. Abhinav Jha. |
| Film City Talkies | Nine-scene journey | Studio lot and a walk-in cinema: lobby, box office, scene board, snack counter and a ten-row auditorium whose screen starts the film. The film itself is an HTML slideshow. |

`tests/districts.test.ts` checks that all nine are reachable with a guide and an arrival stop (**PASS**).

## 4. Named people

Built from Harsh's photos as stylised likenesses on licensed Rocketbox bodies, not photo-exact faces (PR #23). Each one turns to face the visitor within 3.4 m and can be talked to with E.

| Person | District | Role in the world |
| --- | --- | --- |
| Harsh Jha | CST Arrival Terminus | Arrival host (keeps the district guide role) |
| Aarush Shetty | Fort Research Institute | Research fellow |
| Pavit Singh | BKC Systems Office | Systems engineer |
| Anuj Deshpande | Andheri Tech Bazaar | Stack guide |
| Arham Jain | Powai Builder's District | Demo lead |
| Ranjan Jha | Dadar Junction | Timeline keeper (shirt and shorts, as Harsh asked) |
| Rina Jha | Worli Proof Deck | Host |
| Abhinav Jha | Juhu Studio | Studio helper |

- Abhinav moved from his first spot to Juhu Studio in PR #24, so every named person now has a district of their own. **Merged** 03:05 UTC, 21 October; confirmed in `src/data/friends.ts` on `main`.
- Abhinav is a young teen, so by policy he has no face likeness: he has a generic face with only his hair and outfit matched.
- The rest of the crowd is anonymous Rocketbox cast. Procedural figures appear only as loading stand-ins.

## 5. Gameplay systems

| System | What it does | Status |
| --- | --- | --- |
| Movement and look | WASD or arrows, Shift to run, Space to jump, mouse look with pointer lock, comma/period to turn; on phones, drag to look and hold on-screen buttons to walk | PASS (e2e specs) |
| Collision | You collide with buildings, props, people and vehicles: cannon spheres plus a hard push-out (`DynamicBlockers`) | PASS (`tests/collision.test.ts`) |
| Interaction | Gaze targeting with a gold marker; E opens guides, exhibits, boards and stands | PASS |
| Exhibits | 27 exhibit boards in the seven outer districts, plus the Fort room exhibits and the CST departure board | PASS (`tests/district-exhibits.test.ts`) |
| Activities | Gradient check (Fort), rate-limit console (BKC), skill shops (Andheri), platform boards (Dadar), evidence cases (Worli), contact terminal (Juhu), scene board (Film City) | PASS (unit tests) |
| Guided tours | Generated per district; the camera frames each exhibit in turn | PASS |
| Journal (J) | Districts visited, discoveries, quest progress; saved in the browser under `hj-progress-v1` | PASS (`tests/gameplay.test.ts`) |
| Achievements | 12: First Steps, Research Explorer, Finite Differences, Systems Thinker, Skill Collector, Builder, Time Traveler, Receipts Checked, Said Hello, Kaali-Peeli Regular, Film Buff, City Explorer | PASS |
| Quest | "Discover the Engineer": Fort research, BKC, a Powai project, Andheri, Juhu. It restricts nothing. | PASS |
| Map (M) | Open a district, ride there, or fast travel; shows the active objective | PASS |
| Taxi and auto rides | Hail, wait for pickup, choose any district, ride in the passenger cabin; a cross-district ride is an exit leg, a cut, then an arrival leg. You cannot drive. | PASS (`tests/city.spec.ts` 14/14 on PR #22) |
| Fare meter | A physical 3D meter beside the passenger, at eye level, with three red seven-segment rows (fare, waiting, distance). No on-screen fare box, as Harsh asked. Taxi base fare ₹28. Labelled as a demo fare, not an official tariff. | PASS (`tests/fare-meter.test.ts`, 48 state cases; passenger-view screenshots) |
| Traffic | Modelled cars, buses and bikes on authored lanes; braking, following, yielding to the visitor and to people on zebras, junction turn-taking, no overlaps, no pop-in in view | PASS (`tests/traffic-safety.test.ts`, 4-minute long runs on all 8 streets) |
| Brake lamps | Light when a vehicle slows or is held | PASS (`tests/brake-lights.test.ts`; seen on Fort Road) |
| Signalled crossings | Zebras have a signal cycle and traffic holds for it | PASS (`tests/crossings.test.ts`) |
| Lane changes and overtaking | | NOT TESTED (not built) |
| Trees | Branching trees with leaf sprays and GPU wind (off under reduced motion): rain trees in Dadar, Indian almond in Juhu | PARTIAL (no gulmohar, peepal or banyan; no tree LOD) |
| Signs | 216 signs audited for burial and legibility; 38 Tier-1 signs legible from a walkable point; 16 fixed | PASS (`tests/signs.test.ts`); exhibit boards not yet audited |
| Traffic overlay | `/?debug&traffic` (dev server) shows envelopes, held count, closest gap and interventions | PASS |

## 6. Architecture and stack

**Stack:** React 19, Three.js 0.180, cannon-es (physics), Recast navigation (crowd navmesh, streamed as a 339 kB `.wasm`), postprocessing, three-mesh-bvh, three-bvh-csg, TypeScript 5.9, Vite 7. Tests use Vitest 4 and Playwright 1.56 with axe-core.

| Path | Responsibility |
| --- | --- |
| `src/app/App.tsx` | Modes (intro, world, quick), hash routes, overlays, map, journal |
| `src/core/WorldEngine.ts` | Renderer, camera, input, physics, interactions, rides, teardown. Loaded with a dynamic import, so Quick View never downloads Three.js. |
| `src/core/StreetRenderer.ts`, `AdaptiveQuality.ts` | High, Medium and Low presets; runtime render-scale fallback that drops one way to the low tier |
| `src/game/World/MumbaiStreet.ts` | The CST–Fort street, the Fort room, crowd and traffic |
| `src/game/World/districts/` | `CityDistricts` builds the seven outer districts in time slices and disposes the inactive ones; `DistrictCast`, `CityVehicleModels`, `exhibits.ts`, `interiors.ts`, `powaiLabs.ts`, `nature.ts`, `signAudit.ts` |
| `src/game/progress.ts`, `src/data/tours.ts` | Journal, achievements, quest, tours |
| `src/data/friends.ts` | Named people: placement and dialogue |
| `src/projects/`, `src/research/` | Ported project and research logic behind the labs |
| `src/ui/` | HTML panels, labs (lazy-loaded), exhibits, HUD, ride meter row, theatre |
| `scripts/` | Blender vehicle builds, character likeness pipeline, capture and probe tools |

Assets: Rocketbox cast (licensed), Poly Haven scans for walls, stone, pavers and road, and vehicle models built in Blender for this project. Provenance is in `CREDITS.md` and `docs/ASSET_PROVENANCE.md`.

## 7. Performance and budgets

Almost all renderer numbers come from SwiftShader, a software renderer in a cloud container that runs at about 1 fps. Those frame times say nothing about real devices; only the resource counts (draws, triangles, textures, programs, bytes) compare.

| Check | Status | Evidence |
| --- | --- | --- |
| Draw calls per frame (ceiling 110) | PASS | at most 90 at CST, 48 at Fort, 54 to 77 in the districts (`WORLD_PERFORMANCE_REPORT.md`, 21 October) |
| Static triangles per district (ceiling 180,000) | PASS | `tests/districts.test.ts`; Dadar is closest at 177,706 |
| On-screen triangles (ceiling 230,000) | PARTIAL | districts fit (Dadar 209k); Harsh's PC bench on 20 October saw CST at 233k |
| Image textures in view (ceiling 32) | PASS | 21 to 26 at every stop. The renderer's total is higher because it counts small bone textures (`PERFORMANCE_REPORT.md`) |
| Shader programs (ceiling 26) | PARTIAL | programs in view are 15 to 26 in the container, but Harsh's PC saw 29 at CST and Fort. The cumulative count per session keeps growing (CST 66, BKC 88 after the latest pass). No ceiling has been raised. |
| Download size | PARTIAL | landing chunk about 373 kB (121 kB gzip), but the world now fetches 36.3 MB of models and textures, up from 18.7 MB after the named-people PRs |
| District arrival freeze | PARTIAL | PR #20 builds districts in slices behind "Heading to…". On Harsh's PC build steps still took 300–440 ms, and CST, Fort and BKC stall for 0.7–1.8 s on their first view (20 October, before #21 to #26) |
| Phone frame rate | PARTIAL | Harsh's flagship Android (Adreno 740), 20 October at `018a694`: 60 fps at all nine stops, p99 16.7 ms, plus a 0.8–1.0 s freeze on first arrival in each outer district (since addressed by PR #20). Not re-run since PRs #20 to #26. |
| Laptop / PC frame rate | PARTIAL | Harsh's PC (Brave, Windows), 20 October: 58 fps, p50 16.7 ms, adaptive scale dropped to 0.75–0.85 at CST and Fort, one 566 ms spike at CST. Not re-run since. |
| Low-end phones and integrated-GPU laptops | NOT TESTED | no runs |

Anyone can measure a device by opening `/?bench` on it: the camera tours all nine districts in about three minutes and gives a copyable table (`docs/GPU_BENCHMARK.md`).

## 8. Tests and CI

| Check | Status | Evidence |
| --- | --- | --- |
| Typecheck | PASS | CI on `65b812c` |
| Unit tests (Vitest) | PASS | 348/348 in 35 files, run locally on `65b812c` for this report |
| Production build | PASS | CI on `65b812c` |
| CI browser smoke | PASS on latest | `browser.spec.ts` and `a11y.spec.ts` on Chromium, mobile Chrome, Firefox, WebKit and mobile Safari, green on `65b812c`. The WebKit job was red on and off since 20 October. The cause was the fallback test's `getByRole('status')`, which matched two elements (the loader or fallback message plus the achievement-toast region). This PR scopes it to the fallback message. |
| Full Playwright suite (9 spec files, 49 tests) | PARTIAL | last full pass was 49/49 on 19 October after PR #17. Since then only parts have run (for example `city.spec.ts` 14/14 on PR #22). It takes about 50 minutes under software rendering. |
| Accessibility (axe) | PASS | `a11y.spec.ts` in CI; findings from the cross-browser run were fixed in PR #19 |

## 9. Deploy flow

1. Work happens on a branch and goes up as a pull request. CI runs typecheck, unit tests, build and the browser smoke matrix, and Vercel builds a preview.
2. Harsh's standing rule is that finished PRs are merged once green.
3. Vercel auto-deploys `main` to production. There is no manual step.
4. `vercel.json` carries the Content Security Policy. Its `connect-src` must keep `blob:`, or every NPC and vehicle renders white on production only.

## 10. Phone status

- Phone support is built in. Phones start on the Low preset with adaptive render scale and get drag-to-look plus on-screen walk buttons. CI runs the smoke tests on mobile Chrome and mobile Safari viewports.
- On Harsh's flagship Android the world held 60 fps on 20 October (see section 7).
- A separate check of the live site at phone size is running in the [Phone check of the website](https://claude.ai/code/project/chan_01EhMAdwYmLwLAWzCgdWR4m9?thread=cmsg_01EhMAdwYmLwLAWzCgdWR4m99Ps8BofoJeEG9NwrU7XQPj) thread. It had not reported a result when this report was written, so phone controls, ride and panel usability after the latest PRs are **NOT TESTED** here.
- Meter readability on a real phone is NOT TESTED.

## 11. Known issues and open items

**Performance**
- No real-device benchmark since PRs #20 to #26, which added the slice-built districts, collision-safe traffic, the meter, eight named people (+17.6 MB of downloads), trees and brake lamps.
- First-view shader stalls at CST, Fort and BKC (0.7–1.8 s on Harsh's PC).
- Programs in view at CST and Fort (29) and CST on-screen triangles (233k) are over their ceilings on Harsh's PC.

**Tests and CI**
- The full Playwright suite has not run end to end since 19 October.

**World and gameplay**
- No lane changes or overtaking.
- Trees: two species, no LOD. Dadar has about 2,300 triangles of headroom left, so more foliage there breaks its budget.
- Exhibit boards have not had the sign legibility audit.
- The meter's WAITING state has only been checked in unit tests, not seen in the running game.
- Interiors have no lights of their own; walls use an unlit surface as stand-in bounce light.
- Powai's projects share generic towers rather than distinct buildings. Districts outside CST and Fort reuse façade systems, furniture is primitive-built, and the cast has few Indian outfits.
- The city is a set of districts joined by rides and fast travel, not one continuous map, and there is no driving mode.

**Docs**
- `docs/CURRENT_IMPLEMENTATION.md` still lists gaps that PRs #19 and #21 fixed (crossing overlaps, vehicles ignoring signals, no objective on the map), and `docs/GPU_BENCHMARK.md` still says real-device numbers are unmeasured. This report supersedes both on those points.

## 12. Suggested next steps

1. Re-run `/?bench` on the live site on a phone and on the PC. It is the only way to know whether the latest PRs cost frame rate, and it decides whether the character normal maps should drop on the low tier.
2. Finish the phone check and fix whatever it finds.
3. Fix the first-view shader stalls at CST, Fort and BKC by warming those programs during the intro.
4. Run the full Playwright suite once on `main`, and investigate the intermittent WebKit smoke failure on CI.
5. Refresh `CURRENT_IMPLEMENTATION.md` and `GPU_BENCHMARK.md` from this report.
6. If there is time after that: the exhibit-board sign audit, tree LOD so more species fit the budget, and lane changes.

## 13. Pull request history

| PR | Merged | What it did |
| --- | --- | --- |
| #1 | 11 Oct | Golden-hour light, sun haze and façade weathering for CST–Fort |
| #2 | 14 Oct | Licensed, animated Rocketbox people replace street mannequins |
| #3 | 14 Oct | Visual overhaul; absorbed #2, #4 and #5 into one combined build |
| #4 | 14 Oct | Seven outer districts as walkable streets with crowds, traffic and rides |
| #5 | 14 Oct | Photo-scanned textures for walls, stone, footpaths and road |
| #6 | 14 Oct | Powai flagship labs: working demos ported from each project |
| #7 | 14 Oct | Fort coordinate workstation (FFprime Stone conventions) |
| #8 | 14 Oct | Andheri Tech Bazaar: five skill shops |
| #9 | 14 Oct | Vehicles with three detail levels; new BEST bus front |
| #10 | 14 Oct | Powai ASTFLOW lab |
| #11 | 15 Oct | ASTFLOW lab shows all published stats, no credit split |
| #12 | 15 Oct | CST–Fort gameplay: departure board, tours, journal, Fort room |
| #13 | 15 Oct | Gameplay for the seven outer districts |
| #14 | 15 Oct | Launch: feature branch merged into `main` |
| #15 | 19 Oct | Textured NPCs (CSP `blob:` fix), first-person collision, hitch fixes |
| #16 | 19 Oct | Launch of #15 onto `main` |
| #17 | 19 Oct | e2e assertion and cloud load-wait fixes (49/49) |
| #18 | 20 Oct | SEO metadata, docs refresh, CI checks |
| #19 | 20 Oct | `?bench` tour, lighter initial load, walk-in interiors, Powai workplaces, signalled crossings, accessibility and cross-browser CI |
| #20 | 20 Oct | Districts built in slices so arriving no longer freezes |
| #21 | 20 Oct | Collision-safe traffic and passenger rides |
| #22 | 20 Oct | Physical fare meter beside the passenger; on-screen fare card removed |
| #23 | 20 Oct | Eight named people as interactable likeness NPCs |
| #24 | 21 Oct | Abhinav moved to Juhu Studio |
| #25 | 21 Oct | Branching trees with leaves and wind; Tier-1 sign audit |
| #26 | 21 Oct | Brake lamps, `/?debug&traffic` overlay, physics, performance and acceptance reports |
