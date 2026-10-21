# Real Mumbai time: day and night

The world shows the real current moment in Mumbai, for every visitor, whatever their own time zone. At 09:00 IST it is morning in the city, at noon the sun is high, at dusk the sky turns deep blue and the lamps come on, and at 23:00 IST it is a dark night lit by street lamps, floodlit façades, windows and headlights. This replaced the permanent golden hour of PR #1.

## How the time is found

| Piece | File | What it does |
| --- | --- | --- |
| India world clock | `src/game/World/time/IndiaWorldClock.ts` | Holds time as an epoch instant and only formats it in `Asia/Kolkata` with `Intl.DateTimeFormat`. It never adds +5:30 and parses the result back. One shared instance per page (`worldClock()`). |
| Sun position | same file, `solarPosition` | NOAA low-precision solar equations for CST (18.94° N, 72.835° E): altitude and azimuth at any instant. |
| Sunrise, sunset, twilight | same file, `sunTimes` | Searched per IST calendar day (10-minute scan, then bisection): civil dawn, sunrise (−0.833°), solar noon, sunset, civil dusk. |
| Phase | same file, `dayPhase` | From the sun's altitude only: night (below −12°), nautical twilight, civil twilight, golden (below 6°), day. No fixed 06:00/18:00 gates. |
| Device clock check | `IndiaWorldClock.checkServer` | Once, in the background, a `HEAD /robots.txt` to the same origin; if the `Date` header differs from the device clock by more than 90 s, the server time is used. Nothing waits on it; if it fails, the device clock stays the source. The dev HUD says which source is in use. |

Checked against published Mumbai times (unit tests, `tests/india-clock.test.ts`): 21 Oct 2026 sunrise 06:34 / sunset 18:11, 21 Jun 06:02 / 19:18, 21 Dec 07:06 / 18:06, all within 4 minutes of the published values.

## How the time becomes a picture

`src/core/EnvironmentTime.ts` drives everything from the clock, every 5 seconds (the sun moves about 0.25° a minute, so the steps are invisible), and at once when the tab comes back or the visitor changes district:

- **Sky**: top, middle and horizon colours, cloud tint, the sun disc and its glow, and a few stars at night (`StreetAtmosphere.createSkyMaterial`).
- **Sun**: colour, strength and direction. The light is held at 14° or higher, so a sun on the horizon does not throw shadows across the whole street; the sky disc uses the true position. After sunset the same light becomes a dim, cool moonlight from a fixed high bearing (no lunar ephemeris is modelled).
- **Hemisphere light**: by day the sky and ground fill. After dark its ground colour becomes the warm floodlight from street level, which lights façades, arcades and people but not the road.
- **Bounce light**: by day the warm light thrown back off the street; after dark it swings round into a floodlight aimed up at the west-facing station front.
- **Fog, haze, exposure and environment strength.**
- **Lamps** (`src/game/World/time/nightLights.ts`): pools of light under street lamps (one additive decal mesh per street, no dynamic lights), lit windows on district apartment blocks (an emissive window mask, about half the flats lit in varied colours), and tail lamps, head lamps and a beam on the road for every vehicle (`traffic/BrakeLights.ts`).

The looks are a small keyframe table by sun altitude, one for the climbing sun and one for the setting sun (`time/environmentState.ts`), matched to Harsh's four CST reference photos:

| Phase | Reference | What the table aims for |
| --- | --- | --- |
| Morning | photo 1 | Pale hazy sky, low warm sun behind the station |
| Midday / afternoon | photo 2 | Clear saturated blue sky, bright neutral sun, hard shadows |
| Dusk | photo 3 | Deep blue sky, floodlit golden façade, lamps on, red tail lamps |
| Night | photo 4 | Near-black sky with a faint sodium glow, warm floodlit façade, dark streets, headlights |

The authored golden hour of PR #1 is kept as the late-afternoon key (6° altitude, setting sun).

## City bearing

The street's long axis runs east–west: world −Z is west and +X is north. The station front faces −Z (west), so the afternoon and evening sun light it as in the reference photos, and the old golden-hour sun (from −X −Z) is a low south-western sun, where Mumbai's sun sets.

## Cost

The light count never changes (sun, bounce, hemisphere), so the time of day compiles no new lit shaders. By day the night-only meshes are hidden, neither drawn nor compiled, and the window mask is detached, so the daytime frame is the same as before (measured with `scripts/measure-time-of-day.mjs` against `main`: same programs and textures in view at CST, BKC and Juhu). After dark there are a few more draws (lamp pools, tail and head lamps, beams) and one or two more programs; when the lamps first come on in a session those compile once.

## Developer override

`?debug&time=HH:MM` (and optionally `&date=YYYY-MM-DD`) fixes the Mumbai instant for that page load, for reviews and screenshot tests. It is not stored anywhere, and the HUD says TIME OVERRIDE while it is in use. Examples: `?debug&time=05:30`, `?debug&time=12:00`, `?debug&time=19:30`, `?debug&time=23:45&date=2026-12-21`. On the dev server, `?debug` also shows the IST date and time, sun altitude and azimuth, phase, lamp level and clock source in the diagnostics line.

`scripts/capture-time-of-day.mjs` captures the same views at several times; `scripts/measure-time-of-day.mjs` records draws, triangles, textures and programs for them.

## Limits

- Weather is not live: haze and clouds are artistic, not a weather feed.
- The moon's position and phase are not modelled.
- Interiors keep their existing lighting; they do not yet switch lamps by time.
- Traffic and crowd density do not yet change with the time of day.
