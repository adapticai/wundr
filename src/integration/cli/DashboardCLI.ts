/**
 * Dashboard CLI Interface
 * Provides command-line interface for running analysis scripts through the dashboard
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import path from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { ConfigurationAPI } from '../config/ConfigurationAPI';
import { ScriptExecutor } from '../security/ScriptExecutor';
import { PluginSystem } from '../plugins/PluginSystem';
import { HookSystem } from '../hooks/HookSystem';

export interface CLIOptions {
  config?: string;
  verbose?: boolean;
  quiet?: boolean;
  output?: string;
  format?: 'json' | 'table' | 'markdown';
  timeout?: number;
  safety?: 'safe' | 'moderate' | 'unsafe';
}

export interface AnalysisOptions extends CLIOptions {
  path?: string;
  exclude?: string[];
  include?: string[];
  depth?: number;
  cache?: boolean;
}

export interface ScriptOptions extends CLIOptions {
  script?: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Dashboard CLI Manager
 */
export class DashboardCLI {
  private configAPI: ConfigurationAPI;
  private scriptExecutor: ScriptExecutor;
  private pluginSystem: PluginSystem;
  private hookSystem: HookSystem;
  private workingDir: string;

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
    this.configAPI = new ConfigurationAPI(workingDir);
    this.scriptExecutor = new ScriptExecutor(workingDir);
    this.pluginSystem = new PluginSystem();
    this.hookSystem = new HookSystem(this.createLogger());
  }

  /**
   * Initialize CLI with configuration
   */
  async initialize(): Promise<void> {
    try {
      // Load configuration
      await this.configAPI.loadConfig();
      
      // Load custom scripts from config
      const configPath = path.join(this.workingDir, 'wundr.config.json');
      if (existsSync(configPath)) {
        await this.scriptExecutor.loadScriptsFromConfig(configPath);
      }

      // Initialize plugin system
      const config = this.configAPI.getConfig();
      const pluginPaths = [
        path.join(this.workingDir, 'wundr-dashboard/plugins'),
        path.join(this.workingDir, 'node_modules/@wundr/plugins'),
      ];
      await this.pluginSystem.initialize(pluginPaths);

      // Load hooks
      await this.hookSystem.loadHooksFromConfig(configPath);

    } catch (error) {
      console.error(chalk.red('Failed to initialize CLI:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Run analysis command
   */
  async runAnalysis(options: AnalysisOptions = {}): Promise<void> {
    const config = this.configAPI.getConfig();
    const spinner = ora('Running analysis...').start();

    try {
      // Trigger before-analysis hooks
      await this.hookSystem.trigger('before-analysis', {}, config);

      // Prepare analysis options
      const analysisPath = options.path || config.analysis.defaultPath;
      const excludePatterns = options.exclude || config.analysis.excludePatterns;
      const includeExtensions = options.include || config.analysis.includeExtensions;

      // Run analysis using registered scripts or built-in analyzer
      const analysisResult = await this.executeAnalysisScript(analysisPath, {
        excludePatterns,
        includeExtensions,
        depth: options.depth || 10,
        cache: options.cache !== false,
      });

      // Trigger after-analysis hooks
      await this.hookSystem.trigger('after-analysis', analysisResult, config);

      // Output results
      await this.outputResults(analysisResult, options);

      spinner.succeed('Analysis completed successfully');

    } catch (error) {
      spinner.fail('Analysis failed');
      await this.hookSystem.trigger('error-occurred', { error: error instanceof Error ? error.message : String(error) }, config);
      throw error;
    }
  }

  /**
   * Execute a custom script
   */
  async executeScript(scriptName: string, options: ScriptOptions = {}): Promise<void> {
    const config = this.configAPI.getConfig();
    const spinner = ora(`Executing script: ${scriptName}`).start();

    try {
      // Trigger before-script-execution hooks
      await this.hookSystem.trigger('before-script-execution', { scriptName }, config);

      // Execute the script
      const result = await this.scriptExecutor.executeRegisteredScript(scriptName, {
        timeout: options.timeout || 60000,
        safetyLevel: options.safety || 'moderate',
        env: options.env,
      });

      // Trigger after-script-execution hooks
      await this.hookSystem.trigger('after-script-execution', { scriptName, result }, config);

      // Output results
      await this.outputScriptResults(result, options);

      spinner.succeed(`Script '${scriptName}' executed successfully`);

    } catch (error) {
      spinner.fail(`Script '${scriptName}' failed`);
      await this.hookSystem.trigger('error-occurred', { 
        error: error instanceof Error ? error.message : String(error), 
        scriptName 
      }, config);
      throw error;
    }
  }

  /**
   * List available scripts
   */
  async listScripts(options: CLIOptions = {}): Promise<void> {
    const scripts = this.scriptExecutor.getRegisteredScripts();
    
    if (scripts.length === 0) {
      console.log(chalk.yellow('No scripts registered.'));
      return;
    }

    console.log(chalk.blue.bold('Available Scripts:'));
    console.log();

    for (const script of scripts) {
      console.log(chalk.green(`• ${script.name}`));
      console.log(chalk.gray(`  ${script.description}`));
      console.log(chalk.cyan(`  Safety: ${script.safetyLevel}`));
      if (script.timeout) {
        console.log(chalk.gray(`  Timeout: ${script.timeout}ms`));
      }
      console.log();
    }
  }

  /**
   * Start dashboard server
   */
  async startDashboard(options: CLIOptions & { port?: number; dev?: boolean } = {}): Promise<void> {
    const config = this.configAPI.getConfig();
    const port = options.port || config.port || 3000;
    const isDev = options.dev || config.environment === 'development';

    console.log(chalk.blue.bold('🚀 Starting Wundr Dashboard'));
    console.log(chalk.gray(`Port: ${port}`));
    console.log(chalk.gray(`Environment: ${isDev ? 'development' : 'production'}`));

    try {
      // Trigger before-dashboard-start hooks
      await this.hookSystem.trigger('before-dashboard-start', { port, isDev }, config);

      // Start the dashboard server
      await this.startDashboardServer(port, isDev);

      // Trigger after-dashboard-start hooks
      await this.hookSystem.trigger('after-dashboard-start', { port, isDev }, config);

    } catch (error) {
      console.error(chalk.red('Failed to start dashboard:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Interactive configuration manager
   */
  async manageConfig(options: CLIOptions = {}): Promise<void> {
    console.log(chalk.blue.bold('📋 Configuration Manager'));

    const action = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'View current configuration', value: 'view' },
          { name: 'Edit configuration', value: 'edit' },
          { name: 'Reset to defaults', value: 'reset' },
          { name: 'Validate configuration', value: 'validate' },
          { name: 'Export configuration', value: 'export' },
        ],
      },
    ]);

    switch (action.action) {
      case 'view':
        await this.viewConfig();
        break;
      case 'edit':
        await this.editConfig();
        break;
      case 'reset':
        await this.resetConfig();
        break;
      case 'validate':
        await this.validateConfig();
        break;
      case 'export':
        await this.exportConfig(options.output);
        break;
    }
  }

  /**
   * Show system status and diagnostics
   */
  async showStatus(options: CLIOptions = {}): Promise<void> {
    console.log(chalk.blue.bold('🔍 Wundr Dashboard Status'));
    console.log();

    const config = this.configAPI.getConfig();
    
    // Configuration status
    console.log(chalk.green('Configuration:'));
    console.log(`  App Name: ${config.branding.appName}`);
    console.log(`  Environment: ${config.environment}`);
    console.log(`  Port: ${config.port}`);
    console.log(`  Analysis Path: ${config.analysis.defaultPath}`);
    console.log();

    // Scripts status
    const scripts = this.scriptExecutor.getRegisteredScripts();
    console.log(chalk.green(`Scripts: ${scripts.length} registered`));
    scripts.forEach(script => {
      console.log(`  • ${script.name} (${script.safetyLevel})`);
    });
    console.log();

    // Plugins status
    const plugins = this.pluginSystem.getRegistry().getAllPlugins();
    console.log(chalk.green(`Plugins: ${plugins.length} loaded`));
    plugins.forEach(plugin => {
      console.log(`  • ${plugin.manifest.name} v${plugin.manifest.version}`);
    });
    console.log();

    // Hooks status
    const hooks = this.hookSystem.getRegistry().getAllHooks();
    const totalHooks = Array.from(hooks.values()).reduce((sum, h) => sum + h.length, 0);
    console.log(chalk.green(`Hooks: ${totalHooks} registered`));
    hooks.forEach((hookList, event) => {
      console.log(`  ${event}: ${hookList.length} hooks`);
    });
  }

  /**
   * Private helper methods
   */
  private async executeAnalysisScript(analysisPath: string, options: any): Promise<any> {
    // This would integrate with your existing analysis scripts
    const analysisScript = path.join(__dirname, '../../../scripts/analysis/analyze-all.sh');
    
    if (existsSync(analysisScript)) {
      const result = await this.scriptExecutor.executeCommand(
        `bash ${analysisScript} ${analysisPath}`,
        { safetyLevel: 'safe' }
      );
      
      try {
        return JSON.parse(result.stdout);
      } catch {
        return { raw: result.stdout, error: result.stderr };
      }
    }

    // Fallback to simple file analysis
    return {
      path: analysisPath,
      timestamp: new Date().toISOString(),
      summary: 'Basic analysis completed',
    };
  }

  private async outputResults(results: any, options: AnalysisOptions): Promise<void> {
    const format = options.format || 'json';
    const outputPath = options.output;

    let output: string;
    switch (format) {
      case 'table':
        output = this.formatAsTable(results);
        break;
      case 'markdown':
        output = this.formatAsMarkdown(results);
        break;
      default:
        output = JSON.stringify(results, null, 2);
    }

    if (outputPath) {
      await writeFile(outputPath, output);
      console.log(chalk.green(`Results saved to: ${outputPath}`));
    } else if (!options.quiet) {
      console.log(output);
    }
  }

  private async outputScriptResults(result: any, options: ScriptOptions): Promise<void> {
    if (options.quiet) return;

    console.log(chalk.blue('\n--- Script Output ---'));
    if (result.stdout) {
      console.log(result.stdout);
    }
    if (result.stderr) {
      console.error(chalk.red(result.stderr));
    }
    console.log(chalk.gray(`Exit code: ${result.exitCode}`));
    console.log(chalk.gray(`Duration: ${result.duration}ms`));
  }

  private formatAsTable(data: any): string {
    // Simple table formatting - could use a library like cli-table3
    return JSON.stringify(data, null, 2);
  }

  private formatAsMarkdown(data: any): string {
    // Simple markdown formatting
    return `# Analysis Results\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
  }

  private async startDashboardServer(port: number, isDev: boolean): Promise<void> {
    const dashboardPath = path.join(this.workingDir, 'tools/dashboard-next');
    
    if (!existsSync(dashboardPath)) {
      throw new Error('Dashboard not found. Run "npx wundr init-dashboard" first.');
    }

    const command = isDev ? 'npm run dev' : 'npm run start';
    const env = { ...process.env, PORT: port.toString() };

    console.log(chalk.green(`Dashboard starting at http://localhost:${port}`));
    
    // This would actually start the Next.js server
    await this.scriptExecutor.executeCommand(command, {
      cwd: dashboardPath,
      env,
      safetyLevel: 'safe',
    });
  }

  private async viewConfig(): Promise<void> {
    const config = this.configAPI.getConfig();
    console.log(JSON.stringify(config, null, 2));
  }

  private async editConfig(): Promise<void> {
    const config = this.configAPI.getConfig();
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'appName',
        message: 'App Name:',
        default: config.branding.appName,
      },
      {
        type: 'input',
        name: 'primaryColor',
        message: 'Primary Color:',
        default: config.branding.primaryColor,
      },
      // Add more configuration options as needed
    ]);

    await this.configAPI.updateConfig('branding', {
      ...config.branding,
      appName: answers.appName,
      primaryColor: answers.primaryColor,
    });

    console.log(chalk.green('Configuration updated successfully!'));
  }

  private async resetConfig(): Promise<void> {
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'reset',
        message: 'Are you sure you want to reset configuration to defaults?',
        default: false,
      },
    ]);

    if (confirm.reset) {
      const defaultConfig = ConfigurationAPI.createTemplate();
      await this.configAPI.saveConfig(defaultConfig);
      console.log(chalk.green('Configuration reset to defaults!'));
    }
  }

  private async validateConfig(): Promise<void> {
    try {
      const config = this.configAPI.getConfig();
      this.configAPI.validateConfig(config);
      console.log(chalk.green('Configuration is valid!'));
    } catch (error) {
      console.log(chalk.red('Configuration validation failed:'), error instanceof Error ? error.message : String(error));
    }
  }

  private async exportConfig(outputPath?: string): Promise<void> {
    const config = this.configAPI.getConfig();
    const output = JSON.stringify(config, null, 2);
    
    if (outputPath) {
      await writeFile(outputPath, output);
      console.log(chalk.green(`Configuration exported to: ${outputPath}`));
    } else {
      console.log(output);
    }
  }

  private createLogger() {
    return {
      info: (message: string, meta?: any) => console.log(chalk.blue(message), meta || ''),
      warn: (message: string, meta?: any) => console.warn(chalk.yellow(message), meta || ''),
      error: (message: string, meta?: any) => console.error(chalk.red(message), meta || ''),
      debug: (message: string, meta?: any) => {
        if (process.env.DEBUG) {
          console.debug(chalk.gray(message), meta || '');
        }
      },
    };
  }
}

