import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { projects } from '../../data/projects';
import { districts } from '../../data/city';
import { createTransitModel } from './TransitModel';
import { ringPoint } from './transit';

export interface Landmark { id: string; title: string; position: [number, number, number]; color: string }

const BLUE = '#3155ff', INK = '#080808', PAPER = '#f2efe7', LIME = '#d5ff43', GREY = '#a8ada9';
type Triple = [number, number, number];

/** Workshop arrivals use the front road, clear of the preserved jump ramps. */
export function landmarkArrival(landmark: Landmark) {
  if (landmark.id === 'cst') return { x: 0, z: -10, heading: 0, direction: new THREE.Vector3(0, 0, -1) };
  const direction = landmark.id === 'garage' || landmark.id === 'about'
    ? new THREE.Vector3(0, 0, -1)
    : new THREE.Vector3(-landmark.position[0], 0, -landmark.position[2]).normalize();
  return { x: landmark.position[0] + direction.x * 12, z: landmark.position[2] + direction.z * 12, heading: Math.atan2(direction.x, direction.z), direction };
}

/** A physical editorial model: shared primitives, printed surfaces and readable silhouettes. */
export class Campus {
  readonly group = new THREE.Group();
  readonly targets: THREE.Object3D[] = [];
  private motion: Array<(time: number) => void> = [];
  private boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private sphereGeometry = new THREE.IcosahedronGeometry(1, 1);
  private cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private printMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private statics: THREE.Mesh[] = [];

  constructor(private physics: CANNON.World, readonly landmarks: Landmark[]) {
    this.buildLandscape();
    if (landmarks.some(item => item.id === 'cst')) this.buildCity();
    else {
      this.buildHub();
      landmarks.forEach(landmark => this.buildLandmark(landmark));
      this.buildPlayground();
    }
    this.instanceStatics();
  }

