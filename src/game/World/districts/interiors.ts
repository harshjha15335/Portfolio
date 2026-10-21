import type { KitSurface } from './DistrictKit';
import { sign, type Ctx } from './buildings';
import type { V3 } from './ColorMesh';

/**
 * Walk-in ground floors. Everything here draws in the FACADE FRAME of `buildings.ts` (street face
 * at z = 0, the room extends to −z, x along the street) and goes through the district kit, so a
 * room adds geometry to the existing per-surface meshes but no draws, textures or shader programs.
 * There are no lights: rooms read through pale finishes and 'glow' ceiling panels, because a district
 * point light would change every material's program.
 */
export interface RoomOptions {
  w: number; d: number; h: number;
  /** Door centre along x and its width; the opening runs to `doorH`. */
  doorX?: number; doorW?: number; doorH?: number;
  wall?: string; wallSurface?: KitSurface; inner?: string;
  floor?: string; floorSurface?: KitSurface;
  ceiling?: string;
  /** Front windows either side of the door, as [x, width] pairs (glass with a sill). */
  windows?: Array<[number, number]>;
  /** Top of the window glass (default 2.6 m); a lobby can run glass nearly to the ceiling. */
  windowTop?: number;
  /** Rows × columns of ceiling light panels. */
  lights?: [number, number];
  /** Leave out the back wall when another room continues behind (the cinema's lobby). */
  back?: boolean;
}

const T = .25; // wall thickness

/** Hollow room with a door in the front wall. Returns the interior bounds in the frame. */
export function room(c: Ctx, o: RoomOptions) {
  const { kit } = c, { w, d, h } = o, doorX = o.doorX ?? 0, doorW = o.doorW ?? 2.4, doorH = Math.min(o.doorH ?? 2.8, h - .3);
  const wall = o.wall ?? '#e8e2d4', surface = o.wallSurface ?? 'plaster', inner = o.inner ?? '#efe9dc';
  // Front wall: piers either side of the door (and of each window), lintel over the door.
  const left = doorX - doorW / 2 + w / 2, right = w / 2 - (doorX + doorW / 2);
  const top = o.windowTop ?? 2.6;
  if (left > .05) frontWall(c, -w / 2, doorX - doorW / 2, h, wall, surface, o.windows ?? [], top);
  if (right > .05) frontWall(c, doorX + doorW / 2, w / 2, h, wall, surface, o.windows ?? [], top);
  kit.wall([doorW, h - doorH, T], [doorX, doorH + (h - doorH) / 2, -T / 2], wall, surface);
  kit.box([doorW + .3, .12, .5], [doorX, doorH + .06, .05], '#2f3335', 'metal');
  // Side and back walls: outer finish, then a thin inner lining in the room colour.
  // Linings are 'glow' (unlit) in a muted tone: it stands in for the bounce light a room would have, which the
  // street's sun and sky can't reach, and the side walls are a shade darker than the back so corners still read.
  for (const s of [-1, 1]) { kit.wall([T, h, d], [s * (w / 2 - T / 2), h / 2, -d / 2], wall, surface); kit.box([.02, h - .05, d - T * 2], [s * (w / 2 - T - .01), h / 2, -d / 2], shade(inner, .8), 'glow'); }
  if (o.back !== false) { kit.wall([w, h, T], [0, h / 2, -d + T / 2], wall, surface); kit.box([w - T * 2, h - .05, .02], [0, h / 2, -d + T + .01], shade(inner, .88), 'glow'); }
  // Inside face of the front wall, between the openings.
  for (const [x0, x1] of frontSpans(w, doorX, doorW, o.windows ?? [])) kit.box([x1 - x0, h - .05, .02], [(x0 + x1) / 2, h / 2, -T - .01], shade(inner, .76), 'glow');
  kit.box([doorW, h - doorH - .05, .02], [doorX, (doorH + h) / 2, -T - .01], shade(inner, .76), 'glow');
  for (const [x, ww] of o.windows ?? []) {
    kit.box([ww, .86, .02], [x, .45, -T - .01], shade(inner, .76), 'glow');
    const top = o.windowTop ?? 2.6; if (h - top > .1) kit.box([ww, h - top - .05, .02], [x, (top + h) / 2, -T - .01], shade(inner, .76), 'glow');
  }
  // Floor flush with the pavement (top at 6 cm) and a skirting line.
  kit.box([w - T * 2, .04, d - T], [0, .04, -d / 2 - T / 2], o.floor ?? '#c9c1b0', o.floorSurface ?? 'paving');
  for (const s of [-1, 1]) kit.box([.03, .1, d - T * 2], [s * (w / 2 - T - .02), .1, -d / 2], '#3b3734', 'wood');
  kit.box([w - T * 2, .1, .03], [0, .1, -d + T + .02], '#3b3734', 'wood');
  // Ceiling slab, a lit soffit under it, and the light panels.
  kit.box([w, .2, d], [0, h + .1, -d / 2], o.ceiling ?? '#f2eee6', 'solid');
  kit.box([w - T * 2, .02, d - T * 2], [0, h - .005, -d / 2], shade(o.ceiling ?? '#f2eee6', .7), 'glow');
  const [rows, cols] = o.lights ?? [Math.max(1, Math.round(d / 4)), Math.max(1, Math.round(w / 4))];
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) kit.box([1.2, .03, .6], [-w / 2 + w * (k + .5) / cols, h - .02, -d * (r + .5) / rows], '#fff4dc', 'glow');
  return { minX: -w / 2 + T, maxX: w / 2 - T, minZ: -d + T, maxZ: -T, h };
}

