/**
 * @wundr.io/jit-tools - Type Definitions
 *
 * TypeScript interfaces and Zod schemas for Just-In-Time tool loading system.
 */

import { z } from 'zod';

// =============================================================================
// Core Interfaces
// =============================================================================

/**
 * Specification for a tool that can be loaded just-in-time
 */
export interface ToolSpec {
  /** Unique identifier for the tool */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description of what the tool does */
  description: string;
  /** Category for grouping related tools */
  category: ToolCategory;
  /** List of capabilities this tool provides */
  capabilities: string[];
  /** Required permissions to use this tool */
  permissions: ToolPermission[];
  /** Tool parameters schema */
  parameters: ToolParameter[];
  /** Example usage patterns */
  examples: ToolExample[];
  /** Semantic keywords for search matching */
  keywords: string[];
  /** Tool version */
  version: string;
  /** Priority weight for ranking (higher = more important) */
  priority: number;
  /** Estimated token cost when included in context */
  tokenCost: number;
  /** Dependencies on other tools */
  dependencies: string[];
  /** Tool metadata */
  metadata: ToolMetadata;
}

/**
 * Represents valid JSON primitive values
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Represents valid JSON values (recursive type for nested structures)
 */
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Record type for JSON-compatible data structures
 */
export type JsonRecord = Record<string, JsonValue>;

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Description of the parameter */
  description: string;
  /** Whether the parameter is required */
  required: boolean;
  /** Default value if not provided */
  defaultValue?: JsonValue;
  /** Enum values if applicable */
  enumValues?: string[];
}

/**
 * Tool usage example
 */
export interface ToolExample {
  /** Example description */
  description: string;
  /** Example input */
  input: JsonRecord;
  /** Expected output */
  output?: JsonRecord;
}

/**
 * Tool metadata
 */
export interface ToolMetadata {
  /** Tool author */
  author?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Whether the tool is deprecated */
  deprecated: boolean;
  /** Deprecation message if applicable */
  deprecationMessage?: string;
  /** Documentation URL */
  documentationUrl?: string;
  /** Custom properties */
  custom: JsonRecord;
}

/**
 * Tool permission levels
 */
export type ToolPermission =
  | 'read'
  | 'write'
  | 'execute'
  | 'network'
  | 'filesystem'
  | 'system'
  | 'admin';

/**
 * Tool categories for organization
 */
export type ToolCategory =
  | 'coordination'
  | 'monitoring'
  | 'memory'
  | 'neural'
  | 'github'
  | 'system'
  | 'governance'
  | 'analysis'
  | 'testing'
  | 'documentation'
  | 'deployment'
  | 'security'
  | 'custom';

// =============================================================================
// Tool Retrieval Types
// =============================================================================

/**
 * Result of a tool retrieval operation
 */
export interface ToolRetrievalResult {
  /** Retrieved tools ordered by relevance */
  tools: RetrievedTool[];
  /** Total number of matching tools */
  totalMatches: number;
  /** Query that was used */
  query: string;
  /** Time taken to retrieve (ms) */
  retrievalTimeMs: number;
  /** Total token cost of retrieved tools */
  totalTokenCost: number;
  /** Retrieval metadata */
  metadata: RetrievalMetadata;
}

/**
 * A tool retrieved with relevance scoring
 */
export interface RetrievedTool {
  /** The tool specification */
  tool: ToolSpec;
  /** Relevance score (0-1) */
  relevanceScore: number;
  /** Semantic similarity score (0-1) */
  semanticScore: number;
  /** Keyword match score (0-1) */
  keywordScore: number;
  /** Permission match score (0-1) */
  permissionScore: number;
  /** Combined final score */
  finalScore: number;
  /** Matching reasons */
  matchReasons: string[];
}

/**
 * Metadata about the retrieval operation
 */
