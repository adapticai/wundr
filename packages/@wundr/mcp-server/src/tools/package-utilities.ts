/**
 * MCP Tools for @wundr/computer-setup Package Utilities
 *
 * Exposes computer-setup package capabilities as MCP tools for use with Claude Code.
 * These tools enable project initialization, template management, validation,
 * and Claude configuration through the MCP protocol.
 *
 * @module package-utilities
 */

import { z } from 'zod';
import {
  ProjectInitializerAdapter,
  TemplateSelectorAdapter,
  CustomizationEngineAdapter,
  ValidationCheckerAdapter,
  ClaudeConfigInstallerAdapter,
  BackupRollbackManagerAdapter,
  ProjectInitOrchestratorAdapter,
  ProjectInitOptions,
  TemplateSelectionCriteria,
} from './adapters.js';

/**
 * MCP Tool definition interface
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
  handler: (input: unknown) => Promise<unknown>;
}

// ============================================================================
// Schema Definitions
// ============================================================================

const ProjectTypeSchema = z.enum([
  'node',
  'react',
  'vue',
  'python',
  'go',
  'rust',
  'java',
  'monorepo',
]);

const ScaleSchema = z.enum(['small', 'medium', 'large', 'enterprise']);

const ProjectInitInputSchema = z.object({
  projectPath: z.string().describe('Absolute path to the project directory'),
  projectName: z.string().describe('Name of the project'),
  projectType: ProjectTypeSchema.describe('Type of project to initialize'),
  includeClaudeSetup: z.boolean().default(true).describe('Include .claude directory setup'),
  includeAgents: z.boolean().default(true).describe('Include agent templates'),
  includeHooks: z.boolean().default(true).describe('Include automation hooks'),
  includeGitWorktree: z.boolean().default(false).describe('Include git-worktree configuration'),
  includeTemplates: z.boolean().default(true).describe('Include project templates'),
  force: z.boolean().default(false).describe('Force overwrite existing files'),
});

const TemplateSelectionInputSchema = z.object({
  projectType: z.string().describe('Type of project (node, react, vue, python, etc.)'),
  framework: z.string().optional().describe('Framework to use (express, nextjs, etc.)'),
  features: z.array(z.string()).optional().describe('Features to include (typescript, testing, cicd, etc.)'),
  scale: ScaleSchema.optional().describe('Project scale (small, medium, large, enterprise)'),
  teamSize: z.number().optional().describe('Expected team size'),
  useTypeScript: z.boolean().optional().describe('Use TypeScript'),
  useTesting: z.boolean().optional().describe('Include testing setup'),
  useCI: z.boolean().optional().describe('Include CI/CD configuration'),
});

const TemplateIdInputSchema = z.object({
  templateId: z.string().describe('Template identifier (e.g., node-basic, react-frontend)'),
});

const ProjectPathInputSchema = z.object({
  projectPath: z.string().describe('Absolute path to the project directory'),
});

const ValidateProjectInputSchema = z.object({
  projectPath: z.string().describe('Absolute path to the project directory'),
  autoFix: z.boolean().default(false).describe('Automatically fix fixable issues'),
});

const CustomizeContentInputSchema = z.object({
  content: z.string().describe('Content to customize with template variables'),
  projectName: z.string().describe('Project name'),
  projectDescription: z.string().default('Project description').describe('Project description'),
  projectType: ProjectTypeSchema.describe('Project type'),
  authorName: z.string().default('Developer').describe('Author name'),
  authorEmail: z.string().default('dev@example.com').describe('Author email'),
  filePath: z.string().optional().describe('Optional file path for file-specific customizations'),
});

const BackupInputSchema = z.object({
  sourcePath: z.string().describe('Path to backup'),
  backupName: z.string().optional().describe('Optional name for the backup'),
});

const RestoreInputSchema = z.object({
  backupId: z.string().describe('Backup identifier to restore'),
  targetPath: z.string().describe('Target path for restoration'),
});

const BackupIdInputSchema = z.object({
  backupId: z.string().describe('Backup identifier'),
});

const ClaudeInstallInputSchema = z.object({
  profileName: z.string().default('Developer').describe('Developer profile name'),
  profileEmail: z.string().default('dev@example.com').describe('Developer email'),
  profileRole: z.string().default('developer').describe('Developer role'),
});

const SetupExistingProjectInputSchema = z.object({
  projectPath: z.string().describe('Absolute path to the existing project'),
});

const InitializeProjectInputSchema = z.object({
  projectPath: z.string().describe('Absolute path to the project directory'),
  projectName: z.string().describe('Name of the project'),
  interactive: z.boolean().default(false).describe('Use interactive mode for template selection'),
  autoFix: z.boolean().default(true).describe('Automatically fix validation issues'),
});

// ============================================================================
// Adapter Instances
// ============================================================================

const projectInitializer = new ProjectInitializerAdapter();
const templateSelector = new TemplateSelectorAdapter();
const customizationEngine = new CustomizationEngineAdapter();
const validationChecker = new ValidationCheckerAdapter();
const claudeConfigInstaller = new ClaudeConfigInstallerAdapter();
const backupManager = new BackupRollbackManagerAdapter();
const projectOrchestrator = new ProjectInitOrchestratorAdapter();

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Project Initializer Tools
 */

