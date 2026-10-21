import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { MumbaiStreet } from '../src/game/World/MumbaiStreet';
import { CityDistricts } from '../src/game/World/districts/CityDistricts';
import { cityZones } from '../src/game/World/streetLayout';
import { DISTRICT_EXHIBITS, exhibitsOf, powaiPodZ, readingSpot } from '../src/data/districtExhibits';
import { POWAI_PROJECTS, projects } from '../src/data/projects';

const ctx: Record<string, unknown> = new Proxy({}, { get: (t: Record<string, unknown>, k: string) => k in t ? t[k] : () => ctx, set: (t, k: string, v) => { t[k] = v; return true; } });
beforeEach(() => vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) }));
afterEach(() => vi.unstubAllGlobals());

describe('district exhibits', () => {
  it('have unique ids, and Powai boards open the real projects', () => {
    const ids = DISTRICT_EXHIBITS.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of projects.filter(p => POWAI_PROJECTS.includes(p.id))) expect(exhibitsOf('powai').map(e => e.id)).toContain(p.id);
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
it('can be walked to from the pavement, through the doors of the walk-in buildings', () => {
  const physics = new CANNON.World(), street = new MumbaiStreet(physics), city = new CityDistricts(physics, street.surfaceLibrary, new THREE.Group(), () => {});
  // Pavement → doorway → inside, then on to each reading spot (local frame).
  const routes: Record<string, { entry: Array<[number, number]>; via?: Record<string, Array<[number, number]>> }> = {
    bkc: { entry: [[6.5, 3], [13, 3]] },
    juhu: { entry: [[6, 5], [12, 5]] },
    filmcity: { entry: [[6, 3], [12, 3]], via: { 'filmcity-screen': [[17, 3]] } },
    // Each Powai board stands at its workplace door: walk in through the door, back out, then to the board.
    powai: { entry: [], via: Object.fromEntries(exhibitsOf('powai').map((e, i) => [e.id, [[7.2, powaiPodZ(i)], [12, powaiPodZ(i)], [7.2, powaiPodZ(i)], [readingSpot(e).x, powaiPodZ(i)]]])) },
  };
  for (const [id, route] of Object.entries(routes)) {
    const i = cityZones.findIndex(z => z.id === id), zone = cityZones[i], d = city.activate(i)!;
    // The opened stretch of the district limit is closed again by the building's own back wall.
    if (route.entry.length) expect(d.spatial.hit(new THREE.Vector3(zone.originX + 14, 1.3, route.entry[1][1]), new THREE.Vector3(1, 0, 0), 30), `${id} open at the back`).toBeTruthy();
    for (const e of exhibitsOf(id)) {
      // Boards outside the building (the BKC brief at the door) are read from the pavement.
      const spot = readingSpot(e), outside = Math.abs(spot.x) < 9 && !route.via?.[e.id], path = [...(outside ? [[6.5, spot.z] as [number, number]] : route.entry), ...(route.via?.[e.id] ?? []), [spot.x, spot.z] as [number, number]];
      for (let k = 1; k < path.length; k++) {
        const [ax, az] = path[k - 1], [bx, bz] = path[k], length = Math.hypot(bx - ax, bz - az), dir = new THREE.Vector3(bx - ax, 0, bz - az).normalize();
        // Shoulders either side and two heights: knees and chest.
        for (const side of [-.25, 0, .25]) for (const y of [.6, 1.3]) {
          const origin = new THREE.Vector3(zone.originX + ax - dir.z * side, y, az + dir.x * side);
          expect(d.spatial.hit(origin, dir, length), `${e.id}: leg ${k} blocked`).toBeFalsy();
        }
      }
    }
  }
}, 120_000);
