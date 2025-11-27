/**
 * @fileoverview Discipline Pack Types
 * @module @wundr/org-genesis/types/discipline
 *
 * Defines the configuration bundles for different work domains within an organization.
 * Discipline Packs encapsulate all necessary configurations for a specific functional area,
 * including CLAUDE.md settings, MCP server configurations, hooks, and agent mappings.
 *
 * @example
 * ```typescript
 * import { DisciplinePack, DisciplineCategory } from '@wundr/org-genesis';
 *
 * const engineeringPack: DisciplinePack = {
 *   id: 'disc_eng_001',
 *   name: 'Software Engineering',
 *   slug: 'software-engineering',
 *   category: 'engineering',
 *   description: 'Full-stack software development discipline',
 *   claudeMd: {
 *     role: 'Senior Software Engineer',
 *     context: 'Building scalable web applications',
 *     rules: ['Follow TDD practices', 'Write clean code'],
 *     objectives: ['Deliver high-quality features'],
 *     constraints: ['No production access without review'],
 *   },
 *   mcpServers: [...],
 *   hooks: [...],
 *   agentIds: ['agent_coder_001', 'agent_reviewer_001'],
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */

/**
 * Standard discipline categories representing major functional areas within an organization.
 *
 * @description
 * These categories provide a standardized classification system for organizing
 * disciplines across different business domains. Each category typically maps
 * to a department or functional area.
 *
 * Categories:
 * - `engineering` - Software development, infrastructure, and technical operations
 * - `legal` - Legal affairs, compliance, and contract management
 * - `hr` - Human resources, recruiting, and people operations
 * - `marketing` - Marketing, brand management, and communications
 * - `finance` - Financial planning, accounting, and treasury
 * - `operations` - Business operations and process management
 * - `design` - Product design, UX/UI, and creative services
 * - `research` - Research and development, data science
 * - `sales` - Sales operations and business development
 * - `support` - Customer support and success
 * - `custom` - Custom or specialized disciplines
 */
export type DisciplineCategory =
  | 'engineering'
  | 'legal'
  | 'hr'
  | 'marketing'
  | 'finance'
  | 'operations'
  | 'design'
  | 'research'
  | 'sales'
  | 'support'
  | 'custom';

/**
 * Model Context Protocol (MCP) server configuration.
 *
 * @description
 * Defines the configuration for an MCP server that provides specialized tools
 * and capabilities to agents within a discipline. MCP servers extend the
 * functionality available to Claude Code by exposing domain-specific tools.
 *
 * @example
 * ```typescript
 * const githubServer: MCPServerConfig = {
 *   name: 'github',
 *   command: 'npx',
 *   args: ['@modelcontextprotocol/server-github'],
 *   env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
 *   description: 'GitHub integration for repository management',
 * };
 * ```
 */
export interface MCPServerConfig {
  /**
   * Unique identifier for the MCP server within the discipline.
   * Used for referencing the server in configurations and logs.
   */
  name: string;

  /**
   * The command to execute to start the MCP server.
   * Typically 'npx' for npm packages or an absolute path to a binary.
   */
  command: string;

  /**
   * Optional arguments to pass to the command.
   * Usually includes the package name and any startup flags.
   */
  args?: string[];

  /**
   * Optional environment variables for the MCP server process.
   * Supports variable interpolation using ${VAR_NAME} syntax.
   */
  env?: Record<string, string>;

  /**
   * Human-readable description of the MCP server's purpose and capabilities.
   * Used for documentation and tool discovery.
   */
  description: string;
}

/**
 * Hook configuration for automated actions on specific events.
 *
 * @description
 * Hooks allow disciplines to define automated actions that execute
 * in response to specific events during agent operations. These can
 * enforce policies, run validations, or trigger side effects.
 *
 * @example
 * ```typescript
 * const preCommitHook: HookConfig = {
 *   event: 'PreCommit',
 *   command: 'npm run lint && npm run test',
 *   description: 'Run linting and tests before committing',
 *   blocking: true,
 * };
 * ```
 */
