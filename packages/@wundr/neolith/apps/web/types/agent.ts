/**
 * Agent Types
 *
 * Type definitions for AI Agents - specialized worker agents
 * that can be configured and deployed for specific tasks.
 *
 * Note: Agents are distinct from VPs/Orchestrators which are higher-level
 * autonomous entities. Agents are task-oriented workers.
 */

/**
 * Agent type categories
 */
export type AgentType = 'task' | 'research' | 'coding' | 'data' | 'qa' | 'support' | 'custom';

/**
 * Agent status
 */
export type AgentStatus = 'active' | 'paused' | 'inactive';

/**
 * Agent model configuration
 */
export interface AgentModelConfig {
  /** Model identifier (e.g., "claude-3-opus", "gpt-4") */
  model: string;
  /** Temperature for response generation (0-1) */
  temperature: number;
  /** Maximum tokens per response */
  maxTokens: number;
  /** Optional top-p sampling parameter */
  topP?: number;
  /** Optional frequency penalty */
  frequencyPenalty?: number;
  /** Optional presence penalty */
  presencePenalty?: number;
}

/**
 * Agent performance statistics
 */
export interface AgentStats {
  /** Number of tasks completed */
  tasksCompleted: number;
  /** Success rate (0-100) */
  successRate: number;
  /** Average response time in milliseconds */
  avgResponseTime: number;
  /** Last time the agent was active */
  lastActive: Date | null;
  /** Total tokens consumed */
  tokensUsed?: number;
  /** Total cost in USD */
  totalCost?: number;
}

/**
 * Agent entity
 */
export interface Agent {
  /** Unique agent identifier */
  id: string;
  /** Workspace ID this agent belongs to */
  workspaceId: string;
  /** Agent name */
  name: string;
  /** Agent type */
  type: AgentType;
  /** Agent description */
  description: string;
  /** Current status */
  status: AgentStatus;
  /** Model configuration */
  config: AgentModelConfig;
  /** System prompt/instructions */
  systemPrompt: string;
  /** Available tools for the agent */
  tools: string[];
  /** Performance statistics */
  stats: AgentStats;
  /** Created timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Input for creating a new agent
 */
export interface CreateAgentInput {
  /** Agent name */
  name: string;
  /** Agent type */
  type: AgentType;
  /** Agent description */
  description?: string;
  /** Model configuration */
  config?: Partial<AgentModelConfig>;
  /** System prompt/instructions */
  systemPrompt?: string;
  /** Available tools */
  tools?: string[];
}

/**
 * Input for updating an existing agent
 */
export interface UpdateAgentInput {
  /** Agent name */
  name?: string;
  /** Agent type */
  type?: AgentType;
  /** Agent description */
  description?: string;
  /** Agent status */
  status?: AgentStatus;
  /** Model configuration */
  config?: Partial<AgentModelConfig>;
  /** System prompt/instructions */
  systemPrompt?: string;
  /** Available tools */
  tools?: string[];
}

/**
 * Filters for agent list queries
 */
export interface AgentFilters {
  /** Filter by type */
  type?: AgentType;
  /** Filter by status */
  status?: AgentStatus;
  /** Search query (matches name and description) */
  search?: string;
  /** Page number for pagination */
  page?: number;
  /** Items per page */
  limit?: number;
}

/**
 * Available tools that agents can use
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

export type AvailableTool = typeof AVAILABLE_TOOLS[number];

/**
 * Default model configurations by agent type
 */
export const DEFAULT_MODEL_CONFIGS: Record<AgentType, AgentModelConfig> = {
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
 * Agent type display metadata
 */
export const AGENT_TYPE_METADATA: Record<AgentType, { label: string; description: string; icon: string }> = {
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
