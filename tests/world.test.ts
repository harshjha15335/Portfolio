import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { Campus, landmarkArrival, type Landmark } from '../src/game/World/Campus';
import { Vehicle } from '../src/game/Vehicle/Vehicle';
import { nearestLandmark } from '../src/game/Vehicle/driving';
import { projects } from '../src/data/projects';

const landmarks: Landmark[] = projects.filter(project => project.priority <= 4).map(project => ({ id: project.id, title: project.title, position: [...project.worldPosition], color: project.color }));
landmarks.push({ id: 'garage', title: 'Garage', position: [23, 0, 32], color: '#3155ff' }, { id: 'about', title: 'About', position: [-23, 0, 32], color: '#f2efe7' });

beforeEach(() => {
  // Unit tests exercise real world geometry/physics; text rasterization is a browser concern.
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, measureText: (text: string) => ({ width: text.length * 50 }) }) }) });
});
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -19, 0) });
  world.defaultContactMaterial.friction = 0; world.broadphase = new CANNON.SAPBroadphase(world);
  const campus = new Campus(world, landmarks), vehicle = new Vehicle(world);
  const advance = (frames: number, throttle = 0) => {
    let highest = vehicle.body.position.y;
    for (let index = 0; index < frames; index++) {
      vehicle.update({ throttle, steer: 0, handbrake: false }, 1 / 60); world.step(1 / 60);
      highest = Math.max(highest, vehicle.body.position.y);
    }
    return highest;
  };
  advance(60); return { world, campus, vehicle, advance };
}

describe('editorial world physical routes', () => {
  it('leaves the spawn lane driveable until research can be opened', () => {
    const { vehicle, advance } = setup();
    advance(75, 1);
    expect(vehicle.body.position.z).toBeLessThan(-16);
    expect(vehicle.speed).toBeGreaterThan(5);
    expect(nearestLandmark([vehicle.body.position.x, vehicle.body.position.z], landmarks.map(landmark => ({ id: landmark.id, position: [landmark.position[0], landmark.position[2]] })), 14)).toBe('ffprime');
  });

  it('keeps every directory arrival clear, grounded and inside interaction range', () => {
    const { world, vehicle, advance } = setup();
    for (const landmark of landmarks) {
      const { x, z, heading, direction } = landmarkArrival(landmark);
      vehicle.reset(x, z, heading); advance(60);
      expect(Math.hypot(vehicle.body.position.x - x, vehicle.body.position.z - z), `${landmark.id} arrival must not overlap geometry`).toBeLessThan(0.15);
      expect(vehicle.body.position.y).toBeGreaterThan(0.25);
      expect(vehicle.body.position.y).toBeLessThan(1);
      expect(Math.hypot(vehicle.body.position.x - landmark.position[0], vehicle.body.position.z - landmark.position[2])).toBeLessThan(14);
      const hit = new CANNON.RaycastResult();
      world.raycastClosest(new CANNON.Vec3(x, 0.8, z), new CANNON.Vec3(x + direction.x * 3, 0.8, z + direction.z * 3), { collisionFilterMask: 1 }, hit);
      expect(hit.hasHit, `${landmark.id} exit must be unobstructed`).toBe(false);
    }
  });

  it('drives over the bridge on real colliders without losing the route', () => {
    const { vehicle, advance } = setup(); vehicle.reset(15, -18, Math.PI); advance(60);
    const highest = advance(210, 1);
    expect(highest).toBeGreaterThan(2.7);
    expect(vehicle.body.position.z).toBeGreaterThan(4);
    expect(Math.abs(vehicle.body.position.x - 15)).toBeLessThan(1);
    expect(Number.isFinite(vehicle.body.position.y)).toBe(true);
  });

  it('keeps the east-west road beneath the bridge open', () => {
    const { world, vehicle, advance } = setup();
    const hit = new CANNON.RaycastResult();
    world.raycastClosest(new CANNON.Vec3(8, 1.2, 0), new CANNON.Vec3(22, 1.2, 0), { collisionFilterMask: 1 }, hit);
    expect(hit.hasHit).toBe(false);
    vehicle.reset(8, 0, -Math.PI / 2); advance(60); const highest = advance(120, 1);
    expect(vehicle.body.position.x).toBeGreaterThan(19);
    expect(highest).toBeLessThan(1.2);
  });

  it('batches repeated primitives and freezes ambient motion when requested', () => {
    const { campus } = setup(); const instances: THREE.InstancedMesh[] = [];
    campus.group.traverse(object => { if (object instanceof THREE.InstancedMesh) instances.push(object); });
    expect(instances.reduce((sum, mesh) => sum + mesh.count, 0)).toBeGreaterThan(350);
    expect(instances.length).toBeLessThan(20);
    expect(campus.targets.map(target => target.userData.landmarkId)).toEqual(landmarks.map(landmark => landmark.id));
    const snapshot = () => {
      const transforms: number[][] = [];
      campus.group.traverse(object => { object.updateMatrix(); transforms.push([...object.matrix.elements]); });
      return transforms;
    };
    const initial = snapshot(); campus.update(10, false);
    expect(snapshot()).not.toEqual(initial);
    const before = snapshot();
    campus.update(100, true);
    expect(snapshot()).toEqual(before);
  });
});
