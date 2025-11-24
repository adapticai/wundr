import * as path from 'path';

import chalk from 'chalk';
import * as fs from 'fs-extra';
import inquirer from 'inquirer';
import ora from 'ora';

import { generateClaudeCodeStructure } from './claude-code-conventions.js';
import {
  createEnhancedOptions,
  DEFAULT_MEMORY_CONFIGS,
  DEFAULT_ORCHESTRATION_CONFIGS,
  WORKFORCE_SIZE_MAP,
} from './enhanced-options.js';
import { TemplateManager } from '../templates/template-manager.js';

import type {
  EnhancedProjectOptions,
  ProjectType,
  SessionManagerArchetype,
  SubAgentWorkforceSize,
} from './enhanced-options.js';
import type { TemplateContext } from '../templates/template-manager.js';
import type { DeveloperProfile } from '../types/index.js';

// Re-export types and constants for backward compatibility
export type { ProjectType, SubAgentWorkforceSize };
export { WORKFORCE_SIZE_MAP };

/**
 * Project initialization options
 * Supports both basic and enhanced configuration
 */
export interface ProjectInitOptions {
  projectPath: string;
  projectName: string;
  projectType: ProjectType;
  profile?: DeveloperProfile;
  includeClaudeSetup: boolean;
  includeAgents: boolean;
  includeHooks: boolean;
  includeGitWorktree: boolean;
  includeTemplates: boolean;
  customAgents?: string[];
  interactive?: boolean;
  force?: boolean;
  // Three-tier architecture options
  enableFleetArchitecture?: boolean;
  sessionManagerArchetype?: SessionManagerArchetype;
  subAgentWorkforceSize?: SubAgentWorkforceSize;
  enableIPREGovernance?: boolean;
  enableAlignmentMonitoring?: boolean;
  // Enhanced options (optional)
  enhanced?: Partial<EnhancedProjectOptions>;
}

export interface ClaudeDirectoryStructure {
  agents: {
    core: string[];
    specialized: string[];
    github: string[];
    testing: string[];
    devops: string[];
  };
  commands: string[];
  hooks: string[];
  conventions: string[];
  templates: string[];
}

/**
 * Complete project initialization manager
 * Handles .claude directory setup, template copying, and customization
 */
export class ProjectInitializer {
  private templateManager: TemplateManager;
  private spinner = ora();
  private resourcesDir: string;

  constructor() {
    this.templateManager = new TemplateManager();
    this.resourcesDir = path.join(__dirname, '../../resources');
  }

  /**
   * Initialize project with enhanced options
   *
   * This method provides full support for context engineering, memory
   * architectures, orchestration frameworks, and advanced Claude Code features.
   *
   * @param enhancedOptions - Full enhanced project options
   */
  async initializeEnhanced(
    enhancedOptions: EnhancedProjectOptions,
  ): Promise<void> {
    this.spinner.info(chalk.blue.bold('Wundr Enhanced Project Initialization'));

    try {
      // Validate and prepare project
      await this.validateProject({
        ...enhancedOptions,
        includeClaudeSetup: enhancedOptions.includeClaudeSetup,
        includeAgents: enhancedOptions.includeAgents,
        includeHooks: enhancedOptions.includeHooks,
        includeGitWorktree: enhancedOptions.includeGitWorktree,
        includeTemplates: enhancedOptions.includeTemplates,
      });

      // Generate Claude Code structure using enhanced generator
      if (enhancedOptions.includeClaudeSetup) {
        this.spinner.start(
          'Generating enhanced .claude directory structure...',
        );
        await generateClaudeCodeStructure(enhancedOptions);
        this.spinner.succeed('Enhanced Claude Code structure generated');
      }

      // Setup deployment configuration if platforms detected
      await this.setupDeploymentConfig(enhancedOptions);

      // Copy and customize templates
      if (enhancedOptions.includeTemplates) {
        await this.copyTemplates(enhancedOptions);
      }

      // Setup git-worktree configuration
      if (enhancedOptions.includeGitWorktree) {
        await this.setupGitWorktree(enhancedOptions);
      }

      // Initialize agent workflows
      if (enhancedOptions.includeAgents) {
        await this.initializeAgentWorkflows(enhancedOptions);
      }

      // Setup hooks
      if (enhancedOptions.includeHooks) {
        await this.setupHooks(enhancedOptions);
      }

      // Setup governance (IPRE) if enabled
      if (
        enhancedOptions.enableIPREGovernance ||
        enhancedOptions.enableFleetArchitecture
      ) {
        await this.setupGovernance(enhancedOptions);
      }

      // Setup memory bank if fleet architecture or tiered memory enabled
      if (
        enhancedOptions.enableFleetArchitecture ||
        enhancedOptions.memoryConfig?.architecture === 'tiered' ||
        enhancedOptions.memoryConfig?.architecture === 'memgpt'
      ) {
        await this.setupMemoryBank(enhancedOptions);
      }

      // Create project-specific documentation
      await this.createProjectDocumentation(enhancedOptions);

      // Validate the setup
      await this.validateSetup(enhancedOptions);

      this.spinner.succeed(
        chalk.green.bold('Enhanced project initialization complete!'),
      );
      this.printEnhancedNextSteps(enhancedOptions);
    } catch (error) {
      this.spinner.fail(chalk.red(`Initialization failed: ${error}`));
      throw error;
    }
  }

  /**
   * Create enhanced options from basic options with defaults
   *
   * @param options - Basic project init options
   * @returns Enhanced options with defaults applied
   */
  createEnhancedFromBasic(options: ProjectInitOptions): EnhancedProjectOptions {
    return createEnhancedOptions({
      ...options,
      contextEngineering: options.enhanced?.contextEngineering,
      memoryConfig: options.enhanced?.memoryConfig ?? {
        architecture: options.enableFleetArchitecture ? 'tiered' : 'basic',
        ...DEFAULT_MEMORY_CONFIGS[
          options.enableFleetArchitecture ? 'tiered' : 'basic'
        ],
      },
      orchestration: options.enhanced?.orchestration ?? {
        ...DEFAULT_ORCHESTRATION_CONFIGS['claude-flow'],
      },
      promptConfig: options.enhanced?.promptConfig,
      security: options.enhanced?.security,
      agents: options.enhanced?.agents,
      skills: options.enhanced?.skills,
      commands: options.enhanced?.commands,
    });
  }

  /**
   * Print next steps for enhanced initialization
   */
  private printEnhancedNextSteps(options: EnhancedProjectOptions): void {
    const steps: string[] = [
      chalk.cyan(`Next Steps for ${options.projectName} (Enhanced Setup):`),
      chalk.white('1. Review CLAUDE.md configuration'),
      chalk.white('2. Explore .claude/agents/ for available agents'),
      chalk.white('3. Check .claude/skills/ for available skills'),
      chalk.white('4. Review .claude/commands/ for slash commands'),
      chalk.white('5. Check .claude/settings.json for configuration'),
    ];

    if (options.memoryConfig?.architecture !== 'basic') {
      steps.push(
        chalk.white('6. Review memory bank structure in .claude/memory/'),
      );
    }

    if (options.enableFleetArchitecture || options.enableIPREGovernance) {
      steps.push(
        chalk.white('7. Review governance policies in .claude/governance/'),
      );
    }

    if (options.orchestration?.framework === 'claude-flow') {
      steps.push(chalk.white('8. Run: npx claude-flow@alpha mcp start'));
    }

    steps.push(
      '',
      chalk.gray(`Project type: ${options.projectType}`),
      chalk.gray(
        `Memory architecture: ${options.memoryConfig?.architecture || 'basic'}`,
      ),
      chalk.gray(
        `Orchestration: ${options.orchestration?.framework || 'standalone'}`,
      ),
    );

    if (options.enableFleetArchitecture) {
      steps.push(
        chalk.gray(
          `Fleet architecture: enabled (${options.sessionManagerArchetype || 'engineering'} archetype)`,
        ),
      );
    }

    this.spinner.info(steps.join('\n'));
  }

  /**
   * Main initialization method - orchestrates entire setup
   */
  async initialize(options: ProjectInitOptions): Promise<void> {
    this.spinner.info(chalk.blue.bold('Wundr Project Initialization'));

    try {
      // Step 1: Validate and prepare project
      await this.validateProject(options);

      // Step 2: Create complete .claude directory structure
      if (options.includeClaudeSetup) {
        await this.createClaudeDirectory(options);
      }

      // Step 2.5: Setup deployment configuration if platforms detected
      await this.setupDeploymentConfig(options);

      // Step 3: Copy and customize templates
      if (options.includeTemplates) {
        await this.copyTemplates(options);
      }

      // Step 4: Setup git-worktree configuration
      if (options.includeGitWorktree) {
        await this.setupGitWorktree(options);
      }

      // Step 5: Initialize agent workflows
      if (options.includeAgents) {
        await this.initializeAgentWorkflows(options);
      }

      // Step 6: Setup hooks
      if (options.includeHooks) {
        await this.setupHooks(options);
      }

      // Step 6.5: Setup governance (IPRE) if enabled
      if (options.enableIPREGovernance || options.enableFleetArchitecture) {
        await this.setupGovernance(options);
      }

      // Step 6.6: Setup memory bank if fleet architecture enabled
      if (options.enableFleetArchitecture) {
        await this.setupMemoryBank(options);
      }

      // Step 7: Create project-specific documentation
      await this.createProjectDocumentation(options);

      // Step 8: Run validation checks
      await this.validateSetup(options);

      this.spinner.succeed(
        chalk.green.bold('Project initialization complete!'),
      );
      this.printNextSteps(options);
    } catch (error) {
      this.spinner.fail(chalk.red(`Initialization failed: ${error}`));
      throw error;
    }
  }

  /**
   * Validate project and prepare for initialization
   */
  private async validateProject(options: ProjectInitOptions): Promise<void> {
    this.spinner.start('Validating project setup...');

    // Check if project directory exists
    if (await fs.pathExists(options.projectPath)) {
      if (!options.force) {
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: `Project directory exists at ${options.projectPath}. Continue?`,
            default: false,
          },
        ]);

