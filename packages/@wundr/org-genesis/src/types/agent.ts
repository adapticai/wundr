/**
 * @fileoverview Sub-Agent Types (Tier 3)
 *
 * This module defines the comprehensive TypeScript types for sub-agent (Tier 3)
 * definitions in the organizational hierarchy. Sub-agents are specialized worker
 * agents that perform specific tasks within the swarm architecture.
 *
 * @module @wundr/org-genesis/types/agent
 * @version 1.0.0
 */

// ============================================================================
// Model Assignment Types
// ============================================================================

/**
 * Model assignment for the agent.
 *
 * Determines which Claude model variant the agent will use for its operations.
 * Model selection impacts cost, latency, and capability trade-offs.
 *
 * @remarks
 * - `opus` - Most capable model, highest cost, best for complex reasoning
 * - `sonnet` - Balanced model, moderate cost, good for general tasks
 * - `haiku` - Fastest model, lowest cost, best for simple/high-volume tasks
 *
 * @example
 * ```typescript
 * const assignment: ModelAssignment = 'sonnet';
 * ```
 */
export type ModelAssignment = 'opus' | 'sonnet' | 'haiku';

// ============================================================================
// Agent Scope Types
// ============================================================================

/**
 * Agent availability scope.
 *
 * Defines whether an agent is available across all disciplines or restricted
 * to specific disciplines within the organization hierarchy.
 *
 * @remarks
 * - `universal` - Agent is available to all disciplines and VPs
 * - `discipline-specific` - Agent is only available within assigned disciplines
 *
 * @example
 * ```typescript
 * // A researcher agent available everywhere
 * const researcherScope: AgentScope = 'universal';
 *
 * // A specialized agent for engineering only
 * const engineerScope: AgentScope = 'discipline-specific';
 * ```
 */
export type AgentScope = 'universal' | 'discipline-specific';

// ============================================================================
// Agent Tool Types
// ============================================================================

/**
 * Type of tool available to an agent.
 *
 * @remarks
 * - `mcp` - Model Context Protocol tool (external server integration)
 * - `builtin` - Native Claude Code tool (Read, Write, Bash, etc.)
 * - `custom` - Custom-defined tool specific to the organization
 */
export type AgentToolType = 'mcp' | 'builtin' | 'custom';

/**
 * Agent tool definition.
 *
 * Represents a tool that an agent can use to perform its tasks. Tools can be
 * MCP servers, built-in Claude capabilities, or custom implementations.
 *
 * @example
 * ```typescript
 * const gitTool: AgentTool = {
 *   name: 'git',
 *   type: 'builtin',
 *   config: { allowForce: false }
 * };
 *
 * const databaseTool: AgentTool = {
 *   name: 'postgres-mcp',
 *   type: 'mcp',
 *   config: {
 *     connectionString: '${DATABASE_URL}',
 *     readOnly: true
 *   }
 * };
 * ```
 */
export interface AgentTool {
  /**
   * Unique name identifier for the tool.
   * Should be kebab-case and descriptive.
   */
  name: string;

  /**
   * Type of the tool indicating its source/integration method.
   */
  type: AgentToolType;

  /**
   * Optional configuration object for the tool.
   * Structure varies based on tool type and implementation.
   */
  config?: Record<string, unknown>;
}

// ============================================================================
// Agent Capability Types
// ============================================================================

/**
 * Agent capabilities configuration.
 *
 * Defines the permissions and abilities granted to an agent. This forms part
 * of the security model, controlling what actions an agent can perform.
 *
 * @remarks
 * Capabilities should follow the principle of least privilege - only grant
 * what is necessary for the agent to perform its designated tasks.
 *
 * @example
 * ```typescript
 * // A read-only researcher agent
 * const researcherCaps: AgentCapabilities = {
 *   canReadFiles: true,
 *   canWriteFiles: false,
 *   canExecuteCommands: false,
 *   canAccessNetwork: true,
 *   canSpawnSubAgents: false
 * };
 *
 * // A senior developer agent
 * const developerCaps: AgentCapabilities = {
 *   canReadFiles: true,
 *   canWriteFiles: true,
 *   canExecuteCommands: true,
 *   canAccessNetwork: true,
 *   canSpawnSubAgents: false,
 *   customCapabilities: ['code-review', 'architecture-design']
 * };
 * ```
 */
