/**
 * Tests for InteractiveRepl.
 *
 * Covers REPL construction, alias management, built-in command handling,
 * input parsing (quoted strings), and tab completion.
 *
 * Because InteractiveRepl.start() creates a readline interface bound to
 * process.stdin and awaits a close event, we test its public API and
 * private helpers via the exposed surface and carefully scoped mocks.
 */

import { InteractiveRepl } from '../../../src/framework/interactive-repl';
import { CommandRegistry } from '../../../src/framework/command-registry';
import type { CommandDefinition, CommandCategory } from '../../../src/framework/command-interface';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommand(
  overrides: Partial<CommandDefinition> = {},
): CommandDefinition {
  return {
    name: overrides.name ?? 'test-cmd',
    description: overrides.description ?? 'A test command',
    execute: jest.fn().mockResolvedValue({ exitCode: 0 }),
    ...overrides,
  };
}

function createRepl(
  commands: Partial<CommandDefinition>[] = [],
  replOptions: ConstructorParameters<typeof InteractiveRepl>[1] = {},
): { repl: InteractiveRepl; registry: CommandRegistry } {
  const registry = new CommandRegistry({ strict: false });
  for (const cmd of commands) {
    registry.register(makeCommand(cmd));
  }
  const repl = new InteractiveRepl(registry, replOptions);
  return { repl, registry };
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('InteractiveRepl', () => {
  // ----- Construction -----

  describe('constructor', () => {
    it('should create a REPL with default settings', () => {
      const { repl } = createRepl();
      expect(repl).toBeDefined();
    });

    it('should merge custom aliases with defaults', () => {
      const { repl } = createRepl([], {
        aliases: { 'd': 'deploy' },
      });

      const aliases = repl.getAliases();
      // Custom alias
      expect(aliases['d']).toBe('deploy');
      // Default aliases still present
      expect(aliases['q']).toBe('quit');
      expect(aliases['h']).toBe('help');
    });
  });

  // ----- Alias management -----

  describe('aliases', () => {
    it('should have default aliases', () => {
      const { repl } = createRepl();
      const aliases = repl.getAliases();

      expect(aliases['s']).toBe('status');
      expect(aliases['q']).toBe('quit');
      expect(aliases['h']).toBe('help');
      expect(aliases['?']).toBe('help');
      expect(aliases['ls']).toBe('list');
      expect(aliases['ll']).toBe('list --verbose');
      expect(aliases['cls']).toBe('clear');
    });

    it('should add new aliases at runtime', () => {
      const { repl } = createRepl();

      repl.addAlias('dp', 'deploy');

      expect(repl.getAliases()['dp']).toBe('deploy');
    });

    it('should override existing aliases', () => {
      const { repl } = createRepl();

      repl.addAlias('h', 'history');

      expect(repl.getAliases()['h']).toBe('history');
    });

    it('should override default aliases via constructor options', () => {
      const { repl } = createRepl([], {
        aliases: { 's': 'serve' },
      });

      expect(repl.getAliases()['s']).toBe('serve');
    });

    it('should return aliases as a read-only record', () => {
      const { repl } = createRepl();
      const aliases = repl.getAliases();

      expect(typeof aliases).toBe('object');
      expect(aliases).toHaveProperty('q');
    });
  });

  // ----- Private helper access via prototype -----
  // We access private methods via bracket notation for focused unit tests.

  describe('parseInput (private)', () => {
    it('should split simple whitespace-separated tokens', () => {
      const { repl } = createRepl();
      const parse = (repl as any).parseInput.bind(repl);

      expect(parse('deploy prod')).toEqual(['deploy', 'prod']);
    });

    it('should handle multiple spaces', () => {
      const { repl } = createRepl();
      const parse = (repl as any).parseInput.bind(repl);

      expect(parse('deploy   prod')).toEqual(['deploy', 'prod']);
    });

    it('should handle tabs', () => {
      const { repl } = createRepl();
      const parse = (repl as any).parseInput.bind(repl);

      expect(parse('deploy\tprod')).toEqual(['deploy', 'prod']);
    });

    it('should preserve quoted strings as single tokens', () => {
      const { repl } = createRepl();
      const parse = (repl as any).parseInput.bind(repl);

      expect(parse('deploy "my app" prod')).toEqual(['deploy', 'my app', 'prod']);
    });

    it('should handle single-quoted strings', () => {
      const { repl } = createRepl();
      const parse = (repl as any).parseInput.bind(repl);

      expect(parse("deploy 'my app' prod")).toEqual(['deploy', 'my app', 'prod']);
    });

    it('should return empty array for empty input', () => {
      const { repl } = createRepl();
      const parse = (repl as any).parseInput.bind(repl);

      expect(parse('')).toEqual([]);
    });

    it('should handle only whitespace', () => {
      const { repl } = createRepl();
      const parse = (repl as any).parseInput.bind(repl);

      expect(parse('   ')).toEqual([]);
    });
  });

  describe('camelCase (private)', () => {
    it('should convert kebab-case to camelCase', () => {
      const { repl } = createRepl();
      const camelCase = (repl as any).camelCase.bind(repl);

      expect(camelCase('dry-run')).toBe('dryRun');
      expect(camelCase('no-color')).toBe('noColor');
      expect(camelCase('my-long-option')).toBe('myLongOption');
    });

    it('should leave non-kebab strings unchanged', () => {
      const { repl } = createRepl();
      const camelCase = (repl as any).camelCase.bind(repl);

      expect(camelCase('verbose')).toBe('verbose');
      expect(camelCase('')).toBe('');
    });
  });

  describe('resolveAlias (private)', () => {
    it('should expand a known alias', () => {
      const { repl } = createRepl([], { aliases: { 'd': 'deploy' } });
      const resolve = (repl as any).resolveAlias.bind(repl);

      expect(resolve('d --force')).toBe('deploy --force');
    });

    it('should pass through unknown aliases unchanged', () => {
      const { repl } = createRepl();
      const resolve = (repl as any).resolveAlias.bind(repl);

      expect(resolve('deploy --force')).toBe('deploy --force');
    });

    it('should expand default alias "ll" to "list --verbose"', () => {
      const { repl } = createRepl();
      const resolve = (repl as any).resolveAlias.bind(repl);

      expect(resolve('ll')).toBe('list --verbose');
    });

    it('should append extra args after expanded alias', () => {
      const { repl } = createRepl();
      const resolve = (repl as any).resolveAlias.bind(repl);

      expect(resolve('ll --json')).toBe('list --verbose --json');
    });
  });

  describe('levenshtein (private)', () => {
    it('should return 0 for identical strings', () => {
      const { repl } = createRepl();
      const lev = (repl as any).levenshtein.bind(repl);

      expect(lev('deploy', 'deploy')).toBe(0);
    });

    it('should return string length for empty comparison', () => {
      const { repl } = createRepl();
      const lev = (repl as any).levenshtein.bind(repl);

      expect(lev('abc', '')).toBe(3);
      expect(lev('', 'abc')).toBe(3);
    });

    it('should compute correct edit distance', () => {
      const { repl } = createRepl();
      const lev = (repl as any).levenshtein.bind(repl);

      expect(lev('kitten', 'sitting')).toBe(3);
      expect(lev('deploy', 'delpoy')).toBe(2);
    });
  });

  describe('handleBuiltinCommand (private)', () => {
    let stderrSpy: jest.SpyInstance;

    beforeEach(() => {
      stderrSpy = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    });

    afterEach(() => {
      stderrSpy.mockRestore();
    });

    it('should return true for "help"', () => {
      const { repl } = createRepl([
        { name: 'deploy', description: 'Deploy' },
      ]);
      const handle = (repl as any).handleBuiltinCommand.bind(repl);

      expect(handle('help')).toBe(true);
    });

    it('should return true for "?"', () => {
      const { repl } = createRepl();
      const handle = (repl as any).handleBuiltinCommand.bind(repl);

      expect(handle('?')).toBe(true);
    });

    it('should return true for "history"', () => {
      const { repl } = createRepl();
      const handle = (repl as any).handleBuiltinCommand.bind(repl);

      expect(handle('history')).toBe(true);
    });

    it('should return true for "aliases"', () => {
      const { repl } = createRepl();
      const handle = (repl as any).handleBuiltinCommand.bind(repl);

      expect(handle('aliases')).toBe(true);
    });

    it('should return true for "clear" and "cls"', () => {
      const { repl } = createRepl();
      const handle = (repl as any).handleBuiltinCommand.bind(repl);

      expect(handle('clear')).toBe(true);
      expect(handle('cls')).toBe(true);
    });

    it('should return true for "quit" and "exit"', () => {
      const { repl } = createRepl();
      const handle = (repl as any).handleBuiltinCommand.bind(repl);

      // quit/exit call stop() which checks this.running; since we never
      // started, running is false so stop() is a no-op and we still get true
      expect(handle('quit')).toBe(true);
      expect(handle('exit')).toBe(true);
    });

    it('should return false for unknown commands', () => {
      const { repl } = createRepl();
      const handle = (repl as any).handleBuiltinCommand.bind(repl);

      expect(handle('deploy')).toBe(false);
      expect(handle('unknown')).toBe(false);
    });

    it('should be case-insensitive', () => {
      const { repl } = createRepl();
      const handle = (repl as any).handleBuiltinCommand.bind(repl);

      expect(handle('HELP')).toBe(true);
      expect(handle('Quit')).toBe(true);
      expect(handle('CLEAR')).toBe(true);
    });
  });

  describe('findCommand (private)', () => {
    it('should find a command by direct name', () => {
      const { repl } = createRepl([
        { name: 'deploy', description: 'Deploy' },
      ]);
      const find = (repl as any).findCommand.bind(repl);

      const cmd = find('deploy');
      expect(cmd).toBeDefined();
      expect(cmd.name).toBe('deploy');
    });

    it('should find a command by alias', () => {
      const { repl } = createRepl([
        { name: 'deploy', description: 'Deploy', aliases: ['dp'] },
      ]);
      const find = (repl as any).findCommand.bind(repl);

      const cmd = find('dp');
      expect(cmd).toBeDefined();
      expect(cmd.name).toBe('deploy');
    });

    it('should return undefined for unknown names', () => {
      const { repl } = createRepl([
        { name: 'deploy', description: 'Deploy' },
      ]);
      const find = (repl as any).findCommand.bind(repl);

      expect(find('nonexistent')).toBeUndefined();
    });
  });

  describe('suggestCommands (private)', () => {
    it('should suggest similar command names', () => {
      const { repl } = createRepl([
        { name: 'deploy', description: 'Deploy' },
        { name: 'delete', description: 'Delete' },
        { name: 'status', description: 'Status' },
      ]);
      const suggest = (repl as any).suggestCommands.bind(repl);

      const suggestions = suggest('deplpy');
      expect(suggestions).toContain('deploy');
    });

    it('should return at most 3 suggestions', () => {
      const commands = Array.from({ length: 10 }, (_, i) => ({
        name: `cmd-${i}`,
        description: `Command ${i}`,
      }));
      const { repl } = createRepl(commands);
      const suggest = (repl as any).suggestCommands.bind(repl);

      const suggestions = suggest('cmd');
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('completer (private)', () => {
    it('should complete command names on first word', () => {
      const { repl } = createRepl([
        { name: 'deploy', description: 'Deploy' },
        { name: 'status', description: 'Status' },
      ]);
      const completer = (repl as any).completer.bind(repl);

      const [completions, current] = completer('dep');
      expect(completions).toContain('deploy');
      expect(current).toBe('dep');
    });

    it('should include built-in commands in completions', () => {
      const { repl } = createRepl();
      const completer = (repl as any).completer.bind(repl);

      const [completions] = completer('');
      expect(completions).toContain('help');
      expect(completions).toContain('quit');
      expect(completions).toContain('exit');
      expect(completions).toContain('clear');
      expect(completions).toContain('history');
      expect(completions).toContain('aliases');
    });

    it('should include alias names in completions', () => {
      const { repl } = createRepl([], {
        aliases: { 'dp': 'deploy' },
      });
      const completer = (repl as any).completer.bind(repl);

      const [completions] = completer('d');
      expect(completions).toContain('dp');
    });

    it('should complete options for a known command', () => {
      const { repl } = createRepl([
        {
          name: 'deploy',
          description: 'Deploy',
          options: [
            { flags: '-e, --env <name>', description: 'Env' },
            { flags: '--force', description: 'Force' },
          ],
        },
      ]);
      const completer = (repl as any).completer.bind(repl);

      const [completions] = completer('deploy --');
      expect(completions).toContain('--env');
      expect(completions).toContain('--force');
      // Global options should also be present
      expect(completions).toContain('--verbose');
      expect(completions).toContain('--help');
    });

    it('should complete subcommands for a known command', () => {
      const { repl } = createRepl([
        {
          name: 'agent',
          description: 'Agent',
          subcommands: [
            makeCommand({ name: 'list', description: 'List' }),
            makeCommand({ name: 'spawn', description: 'Spawn' }),
          ],
        },
      ]);
      const completer = (repl as any).completer.bind(repl);

      const [completions] = completer('agent l');
      expect(completions).toContain('list');
    });

    it('should return empty when no matches for option prefix', () => {
      const { repl } = createRepl([
        { name: 'deploy', description: 'Deploy' },
      ]);
      const completer = (repl as any).completer.bind(repl);

      // no options defined for deploy, but current starts with --
      // Still returns global options
      const [completions] = completer('deploy --z');
      // None of the global options start with --z
      expect(completions.every((c: string) => c.startsWith('--z'))).toBe(true);
    });
  });

  describe('recordHistory (private)', () => {
    it('should add an entry to history', () => {
      const { repl } = createRepl();
      const record = (repl as any).recordHistory.bind(repl);
      const getHistory = () => (repl as any).history;

      record('deploy', true, 100);

      expect(getHistory()).toHaveLength(1);
      expect(getHistory()[0].command).toBe('deploy');
      expect(getHistory()[0].success).toBe(true);
      expect(getHistory()[0].duration).toBe(100);
    });

    it('should trim history to maxHistory', () => {
      const { repl } = createRepl([], { maxHistory: 3 });
      const record = (repl as any).recordHistory.bind(repl);
      const getHistory = () => (repl as any).history;

      record('cmd1', true, 10);
      record('cmd2', true, 10);
      record('cmd3', true, 10);
      record('cmd4', true, 10);

      expect(getHistory()).toHaveLength(3);
      expect(getHistory()[0].command).toBe('cmd2');
    });
  });
});
