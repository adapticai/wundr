/**
 * Project Initialization Module
 *
 * Comprehensive project initialization system for setting up .claude directory,
 * templates, agents, workflows, and git-worktree configuration.
 *
 * Features:
 * - Enhanced options with context engineering, memory architectures, and orchestration
 * - Claude Code conventions generator for .claude/ directory structure
 * - Support for different memory architectures (basic, tiered, memgpt)
 * - Orchestration framework integration (claude-flow, sparc, custom)
 * - Agent, skill, and command generation
 *
 * @module project-init
 */

import CustomizationEngineInstance from './customization-engine.js';
import ProjectInitializerInstance from './project-initializer.js';
import TemplateSelectorInstance from './template-selector.js';
import ValidationCheckerInstance from './validation-checker.js';

import type { ProjectInitOptions } from './project-initializer.js';
import type { TemplateMetadata } from './template-selector.js';
import type { TemplateContext } from '../templates/template-manager.js';

// Core exports
export { ProjectInitializer } from './project-initializer.js';
export type {
  ProjectInitOptions,
  ProjectType,
  SubAgentWorkforceSize,
} from './project-initializer.js';
export { WORKFORCE_SIZE_MAP } from './project-initializer.js';
export { TemplateSelector } from './template-selector.js';
export type {
  TemplateSelectionCriteria,
  TemplateMetadata,
} from './template-selector.js';
export { CustomizationEngine } from './customization-engine.js';
export type {
  CustomizationRule,
  CustomizationProcedure,
} from './customization-engine.js';
export { ValidationChecker } from './validation-checker.js';
export type {
  ValidationResult,
  ValidationReport,
} from './validation-checker.js';

// Enhanced options exports
export {
  createEnhancedOptions,
  DEFAULT_CONTEXT_ENGINEERING,
  DEFAULT_MEMORY_CONFIGS,
  DEFAULT_ORCHESTRATION_CONFIGS,
  DEFAULT_PROMPT_CONFIG,
  DEFAULT_SECURITY_CONFIGS,
} from './enhanced-options.js';

export type {
  EnhancedProjectOptions,
  ContextEngineeringConfig,
  MemoryConfig,
  MemoryArchitecture,
  OrchestrationConfig,
  OrchestrationFramework,
  PromptConfig,
  SecurityConfig,
  AgentConfig,
  SkillConfig,
  CommandConfig,
  SessionManagerArchetype,
} from './enhanced-options.js';

// Claude Code conventions exports
export { generateClaudeCodeStructure } from './claude-code-conventions.js';

export type {
  ClaudeCodeStructure,
  ClaudeSettings,
} from './claude-code-conventions.js';

/**
 * Main initialization orchestrator
 * Combines all initialization components into a single, easy-to-use interface
 */
export class ProjectInitOrchestrator {
  private initializer: ProjectInitializerInstance;
  private templateSelector: TemplateSelectorInstance;
  private customizationEngine: CustomizationEngineInstance;
  private validationChecker: ValidationCheckerInstance;

  constructor() {
    this.initializer = new ProjectInitializerInstance();
    this.templateSelector = new TemplateSelectorInstance();
    this.customizationEngine = new CustomizationEngineInstance();
    this.validationChecker = new ValidationCheckerInstance();
  }

  /**
   * Initialize a new project with full setup
   */
  async initializeProject(options: {
    projectPath: string;
    projectName: string;
    interactive?: boolean;
    autoFix?: boolean;
  }): Promise<void> {
    let template;

    // Select template (interactive or automatic)
    if (options.interactive) {
      template = await this.templateSelector.interactiveSelection();
    } else {
      // Use default selection
      const templates = await this.templateSelector.selectTemplates({
        projectType: 'node',
        scale: 'medium',
        useTypeScript: true,
        useTesting: true,
      });
      template =
        templates[0] || this.templateSelector.getTemplate('node-basic')!;
    }

    // Validate template requirements
    await this.templateSelector.validateTemplateRequirements(template);

    // Initialize project structure
    await this.initializer.initialize({
      projectPath: options.projectPath,
      projectName: options.projectName,
      projectType: template
        .projectTypes[0] as ProjectInitOptions['projectType'],
      includeClaudeSetup: true,
      includeAgents: true,
      includeHooks: true,
      includeGitWorktree: true,
      includeTemplates: true,
      customAgents: template.agents,
    });

    // Apply customizations
    await this.customizationEngine.customizeProject(
      options.projectPath,
      this.createContext(options.projectName, template)
    );

    // Validate setup
    const report = await this.validationChecker.validate(options.projectPath);

    // Auto-fix issues if requested
    if (options.autoFix && report.failed > 0) {
      await this.validationChecker.autoFix(options.projectPath);
    }
  }

