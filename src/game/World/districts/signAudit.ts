import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { District } from './District';
import type { SignRecord } from './DistrictSystems';

/**
 * Sign audit: can a visitor on foot read each Tier-1 sign, and is any sign buried in or covered by geometry?
 * Pure geometry, no renderer: `hit` is a ray cast against the district's visible meshes (minus the signs and glass).
 */
export interface SignAuditOptions {
  /** Ray cast from `origin` along unit `direction`; the distance of the first hit within `max`, or null. */
  hit: (origin: THREE.Vector3, direction: THREE.Vector3, max: number) => number | null;
  /** Eye positions a visitor can stand at (district-local). */
  viewers: THREE.Vector3[];
  /** Viewport height in pixels and vertical field of view in degrees of the game camera. */
  viewportHeight?: number; fov?: number;
  /** A sign is legible from a viewer when its face is at least this many pixels tall there. */
  minPixels?: number;
  /** Signs further than this are not counted as read (metres). */
  maxDistance?: number;
}

export interface SignVerdict {
  text: string; tier: 1 | 2 | 3;
  /** Face samples with geometry within 0.35 m in front of them (out of 9): something standing over the sign. */
  covered: number;
  /** Face samples with geometry within 0.1 m in front (out of 9): the sign is buried in or cut by something. */
  embedded: number;
  /** The best view: distance, the face's height on screen in pixels, and how many of its 9 samples were in sight. */
  best: { distance: number; pixels: number; samples: number } | null;
  status: 'PASS' | 'FAIL';
  reason?: string;
}

/** 3 × 3 sample points across the sign face, inset from its edges. */
export function faceSamples(r: SignRecord) {
  const up = r.normal.clone().cross(r.right), out: THREE.Vector3[] = [];
  for (const a of [-.35, 0, .35]) for (const b of [-.3, 0, .3]) out.push(r.center.clone().addScaledVector(r.right, a * r.width).addScaledVector(up, b * r.height));
  return out;
}

/** Most samples that may be covered before a sign counts as embedded or hidden behind something in front of it. */
const MAX_COVERED = 1;
/** Samples that must be in sight from one viewer for the sign to count as seen. */
const MIN_SAMPLES = 6;
/** Steepest look up (degrees) at which a sign is still read with the camera level, and the most oblique side view. */
const MAX_ELEVATION = 32, MAX_OBLIQUE = 72;

export function auditSign(r: SignRecord, o: SignAuditOptions): SignVerdict {
  const { hit, viewers, viewportHeight = 720, fov = 68, minPixels = 24, maxDistance = 45 } = o;
  const focal = viewportHeight / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2)), samples = faceSamples(r);
  // Embedded: geometry within 0.35 m in front of the face (a wall the sign sits behind, a box it is buried in).
  const ahead = samples.map(s => hit(s.clone().addScaledVector(r.normal, .004), r.normal, .35));
  const covered = ahead.filter(d => d !== null).length, embedded = ahead.filter(d => d !== null && d < .1).length;
  let best: SignVerdict['best'] = null;
  const toSign = new THREE.Vector3(), dir = new THREE.Vector3();
  for (const v of viewers) {
    toSign.subVectors(r.center, v); const distance = toSign.length();
    if (distance > maxDistance || distance < .5) continue;
    const facing = -toSign.dot(r.normal) / distance;
    if (facing < Math.cos(THREE.MathUtils.degToRad(MAX_OBLIQUE))) continue;
    if (Math.asin(THREE.MathUtils.clamp(toSign.y / distance, -1, 1)) > THREE.MathUtils.degToRad(MAX_ELEVATION)) continue;
    const pixels = r.height / distance * focal;
    if (pixels < minPixels || (best && pixels <= best.pixels)) continue;
    let seen = 0;
    for (const s of samples) { dir.subVectors(s, v); const d = dir.length(); dir.divideScalar(d); if (hit(v, dir, d - .05) === null) seen++; }
    if (seen >= MIN_SAMPLES) best = { distance, pixels, samples: seen };
  }
  const reason = covered > MAX_COVERED ? `${covered} of 9 face samples covered by geometry in front of the sign` : !best ? `not legible from any walkable point (needs ${MIN_SAMPLES}/9 samples in sight, ${minPixels} px tall, within ${MAX_ELEVATION}° up and ${MAX_OBLIQUE}° to the side)` : undefined;
  return { text: r.text, tier: r.tier, covered, embedded, best, status: reason ? 'FAIL' : 'PASS', reason };
}

