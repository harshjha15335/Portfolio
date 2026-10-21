import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCityPerson, type CityPerson, type Outfit } from './CityFolk';
import { VEHICLE_LENGTH, VEHICLE_SPEED, type CityVehicleKind, createCityVehicleLod, setVehicleDetail } from './CityVehicles';
import type { V3 } from './ColorMesh';
import { pedestrianGreen, type LoopVehicle } from '../traffic/RoadTraffic';
import { CAST_LOD, districtCast, type CastAct, type CastFigure, type DistrictCast } from './DistrictCast';
import { footprint, personBlocker, PERSON_RADIUS, type Blocker } from '../collision/DynamicBlockers';
import { BrakeLights } from '../traffic/BrakeLights';
import { DRIVE_PROFILE, VEHICLE_BODY, TrafficSpace, drive, exitBlocked, inView, onCarriageway, stoppingDistance, type DriveState, type Driver, type Envelope, type Hold, type JunctionReservations, type SpawnDecision, type ViewCone } from '../traffic/TrafficSafety';

/* ------------------------------------------------------------------ signs */
/**
 * `tier` ranks how much a visitor must be able to read a sign: 1 for district and building names and other wayfinding
 * the brief requires to be legible (checked by `tests/signs.test.ts`), 2 for shop and street text (the default), 3 for
 * painted posters and decoration (the default for `draw` signs).
 */
export interface SignStyle { bg?: string; fg?: string; border?: string; font?: string; local?: string; tier?: 1 | 2 | 3; draw?: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void }
/** Where a sign was placed, in its district's local frame: the centre and outward normal of its face, and its size in metres. */
export interface SignRecord { text: string; tier: 1 | 2 | 3; center: THREE.Vector3; normal: THREE.Vector3; right: THREE.Vector3; width: number; height: number }
/**
 * One canvas atlas per district for every painted board, hoarding and poster,
 * merged into a single unlit draw. Text is drawn once at build time.
 */
export class SignAtlas {
  private canvas: HTMLCanvasElement; private ctx: CanvasRenderingContext2D; readonly texture: THREE.CanvasTexture;
  /** Every sign placed, for the sign audit. */
  readonly records: SignRecord[] = [];
  /** Signs that did not fit in the atlas and were not drawn. */
  readonly dropped: string[] = [];
  private pieces: THREE.BufferGeometry[] = []; private shelves: Array<{ y: number; h: number; x: number }> = []; private next = 0;
  constructor(private size = 2048) {
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = size; this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas); this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.anisotropy = 4;
  }
  /** Allocate a pixel region, paint it, and place a plane of `width` metres with the matching aspect. */
  add(text: string, width: number, matrix: THREE.Matrix4, style: SignStyle = {}, px: [number, number] = [512, 128]) {
    const [w, h] = px;
    // Shelf packing: a sign joins the snuggest shelf that fits it, so short signs don't waste tall rows.
    let shelf = this.shelves.filter(s => s.h >= h && s.h <= h * 1.5 && s.x + w <= this.size).sort((a, b) => a.h - b.h)[0];
    if (!shelf) {
      if (this.next + h > this.size) { if (import.meta.env?.DEV) console.warn(`[signs] atlas full after ${this.pieces.length} signs, dropped "${text}"`); this.dropped.push(text); return null; }
      shelf = { y: this.next, h, x: 0 }; this.shelves.push(shelf); this.next += h;
    }
    const x = shelf.x, y = shelf.y; shelf.x += w;
    const ctx = this.ctx;
    if (style.draw) style.draw(ctx, x, y, w, h);
    else {
      ctx.fillStyle = style.bg ?? '#26403d'; ctx.fillRect(x, y, w, h);
      if (style.border !== 'none') { ctx.strokeStyle = style.border ?? style.fg ?? '#e8d6a8'; ctx.lineWidth = Math.max(2, h * .03); ctx.strokeRect(x + h * .06, y + h * .06, w - h * .12, h - h * .12); }
      ctx.fillStyle = style.fg ?? '#efdcae'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (style.local) {
        ctx.font = `bold ${Math.round(h * .27)}px ${style.font ?? 'Arial, sans-serif'}`; ctx.fillText(style.local, x + w / 2, y + h * .3, w * .92);
        ctx.font = `bold ${Math.round(h * .34)}px ${style.font ?? 'Arial, sans-serif'}`; ctx.fillText(text, x + w / 2, y + h * .7, w * .92);
      } else { ctx.font = `bold ${Math.round(h * .46)}px ${style.font ?? 'Arial, sans-serif'}`; ctx.fillText(text, x + w / 2, y + h * .53, w * .92); }
    }
    const g = new THREE.PlaneGeometry(width, width * h / w), uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i) * w) / this.size, 1 - (y + (1 - uv.getY(i)) * h) / this.size);
    g.applyMatrix4(matrix); this.pieces.push(g);
    this.records.push({ text, tier: style.tier ?? (style.draw ? 3 : 2), center: new THREE.Vector3().setFromMatrixPosition(matrix), normal: new THREE.Vector3(0, 0, 1).transformDirection(matrix), right: new THREE.Vector3(1, 0, 0).transformDirection(matrix), width, height: width * h / w });
    return g;
  }
  build() {
    this.texture.needsUpdate = true;
    if (!this.pieces.length) return null;
    const mesh = new THREE.Mesh(mergeGeometries(this.pieces)!, new THREE.MeshBasicMaterial({ map: this.texture, side: THREE.DoubleSide, toneMapped: true }));
    this.pieces.forEach(p => p.dispose()); this.pieces = []; mesh.name = 'district:signs'; return mesh;
  }
}
export const placed = (position: V3, rotationY = 0, base?: THREE.Matrix4) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY), new THREE.Vector3(1, 1, 1));
  return base ? base.clone().multiply(m) : m;
};

