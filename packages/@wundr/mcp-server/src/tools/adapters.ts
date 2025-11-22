/**
 * Adapters for @wundr/computer-setup package classes
 *
 * These adapters wrap existing classes to provide a unified interface
 * for MCP tool implementations, handling async operations and error handling.
 *
 * The adapters use lazy-loading to import the computer-setup classes at runtime,
 * allowing the MCP server to start even if the computer-setup package is not
 * fully available (graceful degradation).
 *
 * @module adapters
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface ProjectInitOptions {
  projectPath: string;
  projectName: string;
  projectType: 'node' | 'react' | 'vue' | 'python' | 'go' | 'rust' | 'java' | 'monorepo';
  profile?: DeveloperProfile;
  includeClaudeSetup: boolean;
  includeAgents: boolean;
  includeHooks: boolean;
  includeGitWorktree: boolean;
  includeTemplates: boolean;
  customAgents?: string[];
  interactive?: boolean;
  force?: boolean;
}

export interface TemplateSelectionCriteria {
  projectType: string;
  framework?: string;
  features?: string[];
  scale?: 'small' | 'medium' | 'large' | 'enterprise';
  teamSize?: number;
  useTypeScript?: boolean;
  useTesting?: boolean;
  useCI?: boolean;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  projectTypes: string[];
  frameworks: string[];
  features: string[];
  agents: string[];
  workflows: string[];
  conventions: string[];
  complexity: 'basic' | 'intermediate' | 'advanced' | 'enterprise';
  requirements: {
    nodeVersion?: string;
    packageManager?: string[];
    tools?: string[];
  };
}

export interface CustomizationRule {
  id: string;
  name: string;
  description: string;
  condition: (context: TemplateContext) => boolean;
  apply: (content: string, context: TemplateContext) => string;
  priority: number;
}

export interface ValidationResult {
  passed: boolean;
  category: string;
  check: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  fixable: boolean;
  fix?: () => Promise<void>;
}

export interface ValidationReport {
  timestamp: Date;
  projectPath: string;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  results: ValidationResult[];
  score: number;
}

export interface TemplateContext {
  profile: DeveloperProfile;
  project: {
    name: string;
    description: string;
    version: string;
    type: 'node' | 'react' | 'vue' | 'python' | 'go' | 'rust' | 'java';
    packageManager: 'npm' | 'pnpm' | 'yarn';
    repository?: string;
    license: string;
    author: string;
    organization?: string;
  };
  platform: {
    os: 'darwin' | 'linux' | 'win32';
    arch: 'x64' | 'arm64';
    nodeVersion: string;
    shell: 'bash' | 'zsh' | 'fish';
  };
  customVariables?: Record<string, unknown>;
}

export interface DeveloperProfile {
  name: string;
  email: string;
  role: string;
  team: string;
  preferences?: {
    shell?: string;
    editor?: string;
    theme?: string;
    gitConfig?: {
      userName: string;
      userEmail: string;
      signCommits: boolean;
      defaultBranch: string;
      aliases: Record<string, string>;
    };
    aiTools?: {
      claudeCode: boolean;
      claudeFlow: boolean;
      mcpTools: string[];
      swarmAgents: string[];
      memoryAllocation: string;
    };
  };
  tools?: {
    packageManagers?: {
      npm?: boolean;
      pnpm?: boolean;
      yarn?: boolean;
    };
    databases?: {
      postgresql?: boolean;
      redis?: boolean;
    };
  };
  frameworks?: {
    react?: boolean;
  };
}

export interface SetupPlatform {
  os: string;
  arch: string;
  nodeVersion?: string;
}

/**
 * Result wrapper for adapter operations
 */
export interface AdapterResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a successful result
 */
function success<T>(data: T): AdapterResult<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an error result
 */
