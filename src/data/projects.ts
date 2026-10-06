export interface Project {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  year: string;
  shortDescription: string;
  longDescription: string;
  problem: string;
  approach: string;
  architecture: string[];
  challenges: string;
  results: string;
  ownership: string;
  metrics: { value: string; label: string; source?: string }[];
  skills: string[];
  github: string;
  demo?: string;
  source: string;
  worldPosition: [number, number, number];
  worldRotation: number;
  landmarkType: string;
  color: string;
  priority: number;
}

export const projects: Project[] = [
  {
    id: 'ffprime', title: 'FFprime', subtitle: 'Electrostatics beyond atomic charges',
    category: 'GSoC 2026 · Scientific Computing', year: '2026',
    shortDescription: 'Reviewed, upstream scientific Python for molecular multipole electrostatics.',
    longDescription: 'Google Summer of Code work with QC-Devs / Theochem, extending FFprime with Cartesian and spherical multipole potentials, electric fields, analysis utilities and numerical validation.',
    problem: 'Atomic charges alone lose directional information. FFprime needed a reliable way to evaluate potentials and fields from atom-centered dipoles and quadrupoles.',
    approach: 'Built vectorized NumPy evaluation with broadcasting and np.einsum, fixed representation conventions explicitly, and validated the physics using analytical cases and path-equivalence tests.',
    architecture: ['Atomic multipole moments', 'Shape & convention validation', 'Cartesian ↔ spherical conversion', 'Vectorized potential / field evaluation', 'Field comparison & molecular examples'],
    challenges: 'Keeping spherical normalization, traceless quadrupoles and field gradients consistent; handling singularities and matching the conventions of an established scientific codebase.',
    results: 'Five merged upstream pull requests cover the vectorized core, validation, direct spherical potential evaluation, MultipoleExpansion container and molecular notebooks. Speedup and RMSE figures below are résumé-reported; the public report does not include benchmark datasets.',
    ownership: 'Harsh authored the electrostatics contributions and tests through upstream review. FFprime is a collaborative research codebase; the wider force-field toolkit is the maintainers’ work.',
    metrics: [
      { value: '~3×', label: 'runtime speedup · résumé reported', source: '/resume/Harsh-Jha-Resume.pdf' },
      { value: '~25%', label: 'lower RMSE · résumé reported', source: '/resume/Harsh-Jha-Resume.pdf' },
      { value: '32', label: 'passing tests · upstream PR #13', source: 'https://github.com/theochem/ffprime/pull/13' },
    ],
    skills: ['Python', 'NumPy', 'Numerical methods', 'np.einsum', 'Unit testing', 'Open source'],
    github: 'https://github.com/theochem/ffprime',
    source: 'https://github.com/harshjha15335/gsoc-2026-final-report',
    worldPosition: [0, 0, -30], worldRotation: 0, landmarkType: 'research', color: '#82e5e7', priority: 1,
  },
  {
    id: 'northstar', title: 'NORTHSTAR', subtitle: 'AI market research system',
    category: 'AI Systems · Financial Engineering', year: '2026',
    shortDescription: 'A paper-first research terminal with a deterministic boundary between AI decisions and execution.',
    longDescription: 'A React and FastAPI terminal that combines market evidence, analysis agents, strict trade proposals and an auditable paper ledger. Mock data supports offline operation; live read-only providers are optional.',
    problem: 'Market research and model-generated trade proposals need provenance, persisted state and enforceable risk limits before any execution can occur.',
    approach: 'Separated market and research providers from analysis, decision, deterministic risk authorization and paper execution. Persisted proposals, fills, cycle history and audit events in SQLite.',
    architecture: ['Market data', 'Research providers', 'Analysis agents', 'Decision agent', 'Deterministic risk engine', 'Paper execution', 'Audit / ledger'],
    challenges: 'Decimal accounting, stale evidence, malformed model outputs, changing approval conditions and concurrent execution. Unknown broker outcomes block further orders until reconciled.',
    results: 'Repository audit records 102 passing backend tests and 12 passing browser tests. Includes approval workflows, backtesting and a persistent kill switch. Real broker execution remains disabled.',
    ownership: 'Built the research terminal and its provider, agent, risk and persistence boundaries; repository tests document accounting and execution invariants.',
    metrics: [
      { value: '102', label: 'backend tests · repository audit', source: 'https://github.com/harshjha15335/NORTHSTAR/blob/main/audit/verification.md' },
      { value: '12', label: 'browser tests · repository audit', source: 'https://github.com/harshjha15335/NORTHSTAR/blob/main/audit/verification.md' },
      { value: 'Paper', label: 'execution with audit history' },
    ],
    skills: ['React', 'TypeScript', 'FastAPI', 'SQLite', 'SQLAlchemy', 'Pydantic', 'Playwright'],
    github: 'https://github.com/harshjha15335/NORTHSTAR',
    source: 'https://github.com/harshjha15335/NORTHSTAR/blob/main/trading-platform/README.md',
    worldPosition: [30, 0, 0], worldRotation: -Math.PI / 2, landmarkType: 'terminal', color: '#99beff', priority: 2,
  },
  {
    id: 'reco', title: 'RECO', subtitle: 'AI revenue recovery control tower',
    category: 'AI Engineering · Decision Systems', year: '2026',
    shortDescription: 'Diagnose, decide, guard and recover—with deterministic rules between the model and its tools.',
    longDescription: 'An AI-assisted B2B invoice recovery system that diagnoses overdue cases, scores recovery options by expected value, validates actions and records an audit trail. Probabilities are transparent heuristics.',
    problem: 'Recovering overdue invoices requires balancing likely recovery against intervention cost, customer relationships, disputes and payment-rail failures.',
    approach: 'The model returns structured decisions. A rule engine validates them before execution, applying stopping rules and escalation paths. Claude and Razorpay are optional; demo fallbacks work without credentials.',
    architecture: ['Case', 'Context', 'LLM diagnosis', 'Recovery options', 'Expected value', 'Action selection', 'Deterministic guardrails', 'Execution', 'Audit trail'],
    challenges: 'Preventing unrestricted model execution, representing uncertainty honestly and making failures, retries, human escalation and stop decisions inspectable.',
    results: 'The frontend’s 20 seeded demo cases total ₹18.6L in invoice value with ₹11.4L recovered, a 61.3% recovery ratio. These are fixture values, not production recovery outcomes. Customer communications and fallback payments are simulated.',
    ownership: 'Built the recovery workflow, rule boundaries and control-tower interface. The project demonstrates decision-system architecture using seeded recovery scenarios.',
    metrics: [
      { value: '₹18.6L', label: 'demo invoice value · seeded', source: 'https://github.com/harshjha15335/RECO/blob/main/frontend/server/db/seed.ts' },
      { value: '₹11.4L', label: 'demo recovered · seeded', source: 'https://github.com/harshjha15335/RECO/blob/main/frontend/server/db/seed.ts' },
      { value: '61.3%', label: 'demo recovery ratio · seeded', source: 'https://github.com/harshjha15335/RECO/blob/main/frontend/server/db/seed.ts' },
    ],
    skills: ['React', 'TypeScript', 'FastAPI', 'SQLite', 'Structured outputs', 'Rule engines'],
    github: 'https://github.com/harshjha15335/RECO', source: 'https://github.com/harshjha15335/RECO/blob/main/README.md',
    worldPosition: [0, 0, 30], worldRotation: Math.PI, landmarkType: 'tower', color: '#c7e77d', priority: 3,
  },
  {
    id: 'moneymetrics', title: 'MoneyMetrics', subtitle: 'Personal finance intelligence',
    category: 'Product Engineering · Finance', year: '2026',
    shortDescription: 'A user-scoped financial ledger with live charts, planning tools and an optional Gemini assistant.',
    longDescription: 'A browser-based personal finance dashboard with Firebase authentication, Firestore transaction storage, spending analytics, savings and loan simulators, and Gemini-assisted transaction review.',
    problem: 'Personal transactions need an understandable view of cash flow, category spending and the effect of different savings or borrowing decisions.',
    approach: 'Connected authenticated user transaction collections to dashboard and Chart.js views. Added deterministic planning calculators and an assistant that reviews recent transactions when Gemini is configured.',
    architecture: ['Firebase authentication', 'User-scoped Firestore ledger', 'Transaction management', 'Dashboard & analytics', 'Planning simulators', 'Optional Gemini analysis'],
    challenges: 'Keeping transaction data scoped to the signed-in user, updating charts as data changes, and preserving a usable experience when the AI provider is unavailable.',
    results: 'Public code verifies transaction filtering, Firestore subscriptions, chart analytics and EMI/savings calculators. The AI path includes a labeled simulated fallback. The résumé records Netlify deployment; no traffic or error-reduction metric is presented here.',
    ownership: 'Designed and shipped the finance dashboard, transaction workflows and analytics. The current public repository uses HTML, CSS and JavaScript with Firebase.',
    metrics: [
      { value: 'Live', label: 'Firestore transaction subscriptions' },
      { value: '3', label: 'planning tools · EMI / savings / what-if' },
      { value: 'Optional', label: 'Gemini with simulated fallback' },
    ],
    skills: ['JavaScript', 'HTML / CSS', 'Firebase Auth', 'Firestore', 'Chart.js', 'Gemini'],
    github: 'https://github.com/harshjha15335/MoneyMetrics', demo: 'https://beautiful-paletas-d81505.netlify.app/',
    source: 'https://github.com/harshjha15335/MoneyMetrics/blob/main/js/ai.js',
    worldPosition: [-30, 0, 0], worldRotation: Math.PI / 2, landmarkType: 'vault', color: '#b8a4fa', priority: 4,
  },
  {
    id: 'meeting-intelligence-service', title: 'Meeting Intelligence', subtitle: 'From transcript to accountable action',
    category: 'Backend · Applied AI', year: '2026',
    shortDescription: 'A typed meeting API with cited AI extraction, action tracking and scheduled reminders.',
    longDescription: 'A Node.js service that manages meeting transcripts, extracts summaries and action items through Gemini, stores results in PostgreSQL and sends overdue reminders through Telegram.',
    problem: 'Meeting decisions and commitments are easy to lose when transcripts, tasks and reminders live in separate tools.',
    approach: 'Separated Express controllers, services and Prisma repositories. Prompted for transcript-grounded JSON with timestamp citations and validated requests through Zod.',
    architecture: ['JWT authentication', 'Meeting transcript API', 'Gemini extraction', 'PostgreSQL / Prisma', 'Action items', 'Cron / Telegram reminders'],
    challenges: 'Grounding outputs in transcript evidence, propagating trace IDs and exposing provider failures cleanly. Re-analysis currently does not deduplicate action items.',
    results: 'Repository provides OpenAPI documentation, Jest/Supertest test workflows, Docker configuration and explicit AI limitations. No production usage or accuracy metric is claimed.',
    ownership: 'Built the backend API, persistence layers, integrations and documented analysis strategy.',
    metrics: [], skills: ['Node.js', 'TypeScript', 'Express', 'PostgreSQL', 'Prisma', 'JWT', 'Zod', 'Jest', 'Docker'],
    github: 'https://github.com/harshjha15335/meeting-intelligence-service',
    source: 'https://github.com/harshjha15335/meeting-intelligence-service/blob/main/README.md',
    worldPosition: [23, 0, 32], worldRotation: 0, landmarkType: 'garage', color: '#e6bc8b', priority: 5,
  },
  {
    id: 'rideflow', title: 'RideFlow', subtitle: 'One journey, multiple modes',
    category: 'Full Stack · Mobility Prototype', year: '2026',
    shortDescription: 'A multimodal journey-planning prototype with ranked routes and a simulated travel flow.',
    longDescription: 'Combines walking, bus, metro, train, auto-rickshaw and taxi options into a journey interface, with route explanations, booking flow, digital passes and simulated live tracking.',
    problem: 'Multimodal travel requires comparing routes across transport types and understanding the complete journey before booking.',
    approach: 'Built a React/TypeScript interface over a Python/FastAPI backend, with route ranking, recommendations and a guided booking experience.',
    architecture: ['Journey request', 'Multimodal routes', 'Ranking & explanation', 'Booking flow', 'Mock payment', 'Journey simulation'],
    challenges: 'Making transfers and tradeoffs readable while keeping booking and tracking coherent across multiple transport modes.',
    results: 'Repository documents the route-planning and booking prototype. Payments and live journey tracking are simulations; no live transport-provider integration is claimed.',
    ownership: 'Built the journey-planning prototype and frontend/backend flow.',
    metrics: [], skills: ['React', 'TypeScript', 'FastAPI', 'Python', 'Tailwind CSS', 'Framer Motion'],
    github: 'https://github.com/harshjha15335/rideflow', source: 'https://github.com/harshjha15335/rideflow/blob/main/README.md',
    worldPosition: [27, 0, 32], worldRotation: 0, landmarkType: 'garage', color: '#a1d9b6', priority: 6,
  },
];