        if (!proceed) {
          throw new Error('Project initialization cancelled');
        }
      }
    } else {
      await fs.ensureDir(options.projectPath);
    }

    this.spinner.succeed('Project validated');
  }

  /**
   * Detect deployment platforms from config files and environment
   */
  private async detectDeploymentPlatform(
    projectPath: string,
  ): Promise<string[]> {
    const platforms: string[] = [];

    // Check for Railway
    if (await fs.pathExists(path.join(projectPath, 'railway.json'))) {
      platforms.push('railway');
    }
    if (process.env.RAILWAY_PROJECT_ID) {
      if (!platforms.includes('railway')) {
        platforms.push('railway');
      }
    }

    // Check for Netlify
    if (await fs.pathExists(path.join(projectPath, 'netlify.toml'))) {
      platforms.push('netlify');
    }
    if (process.env.NETLIFY_SITE_ID) {
      if (!platforms.includes('netlify')) {
        platforms.push('netlify');
      }
    }

    return platforms;
  }

  /**
   * Setup deployment platform configuration
   */
  private async setupDeploymentConfig(
    options: ProjectInitOptions,
  ): Promise<void> {
    const platforms = await this.detectDeploymentPlatform(options.projectPath);

    if (platforms.length === 0) {
      return; // No deployment platform detected
    }

    const claudeDir = path.join(options.projectPath, '.claude');
    const deploymentConfig: Record<string, unknown> = {
      version: '1.0.0',
      platforms: {},
      auto_monitor: true,
      auto_fix: {
        enabled: true,
        max_cycles: 5,
      },
    };

    if (platforms.includes('railway')) {
      (deploymentConfig.platforms as Record<string, unknown>).railway = {
        enabled: true,
        project_id: '${RAILWAY_PROJECT_ID}',
        poll_interval: 5000,
        timeout: 300000,
      };
    }

    if (platforms.includes('netlify')) {
      (deploymentConfig.platforms as Record<string, unknown>).netlify = {
        enabled: true,
        site_id: '${NETLIFY_SITE_ID}',
        poll_interval: 10000,
        timeout: 600000,
      };
    }

    await fs.writeJson(
      path.join(claudeDir, 'deployment.config.json'),
      deploymentConfig,
      { spaces: 2 },
    );

    this.spinner.info(
      chalk.green(`Deployment config created for: ${platforms.join(', ')}`),
    );
  }

  /**
   * Copy deployment agents to project
   */
  private async copyDeploymentAgents(claudeDir: string): Promise<void> {
    const devopsDir = path.join(claudeDir, 'agents', 'devops');
    await fs.ensureDir(devopsDir);

    const deploymentAgents = [
      'deployment-monitor.md',
      'log-analyzer.md',
      'debug-refactor.md',
    ];

    const sourceDir = path.join(this.resourcesDir, 'agents', 'devops');

    for (const agent of deploymentAgents) {
      const sourcePath = path.join(sourceDir, agent);
      const targetPath = path.join(devopsDir, agent);

      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, targetPath);
      }
    }
  }

  /**
   * Create complete .claude directory structure
   */
  private async createClaudeDirectory(
    options: ProjectInitOptions,
  ): Promise<void> {
    this.spinner.start('Creating .claude directory structure...');

    const claudeDir = path.join(options.projectPath, '.claude');

    // Define directory structure
    const structure = {
      agents: {
        core: ['coder', 'reviewer', 'tester', 'planner', 'researcher'],
        specialized: this.getSpecializedAgents(options.projectType),
        github: ['pr-manager', 'issue-tracker', 'release-manager'],
        testing: ['tdd-london-swarm', 'production-validator'],
        swarm: ['mesh-coordinator', 'hierarchical-coordinator'],
        consensus: ['byzantine-coordinator', 'raft-manager'],
        templates: ['sparc-coordinator', 'task-orchestrator'],
        devops: ['deployment-monitor', 'log-analyzer', 'debug-refactor'],
      },
      commands: [
        'coordination',
        'monitoring',
        'hooks',
        'memory',
        'github',
        'optimization',
      ],
      hooks: [
        'pre-task',
        'post-task',
        'pre-edit',
        'post-edit',
        'session-management',
      ],
      conventions: ['code-style', 'git-workflow', 'testing-standards'],
      templates: ['component', 'service', 'test', 'documentation'],
      workflows: ['sparc', 'tdd', 'review', 'deployment'],
    };

    // Create base directories
    await fs.ensureDir(path.join(claudeDir, 'agents'));
    await fs.ensureDir(path.join(claudeDir, 'commands'));
    await fs.ensureDir(path.join(claudeDir, 'hooks'));
    await fs.ensureDir(path.join(claudeDir, 'conventions'));
    await fs.ensureDir(path.join(claudeDir, 'templates'));
    await fs.ensureDir(path.join(claudeDir, 'workflows'));
    await fs.ensureDir(path.join(claudeDir, 'memory'));

    // Create agent subdirectories
    for (const [category, _agents] of Object.entries(structure.agents)) {
      const categoryDir = path.join(claudeDir, 'agents', category);
      await fs.ensureDir(categoryDir);
    }

    // Create command subdirectories
    for (const category of structure.commands) {
      await fs.ensureDir(path.join(claudeDir, 'commands', category));
    }

    this.spinner.succeed('Directory structure created');
  }

  /**
   * Copy all template files to project
   */
  private async copyTemplates(options: ProjectInitOptions): Promise<void> {
    this.spinner.start('Copying and customizing templates...');

    const context = this.createTemplateContext(options);
    const claudeDir = path.join(options.projectPath, '.claude');

    // Copy CLAUDE.md template
    await this.copyClaudeMarkdown(options, context);

    // Copy agent templates
    await this.copyAgentTemplates(claudeDir, options, context);

    // Copy command templates
    await this.copyCommandTemplates(claudeDir, context);

    // Copy hook templates
    await this.copyHookTemplates(claudeDir, context);

    // Copy convention templates
    await this.copyConventionTemplates(claudeDir, options, context);

    // Copy workflow templates
    await this.copyWorkflowTemplates(claudeDir, options, context);

    this.spinner.succeed('Templates copied and customized');
  }

  /**
   * Copy CLAUDE.md with project-specific customization
   */
  private async copyClaudeMarkdown(
    options: ProjectInitOptions,
    context: TemplateContext,
  ): Promise<void> {
    const templatePath = path.join(
      this.resourcesDir,
      'templates',
      'CLAUDE.md.template',
    );
    const outputPath = path.join(options.projectPath, 'CLAUDE.md');

    if (await fs.pathExists(templatePath)) {
      const content = await fs.readFile(templatePath, 'utf-8');
      const customized = this.customizeClaudeMarkdown(
        content,
        options,
        context,
      );
      await fs.writeFile(outputPath, customized);
    } else {
      // Generate default CLAUDE.md
      const defaultContent = this.generateDefaultClaudeMarkdown(
        options,
        context,
      );
      await fs.writeFile(outputPath, defaultContent);
    }
  }

  /**
   * Copy agent template files
   */
  private async copyAgentTemplates(
    claudeDir: string,
    options: ProjectInitOptions,
    context: TemplateContext,
  ): Promise<void> {
    const agentsSourceDir = path.join(this.resourcesDir, 'agents');
    const agentsTargetDir = path.join(claudeDir, 'agents');

    // Determine which agents to copy
    const agentsToCopy = this.selectAgentsToCopy(options);

    for (const agentCategory of Object.keys(agentsToCopy)) {
      const categorySourceDir = path.join(agentsSourceDir, agentCategory);
      const categoryTargetDir = path.join(agentsTargetDir, agentCategory);

      if (await fs.pathExists(categorySourceDir)) {
        await fs.ensureDir(categoryTargetDir);

        // Copy agent files
        const agents = agentsToCopy[agentCategory];
        for (const agent of agents) {
          const agentFiles = await this.findAgentFiles(
            categorySourceDir,
            agent,
          );

          for (const file of agentFiles) {
            const relativePath = path.relative(categorySourceDir, file);
            const targetPath = path.join(categoryTargetDir, relativePath);

            await fs.ensureDir(path.dirname(targetPath));
            const content = await fs.readFile(file, 'utf-8');
            const customized = this.customizeAgentTemplate(
              content,
              options,
              context,
            );
            await fs.writeFile(targetPath, customized);
          }
        }
      }
    }

    // Create agent index/README
    await this.createAgentIndex(agentsTargetDir, agentsToCopy);
  }

  /**
   * Copy command templates
   */
  private async copyCommandTemplates(
    claudeDir: string,
    context: TemplateContext,
  ): Promise<void> {
    const commandsSourceDir = path.join(this.resourcesDir, 'commands');
    const commandsTargetDir = path.join(claudeDir, 'commands');

    if (await fs.pathExists(commandsSourceDir)) {
      // Copy all command categories
      const categories = await fs.readdir(commandsSourceDir, {
        withFileTypes: true,
      });

      for (const category of categories) {
        if (category.isDirectory()) {
          const sourcePath = path.join(commandsSourceDir, category.name);
          const targetPath = path.join(commandsTargetDir, category.name);

          await fs.copy(sourcePath, targetPath);

          // Customize copied command files with context
          const files = await fs.readdir(targetPath);
          for (const file of files) {
            if (file.endsWith('.md') || file.endsWith('.yaml')) {
              const filePath = path.join(targetPath, file);
              let content = await fs.readFile(filePath, 'utf-8');
              content = content
                .replace(/\{\{PROJECT_NAME\}\}/g, context.project.name)
                .replace(
                  /\{\{PACKAGE_MANAGER\}\}/g,
                  context.project.packageManager,
                );
              await fs.writeFile(filePath, content);
            }
          }
        }
      }
    }
  }

  /**
   * Copy hook templates
   */
  private async copyHookTemplates(
    claudeDir: string,
    context: TemplateContext,
  ): Promise<void> {
    const hooksDir = path.join(claudeDir, 'hooks');

    const hooks = [
      {
        name: 'pre-task.sh',
        content: this.generatePreTaskHook(context),
      },
      {
        name: 'post-task.sh',
        content: this.generatePostTaskHook(context),
      },
      {
        name: 'pre-edit.sh',
        content: this.generatePreEditHook(context),
      },
      {
        name: 'post-edit.sh',
        content: this.generatePostEditHook(context),
      },
      {
        name: 'session-start.sh',
        content: this.generateSessionStartHook(context),
      },
      {
        name: 'session-end.sh',
        content: this.generateSessionEndHook(context),
      },
    ];

    for (const hook of hooks) {
      const hookPath = path.join(hooksDir, hook.name);
      await fs.writeFile(hookPath, hook.content);
      await fs.chmod(hookPath, '755');
    }

    // Create hooks configuration
    const hooksConfig = {
      version: '1.0.0',
      enabled: true,
      hooks: {
        'pre-task': { enabled: true, required: false },
        'post-task': { enabled: true, required: true },
        'pre-edit': { enabled: true, required: false },
        'post-edit': { enabled: true, required: true },
        'session-start': { enabled: true, required: false },
        'session-end': { enabled: true, required: false },
      },
    };

    await fs.writeJson(path.join(hooksDir, 'hooks.config.json'), hooksConfig, {
      spaces: 2,
    });
  }

  /**
   * Copy convention templates
   */
  private async copyConventionTemplates(
    claudeDir: string,
    options: ProjectInitOptions,
    context: TemplateContext,
  ): Promise<void> {
    const conventionsDir = path.join(claudeDir, 'conventions');

    const conventions = [
      {
        name: 'code-style.md',
        content: this.generateCodeStyleConvention(options, context),
      },
      {
        name: 'git-workflow.md',
        content: this.generateGitWorkflowConvention(options, context),
      },
      {
        name: 'testing-standards.md',
        content: this.generateTestingStandardsConvention(options, context),
      },
      {
        name: 'documentation.md',
        content: this.generateDocumentationConvention(options, context),
      },
    ];

    for (const convention of conventions) {
      await fs.writeFile(
        path.join(conventionsDir, convention.name),
        convention.content,
      );
    }
  }

  /**
   * Copy workflow templates
   */
  private async copyWorkflowTemplates(
    claudeDir: string,
    options: ProjectInitOptions,
    context: TemplateContext,
  ): Promise<void> {
    const workflowsDir = path.join(claudeDir, 'workflows');

    const workflows = [
      {
        name: 'sparc-workflow.md',
        content: this.generateSparcWorkflow(options, context),
      },
      {
        name: 'tdd-workflow.md',
        content: this.generateTddWorkflow(options, context),
      },
      {
        name: 'review-workflow.md',
        content: this.generateReviewWorkflow(options, context),
      },
    ];

    for (const workflow of workflows) {
      await fs.writeFile(
        path.join(workflowsDir, workflow.name),
        workflow.content,
      );
    }
  }

  /**
   * Setup git-worktree configuration
   * Enhanced with hierarchical worktree strategy for three-tier architecture
   */
  private async setupGitWorktree(options: ProjectInitOptions): Promise<void> {
    this.spinner.start('Setting up git-worktree configuration...');

    const worktreeDir = path.join(options.projectPath, '.git-worktrees');
    await fs.ensureDir(worktreeDir);

    // Determine workforce size for sub-agent worktrees
    const maxSubAgentsPerSession = options.subAgentWorkforceSize
      ? WORKFORCE_SIZE_MAP[options.subAgentWorkforceSize]
      : 10;

    // Create worktree configuration - enhanced for fleet architecture
    const worktreeConfig: Record<string, unknown> = {
      version: options.enableFleetArchitecture ? '2.0.0' : '1.0.0',
      worktrees: {
        development: {
          branch: 'develop',
          path: path.join(worktreeDir, 'develop'),
          autoSync: true,
        },
        staging: {
          branch: 'staging',
          path: path.join(worktreeDir, 'staging'),
          autoSync: true,
        },
        production: {
          branch: 'main',
          path: path.join(worktreeDir, 'main'),
          autoSync: false,
        },
      },
      hooks: {
        'post-checkout': true,
        'post-merge': true,
      },
    };

    // Add hierarchical strategy for fleet architecture
    if (options.enableFleetArchitecture) {
      worktreeConfig.hierarchicalStrategy = {
        sessionWorktrees: {
          path: path.join(worktreeDir, 'sessions'),
          pattern: 'session-{SESSION_ID}',
          maxPerMachine: 10,
        },
        subAgentWorktrees: {
          path: path.join(worktreeDir, 'agents'),
          pattern: 'session-{SESSION_ID}-sub-{AGENT_ID}',
          maxPerSession: maxSubAgentsPerSession,
          writeAccessOnly: true,
        },
      };
      worktreeConfig.fractionalWorktreePattern = {
        enabled: true,
        readOnlyAgents: [
          'researcher',
          'analyst',
          'reviewer',
          'log-analyzer',
          'trend-analyst',
        ],
        writeAccessAgents: [
          'coder',
          'code-surgeon',
          'refactorer',
          'test-fixer',
          'dependency-updater',
        ],
      };
      worktreeConfig.resourceLimits = {
        fileDescriptors: 65000,
        diskSpaceBuffer: '10GB',
        maxWorktreesPerMachine: 200,
      };

      // Create session and agent worktree directories
      await fs.ensureDir(path.join(worktreeDir, 'sessions'));
      await fs.ensureDir(path.join(worktreeDir, 'agents'));
    }

    await fs.writeJson(
      path.join(options.projectPath, '.claude', 'worktree.config.json'),
      worktreeConfig,
      { spaces: 2 },
    );

    // Create scripts directory if needed
    await fs.ensureDir(path.join(options.projectPath, 'scripts'));

    // Create worktree management script
    const worktreeScript = options.enableFleetArchitecture
      ? this.generateEnhancedWorktreeScript(maxSubAgentsPerSession)
      : this.generateWorktreeScript();
    await fs.writeFile(
      path.join(options.projectPath, 'scripts', 'manage-worktrees.sh'),
      worktreeScript,
    );
    await fs.chmod(
      path.join(options.projectPath, 'scripts', 'manage-worktrees.sh'),
      '755',
    );

    this.spinner.succeed('Git-worktree configuration complete');
  }

  /**
   * Initialize agent workflows
   */
  private async initializeAgentWorkflows(
    options: ProjectInitOptions,
  ): Promise<void> {
    this.spinner.start('Initializing agent workflows...');

    const workflowsDir = path.join(options.projectPath, '.claude', 'workflows');

    // Create workflow configurations
    const workflows = this.getProjectWorkflows(options);

    for (const [name, config] of Object.entries(workflows)) {
      await fs.writeJson(
        path.join(workflowsDir, `${name}.config.json`),
        config,
        { spaces: 2 },
      );
    }

    // Create workflow runner script
    const runnerScript = this.generateWorkflowRunnerScript();
    await fs.writeFile(
      path.join(options.projectPath, 'scripts', 'run-workflow.sh'),
      runnerScript,
    );
    await fs.chmod(
      path.join(options.projectPath, 'scripts', 'run-workflow.sh'),
      '755',
    );

    this.spinner.succeed('Agent workflows initialized');
  }

  /**
   * Setup hooks for automation
   */
  private async setupHooks(options: ProjectInitOptions): Promise<void> {
    this.spinner.start('Setting up automation hooks...');

    // Setup git hooks
    await this.setupGitHooks(options);

    // Setup Claude Flow hooks
    await this.setupClaudeFlowHooks(options);

    // Setup verification hooks
    await this.setupVerificationHooks(options);

    this.spinner.succeed('Hooks configured');
  }

  /**
   * Create project-specific documentation
   */
  private async createProjectDocumentation(
    options: ProjectInitOptions,
  ): Promise<void> {
    this.spinner.start('Creating project documentation...');

    const docsDir = path.join(options.projectPath, 'docs');
    await fs.ensureDir(docsDir);

    const docs = [
      {
        name: 'PROJECT_SETUP.md',
        content: this.generateProjectSetupDoc(options),
      },
      {
        name: 'AGENT_GUIDE.md',
        content: this.generateAgentGuideDoc(options),
      },
      {
        name: 'WORKFLOW_GUIDE.md',
        content: this.generateWorkflowGuideDoc(options),
      },
      {
        name: 'DEVELOPMENT.md',
        content: this.generateDevelopmentDoc(options),
      },
    ];

    for (const doc of docs) {
      await fs.writeFile(path.join(docsDir, doc.name), doc.content);
    }

    this.spinner.succeed('Documentation created');
  }

  /**
   * Validate the setup
   */
  private async validateSetup(options: ProjectInitOptions): Promise<void> {
    this.spinner.start('Validating setup...');

    const validations = [];

    // Check .claude directory
    validations.push({
      name: '.claude directory',
      check: await fs.pathExists(path.join(options.projectPath, '.claude')),
    });

    // Check CLAUDE.md
    validations.push({
      name: 'CLAUDE.md file',
      check: await fs.pathExists(path.join(options.projectPath, 'CLAUDE.md')),
    });

    // Check agents
    validations.push({
      name: 'Agent templates',
      check: await fs.pathExists(
        path.join(options.projectPath, '.claude', 'agents'),
      ),
    });

    // Check hooks
    validations.push({
      name: 'Hooks directory',
      check: await fs.pathExists(
        path.join(options.projectPath, '.claude', 'hooks'),
      ),
    });

    // Display validation results
    const failures = validations.filter(v => !v.check);

    if (failures.length > 0) {
      const failureList = failures.map(f => `  - ${f.name}`).join('\n');
      this.spinner.fail(
        `Validation failed - Missing components:\n${chalk.yellow(failureList)}`,
      );
      throw new Error('Setup validation failed');
    }

    this.spinner.succeed('Setup validated successfully');
  }

  /**
   * Helper method to create template context
   */
  private createTemplateContext(options: ProjectInitOptions): TemplateContext {
    return {
      profile: options.profile || this.getDefaultProfile(),
      project: {
        name: options.projectName,
        description: `${options.projectType} project`,
        version: '1.0.0',
        type: options.projectType === 'monorepo' ? 'node' : options.projectType,
        packageManager: 'pnpm',
        license: 'MIT',
        author: options.profile?.name || 'Developer',
        organization: options.profile?.team,
      },
      platform: {
        os: process.platform as 'darwin' | 'linux' | 'win32',
        arch: process.arch as 'x64' | 'arm64',
        nodeVersion: process.version.replace('v', ''),
        shell: 'zsh',
      },
      customVariables: {
        PROJECT_TYPE: options.projectType,
        INCLUDE_AGENTS: options.includeAgents,
        INCLUDE_HOOKS: options.includeHooks,
        INCLUDE_GIT_WORKTREE: options.includeGitWorktree,
      },
    };
  }

  /**
   * Get specialized agents based on project type
   */
  private getSpecializedAgents(projectType: string): string[] {
    const agentMap: Record<string, string[]> = {
      react: ['mobile-dev', 'frontend-architect'],
      vue: ['frontend-architect'],
      node: ['backend-dev', 'api-architect'],
      python: ['ml-developer', 'data-engineer'],
      go: ['backend-dev', 'microservices-architect'],
      rust: ['systems-architect', 'performance-engineer'],
      java: ['enterprise-architect', 'backend-dev'],
      monorepo: ['repo-architect', 'sync-coordinator', 'multi-repo-swarm'],
    };

    return agentMap[projectType] || ['system-architect'];
  }

  /**
   * Continue with more helper methods...
   */
  private customizeClaudeMarkdown(
    content: string,
    options: ProjectInitOptions,
    context: TemplateContext,
  ): string {
    // Replace placeholders with project-specific values
    return content
      .replace(/\{\{PROJECT_NAME\}\}/g, options.projectName)
      .replace(/\{\{PROJECT_TYPE\}\}/g, options.projectType)
      .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, context.project.description);
  }

  private generateDefaultClaudeMarkdown(
    options: ProjectInitOptions,
    context: TemplateContext,
  ): string {
    const packageManager = context.project.packageManager;
    const author = context.project.author;
    const organization = context.project.organization || 'Development Team';

    return `# Claude Code Configuration - ${options.projectName}

## Project Type: ${options.projectType}
## Author: ${author}
## Organization: ${organization}

## Quick Commands

\`\`\`bash
# Install dependencies
${packageManager} install

# Run development server
${packageManager} run dev

# Run tests
${packageManager} run test

# Build for production
${packageManager} run build
\`\`\`

See .claude/README.md for complete agent and workflow documentation.
`;
  }

  private customizeAgentTemplate(
    content: string,
    options: ProjectInitOptions,
    context: TemplateContext,
  ): string {
    return content
      .replace(/\{\{PROJECT_NAME\}\}/g, options.projectName)
      .replace(/\{\{PROJECT_TYPE\}\}/g, options.projectType)
      .replace(/\{\{AUTHOR\}\}/g, context.project.author)
      .replace(/\{\{ORGANIZATION\}\}/g, context.project.organization || '')
      .replace(/\{\{PACKAGE_MANAGER\}\}/g, context.project.packageManager)
      .replace(/\{\{NODE_VERSION\}\}/g, context.platform.nodeVersion)
      .replace(/\{\{PLATFORM\}\}/g, context.platform.os);
  }

  private selectAgentsToCopy(
    options: ProjectInitOptions,
  ): Record<string, string[]> {
    const agents: Record<string, string[]> = {
      core: ['coder', 'reviewer', 'tester', 'planner', 'researcher'],
    };

    if (options.customAgents && options.customAgents.length > 0) {
      agents.custom = options.customAgents;
    }

    agents.specialized = this.getSpecializedAgents(options.projectType);

    return agents;
  }

  private async findAgentFiles(
    dir: string,
    agentName: string,
  ): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.findAgentFiles(fullPath, agentName)));
      } else if (entry.name.includes(agentName)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private async createAgentIndex(
    agentsDir: string,
    agents: Record<string, string[]>,
  ): Promise<void> {
    const readme = `# Available Agents

## Agent Categories

${Object.entries(agents)
  .map(
    ([category, agentList]) => `
### ${category.charAt(0).toUpperCase() + category.slice(1)}
${agentList.map(a => `- ${a}`).join('\n')}
`,
  )
  .join('\n')}

## Usage

See individual agent files for specific capabilities and usage instructions.
`;

    await fs.writeFile(path.join(agentsDir, 'README.md'), readme);
  }

  // Additional generator methods would continue here...
  // (Due to length constraints, showing structure)

  private generatePreTaskHook(context: TemplateContext): string {
    return `#!/bin/bash
# Pre-task hook for ${context.project.name}
echo "Starting task..."
`;
  }

  private generatePostTaskHook(context: TemplateContext): string {
    return `#!/bin/bash
# Post-task hook for ${context.project.name}
echo "Task completed"
`;
  }

  private generatePreEditHook(context: TemplateContext): string {
    const projectName = context.project.name;
    const nodeVersion = context.platform.nodeVersion;
    return `#!/bin/bash
# Pre-edit hook for ${projectName}
# Generated for Node ${nodeVersion}

echo "Preparing to edit files..."

# Verify project state before editing
if [ -f "package.json" ]; then
  echo "Checking package.json integrity..."
fi

# Optional: Create backup of files being edited
# cp "$1" "$1.bak" 2>/dev/null || true
`;
  }

  private generatePostEditHook(context: TemplateContext): string {
    const projectName = context.project.name;
    const packageManager = context.project.packageManager;
    return `#!/bin/bash
# Post-edit hook for ${projectName}
# Uses ${packageManager} for package management

echo "Files edited, running checks..."

# Run linting if configured
if [ -f "package.json" ] && grep -q '"lint"' package.json; then
  echo "Running lint checks..."
  ${packageManager} run lint --fix 2>/dev/null || true
fi

# Notify claude-flow of changes
if command -v npx &> /dev/null; then
  npx claude-flow@alpha hooks notify --message "Files edited in ${projectName}" 2>/dev/null || true
fi
`;
  }

  private generateSessionStartHook(context: TemplateContext): string {
    return `#!/bin/bash
# Session start hook
echo "Session started for ${context.project.name}"
`;
  }

  private generateSessionEndHook(context: TemplateContext): string {
    const projectName = context.project.name;
    const author = context.project.author;
    return `#!/bin/bash
# Session end hook for ${projectName}
# Author: ${author}

echo "Session ending, cleaning up..."

# Export session metrics
if command -v npx &> /dev/null; then
  npx claude-flow@alpha hooks session-end --export-metrics true 2>/dev/null || true
fi

# Cleanup temporary files
find . -name "*.tmp" -type f -delete 2>/dev/null || true
find . -name ".DS_Store" -type f -delete 2>/dev/null || true

echo "Session cleanup complete for ${projectName}"
`;
  }

  private generateCodeStyleConvention(
    options: ProjectInitOptions,
    context: TemplateContext,
  ): string {
    const packageManager = context.project.packageManager;
    return `# Code Style Convention

Project: ${options.projectName}
Type: ${options.projectType}
Package Manager: ${packageManager}

## Standards
- Use consistent formatting
- Follow language-specific best practices
- Keep functions small and focused
- Maximum file length: 500 lines
- Maximum function length: 50 lines

## Formatting Commands
\`\`\`bash
# Format code
${packageManager} run format

# Check formatting
${packageManager} run format:check

# Lint code
${packageManager} run lint
\`\`\`

## TypeScript Guidelines
- Prefer \`interface\` over \`type\` for object shapes
- Use strict mode
- Avoid \`any\` type - use \`unknown\` with type guards
`;
  }

  private generateGitWorkflowConvention(
    options: ProjectInitOptions,
    context: TemplateContext,
  ): string {
    const defaultBranch =
      context.profile?.preferences?.gitConfig?.defaultBranch || 'main';
    return `# Git Workflow Convention

Project: ${options.projectName}
Default Branch: ${defaultBranch}

## Branch Strategy
- ${defaultBranch}: Production-ready code
- develop: Integration branch for features
- feature/*: New features (e.g., feature/add-authentication)
- bugfix/*: Bug fixes (e.g., bugfix/fix-login-error)
- hotfix/*: Urgent production fixes
- release/*: Release preparation

## Commit Message Format
\`\`\`
<type>(<scope>): <subject>

<body>

<footer>
\`\`\`

### Types
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructuring
- test: Adding tests
- chore: Maintenance

## Pull Request Guidelines
1. Create feature branch from develop
2. Make changes with atomic commits
3. Push and create PR
4. Request review
5. Merge after approval
`;
  }

  private generateTestingStandardsConvention(
    options: ProjectInitOptions,
    context: TemplateContext,
  ): string {
    const packageManager = context.project.packageManager;
    return `# Testing Standards

Project: ${options.projectName}
Type: ${options.projectType}

## Coverage Requirements
- Minimum 80% overall coverage
- 100% coverage for critical paths
- Test all public APIs
- Test error handling paths

## Test Commands
\`\`\`bash
# Run all tests
${packageManager} run test

# Run with coverage
${packageManager} run test:coverage

# Run in watch mode
${packageManager} run test:watch

# Run specific test file
${packageManager} run test -- path/to/test.spec.ts
\`\`\`

## Test Structure
\`\`\`
tests/
  unit/           # Unit tests
  integration/    # Integration tests
  e2e/           # End-to-end tests
  fixtures/      # Test data
  mocks/         # Mock implementations
\`\`\`

## TDD Workflow
1. Write failing test (Red)
2. Write minimal implementation (Green)
3. Refactor with confidence (Refactor)
`;
  }

  private generateDocumentationConvention(
    options: ProjectInitOptions,
    context: TemplateContext,
  ): string {
    const author = context.project.author;
    const organization = context.project.organization || 'Development Team';
    return `# Documentation Convention

Project: ${options.projectName}
Author: ${author}
Organization: ${organization}

## Requirements
- All public APIs documented with JSDoc/TSDoc
- README maintained and up-to-date
- CHANGELOG updated for each release
- Architecture decisions documented (ADRs)

## Documentation Structure
\`\`\`
docs/
  api/           # API documentation
  guides/        # User guides
  architecture/  # Architecture decisions
  contributing/  # Contribution guidelines
\`\`\`

## JSDoc Template
\`\`\`typescript
/**
 * Brief description of function
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws {ErrorType} When error condition occurs
 * @example
 * const result = functionName(param);
 */
\`\`\`

## README Sections
1. Project Overview
2. Installation
3. Quick Start
4. Configuration
5. API Reference
6. Contributing
7. License
`;
  }

  private generateSparcWorkflow(
    options: ProjectInitOptions,
    context: TemplateContext,
  ): string {
    const packageManager = context.project.packageManager;
    return `# SPARC Workflow

Project: ${options.projectName}
Type: ${options.projectType}

Systematic development using Specification, Pseudocode, Architecture, Refinement, Completion.

## Phases

### 1. Specification
- Define requirements clearly
- Identify constraints and edge cases
- Document acceptance criteria

### 2. Pseudocode
- Design algorithm in plain language
- Identify data structures needed
- Plan error handling strategy

### 3. Architecture
- Design component structure
- Define interfaces and contracts
- Plan integration points

### 4. Refinement (TDD)
- Write failing tests first
- Implement minimal code to pass
- Refactor for quality

### 5. Completion
- Integration testing
- Documentation updates
- Performance optimization

## Commands
\`\`\`bash
# Run SPARC workflow
npx claude-flow sparc tdd "<feature>"

# Run specific phase
npx claude-flow sparc run spec-pseudocode "<task>"
npx claude-flow sparc run architect "<task>"

# Check workflow status
${packageManager} run workflow:status
\`\`\`
`;
  }

  private generateTddWorkflow(
    options: ProjectInitOptions,
    context: TemplateContext,
  ): string {
    const packageManager = context.project.packageManager;
    return `# TDD Workflow

Project: ${options.projectName}
Type: ${options.projectType}

Test-Driven Development workflow following the Red-Green-Refactor cycle.

## The TDD Cycle

### 1. Red - Write a Failing Test
- Write a test that describes expected behavior
- Run the test - it should fail
- Verify test failure message is meaningful

### 2. Green - Make it Pass
- Write the simplest code to pass the test
- Don't over-engineer the solution
- Focus on making the test pass

### 3. Refactor - Improve the Code
- Clean up the implementation
- Remove duplication
- Improve naming and structure
- All tests should still pass

## Commands
\`\`\`bash
# Run tests in watch mode
${packageManager} run test:watch

# Run tests with coverage
${packageManager} run test:coverage

# Run TDD workflow with claude-flow
npx claude-flow sparc tdd "<feature>"
\`\`\`

## Best Practices
- One assertion per test when possible
- Use descriptive test names
- Test behavior, not implementation
- Keep tests fast and isolated
`;
  }

  private generateReviewWorkflow(
    options: ProjectInitOptions,
    context: TemplateContext,
  ): string {
    const organization = context.project.organization || 'the team';
    return `# Review Workflow

Project: ${options.projectName}
Type: ${options.projectType}
Organization: ${organization}

Code review process and checklist for ${organization}.

## Review Checklist

### Code Quality
- [ ] Code follows project style guidelines
- [ ] No unnecessary complexity
- [ ] Functions are small and focused
- [ ] Naming is clear and descriptive

### Testing
- [ ] All tests pass
- [ ] New code has adequate test coverage
- [ ] Edge cases are tested

### Security
- [ ] No hardcoded secrets or credentials
- [ ] Input validation in place
- [ ] No SQL injection vulnerabilities

### Documentation
- [ ] Public APIs are documented
- [ ] Complex logic has comments
- [ ] README updated if needed

## Review Process
1. Author creates PR with description
2. Automated checks run (lint, tests, build)
3. Reviewer examines code changes
4. Feedback provided via inline comments
5. Author addresses feedback
6. Approval and merge

## Response Times
- Initial review: Within 24 hours
- Follow-up review: Within 4 hours
`;
  }

  private generateWorktreeScript(): string {
    return `#!/bin/bash
# Git worktree management script
echo "Managing worktrees..."
`;
  }

  private generateEnhancedWorktreeScript(maxSubAgents: number): string {
    return `#!/bin/bash
# Enhanced Git worktree management script for three-tier architecture
# Supports session and sub-agent worktree lifecycle management

set -e

WORKTREE_ROOT=".git-worktrees"
SESSIONS_DIR="\${WORKTREE_ROOT}/sessions"
AGENTS_DIR="\${WORKTREE_ROOT}/agents"
MAX_SUB_AGENTS=${maxSubAgents}

# Create worktree for new session
create_session() {
  local session_id=$1
  local base_branch=\${2:-main}
  local worktree_path="\${SESSIONS_DIR}/session-\${session_id}"

  echo "Creating session worktree: \${session_id}"
  git worktree add -b "session/\${session_id}" "\${worktree_path}" "\${base_branch}"
  echo "Session worktree created at: \${worktree_path}"
}

# Create worktree for sub-agent (write-access agents only)
create_sub_agent() {
  local session_id=$1
  local agent_id=$2
  local session_branch="session/\${session_id}"
  local worktree_path="\${AGENTS_DIR}/session-\${session_id}-sub-\${agent_id}"

  # Check sub-agent limit
  local agent_count=$(ls -d "\${AGENTS_DIR}/session-\${session_id}-sub-"* 2>/dev/null | wc -l)
  if [ "\${agent_count}" -ge "\${MAX_SUB_AGENTS}" ]; then
    echo "Error: Maximum sub-agents (\${MAX_SUB_AGENTS}) reached for session \${session_id}"
    exit 1
  fi

  echo "Creating sub-agent worktree: \${agent_id}"
  git worktree add -b "agent/\${session_id}/\${agent_id}" "\${worktree_path}" "\${session_branch}"
  echo "Sub-agent worktree created at: \${worktree_path}"
}

# Cleanup worktree after merge
cleanup_worktree() {
  local worktree_path=$1
  local branch_name=$2

  echo "Cleaning up worktree: \${worktree_path}"
  git worktree remove "\${worktree_path}" --force 2>/dev/null || true
  git branch -d "\${branch_name}" 2>/dev/null || true
  echo "Worktree cleaned up"
}

# List all active worktrees
list_worktrees() {
  echo "=== Session Worktrees ==="
  ls -la "\${SESSIONS_DIR}" 2>/dev/null || echo "No session worktrees"
  echo ""
  echo "=== Sub-Agent Worktrees ==="
  ls -la "\${AGENTS_DIR}" 2>/dev/null || echo "No sub-agent worktrees"
}

# Check resource limits
check_resources() {
  local fd_limit=$(ulimit -n)
  local worktree_count=$(git worktree list | wc -l)

  echo "File descriptor limit: \${fd_limit}"
  echo "Active worktrees: \${worktree_count}"

  if [ "\${fd_limit}" -lt 65000 ]; then
    echo "Warning: File descriptor limit below recommended 65000"
  fi
}

# Main command dispatcher
case "$1" in
  create-session)
    create_session "$2" "$3"
    ;;
  create-agent)
    create_sub_agent "$2" "$3"
    ;;
  cleanup)
    cleanup_worktree "$2" "$3"
    ;;
  list)
    list_worktrees
    ;;
  check)
    check_resources
    ;;
  *)
    echo "Usage: $0 {create-session|create-agent|cleanup|list|check} [args]"
    echo ""
    echo "Commands:"
    echo "  create-session <session_id> [base_branch]  Create session worktree"
    echo "  create-agent <session_id> <agent_id>       Create sub-agent worktree"
    echo "  cleanup <worktree_path> <branch_name>      Clean up worktree"
    echo "  list                                       List all worktrees"
    echo "  check                                      Check resource limits"
    exit 1
    ;;
esac
`;
  }

  /**
   * Setup IPRE governance layer
   * Creates governance directory structure, copies IPRE templates,
   * sets up policy enforcement hooks, and initializes evaluator agents
   */
  async setupGovernance(options: ProjectInitOptions): Promise<void> {
    this.spinner.start('Setting up IPRE governance layer...');

    const governanceDir = path.join(
      options.projectPath,
      '.claude',
      'governance',
    );
    await fs.ensureDir(governanceDir);

    // Create governance subdirectories
    await fs.ensureDir(path.join(governanceDir, 'policies'));
    await fs.ensureDir(path.join(governanceDir, 'evaluators'));

    // Create Human Cortex structure if fleet architecture enabled
    if (options.enableFleetArchitecture) {
      await fs.ensureDir(path.join(governanceDir, 'human-cortex', 'roles'));
      await fs.ensureDir(
        path.join(governanceDir, 'human-cortex', 'dashboards'),
      );
      await fs.ensureDir(path.join(governanceDir, 'human-cortex', 'playbooks'));

      // Copy Human Cortex role definitions
      await this.copyHumanCortexRoles(governanceDir);
    }

    // Copy IPRE configuration template
    const ipreConfig = this.generateIPREConfig(options);
    await fs.writeFile(
      path.join(governanceDir, 'ipre.config.yaml'),
      ipreConfig,
    );

    // Copy policy templates based on project type
    await this.copyPolicyTemplates(governanceDir, options);

    // Setup policy enforcement hooks
    await this.setupPolicyHooks(options, governanceDir);

    // Initialize evaluator agents
    await this.initializeEvaluatorAgents(governanceDir, options);

    this.spinner.succeed('IPRE governance layer configured');
  }

  /**
   * Copy Human Cortex role definitions for Tier 0
   */
  private async copyHumanCortexRoles(governanceDir: string): Promise<void> {
    const rolesDir = path.join(governanceDir, 'human-cortex', 'roles');

    const architectRole = `---
role: architect
tier: 0
count: '3-5 per organization'

responsibilities:
  - Design VP-Session-SubAgent hierarchy
  - Define coordination protocols
  - Implement Memory Bank structures
  - Establish isolation architectures (Git Worktrees, permissions)
  - Configure Risk Twin validation environments

outputs:
  - Agent charters
  - Coordination patterns
  - Escalation logic
  - System architecture documentation

concentration_risk: >
  Loss of key Architects jeopardizes system understanding. Mitigate via Memory Bank continuity and documentation.
---
`;

    const intentSetterRole = `---
role: intent-setter
tier: 0
count: '4-6 per organization'

responsibilities:
  - Articulate strategic intent in natural language
  - Define hard constraints (policies)
  - Specify reward function weights
  - Deploy evaluator agents for alignment monitoring

outputs:
  - IPRE Pipeline configurations
  - Policy specifications
  - Reward function designs
  - Evaluator agent configurations

concentration_risk: >
  Intent-Setter departure creates strategic drift. Mitigate via documented intent and reward rationale.
---
`;

    const guardianRole = `---
role: guardian
tier: 0
count: '6-12 per organization'

responsibilities:
  - Review flagged escalations
  - Adjudicate taste in edge cases
  - Train evaluator agents
  - Audit agent outputs
  - Maintain stakeholder trust

outputs:
  - Escalation decisions
  - Quality assessments
  - Evaluator training data
  - Audit reports

concentration_risk: >
  Guardian burnout degrades quality oversight. Mitigate via rotation, workload limits, and psychological sustainability.
---
`;

    await fs.writeFile(path.join(rolesDir, 'architect.md'), architectRole);
    await fs.writeFile(
      path.join(rolesDir, 'intent-setter.md'),
      intentSetterRole,
    );
    await fs.writeFile(path.join(rolesDir, 'guardian.md'), guardianRole);

    // Create README for Human Cortex
    const readmeContent = `# Human Cortex - Tier 0

The Human Cortex doesn't _manage_ the digital workforce—it _architects_ the conditions for autonomous operation.

## Roles

### Architect (3-5 per organization)
System design, protocols, learning architecture. See \`roles/architect.md\`.

### Intent-Setter (4-6 per organization)
Strategic purpose, values encoding, IPRE configuration. See \`roles/intent-setter.md\`.

### Guardian (6-12 per organization)
Judgment, escalation review, quality oversight. See \`roles/guardian.md\`.

## Leverage Ratio
With proper configuration: **281:1** (3,376 autonomous agents directed by 12-person human cortex)
`;
    await fs.writeFile(
      path.join(governanceDir, 'human-cortex', 'README.md'),
      readmeContent,
    );
  }

  /**
   * Generate IPRE configuration based on project options
   */
  private generateIPREConfig(options: ProjectInitOptions): string {
    const archetype = options.sessionManagerArchetype || 'engineering';

    const baseConfig = `# IPRE Configuration - Intent, Policy, Reward, Evaluator
version: '1.0.0'
archetype: ${archetype}

intent:
  mission: 'Deliver high-quality ${archetype} outcomes that solve real problems'
  values:
    - quality_first
    - technical_excellence
    - sustainable_velocity

policies:
  # Hard constraints - never violate
  security:
    - 'No secrets in code'
    - 'No SQL injection vulnerabilities'
    - 'No XSS attack vectors'
    - 'Validate all inputs'

  compliance:
    - 'All changes require PR review'
    - 'No force pushes to main/master'
    - 'Test coverage minimum 80%'

  operational:
    - 'No deployments on Fridays after 2pm'
    - 'Rollback plan required for production changes'

rewards:
  # Weighted objectives (must sum to 1.0)
  customer_value: 0.35
  code_quality: 0.25
  delivery_speed: 0.20
  technical_debt_reduction: 0.15
  documentation: 0.05

evaluators:
  - type: policy_compliance
    frequency: per_commit
    action: block_on_violation

  - type: reward_alignment
    frequency: hourly
    threshold: 0.70
    action: escalate_to_guardian

  - type: drift_detection
    frequency: daily
    patterns:
      - reward_hacking
      - escalation_suppression
    action: alert_architect

escalation:
  thresholds:
    reduce_autonomy: 35
    trigger_audit: 45
    pause_execution: 60
  auto_rollback_on_critical_policy: true
`;

    return baseConfig;
  }

  /**
   * Copy policy templates based on project type
   */
  private async copyPolicyTemplates(
    governanceDir: string,
    options: ProjectInitOptions,
  ): Promise<void> {
    const policiesDir = path.join(governanceDir, 'policies');

    const typeSpecificSecurityRules = this.getTypeSpecificSecurityRules(
      options.projectType,
    );

    const securityPolicy = `# Security Policy

Project: ${options.projectName}
Type: ${options.projectType}

## Hard Constraints
These constraints must NEVER be violated:

1. **No Secrets in Code**
   - No API keys, passwords, or tokens in source files
   - Use environment variables or secrets management

2. **Input Validation**
   - All user inputs must be validated
   - All API inputs must be sanitized

3. **Secure Dependencies**
   - No dependencies with known critical vulnerabilities
   - Regular dependency audits required

${typeSpecificSecurityRules}

## Enforcement
- Pre-commit hooks scan for secrets
- CI/CD blocks on security violations
- Evaluator agents flag suspicious patterns
`;

    const qualityPolicy = `# Quality Policy

Project: ${options.projectName}
Type: ${options.projectType}

## Code Quality Standards
1. **Test Coverage**: Minimum 80% coverage for new code
2. **Documentation**: All public APIs must be documented
3. **Linting**: All code must pass linting rules
4. **Type Safety**: Strong typing preferred

## Review Requirements
1. All changes require at least one review
2. Breaking changes require architecture review
3. Security-sensitive changes require security review

## Automated Gates
- Lint checks on every commit
- Tests run on every PR
- Coverage reports on merge
`;

    await fs.writeFile(path.join(policiesDir, 'security.md'), securityPolicy);
    await fs.writeFile(path.join(policiesDir, 'quality.md'), qualityPolicy);
  }

  private getTypeSpecificSecurityRules(projectType: ProjectType): string {
    const rules: Record<ProjectType, string> = {
      react: `## React-Specific Security
- Avoid dangerouslySetInnerHTML
- Validate props for XSS prevention
- Use Content Security Policy headers`,

      vue: `## Vue-Specific Security
- Avoid v-html with untrusted content
- Validate props and data
- Use Content Security Policy headers`,

      node: `## Node.js-Specific Security
- No SQL injection vulnerabilities
- Rate limiting on all endpoints
- Helmet.js for HTTP security headers
- Input sanitization on all routes`,

      python: `## Python-Specific Security
- Use parameterized queries
- Validate all file uploads
- Escape output in templates
- Use secure session handling`,

      go: `## Go-Specific Security
- Use prepared statements for SQL
- Validate all user input
- Use secure random generation
- Implement proper error handling`,

      rust: `## Rust-Specific Security
- Validate unsafe blocks
- Use proper error handling
- Avoid memory leaks
- Use cryptographically secure RNG`,

      java: `## Java-Specific Security
- Use prepared statements
- Validate deserialization
- Implement proper auth/authz
- Use secure random generation`,

      monorepo: `## Monorepo Security
- Audit shared dependencies
- Enforce package boundaries
- Validate cross-package imports
- Consistent security policies across packages`,
    };

    return rules[projectType] || '';
  }

  /**
   * Setup policy enforcement hooks
   */
  private async setupPolicyHooks(
    options: ProjectInitOptions,
    governanceDir: string,
  ): Promise<void> {
    const hooksDir = path.join(
      options.projectPath,
      '.claude',
      'hooks',
      'quality-gate',
    );
    await fs.ensureDir(hooksDir);

    // Create reference to governance policies
    const policiesPath = path.relative(
      hooksDir,
      path.join(governanceDir, 'policies'),
    );

    const preCommitHook = `# Quality Gate Pre-Commit Hook
---
name: quality-gate-pre-commit
project: ${options.projectName}
projectType: ${options.projectType}
trigger: pre_commit
scope: ${options.enableFleetArchitecture ? 'sub_agents' : 'all_agents'}
policiesPath: ${policiesPath}

checks:
  - name: lint
    command: 'npm run lint'
    blocking: true

  - name: type_check
    command: 'npm run typecheck'
    blocking: true

  - name: static_analysis
    command: 'npm run analyze'
    blocking: false

  - name: reviewer_agent
    type: agent
    agent: code-reviewer
    blocking: true
    config:
      autoApproveIf:
        - linesChanged < 50
        - confidence > 0.95
      escalateIf:
        - securityConcern: true
        - architecturalChange: true

failurePolicy:
  onLintFail: 'auto_fix_and_retry'
  onTypeCheckFail: 'block_and_report'
  onReviewerReject: 'escalate_to_session_manager'
---
`;

    await fs.writeFile(path.join(hooksDir, 'pre-commit.yaml'), preCommitHook);
  }

  /**
   * Initialize evaluator agents for alignment monitoring
   */
  private async initializeEvaluatorAgents(
    governanceDir: string,
    options: ProjectInitOptions,
  ): Promise<void> {
    const workforceSize = options.subAgentWorkforceSize
      ? WORKFORCE_SIZE_MAP[options.subAgentWorkforceSize]
      : 10;
    const evaluatorsDir = path.join(governanceDir, 'evaluators');

    const alignmentEvaluator = `---
name: alignment-evaluator
type: evaluator
tier: 0
project: ${options.projectName}
projectType: ${options.projectType}
workforceSize: ${workforceSize}

purpose: >
  Continuously monitor agent behavior for alignment drift and escalate to Guardians when thresholds exceeded.

metrics:
  - policy_compliance
  - intent_outcome_alignment
  - reward_function_integrity
  - escalation_health

thresholds:
  policy_violation_rate: 0.005  # >0.5% daily violations
  intent_outcome_gap: 0.15      # >15% divergence
  evaluator_disagreement: 0.20  # >20% monthly overrides
  escalation_suppression: 0.40  # >40% drop from baseline
  reward_hacking: 5             # >5 instances/month

escalationProtocol:
  automatic:
    - policy_violations
  guardian_review:
    - intent_outcome_gap > 0.15
    - reward_hacking_detected
  architect_alert:
    - systemic_misalignment
    - alignment_debt > 50
---
`;

    const driftDetector = `---
name: drift-detector
type: evaluator
tier: 1
project: ${options.projectName}
archetype: ${options.sessionManagerArchetype || 'engineering'}

purpose: >
  Detect behavioral drift in agent outputs and flag concerning patterns for review.

detection_patterns:
  - reward_hacking: Optimizing metrics without achieving intent
  - escalation_suppression: Avoiding escalation triggers inappropriately
  - policy_circumvention: Finding loopholes in policy constraints
  - quality_degradation: Gradual decline in output quality

monitoring:
  frequency: hourly
  sample_rate: 0.1  # 10% of outputs
  retention: 30d
  maxAgentsMonitored: ${workforceSize}

actions:
  on_drift_detected:
    severity_low: log_and_continue
    severity_medium: notify_session_manager
    severity_high: escalate_to_guardian
    severity_critical: pause_and_alert_architect
---
`;

    await fs.writeFile(
      path.join(evaluatorsDir, 'alignment-evaluator.md'),
      alignmentEvaluator,
    );
    await fs.writeFile(
      path.join(evaluatorsDir, 'drift-detector.md'),
      driftDetector,
    );
  }

  /**
   * Setup Memory Bank structure for session management
   * Creates session-template directory with activeContext.md, progress.md, etc.
   */
  async setupMemoryBank(options: ProjectInitOptions): Promise<void> {
    this.spinner.start('Setting up Memory Bank structure...');

    const memoryDir = path.join(options.projectPath, '.claude', 'memory');
    const sessionTemplateDir = path.join(memoryDir, 'session-template');
    const sessionsDir = path.join(memoryDir, 'sessions');
    const sharedDir = path.join(memoryDir, 'shared');

    // Create directory structure
    await fs.ensureDir(sessionTemplateDir);
    await fs.ensureDir(sessionsDir);
    await fs.ensureDir(sharedDir);

    // Create session template files
    const activeContextTemplate = `# Active Context - Session {{SESSION_ID}}

## Current Focus
<!-- Updated by session manager -->

## Working Memory
- Last action:
- Next planned step:
- Blockers:

## Context Window State
- Tokens used: X / 200,000
- Compression needed: Yes/No

## Handoff Notes
<!-- For session resumption -->
`;

    const progressTemplate = `# Progress Tracker - Session {{SESSION_ID}}

## High-Level Milestones
| Milestone | Status | Started | Completed |
|-----------|--------|---------|-----------|

## Current Sprint
- Goal:
- Progress: 0%
- ETA:

## Completed Tasks
<!-- Archive of completed work -->

## Blockers & Dependencies
<!-- Items waiting on external input -->
`;

    const subAgentDelegationTemplate = `# Sub-Agent Delegation Tracker

## Active Sub-Agents
| ID | Type | Task | Status | Worktree | Started |
|----|------|------|--------|----------|---------|

## Completed Tasks
<!-- Archive of completed sub-agent work -->

## Resource Usage
- Active worktrees: X / ${options.subAgentWorkforceSize ? WORKFORCE_SIZE_MAP[options.subAgentWorkforceSize] : 10}
- API calls (session): X
`;

    const ipreAlignmentTemplate = `# IPRE Alignment State

## Active Policies
<!-- Hard constraints for this session -->

## Reward Weights
\`\`\`yaml
customer_value: 0.35
code_quality: 0.30
timeline: 0.20
technical_debt: 0.15
\`\`\`

## Alignment Score
- Current: 85/100
- Last evaluation: {{TIMESTAMP}}
- Trend: Stable

## Escalation History
<!-- Guardian review log -->
`;

    const alignmentDebtTemplate = `# Alignment Debt Tracker - Session {{SESSION_ID}}

## Current Alignment Debt Score: 0/100
Status: HEALTHY
- <20 = Healthy
- 20-50 = Concerning
- >50 = Critical (requires Architect intervention)

## Five-Dimension Breakdown
| Dimension | Current | Threshold | Status |
|-----------|---------|-----------|--------|
| Policy Violation Rate | 0% | <0.5%/day | HEALTHY |
| Intent-Outcome Gap | 0% | <15% | HEALTHY |
| Evaluator Disagreement | 0% | <20%/month | HEALTHY |
| Escalation Suppression | 0% | <40% drop | HEALTHY |
| Reward Hacking | 0 instances | <5/month | HEALTHY |

## Historical Drift Scores
| Date | Score | Trend | Notes |
|------|-------|-------|-------|

## Guardian Review Notes
<!-- Notes from Guardian reviews -->

## Corrective Interventions Applied
| Date | Intervention | Reason | Outcome |
|------|--------------|--------|---------|

## Resolved vs Unresolved Issues
### Unresolved
None

### Resolved
None
`;

    // Write session template files
    await fs.writeFile(
      path.join(sessionTemplateDir, 'activeContext.md'),
      activeContextTemplate,
    );
    await fs.writeFile(
      path.join(sessionTemplateDir, 'progress.md'),
      progressTemplate,
    );
    await fs.writeFile(
      path.join(sessionTemplateDir, 'subAgentDelegation.md'),
      subAgentDelegationTemplate,
    );
    await fs.writeFile(
      path.join(sessionTemplateDir, 'ipre-alignment.md'),
      ipreAlignmentTemplate,
    );
    await fs.writeFile(
      path.join(sessionTemplateDir, 'alignmentDebt.md'),
      alignmentDebtTemplate,
    );

    // Create shared memory files
    const architectureShared = `# Shared Architecture Decisions

## Cross-Session Architectural Patterns
<!-- Decisions that apply across all sessions -->

## Technology Stack
<!-- Canonical technology choices -->

## Integration Points
<!-- How systems connect -->
`;

    const patternsShared = `# Learned Patterns

## Successful Patterns
<!-- Patterns that have worked well -->

## Anti-Patterns to Avoid
<!-- Patterns that have caused issues -->

## Optimization Opportunities
<!-- Areas identified for improvement -->
`;

    await fs.writeFile(
      path.join(sharedDir, 'architecture.md'),
      architectureShared,
    );
    await fs.writeFile(path.join(sharedDir, 'patterns.md'), patternsShared);

    // Create session manager archetypes if fleet architecture enabled
    if (options.enableFleetArchitecture) {
      await this.createSessionManagerArchetypes(options);
    }

    this.spinner.succeed('Memory Bank structure configured');
  }

  /**
   * Create session manager archetype templates
   */
  private async createSessionManagerArchetypes(
    options: ProjectInitOptions,
  ): Promise<void> {
    const archetypesDir = path.join(
      options.projectPath,
      '.claude',
      'agents',
      'session-managers',
    );
    await fs.ensureDir(archetypesDir);

    const archetypes: Record<string, string> = {
      'engineering-manager.md': `---
name: session-engineering-manager
type: session-manager
tier: 2
archetype: engineering

purpose: >
  Oversee software development lifecycle ensuring code quality, architectural integrity,
  and successful deployment.

guidingPrinciples:
  - "If it isn't tested, it doesn't exist"
  - 'Documentation updates alongside code'
  - 'Zero known security vulnerabilities'

measurableObjectives:
  ciPipelineSuccess: '>99%'
  featureTurnaround: '<24h'
  codeReviewCoverage: '100%'

specializedMCPs:
  - git
  - github
  - postgresql
  - sentry
  - cloudwatch

keySubAgents:
  - backend-dev
  - frontend-dev
  - qa-engineer
  - security-auditor

memoryBankPath: '.claude/memory/sessions/\${SESSION_ID}/'
---
`,
      'legal-audit-lead.md': `---
name: session-legal-audit-lead
type: session-manager
tier: 2
archetype: legal

purpose: >
  Manage legal document review, contract analysis, and compliance verification workflows.

guidingPrinciples:
  - 'Accuracy over speed'
  - 'Document everything'
  - 'Escalate uncertainty immediately'

measurableObjectives:
  documentReviewAccuracy: '>99%'
  complianceRate: '100%'
  escalationResponseTime: '<1h'

specializedMCPs:
  - document-search
  - compliance-db
  - audit-trail

keySubAgents:
  - contract-scanner
  - risk-analyst
  - compliance-checker

memoryBankPath: '.claude/memory/sessions/\${SESSION_ID}/'
---
`,
      'hr-ops-director.md': `---
name: session-hr-ops-director
type: session-manager
tier: 2
archetype: hr

purpose: >
  Coordinate HR operations including recruitment, onboarding, and policy management.

guidingPrinciples:
  - 'People first'
  - 'Fair and consistent processes'
  - 'Privacy and confidentiality'

measurableObjectives:
  hiringTimeToOffer: '<2 weeks'
  onboardingCompletion: '100%'
  employeeSatisfaction: '>4.0/5'

specializedMCPs:
  - applicant-tracking
  - hr-database
  - calendar

keySubAgents:
  - resume-screener
  - policy-advisor
  - onboarding-coordinator

memoryBankPath: '.claude/memory/sessions/\${SESSION_ID}/'
---
`,
      'growth-marketing-lead.md': `---
name: session-growth-marketing-lead
type: session-manager
tier: 2
archetype: marketing

purpose: >
  Drive growth initiatives through data-driven marketing campaigns and content strategy.

guidingPrinciples:
  - 'Data-driven decisions'
  - 'Brand consistency'
  - 'Customer-centric messaging'

measurableObjectives:
  campaignROI: '>3x'
  leadQuality: '>80% qualified'
  contentEngagement: '>5% CTR'

specializedMCPs:
  - analytics
  - social-media
  - cms
  - crm

keySubAgents:
  - trend-analyst
  - copywriter
  - data-analyst

memoryBankPath: '.claude/memory/sessions/\${SESSION_ID}/'
---
`,
    };

    for (const [filename, content] of Object.entries(archetypes)) {
      await fs.writeFile(path.join(archetypesDir, filename), content);
    }

    // Create README for session managers
    const readmeContent = `# Session Manager Archetypes

Session Managers are Tier 2 agents that coordinate feature implementation,
manage sub-agent workforces, and maintain git worktree isolation.

## Available Archetypes

| Archetype | File | Purpose |
|-----------|------|---------|
| Engineering | engineering-manager.md | Software development lifecycle |
| Legal | legal-audit-lead.md | Document review and compliance |
| HR | hr-ops-director.md | Recruitment and HR operations |
| Marketing | growth-marketing-lead.md | Growth and content strategy |

## Usage

Specify the archetype when initializing a project:

\`\`\`bash
wundr init --session-manager-archetype engineering
\`\`\`
`;

    await fs.writeFile(path.join(archetypesDir, 'README.md'), readmeContent);
  }

  private getProjectWorkflows(
    options: ProjectInitOptions,
  ): Record<string, unknown> {
    const specializedAgents = this.getSpecializedAgents(options.projectType);

    return {
      sparc: {
        name: 'SPARC Workflow',
        project: options.projectName,
        projectType: options.projectType,
        agents: [
          'specification',
          'pseudocode',
          'architecture',
          'refinement',
          ...specializedAgents,
        ],
        steps: ['spec', 'design', 'implement', 'test', 'integrate'],
        fleetEnabled: options.enableFleetArchitecture || false,
      },
      tdd: {
        name: 'TDD Workflow',
        project: options.projectName,
        projectType: options.projectType,
        agents: ['tester', 'coder', 'reviewer'],
        steps: ['test-first', 'implement', 'refactor'],
        fleetEnabled: options.enableFleetArchitecture || false,
      },
      review: {
        name: 'Review Workflow',
        project: options.projectName,
        projectType: options.projectType,
        agents: ['reviewer', 'security-auditor'],
        steps: ['lint', 'test', 'security-scan', 'review'],
        fleetEnabled: options.enableFleetArchitecture || false,
      },
    };
  }

  private generateWorkflowRunnerScript(): string {
    return `#!/bin/bash
# Workflow runner script
echo "Running workflow..."
`;
  }

  private async setupGitHooks(options: ProjectInitOptions): Promise<void> {
    const gitHooksDir = path.join(options.projectPath, '.git', 'hooks');

    // Only setup if .git directory exists
    if (!(await fs.pathExists(path.join(options.projectPath, '.git')))) {
      return;
    }

    await fs.ensureDir(gitHooksDir);

    // Create pre-commit hook
    const preCommitHook = `#!/bin/bash
# Pre-commit hook for ${options.projectName}
# Runs linting and type checking before commit

echo "Running pre-commit checks..."

# Run lint
if [ -f "package.json" ] && grep -q '"lint"' package.json; then
  npm run lint || exit 1
fi

# Run type check
if [ -f "package.json" ] && grep -q '"typecheck"' package.json; then
  npm run typecheck || exit 1
fi

echo "Pre-commit checks passed!"
`;

    const preCommitPath = path.join(gitHooksDir, 'pre-commit');
    await fs.writeFile(preCommitPath, preCommitHook);
    await fs.chmod(preCommitPath, '755');

    // Create commit-msg hook for conventional commits
    const commitMsgHook = `#!/bin/bash
# Commit message validation hook for ${options.projectName}

commit_msg=$(cat "$1")

# Check for conventional commit format
if ! echo "$commit_msg" | grep -qE "^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\\(.+\\))?: .+"; then
  echo "Error: Commit message must follow conventional commits format"
  echo "Example: feat(auth): add login functionality"
  exit 1
fi

echo "Commit message format valid!"
`;

    const commitMsgPath = path.join(gitHooksDir, 'commit-msg');
    await fs.writeFile(commitMsgPath, commitMsgHook);
    await fs.chmod(commitMsgPath, '755');
  }

  private async setupClaudeFlowHooks(
    options: ProjectInitOptions,
  ): Promise<void> {
    const claudeFlowDir = path.join(
      options.projectPath,
      '.claude',
      'hooks',
      'claude-flow',
    );
    await fs.ensureDir(claudeFlowDir);

    const preTaskHook = `#!/bin/bash
# Claude Flow pre-task hook for ${options.projectName}

task_description=$1

echo "Starting Claude Flow task: $task_description"

# Register with Claude Flow if available
if command -v npx &> /dev/null; then
  npx claude-flow@alpha hooks pre-task --description "$task_description" 2>/dev/null || true
fi
`;

    const postTaskHook = `#!/bin/bash
# Claude Flow post-task hook for ${options.projectName}

task_id=$1

echo "Completing Claude Flow task: $task_id"

# Notify Claude Flow if available
if command -v npx &> /dev/null; then
  npx claude-flow@alpha hooks post-task --task-id "$task_id" 2>/dev/null || true
fi
`;

    await fs.writeFile(path.join(claudeFlowDir, 'pre-task.sh'), preTaskHook);
    await fs.chmod(path.join(claudeFlowDir, 'pre-task.sh'), '755');

    await fs.writeFile(path.join(claudeFlowDir, 'post-task.sh'), postTaskHook);
    await fs.chmod(path.join(claudeFlowDir, 'post-task.sh'), '755');
  }

  private async setupVerificationHooks(
    options: ProjectInitOptions,
  ): Promise<void> {
    const verificationDir = path.join(
      options.projectPath,
      '.claude',
      'hooks',
      'verification',
    );
    await fs.ensureDir(verificationDir);

    const verifyBuildHook = `#!/bin/bash
# Build verification hook for ${options.projectName}

echo "Verifying build..."

if [ -f "package.json" ]; then
  if grep -q '"build"' package.json; then
    npm run build || exit 1
    echo "Build verification passed!"
  else
    echo "No build script found, skipping build verification"
  fi
else
  echo "No package.json found, skipping build verification"
fi
`;

    const verifyTestsHook = `#!/bin/bash
# Test verification hook for ${options.projectName}

echo "Verifying tests..."

if [ -f "package.json" ]; then
  if grep -q '"test"' package.json; then
    npm run test || exit 1
    echo "Test verification passed!"
  else
    echo "No test script found, skipping test verification"
  fi
else
  echo "No package.json found, skipping test verification"
fi
`;

    await fs.writeFile(
      path.join(verificationDir, 'verify-build.sh'),
      verifyBuildHook,
    );
    await fs.chmod(path.join(verificationDir, 'verify-build.sh'), '755');

    await fs.writeFile(
      path.join(verificationDir, 'verify-tests.sh'),
      verifyTestsHook,
    );
    await fs.chmod(path.join(verificationDir, 'verify-tests.sh'), '755');
  }

  private generateProjectSetupDoc(options: ProjectInitOptions): string {
    return `# Project Setup Guide

Project: ${options.projectName}
Type: ${options.projectType}

## Getting Started
1. Install dependencies
2. Configure environment
3. Run initial setup
`;
  }

  private generateAgentGuideDoc(options: ProjectInitOptions): string {
    const specializedAgents = this.getSpecializedAgents(options.projectType);
    return `# Agent Guide

Project: ${options.projectName}
Type: ${options.projectType}

## Core Agents
- **coder**: Implements features and writes code
- **reviewer**: Reviews code for quality and best practices
- **tester**: Creates and maintains tests
- **planner**: Breaks down tasks and creates plans
- **researcher**: Investigates solutions and gathers context

## Specialized Agents for ${options.projectType}
${specializedAgents.map(agent => `- **${agent}**: Specialized for ${options.projectType} development`).join('\n')}

## Using Agents

### Spawn an Agent
\`\`\`bash
npx claude-flow agent spawn --type coder --task "implement feature"
\`\`\`

### List Active Agents
\`\`\`bash
npx claude-flow agent list
\`\`\`

### Check Agent Status
\`\`\`bash
npx claude-flow agent status --id <agent-id>
\`\`\`

## Agent Files Location
See .claude/agents/ for agent configurations and templates.
`;
  }

  private generateWorkflowGuideDoc(options: ProjectInitOptions): string {
    return `# Workflow Guide

Project: ${options.projectName}
Type: ${options.projectType}

## Available Workflows

### SPARC Workflow
Systematic development using Specification, Pseudocode, Architecture, Refinement, Completion.

\`\`\`bash
npx claude-flow sparc tdd "<feature description>"
\`\`\`

### TDD Workflow
Test-Driven Development with Red-Green-Refactor cycle.

\`\`\`bash
npx claude-flow sparc run tdd "<feature description>"
\`\`\`

### Review Workflow
Code review process with automated checks.

\`\`\`bash
npx claude-flow sparc run review "<PR or branch>"
\`\`\`

## Workflow Customization

Workflows can be customized in \`.claude/workflows/\`:
- \`sparc-workflow.md\` - SPARC methodology settings
- \`tdd-workflow.md\` - TDD configuration
- \`review-workflow.md\` - Review checklist and process

## Running Workflows

### Sequential Execution
\`\`\`bash
npx claude-flow sparc pipeline "<task>"
\`\`\`

### Parallel Execution
\`\`\`bash
npx claude-flow sparc batch spec,arch,test "<task>"
\`\`\`

See .claude/workflows/ for detailed configurations.
`;
  }

  private generateDevelopmentDoc(options: ProjectInitOptions): string {
    const typeSpecificGuide = this.getTypeSpecificDevelopmentGuide(
      options.projectType,
    );
    return `# Development Guide

Project: ${options.projectName}
Type: ${options.projectType}

## Getting Started

1. Clone the repository
2. Install dependencies: \`npm install\` or \`pnpm install\`
3. Copy environment template: \`cp .env.example .env\`
4. Start development server: \`npm run dev\`

## Project Structure

\`\`\`
${options.projectName}/
  src/              # Source code
  tests/            # Test files
  docs/             # Documentation
  .claude/          # Claude Code configuration
    agents/         # Agent definitions
    hooks/          # Automation hooks
    workflows/      # Workflow configurations
\`\`\`

${typeSpecificGuide}

## Code Quality

- Run linting: \`npm run lint\`
- Run type check: \`npm run typecheck\`
- Run tests: \`npm run test\`
- Run all checks: \`npm run check\`

## Troubleshooting

### Common Issues

1. **Dependency issues**: Delete \`node_modules\` and reinstall
2. **Type errors**: Run \`npm run typecheck\` for details
3. **Test failures**: Check test output for specific failures

### Getting Help

- Check project documentation in \`docs/\`
- Review agent configurations in \`.claude/agents/\`
- Consult workflow guides in \`.claude/workflows/\`
`;
  }

  private getTypeSpecificDevelopmentGuide(projectType: ProjectType): string {
    const guides: Record<ProjectType, string> = {
      react: `## React Development

- Components in \`src/components/\`
- Hooks in \`src/hooks/\`
- State management in \`src/store/\`
- Use functional components with hooks
- Follow React best practices`,

      vue: `## Vue Development

- Components in \`src/components/\`
- Composables in \`src/composables/\`
- Store in \`src/store/\`
- Use Composition API
- Follow Vue 3 best practices`,

      node: `## Node.js Development

- Source code in \`src/\`
- API routes in \`src/routes/\`
- Services in \`src/services/\`
- Use async/await for async operations
- Follow Node.js best practices`,

      python: `## Python Development

- Source code in \`src/\`
- Use virtual environments
- Follow PEP 8 style guide
- Use type hints
- Document with docstrings`,

      go: `## Go Development

- Packages in \`pkg/\`
- Commands in \`cmd/\`
- Internal code in \`internal/\`
- Follow Go conventions
- Use go modules`,

      rust: `## Rust Development

- Source in \`src/\`
- Libraries in \`src/lib.rs\`
- Binaries in \`src/main.rs\`
- Follow Rust conventions
- Use cargo for dependencies`,

      java: `## Java Development

- Source in \`src/main/java/\`
- Tests in \`src/test/java/\`
- Follow Maven/Gradle conventions
- Use dependency injection
- Follow Java best practices`,

      monorepo: `## Monorepo Development

- Packages in \`packages/\`
- Shared code in \`packages/shared/\`
- Use workspace features
- Maintain package boundaries
- Use consistent versioning`,
    };

    return (
      guides[projectType] || '## Development\n\nFollow project conventions.'
    );
  }

  private getDefaultProfile(): DeveloperProfile {
    return {
      name: 'Developer',
      email: 'dev@example.com',
      role: 'developer',
      team: 'Engineering',
      preferences: {
        shell: 'zsh',
        editor: 'vscode',
        theme: 'dark',
        gitConfig: {
          userName: 'Developer',
          userEmail: 'dev@example.com',
          signCommits: false,
          defaultBranch: 'main',
          aliases: {},
        },
        aiTools: {
          claudeCode: true,
          claudeFlow: true,
          mcpTools: [],
          swarmAgents: [],
          memoryAllocation: '2GB',
        },
      },
      tools: {
        packageManagers: {
          npm: true,
          pnpm: true,
          yarn: false,
        },
      },
    };
  }

  private printNextSteps(options: ProjectInitOptions): void {
    const fleetSteps = options.enableFleetArchitecture
      ? [
          chalk.white('4. Review governance in .claude/governance/'),
          chalk.white('5. Configure session manager archetype'),
        ]
      : [];

    const gitWorktreeSteps = options.includeGitWorktree
      ? [
          chalk.white(
            `${fleetSteps.length + 4}. Setup git worktrees: ./scripts/manage-worktrees.sh`,
          ),
        ]
      : [];

    const nextSteps = [
      chalk.cyan(`Next Steps for ${options.projectName}:`),
      chalk.white('1. Review CLAUDE.md configuration'),
      chalk.white('2. Customize agent templates in .claude/agents/'),
      chalk.white('3. Review conventions in .claude/conventions/'),
      ...fleetSteps,
      ...gitWorktreeSteps,
      chalk.white(
        `${4 + fleetSteps.length + gitWorktreeSteps.length}. Run: npx claude-flow@alpha mcp start`,
      ),
      chalk.white(
        `${5 + fleetSteps.length + gitWorktreeSteps.length}. Start development with your chosen workflow`,
      ),
      '',
      chalk.gray(`Project type: ${options.projectType}`),
      options.enableFleetArchitecture
        ? chalk.gray(
            `Fleet architecture: enabled (${options.sessionManagerArchetype || 'engineering'} archetype)`,
          )
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    this.spinner.info(nextSteps);
  }
}

export default ProjectInitializer;
