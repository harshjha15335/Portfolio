/**
 * Seven-segment LED digits, drawn as segment shapes (not a font) the way a fare meter's display is built.
 * Segments are named a–g clockwise from the top, with g the middle bar.
 */
export type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
const GLYPHS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
  '-': 'g', ' ': '', F: 'aefg', r: 'eg', E: 'adefg', H: 'bcefg', P: 'abefg', A: 'abcefg', o: 'cdeg', n: 'ceg', t: 'defg', d: 'bcdeg', C: 'adef', L: 'def', U: 'bcdef',
};
export const segmentsFor = (char: string) => (GLYPHS[char] ?? '').split('') as Segment[];

/** A digit cell: its lit segments, and whether its decimal point (or the clock colon after it) is lit. */
export interface Cell { segments: Segment[]; point: boolean; colon: boolean }

/** Lay `text` right-aligned into `cells` digit cells: '.' lights the point of the digit before it, ':' its colon. */
export function layoutCells(text: string, cells: number): Cell[] {
  const out: Cell[] = [];
  for (const char of text) {
    if ((char === '.' || char === ':') && out.length) { out[out.length - 1][char === '.' ? 'point' : 'colon'] = true; continue; }
    out.push({ segments: segmentsFor(char), point: false, colon: false });
  }
  const shown = out.slice(-cells);
  while (shown.length < cells) shown.unshift({ segments: [], point: false, colon: false });
  return shown;
}

/** Segment polygons for a digit `w` wide and `h` tall at (x, y), slanted forward by `slant` (fraction of width). */
function segmentPath(ctx: CanvasRenderingContext2D, segment: Segment, x: number, y: number, w: number, h: number, t: number, slant: number) {
  const half = h / 2, k = t / 2, gap = t * .18;
  // Horizontal bar between x0..x1 at height cy, vertical bar between y0..y1 at cx (in unslanted coordinates).
  const pts: Array<[number, number]> = [];
  const horizontal = (cy: number) => { const x0 = gap + k, x1 = w - gap - k; pts.push([x0, cy], [x0 + k, cy - k], [x1 - k, cy - k], [x1, cy], [x1 - k, cy + k], [x0 + k, cy + k]); };
  const vertical = (cx: number, y0: number, y1: number) => { pts.push([cx, y0 + gap], [cx + k, y0 + gap + k], [cx + k, y1 - gap - k], [cx, y1 - gap], [cx - k, y1 - gap - k], [cx - k, y0 + gap + k]); };
  switch (segment) {
    case 'a': horizontal(k); break; case 'g': horizontal(half); break; case 'd': horizontal(h - k); break;
    case 'f': vertical(k, k, half); break; case 'b': vertical(w - k, k, half); break;
    case 'e': vertical(k, half, h - k); break; case 'c': vertical(w - k, half, h - k); break;
  }
  ctx.beginPath(); pts.forEach(([px, py], i) => { const sx = x + px + (h - py) * slant * w / h; i ? ctx.lineTo(sx, y + py) : ctx.moveTo(sx, y + py); }); ctx.closePath();
}

export interface SegmentStyle { lit: string; unlit: string; glow: string; slant: number; thickness: number }
export const RED_LED: SegmentStyle = { lit: '#ff3a24', unlit: 'rgba(120, 22, 16, .22)', glow: 'rgba(255, 50, 30, .85)', slant: .08, thickness: .16 };

/**
 * Draw `text` in `cells` digit cells into the box (x, y, width, height): every segment of every cell is drawn,
 * unlit ones faint (as on a real LED face), lit ones bright with a glow.
 */
export function drawSegments(ctx: CanvasRenderingContext2D, text: string, cells: number, x: number, y: number, width: number, height: number, style: SegmentStyle = RED_LED) {
  const layout = layoutCells(text, cells), pitch = width / cells, w = pitch * .74, t = Math.min(w, height) * style.thickness;
  layout.forEach((cell, i) => {
    const cx = x + i * pitch + (pitch - w) / 2;
    for (const segment of ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as Segment[]) {
      const on = cell.segments.includes(segment);
      segmentPath(ctx, segment, cx, y, w, height, t, style.slant);
      ctx.shadowBlur = on ? t * 1.6 : 0; ctx.shadowColor = style.glow; ctx.fillStyle = on ? style.lit : style.unlit; ctx.fill();
    }
    const dot = (dx: number, dy: number, on: boolean) => { ctx.beginPath(); ctx.arc(dx, dy, t * .62, 0, Math.PI * 2); ctx.shadowBlur = on ? t * 1.4 : 0; ctx.fillStyle = on ? style.lit : style.unlit; ctx.fill(); };
    dot(cx + w + (pitch - w) * .45, y + height - t * .6, cell.point);
    if (cell.colon) { dot(cx + w + (pitch - w) * .5 + height * style.slant * .5, y + height * .32, true); dot(cx + w + (pitch - w) * .5 + height * style.slant * .2, y + height * .7, true); }
  });
  ctx.shadowBlur = 0;
}