export interface HookConfig {
  /**
   * The event that triggers this hook.
   *
   * - `PreToolUse` - Executes before a tool is invoked
   * - `PostToolUse` - Executes after a tool completes
   * - `PreCommit` - Executes before a git commit is created
   * - `PostCommit` - Executes after a git commit is created
   */
  event: 'PreToolUse' | 'PostToolUse' | 'PreCommit' | 'PostCommit';

  /**
   * The command to execute when the hook is triggered.
   * Can be a shell command, script path, or npm script.
   */
  command: string;

  /**
   * Human-readable description of the hook's purpose.
   * Used for documentation and debugging.
   */
  description: string;

  /**
   * Whether this hook should block the triggering operation on failure.
   *
   * - `true` - If the hook fails, the operation is aborted
   * - `false` - Hook failures are logged but don't block the operation
   *
   * @default false
   */
  blocking?: boolean;
}

/**
 * CLAUDE.md template configuration defining the AI assistant's behavior.
 *
 * @description
 * The ClaudeMdConfig defines the contents of the CLAUDE.md file that
 * configures how Claude Code behaves within a specific discipline.
 * This includes the role persona, operational context, and behavioral rules.
 *
 * @example
 * ```typescript
 * const legalClaudeMd: ClaudeMdConfig = {
 *   role: 'Legal Counsel Assistant',
 *   context: 'Supporting corporate legal team with contract review and compliance',
 *   rules: [
 *     'Always cite relevant regulations',
 *     'Flag potential compliance issues',
 *     'Maintain attorney-client privilege awareness',
 *   ],
 *   objectives: [
 *     'Assist with contract analysis',
 *     'Support compliance documentation',
 *     'Facilitate legal research',
 *   ],
 *   constraints: [
 *     'Never provide final legal advice without human review',
 *     'Do not access confidential client information directly',
 *   ],
 * };
 * ```
 */
export interface ClaudeMdConfig {
  /**
   * The role persona that Claude should adopt within this discipline.
   * Defines the professional identity and expertise area.
   *
   * @example 'Senior Software Engineer', 'Legal Compliance Analyst'
   */
  role: string;

  /**
   * Contextual information about the working environment and domain.
   * Helps Claude understand the broader operational context.
   *
   * @example 'Building enterprise SaaS applications for healthcare'
   */
  context: string;

  /**
   * Operational rules that Claude must follow within this discipline.
   * These are imperative statements defining required behaviors.
   */
  rules: string[];

  /**
   * Goals and objectives that Claude should work towards.
   * These define the desired outcomes for the discipline.
   */
  objectives: string[];

  /**
   * Constraints and limitations on Claude's actions.
   * These define what Claude should not do or areas to avoid.
   */
  constraints: string[];
}

/**
 * Complete Discipline Pack configuration.
 *
 * @description
 * A Discipline Pack is a comprehensive configuration bundle that defines
 * everything needed to configure Claude Code for a specific work domain.
 * It includes CLAUDE.md configuration, MCP servers, hooks, and agent mappings.
 *
 * Discipline Packs can be hierarchically organized under Virtual Principals (VPs)
 * and may contain multiple agents specialized for different tasks within the discipline.
 *
 * @example
 * ```typescript
 * const frontendDiscipline: DisciplinePack = {
 *   id: 'disc_fe_001',
 *   name: 'Frontend Development',
 *   slug: 'frontend-development',
 *   category: 'engineering',
 *   description: 'React and TypeScript frontend development',
 *   claudeMd: {
 *     role: 'Frontend Developer',
 *     context: 'Building modern web applications with React',
 *     rules: ['Use TypeScript strictly', 'Follow accessibility guidelines'],
 *     objectives: ['Create responsive, performant UIs'],
 *     constraints: ['No direct backend modifications'],
 *   },
 *   mcpServers: [
 *     {
 *       name: 'browser-tools',
 *       command: 'npx',
 *       args: ['@anthropic/browser-tools'],
 *       description: 'Browser automation and testing',
 *     },
 *   ],
 *   hooks: [
 *     {
 *       event: 'PreCommit',
 *       command: 'npm run lint:fix',
 *       description: 'Auto-fix linting issues',
 *       blocking: false,
 *     },
 *   ],
 *   agentIds: ['agent_react_dev_001', 'agent_css_001'],
 *   parentVpId: 'vp_engineering_001',
 *   createdAt: new Date('2024-01-15'),
 *   updatedAt: new Date('2024-03-20'),
 * };
 * ```
 */
