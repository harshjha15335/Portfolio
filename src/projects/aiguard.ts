/**
 * How NORTHSTAR treats a language model's reply before trusting it.
 *
 * NORTHSTAR @ 10e96d3 (trading-platform/backend/app):
 * - XAIProvider.propose: strips a ``` fence, then TradeProposal.model_validate_json (agents.py)
 * - TradeProposal: a Pydantic model with extra="forbid", allow_inf_nan=False and per-field bounds (schemas.py)
 * - DecisionAgent.decide: identity, quote, quantity and source checks after validation (agents.py)
 * Tested against the real Pydantic model and DecisionAgent: scripts/projects/northstar_guard_reference.py.
 */
export const NORTHSTAR_COMMIT = '10e96d3807b9d302cf33c03f29ff37b97232beb2';
export const northstarFile = (path: string) => `https://github.com/harshjha15335/NORTHSTAR/blob/${NORTHSTAR_COMMIT}/trading-platform/backend/app/${path}`;

export interface FieldError { loc: string[]; type: string; msg: string }
export interface Evidence { symbol: string; cycle_id: string; quote: { price: string }; source_ids: string[] }
export type GuardResult =
  | { stage: 'schema'; cleaned: string; errors: FieldError[]; outward: string }
  | { stage: 'decision'; cleaned: string; message: string; outward: string }
  | { stage: 'accepted'; cleaned: string; proposal: Record<string, unknown> };

/** XAIProvider.propose's cleanup, line for line. */
export function stripFences(content: string) {
  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.includes('\n') ? cleaned.split('\n').slice(1).join('\n') : cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3).trim();
  }
  return cleaned;
}

type Kind = { t: 'str' } | { t: 'dec'; ge?: number; le?: number; gt?: number } | { t: 'int'; ge: number } | { t: 'list' } | { t: 'literal'; values: string[] } | { t: 'datetime' };
const str = { t: 'str' } as const, list = { t: 'list' } as const;
/** TradeProposal fields in declaration order; `optional` ones have defaults. */
const FIELDS: [string, Kind, boolean?][] = [
  ['proposal_id', str, true], ['cycle_id', str], ['timestamp', { t: 'datetime' }, true], ['symbol', str],
  ['action', { t: 'literal', values: ['BUY', 'SELL', 'HOLD', 'NO_ACTION'] }],
  ['confidence', { t: 'dec', ge: 0, le: 1 }], ['current_price', { t: 'dec', gt: 0 }],
  ['proposed_quantity', { t: 'int', ge: 0 }], ['estimated_order_value', { t: 'dec', ge: 0 }], ['maximum_entry_price', { t: 'dec', gt: 0 }],
  ...(['thesis', 'why_now', 'fundamental_view', 'technical_view', 'news_view', 'quant_view', 'portfolio_context', 'bull_case', 'base_case', 'bear_case'] as const).map(n => [n, str] as [string, Kind]),
  ['supporting_factors', list], ['major_risks', list], ['entry_conditions', list], ['invalidation_conditions', list],
  ['expected_holding_period', str], ['source_ids', list],
];
export const PROPOSAL_FIELDS = FIELDS.map(([name]) => name);

const NUMERIC = /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/;
function decimal(value: unknown): number | FieldError['type'] {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 'decimal_type';
  if (/^\s*[+-]?(inf|infinity|nan)\s*$/i.test(value)) return 'finite_number';
  return NUMERIC.test(value) ? Number(value) : 'decimal_parsing';
}

