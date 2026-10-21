import * as THREE from 'three';

/**
 * How lit the city's artificial lights are (0 by day, 1 at night), written once per environment update by the
 * world and read by whatever draws lamps: light pools under street lamps, vehicle head and tail lamps.
 */
export const nightLights = { level: 0 };
/** Sodium-warm lamp light. */
export const POOL_COLOR = '#ffb867';

const pools = new Set<THREE.Mesh>();
let poolTexture: THREE.Texture | null = null;
/** Soft round falloff, drawn once: bright centre, nothing at the rim. */
function poolMap() {
  if (poolTexture) return poolTexture;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64; const ctx = c.getContext('2d');
  const g = ctx?.createRadialGradient(32, 32, 0, 32, 32, 32); if (!ctx || !g) return null; // headless test canvases
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(.7, 'rgba(255,255,255,.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  poolTexture = new THREE.CanvasTexture(c); poolTexture.colorSpace = THREE.SRGBColorSpace; return poolTexture;
}
/**
 * The pool of light a lamp throws on the ground: an additive decal mesh, not a dynamic light, so a street full of
 * lamps costs one draw and no shadow maps. While the lamps are off the mesh is hidden, so by day it is neither drawn
 * nor compiled.
 */
export function lightPoolMesh(geometry: THREE.BufferGeometry, color: string) {
  const material = new THREE.MeshBasicMaterial({ color, map: poolMap(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  material.userData.surface = 'pool';
  const mesh = new THREE.Mesh(geometry, material); mesh.renderOrder = 1; mesh.castShadow = mesh.receiveShadow = false;
  showPool(mesh, nightLights.level); pools.add(mesh);
  material.addEventListener('dispose', () => pools.delete(mesh));
  return mesh;
}
const POOL_OPACITY = .55;
const showPool = (mesh: THREE.Mesh, level: number) => { mesh.visible = level > .02; (mesh.material as THREE.MeshBasicMaterial).opacity = POOL_OPACITY * level; };
const glowing = new Set<THREE.MeshStandardMaterial>();
/**
 * A material whose emissive map (e.g. lit windows) comes up with the lamps, to `peak` intensity. The map is attached
 * only while the lamps are on, so by day the material keeps its daytime shader variant.
 */
export function nightEmissive<T extends THREE.MeshStandardMaterial>(material: T, peak: number) {
  material.userData.nightPeak = peak; material.userData.nightMap = material.emissiveMap; glowing.add(material); glow(material, nightLights.level);
  material.addEventListener('dispose', () => glowing.delete(material));
  return material;
}
const glow = (m: THREE.MeshStandardMaterial, level: number) => {
  const map = level > .02 ? m.userData.nightMap as THREE.Texture : null;
  if (m.emissiveMap !== map) { m.emissiveMap = map; m.needsUpdate = true; }
  m.emissiveIntensity = map ? (m.userData.nightPeak as number) * level : 0;
};
export function setNightLevel(level: number) {
  nightLights.level = level;
  for (const m of pools) showPool(m, level);
  for (const m of glowing) glow(m, level);
}