  /**
   * Quick setup for existing projects
   */
  async setupExistingProject(projectPath: string): Promise<void> {
    // Detect project type
    const projectType = await this.detectProjectType(projectPath);

    // Get appropriate template
    const templates = this.templateSelector.getTemplatesForType(projectType);
    const template =
      templates[0] || this.templateSelector.getTemplate('default')!;

    // Initialize only .claude directory and configurations
    const pathModule = await import('path');
    await this.initializer.initialize({
      projectPath,
      projectName: pathModule.basename(projectPath),
      projectType: projectType as ProjectInitOptions['projectType'],
      includeClaudeSetup: true,
      includeAgents: true,
      includeHooks: true,
      includeGitWorktree: false,
      includeTemplates: true,
      customAgents: template.agents,
      force: true,
    });
  }

  /**
   * Validate existing project setup
   */
  async validateProject(projectPath: string, autoFix = false): Promise<void> {
    await this.validationChecker.validate(projectPath);

    if (autoFix) {
      await this.validationChecker.autoFix(projectPath);
    }
  }

  /**
   * Update project templates
   */
  async updateTemplates(projectPath: string): Promise<void> {
    const projectType = await this.detectProjectType(projectPath);
    const templates = this.templateSelector.getTemplatesForType(projectType);
    const template = templates[0];

    if (template) {
      const pathModule = await import('path');
      await this.customizationEngine.customizeProject(
        projectPath,
        this.createContext(pathModule.basename(projectPath), template)
      );
    }
  }

  /**
   * Helper: Detect project type
   */
  private async detectProjectType(projectPath: string): Promise<string> {
    const fs = await import('fs-extra');
    const path = await import('path');

    // Check for package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const pkg = await fs.readJson(packageJsonPath);

      // Check dependencies
      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if (deps.next) {
        return 'nextjs';
      }
      if (deps.react) {
        return 'react';
      }
      if (deps.vue) {
        return 'vue';
      }
      if (deps.express || deps.fastify) {
        return 'node';
      }
    }

    // Check for other indicators
    if (await fs.pathExists(path.join(projectPath, 'go.mod'))) {
      return 'go';
    }
    if (await fs.pathExists(path.join(projectPath, 'Cargo.toml'))) {
      return 'rust';
    }
    if (await fs.pathExists(path.join(projectPath, 'requirements.txt'))) {
      return 'python';
    }
    if (await fs.pathExists(path.join(projectPath, 'pom.xml'))) {
      return 'java';
    }
    if (await fs.pathExists(path.join(projectPath, 'packages'))) {
      return 'monorepo';
    }

    return 'node'; // Default
  }

  /**
   * Helper: Create template context
   */
  private createContext(
    projectName: string,
    template: TemplateMetadata
  ): TemplateContext {
    return {
      profile: {
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
        tools: { packageManagers: { pnpm: true } },
      },
      project: {
        name: projectName,
        description: template.description,
        version: '1.0.0',
        type: template.projectTypes[0] as TemplateContext['project']['type'],
        packageManager: 'pnpm',
        license: 'MIT',
        author: 'Developer',
      },
      platform: {
        os: process.platform as TemplateContext['platform']['os'],
        arch: process.arch as TemplateContext['platform']['arch'],
        nodeVersion: process.version.replace('v', ''),
        shell: 'zsh',
      },
      customVariables: {
        PROJECT_TYPE: template.projectTypes[0],
      },
    };
  }
}

// Export singleton instance
export const projectInit = new ProjectInitOrchestrator();

export default projectInit;