export const projectInitialize: MCPTool = {
  name: 'project_initialize',
  description: `Initialize a new project with .claude directory, agents, hooks, and templates.

Example usage:
- Initialize a Node.js project: { "projectPath": "/path/to/project", "projectName": "my-api", "projectType": "node" }
- Initialize a React project with testing: { "projectPath": "/path/to/project", "projectName": "my-app", "projectType": "react", "includeAgents": true }
- Force reinitialize: { "projectPath": "/path/to/project", "projectName": "my-app", "projectType": "node", "force": true }`,
  inputSchema: ProjectInitInputSchema,
  handler: async (input) => {
    const validated = ProjectInitInputSchema.parse(input);
    const options: ProjectInitOptions = {
      projectPath: validated.projectPath,
      projectName: validated.projectName,
      projectType: validated.projectType,
      includeClaudeSetup: validated.includeClaudeSetup,
      includeAgents: validated.includeAgents,
      includeHooks: validated.includeHooks,
      includeGitWorktree: validated.includeGitWorktree,
      includeTemplates: validated.includeTemplates,
      force: validated.force,
    };
    return await projectInitializer.initialize(options);
  },
};

export const projectGetSupportedTypes: MCPTool = {
  name: 'project_get_supported_types',
  description: 'Get list of supported project types for initialization.',
  inputSchema: z.object({}),
  handler: async () => {
    return {
      success: true,
      data: projectInitializer.getSupportedProjectTypes(),
      timestamp: new Date().toISOString(),
    };
  },
};

/**
 * Template Selector Tools
 */

export const templateSelect: MCPTool = {
  name: 'template_select',
  description: `Select appropriate templates based on project criteria.

Example usage:
- Select React templates: { "projectType": "react", "features": ["typescript", "testing"], "scale": "medium" }
- Select enterprise Node.js: { "projectType": "node", "scale": "enterprise", "useTypeScript": true }`,
  inputSchema: TemplateSelectionInputSchema,
  handler: async (input) => {
    const validated = TemplateSelectionInputSchema.parse(input);
    const criteria: TemplateSelectionCriteria = {
      projectType: validated.projectType,
      framework: validated.framework,
      features: validated.features,
      scale: validated.scale,
      teamSize: validated.teamSize,
      useTypeScript: validated.useTypeScript,
      useTesting: validated.useTesting,
      useCI: validated.useCI,
    };
    return await templateSelector.selectTemplates(criteria);
  },
};

export const templateGet: MCPTool = {
  name: 'template_get',
  description: `Get a specific template by ID.

Example usage:
- Get node-basic template: { "templateId": "node-basic" }
- Get react-frontend template: { "templateId": "react-frontend" }

Available template IDs: node-basic, react-frontend, nextjs-fullstack, monorepo-workspace, python-app, go-microservice, rust-app, enterprise-backend`,
  inputSchema: TemplateIdInputSchema,
  handler: async (input) => {
    const validated = TemplateIdInputSchema.parse(input);
    return await templateSelector.getTemplate(validated.templateId);
  },
};

