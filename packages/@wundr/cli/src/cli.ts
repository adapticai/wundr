import { Command } from 'commander';
import { version } from '../package.json';
import { InteractiveMode } from './interactive/interactive-mode';
import { PluginManager } from './plugins/plugin-manager';
import { ConfigManager } from './utils/config-manager';
import { logger } from './utils/logger';

// Import command modules
import { InitCommands } from './commands/init';
import { CreateCommands } from './commands/create';
import { AnalyzeCommands } from './commands/analyze';
import { GovernCommands } from './commands/govern';
import { AICommands } from './commands/ai';
import { DashboardCommands } from './commands/dashboard';
import { WatchCommands } from './commands/watch';
import { BatchCommands } from './commands/batch';
import { ChatCommands } from './commands/chat';
import { PluginCommands } from './commands/plugins';

/**
 * Main CLI class that orchestrates all commands and modes
 */
export class WundrCLI {
  private program: Command;
  private interactiveMode: InteractiveMode;
  private pluginManager: PluginManager;
  private configManager: ConfigManager;

  constructor() {
    this.program = new Command();
    this.configManager = new ConfigManager();
    this.pluginManager = new PluginManager(this.configManager);
    this.interactiveMode = new InteractiveMode(this.configManager, this.pluginManager);
    
    this.setupProgram();
    this.registerCommands();
    this.setupGlobalOptions();
    this.setupInteractiveMode();
  }

  /**
   * Setup the main program configuration
   */
  private setupProgram(): void {
    this.program
      .name('wundr')
      .description('The Intelligent CLI-Based Coding Agents Orchestrator')
      .version(version, '-v, --version', 'display version number')
      .helpOption('-h, --help', 'display help for command')
      .configureOutput({
        writeOut: (str) => process.stdout.write(str),
        writeErr: (str) => process.stderr.write(str),
      });
  }

  /**
   * Register all command categories
   */
  private registerCommands(): void {
    // Core command categories
    new InitCommands(this.program, this.configManager, this.pluginManager);
    new CreateCommands(this.program, this.configManager, this.pluginManager);
    new AnalyzeCommands(this.program, this.configManager, this.pluginManager);
    new GovernCommands(this.program, this.configManager, this.pluginManager);
    new AICommands(this.program, this.configManager, this.pluginManager);
    new DashboardCommands(this.program, this.configManager, this.pluginManager);

    // Interactive modes
    new WatchCommands(this.program, this.configManager, this.pluginManager);
    new BatchCommands(this.program, this.configManager, this.pluginManager);
    new ChatCommands(this.program, this.configManager, this.pluginManager);

    // Plugin management
    new PluginCommands(this.program, this.configManager, this.pluginManager);
  }

  /**
   * Setup global options and hooks
   */
  private setupGlobalOptions(): void {
    this.program
      .option('--config <path>', 'specify config file path')
      .option('--verbose', 'enable verbose logging')
      .option('--quiet', 'suppress output')
      .option('--no-color', 'disable colored output')
      .option('--dry-run', 'show what would be done without executing')
      .option('--interactive', 'force interactive mode')
      .hook('preAction', (thisCommand, actionCommand) => {
        const options = thisCommand.opts();
        
        // Setup logging level
        if (options['verbose']) {
          logger.setLevel('debug');
        } else if (options['quiet']) {
          logger.setLevel('error');
        }

        // Load custom config if specified
        if (options['config']) {
          this.configManager.loadConfig(options['config']);
        }

        // Setup color mode
        if (options['noColor']) {
          process.env['NO_COLOR'] = '1';
        }

        logger.debug(`Executing command: ${actionCommand.name()}`);
      });
  }

  /**
   * Setup interactive mode triggers
   */
  private setupInteractiveMode(): void {
    // Interactive wizard command
    this.program
      .command('wizard')
      .alias('w')
      .description('launch interactive wizard mode')
      .option('--mode <type>', 'wizard mode (setup, analyze, create)', 'setup')
      .action(async (options) => {
        await this.interactiveMode.launchWizard(options.mode);
      });

    // Chat interface command
    this.program
      .command('chat')
      .alias('c')
      .description('launch natural language chat interface')
      .option('--model <model>', 'AI model to use', 'claude-3')
      .option('--context <path>', 'load context from directory')
      .action(async (options) => {
        await this.interactiveMode.launchChat(options);
      });

    // TUI dashboard command
    this.program
      .command('tui')
      .alias('t')
      .description('launch terminal user interface')
      .option('--layout <type>', 'TUI layout (dashboard, monitor, debug)', 'dashboard')
      .action(async (options) => {
        await this.interactiveMode.launchTUI(options.layout);
      });
  }

  /**
   * Get the configured program
   */
  public createProgram(): Command {
    return this.program;
  }

  /**
   * Load and register plugins
   */
  public async loadPlugins(): Promise<void> {
    await this.pluginManager.loadPlugins();
  }
}