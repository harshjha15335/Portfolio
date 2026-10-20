import * as THREE from 'three';
import { hill, maidan } from './nature';
import type { District, DistrictSpec } from './District';
import { bench, bungalow, busStop, glassTower, hangar, hoarding, midrise, neoclassical, palm, sign, stall, streetLight, tetrapods, tree, backdropBlock, type Ctx } from './buildings';
import type { Outfit } from './CityFolk';
import type { V3 } from './ColorMesh';
import { powaiLab, type PowaiLab } from './powaiLabs';
import { POWAI_PODS } from '../../../data/districtExhibits';
import { projects } from '../../../data/projects';
import { bkcOffice, juhuStudio, studioBungalow, systemsOffice, talkies, talkiesInterior } from './interiors';

/* Painted hoardings and posters. Plain canvas calls only: original artwork, no assets. */
type Draw = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
const poster = (bg: string, accent: string, title: string, sub: string, mark?: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void): Draw => (ctx, x, y, w, h) => {
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); ctx.fillStyle = accent; ctx.fillRect(x, y + h * .78, w, h * .22);
  mark?.(ctx, x, y, w, h);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fffaf0'; ctx.font = `bold ${Math.round(h * .17)}px Arial, sans-serif`; ctx.fillText(title, x + w * .05, y + h * .3, w * .9);
  ctx.font = `${Math.round(h * .08)}px Arial, sans-serif`; ctx.fillText(sub, x + w * .05, y + h * .44, w * .9);
  ctx.fillStyle = bg; ctx.font = `bold ${Math.round(h * .1)}px Arial, sans-serif`; ctx.fillText('HARSH JHA · PORTFOLIO CITY', x + w * .05, y + h * .93, w * .9);
};
const filmPoster = (bg: string, title: string, tag: string, hue: string): Draw => (ctx, x, y, w, h) => {
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? hue : '#00000030'; ctx.fillRect(x + w * (.55 + i * .05), y, w * .025, h); }
  ctx.fillStyle = '#f7d77a'; ctx.beginPath?.(); ctx.ellipse?.(x + w * .27, y + h * .45, w * .14, h * .3, 0, 0, Math.PI * 2); ctx.fill?.();
  ctx.fillStyle = '#1b1410'; ctx.fillRect(x + w * .2, y + h * .5, w * .14, h * .3);
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff4dc'; ctx.font = `bold ${Math.round(h * .16)}px Georgia, serif`; ctx.fillText(title, x + w * .95, y + h * .42, w * .55);
  ctx.font = `${Math.round(h * .07)}px Arial, sans-serif`; ctx.fillText(tag, x + w * .95, y + h * .56, w * .55);
  ctx.font = `bold ${Math.round(h * .07)}px Arial, sans-serif`; ctx.fillText('NOW SHOWING · FILM CITY TALKIES', x + w * .95, y + h * .9, w * .8);
};
/** The Talkies screen between shows: the title card of tonight's film. */
const titleCard: Draw = (ctx, x, y, w, h) => {
  const g = ctx.createLinearGradient?.(x, y, x, y + h); if (g) { g.addColorStop(0, '#2a1d18'); g.addColorStop(1, '#0d0a09'); ctx.fillStyle = g; } else ctx.fillStyle = '#1a1210';
  ctx.fillRect(x, y, w, h); ctx.fillStyle = '#f7e2b0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(h * .07)}px Arial, sans-serif`; ctx.fillText('FILM CITY TALKIES PRESENTS', x + w / 2, y + h * .26, w * .8);
  ctx.font = `bold ${Math.round(h * .2)}px Georgia, serif`; ctx.fillText('NINE SCENES', x + w / 2, y + h * .47, w * .86);
  ctx.font = `${Math.round(h * .065)}px Arial, sans-serif`; ctx.fillText('one engineering story · you control the pace', x + w / 2, y + h * .64, w * .8);
  ctx.fillStyle = '#d8a84a'; ctx.font = `bold ${Math.round(h * .055)}px Arial, sans-serif`; ctx.fillText('STAND IN THE AISLE AND PRESS E', x + w / 2, y + h * .82, w * .8);
};
const railBoard: Draw = (ctx, x, y, w, h) => {
  ctx.fillStyle = '#f2c52e'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#111'; ctx.lineWidth = h * .05; ctx.strokeRect(x + h * .05, y + h * .05, w - h * .1, h - h * .1);
  ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${Math.round(h * .3)}px Arial, sans-serif`;
  ctx.fillText('दादर', x + w * .2, y + h * .5, w * .3); ctx.fillText('DADAR', x + w * .55, y + h * .5, w * .35); ctx.fillText('दादर', x + w * .85, y + h * .5, w * .25);
};

/** Yaw that turns a standing or seated person to face (fx, fz). */
const face = (fx: number, fz: number) => Math.atan2(-fx, -fz);
const walkersOf = (mix: Outfit[], n: number) => Array.from({ length: n }, (_, i) => mix[(i * 7 + 3) % mix.length]);

/* ============================================================ BKC */
const bkc: DistrictSpec = {
  id: 'bkc', guide: 'the systems engineer', guideOutfit: 'office', palette: ['#c7c3b8', '#b8bdb9', '#d1cbbd', '#aeb5b6'],
  traffic: ['sedan', 'suv', 'hatch', 'bus', 'taxi', 'sedan', 'auto', 'suv', 'bike', 'hatch', 'sedan', 'taxi', 'suv', 'bike'],
  eastOpen: [[-7.8, 13.8]],
  *build(d) {
    const c = d.ctx, { kit } = c;
    const plaza = (side: number, z0: number, z1: number, depth: number) => kit.box([depth, .07, z0 - z1], [side * (6.8 + depth / 2), .02, (z0 + z1) / 2], '#cfc8ba', 'paving'); yield;
    plaza(1, 14, -58, 5); plaza(-1, 14, -58, 5); yield;
    d.frontage(1, [
      { w: 22, setback: 4.5, build: systemsOffice },
      { w: 10, setback: 4.5, gap: 0, build: c => { const k = c.kit; k.box([8, .5, 8], [0, .25, -4], '#bdb6a6', 'stone'); k.cylinder(2.6, .6, [0, .5, -4], '#a9a395', 'stone'); k.cylinder(2.3, .1, [0, .78, -4], '#5d7d86', 'glass'); for (let i = 0; i < 6; i++) k.rod([Math.cos(i) * .8, .8, -4 + Math.sin(i) * .8], [Math.cos(i) * .3, 2.2, -4 + Math.sin(i) * .3], .05, '#cfe3ea', 'glass'); k.solid([5.4, 1, 5.4], [0, .5, -4]); } },
      { w: 20, setback: 4.5, build: c => glassTower(c, { w: 20, d: 18, h: 74, glass: '#3f6168', frame: '#b8bebb', name: 'TRADE CENTRE' }) },
      { w: 18, setback: 4.5, build: c => glassTower(c, { w: 18, d: 16, h: 46, glass: '#5b7681', frame: '#d6d3cb', name: 'G BLOCK · TOWER 3' }) },
    ]); yield;
    d.frontage(-1, [
      { w: 24, setback: 4.5, build: c => glassTower(c, { w: 24, d: 20, h: 66, glass: '#47616d', name: 'ONE BKC' }) },
      { w: 26, setback: 4.5, build: c => glassTower(c, { w: 26, d: 22, h: 38, glass: '#384c55', frame: '#9aa3a2', podium: '#c3bba9', name: 'NATIONAL STOCK HOUSE' }) },
      { w: 20, setback: 4.5, build: c => glassTower(c, { w: 20, d: 18, h: 52, glass: '#56707a', name: 'MAKER CHAMBERS' }) },
    ]); yield;
    for (const side of [-1, 1]) for (let z = 12; z > -58; z -= 9) palm(c, side * 6.2, z - (side > 0 ? 4 : 0), 7 + (Math.abs(z) % 3)); yield;
    // Security booth and boom barrier at the Systems Office drive.
    kit.box([1.4, 2.3, 1.4], [9.6, 1.15, -9.4], '#d9d4c7', 'plaster'); kit.box([1.2, .7, .05], [8.89, 1.6, -9.4], '#2f3d43', 'glass'); kit.solid([1.4, 2.3, 1.4], [9.6, 1.15, -9.4]); yield;
    kit.box([.12, 1, .12], [8.6, .5, -10.6], '#c7a12c', 'metal'); kit.box([4, .08, .08], [8.6, 1.0, -12.6], '#d63b2f', 'metal'); yield;
    busStop(c, -5.9, -20, Math.PI / 2, 'BKC · G BLOCK'); yield;
    stall(c, -6.2, 6, Math.PI / 2, '#8a3d22', ['#e9d5a8', '#7a4a2a', '#f2efe6'], 'CUTTING CHAI', 'चाय'); yield;
    for (const z of [-4, -30, -44]) bench(c, 6.2, z, -Math.PI / 2); yield;
    hoarding(c, -12, 7, -40, Math.PI / 2, 8, poster('#1d3d5a', '#e1a43a', 'ENTERPRISE SECURITY', 'Policy analysis · Manifest V3 · Cisco Secure Access'), 'AD'); yield;
    d.walkers(walkersOf(['office', 'office', 'office', 'salwar', 'sari', 'office', 'shirt', 'kurta'], 18), [4.7, 5.6, -4.7, -5.6, 8.4, -8.4]); yield;
    d.idle('office', [-5.6, .03, -18.4], Math.PI / 2, 'stand'); d.idle('salwar', [-5.4, .03, -21.2], Math.PI / 2, 'stand'); yield;
    d.idle('vendor', [-6.9, .03, 6.2], -Math.PI / 2, 'sell'); d.idle('office', [-5.2, .03, 4.8], Math.PI / 2, 'talk'); d.idle('office', [-5.2, .03, 7.4], Math.PI / 2 + .4, 'talk'); yield;
    d.idle('shirt', [9.9, .03, -11.3], -Math.PI / 2, 'stand'); yield;
    d.idle('office', [8.8, .03, -2], -1.2, 'talk'); d.idle('office', [9.6, .03, -1.2], 2.2, 'talk'); yield;
    // Inside the Systems Office: reception, three people at their desks, a meeting in the glass room.
    bkcOffice(c); yield;
    d.idle('office', [16.6, .03, 10], face(-1, 0), 'stand'); yield;
    for (const [x, z] of [[19.65, 8.2], [22.85, 10.4], [19.65, 12.6]] as const) d.idle('office', [x, .03, z], face(1, 0), 'sit'); yield;
    d.idle('office', [21.8, .03, -3.55], face(0, -1), 'sit'); d.idle('salwar', [24.4, .03, -5.65], face(0, 1), 'sit'); yield;
  },
};

/* ============================================================ ANDHERI */
const andheriShops: Array<[string, string?]> = [['MOBILE REPAIR', 'मोबाइल रिपेयर'], ['LAPTOP SERVICE', 'लैपटॉप'], ['COMPUTER PARTS', 'कंप्यूटर'], ['GPU · RAM · SSD'], ['ARDUINO · RASPBERRY PI'], ['CABLES & CHARGERS', 'केबल'], ['PYTHON · C++ BOOKS', 'किताबें'], ['CCTV & NETWORKING'], ['RECHARGE · SIM', 'रिचार्ज'], ['SOLDERING · CHIPS'], ['PRINTER INK · TONER'], ['REACT · NODE CLASSES'], ['GAMING ZONE'], ['PHONE COVERS', 'कवर'], ['UPS · INVERTER'], ['TYPESCRIPT TUITIONS']];
const andheri: DistrictSpec = {
  id: 'andheri', guide: 'the bazaar curator', guideOutfit: 'vendor', crowd: .54,
  traffic: ['auto', 'bike', 'sedan', 'cart', 'bus', 'taxi', 'auto', 'hatch', 'bike', 'suv', 'auto', 'sedan'],
  *build(d) {
    const c = d.ctx, { kit } = c; let n = 0;
    const shops = (k: number) => Array.from({ length: k }, () => andheriShops[n++ % andheriShops.length]); yield;
    const block = (w: number, floors: number, style: 'concrete' | 'deco' = 'concrete') => ({ w, build: (c: Ctx) => { const H = midrise(c, { w, d: 12, floors, ground: 'shops', shops: shops(Math.max(2, Math.round(w / 3.6))), style }); for (let f = 0; f < Math.min(floors, 3); f++) sign(c, andheriShops[(n + f * 3) % andheriShops.length][0], w * .42, [(f % 2 ? 1 : -1) * w * .2, 4.9 + f * 3, .45], { bg: ['#c22f2f', '#1f5d9c', '#e0a72a', '#178a6b'][(n + f) % 4], fg: '#ffffff' }, [384, 96]); void H; } }); yield;
    // Gateway arch over the lane (first, so its sign always gets atlas space).
    for (const s of [-1, 1]) { kit.wall([.8, 7.2, .8], [s * 6.1, 3.6, -3], '#c06a2e', 'plaster'); kit.box([1.1, .4, 1.1], [s * 6.1, 7.3, -3], '#e2b04a', 'stone'); }
    kit.box([13, 1.4, .6], [0, 6.6, -3], '#2a2f6a', 'plaster'); for (const s of [-1, 1]) sign(c, 'ANDHERI TECH BAZAAR', 11.6, [0, 6.6, -3 + s * .31], { bg: '#2a2f6a', fg: '#ffd35a', local: 'अंधेरी टेक बाज़ार · skills with receipts' }, [1024, 128], s < 0 ? Math.PI : 0); yield;
    d.frontage(1, [block(11, 4), block(9, 3), block(13, 5), block(10, 3, 'deco'), block(12, 4), block(10, 4)]); yield;
    d.frontage(-1, [block(10, 3), block(12, 5), block(9, 4), block(14, 3), block(11, 4), block(10, 5)]); yield;
    // Pavement stalls under blue tarps, and the overhead tangle of cables.
    const goods = ['#1c1c1c', '#e8e8e2', '#d33b3b', '#2f7fd0', '#f0c43a', '#3caa5a']; yield;
    const labels: Array<[string, string?]> = [['CHARGERS ₹99'], ['EARPHONES'], ['USB-C · HDMI'], ['SCREEN GUARD'], ['POWER BANK'], ['MOUSE · KEYBOARD']]; yield;
    let i = 0; for (const side of [-1, 1]) for (let z = 8; z > -54; z -= 7.5) if (Math.abs(z + 3) > 3) { const [t] = labels[i++ % labels.length]; stall(c, side * 6.15, z, side > 0 ? -Math.PI / 2 : Math.PI / 2, i % 3 ? '#2f5f9e' : '#c9442f', goods, t); }
    for (let z = 10; z > -56; z -= 5.5) for (let k = 0; k < 3; k++) kit.rod([-7.2, 6.2 + k * .35, z + k], [7.2, 6.5 + (k % 2) * .3, z + k * .8 - .6], .012, '#1f2020'); yield;
    for (const [x, z] of [[3.35, -16], [3.35, -17], [3.35, -18], [-3.35, -30], [-3.35, -31], [3.35, -40]] as const) d.parked('bike', x, z, x > 0 ? Math.PI : 0); yield;
    d.parked('cart', -3.5, -9.5, 0); d.parked('cart', 3.5, -46, Math.PI); yield;
    d.walkers(walkersOf(['shirt', 'salwar', 'school', 'office', 'sari', 'kurta', 'worker', 'shirt', 'jogger', 'vendor'], 24), [4.6, 5.2, -4.6, -5.2]); yield;
    for (const [x, z, o, act] of [[5.3, 6.4, 'vendor', 'sell'], [-5.3, -1, 'vendor', 'sell'], [5.3, -23.6, 'vendor', 'sell'], [-5.3, -38.6, 'vendor', 'sell'], [4.7, -8, 'salwar', 'talk'], [4.6, -9.2, 'school', 'talk'], [-4.5, -20, 'shirt', 'talk'], [-4.6, -21.3, 'office', 'stand'], [-4.4, -46, 'worker', 'talk']] as Array<[number, number, Outfit, 'sell' | 'talk' | 'stand']>) d.idle(o, [x, .03, z], x > 0 ? -Math.PI / 2 : Math.PI / 2, act); yield;
  },
};

/* ============================================================ POWAI */
const project = (id: string) => projects.find(p => p.id === id)!;
const lab = (id: string, form: PowaiLab['form'], color: string, still: PowaiLab['still']): PowaiLab => ({ id, title: project(id).title, form, color, accent: project(id).color, still });
/** In the order of the Powai exhibits: the six flagships, then ASTFLOW. */
const POWAI_LABS: PowaiLab[] = [
  lab('northstar', 'observatory', '#33456a', 'chart'), lab('reco', 'tower', '#b0613f', 'queue'), lab('moneymetrics', 'bank', '#d9d0bd', 'flows'),
  lab('meeting-intelligence-service', 'timber', '#d8c9ae', 'transcript'), lab('rideflow', 'transit', '#e1c37e', 'route'), lab('repolens', 'lens', '#3a6f8a', 'code'),
  { id: 'astflow', title: 'ASTFLOW', form: 'lab', color: '#5b3d73', accent: '#d7b8f0', still: 'ranking' },
];
const powai: DistrictSpec = {
  id: 'powai', guide: 'the product builder', guideOutfit: 'office', west: 'open', westLimit: 12.6, skyline: 'east',
  traffic: ['sedan', 'suv', 'hatch', 'auto', 'bike', 'bus', 'taxi', 'hatch', 'suv', 'auto', 'sedan', 'bike'],
  *build(d) {
    const c = d.ctx, { kit } = c;
    // Lakeside promenade, railing and Powai Lake with the far shore's hills.
    kit.box([8.9, .08, 290], [-8.25, .02, -22], '#b9ae99', 'paving'); yield;
    for (let z = 118; z > -160; z -= 1.7) kit.box([.24, .14, 1.6], [-3.98, .06, z], '#2f2e2b'); yield;
    kit.box([.12, .1, 290], [-12.6, 1.05, -22], '#4f5853', 'metal'); kit.box([.06, .06, 290], [-12.6, .55, -22], '#4f5853', 'metal'); yield;
    for (let z = 118; z > -160; z -= 2.4) kit.box([.08, 1.05, .08], [-12.6, .53, z], '#4f5853', 'metal'); yield;
    kit.box([1.2, .9, 290], [-13.3, -.4, -22], '#8e8a7d', 'stone'); yield;
    d.water(160, 300, [-92, -.35, -22], '#41626a', .05); yield;
    // The far shore: a chain of wooded hills behind the water.
    for (let i = 0; i < 6; i++) hill(kit, [-158 + (i % 2) * 14, -3, 70 - i * 38], 42 + (i % 3) * 8, 30, 16 + (i % 4) * 5, i * 3.1, 12, 32); yield;
    for (let i = 0; i < 6; i++) kit.frame([-108 - (i % 2) * 6, 0, -70 + i * 18], Math.PI / 2, () => backdropBlock(c, 14, 28 + (i % 3) * 8, 12, '#e3d7bf')); yield;
    for (let z = 10; z > -60; z -= 16) streetLight(c, -11.8, z, -1); yield;
    for (let z = 4; z > -58; z -= 12) { palm(c, -11.4, z - 6, 7); bench(c, -11.6, z, Math.PI / 2); }
    // One workplace per project along the lake front; the towers stand behind them.
    d.frontage(1, POWAI_LABS.map(lab => ({ w: POWAI_PODS.w, setback: POWAI_PODS.setback, gap: POWAI_PODS.gap, build: (c: Ctx) => powaiLab(c, lab) })), POWAI_PODS.start); yield;
    d.frontage(1, [
      { w: 22, setback: 13, build: c => neoclassical(c, { w: 22, d: 18, floors: 13, name: "POWAI BUILDER'S DISTRICT" }) },
      { w: 20, setback: 13, build: c => neoclassical(c, { w: 20, d: 18, floors: 15, color: '#ece2cb', name: 'HACKERSPACE · TOWER B' }) },
      { w: 18, setback: 13, build: c => neoclassical(c, { w: 18, d: 16, floors: 11, color: '#e2d6bd', dome: false, name: 'GITHUB WEEKEND LAB' }) },
    ]); yield;
    kit.box([3, .07, 72], [1 * (6.8 + 1.5), .02, -22], '#d6cdb9', 'paving'); yield;
    hoarding(c, 10.5, 6.5, -55, -Math.PI / 2 + .4, 7.5, poster('#28473b', '#e3b04b', 'FIVE PROJECTS', 'Research terminals · recovery · route planners'), 'AD'); yield;
    d.walkers(walkersOf(['jogger', 'office', 'salwar', 'jogger', 'kurta', 'school', 'office', 'sari'], 12), [-6.5, -8.4, -10.2], 12, -56, 1.15); yield;
    d.walkers(walkersOf(['office', 'office', 'salwar', 'shirt'], 7), [4.8, 5.6]); yield;
    d.idle('jogger', [-11.62, .03, 3.45], Math.PI / 2, 'sit'); d.idle('salwar', [-11.62, .03, 4.5], Math.PI / 2, 'sit'); yield;
    d.idle('office', [9.3, .03, -21.6], -1.3, 'talk'); d.idle('office', [10.2, .03, -20.8], 2.1, 'talk'); d.idle('office', [9.4, .03, -19.7], -2.3, 'stand'); yield;
    d.idle('elder', [-11.62, .03, -20], Math.PI / 2, 'sit'); yield;
  },
};

/* ============================================================ DADAR */
const dadar: DistrictSpec = {
  id: 'dadar', guide: 'the platform announcer', guideOutfit: 'kurta',
  traffic: ['bus', 'taxi', 'hatch', 'sedan', 'tempo', 'bike', 'sedan', 'taxi', 'suv', 'bus', 'hatch', 'bike'],
  *build(d) {
    const c = d.ctx, { kit } = c;
    const chawlShops: Array<[string, string?]> = [['VADA PAV CENTRE', 'वडा पाव'], ['STATIONERY · NOTEBOOKS', 'वह्या'], ['CHEMIST', 'औषधे'], ['TAILOR', 'शिंपी'], ['SWEETS · MITHAI', 'मिठाई'], ['KIRANA', 'किराणा'], ['XEROX · PRINTS'], ['BHAJI PAV', 'भाजी']]; yield;
    let n = 0; const sh = (k: number) => Array.from({ length: k }, () => chawlShops[n++ % chawlShops.length]); yield;
    d.frontage(1, [
      { w: 24, build: c => { midrise(c, { w: 24, d: 11, floors: 3, style: 'chawl', ground: 'shops', shops: sh(6), color: '#c8b48f' }); sign(c, 'GIRGAONKAR CHAWL · 1932', 6, [0, 13.8, 1.7], { bg: '#e8dcc0', fg: '#5a3a22', border: 'none', local: 'चाळ' }, [768, 128]); } },
      { w: 22, build: c => midrise(c, { w: 22, d: 11, floors: 4, style: 'chawl', ground: 'shops', shops: sh(5), color: '#a9b8b1' }) },
      { w: 24, build: c => midrise(c, { w: 24, d: 11, floors: 3, style: 'chawl', ground: 'shops', shops: sh(6), color: '#d0b9a0' }) },
    ]); yield;
    // Dadar station frontage: long tiled roof, arcade, the yellow station board.
    kit.frame([-7, 0, -6], Math.PI / 2, () => {
      kit.box([36, 5.5, 10], [0, 2.75, -5], '#c9b48f', 'plaster'); kit.solid([36, 5.5, 10], [0, 2.75, -5]);
      for (let x = -16.5; x <= 16.5; x += 3) { kit.box([.6, 4.2, .6], [x, 2.1, .3], '#dccaa5', 'stone'); kit.box([2.2, 3.2, .1], [x + 1.5, 1.7, -.05], '#2d2924', 'solid'); }
      kit.box([37, .3, 2], [0, 4.3, .6], '#b9a580', 'stone');
      for (const s of [-1, 1]) kit.shape('box', [38, .16, 6], [0, 6.7, -2.5 + s * 2.6], '#9b4b32', 'stone', [s * .38, 0, 0]);
      sign(c, 'DADAR', 9, [0, 4.95, .95], { draw: railBoard }, [1024, 192]);
      sign(c, 'PLATFORM 1 · WESTERN LINE ↑ · CENTRAL LINE →', 7, [10, 3.7, .7], { bg: '#1d3b6a', fg: '#ffffff', border: 'none' }, [1024, 96]);
    }); yield;
    // Foot-over bridge spanning Ranade Road.
    kit.box([18, .4, 3], [0, 6.6, -30], '#8e8a80', 'stone'); kit.box([18, 1.1, .08], [0, 7.3, -31.45], '#5d6a66', 'metal'); kit.box([18, 1.1, .08], [0, 7.3, -28.55], '#5d6a66', 'metal'); yield;
    kit.shape('box', [18.4, .1, 3.6], [0, 8.4, -30], '#7c8a86', 'metal'); for (const x of [-7.6, 7.6]) kit.wall([.5, 6.6, .5], [x, 3.3, -30], '#8e8a80', 'stone'); yield;
    sign(c, 'DADAR STATION · पूर्व ⇄ पश्चिम', 7, [0, 7.1, -28.5], { bg: '#1d3b6a', fg: '#ffffff' }, [1024, 128]); yield;
    // Flower market heaps on the west pavement, and a maidan for evening cricket.
    for (let z = -2; z > -24; z -= 4.4) { const k = kit; k.box([2, .5, 1.2], [-6.3, .25, z], '#6a5440', 'wood'); for (let i = 0; i < 30; i++) k.shape('sphere', [.09, .08, .09], [-7.1 + (i % 10) * .18, .55 + Math.floor(i / 10) * .07, z - .4 + Math.floor(i / 10) * .3], i % 3 ? '#f08a1c' : '#f6c624', 'foliage'); k.solid([2, .8, 1.2], [-6.3, .4, z]); for (let i = 0; i < 4; i++) k.shape('cylinder', [.04, .9, .04], [-5.6, 1.3, z - .4 + i * .25], '#f5a623', 'foliage'); }
    sign(c, 'DADAR FLOWER MARKET', 4.6, [-7.6, 3, -12], { bg: '#7a2b2b', fg: '#ffe2a8', local: 'फूल बाजार' }, [768, 128], Math.PI / 2); yield;
    maidan(kit, [-14, .02, -46], 18, 22, { x: 0, z: 0, w: 3, d: 13 }); for (let z = -36; z > -57; z -= 2) kit.box([.05, 1.2, .05], [-7.2, .6, z], '#6a6a5a', 'metal'); kit.box([.05, .05, 22], [-7.2, 1.2, -46], '#6a6a5a', 'metal'); yield;
    for (let x = -7.4; x > -19; x -= 3.2) tree(c, x, -58, 7, '#4f7a3c'); yield;
    for (const z of [-40.4, -51.6]) for (const dx of [-.09, 0, .09]) kit.box([.03, .7, .03], [-14 + dx, .35, z], '#e9e3cf', 'wood'); yield;
    d.idle('school', [-14, .03, -51], 0, 'bat', .78); d.idle('school', [-14.2, .03, -41.2], Math.PI, 'bowl', .74); yield;
    d.idle('shirt', [-11, .03, -46], -Math.PI / 2, 'stand', .8); d.idle('school', [-17, .03, -44], Math.PI / 2, 'wave', .7); d.idle('school', [-14.7, .03, -53.4], 0, 'stand', .72); yield;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshStandardMaterial({ color: '#c8322a', roughness: .6 })); d.group.add(ball); yield;
    d.animate(time => { const t = (time * .55) % 1; ball.visible = t > .45 && t < .65 || t < .2; const p = t < .45 ? 0 : Math.min(1, (t - .45) / .2); ball.position.set(-14.1, .3 + Math.sin(p * Math.PI) * 1.6, -41.6 - p * 9); }); yield;
    busStop(c, 5.9, -48, -Math.PI / 2, 'DADAR T.T. · RANADE ROAD'); yield;
    for (const z of [-15, -39]) palm(c, -6.3, z, 6.5); yield;
    d.walkers(walkersOf(['sari', 'dabbawala', 'salwar', 'kurta', 'office', 'school', 'elder', 'dabbawala', 'sari', 'shirt', 'koli'], 22), [4.6, 5.3, -4.6, -5.2]); yield;
    for (const [x, z, o, act] of [[-6.9, -2.4, 'sari', 'sell'], [-6.9, -11.2, 'koli', 'sell'], [-6.9, -19.6, 'sari', 'sell'], [5.4, -46.6, 'office', 'stand'], [5.3, -48.8, 'sari', 'stand'], [5.5, -50, 'dabbawala', 'stand'], [-4.5, -6, 'dabbawala', 'talk'], [-4.4, -7.2, 'dabbawala', 'talk']] as Array<[number, number, Outfit, 'sell' | 'talk' | 'stand']>) d.idle(o, [x, .03, z], x > 0 ? -Math.PI / 2 : Math.PI / 2, act); yield;
  },
};

/* ============================================================ WORLI */
const worli: DistrictSpec = {
  id: 'worli', guide: 'the signal keeper', guideOutfit: 'office', west: 'open', westLimit: 13.4, skyline: 'east',
  palette: ['#e1d3b7', '#cfd8d2', '#e6c9b4', '#d5d0bd'],
  traffic: ['sedan', 'taxi', 'suv', 'hatch', 'bike', 'bus', 'taxi', 'sedan', 'suv', 'hatch', 'taxi', 'bike'],
  *build(d) {
    const c = d.ctx, { kit } = c;
    kit.box([9.4, .08, 290], [-8.5, .02, -22], '#c2b49b', 'paving'); for (let z = 118; z > -160; z -= 1.7) kit.box([.24, .14, 1.6], [-3.98, .06, z], '#2f2e2b'); yield;
    // Sea wall the whole city sits on at sunset, then tetrapods and the Arabian Sea.
    kit.box([.7, .75, 290], [-13.5, .38, -22], '#b7ad98', 'stone'); kit.box([.9, .12, 290], [-13.5, .8, -22], '#cfc5ae', 'stone'); yield;
    kit.box([8, 2.2, 290], [-18, -1.2, -22], '#8b867a', 'stone'); yield;
    tetrapods(c, -15, -21, 60, -110, 260); yield;
    d.water(170, 320, [-100, -.55, -22], '#4e6f78', .16); yield;
    // Bandra–Worli Sea Link on the north-western horizon.
    const deck: V3 = [-72, 7, -95]; kit.frame(deck, -.55, () => {
      kit.box([1.2, .9, 190], [0, 0, 0], '#cfc8b8', 'stone');
      for (const z of [-40, 40]) { kit.rod([0, -8, z], [-1.8, 30, z], .5, '#d8d0bd', 'stone'); kit.rod([0, -8, z], [1.8, 30, z], .5, '#d8d0bd', 'stone'); kit.box([4.2, 1, 1], [0, 30, z], '#d8d0bd', 'stone'); for (let i = 1; i <= 9; i++) for (const s of [-1, 1]) kit.rod([0, 28 - i * 1.4, z], [0, .3, z + s * i * 4.3], .05, '#e6e2d6', 'metal'); }
      for (let z = -90; z <= 90; z += 15) kit.box([1.4, 8, 1.4], [0, -4.5, z], '#bdb6a6', 'stone');
    }); yield;
    for (let z = 12; z > -60; z -= 11) { palm(c, -12.4, z, 8, -.25); bench(c, -9.2, z - 5, -Math.PI / 2); }
    for (let z = 6; z > -60; z -= 16) streetLight(c, -12.6, z, -1); yield;
    // Bhutta cart and a chai cycle on the promenade.
    stall(c, -9.4, -14, -Math.PI / 2, '#a33a2a', ['#e8c64a', '#d39a2a', '#5a3a20'], 'BHUTTA · ROASTED CORN', 'भुट्टा'); yield;
    d.parked('cycle', -6, -26, .4, false); yield;
    d.frontage(1, [
      { w: 16, build: c => midrise(c, { w: 16, d: 13, floors: 5, style: 'deco', ground: 'wall', color: '#e3d2b2', corner: true, name: ['SEA VIEW', 'सी व्ह्यू'] }) },
      { w: 14, build: c => midrise(c, { w: 14, d: 13, floors: 4, style: 'deco', ground: 'wall', color: '#d5ddd5', name: ['SAGAR DARSHAN', 'सागर दर्शन'] }) },
      { w: 17, build: c => midrise(c, { w: 17, d: 13, floors: 6, style: 'deco', ground: 'lobby', color: '#e8c9b2', corner: true, name: ['NEPTUNE COURT'] }) },
      { w: 14, build: c => midrise(c, { w: 14, d: 13, floors: 4, style: 'deco', ground: 'wall', color: '#d9d2bd', name: ['SHANTI NIWAS', 'शांती निवास'] }) },
    ]); yield;
    hoarding(c, 9.4, 7, -55, -Math.PI / 2 + .35, 8, poster('#3a2f6a', '#e9a33c', 'PROOF, NOT ADJECTIVES', 'Big Code qualifier · five merged upstream PRs · metrics with sources'), 'AD'); yield;
    sign(c, 'WORLI SEA FACE', 3.2, [-5.6, 2.4, 9], { bg: '#1e4b6e', fg: '#ffffff', local: 'वरळी सी फेस' }, [768, 160], Math.PI / 2); yield;
    kit.cylinder(.06, 2.5, [-5.6, 1.25, 9], '#5a5f5c', 'metal', true); yield;
    d.walkers(walkersOf(['jogger', 'jogger', 'salwar', 'elder', 'kurta', 'sari', 'jogger', 'office', 'school'], 18), [-6.2, -7.4, -8.6, -12.1], 12, -58, 1.2); yield;
    d.walkers(walkersOf(['office', 'shirt', 'salwar'], 5), [5, 5.6]); yield;
    for (let z = 8; z > -56; z -= 7) d.idle(z % 2 ? 'sari' : 'shirt', [-13.2, .55, z], -Math.PI / 2, 'sit'); yield;
    for (let z = 4.5; z > -56; z -= 14) d.idle('salwar', [-13.2, .55, z], -Math.PI / 2, 'sit'); yield;
    d.idle('vendor', [-8.5, .03, -14], Math.PI / 2, 'sell'); d.idle('koli', [-7.4, .03, -32], Math.PI, 'stand'); yield;
  },
};

/* ============================================================ JUHU */
const juhu: DistrictSpec = {
  id: 'juhu', guide: 'the studio neighbour', guideOutfit: 'kurta', west: 'open', westLimit: 37.5, skyline: 'east', eastOpen: [[-2.8, 12.8]],
  traffic: ['suv', 'sedan', 'auto', 'bus', 'taxi', 'hatch', 'sedan', 'suv', 'bike', 'sedan', 'auto', 'hatch'],
  *build(d) {
    const c = d.ctx, { kit } = c;
    kit.box([2.9, .08, 290], [-5.35, .02, -22], '#aea493', 'paving'); for (let z = 118; z > -160; z -= 1.7) kit.box([.24, .14, 1.6], [-3.98, .06, z], '#2f2e2b'); yield;
    kit.box([1, .5, 290], [-7.2, .25, -22], '#c9bda6', 'stone'); yield;
    kit.box([28, .1, 300], [-21.5, -.02, -22], '#dcc8a0', 'plaster'); kit.box([10, .1, 300], [-40.5, -.06, -22], '#a8946f', 'plaster'); yield;
    const sea = d.water(200, 320, [-139, -.1, -22], '#557780', .09); yield;
    const foam = new THREE.Mesh(new THREE.BoxGeometry(1.2, .03, 300), new THREE.MeshBasicMaterial({ color: '#efe9db', transparent: true, opacity: .75 })); d.group.add(foam); yield;
    d.animate(time => { foam.position.set(-40 + Math.sin(time * .5) * 1.2, .02, -22); }); void sea; yield;
    // Chowpatty food stalls on the sand.
    const food: Array<[string, string, string]> = [['PAV BHAJI', 'पाव भाजी', '#c0392b'], ['BHEL PURI', 'भेळ', '#d68a1c'], ['PANI PURI', 'पाणी पुरी', '#1f7a5c'], ['KALA KHATTA GOLA', 'गोला', '#6b2d8c'], ['KULFI', 'कुल्फी', '#2a6fb0'], ['SUGARCANE JUICE', 'ऊस रस', '#3d8a2f']]; yield;
    food.forEach(([t, l, col], i) => stall(c, -13.5, 6 - i * 6.2, Math.PI / 2, col, ['#f2e3b0', '#e8b04a', '#c45a2a', '#7aa54a'], t, l)); yield;
    for (let z = 10; z > -58; z -= 9) palm(c, -9.5 - (Math.abs(z) % 4), z, 8.5, .35); yield;
    for (let i = 0; i < 6; i++) { const z = -16 - i * 6, x = -24 - (i % 3) * 3; kit.cylinder(.04, 2.3, [x, 1.15, z], '#ddd', 'metal', true); kit.shape('cone', [1.5, .6, 1.5], [x, 2.4, z], ['#d64b3a', '#2d6fb0', '#e7b33a'][i % 3], 'fabric'); }
    d.frontage(1, [
      { w: 18, setback: 2, build: studioBungalow },
      { w: 15, setback: 2, build: c => bungalow(c, { w: 13, d: 11, color: '#efe1c9', name: ['SEA BREEZE'] }) },
      { w: 16, setback: 2, build: c => midrise(c, { w: 16, d: 13, floors: 3, style: 'deco', ground: 'wall', color: '#f0e4d0', name: ['SANDCASTLE'] }) },
      { w: 15, setback: 2, build: c => bungalow(c, { w: 13, d: 11, color: '#e9dcc4' }) },
    ]); yield;
    for (let z = 11; z > -58; z -= 10) tree(c, 7.6, z, 6.5, '#5a8a3c'); yield;
    hoarding(c, -30, 6, -56, .3, 9, poster('#a3423a', '#f1c56a', 'SAY HELLO', 'Résumé · GitHub · LinkedIn · harsh.jha'), 'AD'); yield;
    d.walkers(walkersOf(['salwar', 'shirt', 'sari', 'school', 'kurta', 'jogger', 'elder', 'school', 'office'], 18), [-17, -21, -26, -31, -35], 10, -54, .9); yield;
    d.walkers(walkersOf(['shirt', 'salwar', 'jogger'], 5), [-5, -5.6]); yield;
    for (let i = 0; i < 6; i++) d.idle(i % 2 ? 'vendor' : 'kurta', [-12.6, .03, 6 - i * 6.2], -Math.PI / 2, 'sell'); yield;
    for (const [x, z, o, act] of [[-28, -4, 'school', 'wave'], [-29.3, -4.6, 'school', 'stand'], [-22, 2, 'sari', 'stand'], [-21.2, 2.6, 'kurta', 'talk'], [-33, -20, 'shirt', 'stand'], [-15.8, -8, 'salwar', 'talk'], [-15.6, -9.2, 'school', 'stand']] as Array<[number, number, Outfit, 'wave' | 'talk' | 'stand']>) d.idle(o, [x, .03, z], Math.PI / 2 - (x + z) * .05, act, o === 'school' ? .72 : 1); yield;
    // The studio: someone at the work table, a friend on the sofa.
    juhuStudio(c); yield;
    d.idle('shirt', [17.3, .03, 5.9], face(1, 0), 'sit'); d.idle('salwar', [11.25, .03, 10.4], face(1, 0), 'sit'); yield;
  },
};

/* ============================================================ FILM CITY */
const filmcity: DistrictSpec = {
  id: 'filmcity', guide: 'the projectionist', guideOutfit: 'shirt', palette: ['#c9c2b0', '#b8b29e', '#d0c4ad'], eastOpen: [[-7.8, 13.8]],
  traffic: ['suv', 'bus', 'sedan', 'auto', 'hatch', 'sedan', 'tempo', 'suv', 'bike', 'hatch'],
  *build(d) {
    const c = d.ctx, { kit } = c;
    // Gate arch at the studio entrance.
    for (const s of [-1, 1]) kit.wall([1.2, 7, 1.2], [s * 6.2, 3.5, 15], '#7a2c38', 'plaster'); yield;
    kit.box([14, 1.6, .9], [0, 7.6, 15], '#7a2c38', 'plaster'); for (const s of [-1, 1]) sign(c, 'FILM CITY · GOREGAON', 11, [0, 7.6, 15 + s * .46], { bg: '#7a2c38', fg: '#f4d488', local: 'दादासाहेब फाळके चित्रनगरी' }, [1024, 160], s < 0 ? Math.PI : 0); yield;
    // Film City Talkies: an Art Deco single-screen with a bulb-lit marquee.
    d.frontage(1, [
      { w: 22, setback: 1, build: c => talkies(c, { screen: titleCard }) },
      { w: 26, setback: 3, build: c => hangar(c, { w: 26, d: 30, h: 14, label: 'STAGE 3' }) },
      { w: 24, setback: 3, build: c => hangar(c, { w: 24, d: 30, h: 13, label: 'STAGE 7', color: '#bfb9a6' }) },
    ]); yield;
    // West: a chawl street set — façades only, braced by visible scaffolding.
    d.frontage(-1, [
      { w: 26, setback: 2, build: c => { const k = c.kit; midrise(c, { w: 26, d: 1.2, floors: 2, style: 'chawl', ground: 'shops', shops: [['SET 12 · CHAWL'], ['PROPS'], ['MAKE-UP'], ['COSTUMES'], ['CHAI']], color: '#c7a98a' }); for (let x = -12; x <= 12; x += 3) { k.rod([x, 0, -6], [x, 9, -1.3], .06, '#7a6a52', 'wood'); k.rod([x, 0, -1.4], [x, 10, -1.4], .05, '#7a6a52', 'wood'); } } },
      { w: 20, setback: 4, build: c => { const k = c.kit; k.box([20, .06, 12], [0, .03, -6], '#9a8e78', 'wood'); for (const x of [-6, 0, 6]) { k.box([4, 3, 3.5], [x, 1.5, -8], '#b78a5a', 'plaster'); k.solid([4, 3, 3.5], [x, 1.5, -8]); k.box([1, 1.9, .06], [x, .95, -6.22], '#4a3524', 'wood'); k.shape('cone', [3.4, 2, 3.4], [x, 4.0, -8], '#b59c5a', 'fabric', [0, Math.PI / 4, 0]); } sign(c, 'VILLAGE SET · QUIET PLEASE', 6, [0, 5.8, -1], { bg: '#222', fg: '#f04a3a', border: 'none' }, [1024, 128]); } },
      { w: 22, setback: 3, build: c => hangar(c, { w: 22, d: 26, h: 12, label: 'STAGE 9', color: '#c4bca9' }) },
    ]); yield;
    // Inside the Talkies: the posters that used to hang outside now line the lobby; a few people are early for the show.
    talkiesInterior(c); yield;
    sign(c, 'SCENE 1', 1.5, [9.8, 1.9, -7.59], { draw: filmPoster('#3a1f4a', 'THE ROUTE', 'from student to builder', '#e05a3a') }, [256, 352]); yield;
    sign(c, 'SCENE 2', 1.5, [12.6, 1.9, -7.59], { draw: filmPoster('#173a4a', 'UPSTREAM', 'five pull requests, one summer', '#e0b03a') }, [256, 352]); yield;
    for (const [x, title, tag, bg, hue] of [[9.8, 'SIGNALS', 'what the receipts say', '#3a2a14', '#e05a3a'], [12.6, 'NEXT CHAPTER', 'still being written', '#14303a', '#f0b03a']] as const) sign(c, title, 1.5, [x, 1.9, 13.59], { draw: filmPoster(bg, title, tag, hue) }, [256, 352], Math.PI); yield;
    d.idle('sari', [21.2, .03, 5.82], face(1, 0), 'sit'); d.idle('kurta', [21.2, .03, 7.06], face(1, 0), 'sit'); d.idle('school', [24.5, .03, -4.74], face(1, 0), 'sit', .72); yield;
    d.idle('worker', [14.7, .03, 11.2], face(-1, 0), 'stand'); yield;
    // A film unit mid-shoot: camera crane, lights, director's chair.
    const rig = (x: number, z: number) => { kit.rod([x, 0, z], [x, 2.6, z], .03, '#222', 'metal'); kit.box([.6, .5, .3], [x, 2.8, z], '#1e1e1e', 'metal'); kit.box([.5, .4, .02], [x, 2.8, z + .16], '#fff3c8', 'glow'); for (let a = 0; a < 3; a++) kit.rod([x, 1.2, z], [x + Math.cos(a * 2.1) * .5, 0, z + Math.sin(a * 2.1) * .5], .02, '#222', 'metal'); }; yield;
    rig(-12.2, -17.5); rig(-12.4, -27.5); kit.box([.8, 1.0, .8], [-8.6, .5, -22], '#2b2b2b', 'metal'); kit.solid([.8, 1, .8], [-8.6, .5, -22]); kit.rod([-8.6, 1, -22], [-11.6, 3.2, -22.6], .08, '#3a3a3a', 'metal'); kit.box([.7, .45, .5], [-11.6, 3.3, -22.6], '#111', 'metal'); yield;
    kit.box([.6, .05, .5], [-9.2, .5, -25.5], '#3a2a1c', 'wood'); kit.box([.6, .45, .05], [-9.2, .75, -25.25], '#2a2a2a', 'fabric'); sign(c, 'DIRECTOR', .55, [-9.2, .78, -25.21], { bg: '#2a2a2a', fg: '#fff', border: 'none' }, [256, 64]); yield;
    // Aarey's forested hills ring the studio lots.
    for (let i = 0; i < 6; i++) hill(kit, [(i % 2 ? -1 : 1) * 78, -3, -125 + i * 28], 34 + i * 3, 30, 20 + (i % 3) * 6, 10 + i * 2.3, 12, 32); yield;
    hoarding(c, -10, 6, 4, Math.PI / 2, 7.5, filmPoster('#4a1f22', 'NINE SCENES', 'one engineering story · you control the pace', '#f0b03a'), 'AD'); yield;
    // Half up on the kerb, the way Mumbai parks, so the traffic lanes stay clear.
    d.parked('suv', -4.1, -24, 0, false); d.parked('tempo', 4.1, -34, Math.PI, false); yield;
    d.walkers(walkersOf(['worker', 'shirt', 'sari', 'kurta', 'worker', 'salwar', 'office', 'worker'], 14), [4.8, 5.5, -4.8, -5.4]); yield;
    for (const [x, z, o, act] of [[-14.2, -21.6, 'sari', 'wave'], [-14.6, -22.8, 'kurta', 'talk'], [-9.2, -25.75, 'shirt', 'sit'], [-8.6, -20.8, 'worker', 'stand'], [-10.4, -27.8, 'worker', 'stand'], [4.4, -10.5, 'salwar', 'stand'], [4.9, -11.4, 'shirt', 'talk']] as Array<[number, number, Outfit, 'wave' | 'talk' | 'stand' | 'sit']>) d.idle(o, [x, .03, z], x < -12 ? -Math.PI / 2 : x < 0 ? Math.PI / 2 : -Math.PI / 2, act); yield;
  },
};

export const DISTRICT_SPECS: Record<string, DistrictSpec> = { bkc, andheri, powai, dadar, worli, juhu, filmcity };
export { streetLight };
