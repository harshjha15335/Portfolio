# Credits and provenance

The campus architecture, road layout, car geometry, signs, decorative objects, favicon, and UI are original procedural/code-built assets for this portfolio. The exceptions are downloaded assets, each modified for this site:

- **Street people**: nine avatars from the [Microsoft Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox/tree/0943055db6ec570bcef9f2c8b41c9e5467c808f9) (Microsoft Research; original avatars by Rocketbox Studios), MIT licence, Copyright (c) 2020 Microsoft, modified as described in [docs/STREET_CAST.md](docs/STREET_CAST.md).
- **Parked scooter**: This work is based on "Vino" (https://sketchfab.com/3d-models/vino-2205f4e69bc64df3aab03c71ab9d7492) by minghauLoh (https://sketchfab.com/minghau) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Decimated, decal removed, colours moved into vertex data (`public/models/vehicles/scooter.provenance.json`).
- **Scanned surfaces**: "Asphalt 02", "Plaster Grey 04" and "Sandstone Blocks 08" by Rob Tuytel and "Concrete Pavers" by Amal Kumar, all from [Poly Haven](https://polyhaven.com), CC0 1.0. Resized and tone-matched (`public/surfaces/provenance.json`, [docs/STREET_ASSETS.md](docs/STREET_ASSETS.md)).

Licence notices are in `public/THIRD_PARTY_NOTICES.txt`. No other downloaded 3D models, stock textures, music, or video are bundled. This work takes the broad idea of an explorable portfolio and builds its own setting and implementation; it does not bundle another portfolio's scene or artwork.

Typography is self-hosted from `public/fonts/`, with local system-font fallbacks. The Latin WOFF2 files were obtained from Google Fonts and retain SIL Open Font License 1.1 notices: [Barlow Condensed — The Barlow Project Authors](public/fonts/OFL-barlow-condensed.txt), [DM Sans — The DM Sans Project Authors](public/fonts/OFL-dm-sans.txt), and [IBM Plex Mono — IBM Corp.](public/fonts/OFL-ibm-plex-mono.txt). Upstream license records checked on 5 October 2026 are [Barlow Condensed](https://github.com/google/fonts/blob/main/ofl/barlowcondensed/OFL.txt), [DM Sans](https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt), and [IBM Plex Mono](https://github.com/google/fonts/blob/main/ofl/ibmplexmono/OFL.txt). Runtime typography does not require the Google Fonts API.

Project facts and metric qualifiers are documented in [docs/SOURCES.md](docs/SOURCES.md). The résumé PDF was supplied for this portfolio and is served as candidate-provided content. Project links point to their respective repositories; this site does not redistribute those project codebases. The FFprime potential canvas is an explanatory softened point-multipole visualization, not a numerical benchmark. Financial and pipeline demonstrations use local illustrative inputs.

Direct package license identifiers were checked against installed package metadata on 5 October 2026:

| Package | License | Role |
| --- | --- | --- |
| React / React DOM | MIT | UI |
| Three.js | MIT | 3D rendering |
| cannon-es | MIT | Physics |
| Vite / @vitejs/plugin-react | MIT | Development and build |
| TypeScript | Apache-2.0 | Type checking |
| Vitest | MIT | Unit/integration tests |
| Playwright / @playwright/test | Apache-2.0 | Browser verification |
| @types/react / @types/react-dom / @types/three | MIT | Type declarations |

Package license texts remain in `node_modules/<package>/LICENSE` (some packages use `LICENSE.txt`). `package-lock.json` records the installed dependency graph. Consult those notices and transitive package licenses when redistributing bundled dependencies. No blanket license is assigned here to the candidate's résumé or external linked projects.
