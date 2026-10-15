# District implementation matrix

State of each of the nine canonical districts after the CST–Fort gameplay pass (2026-10-15). "Walkable" means a street you can stand in, built by `CityDistricts` or `MumbaiStreet`. Ratings are judgements from screenshots and running the flows, not scores.

| District | Purpose | Visual | Gameplay mechanic | Interactions | Content | Tests |
|---|---|---|---|---|---|---|
| CST Arrival Terminus | Landing, orientation, navigation | Strongest street in the city: heritage station front, Radio House benchmark façade, scanned surfaces, golden-hour light, Rocketbox crowd, modelled traffic | Orientation checklist, departure board → waypoint / ride / jump, guided tour, taxi and auto stands | Station host, departure board, two stands | Intro, nine destinations | `gameplay.spec.ts`, `city.spec.ts`, `street.test.ts` |
| Fort Research Institute | GSoC 2026, Theochem, FFprime | Furnished research room: pendants, rug, chairs, banker's lamps, monitors with live content, cork contribution board, kiosk. Still primitive-built furniture | Gradient-check activity; guided tour | Fellow, 3 panels, field table, coordinate workstation, FFprime terminal, contribution board, kiosk | Field map, chapters, Stone-convention workstation, five merged PRs, case study | `gameplay.spec.ts`, `gameplay.test.ts`, `stone.test.ts`, `research-timing.test.ts`, `art-production.spec.ts` |
| BKC Systems Office | CCIEeXpert internship | Walkable boulevard and plaza (PR #4) | **None yet** | Guide modal only | Experience text, highlights, one route strip | `districts.test.ts` (build) |
| Andheri Tech Bazaar | Skills with evidence | Walkable lane with stalls | Five skill shops running real logic (PR #8) | Guide → shops | Verified skills with project links | `andheri.test.ts` |
| Powai Builder's District | Flagship projects | Lakeside towers | Working demo labs for five projects plus the ASTFLOW lab (PRs #6, #10, #11); RECO has a case study only | Guide → labs and case studies | NORTHSTAR, MoneyMetrics, Meeting Intelligence, RideFlow, RepoLens, ASTFLOW, RECO | `flagship.test.ts`, `astflow.test.ts` |
| Dadar Junction | Education and timeline | Station, chawl, maidan | **None yet** (platform list in the modal) | Guide modal only | Six sourced journey stops | `districts.test.ts` |
| Worli Proof Deck | Achievements | Sea face and promenade; flat placeholder water and skyline boxes noted in the 10-14 audit | **None yet** | Guide modal only | Four achievements with sources, metrics | `districts.test.ts` |
| Juhu Studio | About, résumé, contact | Beach and stalls | **None yet** | Guide modal only | Bio, résumé, GitHub, LinkedIn, contact | `districts.test.ts` |
| Film City Talkies | Cinematic story | Studio lot and shoot set; the cinema is an HTML theatre, not a walk-in auditorium | Nine-scene theatre with full controls | Guide → theatre | Nine scenes from verified material | `gameplay.spec.ts`, `city.spec.ts` |

## Portfolio-wide systems

| System | State |
|---|---|
| Journal, achievements, quest | Built (`src/game/progress.ts`), persisted locally |
| Gaze targeting and hover marker | Built for every district (districts reuse the same `pickTarget`) |
| Guided tours | CST and Fort. Other guides still open their modal |
| Waypoints | Built; same-street arrow, ride offer across districts |
| Map | Existing directory; does not yet draw the waypoint or quest |
| Optional driving mode | Not built. Reference study recommends cannon-es `RaycastVehicle` if it is ever wanted |
| Vehicles stopping at signals | Not built |

## Next, in the brief's order

1. BKC: a systems-flow activity built from the internship's real sequence (policy analysis → OAuth2 → rate-limited ingestion), and an office interior.
2. Dadar: walkable platforms per milestone instead of a list.
3. Worli: exhibit cases with evidence panels; replace placeholder water and skyline.
4. Juhu: a studio interior with the desk, bookshelf and contact terminal.
5. Film City: a walk-in auditorium that hosts the existing theatre.
6. Map: draw the waypoint and quest progress.