function error<T>(message: string): AdapterResult<T> {
  return {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Lazy-load a module from computer-setup package
 */
async function loadComputerSetupModule(modulePath: string): Promise<unknown> {
  try {
    return await import(`@wundr/computer-setup/${modulePath}`);
  } catch (err) {
    throw new Error(`Failed to load computer-setup module: ${modulePath}. Make sure @wundr/computer-setup is installed.`);
  }
}

// ============================================================================
// Adapter Classes
// ============================================================================

/**
 * Adapter for ProjectInitializer class
 * Handles project initialization with .claude directory setup
 */
export class ProjectInitializerAdapter {
  private initializerInstance: unknown = null;

  /**
   * Get or create the ProjectInitializer instance
   */
  private async getInitializer(): Promise<{ initialize: (options: ProjectInitOptions) => Promise<void> }> {
    if (!this.initializerInstance) {
      try {
        const module = await loadComputerSetupModule('src/project-init/index.js');
        const ProjectInitializer = (module as { ProjectInitializer: new () => unknown }).ProjectInitializer;
        this.initializerInstance = new ProjectInitializer();
      } catch {
        // Fallback to a stub implementation
        this.initializerInstance = {
          initialize: async () => {
            throw new Error('ProjectInitializer not available. Install @wundr/computer-setup package.');
          },
        };
      }
    }
    return this.initializerInstance as { initialize: (options: ProjectInitOptions) => Promise<void> };
  }

  /**
   * Initialize a new project with full setup
   *
   * @example
   * const result = await adapter.initialize({
   *   projectPath: '/path/to/project',
   *   projectName: 'my-app',
   *   projectType: 'node',
   *   includeClaudeSetup: true,
   *   includeAgents: true,
   *   includeHooks: true,
   *   includeGitWorktree: false,
   *   includeTemplates: true
   * });
   */
  async initialize(options: ProjectInitOptions): Promise<AdapterResult<void>> {
    try {
      if (!options.projectPath) {
        return error('projectPath is required');
      }
      if (!options.projectName) {
        return error('projectName is required');
      }
      if (!options.projectType) {
        return error('projectType is required');
      }

      const initializer = await this.getInitializer();
      await initializer.initialize(options);
      return success(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to initialize project: ${message}`);
    }
  }

  /**
   * Get supported project types
   */
  getSupportedProjectTypes(): string[] {
    return ['node', 'react', 'vue', 'python', 'go', 'rust', 'java', 'monorepo'];
  }
}

/**
 * Adapter for TemplateSelector class
 * Handles template selection based on project criteria
 */
export class TemplateSelectorAdapter {
  private selectorInstance: unknown = null;

  private async getSelector(): Promise<{
    selectTemplates: (criteria: TemplateSelectionCriteria) => Promise<TemplateMetadata[]>;
    getTemplate: (id: string) => TemplateMetadata | undefined;
    listTemplates: () => TemplateMetadata[];
    getTemplatesForType: (type: string) => TemplateMetadata[];
    validateTemplateRequirements: (template: TemplateMetadata) => Promise<boolean>;
  }> {
    if (!this.selectorInstance) {
      try {
        const module = await loadComputerSetupModule('src/project-init/index.js');
        const TemplateSelector = (module as { TemplateSelector: new () => unknown }).TemplateSelector;
        this.selectorInstance = new TemplateSelector();
      } catch {
        // Return stub implementation with built-in templates
        this.selectorInstance = this.createStubSelector();
      }
    }
    return this.selectorInstance as ReturnType<typeof this.getSelector> extends Promise<infer T> ? T : never;
  }

  private createStubSelector() {
    const templates: TemplateMetadata[] = [
      {
        id: 'node-basic',
        name: 'Basic Node.js',
        description: 'Simple Node.js project with essential setup',
        projectTypes: ['node'],
        frameworks: ['express'],
        features: ['typescript', 'testing'],
        agents: ['coder', 'reviewer', 'tester', 'backend-dev'],
        workflows: ['tdd', 'review'],
        conventions: ['code-style', 'git-workflow', 'testing-standards'],
        complexity: 'basic',
        requirements: { nodeVersion: '>=18.0.0', packageManager: ['npm', 'pnpm', 'yarn'] },
      },
      {
        id: 'react-frontend',
        name: 'React Frontend',
        description: 'Modern React application with best practices',
        projectTypes: ['react'],
        frameworks: ['react', 'vite'],
        features: ['typescript', 'testing', 'cicd', 'docker'],
        agents: ['coder', 'reviewer', 'tester', 'mobile-dev', 'frontend-architect'],
        workflows: ['tdd', 'review', 'deployment'],
        conventions: ['code-style', 'component-structure', 'git-workflow', 'testing-standards'],
        complexity: 'intermediate',
        requirements: { nodeVersion: '>=18.0.0', packageManager: ['pnpm', 'yarn'] },
      },
      {
        id: 'monorepo-workspace',
        name: 'Monorepo Workspace',
        description: 'Multi-package monorepo with shared tooling',
        projectTypes: ['monorepo'],
        frameworks: ['turborepo', 'nx'],
        features: ['typescript', 'testing', 'cicd', 'docker', 'monitoring', 'api-docs'],
        agents: ['coder', 'reviewer', 'tester', 'planner', 'researcher', 'repo-architect'],
        workflows: ['sparc', 'tdd', 'review', 'deployment', 'release'],
        conventions: ['code-style', 'monorepo-structure', 'package-naming', 'git-workflow'],
        complexity: 'enterprise',
        requirements: { nodeVersion: '>=18.0.0', packageManager: ['pnpm'], tools: ['turborepo'] },
      },
    ];

    return {
      selectTemplates: async (criteria: TemplateSelectionCriteria) => {
        return templates.filter(t => t.projectTypes.includes(criteria.projectType));
      },
      getTemplate: (id: string) => templates.find(t => t.id === id),
      listTemplates: () => templates,
      getTemplatesForType: (type: string) => templates.filter(t => t.projectTypes.includes(type)),
      validateTemplateRequirements: async () => true,
    };
  }

  async selectTemplates(criteria: TemplateSelectionCriteria): Promise<AdapterResult<TemplateMetadata[]>> {
    try {
      if (!criteria.projectType) {
        return error('projectType is required in criteria');
      }
      const selector = await this.getSelector();
      const templates = await selector.selectTemplates(criteria);
      return success(templates);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to select templates: ${message}`);
    }
  }

  async getTemplate(templateId: string): Promise<AdapterResult<TemplateMetadata | null>> {
    try {
      if (!templateId) {
        return error('templateId is required');
      }
      const selector = await this.getSelector();
      const template = selector.getTemplate(templateId);
      return success(template || null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to get template: ${message}`);
    }
  }

  async listTemplates(): Promise<AdapterResult<TemplateMetadata[]>> {
    try {
      const selector = await this.getSelector();
      const templates = selector.listTemplates();
      return success(templates);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to list templates: ${message}`);
    }
  }

  async getTemplatesForType(projectType: string): Promise<AdapterResult<TemplateMetadata[]>> {
    try {
      if (!projectType) {
        return error('projectType is required');
      }
      const selector = await this.getSelector();
      const templates = selector.getTemplatesForType(projectType);
      return success(templates);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to get templates for type: ${message}`);
    }
  }

  async validateRequirements(template: TemplateMetadata): Promise<AdapterResult<boolean>> {
    try {
      if (!template) {
        return error('template is required');
      }
      const selector = await this.getSelector();
      const isValid = await selector.validateTemplateRequirements(template);
      return success(isValid);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to validate requirements: ${message}`);
    }
  }
}

/**
 * Adapter for CustomizationEngine class
 * Handles project customization based on templates and rules
 */
export class CustomizationEngineAdapter {
  private engineInstance: unknown = null;

  private async getEngine(): Promise<{
    customize: (content: string, context: TemplateContext, filePath?: string) => Promise<string>;
    customizeProject: (projectPath: string, context: TemplateContext) => Promise<void>;
  }> {
    if (!this.engineInstance) {
      try {
        const module = await loadComputerSetupModule('src/project-init/index.js');
        const CustomizationEngine = (module as { CustomizationEngine: new () => unknown }).CustomizationEngine;
        this.engineInstance = new CustomizationEngine();
      } catch {
        // Stub implementation with basic variable replacement
        this.engineInstance = {
          customize: async (content: string, context: TemplateContext) => {
            return content
              .replace(/\{\{PROJECT_NAME\}\}/g, context.project.name)
              .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, context.project.description)
              .replace(/\{\{PROJECT_TYPE\}\}/g, context.project.type)
              .replace(/\{\{AUTHOR\}\}/g, context.project.author);
          },
          customizeProject: async () => {
            throw new Error('CustomizationEngine not available. Install @wundr/computer-setup package.');
          },
        };
      }
    }
    return this.engineInstance as ReturnType<typeof this.getEngine> extends Promise<infer T> ? T : never;
  }

  async customize(content: string, context: TemplateContext, filePath?: string): Promise<AdapterResult<string>> {
    try {
      if (!content) {
        return error('content is required');
      }
      if (!context) {
        return error('context is required');
      }
      const engine = await this.getEngine();
      const customized = await engine.customize(content, context, filePath);
      return success(customized);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to customize content: ${message}`);
    }
  }

  async customizeProject(projectPath: string, context: TemplateContext): Promise<AdapterResult<void>> {
    try {
      if (!projectPath) {
        return error('projectPath is required');
      }
      if (!context) {
        return error('context is required');
      }
      const engine = await this.getEngine();
      await engine.customizeProject(projectPath, context);
      return success(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to customize project: ${message}`);
    }
  }
}

