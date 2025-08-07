import { Command } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config-manager';
import { PluginManager } from '../plugins/plugin-manager';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/error-handler';

/**
 * Init commands for project setup and configuration
 */
export class InitCommands {
  constructor(
    private program: Command,
    private configManager: ConfigManager,
    private pluginManager: PluginManager
  ) {
    this.registerCommands();
  }

  private registerCommands(): void {
    const initCmd = this.program
      .command('init')
      .description('initialize Wundr project or configuration');

    // Initialize new project
    initCmd
      .command('project [name]')
      .description('initialize a new Wundr project')
      .option('--template <template>', 'project template to use', 'default')
      .option('--skip-git', 'skip git initialization')
      .option('--skip-install', 'skip dependency installation')
      .option('--monorepo', 'initialize as monorepo')
      .action(async (name, options) => {
        await this.initProject(name, options);
      });

    // Initialize configuration
    initCmd
      .command('config')
      .description('initialize Wundr configuration')
      .option('--interactive', 'use interactive setup')
      .option('--global', 'create global configuration')
      .action(async (options) => {
        await this.initConfig(options);
      });

    // Initialize workspace
    initCmd
      .command('workspace')
      .description('initialize multi-project workspace')
      .option('--name <name>', 'workspace name')
      .option('--packages <pattern>', 'packages pattern', 'packages/*')
      .action(async (options) => {
        await this.initWorkspace(options);
      });

    // Initialize plugins
    initCmd
      .command('plugins')
      .description('initialize plugin system')
      .option('--install <plugins>', 'plugins to install (comma-separated)')
      .action(async (options) => {
        await this.initPlugins(options);
      });
  }

