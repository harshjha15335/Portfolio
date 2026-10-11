# CST–Fort Sprint 2.1 — production rendering review

Branch: `feature/cst-fort-rendering-optimization`. Base: `fdae57a`.

The optimization reduces unnecessary submissions while retaining the Sprint 1/2 environment. No district, café asset or exhibition content was added. Representative hardware and realistic NPC acceptance remain blocked. No60FPS or final art/performance acceptance is claimed.

## Cause and measurement categories

Medium renders directly through Three.js: one main-scene color pass. One2048×2048 PCF directional shadow map is refreshed separately. `renderer.info.autoReset=false` deliberately includes both submissions in refresh-frame totals. The historic195draws /456,636triangles are **submitted work across passes**, not unique geometric triangles. Comparing them to cached-shadow static ceilings did not establish a continuous hardware budget.

The original cached-shadow ceilings remain110draws /230,000submitted triangles /32tracked textures /26programs. A separate refresh-frame category records main plus shadow cost; no arbitrary continuous passing threshold is introduced. High additionally includes a normal pass, SSAO and full-screen effects: its non-shadow category is labelled main-and-other, not falsely called one color pass. Low/mobile continue their existing shadow behavior.

Two avoidable costs were found:

1. Static batching used `meshes.some(castShadow)` for the entire instance batch, promoting every member to a caster. Even explicitly noncasting skyline bodies/windows were resubmitted when sharing a batch with a casting object. Small decorative/interior pieces similarly lost their original flags. Dynamic part batches unconditionally cast except contact blobs.
2. Moving part instances, all humanoids and articulated wheel instances disabled frustum culling. Off-camera geometry was submitted even when its conservative bounds could reject it. Skinning and instanced submission counters include those rejected-by-rasterization triangles.

Whole-street static batch bounds still cover broad areas, and the directional map still refreshes static casters together with moving actors. That remaining work is explicitly retained rather than removed with a disruptive renderer redesign.

## Supported pass instrumentation

[`ShadowPassMetrics.ts`](../src/core/ShadowPassMetrics.ts) uses public `Mesh.onBeforeShadow` / `onAfterShadow` hooks to bracket `renderer.info` counter increments for actual shadow draws. Existing callbacks run in order, including count restoration. The implementation does not patch Three internals, replace its shadow renderer or equate triangle submissions with unique geometry.

At an unchanged frozen scene/camera, controlled cached and forced-refresh renders provide a second check: refreshed totals minus cached totals equal the directly observed shadow submissions. The scene is primed before comparison. Normal actor poses are advanced deterministically for eight seconds at60Hz; no simulation step occurs between compared passes. This is a controlled sample of the normal animation state, not a newly static product or replacement screenshot scene.

JS `renderCpuMs` measures the render-call duration; `shadowDrawCpuMs` covers only shadow draw callbacks, excluding full-pass setup. Neither is GPU time. These timings include opt-in diagnostic overhead, consistently enabled for both builds; fewer submitted triangles do not imply a proportional frame-time reduction. GPU timer queries, when supported, classify full-render GPU samples by refresh state with frame indices; they do not claim exact isolated shadow GPU duration. Disjoint samples are discarded. SwiftShader exposes no timer queries here.

## Exact optimization changes

- [`ShadowInstances.ts`](../src/core/ShadowInstances.ts): stable caster-first packing retains every main-pass transform/color and the same geometry/material batch. Public callbacks temporarily submit only the casting instance prefix to the PCF shadow pass, then restore the full count. Noncasting batches stop casting altogether. No extra material, shader, draw batch or shadow-proxy asset is introduced.
- [`MumbaiStreet.ts`](../src/game/World/MumbaiStreet.ts): static/dynamic batches preserve their original per-object caster flags. Dynamic instance bounds are recomputed after pose updates, enabling conservative frustum culling. Contact blobs remain visible and noncasting. No geometry/material is replaced.
- [`NPCFactory.ts`](../src/game/World/npc/NPCFactory.ts): humanoid meshes use a conservative1.35m local bounding sphere centred at y0.92m. A test checks every animated vertex of a representative factory humanoid across walking/idle and both LODs. Navigation, animation clips and appearance are unchanged.
- [`TransitModel.ts`](../src/game/World/TransitModel.ts): articulated wheel bounds are recomputed after matrix updates, allowing frustum culling. Vehicle bodies, drivers, cabin geometry, glass, materials and their shadows remain intact. Vehicle batches are already merged by material; a new finish shader or alternate geometry is unnecessary for this measured change and would pressure the program budget.
- [`HeroStorefront.ts`](../src/game/World/architecture/HeroStorefront.ts): only a diagnostic mesh name was added. Its7,963triangle opaque caster, seating, canopy, tea service and merchandise remain intact; at about4% of baseline pedestrian shadow submissions, its contact cues were worth retaining.
- [`StreetRenderer.ts`](../src/core/StreetRenderer.ts), [`GPUFrameProfiler.ts`](../src/core/GPUFrameProfiler.ts), [`WorldEngine.ts`](../src/core/WorldEngine.ts): opt-in pass/caster counters, matched-frame comparison hooks and cached/refresh timing categories. Normal gameplay does not enable diagnostic mesh observers. The real-hardware runner remains1920×1080, fixed preset/scale, continuous and complete taxi/auto routes without skips.

