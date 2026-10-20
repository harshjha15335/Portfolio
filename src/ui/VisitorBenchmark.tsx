import { useEffect, useRef, useState } from 'react';
import type { WorldEngine } from '../core/WorldEngine';
import { BENCH_SAMPLE_S, BENCH_STOPS, BENCH_WARMUP_S, districtResult, formatReport, frameStats, loadCost, type BenchFrame, type BenchReport, type DistrictResult } from '../core/visitorBenchmark';
import { streetStops } from '../game/World/streetLayout';
import { districts } from '../data/city';

declare const __COMMIT__: string;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const title = (id: string) => districts.find(d => d.id === id)?.title ?? id;

/**
 * `/?bench` panel: explains the run, tours the nine districts while panning the camera through a full
 * turn at each, then shows a copyable table. Adaptive quality stays on (what a visitor gets) unless
 * `&fixed` pins it; `&preset=high|medium|low` picks the starting preset.
 */
export function VisitorBenchmark({ engine, ready, preset, adaptive, worldReadyMs, sampleS = BENCH_SAMPLE_S }: { engine: WorldEngine | null; ready: boolean; preset: string; adaptive: boolean; worldReadyMs: number; sampleS?: number }) {
  const warmupS = Math.min(BENCH_WARMUP_S, sampleS);
  const [phase, setPhase] = useState<'intro' | 'running' | 'done'>('intro');
  const [step, setStep] = useState({ index: 0, label: 'Settling' });
  const [report, setReport] = useState<BenchReport | null>(null);
  const [copied, setCopied] = useState(false);
  const stopped = useRef({ stop: false, hidden: false });

  useEffect(() => {
    if (phase !== 'running' || !engine) return;
    // One token per run: StrictMode re-runs effects, and a cleaned-up run must not report.
    const run = { stop: false, hidden: false, disposed: false }; stopped.current = run;
    const hide = () => { if (document.hidden) { run.hidden = true; run.stop = true; } };
    document.addEventListener('visibilitychange', hide);
    engine.setReducedMotion(false); engine.pinQuality(!adaptive);
    const results: DistrictResult[] = [], all: number[] = [];
    (async () => {
      setStep({ index: 0, label: 'Settling' }); await wait(3000);
      for (const [index, id] of BENCH_STOPS.entries()) {
        if (run.stop) break;
        let frames: BenchFrame[] = [];
        engine.setFrameObserver(frame => frames.push(frame));
        setStep({ index, label: `Arriving at ${title(id)}` });
        const start = performance.now(); engine.travelTo(id); const buildMs = performance.now() - start;
        await wait(warmupS * 1000);
        const warmup = frames; frames = [];
        setStep({ index, label: `Measuring ${title(id)}` });
        const yaw = streetStops[id].yaw, begin = performance.now();
        for (let t = 0; t < sampleS && !run.stop; t = (performance.now() - begin) / 1000) { engine.setView(yaw + Math.PI * 2 * t / sampleS, -.02); await nextFrame(); }
        const result = districtResult(id, buildMs, warmup, frames, engine.viewResources());
        results.push(result); all.push(...frames.map(f => f.frameMs));
      }
      engine.setFrameObserver(null); engine.pinQuality(false); engine.travelTo('cst');
      const gl = engine.gpu, nav = navigator as Navigator & { deviceMemory?: number };
      const finished: BenchReport = {
        version: 1, url: location.origin + location.pathname + location.search, commit: typeof __COMMIT__ === 'string' ? __COMMIT__ : 'unknown', when: new Date().toISOString(),
        device: { gpu: gl.gpu, vendor: gl.vendor, userAgent: navigator.userAgent, platform: navigator.platform, cores: navigator.hardwareConcurrency || null, memoryGb: nav.deviceMemory ?? null, screen: `${screen.width}×${screen.height}`, dpr: devicePixelRatio, viewport: `${innerWidth}×${innerHeight}` },
        settings: { preset, adaptive, warmupS, sampleS },
        load: { worldReadyMs, ...loadCost(performance.getEntriesByType('resource') as PerformanceResourceTiming[]) },
        districts: results, overall: frameStats(all), hidden: run.hidden, interrupted: results.length < BENCH_STOPS.length,
      };
      if (!run.disposed) { setReport(finished); setPhase('done'); }
    })();
    return () => { run.stop = true; run.disposed = true; document.removeEventListener('visibilitychange', hide); engine.setFrameObserver(null); engine.pinQuality(false); };
  }, [phase, engine, adaptive, preset, worldReadyMs, sampleS, warmupS]);

  const text = report ? `${formatReport(report)}\n\n${JSON.stringify(report)}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `mumbai-benchmark-${Date.now()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const minutes = Math.ceil((3 + BENCH_STOPS.length * (warmupS + sampleS)) / 60);

  return <section className={`bench-panel bench-${phase}`} aria-label="Performance benchmark" aria-live="polite">
    <span className="eyebrow">PERFORMANCE BENCHMARK</span>
    {phase === 'intro' && <>
      <h2>Measure this device</h2>
      <p>The camera visits all nine districts and turns a full circle in each, about {minutes} minute{minutes === 1 ? '' : 's'} in total. Keep this tab in front, plug a laptop in, and don't touch the controls. You'll get a table to copy and send back.</p>
      <p className="bench-meta">Preset {preset} · adaptive quality {adaptive ? 'on' : 'pinned'}</p>
      <button className="primary-button" disabled={!ready || !engine} onClick={() => setPhase('running')}>{ready ? 'START BENCHMARK →' : 'LOADING THE CITY…'}</button>
    </>}
    {phase === 'running' && <>
      <h2>{step.label}</h2>
      <p>Stop {step.index + 1} of {BENCH_STOPS.length}. Keep this tab visible.</p>
      <progress max={BENCH_STOPS.length} value={step.index} aria-label="Benchmark progress" />
      <button onClick={() => { stopped.current.stop = true; }}>STOP</button>
    </>}
    {phase === 'done' && report && <>
      <h2>{report.interrupted || report.hidden ? `Partial results${report.hidden ? ' · the tab was hidden, so rerun it' : ''}` : `Done · ${report.overall.p50} ms median, ${report.overall.p99} ms p99`}</h2>
      <div className="bench-actions">
        <button className="primary-button" onClick={copy}>{copied ? 'COPIED ✓' : 'COPY RESULTS'}</button>
        <button onClick={download}>DOWNLOAD JSON</button>
        <button onClick={() => { setReport(null); setCopied(false); setPhase('running'); }}>RUN AGAIN</button>
      </div>
      <pre aria-label="Benchmark results" className="bench-table" tabIndex={0}>{formatReport(report)}</pre>
    </>}
  </section>;
}
