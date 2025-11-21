/**
 * Base RAG Agent Template
 *
 * This is the foundational template for all RAG-enabled agents in the Wundr ecosystem.
 * It provides common RAG capabilities including search, store management, and context building.
 *
 * @module templates/agents/base-rag-agent
 */

// RAG Capability Definitions
export interface RagCapabilities {
  /** Enable RAG search functionality */
  ragSearch: boolean;
  /** Enable RAG store management operations */
  ragStoreManagement: boolean;
  /** Enable automatic context building from RAG results */
  ragContextBuilding: boolean;
}

// RAG Query Configuration
export interface RagQuery {
  /** Query string to search for relevant content */
  query: string;
  /** File types to filter results (e.g., 'code', 'tests', 'docs') */
  fileTypes?: string[];
  /** Maximum number of results to return */
  maxResults?: number;
  /** Minimum similarity score threshold (0-1) */
  minScore?: number;
  /** Additional metadata filters */
  filters?: Record<string, unknown>;
}

// RAG Search Result
export interface RagSearchResult {
  /** Unique identifier for the result */
  id: string;
  /** Content snippet from the matched document */
  content: string;
  /** File path of the source document */
  filePath: string;
  /** Similarity score (0-1) */
  score: number;
  /** Additional metadata about the result */
  metadata: {
    fileType: string;
    lastModified: Date;
    lineNumbers?: { start: number; end: number };
    [key: string]: unknown;
  };
}

// Hook Configuration
export interface AgentHooks {
  /** Hook to run before task execution */
  preTask?: string;
  /** Hook to run after task completion */
  postTask?: string;
  /** Hook to run on task failure */
  onError?: string;
}

// Agent Template Configuration
export interface BaseRagAgentConfig {
  /** Agent identifier */
  id: string;
  /** Agent display name */
  name: string;
  /** Agent description */
  description?: string;
  /** RAG capabilities for this agent */
  capabilities: RagCapabilities;
  /** Default file types to search */
  defaultFileTypes: string[];
  /** Pre-task queries to enhance context */
  preTaskQueries: RagQuery[];
  /** System prompt with RAG usage instructions */
  systemPrompt: string;
  /** Hook configurations */
  hooks: AgentHooks;
  /** Maximum context tokens from RAG results */
  maxContextTokens?: number;
  /** Whether to cache RAG results */
  enableCaching?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
}

// RAG Context Enhancement Result
export interface RagContextEnhancement {
  /** Enhanced context string to prepend to prompts */
  enhancedContext: string;
  /** Search results used for enhancement */
  sources: RagSearchResult[];
  /** Total tokens used for context */
  tokenCount: number;
  /** Whether context was truncated */
  wasTruncated: boolean;
}

// RAG Impact Analysis Result
export interface RagImpactAnalysis {
  /** Files potentially impacted by changes */
  impactedFiles: string[];
  /** Suggested updates based on changes */
  suggestedUpdates: Array<{
    filePath: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  /** Relevance score of the analysis */
  confidenceScore: number;
}

/**
 * Default system prompt for RAG-enabled agents
 */
const DEFAULT_RAG_SYSTEM_PROMPT = `
You are a RAG-enabled agent with access to a knowledge base of project files and documentation.

## RAG Usage Instructions

### Before Starting Any Task:
1. Use RAG search to find relevant existing code, patterns, and documentation
2. Review search results to understand current implementations
3. Identify reusable components and established conventions

### During Task Execution:
1. Reference found patterns and follow established conventions
2. Reuse existing utilities and helper functions when appropriate
3. Maintain consistency with the codebase style and structure

### RAG Search Best Practices:
- Use specific, targeted queries for better results
- Filter by file types relevant to your task
- Consider searching for related tests and documentation
- Look for similar implementations before creating new code

### Context Building:
- Prioritize high-relevance results (score > 0.7)
- Include both code and documentation context
- Note file paths for proper import references
- Identify potential conflicts or duplications

### Quality Assurance:
- Verify that new code doesn't duplicate existing functionality
- Ensure naming conventions match existing patterns
- Check for potential impact on related files
- Update relevant tests and documentation
`.trim();

/**
 * Base RAG Agent Template
 *
 * This template provides the foundation for all RAG-enabled agents.
 * Extend this template to create specialized agent configurations.
 */
export const baseRagAgentTemplate: BaseRagAgentConfig = {
  id: 'base-rag-agent',
  name: 'Base RAG Agent',
  description: 'Foundational RAG-enabled agent template with search, store management, and context building capabilities',
  capabilities: {
    ragSearch: true,
    ragStoreManagement: true,
    ragContextBuilding: true,
  },
  defaultFileTypes: ['code', 'docs', 'config'],
  preTaskQueries: [],
  systemPrompt: DEFAULT_RAG_SYSTEM_PROMPT,
  hooks: {
    preTask: 'rag-context-enhancer',
    postTask: 'rag-impact-analyzer',
  },
  maxContextTokens: 4096,
  enableCaching: true,
  cacheTtlMs: 300000, // 5 minutes
};

/**
 * Create a new RAG agent configuration by extending the base template
 *
 * @param overrides - Configuration overrides to apply to the base template
 * @returns A new agent configuration with merged settings
 */
export function createRagAgentConfig(
  overrides: Partial<BaseRagAgentConfig> & Pick<BaseRagAgentConfig, 'id' | 'name'>,
): BaseRagAgentConfig {
  return {
    ...baseRagAgentTemplate,
    ...overrides,
    capabilities: {
      ...baseRagAgentTemplate.capabilities,
      ...overrides.capabilities,
    },
    hooks: {
      ...baseRagAgentTemplate.hooks,
      ...overrides.hooks,
    },
    preTaskQueries: [
      ...baseRagAgentTemplate.preTaskQueries,
      ...(overrides.preTaskQueries || []),
    ],
    // Append custom system prompt to base prompt if provided
    systemPrompt: overrides.systemPrompt
      ? `${baseRagAgentTemplate.systemPrompt}\n\n## Agent-Specific Instructions\n\n${overrides.systemPrompt}`
      : baseRagAgentTemplate.systemPrompt,
  };
}

/**
 * Utility function to create a RAG query
 *
 * @param query - The search query string
 * @param options - Additional query options
 * @returns A properly formatted RagQuery object
 */
export function createRagQuery(
  query: string,
  options: Partial<Omit<RagQuery, 'query'>> = {},
): RagQuery {
  return {
    query,
    maxResults: 10,
    minScore: 0.5,
    ...options,
  };
}

/**
 * Type guard to check if a configuration is a valid BaseRagAgentConfig
 */
export function isValidRagAgentConfig(config: unknown): config is BaseRagAgentConfig {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  const c = config as Partial<BaseRagAgentConfig>;

  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    typeof c.capabilities === 'object' &&
    c.capabilities !== null &&
    typeof c.capabilities.ragSearch === 'boolean' &&
    typeof c.capabilities.ragStoreManagement === 'boolean' &&
    typeof c.capabilities.ragContextBuilding === 'boolean' &&
    typeof c.systemPrompt === 'string' &&
    typeof c.hooks === 'object' &&
    c.hooks !== null
  );
}
