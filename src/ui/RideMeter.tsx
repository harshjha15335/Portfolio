import { districts } from '../data/city';
import { streetStops } from '../game/World/streetLayout';
import type { RideStatus } from '../game/World/transit';

/** The taxi/auto "Portfolio Meter". Also mounted on the Frontend Studio bench in Andheri. */
export function RideMeter({ ride, onChoose, onSkip, onExit, onOpen }: { ride: RideStatus; onChoose: (id: string) => void; onSkip: () => void; onExit: () => void; onOpen: (id: string) => void }) {
  if (ride.phase === 'idle') return null;
  const destination = districts.find(d => d.id === ride.destination);
  return <section className="ride-meter" aria-label="Portfolio Meter">
    <div className="meter-top"><span>{ride.kind === 'auto' ? 'AUTO RICKSHAW' : 'KAALI-PEELI'} / STORY FARE</span><button aria-label="Exit ride" onClick={onExit}>✕</button></div>
    <div className="meter-face"><span className="caption">PORTFOLIO METER</span><strong data-testid="ride-fare">₹{ride.fare.toFixed(2)}</strong><span>FOR THE JOURNEY · NO PAYMENT</span></div>
    {ride.phase === 'hailing' ? <p role="status">Your driver is pulling over. One moment…</p> : ride.phase === 'boarding' ? <><p>Your ride is ready.<br /><strong>Choose your next stop.</strong></p><label className="ride-destination">DESTINATION<select aria-label="Ride destination" value="" onChange={e => onChoose(e.target.value)}><option value="" disabled>Where shall we go?</option>{districts.filter(d => streetStops[d.id]).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label></> : <><p className="ride-destination-name">{destination?.title}</p><div className="meter-readings"><span>{Math.round(ride.distance)} m</span><span>{Math.floor(ride.elapsed)} sec</span></div><progress aria-label="Ride progress" value={ride.progress} max={1} />{ride.phase === 'riding' ? <button className="primary-button" onClick={onSkip}>SKIP TO ARRIVAL →</button> : <><p role="status">Arrived. Your story continues here.</p><button className="primary-button" onClick={() => { onExit(); if (destination) onOpen(destination.id); }}>STEP OUT & MEET THE GUIDE →</button></>}</>}
  </section>;
}
