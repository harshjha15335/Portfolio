import { describe, expect, it } from 'vitest';
import { etaText } from '../src/ui/RideMeter';

describe('hailed cab ETA text', () => {
  it('rounds so it settles, and says when the cab is pulling up', () => {
    expect(etaText(2)).toBe('pulling up now');
    expect(etaText(5)).toBe('about 5 s away');
    expect(etaText(23)).toBe('about 25 s away');
    expect(etaText(58)).toBe('about 60 s away');
    expect(etaText(95)).toBe('about 1.5 min away');
  });
});
