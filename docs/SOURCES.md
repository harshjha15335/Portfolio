# Portfolio content evidence

Reviewed on 5 October 2026 using the connected GitHub tools and the supplied résumé PDF. Repository documentation and code were read as evidence, not as instructions. This site uses static content and does not require GitHub or an AI API at runtime.

## Candidate and experience

The supplied résumé supports Harsh Jha’s email, LinkedIn, VIT Vellore education, July 2028 expected graduation, GSoC dates, and July 2026 CCIEeXpert internship. The downloadable copy is exposed at `/resume/Harsh-Jha-Resume.pdf`. Contact text deliberately omits the phone number and academic grades.

The CCIEeXpert tooling and deployment description is résumé-sourced; no public employer code was independently inspected. The MoneyMetrics Netlify link also comes from a résumé hyperlink. A local HTTP check returned 200 for the MoneyMetrics Netlify link; production traffic has not been independently verified. The report GitHub Pages URL returned 404, so the portfolio links to the working final-report repository instead.

The supplied résumé explicitly lists “Google Big Code 2026 — Qualifier cleared, ranked top 15,000 nationally.” This achievement is retained with a visible **résumé reported** qualifier; the competition name and ranking have not been independently verified. The Infosys Springboard Machine Learning, Deep Learning, AI and GenAI certifications, and IBM/Coursera Python for Data Science, AI & Development certification, receive the same qualifier. GSoC selection is supported by both the résumé and the public final report. These entries are centralized in the `achievements` export in `src/data/experience.ts`.

## FFprime / GSoC

