import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHuman, type Human } from '../npc/NPCFactory';
import { seededRandom } from '../StreetArchitecture';

/**
 * Mumbai street wardrobe layered onto the original skinned body: saris, salwar kameez,
 * kurtas, school uniforms, safety vests, head loads. Garments are skinned to the same
 * bones and merged into the body mesh, so each person stays one draw.
 */
export type Outfit = 'shirt' | 'office' | 'sari' | 'salwar' | 'kurta' | 'school' | 'worker' | 'dabbawala' | 'koli' | 'jogger' | 'elder' | 'vendor';
export interface CityPerson { group: THREE.Group; human: Human; outfit: Outfit; animate: (time: number, walking: boolean, seated?: boolean) => void; setDetail: (close: boolean) => void;
  /** 0 close, 1 street, 2 far (a ~300-triangle body on the same bones). */
  setLevel: (level: 0 | 1 | 2) => void }

// Bone indices from createHuman: 0 pelvis, 1 spine, 2 neck, 3 head; hips 4/7, knees 5/8; shoulders 10/13, elbows 11/14.
const PANTS = ['#495459', '#64695d', '#756b60'], HAIR = ['#292922', '#514337'];
interface Ring { y: number; x: number; z: number; cx?: number; cz?: number }

function loft(rings: Ring[], color: string, bone: number, next = bone, segments = 10) {
  const vertices: number[] = [], colors: number[] = [], skinIndex: number[] = [], skinWeight: number[] = [], uv: number[] = [], index: number[] = [], tint = new THREE.Color(color);
  for (let r = 0; r < rings.length; r++) {
    const p = rings[r], blend = next === bone ? 0 : r / (rings.length - 1);
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2;
      vertices.push((p.cx ?? 0) + Math.cos(a) * p.x, p.y, (p.cz ?? 0) + Math.sin(a) * p.z); colors.push(tint.r, tint.g, tint.b);
      skinIndex.push(bone, next, 0, 0); skinWeight.push(1 - blend, blend, 0, 0); uv.push(i / segments, r / Math.max(1, rings.length - 1));
      if (r < rings.length - 1 && i < segments) { const n = r * (segments + 1) + i; index.push(n, n + segments + 1, n + 1, n + 1, n + segments + 1, n + segments + 2); }
    }
  }
  return skinned(vertices, colors, skinIndex, skinWeight, uv, index);
}
/** A cloth band following a path over the body, both faces, e.g. a pallu or dupatta. */
function ribbon(path: THREE.Vector3[], width: number, color: string, bones: (p: THREE.Vector3) => number) {
  const vertices: number[] = [], colors: number[] = [], skinIndex: number[] = [], skinWeight: number[] = [], uv: number[] = [], index: number[] = [], tint = new THREE.Color(color);
  path.forEach((p, i) => {
    const t = path[Math.min(path.length - 1, i + 1)].clone().sub(path[Math.max(0, i - 1)]).normalize();
    const out = new THREE.Vector3(p.x, 0, p.z).normalize(), side = new THREE.Vector3().crossVectors(t, out).normalize().multiplyScalar(width / 2);
    for (const s of [-1, 1]) { const v = p.clone().addScaledVector(side, s).addScaledVector(out, .012); vertices.push(v.x, v.y, v.z); colors.push(tint.r, tint.g, tint.b); skinIndex.push(bones(p), 0, 0, 0); skinWeight.push(1, 0, 0, 0); uv.push(s < 0 ? 0 : 1, i / path.length); }
    if (i < path.length - 1) { const n = i * 2; index.push(n, n + 1, n + 2, n + 1, n + 3, n + 2, n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  });
  return skinned(vertices, colors, skinIndex, skinWeight, uv, index);
}
function skinned(vertices: number[], colors: number[], skinIndex: number[], skinWeight: number[], uv: number[], index: number[]) {
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)).setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    .setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)).setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4)).setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  g.setIndex(index); g.computeVertexNormals(); return g;
}
/** Swap one palette colour for another across a geometry's vertex colours. */
function recolor(g: THREE.BufferGeometry, from: string[], to: string, shade = [1, .82, .78, .75]) {
  const colors = g.getAttribute('color') as THREE.BufferAttribute, targets: Array<[THREE.Color, THREE.Color]> = [];
  for (const f of from) for (const s of shade) targets.push([new THREE.Color(f).multiplyScalar(s), new THREE.Color(to).multiplyScalar(s)]);
  for (let i = 0; i < colors.count; i++) for (const [a, b] of targets) if (Math.abs(colors.getX(i) - a.r) < .002 && Math.abs(colors.getY(i) - a.g) < .002 && Math.abs(colors.getZ(i) - a.b) < .002) { colors.setXYZ(i, b.r, b.g, b.b); break; }
}
const byHeight = (p: THREE.Vector3) => p.y > 1.2 ? 1 : 0;

