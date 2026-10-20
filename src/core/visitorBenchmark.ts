/**
 * Visitor-runnable benchmark (`/?bench`). It tours the nine districts on whatever machine opens it and
 * reports frame-time percentiles per district, so laptop and phone numbers can be collected without a
 * dev server or Playwright. Pure helpers live here; the tour itself is `ui/VisitorBenchmark.tsx`.
 */

/** Stops in tour order: CST and Fort share the first street, then the seven districts. */
export const BENCH_STOPS = ['cst', 'fort', 'bkc', 'andheri', 'powai', 'dadar', 'worli', 'juhu', 'filmcity'] as const;
export const BENCH_WARMUP_S = 4;
export const BENCH_SAMPLE_S = 12;

/** `tickMs` / `renderMs`: main-thread time this frame spent building districts and inside the renderer (CPU, including any wait on shader linking). */
export interface BenchFrame { frameMs: number; draws: number; triangles: number; textures: number; programs: number; scale: number; low: boolean; tickMs?: number; renderMs?: number }

/** How a jump to a district went: programs the driver had to link for it, how long the jump waited on them, and whether it gave up waiting. */
export interface ArrivalShaders { parallel: boolean; newPrograms: number; linkWaitMs: number; capped: boolean }

export interface FrameStats { frames: number; p50: number; p95: number; p99: number; max: number; mean: number; fps: number; over33: number; over50: number }

export interface DistrictResult {
  id: string;
  /** Synchronous build time of the district when travelling there (0 for the shared CST–Fort street). */
  buildMs: number;
  /** Worst frame during warm-up: shader compiles and texture uploads after arriving. */
  arrivalHitchMs: number;
  /** Worst frame once the visitor stands in the district (the rest of `arrivalHitchMs` falls while "Heading to…" shows). */
  landedHitchMs?: number;
  stats: FrameStats;
  peak: { draws: number; triangles: number; textures: number; programs: number };
  scale: number;
  low: boolean;
  /** What the last measured frame actually binds; the peak counters above are renderer totals (see `ViewResources`). */
  inView?: ViewResources;
  /** Where the hitch went: the work of the frame before the longest gap (a long gap is the previous callback's work, or the browser's). */
  hitchCause?: { tickMs: number; renderMs: number };
  shaders?: ArrivalShaders;
}

/**
 * Resources bound by the visible scene at one moment. `renderer.info.memory.textures` also counts every
 * skinned actor's bone matrix texture (20×20 floats, about 6 KiB each) and render targets, and
 * `renderer.info.programs` is every program compiled this session, so neither says what a frame uses.
 */
export interface ViewResources { imageTextures: number; boneTextures: number; programs: number }

export interface BenchReport {
  version: 1;
  url: string;
  commit: string;
  when: string;
  device: { gpu: string; vendor: string; userAgent: string; platform: string; cores: number | null; memoryGb: number | null; screen: string; dpr: number; viewport: string };
  settings: { preset: string; adaptive: boolean; warmupS: number; sampleS: number };
  load: { worldReadyMs: number; scriptKb: number; wasmKb: number; modelKb: number };
  districts: DistrictResult[];
  overall: FrameStats;
  /** Fewer stops than planned: stopped by the visitor or the tab was hidden (`hidden`). */
  interrupted: boolean;
  hidden: boolean;
}

/** Nearest-rank percentile of an ascending array. */
export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p / 100 * sorted.length) - 1))];
}

const round = (value: number) => Math.round(value * 10) / 10;

export function frameStats(frameMs: number[]): FrameStats {
  const valid = frameMs.filter(ms => Number.isFinite(ms) && ms > 0);
  const sorted = [...valid].sort((a, b) => a - b), total = valid.reduce((sum, ms) => sum + ms, 0);
  return {
    frames: valid.length, p50: round(percentile(sorted, 50)), p95: round(percentile(sorted, 95)), p99: round(percentile(sorted, 99)),
    max: round(sorted[sorted.length - 1] ?? 0), mean: round(valid.length ? total / valid.length : 0), fps: round(total ? valid.length * 1000 / total : 0),
    over33: valid.filter(ms => ms > 33.4).length, over50: valid.filter(ms => ms > 50).length,
  };
}

export function districtResult(id: string, buildMs: number, warmup: BenchFrame[], sample: BenchFrame[], inView?: ViewResources, shaders?: ArrivalShaders, landedAt?: number): DistrictResult {
  const last = sample[sample.length - 1] ?? warmup[warmup.length - 1];
  const peak = (key: 'draws' | 'triangles' | 'textures' | 'programs') => Math.max(0, ...sample.map(f => f[key]));
  const worst = warmup.reduce((best, f, i) => f.frameMs > (warmup[best]?.frameMs ?? -1) ? i : best, -1), before = warmup[worst - 1];
  return {
    id, buildMs: round(buildMs), arrivalHitchMs: round(Math.max(0, ...warmup.map(f => f.frameMs))), stats: frameStats(sample.map(f => f.frameMs)),
    peak: { draws: peak('draws'), triangles: peak('triangles'), textures: peak('textures'), programs: peak('programs') },
    scale: last?.scale ?? 1, low: last?.low ?? false, ...(inView ? { inView } : {}),
    ...(landedAt !== undefined ? { landedHitchMs: round(Math.max(0, ...warmup.slice(landedAt + 1).map(f => f.frameMs))) } : {}),
    ...(before ? { hitchCause: { tickMs: round(before.tickMs ?? 0), renderMs: round(before.renderMs ?? 0) } } : {}), ...(shaders ? { shaders: { ...shaders, linkWaitMs: round(shaders.linkWaitMs) } } : {}),
  };
}

