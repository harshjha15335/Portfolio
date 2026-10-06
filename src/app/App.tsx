import { useCallback, useEffect, useRef, useState } from 'react';
import { portfolio } from '../data/portfolio';
import { projects, type Project } from '../data/projects';
import { experience, achievements } from '../data/experience';
import { skills } from '../data/skills';
import { filterCommands, readRoute, type Command, type Mode } from '../utils/navigation';
import { Modal } from '../ui/Modal';
import { EditorialHome, EntryTransition } from '../ui/EditorialHome';
import { CaseStudy } from '../ui/CaseStudy';
import { ProjectGraphic } from '../ui/ProjectGraphic';
import { Annotation } from '../ui/Annotation';
import { districts } from '../data/city';
import { CityMap, DistrictExperience, RideMeter } from '../ui/CityExperience';
import { idleRide, type Point, type TransitKind } from '../game/World/transit';
import { streetStops, STREET_SPAWN } from '../game/World/streetLayout';
import type { WorldEngine } from '../core/WorldEngine';

const heroProjects = () => projects.filter(p => p.priority <= 4);

export default function App() {
  const route = readRoute(window.location.hash);
  const [mode, setMode] = useState<Mode>(route.mode);
  const [projectId, setProjectId] = useState<string | null>(route.project);
  const [placeId, setPlaceId] = useState<string | null>(route.district ?? null);
  const [ride, setRide] = useState(idleRide);
  const [position, setPosition] = useState<Point>({ x: STREET_SPAWN.x, z: STREET_SPAWN.z });
  const [near, setNear] = useState<string | null>(null);
  const [, setSpeed] = useState(0);
  const [ready, setReady] = useState(false);
  const [loadWorld, setLoadWorld] = useState(route.mode !== 'quick');
  const [fallback, setFallback] = useState('');
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const [map, setMap] = useState(false);
  const [contact, setContact] = useState(false);
  const [about, setAbout] = useState(false);
  const [query, setQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [entering, setEntering] = useState(false);
  const [mobile] = useState(() => matchMedia('(max-width: 760px), (pointer: coarse)').matches);
  const [reduced, setReduced] = useState(() => {
    try { return localStorage.getItem('hj-motion') === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  });
  const pendingMenu = useRef(false);
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<WorldEngine | null>(null);
  const modeRef = useRef(mode);
  const reducedRef = useRef(reduced);
  const fallbackRef = useRef(fallback);
  modeRef.current = mode;
  reducedRef.current = reduced;
  fallbackRef.current = fallback;
  const selected = projects.find(p => p.id === projectId);
  const district = districts.find(d => d.id === placeId);
  const overlayOpen = !!district || !!selected || palette || menu || map || contact || about || entering;
  const navigate = useCallback((next: Mode) => {
    if (fallbackRef.current && next === 'world') next = 'quick';
    if (next !== 'quick') setLoadWorld(true);
    window.location.hash = next === 'intro' ? '' : next;
    setMode(next); setProjectId(null); setPlaceId(null); setMap(false); setMenu(false); engine.current?.endRide();
  }, []);
  const openProject = useCallback((id: string) => {
    if (districts.some(d => d.id === id)) {
      engine.current?.focusLandmark(id); setMap(false); setPalette(false); setPlaceId(id); setProjectId(null);
      history.pushState({ mode: modeRef.current }, '', `#/place/${id}`); return;
    }
    if (id === 'about') { setAbout(true); return; }
    if (id === 'garage') { setMap(true); return; }
    if (!projects.some(p => p.id === id)) return;
    engine.current?.focusLandmark(id);
    setMap(false); setPalette(false); setPlaceId(null); setProjectId(id);
    history.pushState({ mode: modeRef.current }, '', `#/project/${id}`);
  }, []);
  const closeProject = () => { setProjectId(null); history.replaceState(null, '', mode === 'intro' ? window.location.pathname : `#${mode}`); };
  const closePlace = () => { setPlaceId(null); history.replaceState(null, '', `#${mode}`); };
  const hail = useCallback((kind: TransitKind, destination?: string) => {
    if (fallbackRef.current || !engine.current) return;
    setPlaceId(null); setProjectId(null); setMap(false); setPalette(false); navigate('world');
    engine.current.board(kind); if (destination) engine.current.rideTo(destination);
  }, [navigate]);
  const toggleReduced = () => setReduced(value => !value);
  const enterWorld = () => {
    if (!reduced && mode === 'intro' && !fallback) setEntering(true);
    navigate(fallback ? 'quick' : 'world');
  };
  useEffect(() => {
    if (!entering) return;
    if (reduced) { setEntering(false); return; }
    const timer = window.setTimeout(() => setEntering(false), 1100);
    return () => clearTimeout(timer);
  }, [entering, reduced]);
  const travel = (id: string) => {
    setMap(false); setPalette(false);
    if (fallback) { if (districts.some(d => d.id === id)) openProject(id); else if (id === 'about') setAbout(true); else if (id === 'garage') navigate('quick'); else openProject(id); return; }
    navigate('world');
    if (streetStops[id]) engine.current?.travelTo(id); else openProject(id);
  };

  useEffect(() => {
    if (!loadWorld) return;
    let cancelled = false;
    const fail = (error: unknown) => {
      if (cancelled) return;
      console.warn('3D portfolio unavailable:', error);
      setFallback('3D experience unavailable on this device — opening portfolio view.');
      setMode('quick'); setReady(true);
      history.replaceState(null, '', projectId ? `#/project/${projectId}` : '#quick');
      engine.current?.dispose(); engine.current = null;
    };
    if (new URLSearchParams(location.search).get('webgl') === 'off') { fail('WebGL disabled'); return; }
    // Quick View never waits for the renderer. Import only after the first UI paint.
    const timer = window.setTimeout(() => {
      import('../core/WorldEngine').then(({ WorldEngine }) => {
        if (cancelled || !container.current) return;
        try {
          const instance = new WorldEngine(container.current, { onNear: setNear, onSpeed: setSpeed, onRide: setRide, onPosition: setPosition, onHail: hail, onError: fail, onSelect: openProject, reducedMotion: reducedRef.current, mobile });
          engine.current = instance;
          instance.setMode(modeRef.current);
          instance.setPaused(!!projectId);
          setReady(true);
        } catch (error) { fail(error); }
      }).catch(fail);
    }, 80);
    return () => { cancelled = true; clearTimeout(timer); engine.current?.dispose(); engine.current = null; };
  }, [mobile, openProject, hail, loadWorld]);
  useEffect(() => {
    const onRoute = () => {
      const state = readRoute(location.hash);
      if (state.mode !== 'quick') setLoadWorld(true);
      setProjectId(state.project); setPlaceId(state.district ?? null);
      if (!state.project && !state.district) setMode(fallback ? 'quick' : state.mode);
      if (state.section) requestAnimationFrame(() => document.getElementById(state.section!)?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' }));
    };
    window.addEventListener('hashchange', onRoute); window.addEventListener('popstate', onRoute);
    return () => { window.removeEventListener('hashchange', onRoute); window.removeEventListener('popstate', onRoute); };
  }, [fallback, reduced]);
  useEffect(() => { engine.current?.setMode(mode); }, [mode, ready]);
  useEffect(() => { engine.current?.setPaused(overlayOpen); }, [overlayOpen, ready]);
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
    engine.current?.setReducedMotion(reduced);
    try { localStorage.setItem('hj-motion', reduced ? 'reduced' : 'full'); } catch { /* browser storage is optional */ }
  }, [reduced]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change); return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    fetch(portfolio.resume, { method: 'HEAD', signal: abort.signal }).then(response => setResumeAvailable(response.ok && (response.headers.get('content-type') ?? '').includes('pdf'))).catch(() => {});
    return () => abort.abort();
  }, []);
  useEffect(() => {
    const title = selected ? `${selected.title} — Harsh Jha` : 'Harsh Jha — Software, AI & Scientific Computing';
    document.title = title;
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) document.querySelector(selector)?.setAttribute('content', selected?.shortDescription ?? 'Scientific computing, AI systems, and software engineering. Explore Harsh Jha’s mini Mumbai portfolio city and project case studies.');
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  }, [selected]);
  useEffect(() => {
    const metadata = document.createElement('script');
    metadata.type = 'application/ld+json';
    metadata.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Person', name: portfolio.name, description: portfolio.positioning, sameAs: [portfolio.github, portfolio.linkedin], affiliation: { '@type': 'CollegeOrUniversity', name: 'VIT Vellore' }, knowsAbout: skills.flatMap(group => group.items) });
    document.head.append(metadata);
    return () => metadata.remove();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(value => !value); setQuery(''); return; }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (overlayOpen) return;
      if (mode === 'world') {
        if (e.key.toLowerCase() === 'm') { e.preventDefault(); setMap(true); }
        if (e.key === 'Escape' && !e.repeat) { e.preventDefault(); pendingMenu.current = true; }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Escape' && pendingMenu.current) { pendingMenu.current = false; setMenu(true); } };
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp); return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [mode, near, overlayOpen, openProject]);
  useEffect(() => {
    const cursor = document.getElementById('cursor');
    if (!cursor || mobile) return;
    const move = (event: PointerEvent) => {
      cursor.style.transform = `translate(${event.clientX}px,${event.clientY}px)`;
      const target = (event.target as HTMLElement).closest('a,button,canvas,input');
      cursor.dataset.context = target?.tagName === 'A' ? 'external' : target?.tagName === 'CANVAS' ? 'look' : target?.classList.contains('proximity-prompt') ? 'view' : target ? 'open' : 'default';
      cursor.style.opacity = '1';
    };
    const hide = () => { cursor.style.opacity = '0'; };
    window.addEventListener('pointermove', move); document.addEventListener('pointerleave', hide);
    return () => { window.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', hide); };
  }, [mobile]);

  const commands: Command[] = [
    ...projects.map(project => ({ id: project.id, label: project.title, detail: project.subtitle, keywords: `${project.skills.join(' ')} ${project.category}`, action: () => { setPalette(false); openProject(project.id); } })),
    ...districts.map(d => ({ id: `place-${d.id}`, label: d.title, detail: d.descriptor, keywords: `${d.shortName} city guide neighbourhood`, action: () => { setPalette(false); openProject(d.id); } })),
    ...heroProjects().map(project => ({ id: `travel-${project.id}`, label: `Go to ${project.title}`, detail: 'Fast travel to landmark', keywords: 'landmark world navigation', action: () => travel(project.id) })),
    ...experience.map((item, i) => ({ id: `experience-${i}`, label: item.title, detail: item.organization, keywords: item.highlights.join(' '), action: () => { setPalette(false); setAbout(true); } })),
    ...skills.flatMap(group => group.items.map(skill => ({ id: `skill-${skill}`, label: skill, detail: `${group.title} · project evidence`, keywords: 'skill engineering', action: () => { setPalette(false); navigate('quick'); setTimeout(() => document.getElementById('skills')?.scrollIntoView(), 0); } }))),
    { id: 'quick', label: 'Open Quick View', detail: 'Recruiter portfolio', keywords: 'projects qualifications resume', action: () => { setPalette(false); navigate('quick'); } },
    { id: 'about', label: 'About & achievements', detail: 'Education and experience', keywords: 'gsoc google big code career', action: () => { setPalette(false); setAbout(true); } },
    { id: 'github', label: 'Open GitHub', detail: 'harshjha15335', keywords: 'code repositories', action: () => { setPalette(false); window.open(portfolio.github, '_blank', 'noopener,noreferrer'); } },
    ...(resumeAvailable ? [{ id: 'resume', label: 'Open résumé', detail: 'Download PDF', keywords: 'cv', action: () => { setPalette(false); window.open(portfolio.resume, '_blank', 'noopener,noreferrer'); } }] : []),
    { id: 'contact', label: 'Contact Harsh', detail: 'Email and LinkedIn', keywords: 'mail connect', action: () => { setPalette(false); setContact(true); } },
    { id: 'motion', label: 'Toggle reduced motion', detail: reduced ? 'Currently reduced' : 'Currently full', keywords: 'accessibility animation', action: () => { setPalette(false); toggleReduced(); } },
  ];
  const filtered = filterCommands(commands, query);
  const nearDistrict = districts.find(d => d.id === near);
  const boardNear = near?.startsWith('hail-') ? (near.endsWith('taxi') ? 'taxi' : 'auto') : null;

  return <div className={`app mode-${mode} ${overlayOpen ? 'has-overlay' : ''}`}>
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); navigate('quick'); setTimeout(() => document.getElementById('main-content')?.focus(), 0); }}>Skip to portfolio content</a>
    <div className="world-container" ref={container} aria-hidden={mode !== 'world'} />
    <header className="header">
      <button className="brand" onClick={() => navigate('intro')} aria-label="Harsh Jha home"><span className="brand-mark">h<span>j</span><i /></span><span className="brand-copy">HARSH JHA<small>ENGINEER / RESEARCHER</small></span></button>
      <nav aria-label="Main navigation" className="header-nav">
        {!(fallback && mode === 'quick') && <button onClick={() => mode === 'quick' ? navigate('world') : navigate('quick')}>{mode === 'quick' ? 'ENTER WORLD' : 'QUICK VIEW'} <span>↗</span></button>}
        {resumeAvailable && <a href={portfolio.resume} target="_blank" rel="noreferrer">RÉSUMÉ <span>↗</span></a>}
        <a href={portfolio.github} target="_blank" rel="noreferrer" className="github-link">GITHUB <span>↗</span></a>
        <button onClick={() => setContact(true)} className="contact-link">LET’S TALK <span>↗</span></button>
        <button className="search-button" onClick={() => { setPalette(true); setQuery(''); }} aria-label="Open command palette">⌘ <kbd>K</kbd></button>
      </nav>
    </header>
    {fallback && <p className="fallback-message" role="status">{fallback}</p>}
    {mode === 'intro' && <EditorialHome ready={ready} reduced={reduced} onEnter={enterWorld} onQuick={() => navigate('quick')} onMotion={toggleReduced} />}
    {entering && <EntryTransition />}
    {mode === 'world' && <main className="world-ui" id="main-content" tabIndex={-1} aria-label="Interactive mini Mumbai portfolio city">
      {!ready && <div className="loader" role="status"><span className="status-dot" /><span>OPENING THE CITY</span><small>Warming renderer · Quick View is ready</small></div>}
      <div className="street-location"><span className="street-live" /> CST / FORT ROAD <small>18:42 · MUMBAI</small></div>
      <div className="street-reticle" aria-hidden="true" />
      {ride.phase === 'idle' && near && <button className="proximity-prompt" onClick={() => boardNear ? hail(boardNear) : openProject(near)}><kbd>{mobile ? '↗' : 'E'}</kbd><strong>{boardNear ? `Hail ${boardNear === 'taxi' ? 'kaali-peeli taxi' : 'auto'}` : near === 'ffprime' ? 'Read the FFprime research' : `Talk · ${nearDistrict?.guide}`}</strong></button>}
      <div className="city-transport-actions"><button disabled={!ready} onClick={() => hail('taxi')}>HAIL TAXI ↗</button><button disabled={!ready} onClick={() => hail('auto')}>HAIL AUTO ↗</button></div>
      {ride.phase === 'boarding' && !reduced && <div className="passenger-entry-fade" aria-hidden="true" />}
      <RideMeter ride={ride} onChoose={id => engine.current?.rideTo(id)} onSkip={() => engine.current?.skipRide()} onExit={() => engine.current?.endRide()} onOpen={openProject} />
      <div className="world-bottom"><div className="controls">{mobile ? <span>DRAG TO LOOK · HOLD ARROWS TO WALK</span> : <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> WALK · CLICK / DRAG TO LOOK · <kbd>E</kbd> TALK</span>}<button onClick={() => setMap(true)}><kbd>M</kbd> MAP</button></div><nav aria-label="City navigation"><button onClick={() => setMap(true)}>CITY DIRECTORY ↗</button><button onClick={() => openProject('filmcity')}>TALKIES ↗</button><button onClick={() => setMenu(true)} aria-label="Open world menu">☰</button></nav></div>
      {mobile && <div className="touch-walk" aria-label="Walking controls">{[['w','↑','Walk forward'],['a','←','Step left'],['s','↓','Walk backward'],['d','→','Step right']].map(([key,label,name]) => <button key={key} aria-label={name} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); engine.current?.setMove(key,true); }} onPointerUp={() => engine.current?.setMove(key,false)} onPointerCancel={() => engine.current?.setMove(key,false)}>{label}</button>)}</div>}

    </main>}
    {mode === 'quick' && <main className="quick-view" id="main-content" tabIndex={-1}>
      <section className="quick-hero"><div><p className="eyebrow"><i className="status-dot" /> MINI MUMBAI / THE WORK, AT A GLANCE</p><h1>Engineering,<br /><span>with evidence.</span></h1><p>Harsh Jha. {portfolio.education}<br />Scientific computing, AI systems, and full-stack products.</p><div className="quick-links">{resumeAvailable && <a className="primary-button" href={portfolio.resume} target="_blank" rel="noreferrer">DOWNLOAD RÉSUMÉ <span>↓</span></a>}<button className="text-button" onClick={() => setContact(true)}>GET IN TOUCH ↗</button></div></div><aside className="research-card"><span className="eyebrow">FEATURED EXPERIENCE / 2026</span><ProjectGraphic project={projects[0]} className="research-symbol" /><h2>Google Summer<br />of Code.</h2><Annotation mark="circle" className="research-note">research gets weird over here</Annotation><p>QC-Devs / Theochem<br />Multipole electrostatics in FFprime</p><button onClick={() => openProject('ffprime')}>EXPLORE THE RESEARCH <span>↗</span></button></aside></section>
      <section className="selected-work" id="projects"><div className="section-heading"><h2>Selected work<span> / 06</span></h2><span className="eyebrow">RESEARCH → SYSTEMS → PRODUCTS</span></div>{projects.map((p, i) => <ProjectRow key={p.id} project={p} index={i} onOpen={() => openProject(p.id)} />)}</section>
      <section className="experience-section" id="about"><div className="section-heading"><h2>Experience</h2><span className="eyebrow">REAL SYSTEMS. REAL CONSTRAINTS.</span></div>{experience.map(item => <article className="experience-item" key={item.title}><span className="eyebrow">{item.period}</span><div><h3>{item.title}</h3><p className="experience-org">{item.organization}</p><p>{item.description}</p><ul>{item.highlights.map(point => <li key={point}>{point}</li>)}</ul><a href={item.source} target="_blank" rel="noreferrer">SOURCE ↗</a></div></article>)}</section>
      <section id="skills" className="skills-section"><div className="section-heading"><h2>Skills, backed by work.</h2><span className="eyebrow">SELECT A SKILL TO SEE THE EVIDENCE</span></div>{skills.map(group => <SkillGroup key={group.title} group={group} onOpen={openProject} />)}</section>
      <section className="achievements-section"><div className="section-heading"><h2>Recognition</h2><span className="eyebrow">SELECTED ACHIEVEMENTS</span></div>{achievements.slice(0, 2).map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.detail}</p><a href={item.source} target="_blank" rel="noreferrer">SOURCE ↗</a></article>)}</section>
      <section className="quick-about"><span className="eyebrow">THE PERSON BEHIND THE SYSTEMS</span><h2>{portfolio.education}</h2><p>Expected graduation: {portfolio.graduation}.<br />Building across scientific computing, software engineering, and applied AI.</p><button className="text-button" onClick={() => setAbout(true)}>CAREER & ACHIEVEMENTS ↗</button></section>
      <footer className="quick-footer"><span className="eyebrow">HAVE SOMETHING WORTH BUILDING?</span><button onClick={() => setContact(true)}>Let’s talk<span>↗</span></button><div><span className="caption">© 2026 HARSH JHA</span><a href={portfolio.github} target="_blank" rel="noreferrer">GITHUB ↗</a><a href={portfolio.linkedin} target="_blank" rel="noreferrer">LINKEDIN ↗</a><button className="motion-toggle" onClick={toggleReduced}>{reduced ? 'MOTION: REDUCED' : 'REDUCE MOTION'}</button></div></footer>
    </main>}
    {selected && <Modal title={`CASE STUDY / ${selected.title}`} onClose={closeProject} className={`project-modal project-${selected.id}`}><CaseStudy project={selected} world={mode === 'world'} onClose={closeProject} /></Modal>}
    {palette && <Modal title="COMMAND CENTER" onClose={() => setPalette(false)} className="palette-modal"><label className="search-input"><span>⌕</span><input autoFocus placeholder="Search projects, skills, or commands…" aria-label="Search commands" value={query} onChange={e => { setQuery(e.target.value); setCommandIndex(0); }} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setCommandIndex(i => Math.min(i + 1, filtered.length - 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setCommandIndex(i => Math.max(i - 1, 0)); } if (e.key === 'Enter') { e.preventDefault(); filtered[commandIndex]?.action(); } }} /></label><div className="command-results">{filtered.length ? filtered.map((command, i) => <button key={command.id} className={i === commandIndex ? 'active' : ''} onClick={command.action} onMouseEnter={() => setCommandIndex(i)}><span><strong>{command.label}</strong><small>{command.detail}</small></span><span>↗</span></button>) : <p className="empty-state">No matches. Try a project name or technology.</p>}</div><p className="palette-help caption">↑ ↓ NAVIGATE · ENTER OPEN · ESC CLOSE</p></Modal>}
    {map && <CityMap position={position} canRide={ready && !fallback} onTravel={travel} onOpen={openProject} onRide={hail} onClose={() => setMap(false)} />}
    {district && <DistrictExperience key={district.id} district={district} reduced={reduced} resumeAvailable={resumeAvailable} onClose={closePlace} onProject={openProject} onQuick={() => navigate('quick')} onContact={() => { closePlace(); setContact(true); }} onDestination={id => { closePlace(); travel(id); }} />}
    {menu && <Modal title="WORLD MENU" onClose={() => setMenu(false)} className="small-modal"><h2>Take a moment.</h2><div className="menu-actions"><button className="primary-button" onClick={() => setMenu(false)}>CONTINUE EXPLORING →</button><button onClick={() => navigate('quick')}>OPEN QUICK VIEW ↗</button><button onClick={() => { engine.current?.reset(); setMenu(false); }}>RETURN TO CST ↻</button><button onClick={toggleReduced}>{reduced ? 'USE FULL MOTION' : 'REDUCE MOTION'} ◐</button><button onClick={() => navigate('intro')}>RETURN TO INTRO ←</button></div></Modal>}
    {contact && <Modal title="CONTACT" onClose={() => setContact(false)} className="small-modal"><h2>Let’s build<br />something.</h2><p>For engineering opportunities, research, or a good technical conversation.</p><a className="contact-email" href={`mailto:${portfolio.email}`}>{portfolio.email} ↗</a><div className="contact-social"><a href={portfolio.linkedin} target="_blank" rel="noreferrer">LINKEDIN ↗</a><a href={portfolio.github} target="_blank" rel="noreferrer">GITHUB ↗</a>{resumeAvailable && <a href={portfolio.resume} target="_blank" rel="noreferrer">RÉSUMÉ ↓</a>}</div></Modal>}
    {about && <Modal title="ABOUT / CAREER" onClose={() => setAbout(false)} className="about-modal"><h2>Harsh Jha<span className="blue-period">.</span></h2><p className="case-lead">{portfolio.education}<br />Expected graduation: {portfolio.graduation}</p>{experience.map(item => <section className="about-experience" key={item.title}><span className="eyebrow">{item.period}</span><h3>{item.title}</h3><p>{item.organization}</p><p>{item.description}</p></section>)}<div className="about-recognition"><span className="eyebrow">SELECTED ACHIEVEMENTS</span>{achievements.slice(0, 2).map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.detail}</p><a href={item.source} target="_blank" rel="noreferrer">SOURCE ↗</a></article>)}</div><div className="case-links"><a className="primary-button" href={portfolio.github} target="_blank" rel="noreferrer">GITHUB ↗</a>{resumeAvailable && <a className="text-button" href={portfolio.resume} target="_blank" rel="noreferrer">RÉSUMÉ ↓</a>}<button className="text-button" onClick={() => { setAbout(false); setContact(true); }}>CONTACT ↗</button></div></Modal>}
    {!mobile && <div id="cursor" className="custom-cursor" aria-hidden="true"><svg viewBox="0 0 20 24"><path d="M2 2 17 15 9 15 6 22Z" /></svg><span /></div>}
  </div>;
}

