import { useState } from 'react';
import { DISTRICT_EXHIBITS, exhibitById } from '../data/districtExhibits';
import { experience, achievements } from '../data/experience';
import { journey, districts } from '../data/city';
import { portfolio } from '../data/portfolio';
import { SHOPS, type Shop } from '../data/shops';
import { BUCKET, PAGES, RATES, ingest, solves, type IngestRun, type Rate } from '../game/activities/rateLimit';
import { AstflowLab, SkillShops } from './LazyLabs';
import { Theatre, scenes } from './CityExperience';

/** Exhibits that open a panel (Powai's project boards open the project itself, so they are not listed). */
export const DISTRICT_EXHIBIT_TITLES: Record<string, string> = Object.fromEntries(DISTRICT_EXHIBITS
  .filter(e => e.district !== 'powai' || e.id === 'astflow')
  .map(e => [e.id, `${districts.find(d => d.id === e.district)!.shortName.toUpperCase()} / ${e.panel.title.toUpperCase()}`]));

export interface DistrictExhibitProps {
  id: string; reduced: boolean; resumeAvailable: boolean; discovered: string[];
  onSolved: (id: string) => void; onOpen: (id: string) => void; onProject: (id: string) => void; onContact: () => void; onClose: () => void; onFinale: () => void;
}

export function DistrictExhibitBody(props: DistrictExhibitProps) {
  const { id } = props, e = exhibitById(id);
  const shop = /^andheri-shop-(.+)$/.exec(id), stop = /^dadar-stop-(\d)$/.exec(id), worli = /^worli-case-(\d)$/.exec(id);
  return <>
    {id === 'bkc-brief' && <BkcBrief />}
    {id === 'bkc-ratelimit' && <RateLimitConsole onSolved={() => props.onSolved(id)} />}
    {id === 'bkc-flow' && <RequestPath />}
    {shop && <SkillShops onProject={props.onProject} initialShop={shop[1] as Shop['id']} />}
    {id === 'astflow' && <AstflowLab />}
    {stop && <Platform index={Number(stop[1])} discovered={props.discovered} onOpen={props.onOpen} />}
    {worli && <EvidenceCase index={Number(worli[1])} onSolved={() => props.onSolved(id)} />}
    {id === 'juhu-about' && <section className="district-exhibit"><span className="eyebrow">{e?.panel.eyebrow}</span><h2>{portfolio.name}</h2><p>{portfolio.education}. Expected graduation: {portfolio.graduation}.</p><p>{portfolio.tagline} Interested in scientific computing, software engineering and applied AI: building tools that make complicated ideas usable.</p></section>}
    {id === 'juhu-resume' && <section className="district-exhibit"><span className="eyebrow">{e?.panel.eyebrow}</span><h2>Everything, on one page.</h2><p>The résumé carries every role, project and result in this city, with the same qualifiers.</p><div className="case-links">{props.resumeAvailable ? <a className="primary-button" href={portfolio.resume} target="_blank" rel="noreferrer">DOWNLOAD RÉSUMÉ ↓</a> : <p className="caption">THE RÉSUMÉ FILE IS NOT AVAILABLE RIGHT NOW</p>}<a href={portfolio.github} target="_blank" rel="noreferrer">GITHUB ↗</a><a href={portfolio.linkedin} target="_blank" rel="noreferrer">LINKEDIN ↗</a></div></section>}
    {id === 'juhu-contact' && <section className="district-exhibit"><span className="eyebrow">{e?.panel.eyebrow}</span><h2>Let’s build something.</h2><p>For engineering opportunities, research, or a good technical conversation.</p><div className="case-links"><button className="primary-button" onClick={props.onContact}>WRITE TO HARSH ↗</button><a href={portfolio.linkedin} target="_blank" rel="noreferrer">LINKEDIN ↗</a></div></section>}
    {(id === 'filmcity-boxoffice' || id === 'filmcity-screen') && <Theatre reduced={props.reduced} onContact={props.onContact} onExit={props.onClose} onFinale={props.onFinale} />}
    {id === 'filmcity-scenes' && <SceneBoard {...props} />}
  </>;
}

