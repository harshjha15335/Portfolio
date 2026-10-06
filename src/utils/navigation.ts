export type Mode = 'intro' | 'world' | 'quick';
export function readRoute(hash: string): { mode: Mode; project: string | null; section: string | null; district?: string | null } {
  const value = hash.replace(/^#\/?/, '');
  if (value.startsWith('place/')) return { mode: 'world', project: null, section: null, district: value.slice(6) };
  if (value.startsWith('project/')) {
    try { return { mode: 'quick', project: decodeURIComponent(value.slice(8)), section: null }; }
    catch { return { mode: 'quick', project: null, section: null }; }
  }
  if (value === 'world') return { mode: 'world', project: null, section: null };
  if (value === 'quick' || value === 'about' || value === 'projects') return { mode: 'quick', project: null, section: value === 'quick' ? null : value };
  return { mode: 'intro', project: null, section: null };
}
export interface Command { id: string; label: string; detail: string; keywords: string; action: () => void }
export function filterCommands(commands: Command[], query: string): Command[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return commands.filter(command => words.every(word => `${command.label} ${command.detail} ${command.keywords}`.toLowerCase().includes(word)));
}
