import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { districts, journey, type District } from '../data/city';
import { experience, achievements } from '../data/experience';
import { projects } from '../data/projects';
import { portfolio } from '../data/portfolio';
import { skills } from '../data/skills';
import { Modal } from './Modal';
import type { Point, RideStatus, TransitKind } from '../game/World/transit';

export function CityMap({ position, canRide, onTravel, onOpen, onRide, onClose }: {
  canRide: boolean;
  position: Point; onTravel: (id: string) => void; onOpen: (id: string) => void;
  onRide: (kind: TransitKind, destination?: string) => void; onClose: () => void;
}) {
  const [kind, setKind] = useState<TransitKind>('taxi');
  return <Modal title="MUMBAI CITY DIRECTORY" onClose={onClose} className="city-map-modal">
    <div className="city-map-heading"><span className="eyebrow">A SMALL CITY. NINE BIG STOPS.</span><h2>Where to, boss?</h2><p>A made-up Mumbai, built around the work. Take a scenic ride or go straight to a stop.</p></div>
    <div className="city-map-layout"><div className="city-map-graphic" aria-label="Stylized city map with current position">
      <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" className="map-sea"/><circle cx="50" cy="50" r="39" className="map-land"/><circle cx="50" cy="50" r="21" className="map-loop"/><path d="M50 14V86M14 50H86" className="map-cross"/></svg>
      <span className="map-sea-label">ARABIAN SEA<br />/ A LITTLE IMAGINATION</span>
      {districts.map((d, i) => <button className="city-map-stop" style={{ left: `${50 + d.position[0]}%`, top: `${50 + d.position[2]}%`, background: d.color }} key={d.id} aria-label={`Explore ${d.title}`} onClick={() => onOpen(d.id)}><b>{String(i + 1).padStart(2, '0')}</b><span>{d.shortName}</span></button>)}
      <span className="map-you" style={{ left: `${50 + position.x}%`, top: `${50 + position.z}%` }} aria-label="Your current position">▲<small>YOU</small></span>
    </div><div className="city-directory"><div className="transport-choice" aria-label="Ride type"><button aria-pressed={kind === 'taxi'} onClick={() => setKind('taxi')}>KAALI-PEELI</button><button aria-pressed={kind === 'auto'} onClick={() => setKind('auto')}>AUTO</button></div>
      {districts.map((d, i) => <article key={d.id}><button onClick={() => onOpen(d.id)}><span className="district-number" style={{ color: d.color }}>{String(i + 1).padStart(2, '0')}</span><span><strong>{d.title}</strong><small>{d.descriptor}</small></span></button><div><button disabled={!canRide} aria-label={`Ride to ${d.title}`} onClick={() => onRide(kind, d.id)}>RIDE ↗</button><button aria-label={`Travel to ${d.title}`} onClick={() => onTravel(d.id)}>GO →</button></div></article>)}
      <p className="caption">RIDE = TAKE THE SCENIC ROUTE · GO = FAST TRAVEL</p></div></div>
  </Modal>;
}

