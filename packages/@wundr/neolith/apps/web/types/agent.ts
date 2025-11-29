/**
 * Agent Types
 *
 * Type definitions for AI Agents - specialized worker agents
 * that can be configured and deployed for specific tasks.
 *
 * Note: Agents are distinct from VPs/Orchestrators which are higher-level
 * autonomous entities. Agents are task-oriented workers.
 *
 * @packageDocumentation
 * @module @neolith/types/agent
 */

/**
 * Agent type categories
 *
 * Defines the specialized roles an agent can perform.
 * Each type has different default configurations optimized for its domain.
 */
export type AgentType = 'task' | 'research' | 'coding' | 'data' | 'qa' | 'support' | 'custom';

/**
 * Agent operational status
 *
 * - `active`: Agent is running and accepting tasks
 * - `paused`: Agent is temporarily stopped but can be resumed
 * - `inactive`: Agent is disabled and not processing tasks
 */
export type AgentStatus = 'active' | 'paused' | 'inactive';

/**
 * Agent model configuration
 *
 * Configures the LLM behavior for the agent.
 * All numeric parameters should be validated before use.
 */
export interface AgentModelConfig {
  /** Model identifier (e.g., "claude-3-opus", "gpt-4") */
  model: string;
  /** Temperature for response generation. Range: 0-1 (0 = deterministic, 1 = creative) */
  temperature: number;
  /** Maximum tokens per response. Range: 1-32000 (model-dependent) */
  maxTokens: number;
  /** Optional top-p sampling parameter. Range: 0-1 (nucleus sampling threshold) */
  topP?: number;
  /** Optional frequency penalty. Range: -2 to 2 (reduces repetition) */
  frequencyPenalty?: number;
  /** Optional presence penalty. Range: -2 to 2 (encourages new topics) */
  presencePenalty?: number;
}

/**
 * Agent performance statistics
 *
 * Tracks operational metrics and usage for an agent.
 */
export interface AgentStats {
  /** Number of tasks completed successfully */
  tasksCompleted: number;
  /** Success rate as a percentage (0-100) */
  successRate: number;
  /** Average response time in milliseconds */
  avgResponseTime: number;
  /** Last time the agent was active (null if never active) */
  lastActive: Date | null;
  /** Total tokens consumed across all tasks */
  tokensUsed?: number;
  /** Total cost in USD for all operations */
  totalCost?: number;
}

/**
 * Agent entity
 *
 * Represents a complete agent with all its configuration,
 * status, and operational data.
 */