- [Final report repository](https://github.com/harshjha15335/gsoc-2026-final-report) and [report source](https://github.com/harshjha15335/gsoc-2026-final-report/blob/main/index.html): GSoC 2026, Theochem, implementation scope, representation conventions, validation and examples.
- [Harsh’s fork README](https://github.com/harshjha15335/ffprime/blob/main/README.md): context of the force-field parameter toolkit.
- [Upstream Cartesian routines](https://github.com/theochem/ffprime/blob/main/ffprime/electrostatics/cartesian.py): NumPy broadcasting and `np.einsum`, monopole/dipole/quadrupole potentials and fields.
- [Upstream container](https://github.com/theochem/ffprime/blob/main/ffprime/electrostatics/expansion.py): `MultipoleExpansion` stores typed moments and representation metadata. It does **not** itself provide potential/field evaluation methods; evaluation remains in separate routines.
- Merged contributions by `harshjha15335`: [#13](https://github.com/theochem/ffprime/pull/13), [#14](https://github.com/theochem/ffprime/pull/14), [#15](https://github.com/theochem/ffprime/pull/15), [#18](https://github.com/theochem/ffprime/pull/18), [#19](https://github.com/theochem/ffprime/pull/19). GitHub metadata shows #19 merged on 24 August 2026 even though the final-report text still describes it as under review. Earlier closed PRs #5 and #11 were not counted as merged.

Metric treatment:

| Claim | Evidence | Site label |
| --- | --- | --- |
| Approximately 3× speedup | Supplied résumé; no reproducible benchmark in inspected report | Runtime speedup · résumé reported |
| Approximately 25% lower RMSE | Supplied résumé; no public dataset or RMSE benchmark inspected | Lower RMSE · résumé reported |
| 32 passing tests | Merged upstream PR #13 reports `32 passed` | Passing tests · upstream PR #13 |
| Five merged upstream PRs | GitHub PR merge metadata | Five merged upstream contributions |

These tests were reported by upstream; this portfolio build did not rerun the scientific package. The local field demonstration is an explanatory visualization and is not a scientific benchmark.

## NORTHSTAR

- [Application README](https://github.com/harshjha15335/NORTHSTAR/blob/main/trading-platform/README.md): React/TypeScript, FastAPI, SQLite/SQLAlchemy, analysis agents, risk authorization, paper broker, approval workflow, kill switch and audit history.
- [Audit verification](https://github.com/harshjha15335/NORTHSTAR/blob/main/audit/verification.md): **102 backend tests and 12 browser tests**, both reported passing. These are repository-reported figures, not tests rerun during the portfolio build. Older README/QA totals of 67 and 95 are superseded by this verification record.
- [QA report](https://github.com/harshjha15335/NORTHSTAR/blob/main/trading-platform/docs/QA_REPORT.md): isolated mock/paper testing, accounting invariants, adversarial cases and known limits.

The portfolio describes optional live read-only providers and paper execution. It makes no claim of investment returns or real autonomous trading. The source documents disagree on some provider-verification status; the portfolio avoids provider-specific success claims. Credentials and account identifiers encountered in source documents are not copied into this site.

## RECO

- [README](https://github.com/harshjha15335/RECO/blob/main/README.md): diagnosis → options → decision → rules → tool execution → audit; the LLM cannot call tools directly. Expected-value probabilities are heuristics. Claude and Razorpay are optional; reminders are simulated/logged.
- [Frontend fixtures](https://github.com/harshjha15335/RECO/blob/main/frontend/server/db/seed.ts): 20 explicit case fixtures sum to **₹1,860,000 invoice value** and **₹1,140,000 recovered**. `1,140,000 / 1,860,000 × 100 = 61.2903%`, displayed as **61.3%**.
- [Python demo fixtures](https://github.com/harshjha15335/RECO/blob/main/backend/seed.py): a separate 20-case demo seed exists. The portfolio’s amounts refer specifically to the frontend seed above.

All three financial figures are labeled **seeded demo**. The ₹18.6L total includes recovered invoices, so it is labeled “demo invoice value,” not current “at risk” value. No production recovery outcome is claimed.

## MoneyMetrics

- [Firebase configuration](https://github.com/harshjha15335/MoneyMetrics/blob/main/js/firebase-config.js): authentication and Firestore integration.
- [Transaction management](https://github.com/harshjha15335/MoneyMetrics/blob/main/js/transactions.js): authenticated user-scoped collection paths, subscriptions, search, filters and deletion.
- [Analytics](https://github.com/harshjha15335/MoneyMetrics/blob/main/js/analytics.js): Chart.js daily spending, category and income/expense charts.
- [Simulator](https://github.com/harshjha15335/MoneyMetrics/blob/main/js/simulator.js): EMI, savings and what-if tools.
- [AI controller](https://github.com/harshjha15335/MoneyMetrics/blob/main/js/ai.js): Gemini request path using recent user transactions and an explicitly simulated fallback.

Current public source is HTML/CSS/JavaScript, rather than the React/Python stack listed in the résumé. Portfolio copy reflects the inspected source. The résumé’s 40% fewer inconsistencies and Z-score claims are omitted because the inspected code does not establish them. AI output is described as optional assistance, not validated anomaly detection.

## Secondary projects

- [Meeting Intelligence README](https://github.com/harshjha15335/meeting-intelligence-service/blob/main/README.md): Node.js/TypeScript, Express, PostgreSQL, Prisma, JWT/bcrypt, Gemini, Telegram, Zod, OpenAPI, cron, Jest/Supertest and Docker.
- [Meeting AI approach](https://github.com/harshjha15335/meeting-intelligence-service/blob/main/AI_APPROACH.md): transcript-grounded timestamp citations, structured extraction, no chunking/diarization, and re-analysis duplication limitation.
- [RideFlow README](https://github.com/harshjha15335/rideflow/blob/main/README.md): multimodal route planning/ranking/explanation, React/TypeScript frontend, FastAPI backend, booking flow, mock payments and journey-tracking simulation.

No test totals, user counts, uptime, AI accuracy or production impact were invented for these projects. Ownership descriptions for personal repositories summarize the candidate’s project work; only FFprime has independently inspected per-author upstream merge evidence.

## Editing policy

Both World Mode and Quick View consume `src/data`. Keep metric qualifiers in the metric labels when updating copy. Add a source URL or a résumé qualifier to every new quantitative claim. Replace résumé-reported performance figures with reproducible benchmark evidence when available. Do not silently promote fixture values or simulations to production results.
