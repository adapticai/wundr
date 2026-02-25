/**
 * Tests for HelpGenerator.
 *
 * Covers main help generation, per-command help, search/fuzzy matching,
 * markdown output, and plain-text formatting.
 */

import { HelpGenerator } from '../../../src/framework/help-generator';
import { CommandRegistry } from '../../../src/framework/command-registry';
import type {
  CommandDefinition,
  CommandCategory,
} from '../../../src/framework/command-interface';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommand(
  overrides: Partial<CommandDefinition> = {}
): CommandDefinition {
  return {
    name: overrides.name ?? 'test-cmd',
    description: overrides.description ?? 'A test command',
    execute: jest.fn().mockResolvedValue({ exitCode: 0 }),
    ...overrides,
  };
}

function createRegistryWithCommands(
  commands: Partial<CommandDefinition>[]
): CommandRegistry {
  const registry = new CommandRegistry({ strict: false });
  for (const cmd of commands) {
    registry.register(makeCommand(cmd));
  }
  return registry;
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('HelpGenerator', () => {
  // ----- Main help (terminal format) -----

  describe('generateMainHelp (terminal/plain)', () => {
    it('should include the program name and CLI header', () => {
      const registry = createRegistryWithCommands([]);
      const gen = new HelpGenerator(registry, {
        programName: 'mytool',
        color: false,
      });

      const help = gen.generateMainHelp();
      expect(help).toContain('mytool');
      expect(help).toContain('CLI Tool');
    });

    it('should include the usage line', () => {
      const registry = createRegistryWithCommands([]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateMainHelp();
      expect(help).toContain('wundr <command> [options]');
    });

    it('should list visible commands', () => {
      const registry = createRegistryWithCommands([
        {
          name: 'deploy',
          description: 'Deploy the app',
          category: 'daemon' as CommandCategory,
        },
        {
          name: 'status',
          description: 'Show status',
          category: 'daemon' as CommandCategory,
        },
      ]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateMainHelp();
      expect(help).toContain('deploy');
      expect(help).toContain('Deploy the app');
      expect(help).toContain('status');
      expect(help).toContain('Show status');
    });

    it('should hide hidden commands', () => {
      const registry = createRegistryWithCommands([
        { name: 'visible', description: 'Shown' },
        { name: 'secret', description: 'Hidden', hidden: true },
      ]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateMainHelp();
      expect(help).toContain('visible');
      expect(help).not.toContain('secret');
    });

    it('should hide colon-separated subcommand names from top level', () => {
      const registry = new CommandRegistry({ strict: false });
      registry.register(
        makeCommand({
          name: 'agent',
          description: 'Agent management',
          category: 'agent' as CommandCategory,
          subcommands: [
            makeCommand({ name: 'list', description: 'List agents' }),
          ],
        })
      );
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateMainHelp();
      expect(help).toContain('agent');
      // Qualified name "agent:list" should be excluded from the top-level listing
      expect(help).not.toMatch(/agent:list/);
    });

    it('should include global options section', () => {
      const registry = createRegistryWithCommands([]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateMainHelp();
      expect(help).toContain('Global Options');
      expect(help).toContain('--verbose');
      expect(help).toContain('--quiet');
      expect(help).toContain('--json');
      expect(help).toContain('--dry-run');
    });

    it('should show aliases next to command names', () => {
      const registry = createRegistryWithCommands([
        { name: 'deploy', description: 'Deploy', aliases: ['d', 'dp'] },
      ]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateMainHelp();
      expect(help).toContain('d, dp');
    });

    it('should include footer hint about per-command help', () => {
      const registry = createRegistryWithCommands([]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateMainHelp();
      expect(help).toContain('--help');
    });
  });

  // ----- Per-command help (terminal/plain) -----

  describe('generateCommandHelp (terminal/plain)', () => {
    it('should include command name and description', () => {
      const cmd = makeCommand({
        name: 'deploy',
        description: 'Deploy the application',
      });
      const registry = createRegistryWithCommands([cmd]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateCommandHelp(cmd);
      expect(help).toContain('deploy');
      expect(help).toContain('Deploy the application');
    });

    it('should show aliases section when present', () => {
      const cmd = makeCommand({
        name: 'deploy',
        description: 'Deploy',
        aliases: ['d', 'push'],
      });
      const registry = createRegistryWithCommands([cmd]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateCommandHelp(cmd);
      expect(help).toContain('Aliases');
      expect(help).toContain('d, push');
    });

    it('should build correct usage line with required arguments', () => {
      const cmd = makeCommand({
        name: 'deploy',
        description: 'Deploy',
        arguments: [
          { name: 'environment', description: 'Target env', required: true },
          { name: 'tag', description: 'Version tag', required: false },
        ],
      });
      const registry = createRegistryWithCommands([cmd]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateCommandHelp(cmd);
      expect(help).toContain('<environment>');
      expect(help).toContain('[tag]');
    });

    it('should handle variadic arguments', () => {
      const cmd = makeCommand({
        name: 'deploy',
        description: 'Deploy',
        arguments: [
          {
            name: 'targets',
            description: 'Targets',
            required: true,
            variadic: true,
          },
        ],
      });
      const registry = createRegistryWithCommands([cmd]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateCommandHelp(cmd);
      expect(help).toContain('<targets...>');
    });

    it('should list options with descriptions', () => {
      const cmd = makeCommand({
        name: 'deploy',
        description: 'Deploy',
        options: [
          {
            flags: '-e, --env <name>',
            description: 'Target environment',
            choices: ['dev', 'prod'],
          },
          { flags: '--force', description: 'Force deploy', required: true },
        ],
      });
      const registry = createRegistryWithCommands([cmd]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateCommandHelp(cmd);
      expect(help).toContain('Options');
      expect(help).toContain('-e, --env <name>');
      expect(help).toContain('Target environment');
      expect(help).toContain('dev|prod');
      expect(help).toContain('(required)');
    });

    it('should list subcommands when present', () => {
      const cmd = makeCommand({
        name: 'agent',
        description: 'Agent mgmt',
        subcommands: [
          makeCommand({ name: 'list', description: 'List agents' }),
          makeCommand({ name: 'spawn', description: 'Spawn an agent' }),
        ],
      });
      const registry = createRegistryWithCommands([cmd]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateCommandHelp(cmd);
      expect(help).toContain('Subcommands');
      expect(help).toContain('list');
      expect(help).toContain('spawn');
    });

    it('should show examples when present', () => {
      const cmd = makeCommand({
        name: 'deploy',
        description: 'Deploy',
        examples: [
          { command: 'wundr deploy prod', description: 'Deploy to production' },
          { command: 'wundr deploy --force', description: 'Force deploy' },
        ],
      });
      const registry = createRegistryWithCommands([cmd]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateCommandHelp(cmd);
      expect(help).toContain('Examples');
      expect(help).toContain('wundr deploy prod');
      expect(help).toContain('Deploy to production');
    });

    it('should include [options] in usage line when options are present', () => {
      const cmd = makeCommand({
        name: 'deploy',
        description: 'Deploy',
        options: [{ flags: '--force', description: 'Force' }],
      });
      const registry = createRegistryWithCommands([cmd]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateCommandHelp(cmd);
      expect(help).toContain('[options]');
    });

    it('should show option defaults and env var hints', () => {
      const cmd = makeCommand({
        name: 'serve',
        description: 'Start server',
        options: [
          {
            flags: '-p, --port <number>',
            description: 'Port',
            defaultValue: 3000,
            envVar: 'PORT',
          },
        ],
      });
      const registry = createRegistryWithCommands([cmd]);
      const gen = new HelpGenerator(registry, { color: false });

      const help = gen.generateCommandHelp(cmd);
      expect(help).toContain('default: 3000');
      expect(help).toContain('env: PORT');
    });
  });

  // ----- Markdown output -----

  describe('generateMainHelp (markdown)', () => {
    it('should produce markdown with headings and table', () => {
      const registry = createRegistryWithCommands([
        {
          name: 'deploy',
          description: 'Deploy app',
          category: 'daemon' as CommandCategory,
        },
      ]);
      const gen = new HelpGenerator(registry, { format: 'markdown' });

      const md = gen.generateMainHelp();
      expect(md).toContain('# wundr CLI');
      expect(md).toContain('## Usage');
      expect(md).toContain('| Command | Description |');
      expect(md).toContain('`deploy`');
    });

    it('should include global options as a markdown table', () => {
      const registry = createRegistryWithCommands([]);
      const gen = new HelpGenerator(registry, { format: 'markdown' });

      const md = gen.generateMainHelp();
      expect(md).toContain('## Global Options');
      expect(md).toContain('`--verbose`');
    });
  });

  describe('generateCommandHelp (markdown)', () => {
    it('should produce markdown with code blocks for usage', () => {
      const cmd = makeCommand({
        name: 'deploy',
        description: 'Deploy app',
        arguments: [
          { name: 'env', description: 'Environment', required: true },
        ],
      });
      const registry = createRegistryWithCommands([cmd]);
      const gen = new HelpGenerator(registry, { format: 'markdown' });

      const md = gen.generateCommandHelp(cmd);
      expect(md).toContain('# deploy');
      expect(md).toContain('```');
      expect(md).toContain('<env>');
    });

    it('should include arguments table in markdown', () => {
      const cmd = makeCommand({
        name: 'deploy',
        description: 'Deploy',
        arguments: [
          { name: 'env', description: 'Environment', required: true },
        ],
      });
      const registry = createRegistryWithCommands([cmd]);
      const gen = new HelpGenerator(registry, { format: 'markdown' });

      const md = gen.generateCommandHelp(cmd);
      expect(md).toContain('## Arguments');
      expect(md).toContain('| `env`');
      expect(md).toContain('Yes');
    });

    it('should include aliases in markdown', () => {
      const cmd = makeCommand({
        name: 'deploy',
        description: 'Deploy',
        aliases: ['d'],
      });
      const registry = createRegistryWithCommands([cmd]);
      const gen = new HelpGenerator(registry, { format: 'markdown' });

      const md = gen.generateCommandHelp(cmd);
      expect(md).toContain('**Aliases:**');
      expect(md).toContain('d');
    });
  });

  // ----- Search -----

  describe('search', () => {
    it('should return exact name matches with highest score', () => {
      const registry = createRegistryWithCommands([
        { name: 'deploy', description: 'Deploy' },
        { name: 'status', description: 'Status' },
      ]);
      const gen = new HelpGenerator(registry, { color: false });

      const results = gen.search('deploy');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.command.name).toBe('deploy');
      expect(results[0]!.score).toBe(1);
      expect(results[0]!.matchType).toBe('name');
    });

    it('should find commands by prefix', () => {
      const registry = createRegistryWithCommands([
        { name: 'deploy', description: 'Deploy' },
        { name: 'delete', description: 'Delete' },
        { name: 'status', description: 'Status' },
      ]);
      const gen = new HelpGenerator(registry, { color: false });

      const results = gen.search('dep');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.command.name).toBe('deploy');
    });

    it('should match on aliases', () => {
      const registry = createRegistryWithCommands([
        { name: 'deploy', description: 'Deploy', aliases: ['push'] },
      ]);
      const gen = new HelpGenerator(registry, { color: false });

      const results = gen.search('push');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.matchType).toBe('alias');
    });

    it('should match on description content', () => {
      const registry = createRegistryWithCommands([
        { name: 'foo', description: 'Manages deployment pipelines' },
      ]);
      const gen = new HelpGenerator(registry, { color: false });

      const results = gen.search('deployment');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should exclude hidden commands from results', () => {
      const registry = createRegistryWithCommands([
        { name: 'visible', description: 'A visible command' },
        { name: 'hidden', description: 'Secret', hidden: true },
      ]);
      const gen = new HelpGenerator(registry, { color: false });

      const results = gen.search('hidden');
      const names = results.map(r => r.command.name);
      expect(names).not.toContain('hidden');
    });

    it('should return results sorted by score descending', () => {
      const registry = createRegistryWithCommands([
        { name: 'deploy', description: 'Deploy app' },
        { name: 'dep-check', description: 'Check dependencies' },
      ]);
      const gen = new HelpGenerator(registry, { color: false });

      const results = gen.search('deploy');
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
      }
    });

    it('should return empty array for non-matching queries', () => {
      const registry = createRegistryWithCommands([
        { name: 'deploy', description: 'Deploy' },
      ]);
      const gen = new HelpGenerator(registry, { color: false });

      const results = gen.search('zzzzzzzzzzz');
      expect(results).toHaveLength(0);
    });
  });
});