function BkcBrief() {
  const job = experience[1];
  return <section className="district-exhibit"><span className="eyebrow">{job.period} / {job.organization}</span><h2>{job.title}</h2><p>{job.description}</p><ul>{job.highlights.map(h => <li key={h}>{h}</li>)}</ul><a className="text-button" href={job.source} target="_blank" rel="noreferrer">RÉSUMÉ SOURCE ↗</a></section>;
}

const PATH = [
  { title: 'Requirements and API research', body: 'What the security team needs, and what the Cisco Secure Access API actually offers.' },
  { title: 'OAuth2 authentication', body: 'The tool obtains a token before it may call anything; every request carries it.' },
  { title: 'HTTP integration, rate-limited ingestion', body: 'Requests go out within the API’s limits, so ingestion finishes without being throttled.' },
  { title: 'Policy analysis in a Python CLI', body: 'What comes back is analysed from the command line.' },
  { title: 'A Manifest V3 browser extension', body: 'The same integration, where people actually work: in the browser.' },
  { title: 'Review, testing and deployment', body: 'Code review, defect resolution, and results presented to stakeholders.' },
];
function RequestPath() {
  const [step, setStep] = useState(0);
  return <section className="district-exhibit request-path"><span className="eyebrow">BKC / THE PIECES OF THE INTEGRATION</span><h2>From requirement to running tool.</h2>
    <p>Every piece below is from the internship’s description and highlights. Step through how they connect; the order is how a request meets them, not a timeline.</p>
    <ol>{PATH.map((p, i) => <li key={p.title} className={i === step ? 'current' : i < step ? 'done' : ''}><button aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}><b>{String(i + 1).padStart(2, '0')}</b>{p.title}</button>{i === step && <p>{p.body}</p>}</li>)}</ol>
    <div className="tour-actions"><button disabled={step === 0} onClick={() => setStep(s => s - 1)}>← BACK</button><button disabled={step === PATH.length - 1} onClick={() => setStep(s => s + 1)}>NEXT →</button></div>
    <a className="text-button" href={experience[1].source} target="_blank" rel="noreferrer">RÉSUMÉ SOURCE ↗</a></section>;
}

/** BKC activity: choose a send rate and back-off, ingest 40 pages, avoid 429s. */
export function RateLimitConsole({ onSolved }: { onSolved: () => void }) {
  const [rate, setRate] = useState<Rate>(8), [backoff, setBackoff] = useState(false), [runs, setRuns] = useState<IngestRun[]>([]);
  const last = runs[runs.length - 1], solved = runs.some(solves);
  const run = () => { const r = ingest(rate, backoff); setRuns(list => [...list.slice(-4), r]); if (solves(r) && !solved) onSolved(); };
  return <section className="rate-console" aria-label="Rate-limit console">
    <header><span className="eyebrow">BKC / SYSTEMS ACTIVITY</span><h2>Ingest every page. No 429s.</h2>
      <p>The API allows a burst of {BUCKET.capacity} requests and refills {BUCKET.refillPerSecond} a second (a token bucket). A request without a token is refused with <code>429 Too Many Requests</code>. Pick how fast to send and whether to back off for the <code>Retry-After</code> second, then ingest {PAGES} pages. Goal: zero 429s in the least time.</p></header>
    <div className="rate-controls" role="group" aria-label="Request settings">
      <fieldset><legend>Send rate</legend>{RATES.map(r => <button key={r} aria-pressed={rate === r} onClick={() => setRate(r)}>{r} / s</button>)}</fieldset>
      <label><input type="checkbox" checked={backoff} onChange={e => setBackoff(e.target.checked)} /> Back off on 429</label>
      <button className="primary-button" onClick={run}>RUN INGESTION</button>
    </div>
    {last && <div className="rate-result" aria-live="polite">
      <div className="rate-timeline" aria-hidden="true">{last.timeline.map((t, i) => <i key={i} className={t === '429' ? 'bad' : ''} />)}</div>
      <output className={last.rejected ? 'fail' : 'pass'}>{last.rate}/s{last.backoff ? ' with back-off' : ''}: {PAGES} pages in {last.seconds.toFixed(1)} s · {last.requests} requests · {last.rejected} × 429</output>
    </div>}
    {last && <p className={`rate-verdict ${solves(last) ? 'pass' : 'fail'}`} role="status">{solves(last)
      ? 'Clean and as fast as it gets. Sending at the refill rate uses every token the moment it exists; faster only burns requests on refusals, and slower leaves tokens unused.'
      : last.rejected ? 'Refused requests are wasted calls and, on a real API, a fast way to get blocked. Try another rate, or back off.'
      : 'No 429s, but tokens went unused. Can you go faster without being refused?'}</p>}
    {runs.length > 1 && <table className="rate-history"><caption className="caption">YOUR RUNS</caption><thead><tr><th>Rate</th><th>Back-off</th><th>Time</th><th>429s</th></tr></thead><tbody>{runs.map((r, i) => <tr key={i}><td>{r.rate}/s</td><td>{r.backoff ? 'yes' : 'no'}</td><td>{r.seconds.toFixed(1)} s</td><td>{r.rejected}</td></tr>)}</tbody></table>}
    <p className="caption">TEACHING MODEL OF RATE-LIMITED INGESTION · NOT THE INTERNSHIP’S CODE OR LIMITS · RUNS IN YOUR BROWSER</p>
  </section>;
}

