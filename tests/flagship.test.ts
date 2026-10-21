import { describe, expect, it } from 'vitest';
import { BM25Index, analyzeQuery, embed, md5, repolensSample, rrfFusion, denseSearch, splitTokens } from '../src/projects/repolens';
import { COMPANIES, DEFAULT_CONFIG, evaluateRisk, mockHistory, newLedger, paperFill, type Proposal, type Observation, type RiskContext } from '../src/projects/northstar';
import { alerts, monthTotals, parseBankSMS, syntheticLedger, weeklyAnomalies } from '../src/projects/moneymetrics';
import { SAMPLE_ANALYSIS, SAMPLE_MEETING, reminderOutcome, uncitedItems, validateMeeting } from '../src/projects/meeting';

const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

describe('RepoLens port matches the repository’s own Python output', () => {
  const index = new BM25Index(repolensSample.chunks);
  const vectors = repolensSample.chunks.map(c => embed(c.content));
  it('md5 agrees with hashlib', () => {
    expect(hex(md5('divide'))).toBe(repolensSample.md5Probe);
    expect(hex(md5(''))).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(hex(md5('The quick brown fox jumps over the lazy dog'))).toBe('9e107d9d372bb6826bd81d3542a419d6');
  });
  it('embedding equals the Python provider', () => {
    const probe = repolensSample.embeddingProbe;
    const vec = embed(probe.text);
    expect([...vec].filter(v => Math.abs(v) > 1e-6).length).toBe(probe.nonzero.length);
    for (const [i, v] of probe.nonzero) expect(vec[i]).toBeCloseTo(v, 5);
  });
  it.each(repolensSample.reference)('“$query” ranks identically for BM25 and dense', ref => {
    const bm25 = index.search(ref.query);
    expect(bm25.map(([i]) => i)).toEqual(ref.bm25.map(([i]) => i));
    bm25.forEach(([, s], k) => expect(s).toBeCloseTo(ref.bm25[k][1], 5));
    const dense = denseSearch(vectors, ref.query);
    dense.forEach(([, s], k) => expect(s).toBeCloseTo(ref.dense[k][1], 5));
  });
  it('tokenizer splits camelCase and snake_case like BM25Index._split_tokens', () => {
    expect(splitTokens('getUserProfile parse_expression')).toEqual(['getuserprofile', 'get', 'user', 'profile', 'parse_expression', 'parse', 'expression', 'parse', 'expression']);
  });
  it('symbol lookups lean lexical in fusion', () => {
    expect(analyzeQuery('where is divide defined')).toMatchObject({ intent: 'SYMBOL_LOOKUP', denseWeight: .4 });
    expect(analyzeQuery('history tracking').denseWeight).toBe(.6);
    expect(rrfFusion([[1, .9], [2, .8]], [[2, 3], [1, 2]], 60, .6)[0][0]).toBe(1);
  });
});

