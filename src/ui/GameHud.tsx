import { useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { ACHIEVEMENTS, DISTRICT_IDS, ORIENTATION_STEPS, QUEST, questDone, type Achievement, type Progress } from '../game/progress';
import { districts } from '../data/city';
import { bearing } from '../game/World/interactionTargeting';
import { streetStops, zoneAt } from '../game/World/streetLayout';
import type { Tour } from '../data/tours';

/** Optional first-visit orientation. Steps tick themselves off; Skip hides it for good. */
export function Orientation({ progress, onSkip }: { progress: Progress; onSkip: () => void }) {
  const done = ORIENTATION_STEPS.filter(s => progress.orientation.includes(s.id)).length;
  const upNext = ORIENTATION_STEPS.find(s => !progress.orientation.includes(s.id))?.id;
  return <aside className="orientation-card" aria-label="Orientation">
    <div className="orientation-head"><span className="eyebrow">ORIENTATION · {done}/{ORIENTATION_STEPS.length}</span><button className="text-button" onClick={onSkip}>SKIP INTRO / EXPLORE CITY</button></div>
    <ol>{ORIENTATION_STEPS.map(step => { const ok = progress.orientation.includes(step.id); return <li key={step.id} className={ok ? 'done' : step.id === upNext ? 'next' : ''}><span aria-hidden="true">{ok ? '✓' : '○'}</span><span><strong>{step.label}</strong><small>{step.hint}</small></span><span className="sr-only">{ok ? 'done' : 'not done'}</span></li>; })}</ol>
  </aside>;
}

/** Guide tour card: non-modal, so the world stays visible while the guide frames each exhibit. */
export function TourCard({ tour, step, onStep, onOpen, onNext, onLeave }: {
  tour: Tour; step: number; onStep: (step: number) => void; onOpen: (id: string) => void; onNext: (district: string) => void; onLeave: () => void;
}) {
  const current = tour.steps[step], last = step === tour.steps.length - 1;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.querySelector('h3')?.focus({ preventScroll: true }); }, [step]);
  const next = current.next ? districts.find(d => d.id === current.next) : null;
  return <section ref={ref} className="tour-card" aria-label={`Guided tour: ${tour.place}`} aria-live="polite">
    <div className="tour-head"><span className="eyebrow">{tour.guide.toUpperCase()} · {step + 1}/{tour.steps.length}</span><button className="icon-button" aria-label="Leave the tour" onClick={onLeave}>✕</button></div>
    <h3 tabIndex={-1}>{current.title}</h3><p>{current.body}</p>
    <div className="tour-actions">
      {current.exhibit && <button className="primary-button" onClick={() => onOpen(current.exhibit!)}>OPEN THIS EXHIBIT ↗</button>}
      {next && <button className="primary-button" onClick={() => onNext(next.id)}>GO TO {next.shortName.toUpperCase()} →</button>}
      <button disabled={step === 0} onClick={() => onStep(step - 1)}>← BACK</button>
      {last ? <button onClick={onLeave}>FINISH TOUR</button> : <button onClick={() => onStep(step + 1)}>NEXT →</button>}
    </div>
  </section>;
}

/** What a district announces first when you walk into it: for Fort, the role itself. Non-modal; it fades on its own. */
export const ARRIVAL_CARDS: Record<string, { eyebrow: string; headline: string; detail: string }> = {
  fort: { eyebrow: 'NOW ENTERING · FORT OPEN SOURCE HALL', headline: 'GSoC Contributor at QC-Devs', detail: 'Google Summer of Code 2026 · FFprime · five merged pull requests' },
};
export function ArrivalCard({ district, onDone }: { district: string; onDone: () => void }) {
  const card = ARRIVAL_CARDS[district];
  useEffect(() => { const t = window.setTimeout(onDone, 6500); return () => clearTimeout(t); }, [district, onDone]);
  if (!card) return null;
  return <aside className="arrival-card" aria-label={card.headline} aria-live="polite" onClick={onDone}>
    <span className="eyebrow">{card.eyebrow}</span><strong>{card.headline}</strong><small>{card.detail}</small>
  </aside>;
}

