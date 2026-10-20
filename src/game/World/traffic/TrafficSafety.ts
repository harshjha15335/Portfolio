/**
 * Collision safety for the kinematic traffic. Vehicles follow authored lane curves (they are not rigid bodies);
 * this module gives each one an oriented collision envelope and the queries a driver needs: how far it can go
 * along its path before touching anything, and whether a proposed move would put it inside another envelope.
 *
 * Frame of reference is the district's local x/z plane. Heading follows the scene convention: `yaw` is
 * `rotation.y` and forward is −Z rotated by it, i.e. (−sin yaw, −cos yaw).
 */

/** Everything the traffic must keep clear of. People are round; vehicles are boxes. */
export type EnvelopeCategory = 'vehicle' | 'ride' | 'parked' | 'person' | 'visitor';

export interface Envelope {
  /** Unique within one TrafficSpace. */
  id: string;
  x: number; z: number; yaw: number;
  /** Half extents along the heading and across it (the radius twice for a person). */
  halfLength: number; halfWidth: number;
  category: EnvelopeCategory;
  /** Speed along the heading (m/s), for following. */
  speed: number;
  /** The movement this envelope belongs to (a lane or a route); vehicles on one movement never conflict at a junction. */
  movement?: string;
}

/** Body sizes (m) of every traffic class, measured from the built meshes without mirrors (tests/traffic-safety.test.ts). */
export type VehicleClass = 'bus' | 'hatch' | 'sedan' | 'suv' | 'taxi' | 'auto' | 'bike' | 'tempo' | 'cart' | 'cycle';
export const VEHICLE_BODY: Record<VehicleClass, { length: number; width: number }> = {
  bus: { length: 11.0, width: 2.55 }, hatch: { length: 3.7, width: 1.75 }, sedan: { length: 4.4, width: 1.8 }, suv: { length: 4.6, width: 1.95 },
  taxi: { length: 4.1, width: 1.75 }, auto: { length: 2.7, width: 1.45 }, bike: { length: 2.0, width: .65 }, tempo: { length: 5.6, width: 2.0 },
  cart: { length: 2.2, width: 1.3 }, cycle: { length: 1.8, width: .6 },
};

/**
 * How each class drives. `accel` and `brake` are the comfortable rates (m/s²), `maxBrake` the emergency limit,
 * `headway` the time gap kept to the vehicle in front (s) and `minGap` the bumper gap left when stopped (m).
 * A bus is slow to pull away and brakes early; an auto darts off and closes up tight.
 */
export interface DriveProfile { accel: number; brake: number; maxBrake: number; headway: number; minGap: number }
export const DRIVE_PROFILE: Record<VehicleClass, DriveProfile> = {
  bus: { accel: .9, brake: 1.6, maxBrake: 4.5, headway: 1.8, minGap: 2.6 },
  tempo: { accel: 1.0, brake: 1.8, maxBrake: 5, headway: 1.6, minGap: 2.2 },
  sedan: { accel: 1.6, brake: 2.4, maxBrake: 7, headway: 1.2, minGap: 1.8 },
  hatch: { accel: 1.7, brake: 2.4, maxBrake: 7, headway: 1.1, minGap: 1.6 },
  suv: { accel: 1.5, brake: 2.3, maxBrake: 6.5, headway: 1.3, minGap: 2.0 },
  taxi: { accel: 1.3, brake: 2.0, maxBrake: 6.5, headway: 1.3, minGap: 1.8 },
  auto: { accel: 1.8, brake: 2.6, maxBrake: 6, headway: .9, minGap: 1.2 },
  bike: { accel: 2.2, brake: 3.0, maxBrake: 7, headway: .8, minGap: 1.0 },
  cycle: { accel: .8, brake: 1.8, maxBrake: 4, headway: 1.0, minGap: 1.0 },
  cart: { accel: .5, brake: 1.5, maxBrake: 3, headway: 1.2, minGap: 1.0 },
};

/**
 * True on a street's carriageway (local frame): between the kerbs of the main road (|x| < 4) or on Fort Road's
 * cross street (z ≈ −62). Someone on the pavement never stops the traffic; someone on the road does.
 */
