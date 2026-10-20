import type { TransitKind } from '../transit';

/**
 * A fare tariff. Distances are metres, times seconds, money rupees. The values shipped here are invented for the
 * portfolio: they are not any authority's tariff, and no payment is ever taken.
 */
export interface FarePolicy {
  id: string;
  /** Minimum charge on hire; it covers the first `includedDistance` metres. */
  baseFare: number;
  includedDistance: number;
  /** Beyond the included distance, the fare rises by `distanceRate` for every started `distanceStep` metres. */
  distanceStep: number;
  distanceRate: number;
  /** Waiting is free for the first `waitingThreshold` seconds of a trip, then charged per started minute. */
  waitingThreshold: number;
  waitingRatePerMinute: number;
  minimumFare: number;
  /** Fraction added between `nightFrom` and `nightUntil` (24-hour clock, the world's own time of day). */
  nightSurcharge: number; nightFrom: number; nightUntil: number;
  /** Fares shown on the meter are rounded to this many rupees (1 = whole rupees). */
  rounding: number;
  /** Null for the demo tariff: it has no effective date because it was never in force anywhere. */
  effectiveDate: string | null;
  source: string;
}

/**
 * Demo distance policy: the streets are a miniature of the city, so each metre the cab drives counts as this many
 * metres on the meter; a ride between districts adds the virtual distance between them (see PassengerRide.hop).
 * The meter is not GPS-measured travel.
 */
export const CITY_METRES_PER_WORLD_METRE = 10;
/** Demo distance between districts: city metres per unit on the city map (CST to BKC, 35 units, is 14 km). */
export const CITY_METRES_PER_MAP_UNIT = 400;

export const DEMO_FARE_LABEL = 'DEMO FARE POLICY — NOT AN OFFICIAL TRANSPORT TARIFF';

/** The portfolio's demo tariffs: an auto a little cheaper than a black-and-yellow taxi, as in the city. */
export const DEMO_FARES: Record<TransitKind, FarePolicy> = {
  auto: { id: 'demo-auto', baseFare: 23, includedDistance: 1500, distanceStep: 100, distanceRate: 1.5, waitingThreshold: 60, waitingRatePerMinute: 1, minimumFare: 23, nightSurcharge: .25, nightFrom: 0, nightUntil: 5, rounding: 1, effectiveDate: null, source: DEMO_FARE_LABEL },
  taxi: { id: 'demo-taxi', baseFare: 28, includedDistance: 1500, distanceStep: 100, distanceRate: 1.9, waitingThreshold: 60, waitingRatePerMinute: 1.5, minimumFare: 28, nightSurcharge: .25, nightFrom: 0, nightUntil: 5, rounding: 1, effectiveDate: null, source: DEMO_FARE_LABEL },
};

/** The fare for a trip of `distance` m with `waiting` s of chargeable waiting, at world hour `hour`. Deterministic. */
export function fareFor(policy: FarePolicy, distance: number, waiting: number, hour = 12) {
  const extraSteps = Math.max(0, Math.ceil((Math.max(0, distance) - policy.includedDistance - 1e-6) / policy.distanceStep));
  const waitingMinutes = Math.max(0, Math.ceil((Math.max(0, waiting) - policy.waitingThreshold - 1e-6) / 60));
  const night = policy.nightFrom <= policy.nightUntil ? hour >= policy.nightFrom && hour < policy.nightUntil : hour >= policy.nightFrom || hour < policy.nightUntil;
  const raw = Math.max(policy.minimumFare, policy.baseFare + extraSteps * policy.distanceRate + waitingMinutes * policy.waitingRatePerMinute) * (night ? 1 + policy.nightSurcharge : 1);
  return Math.round(raw / policy.rounding) * policy.rounding;
}

export type MeterState = 'OFF' | 'READY' | 'HIRED' | 'RUNNING' | 'WAITING' | 'COMPLETED';
export type MeterAction = 'power-on' | 'power-off' | 'hire' | 'move' | 'stop' | 'complete' | 'cancel' | 'reset';