export interface DisciplinePack {
  /**
   * Unique identifier for the discipline pack.
   * Format: `disc_{category_abbrev}_{sequence}`
   *
   * @example 'disc_eng_001', 'disc_legal_042'
   */
  id: string;

  /**
   * Human-readable name of the discipline.
   *
   * @example 'Software Engineering', 'Contract Law'
   */
  name: string;

  /**
   * URL-safe slug derived from the name.
   * Used in file paths and API endpoints.
   *
   * @example 'software-engineering', 'contract-law'
   */
  slug: string;

  /**
   * The category this discipline belongs to.
   * Used for organization and filtering.
   */
  category: DisciplineCategory;

  /**
   * Detailed description of the discipline's purpose and scope.
   */
  description: string;

  /**
   * CLAUDE.md configuration defining AI behavior within this discipline.
   */
  claudeMd: ClaudeMdConfig;

  /**
   * MCP server configurations providing specialized tools.
   * These servers are automatically started when the discipline is activated.
   */
  mcpServers: MCPServerConfig[];

  /**
   * Hook configurations for automated actions.
   * These hooks are registered when the discipline is activated.
   */
  hooks: HookConfig[];

  /**
   * IDs of agents associated with this discipline.
   * Agents inherit the discipline's configurations and have access to its tools.
   */
  agentIds: string[];

  /**
   * Optional ID of the parent Virtual Principal (VP).
   * If set, this discipline operates under the Orchestrator's authority and policies.
   */
  parentVpId?: string;

  /**
   * Timestamp when the discipline was created.
   */
  createdAt: Date;

  /**
   * Timestamp when the discipline was last updated.
   */
  updatedAt: Date;
}

/**
 * Configuration for creating a new discipline.
 *
 * @description
 * This interface defines the minimal and optional fields required to create
 * a new discipline pack. The system will generate IDs, slugs, and timestamps
 * automatically. Optional configurations will use sensible defaults if not provided.
 *
 * @example
 * ```typescript
 * const newDisciplineConfig: CreateDisciplineConfig = {
 *   name: 'Data Engineering',
 *   category: 'engineering',
 *   description: 'ETL pipelines and data infrastructure',
 *   parentVpId: 'vp_eng_001',
 *   claudeMd: {
 *     role: 'Data Engineer',
 *     context: 'Building data pipelines with Apache Spark and Airflow',
 *   },
 *   mcpServers: [
 *     {
 *       name: 'database-tools',
 *       command: 'npx',
 *       args: ['@wundr/mcp-database'],
 *       description: 'Database query and management tools',
 *     },
 *   ],
 * };
 * ```
 */
export interface CreateDisciplineConfig {
  /**
   * Human-readable name for the new discipline.
   * A slug will be automatically generated from this name.
   */
  name: string;

  /**
   * The category this discipline belongs to.
   */
  category: DisciplineCategory;

  /**
   * Detailed description of the discipline's purpose and scope.
   */
  description: string;

  /**
   * Optional ID of the parent Virtual Principal (VP).
   * If not provided, the discipline operates independently.
   */
  parentVpId?: string;

  /**
   * Optional partial CLAUDE.md configuration.
   * Missing fields will be populated with category-appropriate defaults.
   */
  claudeMd?: Partial<ClaudeMdConfig>;

  /**
   * Optional MCP server configurations.
   * If not provided, category-appropriate default servers may be added.
   */
  mcpServers?: MCPServerConfig[];

  /**
   * Optional hook configurations.
   * If not provided, no hooks will be registered by default.
   */
  hooks?: HookConfig[];
}

/**
 * Discipline pack update configuration.
 *
 * @description
 * Defines which fields can be updated on an existing discipline pack.
 * All fields are optional - only provided fields will be updated.
 */
export interface UpdateDisciplineConfig {
  /**
   * Updated name for the discipline.
   * If changed, the slug will also be regenerated.
   */
  name?: string;