function ProjectRow({ project, index, onOpen }: { project: Project; index: number; onOpen: () => void }) {
  return <article className={`project-row row-${project.id}`}>
    <span className="row-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    <div className="row-main"><span className="eyebrow row-meta">SYSTEM / {String(index + 1).padStart(2, '0')} · {project.category} · {project.year}</span><button onClick={onOpen}><h3>{project.title}</h3></button><p>{project.shortDescription}</p><div className="row-skills">{project.skills.slice(0, 4).map(skill => <span key={skill}>{skill}</span>)}</div></div>
    <div className="row-graphic"><ProjectGraphic project={project} /></div>
    {project.metrics.length > 0 && <div className="row-metrics">{project.metrics.map(metric => <div key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}</div>}
    <button className="row-open" aria-label={`Open ${project.title} case study`} onClick={onOpen}>↗</button>
  </article>;
}
function SkillGroup({ group, onOpen }: { group: { title: string; items: string[] }; onOpen: (id: string) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const matches = projects.filter(p => p.skills.some(skill => skill.toLowerCase() === active?.toLowerCase()));
  return <div className="skill-group"><span className="eyebrow">{group.title}</span><div><div className="skill-tags">{group.items.map(skill => <button key={skill} className={active === skill ? 'active' : ''} onMouseEnter={() => setActive(skill)} onFocus={() => setActive(skill)} onClick={() => setActive(skill)}>{skill}</button>)}</div>{active && <div className="skill-evidence"><span>{active} →</span>{matches.length ? matches.map(p => <button key={p.id} onClick={() => onOpen(p.id)}>{p.title} ↗</button>) : <span>Résumé / experience</span>}</div>}</div></div>;
}
