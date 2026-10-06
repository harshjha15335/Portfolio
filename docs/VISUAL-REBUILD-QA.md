# Mumbai visual rebuild — CST/Fort gate

This is a revision of the authored street, not completion of a nine-district open world. The checkpoint is `checkpoint/first-person-20261006` at `465de293af6a0688e4997a1eb135f0239b5e7d30`. Work is isolated on `feat/mumbai-visual-rebuild`.

## Implemented

- Deterministic `HARSH_MUMBAI_2026` seed and parameter-based heritage, chawl, Art Deco and commercial façade grammars. Fourteen façades, floor/height/color/setback variations, real visual recesses, inset layered windows, shutters, rails, continuous corridors, cornices, parapets, water tanks, dishes and drainpipes. Collision uses coarse rear masses; Fort's existing open doorway is preserved.
- Six small original procedural surface maps: plaster, stone, asphalt, paving, wood and fabric. Standard materials distinguish rough plaster, painted metal, tinted glass and fabric. Original sign atlas remains attached to storefronts and physical boards. Road repairs/cracks, paving joints, drain grates, existing zebra crossing and curb detail remain at eye level.
- Original branched gulmohar-inspired trees with instanced leaf clusters and sparse warm flowers, plus planters. These are stylized procedural vegetation, not botanical reconstructions.
- Tapered, articulated human figures with shoulder/elbow/hip/knee hierarchy, varied proportions, skin/clothes palettes, continuous pavement paths, idle gestures, a seated visitor and retained guide interactions. No external human model or skeletal animation asset. Detailed facial animation remains outside this slice.
- Original lofted kaali-peeli taxi and auto bodywork, slanted glass, mirrors, lamps, bumpers, shaped canopies, benches, dashboards and driver silhouettes. Wheel geometry is instanced per vehicle and spins/steers separately. Auto has three wheels. Existing hailing/boarding/destination/fare/arrival/cancel flows remain; ride acceleration/braking and restrained lean are added.
- Warm directional sun, cooler fill, ACES/sRGB, modest haze, recessed-window shading and inexpensive ground contact occlusion. No SSAO/GTAO pass is claimed. Nearby dynamic shadow updates are throttled; reduced motion freezes them; mobile/adaptive low quality disables them.
- Adaptive render scale with sustained-FPS sampling and hysteresis. Low quality reduces pedestrian density and shadows; the authored architectural identity stays visible. Development-only diagnostics report FPS, calls, triangles, textures, shader count, JS heap when supported, scale and eye height. Five fixed review poses are development-only and do not ship as production controls.
- Optional original low-volume synthesized ambience, footsteps and taxi/auto engine tone. Sound starts muted, requires an explicit menu choice and suspends during menus, hidden tabs and Quick View. No audio sample assets or continuous horn spam.

## Budget and limitations

Per normal street view: target ≤85 draw calls, ≤180,000 triangles, ≤12 textures and ≤20 shader programs. Final representative arrival view: 71 calls, 177,668 triangles, 8 textures, 13 shader programs. Across the ten native-resolution pedestrian captures: at most 82 calls, 179,028 triangles, 8 textures and 14 shader programs; observed JS heap 28–39 MB. Software renderer screenshot sampling was 0.4–1.0 FPS at full desktop scale. The phone sample was 58 calls, 171,892 triangles, 7 textures, 10 programs and 2.4 software FPS at scale 0.85. These results meet the structural rendering budgets, not the hardware FPS gate. Memory is observed, not a universal guarantee. Target hardware performance is 45+ FPS with 60 preferred. The cloud has SwiftShader software WebGL; it cannot establish that acceptance threshold. No claim of hardware performance is made.

This slice still uses an authored two-lane waypoint loop. Ambient vehicles are decorative rather than a full traffic collision simulation; traffic-aware pathfinding, district streaming, full NPC navigation graphs and a train sequence remain future work. Visual curb height remains deliberately low and the existing player collision floor remains flat; general stair/slope climbing is not claimed. Other seven districts retain their accessible HTML experiences, and Film City retains the existing HTML story. Their physical interiors and walk-in cinema are not built.

