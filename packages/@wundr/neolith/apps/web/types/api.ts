/**
 * API Response Types
 *
 * Common type definitions for API responses and data transformations.
 * These types represent the contract between the API layer and client components.
 *
 * @module types/api
 */

import type { TaskPriority, TaskStatus } from '@neolith/database';

/**
 * Activity type discriminator for dashboard activities
 */
export type DashboardActivityType =
  | 'message'
  | 'task_created'
  | 'task_completed'
  | 'task_assigned'
  | 'workflow_started'
  | 'workflow_completed'
  | 'agent_created'
  | 'orchestrator_created'
  | 'channel_created'
  | 'member_joined';

/**
 * Target entity type discriminator
 */
export type ActivityTargetType =
  | 'task'
  | 'workflow'
  | 'agent'
  | 'orchestrator'
  | 'channel'
  | 'message'
  | 'workspace';

/**
 * Actor information for activities
 */
export interface ActivityActor {
  /** User or system identifier */
  name: string;
  /** Human-readable display name */
  displayName: string;
}

/**
 * Target entity information for activities
 */
export interface ActivityTarget {
  /** Type of the target entity */
  type: ActivityTargetType;
  /** Name or identifier of the target */
  name: string;
}

/**
 * Dashboard activity API response structure
 *
 * Represents a single activity item in the dashboard feed,
 * such as task updates, workflow events, or system notifications.
 */