/** Every legal transition; anything else is refused and leaves the meter as it was. */
const TRANSITIONS: Record<MeterState, Partial<Record<MeterAction, MeterState>>> = {
  OFF: { 'power-on': 'READY' },
  READY: { hire: 'HIRED', 'power-off': 'OFF' },
  HIRED: { move: 'RUNNING', stop: 'WAITING', complete: 'COMPLETED', cancel: 'READY' },
  RUNNING: { stop: 'WAITING', complete: 'COMPLETED', cancel: 'READY' },
  WAITING: { move: 'RUNNING', complete: 'COMPLETED', cancel: 'READY' },
  COMPLETED: { reset: 'READY' },
};

/** Below this speed (m/s) for STOP_AFTER seconds the cab is waiting; above it, running again. */
export const STOP_SPEED = .3, STOP_AFTER = 1;

/** What the meter shows and announces. */
export interface MeterReading { state: MeterState; fare: number; distance: number; waiting: number; policy: FarePolicy }

/**
 * The cab's fare meter. Distance comes only from the trip's own chargeable distance (route progress plus the
 * demo distance of a cut between districts, released smoothly over the arrival road), never from positions, so a
 * district swap, a reloaded scene or extra frames cannot add to it. Waiting time is the simulation clock while the
 * meter is WAITING: the world's frame delta, which stops while the game is paused and is capped per frame, so a
 * pause, a browser stall or a loading screen is never charged.
 */
export class FareMeter {
  state: MeterState = 'OFF';
  distance = 0; waiting = 0; private still = 0; private finalFare = 0;
  constructor(public policy: FarePolicy) {}
  /** Apply an action; false (and no change) when it is not legal from the current state. */
  apply(action: MeterAction) {
    const next = TRANSITIONS[this.state][action]; if (!next) return false;
    if (action === 'hire' || action === 'reset' || action === 'cancel') { this.distance = 0; this.waiting = 0; this.still = 0; }
    if (next === 'COMPLETED') this.finalFare = this.fare;
    this.state = next; return true;
  }
  /** Switch tariff (taxi or auto); only while not on a trip. */
  setPolicy(policy: FarePolicy) { if (this.state === 'OFF' || this.state === 'READY') this.policy = policy; }
  /**
   * One frame of a hired trip: `dt` simulation seconds, `distance` the trip's chargeable distance so far (it only ever
   * rises), `speed` the cab's speed, `loading` whether the world is still building the road ahead.
   */
  tick(dt: number, distance: number, speed: number, loading = false) {
    if (this.state !== 'HIRED' && this.state !== 'RUNNING' && this.state !== 'WAITING') return;
    this.distance = Math.max(this.distance, distance);
    const step = loading ? 0 : Math.max(0, Math.min(dt, .1));
    if (speed >= STOP_SPEED) { this.still = 0; this.apply('move'); }
    else if ((this.still += step) >= STOP_AFTER) this.apply('stop');
    if (this.state === 'WAITING') this.waiting += step;
  }
  get fare() { return this.state === 'COMPLETED' ? this.finalFare : this.state === 'OFF' ? 0 : fareFor(this.policy, this.distance, this.waiting); }
  get reading(): MeterReading { return { state: this.state, fare: this.fare, distance: this.distance, waiting: this.waiting, policy: this.policy }; }
}

/** Kilometres as the meter shows them: whole hundreds of metres travelled, never rounded up. */
export const meterKm = (metres: number) => (Math.floor(Math.max(0, metres) / 100) / 10).toFixed(1);

/** The three rows the meter's display shows (seven-segment text) for a reading. */
export function meterRows(r: MeterReading) {
  if (r.state === 'OFF') return { fare: '', middle: '', distance: '' };
  const clock = (s: number) => `${String(Math.floor(s / 60) % 100).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return {
    fare: r.state === 'READY' ? '----' : r.fare.toFixed(2),
    middle: r.state === 'READY' ? 'FrEE' : clock(r.waiting),
    distance: r.state === 'READY' ? '0.0' : meterKm(r.distance),
  };
}

/** A sentence for screen readers and the text readout. */
export function meterText(r: Pick<MeterReading, 'state' | 'fare' | 'distance' | 'waiting'>) {
  const state = { OFF: 'Meter off', READY: 'Meter ready, not hired', HIRED: 'Meter hired', RUNNING: 'Meter running', WAITING: 'Meter waiting', COMPLETED: 'Trip completed' }[r.state];
  return `${state}. Fare ₹${r.fare.toFixed(2)}, distance ${meterKm(r.distance)} km, waiting ${Math.floor(r.waiting / 60)} min ${Math.floor(r.waiting % 60)} s.`;
}
