import { describe, it, expect } from 'vitest';
import { BENCH_STOPS, districtResult, formatReport, frameStats, percentile, type BenchFrame, type BenchReport } from '../src/core/visitorBenchmark';
import { streetStops } from '../src/game/World/streetLayout';

const frame = (frameMs: number, extra: Partial<BenchFrame> = {}): BenchFrame => ({ frameMs, draws: 80, triangles: 200_000, textures: 30, programs: 25, scale: 1, low: false, ...extra });

describe('visitor benchmark', () => {
  it('tours all nine canonical districts, each a physical stop', () => {
    expect(BENCH_STOPS).toHaveLength(9);
    for (const id of BENCH_STOPS) expect(streetStops[id], id).toBeDefined();
  });
  it('uses nearest-rank percentiles', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(sorted, 50)).toBe(50); expect(percentile(sorted, 95)).toBe(95); expect(percentile(sorted, 99)).toBe(99);
    expect(percentile([7], 99)).toBe(7); expect(percentile([], 50)).toBe(0);
  });
  it('summarises frame times and ignores the zero first frame', () => {
    const stats = frameStats([0, ...Array(98).fill(16), 40, 60]);
    expect(stats.frames).toBe(100); expect(stats.p50).toBe(16); expect(stats.p99).toBe(40); expect(stats.max).toBe(60);
    expect(stats.over33).toBe(2); expect(stats.over50).toBe(1);
    expect(stats.fps).toBeCloseTo(100_000 / (98 * 16 + 100), 0);
  });
  it('reports the arrival hitch from warm-up and peaks from the sample', () => {
    const result = districtResult('bkc', 120.04, [frame(250), frame(20)], [frame(16, { textures: 31 }), frame(17, { programs: 34, scale: .8, low: true })]);
    expect(result.arrivalHitchMs).toBe(250); expect(result.buildMs).toBe(120);
    expect(result.peak).toEqual({ draws: 80, triangles: 200_000, textures: 31, programs: 34 });
    expect(result.low).toBe(true); expect(result.scale).toBe(.8);
  });
  it('formats a copyable table with a row per district', () => {
    const districts = BENCH_STOPS.map(id => districtResult(id, 0, [frame(30)], [frame(16), frame(18)]));
    const report: BenchReport = { version: 1, url: 'https://x/?bench', commit: 'abcdef1234', when: '2026-10-20T00:00:00Z', device: { gpu: 'Test GPU', vendor: 'Test', userAgent: 'UA', platform: 'Linux', cores: 8, memoryGb: 8, screen: '1920×1080', dpr: 1, viewport: '1920×1000' }, settings: { preset: 'medium', adaptive: true, warmupS: 4, sampleS: 12 }, load: { worldReadyMs: 3000, scriptKb: 900, wasmKb: 200, modelKb: 5000 }, districts, overall: frameStats([16, 18]), interrupted: false, hidden: false };
    const text = formatReport(report);
    expect(text).toContain('GPU: Test GPU'); expect(text).toContain('abcdef1');
    for (const id of BENCH_STOPS) expect(text).toMatch(new RegExp(`^${id}\\s`, 'm'));
  });
});