export interface RetrievalMetadata {
  /** Number of tools scanned */
  toolsScanned: number;
  /** Number of tools filtered by permissions */
  filteredByPermissions: number;
  /** Number of tools filtered by score threshold */
  filteredByScore: number;
  /** Semantic search was used */
  usedSemanticSearch: boolean;
  /** Cache was hit */
  cacheHit: boolean;
}

// =============================================================================
// JIT Configuration Types
// =============================================================================

/**
 * Configuration for JIT tool loading
 */
export interface JITToolConfig {
  /** Maximum number of tools to include in context */
  maxTools: number;
  /** Maximum total token budget for tools */
  maxTokenBudget: number;
  /** Minimum relevance score threshold (0-1) */
  minRelevanceScore: number;
  /** Enable semantic search for tool matching */
  enableSemanticSearch: boolean;
  /** Enable caching of retrieval results */
  enableCaching: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  /** Permission filtering mode */
  permissionMode: 'strict' | 'lenient' | 'disabled';
  /** Tool categories to include (empty = all) */
  includedCategories: ToolCategory[];
  /** Tool categories to exclude */
  excludedCategories: ToolCategory[];
  /** Custom scoring weights */
  scoringWeights: ScoringWeights;
  /** Retrieval timeout in milliseconds */
  retrievalTimeoutMs: number;
}

/**
 * Weights for different scoring factors
 */
export interface ScoringWeights {
  /** Weight for semantic similarity */
  semantic: number;
  /** Weight for keyword matching */
  keyword: number;
  /** Weight for permission matching */
  permission: number;
  /** Weight for tool priority */
  priority: number;
  /** Weight for category relevance */
  category: number;
}

/**
 * Default JIT configuration
 */
export const DEFAULT_JIT_CONFIG: JITToolConfig = {
  maxTools: 10,
  maxTokenBudget: 4000,
  minRelevanceScore: 0.3,
  enableSemanticSearch: true,
  enableCaching: true,
  cacheTtlMs: 300000, // 5 minutes
  permissionMode: 'lenient',
  includedCategories: [],
  excludedCategories: [],
  scoringWeights: {
    semantic: 0.4,
    keyword: 0.25,
    permission: 0.15,
    priority: 0.1,
    category: 0.1,
  },
  retrievalTimeoutMs: 5000,
};

// =============================================================================
// Agent Context Types
// =============================================================================

/**
 * Context for an AI agent that tools are being loaded for
 */
export interface AgentContext {
  /** Unique agent identifier */
  agentId: string;
  /** Agent type/role */
  agentType: string;
  /** Current session ID */
  sessionId: string;
  /** Agent capabilities */
  capabilities: string[];
  /** Granted permissions */
  permissions: ToolPermission[];
  /** Current task context */
  taskContext?: TaskContext;
  /** Historical tool usage */
  toolHistory: ToolUsageRecord[];
  /** Agent preferences */
  preferences: AgentPreferences;
  /** Custom context data */
  customData: JsonRecord;
}

/**
 * Context about the current task
 */
export interface TaskContext {
  /** Task identifier */
  taskId: string;
  /** Task type */
  taskType: string;
  /** Task description */
  description: string;
  /** Required capabilities */
  requiredCapabilities: string[];
  /** Task priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Task metadata */
  metadata: JsonRecord;
}

/**
 * Record of tool usage for learning
 */
export interface ToolUsageRecord {
  /** Tool ID */
  toolId: string;
  /** When it was used */
  usedAt: Date;
  /** Whether it was successful */
  success: boolean;
  /** Relevance feedback */
  relevanceFeedback?: 'helpful' | 'neutral' | 'not_helpful';
  /** Context in which it was used */
  context?: string;
}

/**
 * Agent preferences for tool loading
 */
export interface AgentPreferences {
  /** Preferred tool categories */
  preferredCategories: ToolCategory[];
  /** Preferred tools (by ID) */
  preferredTools: string[];
  /** Excluded tools (by ID) */
  excludedTools: string[];
  /** Maximum context size preference */
  maxContextSize: 'minimal' | 'standard' | 'extended';
}

