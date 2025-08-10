import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config-manager';
import { PluginManager } from '../plugins/plugin-manager';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/error-handler';

/**
 * Plugin commands for managing CLI extensions
 */
export class PluginCommands {
  constructor(
    private program: Command,
    private configManager: ConfigManager,
    private pluginManager: PluginManager
  ) {
    this.registerCommands();
  }

  private registerCommands(): void {
    const pluginCmd = this.program
      .command('plugin')
      .alias('plugins')
      .description('manage CLI plugins and extensions');

    // List plugins
    pluginCmd
      .command('list')
      .alias('ls')
      .description('list installed plugins')
      .option('--available', 'show available plugins from registry')
      .option('--enabled-only', 'show only enabled plugins')
      .action(async (options) => {
        await this.listPlugins(options);
      });

    // Install plugin
    pluginCmd
      .command('install <plugin>')
      .description('install a plugin')
      .option('--version <version>', 'specific version to install')
      .option('--registry <url>', 'custom registry URL')
      .option('--force', 'force reinstall if already exists')
      .action(async (plugin, options) => {
        await this.installPlugin(plugin, options);
      });

    // Uninstall plugin
    pluginCmd
      .command('uninstall <plugin>')
      .alias('remove')
      .description('uninstall a plugin')
      .option('--force', 'skip confirmation')
      .action(async (plugin, options) => {
        await this.uninstallPlugin(plugin, options);
      });

    // Enable plugin
    pluginCmd
      .command('enable <plugin>')
      .description('enable a plugin')
      .action(async (plugin) => {
        await this.enablePlugin(plugin);
      });

    // Disable plugin
    pluginCmd
      .command('disable <plugin>')
      .description('disable a plugin')
      .action(async (plugin) => {
        await this.disablePlugin(plugin);
      });

    // Plugin info
    pluginCmd
      .command('info <plugin>')
      .description('show plugin information')
      .action(async (plugin) => {
        await this.showPluginInfo(plugin);
      });

    // Update plugins
    pluginCmd
      .command('update [plugin]')
      .description('update plugin(s)')
      .option('--all', 'update all plugins')
      .action(async (plugin, options) => {
        await this.updatePlugin(plugin, options);
      });

    // Create plugin
    pluginCmd
      .command('create <name>')
      .description('create a new plugin')
      .option('--template <template>', 'plugin template', 'basic')
      .option('--interactive', 'create plugin interactively')
      .action(async (name, options) => {
        await this.createPlugin(name, options);
      });

    // Publish plugin
    pluginCmd
      .command('publish')
      .description('publish plugin to registry')
      .option('--registry <url>', 'registry URL')
      .option('--dry-run', 'show what would be published')
      .action(async (options) => {
        await this.publishPlugin(options);
      });

    // Search plugins
    pluginCmd
      .command('search <query>')
      .description('search for plugins')
      .option('--registry <url>', 'registry URL')
      .option('--limit <count>', 'limit results', '20')
      .action(async (query, options) => {
        await this.searchPlugins(query, options);
      });

    // Plugin development
    pluginCmd
      .command('dev')
      .description('plugin development tools');

    pluginCmd
      .command('dev link <path>')
      .description('link local plugin for development')
      .action(async (pluginPath) => {
        await this.linkPlugin(pluginPath);
      });

    pluginCmd
      .command('dev unlink <plugin>')
      .description('unlink development plugin')
      .action(async (plugin) => {
        await this.unlinkPlugin(plugin);
      });

    pluginCmd
      .command('dev test <plugin>')
      .description('test a plugin')
      .option('--coverage', 'run with coverage')
      .action(async (plugin, options) => {
        await this.testPlugin(plugin, options);
      });

    // Plugin configuration
    pluginCmd
      .command('config <plugin>')
      .description('configure plugin settings');

    pluginCmd
      .command('config <plugin> set <key> <value>')
      .description('set plugin configuration')
      .action(async (plugin, key, value) => {
        await this.setPluginConfig(plugin, key, value);
      });

    pluginCmd
      .command('config <plugin> get [key]')
      .description('get plugin configuration')
      .action(async (plugin, key) => {
        await this.getPluginConfig(plugin, key);
      });
  }

  /**
   * List installed plugins
   */
  private async listPlugins(options: any): Promise<void> {
    try {
      if (options.available) {
        await this.listAvailablePlugins();
      } else {
        await this.listInstalledPlugins(options.enabledOnly);
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_LIST_FAILED',
        'Failed to list plugins',
        { options },
        true
      );
    }
  }

