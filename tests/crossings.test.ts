import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { MumbaiStreet } from '../src/game/World/MumbaiStreet';
import { CityDistricts } from '../src/game/World/districts/CityDistricts';
import { cityZones } from '../src/game/World/streetLayout';
import { crossingHeld, pedestrianGreen, SIGNAL_CYCLE } from '../src/game/World/traffic/RoadTraffic';

const ctx: Record<string, unknown> = new Proxy({}, { get: (t: Record<string, unknown>, k: string) => k in t ? t[k] : () => ctx, set: (t, k: string, v) => { t[k] = v; return true; } });
beforeEach(() => vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) }));
afterEach(() => vi.unstubAllGlobals());

describe('zebra crossings', () => {
  it('hold traffic from the walk signal until a late starter is across', () => {
    for (let t = 0; t < SIGNAL_CYCLE * 2; t += .25) if (pedestrianGreen(t)) expect(crossingHeld(t), `t=${t}`).toBe(true);
    // The last moment anyone may step off leaves enough held road for 8.7 m at 1 m/s (Fort's walkers start from 4.8 m out).
    let last = 0; for (let t = 0; t < SIGNAL_CYCLE; t += .05) if (pedestrianGreen(t)) last = t;
    let held = 0; for (let t = last; crossingHeld(t); t += .05) held += .05;
    expect(held).toBeGreaterThan(8.7);
  });
  it('let district walkers cross on the signal without traffic driving through them', () => {
    const physics = new CANNON.World(), street = new MumbaiStreet(physics), city = new CityDistricts(physics, street.surfaceLibrary, new THREE.Group(), () => {});
    for (const id of cityZones.slice(1).map(z => z.id)) {
      const i = cityZones.findIndex(z => z.id === id), d = city.activate(i)!, view = new THREE.Vector3(d.origin.x - 5.6, 1.6, -24);
      const crossers = d.crowd.crossers();
      expect(crossers.length, id).toBe(2);
      let crossed = 0, onRoadWhileFree = 0; const lastSide = new Map<unknown, number>();
      for (let t = 1; t < SIGNAL_CYCLE * 3; t += 1 / 20) {
        d.update(t, false, view);
        for (const p of crossers) {
          const { x, z } = p.group.position;
          if (Math.abs(x) < 3.9 && !crossingHeld(t)) onRoadWhileFree++;
          if (Math.abs(x) > 4.3) { if (lastSide.has(p) && lastSide.get(p) !== Math.sign(x)) crossed++; lastSide.set(p, Math.sign(x)); }
          for (const v of d.traffic.moving) {
            const rx = x - v.position.x, rz = z - v.position.z, along = Math.abs(-rx * Math.sin(v.yaw) - rz * Math.cos(v.yaw)), side = Math.abs(rx * Math.cos(v.yaw) - rz * Math.sin(v.yaw));
            expect(along < v.length / 2 + .3 && side < 1.15, `${id}: ${v.kind} through a crosser at t=${t.toFixed(2)}`).toBe(false);
          }
        }
      }
      expect(crossed, `${id} crossings`).toBeGreaterThanOrEqual(4);
      expect(onRoadWhileFree, `${id}: frames a crosser was on the road with traffic free`).toBe(0);
    }
  }, 180_000);
});
