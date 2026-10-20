import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { MumbaiStreet } from '../src/game/World/MumbaiStreet';
import { CityDistricts } from '../src/game/World/districts/CityDistricts';
import { District } from '../src/game/World/districts/District';
import { DISTRICT_SPECS } from '../src/game/World/districts/catalog';
import { cityZones } from '../src/game/World/streetLayout';

const ctx: Record<string, unknown> = new Proxy({}, { get: (t: Record<string, unknown>, k: string) => k in t ? t[k] : () => ctx, set: (t, k: string, v) => { t[k] = v; return true; } });
beforeEach(() => vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) }));
afterEach(() => vi.unstubAllGlobals());

/** What a visitor would meet: the merged district meshes and their size, the people, the things to press E at. (Individual figures vary between any two builds.) */
function contents(d: District) {
  const meshes: string[] = [];
  d.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.name) meshes.push(`${m.name}:${m.geometry.getAttribute('position')?.count ?? 0}`); });
  return { meshes: meshes.sort(), people: d.crowd.people().length, vehicles: d.traffic.moving.length, interactions: d.interactions.map(i => i.id).sort(), bodies: d.kit.bodies.length };
}

describe('district builds in slices', () => {
  it('build the same district a slice at a time as all at once', () => {
    const physics = new CANNON.World(), street = new MumbaiStreet(physics);
    for (const zone of cityZones.slice(1)) {
      const whole = new District(physics, street.surfaceLibrary, zone, DISTRICT_SPECS[zone.id]);
      const sliced = new District(physics, street.surfaceLibrary, zone, DISTRICT_SPECS[zone.id], true);
      let slices = 0; while (!sliced.step(0)) slices++;
      // Every building, vehicle and parked row is its own slice, so no single frame carries the district.
      expect(slices, zone.id).toBeGreaterThan(20);
      expect(contents(sliced), zone.id).toEqual(contents(whole));
      whole.dispose(); sliced.dispose();
    }
  }, 120_000);

  it('let a ride or jump build ahead, and drop an unfinished build cleanly', () => {
    const physics = new CANNON.World(), street = new MumbaiStreet(physics), built: string[] = [];
    const city = new CityDistricts(physics, street.surfaceLibrary, new THREE.Group(), d => built.push(d.spec.id));
    const bkc = cityZones.findIndex(z => z.id === 'bkc'), juhu = cityZones.findIndex(z => z.id === 'juhu');
    city.prepare(bkc);
    expect(city.isReady(bkc)).toBe(false);
    for (let frame = 0; frame < 400 && !city.isReady(bkc); frame++) city.tick(0);
    expect(city.isReady(bkc)).toBe(true); expect(built).toEqual(['bkc']);
    // Arriving finds it finished and does not build it again.
    const district = city.activate(bkc)!;
    expect(district.group.visible).toBe(true); expect(built).toEqual(['bkc']);
    // Heading on to Juhu, then turning back before it is done: the half-built district is released.
    city.prepare(juhu); city.tick(0); city.tick(0);
    expect(city.peek(juhu)?.ready).toBe(false);
    city.prepare(bkc); expect(() => city.activate(bkc)).not.toThrow();
    expect(city.peek(juhu)).toBeNull(); expect(built).toEqual(['bkc']);
    city.dispose();
  }, 60_000);
});
