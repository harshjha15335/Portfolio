# World physics audit

What keeps bodies apart in the world, measured or tested on `main` after the traffic pass (PR #21). Statuses: PASS,
PARTIAL, FAIL, BLOCKED, NOT TESTED. A claim cites a test or measurement; anything else is marked as inferred.

## How the world is simulated

| Layer | What it does | Where |
| --- | --- | --- |
| Visitor body | a cannon-es sphere stack on a fixed-step physics world, a floor clamp (no climbing without a jump) and a hard push-out after each step from vehicles, people and upright static boxes | `WorldEngine.ts`, `collision/DynamicBlockers.ts` |
| Static colliders | per-district box solids (`DistrictKit.solid`), auto-solidified ground-level props, Fort Road proxies, plus one BVH of all colliders for line of sight and ground probes | `DistrictKit.ts`, `MumbaiStreet.ts`, `spatial/SpatialIndex.ts` |
| Traffic | not rigid bodies: kinematic drivers on paths, kept apart by oriented-box envelopes in one shared `TrafficSpace` (separating-axis gaps, swept advance, IDM following, junction reservations) | `traffic/TrafficSafety.ts` |
| People | navmesh walkers (Fort Road) and lane walkers (districts), round envelopes in the traffic space when on the road | `navigation/`, `DistrictSystems.ts` |
| Ride | the passenger cab is a driver in the same traffic space; the world takes up to 0.25 s of catch-up per frame in steps of at most 0.08 s, so slow devices keep world time | `PassengerRide.ts`, `WorldEngine.ts` |

## Results

| Requirement | Status | Evidence |
| --- | --- | --- |
| Visitor cannot walk into a vehicle | PASS | `tests/collision.test.ts` "pushes the visitor out of a vehicle side…", "respects the vehicle heading", "rounds the corners…" |
| Visitor cannot walk through thin walls | PASS | `tests/collision.test.ts` "holds the visitor on the street side of a thin turned wall…" |
| People keep apart, and walk round stalls | PASS | `tests/collision.test.ts` "keeps people apart by their radii", "walks around a stall on its line…", "passes oncoming walkers…" |
| No vehicle passes through another | PASS | `tests/traffic-safety.test.ts` scenarios 1–8, 12, 20 and the long runs (0 overlaps on Fort Road and all 7 districts) |
| A frame stall cannot tunnel a vehicle | PASS | `tests/traffic-safety.test.ts` "stops a long frame from jumping through a vehicle (swept check)" and scenario 12 |
| Vehicle envelopes match the models | PASS | "body sizes match the built vehicles (no mirrors) within 15 cm" |
| Traffic stops for the visitor in the road and for people on the zebra | PASS | scenarios 10 and 11, `tests/crossings.test.ts` |
| Visitor hit by traffic | PASS (inferred from the rules above) | traffic never moves into the visitor's envelope while the visitor is on the carriageway; on the pavement the visitor is pushed out of a vehicle that is there |
| Vehicles as rigid bodies (crashes, pushing) | NOT TESTED | by design there are no crashes: traffic is kinematic and the safety layer prevents contact |
| Wheels, suspension and tyre physics on traffic | NOT TESTED | not simulated: the Fort Road loop vehicles and the passenger cab turn their wheels with distance and steer their front wheels (`animateTransit`); district autos and bikes have a small ride bob; there is no suspension model |
| Physics on a real phone | NOT TESTED | no real devices in this environment |

## Realism added in this pass

- **Brake lamps**: every traffic vehicle with rear lamps (cars, taxis, buses, tempos, autos, bikes) lights them when
  it slows harder than 0.7 m/s² or stands held (stopping, at a signal, yielding). They stay on for 0.35 s after.
  They are drawn as one instanced mesh per street (one draw call), only for district vehicles within 40 m of the visitor and for every visible Fort Road loop vehicle.
  Evidence: `tests/brake-lights.test.ts` covers the state rules and the lamp placement; screenshots are in the PR.
- **Traffic diagnostics overlay** (dev builds only, `/?debug&traffic#world`): every envelope in the shared traffic
  space is outlined on the road, coloured by its driving state:
  - green: cruising or following
  - amber: stopping
  - orange or red: stopped or at a signal
  - pink: yielding
  - yellow: a person
  - white: the visitor
  - blue: parked

  The debug readout adds the vehicle count, how many are held, the closest gap between vehicles and the safety
  layer's intervention count. It is not part of production builds.
