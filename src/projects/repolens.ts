/**
 * Browser port of RepoLens hybrid retrieval (harshjha15335/RepoLens @ 28fef67):
 * - BM25Index + code-aware tokenizer: backend/app/services/indexing/service.py
 * - DeterministicLocalEmbeddingProvider: backend/app/services/embeddings/service.py
 * - QueryAnalyzer intents and _rrf_fusion: backend/app/services/retrieval/service.py
 * tests/flagship.test.ts checks every ranking against the Python reference output
 * produced by scripts/projects/repolens_reference.py.
 */
import sample from './data/repolens-calculator.json';

export interface CodeChunk { file_path: string; symbol_name: string; symbol_type: string; parent_symbol: string | null; start_line: number; end_line: number; content: string }
export type Ranked = [index: number, score: number][];

export const repolensSample = sample as unknown as { repository: string; commit: string; sampleRepo: string; chunking: string; chunks: CodeChunk[]; reference: { query: string; bm25: Ranked; dense: Ranked }[]; embeddingProbe: { text: string; nonzero: [number, number][] }; md5Probe: string };

const WORD = /[a-zA-Z_][a-zA-Z0-9_]*|[0-9]+/g;
const CAMEL = /[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\d|\b)/g;

/** BM25Index._split_tokens */
export function splitTokens(text: string) {
  const tokens: string[] = [];
  for (const word of text.match(WORD) ?? []) {
    tokens.push(word.toLowerCase());
    for (const part of word.match(CAMEL) ?? []) {
      const lower = part.toLowerCase();
      if (lower !== word.toLowerCase() && lower.length > 1) tokens.push(lower);
    }
    if (word.includes('_')) for (const part of word.split('_')) if (part && part.length > 1) tokens.push(part.toLowerCase());
  }
  return tokens;
}

export class BM25Index {
  private tf: Map<string, number>[] = [];
  private lens: number[] = [];
  private df = new Map<string, number>();
  private avg = 0;
  constructor(chunks: CodeChunk[], private k1 = 1.5, private b = .75) {
    for (const chunk of chunks) {
      const tokens = splitTokens([chunk.content, chunk.symbol_name, chunk.file_path].filter(Boolean).join(' '));
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.tf.push(tf); this.lens.push(tokens.length);
    }
    this.avg = this.lens.reduce((a, b) => a + b, 0) / Math.max(1, this.lens.length);
  }
  search(query: string, topK = 20): Ranked {
    const n = this.tf.length, terms = splitTokens(query), out: Ranked = [];
    this.tf.forEach((tf, i) => {
      let score = 0;
      for (const term of terms) {
        const f = tf.get(term); if (!f) continue;
        const df = this.df.get(term) ?? 0;
        const idf = Math.log((n - df + .5) / (df + .5) + 1);
        score += idf * (f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + this.b * this.lens[i] / this.avg));
      }
      if (score > 0) out.push([i, score]);
    });
    return out.sort((a, b) => b[1] - a[1]).slice(0, topK);
  }
}

// RFC 1321 MD5 over UTF-8 bytes; RepoLens hashes tokens and n-grams with hashlib.md5.
const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
export function md5(text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  const padded = new Uint8Array(((bytes.length + 8 >> 6) + 1) * 64);
  padded.set(bytes); padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bytes.length * 8 >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bytes.length / 0x20000000), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let off = 0; off < padded.length; off += 64) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const tmp = d; d = c; c = b;
      const sum = (a + f + K[i] + view.getUint32(off + g * 4, true)) >>> 0;
      const s = S[(i >> 4) * 4 + (i & 3)];
      b = (b + ((sum << s) | (sum >>> (32 - s)))) >>> 0; a = tmp;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  const out = new Uint8Array(16), ov = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((v, i) => ov.setUint32(i * 4, v, true));
  return out;
}
const u32 = (h: Uint8Array, at: number) => (h[at] | h[at + 1] << 8 | h[at + 2] << 16 | h[at + 3] << 24) >>> 0;

