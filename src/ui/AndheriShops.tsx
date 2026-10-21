import { useState } from 'react';
import { SHOPS, type Shop, type Skill } from '../data/shops';
import { projects } from '../data/projects';
import { districts } from '../data/city';
import { portfolio } from '../data/portfolio';
import { EXCERPTS } from '../projects/excerpts';
import { ConventionError, SPHERICAL_SOURCE, quadrupoleToSpherical } from '../research/stone';
import { weeklyAnomalies, moneymetricsSource, type Txn } from '../projects/moneymetrics';
import { evaluateRisk, newLedger, paperFill, northstarSource, type Proposal, type Symbol } from '../projects/northstar';
import { PIPELINES, simulate } from '../projects/pipelines';
import { northstarFile, northstarGuard, type Evidence } from '../projects/aiguard';
import guardData from '../projects/data/northstar-guard.json';
import { RideMeter } from './RideMeter';
import type { RideStatus } from '../game/World/transit';

const projectTitle = (id: string) => projects.find(p => p.id === id)?.title ?? id;

/** Andheri Tech Bazaar: five shops; each skill opens what it does, where it was used, a demonstration and the evidence. */
export function SkillShops({ onProject, initialShop = 'language' }: { onProject: (id: string) => void; initialShop?: Shop['id'] }) {
  const [shopId, setShopId] = useState<Shop['id']>(initialShop);
  const shop = SHOPS.find(s => s.id === shopId)!;
  const [skillName, setSkillName] = useState(shop.skills[0].name);
  const skill = shop.skills.find(s => s.name === skillName) ?? shop.skills[0];
  const choose = (s: Shop) => { setShopId(s.id); setSkillName(s.skills[0].name); };
  return <section className="andheri-shops" aria-label="Andheri Tech Bazaar shops">
    <h3>Five shops. Every skill with its receipts.</h3>
    <p>Pick a shop, then a skill. Each one says what it does, where Harsh used it, and links the exact source. Every shop has a working bench underneath that runs real logic from those repositories.</p>
    <nav className="shop-signs" aria-label="Shops">{SHOPS.map(s => <button key={s.id} aria-pressed={s.id === shopId} onClick={() => choose(s)}><b>{s.sign}</b>{s.name}</button>)}</nav>
    <div className="shop-front">
      <div className="shop-skills" role="group" aria-label={`${shop.name} skills`}>
        <span className="eyebrow">{shop.name.toUpperCase()} / SKILLS</span>
        {shop.skills.map(s => <button key={s.name} aria-pressed={s.name === skill.name} className={s.evidence} onClick={() => setSkillName(s.name)}>{s.name}{s.evidence === 'resume' && <small>RÉSUMÉ ONLY</small>}</button>)}
      </div>
      <SkillCard skill={skill} shop={shop} onProject={onProject} />
    </div>
    <div className="flagship-lab shop-bench">
      <header><span className="eyebrow">{shop.sign} / {shop.name.toUpperCase()} / THE BENCH</span><h3>{shop.pitch}</h3></header>
      {shop.id === 'language' && <LanguageBench />}
      {shop.id === 'frontend' && <FrontendBench />}
      {shop.id === 'backend' && <BackendBench />}
      {shop.id === 'devops' && <DevOpsBench />}
      {shop.id === 'ai' && <AIBench />}
    </div>
  </section>;
}

function SkillCard({ skill, shop, onProject }: { skill: Skill; shop: Shop; onProject: (id: string) => void }) {
  const linked = [...new Set(skill.where.flatMap(w => w.project ? [w.project] : []))];
  return <article className="skill-card" aria-live="polite" aria-label={`${skill.name} evidence`}>
    <h4>{skill.name}</h4>
    <dl>
      <dt>WHAT IT DOES</dt><dd>{skill.what}</dd>
      <dt>WHERE HARSH USED IT</dt><dd>{skill.evidence === 'resume' ? <span className="resume-only">{skill.note}</span> : <ul>{skill.where.map(w => <li key={w.href}><a href={w.href} target="_blank" rel="noopener noreferrer">{w.label} ↗</a></li>)}</ul>}</dd>
      <dt>DEMONSTRATION</dt><dd>{skill.evidence === 'resume' ? 'None. There is no public code to run.' : `The ${shop.name} bench below.`}</dd>
      <dt>EVIDENCE</dt><dd>{skill.evidence === 'resume'
        ? <a href={portfolio.resume} target="_blank" rel="noreferrer">Résumé ↗</a>
        : <>{skill.note && <p className="caption-note">{skill.note}</p>}<span className="evidence-actions">{linked.map(id => <button key={id} onClick={() => onProject(id)}>OPEN {projectTitle(id).toUpperCase()} CASE STUDY ↗</button>)}{!linked.length && 'Source links above, pinned to a commit.'}</span></>}</dd>
    </dl>
  </article>;
}

