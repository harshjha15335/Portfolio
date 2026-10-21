import { describe, expect, it } from 'vitest';
import { MAX_VOICES, Soundscape, type SoundFrame } from '../src/core/audio/Soundscape';
import { ambienceFor, cityActivity, EventTimer, footstepInterval, HornScheduler } from '../src/core/audio/soundscapeMix';
import { DEFAULT_AUDIO, loadAudioSettings, saveAudioSettings } from '../src/core/audio/audioSettings';
import { playCue } from '../src/core/audio/cues';

// A small fake of the Web Audio graph: enough to build the soundscape and count what it plays.
class Param {
  value = 0; target = 0;
  setTargetAtTime(v: number) { this.target = v; return this; }
  setValueAtTime(v: number) { this.value = v; return this; }
  linearRampToValueAtTime() { return this; } exponentialRampToValueAtTime() { return this; } cancelScheduledValues() { return this; }
}
class Node {
  gain = new Param(); frequency = new Param(); Q = new Param(); pan = new Param(); playbackRate = new Param(); detune = new Param();
  threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
  type = ''; buffer: { duration: number } | null = null; loop = false; loopStart = 0; loopEnd = 0; onended: (() => void) | null = null;
  constructor(private ctx: FakeContext, readonly kind: string) {}
  connect(to: Node) { return to; }
  start() { if (this.kind === 'osc' || this.kind === 'source') this.ctx.started++; }
  stop() { this.ctx.ending.push(this); }
}
class FakeContext {
  state: AudioContextState = 'running'; currentTime = 0; sampleRate = 2000; started = 0; ending: Node[] = []; closed = false;
  destination = new Node(this, 'out');
  createGain() { return new Node(this, 'gain'); } createBiquadFilter() { return new Node(this, 'filter'); }
  createDynamicsCompressor() { return new Node(this, 'comp'); } createStereoPanner() { return new Node(this, 'pan'); }
  createOscillator() { return new Node(this, 'osc'); } createBufferSource() { return new Node(this, 'source'); }
  createBuffer(_c: number, length: number, rate: number) { const data = new Float32Array(length); return { duration: length / rate, getChannelData: () => data }; }
  resume() { this.state = 'running'; return Promise.resolve(); } suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.closed = true; this.state = 'closed'; return Promise.resolve(); }
  /** Let every scheduled one-shot finish. */
  finish() { for (const n of this.ending.splice(0)) n.onended?.(); }
}
const make = (seed = .5) => { const ctx = new FakeContext(); const sound = new Soundscape(DEFAULT_AUDIO.levels, { context: ctx as unknown as AudioContext, random: () => seed }); return { ctx, sound }; };
const frame = (over: Partial<SoundFrame> = {}): SoundFrame => ({ district: 'cst', hour: 12, altitude: 60, riding: false, rideKind: 'taxi', cabSpeed: 0, walkSpeed: 0, grounded: true, surface: 'stone', indoors: false, nearest: null, traffic: 0, ...over });

describe('city soundscape', () => {
  it('never plays more than the voice cap at once', () => {
    const { ctx, sound } = make();
    for (let i = 0; i < 60; i++) { ctx.currentTime += .2; sound.cue('achievement'); }
    expect(sound.stats().voices).toBe(MAX_VOICES);
    ctx.finish(); expect(sound.stats().voices).toBe(0);
    sound.dispose();
  });
  it('plays footsteps only while walking on the ground', () => {
    const { ctx, sound } = make();
    const steps = (f: Partial<SoundFrame>) => { const before = ctx.started; for (let i = 0; i < 40; i++) { ctx.currentTime += .05; sound.update(frame(f)); ctx.finish(); } return ctx.started - before; };
    expect(steps({ walkSpeed: 0 })).toBe(0);
    expect(steps({ walkSpeed: 2, grounded: false })).toBe(0);
    expect(steps({ walkSpeed: 2, riding: true })).toBe(0);
    expect(steps({ walkSpeed: 2 })).toBeGreaterThanOrEqual(2);
    sound.dispose();
  });
  it('muffles the street in a cab and indoors, and follows the district and hour', () => {
    const { sound } = make();
    sound.update(frame({ riding: true })); expect((sound as unknown as { outdoor: Node }).outdoor.frequency.target).toBe(750);
    sound.update(frame({ indoors: true })); expect((sound as unknown as { outdoor: Node }).outdoor.frequency.target).toBe(1100);
    sound.update(frame({ district: 'juhu' })); expect(sound.layerTarget('surf')).toBeGreaterThan(0);
    sound.update(frame({ district: 'juhu', hour: 23, altitude: -40 })); expect(sound.layerTarget('insects')).toBeGreaterThan(0);
    sound.update(frame({ district: 'cst', hour: 12, altitude: 60 })); expect(sound.layerTarget('insects')).toBe(0);
    sound.dispose();
  });
  it('fades to silence when inactive and closes the context on dispose', () => {
    const { ctx, sound } = make();
    sound.setActive(false); expect(ctx.state).toBe('suspended');
    expect((sound as unknown as { master: Node }).master.gain.target).toBe(0);
    sound.setActive(true); expect((sound as unknown as { master: Node }).master.gain.target).toBe(DEFAULT_AUDIO.levels.master);
    sound.dispose(); expect(ctx.closed).toBe(true);
    const before = ctx.started; playCue('map'); expect(ctx.started).toBe(before);
  });
  it('hears interface cues sent from the page while running', () => {
    const { ctx, sound } = make();
    const before = ctx.started; playCue('journal'); expect(ctx.started).toBeGreaterThan(before);
    sound.dispose();
  });
});