/** The unmasked GPU name where the browser exposes it (Firefox and Safari may only give a generic string). */
export function gpuName(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    gpu: String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
    vendor: String(ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)),
  };
}

/** Bytes fetched so far by kind, from Resource Timing (0 where the browser hides transfer sizes). */
export function loadCost(entries: PerformanceResourceTiming[]) {
  const kb = (test: RegExp) => Math.round(entries.filter(e => test.test(new URL(e.name, location.href).pathname)).reduce((sum, e) => sum + (e.transferSize || e.encodedBodySize || 0), 0) / 1024);
  return { scriptKb: kb(/\.m?js$/), wasmKb: kb(/\.wasm$/), modelKb: kb(/\.(glb|gltf|ktx2|jpg|png)$/) };
}

const pad = (value: string | number, width: number) => String(value).padStart(width);

/** Plain-text summary for pasting into chat; the JSON follows it in the copied text. */
export function formatReport(report: BenchReport) {
  const lines = [
    `Mumbai portfolio benchmark · ${report.when} · ${report.commit.slice(0, 7)}${report.interrupted ? ' · INTERRUPTED' : ''}${report.hidden ? ' · TAB WAS HIDDEN' : ''}`,
    `GPU: ${report.device.gpu} (${report.device.vendor})`,
    `Browser: ${report.device.userAgent}`,
    `Screen ${report.device.screen} @${report.device.dpr}x · viewport ${report.device.viewport} · ${report.device.cores ?? '?'} cores · ${report.device.memoryGb ?? '?'} GB`,
    `Preset ${report.settings.preset} · ${report.settings.adaptive ? 'adaptive quality on' : 'quality pinned'} · ${report.settings.warmupS}s warm-up + ${report.settings.sampleS}s pan per stop`,
    `World ready ${Math.round(report.load.worldReadyMs)} ms · JS ${report.load.scriptKb} kB · WASM ${report.load.wasmKb} kB · models/textures ${report.load.modelKb} kB`,
    '',
    'district     p50    p95    p99    max   fps  >33ms  hitch  build  draws   tris  tex prog  img bone view scale',
    ...report.districts.map(d => `${d.id.padEnd(9)}${pad(d.stats.p50, 7)}${pad(d.stats.p95, 7)}${pad(d.stats.p99, 7)}${pad(d.stats.max, 7)}${pad(d.stats.fps, 6)}${pad(d.stats.over33, 7)}${pad(d.arrivalHitchMs, 7)}${pad(d.buildMs, 7)}${pad(d.peak.draws, 7)}${pad(Math.round(d.peak.triangles / 1000) + 'k', 7)}${pad(d.peak.textures, 5)}${pad(d.peak.programs, 5)}${pad(d.inView?.imageTextures ?? '-', 5)}${pad(d.inView?.boneTextures ?? '-', 5)}${pad(d.inView?.programs ?? '-', 5)}${pad(d.scale.toFixed(2) + (d.low ? 'L' : ''), 6)}`),
    `${'all'.padEnd(9)}${pad(report.overall.p50, 7)}${pad(report.overall.p95, 7)}${pad(report.overall.p99, 7)}${pad(report.overall.max, 7)}${pad(report.overall.fps, 6)}${pad(report.overall.over33, 7)}`,
    '',
    'arrival   landed  newprog  linkwait  gaveup  parallel  before-hitch: build render',
    ...report.districts.map(d => `${d.id.padEnd(9)}${pad(d.landedHitchMs ?? '-', 7)}${pad(d.shaders?.newPrograms ?? '-', 9)}${pad(d.shaders?.linkWaitMs ?? '-', 10)}${pad(d.shaders ? (d.shaders.capped ? 'yes' : 'no') : '-', 8)}${pad(d.shaders ? (d.shaders.parallel ? 'yes' : 'no') : '-', 10)}${pad(d.hitchCause?.tickMs ?? '-', 20)}${pad(d.hitchCause?.renderMs ?? '-', 7)}`),
    '',
    'Frame times in ms. hitch = worst frame from choosing the stop to the end of the warm-up; build = wait from choosing the stop to standing there (the district builds in slices meanwhile); tex = all renderer textures; prog = shader programs compiled so far (cumulative); img / bone / view = image textures, bone textures and programs the visible scene binds at the end of the pan; L = low tier engaged. landed = worst frame after standing in the district (the rest of hitch falls while "Heading to…" shows); newprog = shader programs the driver had to link for the district; linkwait = how long the jump waited on them; gaveup = landed before they finished; before-hitch = district building and renderer time in the frame before the longest gap.',
  ];
  return lines.join('\n');
}