const Source = ({ href, children }: { href: string; children: string }) => <a className="bench-source" href={href} target="_blank" rel="noopener noreferrer">{children} ↗</a>;
const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

/* A: Language Lane. The original excerpt beside a live run of the same logic through the tested port. */
function LanguageBench() {
  const [lang, setLang] = useState<'python' | 'javascript'>('python');
  const ex = EXCERPTS[lang];
  const href = `${lang === 'python' ? SPHERICAL_SOURCE : moneymetricsSource(ex.file)}#L${ex.lines[0]}-L${ex.lines[1]}`;
  return <>
    <div className="lab-presets" role="group" aria-label="Language">{(['python', 'javascript'] as const).map(l => <button key={l} aria-pressed={l === lang} onClick={() => setLang(l)}>{{ python: 'PYTHON · FFPRIME', javascript: 'JAVASCRIPT · MONEYMETRICS' }[l]}</button>)}</div>
    <div className="lab-grid bench-split">
      <figure className="code-chunk"><figcaption className="caption">{ex.file.toUpperCase()} · LINES {ex.lines[0]}–{ex.lines[1]} · VERBATIM</figcaption><pre><code>{ex.code}</code></pre><Source href={href}>Source at the pinned commit</Source></figure>
      <div>{lang === 'python' ? <PythonRun /> : <JavaScriptRun />}</div>
    </div>
  </>;
}

function PythonRun() {
  const [v, setV] = useState({ xx: '0.4', yy: '-1.1', xy: '0.25', xz: '-0.3', yz: '0.15', zz: '0.7' });
  const n = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, num(x)])) as Record<keyof typeof v, number>;
  let out: number[] | null = null, error = '';
  if (Object.values(n).some(Number.isNaN)) error = 'Every component needs a number.';
  else try { out = quadrupoleToSpherical([[n.xx, n.xy, n.xz], [n.xy, n.yy, n.yz], [n.xz, n.yz, n.zz]]); } catch (e) { if (e instanceof ConventionError) error = `ValueError: ${e.message}`; else throw e; }
  return <div className="lab-controls">
    <span className="eyebrow">RUN IT · Θ (A.U.)</span>
    <div className="bench-inputs">{(Object.keys(v) as (keyof typeof v)[]).map(k => <label key={k}>Θ{k}<input type="number" step="0.05" value={v[k]} onChange={e => setV(s => ({ ...s, [k]: e.target.value }))} /></label>)}</div>
    <p className="caption">Θzz must equal −(Θxx + Θyy) for the tensor to be traceless. Change it to see the same refusal the Python raises.</p>
    {error ? <p className="lab-verdict fail" role="alert">{error}</p> : <table className="lab-table"><tbody>{['Q_20', 'Q_21c', 'Q_21s', 'Q_22c', 'Q_22s'].map((k, i) => <tr key={k}><th><code>{k}</code></th><td>{out![i].toFixed(6)}</td></tr>)}</tbody></table>}
    <p className="caption">RUN BY THE TYPESCRIPT PORT, TESTED AGAINST THE PYTHON TO 1E-12</p>
  </div>;
}

