import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCityPerson, type CityPerson, type Outfit } from './CityFolk';
import { VEHICLE_LENGTH, VEHICLE_SPEED, type CityVehicleKind, createCityVehicleLod, setVehicleDetail } from './CityVehicles';
import type { V3 } from './ColorMesh';

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
/** A gently heaving sea or lake surface, updated on the CPU only while its district is drawn. */
export class Water {
  readonly mesh: THREE.Mesh; private base: Float32Array;
  constructor(width: number, depth: number, center: V3, color: string, private amplitude = .14, segments = 56) {
    const g = new THREE.PlaneGeometry(width, depth, segments, segments); g.rotateX(-Math.PI / 2);
    this.base = (g.getAttribute('position').array as Float32Array).slice();
    const material = new THREE.MeshStandardMaterial({ color, roughness: .16, metalness: .08, envMapIntensity: .9 }); material.userData.surface = 'glass';
    this.mesh = new THREE.Mesh(g, material); this.mesh.position.set(...center); this.mesh.receiveShadow = true; this.mesh.name = 'district:water';
  }
  update(time: number) {
    const p = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute, a = this.amplitude;
    for (let i = 0; i < p.count; i++) {
      const x = this.base[i * 3], z = this.base[i * 3 + 2];
      p.setY(i, a * (Math.sin(x * .21 + time * .9) + .6 * Math.sin(z * .33 - time * 1.3 + x * .07) + .35 * Math.sin((x + z) * .9 + time * 2.1)));
    }
    p.needsUpdate = true; this.mesh.geometry.computeVertexNormals();
  }
}

