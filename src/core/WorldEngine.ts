import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { projects } from '../data/projects';
import { Campus, landmarkArrival, type Landmark } from '../game/World/Campus';
import { Vehicle } from '../game/Vehicle/Vehicle';
import { nearestLandmark } from '../game/Vehicle/driving';

interface WorldOptions {
  onNear: (id: string | null) => void;
  onSpeed: (speed: number) => void;
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

  constructor(private container: HTMLElement, private options: WorldOptions) {
    this.reducedMotion = options.reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.mobile ? 1.35 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-label', 'Interactive engineering campus. Drive with W A S D or arrow keys. E opens a nearby landmark. R resets the car.');
    canvas.tabIndex = 0; canvas.style.touchAction = 'none'; canvas.style.display = 'block';
    container.appendChild(canvas);
    this.scene.background = new THREE.Color('#f2efe7');
    this.scene.fog = new THREE.Fog('#f2efe7', 145, 240);
    const ambient = new THREE.HemisphereLight('#ffffff', '#3155ff', 1.5); this.scene.add(ambient);
    const sun = new THREE.DirectionalLight('#fffaf0', 2.5); sun.position.set(-32, 60, 22); sun.castShadow = true;
    sun.shadow.mapSize.set(options.mobile ? 1024 : 2048, options.mobile ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 1, far: 130 });
    sun.shadow.normalBias = 0.045; sun.shadow.bias = -0.0001; this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#ffffff', 0.6); rim.position.set(25, 18, -35); this.scene.add(rim);
    this.physics.broadphase = new CANNON.SAPBroadphase(this.physics); this.physics.allowSleep = true;
    // Tire forces provide longitudinal/lateral friction; chassis contact friction would fight the drive force.
    this.physics.defaultContactMaterial.friction = 0; this.physics.defaultContactMaterial.restitution = 0.08;
    this.landmarks = projects.filter(project => project.priority <= 4).map(project => ({ id: project.id, title: project.title, position: [...project.worldPosition] as [number, number, number], color: project.color }));
    this.landmarks.push({ id: 'garage', title: 'Project Garage', position: [23, 0, 32], color: '#c7ff3d' }, { id: 'about', title: 'About / Career', position: [-23, 0, 32], color: '#f0eee8' });
    this.campus = new Campus(this.physics, this.landmarks); this.scene.add(this.campus.group);
    this.vehicle = new Vehicle(this.physics); this.scene.add(this.vehicle.mesh);
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
    this.mode = mode; this.releaseInput(); this.selected = null; this.accumulator = 0;
    if (mode !== 'world') { this.nearest = null; this.options.onNear(null); }
    if (mode === 'world') this.updateNear();
    if (this.debug) this.debug.hidden = mode !== 'world';
  }
  setPaused(paused: boolean) { this.paused = paused; this.releaseInput(); this.accumulator = 0; if (!paused) this.selected = null; }
  setReducedMotion(reducedMotion: boolean) { this.reducedMotion = reducedMotion; }
  focusLandmark(id: string) { if (this.landmarks.some(landmark => landmark.id === id)) this.selected = id; }
  travelTo(id: string) {
    const landmark = this.landmarks.find(item => item.id === id); if (!landmark) return;
    const { x, z, heading, direction } = landmarkArrival(landmark);
    this.vehicle.reset(x, z, heading); this.selected = null; this.releaseInput(); this.updateNear();
    if (this.reducedMotion) this.camera.position.set(x + direction.x * 11, 8, z + direction.z * 11);
  }
  reset() { this.vehicle.reset(); this.releaseInput(); this.updateNear(); }
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
    if (key === 'e' && this.nearest && !event.repeat) { this.selected = this.nearest; this.options.onSelect(this.nearest); }
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
    if (hit) { const id = hit.object.userData.landmarkId as string; this.selected = id; this.options.onSelect(id); }
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
      if (this.mode === 'world' && !this.paused && !this.options.mobile) {
        this.accumulator += delta;
        const throttle = Number(this.keys.has('w') || this.keys.has('arrowup')) - Number(this.keys.has('s') || this.keys.has('arrowdown'));
        const steer = Number(this.keys.has('a') || this.keys.has('arrowleft')) - Number(this.keys.has('d') || this.keys.has('arrowright'));
        while (this.accumulator >= 1 / 60) {
          this.vehicle.update({ throttle, steer, handbrake: this.keys.has(' ') }, 1 / 60); this.physics.step(1 / 60); this.accumulator -= 1 / 60;
        }
        this.vehicle.render(this.accumulator * 60); this.updateNear();
      } else if (!this.paused) {
        this.vehicle.update({ throttle: 0, steer: 0, handbrake: false }, 1 / 60); this.physics.step(1 / 60); this.vehicle.render(1);
      }
      this.updateCamera(delta); this.campus.update(this.time, this.reducedMotion);
      this.renderer.render(this.scene, this.camera);
      if (timestamp - this.lastHud > 125) { this.options.onSpeed(Math.abs(this.vehicle.speed) * 3.6); this.lastHud = timestamp; }
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
    if (focus) {
      const center = new THREE.Vector3(...focus.position);
      const direction = center.clone().negate().setY(0).normalize();
      desired = center.clone().addScaledVector(direction, 19).add(new THREE.Vector3(7, 11, 0)); target = center.clone().add(new THREE.Vector3(0, 3.2, 0));
    } else if (this.mode === 'intro' || this.options.mobile) {
      const angle = this.mode === 'intro' ? 0.72 + (this.reducedMotion ? 0 : Math.sin(this.time * 0.07) * 0.1) : this.orbitAngle;
      const radius = this.options.mobile ? 94 : 92;
      desired = new THREE.Vector3(Math.sin(angle) * radius, this.options.mobile && this.mode === 'world' ? this.orbitHeight : 61, Math.cos(angle) * radius);
      target = new THREE.Vector3(0, 0, -3);
    } else {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.vehicle.mesh.quaternion).setY(0).normalize();
      const position = this.vehicle.mesh.position;
      desired = position.clone().addScaledVector(forward, -this.cameraSettings.distance - Math.abs(this.vehicle.speed) * 0.055); desired.y += this.cameraSettings.height;
      target = position.clone().addScaledVector(forward, 4.5 + Math.min(Math.abs(this.vehicle.speed) * 0.08, 2)); target.y += 1;
    }
    const damping = 1 - Math.exp(-this.cameraSettings.lag * delta);
    if (this.reducedMotion && (focus || this.mode !== 'world' || this.options.mobile)) { this.camera.position.copy(desired); this.cameraTarget.copy(target); }
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
