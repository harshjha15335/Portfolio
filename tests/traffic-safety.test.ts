/**
 * Deterministic collision-safety scenarios for the kinematic traffic (docs/TRAFFIC_AI_AUDIT.md lists them).
 * Every scenario runs the real traffic classes headless, measures the signed clearance between every pair of
 * vehicle envelopes each step, and fails on any overlap deeper than OVERLAP (1 cm).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LaneTraffic, SPAWN_MIN_DISTANCE, RECENTLY_SEEN } from '../src/game/World/districts/DistrictSystems';
import { districtTraffic } from '../src/game/World/districts/District';
import { DISTRICT_SPECS } from '../src/game/World/districts/catalog';
import { createFortRoadTraffic } from '../src/game/World/districts/FortRoadTraffic';
import { RoadTraffic, SIGNAL_CYCLE, WALK_FROM, pedestrianGreen, zebraBusy } from '../src/game/World/traffic/RoadTraffic';
import { DISTRICT_JUNCTIONS, FORT_JUNCTIONS, PassengerRide, kerbRoom } from '../src/game/World/traffic/PassengerRide';
import {
  DRIVE_PROFILE, JunctionReservations, TrafficSpace, VEHICLE_BODY, drive, followAcceleration, inView, onCarriageway, safeAdvance, separation, stoppingDistance,
  type Driver, type Envelope, type ViewCone,
} from '../src/game/World/traffic/TrafficSafety';
import { cityRideLegs, cityZones, pickupRoutes, streetStops } from '../src/game/World/streetLayout';

const OVERLAP = -.01;
const conflicts = (a: string, b: string) => a !== b && (a === 'ride' || b === 'ride');
/** A seeded generator (mulberry32), so every run of a scenario is the same run. */
function seeded(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const solid = (e: Envelope) => e.category === 'vehicle' || e.category === 'ride' || e.category === 'parked';
/** Smallest clearance between any two solid envelopes in the space (and which). */
function worst(space: TrafficSpace) {
  let min = Infinity, pair = '';
  const list = space.entries.filter(solid);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (list[i].category === 'parked' && list[j].category === 'parked') continue;
    const s = separation(list[i], list[j]); if (s < min) { min = s; pair = `${list[i].id}/${list[j].id}`; }
  }
  return { min, pair };
}
const look = (x: number, z: number, yaw: number, halfAngle = .9): ViewCone => ({ x, z, fx: -Math.sin(yaw), fz: -Math.cos(yaw), halfAngle, range: 115 });

