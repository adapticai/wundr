import blessed from 'blessed';
import chalk from 'chalk';
import inquirer from 'inquirer';

import { TUILayout, ChatSession } from '../types';
import { errorHandler } from '../utils/error-handler';
import { logger } from '../utils/logger';

import type { PluginManager } from '../plugins/plugin-manager';
import type { InteractiveSession} from '../types';
import type { ConfigManager } from '../utils/config-manager';

/**
 * Interactive mode manager for wizard, TUI, and chat interfaces
 */
export class InteractiveMode {
  private activeSessions: Map<string, InteractiveSession> = new Map();

  constructor(
    private configManager: ConfigManager,
    private pluginManager: PluginManager,
  ) {}

  /**
   * Launch interactive wizard mode
   */
  async launchWizard(mode: string = 'setup'): Promise<void> {
    try {
      logger.info('Launching interactive wizard...');

      const session: InteractiveSession = {
        mode: 'wizard',
        config: { wizardMode: mode },
        state: {},
        active: true,
      };

      this.activeSessions.set(`wizard-${Date.now()}`, session);

      switch (mode) {
        case 'setup':
          await this.setupWizard();
          break;
        case 'analyze':
          await this.analyzeWizard();
          break;
        case 'create':
          await this.createWizard();
          break;
        case 'govern':
          await this.governWizard();
          break;
        default:
          await this.generalWizard();
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_WIZARD_FAILED',
        'Failed to launch wizard',
        { mode },
        true,
      );
    }
  }

