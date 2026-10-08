# Production-overhaul verification log

Branch: `feature/mumbai-production-overhaul`; stable original checkpoint `233d3e6`. No production push or deployment is authorized by this prompt; neither has been performed.

## Baseline

- Existing 49 unit/physics tests passed across seven files before active-world edits.
- Existing 34 Chromium browser cases passed in a complete 8.9-minute run before active-world edits.
- Baseline advisory audit: zero known advisories.
- Existing 17 native/mobile checkpoint screenshots retained and copied into the before review directory. They are retained checkpoint captures, not falsely represented as newly recaptured on this date.

## Implementation checks

- 59 unit/physics tests pass across 11 files after integration, including all 49 existing cases plus BVH validity/raycast/ground/disposal, CSG opening/cache, real Recast paths/crowd cleanup, road curve/spacing/yield/signal and skin weights/normals/animation.
- TypeScript and Vite production build pass; chunk-size warnings retained.
- Six exact package additions, no existing resolved-package changes. All six ECDSA registry signatures pass independent verification. Tarball integrity remains enforced; final advisory audit is clear. Full Sigstore/TUF provenance verification is blocked by proxy403.
- Full post-integration Chromium run: 34 passed, one reached its 90-second cloud deadline after displaying the correct auto/fare state (13.3 minutes total). The unchanged ride-interruption assertions passed on a focused retry with a 180-second software-renderer deadline (1.7 minutes). Context loss and all three detail presets also passed after explicit skeleton bone-texture cleanup. The focused run passed all three cases in 2.7 minutes. All 35 cases therefore have passing evidence, but the complete run itself had one timeout; no single clean 35-case run is claimed.
- Final capture script completed successfully: 28 original images, 20 desktop pose measurements plus one mobile sample. All desktop poses report navigation ready, full render scale and on-demand rendering. Manual review covers the whole set and native NPC detail. No page/console errors were printed during capture.
- Final steady Medium capture maxima: 98 draws, 224,050 submitted triangles, 27 textures. Laptop GPU FPS is not certified.
- Source hash records, six-only lockfile additions, built license notices and `git diff --check` also pass.
- Screenshot/manual art evidence remains separate from functional success; see VISUAL_QUALITY_REVIEW.md.

## Limits

No new physical district or cinema was built. Existing HTML theatre remains available. Quaternius asset source verification is network-blocked; no external human/animation asset is integrated. Characters use original skin/rig code and still require close-up art review. Hardware 60 FPS, geometric character LOD, full traffic collision, navmesh dynamic obstacles and production hosting are not established. Keep the branch reviewable and the expansion gate closed until those relevant visual/performance requirements pass.
