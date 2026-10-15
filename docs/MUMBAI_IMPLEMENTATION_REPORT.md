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

### ASTFLOW (unblocked 14 October 2026, see §4)

The first pass found no ASTFLOW repository under harshjha15335. Harsh pointed out it is public: it lives at
`ANUJ-DESHPANDE/ASTFLOW`, a team repository. Its lab is described in §4.

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

## 3. Andheri Tech Bazaar skill shops (brief §8)

### Implemented and tested

The old skill stalls (a chip list that filtered case studies) are replaced by the brief's five shops. Each skill opens
**what it does → where Harsh used it → demonstration → evidence**, with every "where" link pinned to a commit. Each
shop has a bench underneath that runs real logic from those repositories:

| Shop | Bench | Checked against |
|---|---|---|
| A. Language Lane | Verbatim excerpts in Python (FFprime `spherical.py`), JavaScript (MoneyMetrics `dashboard.js`) and TypeScript (Meeting Intelligence `meeting.validator.ts`), each beside a live run of the same logic. | Existing ports (`stone.ts`, `moneymetrics.ts`) and the recorded Zod results below. |
| B. Frontend Studio | This site's own `RideMeter` component on a bench with its `RideStatus` props exposed and its callbacks logged. | The component is the one used during rides (moved to `src/ui/RideMeter.tsx`, unchanged). |
| C. Backend Workshop | `POST /api/meetings` through Meeting Intelligence hop by hop (helmet → cors → `express.json` → trace id → logger → `authenticate` → `validate(createMeetingSchema)` → controller → service → repository → envelope), with the status, `x-trace-id` and body that come back. | `scripts/projects/meeting_request_reference.mjs` bundles the repository's own middleware, validator, controller, service and error modules with esbuild, runs them on the locked Express 4.22.2 / Zod 3.25.76 / jsonwebtoken 9.0.3 / body-parser 1.20.5, and records 14 real HTTP responses. Only config, the logger and the Prisma repository are stubbed. |
| D. DevOps Garage | RootCause CI + gated Azure deploy, RepoLens CI, Meeting Intelligence's multi-stage Dockerfile and this portfolio's own checks, step for step. Clicking a step makes it fail and shows what is skipped and whether the deploy would run. | GitHub Actions defaults the files rely on (steps stop at the first failure; jobs without `needs` are independent; `workflow_run` + `conclusion == 'success'`). Nothing is executed. |
| E. AI Integration Lab | Paste a model reply and see NORTHSTAR's guard (fence cleanup → `TradeProposal` schema → `DecisionAgent` checks) next to Meeting Intelligence's (`JSON.parse` → `validateAnalysis` repairs). | `scripts/projects/northstar_guard_reference.py` runs 29 replies through NORTHSTAR's real Pydantic model and `DecisionAgent` (loaded from the checkout unchanged); the port matches every outcome, field location, error type and message. |

Code: `src/data/shops.ts`, `src/ui/AndheriShops.tsx`, `src/styles/andheri.css`, `src/projects/{aiguard,meetingRequest,pipelines,excerpts}.ts`,
fixtures in `src/projects/data/{northstar-guard,meeting-requests}.json`.

Tests: `tests/andheri.test.ts` (52 tests: every recorded NORTHSTAR and HTTP case, the pipeline rules, and the shop data);
`tests/city.spec.ts` › "Andheri shops show evidence and run each bench" drives all five benches in Chromium, and the
existing skill-evidence test now goes through Frontend Studio.

### Accuracy notes found while building

- **Java and C++** are on the résumé but in no public repository. Their cards say so and show no demonstration.
  **SQL** evidence is a Prisma-generated PostgreSQL migration; no hand-written queries were found, and the card says so.
- **Meeting Intelligence, missing token**: the service answers `Invalid or expired token`, not its intended
  `Missing or invalid authorization header`. `AppError`'s constructor resets the prototype to `AppError.prototype`,
  so `instanceof UnauthorizedError` in `authenticate()` never matches. Recorded from the real code; the exhibit shows it.
- **Meeting Intelligence, malformed JSON**: `express.json()` runs before the trace-id middleware and `errorHandler` only
  knows `AppError` and `ZodError`, so a bad body gets `500 INTERNAL_ERROR` with no `traceId`.
- **Meeting Intelligence, bad date**: Zod reports `Invalid date`; the schema's `invalid_type_error: 'Invalid meeting date'`
  never fires after `z.coerce.date()`. The Powai Meeting lab's port (`src/projects/meeting.ts`) used the wrong message and
  is corrected here.
- **Meeting Intelligence citations**: the "every item cites a real timestamp" rule lives in the prompt and
  `AI_APPROACH.md`. `validateAnalysis` only fills missing arrays with `[]`; no code rejects an uncited item.
- **RootCause**: its README calls it the "Role 3" implementation for a team brief, and its deploy needs repository
  variables the repository can't show, so the exhibit doesn't claim it is deployed. Likewise, the portfolio has both
  Vercel and Netlify configs and no CI; the exhibit doesn't say which serves the site.
