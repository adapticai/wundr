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
 * // Spawn an agent with permission inheritance
 * const run = lifecycle.spawn({
 *   agentId: 'eng-code-surgeon',
 *   task: 'Refactor auth module',
 *   requesterSessionKey: 'agent:main:main',
 *   requesterDisplayKey: 'main',
 *   parentRunId: parentRun.runId,
 *   memoryScope: 'project',
 * });
 *
 * // Record heartbeats from the running agent
 * lifecycle.recordHeartbeat(run.runId);
 *
 * // Check health of all running agents
 * const { dead, restarted } = lifecycle.checkHealth();
 *
 * // Save/restore agent state across sessions
 * lifecycle.saveAgentState('eng-code-surgeon', 'project', { lastFile: 'auth.ts' });
 * const state = lifecycle.getAgentState('eng-code-surgeon');
 *
 * // Resolve effective tools with parent restrictions
 * const tools = registry.resolveEffectiveTools('eng-code-surgeon', allTools, parentRestrictions);
 *
 * // Find agents eligible for Task(developer) spawn
 * const candidates = registry.findSpawnCandidates('developer', { maxTier: 3 });
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
  MemoryScope,
  ToolRestrictions,
  AgentPermissions,
  HeartbeatConfig,
  AgentMetadata,
  AgentDefinition,
  AgentRunOutcome,
  MailboxMessage,
  AgentRunRecord,
  PersistedAgentRegistry,
  PersistedAgentRegistryV1,
  AgentPersistedState,
  AgentFrontmatterConfig,
  SpawnParams,
  ResourceLimits,
  ResourceUsage,
  AgentGroup,
  AgentRequirements,
  RegistryStats,
  SynthesisStrategy,
  SynthesisConflict,
  SynthesizedResult,
  SpawnMode,
  AgentHealthStatus,
  AgentExecutionContext,
  AgentEventType,
  AgentEvent,
  AgentOutputFragment,
  AgentGroupConfig,
  AgentDirectorySource,
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
  MemoryScopeSchema,
  ToolRestrictionsSchema,
  AgentMetadataSchema,
  SynthesisStrategySchema,
  SpawnModeSchema,
  DEFAULT_RESOURCE_LIMITS,
  DEFAULT_HEARTBEAT_CONFIG,
  DEFAULT_MAX_TURNS_BY_TYPE,
  REGISTRY_VERSION,
  PERSISTED_STATE_VERSION,
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
