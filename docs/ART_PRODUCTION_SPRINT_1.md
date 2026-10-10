# CST–Fort Art Production Sprint 1

**Branch:** `feature/cst-fort-art-production`
**Base:** `feature/mumbai-production-overhaul`, commit `1c9e097` (implementation `878b13f`).

This sprint changes the existing street only. Portfolio content, deep links, Quick View, HTML district experiences and the physical walking/transit layout are retained. No other district is expanded. This report distinguishes delivered code, actual visual evidence and blocked acceptance work.

## Deliverable status

| Deliverable | Implemented / remaining |
| --- | --- |
| Visible world boundaries | Rendered terminal/perimeter wall meshes removed; original safety proxies retained. Cross-street road surfaces, an oblique corner, seventeen distant blocks and eight back-lot buildings plus a32-building fogged skyline provide a layered continuation. Matched end/gap captures demonstrate the change; exhaustive passenger look-angle coverage remains outstanding. |
| Asset pipeline | New lazy same-origin GLB library, integrity/admission checks, shared material/template resources, independent skin clones, separate authored geometry LOD and explicit release/disposal. A station-character hook integrates approved assets without changing host interaction coordinates. |
| Architecture | Alternating floor counts and heights, projecting heritage bays, Art Deco vertical articulation, commercial roof terraces, recessed shop shelves/back walls and an original Indo-Gothic station composition. |
| Evening lighting | Shared fixed 17:40 golden-hour state for HUD/renderer; lower warm sun, more legible cool fill, restrained warm window/shop light and longer atmospheric depth. No new bloom/grading/darkness treatment. |
| Licensed NPC proof of concept | **Blocked.** The official Quaternius character licence is verified CC0, but actual binary retrieval receives proxy403. No rigged character file is imported. The original host is retained; no new primitive replacement is manufactured. |
| Performance | Close character resolution is retained. Distant garments reduced to resolution12, shared through-window topology deduplicated across grammars and balcony rail repetition reduced. Distant window faces use shared two-triangle planes instead of twelve-triangle boxes; close façade openings retain depth. Budgets remain110 draws/230,000 triangles/32 textures/26 programs for Medium. Final measured counts belong below; no hardware FPS claim. |

## Exact scene changes

### Boundaries and depth

The previous grey north/south slabs at Z−63/Z20 and side walls at X±19 are no longer rendered. Their original box safety limits remain Cannon/BVH proxies, preserving route/navigation bounds. The presentation continues beyond those limits through an authored north cross street, a left-turn road branch, angled corner masses, varied rooflines, overlapping farther buildings and back-lot silhouettes behind frontage gaps. The station and its distant neighbours close the southern vista. Ground presentation extends beyond the camera range; fog integrates the distant silhouette.

The continuation is **non-traversable visual context**, not additional gameplay or a new road graph. Invisible physics limits still exist and must not be described as free exploration. There is no assertion that every possible look angle has been exhaustively surveyed. Near-limit/end/gap images supplement the normal street and passenger views.

### Building and shop variation

Left façade floor counts are2/4/2/3/4/2/3 and right counts4/2/3/2/3/4/2. Heritage floor height remains2.85m; Art Deco becomes2.65m; other styles2.55m. Existing ground-floor positions/collision are retained. Projecting heritage bays and Art Deco piers break the same flat frontage plane, and selected commercial roofs carry terrace masses. The original weathering, shutters, utilities and shop-specific dressing remain.

Open shop backing walls/shelves sit farther behind the frontage rather than on a shallow painted plane. Decorative shelving depth changes without opening closed collision footprints to the visitor. Shared through-cut window panels now use one cached topology: previous grammar-specific cache identities represented identical opening geometry, wasting separate instanced draws. Exterior grammar decoration remains distinct.

### CST massing

The oversized station board and small twin-tower block are replaced by a wider station wing composition, pointed gallery/window surrounds, stone piers/cornices, hipped roof forms, a central raised dome and flanking cupolas. Twelve low-cost seam ribs articulate the central dome. A human-scale bilingual plaque and small clocks support identity rather than dominating the façade.

This is an original **Mumbai CST-inspired interpretation**, not a surveyed replica or externally sourced monument mesh. The physical station mass is behind the prior carriageway/turning clearance. The arrival host, transport stands and arcade/forecourt controls stay in their existing roles. Clocks are authored at17:40, matching the fixed scene state.

### Lighting

`streetMood.ts` is the shared authored mood: fixed17:40, warm sun intensity2.25 at(−32,15,−55), cool hemisphere fill1.15, fog72–175m, exposure1.12. Camera FOV/eye height/exposure remain unchanged for the comparison; illumination and geometry deliberately change. This is a plausible golden-hour art setting, not a live astronomical model or a claim about the visitor's local time.

