#!/usr/bin/env node

/**
 * Initialize Dashboard Command
 * npx wundr init-dashboard - Sets up dashboard for consumer projects
 */

import { Command } from 'commander';
import { mkdir, writeFile, copyFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { ConfigurationAPI, DashboardConfig } from '../config/ConfigurationAPI';

export interface InitOptions {
  projectPath?: string;
  template?: string;
  interactive?: boolean;
  force?: boolean;
  skipInstall?: boolean;
  port?: number;
}

export class InitCommand {
  private projectPath: string;
  private options: InitOptions;

  constructor(projectPath: string = process.cwd(), options: InitOptions = {}) {
    this.projectPath = path.resolve(projectPath);
    this.options = options;
  }

  async execute(): Promise<void> {
    console.log(chalk.blue.bold('🚀 Wundr Dashboard Initialization'));
    console.log(chalk.gray(`Initializing dashboard in: ${this.projectPath}`));

    try {
      // Step 1: Validate environment
      await this.validateEnvironment();

      // Step 2: Gather configuration
      const config = await this.gatherConfiguration();

      // Step 3: Create directory structure
      await this.createDirectoryStructure();

      // Step 4: Generate configuration files
      await this.generateConfigurationFiles(config);

      // Step 5: Create starter files
      await this.createStarterFiles(config);

      // Step 6: Install dependencies (optional)
      if (!this.options.skipInstall) {
        await this.installDependencies();
      }

      // Step 7: Create scripts and shortcuts
      await this.createScripts();

      console.log(chalk.green.bold('\n✅ Dashboard initialization complete!'));
      this.printNextSteps();

    } catch (error) {
      console.error(chalk.red.bold('\n❌ Initialization failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  private async validateEnvironment(): Promise<void> {
    const spinner = ora('Validating environment...').start();

    try {
      // Check Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      if (majorVersion < 18) {
        throw new Error('Node.js 18 or higher is required');
      }

      // Check if directory exists and is not empty
      if (existsSync(this.projectPath)) {
        const files = await readFile(this.projectPath).catch(() => []);
        if (Array.isArray(files) && files.length > 0 && !this.options.force) {
          throw new Error('Directory is not empty. Use --force to override.');
        }
      }

      spinner.succeed('Environment validated');
    } catch (error) {
      spinner.fail('Environment validation failed');
      throw error;
    }
  }

  private async gatherConfiguration(): Promise<DashboardConfig> {
    if (!this.options.interactive) {
      return ConfigurationAPI.createTemplate();
    }

    console.log(chalk.yellow('\n📋 Configuration Setup'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'appName',
        message: 'What is your project name?',
        default: path.basename(this.projectPath),
      },
      {
        type: 'input',
        name: 'primaryColor',
        message: 'Primary color (hex):',
        default: '#0066CC',
        validate: (input: string) => {
          const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
          return hexRegex.test(input) || 'Please enter a valid hex color';
        },
      },
      {
        type: 'input',
        name: 'defaultPath',
        message: 'Default analysis path:',
        default: './',
      },
      {
        type: 'input',
        name: 'excludePatterns',
        message: 'Exclude patterns (comma-separated):',
        default: 'node_modules,dist,build,.git',
        filter: (input: string) => input.split(',').map(s => s.trim()),
      },
      {
        type: 'checkbox',
        name: 'includeExtensions',
        message: 'File extensions to analyze:',
        choices: [
          { name: 'TypeScript (.ts, .tsx)', value: ['.ts', '.tsx'], checked: true },
          { name: 'JavaScript (.js, .jsx)', value: ['.js', '.jsx'], checked: true },
          { name: 'Vue (.vue)', value: ['.vue'] },
          { name: 'Python (.py)', value: ['.py'] },
          { name: 'Java (.java)', value: ['.java'] },
          { name: 'C# (.cs)', value: ['.cs'] },
        ],
        filter: (choices: string[][]) => choices.flat(),
      },
      {
        type: 'number',
        name: 'port',
        message: 'Dashboard port:',
        default: 3000,
      },
      {
        type: 'confirm',
        name: 'enablePlugins',
        message: 'Enable plugin system?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'enableIntegrations',
        message: 'Enable external integrations?',
        default: true,
      },
    ]);

    // Build configuration from answers
    const config = ConfigurationAPI.createTemplate();
    config.branding.appName = answers.appName;
    config.branding.primaryColor = answers.primaryColor;
    config.analysis.defaultPath = answers.defaultPath;
    config.analysis.excludePatterns = answers.excludePatterns;
    config.analysis.includeExtensions = answers.includeExtensions;
    config.port = answers.port;

    if (answers.enablePlugins) {
      config.plugins = ['@wundr/core-plugins'];
    }

    return config;
  }

  private async createDirectoryStructure(): Promise<void> {
    const spinner = ora('Creating directory structure...').start();

    const directories = [
      'wundr-dashboard',
      'wundr-dashboard/config',
      'wundr-dashboard/plugins',
      'wundr-dashboard/themes',
      'wundr-dashboard/scripts',
      'wundr-dashboard/data',
      'wundr-dashboard/logs',
    ];

    try {
      for (const dir of directories) {
        await mkdir(path.join(this.projectPath, dir), { recursive: true });
      }
      spinner.succeed('Directory structure created');
    } catch (error) {
      spinner.fail('Failed to create directory structure');
      throw error;
    }
  }

  private async generateConfigurationFiles(config: DashboardConfig): Promise<void> {
    const spinner = ora('Generating configuration files...').start();

    try {
      // Main configuration file
      const configPath = path.join(this.projectPath, 'wundr.config.json');
      await writeFile(configPath, JSON.stringify(config, null, 2));

      // Environment file template
      const envContent = this.generateEnvTemplate(config);
      const envPath = path.join(this.projectPath, '.env.wundr');
      await writeFile(envPath, envContent);

      // Package.json scripts
      await this.updatePackageJson(config);

      spinner.succeed('Configuration files generated');
    } catch (error) {
      spinner.fail('Failed to generate configuration files');
      throw error;
    }
  }

  private generateEnvTemplate(config: DashboardConfig): string {
    return `# Wundr Dashboard Environment Configuration
# Generated automatically - customize as needed

# Branding
WUNDR_APP_NAME="${config.branding.appName}"
WUNDR_PRIMARY_COLOR="${config.branding.primaryColor}"
WUNDR_SECONDARY_COLOR="${config.branding.secondaryColor}"

# Analysis
WUNDR_DEFAULT_PATH="${config.analysis.defaultPath}"
WUNDR_EXCLUDE_PATTERNS="${config.analysis.excludePatterns.join(',')}"

# Server
WUNDR_PORT=${config.port}
WUNDR_ENVIRONMENT="${config.environment}"

# Custom settings (add your own)
# WUNDR_LOGO=./assets/logo.png
# WUNDR_FAVICON=./assets/favicon.ico
# WUNDR_CUSTOM_CSS=./themes/custom.css
`;
  }

  private async updatePackageJson(config: DashboardConfig): Promise<void> {
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    
    let packageJson: any = {};
    if (existsSync(packageJsonPath)) {
      const content = await readFile(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(content);
    }

    // Add Wundr scripts
    packageJson.scripts = {
      ...packageJson.scripts,
      'wundr:dev': 'wundr dashboard --dev',
      'wundr:start': 'wundr dashboard --start',
      'wundr:build': 'wundr dashboard --build',
      'wundr:analyze': 'wundr analyze',
      'wundr:config': 'wundr config',
    };

    // Add dependencies
    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      '@lumic/wundr': 'latest',
    };

    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }

  private async createStarterFiles(config: DashboardConfig): Promise<void> {
    const spinner = ora('Creating starter files...').start();

    try {
      // Create custom theme file
      const themeContent = this.generateThemeFile(config);
      const themePath = path.join(this.projectPath, 'wundr-dashboard/themes/custom.css');
      await writeFile(themePath, themeContent);

      // Create example plugin
      const pluginContent = this.generateExamplePlugin();
      const pluginPath = path.join(this.projectPath, 'wundr-dashboard/plugins/example-plugin');
      await mkdir(pluginPath, { recursive: true });
      await writeFile(path.join(pluginPath, 'plugin.json'), JSON.stringify({
        name: 'example-plugin',
        version: '1.0.0',
        description: 'Example plugin for customization',
        author: 'Generated',
        main: 'index.js',
        type: 'component',
      }, null, 2));
      await writeFile(path.join(pluginPath, 'index.js'), pluginContent);

      // Create example scripts
      const scriptContent = this.generateExampleScript();
      const scriptPath = path.join(this.projectPath, 'wundr-dashboard/scripts/example.js');
      await writeFile(scriptPath, scriptContent);

      // Create README
      const readmeContent = this.generateReadme(config);
      const readmePath = path.join(this.projectPath, 'wundr-dashboard/README.md');
      await writeFile(readmePath, readmeContent);

      spinner.succeed('Starter files created');
    } catch (error) {
      spinner.fail('Failed to create starter files');
      throw error;
    }
  }

  private generateThemeFile(config: DashboardConfig): string {
    return `:root {
  --wundr-primary: ${config.branding.primaryColor};
  --wundr-secondary: ${config.branding.secondaryColor};
}

/* Custom theme overrides */
.wundr-dashboard {
  --primary-color: var(--wundr-primary);
  --secondary-color: var(--wundr-secondary);
}

/* Add your custom styles here */
.custom-header {
  background: var(--wundr-primary);
  color: white;
  padding: 1rem;
}

.custom-card {
  border: 1px solid var(--wundr-secondary);
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
}
`;
  }

  private generateExamplePlugin(): string {
    return `// Example Wundr Dashboard Plugin
// This plugin adds a custom page to the dashboard

module.exports = {
  async initialize(context) {
    const { api, logger } = context;
    
    logger.info('Example plugin initializing...');
    
    // Add a custom menu item
    api.addMenuItem({
      id: 'example-page',
      label: 'Example',
      path: '/example',
      icon: 'example-icon',
      group: 'custom',
      order: 100,
    });
    
    logger.info('Example plugin initialized successfully');
  },
  
  // Custom React component for the page
  component: function ExampleComponent() {
    return React.createElement('div', {
      className: 'custom-card'
    }, [
      React.createElement('h2', null, 'Example Plugin Page'),
      React.createElement('p', null, 'This is a custom page added by a plugin.'),
      React.createElement('p', null, 'You can customize this component to show any content you need.'),
    ]);
  },
  
  async cleanup() {
    console.log('Example plugin cleaning up...');
  }
};
`;
  }

  private generateExampleScript(): string {
    return `#!/usr/bin/env node
// Example analysis script
// This script can be run from the dashboard or CLI

const fs = require('fs');
const path = require('path');

async function runAnalysis() {
  console.log('Running example analysis...');
  
  // Example: Count files by extension
  const projectPath = process.env.WUNDR_DEFAULT_PATH || './';
  const stats = await analyzeProject(projectPath);
  
  console.log('Analysis Results:', stats);
  return stats;
}

async function analyzeProject(projectPath) {
  const stats = {};
  
  // Simple file counting by extension
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.')) {
        walkDir(filePath);
      } else if (stat.isFile()) {
        const ext = path.extname(file);
        stats[ext] = (stats[ext] || 0) + 1;
      }
    }
  }
  
  walkDir(projectPath);
  return stats;
}

// Export for use in dashboard
module.exports = { runAnalysis };

// Run if called directly
if (require.main === module) {
  runAnalysis().catch(console.error);
}
`;
  }

  private generateReadme(config: DashboardConfig): string {
    return `# ${config.branding.appName} - Wundr Dashboard

This directory contains your customized Wundr dashboard configuration and extensions.

## 📁 Structure

- \`config/\` - Configuration files
- \`plugins/\` - Custom plugins
- \`themes/\` - Custom CSS themes
- \`scripts/\` - Analysis scripts
- \`data/\` - Analysis data and cache
- \`logs/\` - Dashboard logs

## 🚀 Quick Start

### Start Dashboard
\`\`\`bash
npm run wundr:dev    # Development mode
npm run wundr:start  # Production mode
\`\`\`

### Run Analysis
\`\`\`bash
npm run wundr:analyze  # Run project analysis
\`\`\`

### Configuration
\`\`\`bash
npm run wundr:config   # Open configuration manager
\`\`\`

## 🎨 Customization

### Themes
Edit \`themes/custom.css\` to customize the appearance:
- Primary color: ${config.branding.primaryColor}
- Secondary color: ${config.branding.secondaryColor}

### Plugins
Create custom plugins in the \`plugins/\` directory. See \`plugins/example-plugin/\` for reference.

### Scripts
Add custom analysis scripts to \`scripts/\`. They'll be available in the dashboard.

## 🔧 Configuration

Main configuration is in \`../wundr.config.json\`.
Environment variables are in \`../.env.wundr\`.

### Environment Variables
- \`WUNDR_APP_NAME\` - Dashboard title
- \`WUNDR_PRIMARY_COLOR\` - Primary theme color
- \`WUNDR_PORT\` - Dashboard port (default: ${config.port})
- \`WUNDR_DEFAULT_PATH\` - Analysis path (default: ${config.analysis.defaultPath})

## 📖 Documentation

For full documentation, visit: https://wundr.io/docs

## 🆘 Support

- Issues: https://github.com/lumicai/wundr/issues
- Discussions: https://github.com/lumicai/wundr/discussions
`;
  }

  private async installDependencies(): Promise<void> {
    const spinner = ora('Installing dependencies...').start();

    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      await execAsync('npm install', { cwd: this.projectPath });
      spinner.succeed('Dependencies installed');
    } catch (error) {
      spinner.warn('Failed to install dependencies automatically. Run "npm install" manually.');
    }
  }

  private async createScripts(): Promise<void> {
    const spinner = ora('Creating helper scripts...').start();

    try {
      // Create start script
      const startScript = `#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Wundr Dashboard..."
npm run wundr:dev
`;
      const startPath = path.join(this.projectPath, 'start-dashboard.sh');
      await writeFile(startPath, startScript, { mode: 0o755 });

      // Create Windows batch file
      const batchScript = `@echo off
cd /d "%~dp0"
echo Starting Wundr Dashboard...
npm run wundr:dev
pause
`;
      const batchPath = path.join(this.projectPath, 'start-dashboard.bat');
      await writeFile(batchPath, batchScript);

      spinner.succeed('Helper scripts created');
    } catch (error) {
      spinner.fail('Failed to create helper scripts');
      throw error;
    }
  }

  private printNextSteps(): void {
    console.log(chalk.cyan('\n📋 Next Steps:'));
    console.log(chalk.white('1. Review configuration in wundr.config.json'));
    console.log(chalk.white('2. Customize theme in wundr-dashboard/themes/custom.css'));
    console.log(chalk.white('3. Add environment variables to .env.wundr'));
    console.log(chalk.white('4. Start the dashboard:'));
    console.log(chalk.green('   npm run wundr:dev'));
    console.log(chalk.white('\n5. Open in browser:'));
    console.log(chalk.blue(`   http://localhost:${this.options.port || 3000}`));
    
    console.log(chalk.cyan('\n🔗 Helpful Commands:'));
    console.log(chalk.white('• npm run wundr:analyze  - Run analysis'));
    console.log(chalk.white('• npm run wundr:config   - Manage configuration'));
    console.log(chalk.white('• ./start-dashboard.sh   - Quick start (Unix)'));
    console.log(chalk.white('• start-dashboard.bat    - Quick start (Windows)'));
  }
}

// CLI Command Setup
export function createInitCommand(): Command {
  return new Command('init-dashboard')
    .description('Initialize Wundr dashboard for your project')
    .argument('[path]', 'Project path', process.cwd())
    .option('-t, --template <template>', 'Use template')
    .option('-i, --interactive', 'Interactive setup', true)
    .option('--force', 'Force initialization in non-empty directory')
    .option('--skip-install', 'Skip dependency installation')
    .action(async (projectPath: string, options: InitOptions) => {
      const initCommand = new InitCommand(projectPath, options);
      await initCommand.execute();
    });
}

export default InitCommand;