export const onCarriageway = (x: number, z: number) => Math.abs(x) < 4 || Math.abs(z + 62) < 4.6;
/** Lateral slack (m) on each side when testing a vehicle's path: enough that passing in the next lane never brakes, and no more. */
export const LATERAL_MARGIN = .12;
/** Room (m) a driver leaves in front of a person in its path, and beside one it passes (someone at the kerb edge). */
export const PERSON_ROOM = 1.1, PERSON_SIDE_ROOM = .45;
/** The room `probe` leaves round person `e`: the full room when they are ahead within its width, the side room otherwise. */
function personRoom(probe: Envelope, e: Envelope) {
  const s = Math.sin(probe.yaw), c = Math.cos(probe.yaw), dx = e.x - probe.x, dz = e.z - probe.z;
  const along = -dx * s - dz * c, lateral = Math.abs(dx * c - dz * s) - Math.max(e.halfWidth, e.halfLength);
  return along > probe.halfLength && lateral < probe.halfWidth + PERSON_SIDE_ROOM ? PERSON_ROOM : PERSON_SIDE_ROOM;
}

/** Sine and cosine of an envelope's heading, cached on it until the heading changes (queries reuse them dozens of times). */
type Trig = Envelope & { _yaw?: number; _s?: number; _c?: number };
const trig = (e: Trig) => { if (e._yaw !== e.yaw) { e._yaw = e.yaw; e._s = Math.sin(e.yaw); e._c = Math.cos(e.yaw); } return e as Required<Trig>; };
const radiusOn = (e: Envelope, nx: number, nz: number) => {
  if (e.category === 'person' || e.category === 'visitor') return e.halfWidth;
  const t = trig(e); return e.halfLength * Math.abs(-t._s * nx - t._c * nz) + e.halfWidth * Math.abs(-t._c * nx + t._s * nz);
};

/**
 * Signed clearance between two envelopes (m): positive is the gap along the best separating axis, negative the
 * depth of the overlap. Separating-axis test on the boxes' own axes, plus the centre line for a round envelope.
 */
export function separation(a: Envelope, b: Envelope) {
  const dx = b.x - a.x, dz = b.z - a.z; let best = -Infinity;
  const test = (nx: number, nz: number) => { const gap = Math.abs(dx * nx + dz * nz) - radiusOn(a, nx, nz) - radiusOn(b, nx, nz); if (gap > best) best = gap; };
  const round = (e: Envelope) => e.category === 'person' || e.category === 'visitor';
  if (!round(a)) { const t = trig(a); test(-t._s, -t._c); test(-t._c, t._s); }
  if (!round(b)) { const t = trig(b); test(-t._s, -t._c); test(-t._c, t._s); }
  const d = Math.sqrt(dx * dx + dz * dz); if (d > 1e-6 && (round(a) || round(b))) test(dx / d, dz / d);
  return best;
}
export const overlaps = (a: Envelope, b: Envelope, margin = 0) => separation(a, b) < margin;
/** Radius of the circle that holds the envelope (the broad phase). */
export const reach = (e: Envelope) => Math.sqrt(e.halfLength * e.halfLength + e.halfWidth * e.halfWidth);

/** Distance (m) a vehicle at `speed` needs to stop at its comfortable rate. */
export const stoppingDistance = (speed: number, profile: DriveProfile) => speed * speed / (2 * profile.brake);

/**
 * Car-following acceleration (the Intelligent Driver Model): approaches `desired` speed in free road, and in
 * traffic keeps `minGap + speed × headway` to the vehicle ahead, braking harder the faster the gap is closing.
 * It never asks for more than the class's emergency braking.
 */
export function followAcceleration(speed: number, desired: number, gap: number, leadSpeed: number, p: DriveProfile) {
  const free = desired > .01 ? 1 - Math.pow(speed / desired, 4) : -1;
  if (!(gap < Infinity)) return Math.max(-p.maxBrake, p.accel * free);
  const wanted = p.minGap + Math.max(0, speed * p.headway + speed * (speed - leadSpeed) / (2 * Math.sqrt(p.accel * p.brake)));
  const g = Math.max(gap, .05);
  return Math.max(-p.maxBrake, Math.min(p.accel, p.accel * (free - (wanted / g) ** 2)));
}

