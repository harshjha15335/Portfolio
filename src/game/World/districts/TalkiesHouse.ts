import * as THREE from 'three';
import { districtCast, type DistrictCast } from './DistrictCast';
import type { Outfit } from './CityFolk';
import { trailerSource } from '../../../data/trailer';

/**
 * The Film City Talkies on show night: a full house and the trailer on the big screen.
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
const LEAN = [{ match: /Spine1?$/, angle: -.16 }, { match: /Head$/, angle: -.22 }];
const OUTFITS: Outfit[] = ['shirt', 'sari', 'office', 'kurta', 'salwar', 'school', 'worker', 'shirt', 'office', 'sari', 'jogger'];

/** Set by the engine: the screen is silent unless city sound is on, stops under a modal and never autoplays under reduced motion. */
const state = { sound: false, active: true, reduced: false, screens: new Set<TalkiesScreen>() };
export function setTalkiesSound(on: boolean) { state.sound = on; state.screens.forEach(s => s.sync()); }
export function setTalkiesActive(active: boolean) { state.active = active; state.screens.forEach(s => s.sync()); }
export function setTalkiesReduced(reduced: boolean) { state.reduced = reduced; state.screens.forEach(s => s.sync()); }

export const insideHall = (x: number, z: number) => x > HALL.minX && x < HALL.maxX && z > HALL.minZ && z < HALL.maxZ;

/** Bake one seated cast member: CPU-skin the sit pose of the given LOD into a static, unskinned geometry in person space. */
export function bakeSeated(cast: DistrictCast, outfit: Outfit, key: string, level: 1 | 2 = 1) {
  const figure = cast.figure(outfit, 'sit', key);
  cast.update(0);
  const mesh = figure.mesh, source = cast.variant(figure.member, cast.driverFor(figure.member, 'sit', key))[level];
  mesh.geometry = source;
  // The Sit clip leans forward over the knees; sit this audience back and lift their heads towards the screen while baking.
  const used = new Set<number>(); for (let i = 0; i < source.getAttribute('skinIndex').count; i++) for (let k = 0; k < 4; k++) used.add(source.getAttribute('skinIndex').getComponent(i, k));
  const restore: Array<[THREE.Bone, THREE.Quaternion]> = [];
  for (const b of used) {
    const bone = mesh.skeleton.bones[b], lean = LEAN.find(l => l.match.test(bone.name)); if (!lean) continue;
    let root: THREE.Object3D = bone; while (root.parent) root = root.parent;
    const axis = new THREE.Vector3().setFromMatrixColumn(root.matrixWorld, 0).normalize(), parent = new THREE.Quaternion();
    bone.parent?.getWorldQuaternion(parent); const world = bone.getWorldQuaternion(new THREE.Quaternion());
    restore.push([bone, bone.quaternion.clone()]);
    bone.quaternion.copy(parent.invert().multiply(new THREE.Quaternion().setFromAxisAngle(axis, lean.angle).multiply(world))); bone.updateMatrixWorld(true);
  }
  mesh.skeleton.update();
  const lift = new THREE.Matrix4().makeTranslation(0, SEAT + .08 - figure.pelvisHeight, 0).multiply(mesh.matrix);
  const pos = source.getAttribute('position'), nor = source.getAttribute('normal'), si = source.getAttribute('skinIndex'), sw = source.getAttribute('skinWeight');
  const out = new Float32Array(pos.count * 3), outN = new Float32Array(pos.count * 3), bones = mesh.skeleton.bones, inverses = mesh.skeleton.boneInverses;
  const m = new THREE.Matrix4(), sum = new THREE.Matrix4(), full = new THREE.Matrix4(), normal = new THREE.Matrix3(), v = new THREE.Vector3();
  const cache = new Map<number, THREE.Matrix4>(), boneMatrix = (b: number) => { let x = cache.get(b); if (!x) { x = new THREE.Matrix4().multiplyMatrices(bones[b].matrixWorld, inverses[b]); cache.set(b, x); } return x; };
  for (let i = 0; i < pos.count; i++) {
    sum.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w) { m.copy(boneMatrix(si.getComponent(i, k))); for (let e = 0; e < 16; e++) sum.elements[e] += m.elements[e] * w; } }
    full.multiplyMatrices(mesh.bindMatrixInverse, sum).multiply(mesh.bindMatrix).premultiply(lift);
    v.fromBufferAttribute(pos, i).applyMatrix4(full); out.set([v.x, v.y, v.z], i * 3);
    if (nor) { v.fromBufferAttribute(nor, i).applyMatrix3(normal.getNormalMatrix(full)).normalize(); outN.set([v.x, v.y, v.z], i * 3); }
  }
  for (const [bone, q] of restore) { bone.quaternion.copy(q); bone.updateMatrixWorld(true); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(out, 3));
  if (nor) geometry.setAttribute('normal', new THREE.BufferAttribute(outN, 3));
  for (const name of ['uv', 'color']) { const a = source.getAttribute(name); if (a) geometry.setAttribute(name, a.clone()); }
  geometry.setIndex(source.index ? source.index.clone() : null); geometry.computeBoundingSphere();
  const material = figure.member.material, id = figure.member.id;
  figure.dispose();
  return { geometry, material, id };
}