export const templateList: MCPTool = {
  name: 'template_list',
  description: 'List all available project templates with their metadata.',
  inputSchema: z.object({}),
  handler: async () => {
    return await templateSelector.listTemplates();
  },
};

export const templateGetForType: MCPTool = {
  name: 'template_get_for_type',
  description: `Get templates suitable for a specific project type.

Example usage:
- Get Node.js templates: { "projectType": "node" }
- Get React templates: { "projectType": "react" }`,
  inputSchema: z.object({
    projectType: z.string().describe('Project type to get templates for'),
  }),
  handler: async (input) => {
    const validated = z.object({ projectType: z.string() }).parse(input);
    return await templateSelector.getTemplatesForType(validated.projectType);
  },
};

/**
 * Customization Engine Tools
 */

export const customizationApply: MCPTool = {
  name: 'customization_apply',
  description: `Apply template customizations to content with project-specific variables.

Example usage:
- Customize content: { "content": "Hello {{PROJECT_NAME}}", "projectName": "my-app", "projectType": "node" }`,
  inputSchema: CustomizeContentInputSchema,
  handler: async (input) => {
    const validated = CustomizeContentInputSchema.parse(input);
    const context = {
      profile: {
        name: validated.authorName,
        email: validated.authorEmail,
        role: 'developer',
        team: 'Engineering',
        preferences: { shell: 'zsh' as const },
        tools: { packageManagers: { pnpm: true } },
      },
      project: {
        name: validated.projectName,
        description: validated.projectDescription,
        version: '1.0.0',
        type: validated.projectType as 'node' | 'react' | 'vue' | 'python' | 'go' | 'rust' | 'java',
        packageManager: 'pnpm' as const,
        license: 'MIT',
        author: validated.authorName,
      },
      platform: {
        os: process.platform as 'darwin' | 'linux' | 'win32',
        arch: process.arch as 'x64' | 'arm64',
        nodeVersion: process.version.replace('v', ''),
        shell: 'zsh' as const,
      },
    };
    return await customizationEngine.customize(
      validated.content,
      context,
      validated.filePath
    );
  },
};

export const customizationApplyToProject: MCPTool = {
  name: 'customization_apply_to_project',
  description: `Apply template customizations to an entire project directory.

Example usage:
- Customize project: { "projectPath": "/path/to/project", "projectName": "my-app", "projectType": "react" }`,
  inputSchema: z.object({
    projectPath: z.string().describe('Project path'),
    projectName: z.string().describe('Project name'),
    projectDescription: z.string().default('Project description'),
    projectType: ProjectTypeSchema,
    authorName: z.string().default('Developer'),
    authorEmail: z.string().default('dev@example.com'),
  }),
  handler: async (input) => {
    const validated = z
      .object({
        projectPath: z.string(),
        projectName: z.string(),
        projectDescription: z.string().default('Project description'),
        projectType: ProjectTypeSchema,
        authorName: z.string().default('Developer'),
        authorEmail: z.string().default('dev@example.com'),
      })
      .parse(input);

    const context = {
      profile: {
        name: validated.authorName,
        email: validated.authorEmail,
        role: 'developer',
        team: 'Engineering',
        preferences: { shell: 'zsh' as const },
        tools: { packageManagers: { pnpm: true } },
      },
      project: {
        name: validated.projectName,
        description: validated.projectDescription,
        version: '1.0.0',
        type: validated.projectType as 'node' | 'react' | 'vue' | 'python' | 'go' | 'rust' | 'java',
        packageManager: 'pnpm' as const,
        license: 'MIT',
        author: validated.authorName,
      },
      platform: {
        os: process.platform as 'darwin' | 'linux' | 'win32',
        arch: process.arch as 'x64' | 'arm64',
        nodeVersion: process.version.replace('v', ''),
        shell: 'zsh' as const,
      },
    };
    return await customizationEngine.customizeProject(validated.projectPath, context);
  },
};

/**
 * Validation Checker Tools
 */

