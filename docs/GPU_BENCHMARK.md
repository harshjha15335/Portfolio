# CST–Fort repeatable GPU benchmark

Sprint 2 prepares the runner and opt-in instrumentation; **no representative laptop GPU is available in the cloud**. SwiftShader results, if retained, are software smoke evidence only. GPU time is null when timer queries are unavailable; RAF intervals and JS render-call timings are not substituted for it.

## Real hardware procedure

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

## What is recorded

`summary.json` and one file for walking, NPC movement, taxi ride, auto ride and Fort exploration contain browser version/UA, platform, reported GPU/vendor, software detection, viewport/framebuffer, DPR, selected presets/scales, ride phases, draws, submitted triangles, textures/geometries/programs and program-cache diagnostics. Per-frame RAF intervals, JS render-call duration, visitor coordinates and bounded walking simulation time are retained. Nearest-rank p50/p95/p99, minimum/maximum and mean derive from raw samples.

When `EXT_disjoint_timer_query_webgl2` is exposed, a bounded asynchronous query queue measures GPU rendering time. Disjoint queries are discarded and reported. Unavailable results are null, unresolved queries are counted and discarded at the end; no GPU percentile is inferred from CPU/RAF data. Hardware timer behavior still needs an actual supported GPU validation.

Draw/triangle figures in animated shadow-refresh frames can exceed cached-shadow static screenshots. Report those peaks distinctly; do not redefine the existing Medium static ceilings of110 draws,230,000 triangles,32 textures and26 programs. Check Low/High separately and preserve reduced-motion support outside this continuous benchmark.

## Explicit cloud smoke mode

```sh
BENCHMARK_SOFTWARE=1 BENCHMARK_SHORT_RIDES=1 BENCHMARK_HEADLESS=1 \
BENCHMARK_SECONDS=2 BENCHMARK_WARMUP=2 \
STREET_BENCHMARK_DIR=benchmark-results/software-smoke \
node scripts/benchmark-gpu.mjs
```

This shorter run exercises the harness; it is **not** laptop performance evidence. Do not use its frame-time percentiles to accept the art or infer GPU performance. Leave longer-run and representative device gates unresolved until hardware is available.

`BENCHMARK_SHORT_RIDES=1` is rejected for hardware runs. It records short moving passenger samples and exits before arrival solely for software smoke checks. Such files use `-smoke` names and `completeRideRoutes:false`; they do not validate whole-route timing. At approximately6seconds per software frame, full route smoke tests are impractical. Tiny smoke sample counts cannot establish representative percentiles. The normal hardware protocol continues complete routes.