  /**
   * Install a plugin
   */
  private async installPlugin(plugin: string, options: any): Promise<void> {
    try {
      logger.info(`Installing plugin: ${chalk.cyan(plugin)}`);

      // Check if plugin already exists
      if (!options.force && await this.pluginManager.isPluginInstalled(plugin)) {
        logger.warn(`Plugin ${plugin} is already installed. Use --force to reinstall.`);
        return;
      }

      await this.pluginManager.installPlugin(plugin, {
        version: options.version,
        registry: options.registry,
        force: options.force
      });

      logger.success(`Plugin ${plugin} installed successfully`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_INSTALL_FAILED',
        'Failed to install plugin',
        { plugin, options },
        true
      );
    }
  }

  /**
   * Uninstall a plugin
   */
  private async uninstallPlugin(plugin: string, options: any): Promise<void> {
    try {
      if (!await this.pluginManager.isPluginInstalled(plugin)) {
        logger.warn(`Plugin ${plugin} is not installed`);
        return;
      }

      if (!options.force) {
        const inquirer = await import('inquirer');
        const { confirm } = await inquirer.default.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Uninstall plugin ${plugin}?`,
          default: false
        }]);

        if (!confirm) {
          logger.info('Uninstall cancelled');
          return;
        }
      }

      await this.pluginManager.uninstallPlugin(plugin);
      logger.success(`Plugin ${plugin} uninstalled successfully`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_UNINSTALL_FAILED',
        'Failed to uninstall plugin',
        { plugin, options },
        true
      );
    }
  }

  /**
   * Enable a plugin
   */
  private async enablePlugin(plugin: string): Promise<void> {
    try {
      if (!await this.pluginManager.isPluginInstalled(plugin)) {
        throw new Error(`Plugin ${plugin} is not installed`);
      }

      await this.pluginManager.enablePlugin(plugin);
      logger.success(`Plugin ${plugin} enabled`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_ENABLE_FAILED',
        'Failed to enable plugin',
        { plugin },
        true
      );
    }
  }

  /**
   * Disable a plugin
   */
  private async disablePlugin(plugin: string): Promise<void> {
    try {
      if (!await this.pluginManager.isPluginInstalled(plugin)) {
        throw new Error(`Plugin ${plugin} is not installed`);
      }

      await this.pluginManager.disablePlugin(plugin);
      logger.success(`Plugin ${plugin} disabled`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_DISABLE_FAILED',
        'Failed to disable plugin',
        { plugin },
        true
      );
    }
  }

  /**
   * Show plugin information
   */
  private async showPluginInfo(plugin: string): Promise<void> {
    try {
      const pluginInfo = await this.pluginManager.getPluginInfo(plugin);
      
      if (!pluginInfo) {
        logger.warn(`Plugin ${plugin} not found`);
        return;
      }

      console.log(chalk.blue(`\nPlugin Information: ${plugin}`));
      console.log(`Name: ${pluginInfo.name}`);
      console.log(`Version: ${pluginInfo.version}`);
      console.log(`Description: ${pluginInfo.description || 'No description'}`);
      console.log(`Author: ${pluginInfo.author || 'Unknown'}`);
      console.log(`Status: ${pluginInfo.enabled ? 'Enabled' : 'Disabled'}`);
      console.log(`Commands: ${pluginInfo.commands?.length || 0}`);
      console.log(`Hooks: ${pluginInfo.hooks?.length || 0}`);
      
      if (pluginInfo.dependencies && pluginInfo.dependencies.length > 0) {
        console.log(`Dependencies: ${pluginInfo.dependencies.join(', ')}`);
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_INFO_FAILED',
        'Failed to show plugin info',
        { plugin },
        true
      );
    }
  }

  /**
   * Update plugin(s)
   */
  private async updatePlugin(plugin: string, options: any): Promise<void> {
    try {
      if (options.all) {
        logger.info('Updating all plugins...');
        await this.pluginManager.updateAllPlugins();
        logger.success('All plugins updated');
      } else if (plugin) {
        logger.info(`Updating plugin: ${chalk.cyan(plugin)}`);
        await this.pluginManager.updatePlugin(plugin);
        logger.success(`Plugin ${plugin} updated`);
      } else {
        throw new Error('Specify a plugin name or use --all');
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_UPDATE_FAILED',
        'Failed to update plugin(s)',
        { plugin, options },
        true
      );
    }
  }

  /**
   * Create a new plugin
   */
  private async createPlugin(name: string, options: any): Promise<void> {
    try {
      logger.info(`Creating plugin: ${chalk.cyan(name)}`);

      let pluginConfig: any;

      if (options.interactive) {
        pluginConfig = await this.createInteractivePlugin(name);
      } else {
        pluginConfig = await this.createPluginFromTemplate(name, options.template);
      }

      const pluginPath = path.join(process.cwd(), name);
      await this.generatePluginStructure(pluginPath, pluginConfig);

      logger.success(`Plugin ${name} created at ${pluginPath}`);
      logger.info('Next steps:');
      logger.info(`  cd ${name}`);
      logger.info('  npm install');
      logger.info('  wundr plugin dev link .');

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_CREATE_FAILED',
        'Failed to create plugin',
        { name, options },
        true
      );
    }
  }

  /**
   * Publish plugin to registry
   */
  private async publishPlugin(options: any): Promise<void> {
    try {
      logger.info('Publishing plugin...');

      if (options.dryRun) {
        logger.info('Dry run - would publish:');
        // Show what would be published
      } else {
        await this.pluginManager.publishPlugin({
          registry: options.registry
        });
        logger.success('Plugin published successfully');
      }

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
   * Search for plugins
   */
  private async searchPlugins(query: string, options: any): Promise<void> {
    try {
      logger.info(`Searching for plugins: ${chalk.cyan(query)}`);

      const results = await this.pluginManager.searchPlugins(query, {
        registry: options.registry,
        limit: parseInt(options.limit)
      });

      if (results.length === 0) {
        logger.info('No plugins found');
        return;
      }

      console.log(`\nFound ${results.length} plugin(s):`);
      console.table(results.map(plugin => ({
        Name: plugin.name,
        Version: plugin.version,
        Description: plugin.description || 'No description',
        Downloads: plugin.downloads || 0,
        Updated: plugin.updated ? new Date(plugin.updated).toLocaleDateString() : 'Unknown'
      })));

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_SEARCH_FAILED',
        'Failed to search plugins',
        { query, options },
        true
      );
    }
  }

  /**
   * Link local plugin for development
   */
  private async linkPlugin(pluginPath: string): Promise<void> {
    try {
      const absolutePath = path.resolve(pluginPath);
      
      if (!await fs.pathExists(absolutePath)) {
        throw new Error(`Plugin path does not exist: ${absolutePath}`);
      }

      await this.pluginManager.linkPlugin(absolutePath);
      logger.success(`Plugin linked: ${absolutePath}`);

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
   * Unlink development plugin
   */
  private async unlinkPlugin(plugin: string): Promise<void> {
    try {
      await this.pluginManager.unlinkPlugin(plugin);
      logger.success(`Plugin unlinked: ${plugin}`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_UNLINK_FAILED',
        'Failed to unlink plugin',
        { plugin },
        true
      );
    }
  }

  /**
   * Test a plugin
   */
  private async testPlugin(plugin: string, options: any): Promise<void> {
    try {
      logger.info(`Testing plugin: ${chalk.cyan(plugin)}`);

      await this.pluginManager.testPlugin(plugin, {
        coverage: options.coverage
      });

      logger.success(`Plugin ${plugin} tests passed`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_TEST_FAILED',
        'Failed to test plugin',
        { plugin, options },
        true
      );
    }
  }

  /**
   * Set plugin configuration
   */
  private async setPluginConfig(plugin: string, key: string, value: string): Promise<void> {
    try {
      await this.pluginManager.setPluginConfig(plugin, key, value);
      logger.success(`Plugin configuration updated: ${plugin}.${key} = ${value}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_CONFIG_SET_FAILED',
        'Failed to set plugin configuration',
        { plugin, key, value },
        true
      );
    }
  }

