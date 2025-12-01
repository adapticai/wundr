import { PluginManager } from '../../src/plugins/plugin-manager';
import { ConfigManager } from '../../src/utils/config-manager';
import { TestHelper, createMockConfig } from '../helpers/test-utils';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';

jest.mock('child_process');

describe('PluginManager', () => {
  let testHelper: TestHelper;
  let pluginManager: PluginManager;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockSpawn: jest.MockedFunction<typeof spawn>;

  beforeEach(async () => {
    testHelper = new TestHelper();
    await testHelper.setup();

    mockConfigManager = {
      getConfig: jest
        .fn()
        .mockReturnValue(createMockConfig({ plugins: ['test-plugin'] })),
      set: jest.fn(),
      get: jest.fn(),
      saveConfig: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
    mockSpawn.mockImplementation(
      () =>
        ({
          on: jest.fn().mockImplementation((event, callback) => {
            if (event === 'exit') callback(0);
          }),
        }) as any
    );

    pluginManager = new PluginManager(mockConfigManager);
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Initialization', () => {
    test('should initialize plugin system', async () => {
      await pluginManager.initialize();

      const pluginsDir = path.join(process.cwd(), '.wundr', 'plugins');
      expect(await fs.pathExists(pluginsDir)).toBe(true);
    });

    test('should handle initialization errors', async () => {
      // Mock fs.ensureDir to fail
      jest
        .spyOn(fs, 'ensureDir')
        .mockRejectedValue(new Error('Permission denied'));

      await expect(pluginManager.initialize()).rejects.toThrow();
    });
  });

  describe('Plugin Loading', () => {
    test('should load enabled plugins', async () => {
      const pluginPath = await testHelper.createPlugin('test-plugin', []);

      mockConfigManager.getConfig.mockReturnValue(
        createMockConfig({ plugins: ['test-plugin'] })
      );

      await pluginManager.loadPlugins();

      const plugins = await pluginManager.getInstalledPlugins();
      expect(plugins.length).toBeGreaterThan(0);
    });

    test('should handle plugin loading failures gracefully', async () => {
      mockConfigManager.getConfig.mockReturnValue(
        createMockConfig({ plugins: ['non-existent-plugin'] })
      );

      // Should not throw, but log warnings
      await expect(pluginManager.loadPlugins()).resolves.not.toThrow();
    });

    test('should load specific plugin', async () => {
      const pluginPath = await testHelper.createPlugin('specific-plugin', []);

      await expect(
        pluginManager.loadPlugin('specific-plugin')
      ).resolves.not.toThrow();
    });

    test('should not reload already loaded plugins', async () => {
      const pluginPath = await testHelper.createPlugin('loaded-plugin', []);

      await pluginManager.loadPlugin('loaded-plugin');
      await pluginManager.loadPlugin('loaded-plugin'); // Second load

      // Should handle gracefully without errors
    });
  });

  describe('Plugin Installation', () => {
    test('should install local plugin', async () => {
      const sourcePath = await testHelper.createPlugin('local-plugin', []);

      await pluginManager.installPlugin(sourcePath);

      expect(await pluginManager.isPluginInstalled('local-plugin')).toBe(true);
    });

    test('should install npm plugin', async () => {
      const pluginName = '@wundr/test-plugin';

      await pluginManager.installPlugin(pluginName, { version: '1.0.0' });

      expect(mockSpawn).toHaveBeenCalledWith(
        'npm',
        ['install'],
        expect.objectContaining({ stdio: 'inherit', shell: true })
      );
    });

    test('should install git plugin', async () => {
      const gitUrl = 'https://github.com/user/plugin.git';

      await pluginManager.installPlugin(gitUrl);

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['clone', gitUrl, expect.any(String)],
        expect.objectContaining({ shell: true })
      );
    });

    test('should handle installation failures', async () => {
      mockSpawn.mockImplementation(
        () =>
          ({
            on: jest.fn().mockImplementation((event, callback) => {
              if (event === 'exit') callback(1); // Failed exit code
            }),
          }) as any
      );

      await expect(
        pluginManager.installPlugin('failing-plugin')
      ).rejects.toThrow();
    });
  });

  describe('Plugin Uninstallation', () => {
    test('should uninstall plugin', async () => {
      const pluginPath = await testHelper.createPlugin('removable-plugin', []);
      await pluginManager.loadPlugin('removable-plugin');

      await pluginManager.uninstallPlugin('removable-plugin');

      expect(await pluginManager.isPluginInstalled('removable-plugin')).toBe(
        false
      );
    });

    test('should unload plugin before uninstalling', async () => {
      const pluginPath = await testHelper.createPlugin('unload-plugin', []);
      await pluginManager.loadPlugin('unload-plugin');

      const unloadSpy = jest.spyOn(pluginManager, 'unloadPlugin');

      await pluginManager.uninstallPlugin('unload-plugin');

      expect(unloadSpy).toHaveBeenCalledWith('unload-plugin');
    });
  });

  describe('Plugin Enable/Disable', () => {
    test('should enable plugin', async () => {
      const pluginPath = await testHelper.createPlugin('enable-plugin', []);

      await pluginManager.enablePlugin('enable-plugin');

      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
    });

    test('should disable plugin', async () => {
      const pluginPath = await testHelper.createPlugin('disable-plugin', []);
      await pluginManager.loadPlugin('disable-plugin');

      await pluginManager.disablePlugin('disable-plugin');

      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
    });

    test('should handle enabling non-existent plugin', async () => {
      await expect(
        pluginManager.enablePlugin('non-existent')
      ).rejects.toThrow();
    });
  });

  describe('Plugin Information', () => {
    test('should get plugin info', async () => {
      const pluginPath = await testHelper.createPlugin('info-plugin', []);

      const info = await pluginManager.getPluginInfo('info-plugin');

      expect(info).toMatchObject({
        name: expect.any(String),
        version: expect.any(String),
        enabled: expect.any(Boolean),
      });
    });

    test('should return null for non-existent plugin info', async () => {
      const info = await pluginManager.getPluginInfo('non-existent');
      expect(info).toBeNull();
    });

    test('should get installed plugins list', async () => {
      await testHelper.createPlugin('plugin1', []);
      await testHelper.createPlugin('plugin2', []);

      const plugins = await pluginManager.getInstalledPlugins();

      expect(Array.isArray(plugins)).toBe(true);
    });

    test('should get available plugins from registry', async () => {
      const available = await pluginManager.getAvailablePlugins();

      expect(Array.isArray(available)).toBe(true);
      expect(available.length).toBeGreaterThan(0);
    });
  });

  describe('Plugin Search', () => {
    test('should search plugins by query', async () => {
      const results = await pluginManager.searchPlugins('git');

      expect(Array.isArray(results)).toBe(true);
    });

    test('should limit search results', async () => {
      const results = await pluginManager.searchPlugins('plugin', { limit: 5 });

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Plugin Updates', () => {
    test('should update plugin', async () => {
      const pluginPath = await testHelper.createPlugin('update-plugin', []);
      await pluginManager.loadPlugin('update-plugin');

      await expect(
        pluginManager.updatePlugin('update-plugin')
      ).resolves.not.toThrow();
    });

    test('should update all plugins', async () => {
      await testHelper.createPlugin('plugin1', []);
      await testHelper.createPlugin('plugin2', []);

      await expect(pluginManager.updateAllPlugins()).resolves.not.toThrow();
    });
  });

  describe('Plugin Development', () => {
    test('should link plugin for development', async () => {
      const pluginPath = await testHelper.createPlugin('dev-plugin', []);

      await pluginManager.linkPlugin(pluginPath);

      const linkedPath = path.join(
        process.cwd(),
        '.wundr',
        'plugins',
        'dev-plugin'
      );
      const stats = await fs.lstat(linkedPath);
      expect(stats.isSymbolicLink()).toBe(true);
    });

    test('should unlink plugin', async () => {
      const pluginPath = await testHelper.createPlugin('unlink-plugin', []);
      await pluginManager.linkPlugin(pluginPath);

      await pluginManager.unlinkPlugin('unlink-plugin');

      const linkedPath = path.join(
        process.cwd(),
        '.wundr',
        'plugins',
        'unlink-plugin'
      );
      expect(await fs.pathExists(linkedPath)).toBe(false);
    });

    test('should test plugin', async () => {
      const pluginPath = await testHelper.createPlugin('test-plugin', []);

      await expect(
        pluginManager.testPlugin('test-plugin')
      ).resolves.not.toThrow();
    });

    test('should test plugin with coverage', async () => {
      const pluginPath = await testHelper.createPlugin('coverage-plugin', []);

      await pluginManager.testPlugin('coverage-plugin', { coverage: true });

      expect(mockSpawn).toHaveBeenCalledWith(
        'npm',
        ['run', 'test:coverage'],
        expect.any(Object)
      );
    });

    test('should publish plugin', async () => {
      await expect(pluginManager.publishPlugin()).resolves.not.toThrow();
    });
  });

  describe('Plugin Configuration', () => {
    test('should set plugin configuration', async () => {
      await pluginManager.setPluginConfig('test-plugin', 'option', 'value');

      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'plugins.test-plugin.option',
        'value'
      );
    });

    test('should get plugin configuration', async () => {
      mockConfigManager.get.mockReturnValue('test-value');

      const value = await pluginManager.getPluginConfig(
        'test-plugin',
        'option'
      );

      expect(value).toBe('test-value');
    });

    test('should get all plugin configuration', async () => {
      mockConfigManager.get.mockReturnValue({
        option1: 'value1',
        option2: 'value2',
      });

      const config = await pluginManager.getPluginConfig('test-plugin');

      expect(config).toMatchObject({
        option1: 'value1',
        option2: 'value2',
      });
    });
  });

  describe('Plugin Commands and Hooks', () => {
    test('should register plugin commands', () => {
      const command = {
        name: 'test-command',
        description: 'Test command',
        action: jest.fn(),
      };

      pluginManager.registerPluginCommand('test-plugin', command);

      const commands = pluginManager.getPluginCommands();
      expect(commands.has('test-plugin:test-command')).toBe(true);
    });

    test('should register plugin hooks', () => {
      const hook = {
        event: 'test-event',
        handler: jest.fn(),
      };

      pluginManager.registerPluginHook('test-plugin', hook);

      // Verify hook is registered (private method testing)
      expect((pluginManager as any).pluginHooks.has('test-event')).toBe(true);
    });

    test('should execute plugin hooks', async () => {
      const handler = jest.fn();
      const hook = {
        event: 'test-event',
        handler,
      };

      pluginManager.registerPluginHook('test-plugin', hook);
      await pluginManager.executePluginHooks('test-event', { data: 'test' });

      expect(handler).toHaveBeenCalledWith(
        { data: 'test' },
        expect.any(Object)
      );
    });

    test('should handle hook execution failures gracefully', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Hook failed'));
      const hook = {
        event: 'failing-event',
        handler,
      };

      pluginManager.registerPluginHook('test-plugin', hook);

      // Should not throw, but log warnings
      await expect(
        pluginManager.executePluginHooks('failing-event', {})
      ).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', async () => {
      jest.spyOn(fs, 'pathExists').mockRejectedValue(new Error('FS Error'));

      const result = await pluginManager.isPluginInstalled('test-plugin');
      // Should handle error gracefully
      expect(typeof result).toBe('boolean');
    });

    test('should create proper error contexts', async () => {
      try {
        await pluginManager.loadPlugin('non-existent-plugin');
      } catch (error: any) {
        expect(error.message).toContain('Failed to load plugin');
      }
    });
  });
});