/** A colour scaled towards black. */
const shade = (hex: string, f: number) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');

/** Solid stretches of the front wall (door and windows cut out), as [x0, x1] pairs. */
function frontSpans(w: number, doorX: number, doorW: number, windows: Array<[number, number]>) {
  const holes = [[doorX - doorW / 2, doorX + doorW / 2], ...windows.map(([x, ww]) => [x - ww / 2, x + ww / 2])].sort((a, b) => a[0] - b[0]);
  const spans: Array<[number, number]> = []; let x = -w / 2 + T;
  for (const [a, b] of holes) { if (a - x > .05) spans.push([x, a]); x = Math.max(x, b); }
  if (w / 2 - T - x > .05) spans.push([x, w / 2 - T]);
  return spans;
}

function frontWall(c: Ctx, x0: number, x1: number, h: number, wall: string, surface: KitSurface, windows: Array<[number, number]>, top: number) {
  const { kit } = c;
  const inside = windows.filter(([x, ww]) => x - ww / 2 >= x0 && x + ww / 2 <= x1).sort((a, b) => a[0] - b[0]);
  let x = x0;
  for (const [wx, ww] of inside) {
    const a = wx - ww / 2, b = wx + ww / 2;
    if (a - x > .02) kit.wall([a - x, h, T], [(x + a) / 2, h / 2, -T / 2], wall, surface);
    // Sill to 0.9 m, glass to `top`, wall above: solid all the way up.
    kit.wall([ww, .9, T], [wx, .45, -T / 2], wall, surface);
    kit.box([ww, top - .9, .04], [wx, (top + .9) / 2, -T / 2], '#5d7880', 'glass'); kit.solid([ww, top - .9, T], [wx, (top + .9) / 2, -T / 2]);
    for (let m = wx - ww / 2 + 1.5; m < wx + ww / 2 - .3; m += 1.5) kit.box([.06, top - .9, .08], [m, (top + .9) / 2, -T / 2 + .04], '#3a3f42', 'metal');
    if (h > top) kit.wall([ww, h - top, T], [wx, top + (h - top) / 2, -T / 2], wall, surface);
    kit.box([ww + .1, .06, .35], [wx, .92, -T / 2 + .05], '#d8d0c0', 'stone');
    x = b;
  }
  if (x1 - x > .02) kit.wall([x1 - x, h, T], [(x + x1) / 2, h / 2, -T / 2], wall, surface);
}

