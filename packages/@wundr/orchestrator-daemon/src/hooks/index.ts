/**
 * Wundr Lifecycle Hooks System
 *
 * Complete hook system for the orchestrator daemon, supporting 14 lifecycle
 * events with command, prompt, and agent execution types.
 *
 * The system has four layers:
 * 1. **Types** (hook-types.ts) - Full type definitions for events, metadata, results,
 *    discovery, config, and eligibility.
 * 2. **Registry** (hook-registry.ts) - Registration, querying, config loading,
 *    and per-hook overrides.
 * 3. **Engine** (hook-engine.ts) - Execution with timeout, caching, chaining,
 *    parallel/sequential dispatch, and error isolation.
 * 4. **Discovery** (hook-discovery.ts) - File-system-based hook discovery from
 *    HOOK.md frontmatter files (mirroring OpenClaw's hook loading pattern).
 * 5. **Built-in Hooks** (built-in-hooks.ts) - Safety, logging, and guardrail
 *    hooks that ship with the orchestrator.
 * 6. **Status** (hook-status.ts) - Diagnostics, health checks, and status
 *    report generation.
 *
 * @example
 * ```ts
 * import {
 *   createHookRegistry,
 *   createHookEngine,
 *   registerBuiltInHooks,
 *   loadAndRegisterHooks,
 *   generateHookStatus,
 * } from './hooks';
 *
 * const registry = createHookRegistry({ logger });
 * registerBuiltInHooks(registry, logger);
 *
 * // Load user config
 * registry.loadFromConfig(hooksConfig);
 *
 * // Discover and load hooks from the file system
 * await loadAndRegisterHooks({
 *   config: hooksConfig,
 *   registry,
 *   workspaceDir: '/path/to/workspace',
 *   logger,
 * });
 *
 * // Register a programmatic hook
 * registry.register({
 *   id: 'my-custom-hook',
 *   event: 'PostToolUse',
 *   type: 'command',
 *   handler: async (metadata) => {
 *     console.log(`Tool ${metadata.toolName} completed in ${metadata.durationMs}ms`);
 *   },
 * });
 *
 * const engine = createHookEngine({ registry, logger });
 *
 * // Fire hooks
 * const result = await engine.fire('SessionStart', {
 *   sessionId: 'sess_123',
 *   orchestratorId: 'orch_1',
 *   startedAt: new Date().toISOString(),
 * });
 *
 * // Get system status
 * const status = generateHookStatus(registry, engine);
 * ```
 */

// Types
export type {
  // Event names
  HookEventName,
  HookType,
  HookSource,

  // Metadata types
  SessionStartMetadata,
  UserPromptSubmitMetadata,
  PreToolUseMetadata,
  PermissionRequestMetadata,
  PostToolUseMetadata,
  PostToolUseFailureMetadata,
  NotificationMetadata,
  SubagentStartMetadata,
  SubagentStopMetadata,
  StopMetadata,
  TeammateIdleMetadata,
  TaskCompletedMetadata,
  PreCompactMetadata,
  SessionEndMetadata,
  HookMetadataMap,

  // Result types
  UserPromptSubmitResult,
  PreToolUseResult,
  PermissionRequestResult,
  PreCompactResult,
  HookResultMap,
  ModifyingHookEvent,
  VoidHookEvent,

  // Handler and registration
  HookHandler,
  HookMatcher,
  HookRegistration,
  HooksConfig,
  HookOverrideConfig,
  LegacyHandlerConfig,

  // Discovery types
  HookFileMetadata,
  HookInstallSpec,
  HookInvocationPolicy,
  ParsedHookFrontmatter,
  DiscoveredHook,
  HookEntry,
  HookEligibilityContext,
  HookSnapshot,

  // Execution
  HookExecutionContext,
  HookExecutionResult,
  HookFireResult,
  HookLogger,

  // Interfaces
  IHookEngine,
  IHookRegistry,
} from './hook-types';

export { HOOK_EVENT_GROUPS } from './hook-types';

// Registry
export { HookRegistry, createHookRegistry } from './hook-registry';

// Engine
export { HookEngine, createHookEngine } from './hook-engine';
export type { HookEngineOptions, HookLLMClient, HookSessionSpawner } from './hook-engine';

// Built-in hooks
export { registerBuiltInHooks, getBuiltInHookIds } from './built-in-hooks';

// Discovery
export {
  parseFrontmatter,
  extractMetadata,
  resolveInvocationPolicy,
  resolveHookKey,
  hasBinary,
  shouldIncludeHook,
  loadHookEntriesFromDir,
  discoverHookEntries,
  buildHookSnapshot,
  loadAndRegisterHooks,
} from './hook-discovery';
export type {
  DiscoveryOptions,
  HookLoaderOptions,
} from './hook-discovery';

// Status & Diagnostics
export {
  generateHookStatus,
  generateGroupedView,
  compareSnapshots,
  formatHookStatus,
} from './hook-status';
export type {
  HookDiagnostic,
  HookSystemStatus,
  HookGroupedView,
} from './hook-status';
