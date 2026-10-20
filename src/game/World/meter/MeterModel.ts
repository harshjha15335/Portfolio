import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DEMO_FARE_LABEL, meterRows, type MeterReading } from './FareMeter';
import { drawSegments } from './SegmentDisplay';

/**
 * The physical fare meter in the boarded cab, after the reference photograph of a Mumbai auto's digital meter: a black
 * moulded case on a pedestal bracket, a cream printed faceplate, three red LED rows (fare, waiting time, distance)
 * behind recessed glass, a green FOR HIRE and a red HIRED lamp, two buttons and four screws. The taxi variant has a
 * squarer case and a dashboard foot instead of the pedestal. Sizes in metres (the case is about 20 × 14 × 7 cm).
 */
export type MeterVariant = 'auto' | 'taxi';
export interface PhysicalMeter { group: THREE.Group; show(reading: MeterReading): void; dispose(): void }
/** How far the mounting reaches below the case centre (m): the auto's clamp, the taxi's foot. */
export const METER_BASE: Record<MeterVariant, number> = { auto: .075 + .082, taxi: .07 + .014 };

/** Display canvas: three LED windows stacked, mapped onto the three window quads. */
const DISPLAY = { width: 512, height: 384, rows: [{ y: 0, h: 168, cells: 6 }, { y: 184, h: 92, cells: 4 }, { y: 292, h: 92, cells: 4 }] } as const;
/** Faceplate layout (metres, relative to the face centre): the three windows, largest (fare) on top. */
const WINDOWS = [{ x: .02, y: .036, w: .13, h: .04 }, { x: .0, y: -.011, w: .07, h: .022 }, { x: .0, y: -.04, w: .07, h: .022 }];
/** Lamps (FOR HIRE, HIRED) and buttons, in the same faceplate metres. */
const LAMPS = [{ x: .06, y: -.011 }, { x: .06, y: -.04 }], BUTTONS = [{ x: .066, y: -.064 }, { x: .086, y: -.064 }];

function canvas(width: number, height: number) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = width; c.height = height; const ctx = c.getContext('2d');
  return ctx ? { canvas: c, ctx } : null;
}