function Platform({ index, discovered, onOpen }: { index: number; discovered: string[]; onOpen: (id: string) => void }) {
  const stop = journey[index], read = journey.filter((_, i) => i === index || discovered.includes(`dadar-stop-${i}`)).length;
  return <section className="district-exhibit platform-exhibit"><span className="eyebrow">PLATFORM {index + 1} OF {journey.length} · {stop.date}</span><h2>{stop.title}</h2><p>{stop.detail}</p>
    <p className="caption">{read} OF {journey.length} PLATFORMS READ{read === journey.length ? ' · THE WHOLE ROUTE' : ''}</p>
    <div className="tour-actions"><button disabled={index === 0} onClick={() => onOpen(`dadar-stop-${index - 1}`)}>← PLATFORM {index}</button><button disabled={index === journey.length - 1} onClick={() => onOpen(`dadar-stop-${index + 1}`)}>PLATFORM {index + 2} →</button></div></section>;
}

/** Worli activity: before trusting a claim, say what kind of evidence stands behind it. */
function EvidenceCase({ index, onSolved }: { index: number; onSolved: () => void }) {
  const a = achievements[index], kind = a.source.startsWith('http') ? 'public' : 'resume';
  const [answer, setAnswer] = useState<string | null>(null), right = answer === kind;
  const choose = (k: string) => { setAnswer(k); if (k === kind) onSolved(); };
  return <section className="district-exhibit evidence-case"><span className="eyebrow">WORLI / EVIDENCE CASE {index + 1}</span><h2>{a.title}</h2><p>{a.detail}.</p>
    <p><b>What stands behind this claim?</b></p>
    <div className="tour-actions" role="group" aria-label="Kind of evidence"><button aria-pressed={answer === 'public'} onClick={() => choose('public')}>A PUBLIC RECORD</button><button aria-pressed={answer === 'resume'} onClick={() => choose('resume')}>RÉSUMÉ REPORTED</button></div>
    {answer && <p className={`gradient-verdict ${right ? 'pass' : 'fail'}`} role="status">{right
      ? kind === 'public' ? 'Right: there is a public record you can open and check yourself.' : 'Right: this one is reported on the résumé. It is a fair claim, but there is no public record here to check it against, so it is labelled as such everywhere in the city.'
      : 'Not quite. Look at where the source link goes before you decide.'}</p>}
    <a className="text-button" href={a.source} target="_blank" rel="noreferrer">OPEN THE SOURCE ↗</a></section>;
}

function SceneBoard(props: DistrictExhibitProps) {
  const [scene, setScene] = useState<number | null>(null);
  if (scene !== null) return <Theatre reduced={props.reduced} onContact={props.onContact} onExit={props.onClose} onFinale={props.onFinale} initialScene={scene} />;
  return <section className="district-exhibit"><span className="eyebrow">FILM CITY TALKIES / PROGRAMME</span><h2>Nine scenes. Start anywhere.</h2>
    <ol className="scene-board">{scenes.map((s, i) => <li key={s.name}><button onClick={() => setScene(i)}><b>{String(i + 1).padStart(2, '0')}</b>{s.name}<small>{s.title}</small></button></li>)}</ol></section>;
}

export const SHOP_IDS = SHOPS.map(s => s.id);
