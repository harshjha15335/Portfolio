import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTransitModel } from './TransitModel';
import { pointAtDistance, routeLength } from './transit';

type Triple = [number, number, number];
export interface StreetInteraction { id: string; position: THREE.Vector3; label: string }
const plaster = ['#ab8876', '#bbac8e', '#798b88', '#a67869', '#788083', '#b4a082', '#8d8b70'];

/** Original modular Mumbai-inspired CST/Fort lane. One art-directed vertical slice. */
export class MumbaiStreet {
  readonly group = new THREE.Group();
  readonly interactions: StreetInteraction[] = [];
  private boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  private sphereGeometry = new THREE.IcosahedronGeometry(1, 1);
  private materials = new Map<string, THREE.Material>();
  private statics: THREE.Mesh[] = [];
  private dynamicParts: THREE.Mesh[] = [];
  private dynamicBatches: Array<{ instance: THREE.InstancedMesh; meshes: THREE.Mesh[] }> = [];
  private motion: Array<(time: number) => void> = [];
  private wallTexture: THREE.CanvasTexture;
  private signAtlas: THREE.CanvasTexture;
  private signs: THREE.Mesh[] = [];
  private signIndex = 0;
  private signCanvas: HTMLCanvasElement;
  readonly facadeCount = 14;

