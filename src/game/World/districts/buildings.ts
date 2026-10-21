import * as THREE from 'three';
import { canopyTree, coconutPalm, type TreeSpecies } from './nature';
import type { DistrictKit } from './DistrictKit';
import { placed, type SignAtlas, type SignStyle } from './DistrictSystems';
import type { V3 } from './ColorMesh';

/**
 * Building and prop vocabulary for the districts. Every function draws in a FACADE FRAME:
 * the street face is the plane z = 0 looking towards +z, the mass extends to −z, x runs
 * along the street and y is up. Callers place the frame with kit.frame(...).
 */
export interface Ctx { kit: DistrictKit; signs: SignAtlas }
const shade = (c: string, k: number) => new THREE.Color(c).multiplyScalar(k).getStyle();
const pick = <T,>(kit: DistrictKit, list: T[]) => list[Math.floor(kit.rand() * list.length)];
export const PASTELS = ['#d8c6a6', '#c8b69d', '#b7c3b9', '#d6b59c', '#a9b7bd', '#dfd0b0', '#c4a78c', '#b3a591', '#cdb9a8', '#bfc7b0'];
const SHOP_COLORS = ['#244a5c', '#7d2a24', '#2f5a3a', '#7a5a1d', '#3a3a6a', '#1f1f1f', '#a33a2a', '#0f5e5a'];

export function sign({ kit, signs }: Ctx, text: string, width: number, position: V3, style: SignStyle = {}, px: [number, number] = [512, 128], rotationY = 0) {
  return signs.add(text, width, placed(position, rotationY, kit.here), style, px);
}

/* --------------------------------------------------------------- windows */
function windowBay(c: Ctx, x: number, y: number, style: string, wall: string, trim: string, lit: boolean, extra: number) {
  const { kit } = c, w = style === 'deco' ? 1.5 : 1.2, h = style === 'deco' ? 1.25 : 1.4;
  kit.box([w, h, .05], [x, y, .015], lit ? '#d9b26e' : '#283338', lit ? 'glow' : 'glass');
  if (!lit) kit.box([w * .45, h * .92, .02], [x - w * .24, y, .045], pick(kit, ['#8a7a62', '#6e7c78', '#9b8a6e', '#a36b4d']), 'fabric');
  kit.box([w + .22, .08, .26], [x, y - h / 2 - .05, .1], trim, 'stone');
  kit.box([w + .18, .1, .14], [x, y + h / 2 + .05, .06], trim, 'stone');
  for (const s of [-1, 1]) kit.box([.08, h + .1, .1], [x + s * (w / 2 + .05), y, .04], shade(wall, .92), 'plaster');
  if (extra < .3) { // Mumbai window grille cage with a potted plant.
    kit.box([w + .1, .04, .42], [x, y - h / 2 - .02, .24], '#3f4542', 'metal'); kit.box([w + .1, .04, .42], [x, y + h / 2 + .02, .24], '#3f4542', 'metal');
    for (let i = 0; i < 5; i++) kit.box([.022, h + .02, .022], [x - w / 2 + i * w / 4, y, .44], '#3f4542', 'metal');
    if (extra < .14) kit.shape('sphere', [.16, .13, .14], [x + w * .25, y - h / 2 + .14, .3], '#4f7d3c', 'foliage');
  } else if (extra < .42) { // Split air-conditioner box.
    kit.box([.72, .46, .36], [x + w / 2 + .5, y - .35, .2], '#d7d6cf', 'metal'); for (let i = 0; i < 4; i++) kit.box([.62, .02, .02], [x + w / 2 + .5, y - .52 + i * .09, .385], '#6f7470');
  }
}
function balcony(c: Ctx, x: number, y: number, width: number, trim: string) {
  const { kit } = c; kit.box([width, .13, 1.0], [x, y, .5], trim, 'stone');
  kit.box([width, .05, .05], [x, y + .95, .98], '#4a4f4b', 'metal');
  for (let i = 0; i <= Math.round(width / .28); i++) kit.box([.025, .9, .025], [x - width / 2 + i * width / Math.round(width / .28), y + .5, .98], '#4a4f4b', 'metal');
  for (const s of [-1, 1]) kit.box([.05, .9, 1.0], [x + s * width / 2, y + .5, .5], '#4a4f4b', 'metal');
}
function roofKit(c: Ctx, w: number, d: number, H: number) {
  const { kit } = c;
  kit.cylinder(.65, 1.1, [w * .25, H + .6, -d * .5], '#2a2d2b', 'solid'); kit.cylinder(.68, .08, [w * .25, H + 1.18, -d * .5], '#1e201f');
  kit.box([2.4, 2.2, 2.6], [-w * .28, H + 1.1, -d * .55], '#b9ad98', 'plaster');
  if (kit.rand() > .5) { kit.shape('sphere', [.38, .12, .38], [w * .05, H + .7, -1.4], '#c9c9c2', 'metal', [.6, 0, 0]); kit.rod([w * .05, H, -1.4], [w * .05, H + .6, -1.4], .02, '#777'); }
}