/* ------------------------------------------------------------------ furniture */
/** Office desk with a monitor (screen glows) and a chair, facing −z → +z by default. */
export function desk(c: Ctx, x: number, z: number, rotationY = 0, o: { screens?: number; screen?: string; top?: string } = {}) {
  const { kit } = c;
  kit.frame([x, 0, z], rotationY, () => {
    kit.box([1.5, .04, .75], [0, .74, 0], o.top ?? '#d9cfbf', 'wood');
    for (const sx of [-.7, .7]) kit.box([.05, .72, .68], [sx, .37, 0], '#2f3335', 'metal');
    kit.box([1.4, .3, .02], [0, .55, -.33], '#3a3d3f', 'metal');
    const n = o.screens ?? 1;
    for (let i = 0; i < n; i++) {
      const sx = (i - (n - 1) / 2) * .58;
      kit.box([.54, .33, .03], [sx, 1.0, -.22], '#1b1e20', 'metal');
      kit.box([.5, .29, .01], [sx, 1.0, -.2], o.screen ?? '#9fc6d8', 'glow');
      kit.box([.04, .16, .04], [sx, .83, -.24], '#1b1e20', 'metal');
    }
    kit.box([.45, .02, .15], [0, .77, .05], '#2a2c2e', 'metal');
    chair(c, 0, .55, Math.PI);
  });
}

/** Task chair; seat 0.46 m. Faces +z in its frame. */
export function chair(c: Ctx, x: number, z: number, rotationY = 0, color = '#2b3236') {
  const { kit } = c;
  kit.frame([x, 0, z], rotationY, () => {
    kit.box([.46, .07, .44], [0, .48, 0], color, 'fabric');
    kit.box([.44, .5, .06], [0, .75, -.21], color, 'fabric');
    kit.cylinder(.03, .4, [0, .24, 0], '#3a3a3a', 'metal', true);
    kit.box([.5, .03, .05], [0, .04, 0], '#3a3a3a', 'metal'); kit.box([.05, .03, .5], [0, .04, 0], '#3a3a3a', 'metal');
  });
}

/** Potted plant: a ceramic pot with layered foliage. */
export function plant(c: Ctx, x: number, z: number, height = 1.3) {
  const { kit } = c;
  kit.cylinder(.22, .45, [x, .23, z], '#d7d1c4', 'stone', true);
  for (let i = 0; i < 3; i++) kit.shape('sphere', [.32 - i * .06, .3, .32 - i * .06], [x + (i - 1) * .05, .5 + i * height * .28, z + (i % 2) * .05], ['#3f6d3a', '#4f7f42', '#5b8c4a'][i], 'foliage');
}

/** A wall-hung panel (screen, poster, whiteboard) with a painted face from the sign atlas. */
export function wallPanel(c: Ctx, text: string, x: number, y: number, z: number, width: number, height: number, style: { bg: string; fg: string; local?: string }, px: [number, number], rotationY = 0) {
  const { kit } = c;
  kit.frame([x, 0, z], rotationY, () => {
    kit.box([width + .12, height + .12, .05], [0, y, 0], '#232628', 'metal');
    sign(c, text, width, [0, y, .03] as V3, { ...style, border: 'none' }, px);
  });
}

/* ------------------------------------------------------------------ BKC: the Systems Office lobby floor */
/**
 * The BKC Systems Office as a walk-in tower: glass shaft above a double-height lobby that holds the
 * CCIEeXpert internship floor. Facade frame; `bkcOffice` furnishes it in district space.
 */