- **SENTINEL** is not used as evidence: its only commit is authored by "Claude", so it can't be attributed cleanly.

### Screenshots (Chromium, 1440 px; phone at 390 px)

- [Language Lane, Python bench](screenshots/andheri/andheri-language.png) ·
  [TypeScript bench, Zod refusing a date](screenshots/andheri/andheri-language-typescript.png)
- [Frontend Studio, RideMeter on the bench](screenshots/andheri/andheri-frontend.png)
- [Backend Workshop, missing token](screenshots/andheri/andheri-backend.png)
- [DevOps Garage, failing pytest blocks the Azure deploy](screenshots/andheri/andheri-devops.png)
- [AI Integration Lab, invented field rejected](screenshots/andheri/andheri-ai.png) · [at 390 px](screenshots/andheri/andheri-ai-390.png)

### Commands run

- `npx vitest run`: 191 passed (23 files). `npx tsc --noEmit`: clean. `npm run build`: succeeds.
- Playwright (cloud config): 14 quick-view, case-study, city-panel, Powai, Fort, Andheri and phone tests pass.
  "reduced-motion transport arrives directly and can be reboarded" fails here, and fails the same way on the
  unchanged base branch (the world loader is still up when the 12 s expect timeout ends under SwiftShader), so it
  is environmental, not this change. `RideMeter` moved to its own file unchanged; the Frontend Studio test renders it.

### Not yet done for Andheri

- The shops are panels opened from the district guide. Walk-in shop interiors and shopkeeper NPCs (brief §8 physical
  settings) are not built.

## 4. ASTFLOW Engineering Lab (brief §9, Powai)

### What ASTFLOW is

[ASTFLOW](https://github.com/ANUJ-DESHPANDE/ASTFLOW) is a local, CPU-based code-retrieval engine built by team
ByteCoders (VIT Vellore) for Samsung PRISM 2026. At Harsh's request (15 October 2026) the lab does not split credit
between team members; it shows all of ASTFLOW's published stats.

### Implemented and tested

The Powai panel's blocked placeholder is replaced by a working lab:
- **Shipped retrieval.** gte-modernbert-base dense on the full MTEB AppsRetrieval test set (3,765 queries × 8,765
  documents): NDCG@10 0.5509, MRR@10 0.5050, Recall@10–1000; the BM25, MiniLM hybrid and first official GTE test runs
  beside it; CPU timings (4 → 8 threads) and product measurements from the README.
- **Every retrieval experiment.** Phase 1 (E001–E005 and the final GTE gate) from `benchmark/EXPERIMENTS.md` and phase 2
  (E004–E023) from `benchmark/results/campaign/LEDGER.md`, each with its result and decision. Data:
  `src/projects/astflowRecord.ts`. Each number was checked to appear verbatim in its source file at the pinned commit.
- **One dev query, live.** Five real dev queries, picked by category (both retrievers agree, BM25 only, dense only,
  fusion pushes the answer out of the top 100, neither finds it), with their frozen baseline-v1 BM25 and dense
  rankings. The visitor changes k, weights and depth; the lab fuses the two lists in the browser and shows where the
  answer lands and the scored top 10.
- **The same setting on all 1,859 dev queries.** The archived E001 sweep (315 settings): NDCG@10, MRR@10, Recall@100 and
  answers lost by fusion for the chosen setting, and a k × weight grid of NDCG@10 change at the chosen depth.
- **E002.** The reranker's dev results at depths 20/50/100 with bootstrap intervals, and the REJECT decision.

Port: `src/projects/astflow.ts` (`rrf`, from `rrf_for_queries` in `benchmark/run_fusion_sweep.py`). UI:
`src/ui/AstflowLab.tsx`. Data: `src/projects/data/astflow.json`, built by `scripts/projects/astflow_reference.py`. The
script loads ASTFLOW's own `load_ranks`, `rrf_for_queries` and `evaluate_rankings` from the checkout and runs them
unchanged. It re-scores the E001 dev winner and the baseline on all 1,859 dev queries and asserts they equal the
archived sweep. It also checks that k=60/1:1 reconstructs the frozen hybrid ranking for each sample query, and records
the fused rankings for 60 settings per query.

Tests: `tests/astflow.test.ts` matches every recorded top 10 and answer rank, ASTFLOW's own toy RRF case, and the sweep
invariants (315 rows, baseline row = baseline, winner = best row, every reranker depth worse).
`tests/city.spec.ts` › "Powai ASTFLOW lab replays the fusion experiment" drives it in Chromium.

Screenshots: [stats and experiment record](screenshots/powai/astflow-stats.png); [whole lab, BM25-only weights recovering a lost answer](screenshots/powai/astflow-lab.png).

### Notes

- Query and code text are not shipped (they live in the MTEB dataset, not the repository), so the lab shows
  document ids only.
- The Powai panel now reads "Seven workplaces"; ASTFLOW is not added as a separate case study.