/* --------------------------------------------------------------- shops */
export function shopRow(c: Ctx, w: number, names: Array<[string, string?]>, wall: string, o: { awnings?: boolean; signY?: number; goods?: string[] } = {}) {
  const { kit } = c, bays = Math.max(1, names.length), bw = w / bays;
  for (let i = 0; i < bays; i++) {
    const cx = -w / 2 + bw * (i + .5), open = (i + Math.round(w)) % 4 !== 1, [en, local] = names[i];
    kit.box([bw - .5, 2.7, .3], [cx, 1.4, -.25], '#2a2420', 'solid');
    if (open) {
      kit.box([bw - .7, .07, .07], [cx, 2.66, -.05], '#ffd9a0', 'glow');
      kit.box([bw - .6, 2.5, .05], [cx, 1.3, -.38], pick(kit, ['#d8c4a0', '#c9d4cf', '#e3d7c3']), 'plaster');
      const goods = o.goods ?? ['#c9463d', '#e0b43c', '#3f7fbf', '#5aa05a', '#e07a30', '#d5d5d0', '#7a4a8a'];
      for (const shelf of [.65, 1.25, 1.85]) { kit.box([bw - .7, .05, .4], [cx, shelf, -.2], '#8a6a48', 'wood'); for (let n = 0; n < 6; n++) kit.box([.32, .22 + kit.rand() * .18, .26], [cx - bw / 2 + .55 + n * (bw - 1.1) / 5, shelf + .15, -.2], pick(kit, goods)); }
      kit.box([bw - .9, .85, .55], [cx, .43, .25], '#7a5d43', 'wood');
    } else {
      kit.box([bw - .5, 2.55, .06], [cx, 1.32, .02], '#8f918a', 'metal');
      for (let y = .3; y < 2.6; y += .16) kit.box([bw - .48, .03, .03], [cx, y, .06], '#6b6e69', 'metal');
      kit.box([.5, .03, .04], [cx, .25, .09], '#3a3a3a', 'metal');
    }
    for (const s of [-1, 1]) kit.box([.32, 3.4, .4], [cx + s * bw / 2, 1.7, 0], wall, 'plaster');
    const bg = pick(kit, SHOP_COLORS);
    sign(c, en, bw - .35, [cx, o.signY ?? 3.0, .24], { bg, fg: '#f4e6c0', local }, [384, 96]);
    if (o.awnings !== false && kit.rand() > .25) kit.shape('box', [bw - .3, .05, 1.2], [cx, 2.48, .65], pick(kit, ['#2c6f8f', '#b23a32', '#3d7a4f', '#c7892f', '#5a4a8a', '#2b5d9b']), 'fabric', [.28, 0, 0]);
  }
}

