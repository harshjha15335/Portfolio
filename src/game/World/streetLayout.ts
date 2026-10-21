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
export const PICKUP_STARTS = [52, 47, 42, 37, 32, 28];
/**
 * Routes a hailed cab can take to the kerb beside the visitor, farthest start first. The cab drives in along
 * its lane with the traffic (on Fort Road round the forecourt or the north U-turn of the loop) and pulls in
 * over the last metres, stopping at x = ±2.8 on the visitor's side. `clear(x, z)` rejects kerb spots taken by
 * parked vehicles; the stop moves along the kerb to the nearest free one. On a street's avenues the cab comes
 * up the avenue's lane the same way.
 */
export function pickupRoutes(visitor: Point, clear: (x: number, z: number) => boolean = () => true): Point[][] {
  const index = zoneIndexAt(visitor.x), ox = cityZones[index].originX, east = visitor.x - ox >= 0, fort = index === 0 && visitor.z > northEdge(0) - 2, side = east ? 1 : -1;
  const [lo, hi] = fort ? (east ? [-45, 6] : [-45, 11]) : [hasNorthAvenue(index) ? seamNorth(index) + 3 : -60, index === 0 ? northEdge(0) - 5 : SEAM_SOUTH - 3];
  let z = Math.max(lo, Math.min(hi, visitor.z));
  for (const offset of [0, 2, -2, 4, -4, 6, -6, 8, -8, 10, -10, 12, -12]) { const c = Math.max(lo, Math.min(hi, z + offset)); if (clear(ox + side * 2.8, c)) { z = c; break; } }
  const kerb = { x: side * 2.8, z }, settle = { x: side * 2.8, z: z + (east ? 1.5 : -1.5) }, entry = east ? { x: 1.75, z: z + 6 } : { x: -1.75, z: z - 6 };
  // Fort Road's avenue is reached northbound from the loop's east lane, straight over the cross street.
  const lane: Point[] = fort
    ? (east ? [{ x: -1.75, z: -51 }, { x: -1.75, z: 12 }, { x: 0, z: 14 }, { x: 1.75, z: 12 }, entry] : [{ x: 1.75, z: 12 }, { x: 1.75, z: -51 }, { x: 0, z: -54 }, { x: -1.75, z: -51 }, entry])
    : (east ? [{ x: 1.6, z: index === 0 ? -40 : entry.z + 70 }, { x: 1.6, z: entry.z }] : [{ x: -1.6, z: entry.z - 70 }, { x: -1.6, z: entry.z }]);
  return PICKUP_STARTS.map(start => shift([...tail(lane, start), settle, kerb], ox));
}
/** The usual pickup route (the second-farthest start). */
export function streetPickupRoute(visitor: Point): Point[] { return pickupRoutes(visitor)[1]; }
/**
 * The seven other districts are separate walkable streets, each laid out on the same
 * local frame as Fort Road (road along Z, pavements at |x|≈5) and placed DISTRICT_SPACING
 * metres apart on X so only one is ever drawn. They are joined end to end by avenues (below).
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

/* ------------------------------------------------------------------ the connected city */
/**
 * The districts join end to end in directory order (CST, BKC, Andheri, Powai, Dadar, Worli, Juhu, Film City).
 * Each street runs on north as an AVENUE_LENGTH-metre avenue, lined with shops and flats, into the south end of
 * the next district, so the city can be walked or driven end to end. Both districts build that avenue whole, in
 * the same frame (along it from the first district's north edge), so halfway along it, at the seam, it looks
 * the same from either side; crossing the seam moves the visitor or the cab into the next district's frame.
 */
