/**
 * Lifecycle Hook Type Definitions
 *
 * Complete type system for Wundr's lifecycle hooks, modeled after
 * Claude Code's hooks architecture (OpenClaw). Supports 14 hook types
 * spanning session lifecycle, tool execution, subagent management,
 * permission handling, notifications, and context compaction.
 */

// =============================================================================
// Hook Event Names
// =============================================================================

/**
 * All 14 lifecycle hook event names.
 *
 * These cover the full lifecycle of a Wundr orchestrator session,
 * from session start through tool use, subagent coordination,
 * context compaction, and session teardown.
 */
export type HookEventName =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PermissionRequest'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'Notification'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'Stop'
  | 'TeammateIdle'
  | 'TaskCompleted'
  | 'PreCompact'
  | 'SessionEnd';

/**
 * Grouping of hook events by lifecycle phase.
 * Useful for documentation, filtering, and UI display.
 */
export const HOOK_EVENT_GROUPS = {
  session: ['SessionStart', 'Stop', 'SessionEnd'] as const,
  prompt: ['UserPromptSubmit'] as const,
  tool: ['PreToolUse', 'PostToolUse', 'PostToolUseFailure'] as const,
  permission: ['PermissionRequest'] as const,
  subagent: ['SubagentStart', 'SubagentStop', 'TeammateIdle'] as const,
  task: ['TaskCompleted'] as const,
  context: ['PreCompact'] as const,
  notification: ['Notification'] as const,
} as const;

// =============================================================================
// Hook Execution Types
// =============================================================================

/**
 * The mechanism used to execute a hook handler.
 *
 * - command: Execute a shell command. Receives metadata via env vars and stdin JSON.
 * - prompt:  Send a prompt to the LLM and use the response as the hook result.
 * - agent:   Spawn a sub-invocation of the orchestrator to handle the hook.
 */
export type HookType = 'command' | 'prompt' | 'agent';

// =============================================================================
// Hook Metadata - Per-Event Payloads
// =============================================================================

/** Metadata passed to SessionStart hooks */
export interface SessionStartMetadata {
  sessionId: string;
  orchestratorId: string;
  startedAt: string; // ISO 8601
  resumedFrom?: string;
  config?: Record<string, unknown>;
}

/** Metadata passed to UserPromptSubmit hooks */
export interface UserPromptSubmitMetadata {
  sessionId: string;
  prompt: string;
  promptLength: number;
  source: 'cli' | 'ws' | 'api' | 'internal';
  timestamp: string;
}

/** Metadata passed to PreToolUse hooks */
export interface PreToolUseMetadata {
  sessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolCallId: string;
  iteration: number;
}

/** Metadata passed to PermissionRequest hooks */
export interface PermissionRequestMetadata {
  sessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  permissionType: 'execute' | 'read' | 'write' | 'network' | 'destructive';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
}

/** Metadata passed to PostToolUse hooks */
export interface PostToolUseMetadata {
  sessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: unknown;
  toolCallId: string;
  durationMs: number;
  success: true;
}

/** Metadata passed to PostToolUseFailure hooks */
export interface PostToolUseFailureMetadata {
  sessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolCallId: string;
  error: string;
  errorCode?: string;
  durationMs: number;
  success: false;
}

