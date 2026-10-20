# GPU benchmark

## Visitor benchmark (`/?bench`): use this on real devices

Open <https://portfolio-beta-murex-52.vercel.app/?bench> on the device, press **Start benchmark** and leave the tab in front. The camera visits all nine districts (CST, Fort, BKC, Andheri, Powai, Dadar, Worli, Juhu, Film City). At each stop it waits 4 s (the worst frame in that window is reported as the arrival hitch: shader compiles and texture uploads), then turns a full circle over 12 s while recording every frame interval. A run takes about 3 minutes.

The results table shows, per district: p50, p95, p99 and max frame time (ms), mean fps, frames over 33 ms, the arrival hitch, the district build time, peak draws, triangles, textures and shader programs, and the render scale at the end (`L` = adaptive quality dropped to the low tier). The header records the GPU name (where the browser exposes it), browser, screen, DPR, cores, memory, deployed commit, time to world ready and the JS / WASM / model bytes fetched. **Copy results** puts the table plus the full JSON on the clipboard; **Download JSON** saves it.

Options:

| Query | Effect |
| --- | --- |
| `?bench` | Default: Medium on desktop, Low tier on phones, adaptive quality on (what a visitor gets) |
| `&preset=high` / `medium` / `low` | Start on that preset |
| `&fixed` | Pin render scale and tier, so a slow device keeps measuring the chosen preset instead of falling back |
| `&seconds=N` | Shorter or longer pan per stop (tests use 1) |

Protocol for acceptance numbers: laptop plugged in, browser updated, nothing else heavy running, one run with the default and one with `&fixed`. Phone: after a few minutes of use (warm), default settings. Hidden tabs are throttled, so a run where the tab was hidden is marked as partial.

Proposed targets from the 20 October audit (not yet measured): desktop p95 ≤ 16.7 ms (60 fps) on a representative laptop; phone p95 ≤ 33 ms (30 fps) after warm-up. Budgets are not raised without these numbers.

## Scripted lab benchmark (developer machine)


Sprint 2 prepares the runner and opt-in instrumentation; **no representative laptop GPU is available in the cloud**. SwiftShader results, if retained, are software smoke evidence only. GPU time is null when timer queries are unavailable; RAF intervals and JS render-call timings are not substituted for it.

### Real hardware procedure

Use the same browser, device, build, power setting, preset and thermal conditions before/after. Close other graphics workloads. Record OS, CPU, GPU model/driver, laptop power mode, display refresh and browser version with the output. Use a plugged-in laptop with a stable GPU selection; report that context rather than assuming it from a renderer name.

For a production build, run `npm run build`, then `npm run preview -- --port 5173 --strictPort`. Alternatively use the existing dev server and label that mode. Debug teleport hooks are not required: the runner uses the actual directory, walking and transit controls.

```sh
BENCHMARK_DEVICE_LABEL='Actual laptop / OS / GPU driver / power mode / refresh' \
BENCHMARK_COMMIT="$(git rev-parse HEAD)" \
BENCHMARK_PRESET=medium \
STREET_BENCHMARK_DIR=benchmark-results/medium \
node scripts/benchmark-gpu.mjs
```

Use `STREET_BENCHMARK_URL` for another local preview port and `CHROMIUM_PATH` for the actual installed browser. The default is headed Chromium, with no SwiftShader enabling argument. The runner refuses an identified software renderer or a generic unidentified renderer when hardware evidence is requested. A hardware renderer name alone does not certify that the machine is a laptop; the recorded device label supplies that context.

The runner sets a1920×1080 browser viewport, DPR1 and a1920×1080 world framebuffer. It enables **continuous animation**, verifies the framebuffer and selects High/Medium/Low through the real menu. `?benchmark=1&fixedQuality=1` pins adaptive scale for comparability; this explicit benchmark mode does not change normal adaptive rendering. Run each preset separately; never relabel Low as Medium.

Default warm-up is15seconds. Walking/NPC/Fort sampling is20seconds (Fort also includes entry and yaw movement). Taxi and auto sample their **full actual routed rides**, so their durations need not match20seconds. No skip-to-arrival is used. Repeat each preset at least three times after warm-up and retain raw per-frame JSON, including outliers. Summarize each run separately before comparing.

### What is recorded

`summary.json` and one file for walking, NPC movement, taxi ride, auto ride and Fort exploration contain browser version/UA, platform, reported GPU/vendor, software detection, viewport/framebuffer, DPR, selected presets/scales, ride phases, draws, submitted triangles, textures/geometries/programs and program-cache diagnostics. Per-frame RAF intervals, JS render-call duration, visitor coordinates and bounded walking simulation time are retained. Nearest-rank p50/p95/p99, minimum/maximum and mean derive from raw samples.

When `EXT_disjoint_timer_query_webgl2` is exposed, a bounded asynchronous query queue measures GPU rendering time. Disjoint queries are discarded and reported. Unavailable results are null, unresolved queries are counted and discarded at the end; no GPU percentile is inferred from CPU/RAF data. Hardware timer behavior still needs an actual supported GPU validation.

Draw/triangle figures in animated shadow-refresh frames can exceed cached-shadow static screenshots. Report those peaks distinctly; do not redefine the existing Medium static ceilings of110 draws,230,000 triangles,32 textures and26 programs. Check Low/High separately and preserve reduced-motion support outside this continuous benchmark.

### Explicit cloud smoke mode

```sh
BENCHMARK_SOFTWARE=1 BENCHMARK_SHORT_RIDES=1 BENCHMARK_HEADLESS=1 \
BENCHMARK_SECONDS=2 BENCHMARK_WARMUP=2 \
STREET_BENCHMARK_DIR=benchmark-results/software-smoke \
node scripts/benchmark-gpu.mjs
```

This shorter run exercises the harness; it is **not** laptop performance evidence. Do not use its frame-time percentiles to accept the art or infer GPU performance. Leave longer-run and representative device gates unresolved until hardware is available.

`BENCHMARK_SHORT_RIDES=1` is rejected for hardware runs. It records short moving passenger samples and exits before arrival solely for software smoke checks. Such files use `-smoke` names and `completeRideRoutes:false`; they do not validate whole-route timing. At approximately6seconds per software frame, full route smoke tests are impractical. Tiny smoke sample counts cannot establish representative percentiles. The normal hardware protocol continues complete routes.

### Sprint 2.1 pass categories

Schema2 samples retain exact shadow draw/triangle counts from public mesh callbacks, main-and-other totals, refresh classification and shadow-draw CPU callback time. Reports separate cached and refreshed draw/triangle/CPU distributions and actual wall-time refresh frequency. GPU query samples, when supported, retain frame indices and refresh category; full-render GPU times are not isolated shadow-pass GPU estimates. High non-shadow counts include its normal and effect passes. Cached limits remain unchanged; a continuous refresh-frame budget requires hardware review. The1920×1080 real-hardware complete-route procedure above is unchanged. See [Sprint 2.1 review](ART_PRODUCTION_PERFORMANCE_REVIEW.md).