/**
 * The vehicles, people and parked cars on one stretch of road this frame. Each traffic system writes its
 * vehicles in, moves them one at a time and updates their envelopes in place, so the next vehicle sees where
 * the last one went. A few dozen entries, so the broad phase is a bounding-circle test.
 */
export class TrafficSpace {
  readonly entries: Envelope[] = [];
  /** The drivers behind the vehicle envelopes, by envelope id (for the mutual-wait rule). */
  readonly drivers = new Map<string, Driver>();
  private byId = new Map<string, Envelope>();
  add(e: Envelope) { const old = this.byId.get(e.id); if (old) Object.assign(old, e); else { this.entries.push(e); this.byId.set(e.id, e); } return this.byId.get(e.id)!; }
  get(id: string) { return this.byId.get(id); }
  /** Enter a driven vehicle; its envelope object is shared, so the driver's moves show up at once. */
  addDriver(d: Driver) { this.remove(d.env.id); this.entries.push(d.env); this.byId.set(d.env.id, d.env); this.drivers.set(d.env.id, d); return d; }
  remove(id: string) { const e = this.byId.get(id); this.drivers.delete(id); if (!e) return; this.byId.delete(id); this.entries.splice(this.entries.indexOf(e), 1); }
  clear() { this.entries.length = 0; this.byId.clear(); this.drivers.clear(); }
  /**
   * The first envelope `probe` would overlap (with `margin`; people get PERSON_ROOM ahead, PERSON_SIDE_ROOM beside), skipping `self`. With
   * `from` (where the vehicle is now), only envelopes the move brings it closer to count: a vehicle is never held
   * by one it is pulling away from, so two that already touch can always separate. Without `from` every overlap counts.
   */
  hit(probe: Envelope, self: string, margin = 0, ignore?: (e: Envelope) => boolean, among: readonly Envelope[] = this.entries, from?: Envelope): Envelope | null {
    const r = reach(probe) + margin;
    for (const e of among) {
      if (e.id === self || ignore?.(e)) continue;
      const dx = e.x - probe.x, dz = e.z - probe.z, person = e.category === 'person' || e.category === 'visitor';
      if (dx * dx + dz * dz > (r + reach(e) + (person ? PERSON_ROOM : margin)) ** 2) continue;
      const room = person ? personRoom(probe, e) : margin;
      const gap = separation(probe, e); if (gap >= room) continue;
      if (from && gap >= separation(from, e) - 1e-4) continue;
      return e;
    }
    return null;
  }
  /** Envelopes within `radius` of a point (the broad phase for a whole path query). */
  near(x: number, z: number, radius: number, self: string) {
    const out: Envelope[] = [];
    for (const e of this.entries) if (e.id !== self) { const r = radius + reach(e) + PERSON_ROOM; if ((e.x - x) ** 2 + (e.z - z) ** 2 <= r * r) out.push(e); }
    return out;
  }
  /**
   * How far (m) a vehicle can travel along its path before its envelope would touch something, up to `range`.
   * `poseAt(d)` gives the envelope's centre and heading `d` metres ahead. Returns the free distance and what is
   * in the way (null when the path is clear to `range`).
   */
  clearance(self: Envelope, poseAt: (d: number) => { x: number; z: number; yaw: number }, range: number, step = .6, ignore?: (e: Envelope) => boolean) {
    const probe: Envelope = { ...self }, among = this.near(self.x, self.z, range + reach(self) + LATERAL_MARGIN, self.id);
    if (!among.length) return { free: range, blocker: null as Envelope | null };
    // Coarse pass with the probe stretched to cover the whole coarse step, then the fine steps of the first stretch that touches.
    const coarse = step * 3, long: Envelope = { ...self, halfLength: self.halfLength + coarse / 2 };
    for (let c = 0; c < range; c += coarse) {
      const mid = Math.min(range, c + coarse / 2) , p = poseAt(mid); long.x = p.x; long.z = p.z; long.yaw = p.yaw;
      if (!this.hit(long, self.id, LATERAL_MARGIN, ignore, among, self)) continue;
      for (let d = Math.max(step, c - step); d <= Math.min(range, c + coarse) + 1e-6; d += step) {
        const q = poseAt(d); probe.x = q.x; probe.z = q.z; probe.yaw = q.yaw;
        const blocker = this.hit(probe, self.id, LATERAL_MARGIN, ignore, among, self);
        if (blocker) return { free: Math.max(0, d - step), blocker };
      }
    }
    return { free: range, blocker: null as Envelope | null };
  }
}

