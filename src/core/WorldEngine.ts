import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { districts, districtForProject } from '../data/city';
import { createTransitModel } from '../game/World/TransitModel';
import { arrivalPoint, idleRide, pointAtDistance, routeLength, storyFare, transitRoute, ringPoint, type Point, type RideStatus, type TransitKind } from '../game/World/transit';
import { Campus, landmarkArrival, type Landmark } from '../game/World/Campus';
import { Vehicle } from '../game/Vehicle/Vehicle';
import { nearestLandmark } from '../game/Vehicle/driving';

interface WorldOptions {
  onNear: (id: string | null) => void;
  onSpeed: (speed: number) => void;
  onRide: (ride: RideStatus) => void;
  onPosition: (position: Point) => void;
  onHail: (kind: TransitKind) => void;
  onError: (error: unknown) => void;
  onSelect: (id: string) => void;
  reducedMotion: boolean;
  mobile: boolean;
}
type Mode = 'intro' | 'world' | 'quick';

/** Imperative fixed-step simulation; portfolio UI never owns the render loop. */
export class WorldEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(43, 1, 0.1, 250);
  private physics = new CANNON.World({ gravity: new CANNON.Vec3(0, -19, 0) });
  private campus: Campus;
  private vehicle: Vehicle;
  private landmarks: Landmark[];
  private mode: Mode = 'intro';
  private paused = false;
  private reducedMotion: boolean;
  private disposed = false;
  private keys = new Set<string>();
  private frameId = 0;
  private resizeObserver: ResizeObserver;
  private lastTime = 0;
  private accumulator = 0;
  private time = 0;
  private nearest: string | null = null;
  private selected: string | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private dragging: { x: number; y: number; startX: number; startY: number } | null = null;
  private orbitAngle = 0.65;
  private orbitHeight = 38;
  private cameraTarget = new THREE.Vector3(0, 0, -4);
  private cameraSettings = { lag: 4.6, height: 10.2, distance: 15 };
  private debug: HTMLElement | null = null;
  private debugText: HTMLElement | null = null;
  private debugTime = 0;
  private debugFrames = 0;
  private lastHud = 0;
  private exploration: 'walk' | 'drive' = 'walk';
  private walking = new THREE.Group();
  private drivingShape: CANNON.Shape;
  private ride = idleRide();
  private ridePath: Point[] = [];
  private rideLength = 0;
  private pickupDistance = 0;
  private queuedDestination: string | null = null;
  private transit = new THREE.Group();
  private taxi = createTransitModel('taxi');
  private auto = createTransitModel('auto');


  constructor(private container: HTMLElement, private options: WorldOptions) {
    this.reducedMotion = options.reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.mobile ? 1.35 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-label', 'Mini Mumbai portfolio city. Walk with W A S D or arrow keys. E talks to a nearby guide or boards transport. R returns to CST.');
    canvas.tabIndex = 0; canvas.style.touchAction = 'none'; canvas.style.display = 'block';
    container.appendChild(canvas);
    this.scene.background = new THREE.Color('#ece0c9');
    this.scene.fog = new THREE.Fog('#ece0c9', 145, 240);
    const ambient = new THREE.HemisphereLight('#ffffff', '#3155ff', 1.5); this.scene.add(ambient);
    const sun = new THREE.DirectionalLight('#fffaf0', 2.5); sun.position.set(-32, 60, 22); sun.castShadow = true;
    sun.shadow.mapSize.set(options.mobile ? 1024 : 2048, options.mobile ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 1, far: 130 });
    sun.shadow.normalBias = 0.045; sun.shadow.bias = -0.0001; this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#ffffff', 0.6); rim.position.set(25, 18, -35); this.scene.add(rim);
    this.physics.broadphase = new CANNON.SAPBroadphase(this.physics); this.physics.allowSleep = true;
    // Tire forces provide longitudinal/lateral friction; chassis contact friction would fight the drive force.
    this.physics.defaultContactMaterial.friction = 0; this.physics.defaultContactMaterial.restitution = 0.08;
    this.landmarks = districts.map(d => ({ id: d.id, title: d.title, position: [...d.position], color: d.color }));
    this.campus = new Campus(this.physics, this.landmarks); this.scene.add(this.campus.group);
    this.vehicle = new Vehicle(this.physics); this.scene.add(this.vehicle.mesh);
    this.drivingShape = this.vehicle.body.shapes[0];
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.65, 3, 6), new THREE.MeshStandardMaterial({ color: '#d56a42' }));
    body.position.y = 0.85; body.castShadow = true; this.walking.add(body);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), new THREE.MeshStandardMaterial({ color: '#b48765' }));
    head.position.y = 1.55; this.walking.add(head); this.scene.add(this.walking);
    this.transit.add(this.taxi, this.auto); this.transit.visible = false; this.scene.add(this.transit);
    this.setExploration('walk');
    this.camera.position.set(61, 61, 70); this.camera.lookAt(this.cameraTarget);
    this.resizeObserver = new ResizeObserver(this.resize); this.resizeObserver.observe(container); this.resize();
    window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp); window.addEventListener('blur', this.releaseInput);
    document.addEventListener('visibilitychange', this.visibilityChanged);
    canvas.addEventListener('pointerdown', this.pointerDown); canvas.addEventListener('pointermove', this.pointerMove); canvas.addEventListener('pointerup', this.pointerUp); canvas.addEventListener('pointercancel', this.pointerCancel);
    canvas.addEventListener('webglcontextlost', this.contextLost);
    if (new URLSearchParams(window.location.search).has('debug')) this.createDebug();
    this.frameId = requestAnimationFrame(this.frame);
  }
  setMode(mode: Mode) {
    if (mode !== 'world') this.endRide();
    this.mode = mode; this.releaseInput(); this.selected = null; this.accumulator = 0;
    if (mode !== 'world') { this.nearest = null; this.options.onNear(null); }
    if (mode === 'world') this.updateNear();
    if (this.debug) this.debug.hidden = mode !== 'world';
  }
  setPaused(paused: boolean) { this.paused = paused; this.releaseInput(); this.accumulator = 0; if (!paused) this.selected = null; }
  setReducedMotion(reducedMotion: boolean) { this.reducedMotion = reducedMotion; }
  focusLandmark(id: string) { this.selected = this.landmarks.some(landmark => landmark.id === id) ? id : districtForProject(id); }
  travelTo(id: string) {
    this.endRide();
    const resolved = this.landmarks.some(item => item.id === id) ? id : districtForProject(id);
    const landmark = this.landmarks.find(item => item.id === resolved); if (!landmark) return;
    const { x, z, heading, direction } = landmarkArrival(landmark);
    this.vehicle.reset(x, z, heading); this.selected = null; this.releaseInput(); this.updateNear();
    if (this.reducedMotion) this.camera.position.set(x + direction.x * 11, 8, z + direction.z * 11);
  }
  reset() { this.endRide(); this.vehicle.reset(); this.releaseInput(); this.updateNear(); }
  setExploration(mode: 'walk' | 'drive') {
    this.endRide(); this.exploration = mode;
    const body = this.vehicle.body;
    while (body.shapes.length) body.removeShape(body.shapes[0]);
    body.addShape(mode === 'walk' ? new CANNON.Sphere(0.4) : this.drivingShape);
    body.updateMassProperties(); body.angularFactor.set(mode === 'walk' ? 0 : 1, mode === 'walk' ? 0 : 1, mode === 'walk' ? 0 : 1);
    body.velocity.setZero(); body.angularVelocity.setZero(); body.quaternion.setFromEuler(0, 0, 0); body.position.y = 0.8;
    this.vehicle.mesh.visible = mode === 'drive'; this.walking.visible = mode === 'walk'; this.releaseInput();
  }
  board(kind: TransitKind) {
    this.endRide(); this.releaseInput(); this.vehicle.body.velocity.setZero();
    this.ride = { ...idleRide(), phase: this.reducedMotion ? 'boarding' : 'hailing', kind, fare: this.reducedMotion ? storyFare(kind, 0) : 0 };
    this.queuedDestination = null;
    this.transit.visible = true; this.taxi.visible = kind === 'taxi'; this.auto.visible = kind === 'auto';
    this.transit.position.set(this.vehicle.body.position.x, 0.09, this.vehicle.body.position.z);
    const pickup = { x: this.vehicle.body.position.x, z: this.vehicle.body.position.z };
    if (!this.reducedMotion) {
      const start = ringPoint(Math.atan2(pickup.x, pickup.z));
      this.ridePath = [start, pickup]; this.rideLength = routeLength(this.ridePath); this.pickupDistance = 0;
      const p = pointAtDistance(this.ridePath, 0); this.transit.position.set(p.x, 0.09, p.z); this.transit.rotation.y = p.heading;
    } else { this.transit.rotation.y = 0; this.vehicle.mesh.visible = false; this.walking.visible = false; }
    this.options.onRide({ ...this.ride });
  }
  rideTo(id: string) {
    const d = districts.find(item => item.id === id);
    if (!d || this.ride.phase === 'idle') return;
    if (this.ride.phase === 'hailing') { this.queuedDestination = id; return; }
    this.ridePath = transitRoute({ x: this.transit.position.x, z: this.transit.position.z }, arrivalPoint(d.position));
    this.rideLength = routeLength(this.ridePath);
    this.ride = { ...this.ride, phase: 'riding', destination: id, elapsed: 0, distance: 0, progress: 0 };
    if (this.reducedMotion) this.skipRide();
    else this.options.onRide({ ...this.ride });
  }
  skipRide() {
    if (this.ride.phase !== 'riding') return;
    this.ride.distance = this.rideLength; this.finishRide();
  }
  private finishRide() {
    const d = districts.find(item => item.id === this.ride.destination); if (!d) return;
    const { x, z, heading } = landmarkArrival(d);
    this.vehicle.reset(x, z, heading); this.transit.position.set(x, 0.09, z); this.transit.rotation.y = heading;
    this.ride = { ...this.ride, phase: 'arrived', distance: this.rideLength, fare: storyFare(this.ride.kind, this.rideLength), progress: 1 };
    this.updateNear(); this.options.onRide({ ...this.ride });
  }
  endRide() {
    if (this.ride.phase === 'idle') return;
    // Leaving a moving ride places the visitor on the current lane, never at an old origin.
    if (this.ride.phase !== 'hailing') this.vehicle.reset(this.transit.position.x, this.transit.position.z, this.transit.rotation.y);
    this.ride = idleRide(); this.transit.visible = false;
    this.walking.visible = this.exploration === 'walk'; this.vehicle.mesh.visible = this.exploration === 'drive';
    this.options.onRide({ ...this.ride }); this.releaseInput();
  }
  private updateRide(delta: number) {
    if (this.ride.phase === 'hailing') {
      this.pickupDistance = Math.min(this.rideLength, this.pickupDistance + delta * 12);
      const p = pointAtDistance(this.ridePath, this.pickupDistance); this.transit.position.set(p.x, 0.09, p.z);
      if (this.pickupDistance >= this.rideLength) {
        this.ride = { ...this.ride, phase: 'boarding', fare: storyFare(this.ride.kind, 0) };
        this.vehicle.mesh.visible = false; this.walking.visible = false; this.options.onRide({ ...this.ride });
        if (this.queuedDestination) { const id = this.queuedDestination; this.queuedDestination = null; this.rideTo(id); }
      }
      return;
    }
    if (this.ride.phase !== 'riding') return;
    this.ride.elapsed += delta; this.ride.distance = Math.min(this.rideLength, this.ride.distance + delta * (this.ride.kind === 'auto' ? 6 : 8));
    this.ride.fare = storyFare(this.ride.kind, this.ride.distance); this.ride.progress = this.rideLength ? this.ride.distance / this.rideLength : 1;
    const p = pointAtDistance(this.ridePath, this.ride.distance);
    this.transit.position.set(p.x, 0.09, p.z);
    // Damp heading across sampled bends; camera follows the same vehicle.
    const turn = Math.atan2(Math.sin(p.heading - this.transit.rotation.y), Math.cos(p.heading - this.transit.rotation.y));
    this.transit.rotation.y += turn * (1 - Math.exp(-8 * delta));
    if (this.ride.distance >= this.rideLength) this.finishRide();
  }

  private resize = () => {
    const width = Math.max(this.container.clientWidth, 1), height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
  };
  private releaseInput = () => { this.keys.clear(); };
  private visibilityChanged = () => { this.releaseInput(); this.lastTime = 0; this.accumulator = 0; };
  private contextLost = (event: Event) => { event.preventDefault(); this.releaseInput(); this.options.onError(new Error('WebGL context lost')); };
  private keyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (this.mode !== 'world' || this.paused || this.options.mobile) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) { event.preventDefault(); this.keys.add(key); }
    if (key === 'r' && !event.repeat) this.reset();
    if (key === 'e' && !event.repeat && this.ride.phase === 'idle') {
      const x = this.vehicle.body.position.x, z = this.vehicle.body.position.z;
      const kind = Math.hypot(x - 5.5, z + 11) < 4 ? 'taxi' : Math.hypot(x + 5.5, z + 11) < 4 ? 'auto' : null;
      if (kind) this.options.onHail(kind);
      else if (this.nearest) { this.selected = this.nearest; this.options.onSelect(this.nearest); }
    }
  };
  private keyUp = (event: KeyboardEvent) => { this.keys.delete(event.key.toLowerCase()); };
  private pointerDown = (event: PointerEvent) => {
    if (this.paused || this.mode !== 'world') return;
    this.dragging = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY };
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };
  private pointerMove = (event: PointerEvent) => {
    if (!this.dragging || !this.options.mobile) return;
    this.orbitAngle -= (event.clientX - this.dragging.x) * 0.008;
    this.orbitHeight = THREE.MathUtils.clamp(this.orbitHeight + (event.clientY - this.dragging.y) * 0.06, 24, 57);
    this.dragging.x = event.clientX; this.dragging.y = event.clientY;
  };
  private pointerCancel = () => { this.dragging = null; };
  private pointerUp = (event: PointerEvent) => {
    if (!this.dragging) return;
    const distance = Math.hypot(event.clientX - this.dragging.startX, event.clientY - this.dragging.startY); this.dragging = null;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
    if (distance > 8 || this.paused || this.mode !== 'world') return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.campus.targets, false)[0];
    if (hit) { const id = hit.object.userData.landmarkId as string; if (id.startsWith('hail-')) this.options.onHail(id.endsWith('taxi') ? 'taxi' : 'auto'); else { this.selected = id; this.options.onSelect(id); } }
  };
  private updateNear() {
    const next = nearestLandmark([this.vehicle.body.position.x, this.vehicle.body.position.z], this.landmarks.map(landmark => ({ id: landmark.id, position: [landmark.position[0], landmark.position[2]] })), 14);
    if (next !== this.nearest) { this.nearest = next; this.options.onNear(next); }
  }
  private frame = (timestamp: number) => {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this.frame);
    const delta = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, 0.08) : 0;
    this.lastTime = timestamp;
    // The editorial homepage owns intro motion. Hidden WebGL need not render or simulate.
    if (document.hidden || this.mode === 'quick' || this.mode === 'intro') return;
    try {
      if (!this.paused) this.time += delta;
      if (!this.paused && this.ride.phase !== 'idle') this.updateRide(delta);
      else if (this.mode === 'world' && !this.paused && !this.options.mobile) {
        this.accumulator += delta;
        const throttle = Number(this.keys.has('w') || this.keys.has('arrowup')) - Number(this.keys.has('s') || this.keys.has('arrowdown'));
        const steer = Number(this.keys.has('a') || this.keys.has('arrowleft')) - Number(this.keys.has('d') || this.keys.has('arrowright'));
        while (this.accumulator >= 1 / 60) {
          if (this.exploration === 'walk') {
            if (throttle || steer) this.vehicle.body.wakeUp();
            const length = Math.hypot(throttle, steer) || 1;
            this.vehicle.body.velocity.x = -steer / length * 4.2;
            this.vehicle.body.velocity.z = -throttle / length * 4.2;
            this.vehicle.body.angularVelocity.setZero();
            this.vehicle.speed = Math.hypot(this.vehicle.body.velocity.x, this.vehicle.body.velocity.z);
          } else this.vehicle.update({ throttle, steer, handbrake: this.keys.has(' ') }, 1 / 60);
          this.physics.step(1 / 60); this.accumulator -= 1 / 60;
        }
        this.vehicle.render(this.accumulator * 60); this.updateNear();
      } else if (!this.paused) {
        this.vehicle.update({ throttle: 0, steer: 0, handbrake: false }, 1 / 60); this.physics.step(1 / 60); this.vehicle.render(1);
      }
      this.walking.position.set(this.vehicle.body.position.x, this.vehicle.body.position.y - 0.4, this.vehicle.body.position.z);
      this.updateCamera(delta); this.campus.update(this.time, this.reducedMotion);
      this.renderer.render(this.scene, this.camera);
      if (timestamp - this.lastHud > 125) { this.options.onSpeed(this.ride.phase === 'riding' ? (this.ride.kind === 'auto' ? 21.6 : 28.8) : Math.abs(this.vehicle.speed) * 3.6); this.options.onPosition(this.ride.phase === 'idle' ? { x: this.vehicle.body.position.x, z: this.vehicle.body.position.z } : { x: this.transit.position.x, z: this.transit.position.z }); if (this.ride.phase !== 'idle') this.options.onRide({ ...this.ride }); this.lastHud = timestamp; }
      if (this.debugText) {
        this.debugTime += delta; this.debugFrames++;
        if (this.debugTime > 0.5) {
          const info = this.renderer.info;
          this.debugText.textContent = `${Math.round(this.debugFrames / this.debugTime)} fps · ${info.render.calls} draws · ${info.render.triangles.toLocaleString()} triangles · ${info.memory.textures} textures`;
          this.debugTime = 0; this.debugFrames = 0;
        }
      }
    } catch (error) { this.dispose(); this.options.onError(error); }
  };
  private updateCamera(delta: number) {
    let desired: THREE.Vector3, target: THREE.Vector3;
    const focus = this.selected && this.paused ? this.landmarks.find(landmark => landmark.id === this.selected) : null;
    if (this.ride.phase !== 'idle') {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.transit.quaternion);
      desired = this.transit.position.clone().addScaledVector(forward, -9); desired.y += 5.5;
      target = this.transit.position.clone().addScaledVector(forward, 5); target.y += 1.5;
    } else if (focus) {
      const center = new THREE.Vector3(...focus.position);
      const direction = center.clone().negate().setY(0).normalize();
      desired = center.clone().addScaledVector(direction, 19).add(new THREE.Vector3(7, 11, 0)); target = center.clone().add(new THREE.Vector3(0, 3.2, 0));
    } else if (this.mode === 'intro' || this.options.mobile) {
      const angle = this.mode === 'intro' ? 0.72 + (this.reducedMotion ? 0 : Math.sin(this.time * 0.07) * 0.1) : this.orbitAngle;
      const radius = this.options.mobile ? 94 : 92;
      desired = new THREE.Vector3(Math.sin(angle) * radius, this.options.mobile && this.mode === 'world' ? this.orbitHeight : 61, Math.cos(angle) * radius);
      target = new THREE.Vector3(0, 0, -3);
    } else if (this.exploration === 'walk') {
      desired = this.walking.position.clone().add(new THREE.Vector3(27, 32, 33));
      target = this.walking.position.clone().add(new THREE.Vector3(0, 1, -3));
    } else {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.vehicle.mesh.quaternion).setY(0).normalize();
      const position = this.vehicle.mesh.position;
      desired = position.clone().addScaledVector(forward, -this.cameraSettings.distance - Math.abs(this.vehicle.speed) * 0.055); desired.y += this.cameraSettings.height;
      target = position.clone().addScaledVector(forward, 4.5 + Math.min(Math.abs(this.vehicle.speed) * 0.08, 2)); target.y += 1;
    }
    const damping = 1 - Math.exp(-this.cameraSettings.lag * delta);
    if (this.reducedMotion && (this.ride.phase !== 'idle' || focus || this.mode !== 'world' || this.options.mobile)) { this.camera.position.copy(desired); this.cameraTarget.copy(target); }
    else { this.camera.position.lerp(desired, damping); this.cameraTarget.lerp(target, damping); }
    this.camera.lookAt(this.cameraTarget);
  }
  private createDebug() {
    this.debug = document.createElement('details'); this.debug.className = 'world-debug';
    Object.assign(this.debug.style, { position: 'absolute', bottom: '108px', left: '16px', zIndex: '12', background: '#f2efe7f2', padding: '10px', border: '1px solid #080808', color: '#080808', font: '11px monospace', maxWidth: '270px' });
    const summary = document.createElement('summary'); summary.textContent = 'ENGINE DIAGNOSTICS'; this.debug.append(summary);
    this.debugText = document.createElement('p'); this.debug.append(this.debugText);
    const addControl = (label: string, min: number, max: number, initial: number, update: (value: number) => void) => {
      const row = document.createElement('label'); row.style.display = 'block'; row.textContent = label;
      const input = document.createElement('input'); input.type = 'range'; input.min = String(min); input.max = String(max); input.step = '0.05'; input.value = String(initial); input.setAttribute('aria-label', label); input.addEventListener('input', () => update(Number(input.value))); row.append(input); this.debug!.append(row);
    };
    const tuning = this.vehicle.tuning;
    addControl('Acceleration', 5, 25, tuning.acceleration, value => { tuning.acceleration = value; });
    addControl('Steering', 0.15, 0.9, tuning.steering, value => { tuning.steering = value; });
    addControl('Grip', 2, 18, tuning.grip, value => { tuning.grip = value; });
    addControl('Drift grip', 0.5, 5, tuning.driftGrip, value => { tuning.driftGrip = value; });
    addControl('Friction', 0.2, 3, tuning.friction, value => { tuning.friction = value; });
    addControl('Camera lag', 1, 12, this.cameraSettings.lag, value => { this.cameraSettings.lag = value; });
    addControl('Camera height', 4, 15, this.cameraSettings.height, value => { this.cameraSettings.height = value; });
    addControl('Camera distance', 6, 20, this.cameraSettings.distance, value => { this.cameraSettings.distance = value; });
    this.debug.hidden = true; this.container.append(this.debug);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; cancelAnimationFrame(this.frameId); this.resizeObserver.disconnect(); this.releaseInput();
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.releaseInput); document.removeEventListener('visibilitychange', this.visibilityChanged);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.pointerDown); canvas.removeEventListener('pointermove', this.pointerMove); canvas.removeEventListener('pointerup', this.pointerUp); canvas.removeEventListener('pointercancel', this.pointerCancel); canvas.removeEventListener('webglcontextlost', this.contextLost);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material); const standard = material as THREE.MeshStandardMaterial; if (standard.map) textures.add(standard.map);
      }
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
    this.renderer.dispose(); canvas.remove(); this.debug?.remove();
  }
}
