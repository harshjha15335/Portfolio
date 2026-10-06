# Harsh Jha — Mumbai, after hours

A first-person portfolio street inspired by the supplied Mumbai reel: tightly packed plaster façades, balconies, bilingual shop signs, overhead wires, glowing windows, pedestrians and kaali-peeli traffic at dusk. All geometry and textures are original procedural work.

## Vertical slice first

The current 3D world is **one CST-to-Fort street**, with 14 façades, shopfronts, a station host, taxi/auto stands, traffic, pavement detail and an open Fort research room. It replaces the earlier aerial diorama and personal driving experience. The remaining seven districts have their existing HTML portfolio experiences in the directory; their streets and interiors have deliberately **not** been generated before this street receives visual review. Film City currently retains its accessible slideshow; a walk-in cinema is a later expansion.

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
| Shift | Brisk walk |
| Mouse | Click for pointer lock, or drag to look if lock is unavailable |
| Comma / period | Turn with the keyboard |
| E | Talk to the nearby guide, read a research terminal, hail a nearby vehicle |
| R | Return to CST |
| M | Open the directory and pause walking |
| Escape | Release the pointer / open the menu; close overlays |
| Ctrl+K / Cmd+K | Search portfolio content and commands |
| Phone | Drag to look; hold the four directional buttons to walk |

The camera sits about 1.65m above the ground, has smooth acceleration/deceleration and a 12mm walking bob. Reduced motion disables bob and moving scenery. Opening any portfolio overlay releases pointer lock and pauses movement.

Hail a taxi or auto, wait for pickup and choose CST or Fort. The camera enters the passenger cabin, with limited look-around; the auto has a more open view. Routes follow deterministic two-lane waypoints and end beside the pavement. The meter accumulates distance and a decorative fare. Skip or exit at any time; exiting puts you on the pavement. Reduced motion arrives directly. Ambient traffic and NPCs are decorative and do not have collision avoidance AI.

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
| Film City Talkies | Existing nine-scene journey slideshow |

Quick View, project case studies, résumé, contact links, command palette and native-dialog focus remain available. `#/place/fort` opens the HTML guide. Existing `#/project/<id>` links work independently of the 3D world. `/?webgl=off#world` exercises fallback. Original portfolio data and source qualifiers are retained; see [docs/SOURCES.md](docs/SOURCES.md).

## Architecture and performance

- `src/game/World/MumbaiStreet.ts`: authored street, open-door interior, original plaster/sign atlas, instanced façades/props/pedestrians and deterministic traffic.
- `src/game/World/streetLayout.ts`: human-scale stops, camera-relative movement and road waypoints.
- `src/game/World/WalkingBody.ts`: upright collision volume, loaded with the world so Quick View stays independent of physics.
- `src/core/WorldEngine.ts`: first-person physics body, pointer lock/drag/touch controls, fixed-step simulation, passenger camera, pickup, meter, overlay pause and disposal.
- `src/game/World/TransitModel.ts`: original merged taxi/auto models with passenger cabin and driver.
- `src/ui/CityExperience.tsx`: directory, transport instruments, sourced content and accessible theatre.
- `src/data/*.ts`: unchanged project/evidence sources; updated city names.

One sunset shadow map is cached; mobile disables real-time shadows. Four local lights provide warm pools. Repeated geometry is instanced, signs share an atlas, transit parts are merged, and pixel ratio is capped. `/?debug#world` reports draw calls, triangles, textures and eye height. Static cached shadows do not follow moving pedestrians or traffic. No third-person or player-car mode is exposed.

No audio is currently enabled. Real devices, hardware GPU performance and other browser engines need separate evaluation. The current street is a reviewable visual checkpoint, not a claim that the whole reference world has been recreated. See [docs/CITY-QA.md](docs/CITY-QA.md) for validation and captured evidence.

## Deploy

Deploy `dist/` with the existing Vercel or Netlify config. Use the branch containing the first-person change, rather than an older city branch. Repository-subpath hosting such as GitHub Pages requires an appropriate Vite `base`. Before a permanent public deployment, set the real canonical origin in metadata/sitemap. Hash routes need no case-study server rewrites.

## Visual rebuild checkpoint

The `feat/mumbai-visual-rebuild` revision upgrades this same street with four deterministic façade grammars, inset windows, PBR surface variation, original shaped taxi/auto bodywork, articulated pedestrians and branched vegetation. City audio is optional and muted until enabled in the world menu. Adaptive quality reduces render scale, shadows and pedestrian density after sustained slow frames.

See [reference audit](docs/GULMOHAR_REFERENCE_AUDIT.md) and [visual rebuild QA](docs/VISUAL-REBUILD-QA.md) for evidence and the expansion gate. The public reference could not be fetched through this workspace's network. This is still the CST/Fort slice; the seven other physical districts and a walk-in cinema remain future work.

To reproduce the review captures, start Vite and run `node scripts/capture-street.mjs`. Set `CHROMIUM_PATH` when Chromium is installed elsewhere. `STREET_CAPTURE_URL` can select a different development-server address; the fixed review poses require Vite development mode.
