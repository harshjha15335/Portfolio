import { describe, expect, it } from 'vitest';
import { DEMO_FARES, DEMO_FARE_LABEL, FareMeter, STOP_AFTER, fareFor, meterRows, meterText, type MeterAction, type MeterState } from '../src/game/World/meter/FareMeter';
import { PassengerRide } from '../src/game/World/traffic/PassengerRide';
import { TrafficSpace } from '../src/game/World/traffic/TrafficSafety';

describe('demo fare policy', () => {
  it('is labelled as a demo, not an official tariff, with no effective date', () => {
    for (const p of Object.values(DEMO_FARES)) { expect(p.source).toBe(DEMO_FARE_LABEL); expect(p.effectiveDate).toBeNull(); }
    expect(DEMO_FARE_LABEL).toBe('DEMO FARE POLICY — NOT AN OFFICIAL TRANSPORT TARIFF');
  });
  it('charges the base fare up to the included distance, then per started step', () => {
    const auto = DEMO_FARES.auto;
    expect(fareFor(auto, 0, 0)).toBe(23); expect(fareFor(auto, 1500, 0)).toBe(23);
    expect(fareFor(auto, 1501, 0)).toBe(Math.round(23 + 1.5)); expect(fareFor(auto, 1600, 0)).toBe(Math.round(23 + 1.5));
    expect(fareFor(auto, 2500, 0)).toBe(Math.round(23 + 10 * 1.5));
    expect(fareFor(DEMO_FARES.taxi, 3000, 0)).toBe(Math.round(28 + 15 * 1.9));
  });
  it('charges waiting per started minute after the free threshold, and the night surcharge at night', () => {
    const auto = DEMO_FARES.auto;
    expect(fareFor(auto, 0, 60)).toBe(23); expect(fareFor(auto, 0, 61)).toBe(24); expect(fareFor(auto, 0, 180)).toBe(25);
    expect(fareFor(auto, 0, 0, 2)).toBe(Math.round(23 * 1.25)); expect(fareFor(auto, 0, 0, 5)).toBe(23); expect(fareFor(auto, 0, 0, 23.9)).toBe(23);
  });
  it('is deterministic and never falls as distance or waiting rise', () => {
    let last = 0;
    for (let d = 0; d < 20000; d += 37) { const f = fareFor(DEMO_FARES.taxi, d, d / 50); expect(f).toBeGreaterThanOrEqual(last); expect(fareFor(DEMO_FARES.taxi, d, d / 50)).toBe(f); last = f; }
  });
});