/** Metadata passed to Notification hooks */
export interface NotificationMetadata {
  sessionId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

/** Metadata passed to SubagentStart hooks */
export interface SubagentStartMetadata {
  sessionId: string;
  subagentId: string;
  parentSessionId: string;
  task: string;
  model?: string;
  startedAt: string;
}

/** Metadata passed to SubagentStop hooks */
export interface SubagentStopMetadata {
  sessionId: string;
  subagentId: string;
  parentSessionId: string;
  success: boolean;
  output?: string;
  error?: string;
  durationMs: number;
  tokensUsed?: number;
}

/** Metadata passed to Stop hooks */
export interface StopMetadata {
  sessionId: string;
  reason: 'user_request' | 'timeout' | 'error' | 'completed' | 'shutdown';
  graceful: boolean;
}

/** Metadata passed to TeammateIdle hooks */
export interface TeammateIdleMetadata {
  sessionId: string;
  teammateId: string;
  teamId: string;
  lastActiveAt: string;
  idleDurationMs: number;
  completedTask?: string;
}

/** Metadata passed to TaskCompleted hooks */
export interface TaskCompletedMetadata {
  sessionId: string;
  taskId: string;
  taskDescription: string;
  success: boolean;
  output?: string;
  error?: string;
  durationMs: number;
  tokensUsed: number;
  toolCallsMade: number;
}

/** Metadata passed to PreCompact hooks */
export interface PreCompactMetadata {
  sessionId: string;
  messageCount: number;
  tokenCount: number;
  compactionStrategy: string;
  estimatedReduction: number; // 0-1, percentage of context to be compacted
}

/** Metadata passed to SessionEnd hooks */
export interface SessionEndMetadata {
  sessionId: string;
  orchestratorId: string;
  endedAt: string;
  durationMs: number;
  reason: 'completed' | 'stopped' | 'failed' | 'timeout';
  metrics: {
    tokensUsed: number;
    toolCallsMade: number;
    tasksCompleted: number;
    errorsEncountered: number;
  };
}

/**
 * Union of all hook metadata types, discriminated by event name.
 */
export type HookMetadataMap = {
  SessionStart: SessionStartMetadata;
  UserPromptSubmit: UserPromptSubmitMetadata;
  PreToolUse: PreToolUseMetadata;
  PermissionRequest: PermissionRequestMetadata;
  PostToolUse: PostToolUseMetadata;
  PostToolUseFailure: PostToolUseFailureMetadata;
  Notification: NotificationMetadata;
  SubagentStart: SubagentStartMetadata;
  SubagentStop: SubagentStopMetadata;
  Stop: StopMetadata;
  TeammateIdle: TeammateIdleMetadata;
  TaskCompleted: TaskCompletedMetadata;
  PreCompact: PreCompactMetadata;
  SessionEnd: SessionEndMetadata;
};

// =============================================================================
// Hook Result Types
// =============================================================================

/**
 * Result types for hooks that can modify behavior (interceptors).
 *
 * Most hooks are fire-and-forget (void result). Some hooks
 * can return a result to modify the downstream behavior:
 * - UserPromptSubmit: can rewrite the prompt
 * - PreToolUse: can modify input or block execution
 * - PermissionRequest: can approve/deny automatically
 * - PreCompact: can customize compaction behavior
 */
export interface UserPromptSubmitResult {
  /** Modified prompt text. If undefined, original prompt is used. */
  prompt?: string;
  /** If true, the prompt is blocked from processing. */
  block?: boolean;
  /** Reason for blocking, shown to the user. */
  blockReason?: string;
}

export interface PreToolUseResult {
  /** Modified tool input. If undefined, original input is used. */
  toolInput?: Record<string, unknown>;
  /** If true, the tool call is blocked. */
  block?: boolean;
  /** Reason for blocking. */
  blockReason?: string;
}

export interface PermissionRequestResult {
  /** If provided, overrides the permission decision. */
  decision?: 'approve' | 'deny' | 'escalate';
  /** Reason for the decision. */
  reason?: string;
}

export interface PreCompactResult {
  /** If true, skip compaction this cycle. */
  skipCompaction?: boolean;
  /** Override compaction strategy. */
  strategy?: string;
  /** Messages to preserve (by index). */
  preserveMessageIndices?: number[];
}

/**
 * Maps hook events to their possible result types.
 * Events not in this map are void (fire-and-forget).
 */
export type HookResultMap = {
  UserPromptSubmit: UserPromptSubmitResult;
  PreToolUse: PreToolUseResult;
  PermissionRequest: PermissionRequestResult;
  PreCompact: PreCompactResult;
};

/** Events that can return modifying results */
export type ModifyingHookEvent = keyof HookResultMap;

/** Events that are fire-and-forget */
export type VoidHookEvent = Exclude<HookEventName, ModifyingHookEvent>;

// =============================================================================
// Hook Handler Definition
// =============================================================================

/**
 * A handler function for a specific hook event.
 *
 * For void hooks: returns void or Promise<void>.
 * For modifying hooks: returns the result type or void.
 */
export type HookHandler<E extends HookEventName = HookEventName> =
  E extends ModifyingHookEvent
    ? (metadata: HookMetadataMap[E]) => Promise<HookResultMap[E] | void> | HookResultMap[E] | void
    : (metadata: HookMetadataMap[E]) => Promise<void> | void;

// =============================================================================
// Hook Registration
// =============================================================================

/**
 * Matcher for filtering which hooks should fire.
 *
 * Supports glob patterns on tool names, session IDs, and more.
 */
export interface HookMatcher {
  /** Glob pattern for tool names (PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest) */
  toolName?: string;
  /** Glob pattern for session IDs */
  sessionId?: string;
  /** Glob pattern for subagent IDs */
  subagentId?: string;
  /** Minimum risk level for permission hooks */
  minRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
  /** Notification level filter */
  notificationLevel?: 'info' | 'warn' | 'error';
}

/**
 * Configuration for a single hook registration.
 *
 * This is the shape used in both config file definitions
 * and programmatic registration.
 */
export interface HookRegistration<E extends HookEventName = HookEventName> {
  /** Unique identifier for this hook registration */
  id: string;
  /** Human-readable name */
  name?: string;
  /** Which lifecycle event this hook fires on */
  event: E;
  /** The execution mechanism */
  type: HookType;
  /** Priority ordering (higher runs first). Default: 0 */
  priority?: number;
  /** Whether this hook is enabled. Default: true */
  enabled?: boolean;
  /** Optional matcher to filter when the hook fires */
  matcher?: HookMatcher;
  /** Timeout in milliseconds. Default: 10000 (10s) for command/prompt, 60000 (60s) for agent */
  timeoutMs?: number;
  /** If true, errors in this hook do not propagate. Default: true */
  catchErrors?: boolean;

