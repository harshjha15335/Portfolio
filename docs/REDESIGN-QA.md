> Historical record of the earlier electric-blue/car-first redesign. Current first-person Mumbai results are in [VISUAL-REBUILD-QA.md](VISUAL-REBUILD-QA.md).

# Editorial redesign audit — 6 October 2026

The redesign preserves the Three.js/Cannon engine, vehicle controls, project facts, hash routes, Quick View, résumé/contact links, command palette, native dialogs, and HTML fallback. The homepage, visual tokens, typography, entry transition, project spreads, directory, world landmarks, road graphics, props, ambient motion, terrain, garage, and About area have been redesigned.

## PC screenshot delivery

The final package follows the user's PC-only request: **46 original screenshots plus 2 overview sheets, 48 PNG images total**. Originals use 1440 × 900 and 1920 × 1080 viewports. Phone screenshots from the earlier audit are excluded from the gallery and ZIP.

- [Browse all PC images](screenshots/redesign/index.html)
- [Download the PC image package](screenshots/redesign/pc-ui-screenshots.zip)
- [Overview: screens 1–9](screenshots/redesign/overview-1440-1.png)
- [Overview: screens 10–15](screenshots/redesign/overview-1440-2.png)

| Screen | 1440 × 900 | 1920 × 1080 |
| --- | --- | --- |
| Home | [Home](screenshots/redesign/home-1440.png) | [Home](screenshots/redesign/home-1920.png) |
| Driving world | [World](screenshots/redesign/world-1440.png) | [World](screenshots/redesign/world-1920.png) |
| Quick View | [Quick View](screenshots/redesign/quick-1440.png) | [Quick View](screenshots/redesign/quick-1920.png) |
| FFprime | [FFprime](screenshots/redesign/ffprime-1440.png) | [FFprime](screenshots/redesign/ffprime-1920.png) |
| NORTHSTAR | [NORTHSTAR](screenshots/redesign/northstar-1440.png) | [NORTHSTAR](screenshots/redesign/northstar-1920.png) |
| RECO | [RECO](screenshots/redesign/reco-1440.png) | [RECO](screenshots/redesign/reco-1920.png) |
| MoneyMetrics | [MoneyMetrics](screenshots/redesign/moneymetrics-1440.png) | [MoneyMetrics](screenshots/redesign/moneymetrics-1920.png) |
| Meeting Intelligence | [Meeting Intelligence](screenshots/redesign/meeting-intelligence-1440.png) | [Meeting Intelligence](screenshots/redesign/meeting-intelligence-1920.png) |
| RideFlow | [RideFlow](screenshots/redesign/rideflow-1440.png) | [RideFlow](screenshots/redesign/rideflow-1920.png) |
| Directory / map | [Map](screenshots/redesign/map-1440.png) | [Map](screenshots/redesign/map-1920.png) |
| About / career | [About](screenshots/redesign/about-1440.png) | [About](screenshots/redesign/about-1920.png) |
| Contact | [Contact](screenshots/redesign/contact-1440.png) | [Contact](screenshots/redesign/contact-1920.png) |
| Command palette | [Palette](screenshots/redesign/palette-1440.png) | [Palette](screenshots/redesign/palette-1920.png) |
| World menu | [Menu](screenshots/redesign/menu-1440.png) | [Menu](screenshots/redesign/menu-1920.png) |
| Engine controls | [Controls](screenshots/redesign/diagnostics-1440.png) | [Controls](screenshots/redesign/diagnostics-1920.png) |

The package also contains four world-landmark views, four lower Quick View closeups (work, experience, skills, footer), six case-study evidence/link views at 1440 px, and complete Quick View images at both desktop widths. The manifest lists every delivered file. Initial composition and scrolled detail captures are taken from the live UI without replacing content or expanding dialogs into artificial layouts.

## Verification

| Check | Observed result |
| --- | --- |
| `npm test` | Passed: 34 tests in 4 files; original 29 retained |
| `npm run build` | Passed: TypeScript check and Vite build, 49 modules |
| Final `npm run test:browser` | Passed: 20 tests, 1.4 minutes; original 13 retained |
| Initial browser suite | Passed: original 13 journeys plus 5 redesign checks, 18 total |
| Targeted full/reduced-motion case studies and short landscape home | Passed: 3 tests, 19.3 seconds |

The original browser journeys remain: driving/braking/reset and pause, WebGL failure/context loss, hash reload/back/forward, keyboard focus and skip links, command search, four local demonstrations, PDF validation, local fonts, direct Quick View avoiding the Three.js download, and guided phone exploration. Added checks cover home hierarchy/action visibility at three viewport sizes, all six phone case studies in both motion modes, directory fast travel followed by E, and separation of the title/manifesto in a short 650 × 514 viewport. Phone regression checks remain part of the software verification; their images are outside the PC-only deliverable.

Five additional world tests exercise the actual Cannon routes and geometry: unobstructed spawn lane, all directory arrivals, driving over the elevated bridge, driving underneath it, and instancing/ambient-motion pause behavior.

The screenshot audit caught and corrected annotation overlaps, long-title orphan lines, the short-window title collision, and horizontal dialog overflow caused by a transformed underline. The former BUILD intro assertion now checks HARSH/JHA and verifies that the canvas is hidden during the 2D home and visible after entering the world. Existing functional checks were preserved.

## Renderer observation

A settled 1440 × 900 headless Edge sample reported **60 fps, 68 draw calls, 16,732 triangles, and 52 textures** on `ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)`. The previous audit observed 58 fps, 62 draws, 10,044 triangles, and 16 textures on the same adapter. The redesign adds six draw calls despite more than 350 instanced repeated primitives. Triangle and texture counts increased; these observations are not a sustained benchmark or a frame-rate guarantee.

## Art and remaining coverage

The world, car, diagrams, signs, props, and SVG annotations are original procedural art. There is no stock-image placeholder art. The sitemap's canonical-domain placeholder remains a deployment configuration item. Project demos are explanatory local models, with existing qualifiers and source links retained.

Fine physical-world labels become harder to read from distant views; nearby signs and the HTML case studies provide the reading paths. The chase camera shows the approached district, while the guided/aerial view shows the wider miniature model. Outer blue terrain remains quieter than the roads and project zones. A short window can scroll the home vertically to keep its text separated.

Edge/Chromium and simulated viewports were verified. Real touch hardware, Safari/Firefox, assistive technology, physical-device thermal behavior, and sustained performance still need separate checks.
