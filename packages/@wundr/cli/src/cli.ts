import { Command } from 'commander';

import { version } from '../package.json';

// Import command modules
import { AICommands } from './commands/ai';
import { AnalyzeCommands } from './commands/analyze';
import { BatchCommands } from './commands/batch';
import { ChatCommands } from './commands/chat';
import claudeInitCommand from './commands/claude-init';
import claudeSetupCommand from './commands/claude-setup';
import { createComputerSetupCommand } from './commands/computer-setup';
import { CreateCommands } from './commands/create';
import { createGuardianCommand } from './commands/guardian';
import { createRAGCommand } from './commands/rag';
import { createSessionCommand } from './commands/session';
import { createOrchestratorCommand } from './commands/orchestrator';
import { createWorktreeCommand } from './commands/worktree';
import { DashboardCommands } from './commands/dashboard';
import { GovernCommands } from './commands/govern';
import {
  createGovernanceCommand,
  createAlignmentCommand,
} from './commands/governance';
import { InitCommands } from './commands/init';
import { PluginCommands } from './commands/plugins';
import { SetupCommands } from './commands/setup';
import { createTestCommand } from './commands/test';
import { WatchCommands } from './commands/watch';
import { InteractiveMode } from './interactive/interactive-mode';
import { PluginManager } from './plugins/plugin-manager';
import { ConfigManager } from './utils/config-manager';
import { logger } from './utils/logger';

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
    this.interactiveMode = new InteractiveMode(
      this.configManager,
      this.pluginManager
    );

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
      .description(
        'Unified Developer Platform - Code Analysis, Governance & Computer Setup for Engineering Teams'
      )
      .version(version, '-v, --version', 'display version number')
      .helpOption('-h, --help', 'display help for command')
      .addHelpText(
        'before',
        `
╦ ╦╦ ╦╔╗╔╔╦╗╦═╗
║║║║ ║║║║ ║║╠╦╝
╚╩╝╚═╝╝╚╝═╩╝╩╚═
The Unified Developer Platform
      `
      )
      .configureOutput({
        writeOut: str => process.stdout.write(str),
        writeErr: str => process.stderr.write(str),
      });
  }

  /**
   * Register all command categories
   */
  private registerCommands(): void {
    // Computer Setup & Provisioning (primary integration)
    new SetupCommands(this.program, this.configManager, this.pluginManager);
    // Use the working computer-setup command instead of the broken one
    this.program.addCommand(createComputerSetupCommand());

    // Code Analysis & Governance (original wundr features)
    new AnalyzeCommands(this.program, this.configManager, this.pluginManager);
    new GovernCommands(this.program, this.configManager, this.pluginManager);

    // IPRE Governance Commands (governance/gov, alignment)
    this.program.addCommand(createGovernanceCommand());
    this.program.addCommand(createAlignmentCommand());

    // Project Management
    new InitCommands(this.program, this.configManager, this.pluginManager);
    new CreateCommands(this.program, this.configManager, this.pluginManager);

    // AI & Automation
    new AICommands(this.program, this.configManager, this.pluginManager);
    new BatchCommands(this.program, this.configManager, this.pluginManager);

    // Dashboard & Monitoring
    new DashboardCommands(this.program, this.configManager, this.pluginManager);
    new WatchCommands(this.program, this.configManager, this.pluginManager);

    // Testing
    this.program.addCommand(createTestCommand());

    // RAG (Retrieval-Augmented Generation)
    this.program.addCommand(createRAGCommand());

    // Session Management
    this.program.addCommand(createSessionCommand());

    // Orchestrator Daemon Management
    this.program.addCommand(createOrchestratorCommand());

    // Guardian Dashboard
    this.program.addCommand(createGuardianCommand());

    // Worktree Management
    this.program.addCommand(createWorktreeCommand());

    // Interactive Modes
    new ChatCommands(this.program, this.configManager, this.pluginManager);

    // Plugin Management
    new PluginCommands(this.program, this.configManager, this.pluginManager);

    // Claude Integration
    claudeInitCommand(this.program);
    claudeSetupCommand(this.program);
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
      .action(async options => {
        await this.interactiveMode.launchWizard(options.mode);
      });

    // Chat interface command
    this.program
      .command('chat')
      .alias('c')
      .description('launch natural language chat interface')
      .option('--model <model>', 'AI model to use', 'claude-3')
      .option('--context <path>', 'load context from directory')
      .action(async options => {
        await this.interactiveMode.launchChat(options);
      });

    // TUI dashboard command
    this.program
      .command('tui')
      .alias('t')
      .description('launch terminal user interface')
      .option(
        '--layout <type>',
        'TUI layout (dashboard, monitor, debug)',
        'dashboard'
      )
      .action(async options => {
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