## Evidence

The requested review set is captured under `docs/screenshots/visual-rebuild/`: five eye-level pedestrian views at 1440×900 and 1920×1080, Fort interior, taxi cabin, auto cabin and phone. `measurements.json` records diagnostics and actual player pose. Screenshots are generated from our own code, not the reference. The public-reference access limitation and verified/inferred separation are recorded in `GULMOHAR_REFERENCE_AUDIT.md`.

Verification and the manual visual score are recorded after final captures. Expansion remains gated on the reviewed visual result and an actual hardware traversal measurement. This prevents multiplying unresolved visual/performance weaknesses into nine districts.

## Functional verification

- 49 unit/physics tests pass across seven files, including deterministic façade variation, adaptive-quality hysteresis, articulated three/four-wheel models, full-length pickup clearance at CST, closed-shop frontage collision, attached façade/stock placement and the full-height walk through Fort's real doorway.
- All 32 existing Chromium browser cases passed in a complete run. A new audio-menu case exposed a pre-existing responsive rule hiding the menu. After fixing the product CSS, the two final audio cases passed at 960px and 390px; walking/pause/reset and the physical research terminal were rechecked in the same focused run. All 34 current browser cases are therefore covered by passing runs; a single complete 34-case rerun is not claimed.
- Final TypeScript/Vite production build passes. Vite warns about the approximately 512 KB uncompressed lazy Three.js chunk (about 130 KB gzip). Quick View remains independent of that renderer chunk, as checked in the browser suite.
- `git diff --check` passes. Dependencies and lockfile are unchanged.

Final captures hold desktop render scale at 1.0 using development-only `?debug&review=1`; reduced motion gives repeatable poses and cached directional shadows. This capture override does not exist as a production quality control. Mobile keeps its normal reduced-density setting. Normal full-motion shadow-refresh frames add work beyond the steady cached-shadow view; hardware profiling must include those frames, movement and rides, rather than judge performance from static screenshots.

## Manual visual gate

The corrected native-resolution street views were inspected, not merely generated. Screenshot review caught misplaced shelf stock/window trim in the first iteration; the local façade constructor now inherits the building transform, and a carriageway-clearance regression check guards that failure.

| Criterion | Assessment | Visible evidence |
| --- | --- | --- |
| Façade depth | Yes | Recesses, shutters, arches, projecting balconies and continuous corridors |
| Small objects establish scale | Yes | Shop stock, AC units, drains, scooter, chair and chai counter |
| Street is inhabited | Yes | People at shops/pavements, guides, parked and passing transport |
| Lighting creates depth | Yes | Directional sun/shade, cooler fill, warm interiors and practical lamps |
| Local identity without a giant label | Yes | Auto silhouette, kaali-peeli paint, narrow frontage, utilities and physical bilingual signs |
| Human proportions | Yes, stylized | Head/torso/upper-and-lower limb proportions and articulated gait; close-up finish remains simplified |
| Vehicle silhouettes | Yes | Slanted cabin, lofted hood/body, curved open auto canopy and three/four articulated wheels |
| Road and sidewalk detail | Yes | Paving seams, asphalt grain/patches, drainage, curb breaks and crossing |
| Layered skyline | Yes | Unequal rooflines, station clock towers, tanks/cornices and farther silhouettes |
| Overall reference-level art finish | Provisional | Architecture is substantially improved; characters, vegetation and material finish still need real-device artistic review |

The structural visual review reaches nine positive criteria, with the overall aesthetic criterion provisional. This is not a claim that the full Mumbai world or every final-art character is finished. Expansion is held because the aesthetic review and 45+ FPS hardware traversal gate are not yet established. Software-WebGL screenshot FPS must not be presented as a modern GPU benchmark.