/** On-screen wayfinding to the district picked on the departure board or the map. */
export function Waypoint({ target, position, onRide, onClear }: { target: string; position: { x: number; z: number; yaw?: number }; onRide: () => void; onClear: () => void }) {
  const place = districts.find(d => d.id === target), stop = streetStops[target]; if (!place || !stop) return null;
  const sameStreet = zoneAt(position.x).id === zoneAt(stop.x).id;
  const b = bearing(position, position.yaw ?? 0, stop);
  return <div className="waypoint" role="status" aria-label={`Next stop ${place.title}`}>
    {sameStreet ? <span className="waypoint-arrow" aria-hidden="true" style={{ transform: `rotate(${-b.angle}rad)` }}>↑</span> : <span className="waypoint-arrow" aria-hidden="true">⇢</span>}
    <span><small className="eyebrow">NEXT STOP</small><strong>{place.title}</strong><small>{sameStreet ? `${Math.round(b.distance)} m ${Math.abs(b.angle) < .35 ? 'ahead' : b.angle > 0 ? 'to your left' : 'to your right'}` : 'Another district · take a taxi or auto'}</small></span>
    {!sameStreet && <button onClick={onRide}>RIDE ↗</button>}
    <button className="icon-button" aria-label="Clear the waypoint" onClick={onClear}>✕</button>
  </div>;
}

export function AchievementToasts({ toasts }: { toasts: { key: number; achievement: Achievement }[] }) {
  return <div className="achievement-toasts" role="status" aria-live="polite">{toasts.map(t => <div key={t.key} className="achievement-toast"><span className="eyebrow">ACHIEVEMENT</span><strong>{t.achievement.title}</strong><small>{t.achievement.detail}</small></div>)}</div>;
}

export function Journal({ progress, onClose, onTravel, onReset }: { progress: Progress; onClose: () => void; onTravel: (id: string) => void; onReset: () => void }) {
  const complete = questDone(progress);
  return <Modal title="EXPLORATION JOURNAL" onClose={onClose} className="journal-modal">
    <header className="journal-head"><h2>Your notebook.</h2><p>What you have seen so far. Nothing here locks content; it only remembers your visit, in this browser.</p></header>
    <section className="journal-quest" aria-label={`Quest: ${QUEST.title}`}><span className="eyebrow">QUEST / {QUEST.title.toUpperCase()}</span>
      <ol>{QUEST.steps.map(step => { const ok = step.done(progress); return <li key={step.id} className={ok ? 'done' : ''}><span aria-hidden="true">{ok ? '✓' : '○'}</span>{step.label}<span className="sr-only">{ok ? ' (done)' : ' (to do)'}</span></li>; })}</ol>
      {complete && <p className="journal-summary"><b>You met the engineer.</b> Scientific Python reviewed upstream at Fort, enterprise security tooling at BKC, working demos in Powai and skills with receipts in Andheri. Juhu has the résumé and a way to say hello.</p>}
    </section>
    <section aria-label="Districts"><span className="eyebrow">DISTRICTS · {progress.visited.filter(id => (DISTRICT_IDS as readonly string[]).includes(id)).length}/9 VISITED</span>
      <ul className="journal-districts">{DISTRICT_IDS.map(id => { const d = districts.find(x => x.id === id)!; const ok = progress.visited.includes(id); return <li key={id} className={ok ? 'done' : ''}><span aria-hidden="true">{ok ? '✓' : '○'}</span><span>{d.title}<small>{d.descriptor}</small></span><button onClick={() => onTravel(id)} aria-label={`Go to ${d.title}`}>GO →</button></li>; })}</ul>
    </section>
    <section aria-label="Achievements"><span className="eyebrow">ACHIEVEMENTS · {progress.achievements.length}/{ACHIEVEMENTS.length}</span>
      <ul className="journal-achievements">{ACHIEVEMENTS.map(a => { const ok = progress.achievements.includes(a.id); return <li key={a.id} className={ok ? 'done' : ''}><strong>{ok ? '★' : '☆'} {a.title}</strong><small>{a.detail}</small></li>; })}</ul>
    </section>
    <p className="caption">{progress.discovered.length} THINGS DISCOVERED · {progress.rides} RIDES · <button className="text-button" onClick={onReset}>RESET PROGRESS</button></p>
  </Modal>;
}
