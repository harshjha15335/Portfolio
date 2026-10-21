import * as THREE from 'three';
import { seededRandom } from '../StreetArchitecture';

/** Metres covered by one repeat of the façade texture: four 3 m bays by four 3 m floors. */
export const FACADE_TILE = 12;
/** V coordinate of the plain strip reserved at the top of the texture for roofs and slab ends. */
export const FACADE_PLAIN_V = .985;

let shared: THREE.CanvasTexture | null = null;

/**
 * An original, painted Mumbai apartment façade: render-and-paint walls with window frames,
 * grills, curtains, box AC units, chajja sunshades and monsoon run-off below every sill.
 * The wall is near-white so each building's vertex colour tints it; one texture serves every
 * district (it is shared, never disposed with a district).
 */
export function facadeTexture() {
  if (shared) return shared;
  const size = 1024, px = size / FACADE_TILE, c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d')!, random = seededRandom('district:facade');
  const rgba = (v: number, a: number) => `rgba(${v},${v},${v},${a})`;
  ctx.fillStyle = '#e9e4da'; ctx.fillRect(0, 0, size, size);
  // Render texture: speckle and large damp patches.
  for (let i = 0; i < 9000; i++) { const v = 170 + random() * 80; ctx.fillStyle = rgba(v, .16); ctx.fillRect(random() * size, random() * size, 1 + random() * 3, 1 + random() * 3); }
  for (let i = 0; i < 26; i++) {
    const x = random() * size, y = random() * size, r = 30 + random() * 120, g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(70,64,52,.16)'); g.addColorStop(1, 'rgba(70,64,52,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const curtains = ['#b8574a', '#d8c9a6', '#5b7fa3', '#c99a3e', '#7c8f6a', '#e6ddd0', '#8a5a7a'];
  for (let floor = 0; floor < 4; floor++) for (let bay = 0; bay < 4; bay++) {
    // Canvas y grows downwards; floor 0 sits at the bottom of the tile.
    const x0 = bay * 3 * px, top = size - (floor + 1) * 3 * px, ww = 1.55 * px, wh = 1.35 * px, wx = x0 + (3 * px - ww) / 2, wy = top + .75 * px;
    // Slab band and its shadow.
    ctx.fillStyle = rgba(120, .35); ctx.fillRect(x0, top + 3 * px - .22 * px, 3 * px, .22 * px);
    ctx.fillStyle = rgba(255, .5); ctx.fillRect(x0, top + 3 * px - .26 * px, 3 * px, .04 * px);
    const kind = random();
    // Run-off streaks from the sill.
    for (let s = 0; s < 6; s++) { const sx = wx + random() * ww, len = (.4 + random() * 1.1) * px; const g = ctx.createLinearGradient(0, wy + wh, 0, wy + wh + len); g.addColorStop(0, 'rgba(60,52,40,.28)'); g.addColorStop(1, 'rgba(60,52,40,0)'); ctx.fillStyle = g; ctx.fillRect(sx, wy + wh, 2 + random() * 5, len); }
    // Frame, glass with a sky-to-ground reflection, and inner life.
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(wx - 7, wy - 7, ww + 14, wh + 14);
    const glass = ctx.createLinearGradient(0, wy, 0, wy + wh); glass.addColorStop(0, '#6d7f8a'); glass.addColorStop(.45, '#33414a'); glass.addColorStop(1, '#1d2429');
    ctx.fillStyle = glass; ctx.fillRect(wx, wy, ww, wh);
    if (kind < .5) { ctx.fillStyle = curtains[Math.floor(random() * curtains.length)]; const cw = ww * (.25 + random() * .3); ctx.fillRect(random() > .5 ? wx : wx + ww - cw, wy, cw, wh); }
    else if (kind < .62) { ctx.fillStyle = '#f2c47a'; ctx.globalAlpha = .75; ctx.fillRect(wx, wy, ww, wh); ctx.globalAlpha = 1; }
    // Mullions.
    ctx.fillStyle = '#d9d4ca'; ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh); ctx.fillRect(wx, wy + wh * .32, ww, 5);
    // Grill on lower floors, or a projecting box grill.
    if (floor < 2 || random() > .55) { ctx.fillStyle = 'rgba(40,44,46,.85)'; for (let gx = wx - 4; gx <= wx + ww + 4; gx += 13) ctx.fillRect(gx, wy - 4, 3, wh + 8); ctx.fillRect(wx - 6, wy + wh * .5, ww + 12, 3); }
    // Chajja sunshade with its shadow.
    ctx.fillStyle = rgba(225, 1); ctx.fillRect(wx - 18, wy - 24, ww + 36, 12);
    const shadow = ctx.createLinearGradient(0, wy - 12, 0, wy + 26); shadow.addColorStop(0, 'rgba(30,26,20,.45)'); shadow.addColorStop(1, 'rgba(30,26,20,0)'); ctx.fillStyle = shadow; ctx.fillRect(wx - 10, wy - 12, ww + 20, 38);
    // Box AC unit under some windows.
    if (random() > .5) {
      const ax = wx + (random() > .5 ? ww * .55 : 0), ay = wy + wh + .2 * px, aw = .8 * px, ah = .55 * px;
      ctx.fillStyle = '#d6d5cf'; ctx.fillRect(ax, ay, aw, ah); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(ax, ay + ah, aw, 6);
      ctx.fillStyle = 'rgba(70,70,70,.6)'; for (let gy = ay + 6; gy < ay + ah - 4; gy += 6) ctx.fillRect(ax + 6, gy, aw * .55, 2);
      ctx.beginPath(); ctx.arc(ax + aw * .8, ay + ah / 2, ah * .32, 0, Math.PI * 2); ctx.fillStyle = 'rgba(60,60,60,.55)'; ctx.fill();
      const drip = ctx.createLinearGradient(0, ay + ah, 0, ay + ah + px); drip.addColorStop(0, 'rgba(50,46,36,.35)'); drip.addColorStop(1, 'rgba(50,46,36,0)'); ctx.fillStyle = drip; ctx.fillRect(ax + aw * .2, ay + ah, 5, px);
    }
  }
  // Drain pipes down two bay joints.
  for (const x of [3 * px - 4, 9 * px - 4]) { ctx.fillStyle = 'rgba(55,58,56,.75)'; ctx.fillRect(x, 0, 7, size); }
  // Plain strip for roofs and slab ends.
  ctx.fillStyle = '#ddd7cb'; ctx.fillRect(0, 0, size, Math.round(size * (1 - FACADE_PLAIN_V) * 2));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  shared = t; return t;
}

let night: THREE.CanvasTexture | null = null;
/**
 * The same window grid as `facadeTexture`, as an emissive mask: after dark about half the flats are lit, in warm
 * tungsten, cool tube-light or dim TV-blue, some only behind a curtain edge; everything else stays black. Varied, so a
 * block never glows uniformly. Shared like the façade itself.
 */
export function facadeNightTexture() {
  if (night) return night;
  const size = 256, px = size / FACADE_TILE, c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d')!, random = seededRandom('district:facade-night');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  const tones = ['#ffc77a', '#ffb860', '#ffd9a0', '#e6efff', '#cfe0ff', '#7f9cff'];
  for (let floor = 0; floor < 4; floor++) for (let bay = 0; bay < 4; bay++) {
    const x0 = bay * 3 * px, top = size - (floor + 1) * 3 * px, ww = 1.55 * px, wh = 1.35 * px, wx = x0 + (3 * px - ww) / 2, wy = top + .75 * px;
    if (random() > .55) continue;
    const tone = tones[Math.floor(random() * tones.length)], dim = .45 + random() * .55;
    ctx.globalAlpha = dim; ctx.fillStyle = tone; ctx.fillRect(wx, wy, ww, wh);
    // A drawn curtain hides part of some lit windows.
    if (random() > .6) { ctx.globalAlpha = 1; ctx.fillStyle = '#000'; const cw = ww * (.3 + random() * .4); ctx.fillRect(random() > .5 ? wx : wx + ww - cw, wy, cw, wh); }
    ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh); ctx.fillRect(wx, wy + wh * .32, ww, 1.5);
  }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, Math.round(size * (1 - FACADE_PLAIN_V) * 2));
  night = new THREE.CanvasTexture(c); night.colorSpace = THREE.SRGBColorSpace; night.wrapS = night.wrapT = THREE.RepeatWrapping;
  return night;
}