/** CST–Fort as the engine runs it: the loop's taxis and autos, the through traffic, the cab, one shared space. */
function fortWorld(dense = true) {
  const road = new RoadTraffic(3, 3); if (dense) road.active = 6;
  const fort = createFortRoadTraffic(() => []), space = new TrafficSpace(), junctions = new JunctionReservations(FORT_JUNCTIONS, conflicts), cab = new PassengerRide();
  let time = 100;
  const step = (dt: number, visitor: THREE.Vector3 | null, view?: ViewCone, walkers: THREE.Vector3[] = []) => {
    time += dt; space.clear();
    if (visitor && onCarriageway(visitor.x, visitor.z) && (cab.stage === 'idle' || cab.stage === 'dispatching' || cab.stage === 'approaching')) space.add({ id: 'visitor', x: visitor.x, z: visitor.z, yaw: 0, halfLength: .35, halfWidth: .35, category: 'visitor', speed: 0 });
    road.publish(space); fort.junctions = junctions; fort.publish(space);
    walkers.forEach((w, k) => space.add({ id: `walker:${k}`, x: w.x, z: w.z, yaw: 0, halfLength: .3, halfWidth: .3, category: 'person', speed: 0 }));
    const event = cab.stage === 'idle' ? 'none' : cab.step(dt, { space, originX: 0, time, junctions, view });
    road.step(dt, time, [], [], space, { reservations: junctions, time });
    fort.update(time, dt, visitor ? [visitor] : [new THREE.Vector3(0, 1.6, 400)], walkers, { space, view: view ?? look(0, 400, 0) });
    junctions.sweep(time, id => space.get(id) !== undefined);
    return event;
  };
  return { road, fort, traffic: fort, space, junctions, cab, step, get time() { return time; } };
}
/** One of the seven district streets as District builds it (lanes, mix, stop lines, parked vehicles). */
function districtWorld(id: string) {
  const traffic = new LaneTraffic(), spec = DISTRICT_SPECS[id];
  for (const _ of districtTraffic(traffic, spec.traffic, id)) { /* build */ }
  // Andheri's kerbside bikes and handcarts stand in the carriageway edge; the others park off the road.
  if (id === 'andheri') { for (const [x, z] of [[3.35, -16], [3.35, -17], [3.35, -18], [-3.35, -30], [-3.35, -31], [3.35, -40]] as const) traffic.parkedAt('bike', x, z, x > 0 ? Math.PI : 0); traffic.parkedAt('cart', -3.7, -9.5, 0); traffic.parkedAt('cart', 3.7, -46, Math.PI); }
  const space = new TrafficSpace(), junctions = new JunctionReservations(DISTRICT_JUNCTIONS, conflicts), cab = new PassengerRide(), originX = cityZones.find(z => z.id === id)!.originX;
  traffic.junctions = junctions; let time = 0;
  const step = (dt: number, visitor: THREE.Vector3, view: ViewCone, walkers: THREE.Vector3[] = []) => {
    time += dt; space.clear();
    if (onCarriageway(visitor.x, visitor.z) && (cab.stage === 'idle' || cab.stage === 'dispatching' || cab.stage === 'approaching')) space.add({ id: 'visitor', x: visitor.x, z: visitor.z, yaw: 0, halfLength: .35, halfWidth: .35, category: 'visitor', speed: 0 });
    traffic.publish(space);
    const event = cab.stage === 'idle' ? 'none' : cab.step(dt, { space, originX, time, junctions, view });
    traffic.update(time, dt, [visitor], walkers, { space, view });
    junctions.sweep(time, i => space.get(i) !== undefined);
    return event;
  };
  return { traffic, space, junctions, cab, step, originX, get time() { return time; } };
}

