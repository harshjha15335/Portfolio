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

/** The projects shown as Powai workplaces, in street order (ASTFLOW follows them; RECO stays a Quick View case study). */
export const POWAI_PROJECTS = ['northstar', 'moneymetrics', 'repolens', 'compilerlab'];

export const projects: Project[] = [
  {
    id: 'ffprime', title: 'FFprime', subtitle: 'Electrostatics beyond atomic charges',
    category: 'GSoC 2026 · Scientific Computing', year: '2026',
    shortDescription: 'Reviewed, upstream scientific Python for molecular multipole electrostatics.',
    longDescription: 'Google Summer of Code work with QC-Devs, extending FFprime with Cartesian and spherical multipole potentials, electric fields, analysis utilities and numerical validation.',
    problem: 'Atomic charges alone lose directional information. FFprime needed a reliable way to evaluate potentials and fields from atom-centered dipoles and quadrupoles.',
    approach: 'Built vectorized NumPy evaluation with broadcasting and np.einsum, fixed representation conventions explicitly, and validated the physics using analytical cases and path-equivalence tests.',
    architecture: ['Atomic multipole moments', 'Shape & convention validation', 'Cartesian ↔ spherical conversion', 'Vectorized potential / field evaluation', 'Field comparison & molecular examples'],
    challenges: 'Keeping spherical normalization, traceless quadrupoles and field gradients consistent; handling singularities and matching the conventions of an established scientific codebase.',
    results: 'Five merged upstream pull requests cover the vectorized core, validation, direct spherical potential evaluation, MultipoleExpansion container and molecular notebooks. Speedup and RMSE figures below are résumé-reported; the public report does not include benchmark datasets.',
    ownership: 'Harsh authored the electrostatics contributions and tests through upstream review. FFprime is a collaborative open-source codebase; the wider force-field toolkit is the maintainers’ work.',
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
    id: 'repolens', title: 'RepoLens', subtitle: 'AST-aware hybrid code retrieval',
    category: 'Applied AI · Retrieval Systems', year: '2026',
    shortDescription: 'Ask questions about a codebase and get answers grounded in cited, line-accurate source chunks.',
    longDescription: 'A FastAPI and Next.js retrieval-augmented tutor (published as CodeMentor-RAG) that parses repositories into AST chunks, ranks them with dense vectors and BM25, fuses the rankings with Reciprocal Rank Fusion, expands through a code graph and answers with citations.',
    problem: 'Generic code search treats source as flat text, so questions about structure, call flow or a specific symbol return noisy, uncited matches.',
    approach: 'Chunked code with Tree-sitter, indexed it twice (FAISS dense and a code-aware BM25), fused both rankings with weights chosen from the detected query intent, then expanded one hop through the call/import graph before generation.',
    architecture: ['Zip / Git ingestion', 'Tree-sitter AST chunks', 'Dense + BM25 indexes', 'Intent-weighted RRF fusion', 'Graph expansion / MMR', 'Cited tutor answer'],
    challenges: 'Keeping retrieval honest on a tiny evaluation set, defending ingestion against path traversal and zip bombs, and keeping embeddings deterministic when no model download is possible.',
    results: 'The repository README reports one local run on its 12-question calculator dataset: BM25 MRR 0.783, Hybrid RRF 0.781, graph expansion 0.785. It labels these diagnostic figures from one small dataset, not general accuracy. The backend has 92 pytest test functions.',
    ownership: 'Built the ingestion, retrieval, evaluation and tutor pipeline. The Powai exhibit runs a TypeScript port of its BM25, local embedding and RRF code on the repository\u2019s own sample calculator.',
    metrics: [
      { value: '0.785', label: 'MRR · graph expansion · one local run', source: 'https://github.com/harshjha15335/RepoLens/blob/main/README.md#evaluation' },
      { value: '12', label: 'questions in the evaluation dataset', source: 'https://github.com/harshjha15335/RepoLens/blob/main/evaluation/datasets/default.json' },
    ],
    skills: ['Python', 'FastAPI', 'TypeScript', 'Next.js', 'Tree-sitter', 'FAISS', 'BM25', 'Retrieval'],
    github: 'https://github.com/harshjha15335/RepoLens', source: 'https://github.com/harshjha15335/RepoLens/blob/main/README.md',
    worldPosition: [23, 0, 32], worldRotation: 0, landmarkType: 'garage', color: '#9fc3d8', priority: 5,
  },
  {
    id: 'compilerlab', title: 'Compiler Lab', subtitle: 'Operator precedence parsing and regex → DFA, step by step',
    category: 'Compiler Design · Teaching Tool', year: '2026',
    shortDescription: 'An interactive GUI that replays operator precedence parsing and the direct regex-to-DFA construction one rule at a time.',
    longDescription: 'A React teaching instrument for two Compiler Design topics: operator precedence parsing (LEADING / TRAILING, the relation table, shift/reduce with visible handles) and converting a regular expression to a DFA with the direct method (syntax tree, nullable / firstpos / lastpos, followpos, DFA construction and string simulation).',
    problem: 'Textbook compiler algorithms are usually shown as finished tables, so students see the answer but not which rule produced each entry.',
    approach: 'Kept every algorithm as plain, tested JavaScript that returns its result plus a list of steps. The interface only replays those steps, so moving back re-derives the exact earlier state, and each step says what changed, why, and which rule caused it.',
    architecture: ['Grammar / regex input', 'Tested algorithm core', 'steps[] replay', 'Precedence table / followpos', 'Shift-reduce / DFA view', 'String simulation'],
    challenges: 'Making every intermediate state reproducible from the step list, flagging precedence conflicts and invalid operator grammars, and keeping a self-contained build that opens from file:// with no network.',
    results: 'The repository\u2019s 27 node:test tests (algorithms, step schema and replay) pass, and an offline audit drives the built app through 106 checks from file://. The Powai lab runs a TypeScript port of its regex parser, direct-method DFA construction and simulator, checked against the repository\u2019s own tests.',
    ownership: 'Built the algorithm core, replay model and interface. The repository’s LR parsing page is not built yet and is not presented here.',
    metrics: [
      { value: '27', label: 'passing tests · node:test', source: 'https://github.com/harshjha15335/CompilerLab-OPP-RegexDFA/tree/main/test' },
      { value: '106', label: 'offline audit checks · README', source: 'https://github.com/harshjha15335/CompilerLab-OPP-RegexDFA/blob/main/README.md' },
    ],
    skills: ['JavaScript', 'React', 'Algorithms', 'Compiler design', 'Automata', 'Vite', 'node:test'],
    github: 'https://github.com/harshjha15335/CompilerLab-OPP-RegexDFA', source: 'https://github.com/harshjha15335/CompilerLab-OPP-RegexDFA/blob/main/README.md',
    worldPosition: [27, 0, 32], worldRotation: 0, landmarkType: 'garage', color: '#f0b45a', priority: 6,
  },
];
