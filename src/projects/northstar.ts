/**
 * NORTHSTAR paper-trading risk desk, ported from harshjha15335/NORTHSTAR @ 10e96d3:
 * - RiskEngine.evaluate: trading-platform/backend/app/risk.py (same 26 checks, same order)
 * - StrategyConfig defaults: trading-platform/backend/app/schemas.py
 * - MockMarketDataProvider prices and history: trading-platform/backend/app/market_data.py
 * - technical() moving averages: trading-platform/backend/app/quant.py
 * Everything here is the repository's MOCK mode. There is no market feed and no broker.
 */
export const NORTHSTAR_COMMIT = '10e96d3807b9d302cf33c03f29ff37b97232beb2';
export const northstarSource = (path: string) => `https://github.com/harshjha15335/NORTHSTAR/blob/${NORTHSTAR_COMMIT}/trading-platform/backend/app/${path}`;

export const COMPANIES = {
  ITC: ['ITC Limited', 'Consumer staples', 420],
  TATAMOTORS: ['Tata Motors', 'Automotive', 450],
  HDFCLIFE: ['HDFC Life Insurance', 'Insurance', 680],
  INFY: ['Infosys', 'Technology', 1550],
  RELIANCE: ['Reliance Industries', 'Diversified', 1400],
} as const;
export type Symbol = keyof typeof COMPANIES;
export const UNIVERSE = Object.keys(COMPANIES) as Symbol[];

export const DEFAULT_CONFIG = {
  mode: 'PAPER' as 'PAPER' | 'APPROVAL' | 'AUTONOMOUS',
  strategy_capital: 5000,
  max_position_percentage: .20,
  max_single_order_percentage: .10,
  minimum_cash_reserve_percentage: .10,
  max_open_positions: 5,
  max_trades_per_day: 3,
  max_daily_loss_percentage: .02,
  max_total_drawdown_percentage: .10,
  minimum_confidence_threshold: .65,
  maximum_market_data_age: 120,
  max_price_deviation_percentage: .02,
  broker_provider: 'paper' as const,
};
export type StrategyConfig = typeof DEFAULT_CONFIG;
export const MAXIMUM_PROPOSAL_AGE_SECONDS = 15 * 60;

/** MockMarketDataProvider.history */
export function mockHistory(symbol: Symbol, days = 260) {
  const price = COMPANIES[symbol][2];
  return Array.from({ length: days }, (_, i) => Math.round(price * (.85 + .15 * i / (days - 1) + .018 * Math.sin(i / 9)) * 1e4) / 1e4);
}
export const movingAverage = (values: number[], period: number) => values.length >= period ? values.slice(-period).reduce((a, b) => a + b, 0) / period : null;
export function smaSeries(values: number[], period: number) {
  return values.map((_, i) => i + 1 >= period ? movingAverage(values.slice(0, i + 1), period) : null);
}
export function dailyTrend(history: number[]) { return history[history.length - 1] > movingAverage(history, 50)! ? 'UPTREND' : 'DOWNTREND'; }

export interface Proposal { symbol: Symbol; action: 'BUY' | 'SELL' | 'HOLD' | 'NO_ACTION'; quantity: number; confidence: number; proposedPrice: number; maximumEntryPrice: number; ageSeconds: number }
export interface Observation { symbol: Symbol; price: number; ageSeconds: number; tradeable: boolean; sessionOpen: boolean; instrument: 'NSE_CASH' }
export interface Fill { symbol: Symbol; side: 'BUY' | 'SELL'; quantity: number; price: number }
export interface Ledger { cash: number; positions: Partial<Record<Symbol, { quantity: number; cost: number }>>; fills: Fill[]; peakEquity: number; dayStartEquity: number }
export interface RiskContext { killSwitch: boolean; brokerHealthy: boolean; brokerVerified: boolean; duplicate: boolean; alreadyOrdered: boolean }
export interface RiskCheck { name: string; status: 'PASS' | 'FAIL'; reason: string }

export const newLedger = (config = DEFAULT_CONFIG): Ledger => ({ cash: config.strategy_capital, positions: {}, fills: [], peakEquity: config.strategy_capital, dayStartEquity: config.strategy_capital });
export const equity = (ledger: Ledger) => ledger.cash + Object.entries(ledger.positions).reduce((sum, [s, p]) => sum + p!.quantity * COMPANIES[s as Symbol][2], 0);
const deployed = (ledger: Ledger) => Object.values(ledger.positions).reduce((sum, p) => sum + p!.cost, 0);

