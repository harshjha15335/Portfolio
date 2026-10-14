import { FORT_LOOP, pedestrianGreen, type LoopVehicle } from '../traffic/RoadTraffic';
import { LaneTraffic } from './DistrictSystems';
import { cityDensity } from './District';
import type { CityVehicleKind } from './CityVehicles';

/** Fort Road is a dead end at the station, so through traffic uses the cross street at its north end (z ≈ −62). */
const CROSS_STREET = -62;
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
  traffic.stopLine(ring, -8.8, pedestrianGreen, 1.75); traffic.stopLine(ring, -15.2, pedestrianGreen, -1.75);
  // Keep to the lane edges clear of the corner blocks: eastbound on the near (south) side, westbound beyond.
  const east = traffic.lane([[-90, 0, CROSS_STREET + 2], [90, 0, CROSS_STREET + 2]]), west = traffic.lane([[90, 0, CROSS_STREET - 1.2], [-90, 0, CROSS_STREET - 1.2]]);
  const scale = cityDensity.traffic * .35;
  const loopKinds: CityVehicleKind[] = ['hatch', 'bike', 'sedan', 'suv', 'bike', 'hatch'], crossKinds: CityVehicleKind[] = ['bus', 'sedan', 'hatch', 'bus', 'suv', 'sedan'];
  // Between the loop's own taxis and autos, which sit at sixths of the loop.
  const onLoop = loopKinds.slice(0, Math.max(1, Math.round(loopKinds.length * scale)));
  onLoop.forEach((kind, i) => traffic.vehicle(ring, kind, (i * 2 + 1) / 12, `fort:${i}`));
  const across = crossKinds.slice(0, Math.max(2, Math.round(crossKinds.length * scale))), half = Math.ceil(across.length / 2);
  across.forEach((kind, i) => traffic.vehicle(i % 2 ? west : east, kind, ((i >> 1) + (i % 2) * .5) / half, `fort:cross:${i}`));
  traffic.group.name = 'fort-road:through-traffic';
  return traffic;
}
