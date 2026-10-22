export type Mode = 'intro' | 'world';
/** `#world`, `#/place/<district>` and `#/project/<id>` open the city (an overlay for the last two); anything else is the intro. */
export function readRoute(hash: string): { mode: Mode; project: string | null; district?: string | null } {
  const value = hash.replace(/^#\/?/, '');
  if (value.startsWith('place/')) return { mode: 'world', project: null, district: value.slice(6) };
  if (value.startsWith('project/')) {
    try { return { mode: 'world', project: decodeURIComponent(value.slice(8)) }; }
    catch { return { mode: 'world', project: null }; }
  }
  if (value === 'world') return { mode: 'world', project: null };
  return { mode: 'intro', project: null };
}
export interface Command { id: string; label: string; detail: string; keywords: string; action: () => void }
export function filterCommands(commands: Command[], query: string): Command[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return commands.filter(command => words.every(word => `${command.label} ${command.detail} ${command.keywords}`.toLowerCase().includes(word)));
}