describe('NORTHSTAR risk desk', () => {
  const quote = (symbol: keyof typeof COMPANIES, age = 5): Observation => ({ symbol, price: COMPANIES[symbol][2], ageSeconds: age, tradeable: true, sessionOpen: true, instrument: 'NSE_CASH' });
  const ok: RiskContext = { killSwitch: false, brokerHealthy: true, brokerVerified: true, duplicate: false, alreadyOrdered: false };
  const buy = (over: Partial<Proposal> = {}): Proposal => ({ symbol: 'ITC', action: 'BUY', quantity: 1, confidence: .7, proposedPrice: 420, maximumEntryPrice: 424.2, ageSeconds: 30, ...over });
  const failed = (r: ReturnType<typeof evaluateRisk>) => r.checks.filter(c => c.status === 'FAIL').map(c => c.name);
  it('passes a small paper buy and evaluates every check from risk.py', () => {
    const r = evaluateRisk(buy(), quote('ITC'), newLedger(), ok);
    expect(r.checks).toHaveLength(29);
    expect(r.passed).toBe(true);
  });
  it('stale quotes, the kill switch and oversized orders each block execution', () => {
    expect(failed(evaluateRisk(buy(), quote('ITC', 121), newLedger(), ok))).toEqual(['fresh_market_data']);
    expect(failed(evaluateRisk(buy(), quote('ITC'), newLedger(), { ...ok, killSwitch: true }))).toEqual(['kill_switch']);
    expect(failed(evaluateRisk(buy({ quantity: 2 }), quote('ITC'), newLedger(), ok))).toEqual(['max_order']);
    expect(failed(evaluateRisk(buy({ proposedPrice: 440 }), quote('ITC'), newLedger(), ok))).toEqual(['price_deviation']);
    expect(failed(evaluateRisk(buy({ action: 'SELL' }), quote('ITC'), newLedger(), ok))).toEqual(['no_short_selling']);
    expect(failed(evaluateRisk(buy(), quote('ITC'), newLedger(), ok, { ...DEFAULT_CONFIG, mode: 'AUTONOMOUS' }))).toEqual(['mode', 'live_trading']);
  });
  it('the daily trade cap applies after three paper fills and the ledger reconciles', () => {
    let ledger = newLedger();
    for (let i = 0; i < 3; i++) ledger = paperFill(ledger, buy(), 420);
    const r = evaluateRisk(buy(), quote('ITC'), ledger, ok);
    expect(failed(r)).toContain('max_daily_trades');
    expect(failed(r)).not.toContain('ledger_consistent');
  });
  it('mock history follows market_data.py', () => {
    const h = mockHistory('ITC');
    expect(h).toHaveLength(260);
    expect(h[0]).toBeCloseTo(357, 4);
    expect(h[259]).toBeCloseTo(420 * (1 + .018 * Math.sin(259 / 9)), 3);
  });
});

describe('MoneyMetrics rules', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  it('a quiet ledger has no anomaly; an unusual week is flagged by the 40% rule', () => {
    expect(weeklyAnomalies(syntheticLedger(now, null), now).anomalies).toEqual([]);
    expect(weeklyAnomalies(syntheticLedger(now, 'Food & Drinks'), now).anomalies.map(a => a.cat)).toEqual(['Food & Drinks']);
  });
  it('categories averaging under ₹500 a week are never flagged', () => {
    const r = weeklyAnomalies(syntheticLedger(now, 'Entertainment'), now);
    expect(r.rows.find(x => x.cat === 'Entertainment')!.avg).toBeLessThan(500);
    expect(r.anomalies).toEqual([]);
  });
  it('budget alerts fire at 80% and 100%', () => {
    expect(alerts({ Entertainment: 3200, Shopping: 9000 }, []).map(a => a.type)).toEqual(['warning', 'critical']);
    expect(Object.keys(monthTotals(syntheticLedger(now, null), now)).length).toBeGreaterThan(0);
  });
  it('parses a bank SMS like sms.js', () => {
    expect(parseBankSMS('HDFC Bank: Rs.1,250.00 debited on 05-Oct-26 to VPA canteen@upi')).toEqual({ amount: 1250, type: 'expense', date: '2026-10-05', source: 'HDFC Transaction' });
    expect(parseBankSMS('On 01/10/2026 your a/c is credited with INR 25000')).toMatchObject({ amount: 25000, type: 'income', date: '2026-10-01' });
    expect(parseBankSMS('hello')).toBeNull();
  });
});

describe('Meeting Intelligence rules', () => {
  it('the sample meeting validates and every example item cites a real timestamp', () => {
    expect(validateMeeting(SAMPLE_MEETING).status).toBe(201);
    expect(uncitedItems(SAMPLE_ANALYSIS, SAMPLE_MEETING.transcript)).toEqual([]);
  });
  it('invalid input returns the VALIDATION_ERROR envelope', () => {
    const r = validateMeeting({ ...SAMPLE_MEETING, participants: [], transcript: [] });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ error: { code: 'VALIDATION_ERROR', details: [{ field: 'participants' }, { field: 'transcript' }] } });
  });
  it('reminders only go to overdue, unfinished items', () => {
    const now = new Date('2026-10-09T00:00:00Z');
    expect(reminderOutcome({ status: 'PENDING', dueDate: '2026-10-08' }, now, true).sent).toBe(true);
    expect(reminderOutcome({ status: 'COMPLETED', dueDate: '2026-10-08' }, now, true).overdue).toBe(false);
    expect(reminderOutcome({ status: 'PENDING', dueDate: '2026-10-08' }, now, false).history).toMatch(/Telegram not configured/);
  });
});
