/**
 * ASTFLOW (Samsung PRISM 2026, team ByteCoders: Aarush Shetty, Harsh Jha, Anuj Deshpande).
 * Repository: ANUJ-DESHPANDE/ASTFLOW. Harsh's commits there are the E001 fusion experiment, the
 * E002 cross-encoder reranker experiment and the baseline-v1 forensic diagnosis (24 Sep 2026).
 *
 * `rrf` is a port of `rrf_for_queries` in benchmark/run_fusion_sweep.py (Harsh's commit 0a60b37):
 * score = w_bm25 / (k + rank) + w_dense / (k + rank) over each list cut to `depth`, sorted by
 * (-score, doc id), kept to 1,000. Tested against rankings that function produced on the frozen
 * baseline-v1 runs (scripts/projects/astflow_reference.py).
 */
import data from './data/astflow.json';

export const ASTFLOW_COMMIT = data.commit;
export const astflowSource = (path: string) => `https://github.com/ANUJ-DESHPANDE/ASTFLOW/blob/${ASTFLOW_COMMIT}/${path}`;
export const HARSH_COMMITS = { fusion: '0a60b37', reranker: 'cef22c9', forensics: 'b297069' } as const;
export const astflowCommit = (sha: string) => `https://github.com/ANUJ-DESHPANDE/ASTFLOW/commit/${sha}`;

export interface Scored { doc: string; score: number; bm25Rank: number | null; denseRank: number | null }

export function rrf(bm25: string[], dense: string[], k: number, wBm25: number, wDense: number, depth: number): Scored[] {
  const scores = new Map<string, number>();
  const b = bm25.slice(0, depth), d = dense.slice(0, depth);
  // Same accumulation order as the Python, so float sums (and therefore ties) match exactly.
  if (wBm25 > 0) b.forEach((doc, i) => scores.set(doc, (scores.get(doc) ?? 0) + wBm25 / (k + i + 1)));
  if (wDense > 0) d.forEach((doc, i) => scores.set(doc, (scores.get(doc) ?? 0) + wDense / (k + i + 1)));
  const bRank = new Map(b.map((doc, i) => [doc, i + 1])), dRank = new Map(d.map((doc, i) => [doc, i + 1]));
  return [...scores].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)).slice(0, 1000)
    .map(([doc, score]) => ({ doc, score, bm25Rank: bRank.get(doc) ?? null, denseRank: dRank.get(doc) ?? null }));
}

export type SweepRow = (typeof data.sweep)[number];
export const SWEEP: SweepRow[] = data.sweep;
export const SWEEP_K = [...new Set(SWEEP.map(r => r.k))];
export const SWEEP_RATIOS = [...new Set(SWEEP.map(r => r.ratio))];
export const SWEEP_DEPTHS = [...new Set(SWEEP.map(r => r.depth))];
export const sweepRow = (k: number, ratio: string, depth: number) => SWEEP.find(r => r.k === k && r.ratio === ratio && r.depth === depth);
export const BASELINE = data.baseline, WINNER = data.winner, DECISION = data.decision, SPLITS = data.splits;
export const SAMPLE_QUERIES = data.queries;
export const RERANKER = ([20, 50, 100] as const).map(depth => {
  const r = data.rerankerDev[String(depth) as '20' | '50' | '100'];
  return { depth, ndcg10: r.reranked_metrics['ndcg@10'], baseline: r.baseline_metrics['ndcg@10'], ci: r.bootstrap_ndcg10_ci95 as number[], model: r.model, medianLatencyMs: r.median_latency_ms };
});
