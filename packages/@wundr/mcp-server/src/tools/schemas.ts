/**
 * JSON Schema definitions for all Wundr MCP tools
 * These schemas define the input parameters for each CLI command wrapper
 *
 * @module @wundr/mcp-server/tools/schemas
 */

import { z } from 'zod';

// ============================================================================
// Common Schema Types
// ============================================================================

/**
 * Common options shared across multiple tools
 */
export const CommonOptionsSchema = z.object({
  verbose: z.boolean().optional().describe('Enable verbose output'),
  dryRun: z.boolean().optional().describe('Show what would be done without making changes'),
  format: z.enum(['json', 'table', 'text']).optional().describe('Output format'),
});

// ============================================================================
// Computer Setup Tool Schemas
// ============================================================================

/**
 * Schema for computer-setup main command
 */
export const ComputerSetupSchema = z.object({
  subcommand: z.enum(['run', 'resume', 'validate', 'doctor', 'install', 'profile', 'team', 'backup', 'rollback', 'claude-config']).optional().default('run').describe('Subcommand to execute'),
  profile: z.enum(['frontend', 'backend', 'fullstack', 'devops', 'ml']).optional().describe('Developer profile to use'),
  team: z.string().optional().describe('Team identifier for team-specific configurations'),
  mode: z.enum(['interactive', 'automated', 'minimal']).optional().default('automated').describe('Setup mode'),
  skipExisting: z.boolean().optional().describe('Skip tools that are already installed'),
  parallel: z.boolean().optional().describe('Install tools in parallel where possible'),
  report: z.boolean().optional().describe('Generate detailed setup report'),
  dryRun: z.boolean().optional().describe('Show what would be installed without making changes'),
});

export type ComputerSetupInput = z.infer<typeof ComputerSetupSchema>;

/**
 * Schema for computer-setup claude-config subcommand
 */
export const ClaudeConfigSchema = z.object({
  skipBackup: z.boolean().optional().describe('Skip backup creation'),
  overwrite: z.boolean().optional().describe('Overwrite existing configurations'),
  verbose: z.boolean().optional().describe('Show detailed output'),
  dryRun: z.boolean().optional().describe('Show what would be installed'),
});

export type ClaudeConfigInput = z.infer<typeof ClaudeConfigSchema>;

/**
 * Schema for computer-setup backup subcommand
 */
export const BackupSchema = z.object({
  action: z.enum(['list', 'create', 'verify', 'cleanup']).describe('Backup action to perform'),
  backupId: z.string().optional().describe('Backup ID for verify action'),
});

export type BackupInput = z.infer<typeof BackupSchema>;

/**
 * Schema for computer-setup rollback subcommand
 */
export const RollbackSchema = z.object({
  backupId: z.string().describe('Backup ID to rollback to'),
  component: z.string().optional().describe('Specific component to rollback'),
  force: z.boolean().optional().describe('Force rollback without confirmation'),
});

export type RollbackInput = z.infer<typeof RollbackSchema>;

// ============================================================================
// Project Init Tool Schemas
// ============================================================================

/**
 * Schema for project-init command
 */
export const ProjectInitSchema = z.object({
  name: z.string().optional().describe('Project name'),
  template: z.enum(['default', 'monorepo', 'frontend', 'backend', 'fullstack', 'api', 'library']).optional().default('default').describe('Project template to use'),
  skipGit: z.boolean().optional().describe('Skip git initialization'),
  skipInstall: z.boolean().optional().describe('Skip dependency installation'),
  monorepo: z.boolean().optional().describe('Initialize as monorepo'),
  directory: z.string().optional().describe('Directory to create project in'),
});

export type ProjectInitInput = z.infer<typeof ProjectInitSchema>;

// ============================================================================
// Claude Setup Tool Schemas
// ============================================================================

/**
 * Schema for claude-setup consolidated command
 */
export const ClaudeSetupSchema = z.object({
  subcommand: z.enum(['install', 'mcp', 'agents', 'validate', 'extension', 'optimize']).optional().default('install').describe('Subcommand to execute'),
  skipChrome: z.boolean().optional().describe('Skip Chrome installation'),
  skipMcp: z.boolean().optional().describe('Skip MCP tools installation'),
  skipAgents: z.boolean().optional().describe('Skip agent configuration'),
  tool: z.string().optional().describe('Specific MCP tool to install (firecrawl, context7, playwright, browser, sequentialthinking)'),
  profile: z.enum(['frontend', 'backend', 'fullstack', 'devops']).optional().describe('Profile-specific agents to configure'),
  agents: z.string().optional().describe('Comma-separated list of agents to enable'),
  fix: z.boolean().optional().describe('Attempt to fix validation issues'),
  force: z.boolean().optional().describe('Force reinstallation'),
});

