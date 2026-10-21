# Final world acceptance report: Mumbai After Hours

This report checks Harsh's After Hours brief (20 October 2026) against what shipped in PRs #21, #22 and #25 and in the brake-lamps PR. Statuses are PASS, PARTIAL, FAIL, BLOCKED or NOT TESTED. Each row names its evidence: a test, a measurement, a screenshot taken from the running game, or the word "inferred". Details are in the audits linked from each section.

Screenshots were taken from the running game with software rendering and are on these pages:
- Meter: https://claude.ai/artifact/5LQTcj9uKMezQywkSfxJ4x
- Trees: https://claude.ai/artifact/Bcksp2wgR6hK5sTpj41Utm
- Brake lamps: linked from the brake-lamps PR

## 1–3. Traffic: no overlaps, no pop-in, braking, yielding, turning (`TRAFFIC_AI_AUDIT.md`)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Vehicles never pass through each other | PASS | `tests/traffic-safety.test.ts` scenarios and 4-minute long runs on all 8 streets: separation never below −0.01 m |
| A frame stall cannot tunnel a vehicle | PASS | swept-advance test and scenario 12 |
| No vehicle materialises in front of the visitor | PASS | "spawn and despawn rules": re-entry only when unseen and clear |
| Braking, following, yielding to the visitor and to people on the zebra | PASS | scenarios 1–4, 10, 11 and `tests/crossings.test.ts` |
| Junction turns take turns | PASS | scenarios 5–6 and the 3-way junction test |
| Lane changes and overtaking | NOT TESTED | not built |
| Brake lamps light when slowing or held | PASS | `tests/brake-lights.test.ts`; seen lit on a stopped car on Fort Road in the screenshots |

## 4. Fare meter (`AUTO_METER_IMPLEMENTATION.md`)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Physical meter with three red seven-segment rows (fare, waiting, distance) | PASS | `MeterModel.ts`, `SegmentDisplay.ts`; screenshots |
| "DEMO FARE POLICY — NOT AN OFFICIAL TRANSPORT TARIFF" label; no brand copied | PASS | faceplate reads "ELECTRONIC FARE METER"; screenshots |
| States OFF → READY → HIRED → RUNNING ↔ WAITING → COMPLETED → RESET, plus cancel | PASS | `tests/fare-meter.test.ts` (48 state × action cases) |
| No distance spike at district cuts | PASS | "trip distance across a district cut" |
| Waiting is not charged while paused or loading | PASS | `tests/fare-meter.test.ts` |
| Taxi variant | PASS | same engine, ₹28 base; screenshots |
| Meter beside the passenger, nothing covering it (Harsh, 20 Oct) | PASS | passenger-camera screenshots of the auto and the taxi |
| On-screen fare box removed (Harsh, 20 Oct); controls and an accessible readout kept | PASS | `RideMeter.tsx`; `tests/city.spec.ts` 14/14 |
| WAITING state seen in the running game | NOT TESTED | covered by unit tests only, no screenshot |
| Readability on real phones | NOT TESTED | no real devices |

## 5. Trees (`ENVIRONMENT_VISUAL_AUDIT.md`)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Branching trees with leaves, no blob crowns | PASS | `nature.ts`; screenshots from Dadar and Juhu |
| District species | PARTIAL | rain tree (Dadar) and Indian almond (Juhu); gulmohar, peepal and banyan are not modelled |
| Wind | PASS | shared GPU sway, turned off by reduced motion; inferred from successive frames |
| LOD | NOT TESTED | not built: trees merge into each district's meshes |
| Triangle budget kept | PASS | `tests/districts.test.ts`: Dadar 177,706 / 180,000 |

## 6. Signs (`ENVIRONMENT_VISUAL_AUDIT.md`)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Tier-1 signs not embedded or hidden | PASS | `tests/signs.test.ts`: 38 Tier-1 signs legible from a walkable point |
| No Tier-1 or Tier-2 sign buried | PASS | 216 signs checked; 16 fixed |
| Sign validation tool | PASS | `signAudit.ts`; `SIGN_REPORT=<file>` writes a per-sign report |
| Exhibit boards | NOT TESTED | not audited yet |

## 7. Vehicle, driver and NPC realism (`WORLD_PHYSICS_AUDIT.md`)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Brake lamps on every class with rear lamps | PASS | `tests/brake-lights.test.ts`; screenshot |
| Wheels turn with distance, front wheels steer (loop vehicles and the boarded cab) | PASS | existing `animateTransit`; seen in the running game |
| Seated drivers in moving vehicles | PASS | `createSeatedDriver`; meter screenshots show the drivers |
| Suspension, tyre physics, crashes | NOT TESTED | not simulated by design: traffic is kinematic and kept apart |
| New NPC behaviours in this pass | NOT TESTED | none added beyond the zebra and the person room in the safety layer |
| Traffic diagnostics (`/?debug&traffic`) | PASS | overlay screenshot: envelopes, held count, closest gap, interventions |

## 8. Keep the 9 districts and existing features

| Requirement | Status | Evidence |
| --- | --- | --- |
| All nine canonical districts reachable, with guide and stop | PASS | `tests/districts.test.ts`; `/?bench` visited all nine on every benched commit |
| Rides, journal, map and existing flows | PASS | `tests/city.spec.ts` 14/14 on the meter PR; CI browser smoke (Chromium, Firefox, WebKit) green on every PR |

## 9. Tests, evidence and docs

| Requirement | Status | Evidence |
| --- | --- | --- |
| Unit tests | PASS | vitest 348/348 on this PR |
| Audits written | PASS | `WORLD_PHYSICS_AUDIT.md`, `TRAFFIC_AI_AUDIT.md`, `AUTO_METER_IMPLEMENTATION.md`, `ENVIRONMENT_VISUAL_AUDIT.md`, `WORLD_PERFORMANCE_REPORT.md`, this report |
| Performance on real hardware | NOT TESTED | SwiftShader only; see `WORLD_PERFORMANCE_REPORT.md` |
| Full Playwright suite in one run after all four PRs | NOT TESTED | `city.spec.ts` was run on the meter PR; CI smoke ran on each PR |

## Open items

- Tree LOD and more species.
- Lane changes and overtaking.
- An exhibit-board sign audit.
- A WAITING screenshot.
- Real-device `/?bench` runs on a laptop and a phone.
