import { useIndiaClock } from './useIndiaClock';
import { worldClock } from '../game/World/time/IndiaWorldClock';
import { useCallback, useEffect, useRef, useState } from 'react';
import { portfolio } from '../data/portfolio';
import { projects } from '../data/projects';
import { experience, achievements } from '../data/experience';
import { skills } from '../data/skills';
import { filterCommands, readRoute, type Command, type Mode } from '../utils/navigation';
import { Modal } from '../ui/Modal';
import { EditorialHome, EntryTransition } from '../ui/EditorialHome';
import { CaseStudy } from '../ui/CaseStudy';
import { districts } from '../data/city';
import { CityMap, DistrictExperience, RideMeter } from '../ui/CityExperience';
import { idleRide, type Point, type TransitKind } from '../game/World/transit';
import { streetStops, STREET_SPAWN, zoneAt } from '../game/World/streetLayout';
import type { WorldEngine } from '../core/WorldEngine';
import { record, loadProgress, saveProgress, emptyProgress, districtAt, nextObjective, type Achievement, type ProgressEvent } from '../game/progress';
import { TOURS } from '../data/tours';
import { ExhibitPanel, isExhibit } from '../ui/Exhibits';
import { ARRIVAL_CARDS, AchievementToasts, ArrivalCard, Journal, Orientation, TourCard, Waypoint } from '../ui/GameHud';
import { VisitorBenchmark } from '../ui/VisitorBenchmark';
import { AUDIO_BUSES, loadAudioSettings, saveAudioSettings, type AudioLevels } from '../core/audio/audioSettings';
import { playCue } from '../core/audio/cues';

/** `/?bench[&preset=high|medium|low][&fixed]`: the visitor-runnable performance tour. */
const benchParams = new URLSearchParams(location.search);
const BENCH = benchParams.has('bench');
const BENCH_PRESET = ['high', 'medium', 'low'].find(p => p === benchParams.get('preset')) as 'high' | 'medium' | 'low' | undefined;

const heroProjects = () => projects.filter(p => p.priority <= 4);