describe('collision envelopes', () => {
  const box = (x: number, z: number, yaw: number, kind: keyof typeof VEHICLE_BODY = 'sedan'): Envelope => ({ id: `${x},${z}`, x, z, yaw, halfLength: VEHICLE_BODY[kind].length / 2, halfWidth: VEHICLE_BODY[kind].width / 2, category: 'vehicle', speed: 0 });
  it('measures gaps and overlaps between rotated boxes', () => {
    expect(separation(box(0, 0, 0), box(0, -6, 0))).toBeCloseTo(6 - 4.4, 5);
    expect(separation(box(0, 0, 0), box(0, -3, 0))).toBeCloseTo(3 - 4.4, 5);
    expect(separation(box(0, 0, 0), box(3.2, 0, Math.PI))).toBeCloseTo(3.2 - 1.8, 5);
    // A box turned across another: corner reach decides.
    expect(separation(box(0, 0, 0), box(3, 0, Math.PI / 2))).toBeCloseTo(3 - .9 - 2.2, 5);
    expect(separation(box(0, 0, Math.PI / 4), box(0, -2, Math.PI / 4))).toBeLessThan(0);
    expect(separation(box(0, 0, Math.PI / 4), box(0, -4, Math.PI / 4))).toBeGreaterThan(0);
    const person: Envelope = { id: 'p', x: 0, z: -3.5, yaw: 0, halfLength: .3, halfWidth: .3, category: 'person', speed: 0 };
    expect(separation(box(0, 0, 0), person)).toBeCloseTo(3.5 - 2.2 - .3, 5);
  });
  it('body sizes match the built vehicles (no mirrors) within 15 cm', async () => {
    const { createCityVehicle } = await import('../src/game/World/districts/CityVehicles');
    for (const kind of Object.keys(VEHICLE_BODY) as Array<keyof typeof VEHICLE_BODY>) {
      const size = new THREE.Box3().setFromObject(createCityVehicle(kind, 'x', true, 0)).getSize(new THREE.Vector3());
      expect(Math.abs(size.z - VEHICLE_BODY[kind].length), kind).toBeLessThan(.65);
      // The widest part of the bus and the cars is the mirrors, which pass over kerbs and other bodies.
      expect(VEHICLE_BODY[kind].width, kind).toBeLessThanOrEqual(size.x + .05);
    }
  });
  it('stops a long frame from jumping through a vehicle (swept check)', () => {
    const space = new TrafficSpace(), ahead = space.add(box(0, -8, 0, 'bus'));
    const self = box(0, 0, 0, 'taxi'), path = (d: number) => ({ x: 0, z: -d, yaw: 0 });
    // A 20 m move in one step would end beyond the bus; the swept check stops it at the bus.
    const moved = safeAdvance(space, self, path, 20);
    expect(moved).toBeLessThan(8 - ahead.halfLength - self.halfLength + .3);
    expect(separation({ ...self, z: -moved }, ahead)).toBeGreaterThanOrEqual(0);
  });
  it('plans braking from speed, closing speed and class', () => {
    const bus = DRIVE_PROFILE.bus, auto = DRIVE_PROFILE.auto;
    expect(stoppingDistance(6, bus)).toBeGreaterThan(stoppingDistance(6, auto));
    // Free road: speeds up. Closing fast on a stopped vehicle: brakes, harder the nearer it is.
    expect(followAcceleration(2, 6, Infinity, 0, auto)).toBeGreaterThan(0);
    expect(followAcceleration(6, 6, 10, 0, auto)).toBeLessThan(0);
    expect(followAcceleration(6, 6, 5, 0, auto)).toBeLessThan(followAcceleration(6, 6, 10, 0, auto));
    expect(followAcceleration(6, 6, .2, 0, auto)).toBeGreaterThanOrEqual(-auto.maxBrake);
  });
  it('sees what is inside the view cone only', () => {
    const view = look(0, 0, 0, .6);
    expect(inView(view, 0, -30)).toBe(true); expect(inView(view, 0, 30)).toBe(false); expect(inView(view, 40, -10)).toBe(false); expect(inView(view, 0, -200)).toBe(false);
  });
});

