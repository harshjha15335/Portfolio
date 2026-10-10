# CST–Fort polish — 2026-10-10

This pass stays on `feature/mumbai-production-overhaul`, starting at `c929257`. The supplied Gulmohar reel is re-inspected locally at its street/transport shots. Only this street is polished; no other physical district or production deployment is added.

## Visible changes

- Original people now have shaped jaws/cheeks/ears, inset eyes, brows/lips, swept hair, fingers, collared shirts and varied sleeve lengths. Shirt shoulders are narrowed and the seated pose bends knees forward. Two geometry detail levels keep close characters detailed and distant characters cheaper on the same sixteen-bone rig.
- Taxi and auto drivers are baked from that original seated rig. Bucket/bench seating, stitching, pockets, controls, instrument dials, vents, roof lining, interior mirror and wipers give the passenger view a purpose. A single original woven upholstery texture is shared. Ambient traffic/parked vehicles use lower-detail baked drivers and basic seating; the boarded taxi/auto retains the detailed driver, stitching, instruments and lining. Passenger cameras move to actual rear-seat positions; the auto driver moves forward to keep the street visible.
- Draped striped awnings, perpendicular shop signs, repair radios, books, bread trays, optics displays and chai detail distinguish the frontages. Irregular weathering follows solid piers and water paths. The shared weathering geometry is merged into one draw.
- Compound Gulmohar-like fronds replace disconnected leaf flakes. Fort gets framed open door leaves, a heritage reveal and readable research wayfinding. Open station-side arcades replace the empty arrival boundary-wall backdrop without adding a district. Lower warm sun, cool shade and actual warm shop light preserve the stylized street without neon or heavy postprocessing.

## Reference comparison and art judgment

Compare the same eye-level poses, FOV68 and exposure1.12 against the retained `c929257` native captures in `screenshots/cst-fort-polish/before/`. These before files are unchanged checkpoint copies, not newly photographed scenes. Lighting and geometry deliberately change. The new taxi/auto camera positions are explicitly a correction, so their cabin comparisons are not identical-camera measurements.

The reel demonstrates a coherent walkable Indian street, layered shopfronts, local signs and transport, warm interior light and deep outdoor shade. The polish adopts those cues. It does not reproduce the reference project's source or ship reel frames.

The original character profiles remain stylized. Tests cannot certify aesthetic equivalence, and small native screenshots cannot establish close face quality or representative laptop performance. Native image review shows a stronger street silhouette and readable shops/cabins, but faces, rigid clothing, repeated facade proportions and the terminal street boundary remain visibly procedural. This is a substantial polish checkpoint, not a claim that the reel-level art gate has passed.

## Source and dependency checks

No package addition or installation. `npm audit` on this date reports zero known advisories. Quaternius' canonical publisher/itch pages are now reachable and list CC0 for Universal Base Characters. The actual file redirects to blocked Google Drive; no archive was obtained, extracted or imported. All new visual assets remain original code and procedural canvas work. See ASSET_PROVENANCE.md and SECURITY_DEPENDENCY_AUDIT.md.

## Verification

- 62 unit/physics cases pass, including forward-facing seated knees, finite baked driver geometry/normals and cheaper distant geometry with unchanged skeleton/valid weights, and cheaper ambient vehicles with the same exterior bounds.
- TypeScript and production build pass. Vite retains the known large-chunk warnings; no warning is hidden.
- Full Chromium regression: 35 passed in 14.5 minutes using one worker and a 180-second cloud-only timeout. After the final geometry/UV/hand-position/arrival-backdrop fixes, all five focused entry, walking, reboarding, Fort-terminal and render-preset checks passed in 3.9 minutes. The original assertion set is preserved.
- An intermediate native capture exposed a provisional Medium budget failure (112 draws/265,676 submitted triangles). That capture is retained as iteration-3 and was deliberately interrupted; budgets were not increased. Ambient vehicle detail was reduced while preserving detailed boarded cabins. Both complete taxi/auto ride checks and the preset check passed after that optimization (three cases, 3.3 minutes). The final native return view still submits 231,164 triangles against the unchanged provisional 230,000 ceiling; this remaining overrun is recorded, not waived.
- CPU-only authored-world profile: 779 measured updates, construction1486ms; street mean0.259/p950.283/p990.387ms; crowd mean0.049/p950.088/p990.131ms; traffic mean0.018/p950.034/p990.067ms. The profile ran alongside a browser workload. This is simulation timing, not browser/GPU FPS.
- Final native capture completes28 PNGs (two desktop resolutions plus mobile/fallback),21 measurements, with no logged page/console errors.
- Native desktop counts peak at102 draws,231,164 triangles,28 textures and24 shader programs, scale1.00. The remaining triangle overrun is0.51%. No measured browser FPS is presented as representative hardware performance.
- World engine328.64KB raw/97.57KB gzip; Three523.96KB/133.07KB; unchanged compat WASM726.36KB/217.70KB. No external model/texture payload is added.

Real laptop frame-time stability, complete collision between traffic and rides, full skeletal LOD and streaming remain unverified. No production push or deployment is performed.
