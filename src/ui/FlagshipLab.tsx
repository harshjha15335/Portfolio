import { useMemo, useState, type ReactNode } from 'react';
import { COMPANIES, DEFAULT_CONFIG, UNIVERSE, dailyTrend, equity, evaluateRisk, mockHistory, newLedger, northstarSource, paperFill, smaSeries, type Ledger, type Proposal, type Symbol } from '../projects/northstar';
import { alerts, monthTotals, moneymetricsSource, parseBankSMS, syntheticLedger, weeklyAnomalies, CATEGORY_BUDGETS } from '../projects/moneymetrics';
import { SAMPLE_ANALYSIS, SAMPLE_MEETING, meetingSource, reminderOutcome, validateMeeting, type Status } from '../projects/meeting';
import { EXPLANATIONS, LOCATIONS, calculateScore, rideflowSource, searchRoutes, type Preference } from '../projects/rideflow';
import { BM25Index, embed, hybridSearch, repolensSample } from '../projects/repolens';

/** Powai flagship facilities. Each lab runs a port of the project's own logic, pinned to a commit. */
export const FLAGSHIP_LABS: Record<string, { place: string; setting: string }> = {
  northstar: { place: 'NORTHSTAR Trading Floor', setting: 'Paper-trading risk desk' },
  moneymetrics: { place: 'MoneyMetrics Finance Office', setting: 'Spending anomaly desk' },
  'meeting-intelligence-service': { place: 'Meeting Intelligence Conference Room', setting: 'Transcript to cited action items' },
  rideflow: { place: 'RideFlow Transit Depot', setting: 'Route search and ranking' },
  repolens: { place: 'RepoLens Inspection Office', setting: 'Hybrid code retrieval' },
};

function Lab({ place, runs, sources, children }: { place: string; runs: string; sources: [string, string][]; children: ReactNode }) {
  return <section className="flagship-lab" aria-label={`${place} working demo`}>
    <header><span className="eyebrow">POWAI / WORKING DEMO</span><h3>{place}</h3><p>{runs}</p></header>
    {children}
    <footer><span className="caption">PORTED FROM THE REPOSITORY · PINNED SOURCE</span>{sources.map(([label, href]) => <a key={href} href={href} target="_blank" rel="noopener noreferrer">{label} ↗</a>)}</footer>
  </section>;
}
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function FlagshipDemo({ projectId }: { projectId: string }) {
  if (projectId === 'northstar') return <NorthstarDesk />;
  if (projectId === 'moneymetrics') return <MoneyMetricsOffice />;
  if (projectId === 'meeting-intelligence-service') return <MeetingRoom />;
  if (projectId === 'rideflow') return <RideFlowDepot />;
  if (projectId === 'repolens') return <RepoLensOffice />;
  return null;
}

