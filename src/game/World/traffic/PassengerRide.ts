import type { Point, TransitKind } from '../transit';
import { crossingHeld } from './RoadTraffic';
import { RoutePath } from './RoutePath';
import {
  DRIVE_PROFILE, TrafficSpace, drive, inView, type ConflictZone, type Driver, type Envelope, type Hold, type JunctionReservations, type PathPose, type ViewCone,
} from './TrafficSafety';

/**
 * Where the cab's U-turns cross the other lane (local): Fort Road's north turn and forecourt turn, which the
 * loop's taxis use too, and the same two places on every district street. Only the cab conflicts with traffic there.
 */
export const FORT_JUNCTIONS: ConflictZone[] = [{ id: 'north-turn', minX: -3.9, maxX: 3.9, minZ: -57.2, maxZ: -48 }, { id: 'forecourt-turn', minX: -3.9, maxX: 3.9, minZ: 8.5, maxZ: 16.5 }];
export const DISTRICT_JUNCTIONS: ConflictZone[] = [{ id: 'north-turn', minX: -3.9, maxX: 3.9, minZ: -56, maxZ: -48 }, { id: 'south-turn', minX: -3.9, maxX: 3.9, minZ: 8, maxZ: 16 }];
/** Cruising speed (m/s) of the boarded cab: an auto a little slower than a taxi. */
export const RIDE_SPEED: Record<TransitKind, number> = { taxi: 5.2, auto: 4.2 };
/** The boarded cab's body (the passenger models, without mirrors). */
export const RIDE_BODY: Record<TransitKind, { length: number; width: number }> = { taxi: { length: 3.9, width: 1.8 }, auto: { length: 2.5, width: 1.45 } };
/** Every street's zebra lies across the road at this local z; the ride stops this far either side of its centre while it is held. */
export const ZEBRA_Z = -12, ZEBRA_HOLD = 3.0;
/** How long (s) a hailed cab waits for an unseen, clear place to start before it accepts the farthest clear one in view. */
export const DISPATCH_PATIENCE = 2.5;
/** A hailed cab never starts nearer the visitor than this (m). */
export const DISPATCH_MIN_DISTANCE = 24;

/** Kerb room a stop needs (m): ahead to pull out again, and behind to pull in from the lane (the pickup route leaves it 6 m back). */
export const PULL_OUT_ROOM = 6, PULL_IN_ROOM = 6;
/**
 * Whether a cab of `kind` can stop at the kerb at (`x`, `z`) (local) clear of the `parked` vehicles, with room
 * PULL_IN_ROOM behind to pull in and PULL_OUT_ROOM ahead to pull out again (east kerb faces north, west kerb south).
 */
export function kerbRoom(parked: readonly Envelope[], x: number, z: number, kind: TransitKind) {
  const body = RIDE_BODY[kind], ahead = x >= 0 ? -1 : 1, back = PULL_IN_ROOM, front = PULL_OUT_ROOM;
  const probe: Envelope = { id: 'probe', x, z: z + ahead * (front - back) / 2, yaw: 0, halfLength: body.length / 2 + (front + back) / 2, halfWidth: body.width / 2, category: 'ride', speed: 0 };
  const space = new TrafficSpace(); for (const e of parked) space.add(e);
  return !space.hit(probe, 'probe', .2);
}

export type RideStage = 'idle' | 'dispatching' | 'approaching' | 'waiting' | 'riding' | 'arrived';
export type RideEvent = 'none' | 'dispatched' | 'pulled-up' | 'cut' | 'arrived';

/** What the ride needs from the street it is on this frame. */
export interface RideContext {
  space: TrafficSpace;
  /** World x of the current district's origin (the space is in its local frame). */
  originX: number;
  time: number;
  junctions?: JunctionReservations;
  /** What the visitor sees (local), for choosing where a hailed cab starts. */
  view?: ViewCone;
}

/**
 * The taxi or auto the visitor hails and rides. It is a vehicle in the traffic like any other: it starts
 * out of sight up the lane, drives in with the traffic, stops behind vehicles and for people, waits at the
 * zebra while it is held and for its turn at a U-turn, and never moves into another envelope.
 * Positions here are world coordinates; the traffic space is the current district's local frame.
 */
