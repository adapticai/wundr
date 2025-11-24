/**
 * @wundr.io/jit-tools
 *
 * Just-In-Time (JIT) tool loading for AI agents to prevent context pollution.
 * Provides semantic search, relevance ranking, and runtime tool injection.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import {
 *   ToolRegistry,
 *   JITToolRetriever,
 *   ContextInjector,
 *   createToolSpec,
 * } from '@wundr.io/jit-tools';
 *
 * // Create registry and register tools
 * const registry = new ToolRegistry();
 * await registry.register(createToolSpec({
 *   id: 'code-review',
 *   name: 'Code Review Tool',
 *   description: 'Reviews code for quality issues',
 *   category: 'analysis',
 *   capabilities: ['code-review', 'quality-check'],
 * }));
 *
 * // Create retriever and injector
 * const retriever = new JITToolRetriever(registry);
 * const injector = new ContextInjector(retriever);
 *
 * // Inject relevant tools for a query
 * const result = await injector.inject('Review this pull request', agentContext);
 * console.log(result.contextString);
 * ```
 */

// =============================================================================
// Type Exports
// =============================================================================

// =============================================================================
// Convenience Factory Function
// =============================================================================

import { ContextInjector } from './context-injector';
import { ToolRegistry } from './tool-registry';
import { JITToolRetriever } from './tool-retriever';

import type { InjectionOptions } from './context-injector';
import type { JITToolConfig } from './types';

export type {
  // Core Types
  ToolSpec,
  ToolParameter,
  ToolExample,
  ToolMetadata,
  ToolPermission,
  ToolCategory,

  // JSON Type Safety Types
  JsonPrimitive,
  JsonValue,
  JsonRecord,

  // Retrieval Types
  ToolRetrievalResult,
  RetrievedTool,
  RetrievalMetadata,

  // Configuration Types
  JITToolConfig,
  ScoringWeights,

  // Agent Context Types
  AgentContext,
  TaskContext,
  ToolUsageRecord,
  AgentPreferences,

  // Intent Analysis Types
  ParsedIntent,
  IntentEntity,

  // Injection Types
  InjectionResult,
  ExcludedTool,
  ExclusionReason,

  // Event Types
  JITToolEvent,
  JITToolEventPayload,
} from './types';

// =============================================================================
// Schema Exports
// =============================================================================

export {
  // JSON Type Safety Schemas
  JsonPrimitiveSchema,
  JsonValueSchema,
  JsonRecordSchema,

  // Zod Schemas
  ToolPermissionSchema,
  ToolCategorySchema,
  ToolParameterSchema,
  ToolExampleSchema,
  ToolMetadataSchema,
  ToolSpecSchema,
  ScoringWeightsSchema,
  JITToolConfigSchema,
  TaskContextSchema,
  ToolUsageRecordSchema,
  AgentPreferencesSchema,
  AgentContextSchema,
  ParsedIntentSchema,

  // Default Configuration
  DEFAULT_JIT_CONFIG,
} from './types';

// =============================================================================
// Tool Registry Exports
// =============================================================================

export { ToolRegistry, createToolSpec } from './tool-registry';

export type {
  RegisterToolOptions,
  SearchToolsOptions,
  RegistrationResult,
  RegistryStats,
} from './tool-registry';

// =============================================================================
// Intent Analyzer Exports
// =============================================================================

export {
  IntentAnalyzer,
  createIntentAnalyzer,
  DEFAULT_INTENT_ANALYZER_CONFIG,
} from './intent-analyzer';

export type {
  IntentAnalyzerConfig,
  ActionPattern,
  EntityPattern,
} from './intent-analyzer';

// =============================================================================
// Tool Retriever Exports
// =============================================================================

export { JITToolRetriever, createToolRetriever } from './tool-retriever';

export type { RetrievalOptions } from './tool-retriever';

// =============================================================================
// Context Injector Exports
// =============================================================================

export {
  ContextInjector,
  createContextInjector,
  DEFAULT_INJECTION_OPTIONS,
} from './context-injector';

export type { InjectionOptions, FormattedTool } from './context-injector';

/**
 * Configuration for creating a complete JIT tools system
 */
export interface JITToolsSystemConfig {
  /** JIT tool configuration */
  jitConfig?: Partial<JITToolConfig>;
  /** Default injection options */
  injectionOptions?: Partial<InjectionOptions>;
}

/**
 * Complete JIT tools system with all components
 */
export interface JITToolsSystem {
  /** Tool registry for managing tool specifications */
  registry: ToolRegistry;
  /** Tool retriever for semantic search */
  retriever: JITToolRetriever;
  /** Context injector for runtime injection */
  injector: ContextInjector;
}

/**
 * Create a complete JIT tools system with all components configured
 *
 * @param config - System configuration
 * @returns Complete JIT tools system
 *
 * @example
 * ```typescript
 * const system = createJITToolsSystem({
 *   jitConfig: { maxTools: 5, enableSemanticSearch: true },
 *   injectionOptions: { formatStyle: 'markdown' },
 * });
 *
 * // Register tools
 * await system.registry.register({ ... });
 *
 * // Use the injector
 * const result = await system.injector.inject('Help me with code review');
 * ```
 */
export function createJITToolsSystem(
  config: JITToolsSystemConfig = {},
): JITToolsSystem {
  const registry = new ToolRegistry();
  const retriever = new JITToolRetriever(registry, config.jitConfig);
  const injector = new ContextInjector(
    retriever,
    config.jitConfig,
    config.injectionOptions,
  );

  return {
    registry,
    retriever,
    injector,
  };
}

/**
 * Package version
 */
export const VERSION = '1.0.3';
