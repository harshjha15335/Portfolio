import * as THREE from 'three';
import type { CastFigure, DistrictCast } from './DistrictCast';
import { solveTwoBone } from '../npc/DriverRig';

/**
 * Freezing a cast member into a static pose: the shared driver rig is posed (clip plus any adjustment), every vertex
 * is CPU-skinned once, and the rig is put back exactly as it was. Used for the Talkies audience (seated, standing,
 * clapping) and for riders holding a handlebar or a steering wheel: static people cost no bone texture and no skinning.
 */
export type RigBones = (name: RegExp) => THREE.Bone | undefined;

/** Bones of a figure's driver rig by name pattern (Rocketbox names such as `Bip01_L_UpperArm`). */
export function rigBones(figure: CastFigure): RigBones {
  const bones: THREE.Bone[] = []; figure.rig.traverse(o => { if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone); });
  return name => bones.find(b => name.test(b.name));
}

/** Rig space → the figure's person space (feet on y = 0, facing −Z, scaled to height): where poses are authored. */
export function personFromRig(figure: CastFigure) { return figure.mesh.matrix.clone().multiply(figure.mesh.bindMatrixInverse); }

/**
 * Bake `figure` at LOD `level` into an unskinned geometry. `pose` adjusts the rig first (it may move any bones; all
 * are restored afterwards); `place` maps person space to the space the baked geometry should live in.
 */
export function bakeFigure(cast: DistrictCast, figure: CastFigure, level: 0 | 1 | 2, place = new THREE.Matrix4(), pose?: (bones: RigBones, toRig: THREE.Matrix4) => void) {
  cast.update(0);
  const mesh = figure.mesh, source = cast.variant(figure.member, figure.driverIndex)[level], rig = figure.rig;
  const saved: Array<[THREE.Bone, THREE.Quaternion]> = []; rig.traverse(o => { if ((o as THREE.Bone).isBone) saved.push([o as THREE.Bone, (o as THREE.Bone).quaternion.clone()]); });
  rig.updateMatrixWorld(true);
  if (pose) { pose(rigBones(figure), personFromRig(figure).invert()); rig.updateMatrixWorld(true); }
  mesh.skeleton.update();
  const lift = place.clone().multiply(mesh.matrix);
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
  for (const [bone, q] of saved) bone.quaternion.copy(q);
  rig.updateMatrixWorld(true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(out, 3));
  if (nor) geometry.setAttribute('normal', new THREE.BufferAttribute(outN, 3));
  // Copies, not shared: disposing a baked body must not free the cast's own GPU buffers.
  for (const name of ['uv', 'color']) { const a = source.getAttribute(name); if (a) geometry.setAttribute(name, copyAttribute(a)); }
  geometry.setIndex(source.index ? source.index.clone() : null); geometry.computeBoundingSphere();
  return geometry;
}

/** A plain (de-interleaved) copy of a vertex attribute. */
function copyAttribute(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.BufferAttribute(out, a.itemSize);
}

/** Turn a bone about an axis given in person space (e.g. lean a spine forward), keeping its children attached. */
export function turnBone(bone: THREE.Bone, toRig: THREE.Matrix4, axis: THREE.Vector3, angle: number) {
  const rigAxis = axis.clone().transformDirection(toRig).normalize();
  const parent = bone.parent!.getWorldQuaternion(new THREE.Quaternion()), world = bone.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parent.invert().multiply(new THREE.Quaternion().setFromAxisAngle(rigAxis, angle).multiply(world))); bone.updateMatrixWorld(true);
}

const SIDES = ['L', 'R'] as const;
/** Bring both hands to person-space points (left hand first), wrists straight and fingers closed round a grip. */
export function gripWith(bones: RigBones, toRig: THREE.Matrix4, hands: [THREE.Vector3, THREE.Vector3], curl = 1, thumb = .5) {
  SIDES.forEach((side, i) => {
    const upper = bones(new RegExp(`_${side}_UpperArm$`)), fore = bones(new RegExp(`_${side}_Forearm$`)), hand = bones(new RegExp(`_${side}_Hand$`));
    if (!upper || !fore || !hand) return;
    solveTwoBone(upper, fore, hand, hands[i].clone().applyMatrix4(toRig));
    for (let n = 1; n <= 4; n++) for (const k of ['', `${n}`, '2']) { const f = bones(new RegExp(`_${side}_Finger${n}${k}$`)); if (f) f.rotation.z += curl; }
    for (const k of ['0', '01', '02']) { const f = bones(new RegExp(`_${side}_Finger${k}$`)); if (f) f.rotation.z += thumb; }
    hand.updateMatrixWorld(true);
  });
}

/** Two-bone reach for a leg (thigh, calf, foot) to a person-space ankle point. */
export function footOn(bones: RigBones, toRig: THREE.Matrix4, side: 'L' | 'R', at: THREE.Vector3) {
  const thigh = bones(new RegExp(`_${side}_Thigh$`)), calf = bones(new RegExp(`_${side}_Calf$`)), foot = bones(new RegExp(`_${side}_Foot$`));
  if (thigh && calf && foot) solveTwoBone(thigh, calf, foot, at.clone().applyMatrix4(toRig));
}
