/**
 * The world's one clock: the real current time in Mumbai (Asia/Kolkata, UTC+05:30), the same for every visitor
 * whatever their own time zone, and the sun's real position over CST at that instant.
 *
 * Time is held as an epoch instant (ms). It is only ever *formatted* in IST with Intl; it is never shifted by +5:30
 * and parsed back. Solar position uses the NOAA low-precision equations (≈0.01° over 1950–2050), which is far finer
 * than a lighting rig needs. Pure module: no Three.js, so Quick View and the HUD can import it.
 */
export const MUMBAI = { lat: 18.94, lon: 72.835 } as const;
export const IST_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 330 * 60000;
const RAD = Math.PI / 180;

export type SolarPosition = { altitude: number; azimuth: number };
/** Sun altitude above the horizon and azimuth clockwise from true north, both in degrees. */
export function solarPosition(epochMs: number, lat: number = MUMBAI.lat, lon: number = MUMBAI.lon): SolarPosition {
  const n = epochMs / 86400000 + 2440587.5 - 2451545.0;
  const L = (280.46 + .9856474 * n) % 360, g = ((357.528 + .9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * RAD, eps = (23.439 - 4e-7 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)), dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = ((18.697374558 + 24.06570982441908 * n) % 24 + 24) % 24;
  const H = (gmst * 15 + lon) * RAD - ra, phi = lat * RAD;
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD;
  const azimuth = (Math.atan2(-Math.cos(dec) * Math.sin(H), Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.cos(H) * Math.sin(phi)) / RAD + 360) % 360;
  return { altitude, azimuth };
}

/** Standard altitudes (degrees) of the sun's centre for sunrise/sunset (refraction + semi-diameter) and twilights. */
export const SUN_EVENTS = { sunrise: -.833, civil: -6, nautical: -12, astronomical: -18 } as const;

export type IstParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };
const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: IST_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
/** Calendar fields of an instant as read on a clock in Mumbai. */
export function istParts(epochMs: number): IstParts {
  const p: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(epochMs))) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return { year: p.year, month: p.month, day: p.day, hour: p.hour % 24, minute: p.minute, second: p.second };
}
/** The instant at which Mumbai clocks read the given date and time. */
export function istInstant(year: number, month: number, day: number, hour = 0, minute = 0) { return Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MS; }
export const istClock = (epochMs: number) => { const p = istParts(epochMs); return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`; };
export const istDate = (epochMs: number) => { const p = istParts(epochMs); return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`; };

export type SunTimes = { dawn: number | null; sunrise: number | null; noon: number; sunset: number | null; dusk: number | null };
const crossing = (from: number, to: number, threshold: number) => {
  // Bisection on altitude between two instants that straddle the threshold.
  let a = from, b = to; const rising = solarPosition(a).altitude < threshold;
  for (let i = 0; i < 30 && b - a > 1000; i++) { const m = (a + b) / 2; if ((solarPosition(m).altitude < threshold) === rising) a = m; else b = m; }
  return Math.round((a + b) / 2);
};
const timesCache = new Map<string, SunTimes>();
/** Civil dawn, sunrise, solar noon, sunset and civil dusk for the IST calendar day containing `epochMs`. */
export function sunTimes(epochMs: number): SunTimes {
  const p = istParts(epochMs), key = `${p.year}-${p.month}-${p.day}`; const cached = timesCache.get(key); if (cached) return cached;
  const start = istInstant(p.year, p.month, p.day), step = 10 * 60000;
  const out: SunTimes = { dawn: null, sunrise: null, noon: start, sunset: null, dusk: null };
  let best = -90;
  for (let t = start; t < start + 86400000; t += step) {
    const a = solarPosition(t).altitude, b = solarPosition(t + step).altitude;
    if (a > best) { best = a; out.noon = t; }
    for (const [name, threshold, up] of [['dawn', SUN_EVENTS.civil, true], ['sunrise', SUN_EVENTS.sunrise, true], ['sunset', SUN_EVENTS.sunrise, false], ['dusk', SUN_EVENTS.civil, false]] as const)
      if (up ? a < threshold && b >= threshold : a >= threshold && b < threshold) out[name] = crossing(t, t + step, threshold);
  }
  // Refine noon to the minute: the altitude peak is flat, so search its neighbourhood.
  for (let t = out.noon - step, top = -90; t <= out.noon + step; t += 60000) { const a = solarPosition(t).altitude; if (a > top) { top = a; out.noon = t; } }
  if (timesCache.size > 8) timesCache.clear(); timesCache.set(key, out); return out;
}

