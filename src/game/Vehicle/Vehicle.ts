import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { defaultTuning, lateralAcceleration, longitudinalAcceleration, steeringAngle, turnRate, type DrivingInput } from './driving';

export class Vehicle {
  readonly body: CANNON.Body;
  readonly mesh = new THREE.Group();
  readonly tuning = { ...defaultTuning };
  private shell = new THREE.Group();
  private wheels: THREE.Group[] = [];
  private wheelSpin = 0;
  private currentSteer = 0;
  private ray = new CANNON.RaycastResult();
  private forward = new CANNON.Vec3();
  private right = new CANNON.Vec3();
  private force = new CANNON.Vec3();
  private grounded = false;
  private flippedFor = 0;
  speed = 0;
  constructor(private world: CANNON.World) {
    this.body = new CANNON.Body({ mass: 140, shape: new CANNON.Box(new CANNON.Vec3(0.88, 0.29, 1.63)), position: new CANNON.Vec3(0, 0.68, -10), linearDamping: 0.06, angularDamping: 0.62, collisionFilterGroup: 2, collisionFilterMask: 1 });
    this.body.material = new CANNON.Material('vehicle');
    this.world.addBody(this.body);
    this.mesh.add(this.shell);
    const bodyPaint = new THREE.MeshStandardMaterial({ color: '#3155ff', roughness: 0.75, metalness: 0.12 });
    const paper = new THREE.MeshStandardMaterial({ color: '#f2efe7', roughness: 0.8 });
    const black = new THREE.MeshStandardMaterial({ color: '#080a0d', roughness: 0.8 });
    const glass = new THREE.MeshStandardMaterial({ color: '#526473', roughness: 0.25, metalness: 0.7 });
    const blue = new THREE.MeshStandardMaterial({ color: '#335cff', emissive: '#335cff', emissiveIntensity: 0.45 });
    const light = new THREE.MeshStandardMaterial({ color: '#fffdf0', emissive: '#fffdf0', emissiveIntensity: 1.3 });
    const rear = new THREE.MeshStandardMaterial({ color: '#a44c4c', emissive: '#a44c4c', emissiveIntensity: 0.5 });
    const part = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
      const geometry = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.17);
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; this.shell.add(mesh); return mesh;
    };
    part(1.8, 0.38, 3.5, 0, 0, 0, bodyPaint);
    const hood = part(1.7, 0.19, 1.05, 0, 0.23, -1.17, bodyPaint); hood.rotation.x = -0.06;
    const rallyStripe = part(0.32, 0.025, 1.04, 0, 0.336, -1.17, paper); rallyStripe.rotation.x = -0.06;
    // A tapered glass canopy gives this original rally silhouette a sloped windshield and rear window.
    const cabin = new THREE.BufferGeometry();
    cabin.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.77, 0.19, -0.65, 0.77, 0.19, -0.65, 0.77, 0.19, 0.95, -0.77, 0.19, 0.95,
      -0.64, 0.64, -0.29, 0.64, 0.64, -0.29, 0.64, 0.64, 0.72, -0.64, 0.64, 0.72,
    ], 3));
    cabin.setIndex([0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0, 4, 7, 6, 4, 6, 5, 0, 1, 2, 0, 2, 3]); cabin.computeVertexNormals();
    const canopy = new THREE.Mesh(cabin, glass); canopy.castShadow = true; this.shell.add(canopy);
    part(1.37, 0.09, 1.14, 0, 0.66, 0.21, bodyPaint);
    part(0.32, 0.025, 1.13, 0, 0.718, 0.21, paper);
    for (const x of [-0.7, 0.7]) part(0.075, 0.43, 0.08, x, 0.43, 0.29, bodyPaint);
    part(1.89, 0.12, 0.15, 0, -0.08, -1.77, black);
    part(1.85, 0.11, 0.33, 0, 0.58, 1.55, bodyPaint);
    part(0.08, 0.3, 0.08, -0.62, 0.38, 1.54, black); part(0.08, 0.3, 0.08, 0.62, 0.38, 1.54, black);
    part(1.23, 0.035, 2.7, 0, -0.205, 0, blue);
    for (const x of [-0.63, 0.63]) { part(0.4, 0.11, 0.05, x, 0.12, -1.79, light); part(0.42, 0.055, 0.05, x, 0.12, 1.79, rear); }
    const tyreGeometry = new THREE.CylinderGeometry(0.43, 0.43, 0.29, 16); tyreGeometry.rotateZ(Math.PI / 2);
    const rimGeometry = new THREE.CylinderGeometry(0.23, 0.23, 0.3, 8); rimGeometry.rotateZ(Math.PI / 2);
    const rimMaterial = new THREE.MeshStandardMaterial({ color: '#aaa9a3', metalness: 0.7, roughness: 0.35 });
    for (const z of [-1.14, 1.16]) for (const x of [-0.94, 0.94]) {
      const wheel = new THREE.Group(); wheel.position.set(x, -0.14, z);
      const spin = new THREE.Group(); spin.add(new THREE.Mesh(tyreGeometry, black), new THREE.Mesh(rimGeometry, rimMaterial)); wheel.add(spin);
      spin.children.forEach(child => { child.castShadow = true; }); this.shell.add(wheel); this.wheels.push(wheel);
      part(0.3, 0.13, 0.88, x, 0.13, z, bodyPaint);
    }
    this.mesh.position.copy(this.body.position as unknown as THREE.Vector3);
  }
  update(input: DrivingInput, dt: number) {
    this.body.quaternion.vmult(new CANNON.Vec3(0, 0, -1), this.forward);
    this.body.quaternion.vmult(new CANNON.Vec3(1, 0, 0), this.right);
    this.speed = this.body.velocity.dot(this.forward);
    const lateral = this.body.velocity.dot(this.right);
    this.ray.reset();
    this.world.raycastClosest(this.body.position, new CANNON.Vec3(this.body.position.x, this.body.position.y - 1.2, this.body.position.z), { collisionFilterMask: 1, skipBackfaces: true }, this.ray);
    this.grounded = this.ray.hasHit;
    if (this.grounded) {
      const acceleration = longitudinalAcceleration(input.throttle, this.speed, input.handbrake, this.tuning);
      const side = lateralAcceleration(lateral, input.handbrake, this.tuning);
      this.force.set((this.forward.x * acceleration + this.right.x * side) * this.body.mass, 0, (this.forward.z * acceleration + this.right.z * side) * this.body.mass);
      this.body.applyForce(this.force);
      const targetYaw = turnRate(input.steer, this.speed, input.handbrake, this.tuning);
      this.body.angularVelocity.y = THREE.MathUtils.damp(this.body.angularVelocity.y, targetYaw, 9, dt);
    }
    const up = this.body.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
    this.flippedFor = up.y < 0.35 ? this.flippedFor + dt : 0;
    if (this.body.position.y < -4 || this.flippedFor > 2.5) this.reset();
    this.currentSteer = THREE.MathUtils.damp(this.currentSteer, steeringAngle(input.steer, this.speed, this.tuning), 12, dt);
    this.wheelSpin += this.speed * dt / 0.43;
    for (let index = 0; index < this.wheels.length; index++) {
      const wheel = this.wheels[index]; wheel.rotation.y = index < 2 ? this.currentSteer : 0; wheel.children[0].rotation.x = -this.wheelSpin;
    }
    this.shell.rotation.z = THREE.MathUtils.damp(this.shell.rotation.z, -input.steer * Math.min(Math.abs(this.speed) * 0.007, 0.07), 7, dt);
    this.shell.rotation.x = THREE.MathUtils.damp(this.shell.rotation.x, input.throttle * 0.025, 6, dt);
  }
  render(alpha: number) {
    this.mesh.position.set(
      THREE.MathUtils.lerp(this.body.previousPosition.x, this.body.position.x, alpha),
      THREE.MathUtils.lerp(this.body.previousPosition.y, this.body.position.y, alpha) + 0.28,
      THREE.MathUtils.lerp(this.body.previousPosition.z, this.body.position.z, alpha));
    const previous = this.body.previousQuaternion;
    this.mesh.quaternion.set(previous.x, previous.y, previous.z, previous.w);
    this.mesh.quaternion.slerp(new THREE.Quaternion(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w), alpha);
  }
  reset(x = 0, z = -10, heading = 0) {
    this.body.position.set(x, 0.8, z); this.body.previousPosition.copy(this.body.position);
    this.body.quaternion.setFromEuler(0, heading, 0); this.body.previousQuaternion.copy(this.body.quaternion);
    this.body.velocity.setZero(); this.body.angularVelocity.setZero(); this.body.force.setZero(); this.body.torque.setZero(); this.body.wakeUp(); this.speed = 0;
  }
}
