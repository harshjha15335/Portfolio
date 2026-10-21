import type { ClockSample } from './IndiaWorldClock';

/**
 * What the sky and lights look like at a sun altitude: a small keyframe table, separate for the climbing (morning)
 * and setting (evening) sun, interpolated linearly. Looks are matched to Harsh's four CST reference photos:
 *  - morning: pale hazy sky, low warm sun raking the façade (ref 1)
 *  - midday: clear saturated blue sky, bright neutral sun, hard shadows (ref 2)
 *  - dusk: deep blue sky, floodlit golden façade, warm lamps, red tail lamps (ref 3)
 *  - night: near-black sky with a faint sodium glow, warm floodlit façade, dark streets, headlights (ref 4)
 * After the sun sets the directional light becomes a dim, cool moonlight from a fixed high bearing, the hemisphere
 * light's ground colour becomes the warm floodlight from street level that lights façades and soffits but not the
 * road, and the bounce light turns into a floodlight aimed up at the station front. Pure data: no Three.js.
 */
export type Rgb = [number, number, number];
export type EnvironmentLook = {
  skyTop: Rgb; skyMid: Rgb; skyHorizon: Rgb; cloud: Rgb;
  sunColor: Rgb; sunIntensity: number; moonIntensity: number;
  hemiSky: Rgb; hemiGround: Rgb; hemiIntensity: number;
  bounceColor: Rgb; bounceIntensity: number; /** 0 = daylight bounce off the street, 1 = floodlight aimed up at façades. */ flood: number;
  fog: Rgb; fogNear: number; fogFar: number; haze: Rgb;
  exposure: number; environment: number;
  /** Street lamps, windows and headlamps: 0 off, 1 fully on. */ lamps: number;
  stars: number; /** Strength of the sun disc and its glow in the sky. */ sunGlow: number;
};
type Key = { alt: number } & EnvironmentLook;

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
type Spec = { [K in keyof EnvironmentLook]: EnvironmentLook[K] extends Rgb ? string : number };
const key = (alt: number, s: Spec): Key => {
  const out: Record<string, unknown> = { alt };
  for (const [k, v] of Object.entries(s)) out[k] = typeof v === 'string' ? hex(v) : v;
  return out as Key;
};

const NIGHT: Spec = { skyTop: '#04050a', skyMid: '#080a12', skyHorizon: '#2a1d16', cloud: '#191411', sunColor: '#9fb2d6', sunIntensity: 0, moonIntensity: .32,
  hemiSky: '#141a2a', hemiGround: '#c27c3c', hemiIntensity: .82, bounceColor: '#ffad5c', bounceIntensity: 2.3, flood: 1,
  fog: '#0d0b0b', fogNear: 22, fogFar: 140, haze: '#0d0b0b', exposure: 1.25, environment: .03, lamps: 1, stars: 1, sunGlow: 0 };
const LATE_DUSK: Spec = { ...NIGHT, skyTop: '#0a1a52', skyMid: '#112a74', skyHorizon: '#2b4690', cloud: '#1c2440', moonIntensity: .22,
  hemiSky: '#253a74', hemiGround: '#cc8442', hemiIntensity: 1.0, fog: '#18213f', haze: '#18213f', environment: .05, stars: .35 };
const DUSK: Spec = { ...NIGHT, skyTop: '#123aa6', skyMid: '#1e55c4', skyHorizon: '#5579c4', cloud: '#3a4f8a', moonIntensity: 0,
  hemiSky: '#4664aa', hemiGround: '#cf8c4c', hemiIntensity: 1.2, bounceIntensity: 1.9,
  fog: '#34497e', fogNear: 24, fogFar: 160, haze: '#7a76a0', exposure: 1.3, environment: .08, stars: 0 };
const SUNSET: Spec = { skyTop: '#4d74b6', skyMid: '#8c9fbe', skyHorizon: '#f0a466', cloud: '#c79a86', sunColor: '#ff8646', sunIntensity: 2.2, moonIntensity: 0,
  hemiSky: '#6a8ec2', hemiGround: '#4c4036', hemiIntensity: .8, bounceColor: '#f3c9a0', bounceIntensity: .9, flood: .35,
  fog: '#a39286', fogNear: 18, fogFar: 150, haze: '#f29a62', exposure: 1.3, environment: .12, lamps: .55, stars: 0, sunGlow: 1 };
const SUNRISE: Spec = { ...SUNSET, skyTop: '#7a9ccc', skyMid: '#b2c3d6', skyHorizon: '#f2d0a6', cloud: '#d8c4b4', sunColor: '#ffae6c', sunIntensity: 2.4,
  hemiSky: '#8eaad0', fog: '#cbc3b6', haze: '#f6cc98' };
/** The authored golden hour this world shipped with (PR #1), kept as the late-afternoon key. */
const GOLDEN: Spec = { skyTop: '#42638c', skyMid: '#8c999e', skyHorizon: '#dbb385', cloud: '#c7b29e', sunColor: '#ffa86c', sunIntensity: 4.4, moonIntensity: 0,
  hemiSky: '#6a8ec2', hemiGround: '#4c4036', hemiIntensity: .8, bounceColor: '#f3c9a0', bounceIntensity: 1.15, flood: 0,
  fog: '#a9a59c', fogNear: 18, fogFar: 150, haze: '#f2b682', exposure: 1.3, environment: .14, lamps: 0, stars: 0, sunGlow: 1 };