export function RideMeter({ ride, onChoose, onSkip, onExit, onOpen }: { ride: RideStatus; onChoose: (id: string) => void; onSkip: () => void; onExit: () => void; onOpen: (id: string) => void }) {
  if (ride.phase === 'idle') return null;
  const destination = districts.find(d => d.id === ride.destination);
  return <section className="ride-meter" aria-label="Portfolio Meter">
    <div className="meter-top"><span>{ride.kind === 'auto' ? 'AUTO RICKSHAW' : 'KAALI-PEELI'} / STORY FARE</span><button aria-label="Exit ride" onClick={onExit}>✕</button></div>
    <div className="meter-face"><span className="caption">PORTFOLIO METER</span><strong data-testid="ride-fare">₹{ride.fare.toFixed(2)}</strong><span>JUST FOR THE JOURNEY. NO PAYMENT.</span></div>
    {ride.phase === 'hailing' ? <p role="status">Your driver is pulling over. One moment…</p> : ride.phase === 'boarding' ? <><p>Your ride is ready.<br /><strong>Choose your next stop.</strong></p><label className="ride-destination">DESTINATION<select aria-label="Ride destination" value="" onChange={e => onChoose(e.target.value)}><option value="" disabled>Where shall we go?</option>{districts.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label></> : <><p className="ride-destination-name">{destination?.title}</p><div className="meter-readings"><span>{Math.round(ride.distance)} m / model distance</span><span>{Math.floor(ride.elapsed)} sec</span></div><progress aria-label="Ride progress" value={ride.progress} max={1} />{ride.phase === 'riding' ? <button className="primary-button" onClick={onSkip}>SKIP TO ARRIVAL →</button> : <><p role="status">Arrived. Your story continues here.</p><button className="primary-button" onClick={() => { onExit(); if (destination) onOpen(destination.id); }}>STEP OUT & MEET THE GUIDE →</button></>}</>}
  </section>;
}

export function DistrictExperience({ district: d, reduced, resumeAvailable, onClose, onProject, onQuick, onContact, onDestination }: {
  district: District; reduced: boolean; resumeAvailable: boolean; onClose: () => void;
  onProject: (id: string) => void; onQuick: () => void; onContact: () => void; onDestination: (id: string) => void;
}) {
  const [inside, setInside] = useState(false);
  return <Modal title={d.title} onClose={onClose} className={`district-modal district-${d.id}`}>
    <div className="district-heading" style={{ '--district-color': d.color } as CSSProperties}><span className="eyebrow">STOP {String(districts.indexOf(d) + 1).padStart(2, '0')} / MINI MUMBAI</span><h2>{d.title}</h2><p>{d.descriptor}</p></div>
    <div className="guide-dialogue"><div className="guide-avatar" aria-hidden="true">☻</div><div><span className="eyebrow">{d.guide}</span><p>“{d.greeting}”</p><div className="guide-actions"><button className="primary-button" onClick={() => setInside(true)}>{d.id === 'filmcity' ? 'TAKE A SEAT →' : 'SHOW ME AROUND →'}</button><button className="text-button" onClick={onQuick}>QUICK VIEW ↗</button></div></div></div>
    {inside && <div className="district-content">
      {d.id === 'cst' && <><h3>Welcome to Harsh’s city.</h3><p>{portfolio.tagline} {portfolio.education}. Expected graduation: {portfolio.graduation}.</p><div className="district-stop-list">{districts.filter(item => item.id !== 'cst').map(item => <button key={item.id} onClick={() => onDestination(item.id)}>{item.title}<span>↗</span></button>)}</div></>}
      {d.id === 'fort' && <><h3>Scientific Python, developed upstream.</h3><p>{experience[0].description}</p><ul>{experience[0].highlights.map(h => <li key={h}>{h}</li>)}</ul><div className="district-metrics">{projects[0].metrics.map(m => <a key={m.label} href={m.source} target="_blank" rel="noreferrer"><strong>{m.value}</strong><span>{m.label} ↗</span></a>)}</div><button className="primary-button" onClick={() => onProject('ffprime')}>OPEN FFPRIME CASE STUDY ↗</button></>}
      {d.id === 'bkc' && <><span className="eyebrow">{experience[1].period} / {experience[1].organization}</span><h3>{experience[1].title}</h3><p>{experience[1].description}</p><ul>{experience[1].highlights.map(h => <li key={h}>{h}</li>)}</ul><div className="system-route"><span>POLICY</span><b>→</b><span>OAUTH2</span><b>→</b><span>SECURE ACCESS</span></div><a className="text-button" href={experience[1].source} target="_blank" rel="noreferrer">RÉSUMÉ SOURCE ↗</a></>}
      {d.id === 'andheri' && <SkillBazaar onProject={onProject} />}
      {d.id === 'powai' && <div className="district-projects">{projects.filter(p => p.id !== 'ffprime').map(p => <article key={p.id}><span className="eyebrow">{p.category}</span><h3>{p.title}</h3><p>{p.shortDescription}</p><p className="architecture-strip">{p.architecture.slice(0, 4).join(' → ')}</p><button className="primary-button" onClick={() => onProject(p.id)}>EXPLORE THE CASE STUDY ↗</button></article>)}</div>}
      {d.id === 'dadar' && <div className="journey-platforms">{journey.map((stop, i) => <article key={stop.title}><b>{String(i + 1).padStart(2, '0')}</b><div><span className="eyebrow">{stop.date}</span><h3>{stop.title}</h3><p>{stop.detail}</p></div></article>)}</div>}
      {d.id === 'worli' && <><h3>Numbers with their receipts.</h3><p>Résumé claims, upstream checks, and repository audits stay distinct. Seeded demos are never presented as production outcomes.</p><div className="signal-evidence">{achievements.map(a => <article key={a.title}><h3>{a.title}</h3><p>{a.detail}</p><a href={a.source} target="_blank" rel="noreferrer">SOURCE ↗</a></article>)}</div><div className="district-metrics">{[projects[0], projects[1]].flatMap(p => p.metrics.filter(m => m.source).map(m => <a key={p.id + m.label} href={m.source} target="_blank" rel="noreferrer"><strong>{m.value}</strong><span>{p.title} / {m.label} ↗</span></a>))}</div></>}
      {d.id === 'juhu' && <><h3>The person behind the systems.</h3><p>{portfolio.name}. {portfolio.education}. Expected graduation: {portfolio.graduation}.</p><p>Interested in scientific computing, software engineering, and applied AI. Building tools that make complicated ideas usable.</p><div className="case-links">{resumeAvailable && <a className="primary-button" href={portfolio.resume} target="_blank" rel="noreferrer">DOWNLOAD RÉSUMÉ ↓</a>}<a href={portfolio.github} target="_blank" rel="noreferrer">GITHUB ↗</a><a href={portfolio.linkedin} target="_blank" rel="noreferrer">LINKEDIN ↗</a><button onClick={onContact}>SAY HELLO ↗</button></div></>}
      {d.id === 'filmcity' && <Theatre reduced={reduced} onContact={onContact} />}
    </div>}
  </Modal>;
}

function SkillBazaar({ onProject }: { onProject: (id: string) => void }) {
  const [active, setActive] = useState('Python');
  const matches = projects.filter(p => p.skills.some(s => s.toLowerCase() === active.toLowerCase()));
  return <><h3>Pick a skill. Follow the evidence.</h3><div className="bazaar-stalls">{skills.map(group => <section key={group.title}><span className="eyebrow">{group.title}</span><div>{group.items.map(skill => <button key={skill} aria-pressed={active === skill} onClick={() => setActive(skill)}>{skill}</button>)}</div></section>)}</div><section className="bazaar-evidence" aria-live="polite"><h3>{active} / the receipts</h3>{matches.length ? matches.map(p => <button key={p.id} onClick={() => onProject(p.id)}>{p.title}<small>{p.shortDescription}</small><span>OPEN CASE STUDY ↗</span></button>) : <><p>Listed in résumé / experience. No dedicated project evidence is claimed here.</p><a href={portfolio.resume} target="_blank" rel="noreferrer">INSPECT THE RÉSUMÉ ↗</a></>}</section></>;
}

const scenes = [
  { name: 'Arrival', title: 'Harsh Jha. Builder, in motion.', body: portfolio.tagline, label: 'SOFTWARE / AI / SCIENTIFIC COMPUTING' },
  { name: 'Foundations', title: 'VIT. A place to start.', body: `${portfolio.education}. Expected graduation: ${portfolio.graduation}.`, label: 'CLASS OF 2028 / JOURNEY IN PROGRESS' },
  { name: 'The first builds', title: 'Ideas need working systems.', body: 'From personal finance tools to route planning and AI systems, projects make the learning tangible.', label: 'BUILD / TEST / ITERATE' },
  { name: 'Open source', title: 'Research, reviewed upstream.', body: experience[0].description + ' Five merged upstream pull requests; 32 passing tests reported in PR #13.', label: 'GSOC 2026 / QC-DEVS / THEOCHEM' },
  { name: 'Enterprise', title: 'Code meets real constraints.', body: experience[1].description, label: 'CCIEEXPERT / JULY 2026' },
  { name: 'The products', title: 'Five stops. Different problems.', body: projects.filter(p => p.id !== 'ffprime').map(p => `${p.title}: ${p.subtitle}`).join(' · '), label: 'POWAI PRODUCT DISTRICT' },
  { name: 'The signals', title: 'Evidence, not buzzwords.', body: achievements[0].detail + '. FFprime speedup and RMSE figures are résumé reported; project case studies retain their source qualifiers.', label: 'GOOGLE BIG CODE 2026 / SOURCE-AWARE' },
  { name: 'Next chapter', title: 'Keep building. Keep validating.', body: 'Scientific computing, useful AI, and software that stands up to real constraints. The next project starts with a good question.', label: 'AN INTEREST, NOT A CLAIM OF FUTURE WORK' },
  { name: 'Until next time', title: 'Let’s build something.', body: 'For engineering opportunities, research, or a good technical conversation. Thanks for taking the scenic route.', label: 'THE END / OR THE BEGINNING' },
];
function Theatre({ reduced, onContact }: { reduced: boolean; onContact: () => void }) {
  const root = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { root.current?.focus({ preventScroll: true }); root.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, []);
  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);
  useEffect(() => {
    if (!playing) return;
    if (index === scenes.length - 1) { setPlaying(false); return; }
    const timer = window.setInterval(() => setIndex(current => Math.min(current + 1, scenes.length - 1)), 7000);
    return () => clearInterval(timer);
  }, [playing, index]);
  const scene = scenes[index];
  return <section ref={root} tabIndex={-1} className="talkies" aria-label="Film City story theatre"><div className="projector-beam" aria-hidden="true"/><div className="cinema-screen" aria-live={playing ? 'off' : 'polite'}><span className="caption">{scene.label}</span><span className="scene-number" aria-hidden="true">0{index + 1}</span><h3>{scene.title}</h3><p>{scene.body}</p>{index === scenes.length - 1 && <button className="primary-button" onClick={onContact}>GET IN TOUCH ↗</button>}</div><div className="cinema-seats" aria-hidden="true">▰ ▰ ▰ ▰ ▰ ▰ ▰</div><nav className="theatre-controls" aria-label="Story controls"><button disabled={index === 0} onClick={() => setIndex(i => i - 1)}>← PREVIOUS</button><button aria-pressed={playing} onClick={() => setPlaying(p => !p)}>{playing ? 'PAUSE' : 'AUTOPLAY'}</button><span>{index + 1} / {scenes.length} · {scene.name}</span><button disabled={index === scenes.length - 1} onClick={() => setIndex(i => i + 1)}>NEXT →</button></nav><div className="scene-selector">{scenes.map((s, i) => <button key={s.name} aria-label={`Scene ${i + 1}: ${s.name}`} aria-current={i === index ? 'step' : undefined} onClick={() => setIndex(i)}>{String(i + 1).padStart(2, '0')}</button>)}</div><p className="caption">TEXT-LED CINEMA / NO AUTOPLAY AUDIO · EXIT WITH ESC</p></section>;
}
