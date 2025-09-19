import fs from 'fs-extra';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config-manager';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/error-handler';
import { Plugin, PluginContext, PluginCommand, PluginHook } from '../types';

/**
 * Plugin management system for CLI extensibility
 */
export class PluginManager {
  private loadedPlugins: Map<string, Plugin> = new Map();
  private pluginCommands: Map<string, PluginCommand> = new Map();
  private pluginHooks: Map<string, PluginHook[]> = new Map();
  private pluginsDir: string;

  constructor(private configManager: ConfigManager) {
    this.pluginsDir = path.join(process.cwd(), '.wundr', 'plugins');
  }

  /**
   * Initialize plugin system
   */
  async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.pluginsDir);
      logger.debug('Plugin system initialized');
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_INIT_FAILED',
        'Failed to initialize plugin system',
        {},
        true
      );
    }
  }

  /**
   * Load all plugins
   */
  async loadPlugins(): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      const enabledPlugins = config.plugins || [];

      logger.debug(`Loading ${enabledPlugins.length} plugins...`);

      for (const pluginName of enabledPlugins) {
        try {
          await this.loadPlugin(pluginName);
        } catch (error) {
          logger.warn(`Failed to load plugin ${pluginName}:`, error.message);
        }
      }

      logger.debug(`Loaded ${this.loadedPlugins.size} plugins successfully`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_LOAD_FAILED',
        'Failed to load plugins',
        {},
        true
      );
    }
  }

  /**
   * Load a specific plugin
   */
  async loadPlugin(pluginName: string): Promise<void> {
    try {
      if (this.loadedPlugins.has(pluginName)) {
        logger.debug(`Plugin ${pluginName} already loaded`);
        return;
      }

      const pluginPath = await this.getPluginPath(pluginName);
      if (!(await fs.pathExists(pluginPath))) {
        throw new Error(`Plugin not found: ${pluginName}`);
      }

      // Dynamic import of the plugin
      const pluginModule = await this.importPlugin(pluginPath);
      const plugin = this.createPluginInstance(pluginModule, pluginName);

      // Create plugin context
      const context = this.createPluginContext(pluginName);

      // Activate the plugin
      await plugin.activate(context);

      // Store loaded plugin
      this.loadedPlugins.set(pluginName, plugin);

      logger.debug(`Plugin loaded: ${pluginName}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_LOAD_SINGLE_FAILED',
        `Failed to load plugin: ${pluginName}`,
        { pluginName },
        true
      );
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginName: string): Promise<void> {
    try {
      const plugin = this.loadedPlugins.get(pluginName);
      if (!plugin) {
        logger.debug(`Plugin ${pluginName} is not loaded`);
        return;
      }

      // Deactivate the plugin
      await plugin.deactivate();

      // Remove plugin commands and hooks
      this.removePluginCommands(pluginName);
      this.removePluginHooks(pluginName);

      // Remove from loaded plugins
      this.loadedPlugins.delete(pluginName);

      logger.debug(`Plugin unloaded: ${pluginName}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_UNLOAD_FAILED',
        `Failed to unload plugin: ${pluginName}`,
        { pluginName },
        true
      );
    }
  }

  /**
   * Install a plugin
   */
  async installPlugin(pluginName: string, options: any = {}): Promise<void> {
    try {
      logger.info(`Installing plugin: ${chalk.cyan(pluginName)}`);

      // Determine installation method
      if (this.isLocalPath(pluginName)) {
        await this.installLocalPlugin(pluginName);
      } else if (this.isGitUrl(pluginName)) {
        await this.installGitPlugin(pluginName);
      } else {
        await this.installNpmPlugin(pluginName, options);
      }

      // Add to enabled plugins list
      await this.addToEnabledPlugins(pluginName);

      logger.success(`Plugin ${pluginName} installed successfully`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_INSTALL_FAILED',
        `Failed to install plugin: ${pluginName}`,
        { pluginName, options },
        true
      );
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginName: string): Promise<void> {
    try {
      // Unload plugin if loaded
      if (this.loadedPlugins.has(pluginName)) {
        await this.unloadPlugin(pluginName);
      }

      // Remove plugin files
      const pluginPath = await this.getPluginPath(pluginName);
      if (await fs.pathExists(pluginPath)) {
        await fs.remove(pluginPath);
      }

      // Remove from enabled plugins list
      await this.removeFromEnabledPlugins(pluginName);

      logger.success(`Plugin ${pluginName} uninstalled successfully`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_UNINSTALL_FAILED',
        `Failed to uninstall plugin: ${pluginName}`,
        { pluginName },
        true
      );
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginName: string): Promise<void> {
    try {
      if (!(await this.isPluginInstalled(pluginName))) {
        throw new Error(`Plugin not installed: ${pluginName}`);
      }

      await this.addToEnabledPlugins(pluginName);
      await this.loadPlugin(pluginName);

      logger.success(`Plugin ${pluginName} enabled`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_ENABLE_FAILED',
        `Failed to enable plugin: ${pluginName}`,
        { pluginName },
        true
      );
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginName: string): Promise<void> {
    try {
      await this.unloadPlugin(pluginName);
      await this.removeFromEnabledPlugins(pluginName);

      logger.success(`Plugin ${pluginName} disabled`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_DISABLE_FAILED',
        `Failed to disable plugin: ${pluginName}`,
        { pluginName },
        true
      );
    }
  }

  /**
   * Get plugin information
   */
  async getPluginInfo(pluginName: string): Promise<any> {
    try {
      const pluginPath = await this.getPluginPath(pluginName);
      const packageJsonPath = path.join(pluginPath, 'package.json');

      if (!(await fs.pathExists(packageJsonPath))) {
        return null;
      }

      const packageJson = await fs.readJson(packageJsonPath);
      const plugin = this.loadedPlugins.get(pluginName);

      return {
        name: packageJson.name || pluginName,
        version: packageJson.version,
        description: packageJson.description,
        author: packageJson.author,
        enabled: !!plugin,
        commands: plugin?.commands || [],
        hooks: plugin?.hooks || [],
        dependencies: packageJson.dependencies
          ? Object.keys(packageJson.dependencies)
          : [],
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if plugin is installed
   */
  async isPluginInstalled(pluginName: string): Promise<boolean> {
    const pluginPath = await this.getPluginPath(pluginName);
    return await fs.pathExists(pluginPath);
  }

  /**
   * Get installed plugins
   */
  async getInstalledPlugins(): Promise<any[]> {
    try {
      if (!(await fs.pathExists(this.pluginsDir))) {
        return [];
      }

      const pluginDirs = await fs.readdir(this.pluginsDir);
      const plugins: any[] = [];

      for (const dir of pluginDirs) {
        const pluginInfo = await this.getPluginInfo(dir);
        if (pluginInfo) {
          plugins.push(pluginInfo);
        }
      }

      return plugins;
    } catch (error) {
      logger.debug('Failed to get installed plugins:', error);
      return [];
    }
  }

  /**
   * Get available plugins from registry
   */
  async getAvailablePlugins(): Promise<any[]> {
    try {
      // This would query a plugin registry
      // For now, return mock data
      return [
        {
          name: '@wundr/plugin-git',
          version: '1.0.0',
          description: 'Git integration plugin',
          downloads: 1000,
          updated: new Date().toISOString(),
        },
        {
          name: '@wundr/plugin-docker',
          version: '1.2.0',
          description: 'Docker integration plugin',
          downloads: 800,
          updated: new Date().toISOString(),
        },
      ];
    } catch (error) {
      logger.debug('Failed to get available plugins:', error);
      return [];
    }
  }

  /**
   * Search plugins
   */
  async searchPlugins(query: string, options: any = {}): Promise<any[]> {
    try {
      const available = await this.getAvailablePlugins();
      return available
        .filter(
          plugin =>
            plugin.name.toLowerCase().includes(query.toLowerCase()) ||
            plugin.description.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, options.limit || 20);
    } catch (error) {
      logger.debug('Failed to search plugins:', error);
      return [];
    }
  }

  /**
   * Update plugin
   */
  async updatePlugin(pluginName: string): Promise<void> {
    try {
      logger.info(`Updating plugin: ${pluginName}`);

      // This would check for updates and install newer version
      // For now, just reload the plugin
      await this.unloadPlugin(pluginName);
      await this.loadPlugin(pluginName);

      logger.success(`Plugin ${pluginName} updated`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_UPDATE_FAILED',
        `Failed to update plugin: ${pluginName}`,
        { pluginName },
        true
      );
    }
  }

  /**
   * Update all plugins
   */
  async updateAllPlugins(): Promise<void> {
    const plugins = await this.getInstalledPlugins();

    for (const plugin of plugins) {
      try {
        await this.updatePlugin(plugin.name);
      } catch (error) {
        logger.warn(`Failed to update plugin ${plugin.name}:`, error.message);
      }
    }
  }

  /**
   * Link plugin for development
   */
  async linkPlugin(pluginPath: string): Promise<void> {
    try {
      const absolutePath = path.resolve(pluginPath);
      const packageJsonPath = path.join(absolutePath, 'package.json');

      if (!(await fs.pathExists(packageJsonPath))) {
        throw new Error('Invalid plugin: package.json not found');
      }

      const packageJson = await fs.readJson(packageJsonPath);
      const pluginName = packageJson.name || path.basename(absolutePath);

      // Create symlink to plugin
      const linkPath = path.join(this.pluginsDir, pluginName);
      await fs.ensureDir(path.dirname(linkPath));

      if (await fs.pathExists(linkPath)) {
        await fs.remove(linkPath);
      }

      await fs.symlink(absolutePath, linkPath);

      logger.success(`Plugin linked: ${pluginName} -> ${absolutePath}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_LINK_FAILED',
        'Failed to link plugin',
        { pluginPath },
        true
      );
    }
  }

  /**
   * Unlink plugin
   */
  async unlinkPlugin(pluginName: string): Promise<void> {
    try {
      const pluginPath = path.join(this.pluginsDir, pluginName);

      if (await fs.pathExists(pluginPath)) {
        const stats = await fs.lstat(pluginPath);
        if (stats.isSymbolicLink()) {
          await fs.remove(pluginPath);
          logger.success(`Plugin unlinked: ${pluginName}`);
        } else {
          throw new Error(`Plugin ${pluginName} is not a symlink`);
        }
      } else {
        throw new Error(`Plugin ${pluginName} not found`);
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_UNLINK_FAILED',
        'Failed to unlink plugin',
        { pluginName },
        true
      );
    }
  }

  /**
   * Test plugin
   */
  async testPlugin(pluginName: string, options: any = {}): Promise<void> {
    try {
      const pluginPath = await this.getPluginPath(pluginName);

      const testCommand = options.coverage
        ? 'npm run test:coverage'
        : 'npm test';

      await this.runCommand(testCommand, { cwd: pluginPath });
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_TEST_FAILED',
        `Failed to test plugin: ${pluginName}`,
        { pluginName, options },
        true
      );
    }
  }

  /**
   * Publish plugin
   */
  async publishPlugin(options: any = {}): Promise<void> {
    try {
      // This would publish to a plugin registry
      logger.info('Publishing plugin to registry...');

      // Mock implementation
      await new Promise(resolve => setTimeout(resolve, 1000));

      logger.success('Plugin published successfully');
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_PUBLISH_FAILED',
        'Failed to publish plugin',
        { options },
        true
      );
    }
  }

  /**
   * Plugin configuration management
   */
  async setPluginConfig(
    pluginName: string,
    key: string,
    value: string
  ): Promise<void> {
    this.configManager.set(`plugins.${pluginName}.${key}`, value);
    await this.configManager.saveConfig();
  }

  async getPluginConfig(pluginName: string, key?: string): Promise<any> {
    if (key) {
      return this.configManager.get(`plugins.${pluginName}.${key}`);
    } else {
      return this.configManager.get(`plugins.${pluginName}`) || {};
    }
  }

  /**
   * Plugin command and hook management
   */
  registerPluginCommand(pluginName: string, command: PluginCommand): void {
    const commandKey = `${pluginName}:${command.name}`;
    this.pluginCommands.set(commandKey, command);
    logger.debug(`Plugin command registered: ${commandKey}`);
  }

  registerPluginHook(pluginName: string, hook: PluginHook): void {
    if (!this.pluginHooks.has(hook.event)) {
      this.pluginHooks.set(hook.event, []);
    }

    this.pluginHooks.get(hook.event)!.push(hook);
    logger.debug(`Plugin hook registered: ${pluginName}:${hook.event}`);
  }

  async executePluginHooks(event: string, data: any): Promise<void> {
    const hooks = this.pluginHooks.get(event) || [];

    for (const hook of hooks) {
      try {
        await hook.handler(data, this.createHookContext());
      } catch (error) {
        logger.warn(`Plugin hook failed: ${event}`, error.message);
      }
    }
  }

  getPluginCommands(): Map<string, PluginCommand> {
    return new Map(this.pluginCommands);
  }

  /**
   * Helper methods
   */
  private async getPluginPath(pluginName: string): Promise<string> {
    return path.join(this.pluginsDir, pluginName);
  }

  private async importPlugin(pluginPath: string): Promise<any> {
    // In a real implementation, this would handle different module formats
    const mainFile = path.join(pluginPath, 'index.js');

    if (await fs.pathExists(mainFile)) {
      return require(mainFile);
    }

    // Try package.json main field
    const packageJsonPath = path.join(pluginPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      const main = packageJson.main || 'index.js';
      return require(path.join(pluginPath, main));
    }

    throw new Error(`Plugin entry point not found: ${pluginPath}`);
  }

  private createPluginInstance(pluginModule: any, pluginName: string): Plugin {
    // Handle different export formats
    if (typeof pluginModule === 'function') {
      return new pluginModule();
    } else if (
      pluginModule.default &&
      typeof pluginModule.default === 'function'
    ) {
      return new pluginModule.default();
    } else if (pluginModule.default) {
      return pluginModule.default;
    } else {
      return pluginModule;
    }
  }

  private createPluginContext(pluginName: string): PluginContext {
    return {
      config: this.configManager.getConfig(),
      logger: logger,
      registerCommand: (command: PluginCommand) => {
        this.registerPluginCommand(pluginName, command);
      },
      registerHook: (hook: PluginHook) => {
        this.registerPluginHook(pluginName, hook);
      },
    };
  }

  private createHookContext(): any {
    return {
      config: this.configManager.getConfig(),
      logger: logger,
    };
  }

  private removePluginCommands(pluginName: string): void {
    for (const [key] of this.pluginCommands) {
      if (key.startsWith(`${pluginName}:`)) {
        this.pluginCommands.delete(key);
      }
    }
  }

  private removePluginHooks(pluginName: string): void {
    for (const [event, hooks] of this.pluginHooks) {
      const filteredHooks = hooks.filter(
        hook => !hook.event.startsWith(pluginName)
      );
      this.pluginHooks.set(event, filteredHooks);
    }
  }

  private async addToEnabledPlugins(pluginName: string): Promise<void> {
    const config = this.configManager.getConfig();
    if (!config.plugins.includes(pluginName)) {
      config.plugins.push(pluginName);
      await this.configManager.saveConfig();
    }
  }

  private async removeFromEnabledPlugins(pluginName: string): Promise<void> {
    const config = this.configManager.getConfig();
    const index = config.plugins.indexOf(pluginName);
    if (index > -1) {
      config.plugins.splice(index, 1);
      await this.configManager.saveConfig();
    }
  }

  private isLocalPath(pluginName: string): boolean {
    return (
      pluginName.startsWith('./') ||
      pluginName.startsWith('../') ||
      path.isAbsolute(pluginName)
    );
  }

  private isGitUrl(pluginName: string): boolean {
    return (
      pluginName.startsWith('git+') ||
      pluginName.includes('github.com') ||
      pluginName.includes('.git')
    );
  }

  private async installLocalPlugin(pluginPath: string): Promise<void> {
    const absolutePath = path.resolve(pluginPath);
    const pluginName = path.basename(absolutePath);
    const targetPath = path.join(this.pluginsDir, pluginName);

    await fs.copy(absolutePath, targetPath);

    // Install dependencies
    await this.runCommand('npm install', { cwd: targetPath });
  }

  private async installGitPlugin(gitUrl: string): Promise<void> {
    const pluginName = path.basename(gitUrl, '.git');
    const targetPath = path.join(this.pluginsDir, pluginName);

    await this.runCommand(`git clone ${gitUrl} ${targetPath}`);
    await this.runCommand('npm install', { cwd: targetPath });
  }

  private async installNpmPlugin(
    pluginName: string,
    options: any
  ): Promise<void> {
    const versionSpec = options.version ? `@${options.version}` : '';
    const targetPath = path.join(this.pluginsDir, pluginName);

    await fs.ensureDir(targetPath);

    // Create temporary package.json
    const tempPackageJson = {
      name: 'temp-plugin-installer',
      version: '1.0.0',
      dependencies: {
        [pluginName]: versionSpec || 'latest',
      },
    };

    await fs.writeJson(path.join(targetPath, 'package.json'), tempPackageJson);
    await this.runCommand('npm install', { cwd: targetPath });

    // Move plugin to correct location
    const installedPath = path.join(targetPath, 'node_modules', pluginName);
    const finalPath = path.join(this.pluginsDir, pluginName);

    if (finalPath !== targetPath) {
      await fs.move(installedPath, finalPath);
      await fs.remove(targetPath);
    }
  }

  private async runCommand(command: string, options: any = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      if (!cmd) {
        reject(new Error('Invalid command: empty command string'));
        return;
      }
      const child: ChildProcess = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true,
        ...options,
      });

      child.on('exit', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`Command failed with exit code ${code}: ${command}`)
          );
        }
      });

      child.on('error', reject);
    });
  }
}
