import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BrakeLights } from '../src/game/World/traffic/BrakeLights';

describe('brake lights', () => {
  it('light while slowing or held, stay on briefly, and go out when cruising', () => {
    const lights = new BrakeLights(), car = {};
    expect(lights.braking(car, 6, 'cruising', .1)).toBe(false);
    expect(lights.braking(car, 5.8, 'following', .1)).toBe(true); // 2 m/s²
    expect(lights.braking(car, 5.8, 'following', .1)).toBe(true); // afterglow
    for (let i = 0; i < 4; i++) lights.braking(car, 5.8, 'cruising', .1);
    expect(lights.braking(car, 5.8, 'cruising', .1)).toBe(false);
    expect(lights.braking(car, 0, 'waiting-signal', .1)).toBe(true);
    for (let i = 0; i < 20; i++) expect(lights.braking(car, 0, 'waiting-signal', .1)).toBe(true);
  });
  it('sit on the rear of each lit vehicle, two lamps per car, one for a bike, none for a handcart', () => {
    const lights = new BrakeLights(), car = new THREE.Object3D(); car.position.set(2, .02, -10); car.rotation.y = Math.PI / 2;
    lights.begin(); lights.add(car, 'sedan'); lights.add(new THREE.Object3D(), 'bike'); lights.add(new THREE.Object3D(), 'cart'); lights.end();
    expect(lights.mesh.count).toBe(3);
    const m = new THREE.Matrix4(), p = new THREE.Vector3(); lights.mesh.getMatrixAt(0, m); p.setFromMatrixPosition(m);
    // Facing −x (yaw π/2 turns −z to −x), so the rear is at +x.
    expect(p.x).toBeCloseTo(2 + 2.2 - .01, 2); expect(p.y).toBeCloseTo(.82, 2); expect(Math.abs(p.z + 10)).toBeCloseTo(.68, 2);
  });
});
