import { districts } from '../data/city';
import { streetStops } from '../game/World/streetLayout';
import type { RideStatus } from '../game/World/transit';
import { DEMO_FARE_LABEL, meterKm, meterText } from '../game/World/meter/FareMeter';

/**
 * The ride controls. The fare is read only on the cab's physical meter in the 3D cabin, so there is no fare card on
 * screen: just the controls the moment needs (destination, skip, exit, step out) as a slim row at the bottom, and a
 * screen-reader readout of the meter that is not drawn. Also mounted on the Frontend Studio bench in Andheri.
 */
/** A hailed cab's ETA as the visitor reads it: rounded so it settles instead of ticking every frame. */
export function etaText(seconds: number) {
  if (seconds < 4) return 'pulling up now';
  if (seconds < 60) return `about ${Math.max(5, Math.round(seconds / 5) * 5)} s away`;
  const minutes = Math.round(seconds / 30) / 2;
  return `about ${minutes} min away`;
}

export function RideMeter({ ride, onChoose, onSkip, onExit, onOpen }: { ride: RideStatus; onChoose: (id: string) => void; onSkip: () => void; onExit: () => void; onOpen: (id: string) => void }) {
  if (ride.phase === 'idle') return null;
  const destination = districts.find(d => d.id === ride.destination);
  return <section className="ride-meter" aria-label="Portfolio Meter">
    {ride.phase === 'hailing' ? <p role="status">Your {ride.kind === 'auto' ? 'auto rickshaw' : 'kaali-peeli taxi'} is on the way · <span data-testid="ride-eta">{etaText(ride.eta)}</span>. Look for the yellow arrow above it.</p>
      : ride.phase === 'boarding' ? <select aria-label="Ride destination" value="" onChange={e => onChoose(e.target.value)}><option value="" disabled>Where to?</option>{districts.filter(d => streetStops[d.id]).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select>
      : ride.phase === 'riding' ? <button className="ride-skip" onClick={onSkip}>SKIP TO ARRIVAL →</button>
      : <><p role="status" className="sr-only">Arrived at {destination?.title}.</p><button className="ride-step-out" onClick={() => { onExit(); if (destination) onOpen(destination.id); }}>STEP OUT & MEET THE GUIDE →</button></>}
    <button className="ride-exit" aria-label="Exit ride" onClick={onExit}>✕</button>
    {ride.phase !== 'hailing' && <div className="sr-only" aria-live="polite">
      <p>{ride.kind === 'auto' ? 'Auto rickshaw' : 'Kaali-peeli taxi'}{destination ? ` to ${destination.title}` : ''}.</p>
      <p>Fare <span data-testid="ride-fare">₹{ride.fare.toFixed(2)}</span>, <span data-testid="ride-distance">{meterKm(ride.distance)} km</span>.</p>
      <p>{meterText({ state: ride.meter, fare: ride.fare, distance: ride.distance, waiting: ride.waiting })}. {DEMO_FARE_LABEL}. No payment is taken.</p>
    </div>}
  </section>;
}
