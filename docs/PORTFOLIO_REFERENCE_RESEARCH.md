# Portfolio reference research

Part of Phase 0 of the gamified-portfolio brief. The live sites (bruno-simon.com, taha-shajarian.ir, rleonardi.com) were not inspected in a browser from the cloud container; every finding below comes from reading source code.

## What this pass adopted

| Idea | Source | Where it landed |
|---|---|---|
| Throttle interaction tests: re-test only after the visitor moves or turns | folio-2025 `sources/Game/InteractivePoints.js` | `WorldEngine.updateNearIfMoved` |
| Saved progress store with achievements and toasts | folio-2025 `sources/data/achievements.js`, `sources/Game/Notifications.js` | `src/game/progress.ts`, `src/ui/GameHud.tsx` (original code, not copied) |
| Room of individually interactive objects with hover feedback and focused panels | Room_Portfolio, questopia (ideas only) | Fort room exhibits, the gaze-targeted prompt and the gold marker (`interactionTargeting.ts`) |
| Guided camera moves to an exhibit, with an exit at every step | Room_Portfolio camera transitions (idea only) | `WorldEngine.frameView`, `src/data/tours.ts`, `TourCard` |
| Career told as a sequence of stations | dokson / Leonardi (idea only) | The CST departure board; the Dadar platforms already exist |

No code, model, texture or sound from any reference was copied. Bruno Simon's code is MIT, but his models and sound effects carry no reuse licence and his 2025 shaders target WebGPU/TSL, so only techniques transfer.


