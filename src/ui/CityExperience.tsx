import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { districts, journey, type District } from '../data/city';
import { experience, achievements } from '../data/experience';
import { POWAI_PROJECTS, projects } from '../data/projects';
import { portfolio } from '../data/portfolio';
import {ResearchExhibition} from './ResearchExhibition';
import { FLAGSHIP_LABS } from '../data/flagshipLabs';
import { AstflowLab, SkillShops } from './LazyLabs';
import { Modal } from './Modal';
import { streetStops, zoneAt } from '../game/World/streetLayout';
import type { Point, TransitKind } from '../game/World/transit';
import { TRAILER } from '../data/trailer';
export { RideMeter } from './RideMeter';

export function CityMap({ position, canRide, objective, waypoint, onMark, onTravel, onOpen, onRide, onClose }: {
  canRide: boolean;
  position: Point; onTravel: (id: string) => void; onOpen: (id: string) => void;
  /** The quest's next open step (its id is a district), and the stop the visitor has marked. */
  objective?: { id: string; label: string; index: number; total: number } | null; waypoint?: string | null; onMark?: (id: string) => void;
  onRide: (kind: TransitKind, destination?: string) => void; onClose: () => void;
}) {
  const [kind, setKind] = useState<TransitKind>('taxi');
  const tag = (id: string) => [objective?.id === id && 'is-objective', waypoint === id && 'is-waypoint'].filter(Boolean).join(' ');
  const note = (id: string) => `${objective?.id === id ? ' · current objective' : ''}${waypoint === id ? ' · marked' : ''}`;
  return <Modal title="MUMBAI CITY DIRECTORY" onClose={onClose} className="city-map-modal">
    <div className="city-map-heading"><span className="eyebrow">{zoneAt(position.x).label} / CITY DIRECTORY</span><h2>Where to, boss?</h2><p>Every stop is a street you can walk. Flag a kaali-peeli or an auto and watch the meter, or jump straight there.</p>
      {objective !== undefined && <div className="map-objective" role="status">
        {objective ? <><span className="eyebrow">OBJECTIVE {objective.index + 1} OF {objective.total}</span><strong>{objective.label}</strong>
          {onMark && <button className="text-button" aria-pressed={waypoint === objective.id} onClick={() => onMark(objective.id)}>{waypoint === objective.id ? 'MARKED ON THE STREET ✓' : 'MARK IT ON THE STREET'}</button>}</>
          : <><span className="eyebrow">OBJECTIVES</span><strong>All five done. The city is yours to wander.</strong></>}
      </div>}</div>
    <div className="city-map-layout"><div className="city-map-graphic" aria-label="Stylized city map with current position">
      <svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" className="map-land"/><path d="M23 16 V76 H50 V36 H77 V76" className="map-loop"/><path d="M5 0V100" stroke="#5c99a8" strokeWidth="15"/></svg>
      <span className="map-sea-label">FORT ROAD<br />CST ↔ OPEN SOURCE HALL</span>
      {districts.map((d, i) => <button className={`city-map-stop ${tag(d.id)}`} style={{ left: `${[23,23,23,50,50,50,77,77,77][i]}%`, top: `${[16,46,76,76,56,36,36,56,76][i]}%`, background: d.color }} key={d.id} aria-label={`Explore ${d.title}${note(d.id)}`} onClick={() => onOpen(d.id)}><b>{String(i + 1).padStart(2, '0')}</b><span>{d.shortName}</span></button>)}
      <span className="map-you" style={zoneAt(position.x).id === 'cst' ? { left: '23%', top: `${16 + Math.max(0,Math.min(1,(10-position.z)/45))*30}%` } : { left: `${[23,23,23,50,50,50,77,77,77][districts.findIndex(d => d.id === zoneAt(position.x).id)]}%`, top: `${[16,46,76,76,56,36,36,56,76][districts.findIndex(d => d.id === zoneAt(position.x).id)] - 7}%` }} aria-label="Your current position">●<small>YOU ARE HERE</small></span>
    </div><div className="city-directory"><div className="transport-choice" aria-label="Ride type"><button aria-pressed={kind === 'taxi'} onClick={() => setKind('taxi')}>KAALI-PEELI</button><button aria-pressed={kind === 'auto'} onClick={() => setKind('auto')}>AUTO</button></div>
      {districts.map((d, i) => <article key={d.id} className={tag(d.id)}><button onClick={() => onOpen(d.id)}><span className="district-number" style={{ color: d.color }}>{String(i + 1).padStart(2, '0')}</span><span><strong>{d.title}</strong><small>{objective?.id === d.id ? <><em className="objective-tag">OBJECTIVE</em> {objective.label}</> : d.descriptor}</small></span></button><div><button disabled={!canRide || !streetStops[d.id]} aria-label={`Ride to ${d.title}`} onClick={() => onRide(kind, d.id)}>RIDE ↗</button><button aria-label={`Travel to ${d.title}`} onClick={() => onTravel(d.id)}>GO →</button></div></article>)}
      <p className="caption">EVERY STOP: WALK, RIDE OR JUMP · TALK TO THE GUIDE FOR THE PORTFOLIO</p></div></div>
  </Modal>;
}

