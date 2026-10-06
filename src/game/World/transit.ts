export type TransitKind = 'taxi' | 'auto';
export type Point = { x: number; z: number };
export interface RideStatus {
  phase: 'idle' | 'hailing' | 'boarding' | 'riding' | 'arrived'; kind: TransitKind;
  destination: string | null; elapsed: number; distance: number; fare: number; progress: number;
}
export const idleRide = (): RideStatus => ({ phase: 'idle', kind: 'taxi', destination: null, elapsed: 0, distance: 0, fare: 0, progress: 0 });
export const TRANSIT_RADIUS = 21;
export const ringPoint = (angle: number, radius = TRANSIT_RADIUS): Point => ({ x: Math.sin(angle) * radius, z: Math.cos(angle) * radius });
export function arrivalPoint(position: [number, number, number]): Point {
  const radius = Math.hypot(position[0], position[2]);
  return radius ? { x: position[0] * (radius - 12) / radius, z: position[2] * (radius - 12) / radius } : { x: 0, z: -10 };
}
/** Short radial connections and a sampled lane keep rides out of district buildings. */
export function transitRoute(start: Point, end: Point): Point[] {
  const a = Math.atan2(start.x, start.z), b = Math.atan2(end.x, end.z);
  const turn = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const steps = Math.max(1, Math.ceil(Math.abs(turn) / 0.06));
  return [start, ringPoint(a), ...Array.from({ length: steps }, (_, i) => ringPoint(a + turn * (i + 1) / steps)), end];
}
export const routeLength = (points: Point[]) => points.slice(1).reduce((length, point, i) => length + Math.hypot(point.x - points[i].x, point.z - points[i].z), 0);
export function pointAtDistance(points: Point[], distance: number): Point & { heading: number } {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
    if (distance <= length || i === points.length - 1) {
      const t = length ? Math.max(0, Math.min(1, distance / length)) : 0;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(a.x - b.x, a.z - b.z) };
    }
    distance -= length;
  }
  return { ...points[0], heading: 0 };
}
export const storyFare = (kind: TransitKind, distance: number) => (kind === 'taxi' ? 28 : 23) + distance * (kind === 'taxi' ? 0.48 : 0.36);