describe('collision-safe driving scenarios', () => {
  /** Two drivers on a straight lane (−z): returns the smallest clearance seen and whether the follower stopped. */
  function lane(leaderKind: keyof typeof VEHICLE_BODY, followerKind: keyof typeof VEHICLE_BODY, leaderSpeed: number, gap: number, dt = 1 / 30, seconds = 20) {
    const space = new TrafficSpace(), body = VEHICLE_BODY;
    // The leader moves at a constant speed (a bus at a stop when 0); the follower is driven.
    const lead = space.add({ id: 'lead', x: 0, z: -(gap + body[leaderKind].length / 2 + body[followerKind].length / 2), yaw: 0, halfLength: body[leaderKind].length / 2, halfWidth: body[leaderKind].width / 2, category: 'vehicle', speed: leaderSpeed });
    const follow: Driver = space.addDriver({ env: { id: 'follow', x: 0, z: 0, yaw: 0, halfLength: body[followerKind].length / 2, halfWidth: body[followerKind].width / 2, category: 'vehicle', speed: 6 }, speed: 6, profile: DRIVE_PROFILE[followerKind], desired: 6.5, state: 'cruising', priority: 1, blockedBy: null, interventions: 0 });
    let min = Infinity, s = 0;
    for (let t = 0; t < seconds; t += dt) {
      lead.z -= leaderSpeed * dt;
      s += drive(space, follow, d => ({ x: 0, z: -(s + d), yaw: 0 }), dt);
      min = Math.min(min, separation(lead, follow.env));
    }
    return { min, follow };
  }
  it('1 · a taxi following a taxi keeps its gap', () => { const r = lane('taxi', 'taxi', 3, 8); expect(r.min).toBeGreaterThan(.5); });
  it('2 · a taxi brakes behind a stationary bus', () => { const r = lane('bus', 'taxi', 0, 14); expect(r.min).toBeGreaterThan(.5); expect(r.follow.speed).toBeLessThan(.05); expect(r.follow.state).toBe('stopped'); });
  it('3 · an auto stops behind a parked vehicle', () => {
    const space = new TrafficSpace(); space.add({ id: 'parked', x: 0, z: -20, yaw: 0, halfLength: 2.3, halfWidth: .95, category: 'parked', speed: 0 });
    const auto: Driver = space.addDriver({ env: { id: 'auto', x: 0, z: 0, yaw: 0, halfLength: 1.35, halfWidth: .72, category: 'vehicle', speed: 4.5 }, speed: 4.5, profile: DRIVE_PROFILE.auto, desired: 5, state: 'cruising', priority: 1, blockedBy: null, interventions: 0 });
    let s = 0; for (let i = 0; i < 600; i++) s += drive(space, auto, d => ({ x: 0, z: -(s + d), yaw: 0 }), 1 / 30);
    expect(separation(auto.env, space.get('parked')!)).toBeGreaterThan(.5); expect(auto.speed).toBeLessThan(.05); expect(auto.blockedBy).toBe('parked');
  });
  it('4 · a bus follows slow traffic without closing in', () => { const r = lane('cart', 'bus', 1.1, 12, 1 / 30, 40); expect(r.min).toBeGreaterThan(1); expect(r.follow.speed).toBeLessThan(1.6); });
  it('12 · a sudden frame stall during braking does not end inside the vehicle ahead', () => {
    for (const stall of [.1, .25, .5]) { const r = lane('bus', 'taxi', 0, 6, stall, 6); expect(r.min, `stall ${stall}`).toBeGreaterThanOrEqual(0); }
  });
  it('5 · 6 · vehicles from crossing directions take turns through a shared area', () => {
    // Three movements through one junction box (north–south, east–west and a diagonal), all conflicting.
    const space = new TrafficSpace(), junctions = new JunctionReservations([{ id: 'box', minX: -4, maxX: 4, minZ: -4, maxZ: 4 }]);
    const paths = [(d: number) => ({ x: 0, z: 25 - d, yaw: 0 }), (d: number) => ({ x: -25 + d, z: 0, yaw: -Math.PI / 2 }), (d: number) => ({ x: 18 - d * .7071, z: 18 - d * .7071, yaw: Math.PI / 4 })];
    const drivers = paths.map((p, i) => { const q = p(0); return space.addDriver({ env: { id: `v${i}`, x: q.x, z: q.z, yaw: q.yaw, halfLength: 2.2, halfWidth: .9, category: 'vehicle', speed: 5, movement: `m${i}` }, speed: 5, profile: DRIVE_PROFILE.sedan, desired: 5.5, state: 'cruising', priority: 1, blockedBy: null, interventions: 0 }); });
    const s = [0, 0, 0]; let min = Infinity, time = 0;
    for (let i = 0; i < 30 * 40; i++) { time += 1 / 30; drivers.forEach((d, k) => { s[k] += drive(space, d, x => paths[k](s[k] + x), 1 / 30, [], undefined, { reservations: junctions, time }); }); min = Math.min(min, worst(space).min); }
    expect(min).toBeGreaterThan(OVERLAP);
    // Nobody deadlocks: all three are through and away.
    expect(s.every(v => v > 50)).toBe(true);
  });
  it('7 · a vehicle approaching a wall stops short of it', () => {
    const space = new TrafficSpace(); space.add({ id: 'wall', x: 0, z: -30, yaw: Math.PI / 2, halfLength: 4, halfWidth: .2, category: 'parked', speed: 0 });
    const car: Driver = space.addDriver({ env: { id: 'car', x: 0, z: 0, yaw: 0, halfLength: 2.2, halfWidth: .9, category: 'vehicle', speed: 6 }, speed: 6, profile: DRIVE_PROFILE.sedan, desired: 6, state: 'cruising', priority: 1, blockedBy: null, interventions: 0 });
    let s = 0; for (let i = 0; i < 600; i++) s += drive(space, car, d => ({ x: 0, z: -(s + d), yaw: 0 }), 1 / 30);
    expect(separation(car.env, space.get('wall')!)).toBeGreaterThan(.5);
  });
  it('8 · buses only drive lanes they can turn in (straight through streets, never the Fort Road loop)', () => {
    const fort = createFortRoadTraffic(() => []);
    for (const v of fort.diagnostics().filter(d => d.kind === 'bus')) expect(Math.abs(v.envelope.z + 62), 'bus on the cross street').toBeLessThan(3);
    for (const id of Object.keys(DISTRICT_SPECS)) { const w = districtWorld(id); for (const v of w.traffic.diagnostics().filter(d => d.kind === 'bus')) expect(Math.abs(Math.abs(v.envelope.x) - 1.6)).toBeLessThan(.01); }
  });
});

