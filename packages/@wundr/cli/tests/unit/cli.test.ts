import { WundrCLI } from '../../src/cli';
import { ConfigManager } from '../../src/utils/config-manager';
import { PluginManager } from '../../src/plugins/plugin-manager';
import { InteractiveMode } from '../../src/interactive/interactive-mode';
import { TestHelper, mockLogger } from '../helpers/test-utils';

describe('WundrCLI', () => {
  let testHelper: TestHelper;
  let cli: WundrCLI;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockPluginManager: jest.Mocked<PluginManager>;

  beforeEach(async () => {
    testHelper = new TestHelper();
    await testHelper.setup();

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        version: '1.0.0',
        defaultMode: 'cli',
        plugins: [],
      }),
      loadConfig: jest.fn(),
      saveConfig: jest.fn(),
    } as any;

    mockPluginManager = {
      loadPlugins: jest.fn(),
      initialize: jest.fn(),
    } as any;

    cli = new WundrCLI();
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Initialization', () => {
    test('should create CLI instance with required components', () => {
      expect(cli).toBeDefined();
      expect(cli.createProgram()).toBeValidCommand();
    });

    test('should setup program with correct name and version', () => {
      const program = cli.createProgram();
      expect(program.name()).toBe('wundr');
      expect(program.version()).toBeDefined();
    });

    test('should register global options', () => {
      const program = cli.createProgram();
      const options = program.options;

      expect(options.some(opt => opt.long === '--config')).toBe(true);
      expect(options.some(opt => opt.long === '--verbose')).toBe(true);
      expect(options.some(opt => opt.long === '--quiet')).toBe(true);
      expect(options.some(opt => opt.long === '--no-color')).toBe(true);
      expect(options.some(opt => opt.long === '--dry-run')).toBe(true);
      expect(options.some(opt => opt.long === '--interactive')).toBe(true);
    });
  });

  describe('Command Categories', () => {
    test('should register all 10 required command categories', () => {
      const program = cli.createProgram();
      const commands = program.commands.map(cmd => cmd.name());

      const expectedCategories = [
        'init',
        'create',
        'analyze',
        'govern',
        'ai',
        'dashboard',
        'watch',
        'batch',
        'chat',
        'plugins',
      ];

      expectedCategories.forEach(category => {
        expect(commands).toContain(category);
      });
    });

    test('should register interactive mode commands', () => {
      const program = cli.createProgram();
      const commands = program.commands.map(cmd => cmd.name());

      expect(commands).toContain('wizard');
      expect(commands).toContain('chat');
      expect(commands).toContain('tui');
    });
  });

  describe('Interactive Modes', () => {
    test('should support wizard mode', () => {
      const program = cli.createProgram();
      const wizardCmd = program.commands.find(cmd => cmd.name() === 'wizard');

      expect(wizardCmd).toBeDefined();
      expect(wizardCmd?.alias()).toBe('w');
      expect(wizardCmd?.description()).toContain('interactive wizard');
    });

    test('should support chat mode', () => {
      const program = cli.createProgram();
      const chatCmd = program.commands.find(cmd => cmd.name() === 'chat');

      expect(chatCmd).toBeDefined();
      expect(chatCmd?.alias()).toBe('c');
      expect(chatCmd?.description()).toContain('natural language chat');
    });

    test('should support TUI mode', () => {
      const program = cli.createProgram();
      const tuiCmd = program.commands.find(cmd => cmd.name() === 'tui');

      expect(tuiCmd).toBeDefined();
      expect(tuiCmd?.alias()).toBe('t');
      expect(tuiCmd?.description()).toContain('terminal user interface');
    });
  });

  describe('Plugin System', () => {
    test('should load plugins on initialization', async () => {
      const mockLoadPlugins = jest.fn();
      cli['pluginManager'] = { loadPlugins: mockLoadPlugins } as any;

      await cli.loadPlugins();
      expect(mockLoadPlugins).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    test('should handle custom config paths', () => {
      const program = cli.createProgram();

      // Simulate command with --config option
      const mockAction = jest.fn();
      program.hook('preAction', (thisCommand, actionCommand) => {
        const options = thisCommand.opts();
        if (options.config) {
          mockAction(options.config);
        }
      });

      // This would be tested with actual command execution
      expect(program.options.some(opt => opt.long === '--config')).toBe(true);
    });

    test('should handle logging level options', () => {
      const program = cli.createProgram();

      expect(program.options.some(opt => opt.long === '--verbose')).toBe(true);
      expect(program.options.some(opt => opt.long === '--quiet')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should gracefully handle plugin loading failures', async () => {
      const mockPluginManager = {
        loadPlugins: jest
          .fn()
          .mockRejectedValue(new Error('Plugin load failed')),
      };
      cli['pluginManager'] = mockPluginManager as any;

      await expect(cli.loadPlugins()).rejects.toThrow('Plugin load failed');
    });

    test('should handle missing dependencies', () => {
      // Test error handling for missing optional dependencies
      expect(() => cli.createProgram()).not.toThrow();
    });
  });
});