/** TradeProposal.model_validate_json, for the constraints the model declares. */
export function validateProposal(cleaned: string): { errors: FieldError[]; value?: Record<string, number | string | string[]> } {
  let data: unknown;
  try { data = JSON.parse(cleaned); } catch (e) { return { errors: [{ loc: [], type: 'json_invalid', msg: `Invalid JSON: ${(e as Error).message}` }] }; }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { errors: [{ loc: [], type: 'model_type', msg: 'Input should be an object' }] };
  const input = data as Record<string, unknown>;
  // JSON.parse turns 1.0 into 1, but Pydantic's strict int rejects a JSON float, so look at the text.
  const floatQuantity = /"proposed_quantity"\s*:\s*-?\d+(\.\d*|[eE])/.test(cleaned);
  const errors: FieldError[] = Object.keys(input).filter(k => !PROPOSAL_FIELDS.includes(k)).map(k => ({ loc: [k], type: 'extra_forbidden', msg: 'Extra inputs are not permitted' }));
  const value: Record<string, number | string | string[]> = {};
  const fail = (loc: string[], type: string, msg: string) => errors.push({ loc, type, msg });
  for (const [name, kind, optional] of FIELDS) {
    if (!(name in input)) { if (!optional) fail([name], 'missing', 'Field required'); continue; }
    const v = input[name];
    if (kind.t === 'str') { if (typeof v === 'string') value[name] = v; else fail([name], 'string_type', 'Input should be a valid string'); }
    else if (kind.t === 'literal') { if (typeof v === 'string' && kind.values.includes(v)) value[name] = v; else fail([name], 'literal_error', `Input should be ${kind.values.slice(0, -1).map(x => `'${x}'`).join(', ')} or '${kind.values.at(-1)}'`); }
    else if (kind.t === 'datetime') { if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) value[name] = v; else fail([name], 'datetime_from_date_parsing', 'Input should be a valid datetime or date'); }
    else if (kind.t === 'list') {
      if (!Array.isArray(v)) { fail([name], 'list_type', 'Input should be a valid array'); continue; }
      v.forEach((item, i) => { if (typeof item !== 'string') fail([name, String(i)], 'string_type', 'Input should be a valid string'); });
      value[name] = v;
    } else if (kind.t === 'int') {
      if (typeof v !== 'number' || !Number.isInteger(v) || floatQuantity) fail([name], 'int_type', 'Input should be a valid integer');
      else if (v < kind.ge) fail([name], 'greater_than_equal', `Input should be greater than or equal to ${kind.ge}`);
      else value[name] = v;
    } else {
      const n = decimal(v);
      if (typeof n === 'string') fail([name], n, n === 'decimal_type' ? 'Decimal input should be an integer, float, string or Decimal object' : n === 'finite_number' ? 'Input should be a finite number' : 'Input should be a valid decimal');
      else if (kind.gt !== undefined && !(n > kind.gt)) fail([name], 'greater_than', `Input should be greater than ${kind.gt}`);
      else if (kind.ge !== undefined && n < kind.ge) fail([name], 'greater_than_equal', `Input should be greater than or equal to ${kind.ge}`);
      else if (kind.le !== undefined && n > kind.le) fail([name], 'less_than_equal', `Input should be less than or equal to ${kind.le}`);
      else value[name] = n;
    }
  }
  return errors.length ? { errors } : { errors, value };
}

/** DecisionAgent.decide's checks after validation, in the same order and with the same messages. */
export function decisionCheck(p: Record<string, number | string | string[]>, evidence: Evidence): string | null {
  if (p.symbol !== evidence.symbol || p.cycle_id !== evidence.cycle_id) return 'AI changed the assigned cycle or instrument identity';
  const quote = Number(evidence.quote.price), quantity = p.proposed_quantity as number;
  if (p.current_price !== quote) return 'AI current price does not match the supplied quote';
  if (p.estimated_order_value !== quote * quantity) return 'AI order value does not match supplied quote and quantity';
  if ((p.action === 'HOLD' || p.action === 'NO_ACTION') && quantity !== 0) return 'AI non-trade action included a trade quantity';
  if ((p.action === 'BUY' || p.action === 'SELL') && quantity === 0) return 'AI trade action omitted a trade quantity';
  const sources = p.source_ids as string[];
  if (new Set(sources).size !== sources.length) return 'AI returned duplicate source identifiers';
  if (!sources.every(s => evidence.source_ids.includes(s))) return 'AI referenced a source that was not retrieved';
  return null;
}

export function northstarGuard(raw: string, evidence: Evidence): GuardResult {
  const cleaned = stripFences(raw);
  const { errors, value } = validateProposal(cleaned);
  // XAIProvider wraps every parse/validation failure in one safe message for callers.
  if (!value) return { stage: 'schema', cleaned, errors, outward: 'XAIProviderError: xAI returned an invalid structured response' };
  const message = decisionCheck(value, evidence);
  if (message) return { stage: 'decision', cleaned, message, outward: `ValueError: ${message}` };
  return { stage: 'accepted', cleaned, proposal: value };
}

