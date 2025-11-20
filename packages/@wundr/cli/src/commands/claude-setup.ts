import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execSync, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Claude Setup Commands
 * Comprehensive setup for Claude Code, Claude Flow, and MCP tools
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
  ${chalk.green('wundr claude-setup mcp')}          Install all MCP tools
  ${chalk.green('wundr claude-setup agents')}       Configure all 54 agents
  ${chalk.green('wundr claude-setup optimize')}     Setup hardware-adaptive optimizations
  ${chalk.green('wundr claude-setup validate')}     Validate Claude installation
      `)
      );

    // Main setup command
    claudeSetup
      .command('install', { isDefault: true })
      .description('Complete Claude ecosystem installation')
      .option('--skip-chrome', 'Skip Chrome installation')
      .option('--skip-mcp', 'Skip MCP tools installation')
      .option('--skip-agents', 'Skip agent configuration')
      .action(async options => {
        await this.runCompleteSetup(options);
      });

    // MCP tools installation
    claudeSetup
      .command('mcp')
      .description('Install and configure MCP tools')
      .option(
        '--tool <tool>',
        'Install specific tool (firecrawl, context7, playwright, browser, sequentialthinking)'
      )
      .action(async options => {
        await this.installMcpTools(options);
      });

    // Agent configuration
    claudeSetup
      .command('agents')
      .description('Configure Claude Flow agents')
      .option('--list', 'List available agents')
      .option('--enable <agents>', 'Enable specific agents (comma-separated)')
      .option('--profile <profile>', 'Use profile-specific agents')
      .action(async options => {
        await this.configureAgents(options);
      });

    // Validation
    claudeSetup
      .command('validate')
      .description('Validate Claude installation')
      .option('--fix', 'Attempt to fix issues')
      .action(async options => {
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
      .action(async options => {
        await this.setupOptimizations(options);
      });
  }

  private async runCompleteSetup(options: any): Promise<void> {
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

      // Step 3: Install MCP tools (if not skipped)
      if (!options.skipMcp) {
        await this.installMcpTools({});
      }

      // Step 4: Configure agents (if not skipped)
      if (!options.skipAgents) {
        await this.configureAgents({ profile: 'fullstack' });
      }

      // Step 5: Setup Claude configuration
      spinner.start('Configuring Claude settings...');
      await this.setupClaudeConfig();
      spinner.succeed('Claude configured');

      console.log(chalk.green.bold('\n✅ Claude ecosystem setup complete!\n'));
      this.printNextSteps();
    } catch (error) {
      spinner.fail('Setup failed');
      console.error(chalk.red(error));
      process.exit(1);
    }
  }

  private async installMcpTools(options: any): Promise<void> {
    const spinner = ora();
    const scriptPath = path.join(
      __dirname,
      '../../../../scripts/install-mcp-tools.sh'
    );

    if (!fs.existsSync(scriptPath)) {
      console.error(chalk.red('❌ MCP tools installation script not found'));
      console.log(
        chalk.yellow('Please ensure the script exists at: ' + scriptPath)
      );
      return;
    }

    console.log(chalk.cyan('\n📦 Installing MCP Tools...\n'));

    if (options.tool) {
      // Install specific tool
      spinner.start(`Installing ${options.tool} MCP...`);
      try {
        const installCommands: Record<string, string> = {
          firecrawl: 'npx claude mcp add firecrawl npx @firecrawl/mcp-server',
          context7: 'npx claude mcp add context7 npx @context7/mcp-server',
          playwright:
            'npx claude mcp add playwright npx @playwright/mcp-server',
          browser: 'npx claude mcp add browser npx @browser/mcp-server',
          sequentialthinking:
            'npm install -g @modelcontextprotocol/server-sequentialthinking',
        };

        const command = installCommands[options.tool];
        if (command) {
          execSync(command, { stdio: 'inherit' });
          spinner.succeed(`${options.tool} MCP installed`);
        } else {
          spinner.fail(`Unknown tool: ${options.tool}`);
        }
      } catch (error) {
        spinner.fail(`Failed to install ${options.tool}`);
        console.error(error);
      }
    } else {
      // Install all tools using the script
      console.log(
        chalk.gray('Running comprehensive MCP tools installation...')
      );

      const install = spawn('bash', [scriptPath], {
        stdio: 'inherit',
        shell: true,
      });

      return new Promise((resolve, reject) => {
        install.on('close', code => {
          if (code === 0) {
            console.log(
              chalk.green('\n✅ All MCP tools installed successfully')
            );
            resolve();
          } else {
            reject(new Error(`Installation failed with code ${code}`));
          }
        });
      });
    }
  }

  private async configureAgents(options: any): Promise<void> {
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
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
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

  private async validateInstallation(options: any): Promise<void> {
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

  private async installChromeExtension(): Promise<void> {
    console.log(chalk.cyan('\n🔌 Browser MCP Chrome Extension Setup\n'));

    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const extensionDir = path.join(homeDir, '.claude', 'browser-extension');

    console.log(chalk.white('Extension location: ' + extensionDir));
    console.log(chalk.yellow('\nTo install:'));
    console.log('1. Open Chrome and navigate to chrome://extensions');
    console.log('2. Enable "Developer mode" (top right)');
    console.log('3. Click "Load unpacked"');
    console.log(`4. Select: ${extensionDir}`);
    console.log('\n✅ The extension will then be active!');
  }

  private async setupOptimizations(options: any): Promise<void> {
    const spinner = ora();
    console.log(
      chalk.cyan.bold('\n⚡ Claude Code Hardware-Adaptive Optimization Setup\n')
    );

    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const scriptsDir = path.join(homeDir, '.claude', 'scripts');
      const resourcesDir = path.join(
        __dirname,
        '../../../computer-setup/resources/scripts'
      );

      // Check if optimization scripts already exist
      const scriptsExist = fs.existsSync(scriptsDir);
      if (scriptsExist && !options.force) {
        const { overwrite } = await (
          await import('inquirer')
        ).default.prompt([
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

  private async setupClaudeConfig(): Promise<void> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
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
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    return fs.existsSync(path.join(homeDir, '.claude'));
  }

  private agentsConfigured(): boolean {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const agentsDir = path.join(homeDir, '.claude', 'agents');
    if (!fs.existsSync(agentsDir)) return false;

    const files = fs.readdirSync(agentsDir);
    return files.length > 0;
  }

  private mcpServersConfigured(): boolean {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
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

    const categories = {
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
      ],
      'GitHub Integration': [
        'github-modes',
        'pr-manager',
        'issue-tracker',
        'release-manager',
      ],
      Specialized: [
        'backend-dev',
        'mobile-dev',
        'ml-developer',
        'system-architect',
      ],
    };

    for (const [category, agents] of Object.entries(categories)) {
      console.log(chalk.yellow(`${category}:`));
      agents.forEach(agent => console.log(`  • ${agent}`));
      console.log();
    }
  }

  private getProfileAgents(profile: string): string[] {
    const profileAgents: Record<string, string[]> = {
      frontend: ['coder', 'reviewer', 'tester', 'mobile-dev'],
      backend: [
        'coder',
        'reviewer',
        'tester',
        'backend-dev',
        'system-architect',
      ],
      fullstack: [
        'coder',
        'reviewer',
        'tester',
        'planner',
        'researcher',
        'system-architect',
      ],
      devops: ['planner', 'cicd-engineer', 'perf-analyzer', 'github-modes'],
    };

    return (
      profileAgents[profile] ||
      profileAgents.fullstack || ['coder', 'reviewer', 'tester']
    );
  }

  private generateAgentConfig(agentName: string): any {
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

  private printNextSteps(): void {
    console.log(chalk.cyan('📋 Next Steps:'));
    console.log('1. Configure API keys for MCP tools (if needed)');
    console.log(
      '2. Install Browser MCP Chrome extension: wundr claude-setup extension'
    );
    console.log('3. Restart Claude Desktop to load new configurations');
    console.log('4. Initialize a project: wundr claude-init');
    console.log(
      '5. Start coding with Claude Flow: npx claude-flow@alpha sparc tdd "feature"'
    );
  }
}

const createClaudeSetupCommands = (program: Command) =>
  new ClaudeSetupCommands(program);
export default createClaudeSetupCommands;
