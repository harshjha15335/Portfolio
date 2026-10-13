# City districts

The world is nine stops on one map. CST Arrival Terminus and Fort Research Institute share the
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
* People (`CityFolk`) are the street's skinned human with garments skinned to the same bones and merged:
  sari, salwar, kurta, school uniform, worker, dabbawala, Koli, jogger, elder, vendor, office, shirt.
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
* LOD keeps that affordable: people switch to a ~300-triangle body on the same bones past 20 m,
  and traffic switches to a low-segment vehicle past 32 m.

Main-pass cost at each district's stop on Medium (SwiftShader, 1440×900, cached shadow map, from
`scripts/capture-districts.mjs`):

| District | Draws | Triangles |
| --- | --- | --- |
| BKC | 81 | 170k |
| Andheri | 77 | 221k |
| Powai | 66 | 126k |
| Dadar | 89 | 196k |
| Worli | 84 | 181k |
| Juhu | 66 | 111k |
| Film City | 81 | 175k |

All are inside the street's 110-draw / 230k-triangle budget. Texture counts (84–104) are well above
the street's 32: each skinned person carries its own bone texture, so the count tracks the crowd.
Programs are 35–39 because `renderer.info.programs` keeps the CST street's compiled programs.

## Review

```sh
npm run dev
node scripts/capture-districts.mjs              # all review poses → docs/screenshots/city-districts
node scripts/capture-districts.mjs juhu-beach   # one pose
node scripts/ride-check.mjs                     # CST → BKC → Andheri, map jump to Worli, Worli → Juhu → Fort
```

Review poses live in `districtViews` (`bkc-boulevard`, `andheri-lane`, `powai-lake`, `dadar-maidan`,
`worli-seawall`, `juhu-beach`, `filmcity-shoot`, …) and are reachable with the `street-review-view` event.
