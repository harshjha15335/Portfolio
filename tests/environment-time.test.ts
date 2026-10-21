import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EnvironmentTime } from '../src/core/EnvironmentTime';
import { createAtmosphereUniforms, createSkyMaterial, type SkyUniforms } from '../src/game/World/StreetAtmosphere';
import { IndiaWorldClock, istInstant } from '../src/game/World/time/IndiaWorldClock';
import { nightLights } from '../src/game/World/time/nightLights';

function rig(h: number, m: number, date: [number, number, number] = [2026, 10, 21]) {
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog('#fff', 1, 2); scene.background = new THREE.Color();
  const renderer = { shadowMap: { needsUpdate: false }, toneMappingExposure: 1 } as unknown as THREE.WebGLRenderer;
  const sun = new THREE.DirectionalLight(), bounce = new THREE.DirectionalLight(), fill = new THREE.HemisphereLight();
  const atmosphere = createAtmosphereUniforms(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), '#fff');
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1), createSkyMaterial(atmosphere));
  const env = new EnvironmentTime(new IndiaWorldClock(istInstant(date[0], date[1], date[2], h, m)), { scene, renderer, sun, bounce, fill, sky, atmosphere });
  env.configure(0, true);
  return { env, scene, renderer, sun, bounce, fill, sky: (sky.material as THREE.ShaderMaterial).userData.sky as SkyUniforms };
}
const inShadow = (sun: THREE.DirectionalLight, p: THREE.Vector3) => {
  const cam = sun.shadow.camera; cam.position.copy(sun.position); cam.lookAt(sun.target.position); cam.updateMatrixWorld();
  const v = p.clone().applyMatrix4(cam.matrixWorldInverse);
  return v.x >= cam.left - 1e-6 && v.x <= cam.right + 1e-6 && v.y >= cam.bottom - 1e-6 && v.y <= cam.top + 1e-6 && -v.z >= cam.near && -v.z <= cam.far;
};

describe('environment time rig', () => {
  it('at 23:00 IST it is night: moonlight only, lamps on, no sun in the sky, dark fog', () => {
    const { sun, sky, scene, env } = rig(23, 0);
    expect(env.sample.phase).toBe('night'); expect(nightLights.level).toBe(1);
    expect(sun.intensity).toBeLessThan(.5); expect(sky.uGlow.value).toBe(0); expect(sky.uStars.value).toBe(1);
    const fog = (scene.fog as THREE.Fog).color; expect(fog.r + fog.g + fog.b).toBeLessThan(.05);
  });
  it('at 12:30 IST the sun is high in the south, strong, and the lamps are off', () => {
    const { sun, env } = rig(12, 30);
    expect(env.sample.phase).toBe('day'); expect(nightLights.level).toBe(0); expect(sun.intensity).toBeGreaterThan(4);
    const dir = sun.position.clone().sub(sun.target.position).normalize();
    expect(dir.y).toBeGreaterThan(.8); expect(dir.x).toBeLessThan(-.3); // world −X is south
  });
  it('lights the west-facing station front (−Z) in the late afternoon', () => {
    const { sun } = rig(16, 30); const dir = sun.position.clone().sub(sun.target.position).normalize(); expect(dir.z).toBeLessThan(-.5);
  });
  it('fits the shadow camera around the whole street for any sun position', () => {
    for (const [h, m] of [[7, 0], [9, 30], [12, 30], [15, 0], [17, 45], [23, 0]]) {
      const { sun } = rig(h, m);
      for (const p of [[-30, 0, -68], [30, 0, -68], [-30, 0, 22], [30, 0, 22], [0, 28, -20], [0, 0, 0]]) expect(inShadow(sun, new THREE.Vector3(...p))).toBe(true);
    }
  });
  it('recomputes every few seconds, not every frame, and on demand', () => {
    const { env, renderer } = rig(18, 0); renderer.shadowMap.needsUpdate = false;
    const t = 100000; expect(env.update(t, true)).toBe(true); expect(env.update(t + 1000)).toBe(false); expect(env.update(t + 6000)).toBe(true);
  });
  it('follows the visitor to another district without changing the moment', () => {
    const { env, sun } = rig(12, 30); const before = env.sample.epoch; env.configure(600 * 3, true);
    expect(env.sample.epoch).toBe(before); expect(sun.target.position.x).toBeCloseTo(1800, 3); expect(inShadow(sun, new THREE.Vector3(1800, 0, -20))).toBe(true);
  });
});