/* --------------------------------------------------------------- mid-rise */
export interface MidriseOptions { w: number; d?: number; floors: number; floorH?: number; color?: string; trim?: string; style?: 'concrete' | 'deco' | 'chawl'; ground?: 'shops' | 'lobby' | 'wall' | 'none'; shops?: Array<[string, string?]>; name?: [string, string?]; corner?: boolean; laundry?: boolean }
export function midrise(c: Ctx, o: MidriseOptions) {
  const { kit } = c, d = o.d ?? 12, fh = o.floorH ?? 3.0, color = o.color ?? pick(kit, PASTELS), trim = o.trim ?? shade(color, 1.08), style = o.style ?? 'concrete', G = 3.6, H = G + o.floors * fh, w = o.w;
  kit.box([w, H, d], [0, H / 2, -d / 2], color, 'plaster'); kit.solid([w, H, d], [0, H / 2, -d / 2]);
  kit.box([w + .06, .4, .16], [0, .2, .05], shade(color, .7), 'stone');
  if (o.ground === 'shops') shopRow(c, w, o.shops ?? [['GENERAL STORES', 'किराना']], color);
  else if (o.ground === 'lobby') { kit.box([w * .5, 2.8, .3], [0, 1.4, -.1], '#2e3a3c', 'glass'); kit.box([w * .55, .15, 1.6], [0, 3.0, .8], shade(color, .9), 'stone'); kit.box([w * .4, .06, .06], [0, 2.85, .3], '#ffe1ae', 'glow'); }
  else if (o.ground === 'wall') { kit.box([w, 1.6, .25], [0, .8, 1.2], shade(color, .95), 'plaster'); kit.solid([w, 1.6, .25], [0, .8, 1.2]); for (let x = -w / 2 + 1; x < w / 2; x += 2.2) kit.shape('sphere', [.7, .6, .5], [x, 1.9, .9], '#5c8a43', 'foliage'); }
  if (o.name) sign(c, o.name[0], Math.min(w * .4, 4.6), [0, G - .15, .3], { bg: '#1d2b33', fg: '#f2e6c4', local: o.name[1], tier: 1 });
  const n = Math.max(2, Math.round(w / (style === 'deco' ? 2.8 : 2.4))), step = w / n;
  for (let f = 0; f < o.floors; f++) {
    const y0 = G + f * fh, wy = y0 + fh * .5;
    kit.box([w + .08, .18, .14], [0, y0, .06], trim, 'stone');
    if (style === 'chawl') {
      kit.box([w, .16, 1.6], [0, y0 + .02, .8], shade(color, .9), 'stone');
      kit.box([w, .07, .07], [0, y0 + 1.05, 1.58], '#4b544e', 'metal'); kit.box([w, .04, .04], [0, y0 + .55, 1.58], '#4b544e', 'metal');
      for (let x = -w / 2; x <= w / 2 + .01; x += .55) kit.box([.03, 1.0, .03], [x, y0 + .55, 1.58], '#4b544e', 'metal');
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + step * (i + .5);
        kit.box([.95, 2.1, .06], [x - .5, y0 + 1.07, .02], pick(kit, ['#3f6c84', '#6b4a32', '#3e6b4a', '#8a3b2f', '#55606a']), 'wood');
        kit.box([.75, .9, .05], [x + .55, y0 + 1.45, .02], '#273034', 'glass'); kit.box([.85, .06, .2], [x + .55, y0 + .98, .1], trim, 'stone');
        if (o.laundry !== false && kit.rand() > .35) for (let k = 0; k < 3; k++) { const cl = kit.shape('box', [.32 + kit.rand() * .3, .5 + kit.rand() * .35, .02], [x - .6 + k * .45, y0 + .78, 1.62], pick(kit, ['#d94f4f', '#f1e6d2', '#3f7fbf', '#e8b64a', '#7a4a8a', '#5aa05a', '#f08aa0']), 'fabric', [0, 0, (kit.rand() - .5) * .1]); void cl; }
        if (kit.rand() > .7) kit.shape('sphere', [.22, .2, .22], [x + 1.1, y0 + .3, 1.3], '#557f3c', 'foliage');
      }
      kit.rod([-w / 2 + .4, y0 + 2.4, 1.5], [w / 2 - .4, y0 + 2.4, 1.5], .012, '#3a3a3a');
    } else {
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + step * (i + .5), r = kit.rand();
        windowBay(c, x, wy, style, color, trim, r > .9, kit.rand());
        if (style === 'deco' && i % 3 === 1 && f > 0) balcony(c, x, y0 + .05, step * .9, trim);
        else if (style === 'concrete' && r < .18) balcony(c, x, y0 + .05, step * .85, trim);
      }
      if (style === 'deco') kit.box([w, .07, .55], [0, wy + .88, .28], trim, 'stone');
    }
  }
  if (style === 'deco') {
    // The central fin rises from above the ground floor, so it never covers a shop board or the name over the entrance.
    const fin = G + .7; kit.box([1.2, H + 2.2 - fin, .5], [0, fin + (H + 2.2 - fin) / 2, .2], trim, 'plaster');
    for (let i = 0; i < 3; i++) kit.box([w * (.55 - i * .14), .3, .35], [0, H + .45 + i * .3, .05], trim, 'stone');
    if (o.corner) { kit.cylinder(1.8, H, [w / 2 - .4, H / 2, -1.4], color, 'plaster'); for (let f = 0; f < o.floors; f++) kit.cylinder(1.9, .08, [w / 2 - .4, G + f * fh + fh * .9, -1.4], trim, 'stone'); kit.solid([3.6, H, 3.6], [w / 2 - .4, H / 2, -1.4]); }
  }
  if (style === 'chawl') { kit.shape('box', [w + .8, .08, d * .62], [0, H + .9, -d * .28], '#76726a', 'metal', [.28, 0, 0]); kit.shape('box', [w + .8, .08, d * .62], [0, H + .9, -d * .76], '#6f6b63', 'metal', [-.28, 0, 0]); }
  else { kit.box([w + .16, .7, .22], [0, H + .35, 0], color, 'plaster'); kit.box([w + .3, .12, .34], [0, H + .74, .02], trim, 'stone'); roofKit(c, w, d, H); }
  for (const s of [-1, 1]) kit.rod([s * (w / 2 - .25), .1, .12], [s * (w / 2 - .25), H, .12], .05, '#6e716b', 'metal');
  return H;
}

