#!/usr/bin/env node

/**
 * Global installer for Wundr Claude CLI
 * 
 * This script handles global installation and setup of the Wundr CLI
 * for Claude Code integration across any git repository.
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import ora from 'ora';

interface InstallOptions {
  force?: boolean;
  dev?: boolean;
  skipVerification?: boolean;
}

async function installWundrClaude(options: InstallOptions = {}): Promise<void> {
  const spinner = ora('Installing Wundr Claude CLI globally...').start();
  
  try {
    // Step 1: Verify prerequisites
    await verifyPrerequisites(spinner);
    
    // Step 2: Install the package globally
    await installPackage(spinner, options);
    
    // Step 3: Create global configuration
    await createGlobalConfig(spinner);
    
    // Step 4: Set up shell integration
    await setupShellIntegration(spinner);
    
    // Step 5: Verify installation
    if (!options.skipVerification) {
      await verifyInstallation(spinner);
    }
    
    spinner.succeed('Wundr Claude CLI installed successfully!');
    displayPostInstallInstructions();
    
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('❌ Installation failed:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function verifyPrerequisites(spinner: ora.Ora): Promise<void> {
  spinner.text = 'Verifying prerequisites...';
  
  // Check Node.js version
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      throw new Error(`Node.js 18+ required. Found: ${nodeVersion}`);
    }
  } catch (error) {
    throw new Error('Node.js not found. Please install Node.js 18+');
  }

  // Check npm
  try {
    execSync('npm --version', { stdio: 'ignore' });
  } catch (error) {
    throw new Error('npm not found. Please install npm');
  }

  // Check git
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch (error) {
    console.log(chalk.yellow('⚠️  Git not found. Some features may not work properly.'));
  }

  spinner.text = 'Prerequisites verified';
}

async function installPackage(spinner: ora.Ora, options: InstallOptions): Promise<void> {
  spinner.text = 'Installing Wundr Claude CLI package...';
  
  try {
    // For development mode, link the local package
    if (options.dev) {
      execSync('npm link', { stdio: 'inherit' });
    } else {
      // Install from npm (when published)
      execSync('npm install -g @adapticai/wundr', { 
        stdio: options.force ? 'inherit' : 'pipe' 
      });
    }
  } catch (error) {
    // If npm install fails, try with the local package
    spinner.text = 'Installing from local package...';
    execSync('npm pack && npm install -g *.tgz', { stdio: 'inherit' });
  }

  spinner.text = 'Package installation completed';
}

async function createGlobalConfig(spinner: ora.Ora): Promise<void> {
  spinner.text = 'Creating global configuration...';
  
  const configDir = join(homedir(), '.wundr');
  const configFile = join(configDir, 'config.json');
  
  // Create config directory
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Create default configuration
  const defaultConfig = {
    version: '1.0.0',
    installedAt: new Date().toISOString(),
    preferences: {
      defaultTemplate: 'typescript',
      enableAuditByDefault: true,
      verboseOutput: false,
      autoUpdateClaudeConfig: true
    },
    paths: {
      templatesDir: join(configDir, 'templates'),
      cacheDir: join(configDir, 'cache')
    },
    integrations: {
      claudeFlow: {
        enabled: true,
        autoInstall: true
      },
      mcpTools: {
        enabled: true,
        autoSetup: true
      }
    }
  };

  writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));

  // Create templates directory
  if (!existsSync(defaultConfig.paths.templatesDir)) {
    mkdirSync(defaultConfig.paths.templatesDir, { recursive: true });
  }

  // Create cache directory
  if (!existsSync(defaultConfig.paths.cacheDir)) {
    mkdirSync(defaultConfig.paths.cacheDir, { recursive: true });
  }

  spinner.text = 'Global configuration created';
}

async function setupShellIntegration(spinner: ora.Ora): Promise<void> {
  spinner.text = 'Setting up shell integration...';
  
  const shellIntegrationScript = `
# Wundr Claude CLI Integration
# Auto-generated on ${new Date().toISOString()}

# Quick aliases for common operations
alias wci='wundr claude-init'
alias wca='wundr claude-audit'
alias wcs='wundr claude-setup'

# Function to automatically run claude-init when entering a new git repo
wundr_auto_init() {
  if [ -d .git ] && [ ! -f CLAUDE.md ]; then
    echo "🤖 New git repository detected. Run 'wundr init' for Claude Code setup."
  fi
}

# Hook into cd command (bash/zsh)
if [ -n "\$BASH_VERSION" ]; then
  # Bash
  PROMPT_COMMAND="\${PROMPT_COMMAND:+\$PROMPT_COMMAND$'\n'}wundr_auto_init"
elif [ -n "\$ZSH_VERSION" ]; then
  # Zsh
  autoload -U add-zsh-hook
  add-zsh-hook chpwd wundr_auto_init
fi

# Tab completion (basic)
if command -v complete >/dev/null 2>&1; then
  complete -W "init claude-init claude-audit claude-setup help-claude" wundr
fi
`;

  // Write shell integration to various locations
  const shellFiles = [
    join(homedir(), '.bashrc'),
    join(homedir(), '.zshrc'),
    join(homedir(), '.profile')
  ];

  const integrationFile = join(homedir(), '.wundr', 'shell-integration.sh');
  writeFileSync(integrationFile, shellIntegrationScript);

  // Create source line for existing shell configs
  const sourceLine = `\n# Wundr Claude CLI Integration\n[ -f "${integrationFile}" ] && source "${integrationFile}"\n`;

  for (const shellFile of shellFiles) {
    if (existsSync(shellFile)) {
      try {
        const content = require('fs').readFileSync(shellFile, 'utf-8');
        if (!content.includes('Wundr Claude CLI Integration')) {
          require('fs').appendFileSync(shellFile, sourceLine);
        }
      } catch (error) {
        // Ignore errors for shell config modifications
      }
    }
  }

  spinner.text = 'Shell integration configured';
}

async function verifyInstallation(spinner: ora.Ora): Promise<void> {
  spinner.text = 'Verifying installation...';
  
  try {
    // Test the CLI command
    const output = execSync('wundr --version', { encoding: 'utf-8' });
    
    if (!output.includes('1.0.0')) {
      throw new Error('CLI version verification failed');
    }

    // Test help command
    execSync('wundr --help', { stdio: 'ignore' });

    // Test config directory
    const configDir = join(homedir(), '.wundr');
    if (!existsSync(configDir)) {
      throw new Error('Configuration directory not found');
    }

  } catch (error) {
    throw new Error(`Installation verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  spinner.text = 'Installation verified successfully';
}

function displayPostInstallInstructions(): void {
  console.log(chalk.green('\n🎉 Wundr Claude CLI Installation Complete!'));
  console.log(chalk.blue('==========================================='));
  
  console.log(chalk.yellow('\n✅ What was installed:'));
  console.log('• Global wundr command');
  console.log('• Shell integration and aliases');
  console.log('• Global configuration in ~/.wundr/');
  console.log('• Template system for project types');

  console.log(chalk.yellow('\n🚀 Quick Start:'));
  console.log('1. Navigate to any git repository');
  console.log('2. Run: wundr init');
  console.log('3. Or use: wundr claude-setup for full setup');

  console.log(chalk.yellow('\n⚡ New Aliases Available:'));
  console.log('• wci  → wundr claude-init');
  console.log('• wca  → wundr claude-audit');
  console.log('• wcs  → wundr claude-setup');

  console.log(chalk.yellow('\n🤖 Smart Features:'));
  console.log('• Auto-detects project types (React, Node.js, TypeScript, etc.)');
  console.log('• Suggests repository improvements');
  console.log('• Configures optimal agent swarms');
  console.log('• Sets up MCP tools automatically');
  console.log('• Prompts for Claude Code setup in new repos');

  console.log(chalk.yellow('\n📚 Learn More:'));
  console.log('• wundr help-claude  → Comprehensive guide');
  console.log('• wundr --help       → All available commands');

  console.log(chalk.green('\n🔄 Next Steps:'));
  console.log('1. Restart your terminal (or run: source ~/.bashrc)');
  console.log('2. Navigate to a project directory');  
  console.log('3. Try: wundr claude-audit --detailed');
  console.log('4. Then: wundr claude-init --interactive');

  console.log(chalk.blue('\n✨ Happy coding with optimized Claude Code integration!'));
}

// CLI interface for the installer
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: InstallOptions = {
    force: args.includes('--force'),
    dev: args.includes('--dev'),
    skipVerification: args.includes('--skip-verification')
  };

  installWundrClaude(options).catch((error) => {
    console.error(chalk.red('Installation failed:'), error);
    process.exit(1);
  });
}

export { installWundrClaude };