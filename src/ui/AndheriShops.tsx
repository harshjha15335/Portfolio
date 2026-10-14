import { useState } from 'react';
import { SHOPS, type Shop, type Skill } from '../data/shops';
import { projects } from '../data/projects';
import { districts } from '../data/city';
import { portfolio } from '../data/portfolio';
import { EXCERPTS } from '../projects/excerpts';
import { ConventionError, SPHERICAL_SOURCE, quadrupoleToSpherical } from '../research/stone';
import { weeklyAnomalies, moneymetricsSource, type Txn } from '../projects/moneymetrics';
import { meetingSource } from '../projects/meeting';
import { traceMeetingRequest, validateCreateMeeting, type Auth } from '../projects/meetingRequest';
import { PIPELINES, simulate } from '../projects/pipelines';
import { meetingGuard, northstarFile, northstarGuard, type Evidence } from '../projects/aiguard';
import guardData from '../projects/data/northstar-guard.json';
import requestData from '../projects/data/meeting-requests.json';
import { RideMeter } from './RideMeter';
import type { RideStatus } from '../game/World/transit';

const projectTitle = (id: string) => projects.find(p => p.id === id)?.title ?? id;

/** Andheri Tech Bazaar: five shops; each skill opens what it does, where it was used, a demonstration and the evidence. */
export function SkillShops({ onProject }: { onProject: (id: string) => void }) {
  const [shopId, setShopId] = useState<Shop['id']>('language');
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
  const [lang, setLang] = useState<'python' | 'javascript' | 'typescript'>('python');
  const ex = EXCERPTS[lang];
  const href = lang === 'python' ? `${SPHERICAL_SOURCE}#L${ex.lines[0]}-L${ex.lines[1]}` : lang === 'javascript' ? `${moneymetricsSource(ex.file)}#L${ex.lines[0]}-L${ex.lines[1]}` : `${meetingSource(ex.file)}#L${ex.lines[0]}-L${ex.lines[1]}`;
  return <>
    <div className="lab-presets" role="group" aria-label="Language">{(['python', 'javascript', 'typescript'] as const).map(l => <button key={l} aria-pressed={l === lang} onClick={() => setLang(l)}>{{ python: 'PYTHON · FFPRIME', javascript: 'JAVASCRIPT · MONEYMETRICS', typescript: 'TYPESCRIPT · MEETING INTELLIGENCE' }[l]}</button>)}</div>
    <div className="lab-grid bench-split">
      <figure className="code-chunk"><figcaption className="caption">{ex.file.toUpperCase()} · LINES {ex.lines[0]}–{ex.lines[1]} · VERBATIM</figcaption><pre><code>{ex.code}</code></pre><Source href={href}>Source at the pinned commit</Source></figure>
      <div>{lang === 'python' ? <PythonRun /> : lang === 'javascript' ? <JavaScriptRun /> : <TypeScriptRun />}</div>
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

function TypeScriptRun() {
  const [title, setTitle] = useState('Campus Cart release planning');
  const [people, setPeople] = useState('Asha, Rohan');
  const [date, setDate] = useState('2026-10-12T10:00:00Z');
  const body = { title, participants: people.trim() ? people.split(',').map(p => p.trim()) : [], meetingDate: date, transcript: [{ timestamp: '00:01', speaker: 'Asha', text: 'Ship the cart fix on Friday.' }] };
  const { details, data } = validateCreateMeeting(body);
  return <div className="lab-controls">
    <span className="eyebrow">RUN IT · createMeetingSchema.safeParse</span>
    <label>title<input value={title} onChange={e => setTitle(e.target.value)} /></label>
    <label>participants (comma separated)<input value={people} onChange={e => setPeople(e.target.value)} /></label>
    <label>meetingDate<input value={date} onChange={e => setDate(e.target.value)} /></label>
    {data ? <p className="lab-verdict pass">success: true · meetingDate coerced to {String(data.meetingDate)}</p> : <><p className="lab-verdict fail">success: false</p><pre className="lab-json">{JSON.stringify(details, null, 2)}</pre></>}
    <p className="caption">SAME RULES AND MESSAGES AS ZOD 3.25.76 ON THE SERVICE'S SCHEMA (RECORDED AND TESTED)</p>
  </div>;
}

/* B: Frontend Studio. This site's own RideMeter component, with its props on the bench. */
function FrontendBench() {
  const [ride, setRide] = useState<RideStatus>({ phase: 'riding', kind: 'taxi', destination: 'fort', elapsed: 42, distance: 380, fare: 64.5, progress: .45 });
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

/* C: Backend Workshop. POST /api/meetings through Meeting Intelligence, hop by hop. */
function BackendBench() {
  const presets = requestData.cases;
  const [auth, setAuth] = useState<Auth>('valid');
  const [traceId, setTraceId] = useState('');
  const [body, setBody] = useState(presets[0].body);
  const r = traceMeetingRequest({ auth, traceId, body });
  const load = (id: string) => { const c = presets.find(p => p.id === id)!; setAuth(c.auth as Auth); setTraceId(c.traceId); setBody(c.body); };
  return <div className="lab-grid">
    <div className="lab-controls">
      <span className="eyebrow">REQUEST · POST /api/meetings</span>
      <label>Preset<select defaultValue="" onChange={e => e.target.value && load(e.target.value)}><option value="">Choose a recorded case…</option>{presets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <label>Authorization<select value={auth} onChange={e => setAuth(e.target.value as Auth)}><option value="valid">Bearer (valid token)</option><option value="missing">(no header)</option><option value="invalid">Bearer (wrong secret)</option><option value="expired">Bearer (expired)</option></select></label>
      <label>x-trace-id<input value={traceId} placeholder="(none: a UUID is generated)" onChange={e => setTraceId(e.target.value)} /></label>
      <label>Body (application/json)<textarea rows={8} value={body} spellCheck={false} onChange={e => setBody(e.target.value)} /></label>
    </div>
    <div>
      <ol className="hop-list" aria-label="Request path">{r.hops.map(h => <li key={h.name} className={h.state}><b>{h.state === 'pass' ? '✓' : h.state === 'stop' ? '■' : '·'}</b><div><a href={h.href} target="_blank" rel="noopener noreferrer"><code>{h.name}</code></a><span>{h.state === 'skipped' ? 'not reached' : h.note}</span></div></li>)}</ol>
      <p className={`lab-verdict ${r.status < 300 ? 'pass' : 'fail'}`} role="status">HTTP {r.status} · x-trace-id: {r.traceHeader ?? '(not set)'}</p>
      <pre className="lab-json">{JSON.stringify(r.response, null, 2)}</pre>
      <p className="caption">RESPONSES MATCH REQUESTS RECORDED AGAINST THE SERVICE'S OWN CODE (EXPRESS 4.22.2, ZOD 3.25.76). THE DATABASE IS STUBBED, SO THE ID IS FIXED AND TIMESTAMPS ARE OMITTED.</p>
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
    <div className="pipeline" role="group" aria-label="Pipeline jobs">{p.jobs.map((job, j) => <section key={job.id} className={`job ${run.jobs[j].conclusion}`}>
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

/* E: AI Integration Lab. One model reply, two services' guards. */
const MEETING_PRESETS = [
  ['Valid analysis with citations', JSON.stringify({ summary: [{ text: 'Cart fix ships Friday.', citations: [{ timestamp: '00:01' }] }], actionItems: [{ task: 'Ship the cart fix', assignee: 'Asha', citations: [{ timestamp: '00:01' }] }], decisions: [], followUps: [] }, null, 2)],
  ['Missing citations and categories', JSON.stringify({ summary: [{ text: 'Cart fix ships Friday.' }], actionItems: 'none' }, null, 2)],
  ['Wrapped in a ```json fence', '```json\n{"summary": [], "actionItems": [], "decisions": [], "followUps": []}\n```'],
  ['Prose instead of JSON', 'The team agreed to ship the cart fix on Friday.'],
] as const;

function AIBench() {
  const [service, setService] = useState<'northstar' | 'meeting'>('northstar');
  const cases = guardData.cases.filter(c => !c.id.startsWith('probe'));
  const [raw, setRaw] = useState(cases.find(c => c.id === 'extra')!.raw);
  const [mraw, setMraw] = useState<string>(MEETING_PRESETS[1][1]);
  const evidence = guardData.evidence as Evidence;
  const g = northstarGuard(raw, evidence);
  const m = meetingGuard(mraw);
  const stages = ['fence cleanup', 'TradeProposal schema', 'DecisionAgent checks', 'accepted'];
  const reached = g.stage === 'schema' ? 1 : g.stage === 'decision' ? 2 : 3;
  return <>
    <div className="lab-presets" role="group" aria-label="Service"><button aria-pressed={service === 'northstar'} onClick={() => setService('northstar')}>NORTHSTAR · TRADE PROPOSAL</button><button aria-pressed={service === 'meeting'} onClick={() => setService('meeting')}>MEETING INTELLIGENCE · GEMINI ANALYSIS</button></div>
    {service === 'northstar' ? <div className="lab-grid">
      <div className="lab-controls">
        <label>Model reply preset<select value={cases.find(c => c.raw === raw)?.id ?? ''} onChange={e => setRaw(cases.find(c => c.id === e.target.value)!.raw)}><option value="" disabled>(edited)</option>{cases.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label>Raw model reply<textarea rows={12} value={raw} spellCheck={false} onChange={e => setRaw(e.target.value)} /></label>
        <p className="caption">EVIDENCE GIVEN TO THE MODEL: {evidence.symbol} · {evidence.cycle_id} · QUOTE ₹{evidence.quote.price} · SOURCES {evidence.source_ids.join(', ')}</p>
      </div>
      <div>
        <ol className="guard-stages" aria-label="NORTHSTAR guard stages">{stages.map((s, i) => <li key={s} className={i < reached ? 'pass' : i === reached ? (g.stage === 'accepted' ? 'pass' : 'fail') : 'skipped'}>{s}</li>)}</ol>
        {g.stage === 'schema' && <><p className="lab-verdict fail" role="status">Rejected by the schema: {g.errors.length} error{g.errors.length === 1 ? '' : 's'}. Callers see “{g.outward}”.</p><table className="lab-table"><thead><tr><th>Field</th><th>Pydantic error</th></tr></thead><tbody>{g.errors.map((e, i) => <tr key={i}><td><code>{e.loc.join('.') || '(reply)'}</code></td><td>{e.msg}</td></tr>)}</tbody></table></>}
        {g.stage === 'decision' && <p className="lab-verdict fail" role="status">Valid JSON, rejected by DecisionAgent: {g.message}.</p>}
        {g.stage === 'accepted' && <p className="lab-verdict pass" role="status">Accepted as a {String(g.proposal.action)} proposal. It still has to pass all 29 risk checks before any paper order (see the NORTHSTAR lab in Powai).</p>}
        <p className="caption">CHECKED AGAINST THE REAL PYDANTIC MODEL AND DECISIONAGENT FOR EVERY PRESET · <a href={northstarFile('agents.py')} target="_blank" rel="noopener noreferrer">AGENTS.PY ↗</a> <a href={northstarFile('schemas.py')} target="_blank" rel="noopener noreferrer">SCHEMAS.PY ↗</a></p>
      </div>
    </div> : <div className="lab-grid">
      <div className="lab-controls">
        <label>Model reply preset<select value={MEETING_PRESETS.find(p => p[1] === mraw)?.[0] ?? ''} onChange={e => setMraw(MEETING_PRESETS.find(p => p[0] === e.target.value)![1])}><option value="" disabled>(edited)</option>{MEETING_PRESETS.map(([l]) => <option key={l}>{l}</option>)}</select></label>
        <label>Raw Gemini reply<textarea rows={12} value={mraw} spellCheck={false} onChange={e => setMraw(e.target.value)} /></label>
        <p className="caption">REQUESTED WITH responseMimeType application/json · temperature 0.1</p>
      </div>
      <div>
        {m.ok ? <><p className={`lab-verdict ${m.repairs.length ? 'fail' : 'pass'}`} role="status">{m.repairs.length ? `Accepted after ${m.repairs.length} silent repair${m.repairs.length === 1 ? '' : 's'}.` : 'Accepted unchanged.'}</p>
          {!!m.repairs.length && <ul className="lab-alerts">{m.repairs.map(x => <li key={x} className="warning">{x}</li>)}</ul>}
          <pre className="lab-json">{JSON.stringify(m.result, null, 2)}</pre></>
          : <p className="lab-verdict fail" role="status">HTTP {m.status} {m.code}: {m.message}</p>}
        <p className="lab-note">The contrast is the lesson: NORTHSTAR refuses anything off-schema before it can touch money, while Meeting Intelligence normalises missing arrays so a partial analysis still saves. Its citation rule (every item cites a real timestamp) lives in the prompt and AI_APPROACH.md, not in this code path.</p>
        <p className="caption"><a href={meetingSource('src/integrations/gemini.service.ts')} target="_blank" rel="noopener noreferrer">GEMINI.SERVICE.TS ↗</a> · NO MODEL IS CALLED HERE</p>
      </div>
    </div>}
  </>;
}