function NorthstarDesk() {
  const [symbol, setSymbol] = useState<Symbol>('ITC');
  const [action, setAction] = useState<Proposal['action']>('BUY');
  const [quantity, setQuantity] = useState(1);
  const [confidence, setConfidence] = useState(.72);
  const [quoteAge, setQuoteAge] = useState(8);
  const [drift, setDrift] = useState(0);
  const [killSwitch, setKillSwitch] = useState(false);
  const [unknownOutcome, setUnknownOutcome] = useState(false);
  const [mode, setMode] = useState(DEFAULT_CONFIG.mode);
  const [ledger, setLedger] = useState<Ledger>(() => newLedger());
  const [submitted, setSubmitted] = useState<string | null>(null);
  const price = COMPANIES[symbol][2];
  const proposal: Proposal = { symbol, action, quantity, confidence, proposedPrice: price * (1 + drift / 100), maximumEntryPrice: price * 1.01, ageSeconds: 40 };
  const result = evaluateRisk(proposal, { symbol, price, ageSeconds: quoteAge, tradeable: true, sessionOpen: true, instrument: 'NSE_CASH' }, ledger,
    { killSwitch, brokerHealthy: true, brokerVerified: !unknownOutcome, duplicate: false, alreadyOrdered: false }, { ...DEFAULT_CONFIG, mode });
  const failed = result.checks.filter(c => c.status === 'FAIL');
  const history = useMemo(() => mockHistory(symbol), [symbol]);
  const chart = useMemo(() => {
    const view = history.slice(-120), min = Math.min(...view) * .99, max = Math.max(...view) * 1.01;
    const path = (values: (number | null)[]) => values.slice(-120).map((v, i) => v == null ? '' : `${i ? 'L' : 'M'}${(i / 119 * 560).toFixed(1)} ${(150 - (v - min) / (max - min) * 140).toFixed(1)}`).join('');
    return { close: path(history), sma20: path(smaSeries(history, 20)), sma50: path(smaSeries(history, 50)), min, max };
  }, [history]);
  const submit = () => { if (!result.passed) return; setLedger(l => paperFill(l, proposal, price)); setSubmitted(`${action} ${quantity} ${symbol} @ ${inr(price)} filled by the paper broker.`); };
  return <Lab place="NORTHSTAR Trading Floor" runs="Change the proposal or the desk state and watch the deterministic risk engine re-run all 29 checks from risk.py. Only a fully passing proposal reaches the paper broker. Quotes are the repository's MOCK provider; nothing here touches a market or a broker."
    sources={[['risk.py', northstarSource('risk.py')], ['schemas.py limits', northstarSource('schemas.py')], ['mock market data', northstarSource('market_data.py')], ['verification', 'https://github.com/harshjha15335/NORTHSTAR/blob/main/audit/verification.md']]}>
    <div className="lab-grid">
      <div className="lab-controls">
        <label>Symbol<select value={symbol} onChange={e => setSymbol(e.target.value as Symbol)}>{UNIVERSE.map(s => <option key={s} value={s}>{s} · {COMPANIES[s][0]}</option>)}</select></label>
        <label>Action<select value={action} onChange={e => setAction(e.target.value as Proposal['action'])}>{['BUY', 'SELL', 'HOLD', 'NO_ACTION'].map(a => <option key={a}>{a}</option>)}</select></label>
        <label>Quantity<input type="number" min={0} max={20} value={quantity} onChange={e => setQuantity(Math.max(0, Math.round(+e.target.value)))} /></label>
        <label>Model confidence <output>{confidence.toFixed(2)}</output><input type="range" min={0} max={1} step={.01} value={confidence} onChange={e => setConfidence(+e.target.value)} /></label>
        <label>Quote age <output>{quoteAge} s</output><input type="range" min={0} max={300} value={quoteAge} onChange={e => setQuoteAge(+e.target.value)} /></label>
        <label>Proposal price vs quote <output>{drift > 0 ? '+' : ''}{drift.toFixed(1)}%</output><input type="range" min={-5} max={5} step={.5} value={drift} onChange={e => setDrift(+e.target.value)} /></label>
        <label>Mode<select value={mode} onChange={e => setMode(e.target.value as typeof mode)}>{['PAPER', 'APPROVAL', 'AUTONOMOUS'].map(m => <option key={m}>{m}</option>)}</select></label>
        <label className="lab-toggle"><input type="checkbox" checked={killSwitch} onChange={e => setKillSwitch(e.target.checked)} /> Kill switch engaged</label>
        <label className="lab-toggle"><input type="checkbox" checked={unknownOutcome} onChange={e => setUnknownOutcome(e.target.checked)} /> Last broker outcome unknown</label>
      </div>
      <div>
        <figure className="lab-chart"><svg viewBox="0 0 560 160" role="img" aria-label={`${symbol} mock closes, last 120 sessions, with 20- and 50-session averages; daily trend ${dailyTrend(history)}`}><path d={chart.close} className="series-close" /><path d={chart.sma20} className="series-a" /><path d={chart.sma50} className="series-b" /></svg>
          <figcaption className="caption">{symbol} MOCK DAILY CLOSES · <i className="key-close" />CLOSE <i className="key-a" />SMA 20 <i className="key-b" />SMA 50 · DAILY TREND {dailyTrend(history)}</figcaption></figure>
        <div className={`lab-verdict ${result.passed ? 'pass' : 'fail'}`} role="status">{result.passed ? `All ${result.checks.length} checks pass. Order value ${inr(price * quantity)} recomputed from the trusted quote.` : `${failed.length} of ${result.checks.length} checks fail: ${failed.map(c => c.name).join(', ')}.`}</div>
        <ol className="risk-checks">{result.checks.map(c => <li key={c.name} className={c.status === 'PASS' ? 'pass' : 'fail'}><b>{c.status}</b><code>{c.name}</code><span>{c.reason}</span></li>)}</ol>
        <div className="lab-actions"><button className="primary-button" disabled={!result.passed} onClick={submit}>SEND TO PAPER BROKER →</button><button onClick={() => { setLedger(newLedger()); setSubmitted(null); }}>RESET LEDGER</button></div>
        {submitted && <p className="lab-note" role="status">{submitted}</p>}
        <table className="lab-table"><caption className="caption">PAPER LEDGER · STRATEGY CAPITAL {inr(DEFAULT_CONFIG.strategy_capital)}</caption><tbody>
          <tr><th>Cash</th><td>{inr(ledger.cash)}</td><th>Equity</th><td>{inr(equity(ledger))}</td></tr>
          <tr><th>Fills today</th><td>{ledger.fills.length} / {DEFAULT_CONFIG.max_trades_per_day}</td><th>Positions</th><td>{Object.entries(ledger.positions).map(([s, p]) => `${s} ×${p!.quantity}`).join(', ') || 'none'}</td></tr>
        </tbody></table>
      </div>
    </div>
  </Lab>;
}

