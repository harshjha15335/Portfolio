import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { MumbaiStreet } from '../src/game/World/MumbaiStreet';
import { CityDistricts } from '../src/game/World/districts/CityDistricts';
import { auditSign, districtOccluder, districtViewers, insideBodies, meshOccluder, walkableViewers, type SignVerdict } from '../src/game/World/districts/signAudit';
import { cityZones } from '../src/game/World/streetLayout';
import type { SignRecord } from '../src/game/World/districts/DistrictSystems';

const ctx: Record<string, unknown> = new Proxy({}, { get: (t: Record<string, unknown>, k: string) => k in t ? t[k] : () => ctx, set: (t, k: string, v) => { t[k] = v; return true; } });
beforeEach(() => vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) }));
afterEach(() => vi.unstubAllGlobals());

const signReport: Array<SignVerdict & { district: string }> = [];

describe('signboards', () => {
  it('every Tier-1 sign is legible from somewhere a visitor can stand, and none is buried in geometry', () => {
    const physics = new CANNON.World(), street = new MumbaiStreet(physics), city = new CityDistricts(physics, street.surfaceLibrary, new THREE.Group(), () => {});
    const failures: string[] = [];
    const check = (district: string, records: SignRecord[], hit: ReturnType<typeof meshOccluder>, viewers: THREE.Vector3[]) => {
      const tier1 = records.filter(r => r.tier === 1);
      expect(tier1.length, `${district} has Tier-1 signs`).toBeGreaterThan(0);
      for (const r of records) {
        if (r.tier === 3) continue;
        const v = auditSign(r, { hit, viewers }); signReport.push({ ...v, district });
        if (r.tier === 1 && v.status === 'FAIL') failures.push(`${district}: "${r.text}" ${v.reason}`);
        // Tier 2 need not be legible (a shop board behind a lamp post is fine), but no sign may be buried or cut.
        if (r.tier === 2 && v.embedded > 1) failures.push(`${district}: "${r.text}" ${v.embedded}/9 of its face buried`);
      }
    };
    // CST and Fort Road: the street's own signs, seen past everything but people, traffic and glass.
    const streetGroup = (street as unknown as { group: THREE.Group }).group;
    check('cst-fort', street.signRecords, meshOccluder(streetGroup, o => o.name === 'street:signs' || /:street:|:driver|bodywork/.test(o.name) || /bodywork/.test(o.parent?.name ?? '')), walkableViewers(insideBodies(physics.bodies)));
    for (const zone of cityZones.slice(1)) {
      const d = city.activate(cityZones.indexOf(zone))!, hit = districtOccluder(d), viewers = districtViewers(d);
      expect(d.signs.dropped, `${zone.id}: signs dropped from a full atlas`).toEqual([]);
      check(zone.id, d.signs.records, hit, viewers);
    }
    if (process.env.SIGN_REPORT) writeFileSync(process.env.SIGN_REPORT, JSON.stringify(signReport.map(s => ({ district: s.district, text: s.text, tier: s.tier, status: s.status, covered: s.covered, embedded: s.embedded, distance: s.best?.distance.toFixed(1), px: s.best?.pixels.toFixed(0), reason: s.reason }))));
    expect(failures).toEqual([]);
  }, 300_000);
});
