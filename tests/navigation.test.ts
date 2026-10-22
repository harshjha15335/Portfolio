import { describe, expect, it } from 'vitest';
import { filterCommands, readRoute, type Command } from '../src/utils/navigation';

describe('hash routing', () => {
  it.each(['', '#', '#/', '#unknown'])('returns intro for %s', hash => {
    expect(readRoute(hash)).toEqual({ mode: 'intro', project: null });
  });
  it.each(['#world', '#/world'])('opens world for %s', hash => {
    expect(readRoute(hash)).toEqual({ mode: 'world', project: null });
  });
  it.each(['#quick', '#about', '#projects'])('sends the retired one-page view (%s) to the intro', hash => {
    expect(readRoute(hash)).toEqual({ mode: 'intro', project: null });
  });
  it('decodes project URLs including encoded Unicode', () => {
    expect(readRoute('#/project/ffprime')).toEqual({ mode: 'world', project: 'ffprime' });
    expect(readRoute('#project/caf%C3%A9')).toEqual({ mode: 'world', project: 'café' });
  });
  it('does not crash when a shared hash has invalid encoding', () => {
    expect(() => readRoute('#/project/%E0%A4%A')).not.toThrow();
  });
});

describe('command search', () => {
  const commands: Command[] = [
    { id: 'ffprime', label: 'FFprime', detail: 'Scientific computing', keywords: 'Python NumPy multipoles', action: () => {} },
    { id: 'northstar', label: 'NORTHSTAR', detail: 'AI market research', keywords: 'React TypeScript FastAPI', action: () => {} },
    { id: 'resume', label: 'Open résumé', detail: 'Download PDF', keywords: 'resume cv', action: () => {} },
  ];
  it('matches all query words across labels, details, and skills', () => {
    expect(filterCommands(commands, '  PYTHON scientific  ').map(command => command.id)).toEqual(['ffprime']);
    expect(filterCommands(commands, 'research typescript').map(command => command.id)).toEqual(['northstar']);
    expect(filterCommands(commands, 'python react')).toEqual([]);
  });
  it('preserves ordering and leaves original command data unchanged', () => {
    expect(filterCommands(commands, '  ')).toEqual(commands);
    expect(filterCommands(commands, 'resume')[0]).toBe(commands[2]);
    expect(commands.map(command => command.id)).toEqual(['ffprime', 'northstar', 'resume']);
  });
});
