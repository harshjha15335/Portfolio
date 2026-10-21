/**
 * What the city should sound like: pure functions and small schedulers, so the mix can be tested without Web Audio.
 * Every sound in the world is synthesized at runtime from noise and oscillators (no recordings, nothing licensed).
 */
export type AmbienceLayer = 'hum' | 'crowd' | 'surf' | 'wind' | 'birds' | 'insects' | 'hvac' | 'trains' | 'market' | 'projector';
export type Ambience = Record<AmbienceLayer, number>;
const ZERO: Ambience = { hum: 0, crowd: 0, surf: 0, wind: 0, birds: 0, insects: 0, hvac: 0, trains: 0, market: 0, projector: 0 };

/** Each district's character at its busiest, 0–1 per layer (CST is the CST–Fort street). */
export const DISTRICT_SOUND: Record<string, Partial<Ambience>> = {
  cst: { hum: .85, crowd: .8, trains: .7, wind: .15, birds: .35, market: .3 },
  bkc: { hum: .6, crowd: .35, hvac: .55, wind: .2, birds: .2 },
  andheri: { hum: .75, crowd: .75, market: .9, wind: .1, birds: .2 },
  powai: { hum: .4, crowd: .3, wind: .45, birds: .8, insects: .8, hvac: .2 },
  dadar: { hum: .7, crowd: .7, trains: .9, wind: .25, birds: .5, insects: .4 },
  worli: { hum: .45, crowd: .3, surf: .75, wind: .7, birds: .2 },
  juhu: { hum: .3, crowd: .55, surf: 1, wind: .55, birds: .3, insects: .5, market: .3 },
  filmcity: { hum: .35, crowd: .35, wind: .3, birds: .55, insects: .6, projector: .5 },
};

/**
 * How busy Mumbai is at an IST hour (0–24, fractional), 0–1: quiet before dawn, morning commuter peak, steady
 * day, evening peak, tapering late. A smooth curve, so an hour boundary never changes anything abruptly.
 */
export function cityActivity(hour: number) {
  const bump = (centre: number, width: number) => Math.exp(-(((hour - centre + 36) % 24 - 12) ** 2) / (2 * width * width));
  return Math.min(1, .12 + .55 * bump(10, 2.6) + .45 * bump(14.5, 3) + .65 * bump(19, 2.4) + .15 * bump(22.5, 1.2));
}

export type SoundMoment = { district: string; hour: number; altitude: number; riding: boolean; indoors: boolean };
/** Target level per ambience layer for a district at a moment. Districts that are not loaded are always silent. */
export function ambienceFor(m: SoundMoment): Ambience {
  const profile = DISTRICT_SOUND[m.district]; if (!profile) return { ...ZERO };
  const busy = cityActivity(m.hour), day = Math.min(1, Math.max(0, (m.altitude + 4) / 10));
  const dawn = Math.exp(-((m.hour - 6.8) ** 2) / 1.2) + .5 * Math.exp(-((m.hour - 18) ** 2) / .8);
  const night = 1 - day;
  const out: Ambience = { ...ZERO };
  for (const k of Object.keys(ZERO) as AmbienceLayer[]) out[k] = profile[k] ?? 0;
  out.hum *= .35 + .65 * busy; out.crowd *= .1 + .9 * busy; out.market *= day * busy; out.trains *= m.hour >= 1 && m.hour < 4 ? 0 : .3 + .7 * busy;
  out.birds *= Math.min(1, day * .35 + dawn); out.insects *= night; out.wind *= .7 + .5 * night; out.surf *= 1;
  out.hvac *= m.indoors ? 1 : .3; out.projector *= m.indoors ? 1 : 0;
  // Inside, outdoor layers fall away; in a cab the cabin muffles them (the filter does the rest).
  if (m.indoors) for (const k of ['hum', 'crowd', 'surf', 'wind', 'birds', 'insects', 'trains', 'market'] as const) out[k] *= .35;
  return out;
}

/** Seconds between footsteps at a horizontal speed (m/s); Infinity when standing. A walk is ~1.9 steps/s. */
export function footstepInterval(speed: number) { return speed < .35 ? Infinity : Math.max(.27, .78 - speed * .11); }
export type Surface = 'stone' | 'asphalt' | 'tile' | 'sand';

/**
 * Horns: a random driver honks now and then, more in busy hours, and never two within the cooldown. Deterministic for a given random source.
 */
export class HornScheduler {
  private next = 0;
  constructor(private random: () => number = Math.random, readonly cooldown = 5) {}
  /** Whether a horn sounds at time `now` (s) given traffic nearby (0–1). */
  tick(now: number, traffic: number) {
    if (traffic < .05) { this.next = Math.max(this.next, now + 2); return false; }
    if (now < this.next) return false;
    // Mean gap from about 9 s in a jam to 40 s on a quiet street.
    const gap = 9 + 31 * (1 - Math.min(1, traffic));
    this.next = now + Math.max(this.cooldown, gap * (.5 + this.random()));
    return now > 0.5;
  }
}
/** Occasional one-shot events (a bird call, a train, a shop door): Poisson-like with a minimum spacing. */
export class EventTimer {
  private next = -1;
  constructor(private meanGap: number, private minGap: number, private random: () => number = Math.random) {}
  tick(now: number, rate: number) {
    if (rate <= .01) { this.next = -1; return false; }
    if (this.next < 0) { this.next = now + this.gap(rate); return false; }
    if (now < this.next) return false;
    this.next = now + this.gap(rate); return true;
  }
  private gap(rate: number) { return Math.max(this.minGap, this.meanGap / rate * (.4 + this.random() * 1.2)); }
}
