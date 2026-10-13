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

Main-pass cost at each district's stop (SwiftShader, 1440×900, cached shadow map, from
`scripts/capture-districts.mjs`):

| District | Draws | Triangles |
| --- | --- | --- |
| BKC | 39 | 116k |
| Andheri | 57 | 221k |
| Powai | 37 | 105k |
| Dadar | 49 | 148k |
| Worli (sea wall) | 54 | 182k |
| Juhu (beach) | 51 | 140k |
| Film City | 40 | 111k |

All are inside the street's 110-draw / 230k-triangle budget. Texture and program counts are higher
than the street's ceilings (47–69 textures, 34–39 programs) because each skinned person carries a bone
texture and `renderer.info.programs` keeps the CST street's compiled programs after leaving it.

## Review

```sh
npm run dev
node scripts/capture-districts.mjs              # all review poses → docs/screenshots/city-districts
node scripts/capture-districts.mjs juhu-beach   # one pose
node scripts/ride-check.mjs                     # CST → BKC → Andheri, map jump to Worli, Worli → Juhu → Fort
```

Review poses live in `districtViews` (`bkc-boulevard`, `andheri-lane`, `powai-lake`, `dadar-maidan`,
`worli-seawall`, `juhu-beach`, `filmcity-shoot`, …) and are reachable with the `street-review-view` event.
