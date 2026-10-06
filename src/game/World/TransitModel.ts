import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { TransitKind } from './transit';

/** Original low-poly transport silhouettes; no external assets or textures. */
export function createTransitModel(kind: TransitKind) {
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const yellow = new THREE.MeshStandardMaterial({ color: '#f9c847', roughness: 0.85 });
  const black = new THREE.MeshStandardMaterial({ color: '#25292b', roughness: 0.85 });
  const glass = new THREE.MeshStandardMaterial({ color: '#a0adb0', roughness: 0.7, transparent: true, opacity: 0.18, depthWrite: false });
  const cream = new THREE.MeshStandardMaterial({ color: '#fff4d0', emissive: '#eec786', emissiveIntensity: .45 });
  const skin = new THREE.MeshStandardMaterial({ color: '#98745b', roughness: .95 });
  const shirt = new THREE.MeshStandardMaterial({ color: '#7d8872', roughness: .95 });
  const part = (size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
    const mesh = new THREE.Mesh(box, material); mesh.scale.set(...size); mesh.position.set(...position); mesh.castShadow = true; group.add(mesh); return mesh;
  };
  const auto = kind === 'auto';
  part([auto ? 1.45 : 1.85, 0.65, auto ? 2.3 : 3.6], [0, 0.65, 0], black);
  part([auto ? 1.5 : 1.72, 0.15, auto ? 1.9 : 2], [0, auto ? 1.85 : 1.62, 0.2], yellow);
  part([auto ? 1.22 : 1.6, auto ? 0.85 : 0.55, 0.1], [0, auto ? 1.35 : 1.26, auto ? -0.7 : -0.8], glass);
  if (!auto) {
    part([1.7, 0.2, 0.9], [0, 1.05, -1.3], yellow);
    part([0.55, 0.2, 0.35], [0, 1.8, 0.2], cream);
    for (const x of [-0.83, 0.83]) part([0.06, 0.47, 1.75], [x, 1.24, 0.2], glass);
  } else {
    for (const x of [-0.7, 0.7]) part([0.09, 1.2, 0.09], [x, 1.25, 0.9], black);
    part([1.3, 0.4, 0.5], [0, 0.93, 0.6], yellow);
    part([1.4, 0.75, 0.15], [0, 1.1, 1.05], black);
  }
  for (const x of [-0.55, 0.55]) part([0.25, 0.2, 0.07], [x, 0.75, auto ? -1.2 : -1.82], cream);
  const wheels = auto ? [[0, -0.95], [-0.72, 0.8], [0.72, 0.8]] : [[-0.9, -1.1], [0.9, -1.1], [-0.9, 1.1], [0.9, 1.1]];
  const tyre = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 10); tyre.rotateZ(Math.PI / 2);
  wheels.forEach(([x, z]) => { const mesh = new THREE.Mesh(tyre, black); mesh.position.set(x, 0.35, z); group.add(mesh); });
  // Passenger cabin stays open to the city; original seats, dashboard and driver.
  part([auto ? 1.2 : 1.5, 0.08, 0.42], [0, 1.03, auto ? -0.53 : -0.66], black);
  part([auto ? 1.12 : 1.5, 0.15, 0.48], [0, 0.88, 0.58], black);
  part([0.36, 0.43, 0.22], [-0.35, 1.1, -0.18], shirt);
  part([0.23, 0.25, 0.23], [-0.35, 1.44, -0.18], skin);
  part([0.4, 0.05, 0.07], [-0.35, 1.04, -0.45], black);
  // Each vehicle moves as a unit. Merge its parts into four material batches.
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group.updateMatrixWorld(true);
  for (const child of [...group.children]) {
    const mesh = child as THREE.Mesh;
    const material = mesh.material as THREE.Material;
    const parts = buckets.get(material) ?? [];
    parts.push(mesh.geometry.clone().applyMatrix4(mesh.matrix)); buckets.set(material, parts);
    group.remove(mesh);
  }
  for (const [material, parts] of buckets) {
    const merged = mergeGeometries(parts)!;
    const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    parts.forEach(part => part.dispose());
  }
  box.dispose(); tyre.dispose();
  return group;
}