function MoneyMetricsOffice() {
  const now = useMemo(() => new Date(), []);
  const [unusual, setUnusual] = useState<string>('Food & Drinks');
  const [sms, setSms] = useState('HDFC Bank: Rs.1,250.00 debited on 05-Oct-26 to VPA canteen@upi. Not you? Call the bank.');
  const [parsed, setParsed] = useState<ReturnType<typeof parseBankSMS> | 'none'>('none');
  const ledger = useMemo(() => syntheticLedger(now, unusual || null), [now, unusual]);
  const weekly = weeklyAnomalies(ledger, now);
  const alertList = alerts(monthTotals(ledger, now), weekly.anomalies);
  return <Lab place="MoneyMetrics Finance Office" runs="A synthetic student ledger runs through MoneyMetrics' own rules. The repository flags a category when the last seven days exceed its historical weekly average by 40% and that average is above ₹500. It is a threshold rule, not a z-score. Budget alerts fire at 80% and 100% of the monthly budget."
    sources={[['calculateWeeklyAverages', moneymetricsSource('js/dashboard.js#L169-L208')], ['budgets and alerts', moneymetricsSource('js/dashboard.js#L299-L320')], ['SMS parser', moneymetricsSource('js/sms.js#L86-L154')], ['live app', 'https://beautiful-paletas-d81505.netlify.app/']]}>
    <div className="lab-grid">
      <div className="lab-controls">
        <label>Make this week unusual for<select value={unusual} onChange={e => setUnusual(e.target.value)}><option value="">Nothing (quiet week)</option>{['Food & Drinks', 'Travel & Transit', 'Shopping', 'Entertainment'].map(c => <option key={c}>{c}</option>)}</select></label>
        <p className="caption">The unusual week spends 2.1× the usual amount in that category. Entertainment averages under ₹500 a week, so the rule deliberately ignores it.</p>
        <label>Paste a bank SMS<textarea rows={4} value={sms} onChange={e => setSms(e.target.value)} /></label>
        <button onClick={() => setParsed(parseBankSMS(sms, now))}>PARSE SMS</button>
        {parsed !== 'none' && <output className="lab-note" aria-live="polite">{parsed ? `${parsed.type === 'income' ? 'Income' : 'Expense'} · ${inr(parsed.amount)} · ${parsed.date} · ${parsed.source}` : 'No amount found. The app would ask for manual entry.'}</output>}
      </div>
      <div>
        <table className="lab-table"><caption className="caption">LAST 7 DAYS VS HISTORICAL WEEKLY AVERAGE · {weekly.weeksElapsed.toFixed(1)} WEEKS OF HISTORY</caption>
          <thead><tr><th>Category</th><th>This week</th><th>Weekly avg</th><th>Ratio</th><th>Flag</th></tr></thead>
          <tbody>{weekly.rows.map(r => <tr key={r.cat} className={r.anomaly ? 'flagged' : ''}><td>{r.cat}</td><td>{inr(r.current)}</td><td>{inr(Math.round(r.avg))}</td><td>{(r.current / Math.max(1, r.avg)).toFixed(2)}×</td><td>{r.anomaly ? 'ANOMALY' : r.avg <= 500 ? 'avg ≤ ₹500' : '—'}</td></tr>)}</tbody></table>
        <ul className="lab-alerts" aria-live="polite">{alertList.length ? alertList.map(a => <li key={a.msg} className={a.type}>{a.msg}</li>) : <li>No alerts. Month-to-date spend is under 80% of every budget ({Object.entries(CATEGORY_BUDGETS).slice(0, 3).map(([c, b]) => `${c} ${inr(b)}`).join(', ')}…).</li>}</ul>
        <p className="caption">ALL TRANSACTIONS ARE SYNTHETIC. NO BANK DATA, NO FIREBASE CONNECTION.</p>
      </div>
    </div>
  </Lab>;
}