/** DeterministicLocalEmbeddingProvider._embed_text_sync (dimension 384). Float32 accumulation as numpy. */
export function embed(text: string, dim = 384) {
  const vec = new Float32Array(dim);
  if (!text.trim()) { vec[0] = 1; return vec; }
  for (const token of text.match(WORD) ?? []) {
    const lower = token.toLowerCase(), h = md5(lower);
    const weight = token.length > 3 ? 2 : 1;
    vec[u32(h, 0) % dim] += (h[8] % 2 === 0 ? 1 : -1) * weight;
    vec[u32(h, 4) % dim] += (h[9] % 2 === 0 ? 1 : -1) * weight * .5;
    if (lower.length >= 3) for (const n of [3, 4]) for (let i = 0; i + n <= lower.length; i++) {
      const g = md5(lower.slice(i, i + n));
      vec[u32(g, 0) % dim] += (g[4] % 2 === 0 ? 1 : -1) * .4;
    }
  }
  let norm = 0; for (const v of vec) norm += v * v; norm = Math.sqrt(norm);
  if (norm > 1e-6) for (let i = 0; i < dim; i++) vec[i] /= norm; else vec[0] = 1;
  return vec;
}

export function denseSearch(vectors: Float32Array[], query: string, topK = 20): Ranked {
  const q = embed(query);
  return vectors.map((v, i): [number, number] => { let s = 0; for (let j = 0; j < v.length; j++) s += v[j] * q[j]; return [i, s]; })
    .sort((a, b) => b[1] - a[1]).slice(0, topK);
}

/** RetrievalService._rrf_fusion: RRF(d) = Σ weight_i / (k + rank_i(d)). */
export function rrfFusion(dense: Ranked, bm25: Ranked, k = 60, denseWeight = .6): Ranked {
  const scores = new Map<number, number>();
  dense.forEach(([i], rank) => scores.set(i, (scores.get(i) ?? 0) + denseWeight / (k + rank + 1)));
  bm25.forEach(([i], rank) => scores.set(i, (scores.get(i) ?? 0) + (1 - denseWeight) / (k + rank + 1)));
  return [...scores].sort((a, b) => b[1] - a[1]);
}

const INTENTS: [string, RegExp[]][] = [
  ['REPOSITORY_OVERVIEW', [/what does this (?:repo|repository|project|codebase) do/, /overview/, /describe (?:this|the) (?:repo|repository|project)/, /what is this/]],
  ['SYMBOL_LOOKUP', [/where is (\w+) (?:defined|declared|implemented|used)/, /find (\w+)/, /locate (\w+)/, /show me (\w+)/]],
  ['ARCHITECTURE', [/architecture/, /structure/, /how is .* organized/, /design pattern/, /component/]],
  ['CALL_FLOW', [/what calls/, /who calls/, /call(?:s|ed by|ers)/, /what happens (?:when|after|before)/, /flow/, /lifecycle/, /request.*lifecycle/]],
  ['DEPENDENCY', [/depend(?:s|encies|ency)/, /import(?:s|ed)/, /require(?:s|d)/, /what (?:does|files) .* (?:use|need|require)/]],
  ['DEBUGGING', [/debug/, /error/, /exception/, /bug/, /fix/, /issue/, /wrong/, /fail/, /crash/]],
  ['IMPLEMENTATION_EXPLANATION', [/explain/, /how does .* work/, /what does .* do/, /walk.* through/, /line by line/]],
  ['DOCUMENTATION', [/document/, /readme/, /usage/, /example/, /how to use/]],
];
/** QueryAnalyzer.analyze: the intent decides whether fusion leans lexical (0.4 dense) or semantic (0.6). */
export function analyzeQuery(query: string) {
  const q = query.toLowerCase().trim();
  const intent = INTENTS.find(([, patterns]) => patterns.some(p => p.test(q)))?.[0] ?? 'GENERAL_CODE_QUESTION';
  const emphasizeLexical = intent === 'SYMBOL_LOOKUP' || intent === 'DEPENDENCY';
  return { intent, emphasizeLexical, denseWeight: emphasizeLexical ? .4 : .6 };
}

export function hybridSearch(query: string, index: BM25Index, vectors: Float32Array[]) {
  const analysis = analyzeQuery(query), dense = denseSearch(vectors, query), bm25 = index.search(query);
  return { ...analysis, tokens: splitTokens(query), dense, bm25, fused: rrfFusion(dense, bm25, 60, analysis.denseWeight) };
}