export const validationCheck: MCPTool = {
  name: 'validation_check',
  description: `Run comprehensive validation checks on a project setup.

Example usage:
- Validate project: { "projectPath": "/path/to/project" }
- Validate and auto-fix: { "projectPath": "/path/to/project", "autoFix": true }

Returns validation report with:
- Total checks performed
- Passed/failed/warning counts
- Individual check results by category
- Overall score percentage`,
  inputSchema: ValidateProjectInputSchema,
  handler: async (input) => {
    const validated = ValidateProjectInputSchema.parse(input);
    if (validated.autoFix) {
      return await validationChecker.autoFix(validated.projectPath);
    }
    return await validationChecker.validate(validated.projectPath);
  },
};

export const validationAutoFix: MCPTool = {
  name: 'validation_auto_fix',
  description: `Automatically fix fixable issues in a project setup.

Example usage:
- Fix issues: { "projectPath": "/path/to/project" }`,
  inputSchema: ProjectPathInputSchema,
  handler: async (input) => {
    const validated = ProjectPathInputSchema.parse(input);
    return await validationChecker.autoFix(validated.projectPath);
  },
};

/**
 * Backup and Rollback Tools
 */

export const backupCreate: MCPTool = {
  name: 'backup_create',
  description: `Create a backup of the specified path before making changes.

Example usage:
- Create backup: { "sourcePath": "/path/to/project" }
- Create named backup: { "sourcePath": "/path/to/project", "backupName": "pre-migration" }`,
  inputSchema: BackupInputSchema,
  handler: async (input) => {
    const validated = BackupInputSchema.parse(input);
    return await backupManager.createBackup(validated.sourcePath, validated.backupName);
  },
};

export const backupRestore: MCPTool = {
  name: 'backup_restore',
  description: `Restore from a previously created backup.

Example usage:
- Restore backup: { "backupId": "backup-1234567890", "targetPath": "/path/to/restore" }`,
  inputSchema: RestoreInputSchema,
  handler: async (input) => {
    const validated = RestoreInputSchema.parse(input);
    return await backupManager.restore(validated.backupId, validated.targetPath);
  },
};

export const backupList: MCPTool = {
  name: 'backup_list',
  description: 'List all available backups with their metadata.',
  inputSchema: z.object({}),
  handler: async () => {
    return await backupManager.listBackups();
  },
};

export const backupDelete: MCPTool = {
  name: 'backup_delete',
  description: `Delete a backup by ID.

Example usage:
- Delete backup: { "backupId": "backup-1234567890" }`,
  inputSchema: BackupIdInputSchema,
  handler: async (input) => {
    const validated = BackupIdInputSchema.parse(input);
    return await backupManager.deleteBackup(validated.backupId);
  },
};

/**
 * Claude Config Installer Tools
 */

export const claudeIsInstalled: MCPTool = {
  name: 'claude_is_installed',
  description: 'Check if Claude CLI and Claude Flow are installed.',
  inputSchema: z.object({}),
  handler: async () => {
    return await claudeConfigInstaller.isInstalled();
  },
};

export const claudeGetVersion: MCPTool = {
  name: 'claude_get_version',
  description: 'Get the installed Claude CLI version.',
  inputSchema: z.object({}),
  handler: async () => {
    return await claudeConfigInstaller.getVersion();
  },
};

export const claudeValidate: MCPTool = {
  name: 'claude_validate',
  description: 'Validate Claude installation and configuration.',
  inputSchema: z.object({}),
  handler: async () => {
    return await claudeConfigInstaller.validate();
  },
};

export const claudeGetSteps: MCPTool = {
  name: 'claude_get_steps',
  description: 'Get Claude installation steps for the current platform.',
  inputSchema: ClaudeInstallInputSchema,
  handler: async (input) => {
    const validated = ClaudeInstallInputSchema.parse(input);
    const profile = {
      name: validated.profileName,
      email: validated.profileEmail,
      role: validated.profileRole,
      team: 'Engineering',
      preferences: { shell: 'zsh' },
      tools: { packageManagers: { pnpm: true } },
    };
    const platform = {
      os: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    };
    return claudeConfigInstaller.getSteps(profile as never, platform as never);
  },
};

/**
 * Project Orchestrator Tools (High-level operations)
 */