export function DistrictExperience({ district: d, reduced, resumeAvailable, onClose, onProject, onQuick, onContact, onDestination, onTour, onFinale }: {
  district: District; reduced: boolean; resumeAvailable: boolean; onClose: () => void;
  onProject: (id: string) => void; onQuick: () => void; onContact: () => void; onDestination: (id: string) => void;
  /** Present when this guide offers an in-world guided tour. */
  onTour?: () => void; onFinale?: () => void;
}) {
  const [inside, setInside] = useState(false);
  return <Modal title={d.title} onClose={onClose} className={`district-modal district-${d.id}`}>
    <div className="district-heading" style={{ '--district-color': d.color } as CSSProperties}><span className="eyebrow">STOP {String(districts.indexOf(d) + 1).padStart(2, '0')} / MINI MUMBAI</span><h2>{d.title}</h2><p>{d.descriptor}</p></div>
    <div className="guide-dialogue"><div className="guide-avatar" aria-hidden="true">☻</div><div><span className="eyebrow">{d.guide}</span><p>“{d.greeting}”</p><div className="guide-actions"><button className="primary-button" onClick={() => setInside(true)}>{d.id === 'filmcity' ? 'TAKE A SEAT →' : 'SHOW ME AROUND →'}</button>{onTour && <button className="primary-button" onClick={onTour}>TAKE THE GUIDED TOUR ↗</button>}<button className="text-button" onClick={onQuick}>QUICK VIEW ↗</button><button className="back-button" onClick={onClose}>← BACK TO THE CITY</button></div></div></div>
    {inside && <div className="district-content"><button className="back-button district-back" onClick={() => setInside(false)}>← BACK TO {d.guide.toUpperCase()}</button>
      {d.id === 'cst' && <><h3>Welcome to Harsh’s city.</h3><p>{portfolio.tagline} {portfolio.education}. Expected graduation: {portfolio.graduation}.</p><div className="district-stop-list">{districts.filter(item => item.id !== 'cst').map(item => <button key={item.id} onClick={() => onDestination(item.id)}>{item.title}<span>↗</span></button>)}</div></>}
      {d.id === 'fort' && <><ResearchExhibition/><h3>Scientific Python, developed upstream.</h3><p>{experience[0].description}</p><ul>{experience[0].highlights.map(h => <li key={h}>{h}</li>)}</ul><div className="district-metrics">{projects[0].metrics.map(m => <a key={m.label} href={m.source} target="_blank" rel="noreferrer"><strong>{m.value}</strong><span>{m.label} ↗</span></a>)}</div><button className="primary-button" onClick={() => onProject('ffprime')}>OPEN FFPRIME CASE STUDY ↗</button></>}
      {d.id === 'bkc' && <><span className="eyebrow">{experience[1].period} / {experience[1].organization}</span><h3>{experience[1].title}</h3><p>{experience[1].description}</p><ul>{experience[1].highlights.map(h => <li key={h}>{h}</li>)}</ul><div className="system-route"><span>POLICY</span><b>→</b><span>OAUTH2</span><b>→</b><span>SECURE ACCESS</span></div><a className="text-button" href={experience[1].source} target="_blank" rel="noreferrer">RÉSUMÉ SOURCE ↗</a></>}
      {d.id === 'andheri' && <SkillShops onProject={onProject} />}
      {d.id === 'powai' && <><h3>Five workplaces, one per project.</h3><p>Each facility opens a working demo that runs the project's own logic, ported from a pinned commit, followed by the full case study and source.</p><div className="district-projects">{POWAI_PROJECTS.map(id => projects.find(p => p.id === id)!).map(p => <article key={p.id}><span className="eyebrow">{FLAGSHIP_LABS[p.id]?.setting ?? p.category}</span><h3>{FLAGSHIP_LABS[p.id]?.place ?? `${p.title} Recovery Control Tower`}</h3><p>{p.shortDescription}</p><p className="architecture-strip">{p.architecture.slice(0, 4).join(' → ')}</p><button className="primary-button" onClick={() => onProject(p.id)}>{FLAGSHIP_LABS[p.id] ? 'OPEN THE WORKING DEMO ↗' : 'EXPLORE THE CASE STUDY ↗'}</button></article>)}</div><AstflowLab /></>}
      {d.id === 'dadar' && <div className="journey-platforms">{journey.map((stop, i) => <article key={stop.title}><b>{String(i + 1).padStart(2, '0')}</b><div><span className="eyebrow">{stop.date}</span><h3>{stop.title}</h3><p>{stop.detail}</p></div></article>)}</div>}
      {d.id === 'worli' && <><h3>Numbers with their receipts.</h3><p>Résumé claims, upstream checks, and repository audits stay distinct. Seeded demos are never presented as production outcomes.</p><div className="signal-evidence">{achievements.map(a => <article key={a.title}><h3>{a.title}</h3><p>{a.detail}</p><a href={a.source} target="_blank" rel="noreferrer">SOURCE ↗</a></article>)}</div><div className="district-metrics">{[projects[0], projects[1]].flatMap(p => p.metrics.filter(m => m.source).map(m => <a key={p.id + m.label} href={m.source} target="_blank" rel="noreferrer"><strong>{m.value}</strong><span>{p.title} / {m.label} ↗</span></a>))}</div></>}
      {d.id === 'juhu' && <><h3>The person behind the systems.</h3><p>{portfolio.name}. {portfolio.education}. Expected graduation: {portfolio.graduation}.</p><p>Interested in scientific computing, software engineering, and applied AI. Building tools that make complicated ideas usable.</p><div className="case-links">{resumeAvailable && <a className="primary-button" href={portfolio.resume} target="_blank" rel="noreferrer">DOWNLOAD RÉSUMÉ ↓</a>}<a href={portfolio.github} target="_blank" rel="noreferrer">GITHUB ↗</a><a href={portfolio.linkedin} target="_blank" rel="noreferrer">LINKEDIN ↗</a><button onClick={onContact}>SAY HELLO ↗</button></div></>}
      {d.id === 'filmcity' && <Theatre reduced={reduced} onContact={onContact} onExit={onClose} onFinale={onFinale} />}
    </div>}
  </Modal>;
}

export const scenes = [
  { name: 'Arrival', title: 'Harsh Jha. Builder, in motion.', body: portfolio.tagline, label: 'SOFTWARE / AI / SCIENTIFIC COMPUTING' },
  { name: 'Foundations', title: 'VIT. A place to start.', body: `${portfolio.education}. Expected graduation: ${portfolio.graduation}.`, label: 'CLASS OF 2028 / JOURNEY IN PROGRESS' },
  { name: 'The first builds', title: 'Ideas need working systems.', body: 'From personal finance tools to route planning and AI systems, projects make the learning tangible.', label: 'BUILD / TEST / ITERATE' },
  { name: 'Open source', title: 'Open source, reviewed upstream.', body: experience[0].description + ' Five merged upstream pull requests; 32 passing tests reported in PR #13.', label: 'GSOC 2026 CONTRIBUTOR / QC-DEVS' },
  { name: 'Enterprise', title: 'Code meets real constraints.', body: experience[1].description, label: 'CCIEEXPERT / JULY 2026' },
  { name: 'The products', title: 'Many workplaces. Different problems.', body: projects.filter(p => p.id !== 'ffprime').map(p => `${p.title}: ${p.subtitle}`).join(' · '), label: 'POWAI PRODUCT DISTRICT' },
  { name: 'The signals', title: 'Evidence, not buzzwords.', body: achievements[0].detail + '. FFprime speedup and RMSE figures are résumé reported; project case studies retain their source qualifiers.', label: 'GOOGLE BIG CODE 2026 / SOURCE-AWARE' },
  { name: 'Next chapter', title: 'Keep building. Keep validating.', body: 'Scientific computing, useful AI, and software that stands up to real constraints. The next project starts with a good question.', label: 'AN INTEREST, NOT A CLAIM OF FUTURE WORK' },
  { name: 'Until next time', title: 'Let’s build something.', body: 'For engineering opportunities, research, or a good technical conversation. Thanks for taking the scenic route.', label: 'THE END / OR THE BEGINNING' },
];
/** The Talkies on show night: the trailer with sound, with the nine scenes kept as a readable programme. */
export function Theatre({ reduced, onContact, onExit, onFinale, initialScene }: { reduced: boolean; onContact: () => void; onExit: () => void; onFinale?: () => void; initialScene?: number }) {
  const [mode, setMode] = useState<'film' | 'scenes'>(initialScene === undefined ? 'film' : 'scenes');
  return mode === 'film'
    ? <TrailerScreen reduced={reduced} onContact={onContact} onExit={onExit} onFinale={onFinale} onScenes={() => setMode('scenes')} />
    : <SceneTheatre reduced={reduced} onContact={onContact} onExit={onExit} onFinale={onFinale} initialScene={initialScene ?? 0} onFilm={() => setMode('film')} />;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function TrailerScreen({ reduced, onContact, onExit, onFinale, onScenes }: { reduced: boolean; onContact: () => void; onExit: () => void; onFinale?: () => void; onScenes: () => void }) {
  const root = useRef<HTMLElement>(null), video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false), [muted, setMuted] = useState(false), [time, setTime] = useState(0), [length, setLength] = useState(TRAILER.seconds), [ended, setEnded] = useState(false), [cc, setCc] = useState(false);
  useEffect(() => { root.current?.focus({ preventScroll: true }); root.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, []);
  // Opening the theatre is the visitor's own click or key press, so the film may start with sound; if the browser still refuses, it starts muted.
  useEffect(() => {
    const v = video.current; if (!v || reduced) return;
    v.muted = false; v.play().catch(() => { v.muted = true; setMuted(true); return v.play(); }).catch(() => {});
  }, [reduced]);
  const toggle = () => { const v = video.current; if (!v) return; if (v.paused) { setEnded(false); void v.play().catch(() => {}); } else v.pause(); };
  const replay = () => { const v = video.current; if (!v) return; v.currentTime = 0; setEnded(false); void v.play().catch(() => {}); };
  // The titles are burned in; captions add the sound descriptions for anyone who wants them.
  const captions = () => { const track = video.current?.textTracks[0]; if (!track) return; track.mode = track.mode === 'showing' ? 'hidden' : 'showing'; setCc(track.mode === 'showing'); };
  const sound = () => { const v = video.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); };
  const onKey = (event: ReactKeyboardEvent) => {
    if ((event.target as HTMLElement).closest('a,input')) return;
    const keys: Record<string, () => void> = { ' ': toggle, k: toggle, m: sound, Home: replay };
    const action = keys[event.key]; if (action && !((event.target as HTMLElement).tagName === 'BUTTON' && event.key === ' ')) { event.preventDefault(); action(); }
  };
  return <section ref={root} tabIndex={-1} className="talkies talkies-film" aria-label="Film City story theatre" onKeyDown={onKey}>
    <div className="projector-beam" aria-hidden="true"/>
    <div className="cinema-film">
      <video ref={video} poster={TRAILER.poster} playsInline preload="auto" aria-label="Trailer: Harsh Jha, built for what’s next (42 seconds, with sound)"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onLoadedMetadata={e => setLength(e.currentTarget.duration || TRAILER.seconds)}
        onTimeUpdate={e => setTime(e.currentTarget.currentTime)} onEnded={() => { setEnded(true); setPlaying(false); onFinale?.(); }} onClick={toggle}>
        {TRAILER.sources.map(source => <source key={source.src} src={source.src} type={source.type} />)}
        <track kind="captions" src={TRAILER.captions} srcLang="en" label="English" />
      </video>
      {(ended || (!playing && time === 0)) && <div className="film-overlay">{ended
        ? <><span className="caption">THE END / OR THE BEGINNING</span><button className="primary-button" onClick={onContact}>GET IN TOUCH ↗</button><button onClick={replay}>↺ WATCH AGAIN</button></>
        : <button className="primary-button" onClick={toggle}>▶ PLAY THE TRAILER</button>}</div>}
    </div>
    <div className="cinema-house" aria-hidden="true" />
    <div className="film-progress" aria-hidden="true"><i style={{ width: `${Math.min(100, time / length * 100)}%` }} /></div>
    <nav className="theatre-controls" aria-label="Film controls">
      <button aria-pressed={playing} onClick={toggle}>{playing ? '❚❚ PAUSE' : '▶ PLAY'}</button>
      <button aria-pressed={!muted} onClick={sound}>{muted ? 'SOUND OFF' : 'SOUND ON'}</button>
      <span>{clock(time)} / {clock(length)} · HOUSE FULL</span>
      <button onClick={replay}>↺ REPLAY</button>
      <button aria-pressed={cc} onClick={captions}>CC</button>
      <button onClick={onScenes}>READ THE NINE SCENES</button>
      <button onClick={onExit}>← EXIT THEATRE</button>
    </nav>
    <p className="caption">ORIGINAL SCORE · FILMED IN THIS CITY · SPACE PLAY / PAUSE · M SOUND · HOME REPLAY · ESC EXIT</p>
  </section>;
}

function SceneTheatre({ reduced, onContact, onExit, onFinale, initialScene, onFilm }: { reduced: boolean; onContact: () => void; onExit: () => void; onFinale?: () => void; initialScene: number; onFilm: () => void }) {
  const root = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(initialScene);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { root.current?.focus({ preventScroll: true }); root.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, []);
  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);
  useEffect(() => {
    if (!playing) return;
    if (index === scenes.length - 1) { setPlaying(false); return; }
    const timer = window.setInterval(() => setIndex(current => Math.min(current + 1, scenes.length - 1)), 7000);
    return () => clearInterval(timer);
  }, [playing, index]);
  useEffect(() => { if (index === scenes.length - 1) onFinale?.(); }, [index, onFinale]);
  const scene = scenes[index];
  // Keyboard: ← → step, Space plays or pauses, Home restarts, End skips to the final contact scene.
  const onKey = (event: ReactKeyboardEvent) => {
    if ((event.target as HTMLElement).closest('a,input')) return;
    const keys: Record<string, () => void> = { ArrowRight: () => setIndex(i => Math.min(i + 1, scenes.length - 1)), ArrowLeft: () => setIndex(i => Math.max(i - 1, 0)), ' ': () => setPlaying(p => !p), Home: () => { setIndex(0); setPlaying(false); }, End: () => { setIndex(scenes.length - 1); setPlaying(false); } };
    const action = keys[event.key]; if (action && !((event.target as HTMLElement).tagName === 'BUTTON' && event.key === ' ')) { event.preventDefault(); action(); }
  };
  return <section ref={root} tabIndex={-1} className="talkies" aria-label="Film City story theatre" onKeyDown={onKey}><div className="projector-beam" aria-hidden="true"/><div className="cinema-screen" aria-live={playing ? 'off' : 'polite'}><span className="caption">{scene.label}</span><span className="scene-number" aria-hidden="true">0{index + 1}</span><h3>{scene.title}</h3><p>{scene.body}</p>{index === scenes.length - 1 && <button className="primary-button" onClick={onContact}>GET IN TOUCH ↗</button>}</div><div className="cinema-house" aria-hidden="true" /><nav className="theatre-controls" aria-label="Story controls"><button disabled={index === 0} onClick={() => setIndex(i => i - 1)}>← PREVIOUS</button><button aria-pressed={playing} onClick={() => setPlaying(p => !p)}>{playing ? 'PAUSE' : 'AUTOPLAY'}</button><span>{index + 1} / {scenes.length} · {scene.name}</span><button disabled={index === scenes.length - 1} onClick={() => setIndex(i => i + 1)}>NEXT →</button><button onClick={() => { setIndex(0); setPlaying(false); }}>↺ RESTART</button><button disabled={index === scenes.length - 1} onClick={() => { setIndex(scenes.length - 1); setPlaying(false); }}>SKIP TO THE END ⇥</button><button onClick={onFilm}>▶ WATCH THE TRAILER</button><button onClick={onExit}>← EXIT THEATRE</button></nav><div className="scene-selector">{scenes.map((s, i) => <button key={s.name} aria-label={`Scene ${i + 1}: ${s.name}`} aria-current={i === index ? 'step' : undefined} onClick={() => setIndex(i)}>{String(i + 1).padStart(2, '0')}</button>)}</div><p className="caption">THE PROGRAMME IN TEXT · ← → STEP · SPACE PLAY · HOME RESTART · END SKIP · ESC EXIT</p></section>;
}
