# Verified GLB integration pipeline

Sprint 1 adds `GLBAssetLibrary` and `GLBCharacter`, using Three.js' existing GLTFLoader and SkeletonUtils. No runtime dependency was installed. No downloaded asset is currently shipped: the individually licensed character binary cannot be obtained through the environment proxy.

## Admission and production workflow

1. Obtain an asset from the original publisher. Record the exact asset page, author, redistribution licence and downloaded-file SHA-256. Review archive paths, manifests, scripts and dependencies before extracting; never execute pack scripts.
2. Inspect the actual model, texture dimensions, rig, animation names, scale, facing direction and triangle/material count. A catalogue thumbnail or CC0 declaration is not evidence that the file has been inspected.
3. Convert/export to a self-contained GLB with embedded buffer-view images. Preserve author/licence notices. Record all edits, tool versions and exported SHA-256 separately from the source archive checksum. Produce artist-authored lower geometry levels when needed; do not claim cloning is geometric LOD.
4. Keep verified exports under a same-origin public asset path, with content-hashed filenames because `/assets/*` is cached immutably. Supply a `VerifiedGLB` descriptor with id, URL, SHA-256, original source URL, author and licence. Each separate LOD file needs its own checksum and increasing distance.
5. Use `GLBAssetLibrary.acquire()` for a resource lease. Attach `lease.root` to the intended scene node, control its animations, then call `release()` when it leaves the scene. Call/await library `dispose()` when its owning world is destroyed.
6. For the station pedestrian, call `MumbaiStreet.installStationCharacter(descriptor)` from trusted application code only after the actual asset is reviewed. The hook loads the library/character code dynamically. It preserves the station host's transform and interaction point and hides the procedural skin only after a valid character is ready. It does not accept visitor uploads or expose a remote asset URL input.

## Runtime contract

- Same-origin `.glb` only; required 64-character lowercase SHA-256, checked before parsing.
- Streaming response budget: 8 MiB per file by default. The request is aborted at world/library shutdown. Up to eight cached file/checksum identities by default.
- GLB v2 headers/JSON validated; external image/buffer URI references rejected before loader parsing. Embedded images are supported. Optional Draco/KTX2/Meshopt decoder installation is not provided; unsupported required extensions are rejected.
- Maximum 120,000 source triangles per loaded template. This is an admission cap, not permission to spend the whole street budget on one model.
- GLTFLoader is imported on the first successful verified parse. SkeletonUtils clones preserve independent rig state; immutable geometry/textures are shared.
- Material reuse compares serialized material state, excluding identity/name metadata. It preserves texture identities and material settings, rather than merging visually different materials merely because colors match.
- Authored lower files create a Three.js LOD. This is geometry LOD; every level must retain the required rig/animation compatibility if used for a character. The API returns the primary animation clips; it does not retarget incompatible rigs automatically.
- A character must contain a SkinnedMesh and named Idle/Walk clips. It is normalized to approximately 1.72 m and floor-aligned without modifying shared geometry. Animation mixers blend idle/walk; the fixed station host uses idle. No animation is fabricated when a required clip is missing.
- Release removes the instance and disposes instance skeleton resources without freeing shared geometry/materials. Library disposal releases all leases and disposes each unique template geometry, texture and pooled material. Pending loads refuse to attach after disposal.

The original host remains allocated but hidden after successful installation so existing world teardown owns its resources. No character has been installed in this sprint: the hook and fixtures must not be represented as the licensed NPC proof of concept.

## Tests and payload

`tests/glb-assets.test.ts` creates an original tiny triangle GLB in memory, not a production character. Tests exercise real GLTFLoader parsing, checksum/budget/source rejection, template sharing, independent leases, disposal and separate LOD roots. An additional original test skin checks human-scale normalization and idle/walk mixer behavior; it is neither exported nor displayed in the city.

Vite builds separate GLB library, character-controller and GLTFLoader chunks. Existing Three.js shared-chunk retention also increases because the new loader/animation utilities use more exports; lazy loading does not mean zero shared initial overhead. Refer to the sprint review for measured output sizes and scene counts.

## Candidate register — 10 October 2026

| Candidate / intended role | Original URL and author | Licence evidence | Actual acquisition status |
| --- | --- | --- | --- |
| Universal Base Characters / pedestrian rig and clothing | https://quaternius.com/packs/universalbasecharacters.html ; linked https://quaternius.itch.io/universal-base-characters ; Quaternius | Both official pages returned HTTP 200 and explicitly list CC0 | Anonymous download page obtained; Standard archive advertised as 122 MB. File endpoint resolves to itch.io's R2 storage mirror, whose binary request fails CONNECT proxy HTTP 403. No bytes, file checksum, rig/animation inspection or imported model. A per-character GLB export would still need separate review. |
| Modular Medieval Buildings / heritage masonry and opening-detail candidate | https://quaternius.com/packs/modularmedievalbuildings.html ; Quaternius | Official page returned HTTP 200 and links CC0 | Catalogue/licence verified only. No pack downloaded or GLB inspected; historical Mumbai suitability and export formats remain unverified. Candidate for adapted details, not an accurate CST model. |
| Modular Streets / street-prop candidate | https://quaternius.com/packs/modularstreets.html ; Quaternius | Official page returned HTTP 200 and links CC0 | Catalogue/licence verified; binary acquisition not attempted in this sprint. No imported file or modification. |
| Downtown City MegaKit / distant architectural detail candidate | https://quaternius.com/packs/downtowncitymegakit.html ; Quaternius | Official page returned HTTP 200 and explicitly lists CC0 | Catalogue/licence verified; no downloaded/exported file. Fit and polygon budgets need model inspection. |
| Animated Characters 1 / alternative pedestrian candidate | https://kenney.nl/assets/animated-characters-1 ; Kenney | Individual asset page cannot be read in this environment; licence **not individually verified** | Publisher request blocked with proxy HTTP 403. No download/import. Candidate only. |
| City Kit Commercial / street props and background details | https://kenney.nl/assets/city-kit-commercial ; Kenney | Individual page/licence unavailable here; **not individually verified** | Proxy HTTP 403. No download/import. Stylistic fit for Mumbai also unverified. |
| Red Brick 03 / masonry material candidate | https://polyhaven.com/a/red_brick_03 ; Poly Haven catalogue | Individual page, author credit and licence unavailable here; **not individually verified** | Proxy HTTP 403. Texture candidate, not a heritage GLB. No download/import. |

No verified, appropriate heritage-detail GLB was obtained. Original CST-inspired architectural geometry is used instead. A heritage model candidate must show individual authorship/licensing and actual source files before acceptance; the register deliberately contains no invented CST download, author or checksum.
