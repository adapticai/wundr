/**
 * Wundr Lifecycle Hooks System
 *
 * Complete hook system for the orchestrator daemon, supporting 14 lifecycle
 * events with command, prompt, and agent execution types.
 *
 * @example
 * ```ts
 * import {
 *   createHookRegistry,
 *   createHookEngine,
 *   registerBuiltInHooks,
 * } from './hooks';
 *
 * const registry = createHookRegistry({ logger });
 * registerBuiltInHooks(registry, logger);
 *
 * // Load user config
 * registry.loadFromConfig(hooksConfig);
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
export type { HookEngineOptions } from './hook-engine';

// Built-in hooks
export { registerBuiltInHooks, getBuiltInHookIds } from './built-in-hooks';
