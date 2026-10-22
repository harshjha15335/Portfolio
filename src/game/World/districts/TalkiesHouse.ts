import * as THREE from 'three';
import { districtCast, type DistrictCast } from './DistrictCast';
import type { Outfit } from './CityFolk';
import { filmSource } from '../../../data/film';
import { bakeFigure, gripWith, turnBone } from './bakePose';
import { OVATION_SECONDS, ovationContext, playApplause } from '../../../core/audio/applause';

/**
 * The Film City Talkies on show night: a full house and the film on the big screen.
 *
 * The audience is the licensed Rocketbox cast baked once into their seated pose and drawn as one
 * InstancedMesh per cast member, so a full auditorium costs a handful of draws and no bone texture.
 * Everything here is in district space (hall x 15–35, z −8–14; screen on the x ≈ 34.6 wall).
 */
/** Seat rows (x) and seat positions (z) laid out by `talkiesInterior`. */
export const TALKIES_SEATS = Array.from({ length: 10 }, (_, r) => 19 + r * 1.1).flatMap(x =>
  [[-6.6, 7], [5.2, 7]].flatMap(([z0, n]) => Array.from({ length: n }, (_, i) => ({ x, z: z0 + i * .62 }))));
const HALL = { minX: 15.2, maxX: 35, minZ: -8, maxZ: 14 };
const SCREEN = { x: 34.55, y: 5, z: 3, w: 13, h: 13 * 544 / 1280 };
const SEAT = .515;
/** Lean applied while baking (radians about the body's side axis): back for the spine, up for the head. */
const LEAN = [{ match: /_Spine$/, angle: -.16 }, { match: /_Spine1$/, angle: -.16 }, { match: /_Head$/, angle: -.22 }];
const OUTFITS: Outfit[] = ['shirt', 'sari', 'office', 'kurta', 'salwar', 'school', 'worker', 'shirt', 'office', 'sari', 'jogger'];

/** Set by the engine: the screen is silent unless city sound is on, stops under a modal and never autoplays under reduced motion. */
const state = { sound: false, active: true, reduced: false, screens: new Set<TalkiesScreen>() };
export function setTalkiesSound(on: boolean) { state.sound = on; state.screens.forEach(s => s.sync()); }
export function setTalkiesActive(active: boolean) { state.active = active; state.screens.forEach(s => s.sync()); }
export function setTalkiesReduced(reduced: boolean) { state.reduced = reduced; state.screens.forEach(s => s.sync()); }

/** The visitor's ticket: row E, seat 7, on the aisle. The rest of the house is full. */
/** Interaction ids: sit in the visitor's seat, and stand up from it. */
export const TALKIES_SEAT_ID = 'talkies-seat', TALKIES_STAND_ID = 'talkies-stand';
export const VISITOR_SEAT = { x: 24.5, z: -2.88, label: 'Sit in your seat · row E, seat 7' };
/** Eye height of a seated visitor (seat cushion at 0.515 m). */
export const SEATED_EYE = 1.18;
/** Development and tests: jump every playing screen to the last moments of the film, to see the ovation. */
export function skipToFilmEnd() { state.screens.forEach(s => s.skipToEnd()); }
export const insideHall = (x: number, z: number) => x > HALL.minX && x < HALL.maxX && z > HALL.minZ && z < HALL.maxZ;

/** Bake one seated cast member: CPU-skin the sit pose of the given LOD into a static, unskinned geometry in person space. */
export function bakeSeated(cast: DistrictCast, outfit: Outfit, key: string, level: 1 | 2 = 1) {
  const figure = cast.figure(outfit, 'sit', key);
  // The Sit clip leans forward over the knees; sit this audience back and lift their heads towards the screen while baking.
  const geometry = bakeFigure(cast, figure, level, new THREE.Matrix4().makeTranslation(0, SEAT + .08 - figure.pelvisHeight, 0), (bones, toRig) => {
    const right = new THREE.Vector3(1, 0, 0);
    // Angles are about the rig's side axis, which points the other way in person space.
    for (const lean of LEAN) { const bone = bones(lean.match); if (bone) turnBone(bone, toRig, right, -lean.angle); }
  });
  const material = figure.member.material, id = figure.member.id;
  figure.dispose();
  return { geometry, material, id };
}

/** Bake the same person standing and clapping: hands apart (`open`) or meeting in front of the chest. */
export function bakeClapping(cast: DistrictCast, outfit: Outfit, key: string, open: boolean) {
  const figure = cast.figure(outfit, 'idle', key), h = figure.member.height * figure.scale, x = open ? .12 : .025;
  const geometry = bakeFigure(cast, figure, 2, new THREE.Matrix4(), (bones, toRig) =>
    gripWith(bones, toRig, [new THREE.Vector3(-x, h * .73, -.27), new THREE.Vector3(x, h * .73, -.27)], open ? .2 : .1, .1));
  figure.dispose();
  return geometry;
}