Shadow map resolution, PCF filtering, bias, light position, orthographic coverage (left/right±24, top/bottom±55, near1/far150) and lighting/exposure are unchanged. Coverage contains important off-camera building shadows; shrinking it without hardware/visual evidence risks clipping. Refresh scheduling remains once per0.2seconds of bounded simulation time. At normal frame rates this is nominally5Hz; software stalls reduce observed wall-time frequency. A second static/dynamic shadow light or composited cache would require new GPU targets/program variants and careful shadow composition, so was not introduced within the already full resource budgets.

## Matched controlled results

All nine camera transforms, illumination and settings match. Desktop/framebuffer1920×1080, DPR1, Medium, adaptive scale pinned1.00. Base art is unchanged `fdae57a` plus diagnostic instrumentation. Cameras use the existing review poses; passenger views board at the same Fort hail point/cabin offsets. Actors are sampled at identical simulated time8s.

| View | Cached before draws / triangles | Cached after | Refresh before | Refresh after | Shadow before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| spawn | 81 / 203,225 | 79 / 200,465 | 153 / 401,364 | 148 / 347,684 | 72 / 198,139 → 69 / 147,219 |
| station | 67 / 193,143 | 54 / 171,199 | 139 / 391,282 | 123 / 318,418 | 72 / 198,139 → 69 / 147,219 |
| junction | 73 / 191,274 | 68 / 179,314 | 145 / 389,413 | 137 / 326,533 | 72 / 198,139 → 69 / 147,219 |
| hero-wide | 51 / 184,071 | 35 / 153,887 | 123 / 382,210 | 104 / 301,106 | 72 / 198,139 → 69 / 147,219 |
| npc | 54 / 163,112 | 38 / 136,536 | 126 / 361,251 | 107 / 283,755 | 72 / 198,139 → 69 / 147,219 |
| fort-room | 45 / 173,260 | 27 / 139,356 | 117 / 371,399 | 96 / 286,575 | 72 / 198,139 → 69 / 147,219 |
| return | 91 / 209,997 | 90 / 209,085 | 163 / 408,136 | 159 / 356,304 | 72 / 198,139 → 69 / 147,219 |
| taxi | 64 / 194,000 | 47 / 161,008 | 147 / 408,927 | 127 / 325,015 | 83 / 214,927 → 80 / 164,007 |
| auto | 64 / 188,024 | 47 / 155,032 | 147 / 396,983 | 127 / 313,071 | 83 / 208,959 → 80 / 158,039 |

Pedestrian shadow submissions fall198,139→147,219, a25.7% reduction (50,920triangles) without changing the main geometry. Matched taxi/auto shadow work drops by the same50,920triangles. Main-scene counts also decline where culling can reject off-camera objects. Broad static batch bounds remain conservative.

The original1440×900 reduced-motion review was repeated separately. Its peak is97draws /208,637submitted triangles /32textures /26programs, versus Sprint 2's102 /226,429 /32 /26. Counts remain under the **unchanged cached-shadow limits**; texture/program budgets still have no spare capacity for a future human. The controlled animated snapshots use27textures /26programs because their visibility/LOD sequence allocates fewer skeleton resources; these are not substituted for the32texture peak.

## CPU observations and hardware limits

Single controlled render-call samples, milliseconds (asynchronous JS submission time):

| View | Cached before → after | Refreshed before → after |
| --- | ---: | ---: |
| spawn | 2.30 → 3.20 | 5.80 → 16.40 |
| station | 2.90 → 2.90 | 5.40 → 4.60 |
| junction | 2.00 → 1.90 | 6.80 → 5.10 |
| hero-wide | 3.30 → 2.80 | 4.40 → 3.50 |
| npc | 2.20 → 2.30 | 4.50 → 3.60 |
| fort-room | 1.90 → 5.90 | 3.30 → 6.10 |
| return | 2.20 → 2.50 | 6.90 → 3.90 |
| taxi | 2.00 → 2.00 | 4.70 → 4.30 |
| auto | 1.40 → 4.00 | 4.00 → 6.50 |

These observations are noisy and sometimes regress. They do not prove GPU/frame-time speedup. Counts prove fewer submissions; real elapsed performance still requires representative hardware. The actual continuous software observation below records refresh frequency and separate timing categories; complete browser-suite outcome is recorded separately. No GPU,60FPS or statistical hardware result is inferred from these samples.


### Actual continuous software observation

A separate `git archive fdae57a` baseline received only the profiler/renderer/engine instrumentation (no caster, geometry, culling or asset changes). Before and after ran sequentially without other browser/capture loads. Settings/camera match:1920×1080, Medium/scale1.00, DPR1, standing at(4.600,11.500), eye1.680m/yaw0.140, continuous crowd/traffic. Warmup10seconds, requested window48seconds. Chromium151/SwiftShader, GPU queries unavailable; no page errors.