/* --------------------------------------------------------------- towers */
export function glassTower(c: Ctx, o: { w: number; d: number; h: number; glass?: string; frame?: string; podium?: string; name?: string; nameLocal?: string; crown?: boolean }) {
  const { kit } = c, glass = o.glass ?? '#4f6a78', frame = o.frame ?? '#c9ccc8', P = 6.5, { w, d, h } = o;
  kit.box([w, h - P, d], [0, P + (h - P) / 2, -d / 2], glass, 'glass'); kit.solid([w, h, d], [0, h / 2, -d / 2]);
  for (let x = -w / 2; x <= w / 2 + .01; x += 1.6) kit.box([.1, h - P, .3], [x, P + (h - P) / 2, .12], frame, 'metal');
  for (let z = -d; z <= .01; z += 2) for (const s of [-1, 1]) kit.box([.3, h - P, .1], [s * (w / 2 + .12), P + (h - P) / 2, z], frame, 'metal');
  for (let y = P; y < h; y += 3.7) { kit.box([w + .2, .42, .2], [0, y, .07], shade(frame, .82), 'metal'); for (const s of [-1, 1]) kit.box([.2, .42, d], [s * (w / 2 + .07), y, -d / 2], shade(frame, .82), 'metal'); }
  for (let y = P + 1.8; y < h - 2; y += 3.7) if (kit.rand() > .55) kit.box([1.4 + kit.rand() * 4, 1.1, .03], [(kit.rand() - .5) * (w - 4), y, .02], '#e9cf98', 'glow');
  // Podium: double-height lobby with canopy and stone base.
  kit.box([w, P, d], [0, P / 2, -d / 2 - 1.5], o.podium ?? '#d7d1c4', 'stone');
  kit.box([w * .7, P - 1.2, .2], [0, (P - 1.2) / 2, -1.3], '#2c3c42', 'glass'); kit.box([w * .66, .08, .08], [0, P - 1.4, -1.1], '#ffe7bd', 'glow');
  for (let x = -w / 2 + 1; x < w / 2; x += 3) kit.box([.5, P, .5], [x, P / 2, -.3], o.podium ?? '#d7d1c4', 'stone');
  kit.box([w * .5, .25, 3.2], [0, 4.4, 1.2], shade(frame, .9), 'metal'); for (const s of [-1, 1]) kit.rod([s * w * .22, 0, 2.6], [s * w * .22, 4.3, 2.6], .09, '#aeb1ad');
  if (o.name) sign(c, o.name, Math.min(w * .7, 10), [0, P - .6, .45], { bg: '#18242c', fg: '#e9f1f4', border: 'none', local: o.nameLocal, tier: 1 }, [1024, 192]);
  if (o.crown !== false) { kit.box([w * .7, 3, d * .7], [0, h + 1.5, -d / 2], frame, 'metal'); kit.rod([0, h + 3, -d / 2], [0, h + 9, -d / 2], .12, '#9a9d98'); }
}

export function neoclassical(c: Ctx, o: { w: number; d: number; floors: number; color?: string; dome?: boolean; name?: string }) {
  const { kit } = c, color = o.color ?? '#e6dcc6', trim = '#f4eee0', G = 5, fh = 3.1, H = G + o.floors * fh, { w, d } = o;
  kit.box([w, H, d], [0, H / 2, -d / 2], color, 'plaster'); kit.solid([w, H, d], [0, H / 2, -d / 2]);
  for (let x = -w / 2 + 1.5; x < w / 2; x += 3) kit.box([.55, H - G, .3], [x, G + (H - G) / 2, .15], trim, 'stone');
  for (let f = 0; f < o.floors; f++) {
    const y = G + f * fh + fh * .5;
    for (let x = -w / 2 + 3; x < w / 2 - 1; x += 3) { kit.box([1.3, 1.6, .05], [x, y, .02], kit.rand() > .9 ? '#e6c88c' : '#33424a', kit.rand() > .9 ? 'glow' : 'glass'); kit.box([1.5, .1, .25], [x, y - .85, .12], trim, 'stone'); kit.box([1.6, .22, .2], [x, y + .9, .1], trim, 'stone'); }
    if (f % 4 === 3) kit.box([w + .5, .35, .5], [0, G + (f + 1) * fh, .2], trim, 'stone');
  }
  // Colonnaded podium with an entablature.
  kit.box([w + .6, .6, 2.6], [0, G - .3, 1.1], trim, 'stone'); for (let x = -w / 2 + 1; x <= w / 2 - .9; x += 2.4) kit.cylinder(.28, G - .6, [x, (G - .6) / 2, 2.0], trim, 'stone');
  kit.box([w * .6, 3.4, .2], [0, 1.7, -.2], '#2f3b3f', 'glass'); kit.box([w * .55, .07, .07], [0, 3.3, 0], '#ffe1ae', 'glow');
  // The name runs across the second floor, above anything built in front of a set-back block (Powai's lab pods).
  if (o.name) sign(c, o.name, Math.min(10, w * .6), [0, G + fh * 2, .48], { bg: '#efe6d1', fg: '#5a4630', border: 'none', tier: 1 }, [1024, 160]);
  kit.box([w + .8, .5, d + .8], [0, H + .25, -d / 2], trim, 'stone');
  if (o.dome !== false) { kit.cylinder(3.2, 3, [0, H + 2, -d / 2], trim, 'stone'); for (let a = 0; a < 12; a++) kit.box([.3, 2.6, .3], [Math.cos(a / 12 * Math.PI * 2) * 3.25, H + 2, -d / 2 + Math.sin(a / 12 * Math.PI * 2) * 3.25], color, 'stone'); kit.shape('sphere', [3.3, 2.8, 3.3], [0, H + 3.5, -d / 2], '#c8a76a', 'metal'); kit.rod([0, H + 6, -d / 2], [0, H + 8, -d / 2], .1, '#c8a76a'); }
  return H;
}