/** Seconds from the end of the film until everyone is up (people rise at different moments), and to sit down again. */
const RISE_S = 1.6, SIT_S = 1.2;
/** Claps a second, per person (each cast member claps at their own phase). */
const CLAP_HZ = 3.6;

/** A seated, watching crowd in every seat but the visitor's, one InstancedMesh per cast member; on cue they stand and clap. */
export class TalkiesAudience {
  readonly group = new THREE.Group();
  private built = false;
  private crowd: Array<{ seated: THREE.InstancedMesh; standing: THREE.InstancedMesh; claps: THREE.BufferGeometry[]; rise: number[]; phase: number }> = [];
  private ovationAt = -Infinity;
  constructor(private taken: Array<{ x: number; z: number }> = []) { this.group.name = 'talkies:audience'; this.group.visible = false; }
  /** People seated now (standing ones are counted by `standing`). */
  get count() { let n = 0; this.crowd.forEach(c => { n += c.seated.count; }); return n; }
  get standing() { let n = 0; this.crowd.forEach(c => { n += c.standing.count; }); return n; }
  /** Build if the cast is ready; returns true once there is an audience. */
  build(cast = districtCast()) {
    if (this.built || !cast) return this.built;
    const seats = TALKIES_SEATS.filter(s => ![VISITOR_SEAT, ...this.taken].some(t => Math.abs(t.x - s.x) < .2 && Math.abs(t.z - s.z) < .2));
    // One baked body per (member, outfit-role); people are dealt round-robin so neighbours differ.
    const bodies = new Map<string, ReturnType<typeof bakeSeated> & { claps: THREE.BufferGeometry[] }>();
    for (const [i, outfit] of OUTFITS.entries()) {
      const body = bakeSeated(cast, outfit, `talkies:${i}`, 2);
      if (bodies.has(body.id)) { body.geometry.dispose(); continue; }
      bodies.set(body.id, { ...body, claps: [bakeClapping(cast, outfit, `talkies:${i}`, true), bakeClapping(cast, outfit, `talkies:${i}`, false)] });
    }
    const list = [...bodies.values()], per = list.map(() => [] as Array<{ sit: THREE.Matrix4; stand: THREE.Matrix4; rise: number }>);
    seats.forEach((s, i) => {
      const h = Math.sin(i * 91.7) * .5 + .5, k = (i * 7 + (i / 7 | 0)) % list.length;
      const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2 + (h - .5) * .24), scale = .95 + h * .08, size = new THREE.Vector3(scale, scale, scale);
      // Standing, a person steps up off the seat towards the row in front (+X, the screen side).
      per[k].push({ sit: new THREE.Matrix4().compose(new THREE.Vector3(s.x, .03, s.z), turn, size), stand: new THREE.Matrix4().compose(new THREE.Vector3(s.x + .2, .03, s.z), turn, size), rise: (Math.sin(i * 12.9898) * .5 + .5) * RISE_S });
    });
    list.forEach((body, k) => {
      if (!per[k].length) { body.geometry.dispose(); body.claps.forEach(g => g.dispose()); return; }
      // Standing order: first up first in the standing mesh; the seated mesh lists the same people last-up first,
      // so dropping its count removes exactly those who have stood.
      const people = per[k].sort((a, b) => a.rise - b.rise), n = people.length;
      const seated = new THREE.InstancedMesh(body.geometry, body.material, n), standing = new THREE.InstancedMesh(body.claps[0], body.material, n);
      people.forEach((p, j) => { standing.setMatrixAt(j, p.stand); seated.setMatrixAt(n - 1 - j, p.sit); });
      for (const mesh of [seated, standing]) {
        mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.castShadow = false; mesh.receiveShadow = false;
        // Flagged like cast figures so the district's GPU sweep leaves the shared cast material alone; `dispose` frees the geometry.
        mesh.userData.districtCast = true; this.group.add(mesh);
      }
      seated.name = `talkies:audience:${body.id}`; standing.name = `talkies:ovation:${body.id}`; standing.count = 0;
      this.crowd.push({ seated, standing, claps: body.claps, rise: people.map(p => p.rise), phase: k * .37 });
    });
    this.built = true; return true;
  }
  /** The film has ended: everyone stands and claps for OVATION_SECONDS, then sits down for the next screening. */
  ovation(now: number) { this.ovationAt = now; }
  /** Shown only while the visitor is inside the auditorium; the hall walls hide it from everywhere else. `now` in seconds. */
  update(view: THREE.Vector3, now = 0) {
    if (!this.built) this.build(); this.group.visible = this.built && insideHall(view.x, view.z);
    if (!this.built) return;
    const t = now - this.ovationAt, sitting = t - OVATION_SECONDS;
    // Up within RISE_S of the end; the last up are the first down over SIT_S once the applause dies away.
    const upTo = t < 0 || sitting > SIT_S ? -1 : sitting > 0 ? RISE_S * (1 - sitting / SIT_S) : t;
    for (const c of this.crowd) {
      let k = 0; while (k < c.rise.length && c.rise[k] <= upTo) k++;
      c.standing.count = k; c.seated.count = c.rise.length - k;
      if (k) c.standing.geometry = c.claps[Math.floor(t * CLAP_HZ + c.phase) % 2];
    }
  }
  dispose() { for (const c of this.crowd) { c.seated.geometry.dispose(); c.claps.forEach(g => g.dispose()); } this.crowd = []; this.group.clear(); this.group.removeFromParent(); }
}

