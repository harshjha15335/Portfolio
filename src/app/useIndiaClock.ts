import { useEffect, useState } from 'react';
import { worldClock, type ClockSample } from '../game/World/time/IndiaWorldClock';

/** The India world clock for the HUD, refreshed every 15 s and whenever the tab comes back. */
export function useIndiaClock(active = true): ClockSample {
  const [sample, setSample] = useState(() => worldClock().sample());
  useEffect(() => {
    if (!active) return;
    const tick = () => setSample(worldClock().sample()); tick();
    const id = window.setInterval(tick, 15000), visible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', visible); };
  }, [active]);
  return sample;
}
