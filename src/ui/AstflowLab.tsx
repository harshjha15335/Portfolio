import { useState } from 'react';
import { BASELINE, DECISION, EXPERIMENT_COMMITS, RERANKER, SAMPLE_QUERIES, SPLITS, SWEEP_DEPTHS, SWEEP_K, SWEEP_RATIOS, WINNER, astflowCommit, astflowSource, rrf, sweepRow } from '../projects/astflow';
import { PERFORMANCE, PHASES, SHIPPED, TEST_SYSTEMS } from '../projects/astflowRecord';

const KIND_LABEL: Record<string, string> = {
  'both-top': 'Both retrievers rank the answer first',
  'bm25-only': 'Only BM25 finds the answer',
  'dense-only': 'Only the dense model finds the answer',
  'lost-by-fusion': 'BM25 has it in its top 100; the 1:1 fusion pushes it out',
  neither: 'Neither retriever finds it in its top 100',
};
const f4 = (n: number) => n.toFixed(4);
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(5)}`;
const ratioWeights = (ratio: string) => { const [a, b] = ratio.split(' ')[0].split(':').map(Number); return [a, b] as const; };

/** Powai: ASTFLOW Engineering Lab. The shipped results, the whole experiment record, and E001/E002 replayed on the frozen runs. */
export function AstflowLab() {
  const [qid, setQid] = useState(SAMPLE_QUERIES[3].id);
  const [k, setK] = useState(60);
  const [ratio, setRatio] = useState('1:1 (equal)');
  const [depth, setDepth] = useState(1000);
  const q = SAMPLE_QUERIES.find(x => x.id === qid)!;
  const [wb, wd] = ratioWeights(ratio);
  const fused = rrf(q.bm25, q.dense, k, wb, wd, depth);
  const baseline = rrf(q.bm25, q.dense, 60, 1, 1, 1000);
  const rankIn = (list: { doc: string }[] | string[]) => { const i = list.findIndex(x => (typeof x === 'string' ? x : x.doc) === q.relevant); return i < 0 ? null : i + 1; };
  const now = rankIn(fused), before = rankIn(baseline);
  const row = sweepRow(k, ratio, depth)!;
  const deltas = SWEEP_K.flatMap(kk => SWEEP_RATIOS.map(r => (sweepRow(kk, r, depth)!['ndcg@10'] - BASELINE.dev_ndcg10)));
  const span = Math.max(...deltas.map(Math.abs));
  return <section className="flagship-lab astflow-lab" aria-label="ASTFLOW Engineering Lab">
    <header><span className="eyebrow">POWAI / ASTFLOW ENGINEERING LAB · SAMSUNG PRISM 2026</span><h3>Local code search, measured</h3>
      <p>ASTFLOW is a local, CPU-only code retrieval and repository investigation engine built by team ByteCoders (VIT Vellore) for Samsung PRISM 2026. It needs no paid API and never runs the code it indexes. Below: its shipped benchmark results, every retrieval experiment in its log with the decision taken, and two of those experiments replayed live on the frozen data.</p></header>

    <h4 className="lab-subhead">Shipped retrieval: full MTEB AppsRetrieval test set</h4>
    <p className="caption">{SHIPPED.model.toUpperCase()} · {SHIPPED.setup.toUpperCase()} · {SHIPPED.queries} QUERIES × {SHIPPED.documents} DOCUMENTS</p>
    <dl className="astflow-stats">{SHIPPED.metrics.map(m => <div key={m.label}><dt>{m.label}</dt><dd>{m.value}</dd></div>)}</dl>
    <div className="lab-grid">
      <figure className="astflow-bars" aria-label="NDCG@10 on the full test set by retrieval generation">
        {TEST_SYSTEMS.map(t => <div key={t.name}><span>{t.name}</span><i style={{ width: `${(t.ndcg / 0.6) * 100}%` }} /><b>{t.ndcg}</b><small>MRR@10 {t.mrr}</small></div>)}
        <figcaption className="caption">NDCG@10 ON ALL 3,765 TEST QUERIES (MTEB 2.21.0) · SOURCE: README</figcaption>
      </figure>
      <table className="lab-table"><caption className="caption">CPU PERFORMANCE AND PRODUCT MEASUREMENTS</caption><tbody>
        {PERFORMANCE.map(p => <tr key={p.label}><th>{p.label}</th><td>{p.value}</td></tr>)}
      </tbody></table>
    </div>

    <h4 className="lab-subhead">Every retrieval experiment</h4>
    {PHASES.map(ph => <div key={ph.title} className="astflow-phase">
      <p className="caption">{ph.title.toUpperCase()} · {ph.setup} <a href={astflowSource(ph.source)} target="_blank" rel="noopener noreferrer">SOURCE ↗</a></p>
      <table className="lab-table astflow-ledger"><thead><tr><th>ID</th><th>Idea</th><th>Result (NDCG@10 change, 95% CI)</th><th>Decision</th></tr></thead><tbody>
        {ph.experiments.map(e => <tr key={ph.title + e.id}><th>{e.id}</th><td>{e.idea}</td><td>{e.result}</td><td><span className={`decision ${e.decision === 'ACCEPT' || e.decision === 'CLOSED' ? 'pass' : e.decision === 'REJECT' ? 'fail' : ''}`}>{e.decision}</span></td></tr>)}
      </tbody></table>
    </div>)}
    <p className="caption">PHASE 2 RESTARTS ITS IDS AT E004 IN THE REPOSITORY'S CAMPAIGN LEDGER. PHASE 1'S E004 PASSED ITS OWN GATE BUT WAS NOT SELECTED, BECAUSE THE GTE DENSE GATE ALSO PASSED.</p>

    <h4 className="lab-subhead">Replay E001: one dev query, live</h4>
    <div className="lab-grid">
      <div className="lab-controls">
        <span className="eyebrow">CHANGE THE FUSION</span>
        <label>Query<select value={qid} onChange={e => setQid(e.target.value)}>{SAMPLE_QUERIES.map(x => <option key={x.id} value={x.id}>{x.id} · {KIND_LABEL[x.kind]}</option>)}</select></label>
        <label>k (rank damping)<select value={k} onChange={e => setK(+e.target.value)}>{SWEEP_K.map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Weights (BM25 : dense)<select value={ratio} onChange={e => setRatio(e.target.value)}>{SWEEP_RATIOS.map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Depth per list<select value={depth} onChange={e => setDepth(+e.target.value)}>{SWEEP_DEPTHS.map(v => <option key={v}>{v}</option>)}</select></label>
        <p className="caption">BASELINE: k 60 · 1:1 · DEPTH 1000. QUERY AND CODE TEXT ARE NOT SHIPPED; IDS ARE MTEB APPSRETRIEVAL'S.</p>
      </div>
      <div aria-live="polite">
        <table className="lab-table"><caption className="caption">WHERE THE ANSWER ({q.relevant}) LANDS</caption><tbody>
          <tr><th>BM25 alone</th><td>{rankIn(q.bm25) ?? 'not in top 1000'}</td></tr>
          <tr><th>Dense alone</th><td>{rankIn(q.dense) ?? 'not in top 1000'}</td></tr>
          <tr><th>Baseline fusion</th><td>{before ?? 'not in top 1000'}</td></tr>
          <tr className={now !== null && now <= 10 ? '' : 'flagged'}><th>Your fusion</th><td role="status">{now ?? 'not in top 1000'}{now !== null && before !== null && now !== before ? ` (${now < before ? '▲' : '▼'} ${Math.abs(before - now)})` : ''}</td></tr>
        </tbody></table>
        <ol className="fused-list" aria-label="Fused top 10">{fused.slice(0, 10).map((s, i) => <li key={s.doc} className={s.doc === q.relevant ? 'hit' : ''}><b>{i + 1}</b><code>{s.doc}</code><span>BM25 #{s.bm25Rank ?? '–'} · dense #{s.denseRank ?? '–'}</span><small>{s.score.toFixed(5)}</small></li>)}</ol>
      </div>
    </div>

    <h4 className="lab-subhead">The same setting on all {SPLITS.dev.toLocaleString('en-IN')} dev queries (E001, recorded)</h4>
    <div className="lab-grid">
      <table className="lab-table"><tbody>
        <tr><th>NDCG@10</th><td>{f4(row['ndcg@10'])} <small>({signed(row['ndcg@10'] - BASELINE.dev_ndcg10)} vs {f4(BASELINE.dev_ndcg10)})</small></td></tr>
        <tr><th>MRR@10</th><td>{f4(row['mrr@10'])}</td></tr>
        <tr><th>Recall@100</th><td>{f4(row['recall@100'])} <small>(baseline {f4(BASELINE.dev_recall100)})</small></td></tr>
        <tr><th>Answers one retriever had in its top 100 that fusion dropped from its top 100</th><td>{row.lost_by_fusion}</td></tr>
      </tbody></table>
      <figure className="sweep-grid" aria-label={`NDCG@10 change versus baseline at depth ${depth}`}>
        <table><thead><tr><th>k</th>{SWEEP_RATIOS.map(r => <th key={r} title={r}>{r.split(' ')[0]}</th>)}</tr></thead><tbody>
          {SWEEP_K.map(kk => <tr key={kk}><th>{kk}</th>{SWEEP_RATIOS.map(r => { const d = sweepRow(kk, r, depth)!['ndcg@10'] - BASELINE.dev_ndcg10; const a = Math.sqrt(Math.min(1, Math.abs(d) / span)); return <td key={r}><button aria-pressed={kk === k && r === ratio} aria-label={`k ${kk}, ${r}: ${signed(d)}`} style={{ background: d >= 0 ? `rgba(47,107,53,${a})` : `rgba(163,58,31,${a})` }} onClick={() => { setK(kk); setRatio(r); }}>{kk === WINNER.k && r === WINNER.ratio && depth === WINNER.depth ? '★' : ''}</button></td>; })}</tr>)}
        </tbody></table>
        <figcaption className="caption">NDCG@10 VS BASELINE AT DEPTH {depth} · GREEN BETTER · RUST WORSE · ★ DEV WINNER</figcaption>
      </figure>
    </div>
    <p className="lab-verdict fail">E001: {DECISION}. Best of 315 settings (k {WINNER.k}, {WINNER.ratio}, depth {WINNER.depth}) moved dev NDCG@10 by {signed(WINNER.dev_delta)}, 95% CI [{signed(WINNER.dev_bootstrap_95ci[0])}, {signed(WINNER.dev_bootstrap_95ci[1])}], and confirmation by {signed(WINNER.conf_delta)}. Neither interval excludes zero.</p>

    <h4 className="lab-subhead">E002: a cross-encoder reading query and code together</h4>
    <table className="lab-table"><thead><tr><th>Rerank depth</th><th>Dev NDCG@10</th><th>Change (95% CI)</th></tr></thead><tbody>
      {RERANKER.map(r => <tr key={r.depth}><th>{r.depth}</th><td>{f4(r.ndcg10)}</td><td>{signed(r.ndcg10 - r.baseline)} [{signed(r.ci[0])}, {signed(r.ci[1])}]</td></tr>)}
    </tbody></table>
    <p className="lab-verdict fail">E002: REJECT. A general-domain model ({RERANKER[0].model}) made every depth significantly worse, and worse the deeper it read, at about {(RERANKER[0].medianLatencyMs / 1000).toFixed(1)} s per query on CPU.</p>
    <p className="lab-note">Both pointed at the model rather than the fusion, which is what the final decision changed: the code-trained dense model lifted dev NDCG@10 by 0.2293 and became the shipped retrieval.</p>
    <footer>
      <a href={astflowCommit(EXPERIMENT_COMMITS.fusion)} target="_blank" rel="noopener noreferrer">E001 COMMIT ↗</a>
      <a href={astflowCommit(EXPERIMENT_COMMITS.reranker)} target="_blank" rel="noopener noreferrer">E002 COMMIT ↗</a>
      <a href={astflowSource(SHIPPED.source)} target="_blank" rel="noopener noreferrer">RETRIEVAL BASELINE ↗</a>
      <a href={astflowSource('benchmark/run_fusion_sweep.py')} target="_blank" rel="noopener noreferrer">RUN_FUSION_SWEEP.PY ↗</a>
      <a href={astflowSource('benchmark/EXPERIMENTS.md')} target="_blank" rel="noopener noreferrer">EXPERIMENT LOG ↗</a>
      <a href={astflowSource('README.md')} target="_blank" rel="noopener noreferrer">README ↗</a>
    </footer>
  </section>;
}