/* ------------------------------------------------------------------ people */
type Act = 'stand' | 'sit' | 'talk' | 'bowl' | 'bat' | 'wave' | 'sell';
interface Walker { person: CityPerson; path: THREE.Vector3[]; lengths: number[]; total: number; s: number; speed: number; dir: number; pause: number; loop: boolean }
interface Idler { person: CityPerson; act: Act; phase: number }
/** Scripted pedestrians: walkers follow authored pavement paths, idlers hold a pose or a small loop. */
export class Crowd {
  readonly group = new THREE.Group(); private walkers: Walker[] = []; private idlers: Idler[] = []; private frame = 0; private count = 0;
  walker(outfit: Outfit, path: V3[], speed = 1, start = Math.random(), loop = false, scale = 1) {
    const person = this.make(outfit, scale), pts = path.map(p => new THREE.Vector3(...p)), lengths = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
    const total = lengths.reduce((a, b) => a + b, 0), w: Walker = { person, path: pts, lengths, total, s: start * total, speed, dir: this.count % 2 ? 1 : -1, pause: 0, loop };
    this.walkers.push(w); this.place(w); return person;
  }
  idle(outfit: Outfit, position: V3, yaw: number, act: Act = 'stand', scale = 1) {
    const person = this.make(outfit, scale); person.group.position.set(...position); person.group.rotation.y = yaw; if (act === 'sit') person.group.position.y -= .45;
    if (act === 'bat') { const bat = new THREE.Mesh(new THREE.BoxGeometry(.07, .75, .03).translate(0, -.42, 0), new THREE.MeshStandardMaterial({ color: '#c9a66b', roughness: .7 })); bat.castShadow = true; person.human.bones[15].add(bat); }
    this.idlers.push({ person, act, phase: this.count * 1.7 }); return person;
  }
  private make(outfit: Outfit, scale: number) { const p = createCityPerson(`${outfit}:${this.count++}:${this.group.uuid.slice(0, 4)}`, outfit, scale); this.group.add(p.group); return p; }
  private place(w: Walker) {
    let s = w.s, i = 0; while (i < w.lengths.length - 1 && s > w.lengths[i]) { s -= w.lengths[i]; i++; }
    const a = w.path[i], b = w.path[i + 1], t = w.lengths[i] ? Math.min(1, s / w.lengths[i]) : 0;
    w.person.group.position.lerpVectors(a, b, t); const d = b.clone().sub(a).multiplyScalar(w.dir);
    const yaw = Math.atan2(-d.x, -d.z), turn = Math.atan2(Math.sin(yaw - w.person.group.rotation.y), Math.cos(yaw - w.person.group.rotation.y)); w.person.group.rotation.y += turn * .2;
  }
  update(time: number, delta: number, view: THREE.Vector3) {
    this.frame++;
    for (const w of this.walkers) {
      const g = w.person.group, ahead = new THREE.Vector3(-Math.sin(g.rotation.y), 0, -Math.cos(g.rotation.y)), rel = view.clone().setY(0).sub(g.position);
      const blocked = rel.length() < 1.6 && rel.dot(ahead) > 0;
      if (w.pause > 0) w.pause -= delta;
      else if (!blocked) {
        w.s += w.dir * w.speed * delta;
        if (w.s > w.total || w.s < 0) { if (w.loop) w.s = (w.s + w.total) % w.total; else { w.dir *= -1; w.s = THREE.MathUtils.clamp(w.s, 0, w.total); w.pause = 1 + (w.total % 3); } }
      }
      this.place(w);
      // Step around the visitor instead of walking through them.
      const gap = Math.hypot(view.x - g.position.x, view.z - g.position.z);
      if (gap < 1.6) { const ax = g.position.x - view.x, az = g.position.z - view.z, n = Math.max(gap, .01); g.position.x += ax / n * (1.6 - gap); g.position.z += az / n * (1.6 - gap); }
      this.lod(w.person, time, w.pause <= 0 && !blocked, false, view);
    }
    for (const i of this.idlers) {
      const g = i.person.group; if (!this.lod(i.person, time, false, i.act === 'sit', view)) continue;
      const b = i.person.human.bones, t = time + i.phase;
      if (i.act === 'talk') { b[13].rotation.x = -.5 + Math.sin(t * 2.3) * .25; b[14].rotation.x = -.9; b[3].rotation.y = Math.sin(t * .8) * .3; }
      else if (i.act === 'wave') { b[13].rotation.z = 2.4 + Math.sin(t * 6) * .25; b[14].rotation.z = .4; }
      else if (i.act === 'sell') { b[10].rotation.x = -.7; b[11].rotation.x = -.8; b[13].rotation.x = -.6 + Math.sin(t * 1.5) * .2; b[14].rotation.x = -.9; }
      else if (i.act === 'bowl') { const c = (t * .55) % 1; b[13].rotation.x = c < .5 ? -c * 2 * Math.PI * 1.1 : 0; g.rotation.x = 0; }
      else if (i.act === 'bat') { const c = (time * .55 + .45) % 1; const swing = c < .2 ? -c * 8 : 0; for (const k of [10, 13]) { b[k].rotation.x = -.6 + swing; b[k].rotation.z = 0; } b[1].rotation.y = c < .2 ? -c * 4 : 0; }
    }
  }
  /** Distance LOD; returns whether the person should animate this frame. */
  private lod(p: CityPerson, time: number, walking: boolean, seated: boolean, view: THREE.Vector3) {
    const d = p.group.position.distanceTo(view); p.human.mesh.visible = d < 70; p.setLevel(d < 9 ? 0 : d < 20 ? 1 : 2);
    if (!p.human.mesh.visible) return false;
    if (d > 22 && (this.frame + p.group.id) % 3) return false;
    p.animate(time, walking, seated); return true;
  }
  people() { return [...this.walkers.map(w => w.person), ...this.idlers.map(i => i.person)]; }
  get size() { return this.walkers.length + this.idlers.length; }
}

/* ------------------------------------------------------------------ traffic */
interface Agent { mesh: THREE.Mesh; kind: CityVehicleKind; lane: number; s: number; speed: number; max: number; length: number; active: boolean }
/**
 * Mixed Mumbai traffic on authored lane curves that enter and leave by side streets.
 * Vehicles keep length-aware gaps, queue behind slow handcarts and stop for the visitor.
 */