/* ------------------------------------------------------------------ water */
let ripples: THREE.CanvasTexture | null = null;
/** A tiling ripple normal map painted from layered wave trains (shared by every lake and sea, never disposed). */
function rippleTexture() {
  if (ripples) return ripples;
  const size = 256, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!, image = ctx.createImageData(size, size), height = new Float32Array(size * size);
  // Integer wave numbers keep the height field seamless across the tile.
  const waves = Array.from({ length: 14 }, (_, i) => ({ kx: Math.round(Math.cos(i * 2.4) * (2 + i * .9)), ky: Math.round(Math.sin(i * 2.4) * (2 + i * .9)) || 1, a: 1 / (1 + i * .35), p: i * 1.7 }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let h = 0; for (const w of waves) h += w.a * Math.sin((w.kx * x + w.ky * y) / size * Math.PI * 2 + w.p); height[y * size + x] = h;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const at = (u: number, v: number) => height[((v + size) % size) * size + (u + size) % size], dx = at(x + 1, y) - at(x - 1, y), dy = at(x, y + 1) - at(x, y - 1);
    const n = new THREE.Vector3(-dx * .9, -dy * .9, 1).normalize(), k = (y * size + x) * 4;
    image.data[k] = (n.x * .5 + .5) * 255; image.data[k + 1] = (n.y * .5 + .5) * 255; image.data[k + 2] = (n.z * .5 + .5) * 255; image.data[k + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  ripples = new THREE.CanvasTexture(canvas); ripples.wrapS = ripples.wrapT = THREE.RepeatWrapping; ripples.colorSpace = THREE.NoColorSpace; ripples.anisotropy = 8;
  return ripples;
}
/**
 * A lake or sea: a gentle swell on a coarse grid, with drifting ripples in a normal map so
 * the low sun and the sky sparkle and streak across it.
 */
export class Water {
  readonly mesh: THREE.Mesh; private base: Float32Array; private map: THREE.Texture;
  constructor(width: number, depth: number, center: V3, color: string, private amplitude = .14, segments = 28) {
    const g = new THREE.PlaneGeometry(width, depth, segments, segments); g.rotateX(-Math.PI / 2);
    this.base = (g.getAttribute('position').array as Float32Array).slice();
    // Each water body repeats the shared ripple tile at about 9 m, through its own texture view.
    this.map = rippleTexture().clone(); this.map.repeat.set(width / 9, depth / 9);
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(.75), roughness: .07, metalness: .25, envMapIntensity: 6, normalMap: this.map, normalScale: new THREE.Vector2(.55, .55) });
    material.userData.surface = 'glass'; material.userData.sharedMap = true;
    this.mesh = new THREE.Mesh(g, material); this.mesh.position.set(...center); this.mesh.receiveShadow = true; this.mesh.name = 'district:water';
  }
  update(time: number) {
    const p = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute, a = this.amplitude;
    for (let i = 0; i < p.count; i++) {
      const x = this.base[i * 3], z = this.base[i * 3 + 2];
      p.setY(i, a * (Math.sin(x * .21 + time * .9) + .6 * Math.sin(z * .33 - time * 1.3 + x * .07)));
    }
    p.needsUpdate = true; this.mesh.geometry.computeVertexNormals();
    this.map.offset.set(time * .012, time * .02);
  }
}

/* ------------------------------------------------------------------ people */
type Act = 'stand' | 'sit' | 'talk' | 'bowl' | 'bat' | 'wave' | 'sell';
/** What each authored act plays on the licensed cast (it has Idle, Walk, Talk and Sit clips). */
const CAST_ACT: Record<Act, CastAct> = { stand: 'idle', sit: 'sit', talk: 'talk', bowl: 'idle', bat: 'idle', wave: 'idle', sell: 'talk' };
/** Seat surface above a sitter's authored position (the procedural figure drops by .45 m onto it). */
const SEAT = .515;
/**
 * One person in a crowd: an outer group the crowd moves, holding a licensed cast figure, or a
 * procedural stand-in until the cast has loaded (or when it cannot load, e.g. in tests).
 */
export interface Person { group: THREE.Group; outfit: Outfit; act: Act; scale: number; key: string; folk: CityPerson | null; cast: CastFigure | null }
interface Walker { person: Person; path: THREE.Vector3[]; lengths: number[]; total: number; s: number; speed: number; dir: number; pause: number; loop: boolean; offset: number; signal?: boolean }
/** A walker's widest step to either side of its line, metres (pavements are about 3 m wide). */
const SIDESTEP = .75;
interface Idler { person: Person; act: Act; phase: number }
/** Scripted pedestrians: walkers follow authored pavement paths, idlers hold a pose or a small loop. */
export class Crowd {
  readonly group = new THREE.Group(); private walkers: Walker[] = []; private idlers: Idler[] = []; private frame = 0; private count = 0;
  /** Static solids walkers must not pass through (local axis boxes), set by the district from its colliders. */
  readonly obstacles: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }> = [];
  /** True while a vehicle is still on the zebra; crossers at the kerb wait for it even on the walk signal. */
  crossingBusy: (() => boolean) | null = null;
  walker(outfit: Outfit, path: V3[], speed = 1, start = Math.random(), loop = false, scale = 1) {
    const person = this.make(outfit, 'stand', scale, path[0], true), pts = path.map(p => new THREE.Vector3(...p)), lengths = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
    const total = lengths.reduce((a, b) => a + b, 0), w: Walker = { person, path: pts, lengths, total, s: start * total, speed: person.cast?.walkSpeed ?? speed, dir: this.count % 2 ? 1 : -1, pause: 0, loop, offset: 0 };
    this.walkers.push(w); this.place(w); return person;
  }
  /** Someone who crosses the road at the zebra (local z), kerb to kerb and back, stepping off only on the walk signal. */
  crosser(outfit: Outfit, z: number, x0: number, x1: number, speed = 1.2) {
    const person = this.walker(outfit, [[x0, .03, z], [x1, .03, z]], speed, 0);
    const w = this.walkers[this.walkers.length - 1]; w.signal = true; w.dir = 1; w.speed = Math.max(w.speed, speed); return person;
  }
  /** The people who use the zebra. */
  crossers() { return this.walkers.filter(w => w.signal).map(w => w.person); }
  /** Positions of walkers on the carriageway (|x| < 4.2, local), for traffic to stop for. */
  onRoad(out: THREE.Vector3[] = []) { for (const w of this.walkers) if (Math.abs(w.person.group.position.x) < 4.2) out.push(w.person.group.position); return out; }
  idle(outfit: Outfit, position: V3, yaw: number, act: Act = 'stand', scale = 1) {
    const person = this.make(outfit, act, scale, position); person.group.position.set(...position); person.group.rotation.y = yaw;
    this.idlers.push({ person, act, phase: this.count * 1.7 }); return person;
  }
  private make(outfit: Outfit, act: Act, scale: number, at: V3, walking = false) {
    const group = new THREE.Group(), key = `${outfit}:${this.count++}:${this.group.uuid.slice(0, 4)}`;
    const person: Person = { group, outfit, act, scale, key, folk: null, cast: null }; this.group.add(group);
    const cast = districtCast(); if (cast) this.dress(person, cast, walking, at); else this.folk(person);
    return person;
  }
  /** The procedural stand-in. */
  private folk(person: Person) {
    const p = createCityPerson(person.key, person.outfit, person.scale); person.folk = p; person.group.add(p.group);
    if (person.act === 'sit') p.group.position.y -= .45;
    if (person.act === 'bat') { const bat = new THREE.Mesh(new THREE.BoxGeometry(.07, .75, .03).translate(0, -.42, 0), new THREE.MeshStandardMaterial({ color: '#c9a66b', roughness: .7 })); bat.castShadow = true; p.human.bones[15].add(bat); }
  }
  /** The licensed person; neighbours within a few metres are given someone else. */
  private dress(person: Person, cast: DistrictCast, walking: boolean, at: V3) {
    const near = this.people().filter(p => p.cast && Math.hypot(p.group.position.x - at[0], p.group.position.z - at[2]) < 4).map(p => p.cast!.member.id);
    const figure = cast.figure(person.outfit, walking ? 'walk' : CAST_ACT[person.act], person.key, person.scale, near); person.cast = figure;
    if (person.act === 'sit') figure.mesh.matrix.premultiply(new THREE.Matrix4().makeTranslation(0, SEAT + .08 - figure.pelvisHeight, 0));
    person.group.add(figure.mesh);
  }
  /** Swap every procedural stand-in for the licensed cast, keeping place, path and pose. */
  adopt(cast: DistrictCast) {
    for (const person of this.people()) {
      if (!person.folk) continue;
      const walker = this.walkers.find(w => w.person === person), folk = person.folk; person.folk = null;
      folk.group.removeFromParent(); folk.human.mesh.skeleton.dispose();
      for (const g of new Set([folk.human.mesh.geometry, ...(folk.human.mesh.userData.lodGeometries as THREE.BufferGeometry[])])) g.dispose();
      folk.human.mesh.traverse(o => { const m = (o as THREE.Mesh).material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose()); });
      this.dress(person, cast, Boolean(walker), person.group.position.toArray() as V3);
      if (walker) walker.speed = person.cast!.walkSpeed;
    }
  }
  private place(w: Walker) {
    let s = w.s, i = 0; while (i < w.lengths.length - 1 && s > w.lengths[i]) { s -= w.lengths[i]; i++; }
    const a = w.path[i], b = w.path[i + 1], t = w.lengths[i] ? Math.min(1, s / w.lengths[i]) : 0;
    w.person.group.position.lerpVectors(a, b, t); const dx = (b.x - a.x) * w.dir, dz = (b.z - a.z) * w.dir;
    const yaw = Math.atan2(-dx, -dz), turn = Math.atan2(Math.sin(yaw - w.person.group.rotation.y), Math.cos(yaw - w.person.group.rotation.y)); w.person.group.rotation.y += turn * .2;
  }
  update(time: number, delta: number, view: THREE.Vector3) {
    this.frame++;
    for (const w of this.walkers) {
      const g = w.person.group, rx = view.x - g.position.x, rz = view.z - g.position.z;
      const blocked = Math.hypot(rx, rz) < 1.6 && -rx * Math.sin(g.rotation.y) - rz * Math.cos(g.rotation.y) > 0;
      // At the kerb, a crosser waits for the walk signal; once on the road they keep going.
      const waiting = w.signal && (w.s <= 0 || w.s >= w.total) && (!pedestrianGreen(time) || !!this.crossingBusy?.());
      if (w.pause > 0) w.pause -= delta;
      else if (!blocked && !waiting) {
        w.s += w.dir * w.speed * delta;
        if (w.s > w.total || w.s < 0) { if (w.loop) w.s = (w.s + w.total) % w.total; else { w.dir *= -1; w.s = THREE.MathUtils.clamp(w.s, 0, w.total); w.pause = 1 + (w.total % 3); } }
      }
      this.place(w); this.steer(w, delta, view);
      // Step around the visitor instead of walking through them.
      const gap = Math.hypot(view.x - g.position.x, view.z - g.position.z);
      if (gap < 1.6) { const ax = g.position.x - view.x, az = g.position.z - view.z, n = Math.max(gap, .01); g.position.x += ax / n * (1.6 - gap); g.position.z += az / n * (1.6 - gap); }
      this.lod(w.person, time, w.pause <= 0 && !blocked, false, view, true);
    }
    for (const i of this.idlers) {
      const g = i.person.group; if (!this.lod(i.person, time, false, i.act === 'sit', view) || !i.person.folk) continue;
      const b = i.person.folk.human.bones, t = time + i.phase;
      if (i.act === 'talk') { b[13].rotation.x = -.5 + Math.sin(t * 2.3) * .25; b[14].rotation.x = -.9; b[3].rotation.y = Math.sin(t * .8) * .3; }
      else if (i.act === 'wave') { b[13].rotation.z = 2.4 + Math.sin(t * 6) * .25; b[14].rotation.z = .4; }
      else if (i.act === 'sell') { b[10].rotation.x = -.7; b[11].rotation.x = -.8; b[13].rotation.x = -.6 + Math.sin(t * 1.5) * .2; b[14].rotation.x = -.9; }
      else if (i.act === 'bowl') { const c = (t * .55) % 1; b[13].rotation.x = c < .5 ? -c * 2 * Math.PI * 1.1 : 0; g.rotation.x = 0; }
      else if (i.act === 'bat') { const c = (time * .55 + .45) % 1; const swing = c < .2 ? -c * 8 : 0; for (const k of [10, 13]) { b[k].rotation.x = -.6 + swing; b[k].rotation.z = 0; } b[1].rotation.y = c < .2 ? -c * 4 : 0; }
    }
    // The cast's shared rigs advance once per frame for everyone bound to them.
    if (this.walkers.some(w => w.person.cast) || this.idlers.some(i => i.person.cast)) districtCast()?.update(delta);
  }
  /**
   * Keep a walker out of people and solids ahead on its line: it drifts to its own left (Mumbai keeps left)
   * around people, and to whichever side clears a stall or bench. A solid too wide to pass turns it back.
   */
  private steer(w: Walker, delta: number, view: THREE.Vector3) {
    const g = w.person.group, fx = -Math.sin(g.rotation.y), fz = -Math.cos(g.rotation.y);
    // Walker paths are lines; the left of the direction of travel is (fz, −fx) rotated: (−fz… ) in x/z terms.
    const lx = -fz, lz = fx, baseX = g.position.x, baseZ = g.position.z;
    let want = 0, turn = false;
    const consider = (x: number, z: number, radius: number) => {
      const rx = x - baseX, rz = z - baseZ, front = rx * fx + rz * fz, side = rx * lx + rz * lz;
      if (front > 0 && front < 2.4 && Math.abs(side - w.offset) < radius + PERSON_RADIUS + .15) want = Math.max(want, Math.min(SIDESTEP, side + radius + PERSON_RADIUS + .2));
    };
    for (const o of this.walkers) if (o !== w && o.pause <= 0) consider(o.person.group.position.x, o.person.group.position.z, PERSON_RADIUS);
    for (const i of this.idlers) consider(i.person.group.position.x, i.person.group.position.z, i.act === 'sit' ? .45 : PERSON_RADIUS);
    for (const b of this.obstacles) {
      // The stretch of this walker's line just ahead, against the box grown by a body's width.
      const ahead = { x: baseX + fx * 1.2, z: baseZ + fz * 1.2 }, r = PERSON_RADIUS + .05;
      if (ahead.x + lx * w.offset < b.minX - r - .6 || ahead.x + lx * w.offset > b.maxX + r + .6 || ahead.z < b.minZ - r - 1.2 || ahead.z > b.maxZ + r + 1.2) continue;
      // Offsets (along the left axis) that clear the box on either side.
      const lo = (lx ? (lx > 0 ? b.minX - r - baseX : baseX - (b.maxX + r)) / Math.abs(lx) * Math.sign(lx) : 0), hi = (lx ? (lx > 0 ? b.maxX + r - baseX : baseX - (b.minX - r)) / Math.abs(lx) * Math.sign(lx) : 0);
      const a = Math.min(lo, hi), c = Math.max(lo, hi);
      if (w.offset <= a || w.offset >= c) continue;
      const pick = Math.abs(a) < Math.abs(c) ? a : c;
      if (Math.abs(pick) > SIDESTEP) turn = true; else want = Math.abs(pick) > Math.abs(want) ? pick : want;
    }
    // Someone on a crossing finishes it rather than turning back in the road.
    if (turn && w.pause <= 0 && !w.signal) { w.dir *= -1; w.pause = .6; }
    w.offset += (want - w.offset) * Math.min(1, delta * 3);
    g.position.x += lx * w.offset; g.position.z += lz * w.offset;
  }
  /** Distance LOD; returns whether a procedural person should animate this frame. */
  private lod(p: Person, time: number, walking: boolean, seated: boolean, view: THREE.Vector3, walker = false) {
    const d = p.group.position.distanceTo(view);
    if (p.cast) {
      const visible = d < CAST_LOD.hidden; p.cast.mesh.visible = visible; if (!visible) return false;
      p.cast.setLevel(d < CAST_LOD.far ? 0 : d < CAST_LOD.distant ? 1 : 2);
      if (walker) p.cast.setAct(walking ? 'walk' : 'idle');
      return false;
    }
    const folk = p.folk!; folk.human.mesh.visible = d < 70; folk.setLevel(d < 9 ? 0 : d < 20 ? 1 : 2);
    if (!folk.human.mesh.visible) return false;
    if (d > 22 && (this.frame + p.group.id) % 3) return false;
    folk.animate(time, walking, seated); return true;
  }
  people() { return [...this.walkers.map(w => w.person), ...this.idlers.map(i => i.person)]; }
  /** Everyone within `range` of `view` (local), as world-space blockers the visitor cannot walk through. */
  collectBlockers(out: Blocker[], origin: THREE.Vector3, view: THREE.Vector3, range = 12) {
    for (const p of this.people()) {
      const g = p.group.position; if (Math.abs(g.x - view.x) > range || Math.abs(g.z - view.z) > range) continue;
      out.push(personBlocker(g.x + origin.x, g.z + origin.z, p.act === 'sit' ? .38 : undefined));
    }
  }
  /** People who stay put (vendors, talkers, sitters). */
  standing() { return this.idlers.map(i => i.person); }
  get size() { return this.walkers.length + this.idlers.length; }
}

