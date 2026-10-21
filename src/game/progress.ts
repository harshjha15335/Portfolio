/**
 * Exploration journal, achievements and the "Discover the Engineer" quest.
 * Pure state: the UI records events, this module decides what they unlock.
 * Nothing here gates portfolio content; it only remembers what a visitor has seen.
 */
import { projects } from '../data/projects';

export interface Progress {
  version: 1;
  /** Districts the visitor has physically stood in (or arrived at by ride or jump). */
  visited: string[];
  /** Things the visitor opened: exhibits, guides, projects, the departure board, the theatre ending. */
  discovered: string[];
  /** Achievement ids in the order they were earned. */
  achievements: string[];
  /** Orientation steps completed. */
  orientation: OrientationStep[];
  orientationDismissed: boolean;
  rides: number;
}

export type OrientationStep = 'look' | 'walk' | 'interact' | 'map' | 'ride';
export const ORIENTATION_STEPS: { id: OrientationStep; label: string; hint: string }[] = [
  { id: 'look', label: 'Look around', hint: 'Click the street, then move the mouse (or drag)' },
  { id: 'walk', label: 'Walk a few steps', hint: 'W A S D or the arrow keys · Shift to run · Space to jump' },
  { id: 'interact', label: 'Talk or inspect', hint: 'Face Harsh at the station or the departure board and press E' },
  { id: 'map', label: 'Open the city map', hint: 'Press M' },
  { id: 'ride', label: 'Hail a ride', hint: 'Use the taxi or auto stand, or HAIL TAXI / HAIL AUTO' },
];

export type ProgressEvent =
  | { type: 'visit'; district: string }
  | { type: 'discover'; id: string }
  | { type: 'ride-complete' }
  | { type: 'orientation'; step: OrientationStep }
  | { type: 'dismiss-orientation' };

/** The nine canonical districts. Fort shares the CST street but counts as its own stop. */
export const DISTRICT_IDS = ['cst', 'fort', 'bkc', 'andheri', 'powai', 'dadar', 'worli', 'juhu', 'filmcity'] as const;
/** Powai's flagship projects (everything except FFprime, which lives at Fort), plus the ASTFLOW lab. */
const FLAGSHIPS = [...projects.filter(p => p.id !== 'ffprime').map(p => p.id), 'astflow'];

export interface Achievement { id: string; title: string; detail: string; earned: (p: Progress) => boolean }
const has = (p: Progress, id: string) => p.discovered.includes(id);
const any = (p: Progress, prefix: string) => p.discovered.some(id => id.startsWith(prefix));
const count = (p: Progress, pattern: RegExp) => new Set(p.discovered.filter(id => pattern.test(id))).size;
/** Activities record `<exhibit>:solved` when finished, separately from opening the exhibit. */
const solved = (p: Progress, id: string) => has(p, `${id}:solved`);
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-steps', title: 'First Steps', detail: 'Met Harsh at the station or read the CST departure board.', earned: p => has(p, 'cst') || has(p, 'cst-board') },
  { id: 'research-explorer', title: 'Open Source Explorer', detail: 'Followed the five reviewed FFprime pull requests at Fort.', earned: p => has(p, 'fort-source') },
  { id: 'gradient-check', title: 'Finite Differences', detail: 'Found the field implementation that passes the gradient check.', earned: p => solved(p, 'fort-gradient') },
  { id: 'systems-thinker', title: 'Systems Thinker', detail: 'Ingested every page at BKC without a single 429.', earned: p => solved(p, 'bkc-ratelimit') },
  { id: 'skill-collector', title: 'Skill Collector', detail: 'Visited three skill shops at the Andheri Tech Bazaar.', earned: p => count(p, /^andheri-shop-/) >= 3 },
  { id: 'builder', title: 'Builder', detail: 'Opened a flagship project in Powai.', earned: p => FLAGSHIPS.some(id => has(p, id)) },
  { id: 'time-traveler', title: 'Time Traveler', detail: 'Read all six Dadar platforms of the journey.', earned: p => count(p, /^dadar-stop-\d$/) >= 6 },
  { id: 'receipts', title: 'Receipts Checked', detail: 'Named the evidence behind all four claims on the Worli Proof Deck.', earned: p => count(p, /^worli-case-\d:solved$/) >= 4 },
  { id: 'say-hello', title: 'Said Hello', detail: 'Used the contact terminal at Juhu Studio.', earned: p => has(p, 'juhu-contact') },
  { id: 'kaali-peeli', title: 'Kaali-Peeli Regular', detail: 'Finished a metered taxi or auto ride.', earned: p => p.rides > 0 },
  { id: 'film-buff', title: 'Film Buff', detail: 'Reached the final scene at Film City Talkies.', earned: p => has(p, 'theatre-end') },
  { id: 'city-explorer', title: 'City Explorer', detail: 'Stood in all nine districts.', earned: p => DISTRICT_IDS.every(id => p.visited.includes(id)) },
];

