import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { collectStaticBlockers, footprint, personBlocker, resolveBlockers, type Blocker } from '../src/game/World/collision/DynamicBlockers';
import { Crowd, LaneTraffic } from '../src/game/World/districts/DistrictSystems';
import { readFileSync } from 'node:fs';
import * as CANNON from 'cannon-es';

describe('dynamic blockers', () => {
  const car: Blocker = { x: 0, z: 0, yaw: 0, halfLength: 2, halfWidth: .9 };
  it('pushes the visitor out of a vehicle side and cancels the velocity into it', () => {
    const p = { x: .5, z: .3 }, v = { x: -2, z: 1 };
    expect(resolveBlockers(p, .3, [car], v)).toBe(true);
    expect(p.x).toBeCloseTo(1.2); expect(p.z).toBeCloseTo(.3);
    expect(v.x).toBe(0); expect(v.z).toBe(1);
  });
  it('respects the vehicle heading', () => {
    // Turned a quarter: the car's length now lies along x.
    const p = { x: 1.5, z: .1 }; resolveBlockers(p, .3, [{ ...car, yaw: Math.PI / 2 }]);
    expect(p.x).toBeCloseTo(2.3); expect(p.z).toBeCloseTo(.1);
    const clear = { x: 2.4, z: 0 }; expect(resolveBlockers(clear, .3, [{ ...car, yaw: Math.PI / 2 }])).toBe(false);
  });
  it('rounds the corners and leaves a clear visitor alone', () => {
    const corner = { x: 1.1, z: -2.1 }; resolveBlockers(corner, .3, [car]);
    expect(Math.hypot(corner.x - .9, corner.z + 2)).toBeCloseTo(.3);
    const far = { x: 5, z: 5 }; expect(resolveBlockers(far, .3, [car])).toBe(false); expect(far).toEqual({ x: 5, z: 5 });
  });
  it('keeps people apart by their radii', () => {
    const p = { x: .2, z: 0 }; resolveBlockers(p, .3, [personBlocker(0, 0)]);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(.6);
  });
  it('measures a vehicle footprint once, in its own frame', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 4.4)); mesh.rotation.y = 1; mesh.position.set(30, 0, 5);
    expect(footprint(mesh).halfLength).toBeCloseTo(2.2); expect(footprint(mesh).halfWidth).toBeCloseTo(.9);
  });
});

describe('static walls', () => {
  it('holds the visitor on the street side of a thin turned wall, ignoring kerbs and overhead signs', () => {
    const wall = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(.125, .8, 8)), position: new CANNON.Vec3(6, .8, 0) });
    wall.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
    const kerb = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(2, .1, 2)), position: new CANNON.Vec3(0, .1, 0) });
    const sign = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(2, .3, .1)), position: new CANNON.Vec3(0, 3, 0) });
    const out: Blocker[] = []; collectStaticBlockers(out, [wall, kerb, sign], 6, .4, 0);
    expect(out).toHaveLength(1);
    // Turned a quarter, the wall runs along x at z = 0; a visitor 10 cm into its near face goes back out.
    const p = { x: 6, z: .2 }; resolveBlockers(p, .3, out);
    expect(p.z).toBeCloseTo(.425);
    const far: Blocker[] = []; collectStaticBlockers(far, [wall], 30, 30, 0); expect(far).toHaveLength(0);
  });
});

describe('district crowd steering', () => {
  it('walks around a stall on its line instead of through it', () => {
    const crowd = new Crowd(); crowd.obstacles.push({ minX: 4.3, maxX: 5.3, minZ: -6, maxZ: -4 });
    crowd.walker('shirt', [[4.8, .03, 10], [4.8, .03, -20]], 1, 0);
    const person = crowd.people()[0], away = new THREE.Vector3(100, 1.6, 100);
    let inside = 0;
    for (let i = 0; i < 30 * 40; i++) {
      crowd.update(i / 30, 1 / 30, away);
      const p = person.group.position; if (p.x > 4.3 - .2 && p.x < 5.3 + .2 && p.z > -6 && p.z < -4) inside++;
    }
    expect(inside).toBe(0);
  });
  it('passes oncoming walkers on the same line without overlapping', () => {
    const crowd = new Crowd();
    crowd.walker('shirt', [[4.8, .03, 10], [4.8, .03, -20]], 1, 0);
    crowd.walker('office', [[4.8, .03, 10], [4.8, .03, -20]], 1, .99);
    const [a, b] = crowd.people(), away = new THREE.Vector3(100, 1.6, 100);
    let closest = Infinity;
    for (let i = 0; i < 30 * 20; i++) { crowd.update(i / 30, 1 / 30, away); closest = Math.min(closest, a.group.position.distanceTo(b.group.position)); }
    expect(closest).toBeGreaterThan(.45);
  });
  it('reports nearby people and vehicles as blockers in world space', () => {
    const crowd = new Crowd(); crowd.idle('shirt', [2, .03, 3], 0);
    const origin = new THREE.Vector3(600, 0, 0), out: Blocker[] = [];
    crowd.collectBlockers(out, origin, new THREE.Vector3(0, 1.6, 0));
    expect(out).toHaveLength(1); expect(out[0].x).toBe(602); expect(out[0].round).toBe(true);
    const traffic = new LaneTraffic(); const lane = traffic.lane([[1.6, 0, 20], [1.6, 0, -60]]); traffic.vehicle(lane, 'sedan', .3, 'test');
    const cars: Blocker[] = []; traffic.collectBlockers(cars, origin, new THREE.Vector3(1.6, 1.6, -4));
    expect(cars).toHaveLength(1); expect(cars[0].x).toBeCloseTo(601.6); expect(cars[0].halfLength).toBeGreaterThan(2);
  });
});

describe('content security policy', () => {
  it('lets three.js load the GLB textures it unpacks to blob: URLs', () => {
    // GLTFLoader decodes embedded images with fetch(blob:) in Chromium; without blob: in connect-src every character renders white.
    const config = JSON.parse(new TextDecoder().decode(readFileSync('vercel.json'))) as { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
    const csp = config.headers.flatMap(h => h.headers).find(h => h.key === 'Content-Security-Policy')!.value;
    const directive = (name: string) => csp.split(';').map(d => d.trim()).find(d => d.startsWith(name))!.split(/\s+/).slice(1);
    expect(directive('connect-src')).toContain('blob:');
    expect(directive('img-src')).toContain('blob:');
  });
});
