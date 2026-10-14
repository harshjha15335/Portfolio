import { pedestrianGreen } from '../traffic/RoadTraffic';
import { LaneTraffic } from './DistrictSystems';
import { cityDensity } from './District';
import type { CityVehicleKind } from './CityVehicles';

/**
 * Through traffic for the CST–Fort street: private cars and red BEST double-deckers on the same
 * two lanes as the street's own taxi and auto loop. They stop for the pedestrian green at the
 * zebra, queue behind the loop vehicles, and the loop vehicles queue behind them in turn.
 */
export function createFortRoadTraffic() {
  const traffic = new LaneTraffic(), base: CityVehicleKind[] = ['sedan', 'bus', 'hatch', 'suv', 'sedan', 'hatch', 'bus', 'sedan', 'bike', 'suv', 'hatch', 'sedan'];
  const north = traffic.lane([[1.75, 0, 120], [1.75, 0, -160]]), south = traffic.lane([[-1.75, 0, -160], [-1.75, 0, 120]]);
  traffic.stopLine(north, -8.8, pedestrianGreen); traffic.stopLine(south, -15.2, pedestrianGreen);
  const kinds = Array.from({ length: Math.round(base.length * cityDensity.traffic * .35) }, (_, i) => base[i % base.length]), half = Math.ceil(kinds.length / 2);
  kinds.forEach((kind, i) => traffic.vehicle(i % 2 ? south : north, kind, ((i >> 1) + (i % 2) * .5) / half, `fort:${i}`));
  traffic.group.name = 'fort-road:through-traffic';
  return traffic;
}