/**
 * The longest part of a proposed move `ds` (m) that keeps the vehicle out of every envelope ahead of it,
 * checked at sub-steps no longer than `step`, so a fast vehicle or a long frame cannot jump through another.
 */
export function safeAdvance(space: TrafficSpace, self: Envelope, poseAt: (d: number) => { x: number; z: number; yaw: number }, ds: number, step = .25, ignore?: (e: Envelope) => boolean) {
  if (ds <= 0) return 0;
  const probe: Envelope = { ...self }, n = Math.max(1, Math.ceil(ds / step)), among = space.near(self.x, self.z, ds + reach(self), self.id);
  if (!among.length) return ds;
  for (let i = 1; i <= n; i++) {
    const d = ds * i / n, p = poseAt(d); probe.x = p.x; probe.z = p.z; probe.yaw = p.yaw;
    if (space.hit(probe, self.id, 0, ignore, among, self)) return ds * (i - 1) / n;
  }
  return ds;
}

/** Where along a vehicle's life it is, for diagnostics and tests. */
export type DriveState = 'inactive' | 'spawning' | 'cruising' | 'following' | 'stopping' | 'stopped' | 'waiting-signal' | 'yielding' | 'exiting';

/** Why a vehicle may or may not enter the road at a lane start. */
export type SpawnDecision = 'approved' | 'blocked-occupied' | 'blocked-player' | 'blocked-pedestrian' | 'blocked-ride' | 'blocked-visible' | 'blocked-recently-visible';

/** What the visitor can see: eye position (local), view direction and the half-angle of the view cone. */
export interface ViewCone { x: number; z: number; fx: number; fz: number; halfAngle: number; range: number }

/** True when a point (with a radius) lies inside the view cone and within range. Occlusion is the caller's. */
export function inView(view: ViewCone, x: number, z: number, radius = 0) {
  const dx = x - view.x, dz = z - view.z, d = Math.hypot(dx, dz);
  if (d - radius > view.range) return false; if (d <= radius + 1) return true;
  const cos = (dx * view.fx + dz * view.fz) / d, spread = Math.asin(Math.min(1, radius / d));
  return cos >= Math.cos(Math.min(Math.PI, view.halfAngle + spread));
}

/** A pose along a path: centre and heading. */
export interface PathPose { x: number; z: number; yaw: number }

/**
 * Areas where movements cross (a U-turn across the other lane, a cab pulling out). A vehicle about to enter
 * one must hold it; vehicles on the same movement (one lane's stream) share it, others wait at its edge.
 * A movement that has been waiting longer than FAIR_WAIT stops new entries from the holders' stream so the
 * area drains and the waiting vehicle gets its turn, and a holder that stands still for STALE_HOLD seconds
 * loses its hold (it stays where it is; the envelopes still keep everyone out of it).
 */
