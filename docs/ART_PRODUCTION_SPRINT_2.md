# CST–Fort Art Production Sprint 2 — review checkpoint

Branch: `feature/cst-fort-art-production-sprint-2`.
Base: `feature/cst-fort-art-production`, `ab0b0c6`.

The main delivered changes are an authored Irani café frontage, an inspectable Fort teaching exhibition and a repeatable profiling/local-character workflow. Sprint 1's station, sightlines and original walking/transit layout remain. No other physical district is expanded. **Full art acceptance is not claimed:** no new humanoid is installed and no representative laptop GPU is available.

## Priority status

| Priority | Delivered / blocked |
| --- | --- |
| Real NPC | **Blocked visually.** User has no licensed local GLB and asked to keep placeholders. No blocked binary retry and no primitive replacement. Verified local admission, candidate-only Idle/Walk preview and reviewed approval path are ready; no populated asset manifest. |
| Hero storefront | Original Irani Chai frontage replaces uniform shutter/shelf treatment with customer seating, a preparation portal, a pastry display, shaped tea service, visible biscuits, layered framed signs, uneven canopy and material wear/finish variation. Authored mesh geometry, not a screenshot. Native matched close/wide captures show substantially richer depth and merchandise; remaining simplifications are recorded below. |
| Surface realism | Original CC0 asphalt/plaster color/roughness/normal studies are bundled and verified byte-for-byte at runtime.256px maps with correct color spaces. **External scanned maps blocked** by source proxy denials. Stone, shutters, fabrics and wider glass/weathering still need a fuller material pass. |
| Fort research | Physical three-part source/convention/validation gallery and original field-direction table. An HTML/SVG exhibit supports order toggles, coordinates, point inspection, explanations and pinned source/PR evidence, including mobile/WebGL fallback. No invented molecular results or new speedup/accuracy claims. |
| Hardware profiling |1920×1080 continuous runner and raw per-frame device/count/timing report are prepared. **Laptop measurement blocked**; software results are explicitly separate smoke evidence. |

The character requirement is deliberately not converted into a code-only “complete” checkbox. The scene still contains the existing procedural people and drivers.

## Exact implementation

### Authored Irani Chai frontage

`HeroStorefront.ts` assembles the near-arrival left shop in metres, behind its original collision envelope. It gives the customer bay a mismatched table/stools and wall menu, separates the preparation area from the pastry case, and arranges service objects individually. The kettle has a lathed body, lid, spout and bent handle; cups have open profiles/handles and tea surfaces; buns vary in scale, orientation and spacing; transparent jars expose biscuits. These replace repeated generic shelf stock for this one frontage.

A sagging span canopy, threshold drain, switch/conduit, exposed paint patch, framed/tilted signage, timber bands and shaded rear portal give the shop functional detail. Original384×256 region-specific wear artwork is small and locally generated; it is not a photograph. Opaque meshes are transform-baked into one vertex-colored batch with per-vertex roughness/metalness; glass is separately transparent. Source geometry is disposed after baking.

The original shop safety proxy remains: the richer interior is a view into the frontage, **not a newly traversable café**. Signs still use the existing atlas. Small props and several corners remain simplified; this is a substantial benchmark improvement, not a photographic café scan.

### Surface studies and resource budget

Six original maps in `public/surfaces/` total469,083 PNG bytes. Both surfaces use256×256 color, linear roughness and OpenGL tangent-space normal maps. Runtime admission checks recorded size/SHA-256, then decoded dimensions before reusing texture objects across material clones. Color is sRGB; roughness/normal are `NoColorSpace`. Weak normal scales keep microscopic relief restrained. Original material handling remains available when loading fails; shutdown aborts pending fetches and closes owned bitmaps.

These files and generator are dedicated under CC0-1.0, with actual hashes/dimensions/roles in `provenance.json` and a licence file. They are original mathematical micro-surface studies, **not acquired or scanned PBR packs**. Source API requests for AmbientCG/Poly Haven returned proxy403. No external texture download is invented.

