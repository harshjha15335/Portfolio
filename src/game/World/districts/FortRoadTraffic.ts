import { FORT_LOOP, crossingHeld, type LoopVehicle } from '../traffic/RoadTraffic';
import { LaneTraffic } from './DistrictSystems';
import { cityDensity } from './District';
import type { CityVehicleKind } from './CityVehicles';

/** Fort Road is a dead end at the station, so through traffic uses the cross street at its north end (z ≈ −62). */
const CROSS_STREET = -62;
/** Fort Road's frontages stand at |x| ≈ 7.8 as far north as z ≈ −57, where the cross street opens out. */
const FRONTAGE = 7.8, FRONTAGE_END = -57;

/**
 * From inside Fort Road, the cross street shows only through the street's open end: a vehicle on it is hidden
 * when its whole length lies behind the corner blocks, seen along the line from the visitor.
 */
export function hiddenByFrontage(p: { x: number; z: number }, length: number, view: { x: number; z: number }) {
  if (p.z > FRONTAGE_END || view.z < FRONTAGE_END || Math.abs(view.x) > FRONTAGE) return false;
  const at = (x: number) => view.x + (x - view.x) * (FRONTAGE_END - view.z) / (p.z - view.z);
  const a = at(p.x - length / 2), b = at(p.x + length / 2), margin = 1;
  return Math.max(a, b) < -FRONTAGE - margin || Math.min(a, b) > FRONTAGE + margin;
}

/** The loop is the first lane, so the street can read this system's loop vehicles with `onLane(FORT_LOOP_LANE)`. */
export const FORT_LOOP_LANE = 0;

/**
 * Private traffic around CST–Fort. Cars and motorbikes join the street's taxi and auto loop (up the east lane,
 * round at the cross street, back down the west lane and round in the station forecourt), queued bumper to
 * bumper with the loop vehicles, stopping for the pedestrian green at the zebra and for people on the road.
 * Red BEST buses and more cars pass along the cross street, which leads out of the scene both ways; they
 * never drive down Fort Road, where a bus could not turn in the forecourt.
 */
export function createFortRoadTraffic(loop: () => LoopVehicle[]) {
  const traffic = new LaneTraffic();
  const ring = traffic.lane(FORT_LOOP, true, loop);
  traffic.stopLine(ring, -8.8, crossingHeld, 1.75); traffic.stopLine(ring, -15.2, crossingHeld, -1.75);
  // Keep to the lane edges clear of the corner blocks: eastbound on the near (south) side, westbound beyond.
  const east = traffic.lane([[-90, 0, CROSS_STREET + 2], [90, 0, CROSS_STREET + 2]]), west = traffic.lane([[90, 0, CROSS_STREET - 1.2], [-90, 0, CROSS_STREET - 1.2]]);
  const scale = cityDensity.traffic * .35;
  const loopKinds: CityVehicleKind[] = ['hatch', 'bike', 'sedan', 'suv', 'bike', 'hatch'], crossKinds: CityVehicleKind[] = ['bus', 'sedan', 'hatch', 'bus', 'suv', 'sedan'];
  // Behind the loop's own taxis and autos, which sit at sixths of the loop. The first starts beyond the near
  // detail range of the arrival view, so the opening frame keeps inside the Medium triangle budget.
  const onLoop = loopKinds.slice(0, Math.max(1, Math.round(loopKinds.length * scale)));
  onLoop.forEach((kind, i) => traffic.vehicle(ring, kind, (i * 2 + 1) / 12 + 1 / 24, `fort:${i}`));
  const across = crossKinds.slice(0, Math.max(2, Math.round(crossKinds.length * scale))), half = Math.ceil(across.length / 2);
  across.forEach((kind, i) => traffic.vehicle(i % 2 ? west : east, kind, ((i >> 1) + (i % 2) * .5) / half, `fort:cross:${i}`));
  traffic.occluded = hiddenByFrontage;
  traffic.group.name = 'fort-road:through-traffic';
  return traffic;
}