export interface Agent {
  /** Unique agent identifier */
  id: string;
  /** Workspace ID this agent belongs to */
  workspaceId: string;
  /** Agent name (user-friendly display name) */
  name: string;
  /** Agent type (determines default behavior and config) */
  type: AgentType;
  /** Agent description (optional detailed explanation) */
  description: string;
  /** Current operational status */
  status: AgentStatus;
  /** Model configuration (LLM settings) */
  config: AgentModelConfig;
  /** System prompt/instructions for the agent */
  systemPrompt: string;
  /** Available tools for the agent (validated against AvailableTool) */
  tools: AvailableTool[];
  /** Performance statistics */
  stats: AgentStats;
  /** Created timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Input for creating a new agent
 *
 * Required and optional fields for creating a new agent.
 * Defaults will be applied for optional fields.
 */
export interface CreateAgentInput {
  /** Agent name (required, 1-100 characters) */
  name: string;
  /** Agent type (required, determines default config) */
  type: AgentType;
  /** Agent description (optional, detailed explanation) */
  description?: string;
  /** Model configuration (optional, partial override of defaults) */
  config?: Partial<AgentModelConfig>;
  /** System prompt/instructions (optional, will use type-based default if not provided) */
  systemPrompt?: string;
  /** Available tools (optional, defaults to empty array) */
  tools?: AvailableTool[];
}

/**
 * Input for updating an existing agent
 *
 * All fields are optional - only provided fields will be updated.
 */
export interface UpdateAgentInput {
  /** Agent name (1-100 characters if provided) */
  name?: string;
  /** Agent type (changing this will not reset config to new defaults) */
  type?: AgentType;
  /** Agent description */
  description?: string;
  /** Agent status (active, paused, or inactive) */
  status?: AgentStatus;
  /** Model configuration (partial update, merges with existing) */
  config?: Partial<AgentModelConfig>;
  /** System prompt/instructions */
  systemPrompt?: string;
  /** Available tools (replaces entire tools array if provided) */
  tools?: AvailableTool[];
}

/**
 * Filters for agent list queries
 *
 * Optional filters for listing and searching agents.
 */
export interface AgentFilters {
  /** Filter by type (exact match) */
  type?: AgentType;
  /** Filter by status (exact match) */
  status?: AgentStatus;
  /** Search query (case-insensitive partial match on name and description) */
  search?: string;
  /** Page number for pagination (1-based, default: 1) */
  page?: number;
  /** Items per page (max: 100, default: 20) */
  limit?: number;
}

/**
 * Paginated response for agent lists
 *
 * Standard pagination envelope for agent list responses.
 */
export interface AgentListResponse {
  /** Array of agents matching the query */
  data: Agent[];
  /** Total count of agents matching filters (before pagination) */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPrevPage: boolean;
}

/**
 * Available tools that agents can use
 *
 * Readonly list of capabilities that can be assigned to agents.
 * Each tool enables specific functionality for the agent.
 */
export const AVAILABLE_TOOLS = [
  'web_search',
  'code_execution',
  'file_operations',
  'data_analysis',
  'api_calls',
  'database_query',
  'image_generation',
  'text_analysis',
  'translation',
  'summarization',
] as const;

/**
 * Union type of all available tool names
 */
export type AvailableTool = typeof AVAILABLE_TOOLS[number];

/**
 * Type guard to check if a string is a valid AvailableTool
 *
 * @param tool - The string to check
 * @returns True if the string is a valid AvailableTool
 */
export function isAvailableTool(tool: string): tool is AvailableTool {
  return AVAILABLE_TOOLS.includes(tool as AvailableTool);
}

/**
 * Serialized version of AgentStats for JSON API responses
 *
 * Dates are converted to ISO 8601 strings for JSON serialization.
 */
export interface AgentStatsSerialized {
  tasksCompleted: number;
  successRate: number;
  avgResponseTime: number;
  lastActive: string | null;
  tokensUsed?: number;
  totalCost?: number;
}

/**
 * Serialized version of Agent for JSON API responses
 *
 * All Date fields are converted to ISO 8601 strings for JSON serialization.
 */
export interface AgentSerialized {
  id: string;
  workspaceId: string;
  name: string;
  type: AgentType;
  description: string;
  status: AgentStatus;
  config: AgentModelConfig;
  systemPrompt: string;
  tools: AvailableTool[];
  stats: AgentStatsSerialized;
  createdAt: string;
  updatedAt: string;
}

/**
 * Paginated response for agent lists (serialized)
 */
export interface AgentListResponseSerialized {
  data: AgentSerialized[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Type guard to check if a string is a valid AgentType
 *
 * @param type - The string to check
 * @returns True if the string is a valid AgentType
 */
export function isAgentType(type: string): type is AgentType {
  return ['task', 'research', 'coding', 'data', 'qa', 'support', 'custom'].includes(type);
}

/**
 * Type guard to check if a string is a valid AgentStatus
 *
 * @param status - The string to check
 * @returns True if the string is a valid AgentStatus
 */
export function isAgentStatus(status: string): status is AgentStatus {
  return ['active', 'paused', 'inactive'].includes(status);
}

/**
 * Default model configurations by agent type
 *
 * Readonly configuration presets optimized for each agent type.
 */
export const DEFAULT_MODEL_CONFIGS: Readonly<Record<AgentType, AgentModelConfig>> = {
  task: {
    model: 'claude-3-haiku',
    temperature: 0.5,
    maxTokens: 2048,
  },
  research: {
    model: 'claude-3-sonnet',
    temperature: 0.3,
    maxTokens: 4096,
  },
  coding: {
    model: 'claude-3-sonnet',
    temperature: 0.2,
    maxTokens: 8192,
  },
  data: {
    model: 'claude-3-sonnet',
    temperature: 0.1,
    maxTokens: 4096,
  },
  qa: {
    model: 'claude-3-haiku',
    temperature: 0.7,
    maxTokens: 2048,
  },
  support: {
    model: 'claude-3-haiku',
    temperature: 0.6,
    maxTokens: 2048,
  },
  custom: {
    model: 'claude-3-haiku',
    temperature: 0.5,
    maxTokens: 2048,
  },
};

/**
 * Metadata for displaying agent type information in the UI
 */
export interface AgentTypeMetadata {
  /** Display label for the agent type */
  label: string;
  /** Human-readable description of what this agent type does */
  description: string;
  /** Icon or emoji representing the agent type */
  icon: string;
}

/**
 * Agent type display metadata
 *
 * Readonly metadata for rendering agent types in the UI.
 */
export const AGENT_TYPE_METADATA: Readonly<Record<AgentType, AgentTypeMetadata>> = {
  task: {
    label: 'Task Agent',
    description: 'General-purpose task execution and automation',
    icon: '✓',
  },
  research: {
    label: 'Research Agent',
    description: 'Information gathering and analysis',
    icon: '🔍',
  },
  coding: {
    label: 'Coding Agent',
    description: 'Code generation, review, and debugging',
    icon: '💻',
  },
  data: {
    label: 'Data Agent',
    description: 'Data processing and analysis',
    icon: '📊',
  },
  qa: {
    label: 'QA Agent',
    description: 'Testing and quality assurance',
    icon: '🧪',
  },
  support: {
    label: 'Support Agent',
    description: 'Customer and user support',
    icon: '💬',
  },
  custom: {
    label: 'Custom Agent',
    description: 'Custom configured agent',
    icon: '⚙️',
  },
};

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Standard error response structure
 */
export interface AgentErrorResponse {
  error: {
    /** Error message */
    message: string;
    /** Error code for programmatic handling */
    code?: string;
    /** Validation errors (field-level) */
    errors?: Record<string, string[]>;
  };
}

/**
 * Single agent response
 */
export interface AgentResponse {
  /** The agent data */
  data: Agent;
  /** Optional success message */
  message?: string;
}

/**
 * Single agent response (serialized for JSON)
 */
export interface AgentResponseSerialized {
  /** The agent data (serialized) */
  data: AgentSerialized;
  /** Optional success message */
  message?: string;
}

/**
 * Agent deletion response
 */
export interface AgentDeleteResponse {
  /** Success indicator */
  success: boolean;
  /** Success message */
  message: string;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Partial agent for optimistic updates
 */
export type PartialAgent = Partial<Agent> & Pick<Agent, 'id'>;

/**
 * Agent creation payload (includes all required computed fields)
 */
export interface AgentCreatePayload extends CreateAgentInput {
  workspaceId: string;
  createdById: string;
}

/**
 * Agent update payload (includes tracking fields)
 */
export interface AgentUpdatePayload extends UpdateAgentInput {
  id: string;
  updatedById?: string;
}