The old wood color/bump map is no longer bound to all street wood materials, avoiding another allocated texture; the hero's own atlas provides localized wood/fabric/metal/plaster wear. Other distant shop wood stays a rough colored material. This tradeoff is explicit, and the stone/fabric/shutter material pass is still partial.

### Meaningful Fort exhibition

The physical room keeps its open entrance, full-height collision route, bench, guide and FFprime interaction coordinates. Original repeating ring cylinders and generic decorative notes are replaced by a three-part framed gallery: Cartesian moments/potential, representation conventions and derivative validation. A tabletop shows normalized **directions**, not measured field magnitudes, from the same original arbitrary-moment teaching model used in the HTML exhibit. Header proportions are reduced to avoid overlapping exhibition panels.

`ResearchExhibition.tsx` is available in the FFprime case study and Fort guide. It works without WebGL and adds no library/context. Its charge/dipole/quadrupole toggles, clicked/keyboard-controlled coordinates and numeric readout explain directional information, Stone's convention and the factor-of-two derivative correction. The origin is excluded at r<0.3 rather than silently softened. Teaching inputs are q=1, p=(0.7,0,0), Q=diag(−0.4,0.8,−0.4), in arbitrary units. These are not molecular results.

The implemented convention is V=q/r+(p·r)/r³+(rᵀQr)/r⁵, with E=−∇V and EQ=5(rᵀQr)r/r⁷−2Qr/r⁵. New finite-difference tests validate this **portfolio visualization**, not an upstream research reproduction.

GitHub API checks confirm Harsh authored all five merged PRs #13/#14/#15/#18/#19. PR19 merged24August2026; the final report's “under review” status is stale. Titles, merge dates/commits and actual source-response hashes are retained in `src/research/evidence.json`. The formula link pins the actual `cartesian.py` at `02ac79dcaa38b64b130999d42ea8de0033834167`. Existing résumé-reported metrics remain explicitly attributed; this sprint does not generate new runtime/RMSE claims or run the upstream molecular notebooks.

### Character admission and candidate research

See [local admission](LOCAL_CHARACTER_IMPORT.md) and [candidate review](NPC_ASSET_CANDIDATES.md). The offline command requires reviewed licence/redistribution metadata and a matching source GLB hash before copying. It inspects embedded geometry/accessors,15–80 joint skins, rig-bound named Idle/Walk clips and embedded texture headers; limits are12k triangles, four primitives/materials,8MiB and1–4 images≤1024px. It creates a candidate, not an automatic visual approval.

Development-only previews exercise actual loaded Idle/Walk clips at the existing host location. Normal runtime admission requires an approved descriptor with a real visual review. The default manifest is null. Future asset load failures retain the original host. None of the future human-scale/clothing/facing/animation review steps has been performed with a real model in this sprint.

Quaternius's official CC0 declaration is verified but its catalogue style is unsuitable for this target. Official MakeHuman licence documents verify bundled graphical assets/output as CC0; that is a future authoring path, not an individually approved finished GLB or permission for every optional community asset. Mixamo/Sketchfab requests were denied; model-specific licences remain unverified. No publisher scripts/packages or model binaries were installed.

### Walking timing and profiling

Sprint 1's Fort12-second poll exceeded its deadline because walking reused an80ms **visual** delta cap. At about2fps, only160ms of physics advanced per wall second. Sprint 2 separately queues up to250ms of walking physics per frame in60Hz Cannon steps; it never makes one large collision step. Multi-second stalls remain capped; pause/input/visibility resets remain. New tests verify the bounded timing and existing full-height doorway physics tests remain unchanged.

The profiler's explicit `benchmark=1&fixedQuality=1` mode retains continuous animation and stable adaptive scale for comparisons. [Protocol/commands](GPU_BENCHMARK.md) cover walking, moving crowds, taxi, auto and Fort. Hardware runs require complete ride routes. The explicit software-only short-ride mode samples moving passenger views before exiting and marks `completeRideRoutes:false`; it is not whole-route verification. It records raw RAF intervals, JS render-call time, actual GPU-query time when exposed, GPU/browser/preset/framebuffer/count metadata and nearest-rank p50/p95/p99. Missing/disjoint GPU data is never inferred from CPU/RAF samples. Normal adaptive High/Medium/Low and reduced motion remain supported.

