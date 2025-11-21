/**
 * Regression tests for consolidated claude-setup command
 *
 * This test suite ensures all functionality from both original implementations
 * is preserved after consolidation.
 *
 * Original implementations:
 * - /src/cli/commands/claude-setup.ts (374 lines) - function-based
 * - /packages/@wundr/cli/src/commands/claude-setup.ts (697 lines) - class-based
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Command } from 'commander';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock external dependencies
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: ''
  }));
});

jest.mock('inquirer', () => ({
  default: {
    prompt: jest.fn().mockResolvedValue({ shouldInitGit: false, overwrite: false })
  }
}));

jest.mock('child_process', () => ({
  execSync: jest.fn().mockImplementation((cmd: string) => {
    if (cmd.includes('--version')) return '1.0.0';
    if (cmd.includes('git init')) return '';
    throw new Error('Command not mocked');
  }),
  spawn: jest.fn().mockReturnValue({
    on: jest.fn((event: string, callback: (code: number) => void) => {
      if (event === 'close') callback(0);
    })
  })
}));

describe('Consolidated Claude Setup Command', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `claude-setup-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Module exports', () => {
    it('should export ClaudeSetupCommands class', async () => {
      const { ClaudeSetupCommands } = await import(
        '../../packages/@wundr/cli/src/commands/claude-setup'
      );
      expect(ClaudeSetupCommands).toBeDefined();
      expect(typeof ClaudeSetupCommands).toBe('function');
    });

    it('should export createClaudeSetupCommand function for backwards compatibility', async () => {
      const { createClaudeSetupCommand } = await import(
        '../../packages/@wundr/cli/src/commands/claude-setup'
      );
      expect(createClaudeSetupCommand).toBeDefined();
      expect(typeof createClaudeSetupCommand).toBe('function');
    });

    it('should export default factory function', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      expect(createClaudeSetupCommands).toBeDefined();
      expect(typeof createClaudeSetupCommands).toBe('function');
    });
  });

  describe('Command registration', () => {
    it('should register claude-setup command on program', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      expect(claudeSetup).toBeDefined();
      expect(claudeSetup?.alias()).toBe('cs');
    });

    it('should register all subcommands', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const subcommands = claudeSetup?.commands.map(c => c.name()) || [];

      // From original /src/cli/commands/claude-setup.ts functionality
      expect(subcommands).toContain('project');
      expect(subcommands).toContain('config');

      // From original /@wundr/cli/src/commands/claude-setup.ts functionality
      expect(subcommands).toContain('install');
      expect(subcommands).toContain('mcp');
      expect(subcommands).toContain('agents');
      expect(subcommands).toContain('validate');
      expect(subcommands).toContain('extension');
      expect(subcommands).toContain('optimize');
    });
  });

  describe('Project templates (from /src/cli/commands/claude-setup.ts)', () => {
    it('should have typescript template option', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const projectCmd = claudeSetup?.commands.find(c => c.name() === 'project');

      expect(projectCmd).toBeDefined();
      const templateOption = projectCmd?.options.find(
        o => o.long === '--template'
      );
      expect(templateOption).toBeDefined();
    });

    it('should list all available templates in help text', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const projectCmd = claudeSetup?.commands.find(c => c.name() === 'project');
      const templateOption = projectCmd?.options.find(
        o => o.long === '--template'
      );

      const description = templateOption?.description || '';
      expect(description).toContain('typescript');
      expect(description).toContain('react');
      expect(description).toContain('nodejs');
      expect(description).toContain('monorepo');
    });
  });

  describe('MCP tools (from both implementations)', () => {
    it('should have mcp subcommand', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const mcpCmd = claudeSetup?.commands.find(c => c.name() === 'mcp');

      expect(mcpCmd).toBeDefined();
    });

    it('should have --tool option for specific tool installation', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const mcpCmd = claudeSetup?.commands.find(c => c.name() === 'mcp');
      const toolOption = mcpCmd?.options.find(o => o.long === '--tool');

      expect(toolOption).toBeDefined();
    });
  });

  describe('Agent configuration (from /@wundr/cli/src/commands/claude-setup.ts)', () => {
    it('should have agents subcommand', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const agentsCmd = claudeSetup?.commands.find(c => c.name() === 'agents');

      expect(agentsCmd).toBeDefined();
    });

    it('should have --list option for agents', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const agentsCmd = claudeSetup?.commands.find(c => c.name() === 'agents');
      const listOption = agentsCmd?.options.find(o => o.long === '--list');

      expect(listOption).toBeDefined();
    });

    it('should have --profile option for agents', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const agentsCmd = claudeSetup?.commands.find(c => c.name() === 'agents');
      const profileOption = agentsCmd?.options.find(o => o.long === '--profile');

      expect(profileOption).toBeDefined();
    });
  });

  describe('Hardware optimization (from /@wundr/cli/src/commands/claude-setup.ts)', () => {
    it('should have optimize subcommand', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const optimizeCmd = claudeSetup?.commands.find(
        c => c.name() === 'optimize'
      );

      expect(optimizeCmd).toBeDefined();
    });

    it('should have --force option for optimize', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const optimizeCmd = claudeSetup?.commands.find(
        c => c.name() === 'optimize'
      );
      const forceOption = optimizeCmd?.options.find(o => o.long === '--force');

      expect(forceOption).toBeDefined();
    });
  });

  describe('Validation (from /@wundr/cli/src/commands/claude-setup.ts)', () => {
    it('should have validate subcommand', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const validateCmd = claudeSetup?.commands.find(
        c => c.name() === 'validate'
      );

      expect(validateCmd).toBeDefined();
    });

    it('should have --fix option for validate', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const validateCmd = claudeSetup?.commands.find(
        c => c.name() === 'validate'
      );
      const fixOption = validateCmd?.options.find(o => o.long === '--fix');

      expect(fixOption).toBeDefined();
    });
  });

  describe('Install command options', () => {
    it('should have all skip options', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const installCmd = claudeSetup?.commands.find(c => c.name() === 'install');
      const optionNames = installCmd?.options.map(o => o.long) || [];

      expect(optionNames).toContain('--skip-chrome');
      expect(optionNames).toContain('--skip-mcp');
      expect(optionNames).toContain('--skip-agents');
      expect(optionNames).toContain('--skip-flow');
      expect(optionNames).toContain('--global');
    });
  });

  describe('Config command (CLAUDE.md generation)', () => {
    it('should have config subcommand', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const configCmd = claudeSetup?.commands.find(c => c.name() === 'config');

      expect(configCmd).toBeDefined();
    });
  });

  describe('Extension command', () => {
    it('should have extension subcommand', async () => {
      const createClaudeSetupCommands = (
        await import('../../packages/@wundr/cli/src/commands/claude-setup')
      ).default;
      const program = new Command();
      createClaudeSetupCommands(program);

      const claudeSetup = program.commands.find(
        cmd => cmd.name() === 'claude-setup'
      );
      const extensionCmd = claudeSetup?.commands.find(
        c => c.name() === 'extension'
      );

      expect(extensionCmd).toBeDefined();
    });
  });

  describe('createClaudeSetupCommand backwards compatibility', () => {
    it('should return a Command instance', async () => {
      const { createClaudeSetupCommand } = await import(
        '../../packages/@wundr/cli/src/commands/claude-setup'
      );
      const command = createClaudeSetupCommand();

      expect(command).toBeInstanceOf(Command);
    });

    it('should work with program.addCommand pattern', async () => {
      const { createClaudeSetupCommand } = await import(
        '../../packages/@wundr/cli/src/commands/claude-setup'
      );
      const program = new Command();
      const setupCommand = createClaudeSetupCommand();

      // This should not throw
      expect(() => program.addCommand(setupCommand)).not.toThrow();
    });
  });
});
