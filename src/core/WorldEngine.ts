import {GPUFrameProfiler} from './GPUFrameProfiler';
import {stationCharacter} from '../data/stationCharacter';
import {characterCast} from '../data/characterCast';
import {walkingSimulationDelta} from './frameTiming';
import {STREET_MOOD} from '../game/World/streetMood';
import {applyStreetAtmosphere,createAtmosphereUniforms,createSkyMaterial,type AtmosphereUniforms} from '../game/World/StreetAtmosphere';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createVisitor } from '../game/World/WalkingBody';
import { MumbaiStreet } from '../game/World/MumbaiStreet';
import { createTransitModel, animateTransit } from '../game/World/TransitModel';
import { idleRide, pointAtDistance, routeLength, storyFare, type Point, type RideStatus, type TransitKind } from '../game/World/transit';
import { preloadCityVehicleModels } from '../game/World/districts/CityVehicleModels';
import { STREET_SPAWN, streetStops, streetPickupRoute, walkingVelocity, cityRideLegs, cityZones, zoneIndexAt, districtViews } from '../game/World/streetLayout';
import { CityDistricts } from '../game/World/districts/CityDistricts';
import { setCityDensity } from '../game/World/districts/District';
import { createFortRoadTraffic, FORT_LOOP_LANE } from '../game/World/districts/FortRoadTraffic';
import { DistrictCast, districtCast, setDistrictCast } from '../game/World/districts/DistrictCast';
import type { LaneTraffic } from '../game/World/districts/DistrictSystems';
import { districts as directory } from '../data/city';
import { pickTarget } from '../game/World/interactionTargeting';
import type { TourView } from '../data/tours';
import { VisitorBroadphase } from '../game/World/collision/VisitorBroadphase';
import { collectStaticBlockers, resolveBlockers, vehicleBlocker, type Blocker } from '../game/World/collision/DynamicBlockers';

interface WorldOptions {
  onNear: (id: string | null, label?: string) => void; onSpeed: (speed: number) => void;
  onRide: (ride: RideStatus) => void; onPosition: (position: Point & { yaw: number }) => void;
  /** Fired once, the first time the visitor looks around with the mouse, drag or keys. */
  onLook?: () => void;
  onHail: (kind: TransitKind) => void; onError: (error: unknown) => void;
  onSelect: (id: string) => void; reducedMotion: boolean; mobile: boolean;
}
import { AdaptiveQuality } from './AdaptiveQuality';
import { StreetAudio } from './StreetAudio';
import { StreetRenderer, type RenderPreset } from './StreetRenderer';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
type Mode = 'intro' | 'world' | 'quick';
/** Radius of the visitor's footprint against traffic and people (the physics body uses .32 m spheres). */
const VISITOR_RADIUS = .3;
/** Height of the visitor body's origin when standing on the street (its lowest .32 m sphere touches y = 0). */
const FLOOR_Y = .33;
const ORIGIN = new THREE.Vector3();

