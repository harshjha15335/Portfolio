"""Build the Powai ASTFLOW lab data from an ASTFLOW checkout.

Usage: python3 -I scripts/projects/astflow_reference.py <astflow-checkout> <out.json>

ASTFLOW is a team project (Samsung PRISM 2026, team ByteCoders). The lab shows Harsh's part of
it: the E001 fusion experiment and the E002 reranker experiment. This script:
- loads `load_ranks` (analyze_baseline.py) and `rrf_for_queries` / `evaluate_rankings`
  (run_fusion_sweep.py, from Harsh's commit 0a60b37) from the checkout and runs them unchanged;
- re-scores the E001 dev winner on all 1,859 dev queries and checks it equals the archived sweep;
- picks a handful of dev queries (deterministically, by category) and records their frozen
  baseline-v1 BM25 and dense rankings, plus the fused ranking ASTFLOW's own code produces for a grid
  of k / weight / depth settings. The portfolio's TypeScript port (src/projects/astflow.ts) is
  tested against those rankings;
- copies the 315 archived sweep rows (selected fields) and the E002 dev results.
"""
import ast
import gzip
import json
import math
import sys
import textwrap
from pathlib import Path

root, out = Path(sys.argv[1]), Path(sys.argv[2])
bench = root / "benchmark"


def load(path: Path, names: list[str], ns: dict):
    source = path.read_text()
    for node in ast.parse(source).body:
        if isinstance(node, ast.FunctionDef) and node.name in names:
            exec(textwrap.dedent(ast.get_source_segment(source, node)), ns)
    missing = [n for n in names if n not in ns]
    if missing:
        raise SystemExit(f"{missing} not found in {path}")


ns = {"gzip": gzip, "math": math, "Path": Path}
load(bench / "analyze_baseline.py", ["load_ranks"], ns)
load(bench / "run_fusion_sweep.py", ["rrf_for_queries", "evaluate_rankings"], ns)
load_ranks, rrf_for_queries, evaluate_rankings = ns["load_ranks"], ns["rrf_for_queries"], ns["evaluate_rankings"]

ranks = bench / "verification" / "ranks"
bm25 = load_ranks(ranks / "baseline-v1-bm25.ranks.tsv.gz")
dense = load_ranks(ranks / "baseline-v1-dense.ranks.tsv.gz")
hybrid = load_ranks(ranks / "baseline-v1-hybrid.ranks.tsv.gz")
split = json.loads((bench / "dev_split.json").read_text())
dev = split["dev_query_ids"]
qrels = {}
for line in (bench / "verification" / "apps.qrels").read_text().splitlines():
    if line.strip():
        qid, _, did, grade = line.split()
        if int(grade) > 0:
            qrels[qid] = did

sweep = json.loads((bench / "results" / "fusion_sweep_e001.json").read_text())
w = sweep["dev_winner"]
check = evaluate_rankings(rrf_for_queries(bm25, dense, dev, k=w["k"], w_lex=w["w_bm25"], w_sem=w["w_dense"], depth=w["depth"]), dev, qrels)
assert abs(check["ndcg@10"] - w["dev_winner_ndcg10"]) < 1e-12, (check["ndcg@10"], w["dev_winner_ndcg10"])
base = evaluate_rankings({q: hybrid[q] for q in dev}, dev, qrels)
assert abs(base["ndcg@10"] - w["dev_baseline_ndcg10"]) < 1e-12


def rank_of(lst, doc, cut=100):
    return lst.index(doc) + 1 if doc in lst[:cut] else None


# Deterministic sample: the first dev query (in split order) of each kind, by top-100 presence.
def kind_of(qid):
    rel = qrels[qid]
    b, d, h = rank_of(bm25[qid], rel), rank_of(dense[qid], rel), rank_of(hybrid[qid], rel)
    if b == 1 and d == 1:
        return "both-top"
    if b is not None and b <= 3 and d is None:
        return "bm25-only"
    if d is not None and d <= 3 and b is None:
        return "dense-only"
    if (b is not None or d is not None) and h is None:
        return "lost-by-fusion"
    if b is None and d is None:
        return "neither"
    return None


sample = []
for kind in ("both-top", "bm25-only", "dense-only", "lost-by-fusion", "neither"):
    sample.append((kind, next(q for q in dev if kind_of(q) == kind)))

GRID = [(k, wl, ws, depth) for k in (10, 30, 60, 100) for wl, ws in ((1.0, 1.0), (3.0, 1.0), (1.0, 3.0), (1.0, 0.0), (0.0, 1.0)) for depth in (10, 100, 1000)]
queries = []
for kind, qid in sample:
    rel = qrels[qid]
    expected = []
    for k, wl, ws, depth in GRID:
        fused = rrf_for_queries(bm25, dense, [qid], k=k, w_lex=wl, w_sem=ws, depth=depth)[qid]
        expected.append({"k": k, "w_bm25": wl, "w_dense": ws, "depth": depth, "top10": fused[:10], "relevantRank": fused.index(rel) + 1 if rel in fused else None})
    assert rrf_for_queries(bm25, dense, [qid], k=60, depth=1000)[qid] == hybrid[qid]
    queries.append({"id": qid, "kind": kind, "relevant": rel, "bm25": bm25[qid][:1000], "dense": dense[qid][:1000], "expected": expected})

FIELDS = ["k", "w_bm25", "w_dense", "ratio", "depth", "ndcg@10", "mrr@10", "recall@10", "recall@100", "hits@10", "hits@100", "lost_by_fusion", "bm25_only_survived", "bm25_only_total", "dense_only_survived", "dense_only_total"]
reranker = {}
for d in (20, 50, 100):
    r = json.loads((bench / "results" / f"reranker_dev_d{d}.json").read_text())
    reranker[d] = r

out.write_text(json.dumps({
    "source": "ANUJ-DESHPANDE/ASTFLOW",
    "commit": __import__("subprocess").check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip(),
    "splits": {"dev": len(dev), "confirmation": len(split["confirmation_query_ids"]), "documents": 8765},
    "baseline": {"k": 60, "w_bm25": 1.0, "w_dense": 1.0, "depth": 1000, "dev_ndcg10": w["dev_baseline_ndcg10"], "dev_mrr10": base["mrr@10"], "dev_recall100": base["recall@100"]},
    "winner": {k: w[k] for k in ("k", "w_bm25", "w_dense", "ratio", "depth", "dev_winner_ndcg10", "dev_delta", "dev_bootstrap_95ci", "conf_baseline_ndcg10", "conf_winner_ndcg10", "conf_delta", "conf_bootstrap_95ci")},
    "decision": sweep["decision"],
    "sweep": [{f: c[f] for f in FIELDS} for c in sweep["configs"]],
    "rerankerDev": reranker,
    "queries": queries,
}, separators=(",", ":")) + "\n")
print(f"verified dev winner {check['ndcg@10']:.5f} and baseline {base['ndcg@10']:.5f}; sample {[(k, q) for k, q in sample]}; wrote {out}")
