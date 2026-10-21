import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as CANNON from 'cannon-es';
import { MumbaiStreet } from '../src/game/World/MumbaiStreet';
import { acrossSeam, cityRideLegs, cityZones, DISTRICT_SPACING, districtViews, streetStops, zoneAt, zoneIndexAt } from '../src/game/World/streetLayout';
import { CityDistricts } from '../src/game/World/districts/CityDistricts';
import { createCityVehicle } from '../src/game/World/districts/CityVehicles';
import { districts } from '../src/data/city';
import { routeLength } from '../src/game/World/transit';
import * as THREE from 'three';

const ctx: Record<string, unknown> = new Proxy({}, { get: (target: Record<string, unknown>, key: string) => key in target ? target[key] : () => ctx, set: (target, key: string, value) => { target[key] = value; return true; } });
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
  it('rides between districts as one leg per district driven through, meeting at the seams, ending at the stop', () => {
    const legs = cityRideLegs({ x: 4.6, z: 11.5 }, 'juhu');
    // CST, BKC, Andheri, Powai, Dadar, Worli, Juhu: the cab drives every avenue and street between, no teleport.
    expect(legs).toHaveLength(7);
    expect(legs.map(l => zoneAt(l[0].x).id)).toEqual(['cst', 'bkc', 'andheri', 'powai', 'dadar', 'worli', 'juhu']);
    // Each leg ends at the seam where the next begins: the same place in the two districts' frames.
    for (let i = 0; i + 1 < legs.length; i++) { const end = legs[i][legs[i].length - 1], start = legs[i + 1][0], across = acrossSeam(end.x, end.z - .01) ?? acrossSeam(end.x, end.z + .01); expect(across, `seam ${i}`).not.toBeNull(); expect(Math.hypot(across!.x - start.x, across!.z - start.z), `seam ${i}`).toBeLessThan(1.5); }
    const last = legs[legs.length - 1][legs[legs.length - 1].length - 1];
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
      // Static architecture merges to a handful of draws; people and vehicles carry a far LOD.
      let staticDraws = 0, staticTriangles = 0, movers = 0;
      district.group.traverse(o => {
        const m = o as THREE.Mesh; if (!m.isMesh) return;
        if (m.name.startsWith('district:')) { staticDraws++; const g = m.geometry; staticTriangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3; }
        else movers++;
      });
      district.crowd.group.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) expect((o.userData.lodGeometries as unknown[]).length).toBe(3); });
      for (const v of district.traffic.group.children.filter(c => c.name !== 'traffic:brake-lights')) expect((v.userData.lodGeometries as unknown[]).length).toBe(3);
      // Nobody stands inside anybody else.
      const standing = district.crowd.standing().map(p => p.group.position);
      for (let a = 0; a < standing.length; a++) for (let b = a + 1; b < standing.length; b++) expect(Math.hypot(standing[a].x - standing[b].x, standing[a].z - standing[b].z), cityZones[i].id).toBeGreaterThan(.8);
      // The avenues to the neighbours draw in the district's own meshes (no extra draws); their triangles are budgeted
      // apart: each copy carries fine detail only on its own half, so it stays well under the street's own budget.
      const avenues = district.avenues.map(a => a.kit.bakedTriangles);
      expect(staticDraws, cityZones[i].id).toBeLessThan(21);
      expect(staticTriangles - avenues.reduce((t, n) => t + n, 0), cityZones[i].id).toBeLessThan(180_000);
      for (const n of avenues) expect(n, `${cityZones[i].id} avenue`).toBeLessThan(75_000);
      expect(avenues.length, cityZones[i].id).toBe(i === cityZones.length - 1 ? 1 : 2);
      expect(movers, cityZones[i].id).toBeLessThan(120);
      // Only the active district is kept alive.
      expect(root.children).toHaveLength(1);
    }
    city.dispose();
    expect(physics.bodies.length).toBe(baseline);
    expect(root.children).toHaveLength(0);
  }, 120_000);
  it('builds smooth vehicles whose far version is a fraction of the near one', () => {
    const triangles = (m: THREE.Mesh) => (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3;
    for (const kind of ['hatch', 'sedan', 'suv', 'taxi', 'bus', 'auto', 'bike', 'cycle', 'tempo', 'cart'] as const) {
      const near = createCityVehicle(kind, 'test'), far = createCityVehicle(kind, 'test', true, true);
      expect(triangles(near), kind).toBeLessThan(7000);
      expect(triangles(far), kind).toBeLessThan(triangles(near) * .55);
      near.geometry.dispose(); far.geometry.dispose();
    }
  });
});
