import { useRef, type PointerEvent } from 'react';
import { Annotation } from './Annotation';

export function EditorialHome({ ready, reduced, onEnter, onQuick, onMotion }: { ready: boolean; reduced: boolean; onEnter: () => void; onQuick: () => void; onMotion: () => void }) {
  const root = useRef<HTMLElement>(null);
  const move = (e: PointerEvent) => {
    if (reduced || e.pointerType !== 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    root.current?.style.setProperty('--pointer-x', `${(e.clientX - rect.left - rect.width / 2) / rect.width * 10}px`);
    root.current?.style.setProperty('--pointer-y', `${(e.clientY - rect.top - rect.height / 2) / rect.height * 8}px`);
  };
  const reset = () => { root.current?.style.setProperty('--pointer-x', '0px'); root.current?.style.setProperty('--pointer-y', '0px'); };
  return <main ref={root} className="intro editorial-home" id="main-content" tabIndex={-1} onPointerMove={move} onPointerLeave={reset}>
    <div className="home-index"><span className="eyebrow">PERSONAL PORTFOLIO — 2026</span><span className="eyebrow">MINI MUMBAI / NINE STOPS. ONE STORY.</span></div>
    <h1 className="home-type" aria-label="Harsh Jha"><span className="name-harsh">HARSH</span><span className="name-jha">JHA<span className="home-asterisk" aria-hidden="true">✳</span></span></h1>
    <div className="home-disciplines"><span>SOFTWARE</span><span>AI</span><span>RESEARCH</span><Annotation mark="arrow" /></div>
    <div className="home-manifesto"><span className="eyebrow">COMPLICATED IDEAS. WORKING SYSTEMS.</span><h2>I BUILD THINGS<br />THAT NEED TO WORK.</h2><Annotation mark="underline" /></div>
    <div className="home-car-sticker" aria-hidden="true">
      <svg viewBox="0 0 320 140" fill="none"><path d="M23 97 39 69 90 60 128 26 222 28 261 61 294 73 302 103 267 106 249 85 229 85 209 108 92 108 76 85 55 85 35 103Z" fill="#080808" stroke="#f2efe7" strokeWidth="2" /><path d="m100 60 37-27 70 2 25 30Z" fill="#f9c847" /><path d="m180 35 8 27M34 72l32-4M268 76l25 5" stroke="#f2efe7" strokeWidth="3" /><path d="M290 67h-46m44-2 4-12h-48" stroke="#080808" strokeWidth="7" /><circle cx="68" cy="107" r="24" fill="#080808" stroke="#f2efe7" strokeWidth="2" /><circle cx="240" cy="107" r="24" fill="#080808" stroke="#f2efe7" strokeWidth="2" /><circle cx="68" cy="107" r="9" stroke="#f2efe7" strokeWidth="2" /><circle cx="240" cy="107" r="9" stroke="#f2efe7" strokeWidth="2" /><path d="M124 91h42" stroke="#f2efe7" strokeWidth="2" /><text x="126" y="87" fontFamily="monospace" fontSize="18" fill="#f2efe7">TAXI</text></svg>
      <span className="caption">FIG. 01 — YOUR WAY AROUND</span>
    </div>
    <div className="home-city-ticket"><strong>WELCOME TO MINI MUMBAI</strong><small>WALK · HAIL A RIDE · FIND THE WORK</small></div>
    <Annotation className="home-doodle" mark="arrow">take the scenic route</Annotation>
    <div className="home-credential"><span className="eyebrow">SCIENTIFIC COMPUTING / QC-DEVS</span><strong>GSoC ’26</strong><Annotation mark="circle" /><span className="caption">THEOCHEM · MULTIPOLE ELECTROSTATICS</span></div>
    <div className="home-actions"><button className="primary-button" onClick={onEnter}>ENTER WORLD <span>↘</span></button><button className="text-button" onClick={onQuick}>QUICK VIEW <span>→</span></button><span className="caption">{ready ? '09 NEIGHBOURHOODS / WALK OR RIDE' : 'OPENING THE CITY / WARMING RENDERER'}</span></div>
    <footer className="home-footer"><span className="caption">VIT VELLORE / CSE ’28</span><span className="caption">SOFTWARE + AI + A LITTLE CONTROLLED CHAOS</span><button onClick={onMotion} className="motion-toggle">{reduced ? 'MOTION: REDUCED' : 'REDUCE MOTION'} <span>◐</span></button></footer>
  </main>;
}

export function EntryTransition() {
  return <div className="entry-transition" aria-hidden="true"><span className="transition-word transition-harsh">HARSH</span><span className="transition-word transition-jha">JHA</span><span className="transition-line">this way into the work ↘</span></div>;
}
