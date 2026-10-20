# Current implementation — Harsh Jha Mumbai portfolio

**Snapshot:** 20 October 2026, `main` after PR #17 (`fc8eb4b`) plus the gap-audit sprint. Live at <https://portfolio-beta-murex-52.vercel.app/> (Vercel deploys `main`).

This page describes what ships today. Older checkpoints are kept for history: the 10 October description, written when only CST–Fort was physical, is in [archive/CURRENT_IMPLEMENTATION_2026-10-10.md](archive/CURRENT_IMPLEMENTATION_2026-10-10.md). Per-district detail lives in the [district implementation matrix](DISTRICT_IMPLEMENTATION_MATRIX.md).

## 1. What a visitor gets

Two ways into the same portfolio:

- **The world**: a first-person, golden-hour Mumbai. All nine canonical districts are walkable streets. CST Arrival Terminus and Fort Research Institute share one street; the other seven (BKC, Andheri, Powai, Dadar, Worli, Juhu, Film City) are built one at a time, each 600 m apart along X, and stream in when you travel there.
- **Quick View**: an HTML portfolio (projects, case studies, experience, skills, résumé, contact) that never loads the 3D engine. It is also the fallback when WebGL fails or the context is lost.

| District | Content | Physical state |
| --- | --- | --- |
| CST Arrival Terminus | Intro, orientation, departure board indexing every district | Station front, Radio House benchmark façade, taxi and auto stands, Rocketbox crowd, modelled traffic |
| Fort Research Institute | GSoC 2026, QC-Devs/Theochem, FFprime | Furnished research room: gradient-check activity, coordinate workstation, FFprime terminal, contribution board |
| BKC Systems Office | CCIEeXpert internship | Boulevard and plaza with a rate-limit console |
| Andheri Tech Bazaar | Skills with evidence | Lane with five skill shops running real logic |
| Powai Builder's District | Flagship projects | Lakeside towers; working demo labs for NORTHSTAR, MoneyMetrics, Meeting Intelligence, RideFlow, RepoLens and ASTFLOW |
| Dadar Junction | Education and timeline | Station, chawl and maidan; six platform boards |
| Worli Proof Deck | Achievements | Sea face with four evidence cases |
| Juhu Studio | About, résumé, contact | Beach, stalls and three boards in front of the studio |
| Film City Talkies | Nine-scene journey | Studio lot, box office and scene board; the theatre itself is an HTML slideshow |

Every district has a guide, exhibits opened with E, a generated guided tour, and journal entries. Progress (journal, achievements, quest) is stored locally under `hj-progress-v1`.

## 2. Getting around

| Input | Action |
| --- | --- |
| WASD / arrows | Walk, relative to the view |
| Shift | Run |
| Space | Jump |
| Mouse | Click for pointer lock, or drag to look |
| Comma / period | Turn with the keyboard |
| E | Talk to or inspect what you are looking at |
| M | City map: open a district, ride there, or fast travel (GO) |
| J | Journal: quest, achievements, districts visited |
| R | Return to CST |
| Escape | Release the pointer, open the menu, close overlays |
| Ctrl/Cmd + K | Command palette |
| Phone | Drag to look, hold the on-screen buttons to walk |

Taxis and autos are passenger rides with a running meter and a destination choice covering every district. A cross-district ride is an exit leg, a cut, then an arrival leg. Fares are decorative. The visitor cannot drive.

The visitor collides with buildings, props, people and vehicles (cannon spheres plus `DynamicBlockers` push-out). Crowds walk a Recast navmesh; traffic follows authored lanes.

## 3. Architecture

| Path | Responsibility |
| --- | --- |
| `src/app/App.tsx` | Modes (`intro`, `world`, `quick`), hash routes, overlays, map, journal |
| `src/core/WorldEngine.ts` | Renderer, camera, input, physics stepping, interactions, rides, teardown |
| `src/core/StreetRenderer.ts`, `AdaptiveQuality.ts` | High/Medium/Low presets and runtime render-scale fallback |
| `src/game/World/MumbaiStreet.ts` | CST–Fort street, Fort room, crowd and traffic |
| `src/game/World/districts/` | `CityDistricts` builds and disposes the other seven districts; `DistrictCast`, `CityVehicleModels`, `exhibits.ts`, `nature.ts` |
| `src/game/progress.ts`, `src/data/tours.ts` | Journal, achievements, quest, tours |
| `src/projects/`, `src/research/` | Ported project and research logic behind the labs and activities |
| `src/ui/` | HTML panels, labs, exhibits, HUD, theatre |
| `src/data/` | Portfolio claims with source qualifiers (see [SOURCES.md](SOURCES.md)) |

`WorldEngine` is a dynamic import, so Quick View never downloads Three.js, physics or navigation.

## 4. Quality and performance

Desktop starts on Medium, phones on Low with adaptive render scale; the low tier is one-way to avoid shader recompiles. Pixel ratio is capped at 1.25.

Static review budget per main pass on Medium: 110 draws, 230k triangles, 32 textures, 26 shader programs. Draws and triangles fit in every district. Textures and programs are over (Medium CST was 45/34 at `fc8eb4b`), mostly from the Rocketbox cast; see [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md) for the current numbers. The ceilings have not been raised.

All renderer numbers so far come from SwiftShader in a cloud container (about 1 fps). Real laptop and phone frame times have not been measured yet. Anyone can measure them by opening `/?bench` on the device: it tours all nine districts and produces a copyable p50/p95/p99 table ([GPU_BENCHMARK.md](GPU_BENCHMARK.md)).

Initial load: the landing chunk is about 373 kB (121 kB gzip). The working labs (ASTFLOW, Andheri shops, Powai flagship demos) load on first open, and Recast navigation is a separately streamed 339 kB `.wasm` instead of a 726 kB inlined script.

## 5. Checks

| Check | How |
| --- | --- |
| Typecheck | `npm run typecheck` |
| Unit tests (Vitest) | `npm test` |
| Production build | `npm run build` |
| Browser suite (Playwright, 49 specs) | `CHROMIUM_PATH=... npx playwright test -c playwright.cloud.config.ts` against the dev server; world specs take minutes each under software WebGL |
| CI | `.github/workflows/ci.yml` runs typecheck, unit tests and build, plus a Chromium smoke run of the HTML-side flows (`playwright.ci.config.ts`), on every pull request and on `main` |

Browser coverage is Chromium only. Firefox, Safari and real phones have not been tested.

## 6. Deploy and metadata

Vercel builds `npm run build` and publishes `dist/` from `main`. `vercel.json` carries the CSP; `connect-src` must keep `blob:` or GLB textures (every NPC and vehicle) render white. Canonical URL, Open Graph tags, `public/og-image.jpg`, `public/sitemap.xml` and `public/robots.txt` point at the Vercel origin above; `tests/seo.test.ts` guards them. Regenerate the social image with `python3 scripts/seo/make-social-preview.py <1440x900 capture>`.

## 7. Known gaps

Tracked from the 20 October gap audit:

- Real-device frame times (laptop GPU, Android phone) are unmeasured.
- Texture and shader-program budgets are exceeded on Medium.
- BKC and Juhu have no walk-in interiors; Film City has no physical auditorium.
- Powai's flagship projects share generic towers rather than distinct buildings.
- Pedestrians and traffic can overlap at crossings; vehicles do not stop at signals.
- The map does not draw the active objective or waypoint.
- Most districts outside CST and Fort use repeated façade systems; furniture is primitive-built; the cast has few Indian outfits.
- The world is a set of districts joined by rides and fast travel, not one continuous open map, and there is no driving mode.