// =============================================================================
// Intent Analysis Types
// =============================================================================

/**
 * Parsed intent from an agent request
 */
export interface ParsedIntent {
  /** Primary intent action */
  action: string;
  /** Target entities */
  entities: IntentEntity[];
  /** Detected capabilities needed */
  requiredCapabilities: string[];
  /** Detected categories relevant */
  relevantCategories: ToolCategory[];
  /** Keywords extracted */
  keywords: string[];
  /** Confidence score (0-1) */
  confidence: number;
  /** Original query */
  originalQuery: string;
  /** Normalized query for search */
  normalizedQuery: string;
}

/**
 * Entity extracted from intent
 */
export interface IntentEntity {
  /** Entity type */
  type: string;
  /** Entity value */
  value: string;
  /** Position in original query */
  startIndex: number;
  /** End position in original query */
  endIndex: number;
  /** Confidence score */
  confidence: number;
}

// =============================================================================
// Context Injection Types
// =============================================================================

/**
 * Result of injecting tools into agent context
 */
export interface InjectionResult {
  /** Whether injection was successful */
  success: boolean;
  /** Injected tools */
  injectedTools: ToolSpec[];
  /** Total tokens used */
  tokensUsed: number;
  /** Tokens remaining in budget */
  tokensRemaining: number;
  /** Tools that were excluded */
  excludedTools: ExcludedTool[];
  /** Formatted context string */
  contextString: string;
  /** Injection timestamp */
  timestamp: Date;
}

/**
 * Tool that was excluded from injection
 */
export interface ExcludedTool {
  /** Tool that was excluded */
  tool: ToolSpec;
  /** Reason for exclusion */
  reason: ExclusionReason;
}

/**
 * Reasons for tool exclusion
 */
export type ExclusionReason =
  | 'token_budget_exceeded'
  | 'max_tools_exceeded'
  | 'permission_denied'
  | 'low_relevance'
  | 'category_excluded'
  | 'explicitly_excluded'
  | 'deprecated';

// =============================================================================
// Event Types
// =============================================================================

/**
 * Events emitted by the JIT tool system
 */
export type JITToolEvent =
  | 'tool:registered'
  | 'tool:unregistered'
  | 'tool:updated'
  | 'retrieval:started'
  | 'retrieval:completed'
  | 'retrieval:error'
  | 'injection:started'
  | 'injection:completed'
  | 'injection:error'
  | 'cache:hit'
  | 'cache:miss'
  | 'cache:invalidated';

/**
 * Event payload base interface
 */
export interface JITToolEventPayload {
  /** Event type */
  event: JITToolEvent;
  /** Event timestamp */
  timestamp: Date;
  /** Event data */
  data: JsonRecord;
}

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

/**
 * Schema for JSON primitive values
 */
export const JsonPrimitiveSchema: z.ZodType<JsonPrimitive> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

/**
 * Schema for JSON values (recursive)
 */
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    JsonPrimitiveSchema,
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ])
);

/**
 * Schema for JSON record
 */
export const JsonRecordSchema: z.ZodType<JsonRecord> = z.record(
  z.string(),
  JsonValueSchema
);

/**
 * Schema for ToolPermission
 */
export const ToolPermissionSchema = z.enum([
  'read',
  'write',
  'execute',
  'network',
  'filesystem',
  'system',
  'admin',
]);

/**
 * Schema for ToolCategory
 */
export const ToolCategorySchema = z.enum([
  'coordination',
  'monitoring',
  'memory',
  'neural',
  'github',
  'system',
  'governance',
  'analysis',
  'testing',
  'documentation',
  'deployment',
  'security',
  'custom',
]);

/**
 * Schema for ToolParameter
 */
export const ToolParameterSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string(),
  required: z.boolean(),
  defaultValue: JsonValueSchema.optional(),
  enumValues: z.array(z.string()).optional(),
});

/**
 * Schema for ToolExample
 */