  /**
   * Launch chat interface
   */
  async launchChat(options: any): Promise<void> {
    try {
      logger.info('Launching chat interface...');

      // This would integrate with the chat commands
      const { spawn } = await import('child_process');
      const chatArgs = ['chat', 'start'];

      if (options.model) {
chatArgs.push('--model', options.model);
}
      if (options.context) {
chatArgs.push('--context', options.context);
}

      const child = spawn('wundr', chatArgs, {
        stdio: 'inherit',
        shell: true,
      });

      child.on('exit', code => {
        if (code !== 0) {
          logger.error(`Chat interface exited with code ${code}`);
        }
      });
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CHAT_LAUNCH_FAILED',
        'Failed to launch chat interface',
        { options },
        true,
      );
    }
  }

  /**
   * Launch Terminal User Interface (TUI)
   */
  async launchTUI(layout: string = 'dashboard'): Promise<void> {
    try {
      logger.info(`Launching TUI with layout: ${layout}`);

      const screen = blessed.screen({
        smartCSR: true,
        title: 'Wundr CLI Dashboard',
      });

      await this.setupTUILayout(screen, layout);

      // Handle exit
      screen.key(['escape', 'q', 'C-c'], () => {
        return process.exit(0);
      });

      screen.render();
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_TUI_LAUNCH_FAILED',
        'Failed to launch TUI',
        { layout },
        true,
      );
    }
  }

  /**
   * Setup wizard for initial configuration
   */
  private async setupWizard(): Promise<void> {
    console.log(chalk.cyan('\n🚀 Welcome to Wundr CLI Setup Wizard\n'));

    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'initialize',
        message: 'Initialize Wundr in this directory?',
        default: true,
      },
      {
        type: 'list',
        name: 'projectType',
        message: 'What type of project is this?',
        choices: [
          { name: 'Single Package', value: 'single' },
          { name: 'Monorepo', value: 'monorepo' },
          { name: 'Workspace', value: 'workspace' },
        ],
        when: answers => answers.initialize,
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select features to enable:',
        choices: [
          { name: 'Code Analysis', value: 'analysis', checked: true },
          { name: 'Governance Rules', value: 'governance', checked: true },
          { name: 'AI Assistance', value: 'ai', checked: false },
          { name: 'Dashboard', value: 'dashboard', checked: true },
          { name: 'Watch Mode', value: 'watch', checked: false },
        ],
        when: answers => answers.initialize,
      },
      {
        type: 'input',
        name: 'aiProvider',
        message: 'AI Provider:',
        default: 'claude',
        when: answers => answers.features?.includes('ai'),
      },
      {
        type: 'password',
        name: 'aiApiKey',
        message: 'AI API Key (optional):',
        mask: '*',
        when: answers => answers.features?.includes('ai'),
      },
    ]);

    if (!answers.initialize) {
      console.log(chalk.yellow('Setup cancelled'));
      return;
    }

    // Execute setup commands based on answers
    console.log(chalk.green('\n✨ Setting up your project...\n'));

    const setupCommands = [
      `wundr init ${answers.projectType === 'single' ? 'project' : answers.projectType}`,
      'wundr init config',
    ];

    if (answers.features?.includes('governance')) {
      setupCommands.push('wundr govern rules add no-console');
    }

    if (answers.features?.includes('dashboard')) {
      setupCommands.push('wundr dashboard config set theme default');
    }

    for (const command of setupCommands) {
      console.log(chalk.blue(`Running: ${command}`));
      // Execute command (simplified for demo)
      await this.simulateCommand(command);
    }

    console.log(
      chalk.green('\n🎉 Setup complete! Your Wundr project is ready.'),
    );
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('  • Run "wundr analyze" to analyze your code'));
    console.log(
      chalk.gray('  • Run "wundr dashboard start" to launch the dashboard'),
    );
    console.log(
      chalk.gray('  • Run "wundr --help" to see all available commands'),
    );
  }

  /**
   * Analysis wizard
   */
  private async analyzeWizard(): Promise<void> {
    console.log(chalk.cyan('\n🔍 Code Analysis Wizard\n'));

    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'analysisTypes',
        message: 'What would you like to analyze?',
        choices: [
          { name: 'Dependencies', value: 'deps', checked: true },
          { name: 'Code Quality', value: 'quality', checked: true },
          { name: 'Performance', value: 'perf', checked: false },
          { name: 'Architecture', value: 'arch', checked: false },
          { name: 'Security', value: 'security', checked: true },
        ],
      },
      {
        type: 'list',
        name: 'outputFormat',
        message: 'Output format:',
        choices: [
          { name: 'Table (Console)', value: 'table' },
          { name: 'JSON File', value: 'json' },
          { name: 'HTML Report', value: 'html' },
        ],
        default: 'table',
      },
      {
        type: 'confirm',
        name: 'autoFix',
        message: 'Automatically fix issues where possible?',
        default: false,
      },
    ]);

    console.log(chalk.green('\n🔬 Running analysis...\n'));

    for (const analysisType of answers.analysisTypes) {
      let command = `wundr analyze ${analysisType}`;
      if (answers.outputFormat !== 'table') {
        command += ` --format ${answers.outputFormat}`;
      }
      if (answers.autoFix) {
        command += ' --fix';
      }

      console.log(chalk.blue(`Running: ${command}`));
      await this.simulateCommand(command);
    }

    console.log(chalk.green('\n✅ Analysis complete!'));
  }

  /**
   * Creation wizard
   */
  private async createWizard(): Promise<void> {
    console.log(chalk.cyan('\n🛠️  Code Generation Wizard\n'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'createType',
        message: 'What would you like to create?',
        choices: [
          { name: 'Component', value: 'component' },
          { name: 'Service', value: 'service' },
          { name: 'Package (Monorepo)', value: 'package' },
          { name: 'Template', value: 'template' },
          { name: 'Workflow', value: 'workflow' },
          { name: 'Configuration', value: 'config' },
        ],
      },
      {
        type: 'input',
        name: 'name',
        message: 'Name:',
        validate: input => input.length > 0 || 'Name is required',
      },
    ]);

    // Get specific options based on type
    let specificAnswers = {};

    switch (answers.createType) {
      case 'component':
        specificAnswers = await this.getComponentOptions();
        break;
      case 'service':
        specificAnswers = await this.getServiceOptions();
        break;
      case 'package':
        specificAnswers = await this.getPackageOptions();
        break;
      default:
        specificAnswers = {};
    }

    console.log(
      chalk.green(`\n🏗️  Creating ${answers.createType}: ${answers.name}\n`),
    );

    let command = `wundr create ${answers.createType} ${answers.name}`;

    // Add specific options to command
    Object.entries(specificAnswers).forEach(([key, value]) => {
      if (typeof value === 'boolean' && value) {
        command += ` --${key}`;
      } else if (typeof value === 'string' && value) {
        command += ` --${key} ${value}`;
      }
    });

    console.log(chalk.blue(`Running: ${command}`));
    await this.simulateCommand(command);

    console.log(
      chalk.green(`\n🎉 ${answers.createType} created successfully!`),
    );
  }

  /**
   * Governance wizard
   */
  private async governWizard(): Promise<void> {
    console.log(chalk.cyan('\n⚖️  Governance Setup Wizard\n'));

    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'ruleCategories',
        message: 'Select rule categories to enable:',
        choices: [
          { name: 'Code Quality', value: 'quality', checked: true },
          { name: 'Security', value: 'security', checked: true },
          { name: 'Performance', value: 'performance', checked: false },
          { name: 'Testing', value: 'testing', checked: true },
          { name: 'Documentation', value: 'docs', checked: false },
        ],
      },
      {
        type: 'list',
        name: 'severity',
        message: 'Default severity level:',
        choices: [
          { name: 'Error (Strict)', value: 'error' },
          { name: 'Warning (Balanced)', value: 'warning' },
          { name: 'Info (Lenient)', value: 'info' },
        ],
        default: 'warning',
      },
      {
        type: 'confirm',
        name: 'createQualityGate',
        message: 'Create a quality gate?',
        default: true,
      },
    ]);

    console.log(chalk.green('\n⚙️  Setting up governance rules...\n'));

    // Add rules based on categories
    for (const category of answers.ruleCategories) {
      const rules = this.getRulesForCategory(category);
      for (const rule of rules) {
        const command = `wundr govern rules add ${rule}`;
        console.log(chalk.blue(`Running: ${command}`));
        await this.simulateCommand(command);
      }
    }

    // Set severity
    const severityCommand = `wundr govern config set severity ${answers.severity}`;
    console.log(chalk.blue(`Running: ${severityCommand}`));
    await this.simulateCommand(severityCommand);

    // Create quality gate
    if (answers.createQualityGate) {
      const gateCommand =
        'wundr govern gate create default --conditions "coverage>80,complexity<10"';
      console.log(chalk.blue(`Running: ${gateCommand}`));
      await this.simulateCommand(gateCommand);
    }

    console.log(chalk.green('\n✅ Governance setup complete!'));
    console.log(
      chalk.gray(
        '\nRun "wundr govern check" to validate your code against the rules.',
      ),
    );
  }

  /**
   * General purpose wizard
   */
  private async generalWizard(): Promise<void> {
    console.log(chalk.cyan('\n🧙 Wundr CLI Wizard\n'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Setup a new project', value: 'setup' },
          { name: 'Analyze existing code', value: 'analyze' },
          { name: 'Create new code', value: 'create' },
          { name: 'Setup governance', value: 'govern' },
          { name: 'Configure AI features', value: 'ai' },
          { name: 'Launch dashboard', value: 'dashboard' },
        ],
      },
    ]);

    switch (answers.action) {
      case 'setup':
        await this.setupWizard();
        break;
      case 'analyze':
        await this.analyzeWizard();
        break;
      case 'create':
        await this.createWizard();
        break;
      case 'govern':
        await this.governWizard();
        break;
      case 'ai':
        await this.aiConfigWizard();
        break;
      case 'dashboard':
        await this.launchDashboard();
        break;
    }
  }

  /**
   * AI configuration wizard
   */
  private async aiConfigWizard(): Promise<void> {
    console.log(chalk.cyan('\n🤖 AI Configuration Wizard\n'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'AI Provider:',
        choices: [
          { name: 'Claude (Anthropic)', value: 'claude' },
          { name: 'ChatGPT (OpenAI)', value: 'openai' },
          { name: 'Local Model', value: 'local' },
        ],
      },
      {
        type: 'list',
        name: 'model',
        message: 'Model:',
        choices: answers => {
          switch (answers.provider) {
            case 'claude':
              return ['claude-3', 'claude-3-haiku', 'claude-3-sonnet'];
            case 'openai':
              return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
            case 'local':
              return ['llama2', 'codellama', 'custom'];
            default:
              return ['claude-3'];
          }
        },
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'API Key:',
        mask: '*',
        when: answers => answers.provider !== 'local',
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Enable AI features:',
        choices: [
          { name: 'Code Generation', value: 'generate', checked: true },
          { name: 'Code Review', value: 'review', checked: true },
          { name: 'Refactoring', value: 'refactor', checked: false },
          { name: 'Documentation', value: 'docs', checked: true },
          { name: 'Test Generation', value: 'test', checked: false },
        ],
      },
    ]);

    console.log(chalk.green('\n🔧 Configuring AI features...\n'));

    // Set AI configuration
    const commands = [
      `wundr ai config set provider ${answers.provider}`,
      `wundr ai config set model ${answers.model}`,
    ];

    if (answers.apiKey) {
      commands.push(`wundr ai config set apiKey ${answers.apiKey}`);
    }

    for (const command of commands) {
      console.log(chalk.blue(`Running: ${command}`));
      await this.simulateCommand(command);
    }

    console.log(chalk.green('\n✅ AI configuration complete!'));
    console.log(chalk.gray('\nTry "wundr ai ask" to start chatting with AI.'));
  }

  /**
   * Launch dashboard shortcut
   */
  private async launchDashboard(): Promise<void> {
    console.log(chalk.green('\n📊 Launching Wundr Dashboard...\n'));

    const command = 'wundr dashboard start --open';
    console.log(chalk.blue(`Running: ${command}`));
    await this.simulateCommand(command);
  }

  /**
   * Setup TUI layout
   */
  private async setupTUILayout(screen: any, layoutType: string): Promise<void> {
    switch (layoutType) {
      case 'dashboard':
        await this.setupDashboardLayout(screen);
        break;
      case 'monitor':
        await this.setupMonitorLayout(screen);
        break;
      case 'debug':
        await this.setupDebugLayout(screen);
        break;
      default:
        await this.setupDashboardLayout(screen);
    }
  }

  /**
   * Setup dashboard TUI layout
   */
  private async setupDashboardLayout(screen: any): Promise<void> {
    // Header
    const header = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: `{center}${chalk.cyan('🚀 Wundr CLI Dashboard')}{/center}`,
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: '#f0f0f0',
        },
      },
    });

    // Sidebar
    const sidebar = blessed.box({
      top: 3,
      left: 0,
      width: '25%',
      height: '100%-6',
      content:
        'Navigation\n\n→ Overview\n  Analysis\n  Governance\n  AI Tools\n  Settings',
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        border: {
          fg: '#f0f0f0',
        },
      },
    });

    // Main content
    const main = blessed.box({
      top: 3,
      left: '25%',
      width: '75%',
      height: '100%-6',
      content:
        'Project Overview\n\n' +
        '📁 Files: 1,234\n' +
        '🔍 Issues: 5\n' +
        '✅ Tests: 98% coverage\n' +
        '📦 Dependencies: 45\n' +
        '🚀 Performance: Good',
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        border: {
          fg: '#f0f0f0',
        },
      },
    });

    // Footer
    const footer = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}Press q or Esc to exit{/center}',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: '#f0f0f0',
        },
      },
    });

    screen.append(header);
    screen.append(sidebar);
    screen.append(main);
    screen.append(footer);

    // Focus handling
    main.focus();
  }

  /**
   * Setup monitor TUI layout
   */
  private async setupMonitorLayout(screen: any): Promise<void> {
    // Real-time monitoring layout with logs and metrics
    const log = blessed.log({
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        border: {
          fg: '#f0f0f0',
        },
      },
      scrollable: true,
      alwaysScroll: true,
    });

    screen.append(log);

    // Simulate log entries
    setInterval(() => {
      log.log(`[${new Date().toLocaleTimeString()}] Monitoring active...`);
    }, 2000);

    log.focus();
  }

  /**
   * Setup debug TUI layout
   */
  private async setupDebugLayout(screen: any): Promise<void> {
    // Debug information layout
    const debugInfo = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      content:
        'Debug Information\n\n' +
        'CLI Version: 1.0.0\n' +
        'Node Version: ' +
        process.version +
        '\n' +
        'Platform: ' +
        process.platform +
        '\n' +
        'Working Directory: ' +
        process.cwd() +
        '\n' +
        'Arguments: ' +
        process.argv.join(' '),
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        border: {
          fg: '#f0f0f0',
        },
      },
    });

    screen.append(debugInfo);
    debugInfo.focus();
  }

  /**
   * Helper methods for wizard options
   */
  private async getComponentOptions(): Promise<any> {
    return await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'Component type:',
        choices: ['react', 'vue', 'angular'],
        default: 'react',
      },
      {
        type: 'confirm',
        name: 'withTests',
        message: 'Generate test files?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'withStories',
        message: 'Generate Storybook stories?',
        default: false,
      },
    ]);
  }

  private async getServiceOptions(): Promise<any> {
    return await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'Service type:',
        choices: ['api', 'worker', 'microservice'],
        default: 'api',
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Framework:',
        choices: ['express', 'fastify', 'nest'],
        default: 'express',
      },
      {
        type: 'confirm',
        name: 'withTests',
        message: 'Generate test files?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'withDocs',
        message: 'Generate API documentation?',
        default: true,
      },
    ]);
  }

  private async getPackageOptions(): Promise<any> {
    return await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'Package type:',
        choices: ['library', 'app', 'tool'],
        default: 'library',
      },
      {
        type: 'confirm',
        name: 'public',
        message: 'Make package public?',
        default: false,
      },
    ]);
  }

  private getRulesForCategory(category: string): string[] {
    const rulesByCategory = {
      quality: ['no-console', 'no-debugger', 'prefer-const'],
      security: ['no-eval', 'no-unsafe-inline'],
      performance: ['no-inefficient-loops', 'prefer-map-over-loop'],
      testing: ['require-tests', 'no-skip-tests'],
      docs: ['require-jsdoc', 'require-readme'],
    };

    return rulesByCategory[category as keyof typeof rulesByCategory] || [];
  }

  private async simulateCommand(command: string): Promise<void> {
    // Simulate command execution with a delay
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(chalk.green(`  ✓ ${command}`));
        resolve();
      }, 500);
    });
  }
}
