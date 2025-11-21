import { Command } from 'commander';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { execSync, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Type for ora spinner
type OraSpinner = Ora;

// Type definitions
interface SetupOptions {
  global?: boolean;
  skipMcp?: boolean;
  skipFlow?: boolean;
  skipChrome?: boolean;
  skipAgents?: boolean;
  template?: string;
}

interface McpOptions {
  tool?: string;
}

interface AgentOptions {
  list?: boolean;
  enable?: string;
  profile?: string;
}

interface ValidateOptions {
  fix?: boolean;
}

interface OptimizeOptions {
  force?: boolean;
}

/**
 * Claude Setup Commands
 * Comprehensive setup for Claude Code, Claude Flow, and MCP tools
 *
 * Consolidated from:
 * - /src/cli/commands/claude-setup.ts (374 lines) - function-based approach
 * - /packages/@wundr/cli/src/commands/claude-setup.ts (697 lines) - class-based approach
 *
 * This version preserves ALL functionality from both implementations.
 */
export class ClaudeSetupCommands {
  constructor(private program: Command) {
    this.registerCommands();
  }

  private registerCommands(): void {
    const claudeSetup = this.program
      .command('claude-setup')
      .alias('cs')
      .description('Setup Claude Code, Claude Flow, and MCP tools')
      .addHelpText(
        'after',
        chalk.gray(`
Examples:
  ${chalk.green('wundr claude-setup')}              Interactive Claude setup
  ${chalk.green('wundr claude-setup install')}      Complete ecosystem installation
  ${chalk.green('wundr claude-setup mcp')}          Install all MCP tools
  ${chalk.green('wundr claude-setup agents')}       Configure all 54 agents
  ${chalk.green('wundr claude-setup optimize')}     Setup hardware-adaptive optimizations
  ${chalk.green('wundr claude-setup validate')}     Validate Claude installation
  ${chalk.green('wundr claude-setup project')}      Setup project with templates
      `)
      );

    // Main setup command (default)
    claudeSetup
      .command('install', { isDefault: true })
      .description('Complete Claude ecosystem installation')
      .option('--skip-chrome', 'Skip Chrome installation')
      .option('--skip-mcp', 'Skip MCP tools installation')
      .option('--skip-agents', 'Skip agent configuration')
      .option('--skip-flow', 'Skip Claude Flow setup')
      .option('-g, --global', 'Install tools globally')
      .action(async (options: SetupOptions) => {
        await this.runCompleteSetup(options);
      });

    // Project setup with templates (from /src/cli/commands/claude-setup.ts)
    claudeSetup
      .command('project [path]')
      .description('Setup Claude Code in a project directory with optional template')
      .option('-g, --global', 'Install tools globally')
      .option('--skip-mcp', 'Skip MCP tools installation')
      .option('--skip-flow', 'Skip Claude Flow setup')
      .option('-t, --template <name>', 'Use specific project template (typescript, react, nodejs, monorepo)')
      .action(async (projectPath: string = '.', options: SetupOptions) => {
        await this.runProjectSetup(projectPath, options);
      });

    // MCP tools installation
    claudeSetup
      .command('mcp')
      .description('Install and configure MCP tools')
      .option(
        '--tool <tool>',
        'Install specific tool (firecrawl, context7, playwright, browser, sequentialthinking, claude-flow)'
      )
      .action(async (options: McpOptions) => {
        await this.installMcpTools(options);
      });

    // Agent configuration
    claudeSetup
      .command('agents')
      .description('Configure Claude Flow agents')
      .option('--list', 'List available agents')
      .option('--enable <agents>', 'Enable specific agents (comma-separated)')
      .option('--profile <profile>', 'Use profile-specific agents')
      .action(async (options: AgentOptions) => {
        await this.configureAgents(options);
      });

    // Validation
    claudeSetup
      .command('validate')
      .description('Validate Claude installation')
      .option('--fix', 'Attempt to fix issues')
      .action(async (options: ValidateOptions) => {
        await this.validateInstallation(options);
      });

    // Chrome extension
    claudeSetup
      .command('extension')
      .description('Install Browser MCP Chrome extension')
      .action(async () => {
        await this.installChromeExtension();
      });

    // Hardware optimization
    claudeSetup
      .command('optimize')
      .description('Setup hardware-adaptive Claude Code optimizations')
      .option('--force', 'Force reinstallation of optimization scripts')
      .action(async (options: OptimizeOptions) => {
        await this.setupOptimizations(options);
      });

    // Generate CLAUDE.md
    claudeSetup
      .command('config')
      .description('Generate or update CLAUDE.md configuration')
      .argument('[path]', 'Path to repository (defaults to current directory)', '.')
      .action(async (repoPath: string) => {
        await this.generateClaudeConfig(repoPath);
      });
  }

  /**
   * Complete setup - combines both implementations' main flows
   */
  private async runCompleteSetup(options: SetupOptions): Promise<void> {
    const spinner = ora();
    console.log(chalk.cyan.bold('\n🤖 Claude Ecosystem Setup\n'));

    try {
      // Step 1: Install Claude CLI
      if (!this.isClaudeInstalled()) {
        spinner.start('Installing Claude CLI...');
        execSync('npm install -g @anthropic/claude-cli', { stdio: 'inherit' });
        spinner.succeed('Claude CLI installed');
      } else {
        console.log(chalk.green('✓ Claude CLI already installed'));
      }

      // Step 2: Install Chrome (if needed and not skipped)
      if (!options.skipChrome && !this.isChromeInstalled()) {
        spinner.start('Installing Google Chrome...');
        await this.installChrome();
        spinner.succeed('Chrome installed');
      }

      // Step 3: Claude Flow setup
      if (!options.skipFlow) {
        await this.setupClaudeFlow(spinner, process.cwd(), options.global);
      }

      // Step 4: Install MCP tools (if not skipped)
      if (!options.skipMcp) {
        await this.installMcpTools({});
      }

      // Step 5: Configure agents (if not skipped)
      if (!options.skipAgents) {
        await this.configureAgents({ profile: 'fullstack' });
      }

      // Step 6: Setup Claude configuration
      spinner.start('Configuring Claude settings...');
      await this.setupClaudeSettings();
      spinner.succeed('Claude configured');

      console.log(chalk.green.bold('\n✅ Claude ecosystem setup complete!\n'));
      this.printNextSteps();
    } catch (error) {
      spinner.fail('Setup failed');
      console.error(chalk.red(error));
      process.exit(1);
    }
  }

  /**
   * Project setup - from /src/cli/commands/claude-setup.ts
   */
  private async runProjectSetup(projectPath: string, options: SetupOptions): Promise<void> {
    const spinner = ora('Starting Claude Code project setup...').start();

    try {
      const repoPath = path.resolve(projectPath);

      // Verify git repository
      if (!fs.existsSync(path.join(repoPath, '.git'))) {
        spinner.stop();
        const inquirer = await import('inquirer');
        const { shouldInitGit } = await inquirer.default.prompt([{
          type: 'confirm',
          name: 'shouldInitGit',
          message: 'Not a git repository. Initialize git?',
          default: true
        }]);

        if (shouldInitGit) {
          spinner.start('Initializing git repository...');
          execSync('git init', { cwd: repoPath });
          spinner.succeed('Git repository initialized');
        } else {
          console.log(chalk.yellow('Continuing without git...'));
        }
      }

      // Step 1: Claude Flow setup
      if (!options.skipFlow) {
        await this.setupClaudeFlow(spinner, repoPath, options.global);
      }

      // Step 2: MCP Tools setup
      if (!options.skipMcp) {
        await this.setupMCPToolsDirectory(spinner, repoPath);
      }

      // Step 3: Generate CLAUDE.md
      await this.generateClaudeConfigForPath(spinner, repoPath);

      // Step 4: Setup project template if specified
      if (options.template) {
        await this.setupProjectTemplate(spinner, repoPath, options.template);
      }

      // Step 5: Initialize swarm if Claude Flow is available
      if (!options.skipFlow) {
        await this.initializeSwarm(spinner, repoPath);
      }

      // Step 6: Validation
      await this.validateProjectSetup(spinner, repoPath);

      spinner.succeed('Claude Code project setup completed successfully!');

      // Final instructions
      this.displayProjectFinalInstructions(repoPath, options);

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('❌ Setup failed:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  }

  /**
   * Setup Claude Flow - from /src/cli/commands/claude-setup.ts
   */
  private async setupClaudeFlow(spinner: OraSpinner, repoPath: string, global?: boolean): Promise<void> {
    spinner.text = 'Setting up Claude Flow...';

    try {
      // Check if Claude Flow is already installed
      execSync('npx claude-flow --version', { stdio: 'ignore' });
      spinner.text = 'Claude Flow already available, configuring...';
    } catch {
      spinner.text = 'Installing Claude Flow...';

      if (global) {
        execSync('npm install -g claude-flow@alpha', { stdio: 'inherit' });
      } else {
        // Add to package.json dev dependencies if it exists
        if (fs.existsSync(path.join(repoPath, 'package.json'))) {
          execSync('npm install --save-dev claude-flow@alpha', { cwd: repoPath, stdio: 'inherit' });
        }
      }
    }

    // Add MCP server configuration
    spinner.text = 'Configuring Claude MCP server...';
    try {
      execSync('claude mcp add claude-flow npx claude-flow@alpha mcp start', {
        cwd: repoPath,
        stdio: 'pipe'
      });
    } catch {
      // MCP configuration might fail if Claude Desktop isn't installed
      console.log(chalk.yellow('\n⚠️  Could not configure MCP server automatically.'));
      console.log(chalk.yellow('Please run manually: claude mcp add claude-flow npx claude-flow@alpha mcp start'));
    }

    spinner.text = 'Claude Flow setup completed';
  }

  /**
   * Setup MCP Tools directory - from /src/cli/commands/claude-setup.ts
   */
  private async setupMCPToolsDirectory(spinner: OraSpinner, repoPath: string): Promise<void> {
    spinner.text = 'Setting up MCP Tools directory...';

    const mcpToolsPath = path.join(repoPath, 'mcp-tools');

    // Create mcp-tools directory if it doesn't exist
    if (!fs.existsSync(mcpToolsPath)) {
      fs.mkdirSync(mcpToolsPath, { recursive: true });

      // Create basic install script
      const installScript = `#!/bin/bash
# MCP Tools Installation Script
echo "Installing Wundr MCP Tools..."

# Add your MCP tool installations here
echo "✅ MCP Tools installation template created"
echo "Customize this script with your specific MCP tools"
`;

      fs.writeFileSync(path.join(mcpToolsPath, 'install.sh'), installScript);
      execSync(`chmod +x ${path.join(mcpToolsPath, 'install.sh')}`);

      // Create package.json for MCP tools
      const mcpPackageJson = {
        name: 'mcp-tools',
        version: '1.0.0',
        description: 'MCP Tools for Claude Code integration',
        private: true,
        scripts: {
          install: './install.sh'
        }
      };

      fs.writeFileSync(
        path.join(mcpToolsPath, 'package.json'),
        JSON.stringify(mcpPackageJson, null, 2)
      );
    }

    spinner.text = 'MCP Tools directory setup completed';
  }

  /**
   * Install MCP tools via script or specific tool
   */
  private async installMcpTools(options: McpOptions): Promise<void> {
    const spinner = ora();
    const scriptPath = path.join(
      __dirname,
      '../../../../scripts/install-mcp-tools.sh'
    );

    console.log(chalk.cyan('\n📦 Installing MCP Tools...\n'));

    if (options.tool) {
      // Install specific tool
      spinner.start(`Installing ${options.tool} MCP...`);
      try {
        const installCommands: Record<string, string> = {
          firecrawl: 'npx claude mcp add firecrawl npx @firecrawl/mcp-server',
          context7: 'npx claude mcp add context7 npx @context7/mcp-server',
          playwright: 'npx claude mcp add playwright npx @playwright/mcp-server',
          browser: 'npx claude mcp add browser npx @browser/mcp-server',
          sequentialthinking: 'npm install -g @modelcontextprotocol/server-sequentialthinking',
          'claude-flow': 'claude mcp add claude-flow npx claude-flow@alpha mcp start',
        };

        const command = installCommands[options.tool];
        if (command) {
          execSync(command, { stdio: 'inherit' });
          spinner.succeed(`${options.tool} MCP installed`);
        } else {
          spinner.fail(`Unknown tool: ${options.tool}`);
          console.log(chalk.yellow(`Available tools: ${Object.keys(installCommands).join(', ')}`));
        }
      } catch (error) {
        spinner.fail(`Failed to install ${options.tool}`);
        console.error(error);
      }
    } else {
      // Try to install all tools using the script if it exists
      if (fs.existsSync(scriptPath)) {
        console.log(chalk.gray('Running comprehensive MCP tools installation...'));

        const install = spawn('bash', [scriptPath], {
          stdio: 'inherit',
          shell: true,
        });

        return new Promise((resolve, reject) => {
          install.on('close', code => {
            if (code === 0) {
              console.log(chalk.green('\n✅ All MCP tools installed successfully'));
              resolve();
            } else {
              reject(new Error(`Installation failed with code ${code}`));
            }
          });
        });
      } else {
        // Fallback: install core tools
        console.log(chalk.gray('Installing core MCP tools...'));

        const coreTools = ['claude-flow', 'sequentialthinking'];
        for (const tool of coreTools) {
          try {
            await this.installMcpTools({ tool });
          } catch {
            console.log(chalk.yellow(`⚠️ Could not install ${tool}`));
          }
        }

        console.log(chalk.green('\n✅ Core MCP tools installed'));
      }
    }
  }

  /**
   * Configure Claude Flow agents
   */
  private async configureAgents(options: AgentOptions): Promise<void> {
    const spinner = ora();

    if (options.list) {
      this.listAgents();
      return;
    }

    spinner.start('Configuring Claude Flow agents...');

    const agents = options.enable
      ? options.enable.split(',')
      : this.getProfileAgents(options.profile || 'fullstack');

    // Create agent configurations
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    const agentsDir = path.join(homeDir, '.claude', 'agents');

    try {
      fs.mkdirSync(agentsDir, { recursive: true });

      for (const agent of agents) {
        const config = this.generateAgentConfig(agent);
        fs.writeFileSync(
          path.join(agentsDir, `${agent}.json`),
          JSON.stringify(config, null, 2)
        );
      }

      spinner.succeed(`${agents.length} agents configured`);
    } catch (error) {
      spinner.fail('Failed to configure agents');
      console.error(error);
    }
  }

  /**
   * Validate Claude installation
   */
  private async validateInstallation(options: ValidateOptions): Promise<void> {
    console.log(chalk.cyan('\n🔍 Validating Claude Installation...\n'));

    const checks = [
      { name: 'Claude CLI', check: () => this.isClaudeInstalled() },
      { name: 'Claude Flow', check: () => this.isClaudeFlowInstalled() },
      { name: 'Chrome Browser', check: () => this.isChromeInstalled() },
      { name: 'Claude Directory', check: () => this.claudeDirExists() },
      { name: 'Agent Configurations', check: () => this.agentsConfigured() },
      { name: 'MCP Servers', check: () => this.mcpServersConfigured() },
    ];

    let allPassed = true;

    for (const check of checks) {
      const passed = check.check();
      if (passed) {
        console.log(chalk.green(`✓ ${check.name}`));
      } else {
        console.log(chalk.red(`✗ ${check.name}`));
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log(chalk.green.bold('\n✅ All checks passed!'));
    } else if (options.fix) {
      console.log(chalk.yellow('\n🔧 Attempting to fix issues...'));
      await this.runCompleteSetup({});
    } else {
      console.log(
        chalk.yellow(
          '\n⚠️ Some checks failed. Run with --fix to attempt repairs.'
        )
      );
    }
  }

  /**
   * Install Chrome extension instructions
   */
  private async installChromeExtension(): Promise<void> {
    console.log(chalk.cyan('\n🔌 Browser MCP Chrome Extension Setup\n'));

    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    const extensionDir = path.join(homeDir, '.claude', 'browser-extension');

    console.log(chalk.white('Extension location: ' + extensionDir));
    console.log(chalk.yellow('\nTo install:'));
    console.log('1. Open Chrome and navigate to chrome://extensions');
    console.log('2. Enable "Developer mode" (top right)');
    console.log('3. Click "Load unpacked"');
    console.log(`4. Select: ${extensionDir}`);
    console.log('\n✅ The extension will then be active!');
  }

  /**
   * Setup hardware-adaptive optimizations
   */
  private async setupOptimizations(options: OptimizeOptions): Promise<void> {
    const spinner = ora();
    console.log(
      chalk.cyan.bold('\n⚡ Claude Code Hardware-Adaptive Optimization Setup\n')
    );

    try {
      const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
      const scriptsDir = path.join(homeDir, '.claude', 'scripts');
      const resourcesDir = path.join(
        __dirname,
        '../../../computer-setup/resources/scripts'
      );

      // Check if optimization scripts already exist
      const scriptsExist = fs.existsSync(scriptsDir);
      if (scriptsExist && !options.force) {
        const inquirer = await import('inquirer');
        const { overwrite } = await inquirer.default.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message:
              'Optimization scripts already exist. Do you want to reinstall?',
            default: false,
          },
        ]);

        if (!overwrite) {
          console.log(chalk.yellow('Optimization setup cancelled'));
          return;
        }
      }

      // Step 1: Create scripts directory
      spinner.start('Creating scripts directory...');
      fs.mkdirSync(scriptsDir, { recursive: true });
      spinner.succeed('Scripts directory ready');

      // Step 2: Copy optimization scripts
      spinner.start('Installing optimization scripts...');

      if (!fs.existsSync(resourcesDir)) {
        spinner.fail('Optimization scripts not found in resources');
        console.error(
          chalk.red(
            `Expected scripts at: ${resourcesDir}\nPlease ensure @wundr/computer-setup is installed.`
          )
        );
        return;
      }

      // Copy all scripts
      const scripts = [
        'detect-hardware-limits.js',
        'claude-optimized',
        'orchestrator.js',
        'cleanup-zombies.sh',
        'README-ORCHESTRATION.md',
        'QUICK-START.md',
      ];

      for (const script of scripts) {
        const src = path.join(resourcesDir, script);
        const dest = path.join(scriptsDir, script);

        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        } else {
          console.warn(chalk.yellow(`⚠️  Script not found: ${script}`));
        }
      }

      // Make executable scripts executable
      const executableScripts = ['claude-optimized', 'cleanup-zombies.sh'];
      for (const script of executableScripts) {
        const scriptPath = path.join(scriptsDir, script);
        if (fs.existsSync(scriptPath)) {
          execSync(`chmod +x "${scriptPath}"`, { stdio: 'pipe' });
        }
      }

      spinner.succeed('Optimization scripts installed');

      // Step 3: Configure shell
      spinner.start('Configuring shell environment...');
      await this.addOptimizationToShell(homeDir);
      spinner.succeed('Shell configuration updated');

      console.log(chalk.green.bold('\n✅ Optimization setup complete!\n'));

      // Show what was installed
      console.log(chalk.cyan('📦 Installed Scripts:'));
      console.log(
        chalk.white('  • detect-hardware-limits.js - Hardware detection')
      );
      console.log(
        chalk.white('  • claude-optimized - Optimized Claude wrapper')
      );
      console.log(
        chalk.white('  • orchestrator.js - Fault-tolerant orchestration')
      );
      console.log(
        chalk.white('  • cleanup-zombies.sh - Process cleanup utility')
      );

      console.log(chalk.cyan('\n🔧 Shell Aliases:'));
      console.log(
        chalk.white('  • claude - Hardware-optimized Claude wrapper')
      );
      console.log(chalk.white('  • claude-stats - Show hardware statistics'));
      console.log(chalk.white('  • claude-cleanup - Clean up zombie processes'));
      console.log(
        chalk.white('  • claude-orchestrate - Run multi-task orchestrator')
      );

      console.log(chalk.cyan('\n📝 Next Steps:'));
      console.log('1. Restart your terminal (or run: source ~/.zshrc)');
      console.log('2. Run "claude-stats" to see your hardware configuration');
      console.log('3. Use "claude" command as normal - now optimized!');
      console.log(
        '4. Read ~/.claude/scripts/QUICK-START.md for advanced usage'
      );
    } catch (error) {
      spinner.fail('Optimization setup failed');
      console.error(chalk.red(error));
      throw error;
    }
  }

  /**
   * Generate CLAUDE.md configuration
   */
  private async generateClaudeConfig(repoPath: string): Promise<void> {
    const spinner = ora('Generating CLAUDE.md configuration...').start();

    try {
      const resolvedPath = path.resolve(repoPath);
      await this.generateClaudeConfigForPath(spinner, resolvedPath);
      spinner.succeed('CLAUDE.md generated successfully');
      console.log(chalk.green(`\n✅ CLAUDE.md created at: ${path.join(resolvedPath, 'CLAUDE.md')}`));
    } catch (error) {
      spinner.fail('Failed to generate CLAUDE.md');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Generate CLAUDE.md for a specific path
   */
  private async generateClaudeConfigForPath(spinner: OraSpinner, repoPath: string): Promise<void> {
    spinner.text = 'Generating CLAUDE.md configuration...';

    try {
      // Try to use the ClaudeConfigGenerator if available
      // Use path.resolve to construct the path at runtime to avoid TypeScript rootDir issues
      const generatorPath = path.resolve(__dirname, '../../../../../src/claude-generator/claude-config-generator.js');
      const { ClaudeConfigGenerator } = await import(/* @vite-ignore */ generatorPath);
      const generator = new ClaudeConfigGenerator(repoPath);

      const claudeContent = await generator.generateClaudeMarkdown();
      const claudeFilePath = path.join(repoPath, 'CLAUDE.md');

      fs.writeFileSync(claudeFilePath, claudeContent, 'utf-8');
    } catch {
      // Fallback: Create a basic CLAUDE.md
      spinner.text = 'Creating basic CLAUDE.md...';
      const basicContent = this.generateBasicClaudeConfig(repoPath);
      fs.writeFileSync(path.join(repoPath, 'CLAUDE.md'), basicContent, 'utf-8');
    }

    spinner.text = 'CLAUDE.md generated successfully';
  }

  /**
   * Generate basic CLAUDE.md content as fallback
   */
  private generateBasicClaudeConfig(repoPath: string): string {
    const projectName = path.basename(repoPath);
    return `# Claude Code Configuration - ${projectName}

## Project Overview
This project uses Claude Code for AI-assisted development.

## Commands
- \`npm run build\` - Build the project
- \`npm run test\` - Run tests
- \`npm run lint\` - Run linting

## Code Style
- Follow existing patterns in the codebase
- Write clear, descriptive commit messages
- Add tests for new features

## MCP Tools
Claude Flow is configured for enhanced AI coordination.
Run \`npx claude-flow sparc modes\` to see available modes.
`;
  }

  /**
   * Setup project template - from /src/cli/commands/claude-setup.ts
   */
  private async setupProjectTemplate(spinner: OraSpinner, repoPath: string, templateName: string): Promise<void> {
    spinner.text = `Applying ${templateName} template...`;

    const templates: Record<string, () => void> = {
      'typescript': () => this.setupTypeScriptTemplate(repoPath),
      'react': () => this.setupReactTemplate(repoPath),
      'nodejs': () => this.setupNodeTemplate(repoPath),
      'monorepo': () => this.setupMonorepoTemplate(repoPath)
    };

    const setupFunction = templates[templateName];
    if (!setupFunction) {
      throw new Error(`Unknown template: ${templateName}. Available: ${Object.keys(templates).join(', ')}`);
    }

    setupFunction();

    spinner.text = `${templateName} template applied`;
  }

  private setupTypeScriptTemplate(repoPath: string): void {
    // Create basic TypeScript configuration if not exists
    const tsconfigPath = path.join(repoPath, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
      const tsconfig = {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'node',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          declaration: true,
          outDir: 'dist',
          rootDir: 'src'
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist']
      };

      fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    }

    // Create src directory
    const srcPath = path.join(repoPath, 'src');
    if (!fs.existsSync(srcPath)) {
      fs.mkdirSync(srcPath, { recursive: true });
      fs.writeFileSync(path.join(srcPath, 'index.ts'), '// Your TypeScript code here\n');
    }
  }

  private setupReactTemplate(repoPath: string): void {
    // Ensure React-specific structure
    const srcPath = path.join(repoPath, 'src');
    if (!fs.existsSync(srcPath)) {
      fs.mkdirSync(srcPath, { recursive: true });
    }

    // Create components directory
    const componentsPath = path.join(srcPath, 'components');
    if (!fs.existsSync(componentsPath)) {
      fs.mkdirSync(componentsPath, { recursive: true });
    }

    // Create hooks directory
    const hooksPath = path.join(srcPath, 'hooks');
    if (!fs.existsSync(hooksPath)) {
      fs.mkdirSync(hooksPath, { recursive: true });
    }
  }

  private setupNodeTemplate(repoPath: string): void {
    // Create basic Node.js structure
    const srcPath = path.join(repoPath, 'src');
    if (!fs.existsSync(srcPath)) {
      fs.mkdirSync(srcPath, { recursive: true });
      fs.writeFileSync(path.join(srcPath, 'index.js'), '// Your Node.js code here\n');
    }

    // Create routes directory
    const routesPath = path.join(srcPath, 'routes');
    if (!fs.existsSync(routesPath)) {
      fs.mkdirSync(routesPath, { recursive: true });
    }
  }

  private setupMonorepoTemplate(repoPath: string): void {
    // Create packages directory
    const packagesPath = path.join(repoPath, 'packages');
    if (!fs.existsSync(packagesPath)) {
      fs.mkdirSync(packagesPath, { recursive: true });
    }

    // Create apps directory
    const appsPath = path.join(repoPath, 'apps');
    if (!fs.existsSync(appsPath)) {
      fs.mkdirSync(appsPath, { recursive: true });
    }

    // Create workspace package.json if not exists
    const packageJsonPath = path.join(repoPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      const packageJson = {
        name: 'monorepo-workspace',
        version: '1.0.0',
        private: true,
        workspaces: ['packages/*', 'apps/*'],
        devDependencies: {
          'turbo': '^2.0.0'
        }
      };

      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }
  }

  /**
   * Initialize swarm - from /src/cli/commands/claude-setup.ts
   */
  private async initializeSwarm(spinner: OraSpinner, repoPath: string): Promise<void> {
    spinner.text = 'Initializing Claude Flow swarm...';

    try {
      // Initialize basic swarm configuration
      execSync('npx claude-flow@alpha init', {
        cwd: repoPath,
        stdio: 'pipe'
      });
    } catch {
      // Swarm init might fail if not properly configured
      console.log(chalk.yellow('\n⚠️  Could not initialize swarm automatically.'));
      console.log(chalk.yellow('You can initialize manually later with: npx claude-flow init'));
    }

    spinner.text = 'Swarm initialization completed';
  }

  /**
   * Validate project setup - from /src/cli/commands/claude-setup.ts
   */
  private async validateProjectSetup(spinner: OraSpinner, repoPath: string): Promise<void> {
    spinner.text = 'Validating setup...';

    const validations = [
      { name: 'CLAUDE.md', path: path.join(repoPath, 'CLAUDE.md') },
      { name: 'MCP Tools', path: path.join(repoPath, 'mcp-tools') },
      { name: 'Git repository', path: path.join(repoPath, '.git') }
    ];

    const results = validations.map(validation => ({
      ...validation,
      exists: fs.existsSync(validation.path)
    }));

    const failures = results.filter(r => !r.exists);
    if (failures.length > 0) {
      throw new Error(`Setup validation failed: Missing ${failures.map(f => f.name).join(', ')}`);
    }

    spinner.text = 'Setup validation passed';
  }

  /**
   * Add shell optimization configuration
   */
  private async addOptimizationToShell(homeDir: string): Promise<void> {
    const shellConfigs = [
      path.join(homeDir, '.zshrc'),
      path.join(homeDir, '.bashrc'),
    ];

    const optimizationConfig = `
# ═══════════════════════════════════════════════════════════════════════════
# Claude Code - Hardware-Adaptive Configuration (Auto-generated by Wundr)
# ═══════════════════════════════════════════════════════════════════════════

# Ensure PATH includes usr/local/bin
export PATH="/usr/local/bin:$PATH"

# Hardware-adaptive V8 memory configuration
if [ -f "$HOME/.claude/scripts/detect-hardware-limits.js" ]; then
  eval "$(node $HOME/.claude/scripts/detect-hardware-limits.js export 2>/dev/null)"
fi

# Alias 'claude' to use hardware-optimized wrapper
if [ -f "$HOME/.claude/scripts/claude-optimized" ]; then
  alias claude="$HOME/.claude/scripts/claude-optimized"
else
  # Fallback to standard claude if optimization scripts not available
  alias claude='npx @anthropic-ai/claude-code'
fi

# Convenience aliases for Claude optimization tools
alias claude-stats='node $HOME/.claude/scripts/detect-hardware-limits.js 2>/dev/null'
alias claude-cleanup='$HOME/.claude/scripts/cleanup-zombies.sh 2>/dev/null'
alias claude-orchestrate='node $HOME/.claude/scripts/orchestrator.js'

# ═══════════════════════════════════════════════════════════════════════════
`;

    for (const configFile of shellConfigs) {
      if (fs.existsSync(configFile)) {
        const content = fs.readFileSync(configFile, 'utf8');

        // Check if optimization config already exists
        if (
          content.includes(
            'Claude Code - Hardware-Adaptive Configuration (Auto-generated by Wundr)'
          )
        ) {
          // Remove old config and add new one
          const lines = content.split('\n');
          const startIdx = lines.findIndex(line =>
            line.includes(
              'Claude Code - Hardware-Adaptive Configuration (Auto-generated by Wundr)'
            )
          );

          if (startIdx !== -1) {
            // Find the end of the config block
            let endIdx = startIdx;
            for (let i = startIdx + 1; i < lines.length; i++) {
              if (lines[i]?.includes('═══════════════')) {
                endIdx = i;
                break;
              }
            }

            // Remove old config
            lines.splice(startIdx - 1, endIdx - startIdx + 3);
            const newContent = lines.join('\n');
            fs.writeFileSync(configFile, newContent + optimizationConfig);
          }
        } else {
          // Add new config
          fs.appendFileSync(configFile, optimizationConfig);
        }
      }
    }
  }

  /**
   * Install Chrome browser
   */
  private async installChrome(): Promise<void> {
    if (process.platform === 'darwin') {
      execSync(
        'curl -L -o ~/Downloads/googlechrome.dmg "https://dl.google.com/chrome/mac/stable/GGRO/googlechrome.dmg"'
      );
      execSync('hdiutil attach ~/Downloads/googlechrome.dmg');
      execSync(
        'cp -R "/Volumes/Google Chrome/Google Chrome.app" /Applications/'
      );
      execSync('hdiutil detach "/Volumes/Google Chrome"');
      execSync('rm ~/Downloads/googlechrome.dmg');
    } else {
      console.log(
        chalk.yellow('Chrome installation is only automated for macOS')
      );
    }
  }

  /**
   * Setup Claude settings.json
   */
  private async setupClaudeSettings(): Promise<void> {
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    const configPath = path.join(homeDir, '.claude', 'settings.json');

    const config = {
      claudeCodeOptions: {
        enabledMcpjsonServers: [
          'claude-flow',
          'firecrawl',
          'context7',
          'playwright',
          'browser',
          'sequentialthinking',
        ],
        gitAutoCompact: true,
        contextCompactionThreshold: 100000,
        enableHooks: true,
        enableAgentCoordination: true,
        enableNeuralTraining: true,
        enablePerformanceTracking: true,
      },
    };

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  // ==================== Helper Methods ====================

  private isClaudeInstalled(): boolean {
    try {
      execSync('claude --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private isClaudeFlowInstalled(): boolean {
    try {
      execSync('npx claude-flow@alpha --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private isChromeInstalled(): boolean {
    if (process.platform === 'darwin') {
      return fs.existsSync('/Applications/Google Chrome.app');
    }
    return true; // Assume installed on other platforms
  }

  private claudeDirExists(): boolean {
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    return fs.existsSync(path.join(homeDir, '.claude'));
  }

  private agentsConfigured(): boolean {
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    const agentsDir = path.join(homeDir, '.claude', 'agents');
    if (!fs.existsSync(agentsDir)) return false;

    const files = fs.readdirSync(agentsDir);
    return files.length > 0;
  }

  private mcpServersConfigured(): boolean {
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    const settingsPath = path.join(homeDir, '.claude', 'settings.json');

    if (!fs.existsSync(settingsPath)) return false;

    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return settings.claudeCodeOptions?.enabledMcpjsonServers?.length > 0;
    } catch {
      return false;
    }
  }

  private listAgents(): void {
    console.log(chalk.cyan('\n📋 Available Claude Flow Agents:\n'));

    const categories: Record<string, string[]> = {
      'Core Development': [
        'coder',
        'reviewer',
        'tester',
        'planner',
        'researcher',
      ],
      'Swarm Coordination': [
        'hierarchical-coordinator',
        'mesh-coordinator',
        'adaptive-coordinator',
        'collective-intelligence-coordinator',
        'swarm-memory-manager',
      ],
      'Consensus & Distributed': [
        'byzantine-coordinator',
        'raft-manager',
        'gossip-coordinator',
        'consensus-builder',
        'crdt-synchronizer',
        'quorum-manager',
        'security-manager',
      ],
      'Performance & Optimization': [
        'perf-analyzer',
        'performance-benchmarker',
        'task-orchestrator',
        'memory-coordinator',
        'smart-agent',
      ],
      'GitHub & Repository': [
        'github-modes',
        'pr-manager',
        'code-review-swarm',
        'issue-tracker',
        'release-manager',
        'workflow-automation',
        'project-board-sync',
        'repo-architect',
        'multi-repo-swarm',
      ],
      'SPARC Methodology': [
        'sparc-coord',
        'sparc-coder',
        'specification',
        'pseudocode',
        'architecture',
        'refinement',
      ],
      'Specialized Development': [
        'backend-dev',
        'mobile-dev',
        'ml-developer',
        'cicd-engineer',
        'api-docs',
        'system-architect',
        'code-analyzer',
        'base-template-generator',
      ],
      'Testing & Validation': [
        'tdd-london-swarm',
        'production-validator',
      ],
      'Migration & Planning': [
        'migration-planner',
        'swarm-init',
      ],
    };

    for (const [category, agents] of Object.entries(categories)) {
      console.log(chalk.yellow(`${category}:`));
      agents.forEach(agent => console.log(`  • ${agent}`));
      console.log();
    }

    console.log(chalk.gray(`Total: 54 agents available`));
  }

  private getProfileAgents(profile: string): string[] {
    const profileAgents: Record<string, string[]> = {
      frontend: ['coder', 'reviewer', 'tester', 'mobile-dev', 'ui-designer'],
      backend: [
        'coder',
        'reviewer',
        'tester',
        'backend-dev',
        'system-architect',
        'api-docs',
      ],
      fullstack: [
        'coder',
        'reviewer',
        'tester',
        'planner',
        'researcher',
        'system-architect',
        'backend-dev',
      ],
      devops: ['planner', 'cicd-engineer', 'perf-analyzer', 'github-modes', 'workflow-automation'],
      ml: ['ml-developer', 'coder', 'tester', 'perf-analyzer', 'researcher'],
    };

    return (
      profileAgents[profile] ||
      profileAgents['fullstack'] || ['coder', 'reviewer', 'tester']
    );
  }

  private generateAgentConfig(agentName: string): Record<string, unknown> {
    return {
      name: agentName,
      enabled: true,
      description: `${agentName} agent for Claude Flow`,
      configuration: {
        maxTokens: 8000,
        temperature: 0.7,
        topP: 0.9,
        enableMemory: true,
        enableLearning: true,
      },
    };
  }

  /**
   * Display final instructions for project setup
   */
  private displayProjectFinalInstructions(repoPath: string, options: SetupOptions): void {
    console.log(chalk.green('\n🎉 Claude Code Setup Complete!'));
    console.log(chalk.blue('================================'));

    console.log(chalk.yellow('\n📋 What was set up:'));
    console.log('✅ CLAUDE.md configuration generated');
    if (!options.skipFlow) {
      console.log('✅ Claude Flow installed and configured');
    }
    if (!options.skipMcp) {
      console.log('✅ MCP Tools directory created');
    }
    console.log('✅ Project structure validated');

    console.log(chalk.yellow('\n🚀 Next Steps:'));
    console.log('1. Review and customize CLAUDE.md as needed');
    console.log('2. Install MCP tools: cd mcp-tools && ./install.sh');
    console.log('3. Verify Claude Desktop MCP connection');

    if (!options.skipFlow) {
      console.log('4. Test Claude Flow: npx claude-flow sparc modes');
    }

    console.log('5. Start coding with optimized Claude Code integration!');

    console.log(chalk.yellow('\n📚 Resources:'));
    console.log('• Claude Flow: https://github.com/ruvnet/claude-flow');
    console.log('• MCP Documentation: https://modelcontextprotocol.io/docs');
    console.log('• Wundr Documentation: ./docs/');

    console.log(chalk.green('\n✨ Happy coding with Claude!'));
  }

  /**
   * Print next steps after complete setup
   */
  private printNextSteps(): void {
    console.log(chalk.cyan('📋 Next Steps:'));
    console.log('1. Configure API keys for MCP tools (if needed)');
    console.log(
      '2. Install Browser MCP Chrome extension: wundr claude-setup extension'
    );
    console.log('3. Restart Claude Desktop to load new configurations');
    console.log('4. Initialize a project: wundr claude-setup project');
    console.log(
      '5. Start coding with Claude Flow: npx claude-flow@alpha sparc tdd "feature"'
    );
  }
}

/**
 * Factory function for backwards compatibility with function-based approach
 * This allows both import patterns to work:
 * - import claudeSetupCommand from './claude-setup' (class-based)
 * - import { createClaudeSetupCommand } from './claude-setup' (function-based)
 */
export function createClaudeSetupCommand(): Command {
  const program = new Command();
  new ClaudeSetupCommands(program);
  return program.commands.find(cmd => cmd.name() === 'claude-setup') || program;
}

const createClaudeSetupCommands = (program: Command): ClaudeSetupCommands =>
  new ClaudeSetupCommands(program);

export default createClaudeSetupCommands;
