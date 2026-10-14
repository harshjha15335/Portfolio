import * as THREE from 'three';
import type { AssetLease, GLBAssetLibrary } from '../assets/GLBAssetLibrary';
import { measureGroundSpeed } from '../assets/GLBCharacter';
import { loadable, placementNoise, type CastMember } from '../npc/cast';
import type { Outfit } from './CityFolk';

/**
 * The licensed Rocketbox street cast, shared by every district crowd.
 *
 * Each person is a SkinnedMesh on the cast's own geometry and material (the same objects the
 * CST street uses, so no texture or shader is added), but none owns a skeleton. A few
 * off-screen "driver" rigs per character play Walk, Idle, Talk or Sit at different phases and
 * rates, and every person binds to one of them through a single combined skeleton. The whole
 * district crowd therefore costs one bone texture instead of one per person.
 */
export type CastAct = 'walk' | 'idle' | 'talk' | 'sit';
const DRIVERS: Array<{ act: CastAct; rate: number; phase: number }> = [
  { act: 'walk', rate: .95, phase: 0 }, { act: 'walk', rate: 1.06, phase: .5 },
  { act: 'idle', rate: 1, phase: 0 }, { act: 'idle', rate: .9, phase: .45 },
  { act: 'talk', rate: 1, phase: .15 }, { act: 'talk', rate: .93, phase: .6 },
  { act: 'sit', rate: 1, phase: .3 },
];
/** Who can play each wardrobe role; neighbours are given different people where possible. */
const CASTING: Record<Outfit, string[]> = {
  shirt: ['host', 'taxi-driver', 'office-man', 'commuter'], office: ['office-man', 'office-woman', 'clerk', 'host'],
  sari: ['clerk', 'shopper', 'office-woman'], salwar: ['shopper', 'clerk', 'office-woman'], koli: ['shopper', 'clerk'],
  kurta: ['chai-vendor', 'host', 'taxi-driver'], vendor: ['chai-vendor', 'taxi-driver', 'host', 'commuter'],
  school: ['student', 'commuter'], jogger: ['student', 'commuter'], worker: ['commuter', 'taxi-driver', 'student'],
  dabbawala: ['chai-vendor', 'taxi-driver'], elder: ['taxi-driver', 'chai-vendor'],
};
/** Distances (m) at which a person drops to the in-file LOD, to the simplified body, and out of view. */
export const CAST_LOD = { far: 6, distant: 12, hidden: 46 };

interface Driver { act: CastAct; root: THREE.Object3D; mixer: THREE.AnimationMixer; base: number; rate: number; users: number }
interface Member {
  id: string; height: number; material: THREE.Material | THREE.Material[]; bind: THREE.Matrix4; sphere: THREE.Sphere;
  /** Root-space bounds of the idle pose: feet height, centre and size. */
  minY: number; cx: number; cz: number; size: number; walkSpeed: number; sitPelvis: number;
  close: THREE.BufferGeometry; far: THREE.BufferGeometry; distantIndex: THREE.BufferAttribute;
  drivers: Driver[]; variants: Map<number, THREE.BufferGeometry[]>;
}

export class CastFigure {
  readonly mesh: THREE.SkinnedMesh; private level = -1; private driver: number;
  constructor(private cast: DistrictCast, readonly member: Member, act: CastAct, private key: string, readonly scale: number) {
    this.driver = cast.driverFor(member, act, key); cast.use(member, this.driver, 1);
    this.mesh = new THREE.SkinnedMesh(cast.variant(member, this.driver)[0], member.material);
    this.mesh.bindMode = THREE.DetachedBindMode; this.mesh.bind(cast.skeleton, member.bind);
    // Root space → person space: turn to face −Z like the district walkers, stand on y = 0, scale to height.
    const s = this.size, m = new THREE.Matrix4().makeRotationY(Math.PI)
      .multiply(new THREE.Matrix4().makeTranslation(-member.cx * s, -member.minY * s, -member.cz * s))
      .multiply(new THREE.Matrix4().makeScale(s, s, s)).multiply(member.bind);
    this.mesh.matrixAutoUpdate = false; this.mesh.matrix.copy(m);
    this.mesh.boundingSphere = member.sphere.clone(); this.mesh.frustumCulled = true;
    this.mesh.castShadow = this.mesh.receiveShadow = true; this.mesh.userData.districtCast = true; this.mesh.name = `cast:${member.id}`;
    this.setLevel(0);
  }
  /** Height scale from root units to metres, with a little per-person variety. */
  get size() { return this.member.height * this.scale * (.975 + placementNoise(this.key) * .05) / this.member.size; }
  /** Walking speed (m/s) at which this person's feet do not slide. */
  get walkSpeed() { return this.member.walkSpeed * this.member.drivers[this.driver].rate * this.size; }
  /** Height of the seat surface below the pelvis when seated, so the crowd can lower the body onto it. */
  get pelvisHeight() { return this.member.sitPelvis * this.size; }
  setAct(act: CastAct) {
    if (this.member.drivers[this.driver].act === act) return;
    this.cast.use(this.member, this.driver, -1); this.driver = this.cast.driverFor(this.member, act, this.key); this.cast.use(this.member, this.driver, 1);
    const level = this.level; this.level = -1; this.setLevel(level as 0 | 1 | 2);
  }
  setLevel(level: 0 | 1 | 2) { if (level === this.level) return; this.level = level; this.mesh.geometry = this.cast.variant(this.member, this.driver)[level]; }
  dispose() { this.cast.use(this.member, this.driver, -1); this.mesh.removeFromParent(); }
}