/* ------------------------------------------------------------------ traffic */
interface Agent {
  mesh: THREE.Mesh; kind: CityVehicleKind; lane: number; s: number; max: number; length: number; active: boolean; seed: string; rider: CastFigure | null;
  /** The collision-safe driver: envelope, speed, state. */
  driver: Driver;
  /** Why it last could or could not enter the road (open lanes). */
  decision: SpawnDecision | null;
  /** How many times it has re-entered the road from a lane start. */
  entries: number;
}
interface Lane { curve: THREE.CatmullRomCurve3; length: number; closed: boolean; shared: () => LoopVehicle[]; movement: string; lastSeen: number; table: Float32Array }
/** Lanes are sampled every LANE_STEP m once, so a pose along one is a table lookup (path queries take dozens a frame). */
const LANE_STEP = .25;
/** Depth (m) of road a zebra's stop line guards, to the far stop line (Fort Road's are 6.4 m apart, the districts' 5.6). */
const KEEP_CLEAR = 6.4;
function laneTable(curve: THREE.CatmullRomCurve3, length: number) {
  const n = Math.ceil(length / LANE_STEP) + 1, table = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const t = Math.min(1, i * LANE_STEP / length), p = curve.getPointAt(t), d = curve.getTangentAt(t); table.set([p.x, p.z, d.x, d.z], i * 4); }
  return table;
}
/**
 * Mixed Mumbai traffic on authored lane curves that enter and leave by side streets.
 * Every vehicle has a collision envelope and drives through the shared TrafficSpace: it follows the vehicle
 * ahead with the car-following model, stops for people and the visitor, waits at stop lines and conflict
 * zones, and only ever commits the part of a move the swept check allows, so nothing drives into anything.
 */
