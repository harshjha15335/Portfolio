# Gameplay mechanics

How a visitor plays the portfolio, and where each mechanic lives in the code. Everything here is optional: no mechanic gates portfolio content, and the case studies, district guides and the WebGL-off city directory show everything without playing.

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

The station host and the fellow contributor offer **Take the guided tour** in their dialogue. Each step carries the visitor to a framing pose with a short eased move (instant under reduced motion; any walk key or mouse look cancels it), explains one exhibit, and can open it. Back, Next and the close button work at every step. The last step suggests the next district and sets a waypoint to it. Tours are also in the command palette.

## Fort Open Source Hall exhibits

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
| Finite Differences | Solving the gradient check (opening the kiosk is not enough) |
| Systems Thinker | A clean, fastest run on the BKC rate-limit console |
| Skill Collector | Visiting three Andheri skill shops |
| Builder | Opening any Powai flagship project or the ASTFLOW lab |
| Time Traveler | Reading all six Dadar platforms |
| Receipts Checked | Naming the evidence behind all four Worli claims |
| Said Hello | Using the Juhu contact terminal |
| Kaali-Peeli Regular | Finishing a metered ride |
| Film Buff | Reaching the last scene at Film City Talkies |
| City Explorer | Standing in all nine districts |

The **Discover the Engineer** quest (Fort research → BKC → a Powai project → Andheri → Juhu) ends with a short summary in the journal. It restricts nothing.

Activities record `<exhibit>:solved` separately from opening the exhibit, so an achievement for an activity needs the activity finished.

## District exhibits (BKC, Andheri, Powai, Dadar, Worli, Juhu, Film City)

`src/data/districtExhibits.ts` (what and where), `src/game/World/districts/exhibits.ts` (the boards), `src/ui/DistrictExhibits.tsx` (the panels).

Every district beyond CST–Fort has free-standing boards facing the road: two posts, a framed board painted with its title, and a low solid base so the board stays visible from the reading spot. A district's boards paint into their own 1024² atlas and merge into one draw. The boards count as obstacles for the pavement crowds. `tests/district-exhibits.test.ts` builds every district and checks that each reading spot is open ground, sees its board and stays clear of the standing people and street lights.

| District | Boards | Activity |
|---|---|---|
| BKC | Internship brief, request path, rate-limit console | **Rate-limit console** (`src/game/activities/rateLimit.ts`): a token bucket (burst 5, refill 2/s). Choose 1, 2, 4 or 8 requests a second and whether to back off for the Retry-After second, then ingest 40 pages. Solved by a run with no 429s that is as fast as the best clean run, which is sending at the refill rate. A teaching model, labelled as such, not the internship's code |
| Andheri | One kiosk per skill shop | Opens that shop |
| Powai | One board per project, plus ASTFLOW | Opens the project's demo or case study |
| Dadar | Six platform boards | Step along the journey; read all six |
| Worli | Four evidence cases | Say whether the claim is a public record or résumé reported, then open the source |
| Juhu | Notice board, résumé stand, contact terminal | Contact terminal opens the contact card |
| Film City | Box office, scene board | Seat at the start, or start at any scene |

Each district's guided tour is generated from its boards (`src/data/tours.ts`): the guide's greeting, one framed step per board, then a suggestion for the next district.

## Film City theatre controls

Previous, Next, Autoplay/Pause, Restart, **Skip to the end** (the contact scene), **Exit theatre**, and the scene picker. Keyboard inside the theatre: ← →, Space, Home, End; Esc closes.

## Talkies hall

The hall is houseful except row E, seat 7. Press E at that seat to sit facing the screen (seated eye height, looking still works); E again or any walking key stands you up. Every screening of the film ends with the audience rising and clapping for eight seconds, with applause when sound is on. See [TALKIES_FILM.md](TALKIES_FILM.md).

## Taxi and auto

Unchanged in this pass (see `docs/TRAFFIC_SYSTEM.md` and the README): hail at a stand or from the HUD, choose a stop, watch the meter, skip or get out at any time. A finished ride now counts towards the journal.