export const orchestratorInitialize: MCPTool = {
  name: 'orchestrator_initialize',
  description: `Initialize a new project with full SPARC-compliant setup including templates, agents, and validation.

Example usage:
- Initialize new project: { "projectPath": "/path/to/project", "projectName": "my-app" }
- Initialize with auto-fix: { "projectPath": "/path/to/project", "projectName": "my-app", "autoFix": true }

This is the recommended high-level tool for project initialization.`,
  inputSchema: InitializeProjectInputSchema,
  handler: async (input) => {
    const validated = InitializeProjectInputSchema.parse(input);
    return await projectOrchestrator.initializeProject({
      projectPath: validated.projectPath,
      projectName: validated.projectName,
      interactive: validated.interactive,
      autoFix: validated.autoFix,
    });
  },
};

export const orchestratorSetupExisting: MCPTool = {
  name: 'orchestrator_setup_existing',
  description: `Add .claude configuration to an existing project without modifying source code.

Example usage:
- Setup existing project: { "projectPath": "/path/to/existing/project" }

This tool:
1. Detects project type from package.json or other indicators
2. Creates appropriate .claude directory structure
3. Adds agent templates based on project type
4. Configures hooks and conventions`,
  inputSchema: SetupExistingProjectInputSchema,
  handler: async (input) => {
    const validated = SetupExistingProjectInputSchema.parse(input);
    return await projectOrchestrator.setupExistingProject(validated.projectPath);
  },
};

export const orchestratorValidate: MCPTool = {
  name: 'orchestrator_validate',
  description: `Validate project setup and optionally auto-fix issues.

Example usage:
- Validate only: { "projectPath": "/path/to/project", "autoFix": false }
- Validate and fix: { "projectPath": "/path/to/project", "autoFix": true }`,
  inputSchema: ValidateProjectInputSchema,
  handler: async (input) => {
    const validated = ValidateProjectInputSchema.parse(input);
    return await projectOrchestrator.validateProject(
      validated.projectPath,
      validated.autoFix
    );
  },
};

export const orchestratorUpdateTemplates: MCPTool = {
  name: 'orchestrator_update_templates',
  description: `Update project templates to the latest versions.

Example usage:
- Update templates: { "projectPath": "/path/to/project" }`,
  inputSchema: ProjectPathInputSchema,
  handler: async (input) => {
    const validated = ProjectPathInputSchema.parse(input);
    return await projectOrchestrator.updateTemplates(validated.projectPath);
  },
};

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * All available MCP tools for package utilities
 */
export const packageUtilityTools: MCPTool[] = [
  // Project Initializer
  projectInitialize,
  projectGetSupportedTypes,

  // Template Selector
  templateSelect,
  templateGet,
  templateList,
  templateGetForType,

  // Customization Engine
  customizationApply,
  customizationApplyToProject,

  // Validation Checker
  validationCheck,
  validationAutoFix,

  // Backup and Rollback
  backupCreate,
  backupRestore,
  backupList,
  backupDelete,

  // Claude Config Installer
  claudeIsInstalled,
  claudeGetVersion,
  claudeValidate,
  claudeGetSteps,

  // Project Orchestrator
  orchestratorInitialize,
  orchestratorSetupExisting,
  orchestratorValidate,
  orchestratorUpdateTemplates,
];

/**
 * Get tool by name
 */
export function getToolByName(name: string): MCPTool | undefined {
  return packageUtilityTools.find((tool) => tool.name === name);
}

/**
 * Get all tool names
 */
export function getToolNames(): string[] {
  return packageUtilityTools.map((tool) => tool.name);
}

/**
 * Mapping table: Package Class to MCP Tool names
 */
export const packageClassToToolMapping = {
  ProjectInitializer: ['project_initialize', 'project_get_supported_types'],
  TemplateSelector: ['template_select', 'template_get', 'template_list', 'template_get_for_type'],
  CustomizationEngine: ['customization_apply', 'customization_apply_to_project'],
  ValidationChecker: ['validation_check', 'validation_auto_fix'],
  BackupRollbackManager: ['backup_create', 'backup_restore', 'backup_list', 'backup_delete'],
  ClaudeConfigInstaller: ['claude_is_installed', 'claude_get_version', 'claude_validate', 'claude_get_steps'],
  ProjectInitOrchestrator: [
    'orchestrator_initialize',
    'orchestrator_setup_existing',
    'orchestrator_validate',
    'orchestrator_update_templates',
  ],
};

export default packageUtilityTools;