interface Spec { top: string; bottom: string; garments: THREE.BufferGeometry[]; stride: number; pose?: 'headload' | 'phone' | 'hands-behind'; hair?: string }

function wardrobe(outfit: Outfit, random: () => number, detail: 'close' | 'street'): Spec {
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
  const seg = detail === 'close' ? 14 : 8, g: THREE.BufferGeometry[] = [];
  const skirt = (color: string, hem: number, flare: number, top = 1.0) => g.push(loft([{ y: top, x: .165, z: .11 }, { y: .86, x: .18, z: .13 }, { y: .5, x: .19 + flare * .4, z: .15 + flare * .3 }, { y: hem, x: .2 + flare, z: .17 + flare * .8 }], color, 0, 0, seg));
  const bun = (hair: string) => g.push(loft([{ y: 1.665, x: .001, z: .001, cz: .1 }, { y: 1.68, x: .045, z: .035, cz: .11 }, { y: 1.72, x: .05, z: .04, cz: .11 }, { y: 1.75, x: .001, z: .001, cz: .1 }], hair, 3, 3, seg));
  const braid = (hair: string) => g.push(loft([{ y: 1.7, x: .03, z: .02, cz: .085 }, { y: 1.5, x: .028, z: .022, cz: .11 }, { y: 1.25, x: .016, z: .014, cz: .13 }, { y: 1.18, x: .001, z: .001, cz: .13 }], hair, 3, 1, 6));
  const tunic = (color: string, hem: number) => g.push(loft([{ y: 1.43, x: .135, z: .09 }, { y: 1.34, x: .192, z: .118 }, { y: 1.2, x: .178, z: .114 }, { y: 1.0, x: .172, z: .112 }, { y: .86, x: .184, z: .126 }, { y: hem, x: .205, z: .145 }], color, 1, 0, seg));
  const cap = (color: string, kind: 'gandhi' | 'hard' | 'sport') => {
    if (kind === 'gandhi') g.push(loft([{ y: 1.745, x: .09, z: .082 }, { y: 1.8, x: .08, z: .03 }, { y: 1.815, x: .07, z: .004 }], color, 3, 3, seg));
    else if (kind === 'hard') g.push(loft([{ y: 1.72, x: .125, z: .13 }, { y: 1.745, x: .105, z: .11 }, { y: 1.8, x: .096, z: .098 }, { y: 1.845, x: .06, z: .06 }, { y: 1.86, x: .001, z: .001 }], color, 3, 3, seg));
    else g.push(loft([{ y: 1.74, x: .1, z: .095 }, { y: 1.79, x: .09, z: .085 }, { y: 1.82, x: .001, z: .001 }], color, 3, 3, seg), loft([{ y: 1.74, x: .07, z: .07, cz: -.1 }, { y: 1.745, x: .07, z: .07, cz: -.1 }], color, 3, 3, 6));
  };
  const load = (color: string, crate: boolean) => g.push(crate ? loft([{ y: 1.82, x: .2, z: .17 }, { y: 1.96, x: .21, z: .18 }, { y: 1.97, x: .001, z: .001 }], color, 3, 3, 4) : loft([{ y: 1.82, x: .12, z: .12 }, { y: 1.9, x: .25, z: .25 }, { y: 1.91, x: .23, z: .23 }, { y: 1.88, x: .001, z: .001 }], color, 3, 3, 10));
  const pallu = (color: string) => g.push(ribbon([new THREE.Vector3(.13, .98, -.12), new THREE.Vector3(.05, 1.15, -.13), new THREE.Vector3(-.08, 1.3, -.12), new THREE.Vector3(-.15, 1.43, -.06), new THREE.Vector3(-.16, 1.44, .05), new THREE.Vector3(-.13, 1.3, .12), new THREE.Vector3(-.1, 1.05, .14), new THREE.Vector3(-.08, .8, .16)], .2, color, byHeight));
  const dupatta = (color: string) => { for (const s of [-1, 1]) g.push(ribbon([new THREE.Vector3(s * .1, 1.44, .08), new THREE.Vector3(s * .14, 1.45, -.04), new THREE.Vector3(s * .12, 1.3, -.12), new THREE.Vector3(s * .11, 1.05, -.135), new THREE.Vector3(s * .11, .86, -.14)], .11, color, byHeight)); };
  const vest = (color: string) => g.push(loft([{ y: 1.42, x: .15, z: .1 }, { y: 1.33, x: .2, z: .125 }, { y: 1.15, x: .185, z: .121 }, { y: .98, x: .18, z: .12 }], color, 1, 1, seg));
  const bag = (color: string) => g.push(loft([{ y: 1.0, x: .12, z: .05, cz: .16 }, { y: 1.05, x: .13, z: .07, cz: .17 }, { y: 1.35, x: .12, z: .065, cz: .17 }, { y: 1.38, x: .001, z: .001, cz: .16 }], color, 1, 1, 6));
  const sari = pick(['#b8323f', '#d0742c', '#2e6f6a', '#7a3f8c', '#d6a72c', '#3d5aa8', '#c4507d']);
  switch (outfit) {
    case 'sari': { const hair = pick(HAIR); skirt(sari, .05, .05); pallu(new THREE.Color(sari).offsetHSL(.02, 0, .06).getStyle()); bun(hair); return { top: new THREE.Color(sari).offsetHSL(.45, -.1, -.05).getStyle(), bottom: sari, garments: g, stride: .45, hair }; }
    case 'koli': { const hair = pick(HAIR); skirt('#2f8f86', .4, .02); pallu('#e0603b'); bun(hair); load('#9b7a4a', false); return { top: '#d64b6a', bottom: '#2f8f86', garments: g, stride: .7, pose: 'headload', hair }; }
    case 'salwar': { const hair = pick(HAIR), kameez = pick(['#d98a9f', '#6aa39a', '#e2c070', '#8f84c9', '#e47f5b']); tunic(kameez, .47); dupatta(pick(['#f1e6d0', '#c9445b', '#3c6e9b'])); braid(hair); return { top: kameez, bottom: '#efe7d6', garments: g, stride: .8, hair }; }
    case 'kurta': { const kurta = pick(['#efe9dc', '#e6d3a4', '#b9c9d6', '#d8c3b2']); tunic(kurta, .5); return { top: kurta, bottom: '#ebe5d6', garments: g, stride: .9 }; }
    case 'elder': { tunic('#f0ece2', .52); return { top: '#f0ece2', bottom: '#e7e1d2', garments: g, stride: .6, pose: 'hands-behind', hair: '#c9c4b8' }; }
    case 'dabbawala': { tunic('#f2efe6', .62); cap('#f7f5ef', 'gandhi'); load('#7b5a3a', true); return { top: '#f2efe6', bottom: '#ece6d8', garments: g, stride: .95, pose: 'headload' }; }
    case 'school': { bag(pick(['#2f4a7d', '#7d2f3a', '#2e6b4a'])); return { top: '#f1f1ea', bottom: '#2c3550', garments: g, stride: 1 }; }
    case 'worker': { vest('#ef7b22'); cap('#e8c22b', 'hard'); return { top: pick(['#5f6f7d', '#7c6a55']), bottom: '#6c5f49', garments: g, stride: 1 }; }
    case 'jogger': { cap(pick(['#d33f3f', '#2c2f3a', '#f2f2ee']), 'sport'); return { top: pick(['#d84f4f', '#3f86c8', '#f2c94c', '#55b37c']), bottom: '#22252b', garments: g, stride: 1.25 }; }
    case 'vendor': { return { top: pick(['#c9b28a', '#9fb0a5', '#d3c3a5']), bottom: pick(['#5b5248', '#4c5660']), garments: g, stride: .8 }; }
    case 'office': { if (random() > .5) bag('#2b2b2e'); return { top: pick(['#e9edf2', '#bcd0e4', '#f2efe8', '#d9d2e6']), bottom: pick(['#23262d', '#3a3f4a', '#5a5246']), garments: g, stride: 1, pose: random() > .7 ? 'phone' : undefined }; }
    default: return { top: pick(['#8b968c', '#9c8279', '#788d80', '#b0a081', '#748b99', '#b76e5c']), bottom: pick(PANTS), garments: g, stride: 1 };
  }
}

