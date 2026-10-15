import * as THREE from 'three';

/**
 * Moving things the visitor must not walk through: vehicles (an oriented footprint) and people (a circle).
 * They have no physics bodies, so after each physics step the visitor is pushed back out of them.
 */
export interface Blocker {
  x: number; z: number;
  /** Heading as `rotation.y` (forward is −Z rotated by it). Ignored for round blockers. */
  yaw: number;
  /** Half extents along the vehicle's length and width; for a person both equal the radius. */
  halfLength: number; halfWidth: number;
  round?: boolean;
}

/** A person's footprint radius in metres. */
export const PERSON_RADIUS = .3;

const box = new THREE.Box3(), inverse = new THREE.Matrix4(), relative = new THREE.Matrix4();

/**
 * Half length and half width of an object's footprint in its own frame (length along local Z), measured once
 * from its meshes and cached. Vehicles swap LOD geometry, so the measurement uses the first geometry seen.
 */
export function footprint(object: THREE.Object3D): { halfLength: number; halfWidth: number } {
  const cached = object.userData.footprint as { halfLength: number; halfWidth: number } | undefined;
  if (cached) return cached;
  object.updateMatrixWorld(true); inverse.copy(object.matrixWorld).invert();
  const bounds = new THREE.Box3();
  object.traverse(o => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    relative.multiplyMatrices(inverse, mesh.matrixWorld); bounds.union(box.copy(mesh.geometry.boundingBox!).applyMatrix4(relative));
  });
  const size = bounds.isEmpty() ? { halfLength: 1, halfWidth: .5 } : {
    // Footprints are centred on the object's origin: vehicles are authored around it.
    halfLength: Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)), halfWidth: Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
  };
  object.userData.footprint = size; return size;
}

/** A blocker for a vehicle-like object at its current pose. */
export function vehicleBlocker(object: THREE.Object3D, halfLength?: number, halfWidth?: number, offsetX = 0): Blocker {
  const f = halfLength === undefined || halfWidth === undefined ? footprint(object) : { halfLength, halfWidth };
  object.getWorldPosition(scratch);
  return { x: scratch.x + offsetX, z: scratch.z, yaw: object.rotation.y, halfLength: f.halfLength, halfWidth: f.halfWidth };
}
const scratch = new THREE.Vector3();

export function personBlocker(x: number, z: number, radius = PERSON_RADIUS): Blocker {
  return { x, z, yaw: 0, halfLength: radius, halfWidth: radius, round: true };
}

/**
 * Move a circle of `radius` at `p` out of every blocker it overlaps and cancel the velocity heading into it.
 * Returns true when the position changed.
 */
export function resolveBlockers(p: { x: number; z: number }, radius: number, blockers: Blocker[], velocity?: { x: number; z: number }) {
  let moved = false;
  for (const b of blockers) {
    let nx = 0, nz = 0, depth = 0;
    if (b.round) {
      const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz), reach = radius + b.halfLength;
      if (d >= reach) continue;
      if (d < 1e-6) { nx = 1; nz = 0; } else { nx = dx / d; nz = dz / d; }
      depth = reach - d;
    } else {
      // Local axes: forward (length) is (−sin, −cos), right (width) is (cos, −sin).
      const s = Math.sin(b.yaw), c = Math.cos(b.yaw), dx = p.x - b.x, dz = p.z - b.z;
      const along = -dx * s - dz * c, across = dx * c - dz * s;
      const cx = THREE.MathUtils.clamp(along, -b.halfLength, b.halfLength), cy = THREE.MathUtils.clamp(across, -b.halfWidth, b.halfWidth);
      const ox = along - cx, oy = across - cy, outside = Math.hypot(ox, oy);
      let la = 0, lw = 0;
      if (outside > 1e-6) { if (outside >= radius) continue; la = ox / outside; lw = oy / outside; depth = radius - outside; }
      else {
        // Centre inside the footprint: leave by the nearest side.
        const toEnd = b.halfLength - Math.abs(along), toSide = b.halfWidth - Math.abs(across);
        if (toSide <= toEnd) { lw = across < 0 ? -1 : 1; depth = toSide + radius; } else { la = along < 0 ? -1 : 1; depth = toEnd + radius; }
      }
      nx = -la * s + lw * c; nz = -la * c - lw * s;
    }
    p.x += nx * depth; p.z += nz * depth; moved = true;
    if (velocity) { const into = velocity.x * nx + velocity.z * nz; if (into < 0) { velocity.x -= into * nx; velocity.z -= into * nz; } }
  }
  return moved;
}