/** Eye-height viewer points on a grid over the walkable box, skipping any inside a solid. */
export function walkableViewers(inside: (p: THREE.Vector3) => boolean, box = { minX: -19, maxX: 19, minZ: -63, maxZ: 20 }, step = 2, eye = 1.6) {
  const out: THREE.Vector3[] = [];
  for (let x = box.minX + step / 2; x < box.maxX; x += step) for (let z = box.minZ + step / 2; z < box.maxZ; z += step) {
    const p = new THREE.Vector3(x, eye, z);
    if (!inside(new THREE.Vector3(x, .9, z)) && !inside(p)) out.push(p);
  }
  return out;
}

/**
 * Ray casts against what a visitor sees under `root` (in `root`'s frame): every mesh except those `skip` names,
 * transparent ones (glass, water) and skinned people.
 */
export function meshOccluder(root: THREE.Object3D, skip: (o: THREE.Object3D) => boolean) {
  const parts: THREE.BufferGeometry[] = [];
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const visit = (o: THREE.Object3D) => {
    if (skip(o) || o instanceof THREE.SkinnedMesh) return;
    if (o instanceof THREE.Mesh && o.geometry.getAttribute('position') && !(o.material as THREE.Material).transparent) {
      const local = new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld), count = o instanceof THREE.InstancedMesh ? o.count : 1, im = new THREE.Matrix4();
      // Plain float positions only, so parts from quantised or interleaved models merge with the rest.
      const source = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, at = source.getAttribute('position'), xyz = new Float32Array(at.count * 3);
      for (let i = 0; i < at.count; i++) { xyz[i * 3] = at.getX(i); xyz[i * 3 + 1] = at.getY(i); xyz[i * 3 + 2] = at.getZ(i); }
      if (source !== o.geometry) source.dispose();
      const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(xyz, 3));
      for (let i = 0; i < count; i++) { const m = local.clone(); if (o instanceof THREE.InstancedMesh) { o.getMatrixAt(i, im); m.multiply(im); } parts.push(g.clone().applyMatrix4(m)); }
      g.dispose();
    }
    o.children.forEach(visit);
  };
  root.children.forEach(visit);
  const geometry = mergeGeometries(parts)!, bvh = new MeshBVH(geometry), ray = new THREE.Ray(); parts.forEach(p => p.dispose());
  return (origin: THREE.Vector3, direction: THREE.Vector3, max: number) => { ray.set(origin, direction); return bvh.raycastFirst(ray, THREE.DoubleSide, 0, max)?.distance ?? null; };
}

/** A district's occluder: everything but its signs, glass, crowd and traffic. */
export const districtOccluder = (d: District) => meshOccluder(d.group, o => o === d.crowd.group || o === d.traffic.group || /signs|exhibits|glass/.test(o.name));

/** Whether a point (in the frame offset by `origin` from the physics world) is inside any static box body. */
export function insideBodies(bodies: CANNON.Body[], origin = new THREE.Vector3()) {
  const boxes = bodies.filter(b => b.mass === 0 && b.shapes[0] instanceof CANNON.Box).map(b => ({ b, half: (b.shapes[0] as CANNON.Box).halfExtents })), q = new CANNON.Vec3();
  return (p: THREE.Vector3) => boxes.some(({ b, half }) => {
    b.pointToLocalFrame(new CANNON.Vec3(p.x + origin.x, p.y + origin.y, p.z + origin.z), q);
    return Math.abs(q.x) < half.x + .2 && Math.abs(q.y) < half.y && Math.abs(q.z) < half.z + .2;
  });
}

/** Viewer points in a built district: the walkable grid minus anything inside its solids. */
export const districtViewers = (d: District) => walkableViewers(insideBodies(d.kit.bodies, d.origin));
