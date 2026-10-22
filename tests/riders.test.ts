import { describe, expect, it } from 'vitest';
import { CAB_WHEEL, createCityVehicle, type CityVehicleKind, type RiderGrip } from '../src/game/World/districts/CityVehicles';
import { RIDER_GRIPS } from '../src/game/World/districts/riders';

describe('riders hold the controls', () => {
  it('gives every vehicle with a driving seat a grip to hold', () => {
    const kinds: CityVehicleKind[] = ['bus', 'hatch', 'sedan', 'taxi', 'auto', 'bike', 'tempo', 'cart', 'cycle', 'suv'];
    for (const kind of kinds) for (let i = 0; i < 6; i++) {
      const mesh = createCityVehicle(kind, `grip-test-${i}`, false);
      if (mesh.userData.seat) expect(RIDER_GRIPS[mesh.userData.grip as RiderGrip], `${kind} ${i}`).toBeDefined();
      else expect(mesh.userData.grip).toBeNull();
    }
  });
  it('puts bus and tempo hands on the steering wheel rim, at ten to two', () => {
    for (const grip of ['bus', 'tempo'] as const) {
      const [x, y, z] = RIDER_GRIPS[grip].hand, [cx, cy, cz] = CAB_WHEEL.at;
      expect(Math.hypot(x - cx, y - cy, z - cz)).toBeCloseTo(CAB_WHEEL.radius, 1);
      expect(x).toBeLessThan(cx); expect(y).toBeGreaterThan(cy);
    }
  });
  it('keeps every grip within reach: ahead of and above the seat, no wider than the shoulders allow', () => {
    for (const [name, g] of Object.entries(RIDER_GRIPS)) {
      const [x, y, z] = g.hand;
      expect(z, name).toBeLessThan(0); expect(y, name).toBeGreaterThan(0); expect(Math.abs(x), name).toBeLessThan(.4);
      expect(Math.hypot(x + .18, y - .62, z - .05 - g.forward), name).toBeLessThan(.95);
    }
  });
});
