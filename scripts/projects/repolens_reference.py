"""Build the Powai RepoLens exhibit data from a RepoLens checkout.

Usage: python3 -I scripts/projects/repolens_reference.py <repolens-checkout> <out.json>

The BM25 index class and the deterministic local embedding function are
loaded from the checkout's own source and executed unchanged, so the JSON's
reference rankings are what RepoLens itself computes. The portfolio's
TypeScript port (src/projects/repolens.ts) is tested against them.

Chunking: RepoLens chunks with Tree-sitter. This script splits the sample
calculator into one chunk per class header and per method with Python's ast
module, which is the same granularity but not the same code path.
"""
import ast
import hashlib
import json
import math
import re
import subprocess
import sys
import textwrap
from collections import Counter
from pathlib import Path

import numpy as np

root, out = Path(sys.argv[1]), Path(sys.argv[2])
backend = root / "backend/app/services"


def load_definition(path: Path, name: str, namespace: dict):
    source = path.read_text()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, (ast.ClassDef, ast.FunctionDef)) and node.name == name:
            exec(textwrap.dedent(ast.get_source_segment(source, node)), namespace)
            return namespace[name]
    raise SystemExit(f"{name} not found in {path}")


ns = {"Counter": Counter, "math": math, "re": re, "np": np, "logger": None}
BM25Index = load_definition(backend / "indexing/service.py", "BM25Index", ns)
embed = load_definition(backend / "embeddings/service.py", "_embed_text_sync", ns)


class Embedder:
    _dimension = 384


def dense(text):
    return np.array(embed(Embedder, text), dtype=np.float32)


chunks = []
for path in sorted((root / "sample-repos/calculator/src").glob("*.py")):
    rel = f"src/{path.name}"
    source = path.read_text()
    lines = source.splitlines()
    for node in ast.parse(source).body:
        if isinstance(node, ast.ClassDef):
            body = [n for n in node.body if isinstance(n, ast.FunctionDef)]
            header_end = (body[0].lineno - 1) if body else node.end_lineno
            chunks.append((rel, node.name, "class", node.lineno, header_end, None))
            for fn in body:
                start = fn.decorator_list[0].lineno if fn.decorator_list else fn.lineno
                chunks.append((rel, fn.name, "method", start, fn.end_lineno, node.name))
        elif isinstance(node, ast.FunctionDef):
            chunks.append((rel, node.name, "function", node.lineno, node.end_lineno, None))

records = []
for rel, name, kind, start, end, parent in chunks:
    text = "\n".join((root / "sample-repos/calculator" / rel).read_text().splitlines()[start - 1:end]).rstrip()
    records.append({"file_path": rel, "symbol_name": name, "symbol_type": kind, "parent_symbol": parent,
                    "start_line": start, "end_line": end, "content": text})

bm25 = BM25Index()
bm25.build([{**r, "content_hash": str(i)} for i, r in enumerate(records)])
vectors = np.stack([dense(r["content"]) for r in records])

queries = [
    "where is divide defined",
    "how does the expression parser handle operator precedence",
    "what happens on division by zero",
    "history tracking",
]
reference = []
for q in queries:
    lexical = bm25.search(q, 20)
    scores = vectors @ dense(q)
    semantic = sorted(range(len(records)), key=lambda i: -scores[i])[:20]
    reference.append({
        "query": q,
        "bm25": [[i, round(s, 6)] for i, s in lexical],
        "dense": [[i, round(float(scores[i]), 6)] for i in semantic],
    })

commit = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
probe = "getUserProfile parse_expression"
out.write_text(json.dumps({
    "repository": "https://github.com/harshjha15335/RepoLens",
    "commit": commit,
    "sampleRepo": "sample-repos/calculator",
    "chunking": "one chunk per class header and per method (Python ast); RepoLens itself uses Tree-sitter",
    "chunks": records,
    "reference": reference,
    "embeddingProbe": {"text": probe, "nonzero": [[int(i), round(float(v), 6)] for i, v in enumerate(dense(probe)) if abs(v) > 1e-9]},
    "md5Probe": hashlib.md5(b"divide").hexdigest(),
}, indent=1, ensure_ascii=False) + "\n")
print(f"{len(records)} chunks, commit {commit[:7]} -> {out}")
