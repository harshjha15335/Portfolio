# Environment visual audit: trees and signboards

Scope: the street trees of the seven districts and every painted sign in the city (CST, Fort Road and the seven
districts). Statuses: PASS, PARTIAL, FAIL, BLOCKED, NOT TESTED. A claim is backed by a named test, a measurement or a
screenshot from the running game; anything else is marked as inferred.

## Trees

### Before

`canopyTree` drew a forked trunk under thirteen noise-pushed icospheres: a "blob" crown with no branches showing and
no leaves, the same shape for every district.

### After (`src/game/World/districts/nature.ts`)

- A real branch structure: a trunk with a flared base that forks into limbs, each splitting again (two levels), all
  as bark-coloured rods on the merged `wood` surface.
- Leaves, not blobs: every branch tip carries leaf sprays, each a twig with pointed four-triangle leaf blades with a
  raised midrib, fanned left and right and shaded lighter at the tips (vertex colour; no textures or alpha cards).
- Two district species:
  - Rain tree (Dadar's Shivaji Park and the default) spreads five limbs into a wide umbrella of fine leaflets.
  - Indian almond (Juhu) grows pagoda tiers of near-horizontal branches with large broad leaves.
- Wind: the foliage surface of every district sways in a breeze, a vertex shift that grows with height above the
  ground and varies with position, so neighbouring trees move out of step. It runs on the GPU with one shared shader
  variant, driven by world time (`foliageWind` in `DistrictKit.ts`), and stops when reduced motion is on. Shadows
  use the rest pose.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Branching trees, no blob crowns | PASS | `nature.ts`; screenshots in the PR |
| Leaf geometry, not spheres | PASS | `leafSpray`; screenshots in the PR |
| Species per district | PARTIAL | two species (rain tree, Indian almond); palms are unchanged; gulmohar, peepal and banyan are not modelled |
| Wind | PASS | shader sway; seen moving in the running game (inferred from successive frames, see the PR) |
| LOD | NOT TESTED | not built: the trees are merged into each district's surface meshes, so there is no per-tree level of detail; a district is drawn whole or not at all |

Cost, measured by building every district in Node. Static triangles are the merged district meshes that
`tests/districts.test.ts` holds under 180,000 per district (before → after):

| District | Foliage triangles | Static triangles |
| --- | --- | --- |
| Dadar | 28,328 → 60,888 | 144,550 → 177,706 (+22.9%, under the 180,000 budget) |
| Juhu | 17,912 → 40,362 | 89,226 → 111,676 (+25.2%) |
| Others | unchanged (their greenery is palms, shrubs or planters) | unchanged |

The first version of the rain tree (seven sprays of fourteen leaflets per branch tip) put Dadar at 188,630, over the
budget, so it now carries six sprays of twelve slightly longer leaflets.

## Signboards

### The sign audit

Every sign placed through a district's `SignAtlas`, and every sign on Fort Road and at CST, now records its text,
tier, centre, facing and size (`SignAtlas.records`, `MumbaiStreet.signRecords`). Signs have a tier:

- Tier 1: district and building names and wayfinding, which must be legible.
- Tier 2: shop and street text, the default.
- Tier 3: painted posters and screens.

`tests/signs.test.ts` builds all nine areas and checks every sign geometrically (`src/game/World/districts/signAudit.ts`):

- **Buried or cut**: nine sample points across the sign face cast a ray straight out of it. Geometry within 0.1 m
  means the sign is buried in or cut by something. Geometry within 0.35 m means something stands right in front of it.
- **Legible**: eye points at 1.6 m on a 2 m grid over the whole walkable area are tested, skipping any inside a solid.
  A Tier-1 sign must be readable from at least one of them. That means at least 6 of its 9 samples are in clear line
  of sight past every visible mesh except glass, people and traffic, the face is at least 24 px tall at 720 px with
  the game's 68° camera, it is no more than 32° above eye level and 72° off-axis, and it is within 45 m.
- Tier 1 must be legible and unburied. No Tier-2 sign may be buried.

### What it found and what changed

| Sign | Problem | Fix |
| --- | --- | --- |
| SEA VIEW, SAGAR DARSHAN, NEPTUNE COURT, SHANTI NIWAS (Worli), SANDCASTLE (Juhu) | the Art Deco central fin stood 15 cm in front of the middle of the name board | the fin now rises from above the ground floor |
| SEA BREEZE (Juhu) | the bungalow's name plaque sat behind the compound wall's coping and shrubs | plaque raised above them |
| MONEYMETRICS (Powai) | the bank front's inner columns stood in front of both ends of the name | columns moved clear of the board |
| HACKERSPACE · TOWER B (Powai) | the name, at podium height, was hidden behind the lab pods from everywhere a visitor can stand | names of set-back blocks now run across the second floor |
| WORLI SEA FACE | its post ran up through the middle of the board | post moved behind the board |
| Andheri shop boards (all bays with awnings) | the awning's top edge cut across the bottom of the board | awnings hung lower, below the board |
| Andheri shop boards (deco blocks) | the central fin covered the middle bay's board | as for Worli |
| ARDUINO · RASPBERRY PI (Andheri) | the gateway pillar stood in front of the board's end | pillars moved onto the pavement |
| Fort Road door notices (THE JOURNEY SO FAR / EVENING CLASSES) | cut by the corner pilaster on every bay; fully buried in the Fort Research Institute's front wall | moved clear of the pilaster; not placed on the institute |
| FILM CITY · GOREGAON (back of the gate) | faces out of the walkable area | marked Tier 2 (the street-facing copy is Tier 1 and legible) |
| RADIO HOUSE · 1938 | period lettering high on the parapet, at most 13 px tall from anywhere legal | marked Tier 2; the building's shop board, RADIO REPAIR, is legible |

| Requirement | Status | Evidence |
| --- | --- | --- |
| Tier-1 signs legible from a walkable point | PASS | `tests/signs.test.ts`: 38 Tier-1 signs in all nine areas |
| No sign buried or cut (Tier 1 and 2) | PASS | same test; 216 Tier 1–2 signs checked |
| Sign validation tool | PASS | `signAudit.ts` with the test; `SIGN_REPORT=<file> npx vitest run tests/signs.test.ts` writes a per-sign report (best distance, on-screen height) |
| Readability on real devices | NOT TESTED | the check is geometric at 1280×720; no real phones or GPUs here |
| Exhibit boards (their own atlas) | NOT TESTED | they record placements too, but the test does not audit them yet |

Limits of the check (inferred): leaves count as occluders, but water, glass and people don't. Visitors move,
so one good viewpoint is enough. Text size is judged from the board's height, not the rendered glyphs.
