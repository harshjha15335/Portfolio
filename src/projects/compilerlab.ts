/**
 * Browser port of Compiler Lab's regular expression → DFA direct method
 * (harshjha15335/CompilerLab-OPP-RegexDFA @ 3d7915d):
 * - parseRegex: src/algorithms/regex.js (| union, implicit concatenation, * + ?, ( ), \x escapes; # reserved)
 * - buildDirect: src/algorithms/direct.js (augment with #, nullable / firstpos / lastpos, followpos, DFA by sets of positions)
 * - simulateDfa: src/algorithms/direct.js
 * The step records the original emits for its replay player are left out; tests/compilerlab.test.ts
 * repeats the repository's own partB tests against this port.
 */
export const COMPILERLAB_COMMIT = '3d7915db8a6d2de7e1fc4642ae1d8765687e4d94';
export const compilerlabSource = (path: string) => `https://github.com/harshjha15335/CompilerLab-OPP-RegexDFA/blob/${COMPILERLAB_COMMIT}/${path}`;

export type NodeType = 'leaf' | 'or' | 'cat' | 'star' | 'plus' | 'opt';
export interface RegexNode {
  type: NodeType; children?: RegexNode[]; symbol?: string; isEnd?: boolean;
  id?: number; pos?: number; nullable?: boolean; first?: number[]; last?: number[];
}
export type ParseResult = { ok: true; ast: RegexNode } | { ok: false; error: string; position?: number };

/** Regex → AST. Syntax: | union, implicit concatenation, * + ?, ( ), \x escapes. '#' is reserved (use \#). */
export function parseRegex(src: string): ParseResult {
  let i = 0;
  const err = (message: string, pos = i): never => { throw Object.assign(new Error(message), { pos }); };
  function expr(): RegexNode {
    let left = term();
    while (src[i] === '|') {
      const at = i; i++;
      if (i >= src.length || src[i] === ')' || src[i] === '|') err(`Nothing after "|" at position ${at + 1}.`, at);
      left = { type: 'or', children: [left, term()] };
    }
    return left;
  }
  function term(): RegexNode {
    let left = factor();
    while (i < src.length && src[i] !== '|' && src[i] !== ')') left = { type: 'cat', children: [left, factor()] };
    return left;
  }
  function factor(): RegexNode {
    let node = atom();
    while (src[i] === '*' || src[i] === '+' || src[i] === '?') {
      node = { type: src[i] === '*' ? 'star' : src[i] === '+' ? 'plus' : 'opt', children: [node] };
      i++;
    }
    return node;
  }
  function atom(): RegexNode {
    const c = src[i];
    if (c === undefined) err('Expression ended unexpectedly.');
    if (c === '(') {
      const at = i; i++;
      if (src[i] === ')') err(`Empty group at position ${at + 1}.`, at);
      const e = expr();
      if (src[i] !== ')') err(`The "(" at position ${at + 1} has no closing ")". Close it, or write \\( for a literal parenthesis.`, at);
      i++; return e;
    }
    if (c === ')') err(`Unmatched ")" at position ${i + 1}.`);
    if (c === '*' || c === '+' || c === '?') err(`"${c}" at position ${i + 1} has nothing to repeat.`);
    if (c === '|') err(`Nothing before "|" at position ${i + 1}.`);
    if (c === '#') err('"#" is reserved for direct-method augmentation. Write \\# for a literal "#".');
    if (c === '\\') {
      if (i + 1 >= src.length) err('Trailing "\\" has nothing to escape.');
      const lit = src[i + 1]; i += 2; return { type: 'leaf', symbol: lit };
    }
    i++; return { type: 'leaf', symbol: c };
  }
  try {
    if (!src.length) err('Enter a regular expression.');
    const ast = expr();
    if (i < src.length) err(`Unexpected "${src[i]}" at position ${i + 1}.`);
    return { ok: true, ast };
  } catch (e) {
    return { ok: false, error: (e as Error).message, position: (e as { pos?: number }).pos };
  }
}

export interface DfaState { name: string; positions: number[]; accepting: boolean }
export interface Dfa { states: DfaState[]; alphabet: string[]; start: string; accepting: string[]; transitions: { from: string; symbol: string; to: string }[] }
export interface DirectResult { root: RegexNode; nodes: RegexNode[]; leaves: RegexNode[]; followpos: Record<number, number[]>; dfa: Dfa; endPos: number }

const U = (...ss: number[][]) => [...new Set(ss.flat())].sort((a, b) => a - b);

