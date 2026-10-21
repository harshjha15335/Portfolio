# City districts

The world is nine stops on one map. CST Arrival Terminus and Fort Open Source Hall share the
original Fort Road street (`MumbaiStreet`). The other seven are separate walkable streets built by
`src/game/World/districts/`:

| Zone | District | Street | Portfolio content | Look |
| --- | --- | --- | --- | --- |
| 1 | BKC Systems Office | BKC · G Block | CCIEeXpert internship | Glass towers, fountain plaza, palms, security booth |
| 2 | Andheri Tech Bazaar | Tech Bazaar Lane | Skills / stack | Electronics shopfronts, blade signs, gateway arch, tarp stalls, overhead cables |
| 3 | Powai Builder's District | Lakeside | Projects, demos, GitHub | Lake promenade, railing, hills, Hiranandani-style towers, lakeside café |
| 4 | Dadar Junction | Ranade Road | Education / timeline | Chawls with laundry, station board and foot-over bridge, flower market, maidan cricket |
| 5 | Worli Proof Deck | Worli Sea Face | Achievements | Sea wall, tetrapods, moving sea, Sea Link on the horizon, deco blocks, bhutta stall |
| 6 | Juhu Studio | Juhu Tara Road | About, résumé, contact | Beach with surf, chowpatty stalls, palms, the studio bungalow |
| 7 | Film City Talkies | Film City · Goregaon | Journey theatre | Studio gate, Talkies marquee and posters, sound stages, chawl and village sets with a live shoot |

## Layout

* Each district sits `DISTRICT_SPACING` (600 m) further along X and reuses Fort Road's local frame:
  road along Z, pavements at |x| ≈ 5, walkable box x ∈ [−19.5, 19.5], z ∈ [−64, 21]. The road runs on
  into the haze at both ends, so a district reads as part of a longer street.
* `cityZones`, `zoneAt` and `zoneIndexAt` in `streetLayout.ts` map world X to a zone. District stops are
  added to `streetStops`, so the existing ride, directory and review code addresses them like Fort.
* A ride to another district is two legs (`cityRideLegs`): the vehicle drives off the current street,
  the world cuts to the destination district, and it drives up to the stop. The meter adds the map
  distance between the two stops at the cut.

## Streaming and budget

* Only the active zone is visible and simulated. `CityDistricts.prepare` builds the destination when a
  ride starts; `activate` disposes every other district (physics bodies, geometry, materials, skeletons
  and the sign atlas). The sun, its shadow target and the sky move with the zone origin.
* `DistrictKit` merges every static primitive into one mesh per surface (plaster, stone, glass, …),
  using clones of the street's procedural materials with world-metre UVs and vertex colours.
  Colliders become cannon bodies plus the BVH used for camera and interaction queries.
* Vehicles and props are single-draw vertex-coloured meshes (`ColorMesh`). Signs are drawn into one
  2048² canvas atlas per district (`SignAtlas`, shelf-packed) and drawn in one call.
* People are the street's licensed Rocketbox cast (`DistrictCast`). Each outfit maps to cast members
  (sari → clerk, shopper, office woman; vendor → chai vendor, taxi driver, host, commuter; …) and
  neighbours never repeat a member. Every figure is a `SkinnedMesh` bound to one combined skeleton
  built from the cast's walk, idle, talk and sit drivers, so a whole district shares a handful of
  bone textures. Far figures use a meshoptimizer-simplified index (20%). Until the cast has loaded,
  the procedural `CityFolk` bodies stand in and are swapped out by `CityDistricts.adoptCast`.
  `Crowd` handles walkers, idlers (talk, sit, sell, wave, bowl, bat) and distance LOD.
* `LaneTraffic` runs BEST buses, hatchbacks, sedans, SUVs, kaali-peeli taxis, autos, bikes, cycles,
  tempos and handcarts on two lanes, yielding to the visitor and the ride camera.

### Realism and density pass

* `FacadeTexture` paints one shared 1024² apartment façade (frames, grills, curtains, box ACs, chajjas,
  run-off). Background blocks and the skyline use it, tinted per building by vertex colour.
* `DistrictKit` subdivides big walls and bakes contact shadow at wall bases, shade under ledges and
  large grime blotches into vertex colours.