/** The printed cream faceplate: row labels, the units, the demo-tariff notice and a plain maker's plate. */
function faceTexture(variant: MeterVariant) {
  const c = canvas(512, 384); if (!c) return null;
  const { ctx } = c, sx = 512 / .2, sy = 384 / .15, px = (x: number) => 256 + x * sx, py = (y: number) => 192 - y * sy;
  ctx.fillStyle = '#e9e0c8'; ctx.fillRect(0, 0, 512, 384);
  // Worn, slightly uneven print and a darker edge where the bezel meets the plate.
  const grad = ctx.createRadialGradient(256, 192, 60, 256, 192, 330); grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(70,55,30,.28)'); ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 384);
  ctx.textBaseline = 'middle';
  for (const [i, w] of WINDOWS.entries()) {
    ctx.fillStyle = '#141110'; ctx.fillRect(px(w.x - w.w / 2) - 6, py(w.y + w.h / 2) - 6, w.w * sx + 12, w.h * sy + 12);
    ctx.fillStyle = '#2a2420'; ctx.textAlign = 'right';
    const left = px(w.x - w.w / 2) - 14;
    if (i === 0) { ctx.font = 'bold 22px Arial, sans-serif'; ctx.fillText('FARE', left, py(w.y) - 22); ctx.font = 'bold 44px Arial, sans-serif'; ctx.fillText('₹', left, py(w.y) + 20); }
    else { ctx.font = 'bold 18px Arial, sans-serif'; ctx.fillText(i === 1 ? 'WAITING' : 'DISTANCE', left, py(w.y) - 9); ctx.font = 'bold 13px Arial, sans-serif'; ctx.fillText(i === 1 ? 'MIN : SEC' : 'KM', left, py(w.y) + 12); }
  }
  ctx.textAlign = 'left'; ctx.font = 'bold 13px Arial, sans-serif';
  LAMPS.forEach((l, i) => { ctx.fillStyle = '#141110'; ctx.beginPath(); ctx.arc(px(l.x), py(l.y), 15, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2a2420'; ctx.fillText(i ? 'HIRED' : 'FOR', px(l.x) + 20, py(l.y) - (i ? 0 : 8)); if (!i) ctx.fillText('HIRE', px(l.x) + 20, py(l.y) + 8); });
  BUTTONS.forEach(b => { ctx.fillStyle = '#3b332c'; ctx.beginPath(); ctx.arc(px(b.x), py(b.y), 22, 0, Math.PI * 2); ctx.fill(); });
  // Maker's plate: a generic name, never a real brand, and the demo-tariff notice.
  ctx.fillStyle = '#1d4f8f'; ctx.fillRect(px(-.095), py(-.052), (.04 + .095) * sx, .024 * sy); ctx.fillStyle = '#f2ead6'; ctx.textAlign = 'center';
  const mid = px((-.095 + .04) / 2);
  ctx.font = 'bold 15px Arial, sans-serif'; ctx.fillText(variant === 'auto' ? 'ELECTRONIC FARE METER · AUTO' : 'ELECTRONIC FARE METER · TAXI', mid, py(-.058));
  ctx.font = 'bold 9.5px Arial, sans-serif'; ctx.fillText(DEMO_FARE_LABEL, mid, py(-.069));
  const texture = new THREE.CanvasTexture(c.canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; return texture;
}

export function createPhysicalMeter(variant: MeterVariant): PhysicalMeter {
  const group = new THREE.Group(); group.name = `${variant}:physical-meter`;
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [], textures: THREE.Texture[] = [];
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], name: string) => {
    geometries.push(geometry); const m = new THREE.Mesh(geometry, material); m.position.set(...position); m.name = `${variant}:meter-${name}`; group.add(m); return m;
  };
  const plastic = new THREE.MeshStandardMaterial({ color: '#141617', roughness: .58, metalness: .05 });
  const bracketMetal = new THREE.MeshStandardMaterial({ color: '#2b2e30', roughness: .45, metalness: .6 });
  const screwMetal = new THREE.MeshStandardMaterial({ color: '#8d8f88', roughness: .35, metalness: .85 });
  const face = faceTexture(variant); if (face) textures.push(face);
  const plate = new THREE.MeshStandardMaterial({ color: face ? '#ffffff' : '#e9e0c8', map: face, roughness: .62 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#2a1512', roughness: .08, metalness: 0, transparent: true, opacity: .32, depthWrite: false });
  materials.push(plastic, bracketMetal, screwMetal, plate, glass);

  // Case: a bevelled moulding; the taxi's is squarer and shallower. The face looks along +z (towards the passenger).
  const [cw, ch, cd] = variant === 'auto' ? [.2, .15, .075] : [.19, .14, .06];
  mesh(new RoundedBoxGeometry(cw, ch, cd, 3, .012), plastic, [0, 0, 0], 'case');
  // Raised bezel round an inset faceplate.
  const bezel = new THREE.Shape(); bezel.moveTo(-cw / 2 + .006, -ch / 2 + .006); bezel.lineTo(cw / 2 - .006, -ch / 2 + .006); bezel.lineTo(cw / 2 - .006, ch / 2 - .006); bezel.lineTo(-cw / 2 + .006, ch / 2 - .006);
  const hole = new THREE.Path(); hole.moveTo(-cw / 2 + .014, -ch / 2 + .014); hole.lineTo(-cw / 2 + .014, ch / 2 - .014); hole.lineTo(cw / 2 - .014, ch / 2 - .014); hole.lineTo(cw / 2 - .014, -ch / 2 + .014); bezel.holes.push(hole);
  mesh(new THREE.ExtrudeGeometry(bezel, { depth: .006, bevelEnabled: false }), plastic, [0, 0, cd / 2 - .001], 'bezel');
  const faceZ = cd / 2 + .001;
  mesh(new THREE.PlaneGeometry(cw - .028, ch - .028), plate, [0, 0, faceZ], 'faceplate');
  // LED windows: a shared display texture on three quads, each in its own black surround, behind glass.
  const display = canvas(DISPLAY.width, DISPLAY.height);
  const displayTexture = display ? new THREE.CanvasTexture(display.canvas) : null;
  if (displayTexture) { displayTexture.colorSpace = THREE.SRGBColorSpace; displayTexture.anisotropy = 4; textures.push(displayTexture); }
  const led = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: displayTexture, emissiveIntensity: displayTexture ? 1.4 : 0, roughness: .3 });
  materials.push(led);
  const scale = (cw - .028) / .2;
  WINDOWS.forEach((w, i) => {
    const row = DISPLAY.rows[i], quad = new THREE.PlaneGeometry(w.w * scale, w.h * scale), uv = quad.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k), 1 - (row.y + (1 - uv.getY(k)) * row.h) / DISPLAY.height);
    const x = w.x * scale, y = w.y * scale, ww = w.w * scale, wh = w.h * scale, t = .003;
    // The LED face sits 1 mm proud of the plate inside a 6 mm deep black surround, under glass at its front.
    mesh(quad, led, [x, y, faceZ + .001], `display-${i}`);
    for (const [bx, by, bw, bh] of [[0, wh / 2 + t / 2, ww + 2 * t, t], [0, -wh / 2 - t / 2, ww + 2 * t, t], [-ww / 2 - t / 2, 0, t, wh], [ww / 2 + t / 2, 0, t, wh]]) mesh(new THREE.BoxGeometry(bw, bh, .006), plastic, [x + bx, y + by, faceZ + .003], `surround-${i}`);
    mesh(new THREE.PlaneGeometry(ww, wh), glass, [x, y, faceZ + .0055], `glass-${i}`);
  });
  // FOR HIRE (green) and HIRED (red) lamps beside the lower rows.
  const lampGeometry = new THREE.CylinderGeometry(.0042, .0042, .004, 12).rotateX(Math.PI / 2);
  const green = new THREE.MeshStandardMaterial({ color: '#1f3a22', emissive: '#37ff5a', emissiveIntensity: 0, roughness: .3 });
  const red = new THREE.MeshStandardMaterial({ color: '#3a1715', emissive: '#ff2a1a', emissiveIntensity: 0, roughness: .3 });
  materials.push(green, red);
  mesh(lampGeometry, green, [LAMPS[0].x * scale, LAMPS[0].y * scale, faceZ + .002], 'lamp-hire');
  mesh(lampGeometry.clone(), red, [LAMPS[1].x * scale, LAMPS[1].y * scale, faceZ + .002], 'lamp-hired');
  // Two push buttons beside the maker's plate and a screw in each corner of the plate.
  for (const b of BUTTONS) mesh(new THREE.CylinderGeometry(.0065, .007, .006, 14).rotateX(Math.PI / 2), plastic, [b.x * scale, b.y * scale, faceZ + .003], 'button');
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.CylinderGeometry(.0028, .0028, .003, 10).rotateX(Math.PI / 2), screwMetal, [x * (cw / 2 - .02), y * (ch / 2 - .019), faceZ + .0015], 'screw');
  // Mounting: the auto's meter stands on a pedestal stalk with a clamp; the taxi's sits on a dashboard foot.
  if (variant === 'auto') {
    mesh(new THREE.BoxGeometry(.06, .012, .05), bracketMetal, [0, -ch / 2 - .006, 0], 'bracket-plate');
    mesh(new THREE.CylinderGeometry(.011, .013, .05, 12), bracketMetal, [0, -ch / 2 - .037, -.005], 'pedestal');
    mesh(new THREE.BoxGeometry(.05, .02, .045), bracketMetal, [0, -ch / 2 - .072, -.005], 'clamp');
  } else {
    mesh(new THREE.BoxGeometry(.16, .014, .07), bracketMetal, [0, -ch / 2 - .007, -.006], 'foot');
    for (const x of [-.07, .07]) mesh(new THREE.BoxGeometry(.01, .04, .05), bracketMetal, [x, -ch / 2 + .012, -.006], 'cheek');
  }
  group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = m.material !== glass; m.receiveShadow = true; } });

  let shown = '';
  return {
    group,
    show(reading) {
      const rows = meterRows(reading), key = `${reading.state}|${rows.fare}|${rows.middle}|${rows.distance}`;
      if (key === shown) return; shown = key;
      green.emissiveIntensity = reading.state === 'READY' ? 2.2 : 0; red.emissiveIntensity = reading.state === 'OFF' || reading.state === 'READY' ? 0 : 2.2;
      if (!display || !displayTexture) return;
      const { ctx } = display; ctx.fillStyle = '#0c0606'; ctx.fillRect(0, 0, DISPLAY.width, DISPLAY.height);
      const texts = [rows.fare, rows.middle, rows.distance];
      DISPLAY.rows.forEach((row, i) => drawSegments(ctx, texts[i], row.cells, 14, row.y + row.h * .1, DISPLAY.width - 28, row.h * .8));
      displayTexture.needsUpdate = true;
    },
    dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); },
  };
}
