/**
 * Real build and delivery pipelines from Harsh's repositories, transcribed step for step
 * (names shortened) from the pinned files linked on each pipeline. `simulate` applies the
 * GitHub Actions defaults those files rely on: steps in a job run in order and stop at the
 * first failure; jobs without `needs` run independently; a `workflow_run` follow-up with an
 * `if: conclusion == 'success'` runs only when every job of the triggering workflow passed.
 * Nothing here runs the pipelines; it shows what their own configuration says would happen.
 */
export interface Job { id: string; name: string; steps: string[] }
export interface Pipeline {
  id: string; repo: string; title: string; file: string; href: string; trigger: string; jobs: Job[];
  /** A follow-up that runs only if the whole first workflow succeeded. */
  gated?: { name: string; file: string; href: string; condition: string; steps: string[] };
  note: string;
}
const blob = (repo: string, commit: string, path: string) => `https://github.com/harshjha15335/${repo}/blob/${commit}/${path}`;
const PORTFOLIO = '14783f4e7dee8d60fabaf0bb2c4ba535fcf2c09b', ROOTCAUSE = '546d44ecf881f7016a83dfe13da29112a1f641d7', REPOLENS = '28fef675642ca9cc6879ad7fb8c43b4916bc85e1';

export const PIPELINES: Pipeline[] = [
  {
    id: 'rootcause', repo: 'RootCause', title: 'RootCause: CI, then gated Azure deploy',
    file: '.github/workflows/ci.yml', href: blob('RootCause', ROOTCAUSE, '.github/workflows/ci.yml'), trigger: 'pull_request, push to main',
    jobs: [
      { id: 'backend', name: 'backend', steps: ['checkout (full history)', 'setup-python 3.12', 'setup-uv', 'uv pip sync --require-hashes', 'ruff check + ruff format --check', 'pyright', 'pytest -q', 'HTTP + WebSocket smoke (uvicorn, scripts/smoke.py)', 'agents eval on samples/evaluation.jsonl', 'gitleaks: git history + source'] },
      { id: 'frontend', name: 'frontend', steps: ['checkout', 'setup-node 24', 'npm ci --ignore-scripts && npm run lint'] },
      { id: 'infrastructure', name: 'infrastructure', steps: ['checkout', 'compile infra/main.bicep', 'docker build api + frontend images'] },
    ],
    gated: {
      name: 'Deploy Azure', file: '.github/workflows/deploy.yml', href: blob('RootCause', ROOTCAUSE, '.github/workflows/deploy.yml'),
      condition: "workflow_run of CI on main, conclusion == 'success', and the repository's Azure variables set",
      steps: ['checkout the CI commit', 'setup Python, Node, uv', 're-run ruff, pyright, pytest, lint', 'azure/login (federated identity, no stored secret)', 'azd up --no-prompt'],
    },
    note: 'The deploy job also requires repository variables (AZURE_CLIENT_ID, AZURE_SUBSCRIPTION_ID). The repository does not show whether they are set, so this exhibit does not claim RootCause is deployed.',
  },
  {
    id: 'repolens', repo: 'RepoLens', title: 'RepoLens: backend and frontend CI',
    file: '.github/workflows/ci.yml', href: blob('RepoLens', REPOLENS, '.github/workflows/ci.yml'), trigger: 'push, pull_request',
    jobs: [
      { id: 'backend', name: 'backend', steps: ['checkout', 'setup-python 3.12 (pip cache)', 'install CPU torch + backend[dev]', 'pytest backend/tests -q', 'ruff check backend/app backend/tests'] },
      { id: 'frontend', name: 'frontend', steps: ['checkout', 'setup-node 20.9.x', 'npm ci', 'node --test tests/api-errors.test.mjs', 'tsc --noEmit', 'npm run lint', 'npm run build'] },
    ],
    note: 'Delivery is described separately in render.yaml (a Docker web service with a /api/health check) and docker-compose.yml (backend + Ollama). CI does not deploy.',
  },
  {
    id: 'portfolio', repo: 'Portfolio', title: 'This portfolio: local checks, static deploy config',
    file: 'package.json', href: blob('Portfolio', PORTFOLIO, 'package.json'), trigger: 'run by hand (no CI workflow in the repository)',
    jobs: [
      { id: 'check', name: 'local checks', steps: ['npm run test (vitest)', 'npm run build = tsc --noEmit && vite build', 'npm run test:browser (Playwright)'] },
      { id: 'host', name: 'host build (vercel.json / netlify.toml)', steps: ['npm run build', 'publish dist/ with immutable asset caching', 'security headers (CSP, nosniff, referrer policy; Vercel config)'] },
    ],
    note: 'Both Vercel and Netlify configs exist. Neither is run by CI here, and this exhibit does not claim which one serves the live site.',
  },
];

export type StepState = 'pass' | 'fail' | 'skipped';
/** What the configuration says happens when step `fail.step` of job `fail.job` fails. */
export function simulate(p: Pipeline, fail: { job: string; step: number } | null) {
  const jobs = p.jobs.map(job => {
    const states: StepState[] = job.steps.map((_, i) => {
      if (fail?.job === job.id) return i < fail.step ? 'pass' : i === fail.step ? 'fail' : 'skipped';
      return 'pass';
    });
    const conclusion: StepState = states.includes('fail') ? 'fail' : states.every(s => s === 'skipped') ? 'skipped' : 'pass';
    return { id: job.id, states, conclusion };
  });
  const success = jobs.every(j => j.conclusion === 'pass');
  return { jobs, success, gated: p.gated ? (success ? 'runs' as const : 'skipped' as const) : null };
}