export function bungalow(c: Ctx, o: { w: number; d: number; color?: string; name?: [string, string?]; studio?: boolean }) {
  const { kit } = c, color = o.color ?? '#efe7d6', { w, d } = o, H = 6.6;
  kit.box([w + 2, 1.7, .25], [0, .85, 2.2], '#d9cfbb', 'plaster'); kit.solid([w + 2, 1.7, .25], [0, .85, 2.2]);
  kit.box([w + 2.1, .12, .35], [0, 1.75, 2.2], '#bfb39b', 'stone');
  kit.box([2.6, 1.9, .08], [w * .3, .95, 2.25], '#3d4a44', 'metal');
  for (let x = -w / 2; x < w / 2; x += 1.6) kit.shape('sphere', [.55 + kit.rand() * .2, .45, .4], [x, 1.95, 2.15], kit.rand() > .5 ? '#c4447a' : '#5e8b44', 'foliage');
  kit.box([w, H, d], [0, H / 2, -d / 2 - 1], color, 'plaster'); kit.solid([w, H, d], [0, H / 2, -d / 2 - 1]);
  if (o.studio) { kit.box([w * .55, H - 1.2, .1], [-w * .15, (H - 1.2) / 2 + .2, -.95], '#d9b679', 'glow'); for (let x = -w * .42; x <= w * .12; x += 1.1) kit.box([.08, H - 1, .14], [x, H / 2, -.9], '#2b2b2b', 'metal'); }
  else for (const y of [1.6, 4.6]) for (const x of [-w * .3, 0, w * .3]) { kit.box([1.3, 1.5, .06], [x, y, -.97], '#2d393c', 'glass'); for (const s of [-1, 1]) kit.box([.6, 1.5, .06], [x + s * .98, y, -.95], '#5b7a5e', 'wood'); }
  kit.box([w + .8, .2, 2.6], [0, 3.3, .1], '#d8cdb6', 'stone'); for (const x of [-w / 2 + .5, w / 2 - .5]) kit.cylinder(.16, 3.2, [x, 1.6, 1.1], '#efe9dc', 'stone');
  for (const s of [-1, 1]) kit.shape('box', [w + 1.2, .14, d * .62], [0, H + 1.05, -1 - d / 2 + s * d * .27], '#a1503a', 'stone', [s * -.42, 0, 0]);
  if (o.name) sign(c, o.name[0], Math.min(w * .5, 5), [-w * .2, 2.85, 2.4], { bg: '#efe8da', fg: '#2c3a3f', border: 'none', local: o.name[1], tier: 1 }, [768, 160]);
}

export function hangar(c: Ctx, o: { w: number; d: number; h: number; label: string; color?: string }) {
  const { kit } = c, color = o.color ?? '#c9c2b0', { w, d, h } = o;
  kit.box([w, h, d], [0, h / 2, -d / 2], color, 'plaster'); kit.solid([w, h, d], [0, h / 2, -d / 2]);
  for (const s of [-1, 1]) kit.shape('box', [w / 2 / Math.cos(.32) + .4, .2, d + .6], [s * w / 4, h + w / 4 * Math.tan(.32), -d / 2], '#8d9290', 'metal', [0, 0, -s * .32]);
  kit.box([w * .55, h * .72, .12], [0, h * .36, .04], '#6c726f', 'metal'); for (let x = -w * .27; x < w * .27; x += .9) kit.box([.05, h * .72, .16], [x, h * .36, .08], '#596060', 'metal');
  sign(c, o.label, w * .42, [0, h * .86, .1], { bg: '#efe2b8', fg: '#2a2622', border: 'none' }, [768, 192]);
  kit.rod([w / 2 - .6, 0, .2], [w / 2 - .6, h, .2], .04, '#555'); for (let y = .4; y < h; y += .4) kit.box([.5, .03, .03], [w / 2 - .6, y, .25], '#555', 'metal');
  for (const x of [-w * .38, w * .38]) kit.box([1.2, 1.2, 2], [x, h - 1, .8], '#9aa09c', 'metal');
}

