import { onCue, type CueKind } from './cues';
import type { AudioLevels } from './audioSettings';
import { ambienceFor, EventTimer, footstepInterval, HornScheduler, type Ambience, type AmbienceLayer, type Surface } from './soundscapeMix';

/** What the world tells the soundscape each frame. Positions are metres in the current district's frame. */
export type SoundFrame = {
  district: string; hour: number; altitude: number;
  riding: boolean; rideKind: 'taxi' | 'auto'; cabSpeed: number;
  walkSpeed: number; grounded: boolean; surface: Surface; indoors: boolean;
  /** Nearest moving vehicle relative to the listener: right (+) / ahead (+) in metres, and its speed. */
  nearest: { right: number; ahead: number; speed: number; kind: string } | null;
  /** 0–1: how much traffic is around. */
  traffic: number;
};
export type SoundStats = { state: string; voices: number; layers: number; master: number };

/** One-shot voices playing at once never exceed this; extra events are dropped, never queued. */
export const MAX_VOICES = 14;
const T = .6; // crossfade time constant (s) for layer levels

/**
 * The city's sound, all synthesized in Web Audio from three noise buffers and oscillators: continuous ambience
 * layers per district and time of day, traffic (pass-bys, distant engines, horns with a cooldown), the cab's engine
 * on a ride, footsteps by surface, jump and landing, and interface cues. Created only after the visitor turns sound
 * on (a user gesture), so the browser's autoplay rules are met; suspended whenever the world is hidden or paused.
 */