export interface AgentCapabilities {
  /**
   * Whether the agent can read files from the filesystem.
   * Required for code analysis, documentation review, etc.
   */
  canReadFiles: boolean;

  /**
   * Whether the agent can write/modify files on the filesystem.
   * Required for code generation, documentation writing, etc.
   */
  canWriteFiles: boolean;

  /**
   * Whether the agent can execute shell commands.
   * Required for running builds, tests, git operations, etc.
   */
  canExecuteCommands: boolean;

  /**
   * Whether the agent can make network requests.
   * Required for API calls, web research, etc.
   */
  canAccessNetwork: boolean;

  /**
   * Whether the agent can spawn additional sub-agents.
   * Typically reserved for coordinator-level agents.
   */
  canSpawnSubAgents: boolean;

  /**
   * Additional custom capabilities specific to the organization.
   * Can be used for fine-grained permission control.
   *
   * @example ['code-review', 'merge-approval', 'deployment']
   */
  customCapabilities?: string[];
}

// ============================================================================
// Agent Definition Types
// ============================================================================

/**
 * Complete Sub-Agent Definition (Tier 3).
 *
 * Represents a fully-defined sub-agent in the organizational hierarchy.
 * Sub-agents are the worker bees of the swarm, performing specialized tasks
 * under the direction of disciplines (Tier 2) and VPs (Tier 1).
 *
 * @remarks
 * The tier is always 3 for sub-agents, distinguishing them from:
 * - Tier 1: Orchestrator-level coordinators
 * - Tier 2: Discipline managers
 * - Tier 3: Sub-agents (this type)
 *
 * @example
 * ```typescript
 * const codeReviewer: AgentDefinition = {
 *   id: 'agent-code-reviewer-001',
 *   name: 'Code Reviewer',
 *   slug: 'code-reviewer',
 *   tier: 3,
 *   scope: 'discipline-specific',
 *   description: 'Reviews code for quality, security, and best practices',
 *   charter: `You are a meticulous code reviewer focused on:
 *     1. Code quality and maintainability
 *     2. Security vulnerabilities
 *     3. Performance considerations
 *     4. Adherence to style guides`,
 *   model: 'sonnet',
 *   tools: [
 *     { name: 'read', type: 'builtin' },
 *     { name: 'grep', type: 'builtin' },
 *     { name: 'github-pr', type: 'mcp', config: { reviewMode: true } }
 *   ],
 *   capabilities: {
 *     canReadFiles: true,
 *     canWriteFiles: false,
 *     canExecuteCommands: false,
 *     canAccessNetwork: true,
 *     canSpawnSubAgents: false
 *   },
 *   usedByDisciplines: ['engineering', 'quality-assurance'],
 *   usedByVps: ['orchestrator-engineering'],
 *   tags: ['code-quality', 'security', 'review'],
 *   createdAt: new Date('2024-01-15'),
 *   updatedAt: new Date('2024-06-20')
 * };
 * ```
 */
export interface AgentDefinition {
  /**
   * Unique identifier for the agent.
   * Format: `agent-{slug}-{numeric-suffix}`
   */
  id: string;

  /**
   * Human-readable display name for the agent.
   */
  name: string;

  /**
   * URL-safe slug identifier.
   * Used in file paths, URLs, and programmatic references.
   */
  slug: string;

  /**
   * Hierarchical tier level.
   * Always 3 for sub-agents.
   */
  tier: 3;

  /**
   * Availability scope of the agent.
   */
  scope: AgentScope;

  /**
   * Brief description of the agent's purpose and capabilities.
   * Should be 1-2 sentences.
   */
  description: string;

  /**
   * The agent's core instruction/persona.
   *
   * This is the system prompt that defines the agent's behavior, expertise,
   * communication style, and operational guidelines. It should be comprehensive
   * and include:
   * - Role definition
   * - Key responsibilities
   * - Decision-making guidelines
   * - Communication style
   * - Constraints and limitations
   */
  charter: string;

  /**
   * The Claude model variant to use for this agent.
   */
  model: ModelAssignment;

  /**
   * List of tools available to this agent.
   */
  tools: AgentTool[];

  /**
   * Capability permissions for this agent.
   */
  capabilities: AgentCapabilities;

  /**
   * List of discipline slugs that can use this agent.
   * Empty array means the agent is configured but not yet assigned.
   */
  usedByDisciplines: string[];

