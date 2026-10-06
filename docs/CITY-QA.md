# First-person Mumbai vertical slice

## Scope gate

The uploaded reel is the primary visual reference. This checkpoint replaces the third-person world with **one authored CST/Fort street**. Do not generate the other districts before reviewing the street captures for scale, density, lighting and local character.

Implemented in the slice: 14 façades, plaster variation, balconies/grilles, AC units, rooftop tanks, laundry, bilingual shop signs, awnings/shutters, lamps/cables, cups/crates/plants, drains/crossing/puddle, parked scooters, pedestrians, ambient taxis/autos, two guides, an open research room, first-person walking, mobile controls, pickup, passenger perspectives and a running decorative meter.

The seven other districts remain HTML directory experiences. The existing Film City slideshow is retained, not yet a physical auditorium. No whole-city expansion, audio, sophisticated pedestrian AI, animated doors or real transport fares are claimed.

## Checks

- TypeScript and production build pass.
- 43 unit tests pass, including camera-relative movement/diagonal normalization, human interaction heights, stop/spawn collision clearance, the open research doorway, a full-height visitor walking through it, and full-width road-route clearance.
- All 32 Chromium browser tests passed in the full post-optimization run (4.5 minutes on SwiftShader). The subsequent code split keeping physics out of Quick View passed its focused browser check; all 43 unit tests and the build passed again.
- Coverage includes keyboard/touch walking, eye height, drag-look when pointer lock is denied, overlay pause/reset, the physical research terminal, both passenger ride types, natural/skipped/reduced arrival, all HTML guides, source content, case studies, routing, focus, phones, missing résumé and WebGL/context-loss fallback.
- Earlier diorama results (38 unit / 29 browser tests) do not establish this new controller's behavior.

## Visual review

Reference frames were extracted from the supplied recording for inspection only. No creator textures, geometry, code or logos are used. Review desktop street, Fort interior and both passenger views, plus the phone controls and dark arrival page.

Final screenshots are retained in `docs/screenshots/first-person/`; raw capture output is under ignored `.sites-runtime/first-person/`. The reviewed street screenshots show architecture enclosing the human-height camera, readable warm shopfronts, above-eye balconies and cables, local signs and passing people/transport. The previous title card and destination rail have been removed from the street view.

A representative desktop capture reported 49 draw calls, 52,144 triangles and three textures at eye height 1.64m; the research-room capture reported 10 draws. SwiftShader rendered roughly 2–3 FPS in these captures. This is a software-rendering result, not evidence of stable real-device frame rate. Verify hardware GPU performance before expanding the map.

## Practical limits

Cached static shadows improve cost but do not animate with people/traffic. Ambient traffic is decorative; path spacing and a shared stop cycle avoid pileups. Interactive pickups do not reserve lanes against ambient cars. Taxi/auto models are intentionally simplified originals with fixed cabin geometry. Mouse drag and keyboard turning remain usable if pointer lock is blocked. Only the currently authored CST/Fort stops accept ride destinations.

Cloud Chromium uses SwiftShader. Its FPS is not a hardware GPU benchmark. Real phones, Safari/Firefox and assistive technology still require hands-on checks. WebGL failure retains the portfolio and guides.