export const QUEST = {
  id: 'discover-the-engineer',
  title: 'Discover the Engineer',
  steps: [
    { id: 'fort', label: 'Follow the open-source work at Fort', done: (p: Progress) => has(p, 'fort-source') || has(p, 'fort-tour') },
    { id: 'bkc', label: 'Inspect the BKC Systems Office', done: (p: Progress) => has(p, 'bkc') || any(p, 'bkc-') },
    { id: 'powai', label: 'Explore one Powai project', done: (p: Progress) => FLAGSHIPS.some(id => has(p, id)) },
    { id: 'andheri', label: 'Visit the Andheri Tech Bazaar', done: (p: Progress) => has(p, 'andheri') || any(p, 'andheri-shop-') },
    { id: 'juhu', label: 'Finish at Juhu Studio', done: (p: Progress) => has(p, 'juhu') || any(p, 'juhu-') },
  ],
};
export const questDone = (p: Progress) => QUEST.steps.every(step => step.done(p));
/** The first quest step still open: what the map shows as the active objective (null once the quest is done). */
export const nextObjective = (p: Progress) => { const i = QUEST.steps.findIndex(step => !step.done(p)); return i < 0 ? null : { ...QUEST.steps[i], index: i, total: QUEST.steps.length }; };

export const emptyProgress = (): Progress => ({ version: 1, visited: [], discovered: [], achievements: [], orientation: [], orientationDismissed: false, rides: 0 });

const add = <T,>(list: T[], value: T) => list.includes(value) ? list : [...list, value];

/** Apply one event. Returns the same object when nothing changed, so React can skip re-renders. */
export function record(progress: Progress, event: ProgressEvent): { progress: Progress; unlocked: Achievement[] } {
  let next = progress;
  if (event.type === 'visit' && !progress.visited.includes(event.district)) next = { ...progress, visited: add(progress.visited, event.district) };
  if (event.type === 'discover' && !progress.discovered.includes(event.id)) next = { ...progress, discovered: add(progress.discovered, event.id) };
  if (event.type === 'ride-complete') next = { ...progress, rides: progress.rides + 1 };
  if (event.type === 'orientation' && !progress.orientation.includes(event.step)) next = { ...progress, orientation: add(progress.orientation, event.step) };
  if (event.type === 'dismiss-orientation' && !progress.orientationDismissed) next = { ...progress, orientationDismissed: true };
  if (next === progress) return { progress, unlocked: [] };
  const unlocked = ACHIEVEMENTS.filter(a => !next.achievements.includes(a.id) && a.earned(next));
  if (unlocked.length) next = { ...next, achievements: [...next.achievements, ...unlocked.map(a => a.id)] };
  return { progress: next, unlocked };
}

/** Which district a world position belongs to. Fort is the open-source end of the CST street. */
export function districtAt(zoneId: string, z: number) { return zoneId === 'cst' && z < -24 ? 'fort' : zoneId; }

const KEY = 'hj-progress-v1';
const strings = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
export function loadProgress(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): Progress {
  try {
    const raw = storage?.getItem(KEY); if (!raw) return emptyProgress();
    const data = JSON.parse(raw) as Partial<Progress>;
    if (data.version !== 1) return emptyProgress();
    const steps = ORIENTATION_STEPS.map(s => s.id);
    return { version: 1, visited: strings(data.visited), discovered: strings(data.discovered), achievements: strings(data.achievements).filter(id => ACHIEVEMENTS.some(a => a.id === id)),
      orientation: strings(data.orientation).filter((s): s is OrientationStep => steps.includes(s as OrientationStep)), orientationDismissed: data.orientationDismissed === true, rides: Number.isFinite(data.rides) ? Math.max(0, Number(data.rides)) : 0 };
  } catch { return emptyProgress(); }
}
export function saveProgress(progress: Progress, storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(progress)); } catch { /* Browser storage is optional; progress just won't persist. */ }
}
