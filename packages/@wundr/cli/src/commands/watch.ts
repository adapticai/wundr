import { Command } from 'commander';
import { watch, FSWatcher } from 'chokidar';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import YAML from 'yaml';
import { ConfigManager } from '../utils/config-manager';
import { PluginManager } from '../plugins/plugin-manager';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/error-handler';
import { WatchConfig, WatchCommand } from '../types';

/**
 * Watch commands for real-time monitoring
 */
export class WatchCommands {
  private watchers: Map<string, FSWatcher> = new Map();
  private activeWatches: Map<string, WatchConfig> = new Map();

  constructor(
    private program: Command,
    private configManager: ConfigManager,
    private pluginManager: PluginManager
  ) {
    this.registerCommands();
  }

  private registerCommands(): void {
    const watchCmd = this.program
      .command('watch')
      .description('real-time file and project monitoring');

    // Start watching
    watchCmd
      .command('start [patterns...]')
      .description('start watching files or directories')
      .option('--config <config>', 'watch configuration file')
      .option('--ignore <patterns>', 'patterns to ignore (comma-separated)')
      .option('--command <command>', 'command to run on changes')
      .option('--debounce <ms>', 'debounce delay in milliseconds', '300')
      .option('--recursive', 'watch subdirectories recursively')
      .action(async (patterns, options) => {
        await this.startWatching(patterns, options);
      });

    // Stop watching
    watchCmd
      .command('stop [name]')
      .description('stop specific watch or all watches')
      .action(async name => {
        await this.stopWatching(name);
      });

    // List active watches
    watchCmd
      .command('list')
      .alias('ls')
      .description('list active watches')
      .action(async () => {
        await this.listWatches();
      });

    // Watch status
    watchCmd
      .command('status [name]')
      .description('show watch status')
      .action(async name => {
        await this.showWatchStatus(name);
      });

    // Create watch config
    watchCmd
      .command('config create <name>')
      .description('create watch configuration')
      .option('--patterns <patterns>', 'file patterns to watch')
      .option('--commands <commands>', 'commands to run on changes')
      .option('--interactive', 'create configuration interactively')
      .action(async (name, options) => {
        await this.createWatchConfig(name, options);
      });

    // Load watch config
    watchCmd
      .command('config load <file>')
      .description('load watch configuration from file')
      .action(async file => {
        await this.loadWatchConfig(file);
      });

    // Save watch config
    watchCmd
      .command('config save <name> [file]')
      .description('save watch configuration to file')
      .action(async (name, file) => {
        await this.saveWatchConfig(name, file);
      });

    // Watch tests
    watchCmd
      .command('test')
      .description('watch and run tests on changes')
      .option(
        '--framework <framework>',
        'test framework (jest, mocha, vitest)',
        'jest'
      )
      .option('--coverage', 'run with coverage')
      .option('--changed-only', 'run tests for changed files only')
      .action(async options => {
        await this.watchTests(options);
      });

    // Watch build
    watchCmd
      .command('build')
      .description('watch and build on changes')
      .option('--target <target>', 'build target')
      .option('--incremental', 'enable incremental builds')
      .action(async options => {
        await this.watchBuild(options);
      });

    // Watch lint
    watchCmd
      .command('lint')
      .description('watch and lint on changes')
      .option('--fix', 'automatically fix linting issues')
      .option('--staged-only', 'lint staged files only')
      .action(async options => {
        await this.watchLint(options);
      });

    // Watch analysis
    watchCmd
      .command('analyze')
      .description('watch and analyze code quality')
      .option(
        '--type <type>',
        'analysis type (quality, deps, security)',
        'quality'
      )
      .option('--threshold <threshold>', 'quality threshold')
      .action(async options => {
        await this.watchAnalysis(options);
      });
  }