  /**
   * Get plugin configuration
   */
  private async getPluginConfig(plugin: string, key?: string): Promise<void> {
    try {
      if (key) {
        const value = await this.pluginManager.getPluginConfig(plugin, key);
        console.log(`${key}: ${value}`);
      } else {
        const config = await this.pluginManager.getPluginConfig(plugin);
        console.log(JSON.stringify(config, null, 2));
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_PLUGIN_CONFIG_GET_FAILED',
        'Failed to get plugin configuration',
        { plugin, key },
        true
      );
    }
  }

  /**
   * Helper methods for plugin operations
   */
  private async listInstalledPlugins(enabledOnly: boolean = false): Promise<void> {
    const plugins = await this.pluginManager.getInstalledPlugins();
    const filteredPlugins = enabledOnly ? plugins.filter(p => p.enabled) : plugins;

    if (filteredPlugins.length === 0) {
      logger.info(enabledOnly ? 'No enabled plugins found' : 'No plugins installed');
      return;
    }

    logger.info(`${enabledOnly ? 'Enabled plugins' : 'Installed plugins'} (${filteredPlugins.length}):`);
    
    const pluginData = filteredPlugins.map(plugin => ({
      Name: plugin.name,
      Version: plugin.version,
      Status: plugin.enabled ? '✅ Enabled' : '❌ Disabled',
      Commands: plugin.commands?.length || 0,
      Description: plugin.description || 'No description'
    }));

    console.table(pluginData);
  }

