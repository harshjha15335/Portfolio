import { describe, expect, it } from 'vitest';
import data from '../src/projects/data/astflow.json';
import { BASELINE, RERANKER, SAMPLE_QUERIES, SWEEP, WINNER, rrf, sweepRow } from '../src/projects/astflow';

describe('ASTFLOW fusion port matches rrf_for_queries on the frozen baseline-v1 runs', () => {
  for (const q of SAMPLE_QUERIES) it(`${q.id} (${q.kind}): every recorded k / weight / depth setting`, () => {
    for (const e of q.expected) {
      const fused = rrf(q.bm25, q.dense, e.k, e.w_bm25, e.w_dense, e.depth).map(s => s.doc);
      expect(fused.slice(0, 10)).toEqual(e.top10);
      const rank = fused.indexOf(q.relevant);
      expect(rank < 0 ? null : rank + 1).toBe(e.relevantRank);
    }
  });
  it('reproduces the formula from ASTFLOW\'s own toy test', () => {
    expect(rrf(['docA', 'docB'], ['docB', 'docA'], 60, 1, 1, 1000).map(s => s.doc)).toEqual(['docA', 'docB']);
    expect(rrf(['docA', 'docB'], ['docB', 'docA'], 60, 1, 2, 1000).map(s => s.doc)).toEqual(['docB', 'docA']);
  });
});

describe('E001 sweep and E002 data', () => {
  it('has all 315 settings and the baseline row equals the baseline', () => {
    expect(SWEEP).toHaveLength(315);
    expect(sweepRow(60, '1:1 (equal)', 1000)!['ndcg@10']).toBeCloseTo(BASELINE.dev_ndcg10, 12);
  });
  it('the dev winner is the best NDCG@10 row and its CI includes zero', () => {
    const best = SWEEP.reduce((a, b) => (b['ndcg@10'] > a['ndcg@10'] ? b : a));
    expect([best.k, best.ratio, best.depth]).toEqual([WINNER.k, WINNER.ratio, WINNER.depth]);
    expect(WINNER.dev_bootstrap_95ci[0]).toBeLessThan(0);
    expect(data.decision).toBe('REJECT');
  });
  it('every reranker depth is worse than the baseline', () => {
    expect(RERANKER.every(r => r.ndcg10 < r.baseline && r.ci[1] < 0)).toBe(true);
  });
});
