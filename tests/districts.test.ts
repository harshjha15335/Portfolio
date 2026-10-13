import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as CANNON from 'cannon-es';
import { MumbaiStreet } from '../src/game/World/MumbaiStreet';
import { cityRideLegs, cityZones, DISTRICT_SPACING, districtViews, streetStops, zoneAt, zoneIndexAt } from '../src/game/World/streetLayout';
import { CityDistricts } from '../src/game/World/districts/CityDistricts';
import { districts } from '../src/data/city';
import { routeLength } from '../src/game/World/transit';
import * as THREE from 'three';

const ctx = new Proxy({}, { get: (target: Record<string, unknown>, key: string) => key in target ? target[key] : () => {}, set: (target, key: string, value) => { target[key] = value; return true; } });
beforeEach(() => vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) }));
afterEach(() => vi.unstubAllGlobals());

describe('city districts', () => {
  it('places every canonical district in its own zone with a stop and a review pose', () => {
    expect(cityZones.map(z => z.id)).toEqual(['cst', 'bkc', 'andheri', 'powai', 'dadar', 'worli', 'juhu', 'filmcity']);
    for (const zone of cityZones.slice(1)) {
      const stop = streetStops[zone.id];
      expect(stop, zone.id).toBeDefined();
      expect(zoneAt(stop.x).id).toBe(zone.id);
      expect(Math.abs(stop.x - zone.originX)).toBeLessThan(6);
      expect(districtViews[zone.id]).toBeDefined();
    }
    // Every directory entry beyond CST–Fort has a physical place to ride to.
    expect(districts.filter(d => !streetStops[d.id]).map(d => d.id)).toEqual([]);
    expect(zoneIndexAt(-30)).toBe(0); expect(zoneIndexAt(DISTRICT_SPACING * 3 + 12)).toBe(3);
  });
  it('rides between districts as an exit leg and an arrival leg that end at the stop', () => {
    const legs = cityRideLegs({ x: 4.6, z: 11.5 }, 'juhu');
    expect(legs).toHaveLength(2);
    expect(zoneAt(legs[0][0].x).id).toBe('cst');
    const last = legs[1][legs[1].length - 1];
    // The vehicle pulls up at the kerb beside the stop.
    expect(Math.hypot(last.x - streetStops.juhu.x, last.z - streetStops.juhu.z)).toBeLessThan(2);
    expect(legs.every(leg => routeLength(leg) > 5)).toBe(true);
    // Each leg stays inside one district; the cut between them is the only jump.
    for (const leg of legs) expect(new Set(leg.map(p => zoneAt(p.x).id)).size).toBe(1);
    // Within one district a single leg is enough.
    expect(cityRideLegs({ x: 4.6, z: 11.5 }, 'fort')).toHaveLength(1);
    expect(cityRideLegs({ x: 4.6, z: 11.5 }, 'nowhere')).toEqual([]);
  });
  it('builds each district within budget, with a guide to talk to, and releases it on dispose', () => {
    const physics = new CANNON.World(), street = new MumbaiStreet(physics), root = new THREE.Group();
    const city = new CityDistricts(physics, street.surfaceLibrary, root, () => {});
    const baseline = physics.bodies.length;
    for (let i = 1; i < cityZones.length; i++) {
      const district = city.activate(i)!;
      expect(district.interactions.map(p => p.id)).toContain(cityZones[i].id);
      let draws = 0, triangles = 0;
      district.group.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; draws++; const g = m.geometry; triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3; });
      expect(draws, cityZones[i].id).toBeLessThan(110);
      expect(triangles, cityZones[i].id).toBeLessThan(400_000);
      // Only the active district is kept alive.
      expect(root.children).toHaveLength(1);
    }
    city.dispose();
    expect(physics.bodies.length).toBe(baseline);
    expect(root.children).toHaveLength(0);
  }, 120_000);
});
