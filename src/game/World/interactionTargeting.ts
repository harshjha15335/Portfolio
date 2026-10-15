/**
 * Gaze-based interaction targeting. Several exhibits share one small room at Fort, so the
 * nearest target is not always the one the visitor means: the prompt follows what the
 * camera is looking at, within reach. Pure maths so it can be tested without a renderer.
 */
export interface Vec3Like { x: number; y: number; z: number }
export interface Targetable { id: string; position: Vec3Like; /** Overrides the default reach in metres. */ reach?: number }

export const DEFAULT_REACH = 3.8;
/** Within this distance a target counts even if the visitor is not facing it squarely (e.g. a guide beside you). */
export const CLOSE_RANGE = 1.5;
/** Horizontal facing required beyond close range (cosine, about 66°): the original street rule. */
export const FACING = .4;

/**
 * Picks the target the visitor is looking at. Candidates must be in reach, roughly in front
 * (horizontally) and pass `visible` (line of sight). Among those, the smallest 3D angle from the
 * camera's forward vector wins, with a small distance penalty so a near target beats one
 * directly behind it.
 */
export function pickTarget<T extends Targetable>(eye: Vec3Like, forward: Vec3Like, targets: readonly T[], visible: (target: T) => boolean = () => true): T | null {
  const fl = Math.hypot(forward.x, forward.y, forward.z) || 1, hl = Math.hypot(forward.x, forward.z) || 1;
  let best: T | null = null, bestScore = Infinity;
  for (const target of targets) {
    const dx = target.position.x - eye.x, dy = target.position.y - eye.y, dz = target.position.z - eye.z;
    const flat = Math.hypot(dx, dz), reach = target.reach ?? DEFAULT_REACH;
    if (flat >= reach) continue;
    const facing = flat > 1e-6 ? (dx * forward.x + dz * forward.z) / (flat * hl) : 1;
    if (flat >= CLOSE_RANGE && facing <= FACING) continue;
    const d = Math.hypot(dx, dy, dz) || 1e-6;
    const angle = Math.acos(Math.max(-1, Math.min(1, (dx * forward.x + dy * forward.y + dz * forward.z) / (d * fl))));
    const score = angle + flat * .06;
    if (score < bestScore && visible(target)) { best = target; bestScore = score; }
  }
  return best;
}

/** Bearing from the visitor's view to a point: -π..π (positive = to the left) and flat distance. */
export function bearing(from: { x: number; z: number }, yaw: number, to: { x: number; z: number }) {
  const dx = to.x - from.x, dz = to.z - from.z;
  // The camera looks down -Z at yaw 0, and yaw increases counter-clockwise seen from above.
  const target = Math.atan2(-dx, -dz);
  const angle = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw));
  return { angle, distance: Math.hypot(dx, dz) };
}