export type ClaudeSetupInput = z.infer<typeof ClaudeSetupSchema>;

// ============================================================================
// Drift Detection Tool Schemas
// ============================================================================

/**
 * Schema for drift-detection command
 */
export const DriftDetectionSchema = z.object({
  action: z.enum(['check', 'baseline', 'trends', 'report']).describe('Drift detection action'),
  path: z.string().optional().describe('Path to analyze for drift'),
  baselineId: z.string().optional().describe('Baseline ID for comparison'),
  threshold: z.number().optional().describe('Drift threshold percentage'),
  categories: z.array(z.string()).optional().describe('Categories to check (quality, security, performance)'),
  format: z.enum(['json', 'table', 'markdown']).optional().default('table').describe('Output format'),
});

export type DriftDetectionInput = z.infer<typeof DriftDetectionSchema>;

// ============================================================================
// Pattern Standardize Tool Schemas
// ============================================================================

/**
 * Schema for pattern-standardize command
 */
export const PatternStandardizeSchema = z.object({
  action: z.enum(['fix', 'review', 'list', 'configure']).describe('Pattern standardization action'),
  pattern: z.enum(['error-handling', 'import-ordering', 'naming-conventions', 'logging', 'all']).optional().describe('Pattern type to standardize'),
  path: z.string().optional().describe('Path to analyze and fix'),
  autoFix: z.boolean().optional().describe('Automatically fix detected issues'),
  dryRun: z.boolean().optional().describe('Show what would be changed without making changes'),
  severity: z.enum(['error', 'warning', 'info']).optional().describe('Minimum severity level'),
});

export type PatternStandardizeInput = z.infer<typeof PatternStandardizeSchema>;

// ============================================================================
// Monorepo Manage Tool Schemas
// ============================================================================

/**
 * Schema for monorepo-manage command
 */
export const MonorepoManageSchema = z.object({
  action: z.enum(['init', 'add-package', 'check-circular', 'sync-versions', 'list-packages', 'graph']).describe('Monorepo management action'),
  packageName: z.string().optional().describe('Package name for add-package action'),
  packageType: z.enum(['library', 'app', 'tool', 'plugin']).optional().describe('Type of package to create'),
  template: z.string().optional().describe('Template to use for new package'),
  scope: z.string().optional().describe('Package scope (e.g., @wundr)'),
  format: z.enum(['json', 'table', 'graph']).optional().default('table').describe('Output format'),
});

export type MonorepoManageInput = z.infer<typeof MonorepoManageSchema>;

// ============================================================================
// Governance Report Tool Schemas
// ============================================================================

/**
 * Schema for governance-report command
 */
export const GovernanceReportSchema = z.object({
  reportType: z.enum(['weekly', 'monthly', 'compliance', 'quality', 'security', 'custom']).describe('Type of report to generate'),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional().default('weekly').describe('Report period'),
  startDate: z.string().optional().describe('Start date for custom period (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date for custom period (YYYY-MM-DD)'),
  output: z.string().optional().describe('Output file path'),
  format: z.enum(['json', 'markdown', 'html', 'pdf']).optional().default('markdown').describe('Report format'),
  includeMetrics: z.array(z.string()).optional().describe('Specific metrics to include'),
});

export type GovernanceReportInput = z.infer<typeof GovernanceReportSchema>;

// ============================================================================
// Dependency Analyze Tool Schemas
// ============================================================================

/**
 * Schema for dependency-analyze command
 */
export const DependencyAnalyzeSchema = z.object({
  action: z.enum(['circular', 'unused', 'outdated', 'security', 'graph', 'all']).describe('Dependency analysis action'),
  path: z.string().optional().describe('Path to analyze'),
  depth: z.number().optional().describe('Depth of dependency analysis'),
  includeDevDeps: z.boolean().optional().describe('Include dev dependencies in analysis'),
  format: z.enum(['json', 'table', 'graph', 'dot']).optional().default('table').describe('Output format'),
  output: z.string().optional().describe('Output file path for graph/dot formats'),
});

export type DependencyAnalyzeInput = z.infer<typeof DependencyAnalyzeSchema>;

// ============================================================================
// Test Baseline Tool Schemas
// ============================================================================

/**
 * Schema for test-baseline command
 */
export const TestBaselineSchema = z.object({
  action: z.enum(['create', 'compare', 'update', 'report']).describe('Test baseline action'),
  baselineId: z.string().optional().describe('Baseline ID for comparison/update'),
  path: z.string().optional().describe('Path to test files'),
  coverageThreshold: z.number().optional().describe('Minimum coverage threshold percentage'),
  failOnDecrease: z.boolean().optional().describe('Fail if coverage decreases'),
  format: z.enum(['json', 'table', 'markdown']).optional().default('table').describe('Output format'),
  output: z.string().optional().describe('Output file path'),
});

