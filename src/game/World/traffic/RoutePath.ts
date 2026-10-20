import type { Point } from '../transit';
import type { PathPose } from './TrafficSafety';

/**
 * An authored route (a polyline) with its corners rounded, so a vehicle on it turns instead of swinging
 * round on the spot, and with cumulative lengths, so a pose at any distance is a binary search.
 * Corners are filleted with a quadratic curve that starts `radius` (at most half of either side) before the corner.
 */
export class RoutePath {
  readonly points: Point[]; readonly length: number; private distances: number[];
  constructor(polyline: Point[], radius = 3.5) {
    const out: Point[] = polyline.length ? [polyline[0]] : [];
    for (let i = 1; i < polyline.length - 1; i++) {
      const a = polyline[i - 1], b = polyline[i], c = polyline[i + 1];
      const ab = Math.hypot(b.x - a.x, b.z - a.z), bc = Math.hypot(c.x - b.x, c.z - b.z);
      if (ab < 1e-6 || bc < 1e-6) continue;
      const r = Math.min(radius, ab / 2, bc / 2), p = { x: b.x + (a.x - b.x) * r / ab, z: b.z + (a.z - b.z) * r / ab }, q = { x: b.x + (c.x - b.x) * r / bc, z: b.z + (c.z - b.z) * r / bc };
      for (let k = 0; k <= 8; k++) { const t = k / 8, u = 1 - t; out.push({ x: u * u * p.x + 2 * u * t * b.x + t * t * q.x, z: u * u * p.z + 2 * u * t * b.z + t * t * q.z }); }
    }
    if (polyline.length > 1) out.push(polyline[polyline.length - 1]);
    // Drop repeated points (zero-length pieces have no heading).
    this.points = out.filter((p, i) => i === 0 || Math.hypot(p.x - out[i - 1].x, p.z - out[i - 1].z) > 1e-4);
    this.distances = [0]; for (let i = 1; i < this.points.length; i++) this.distances.push(this.distances[i - 1] + Math.hypot(this.points[i].x - this.points[i - 1].x, this.points[i].z - this.points[i - 1].z));
    this.length = this.distances[this.distances.length - 1] ?? 0;
  }
  /** Centre and heading `distance` m along; beyond either end it carries straight on along the end's heading. */
  at(distance: number): PathPose {
    const pts = this.points; if (pts.length < 2) return { x: pts[0]?.x ?? 0, z: pts[0]?.z ?? 0, yaw: 0 };
    let lo = 0, hi = pts.length - 1; const d = Math.max(0, Math.min(this.length, distance));
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.distances[mid] <= d) lo = mid; else hi = mid; }
    const a = pts[lo], b = pts[hi], span = this.distances[hi] - this.distances[lo] || 1, t = (d - this.distances[lo]) / span;
    const dx = (b.x - a.x) / span, dz = (b.z - a.z) / span, over = distance - d;
    return { x: a.x + (b.x - a.x) * t + dx * over, z: a.z + (b.z - a.z) * t + dz * over, yaw: Math.atan2(-dx, -dz) };
  }
}