| Observation | Before | After |
| --- | ---: | ---: |
| Samples | 8 | 8 |
| Refresh frames | 2 | 2 |
| Actual refreshes / wall second | 0.0399 | 0.0403 |
| Cached peak draws | 80 | 78 |
| Cached peak submitted triangles | 203009 | 200249 |
| Refresh peak draws | 147 | 142 |
| Refresh peak submitted triangles | 397320 | 343640 |
| RAF p50 / p95 / p99 ms | 6249.7 / 6399.7 / 6399.7 | 6199.7 / 6299.7 / 6299.7 |
| Cached render-call CPU p50 / p95 ms | 3.30 / 4.50 | 3.20 / 6.40 |
| Refresh render-call CPU p50 / p95 ms | 4.30 / 5.80 | 3.40 / 5.60 |

Only eight frames and two refreshes were observed per build. Those computed percentiles are not representative tails. CPU observations are mixed; no reliable elapsed-time speedup is established. The refresh submission peak fell397,320→343,640 in this scenario. Actual frequency is about0.04Hz here because the existing80ms visual/simulation cap advances only a little simulated time during multi-second software frames; it must not be reported as5real-time Hz. Full-render GPU times remain null. Raw per-frame data and shadow-category counts are retained. This standing scenario is not the complete-route hardware benchmark.

## Visual evidence and unresolved limits

[Evidence index](screenshots/rendering-sprint-2-1/README.md) links native cached and refreshed images for all nine poses. Before/after side-by-side refresh comparisons were manually inspected, including the café, station, junction, NPC, room and both passenger cabins. The canopy/table/cup shadows, station massing, pedestrian silhouettes, vehicle/wheel/driver cues and room content remain. No major missing foreground shadow, texture defect or visible culled person was found in these frames. Minor shadows from originally noncasting decorative/distant surfaces are intentionally no longer generated by batching promotion.

The current matched checks are controlled animation samples. A second matched normal-animation sample at8.4seconds covers spawn, café and both passenger views. Native8.0/8.4 comparisons were manually inspected: updated actor/traffic poses retain their contact cues; no introduced culling hole or major shadow pop was observed in these sampled moments. This is two controlled animation moments, not a high-frame-rate hardware motion certification. All nine primed cached/forced image pairs are pixel-identical within each build, corroborating stable shadow reuse and count restoration; before/after shadow differences remain separately visible and manually reviewed. Boundary views and the original reduced-motion review were recaptured, and the full functional suite passed. Fixed shadow refresh scheduling can retain its pre-existing temporal stepping on moving actors; it was not concealed by darkness, bloom or motion blur. Actual laptop/mobile GPU and touch-device review remain separate. Current humanoids are still the same procedural placeholders: no imported realistic NPC is claimed.

## Functional verification

- All75 original unit cases plus3 new rendering invariants:78passed.
- Offline asset admission:4passed. The first new bounding test timed out while asserting each vertex individually during capture load; it was corrected to compute the maximum distance over the same vertices/poses and assert the same containment invariant once. The final complete78-test run passes; no assertion coverage or existing test was removed.
- TypeScript and production build pass, dependencies and lockfile unchanged. Existing large-chunk/BVH warnings remain.
- Complete browser suite: **37/37 passed in one dedicated15.8minute run**, one worker, no retries. Original accessibility, Quick View/deep links, navigation, rides/meters, mobile/reduced motion, renderer presets and Fort doorway checks retained. The original12-second movement polling assertion remains; the cloud run used a180-second per-test allowance for software shader startup without changing expectation deadlines or repository Edge configuration. Full logs and generated browser screenshots are retained in this sprint folder; earlier screenshot artifacts were restored unchanged.

## Hardware acceptance recommendation

Do not choose a continuous triangle threshold from SwiftShader or force refresh frames below cached ceilings. On representative laptop GPUs, run the unchanged three-preset protocol with fixed scale, repeated warm measurements, complete routes, driver/power/refresh context and raw cached/refresh categories. Compare p95/p99 CPU/RAF and actual full-render GPU query times for each category. Choose the interactive frame-time target with the product owner, reserve time for simulation/input/compositing and derive any continuous submission allowance from worst-case refresh latency on those devices. Until then, the continuous budget remains unapproved. A realistic NPC also requires explicit texture/program budgeting and rendered asset review.

## Three remaining acceptance limits

1. Representative laptop GPU timing and high-rate temporal review are unavailable; the continuous budget is unapproved.
2. The realistic rigged NPC remains uninstalled. Procedural people/drivers and their original visual limitations remain; future import needs resource and rendered quality approval.
3. Whole-street batch bounds and combined static/dynamic shadow refreshes still submit avoidable broad-area work. Separate caches/spatial partitioning may help later, but must justify new resources/draws against measured hardware and visual evidence.
