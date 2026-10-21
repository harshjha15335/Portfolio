import { gpuName, type ArrivalShaders, type BenchFrame, type ViewResources } from './visitorBenchmark';
import {GPUFrameProfiler} from './GPUFrameProfiler';
import {stationCharacter} from '../data/stationCharacter';
import {characterCast} from '../data/characterCast';
import {walkingSimulationDelta} from './frameTiming';
import {STREET_MOOD} from '../game/World/streetMood';
import {EnvironmentTime} from './EnvironmentTime';
import {worldClock} from '../game/World/time/IndiaWorldClock';
import {applyStreetAtmosphere,createAtmosphereUniforms,createSkyMaterial,type AtmosphereUniforms} from '../game/World/StreetAtmosphere';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createVisitor } from '../game/World/WalkingBody';
import { MumbaiStreet } from '../game/World/MumbaiStreet';
import { createTransitModel, animateTransit } from '../game/World/TransitModel';
import { idleRide, type Point, type RideStatus, type TransitKind } from '../game/World/transit';
import { CITY_METRES_PER_MAP_UNIT, CITY_METRES_PER_WORLD_METRE, DEMO_FARES, FareMeter } from '../game/World/meter/FareMeter';
import type { PhysicalMeter } from '../game/World/meter/MeterModel';
import { DISTRICT_JUNCTIONS, FORT_JUNCTIONS, PassengerRide, kerbRoom } from '../game/World/traffic/PassengerRide';
import { JunctionReservations, TrafficSpace, onCarriageway, type ViewCone } from '../game/World/traffic/TrafficSafety';
import { TrafficOverlay } from '../game/World/traffic/TrafficOverlay';
import { preloadCityVehicleModels } from '../game/World/districts/CityVehicleModels';
import { STREET_SPAWN, streetStops, pickupRoutes, walkingVelocity, cityRideLegs, cityZones, zoneIndexAt, districtViews, acrossSeam, avenueNeighbour, onAvenue, seamNorth, SEAM_SOUTH } from '../game/World/streetLayout';
import { CityDistricts } from '../game/World/districts/CityDistricts';
import { AVENUE_PACE, setCityDensity } from '../game/World/districts/District';
import { Avenue } from '../game/World/districts/avenue';
import { createFortRoadTraffic, FORT_LOOP_LANE } from '../game/World/districts/FortRoadTraffic';
import { DistrictCast, districtCast, setDistrictCast } from '../game/World/districts/DistrictCast';
import { setFriendSource } from '../game/World/npc/FriendSlot';
import type { GLBAssetLibrary } from '../game/World/assets/GLBAssetLibrary';
import { SignAtlas, VEHICLE_HIDDEN, type LaneTraffic } from '../game/World/districts/DistrictSystems';
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
  /** A directory jump is waiting for its district to finish building (the stop's id), or has landed (null). */
  onArriving?: (id: string | null) => void;
}
/** Main-thread time per frame given to building a district ahead of arrival. */
const DISTRICT_SLICE_MS = 6;
/** Longest a directory jump waits on the driver linking the new district's shaders before landing anyway. */
const ARRIVAL_SHADER_WAIT_MS = 4000;
import { AdaptiveQuality } from './AdaptiveQuality';
import { Soundscape } from './audio/Soundscape';
import { DEFAULT_AUDIO, type AudioLevels } from './audio/audioSettings';
import { playCue } from './audio/cues';
import type { Surface } from './audio/soundscapeMix';
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
  private friendLibrary: GLBAssetLibrary | null = null;
  private city!: CityDistricts; private fortTraffic!: LaneTraffic;
  /** Index into cityZones of the district being drawn; 0 is CST–Fort. */
  private zone = 0;
  private sky!: THREE.Mesh;
  /** Fort Road's avenue to BKC (the districts build their own); `streetAvenueJob` builds it in slices. */
  private streetAvenue!: Avenue; private streetAvenueSigns = new SignAtlas(); private streetAvenueJob: Generator<void> | null = null;
  private stepStreetAvenue(budgetMs: number) {
    const job = this.streetAvenueJob; if (!job) return; const start = performance.now();
    do { if (job.next().done) { this.streetAvenueJob = null; const signs = this.streetAvenueSigns.build(); if (signs) { signs.name = 'street:avenue-signs'; this.streetAvenue.group.add(signs); } applyStreetAtmosphere(this.streetAvenue.group, this.atmosphere); this.warm(this.streetAvenue.group); this.renderer.shadowMap.needsUpdate = true; break; } } while (performance.now() - start < budgetMs);
  }
  /** The hailed or boarded cab: a collision-safe vehicle in the traffic (see PassengerRide). */
  private cab = Object.assign(new PassengerRide(), { distanceScale: CITY_METRES_PER_WORLD_METRE });
  /** The current district's road this frame: every vehicle, the cab, the visitor and people on the carriageway (local). */
  private traffic = new TrafficSpace();
  /** U-turn areas the cab shares with the traffic, per district (index as cityZones). */
  private junctions = cityZones.map((_, i) => new JunctionReservations(i === 0 ? FORT_JUNCTIONS : DISTRICT_JUNCTIONS, (a, b) => a !== b && (a === 'ride' || b === 'ride')));
  private pausedFrameDirty = true;
  private mode: Mode = 'intro'; private paused = false; private disposed = false;
  private reducedMotion: boolean;
  private quality: AdaptiveQuality;
  private benchmarkEnabled=new URLSearchParams(location.search).get('benchmark')==='1';
  private profiler:GPUFrameProfiler|null=null;
  private frameObserver:((frame:BenchFrame)=>void)|null=null;
  private reviewQuality=(import.meta.env.DEV&&new URLSearchParams(location.search).get('review')==='1')||(this.benchmarkEnabled&&new URLSearchParams(location.search).get('fixedQuality')==='1');
  private lastShadow=0;
 private inspectionFrozen=false;
  private rendering!:StreetRenderer;
  private renderPreset:RenderPreset='medium';
  private environmentTarget!:THREE.WebGLRenderTarget;
  private audio: Soundscape | null=null; private audioLevels: AudioLevels = DEFAULT_AUDIO.levels;
  private soundEnabled=false;
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
  private ride = idleRide(); private queuedDestination: string | null = null;
  /** The boarded cab's fare meter: it powers on when a cab is hailed, is hired when a destination is chosen, and is the only source of the ride's fare. */
  private meter = new FareMeter(DEMO_FARES.taxi);
  private transit = new THREE.Group(); private taxi = createTransitModel('taxi','close'); private auto = createTransitModel('auto','close');
  private lastRenderPosition=new THREE.Vector3(Infinity,Infinity,Infinity);
  private lastRenderRotation=new THREE.Quaternion();
  private debug: HTMLElement | null = null; private debugTime = 0; private debugFrames = 0;
  /** `?debug&traffic`: envelope outlines and a traffic summary line. */
  private trafficOverlay: TrafficOverlay | null = null; private trafficLine = '';
  private atmosphere!: AtmosphereUniforms;
  /** The India world clock's lighting: one shared moment for every district. */
  private environment!: EnvironmentTime;
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
    this.city = new CityDistricts(this.physics, this.street.surfaceLibrary, this.scene, district => { applyStreetAtmosphere(district.group, this.atmosphere); const before = this.renderer.info.programs?.length ?? 0; this.compiling = this.warm(district.group); this.linkStarted = performance.now(); this.linkPrograms = (this.renderer.info.programs?.length ?? 0) - before; if (import.meta.env.DEV) console.info(`District ${district.spec.id} built in ${district.buildMs.toFixed(0)} ms`); }); this.fortTraffic = createFortRoadTraffic(() => this.street.loopVehicles); applyStreetAtmosphere(this.fortTraffic.group, this.atmosphere); this.scene.add(this.fortTraffic.group);
    // Fort Road's avenue north to BKC, built over the first frames (see `frame`), with the street's other zone-0 parts.
    this.streetAvenue = new Avenue(this.physics, this.street.surfaceLibrary, new THREE.Vector3(), { index: 0, end: 'south', signs: this.streetAvenueSigns, ground: true, onParked: (kind, x, z, yaw) => this.fortTraffic.parkedAt(kind, x, z, yaw) });
    this.streetAvenueJob = this.streetAvenue.steps(); this.street.group.add(this.streetAvenue.group); if (typeof location !== 'undefined') void preloadCityVehicleModels(location.origin).then(() => { if (this.disposed) return; this.fortTraffic.refresh(); this.city.refreshVehicles(); this.warm(this.scene); this.pausedFrameDirty = true; }); this.street.setQuality(this.quality.low);this.renderer.shadowMap.needsUpdate=true;void this.street.assetsReady.then(()=>{if(!this.disposed){this.pausedFrameDirty=true;this.renderer.shadowMap.needsUpdate=true;}});
    const preview=import.meta.env.DEV?new URLSearchParams(location.search).get('characterPreview'):null;
    // Licensed street cast: approved characters load at runtime; DEV ?characterPreview also shows candidates.
    const castPreview=preview==='idle'||preview==='walk'||preview==='cast';
    const refresh=()=>{if(!this.disposed){applyStreetAtmosphere(this.scene,this.atmosphere);this.warm(this.scene);this.pausedFrameDirty=true;this.renderer.shadowMap.needsUpdate=true;}};
    void this.street.installCast(characterCast,castPreview).then(refresh).catch(error=>console.warn('Street cast unavailable; original figures retained',error));
    // The same licensed people walk every district: one shared set of rigs, borrowing the street's uploaded textures.
    void this.street.sharedAssetLibrary().then(library=>DistrictCast.load(library,characterCast)).then(cast=>{if(this.disposed){cast.dispose();return;}setDistrictCast(cast);this.city.adoptCast(cast);this.fortTraffic.adopt(cast);refresh();}).catch(error=>console.warn('District cast unavailable; procedural figures retained',error));
    void this.street.installDrivers(characterCast,[this.taxi,this.auto],castPreview).then(refresh).catch(error=>console.warn('Drivers unavailable; original drivers retained',error));
    // Harsh's friends in the districts each load their own character, from a library of their own so the shared one stays within its asset cap.
    void import('../game/World/assets/GLBAssetLibrary').then(({GLBAssetLibrary})=>{if(this.disposed)return;this.friendLibrary=new GLBAssetLibrary(window.location.origin,8*1024*1024,8);setFriendSource({library:this.friendLibrary,cast:characterCast,preview:castPreview,loaded:refresh});});
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
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {window.addEventListener('street-review-view',this.reviewView); this.debug = document.createElement('div'); this.debug.className = 'world-debug'; this.debug.setAttribute('aria-label', 'Renderer diagnostics'); container.append(this.debug); (window as unknown as {__world?:WorldEngine}).__world=this; if (new URLSearchParams(location.search).has('traffic')) { this.trafficOverlay = new TrafficOverlay(); this.scene.add(this.trafficOverlay.lines); } }
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
    // Initial (golden-hour) sun; EnvironmentTime moves it to the real one and re-fits this frustum. Sized in light space so the whole
    // walkable street, from the station forecourt to the north limit, receives building shadows.
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -52, right: 52, top: 41, bottom: -12, near: 1, far: 120 });
    sun.target.position.set(...STREET_MOOD.sunTarget); sun.shadow.normalBias = .06; sun.shadow.bias = -.0002; this.scene.add(sun, sun.target);
    this.bounce.position.set(...STREET_MOOD.bouncePosition); this.bounce.target.position.set(...STREET_MOOD.bounceTarget); this.scene.add(this.bounce, this.bounce.target);
    this.atmosphere = createAtmosphereUniforms(sun.position, sun.target.position, STREET_MOOD.hazeColor);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(145, 24, 12), createSkyMaterial(this.atmosphere));
    this.scene.add(sky); this.sky = sky;
    // Real Mumbai time drives the sun, sky, fog, exposure and the city's lamps from here on.
    this.environment = new EnvironmentTime(worldClock(), { scene: this.scene, renderer: this.renderer, sun, bounce: this.bounce, fill: this.fill, sky, atmosphere: this.atmosphere });
    void worldClock().checkServer();
  }
  /** Re-fit the time-of-day rig to the current zone and shadow setting (without shadows the sun is softened and the sky fill lifted). */
  private syncSunBalance(){this.environment.configure(cityZones[this.zone].originX,this.renderer.shadowMap.enabled);this.pausedFrameDirty=true;}
  private reviewView = (event:Event) => {
    // Fixed, collision-clear eye-level review points. Development diagnostics only.
    const views:Record<string,{x:number;z:number;yaw:number;pitch?:number}>={benchmark:{x:5,z:5.5,yaw:.88,pitch:.27},scooter:{x:3.3,z:4.7,yaw:-.62,pitch:-.28},taxi:{x:5,z:8,yaw:3.68,pitch:-.12},auto:{x:-5,z:8,yaw:2.6,pitch:-.12},'benchmark-close':{x:.4,z:-1.6,yaw:1.08,pitch:.5},'station-front':{x:2.2,z:6.5,yaw:Math.PI+.05,pitch:.1},'station-wide':{x:-1.6,z:-9,yaw:Math.PI+.06,pitch:.16},'north-limit':{x:1.8,z:-59,yaw:-.08},'south-look':{x:14.5,z:15,yaw:Math.PI+.15},'side-gap':{x:5.4,z:-.7,yaw:-Math.PI/2},'hero-wide':{x:-2.5,z:4,yaw:Math.PI/2},hero:{x:-4.9,z:5.7,yaw:Math.PI/2},'fort-room':{x:-9.8,z:-33.6,yaw:Math.PI/2},spawn:STREET_SPAWN,station:{x:4.6,z:-4,yaw:Math.PI-.12},shops:{x:-4.8,z:-9,yaw:-.2},fort:{x:-5.1,z:-35,yaw:Math.PI/2},return:{x:4.7,z:-44,yaw:Math.PI+.16},npc:{x:5.6,z:6.8,yaw:Math.PI+.12},shop:{x:-5.7,z:-15,yaw:Math.PI/2},vegetation:{x:-4.8,z:-15,yaw:.38},junction:{x:4.8,z:-8,yaw:.7},institute:{x:-4.6,z:-30,yaw:.54},chai:{x:-4.75,z:2.75,yaw:2.08},bench:{x:5.2,z:-18.4,yaw:-2.86},walkers:{x:3.7,z:-1,yaw:-.22}};
    const view=views[(event as CustomEvent<string>).detail]??districtViews[(event as CustomEvent<string>).detail];if(view){this.endRide();this.placeVisitor(view.x,view.z,view.yaw);if(view.pitch!==undefined){this.pitch=view.pitch;this.updateCamera();}this.updateNear();}
  };
  setMode(mode: Mode) {
    if (mode !== 'world') { this.endRide(); this.unlock(); }
    this.mode = mode; this.audio?.setActive(this.soundEnabled&&mode==='world'&&!this.paused); this.releaseInput(); this.accumulator = 0;
    if (mode === 'world') { this.updateCamera(); this.updateNear(); } else this.options.onNear(null);
    if (this.debug) this.debug.hidden = mode !== 'world';
  }
  setPaused(paused: boolean) { this.paused = paused; this.audio?.setActive(this.soundEnabled&&!paused&&this.mode==='world'&&!document.hidden); this.pausedFrameDirty = true; this.releaseInput(); this.accumulator = 0; this.visitor.velocity.setZero(); if (paused) this.unlock(); }
  /** Turn city sound on or off. The audio context is created on the first turn-on, which is always a visitor's gesture (autoplay rules). */
  setSound(enabled:boolean) { this.soundEnabled=enabled; if(enabled&&!this.audio){try{this.audio=new Soundscape(this.audioLevels);}catch{this.soundEnabled=false;}} this.audio?.setActive(this.soundEnabled&&this.mode==='world'&&!this.paused&&!document.hidden); this.renderer.domElement.dataset.audio=this.audio&&this.soundEnabled?'on':'off'; }
  setAudioLevels(levels:AudioLevels) { this.audioLevels={...levels}; this.audio?.setLevels(levels); }
  /** Sound diagnostics: context state, one-shot voices, levels (dev overlay, tests). */
  get audioStats() { return this.audio?.stats() ?? null; }
  setRenderPreset(preset:RenderPreset){this.renderPreset=preset;setCityDensity(preset);this.rendering.setPreset(this.quality.low?'low':preset);this.street.setDensity(preset==='high'&&!this.quality.low);this.renderer.shadowMap.enabled=preset!=='low'&&!this.options.mobile&&!this.quality.low;this.syncSunBalance();this.renderer.shadowMap.needsUpdate=true;this.resize();this.pausedFrameDirty=true;}
  setReducedMotion(reduced: boolean) { this.reducedMotion = reduced;this.pausedFrameDirty=true; }
  /** Visitor benchmark (`?bench`): per-rendered-frame cost, a look override, quality pinning and the GPU name. */
  setFrameObserver(observer: ((frame: BenchFrame) => void) | null) { this.frameObserver = observer; }
  setView(yaw: number, pitch = -.015) { this.yaw = yaw; this.pitch = pitch; this.updateCamera(); }
  pinQuality(pinned: boolean) { this.reviewQuality = pinned; }
  /** Advance the world by a fixed step per rendered frame instead of wall time, so a slow renderer can still record smooth motion (review captures). 0 restores real time. */
  setFixedStep(seconds: number) { this.fixedStep = Math.max(0, seconds); }
  private fixedStep = 0;
  get gpu() { return gpuName(this.renderer.getContext()); }
  /** Textures and programs the visible scene binds now, with bone textures split from image textures. */
  viewResources(): ViewResources {
    const images = new Set<THREE.Texture>(), bones = new Set<THREE.Texture>(), programs = new Set<unknown>();
    this.scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh & { skeleton?: THREE.Skeleton };
      if (!mesh.material) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const program = (this.renderer.properties.get(material) as { currentProgram?: unknown }).currentProgram; if (program) programs.add(program);
        for (const value of Object.values(material)) if ((value as THREE.Texture | null)?.isTexture) images.add(value as THREE.Texture);
      }
      if (mesh.skeleton?.boneTexture) bones.add(mesh.skeleton.boneTexture);
    });
    if (this.scene.environment) images.add(this.scene.environment);
    return { imageTextures: images.size, boneTextures: bones.size, programs: programs.size };
  }
  focusLandmark(_id: string) { /* Reading an overlay never changes the visitor's viewpoint. */ }
  travelTo(id: string) {
    const stop = streetStops[id]; if (!stop) { this.options.onSelect(id); return; }
    this.endRide(); this.tween = null;
    const index = zoneIndexAt(stop.x);
    // A district not built yet is built over the next frames while the visitor stays put, instead of freezing on the jump.
    if (!this.reducedMotion && !this.city.isReady(index)) { this.city.prepare(index); this.arrivingAt = id; this.arrivalStarted = performance.now(); this.options.onArriving?.(id); return; }
    this.land(id);
  }
  /** The stop a directory jump is waiting to land at, while its district builds. */
  get arriving() { return this.arrivingAt; }
  private arrivingAt: string | null = null;
  private arrivalStarted = 0;
  /** Smoothed length of frames that did no district building. */
  private typicalFrameMs = 16.7; private builtLastFrame = false;
  private land(id: string) {
    const stop = streetStops[id], waited = this.arrivingAt !== null; this.arrivingAt = null;
    this.placeVisitor(stop.x, stop.z, stop.yaw); this.updateNear();
    if (waited) this.options.onArriving?.(null);
  }
  private cancelArrival() { if (this.arrivingAt === null) return; this.arrivingAt = null; this.options.onArriving?.(null); }
  reset() { this.tween = null; this.cancelArrival(); this.endRide(); this.placeVisitor(STREET_SPAWN.x, STREET_SPAWN.z, STREET_SPAWN.yaw); this.updateNear(); }
  /** Carry the visitor to a framing pose (guided tours). Instant under reduced motion. */
  frameView(view: TourView) {
    this.cancelArrival(); this.endRide(); this.releaseInput();
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
    this.cancelArrival(); this.endRide(); this.releaseInput(); this.visitor.velocity.setZero(); this.rideYaw = 0; this.ridePitch = 0;
    this.meter.apply('cancel'); this.meter.apply('reset'); this.meter.apply('power-off'); this.meter.setPolicy(DEMO_FARES[kind]); this.meter.apply('power-on');
    this.ride = { ...idleRide(), phase: this.reducedMotion ? 'boarding' : 'hailing', kind }; this.readMeter();
    this.taxi.visible = kind === 'taxi'; this.auto.visible = kind === 'auto'; this.queuedDestination = null;
    // The cab comes up the lane with the traffic, from out of sight where it can, and pulls in at a free kerb spot.
    const routes = pickupRoutes({ x: this.visitor.position.x, z: this.visitor.position.z }, (x, z) => this.kerbClear(x, z, kind));
    if (this.reducedMotion) {
      // No motion: the cab is simply there; anything standing on its spot makes way.
      const route = routes[routes.length - 1], ox = cityZones[zoneIndexAt(route[0].x)].originX;
      this.trafficAt(zoneIndexAt(route[0].x))?.clearAround(route.slice(-2).map(p => ({ x: p.x - ox, z: p.z })), 2.2, true);
      this.cab.standAt(kind, route); this.transit.visible = true;
    } else if (this.flagDown(kind, routes[0])) this.transit.visible = true;
    else { this.cab.hail(kind, routes); this.transit.visible = false; }
    this.placeTransit(0); this.options.onRide({ ...this.ride });
  }
  /** A passing auto or taxi coming toward the visitor standing at the kerb, which they could wave down. */
  private passingCab(kind?: TransitKind) {
    const p = this.visitor.position, index = zoneIndexAt(p.x), ox = cityZones[index].originX, lx = p.x - ox;
    if (Math.abs(lx) < 3.6 || Math.abs(lx) > 8.5) return null;
    const v = this.trafficAt(index)?.passing(lx, p.z) ?? null; return v && (!kind || v.kind === kind) ? { ...v, ox } : null;
  }
  /** Wave down a passing auto or taxi: that very vehicle leaves the traffic and pulls in at the kerb beside the visitor. */
  private flagDown(kind: TransitKind, pickup: Point[]) {
    const v = this.passingCab(kind); if (!v) return false;
    // Only the pull-in (lane entry, settle, kerb) and only if the cab can still reach the entry going straight on.
    const pull = pickup.slice(-3), fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
    if ((pull[0].x - v.ox - v.x) * fx + (pull[0].z - v.z) * fz < 4) return false;
    this.trafficAt(zoneIndexAt(v.ox))?.withdraw(v.id);
    this.cab.pullOver(kind, [{ x: v.ox + v.x, z: v.z }, ...pull], v.speed); return true;
  }
  /** Every few frames: offer to wave down a cab that is coming, when nothing else is under the visitor's gaze. */
  private updatePassing() {
    if (this.ride.phase !== 'idle' || this.tween || (this.nearest && !this.nearest.startsWith('flag-'))) return;
    const v = this.passingCab(), next = v ? `flag-${v.kind}` : null;
    if (next !== this.nearest) { this.nearest = next; this.options.onNear(next, v ? `Wave down the ${v.kind === 'taxi' ? 'kaali-peeli taxi' : 'auto'}` : undefined); }
    if (v) this.markerBase.set(v.ox + v.x, 2.4, v.z);
  }
  /** True when a cab of `kind` standing at the kerb at (x, z) (world) would not touch a parked vehicle. */
  private kerbClear(x: number, z: number, kind: TransitKind) { const index = zoneIndexAt(x); return kerbRoom(this.trafficAt(index)?.parked ?? [], x - cityZones[index].originX, z, kind); }
  /** The through traffic of district `index` (Fort Road's when 0), if it is built. */
  private trafficAt(index: number) { return index === 0 ? this.fortTraffic : this.city.peek(index)?.traffic ?? null; }
  rideTo(id: string) {
    if (!streetStops[id] || this.ride.phase === 'idle') return;
    if (this.ride.phase === 'hailing') { this.queuedDestination = id; return; }
    this.cab.depart(cityRideLegs({ x: this.cab.pose.x, z: this.cab.pose.z }, id), this.hopDistance(id));
    // Build the first district on the way now, while the cab is still pulling away (the rest as it nears them).
    const next = this.cab.nextLeg; if (next) this.city.prepare(zoneIndexAt(next.x));
    this.meter.apply('hire'); playCue('meter-hire'); this.ride = { ...this.ride, phase: 'riding', destination: id, elapsed: 0, progress: 0 }; this.readMeter();
    if (this.reducedMotion) this.skipRide(); else this.options.onRide({ ...this.ride });
  }
  skipRide() {
    if (this.ride.phase !== 'riding') return;
    this.cab.finish(); this.syncZone(this.cab.pose.x);
    // A cut to the stop: whatever stands on the cab's spot there makes way (the visitor was not looking at it).
    const ox = cityZones[this.zone].originX; this.trafficAt(this.zone)?.clearAround([{ x: this.cab.pose.x - ox, z: this.cab.pose.z }], 2.4, true);
    this.placeTransit(0); this.finishRide();
  }
  /** Virtual city distance a cross-district ride adds to the meter at the cut between legs. */
  private hopDistance(id: string) {
    const from = cityZones[zoneIndexAt(this.transit.position.x)].id, to = cityZones[zoneIndexAt(streetStops[id]?.x ?? 0)].id;
    if (from === to) return 0;
    const a = directory.find(d => d.id === from)?.position ?? [0, 0, 0], b = directory.find(d => d.id === to)?.position ?? [0, 0, 0];
    return Math.round(Math.hypot(a[0] - b[0], a[2] - b[2]) * CITY_METRES_PER_MAP_UNIT);
  }
  /** Draw and simulate only the district that contains x. */
  private syncZone(x: number, keep = -1) {
    const index = zoneIndexAt(x); if (index === this.zone && (index === 0 || this.city.peek(index)?.group.visible)) return;
    this.zone = index; const ox = cityZones[index].originX;
    this.street.group.visible = index === 0; this.fortTraffic.group.visible = index === 0; this.city.activate(index, keep);
    // The hidden street's people rebuild their bone textures on return; releasing them keeps a district's texture count to its own.
    if (index !== 0) this.street.group.traverse(o => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && m.skeleton?.boneTexture) m.skeleton.dispose(); });
    this.environment.configure(ox, this.renderer.shadowMap.enabled);
    this.renderer.shadowMap.needsUpdate = true; this.pausedFrameDirty = true;
  }
  /**
   * The visitor walked past the seam halfway along an avenue: carry them into the next district's copy of it, which
   * looks the same. Until that district is built they wait at the seam (it is prepared from the avenue's start).
   */
  private crossSeam() {
    const v = this.visitor, p = v.position, to = acrossSeam(p.x, p.z); if (!to) return;
    if (!this.city.isReady(to.index)) {
      this.city.prepare(to.index);
      p.z = to.index > this.zone ? seamNorth(this.zone) + .01 : SEAM_SOUTH - .01; v.velocity.z = 0; v.previousPosition.copy(p); return;
    }
    const dx = to.x - p.x, dz = to.z - p.z, from = this.zone;
    p.x += dx; p.z += dz; v.previousPosition.x += dx; v.previousPosition.z += dz; v.interpolatedPosition.x += dx; v.interpolatedPosition.z += dz;
    this.tween = null; this.syncZone(p.x, from); this.updateCamera(); this.updateNear();
  }
  /**
   * Build the district an avenue leads to while the visitor (or the cab) is on it, and release districts left
   * behind once they are back on a district's own street.
   */
  private manageNeighbours() {
    const onFoot = this.ride.phase === 'idle' || this.ride.phase === 'hailing', p = onFoot ? this.visitor.position : this.transit.position;
    const next = avenueNeighbour(p.x, p.z);
    if (next !== null) { if (next > 0 && !this.city.peek(next)) this.city.prepare(next); }
    else if (!this.arrivingAt && this.ride.phase !== 'riding' && this.city.size > (this.zone ? 1 : 0)) this.city.trim(this.zone);
    // The sky dome and the shadowed box travel with the view along the avenues.
    this.sky.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.environment.follow(this.camera.position.z);
  }
  /** What the visitor can see now, in district `originX`'s local frame (spawn and despawn rules). */
  private viewCone(originX: number): ViewCone {
    const f = this.camera.getWorldDirection(this.viewDirection), h = Math.hypot(f.x, f.z) || 1;
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect) + .2;
    return { x: this.camera.position.x - originX, z: this.camera.position.z, fx: f.x / h, fz: f.z / h, halfAngle: half, range: VEHICLE_HIDDEN };
  }
  private viewDirection = new THREE.Vector3(); private trafficZone = -1;
  /** Fill the shared traffic space for this frame: the district's vehicles, the cab, the visitor and people on the road. */
  private prepareTraffic() {
    const space = this.traffic, ox = cityZones[this.zone].originX; space.clear(); this.trafficZone = this.zone;
    if ((this.ride.phase === 'idle' || this.ride.phase === 'hailing') && onCarriageway(this.visitor.position.x - ox, this.visitor.position.z)) space.add({ id: 'visitor', x: this.visitor.position.x - ox, z: this.visitor.position.z, yaw: 0, halfLength: .35, halfWidth: .35, category: 'visitor', speed: 0 });
    if (this.zone === 0) {
      this.street.trafficSpace = space; this.street.trafficJunctions = this.junctions[0];
      this.street.publishTraffic(space); this.fortTraffic.junctions = this.junctions[0]; this.fortTraffic.publish(space);
      this.street.roadWalkers.forEach((w, k) => space.add({ id: `walker:${k}`, x: w.x, z: w.z, yaw: 0, halfLength: .3, halfWidth: .3, category: 'person', speed: 0 }));
    } else {
      this.street.trafficSpace = null; const district = this.district; if (!district) return;
      district.traffic.junctions = this.junctions[this.zone]; district.traffic.publish(space);
      district.crowd.onRoad().forEach((w, k) => space.add({ id: `walker:${k}`, x: w.x, z: w.z, yaw: 0, halfLength: .3, halfWidth: .3, category: 'person', speed: 0 }));
    }
  }
  private updateFortTraffic(delta: number) {
    this.fortTraffic.update(this.time, delta, [this.camera.position], this.street.roadWalkers, { space: this.traffic, view: this.viewCone(0) });
  }
  /** Move the current street's traffic, people and signals on by `delta` (the world clock is already advanced). */
  private advanceTraffic(delta: number) {
    if (this.zone !== this.trafficZone) { this.trafficZone = this.zone; this.prepareTraffic(); }
    if (this.zone === 0) { this.street.loopTraffic = this.fortTraffic.onLane(FORT_LOOP_LANE); this.street.update(this.time, this.reducedMotion, this.camera.position); this.updateFortTraffic(this.reducedMotion ? 0 : delta); }
    else this.district?.update(this.time, this.reducedMotion, this.camera.position, [], { space: this.traffic, view: this.viewCone(cityZones[this.zone].originX) });
    this.junctions[this.zone].sweep(this.time, id => this.traffic.get(id) !== undefined);
  }
  private get district() { return this.zone ? this.city.get(this.zone) : null; }
  private finishRide() {
    if (!streetStops[this.ride.destination ?? '']) return;
    playCue('arrive');
    this.syncZone(this.cab.pose.x);
    this.meter.tick(0, this.cab.chargeable, 0); this.meter.apply('complete'); this.ride = { ...this.ride, phase: 'arrived', progress: 1 }; this.readMeter(); this.options.onRide({ ...this.ride });
  }
  endRide() {
    if (this.ride.phase === 'idle') return;
    const destination = this.ride.destination && streetStops[this.ride.destination];
    const phase = this.ride.phase, wasPlaced = this.cab.active;
    this.meter.apply('cancel'); this.meter.apply('reset'); this.meter.apply('power-off'); this.showMeter();
    this.ride = idleRide(); this.transit.visible = false;
    if (phase === 'arrived' && destination) this.placeVisitor(destination.x, destination.z, destination.yaw);
    else if (phase !== 'hailing' && wasPlaced) { const ox = cityZones[zoneIndexAt(this.cab.pose.x)].originX; this.placeVisitor(ox + (this.cab.pose.x - ox < 0 ? -4.9 : 4.9), this.cab.pose.z, this.cab.pose.yaw); }
    this.cab.end(); this.junctions.forEach(j => j.forget('ride'));
    this.options.onRide({ ...this.ride }); this.releaseInput(); this.updateNear();
  }
  /** Put the cab model where the cab is; `turn` is this frame's heading change (wheels and lean). */
  private placeTransit(turn: number) {
    const p = this.cab.pose; this.transit.position.set(p.x, .02, p.z); this.transit.rotation.y = p.yaw;
    this.transit.rotation.z = this.reducedMotion || this.ride.phase !== 'riding' ? 0 : Math.sin(this.ride.elapsed * 9) * .0018 * Math.min(1, this.cab.speed) + THREE.MathUtils.clamp(turn * 8, -.3, .3) * .025;
  }
  private cabTravelled = 0;
  /** Copy the meter's readings into the ride status and onto the boarded cab's physical meter. */
  private readMeter() { const r = this.meter.reading; this.ride.fare = r.fare; this.ride.distance = r.distance; this.ride.waiting = r.waiting; this.ride.meter = r.state; this.showMeter(); }
  private showMeter() { for (const model of [this.taxi, this.auto]) (model.userData.meter as PhysicalMeter | undefined)?.show(model === (this.ride.kind === 'auto' ? this.auto : this.taxi) ? this.meter.reading : { ...this.meter.reading, state: 'OFF' }); }
  private updateRide(delta: number) {
    const before = this.cab.pose.yaw, zone = zoneIndexAt(this.cab.active ? this.cab.pose.x : this.visitor.position.x), ox = cityZones[zone].originX;
    if (zone !== this.zone) return;
    const next = this.cab.nextLeg, nextReady = !next || this.city.isReady(zoneIndexAt(next.x));
    if (!nextReady) this.city.prepare(zoneIndexAt(next!.x));
    const cruise = onAvenue(zone, this.cab.pose.z) ? AVENUE_PACE : 1;
    const was = this.cab.driven, event = this.cab.step(delta, { space: this.traffic, originX: ox, time: this.time, junctions: this.junctions[zone], view: this.viewCone(ox), cruise, nextReady });
    if (event === 'dispatched') this.transit.visible = true;
    if (event === 'cut') {
      // Over the seam: the next district's copy of the avenue looks the same. Only a vehicle on the cab's own spot makes way.
      this.syncZone(this.cab.pose.x);
      const nx = cityZones[this.zone].originX, path = this.cab.path, ahead = [0, 4].map(d => { const q = path.at(d); return { x: q.x - nx, z: q.z }; });
      this.trafficAt(this.zone)?.clearAround(ahead, 2.4, true);
    }
    const turn = Math.atan2(Math.sin(this.cab.pose.yaw - before), Math.cos(this.cab.pose.yaw - before));
    this.cabTravelled += Math.max(0, this.cab.driven - was) + (this.ride.phase === 'hailing' ? this.cab.speed * delta : 0);
    this.placeTransit(turn); animateTransit(this.ride.kind === 'taxi' ? this.taxi : this.auto, this.cabTravelled, turn * 8);
    if (this.ride.phase === 'riding') {
      this.ride.elapsed += delta; this.street.updateDrivers(this.reducedMotion ? 0 : delta, turn * 8);
      // Waiting is not charged while the road ahead is still being built (the next district not ready).
      this.meter.tick(delta, this.cab.chargeable, this.cab.speed, !nextReady); this.readMeter();
      this.ride.progress = this.cab.tripLength ? Math.min(1, this.cab.chargeable / this.cab.tripLength) : 1;
    }
    if (event === 'pulled-up') {
      this.ride = { ...this.ride, phase: 'boarding' }; this.readMeter(); this.options.onRide({ ...this.ride });
      if (this.queuedDestination) { const id = this.queuedDestination; this.queuedDestination = null; this.rideTo(id); }
    }
    if (event === 'arrived') this.finishRide();
  }
  private resize = () => {
    const w = Math.max(this.container.clientWidth, 1), h = Math.max(this.container.clientHeight, 1); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.maxPixelRatio)*this.quality.scale); this.renderer.setSize(w, h, false);this.rendering?.resize(w,h);this.pausedFrameDirty=true;
  };
  private releaseInput = () => { this.keys.clear(); this.touchKeys.clear(); this.dragging = null; };
  private unlock() { if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock(); }
  private lockChanged = () => { if (!document.pointerLockElement) this.releaseInput(); };
  private visibilityChanged = () => { this.audio?.setActive(this.soundEnabled&&!document.hidden&&!this.paused&&this.mode==='world'); this.releaseInput(); this.lastTime = 0; this.accumulator = 0; if (!document.hidden) { this.environment.update(performance.now(), true); this.pausedFrameDirty = true; } };
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
    this.unlock(); if (this.nearest.startsWith('hail-') || this.nearest.startsWith('flag-')) this.options.onHail(this.nearest.endsWith('taxi') ? 'taxi' : 'auto'); else this.options.onSelect(this.nearest);
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
  private warm(root: THREE.Object3D): Set<THREE.Material> {
    if (this.disposed) return new Set();
    const group = new THREE.Group(); root.traverse(o => { if ((o as THREE.Mesh).isMesh) { const c = o.clone(false); c.visible = true; c.matrixWorld.copy(o.matrixWorld); group.add(c); } });
    // compile() only queues the programs (the driver links them in parallel where KHR_parallel_shader_compile exists);
    // compileAsync's readiness polling throws if a material is disposed meanwhile, as retired stand-in figures are, so `shadersReady` polls instead.
    try { return this.renderer.compile(group, this.camera, this.scene); } catch { return new Set(); /* Compiled on first draw instead. */ } finally { group.clear(); }
  }
  /** Materials of the district just built whose programs the driver may still be linking. */
  private compiling = new Set<THREE.Material>();
  private linkStarted = 0; private linkPrograms = 0;
  /** The last directory jump's shader wait, for `?bench`. */
  lastArrival: ArrivalShaders | null = null;
  /** True once the driver has linked every program `warm` queued for the new district, so its first frame does not stall on them. */
  private shadersReady() {
    if (!this.renderer.extensions.has('KHR_parallel_shader_compile')) this.compiling.clear();
    for (const material of this.compiling) {
      const program = (this.renderer.properties.get(material) as { currentProgram?: { isReady(): boolean } }).currentProgram;
      if (!program || program.isReady()) this.compiling.delete(material);
    }
    return this.compiling.size === 0;
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
    if (this.jumpQueued && this.grounded()) { v.velocity.y = 5.4; v.wakeUp(); this.airborne = true; if (this.soundEnabled) this.audio?.jump(); }
    this.jumpQueued = false;
    this.physics.step(1 / 60);
    if (this.airborne && v.position.y <= FLOOR_Y + .005 && v.velocity.y <= 0 && this.soundEnabled) this.audio?.land(-v.velocity.y);
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
    // A cab offered for waving down stays offered until updatePassing withdraws it.
    if (next !== this.nearest && !(next === null && this.nearest?.startsWith('flag-'))) { this.nearest = next; this.options.onNear(next, target?.label); }
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
  /** What the soundscape needs this frame: where the visitor is, how they move, the Mumbai hour and the traffic around. */
  private soundFrame() {
    const zone = cityZones[this.zone], ox = zone.originX, riding = this.ride.phase !== 'idle' && this.ride.phase !== 'hailing';
    const p = this.camera.position, lx = p.x - ox, s = this.environment.sample, [h, m] = s.time.split(':').map(Number);
    const rooms = this.zone === 0 ? [this.street.shelteredBounds] : this.district?.kit.rooms ?? [];
    const probe = new THREE.Vector3(this.zone === 0 ? p.x : lx, 1, p.z), indoors = !riding && rooms.some(b => b.containsPoint(probe));
    const surface: Surface = indoors ? 'tile' : zone.id === 'juhu' && lx < -7.7 ? 'sand' : onCarriageway(lx, p.z) ? 'asphalt' : 'stone';
    // Nearest moving vehicle, in the listener's right/ahead frame (yaw 0 looks along −Z).
    const yaw = riding ? this.transit.rotation.y + this.rideYaw : this.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let nearest: { right: number; ahead: number; speed: number; kind: string } | null = null, best = Infinity, around = 0;
    for (const e of this.traffic.entries) {
      if (e.category !== 'vehicle') continue;
      const dx = e.x - lx, dz = e.z - p.z, d = Math.hypot(dx, dz); if (d < 45) around++;
      if (e.speed > .5 && d < best) { best = d; nearest = { right: dx * -fz + dz * fx, ahead: dx * fx + dz * fz, speed: e.speed, kind: e.id }; }
    }
    return { district: zone.id, hour: h + m / 60, altitude: s.altitude, riding, rideKind: this.ride.kind === 'auto' ? 'auto' as const : 'taxi' as const, cabSpeed: riding ? this.cab.speed : 0,
      walkSpeed: Math.hypot(this.visitor.velocity.x, this.visitor.velocity.z), grounded: !this.airborne, surface, indoors, nearest, traffic: Math.min(1, around / 8) };
  }
  private frame = (timestamp: number) => {
    if (this.disposed) return; this.frameId = requestAnimationFrame(this.frame);if(this.inspectionFrozen)return;
    const elapsed = this.fixedStep || (this.lastTime ? (timestamp - this.lastTime) / 1000 : 0); const delta = Math.min(elapsed, .08); this.lastTime = timestamp;
    if (document.hidden || this.mode !== 'world') return;
    if (this.environment.update()) this.pausedFrameDirty = true;
    // A quarter of a typical frame where frames are slow everywhere (software rendering), else 6 ms. The typical frame
    // leaves out frames that built: one long slice must not widen the next budget into another long frame.
    const tickStart = performance.now(); this.city.tick(Math.max(DISTRICT_SLICE_MS, this.typicalFrameMs * .25)); this.stepStreetAvenue(DISTRICT_SLICE_MS * .5); const tickMs = performance.now() - tickStart;
    if (elapsed > 0 && tickMs < 1 && this.builtLastFrame === false) this.typicalFrameMs += (Math.min(elapsed * 1000, 4000) - this.typicalFrameMs) * .1;
    this.builtLastFrame = tickMs >= 1;
    if (this.arrivingAt && this.city.isReady(zoneIndexAt(streetStops[this.arrivingAt].x)) && (this.shadersReady() || timestamp - this.arrivalStarted > ARRIVAL_SHADER_WAIT_MS)) { this.lastArrival = { parallel: this.renderer.extensions.has('KHR_parallel_shader_compile'), newPrograms: this.linkPrograms, linkWaitMs: performance.now() - this.linkStarted, capped: this.compiling.size > 0 }; this.land(this.arrivingAt); this.pausedFrameDirty = true; }
    if (this.paused && !this.pausedFrameDirty) return;
    const forceRender=this.pausedFrameDirty;this.pausedFrameDirty = false;
    let simulatedWalkingMs=0;
    try {
      // On a ride, world time catches up as walking does (at most 0.25 s a frame) in steps of at most 0.08 s, so a
      // slow device does not make the cab crawl; a stall still never jumps anything.
      const steps = this.ride.phase === 'idle' || this.paused ? 1 : Math.max(1, Math.ceil(walkingSimulationDelta(elapsed) / .08 - 1e-9)), step = steps > 1 ? walkingSimulationDelta(elapsed) / steps : delta;
      if (!this.paused) {
        for (let k = 1; k < steps && this.ride.phase !== 'idle'; k++) { this.time += step; this.prepareTraffic(); this.updateRide(step); this.syncZone(this.ride.phase === 'hailing' ? this.visitor.position.x : this.transit.position.x); this.advanceTraffic(step); }
        this.time += step;
        this.prepareTraffic();
        if (this.ride.phase !== 'idle') this.updateRide(step);
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
          this.updateNearIfMoved(); this.updatePassing();
          this.crossSeam();
        }
      }
      this.syncZone(this.ride.phase === 'idle' || this.ride.phase === 'hailing' ? this.visitor.position.x : this.transit.position.x);
      this.updateCamera(); this.manageNeighbours(); this.street.nearDetail=this.ride.phase==='idle'||this.ride.phase==='hailing';
      this.marker.visible = !!this.nearest && this.ride.phase === 'idle' && !this.tween; if (this.marker.visible) { this.marker.position.copy(this.markerBase); if (!this.reducedMotion) { this.marker.position.y += Math.sin(this.time * 3) * .025; this.marker.rotation.y = this.time * 1.4; } } 
      this.advanceTraffic(this.paused ? 0 : step);
      const needsRender=!this.reducedMotion||forceRender||this.camera.position.distanceToSquared(this.lastRenderPosition)>1e-8||this.camera.quaternion.angleTo(this.lastRenderRotation)>.0001||(this.renderer.shadowMap.enabled&&this.renderer.shadowMap.needsUpdate);
      if(needsRender&&!this.paused&&!this.reviewQuality&&this.quality.sample(elapsed)&&!this.applyLowTier())this.resize();
      if(!this.reducedMotion&&!this.paused&&this.time-this.lastShadow>.2&&this.renderer.shadowMap.enabled){this.renderer.shadowMap.needsUpdate=true;this.lastShadow=this.time;}
      if(this.audio&&this.soundEnabled)this.audio.update(this.soundFrame());
      if(needsRender){this.renderer.info.reset();this.profiler?.beforeRender();const renderStart=performance.now();this.rendering.render(delta);this.frameObserver?.({tickMs,renderMs:performance.now()-renderStart,frameMs:elapsed*1000,draws:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,textures:this.renderer.info.memory.textures,programs:this.renderer.info.programs?.length??0,scale:this.quality.scale,low:this.quality.low});this.profiler?.afterRender({frameMs:elapsed*1000,renderCpuMs:performance.now()-renderStart,draws:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,textures:this.renderer.info.memory.textures,geometries:this.renderer.info.memory.geometries,programs:this.renderer.info.programs?.length??0,scale:this.quality.scale,preset:this.renderPreset,phase:this.ride.phase,worldX:this.visitor.position.x,worldZ:this.visitor.position.z,walkingSimulatedMs:simulatedWalkingMs,shadowRefreshed:this.rendering.frameCost.shadowDraws>0,shadowDraws:this.rendering.frameCost.shadowDraws,shadowTriangles:this.rendering.frameCost.shadowTriangles,shadowDrawCpuMs:this.rendering.frameCost.shadowDrawCpuMs,mainAndOtherDraws:this.rendering.frameCost.mainAndOtherDraws,mainAndOtherTriangles:this.rendering.frameCost.mainAndOtherTriangles});this.lastRenderPosition.copy(this.camera.position);this.lastRenderRotation.copy(this.camera.quaternion);this.debugFrames++;}
      if (timestamp - this.lastHud > 125) {
        if (this.benchmarkEnabled){this.renderer.domElement.dataset.benchmarkReady='true';this.renderer.domElement.dataset.ridePhase=this.ride.phase;this.renderer.domElement.dataset.renderMode=this.reducedMotion?'on-demand':'continuous';}
        if (this.debug) { const canvas = this.renderer.domElement; canvas.dataset.worldX = this.visitor.position.x.toFixed(3); canvas.dataset.cast = this.street.castStatus; canvas.dataset.worldZ = this.visitor.position.z.toFixed(3); canvas.dataset.eyeHeight = this.camera.position.y.toFixed(3); canvas.dataset.lookYaw = this.yaw.toFixed(3); canvas.dataset.renderScale=this.quality.scale.toFixed(2); canvas.dataset.quality=this.quality.low?'low':'high'; canvas.dataset.renderMode=this.reducedMotion?'on-demand':'continuous';canvas.dataset.navigation=this.street.navigationStatus;canvas.dataset.surfaceMaps=this.street.surfaceStatus;canvas.dataset.streetAssets=this.street.assetStatus;canvas.dataset.characterStatus=this.street.characterStatus;canvas.dataset.npcUpdateMs=this.street.npcUpdateMs.toFixed(3);canvas.dataset.trafficUpdateMs=this.street.trafficUpdateMs.toFixed(3);canvas.dataset.renderPreset=this.renderPreset;canvas.dataset.dayPhase=this.environment.sample.phase;canvas.dataset.sunAltitude=this.environment.sample.altitude.toFixed(2);canvas.dataset.lamps=this.environment.look.lamps.toFixed(2);canvas.dataset.istTime=this.environment.sample.time; canvas.dataset.cameraMode = this.ride.phase === 'idle' || this.ride.phase === 'hailing' ? 'first-person' : 'passenger'; }
        this.options.onSpeed(this.ride.phase === 'riding' ? this.cab.speed * 3.6 : Math.hypot(this.visitor.velocity.x, this.visitor.velocity.z) * 3.6);
        this.options.onPosition(this.ride.phase === 'idle' || this.ride.phase === 'hailing' ? { x: this.visitor.position.x, z: this.visitor.position.z, yaw: this.yaw } : { x: this.transit.position.x, z: this.transit.position.z, yaw: this.transit.rotation.y + this.rideYaw });
        if (this.ride.phase !== 'idle') this.options.onRide({ ...this.ride }); this.lastHud = timestamp;
      }
      if (this.trafficOverlay && this.trafficZone >= 0) this.trafficLine = this.trafficOverlay.update(this.traffic, cityZones[this.trafficZone].originX);
      if (this.debug) { this.debugTime += elapsed; if (this.debugTime > .75) { const info = this.renderer.info; this.debug.textContent = `${this.debugFrames?`${(this.debugFrames / this.debugTime).toFixed(1)} fps`:'idle'} · ${info.render.calls} draws · ${info.render.triangles} triangles · ${info.memory.textures} textures · ${info.programs?.length??0} shaders · ${Math.round(((performance as Performance & {memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize??0)/1048576)} MB JS · scale ${this.quality.scale.toFixed(2)} · eye ${this.camera.position.y.toFixed(2)}m\n${this.environment.describe()}${this.audio?` · audio ${this.audio.stats().state}, ${this.audio.stats().voices} voices`:''}${this.trafficLine ? `\n${this.trafficLine}` : ''}`; this.debugTime = 0; this.debugFrames = 0; } }
    } catch (error) { this.dispose(); this.options.onError(error); }
  };
  dispose() {
    if (this.disposed) return; this.disposed = true; cancelAnimationFrame(this.frameId); this.audio?.dispose(); this.resizeObserver.disconnect(); this.releaseInput(); this.unlock();
    window.removeEventListener('street-review-view',this.reviewView);window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.releaseInput);
    document.removeEventListener('visibilitychange', this.visibilityChanged); document.removeEventListener('pointerlockchange', this.lockChanged);
    const canvas = this.renderer.domElement; canvas.removeEventListener('pointerdown', this.pointerDown); window.removeEventListener('pointermove', this.pointerMove); window.removeEventListener('pointerup', this.pointerUp); canvas.removeEventListener('pointercancel', this.pointerUp); canvas.removeEventListener('webglcontextlost', this.contextLost);
    setFriendSource(null);void this.friendLibrary?.dispose();window.removeEventListener('street-benchmark',this.benchmarkCommand);this.profiler?.dispose();this.city.dispose();districtCast()?.dispose();setDistrictCast(null);this.street.dispose();this.fortTraffic.group.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;for(const g of new Set([m.geometry,...((m.userData.lodGeometries??[]) as THREE.BufferGeometry[])]))g.dispose();});this.rendering.dispose();this.environmentTarget.dispose();
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), skeletons = new Set<THREE.Skeleton>();
    this.scene.traverse(object => { const mesh = object as THREE.SkinnedMesh; if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton); if (mesh.geometry) geometries.add(mesh.geometry); for(const g of (mesh.userData.lodGeometries??[]) as THREE.BufferGeometry[]) geometries.add(g); if (mesh.material) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) { materials.add(m); for(const key of ['map','bumpMap','roughnessMap','normalMap'] as const)if((m as THREE.MeshStandardMaterial)[key])textures.add((m as THREE.MeshStandardMaterial)[key]!); } });
    skeletons.forEach(s => s.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); this.renderer.dispose(); canvas.remove(); this.debug?.remove(); this.trafficOverlay?.dispose();
  }
}