export interface ConflictZone { id: string; minX: number; maxX: number; minZ: number; maxZ: number }
const FAIR_WAIT = 4, STALE_HOLD = 15;
export class JunctionReservations {
  private holds = new Map<string, Map<string, { movement: string; since: number; moved: number }>>();
  private waits = new Map<string, Map<string, { movement: string; since: number }>>();
  /** `conflicts(a, b)` says whether two movements may not share a zone (by default, any two different ones). */
  constructor(readonly zones: ConflictZone[], readonly conflicts: (a: string, b: string) => boolean = (a, b) => a !== b) { for (const z of zones) { this.holds.set(z.id, new Map()); this.waits.set(z.id, new Map()); } }
  static inside(zone: ConflictZone, x: number, z: number) { return x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ; }
  /** May vehicle `id` on `movement` enter `zone` at `time`? Records the hold or the wait. */
  request(zone: string, id: string, movement: string, time: number) {
    const holds = this.holds.get(zone)!, waits = this.waits.get(zone)!;
    if (holds.has(id)) return true;
    for (const [, h] of holds) if (this.conflicts(h.movement, movement)) { if (!waits.has(id)) waits.set(id, { movement, since: time }); return false; }
    // Fairness, first come, first served among movements that conflict: nobody overtakes a longer wait (so two waits never block each other).
    const mine = waits.get(id)?.since ?? time;
    for (const [other, w] of waits) if (other !== id && this.conflicts(w.movement, movement) && w.since < mine && time - w.since > FAIR_WAIT) { if (!waits.has(id)) waits.set(id, { movement, since: time }); return false; }
    waits.delete(id); holds.set(id, { movement, since: time, moved: time }); return true;
  }
  /** Keep a holder's record current; `keep` false (neither in the zone nor heading into it) releases it. */
  update(zone: string, id: string, keep: boolean, moving: boolean, time: number) {
    const holds = this.holds.get(zone)!, h = holds.get(id); if (!h) { if (!keep) this.waits.get(zone)!.delete(id); return; }
    if (!keep) { holds.delete(id); return; }
    if (moving) h.moved = time;
  }
  /** Release holds whose vehicles stood still too long (deadlock recovery) and forget vehicles that left. */
  sweep(time: number, alive: (id: string) => boolean) {
    for (const [, holds] of this.holds) for (const [id, h] of holds) if (!alive(id) || time - h.moved > STALE_HOLD) holds.delete(id);
    for (const [, waits] of this.waits) for (const [id] of waits) if (!alive(id)) waits.delete(id);
  }
  holders(zone: string) { return [...this.holds.get(zone)!.keys()]; }
  /** Who is waiting for `zone` and since when (diagnostics). */
  waiting(zone: string) { return [...this.waits.get(zone)!.entries()].map(([id, w]) => ({ id, ...w })); }
  /** Forget a vehicle entirely (it left the road or was reused). */
  forget(id: string) { for (const [, h] of this.holds) h.delete(id); for (const [, w] of this.waits) w.delete(id); }
}

/** A vehicle the safety layer drives: its envelope, speed and how it drives. */
export interface Driver {
  env: Envelope; speed: number; profile: DriveProfile; desired: number; state: DriveState;
  /** Higher drives on when two vehicles wait for each other (the passenger ride, then buses). */
  priority: number;
  /** What stopped it last step, for the mutual-wait rule and diagnostics. */
  blockedBy: string | null;
  /** Moves the safety layer refused or cut short (a would-be overlap prevented). */
  interventions: number;
}
/** A stop the driver must respect ahead on its path: distance to it (m) and why. */
export interface Hold { distance: number; state: DriveState }

/**
 * Keep the crossing clear: whether `d`, `toLine` m from its stop line, should wait there because slow traffic ahead
 * leaves no room for its whole body beyond a crossing `span` m deep (it would stop on the zebra).
 */
export function exitBlocked(space: TrafficSpace, d: Driver, poseAt: (distance: number) => PathPose, toLine: number, span: number) {
  const need = toLine + span + 2 * d.env.halfLength + d.profile.minGap;
  const { free, blocker } = space.clearance(d.env, poseAt, need, .6, e => e.category === 'person' || e.category === 'visitor');
  return !!blocker && free < need && blocker.speed < 2;
}
/**
 * One step of collision-safe driving along a path. Finds what is ahead (vehicles, people, the visitor, a stop line,
 * a junction it may not enter), picks an acceleration with the car-following model, then commits only the part
 * of the move that the swept check allows. Returns the distance advanced; the caller moves its model by it and
 * the driver's envelope is left at the new pose.
 */