/** A seated, watching crowd in every free seat, one InstancedMesh per cast member. Built once the shared cast has loaded. */
export class TalkiesAudience {
  readonly group = new THREE.Group();
  private built = false;
  constructor(private taken: Array<{ x: number; z: number }> = []) { this.group.name = 'talkies:audience'; this.group.visible = false; }
  get count() { let n = 0; this.group.children.forEach(c => { n += (c as THREE.InstancedMesh).count; }); return n; }
  /** Build if the cast is ready; returns true once there is an audience. */
  build(cast = districtCast()) {
    if (this.built || !cast) return this.built;
    const seats = TALKIES_SEATS.filter(s => !this.taken.some(t => Math.abs(t.x - s.x) < .2 && Math.abs(t.z - s.z) < .2));
    // One baked body per (member, outfit-role); people are dealt round-robin so neighbours differ.
    const bodies = new Map<string, ReturnType<typeof bakeSeated>>();
    for (const [i, outfit] of OUTFITS.entries()) { const body = bakeSeated(cast, outfit, `talkies:${i}`, 2); if (!bodies.has(body.id)) bodies.set(body.id, body); else body.geometry.dispose(); }
    const list = [...bodies.values()], per = list.map(() => [] as THREE.Matrix4[]);
    seats.forEach((s, i) => {
      const h = Math.sin(i * 91.7) * .5 + .5, k = (i * 7 + (i / 7 | 0)) % list.length;
      const yaw = -Math.PI / 2 + (h - .5) * .24, scale = .95 + h * .08;
      per[k].push(new THREE.Matrix4().compose(new THREE.Vector3(s.x, .03, s.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale)));
    });
    list.forEach((body, k) => {
      if (!per[k].length) { body.geometry.dispose(); return; }
      const mesh = new THREE.InstancedMesh(body.geometry, body.material, per[k].length);
      per[k].forEach((m, j) => mesh.setMatrixAt(j, m)); mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
      mesh.name = `talkies:audience:${body.id}`; mesh.castShadow = false; mesh.receiveShadow = false;
      // Flagged like cast figures so the district's GPU sweep leaves the shared cast material alone; `dispose` frees the geometry.
      mesh.userData.districtCast = true; this.group.add(mesh);
    });
    this.built = true; return true;
  }
  /** Shown only while the visitor is inside the auditorium; the hall walls hide it from everywhere else. */
  update(view: THREE.Vector3) { if (!this.built) this.build(); this.group.visible = this.built && insideHall(view.x, view.z); }
  dispose() { this.group.children.forEach(c => (c as THREE.InstancedMesh).geometry.dispose()); this.group.clear(); this.group.removeFromParent(); }
}

/** The trailer on the big screen: loaded when the visitor walks into the Talkies, played while they are in the hall. */
export class TalkiesScreen {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private video: HTMLVideoElement | null = null; private texture: THREE.VideoTexture | null = null; private inside = false;
  constructor() {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
    this.mesh.position.set(SCREEN.x, SCREEN.y, SCREEN.z); this.mesh.rotation.y = -Math.PI / 2; this.mesh.visible = false; this.mesh.name = 'talkies:screen';
    state.screens.add(this);
  }
  get playing() { return Boolean(this.video && !this.video.paused); }
  private ensureVideo() {
    if (this.video || typeof document === 'undefined') return;
    const video = document.createElement('video'); video.src = trailerSource(video); video.loop = true; video.playsInline = true; video.preload = 'auto'; video.crossOrigin = 'anonymous';
    video.muted = true; this.video = video;
    const texture = new THREE.VideoTexture(video); texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
    this.texture = texture; this.mesh.material.map = texture; this.mesh.material.needsUpdate = true;
    video.addEventListener('playing', () => { this.mesh.visible = true; });
  }
  /** Start, stop or mute to match where the visitor is, the sound setting and whether the world is paused. */
  sync() {
    const want = this.inside && state.active && !state.reduced;
    if (!want) { if (this.video && !this.video.paused) this.video.pause(); if (!this.inside) this.mesh.visible = false; return; }
    this.ensureVideo(); const video = this.video; if (!video) return;
    video.muted = !state.sound; video.volume = .85;
    if (video.paused) void video.play().catch(() => { video.muted = true; void video.play().catch(() => {}); });
  }
  /** `view` in district space. The video is fetched as the visitor enters the lobby, so it is ready by the hall. */
  update(view: THREE.Vector3) {
    const inLobby = view.x > 7.5 && view.x < 15.2 && view.z > HALL.minZ && view.z < HALL.maxZ;
    if (inLobby) this.ensureVideo();
    const inside = insideHall(view.x, view.z); if (inside !== this.inside) { this.inside = inside; this.sync(); }
  }
  dispose() {
    state.screens.delete(this);
    if (this.video) { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); this.video = null; }
    this.texture?.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.removeFromParent();
  }
}