function MeetingRoom() {
  const [cite, setCite] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const [telegram, setTelegram] = useState(true);
  const [statuses, setStatuses] = useState<Status[]>(SAMPLE_ANALYSIS.actionItems.map(() => 'PENDING'));
  const [runAt, setRunAt] = useState('2026-10-09');
  const response = validateMeeting(broken ? { ...SAMPLE_MEETING, participants: [], transcript: SAMPLE_MEETING.transcript.map((e, i) => i === 1 ? { ...e, speaker: '' } : e) } : SAMPLE_MEETING);
  const Cites = ({ c }: { c: { timestamp: string }[] }) => <>{c.map(x => <button key={x.timestamp} className="cite" aria-pressed={cite === x.timestamp} onClick={() => setCite(x.timestamp)}>{x.timestamp}</button>)}</>;
  const section = (title: string, items: { text: string; citations: { timestamp: string }[] }[]) => <div><span className="eyebrow">{title}</span><ul>{items.map(i => <li key={i.text}>{i.text} <Cites c={i.citations} /></li>)}</ul></div>;
  return <Lab place="Meeting Intelligence Conference Room" runs="A synthetic planning meeting goes through the service's request validation, its cited analysis shape and its reminder rules. The service sends the transcript to Gemini; this room never calls a model. The analysis below is an example written in the exact MeetingAnalysisResult shape, and the tests check that every item cites a real transcript timestamp."
    sources={[['request validation', meetingSource('src/validators/meeting.validator.ts')], ['analysis rules', meetingSource('AI_APPROACH.md')], ['reminder service', meetingSource('src/services/reminder.service.ts')], ['overdue query', meetingSource('src/repositories/actionItem.repository.ts#L63-L72')]]}>
    <div className="lab-grid">
      <div>
        <span className="eyebrow">POST /api/meetings · TRANSCRIPT</span>
        <ol className="transcript">{SAMPLE_MEETING.transcript.map(e => <li key={e.timestamp} className={cite === e.timestamp ? 'cited' : ''}><code>{e.timestamp}</code><b>{e.speaker}</b><span>{e.text}</span></li>)}</ol>
        <label className="lab-toggle"><input type="checkbox" checked={broken} onChange={e => setBroken(e.target.checked)} /> Send a malformed request (no participants, blank speaker)</label>
        <pre className="lab-json" aria-live="polite">{`HTTP ${response.status}\n${JSON.stringify(response.body, null, 1)}`}</pre>
      </div>
      <div className="analysis">
        <p className="lab-note">EXAMPLE OUTPUT · written for this exhibit in the service's output shape, not generated by Gemini. Click a timestamp to see its source line.</p>
        {section('SUMMARY', SAMPLE_ANALYSIS.summary)}
        {section('DECISIONS', SAMPLE_ANALYSIS.decisions)}
        <div><span className="eyebrow">ACTION ITEMS</span><ul>{SAMPLE_ANALYSIS.actionItems.map((a, i) => {
          const outcome = reminderOutcome({ status: statuses[i], dueDate: a.dueDate }, new Date(`${runAt}T09:00:00+05:30`), telegram);
          return <li key={a.task}>{a.task} · <b>{a.assignee}</b> · due {a.dueDate} <Cites c={a.citations} />
            <label className="inline-select">Status<select value={statuses[i]} onChange={e => setStatuses(s => s.map((v, j) => j === i ? e.target.value as Status : v))}>{['PENDING', 'IN_PROGRESS', 'COMPLETED'].map(s => <option key={s}>{s}</option>)}</select></label>
            <small className={outcome.sent ? 'sent' : ''}>{outcome.overdue ? `Overdue → reminder ${outcome.history}` : 'Not overdue → no reminder'}</small></li>;
        })}</ul></div>
        {section('FOLLOW-UPS', SAMPLE_ANALYSIS.followUps)}
        <div className="lab-controls row"><label>Run reminder job on<input type="date" value={runAt} onChange={e => setRunAt(e.target.value)} /></label><label className="lab-toggle"><input type="checkbox" checked={telegram} onChange={e => setTelegram(e.target.checked)} /> Telegram configured</label></div>
      </div>
    </div>
  </Lab>;
}