describe('sound mix rules', () => {
  it('keeps districts that are not loaded silent', () => {
    expect(Object.values(ambienceFor({ district: 'nowhere', hour: 12, altitude: 50, riding: false, indoors: false })).every(v => v === 0)).toBe(true);
  });
  it('makes the city busier at the evening peak than before dawn, smoothly', () => {
    expect(cityActivity(19)).toBeGreaterThan(cityActivity(4) * 3);
    for (let h = 0; h < 24; h += .25) expect(Math.abs(cityActivity(h + .25) - cityActivity(h))).toBeLessThan(.12);
  });
  it('never sounds two horns within the cooldown', () => {
    const horns = new HornScheduler(() => 0, 5); const times: number[] = [];
    for (let t = 0; t < 120; t += .1) if (horns.tick(t, 1)) times.push(t);
    expect(times.length).toBeGreaterThan(5);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(5 - 1e-9);
    const quiet = new HornScheduler(() => 0); expect(Array.from({ length: 600 }, (_, i) => quiet.tick(i * .1, 0)).some(Boolean)).toBe(false);
  });
  it('spaces one-off events by their minimum gap and stops them at rate zero', () => {
    const timer = new EventTimer(3, 1, () => 0); const hits: number[] = [];
    for (let t = 0; t < 30; t += .05) if (timer.tick(t, 5)) hits.push(t);
    for (let i = 1; i < hits.length; i++) expect(hits[i] - hits[i - 1]).toBeGreaterThanOrEqual(1 - 1e-9);
    expect(Array.from({ length: 200 }, (_, i) => timer.tick(30 + i * .1, 0)).some(Boolean)).toBe(false);
  });
  it('steps faster when running and not at all when standing', () => {
    expect(footstepInterval(0)).toBe(Infinity);
    expect(footstepInterval(5)).toBeLessThan(footstepInterval(1.5));
  });
});

describe('sound settings', () => {
  const store = () => { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } }; };
  it('starts off with default levels and round-trips saved levels', () => {
    const s = store(); expect(loadAudioSettings(s)).toEqual(DEFAULT_AUDIO);
    saveAudioSettings({ enabled: true, levels: { ...DEFAULT_AUDIO.levels, traffic: .2 } }, s);
    expect(loadAudioSettings(s)).toEqual({ enabled: true, levels: { ...DEFAULT_AUDIO.levels, traffic: .2 } });
  });
  it('clamps or ignores bad stored values and survives blocked storage', () => {
    const s = store(); s.setItem('hj-audio-v1', JSON.stringify({ enabled: 'yes', levels: { master: 9, ambience: -1, traffic: 'loud' } }));
    expect(loadAudioSettings(s)).toEqual({ enabled: false, levels: { ...DEFAULT_AUDIO.levels, master: 1, ambience: 0 } });
    s.setItem('hj-audio-v1', '{not json'); expect(loadAudioSettings(s)).toEqual(DEFAULT_AUDIO);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadAudioSettings(blocked)).toEqual(DEFAULT_AUDIO); expect(() => saveAudioSettings(DEFAULT_AUDIO, blocked)).not.toThrow();
  });
});
