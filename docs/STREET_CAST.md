# Street cast: licensed human characters — 11 October 2026

The procedural mannequin host, pedestrians, chai vendor, bench sitter and the taxi and auto drivers are replaced by nine rigged, textured people from the **Microsoft Rocketbox Avatar Library** (MIT). Every replacement is admitted through the existing GLB pipeline, SHA-256 checked at runtime, and falls back to the original procedural figure if it fails to load.

**Status: awaiting Harsh's sign-off.** The visual review below is Claude Code's rendered review. Texture and shader-program counts exceed the provisional ceilings; see [Performance](#performance). Neither is approved yet.

## Visual review

Matched 1440×900 captures, reduced motion, same camera poses, base `9fd9743` versus this branch: [`screenshots/street-cast/`](screenshots/street-cast/) (`before/`, `after/`, `side-by-side/`, each with `measurements.json`).

| View | Before | After |
| --- | --- | --- |
| Host close-up (`npc`) | Faceless capsule figure | Station guide in a white shirt and trousers; real face, hands, shoes, cloth folds; Talk gestures |
| Main street (`spawn`) | Mannequins | Host, kurta-clad vendor and walkers at street distance |
| Moving pedestrians (`walkers`) | Mannequins | Six distinct walkers (suits, blazer, hooded jacket, skirt) on the existing routes |
| Café / shopkeeper (`chai`) | Mannequin behind counter | Chai vendor in kurta and cap |
| Bench (`bench`) | Mannequin | Seated student in a hoodie (Sit clip) |
| CST station (`station`) | Mannequins | Office woman and walkers at the station frontage |
| Taxi driver from passenger seat (`taxi`) | Capsule driver | Driver seated with both hands gripping the wheel; wheel turns with steering |
| Auto driver from passenger seat (`auto`) | Capsule driver | Driver seated, hands on handlebar grips; bar turns with steering |
| New building | Owned by the "Mumbai world visual overhaul" thread; not captured here | — |

What it is and is not: Rocketbox is a semi-realistic library (about 7–10k triangles per person, 2010-era production quality). Faces, hair and clothing are authored and believable at street and conversation distance, clearly not blocky, but not photoreal. Darker faces in some views come from the scene's golden-hour lighting, which the overhaul thread owns.

## Provenance and licence

- Source: <https://github.com/microsoft/Microsoft-Rocketbox> pinned at commit `0943055db6ec570bcef9f2c8b41c9e5467c808f9`.
- Licence: MIT, [LICENSE.md at that commit](https://github.com/microsoft/Microsoft-Rocketbox/blob/0943055db6ec570bcef9f2c8b41c9e5467c808f9/LICENSE.md), "Copyright (c) 2020 Microsoft". MIT permits redistribution and modification in a public repository with the notice retained; the notice is in `public/THIRD_PARTY_NOTICES.txt` and `CREDITS.md`.
- Every source FBX and animation file is SHA-256 pinned in `scripts/characters/cast.json`; each shipped GLB has a `.provenance.json` next to it recording the source path, checksums and modifications.

| Id | Role | Rocketbox avatar | Triangles (close) | Atlas | Clips |
| --- | --- | --- | --- | --- | --- |
| host | Station guide | Professions/Business_Male_06 | 6,950 | 2048×1024 colour + normal | Idle, Walk, Talk |
| chai-vendor | Chai vendor | Adults/Male_Adult_15 | 7,292 | 2048×1024 colour + normal | Idle, Walk, Talk |
| taxi-driver | Taxi driver | Adults/Male_Adult_14 | 6,842 | 2048×1024 colour + normal | Idle, Walk, Sit |
| student | Student, bench sitter, auto driver | Adults/Male_Adult_17 | 7,084 | 2048×1024 colour + normal | Idle, Walk, Sit |
| commuter | Commuter | Adults/Male_Adult_04 | 8,684 | 1024×768 RGBA (hair cards) | Idle, Walk |
| office-man | Office worker | Professions/Business_Male_05 | 7,164 | 1024×512 | Idle, Walk |
| office-woman | Office worker | Professions/Business_Female_01 | 8,966 | 1024×768 RGBA | Idle, Walk |
| shopper | Shopper | Adults/Female_Adult_05 | 8,288 | 1024×768 RGBA | Idle, Walk |
| clerk | Clerk | Adults/Female_Adult_15 | 9,832 | 1024×768 RGBA | Idle, Walk |

Modifications: skin tone warmed toward South Asian complexions on five avatars (HSV-masked, strengths in `cast.json`); body/head/hair maps packed into one atlas per person; clips retargeted from the Rocketbox animation rig and trimmed; a 30% decimated `_LOD1` mesh on the same skeleton. Total added: about 13 MB of GLBs, lazy-loaded after the street.

## Pipeline

```sh
python3.11 -m pip install bpy==4.2.0 pillow numpy   # Blender as a Python module
python3.11 scripts/characters/build_cast.py /tmp/cast   # fetch pinned sources, verify, convert
node scripts/import-cast.mjs /tmp/cast                  # admit, hash, write public/models/characters + src/data/characterCast.ts
```

`import-cast.mjs` runs the same `inspectCharacter` checks as `import-character.mjs`. Two admission rules changed, both tested: an atlas up to 2048×1024 counts as one texture (longest edge 2048), and `_LOD1` meshes are counted separately and must be at most half the close mesh's triangles. A member only loads in production when its GLB's hash matches a signed-off entry in `scripts/characters/review.json`; otherwise it is a candidate, visible only with `?characterPreview=cast` in development.

Captures: `node scripts/capture-characters.mjs` (env `STREET_CAPTURE_URL`, `STREET_CAPTURE_VIEWS`, `STREET_CAPTURE_DIR`, `STREET_CAPTURE_MOTION=1`).

## Animation verification

- **Pedestrians:** Idle (breathing and weight shifts from the Rocketbox idle) and Walk, cross-faded when an agent starts or stops. Each placement has a stable phase and rate offset so walkers don't step in sync. Walk playback speed is matched to the agent's velocity using the clip's measured planted-foot ground speed (about 1.05 m/s office-man, 1.12 shopper, 0.83 commuter), clamped to 0.55–1.6×, which keeps foot sliding small.
- **Host and vendor:** looping Talk clip (gestures, 9 s trim).
- **Drivers:** Sit clip, seated on the cushion height, then two-bone IK on each arm to the 10-and-2 wheel rim or handlebar grips, wrist reset to its bind orientation and fingers curled around the grip. The grip targets rotate with the wheel/bar as the vehicle steers. The boarded vehicle's driver stays live; distant traffic drivers are baked once into static meshes (no skeleton cost).
- **Navigation, interaction, collision and transit** are unchanged: the actors are attached to the existing agents and interaction points; procedural figures are only retired once their replacement has loaded.

Checked: still frames in all eight views for deformation and clipping (none seen at the wrists, knees or seat). Known limits: the Rocketbox Sit clip leans the torso slightly forward; hands are IK-placed rather than an authored grip animation; there is no wheel-specific steering animation beyond the arms following the rim. Foot sliding was addressed numerically; a full-motion recording was not reviewed frame by frame on hardware.

## Performance

Cached-shadow review frames, 1440×900, scale 1.00 (SwiftShader software renderer):

| View | Draws | Triangles | Textures | Programs |
| --- | --- | --- | --- | --- |
| npc | 48 → 48 | 144,552 → 145,748 | 27 → 40 | 26 → 34 |
| walkers | 62 → 62 | 175,954 → 184,361 | 32 → 44 | 26 → 34 |
| chai | 41 → 41 | 162,835 → 165,383 | 32 → 45 | 26 → 34 |
| bench | 71 → 71 | 191,847 → 197,827 | 32 → 45 | 26 → 34 |
| station | 65 → 65 | 181,087 → 184,723 | 32 → 45 | 26 → 34 |
| spawn | 73 → 73 | 196,273 → 204,439 | 32 → 45 | 26 → 34 |
| taxi | 42 → 44 | 177,864 → 188,383 | 32 → 46 | 26 → 34 |
| auto | 42 → 42 | 171,888 → 173,723 | 32 → 47 | 26 → 34 |

Draws and triangles stay within the 110 / 230,000 ceilings (maximum 73 draws, 204,439 triangles). **Textures (max 47) and programs (34) exceed the 32 / 26 ceilings. The ceilings in `PERFORMANCE_REPORT.md` are not changed; this increase needs explicit approval.**

Why: the base street already sat at exactly 32 textures and 26 programs, so any real character costs slots. Each person is one material and one atlas (two with a normal map for the four close-up characters), plus a bone texture per live skinned mesh. Programs grow because skinned, normal-mapped, alpha-tested (hair) and baked-driver variants of the standard material each compile separately. Mitigations in place: one material per person, shared atlases, LOD beyond 10 m, culling beyond 48 m, 10 Hz animation beyond 18 m, baked traffic drivers. JS heap rose from about 142 MB to 192–250 MB.

Options if the budget can't move: drop the normal atlases (−4 textures, −1 to 2 programs); use one shared walker atlas sheet (needs a re-UV of six people); or limit the cast to the host, vendor and drivers. Frame time was not measured: SwiftShader runs at about 1 fps and says nothing about laptop GPUs, so a hardware profile is still needed.

## Tests

- `npx tsc --noEmit` clean; `npx vitest run` 87/87 (16 files), including `tests/street-cast.test.ts` (cast integrity and hashes, placements, admission gating, IK).
- Browser suite (`playwright.cloud.config.ts`, SwiftShader): this branch 25 passed / 12 failed; untouched base `9fd9743` on the same machine 28 / 9. The three extra branch failures (quick view without 3D, auto boarding, drag-to-look) were re-run: quick view passed, and auto boarding and drag-to-look fail identically on the base when run alone. Every failure is the world canvas taking about 42 s to appear in this container (measured on both branches) against 12 s assertions, so none is attributed to the cast. A hardware run is still needed.
- Vercel preview build for the PR succeeded.

## Completed, partial, blocked

**Completed**
- Host, chai vendor, bench sitter, walkers, standing pedestrians and both drivers replaced with authored, rigged, textured people; nine distinct base models.
- Idle/Walk with velocity-matched playback and cross-fades; Talk for host and vendor; seated drivers with hands on the controls that follow steering.
- Licence verification, pinned checksums, reproducible build script, admission and runtime hash checks, unit tests.
- Matched before/after captures for seven of the eight requested views.

**Partial**
- Realism: semi-realistic, not photoreal (see below).
- Mumbai mix: office workers, students, shopkeeper, commuters, station guide and drivers are covered, but clothing is Western business/casual except the vendor's kurta; no sari, salwar kameez or dupatta. Six walker models repeat across ten walkers.
- Skin tones were shifted by texture processing, not authored for South Asian faces.
- Driver hands are IK with finger curl, not authored grip animation.
- Mobile loads the same cast (LOD and culling apply; no separate mobile cast).

**Blocked**
- Rendering budget: textures and programs over ceiling, pending Harsh's approval or one of the reductions above.
- Hardware frame-time profile: needs a real GPU.
- New-building capture: owned by the overhaul thread.
- Fully photoreal people: not available under a free redistributable licence. That needs paid or authored assets, for example Reallusion Character Creator exports (licence permitting redistribution in a game build), scanned people, or custom-authored South Asian characters with sari and kurta variety and grip animations.

## Named people (20 October 2026)

Harsh asked for real people in the city, from photos they agreed to share. Each is a **stylised likeness** on a
licensed Rocketbox body: the face geometry and skeleton stay Rocketbox's, and `scripts/characters/likeness.py`
repaints the maps toward the person (skin tone, hair colour and texture, beard or stubble, brown irises, and the
clothes from the photos). Harsh, Anuj and Arham also get glasses: a thin frame built around the eyes in
`rocketbox_to_glb.py`, skinned to the head bone and sampling a dark swatch painted in the head map, so it adds no
material, texture or draw call.

| Who | Where | Base body | Outfit |
| --- | --- | --- | --- |
| Harsh Jha | CST, the arrival host (replaces the station host; interaction id `cst` unchanged) | Male_Adult_08 | pale pink fine-striped shirt, light blue-grey jeans, dark watch, glasses |
| Aarush Shetty | Fort research room, on the rug by the kiosk | Male_Adult_01 | white shirt with sage leaf print, chain |
| Pavit Singh | BKC, past the guide | Male_Adult_01 | black ribbed polo, chain |
| Anuj Deshpande | Andheri, past the guide | Male_Adult_16 | blue t-shirt, grey trousers, short full beard, glasses |
| Arham Jain | Powai, past the guide | Male_Adult_09 | purple t-shirt, black track pants with a grey side stripe, goatee, glasses |
| Ranjan Jha | Dadar, past the guide | Male_Adult_01 | white shirt with mustard, orange, navy and grey brush strokes, plain shorts, orange thread on the wrist |
| Rina Jha | Worli, past the guide | Female_Adult_05 | red long-sleeve top with a front ruffle, blue jeans |
| Abhinav Jha | Juhu Studio, past the guide (moved from Worli on 21 October so every named person has a district of their own) | Male_Child_01 | rust-orange "POWER UP IN PROGRESS" t-shirt, dark jeans |

Abhinav is a young teenager, so his face is the generic Rocketbox child's; only his hair colour and outfit follow
the photos. Three people share the Male_Adult_01 body in three different districts, so they are never seen together.

Dialogue and placement live in `src/data/friends.ts`. District friends are `FriendSlot`s (`npc/FriendSlot.ts`):
one `GLBCharacter` each from their own small asset library (the shared one is capped at 16 templates), placed
along the pavement beyond the district guide. Within 3.4 m they turn to face the visitor and play Talk; the talk
prompt opens `FriendDialogue` in `ui/Exhibits.tsx`, which steps through their lines and ends with links to that
district's exhibits.

Rebuild only these with `python3.11 scripts/characters/build_cast.py <work> harsh aarush pavit anuj arham ranjan rina abhinav`,
then copy the other cast members' current GLBs into `<work>` as `<id>.glb` before `node scripts/import-cast.mjs <work>`
(the importer rewrites every member).

Hair cards on these builds get radial normals (out from the head's centre, `radialHair` in the build config,
set for every `likeness` entry). With the cards' own normals the low golden-hour sun caught them as bright tan
stripes that read as a patterned cap; the radial normals shade the hair like the scalp underneath.

Cost: one atlas texture per person, no normal map: 1664×1248 RGBA for the six with hair cards (the importer caps a
texture at 2048×1024 pixels in area), 2048×1024 for Anuj and Abhinav. At CST, Harsh replaces the host's two
textures with one. Each district adds one character and one bone texture while its friend is in view.