function RideFlowDepot() {
  const [from, setFrom] = useState(LOCATIONS[0]);
  const [to, setTo] = useState(LOCATIONS[3]);
  const [preference, setPreference] = useState<Preference>('recommended');
  const [picked, setPicked] = useState(0);
  const result = searchRoutes(from, to, preference);
  const routes = result.status === 200 ? result.routes : [];
  const route = routes[Math.min(picked, routes.length - 1)];
  return <Lab place="RideFlow Transit Depot" runs="Pick endpoints and a preference; the depot runs RideFlow's calculate_score and rank_routes exactly. The backend only checks that both endpoints are present and then ranks the same three sample routes for every pair, so the endpoints here do not change the routes. No live transit data is involved."
    sources={[['routing_engine.py', rideflowSource('backend/app/services/routing_engine.py')], ['POST /routes/search', rideflowSource('backend/app/main.py#L49-L76')], ['routes.json', rideflowSource('backend/data/routes.json')]]}>
    <div className="lab-grid">
      <div className="lab-controls">
        <label>From<select value={from} onChange={e => setFrom(e.target.value)}><option value="">—</option>{LOCATIONS.map(l => <option key={l}>{l}</option>)}</select></label>
        <label>To<select value={to} onChange={e => setTo(e.target.value)}><option value="">—</option>{LOCATIONS.map(l => <option key={l}>{l}</option>)}</select></label>
        <label>Preference<select value={preference} onChange={e => { setPreference(e.target.value as Preference); setPicked(0); }}>{['recommended', 'fastest', 'cheapest', 'safest', 'greenest'].map(p => <option key={p}>{p}</option>)}</select></label>
        {result.status === 400 && <pre className="lab-json" role="alert">{`HTTP 400\n{ "detail": "${result.detail}" }`}</pre>}
      </div>
      {route && <div>
        <ol className="route-results">{routes.map((r, i) => { const s = calculateScore(r); return <li key={r.routeId}><button aria-pressed={r === route} onClick={() => setPicked(i)}><b>{i + 1}. {r.name}</b><span>{r.summary}</span><small>{r.totalTime} min · ₹{r.totalFare} · {r.transfers} transfers · score {s.total} = time {s.time} + fare {s.fare} + reliability {s.reliability} + safety {s.safety}</small></button></li>; })}</ol>
        <figure className="lab-chart"><svg viewBox="0 0 560 420" role="img" aria-label={`${route.name} sample path`}><rect width="560" height="420" className="map-bg" />{routes.map(r => <polyline key={r.routeId} points={r.mapPathPoints.map(p => `${p.x},${p.y}`).join(' ')} className={r === route ? 'route-on' : 'route-off'} />)}<circle cx="120" cy="150" r="8" className="stop" /><circle cx="480" cy="350" r="8" className="stop" /></svg>
          <figcaption className="caption">{route.routeId} · {EXPLANATIONS[route.routeId]}</figcaption></figure>
        <p className="lab-note">The repository's routes.json tags RF-R1 “Recommended” with a stored score of 78, but calculate_score recomputes 51.8 for it, so the API's recommended order puts RF-R3 first. The depot shows the computed order.</p>
      </div>}
    </div>
  </Lab>;
}

