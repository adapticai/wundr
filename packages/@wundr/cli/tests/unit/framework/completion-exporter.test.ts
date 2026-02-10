/**
 * Tests for CompletionExporter.
 *
 * Covers shell completion script generation for fish, powershell,
 * plus the delegation to registry for bash/zsh, raw data export,
 * and JSON serialization.
 */

import { CompletionExporter } from '../../../src/framework/completion-exporter';
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

function createExporter(
  commands: Partial<CommandDefinition>[],
  programName = 'wundr',
): { exporter: CompletionExporter; registry: CommandRegistry } {
  const registry = new CommandRegistry({ strict: false });
  for (const cmd of commands) {
    registry.register(makeCommand(cmd));
  }
  const exporter = new CompletionExporter(registry, programName);
  return { exporter, registry };
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('CompletionExporter', () => {
  // ----- Bash completion -----

  describe('generate("bash")', () => {
    it('should produce a bash completion script with function and complete directive', () => {
      const { exporter } = createExporter([
        { name: 'deploy', description: 'Deploy the app' },
      ]);

      const script = exporter.generate('bash');

      expect(script).toContain('_wundr_completions');
      expect(script).toContain('complete -F _wundr_completions wundr');
      expect(script).toContain('deploy');
    });

    it('should include global options in bash completion', () => {
      const { exporter } = createExporter([]);

      const script = exporter.generate('bash');

      expect(script).toContain('--verbose');
      expect(script).toContain('--quiet');
      expect(script).toContain('--json');
    });

    it('should use the custom program name', () => {
      const { exporter } = createExporter([], 'mytool');

      const script = exporter.generate('bash');

      expect(script).toContain('_mytool_completions');
      expect(script).toContain('complete -F _mytool_completions mytool');
    });
  });

  // ----- Zsh completion -----

  describe('generate("zsh")', () => {
    it('should produce a zsh completion script with compdef header', () => {
      const { exporter } = createExporter([
        { name: 'status', description: 'Show status' },
      ]);

      const script = exporter.generate('zsh');

      expect(script).toContain('#compdef wundr');
      expect(script).toContain('_wundr()');
      expect(script).toContain('status');
    });

    it('should include global options as _arguments entries', () => {
      const { exporter } = createExporter([]);

      const script = exporter.generate('zsh');

      expect(script).toContain('--verbose');
      expect(script).toContain('--quiet');
      expect(script).toContain('--json');
    });
  });

  // ----- Fish completion -----

  describe('generate("fish")', () => {
    it('should produce a fish completion script', () => {
      const { exporter } = createExporter([
        { name: 'deploy', description: 'Deploy the app' },
      ]);

      const script = exporter.generate('fish');

      expect(script).toContain('# Fish completion for wundr');
      expect(script).toContain('complete -c wundr -f');
      expect(script).toContain("'deploy'");
    });

    it('should include global options', () => {
      const { exporter } = createExporter([]);

      const script = exporter.generate('fish');

      expect(script).toContain('-l verbose');
      expect(script).toContain('-l quiet');
      expect(script).toContain('-l json');
      expect(script).toContain('-l no-color');
      expect(script).toContain('-l dry-run');
      expect(script).toContain('-s h -l help');
      expect(script).toContain('-s v -l version');
    });

    it('should add command-specific options', () => {
      const { exporter } = createExporter([
        {
          name: 'deploy',
          description: 'Deploy',
          options: [
            { flags: '-e, --env <name>', description: 'Target env' },
          ],
        },
      ]);

      const script = exporter.generate('fish');

      expect(script).toContain("__fish_seen_subcommand_from deploy");
      expect(script).toContain("-l 'env'");
    });

    it('should include aliases for commands', () => {
      const { exporter } = createExporter([
        { name: 'deploy', description: 'Deploy', aliases: ['dp'] },
      ]);

      const script = exporter.generate('fish');

      expect(script).toContain("'dp'");
    });

    it('should include subcommand completions', () => {
      const { exporter } = createExporter([
        {
          name: 'agent',
          description: 'Agent management',
          subcommands: [
            makeCommand({ name: 'list', description: 'List agents' }),
            makeCommand({ name: 'spawn', description: 'Spawn agent' }),
          ],
        },
      ]);

      const script = exporter.generate('fish');

      expect(script).toContain("__fish_seen_subcommand_from agent");
      expect(script).toContain("'list'");
      expect(script).toContain("'spawn'");
    });

    it('should exclude hidden commands', () => {
      const { exporter } = createExporter([
        { name: 'visible', description: 'Shown' },
        { name: 'secret', description: 'Hidden', hidden: true },
      ]);

      const script = exporter.generate('fish');

      expect(script).toContain("'visible'");
      expect(script).not.toContain("'secret'");
    });

    it('should handle option choices with -xa flag', () => {
      const { exporter } = createExporter([
        {
          name: 'deploy',
          description: 'Deploy',
          options: [
            { flags: '--env <name>', description: 'Env', choices: ['dev', 'staging', 'prod'] },
          ],
        },
      ]);

      const script = exporter.generate('fish');

      expect(script).toContain("-xa 'dev staging prod'");
    });

    it('should escape single quotes in descriptions', () => {
      const { exporter } = createExporter([
        { name: 'test', description: "It's a test command" },
      ]);

      const script = exporter.generate('fish');

      expect(script).toContain("\\'");
    });
  });

  // ----- PowerShell completion -----

  describe('generate("powershell")', () => {
    it('should produce a PowerShell Register-ArgumentCompleter block', () => {
      const { exporter } = createExporter([
        { name: 'deploy', description: 'Deploy the app' },
      ]);

      const script = exporter.generate('powershell');

      expect(script).toContain("Register-ArgumentCompleter -CommandName 'wundr'");
      expect(script).toContain("Name = 'deploy'");
    });

    it('should include global options', () => {
      const { exporter } = createExporter([]);

      const script = exporter.generate('powershell');

      expect(script).toContain("'--verbose'");
      expect(script).toContain("'--quiet'");
      expect(script).toContain("'--json'");
    });

    it('should exclude hidden commands', () => {
      const { exporter } = createExporter([
        { name: 'visible', description: 'Shown' },
        { name: 'hidden', description: 'Secret', hidden: true },
      ]);

      const script = exporter.generate('powershell');

      expect(script).toContain("'visible'");
      expect(script).not.toContain("'hidden'");
    });

    it('should escape single quotes in PowerShell descriptions', () => {
      const { exporter } = createExporter([
        { name: 'test', description: "It's powershell" },
      ]);

      const script = exporter.generate('powershell');

      expect(script).toContain("''");
    });
  });

  // ----- Raw data export -----

  describe('exportData', () => {
    it('should return a CompletionData object', () => {
      const { exporter } = createExporter([
        { name: 'deploy', description: 'Deploy' },
      ]);

      const data = exporter.exportData('2.0.0');

      expect(data.programName).toBe('wundr');
      expect(data.version).toBe('2.0.0');
      expect(data.commands.length).toBeGreaterThanOrEqual(1);
      expect(data.globalOptions.length).toBeGreaterThan(0);
    });

    it('should include command metadata in exported data', () => {
      const { exporter } = createExporter([
        {
          name: 'deploy',
          description: 'Deploy the app',
          category: 'daemon' as CommandCategory,
          aliases: ['d'],
          arguments: [
            { name: 'env', description: 'Target', required: true },
          ],
          options: [
            { flags: '--force', description: 'Force deploy' },
          ],
        },
      ]);

      const data = exporter.exportData();
      const cmd = data.commands.find(c => c.name === 'deploy');

      expect(cmd).toBeDefined();
      expect(cmd!.description).toBe('Deploy the app');
      expect(cmd!.aliases).toContain('d');
      expect(cmd!.arguments).toHaveLength(1);
      expect(cmd!.arguments[0]!.name).toBe('env');
      expect(cmd!.arguments[0]!.required).toBe(true);
      expect(cmd!.options).toHaveLength(1);
      expect(cmd!.options[0]!.long).toBe('--force');
    });

    it('should exclude colon-separated subcommand entries from top-level commands', () => {
      const { exporter } = createExporter([
        {
          name: 'agent',
          description: 'Agent',
          subcommands: [
            makeCommand({ name: 'list', description: 'List agents' }),
          ],
        },
      ]);

      const data = exporter.exportData();
      const names = data.commands.map(c => c.name);

      expect(names).toContain('agent');
      expect(names).not.toContain('agent:list');
    });

    it('should include nested subcommands in parent command data', () => {
      const { exporter } = createExporter([
        {
          name: 'agent',
          description: 'Agent',
          subcommands: [
            makeCommand({ name: 'list', description: 'List agents' }),
          ],
        },
      ]);

      const data = exporter.exportData();
      const agentCmd = data.commands.find(c => c.name === 'agent');

      expect(agentCmd!.subcommands).toHaveLength(1);
      expect(agentCmd!.subcommands[0]!.name).toBe('list');
    });

    it('should include standard global options', () => {
      const { exporter } = createExporter([]);

      const data = exporter.exportData();
      const optLongs = data.globalOptions.map(o => o.long);

      expect(optLongs).toContain('--verbose');
      expect(optLongs).toContain('--help');
      expect(optLongs).toContain('--version');
      expect(optLongs).toContain('--config');
    });

    it('should parse option flags into long/short/takesValue', () => {
      const { exporter } = createExporter([
        {
          name: 'serve',
          description: 'Serve',
          options: [
            { flags: '-p, --port <number>', description: 'Port number' },
            { flags: '--force', description: 'Force' },
          ],
        },
      ]);

      const data = exporter.exportData();
      const cmd = data.commands.find(c => c.name === 'serve')!;

      const portOpt = cmd.options.find(o => o.long === '--port');
      expect(portOpt).toBeDefined();
      expect(portOpt!.short).toBe('-p');
      expect(portOpt!.takesValue).toBe(true);

      const forceOpt = cmd.options.find(o => o.long === '--force');
      expect(forceOpt).toBeDefined();
      expect(forceOpt!.takesValue).toBe(false);
    });

    it('should mark hidden commands in exported data', () => {
      const { exporter } = createExporter([
        { name: 'internal', description: 'Internal', hidden: true },
      ]);

      const data = exporter.exportData();
      const cmd = data.commands.find(c => c.name === 'internal');

      expect(cmd!.hidden).toBe(true);
    });
  });

  // ----- JSON export -----

  describe('exportJson', () => {
    it('should produce valid JSON', () => {
      const { exporter } = createExporter([
        { name: 'deploy', description: 'Deploy' },
      ]);

      const json = exporter.exportJson('1.0.0');
      const parsed = JSON.parse(json);

      expect(parsed.programName).toBe('wundr');
      expect(parsed.version).toBe('1.0.0');
    });

    it('should produce pretty-printed JSON by default', () => {
      const { exporter } = createExporter([]);

      const json = exporter.exportJson();

      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });

    it('should produce compact JSON when pretty is false', () => {
      const { exporter } = createExporter([]);

      const json = exporter.exportJson('1.0.0', false);

      expect(json).not.toContain('\n');
    });
  });
});