The existing four local lights and warm windows remain. Sunlit plaster/stone and cool shadow readability are balanced without hiding the scene in darkness. The same High/Medium/Low pipeline, bounded shadow refresh and reduced-motion behavior remain.

## Asset production, provenance and blocker

See [GLB_ASSET_PIPELINE.md](GLB_ASSET_PIPELINE.md) for API responsibilities, admission limits, candidate register and the source-to-export workflow. Official character/heritage-detail/street-kit catalogue pages from Quaternius individually list CC0; unavailable candidate licences are explicitly unverified. No downloaded source model, texture, executable pack script or new package is incorporated.

The anonymous Universal Base Characters download page was retrieved. Its Standard archive is advertised as122MB. The file endpoint now resolves to an itch.io R2 mirror, but fetching actual binary bytes fails CONNECT proxyHTTP403. Thus rig, clothing, animations, file integrity, conversion and final character fit cannot be inspected. There is no claimed archive/model checksum. The normal procedural host remains visibly unchanged in the close-up comparison.

In-memory original triangle/skin test fixtures validate the integration code; they are not a licensed character proof of concept and are not displayed in the street. Future asset admissions require original author/licence/source URLs plus source/exported checksums and exact modification records.

## Comparison method

Fresh baseline captures use a separate detached worktree at1c9e097 and Vite port5174. Final captures use the working branch at port5173. Both use system Chromium/SwiftShader,1440×900, reduced motion, development `?debug&review=1`, full render scale1.00, FOV68, eye1.68m and exposure1.12. The renderer preset is Medium; the separate diagnostic `quality: high` means adaptive detail has not dropped to Low, not the selected rendering preset. No screenshot is composited into the product. Analytical comparison sheets, if present, are labeled separately from native PNGs.

The same named review coordinates are used for CST spawn, station, junction, shops, NPC, Fort, return, north-limit, south-look and side-gap. Three extra camera events are added to baseline **diagnostic instrumentation only**, leaving its geometry/materials/lighting unchanged. Taxi/auto captures both hail from the fixed Fort pavement pose in reduced motion, rather than comparing mismatched visitor/cabin positions. Mobile/fallback coverage is also captured at390×844.

Native evidence directories: [before/](screenshots/art-production-sprint-1/before/), [after/](screenshots/art-production-sprint-1/after/). Baseline boundary measurements are separate from its initial measurements. Final walk/boundary measurements share one file. Passenger screenshots are visual evidence; their image existence alone is not a complete ride test.

## Manual visual review

All fourteen native before/after images were compared, with native station/shop/end views inspected at full resolution and analytical contact sheets used only for overview. Ten measured walk/boundary poses match exactly in X/Z, eye height, yaw, render scale and selected preset; see `pose-comparison.json`. Taxi/auto use the same unchanged cabin offsets and the same fixed Fort hailing procedure in both runs.

| View | Visible difference | Remaining defect / assessment |
| --- | --- | --- |
| CST/station | The oversized board/twin-tower block becomes a broader pointed-arch station with a dome, roof wings, cupolas and restrained plaque. Foreground roof heights also differ. | The silhouette change is immediately apparent. Dome/drum/surrounds remain simplified original meshes, not final heritage sculpture or a surveyed replica. |
| Junction | Former end slab gives way to offset buildings and a deeper architectural vista; floor stacks have a less uniform skyline. | Near street furniture/trees retain their prior simple silhouettes. |
| Shops | Stock now sits farther inside shadowed alcoves; stepped heights and projecting bays break the frontage. Distant architecture replaces the straight end wall. | Visible shop stock and window rhythm remain repetitive. Alcoves are darker/deeper, not newly traversable shops. |
| NPC close-up | Station stone galleries/background replace the old board/wall composition. | The prominent person is visibly the same procedural host. This does **not** pass the licensed NPC deliverable. |
| Fort entrance | Open doorway, research contents, guide and terminal remain readable with the same composition. | Little visible change inside this preserved room; no claim of a new interior art pass. |
| Taxi passenger | Cabin, meter and right-hand driver stay in the same positions; the former grey street-end wall becomes layered buildings. | Original cabin/driver remains stylized. No new vehicle asset or camera change is claimed. |
| Auto passenger | Open passenger view now faces layered architecture instead of the terminal slab. | Body/driver detail is preserved; character quality remains limited. |
| North limit | The before image is dominated by a grey slab. After shows a cross-street corner, side windows and a deeper alley closed by another building. | The safety proxy remains invisible; context cannot be traversed. This view fixes the earlier empty alley/ground horizon gap. |
| South-side look | The large terminal wall disappears; overlapping neighbouring buildings and a fogged skyline cover the previously bare ground/sky seam. | Backdrop façades remain deliberately low-detail and planar; the side plaza is sparse and could be dressed further. |
| Frontage gap | The narrow visible slot reads into back-lot architecture rather than the earlier perimeter slab. | Tight angled geometry still looks procedural up close. |
| Spawn/return | Both ends now have more depth; return sees the new station silhouette. | The same authored street/crowd positions remain. |
| Mobile/fallback | Street context changes on mobile; theatre text/controls retain the same HTML experience. | Device-specific visual/touch acceptance remains a separate real-hardware check. |

