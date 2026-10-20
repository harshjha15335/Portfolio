# Traffic AI audit

Scope: every moving vehicle in the city (Fort Road loop taxis and autos, Fort lane traffic and cross street, the
through traffic of the seven district streets) and the taxi or auto the visitor hails and rides. Statuses follow
the acceptance vocabulary: PASS, PARTIAL, FAIL, BLOCKED, NOT TESTED. A claim here is backed by a named test or
measurement; anything else is marked as inferred.

## Baseline (before this pass)

Measured on the previous `main` (commit `b0c54c6`) with a scenario harness that hailed a cab and rode it from the
Fort kerb (4.6, −24) to every destination at eight warm-up offsets:

| Measure | Baseline |
| --- | --- |
| Rides whose cab overlapped another vehicle | 40 of 48 |
| Worst overlap (negative separation) | 2.92 m (cab inside a loop taxi) |
| Cab vs traffic awareness | none: the ride followed a waypoint path and ignored every vehicle |
| Traffic vs the cab | none: the loop and district traffic did not see the cab |
| Following | per-lane spacing only; vehicles of different systems (loop, lane traffic, cab) could overlap |
| Spawn | vehicles re-entered at the lane start with no occupancy or visibility check |
| Signal stop | target speed clamped near the line, so a vehicle could stop instantly from any speed |

## What changed

New modules under `src/game/World/traffic/`:

- `TrafficSafety.ts`: oriented-box envelopes for every vehicle class (sizes from the built models, no mirrors),
  separating-axis gaps, a per-frame `TrafficSpace` shared by all systems on the current street, path clearance
  look-ahead, a swept `safeAdvance` (substeps of at most 0.25 m, so a 0.5 s frame stall cannot step through a
  vehicle), IDM car following with a per-class drive profile (bus, tempo, sedan, taxi, auto, bike, cart…), and
  `JunctionReservations` for the two U-turn conflict zones (first come first served, a waiting driver is served
  after 4 s, stale holds released after 15 s).
- `PassengerRide.ts`: the hailed cab as a driver in the same space. It starts out of sight up the lane (or the
  farthest clear start after 4 s), stops behind vehicles and for people, waits at the zebra while it is held, waits
  its turn at a U-turn, and never moves into another envelope.
- `RoutePath.ts`: ride routes with filleted corners instead of turning on the spot.
- Lane traffic (`DistrictSystems.ts` `LaneTraffic`) and the Fort loop (`RoadTraffic.ts`) drive with `drive()`;
  spawn decisions record why a vehicle may not enter (occupied, visitor, pedestrian, ride, in view, recently seen),
  and vehicles leave only out of sight.

Rules added while driving the scenarios to green:

- A person on the pavement never stops traffic; one on the carriageway does. Drivers leave 1.1 m in front of a
  person in their path and 0.45 m beside one they pass at the kerb edge.
- Walkers wait at the kerb while a vehicle is on the zebra or too close to its stop line to stop (`zebraBusy`), and
  traffic is held 3 s before the walk signal so a vehicle already past its line is across first.
- Keep the crossing clear: behind slow traffic, a vehicle waits at its stop line rather than stop on the zebra.
- A cab only stops at a kerb with 6 m behind to pull in and 6 m ahead to pull out (`kerbRoom`); Andheri's kerbside
  handcarts stand clear of the lane.
- Routes keep left and turn round only at the street's two U-turns; final kerb approaches are straight.

## Results

| Requirement | Status | Evidence |
| --- | --- | --- |
| No vehicle drives through another | PASS | `tests/traffic-safety.test.ts`: scenarios 1–8, 12, 20 and the 8 Fort ride scenarios × warm-up offsets assert separation > −0.01 m every frame |
| No overlap in long mixed runs | PASS | "long runs on every street": 4 simulated minutes each on Fort Road and all 7 districts, frame times 1/120–1/15 s with 0.1–0.5 s stalls, repeated taxi and auto rides; 0 overlaps |
| No vehicle off the carriageway | PASS | same long runs: 0 frames with any body corner beyond 4.5 m of the centre line (cross street excepted) |
| No lasting deadlock | PASS | same long runs: no ride and no traffic vehicle stands still for 60 s |
| No vehicle appears in front of the visitor | PASS | "spawn and despawn rules": re-entry only when the lane start is clear and unseen; leaving only out of sight; making room for a cab removes only unseen vehicles |
| Braking, following, yielding | PASS | scenarios 1–4, 10, 11; IDM with per-class comfortable and emergency braking |
| Junction turns | PASS | scenarios 5–6 and the 3-way junction test: crossing movements take turns, no overlap |
| Zebra: walkers never hit, walkers do cross | PASS | `tests/crossings.test.ts` (all 7 districts, 3 cycles) and scenario 11 on Fort Road |
| Ride in the running game | NOT TESTED here | see the PR description for the browser run |
| Lane changes, overtaking | NOT TESTED | not implemented: vehicles queue behind a slow handcart rather than pass it |
| Real road network | NOT TESTED | each street is still an authored straight road with two U-turns |

## Cost

Per-frame district traffic step measured in Node (Vitest, 3000 frames at 60 Hz after warm-up): 0.07–0.13 ms for
17–24 vehicles, against 0.02–0.04 ms for the previous code (that harness built 10–14 vehicles per street, so the comparison is not like for like). Either is under 1% of a 16.7 ms frame. Browser numbers are in
`docs/WORLD_PERFORMANCE_REPORT.md` when that pass lands; SwiftShader in this container cannot measure real frame
rates.