/**
 * Create CLI program with all commands
 */
export function createCLIProgram(): Command {
  const program = new Command();
  
  program
    .name('wundr')
    .description('Wundr Dashboard CLI - Intelligent Monorepo Analysis')
    .version('1.0.0');

  // Add global options
  program
    .option('-c, --config <path>', 'Configuration file path')
    .option('-v, --verbose', 'Verbose output')
    .option('-q, --quiet', 'Quiet output')
    .option('--timeout <ms>', 'Execution timeout in milliseconds', '60000');

  // Analyze command
  program
    .command('analyze')
    .description('Run project analysis')
    .option('-p, --path <path>', 'Analysis path')
    .option('-e, --exclude <patterns>', 'Exclude patterns (comma-separated)')
    .option('-i, --include <extensions>', 'Include extensions (comma-separated)')
    .option('-d, --depth <number>', 'Analysis depth', '10')
    .option('--no-cache', 'Disable caching')
    .option('-o, --output <path>', 'Output file path')
    .option('-f, --format <format>', 'Output format (json|table|markdown)', 'json')
    .action(async (options, command) => {
      const cli = new DashboardCLI();
      await cli.initialize();
      await cli.runAnalysis({ ...command.parent.opts(), ...options });
    });

  // Script command
  program
    .command('script <name>')
    .description('Execute a registered script')
    .option('-a, --args <args>', 'Script arguments (comma-separated)')
    .option('--env <vars>', 'Environment variables (key=value,key=value)')
    .option('-s, --safety <level>', 'Safety level (safe|moderate|unsafe)', 'moderate')
    .action(async (name, options, command) => {
      const cli = new DashboardCLI();
      await cli.initialize();
      
      const env = options.env ? 
        Object.fromEntries(options.env.split(',').map((kv: string) => kv.split('='))) :
        {};
      
      await cli.executeScript(name, { 
        ...command.parent.opts(), 
        ...options,
        env,
      });
    });

  // Scripts list command
  program
    .command('scripts')
    .description('List available scripts')
    .action(async (options, command) => {
      const cli = new DashboardCLI();
      await cli.initialize();
      await cli.listScripts({ ...command.parent.opts(), ...options });
    });

  // Dashboard command
  program
    .command('dashboard')
    .description('Start dashboard server')
    .option('-p, --port <port>', 'Server port', '3000')
    .option('--dev', 'Development mode')
    .action(async (options, command) => {
      const cli = new DashboardCLI();
      await cli.initialize();
      await cli.startDashboard({ 
        ...command.parent.opts(), 
        ...options,
        port: parseInt(options.port),
      });
    });

  // Config command
  program
    .command('config')
    .description('Manage configuration')
    .option('-o, --output <path>', 'Export output path')
    .action(async (options, command) => {
      const cli = new DashboardCLI();
      await cli.initialize();
      await cli.manageConfig({ ...command.parent.opts(), ...options });
    });

  // Status command
  program
    .command('status')
    .description('Show system status and diagnostics')
    .action(async (options, command) => {
      const cli = new DashboardCLI();
      await cli.initialize();
      await cli.showStatus({ ...command.parent.opts(), ...options });
    });

  return program;
}

export default DashboardCLI;