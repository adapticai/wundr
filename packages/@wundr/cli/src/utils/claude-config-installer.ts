/**
 * Claude Code Configuration Installer
 * Handles installation of CLAUDE.md, hooks, conventions, and agent templates
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { logger } from './logger';
import { BackupRollbackManager } from './backup-rollback-manager';

export interface ClaudeConfigOptions {
  claudeDir?: string;
  sourceDir?: string;
  dryRun?: boolean;
  skipBackup?: boolean;
  overwrite?: boolean;
  verbose?: boolean;
}

export interface InstallResult {
  success: boolean;
  installed: string[];
  skipped: string[];
  errors: Array<{ file: string; error: string }>;
  backupId?: string;
}

export class ClaudeConfigInstaller {
  private claudeDir: string;
  private sourceDir: string;
  private backupManager: BackupRollbackManager;
  private homeDir: string;

  constructor(options: ClaudeConfigOptions = {}) {
    this.homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.claudeDir = options.claudeDir || path.join(this.homeDir, '.claude');
    this.sourceDir = options.sourceDir || process.cwd();
    this.backupManager = new BackupRollbackManager();
  }

  /**
   * Initialize installer
   */
  async initialize(): Promise<void> {
    await this.backupManager.initialize();

    // Create Claude directory structure
    await this.createDirectoryStructure();
  }

  /**
   * Install all Claude Code configurations
   */
  async install(options: ClaudeConfigOptions = {}): Promise<InstallResult> {
    const { dryRun = false, skipBackup = false, overwrite = false, verbose = false } = options;

    const result: InstallResult = {
      success: false,
      installed: [],
      skipped: [],
      errors: [],
    };

    try {
      console.log(chalk.cyan('\n🔧 Installing Claude Code Configuration\n'));

      // Create backup of existing configs
      if (!skipBackup && !dryRun) {
        const existingFiles = await this.getExistingConfigFiles();
        if (existingFiles.length > 0) {
          const spinner = ora('Creating backup of existing configurations...').start();
          const backup = await this.backupManager.createBackup(
            existingFiles,
            'Pre-installation backup'
          );
          result.backupId = backup.backupId;
          spinner.succeed(`Backup created: ${backup.backupId}`);
        }
      }

      // Install CLAUDE.md
      await this.installClaudeMd(result, { dryRun, overwrite, verbose });

      // Install hooks
      await this.installHooks(result, { dryRun, overwrite, verbose });

      // Install conventions
      await this.installConventions(result, { dryRun, overwrite, verbose });

      // Install agent templates
      await this.installAgentTemplates(result, { dryRun, overwrite, verbose });

      // Install git-worktree workflows
      await this.installGitWorktreeWorkflows(result, { dryRun, overwrite, verbose });

      // Install validation scripts
      await this.installValidationScripts(result, { dryRun, overwrite, verbose });

      result.success = result.errors.length === 0;

      // Display summary
      this.displayInstallSummary(result, dryRun);

      return result;
    } catch (error) {
      logger.error('Installation failed', error);
      result.errors.push({
        file: 'general',
        error: error instanceof Error ? error.message : String(error)
      });
      return result;
    }
  }

  /**
   * Install enhanced CLAUDE.md to ~/.claude/
   */
  private async installClaudeMd(
    result: InstallResult,
    options: { dryRun: boolean; overwrite: boolean; verbose: boolean }
  ): Promise<void> {
    const spinner = ora('Installing CLAUDE.md...').start();

    try {
      const sourcePath = path.join(this.sourceDir, 'CLAUDE.md');
      const targetPath = path.join(this.claudeDir, 'CLAUDE.md');

      if (!existsSync(sourcePath)) {
        spinner.warn('CLAUDE.md not found in source directory');
        result.skipped.push('CLAUDE.md');
        return;
      }

      if (existsSync(targetPath) && !options.overwrite) {
        if (options.verbose) {
          spinner.info('CLAUDE.md already exists (use --overwrite to replace)');
        }
        result.skipped.push('CLAUDE.md');
        return;
      }

      if (options.dryRun) {
        spinner.info('Would install CLAUDE.md');
        result.installed.push('CLAUDE.md (dry-run)');
        return;
      }

      await fs.copyFile(sourcePath, targetPath);
      spinner.succeed('CLAUDE.md installed');
      result.installed.push('CLAUDE.md');

      logger.info('CLAUDE.md installed', { target: targetPath });
    } catch (error) {
      spinner.fail('Failed to install CLAUDE.md');
      result.errors.push({
        file: 'CLAUDE.md',
        error: error instanceof Error ? error.message : String(error)
      });
      logger.error('CLAUDE.md installation failed', error);
    }
  }

  /**
   * Install hooks configuration
   */
  private async installHooks(
    result: InstallResult,
    options: { dryRun: boolean; overwrite: boolean; verbose: boolean }
  ): Promise<void> {
    const spinner = ora('Installing hooks...').start();

    try {
      const hooksDir = path.join(this.claudeDir, 'hooks');
      await fs.mkdir(hooksDir, { recursive: true });

      const hooks = this.generateHooksConfig();

      for (const [hookName, hookContent] of Object.entries(hooks)) {
        const hookPath = path.join(hooksDir, hookName);

        if (existsSync(hookPath) && !options.overwrite) {
          result.skipped.push(`hooks/${hookName}`);
          continue;
        }

        if (options.dryRun) {
          result.installed.push(`hooks/${hookName} (dry-run)`);
          continue;
        }

        await fs.writeFile(hookPath, hookContent);
        await fs.chmod(hookPath, 0o755); // Make executable
        result.installed.push(`hooks/${hookName}`);
      }

      spinner.succeed(`Hooks installed (${Object.keys(hooks).length} files)`);
      logger.info('Hooks installed', { count: Object.keys(hooks).length });
    } catch (error) {
      spinner.fail('Failed to install hooks');
      result.errors.push({
        file: 'hooks',
        error: error instanceof Error ? error.message : String(error)
      });
      logger.error('Hooks installation failed', error);
    }
  }

  /**
   * Install conventions
   */
  private async installConventions(
    result: InstallResult,
    options: { dryRun: boolean; overwrite: boolean; verbose: boolean }
  ): Promise<void> {
    const spinner = ora('Installing conventions...').start();

    try {
      const conventionsPath = path.join(this.claudeDir, 'conventions.json');
      const conventions = this.generateConventions();

      if (existsSync(conventionsPath) && !options.overwrite) {
        spinner.info('Conventions already exist');
        result.skipped.push('conventions.json');
        return;
      }

      if (options.dryRun) {
        spinner.info('Would install conventions');
        result.installed.push('conventions.json (dry-run)');
        return;
      }

      await fs.writeFile(conventionsPath, JSON.stringify(conventions, null, 2));
      spinner.succeed('Conventions installed');
      result.installed.push('conventions.json');

      logger.info('Conventions installed', { path: conventionsPath });
    } catch (error) {
      spinner.fail('Failed to install conventions');
      result.errors.push({
        file: 'conventions.json',
        error: error instanceof Error ? error.message : String(error)
      });
      logger.error('Conventions installation failed', error);
    }
  }

  /**
   * Install agent templates
   */
  private async installAgentTemplates(
    result: InstallResult,
    options: { dryRun: boolean; overwrite: boolean; verbose: boolean }
  ): Promise<void> {
    const spinner = ora('Installing agent templates...').start();

    try {
      const agentsDir = path.join(this.claudeDir, 'agents');
      await fs.mkdir(agentsDir, { recursive: true });

      const templates = this.generateAgentTemplates();

      for (const [agentName, agentConfig] of Object.entries(templates)) {
        const agentPath = path.join(agentsDir, `${agentName}.json`);

        if (existsSync(agentPath) && !options.overwrite) {
          result.skipped.push(`agents/${agentName}.json`);
          continue;
        }

        if (options.dryRun) {
          result.installed.push(`agents/${agentName}.json (dry-run)`);
          continue;
        }

        await fs.writeFile(agentPath, JSON.stringify(agentConfig, null, 2));
        result.installed.push(`agents/${agentName}.json`);
      }

      spinner.succeed(`Agent templates installed (${Object.keys(templates).length} templates)`);
      logger.info('Agent templates installed', { count: Object.keys(templates).length });
    } catch (error) {
      spinner.fail('Failed to install agent templates');
      result.errors.push({
        file: 'agent-templates',
        error: error instanceof Error ? error.message : String(error)
      });
      logger.error('Agent templates installation failed', error);
    }
  }

  /**
   * Install git-worktree workflows
   */
  private async installGitWorktreeWorkflows(
    result: InstallResult,
    options: { dryRun: boolean; overwrite: boolean; verbose: boolean }
  ): Promise<void> {
    const spinner = ora('Installing git-worktree workflows...').start();

    try {
      const workflowsDir = path.join(this.claudeDir, 'workflows');
      await fs.mkdir(workflowsDir, { recursive: true });

      const workflows = this.generateGitWorktreeWorkflows();

      for (const [workflowName, workflowContent] of Object.entries(workflows)) {
        const workflowPath = path.join(workflowsDir, `${workflowName}.json`);

        if (existsSync(workflowPath) && !options.overwrite) {
          result.skipped.push(`workflows/${workflowName}.json`);
          continue;
        }

        if (options.dryRun) {
          result.installed.push(`workflows/${workflowName}.json (dry-run)`);
          continue;
        }

        await fs.writeFile(workflowPath, JSON.stringify(workflowContent, null, 2));
        result.installed.push(`workflows/${workflowName}.json`);
      }

      spinner.succeed(`Git-worktree workflows installed (${Object.keys(workflows).length} workflows)`);
      logger.info('Git-worktree workflows installed', { count: Object.keys(workflows).length });
    } catch (error) {
      spinner.fail('Failed to install git-worktree workflows');
      result.errors.push({
        file: 'git-worktree-workflows',
        error: error instanceof Error ? error.message : String(error)
      });
      logger.error('Git-worktree workflows installation failed', error);
    }
  }

  /**
   * Install validation scripts
   */
  private async installValidationScripts(
    result: InstallResult,
    options: { dryRun: boolean; overwrite: boolean; verbose: boolean }
  ): Promise<void> {
    const spinner = ora('Installing validation scripts...').start();

    try {
      const scriptsDir = path.join(this.claudeDir, 'scripts');
      await fs.mkdir(scriptsDir, { recursive: true });

      const scripts = this.generateValidationScripts();

      for (const [scriptName, scriptContent] of Object.entries(scripts)) {
        const scriptPath = path.join(scriptsDir, scriptName);

        if (existsSync(scriptPath) && !options.overwrite) {
          result.skipped.push(`scripts/${scriptName}`);
          continue;
        }

        if (options.dryRun) {
          result.installed.push(`scripts/${scriptName} (dry-run)`);
          continue;
        }

        await fs.writeFile(scriptPath, scriptContent);
        await fs.chmod(scriptPath, 0o755); // Make executable
        result.installed.push(`scripts/${scriptName}`);
      }

      spinner.succeed(`Validation scripts installed (${Object.keys(scripts).length} scripts)`);
      logger.info('Validation scripts installed', { count: Object.keys(scripts).length });
    } catch (error) {
      spinner.fail('Failed to install validation scripts');
      result.errors.push({
        file: 'validation-scripts',
        error: error instanceof Error ? error.message : String(error)
      });
      logger.error('Validation scripts installation failed', error);
    }
  }

  /**
   * Create directory structure
   */
  private async createDirectoryStructure(): Promise<void> {
    const dirs = [
      this.claudeDir,
      path.join(this.claudeDir, 'hooks'),
      path.join(this.claudeDir, 'agents'),
      path.join(this.claudeDir, 'workflows'),
      path.join(this.claudeDir, 'scripts'),
      path.join(this.claudeDir, 'templates'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Get existing config files for backup
   */
  private async getExistingConfigFiles(): Promise<string[]> {
    const files: string[] = [];
    const checkFiles = [
      path.join(this.claudeDir, 'CLAUDE.md'),
      path.join(this.claudeDir, 'conventions.json'),
    ];

    for (const file of checkFiles) {
      if (existsSync(file)) {
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Generate hooks configuration files
   */
  private generateHooksConfig(): Record<string, string> {
    return {
      'pre-commit': `#!/bin/bash
# Claude Code pre-commit hook
# Auto-generated by Wundr computer-setup

echo "🔍 Running pre-commit checks..."

# Run linting
if command -v npm &> /dev/null; then
  npm run lint --if-present || true
fi

# Run type checking
if command -v npm &> /dev/null; then
  npm run typecheck --if-present || true
fi

echo "✅ Pre-commit checks completed"
`,
      'post-checkout': `#!/bin/bash
# Claude Code post-checkout hook
# Auto-generated by Wundr computer-setup

echo "🔄 Post-checkout: Installing dependencies..."

# Install dependencies if package.json changed
if command -v npm &> /dev/null; then
  npm install --if-present || true
fi

echo "✅ Post-checkout completed"
`,
    };
  }

  /**
   * Generate conventions configuration
   */
  private generateConventions(): any {
    return {
      fileNaming: {
        components: 'PascalCase',
        utilities: 'camelCase',
        constants: 'UPPER_SNAKE_CASE',
        types: 'PascalCase',
      },
      codeStyle: {
        indentation: 2,
        quotes: 'single',
        semicolons: true,
        trailingComma: 'es5',
      },
      imports: {
        order: ['external', 'internal', 'parent', 'sibling', 'index'],
        grouping: true,
      },
      testing: {
        framework: 'jest',
        coverage: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
      git: {
        commitMessage: 'conventional-commits',
        branchNaming: 'feature/*, fix/*, chore/*',
      },
    };
  }

  /**
   * Generate agent templates
   */
  private generateAgentTemplates(): Record<string, any> {
    return {
      'backend-developer': {
        name: 'Backend Developer',
        role: 'backend-dev',
        responsibilities: [
          'Design RESTful and GraphQL APIs',
          'Implement database models and queries',
          'Create authentication and authorization',
          'Write comprehensive API documentation',
        ],
        tools: ['node', 'typescript', 'postgresql', 'redis'],
        patterns: [
          'Controller-Service-Repository',
          'DTO pattern',
          'Middleware pattern',
        ],
      },
      'frontend-developer': {
        name: 'Frontend Developer',
        role: 'frontend-dev',
        responsibilities: [
          'Build responsive user interfaces',
          'Implement state management',
          'Create reusable components',
          'Optimize performance',
        ],
        tools: ['react', 'typescript', 'tailwind', 'vite'],
        patterns: ['Component composition', 'Custom hooks', 'Context API'],
      },
      'fullstack-developer': {
        name: 'Fullstack Developer',
        role: 'fullstack-dev',
        responsibilities: [
          'Develop end-to-end features',
          'Integrate frontend and backend',
          'Manage database schemas',
          'Deploy applications',
        ],
        tools: ['node', 'react', 'typescript', 'docker'],
        patterns: ['Full-stack architecture', 'API integration', 'CI/CD'],
      },
    };
  }

  /**
   * Generate git-worktree workflows
   */
  private generateGitWorktreeWorkflows(): Record<string, any> {
    return {
      'feature-development': {
        name: 'Feature Development Workflow',
        description: 'Workflow for developing new features in isolation',
        steps: [
          {
            name: 'Create worktree',
            command: 'git worktree add ../feature-name feature/name',
          },
          {
            name: 'Setup environment',
            command: 'cd ../feature-name && npm install',
          },
          {
            name: 'Run tests',
            command: 'npm test',
          },
          {
            name: 'Commit changes',
            command: 'git add . && git commit -m "feat: description"',
          },
        ],
      },
      'bug-fix': {
        name: 'Bug Fix Workflow',
        description: 'Workflow for fixing bugs without affecting main development',
        steps: [
          {
            name: 'Create worktree',
            command: 'git worktree add ../fix-bug fix/bug-name',
          },
          {
            name: 'Reproduce bug',
            command: 'npm test -- bug.test.ts',
          },
          {
            name: 'Fix and verify',
            command: 'npm test',
          },
          {
            name: 'Commit fix',
            command: 'git add . && git commit -m "fix: description"',
          },
        ],
      },
    };
  }

  /**
   * Generate validation scripts
   */
  private generateValidationScripts(): Record<string, string> {
    return {
      'validate-setup.sh': `#!/bin/bash
# Validate Claude Code setup
# Auto-generated by Wundr computer-setup

echo "🔍 Validating Claude Code setup..."

# Check for required files
FILES=(
  "$HOME/.claude/CLAUDE.md"
  "$HOME/.claude/conventions.json"
)

MISSING=0
for file in "\${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing: $file"
    MISSING=$((MISSING + 1))
  else
    echo "✅ Found: $file"
  fi
done

# Check for required directories
DIRS=(
  "$HOME/.claude/hooks"
  "$HOME/.claude/agents"
  "$HOME/.claude/workflows"
)

for dir in "\${DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    echo "❌ Missing directory: $dir"
    MISSING=$((MISSING + 1))
  else
    echo "✅ Found directory: $dir"
  fi
done

if [ $MISSING -eq 0 ]; then
  echo "✅ All validations passed!"
  exit 0
else
  echo "❌ $MISSING validation(s) failed"
  exit 1
fi
`,
      'check-config.sh': `#!/bin/bash
# Check Claude Code configuration
# Auto-generated by Wundr computer-setup

echo "🔧 Checking Claude Code configuration..."

# Check Claude CLI
if command -v claude &> /dev/null; then
  echo "✅ Claude CLI: $(claude --version)"
else
  echo "⚠️  Claude CLI not found"
fi

# Check Node.js
if command -v node &> /dev/null; then
  echo "✅ Node.js: $(node --version)"
else
  echo "❌ Node.js not found"
fi

# Check Git
if command -v git &> /dev/null; then
  echo "✅ Git: $(git --version)"
else
  echo "❌ Git not found"
fi

echo "✅ Configuration check complete"
`,
    };
  }

  /**
   * Display installation summary
   */
  private displayInstallSummary(result: InstallResult, dryRun: boolean): void {
    console.log(chalk.cyan('\n📊 Installation Summary\n'));

    if (dryRun) {
      console.log(chalk.yellow('🔍 DRY RUN MODE - No files were modified\n'));
    }

    if (result.backupId) {
      console.log(chalk.gray(`Backup ID: ${result.backupId}\n`));
    }

    if (result.installed.length > 0) {
      console.log(chalk.green(`✅ Installed (${result.installed.length}):`));
      result.installed.forEach(file => {
        console.log(chalk.white(`  • ${file}`));
      });
      console.log();
    }

    if (result.skipped.length > 0) {
      console.log(chalk.yellow(`⏭️  Skipped (${result.skipped.length}):`));
      result.skipped.forEach(file => {
        console.log(chalk.gray(`  • ${file}`));
      });
      console.log();
    }

    if (result.errors.length > 0) {
      console.log(chalk.red(`❌ Errors (${result.errors.length}):`));
      result.errors.forEach(error => {
        console.log(chalk.red(`  • ${error.file}: ${error.error}`));
      });
      console.log();
    }

    if (result.success) {
      console.log(chalk.green('✅ Installation completed successfully!\n'));
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.white('  1. Review installed configurations'));
      console.log(chalk.white('  2. Run validation: ~/.claude/scripts/validate-setup.sh'));
      console.log(chalk.white('  3. Customize agent templates as needed'));
    } else {
      console.log(chalk.red('❌ Installation completed with errors\n'));
      if (result.backupId) {
        console.log(chalk.cyan('To rollback:'));
        console.log(chalk.white(`  wundr computer-setup rollback --backup ${result.backupId}`));
      }
    }
  }
}