export type DayPhase = 'night' | 'nautical-twilight' | 'civil-twilight' | 'golden' | 'day';
/** Lighting phase from the sun's altitude alone, so no fixed 06:00/18:00 gates. */
export function dayPhase(altitude: number): DayPhase {
  if (altitude < SUN_EVENTS.nautical) return 'night';
  if (altitude < SUN_EVENTS.civil) return 'nautical-twilight';
  if (altitude < SUN_EVENTS.sunrise) return 'civil-twilight';
  if (altitude < 6) return 'golden';
  return 'day';
}
/** HUD wording for a moment: phase plus whether the sun is climbing (before solar noon) or setting. */
export function phaseLabel(altitude: number, morning: boolean, hour: number) {
  switch (dayPhase(altitude)) {
    case 'night': return 'NIGHT';
    case 'nautical-twilight': return morning ? 'BEFORE DAWN' : 'LATE DUSK';
    case 'civil-twilight': return morning ? 'DAWN' : 'DUSK';
    case 'golden': return morning ? 'SUNRISE' : 'GOLDEN HOUR';
    default: return altitude > 45 || (hour >= 11 && hour < 14) ? 'MIDDAY' : morning ? 'MORNING' : 'AFTERNOON';
  }
}

export type ClockSource = 'device' | 'server' | 'override';
export type ClockSample = {
  epoch: number; time: string; date: string; altitude: number; azimuth: number; phase: DayPhase; label: string;
  /** True before solar noon (the sun is climbing). */ morning: boolean; source: ClockSource; offsetMs: number; times: SunTimes;
};

/** `?debug&time=HH:MM[&date=YYYY-MM-DD]`: a fixed Mumbai instant for reviews and tests. Never stored anywhere. */
export function parseOverride(search: string, nowMs: number): number | null {
  const params = new URLSearchParams(search); if (!params.has('debug')) return null;
  const time = params.get('time')?.match(/^(\d{1,2}):(\d{2})$/); if (!time) return null;
  const hour = Number(time[1]), minute = Number(time[2]); if (hour > 23 || minute > 59) return null;
  const date = params.get('date')?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const today = istParts(nowMs);
  const [y, m, d] = date ? [Number(date[1]), Number(date[2]), Number(date[3])] : [today.year, today.month, today.day];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return istInstant(y, m, d, hour, minute);
}

/** Server drift beyond this is applied; below it the device clock is trusted (the Date header has 1 s resolution). */
export const DRIFT_THRESHOLD_MS = 90000;

export class IndiaWorldClock {
  private offset = 0; private serverChecked = false;
  constructor(private readonly override: number | null = null, private readonly deviceNow: () => number = () => Date.now()) {}
  get source(): ClockSource { return this.override !== null ? 'override' : this.offset ? 'server' : 'device'; }
  get overridden() { return this.override !== null; }
  now() { return this.override ?? this.deviceNow() + this.offset; }
  sample(epoch = this.now()): ClockSample {
    const sun = solarPosition(epoch), times = sunTimes(epoch), parts = istParts(epoch);
    const morning = epoch < times.noon;
    return { epoch, time: istClock(epoch), date: istDate(epoch), altitude: sun.altitude, azimuth: sun.azimuth, phase: dayPhase(sun.altitude), label: phaseLabel(sun.altitude, morning, parts.hour), morning, source: this.source, offsetMs: this.offset, times };
  }
  /**
   * Compare the device clock with the same-origin server's Date header, once, in the background. A device clock
   * off by more than DRIFT_THRESHOLD_MS is corrected; nothing waits for this and a failure leaves the device clock.
   */
  async checkServer(fetcher: typeof fetch = fetch, url = '/robots.txt') {
    if (this.serverChecked || this.override !== null) return; this.serverChecked = true;
    try {
      const sent = this.deviceNow(); const response = await fetcher(url, { method: 'HEAD', cache: 'no-store' }); const received = this.deviceNow();
      const header = response.headers.get('date'); if (!header) return;
      const server = Date.parse(header); if (!Number.isFinite(server)) return;
      // The header is truncated to the second: compare against the middle of that second, at the request midpoint.
      const drift = server + 500 - (sent + received) / 2;
      if (Math.abs(drift) > DRIFT_THRESHOLD_MS) this.offset = Math.round(drift);
    } catch { /* offline or blocked: the device clock stays the source */ }
  }
}

let shared: IndiaWorldClock | null = null;
/** The page's clock. A `?debug&time=` override applies only to this page load. */
export function worldClock() {
  if (!shared) shared = new IndiaWorldClock(typeof location === 'undefined' ? null : parseOverride(location.search, Date.now()));
  return shared;
}
