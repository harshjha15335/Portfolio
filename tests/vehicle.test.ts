import { describe, expect, it } from 'vitest';
import * as CANNON from 'cannon-es';
import { Vehicle } from '../src/game/Vehicle/Vehicle';
import { defaultTuning, lateralAcceleration, longitudinalAcceleration, nearestLandmark, steeringAngle, turnRate } from '../src/game/Vehicle/driving';

describe('driving model', () => {
  it('accelerates progressively and caps forward and reverse engine force', () => {
    expect(longitudinalAcceleration(1, 0, false)).toBeGreaterThan(longitudinalAcceleration(1, 15, false));
    expect(longitudinalAcceleration(1, defaultTuning.maxSpeed, false)).toBeLessThanOrEqual(0);
    expect(longitudinalAcceleration(-1, -defaultTuning.reverseSpeed, false)).toBeGreaterThanOrEqual(0);
  });
  it('brakes before reversing and applies handbrake drag', () => {
    expect(longitudinalAcceleration(-1, 15, false)).toBeLessThan(-20);
    expect(longitudinalAcceleration(-1, 0, false)).toBeLessThan(0);
    expect(longitudinalAcceleration(0, 15, true)).toBeLessThan(longitudinalAcceleration(0, 15, false));
  });
  it('reduces steering at speed and reverses steering direction in reverse', () => {
    expect(steeringAngle(1, 20)).toBeLessThan(steeringAngle(1, 2));
    expect(turnRate(1, 5, false)).toBeGreaterThan(0);
    expect(turnRate(1, -5, false)).toBeLessThan(0);
    expect(Math.abs(turnRate(5, 100, true))).toBeLessThanOrEqual(1.75);
  });
  it('handbrake loosens lateral grip without accelerating lateral slide', () => {
    expect(Math.abs(lateralAcceleration(2, true))).toBeLessThan(Math.abs(lateralAcceleration(2, false)));
    expect(lateralAcceleration(-2, true)).toBeGreaterThan(0);
  });
  it('selects the closest destination within an interaction radius', () => {
    const landmarks: Array<{ id: string; position: [number, number] }> = [{ id: 'a', position: [0, 0] }, { id: 'b', position: [10, 0] }];
    expect(nearestLandmark([8, 1], landmarks)).toBe('b');
    expect(nearestLandmark([40, 40], landmarks)).toBeNull();
  });
});

describe('Cannon vehicle integration', () => {
  function setup() {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -19, 0) }); world.defaultContactMaterial.friction = 0;
    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), collisionFilterGroup: 1 }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); ground.aabbNeedsUpdate = true; world.addBody(ground);
    const vehicle = new Vehicle(world);
    const advance = (frames: number, throttle: number, steer = 0, handbrake = false) => { for (let index = 0; index < frames; index++) { vehicle.update({ throttle, steer, handbrake }, 1 / 60); world.step(1 / 60); } };
    advance(60, 0); return { vehicle, world, advance };
  }
  it('drives forward, brakes, and reverses on a real physics ground', () => {
    const { vehicle, advance } = setup(); const startZ = vehicle.body.position.z;
    advance(120, 1); expect(vehicle.speed).toBeGreaterThan(8); expect(vehicle.body.position.z).toBeLessThan(startZ - 8);
    advance(180, -1); expect(vehicle.speed).toBeLessThan(-3);
    expect(vehicle.body.position.y).toBeGreaterThan(0.25);
  });
  it('collides with a static barrier and resets all motion', () => {
    const { vehicle, world, advance } = setup();
    world.addBody(new CANNON.Body({ mass: 0, collisionFilterGroup: 1, shape: new CANNON.Box(new CANNON.Vec3(5, 2, 0.5)), position: new CANNON.Vec3(0, 2, -19) }));
    advance(180, 1); expect(vehicle.body.position.z).toBeGreaterThan(-17.1);
    vehicle.reset(3, 4); expect(vehicle.body.position.x).toBe(3); expect(vehicle.body.position.z).toBe(4); expect(vehicle.body.velocity.length()).toBe(0); expect(vehicle.body.angularVelocity.length()).toBe(0);
  });
  it('spawns and resets north of the hub with a clear forward approach to research', () => {
    const { vehicle } = setup(); expect(vehicle.body.position.z).toBeCloseTo(-10);
    vehicle.reset(20, 20, Math.PI); vehicle.reset(); expect(vehicle.body.position.z).toBe(-10); expect(vehicle.body.quaternion.y).toBe(0);
  });
  it('allows a controlled turn without unbounded angular velocity', () => {
    const { vehicle, advance } = setup(); advance(90, 1); advance(120, 1, 1, true);
    expect(Math.abs(vehicle.body.angularVelocity.y)).toBeLessThan(2);
    expect(Math.abs(vehicle.body.position.x)).toBeGreaterThan(2);
    expect(Number.isFinite(vehicle.body.position.z)).toBe(true);
  });
});
