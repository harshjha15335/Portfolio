import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { MumbaiStreet } from '../src/game/World/MumbaiStreet';
import { CityDistricts } from '../src/game/World/districts/CityDistricts';
import { auditSign, districtOccluder, districtViewers, faceSamples, insideBodies } from '../src/game/World/districts/signAudit';
import { cityZones } from '../src/game/World/streetLayout';
import { DISTRICT_EXHIBITS } from '../src/data/districtExhibits';
import type { SignAtlas } from '../src/game/World/districts/DistrictSystems';

const ctx: Record<string, unknown> = new Proxy({}, { get: (t: Record<string, unknown>, k: string) => k in t ? t[k] : () => ctx, set: (t, k: string, v) => { t[k] = v; return true; } });
beforeEach(() => vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) }));
afterEach(() => vi.unstubAllGlobals());

/**
 * Exhibit boards carry the portfolio's content, so they get a stricter audit than street signs: the body lines are
 * 8.5% of the 0.65 m face, and need about 8 px to read, so the whole face must reach 100 px on a 720 px tall view
 * (about 3.5 m away) from a spot a visitor can stand, with nothing in front of it.
 */
const READ_PIXELS = 100;

describe('exhibit boards', () => {
  it('every exhibit board can be read up close from a free standing spot, with nothing in front of it', () => {
    const physics = new CANNON.World(), street = new MumbaiStreet(physics), city = new CityDistricts(physics, street.surfaceLibrary, new THREE.Group(), () => {});
    const failures: string[] = [], report: unknown[] = [];
    let audited = 0;
    for (const zone of cityZones.slice(1)) {
      const d = city.activate(cityZones.indexOf(zone))!, atlas = (d as unknown as { exhibitSigns: SignAtlas | null }).exhibitSigns;
      const boards = DISTRICT_EXHIBITS.filter(e => e.district === zone.id && e.mount !== 'marker');
      if (!boards.length) continue;
      expect(atlas, `${zone.id} builds its exhibit boards`).toBeTruthy();
      const records = atlas!.records, hit = districtOccluder(d), inside = insideBodies(d.kit.bodies, d.origin), viewers = districtViewers(d);
      expect(records.length, `${zone.id}: one board face per exhibit`).toBe(boards.length);
      for (const r of records) {
        audited++;
        // The reading spot the guide and the tests use: 1.9 m out from the face, at eye height.
        const spot = r.center.clone().addScaledVector(r.normal, 1.9).setY(1.6);
        const v = auditSign(r, { hit, viewers: [...viewers, spot], minPixels: READ_PIXELS });
        const free = !inside(spot), seen = faceSamples(r).filter(s => { const dir = s.clone().sub(spot), len = dir.length(); return hit(spot, dir.divideScalar(len), len - .05) === null; }).length;
        report.push({ district: zone.id, title: r.text, status: v.status, covered: v.covered, bestDistance: v.best?.distance.toFixed(1), px: v.best?.pixels.toFixed(0), spotFree: free, spotSamples: seen });
        if (v.status === 'FAIL') failures.push(`${zone.id}: "${r.text}" ${v.reason}`);
        if (!free) failures.push(`${zone.id}: "${r.text}" reading spot is inside a solid`);
        if (seen < 8) failures.push(`${zone.id}: "${r.text}" only ${seen}/9 of the face in sight from its reading spot`);
      }
    }
    if (process.env.EXHIBIT_REPORT) writeFileSync(process.env.EXHIBIT_REPORT, JSON.stringify(report, null, 1));
    expect(audited).toBe(DISTRICT_EXHIBITS.filter(e => e.mount !== 'marker').length);
    expect(failures).toEqual([]);
  }, 300_000);
});
