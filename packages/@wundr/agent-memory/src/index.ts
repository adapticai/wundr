/**
 * @wundr.io/agent-memory - MemGPT-inspired Tiered Memory Architecture for AI Agents
 *
 * This package implements a sophisticated memory system inspired by MemGPT,
 * featuring tiered memory (scratchpad, episodic, semantic), human-like forgetting
 * curves, and intelligent context compilation for AI agents.
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Manager
// ============================================================================

// ============================================================================
// Convenience Factory Function
// ============================================================================

import { AgentMemoryManager } from './memory-manager';

import type { AgentMemoryManagerOptions } from './memory-manager';

export { AgentMemoryManager } from './memory-manager';
export type { AgentMemoryManagerOptions } from './memory-manager';

// ============================================================================
// Memory Tiers
// ============================================================================

export { Scratchpad } from './scratchpad';
export type { ScratchpadConfig } from './scratchpad';

export { EpisodicStore } from './episodic-store';
export type { EpisodicStoreConfig, EpisodeMetadata } from './episodic-store';

export { SemanticStore } from './semantic-store';
export type {
  SemanticStoreConfig,
  SemanticMetadata,
  KnowledgeCategory,
} from './semantic-store';

// ============================================================================
// Forgetting Curve
// ============================================================================

export { ForgettingCurve } from './forgetting-curve';
export type {
  ForgettingResult,
  BatchForgettingResult,
  RepetitionSchedule,
} from './forgetting-curve';

// ============================================================================
// Session Management
// ============================================================================

export { SessionManager } from './session-manager';
export type {
  SessionPersistenceOptions,
  CreateSessionOptions,
  SessionSummary,
} from './session-manager';

// ============================================================================
// Types & Schemas
// ============================================================================

export {
  // Zod Schemas for validation
  MemoryTierConfigSchema,
  ForgettingCurveConfigSchema,
  MemoryConfigSchema,
  MemoryMetadataSchema,
  MemorySchema,
  ManagedContextSchema,
  SessionStateSchema,
  // TypeScript types
  type MemoryTierConfig,
  type ForgettingCurveConfig,
  type MemoryConfig,
  type MemoryMetadata,
  type Memory,
  type ManagedContext,
  type SessionState,
  // Additional types
  type MemoryTier,
  type MemorySource,
  type StoreMemoryOptions,
  type RetrieveMemoryOptions,
  type RetrievalResult,
  type CompileContextOptions,
  type TierStatistics,
  type MemoryStatistics,
  type MemoryEventType,
  type MemoryEvent,
  type MemoryEventHandler,
  type CompactionResult,
  type ConsolidationResult,
  // Default configuration
  DEFAULT_MEMORY_CONFIG,
} from './types';

/**
 * Create and initialize an AgentMemoryManager with sensible defaults
 *
 * @param options - Optional configuration overrides
 * @returns Initialized AgentMemoryManager
 *
 * @example
 * ```typescript
 * import { createMemoryManager } from '@wundr.io/agent-memory';
 *
 * const memory = await createMemoryManager({
 *   config: {
 *     scratchpad: { maxTokens: 4000 },
 *   },
 * });
 *
 * // Start a session
 * await memory.startSession({ agentIds: ['my-agent'] });
 *
 * // Store a memory
 * await memory.store(
 *   { role: 'user', content: 'Hello!' },
 *   { source: 'user' }
 * );
 *
 * // Compile context for LLM
 * const context = await memory.compileContext({
 *   systemPrompt: 'You are a helpful assistant.',
 *   maxTokens: 8000,
 * });
 * ```
 */
export async function createMemoryManager(
  options: AgentMemoryManagerOptions = {},
): Promise<AgentMemoryManager> {
  const manager = new AgentMemoryManager(options);
  await manager.initialize();
  return manager;
}
