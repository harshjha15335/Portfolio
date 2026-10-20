import * as THREE from 'three';
import type { District } from './District';
import { SignAtlas, placed } from './DistrictSystems';
import { exhibitsOf, type DistrictExhibit } from '../../../data/districtExhibits';
import { districts } from '../../../data/city';

/** Board face: 1.3 × 0.65 m, centre 1.55 m up, painted at 512 × 256. */
export const EXHIBIT_PANEL = { width: 1.3, height: .65, centre: 1.55 };

/** One line, condensed by the canvas if it would overrun the board. */
const fit = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number) => ctx.fillText(text, x, y, max);

function painter(e: DistrictExhibit, accent: string) {
  return (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = '#f3ead6'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = accent; ctx.fillRect(x, y, w, h * .2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff8e8'; ctx.font = `bold ${Math.round(h * .085)}px Arial, sans-serif`; fit(ctx, e.panel.eyebrow, x + w * .045, y + h * .135, w * .91);
    ctx.fillStyle = '#1f2a2c'; ctx.font = `bold ${Math.round(h * .15)}px Georgia, serif`; fit(ctx, e.panel.title, x + w * .045, y + h * .4, w * .91);
    ctx.fillStyle = '#3a4646'; ctx.font = `${Math.round(h * .085)}px Arial, sans-serif`;
    e.panel.lines.slice(0, 3).forEach((line, i) => fit(ctx, line, x + w * .045, y + h * (.56 + i * .12), w * .91));
    ctx.fillStyle = accent; ctx.fillRect(x, y + h * .9, w, h * .1);
    ctx.fillStyle = '#fff8e8'; ctx.font = `bold ${Math.round(h * .06)}px Arial, sans-serif`; ctx.fillText('PRESS E · INSPECT', x + w * .045, y + h * .97);
  };
}

/**
 * Exhibit boards for one district: by default two posts, a framed board facing the road,
 * a solid base (low, so line of sight to the board stays clear) and an interaction just in
 * front of the face. Wall boards hang on a wall instead, and markers are only the interaction. Boards paint into their own small atlas so the district's sign atlas
 * keeps its space; all boards in a district merge into one draw.
 */
export function buildExhibits(d: District) {
  const list = exhibitsOf(d.spec.id); if (!list.length) return null;
  const atlas = new SignAtlas(1024), { kit } = d, accent = districts.find(x => x.id === d.spec.id)?.color ?? '#2f4a4a';
  const { width, height, centre } = EXHIBIT_PANEL;
  for (const e of list) {
    const nx = e.x > 0 ? -1 : 1, yaw = nx < 0 ? -Math.PI / 2 : Math.PI / 2, mount = e.mount ?? 'board';
    if (mount !== 'marker') kit.frame([e.x, 0, e.z], yaw, () => {
      if (mount === 'wall') {
        // Flush on the wall behind: a frame and an accent rail, nothing on the floor.
        kit.box([width + .16, height + .14, .05], [0, centre, -.04], '#2b3233', 'metal');
        kit.box([width + .3, .06, .1], [0, centre + height / 2 + .12, -.02], accent, 'metal');
        atlas.add(e.panel.title, width, placed([0, centre, -.01], 0, kit.here), { draw: painter(e, accent) }, [512, 256]);
        return;
      }
      // Local frame: +z is the board's facing direction.
      for (const sx of [-1, 1]) kit.box([.07, centre + height / 2 + .2, .07], [sx * (width / 2 + .06), (centre + height / 2 + .2) / 2, -.03], '#2b3233', 'metal');
      kit.box([width + .16, height + .14, .05], [0, centre, -.04], '#2b3233', 'metal');
      kit.box([width + .3, .06, .14], [0, centre + height / 2 + .12, -.02], accent, 'metal');
      kit.box([width + .3, .08, .4], [0, .04, -.03], '#8d8676', 'stone');
      kit.solid([width + .3, 1, .3], [0, .5, -.03]);
      atlas.add(e.panel.title, width, placed([0, centre, -.01], 0, kit.here), { draw: painter(e, accent) }, [512, 256]);
    });
    d.interactions.push({ id: e.id, label: e.label, position: new THREE.Vector3(d.origin.x + e.x + nx * .12, centre, e.z) });
  }
  return atlas;
}
