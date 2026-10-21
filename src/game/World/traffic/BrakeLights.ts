import * as THREE from 'three';
import { VEHICLE_BODY, type DriveState, type VehicleClass } from './TrafficSafety';

/** Rear lamp height and half spacing (m) per class; handcarts and bicycles have none. */
const LAMPS: Partial<Record<VehicleClass, { y: number; x: number }>> = {
  bus: { y: .95, x: 1.08 }, hatch: { y: .82, x: .66 }, sedan: { y: .8, x: .68 }, suv: { y: 1.0, x: .74 }, taxi: { y: .8, x: .66 },
  auto: { y: .72, x: .5 }, bike: { y: .78, x: 0 }, tempo: { y: .78, x: .84 },
};
/** Decelerating harder than this (m/s²), or standing in a held state, lights the brake lamps; they stay on briefly after. */
const BRAKING = .7, AFTERGLOW = .35;
const HELD: ReadonlySet<DriveState> = new Set(['stopping', 'stopped', 'waiting-signal', 'yielding']);

/**
 * Brake lamps for a street's traffic: one instanced mesh of small glowing lamps (one draw), placed each frame on
 * the rear of every vehicle that is braking or standing held, and hidden otherwise.
 */
export class BrakeLights {
  readonly mesh: THREE.InstancedMesh;
  private state = new WeakMap<object, { speed: number; lit: number }>();
  private count = 0; private m = new THREE.Matrix4(); private lamp = new THREE.Matrix4();
  constructor(private capacity = 64) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, .1, .03), new THREE.MeshBasicMaterial({ color: '#ff2414', toneMapped: false }), capacity * 2);
    this.mesh.name = 'traffic:brake-lights'; this.mesh.frustumCulled = false; this.mesh.count = 0;
  }
  /** Whether a vehicle should show brake lamps this frame (keyed by `key`, usually the vehicle's mesh). */
  braking(key: object, speed: number, state: DriveState, delta: number) {
    let s = this.state.get(key); if (!s) { s = { speed, lit: 0 }; this.state.set(key, s); }
    const decel = delta > 0 ? (s.speed - speed) / delta : 0; s.speed = speed;
    if (decel > BRAKING || (HELD.has(state) && speed < 2)) s.lit = AFTERGLOW; else s.lit = Math.max(0, s.lit - delta);
    return s.lit > 0;
  }
  begin() { this.count = 0; }
  /** Light the lamps of `object` (a vehicle whose front faces −Z) of class `kind`. Its matrix must be current. */
  add(object: THREE.Object3D, kind: VehicleClass) {
    const lamp = LAMPS[kind]; if (!lamp || this.count + 2 > this.capacity * 2) return;
    object.updateMatrix();
    for (const x of lamp.x ? [-lamp.x, lamp.x] : [0]) {
      this.lamp.makeTranslation(x, lamp.y, VEHICLE_BODY[kind].length / 2 - .01);
      this.mesh.setMatrixAt(this.count++, this.m.multiplyMatrices(object.matrix, this.lamp));
    }
  }
  end() { this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true; }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
}
