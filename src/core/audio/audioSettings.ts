/** City sound settings, kept in this browser only. Sound always starts off until the visitor turns it on. */
export type AudioBus = 'ambience' | 'traffic' | 'effects' | 'interface';
export type AudioLevels = { master: number } & Record<AudioBus, number>;
export type AudioSettings = { enabled: boolean; levels: AudioLevels };
export const AUDIO_BUSES: { id: AudioBus; label: string }[] = [
  { id: 'ambience', label: 'City ambience' }, { id: 'traffic', label: 'Traffic and vehicles' }, { id: 'effects', label: 'Footsteps and effects' }, { id: 'interface', label: 'Interface cues' },
];
export const DEFAULT_AUDIO: AudioSettings = { enabled: false, levels: { master: .7, ambience: .8, traffic: .7, effects: .8, interface: .6 } };
const KEY = 'hj-audio-v1';
const clamp = (v: unknown, d: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d;
export function loadAudioSettings(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): AudioSettings {
  try {
    const raw = storage?.getItem(KEY); if (!raw) return structuredClone(DEFAULT_AUDIO);
    const v = JSON.parse(raw) as Partial<AudioSettings>; const l = (v.levels ?? {}) as Partial<AudioLevels>, d = DEFAULT_AUDIO.levels;
    return { enabled: v.enabled === true, levels: { master: clamp(l.master, d.master), ambience: clamp(l.ambience, d.ambience), traffic: clamp(l.traffic, d.traffic), effects: clamp(l.effects, d.effects), interface: clamp(l.interface, d.interface) } };
  } catch { return structuredClone(DEFAULT_AUDIO); }
}
export function saveAudioSettings(settings: AudioSettings, storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(settings)); } catch { /* private window or blocked storage: settings last for this visit */ }
}