export function createCityPerson(seed: string, outfit: Outfit, scale = 1): CityPerson {
  const random = seededRandom(`folk:${seed}`), spec = wardrobe(outfit, random, 'close'), far = wardrobe(outfit, seededRandom(`folk:${seed}`), 'street');
  const human = createHuman(seed, spec.top, 'close'), [closeBase, streetBase] = human.mesh.userData.lodGeometries as THREE.BufferGeometry[];
  const dress = (base: THREE.BufferGeometry, garments: THREE.BufferGeometry[]) => {
    const body = base.clone(); recolor(body, PANTS, spec.bottom); if (spec.hair) recolor(body, HAIR, spec.hair, [1]);
    if (!garments.length) return body;
    const merged = mergeGeometries([body, ...garments.map(g => { for (const k of Object.keys(g.attributes)) if (!body.hasAttribute(k)) g.deleteAttribute(k); return g; })])!;
    body.dispose(); garments.forEach(g => g.dispose()); return merged;
  };
  const close = dress(closeBase, spec.garments), street = dress(streetBase, far.garments);
  closeBase.dispose(); if (streetBase !== closeBase) streetBase.dispose();
  const distant = farBody(human, close, outfit, spec.top, spec.bottom, spec.hair ?? HAIR[0]);
  human.mesh.geometry = close; human.mesh.userData.lodGeometries = [close, street, distant];
  human.setDetail = (near: boolean) => { human.mesh.geometry = near ? close : street; };
  const levels = [close, street, distant], setLevel = (level: 0 | 1 | 2) => { human.mesh.geometry = levels[level]; };
  human.group.scale.multiplyScalar(scale);
  const b = human.bones;
  const animate = (time: number, walking: boolean, seated = false) => {
    human.animate(time, walking, seated);
    if (walking && !seated) for (const i of [4, 5, 7, 8]) b[i].rotation.x *= spec.stride;
    if (spec.pose === 'headload') { b[13].rotation.set(0, 0, 2.75); b[14].rotation.set(0, 0, 1.25); }
    else if (spec.pose === 'phone') { b[13].rotation.set(-.35, 0, .1); b[14].rotation.set(-2.2, 0, .3); }
    else if (spec.pose === 'hands-behind') { for (const [s, i] of [[-1, 10], [1, 13]]) { b[i].rotation.set(.45, 0, -s * .2); b[i + 1].rotation.set(.9, 0, 0); } }
  };
  return { group: human.group, human, outfit, animate, setDetail: human.setDetail, setLevel };
}

