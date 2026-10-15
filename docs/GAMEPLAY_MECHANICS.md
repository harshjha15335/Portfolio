# Gameplay mechanics

How a visitor plays the portfolio, and where each mechanic lives in the code. Everything here is optional: no mechanic gates portfolio content, and Quick View and the WebGL-off pages show everything without playing.

## Controls

| Input | Action |
|---|---|
| W A S D / arrows | Walk (Shift for a brisk walk) |
| Mouse (click for pointer lock) or drag | Look |
| Comma / period | Turn with the keyboard |
| E or click the prompt | Interact with what you are looking at |
| M | City map and directory |
| J | Exploration journal |
| R | Return to CST |
| Esc | Release the pointer, close an overlay, or open the world menu |
| Ctrl/Cmd + K | Command palette (projects, skills, guided tours, journal) |
| Phone | Drag to look, hold the arrow buttons to walk, tap the prompt |

## Interaction targeting

`src/game/World/interactionTargeting.ts` → `pickTarget`.

1. Candidates must be within reach (3.8 m by default; the hanging departure board uses 4.6 m).
2. Beyond 1.5 m a target must be roughly in front horizontally (the original 66° rule), so nothing behind you prompts.
3. Among those, the one with the smallest 3D angle from the camera's forward vector wins, plus 0.06 rad per metre so the nearer of two aligned targets wins.
4. A line-of-sight ray (`SpatialIndex.visible`) must reach it.

`WorldEngine.updateNearIfMoved` re-runs this only after 5 cm of movement or a turn, after Bruno Simon's `InteractivePoints`. A small gold chevron (one draw, the shared glow material, no new program) hovers over the current target, and the prompt shows the target's own label.

## Orientation

First visit only, and skippable with **Skip intro / Explore city**. Five steps tick themselves off as you do them: look around, walk 4 m, talk to or inspect something, open the map, hail a ride. Dismissal is saved.

## CST departure board

A two-sided station indicator hung over the pavement 6 m in front of the spawn point (`MumbaiStreet.departureBoard`, painted into the shared sign atlas). Pressing E opens `DepartureBoard` (`src/ui/Exhibits.tsx`): eight departures, one per kind of evidence, each bound for its district (`src/data/departures.ts`). Choosing one lets you:

- **Mark on my map**: sets a waypoint. A compass card at the top of the screen shows the direction and distance on the same street, or offers a ride when the stop is in another district. It clears itself within 5 m of the stop.
- **Take a taxi / auto**: starts a metered ride straight to that district.
- **Jump there**: fast travel.

## Guided tours

`src/data/tours.ts`, `TourCard` in `src/ui/GameHud.tsx`, `WorldEngine.frameView`.

The station host and the research fellow offer **Take the guided tour** in their dialogue. Each step carries the visitor to a framing pose with a short eased move (instant under reduced motion; any walk key or mouse look cancels it), explains one exhibit, and can open it. Back, Next and the close button work at every step. The last step suggests the next district and sets a waypoint to it. Tours are also in the command palette.

## Fort Research Institute exhibits

The research room is now a set of separate physical exhibits, each opening only its part of the exhibition (`ExhibitPanel`):

| Exhibit | Where | Opens |
|---|---|---|
| Three wall panels | Back wall | The field map with that panel's chapter (moments, conventions, validation) |
| Field table | Left table | The interactive potential and field map |
| Coordinate workstation | Left monitor; its screen shows the quadrupole's angular pattern computed with the Stone-convention formula | `CoordinateWorkstation`, the Cartesian ↔ spherical conversions from FFprime |
| FFprime terminal | Right monitor | The FFprime case study |
| Contribution board | Left wall, cork board with the five PR cards strung in merge order | The five merged pull requests with links, dates and commits, and the final report |
| Gradient-check kiosk | By the door | The research activity below |

### Research activity: the gradient check

`src/research/gradientCheck.ts`, `GradientCheck` in `src/ui/Exhibits.tsx`.

The potential of a symmetric quadrupole is V = rᵀQr / r⁵ and the field is E = −∇V. Three candidate implementations are shown: one missing the factor of two on the Qr term, one with the wrong coefficient on the r⁻⁷ term, and the correct one. The visitor runs each against central finite differences of V at eight fixed points (h = 10⁻⁴) in the browser, sees PASS or FAIL with the maximum relative error, and picks the one to merge. A wrong pick explains why and allows another try. The correct implementation agrees to about 10⁻⁸; the others are off by 65 % and 80 %. This mirrors the factor-of-two correction and finite-difference checks the exhibition already attributes to the FFprime contribution; it is a teaching tensor, not molecular data. Unit tests check that only the correct formula passes.

## Journal, achievements and quest

`src/game/progress.ts` (pure, unit-tested) and `Journal` / `AchievementToasts` in `src/ui/GameHud.tsx`.

- Saved in `localStorage` under `hj-progress-v1`. Storage failures are ignored and damaged data is filtered. Reset from the journal.
- **Visits**: the district you are standing in (Fort counts once you are past z = −24 on the CST street).
- **Discoveries**: anything opened (guides, exhibits, projects, the departure board, the theatre's final scene).

| Achievement | Earned by |
|---|---|
| First Steps | Talking to the station host or reading the departure board |
| Research Explorer | Opening the Fort contribution board |
| Finite Differences | Solving the gradient check |
| Systems Thinker | Hearing the BKC systems engineer out |
| Skill Collector | Opening the Andheri Tech Bazaar |
| Builder | Opening any Powai flagship project or the ASTFLOW lab |
| Time Traveler | Opening the Dadar journey |
| Kaali-Peeli Regular | Finishing a metered ride |
| Film Buff | Reaching the last scene at Film City Talkies |
| City Explorer | Standing in all nine districts |

The **Discover the Engineer** quest (Fort research → BKC → a Powai project → Andheri → Juhu) ends with a short summary in the journal. It restricts nothing.

The BKC, Andheri and Dadar achievements currently fire on opening the district's guide, because those districts do not yet have their own mechanic. They should move to the district activities when those are built.

## Film City theatre controls

Previous, Next, Autoplay/Pause, Restart, **Skip to the end** (the contact scene), **Exit theatre**, and the scene picker. Keyboard inside the theatre: ← →, Space, Home, End; Esc closes.

## Taxi and auto

Unchanged in this pass (see `docs/TRAFFIC_SYSTEM.md` and the README): hail at a stand or from the HUD, choose a stop, watch the meter, skip or get out at any time. A finished ride now counts towards the journal.