/** Direct RE → DFA (followpos method). */
export function buildDirect(ast: RegexNode): DirectResult {
  const root: RegexNode = { type: 'cat', children: [ast, { type: 'leaf', symbol: '#', isEnd: true }] };
  let nid = 0, pos = 0;
  const nodes: RegexNode[] = [];
  (function number(n: RegexNode) {
    n.children?.forEach(number); // post-order ids; leaves numbered left to right
    if (n.type === 'leaf') n.pos = ++pos;
    n.id = ++nid; nodes.push(n);
  })(root);
  for (const n of nodes) {
    const [a, b] = n.children ?? [];
    switch (n.type) {
      case 'leaf': Object.assign(n, { nullable: false, first: [n.pos!], last: [n.pos!] }); break;
      case 'or': Object.assign(n, { nullable: a.nullable || b.nullable, first: U(a.first!, b.first!), last: U(a.last!, b.last!) }); break;
      case 'cat': Object.assign(n, { nullable: a.nullable && b.nullable, first: a.nullable ? U(a.first!, b.first!) : a.first, last: b.nullable ? U(a.last!, b.last!) : b.last }); break;
      case 'star': Object.assign(n, { nullable: true, first: a.first, last: a.last }); break;
      case 'plus': Object.assign(n, { nullable: a.nullable, first: a.first, last: a.last }); break;
      case 'opt': Object.assign(n, { nullable: true, first: a.first, last: a.last }); break;
    }
  }
  const leaves = nodes.filter(n => n.type === 'leaf').sort((x, y) => x.pos! - y.pos!);
  const symbolAt = Object.fromEntries(leaves.map(l => [l.pos!, l.symbol!]));
  const endPos = leaves[leaves.length - 1].pos!;
  const follow: Record<number, number[]> = Object.fromEntries(leaves.map(l => [l.pos!, [] as number[]]));
  for (const n of nodes) {
    if (n.type === 'cat') { const [a, b] = n.children!; for (const p of a.last!) follow[p] = U(follow[p], b.first!); }
    else if (n.type === 'star' || n.type === 'plus') for (const p of n.last!) follow[p] = U(follow[p], n.first!);
  }
  // DFA by subset-of-positions construction.
  const alphabet = [...new Set(leaves.filter(l => !l.isEnd).map(l => l.symbol!))].sort();
  const name = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `S${i}`);
  const states: DfaState[] = [], transitions: Dfa['transitions'] = [];
  const same = (x: number[], y: number[]) => x.length === y.length && x.every((v, i) => v === y[i]);
  const addState = (positions: number[]) => {
    let s = states.find(q => same(q.positions, positions));
    if (s) return s;
    s = { name: name(states.length), positions, accepting: positions.includes(endPos) };
    states.push(s); return s;
  };
  const start = addState(root.first!);
  for (let qi = 0; qi < states.length; qi++) {
    const q = states[qi];
    for (const a of alphabet) {
      const target = U(...q.positions.filter(p => symbolAt[p] === a).map(p => follow[p]));
      if (!target.length) continue;
      transitions.push({ from: q.name, symbol: a, to: addState(target).name });
    }
  }
  const dfa: Dfa = { states, alphabet, start: start.name, accepting: states.filter(s => s.accepting).map(s => s.name), transitions };
  return { root, nodes, leaves, followpos: follow, dfa, endPos };
}

export interface SimStep { from: string; symbol: string; to: string | null }
/** Run the DFA over the input. A missing transition rejects (the DFA is partial: no dead state). */
export function simulateDfa(dfa: Dfa, input: string) {
  const steps: SimStep[] = []; let cur = dfa.start;
  for (const ch of input) {
    const t = dfa.transitions.find(x => x.from === cur && x.symbol === ch);
    steps.push({ from: cur, symbol: ch, to: t?.to ?? null });
    if (!t) return { result: 'REJECT' as const, steps, reason: `No transition from ${cur} on "${ch}".` };
    cur = t.to;
  }
  const ok = dfa.accepting.includes(cur);
  return { result: ok ? 'ACCEPT' as const : 'REJECT' as const, steps, reason: ok ? `Input consumed in accepting state ${cur}.` : `Input consumed but ${cur} is not accepting.` };
}

/** The repository's own sample library (src/data/samples.js). */
export const REGEX_SAMPLES = [
  { source: '(a|b)*abb', note: '6 positions, 4 states.', strings: ['abb', 'ab', 'aabb', 'babb', 'abba'] },
  { source: 'a(b|c)*d', note: 'Star over a union.', strings: ['ad', 'abcbd', 'abc'] },
  { source: '(ab|a)+b?', note: 'Plus and optional.', strings: ['ab', 'aab', 'abab', 'b'] },
  { source: 'a*b*c?', note: 'All factors nullable: the start state accepts.', strings: ['', 'aabbc', 'ca'] },
  { source: 'ab?c', note: 'Optional middle symbol.', strings: ['ac', 'abc', 'abbc'] },
];