  /**
   * Optional list of Orchestrator slugs that can directly invoke this agent.
   * Typically used for universal agents or special-purpose agents.
   */
  usedByVps?: string[];

  /**
   * Searchable tags for categorization and discovery.
   */
  tags: string[];

  /**
   * Timestamp when the agent was created.
   */
  createdAt: Date;

  /**
   * Timestamp when the agent was last updated.
   */
  updatedAt: Date;
}

// ============================================================================
// Agent Creation Types
// ============================================================================

/**
 * Configuration for creating a new agent.
 *
 * Contains the required and optional fields for defining a new sub-agent.
 * The system will generate `id`, `slug`, `tier`, `createdAt`, and `updatedAt`.
 *
 * @example
 * ```typescript
 * const newAgentConfig: CreateAgentConfig = {
 *   name: 'API Designer',
 *   description: 'Designs RESTful and GraphQL API schemas',
 *   charter: `You are an API design specialist who creates clean,
 *     intuitive, and well-documented API interfaces...`,
 *   scope: 'discipline-specific',
 *   model: 'sonnet',
 *   tools: [
 *     { name: 'read', type: 'builtin' },
 *     { name: 'write', type: 'builtin' },
 *     { name: 'openapi-validator', type: 'mcp' }
 *   ],
 *   capabilities: {
 *     canReadFiles: true,
 *     canWriteFiles: true,
 *     canExecuteCommands: false,
 *     canAccessNetwork: false,
 *     canSpawnSubAgents: false
 *   },
 *   tags: ['api', 'design', 'rest', 'graphql']
 * };
 * ```
 */
export interface CreateAgentConfig {
  /**
   * Human-readable display name for the agent.
   * Will be used to generate the slug.
   */
  name: string;

  /**
   * Brief description of the agent's purpose.
   */
  description: string;

  /**
   * The agent's core instruction/persona charter.
   */
  charter: string;

  /**
   * Availability scope. Defaults to 'discipline-specific'.
   */
  scope?: AgentScope;

  /**
   * Model assignment. Defaults to 'sonnet'.
   */
  model?: ModelAssignment;

  /**
   * Tools available to the agent. Defaults to basic read tools.
   */
  tools?: AgentTool[];

  /**
   * Capability overrides. Unspecified capabilities default to false.
   */
  capabilities?: Partial<AgentCapabilities>;

  /**
   * Tags for categorization. Defaults to empty array.
   */
  tags?: string[];
}

// ============================================================================
// Agent Assignment Types
// ============================================================================

/**
 * Priority level for agent assignment in a session.
 *
 * @remarks
 * - `primary` - Main agent responsible for the task
 * - `secondary` - Supporting agent that assists the primary
 * - `support` - Background agent for auxiliary tasks
 */
export type AgentPriority = 'primary' | 'secondary' | 'support';

/**
 * Worktree mode for agent file operations.
 *
 * @remarks
 * - `shared` - Agent shares the main worktree with other agents
 * - `isolated` - Agent operates in its own isolated worktree (git worktree)
 */
export type WorktreeMode = 'shared' | 'isolated';

/**
 * Agent assignment to a session.
 *
 * Represents the binding of an agent to a specific work session, including
 * its role, priority, and operational mode.
 *
 * @example
 * ```typescript
 * const assignment: AgentAssignment = {
 *   agentId: 'agent-code-reviewer-001',
 *   sessionId: 'session-feature-auth-2024',
 *   role: 'code-review',
 *   priority: 'primary',
 *   worktreeMode: 'shared'
 * };
 * ```
 */
export interface AgentAssignment {
  /**
   * The unique identifier of the agent being assigned.
   */
  agentId: string;

  /**
   * The unique identifier of the session.
   */
  sessionId: string;

  /**
   * The role this agent plays in the session.
   * Can be custom per assignment (e.g., 'lead-developer', 'qa-reviewer').
   */
  role: string;

  /**
   * Priority level of this agent in the session.
   */
  priority: AgentPriority;

  /**
   * Worktree mode for file operations.
   */
  worktreeMode: WorktreeMode;
}

// ============================================================================
// Universal Agent Constants
// ============================================================================

