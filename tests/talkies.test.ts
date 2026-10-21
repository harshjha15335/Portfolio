import { describe, expect, it } from 'vitest';
import { TALKIES_SEATS, TalkiesAudience, TalkiesScreen, insideHall } from '../src/game/World/districts/TalkiesHouse';
import { TRAILER } from '../src/data/trailer';

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
  it('ships the trailer with a poster, captions and two codecs', () => {
    expect(TRAILER.sources.map(s => s.src)).toEqual(['/media/talkies-trailer.mp4', '/media/talkies-trailer.webm']);
    expect(TRAILER.poster).toMatch(/\.jpg$/); expect(TRAILER.captions).toMatch(/\.vtt$/);
  });
});