/**
 * Adapter for ValidationChecker class
 * Validates project setup and configuration
 */
export class ValidationCheckerAdapter {
  private checkerInstance: unknown = null;

  private async getChecker(): Promise<{
    validate: (projectPath: string) => Promise<ValidationReport>;
    autoFix: (projectPath: string) => Promise<void>;
  }> {
    if (!this.checkerInstance) {
      try {
        const module = await loadComputerSetupModule('src/project-init/index.js');
        const ValidationChecker = (module as { ValidationChecker: new () => unknown }).ValidationChecker;
        this.checkerInstance = new ValidationChecker();
      } catch {
        // Stub implementation
        this.checkerInstance = {
          validate: async (projectPath: string): Promise<ValidationReport> => {
            const fs = await import('fs');
            const path = await import('path');
            const results: ValidationResult[] = [];

            // Basic checks
            const claudeDir = path.join(projectPath, '.claude');
            const claudeMd = path.join(projectPath, 'CLAUDE.md');

            results.push({
              passed: fs.existsSync(claudeDir),
              category: 'Directory Structure',
              check: '.claude directory exists',
              message: fs.existsSync(claudeDir) ? 'Found' : 'Missing',
              severity: 'error',
              fixable: true,
            });

            results.push({
              passed: fs.existsSync(claudeMd),
              category: 'Required Files',
              check: 'CLAUDE.md exists',
              message: fs.existsSync(claudeMd) ? 'Found' : 'Missing',
              severity: 'error',
              fixable: false,
            });

            const passed = results.filter(r => r.passed).length;
            const failed = results.filter(r => !r.passed && r.severity === 'error').length;

            return {
              timestamp: new Date(),
              projectPath,
              totalChecks: results.length,
              passed,
              failed,
              warnings: results.filter(r => !r.passed && r.severity === 'warning').length,
              results,
              score: (passed / results.length) * 100,
            };
          },
          autoFix: async () => {
            throw new Error('ValidationChecker auto-fix not available. Install @wundr/computer-setup package.');
          },
        };
      }
    }
    return this.checkerInstance as ReturnType<typeof this.getChecker> extends Promise<infer T> ? T : never;
  }

