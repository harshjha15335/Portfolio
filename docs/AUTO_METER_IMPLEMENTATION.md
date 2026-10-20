# Auto and taxi fare meter

The fare of a ride is now shown on a physical meter mounted in the boarded auto-rickshaw or taxi, driven by a
deterministic fare engine and a meter state machine. There is no fare card on screen: the fare is read on the meter,
and the screen keeps only a slim row of ride controls and a screen-reader readout. Statuses: PASS, PARTIAL, FAIL, BLOCKED, NOT TESTED.

## Reference

Primary visual reference: Harsh's photograph of a Mumbai auto-rickshaw meter (2026-10-20): a black rectangular case on
a pedestal beside the handlebar, a cream printed faceplate, three red seven-segment rows (fare, a time row, distance),
small printed labels, a green and a red indicator lamp, push buttons and a maker's plate. The model follows that
layout; the maker's name is not reproduced (the plate reads "ELECTRONIC FARE METER"). It is an authored model, not a
scan, and is not claimed to match any particular meter exactly.

## Model (`src/game/World/meter/MeterModel.ts`)

| Part | Construction |
| --- | --- |
| Case | bevelled rounded box, 20 × 15 × 7.5 cm (auto) or 19 × 14 × 6 cm (taxi), matte black plastic |
| Bezel | extruded raised frame round an inset faceplate |
| Faceplate | cream printed canvas texture: FARE / ₹, WAITING / MIN : SEC, DISTANCE / KM, FOR HIRE, HIRED, maker's plate with the demo-tariff notice |
| Display | three LED windows sharing one emissive canvas texture; each in a 6 mm deep black surround with tinted glass at its front, so the digits sit recessed |
| Digits | drawn as seven-segment polygons (`SegmentDisplay.ts`), slanted, with faint unlit segments, lit segments with glow, decimal points and a clock colon; no web font |
| Lamps | green FOR HIRE (lit when READY) and red HIRED (lit while hired) emissive discs |
| Controls | two push buttons and four corner screws |
| Mounting | beside the passenger, with nothing between it and them (Harsh, 2026-10-20). Auto: pedestal and clamp on a bracket off the right-hand side rail just ahead of the bench, at the passenger's eye level, turned towards them; taxi: clamped on top of the empty front seat's back beside its headrest, turned towards the passenger behind it. Checked from the passenger camera in the running game: no seat, handlebar or driver covers either meter |

The meter is a child of the cab model, so it moves, turns and leans with the vehicle. It faces the passenger and is
tilted up towards them. The display texture is redrawn only when a shown value changes (at most a few times a second
while the distance or waiting clock advances), never every frame. Street (unboarded) vehicles keep a simple box.

## Fare engine (`src/game/World/meter/FareMeter.ts`)

`FarePolicy` fields: base fare, included distance, distance step and rate, waiting threshold and rate per started
minute, minimum fare, night surcharge with its hours, rounding, effective date and source. The shipped tariffs are
labelled **DEMO FARE POLICY — NOT AN OFFICIAL TRANSPORT TARIFF**, have no effective date, and are not any authority's
rates. No payment is taken.

| Demo tariff | Auto | Taxi |
| --- | --- | --- |
| Base fare (covers 1.5 km) | ₹23 | ₹28 |
| Each started 100 m after that | ₹1.50 | ₹1.90 |
| Waiting after the first 60 s, per started minute | ₹1 | ₹1.50 |
| Night (00:00–05:00, world clock) | +25% | +25% |
| Rounding | whole rupees | whole rupees |

## Meter states

`OFF → READY → HIRED → RUNNING ↔ WAITING → COMPLETED → (reset) READY`, plus `cancel` from HIRED, RUNNING or WAITING
back to READY (the trip is cleared, nothing is charged) and `power-off` from READY. Any other action is refused and
leaves the meter unchanged. In the game: hailing powers the meter on (READY), choosing a destination hires it, the cab
moving makes it RUNNING, standing still below 0.3 m/s for 1 s makes it WAITING, arrival or skip completes it, and
leaving the cab cancels or resets it and powers it off.

## Distance and waiting policy

- Distance comes only from the trip's own chargeable distance, `PassengerRide.chargeable`, never from positions. A
  district swap, a scene reload or extra frames cannot add to it, and it never decreases.
- Demo distance policy: the streets are a miniature, so each metre the cab drives counts as 10 m on the meter
  (`CITY_METRES_PER_WORLD_METRE`). A ride between districts also counts the virtual distance between them (400 m per unit
  between their positions on the city map, `CITY_METRES_PER_MAP_UNIT`, so CST to BKC is 14 km). That virtual distance is released in step with progress along
  the arrival road, so the meter never jumps at the cut and reaches the full trip on arrival. This is not GPS-measured
  travel.
- Skip to arrival completes the trip at its full chargeable distance.
- Waiting time is the world's simulation clock while the meter is WAITING. It stops while the game is paused (the
  simulation does not run), each frame is capped (a browser stall cannot add more than a frame's worth), and no waiting
  is counted while the next district is still being built.

## Ride controls

Harsh asked for the fare box to go completely (2026-10-20), so nothing on screen shows the fare. The bottom-left of
the screen carries one slim row with only what the moment needs: "your taxi is on the way" while hailing, the destination
choice on boarding, SKIP TO ARRIVAL while riding, STEP OUT & MEET THE GUIDE on arrival, and an exit button throughout.
For screen readers a hidden live region reads the meter ("Meter running. Fare ₹31.00, distance 2.0 km, waiting 0 min
0 s.") with the demo-tariff notice, so the fare stays accessible without being drawn.

## Evidence

| Check | Status | Evidence |
| --- | --- | --- |
| Fare engine values, rounding, night, monotonic | PASS | `tests/fare-meter.test.ts` |
| Every state × action (48 cases) | PASS | `tests/fare-meter.test.ts` "meter states" |
| Waiting not charged when paused, across a stall or while loading | PASS | `tests/fare-meter.test.ts` |
| No distance spike at a district cut; full trip on arrival | PASS | `tests/fare-meter.test.ts` "trip distance across a district cut" |
| Meter mounted and visible in the running game | see the PR | screenshots from the dev server under software rendering |
| Readability on real phones and GPUs | NOT TESTED | no real devices in this environment |
