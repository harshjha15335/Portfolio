# Mumbai implementation report

Tracks work done against the master brief (`Mumbai_Portfolio_Claude_Code_Mega_Prompt.pdf`, 14 October 2026).
Each section separates what was **implemented and tested**, what is **proposed**, and what is **blocked**.

## 1. Powai flagship labs (brief §9)

Base: `feature/cst-fort-rendering-optimization` at `159d682` (all earlier PRs merged).

### Implemented and tested

Each Powai project now opens a working demo inside its case study. The same case study is reached from the
Powai district panel (in the world), from Quick View and from the Ctrl/Cmd+K palette, so no demo is hidden
behind 3D navigation. Every demo runs a TypeScript port of the project's own logic, pinned to a commit, and
links to the exact source.

| Facility | What the visitor does | Ported from (pinned) | Port |
|---|---|---|---|
| NORTHSTAR Trading Floor | Edits a proposal (symbol, side, size, confidence, quote age, price drift, mode, kill switch, unknown broker outcome) and watches all 29 `RiskEngine.evaluate` checks re-run; only a fully passing proposal reaches the paper broker and the paper ledger. Mock closes with SMA 20/50 chart. | `NORTHSTAR@10e96d3` `trading-platform/backend/app/{risk,schemas,market_data,quant}.py` | `src/projects/northstar.ts` |
| MoneyMetrics Finance Office | Makes one category's week unusual and sees the anomaly rule and budget alerts fire; parses a bank SMS. | `MoneyMetrics@ffd00ae` `js/dashboard.js`, `js/sms.js` | `src/projects/moneymetrics.ts` |
| Meeting Intelligence Conference Room | Sends a valid or malformed `POST /api/meetings` and sees the 201 or `VALIDATION_ERROR` envelope; clicks citations to highlight transcript lines; changes action-item status and reminder-job date to see reminder outcomes. | `meeting-intelligence-service@ea732a9` validators, `AI_APPROACH.md`, reminder service, overdue query | `src/projects/meeting.ts` |
| RideFlow Transit Depot | Picks endpoints and a preference; sees `calculate_score` breakdowns and `rank_routes` order, the 400 response when an endpoint is missing, and the route path. | `rideflow@83167f8` `routing_engine.py`, `main.py`, `data/routes.json` | `src/projects/rideflow.ts` |
| RepoLens Inspection Office | Types a question about RepoLens's sample calculator repo; sees detected intent, fusion weights, tokens, BM25, dense and RRF rankings, and the retrieved code chunk. | `RepoLens@28fef67` BM25 index, deterministic local embedding (incl. MD5), `QueryAnalyzer`, `_rrf_fusion` | `src/projects/repolens.ts`, data from `scripts/projects/repolens_reference.py` |

UI: `src/ui/FlagshipLab.tsx`, `src/styles/flagship.css`; wired in `src/ui/CaseStudy.tsx` and the Powai panel in
`src/ui/CityExperience.tsx`. RepoLens was added to `src/data/projects.ts` from its README (evaluation figures
quoted with the README's own "one small dataset" qualifier).

Tests:
- `tests/flagship.test.ts` (21 tests). RepoLens rankings and scores are compared with output produced by the
  repository's own Python classes, which the reference script loads from the checkout and runs unchanged. MD5 is
  checked against known digests, and the embedding against the Python vector.
- `tests/browser.spec.ts` › "Powai flagship labs run their ported project logic" drives every lab in Chromium.
- `tests/city.spec.ts` now expects six Powai facilities.

### Accuracy notes found while porting (the exhibits state these instead of hiding them)

- MoneyMetrics flags anomalies with a **40%-over-weekly-average threshold** (average must exceed ₹500), not a
  z-score as the brief assumed.
- MoneyMetrics' SMS date regex can match digits before the real date (e.g. `XX12 on 05-…`). The port keeps the
  behaviour, and the exhibit's default SMS doesn't trigger it.
- RideFlow's backend ignores the endpoints beyond requiring them; every search ranks the same three sample routes.
  `routes.json` stores `score: 78` for RF-R1, but `calculate_score` recomputes 51.8, so the API's recommended order
  puts RF-R3 first.
- Meeting Intelligence analysis needs Gemini. The exhibit never calls a model; its analysis is an example written in
  the service's `MeetingAnalysisResult` shape, labelled as such, and the tests check that every citation points at a
  real transcript line.
- The NORTHSTAR `ledger_consistent` check is reconstructed by replaying paper fills (average cost). The repository
  reconciles its SQLite ledger instead.

### Blocked

- **ASTFLOW Engineering Lab**: no ASTFLOW repository or document exists among the 19 repositories on
  github.com/harshjha15335 (checked 14 October 2026). The Powai panel shows it as planned and blocked, with no
  invented demo. Unblock: point to the source.

### Not yet done for Powai

- The labs are HTML panels opened from the district panel. Purpose-built 3D interiors (trading desks, conference room,
  depot) and Powai-specific NPC roles are not built yet (brief §9 physical settings, §14.2).

### Screenshots (Chromium, 1440 px; phone at 390 px)

- [Powai district panel](screenshots/powai/powai-district.png)
- [NORTHSTAR, kill switch engaged](screenshots/powai/lab-northstar.png)
- [MoneyMetrics, unusual food week](screenshots/powai/lab-moneymetrics.png)
- [Meeting Intelligence, citation selected](screenshots/powai/lab-meeting-intelligence-service.png)
- [RideFlow](screenshots/powai/lab-rideflow.png) · [RideFlow at 390 px](screenshots/powai/lab-rideflow-390.png)
- [RepoLens, symbol lookup](screenshots/powai/lab-repolens.png)

### Commands run

- `npx vitest run`: 135 passed (21 files).
- `npx tsc --noEmit`: clean. `npm run build`: succeeds (existing large-chunk warning only).
- `npx playwright test -c playwright.cloud.config.ts` on the 17 quick-view, case-study, city-panel and phone tests: all pass.
  World-rendering tests (walking, rides) were not re-run: this change does not touch the renderer, and under
  SwiftShader each takes minutes.

## 2. Fort coordinate workstation (brief §6, interaction B)

### Implemented and tested

The Fort research exhibition now includes a coordinate workstation. It appears in the Fort district panel and in
the FFprime case study. The visitor edits a traceless Cartesian quadrupole and a dipole, and then sees:
- the real spherical components with the formula for each one;
- the round-trip error back to Θ;
- the angular pattern of the quadrupole potential;
- the potential at a chosen point, computed both in Cartesian form and directly from the spherical components.

Breaking tracelessness reproduces FFprime's own `ValueError` text.

- Port: `src/research/stone.ts`, from `theochem/ffprime@02ac79d` `ffprime/electrostatics/spherical.py`
  (Stone convention, commit `d160e72` by harshjha15335) and `cartesian.py` `quadrupole_potential`.
- UI: `src/ui/CoordinateWorkstation.tsx`, mounted in `src/ui/ResearchExhibition.tsx`.
- Tests: `tests/stone.test.ts` compares conversions and potentials with values printed by the upstream Python
  module (to 1e-12) and checks round trips and rejections. A new browser test,
  "Fort coordinate workstation converts, agrees and refuses a non-traceless tensor", covers the UI.
- Screenshots: [workstation](screenshots/fort/fort-workstation.png),
  [non-traceless tensor refused](screenshots/fort/fort-workstation-error.png).

### Not yet done for Fort

- Interaction C (researcher NPC with evidence-grounded dialogue) still uses the existing district guide text.
- The lab, simulation room and archive interiors are not built.