  constructor(private physics: CANNON.World) {
    this.wallTexture = this.makePlaster();
    this.signCanvas = document.createElement('canvas'); this.signCanvas.width = 2048; this.signCanvas.height = 2048;
    this.signAtlas = new THREE.CanvasTexture(this.signCanvas); this.signAtlas.colorSpace = THREE.SRGBColorSpace;
    this.landscape();
    for (let i = 0; i < 7; i++) for (const side of [-1, 1]) this.facade(side, 4 - i * 9.5, i);
    this.station(); this.researchRoom(); this.streetDetails(); this.people(); this.traffic();
    this.signAtlas.needsUpdate = true; this.instanceStatics(); this.mergeSigns(); this.instancePedestrians();
  }
  private material(color: string, glow = false, wall = false) {
    const key = `${color}-${glow}-${wall}`;
    if (!this.materials.has(key)) this.materials.set(key, glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color, map: wall ? this.wallTexture : null }));
    return this.materials.get(key)!;
  }
  private shape(geometry: THREE.BufferGeometry, size: Triple, position: Triple, color: string, parent: THREE.Object3D = this.group, glow = false, wall = false, batch = true) {
    const mesh = new THREE.Mesh(geometry, this.material(color, glow, wall)); mesh.scale.set(...size); mesh.position.set(...position); mesh.castShadow = !glow && size[1] > .4; mesh.receiveShadow = !glow; parent.add(mesh); if (batch) this.statics.push(mesh); else this.dynamicParts.push(mesh); return mesh;
  }
  private box(size: Triple, position: Triple, color: string, solid = false, parent: THREE.Object3D = this.group, glow = false, wall = false) {
    const mesh = this.shape(this.boxGeometry, size, position, color, parent, glow, wall);
    if (solid) {
      parent.updateWorldMatrix(true, false); const p = mesh.getWorldPosition(new THREE.Vector3());
      const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)), position: new CANNON.Vec3(p.x, p.y, p.z) });
      const q = mesh.getWorldQuaternion(new THREE.Quaternion()); body.quaternion.set(q.x, q.y, q.z, q.w); this.physics.addBody(body);
    }
    return mesh;
  }
  private cylinder(radius: number, height: number, position: Triple, color: string, parent: THREE.Object3D = this.group, glow = false) { return this.shape(this.cylinderGeometry, [radius, height, radius], position, color, parent, glow); }
  private wire(a: THREE.Vector3, b: THREE.Vector3, width = .024, color = '#242635', parent: THREE.Object3D = this.group) {
    const mesh = this.shape(this.cylinderGeometry, [width, a.distanceTo(b), width], a.clone().add(b).multiplyScalar(.5).toArray() as Triple, color, parent);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
  private sign(parent: THREE.Object3D, english: string, local: string, position: Triple, width: number, bg = '#273e40', fg = '#eac992') {
    const index = this.signIndex++, col = index % 4, row = Math.floor(index / 4), x = col * 512, y = row * 128;
    const ctx = this.signCanvas.getContext('2d')!;
    ctx.fillStyle = bg; ctx.fillRect(x, y, 512, 128); ctx.strokeStyle = fg; ctx.lineWidth = 3; ctx.strokeRect(x + 6, y + 6, 500, 116);
    ctx.textAlign = 'center'; ctx.fillStyle = fg; ctx.font = 'bold 29px Arial, sans-serif'; ctx.fillText(local, x + 256, y + 44, 480);
    ctx.font = 'bold 36px Arial, sans-serif'; ctx.fillText(english, x + 256, y + 94, 480);
    const geometry = new THREE.PlaneGeometry(width, width / 4);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / 4, 1 - (row + 1 - uv.getY(i)) / 16);
    const key = 'sign-atlas';
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshBasicMaterial({ map: this.signAtlas, side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(geometry, this.materials.get(key)!); mesh.position.set(...position); parent.add(mesh); this.signs.push(mesh); return mesh;
  }
  private makePlaster() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#c7c0b4'; ctx.fillRect(0, 0, 256, 256);
    let seed = 117; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 8000; i++) { const v = 150 + rand() * 100; ctx.fillStyle = `rgba(${v},${v},${v},.18)`; ctx.fillRect(rand() * 256, rand() * 256, rand() * 4 + 1, rand() * 5 + 1); }
    for (let i = 0; i < 38; i++) { ctx.fillStyle = '#4e494918'; ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 4, 10 + rand() * 70); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  private landscape() {
    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); this.physics.addBody(ground);
    this.box([100, .1, 150], [0, -.1, -26], '#585963');
    this.box([7.8, .04, 78], [0, -.02, -22], '#33343e');
    // Human-height physics floor stays flat; the pavement lip is deliberately low.
    for (const side of [-1, 1]) {
      this.box([2.8, .06, 75], [side * 5.3, .01, -22], '#76746e');
      for (let z = -58; z < 16; z += .85) this.box([.22, .12, .75], [side * 3.98, .055, z], Math.floor(z / 1.7) % 2 ? '#b69858' : '#32312e');
      // Keep the pedestrian inside the authored lane.
      this.box([1, 4, 82], [side * 19, 2, -22], '#3c404a', true);
    }
    this.box([38, 4, 1], [0, 2, -63], '#4d4b52', true);
    this.box([38, 4, 1], [0, 2, 20], '#4d4b52', true);
    for (let z = -54; z < 12; z += 6) this.box([.08, .008, 2], [0, .005, z], '#a2997e');
    for (let i = 0; i < 8; i++) this.box([.55, .008, 2.4], [-3 + i * .85, .008, -12], '#aaa28b');
    for (const side of [-1, 1]) for (let z = -55; z < 10; z += 4.5) {
      this.box([.65, .013, .45], [side * 3.5, .012, z], '#282d34');
      for (let n = 0; n < 5; n++) this.box([.035, .015, .38], [side * 3.5 - .22 + n * .11, .02, z], '#53545a');
    }
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 14), new THREE.MeshStandardMaterial({ color: '#736172', transparent: true, opacity: .5, roughness: .35 }));
    puddle.rotation.x = -Math.PI / 2; puddle.scale.set(1.2, .38, 1); puddle.position.set(2.6, .014, -17); this.group.add(puddle);
  }
  private facade(side: number, z: number, index: number) {
    const g = new THREE.Group(); g.position.set(side * 7, 0, z); g.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2; this.group.add(g);
    const height = [10.8, 13.2, 9, 12, 14.1, 11.4, 10.2][index]; const color = plaster[(index + (side > 0 ? 2 : 0)) % plaster.length];
    // Fort's ground floor has a real door and interior, built separately.
    const fort = side === -1 && index === 4;
    this.box([8.9, height - 3.2, 6.5], [0, 3.2 + (height - 3.2) / 2, -3.4], color, true, g, false, true);
    if (!fort) {
      this.box([8.9, 3.2, 6.5], [0, 1.6, -3.4], color, true, g, false, true);
      for (const x of [-2.15, 2.15]) {
        this.box([3.6, 2.3, .12], [x, 1.22, -.065], '#2c343a', false, g);
        const open = (index + (x > 0 ? 1 : 0)) % 3 !== 0;
        if (open) {
          this.box([3.15, 1.6, .13], [x, 1.25, .025], '#796249', false, g);
          this.box([2.8, .1, .16], [x, 2.13, .04], '#e8b26b', false, g, true);
          this.box([3.15, .65, .28], [x, .45, .2], '#766350', false, g);
          for (let j = 0; j < 5; j++) this.box([.3, .22 + j % 2 * .1, .18], [x - 1 + j * .48, .85, .25], ['#956e44', '#a09350', '#9b4941'][j % 3], false, g);
        } else for (let j = 0; j < 11; j++) this.box([3.3, .035, .04], [x, .3 + j * .16, .04], '#57565a', false, g);
      }
    }
    this.box([9.05, .22, .4], [0, 3.12, .12], '#585b58', false, g);
    const names = side === -1 ? [['IRANI CHAI', 'चाय'], ['RADIO REPAIR', 'रेडियो'], ['FORT BOOK HOUSE', 'किताबें'], ['SADAF TEXTILES', 'कपड़े'], ['FORT RESEARCH INSTITUTE', 'फोर्ट'], ['SHANTI STORES', 'दुकान'], ['COASTAL CAFE', 'चाय']] : [['CST NEWS & PAPERS', 'मुंबई'], ['SAHIL ELECTRICALS', 'बिजली'], ['PRABHAT OPTICS', 'चश्मे'], ['CITY CYCLE WORKS', 'साइकिल'], ['VIDYA STATIONERY', 'किताबें'], ['AZAD BAKERY', 'बेकरी'], ['KONKAN LUNCH HOME', 'भोजन']];
    this.sign(g, names[index][0], names[index][1], [0, 3.65, .28], 7, index % 2 ? '#714837' : '#2d4945');
    if (!fort) {
      const awning = this.box([7.5, .08, 1.25], [0, 2.35, .7], ['#74524d', '#b39564', '#546b64'][index % 3], false, g); awning.rotation.x = .16;
      for (let x = -3.4; x < 3.5; x += .7) this.box([.28, .18, .05], [x, 2.18, 1.27], '#c3b084', false, g);
    }
    for (let y = 4.25; y < height - .5; y += 2.6) {
      for (const x of [-2.8, 0, 2.8]) {
        this.box([1.65, 1.62, .14], [x, y, .015], '#484846', false, g);
        const lit = Math.round(y * 10 + index + x + side) % 3 === 0;
        this.box([1.37, 1.33, .03], [x, y, .105], lit ? '#caa06c' : '#333e49', false, g, lit);
        this.box([.065, 1.36, .07], [x, y, .15], '#6d6d65', false, g);
        this.box([1.4, .065, .08], [x, y, .15], '#6d6d65', false, g);
        if (index % 3 !== 2) {
          this.box([2, .15, 1], [x, y - .85, .43], '#898376', false, g);
          this.box([1.95, .06, .07], [x, y - .12, .95], '#343d42', false, g);
          for (let n = 0; n < 7; n++) this.box([.035, .7, .04], [x - .85 + n * .28, y - .48, .95], '#343d42', false, g);
        }
      }
      this.box([.75, .45, .45], [3.7, y - .2, .3], '#c0baa5', false, g);
      for (let j = 0; j < 5; j++) this.box([.5, .025, .05], [3.7, y - .34 + j * .07, .56], '#6b706d', false, g);
    }
    this.box([9.25, .25, 6.85], [0, height, -3.4], '#6d6c64', false, g);
    this.box([9.15, .65, .2], [0, height + .32, -.05], color, false, g);
    this.cylinder(.8, 1.2, [2, height + .7, -2], '#303a40', g);
    this.cylinder(.85, .12, [2, height + 1.35, -2], '#283037', g);
    // Laundry above the pavement, visually useful at first-person eye level.
    if (index % 2 === 0) {
      this.wire(new THREE.Vector3(-3.5, 6.4, 1), new THREE.Vector3(3.5, 6.4, 1), .017, '#42464a', g);
      for (let j = 0; j < 5; j++) this.box([.5, .7, .02], [-2.3 + j * 1.1, 6, 1], ['#aa6f63', '#b4b5a2', '#647e8d'][j % 3], false, g);
    }
    const poster = this.sign(g, index % 2 ? 'EVENING CLASSES' : 'THE JOURNEY SO FAR', 'मुंबई', [3.8, 1.45, .3], .65, '#af8e60', '#2e3437'); poster.scale.y = 2;
  }
  private station() {
    this.box([12, 7, 3], [0, 3.5, 18], '#a78c6a', true, this.group, false, true);
    for (const x of [-4, -2, 0, 2, 4]) {
      this.box([1.3, 3.7, .12], [x, 2.4, 16.43], '#28343d');
      this.box([.35, 5.5, .3], [x - .8, 2.75, 16.1], '#c2ab82');
    }
    const sign = this.sign(this.group, 'CST ARRIVAL TERMINUS', 'छत्रपती शिवाजी महाराज टर्मिनस', [0, 5.5, 16.1], 10); sign.rotation.y = Math.PI;
    this.box([12.6, .3, 3.6], [0, 7.1, 18], '#694e47');
    for (const x of [-5, 5]) { this.box([1.5, 3.5, 2], [x, 8.6, 18], '#9d8566'); this.cylinder(1, .4, [x, 10.5, 18], '#715148'); }
    this.person([5.8, 0, 8.3], '#89937e', false);
    this.interactions.push({ id: 'cst', position: new THREE.Vector3(5.8, 1.45, 8.3), label: 'Talk to the station host' });
    const board = this.sign(this.group, 'FORT ROAD →', 'फोर्ट', [6.3, 2.9, 7.8], 1.2, '#294d47'); board.rotation.y = -.1;
  }
  private researchRoom() {
    const g = new THREE.Group(); g.position.set(-7, 0, -34); g.rotation.y = Math.PI / 2; this.group.add(g);
    // The open 2m doorway is made from separate walls, never an invisible solid box.
    for (const x of [-3.1, 3.1]) this.box([2.5, 3.1, .3], [x, 1.55, -.08], '#78938d', true, g, false, true);
    this.box([2.9, .42, .35], [0, 2.95, -.08], '#78938d', true, g);
    this.box([8.5, .035, 6.5], [0, .025, -3.3], '#787b74', false, g);
    this.box([8.5, 3, .3], [0, 1.5, -6.5], '#91a39a', true, g);
    for (const x of [-4.25, 4.25]) this.box([.3, 3, 6.5], [x, 1.5, -3.3], '#8b9d92', true, g);
    this.box([8.5, .12, 6.5], [0, 3.1, -3.3], '#6b7875', false, g);
    this.box([1.2, .08, .45], [0, 2.85, -2], '#eee1b1', false, g, true);
    this.sign(g, 'FFPRIME / OPEN SCIENCE', 'फोर्ट', [0, 2.3, -6.28], 5.8, '#344d48', '#dce2c8');
    this.sign(g, 'GSOC 2026 · QC-DEVS', 'Research, reviewed upstream', [-2.4, 1.6, -6.22], 2.8);
    this.sign(g, '5 MERGED PULL REQUESTS', 'Source: final report', [2.2, 1.6, -6.22], 2.8);
    this.box([4.2, .15, .85], [0, .78, -4.7], '#735c43', true, g);
    for (const x of [-1.25, 1.25]) {
      this.box([1, .7, .07], [x, 1.25, -4.75], '#172e32', false, g);
      this.sign(g, x < 0 ? 'MULTIPOLE ELECTROSTATICS' : 'PYTHON · NUMERICAL TESTS', 'FFprime', [x, 1.25, -4.69], .9);
      this.box([.07, .3, .15], [x, .95, -4.75], '#283638', false, g);
    }
    this.person([-5.9, 0, -35.8], '#718d86', false);
    this.interactions.push({ id: 'fort', position: new THREE.Vector3(-5.9, 1.4, -35.8), label: 'Talk to the research fellow' });
    this.interactions.push({ id: 'ffprime', position: new THREE.Vector3(-11.8, 1.3, -34), label: 'Read the FFprime research' });
    const light = new THREE.PointLight('#ffe5ba', 10, 9, 2); light.position.set(-10, 2.5, -34); this.group.add(light);
  }
  private streetDetails() {
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const z = 7 - i * 13, x = side * 5.95;
      this.cylinder(.09, 6.2, [x, 3.1, z], '#43454b');
      this.box([.8, .09, .12], [x - side * .35, 5.9, z], '#454750');
      this.box([.5, .1, .25], [x - side * .7, 5.83, z], '#e4b978', false, this.group, true);
      this.box([.18, .6, .14], [x, 3.1, z], '#737571');
      for (let cable = 0; cable < 3; cable++) for (let n = 0; n < 8; n++) {
        const point = (t: number) => new THREE.Vector3(x + cable * .12, 6 - Math.sin(t * Math.PI) * .7, z - t * 13);
        this.wire(point(n / 8), point((n + 1) / 8), .018);
      }
      // Warm pools are translucent original geometry; no costly light per lamp.
      const pool = new THREE.Mesh(new THREE.CircleGeometry(2.5, 20), new THREE.MeshBasicMaterial({ color: '#e8ae61', transparent: true, opacity: .07, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(x - side * 1.4, .013, z); this.group.add(pool);
      if (i < 3 && side === 1) { const light = new THREE.PointLight('#fbc487', 7, 10, 2); light.position.set(x - .7, 4.6, z); this.group.add(light); }
      this.box([.5, .65, .5], [side * 6.2, .325, z - 4.5], '#465e56', true);
      this.cylinder(.23, .45, [side * 6.1, .23, z + 3], '#8c6551');
      this.shape(this.sphereGeometry, [.38, .6, .38], [side * 6.1, .85, z + 3], '#546c4e');
      if (i % 2 === 0) this.scooter(side * 5.6, z - 5, side);
    }
    // Hanging cross-street service wires frame the view above eye level.
    for (const z of [-8, -30, -47]) for (let cable = 0; cable < 3; cable++) for (let n = 0; n < 10; n++) {
      const point = (t: number) => new THREE.Vector3(-7 + t * 14, 7.5 - Math.sin(t * Math.PI) * 1.2 + cable * .16, z + cable * .3);
      this.wire(point(n / 10), point((n + 1) / 10), .021);
    }
    // Chai counter with cups, kettle, crates and a vendor.
    this.box([1.6, .9, .65], [-5.6, .45, 3], '#5f4c3a', true);
    this.box([1.7, .1, .75], [-5.6, .94, 3], '#a18b67');
    this.cylinder(.14, .25, [-5.6, 1.12, 3], '#adb0a4');
    for (let i = 0; i < 4; i++) this.cylinder(.045, .1, [-6.15 + i * .19, 1.05, 3.15], '#b19772');
    for (let i = 0; i < 3; i++) this.box([.55, .5, .55], [-6.4, .25 + i * .5, .8], '#7d664b', true);
    this.person([-6.2, 0, 3.5], '#ac8b67', false);
    this.box([1.7, .13, .45], [5.9, .48, -16], '#715b48', true);
    for (const x of [5.25, 6.5]) this.box([.09, .48, .35], [x, .24, -16], '#3e4948');
  }
  private scooter(x: number, z: number, side: number) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = side * .4; this.group.add(g);
    for (const wz of [-.65, .65]) { const wheel = this.cylinder(.25, .15, [0, .25, wz], '#242b30', g); wheel.rotation.z = Math.PI / 2; }
    this.box([.42, .45, .9], [0, .5, .1], '#627e7b', false, g);
    this.box([.38, .12, .65], [0, .8, .15], '#252d32', false, g);
    this.box([.45, .6, .17], [0, .65, -.5], '#9e8b62', false, g);
    this.box([.65, .05, .06], [0, 1, -.55], '#45494c', false, g);
  }
  private person(position: Triple, shirt: string, moving: boolean) {
    const g = new THREE.Group(); g.position.set(...position); this.group.add(g);
    const batch = !moving;
    this.shape(this.boxGeometry, [.38, .58, .23], [0, 1.1, 0], shirt, g, false, false, batch);
    this.shape(this.sphereGeometry, [.13, .16, .13], [0, 1.6, 0], '#a18165', g, false, false, batch);
    this.shape(this.cylinderGeometry, [.06, .11, .06], [0, 1.415, 0], '#a18165', g, false, false, batch);
    const legs: THREE.Mesh[] = [], arms: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      legs.push(this.shape(this.boxGeometry, [.14, .77, .16], [side * .1, .43, 0], '#3e4c53', g, false, false, batch));
      arms.push(this.shape(this.boxGeometry, [.12, .6, .13], [side * .26, 1.07, 0], shirt, g, false, false, batch));
      this.shape(this.boxGeometry, [.16, .09, .29], [side * .1, .045, -.06], '#2b3036', g, false, false, batch);
    }
    if (moving) this.motion.push(time => {
      const offset = position[2] + 60, progress = ((time * .7 + offset) % 58);
      g.position.z = position[0] > 0 ? 9 - progress : -49 + progress;
      g.rotation.y = position[0] > 0 ? 0 : Math.PI;
      for (let i = 0; i < 2; i++) { legs[i].rotation.x = Math.sin(time * 5 + i * Math.PI + offset) * .21; arms[i].rotation.x = -legs[i].rotation.x; }
    });
    return g;
  }
  private people() {
    for (let i = 0; i < 10; i++) this.person([i % 2 ? 4.7 : -4.8, 0, 7 - i * 6], ['#777c8d', '#a07973', '#768d80', '#b29a71', '#727e99'][i % 5], true);
    for (const [x, z] of [[-6, -10], [6, -23], [-6, -43], [5.8, -46]]) this.person([x, 0, z], '#9c8472', false);
    this.person([5.9, -.25, -16], '#7b8d8b', false);
  }
  private traffic() {
    for (const kind of ['taxi', 'auto'] as const) {
      const vehicle = createTransitModel(kind); vehicle.position.set(kind === 'taxi' ? 2.1 : -2.1, .02, 5); vehicle.rotation.y = kind === 'auto' ? Math.PI : 0; this.group.add(vehicle);
      this.interactions.push({ id: `hail-${kind}`, label: `Hail ${kind === 'taxi' ? 'kaali-peeli taxi' : 'auto'}`, position: new THREE.Vector3(vehicle.position.x, 1, vehicle.position.z) });
    }
    const loop = [{ x: 1.75, z: 12 }, { x: 1.75, z: -52 }, { x: 0, z: -54 }, { x: -1.75, z: -52 }, { x: -1.75, z: 12 }, { x: 0, z: 14 }, { x: 1.75, z: 12 }];
    const length = routeLength(loop);
    for (let i = 0; i < 3; i++) {
      const vehicle = createTransitModel(i === 1 ? 'auto' : 'taxi'); this.group.add(vehicle);
      this.motion.push(time => {
        // Shared phase maintains spacing. A pause at the zebra crossing acts as a signal.
        const clock = Math.floor(time / 24) * 20 + Math.min(time % 24, 20);
        const p = pointAtDistance(loop, (clock * 3 + i * length / 3) % length);
        vehicle.position.set(p.x, .02, p.z); vehicle.rotation.y = p.heading;
      });
    }
  }
  private instanceStatics() {
    this.group.updateMatrixWorld(true);
    const buckets = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; meshes: THREE.Mesh[] }>();
    for (const mesh of this.statics) {
      const source = mesh.material as THREE.MeshLambertMaterial;
      const family = source instanceof THREE.MeshBasicMaterial ? 'glow' : source.map ? 'plaster' : 'solid';
      const key = `${mesh.geometry.uuid}-${family}`;
      let bucket = buckets.get(key);
      if (!bucket) { const material = source.clone(); material.color.set('#ffffff'); bucket = { geometry: mesh.geometry, material, meshes: [] }; buckets.set(key, bucket); }
      bucket.meshes.push(mesh);
    }
    for (const { geometry, material, meshes } of buckets.values()) {
      const instance = new THREE.InstancedMesh(geometry, material, meshes.length);
      meshes.forEach((mesh, i) => { instance.setMatrixAt(i, mesh.matrixWorld); instance.setColorAt(i, (mesh.material as THREE.MeshLambertMaterial).color); mesh.removeFromParent(); });
      instance.castShadow = meshes.some(m => m.castShadow); instance.receiveShadow = true; instance.computeBoundingSphere(); this.group.add(instance);
    }
  }
  private mergeSigns() {
    this.group.updateMatrixWorld(true);
    const geometries = this.signs.map(sign => { const geometry = sign.geometry.clone().applyMatrix4(sign.matrixWorld); sign.removeFromParent(); sign.geometry.dispose(); return geometry; });
    this.group.add(new THREE.Mesh(mergeGeometries(geometries)!, this.signs[0].material)); geometries.forEach(g => g.dispose());
  }
  private instancePedestrians() {
    const buckets = new Map<THREE.BufferGeometry, THREE.Mesh[]>();
    for (const mesh of this.dynamicParts) { const parts = buckets.get(mesh.geometry) ?? []; parts.push(mesh); buckets.set(mesh.geometry, parts); mesh.visible = false; }
    for (const [geometry, meshes] of buckets) {
      const instance = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({color:'#ffffff'}), meshes.length);
      meshes.forEach((mesh, i) => instance.setColorAt(i, (mesh.material as THREE.MeshLambertMaterial).color));
      instance.frustumCulled = false; this.group.add(instance); this.dynamicBatches.push({ instance, meshes });
    }
  }
  update(time: number, reduced: boolean) {
    for (const animate of this.motion) animate(reduced ? 0 : time);
    this.group.updateMatrixWorld(true);
    for (const { instance, meshes } of this.dynamicBatches) { meshes.forEach((mesh, i) => instance.setMatrixAt(i, mesh.matrixWorld)); instance.instanceMatrix.needsUpdate = true; }
  }
}