* The skyline mixes mid-rises, slab blocks and 55–100 m towers with crowns, and every district has a
  tower under construction with its crane. Blocks carry water tanks, stair heads, dishes and masts.
* `streetClutter` lines each kerb with utility poles and sagging cable bundles, transformers, bins,
  rubbish bags, a paan kiosk and crates. `District.streetLife` adds chatting knots of people and
  rows of parked scooters and motorcycles (merged into one draw).
* Density follows the graphics preset through `setCityDensity`: crowd ×0.9 / 1.6 / 2.6 and traffic
  ×1 / 1.7 / 2.4 for Low / Medium / High, relative to the authored lists. A district keeps its
  density until it is rebuilt on the next visit.
* LOD keeps that affordable: cast figures drop to the simplified index past 12 m and hide past 46 m
  (`CAST_LOD`), and traffic switches to a low-segment vehicle past 22 m. Parked cars use the
  low-segment build.

### Bodies and nature

* Cars are lofted (`CarBodies.ts`): the shell is swept through superellipse sections along a side
  profile (bonnet, windscreen, roof, rear glass, boot), with a tinted glasshouse, thin pillars, shut
  lines, mirrors, bumpers and lathe-turned tyres with spoked rims (`ColorMesh.wheel`). Autos,
  scooters, motorcycles and buses use the same `sweep`/`arch` lofts instead of stacked boxes.
* `nature.ts` builds vertex-coloured geometry on the kit's merged surfaces, so it adds no textures:
  rain trees with a dome of noise-shaped leaf clumps over a forked trunk, coconut palms with
  feathered drooping fronds, noise-ridged hills (Powai, Film City) and the Dadar maidan's worn dust,
  grass patches, walking paths and rolled pitch.
* Skyline towers carry floor ledges, fins and a podium (`towerRelief`).
* Lakes and the sea share one 256² canvas ripple normal map (cloned per body, one GPU texture) that
  scrolls, on a glossy, slightly metallic surface that picks up the sky.

Main-pass cost at each district's stop on Medium (SwiftShader, 1440×900, cached shadow map, from
`scripts/capture-districts.mjs`):

| District | Draws | Triangles | Textures |
| --- | --- | --- | --- |
| BKC | 68 | 219k | 28 |
| Andheri | 56 | 227k | 30 |
| Powai | 59 | 143k | 31 |
| Dadar | 70 | 220k | 31 |
| Worli | 75 | 211k | 31 |
| Juhu | 69 | 138k | 31 |
| Film City | 54 | 175k | 31 |

Every review pose is inside the street's 110-draw / 230k-triangle / 32-texture budget (worst:
Andheri stop 227k, Dadar maidan 81 draws). Textures stay low because the cast shares one skeleton
per district, and the CST street's per-person bone textures are released while a district is active.
Programs are 43–45, over the street's 26: `renderer.info.programs` is cumulative and keeps the CST
street's compiled programs (about 35 on their own with the Rocketbox cast).

### Cars and BEST buses

* Every district's traffic list mixes private cars (hatchbacks, sedans, SUVs) with BEST buses. Two
  thirds of buses are the red double-decker; the rest are the newer single-deck AC bus.
* CST–Fort gets through traffic of cars and buses (`FortRoadTraffic.ts`) on the street's own two
  lanes. It stops for the pedestrian green at the zebra. It queues behind the street's taxi/auto loop,
  and the loop queues behind it through `MumbaiStreet.extraTrafficObstacles`. It is held to
  about 0.35× the district density, because the CST street was already close to its triangle budget
  (229.6k at `cst-traffic-south`).

## Review

```sh
npm run dev
node scripts/capture-districts.mjs              # all review poses → docs/screenshots/city-districts
node scripts/capture-districts.mjs juhu-beach   # one pose
node scripts/ride-check.mjs                     # CST → BKC → Andheri, map jump to Worli, Worli → Juhu → Fort
```

Review poses live in `districtViews` (`bkc-boulevard`, `andheri-lane`, `powai-lake`, `dadar-maidan`,
`worli-seawall`, `juhu-beach`, `filmcity-shoot`, …) and are reachable with the `street-review-view` event.