export class Soundscape {
  readonly context: AudioContext;
  private master: GainNode; private buses: Record<'ambience' | 'traffic' | 'effects' | 'interface', GainNode>;
  private outdoor: BiquadFilterNode; private noise: Record<'white' | 'pink' | 'brown', AudioBuffer>;
  private layers = new Map<AmbienceLayer, GainNode>(); private continuous: AudioScheduledSourceNode[] = [];
  private passby: { gain: GainNode; pan: StereoPannerNode; filter: BiquadFilterNode }; private traffic: GainNode;
  private engine: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode; tremolo: GainNode; lfo: OscillatorNode };
  private voices = 0; private nextStep = 0; private stepSide = 1; private lastCue = new Map<CueKind, number>();
  private horns: HornScheduler; private birds: EventTimer; private trains: EventTimer; private chimes: EventTimer;
  private target: Ambience | null = null; private stopCues: () => void; private random: () => number;
  private levels: AudioLevels;
  constructor(levels: AudioLevels, options: { context?: AudioContext; random?: () => number } = {}) {
    this.context = options.context ?? new AudioContext(); this.random = options.random ?? Math.random; this.levels = { ...levels };
    const c = this.context;
    const limiter = c.createDynamicsCompressor(); limiter.threshold.value = -8; limiter.knee.value = 6; limiter.ratio.value = 12; limiter.attack.value = .003; limiter.release.value = .25; limiter.connect(c.destination);
    this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(limiter);
    this.outdoor = c.createBiquadFilter(); this.outdoor.type = 'lowpass'; this.outdoor.frequency.value = 16000; this.outdoor.Q.value = .5; this.outdoor.connect(this.master);
    const bus = (to: AudioNode) => { const g = c.createGain(); g.connect(to); return g; };
    this.buses = { ambience: bus(this.outdoor), traffic: bus(this.outdoor), effects: bus(this.master), interface: bus(this.master) };
    this.noise = { white: this.buffer('white'), pink: this.buffer('pink'), brown: this.buffer('brown') };
    // Ambience beds.
    this.layer('hum', 'brown', [['lowpass', 220, .7]], this.buses.ambience);
    this.layer('crowd', 'pink', [['bandpass', 850, .7], ['lowshelf', 300, 0, -6]], this.buses.ambience, .21, .45);
    this.layer('surf', 'brown', [['lowpass', 650, .6]], this.buses.ambience, .12, .75);
    this.layer('wind', 'pink', [['bandpass', 420, .4]], this.buses.ambience, .07, .55);
    this.layer('insects', 'white', [['bandpass', 4600, 9]], this.buses.ambience, 23, .9);
    this.layer('hvac', 'pink', [['lowpass', 320, .8]], this.buses.ambience);
    this.layer('projector', 'pink', [['bandpass', 2400, 5]], this.buses.ambience, 24, .7);
    // Distant engines idling and moving: a low bed that follows the traffic around.
    this.traffic = c.createGain(); this.traffic.gain.value = 0; this.loop('brown', [['lowpass', 140, .7]], this.traffic); this.traffic.connect(this.buses.traffic);
    const pg = c.createGain(), pan = c.createStereoPanner(), pf = c.createBiquadFilter(); pg.gain.value = 0; pf.type = 'bandpass'; pf.frequency.value = 600; pf.Q.value = .6;
    this.loop('pink', [], pf); pf.connect(pan); pan.connect(pg); pg.connect(this.buses.traffic); this.passby = { gain: pg, pan, filter: pf };
    // The boarded cab's engine, heard inside the cabin (not muffled).
    const osc = c.createOscillator(), ef = c.createBiquadFilter(), tremolo = c.createGain(), eg = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = 50; ef.type = 'lowpass'; ef.frequency.value = 380; tremolo.gain.value = .7; lfo.frequency.value = 22; depth.gain.value = 0; eg.gain.value = 0;
    lfo.connect(depth); depth.connect(tremolo.gain); osc.connect(ef); ef.connect(tremolo); tremolo.connect(eg); eg.connect(this.buses.effects); osc.start(); lfo.start(); this.continuous.push(osc, lfo);
    this.engine = { osc, gain: eg, filter: ef, tremolo: depth, lfo };
    this.horns = new HornScheduler(this.random); this.birds = new EventTimer(3.2, .9, this.random); this.trains = new EventTimer(75, 40, this.random); this.chimes = new EventTimer(26, 12, this.random);
    this.stopCues = onCue(kind => this.cue(kind));
    this.setLevels(levels);
  }
  setActive(active: boolean) {
    if (active) void this.context.resume().catch(() => {}); else void this.context.suspend().catch(() => {});
    // Fade in rather than start at full level.
    const now = this.context.currentTime; this.master.gain.cancelScheduledValues(now); this.master.gain.setTargetAtTime(active ? this.levels.master : 0, now, active ? .8 : .05);
  }
  setLevels(levels: AudioLevels) {
    this.levels = { ...levels }; const now = this.context.currentTime;
    for (const k of ['ambience', 'traffic', 'effects', 'interface'] as const) this.buses[k].gain.setTargetAtTime(levels[k], now, .1);
    if (this.context.state === 'running') this.master.gain.setTargetAtTime(levels.master, now, .1);
  }
  stats(): SoundStats { return { state: this.context.state, voices: this.voices, layers: this.layers.size, master: this.levels.master }; }
  /** Current target level of an ambience layer (for diagnostics and tests). */
  layerTarget(layer: AmbienceLayer) { return this.target?.[layer] ?? 0; }
  update(f: SoundFrame) {
    const c = this.context, now = c.currentTime;
    this.target = ambienceFor({ district: f.district, hour: f.hour, altitude: f.altitude, riding: f.riding, indoors: f.indoors });
    for (const [k, g] of this.layers) g.gain.setTargetAtTime(this.target[k] * LAYER_GAIN[k], now, T);
    this.outdoor.frequency.setTargetAtTime(f.riding ? 750 : f.indoors ? 1100 : 16000, now, .25);
    this.traffic.gain.setTargetAtTime(.32 * f.traffic * (.4 + .6 * this.target.hum), now, T);
    // Pass-by: louder and brighter as a moving vehicle comes close, panned to its side.
    const n = f.nearest, d = n ? Math.hypot(n.right, n.ahead) : Infinity, near = n ? Math.min(1, n.speed / 8) / (1 + d * d / 30) : 0;
    this.passby.gain.gain.setTargetAtTime(.5 * near, now, .15); this.passby.pan.pan.setTargetAtTime(n && d > .1 ? Math.max(-1, Math.min(1, n.right / d)) : 0, now, .15);
    this.passby.filter.frequency.setTargetAtTime(450 + 900 * near, now, .15);
    // Cab engine.
    const auto = f.rideKind === 'auto';
    this.engine.osc.frequency.setTargetAtTime((auto ? 68 : 46) + f.cabSpeed * (auto ? 4.2 : 2.6), now, .3);
    this.engine.gain.gain.setTargetAtTime(f.riding ? (auto ? .2 : .13) : 0, now, .4); this.engine.tremolo.gain.setTargetAtTime(auto ? .45 : .08, now, .3);
    this.engine.lfo.frequency.setTargetAtTime(auto ? 18 + f.cabSpeed * 1.4 : 30, now, .3);
    // One-shots.
    if (this.horns.tick(now, f.traffic * (f.indoors ? .3 : 1))) this.horn(auto && f.riding ? 'auto' : this.random() < .35 ? 'auto' : 'car');
    if (this.birds.tick(now, this.target.birds)) this.chirp();
    if (this.trains.tick(now, this.target.trains)) this.train();
    if (this.chimes.tick(now, this.target.market)) this.chime(.12);
    const interval = f.riding || !f.grounded ? Infinity : footstepInterval(f.walkSpeed);
    if (interval === Infinity) this.nextStep = Math.max(this.nextStep, now + .12); else if (now >= this.nextStep) { this.nextStep = now + interval * (.95 + this.random() * .1); this.footstep(f.surface, f.walkSpeed); }
  }
  jump() { this.burst('pink', .12, [['bandpass', 700, .6]], .12, this.buses.effects); }
  land(strength: number) { const s = Math.min(1, strength / 6); this.thump(.25 + .4 * s); this.burst('brown', .1, [['lowpass', 500, .7]], .3 * s + .1, this.buses.effects); }
  cue(kind: CueKind) {
    const now = this.context.currentTime, last = this.lastCue.get(kind) ?? -1; if (now - last < .12) return; this.lastCue.set(kind, now);
    const b = this.buses.interface;
    switch (kind) {
      case 'achievement': [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 'triangle', .14, .32, b, i * .09)); break;
      case 'quest': [392, 523.25, 659.25, 1046.5].forEach((f, i) => this.tone(f, 'triangle', .13, .4, b, i * .1)); break;
      case 'map': case 'journal': this.burst('white', .06, [['bandpass', 3200, 1.2]], .09, b); break;
      case 'meter-hire': this.tone(1800, 'square', .03, .02, b); this.tone(1500, 'square', .03, .02, b, .06); break;
      case 'arrive': this.chime(.16, b); break;
      case 'demo': this.tone(1320, 'sine', .06, .08, b); break;
      default: this.tone(kind === 'close' ? 700 : 1100, 'sine', .06, .05, b);
    }
  }
  dispose() { this.stopCues(); for (const s of this.continuous) { try { s.stop(); } catch { /* already stopped */ } } void this.context.close().catch(() => {}); }

  // --- building blocks
  private buffer(kind: 'white' | 'pink' | 'brown') {
    const c = this.context, len = Math.floor(c.sampleRate * 2.5), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let seed = kind === 'white' ? 1976 : kind === 'pink' ? 2024 : 1853, b0 = 0, b1 = 0, b2 = 0, last = 0;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
    for (let i = 0; i < len; i++) {
      const w = rnd();
      if (kind === 'white') d[i] = w * .5;
      else if (kind === 'pink') { b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * .1848) * .11; }
      else { last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }
    }
    // Fade the loop's ends into each other so it never clicks.
    const x = Math.floor(c.sampleRate * .05); for (let i = 0; i < x; i++) { const t = i / x; d[len - x + i] = d[len - x + i] * (1 - t) + d[i] * t; }
    return buf;
  }
  private chain(source: AudioNode, filters: [BiquadFilterType, number, number, number?][]) {
    let node: AudioNode = source;
    for (const [type, freq, q, gain] of filters) { const f = this.context.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; if (gain !== undefined) f.gain.value = gain; node.connect(f); node = f; }
    return node;
  }
  private loop(kind: 'white' | 'pink' | 'brown', filters: [BiquadFilterType, number, number, number?][], to: AudioNode) {
    const s = this.context.createBufferSource(); s.buffer = this.noise[kind]; s.loop = true; s.loopStart = 0; s.loopEnd = s.buffer.duration - .05;
    s.playbackRate.value = .97 + this.random() * .06; this.chain(s, filters).connect(to); s.start(0, this.random() * 2); this.continuous.push(s);
  }
  /** A continuous layer, optionally swelling with a slow (or, for insects and projector, a fast) amplitude wave. */
  private layer(name: AmbienceLayer, kind: 'white' | 'pink' | 'brown', filters: [BiquadFilterType, number, number, number?][], to: AudioNode, lfoHz = 0, depth = 0) {
    const c = this.context, g = c.createGain(); g.gain.value = 0;
    if (lfoHz) {
      const swell = c.createGain(), lfo = c.createOscillator(), amount = c.createGain(); swell.gain.value = 1 - depth / 2; lfo.frequency.value = lfoHz * (.9 + this.random() * .2); amount.gain.value = depth / 2;
      lfo.connect(amount); amount.connect(swell.gain); lfo.start(); this.continuous.push(lfo); this.loop(kind, filters, swell); swell.connect(g);
    } else this.loop(kind, filters, g);
    g.connect(to); this.layers.set(name, g);
  }
  private voice(duration: number, start: (at: number) => AudioScheduledSourceNode[]) {
    if (this.voices >= MAX_VOICES || this.context.state !== 'running') return false;
    this.voices++; const at = this.context.currentTime + .01, nodes = start(at);
    nodes[0].onended = () => { this.voices = Math.max(0, this.voices - 1); };
    for (const n of nodes) n.stop(at + duration + .05);
    return true;
  }
  private envelope(at: number, peak: number, attack: number, length: number, to: AudioNode) {
    const g = this.context.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + attack); g.gain.exponentialRampToValueAtTime(.0001, at + length); g.connect(to); return g;
  }
  private tone(freq: number, type: OscillatorType, peak: number, length: number, to: AudioNode, delay = 0, pan = 0) {
    this.voice(length + delay, at => { const o = this.context.createOscillator(), p = this.context.createStereoPanner(); o.type = type; o.frequency.value = freq; p.pan.value = pan; o.connect(p); p.connect(this.envelope(at + delay, peak, .005, length, to)); o.start(at + delay); return [o]; });
  }
  private burst(kind: 'white' | 'pink' | 'brown', length: number, filters: [BiquadFilterType, number, number, number?][], peak: number, to: AudioNode, rate = 1, pan = 0) {
    return this.voice(length, at => { const s = this.context.createBufferSource(), p = this.context.createStereoPanner(); s.buffer = this.noise[kind]; s.playbackRate.value = rate; p.pan.value = pan; this.chain(s, filters).connect(p); p.connect(this.envelope(at, peak, .004, length, to)); s.start(at, this.random() * 2); return [s]; });
  }
  private thump(peak: number) {
    this.voice(.2, at => { const o = this.context.createOscillator(); o.frequency.setValueAtTime(95, at); o.frequency.exponentialRampToValueAtTime(38, at + .15); o.connect(this.envelope(at, peak * .5, .004, .18, this.buses.effects)); o.start(at); return [o]; });
  }
  private footstep(surface: Surface, speed: number) {
    this.stepSide = -this.stepSide; const run = speed > 3.2, pan = this.stepSide * .12, rate = .9 + this.random() * .2;
    const peak = (run ? .3 : .2) * (.85 + this.random() * .3);
    const shapes: Record<Surface, [BiquadFilterType, number, number, number?][]> = {
      asphalt: [['lowpass', 900, .8], ['peaking', 220, 1, 4]], stone: [['bandpass', 1500, 1.1], ['peaking', 320, 1.2, 5]],
      tile: [['highpass', 900, .7], ['peaking', 2600, 4, 8]], sand: [['lowpass', 520, .6]],
    };
    this.burst(surface === 'sand' ? 'pink' : 'white', surface === 'sand' ? .16 : .07, shapes[surface], peak, this.buses.effects, rate, pan);
  }
  private horn(kind: 'car' | 'auto') {
    const pan = (this.random() * 2 - 1) * .7, base = kind === 'auto' ? 610 : 405 + this.random() * 40, beeps = this.random() < .45 ? 2 : 1;
    for (let i = 0; i < beeps; i++) for (const detune of [0, kind === 'auto' ? 7 : 18]) {
      this.voice(.5, at => { const o = this.context.createOscillator(), f = this.context.createBiquadFilter(), p = this.context.createStereoPanner(); o.type = 'square'; o.frequency.value = base + detune; f.type = 'lowpass'; f.frequency.value = 1800; p.pan.value = pan;
        const t = at + i * .32, len = kind === 'auto' ? .16 : .28; const g = this.context.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + .015); g.gain.setValueAtTime(.05, t + len); g.gain.linearRampToValueAtTime(0, t + len + .04);
        o.connect(f); f.connect(p); p.connect(g); g.connect(this.buses.traffic); o.start(t); return [o]; });
    }
  }
  private chirp() {
    const pan = (this.random() * 2 - 1) * .8, f0 = 2400 + this.random() * 1600, notes = 2 + Math.floor(this.random() * 3);
    for (let i = 0; i < notes; i++) this.voice(.12, at => { const o = this.context.createOscillator(), p = this.context.createStereoPanner(); const t = at + i * .11; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * (1.2 + this.random() * .3), t + .06); p.pan.value = pan; o.connect(p); p.connect(this.envelope(t, .03, .01, .09, this.buses.ambience)); o.start(t); return [o]; });
  }
  private train() {
    // A local train passing at a distance: a rumble that swells and fades over 9 s with wheel clacks, sometimes a horn.
    this.voice(9, at => { const s = this.context.createBufferSource(); s.buffer = this.noise.brown; s.loop = true; const g = this.context.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.35, at + 4); g.gain.linearRampToValueAtTime(0, at + 9); this.chain(s, [['lowpass', 170, .8]]).connect(g); g.connect(this.buses.ambience); s.start(at); return [s]; });
    for (let k = 0; k < 12; k++) { const t = 2 + k * .42 + (k % 2) * .09; globalThis.setTimeout(() => this.burst('white', .04, [['bandpass', 1900, 3]], .05 * Math.sin(Math.PI * k / 12) + .01, this.buses.ambience), t * 1000); }
    if (this.random() < .4) for (const f of [311, 370]) this.tone(f, 'sawtooth', .025, 1.2, this.buses.ambience, 1.5, -.3);
  }
  private chime(peak: number, to: AudioNode = this.buses.ambience) { this.tone(880, 'sine', peak * .5, .5, to, 0, .3); this.tone(660, 'sine', peak * .5, .7, to, .18, .3); }
}
/** Test hook: let one-shots schedule on a suspended (fake) context. */
const LAYER_GAIN: Record<AmbienceLayer, number> = { hum: .55, crowd: .32, surf: .6, wind: .22, birds: 1, insects: .05, hvac: .3, trains: 1, market: 1, projector: .05 };
