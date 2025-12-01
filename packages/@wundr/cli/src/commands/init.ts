import path from 'path';

import chalk from 'chalk';
import fs from 'fs-extra';
import inquirer from 'inquirer';

import { initProjectRag, type RagInitOptions } from '@wundr.io/core';
import { errorHandler } from '../utils/error-handler';
import { logger } from '../utils/logger';

import type { PluginManager } from '../plugins/plugin-manager';
import type { ConfigManager } from '../utils/config-manager';
import type { Command } from 'commander';

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
      .option(
        '--with-rag',
        'initialize RAG (Retrieval-Augmented Generation) support'
      )
      .action(async (name, options) => {
        await this.initProject(name, options);
      });

    // Initialize RAG for existing project
    initCmd
      .command('rag')
      .description('initialize RAG support for an existing project')
      .option('--force', 'force re-initialization even if config exists')
      .option('--skip-indexing', 'skip initial file indexing')
      .option('--project-name <name>', 'override project name')
      .action(async options => {
        await this.initRag(options);
      });

    // Initialize configuration
    initCmd
      .command('config')
      .description('initialize Wundr configuration')
      .option('--interactive', 'use interactive setup')
      .option('--global', 'create global configuration')
      .action(async options => {
        await this.initConfig(options);
      });

    // Initialize workspace
    initCmd
      .command('workspace')
      .description('initialize multi-project workspace')
      .option('--name <name>', 'workspace name')
      .option('--packages <pattern>', 'packages pattern', 'packages/*')
      .action(async options => {
        await this.initWorkspace(options);
      });

    // Initialize plugins
    initCmd
      .command('plugins')
      .description('initialize plugin system')
      .option('--install <plugins>', 'plugins to install (comma-separated)')
      .action(async options => {
        await this.initPlugins(options);
      });
  }

  /**
   * Initialize a new Wundr project
   */
  private async initProject(name: string, options: any): Promise<void> {
    try {
      const projectName = name || (await this.promptProjectName());
      const projectPath = path.join(process.cwd(), projectName);

      logger.info(`Initializing project: ${chalk.cyan(projectName)}`);

      // Check if directory already exists
      if (await fs.pathExists(projectPath)) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'Directory already exists. Overwrite?',
            default: false,
          },
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

      // Initialize RAG if --with-rag flag is provided
      if (options.withRag) {
        logger.info('Initializing RAG support...');
        const ragResult = await initProjectRag(projectPath, {
          projectName,
        });

        if (ragResult.success) {
          logger.success(
            `RAG initialized: ${ragResult.filesIndexed} files indexed`
          );
          logger.info(
            `  Framework detected: ${chalk.cyan(ragResult.framework.name)}`
          );
        } else {
          logger.warn('RAG initialization had issues:');
          for (const error of ragResult.errors) {
            logger.warn(`  - ${error}`);
          }
        }

        for (const warning of ragResult.warnings) {
          logger.warn(`  Warning: ${warning}`);
        }
      }

      logger.success(`Project ${projectName} initialized successfully!`);
      logger.info('Next steps:');
      logger.info(`  cd ${projectName}`);
      logger.info('  wundr analyze');
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
   * Initialize RAG support for existing project
   */
  private async initRag(options: {
    force?: boolean;
    skipIndexing?: boolean;
    projectName?: string;
  }): Promise<void> {
    try {
      const projectPath = process.cwd();
      logger.info(`Initializing RAG support in: ${chalk.cyan(projectPath)}`);

      const ragOptions: RagInitOptions = {
        force: options.force,
        skipIndexing: options.skipIndexing,
        projectName: options.projectName,
      };

      const result = await initProjectRag(projectPath, ragOptions);

      if (result.success) {
        logger.success('RAG initialization complete!');
        logger.info(`  Config: ${chalk.cyan(result.configPath)}`);
        logger.info(`  Exclusions: ${chalk.cyan(result.excludePath)}`);
        logger.info(`  Files indexed: ${chalk.cyan(result.filesIndexed)}`);
        logger.info(
          `  Framework: ${chalk.cyan(result.framework.name)} (${result.framework.projectType})`
        );
      } else {
        logger.error('RAG initialization failed:');
        for (const error of result.errors) {
          logger.error(`  - ${error}`);
        }
      }

      for (const warning of result.warnings) {
        logger.warn(`  Warning: ${warning}`);
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_INIT_RAG_FAILED',
        'Failed to initialize RAG',
        { options },
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
      const configPath = options.global
        ? configPaths.user
        : configPaths.project;

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
      const workspaceName = options.name || (await this.promptWorkspaceName());

      logger.info(`Initializing workspace: ${chalk.cyan(workspaceName)}`);

      const workspaceConfig = {
        name: workspaceName,
        version: '1.0.0',
        workspaces: [options.packages],
        scripts: {
          build: 'wundr build --workspace',
          test: 'wundr test --workspace',
          lint: 'wundr lint --workspace',
          analyze: 'wundr analyze --workspace',
        },
        devDependencies: {
          '@wundr/cli': '^1.0.0',
        },
      };

      await fs.writeJson('package.json', workspaceConfig, { spaces: 2 });
      await fs.ensureDir('packages');

      // Create workspace-specific wundr config
      await this.configManager.loadConfig();
      await this.configManager.saveConfig(
        path.join(process.cwd(), 'wundr.config.json')
      );

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
  private async createProjectStructure(
    projectPath: string,
    options: any
  ): Promise<void> {
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
    await this.configManager.saveConfig(
      path.join(projectPath, 'wundr.config.json')
    );
  }

  /**
   * Create default project structure
   */
  private async createDefaultStructure(
    projectPath: string,
    options: any
  ): Promise<void> {
    const directories = options.monorepo
      ? ['packages', 'apps', 'tools', 'docs', 'scripts', '.claude-flow']
      : ['src', 'tests', 'docs', 'scripts', '.claude-flow'];

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
        analyze: 'wundr analyze',
        verify: './scripts/verify-claims.sh',
      },
      devDependencies: {
        '@wundr/cli': '^1.0.0',
      },
      ...(options.monorepo && { workspaces: ['packages/*', 'apps/*'] }),
    };

    await fs.writeJson(path.join(projectPath, 'package.json'), packageJson, {
      spaces: 2,
    });

    // Create README
    const readme = this.generateReadme(path.basename(projectPath), options);
    await fs.writeFile(path.join(projectPath, 'README.md'), readme);

    // Create verification files
    await this.createVerificationFiles(projectPath);
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
          { name: 'Terminal UI', value: 'tui' },
        ],
        default: 'cli',
      },
      {
        type: 'input',
        name: 'aiProvider',
        message: 'AI provider:',
        default: 'claude',
      },
      {
        type: 'input',
        name: 'aiModel',
        message: 'AI model:',
        default: 'claude-3',
      },
      {
        type: 'confirm',
        name: 'enableGitHub',
        message: 'Enable GitHub integration?',
        default: false,
      },
      {
        type: 'input',
        name: 'githubToken',
        message: 'GitHub token:',
        when: answers => answers.enableGitHub,
        validate: input => input.length > 0 || 'GitHub token is required',
      },
    ]);

    await this.configManager.loadConfig();

    this.configManager.updateConfig({
      defaultMode: answers.defaultMode,
      ai: {
        provider: answers.aiProvider,
        model: answers.aiModel,
      },
      ...(answers.enableGitHub && {
        integrations: {
          github: {
            token: answers.githubToken,
            owner: '',
            repo: '',
          },
        },
      }),
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
        validate: input => input.length > 0 || 'Project name is required',
      },
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
        validate: input => input.length > 0 || 'Workspace name is required',
      },
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

  /**
   * Create verification files for preventing hallucinations
   */
  private async createVerificationFiles(projectPath: string): Promise<void> {
    // Create CLAUDE.md with verification protocols
    const claudeMd = `# Claude Code Configuration - WITH VERIFICATION PROTOCOLS

## 🚨 CRITICAL: VERIFICATION PROTOCOL & REALITY CHECKS

### MANDATORY: ALWAYS VERIFY, NEVER ASSUME

**After EVERY code change or implementation:**
1. **TEST IT**: Run the actual command and show real output
2. **PROVE IT**: Show file contents, build results, test output  
3. **FAIL LOUDLY**: If something fails, say "❌ FAILED:" immediately
4. **VERIFY SUCCESS**: Only claim "complete" after showing it working

**FORBIDDEN BEHAVIORS:**
- ❌ NEVER claim "build successful" without running build
- ❌ NEVER say "tests pass" without running tests
- ❌ NEVER report "implemented" without verification
- ❌ NEVER hide or minimize errors
- ❌ NEVER generate fictional terminal output
- ❌ NEVER assume code works because you wrote it

**REQUIRED BEHAVIORS:**
- ✅ Run actual commands
- ✅ Show real output
- ✅ Report failures immediately
- ✅ Document issues in FAILURES.md
- ✅ Test before claiming done
- ✅ Be honest about state

### FAILURE REPORTING FORMAT
\`\`\`
❌ FAILURE: [Component Name]
Error: [Exact error message]
Location: [File and line if available]
Status: BLOCKED/PARTIAL/NEEDS_INVESTIGATION
\`\`\`

### SUCCESS REPORTING FORMAT
\`\`\`
✅ VERIFIED: [Component Name]
Build Output: [Show actual npm run build success]
Test Output: [Show actual test results]
Execution: [Show feature actually running]
\`\`\`

## Project Commands

- \`npm run build\` - Build the project
- \`npm run test\` - Run tests
- \`npm run verify\` - Run verification script
- \`wundr analyze\` - Analyze project
`;

    await fs.writeFile(path.join(projectPath, 'CLAUDE.md'), claudeMd);

    // Create verification script
    const verifyScript = `#!/bin/bash

# Verification Script - MUST pass before claiming tasks complete
set -e

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

echo "================================================"
echo "🔍 VERIFICATION SCRIPT"
echo "================================================"

FAILURES=0
SUCCESSES=0

test_command() {
    local description=$1
    local command=$2
    
    echo -n "Testing: $description... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "\${GREEN}✅ PASSED\${NC}"
        ((SUCCESSES++))
    else
        echo -e "\${RED}❌ FAILED\${NC}"
        echo "  Command: $command"
        ((FAILURES++))
    fi
}

echo "1. CHECKING BUILD SYSTEM"
test_command "Project build" "npm run build"

echo ""
echo "2. CHECKING TESTS"
test_command "Project tests" "npm test"

echo ""
echo "================================================"
echo -e "Successes: \${GREEN}$SUCCESSES\${NC}"
echo -e "Failures:  \${RED}$FAILURES\${NC}"

if [ $FAILURES -gt 0 ]; then
    echo -e "\${RED}❌ VERIFICATION FAILED\${NC}"
    echo "Cannot claim tasks complete with $FAILURES failures!"
    exit 1
else
    echo -e "\${GREEN}✅ ALL VERIFICATIONS PASSED\${NC}"
    exit 0
fi
`;

    await fs.writeFile(
      path.join(projectPath, 'scripts', 'verify-claims.sh'),
      verifyScript
    );
    await fs.chmod(
      path.join(projectPath, 'scripts', 'verify-claims.sh'),
      '755'
    );

    // Create FAILURES.md
    const failuresMd = `# Failure Tracking

This file tracks actual failures encountered during development.
Always update this when encountering issues that block progress.

## Format

### [Date] - [Component]
**Error**: Exact error message
**Command**: Command that failed
**Status**: BLOCKED/PARTIAL/RESOLVED
**Solution**: What fixed it (if resolved)

---

## Active Failures

_(None yet - will be populated when failures occur)_

## Resolved Failures

_(None yet - will be populated when failures are resolved)_
`;

    await fs.writeFile(
      path.join(projectPath, 'docs', 'FAILURES.md'),
      failuresMd
    );

    // Create verification hooks
    const verificationHooks = {
      version: '1.0.0',
      hooks: {
        'pre-completion': {
          enabled: true,
          required: true,
          commands: ['./scripts/verify-claims.sh'],
          failureMessage: '❌ Cannot mark complete - verification failed!',
        },
        'post-implementation': {
          enabled: true,
          commands: ['npm run build', 'npm test'],
          continueOnFailure: false,
        },
        'reality-check': {
          enabled: true,
          interval: 'after-each-task',
          checks: [
            'build-passes',
            'tests-pass',
            'no-typescript-errors',
            'dependencies-installed',
          ],
        },
      },
      enforcement: {
        blockHallucinatedSuccess: true,
        requireActualOutput: true,
        documentFailures: true,
        verifyBeforeClaiming: true,
      },
    };

    await fs.writeJson(
      path.join(projectPath, '.claude-flow', 'verification-hooks.json'),
      verificationHooks,
      { spaces: 2 }
    );

    // Create agent verification protocol
    const agentProtocol = `# 🚨 AGENT VERIFICATION PROTOCOL

## MANDATORY FOR ALL AGENTS

### CORE PRINCIPLE: VERIFY, DON'T HALLUCINATE

## BEFORE CLAIMING SUCCESS

**ALWAYS run these commands and show output:**
\`\`\`bash
npm run build  # or appropriate build command
npm test       # if tests exist
\`\`\`

## FORBIDDEN BEHAVIORS

**NEVER DO THIS:**
- ❌ Claim "build successful" without running build
- ❌ Say "tests pass" without running tests
- ❌ Report "implemented" without verification
- ❌ Hide or minimize errors
- ❌ Generate fictional terminal output

## REQUIRED BEHAVIORS

**ALWAYS DO THIS:**
- ✅ Run actual commands
- ✅ Show real output
- ✅ Report failures immediately
- ✅ Document issues in FAILURES.md
- ✅ Test before claiming done

Remember: It's better to report a failure honestly than to claim false success.
`;

    await fs.writeFile(
      path.join(projectPath, 'docs', 'AGENT_VERIFICATION_PROTOCOL.md'),
      agentProtocol
    );

    logger.debug('Verification files created');
  }
}
