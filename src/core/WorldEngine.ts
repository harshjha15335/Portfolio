import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createVisitor } from '../game/World/WalkingBody';
import { MumbaiStreet } from '../game/World/MumbaiStreet';
import { createTransitModel } from '../game/World/TransitModel';
import { idleRide, pointAtDistance, routeLength, storyFare, type Point, type RideStatus, type TransitKind } from '../game/World/transit';
import { STREET_SPAWN, streetStops, streetRideRoute, walkingVelocity } from '../game/World/streetLayout';

interface WorldOptions {
  onNear: (id: string | null) => void; onSpeed: (speed: number) => void;
  onRide: (ride: RideStatus) => void; onPosition: (position: Point) => void;
  onHail: (kind: TransitKind) => void; onError: (error: unknown) => void;
  onSelect: (id: string) => void; reducedMotion: boolean; mobile: boolean;
}
type Mode = 'intro' | 'world' | 'quick';

/** First-person visitor and passenger camera. No personal vehicle or chase camera. */
export class WorldEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(68, 1, .06, 180);
  private physics = new CANNON.World({ gravity: new CANNON.Vec3(0, -19, 0) });
  private visitor: CANNON.Body;
  private street: MumbaiStreet;
  private pausedFrameDirty = true;
  private mode: Mode = 'intro'; private paused = false; private disposed = false;
  private reducedMotion: boolean;
  private keys = new Set<string>(); private touchKeys = new Set<string>();
  private yaw = STREET_SPAWN.yaw; private pitch = -.015;
  private rideYaw = 0; private ridePitch = 0; private gait = 0;
  private dragging: { x: number; y: number } | null = null;
  private frameId = 0; private lastTime = 0; private accumulator = 0; private time = 0; private lastHud = 0;
  private resizeObserver: ResizeObserver;
  private nearest: string | null = null;
  private ride = idleRide(); private ridePath: Point[] = []; private rideLength = 0;
  private pickupDistance = 0; private queuedDestination: string | null = null;
  private transit = new THREE.Group(); private taxi = createTransitModel('taxi'); private auto = createTransitModel('auto');
  private debug: HTMLElement | null = null; private debugTime = 0; private debugFrames = 0;

  constructor(private container: HTMLElement, private options: WorldOptions) {
    this.reducedMotion = options.reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, options.mobile ? 1.25 : 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = !options.mobile; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-label', 'First-person Mumbai street. WASD or arrows to walk, Shift for a brisk walk, E to interact. Click to look with the mouse. Escape releases the mouse.');
    canvas.tabIndex = 0; canvas.style.touchAction = 'none'; canvas.style.display = 'block'; container.appendChild(canvas);
    this.lighting();
    this.physics.broadphase = new CANNON.SAPBroadphase(this.physics); this.physics.allowSleep = true;
    this.physics.defaultContactMaterial.friction = 0; this.physics.defaultContactMaterial.restitution = 0;
    this.street = new MumbaiStreet(this.physics); this.scene.add(this.street.group);
    this.visitor = createVisitor(STREET_SPAWN.x, STREET_SPAWN.z);
    this.physics.addBody(this.visitor);
    this.transit.add(this.taxi, this.auto); this.transit.visible = false; this.scene.add(this.transit);
    this.camera.rotation.order = 'YXZ'; this.updateCamera();
    this.resizeObserver = new ResizeObserver(this.resize); this.resizeObserver.observe(container); this.resize();
    window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp); window.addEventListener('blur', this.releaseInput);
    document.addEventListener('visibilitychange', this.visibilityChanged); document.addEventListener('pointerlockchange', this.lockChanged);
    canvas.addEventListener('pointerdown', this.pointerDown); window.addEventListener('pointermove', this.pointerMove); window.addEventListener('pointerup', this.pointerUp); canvas.addEventListener('pointercancel', this.pointerUp);
    canvas.addEventListener('webglcontextlost', this.contextLost);
    if (new URLSearchParams(location.search).has('debug')) { this.debug = document.createElement('div'); this.debug.className = 'world-debug'; this.debug.setAttribute('aria-label', 'Renderer diagnostics'); container.append(this.debug); }
    this.frameId = requestAnimationFrame(this.frame);
  }
  private lighting() {
    this.scene.background = new THREE.Color('#bd8b83'); this.scene.fog = new THREE.Fog('#a88885', 48, 135);
    this.scene.add(new THREE.HemisphereLight('#a8b9e1', '#61534f', 1.55));
    const sun = new THREE.DirectionalLight('#fac28f', 2.2); sun.position.set(-22, 20, -62); sun.castShadow = !this.options.mobile;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 55, bottom: -55, near: 1, far: 150 });
    sun.target.position.set(0, 0, -26); sun.shadow.normalBias = .06; sun.shadow.bias = -.0002; this.scene.add(sun, sun.target);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(145, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec3 vPosition; void main(){vec3 d=normalize(vPosition); float h=max(d.y,0.0); vec3 horizon=vec3(.83,.48,.34); vec3 middle=vec3(.46,.34,.48); vec3 top=vec3(.10,.14,.27); vec3 c=mix(horizon,middle,smoothstep(0.,.28,h)); c=mix(c,top,smoothstep(.18,.85,h)); float cloud=sin(d.x*24.+d.z*12.)*sin(d.z*33.-d.y*42.); c=mix(c,vec3(.69,.48,.47),smoothstep(.38,.85,cloud)*smoothstep(.02,.12,h)*(1.-smoothstep(.25,.5,h))*.45); gl_FragColor=vec4(c,1.);}` }));
    this.scene.add(sky);
  }
  setMode(mode: Mode) {
    if (mode !== 'world') { this.endRide(); this.unlock(); }
    this.mode = mode; this.releaseInput(); this.accumulator = 0;
    if (mode === 'world') { this.updateCamera(); this.updateNear(); } else this.options.onNear(null);
    if (this.debug) this.debug.hidden = mode !== 'world';
  }
  setPaused(paused: boolean) { this.paused = paused; this.pausedFrameDirty = true; this.releaseInput(); this.accumulator = 0; this.visitor.velocity.setZero(); if (paused) this.unlock(); }
  setReducedMotion(reduced: boolean) { this.reducedMotion = reduced; }
  focusLandmark(_id: string) { /* Reading an overlay never changes the visitor's viewpoint. */ }
  travelTo(id: string) {
    const stop = streetStops[id]; if (!stop) { this.options.onSelect(id); return; }
    this.endRide(); this.placeVisitor(stop.x, stop.z, stop.yaw); this.updateNear();
  }
  reset() { this.endRide(); this.placeVisitor(STREET_SPAWN.x, STREET_SPAWN.z, STREET_SPAWN.yaw); this.updateNear(); }
  private placeVisitor(x: number, z: number, yaw: number) {
    this.visitor.position.set(x, .33, z); this.visitor.previousPosition.copy(this.visitor.position); this.visitor.velocity.setZero(); this.visitor.wakeUp();
    this.yaw = yaw; this.pitch = -.015; this.gait = 0; this.releaseInput(); this.updateCamera();
  }
  setMove(key: string, down: boolean) { if (down) this.touchKeys.add(key); else this.touchKeys.delete(key); }
  board(kind: TransitKind) {
    this.endRide(); this.releaseInput(); this.visitor.velocity.setZero(); this.rideYaw = 0; this.ridePitch = 0;
    this.ride = { ...idleRide(), phase: this.reducedMotion ? 'boarding' : 'hailing', kind, fare: this.reducedMotion ? storyFare(kind, 0) : 0 };
    this.taxi.visible = kind === 'taxi'; this.auto.visible = kind === 'auto'; this.transit.visible = true; this.queuedDestination = null;
    // Pull in from the same lane, parallel to the pavement. No vehicle crosses a building.
    const x = this.visitor.position.x < 0 ? -2.8 : 2.8, z = THREE.MathUtils.clamp(this.visitor.position.z, -49, 11);
    this.ridePath = [{ x, z: z + 8 }, { x, z }]; this.rideLength = routeLength(this.ridePath); this.pickupDistance = 0;
    const p = pointAtDistance(this.ridePath, this.reducedMotion ? this.rideLength : 0); this.transit.position.set(p.x, .02, p.z); this.transit.rotation.y = p.heading;
    this.options.onRide({ ...this.ride });
  }
  rideTo(id: string) {
    if (!streetStops[id] || this.ride.phase === 'idle') return;
    if (this.ride.phase === 'hailing') { this.queuedDestination = id; return; }
    this.ridePath = streetRideRoute({ x: this.transit.position.x, z: this.transit.position.z }, id); this.rideLength = routeLength(this.ridePath);
    this.ride = { ...this.ride, phase: 'riding', destination: id, elapsed: 0, distance: 0, progress: 0 };
    if (this.reducedMotion) this.skipRide(); else this.options.onRide({ ...this.ride });
  }
  skipRide() { if (this.ride.phase === 'riding') { this.ride.distance = this.rideLength; this.finishRide(); } }
  private finishRide() {
    const stop = streetStops[this.ride.destination ?? '']; if (!stop) return;
    const p = pointAtDistance(this.ridePath, this.rideLength); this.transit.position.set(p.x, .02, p.z); this.transit.rotation.y = p.heading;
    this.ride = { ...this.ride, phase: 'arrived', distance: this.rideLength, fare: storyFare(this.ride.kind, this.rideLength), progress: 1 }; this.options.onRide({ ...this.ride });
  }
  endRide() {
    if (this.ride.phase === 'idle') return;
    const destination = this.ride.destination && streetStops[this.ride.destination];
    const phase = this.ride.phase;
    this.ride = idleRide(); this.transit.visible = false;
    if (phase === 'arrived' && destination) this.placeVisitor(destination.x, destination.z, destination.yaw);
    else if (phase !== 'hailing') this.placeVisitor(this.transit.position.x < 0 ? -4.9 : 4.9, this.transit.position.z, this.transit.rotation.y);
    this.options.onRide({ ...this.ride }); this.releaseInput(); this.updateNear();
  }
  private updateRide(delta: number) {
    if (this.ride.phase === 'hailing') {
      this.pickupDistance = Math.min(this.rideLength, this.pickupDistance + delta * 4);
      const p = pointAtDistance(this.ridePath, this.pickupDistance); this.transit.position.set(p.x, .02, p.z);
      if (this.pickupDistance >= this.rideLength) {
        this.ride = { ...this.ride, phase: 'boarding', fare: storyFare(this.ride.kind, 0) }; this.options.onRide({ ...this.ride });
        if (this.queuedDestination) { const id = this.queuedDestination; this.queuedDestination = null; this.rideTo(id); }
      }
    } else if (this.ride.phase === 'riding') {
      this.ride.elapsed += delta; this.ride.distance = Math.min(this.rideLength, this.ride.distance + delta * (this.ride.kind === 'auto' ? 4.2 : 5.2));
      this.ride.fare = storyFare(this.ride.kind, this.ride.distance); this.ride.progress = this.rideLength ? this.ride.distance / this.rideLength : 1;
      const p = pointAtDistance(this.ridePath, this.ride.distance); this.transit.position.set(p.x, .02, p.z);
      const turn = Math.atan2(Math.sin(p.heading - this.transit.rotation.y), Math.cos(p.heading - this.transit.rotation.y));
      this.transit.rotation.y += turn * (1 - Math.exp(-6 * delta));
      if (this.ride.distance >= this.rideLength) this.finishRide();
    }
  }
  private resize = () => {
    const w = Math.max(this.container.clientWidth, 1), h = Math.max(this.container.clientHeight, 1); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h, false);
  };
  private releaseInput = () => { this.keys.clear(); this.touchKeys.clear(); this.dragging = null; };
  private unlock() { if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock(); }
  private lockChanged = () => { if (!document.pointerLockElement) this.releaseInput(); };
  private visibilityChanged = () => { this.releaseInput(); this.lastTime = 0; this.accumulator = 0; };
  private contextLost = (event: Event) => { event.preventDefault(); this.options.onError(new Error('WebGL context lost')); };
  private keyDown = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"]') || this.mode !== 'world' || this.paused) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ',', '.'].includes(key)) { event.preventDefault(); this.keys.add(key); }
    if (key === 'r' && !event.repeat) this.reset();
    if (key === 'e' && !event.repeat && this.ride.phase === 'idle' && this.nearest) {
      this.unlock(); if (this.nearest.startsWith('hail-')) this.options.onHail(this.nearest.endsWith('taxi') ? 'taxi' : 'auto'); else this.options.onSelect(this.nearest);
    }
  };
  private keyUp = (event: KeyboardEvent) => { this.keys.delete(event.key.toLowerCase()); };
  private pointerDown = (event: PointerEvent) => {
    if (this.paused || this.mode !== 'world') return;
    this.renderer.domElement.focus({ preventScroll: true }); this.dragging = { x: event.clientX, y: event.clientY };
    if (!this.options.mobile && !document.pointerLockElement) {
      try { const pending = this.renderer.domElement.requestPointerLock(); if (pending) pending.catch(() => { /* Drag-to-look remains available. */ }); } catch { /* Keyboard and drag controls remain available. */ }
    }
  };
  private pointerMove = (event: PointerEvent) => {
    if (this.paused || this.mode !== 'world') return;
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (!locked && !this.dragging) return;
    const dx = locked ? event.movementX : event.clientX - this.dragging!.x, dy = locked ? event.movementY : event.clientY - this.dragging!.y;
    if (this.ride.phase !== 'idle' && this.ride.phase !== 'hailing') { this.rideYaw = THREE.MathUtils.clamp(this.rideYaw - dx * .003, -1.2, 1.2); this.ridePitch = THREE.MathUtils.clamp(this.ridePitch - dy * .003, -.55, .55); }
    else { this.yaw -= dx * .003; this.pitch = THREE.MathUtils.clamp(this.pitch - dy * .003, -1.05, 1.05); }
    if (this.dragging) this.dragging = { x: event.clientX, y: event.clientY };
  };
  private pointerUp = () => { this.dragging = null; };
  private updateNear() {
    let next: string | null = null, distance = 3.8;
    const view = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    for (const target of this.street.interactions) {
      const direction = new THREE.Vector3(target.position.x - this.visitor.position.x, 0, target.position.z - this.visitor.position.z);
      const d = direction.length();
      if (d < distance && (d < 1.5 || direction.normalize().dot(view) > .4)) { distance = d; next = target.id; }
    }
    if (next !== this.nearest) { this.nearest = next; this.options.onNear(next); }
  }
  private updateCamera() {
    if (this.ride.phase !== 'idle' && this.ride.phase !== 'hailing') {
      const local = new THREE.Vector3(this.ride.kind === 'auto' ? .18 : .4, this.ride.kind === 'auto' ? 1.31 : 1.34, .48);
      local.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.transit.rotation.y); this.camera.position.copy(this.transit.position).add(local);
      this.camera.rotation.set(this.ridePitch, this.transit.rotation.y + this.rideYaw, 0);
    } else {
      const speed = Math.hypot(this.visitor.velocity.x, this.visitor.velocity.z);
      const bob = this.reducedMotion || this.paused ? 0 : Math.sin(this.gait) * .012 * Math.min(speed / 2.7, 1);
      this.camera.position.set(this.visitor.position.x, this.visitor.position.y + 1.32 + bob, this.visitor.position.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0);
    }
  }
  private frame = (timestamp: number) => {
    if (this.disposed) return; this.frameId = requestAnimationFrame(this.frame);
    const elapsed = this.lastTime ? (timestamp - this.lastTime) / 1000 : 0; const delta = Math.min(elapsed, .08); this.lastTime = timestamp;
    if (document.hidden || this.mode !== 'world') return;
    if (this.paused && !this.pausedFrameDirty) return;
    this.pausedFrameDirty = false;
    try {
      if (!this.paused) {
        this.time += delta;
        if (this.ride.phase !== 'idle') this.updateRide(Math.min(elapsed, .25));
        else {
          const held = (key: string) => this.keys.has(key) || this.touchKeys.has(key);
          const forward = Number(held('w') || held('arrowup')) - Number(held('s') || held('arrowdown'));
          const strafe = Number(held('d') || held('arrowright')) - Number(held('a') || held('arrowleft'));
          this.yaw += (Number(held(',')) - Number(held('.'))) * delta * 1.3;
          const velocity = walkingVelocity(forward, strafe, this.yaw, held('shift') ? 4 : 2.7);
          this.accumulator += delta;
          while (this.accumulator >= 1 / 60) {
            if (forward || strafe) this.visitor.wakeUp();
            const blend = 1 - Math.exp(-12 / 60);
            this.visitor.velocity.x += (velocity.x - this.visitor.velocity.x) * blend; this.visitor.velocity.z += (velocity.z - this.visitor.velocity.z) * blend;
            this.physics.step(1 / 60); this.accumulator -= 1 / 60;
          }
          if (this.visitor.position.y < -2) this.reset();
          this.gait += Math.hypot(this.visitor.velocity.x, this.visitor.velocity.z) * delta * 3;
          this.updateNear();
        }
      }
      this.updateCamera(); this.street.update(this.time, this.reducedMotion); this.renderer.render(this.scene, this.camera);
      if (timestamp - this.lastHud > 125) {
        if (this.debug) { const canvas = this.renderer.domElement; canvas.dataset.worldX = this.visitor.position.x.toFixed(3); canvas.dataset.worldZ = this.visitor.position.z.toFixed(3); canvas.dataset.eyeHeight = this.camera.position.y.toFixed(3); canvas.dataset.lookYaw = this.yaw.toFixed(3); canvas.dataset.cameraMode = this.ride.phase === 'idle' || this.ride.phase === 'hailing' ? 'first-person' : 'passenger'; }
        this.options.onSpeed(this.ride.phase === 'riding' ? (this.ride.kind === 'auto' ? 15.12 : 18.72) : Math.hypot(this.visitor.velocity.x, this.visitor.velocity.z) * 3.6);
        this.options.onPosition(this.ride.phase === 'idle' || this.ride.phase === 'hailing' ? { x: this.visitor.position.x, z: this.visitor.position.z } : { x: this.transit.position.x, z: this.transit.position.z });
        if (this.ride.phase !== 'idle') this.options.onRide({ ...this.ride }); this.lastHud = timestamp;
      }
      if (this.debug) { this.debugTime += elapsed; this.debugFrames++; if (this.debugTime > .75) { const info = this.renderer.info; this.debug.textContent = `${Math.round(this.debugFrames / this.debugTime)} fps · ${info.render.calls} draws · ${info.render.triangles} triangles · ${info.memory.textures} textures · eye ${this.camera.position.y.toFixed(2)}m`; this.debugTime = 0; this.debugFrames = 0; } }
    } catch (error) { this.dispose(); this.options.onError(error); }
  };
  dispose() {
    if (this.disposed) return; this.disposed = true; cancelAnimationFrame(this.frameId); this.resizeObserver.disconnect(); this.releaseInput(); this.unlock();
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.releaseInput);
    document.removeEventListener('visibilitychange', this.visibilityChanged); document.removeEventListener('pointerlockchange', this.lockChanged);
    const canvas = this.renderer.domElement; canvas.removeEventListener('pointerdown', this.pointerDown); window.removeEventListener('pointermove', this.pointerMove); window.removeEventListener('pointerup', this.pointerUp); canvas.removeEventListener('pointercancel', this.pointerUp); canvas.removeEventListener('webglcontextlost', this.contextLost);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.scene.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.geometry) geometries.add(mesh.geometry); if (mesh.material) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) { materials.add(m); if ((m as THREE.MeshStandardMaterial).map) textures.add((m as THREE.MeshStandardMaterial).map!); } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); this.renderer.dispose(); canvas.remove(); this.debug?.remove();
  }
}
