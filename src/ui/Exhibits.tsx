import { useState } from 'react';
import { Modal } from './Modal';
import { ResearchExhibition } from './ResearchExhibition';
import { CoordinateWorkstation } from './CoordinateWorkstation';
import { CORRECT_FIELD, FIELD_CANDIDATES, finiteDifferenceCheck, type CheckResult } from '../research/gradientCheck';
import { DEPARTURES } from '../data/departures';
import { districts } from '../data/city';
import type { TransitKind } from '../game/World/transit';
import { DISTRICT_EXHIBIT_TITLES, DistrictExhibitBody } from './DistrictExhibits';

/** Physical exhibits in the world that open a focused panel instead of a whole district page. */
export const EXHIBIT_TITLES: Record<string, string> = {
  'cst-board': 'CST / DEPARTURE BOARD',
  'fort-field': 'FORT / FIELD TABLE',
  'fort-workstation': 'FORT / COORDINATE WORKSTATION',
  'fort-source': 'FORT / CONTRIBUTION BOARD',
  'fort-gradient': 'FORT / GRADIENT CHECK',
  'fort-panel-0': 'FORT / PANEL 01',
  'fort-panel-1': 'FORT / PANEL 02',
  'fort-panel-2': 'FORT / PANEL 03',
  ...DISTRICT_EXHIBIT_TITLES,
};
export const isExhibit = (id: string) => id in EXHIBIT_TITLES;

export function ExhibitPanel({ id, onClose, onSolved, onDeparture, onOpen, onProject, onContact, onFinale, reduced, resumeAvailable, discovered }: {
  id: string; onClose: () => void; onSolved: (id: string) => void;
  onDeparture: (district: string, action: 'mark' | 'go' | TransitKind) => void;
  onOpen: (id: string) => void; onProject: (id: string) => void; onContact: () => void; onFinale: () => void;
  reduced: boolean; resumeAvailable: boolean; discovered: string[];
}) {
  const panel = /^fort-panel-(\d)$/.exec(id);
  return <Modal title={EXHIBIT_TITLES[id]} onClose={onClose} className={`exhibit-modal exhibit-${id}`}>
    {id === 'cst-board' && <DepartureBoard onDeparture={onDeparture} />}
    {id === 'fort-field' && <ResearchExhibition focus="field" initialOrder={2} />}
    {panel && <ResearchExhibition focus="field" initialChapter={Number(panel[1])} initialOrder={Math.min(2, Number(panel[1]) + 1)} />}
    {id === 'fort-source' && <ResearchExhibition focus="source" />}
    {id === 'fort-workstation' && <CoordinateWorkstation />}
    {id === 'fort-gradient' && <GradientCheck onSolved={() => onSolved('fort-gradient')} />}
    {id in DISTRICT_EXHIBIT_TITLES && <DistrictExhibitBody key={id} id={id} reduced={reduced} resumeAvailable={resumeAvailable} discovered={discovered} onSolved={onSolved} onOpen={onOpen} onProject={onProject} onContact={onContact} onClose={onClose} onFinale={onFinale} />}
  </Modal>;
}

function DepartureBoard({ onDeparture }: { onDeparture: (district: string, action: 'mark' | 'go' | TransitKind) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const choice = DEPARTURES.find(d => d.district === selected), place = districts.find(d => d.id === selected);
  return <section className="departure-board" aria-label="Departure board">
    <header><span className="eyebrow">प्रस्थान · सुटणाऱ्या गाड्या · DEPARTURES</span><h2>Where does your train of thought go?</h2><p>Pick what you came for. The board marks it on your map and on screen, then you can walk, ride or jump straight there.</p></header>
    <ol className="departure-rows">{DEPARTURES.map(d => { const district = districts.find(x => x.id === d.district)!; return <li key={d.district}><button aria-pressed={selected === d.district} onClick={() => setSelected(d.district)}>
      <span className="departure-time">{d.time}</span><strong>{d.category}<small lang="mr">{d.marathi}</small></strong><span className="departure-place">{district.title}<small>{d.via}</small></span></button></li>; })}</ol>
    {choice && place && <div className="departure-actions" role="group" aria-label={`Travel to ${place.title}`}>
      <p><b>{choice.category}</b> leaves for <b>{place.title}</b>: {place.descriptor}.</p>
      <button className="primary-button" onClick={() => onDeparture(place.id, 'mark')}>MARK ON MY MAP →</button>
      {place.id === 'fort' ? null : <><button onClick={() => onDeparture(place.id, 'taxi')}>TAKE A TAXI ↗</button><button onClick={() => onDeparture(place.id, 'auto')}>TAKE AN AUTO ↗</button></>}
      <button onClick={() => onDeparture(place.id, 'go')}>JUMP THERE →</button>
    </div>}
  </section>;
}

/** Fort activity: run a finite-difference check on three field formulas and find the correct one. */
export function GradientCheck({ onSolved }: { onSolved: () => void }) {
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [guess, setGuess] = useState<string | null>(null);
  const run = (id: string) => setResults(r => ({ ...r, [id]: finiteDifferenceCheck(FIELD_CANDIDATES.find(c => c.id === id)!) }));
  const answer = (id: string) => { setGuess(id); if (id === CORRECT_FIELD) onSolved(); };
  const solved = guess === CORRECT_FIELD;
  return <section className="gradient-check" aria-label="Gradient check activity">
    <header><span className="eyebrow">FORT / RESEARCH ACTIVITY</span><h2>Which field is right?</h2>
      <p>For a symmetric quadrupole the potential is V = rᵀQr / r⁵, and the field is E = −∇V. Three implementations of E are below. Run each one against central finite differences of V at eight fixed points (h = 10⁻⁴), then pick the one you would merge. One of Harsh’s FFprime contributions corrected a factor of two in exactly this formula and added this kind of check.</p></header>
    <ol className="gradient-candidates">{FIELD_CANDIDATES.map(c => { const r = results[c.id]; return <li key={c.id}>
      <div><strong>{c.label}</strong><code>{c.formula}</code></div>
      <button onClick={() => run(c.id)}>{r ? 'RUN AGAIN' : 'RUN CHECK'}</button>
      <output aria-live="polite" className={r ? r.passed ? 'pass' : 'fail' : ''}>{r ? `${r.passed ? 'PASS' : 'FAIL'} · max relative error ${r.maxRelativeError.toExponential(2)}` : 'not run'}</output>
      <button className="text-button" aria-pressed={guess === c.id} onClick={() => answer(c.id)}>THIS ONE</button>
    </li>; })}</ol>
    {guess && <p className={`gradient-verdict ${solved ? 'pass' : 'fail'}`} role="status">{solved
      ? 'Correct. Differentiating rᵀQr gives 2Qr, so the −2Qr/r⁵ term needs its factor of two, and the r⁻⁷ term carries the 5 from r⁻⁵. This one agrees with finite differences to about 10⁻⁹.'
      : 'Not that one. Run the check: a formula that disagrees with finite differences by more than rounding error has a bug. Try again.'}</p>}
    <p className="caption">TEACHING TENSOR · ARBITRARY UNITS · NOT MOLECULAR DATA · THE CHECK RUNS IN YOUR BROWSER EACH TIME</p>
  </section>;
}