describe('Fort Road with the passenger ride', () => {
  // The defect: the hailed/boarded cab drove its route ignoring traffic (up to 2.9 m deep in other vehicles).
  const starts: Array<[number, number, string]> = [[4.6, -24, 'fort'], [4.6, -24, 'bkc'], [-4.6, -40, 'cst'], [4.6, 8, 'fort'], [-4.6, -10, 'bkc'], [4.6, -45, 'fort'], [4.6, 11.5, 'juhu'], [-5.1, -35, 'cst']];
  for (const [x, z, destination] of starts) it(`9 · 13 · ride from (${x}, ${z}) to ${destination}: no overlaps, arrives`, () => {
    for (const warm of [0, 7, 19]) {
      const w = fortWorld(), visitor = new THREE.Vector3(x, 1.6, z), view = look(x, z, x > 0 ? .3 : -.3);
      for (let t = 0; t < warm; t += 1 / 30) w.step(1 / 30, visitor, view);
      w.cab.hail(x > 0 ? 'taxi' : 'auto', pickupRoutes({ x, z }));
      let min = Infinity, pair = '', departed = false, cut = false, last = 0;
      for (let i = 0; i < 30 * 240; i++) {
        const event = w.step(1 / 30, visitor, view);
        if (w.cab.stage === 'waiting' && !departed) { departed = true; w.cab.depart(cityRideLegs({ x: w.cab.pose.x, z: w.cab.pose.z }, destination), 1000); }
        // Fare distance only grows, and only by the cut's virtual distance at the cut.
        if (w.cab.stage === 'riding') { const jump = w.cab.driven - last; expect(jump).toBeGreaterThanOrEqual(0); expect(jump).toBeLessThan(event === 'cut' ? 1000.5 : .5); last = w.cab.driven; }
        if (event === 'cut') { cut = true; break; }
        const r = worst(w.space); if (r.min < min) { min = r.min; pair = r.pair; }
        if (w.cab.stage === 'arrived') break;
      }
      expect(min, `${pair} (warm ${warm})`).toBeGreaterThan(OVERLAP);
      expect(cut || w.cab.stage === 'arrived', `ride stuck at ${w.cab.stage} (warm ${warm})`).toBe(true);
    }
  }, 120000);
  it('10 · traffic passes a visitor on the kerb and stops for one in the road', () => {
    const w = fortWorld(), kerb = new THREE.Vector3(4.6, 1.6, -24), view = look(4.6, -24, .3);
    let travelled = 0; const before = () => w.road.agents.reduce((t, a) => t + a.distance, 0);
    for (let i = 0; i < 30 * 30; i++) { const b = before(); w.step(1 / 30, kerb, view); travelled += Math.abs(before() - b) % w.road.length; }
    expect(travelled).toBeGreaterThan(100);
    const road = new THREE.Vector3(1.75, 1.6, -24); let nearest = Infinity;
    for (let i = 0; i < 30 * 40; i++) { w.step(1 / 30, road, view); for (const e of w.space.entries) if (solid(e) && e.category !== 'parked') nearest = Math.min(nearest, separation(e, { id: 'v', x: road.x, z: road.z, yaw: 0, halfLength: .35, halfWidth: .35, category: 'visitor', speed: 0 })); }
    expect(nearest).toBeGreaterThan(.6);
  });
  it('11 · vehicles hold for people crossing the zebra', () => {
    const w = fortWorld(), view = look(4.6, -24, .3), visitor = new THREE.Vector3(6.5, 1.6, -24); let nearest = Infinity, start = -1, crossed = 0;
    // Two people cross on each green, as the street's walkers do: they step off once it is green and nothing is still
    // on or committed to the zebra, and take 8 s.
    for (let i = 0; i < 30 * SIGNAL_CYCLE * 3; i++) {
      const phase = ((w.time % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
      if (phase < WALK_FROM) start = -1; else if (start < 0 && pedestrianGreen(w.time) && !zebraBusy(w.space.entries, -12, 3.2)) { start = phase; crossed++; }
      const k = start < 0 ? -1 : (phase - start) / 8, crossing = k >= 0 && k <= 1;
      const walkers = crossing ? [new THREE.Vector3(-4 + 8 * k, 1, -12.4), new THREE.Vector3(4 - 8 * k, 1, -11.6)] : [];
      w.step(1 / 30, visitor, view, walkers);
      for (const p of walkers) for (const e of w.space.entries) if (solid(e)) nearest = Math.min(nearest, separation(e, { id: 'p', x: p.x, z: p.z, yaw: 0, halfLength: .3, halfWidth: .3, category: 'person', speed: 0 }));
    }
    expect(nearest).toBeGreaterThan(.5); expect(crossed).toBe(3);
  }, 30000);
  it('20 · a denser preset only adds loop vehicles where there is room, and model swaps keep the state', () => {
    const w = fortWorld(false);
    for (let i = 0; i < 30 * 20; i++) w.step(1 / 30, null);
    w.road.active = 6; let min = Infinity;
    for (let i = 0; i < 30 * 60; i++) { w.step(1 / 30, null); min = Math.min(min, worst(w.space).min); }
    expect(min).toBeGreaterThan(OVERLAP); expect(w.road.live.every(Boolean)).toBe(true);
    const before = w.fort.diagnostics().map(d => [d.s, d.speed, d.envelope.x, d.envelope.z]);
    w.fort.refresh();
    expect(w.fort.diagnostics().map(d => [d.s, d.speed, d.envelope.x, d.envelope.z])).toEqual(before);
  });
});

describe('spawn and despawn rules', () => {
  /** A one-lane street with one vehicle that has just left the far end and waits to re-enter. */
  function waiting(kind: 'sedan' | 'bus' = 'sedan') {
    const t = new LaneTraffic(), lane = t.lane([[0, 0, 100], [0, 0, -100]]); t.vehicle(lane, kind, .999, 'x');
    const visitor = new THREE.Vector3(30, 1.6, 30); let time = 0;
    // Drive it off the end, out of sight (looking away from the far end and from the lane start).
    for (let i = 0; i < 30 * 5 && t.diagnostics()[0].active; i++) { time += 1 / 30; t.update(time, 1 / 30, [visitor], [], { view: look(30, 30, -Math.PI / 2) }); }
    return { t, lane, visitor, time: () => time, tick: (view: ViewCone, space?: TrafficSpace) => { time += 1 / 30; t.update(time, 1 / 30, [visitor], [], { view, space }); return t.diagnostics()[0]; } };
  }
  it('re-enters only when the lane start is clear and unseen, and resets its state', () => {
    const w = waiting(); expect(w.t.diagnostics()[0].active).toBe(false);
    // Looking straight at the lane start (z = 100) from 76 m: refused while in view, then for RECENTLY_SEEN s after looking away.
    const atStart = look(30, 30, Math.atan2(-(0 - 30), -(100 - 30)));
    expect(w.tick(atStart).decision).toBe('blocked-visible');
    const away = look(30, 30, -Math.PI / 2); let d = w.tick(away); expect(d.decision).toBe('blocked-recently-visible');
    for (let i = 0; i < 30 * RECENTLY_SEEN; i++) d = w.tick(away);
    expect(d.active).toBe(true); expect(d.entries).toBe(1); expect(d.state).not.toBe('inactive');
    expect(d.s).toBeLessThan(1); expect(d.speed).toBeGreaterThan(0); expect(d.speed).toBeLessThan(7);
  });
  it('waits while the lane start is occupied, near a pedestrian, the ride or the visitor', () => {
    const away = look(30, 30, -Math.PI / 2);
    for (const [category, expected] of [['vehicle', 'blocked-occupied'], ['parked', 'blocked-occupied'], ['person', 'blocked-pedestrian'], ['ride', 'blocked-ride']] as const) {
      const w = waiting(); for (let i = 0; i < 30 * (RECENTLY_SEEN + 1); i++) w.tick(away);
      const w2 = waiting(); const space = new TrafficSpace(); space.add({ id: 'thing', x: 0, z: 96, yaw: 0, halfLength: category === 'person' ? .3 : 2, halfWidth: category === 'person' ? .3 : .9, category, speed: 0 });
      for (let i = 0; i < 30 * (RECENTLY_SEEN + 1); i++) { const d = w2.tick(away, space); expect(d.active).toBe(false); expect(d.decision).toBe(expected); space.add({ id: 'thing', x: 0, z: 96, yaw: 0, halfLength: category === 'person' ? .3 : 2, halfWidth: category === 'person' ? .3 : .9, category, speed: 0 }); }
    }
    const t = new LaneTraffic(), lane = t.lane([[0, 0, 100], [0, 0, -100]]); t.vehicle(lane, 'sedan', .999, 'x');
    const visitor = new THREE.Vector3(2, 1.6, 100 - SPAWN_MIN_DISTANCE / 2); let time = 0, last = t.diagnostics()[0];
    for (let i = 0; i < 30 * 10; i++) { time += 1 / 30; t.update(time, 1 / 30, [visitor], [], { view: look(visitor.x, visitor.z, Math.PI) }); last = t.diagnostics()[0]; if (!last.active && last.decision) break; }
    expect(last.decision).toBe('blocked-player');
  });
  it('17 · 18 · a bus re-entering after its route, reused many times, never enters on top of the vehicle in front', () => {
    const t = new LaneTraffic(), lane = t.lane([[0, 0, 60], [0, 0, -60]]); ['bus', 'sedan', 'auto', 'bus', 'taxi'].forEach((k, i) => t.vehicle(lane, k as 'bus', i / 5, `r${i}`));
    const space = new TrafficSpace(); let time = 0, min = Infinity;
    for (let i = 0; i < 30 * 600; i++) { time += 1 / 30; space.clear(); t.update(time, 1 / 30, [new THREE.Vector3(200, 1.6, 0)], [], { space, view: look(200, 0, -Math.PI / 2) }); min = Math.min(min, worst(space).min); }
    expect(min).toBeGreaterThan(OVERLAP); expect(t.diagnostics().reduce((n, d) => n + d.entries, 0)).toBeGreaterThan(20);
  });
  it('leaves at the lane end only out of sight', () => {
    const t = new LaneTraffic(), lane = t.lane([[0, 0, 20], [0, 0, -20]]); t.vehicle(lane, 'sedan', .9, 'x');
    const visitor = new THREE.Vector3(6, 1.6, 0); let time = 0;
    for (let i = 0; i < 30 * 5; i++) { time += 1 / 30; t.update(time, 1 / 30, [visitor], [], { view: look(6, 0, Math.atan2(6, 20)) }); }
    expect(t.diagnostics()[0].active).toBe(true); expect(t.diagnostics()[0].state).toBe('exiting');
    for (let i = 0; i < 5; i++) { time += 1 / 30; t.update(time, 1 / 30, [visitor], [], { view: look(6, 0, Math.PI) }); }
    expect(t.diagnostics()[0].active).toBe(false);
  });
  it('making room for a cab removes only vehicles the visitor cannot see', () => {
    const t = new LaneTraffic(), lane = t.lane([[1.6, 0, 100], [1.6, 0, -100]]); t.vehicle(lane, 'sedan', .5, 'a'); t.vehicle(lane, 'sedan', .6, 'b');
    const visitor = new THREE.Vector3(4.6, 1.6, 0); t.update(0, 0, [visitor], [], { view: look(4.6, 0, 0) });
    // 'a' sits at z 0 beside the visitor (in view looking north? no: at the visitor's side), 'b' 20 m north (in view).
    const kept = t.clearAround([{ x: 2.8, z: 0 }, { x: 2.8, z: -20 }], 2.2);
    expect(kept).toBeGreaterThanOrEqual(1); expect(t.diagnostics().filter(d => d.active).length).toBe(kept);
    expect(t.clearAround([{ x: 2.8, z: -20 }], 2.2, true)).toBe(0); expect(t.diagnostics()[1].active).toBe(false);
  });
});

describe('long runs on every street', () => {
  // Several simulated minutes per street at mixed frame rates with stalls, the visitor walking the kerb and
  // crossing, and repeated cab rides: no overlap, no vehicle off the carriageway, no lasting deadlock.
  for (const id of ['cst', ...Object.keys(DISTRICT_SPECS)]) it(`${id}: 4 simulated minutes`, () => {
    const random = seeded(id.length * 7919), fort = id === 'cst';
    const w = fort ? fortWorld() : districtWorld(id), ox = fort ? 0 : (w as ReturnType<typeof districtWorld>).originX;
    const visitor = new THREE.Vector3(4.6, 1.6, 0); let min = Infinity, pair = '', offRoad = 0, rides = 0, stuck = 0, still = 0; const halted = new Map<string, number>(), jammed = new Set<string>();
    for (let t = 0; t < 240;) {
      // Frame times between 1/120 s and 1/15 s, with an occasional 100–500 ms stall (the engine clamps to 0.08 s).
      const dt = Math.min(.08, random() < .01 ? .1 + random() * .4 : [1 / 120, 1 / 60, 1 / 30, 1 / 15][Math.floor(random() * 4)]); t += dt;
      visitor.z = 8 - ((t * 1.2) % 60); visitor.x = Math.floor(t / 30) % 2 ? -4.6 : 4.6;
      const view = look(visitor.x, visitor.z, visitor.x > 0 ? Math.sin(t * .3) * 2 : Math.PI + Math.sin(t * .3) * 2);
      if (w.cab.stage === 'idle' && t > 5) { { const kind = rides % 2 ? 'auto' : 'taxi'; w.cab.hail(kind, pickupRoutes({ x: visitor.x + ox, z: visitor.z }, (x, z) => kerbRoom(w.traffic.parked, x - ox, z, kind))); } rides++; }
      if (w.cab.stage === 'waiting') w.cab.depart(cityRideLegs({ x: w.cab.pose.x, z: w.cab.pose.z }, fort ? (w.cab.pose.x > 0 ? 'fort' : 'cst') : 'cst'), 0);
      const event = fort ? (w as ReturnType<typeof fortWorld>).step(dt, visitor, view) : (w as ReturnType<typeof districtWorld>).step(dt, visitor, view);
      if (event === 'arrived' || event === 'cut') w.cab.end();
      if (w.cab.stage === 'riding' && w.cab.speed < .05) { still += dt; if (still > 60) stuck++; } else still = 0;
      // A vehicle may wait for the signal, a queue or a junction, but never stands still for a minute.
      for (const v of w.traffic.diagnostics()) { const h = v.active && v.speed < .05 ? (halted.get(v.id) ?? 0) + dt : 0; halted.set(v.id, h); if (h > 60) jammed.add(`${v.id} ${v.kind} ${v.state}`); }
      const r = worst(w.space); if (r.min < min) { min = r.min; pair = r.pair; }
      for (const e of w.space.entries) if ((e.category === 'vehicle' || e.category === 'ride') && Math.abs(e.z + 62) > 4 && Math.abs(e.x) + Math.abs(Math.sin(e.yaw)) * e.halfLength + Math.abs(Math.cos(e.yaw)) * e.halfWidth > 4.5) offRoad++;
    }
    expect(min, pair).toBeGreaterThan(OVERLAP);
    expect(offRoad).toBe(0);
    expect(stuck).toBe(0); expect(rides).toBeGreaterThan(2);
    expect([...jammed]).toEqual([]);
  }, 240000);
});