A public Three compile warm-up uses only visible shallow mesh descriptors with the original target scene/light state. It avoids duplicate zero-light shadow-depth variants and does not compile invisible contact proxies. No renderer-private shader cache entry is deleted.

## Matched evidence and manual review

Baseline captures were generated from a clean `git archive` snapshot at `ab0b0c6`, served on5175. Only development diagnostic poses were added there; baseline art, materials and simulation were unchanged. Final captures were generated from the working branch on5173. Final verification date:11October2026 UTC. Source/licence checks recorded10October2026 UTC remain dated as collected. Native desktop views are1440×900, FOV68, eye1.68m, fixed17:40 illumination/exposure1.12, reduced motion and full review scale1.00. Mobile/fallback views are390×844.

Thirteen measured pedestrian/room/boundary poses match exactly in X/Z, eye height, yaw, scale and selected Medium renderer preset; see `pose-comparison.json`. A separate `quality: high` diagnostic indicates adaptive detail has not fallen to Low, not the selected render preset. Taxi/auto use the same Fort hailing procedure and unchanged cabin offsets. Research captures use the same viewport, WebGL-off route and exact modal scroll positions620/1000px. Native screenshots are not composited into the product; temporary contact sheets are analytical comparisons only.

Twenty native before/after pairs were manually compared; shop, shop-wide, Fort room and research panels were also inspected at native resolution. Final native close/wide shop captures and the Fort room were re-inspected after correcting an occluded shop header, wear-atlas vertical coordinates and prop tessellation. The identity is readable again, furniture is smoother, and the display remains simplified.

| View | Visible difference / retained limitation |
| --- | --- |
| Hero close-up | The former shutter plane is replaced by a seating/preparation view with a shaped kettle/cups, framed menu, wear and glass jars. Close stool edges remain simplified. |
| Hero wide | The uniform shelves/shutter become distinct seating/service/display zones with actual depth and canopy. Main shop identity, worn timber and merchandise must stay readable from the route. The original non-traversable collision remains a limitation. |
| Fort room | Generic signage and ring schematic become framed research chapters and a direction-field table; existing working terminals remain. Some physical exhibit text still needs closer inspection/HTML reading. |
| Fort entrance | The same doorway and guide frame a much clearer gallery. No inaccessible/solid replacement doorway is introduced. |
| Research desktop | The former narrative-first area now shows a controllable potential map, numeric inspector, mathematical explanation and pinned implementation link. It is an explanatory model, not an accuracy/benchmark result. |
| Research sources | Five actual merged contribution links/dates appear with a stale-report-status explanation. Existing résumé metrics are preserved with their labels. |
| Research mobile | Stacked chapters, plotted teaching model and controls fit the phone layout; no extra WebGL dependency. Content is long and requires scrolling. |
| NPC | Same procedural host, proportions/clothes/face. **No visual improvement; blocked acceptance requirement.** |
| CST/station, spawn/return | Sprint 1 silhouette and city context preserved; near café opens visually and surface finish changes subtly. No new station/district expansion. |
| Junction/general shops | Selected asphalt/plaster finish changes are subtle; other repeating shops and people are intentionally not claimed as re-authored. |
| Taxi/auto | Original cabins, drivers, meter and passenger viewpoints retained. Distant scenery receives subtle surface changes. No new vehicle/interior art is claimed. |
| North/south/gap | Sprint 1 sightline/boundary context preserved; remaining distant planar façades are visible. |
| Mobile street/theatre | Touch/world framing and HTML theatre remain; actual mobile GPU/touch-device acceptance is still separate. |

## Verification and counts

- 75 unit tests pass, retaining all68 existing cases; seven new teaching-gradient/timing/percentile cases. Existing street test canvas mock gained the drawing methods required by authored art; no collision assertion was removed.
- Four offline character-admission fixture tests pass. Fixtures are original test data, not acquired/installed NPCs or visual acceptance evidence.
- TypeScript and production build pass; no dependency/lockfile change. Advisory audit: zero known vulnerabilities, not comprehensive certification.
- Initial full browser run: **36 passed / 1 failed** across all35 original scenarios plus two new teaching checks. The sole failure was initial canvas readiness while the software renderer warmed; its trace is retained. Final serial focused run: **6 passed in5.2minutes**, covering unchanged walking/pause/reset, taxi, auto, physical Fort doorway/terminal and both teaching UI cases. The Fort case finished in44.4seconds overall, retaining its original12-second movement polling assertion. All37 scenarios passed across these runs; a clean37-pass single run is not claimed.