  async validate(projectPath: string): Promise<AdapterResult<ValidationReport>> {
    try {
      if (!projectPath) {
        return error('projectPath is required');
      }
      const checker = await this.getChecker();
      const report = await checker.validate(projectPath);
      return success(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to validate project: ${message}`);
    }
  }

  async autoFix(projectPath: string): Promise<AdapterResult<void>> {
    try {
      if (!projectPath) {
        return error('projectPath is required');
      }
      const checker = await this.getChecker();
      await checker.autoFix(projectPath);
      return success(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to auto-fix issues: ${message}`);
    }
  }
}

/**
 * Adapter for ClaudeInstaller (ClaudeConfigInstaller functionality)
 * Handles Claude CLI, MCP servers, and agent installation
 */
export class ClaudeConfigInstallerAdapter {
  private installerInstance: unknown = null;

  private async getInstaller(): Promise<{
    isInstalled: () => Promise<boolean>;
    getVersion: () => Promise<string | null>;
    validate: () => Promise<boolean>;
    isSupported: (platform: SetupPlatform) => boolean;
    install: (profile: DeveloperProfile, platform: SetupPlatform) => Promise<void>;
    configure: (profile: DeveloperProfile, platform: SetupPlatform) => Promise<void>;
    getSteps: (profile: DeveloperProfile, platform: SetupPlatform) => { id: string; name: string; description: string }[];
  }> {
    if (!this.installerInstance) {
      try {
        const module = await loadComputerSetupModule('src/installers/claude-installer.js');
        this.installerInstance = (module as { default: unknown }).default;
      } catch {
        // Stub implementation using execSync to check Claude installation
        const { execSync } = await import('child_process');

        this.installerInstance = {
          isInstalled: async () => {
            try {
              execSync('claude --version', { stdio: 'ignore' });
              return true;
            } catch {
              return false;
            }
          },
          getVersion: async () => {
            try {
              return execSync('claude --version', { encoding: 'utf8' }).trim();
            } catch {
              return null;
            }
          },
          validate: async () => {
            try {
              execSync('claude --version', { stdio: 'ignore' });
              return true;
            } catch {
              return false;
            }
          },
          isSupported: (platform: SetupPlatform) => {
            return platform.os === 'darwin' || platform.os === 'linux';
          },
          install: async () => {
            throw new Error('Claude installation requires @wundr/computer-setup package.');
          },
          configure: async () => {
            throw new Error('Claude configuration requires @wundr/computer-setup package.');
          },
          getSteps: () => [
            { id: 'claude-cli', name: 'Install Claude CLI', description: 'Install Claude command-line interface' },
            { id: 'claude-config', name: 'Configure Claude', description: 'Setup Claude directory and configurations' },
            { id: 'mcp-servers', name: 'Install MCP Servers', description: 'Install and configure MCP servers' },
            { id: 'claude-agents', name: 'Setup Agents', description: 'Configure specialized agents' },
          ],
        };
      }
    }
    return this.installerInstance as ReturnType<typeof this.getInstaller> extends Promise<infer T> ? T : never;
  }

