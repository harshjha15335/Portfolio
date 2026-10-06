import type { Point } from './transit';

/** One authored street, not a generated nine-district map. Metres at human scale. */
export const STREET_SPAWN = { x: 4.6, z: 11.5, yaw: 0.14 };
export const streetStops: Record<string, Point & { yaw: number }> = {
  cst: { x: 4.6, z: 11.5, yaw: 0.14 },
  fort: { x: -5.1, z: -35, yaw: Math.PI / 2 },
};
export const streetStand = { taxi: { x: 2.1, z: 5 }, auto: { x: -2.1, z: 5 } };
export function streetRideRoute(start: Point, destination: string): Point[] {
  const end = streetStops[destination];
  if (!end) return [];
  // A two-lane U-turn at either end. Stops remain on the pedestrian side.
  const north = -52, south = 12, lane = 1.8;
  if (destination === 'fort') return [start, { x: lane, z: start.z }, { x: lane, z: north }, { x: 0, z: north - 2 }, { x: -lane, z: north }, { x: -lane, z: end.z }, { x: -3.2, z: end.z }];
  return [start, { x: -lane, z: start.z }, { x: -lane, z: south }, { x: 0, z: south + 2 }, { x: lane, z: south }, { x: lane, z: end.z }, { x: 3.2, z: end.z }];
}
export function walkingVelocity(forward: number, strafe: number, yaw: number, speed: number): Point {
  const length = Math.max(1, Math.hypot(forward, strafe));
  return { x: (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * speed / length, z: (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * speed / length };
}


/** Pickup stays clear of the station frontage, including the full vehicle length. */
export function streetPickupRoute(visitor:Point):Point[] {
  const x=visitor.x<0?-2.8:2.8,z=Math.max(-49,Math.min(11,visitor.z));
  return [{x,z:z+(z>6?-8:8)},{x,z}];
}
