# District implementation matrix

State of each of the nine canonical districts after the second gameplay pass (2026-10-15), which brought exhibits, activities and tours to the seven districts beyond CST–Fort. "Walkable" means a street you can stand in, built by `CityDistricts` or `MumbaiStreet`. Ratings are judgements from screenshots and running the flows, not scores.

| District | Purpose | Visual | Gameplay mechanic | Interactions | Content | Tests |
|---|---|---|---|---|---|---|
| CST Arrival Terminus | Landing, orientation, navigation | Strongest street in the city: heritage station front, Radio House benchmark façade, scanned surfaces, golden-hour light, Rocketbox crowd, modelled traffic | Orientation checklist, departure board → waypoint / ride / jump, guided tour, taxi and auto stands | Station host, departure board, two stands | Intro, nine destinations | `gameplay.spec.ts`, `city.spec.ts`, `street.test.ts` |
| Fort Open Source Hall | GSoC 2026, Theochem, FFprime | Furnished research room: pendants, rug, chairs, banker's lamps, monitors with live content, cork contribution board, kiosk. Still primitive-built furniture | Gradient-check activity; guided tour | Fellow, 3 panels, field table, coordinate workstation, FFprime terminal, contribution board, kiosk | Field map, chapters, Stone-convention workstation, five merged PRs, case study | `gameplay.spec.ts`, `gameplay.test.ts`, `stone.test.ts`, `research-timing.test.ts`, `art-production.spec.ts` |
| BKC Systems Office | CCIEeXpert internship | Walkable boulevard and plaza (PR #4); three exhibit boards on the plaza | **Rate-limit console**: choose a send rate and back-off, ingest 40 pages with no 429s (teaching model) | Guide, internship brief, request path, rate-limit console | Experience text, highlights, résumé source | `district-gameplay.spec.ts`, `gameplay.test.ts`, `district-exhibits.test.ts` |
| Andheri Tech Bazaar | Skills with evidence | Walkable lane with stalls; five shop kiosks | Five skill shops running real logic (PR #8); three shops earn Skill Collector | Guide, five shop kiosks (each opens its shop) | Verified skills with project links | `andheri.test.ts`, `district-exhibits.test.ts` |
| Powai Builder's District | Flagship projects | Lakeside towers; a board in front of each workplace | Working demo labs for five projects plus the ASTFLOW lab (PRs #6, #10, #11); RECO has a case study only | Guide, six project boards (open the project), ASTFLOW board | NORTHSTAR, MoneyMetrics, Meeting Intelligence, RideFlow, RepoLens, ASTFLOW, RECO | `flagship.test.ts`, `astflow.test.ts`, `district-gameplay.spec.ts` |
| Dadar Junction | Education and timeline | Station, chawl, maidan; six platform boards | **Walk the route**: six platform boards, read all six for Time Traveler | Guide, six platforms with previous/next | Six sourced journey stops | `district-gameplay.spec.ts`, `gameplay.test.ts` |
| Worli Proof Deck | Achievements | Sea face and promenade; four evidence cases. Flat placeholder water and skyline boxes noted in the 10-14 audit | **Check the receipts**: say whether each claim is a public record or résumé reported | Guide, four evidence cases | Four achievements with sources | `district-gameplay.spec.ts`, `gameplay.test.ts` |
| Juhu Studio | About, résumé, contact | Beach and stalls; three boards in front of the studio | Contact terminal earns Said Hello | Guide, notice board, résumé stand, contact terminal | Bio, résumé, GitHub, LinkedIn, contact | `district-exhibits.test.ts` |
| Film City Talkies | Cinematic story | Studio lot and shoot set; box office and scene board by the Talkies. The cinema is still an HTML theatre, not a walk-in auditorium | Nine-scene theatre with full controls; start at any scene | Guide, box office, scene board | Nine scenes from verified material | `district-gameplay.spec.ts`, `gameplay.spec.ts` |

## Portfolio-wide systems

| System | State |
|---|---|
| Journal, achievements, quest | Built (`src/game/progress.ts`), persisted locally |
| Gaze targeting and hover marker | Built for every district (districts reuse the same `pickTarget`) |
| Guided tours | All nine districts. Beyond CST–Fort each tour is built from that district's boards |
| Waypoints | Built; same-street arrow, ride offer across districts |
| Map | Existing directory; does not yet draw the waypoint or quest |
| Optional driving mode | Not built. Reference study recommends cannon-es `RaycastVehicle` if it is ever wanted |
| Vehicles stopping at signals | Not built |

## Next

1. Interiors: a BKC office floor and a Juhu studio room, like the Fort room.
2. Film City: a walk-in auditorium that hosts the existing theatre.
3. Worli: replace the placeholder water and skyline.
4. Map: draw the waypoint and quest progress.