describe('meter states', () => {
  const states: MeterState[] = ['OFF', 'READY', 'HIRED', 'RUNNING', 'WAITING', 'COMPLETED'];
  const actions: MeterAction[] = ['power-on', 'power-off', 'hire', 'move', 'stop', 'complete', 'cancel', 'reset'];
  const legal: Record<MeterState, Partial<Record<MeterAction, MeterState>>> = {
    OFF: { 'power-on': 'READY' }, READY: { hire: 'HIRED', 'power-off': 'OFF' },
    HIRED: { move: 'RUNNING', stop: 'WAITING', complete: 'COMPLETED', cancel: 'READY' },
    RUNNING: { stop: 'WAITING', complete: 'COMPLETED', cancel: 'READY' },
    WAITING: { move: 'RUNNING', complete: 'COMPLETED', cancel: 'READY' }, COMPLETED: { reset: 'READY' },
  };
  const at = (state: MeterState) => {
    const m = new FareMeter(DEMO_FARES.auto), path: Record<MeterState, MeterAction[]> = { OFF: [], READY: ['power-on'], HIRED: ['power-on', 'hire'], RUNNING: ['power-on', 'hire', 'move'], WAITING: ['power-on', 'hire', 'stop'], COMPLETED: ['power-on', 'hire', 'complete'] };
    for (const a of path[state]) expect(m.apply(a)).toBe(true); expect(m.state).toBe(state); return m;
  };
  for (const state of states) for (const action of actions) it(`${state} + ${action} → ${legal[state][action] ?? 'refused'}`, () => {
    const m = at(state), ok = m.apply(action);
    expect(ok).toBe(!!legal[state][action]); expect(m.state).toBe(legal[state][action] ?? state);
  });
  it('runs and waits with the cab, charges only waiting, and keeps the final fare after completion', () => {
    const m = at('HIRED'); let d = 0;
    for (let i = 0; i < 300; i++) { d += 5 / 30; m.tick(1 / 30, d, 5); } expect(m.state).toBe('RUNNING'); expect(m.waiting).toBe(0);
    for (let i = 0; i < 30 * STOP_AFTER - 1; i++) m.tick(1 / 30, d, 0); expect(m.state).toBe('RUNNING');
    for (let i = 0; i < 30 * 125; i++) m.tick(1 / 30, d, 0); expect(m.state).toBe('WAITING'); expect(m.waiting).toBeCloseTo(125, 0);
    m.tick(1 / 30, d, 4); expect(m.state).toBe('RUNNING');
    const fare = m.fare; expect(fare).toBe(fareFor(DEMO_FARES.auto, d, m.waiting));
    m.apply('complete'); m.tick(1 / 30, d + 500, 5); expect(m.fare).toBe(fare); expect(m.distance).toBe(d);
    m.apply('reset'); expect(m.fare).toBe(23); expect(m.distance).toBe(0); expect(m.waiting).toBe(0);
  });
  it('charges no waiting while paused (no ticks), across a stall (capped frame) or while loading', () => {
    const m = at('WAITING');
    m.tick(30, 0, 0); expect(m.waiting).toBeLessThanOrEqual(.1);
    for (let i = 0; i < 300; i++) m.tick(1 / 30, 0, 0, true); expect(m.waiting).toBeLessThanOrEqual(.1);
  });
  it('never takes distance backwards and cancellation clears the trip', () => {
    const m = at('RUNNING'); m.tick(1 / 30, 800, 5); m.tick(1 / 30, 200, 5); expect(m.distance).toBe(800);
    m.apply('cancel'); expect(m.state).toBe('READY'); expect(m.distance).toBe(0); expect(m.fare).toBe(23);
  });
  it('shows three seven-segment rows and a text readout', () => {
    const m = at('READY'); expect(meterRows(m.reading)).toEqual({ fare: '----', middle: 'FrEE', distance: '0.0' });
    m.apply('hire'); m.apply('stop'); m.tick(491, 8320, 0); for (let i = 0; i < 4910; i++) m.tick(.1, 8320, 0);
    expect(meterRows(m.reading)).toEqual({ fare: m.fare.toFixed(2), middle: '08:11', distance: '8.3' });
    expect(meterText(m.reading)).toMatch(/^Meter waiting\. Fare ₹\d+\.00, distance 8\.3 km, waiting 8 min 11 s\.$/);
    expect(meterRows(new FareMeter(DEMO_FARES.taxi).reading)).toEqual({ fare: '', middle: '', distance: '' });
  });
});

describe('trip distance across a district cut', () => {
  it('rises smoothly through the cut and reaches the legs plus the demo distance on arrival', () => {
    const cab = new PassengerRide(), exit = [{ x: 1.8, z: 0 }, { x: 1.8, z: -60 }], arrival = [{ x: 601.8, z: 60 }, { x: 601.8, z: 0 }], hop = 2400;
    cab.standAt('auto', [{ x: 1.8, z: 4 }, { x: 1.8, z: 0 }]); cab.depart([exit, arrival], hop);
    let last = 0, origin = 0, maxJump = 0;
    for (let i = 0; i < 30 * 120 && cab.stage !== 'arrived'; i++) {
      const space = new TrafficSpace(), event = cab.step(1 / 30, { space, originX: origin, time: i / 30 });
      if (event === 'cut') origin = 600;
      const jump = cab.chargeable - last; expect(jump).toBeGreaterThanOrEqual(0); maxJump = Math.max(maxJump, jump); last = cab.chargeable;
    }
    expect(cab.stage).toBe('arrived');
    expect(cab.chargeable).toBeCloseTo(120 + hop, 3);
    // At most a frame's driving (or the last 0.3 m snap to the kerb) scaled by the demo distance per metre of arrival
    // road: never the whole cut at once.
    expect(maxJump).toBeLessThan((.3 + 6 / 30) * (1 + hop / 60)); expect(maxJump).toBeLessThan(hop / 100);
  });
});
