import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, DISTRICT_IDS, QUEST, districtAt, emptyProgress, loadProgress, questDone, record, saveProgress, type ProgressEvent } from '../src/game/progress';
import { bearing, pickTarget } from '../src/game/World/interactionTargeting';
import { CORRECT_FIELD, FIELD_CANDIDATES, finiteDifferenceCheck } from '../src/research/gradientCheck';
import { TOURS } from '../src/data/tours';
import { DEPARTURES } from '../src/data/departures';
import { districts } from '../src/data/city';
import { streetStops } from '../src/game/World/streetLayout';

const play = (...events: ProgressEvent[]) => events.reduce((p, e) => record(p, e).progress, emptyProgress());

describe('progress', () => {
  it('unlocks each achievement once and reports it when earned', () => {
    let p = emptyProgress();
    const first = record(p, { type: 'discover', id: 'cst-board' }); p = first.progress;
    expect(first.unlocked.map(a => a.id)).toEqual(['first-steps']);
    const again = record(p, { type: 'discover', id: 'cst' });
    expect(again.unlocked).toEqual([]);
    expect(again.progress.achievements).toEqual(['first-steps']);
  });
  it('returns the same object when an event changes nothing', () => {
    const p = play({ type: 'visit', district: 'cst' });
    expect(record(p, { type: 'visit', district: 'cst' }).progress).toBe(p);
  });
  it('requires all nine districts for City Explorer', () => {
    const eight = play(...DISTRICT_IDS.slice(0, 8).map(district => ({ type: 'visit', district }) as ProgressEvent));
    expect(eight.achievements).not.toContain('city-explorer');
    expect(record(eight, { type: 'visit', district: 'filmcity' }).progress.achievements).toContain('city-explorer');
  });
  it('counts rides and completes the quest only after all five stops', () => {
    expect(play({ type: 'ride-complete' }).achievements).toEqual(['kaali-peeli']);
    const four = play(...['fort-source', 'bkc', 'northstar', 'andheri'].map(id => ({ type: 'discover', id }) as ProgressEvent));
    expect(questDone(four)).toBe(false);
    expect(questDone(record(four, { type: 'discover', id: 'juhu' }).progress)).toBe(true);
    expect(QUEST.steps).toHaveLength(5);
  });
  it('treats the research end of the CST street as Fort', () => {
    expect(districtAt('cst', 8)).toBe('cst'); expect(districtAt('cst', -35)).toBe('fort'); expect(districtAt('bkc', -35)).toBe('bkc');
  });
  it('round-trips through storage and ignores damaged data', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const p = play({ type: 'discover', id: 'cst' }, { type: 'orientation', step: 'walk' }, { type: 'ride-complete' });
    saveProgress(p, storage); expect(loadProgress(storage)).toEqual(p);
    store.set('hj-progress-v1', '{"version":1,"visited":[3,"bkc"],"achievements":["made-up"],"orientation":["fly"],"rides":"x"}');
    expect(loadProgress(storage)).toMatchObject({ visited: ['bkc'], achievements: [], orientation: [], rides: 0 });
    store.set('hj-progress-v1', 'not json'); expect(loadProgress(storage)).toEqual(emptyProgress());
    expect(loadProgress(null)).toEqual(emptyProgress());
  });
  it('gives every achievement a unique id', () => { expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length); });
});

describe('interaction targeting', () => {
  const eye = { x: 0, y: 1.7, z: 0 };
  const targets = [{ id: 'screen', position: { x: -.6, y: 1.25, z: -1.8 } }, { id: 'panel', position: { x: .9, y: 1.9, z: -2.6 } }, { id: 'behind', position: { x: 0, y: 1.5, z: 3 } }];
  it('follows the gaze between neighbouring exhibits', () => {
    expect(pickTarget(eye, { x: -.3, y: -.2, z: -1 }, targets)?.id).toBe('screen');
    expect(pickTarget(eye, { x: .33, y: .07, z: -1 }, targets)?.id).toBe('panel');
  });
  it('ignores targets out of reach, behind the visitor or not visible', () => {
    expect(pickTarget(eye, { x: 0, y: 0, z: 1 }, targets.slice(0, 2))).toBeNull();
    expect(pickTarget(eye, { x: 0, y: 0, z: -1 }, [{ id: 'far', position: { x: 0, y: 1.5, z: -5 } }])).toBeNull();
    expect(pickTarget(eye, { x: 0, y: 0, z: -1 }, targets, t => t.id !== 'screen' && t.id !== 'panel')).toBeNull();
  });
  it('accepts a target beside the visitor at close range', () => {
    expect(pickTarget(eye, { x: 0, y: 0, z: -1 }, [{ id: 'guide', position: { x: 1.2, y: 1.4, z: .3 } }])?.id).toBe('guide');
  });
  it('measures bearing with positive angles to the left', () => {
    expect(bearing({ x: 0, z: 0 }, 0, { x: 0, z: -10 }).angle).toBeCloseTo(0);
    expect(bearing({ x: 0, z: 0 }, 0, { x: -10, z: 0 }).angle).toBeCloseTo(Math.PI / 2);
    expect(bearing({ x: 0, z: 0 }, Math.PI / 2, { x: -10, z: 0 }).angle).toBeCloseTo(0);
    expect(bearing({ x: 3, z: 4 }, 0, { x: 0, z: 0 }).distance).toBeCloseTo(5);
  });
});

describe('Fort gradient check', () => {
  it('passes only the correct quadrupole field', () => {
    const results = FIELD_CANDIDATES.map(c => finiteDifferenceCheck(c));
    expect(results.filter(r => r.passed).map(r => r.candidate)).toEqual([CORRECT_FIELD]);
    for (const r of results.filter(r => !r.passed)) expect(r.maxRelativeError).toBeGreaterThan(1e-2);
    expect(results.find(r => r.passed)!.maxRelativeError).toBeLessThan(1e-6);
  });
  it('does not put the correct answer first', () => { expect(FIELD_CANDIDATES[0].id).not.toBe(CORRECT_FIELD); });
});

describe('tours and departures', () => {
  it('only points at real places and exhibits', () => {
    for (const tour of Object.values(TOURS)) for (const step of tour.steps) {
      if (step.exhibit) expect(['fort-field', 'fort-source', 'fort-gradient', 'fort-panel-0', 'fort-panel-1', 'fort-panel-2', 'fort-workstation', 'cst-board', 'ffprime']).toContain(step.exhibit);
      if (step.next) expect(districts.map(d => d.id)).toContain(step.next);
    }
  });
  it('lists every other district once with a reachable stop', () => {
    expect(DEPARTURES.map(d => d.district).sort()).toEqual(districts.filter(d => d.id !== 'cst').map(d => d.id).sort());
    for (const d of DEPARTURES) expect(streetStops[d.district]).toBeTruthy();
  });
});