export function systemsOffice(c: Ctx) {
  const { kit } = c, w = 22, d = 20, h = 58, P = 6.5, glass = '#4d6977', frame = '#c9ccc8', band = '#a5a7a4';
  kit.box([w, h - P, d], [0, P + (h - P) / 2, -d / 2], glass, 'glass'); kit.solid([w, h - P, d], [0, P + (h - P) / 2, -d / 2]);
  for (let x = -w / 2; x <= w / 2 + .01; x += 1.6) kit.box([.1, h - P, .3], [x, P + (h - P) / 2, .12], frame, 'metal');
  for (let y = P; y < h; y += 3.7) kit.box([w + .2, .42, .2], [0, y, .07], band, 'metal');
  for (let y = P + 1.8; y < h - 2; y += 3.7) if (kit.rand() > .55) kit.box([1.4 + kit.rand() * 4, 1.1, .03], [(kit.rand() - .5) * (w - 4), y, .02], '#e9cf98', 'glow');
  kit.box([w * .7, 3, d * .7], [0, h + 1.5, -d / 2], frame, 'metal'); kit.rod([0, h + 3, -d / 2], [0, h + 9, -d / 2], .12, '#9a9d98');
  room(c, { w, d: 16, h: P, doorW: 3.2, doorH: 3.4, wall: '#d7d1c4', wallSurface: 'stone', inner: '#ece8df', floor: '#d6d1c6', floorSurface: 'stone', windows: [[-6.6, 7.2], [6.6, 7.2]], windowTop: P - .6, lights: [4, 5] });
  kit.box([8, .25, 3.2], [0, 4.4, 1.5], band, 'metal'); for (const s of [-1, 1]) kit.rod([s * 3.6, 0, 2.9], [s * 3.6, 4.3, 2.9], .09, '#aeb1ad');
  sign(c, 'BKC SYSTEMS OFFICE', 9, [0, P - .3, .2], { bg: '#18242c', fg: '#e9f1f4', border: 'none', local: 'बीकेसी · CCIEeXpert internship floor', tier: 1 }, [1024, 192]);
}

/** The lobby's furnishings, in district space (the lobby spans x 11.75–27.25, z −7.75–13.75). */
export function bkcOffice(c: Ctx) {
  const { kit } = c;
  // Reception on the right as you walk in, the company wall straight ahead.
  kit.box([1, 1.05, 3.6], [15.6, .53, 10], '#33393b', 'wood'); kit.box([1.15, .06, 3.8], [15.6, 1.08, 10], '#e9e5dc', 'stone');
  kit.box([.08, 2.4, 6], [27.05, 4.6, 3], '#1f2a30', 'metal');
  sign(c, 'CCIEeXpert', 5.6, [26.98, 4.95, 3] as V3, { bg: '#1f2a30', fg: '#f2f5f6', border: 'none', local: 'SYSTEMS OFFICE · BKC', tier: 1 }, [1024, 256], -Math.PI / 2);
  // Open-plan desks on the right, two rows facing the windows.
  for (const x of [20.2, 23.4]) for (const z of [8.2, 10.4, 12.6]) desk(c, x, z, -Math.PI / 2, { screens: 2 });
  // Glass meeting room on the left with a long table and a wall screen.
  for (const x of [19.5, 26.7]) { kit.box([.06, 2.7, 6.4], [x, 1.35, -4.4], '#b4cacd', 'glass'); kit.solid([.1, 2.7, 6.4], [x, 1.35, -4.4]); }
  kit.box([7.2, .06, .06], [23.1, 2.7, -1.2], '#3a3f42', 'metal'); kit.box([.06, 2.7, .06], [21.2, 1.35, -1.2], '#3a3f42', 'metal');
  kit.box([3.4, .05, 1.2], [23.1, .74, -4.6], '#d9cfbf', 'wood'); kit.box([.5, .7, .5], [23.1, .36, -4.6], '#2f3335', 'metal');
  for (const x of [21.8, 23.1, 24.4]) for (const s of [-1, 1]) chair(c, x, -4.6 + s * 1.05, s > 0 ? Math.PI : 0, '#4a5a62');
  kit.box([2.4, 1.3, .05], [23.1, 1.5, -7.6], '#1b1e20', 'metal'); kit.box([2.3, 1.2, .02], [23.1, 1.5, -7.57], '#9fc6d8', 'glow');
  // Rack row in the back corner: status LEDs on the doors.
  for (let i = 0; i < 3; i++) { const z = 12.6 - i * .75; kit.box([1, 2.1, .7], [26.4, 1.05, z], '#26292b', 'metal'); for (let y = .5; y < 2; y += .3) kit.box([.02, .03, .4], [25.89, y, z], i % 2 ? '#7de0a0' : '#8fd0ff', 'glow'); }
  for (const [x, z] of [[12.4, -7], [12.4, 13], [26.6, -7], [18.6, 13.1]] as const) plant(c, x, z, 1.5);
  // Lounge seating by the left window.
  kit.box([.9, .42, 2.6], [12.7, .21, -4.2], '#5d6a6f', 'fabric'); kit.box([.25, .45, 2.6], [12.35, .62, -4.2], '#5d6a6f', 'fabric'); kit.box([.6, .35, .6], [13.9, .18, -4.2], '#d9cfbf', 'wood');
}

