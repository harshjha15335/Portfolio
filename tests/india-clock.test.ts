import { afterEach, describe, expect, it } from 'vitest';
import { DRIFT_THRESHOLD_MS, IndiaWorldClock, dayPhase, istClock, istInstant, parseOverride, solarPosition, sunTimes } from '../src/game/World/time/IndiaWorldClock';
import { EVENING_KEYS, MORNING_KEYS, environmentLook, keyLightDirection, MIN_LIGHT_ALTITUDE } from '../src/game/World/time/environmentState';

const minutes = (epoch: number | null) => { const [h, m] = istClock(epoch!).split(':').map(Number); return h * 60 + m; };
const at = (h: number, m: number) => h * 60 + m;

describe('India world clock: real Mumbai sun', () => {
  // Published Mumbai (CST) times, rounded to the minute: timeanddate.com / NOAA for these dates.
  it.each([
    ['2026-10-21', at(6, 32), at(18, 11)],
    ['2026-06-21', at(6, 2), at(19, 17)],
    ['2026-12-21', at(7, 5), at(18, 6)],
  ])('sunrise and sunset on %s are within 4 minutes of the published times', (date, rise, set) => {
    const [y, m, d] = date.split('-').map(Number), t = sunTimes(istInstant(y, m, d, 12));
    expect(Math.abs(minutes(t.sunrise) - rise)).toBeLessThanOrEqual(4);
    expect(Math.abs(minutes(t.sunset) - set)).toBeLessThanOrEqual(4);
    expect(minutes(t.dawn)).toBeLessThan(minutes(t.sunrise)); expect(minutes(t.dusk)).toBeGreaterThan(minutes(t.sunset));
  });
  it('puts the October sun in the east in the morning, due south at noon and west in the evening', () => {
    expect(solarPosition(istInstant(2026, 10, 21, 8)).azimuth).toBeGreaterThan(95); expect(solarPosition(istInstant(2026, 10, 21, 8)).azimuth).toBeLessThan(125);
    const noon = sunTimes(istInstant(2026, 10, 21, 12)).noon, p = solarPosition(noon);
    expect(Math.abs(p.azimuth - 180)).toBeLessThan(2); expect(p.altitude).toBeGreaterThan(58); expect(p.altitude).toBeLessThan(62);
    expect(solarPosition(istInstant(2026, 10, 21, 17)).azimuth).toBeGreaterThan(235);
  });
  // The brief's sample times, on two dates in different seasons; the expected phase comes from the altitude model.
  const SAMPLES: [number, number][] = [[4, 30], [6, 30], [9, 0], [12, 30], [16, 30], [18, 30], [21, 0], [0, 30]];
  it.each([[2026, 10, 21], [2027, 6, 15]])('labels every sample time on %i-%i-%i from the sun altitude', (y, m, d) => {
    const clock = new IndiaWorldClock();
    for (const [h, min] of SAMPLES) {
      const epoch = istInstant(y, m, d, h, min), s = clock.sample(epoch);
      expect(s.time).toBe(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
      expect(s.phase).toBe(dayPhase(solarPosition(epoch).altitude));
    }
    expect(clock.sample(istInstant(y, m, d, 12, 30)).phase).toBe('day');
    for (const [h, min] of [[21, 0], [0, 30], [4, 30]]) expect(clock.sample(istInstant(y, m, d, h, min)).phase).toBe('night');
  });
});

describe('India world clock: independent of the visitor time zone', () => {
  const original = process.env.TZ;
  afterEach(() => { process.env.TZ = original; });
  it.each(['America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'UTC'])('a browser in %s sees the same Mumbai moment', zone => {
    const epoch = istInstant(2026, 10, 21, 23, 0);
    process.env.TZ = 'Asia/Kolkata'; const reference = new IndiaWorldClock(null, () => epoch).sample();
    process.env.TZ = zone; const seen = new IndiaWorldClock(null, () => epoch).sample();
    expect(new Date(epoch).getTimezoneOffset()).not.toBe(-330); // the process really is in another zone
    expect(seen.time).toBe('23:00'); expect(seen.date).toBe('2026-10-21');
    expect(seen.phase).toBe(reference.phase); expect(seen.label).toBe('NIGHT');
  });
  it('rolls over at Mumbai midnight, not the visitor midnight', () => {
    process.env.TZ = 'America/Los_Angeles';
    const before = new IndiaWorldClock().sample(istInstant(2026, 10, 21, 23, 59)), after = new IndiaWorldClock().sample(istInstant(2026, 10, 22, 0, 1));
    expect(before.date).toBe('2026-10-21'); expect(after.date).toBe('2026-10-22');
  });
});

describe('India world clock: overrides and drift', () => {
  const now = istInstant(2026, 10, 21, 10);
  it('accepts ?debug&time= (and an optional date) and nothing else', () => {
    expect(parseOverride('?debug&time=23:45', now)).toBe(istInstant(2026, 10, 21, 23, 45));
    expect(parseOverride('?debug&time=05:30&date=2026-12-21', now)).toBe(istInstant(2026, 12, 21, 5, 30));
    expect(parseOverride('?time=23:45', now)).toBeNull();
    for (const bad of ['?debug&time=25:00', '?debug&time=noon', '?debug&time=12:00&date=2026-13-01']) expect(parseOverride(bad, now)).toBeNull();
  });
  it('an override fixes the instant and is reported as such', () => {
    const clock = new IndiaWorldClock(istInstant(2026, 10, 21, 23, 45), () => now);
    expect(clock.sample().time).toBe('23:45'); expect(clock.source).toBe('override');
  });
  const serverAt = (offset: number) => (async () => new Response(null, { headers: { date: new Date(now + offset).toUTCString() } })) as unknown as typeof fetch;
  it('corrects a device clock that is minutes off, using the server Date header', async () => {
    const clock = new IndiaWorldClock(null, () => now); await clock.checkServer(serverAt(10 * 60000));
    expect(clock.source).toBe('server'); expect(Math.abs(clock.now() - (now + 10 * 60000))).toBeLessThan(2000);
  });
  it('keeps a device clock within the threshold, and survives a failed check', async () => {
    const close = new IndiaWorldClock(null, () => now); await close.checkServer(serverAt(DRIFT_THRESHOLD_MS / 3));
    expect(close.source).toBe('device'); expect(close.now()).toBe(now);
    const offline = new IndiaWorldClock(null, () => now); await offline.checkServer((async () => { throw new Error('offline'); }) as unknown as typeof fetch);
    expect(offline.source).toBe('device');
  });
});

describe('time-of-day looks', () => {
  const lum = (c: number[]) => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  it('night is dark with the lamps on; midday is bright with them off', () => {
    const night = environmentLook(-40, false), noon = environmentLook(60, true), dusk = environmentLook(-3, false);
    expect(night.sunIntensity).toBe(0); expect(night.lamps).toBe(1); expect(night.sunGlow).toBe(0);
    expect(lum(night.skyTop)).toBeLessThan(.03); expect(lum(night.fog)).toBeLessThan(.06);
    expect(noon.lamps).toBe(0); expect(noon.sunIntensity).toBeGreaterThan(4); expect(lum(noon.skyMid)).toBeGreaterThan(lum(night.skyMid) * 8);
    // Dusk (reference photo 3): a saturated blue sky, lamps already on.
    expect(dusk.lamps).toBe(1); expect(dusk.skyTop[2]).toBeGreaterThan(dusk.skyTop[0] * 3);
  });
  it('crossfades without pops through sunrise and sunset', () => {
    for (const morning of [true, false]) {
      let previous = environmentLook(-10, morning);
      // .05° is about 12 s of real sun movement.
      for (let a = -10; a <= 12; a += .05) {
        const look = environmentLook(a, morning);
        for (const k of Object.keys(look) as (keyof typeof look)[]) {
          const x = look[k], y = previous[k];
          if (Array.isArray(x)) x.forEach((v, i) => expect(Math.abs(v - (y as number[])[i])).toBeLessThan(.02));
          else expect(Math.abs((x as number) - (y as number))).toBeLessThan(.1 + Math.abs(y as number) * .01);
        }
        previous = look;
      }
    }
  });
  it('keeps the shipped golden hour as the late-afternoon key and both tables sorted', () => {
    for (const keys of [MORNING_KEYS, EVENING_KEYS]) for (let i = 1; i < keys.length; i++) expect(keys[i].alt).toBeGreaterThan(keys[i - 1].alt);
    expect(environmentLook(6, false).sunIntensity).toBe(4.4);
  });
  it('lights from the sun while it is up (never too low to shade the street) and from the moon after', () => {
    const morning = keyLightDirection({ altitude: 3, azimuth: 105 }), noon = keyLightDirection({ altitude: 60, azimuth: 180 }), night = keyLightDirection({ altitude: -30, azimuth: 280 });
    expect(morning[2]).toBeGreaterThan(.8); // east is +Z expect(Math.asin(morning[1]) * 180 / Math.PI).toBeCloseTo(MIN_LIGHT_ALTITUDE, 3);
    expect(noon[0]).toBeLessThan(-.4); expect(noon[1]).toBeGreaterThan(.8); // south is −X
    expect(night[1]).toBeGreaterThan(.7);
  });
});