  /**
   * Updated category for the discipline.
   */
  category?: DisciplineCategory;

  /**
   * Updated description for the discipline.
   */
  description?: string;

  /**
   * Updated parent Orchestrator ID.
   * Set to `null` to remove the parent Orchestrator association.
   */
  parentVpId?: string | null;

  /**
   * Updated CLAUDE.md configuration.
   * Provided fields will be merged with existing configuration.
   */
  claudeMd?: Partial<ClaudeMdConfig>;

  /**
   * Updated MCP server configurations.
   * Replaces the entire server list if provided.
   */
  mcpServers?: MCPServerConfig[];

  /**
   * Updated hook configurations.
   * Replaces the entire hook list if provided.
   */
  hooks?: HookConfig[];

  /**
   * Updated agent ID list.
   * Replaces the entire agent list if provided.
   */
  agentIds?: string[];
}

/**
 * Discipline pack summary for listing operations.
 *
 * @description
 * A lightweight representation of a discipline pack containing only
 * essential metadata, suitable for list views and quick lookups.
 */
export interface DisciplinePackSummary {
  /**
   * Unique identifier for the discipline pack.
   */
  id: string;

  /**
   * Human-readable name of the discipline.
   */
  name: string;

  /**
   * URL-safe slug.
   */
  slug: string;

  /**
   * The category this discipline belongs to.
   */
  category: DisciplineCategory;

  /**
   * Brief description of the discipline.
   */
  description: string;

  /**
   * Number of agents assigned to this discipline.
   */
  agentCount: number;

  /**
   * Optional parent Orchestrator ID.
   */
  parentVpId?: string;

  /**
   * Timestamp when the discipline was last updated.
   */
  updatedAt: Date;
}

/**
 * Validation result for discipline pack configurations.
 *
 * @description
 * Represents the result of validating a discipline pack configuration,
 * including any errors or warnings found during validation.
 */
export interface DisciplineValidationResult {
  /**
   * Whether the configuration is valid.
   */
  valid: boolean;

  /**
   * List of validation errors that must be fixed.
   */
  errors: DisciplineValidationError[];

  /**
   * List of warnings that should be reviewed but don't block creation.
   */
  warnings: DisciplineValidationWarning[];
}

/**
 * A validation error for discipline pack configuration.
 */
export interface DisciplineValidationError {
  /**
   * The field path where the error occurred.
   *
   * @example 'claudeMd.role', 'mcpServers[0].command'
   */
  field: string;

  /**
   * Error message describing the issue.
   */
  message: string;

  /**
   * Error code for programmatic handling.
   */
  code: string;
}

/**
 * A validation warning for discipline pack configuration.
 */
export interface DisciplineValidationWarning {
  /**
   * The field path where the warning applies.
   */
  field: string;

  /**
   * Warning message describing the concern.
   */
  message: string;

  /**
   * Warning code for programmatic handling.
   */
  code: string;
}

/**
 * Options for discipline pack queries and filtering.
 *
 * @description
 * Defines the filtering and pagination options for listing discipline packs.
 */
export interface DisciplineQueryOptions {
  /**
   * Filter by category.
   */
  category?: DisciplineCategory;

  /**
   * Filter by parent Orchestrator ID.
   */
  parentVpId?: string;

  /**
   * Search term to match against name and description.
   */
  search?: string;

  /**
   * Maximum number of results to return.
   *
   * @default 50
   */
  limit?: number;

  /**
   * Number of results to skip for pagination.
   *
   * @default 0
   */
  offset?: number;

  /**
   * Field to sort by.
   *
   * @default 'name'
   */
  sortBy?: 'name' | 'category' | 'createdAt' | 'updatedAt';

  /**
   * Sort direction.
   *
   * @default 'asc'
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated list response for discipline packs.
 */
export interface DisciplineListResponse {
  /**
   * List of discipline pack summaries.
   */
  items: DisciplinePackSummary[];

  /**
   * Total count of matching disciplines (ignoring pagination).
   */
  total: number;

  /**
   * Number of items returned in this response.
   */
  count: number;

  /**
   * Current offset for pagination.
   */
  offset: number;

  /**
   * Limit used for this query.
   */
  limit: number;
}