export type TestBaselineInput = z.infer<typeof TestBaselineSchema>;

// ============================================================================
// Schema Registry Export
// ============================================================================

/**
 * Registry of all tool schemas with metadata
 */
export const ToolSchemas = {
  'computer-setup': {
    schema: ComputerSetupSchema,
    description: 'Set up a new developer machine with all required tools and configurations',
    category: 'setup',
  },
  'claude-config': {
    schema: ClaudeConfigSchema,
    description: 'Install Claude Code configuration files',
    category: 'setup',
  },
  'backup': {
    schema: BackupSchema,
    description: 'Manage configuration backups',
    category: 'setup',
  },
  'rollback': {
    schema: RollbackSchema,
    description: 'Rollback to a previous configuration backup',
    category: 'setup',
  },
  'project-init': {
    schema: ProjectInitSchema,
    description: 'Initialize a new Wundr project with template selection',
    category: 'project',
  },
  'claude-setup': {
    schema: ClaudeSetupSchema,
    description: 'Setup Claude Code, Claude Flow, and MCP tools',
    category: 'setup',
  },
  'drift-detection': {
    schema: DriftDetectionSchema,
    description: 'Monitor code quality drift and create baselines',
    category: 'governance',
  },
  'pattern-standardize': {
    schema: PatternStandardizeSchema,
    description: 'Auto-fix code patterns to meet standards',
    category: 'governance',
  },
  'monorepo-manage': {
    schema: MonorepoManageSchema,
    description: 'Manage monorepo packages and dependencies',
    category: 'project',
  },
  'governance-report': {
    schema: GovernanceReportSchema,
    description: 'Generate governance and compliance reports',
    category: 'governance',
  },
  'dependency-analyze': {
    schema: DependencyAnalyzeSchema,
    description: 'Analyze project dependencies for issues',
    category: 'analysis',
  },
  'test-baseline': {
    schema: TestBaselineSchema,
    description: 'Manage test coverage baselines',
    category: 'testing',
  },
} as const;

export type ToolName = keyof typeof ToolSchemas;

/**
 * Convert Zod schema to JSON Schema for MCP tool registration
 */
export function zodToJsonSchema(zodSchema: z.ZodType<any>): Record<string, unknown> {
  // Basic conversion - in production, use zod-to-json-schema package
  const shape = (zodSchema as z.ZodObject<any>)._def.shape?.();
  if (!shape) {
    return { type: 'object', properties: {} };
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodValue = value as z.ZodType<any>;
    const def = zodValue._def as any;

    let propertySchema: Record<string, unknown> = {};

    // Handle optional wrapper
    const isOptional = def.typeName === 'ZodOptional';
    const innerDef = isOptional ? def.innerType._def : def;

    // Get type info
    switch (innerDef.typeName) {
      case 'ZodString':
        propertySchema = { type: 'string' };
        break;
      case 'ZodNumber':
        propertySchema = { type: 'number' };
        break;
      case 'ZodBoolean':
        propertySchema = { type: 'boolean' };
        break;
      case 'ZodEnum':
        propertySchema = { type: 'string', enum: innerDef.values };
        break;
      case 'ZodArray':
        propertySchema = { type: 'array', items: { type: 'string' } };
        break;
      case 'ZodDefault':
        const innerSchema = zodToJsonSchema(innerDef.innerType);
        propertySchema = { ...innerSchema, default: innerDef.defaultValue() };
        break;
      default:
        propertySchema = { type: 'string' };
    }

    // Add description if available
    if (def['description']) {
      propertySchema['description'] = def['description'];
    } else if (isOptional && (value as any)._def.innerType?._def?.['description']) {
      propertySchema['description'] = (value as any)._def.innerType._def['description'];
    }

    properties[key] = propertySchema;

    // Track required fields
    if (!isOptional && innerDef.typeName !== 'ZodDefault') {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Get JSON Schema for a specific tool
 */
export function getToolJsonSchema(toolName: ToolName): Record<string, unknown> {
  const tool = ToolSchemas[toolName];
  return zodToJsonSchema(tool.schema);
}

/**
 * Get all tool JSON schemas
 */
export function getAllToolJsonSchemas(): Record<string, { schema: Record<string, unknown>; description: string; category: string }> {
  const result: Record<string, { schema: Record<string, unknown>; description: string; category: string }> = {};

  for (const [name, tool] of Object.entries(ToolSchemas)) {
    result[name] = {
      schema: zodToJsonSchema(tool.schema),
      description: tool.description,
      category: tool.category,
    };
  }

  return result;
}