export class PassengerRide {
  stage: RideStage = 'idle'; kind: TransitKind = 'taxi';
  readonly driver: Driver;
  /** Route legs (world); a cross-district ride has an exit leg and an arrival leg with a cut between. */
  private legs: RoutePath[] = []; private leg = 0; private s = 0;
  private candidates: RoutePath[] = []; private dispatchFor = 0;
  /** Where the cab is (world) and which way it faces. */
  readonly pose: PathPose = { x: 0, z: 0, yaw: 0 };
  /** Distance (m) driven on the trip legs so far (the road actually covered, without the cut between districts). */
  driven = 0;
  /** Virtual distance (m) the cut between districts stands for; set by the caller. */
  hop = 0;
  /** City metres each metre driven stands for in the chargeable distance (the streets are a miniature). */
  distanceScale = 1;
  /** Seconds the ride has stood still while riding (waiting in traffic or at the zebra). */
  waited = 0;
  constructor() {
    this.driver = { env: { id: 'ride', x: 0, z: 0, yaw: 0, halfLength: RIDE_BODY.taxi.length / 2, halfWidth: RIDE_BODY.taxi.width / 2, category: 'ride', speed: 0, movement: 'ride' }, speed: 0, profile: DRIVE_PROFILE.taxi, desired: RIDE_SPEED.taxi, state: 'inactive', priority: 3, blockedBy: null, interventions: 0 };
  }
  get speed() { return this.driver.speed; }
  get active() { return this.stage !== 'idle' && this.stage !== 'dispatching'; }
  /** Total chargeable length of the current trip (legs plus the cut). */
  get tripLength() { return this.stage === 'riding' || this.stage === 'arrived' ? this.legs.reduce((t, l) => t + l.length, 0) * this.distanceScale + this.hop : 0; }
  /**
   * Chargeable distance so far: the road driven, plus the cut's virtual distance released in step with progress
   * along the arrival road, so the meter never jumps at the cut and reaches the whole trip on arrival.
   */
  get chargeable() {
    const road = this.driven * this.distanceScale;
    if (this.stage === 'arrived') return road + this.hop;
    if (this.stage !== 'riding' || this.leg === 0) return road;
    const arrival = this.legs[this.leg].length; return road + this.hop * (arrival > 0 ? Math.min(1, this.s / arrival) : 1);
  }
  get path() { return this.legs[this.leg]; }
  /** Distance (m) left to the end of the current leg. */
  get remaining() { return this.legs[this.leg] ? this.legs[this.leg].length - this.s : 0; }
  private setKind(kind: TransitKind) {
    this.kind = kind; const body = RIDE_BODY[kind], d = this.driver;
    d.env.halfLength = body.length / 2; d.env.halfWidth = body.width / 2; d.profile = DRIVE_PROFILE[kind]; d.desired = RIDE_SPEED[kind];
  }
  private reset() { const d = this.driver; d.speed = 0; d.env.speed = 0; d.state = 'inactive'; d.blockedBy = null; this.legs = []; this.leg = 0; this.s = 0; this.driven = 0; this.hop = 0; this.waited = 0; this.candidates = []; this.dispatchFor = 0; }
  /** Hail a cab: it will start at the first of `routes` (pickup routes, farthest start first) that is clear and out of sight. */
  hail(kind: TransitKind, routes: Point[][]) { this.reset(); this.setKind(kind); this.stage = 'dispatching'; this.candidates = routes.map(r => new RoutePath(r)); }
  /** The cab is already at the kerb (reduced motion, or a direct board): it waits there. */
  standAt(kind: TransitKind, route: Point[]) { this.reset(); this.setKind(kind); const p = new RoutePath(route); this.legs = [p]; this.s = p.length; this.place(); this.stage = 'waiting'; }
  /** Leave for a destination along `legs`, adding `hop` metres of virtual distance at the cut. */
  depart(legs: Point[][], hop: number) { this.legs = legs.map(l => new RoutePath(l)); this.leg = 0; this.s = 0; this.driven = 0; this.hop = hop; this.waited = 0; this.stage = 'riding'; this.place(); }
  /** Jump to the end of the trip (skip). */
  finish() { if (this.stage !== 'riding') return; this.leg = this.legs.length - 1; this.s = this.legs[this.leg].length; this.driven = this.legs.reduce((t, l) => t + l.length, 0); this.driver.speed = 0; this.place(); this.stage = 'arrived'; }
  end() { this.reset(); this.stage = 'idle'; }
  private place() { const p = this.legs[this.leg].at(this.s); this.pose.x = p.x; this.pose.z = p.z; this.pose.yaw = p.yaw; }
  /** The ride's envelope in a district's local frame. */
  envelopeIn(originX: number): Envelope { const e = this.driver.env; e.x = this.pose.x - originX; e.z = this.pose.z; e.yaw = this.pose.yaw; e.speed = this.driver.speed; return e; }
  /**
   * Choose where the hailed cab starts: the first candidate whose start is clear (nothing on it or on the first
   * metres of road ahead) and unseen; after DISPATCH_PATIENCE seconds, the first clear one even if in view.
   */
  private dispatch(dt: number, ctx: RideContext) {
    this.dispatchFor += dt;
    const probe: Envelope = { ...this.driver.env };
    let fallback: RoutePath | null = null;
    for (const route of this.candidates) {
      const start = route.at(0); probe.x = start.x - ctx.originX; probe.z = start.z; probe.yaw = start.yaw;
      if (ctx.space.hit(probe, 'ride', .5) || ctx.space.clearance(probe, s => { const q = route.at(s); return { x: q.x - ctx.originX, z: q.z, yaw: q.yaw }; }, 8).blocker) continue;
      const seen = ctx.view ? inView(ctx.view, probe.x, probe.z, probe.halfLength) && Math.hypot(probe.x - ctx.view.x, probe.z - ctx.view.z) < 115 : false;
      if (!seen) return route;
      fallback ??= route;
    }
    return this.dispatchFor >= DISPATCH_PATIENCE ? fallback : null;
  }
  /** Hold for the zebra while it is held: the front stops ZEBRA_HOLD m before its centre line, unless already too close to stop. */
  private zebraHold(path: RoutePath, ctx: RideContext): Hold | null {
    if (!crossingHeld(ctx.time)) return null;
    const d = this.driver, h = d.env.halfLength;
    const front = (s: number) => { const p = path.at(s); return { x: p.x - ctx.originX - Math.sin(p.yaw) * h, z: p.z - Math.cos(p.yaw) * h }; };
    const inBand = (p: { x: number; z: number }) => Math.abs(p.z - ZEBRA_Z) < ZEBRA_HOLD && Math.abs(p.x) < 4.2;
    if (inBand(front(this.s))) return null;
    for (let s = .5; s <= 16; s += .5) if (inBand(front(this.s + s))) {
      const distance = s - .5; if (distance < d.speed * d.speed / (2 * d.profile.maxBrake)) return null;
      return { distance, state: 'waiting-signal' };
    }
    return null;
  }
  /** Advance one frame. Returns what happened, so the caller can move the camera, change district or update the meter. */
  step(dt: number, ctx: RideContext): RideEvent {
    if (this.stage === 'idle' || this.stage === 'arrived' || this.stage === 'waiting') { if (this.stage !== 'idle') { this.envelopeIn(ctx.originX); ctx.space.addDriver(this.driver); } return 'none'; }
    if (this.stage === 'dispatching') {
      const route = this.dispatch(dt, ctx); if (!route) return 'none';
      this.legs = [route]; this.leg = 0; this.s = 0; this.place(); this.stage = 'approaching'; this.driver.speed = Math.min(2.5, this.driver.desired);
      this.envelopeIn(ctx.originX); ctx.space.addDriver(this.driver); return 'dispatched';
    }
    const path = this.legs[this.leg], last = this.leg === this.legs.length - 1, d = this.driver;
    this.envelopeIn(ctx.originX); if (ctx.space.drivers.get('ride') !== d) ctx.space.addDriver(d);
    const holds: Hold[] = []; if (last) holds.push({ distance: path.length - this.s, state: 'stopping' });
    const zebra = this.zebraHold(path, ctx); if (zebra) holds.push(zebra);
    // The passenger is in the cab; while it pulls in, someone on the pavement (the visitor waiting) is not in its way.
    const ignore = (e: Envelope) => e.category === 'visitor' && (this.stage === 'riding' || Math.abs(e.x) > 3.6);
    const moved = drive(ctx.space, d, s => { const q = path.at(this.s + s); return { x: q.x - ctx.originX, z: q.z, yaw: q.yaw }; }, dt, holds, ignore, ctx.junctions ? { reservations: ctx.junctions, time: ctx.time } : undefined);
    this.s += moved; if (this.stage === 'riding') { this.driven += moved; if (d.speed < .05) this.waited += dt; }
    if (!last && this.s >= path.length) {
      // The cut to the next district's arrival road (it carries on from the leg's end speed).
      this.leg++; this.s = 0; this.place(); ctx.space.remove('ride'); return 'cut';
    }
    this.s = Math.min(this.s, path.length); this.place(); this.envelopeIn(ctx.originX);
    if (last && path.length - this.s < .3 && d.speed < .6) {
      this.s = path.length; this.place(); this.envelopeIn(ctx.originX);
      d.speed = 0; d.env.speed = 0;
      if (this.stage === 'approaching') { this.stage = 'waiting'; return 'pulled-up'; }
      this.driven = this.legs.reduce((t, l) => t + l.length, 0); this.stage = 'arrived'; return 'arrived';
    }
    return 'none';
  }
}
