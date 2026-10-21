import * as THREE from 'three';
import { VEHICLE_BODY, type DriveState, type VehicleClass } from './TrafficSafety';
import { nightLights } from '../time/nightLights';

/** Rear lamp height and half spacing (m) per class; handcarts and bicycles have none. */
const LAMPS: Partial<Record<VehicleClass, { y: number; x: number }>> = {
  bus: { y: .95, x: 1.08 }, hatch: { y: .82, x: .66 }, sedan: { y: .8, x: .68 }, suv: { y: 1.0, x: .74 }, taxi: { y: .8, x: .66 },
  auto: { y: .72, x: .5 }, bike: { y: .78, x: 0 }, tempo: { y: .78, x: .84 },
};
/** Decelerating harder than this (m/s²), or standing in a held state, lights the brake lamps; they stay on briefly after. */
const BRAKING = .7, AFTERGLOW = .35;
const HELD: ReadonlySet<DriveState> = new Set(['stopping', 'stopped', 'waiting-signal', 'yielding']);

/** Below this lamp level (see nightLights) it is day: no tail, head lamps or beams. */
const DARK = .05;

/**
 * Vehicle lamps for a street's traffic, four instanced meshes: brake lamps on every vehicle braking or standing held;
 * and after dark, dimmer tail lamps, head lamps and the pool each pair of head lamps throws on the road ahead (an
 * additive ground decal, not a light). Brake, tail and head lamps share one shader; the night meshes are hidden (not
 * drawn, not compiled) while empty, so by day this is exactly the brake-lamp mesh it was.
 */
export class BrakeLights {
  readonly mesh: THREE.InstancedMesh;
  /** Tail lamps, head lamps and their road beams; children of `mesh`, so adding `mesh` to a street adds them too. */
  readonly tails: THREE.InstancedMesh; readonly heads: THREE.InstancedMesh; readonly beams: THREE.InstancedMesh;
  private state = new WeakMap<object, { speed: number; lit: number }>();
  private count = 0; private tailCount = 0; private headCount = 0; private beamCount = 0; private m = new THREE.Matrix4(); private lamp = new THREE.Matrix4();
  constructor(private capacity = 64) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, .1, .03), new THREE.MeshBasicMaterial({ color: '#ff2414', toneMapped: false }), capacity * 2);
    this.mesh.name = 'traffic:brake-lights'; this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.tails = new THREE.InstancedMesh(this.mesh.geometry, new THREE.MeshBasicMaterial({ color: '#8a120a', toneMapped: false }), capacity * 2);
    this.tails.name = 'traffic:tail-lamps'; this.tails.frustumCulled = false; this.tails.count = 0; this.tails.visible = false;
    this.heads = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, .12, .03), new THREE.MeshBasicMaterial({ color: '#fff3d6', toneMapped: false }), capacity * 2);
    this.heads.name = 'traffic:head-lamps'; this.heads.frustumCulled = false; this.heads.count = 0; this.heads.visible = false;
    const beam = new THREE.PlaneGeometry(1, 1); beam.rotateX(-Math.PI / 2);
    this.beams = new THREE.InstancedMesh(beam, new THREE.MeshBasicMaterial({ color: '#ffe8b8', map: beamMap(), transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }), capacity);
    this.beams.name = 'traffic:head-beams'; this.beams.frustumCulled = false; this.beams.count = 0; this.beams.renderOrder = 1; this.beams.visible = false;
    this.mesh.add(this.tails, this.heads, this.beams);
  }
  /** Whether a vehicle should show brake lamps this frame (keyed by `key`, usually the vehicle's mesh). */
  braking(key: object, speed: number, state: DriveState, delta: number) {
    let s = this.state.get(key); if (!s) { s = { speed, lit: 0 }; this.state.set(key, s); }
    const decel = delta > 0 ? (s.speed - speed) / delta : 0; s.speed = speed;
    if (decel > BRAKING || (HELD.has(state) && speed < 2)) s.lit = AFTERGLOW; else s.lit = Math.max(0, s.lit - delta);
    return s.lit > 0;
  }
  begin() { this.count = 0; this.tailCount = 0; this.headCount = 0; this.beamCount = 0; }
  /**
   * Light the lamps of `object` (a vehicle whose front faces −Z) of class `kind`; its matrix must be current. A
   * vehicle that is not braking only lights up after dark (tail and head lamps).
   */
  add(object: THREE.Object3D, kind: VehicleClass, braking = true) {
    const lamp = LAMPS[kind], dark = nightLights.level > DARK; if (!lamp || (!braking && !dark) || this.count + 2 > this.capacity * 2 || this.tailCount + 2 > this.capacity * 2) return;
    object.updateMatrix();
    const half = VEHICLE_BODY[kind].length / 2, xs = lamp.x ? [-lamp.x, lamp.x] : [0];
    for (const x of xs) {
      this.lamp.makeTranslation(x, lamp.y, half - .01); this.m.multiplyMatrices(object.matrix, this.lamp);
      if (braking) this.mesh.setMatrixAt(this.count++, this.m); else this.tails.setMatrixAt(this.tailCount++, this.m);
    }
    if (!dark) return;
    for (const x of xs) { this.lamp.makeTranslation(x * .95, lamp.y + .06, -half + .01); this.heads.setMatrixAt(this.headCount++, this.m.multiplyMatrices(object.matrix, this.lamp)); }
    const width = Math.max(1.6, lamp.x * 3), reach = kind === 'bus' ? 9 : 7;
    this.lamp.makeScale(width, 1, reach).setPosition(0, .05, -half - reach / 2 + .4);
    this.beams.setMatrixAt(this.beamCount++, this.m.multiplyMatrices(object.matrix, this.lamp));
  }
  end() {
    this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true;
    for (const [m, n] of [[this.tails, this.tailCount], [this.heads, this.headCount], [this.beams, this.beamCount]] as const) { m.count = n; m.visible = n > 0; m.instanceMatrix.needsUpdate = true; }
    (this.beams.material as THREE.MeshBasicMaterial).opacity = .5 * nightLights.level;
  }
  dispose() { for (const m of [this.mesh, this.tails, this.heads, this.beams]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); } }
}

let beamTexture: THREE.Texture | null = null;
/** Head-lamp throw on the road: brightest just ahead of the bumper, widening and fading with distance. */
function beamMap() {
  if (beamTexture || typeof document === 'undefined') return beamTexture;
  const c = document.createElement('canvas'); c.width = 32; c.height = 64; const ctx = c.getContext('2d');
  if (!ctx?.createLinearGradient?.(0, 0, 1, 0)) return null; // headless test canvases
  // Canvas row 0 lands at the far end of the beam (v = 1, toward −Z after the flat turn), row 63 at the bumper.
  for (let y = 0; y < 64; y++) {
    const near = y / 63, spread = .3 + .7 * (1 - near), alpha = (.15 + .85 * Math.pow(near, .9)) * Math.min(1, (1 - near) * 12);
    const g = ctx.createLinearGradient(0, 0, 32, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(Math.max(.01, .5 - spread / 2), 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(255,255,255,${alpha.toFixed(3)})`); g.addColorStop(Math.min(.99, .5 + spread / 2), 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y, 32, 1);
  }
  beamTexture = new THREE.CanvasTexture(c); beamTexture.colorSpace = THREE.SRGBColorSpace; return beamTexture;
}