function JavaScriptRun() {
  const [avg, setAvg] = useState('1800');
  const [week, setWeek] = useState('2700');
  const now = new Date('2026-10-14T12:00:00Z'), day = 86400000;
  const A = num(avg), W = num(week);
  // Four historical weeks of the same spend, oldest exactly five weeks ago, so weeksElapsed is 4.
  const ledger: Txn[] = Number.isNaN(A) || Number.isNaN(W) ? [] : [35, 28, 21, 14].map(d => ({ date: new Date(now.getTime() - d * day).toISOString(), category: 'Food & Drinks', amount: A, type: 'expense' as const, note: 'synthetic' }))
    .concat({ date: new Date(now.getTime() - 2 * day).toISOString(), category: 'Food & Drinks', amount: W, type: 'expense', note: 'synthetic' });
  const row = ledger.length ? weeklyAnomalies(ledger, now).rows[0] : null;
  return <div className="lab-controls">
    <span className="eyebrow">RUN IT · SYNTHETIC FOOD & DRINKS LEDGER</span>
    <label>Usual weekly spend (₹)<input type="number" step="50" value={avg} onChange={e => setAvg(e.target.value)} /></label>
    <label>This week (₹)<input type="number" step="50" value={week} onChange={e => setWeek(e.target.value)} /></label>
    {row ? <><table className="lab-table"><tbody>
      <tr><th>avgWeekly</th><td>₹{row.avg.toFixed(2)}</td></tr><tr><th>currentSpent</th><td>₹{row.current.toFixed(2)}</td></tr>
      <tr><th><code>avgWeekly &gt; 500</code></th><td>{String(row.avg > 500)}</td></tr><tr><th><code>currentSpent &gt; avgWeekly * 1.4</code></th><td>{String(row.current > row.avg * 1.4)} (threshold ₹{(row.avg * 1.4).toFixed(2)})</td></tr>
    </tbody></table><p className={`lab-verdict ${row.anomaly ? 'fail' : 'pass'}`}>{row.anomaly ? 'Anomaly: this week is pushed to the alerts list.' : 'No anomaly.'}</p></> : <p className="lab-verdict fail">Enter two amounts.</p>}
    <p className="caption">A 40%-OVER-AVERAGE RULE, NOT A Z-SCORE · SYNTHETIC AMOUNTS</p>
  </div>;
}