export function drive(space: TrafficSpace, d: Driver, poseAt: (distance: number) => PathPose, dt: number, holds: Hold[] = [], ignore?: (e: Envelope) => boolean,
  junctions?: { reservations: JunctionReservations; time: number }) {
  if (dt <= 0) return 0;
  const p = d.profile, range = Math.max(14, stoppingDistance(d.speed, p) + p.minGap + d.speed * p.headway + 6);
  // A vehicle that is itself waiting for us does not hold us up if we have priority (the mutual-wait rule).
  const yieldsTo = (e: Envelope) => ignore?.(e) || (space.drivers.get(e.id)?.blockedBy === d.env.id && rank(space.drivers.get(e.id)!) < rank(d));
  const ahead = space.clearance(d.env, poseAt, range, .6, yieldsTo);
  // `gap` feeds the car-following model; `limit` is the hard end of this step's travel. Behind a vehicle they are
  // the same (the model keeps its own minimum gap); at a line the model aims minGap past it so it stops on it.
  let gap = ahead.free, limit = ahead.free, lead = 0, state: DriveState = 'cruising';
  if (ahead.blocker) {
    const b = ahead.blocker, rel = Math.cos(b.yaw - d.env.yaw);
    lead = b.category === 'person' || b.category === 'visitor' ? 0 : Math.max(0, b.speed * rel);
    state = b.category === 'person' || b.category === 'visitor' ? 'yielding' : 'following';
  }
  const line = (distance: number, why: DriveState) => { const at = Math.max(0, distance); if (at < limit) { limit = at; gap = at + p.minGap; lead = 0; state = why; } };
  for (const h of holds) line(h.distance, h.state);
  if (junctions) {
    const { reservations, time } = junctions;
    for (const zone of reservations.zones) {
      const inside = zoneTouched(zone, d.env); let reach = -1;
      if (!inside) for (let s = .6; s <= range; s += .6) { const q = poseAt(s + d.env.halfLength); if (JunctionReservations.inside(zone, q.x, q.z)) { reach = s - .6; break; } }
      if (!inside && reach < 0) continue;
      // Only a vehicle with a clear road up to the area asks for it: one queued behind another must not hold it
      // (the one in front may be waiting for the very same area).
      if (!inside && ahead.free < reach) { reservations.update(zone.id, d.env.id, false, false, time); continue; }
      const granted = reservations.request(zone.id, d.env.id, d.env.movement ?? d.env.id, time);
      if (!granted && !inside) line(reach, 'yielding');
    }
  }
  d.blockedBy = ahead.blocker && limit === ahead.free && ahead.free < range ? ahead.blocker.id : null;
  // Integrate in sub-steps of at most 1/30 s so a long frame brakes as a short one would.
  const n = Math.max(1, Math.ceil(dt / (1 / 30))), h = dt / n; let travelled = 0;
  for (let i = 0; i < n; i++) {
    const a = followAcceleration(d.speed, d.desired, gap - travelled, lead, p);
    d.speed = Math.max(0, d.speed + a * h);
    // Never past the hard limit (a stop line, a junction it may not enter, a vehicle that has not moved).
    let step = Math.min(d.speed * h, Math.max(0, limit - travelled));
    if (step < d.speed * h) d.speed = step / h;
    // The swept check ignores nobody the caller did not exclude: priority only changes who plans to go first.
    const start = travelled, safe = safeAdvance(space, d.env, s => poseAt(start + s), step, .25, ignore);
    if (safe < step - 1e-6) { d.interventions++; step = safe; d.speed = Math.min(d.speed, lead); }
    travelled += step;
  }
  if (travelled > 0) { const q = poseAt(travelled); d.env.x = q.x; d.env.z = q.z; d.env.yaw = q.yaw; }
  d.env.speed = d.speed;
  if (junctions) for (const zone of junctions.reservations.zones) junctions.reservations.update(zone.id, d.env.id, zoneTouched(zone, d.env) || approaching(zone, poseAt, travelled, Math.min(range, ahead.free - travelled), d.env.halfLength), travelled > 1e-3, junctions.time);
  d.state = d.speed < .05 ? (state === 'cruising' ? 'stopped' : state === 'following' ? 'stopped' : state) : d.speed < d.desired * .5 && state !== 'cruising' ? (state === 'following' ? 'following' : 'stopping') : state;
  return travelled;
}
const approaching = (zone: ConflictZone, poseAt: (distance: number) => PathPose, from: number, range: number, half: number) => { for (let s = .6; s <= range; s += .6) { const q = poseAt(from + s + half); if (JunctionReservations.inside(zone, q.x, q.z)) return true; } return false; };
const rank = (d: Driver) => d.priority * 1e6 - hash(d.env.id);
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 999983; return h; }
/** True while any part of the envelope's footprint (its corners or centre) is inside the zone. */
export function zoneTouched(zone: ConflictZone, e: Envelope) {
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), rx = -fz, rz = fx;
  for (const [l, w] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) if (JunctionReservations.inside(zone, e.x + fx * e.halfLength * l + rx * e.halfWidth * w, e.z + fz * e.halfLength * l + rz * e.halfWidth * w)) return true;
  return false;
}