/** RiskEngine.evaluate. Amounts are recomputed from the trusted quote, never from the proposal. */
export function evaluateRisk(proposal: Proposal, observation: Observation, ledger: Ledger, context: RiskContext, config = DEFAULT_CONFIG) {
  const checks: RiskCheck[] = [];
  const check = (name: string, condition: boolean, reason: string) => checks.push({ name, status: condition ? 'PASS' : 'FAIL', reason });
  const price = observation.price, quantity = proposal.quantity, value = price * quantity, capital = config.strategy_capital;
  const cash = ledger.cash, held = ledger.positions[proposal.symbol]?.quantity ?? 0, buy = proposal.action === 'BUY';
  const eq = equity(ledger), dailyLoss = Math.max(0, (ledger.dayStartEquity - eq) / ledger.dayStartEquity), drawdown = Math.max(0, (ledger.peakEquity - eq) / ledger.peakEquity);
  const today = ledger.fills.length;
  check('fresh_proposal', proposal.ageSeconds >= 0 && proposal.ageSeconds <= MAXIMUM_PROPOSAL_AGE_SECONDS, 'Proposal must be at most 15 minutes old; expired proposals require re-analysis');
  check('mode', config.mode === 'PAPER' || config.mode === 'APPROVAL', 'Only paper and explicit-approval paper modes may reach execution');
  check('live_trading', config.broker_provider === 'paper' && config.mode !== 'AUTONOMOUS', 'Only paper broker is implemented');
  check('kill_switch', !context.killSwitch, 'Global backend kill switch must be disabled');
  check('allowlist', UNIVERSE.includes(proposal.symbol) && observation.symbol === proposal.symbol, 'Symbol must match a configured trusted NSE quote');
  check('instrument', observation.instrument === 'NSE_CASH', 'Only NSE cash equities; no leverage, derivatives or short selling');
  check('fresh_market_data', observation.ageSeconds >= 0 && observation.ageSeconds <= config.maximum_market_data_age, `Market observation age: ${observation.ageSeconds.toFixed(2)}s`);
  check('price', Number.isFinite(price) && price > 0, 'Trusted price must be finite and positive');
  check('quantity', Number.isInteger(quantity) && quantity > 0, 'Positive integer shares required');
  check('action', proposal.action === 'BUY' || proposal.action === 'SELL', 'Only BUY or SELL can create an order');
  check('sufficient_cash', !buy || cash >= value, 'Order value is recomputed from trusted price');
  check('strategy_capital', !buy || deployed(ledger) + value <= capital, 'Cost basis deployed cannot exceed isolated initial allocation');
  check('max_order', value <= capital * config.max_single_order_percentage, 'Recomputed order value must fit per-order limit');
  check('max_position', !buy || (held + quantity) * price <= capital * config.max_position_percentage, 'Post-trade marked position must fit concentration limit');
  check('cash_reserve', !buy || cash - value >= capital * config.minimum_cash_reserve_percentage, 'Retain configured cash reserve');
  check('max_positions', !buy || held > 0 || Object.keys(ledger.positions).length < config.max_open_positions, 'Maximum number of open positions');
  check('max_daily_trades', today < config.max_trades_per_day, 'Daily filled-order limit (Asia/Kolkata trading date)');
  check('daily_loss', dailyLoss < config.max_daily_loss_percentage, 'Daily equity loss must remain below limit');
  check('drawdown', drawdown < config.max_total_drawdown_percentage, 'Peak-to-current portfolio drawdown below limit');
  check('tradeable', observation.tradeable, 'Instrument is tradeable');
  check('market_session', observation.sessionOpen, 'Appropriate market session (mock simulation session when MOCK)');
  const deviation = price > 0 ? Math.abs(proposal.proposedPrice - price) / price : Infinity;
  check('price_deviation', deviation <= config.max_price_deviation_percentage && (!buy || price <= proposal.maximumEntryPrice), 'Latest quote must match proposal tolerance and entry ceiling');
  check('no_duplicate_pending', !context.duplicate, 'No duplicate pending/uncertain order for symbol');
  check('idempotency', !context.alreadyOrdered, 'Proposal can create at most one order');
  check('broker_healthy', context.brokerHealthy, 'Broker connection healthy');
  check('broker_verified', context.brokerVerified, 'Broker state is verifiable');
  check('no_short_selling', buy || quantity <= held, 'Cannot sell more shares than owned');
  check('confidence', proposal.confidence >= config.minimum_confidence_threshold, 'Informational confidence never overrides other controls');
  check('ledger_consistent', Math.abs(cash + deployed(ledger) - capital - realized(ledger)) < 1e-6, 'Ledger reconciles cash, cost basis and realized profit');
  return { passed: checks.every(c => c.status === 'PASS'), checks };
}

function realized(ledger: Ledger) {
  // Average-cost realisation, replayed from fills so the reconciliation check is meaningful.
  const book: Partial<Record<Symbol, { q: number; c: number }>> = {}; let pnl = 0;
  for (const f of ledger.fills) {
    const b = book[f.symbol] ??= { q: 0, c: 0 };
    if (f.side === 'BUY') { b.q += f.quantity; b.c += f.quantity * f.price; }
    else { const avg = b.c / b.q; pnl += (f.price - avg) * f.quantity; b.c -= avg * f.quantity; b.q -= f.quantity; }
  }
  return pnl;
}

/** Paper execution: only called after evaluateRisk passed. */
export function paperFill(ledger: Ledger, proposal: Proposal, price: number): Ledger {
  const side = proposal.action as 'BUY' | 'SELL', q = proposal.quantity, positions = { ...ledger.positions };
  const held = positions[proposal.symbol] ?? { quantity: 0, cost: 0 };
  let cash = ledger.cash;
  if (side === 'BUY') { positions[proposal.symbol] = { quantity: held.quantity + q, cost: held.cost + q * price }; cash -= q * price; }
  else {
    const avg = held.cost / held.quantity, rest = held.quantity - q;
    if (rest) positions[proposal.symbol] = { quantity: rest, cost: held.cost - avg * q }; else delete positions[proposal.symbol];
    cash += q * price;
  }
  const next = { ...ledger, cash, positions, fills: [...ledger.fills, { symbol: proposal.symbol, side, quantity: q, price }] };
  return { ...next, peakEquity: Math.max(ledger.peakEquity, equity(next)) };
}