export class DistrictCast {
  skeleton!: THREE.Skeleton;
  private members = new Map<string, Member>();
  private leases: AssetLease[] = [];
  private drivers: Driver[] = [];
  private constructor() {}

  static async load(library: GLBAssetLibrary, cast: Record<string, CastMember>) {
    const { MeshoptSimplifier } = await import('meshoptimizer'); await MeshoptSimplifier.ready;
    const self = new DistrictCast(), ids = [...new Set(Object.values(CASTING).flat())].filter(id => loadable(cast[id], false));
    if (!ids.length) throw new Error('No approved cast for the districts');
    // Talk and Sit are authored on only some characters; the rig is shared, so any character can play them.
    const first = await Promise.all(ids.map(id => library.acquire(cast[id].asset)));
    self.leases.push(...first);
    const shared = (name: string) => first.flatMap(l => l.animations).find(a => a.name === name);
    const bones: THREE.Bone[] = [], inverses: THREE.Matrix4[] = [];
    for (const [n, id] of ids.entries()) {
      const leases = [first[n], ...await Promise.all(DRIVERS.slice(1).map(() => library.acquire(cast[id].asset)))]; self.leases.push(...leases.slice(1));
      const clip = (act: CastAct) => leases[0].animations.find(a => a.name.toLowerCase() === act) ?? shared(act === 'talk' ? 'Talk' : act === 'sit' ? 'Sit' : act === 'walk' ? 'Walk' : 'Idle') ?? leases[0].animations.find(a => /idle/i.test(a.name))!;
      const skins = (root: THREE.Object3D) => { const list: THREE.SkinnedMesh[] = []; root.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) list.push(o as THREE.SkinnedMesh); }); return list; };
      const template = skins(leases[0].root), close = template.find(m => !/_LOD1$/.test(m.name))!, far = template.find(m => /_LOD1$/.test(m.name)) ?? close;
      const walkSpeed = measureGroundSpeed(leases[1].root, clip('walk'));
      const drivers = DRIVERS.map((d, i): Driver => {
        const root = leases[i].root, skeleton = skins(root).find(m => !/_LOD1$/.test(m.name))!.skeleton, mixer = new THREE.AnimationMixer(root), action = mixer.clipAction(clip(d.act)).play();
        mixer.timeScale = d.rate; action.time = d.phase * action.getClip().duration; mixer.update(0); root.updateMatrixWorld(true);
        const base = bones.length; bones.push(...skeleton.bones); inverses.push(...skeleton.boneInverses);
        return { act: d.act, root, mixer, base, rate: d.rate, users: 0 };
      });
      // Bounds and seat height from the posed rigs, measured the same way GLBCharacter normalises a character.
      const idle = drivers.find(d => d.act === 'idle')!, sit = drivers.find(d => d.act === 'sit')!;
      const measure = skins(idle.root).find(m => !/_LOD1$/.test(m.name))!; measure.computeBoundingBox(); measure.computeBoundingSphere();
      const box = measure.boundingBox!.clone().applyMatrix4(measure.matrixWorld), sphere = measure.boundingSphere!.clone(); sphere.radius *= 1.35;
      let pelvis: THREE.Object3D | undefined; sit.root.traverse(o => { if (!pelvis && /Pelvis$/.test(o.name)) pelvis = o; });
      const sitPelvis = (pelvis ? pelvis.getWorldPosition(new THREE.Vector3()).y : box.min.y + (box.max.y - box.min.y) * .3) - box.min.y;
      // A ~20% simplification of the in-file LOD for people beyond the street's near distance.
      const index = far.geometry.index!, positions = far.geometry.getAttribute('position'), flat = new Float32Array(positions.count * 3);
      for (let i = 0; i < positions.count; i++) flat.set([positions.getX(i), positions.getY(i), positions.getZ(i)], i * 3);
      const [simplified] = MeshoptSimplifier.simplify(new Uint32Array(index.array), flat, 3, Math.floor(index.count * .2 / 3) * 3, .04, []);
      self.members.set(id, {
        id, height: cast[id].height, material: close.material, bind: close.bindMatrix.clone(), sphere,
        minY: box.min.y, cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2, size: box.max.y - box.min.y, walkSpeed, sitPelvis,
        close: close.geometry, far: far.geometry, distantIndex: new THREE.BufferAttribute(positions.count > 65535 ? simplified : new Uint16Array(simplified), 1),
        drivers, variants: new Map(),
      });
      self.drivers.push(...drivers);
    }
    self.skeleton = new THREE.Skeleton(bones, inverses);
    return self;
  }

  /** A person for a wardrobe role; `near` lists members already standing close by, to avoid twins. */
  figure(outfit: Outfit, act: CastAct, key: string, scale = 1, near: string[] = []) {
    const options = (CASTING[outfit] ?? CASTING.shirt).filter(id => this.members.has(id)), start = Math.floor(placementNoise(key) * options.length);
    const order = options.map((_, i) => options[(start + i) % options.length]), id = order.find(m => !near.includes(m)) ?? order[0];
    return new CastFigure(this, this.members.get(id)!, act, key, Math.max(.84, scale));
  }
  driverFor(member: Member, act: CastAct, key: string) {
    const matches = member.drivers.map((d, i) => ({ d, i })).filter(({ d }) => d.act === act);
    return matches[Math.floor(placementNoise(`${key}:${act}`) * matches.length)]?.i ?? 0;
  }
  use(member: Member, driver: number, delta: number) { member.drivers[driver].users += delta; }
  /** The three LOD geometries for one member on one driver: shared attributes, skin indices offset into the combined skeleton. */
  variant(member: Member, driver: number) {
    let list = member.variants.get(driver);
    if (!list) {
      const base = member.drivers[driver].base, offset = (g: THREE.BufferGeometry, index = g.index) => {
        const out = new THREE.BufferGeometry(), source = g.getAttribute('skinIndex'), skin = new Uint16Array(source.count * 4);
        for (let i = 0; i < source.count; i++) for (let k = 0; k < 4; k++) skin[i * 4 + k] = source.getComponent(i, k) + base;
        for (const [name, attribute] of Object.entries(g.attributes)) if (name !== 'skinIndex') out.setAttribute(name, attribute);
        out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skin, 4)); out.setIndex(index); out.boundingSphere = member.sphere.clone(); return out;
      };
      const far = offset(member.far), distant = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(far.attributes)) distant.setAttribute(name, attribute);
      distant.setIndex(member.distantIndex); distant.boundingSphere = member.sphere.clone();
      list = [offset(member.close), far, distant]; member.variants.set(driver, list);
    }
    return list;
  }
  /** Advance only the rigs someone is currently using. */
  update(delta: number) {
    for (const d of this.drivers) if (d.users > 0) { d.mixer.update(delta); d.root.updateMatrixWorld(true); }
  }
  get memberIds() { return [...this.members.keys()]; }
  get boneCount() { return this.skeleton.bones.length; }
  dispose() {
    // Only the offset skin indices belong to the cast; positions, normals and indices stay with the shared templates.
    for (const m of this.members.values()) for (const list of m.variants.values()) for (const g of list) { for (const name of Object.keys(g.attributes)) if (name !== 'skinIndex') g.deleteAttribute(name); g.setIndex(null); g.dispose(); }
    for (const d of this.drivers) { d.mixer.stopAllAction(); d.mixer.uncacheRoot(d.root); }
    this.skeleton.dispose(); this.leases.forEach(l => l.release()); this.members.clear();
  }
}

let active: DistrictCast | null = null;
/** The loaded cast, or null while it loads (crowds then use procedural figures and adopt the cast later). */
export const districtCast = () => active;
export function setDistrictCast(cast: DistrictCast | null) { active = cast; }
