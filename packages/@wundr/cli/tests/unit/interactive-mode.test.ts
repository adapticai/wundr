import { InteractiveMode } from '../../src/interactive/interactive-mode';
import { ConfigManager } from '../../src/utils/config-manager';
import { PluginManager } from '../../src/plugins/plugin-manager';
import { TestHelper, mockLogger, createMockConfig } from '../helpers/test-utils';
import inquirer from 'inquirer';
import blessed from 'blessed';

jest.mock('inquirer');
jest.mock('blessed');

describe('InteractiveMode', () => {
  let testHelper: TestHelper;
  let interactiveMode: InteractiveMode;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockPluginManager: jest.Mocked<PluginManager>;
  let mockInquirer: jest.Mocked<typeof inquirer>;
  let mockBlessed: jest.Mocked<typeof blessed>;

  beforeEach(async () => {
    testHelper = new TestHelper();
    await testHelper.setup();

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue(createMockConfig()),
      loadConfig: jest.fn(),
      saveConfig: jest.fn()
    } as any;

    mockPluginManager = {
      loadPlugins: jest.fn()
    } as any;

    mockInquirer = inquirer as jest.Mocked<typeof inquirer>;
    mockBlessed = blessed as jest.Mocked<typeof blessed>;

    interactiveMode = new InteractiveMode(mockConfigManager, mockPluginManager);
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Wizard Mode', () => {
    test('should launch setup wizard', async () => {
      mockInquirer.prompt = jest.fn().mockResolvedValue({
        initialize: true,
        projectType: 'single',
        features: ['analysis', 'governance']
      });

      await interactiveMode.launchWizard('setup');

      expect(mockInquirer.prompt).toHaveBeenCalled();
      const promptCall = mockInquirer.prompt.mock.calls[0][0] as any[];
      expect(promptCall.some((q: any) => q.name === 'initialize')).toBe(true);
      expect(promptCall.some((q: any) => q.name === 'projectType')).toBe(true);
      expect(promptCall.some((q: any) => q.name === 'features')).toBe(true);
    });

    test('should launch analyze wizard', async () => {
      mockInquirer.prompt = jest.fn().mockResolvedValue({
        analysisTypes: ['deps', 'quality'],
        outputFormat: 'table',
        autoFix: false
      });

      await interactiveMode.launchWizard('analyze');

      expect(mockInquirer.prompt).toHaveBeenCalled();
      const promptCall = mockInquirer.prompt.mock.calls[0][0] as any[];
      expect(promptCall.some((q: any) => q.name === 'analysisTypes')).toBe(true);
      expect(promptCall.some((q: any) => q.name === 'outputFormat')).toBe(true);
    });

    test('should launch create wizard', async () => {
      mockInquirer.prompt = jest.fn()
        .mockResolvedValueOnce({
          createType: 'component',
          name: 'TestComponent'
        })
        .mockResolvedValueOnce({
          type: 'react',
          withTests: true,
          withStories: false
        });

      await interactiveMode.launchWizard('create');

      expect(mockInquirer.prompt).toHaveBeenCalledTimes(2);
    });

    test('should launch govern wizard', async () => {
      mockInquirer.prompt = jest.fn().mockResolvedValue({
        ruleCategories: ['quality', 'security'],
        severity: 'warning',
        createQualityGate: true
      });

      await interactiveMode.launchWizard('govern');

      expect(mockInquirer.prompt).toHaveBeenCalled();
      const promptCall = mockInquirer.prompt.mock.calls[0][0] as any[];
      expect(promptCall.some((q: any) => q.name === 'ruleCategories')).toBe(true);
      expect(promptCall.some((q: any) => q.name === 'severity')).toBe(true);
    });

    test('should handle wizard cancellation', async () => {
      mockInquirer.prompt = jest.fn().mockResolvedValue({
        initialize: false
      });

      await interactiveMode.launchWizard('setup');

      expect(mockInquirer.prompt).toHaveBeenCalled();
    });
  });

  describe('TUI Mode', () => {
    let mockScreen: any;

    beforeEach(() => {
      mockScreen = {
        append: jest.fn(),
        key: jest.fn(),
        render: jest.fn()
      };
      
      mockBlessed.screen = jest.fn().mockReturnValue(mockScreen);
      mockBlessed.box = jest.fn().mockReturnValue({});
      mockBlessed.log = jest.fn().mockReturnValue({});
    });

    test('should launch TUI with dashboard layout', async () => {
      await interactiveMode.launchTUI('dashboard');

      expect(mockBlessed.screen).toHaveBeenCalledWith({
        smartCSR: true,
        title: 'Wundr CLI Dashboard'
      });
      expect(mockScreen.render).toHaveBeenCalled();
    });

    test('should launch TUI with monitor layout', async () => {
      await interactiveMode.launchTUI('monitor');

      expect(mockBlessed.screen).toHaveBeenCalled();
      expect(mockBlessed.log).toHaveBeenCalled();
    });

    test('should launch TUI with debug layout', async () => {
      await interactiveMode.launchTUI('debug');

      expect(mockBlessed.screen).toHaveBeenCalled();
      expect(mockBlessed.box).toHaveBeenCalled();
    });

    test('should setup TUI keyboard handlers', async () => {
      await interactiveMode.launchTUI('dashboard');

      expect(mockScreen.key).toHaveBeenCalledWith(
        ['escape', 'q', 'C-c'],
        expect.any(Function)
      );
    });
  });

  describe('Chat Mode', () => {
    test('should launch chat interface with options', async () => {
      const options = {
        model: 'claude-3',
        context: './src'
      };

      // Mock child_process.spawn
      const mockSpawn = jest.fn().mockReturnValue({
        on: jest.fn()
      });
      
      jest.doMock('child_process', () => ({
        spawn: mockSpawn
      }));

      await interactiveMode.launchChat(options);

      // Verify that spawn was called with correct arguments
      expect(mockSpawn).toHaveBeenCalledWith(
        'wundr',
        ['chat', 'start', '--model', 'claude-3', '--context', './src'],
        { stdio: 'inherit', shell: true }
      );
    });

    test('should handle chat launch failures', async () => {
      const mockSpawn = jest.fn().mockImplementation(() => {
        throw new Error('Failed to spawn');
      });
      
      jest.doMock('child_process', () => ({
        spawn: mockSpawn
      }));

      await expect(interactiveMode.launchChat({})).rejects.toThrow();
    });
  });

  describe('AI Configuration Wizard', () => {
    test('should configure AI provider and model', async () => {
      mockInquirer.prompt = jest.fn().mockResolvedValue({
        provider: 'claude',
        model: 'claude-3',
        apiKey: 'test-key',
        features: ['generate', 'review']
      });

      // Access private method through instance casting
      await (interactiveMode as any).aiConfigWizard();

      expect(mockInquirer.prompt).toHaveBeenCalled();
      const promptCall = mockInquirer.prompt.mock.calls[0][0] as any[];
      expect(promptCall.some((q: any) => q.name === 'provider')).toBe(true);
      expect(promptCall.some((q: any) => q.name === 'model')).toBe(true);
    });

    test('should handle different AI providers', async () => {
      const providers = ['claude', 'openai', 'local'];

      for (const provider of providers) {
        mockInquirer.prompt = jest.fn().mockResolvedValue({
          provider,
          model: 'test-model',
          features: ['generate']
        });

        await (interactiveMode as any).aiConfigWizard();
        expect(mockInquirer.prompt).toHaveBeenCalled();
      }
    });
  });

  describe('Component Creation Options', () => {
    test('should get component options', async () => {
      mockInquirer.prompt = jest.fn().mockResolvedValue({
        type: 'react',
        withTests: true,
        withStories: true
      });

      const options = await (interactiveMode as any).getComponentOptions();

      expect(options.type).toBe('react');
      expect(options.withTests).toBe(true);
      expect(options.withStories).toBe(true);
    });

    test('should get service options', async () => {
      mockInquirer.prompt = jest.fn().mockResolvedValue({
        type: 'api',
        framework: 'express',
        withTests: true,
        withDocs: true
      });

      const options = await (interactiveMode as any).getServiceOptions();

      expect(options.type).toBe('api');
      expect(options.framework).toBe('express');
    });

    test('should get package options', async () => {
      mockInquirer.prompt = jest.fn().mockResolvedValue({
        type: 'library',
        public: false
      });

      const options = await (interactiveMode as any).getPackageOptions();

      expect(options.type).toBe('library');
      expect(options.public).toBe(false);
    });
  });

  describe('Session Management', () => {
    test('should track active sessions', async () => {
      const sessionsBefore = (interactiveMode as any).activeSessions.size;
      
      mockInquirer.prompt = jest.fn().mockResolvedValue({
        initialize: false
      });

      await interactiveMode.launchWizard('setup');

      // Session should be created and then cleaned up
      expect((interactiveMode as any).activeSessions.size).toBe(sessionsBefore);
    });
  });

  describe('Error Handling', () => {
    test('should handle inquirer errors gracefully', async () => {
      mockInquirer.prompt = jest.fn().mockRejectedValue(new Error('Inquirer error'));

      await expect(interactiveMode.launchWizard('setup')).rejects.toThrow();
    });

    test('should handle blessed screen errors', async () => {
      mockBlessed.screen = jest.fn().mockImplementation(() => {
        throw new Error('Screen error');
      });

      await expect(interactiveMode.launchTUI('dashboard')).rejects.toThrow();
    });

    test('should create error with proper context', async () => {
      mockInquirer.prompt = jest.fn().mockRejectedValue(new Error('Test error'));

      try {
        await interactiveMode.launchWizard('setup');
      } catch (error: any) {
        expect(error.message).toContain('Failed to launch wizard');
      }
    });
  });
});