/* B: Frontend Studio. This site's own RideMeter component, with its props on the bench. */
function FrontendBench() {
  const [ride, setRide] = useState<RideStatus>({ phase: 'riding', kind: 'taxi', destination: 'fort', elapsed: 42, distance: 380, fare: 64.5, progress: .45, meter: 'RUNNING', waiting: 12 });
  const [events, setEvents] = useState<string[]>([]);
  const log = (e: string) => setEvents(s => [e, ...s].slice(0, 5));
  const set = <K extends keyof RideStatus>(k: K, v: RideStatus[K]) => setRide(r => ({ ...r, [k]: v }));
  return <div className="lab-grid">
    <div className="lab-controls">
      <span className="eyebrow">PROPS · ride: RideStatus</span>
      <label>phase<select value={ride.phase} onChange={e => set('phase', e.target.value as RideStatus['phase'])}>{['idle', 'hailing', 'boarding', 'riding', 'arrived'].map(p => <option key={p}>{p}</option>)}</select></label>
      <label>kind<select value={ride.kind} onChange={e => set('kind', e.target.value as RideStatus['kind'])}><option value="taxi">taxi</option><option value="auto">auto</option></select></label>
      <label>destination<select value={ride.destination ?? ''} onChange={e => set('destination', e.target.value || null)}><option value="">null</option>{districts.map(d => <option key={d.id} value={d.id}>{d.id}</option>)}</select></label>
      <label>fare<output>₹{ride.fare.toFixed(2)}</output><input type="range" min={0} max={400} step={0.5} value={ride.fare} onChange={e => set('fare', +e.target.value)} /></label>
      <label>distance<output>{Math.round(ride.distance)} m</output><input type="range" min={0} max={2000} step={10} value={ride.distance} onChange={e => set('distance', +e.target.value)} /></label>
      <label>progress<output>{ride.progress.toFixed(2)}</output><input type="range" min={0} max={1} step={0.01} value={ride.progress} onChange={e => set('progress', +e.target.value)} /></label>
    </div>
    <div>
      <div className="studio-stage">{ride.phase === 'idle' ? <p className="caption">phase “idle”: the component renders nothing (returns null).</p> :
        <RideMeter ride={ride}
          onChoose={id => { log(`onChoose('${id}')`); setRide(r => ({ ...r, destination: id, phase: 'riding', progress: 0 })); }}
          onSkip={() => { log('onSkip()'); setRide(r => ({ ...r, phase: 'arrived', progress: 1 })); }}
          onExit={() => { log('onExit()'); set('phase', 'idle'); }}
          onOpen={id => log(`onOpen('${id}')`)} />}</div>
      <span className="eyebrow">CALLBACKS FIRED</span>
      <ol className="event-log" aria-label="Callbacks fired">{events.length ? events.map((e, i) => <li key={i + e}><code>{e}</code></li>) : <li className="caption">Use the meter's buttons.</li>}</ol>
      <p className="caption">THE SAME COMPONENT THAT RUNS IN THE WORLD DURING A TAXI OR AUTO RIDE · <a href="https://github.com/harshjha15335/Portfolio/blob/14783f4e7dee8d60fabaf0bb2c4ba535fcf2c09b/src/ui/CityExperience.tsx" target="_blank" rel="noopener noreferrer">SOURCE ↗</a></p>
    </div>
  </div>;
}

/* C: Backend Workshop. One model reply through NORTHSTAR's backend, layer by layer, ending in a paper fill or a refusal. */
const guardCases = guardData.cases.filter(c => !c.id.startsWith('probe'));
function BackendBench() {
  const [raw, setRaw] = useState(guardCases.find(c => c.id === 'buy')!.raw);
  const [ctx, setCtx] = useState({ killSwitch: false, brokerHealthy: true, sessionOpen: true, duplicate: false });
  const evidence = guardData.evidence as Evidence;
  const g = northstarGuard(raw, evidence);
  const ledger = newLedger();
  const price = Number(evidence.quote.price);
  let risk: ReturnType<typeof evaluateRisk> | null = null, proposal: Proposal | null = null;
  if (g.stage === 'accepted') {
    const p = g.proposal;
    proposal = { symbol: p.symbol as Symbol, action: p.action as Proposal['action'], quantity: Number(p.proposed_quantity), confidence: Number(p.confidence), proposedPrice: Number(p.current_price), maximumEntryPrice: Number(p.maximum_entry_price), ageSeconds: 0 };
    risk = evaluateRisk(proposal, { symbol: evidence.symbol as Symbol, price, ageSeconds: 5, tradeable: true, sessionOpen: ctx.sessionOpen, instrument: 'NSE_CASH' }, ledger,
      { killSwitch: ctx.killSwitch, brokerHealthy: ctx.brokerHealthy, brokerVerified: true, duplicate: ctx.duplicate, alreadyOrdered: false });
  }
  const failed = risk?.checks.filter(c => c.status === 'FAIL') ?? [];
  const after = risk?.passed && proposal ? paperFill(ledger, proposal, price) : null;
  const hops: { name: string; href: string; state: 'pass' | 'stop' | 'skipped'; note: string }[] = [
    { name: 'XAIProvider.propose: strip the fence', href: northstarFile('agents.py'), state: 'pass', note: 'Removes a ```json wrapper if the model added one.' },
    { name: 'TradeProposal.model_validate_json', href: northstarFile('schemas.py'), state: g.stage === 'schema' ? 'stop' : 'pass', note: g.stage === 'schema' ? `${g.errors.length} Pydantic error${g.errors.length === 1 ? '' : 's'}: ${g.errors[0]?.msg ?? ''}` : 'Every field typed and bounded; unknown fields forbidden.' },
    { name: 'DecisionAgent.decide', href: northstarFile('agents.py'), state: g.stage === 'schema' ? 'skipped' : g.stage === 'decision' ? 'stop' : 'pass', note: g.stage === 'decision' ? g.message : 'Symbol, cycle, quote, value and sources match the evidence.' },
    { name: 'RiskEngine.evaluate', href: northstarSource('risk.py'), state: !risk ? 'skipped' : risk.passed ? 'pass' : 'stop', note: risk ? `${risk.checks.length - failed.length} of ${risk.checks.length} checks pass${failed.length ? `; ${failed.map(c => c.name).join(', ')} failed` : ''}.` : '' },
    { name: 'paper fill (MOCK mode)', href: northstarSource('risk.py'), state: after ? 'pass' : 'skipped', note: after ? `Filled ${proposal!.action} ${proposal!.quantity} × ${proposal!.symbol} at ₹${price}. Cash ₹${ledger.cash.toFixed(2)} → ₹${after.cash.toFixed(2)}.` : '' },
  ];
  const toggle = (k: keyof typeof ctx) => setCtx(c => ({ ...c, [k]: !c[k] }));
  return <div className="lab-grid">
    <div className="lab-controls">
      <span className="eyebrow">INPUT · A MODEL'S TRADE PROPOSAL</span>
      <label>Preset<select value={guardCases.find(c => c.raw === raw)?.id ?? ''} onChange={e => setRaw(guardCases.find(c => c.id === e.target.value)!.raw)}><option value="" disabled>(edited)</option>{guardCases.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <label>Raw model reply<textarea rows={8} value={raw} spellCheck={false} onChange={e => setRaw(e.target.value)} /></label>
      <span className="eyebrow">BACKEND STATE</span>
      <label className="lab-check"><input type="checkbox" checked={ctx.killSwitch} onChange={() => toggle('killSwitch')} /> Kill switch on</label>
      <label className="lab-check"><input type="checkbox" checked={!ctx.brokerHealthy} onChange={() => toggle('brokerHealthy')} /> Broker connection down</label>
      <label className="lab-check"><input type="checkbox" checked={!ctx.sessionOpen} onChange={() => toggle('sessionOpen')} /> Market session closed</label>
      <label className="lab-check"><input type="checkbox" checked={ctx.duplicate} onChange={() => toggle('duplicate')} /> Order already pending for ITC</label>
    </div>
    <div>
      <ol className="hop-list" aria-label="Request path">{hops.map(h => <li key={h.name} className={h.state}><b>{h.state === 'pass' ? '✓' : h.state === 'stop' ? '■' : '·'}</b><div><a href={h.href} target="_blank" rel="noopener noreferrer"><code>{h.name}</code></a><span>{h.state === 'skipped' ? 'not reached' : h.note}</span></div></li>)}</ol>
      <p className={`lab-verdict ${after ? 'pass' : 'fail'}`} role="status">{after ? 'Paper order filled.' : 'No order. The backend stopped it at the step marked ■.'}</p>
      <p className="caption">THE SCHEMA AND DECISION STEPS ARE CHECKED AGAINST THE REAL PYDANTIC MODEL; THE RISK ENGINE IS THE TESTED PORT USED BY THE NORTHSTAR LAB IN POWAI. MOCK QUOTE, NO BROKER.</p>
    </div>
  </div>;
}

/* D: DevOps Garage. Real pipelines; click a step to make it fail. */
function DevOpsBench() {
  const [id, setId] = useState(PIPELINES[0].id);
  const [fail, setFail] = useState<{ job: string; step: number } | null>(null);
  const p = PIPELINES.find(x => x.id === id)!;
  const run = simulate(p, fail);
  return <>
    <div className="lab-presets" role="group" aria-label="Pipeline">{PIPELINES.map(x => <button key={x.id} aria-pressed={x.id === id} onClick={() => { setId(x.id); setFail(null); }}>{x.repo}</button>)}</div>
    <p className="bench-title"><b>{p.title}</b> · <a href={p.href} target="_blank" rel="noopener noreferrer"><code>{p.file}</code> ↗</a> · on {p.trigger}</p>
    <div className="ci-pipeline" role="group" aria-label="Pipeline jobs">{p.jobs.map((job, j) => <section key={job.id} className={`job ${run.jobs[j].conclusion}`}>
      <h4>{job.name}<small>{run.jobs[j].conclusion.toUpperCase()}</small></h4>
      <ol>{job.steps.map((step, i) => { const st = run.jobs[j].states[i]; return <li key={step}><button className={st} aria-pressed={fail?.job === job.id && fail.step === i} aria-label={`${job.name}: ${step} (${st})`} onClick={() => setFail(f => f?.job === job.id && f.step === i ? null : { job: job.id, step: i })}><b>{st === 'pass' ? '✓' : st === 'fail' ? '✕' : '–'}</b>{step}</button></li>; })}</ol>
    </section>)}
      {p.gated && <section className={`job gated ${run.gated === 'runs' ? 'pass' : 'skipped'}`}><h4>{p.gated.name}<small>{run.gated === 'runs' ? 'WOULD RUN' : 'SKIPPED'}</small></h4><p className="caption">{p.gated.condition}</p><ol>{p.gated.steps.map(s => <li key={s}><span className={run.gated === 'runs' ? 'pass' : 'skipped'}><b>{run.gated === 'runs' ? '→' : '–'}</b>{s}</span></li>)}</ol><a href={p.gated.href} target="_blank" rel="noopener noreferrer"><code>{p.gated.file}</code> ↗</a></section>}
    </div>
    <p className={`lab-verdict ${run.success ? 'pass' : 'fail'}`} role="status">{fail ? `One failing step: ${run.success ? '' : 'the run fails'}${p.gated ? `, and ${p.gated.name} ${run.gated === 'runs' ? 'still runs' : 'does not run'}` : ''}.` : 'Every step passes. Click any step to make it fail.'}</p>
    <p className="lab-note">{p.note}</p>
    <p className="caption">TRANSCRIBED FROM THE PINNED FILES · THIS SHOWS WHAT THE CONFIGURATION SAYS HAPPENS; NOTHING IS EXECUTED</p>
  </>;
}

/* E: AI Integration Lab. One model reply against NORTHSTAR's guard. */
function AIBench() {
  const [raw, setRaw] = useState(guardCases.find(c => c.id === 'extra')!.raw);
  const evidence = guardData.evidence as Evidence;
  const g = northstarGuard(raw, evidence);
  const stages = ['fence cleanup', 'TradeProposal schema', 'DecisionAgent checks', 'accepted'];
  const reached = g.stage === 'schema' ? 1 : g.stage === 'decision' ? 2 : 3;
  return <div className="lab-grid">
    <div className="lab-controls">
      <label>Model reply preset<select value={guardCases.find(c => c.raw === raw)?.id ?? ''} onChange={e => setRaw(guardCases.find(c => c.id === e.target.value)!.raw)}><option value="" disabled>(edited)</option>{guardCases.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <label>Raw model reply<textarea rows={12} value={raw} spellCheck={false} onChange={e => setRaw(e.target.value)} /></label>
      <p className="caption">EVIDENCE GIVEN TO THE MODEL: {evidence.symbol} · {evidence.cycle_id} · QUOTE ₹{evidence.quote.price} · SOURCES {evidence.source_ids.join(', ')}</p>
    </div>
    <div>
      <ol className="guard-stages" aria-label="NORTHSTAR guard stages">{stages.map((s, i) => <li key={s} className={i < reached ? 'pass' : i === reached ? (g.stage === 'accepted' ? 'pass' : 'fail') : 'skipped'}>{s}</li>)}</ol>
      {g.stage === 'schema' && <><p className="lab-verdict fail" role="status">Rejected by the schema: {g.errors.length} error{g.errors.length === 1 ? '' : 's'}. Callers see “{g.outward}”.</p><table className="lab-table"><thead><tr><th>Field</th><th>Pydantic error</th></tr></thead><tbody>{g.errors.map((e, i) => <tr key={i}><td><code>{e.loc.join('.') || '(reply)'}</code></td><td>{e.msg}</td></tr>)}</tbody></table></>}
      {g.stage === 'decision' && <p className="lab-verdict fail" role="status">Valid JSON, rejected by DecisionAgent: {g.message}.</p>}
      {g.stage === 'accepted' && <p className="lab-verdict pass" role="status">Accepted as a {String(g.proposal.action)} proposal. It still has to pass every risk check before any paper order (try it in the Backend Workshop, or the NORTHSTAR lab in Powai).</p>}
      <p className="caption">CHECKED AGAINST THE REAL PYDANTIC MODEL AND DECISIONAGENT FOR EVERY PRESET · <a href={northstarFile('agents.py')} target="_blank" rel="noopener noreferrer">AGENTS.PY ↗</a> <a href={northstarFile('schemas.py')} target="_blank" rel="noopener noreferrer">SCHEMAS.PY ↗</a></p>
    </div>
  </div>;
}
