/**
 * ASTFLOW's published numbers, copied from its repository at the pinned commit (see ASTFLOW_COMMIT).
 * Every figure here appears verbatim in the file named by its `source`; nothing is derived or rounded
 * differently. E001 and E002 are also replayed from raw data in astflow.json.
 */
export interface Metric { label: string; value: string }
export interface Experiment { id: string; idea: string; result: string; decision: 'ACCEPT' | 'REJECT' | 'DIAGNOSIS' | 'CLOSED' | 'NOT SELECTED' }
export interface Phase { title: string; setup: string; source: string; experiments: Experiment[] }

/** benchmark/RETRIEVAL_BASELINE.md: the accepted system on the full MTEB AppsRetrieval TEST set. */
export const SHIPPED = {
  model: 'Alibaba-NLP/gte-modernbert-base',
  setup: 'Dense retrieval on CPU, float32, 512-token cap, exact cosine over the whole corpus',
  queries: '3,765', documents: '8,765',
  metrics: [
    { label: 'NDCG@10', value: '0.5509' }, { label: 'MRR@10', value: '0.5050' },
    { label: 'Recall@10', value: '0.6964' }, { label: 'Recall@50', value: '0.8489' }, { label: 'Recall@100', value: '0.8946' },
    { label: 'Recall@500', value: '0.9615' }, { label: 'Recall@1000', value: '0.9782' },
  ] as Metric[],
  source: 'benchmark/RETRIEVAL_BASELINE.md',
};

/** README.md: full TEST runs of each retrieval generation (MTEB 2.21.0, all 3,765 queries). */
export const TEST_SYSTEMS = [
  { name: 'BM25, code-aware tokens', ndcg: 0.06312, mrr: '0.054209' },
  { name: 'MiniLM hybrid (BM25 + dense RRF)', ndcg: 0.0884, mrr: '0.072573' },
  { name: 'gte-modernbert-base dense (first official run)', ndcg: 0.5511, mrr: '0.5053' },
  { name: 'gte-modernbert-base dense, float32 (accepted)', ndcg: 0.5509, mrr: '0.5050' },
];

/** benchmark/results/campaign/LEDGER.md (CPU8) and README.md. */
export const PERFORMANCE: Metric[] = [
  { label: 'Full index, 8,765 documents (4 → 8 threads)', value: '6,474 s → 3,968 s' },
  { label: 'Query encoding p50 (4 → 8 threads)', value: '343 ms → 230 ms, faster on 149/150' },
  { label: 'Top 10 after the thread change', value: 'identical on all 3,765 TEST queries' },
  { label: 'Clean-clone setup / demo ready (4-vCPU runner)', value: '101 s / 12 s later' },
  { label: 'expressjs/express 4.18.2 cold index (3,226 chunks)', value: '6.2–11.9 min' },
  { label: 'Call-graph edges with nested-scope calls', value: 'express 14 → 286 · lodash 24 → 1,572' },
];

export const PHASES: Phase[] = [
  {
    title: 'Phase 1 · MiniLM hybrid baseline',
    setup: 'Frozen baseline-v1 runs; 1,859 dev and 1,906 confirmation queries; NDCG@10 change with paired-bootstrap 95% CI.',
    source: 'benchmark/EXPERIMENTS.md',
    experiments: [
      { id: 'E001', idea: 'Sweep 315 RRF fusion settings (k, weights, depth)', result: 'Dev +0.00032 [-0.00251, +0.00310]; confirmation -0.00022', decision: 'REJECT' },
      { id: 'E002', idea: 'Cross-encoder reranks the hybrid top 20/50/100', result: 'Dev -0.02070 [-0.02975, -0.01186] at depth 20', decision: 'REJECT' },
      { id: 'E003', idea: 'Embed documents in sliding windows (256/64)', result: 'Hybrid dev +0.00093 [-0.00232, +0.00426]', decision: 'REJECT' },
      { id: 'E004', idea: 'Encode the whole long query, not its first 254 word-pieces', result: 'Hybrid dev +0.0184 [+0.0038, +0.0331]; confirmation +0.0144 [+0.0020, +0.0276]', decision: 'NOT SELECTED' },
      { id: 'E005', idea: 'Swap in a code-retrieval embedder (1,024-token window)', result: 'Failed the pre-registered CPU threshold of 5 docs/s before any accuracy result', decision: 'REJECT' },
      { id: 'GATE', idea: 'Final decision: GTE dense (512 tokens) vs the MiniLM hybrid', result: 'Dev +0.2293 [+0.1852, +0.2743]; confirmation +0.2183 [+0.1720, +0.2647]', decision: 'ACCEPT' },
    ],
  },
  {
    title: 'Phase 2 · tuning around GTE dense',
    setup: 'Train-split dev and confirmation sets (300 + 300); GTE dense dev baseline NDCG@10 0.6977.',
    source: 'benchmark/results/campaign/LEDGER.md',
    experiments: [
      { id: 'E004', idea: 'Dense + 0.05 BM25 blend', result: 'Dev +0.0169 [+0.0045, +0.0302]; TEST +0.0006 [-0.0020, +0.0032]', decision: 'REJECT' },
      { id: 'E005', idea: 'BM25 k1/b grid inside the blend', result: '+0.0002 [-0.0005, +0.0013] vs blend', decision: 'REJECT' },
      { id: 'E009', idea: 'Weighted RRF and linear fusion', result: 'Best +0.0123 [+0.0014, +0.0232], below the blend', decision: 'REJECT' },
      { id: 'E011', idea: 'gte-reranker-modernbert-base on dense top 20', result: '-0.0514 [-0.0882, -0.0133]', decision: 'REJECT' },
      { id: 'E015', idea: 'Dense pseudo-relevance feedback', result: '-0.0040 [-0.0100, +0.0018] vs blend', decision: 'REJECT' },
      { id: 'E016', idea: '2048-token query window', result: '+0.0053 [-0.0040, +0.0156]', decision: 'REJECT' },
      { id: 'E018', idea: 'Diagnose the remaining ranking failures', result: '55/300 correct at dense ranks 11–1000, only 3 absent', decision: 'DIAGNOSIS' },
      { id: 'E019', idea: 'Explicit operator boost on the top 50', result: '+0.002321, below the +0.005 gate', decision: 'REJECT' },
      { id: 'E020', idea: 'Learned pairwise reranker on dense top 50', result: '-0.041813 [-0.069786, -0.013075]', decision: 'REJECT' },
      { id: 'E021', idea: 'Rerank only when the dense margin is small', result: 'Kept 45.45% of useful improvements, below 50%', decision: 'REJECT' },
      { id: 'E022', idea: 'Strong joint reranker on CPU', result: 'Top-50 rerank p50 29.56 s vs dense 0.55 s', decision: 'REJECT' },
      { id: 'E023', idea: 'Freeze GTE dense as the shipped configuration', result: 'TEST NDCG@10 0.5509, MRR@10 0.5050', decision: 'CLOSED' },
    ],
  },
];
