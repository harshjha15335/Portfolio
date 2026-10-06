# Local verification — 5 October 2026

Verified on Windows with Node.js 24.16.0, Vite 7.3.6, Vitest 4.1.11, Playwright 1.63.0, and installed Microsoft Edge. Browser checks ran against the local Vite server at `http://127.0.0.1:5173` in headless mode. Desktop viewport: 1440 × 900. Simulated touch/mobile viewport: 390 × 844.

## Final command results

| Command | Observed result |
| --- | --- |
| `npm run typecheck` | Passed; no TypeScript errors |
| `npm run build` | Passed; TypeScript check and Vite production build, 45 modules transformed |
| `npm test` | Passed: 29 tests across 3 files |
| `npm run test:browser` | Passed: 13 browser tests, 2.1 minutes |
| Browser regression selection: WebGL failure, context loss, and direct Quick View | Passed: 3 tests after the fallback navigation guard, 23.6 seconds |
| Browser regression selection: intro, direct Quick View, and mobile | Passed: 3 tests after self-hosting fonts, 18.8 seconds |
| Production preview smoke at `http://127.0.0.1:4173` | Passed: all three local font families load, FFprime links to the GSoC report repository, zero remote font requests, no JavaScript page errors |
| `npm audit --audit-level=moderate` | Found 0 vulnerabilities |

The latest production output contains a 30.15 kB stylesheet (6.81 kB gzip), 268.83 kB entry JavaScript (83.96 kB gzip), 28.37 kB world engine (10.52 kB gzip), 85.01 kB physics chunk (24.74 kB gzip), and 485.41 kB Three.js chunk (122.13 kB gzip). Six local WOFF2 files total 133,744 bytes, with three OFL notices. Direct Quick View navigation was checked to avoid fetching the world engine and Three.js; entering the world afterwards created the canvas successfully.

## Behavior exercised

Vitest checks cover unique project IDs/priorities, all six case studies, the four hero landmark types, content/source/placement validity, quantitative claim qualifiers, identity/experience/skills, hash and encoded routes (including a malformed URI regression), and command multiword search/order. Nine physics/driving checks exercise acceleration, speed bounds, braking/reverse, steering, drift grip, nearest landmarks, Cannon ground integration, collision, turning, and spawn/reset behavior.

The browser suite exercised:

1. Intro → rendered world; directory opens with M, Escape closes it and opens the world menu, and Continue returns to exploration without JavaScript page errors.
2. Quick View exposes six projects; the résumé request returns `application/pdf` and `%PDF-` bytes; the actual GitHub and upstream code link destinations are present; closing a case study restores the triggering button's focus.
3. A direct RECO hash link survives refresh, updates the document title, and closes to Quick View.
4. Browser back/forward removes/restores the NORTHSTAR overlay.
5. Ctrl+K focuses search, multiword technology search opens FFprime with Enter, and an unmatched query shows the empty state.
6. Keyboard skip link opens/focuses Quick View and native modal focus remains contained while tabbing.
7. FFprime quadrupole controls change the canvas label; NORTHSTAR and RECO pipeline steps update; MoneyMetrics income input changes the computed balance.
8. Emulated reduced-motion preference updates the app and a user choice persists after reload.
9. `?webgl=off` deliberately exercises initialization failure and leaves usable project navigation. The unavailable-world entry button is hidden; palette fast travel opens FFprime while preserving Quick View.
10. `WEBGL_lose_context` on the live canvas triggers the real context-loss event, removes the renderer, and opens Quick View with a status message.
11. Direct Quick View loads no 3D engine; a successful HTTP response with an invalid résumé content type hides résumé links; selecting Enter World still creates the renderer. All three font families have loaded FontFace records, and no Google Fonts API or font CDN request occurs.
12. W accelerates the live car, D is held while driving, Space lowers the HUD speed, the directory pauses simulation while ArrowUp is held, R restores zero speed, and ArrowUp accelerates again; no JavaScript page errors were reported. Diagnostics controls are visible.
13. Phone Quick View/world have no horizontal document overflow; guided destination selection opens FFprime, and the case study does not overflow its dialog width.

## Renderer observation

The driving test queried `WEBGL_debug_renderer_info`: `ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)`. One engine diagnostics sample during this headless Edge run reported **58 fps, 62 draw calls, 10,044 triangles, and 16 textures**. This is an observed local sample on an Intel graphics adapter, not a sustained benchmark, a software-renderer measurement, or a guarantee for other hardware, power modes, browsers, or phones. Pixel ratio is capped and WebGL failures have the tested HTML fallback.

## Screenshot evidence

The full browser run captured these images for visual inspection. The self-hosted-font regression run then refreshed intro, world, and mobile images. The final production preview smoke refreshed the desktop intro again:

- [Desktop intro](screenshots/intro-desktop.png)
- [Desktop world](screenshots/world-desktop.png)
- [Desktop Quick View, full page](screenshots/quick-desktop.png)
- [Phone Quick View, full page](screenshots/quick-mobile.png)
- [Phone world](screenshots/world-mobile.png)

Earlier runs exposed a malformed-URI crash, insufficient chassis movement, palette focus loss, and Escape immediately dismissing the newly opened world menu. The source owners corrected those issues; the final full suites pass. An initially ambiguous search assertion was corrected to distinguish project evidence from a matching skill command.

## Remaining coverage and publishing work

No deployment was performed. Netlify/Vercel settings target the local production `dist/` output, but live host headers, HTTPS/custom-domain setup, and the canonical origin still need verification after deployment. The sitemap uses the explicitly documented `YOUR-DOMAIN.example` placeholder. Project repository/deployment URLs were checked as rendered destinations in this suite; their live availability was not retested here. Upstream project test/benchmark numbers are sourced portfolio content, not tests run by this portfolio.

Firefox, Safari, real mobile devices/touch sensors, screen readers, long-duration memory/performance behavior, and varied GPU drivers were not tested. Automated mobile emulation is layout/input coverage, not a physical-device performance test. Fonts are self-hosted with system fallbacks and OFL notices. `playwright-report/index.html` reflects the most recent selected regression run; rerun the full command to generate a complete current report. Failure traces are retained by configuration when future runs fail.