/**
 * The distant body: tapered five-sided limbs, torso and head skinned rigidly to the same bones,
 * in the outfit's colours. Past ~20 m it reads the same as the full body for a sixth of the cost.
 */
function farBody(human: Human, close: THREE.BufferGeometry, outfit: Outfit, top: string, bottom: string, hair: string) {
  const bind = human.mesh.skeleton.boneInverses.map(m => new THREE.Vector3().setFromMatrixPosition(m.clone().invert()));
  // Skin tone from the close body's head vertices.
  const index = close.getAttribute('skinIndex'), color = close.getAttribute('color'); let skin = new THREE.Color('#8a5a40');
  for (let i = 0; i < index.count; i++) if (index.getX(i) === 3 && close.getAttribute('skinWeight').getX(i) > .99) { skin = new THREE.Color(color.getX(i), color.getY(i), color.getZ(i)); break; }
  const parts: THREE.BufferGeometry[] = [];
  const limb = (a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, tint: THREE.Color | string, bone: number, sides = 5) => {
    const length = a.distanceTo(b), g = new THREE.CylinderGeometry(rb, ra, length, sides, 1, false).toNonIndexed();
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    const n = g.getAttribute('position').count, c = new THREE.Color(tint), colors = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { colors.set([c.r, c.g, c.b], i * 3); si[i * 4] = bone; sw[i * 4] = 1; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    parts.push(g);
  };
  const up = (v: THREE.Vector3, dy: number) => v.clone().setY(v.y + dy);
  const [pelvis, , neck, head] = bind, long = outfit === 'sari' || outfit === 'salwar' || outfit === 'kurta';
  for (const [hip, knee, ankle, shoulder, elbow, wrist] of [[4, 5, 6, 10, 11, 12], [7, 8, 9, 13, 14, 15]].map(l => l.map(i => bind[i]))) {
    const side = hip === bind[4] ? 0 : 1;
    limb(hip, knee, .085, .065, bottom, 4 + side * 3); limb(knee, ankle, .062, .048, bottom, 5 + side * 3);
    limb(up(ankle, -.02), up(ankle, -.06).setZ(ankle.z + .13), .05, .045, '#2a2622', 6 + side * 3, 4);
    limb(shoulder, elbow, .058, .05, top, 10 + side * 3); limb(elbow, wrist, .046, .04, outfit === 'office' || outfit === 'kurta' || outfit === 'elder' ? top : skin, 11 + side * 3);
    limb(wrist, up(wrist, -.09), .038, .03, skin, 12 + side * 3, 4);
  }
  limb(up(pelvis, -.08), up(pelvis, .12), .16, .17, bottom, 0, 6);
  limb(up(pelvis, .1), up(neck, -.06), .17, .2, top, 1, 6);
  limb(up(neck, -.08), up(neck, .06), .055, .05, skin, 2, 5);
  limb(up(head, -.02), up(head, .19), .085, .09, skin, 3, 6);
  limb(up(head, .14), up(head, .25), .1, .02, hair, 3, 6);
  // Long garments: a sari or kameez flares from the waist past the knee.
  if (long) limb(up(pelvis, .05), up(bind[5], outfit === 'sari' ? -.38 : -.05), .18, outfit === 'sari' ? .25 : .22, outfit === 'salwar' || outfit === 'kurta' ? top : top, 0, 7);
  const merged = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); merged.computeVertexNormals();
  // Keep the attribute set identical to the full body (uv may be sampled by the shared material).
  for (const [name, attribute] of Object.entries(close.attributes)) if (!merged.hasAttribute(name)) merged.setAttribute(name, new THREE.BufferAttribute(new (attribute.array.constructor as Float32ArrayConstructor)(merged.getAttribute('position').count * attribute.itemSize), attribute.itemSize));
  return merged;
}