/** The film on the big screen: loaded when the visitor walks into the Talkies, played while they are in the hall. */
export class TalkiesScreen {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private video: HTMLVideoElement | null = null; private texture: THREE.VideoTexture | null = null; private inside = false;
  /** When the current ovation started (seconds, performance clock), or null while the film runs. */
  private ovationStart: number | null = null; private stopApplause: (() => void) | null = null;
  /** Called when a screening ends, with the time in seconds: the audience rises (see TalkiesAudience.ovation). */
  onEnded: ((now: number) => void) | null = null;
  constructor() {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
    this.mesh.position.set(SCREEN.x, SCREEN.y, SCREEN.z); this.mesh.rotation.y = -Math.PI / 2; this.mesh.visible = false; this.mesh.name = 'talkies:screen';
    state.screens.add(this);
  }
  get playing() { return Boolean(this.video && !this.video.paused); }
  private ensureVideo() {
    if (this.video || typeof document === 'undefined') return;
    const video = document.createElement('video'); video.src = filmSource(video); video.loop = false; video.playsInline = true; video.preload = 'auto'; video.crossOrigin = 'anonymous';
    video.muted = true; this.video = video;
    const texture = new THREE.VideoTexture(video); texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
    this.texture = texture; this.mesh.material.map = texture; this.mesh.material.needsUpdate = true;
    video.addEventListener('playing', () => { this.mesh.visible = true; });
    // Every screening ends in a standing ovation; the next one starts after the applause and an intermission beat.
    video.addEventListener('ended', () => {
      const now = performance.now() / 1000; this.ovationStart = now; this.onEnded?.(now);
      if (state.sound && this.inside) { const context = ovationContext(); if (context) this.stopApplause = playApplause(context, .7); }
    });
  }
  /** Seconds the house applauds before the lights go down again (applause plus sitting down). */
  static readonly INTERVAL = OVATION_SECONDS + 3;
  get applauding() { return this.ovationStart !== null; }
  skipToEnd() { const v = this.video; if (v && Number.isFinite(v.duration)) v.currentTime = Math.max(0, v.duration - .4); }
  /** Start, stop or mute to match where the visitor is, the sound setting and whether the world is paused. */
  sync() {
    const want = this.inside && state.active && !state.reduced;
    if (!want) { if (this.video && !this.video.paused) this.video.pause(); this.stopApplause?.(); this.stopApplause = null; if (!this.inside) this.mesh.visible = false; return; }
    if (this.ovationStart !== null) return;
    this.ensureVideo(); const video = this.video; if (!video) return;
    video.muted = !state.sound; video.volume = .85;
    if (video.paused) void video.play().catch(() => { video.muted = true; void video.play().catch(() => {}); });
  }
  /** `view` in district space. The video is fetched as the visitor enters the lobby, so it is ready by the hall. */
  update(view: THREE.Vector3) {
    const inLobby = view.x > 7.5 && view.x < 15.2 && view.z > HALL.minZ && view.z < HALL.maxZ;
    if (inLobby) this.ensureVideo();
    const inside = insideHall(view.x, view.z); if (inside !== this.inside) { this.inside = inside; this.sync(); }
    // After the ovation, the film starts again from the top.
    if (this.ovationStart !== null && performance.now() / 1000 - this.ovationStart > TalkiesScreen.INTERVAL) {
      this.ovationStart = null; this.stopApplause = null; if (this.video) this.video.currentTime = 0; this.sync();
    }
  }
  dispose() {
    state.screens.delete(this); this.stopApplause?.();
    if (this.video) { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); this.video = null; }
    this.texture?.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.removeFromParent();
  }
}
