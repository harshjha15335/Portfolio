import * as THREE from 'three';
import type { AtmosphereUniforms, SkyUniforms } from '../game/World/StreetAtmosphere';
import { type ClockSample, type IndiaWorldClock } from '../game/World/time/IndiaWorldClock';
import { environmentLook, keyLightDirection, skyDirection, type EnvironmentLook, type Rgb } from '../game/World/time/environmentState';
import { setNightLevel } from '../game/World/time/nightLights';

/** Recompute the sun and the look this often (ms): the sun moves ≈0.25° a minute, so steps are invisible. */
const RECOMPUTE_MS = 5000;
/** Move the shadow-casting light (and so redraw its shadow map) at most this often, unless forced. */
const SHADOW_MOVE_MS = 60000;
/** Daylight bounce off the street (the authored golden-hour fill) and the night floodlight aimed up at the station front. */
const BOUNCE_DAY = new THREE.Vector3(14, 9, -52).normalize(), FLOOD = new THREE.Vector3(.25, -.32, -1).normalize();
/** Without directional shadows the sun is softened and the sky fill lifted (the shipped balance). */
const SHADOWLESS = { sun: .35, fill: 1.35, bounce: .7 };
/** The walkable street of a zone in its own frame, which the sun's shadow camera is fitted around. */
const ZONE_BOX = new THREE.Box3(new THREE.Vector3(-32, 0, -70), new THREE.Vector3(32, 30, 24));

export type EnvironmentRig = {
  scene: THREE.Scene; renderer: THREE.WebGLRenderer; sun: THREE.DirectionalLight; bounce: THREE.DirectionalLight; fill: THREE.HemisphereLight;
  sky: THREE.Mesh; atmosphere: AtmosphereUniforms;
};

/**
 * Drives every light, the sky, fog and exposure from the India world clock, so all nine districts show the same
 * real Mumbai moment. The light count never changes (sun, bounce, hemisphere), so time of day compiles no shaders.
 */
export class EnvironmentTime {
  sample: ClockSample; look: EnvironmentLook;
  private computedAt = -Infinity; private shadowAt = -Infinity; private originX = 0; private shadows = true;
  private lightDir = new THREE.Vector3(); private appliedDir = new THREE.Vector3(Infinity, 0, 0);
  constructor(readonly clock: IndiaWorldClock, private rig: EnvironmentRig) {
    this.sample = clock.sample(); this.look = environmentLook(this.sample.altitude, this.sample.morning);
  }
  /** Called every frame; does real work every few seconds. Returns true when the picture changed. */
  update(now = performance.now(), force = false) {
    if (!force && now - this.computedAt < RECOMPUTE_MS) return false;
    this.computedAt = now; this.sample = this.clock.sample(); this.look = environmentLook(this.sample.altitude, this.sample.morning);
    this.apply(force || now - this.shadowAt >= SHADOW_MOVE_MS, now); return true;
  }
  /** Re-fit to a zone (a district 600 m away) or a shadow setting change, keeping the same moment. */
  configure(originX: number, shadows: boolean) { this.originX = originX; this.shadows = shadows; this.apply(true, performance.now()); }
  private apply(moveLight: boolean, now: number) {
    const { scene, renderer, sun, bounce, fill, sky, atmosphere } = this.rig, look = this.look, s = this.sample;
    const rgb = (c: THREE.Color, v: Rgb) => c.setRGB(v[0], v[1], v[2], THREE.SRGBColorSpace);
    // Key light: the sun while it is up, else a dim moonlight; at the hand-over both are at zero.
    const up = s.altitude > -3, shadows = this.shadows;
    if (up) rgb(sun.color, look.sunColor); else sun.color.setRGB(.62, .7, .84, THREE.SRGBColorSpace);
    sun.intensity = (up ? look.sunIntensity : look.moonIntensity) * (shadows ? 1 : SHADOWLESS.sun);
    rgb(fill.color, look.hemiSky); rgb(fill.groundColor, look.hemiGround); fill.intensity = look.hemiIntensity * (shadows ? 1 : SHADOWLESS.fill);
    rgb(bounce.color, look.bounceColor); bounce.intensity = look.bounceIntensity * (shadows || look.flood > .5 ? 1 : SHADOWLESS.bounce);
    const fog = scene.fog as THREE.Fog; rgb(fog.color, look.fog); fog.near = look.fogNear; fog.far = look.fogFar;
    if (scene.background instanceof THREE.Color) rgb(scene.background, look.fog);
    renderer.toneMappingExposure = look.exposure; scene.environmentIntensity = look.environment;
    // Sky (raw display values, as its shader writes them) and the haze every street material blends toward the sun.
    const u = (sky.material as THREE.ShaderMaterial).userData.sky as SkyUniforms;
    u.uTop.value.setRGB(...look.skyTop); u.uMid.value.setRGB(...look.skyMid); u.uHorizon.value.setRGB(...look.skyHorizon); u.uCloud.value.setRGB(...look.cloud);
    u.uGlow.value = Math.max(0, Math.min(1, (s.altitude + 2) / 3)) * look.sunGlow; u.uStars.value = look.stars;
    atmosphere.uSunDir.value.set(...skyDirection(s.azimuth, s.altitude)); rgb(atmosphere.uSunHaze.value, look.haze);
    setNightLevel(look.lamps);
    // Bounce: the daylight fill from the street, swinging over to the floodlight as the lamps come on.
    const target = new THREE.Vector3(this.originX, 0, -26);
    bounce.position.copy(target).addScaledVector(new THREE.Vector3().copy(BOUNCE_DAY).lerp(FLOOD, look.flood).normalize(), 40); bounce.target.position.copy(target); bounce.target.updateMatrixWorld();
    // The shadow-casting light moves (and its shadow map is redrawn) at most once a minute.
    this.lightDir.set(...keyLightDirection(s));
    if (moveLight || this.lightDir.angleTo(this.appliedDir) > .35) { this.shadowAt = now; this.appliedDir.copy(this.lightDir); this.fitShadow(); }
  }
  /** Place the sun along its direction and size its shadow camera to the zone's street seen from the light. */
  private fitShadow() {
    const { sun, renderer } = this.rig, box = ZONE_BOX.clone().translate(new THREE.Vector3(this.originX, 0, 0)), centre = box.getCenter(new THREE.Vector3());
    centre.y = 0; sun.target.position.copy(centre); sun.position.copy(centre).addScaledVector(this.appliedDir, 90);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
    const view = new THREE.Matrix4().lookAt(sun.position, centre, new THREE.Vector3(0, 1, 0)).setPosition(sun.position).invert();
    const lo = new THREE.Vector3(Infinity, Infinity, Infinity), hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity), p = new THREE.Vector3();
    for (let i = 0; i < 8; i++) { p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(view); lo.min(p); hi.max(p); }
    const cam = sun.shadow.camera; cam.left = lo.x; cam.right = hi.x; cam.bottom = lo.y; cam.top = hi.y; cam.near = Math.max(.5, -hi.z - 2); cam.far = -lo.z + 2; cam.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
  }
  /** Developer HUD line: IST date and time, sun, phase and where the time came from. */
  describe() {
    const s = this.sample;
    return `IST ${s.date} ${s.time} · sun ${s.altitude.toFixed(1)}° alt ${s.azimuth.toFixed(0)}° az · ${s.phase} · lamps ${this.look.lamps.toFixed(2)} · clock ${s.source}${s.offsetMs ? ` (${(s.offsetMs / 1000).toFixed(0)} s)` : ''}`;
  }
}
