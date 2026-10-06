import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as CANNON from 'cannon-es';
import { districts } from '../src/data/city';
import { Campus, landmarkArrival } from '../src/game/World/Campus';
import { arrivalPoint, pointAtDistance, routeLength, storyFare, transitRoute } from '../src/game/World/transit';

beforeEach(() => vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, measureText: (text: string) => ({ width: text.length * 50 }) }) }) }));
afterEach(() => vi.unstubAllGlobals());

describe('compact portfolio city', () => {
  it('provides nine unique stops, each with a guide and selectable geometry', () => {
    const campus = new Campus(new CANNON.World(), districts);
    expect(new Set(districts.map(d => d.id)).size).toBe(9);
    expect(districts.every(d => d.guide && d.greeting)).toBe(true);
    expect(campus.targets.map(t => t.userData.landmarkId)).toEqual([...districts.map(d => d.id), 'hail-taxi', 'hail-auto']);
  });
  it('keeps walking and taxi arrivals clear of every static collider', () => {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -19, 0) });
    new Campus(world, districts);
    for (const d of districts) {
      const p = landmarkArrival(d);
      const body = new CANNON.Body({ mass: 140, shape: new CANNON.Box(new CANNON.Vec3(0.88, 0.29, 1.63)), position: new CANNON.Vec3(p.x, 0.8, p.z), collisionFilterGroup: 2, collisionFilterMask: 1 });
      body.quaternion.setFromEuler(0, p.heading, 0); world.addBody(body);
      for (let i = 0; i < 120; i++) world.step(1 / 60);
      expect(Math.hypot(body.position.x - p.x, body.position.z - p.z), d.id).toBeLessThan(0.15);
      expect(body.position.y, d.id).toBeGreaterThan(0.25);
      expect(body.position.y, d.id).toBeLessThan(1);
      world.removeBody(body);
    }
  });
  it('routes between all stop pairs without crossing district building footprints', () => {
    const world = new CANNON.World(); new Campus(world, districts);
    for (const start of districts) for (const end of districts) {
      const points = transitRoute(arrivalPoint(start.position), arrivalPoint(end.position));
      const length = routeLength(points);
      expect(length).toBeLessThan(100);
      const p = pointAtDistance(points, length + 1);
      expect(p.x).toBeCloseTo(arrivalPoint(end.position).x);
      expect(p.z).toBeCloseTo(arrivalPoint(end.position).z);
      for (let i = 1; i < points.length; i++) {
        const hit = new CANNON.RaycastResult();
        world.raycastClosest(new CANNON.Vec3(points[i - 1].x, 1, points[i - 1].z), new CANNON.Vec3(points[i].x, 1, points[i].z), { collisionFilterMask: 1 }, hit);
        expect(hit.hasHit, `${start.id} → ${end.id}`).toBe(false);
      }
    }
  });
  it('meters both vehicle types by distance and preserves route endpoints', () => {
    const points = transitRoute({ x: 0, z: -10 }, { x: 23, z: 0 });
    expect(pointAtDistance(points, 0)).toMatchObject({ x: 0, z: -10 });
    for (const kind of ['taxi', 'auto'] as const) {
      expect(storyFare(kind, 10)).toBeGreaterThan(storyFare(kind, 0));
      expect(Number.isFinite(storyFare(kind, routeLength(points)))).toBe(true);
    }
    expect(storyFare('taxi', 0)).toBe(28); expect(storyFare('auto', 0)).toBe(23);
  });
});