const PRESETS = repolensSample.reference.map(r => r.query);
function RepoLensOffice() {
  const index = useMemo(() => new BM25Index(repolensSample.chunks), []);
  const vectors = useMemo(() => repolensSample.chunks.map(c => embed(c.content)), []);
  const [query, setQuery] = useState(PRESETS[1]);
  const [open, setOpen] = useState<number | null>(null);
  const r = useMemo(() => hybridSearch(query, index, vectors), [query, index, vectors]);
  const chunk = (i: number) => repolensSample.chunks[i];
  const column = (title: string, list: [number, number][], digits: number) => <div><span className="eyebrow">{title}</span><ol>{list.slice(0, 5).map(([i, s]) => <li key={i}><button aria-pressed={open === i} onClick={() => setOpen(i)}><code>{chunk(i).parent_symbol ? `${chunk(i).parent_symbol}.` : ''}{chunk(i).symbol_name}</code><small>{s.toFixed(digits)}</small></button></li>)}</ol>{!list.length && <p className="caption">No lexical match.</p>}</div>;
  const shown = open ?? r.fused[0]?.[0];
  return <Lab place="RepoLens Inspection Office" runs={`Ask about RepoLens's own sample calculator repository. Your browser runs a port of its code-aware BM25, its deterministic local embedding and its intent-weighted Reciprocal Rank Fusion over ${repolensSample.chunks.length} chunks; the tests check the rankings against the Python code's output. RepoLens chunks with Tree-sitter; this office uses the same per-method granularity.`}
    sources={[['BM25 + tokenizer', `https://github.com/harshjha15335/RepoLens/blob/${repolensSample.commit}/backend/app/services/indexing/service.py`], ['local embedding', `https://github.com/harshjha15335/RepoLens/blob/${repolensSample.commit}/backend/app/services/embeddings/service.py`], ['RRF fusion', `https://github.com/harshjha15335/RepoLens/blob/${repolensSample.commit}/backend/app/services/retrieval/service.py#L333-L356`], ['sample repo', `https://github.com/harshjha15335/RepoLens/tree/${repolensSample.commit}/sample-repos/calculator`]]}>
    <label className="lab-query">Question<input value={query} onChange={e => { setQuery(e.target.value); setOpen(null); }} /></label>
    <div className="lab-presets">{PRESETS.map(p => <button key={p} aria-pressed={p === query} onClick={() => { setQuery(p); setOpen(null); }}>{p}</button>)}</div>
    <p className="lab-note" aria-live="polite">Intent <b>{r.intent}</b> · fusion weights dense {r.denseWeight} / BM25 {(1 - r.denseWeight).toFixed(1)} · tokens: {r.tokens.join(' ') || '—'}</p>
    <div className="lab-columns">{column('BM25', r.bm25, 3)}{column('DENSE (COSINE)', r.dense, 3)}{column('RRF FUSED (k = 60)', r.fused, 5)}</div>
    {shown != null && <figure className="code-chunk"><figcaption className="caption">{chunk(shown).file_path}:{chunk(shown).start_line}-{chunk(shown).end_line}</figcaption><pre>{chunk(shown).content.split('\n').map((line, i) => <span key={i}><i>{chunk(shown).start_line + i}</i>{line}{'\n'}</span>)}</pre></figure>}
  </Lab>;
}

/** ASTFLOW could not be verified: no repository by that name exists among Harsh's GitHub repositories. */
export function AstflowBlocked() {
  return <section className="flagship-lab blocked" aria-label="ASTFLOW Engineering Lab, blocked"><header><span className="eyebrow">POWAI / PLANNED · BLOCKED</span><h3>ASTFLOW Engineering Lab</h3><p>No ASTFLOW repository or document was found among the 19 repositories on github.com/harshjha15335 (checked 14 October 2026), so its purpose cannot be verified. The lab stays closed rather than showing an invented demo.</p></header></section>;
}
