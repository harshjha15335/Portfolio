# Harsh Jha — Mini Mumbai

An original, compact portfolio city inspired by Mumbai's station culture, kaali-peeli taxis, autos, street markets, sea-facing promenades and film culture. It is a stylized diorama built to tell an engineer's story, with short routes and readable silhouettes rather than a realistic city map.

The existing React portfolio, Three.js renderer, Cannon physics, case studies, hash navigation, command palette, Quick View and accessibility foundation are retained. The city adds walking, guided transport, nine destinations, moving traffic, pedestrians, local guides and a text-led cinema.

## Run

Requires Node.js 22.12+ (or a compatible newer version) and npm.

```sh
npm ci
npm run dev
npm test
npm run build
```

Development uses port 5173. `npm run build` includes TypeScript checking and produces `dist/`. `npm run preview` serves that production output.

The default browser configuration uses Microsoft Edge. For the cloud's installed Chromium:

```sh
npm run test:browser -- --config playwright.cloud.config.ts
```

Set `CHROMIUM_PATH` if the executable is elsewhere. The override enables software WebGL, while leaving the default Edge configuration available. Browser tests capture some screenshots in `docs/screenshots`; onboarding's ignored runner starts from `.sites-runtime/cloud-onboarding` to keep generated evidence separate:

```sh
bash .sites-runtime/cloud-onboarding/run-browser.sh
```

## Nine stops

| Destination | Experience |
| --- | --- |
| CST Arrival Square | Welcome, orientation, introduction and city directions |
| Fort Open Source Labs | GSoC, QC-Devs / Theochem and FFprime research |
| BKC Systems House | CCIEeXpert internship and enterprise security tooling |
| Andheri Skill Bazaar | Skill clusters with links to project evidence |
| Powai Product District | NORTHSTAR, RECO, MoneyMetrics, Meeting Intelligence and RideFlow |
| Dadar Junction | Education, projects, open source and internship journey |
| Worli Signal Deck | Achievements and engineering metrics with source qualifiers |
| Juhu Studio | About, education, résumé, GitHub, LinkedIn and contact |
| Film City Talkies | Nine-scene story theatre with manual and autoplay controls |

Each district has an original low-poly silhouette, accent color, clickable scene target and a guide. Guide dialogue is curated, deterministic copy, not a chatbot. The surrounding city includes a clock-tower arrival station, research colonnade, office towers, skill stalls, product skyline, miniature local train, signal deck, seaside studio, cinema marquee, chai/vada-pav kiosks, promenade lights and a small sea-link silhouette.

## Explore

| Control | Action |
| --- | --- |
| W / A / S / D or arrows | Walk; drive when Take the Wheel is selected |
| Take the Wheel / Explore on Foot | Switch between walking and the retained physics vehicle |
| Space | Handbrake while driving |
| E | Talk to a nearby guide or board a nearby taxi/auto stand |
| R | Return to CST |
| M | Open the city directory |
| Escape | Close a dialog; open the world menu |
| Ctrl+K / Cmd+K | Search projects, city stops, skills and commands |
| Pointer / touch | Select a destination or transport stand; orbit the city on mobile |

On mobile, guided travel and touch selection replace manual walking/driving. Quick View remains available for fast scanning and accessible navigation.

### Transport

Multiple taxis and autos circulate on the painted loop. Click a waiting vehicle, press E near its stand, or use Hail Taxi / Hail Auto to board a ride. The vehicle pulls over before boarding; reduced motion skips pickup animation. Choose any of the nine stops. A dedicated ride vehicle follows sampled radial connections and a short loop arc, with a damped chase camera. The meter tracks model distance, elapsed simulation time and a decorative story fare; there is no payment or real-world fare claim. Skip travel or exit at any time. The map offers both ride booking and immediate fast travel, and tracks the current visitor/ride position.

Ambient vehicles are scenery rather than collision obstacles. Guided rides use paths instead of the manual vehicle's tire physics. Pedestrians use shared instanced primitives and simple looping gait animation. Reduced motion freezes ambient animation and makes selected rides arrive directly.

### Talkies

Enter Film City Talkies and select Take a Seat. A dim theatre, illustrated seat silhouettes, projector glow and a large typographic screen present nine scenes. Previous, Next, scene selection and opt-in Autoplay control the story; playback stops at the final scene. Escape exits. No audio autoplays. Reduced motion starts in manual mode.

## Content and architecture

- `src/data/city.ts`: nine named destinations, spatial layout, guides and sourced journey copy.
- `src/game/World/Campus.ts`: shared primitive builders, colliders, city scenery, instancing, guides, pedestrians and ambient traffic. The earlier reusable workshop builders remain available.
- `src/game/World/transit.ts`: sampled route construction, distance interpolation and decorative meter calculations.
- `src/game/World/TransitModel.ts`: original taxi/auto silhouettes, merged by material to reduce draw calls.
- `src/core/WorldEngine.ts`: renderer, fixed-step manual physics, walking, rides, cameras, proximity, picking, pause/resume and resource disposal.
- `src/ui/CityExperience.tsx`: directory, meter, district content and theatre.
- `src/app/App.tsx`: routing, content state, case studies, command palette, Quick View and accessible dialogs.
- `src/data/projects.ts`, `experience.ts`, `skills.ts`, `portfolio.ts`: the existing portfolio source of truth.

`#/place/fort` and other district IDs open shareable guide experiences. Existing `#/project/<id>` links still open case studies, including after reload. Project demonstrations are explanatory local models; they do not connect to live financial accounts, project APIs or AI providers.

Content provenance lives in [docs/SOURCES.md](docs/SOURCES.md). Keep résumé-reported metrics, upstream test counts, repository audits and seeded fixtures explicitly distinct. No new dates, production outcomes or unsupported personal claims have been invented. Static city labels are environmental art; sourced detail is in the HTML experiences and case studies.

## Fallback and limitations

`/?webgl=off#world` exercises the Quick View fallback. District guides and the theatre remain usable without WebGL. `/?debug#world` opens renderer statistics and manual-vehicle tuning controls. The world caps pixel ratio, shares primitive geometry, instances repeated scenery/pedestrians, merges transit models by material and pauses movement during dialogs or page hiding. Fonts are self-hosted with OFL licenses.

Models are intentionally original procedural art, not final realistic assets. Pedestrians and guides are simple stylized figures. Rides have an exterior follow camera rather than detailed interiors; ambient traffic is path-based. There is no audio, multiplayer or full city simulation. Automated coverage uses desktop and simulated phone Chromium; real touch devices, other browsers, assistive technology and hardware GPU performance need separate evaluation. Software-rendered cloud frame rates are not representative of a modern laptop GPU.

## Deployment

Deploy `dist/` to a static host. Existing Netlify and Vercel settings remain usable. GitHub Pages requires a suitable Vite `base` and public asset URLs for a repository subpath; the default targets a domain root. Hash routes need no server rewrite for individual case studies.

Before public deployment, replace the canonical-origin placeholder in `public/sitemap.xml`, configure HTTPS/custom-domain metadata, and add canonical and Open Graph URL information. Hash routes are client state; independent social previews would require prerendered pages. See [CREDITS.md](CREDITS.md) for attribution and [docs/CITY-QA.md](docs/CITY-QA.md) for current validation.
