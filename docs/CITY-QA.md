# Mini Mumbai validation

The redesign retains the renderer, manual vehicle physics, routing, case studies, command palette, Quick View, responsive layout and native-dialog accessibility. Nine new city destinations share one data model and reuse the existing portfolio evidence.

## Current checks

- Production build and TypeScript checks pass.
- 38 unit tests pass across five files.
- All 29 Chromium browser tests pass (full final run: 5.2 minutes on the cloud software renderer).
- City physics checks cover all nine arrival points, every stop-to-stop transit route, selectable guides/stands, meter arithmetic and exact path endpoints.
- Browser coverage includes the retained portfolio journeys, mobile layouts, keyboard focus, résumé handling, hash links, driving and reset, WebGL fallback/context loss, both vehicle types, natural and skipped arrival, all nine guides, skill evidence, story controls, reduced-motion rides, walking/map position, ride cancellation and theatre autoplay/pause.
- Visual evidence was captured for the home, city, map, theatre and phone layout in the ignored `.sites-runtime/cloud-onboarding/city-evidence` directory.

## Deliberate scope

The geography is an invented compact loop, not a literal Mumbai reconstruction. Original procedural geometry supplies all city, vehicle, pedestrian and guide art. There are no downloaded city models or uncredited creator assets. Repeated scenery and people are instanced; vehicle parts are merged by material.

Guide dialogue is scripted. Pedestrians and ambient traffic are decorative, path-based motion. Guided rides use an exterior follow camera and a decorative fare; no payment, real-world pricing or detailed vehicle interior is provided. Manual driving continues to use real colliders and fixed-step Cannon physics. Mobile uses orbit/tap/guided travel.

No audio is enabled. Theatre playback is text-led and opt-in. Quick View and district content remain usable without WebGL. Source qualifiers and original portfolio links are preserved; no production metrics or dates have been invented.

Chromium software rendering reported a representative diagnostic sample of 96 draw calls, 22,722 triangles and 56 textures. The cloud renderer is SwiftShader; its frame-rate sample is not a hardware-GPU benchmark. Real phones, other browser engines and assistive-technology users still need separate checks.
