/**
 * Interface sound cues, sent from anywhere (HTML panels, achievements) without importing the 3D engine. A cue does
 * nothing unless the visitor has turned city sound on; the world's soundscape subscribes while it is running.
 */
export type CueKind = 'open' | 'close' | 'interact' | 'achievement' | 'map' | 'journal' | 'quest' | 'meter-hire' | 'arrive' | 'demo';
type Listener = (kind: CueKind) => void;
const listeners = new Set<Listener>();
export function playCue(kind: CueKind) { for (const listener of listeners) listener(kind); }
export function onCue(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