  private async listAvailablePlugins(): Promise<void> {
    const plugins = await this.pluginManager.getAvailablePlugins();

    if (plugins.length === 0) {
      logger.info('No plugins available in registry');
      return;
    }

    logger.info(`Available plugins (${plugins.length}):`);
    
    const pluginData = plugins.map(plugin => ({
      Name: plugin.name,
      Version: plugin.version,
      Downloads: plugin.downloads || 0,
      Updated: plugin.updated ? new Date(plugin.updated).toLocaleDateString() : 'Unknown',
      Description: plugin.description || 'No description'
    }));

    console.table(pluginData);
  }

  private async createInteractivePlugin(name: string): Promise<any> {
    const inquirer = await import('inquirer');
    
    return await inquirer.default.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Plugin description:'
      },
      {
        type: 'input',
        name: 'author',
        message: 'Author name:'
      },
      {
        type: 'input',
        name: 'version',
        message: 'Initial version:',
        default: '1.0.0'
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Plugin features:',
        choices: [
          'Commands',
          'Hooks',
          'Configuration',
          'Templates',
          'Middleware'
        ]
      }
    ]);
  }

  private async createPluginFromTemplate(name: string, template: string): Promise<any> {
    const templates: Record<string, any> = {
      basic: {
        description: `A basic Wundr plugin: ${name}`,
        features: ['Commands']
      },
      advanced: {
        description: `An advanced Wundr plugin: ${name}`,
        features: ['Commands', 'Hooks', 'Configuration']
      },
      template: {
        description: `A template-based Wundr plugin: ${name}`,
        features: ['Templates', 'Commands']
      }
    };

    return templates[template] || templates['basic'];
  }

  private async generatePluginStructure(pluginPath: string, config: any): Promise<void> {
    await fs.ensureDir(pluginPath);

    // Create package.json
    const packageJson = {
      name: path.basename(pluginPath),
      version: config.version || '1.0.0',
      description: config.description,
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      files: ['dist'],
      scripts: {
        build: 'tsc',
        dev: 'tsc --watch',
        test: 'jest'
      },
      peerDependencies: {
        '@wundr/cli': '^1.0.0'
      },
      devDependencies: {
        typescript: '^5.0.0',
        '@types/node': '^20.0.0',
        jest: '^29.0.0'
      },
      wundr: {
        plugin: true,
        commands: config.features?.includes('Commands') || false,
        hooks: config.features?.includes('Hooks') || false,
        templates: config.features?.includes('Templates') || false
      }
    };

    await fs.writeJson(path.join(pluginPath, 'package.json'), packageJson, { spaces: 2 });

    // Create TypeScript config
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'CommonJS',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    };

    await fs.writeJson(path.join(pluginPath, 'tsconfig.json'), tsConfig, { spaces: 2 });

    // Create source directory and files
    const srcDir = path.join(pluginPath, 'src');
    await fs.ensureDir(srcDir);

    // Create main plugin file
    const pluginCode = this.generatePluginCode(path.basename(pluginPath), config);
    await fs.writeFile(path.join(srcDir, 'index.ts'), pluginCode);

    // Create README
    const readme = this.generatePluginReadme(path.basename(pluginPath), config);
    await fs.writeFile(path.join(pluginPath, 'README.md'), readme);
  }

  private generatePluginCode(name: string, config: any): string {
    return `import { Plugin, PluginContext } from '@wundr/cli';

export default class ${this.toPascalCase(name)}Plugin implements Plugin {
  name = '${name}';
  version = '${config.version || '1.0.0'}';
  description = '${config.description}';

  async activate(context: PluginContext): Promise<void> {
    // Plugin activation logic
    context.logger.info('${name} plugin activated');

    ${config.features?.includes('Commands') ? this.generateCommandCode(name) : ''}
    ${config.features?.includes('Hooks') ? this.generateHookCode(name) : ''}
  }

  async deactivate(): Promise<void> {
    // Plugin deactivation logic
  }
}
`;
  }

  private generateCommandCode(name: string): string {
    return `
    // Register commands
    context.registerCommand({
      name: '${name}',
      description: '${name} plugin command',
      action: async (args, options, ctx) => {
        ctx.logger.info('${name} command executed');
      }
    });
`;
  }

  private generateHookCode(name: string): string {
    return `
    // Register hooks
    context.registerHook({
      event: 'before-command',
      handler: async (data, ctx) => {
        ctx.logger.debug('${name} hook: before-command');
      }
    });
`;
  }

  private generatePluginReadme(name: string, config: any): string {
    return `# ${name}

${config.description}

## Installation

\`\`\`bash
wundr plugin install ${name}
\`\`\`

## Usage

\`\`\`bash
wundr ${name}
\`\`\`

## Development

\`\`\`bash
npm install
npm run build
wundr plugin dev link .
\`\`\`

## License

MIT
`;
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_\s]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}