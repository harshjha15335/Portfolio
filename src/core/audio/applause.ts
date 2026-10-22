/**
 * A theatre's standing ovation as sound: a few dozen people clapping out of step, swelling, holding and dying away.
 * Synthesised once per audio context (no recording ships with the site). Each clap is a short burst of noise with
 * its own pitch and loudness; a crowd is many clappers at slightly different rates, panned across the hall.
 */
const buffers = new WeakMap<BaseAudioContext, AudioBuffer>();
export const OVATION_SECONDS = 8;

/** The ovation as a stereo buffer: `seconds` long, `clappers` people, deterministic for a given seed. */
export function applauseBuffer(context: BaseAudioContext, seconds = OVATION_SECONDS, clappers = 48, seed = 7) {
  const cached = buffers.get(context); if (cached) return cached;
  const rate = context.sampleRate, length = Math.floor(seconds * rate), buffer = context.createBuffer(2, length, rate);
  const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
  let s = seed; const random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  // The crowd's loudness: up over the first second, held, then fading out over the last two and a half.
  const swell = (t: number) => Math.min(1, t / 1.1) * Math.min(1, Math.max(0, (seconds - t) / 2.5));
  for (let c = 0; c < clappers; c++) {
    const pan = random(), hz = 3.2 + random() * 2.4, start = random() * .9, bright = .35 + random() * .5, loud = .5 + random() * .5;
    const clapLength = Math.floor(rate * (.012 + random() * .01));
    for (let t = start; t < seconds; t += (1 + (random() - .5) * .16) / hz) {
      const at = Math.floor(t * rate), gain = loud * swell(t) * (.75 + random() * .25); if (gain <= 0) continue;
      // A clap: noise through a crude one-pole high-pass (brightness), decaying fast.
      let previous = 0, filtered = 0;
      for (let i = 0; i < clapLength && at + i < length; i++) {
        const noise = random() * 2 - 1; filtered = bright * (filtered + noise - previous); previous = noise;
        const v = filtered * gain * Math.exp(-i / (clapLength * .3)) * .09;
        left[at + i] += v * (1 - pan); right[at + i] += v * pan;
      }
    }
  }
  buffers.set(context, buffer); return buffer;
}

/** Play the ovation into `destination` (default: the context's output). Returns a stop function. */
export function playApplause(context: AudioContext, volume = .8, destination: AudioNode = context.destination) {
  const source = context.createBufferSource(), gain = context.createGain(), tone = context.createBiquadFilter();
  source.buffer = applauseBuffer(context); tone.type = 'peaking'; tone.frequency.value = 1800; tone.gain.value = 3; gain.gain.value = volume;
  source.connect(tone); tone.connect(gain); gain.connect(destination);
  void context.resume().catch(() => {}); source.start();
  return () => { try { source.stop(); } catch { /* already finished */ } source.disconnect(); };
}

let shared: AudioContext | null = null;
/** One audio context for ovations outside the city soundscape (the theatre page, the hall's screen). */
export function ovationContext() {
  if (!shared && typeof AudioContext !== 'undefined') { try { shared = new AudioContext(); } catch { shared = null; } }
  return shared;
}