  /**
   * Start watching files or directories
   */
  private async startWatching(patterns: string[], options: any): Promise<void> {
    try {
      let watchConfig: WatchConfig;

      if (options.config) {
        watchConfig = await this.loadWatchConfigFile(options.config);
      } else {
        watchConfig = this.createWatchConfigFromOptions(patterns, options);
      }

      const watchName = `watch-${Date.now()}`;
      logger.info(`Starting watch: ${chalk.cyan(watchName)}`);

      const watcher = watch(watchConfig.patterns, {
        ignored: watchConfig.ignore || [],
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: parseInt(options.debounce) || 300,
          pollInterval: 100,
        },
      });

      // Set up event handlers
      this.setupWatchHandlers(watcher, watchConfig, watchName);

      // Store watcher and config
      this.watchers.set(watchName, watcher);
      this.activeWatches.set(watchName, watchConfig);

      logger.success(`Watching ${watchConfig.patterns.join(', ')}`);
      logger.info('Press Ctrl+C to stop watching');
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_WATCH_START_FAILED',
        'Failed to start watching',
        { patterns, options },
        true
      );
    }
  }

  /**
   * Stop watching
   */
  private async stopWatching(name?: string): Promise<void> {
    try {
      if (name) {
        const watcher = this.watchers.get(name);
        if (watcher) {
          await watcher.close();
          this.watchers.delete(name);
          this.activeWatches.delete(name);
          logger.success(`Stopped watch: ${name}`);
        } else {
          logger.warn(`Watch not found: ${name}`);
        }
      } else {
        // Stop all watches
        for (const [watchName, watcher] of this.watchers) {
          await watcher.close();
          logger.info(`Stopped watch: ${watchName}`);
        }
        this.watchers.clear();
        this.activeWatches.clear();
        logger.success('Stopped all watches');
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_WATCH_STOP_FAILED',
        'Failed to stop watching',
        { name },
        true
      );
    }
  }

  /**
   * List active watches
   */
  private async listWatches(): Promise<void> {
    try {
      if (this.activeWatches.size === 0) {
        logger.info('No active watches');
        return;
      }

      logger.info(`Active watches (${this.activeWatches.size}):`);

      const watchData = Array.from(this.activeWatches.entries()).map(
        ([name, config]) => ({
          Name: name,
          Patterns: config.patterns.join(', '),
          Commands: config.commands.length,
          Debounce: `${config.debounce || 300}ms`,
        })
      );

      console.table(watchData);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_WATCH_LIST_FAILED',
        'Failed to list watches',
        {},
        true
      );
    }
  }

  /**
   * Show watch status
   */
  private async showWatchStatus(name?: string): Promise<void> {
    try {
      if (name) {
        const config = this.activeWatches.get(name);
        const watcher = this.watchers.get(name);

        if (!config || !watcher) {
          logger.warn(`Watch not found: ${name}`);
          return;
        }

        console.log(chalk.blue(`\nWatch Status: ${name}`));
        console.log(`Patterns: ${config.patterns.join(', ')}`);
        console.log(`Commands: ${config.commands.length}`);
        console.log(`Debounce: ${config.debounce || 300}ms`);
        console.log(
          `Watched Paths: ${Object.keys(watcher.getWatched()).length}`
        );
      } else {
        console.log(chalk.blue('\nAll Watches Status:'));
        console.log(`Active Watches: ${this.activeWatches.size}`);
        console.log(`Total Watchers: ${this.watchers.size}`);

        for (const [watchName] of this.activeWatches) {
          await this.showWatchStatus(watchName);
        }
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_WATCH_STATUS_FAILED',
        'Failed to show watch status',
        { name },
        true
      );
    }
  }

  /**
   * Create watch configuration
   */
  private async createWatchConfig(name: string, options: any): Promise<void> {
    try {
      let config: WatchConfig;

      if (options.interactive) {
        config = await this.createInteractiveWatchConfig();
      } else {
        config = {
          patterns: options.patterns ? options.patterns.split(',') : ['**/*'],
          commands: options.commands
            ? this.parseWatchCommands(options.commands)
            : [],
          debounce: 300,
          recursive: true,
        };
      }

      const configPath = path.join(
        process.cwd(),
        '.wundr',
        'watch',
        `${name}.yaml`
      );
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeFile(configPath, YAML.stringify(config));

      logger.success(`Watch configuration created: ${configPath}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_WATCH_CONFIG_CREATE_FAILED',
        'Failed to create watch configuration',
        { name, options },
        true
      );
    }
  }

  /**
   * Load watch configuration from file
   */
  private async loadWatchConfig(file: string): Promise<void> {
    try {
      const config = await this.loadWatchConfigFile(file);
      const name = path.basename(file, path.extname(file));

      await this.startWatchingWithConfig(name, config);
      logger.success(`Loaded watch configuration: ${file}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_WATCH_CONFIG_LOAD_FAILED',
        'Failed to load watch configuration',
        { file },
        true
      );
    }
  }

  /**
   * Save watch configuration to file
   */
  private async saveWatchConfig(name: string, file?: string): Promise<void> {
    try {
      const config = this.activeWatches.get(name);
      if (!config) {
        throw new Error(`Watch not found: ${name}`);
      }

      const outputPath =
        file || path.join(process.cwd(), '.wundr', 'watch', `${name}.yaml`);
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, YAML.stringify(config));

      logger.success(`Watch configuration saved: ${outputPath}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_WATCH_CONFIG_SAVE_FAILED',
        'Failed to save watch configuration',
        { name, file },
        true
      );
    }
  }

  /**
   * Watch tests
   */
  private async watchTests(options: any): Promise<void> {
    try {
      logger.info('Starting test watcher...');

      const testPatterns = this.getTestPatterns(options.framework);
      const watchConfig: WatchConfig = {
        patterns: testPatterns,
        commands: [
          {
            trigger: 'change',
            command: this.getTestCommand(options.framework, options),
            condition: 'test-files',
          },
        ],
        debounce: 1000,
      };

      await this.startWatchingWithConfig('test-watch', watchConfig);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_WATCH_TEST_FAILED',
        'Failed to start test watcher',
        { options },
        true
      );
    }
  }

  /**
   * Watch build
   */
  private async watchBuild(options: any): Promise<void> {
    try {
      logger.info('Starting build watcher...');

      const buildPatterns = ['src/**/*', 'lib/**/*', '*.config.*'];
      const watchConfig: WatchConfig = {
        patterns: buildPatterns,
        commands: [
          {
            trigger: 'change',
            command: this.getBuildCommand(options),
            condition: 'source-files',
          },
        ],
        debounce: 500,
      };

      await this.startWatchingWithConfig('build-watch', watchConfig);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_WATCH_BUILD_FAILED',
        'Failed to start build watcher',
        { options },
        true
      );
    }
  }

  /**
   * Watch lint
   */
  private async watchLint(options: any): Promise<void> {
    try {
      logger.info('Starting lint watcher...');

      const lintPatterns = ['**/*.{ts,tsx,js,jsx}', '!node_modules/**'];
      const watchConfig: WatchConfig = {
        patterns: lintPatterns,
        commands: [
          {
            trigger: 'change',
            command: this.getLintCommand(options),
            condition: 'lint-files',
          },
        ],
        debounce: 300,
      };

      await this.startWatchingWithConfig('lint-watch', watchConfig);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_WATCH_LINT_FAILED',
        'Failed to start lint watcher',
        { options },
        true
      );
    }
  }

  /**
   * Watch analysis
   */
  private async watchAnalysis(options: any): Promise<void> {
    try {
      logger.info(`Starting ${options.type} analysis watcher...`);

      const analysisPatterns = ['src/**/*', 'lib/**/*'];
      const watchConfig: WatchConfig = {
        patterns: analysisPatterns,
        commands: [
          {
            trigger: 'change',
            command: this.getAnalysisCommand(options),
            condition: 'analysis-files',
          },
        ],
        debounce: 2000,
      };

      await this.startWatchingWithConfig('analysis-watch', watchConfig);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_WATCH_ANALYSIS_FAILED',
        'Failed to start analysis watcher',
        { options },
        true
      );
    }
  }

  /**
   * Helper methods
   */
  private setupWatchHandlers(
    watcher: FSWatcher,
    config: WatchConfig,
    name: string
  ): void {
    const executeCommands = async (eventType: string, filePath: string) => {
      const relevantCommands = config.commands.filter(
        cmd => cmd.trigger === eventType || cmd.trigger === 'change'
      );

      for (const cmd of relevantCommands) {
        if (this.shouldExecuteCommand(cmd, filePath)) {
          await this.executeWatchCommand(cmd, filePath);
        }
      }
    };

    watcher.on('add', filePath => {
      logger.debug(`File added: ${filePath}`);
      executeCommands('add', filePath);
    });

    watcher.on('change', filePath => {
      logger.debug(`File changed: ${filePath}`);
      executeCommands('change', filePath);
    });

    watcher.on('unlink', filePath => {
      logger.debug(`File deleted: ${filePath}`);
      executeCommands('delete', filePath);
    });

    watcher.on('error', error => {
      logger.error(`Watch error in ${name}:`, error);
    });

    watcher.on('ready', () => {
      logger.debug(`Watch ready: ${name}`);
    });
  }

  private shouldExecuteCommand(cmd: WatchCommand, filePath: string): boolean {
    if (!cmd.condition) return true;

    // Implement condition checking logic
    switch (cmd.condition) {
      case 'test-files':
        return filePath.includes('.test.') || filePath.includes('.spec.');
      case 'source-files':
        return !filePath.includes('.test.') && !filePath.includes('.spec.');
      case 'lint-files':
        return /\.(ts|tsx|js|jsx)$/.test(filePath);
      case 'analysis-files':
        return /\.(ts|tsx|js|jsx)$/.test(filePath);
      default:
        return true;
    }
  }

  private async executeWatchCommand(
    cmd: WatchCommand,
    filePath: string
  ): Promise<void> {
    try {
      logger.info(`Executing: ${cmd.command}`);

      // Replace placeholders in command
      const command = cmd.command.replace('{{file}}', filePath);

      // Execute command
      const { spawn } = await import('child_process');
      const [cmdName, ...args] = command.split(' ');

      if (!cmdName) {
        logger.error('Invalid command: empty command string');
        return;
      }

      const child = spawn(cmdName, args, {
        stdio: 'inherit',
        shell: true,
      });

      child.on('exit', code => {
        if (code === 0) {
          logger.success(`Command completed: ${cmd.command}`);
        } else {
          logger.error(`Command failed with exit code ${code}: ${cmd.command}`);
        }
      });
    } catch (error) {
      logger.error(`Failed to execute command: ${cmd.command}`, error);
    }
  }

  private createWatchConfigFromOptions(
    patterns: string[],
    options: any
  ): WatchConfig {
    return {
      patterns: patterns.length > 0 ? patterns : ['**/*'],
      ignore: options.ignore ? options.ignore.split(',') : [],
      commands: options.command
        ? [
            {
              trigger: 'change',
              command: options.command,
            },
          ]
        : [],
      debounce: parseInt(options.debounce) || 300,
      recursive: options.recursive || true,
    };
  }

  private async loadWatchConfigFile(file: string): Promise<WatchConfig> {
    if (!(await fs.pathExists(file))) {
      throw new Error(`Configuration file not found: ${file}`);
    }

    const content = await fs.readFile(file, 'utf8');
    const ext = path.extname(file).toLowerCase();

    if (ext === '.yaml' || ext === '.yml') {
      return YAML.parse(content);
    } else if (ext === '.json') {
      return JSON.parse(content);
    } else {
      throw new Error(`Unsupported configuration format: ${ext}`);
    }
  }

  private async startWatchingWithConfig(
    name: string,
    config: WatchConfig
  ): Promise<void> {
    const watcher = watch(config.patterns, {
      ignored: config.ignore || [],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: config.debounce || 300,
        pollInterval: 100,
      },
    });

    this.setupWatchHandlers(watcher, config, name);
    this.watchers.set(name, watcher);
    this.activeWatches.set(name, config);

    logger.success(`Started watch: ${name}`);
  }

  private async createInteractiveWatchConfig(): Promise<WatchConfig> {
    const inquirer = await import('inquirer');

    const answers = await inquirer.default.prompt([
      {
        type: 'input',
        name: 'patterns',
        message: 'File patterns to watch (comma-separated):',
        default: '**/*',
      },
      {
        type: 'input',
        name: 'ignore',
        message: 'Patterns to ignore (comma-separated):',
        default: 'node_modules/**,dist/**',
      },
      {
        type: 'input',
        name: 'command',
        message: 'Command to run on changes:',
        validate: input => input.length > 0 || 'Command is required',
      },
      {
        type: 'number',
        name: 'debounce',
        message: 'Debounce delay (ms):',
        default: 300,
      },
    ]);

    return {
      patterns: answers.patterns.split(',').map(p => p.trim()),
      ignore: answers.ignore.split(',').map(p => p.trim()),
      commands: [
        {
          trigger: 'change',
          command: answers.command,
        },
      ],
      debounce: answers.debounce,
      recursive: true,
    };
  }

  private parseWatchCommands(commandsStr: string): WatchCommand[] {
    return commandsStr.split(',').map(cmd => ({
      trigger: 'change',
      command: cmd.trim(),
    }));
  }

  private getTestPatterns(framework: string): string[] {
    switch (framework) {
      case 'jest':
        return ['**/*.{test,spec}.{js,jsx,ts,tsx}', 'src/**/*'];
      case 'mocha':
        return ['test/**/*.js', 'src/**/*'];
      case 'vitest':
        return ['**/*.{test,spec}.{js,ts}', 'src/**/*'];
      default:
        return ['**/*.{test,spec}.*', 'src/**/*'];
    }
  }

  private getTestCommand(framework: string, options: any): string {
    const baseCmd = framework === 'npm' ? `npm test` : `npx ${framework}`;
    const flags: string[] = [];

    if (options.coverage) flags.push('--coverage');
    if (options.changedOnly) flags.push('--changedSince=HEAD');

    return `${baseCmd} ${flags.join(' ')}`;
  }

  private getBuildCommand(options: any): string {
    const cmd = options.target
      ? `npm run build:${options.target}`
      : 'npm run build';
    return options.incremental ? `${cmd} --incremental` : cmd;
  }

  private getLintCommand(options: any): string {
    const cmd = 'npx eslint {{file}}';
    return options.fix ? `${cmd} --fix` : cmd;
  }

  private getAnalysisCommand(options: any): string {
    return `wundr analyze ${options.type}`;
  }
}
