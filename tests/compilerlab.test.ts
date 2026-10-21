import { describe, expect, it } from 'vitest';
import { buildDirect, parseRegex, simulateDfa } from '../src/projects/compilerlab';

// The repository's own test/partB.test.js, run against the port.
const build = (re: string) => { const p = parseRegex(re); if (!p.ok) throw new Error(p.error); return buildDirect(p.ast); };

describe('Compiler Lab: regex → DFA direct method', () => {
  it('(a|b)*abb# followpos and DFA match the textbook answer', () => {
    const r = build('(a|b)*abb');
    expect(r.leaves.map(l => `${l.symbol}${l.pos}`)).toEqual(['a1', 'b2', 'a3', 'b4', 'b5', '#6']);
    expect(r.followpos).toEqual({ 1: [1, 2, 3], 2: [1, 2, 3], 3: [4], 4: [5], 5: [6], 6: [] });
    expect(r.root.first).toEqual([1, 2, 3]);
    expect(r.dfa.states.map(s => [s.name, s.positions])).toEqual([['A', [1, 2, 3]], ['B', [1, 2, 3, 4]], ['C', [1, 2, 3, 5]], ['D', [1, 2, 3, 6]]]);
    expect(r.dfa.accepting).toEqual(['D']);
    expect(Object.fromEntries(r.dfa.transitions.map(t => [`${t.from}${t.symbol}`, t.to]))).toEqual({ Aa: 'B', Ab: 'A', Ba: 'B', Bb: 'C', Ca: 'B', Cb: 'D', Da: 'B', Db: 'A' });
  });
  it('node properties for (a|b)*abb#', () => {
    const r = build('(a|b)*abb'), star = r.nodes.find(n => n.type === 'star')!;
    expect([star.nullable, star.first, star.last]).toEqual([true, [1, 2], [1, 2]]);
    expect(r.nodes.find(n => n.type === 'or')!.nullable).toBe(false);
    expect(r.nodes.filter(n => n.type === 'cat')).toHaveLength(4);
    expect([r.root.nullable, r.root.last]).toEqual([false, [6]]);
  });
  it('simulates, with plus, optional and escapes', () => {
    const { dfa } = build('(a|b)*abb');
    for (const [s, ok] of [['abb', 1], ['aabb', 1], ['babb', 1], ['ab', 0], ['abba', 0], ['abc', 0]] as const) expect(simulateDfa(dfa, s).result).toBe(ok ? 'ACCEPT' : 'REJECT');
    expect(simulateDfa(build('ab+').dfa, 'abbb').result).toBe('ACCEPT');
    expect(simulateDfa(build('ab+').dfa, 'a').result).toBe('REJECT');
    const o = build('ab?c').dfa;
    expect([simulateDfa(o, 'ac').result, simulateDfa(o, 'abc').result, simulateDfa(o, 'abbc').result]).toEqual(['ACCEPT', 'ACCEPT', 'REJECT']);
    expect(simulateDfa(build('a\\*b').dfa, 'a*b').result).toBe('ACCEPT');
    expect(simulateDfa(build('\\#').dfa, '#').result).toBe('ACCEPT');
  });
  it('gives position-aware errors', () => {
    const error = (re: string) => { const p = parseRegex(re); return p.ok ? '' : p.error; };
    expect(error('(ab')).toMatch(/position 1.*closing/);
    expect(error('a)')).toMatch(/Unexpected "\)"/);
    expect(error('*a')).toMatch(/nothing to repeat/);
    expect(error('a#b')).toMatch(/reserved/);
    expect(error('a|')).toMatch(/Nothing after/);
    expect(parseRegex('').ok).toBe(false);
  });
  it('agrees with JS RegExp on every string up to length 6', () => {
    for (const re of ['(a|b)*abb', 'a(b|c)*d', '(ab|a)+b?', 'a*b*c?']) {
      const { dfa } = build(re), js = new RegExp(`^(?:${re})$`);
      const strings = [''];
      for (let len = 1; len <= 6; len++) for (const s of strings.filter(x => x.length === len - 1)) for (const c of 'abcd') strings.push(s + c);
      for (const s of strings) expect(simulateDfa(dfa, s).result === 'ACCEPT', `${re} on "${s}"`).toBe(js.test(s));
    }
  });
});