Scope: shallow clones of [brunosimon/folio-2025](https://github.com/brunosimon/folio-2025), [brunosimon/folio-2019](https://github.com/brunosimon/folio-2019), [AT010303/Room_Portfolio](https://github.com/AT010303/Room_Portfolio), [GlintonLiao/questopia](https://github.com/GlintonLiao/questopia) and [dokson/interactive-resume](https://github.com/dokson/interactive-resume) (default branches, cloned 2026-10-15), read at source level. Paths in the tables are relative to each repository. The target is this repository: Vite 7, React 19, three 0.180 with `WebGLRenderer`, cannon-es 0.20, Recast navigation, three-mesh-bvh, and postprocessing 6.39.5.

Facts about the target project that the decisions below depend on:

- `src/core/WorldEngine.ts` runs one rAF `frame()`. Walking uses a fixed 1/60 s cannon-es accumulator with exponential velocity blending.
- Taxi and auto rides are kinematic waypoint paths (`src/game/World/transit.ts`: `pointAtDistance`, `storyFare`). They are not physics vehicles.
- `src/game/Vehicle/Vehicle.ts` and `src/game/World/Campus.ts` are not imported anywhere in `src`, so they are dead code.
- Districts are streamed one at a time by `syncZone()`, using `zoneIndexAt` from `src/game/World/streetLayout.ts`.
- The proximity prompt comes from `updateNear()`. It runs every walking frame, allocates `Vector3`s, and makes one BVH visibility ray per candidate.
- `src/core/AdaptiveQuality.ts` does hysteresis render-scale scaling. `src/core/GPUFrameProfiler.ts` and `?debug` handle diagnostics.
- `src/core/StreetAudio.ts` is an original WebAudio synthesiser.
- `src/game/World/assets/GLBAssetLibrary.ts` accepts only same-origin GLBs and rejects every required extension except `KHR_materials_unlit` and `KHR_materials_emissive_strength`. It uses no decoders.
- `STREET_MOOD` (`src/game/World/streetMood.ts`) fixes the lighting at 17:40, golden hour.
- `focusLandmark()` deliberately never moves the camera.
- The only persistence is `localStorage` key `hj-motion`, read and written with try/catch in `src/app/App.tsx`.
- Keys are read via `event.key.toLowerCase()`, so they depend on keyboard layout.

---

## 1. Summaries

### 1.1 brunosimon_folio-2025 (bruno-simon.com)

- **Stack.** three `^0.183.2` running **`three/webgpu` `WebGPURenderer` with TSL node materials and `RenderPipeline`** (`sources/Game/Rendering.js`). Also used:
  - `@dimforge/rapier3d` `^0.17.3`, loaded with a lazy `import()` in `sources/Game/Game.js` and served through `vite-plugin-wasm` and `vite-plugin-top-level-await`.
  - howler 2.2, gsap 3, tweakpane 4, stats-gl 3.6, `@gltf-transform/*` 4, sharp, and Vite 7.
- **Architecture.** A singleton `Game`. A `Ticker` drives an ordered `Events` bus (`tick` callbacks keyed by integer order, from 0 up to 999).
- **Code licence.** MIT, © 2025 Bruno Simon (`license.md`). `package.json` says `"license": "ISC"`, which is inconsistent with that file; the MIT file governs.
- **Asset licences.**
  - Music is CC0: `static/sounds/musics/license.md` is the CC0 1.0 text, and `sources/index.html` says the Kounine tracks "are now under CC0".
  - On the Blender files, `sources/index.html` says only "Even the Blender files are there, so have fun!". That is informal, not a licence grant for the art.
  - Sound effects carry third-party library names with **no licence file**, for example `static/sounds/rain/soundjay_rain-on-leaves_main-01.mp3`, `sounds/fire/Mountain Audio - ...`, and `sounds/vehicle/suspensions/Robotic_Lifeforms_2_-_Air_Source_...` (paths cited in `sources/Game/Audio.js` and `Player.js`).
  - **Verdict:** code reusable with the MIT notice; music reusable (CC0). Do not use the models, textures or SFX. The project's original-art policy (`docs/ASSET_PROVENANCE.md`) would also reject them.

### 1.2 brunosimon_folio-2019

- **Stack.** three `^0.164.1`, **`cannon` `^0.6.2`** (the original, not cannon-es), howler, gsap, dat.gui, and Vite 5. The world is Z-up with gravity `(0, 0, -13)`.
- **Code licence.** MIT, © 2019 Bruno SIMON (`license.md`).
- **Assets.** There is no statement about `static/models`, `static/sounds` or `resources/3d`. Treat them as not licensed for reuse; MIT nominally covers "Software", not art. Ideas and code only.
- **Most relevant point.** Its `CANNON.RaycastVehicle` usage maps 1:1 onto the cannon-es API.

### 1.3 AT010303_Room_Portfolio

- **Stack.** React 18, `@react-three/fiber` 8, drei 9, `@react-three/postprocessing` 2 (Outline and Bloom), three `^0.164.1`, zustand, gsap, react-spring, leva, react-emulatorjs, and Vite 5.
- `howler` is listed in dependencies but never imported in `src/`.
- **Code licence.** None: there is no LICENSE file and no `license` field in `package.json`, so all rights are reserved by default.
- **Assets.**
  - `public/assets/SuperMarioAdvance4.gba` is a commercial Nintendo ROM, which is an infringing asset. The iframes embed the author's own external sites.
  - **Verdict:** ideas only. Copy neither code nor assets.

### 1.4 GlintonLiao_questopia

- **Stack.** React 19, R3F 9, drei 10.7, three `^0.171.0`, leva, `vite-plugin-glsl`, Vite 6, and TypeScript.
- **Code licence.** MIT, © 2022 Guotong Liao (`LICENSE`). There is no separate asset statement.
- **Assets.** The GLBs are uncompressed: no `extensionsUsed` in any `public/assets/*.glb`, despite the README's Draco/Basis claims. `public/basis` and `public/draco` are vendored but unused by `src/`. The assets are personal room and architecture art: legally under MIT as repository files, but useless for Mumbai. Code is reusable with the notice.

### 1.5 dokson_interactive-resume

- **Stack.** Static HTML, CSS and jQuery 4, with no framework. The build is Node scripts in `src/build/`; tests are Playwright.
- **Code licence.**
  - `package.json` says `"license": "UNLICENSED"`.
  - `README.md` §License says the code derives from Robby Leonardi's proprietary résumé and is "**not available for redistribution or commercial use**". It invites drawing inspiration only.
- **Assets.**
  - Some original graphics remain.
  - `font/C64_Pro_Mono-STYLE.woff` may not be redistributed (`NOTICE.txt`). The other fonts are SIL OFL.
  - **Verdict:** ideas only. No code or assets.

---

## 2. Feature tables

Legend:

- **Cx:** S, M or L complexity.
- **Perf:** runtime cost if added to Mumbai.
- **Lic:** the licensing constraint on reuse.

### 2.1 Bruno Simon — folio-2025

| Feature/mechanism | How it works | Source files | Benefit for Mumbai | Compatibility (cannon-es/Three/React) | Cx | Perf | Lic | Decision |
|---|---|---|---|---|---|---|---|---|
| Ordered game loop | `Ticker.update` caps delta at 1/30 and keeps a 30-frame average. `Events.on('tick', fn, order)` stores callbacks in sparse arrays by order: 0 Inputs, 1 Player pre-physics, 2 Vehicle pre-physics, 3 Physics, 5 Vehicle post, 6 Player post, 7 View, 8 Zones/Cycles, 9 InteractivePoints, 10 Areas, 13 Instanced, 14 Audio, 998 Render. `ticker.wait(frames, cb)` defers work by frames. | `sources/Game/Ticker.js`, `sources/Game/Events.js`, `readme.md` (§Game loop), `sources/Game/Rendering.js` | Turns `WorldEngine.frame()` (one long try-block) into named phases, making it easier to add progress, hints and zones. | Pure TS pattern with no dependency. Keep Mumbai's fixed-step accumulator; Bruno's own physics is variable-step. | M | None | MIT | **Adapt**: explicit phase list inside `WorldEngine`, not a global singleton bus. |
| Physics stepping | `world.timestep = ticker.deltaScaled` with `scale = 2`, so the step is variable. `world.step(eventQueue)`, then `drainContactForceEvents` calls each body's `onCollision(force, pos)`. | `sources/Game/Physics/Physics.js` | Contact-force-to-sound hook only. | Mumbai's fixed 1/60 step is more deterministic. The cannon-es analogue is the `body.addEventListener('collide')` used by 2019. | S | Low | MIT | **Reject** the variable step. Keep the collision-sound idea as optional. |
| Vehicle controller | Rapier `world.createVehicleController(chassis)` builds a raycast vehicle with 4 wheels. Per-wheel suspension rest length and stiffness come from player "suspension" states. Engine force is scaled by `1/(1+overflowSpeed)`. Idle brake 0.06; reverse brake when input opposes motion. Ice friction is lerped per ground collider. The post-physics pass measures speed from position delta and runs stop, upside-down, stuck and flip tests that emit events. | `sources/Game/Physics/PhysicsVehicle.js`, `sources/Game/Player.js` | Rides are scripted waypoint paths; nothing in Mumbai is player-driven. | Needs Rapier WASM, async init, and re-authoring every collider in `MumbaiStreet`/`WalkingBody`. cannon-es already ships `RaycastVehicle` (see 2019) if driving is ever wanted. | L | Med (WASM plus a second physics world) | MIT | **Reject** migration. There is no feature gap Rapier fills. |
| Stuck detection | A rolling 3 s window of distance travelled while accelerating. Under 0.5 m means a `stuck` event, which leads to a respawn prompt. | `sources/Game/Physics/PhysicsVehicle.js` (`setStuck`), `sources/Game/Player.js` (`setUnstuck`) | Visitors wedged against façades or crowds get an "R to return" hint. | Trivial on `visitor.position` in the walking branch. | S | None | MIT | **Adopt** for the walking body. |
| Input action map | Raw keyboard (`code` and `key`), gamepad, pointer, wheel and touch "nipple" go to named actions `{name, categories, keys}`. Active `filters` (`wandering`, `racing`, `cinematic`, `modal`) gate actions and are mirrored as `<html>` classes. `start`/`end`/`change` events fire per action, and the mode (mouse-keyboard, gamepad or touch) is tracked. | `sources/Game/Inputs/Inputs.js`, `sources/Game/Inputs/Keyboard.js`, `sources/Game/Player.js` (action list), `sources/Game/ClosingManager.js` | Replaces the hard-coded `['w','a',...]` list. Adds `event.code` (layout-independent WASD), one place for E/R/M/Escape, and contexts for walk, ride and overlay instead of scattered `paused`/`ride.phase` checks. | Plain TS. Touch buttons can call `start`/`end` directly. | M | None | MIT | **Adapt**: a small typed `InputActions` with contexts walk, ride and overlay. |
| Priority close (Escape) | One `close` action walks a fixed priority list: flag menu, then modal, then menu, then circuit, then projects area, then lab. Escape with nothing open opens the menu. | `sources/Game/ClosingManager.js` | Predictable Escape across ride, overlay, menu and pointer lock. Today App opens the menu on Escape *keyup* and WorldEngine separately unlocks the pointer. | Fits inside `App.tsx`'s existing keydown/keyup effect. | S | None | MIT | **Adapt**. |
| Zones (enter/leave) | Spheres or cylinders tested against player position at order 8, with `isIn` edge detection emitting `enter`/`leave`. A debug wireframe preview group is included. | `sources/Game/Zones.js`, `sources/Game/World/Areas/Area.js` (`setBounding`) | Arrival triggers for "entered Fort Open Source Hall", achievements and hint dismissal. `syncZone` today only swaps districts. | Pure math, same as Mumbai's `zoneIndexAt`. | S | Negligible | MIT | **Adopt**. |
| Area frustum gating | Each area has a `zoneFrustum` circle. If it does not intersect the camera's ground-projected view quad (`View.optimalArea.quad2`), the area's static meshes are hidden and `update()` is skipped. | `sources/Game/World/Areas/Area.js` (`setFrustum`), `sources/Game/View.js` (`optimalArea`) | Inside a district, skip crowd and traffic sub-updates for blocks behind the visitor. | The top-down quad assumption breaks for first-person. Use a view-cone or frustum-vs-sphere test instead. | M | Saves CPU | MIT | **Adapt** using `THREE.Frustum` against block bounding spheres. |
| Achievements and persistence | `data/achievements.js` rows are `[group, title, desc, total, unique]`. A group's progress is a number or a `Set` of ids; unique entries such as "visit every area" or "every project" count distinct ids. `storage.save()` writes JSON to `localStorage.achievements` on any delta and replays it silently on boot. Start and end timestamps are stored, there is a reset button, and toasts come via `Notifications`. | `sources/Game/Achievements.js`, `sources/data/achievements.js`, `sources/Game/Notifications.js`, `sources/Game/World/Areas/ProjectsArea.js` (`setAchievement`, `open`) | "Visited 4/9 districts", "Read 3/5 case studies", "First taxi ride", "Paid ₹X in fares": a light game loop over existing content. | Pure TS. Bruno calls `localStorage` without try/catch; Mumbai's `hj-motion` pattern with try/catch is better. | M | None | MIT | **Adapt**: a set-based progress store with try/catch storage. Name it "progress" or "stamps", because `src/data/experience.ts` already exports `achievements` for career data. |
| Toast queue | `show(html, type, duration, click, id)` queues while one is visible and dedupes by `id`. | `sources/Game/Notifications.js` | Shows district arrival and progress stamps without stacking. | React state queue; render with `aria-live="polite"`. | S | None | MIT | **Adapt**. |
| Proximity interactive points | Points have hidden, open and concealed states. `update()` (order 9) re-tests only when the player has moved more than 0.2 m or `needsTest` is set, then picks the nearest within 2.5 m. `temporaryHide()`/`recover()` suppress all points during a cinematic. An in-world key icon swaps between Enter, A and Cross per input mode. | `sources/Game/InteractivePoints.js` | `updateNear()` currently allocates vectors and fires BVH rays for every candidate every frame. A movement and yaw threshold cuts that to roughly a few Hz while walking and zero while standing. Suppressing points during rides and overlays is cleaner. | Direct port to `WorldEngine.updateNear()`. | S | Saves CPU | MIT | **Adopt** the threshold and hide/recover. Keep Mumbai's HTML prompt. |
| Ray cursor on proxies | Intersectables are a `Sphere`, `Box3`, `Plane` or `Mesh`. Only `active` ones within `optimalArea.radius` are tested, analytically for primitives. Enter and leave events set `cursor: pointer`. A click fires only if accumulated pointer travel is under 25 px. | `sources/Game/RayCursor.js` | Click or tap to interact in drag-to-look and mobile modes without misfiring on drags. Hover feedback for shop signs and terminals. | Mumbai already has `SpatialIndex.visible`. Add `Box3`/`Sphere` proxies on interaction targets. | S | Low (analytic tests) | MIT | **Adapt**: proxies plus a drag threshold in `pointerUp`. |
| Cinematic camera into object | `cinematic.start(pos, target)` puts a dummy camera at `pos.lookAt(target)`. gsap tweens `progress` 0→1 over 1.5 s (`power2.inOut`), and each frame the camera lerps position and slerps quaternion by `progress`. `end()` tweens back over 1 s. Callers also swap the input filter to `cinematic`, hide interactive points and disable the vehicle. | `sources/Game/View.js` (`setCinematic`, `update`), `sources/Game/World/Areas/ProjectsArea.js` (`open`/`close`) | An optional "lean-in" toward a terminal or shopfront before an overlay, then an exact return. Mumbai deliberately never moves the view (`focusLandmark` no-op), so this is opt-in only. | No gsap needed: a progress scalar in `WorldEngine.updateCamera()` with lerp and slerp, skipped under reduced motion. | S | None | MIT | **Adapt (optional)**, respecting the project rule. |
| Camera smoothing (3rd person) | The focus point follows the player through a "magnet" spring, then `lerp(…, delta*10)`. Zoom is smoothed. Speed lines strength is lerped. | `sources/Game/View.js` | First-person already uses an exponential velocity blend. | N/A | — | — | MIT | **Reject** (does not apply). |
| Day cycle | `Cycles` keyframes per-preset properties (Color or number) over normalized progress, driven by wall-clock time (`Date.now()/duration`, 4 min), with interval events (`night`, `deepNight`). | `sources/Game/Cycles/Cycles.js`, `sources/Game/Cycles/DayCycles.js` | Conflicts with the fixed 17:40 `STREET_MOOD` art direction. | Portable math. | M | Low | MIT | **Reject** for now. Revisit only if a night district is authored. |
| Weather | Temperature, humidity, rain and so on are deterministic sums of sines of the day-cycle progress, so all visitors see the same weather. A debug override lerp is available. Drives the `RainLines`, `Snow` and `Lightnings` instanced effects. | `sources/Game/Weather.js` | A future monsoon-drizzle mood. | Effects are TSL (WebGPU), so the shaders need a GLSL rewrite. | L | Med to High (particles) | MIT | **Reject** now (out of scope, perf risk). |
| Shadow camera follows view | The directional light position equals spherical(sun) plus `view.optimalArea.position`; the target follows. Map size is 2048 at high quality and 512 at low. Texel snapping is commented out. | `sources/Game/Ligthing.js` | Tighter shadow frustum along long streets, versus Mumbai's per-district fixed sun. | Mumbai refreshes shadows at ≤5 Hz, so a following frustum needs texel snapping to avoid shimmer. | M | Neutral | MIT | **Adapt** only if shadow resolution is a measured problem. |
| Quality | UA regex gives level 0 or 1. A manual toggle in Options emits `change`, which shadow map size, bloom mips and the water pass listen to. Vehicle uses fixed 1/60 at low quality. | `sources/Game/Quality.js` | Mumbai's `AdaptiveQuality` (fps hysteresis) is already more capable. | — | — | — | MIT | **Reject**. |
| Monitoring | stats-gl (GPU, Hz and CPU tracking), debug only, and currently disabled in `Game.js`. | `sources/Game/Monitoring.js` | Mumbai has `GPUFrameProfiler` and the `?debug` overlay. | — | — | — | MIT | **Reject**. |
| Audio | howler sounds registered into groups with `play`/`playRandomNext` (never the same clip twice), `antiSpam` minimum interval, per-play `onPlay` hook for volume and rate, `positions` and `distanceFade`, and a deferred `init()` after user gesture. The playlist rotates by wall clock. | `sources/Game/Audio.js` | Variation and anti-spam for horns, footsteps and taxi meter clicks. | Mumbai synthesises with WebAudio; port the group, anti-spam and random-next logic, not howler or the files. | S | Low | Code MIT; SFX not cleared | **Adapt** the logic only. |
| Onboarding intro | A loading-progress circle, then a sound on/off button in-world (`rayCursor` intersect), then `reveal` and the input filter switch. | `sources/Game/World/Intro.js`, `sources/Game/Game.js` | Mumbai already has `EntryTransition` and sound muted by default. | — | — | — | MIT | **Reject** (already covered). |
| Asset pipeline | Blender export is uncompressed, with the palette node muted. `npm run compress` (`scripts/compress.js`) runs `gltf-transform etc1s --quality 255`, then `gltf-transform draco` with edgebreaker and quantize pos 12, normal 6, uv 6, writing `-compressed.glb`. Textures go through `toktx` with per-path presets (UASTC for palette and terrain, ETC1S R-channel swizzle for masks); UI images go to WebP. Runtime `ResourcesLoader` uses `KTX2Loader('./basis/')` and `DRACOLoader('./draco/')` and switches on `VITE_COMPRESSED`. | `scripts/compress.js`, `readme.md` (§Blender/Compress), `sources/Game/ResourcesLoader.js`, `sources/Game/Game.js` | Rocketbox NPCs and vehicle GLBs are the largest downloads. KTX2 cuts VRAM and upload stalls, and Draco or meshopt cuts transfer. | Requires relaxing the `GLBAssetLibrary` extension allow-list and **self-hosting** decoders. three 0.180 ships `examples/jsm/libs/{basis,draco,meshopt_decoder.module.js}` in `node_modules`. Meshopt avoids a WASM worker. | M | Lower load, VRAM and draw stalls | MIT (pipeline code) | **Adapt**: offline `gltf-transform` with meshopt and KTX2, plus a same-origin decoder admission rule. |
| Instancing helper | `InstancedGroup` builds one `InstancedMesh` per child mesh from N reference `Object3D`s, rewriting only references flagged `needsUpdate` (physics-driven benches and fences). | `sources/Game/InstancedGroup.js` | Mumbai already instances façades and props (`README.md` §Architecture). | — | — | — | MIT | **Reject** (already done). |
| Blender reference empties | Objects named `ref<Name><n>` are collected into a map (`References.parse`) and used for zones, respawns, career lines and frustum circles. Respawns come from a `respawnsReferences` GLB. | `sources/Game/References.js`, `sources/Game/Respawns.js`, `sources/Game/World/Areas/Area.js` | Useful only if districts become Blender-authored GLBs. They are procedural today. | Trivial. | S | None | MIT | **Reject** now. Note it for GLB-authored districts. |
| Career timeline storytelling | In the career area, the player's z offset maps to a year counter (`year.start + floor(offset)`, 1 unit = 1 year) with digit meshes driven by a DataTexture. Career "lines" (stone slabs with textured text) rise to `activeElevation` 2.5 while the player is alongside. Entering the bounding zone records achievement `areas: career`. | `sources/Game/World/Areas/CareerArea.js` | The Dadar Junction "Journey and timeline" district could become a walkable timeline: years ticking on a station clock board as you walk the platform, with entries from `src/data/experience.ts` rising as you pass. | Logic is portable. Materials are TSL, so rewrite them as `MeshStandardMaterial` or `CanvasTexture`. | L | Low | MIT | **Adapt** when Dadar is built (gated by the README expansion rule). |

### 2.2 Bruno Simon — folio-2019

| Feature/mechanism | How it works | Source files | Benefit for Mumbai | Compatibility | Cx | Perf | Lic | Decision |
|---|---|---|---|---|---|---|---|---|
| Loop | `Time` uses rAF with delta clamped at 60 ms. Everything subscribes to `tick`; physics does `world.step(delta/1000)` with a variable step. | `src/javascript/Utils/Time.js`, `src/javascript/World/Physics.js` | — | Mumbai's fixed step is better. | — | — | MIT | **Reject**. |
| Raycast vehicle (cannon) | `CANNON.RaycastVehicle` with 4 wheels: radius 0.25, suspension stiffness 50, rest 0.1, friction slip 10, damping 1.8/1.5, roll influence 0.01, max travel 0.3. Steering eases at `controlsSteeringSpeed` and recentres. Engine force is applied only below max speed. Coasting applies an opposing "slow down" impulse. Brake 0.45×3. An upside-down watcher fires a `jump(true)` impulse after a timeout. Wheel visuals are copied from `wheelInfos[i].worldTransform`. Contact materials: floor–wheel friction 0.3. | `src/javascript/World/Physics.js`, `src/javascript/World/Car.js` | The ready-made path if an **optional drivable auto** mode is ever wanted. It is the same API in cannon-es 0.20, so no migration is needed. | High: the cannon-es `RaycastVehicle` API is identical. Convert Z-up to Y-up (`directionLocal (0,-1,0)`, axle `(1,0,0)` or similar). | M | Low | MIT | **Reject now / Adapt later**: rides stay scripted; keep this as the reference if driving is scoped. |
| Zones | Axis-aligned rectangles tested every tick against the car position, with `in`/`out` edge events. A projects-section zone switches the camera angle preset. | `src/javascript/World/Zones.js`, `src/javascript/World/Zone.js`, `src/javascript/World/Sections/ProjectsSection.js` | Same as 2025 Zones, with AABB rectangles suiting rectangular street blocks. | Pure math. | S | None | MIT | **Adopt** (merged with the 2025 idea). |
| In-world area prompt | `Area` draws a floor border and a fence that rises (gsap `back.out`) on enter. A key icon plus "ENTER" label fades in. `keydown` E, F or Enter while `isIn` calls `interact`. Mouse hover over a `mouseMesh` also triggers `in`. | `src/javascript/World/Area.js` | Ground-ring affordance under shop doors and taxi stands, complementing the HTML prompt. | Plain Three meshes and shaders (GLSL). | S | Low (1–2 draws per visible area) | MIT | **Adapt** as a subtle pavement marking at hail points only. |
| Camera | Third-person: `targetEased += (target-eased)*0.15` (frame-rate dependent). Zoom by wheel and pinch with easing 0.1. Named angle presets switched by zones. | `src/javascript/Camera.js` | Not first-person. | — | — | — | MIT | **Reject**. |
| Sounds | Named entries `{sounds[], minDelta, velocityMin, velocityMultiplier, volumeMin/Max, rateMin/Max}`. `play(name, velocity)` picks a random variant, maps volume to `((v-vmin)*mult)²` clamped, and randomises rate. The engine loop's rate and volume follow eased speed and acceleration progress, with different easing up and down. | `src/javascript/World/Sounds.js` | Velocity-scaled footstep and impact sounds, plus an engine loop with asymmetric easing for taxi and auto rides (improving `StreetAudio.update`). | Port the parameters to WebAudio oscillators and noise. | S | Low | Code MIT; sound files not cleared | **Adapt**. |
| Polite delayed prompt | The Three.js Journey popup appears only after distance travelled exceeds `75*(seenCount+1)`. `seenCount` and a "never again" flag are stored in `localStorage`. | `src/javascript/ThreejsJourney.js` | Pattern for non-nagging hints: show "Press E near the guide" only after N metres without an interaction, and back off each visit. | Trivial. Use try/catch storage. | S | None | MIT | **Adopt**. |
| Control onboarding | Intro section shows arrow-key or touch-control instruction meshes (different textures for touch), physically present at spawn. | `src/javascript/World/Sections/IntroSection.js` | Mumbai could paint a WASD/E hint on the CST pavement at spawn. Today hints live in the README and canvas aria-label. | Use a canvas texture decal. | S | 1 draw | MIT | **Adapt** (decal or HTML; see §3). |
| Fake shadows | Per-object alpha planes offset along a sun vector, faded by height (`maxDistance`) and orientation. Baked floor shadow material. | `src/javascript/World/Shadows.js`, `src/javascript/World/Materials.js` | Contact shadows for NPCs and vehicles when real-time shadows are off (mobile, `quality.low`). | Plain Three. Mumbai has `ShadowInstances.ts`; check overlap first. | M | Low | MIT | **Adapt** only for the mobile/low preset if NPCs look floaty. |
| Matcap materials | All world meshes use matcap shades per colour. | `src/javascript/World/Materials.js` | Conflicts with Mumbai's PBR plaster look. | — | — | — | MIT | **Reject**. |
| Loader | Supports GLTF, FBX and raw `.drc` through `DRACOLoader('draco/')` with the JS decoder, releasing the decoder module after use. | `src/javascript/Utils/Loader.js` | Superseded by the 2025 pipeline. | — | — | — | MIT | **Reject**. |

### 2.3 AT010303_Room_Portfolio

| Feature/mechanism | How it works | Source files | Benefit for Mumbai | Compatibility | Cx | Perf | Lic | Decision |
|---|---|---|---|---|---|---|---|---|
| Camera states into objects | A zustand store holds `cameraState` (default, desktop, laptop, tv, smartphone, displayBoard). An effect with **no dependency array, so it runs every render**, sets per-state constraints (min and max distance, polar and azimuth clamps, `truckSpeed`) and calls drei `CameraControls.setLookAt(..., true)` with `smoothTime 0.8`. | `src/CameraManager/CameraManager.jsx`, `src/helper/CameraStore.jsx` | Shows the "named pose plus constraints" idea for kiosk views, such as a Fort research terminal close-up. | Orbit controls do not apply to first-person. Bruno's cinematic blend is the better fit. | S | None | No licence | **Reject** the code. The idea is covered by the Bruno adaptation. |
| Return from object | Clicking the room furniture mesh while not in default state calls `default()`; HTML iframes unmount when the state changes. | `src/RoomModel/roomModel.jsx`, `src/RoomModel/iframes/smartphoneiFrame.jsx` | Mumbai already returns via Escape and the close button with the pointer released. | — | — | — | No licence | **Reject**. |
| Hover highlight | `@react-three/postprocessing` `Selection` with `<Select enabled={hovered}>` around each clickable object, plus an `Outline` pass (edgeStrength 60, blur) and Bloom. `meshBounds` raycast on the switch. Cursor changes to pointer. | `src/Experience.jsx`, `src/RoomModel/dispItem.jsx`, `src/Switch/TheamSwitch.jsx` | Hover affordance for interactables. | Mumbai has `postprocessing` 6.39.5, but an outline pass adds a full-screen pass plus an extra depth/mask render. A cheaper option is an emissive bump on the targeted mesh or a ground ring. | S | Med (OutlineEffect extra passes) | No licence | **Reject** the outline. Use an emissive or reticle cue instead. |
| Baked day/night plus RGB lightmap | `TextureMaterial`: `mix(dayBaked, nightBaked, NightMix)`, then three `blendLighten` passes with lightmap R, G and B as masks for board, desk and PC light colours and strengths (uniforms). gsap tweens `NightMix` over 1 s. Textures are WebP with `generateMipmaps=false` and `minFilter=Nearest`. | `src/RoomModel/textures/TextureMaterial.jsx`, `src/RoomModel/shaders/Room/fragment.glsl`, `src/RoomModel/roomModel.jsx` | The idea of **one mask texture whose channels drive tintable light colours**, for shop glow, signage and streetlamp pools, without extra real lights. | Mumbai geometry is procedural with no unwrapped bakes, so apply it as a vertex attribute or atlas channel mask inside the existing `StreetAtmosphere` `onBeforeCompile` patch. | M | Very low (a texture or attribute read) | No licence (re-implement) | **Adapt** the concept, implemented from scratch. |
| HTML iframes on screens | drei `Html transform occlude="blending"` embedding external sites and an emulator ROM. | `src/RoomModel/iframes/*.jsx` | Security and performance risk. Mumbai uses accessible overlays. | — | — | High | No licence; ROM infringing | **Reject**. |
| Asset compression | GLBs are Draco (`extensionsUsed: KHR_draco_mesh_compression` in `public/assets/RoomModel.glb`); textures are WebP. | `public/assets/` | Covered by the Bruno 2025 pipeline. | — | — | — | No licence | **Reject**. |

### 2.4 GlintonLiao_questopia

| Feature/mechanism | How it works | Source files | Benefit for Mumbai | Compatibility | Cx | Perf | Lic | Decision |
|---|---|---|---|---|---|---|---|---|
| Intro camera and loading stage | `IntroStage` runs loading, then ready (an Enter button after drei `useProgress` hits 100 plus 600 ms), then entering, then done. `CameraRig` interpolates the spherical pose and target from a wide start to the default pose with `easeOutCubic` over 2.8 s, syncing the smoothed values to avoid a jump and discarding input. Control hints are hidden until done. | `src/App.tsx`, `src/components/CameraRig.tsx`, `src/components/LoadingScreen.tsx`, `src/components/Experience.tsx` | Mumbai's `EntryTransition` already exists. The useful bits are "sync smoothed state at handover" and "hints appear only after the intro". | Trivial. | S | None | MIT | **Adopt** only the hint-timing rule (§3). |
| Camera smoothing | `value += (target - value) * k * deltaMs` with clamped deltaMs ≤ 100: linear in dt, so not frame-rate independent at large dt. | `src/components/CameraRig.tsx` | Mumbai's `1 - exp(-k*dt)` blend is already correct. | — | — | — | MIT | **Reject**. |
| Click vs drag raycast | Capture-phase pointerdown and pointerup on the canvas. If movement is ≤ 6 px, raycast against meshes collected by **name** (`Cube349`, …) and open the overlay. Debug state goes to `window.__questopiaLastHit` for tests. | `src/components/InteractionRaycaster.tsx` | The drag threshold for Mumbai's drag-to-look mode, where a tap should interact and a drag should look. The `__lastHit` test hook resembles Mumbai's `dataset` hooks. | Easy. Avoid name-based target collection and `scene.traverse` per click; use Mumbai's interaction list. | S | None | MIT | **Adopt** the threshold only. |
| Baked shader | The same day/night plus RGB-lightmap structure as the Room portfolio (`uLightScreen/Lamp/Shelf`). The `ShaderMaterial` is rebuilt whenever leva values change, because `useMemo` depends on them, which recompiles the program. | `src/shaders/baked/fragment.glsl`, `src/components/Room.tsx` | Same concept as §2.3. As an anti-pattern lesson, tweak uniforms rather than rebuilding materials. | — | — | — | MIT | **Reject** (duplicate). |
| HTML hover labels | drei `Html center` labels at fixed world positions. | `src/components/HoverLabels.tsx` | Mumbai's HTML prompt already covers this. | — | — | — | MIT | **Reject**. |
| Overlay a11y | The overlay has social-link `aria-label`s but no Escape or focus handling (`src/components/Overlay.tsx`). | `src/components/Overlay.tsx` | Mumbai's `Modal` and native dialog are already ahead. | — | — | — | MIT | **Reject**. |
| Assets | GLBs are uncompressed. Basis and Draco decoders are vendored in `public/` but unused by `src/`. | `public/assets/`, `public/basis/`, `public/draco/` | Shows the "decoders same-origin under `public/`" layout, relevant to the `GLBAssetLibrary` no-remote rule. | — | — | — | MIT | **Reject** the assets. Keep the layout idea in mind. |

### 2.5 dokson_interactive-resume (Robby Leonardi–style)

| Feature/mechanism | How it works | Source files | Benefit for Mumbai | Compatibility | Cx | Perf | Lic | Decision |
|---|---|---|---|---|---|---|---|---|
| Career progression as levels | Horizontal scroll moves layered parallax. "LEVEL 1 / IT'S-A ME" gates, then about-me plants and buildings, then **experience "bosses"** (robot, squid, alien), each with a pie chart of skills mix, then a sea world for skills (fish, crab and turtle species), then a rocket and contact. Each job is a chain-block "boss" that lands when entered. | `index.html` (gates, `experience-*-container`), `src/js/state.js` (`bosses`, `seaAnimalSpecies`, `scenes`) | A narrative order for the nine districts: arrival at CST, research at Fort, internship at BKC, skills at Andheri, projects at Powai, timeline at Dadar, proof at Worli, contact at Juhu. Mirror "levels" with a visible stamp and progress count. | Concept only. | M | None | **No reuse rights** | **Adapt** the concept only, written from scratch. |
| Scene lifecycle | Each scene is `{world, container, reset, layout, resize?, enter}`. `triggerEnteredScenes()` fires `enter()` once when the viewport centre crosses into a container's span from outside. Returning to the start calls `resetScenes()`. | `src/js/animation.js` (`resetScenes`, `layoutScenes`, `triggerEnteredScenes`), `src/js/state.js` (`scenes`) | A clean contract for per-district "first arrival" moments (enter once, reset on R or return-to-CST) that matches Mumbai's streamed `District` objects. | Pure TS interface. | S | None | No reuse rights | **Adapt** the idea (own code). |
| Central frozen config plus behaviour tests | `deepFreeze(gameConfig)` holds every timing and distance. Playwright tests assert the config is frozen, every scene is bound to an existing container, a scene enters once and resets, and the progress bar tracks position. | `src/js/config.js`, `tests/game.spec.js`, `AGENTS.md` | Mumbai already has `STREET_MOOD` and Playwright. Add a frozen `PROGRESS_RULES` and tests that each district has exactly one arrival trigger and progress survives reload. | Fits `vitest` plus `playwright`. | S | None | No reuse rights | **Adapt**. |
| Scroll progress bar (a11y) | `scaleX` transform (no layout) plus `aria-valuenow` on a track. | `src/js/layers.js` (`updateScrollProgress`) | An accessible "districts visited n/9" meter in `CityExperience`. | React. | S | None | No reuse rights | **Adapt** (trivial). |
| rAF interval | `setRafInterval` pauses in background tabs and syncs to display. | `src/js/animation.js` | Mumbai already stops on `document.hidden`. | — | — | — | No reuse rights | **Reject**. |
| Reduced-motion hint flashing | The scroll hint is skipped under `prefers-reduced-motion`. | `src/js/animation.js` | Mumbai already honours reduced motion. | — | — | — | No reuse rights | **Reject**. |
| Preloader "RUN" gate | The C64 tape-loading sequence waits for click, key or tap. | `src/js/preloader.js` (`waitPreloaderStart`) | Unlocks audio on a gesture, but Mumbai sound is opt-in already. | — | — | — | Font restricted | **Reject**. |

---

## 3. What to take, ranked

Each item names the verified target location in this repository. All of them are clean-room ports or MIT-licensed code with a notice. None imports reference assets.

1. **Throttled, suspendable proximity test.** From Bruno 2025 `InteractivePoints.update`/`temporaryHide`.
   - Re-run `updateNear()` only when the visitor moves more than 0.2 m, yaw changes by more than about 3°, or a `needsTest` flag is set (district swap, ride end, overlay close).
   - Hoist the per-call `new THREE.Vector3` allocations.
   - Hide prompts while riding or paused.
   - Location: `src/core/WorldEngine.ts` (`updateNear`, called in `frame`). Size S. This is a pure CPU saving, because each candidate costs a BVH ray every frame today.

2. **Typed input action map with contexts.** From Bruno 2025 `Inputs/Inputs.js` and `Keyboard.js`.
   - Map `event.code` (`KeyW`, …) as well as `event.key`, so WASD works on AZERTY.
   - Define named actions: forward, back, left, right, sprint, interact, reset, menu, close.
   - Define contexts: walk, ride, overlay.
   - Touch buttons feed the same actions.
   - Locations: new module beside `src/core/WorldEngine.ts` (for example `src/core/InputActions.ts`), replacing the key list in `WorldEngine.keyDown`/`frame`. `setMove()` stays as the touch entry point. Size M.

3. **Explicit update phases in the frame.** From Bruno 2025 `readme.md` §Game loop and `Ticker`/`Events`.
   - Order: input, pre-physics (velocity blend), fixed-step physics (keep the accumulator), post-physics (gait, stuck test), zones and progress, interaction, camera, audio, quality sampling, render, HUD and debug.
   - Use named private methods; no event bus.
   - Location: `src/core/WorldEngine.ts` `frame`. Size M. Do not copy Bruno's variable `world.timestep`.

4. **Zone enter/leave events plus a persisted progress store.** From Bruno 2025 `Zones.js` and `Achievements.js`, plus the 2019 `Zones.js`.
   - Edge-triggered `enter`/`leave` for districts (already indexed by `zoneIndexAt`) and for sub-areas such as the Fort room or station hall.
   - A `Set`-based progress map: `districts`, `projectsOpened`, `rides`, `fareTotal`.
   - JSON in `localStorage` with try/catch, following the `hj-motion` pattern in `src/app/App.tsx`.
   - Locations:
     - `src/core/WorldEngine.ts` `syncZone()` emits through a new `onZone` option.
     - `src/game/World/streetLayout.ts` (`cityZones`) supplies ids.
     - Store state in `src/app/App.tsx`.
     - Render "n/9 visited" ticks in the directory (`src/ui/CityExperience.tsx` `CityMap`).
   - Size M. Avoid the name `achievements`, which `src/data/experience.ts` already uses.

5. **Accessible toast queue for arrival and progress stamps.** From Bruno 2025 `Notifications.js`.
   - Queue one toast at a time, dedupe by id, use `aria-live="polite"`, and give it a static style under reduced motion.
   - Location: `src/ui/CityExperience.tsx` (rendered from `src/app/App.tsx` next to the existing `proximity-prompt`). Size S.

6. **Stuck detection, then a "Press R to return" hint.** From Bruno 2025 `PhysicsVehicle.setStuck` and `Player.setUnstuck`.
   - Over a 3 s window, if movement input is held and the visitor has moved less than 0.5 m, emit a hint.
   - Location: the walking branch of `src/core/WorldEngine.ts` `frame`, which already resets on `position.y < -2`, surfaced via `src/app/App.tsx`. Size S.

7. **Non-nagging onboarding hints.** From 2019 `ThreejsJourney.js` (distance-gated with a `seenCount` backoff) and Questopia (hints only after the intro).
   - Show a WASD/mouse hint until the first 3 m walked.
   - Show the "E to talk" hint only once a target has been near for at least 2 s without interaction.
   - Show the hail hint at the first taxi stand.
   - Persist dismissals with try/catch.
   - Location: `src/app/App.tsx` (state, plus the `near`/`speed` callbacks it already receives), with markup in `src/ui/CityExperience.tsx`. Size S.

8. **Click/tap-vs-drag threshold and analytic interaction proxies.** From Bruno 2025 `RayCursor.js` (25 px, Sphere/Box3) and Questopia `InteractionRaycaster.tsx` (6 px).
   - In drag-to-look and phone mode, a short tap on a highlighted target interacts and a drag looks.
   - Give each interaction target a `Box3`/`Sphere` for cheap ray tests before the BVH visibility check.
   - Locations: `src/core/WorldEngine.ts` (`pointerDown`, `pointerUp`, `updateNear`) and `src/game/World/spatial/SpatialIndex.ts` (`visible`). Size S.

9. **Asset compression pipeline with self-hosted decoders.** From Bruno 2025 `scripts/compress.js` and `ResourcesLoader.js`.
   - Offline `gltf-transform` with meshopt (or Draco), plus KTX2 (ETC1S for albedo, UASTC for normal and mask maps) on Rocketbox and vehicle GLBs.
   - Decoders come from `node_modules/three/examples/jsm/libs/` (`meshopt_decoder.module.js`, `basis/`, both present) and are copied to same-origin `public/`.
   - Extend the extension allow-list in `src/game/World/assets/GLBAssetLibrary.ts` to only `EXT_meshopt_compression` and `KHR_texture_basisu`, still rejecting remote decoders.
   - Add the script under `scripts/` next to `scripts/import-character.mjs`, and document it in `docs/GLB_ASSET_PIPELINE.md`.
   - Size M. Measure before and after with `scripts/profile-street.mjs`.

10. **Sound variation and anti-spam.** From 2019 `World/Sounds.js` and Bruno 2025 `Audio.js`.
    - Random-next variant selection, minimum interval, rate jitter, velocity-squared volume.
    - Engine loop with asymmetric up/down easing for the taxi versus the auto.
    - Stays synthesised and original.
    - Location: `src/core/StreetAudio.ts` (`update`, footstep scheduling). Size S.

11. **Career timeline district logic (when Dadar is built).** From Bruno 2025 `CareerArea.js` (position along the path drives a year counter, and entries rise as you pass) and the dokson scene lifecycle (`enter` once, `reset` on return).
    - Data comes from `src/data/experience.ts`.
    - Location: a new district spec under `src/game/World/districts/` following `District.ts`/`CityDistricts.ts`.
    - Size L. Gated by the README rule that other districts wait for street sign-off.

12. **Optional lean-in camera blend into terminals and shopfronts, with exact return.** From Bruno 2025 `View.setCinematic`.
    - A progress scalar from 0 to 1 over about 0.8 s.
    - Lerp position and slerp orientation toward a look target without moving the physics body.
    - Restore the saved yaw and pitch on overlay close.
    - Disabled under reduced motion and on mobile.
    - Location: `src/core/WorldEngine.ts` (`updateCamera`, `focusLandmark` is currently a deliberate no-op).
    - Size S. Adopt only if the product owner relaxes the "overlay never moves the viewpoint" rule.

**Explicitly not taken:**

- A Rapier migration. Rides are kinematic; cannon-es `RaycastVehicle` covers any future drivable mode, as shown by 2019 `World/Physics.js`; Bruno's own step is variable.
- WebGPU/TSL materials, which do not port to the GLSL `WebGLRenderer` pipeline.
- The wall-clock day cycle and weather, which conflict with the fixed `STREET_MOOD`.
- Bruno's binary `Quality`, which is weaker than `AdaptiveQuality`.
- The outline postprocess hover.
- HTML iframes in the world.
- Any model, texture, SFX or font from the references. Only Bruno's Kounine music is CC0, and it does not match Mumbai's soundscape.
