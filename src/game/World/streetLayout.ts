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
function localRoute(start: Point, end: Point): Point[] {
  // A two-lane U-turn at either end. Stops remain on the pedestrian side.
  const north = -52, south = 12, lane = 1.8;
  if (end.z < start.z && end.x > 0) return [start, { x: lane, z: start.z }, { x: lane, z: end.z }, { x: 3.2, z: end.z }];
  if (end.z >= start.z && end.x < 0) return [start, { x: -lane, z: start.z }, { x: -lane, z: end.z }, { x: -3.2, z: end.z }];
  if (end.z < start.z) return [start, { x: lane, z: start.z }, { x: lane, z: north }, { x: 0, z: north - 2 }, { x: -lane, z: north }, { x: -lane, z: end.z }, { x: -3.2, z: end.z }];
  return [start, { x: -lane, z: start.z }, { x: -lane, z: south }, { x: 0, z: south + 2 }, { x: lane, z: south }, { x: lane, z: end.z }, { x: 3.2, z: end.z }];
}
export function walkingVelocity(forward: number, strafe: number, yaw: number, speed: number): Point {
  const length = Math.max(1, Math.hypot(forward, strafe));
  return { x: (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * speed / length, z: (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * speed / length };
}


/** Pickup stays clear of the station frontage, including the full vehicle length. */
export function streetPickupRoute(visitor:Point):Point[] {
  const ox=Math.round(visitor.x/600)*600,x=ox+(visitor.x-ox<0?-2.8:2.8),z=Math.max(-49,Math.min(11,visitor.z));
  return [{x,z:z+(z>6?-8:8)},{x,z}];
}

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
  // Leave by the nearer end of the road, on the visitor's side, as a real cab would.
  const north = s.z < -18, lane = north ? 1.8 : -1.8;
  const exit = north ? [s, { x: lane, z: s.z - 1 }, { x: lane, z: -57 }] : [s, { x: lane, z: s.z + 1 }, { x: lane, z: 17 }];
  const kerb = e.x < 0 ? -1.8 : 1.8;
  const arrival = [{ x: kerb, z: 24 }, { x: kerb, z: e.z + 7 }, { x: e.x < 0 ? -3.2 : 3.2, z: e.z }];
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
