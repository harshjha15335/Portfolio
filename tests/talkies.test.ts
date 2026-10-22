import { describe, expect, it } from 'vitest';
import { TALKIES_SEATS, TalkiesAudience, TalkiesScreen, VISITOR_SEAT, insideHall } from '../src/game/World/districts/TalkiesHouse';
import { OVATION_SECONDS, applauseBuffer } from '../src/core/audio/applause';
import { FILM } from '../src/data/film';

describe('Film City Talkies show night', () => {
  it('seats every chair of the ten-row hall', () => {
    expect(TALKIES_SEATS).toHaveLength(140);
    expect(TALKIES_SEATS.every(s => insideHall(s.x, s.z))).toBe(true);
    // The centre aisle stays clear for the visitor.
    expect(TALKIES_SEATS.some(s => s.z > 1 && s.z < 5)).toBe(false);
  });
  it('waits for the cast before building an audience, and hides it outside the hall', () => {
    const audience = new TalkiesAudience();
    expect(audience.build(null)).toBe(false);
    audience.update({ x: 0, y: 1.6, z: 0 } as never);
    expect(audience.group.visible).toBe(false);
  });
  it('keeps the screen dark until the visitor is in the hall', () => {
    const screen = new TalkiesScreen();
    screen.update({ x: 0, y: 1.6, z: 0 } as never);
    expect(screen.mesh.visible).toBe(false); expect(screen.playing).toBe(false);
    screen.dispose();
  });
  it('ships the full film with a poster, captions and two codecs', () => {
    expect(FILM.sources.map(s => s.src)).toEqual(['/media/talkies-film.mp4', '/media/talkies-film.webm']);
    expect(FILM.poster).toMatch(/\.jpg$/); expect(FILM.captions).toMatch(/\.vtt$/);
  });
  it('keeps one aisle seat for the visitor in an otherwise full house', () => {
    expect(TALKIES_SEATS.filter(s => Math.abs(s.x - VISITOR_SEAT.x) < .01 && Math.abs(s.z - VISITOR_SEAT.z) < .01)).toHaveLength(1);
    // On the aisle: the seat next to it towards the centre is the aisle itself.
    expect(TALKIES_SEATS.some(s => Math.abs(s.x - VISITOR_SEAT.x) < .01 && s.z > VISITOR_SEAT.z && s.z < 1)).toBe(false);
  });
  it('synthesises the standing ovation: applause that swells, holds and dies away', () => {
    const rate = 8000, channels = [0, 1].map(() => new Float32Array(rate * OVATION_SECONDS));
    const context = { sampleRate: rate, createBuffer: (_n: number, length: number) => ({ length, getChannelData: (c: number) => channels[c] }) } as unknown as BaseAudioContext;
    const buffer = applauseBuffer(context);
    expect(buffer.length).toBe(rate * OVATION_SECONDS);
    const energy = (from: number, to: number) => { let e = 0; for (let i = from * rate; i < to * rate; i++) e += channels[0][i] ** 2 + channels[1][i] ** 2; return e / ((to - from) * rate); };
    expect(energy(2, 4)).toBeGreaterThan(energy(0, .3) * 2);
    expect(energy(2, 4)).toBeGreaterThan(energy(OVATION_SECONDS - .4, OVATION_SECONDS) * 4);
    expect(Math.max(...channels[0].map(Math.abs))).toBeLessThan(1);
    expect(applauseBuffer(context)).toBe(buffer);
  });
});