/* ------------------------------------------------------------------ Juhu: the studio */
/** Juhu Studio as a walk-in bungalow: garden wall with a gate, the studio on the ground floor. Facade frame. */
export function studioBungalow(c: Ctx) {
  const { kit } = c, w = 16, d = 12, H = 6.6, G = 3.6, color = '#f1ece1';
  // Garden wall with a gate gap lined up on the studio door.
  for (const [x0, x1] of [[-9, -1.6], [1.6, 9]] as const) { kit.wall([x1 - x0, 1.7, .25], [(x0 + x1) / 2, .85, 2.2], '#d9cfbb', 'plaster'); kit.box([x1 - x0 + .05, .12, .35], [(x0 + x1) / 2, 1.75, 2.2], '#bfb39b', 'stone'); }
  for (const s of [-1, 1]) kit.box([.45, 2.1, .45], [s * 1.75, 1.05, 2.2], '#cbbfa6', 'stone');
  for (let x = -8; x < 8; x += 1.6) if (Math.abs(x) > 2) kit.shape('sphere', [.55, .45, .4], [x, 1.95, 2.15], x % 3.2 ? '#c4447a' : '#5e8b44', 'foliage');
  kit.frame([0, 0, -1], 0, () => room(c, { w, d, h: G, doorW: 2.2, doorH: 2.6, wall: color, inner: '#f6f1e6', floor: '#b88b5e', floorSurface: 'wood', windows: [[-4.8, 4.4], [4.8, 4.4]], lights: [3, 3] }));
  // Upper storey and the tiled roof.
  kit.box([w, H - G, d], [0, G + (H - G) / 2 + .2, -d / 2 - 1], color, 'plaster'); kit.solid([w, H - G, d], [0, G + (H - G) / 2 + .2, -d / 2 - 1]);
  for (const x of [-w * .3, 0, w * .3]) { kit.box([1.3, 1.5, .06], [x, 4.9, -.97], '#2d393c', 'glass'); for (const s of [-1, 1]) kit.box([.6, 1.5, .06], [x + s * .98, 4.9, -.95], '#5b7a5e', 'wood'); }
  kit.box([w + .8, .2, 2.6], [0, 3.8, .1], '#d8cdb6', 'stone'); for (const x of [-w / 2 + .5, w / 2 - .5]) kit.cylinder(.16, 3.7, [x, 1.85, 1.1], '#efe9dc', 'stone');
  for (const s of [-1, 1]) kit.shape('box', [w + 1.2, .14, d * .62], [0, H + 1.25, -1 - d / 2 + s * d * .27], '#a1503a', 'stone', [s * -.42, 0, 0]);
  sign(c, 'JUHU STUDIO', 4.2, [-4.6, 3.3, .02], { bg: '#efe8da', fg: '#2c3a3f', border: 'none', local: 'हॅलो · say hello', tier: 1 }, [768, 160]);
}

