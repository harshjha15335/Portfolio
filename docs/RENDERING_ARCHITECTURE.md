# CST–Fort rendering

WorldEngine preserves Cannon's dedicated walking body and ride lifecycle. Static physics proxies and the complex through-cut façade panels are converted once into bounded, trusted BVH geometry; interaction visibility uses this index to reject targets behind walls. Ground queries are available and tested; Cannon remains authoritative for grounding and movement. BVH does not replace dynamic physics or accept visitor geometry.

FacadePanels caches CSG-generated wall sections with through-openings, shared per grammar. Existing shutters, frames, balcony rails, parapets, utilities and awnings remain. The operation runs at street construction, never in the frame loop. Build-time baking remains an optimization opportunity.

Lighting uses a warm sun, cooler hemisphere, neutral atmospheric sky and modest haze. A Three.js RoomEnvironment-generated PMREM provides restrained PBR reflections without downloaded HDR assets. Its intensity is 0.22; it is an approximation, not a Mumbai HDR capture. The initial shadow refresh happens after world construction. Materials keep original procedural maps, rough plaster/stone, fabric, painted steel and glass; vegetation uses double-sided folded leaf profiles.

StreetRenderer offers High (half-resolution nine-sample SSAO plus ACES/FXAA), Medium (direct ACES with native antialiasing and shadows) and Low (direct renderer ACES, without effect targets or directional shadows). The scene is tone-mapped exactly once. Reduced motion is an independent accessibility setting, freezing crowd/traffic animation and removing bob/ride animation. Adaptive low quality bypasses postprocessing and directional shadows, while keeping architecture/content. No bloom, vignette, grain, chromatic aberration or depth-of-field is used.

Renderer diagnostics aggregate all passes rather than resetting statistics per pass. Composition targets, PMREM, BVH geometry, navmesh/crowd, cached façade geometry and world objects are disposed on teardown. Browser context loss retains accessible Quick View. Final screenshot measurements and hardware limitations live in PERFORMANCE_REPORT.md.

Reduced-motion street rendering is on demand: camera movement, detail changes and dirty shadows request a frame. Input, physics and HUD updates continue. Idle frames are excluded from adaptive quality sampling, and diagnostics show `idle` rather than presenting animation-loop frequency as GPU FPS.

World teardown explicitly disposes each distinct character skeleton and its GPU bone texture, alongside geometry, materials and image textures. Cached original garment geometry is bounded to one CPU source reused across worlds.