  async isInstalled(): Promise<AdapterResult<boolean>> {
    try {
      const installer = await this.getInstaller();
      const installed = await installer.isInstalled();
      return success(installed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to check installation: ${message}`);
    }
  }

  async getVersion(): Promise<AdapterResult<string | null>> {
    try {
      const installer = await this.getInstaller();
      const version = await installer.getVersion();
      return success(version);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to get version: ${message}`);
    }
  }

  async validate(): Promise<AdapterResult<boolean>> {
    try {
      const installer = await this.getInstaller();
      const isValid = await installer.validate();
      return success(isValid);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to validate installation: ${message}`);
    }
  }

  async isSupported(platform: SetupPlatform): Promise<AdapterResult<boolean>> {
    try {
      const installer = await this.getInstaller();
      const supported = installer.isSupported(platform);
      return success(supported);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to check platform support: ${message}`);
    }
  }

  async install(profile: DeveloperProfile, platform: SetupPlatform): Promise<AdapterResult<void>> {
    try {
      const installer = await this.getInstaller();
      await installer.install(profile, platform);
      return success(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to install Claude: ${message}`);
    }
  }

  async configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<AdapterResult<void>> {
    try {
      const installer = await this.getInstaller();
      await installer.configure(profile, platform);
      return success(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to configure Claude: ${message}`);
    }
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): AdapterResult<{ id: string; name: string; description: string }[]> {
    try {
      // Build steps dynamically based on profile and platform
      const steps: { id: string; name: string; description: string }[] = [
        { id: 'claude-cli', name: 'Install Claude CLI', description: 'Install Claude command-line interface' },
        { id: 'claude-config', name: 'Configure Claude', description: 'Setup Claude directory and configurations' },
      ];

      // Add MCP servers step - customize description based on profile preferences
      const mcpToolsList = profile.preferences?.aiTools?.mcpTools;
      const mcpDescription = mcpToolsList && mcpToolsList.length > 0
        ? `Install and configure MCP servers: ${mcpToolsList.slice(0, 3).join(', ')}${mcpToolsList.length > 3 ? '...' : ''}`
        : 'Install and configure MCP servers';
      steps.push({ id: 'mcp-servers', name: 'Install MCP Servers', description: mcpDescription });

      // Add agents step - customize based on profile's swarm agents
      const swarmAgentsList = profile.preferences?.aiTools?.swarmAgents;
      const agentsDescription = swarmAgentsList && swarmAgentsList.length > 0
        ? `Configure specialized agents: ${swarmAgentsList.slice(0, 3).join(', ')}${swarmAgentsList.length > 3 ? '...' : ''}`
        : 'Configure specialized agents';
      steps.push({ id: 'claude-agents', name: 'Setup Agents', description: agentsDescription });

      // Add platform-specific notes to CLI step description
      const cliStep = steps[0];
      if (cliStep) {
        if (platform.os === 'darwin') {
          cliStep.description = 'Install Claude CLI via Homebrew or npm';
        } else if (platform.os === 'linux') {
          cliStep.description = 'Install Claude CLI via npm or package manager';
        }
      }

      return success(steps);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to get steps: ${message}`);
    }
  }
}

/**
 * Adapter for backup and rollback operations
 * Provides backup and restore functionality for configurations
 */
export class BackupRollbackManagerAdapter {
  private backupDir: string;

  constructor(backupDir?: string) {
    this.backupDir = backupDir || `${process.env['HOME']}/.wundr-backups`;
  }

  async createBackup(sourcePath: string, backupName?: string): Promise<AdapterResult<{ backupId: string; path: string }>> {
    try {
      if (!sourcePath) {
        return error('sourcePath is required');
      }

      const fs = await import('fs-extra');
      const path = await import('path');

      const backupId = backupName || `backup-${Date.now()}`;
      const backupPath = path.join(this.backupDir, backupId);

      await fs.ensureDir(this.backupDir);
      await fs.copy(sourcePath, backupPath);

      const metadata = {
        id: backupId,
        sourcePath,
        createdAt: new Date().toISOString(),
      };
      await fs.writeJson(path.join(backupPath, '.backup-metadata.json'), metadata);

      return success({ backupId, path: backupPath });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to create backup: ${message}`);
    }
  }

  async restore(backupId: string, targetPath: string): Promise<AdapterResult<void>> {
    try {
      if (!backupId) {
        return error('backupId is required');
      }
      if (!targetPath) {
        return error('targetPath is required');
      }

      const fs = await import('fs-extra');
      const path = await import('path');

      const backupPath = path.join(this.backupDir, backupId);

      if (!(await fs.pathExists(backupPath))) {
        return error(`Backup not found: ${backupId}`);
      }

      await fs.copy(backupPath, targetPath, { overwrite: true });
      return success(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to restore backup: ${message}`);
    }
  }

  async listBackups(): Promise<AdapterResult<{ id: string; sourcePath: string; createdAt: string }[]>> {
    try {
      const fs = await import('fs-extra');
      const path = await import('path');

      if (!(await fs.pathExists(this.backupDir))) {
        return success([]);
      }

      const entries = await fs.readdir(this.backupDir, { withFileTypes: true });
      const backups: { id: string; sourcePath: string; createdAt: string }[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metadataPath = path.join(this.backupDir, entry.name, '.backup-metadata.json');
          if (await fs.pathExists(metadataPath)) {
            const metadata = await fs.readJson(metadataPath);
            backups.push({
              id: metadata.id,
              sourcePath: metadata.sourcePath,
              createdAt: metadata.createdAt,
            });
          }
        }
      }

      return success(backups);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to list backups: ${message}`);
    }
  }

  async deleteBackup(backupId: string): Promise<AdapterResult<void>> {
    try {
      if (!backupId) {
        return error('backupId is required');
      }

      const fs = await import('fs-extra');
      const path = await import('path');

      const backupPath = path.join(this.backupDir, backupId);

      if (!(await fs.pathExists(backupPath))) {
        return error(`Backup not found: ${backupId}`);
      }

      await fs.remove(backupPath);
      return success(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to delete backup: ${message}`);
    }
  }
}

/**
 * Adapter for ProjectInitOrchestrator
 * Combines all initialization components into a single interface
 */
export class ProjectInitOrchestratorAdapter {
  private orchestratorInstance: unknown = null;

  private async getOrchestrator(): Promise<{
    initializeProject: (options: { projectPath: string; projectName: string; interactive?: boolean; autoFix?: boolean }) => Promise<void>;
    setupExistingProject: (projectPath: string) => Promise<void>;
    validateProject: (projectPath: string, autoFix?: boolean) => Promise<void>;
    updateTemplates: (projectPath: string) => Promise<void>;
  }> {
    if (!this.orchestratorInstance) {
      try {
        const module = await loadComputerSetupModule('src/project-init/index.js');
        const ProjectInitOrchestrator = (module as { ProjectInitOrchestrator: new () => unknown }).ProjectInitOrchestrator;
        this.orchestratorInstance = new ProjectInitOrchestrator();
      } catch {
        // Stub implementation
        this.orchestratorInstance = {
          initializeProject: async () => {
            throw new Error('ProjectInitOrchestrator not available. Install @wundr/computer-setup package.');
          },
          setupExistingProject: async () => {
            throw new Error('ProjectInitOrchestrator not available. Install @wundr/computer-setup package.');
          },
          validateProject: async () => {
            throw new Error('ProjectInitOrchestrator not available. Install @wundr/computer-setup package.');
          },
          updateTemplates: async () => {
            throw new Error('ProjectInitOrchestrator not available. Install @wundr/computer-setup package.');
          },
        };
      }
    }
    return this.orchestratorInstance as ReturnType<typeof this.getOrchestrator> extends Promise<infer T> ? T : never;
  }

  async initializeProject(options: { projectPath: string; projectName: string; interactive?: boolean; autoFix?: boolean }): Promise<AdapterResult<void>> {
    try {
      if (!options.projectPath) {
        return error('projectPath is required');
      }
      if (!options.projectName) {
        return error('projectName is required');
      }
      const orchestrator = await this.getOrchestrator();
      await orchestrator.initializeProject(options);
      return success(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to initialize project: ${message}`);
    }
  }

  async setupExistingProject(projectPath: string): Promise<AdapterResult<void>> {
    try {
      if (!projectPath) {
        return error('projectPath is required');
      }
      const orchestrator = await this.getOrchestrator();
      await orchestrator.setupExistingProject(projectPath);
      return success(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to setup existing project: ${message}`);
    }
  }

  async validateProject(projectPath: string, autoFix?: boolean): Promise<AdapterResult<void>> {
    try {
      if (!projectPath) {
        return error('projectPath is required');
      }
      const orchestrator = await this.getOrchestrator();
      await orchestrator.validateProject(projectPath, autoFix);
      return success(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to validate project: ${message}`);
    }
  }

  async updateTemplates(projectPath: string): Promise<AdapterResult<void>> {
    try {
      if (!projectPath) {
        return error('projectPath is required');
      }
      const orchestrator = await this.getOrchestrator();
      await orchestrator.updateTemplates(projectPath);
      return success(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(`Failed to update templates: ${message}`);
    }
  }
}
