import { sign, type Ctx } from './buildings';
import { desk, plant, room } from './interiors';

/**
 * Powai's project workplaces: one small walk-in building per flagship project along the lakeside,
 * each with its own silhouette so the projects read as places, not a row of identical boards.
 * Facade frame (street face at z = 0, the room extends to −z). Inside, the project's board hangs on
 * the back wall (built by `exhibits.ts` from `districtExhibits.ts`) and a desk shows a painted still
 * of the demo; pressing E at the board runs the real demo.
 */
export type LabForm = 'observatory' | 'tower' | 'bank' | 'timber' | 'transit' | 'lens' | 'lab';
export interface PowaiLab { id: string; title: string; form: LabForm; color: string; accent: string; still: Still }
export type Still = 'chart' | 'queue' | 'flows' | 'transcript' | 'route' | 'code' | 'ranking';

/** Width along the street, depth and height of every workplace; `PODS` in districtExhibits uses the same spacing. */
export const LAB = { w: 8, d: 7, h: 3.6 };

export function powaiLab(c: Ctx, lab: PowaiLab) {
  const { kit } = c, { w, d, h } = LAB;
  room(c, { w, d, h, doorW: 2, doorH: 2.7, wall: lab.color, inner: '#f1ede4', floor: '#cfc7b6', floorSurface: 'stone', windows: [[-2.65, 1.9], [2.65, 1.9]], lights: [2, 2] });
  sign(c, lab.title.toUpperCase(), 3.6, [0, 3.2, .16], { bg: '#1d2326', fg: lab.accent, border: 'none', tier: 1 }, [768, 128]);
  kit.box([2.8, .12, 1], [0, 2.86, .45], '#2a2e30', 'metal');
  // Inside: the demo desk, its painted still on the back wall above it, a plant by the door.
  desk(c, -2.2, -5.25, 0, { screens: 2, screen: lab.accent });
  kit.box([1.76, 1.02, .05], [-2.2, 2.05, -d + .29], '#1b1e20', 'metal');
  sign(c, `${lab.title} demo`, 1.6, [-2.2, 2.05, -d + .32], { draw: still(lab.still, lab.accent) }, [512, 320]);
  plant(c, 3.1, -1, 1.2);
  form(c, lab);
}

/** What makes each workplace recognisable from the road. */
function form(c: Ctx, lab: PowaiLab) {
  const { kit } = c, { w, d, h } = LAB, roof = h + .2;
  switch (lab.form) {
    case 'observatory': // A domed observatory on the roof, its slit open, and a star on a mast.
      kit.cylinder(1.6, 1.6, [1.2, roof + .8, -d / 2], '#dfe3e6', 'stone'); kit.shape('dome', [1.6, 1.6, 1.6], [1.2, roof + 1.6, -d / 2], '#e8ecef', 'metal');
      kit.box([.5, 1.3, 1.7], [1.2, roof + 2.6, -d / 2], '#1b2433', 'metal'); kit.rod([1.2, roof + 2.2, -d / 2], [2.4, roof + 3.2, -d / 2], .12, '#9aa3ad');
      kit.rod([-3, roof, -1], [-3, roof + 4.5, -1], .05, '#9aa3ad'); kit.shape('sphere', [.32, .32, .32], [-3, roof + 4.8, -1], lab.accent, 'glow');
      break;
    case 'tower': // A control tower at the back corner: a shaft and a glass cab with a lit band.
      kit.box([1.8, 7, 1.8], [-2.8, roof + 3.5, -d + 1.1], lab.color, 'plaster'); kit.solid([1.8, 7, 1.8], [-2.8, roof + 3.5, -d + 1.1]);
      kit.box([3.4, 2, 3.4], [-2.8, roof + 8, -d + 1.1], '#5d7880', 'glass'); kit.box([3.6, .25, 3.6], [-2.8, roof + 9.1, -d + 1.1], '#2a2e30', 'metal');
      kit.box([3.5, .18, 3.5], [-2.8, roof + 7.05, -d + 1.1], lab.accent, 'glow'); kit.rod([-2.8, roof + 9.2, -d + 1.1], [-2.8, roof + 11, -d + 1.1], .05, '#c9ccc8');
      break;
    case 'bank': // A small colonnade and pediment with a ticker band across the top.
      for (const x of [-3.55, -2.15, 2.15, 3.55]) kit.cylinder(.22, h, [x, h / 2, .55], '#ece6d8', 'stone'); // clear of the name board
      kit.box([w + .6, .45, 1.4], [0, h + .25, .25], '#e4dccb', 'stone'); kit.box([w - 1.2, .5, 1.3], [0, h + .72, .25], '#e4dccb', 'stone'); kit.box([w - 3.6, .4, 1.2], [0, h + 1.17, .25], '#e4dccb', 'stone');
      kit.box([w - .4, .32, .05], [0, h - .25, 1.26], lab.accent, 'glow');
      break;
    case 'timber': // Vertical timber fins over the walls and a pitched roof.
      for (let x = -w / 2 + .2; x <= w / 2 - .2; x += .5) if (Math.abs(x) > 1.2 && (Math.abs(x) < 1.65 || Math.abs(x) > 3.65)) kit.box([.08, h, .12], [x, h / 2, .07], '#8a6644', 'wood');
      for (const s of [-1, 1]) kit.shape('box', [w + .6, .14, d * .6], [0, h + 1, -d / 2 + s * d * .26], '#5e4a36', 'wood', [s * .5, 0, 0]);
      break;
    case 'transit': // A route-map canopy over the front and a bike stand.
      kit.box([w + .4, .18, 2.4], [0, h - .3, 1.2], lab.accent, 'metal'); for (const x of [-w / 2, w / 2]) kit.rod([x, 0, 2.3], [x, h - .4, 2.3], .06, '#2a2e30');
      for (let x = -3.4; x <= -1.6; x += .45) { kit.rod([x, 0, 2], [x, .7, 2], .02, '#2a2e30'); kit.rod([x, .7, 2], [x, .7, 1.6], .02, '#2a2e30'); }
      break;
    case 'lens': // A round lens window over the door and an antenna.
      kit.shape('cylinder', [1.1, .12, 1.1], [0, h + 1.1, .08], '#2a2e30', 'metal', [Math.PI / 2, 0, 0]); kit.shape('cylinder', [.9, .06, .9], [0, h + 1.1, .16], lab.accent, 'glow', [Math.PI / 2, 0, 0]);
      kit.box([3, 2.4, .3], [0, h + 1.1, -.15], lab.color, 'plaster'); kit.rod([2.8, roof, -d + 1], [2.8, roof + 3, -d + 1], .04, '#9aa3ad');
      break;
    case 'lab': // Rooftop plant: a stacked container and exhaust stacks.
      kit.box([5, 2.4, 2.4], [-.5, roof + 1.2, -d + 1.6], lab.accent, 'metal'); kit.box([3.2, 2.2, 2.2], [.4, roof + 3.5, -d + 1.6], '#8d8676', 'metal');
      for (const x of [2.6, 3.2]) kit.cylinder(.22, 3.4, [x, roof + 1.7, -1.6], '#b7b2a6', 'metal');
      break;
  }
}

