# Harsh Jha — Mumbai, after hours

A first-person, golden-hour Mumbai built as a portfolio: nine walkable districts, Rocketbox pedestrians, modelled kaali-peeli traffic, taxi and auto rides, and working demos of the projects. Live at <https://portfolio-beta-murex-52.vercel.app/>. Third-party assets (Rocketbox cast, Poly Haven scans, vehicle models built in Blender) are listed in [CREDITS.md](CREDITS.md) and [docs/ASSET_PROVENANCE.md](docs/ASSET_PROVENANCE.md).

For the full current system description, scope, controls, architecture, test evidence and limitations, see [Current implementation](docs/CURRENT_IMPLEMENTATION.md).

## What is built

All nine districts are walkable streets (CST and Fort share one street; the other seven stream in one at a time). CST and Fort are the quality benchmark: a station departure board that indexes the portfolio, a furnished research room whose exhibits each open their own panel, a gradient-check research activity, guided tours, gaze-based interaction, an exploration journal with achievements and a quest, and the metered taxi/auto loop. See [Gameplay mechanics](docs/GAMEPLAY_MECHANICS.md), the [district matrix](docs/DISTRICT_IMPLEMENTATION_MATRIX.md) and the [baseline audit](docs/GAMIFIED_PORTFOLIO_BASELINE.md).

## Run and check

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:browser -- --config playwright.cloud.config.ts
```

The dev server uses port 5173. Build includes TypeScript validation and writes `dist/`. `npm run preview` serves that output. Localhost belongs to the machine running the server; it is not a public cloud preview link.

The default browser config uses Edge. `playwright.cloud.config.ts` uses installed Chromium and software WebGL; set `CHROMIUM_PATH` for another binary. Browser runs produce screenshots. The onboarding helper `bash .sites-runtime/cloud-onboarding/run-browser.sh` keeps generated evidence in an ignored directory.

## Walk the street

| Control | Action |
| --- | --- |
| WASD / arrows | Walk forward/backward and strafe, relative to your view |
| Shift | Run |
| Space | Jump |
| Mouse | Click for pointer lock, or drag to look if lock is unavailable |
| Comma / period | Turn with the keyboard |
| E | Interact with what you are looking at: a guide, an exhibit, the departure board, a taxi or auto stand |
| J | Exploration journal: quest, achievements, districts visited |
| R | Return to CST |
| M | City map: open, ride to or fast travel to any district |
| Escape | Release the pointer / open the menu; close overlays |
| Ctrl+K / Cmd+K | Search portfolio content and commands |
| Phone | Drag to look; hold the four directional buttons to walk |

The camera sits about 1.65m above the ground, has smooth acceleration/deceleration and a 12mm walking bob. Reduced motion disables bob and moving scenery. Opening any portfolio overlay releases pointer lock and pauses movement.

Hail a taxi or auto, wait for pickup and choose any district. The camera enters the passenger cabin, with limited look-around; the auto has a more open view. The meter accumulates distance and a decorative fare. Skip or exit at any time; exiting puts you on the pavement. Reduced motion arrives directly. You collide with buildings, people and vehicles; you cannot drive.

## Portfolio directory

| Location | Content |
| --- | --- |
| CST Arrival Terminus | Introduction and orientation |
| Fort Research Institute | GSoC / QC-Devs / Theochem / FFprime |
| BKC Systems Office | CCIEeXpert internship |
| Andheri Tech Bazaar | Skills and project evidence |
| Powai Builder’s District | Five main projects |
| Dadar Junction | Journey and timeline |
| Worli Proof Deck | Achievements and sourced metrics |
| Juhu Studio | About, résumé, GitHub, contact |
| Film City Talkies | Nine-scene journey theatre |

Quick View, project case studies, résumé, contact links, command palette and native-dialog focus remain available. `#/place/fort` opens the HTML guide. Existing `#/project/<id>` links work independently of the 3D world. `/?webgl=off#world` exercises fallback. Original portfolio data and source qualifiers are retained; see [docs/SOURCES.md](docs/SOURCES.md).

## Architecture and performance

See [Current implementation](docs/CURRENT_IMPLEMENTATION.md) for the source map, render budgets and known gaps, and [Performance report](docs/PERFORMANCE_REPORT.md) for measured numbers. `/?debug#world` (dev server) reports draw calls, triangles, textures and programs.

## Checks

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, unit tests and the production build, plus a Chromium smoke run of the HTML-side flows, on every pull request and on `main`.

## Deploy

Vercel builds `main` and publishes `dist/`. Canonical, Open Graph and sitemap URLs point at the Vercel origin; change them together (`tests/seo.test.ts` checks them) if the site moves to a custom domain. Hash routes need no rewrites.

## History

Earlier checkpoints are described in their own docs: the [CST–Fort-only snapshot](docs/archive/CURRENT_IMPLEMENTATION_2026-10-10.md), [visual rebuild QA](docs/VISUAL-REBUILD-QA.md), [CST–Fort polish](docs/CST_FORT_POLISH.md), [art production sprints 1](docs/ART_PRODUCTION_SPRINT_1.md) and [2](docs/ART_PRODUCTION_SPRINT_2.md), [city districts](docs/CITY_DISTRICTS.md), [street cast](docs/STREET_CAST.md) and the [game audit](docs/GAME_AUDIT_2026-10-15.md). They describe the state at the time and are not updated.
