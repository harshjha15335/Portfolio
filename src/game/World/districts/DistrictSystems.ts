import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCityPerson, type CityPerson, type Outfit } from './CityFolk';
import { VEHICLE_LENGTH, VEHICLE_SPEED, type CityVehicleKind, createCityVehicleLod, setVehicleDetail } from './CityVehicles';
import type { V3 } from './ColorMesh';
import type { LoopVehicle } from '../traffic/RoadTraffic';
import { CAST_LOD, districtCast, type CastAct, type CastFigure, type DistrictCast } from './DistrictCast';
import { footprint, personBlocker, PERSON_RADIUS, type Blocker } from '../collision/DynamicBlockers';

/* ------------------------------------------------------------------ signs */
export interface SignStyle { bg?: string; fg?: string; border?: string; font?: string; local?: string; draw?: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void }
/**
 * One canvas atlas per district for every painted board, hoarding and poster,
 * merged into a single unlit draw. Text is drawn once at build time.
 */
export class SignAtlas {
  private canvas: HTMLCanvasElement; private ctx: CanvasRenderingContext2D; readonly texture: THREE.CanvasTexture;
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
      if (this.next + h > this.size) { if (import.meta.env?.DEV) console.warn(`[signs] atlas full after ${this.pieces.length} signs, dropped "${text}"`); return null; }
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
    g.applyMatrix4(matrix); this.pieces.push(g); return g;
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
interface Walker { person: Person; path: THREE.Vector3[]; lengths: number[]; total: number; s: number; speed: number; dir: number; pause: number; loop: boolean; offset: number }
/** A walker's widest step to either side of its line, metres (pavements are about 3 m wide). */
const SIDESTEP = .75;
interface Idler { person: Person; act: Act; phase: number }
/** Scripted pedestrians: walkers follow authored pavement paths, idlers hold a pose or a small loop. */
export class Crowd {
  readonly group = new THREE.Group(); private walkers: Walker[] = []; private idlers: Idler[] = []; private frame = 0; private count = 0;
  /** Static solids walkers must not pass through (local axis boxes), set by the district from its colliders. */
  readonly obstacles: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }> = [];
  walker(outfit: Outfit, path: V3[], speed = 1, start = Math.random(), loop = false, scale = 1) {
    const person = this.make(outfit, 'stand', scale, path[0], true), pts = path.map(p => new THREE.Vector3(...p)), lengths = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
    const total = lengths.reduce((a, b) => a + b, 0), w: Walker = { person, path: pts, lengths, total, s: start * total, speed: person.cast?.walkSpeed ?? speed, dir: this.count % 2 ? 1 : -1, pause: 0, loop, offset: 0 };
    this.walkers.push(w); this.place(w); return person;
  }
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
      if (w.pause > 0) w.pause -= delta;
      else if (!blocked) {
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
    if (turn && w.pause <= 0) { w.dir *= -1; w.pause = .6; }
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
interface Agent { mesh: THREE.Mesh; kind: CityVehicleKind; lane: number; s: number; speed: number; max: number; length: number; active: boolean; seed: string; rider: CastFigure | null }
/**
 * Mixed Mumbai traffic on authored lane curves that enter and leave by side streets.
 * Vehicles keep length-aware gaps, queue behind slow handcarts and stop for the visitor.
 */
/** Who drives what: autos and taxis by the vendor/driver cast, two-wheelers by commuters and office staff. */
/** Riders are small inside their vehicles, so they drop out sooner than people on foot. */
const RIDER_HIDDEN = 30;
/**
 * Vehicles use their full body inside VEHICLE_NEAR (m), the far one to VEHICLE_FAR, the distant one beyond and
 * none past VEHICLE_HIDDEN, deep in the haze (fog is about 70% there), so they fade out instead of popping;
 * keeps traffic inside the Medium triangle budget.
 */
const FORWARD = new THREE.Vector3();
const VEHICLE_NEAR = 16, VEHICLE_FAR = 40, VEHICLE_HIDDEN = 115;
const RIDER_OUTFIT: Partial<Record<CityVehicleKind, Outfit>> = { auto: 'vendor', bike: 'shirt', cycle: 'worker', bus: 'office', tempo: 'worker' };

export class LaneTraffic {
  readonly group = new THREE.Group(); private lanes: Array<{ curve: THREE.CatmullRomCurve3; length: number; closed: boolean; shared: () => LoopVehicle[] }> = []; private agents: Agent[] = [];
  private stops: Array<{ lane: number; s: number; active: (time: number) => boolean }> = [];
  /** True when buildings hide a vehicle (centre, length) from `view`; such vehicles draw nothing. */
  occluded: ((position: THREE.Vector3, length: number, view: THREE.Vector3) => boolean) | null = null;
  /** A stop line on a lane at local `z` (on the side of `x`, for a loop that passes z twice), held while `active(time)` (a pedestrian green). */
  stopLine(lane: number, z: number, active: (time: number) => boolean, x?: number) {
    const { curve, length } = this.lanes[lane]; let best = 0, bestGap = Infinity;
    for (let i = 0; i <= 400; i++) { const p = curve.getPointAt(i / 400), gap = Math.abs(p.z - z) + (x === undefined ? 0 : Math.abs(p.x - x)); if (gap < bestGap) { bestGap = gap; best = i / 400; } }
    this.stops.push({ lane, s: best * length, active });
  }
  /** Positions of the vehicles currently on the road (for other traffic to queue behind). */
  get positions() { return this.agents.filter(a => a.active && a.mesh.visible).map(a => a.mesh.position); }
  /**
   * A lane along `points`. An open lane is driven end to end, vehicles leaving at the far end and re-entering
   * at the start; a closed one is a loop driven round and round. `shared` lists other traffic on the same
   * loop (another system's vehicles, by distance along it), which this lane's vehicles queue behind.
   */
  lane(points: V3[], closed = false, shared: () => LoopVehicle[] = () => []) { const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'centripetal'); this.lanes.push({ curve, length: curve.getLength(), closed, shared }); return this.lanes.length - 1; }
  /** This system's vehicles on a lane, by distance along it (for traffic sharing a loop with them). */
  onLane(lane: number): LoopVehicle[] { return this.agents.filter(a => a.lane === lane && a.active).map(a => ({ s: a.s, length: a.length })); }
  vehicle(lane: number, kind: CityVehicleKind, at: number, seed: string, parked = false) {
    const cast = districtCast(), mesh = createCityVehicleLod(kind, seed, !cast); this.group.add(mesh);
    const a: Agent = { mesh, kind, lane, s: at * this.lanes[lane].length, speed: 0, max: parked ? 0 : VEHICLE_SPEED[kind] * (.85 + (seed.length % 5) * .06), length: VEHICLE_LENGTH[kind], active: true, seed, rider: null };
    this.agents.push(a); this.pose(a, 1); if (cast) this.seat(a, cast); return mesh;
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
  private rebuild(which: (a: Agent) => boolean, cast: DistrictCast | null) {
    for (const a of this.agents) {
      if (!which(a)) continue;
      a.rider?.dispose(); a.rider = null;
      const mesh = createCityVehicleLod(a.kind, a.seed, !cast); mesh.position.copy(a.mesh.position); mesh.rotation.copy(a.mesh.rotation); mesh.visible = a.mesh.visible;
      this.group.add(mesh); a.mesh.removeFromParent(); for (const g of a.mesh.userData.lodGeometries as THREE.BufferGeometry[]) g.dispose();
      a.mesh = mesh; if (cast) this.seat(a, cast);
    }
  }
  dispose() { for (const a of this.agents) { a.rider?.dispose(); a.rider = null; } }
  /**
   * Make room for a vehicle pulling in at `points` (local, e.g. a hailed cab's pickup route): traffic within
   * `radius` of the route leaves the road and re-enters at its lane start when clear. Loop lanes keep theirs.
   */
  clearAround(points: Array<{ x: number; z: number }>, radius = 3) {
    for (const a of this.agents) {
      if (!a.active || !a.max || this.lanes[a.lane].closed) continue;
      const near = points.some((p, i) => {
        // Distance from the vehicle to the route segment ending at this point.
        const q = points[Math.max(0, i - 1)], dx = p.x - q.x, dz = p.z - q.z, len = dx * dx + dz * dz;
        const t = len ? THREE.MathUtils.clamp(((a.mesh.position.x - q.x) * dx + (a.mesh.position.z - q.z) * dz) / len, 0, 1) : 0;
        return Math.hypot(a.mesh.position.x - (q.x + dx * t), a.mesh.position.z - (q.z + dz * t)) < radius + a.length / 2;
      });
      if (near) { a.active = false; a.mesh.visible = false; }
    }
  }
  private pose(a: Agent, blend: number) {
    const lane = this.lanes[a.lane], t = THREE.MathUtils.clamp(a.s / lane.length, 0, 1), p = lane.curve.getPointAt(t), d = lane.curve.getTangentAt(t);
    a.mesh.position.set(p.x, .02, p.z); const yaw = Math.atan2(-d.x, -d.z), turn = Math.atan2(Math.sin(yaw - a.mesh.rotation.y), Math.cos(yaw - a.mesh.rotation.y));
    a.mesh.rotation.y += turn * blend;
  }
  /**
   * `obstacles[0]` is the visitor and the rest are other vehicles (given room for their length); `walkers`
   * are people crossing the carriageway.
   */
  update(time: number, delta: number, obstacles: THREE.Vector3[], walkers: THREE.Vector3[] = []) {
    const view = obstacles[0];
    for (const a of this.agents) {
      const near = view ? a.mesh.position.distanceTo(view) : 0;
      if (view) setVehicleDetail(a.mesh as THREE.Mesh, near > VEHICLE_HIDDEN || this.occluded?.(a.mesh.position, a.length, view) ? 'hidden' : near < VEHICLE_NEAR ? 0 : near < VEHICLE_FAR ? 1 : 2);
      if (a.rider) { a.rider.mesh.visible = a.mesh.visible && near < RIDER_HIDDEN; a.rider.setLevel(near < CAST_LOD.far ? 0 : near < CAST_LOD.distant * .5 ? 1 : 2); }
      if (!a.max) continue;
      const lane = this.lanes[a.lane];
      if (!a.active) {
        const clear = this.agents.every(b => b === a || b.lane !== a.lane || !b.active || b.s > a.length + 5);
        if (clear) { a.active = true; a.s = 0; a.mesh.visible = true; a.speed = a.max * .6; this.pose(a, 1); } else continue;
      }
      let target = a.max, gap = Infinity;
      // Distance ahead along the lane; on a loop it wraps, so the vehicle in front may be past the seam.
      const ahead = (s: number) => lane.closed ? ((s - a.s) % lane.length + lane.length) % lane.length : s - a.s;
      for (const b of this.agents) if (b !== a && b.lane === a.lane && b.active) { const d = ahead(b.s); if (d > 0 && (!lane.closed || d < lane.length / 2)) gap = Math.min(gap, d - (a.length + b.length) / 2); }
      for (const b of lane.shared()) { const d = ahead(b.s); if (d >= 0 && d < lane.length / 2) gap = Math.min(gap, d - (a.length + b.length) / 2); }
      target = Math.min(target, Math.max(0, (gap - 2.2) * .9));
      for (const stop of this.stops) if (stop.lane === a.lane && stop.active(time)) { let toLine = stop.s - a.s - a.length / 2; if (lane.closed && toLine < -lane.length / 2) toLine += lane.length; if (toLine > -.3 && toLine < 14) target = Math.min(target, Math.max(0, toLine * .8)); }
      const f = FORWARD.set(-Math.sin(a.mesh.rotation.y), 0, -Math.cos(a.mesh.rotation.y));
      const avoid = (o: THREE.Vector3, room: number) => {
        const rx = o.x - a.mesh.position.x, rz = o.z - a.mesh.position.z, front = rx * f.x + rz * f.z, side = Math.abs(rx * f.z - rz * f.x);
        if (front > 0 && front < a.length / 2 + room + 8 && side < 1.5) target = Math.min(target, Math.max(0, (front - a.length / 2 - room) * .9));
      };
      // The visitor and people on the road need a person's room; other vehicles their own half-length too.
      obstacles.forEach((o, k) => avoid(o, k === 0 ? 1.6 : 3.8)); for (const w of walkers) avoid(w, 1.6);
      const rate = target < a.speed ? 6 : 1.4; a.speed += THREE.MathUtils.clamp(target - a.speed, -rate * delta, rate * delta);
      a.s += a.speed * delta;
      if (lane.closed) a.s %= lane.length;
      else if (a.s >= lane.length) { a.active = false; a.mesh.visible = false; continue; }
      this.pose(a, 1 - Math.exp(-10 * delta));
      a.mesh.position.y = .02 + (a.kind === 'auto' || a.kind === 'bike' ? Math.sin(time * 13 + a.s) * .006 * Math.min(1, a.speed) : 0);
    }
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
