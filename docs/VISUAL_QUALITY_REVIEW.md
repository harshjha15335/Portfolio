# CST–Fort first-person art review

**Expansion gate: not approved.** Code/test success does not establish the requested final art standard or laptop performance. The new systems and captures are concrete reviewable improvements on the dedicated branch; they must not be advertised as a finished nine-district city.

## Evidence and comparison method

Stable233d3e6native screenshots are retained in `screenshots/production-overhaul/before/`. New native captures use identical spawn/station/shop/Fort/return poses, FOV68, exposure1.12, eye1.68m, frozen-motion state and full desktop render scale. Sky, illumination/materials and model topology are deliberately changed; camera placement is held. New NPC/shop/vegetation/crossing/institute close-ups expose details that an aerial view would hide. There are no exact old close-ups for these newly standardized poses; matching street images provide the available comparison.

The local supplied Gulmohar reel is inspected as reference. The live site and asset source endpoints remain network-blocked, so no live behavior, source code, pipeline or hardware statistics are inferred. Native scene files are our work; no reel footage is incorporated.

## Subjective internal rubric

Ten0–10criteria, maximum100. This is an internal judgment, not a computer-vision metric. Scores reflect manual inspection of all 28 iteration-4 native/mobile images and selected original close-ups; numerical totals cannot override the visible defects. The final 28 on-demand desktop/mobile images have also been manually inspected, including the native NPC close-up; browser traversal has passing evidence for all 35 cases with one software-timeout retry. The art gate remains failed.

| Criterion | Before | Current | Evidence / remaining issue |
|---|---:|---:|---|
| Architecture identity and proportions |6|7|Heritage/chawl/Art Deco/commercial frontage retained; recurring bay rhythm still too apparent|
| Openings and architectural depth |6|8|Actual cached wall cutouts, inset glass and physically shaded reveals; balcony/utility layers visible|
| Surface/material finish |4|6|Original plaster/stone/fabric maps, restrained environment reflection and subtle road wear; large planes still simple|
| Contextual street density |6|7|Books/canisters/folded textiles distinguish frontage stock; station stands clear moving lanes; purposeful utility placement|
| Outdoor/interior lighting |5|7|Neutral atmospheric sky, warm sun/cool shade, correct initial shadows, optional restrained AO; cloud GPU art judgment remains limited|
| Human modeling and animation |3|6|Original16-bone skins, continuous garment surface and gait/idle/sitting; close faces/hands/hairstyles remain simplified|
| Vegetation silhouette |4|5|Folded double-sided leaf clusters and authored branching improve density; close leaves/canopy still visibly procedural|
| Pedestrian/traffic behavior |3|6|Recast crowd destinations/separation and signal approach, curved traffic/spacing/yielding; full dynamic collision not implemented|
| Taxi/auto presentation |5|5|Preserved shaped bodywork, open auto/cabins and animated wheels; existing primitive drivers and sparse interiors need modeling polish|
| Fort/recruiter destination |5|7|Clear institute/research terminal, original field schematic, journals and noticeboard; no invented results; still a small authored research room|
| **Total** |**47**|**64**|**Improvement is reviewable; this score does not pass the desired final-art gate.**|

## Three worst defects and action taken

1. **Primitive-looking people at close range.** Replaced separate cylinder/sphere body parts with weighted skins, authored anatomy/head profiles and an original continuous garment surface. Face details now share the body draw. The first close-up exposed shoulder/sleeve joins; they were removed in a second modeling iteration. Remaining: better hands, faces, hair and clothing detail, plus real geometric/skeletal LOD. Individually licensed Quaternius source verification is blocked; no unverified substitute is imported.
2. **Repeated, shallow-looking frontage.** Added cached through-openings and complex static BVH visibility, pushed glazing into real reveals, retained layered rails/cornices/utilities and differentiated contextual shelf goods. Remaining: more compositional storefront variation and less obvious repetition; current primitive props/scooters are still visible. These should be polished on this street before cloning grammars elsewhere.
3. **Sparse research interior / weak atmosphere.** Removed the purple sky, fixed initial shadow refresh, added restrained reflection response and a selectable AO preset. Fort gained a clearly labeled point-charge schematic, journal shelves and research noticeboard, while keeping its entrance/terminal route. Remaining: more deliberate institute entrance composition, refined material aging and useful research presentation details.

## Screenshot acceptance coverage

CST spawn/street, Fort street/doorway/frontage/interior, this street's shop/market frontage, crossing junction, NPC/shop/vegetation close-ups, taxi boarding/passenger view, auto passenger view and mobile/fallback are captured in the final 28-image set at 1440×900 and 1920×1080, with phone evidence at 390×844. Film City remains the preserved HTML theatre; the fallback image is explicitly labeled. A physical cinema interior and the other seven district streets are deferred by the vertical-slice rule, not represented with fabricated evidence.

## Decision

Keep the validated systems and verified existing portfolio behavior. Do not expand to nine districts or deploy as a completed visual overhaul. The next art pass should address the documented close-up weaknesses after source access is available; laptop GPU traversal must then establish frame-time stability. The user’s desired reference-level finish is **still incomplete**, stated separately from build/test results.
