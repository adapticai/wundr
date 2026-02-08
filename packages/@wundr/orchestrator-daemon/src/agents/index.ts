/**
 * @wundr/orchestrator-daemon - Subagent Registry Module
 *
 * Central module for agent definition loading, registry management,
 * and lifecycle tracking with persistence.
 *
 * Usage:
 * ```typescript
 * import {
 *   AgentLoader,
 *   AgentRegistry,
 *   AgentLifecycleManager,
 *   createAgentRegistry,
 *   createAgentLifecycleManager,
 * } from './agents';
 *
 * // Load and register all agents
 * const registry = await createAgentRegistry('/path/to/project');
 *
 * // Create lifecycle manager with persistence
 * const lifecycle = createAgentLifecycleManager(registry, '/path/to/state');
 * lifecycle.restore(); // Resume from disk
 *
 * // Spawn an agent
 * const run = lifecycle.spawn({
 *   agentId: 'eng-code-surgeon',
 *   task: 'Refactor auth module',
 *   requesterSessionKey: 'agent:main:main',
 *   requesterDisplayKey: 'main',
 * });
 * ```
 */

// Types
export type {
  AgentType,
  AgentTier,
  AgentPriority,
  ModelPreference,
  PermissionMode,
  CleanupMode,
  RunStatus,
  AgentMetadata,
  AgentDefinition,
  AgentRunOutcome,
  MailboxMessage,
  AgentRunRecord,
  PersistedAgentRegistry,
  SpawnParams,
  ResourceLimits,
  ResourceUsage,
  AgentGroup,
  AgentRequirements,
  RegistryStats,
  SynthesisStrategy,
  SynthesisConflict,
  SynthesizedResult,
} from './agent-types';

// Schemas
export {
  AgentTypeSchema,
  AgentTierSchema,
  AgentPrioritySchema,
  ModelPreferenceSchema,
  PermissionModeSchema,
  CleanupModeSchema,
  RunStatusSchema,
  AgentMetadataSchema,
  SynthesisStrategySchema,
  DEFAULT_RESOURCE_LIMITS,
  REGISTRY_VERSION,
} from './agent-types';

// Loader
export { AgentLoader, createAgentLoader } from './agent-loader';
export type { AgentLoaderOptions } from './agent-loader';

// Registry
export {
  AgentRegistry,
  createAgentRegistry,
  createEmptyRegistry,
} from './agent-registry';
export type { AgentRegistryOptions } from './agent-registry';

// Lifecycle
export {
  AgentLifecycleManager,
  createAgentLifecycleManager,
} from './agent-lifecycle';
export type { AgentLifecycleOptions } from './agent-lifecycle';