/* --------------------------------------------------------------- props */
export function streetLight(c: Ctx, x: number, z: number, side: number) {
  const { kit } = c; kit.cylinder(.08, 7.6, [x, 3.8, z], '#5a5f5c', 'metal', true); kit.box([2.2, .08, .08], [x - side * 1.05, 7.55, z], '#5a5f5c', 'metal');
  kit.box([.55, .14, .26], [x - side * 2.05, 7.48, z], '#3d413f', 'metal'); kit.box([.45, .03, .2], [x - side * 2.05, 7.4, z], '#ffe5b0', 'glow');
  // The pool of sodium-warm light it throws on the road at night (see nightLights).
  kit.shape('plane', [7, 7, 1], [x - side * 2.05, .035, z], '#ffffff', 'pool', [-Math.PI / 2, 0, 0]);
  kit.solid([.3, 3, .3], [x, 1.5, z]);
}
/** A broad street tree; see nature.canopyTree. */
export function tree(c: Ctx, x: number, z: number, h = 6, crown = '#5d7f43', size = 1, species: TreeSpecies = 'raintree') { canopyTree(c.kit, x, z, h, crown, size, species); }
/** A coconut palm; see nature.coconutPalm. */
export function palm(c: Ctx, x: number, z: number, h = 7.5, lean = .3) { coconutPalm(c.kit, x, z, h, lean); }
export function bench(c: Ctx, x: number, z: number, rotationY = 0) {
  const { kit } = c; kit.frame([x, 0, z], rotationY, () => { kit.box([1.8, .07, .45], [0, .45, 0], '#7a6046', 'wood'); kit.box([1.8, .4, .06], [0, .72, .2], '#7a6046', 'wood'); for (const s of [-1, 1]) kit.box([.07, .45, .45], [s * .8, .22, 0], '#3e4240', 'metal'); });
}
export function stall(c: Ctx, x: number, z: number, rotationY: number, tarp: string, goods: string[], label?: string, local?: string) {
  const { kit } = c;
  kit.frame([x, 0, z], rotationY, () => {
    kit.box([2.2, .85, 1.1], [0, .42, 0], '#7d5e40', 'wood'); kit.solid([2.2, 1, 1.1], [0, .5, 0]);
    for (const sx of [-1.05, 1.05]) for (const sz of [-.5, .5]) kit.rod([sx, 0, sz], [sx, 2.3, sz], .03, '#5b5b55');
    kit.shape('box', [2.6, .04, 1.8], [0, 2.35, .1], tarp, 'fabric', [.12, 0, 0]);
    for (let i = 0; i < 20; i++) kit.shape(i % 3 ? 'cylinderLow' : 'box', [.075, .06, .075], [-.95 + (i % 10) * .21, .9 + Math.floor(i / 10) * .05, -.38 + Math.floor(i / 10) * .3], pick(kit, goods));
    for (let i = 0; i < 5; i++) kit.box([.08, .4, .08], [-.9 + i * .45, 1.95, .55], pick(kit, goods), 'fabric');
    if (label) sign(c, label, 1.9, [0, 2.15, .95], { bg: tarp, fg: '#fff3d6', local }, [384, 96], 0);
  });
}
export function busStop(c: Ctx, x: number, z: number, rotationY: number, name: string) {
  const { kit } = c;
  kit.frame([x, 0, z], rotationY, () => {
    kit.box([4.2, .1, 1.7], [0, 2.6, 0], '#b8342a', 'metal'); for (const s of [-1.9, 1.9]) kit.box([.1, 2.6, .1], [s, 1.3, -.7], '#555a57', 'metal');
    kit.box([4, 1.8, .05], [0, 1.6, -.78], '#3a4a50', 'glass'); kit.box([3.6, .08, .4], [0, .48, -.5], '#8a8f8b', 'metal');
    sign(c, name, 3.4, [0, 2.85, .86], { bg: '#b8342a', fg: '#ffffff', local: 'बेस्ट · BEST' }, [768, 160]);
    kit.solid([4, 2, .2], [0, 1, -.78]);
  });
}
export function hoarding(c: Ctx, x: number, y: number, z: number, rotationY: number, w: number, draw: SignStyle['draw'], text = 'AD') {
  const { kit } = c;
  kit.frame([x, 0, z], rotationY, () => { kit.box([w + .3, w * .5 + .3, .2], [0, y, -.12], '#3b3f3c', 'metal'); for (const s of [-1, 1]) kit.rod([s * w * .3, 0, -.2], [s * w * .3, y, -.2], .1, '#4a4e4b'); sign(c, text, w, [0, y, .0], { draw }, [1024, 512]); });
}
/** Concrete wave-breaking tetrapods heaped against a sea wall. */
export function tetrapods(c: Ctx, x0: number, x1: number, z0: number, z1: number, count: number) {
  const { kit } = c;
  for (let i = 0; i < count; i++) {
    const x = x0 + kit.rand() * (x1 - x0), z = z0 + kit.rand() * (z1 - z0), y = .2 + kit.rand() * .5, s = .55 + kit.rand() * .2, col = shade('#bdb7a8', .85 + kit.rand() * .25);
    kit.frame([x, y, z], kit.rand() * 6, () => {
      const legs: V3[] = [[0, 1, 0], [.94, -.33, 0], [-.47, -.33, .82], [-.47, -.33, -.82]], tilt = kit.rand() * .8;
      for (const l of legs) { const v = new THREE.Vector3(...l).applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt); const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v)); kit.shape('cylinderLow', [.2 * s, 1.0 * s, .2 * s], [v.x * .5 * s, v.y * .5 * s, v.z * .5 * s], col, 'stone', [e.x, e.y, e.z]); }
    });
  }
}
/** A generic distant block for skylines and side-street closures. */
export function backdropBlock(c: Ctx, w: number, h: number, d: number, color: string, faceWindows = true) {
  const { kit } = c; kit.box([w, h, d], [0, h / 2, -d / 2], color, faceWindows ? 'facade' : 'plaster');
  kit.box([w + .2, .25, d + .2], [0, h + .12, -d / 2], shade(color, .85), 'stone');
}