  private material(color: string) {
    if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 }));
    return this.materials.get(color)!;
  }

  private shape(parent: THREE.Object3D, geometry: THREE.BufferGeometry, size: Triple, position: Triple, color: string, dynamic = false) {
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.scale.set(...size); mesh.position.set(...position); mesh.castShadow = size[1] > 0.2; mesh.receiveShadow = true;
    parent.add(mesh); if (!dynamic) this.statics.push(mesh); return mesh;
  }

  private box(parent: THREE.Object3D, size: Triple, position: Triple, color: string, solid = false, rotation: Triple = [0, 0, 0], dynamic = false) {
    const mesh = this.shape(parent, this.boxGeometry, size, position, color, dynamic); mesh.rotation.set(...rotation);
    if (solid) this.collider(mesh, new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)));
    return mesh;
  }

  private collider(mesh: THREE.Object3D, shape: CANNON.Shape) {
    mesh.updateWorldMatrix(true, false);
    const position = mesh.getWorldPosition(new THREE.Vector3()), quaternion = mesh.getWorldQuaternion(new THREE.Quaternion());
    const body = new CANNON.Body({ mass: 0, shape, position: new CANNON.Vec3(position.x, position.y, position.z), collisionFilterGroup: 1 });
    body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w); body.aabbNeedsUpdate = true; this.physics.addBody(body);
  }

  private sphere(parent: THREE.Object3D, radius: number, position: Triple, color: string, solid = false, dynamic = false) {
    const mesh = this.shape(parent, this.sphereGeometry, [radius, radius, radius], position, color, dynamic);
    if (solid) this.collider(mesh, new CANNON.Sphere(radius)); return mesh;
  }

  private cylinder(parent: THREE.Object3D, radius: number, height: number, position: Triple, color: string, solid = false, rotation: Triple = [0, 0, 0]) {
    const mesh = this.shape(parent, this.cylinderGeometry, [radius, height, radius], position, color);
    mesh.rotation.set(...rotation);
    if (solid) this.collider(mesh, new CANNON.Cylinder(radius, radius, height, 12)); return mesh;
  }

  private ring(parent: THREE.Object3D, radius: number, tube: number, color: string, position: Triple) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 48), this.material(color));
    mesh.position.set(...position); mesh.castShadow = true; parent.add(mesh); return mesh;
  }

  /** Canvas prints are original artwork; identical legend textures are reused. */
  private label(parent: THREE.Object3D, title: string, subtitle: string, position: Triple, width = 12, background = INK, foreground = PAPER, floor = false) {
    const key = `${title}|${subtitle}|${background}|${foreground}`;
    if (!this.printMaterials.has(key)) {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
      const context = canvas.getContext('2d')!;
      context.fillStyle = background; context.fillRect(0, 0, 1024, 256);
      context.fillStyle = foreground; context.font = '900 112px Arial, sans-serif';
      const measured = context.measureText(title).width;
      if (measured > 940) context.font = `900 ${Math.floor(112 * 940 / measured)}px Arial, sans-serif`;
      context.fillText(title, 35, 139);
      context.font = '500 28px monospace'; context.fillText(subtitle, 40, 212);
      context.lineWidth = 2; context.beginPath(); context.moveTo(39, 160); context.lineTo(970, 164); context.strokeStyle = foreground; context.stroke();
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      this.printMaterials.set(key, new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }));
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), this.printMaterials.get(key)!);
    mesh.position.set(...position); if (floor) mesh.rotation.x = -Math.PI / 2; parent.add(mesh); return mesh;
  }

  private line(parent: THREE.Object3D, points: Triple[], color = INK, width = 0.045) {
    for (let index = 1; index < points.length; index++) {
      const a = new THREE.Vector3(...points[index - 1]), b = new THREE.Vector3(...points[index]);
      const segment = this.shape(parent, this.cylinderGeometry, [width, a.distanceTo(b), width], a.clone().add(b).multiplyScalar(0.5).toArray() as Triple, color);
      segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    }
  }

  private arrow(parent: THREE.Object3D, position: Triple, scale: number, rotation = 0, color = PAPER) {
    const group = new THREE.Group(); group.position.set(...position); group.rotation.y = rotation; parent.add(group);
    this.box(group, [0.34 * scale, 0.014, 2.5 * scale], [0, 0, 0.4 * scale], color);
    for (const side of [-1, 1]) this.box(group, [0.3 * scale, 0.014, 1.5 * scale], [side * 0.45 * scale, 0, -0.5 * scale], color, false, [0, side * -0.72, 0]);
  }

  private buildLandscape() {
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(57, 55, 3.1, 8), this.material(this.landmarks.some(item => item.id === 'cst') ? '#e2cfad' : BLUE));
    slab.position.y = -1.55; slab.rotation.y = Math.PI / 8; slab.receiveShadow = true; this.group.add(slab);
    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), collisionFilterGroup: 1 });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); ground.aabbNeedsUpdate = true; this.physics.addBody(ground);
    // Printed ink roads are flush with the physics floor.
    this.box(this.group, [8, 0.03, 80], [0, 0.018, 0], INK);
    this.box(this.group, [80, 0.03, 8], [0, 0.021, 0], INK);
    const circuit = new THREE.Mesh(new THREE.RingGeometry(35, 40, 96), this.material(INK));
    circuit.rotation.x = -Math.PI / 2; circuit.position.y = 0.025; circuit.receiveShadow = true; this.group.add(circuit);
    for (let index = -6; index <= 6; index++) {
      if (Math.abs(index) < 2) continue;
      this.box(this.group, [0.09, 0.01, 1.6], [0, 0.046, index * 5.6], PAPER);
      this.box(this.group, [1.6, 0.01, 0.09], [index * 5.6, 0.047, 0], PAPER);
    }
    const roads: Array<[string, string, Triple, number]> = [
      [this.landmarks.some(l => l.id === 'cst') ? 'FORT / LABS' : '01 / FFPRIME', 'RESEARCH ↑', [0, 0.055, -18], 0],
      [this.landmarks.some(l => l.id === 'cst') ? 'BKC / SYSTEMS' : '02 / NORTHSTAR', 'SYSTEMS ↑', [18, 0.055, 0], -Math.PI / 2],
      [this.landmarks.some(l => l.id === 'cst') ? 'DADAR / JOURNEY' : '03 / RECO', 'JOURNEY ↑', [0, 0.055, 18], Math.PI],
      [this.landmarks.some(l => l.id === 'cst') ? 'ANDHERI / SKILLS' : '04 / MONEYMETRICS', 'SKILLS ↑', [-18, 0.055, 0], Math.PI / 2],
    ];
    roads.forEach(([name, sub, pos, rotation]) => { const label = this.label(this.group, name, sub, pos, 6.8, INK, PAPER, true); label.rotation.z = rotation; });
    for (let index = 0; index < 32; index++) {
      const angle = index / 32 * Math.PI * 2, x = Math.sin(angle) * 40.8, z = Math.cos(angle) * 40.8;
      this.box(this.group, [0.25, 0.78, 0.25], [x, 0.39, z], INK, true);
      this.box(this.group, [0.27, 0.12, 0.27], [x, 0.77, z], PAPER);
      if (index % 4 === 1) {
        this.box(this.group, [0.14, 3, 0.14], [x + Math.sin(angle), 1.5, z + Math.cos(angle)], INK, true);
        this.box(this.group, [0.7, 0.11, 0.3], [x + Math.sin(angle), 3, z + Math.cos(angle)], PAPER);
      }
    }
    // Clearly visible, low retaining walls match the physical island boundary.
    for (const edge of [-49, 49]) {
      this.box(this.group, [2, 1.5, 100], [edge, 0.75, 0], INK, true);
      this.box(this.group, [100, 1.5, 2], [0, 0.75, edge], INK, true);
    }
    for (const x of [-35, 35]) for (const z of [-35, 35]) {
      const rotation = x * z > 0 ? -Math.PI / 4 : Math.PI / 4;
      this.box(this.group, [1, 1.5, 42], [x, 0.75, z], INK, true, [0, rotation, 0]);
    }
    // Peripheral paper sculptures leave the roads and all arrival points open.
    for (let index = 0; index < 16; index++) {
      const angle = index * 2.39996, radius = 44 + index % 3;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (Math.abs(x) < 12 || Math.abs(z) < 12 || (z > 24 && Math.abs(x) < 33)) continue;
      this.cylinder(this.group, 0.15, 2, [x, 1, z], INK, true);
      this.sphere(this.group, 1.1, [x, 2.7, z], PAPER, true);
      this.box(this.group, [1.5, 0.07, 1.5], [x, 3.7, z], BLUE, false, [0.12, index, -0.18]);
    }
  }

  private buildHub() {
    // HJ is built from real solid strokes, placed beside the clear spawn/forward lane.
    const letters = new THREE.Group(); letters.position.set(-7, 0, -17); letters.rotation.y = -0.14; this.group.add(letters);
    const scale = 0.65;
    // Scale the solid strokes themselves so their Cannon shapes match the printed installation.
    const stroke = (size: Triple, pos: Triple) => this.box(letters, size.map(value => value * scale) as Triple, pos.map(value => value * scale) as Triple, PAPER, true);
    stroke([0.95, 6.8, 1.2], [-2.9, 3.4, 0]); stroke([0.95, 6.8, 1.2], [0, 3.4, 0]); stroke([3.4, 1.1, 1.2], [-1.45, 3.4, 0]);
    stroke([3.3, 1, 1.2], [3.1, 6.3, 0]); stroke([0.95, 5.6, 1.2], [4.2, 3.1, 0]); stroke([3.1, 1, 1.2], [3.1, 0.6, 0]); stroke([0.95, 1.7, 1.2], [2, 1.05, 0]);
    this.label(letters, 'HARSH / 26', 'SOFTWARE · AI · RESEARCH', [0.5 * scale, 8 * scale, 0], 10 * scale, BLUE, PAPER);
    this.box(this.group, [9 * scale, 0.16, 6 * scale], [-7, 0.08, -17], INK, true);
    this.label(this.group, 'BUILD. BREAK. REPEAT.', 'AN ENGINEERING PLAYGROUND / HARSH JHA', [-10, 0.019, -7], 15, BLUE, PAPER, true).rotation.z = -0.09;
    this.arrow(this.group, [0, 0.052, -5], 1.3);
    this.label(this.group, 'YOU ARE HERE ↗', 'YES, THIS ACTUALLY DRIVES', [6.2, 0.019, -8], 6, BLUE, INK, true).rotation.z = 0.16;
    this.label(this.group, '05 / GARAGE', 'PROTOTYPES →', [11, 0.016, 27], 7, BLUE, PAPER, true).rotation.z = -0.25;
    this.label(this.group, '06 / STUDIO', 'THE HUMAN BIT ←', [-11, 0.016, 27], 7, BLUE, PAPER, true).rotation.z = 0.25;
  }

  private buildLandmark(landmark: Landmark) {
    const group = new THREE.Group(); group.position.set(...landmark.position);
    let rotation = 0;
    if (Math.abs(landmark.position[0]) > Math.abs(landmark.position[2])) rotation = landmark.position[0] > 0 ? -Math.PI / 2 : Math.PI / 2;
    else if (landmark.position[2] > 0) rotation = Math.PI;
    if (landmark.id === 'about' || landmark.id === 'garage') rotation = Math.PI;
    group.rotation.y = rotation; this.group.add(group);
    const paper = landmark.id === 'ffprime' || landmark.id === 'about';
    this.box(group, [20, 0.18, 17], [0, 0.09, 0], paper ? PAPER : INK, true);
    // Feather the arrival edge into the floor so the raised paper/ink pads are driveable.
    const entrySlope = Math.atan(0.18 / 1.6);
    this.box(group, [5.2, 0.12, Math.hypot(1.6, 0.18)], [0, 0.09 - 0.06 * Math.cos(entrySlope), 9.3], paper ? PAPER : INK, true, [entrySlope, 0, 0]);
    this.label(group, landmark.id === 'garage' ? '05' : landmark.id === 'about' ? '06' : `0${this.landmarks.indexOf(landmark) + 1}`, 'INDEX / 2026', [-7.3, 0.19, 5], 4, paper ? PAPER : INK, paper ? INK : PAPER, true);
    const picker = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 15), new THREE.MeshBasicMaterial({ visible: false }));
    picker.position.y = 5; picker.userData.landmarkId = landmark.id; group.add(picker); this.targets.push(picker);
    if (landmark.id === 'ffprime') this.research(group);
    else if (landmark.id === 'northstar') this.northstar(group);
    else if (landmark.id === 'reco') this.reco(group);
    else if (landmark.id === 'moneymetrics') this.metrics(group);
    else if (landmark.id === 'garage') this.garage(group);
    else this.about(group);
    this.arrow(group, [0, 0.193, 6.2], 0.75, 0, paper ? INK : PAPER);
    for (const x of [-8.8, 8.8]) {
      this.box(group, [0.3, 1.15, 0.3], [x, 0.66, 6.2], paper ? INK : PAPER, true);
      this.box(group, [0.32, 0.16, 0.32], [x, 1.2, 6.2], BLUE);
    }
  }

  private research(group: THREE.Group) {
    // Offset pages and a scientific grid replace the old laboratory block.
    this.box(group, [12.6, 0.3, 8], [-0.5, 0.33, -1.4], PAPER, true, [0, -0.07, 0]);
    this.box(group, [10.8, 0.35, 6.8], [-1, 0.64, -2], PAPER, true, [0, 0.08, 0]);
    for (let n = -5; n <= 5; n++) {
      this.box(group, [0.022, 0.015, 6.1], [n, 0.825, -2], BLUE);
      if (n > -4 && n < 4) this.box(group, [10.2, 0.015, 0.022], [-0.6, 0.826, -2 + n * 0.8], BLUE);
    }
    this.box(group, [16, 3.2, 0.34], [0, 2.3, -6.1], PAPER, true);
    this.label(group, 'MULTIPOLE', 'MONO / DIPOLE / QUAD · FFPRIME', [0, 2.45, -5.91], 15, PAPER, INK);
    this.label(group, 'RESEARCH', 'QC-DEVS / THEOCHEM · GSOC 2026', [-8, 5.2, -1], 8, BLUE, PAPER).rotation.z = Math.PI / 2;
    const molecule = new THREE.Group(); molecule.position.set(0, 4.9, -1.7); group.add(molecule);
    for (let index = 0; index < 6; index++) {
      const angle = index / 6 * Math.PI * 2;
      this.sphere(molecule, index % 2 ? 0.55 : 0.8, [Math.cos(angle) * 2.8, Math.sin(angle) * 1.6, Math.sin(angle) * 1.9], index % 2 ? INK : BLUE, false, true);
      this.line(molecule, [[0, 0, 0], [Math.cos(angle) * 2.8, Math.sin(angle) * 1.6, Math.sin(angle) * 1.9]], INK, 0.045);
    }
    this.sphere(molecule, 0.55, [0, 0, 0], PAPER, false, true);
    for (let index = 0; index < 4; index++) {
      const orbit = this.ring(molecule, 3.1 + index * 0.35, 0.022, BLUE, [0, 0, 0]); orbit.rotation.set(index * 0.7, index * 0.5, 0.25);
    }
    // The only moving sculpture floats above the driving envelope.
    this.motion.push(time => { molecule.rotation.y = time * 0.11; });
    // Bonds belong to the animated sculpture, so keep them out of static batches.
    this.statics = this.statics.filter(mesh => { if (mesh.parent === molecule) return false; return true; });
    for (const x of [-5.7, 5.7]) {
      this.cylinder(group, 0.1, 3.2, [x, 1.8, -2], INK, true);
      this.sphere(group, 0.36, [x, 3.5, -2], BLUE);
    }
    for (let index = 0; index < 3; index++) {
      const x = -3.8 + index * 3.8;
      this.box(group, [2.7, 0.6, 1.3], [x, 0.5, 3], PAPER, true);
      this.label(group, ['MONO', 'DIPOLE', 'QUAD'][index], 'φ / E / ∇', [x, 0.81, 3], 2.5, PAPER, BLUE, true);
    }
    this.label(group, 'FFPRIME', 'ELECTROSTATICS BEYOND ATOMIC CHARGES', [0, 1.45, 5.3], 11, PAPER, INK);
  }

  private northstar(group: THREE.Group) {
    // Three offset fins form market architecture rather than a generic black box.
    for (let index = 0; index < 3; index++) {
      this.box(group, [4.7, 6.5 + index * 1.6, 5], [-4.7 + index * 4.3, 3.4 + index * 0.8, -2 - index * 0.45], INK, true, [0, -0.12 + index * 0.09, 0]);
      this.box(group, [4.7, 0.13, 5], [-4.7 + index * 4.3, 6.65 + index * 1.6, -2 - index * 0.45], PAPER);
    }
    this.label(group, 'NORTH', '02 / MARKET RESEARCH', [-1.5, 7.15, 1], 11, INK, PAPER);
    this.label(group, 'STAR', 'PAPER EXECUTION / AUDIT HISTORY', [2.2, 4.9, 1.5], 10, INK, PAPER);
    const chart = new THREE.Group(); chart.position.set(-5.7, 2, 1.3); group.add(chart);
    const values = [0.3, 1.2, 0.8, 2, 1.6, 2.8, 2.2, 3.3, 2.9, 4];
    this.line(chart, values.map((height, index) => [index * 1.2, height, 0] as Triple), BLUE, 0.065);
    const marker = this.sphere(chart, 0.16, [0, values[0], 0], LIME, false, true);
    this.motion.push(time => {
      const progress = time * 0.7 % (values.length - 1), index = Math.floor(progress);
      marker.position.set(progress * 1.2, THREE.MathUtils.lerp(values[index], values[index + 1], progress - index), 0.05);
    });
    ['DATA', 'AGENTS', 'RISK'].forEach((title, index) => {
      this.box(group, [3.1, 1.1, 1.5], [-4.1 + index * 4.1, 0.75, 4.3], PAPER, true);
      this.label(group, title, '→ PAPER', [-4.1 + index * 4.1, 1, 5.065], 2.9, PAPER, INK);
    });
    this.label(group, '102 / 12', 'BACKEND / BROWSER TESTS · REPO AUDIT', [7.1, 2.6, 0], 5, BLUE, PAPER).rotation.z = -Math.PI / 2;
  }

  private reco(group: THREE.Group) {
    this.box(group, [16.4, 0.8, 3], [0, 1.55, 0], PAPER, true);
    this.box(group, [16.2, 0.12, 2.4], [0, 2.01, 0], INK);
    for (const x of [-7.4, 0, 7.4]) for (const z of [-1, 1]) this.box(group, [0.28, 1.5, 0.28], [x, 0.85, z], PAPER, true);
    for (let index = 0; index < 5; index++) {
      const x = -6.4 + index * 3.2;
      this.box(group, [0.25, 3.5, 0.25], [x - 1.2, 1.95, -1.7], PAPER, true);
      this.box(group, [2.5, 0.25, 3.1], [x, 3.7, -0.2], PAPER, true);
      this.label(group, ['RISK', 'DIAGNOSE', 'DECIDE', 'GUARD', 'RECOVER'][index], `0${index + 1} →`, [x, 3.71, 1.37], 2.9, BLUE, PAPER);
      this.box(group, [1.8, 1.4, 0.8], [x, 0.9, -3], BLUE, true);
      const token = this.box(group, [0.68, 0.6, 0.8], [x, 2.37, 0], index === 4 ? LIME : BLUE, false, [0, 0, 0], true);
      this.motion.push(time => { token.position.x = -7.1 + ((time * 0.85 + index * 2.85) % 14.2); });
    }
    this.box(group, [15.2, 0.28, 0.28], [0, 7.3, -4.8], PAPER, true);
    for (const x of [-7.5, 7.5]) this.box(group, [0.32, 7, 0.32], [x, 3.7, -4.8], PAPER, true);
    const project = projects.find(item => item.id === 'reco')!, ratio = project.metrics.find(metric => metric.value.includes('%'))!;
    this.label(group, ratio.value, ratio.label.toUpperCase(), [0, 6, -4.6], 14, BLUE, PAPER);
    this.label(group, 'RECO', 'DECISIONS WITH A DETERMINISTIC BOUNDARY', [0, 1.5, 4.6], 10, INK, PAPER);
    for (let index = 0; index < 7; index++) {
      this.box(group, [0.65, 0.65, 0.65], [-8.7 + index % 2 * 0.72, 0.5 + Math.floor(index / 2) * 0.65, -4 + index % 2], PAPER, true);
    }
    this.label(group, '20 SEEDED CASES', 'FIXTURES / NOT PRODUCTION OUTCOMES', [0, 0.19, 6.4], 7, INK, PAPER, true);
  }

  private metrics(group: THREE.Group) {
    const heights = [2.4, 4.2, 3.3, 6.8, 8.3];
    heights.forEach((height, index) => {
      this.box(group, [1.6, height, 3], [-6.1 + index * 2, height / 2 + 0.18, -3], index % 2 ? BLUE : PAPER, true);
      this.box(group, [1.6, 0.12, 3], [-6.1 + index * 2, height + 0.19, -3], index === 4 ? LIME : INK);
    });
    const donut = this.ring(group, 2.8, 0.65, PAPER, [4, 3.5, 2]);
    // A torus collider is a compound of matching short boxes around its perimeter.
    for (let index = 0; index < 16; index++) {
      const angle = index / 16 * Math.PI * 2;
      const collider = new THREE.Object3D(); collider.position.set(4 + Math.cos(angle) * 2.8, 3.5 + Math.sin(angle) * 2.8, 2); collider.rotation.z = angle; group.add(collider);
      this.collider(collider, new CANNON.Box(new CANNON.Vec3(0.66, 0.63, 0.65))); collider.removeFromParent();
    }
    const slice = this.ring(group, 2.8, 0.67, BLUE, [4, 3.5, 2]);
    slice.geometry.dispose(); slice.geometry = new THREE.TorusGeometry(2.8, 0.67, 6, 16, Math.PI * 0.62); slice.rotation.z = -0.5;
    donut.receiveShadow = true;
    this.box(group, [5.8, 0.5, 2.5], [4, 0.43, 2], BLUE, true);
    this.label(group, 'MONEY', 'TRANSACTIONS / ANALYTICS', [-2.5, 5.9, 0], 11, BLUE, PAPER);
    this.label(group, 'METRICS', 'PLANNING / WHAT-IF', [-1, 3.55, 0.1], 11, INK, PAPER);
    this.line(group, [[-7, 0.3, 4.1], [-5, 1.2, 4.1], [-3, 0.6, 4.1], [-1, 2.1, 4.1], [1, 1.3, 4.1]], PAPER, 0.045);
    for (let index = 0; index < 6; index++) {
      this.cylinder(group, 0.55, 0.18, [-7 + index * 1.1, 0.38 + index * 0.06, 2], PAPER, true, [0, 0, 0.12]);
    }
    this.label(group, 'EMI / SAVE / WHAT-IF', '3 PLANNING TOOLS', [0, 0.19, 6.4], 9, INK, PAPER, true);
  }

  private garage(group: THREE.Group) {
    // An open workshop gives a glimpse of three uneven workstations and their prototypes.
    this.box(group, [17, 0.3, 7.8], [0, 5.5, -1.7], PAPER, true, [0, 0, 0.035]);
    for (const x of [-8, 8]) for (const z of [-5, 1.7]) this.box(group, [0.25, 5.3, 0.25], [x, 2.85, z], PAPER, true);
    this.box(group, [16, 3.5, 0.3], [0, 2.3, -5.3], BLUE, true);
    this.label(group, 'PROBABLY OVER-ENGINEERED', 'BUILD / TEST / ITERATE', [0, 3.5, -5.12], 14, BLUE, PAPER);
    ['MEETING INTELLIGENCE', 'RIDEFLOW', 'WORK IN PROGRESS'].forEach((title, index) => {
      const x = -5.2 + index * 5.2, z = -1.7 + index % 2 * 1.5;
      this.box(group, [4, 0.25, 2.3], [x, 1.55, z], PAPER, true);
      for (const side of [-1, 1]) this.box(group, [0.22, 1.3, 0.22], [x + side * 1.7, 0.84, z], GREY, true);
      this.box(group, [2.1, 1.4, 0.18], [x, 2.35, z - 0.6], INK, true, [0, -0.05 + index * 0.04, 0]);
      this.label(group, title, index === 0 ? 'TRANSCRIPT → ACTION' : index === 1 ? 'ONE JOURNEY / MULTIPLE MODES' : 'SKETCH / PROTOTYPE', [x, 2.36, z - 0.495], 2, INK, PAPER);
      this.box(group, [1.4, 0.14, 0.65], [x, 1.77, z + 0.4], BLUE);
      this.box(group, [0.65, 0.7, 0.75], [x + 1.25, 0.57, z + 0.6], BLUE, true);
      this.line(group, [[x, 2.7, -4.8], [x + 0.7, 4.4, -3.3], [x - 0.3, 3.8, z - 0.6]], PAPER, 0.025);
    });
    this.box(group, [2.5, 0.45, 1.4], [-5.2, 0.46, 4.1], PAPER, true);
    this.box(group, [1.25, 0.45, 0.8], [-5.2, 0.9, 4.1], BLUE, true);
    for (const x of [-6.2, -4.2]) for (const z of [3.6, 4.6]) this.cylinder(group, 0.35, 0.28, [x, 0.42, z], INK, true, [0, 0, Math.PI / 2]);
    this.label(group, 'PROJECT GARAGE', 'SMALL IDEAS / MANY ITERATIONS', [1.7, 1.35, 4.6], 9, INK, PAPER);
    this.label(group, 'MAKE A MESS →', 'THEN MAKE IT WORK', [2, 0.19, 6.6], 7, INK, PAPER, true).rotation.z = -0.07;
    for (let index = 0; index < 8; index++) this.box(group, [0.75, 0.5, 0.7], [7.3 - index % 2 * 0.82, 0.44 + Math.floor(index / 2) * 0.5, 3.5], index % 2 ? PAPER : BLUE, true);
  }

  private about(group: THREE.Group) {
    this.box(group, [13, 0.45, 5], [-0.4, 2.7, -1], PAPER, true, [0, -0.05, 0]);
    for (const x of [-5.3, 4.5]) for (const z of [-2.7, 0.7]) this.box(group, [0.45, 2.4, 0.45], [x, 1.4, z], INK, true);
    this.box(group, [5.2, 3.1, 0.25], [-1.5, 4.5, -2.2], INK, true, [-0.06, -0.04, 0]);
    this.label(group, 'HARSH JHA', 'VIT VELLORE / CLASS OF 2028', [-1.5, 4.53, -2.05], 5, INK, PAPER);
    this.box(group, [1.6, 0.2, 1.2], [3.8, 3.1, -1], BLUE, true, [0, -0.2, 0]);
    this.label(group, 'RESUME ↗', 'EDUCATION / WORK', [3.8, 3.215, -1], 1.6, BLUE, PAPER, true).rotation.z = -0.2;
    this.box(group, [4, 0.13, 1.3], [-1.5, 3, 0.7], INK);
    for (let row = 0; row < 3; row++) for (let key = 0; key < 10; key++) this.box(group, [0.25, 0.04, 0.17], [-3.05 + key * 0.34, 3.09, 0.35 + row * 0.3], PAPER);
    // Oversized coffee, a pencil, loose pages and a chair put a human in the world.
    this.cylinder(group, 0.43, 0.75, [-5.3, 3.28, -0.7], BLUE, true);
    this.ring(group, 0.3, 0.08, BLUE, [-5.83, 3.28, -0.7]);
    this.box(group, [0.14, 0.14, 2], [4, 3.05, 0.8], INK, false, [0, -0.4, 0]);
    this.box(group, [1.9, 0.05, 2.3], [1.8, 2.97, 0.2], PAPER, false, [0, 0.2, 0]);
    this.box(group, [2.7, 0.25, 2.5], [-1, 1.45, 3.8], BLUE, true);
    this.box(group, [2.7, 2.2, 0.25], [-1, 2.5, 4.9], BLUE, true);
    this.cylinder(group, 0.18, 1.3, [-1, 0.8, 3.8], INK, true);
    this.box(group, [3.1, 0.15, 3], [-1, 0.3, 3.8], INK, true);
    this.label(group, 'THE HUMAN BIT', 'RESEARCH + TOO MANY SIDE PROJECTS', [0, 6.8, -3], 12, BLUE, PAPER);
    this.label(group, 'GITHUB / RESUME / SAY HI', '06 / HARSH JHA', [0, 0.19, 6.8], 10, PAPER, INK, true);
  }

  private buildPlayground() {
    // Original ramps retain their exact physics dimensions and slope.
    for (const x of [-16, 16]) {
      this.box(this.group, [5, 0.5, 8], [x, 0.8, 17], PAPER, true, [-0.17, 0, 0]);
      this.label(this.group, 'JUMP ↗', 'KEEP GOING', [x, 1.08, 17], 4.2, PAPER, INK, true).rotation.x -= 0.17;
    }
    for (let index = 0; index < 5; index++) {
      const x = -15 + index * 6.5, z = -15 + index % 2 * 3;
      this.box(this.group, [0.9, 1.4, 0.9], [x, 0.7, z], PAPER, true);
      this.box(this.group, [0.92, 0.12, 0.92], [x, 1.36, z], BLUE);
    }
    // North-south shortcut crosses over the east-west road; its underpass stays clear.
    const slope = Math.atan(2.4 / 8), rampLength = Math.hypot(8, 2.4);
    this.box(this.group, [5, 0.32, 10], [15, 2.24, 0], PAPER, true);
    for (const side of [-1, 1]) {
      this.box(this.group, [5, 0.28, rampLength], [15, 1.2 - 0.14 * Math.cos(slope), side * 9], PAPER, true, [side * slope, 0, 0]);
      this.arrow(this.group, [15, 2.412, side * 2.7], 0.7, side < 0 ? Math.PI : 0, INK);
    }
    for (const x of [12.25, 17.75]) this.box(this.group, [0.24, 0.8, 10], [x, 2.8, 0], INK, true);
    for (const z of [-3.5, 3.5]) for (const x of [12.45, 17.55]) this.box(this.group, [0.32, 2.1, 0.32], [x, 1.05, z], INK, true);
    this.label(this.group, 'TAKE THE HIGH ROAD', 'OR DRIVE UNDER / YOUR CALL', [15, 4.5, -3], 9, BLUE, PAPER);
    // Blueprint pad in a quiet quadrant: an intentional pause between dense landmarks.
    this.label(this.group, '01 → 02 → 03 → 04', 'RESEARCH / SYSTEMS / DECISIONS / PRODUCTS', [-19, 0.025, -21], 12, BLUE, PAPER, true).rotation.z = -0.12;
    for (const x of [-26, -11]) this.box(this.group, [0.18, 0.045, 10], [x, 0.023, -21], PAPER);
  }

  private buildCity() {
    const sea = new THREE.Mesh(new THREE.CircleGeometry(125, 64), this.material('#5c99a8'));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -3.2; this.group.add(sea);
    const lane = new THREE.Mesh(new THREE.RingGeometry(18.5, 23.5, 96), this.material('#343c40'));
    lane.rotation.x = -Math.PI / 2; lane.position.y = 0.06; this.group.add(lane);
    const promenade = new THREE.Mesh(new THREE.RingGeometry(41.5, 46, 96), this.material('#e9dfc5'));
    promenade.rotation.x = -Math.PI / 2; promenade.position.y = 0.05; this.group.add(promenade);
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2, p = ringPoint(a);
      this.box(this.group, [0.1, 0.014, 0.9], [p.x, 0.085, p.z], '#f9c847', false, [0, a, 0]);
      if (i % 2 === 0) {
        const lamp = ringPoint(a, 44.5);
        this.cylinder(this.group, 0.09, 2.8, [lamp.x, 1.4, lamp.z], '#343c40');
        this.sphere(this.group, 0.24, [lamp.x, 2.9, lamp.z], '#ffe9a6');
      }
    }
    this.label(this.group, 'MARINE WALK', 'A SMALL CITY / A LONG STORY', [-30, 0.09, 34], 10, '#e9dfc5', INK, true).rotation.z = -0.6;
    this.label(this.group, 'NO RUSH. NO REAL FARE.', 'CATCH A TAXI / FIND YOUR NEXT STOP', [0, 0.08, 10], 8, '#e2cfad', INK, true);
    // Density is concentrated behind destinations; every arrival and transit lane stays clear.
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2 + 0.08, p = ringPoint(a, 46.5), h = 3 + i % 5 * 1.3;
      if (Math.abs(p.x) > 46 || Math.abs(p.z) > 46) continue;
      const block = new THREE.Group(); block.position.set(p.x, 0, p.z); block.rotation.y = a; this.group.add(block);
      const paint = ['#cda17f', '#8baca2', '#c6b4a2', '#b58c84'][i % 4];
      this.box(block, [3.1, h, 3.2], [0, h / 2, 0], paint);
      this.box(block, [3.4, 0.18, 3.5], [0, h + 0.1, 0], '#eee0bf');
      for (let row = 0; row < Math.floor(h / 1.3); row++) for (const x of [-0.8, 0.8]) this.box(block, [0.5, 0.65, 0.05], [x, 1 + row * 1.3, -1.63], '#354749');
    }
    for (const district of districts) this.cityDistrict(district.id);
    this.cityPeople();
    // Ambient traffic uses the same legible loop as ride transport.
    for (let i = 0; i < 6; i++) {
      const vehicle = createTransitModel(i % 2 ? 'auto' : 'taxi');
      vehicle.scale.setScalar(0.8); this.group.add(vehicle);
      const move = (time: number) => {
        const a = i * Math.PI / 3 + time * (i % 2 ? -0.045 : 0.055), p = ringPoint(a, i % 2 ? 19.7 : 22.2);
        vehicle.position.set(p.x, 0.09, p.z); vehicle.rotation.y = a + (i % 2 ? Math.PI / 2 : -Math.PI / 2);
      };
      move(0); this.motion.push(move);
    }
    // Small transport stands are physical objects and can be selected in the world.
    for (const [kind, x] of [['taxi', 5.5], ['auto', -5.5]] as const) {
      const stand = createTransitModel(kind); stand.position.set(x, 0.06, -11); stand.rotation.y = Math.PI / 2; this.group.add(stand);
      const picker = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshBasicMaterial({ visible: false }));
      picker.position.set(x, 1, -11); picker.userData.landmarkId = `hail-${kind}`; this.group.add(picker); this.targets.push(picker);
      this.label(this.group, kind === 'taxi' ? 'TAXI' : 'AUTO', 'HAIL / BOARD', [x, 2.9, -11], 3, '#f9c847', INK);
    }
    // A compact sea-link silhouette supplies a skyline cue rather than a second game map.
    for (const x of [33, 41]) {
      this.box(this.group, [0.45, 8, 0.45], [x, 4, 33], '#f2e8ce');
      this.line(this.group, [[x - 4, 2, 33], [x, 8, 33], [x + 4, 2, 33]], '#f2e8ce', 0.06);
    }
    this.box(this.group, [18, 0.25, 2], [37, 2, 33], '#34494e');
    // Chai and vada-pav kiosks flank, rather than occupy, the central foot route.
    for (const [x, name] of [[-10, 'CHAI TAPRI'], [10, 'VADA PAV']] as const) {
      this.box(this.group, [3, 1.3, 2], [x, 0.65, 9], '#ae6c43', true);
      this.box(this.group, [3.7, 0.15, 2.6], [x, 2.6, 9], '#e9b44b');
      for (const dx of [-1.35, 1.35]) this.box(this.group, [0.1, 2.4, 0.1], [x + dx, 1.2, 9], '#34494e');
      this.label(this.group, name, 'TAKE A MOMENT', [x, 2.15, 10.1], 3, '#e9b44b', INK);
    }
  }

  private cityDistrict(id: string) {
    const d = districts.find(item => item.id === id)!;
    const group = new THREE.Group(); group.position.set(...d.position);
    group.rotation.y = id === 'cst' ? 0 : Math.atan2(-d.position[0], -d.position[2]); this.group.add(group);
    const cream = '#f0e4c9', ink = '#344147', gold = '#f9c847';
    if (id === 'cst') {
      // The station is beside the spawn lane, not across it.
      this.box(group, [9, 4, 5], [-8, 2, -3], d.color, true);
      this.box(group, [3, 8, 3], [-8, 4, -3], d.color, true);
      this.cylinder(group, 1.9, 0.3, [-8, 8.1, -3], cream);
      this.sphere(group, 1.4, [-8, 8.8, -3], cream);
      this.label(group, 'CST', 'ARRIVAL SQUARE / HARSH JHA', [-8, 4.5, -0.45], 8, d.color, cream);
      this.label(group, '09 STOPS. ONE STORY.', 'SOFTWARE / AI / SCIENTIFIC COMPUTING', [2, 0.08, -3], 9, '#e2cfad', ink, true);
      this.box(group, [2.2, 2.2, 0.12], [-8, 6.4, -1.42], cream);
      this.line(group, [[-8, 7.1, -1.3], [-8, 6.4, -1.3], [-7.4, 6.4, -1.3]], ink, 0.065);
    } else {
      this.box(group, [14, 0.12, 12], [0, 0.06, 0], cream);
      this.label(group, d.title.toUpperCase(), d.descriptor.toUpperCase(), [0, 7.9, 0], 15, d.color, cream);
      this.label(group, `0${districts.indexOf(d) + 1}`, 'YOUR NEXT CHAPTER', [-5, 0.13, 4.5], 2.4, cream, ink, true);
      if (id === 'fort') {
        this.box(group, [12, 3.6, 4], [0, 1.9, -2.5], '#c2ad87', true);
        for (const x of [-5, -2.5, 0, 2.5, 5]) {
          this.cylinder(group, 0.25, 4.3, [x, 2.25, 0], cream, true);
          this.box(group, [1, 0.15, 1], [x, 4.5, 0], cream);
        }
        this.box(group, [13, 0.35, 5], [0, 4.75, -2], d.color);
        this.sphere(group, 1.2, [0, 6.3, -2], cream);
        this.label(group, 'FFPRIME / GSOC 26', 'QC-DEVS / THEOCHEM', [0, 3.2, -0.36], 10, d.color, cream);
        const sculpture = new THREE.Group(); sculpture.position.set(4, 5.8, -2); group.add(sculpture);
        for (let n = 0; n < 3; n++) { const r = this.ring(sculpture, 1.7, 0.04, gold, [0, 0, 0]); r.rotation.set(n, n * 0.5, 0); }
        this.sphere(sculpture, 0.5, [0, 0, 0], cream, false, true);
        this.motion.push(t => { sculpture.rotation.y = t * 0.18; });
      } else if (id === 'bkc') {
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * 3.6, h = 5 + i;
          this.box(group, [3.1, h, 4], [x, h / 2 + 0.12, -2], d.color, true);
          for (let row = 0; row < 4; row++) this.box(group, [2.8, 0.18, 0.05], [x, 1.4 + row * 1.2, 0.03], cream);
        }
        this.label(group, 'CCIEEXPERT', 'POLICY / OAUTH2 / CISCO SECURE ACCESS', [0, 2.6, 1], 10, ink, cream);
      } else if (id === 'andheri') {
        ['PYTHON', 'REACT', 'FASTAPI', 'SQL', 'DOCKER'].forEach((name, i) => {
          const x = (i - 2) * 2.6, z = i % 2 ? -2 : 0;
          this.box(group, [2.2, 1.5, 2], [x, 0.9, z], i % 2 ? '#60908b' : d.color, true);
          this.box(group, [2.5, 0.25, 2.6], [x, 3, z], i % 2 ? cream : gold, false, [0.08, 0, 0]);
          this.label(group, name, 'EVIDENCE INSIDE', [x, 2.4, z + 1.1], 2.5, ink, cream);
        });
        this.label(group, 'NO PROGRESS BARS', 'JUST WORK YOU CAN INSPECT', [0, 5.3, -3], 11, d.color, cream);
      } else if (id === 'powai') {
        ['NORTHSTAR', 'RECO', 'MONEY', 'MEETING', 'RIDEFLOW'].forEach((name, i) => {
          const x = (i - 2) * 2.65, h = [6, 4, 5, 3.5, 4.5][i];
          this.box(group, [2.3, h, 4], [x, h / 2 + 0.12, -2], i % 2 ? '#60908b' : d.color, true);
          this.box(group, [2.5, 0.16, 4.2], [x, h + 0.2, -2], gold);
          this.label(group, name, 'OPEN CASE STUDY', [x, h - 0.6, 0.05], 2.3, ink, cream);
        });
      } else if (id === 'dadar') {
        this.box(group, [12, 0.3, 4], [0, 0.3, -2], '#cba97d', true);
        for (const x of [-5.5, 5.5]) this.box(group, [0.2, 4.5, 0.2], [x, 2.4, 0], ink, true);
        this.box(group, [13, 0.35, 5], [0, 4.7, -2], d.color);
        for (const z of [-4, -2.7]) this.box(group, [14, 0.1, 0.12], [0, 0.5, z], ink);
        for (let x = -6; x <= 6; x++) this.box(group, [0.18, 0.08, 2], [x, 0.49, -3.3], cream);
        const train = new THREE.Group(); train.position.set(0, 1.1, -3.3); group.add(train);
        this.box(train, [8, 1.2, 1.5], [0, 0, 0], cream, false, [0, 0, 0], true);
        for (let x = -3; x <= 3; x++) this.box(train, [0.55, 0.4, 0.05], [x, 0.15, 0.78], d.color, false, [0, 0, 0], true);
        this.motion.push(t => { train.position.x = Math.sin(t * 0.15) * 2; });
        this.label(group, 'NEXT: JULY 2028', 'VIT / CSE / JOURNEY IN PROGRESS', [0, 3.9, 0.7], 10, ink, cream);
      } else if (id === 'worli') {
        for (const x of [-5, 5]) {
          this.box(group, [0.4, 6, 0.4], [x, 3, -3], cream, true);
          this.line(group, [[x - 1.5, 2, -3], [x, 6, -3], [x + 1.5, 2, -3]], cream, 0.055);
        }
        this.box(group, [12, 0.4, 5], [0, 2.1, -2], d.color, true);
        this.label(group, 'EVIDENCE > BUZZWORDS', 'SIGNALS / SOURCES / QUALIFIERS', [0, 4.2, 0], 12, d.color, cream);
        for (const x of [-3, 0, 3]) this.cylinder(group, 0.35, 2, [x, 3.3, -2], gold);
      } else if (id === 'juhu') {
        this.box(group, [9, 3.4, 5], [0, 1.8, -2], d.color, true);
        this.box(group, [10, 0.35, 6], [0, 3.7, -2], cream, false, [0, 0, -0.08]);
        this.box(group, [5, 0.2, 2], [0, 1.4, 2], '#b88952', true);
        this.box(group, [2.3, 1.1, 0.15], [0, 2.05, 1.5], ink);
        this.label(group, 'HARSH JHA', 'A DESK / TOO MANY IDEAS', [0, 2.9, 0.55], 8, d.color, cream);
        for (const x of [-6, 6]) {
          this.cylinder(group, 0.16, 5, [x, 2.5, -3], '#947150');
          for (let i = 0; i < 5; i++) this.box(group, [0.6, 0.14, 3.7], [x, 5, -3], '#6b8d57', false, [0.2, i * Math.PI * 0.4, 0.12]);
        }
      } else {
        this.box(group, [12, 5.5, 6], [0, 2.85, -2], d.color, true);
        this.box(group, [13, 1.5, 1], [0, 4, 1.3], cream, true);
        this.label(group, 'TALKIES', 'NOW SHOWING / HARSH JHA', [0, 4.05, 1.85], 11, cream, ink);
        this.box(group, [4, 2.6, 0.1], [0, 1.5, 1.06], ink);
        for (let i = -5; i <= 5; i++) this.sphere(group, 0.13, [i, 3.3, 1.87], gold);
        this.label(group, 'ADMIT ONE', 'NINE SCENES / YOUR OWN PACE', [0, 6.4, -2], 10, d.color, cream);
      }
    }
    const guideX = id === 'cst' ? 4 : 5, guideZ = id === 'cst' ? -7 : 7.5;
    this.sphere(group, 0.27, [guideX, 1.63, guideZ], '#ac795b');
    this.box(group, [0.55, 0.75, 0.35], [guideX, 1.05, guideZ], d.color);
    for (const side of [-1, 1]) this.box(group, [0.17, 0.6, 0.2], [guideX + side * 0.16, 0.4, guideZ], ink);
    this.label(group, 'HELLO ↗', d.shortName.toUpperCase() + ' / YOUR GUIDE', [guideX, 2.6, guideZ], 3.3, cream, ink);
    const picker = new THREE.Mesh(new THREE.BoxGeometry(id === 'cst' ? 12 : 15, 10, 18), new THREE.MeshBasicMaterial({ visible: false }));
    picker.position.set(id === 'cst' ? -5 : 0, 4, id === 'cst' ? -3 : 0); picker.userData.landmarkId = id; group.add(picker); this.targets.push(picker);
  }

  private cityPeople() {
    const count = 24, geometry = this.boxGeometry;
    const bodies = new THREE.InstancedMesh(geometry, this.material('#5b7f84'), count);
    const heads = new THREE.InstancedMesh(this.sphereGeometry, this.material('#b48765'), count);
    const legs = new THREE.InstancedMesh(geometry, this.material('#344147'), count * 2);
    this.group.add(bodies, heads, legs);
    const dummy = new THREE.Object3D();
    const move = (time: number) => {
      for (let i = 0; i < count; i++) {
        const a = i * Math.PI * 2 / count + time * (i % 2 ? 0.014 : -0.012), p = ringPoint(a, i % 3 ? 26 : 42.5);
        const gait = Math.sin(time * 3 + i) * 0.12;
        dummy.rotation.set(0, a, 0); dummy.scale.set(0.48, 0.72, 0.3); dummy.position.set(p.x, 1.04, p.z); dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix);
        dummy.scale.setScalar(0.25); dummy.position.y = 1.61; dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
        for (const side of [-1, 1]) {
          dummy.scale.set(0.15, 0.62, 0.17); dummy.position.set(p.x + side * Math.cos(a) * 0.15, 0.37, p.z - side * Math.sin(a) * 0.15); dummy.rotation.x = side * gait; dummy.updateMatrix(); legs.setMatrixAt(i * 2 + (side + 1) / 2, dummy.matrix);
        }
      }
      for (const mesh of [bodies, heads, legs]) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
    };
    move(0); this.motion.push(move);
  }

  private instanceStatics() {
    this.group.updateMatrixWorld(true);
    const buckets = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; meshes: THREE.Mesh[] }>();
    for (const mesh of this.statics) {
      const material = mesh.material as THREE.Material, key = `${mesh.geometry.uuid}/${material.uuid}`;
      const bucket = buckets.get(key) ?? { geometry: mesh.geometry, material, meshes: [] };
      bucket.meshes.push(mesh); buckets.set(key, bucket);
    }
    for (const { geometry, material, meshes } of buckets.values()) {
      const batch = new THREE.InstancedMesh(geometry, material, meshes.length); batch.castShadow = true; batch.receiveShadow = true;
      meshes.forEach((mesh, index) => { batch.setMatrixAt(index, mesh.matrixWorld); mesh.removeFromParent(); });
      batch.computeBoundingSphere(); this.group.add(batch);
    }
    this.statics = [];
  }

  update(time: number, reducedMotion: boolean) { if (!reducedMotion) this.motion.forEach(animate => animate(time)); }
}