Final cached-shadow static measurements: Medium peak102 draws /226,429 triangles /32 textures /26 programs. Ceilings remain110 /230,000 /32 /26. Triangle headroom3,571; texture/program headroom zero. Passenger views measure60 draws, taxi215,992 /auto210,016 triangles and32 /26 resources; mobile review63 draws /176,366 triangles /19 textures /21 programs at scale0.85. These cached-shadow still counts are not continuous animated-shadow peaks or frame-time guarantees. The production software walking smoke already recorded an animated-shadow frame at146 draws /396,360 submitted triangles, above the110 /230,000 provisional ceilings. This is an unresolved continuous-rendering budget defect; it is not normalized away or treated as a raised budget. Hardware performance acceptance remains blocked. The initial whole-route software attempt was interrupted because of this frame rate; a short-ride attempt then exposed a harness selector defect. Both attempts and their partial evidence are retained, and the selector was corrected.

Final production output:177 modules, WorldEngine353.91KB raw/107.04KB gzip; application301.56/95.27; Three583.87/148.84; CSS60.64/13.36; GLB library5.71/2.46; controller1.44/.75; GLTFLoader43.93/12.95; unchanged WASM726.36/217.70. Known large-chunk and upstream CSG maxLeafSize warnings remain.

Environment: Node24.19.0, Debian13 Chromium151.0.7922.173, Playwright1.63.0, Vite7.3.6 and Three0.180.0. Renderer reports ANGLE/SwiftShader Device (Subzero); no laptop/hardware frame-time percentile is claimed. GPU timer-query extension is unavailable in this software context.


### Production software profiling smoke

The corrected runner completed all five scenarios without page errors at1920×1080, DPR1, Medium, scale1.00 and continuous animation. Chromium151.0.7922.173 reports ANGLE/SwiftShader; GPU timer queries are unavailable. Two-second requested windows and software scheduling produced only1–6 frames per scenario. These are harness checks, not representative timing percentiles or laptop GPU evidence. Both rides are short moving samples, with `completeRideRoutes:false`; whole-route profiling remains unverified.

| Scenario | Frames | Peak draws | Peak submitted triangles |
| --- | ---: | ---: | ---: |
| walking | 5 | 146 | 396,360 |
| npc-movement | 1 | 80 | 203,009 |
| taxi-ride-smoke | 1 | 92 | 229,161 |
| auto-ride-smoke | 1 | 195 | 456,636 |
| fort-exploration | 6 | 127 | 398,439 |

Peak resources were32 textures and26 programs. The maximum195draws /456,636triangles exceeds the unchanged110 /230,000 ceilings: **continuous rendering performance acceptance fails this count check**. Raw samples, computed RAF/CPU distributions and null GPU results are in [software evidence](screenshots/art-production-sprint-2/software-smoke/summary.json). No representative hardware result is claimed.

## Remaining acceptance defects

1. **People and drivers are still the same procedural placeholders.** No licensed realistic model is visually installed/accepted. This is the largest unresolved realism gap.
2. **Surfaces and props are not a finished semi-realistic asset set.** Original micro-surface maps are useful but not scanned PBR. Several shapes/signs/shop rhythms and distant planar façades remain simplified; the hero café cannot be entered.
3. **Continuous rendering has a budget defect and hardware evidence is unavailable.** Animated-shadow smoke frames exceed the provisional draw/triangle ceilings; static captures alone cannot establish preserved performance. Prepared profiling and software smoke results cannot establish laptop frame-time stability, supported timer-query behavior or final GPU acceptance.

The storefront and research experience are materially richer. **Sprint 2 art acceptance remains incomplete** because those blocked requirements are explicit. No merge or deployment is performed.