/* --------------------------------------------------------------- skyline and street clutter */
/**
 * Relief that makes a distant block read as a building: a floor ledge every 3 m casting a line
 * of shadow, balcony fins down each face and a podium at the foot.
 */
export function towerRelief(c: Ctx, w: number, h: number, d: number, color: string) {
  const { kit } = c, ledge = shade(color, 1.08), fin = shade(color, .9);
  // Plain 'solid' boxes: twelve triangles each, where an aged surface would subdivide them.
  for (let y = 3; y < h - 1; y += 3) kit.box([w + .5, .16, d + .5], [0, y, -d / 2], ledge, 'solid');
  for (const x of [-w * .25, w * .25]) for (const z of [.25, -d - .25]) kit.box([.5, h - 4, .5], [x, h / 2 + 1, z], fin, 'solid');
  for (const x of [-w / 2 - .25, w / 2 + .25]) kit.box([.5, h - 4, .5], [x, h / 2 + 1, -d / 2], fin, 'solid');
  kit.box([w + 2, 6, d + 2], [0, 3, -d / 2], shade(color, .78), 'plaster');
}

/** Rooftop life on a block: Sintex water tanks, a stair head, dish antennas and a cell mast. */
export function rooftop(c: Ctx, w: number, h: number, d: number) {
  const { kit } = c, r = () => kit.rand();
  const tanks = 1 + Math.floor(r() * 3);
  for (let i = 0; i < tanks; i++) { const x = -w / 2 + 1.5 + r() * (w - 3), z = -1.5 - r() * (d - 3); kit.cylinder(.6, 1.2, [x, h + .6, z], '#1f2120', 'solid'); kit.cylinder(.64, .1, [x, h + 1.22, z], '#2b2d2c', 'solid'); }
  kit.box([2.6, 2.4, 2.8], [w * .25 * (r() > .5 ? 1 : -1), h + 1.2, -d * .5], '#b3a893', 'plaster');
  if (r() > .55) { const x = (r() - .5) * w * .6; kit.rod([x, h, -2], [x, h + 7, -2], .07, '#8c8f8a'); for (let k = 0; k < 3; k++) kit.box([.25, .9, .12], [x + (k - 1) * .35, h + 6.2, -1.85], '#d9dbd6', 'metal'); }
  if (r() > .5) for (let k = 0; k < 2; k++) kit.shape('sphere', [.4, .14, .4], [(r() - .5) * w * .7, h + .5, -1 - r() * 3], '#cfd0cb', 'metal', [.7, 0, 0]);
}
/** A crown for a tall tower: setback cap, mechanical floors and a lit band. */
export function skylineCrown(c: Ctx, w: number, h: number, seed: number) {
  const { kit } = c;
  kit.box([w * .7, 4, w * .7], [0, h + 2, -w / 2], '#b9b4a8', 'plaster');
  kit.box([w * .72, .5, w * .72], [0, h + 3.6, -w / 2], '#d9c48a', 'glow');
  if (seed > .5) kit.rod([0, h + 4, -w / 2], [0, h + 14, -w / 2], .12, '#9a9c96');
  else kit.box([w * .4, 3, w * .4], [0, h + 5.5, -w / 2], '#a8a397', 'plaster');
}
/** A tower under construction: bare floor slabs, columns and a luffing tower crane. */
export function constructionSite(c: Ctx) {
  const { kit } = c, floors = 14, w = 18;
  for (let f = 0; f <= floors; f++) kit.box([w, .4, w], [0, f * 3.2, -w / 2], '#a9a69d', 'stone');
  for (const x of [-w / 2 + .5, 0, w / 2 - .5]) for (const z of [-.5, -w / 2, -w + .5]) kit.box([.6, floors * 3.2, .6], [x, floors * 1.6, z], '#9d9a90', 'stone');
  kit.box([w * .6, 2.6, .1], [0, floors * 3.2 - 1.6, .1], '#2f6c3d', 'fabric');
  const mx = w / 2 + 3, top = floors * 3.2 + 22;
  for (const sx of [-.8, .8]) for (const sz of [-.8, .8]) kit.rod([mx + sx, 0, -6 + sz], [mx + sx, top, -6 + sz], .08, '#d9a21f');
  for (let y = 4; y < top; y += 4) kit.rod([mx - .8, y, -6.8], [mx + .8, y + 4, -5.2], .04, '#d9a21f');
  kit.box([42, 1.2, 1.2], [mx - 9, top + .6, -6], '#e0aa25', 'metal'); kit.box([4, 2.2, 2.4], [mx + 9, top - .6, -6], '#5c5f5b', 'metal');
  kit.rod([mx - 26, top + .4, -6], [mx - 26, top - 18, -6], .03, '#2b2b2b');
}
/**
 * Everyday kerb furniture along one side: wooden utility poles with sagging cable bundles,
 * transformer boxes, municipal bins, rubbish bags, a paan-beedi kiosk and loose crates.
 */
