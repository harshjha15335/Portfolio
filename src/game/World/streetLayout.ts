import type { Point } from './transit';

/** One authored street, not a generated nine-district map. Metres at human scale. */
export const STREET_SPAWN = { x: 4.6, z: 11.5, yaw: 0.14 };
export const streetStops: Record<string, Point & { yaw: number }> = {
  cst: { x: 4.6, z: 11.5, yaw: 0.14 },
  fort: { x: -5.1, z: -35, yaw: Math.PI / 2 },
};
export const streetStand = { taxi: { x: 2.1, z: 5 }, auto: { x: -2.1, z: 5 } };
export function streetRideRoute(start: Point, destination: string): Point[] {
  const target = streetStops[destination];
  if (!target) return [];
  // Same-district routes are authored in the district's local frame.
  const ox = Math.round(target.x / 600) * 600;
  return localRoute({ x: start.x - ox, z: start.z }, { x: target.x - ox, z: target.z }).map(p => ({ x: p.x + ox, z: p.z }));
}
/** Lane centres the rides use (local x): northbound (−z) on the east side, southbound on the west, as Mumbai drives on the left. */
const RIDE_LANE = 1.8;
/** Where a ride pulls out of or into the kerb: over a few metres of road, never sideways on the spot. */
const pull = (span: number) => Math.max(4, Math.min(6, Math.abs(span) / 3));
function localRoute(start: Point, end: Point): Point[] {
  // Keeping to the left: a cab at an east kerb faces north (−z), one at a west kerb south. It turns round only
  // at the U-turns at either end of the street (as the Fort Road loop does). Stops remain on the pedestrian side.
  const north = -52, south = 12, lane = RIDE_LANE, fromEast = start.x >= 0, toEast = end.x >= 0;
  const out: Point[] = [start, fromEast ? { x: lane, z: Math.max(north + 2, start.z - 4) } : { x: -lane, z: Math.min(south - 2, start.z + 4) }];
  const northTurn = [{ x: lane, z: north }, { x: 0, z: north - 2 }, { x: -lane, z: north }], southTurn = [{ x: -lane, z: south }, { x: 0, z: south + 2 }, { x: lane, z: south }];
  // Heading north on the east lane, the stop is ahead if it is on the east side and north of here; similarly south.
  let heading: 'north' | 'south' = fromEast ? 'north' : 'south', at = out[1].z;
  for (let turns = 0; turns < 3; turns++) {
    if (heading === 'north' && toEast && end.z + 7.5 <= at) break;
    if (heading === 'south' && !toEast && end.z - 7.5 >= at) break;
    // CST's forecourt stop is right where the south U-turn comes out: a wide turn, so the body stays on the road.
    if (heading === 'south' && toEast && end.z + 4 >= south) return [...out, { x: -lane, z: south - 1 }, { x: -.6, z: south + 2.2 }, { x: 1.6, z: south + 2 }, { x: 2.6, z: end.z + .5 }, { x: 2.8, z: end.z - .8 }];
    if (heading === 'north') { out.push(...northTurn); heading = 'south'; at = north; } else { out.push(...southTurn); heading = 'north'; at = south; }
  }
  return toEast ? [...out, { x: lane, z: end.z + 7.5 }, { x: 3.2, z: end.z + 1.5 }, { x: 3.2, z: end.z }] : [...out, { x: -lane, z: end.z - 7.5 }, { x: -3.2, z: end.z - 1.5 }, { x: -3.2, z: end.z }];
}
export function walkingVelocity(forward: number, strafe: number, yaw: number, speed: number): Point {
  const length = Math.max(1, Math.hypot(forward, strafe));
  return { x: (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * speed / length, z: (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * speed / length };
}


/** The last `keep` metres of a polyline. */
function tail(points: Point[], keep: number): Point[] {
  const out: Point[] = [points[points.length - 1]]; let left = keep;
  for (let i = points.length - 1; i > 0 && left > 0; i--) {
    const a = points[i - 1], b = points[i], len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len >= left) { const t = left / len; out.unshift({ x: b.x + (a.x - b.x) * t, z: b.z + (a.z - b.z) * t }); left = 0; } else { out.unshift(a); left -= len; }
  }
  return out;
}
/** How far up the lane (m) a hailed cab may start, farthest first: out of the near field, ideally out of sight. */
export const PICKUP_STARTS = [55, 46, 38, 30];
/**
 * Routes a hailed cab can take to the kerb beside the visitor, farthest start first. The cab drives in along
 * its lane with the traffic (on Fort Road round the forecourt or the north U-turn of the loop) and pulls in
 * over the last metres, stopping at x = ±2.8 on the visitor's side. `clear(x, z)` rejects kerb spots taken by
 * parked vehicles; the stop moves along the kerb to the nearest free one.
 */
export function pickupRoutes(visitor: Point, clear: (x: number, z: number) => boolean = () => true): Point[][] {
  const ox = Math.round(visitor.x / 600) * 600, east = visitor.x - ox >= 0, fort = ox === 0, side = east ? 1 : -1;
  const [lo, hi] = fort ? (east ? [-45, 6] : [-45, 11]) : [-60, 40];
  let z = Math.max(lo, Math.min(hi, visitor.z));
  for (const offset of [0, 2, -2, 4, -4, 6, -6, 8, -8, 10, -10, 12, -12]) { const c = Math.max(lo, Math.min(hi, z + offset)); if (clear(ox + side * 2.8, c)) { z = c; break; } }
  const kerb = { x: side * 2.8, z }, settle = { x: side * 2.8, z: z + (east ? 1.5 : -1.5) }, entry = east ? { x: 1.75, z: z + 6 } : { x: -1.75, z: z - 6 };
  const lane: Point[] = fort
    ? (east ? [{ x: -1.75, z: -51 }, { x: -1.75, z: 12 }, { x: 0, z: 14 }, { x: 1.75, z: 12 }, entry] : [{ x: 1.75, z: 12 }, { x: 1.75, z: -51 }, { x: 0, z: -54 }, { x: -1.75, z: -51 }, entry])
    : (east ? [{ x: 1.6, z: 150 }, { x: 1.6, z: entry.z }] : [{ x: -1.6, z: -190 }, { x: -1.6, z: entry.z }]);
  return PICKUP_STARTS.map(start => shift([...tail(lane, start), settle, kerb], ox));
}
/** The usual pickup route (the second-farthest start). */
export function streetPickupRoute(visitor: Point): Point[] { return pickupRoutes(visitor)[1]; }
/**
 * The seven other districts are separate walkable streets, each laid out on the same
 * local frame as Fort Road (road along Z, pavements at |x|≈5) and placed DISTRICT_SPACING
 * metres apart on X so only one is ever inside the fog/far plane. Taxis and autos drive
 * out of one district and into the next; the directory can also jump straight there.
 */
export const DISTRICT_SPACING = 600;
export interface CityZone { id: string; label: string; originX: number; stop: Point & { yaw: number } }
export const cityZones: CityZone[] = [
  { id: 'cst', label: 'CST / FORT ROAD', originX: 0, stop: streetStops.cst },
  { id: 'bkc', label: 'BKC · G BLOCK', originX: DISTRICT_SPACING, stop: { x: 4.7, z: 2, yaw: .1 } },
  { id: 'andheri', label: 'ANDHERI · TECH BAZAAR LANE', originX: DISTRICT_SPACING * 2, stop: { x: 4.6, z: 4, yaw: .1 } },
  { id: 'powai', label: 'POWAI · LAKESIDE', originX: DISTRICT_SPACING * 3, stop: { x: 4.7, z: 2, yaw: .1 } },
  { id: 'dadar', label: 'DADAR · RANADE ROAD', originX: DISTRICT_SPACING * 4, stop: { x: 4.6, z: 4, yaw: .1 } },
  { id: 'worli', label: 'WORLI SEA FACE', originX: DISTRICT_SPACING * 5, stop: { x: -4.9, z: 2, yaw: -.1 } },
  { id: 'juhu', label: 'JUHU TARA ROAD', originX: DISTRICT_SPACING * 6, stop: { x: 4.6, z: 2, yaw: .1 } },
  { id: 'filmcity', label: 'FILM CITY · GOREGAON', originX: DISTRICT_SPACING * 7, stop: { x: 4.6, z: 18, yaw: .22 } },
];
for (const zone of cityZones.slice(1)) streetStops[zone.id] = { x: zone.originX + zone.stop.x, z: zone.stop.z, yaw: zone.stop.yaw };
export const zoneIndexAt = (x: number) => Math.max(0, Math.min(cityZones.length - 1, Math.round(x / DISTRICT_SPACING)));
export const zoneAt = (x: number) => cityZones[zoneIndexAt(x)];
const shift = (points: Point[], dx: number) => points.map(p => ({ x: p.x + dx, z: p.z }));

/** Route legs for a ride. One leg inside a district; two legs (exit, then arrival) across the city. */
export function cityRideLegs(start: Point, destination: string): Point[][] {
  const end = streetStops[destination]; if (!end) return [];
  const from = zoneAt(start.x), to = zoneAt(end.x);
  if (from === to) return [streetRideRoute(start, destination)];
  const s = { x: start.x - from.originX, z: start.z }, e = { x: end.x - to.originX, z: end.z };
  // Leave the way the cab faces, keeping to the left: from an east kerb north, from a west kerb south. Fort Road
  // ends at the station, so from its west kerb the cab turns in the forecourt and leaves north too.
  const east = s.x >= 0, p = pull(20);
  const exit = east ? [s, { x: RIDE_LANE, z: s.z - p }, { x: RIDE_LANE, z: -57 }]
    : from.originX === 0 ? [s, { x: -RIDE_LANE, z: Math.min(9, s.z + p) }, { x: -RIDE_LANE, z: 11 }, { x: 0, z: 14 }, { x: RIDE_LANE, z: 11 }, { x: RIDE_LANE, z: -57 }]
      : [s, { x: -RIDE_LANE, z: s.z + p }, { x: -RIDE_LANE, z: 17 + Math.max(0, s.z + p + 4 - 17) }];
  // Arrive along the lane that runs past the stop's kerb: northbound to an east kerb, southbound to a west one.
  // Fort Road is entered from the cross street; CST's forecourt stop is reached round the forecourt turn.
  const arrival = to.originX === 0
    ? (e.x < 0 ? [{ x: -RIDE_LANE, z: -50 }, { x: -RIDE_LANE, z: e.z - 7.5 }, { x: -3.2, z: e.z - 1.5 }, { x: -3.2, z: e.z }] : [{ x: -RIDE_LANE, z: -40 }, { x: -RIDE_LANE, z: 11 }, { x: 0, z: 14 }, { x: 3.0, z: e.z - .8 }])
    : (e.x < 0 ? [{ x: -RIDE_LANE, z: e.z - 26 }, { x: -RIDE_LANE, z: e.z - 7.5 }, { x: -3.2, z: e.z - 1.5 }, { x: -3.2, z: e.z }] : [{ x: RIDE_LANE, z: e.z + 26 }, { x: RIDE_LANE, z: e.z + 7.5 }, { x: 3.2, z: e.z + 1.5 }, { x: 3.2, z: e.z }]);
  return [shift(exit, from.originX), shift(arrival, to.originX)];
}

/** Development review poses inside the districts (local x/z, offset by each district origin). */
const localViews: Record<string, Point & { yaw: number }> = {
  'cst-traffic': { x: 4.7, z: -24, yaw: .22 }, 'cst-traffic-south': { x: -4.7, z: -44, yaw: Math.PI - .22 },
  'worli-traffic': { x: 4.7, z: -26, yaw: .2 }, 'dadar-traffic': { x: 4.7, z: -34, yaw: .2 },
  'bkc-boulevard': { x: -4.6, z: 16, yaw: -.16 }, 'bkc-plaza': { x: 8.6, z: -26, yaw: .35 },
  'andheri-lane': { x: -4.6, z: 13, yaw: -.12 }, 'andheri-stalls': { x: 4.7, z: -20, yaw: .3 },
  'powai-lake': { x: -9, z: 4, yaw: .9 }, 'powai-towers': { x: -6, z: 14, yaw: -.35 },
  'dadar-station': { x: 4.8, z: 10, yaw: .35 }, 'dadar-maidan': { x: -8.6, z: -35, yaw: .5 }, 'dadar-chawl': { x: -4.6, z: -10, yaw: -1.2 },
  'worli-seawall': { x: -10, z: 8, yaw: .5 }, 'worli-promenade': { x: -7, z: 14, yaw: -.05 },
  'juhu-beach': { x: -16, z: 12, yaw: .5 }, 'juhu-stalls': { x: -9, z: -22, yaw: 2.2 },
  'filmcity-lot': { x: -4.6, z: 12, yaw: -.1 }, 'filmcity-shoot': { x: -5, z: -14, yaw: 1.05 }, 'filmcity-talkies': { x: -3, z: 10, yaw: -1.1 },
};
export const districtViews: Record<string, Point & { yaw: number }> = Object.fromEntries([
  ...cityZones.slice(1).map(z => [z.id, { x: z.originX + z.stop.x, z: z.stop.z, yaw: z.stop.yaw }]),
  ...Object.entries(localViews).map(([id, v]) => [id, { x: cityZones.find(z => id.startsWith(`${z.id}-`))!.originX + v.x, z: v.z, yaw: v.yaw }]),
]);
