import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { MumbaiStreet } from '../src/game/World/MumbaiStreet';
import { CityDistricts } from '../src/game/World/districts/CityDistricts';
import { cityZones } from '../src/game/World/streetLayout';
import { DISTRICT_EXHIBITS, exhibitsOf, readingSpot } from '../src/data/districtExhibits';
import { projects } from '../src/data/projects';

const ctx: Record<string, unknown> = new Proxy({}, { get: (t: Record<string, unknown>, k: string) => k in t ? t[k] : () => ctx, set: (t, k: string, v) => { t[k] = v; return true; } });
beforeEach(() => vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) }));
afterEach(() => vi.unstubAllGlobals());

describe('district exhibits', () => {
  it('have unique ids, and Powai boards open the real projects', () => {
    const ids = DISTRICT_EXHIBITS.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of projects.filter(p => p.id !== 'ffprime')) expect(exhibitsOf('powai').map(e => e.id)).toContain(p.id);
    for (const zone of cityZones.slice(1)) expect(exhibitsOf(zone.id).length, zone.id).toBeGreaterThan(1);
  });
  it('stand where a visitor can reach them, read them in a clear line of sight and nobody stands inside them', () => {
    const physics = new CANNON.World(), street = new MumbaiStreet(physics), city = new CityDistricts(physics, street.surfaceLibrary, new THREE.Group(), () => {});
    for (let i = 1; i < cityZones.length; i++) {
      const zone = cityZones[i], d = city.activate(i)!;
      for (const e of exhibitsOf(zone.id)) {
        const target = d.interactions.find(t => t.id === e.id);
        expect(target, e.id).toBeDefined();
        const spot = readingSpot(e), eye = new THREE.Vector3(zone.originX + spot.x, 1.68, spot.z), chest = eye.clone().setY(1.28);
        // The reading spot is open ground: nothing solid within 25 cm in any direction.
        for (let a = 0; a < 8; a++) {
          const dir = new THREE.Vector3(Math.cos(a * Math.PI / 4), 0, Math.sin(a * Math.PI / 4));
          expect(d.spatial.hit(chest.clone().setY(.6), dir, .25), `${e.id} spot blocked`).toBeFalsy();
        }
        expect(d.spatial.visible(chest, target!.position as THREE.Vector3), `${e.id} hidden`).toBe(true);
        expect(eye.distanceTo(target!.position as THREE.Vector3)).toBeLessThan(3.8);
        // Board and reading spot stay clear of the district's standing people.
        for (const p of d.crowd.standing()) {
          const lx = p.group.position.x, lz = p.group.position.z;
          expect(Math.hypot(lx - e.x, lz - e.z), `${e.id} vs person`).toBeGreaterThan(.9);
          expect(Math.hypot(lx - spot.x, lz - spot.z), `${e.id} spot vs person`).toBeGreaterThan(.6);
        }
      }
    }
  }, 120_000);
});
it('keep clear of the street lights (every 16 m from z = 10 at |x| = 6.4)', () => {
  for (const e of DISTRICT_EXHIBITS) if (Math.abs(Math.abs(e.x) - 6.4) < 1) for (let z = 10; z > -60; z -= 16) expect(Math.abs(e.z - z), e.id).toBeGreaterThan(2);
});