The street-end and CST composition changes are substantial in the actual first-person comparisons. This is a reviewable art-production checkpoint, **not** a claim of reel parity or final production acceptance. The blocked close-up asset, planar background treatment and repeated small props remain explicit quality gaps. No generous numerical score is used to override them.

## Verified performance and functional evidence

Final source passes68 unit/physics/integration cases, TypeScript and production build. Full35-case browser regression completed:33 passed, two failed,16.0minutes. The taxi trace records a source-save-triggered Vite hot refresh and reset meter while the final loader teardown guard was saved. The Fort poll timed out at12seconds with X−8.362; its research prompt was visible and no console error/hot refresh was recorded. The focused frozen-source retry passed taxi and repeated the Fort12-second timeout. Fort then passed with a temporary cloud-only30-second expectation window and the same movement, X-coordinate, prompt and dialog assertions (57.7seconds total). No production source, physical route or assertion was changed for this retry. All35 scenarios have passing evidence across the full run and focused retries; this is not a clean35-pass full run. Logs are retained as `browser-full-run.txt`, `browser-retry.txt` and `browser-fort-30s.txt` beside the screenshot evidence; the exact temporary override is preserved as `fort-retry-config.txt`. Final native capture completes14 images and11 diagnostic measurements, with no logged page/console errors. Hardware laptop GPU access is unavailable in this cloud environment; CPU profile and software rendering cannot establish that acceptance gate.

| Metric | Baseline / final verified result |
| --- | --- |
| Static Medium desktop peak draws |102 →101 (ceiling110) |
| Submitted triangles |231,164 →224,754 (ceiling230,000) |
| Tracked textures / shader programs |28 /24 (ceilings32 /26) |
| Desktop review scale |1.00, held in both runs |
| Pose equality |10/10 measured walk/boundary views match |
| CPU construction |1,326ms, Node CPU only |
| Street update |mean0.547ms; p954.199ms; p994.442ms |
| Crowd update |mean0.112ms; p950.100ms; p994.070ms |
| Traffic update |mean0.064ms; p950.025ms; p990.099ms |

Final counts fit the unchanged provisional Medium ceilings, with5,246 triangles of headroom. They are cached-shadow static views, not a complete High-pass count profile or frame-time guarantee. The CPU sample has779 updates, ready Recast navigation and concurrent software-browser workload. It contains long-tail outliers and does **not** prove improved simulation stability versus previous profiles. Raw JSON is retained.

Environment: Node24.19.0, Chromium151.0.7922.173 on Debian13, Playwright1.63.0, Vite7.3.6 and SwiftShader. These are actual installed versions, not just manifest ranges. Advisory audit reports zero known vulnerabilities; package.json/package-lock.json remain unchanged.

Final chunks: WorldEngine336.28KB raw/100.36KB gzip; Three583.86/148.83KB; GLB library5.71/2.45KB; character1.44/0.75KB; GLTFLoader43.92/12.95KB; unchanged WASM726.36/217.70KB. Loader/controller code is lazy, but shared Three retention increases versus the prior133.07KB gzip chunk; this overhead is explicit. Known Vite large-chunk and upstream CSG maxLeafSize deprecation warnings remain visible, not patched out.

The first architecture capture was slightly above budget (230,346 triangles). The fuller background capture peaked at233,978 triangles/100 draws; it is retained as iteration2. A later detailed-corner/stock fix measured230,786 and exposed a straight distant alley gap. Distant panes were simplified and a farther closing block added; intermediate captures remain clearly labeled. Distant-garment topology is then reduced while keeping close geometry. No ceiling is raised, review scale lowered or optional low preset used to conceal these results.

## Unresolved defects and acceptance

1. **Close-up people remain procedural.** The licensed rigged NPC proof of concept is blocked by binary access. Faces/clothing quality has not magically changed because an asset loader exists.
2. **Architecture and props still need final production art.** The new composition is original generated geometry, with remaining repetitive window/shop grammar and simple object silhouettes. A Mumbai-inspired station is not automatically architecturally accurate.
3. **Limited world and hardware evidence.** Decorative continuations have invisible collision boundaries, not traversable streets; exhaustive passenger look-angle survey and representative laptop frame-time measurement remain separate work.

The captured street composition is substantially improved and the static Medium count gate passes. **Full art-production acceptance remains incomplete:** the licensed NPC proof of concept is blocked and representative laptop GPU performance is unmeasured; further surface/prop/character art is needed. This checkpoint is not a finished reel-level city. No deployment or production merge is performed.
