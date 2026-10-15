# CST–Fort production-overhaul baseline

Stable checkpoint: `233d3e6`; implementation branch: `feature/mumbai-production-overhaul`. The original repository is intact. Nine physical districts are explicitly gated on the street review.

## Inventory and preservation

Vite/TypeScript, React overlays, Three.js 0.180, Cannon-es 0.20. WorldEngine owns the first-person capsule, passenger camera, lifecycle/input handling and adaptive render scale. MumbaiStreet builds fourteen authored façades, props, sixteen-plus primitive articulated figures, a simple traffic loop and the Fort interior. StreetMaterials supplies six original canvas maps; TransitModel supplies lofted taxi/auto bodywork. Physics has coarse static box proxies and a flat ground plane. CityExperience retains nine destinations; only CST and Fort have physical stops. Film City is an HTML slideshow, not a walkable theatre.

Preserve verified portfolio data, FFprime/GSoC, CCIEeXpert, all seven project cases, résumé/contact, deep links, command palette, Quick View, fallback, touch controls, reduced motion, guide interactions, rides, meters, arrival/cancel and input pause behavior. No new portfolio metrics may be invented.

## Rendering and defects

ACES/sRGB, hemisphere fill, one warm directional sun with cached soft shadows, small practical lights, purple/orange sky, fog. No environment reflections, SSAO, genuine rigged characters or navigation mesh. Static geometry is instanced; signs are atlased. The road is narrow and populated, but every shop displays similar colored cartons. Repeated frontage rhythm, broad flat plaster, blunt cornices and uniform frames make the architecture visibly generated. Close-up humans have spherical joints and cylindrical limbs. Leaf clusters are angular and thin. Traffic shares a clock and pauses globally rather than obeying a crossing independently. Fort displays look like placeholder placards rather than research exhibits.

Baseline native screenshots and pose/renderer measurements are preserved in `screenshots/visual-rebuild/`; copied before images under `screenshots/production-overhaul/before/` have identical checkpoint content. These are our scene, not footage assets. The local Gulmohar reel is the supplied reference; live site access remains proxy-blocked.

## Baseline evidence

49 unit/physics tests pass across seven files on 2026-10-08 before existing scene changes. Full 34-case Chromium browser baseline started before modifying the active world; its final outcome is recorded in FINAL_VERIFICATION.md. Prior render captures show up to 82 draws / 179,028 triangles, eight textures and fourteen shader programs. Native cloud rendering was 0.4–1.0 FPS on SwiftShader: a severe software-rendering bottleneck, not evidence of laptop GPU performance. Full-motion shadow refresh and animated crowd need real hardware profiling.

## Dependency/security baseline

Runtime: cannon-es, react/react-dom, three. Development: Vite, TypeScript, Vitest, Playwright, React plugin/types and Three types. Exact resolved versions are in package-lock.json. `npm audit --json` on 2026-10-08 reports zero known advisories. This is a database result, not malware certification. No archive-format loaders, visitor models/shaders, remote execution or frontend secrets are used. External assets and advisory skill code require separate license/provenance review before use.