export const ToolExampleSchema = z.object({
  description: z.string(),
  input: JsonRecordSchema,
  output: JsonRecordSchema.optional(),
});

/**
 * Schema for ToolMetadata
 */
export const ToolMetadataSchema = z.object({
  author: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deprecated: z.boolean(),
  deprecationMessage: z.string().optional(),
  documentationUrl: z.string().url().optional(),
  custom: JsonRecordSchema,
});

/**
 * Schema for ToolSpec
 */
export const ToolSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: ToolCategorySchema,
  capabilities: z.array(z.string()),
  permissions: z.array(ToolPermissionSchema),
  parameters: z.array(ToolParameterSchema),
  examples: z.array(ToolExampleSchema),
  keywords: z.array(z.string()),
  version: z.string(),
  priority: z.number().min(0).max(100),
  tokenCost: z.number().int().nonnegative(),
  dependencies: z.array(z.string()),
  metadata: ToolMetadataSchema,
});

/**
 * Schema for ScoringWeights
 */
export const ScoringWeightsSchema = z.object({
  semantic: z.number().min(0).max(1),
  keyword: z.number().min(0).max(1),
  permission: z.number().min(0).max(1),
  priority: z.number().min(0).max(1),
  category: z.number().min(0).max(1),
});

/**
 * Schema for JITToolConfig
 */
export const JITToolConfigSchema = z.object({
  maxTools: z.number().int().positive(),
  maxTokenBudget: z.number().int().positive(),
  minRelevanceScore: z.number().min(0).max(1),
  enableSemanticSearch: z.boolean(),
  enableCaching: z.boolean(),
  cacheTtlMs: z.number().int().positive(),
  permissionMode: z.enum(['strict', 'lenient', 'disabled']),
  includedCategories: z.array(ToolCategorySchema),
  excludedCategories: z.array(ToolCategorySchema),
  scoringWeights: ScoringWeightsSchema,
  retrievalTimeoutMs: z.number().int().positive(),
});

/**
 * Schema for TaskContext
 */
export const TaskContextSchema = z.object({
  taskId: z.string(),
  taskType: z.string(),
  description: z.string(),
  requiredCapabilities: z.array(z.string()),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  metadata: JsonRecordSchema,
});

/**
 * Schema for ToolUsageRecord
 */
export const ToolUsageRecordSchema = z.object({
  toolId: z.string(),
  usedAt: z.date(),
  success: z.boolean(),
  relevanceFeedback: z.enum(['helpful', 'neutral', 'not_helpful']).optional(),
  context: z.string().optional(),
});

/**
 * Schema for AgentPreferences
 */
export const AgentPreferencesSchema = z.object({
  preferredCategories: z.array(ToolCategorySchema),
  preferredTools: z.array(z.string()),
  excludedTools: z.array(z.string()),
  maxContextSize: z.enum(['minimal', 'standard', 'extended']),
});

/**
 * Schema for AgentContext
 */
export const AgentContextSchema = z.object({
  agentId: z.string(),
  agentType: z.string(),
  sessionId: z.string(),
  capabilities: z.array(z.string()),
  permissions: z.array(ToolPermissionSchema),
  taskContext: TaskContextSchema.optional(),
  toolHistory: z.array(ToolUsageRecordSchema),
  preferences: AgentPreferencesSchema,
  customData: JsonRecordSchema,
});

/**
 * Schema for ParsedIntent
 */
export const ParsedIntentSchema = z.object({
  action: z.string(),
  entities: z.array(
    z.object({
      type: z.string(),
      value: z.string(),
      startIndex: z.number().int().nonnegative(),
      endIndex: z.number().int().nonnegative(),
      confidence: z.number().min(0).max(1),
    })
  ),
  requiredCapabilities: z.array(z.string()),
  relevantCategories: z.array(ToolCategorySchema),
  keywords: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  originalQuery: z.string(),
  normalizedQuery: z.string(),
});