export interface DashboardActivityApiResponse {
  /** Unique identifier for the activity */
  id: string;
  /** Type of activity */
  type: DashboardActivityType;
  /** Actor who performed the activity */
  actor: ActivityActor;
  /** Optional target entity of the activity */
  target?: ActivityTarget | null;
  /** Optional activity content or description */
  content?: string | null;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Admin action types for audit logging
 */
export type AdminActionType =
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'workspace_created'
  | 'workspace_updated'
  | 'workspace_deleted'
  | 'role_assigned'
  | 'role_revoked'
  | 'settings_updated'
  | 'integration_enabled'
  | 'integration_disabled'
  | 'api_key_created'
  | 'api_key_revoked';

/**
 * Admin actor information
 */
export interface AdminActor {
  /** Actor's user ID */
  id: string;
  /** Actor's full name */
  name: string;
  /** Actor's email address */
  email: string;
  /** Optional profile image URL */
  image?: string | null;
}

/**
 * Admin activity API response for audit logging
 *
 * Tracks administrative actions performed in the system
 * for security and compliance purposes.
 */
export interface AdminActivityApiResponse {
  /** Unique identifier for the activity record */
  id: string;
  /** Type of administrative action performed */
  action: AdminActionType;
  /** ID of the user who performed the action */
  actorId?: string | null;
  /** Full actor details (may be omitted for system actions) */
  actor?: AdminActor | null;
  /** Type of entity targeted by the action */
  targetType?: string | null;
  /** ID of the targeted entity */
  targetId?: string | null;
  /** Name of the targeted entity */
  targetName?: string | null;
  /** Additional action-specific metadata */
  metadata?: Record<string, string | number | boolean | null> | null;
  /** ISO 8601 timestamp of when the action occurred */
  createdAt: string;
  /** IP address from which the action was performed */
  ipAddress?: string | null;
}

/**
 * Orchestrator status enum
 */
export type OrchestratorStatus = 'active' | 'inactive' | 'archived' | 'draft';

/**
 * Orchestrator identity information
 */
export interface OrchestratorIdentity {
  /** Display name of the orchestrator */
  name: string;
  /** Optional persona description */
  persona?: string | null;
}

/**
 * Orchestrator charter defining mission and expertise
 */
export interface OrchestratorCharter {
  /** Mission statement */
  mission?: string | null;
  /** Vision statement */
  vision?: string | null;
  /** Core values */
  values?: string[] | null;
  /** Areas of expertise */
  expertise?: string[] | null;
}

/**
 * Model configuration for orchestrator AI behavior
 */
export interface OrchestratorModelConfig {
  /** Model provider (e.g., 'openai', 'anthropic') */
  provider?: string;
  /** Model name or version */
  model?: string;
  /** Temperature setting (0-1) */
  temperature?: number;
  /** Maximum tokens for responses */
  maxTokens?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Additional provider-specific settings */
  [key: string]: string | number | boolean | undefined;
}

/**
 * User information associated with orchestrator
 */
export interface OrchestratorUserInfo {
  /** User biography */
  bio?: string | null;
  /** User avatar URL */
  avatarUrl?: string | null;
}

/**
 * Orchestrator data from API (Genesis result format)
 * @deprecated Use OrchestratorApiResponse instead - VPApiResponse is maintained for backward compatibility
 */
export interface VPApiResponse {
  id?: string;
  title?: string;
  role?: string;
  description?: string;
  discipline?: string;
  status?: OrchestratorStatus;
  userId?: string;
  identity?: OrchestratorIdentity;
  coreDirective?: string;
  charter?: OrchestratorCharter;
  capabilities?: string[];
  disciplineIds?: string[];
  modelConfig?: OrchestratorModelConfig;
  systemPrompt?: string;
  organizationId?: string;
  avatarUrl?: string;
  lastActivityAt?: string;
  messageCount?: number;
  agentCount?: number;
  createdAt?: string;
  updatedAt?: string;
  user?: OrchestratorUserInfo;
}

/**
 * Orchestrator API response structure
 *
 * Represents an orchestrator entity returned from Genesis API.
 * Orchestrators coordinate agents and workflows within a discipline.
 */
export interface OrchestratorApiResponse {
  /** Unique identifier (optional for creation requests) */
  id?: string;
  /** Orchestrator title */
  title?: string;
  /** Role or job title */
  role?: string;
  /** Detailed description */
  description?: string;
  /** Associated discipline name */
  discipline?: string;
  /** Current status */
  status?: OrchestratorStatus;
  /** Owner user ID */
  userId?: string;
  /** Identity information */
  identity?: OrchestratorIdentity;
  /** Core directive or purpose */
  coreDirective?: string;
  /** Charter defining mission and expertise */
  charter?: OrchestratorCharter;
  /** List of capabilities */
  capabilities?: string[];
  /** Associated discipline IDs */
  disciplineIds?: string[];
  /** AI model configuration */
  modelConfig?: OrchestratorModelConfig;
  /** System prompt for AI behavior */
  systemPrompt?: string;
  /** Organization ID */
  organizationId?: string;
  /** Avatar image URL */
  avatarUrl?: string;
  /** ISO 8601 timestamp of last activity */
  lastActivityAt?: string;
  /** Total message count */
  messageCount?: number;
  /** Number of associated agents */
  agentCount?: number;
  /** ISO 8601 timestamp of creation */
  createdAt?: string;
  /** ISO 8601 timestamp of last update */
  updatedAt?: string;
  /** Associated user information */
  user?: OrchestratorUserInfo;
}

/**
 * Discipline hook configuration
 */
export interface DisciplineHook {
  /** Hook description */
  description: string;
  /** Hook type (e.g., 'pre-task', 'post-task') */
  type?: string;
  /** Hook execution order */
  order?: number;
  /** Whether the hook is enabled */
  enabled?: boolean;
}

/**
 * Claude.md configuration for a discipline
 */
export interface DisciplineClaudeMdConfig {
  /** Discipline objectives */
  objectives?: string[];
  /** Core responsibilities */
  responsibilities?: string[];
  /** Success metrics */
  metrics?: string[];
  /** Tools available to the discipline */
  tools?: string[];
}

/**
 * Discipline API response structure
 *
 * Represents a discipline (functional area) within an organization,
 * such as Engineering, Product, or Design.
 */
export interface DisciplineApiResponse {
  /** Unique identifier (optional for creation requests) */
  id?: string;
  /** Discipline name (required) */
  name: string;
  /** Detailed description */
  description?: string | null;
  /** URL-friendly slug */
  slug?: string | null;
  /** Parent orchestrator ID */
  parentOrchestratorId?: string | null;
  /** Hook configurations */
  hooks?: DisciplineHook[] | null;
  /** Claude.md configuration */
  claudeMd?: DisciplineClaudeMdConfig | null;
  /** Associated agent IDs */
  agentIds?: string[];
  /** Primary orchestrator ID */
  orchestratorId?: string | null;
}

/**
 * Agent status enum
 */
export type AgentStatus = 'active' | 'inactive' | 'error' | 'initializing';

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Agent execution timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Agent priority level (1-10) */
  priority?: number;
  /** Additional configuration options */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Agent capabilities configuration
 */
export interface AgentCapabilities {
  /** Whether the agent can execute code */
  codeExecution?: boolean;
  /** Whether the agent can access files */
  fileAccess?: boolean;
  /** Whether the agent can make API calls */
  apiAccess?: boolean;
  /** Whether the agent can spawn sub-agents */
  spawning?: boolean;
  /** Additional capability flags */
  [key: string]: boolean | undefined;
}

/**
 * Agent API response structure
 *
 * Represents an AI agent that performs specific tasks within a discipline.
 */
export interface AgentApiResponse {
  /** Unique identifier (optional for creation requests) */
  id?: string;
  /** Agent name (required) */
  name: string;
  /** Agent type or category */
  type?: string | null;
  /** Detailed description */
  description?: string | null;
  /** Current status */
  status?: AgentStatus;
  /** Configuration settings */
  config?: AgentConfig | null;
  /** Capability flags */
  capabilities?: AgentCapabilities | null;
  /** Agent charter or purpose */
  charter?: string | null;
  /** Discipline IDs where this agent is used */
  usedByDisciplines?: string[];
  /** Primary orchestrator ID */
  orchestratorId?: string | null;
  /** Primary discipline ID */
  disciplineId?: string | null;
}

/**
 * Genesis API result structure
 *
 * Response from the Genesis API endpoint that generates a complete
 * organizational structure including orchestrators, disciplines, and agents.
 */
export interface GenesisApiResult {
  /** Generated orchestrators */
  orchestrators: OrchestratorApiResponse[];
  /** Generated disciplines */
  disciplines: DisciplineApiResponse[];
  /** Generated agents */
  agents: AgentApiResponse[];
  /** Optional metadata about the generation process */
  metadata?: {
    /** Generation timestamp */
    generatedAt?: string;
    /** Model used for generation */
    model?: string;
    /** Total tokens consumed */
    tokensUsed?: number;
  };
}

/**
 * Prisma filter operator for array matching
 */
export interface PrismaInFilter<T> {
  /** Match values in the provided array */
  in?: T[];
}

/**
 * Prisma where clause for task queries
 *
 * Provides type-safe query filters for Prisma ORM.
 * Used primarily for task filtering and search operations.
 */
export interface PrismaWhereClause {
  /** Filter by orchestrator ID */
  orchestratorId?: string;
  /** Filter by workspace ID */
  workspaceId?: string;
  /** Filter by status (exact match or array) */
  status?: TaskStatus | PrismaInFilter<TaskStatus | string>;
  /** Filter by priority (exact match or array) */
  priority?: TaskPriority | PrismaInFilter<TaskPriority | string>;
  /** Filter by channel ID (exact match or array) */
  channelId?: string | PrismaInFilter<string>;
  /** Filter by assigned user ID (null for unassigned) */
  assignedToId?: string | null;
}

/**
 * Prisma update data for task mutations
 *
 * Defines allowed fields for task update operations.
 * All fields are optional to support partial updates.
 */
export interface PrismaUpdateData {
  /** Update task status */
  status?: TaskStatus;
  /** Update task priority */
  priority?: TaskPriority;
  /** Update task title */
  title?: string;
  /** Update task description */
  description?: string;
  /** Update assigned user (null to unassign) */
  assignedToId?: string | null;
  /** Update completion timestamp */
  completedAt?: Date | null;
  /** Update task metadata */
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Sort direction for Prisma queries
 */
export type PrismaSortDirection = 'asc' | 'desc';

/**
 * Prisma order by clause for sorting
 *
 * Supports both simple field sorting and nested object sorting.
 */
export interface PrismaOrderBy {
  [key: string]: PrismaSortDirection | PrismaOrderBy;
}

/**
 * Memory content returned in access responses
 */
export interface MemoryContent {
  /** Unique memory identifier */
  id: string;
  /** Memory content/payload */
  content: string;
  /** Content type or format */
  type?: string;
  /** ISO 8601 timestamp of creation */
  createdAt?: string;
  /** ISO 8601 timestamp of last access */
  lastAccessedAt?: string;
}

/**
 * Memory access response for Orchestrator memory checks
 *
 * Returned when checking if an orchestrator has access to a memory resource.
 * Used for authorization and memory retrieval.
 */
export interface MemoryAccessResponse {
  /** Whether access is allowed */
  allowed: boolean;
  /** Memory content (only present if allowed is true) */
  memory?: MemoryContent;
  /** Optional denial reason */
  reason?: string;
}

/**
 * Analytics chart data point
 *
 * Generic structure for chart data points used in analytics dashboards.
 * Keys represent dimension names (e.g., 'date', 'category', 'value').
 */
export interface ChartDataPoint {
  /** Date or timestamp for time-series data */
  date?: string;
  /** Category or label */
  label?: string;
  /** Numeric value */
  value?: number;
  /** Additional dimensions or metrics */
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Type guard to check if a value is a valid ChartDataPoint
 */
export function isChartDataPoint(value: unknown): value is ChartDataPoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(
      v =>
        typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean' ||
        v === null ||
        v === undefined
    )
  );
}

/**
 * Type guard to check if a value is a valid OrchestratorApiResponse
 */
export function isOrchestratorApiResponse(
  value: unknown
): value is OrchestratorApiResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('title' in value || 'role' in value || 'id' in value)
  );
}