/** First-person visitor and passenger camera. No personal vehicle or chase camera. */
export class WorldEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(68, 1, .06, 180);
  private physics = new CANNON.World({ gravity: new CANNON.Vec3(0, -19, 0) });
  private visitor: CANNON.Body;
  private street: MumbaiStreet;
  private city!: CityDistricts; private fortTraffic!: LaneTraffic;
  /** Index into cityZones of the district being drawn; 0 is CST–Fort. */
  private zone = 0;
  private sky!: THREE.Mesh;
  private rideLegs: Point[][] = []; private legIndex = 0; private legStart = 0;
  private pausedFrameDirty = true;
  private mode: Mode = 'intro'; private paused = false; private disposed = false;
  private reducedMotion: boolean;
  private quality: AdaptiveQuality;
  private benchmarkEnabled=new URLSearchParams(location.search).get('benchmark')==='1';
  private profiler:GPUFrameProfiler|null=null;
  private reviewQuality=(import.meta.env.DEV&&new URLSearchParams(location.search).get('review')==='1')||(this.benchmarkEnabled&&new URLSearchParams(location.search).get('fixedQuality')==='1');
  private lastShadow=0;
 private inspectionFrozen=false;
  private rendering!:StreetRenderer;
  private renderPreset:RenderPreset='medium';
  private environmentTarget!:THREE.WebGLRenderTarget;
  private audio: StreetAudio | null=null;
  private soundEnabled=false;
  private rideSpeed=0;
  private keys = new Set<string>(); private touchKeys = new Set<string>();
  private yaw = STREET_SPAWN.yaw; private pitch = -.015;
  private rideYaw = 0; private ridePitch = 0; private gait = 0;
  private dragging: { x: number; y: number } | null = null;
  private frameId = 0; private lastTime = 0; private accumulator = 0; private time = 0; private lastHud = 0;
  private resizeObserver: ResizeObserver;
  private nearest: string | null = null;
  /** Small gold chevron that hovers over whatever the visitor is looking at and could interact with. */
  private marker!: THREE.Mesh; private markerBase = new THREE.Vector3();
  /** Guided-tour camera move: the visitor is carried to a framing pose instead of walking. */
  private tween: { from: TourView; to: TourView; start: number; duration: number } | null = null;
  private looked = 0;
  private ride = idleRide(); private ridePath: Point[] = []; private rideLength = 0;
  private pickupDistance = 0; private queuedDestination: string | null = null;
  private transit = new THREE.Group(); private taxi = createTransitModel('taxi','close'); private auto = createTransitModel('auto','close');
  private lastRenderPosition=new THREE.Vector3(Infinity,Infinity,Infinity);
  private lastRenderRotation=new THREE.Quaternion();
  private debug: HTMLElement | null = null; private debugTime = 0; private debugFrames = 0;
  private atmosphere!: AtmosphereUniforms;
  private sun = new THREE.DirectionalLight(STREET_MOOD.sunColor, STREET_MOOD.sunIntensity);
  /** Unshadowed light thrown back off the sunlit street, so faces turned away from the low sun stay legible. */
  private bounce = new THREE.DirectionalLight(STREET_MOOD.bounceColor, STREET_MOOD.bounceIntensity);
  private fill = new THREE.HemisphereLight(STREET_MOOD.skyColor, STREET_MOOD.groundColor, STREET_MOOD.hemisphereIntensity);

  constructor(private container: HTMLElement, private options: WorldOptions) {
    this.reducedMotion = options.reducedMotion; this.quality=new AdaptiveQuality(options.mobile);this.appliedLow=this.quality.low;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));this.renderer.info.autoReset=false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = STREET_MOOD.exposure;
    this.renderer.shadowMap.enabled = !options.mobile; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-label', 'First-person Mumbai street. WASD or arrows to walk, Shift to run, Space to jump, E to interact. Click to look with the mouse. Escape releases the mouse.');
    canvas.tabIndex = 0; canvas.style.touchAction = 'none'; canvas.style.display = 'block'; container.appendChild(canvas);
    this.lighting();
    const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environmentTarget=pmrem.fromScene(room,.04);this.scene.environment=this.environmentTarget.texture;this.scene.environmentIntensity=.14;room.dispose();pmrem.dispose();
    this.rendering=new StreetRenderer(this.renderer,this.scene,this.camera,this.benchmarkEnabled);this.renderPreset=options.mobile?'low':'medium';this.rendering.setPreset(this.renderPreset);
    this.physics.broadphase = new VisitorBroadphase(); this.physics.allowSleep = true;
    this.physics.defaultContactMaterial.friction = 0; this.physics.defaultContactMaterial.restitution = 0;
    this.street = new MumbaiStreet(this.physics); this.scene.add(this.street.group);
    // Districts are built on first need and receive the same weathering/haze patch as the street.
    setCityDensity(this.renderPreset);
    // Modelled district traffic loads in the background; lofted bodies stand in until it arrives.
    this.city = new CityDistricts(this.physics, this.street.surfaceLibrary, this.scene, district => { applyStreetAtmosphere(district.group, this.atmosphere); this.warm(district.group); if (import.meta.env.DEV) console.info(`District ${district.spec.id} built in ${district.buildMs.toFixed(0)} ms`); }); this.fortTraffic = createFortRoadTraffic(() => this.street.loopVehicles); applyStreetAtmosphere(this.fortTraffic.group, this.atmosphere); this.scene.add(this.fortTraffic.group); if (typeof location !== 'undefined') void preloadCityVehicleModels(location.origin).then(() => { if (this.disposed) return; this.fortTraffic.refresh(); this.city.refreshVehicles(); this.warm(this.scene); this.pausedFrameDirty = true; }); this.street.setQuality(this.quality.low);this.renderer.shadowMap.needsUpdate=true;void this.street.assetsReady.then(()=>{if(!this.disposed){this.pausedFrameDirty=true;this.renderer.shadowMap.needsUpdate=true;}});
    const preview=import.meta.env.DEV?new URLSearchParams(location.search).get('characterPreview'):null;
    // Licensed street cast: approved characters load at runtime; DEV ?characterPreview also shows candidates.
    const castPreview=preview==='idle'||preview==='walk'||preview==='cast';
    const refresh=()=>{if(!this.disposed){applyStreetAtmosphere(this.scene,this.atmosphere);this.warm(this.scene);this.pausedFrameDirty=true;this.renderer.shadowMap.needsUpdate=true;}};
    void this.street.installCast(characterCast,castPreview).then(refresh).catch(error=>console.warn('Street cast unavailable; original figures retained',error));
    // The same licensed people walk every district: one shared set of rigs, borrowing the street's uploaded textures.
    void this.street.sharedAssetLibrary().then(library=>DistrictCast.load(library,characterCast)).then(cast=>{if(this.disposed){cast.dispose();return;}setDistrictCast(cast);this.city.adoptCast(cast);this.fortTraffic.adopt(cast);refresh();}).catch(error=>console.warn('District cast unavailable; procedural figures retained',error));
    void this.street.installDrivers(characterCast,[this.taxi,this.auto],castPreview).then(refresh).catch(error=>console.warn('Drivers unavailable; original drivers retained',error));
    if(stationCharacter&&(stationCharacter.status==='approved'&&stationCharacter.visualReview||preview==='idle'||preview==='walk'))void this.street.installStationCharacter(stationCharacter.asset,preview==='walk').then(refresh).catch(error=>console.warn('Character admission failed; existing host retained',error));
    this.visitor = createVisitor(STREET_SPAWN.x, STREET_SPAWN.z);
    this.physics.addBody(this.visitor);
    this.transit.add(this.taxi, this.auto); this.transit.visible = false; this.scene.add(this.transit);
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(.055, .12, 4), this.street.surfaceLibrary.get('#ffd27a', 'glow')); this.marker.rotation.x = Math.PI; this.marker.visible = false; this.marker.name = 'Interaction marker'; this.scene.add(this.marker);
    this.camera.rotation.order = 'YXZ'; this.updateCamera();
    this.resizeObserver = new ResizeObserver(this.resize); this.resizeObserver.observe(container); this.resize();
    window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp); window.addEventListener('blur', this.releaseInput);
    document.addEventListener('visibilitychange', this.visibilityChanged); document.addEventListener('pointerlockchange', this.lockChanged);
    canvas.addEventListener('pointerdown', this.pointerDown); window.addEventListener('pointermove', this.pointerMove); window.addEventListener('pointerup', this.pointerUp); canvas.addEventListener('pointercancel', this.pointerUp);
    canvas.addEventListener('webglcontextlost', this.contextLost);
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {window.addEventListener('street-review-view',this.reviewView); this.debug = document.createElement('div'); this.debug.className = 'world-debug'; this.debug.setAttribute('aria-label', 'Renderer diagnostics'); container.append(this.debug); (window as unknown as {__world?:WorldEngine}).__world=this; }
    this.atmosphere.uShelterMin.value.copy(this.street.shelteredBounds.min);this.atmosphere.uShelterMax.value.copy(this.street.shelteredBounds.max);
    applyStreetAtmosphere(this.scene,this.atmosphere);this.syncSunBalance();
    // Public Three API primes light state before the first shadow pass, avoiding
    // duplicate zero-light depth programs retained after the following lit pass.
    const warmup=new THREE.Group();this.scene.traverseVisible(object=>{if((object as THREE.Mesh).isMesh)warmup.add(object.clone(false));});
    this.renderer.compile(warmup,this.camera,this.scene);warmup.clear();
    if(this.benchmarkEnabled){this.profiler=new GPUFrameProfiler(this.renderer);window.addEventListener('street-benchmark',this.benchmarkCommand);}
    this.frameId = requestAnimationFrame(this.frame);
  }
  private benchmarkCommand=(event:Event)=>{
    const detail=(event as CustomEvent<{action:string;scenario:string;requestId:string;animationTime?:number}>).detail;
    try{if(!this.profiler)throw new Error('Benchmark not enabled');
      if(detail.action==='freeze'){this.inspectionFrozen=true;const end=Math.min(30,Math.max(0,detail.animationTime??8));for(let t=1/60;t<=end+1e-8;t+=1/60)this.street.update(t,false,this.camera.position);this.time=end;this.updateCamera();}
      const compare=detail.action==='cached'||detail.action==='refresh';
      if(compare){this.updateCamera();this.renderer.shadowMap.needsUpdate=detail.action==='refresh';this.renderer.info.reset();const start=performance.now();this.rendering.render(0);const result={kind:detail.action,renderCpuMs:performance.now()-start,total:{draws:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles},...this.rendering.frameCost,textures:this.renderer.info.memory.textures,programs:this.renderer.info.programs?.length??0,pose:{x:this.camera.position.x,y:this.camera.position.y,z:this.camera.position.z,yaw:this.yaw,pitch:this.pitch,animationTime:this.time},preset:this.renderPreset,scale:this.quality.scale,shadowMap:this.renderer.shadowMap.enabled,device:this.profiler.device};window.dispatchEvent(new CustomEvent('street-benchmark-result',{detail:{requestId:detail.requestId,result}}));return;}if(detail.action==='begin'){if(this.inspectionFrozen||this.reducedMotion||this.paused||this.mode!=='world')throw new Error('Benchmark requires visible world, continuous animation and no modal');this.profiler.begin(detail.scenario);}
      const result=detail.action==='finish'?this.profiler.finish():{ready:true,device:this.profiler.device,programVariants:this.profiler.programDiagnostics()};window.dispatchEvent(new CustomEvent('street-benchmark-result',{detail:{requestId:detail.requestId,result}}));
    }catch(error){window.dispatchEvent(new CustomEvent('street-benchmark-result',{detail:{requestId:detail.requestId,error:String(error)}}));}
  };
  private lighting() {
    this.scene.background = new THREE.Color('#c0b29b'); this.scene.fog = new THREE.Fog(STREET_MOOD.fogColor, STREET_MOOD.fogNear, STREET_MOOD.fogFar);
    this.scene.add(this.fill);
    const sun = this.sun; sun.position.set(...STREET_MOOD.sunPosition); sun.castShadow = !this.options.mobile;
    // Low north-western sun down the street axis. The frustum is sized in light space so the whole
    // walkable street, from the station forecourt to the north limit, receives building shadows.
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -52, right: 52, top: 41, bottom: -12, near: 1, far: 120 });
    sun.target.position.set(...STREET_MOOD.sunTarget); sun.shadow.normalBias = .06; sun.shadow.bias = -.0002; this.scene.add(sun, sun.target);
    this.bounce.position.set(...STREET_MOOD.bouncePosition); this.bounce.target.position.set(...STREET_MOOD.bounceTarget); this.scene.add(this.bounce, this.bounce.target);
    this.atmosphere = createAtmosphereUniforms(sun.position, sun.target.position, STREET_MOOD.hazeColor);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(145, 24, 12), createSkyMaterial(this.atmosphere));
    this.scene.add(sky); this.sky = sky;
  }
  /** Without directional shadows a low sun would flood the street; soften it and lift the sky fill. */
  private syncSunBalance(){const shadows=this.renderer.shadowMap.enabled;this.sun.intensity=STREET_MOOD.sunIntensity*(shadows?1:STREET_MOOD.shadowlessSunScale);this.fill.intensity=STREET_MOOD.hemisphereIntensity*(shadows?1:STREET_MOOD.shadowlessFillScale);this.bounce.intensity=STREET_MOOD.bounceIntensity*(shadows?1:STREET_MOOD.shadowlessBounceScale);}
  private reviewView = (event:Event) => {
    // Fixed, collision-clear eye-level review points. Development diagnostics only.
    const views:Record<string,{x:number;z:number;yaw:number;pitch?:number}>={benchmark:{x:5,z:5.5,yaw:.88,pitch:.27},scooter:{x:3.3,z:4.7,yaw:-.62,pitch:-.28},taxi:{x:5,z:8,yaw:3.68,pitch:-.12},auto:{x:-5,z:8,yaw:2.6,pitch:-.12},'benchmark-close':{x:.4,z:-1.6,yaw:1.08,pitch:.5},'station-front':{x:2.2,z:6.5,yaw:Math.PI+.05,pitch:.1},'north-limit':{x:1.8,z:-59,yaw:-.08},'south-look':{x:14.5,z:15,yaw:Math.PI+.15},'side-gap':{x:5.4,z:-.7,yaw:-Math.PI/2},'hero-wide':{x:-2.5,z:4,yaw:Math.PI/2},hero:{x:-4.9,z:5.7,yaw:Math.PI/2},'fort-room':{x:-9.8,z:-33.6,yaw:Math.PI/2},spawn:STREET_SPAWN,station:{x:4.6,z:-4,yaw:Math.PI-.12},shops:{x:-4.8,z:-9,yaw:-.2},fort:{x:-5.1,z:-35,yaw:Math.PI/2},return:{x:4.7,z:-44,yaw:Math.PI+.16},npc:{x:5.6,z:6.8,yaw:Math.PI+.12},shop:{x:-5.7,z:-15,yaw:Math.PI/2},vegetation:{x:-4.8,z:-15,yaw:.38},junction:{x:4.8,z:-8,yaw:.7},institute:{x:-4.6,z:-30,yaw:.54},chai:{x:-4.75,z:2.75,yaw:2.08},bench:{x:5.2,z:-18.4,yaw:-2.86},walkers:{x:3.7,z:-1,yaw:-.22}};
    const view=views[(event as CustomEvent<string>).detail]??districtViews[(event as CustomEvent<string>).detail];if(view){this.endRide();this.placeVisitor(view.x,view.z,view.yaw);if(view.pitch!==undefined){this.pitch=view.pitch;this.updateCamera();}this.updateNear();}
  };
  setMode(mode: Mode) {
    if (mode !== 'world') { this.endRide(); this.unlock(); }
    this.mode = mode; this.audio?.setActive(this.soundEnabled&&mode==='world'&&!this.paused); this.releaseInput(); this.accumulator = 0;
    if (mode === 'world') { this.updateCamera(); this.updateNear(); } else this.options.onNear(null);
    if (this.debug) this.debug.hidden = mode !== 'world';
  }
  setPaused(paused: boolean) { this.paused = paused; this.audio?.setActive(this.soundEnabled&&!paused&&this.mode==='world'&&!document.hidden); this.pausedFrameDirty = true; this.releaseInput(); this.accumulator = 0; this.visitor.velocity.setZero(); if (paused) this.unlock(); }
  setSound(enabled:boolean) { this.soundEnabled=enabled; if(enabled&&!this.audio){try{this.audio=new StreetAudio();}catch{this.soundEnabled=false;}} this.audio?.setActive(enabled&&this.mode==='world'&&!this.paused&&!document.hidden); }
  setRenderPreset(preset:RenderPreset){this.renderPreset=preset;setCityDensity(preset);this.rendering.setPreset(this.quality.low?'low':preset);this.street.setDensity(preset==='high'&&!this.quality.low);this.renderer.shadowMap.enabled=preset!=='low'&&!this.options.mobile&&!this.quality.low;this.syncSunBalance();this.renderer.shadowMap.needsUpdate=true;this.resize();this.pausedFrameDirty=true;}
  setReducedMotion(reduced: boolean) { this.reducedMotion = reduced;this.pausedFrameDirty=true; }
  focusLandmark(_id: string) { /* Reading an overlay never changes the visitor's viewpoint. */ }
  travelTo(id: string) {
    const stop = streetStops[id]; if (!stop) { this.options.onSelect(id); return; }
    this.endRide(); this.placeVisitor(stop.x, stop.z, stop.yaw); this.updateNear();
  }
  reset() { this.tween = null; this.endRide(); this.placeVisitor(STREET_SPAWN.x, STREET_SPAWN.z, STREET_SPAWN.yaw); this.updateNear(); }
  /** Carry the visitor to a framing pose (guided tours). Instant under reduced motion. */
  frameView(view: TourView) {
    this.endRide(); this.releaseInput();
    const from = { x: this.visitor.position.x, z: this.visitor.position.z, yaw: this.yaw, pitch: this.pitch };
    const turn = Math.atan2(Math.sin(view.yaw - from.yaw), Math.cos(view.yaw - from.yaw));
    const to = { ...view, yaw: from.yaw + turn }, distance = Math.hypot(to.x - from.x, to.z - from.z);
    if (this.reducedMotion || distance > 40) { this.tween = null; this.placeVisitor(view.x, view.z, view.yaw); this.pitch = view.pitch; this.updateCamera(); this.updateNear(); this.pausedFrameDirty = true; return; }
    this.tween = { from, to, start: this.time, duration: Math.min(2.2, .7 + distance * .12 + Math.abs(turn) * .25) };
  }
  private updateTween() {
    const t = this.tween!; const k = Math.min(1, (this.time - t.start) / t.duration), e = k * k * (3 - 2 * k);
    this.visitor.position.set(t.from.x + (t.to.x - t.from.x) * e, .33, t.from.z + (t.to.z - t.from.z) * e); this.visitor.previousPosition.copy(this.visitor.position); this.visitor.velocity.setZero();
    this.yaw = t.from.yaw + (t.to.yaw - t.from.yaw) * e; this.pitch = t.from.pitch + (t.to.pitch - t.from.pitch) * e;
    if (k >= 1) { this.tween = null; this.visitor.wakeUp(); this.updateNear(); }
  }
  private placeVisitor(x: number, z: number, yaw: number) {
    this.syncZone(x); this.visitor.position.set(x, .33, z); this.visitor.previousPosition.copy(this.visitor.position); this.visitor.velocity.setZero(); this.visitor.wakeUp();
    this.yaw = yaw; this.pitch = -.015; this.gait = 0; this.releaseInput(); this.updateCamera();
  }
  setMove(key: string, down: boolean) { if (down) this.touchKeys.add(key); else this.touchKeys.delete(key); }
  board(kind: TransitKind) {
    this.endRide(); this.releaseInput(); this.visitor.velocity.setZero(); this.rideYaw = 0; this.ridePitch = 0;
    this.ride = { ...idleRide(), phase: this.reducedMotion ? 'boarding' : 'hailing', kind, fare: this.reducedMotion ? storyFare(kind, 0) : 0 };
    this.taxi.visible = kind === 'taxi'; this.auto.visible = kind === 'auto'; this.transit.visible = true; this.queuedDestination = null;
    // Pull in from the same lane, parallel to the pavement. No vehicle crosses a building.
    this.ridePath = streetPickupRoute({x:this.visitor.position.x,z:this.visitor.position.z}); this.rideLength = routeLength(this.ridePath); this.clearPickup(); this.pickupDistance = 0; this.rideSpeed=0;
    const p = pointAtDistance(this.ridePath, this.reducedMotion ? this.rideLength : 0); this.transit.position.set(p.x, .02, p.z); this.transit.rotation.y = p.heading;
    this.options.onRide({ ...this.ride });
  }
  /** District or Fort Road traffic standing where the hailed cab pulls in makes way, so the cab never appears inside a car. */
  private clearPickup() {
    const ox = cityZones[zoneIndexAt(this.ridePath[0].x)].originX, local = this.ridePath.map(p => ({ x: p.x - ox, z: p.z }));
    (this.zone ? this.district?.traffic : this.fortTraffic)?.clearAround(local, 2.2);
  }
  rideTo(id: string) {
    if (!streetStops[id] || this.ride.phase === 'idle') return;
    if (this.ride.phase === 'hailing') { this.queuedDestination = id; return; }
    this.rideLegs = cityRideLegs({ x: this.transit.position.x, z: this.transit.position.z }, id); this.legIndex = 0; this.legStart = 0; this.ridePath = this.rideLegs[0];
    this.rideLength = this.rideLegs.reduce((total, leg) => total + routeLength(leg), 0) + this.hopDistance(id);
    // Build the destination district now, while the cab is still pulling away.
    this.city.prepare(zoneIndexAt(streetStops[id].x));
    this.ride = { ...this.ride, phase: 'riding', destination: id, elapsed: 0, distance: 0, progress: 0 };
    if (this.reducedMotion) this.skipRide(); else this.options.onRide({ ...this.ride });
  }
  skipRide() { if (this.ride.phase === 'riding') { this.ride.distance = this.rideLength; this.legIndex = this.rideLegs.length - 1; this.ridePath = this.rideLegs[this.legIndex]; this.finishRide(); } }
  /** Virtual city distance a cross-district ride adds to the meter at the cut between legs. */
  private hopDistance(id: string) {
    const from = cityZones[zoneIndexAt(this.transit.position.x)].id, to = cityZones[zoneIndexAt(streetStops[id]?.x ?? 0)].id;
    if (from === to) return 0;
    const a = directory.find(d => d.id === from)?.position ?? [0, 0, 0], b = directory.find(d => d.id === to)?.position ?? [0, 0, 0];
    return Math.round(Math.hypot(a[0] - b[0], a[2] - b[2]) * 8);
  }
  /** Draw and simulate only the district that contains x. */
  private syncZone(x: number) {
    const index = zoneIndexAt(x); if (index === this.zone && (index === 0 || this.city.get(index)?.group.visible)) return;
    this.zone = index; const ox = cityZones[index].originX;
    this.street.group.visible = index === 0; this.fortTraffic.group.visible = index === 0; this.city.activate(index);
    // The hidden street's people rebuild their bone textures on return; releasing them keeps a district's texture count to its own.
    if (index !== 0) this.street.group.traverse(o => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && m.skeleton?.boneTexture) m.skeleton.dispose(); });
    this.sun.position.set(STREET_MOOD.sunPosition[0] + ox, STREET_MOOD.sunPosition[1], STREET_MOOD.sunPosition[2]);
    this.sun.target.position.set(STREET_MOOD.sunTarget[0] + ox, STREET_MOOD.sunTarget[1], STREET_MOOD.sunTarget[2]); this.sun.target.updateMatrixWorld();
    this.sky.position.x = ox; this.renderer.shadowMap.needsUpdate = true; this.pausedFrameDirty = true;
  }
  private fortPrevious = 0;
  private updateFortTraffic(others: THREE.Vector3[]) {
    const delta = this.reducedMotion ? 0 : Math.min(.08, Math.max(0, this.time - this.fortPrevious)); this.fortPrevious = this.time;
    this.fortTraffic.update(this.time, delta, [this.camera.position, ...others], this.street.roadWalkers);
  }
  private get district() { return this.zone ? this.city.get(this.zone) : null; }
  private finishRide() {
    const stop = streetStops[this.ride.destination ?? '']; if (!stop) return;
    const p = pointAtDistance(this.ridePath, routeLength(this.ridePath)); this.transit.position.set(p.x, .02, p.z); this.transit.rotation.y = p.heading; this.syncZone(p.x);
    this.ride = { ...this.ride, phase: 'arrived', distance: this.rideLength, fare: storyFare(this.ride.kind, this.rideLength), progress: 1 }; this.options.onRide({ ...this.ride });
  }
  endRide() {
    if (this.ride.phase === 'idle') return;
    const destination = this.ride.destination && streetStops[this.ride.destination];
    const phase = this.ride.phase;
    this.ride = idleRide(); this.rideSpeed=0; this.transit.visible = false;
    if (phase === 'arrived' && destination) this.placeVisitor(destination.x, destination.z, destination.yaw);
    else if (phase !== 'hailing') { const ox = cityZones[zoneIndexAt(this.transit.position.x)].originX; this.placeVisitor(ox + (this.transit.position.x - ox < 0 ? -4.9 : 4.9), this.transit.position.z, this.transit.rotation.y); }
    this.options.onRide({ ...this.ride }); this.releaseInput(); this.updateNear();
  }
  private updateRide(delta: number) {
    if (this.ride.phase === 'hailing') {
      this.pickupDistance = Math.min(this.rideLength, this.pickupDistance + delta * Math.max(.6,Math.min(4,(this.rideLength-this.pickupDistance)*2,this.pickupDistance*2+1)));
      const p = pointAtDistance(this.ridePath, this.pickupDistance); this.transit.position.set(p.x, .02, p.z);animateTransit(this.ride.kind==='taxi'?this.taxi:this.auto,this.pickupDistance);
      if (this.pickupDistance >= this.rideLength) {
        this.ride = { ...this.ride, phase: 'boarding', fare: storyFare(this.ride.kind, 0) }; this.options.onRide({ ...this.ride });
        if (this.queuedDestination) { const id = this.queuedDestination; this.queuedDestination = null; this.rideTo(id); }
      }
    } else if (this.ride.phase === 'riding') {
      this.ride.elapsed += delta;
      const target=Math.min(this.ride.kind==='auto'?4.2:5.2,Math.max(.65,(this.rideLength-this.ride.distance)*1.4));
      this.rideSpeed+=(target-this.rideSpeed)*(1-Math.exp(-2*delta));
      this.ride.distance = Math.min(this.rideLength, this.ride.distance + delta * this.rideSpeed);
      this.ride.fare = storyFare(this.ride.kind, this.ride.distance); this.ride.progress = this.rideLength ? this.ride.distance / this.rideLength : 1;
      // Crossing the city: at the end of the outbound leg, cut to the arrival road in the next district.
      if (this.legIndex < this.rideLegs.length - 1 && this.ride.distance - this.legStart >= routeLength(this.ridePath)) {
        const hop = this.rideLength - this.rideLegs.reduce((total, leg) => total + routeLength(leg), 0);
        this.legStart += routeLength(this.ridePath) + hop; this.ride.distance = this.legStart; this.legIndex++; this.ridePath = this.rideLegs[this.legIndex];
        const start = pointAtDistance(this.ridePath, 0); this.transit.position.set(start.x, .02, start.z); this.transit.rotation.y = start.heading; this.syncZone(start.x);
      }
      const p = pointAtDistance(this.ridePath, this.ride.distance - this.legStart); this.transit.position.set(p.x, .02, p.z);
      const turn = Math.atan2(Math.sin(p.heading - this.transit.rotation.y), Math.cos(p.heading - this.transit.rotation.y));
      this.transit.rotation.y += turn * (1 - Math.exp(-6 * delta));
      animateTransit(this.ride.kind==='taxi'?this.taxi:this.auto,this.ride.distance,turn);this.street.updateDrivers(this.reducedMotion?0:delta,turn);
      this.transit.rotation.z=this.reducedMotion?0:Math.sin(this.ride.elapsed*9)*.0018+THREE.MathUtils.clamp(turn,-.3,.3)*.025;
      if (this.ride.distance >= this.rideLength) this.finishRide();
    }
  }
  private resize = () => {
    const w = Math.max(this.container.clientWidth, 1), h = Math.max(this.container.clientHeight, 1); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.maxPixelRatio)*this.quality.scale); this.renderer.setSize(w, h, false);this.rendering?.resize(w,h);this.pausedFrameDirty=true;
  };
  private releaseInput = () => { this.keys.clear(); this.touchKeys.clear(); this.dragging = null; };
  private unlock() { if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock(); }
  private lockChanged = () => { if (!document.pointerLockElement) this.releaseInput(); };
  private visibilityChanged = () => { this.audio?.setActive(this.soundEnabled&&!document.hidden&&!this.paused&&this.mode==='world'); this.releaseInput(); this.lastTime = 0; this.accumulator = 0; };
  private contextLost = (event: Event) => { event.preventDefault(); this.options.onError(new Error('WebGL context lost')); };
  private keyDown = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"]') || this.mode !== 'world' || this.paused) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ',', '.'].includes(key)) { event.preventDefault(); this.keys.add(key); if (key !== 'shift') this.tween = null; if (key === ',' || key === '.') this.noteLook(1); }
    if (key === ' ' && !event.repeat && this.ride.phase === 'idle' && !this.tween) { event.preventDefault(); this.jumpQueued = true; }
    if (key === 'r' && !event.repeat) this.reset();
    if (key === 'e' && !event.repeat && this.ride.phase === 'idle' && this.nearest) this.interact();
  };
  /** Act on the target under the visitor's gaze: hail at a stand, otherwise open it. Also used by click. */
  interact() {
    if (this.ride.phase !== 'idle' || !this.nearest) return;
    this.unlock(); if (this.nearest.startsWith('hail-')) this.options.onHail(this.nearest.endsWith('taxi') ? 'taxi' : 'auto'); else this.options.onSelect(this.nearest);
  }
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
    else { if (this.tween && Math.hypot(dx, dy) > 2) this.tween = null; if (!this.tween) { this.yaw -= dx * .003; this.pitch = THREE.MathUtils.clamp(this.pitch - dy * .003, -1.05, 1.05); } }
    this.noteLook(Math.hypot(dx, dy) * .003);
    if (this.dragging) this.dragging = { x: event.clientX, y: event.clientY };
  };
  private pointerUp = () => { this.dragging = null; };
  private noteLook(amount: number) { if (this.looked > .6) return; this.looked += amount; if (this.looked > .6) this.options.onLook?.(); }
  /**
   * Compile a subtree's shaders before it is first drawn (in parallel where the driver allows):
   * a district built for an arriving ride, or the cast and vehicle models once they load. Compiling them
   * inside the first frame that shows them froze the game for a second or more on Windows drivers.
   */
  private warm(root: THREE.Object3D) {
    if (this.disposed) return;
    const group = new THREE.Group(); root.traverse(o => { if ((o as THREE.Mesh).isMesh) { const c = o.clone(false); c.visible = true; c.matrixWorld.copy(o.matrixWorld); group.add(c); } });
    // compile() only queues the programs (the driver links them in parallel where KHR_parallel_shader_compile exists);
    // compileAsync's readiness polling throws if a material is disposed meanwhile, as retired stand-in figures are.
    try { this.renderer.compile(group, this.camera, this.scene); } catch { /* Compiled on first draw instead. */ } finally { group.clear(); }
  }
  /** High keeps 1.5× sharpness on dense displays; Medium and phones stop at 1.25× (MSAA on a 1.5× canvas is 2.25× the fill of 1×). */
  private get maxPixelRatio() { return !this.options.mobile && this.renderPreset === 'high' ? 1.5 : 1.25; }
  private appliedLow = false;
  /** Switch street detail, post-processing and shadows to the low tier once AdaptiveQuality asks for it. Returns whether it did. */
  private applyLowTier() {
    if (this.quality.low === this.appliedLow) return false; this.appliedLow = this.quality.low;
    this.street.setQuality(this.quality.low); this.street.setDensity(this.renderPreset === 'high' && !this.quality.low); this.rendering.setPreset(this.quality.low ? 'low' : this.renderPreset); this.resize();
    this.renderer.shadowMap.enabled = !this.options.mobile && !this.quality.low && this.renderPreset !== 'low'; this.syncSunBalance(); this.renderer.shadowMap.needsUpdate = true; return true;
  }
  private blockers: Blocker[] = []; private jumpQueued = false;
  /** Vehicles, people and nearby walls around the visitor this frame, in world space. */
  private collectBlockers() {
    const out = this.blockers; out.length = 0; const view = this.camera.position;
    if (this.zone === 0) { this.street.collectBlockers(out, view); this.fortTraffic.collectBlockers(out, ORIGIN, view); } else this.district?.collectBlockers(out, view);
    if (this.transit.visible) out.push(vehicleBlocker(this.ride.kind === 'auto' ? this.auto : this.taxi, undefined, undefined));
    // Walls last, so a push out of a person never ends inside a wall.
    const p = this.visitor.position; collectStaticBlockers(out, this.physics.bodies, p.x, p.z, p.y - FLOOR_Y);
    return out;
  }
  /** True from a jump until the visitor is back on the street floor. */
  private airborne = false;
  /**
   * One 1/60 s step of the visitor: jump, physics, then step out of traffic and people. On foot the visitor
   * stays on the street floor: the stacked spheres would otherwise ride up the edge of a stall or kerb wall
   * and climb onto it (and into the awning above). Only a jump leaves the floor.
   */
  stepVisitor(blockers: Blocker[]) {
    const v = this.visitor;
    if (this.jumpQueued && this.grounded()) { v.velocity.y = 5.4; v.wakeUp(); this.airborne = true; }
    this.jumpQueued = false;
    this.physics.step(1 / 60);
    if (!this.airborne || (v.position.y <= FLOOR_Y + .005 && v.velocity.y <= 0)) { this.airborne = false; v.position.y = FLOOR_Y; if (v.velocity.y > 0) v.velocity.y = 0; }
    // Traffic and people have no physics bodies: step back out of any the visitor walked into.
    if (resolveBlockers(v.position, VISITOR_RADIUS, blockers, v.velocity)) v.previousPosition.copy(v.position);
  }
  /** Standing on something: the lowest sphere rests on the floor or a solid, not rising or falling. */
  private grounded() { return !this.airborne || (Math.abs(this.visitor.velocity.y) < .6 && this.contactBelow()); }
  private contactBelow() {
    for (const c of this.physics.contacts) { const other = c.bi === this.visitor ? c.bj : c.bj === this.visitor ? c.bi : null; if (!other) continue; const n = c.bi === this.visitor ? -c.ni.y : c.ni.y; if (n > .5) return true; }
    return this.visitor.position.y < .36;
  }
  private nearPose = new THREE.Vector4(Infinity, 0, 0, 0);
  /** Re-test targets only after the visitor moves 5 cm or turns, as Bruno Simon's InteractivePoints does; each test casts rays. */
  private updateNearIfMoved() {
    const p = this.visitor.position, pose = this.nearPose;
    if (Math.hypot(p.x - pose.x, p.z - pose.y) < .05 && Math.abs(this.yaw - pose.z) < .01 && Math.abs(this.pitch - pose.w) < .01) return;
    pose.set(p.x, p.z, this.yaw, this.pitch); this.updateNear();
  }
  private updateNear() {
    this.nearPose.set(this.visitor.position.x, this.visitor.position.z, this.yaw, this.pitch);
    const district = this.district, spatial = district?.spatial ?? this.street.spatial;
    const eye = new THREE.Vector3(this.visitor.position.x, this.visitor.position.y + 1.36, this.visitor.position.z), chest = new THREE.Vector3(this.visitor.position.x, 1.4, this.visitor.position.z);
    const forward = { x: -Math.sin(this.yaw) * Math.cos(this.pitch), y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * Math.cos(this.pitch) };
    const target = pickTarget(eye, forward, district?.interactions ?? this.street.interactions, t => spatial.visible(chest, t.position as THREE.Vector3));
    const next = target?.id ?? null;
    if (target) this.markerBase.copy(target.position as THREE.Vector3).y += .34;
    if (next !== this.nearest) { this.nearest = next; this.options.onNear(next, target?.label); }
  }
  private updateCamera() {
    if (this.ride.phase !== 'idle' && this.ride.phase !== 'hailing') {
      const local = new THREE.Vector3(this.ride.kind === 'auto' ? .34 : -.32, this.ride.kind === 'auto' ? 1.34 : 1.37, .63);
      local.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.transit.rotation.y); this.camera.position.copy(this.transit.position).add(local);
      this.camera.rotation.set(this.ridePitch, this.transit.rotation.y + this.rideYaw, 0);
    } else {
      const speed = Math.hypot(this.visitor.velocity.x, this.visitor.velocity.z);
      const bob = this.reducedMotion || this.paused ? 0 : Math.sin(this.gait) * .012 * Math.min(speed / 2.7, 1);
      this.camera.position.set(this.visitor.position.x, this.visitor.position.y + 1.36 + bob, this.visitor.position.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0);
    }
  }
  private frame = (timestamp: number) => {
    if (this.disposed) return; this.frameId = requestAnimationFrame(this.frame);if(this.inspectionFrozen)return;
    const elapsed = this.lastTime ? (timestamp - this.lastTime) / 1000 : 0; const delta = Math.min(elapsed, .08); this.lastTime = timestamp;
    if (document.hidden || this.mode !== 'world') return;
    if (this.paused && !this.pausedFrameDirty) return;
    const forceRender=this.pausedFrameDirty;this.pausedFrameDirty = false;
    let simulatedWalkingMs=0;
    try {
      if (!this.paused) {
        this.time += delta;
        if (this.ride.phase !== 'idle') this.updateRide(Math.min(elapsed, .25));
        else if (this.tween) this.updateTween();
        else {
          const held = (key: string) => this.keys.has(key) || this.touchKeys.has(key);
          const forward = Number(held('w') || held('arrowup')) - Number(held('s') || held('arrowdown'));
          const strafe = Number(held('d') || held('arrowright')) - Number(held('a') || held('arrowleft'));
          this.yaw += (Number(held(',')) - Number(held('.'))) * delta * 1.3;
          const velocity = walkingVelocity(forward, strafe, this.yaw, held('shift') ? 4 : 2.7);
          const physicsDelta=walkingSimulationDelta(elapsed);simulatedWalkingMs=physicsDelta*1000;
          this.accumulator += physicsDelta;
          const blockers = this.collectBlockers();
          while (this.accumulator >= 1 / 60) {
            if (forward || strafe) this.visitor.wakeUp();
            const blend = 1 - Math.exp(-12 / 60);
            this.visitor.velocity.x += (velocity.x - this.visitor.velocity.x) * blend; this.visitor.velocity.z += (velocity.z - this.visitor.velocity.z) * blend;
            this.stepVisitor(blockers); this.accumulator -= 1 / 60;
          }
          if (this.visitor.position.y < -2) this.reset();
          this.gait += Math.hypot(this.visitor.velocity.x, this.visitor.velocity.z) * physicsDelta * 3;
          this.updateNearIfMoved();
        }
      }
      this.syncZone(this.ride.phase === 'idle' || this.ride.phase === 'hailing' ? this.visitor.position.x : this.transit.position.x);
      this.updateCamera(); this.street.nearDetail=this.ride.phase==='idle'||this.ride.phase==='hailing';
      this.marker.visible = !!this.nearest && this.ride.phase === 'idle' && !this.tween; if (this.marker.visible) { this.marker.position.copy(this.markerBase); if (!this.reducedMotion) { this.marker.position.y += Math.sin(this.time * 3) * .025; this.marker.rotation.y = this.time * 1.4; } } const others = this.transit.visible ? [this.transit.position] : [];
      if (this.zone === 0) { this.street.loopTraffic = this.fortTraffic.onLane(FORT_LOOP_LANE); this.street.update(this.time, this.reducedMotion,this.camera.position); this.updateFortTraffic(others); }
      else this.district?.update(this.time, this.reducedMotion, this.camera.position, others);
      const needsRender=!this.reducedMotion||forceRender||this.camera.position.distanceToSquared(this.lastRenderPosition)>1e-8||this.camera.quaternion.angleTo(this.lastRenderRotation)>.0001||(this.renderer.shadowMap.enabled&&this.renderer.shadowMap.needsUpdate);
      if(needsRender&&!this.paused&&!this.reviewQuality&&this.quality.sample(elapsed)&&!this.applyLowTier())this.resize();
      if(!this.reducedMotion&&!this.paused&&this.time-this.lastShadow>.2&&this.renderer.shadowMap.enabled){this.renderer.shadowMap.needsUpdate=true;this.lastShadow=this.time;}
      this.audio?.update(this.ride.phase==='riding'?this.rideSpeed:Math.hypot(this.visitor.velocity.x,this.visitor.velocity.z),this.ride.phase!=='idle'&&this.ride.phase!=='hailing',this.ride.kind==='auto');
      if(needsRender){this.renderer.info.reset();this.profiler?.beforeRender();const renderStart=performance.now();this.rendering.render(delta);this.profiler?.afterRender({frameMs:elapsed*1000,renderCpuMs:performance.now()-renderStart,draws:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,textures:this.renderer.info.memory.textures,geometries:this.renderer.info.memory.geometries,programs:this.renderer.info.programs?.length??0,scale:this.quality.scale,preset:this.renderPreset,phase:this.ride.phase,worldX:this.visitor.position.x,worldZ:this.visitor.position.z,walkingSimulatedMs:simulatedWalkingMs,shadowRefreshed:this.rendering.frameCost.shadowDraws>0,shadowDraws:this.rendering.frameCost.shadowDraws,shadowTriangles:this.rendering.frameCost.shadowTriangles,shadowDrawCpuMs:this.rendering.frameCost.shadowDrawCpuMs,mainAndOtherDraws:this.rendering.frameCost.mainAndOtherDraws,mainAndOtherTriangles:this.rendering.frameCost.mainAndOtherTriangles});this.lastRenderPosition.copy(this.camera.position);this.lastRenderRotation.copy(this.camera.quaternion);this.debugFrames++;}
      if (timestamp - this.lastHud > 125) {
        if (this.benchmarkEnabled){this.renderer.domElement.dataset.benchmarkReady='true';this.renderer.domElement.dataset.ridePhase=this.ride.phase;this.renderer.domElement.dataset.renderMode=this.reducedMotion?'on-demand':'continuous';}
        if (this.debug) { const canvas = this.renderer.domElement; canvas.dataset.worldX = this.visitor.position.x.toFixed(3); canvas.dataset.cast = this.street.castStatus; canvas.dataset.worldZ = this.visitor.position.z.toFixed(3); canvas.dataset.eyeHeight = this.camera.position.y.toFixed(3); canvas.dataset.lookYaw = this.yaw.toFixed(3); canvas.dataset.renderScale=this.quality.scale.toFixed(2); canvas.dataset.quality=this.quality.low?'low':'high'; canvas.dataset.renderMode=this.reducedMotion?'on-demand':'continuous';canvas.dataset.navigation=this.street.navigationStatus;canvas.dataset.surfaceMaps=this.street.surfaceStatus;canvas.dataset.streetAssets=this.street.assetStatus;canvas.dataset.characterStatus=this.street.characterStatus;canvas.dataset.npcUpdateMs=this.street.npcUpdateMs.toFixed(3);canvas.dataset.trafficUpdateMs=this.street.trafficUpdateMs.toFixed(3);canvas.dataset.renderPreset=this.renderPreset; canvas.dataset.cameraMode = this.ride.phase === 'idle' || this.ride.phase === 'hailing' ? 'first-person' : 'passenger'; }
        this.options.onSpeed(this.ride.phase === 'riding' ? this.rideSpeed * 3.6 : Math.hypot(this.visitor.velocity.x, this.visitor.velocity.z) * 3.6);
        this.options.onPosition(this.ride.phase === 'idle' || this.ride.phase === 'hailing' ? { x: this.visitor.position.x, z: this.visitor.position.z, yaw: this.yaw } : { x: this.transit.position.x, z: this.transit.position.z, yaw: this.transit.rotation.y + this.rideYaw });
        if (this.ride.phase !== 'idle') this.options.onRide({ ...this.ride }); this.lastHud = timestamp;
      }
      if (this.debug) { this.debugTime += elapsed; if (this.debugTime > .75) { const info = this.renderer.info; this.debug.textContent = `${this.debugFrames?`${(this.debugFrames / this.debugTime).toFixed(1)} fps`:'idle'} · ${info.render.calls} draws · ${info.render.triangles} triangles · ${info.memory.textures} textures · ${info.programs?.length??0} shaders · ${Math.round(((performance as Performance & {memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize??0)/1048576)} MB JS · scale ${this.quality.scale.toFixed(2)} · eye ${this.camera.position.y.toFixed(2)}m`; this.debugTime = 0; this.debugFrames = 0; } }
    } catch (error) { this.dispose(); this.options.onError(error); }
  };
  dispose() {
    if (this.disposed) return; this.disposed = true; cancelAnimationFrame(this.frameId); this.audio?.dispose(); this.resizeObserver.disconnect(); this.releaseInput(); this.unlock();
    window.removeEventListener('street-review-view',this.reviewView);window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.releaseInput);
    document.removeEventListener('visibilitychange', this.visibilityChanged); document.removeEventListener('pointerlockchange', this.lockChanged);
    const canvas = this.renderer.domElement; canvas.removeEventListener('pointerdown', this.pointerDown); window.removeEventListener('pointermove', this.pointerMove); window.removeEventListener('pointerup', this.pointerUp); canvas.removeEventListener('pointercancel', this.pointerUp); canvas.removeEventListener('webglcontextlost', this.contextLost);
    window.removeEventListener('street-benchmark',this.benchmarkCommand);this.profiler?.dispose();this.city.dispose();districtCast()?.dispose();setDistrictCast(null);this.street.dispose();this.fortTraffic.group.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;for(const g of new Set([m.geometry,...((m.userData.lodGeometries??[]) as THREE.BufferGeometry[])]))g.dispose();});this.rendering.dispose();this.environmentTarget.dispose();
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), skeletons = new Set<THREE.Skeleton>();
    this.scene.traverse(object => { const mesh = object as THREE.SkinnedMesh; if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton); if (mesh.geometry) geometries.add(mesh.geometry); for(const g of (mesh.userData.lodGeometries??[]) as THREE.BufferGeometry[]) geometries.add(g); if (mesh.material) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) { materials.add(m); for(const key of ['map','bumpMap','roughnessMap','normalMap'] as const)if((m as THREE.MeshStandardMaterial)[key])textures.add((m as THREE.MeshStandardMaterial)[key]!); } });
    skeletons.forEach(s => s.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); this.renderer.dispose(); canvas.remove(); this.debug?.remove();
  }
}