/** Studio furnishings in district space (the room spans x 10.25–21.75, z −2.75–12.75). */
export function juhuStudio(c: Ctx) {
  const { kit } = c;
  // The big work table: laptop, sketchbooks, a lamp.
  kit.box([1.3, .05, 2.8], [18.4, .76, 5], '#7a5236', 'wood'); for (const [dx, dz] of [[-.55, -1.25], [.55, -1.25], [-.55, 1.25], [.55, 1.25]]) kit.box([.06, .74, .06], [18.4 + dx, .37, 5 + dz], '#2c2a28', 'metal');
  kit.box([.36, .02, .5], [18.3, .8, 4.6], '#2b2d2f', 'metal'); kit.box([.02, .3, .48], [18.1, .94, 4.6], '#9fc6d8', 'glow');
  kit.box([.3, .05, .42], [18.5, .8, 5.6], '#d64b3a', 'fabric'); kit.box([.28, .03, .4], [18.6, .84, 6.1], '#efe6d1', 'fabric');
  kit.rod([18.7, .79, 3.9], [18.7, 1.25, 3.9], .015, '#2c2a28'); kit.shape('cone', [.18, .14, .18], [18.7, 1.27, 3.9], '#e7b33a', 'metal');
  for (const z of [4.1, 5.9]) chair(c, 17.3, z, Math.PI / 2, '#b0563a');
  // Bookshelf along the right wall, a sofa by the window, a rug.
  kit.box([2.8, 2.2, .4], [15.6, 1.1, 12.45], '#6a4a32', 'wood');
  for (const y of [.5, 1.05, 1.6]) for (let i = 0; i < 9; i++) kit.box([.08 + (i % 3) * .02, .32, .26], [14.4 + i * .28, y + .17, 12.3], ['#2a6fb0', '#c0392b', '#e7b33a', '#3d8a2f', '#efe6d1'][i % 5], 'fabric');
  kit.box([.9, .42, 2.4], [11.2, .21, 9.8], '#c97b4a', 'fabric'); kit.box([.25, .5, 2.4], [10.85, .6, 9.8], '#c97b4a', 'fabric');
  kit.box([2.4, .015, 3], [13.4, .07, 9.8], '#d9b679', 'fabric');
  for (const [x, z] of [[21.1, -2.1], [11, -2.1], [21.1, 12.1]] as const) plant(c, x, z, 1.4);
  // Pinboard of project cards on the left wall.
  kit.box([3.2, 1.6, .04], [16.4, 1.7, -2.68], '#b98d5c', 'wood');
  for (let i = 0; i < 8; i++) kit.box([.5, .36, .01], [15.2 + (i % 4) * .8, 2.1 - Math.floor(i / 4) * .7, -2.65], ['#fff8e8', '#f3d9a4', '#d6e9f2', '#f4c7b8'][i % 4], 'fabric');
}