  // -- type-specific fields --

  /** For type='command': the shell command to execute */
  command?: string;
  /** For type='command': working directory */
  cwd?: string;
  /** For type='command': extra environment variables */
  env?: Record<string, string>;

  /** For type='prompt': the prompt template (can use {{metadata.fieldName}} interpolation) */
  promptTemplate?: string;
  /** For type='prompt': model override */
  model?: string;

  /** For type='agent': path to the agent config or inline agent definition */
  agentConfig?: string | Record<string, unknown>;

  /** For programmatic registration: direct handler function */
  handler?: HookHandler<E>;

  /** Source of registration for debugging */
  source?: HookSource;
}

/**
 * Where a hook registration originated from.
 */
export type HookSource =
  | 'config-file'    // From wundr.config.ts or hooks config file
  | 'programmatic'   // Registered via API at runtime
  | 'plugin'         // Registered by a plugin
  | 'built-in';      // Shipped with the orchestrator

// =============================================================================
// Hook Configuration (Config File Format)
// =============================================================================

/**
 * Top-level hooks configuration, typically in wundr.config.ts
 * or a dedicated hooks.config.ts file.
 *
 * @example
 * ```ts
 * const hooksConfig: HooksConfig = {
 *   enabled: true,
 *   hooks: [
 *     {
 *       id: 'log-tool-use',
 *       event: 'PostToolUse',
 *       type: 'command',
 *       command: 'echo "Tool {{metadata.toolName}} completed"',
 *     },
 *     {
 *       id: 'block-destructive',
 *       event: 'PermissionRequest',
 *       type: 'command',
 *       matcher: { minRiskLevel: 'high' },
 *       command: 'echo \'{"decision":"deny","reason":"High risk blocked by policy"}\'',
 *     },
 *   ],
 * };
 * ```
 */
export interface HooksConfig {
  /** Master switch to enable/disable the hooks system */
  enabled?: boolean;
  /** Default timeout for all hooks (can be overridden per-hook) */
  defaultTimeoutMs?: number;
  /** Maximum number of hooks that can fire concurrently for void events */
  maxConcurrency?: number;
  /** Hook registrations */
  hooks?: Array<Omit<HookRegistration, 'handler' | 'source'>>;
}

// =============================================================================
// Hook Execution Context & Results
// =============================================================================

/**
 * Runtime context provided to hook handlers during execution.
 */
export interface HookExecutionContext {
  /** The hook registration being executed */
  registration: HookRegistration;
  /** The event that triggered the hook */
  event: HookEventName;
  /** The metadata for the event */
  metadata: HookMetadataMap[HookEventName];
  /** Timestamp when hook execution started */
  startedAt: Date;
  /** Logger scoped to this hook execution */
  logger: HookLogger;
}

/**
 * Result of executing a single hook.
 */
export interface HookExecutionResult<E extends HookEventName = HookEventName> {
  /** The hook registration that was executed */
  hookId: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** For modifying hooks: the result returned by the handler */
  result?: E extends ModifyingHookEvent ? HookResultMap[E] : undefined;
  /** Error details if execution failed */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  /** Whether the hook was skipped (disabled, matcher didn't match, etc.) */
  skipped?: boolean;
  /** Reason for skipping */
  skipReason?: string;
}

/**
 * Aggregated result of firing all hooks for an event.
 */
export interface HookFireResult<E extends HookEventName = HookEventName> {
  /** The event that was fired */
  event: E;
  /** Results from individual hook executions */
  results: Array<HookExecutionResult<E>>;
  /** Total duration of all hook executions */
  totalDurationMs: number;
  /** Number of hooks that executed successfully */
  successCount: number;
  /** Number of hooks that failed */
  failureCount: number;
  /** Number of hooks that were skipped */
  skippedCount: number;
  /** For modifying hooks: the merged/final result */
  mergedResult?: E extends ModifyingHookEvent ? HookResultMap[E] : undefined;
}

// =============================================================================
// Logger Interface
// =============================================================================

/**
 * Logger interface for hook execution.
 * Matches the Logger pattern used in the orchestrator-daemon.
 */
export interface HookLogger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

// =============================================================================
// Hook Engine Interface
// =============================================================================

/**
 * The public interface of the hook execution engine.
 */
export interface IHookEngine {
  /** Fire a hook event. Returns aggregated results. */
  fire<E extends HookEventName>(
    event: E,
    metadata: HookMetadataMap[E],
  ): Promise<HookFireResult<E>>;

  /** Check if any hooks are registered for an event. */
  hasHooks(event: HookEventName): boolean;

  /** Get count of registered hooks for an event. */
  getHookCount(event: HookEventName): number;

  /** Dispose of engine resources (cancel pending hooks, etc.) */
  dispose(): Promise<void>;
}

/**
 * The public interface of the hook registry.
 */
export interface IHookRegistry {
  /** Register a hook */
  register<E extends HookEventName>(registration: HookRegistration<E>): void;

  /** Unregister a hook by ID */
  unregister(hookId: string): boolean;

  /** Get all registrations for an event, sorted by priority */
  getHooksForEvent<E extends HookEventName>(event: E): Array<HookRegistration<E>>;

  /** Get a registration by ID */
  getHookById(hookId: string): HookRegistration | undefined;

  /** Get all registered hooks */
  getAllHooks(): HookRegistration[];

  /** Enable/disable a hook by ID */
  setEnabled(hookId: string, enabled: boolean): boolean;

  /** Clear all registrations */
  clear(): void;

  /** Load hooks from a config object */
  loadFromConfig(config: HooksConfig): void;
}