export const AVENUE_LENGTH = 170;
/** Where a district's own blocks end and its south avenue begins (local z). */
export const SOUTH_EDGE = 21;
/** Where a street's own blocks end and its north avenue begins: past Fort Road's wider cross street at CST. */
export const northEdge = (index: number) => index === 0 ? -68 : -65;
export const SEAM_SOUTH = SOUTH_EDGE + AVENUE_LENGTH / 2;
export const seamNorth = (index: number) => northEdge(index) - AVENUE_LENGTH / 2;
/** Film City is the end of the line; CST's station is the other end. */
export const hasNorthAvenue = (index: number) => index < cityZones.length - 1;
export const hasSouthAvenue = (index: number) => index > 0;
/** How a point moves from a district's frame into the next one's across its north seam (the reverse is the negative). */
export const seamShift = (index: number) => ({ dx: DISTRICT_SPACING, dz: SEAM_SOUTH - seamNorth(index) });
/** Where (world) a point beyond one of its district's seams is in the neighbouring district, or null when it is not past one. */
export function acrossSeam(x: number, z: number): (Point & { index: number }) | null {
  const index = zoneIndexAt(x);
  if (hasNorthAvenue(index) && z < seamNorth(index)) { const s = seamShift(index); return { x: x + s.dx, z: z + s.dz, index: index + 1 }; }
  if (hasSouthAvenue(index) && z > SEAM_SOUTH) { const s = seamShift(index - 1); return { x: x - s.dx, z: z - s.dz, index: index - 1 }; }
  return null;
}
/** The district an avenue position (world) leads to, or null on a district's own street. */
export function avenueNeighbour(x: number, z: number) {
  const index = zoneIndexAt(x);
  if (hasNorthAvenue(index) && z < northEdge(index) - 4) return index + 1;
  if (hasSouthAvenue(index) && z > SOUTH_EDGE + 4) return index - 1;
  return null;
}
/** True on one of a district's avenues (local z), where traffic and the cab cruise at arterial speed. */
export const onAvenue = (index: number, z: number) => (hasNorthAvenue(index) && z < northEdge(index) - 6) || (hasSouthAvenue(index) && z > SOUTH_EDGE + 6);

/** Pull out from a kerb onto the lane heading `heading`, turning round first if the cab faces the other way (local). */
function departure(s: Point, heading: 'north' | 'south', index: number): Point[] {
  const east = s.x >= 0, lane = RIDE_LANE, p = pull(20), onStreet = s.z > northEdge(index) && s.z < SOUTH_EDGE;
  if ((east ? 'north' : 'south') === heading) return east ? [s, { x: lane, z: s.z - p }] : [s, { x: -lane, z: s.z + p }];
  if (east) {
    // Facing north: round the street's north U-turn when it lies ahead, else through a gap in the avenue's divider.
    const turn = onStreet && s.z - p > -50 ? -52 : s.z - p - 6;
    return [s, { x: lane, z: s.z - p }, { x: lane, z: turn }, { x: 0, z: turn - 2 }, { x: -lane, z: turn }];
  }
  // Facing south: Fort Road turns in the station forecourt, a district at its south U-turn, an avenue anywhere.
  if (index === 0 && onStreet) return [s, { x: -lane, z: Math.min(9, s.z + p) }, { x: -lane, z: 11 }, { x: 0, z: 14 }, { x: lane, z: 11 }];
  const turn = onStreet && s.z + p < 10 ? 12 : s.z + p + 6;
  return [s, { x: -lane, z: s.z + p }, { x: -lane, z: turn }, { x: 0, z: turn + 2 }, { x: lane, z: turn }];
}

/**
 * Route legs for a ride (world), one per district driven through. Within a district's own street a single leg.
 * Across the city the cab leaves along its lane, drives the avenues and every district between (the legs meet
 * at the seams, where the next district takes over) and arrives along the lane past the stop's kerb.
 */
export function cityRideLegs(start: Point, destination: string): Point[][] {
  const end = streetStops[destination]; if (!end) return [];
  const from = zoneIndexAt(start.x), to = zoneIndexAt(end.x), ox = cityZones[from].originX;
  const s = { x: start.x - ox, z: start.z }, e = { x: end.x - cityZones[to].originX, z: end.z };
  if (from === to && s.z > northEdge(from) && s.z < SOUTH_EDGE) return [streetRideRoute(start, destination)];
  if (from === to) {
    // From one of its avenues back to the district's own stop.
    const out = departure(s, s.z < northEdge(from) ? 'south' : 'north', from);
    return [shift([...out, ...localRoute(out[out.length - 1], e).slice(1)], ox)];
  }
  const north = to > from, lane = north ? RIDE_LANE : -RIDE_LANE, legs: Point[][] = [];
  legs.push(shift([...departure(s, north ? 'north' : 'south', from), { x: lane, z: north ? seamNorth(from) : SEAM_SOUTH }], ox));
  for (let i = north ? from + 1 : from - 1; i !== to; i += north ? 1 : -1) {
    legs.push(shift(north ? [{ x: lane, z: SEAM_SOUTH }, { x: lane, z: seamNorth(i) }] : [{ x: lane, z: seamNorth(i) }, { x: lane, z: SEAM_SOUTH }], cityZones[i].originX));
  }
  legs.push(shift(localRoute({ x: lane, z: north ? SEAM_SOUTH : seamNorth(to) }, e), cityZones[to].originX));
  return legs;
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