/** Local z of the zebra crossing every district street has (kept clear of kerb clutter). */
export const ZEBRA_Z = -12;
export function streetClutter(c: Ctx, side: number, stop: { x: number; z: number }) {
  // A pole's bin and bollards trail up to 3 m behind it; none of it may stand at the zebra's kerbs.
  const { kit } = c, r = () => kit.rand(), near = (z: number) => (Math.abs(z - stop.z) < 5 && Math.sign(stop.x) === side) || (z > ZEBRA_Z - 2.5 && z - 3 < ZEBRA_Z + 2.5);
  for (let z = 6 - r() * 4; z > -58; z -= 18 + r() * 6) {
    if (near(z)) continue;
    const x = side * 4.25;
    kit.cylinder(.11, 8.5, [x, 4.25, z], '#5a4c3e', 'wood', true); kit.solid([.3, 3, .3], [x, 1.5, z]);
    kit.box([1.2, .08, .08], [x, 7.6, z], '#4a3e33', 'wood'); kit.box([.9, .08, .08], [x, 7.1, z], '#4a3e33', 'wood');
    // Cables: some cross the road, some run back to the building, all sag.
    for (let k = 0; k < 4; k++) {
      const y = 6.9 + k * .22, to: V3 = k % 2 ? [-side * 4.25, y - .3, z - 2 - k] : [side * 7.2, y - 1.2 - k * .2, z + (k - 1.5) * 1.5];
      const mid: V3 = [(x + to[0]) / 2, y - .55 - r() * .4, (z + to[2]) / 2];
      kit.rod([x, y, z], mid, .012, '#1d1e1e'); kit.rod(mid, to, .012, '#1d1e1e');
    }
    if (r() > .55) { kit.box([.9, 1.1, .7], [x, 4.6, z + .5], '#7c817a', 'metal'); kit.cylinder(.08, .6, [x, 5.4, z + .5], '#3a3d3a', 'metal', true); }
    if (r() > .4) { kit.solid([.55, .9, .55], [side * 4.3, .45, z - 1.4]); kit.box([.55, .85, .55], [side * 4.3, .43, z - 1.4], r() > .5 ? '#2f6a8f' : '#3d7a45', 'solid'); kit.box([.6, .06, .6], [side * 4.3, .88, z - 1.4], '#26292a', 'solid'); }
    if (r() > .5) for (let k = 0; k < 3; k++) kit.shape('cylinderLow', [.24, .3, .24], [side * (4.15 + r() * .1), .18, z - 2.2 - k * .35], '#1c1d1d', 'solid');
  }
  // A paan-beedi kiosk and a few crates by a shopfront.
  const kz = -26 - r() * 18;
  if (!near(kz)) kit.frame([side * 6.4, 0, kz], side > 0 ? -Math.PI / 2 : Math.PI / 2, () => {
    kit.box([1.4, 1.1, .9], [0, .55, 0], '#6d4f36', 'wood'); kit.solid([1.4, 1.1, .9], [0, .55, 0]); kit.box([1.5, .9, .05], [0, 1.6, -.4], '#2d2a26', 'solid');
    kit.box([1.6, .06, 1.1], [0, 2.1, .05], '#b8342a', 'fabric'); for (let i = 0; i < 8; i++) kit.box([.06, .2 + r() * .1, .03], [-.6 + i * .17, 1.35, .44], pick(kit, ['#e4c04a', '#d9452f', '#3a7dc4', '#f2f0e8']), 'fabric');
    kit.box([.1, .1, .1], [.5, 1.2, .48], '#ffd27a', 'glow');
  });
  for (let i = 0; i < 3; i++) { const z = -8 - r() * 44; if (!near(z)) kit.box([.5, .32, .38], [side * (6.2 + r() * .3), .16 + (i % 2) * .32, z], pick(kit, ['#8f6b45', '#a37d50', '#6f8a9a']), 'wood', r()); }
}