/** Who drives what: autos and taxis by the vendor/driver cast, two-wheelers by commuters and office staff. */
/** Riders are small inside their vehicles, so they drop out sooner than people on foot. */
const RIDER_HIDDEN = 30;
/**
 * Vehicles use their full body inside VEHICLE_NEAR (m), the far one to VEHICLE_FAR, the distant one beyond and
 * none past VEHICLE_HIDDEN, deep in the haze (fog is about 70% there), so they fade out instead of popping;
 * keeps traffic inside the Medium triangle budget.
 */
const VEHICLE_NEAR = 16, VEHICLE_FAR = 40;
export const VEHICLE_HIDDEN = 115;
/** A lane start must be at least this far (m) from the visitor, and unseen for RECENTLY_SEEN seconds, before a vehicle enters there. */
export const SPAWN_MIN_DISTANCE = 25, RECENTLY_SEEN = 3;
const RIDER_OUTFIT: Partial<Record<CityVehicleKind, Outfit>> = { auto: 'vendor', bike: 'shirt', cycle: 'worker', bus: 'office', tempo: 'worker' };
const PRIORITY: Partial<Record<CityVehicleKind, number>> = { bus: 2 };
let trafficSystems = 0;

export class LaneTraffic {
  readonly group = new THREE.Group(); private lanes: Lane[] = []; private agents: Agent[] = [];
  /** Brake lamps of the vehicles that are slowing or held, near the visitor. */
  private brakes = new BrakeLights(); constructor() { this.group.add(this.brakes.mesh); }
  private stops: Array<{ lane: number; s: number; active: (time: number) => boolean }> = [];
  /** Unique prefix of this system's envelope ids. */
  readonly id = `traffic${trafficSystems++}`;
  /** True when buildings hide a vehicle (centre, length) from `view`; such vehicles draw nothing. */
  occluded: ((position: THREE.Vector3, length: number, view: THREE.Vector3) => boolean) | null = null;
  /** Areas where movements cross; set by the street that owns this traffic. */
  junctions: JunctionReservations | null = null;
  /** What the visitor saw at the last update (local), for spawn and despawn decisions. */
  private view: ViewCone | null = null; private viewPoint = new THREE.Vector3();
  private parkedEnvelopes: Envelope[] = [];
  private local = new TrafficSpace();
  /** A stop line on a lane at local `z` (on the side of `x`, for a loop that passes z twice), held while `active(time)` (a pedestrian green). */
  stopLine(lane: number, z: number, active: (time: number) => boolean, x?: number) {
    const { curve, length } = this.lanes[lane]; let best = 0, bestGap = Infinity;
    for (let i = 0; i <= 400; i++) { const p = curve.getPointAt(i / 400), gap = Math.abs(p.z - z) + (x === undefined ? 0 : Math.abs(p.x - x)); if (gap < bestGap) { bestGap = gap; best = i / 400; } }
    this.stops.push({ lane, s: best * length, active });
  }
  /** Positions of the vehicles currently on the road (for other traffic to queue behind). */
  get positions() { return this.agents.filter(a => a.active && a.mesh.visible).map(a => a.mesh.position); }
  /** Vehicles on the road now: where, which way and how long (local). */
  get moving() { return this.agents.filter(a => a.active).map(a => ({ position: a.mesh.position, yaw: a.mesh.rotation.y, length: a.length, kind: a.kind, speed: a.driver.speed })); }
  /** Every vehicle's envelope, state and last spawn decision (development diagnostics and tests). */
  diagnostics() { return this.agents.map(a => ({ id: a.driver.env.id, kind: a.kind, lane: a.lane, s: a.s, active: a.active, speed: a.driver.speed, state: a.active ? a.driver.state : 'inactive' as DriveState, decision: a.decision, entries: a.entries, interventions: a.driver.interventions, envelope: { ...a.driver.env } })); }
  /**
   * A lane along `points`. An open lane is driven end to end, vehicles leaving at the far end and re-entering
   * at the start; a closed one is a loop driven round and round. `shared` lists other traffic on the same
   * loop (another system's vehicles, by distance along it), which this lane's vehicles queue behind.
   */
  lane(points: V3[], closed = false, shared: () => LoopVehicle[] = () => [], movement?: string) { const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'centripetal'); const length = curve.getLength(); this.lanes.push({ curve, length, closed, shared, movement: movement ?? `${this.id}:lane${this.lanes.length}`, lastSeen: -Infinity, table: laneTable(curve, length) }); return this.lanes.length - 1; }
  /** This system's vehicles on a lane, by distance along it (for traffic sharing a loop with them). */
  onLane(lane: number): LoopVehicle[] { return this.agents.filter(a => a.lane === lane && a.active).map(a => ({ s: a.s, length: a.length })); }
  /** A static vehicle the traffic must keep clear of (parked at the kerb). */
  parkedAt(kind: CityVehicleKind, x: number, z: number, yaw: number) { this.parkedEnvelopes.push({ id: `${this.id}:parked:${this.parkedEnvelopes.length}`, x, z, yaw, halfLength: VEHICLE_BODY[kind].length / 2, halfWidth: VEHICLE_BODY[kind].width / 2, category: 'parked', speed: 0 }); }
  get parked(): readonly Envelope[] { return this.parkedEnvelopes; }
  vehicle(lane: number, kind: CityVehicleKind, at: number, seed: string, parked = false) {
    const cast = districtCast(), mesh = createCityVehicleLod(kind, seed, !cast); this.group.add(mesh);
    const body = VEHICLE_BODY[kind], max = parked ? 0 : VEHICLE_SPEED[kind] * (.85 + (seed.length % 5) * .06);
    const driver: Driver = { env: { id: `${this.id}:${this.agents.length}`, x: 0, z: 0, yaw: 0, halfLength: body.length / 2, halfWidth: body.width / 2, category: parked ? 'parked' : 'vehicle', speed: 0, movement: this.lanes[lane].movement }, speed: 0, profile: DRIVE_PROFILE[kind], desired: max, state: parked ? 'stopped' : 'cruising', priority: PRIORITY[kind] ?? 1, blockedBy: null, interventions: 0 };
    const a: Agent = { mesh, kind, lane, s: at * this.lanes[lane].length, max, length: VEHICLE_LENGTH[kind], active: true, seed, rider: null, driver, decision: null, entries: 0 };
    this.agents.push(a); this.pose(a); if (cast) this.seat(a, cast); return mesh;
  }
  /** Put a licensed cast figure in the vehicle's driving seat, posed sitting, riding with the vehicle. */
  private seat(a: Agent, cast: DistrictCast) {
    const seat = a.mesh.userData.seat as V3 | null; if (!seat) return;
    const figure = cast.figure(RIDER_OUTFIT[a.kind] ?? 'shirt', 'sit', `${a.seed}:rider`, 1);
    figure.mesh.matrix.premultiply(new THREE.Matrix4().makeTranslation(seat[0], seat[1] + .12 - figure.pelvisHeight, seat[2]));
    a.mesh.add(figure.mesh); a.rider = figure;
  }
  /** Swap the baked procedural drivers for the licensed cast once it has loaded. */
  adopt(cast: DistrictCast) { this.rebuild(a => !a.rider && Boolean(a.mesh.userData.seat), cast); }
  /** Rebuild every vehicle body, e.g. once the modelled vehicles (CityVehicleModels) have loaded. */
  refresh() { this.rebuild(() => true, districtCast()); }
  /** Model swaps keep the simulation state (lane, distance, speed, envelope); only the drawn body changes. */
  private rebuild(which: (a: Agent) => boolean, cast: DistrictCast | null) {
    for (const a of this.agents) {
      if (!which(a)) continue;
      a.rider?.dispose(); a.rider = null;
      const mesh = createCityVehicleLod(a.kind, a.seed, !cast); mesh.position.copy(a.mesh.position); mesh.rotation.copy(a.mesh.rotation); mesh.visible = a.mesh.visible;
      this.group.add(mesh); a.mesh.removeFromParent(); for (const g of a.mesh.userData.lodGeometries as THREE.BufferGeometry[]) g.dispose();
      a.mesh = mesh; if (cast) this.seat(a, cast);
    }
  }
  dispose() { for (const a of this.agents) { a.rider?.dispose(); a.rider = null; } this.brakes.dispose(); }
  /** True when the visitor could see this point (within the haze, in the view cone and not behind the frontages). */
  private seen(x: number, z: number, radius: number, length: number) {
    const v = this.view; if (!v) return false;
    if (Math.hypot(x - v.x, z - v.z) - radius > VEHICLE_HIDDEN || !inView(v, x, z, radius)) return false;
    return !this.occluded?.(new THREE.Vector3(x, 0, z), length, this.viewPoint);
  }
  /** Take a vehicle off the road (it re-enters at its lane start when the spawn rules allow). */
  private retire(a: Agent, space?: TrafficSpace) {
    a.active = false; a.mesh.visible = false; a.driver.speed = 0; a.driver.state = 'inactive'; a.driver.blockedBy = null;
    space?.remove(a.driver.env.id); this.local.remove(a.driver.env.id); this.junctions?.forget(a.driver.env.id);
  }
  /**
   * Make room for a vehicle pulling in at `points` (local, e.g. a hailed cab's pickup route): traffic within
   * `radius` of the route that the visitor cannot see leaves the road and re-enters at its lane start when clear.
   * Vehicles in view stay (the arriving cab waits for them). `force` also removes seen ones, for a district the
   * visitor is not in yet. Loop lanes keep theirs. Returns how many stayed because they were in view.
   */
  clearAround(points: Array<{ x: number; z: number }>, radius = 3, force = false) {
    let kept = 0;
    for (const a of this.agents) {
      if (!a.active || !a.max || this.lanes[a.lane].closed) continue;
      const near = points.some((p, i) => {
        // Distance from the vehicle to the route segment ending at this point.
        const q = points[Math.max(0, i - 1)], dx = p.x - q.x, dz = p.z - q.z, len = dx * dx + dz * dz;
        const t = len ? THREE.MathUtils.clamp(((a.mesh.position.x - q.x) * dx + (a.mesh.position.z - q.z) * dz) / len, 0, 1) : 0;
        return Math.hypot(a.mesh.position.x - (q.x + dx * t), a.mesh.position.z - (q.z + dz * t)) < radius + a.length / 2;
      });
      if (!near) continue;
      if (!force && this.seen(a.mesh.position.x, a.mesh.position.z, a.length / 2, a.length)) { kept++; continue; }
      this.retire(a);
    }
    return kept;
  }
  /** Pose along a lane, past either end straight on along the end's heading (paths look a little ahead). */
  private at(lane: Lane, s: number) {
    if (lane.closed) s = ((s % lane.length) + lane.length) % lane.length;
    const c = THREE.MathUtils.clamp(s, 0, lane.length), over = s - c, n = lane.table.length / 4 - 1, f = Math.min(n, c / LANE_STEP), i = Math.min(n - 1, Math.floor(f)), k = f - i, T = lane.table;
    const lerp = (j: number) => T[i * 4 + j] + (T[(i + 1) * 4 + j] - T[i * 4 + j]) * k, dx = lerp(2), dz = lerp(3);
    return { x: lerp(0) + dx * over, z: lerp(1) + dz * over, yaw: Math.atan2(-dx, -dz) };
  }
  private pose(a: Agent) {
    const p = this.at(this.lanes[a.lane], a.s);
    a.mesh.position.set(p.x, .02, p.z); a.mesh.rotation.y = p.yaw;
    a.driver.env.x = p.x; a.driver.env.z = p.z; a.driver.env.yaw = p.yaw;
  }
  /** Put this system's vehicles on the road into a shared space, so other systems see them before this one moves. */
  publish(space: TrafficSpace) {
    for (const e of this.parkedEnvelopes) space.add(e);
    for (const a of this.agents) { if (a.active) { if (space.drivers.get(a.driver.env.id) !== a.driver) space.addDriver(a.driver); } else space.remove(a.driver.env.id); }
  }
  /**
   * May a vehicle enter the road at its lane start now? Not into an occupied lane or one it could not drive on
   * from without braking hard, not near the visitor, a person or the passenger ride, and not where the visitor
   * is looking or looked in the last RECENTLY_SEEN seconds.
   */
  private spawnCheck(a: Agent, space: TrafficSpace, time: number, visitor?: THREE.Vector3): SpawnDecision {
    const lane = this.lanes[a.lane], p = this.at(lane, 0), d = a.driver;
    if (visitor && Math.hypot(p.x - visitor.x, p.z - visitor.z) < SPAWN_MIN_DISTANCE) return 'blocked-player';
    const entry = Math.min(a.max * .6, a.max), run = d.env.halfLength + d.profile.minGap + stoppingDistance(entry, d.profile) + 2;
    const probe: Envelope = { ...d.env, x: p.x, z: p.z, yaw: p.yaw };
    const inside = space.hit(probe, d.env.id, .5), ahead = inside ?? space.clearance(probe, s => this.at(lane, s), run).blocker;
    if (ahead) return ahead.category === 'visitor' ? 'blocked-player' : ahead.category === 'person' ? 'blocked-pedestrian' : ahead.category === 'ride' ? 'blocked-ride' : 'blocked-occupied';
    if (this.seen(p.x, p.z, d.env.halfLength, a.length)) return 'blocked-visible';
    if (time - lane.lastSeen < RECENTLY_SEEN) return 'blocked-recently-visible';
    return 'approved';
  }
  /**
   * `obstacles[0]` is the visitor and the rest are other vehicles (given room for their length); `walkers`
   * are people crossing the carriageway. `space` is the stretch of road shared with other traffic systems and
   * the passenger ride (without one, this system keeps its own); `view` is what the visitor sees (local).
   */
  update(time: number, delta: number, obstacles: THREE.Vector3[], walkers: THREE.Vector3[] = [], context: { space?: TrafficSpace; view?: ViewCone } = {}) {
    const visitor = obstacles[0], space = context.space ?? this.local;
    if (!context.space) space.clear();
    this.view = context.view ?? (visitor ? { x: visitor.x, z: visitor.z, fx: 0, fz: -1, halfAngle: Math.PI, range: VEHICLE_HIDDEN } : null);
    if (visitor) { this.viewPoint.copy(visitor); if (!space.get('visitor') && onCarriageway(visitor.x, visitor.z)) space.add({ id: 'visitor', x: visitor.x, z: visitor.z, yaw: 0, halfLength: .35, halfWidth: .35, category: 'visitor', speed: 0 }); }
    obstacles.slice(1).forEach((o, k) => { if (!space.get(`${this.id}:other:${k}`)) space.add({ id: `${this.id}:other:${k}`, x: o.x, z: o.z, yaw: 0, halfLength: 1.2, halfWidth: 1.2, category: 'person', speed: 0 }); });
    walkers.forEach((w, k) => space.add({ id: `${this.id}:walker:${k}`, x: w.x, z: w.z, yaw: 0, halfLength: .3, halfWidth: .3, category: 'person', speed: 0 }));
    this.publish(space);
    // Remember when each lane start was last in view: nothing enters where the visitor has just been looking.
    for (const lane of this.lanes) if (!lane.closed) { const p = this.at(lane, 0); if (this.seen(p.x, p.z, 6, 12)) lane.lastSeen = time; }
    const junctions = this.junctions ? { reservations: this.junctions, time } : undefined;
    this.brakes.begin();
    for (const a of this.agents) {
      const near = visitor ? a.mesh.position.distanceTo(visitor) : 0;
      if (visitor) setVehicleDetail(a.mesh as THREE.Mesh, near > VEHICLE_HIDDEN || this.occluded?.(a.mesh.position, a.length, visitor) ? 'hidden' : near < VEHICLE_NEAR ? 0 : near < VEHICLE_FAR ? 1 : 2);
      if (a.rider) { a.rider.mesh.visible = a.mesh.visible && near < RIDER_HIDDEN; a.rider.setLevel(near < CAST_LOD.far ? 0 : near < CAST_LOD.distant * .5 ? 1 : 2); }
      if (!a.max) continue;
      const lane = this.lanes[a.lane], d = a.driver;
      if (!a.active) {
        a.decision = this.spawnCheck(a, space, time, visitor); if (a.decision !== 'approved') continue;
        // A reused vehicle starts clean: lane start, entry speed, no stale hold, wait or brake state.
        a.active = true; a.s = 0; a.entries++; a.mesh.visible = true; d.speed = a.max * .6; d.env.speed = d.speed; d.state = 'spawning'; d.blockedBy = null;
        this.junctions?.forget(d.env.id); this.pose(a); space.addDriver(d);
      }
      const holds: Hold[] = [];
      for (const stop of this.stops) if (stop.lane === a.lane) {
        let toLine = stop.s - a.s - d.env.halfLength; if (lane.closed && toLine < -lane.length / 2) toLine += lane.length;
        // Too close to stop at the class's hardest braking: already committed, it clears the crossing.
        if (!(toLine > -.3 && toLine < 14 && toLine > d.speed * d.speed / (2 * d.profile.maxBrake) - .05)) continue;
        if (stop.active(time)) holds.push({ distance: toLine, state: 'waiting-signal' });
        // Keep the crossing clear: behind a slow vehicle, enter the zebra only with room for the whole body beyond it.
        else if (exitBlocked(space, d, s => this.at(lane, a.s + s), toLine, KEEP_CLEAR)) holds.push({ distance: toLine, state: 'following' });
      }
      // Another system's vehicles on a shared loop, when they are not in the space themselves.
      if (!context.space) for (const b of lane.shared()) { const ahead = ((b.s - a.s) % lane.length + lane.length) % lane.length; if (ahead < lane.length / 2) holds.push({ distance: ahead - (a.length + b.length) / 2 - d.profile.minGap, state: 'following' }); }
      const moved = drive(space, d, s => this.at(lane, a.s + s), delta, holds, undefined, junctions);
      a.s += moved;
      if (lane.closed) a.s %= lane.length;
      else if (a.s >= lane.length) {
        // Leave only out of sight; in view, wait at the lane end (they lie beyond the haze, so this is a safeguard).
        if (!this.seen(d.env.x, d.env.z, d.env.halfLength, a.length)) { this.retire(a, space); continue; }
        a.s = lane.length; d.speed = 0; d.state = 'exiting';
      }
      this.pose(a);
      a.mesh.position.y = .02 + (a.kind === 'auto' || a.kind === 'bike' ? Math.sin(time * 13 + a.s) * .006 * Math.min(1, d.speed) : 0);
      const braking = this.brakes.braking(a.mesh, d.speed, d.state, delta); if (a.mesh.visible && near < VEHICLE_FAR) this.brakes.add(a.mesh, a.kind, braking);
    }
    this.brakes.end();
  }
  get size() { return this.agents.length; }
  /** Vehicles on the road within `range` of `view` (local), as world-space blockers. */
  collectBlockers(out: Blocker[], origin: THREE.Vector3, view: THREE.Vector3, range = 18) {
    for (const a of this.agents) {
      const p = a.mesh.position; if (!a.active || Math.abs(p.x - view.x) > range || Math.abs(p.z - view.z) > range) continue;
      const f = footprint(a.mesh);
      out.push({ x: p.x + origin.x, z: p.z + origin.z, yaw: a.mesh.rotation.y, halfLength: Math.max(f.halfLength, a.length / 2), halfWidth: f.halfWidth });
    }
  }
}