export default function App() {
  const route = readRoute(window.location.hash);
  const [mode, setMode] = useState<Mode>(BENCH ? 'world' : route.mode);
  const india = useIndiaClock(mode === 'world');
  const [projectId, setProjectId] = useState<string | null>(route.project);
  const [placeId, setPlaceId] = useState<string | null>(route.district ?? null);
  const [ride, setRide] = useState(idleRide);
  const [position, setPosition] = useState<Point & { yaw?: number }>({ x: STREET_SPAWN.x, z: STREET_SPAWN.z, yaw: STREET_SPAWN.yaw });
  const [near, setNear] = useState<string | null>(null);
  const [nearLabel, setNearLabel] = useState<string | undefined>();
  const [progress, setProgress] = useState(loadProgress);
  /** A directory jump waiting for its district to finish building. */
  const [arriving, setArriving] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ key: number; achievement: Achievement }[]>([]);
  const [exhibit, setExhibit] = useState<string | null>(null);
  const [tour, setTour] = useState<{ id: string; step: number } | null>(null);
  const [waypoint, setWaypoint] = useState<string | null>(null);
  const [arrivalCard, setArrivalCard] = useState<string | null>(null);
  const clearArrivalCard = useCallback(() => setArrivalCard(null), []);
  const [journal, setJournal] = useState(false);
  const [, setSpeed] = useState(0);
  const [ready, setReady] = useState(false);
  /** A shared case-study or place link reads without the city; the world starts building once that overlay closes (the intro builds it straight away). */
  const [loadWorld, setLoadWorld] = useState(BENCH || !(route.project || route.district));
  const worldReadyMs = useRef(0);
  const [fallback, setFallback] = useState('');
  const [palette, setPalette] = useState(false);
  const [renderPreset,setRenderPreset]=useState<'high'|'medium'|'low'>(BENCH_PRESET ?? 'medium');
  const [sound, setSound] = useState(false);
  const [audio, setAudio] = useState(loadAudioSettings);
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
  /** A directory jump asked for before the city finished building (from a shared place link). */
  const pendingTravel = useRef<string | null>(null);
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
  const overlayOpen = !!district || !!selected || palette || menu || map || contact || about || entering || !!exhibit || journal;
  const overlayRef = useRef(overlayOpen); overlayRef.current = overlayOpen;
  /** Journal, achievements and orientation: record an event, persist, and toast anything it unlocks. */
  const progressRef = useRef(progress), toastKey = useRef(0);
  const track = useCallback((event: ProgressEvent) => {
    const { progress: next, unlocked } = record(progressRef.current, event);
    if (next === progressRef.current) return;
    progressRef.current = next; saveProgress(next); setProgress(next);
    if (unlocked.length) playCue('achievement');
    if (unlocked.length) setToasts(list => [...list, ...unlocked.map(achievement => ({ key: ++toastKey.current, achievement }))]);
  }, []);
  useEffect(() => { if (!toasts.length) return; const timer = window.setTimeout(() => setToasts(list => list.slice(1)), 4200); return () => clearTimeout(timer); }, [toasts]);
  const navigate = useCallback((next: Mode) => {
    if (fallbackRef.current && next === 'world') next = 'intro';
    setLoadWorld(true);
    window.location.hash = next === 'intro' ? '' : next;
    setMode(next); setProjectId(null); setPlaceId(null); setMap(false); setMenu(false); engine.current?.endRide();
  }, []);
  const openProject = useCallback((id: string) => {
    track({ type: 'discover', id }); if (modeRef.current === 'world') track({ type: 'orientation', step: 'interact' });
    if (isExhibit(id)) { setMap(false); setPalette(false); setExhibit(id); return; }
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
  }, [track]);
  const closeProject = () => { setProjectId(null); setLoadWorld(true); history.replaceState(null, '', mode === 'intro' ? window.location.pathname : `#${mode}`); };
  const closePlace = () => { setPlaceId(null); setLoadWorld(true); history.replaceState(null, '', `#${mode}`); };
  const hail = useCallback((kind: TransitKind, destination?: string) => {
    if (fallbackRef.current || !engine.current) return;
    setPlaceId(null); setProjectId(null); setMap(false); setPalette(false); navigate('world');
    engine.current.board(kind); if (destination) engine.current.rideTo(destination);
    track({ type: 'orientation', step: 'ride' }); setTour(null);
  }, [navigate, track]);
  const toggleReduced = () => setReduced(value => !value);
  const enterWorld = () => {
    // Without WebGL the city directory is the way in: every district's guide, case study and contact still opens.
    if (fallback) { setMap(true); return; }
    if (!reduced && mode === 'intro') setEntering(true);
    navigate('world');
  };
  useEffect(() => {
    if (!entering) return;
    if (reduced) { setEntering(false); return; }
    const timer = window.setTimeout(() => setEntering(false), 1100);
    return () => clearTimeout(timer);
  }, [entering, reduced]);
  const travel = (id: string) => {
    setMap(false); setPalette(false);
    if (fallback) { if (districts.some(d => d.id === id)) openProject(id); else if (id === 'about') setAbout(true); else openProject(id); return; }
    navigate('world');
    if (!streetStops[id]) openProject(id); else if (engine.current) engine.current.travelTo(id); else pendingTravel.current = id;
  };

  useEffect(() => {
    if (!loadWorld) return;
    let cancelled = false;
    const fail = (error: unknown) => {
      if (cancelled) return;
      console.warn('3D portfolio unavailable:', error);
      setFallback('3D experience unavailable on this device — the city directory still opens every district.');
      setMode('intro'); setReady(true);
      history.replaceState(null, '', projectId ? `#/project/${projectId}` : window.location.pathname);
      engine.current?.dispose(); engine.current = null;
    };
    if (new URLSearchParams(location.search).get('webgl') === 'off') { fail('WebGL disabled'); return; }
    // The city's code starts downloading at once; it is built after the intro's first paint, a slice at a time, so the
    // page and the pointer stay responsive while it loads.
    const abort = new AbortController(), world = import('../core/WorldEngine');
    const timer = window.setTimeout(() => {
      world.then(({ WorldEngine }) => {
        if (cancelled || !container.current) return;
        return WorldEngine.create(container.current, { onNear: (id, label) => { setNear(id); setNearLabel(label); }, onLook: () => track({ type: 'orientation', step: 'look' }), onSpeed: setSpeed, onRide: setRide, onPosition: setPosition, onHail: hail, onError: fail, onSelect: openProject, onArriving: setArriving, reducedMotion: reducedRef.current, mobile }, abort.signal).then(instance => {
          engine.current = instance;
          instance.setMode(modeRef.current);
          instance.setPaused(overlayRef.current);
          if (pendingTravel.current) { instance.travelTo(pendingTravel.current); pendingTravel.current = null; }
          worldReadyMs.current = performance.now();
          setReady(true);
        });
      }).catch(error => { if (!abort.signal.aborted) fail(error); });
    }, 16);
    return () => { cancelled = true; abort.abort(); clearTimeout(timer); engine.current?.dispose(); engine.current = null; };
  }, [mobile, openProject, hail, loadWorld, track]);
  // Visits, walking, arrivals at a waypoint and finished rides feed the journal.
  const here = districtAt(zoneAt(position.x).id, position.z);
  useEffect(() => { if (ready && mode === 'world' && !fallback && !BENCH) track({ type: 'visit', district: here }); }, [here, ready, mode, fallback, track]);
  // Walking (or arriving) into a district with an arrival card shows it once per entry.
  useEffect(() => { if (ready && mode === 'world' && !fallback && !BENCH) setArrivalCard(here in ARRIVAL_CARDS ? here : null); }, [here, ready, mode, fallback]);
  useEffect(() => { if (Math.hypot(position.x - STREET_SPAWN.x, position.z - STREET_SPAWN.z) > 4 && ride.phase === 'idle') track({ type: 'orientation', step: 'walk' }); }, [position, ride.phase, track]);
  useEffect(() => { if (ride.phase === 'arrived') track({ type: 'ride-complete' }); }, [ride.phase, track]);
  useEffect(() => { if (map) track({ type: 'orientation', step: 'map' }); }, [map, track]);
  useEffect(() => { const stop = waypoint && streetStops[waypoint]; if (stop && ride.phase === 'idle' && Math.hypot(position.x - stop.x, position.z - stop.z) < 5) setWaypoint(null); }, [position, waypoint, ride.phase]);
  // A guided tour frames each step's view; finishing the Fort tour counts as following the research.
  const tourData = tour ? TOURS[tour.id] : null;
  useEffect(() => { const view = tour && TOURS[tour.id].steps[tour.step].view; if (view) engine.current?.frameView(view); if (tour && tour.step === TOURS[tour.id].steps.length - 1) track({ type: 'discover', id: `${tour.id}-tour` }); }, [tour, track]);
  const startTour = (id: string) => { setPlaceId(null); history.replaceState(null, '', `#${mode}`); setWaypoint(null); setTour({ id, step: 0 }); };
  const departure = (id: string, action: 'mark' | 'go' | TransitKind) => {
    setExhibit(null);
    if (action === 'mark') setWaypoint(id); else if (action === 'go') { setWaypoint(null); travel(id); } else { setWaypoint(null); hail(action, id); }
  };
  useEffect(() => {
    const onRoute = () => {
      const state = readRoute(location.hash);
      if (!state.project && !state.district) setLoadWorld(true);
      setProjectId(state.project); setPlaceId(state.district ?? null);
      if (!state.project && !state.district) setMode(fallback ? 'intro' : state.mode);
    };
    window.addEventListener('hashchange', onRoute); window.addEventListener('popstate', onRoute);
    return () => { window.removeEventListener('hashchange', onRoute); window.removeEventListener('popstate', onRoute); };
  }, [fallback]);
  useEffect(()=>{engine.current?.setRenderPreset(renderPreset);},[renderPreset,ready]);
  useEffect(() => { engine.current?.setSound(sound); }, [sound, ready]);
  useEffect(() => { engine.current?.setAudioLevels(audio.levels); }, [audio.levels, ready]);
  useEffect(() => { saveAudioSettings(audio); }, [audio]);
  // Browsers only start sound after a gesture, so a remembered "sound on" waits for the first press or tap in the world.
  useEffect(() => {
    if (mode !== 'world' || !audio.enabled || sound) return;
    const start = () => setSound(true);
    window.addEventListener('pointerdown', start, { once: true }); window.addEventListener('keydown', start, { once: true });
    return () => { window.removeEventListener('pointerdown', start); window.removeEventListener('keydown', start); };
  }, [mode, audio.enabled, sound]);
  const toggleSound = () => { const next = !sound; setSound(next); setAudio(value => ({ ...value, enabled: next })); };
  const setLevel = (bus: keyof AudioLevels, value: number) => setAudio(current => ({ ...current, levels: { ...current.levels, [bus]: value } }));
  useEffect(() => { if (map) playCue('map'); }, [map]);
  useEffect(() => { if (journal) playCue('journal'); }, [journal]);
  useEffect(() => { if (menu) playCue('open'); }, [menu]);
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
        if (e.key.toLowerCase() === 'j') { e.preventDefault(); setJournal(true); }
        if (e.key === 'Escape' && !e.repeat) { e.preventDefault(); pendingMenu.current = true; }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Escape' && pendingMenu.current) { pendingMenu.current = false; setMenu(true); } };
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp); return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [mode, near, overlayOpen, openProject]);

  const commands: Command[] = [
    ...projects.map(project => ({ id: project.id, label: project.title, detail: project.subtitle, keywords: `${project.skills.join(' ')} ${project.category}`, action: () => { setPalette(false); openProject(project.id); } })),
    ...districts.map(d => ({ id: `place-${d.id}`, label: d.title, detail: d.descriptor, keywords: `${d.shortName} city guide neighbourhood`, action: () => { setPalette(false); openProject(d.id); } })),
    ...heroProjects().map(project => ({ id: `travel-${project.id}`, label: `Go to ${project.title}`, detail: 'Fast travel to landmark', keywords: 'landmark world navigation', action: () => travel(project.id) })),
    ...experience.map((item, i) => ({ id: `experience-${i}`, label: item.title, detail: item.organization, keywords: item.highlights.join(' '), action: () => { setPalette(false); setAbout(true); } })),
    ...skills.flatMap(group => group.items.map(skill => ({ id: `skill-${skill}`, label: skill, detail: `${group.title} · project evidence`, keywords: 'skill engineering', action: () => { setPalette(false); const evidence = projects.find(p => p.skills.some(s => s.toLowerCase() === skill.toLowerCase())); if (evidence) openProject(evidence.id); else setAbout(true); } }))),
    { id: 'journal', label: 'Open exploration journal', detail: 'Quest, achievements, districts visited', keywords: 'progress achievements quest badges', action: () => { setPalette(false); setJournal(true); } },
    ...Object.values(TOURS).map(t => ({ id: `tour-${t.id}`, label: `Guided tour · ${t.place}`, detail: t.guide, keywords: 'guide tour walkthrough', action: () => { setPalette(false); if (fallback) openProject(t.id); else { navigate('world'); startTour(t.id); } } })),
    { id: 'about', label: 'About & achievements', detail: 'Education and experience', keywords: 'gsoc google big code career', action: () => { setPalette(false); setAbout(true); } },
    { id: 'github', label: 'Open GitHub', detail: 'harshjha15335', keywords: 'code repositories', action: () => { setPalette(false); window.open(portfolio.github, '_blank', 'noopener,noreferrer'); } },
    ...(resumeAvailable ? [{ id: 'resume', label: 'Open résumé', detail: 'Download PDF', keywords: 'cv', action: () => { setPalette(false); window.open(portfolio.resume, '_blank', 'noopener,noreferrer'); } }] : []),
    { id: 'contact', label: 'Contact Harsh', detail: 'Email and LinkedIn', keywords: 'mail connect', action: () => { setPalette(false); setContact(true); } },
    { id: 'motion', label: 'Toggle reduced motion', detail: reduced ? 'Currently reduced' : 'Currently full', keywords: 'accessibility animation', action: () => { setPalette(false); toggleReduced(); } },
  ];
  const filtered = filterCommands(commands, query);
  const finale = useCallback(() => track({ type: 'discover', id: 'theatre-end' }), [track]);
  const nearDistrict = districts.find(d => d.id === near);
  const boardNear = near?.startsWith('hail-') || near?.startsWith('flag-') ? (near.endsWith('taxi') ? 'taxi' : 'auto') : null;

  return <div className={`app mode-${mode} ${overlayOpen ? 'has-overlay' : ''}`}>
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to portfolio content</a>
    <div className="world-container" ref={container} aria-hidden={mode !== 'world'} />
    <header className="header">
      <button className="brand" onClick={() => navigate('intro')}><span className="brand-mark" aria-hidden="true">h<span>j</span><i /></span><span className="brand-copy">HARSH JHA<small>ENGINEER / OPEN SOURCE</small></span></button>
      <nav aria-label="Main navigation" className="header-nav">
        {resumeAvailable && <a href={portfolio.resume} target="_blank" rel="noreferrer">RÉSUMÉ <span>↗</span></a>}
        <a href={portfolio.github} target="_blank" rel="noreferrer" className="github-link">GITHUB <span>↗</span></a>
        <button onClick={() => setContact(true)} className="contact-link">LET’S TALK <span>↗</span></button>
        <button className="search-button" onClick={() => { setPalette(true); setQuery(''); }} aria-keyshortcuts="Meta+K Control+K"><span className="sr-only">Open command palette</span><span aria-hidden="true">⌘ <kbd>K</kbd></span></button>
      </nav>
    </header>
    {fallback && <p className="fallback-message" role="status">{fallback}</p>}
    {mode === 'intro' && <EditorialHome ready={ready} reduced={reduced} fallback={!!fallback} onEnter={enterWorld} onMotion={toggleReduced} />}
    {entering && <EntryTransition />}
    {mode === 'world' && <main className="world-ui" id="main-content" tabIndex={-1} aria-label="Interactive mini Mumbai portfolio city">
      {!ready && <div className="loader" role="status"><span className="status-dot" /><span>OPENING THE CITY</span><small>Warming renderer</small></div>}
      {arriving && <p className="district-arriving" role="status">Heading to {districts.find(d => d.id === arriving)?.title ?? 'the next stop'}…</p>}
      <div className="street-location"><span className="street-live" /> {zoneAt(position.x).label} <small><time dateTime={new Date(india.epoch).toISOString()}>{india.time} IST</time> · {india.label}{worldClock().overridden ? ' · TIME OVERRIDE' : ''}</small></div>
      {near && <div className="street-reticle" aria-hidden="true" />}
      {ride.phase === 'idle' && near && !BENCH && <button className="proximity-prompt" onClick={() => boardNear ? hail(boardNear) : near.startsWith('talkies-') ? engine.current?.interact() : openProject(near)}><kbd>{mobile ? '↗' : 'E'}</kbd><strong>{near.startsWith('flag-') ? nearLabel : boardNear ? `Hail ${boardNear === 'taxi' ? 'kaali-peeli taxi' : 'auto'}` : near === 'ffprime' ? 'Read the FFprime work' : nearDistrict ? `Talk · ${nearDistrict.guide}` : nearLabel ?? 'Inspect'}</strong></button>}
      {ready && !BENCH && !progress.orientationDismissed && !tour && ride.phase === 'idle' && <Orientation progress={progress} onSkip={() => track({ type: 'dismiss-orientation' })} />}
      {tourData && tour && <TourCard tour={tourData} step={tour.step} onStep={step => setTour({ ...tour, step })} onOpen={openProject} onNext={id => { setTour(null); setWaypoint(id); }} onLeave={() => setTour(null)} />}
      {arrivalCard && !tour && ride.phase === 'idle' && <ArrivalCard district={arrivalCard} onDone={clearArrivalCard} />}
      {waypoint && !tour && ride.phase === 'idle' && <Waypoint target={waypoint} position={position} onRide={() => hail('taxi', waypoint)} onClear={() => setWaypoint(null)} />}
      {BENCH && <VisitorBenchmark engine={engine.current} ready={ready && !fallback} preset={mobile ? `${renderPreset} (phones run the low tier)` : renderPreset} adaptive={!benchParams.has('fixed')} sampleS={Number(benchParams.get('seconds')) || undefined} worldReadyMs={worldReadyMs.current} />}
      <AchievementToasts toasts={toasts} />
      <div className="city-transport-actions"><button disabled={!ready} onClick={() => hail('taxi')}>HAIL TAXI ↗</button><button disabled={!ready} onClick={() => hail('auto')}>HAIL AUTO ↗</button><button className="sound-chip" aria-pressed={sound} onClick={toggleSound}>{sound ? 'SOUND ON ♪' : 'SOUND OFF'}</button></div>
      {ride.phase === 'boarding' && !reduced && <div className="passenger-entry-fade" aria-hidden="true" />}
      <RideMeter ride={ride} onChoose={id => engine.current?.rideTo(id)} onSkip={() => engine.current?.skipRide()} onExit={() => engine.current?.endRide()} onOpen={openProject} />
      <div className="world-bottom"><div className="controls">{mobile ? <span>DRAG TO LOOK · HOLD ARROWS TO WALK</span> : <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> WALK · <kbd>SHIFT</kbd> RUN · <kbd>SPACE</kbd> JUMP · CLICK TO LOOK · <kbd>E</kbd> TALK</span>}<button onClick={() => setMap(true)}><kbd>M</kbd> MAP</button><button onClick={() => setJournal(true)}><kbd>J</kbd> JOURNAL</button></div><nav aria-label="City navigation"><button onClick={() => setMap(true)}>CITY DIRECTORY ↗</button><button onClick={() => openProject('filmcity')}>TALKIES ↗</button><button onClick={() => setMenu(true)} aria-label="Open world menu">☰</button></nav></div>
      {mobile && <div className="touch-walk" aria-label="Walking controls">{[['w','↑','Walk forward'],['a','←','Step left'],['s','↓','Walk backward'],['d','→','Step right']].map(([key,label,name]) => <button key={key} aria-label={name} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); engine.current?.setMove(key,true); }} onPointerUp={() => engine.current?.setMove(key,false)} onPointerCancel={() => engine.current?.setMove(key,false)}>{label}</button>)}</div>}

    </main>}
    {selected && <Modal title={`CASE STUDY / ${selected.title}`} onClose={closeProject} className={`project-modal project-${selected.id}`}><CaseStudy project={selected} world={mode === 'world'} onClose={closeProject} /></Modal>}
    {palette && <Modal title="COMMAND CENTER" onClose={() => setPalette(false)} className="palette-modal"><label className="search-input"><span>⌕</span><input autoFocus placeholder="Search projects, skills, or commands…" aria-label="Search commands" value={query} onChange={e => { setQuery(e.target.value); setCommandIndex(0); }} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setCommandIndex(i => Math.min(i + 1, filtered.length - 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setCommandIndex(i => Math.max(i - 1, 0)); } if (e.key === 'Enter') { e.preventDefault(); filtered[commandIndex]?.action(); } }} /></label><div className="command-results">{filtered.length ? filtered.map((command, i) => <button key={command.id} className={i === commandIndex ? 'active' : ''} onClick={command.action} onMouseEnter={() => setCommandIndex(i)}><span><strong>{command.label}</strong><small>{command.detail}</small></span><span>↗</span></button>) : <p className="empty-state">No matches. Try a project name or technology.</p>}</div><p className="palette-help caption">↑ ↓ NAVIGATE · ENTER OPEN · ESC CLOSE</p></Modal>}
    {map && <CityMap position={position} canRide={ready && !fallback} objective={nextObjective(progress)} waypoint={waypoint} onMark={id => setWaypoint(current => current === id ? null : id)} onTravel={travel} onOpen={openProject} onRide={hail} onClose={() => setMap(false)} />}
    {district && <DistrictExperience key={district.id} district={district} reduced={reduced} resumeAvailable={resumeAvailable} onClose={closePlace} onProject={openProject} onContact={() => { closePlace(); setContact(true); }} onDestination={id => { closePlace(); travel(id); }} onTour={TOURS[district.id] && mode === 'world' && !fallback ? () => startTour(district.id) : undefined} onFinale={finale} />}
    {exhibit && <ExhibitPanel id={exhibit} onClose={() => setExhibit(null)} onSolved={id => track({ type: 'discover', id: `${id}:solved` })} onDeparture={departure}
      onOpen={openProject} onProject={id => { setExhibit(null); openProject(id); }} onContact={() => { setExhibit(null); setContact(true); }} onFinale={finale}
      reduced={reduced} resumeAvailable={resumeAvailable} discovered={progress.discovered} />}
    {journal && <Journal progress={progress} onClose={() => setJournal(false)} onTravel={id => { setJournal(false); travel(id); }} onReset={() => { const fresh = { ...emptyProgress(), orientationDismissed: progress.orientationDismissed }; progressRef.current = fresh; saveProgress(fresh); setProgress(fresh); }} />}
    {menu && <Modal title="WORLD MENU" onClose={() => setMenu(false)} className="small-modal"><h2>Take a moment.</h2><div className="menu-actions"><label>Street detail <select aria-label="Street detail" value={renderPreset} onChange={e=>setRenderPreset(e.target.value as typeof renderPreset)}><option value="high">High · contact shadows</option><option value="medium">Medium</option><option value="low">Low · lighter rendering</option></select></label><button className="primary-button" onClick={() => setMenu(false)}>CONTINUE EXPLORING →</button><button onClick={() => { engine.current?.reset(); setMenu(false); }}>RETURN TO CST ↻</button><button onClick={() => { setMenu(false); setJournal(true); }}>OPEN JOURNAL ✎</button><button aria-pressed={sound} onClick={toggleSound}>{sound ? 'MUTE CITY SOUND' : 'ENABLE CITY SOUND'}</button><fieldset className="sound-levels"><legend>Sound levels</legend>{[{ id: 'master' as const, label: 'Master' }, ...AUDIO_BUSES].map(bus => <label key={bus.id} htmlFor={`sound-${bus.id}`}>{bus.label}<input id={`sound-${bus.id}`} type="range" min={0} max={100} step={5} value={Math.round(audio.levels[bus.id] * 100)} onChange={e => setLevel(bus.id, Number(e.target.value) / 100)} /></label>)}</fieldset><button onClick={toggleReduced}>{reduced ? 'USE FULL MOTION' : 'REDUCE MOTION'} ◐</button><button onClick={() => navigate('intro')}>RETURN TO INTRO ←</button></div></Modal>}
    {contact && <Modal title="CONTACT" onClose={() => setContact(false)} className="small-modal"><h2>Let’s build<br />something.</h2><p>For engineering opportunities, research, or a good technical conversation.</p><a className="contact-email" href={`mailto:${portfolio.email}`}>{portfolio.email} ↗</a><div className="contact-social"><a href={portfolio.linkedin} target="_blank" rel="noreferrer">LINKEDIN ↗</a><a href={portfolio.github} target="_blank" rel="noreferrer">GITHUB ↗</a>{resumeAvailable && <a href={portfolio.resume} target="_blank" rel="noreferrer">RÉSUMÉ ↓</a>}</div></Modal>}
    {about && <Modal title="ABOUT / CAREER" onClose={() => setAbout(false)} className="about-modal"><h2>Harsh Jha<span className="blue-period">.</span></h2><p className="case-lead">{portfolio.education}<br />Expected graduation: {portfolio.graduation}</p>{experience.map(item => <section className="about-experience" key={item.title}><span className="eyebrow">{item.period}</span><h3>{item.title}</h3><p>{item.organization}</p><p>{item.description}</p></section>)}<div className="about-recognition"><span className="eyebrow">SELECTED ACHIEVEMENTS</span>{achievements.slice(0, 2).map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.detail}</p><a href={item.source} target="_blank" rel="noreferrer">SOURCE ↗</a></article>)}</div><div className="case-links"><a className="primary-button" href={portfolio.github} target="_blank" rel="noreferrer">GITHUB ↗</a>{resumeAvailable && <a className="text-button" href={portfolio.resume} target="_blank" rel="noreferrer">RÉSUMÉ ↓</a>}<button className="text-button" onClick={() => { setAbout(false); setContact(true); }}>CONTACT ↗</button></div></Modal>}
  </div>;
}

