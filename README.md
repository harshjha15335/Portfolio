# Harsh Jha — Engineering Campus

A personal portfolio built as an electric-blue editorial playground. Oversized identity typography leads into a drivable world connecting research, AI systems, revenue recovery, and finance landmarks. Quick View presents the same sourced work through large project spreads. The visual architecture, car, signs, terrain, and decoration are constructed procedurally in Three.js.

## Run locally

Requires Node.js 22.12+ (or a compatible newer version) and npm.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run test:browser
npm run build
npm run preview
```

Development serves `http://127.0.0.1:5173`. The browser suite uses installed Microsoft Edge through Playwright's `msedge` channel. Install Edge if unavailable, or remove `channel: 'msedge'` from `playwright.config.ts` and run `npx playwright install chromium` to use Playwright Chromium. Browser reports are written to `playwright-report/`; failing tests retain traces and screenshots in `test-results/`.

## Explore

| Input | Action |
| --- | --- |
| W / S or ↑ / ↓ | Accelerate, brake, and reverse |
| A / D or ← / → | Steer |
| Space | Handbrake / drift |
| E | Inspect a nearby landmark |
| R | Reset car |
| M | Campus directory and fast travel |
| Escape | Close an overlay; open the world menu |
| Ctrl+K / Cmd+K | Search projects, technologies, experience, and commands |
| Pointer / touch | Inspect landmarks; drag to orbit on mobile |

Mobile uses guided exploration instead of keyboard driving. Destination buttons and the directory open the same case studies. Native dialogs support keyboard focus containment and Escape. The skip link opens Quick View. The motion control follows the initial system preference and stores a local setting.

## Architecture and content

- `src/app/App.tsx` owns view state, hash history, overlays, command search, and accessible HTML content.
- `src/core/WorldEngine.ts` owns rendering, fixed-step Cannon physics, input, cameras, proximity, raycasting, pause/resume, diagnostics, and disposal. It loads after the initial UI paint.
- `src/game/World/Campus.ts` creates original procedural landmarks, paths, collision geometry, labels, and decoration.
- `src/game/Vehicle/` contains the procedural vehicle, physics integration, and testable driving calculations.
- `src/data/` is the shared source for Quick View, project overlays, commands, and world placement.
- `src/ui/` contains native dialogs and local interactive demonstrations.
- `tests/` separates Vitest content/navigation/physics checks from Playwright browser journeys.

To update a project, edit its entry in `src/data/projects.ts`. Keep IDs stable because shared links use `#/project/<id>`. Provide problem, approach, architecture, challenges, results, ownership, skills, and source links. Preserve evidence qualifiers: résumé-reported benchmarks and seeded demo figures are explicitly identified. See [content evidence](docs/SOURCES.md) before changing claims.

The four entries with priority 1–4 form dedicated campus landmarks. Their `worldPosition`, color, and metadata feed the world. For a new landmark shape, extend `Campus.ts` and its landmark assembly, then verify collision geometry, arrival distance, camera visibility, tap selection, and mobile layout. Secondary projects share the project garage. Identity/contact and résumé path live in `src/data/portfolio.ts`; career entries and skill groups have separate data files. Replace `public/resume/Harsh-Jha-Resume.pdf` with an actual PDF at the same path. Résumé links appear only after a successful PDF content-type check.

## Diagnostics and fallback

Open `/?debug#world` for renderer statistics and live vehicle/camera tuning controls. Tuning is temporary and returns to defaults on reload. Open `/?webgl=off#world` to exercise the renderer failure path: the app displays a status message and opens Quick View. WebGL context loss also falls back to the HTML portfolio. Quick View remains readable without waiting for rendering. Project demonstrations are explanatory local models; they do not connect to the original project's APIs, financial accounts, or AI providers.

The world caps pixel ratio, uses simple generated geometry/materials, and pauses simulation while overlays are open or the page is hidden. Barlow Condensed, DM Sans, and IBM Plex Mono are self-hosted in `public/fonts/` with OFL notices and system-font fallbacks. Typography makes no request to a third-party font API. Performance depends on hardware, browser, power settings, and GPU availability. No universal frame-rate or mobile-device guarantee is made. The current automated browser coverage is Chromium through Edge, with a simulated phone viewport; Safari, Firefox, real touch hardware, assistive technology, and physical-device performance still need separate checks.

## Deployment and metadata

`npm run build` creates `dist/`. Deploy that directory to any static host. `netlify.toml` and `vercel.json` provide Vite build settings. GitHub Pages needs an appropriate Vite `base` for a repository subpath and matching public asset URLs; the default configuration targets a domain root. Hash routing keeps case-study links on the entry document without server route handling.

Before publishing on a real domain, replace `https://YOUR-DOMAIN.example` in `public/sitemap.xml` with the canonical origin, add a canonical link and `og:url` in `index.html`, and configure the host's custom domain/HTTPS. The placeholder is documentation, not an active deployment. The sitemap lists the document origin because hash fragments are client state. `robots.txt` permits indexing; HTML title/description/Open Graph metadata cover the entry page, while project overlays update titles and descriptions locally. Social preview crawlers generally do not execute client hash routes; dedicated prerendered project pages and a social preview image would be needed for independent rich previews.

Content provenance is recorded in [docs/SOURCES.md](docs/SOURCES.md). Asset and dependency attribution is in [CREDITS.md](CREDITS.md). The original functional audit is in [docs/QA.md](docs/QA.md); redesign verification, viewport evidence, and visual limitations are in [docs/REDESIGN-QA.md](docs/REDESIGN-QA.md).

## Screenshots

- [Desktop home, 1440 × 900](docs/screenshots/redesign/home-1440.png)
- [Desktop home, 1920 × 1080](docs/screenshots/redesign/home-1920.png)
- [Desktop world](docs/screenshots/redesign/world-1440.png)
- [Desktop Quick View](docs/screenshots/redesign/quick-1440.png)
- [All PC UI images — gallery](docs/screenshots/redesign/index.html)
- [PC screenshots ZIP — 48 images](docs/screenshots/redesign/pc-ui-screenshots.zip)
- [Full screen/viewport audit](docs/REDESIGN-QA.md)
