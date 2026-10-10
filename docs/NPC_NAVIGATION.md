# Authored pedestrian navigation

Pinned MIT packages: @recast-navigation/core, wasm and generators 0.43.1. No Three helper package or duplicate pathfinder is installed. The shipped compat WASM is embedded in a same-origin lazy JavaScript asset; no remote binary fetch or untrusted navmesh input.

NavMeshManager generates once from bounded original walkway geometry. Authoring admits both pavements, one zebra crossing and the Fort room. Static collider footprints remove benches, counters, crates, bins, frontage walls, research bookcase and boundary structures. Road surface outside the crossing is excluded. The mesh is capped at 50,000 input vertices and rejects non-finite coordinates. Tests exercise real WASM, sidewalk/crossing paths and native crowd cleanup.

Ten moving people use Recast/Detour crowd radius/separation and acceleration, rotating toward velocity and following six station/shop/commuter destinations. Arrival produces a three-to-five-second idle before the next target. Crossing approach waits for a shared pedestrian phase. Nearby player position pauses a walker to reduce overlap. A failed initialization leaves original figures standing, with portfolio controls intact; diagnostics expose `navigation=unavailable`, rather than claiming navigation works.

NPCFactory supplies an original vertex-colored SkinnedMesh with sixteen bones, shaped jaw/cheeks/ears, almond-shaped eyes, swept hair, individual fingers, collars, cuffs and original walking/idle/sitting motions. Sleeve length, color, height and phase vary deterministically. Sitting bends the knees toward the character's forward direction; tests check the actual posed knee position.

Two authored geometric detail levels reuse the same skeleton and skin weights. Within 10m, characters use the detailed face and 24-resolution garment surface; farther away, they use fewer radial segments and a 16-resolution garment surface. Animation throttles to 10 Hz beyond 18m; bodies cull beyond 48m. Both owned detail geometries and the skeleton bone texture are disposed on world teardown. This is a real two-level geometry reduction, not a skeletal LOD or compressed model streaming pipeline. The CPU garment templates are bounded to two reusable source geometries.

Drivers are baked once from the same original seated rig, including posed surface normals and hands reaching steering controls. Traffic does not allocate a runtime skeleton or bone texture for them. No downloaded human is integrated. On 2026-10-10, Quaternius' official Universal Base Characters page and linked itch page were reachable and the publisher CC0 license verified; the actual download redirects to blocked Google Drive. No pack bytes or unverified mirror model were imported.

Limitations: fixed authored obstacles, simple six-target routines, no dynamic navmesh carving, no visitor crowd agent, no NPC indoor research duties. Pausing near the player cannot guarantee collision-free crowds around every temporary vehicle. Detailed visual acceptance is recorded separately from functional tests.

Ambient vehicles bake the street-detail driver surface. Boarded vehicles bake the close-detail driver and retain the detailed cabin. Neither variant uses a runtime traffic skeleton; tests also check that their exterior bounds match while ambient submitted geometry is substantially lower.