export class LaneTraffic {
  readonly group = new THREE.Group(); private lanes: Array<{ curve: THREE.CatmullRomCurve3; length: number }> = []; private agents: Agent[] = [];
  private stops: Array<{ lane: number; s: number; active: (time: number) => boolean }> = [];
  /** A stop line on a lane at local `z`, held while `active(time)` (a pedestrian green). */
  stopLine(lane: number, z: number, active: (time: number) => boolean) {
    const { curve, length } = this.lanes[lane]; let best = 0, bestGap = Infinity;
    for (let i = 0; i <= 400; i++) { const gap = Math.abs(curve.getPointAt(i / 400).z - z); if (gap < bestGap) { bestGap = gap; best = i / 400; } }
    this.stops.push({ lane, s: best * length, active });
  }
  /** Positions of the vehicles currently on the road (for other traffic to queue behind). */
  get positions() { return this.agents.filter(a => a.active && a.mesh.visible).map(a => a.mesh.position); }
  lane(points: V3[]) { const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal'); this.lanes.push({ curve, length: curve.getLength() }); return this.lanes.length - 1; }
  vehicle(lane: number, kind: CityVehicleKind, at: number, seed: string, parked = false) {
    const mesh = createCityVehicleLod(kind, seed); this.group.add(mesh);
    const a: Agent = { mesh, kind, lane, s: at * this.lanes[lane].length, speed: 0, max: parked ? 0 : VEHICLE_SPEED[kind] * (.85 + (seed.length % 5) * .06), length: VEHICLE_LENGTH[kind], active: true };
    this.agents.push(a); this.pose(a, 1); return mesh;
  }
  private pose(a: Agent, blend: number) {
    const lane = this.lanes[a.lane], t = THREE.MathUtils.clamp(a.s / lane.length, 0, 1), p = lane.curve.getPointAt(t), d = lane.curve.getTangentAt(t);
    a.mesh.position.set(p.x, .02, p.z); const yaw = Math.atan2(-d.x, -d.z), turn = Math.atan2(Math.sin(yaw - a.mesh.rotation.y), Math.cos(yaw - a.mesh.rotation.y));
    a.mesh.rotation.y += turn * blend;
  }
  update(time: number, delta: number, obstacles: THREE.Vector3[]) {
    const view = obstacles[0];
    for (const a of this.agents) {
      if (view) setVehicleDetail(a.mesh as THREE.Mesh, a.mesh.position.distanceToSquared(view) < 32 * 32);
      if (!a.max) continue;
      const lane = this.lanes[a.lane];
      if (!a.active) {
        const clear = this.agents.every(b => b === a || b.lane !== a.lane || !b.active || b.s > a.length + 5);
        if (clear) { a.active = true; a.s = 0; a.mesh.visible = true; a.speed = a.max * .6; this.pose(a, 1); } else continue;
      }
      let target = a.max, gap = Infinity;
      for (const b of this.agents) if (b !== a && b.lane === a.lane && b.active && b.s > a.s) gap = Math.min(gap, b.s - a.s - (a.length + b.length) / 2);
      target = Math.min(target, Math.max(0, (gap - 2.2) * .9));
      for (const stop of this.stops) if (stop.lane === a.lane && stop.active(time)) { const toLine = stop.s - a.s - a.length / 2; if (toLine > -.3 && toLine < 14) target = Math.min(target, Math.max(0, toLine * .8)); }
      const f = new THREE.Vector3(-Math.sin(a.mesh.rotation.y), 0, -Math.cos(a.mesh.rotation.y));
      obstacles.forEach((o, k) => {
        // The first obstacle is the visitor; the rest are other vehicles, which need their own half-length of room.
        const rel = o.clone().setY(0).sub(a.mesh.position.clone().setY(0)), ahead = rel.dot(f), side = Math.abs(rel.x * f.z - rel.z * f.x), room = k === 0 ? 1.6 : 3.8;
        if (ahead > 0 && ahead < a.length / 2 + room + 8 && side < 1.5) target = Math.min(target, Math.max(0, (ahead - a.length / 2 - room) * .9));
      });
      const rate = target < a.speed ? 6 : 1.4; a.speed += THREE.MathUtils.clamp(target - a.speed, -rate * delta, rate * delta);
      a.s += a.speed * delta;
      if (a.s >= lane.length) { a.active = false; a.mesh.visible = false; continue; }
      this.pose(a, 1 - Math.exp(-10 * delta));
      a.mesh.position.y = .02 + (a.kind === 'auto' || a.kind === 'bike' ? Math.sin(time * 13 + a.s) * .006 * Math.min(1, a.speed) : 0);
    }
  }
  get size() { return this.agents.length; }
}