/**
 * Universal agents available to all disciplines.
 *
 * These are the core agents that every discipline and Orchestrator can access
 * regardless of their specialization. They provide common functionality
 * needed across all organizational units.
 *
 * @remarks
 * - `researcher` - Gathers information and performs analysis
 * - `scribe` - Documents decisions, meetings, and processes
 * - `project-manager` - Tracks tasks, timelines, and dependencies
 * - `reviewer` - Reviews work output for quality and correctness
 * - `tester` - Creates and runs tests, validates functionality
 */
export const UNIVERSAL_AGENTS = [
  'researcher',
  'scribe',
  'project-manager',
  'reviewer',
  'tester',
] as const;

/**
 * Type representing the universal agent identifiers.
 *
 * @example
 * ```typescript
 * function isUniversalAgent(slug: string): slug is UniversalAgentType {
 *   return UNIVERSAL_AGENTS.includes(slug as UniversalAgentType);
 * }
 * ```
 */
export type UniversalAgentType = (typeof UNIVERSAL_AGENTS)[number];

// ============================================================================
// Agent Status Types
// ============================================================================

/**
 * Operational status of an agent.
 *
 * @remarks
 * - `active` - Agent is operational and can be assigned to sessions
 * - `inactive` - Agent exists but is not available for assignment
 * - `deprecated` - Agent is scheduled for removal, avoid new assignments
 * - `archived` - Agent has been retired and preserved for historical reference
 */
export type AgentStatus = 'active' | 'inactive' | 'deprecated' | 'archived';

/**
 * Extended agent definition including runtime status.
 *
 * @example
 * ```typescript
 * const agentWithStatus: AgentWithStatus = {
 *   ...agentDefinition,
 *   status: 'active',
 *   lastActiveAt: new Date('2024-06-20T14:30:00Z'),
 *   assignmentCount: 42
 * };
 * ```
 */
export interface AgentWithStatus extends AgentDefinition {
  /**
   * Current operational status of the agent.
   */
  status: AgentStatus;

  /**
   * Timestamp of the agent's last activity.
   * Undefined if the agent has never been used.
   */
  lastActiveAt?: Date;

  /**
   * Number of times this agent has been assigned to sessions.
   */
  assignmentCount: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a string is a valid UniversalAgentType.
 *
 * @param value - The string to check
 * @returns True if the value is a universal agent type
 *
 * @example
 * ```typescript
 * const agentSlug = 'researcher';
 * if (isUniversalAgentType(agentSlug)) {
 *   // TypeScript knows agentSlug is UniversalAgentType here
 *   console.log(`${agentSlug} is a universal agent`);
 * }
 * ```
 */
export function isUniversalAgentType(value: string): value is UniversalAgentType {
  return UNIVERSAL_AGENTS.includes(value as UniversalAgentType);
}

/**
 * Type guard to check if a value is a valid ModelAssignment.
 *
 * @param value - The value to check
 * @returns True if the value is a valid model assignment
 *
 * @example
 * ```typescript
 * const model = 'sonnet';
 * if (isModelAssignment(model)) {
 *   // TypeScript knows model is ModelAssignment here
 * }
 * ```
 */
export function isModelAssignment(value: unknown): value is ModelAssignment {
  return value === 'opus' || value === 'sonnet' || value === 'haiku';
}

/**
 * Type guard to check if a value is a valid AgentScope.
 *
 * @param value - The value to check
 * @returns True if the value is a valid agent scope
 */
export function isAgentScope(value: unknown): value is AgentScope {
  return value === 'universal' || value === 'discipline-specific';
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default capabilities for a new agent.
 * Follows the principle of least privilege.
 */
export const DEFAULT_AGENT_CAPABILITIES: AgentCapabilities = {
  canReadFiles: true,
  canWriteFiles: false,
  canExecuteCommands: false,
  canAccessNetwork: false,
  canSpawnSubAgents: false,
};

/**
 * Default tools for a new agent.
 * Provides basic read-only access.
 */
export const DEFAULT_AGENT_TOOLS: AgentTool[] = [
  { name: 'read', type: 'builtin' },
  { name: 'glob', type: 'builtin' },
  { name: 'grep', type: 'builtin' },
];

/**
 * Default model assignment for new agents.
 */
export const DEFAULT_MODEL_ASSIGNMENT: ModelAssignment = 'sonnet';

/**
 * Default scope for new agents.
 */
export const DEFAULT_AGENT_SCOPE: AgentScope = 'discipline-specific';