/* ------------------------------------------------------------------ Film City: the Talkies */
const LOBBY = 7, HALL = 20;
/** Film City Talkies with a walk-in lobby and a full auditorium behind it. Facade frame. */
export function talkies(c: Ctx, draw: { screen: NonNullable<Parameters<typeof sign>[4]>['draw'] }) {
  const { kit } = c, w = 22, front = '#d9b98f', hall = '#8a5a48';
  room(c, { w, d: LOBBY, h: 4.4, doorW: 3, doorH: 3, wall: front, inner: '#e9d3b1', floor: '#7a2c38', floorSurface: 'fabric', windows: [[-6.8, 5], [6.8, 5]], lights: [2, 4], back: false });
  // Deco block above the lobby: fins, stepped parapet.
  kit.box([w, 7, LOBBY], [0, 4.4 + 3.5 + .2, -LOBBY / 2], front, 'plaster'); kit.solid([w, 7, LOBBY], [0, 4.4 + 3.5 + .2, -LOBBY / 2]);
  for (const x of [-6, -3, 0, 3, 6]) kit.box([.5, 6.4, .3], [x, 8.1, .1], '#e7cfa6', 'stone');
  for (const [wd, y] of [[22.4, 11.7], [14, 12.3], [6, 12.9]] as const) kit.box([wd, .6, 1], [0, y, -.3], '#e7cfa6', 'stone');
  // The auditorium behind: taller, plainer, its own roof.
  kit.frame([0, 0, -LOBBY], 0, () => room(c, { w, d: HALL, h: 9, doorW: 2.6, doorH: 2.8, wall: hall, inner: '#5a2a2a', floor: '#3b2422', floorSurface: 'fabric', ceiling: '#3a2626', lights: [0, 0] }));
  // Marquee, bulbs and posters on the street face.
  kit.box([16, 1.6, 3], [0, 3.6, 1.6], '#2b2220', 'solid');
  for (let x = -7.8; x <= 7.8; x += .4) for (const y of [2.84, 4.36]) kit.shape('sphere', [.06, .06, .06], [x, y, 3.12], '#ffe3a0', 'glow');
  sign(c, 'FILM CITY TALKIES', 14, [0, 3.6, 3.12], { bg: '#2b2220', fg: '#ffd56a', border: 'none', local: 'आज का शो · tonight: one engineering story', tier: 1 }, [1024, 128]);
  kit.box([2.4, 9, .8], [7.5, 8.6, .6], '#8a2f36', 'plaster'); sign(c, 'TALKIES', 7.5, [8.72, 8.6, .6], { bg: '#8a2f36', fg: '#ffe6a6', border: 'none', tier: 1 }, [768, 160], Math.PI / 2);
  // In the hall: screen, curtains, proscenium, projector port, wall lights.
  kit.frame([0, 0, -LOBBY - HALL + .3], 0, () => {
    kit.box([14, 6.4, .1], [0, 5, .05], '#1a1414', 'solid');
    sign(c, 'NINE SCENES', 13, [0, 5, .12], { draw: draw.screen }, [1024, 448]);
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) kit.box([.36, 7.6, .3], [s * (7.4 + i * .3), 4.4, .4 + (i % 2) * .12], '#8c1f26', 'fabric');
    kit.box([18, 1, .5], [0, 8.4, .3], '#c9a85c', 'stone');
    kit.box([16, .7, 2], [0, .35, 1.1], '#2a1c1a', 'wood'); kit.solid([16, .7, 2], [0, .35, 1.1]);
  });
  kit.box([1.4, .9, .6], [0, 6.8, -LOBBY - .55], '#1d1d1d', 'metal'); kit.shape('cylinder', [.22, .2, .22], [0, 6.8, -LOBBY - .9], '#fff6d8', 'glow', [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) for (let z = -LOBBY - 3; z > -LOBBY - HALL + 3; z -= 4) kit.box([.06, .6, .3], [s * (w / 2 - .3), 4.2, z], '#ffd9a0', 'glow');
}

/** Seats, aisle lights and the lobby counters, in district space (lobby x 8–15, hall x 15–35, z −8–14). */
export function talkiesInterior(c: Ctx) {
  const { kit } = c;
  // Ten rows of seats in two blocks around a centre aisle, facing the screen.
  for (let r = 0; r < 10; r++) {
    const x = 19 + r * 1.1;
    for (const [z0, n] of [[-6.6, 7], [5.2, 7]] as const) for (let i = 0; i < n; i++) {
      const z = z0 + i * .62;
      kit.box([.5, .12, .5], [x, .5, z], '#9e2a30', 'fabric'); kit.box([.1, .62, .52], [x - .25, .78, z], '#9e2a30', 'fabric');
      kit.box([.45, .42, .08], [x, .23, z - .28], '#2b2220', 'metal');
    }
    for (const z of [1.15, 4.85]) kit.box([.15, .04, .15], [x + .5, .08, z], '#ffd9a0', 'glow');
  }
  // Lobby: the box-office counter (its exhibit stands on it), snack bar, posters.
  kit.box([3, .02, 1.6], [12.4, .07, -4.5], '#a8343e', 'fabric');
  kit.box([.8, 1.05, 3], [13.9, .53, 11.2], '#4a2c26', 'wood'); kit.box([.9, .06, 3.1], [13.9, 1.08, 11.2], '#e8d6b0', 'stone');
  for (let i = 0; i < 4; i++) kit.box([.3, .3, .3], [13.9, 1.26, 10.1 + i * .7], ['#f1c56a', '#e8e2d2', '#d64b3a', '#f1c56a'][i], 'fabric');
  for (const z of [-7.62, 13.62]) for (const x of [9.8, 12.6]) kit.box([1.6, 2.2, .04], [x, 1.9, z], z < 0 ? '#3a1f4a' : '#173a4a', 'fabric');
}