  /**
   * Initialize a new Wundr project
   */
  private async initProject(name: string, options: any): Promise<void> {
    try {
      const projectName = name || await this.promptProjectName();
      const projectPath = path.join(process.cwd(), projectName);

      logger.info(`Initializing project: ${chalk.cyan(projectName)}`);

      // Check if directory already exists
      if (await fs.pathExists(projectPath)) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'Directory already exists. Overwrite?',
            default: false
          }
        ]);

        if (!overwrite) {
          logger.info('Project initialization cancelled');
          return;
        }
      }

      // Create project structure
      await this.createProjectStructure(projectPath, options);

      // Initialize git if not skipped
      if (!options.skipGit) {
        await this.initializeGit(projectPath);
      }

      // Install dependencies if not skipped
      if (!options.skipInstall) {
        await this.installDependencies(projectPath);
      }

      logger.success(`Project ${projectName} initialized successfully!`);
      logger.info(`Next steps:`);
      logger.info(`  cd ${projectName}`);
      logger.info(`  wundr analyze`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_INIT_PROJECT_FAILED',
        'Failed to initialize project',
        { name, options },
        true
      );
    }
  }

  /**
   * Initialize Wundr configuration
   */
  private async initConfig(options: any): Promise<void> {
    try {
      if (options.interactive) {
        await this.interactiveConfigSetup();
      } else {
        await this.configManager.loadConfig();
        logger.success('Configuration initialized with defaults');
      }

      const configPaths = this.configManager.getConfigPaths();
      const configPath = options.global ? configPaths.user : configPaths.project;
      
      logger.info(`Configuration saved to: ${chalk.cyan(configPath)}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_INIT_CONFIG_FAILED',
        'Failed to initialize configuration',
        { options },
        true
      );
    }
  }

  /**
   * Initialize workspace for multiple projects
   */
  private async initWorkspace(options: any): Promise<void> {
    try {
      const workspaceName = options.name || await this.promptWorkspaceName();
      
      logger.info(`Initializing workspace: ${chalk.cyan(workspaceName)}`);

      const workspaceConfig = {
        name: workspaceName,
        version: '1.0.0',
        workspaces: [options.packages],
        scripts: {
          'build': 'wundr build --workspace',
          'test': 'wundr test --workspace',
          'lint': 'wundr lint --workspace',
          'analyze': 'wundr analyze --workspace'
        },
        devDependencies: {
          '@wundr/cli': '^1.0.0'
        }
      };

      await fs.writeJson('package.json', workspaceConfig, { spaces: 2 });
      await fs.ensureDir('packages');
      
      // Create workspace-specific wundr config
      await this.configManager.loadConfig();
      await this.configManager.saveConfig(path.join(process.cwd(), 'wundr.config.json'));

      logger.success('Workspace initialized successfully!');
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_INIT_WORKSPACE_FAILED',
        'Failed to initialize workspace',
        { options },
        true
      );
    }
  }

  /**
   * Initialize plugin system
   */
  private async initPlugins(options: any): Promise<void> {
    try {
      logger.info('Initializing plugin system...');
      
      await this.pluginManager.initialize();

      if (options.install) {
        const plugins = options.install.split(',').map((p: string) => p.trim());
        for (const plugin of plugins) {
          await this.pluginManager.installPlugin(plugin);
        }
      }

      logger.success('Plugin system initialized!');
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_INIT_PLUGINS_FAILED',
        'Failed to initialize plugins',
        { options },
        true
      );
    }
  }

  /**
   * Create project structure based on template
   */
  private async createProjectStructure(projectPath: string, options: any): Promise<void> {
    await fs.ensureDir(projectPath);

    const template = options.template || 'default';
    const templatePath = this.getTemplatePath(template);

    if (await fs.pathExists(templatePath)) {
      await fs.copy(templatePath, projectPath);
    } else {
      // Create default structure
      await this.createDefaultStructure(projectPath, options);
    }

    // Create project-specific config
    const config = await this.configManager.loadConfig();
    await this.configManager.saveConfig(path.join(projectPath, 'wundr.config.json'));
  }

  /**
   * Create default project structure
   */
  private async createDefaultStructure(projectPath: string, options: any): Promise<void> {
    const directories = options.monorepo 
      ? ['packages', 'apps', 'tools', 'docs']
      : ['src', 'tests', 'docs'];

    for (const dir of directories) {
      await fs.ensureDir(path.join(projectPath, dir));
    }

    // Create package.json
    const packageJson = {
      name: path.basename(projectPath),
      version: '1.0.0',
      description: '',
      main: options.monorepo ? undefined : 'src/index.ts',
      scripts: {
        build: 'wundr build',
        test: 'wundr test',
        lint: 'wundr lint',
        analyze: 'wundr analyze'
      },
      devDependencies: {
        '@wundr/cli': '^1.0.0'
      },
      ...(options.monorepo && { workspaces: ['packages/*', 'apps/*'] })
    };

    await fs.writeJson(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 });

    // Create README
    const readme = this.generateReadme(path.basename(projectPath), options);
    await fs.writeFile(path.join(projectPath, 'README.md'), readme);
  }

  /**
   * Interactive configuration setup
   */
  private async interactiveConfigSetup(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'defaultMode',
        message: 'Default CLI mode:',
        choices: [
          { name: 'Command Line', value: 'cli' },
          { name: 'Interactive Wizard', value: 'interactive' },
          { name: 'Chat Interface', value: 'chat' },
          { name: 'Terminal UI', value: 'tui' }
        ],
        default: 'cli'
      },
      {
        type: 'input',
        name: 'aiProvider',
        message: 'AI provider:',
        default: 'claude'
      },
      {
        type: 'input',
        name: 'aiModel',
        message: 'AI model:',
        default: 'claude-3'
      },
      {
        type: 'confirm',
        name: 'enableGitHub',
        message: 'Enable GitHub integration?',
        default: false
      },
      {
        type: 'input',
        name: 'githubToken',
        message: 'GitHub token:',
        when: (answers) => answers.enableGitHub,
        validate: (input) => input.length > 0 || 'GitHub token is required'
      }
    ]);

    await this.configManager.loadConfig();
    
    this.configManager.updateConfig({
      defaultMode: answers.defaultMode,
      ai: {
        provider: answers.aiProvider,
        model: answers.aiModel
      },
      ...(answers.enableGitHub && {
        integrations: {
          github: {
            token: answers.githubToken,
            owner: '',
            repo: ''
          }
        }
      })
    });

    await this.configManager.saveConfig();
  }

  /**
   * Utility methods
   */
  private async promptProjectName(): Promise<string> {
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        default: 'my-wundr-project',
        validate: (input) => input.length > 0 || 'Project name is required'
      }
    ]);
    return name;
  }

  private async promptWorkspaceName(): Promise<string> {
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Workspace name:',
        default: 'my-workspace',
        validate: (input) => input.length > 0 || 'Workspace name is required'
      }
    ]);
    return name;
  }

  private getTemplatePath(template: string): string {
    return path.join(__dirname, '../../templates', template);
  }

  private generateReadme(projectName: string, options: any): string {
    return `# ${projectName}

Generated with Wundr CLI

## Getting Started

\`\`\`bash
# Analyze your project
wundr analyze

# Run governance checks
wundr govern check

# Launch dashboard
wundr dashboard
\`\`\`

## Available Commands

- \`wundr analyze\` - Analyze code dependencies and quality
- \`wundr create\` - Generate new components and services
- \`wundr govern\` - Run governance and compliance checks
- \`wundr ai\` - AI-powered development assistance
- \`wundr dashboard\` - Launch web dashboard

## Configuration

Project configuration is stored in \`wundr.config.json\`.

Run \`wundr init config --interactive\` to set up your preferences.
`;
  }

  private async initializeGit(projectPath: string): Promise<void> {
    // Implementation for git initialization
    logger.debug('Initializing git repository...');
    // This would call git commands or use a git library
  }

  private async installDependencies(projectPath: string): Promise<void> {
    // Implementation for dependency installation
    logger.debug('Installing dependencies...');
    // This would call npm/yarn/pnpm install
  }
}