/** A flat illustration of each demo's main view (shapes only, no figures). */
function still(kind: Still, accent: string) {
  return (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = '#10161a'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#1d272d'; ctx.fillRect(x, y, w, h * .12);
    ctx.fillStyle = accent; ctx.fillRect(x + w * .03, y + h * .04, w * .2, h * .04);
    const px = (u: number) => x + w * (.06 + u * .88), py = (v: number) => y + h * (.2 + v * .72);
    ctx.strokeStyle = accent; ctx.fillStyle = accent; ctx.lineWidth = Math.max(2, h * .015);
    switch (kind) {
      case 'chart': ctx.beginPath(); [.8, .7, .74, .5, .56, .32, .2].forEach((v, i) => i ? ctx.lineTo(px(i / 6), py(v)) : ctx.moveTo(px(0), py(v))); ctx.stroke(); break;
      case 'queue': for (let i = 0; i < 6; i++) { ctx.globalAlpha = 1 - i * .12; ctx.fillRect(px(0), py(i / 6), w * .88 * (.9 - i * .1), h * .08); } ctx.globalAlpha = 1; break;
      case 'flows': for (let i = 0; i < 5; i++) ctx.fillRect(px(i / 5), py(1 - [.6, .4, .8, .3, .5][i]), w * .12, h * .72 * [.6, .4, .8, .3, .5][i]); break;
      case 'transcript': for (let i = 0; i < 7; i++) { ctx.globalAlpha = i % 3 === 2 ? 1 : .45; ctx.fillRect(px(i % 3 === 2 ? .05 : 0), py(i / 7), w * .88 * [.8, .6, .5, .75, .7, .4, .65][i], h * .05); } ctx.globalAlpha = 1; break;
      case 'route': ctx.beginPath(); ctx.moveTo(px(0), py(.9)); ctx.lineTo(px(.3), py(.6)); ctx.lineTo(px(.55), py(.65)); ctx.lineTo(px(.8), py(.2)); ctx.lineTo(px(1), py(.1)); ctx.stroke(); for (const [u, v] of [[0, .9], [.3, .6], [.55, .65], [.8, .2]]) ctx.fillRect(px(u) - 6, py(v) - 6, 12, 12); break;
      case 'code': for (let i = 0; i < 8; i++) { ctx.globalAlpha = i === 3 || i === 4 ? 1 : .35; ctx.fillRect(px((i % 4) * .04), py(i / 8), w * .88 * [.5, .7, .4, .8, .6, .3, .55, .45][i], h * .05); } ctx.globalAlpha = 1; break;
      case 'ranking': for (let i = 0; i < 6; i++) { ctx.globalAlpha = 1 - i * .1; ctx.fillRect(px(.08), py(i / 6), w * .8 * (1 - i * .13), h * .07); ctx.fillRect(px(0), py(i / 6), w * .03, h * .07); } ctx.globalAlpha = 1; break;
    }
  };
}