const MORNING: Spec = { ...GOLDEN, skyTop: '#a6c2df', skyMid: '#d3dfe8', skyHorizon: '#f4ead8', cloud: '#e4ddd2', sunColor: '#ffd4a0', sunIntensity: 4.2,
  hemiSky: '#a4bedc', hemiGround: '#5a4e40', hemiIntensity: .85, bounceColor: '#f3dcc0', bounceIntensity: 1.0,
  fog: '#d4d1c9', fogNear: 22, fogFar: 170, haze: '#f7e0b8', exposure: 1.22 };
const LATE_MORNING: Spec = { ...MORNING, skyTop: '#6c9edb', skyMid: '#acc8e4', skyHorizon: '#dde6ea', cloud: '#eef0f0', sunColor: '#ffe6c6', sunIntensity: 4.6,
  hemiSky: '#9bbbe2', fog: '#c6ccd2', fogNear: 26, fogFar: 200, haze: '#f0e6d2', exposure: 1.14 };
const AFTERNOON: Spec = { ...LATE_MORNING, skyTop: '#4f88d4', skyMid: '#93b8e0', skyHorizon: '#e6dcc8', sunColor: '#ffdcb2', haze: '#f2d8b0', exposure: 1.16 };
const MIDDAY: Spec = { skyTop: '#1557d4', skyMid: '#3c86ea', skyHorizon: '#b2d2f2', cloud: '#f4f6f8', sunColor: '#fff3e2', sunIntensity: 4.8, moonIntensity: 0,
  hemiSky: '#8db6ec', hemiGround: '#7a6a52', hemiIntensity: .95, bounceColor: '#f5e2c8', bounceIntensity: 1.0, flood: 0,
  fog: '#b6cce4', fogNear: 30, fogFar: 230, haze: '#e8f0f6', exposure: 1.05, environment: .16, lamps: 0, stars: 0, sunGlow: .8 };

const table = (low: Spec, golden: Spec, mid: Spec): Key[] => [
  key(-90, NIGHT), key(-12, NIGHT), key(-7, LATE_DUSK), key(-2.5, DUSK), key(.5, low), key(6, golden), key(18, mid), key(35, MIDDAY), key(90, MIDDAY),
];
export const MORNING_KEYS = table(SUNRISE, MORNING, LATE_MORNING);
export const EVENING_KEYS = table(SUNSET, GOLDEN, AFTERNOON);

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** The look at a sun altitude (degrees) for a climbing (morning) or setting sun. */
export function environmentLook(altitude: number, morning: boolean): EnvironmentLook {
  const keys = morning ? MORNING_KEYS : EVENING_KEYS;
  let i = 0; while (i < keys.length - 2 && altitude > keys[i + 1].alt) i++;
  const a = keys[i], b = keys[i + 1], t = Math.min(1, Math.max(0, (altitude - a.alt) / (b.alt - a.alt)));
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(a) as (keyof Key)[]) {
    if (k === 'alt') continue;
    const x = a[k], y = b[k];
    out[k] = Array.isArray(x) ? mixRgb(x as Rgb, y as Rgb, t) : (x as number) + ((y as number) - (x as number)) * t;
  }
  return out as EnvironmentLook;
}
export const lookAt = (sample: Pick<ClockSample, 'altitude' | 'morning'>) => environmentLook(sample.altitude, sample.morning);

/** Moonlight comes from a fixed high bearing (no lunar ephemeris is modelled): south-south-west, 55° up. */
export const MOON = { azimuth: 200, altitude: 55 };
/** Shadows from a sun lower than this would cover the whole street; the light (not the sky disc) is held at it. */
export const MIN_LIGHT_ALTITUDE = 14;
/** The sun is never put exactly overhead: the shadow camera needs a defined "up". */
export const MAX_LIGHT_ALTITUDE = 84;

/**
 * City bearing: the street's long axis runs east–west, with world −Z = west and +X = north (Y up), so the
 * station front (which faces −Z) faces west and catches the afternoon and evening sun, as in the reference photos,
 * and the authored golden-hour sun of PR #1 (from −X −Z) is a low south-western sun, where Mumbai's sun sets.
 * An azimuth measured clockwise from north therefore maps to (cos az, ·, sin az).
 */
export function skyDirection(azimuth: number, altitude: number): [number, number, number] {
  const az = azimuth * Math.PI / 180, alt = altitude * Math.PI / 180;
  return [Math.cos(az) * Math.cos(alt), Math.sin(alt), Math.sin(az) * Math.cos(alt)];
}
/** Where the directional light shines from: the sun while it is up (held between the light limits), else the moon. */
export function keyLightDirection(sample: Pick<ClockSample, 'altitude' | 'azimuth'>) {
  if (sample.altitude > -3) return skyDirection(sample.azimuth, Math.min(MAX_LIGHT_ALTITUDE, Math.max(MIN_LIGHT_ALTITUDE, sample.altitude)));
  return skyDirection(MOON.azimuth, MOON.altitude);
}
