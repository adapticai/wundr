/**
 * Built-in Hooks
 *
 * Ships with the orchestrator daemon. These hooks provide essential
 * functionality that most deployments will want: logging, metrics,
 * safety guardrails, and session management.
 *
 * All built-in hooks use programmatic handlers (no shell commands)
 * for performance and reliability. They are registered with the
 * 'built-in' source and can be disabled via config.
 */

import type { HookRegistry } from './hook-registry';
import type {
  HookRegistration,
  HookLogger,
  SessionStartMetadata,
  SessionEndMetadata,
  PreToolUseMetadata,
  PreToolUseResult,
  PostToolUseMetadata,
  PostToolUseFailureMetadata,
  PermissionRequestMetadata,
  PermissionRequestResult,
  SubagentStartMetadata,
  SubagentStopMetadata,
  TaskCompletedMetadata,
  PreCompactMetadata,
  PreCompactResult,
  NotificationMetadata,
  UserPromptSubmitMetadata,
  UserPromptSubmitResult,
} from './hook-types';

// =============================================================================
// Built-in Hook Definitions
// =============================================================================

/**
 * Session lifecycle logger.
 * Logs session start/end events with metadata for audit trails.
 */
function createSessionLifecycleLogger(logger: HookLogger): HookRegistration<'SessionStart'> & HookRegistration<'SessionEnd'> {
  // We return a SessionStart registration; SessionEnd is registered separately
  return {
    id: 'builtin:session-lifecycle-logger-start',
    name: 'Session Lifecycle Logger (Start)',
    event: 'SessionStart',
    type: 'command', // type required but handler overrides
    priority: -100, // Low priority, runs after user hooks
    enabled: true,
    catchErrors: true,
    source: 'built-in',
    handler: async (metadata: SessionStartMetadata) => {
      logger.info('[lifecycle] Session started', {
        sessionId: metadata.sessionId,
        orchestratorId: metadata.orchestratorId,
        resumedFrom: metadata.resumedFrom,
      });
    },
  } as any;
}

function createSessionEndLogger(logger: HookLogger): HookRegistration<'SessionEnd'> {
  return {
    id: 'builtin:session-lifecycle-logger-end',
    name: 'Session Lifecycle Logger (End)',
    event: 'SessionEnd',
    type: 'command',
    priority: -100,
    enabled: true,
    catchErrors: true,
    source: 'built-in',
    handler: async (metadata: SessionEndMetadata) => {
      logger.info('[lifecycle] Session ended', {
        sessionId: metadata.sessionId,
        reason: metadata.reason,
        durationMs: metadata.durationMs,
        tokensUsed: metadata.metrics.tokensUsed,
        tasksCompleted: metadata.metrics.tasksCompleted,
      });
    },
  };
}

/**
 * Tool execution logger.
 * Logs all tool calls (success and failure) for debugging and audit.
 */
function createToolExecutionLogger(logger: HookLogger): [
  HookRegistration<'PostToolUse'>,
  HookRegistration<'PostToolUseFailure'>,
] {
  const successHook: HookRegistration<'PostToolUse'> = {
    id: 'builtin:tool-execution-logger-success',
    name: 'Tool Execution Logger (Success)',
    event: 'PostToolUse',
    type: 'command',
    priority: -100,
    enabled: true,
    catchErrors: true,
    source: 'built-in',
    handler: async (metadata: PostToolUseMetadata) => {
      logger.debug('[tool] Tool call succeeded', {
        toolName: metadata.toolName,
        toolCallId: metadata.toolCallId,
        durationMs: metadata.durationMs,
      });
    },
  };

  const failureHook: HookRegistration<'PostToolUseFailure'> = {
    id: 'builtin:tool-execution-logger-failure',
    name: 'Tool Execution Logger (Failure)',
    event: 'PostToolUseFailure',
    type: 'command',
    priority: -100,
    enabled: true,
    catchErrors: true,
    source: 'built-in',
    handler: async (metadata: PostToolUseFailureMetadata) => {
      logger.warn('[tool] Tool call failed', {
        toolName: metadata.toolName,
        toolCallId: metadata.toolCallId,
        error: metadata.error,
        durationMs: metadata.durationMs,
      });
    },
  };

  return [successHook, failureHook];
}

/**
 * Dangerous tool blocker.
 * Blocks tool calls that match known destructive patterns unless
 * explicitly overridden. This is a safety guardrail.
 */
function createDangerousToolBlocker(logger: HookLogger): HookRegistration<'PreToolUse'> {
  /** Tools that should always require explicit approval */
  const BLOCKED_TOOL_PATTERNS = [
    /^rm\s+-rf\s+\//,  // rm -rf / patterns in command args
    /^drop\s+database/i,
    /^truncate\s+table/i,
  ];

  /** Tool names that are inherently destructive */
  const DESTRUCTIVE_TOOL_NAMES = new Set([
    'delete_database',
    'format_disk',
    'factory_reset',
  ]);

  return {
    id: 'builtin:dangerous-tool-blocker',
    name: 'Dangerous Tool Blocker',
    event: 'PreToolUse',
    type: 'command',
    priority: 1000, // High priority, runs before user hooks
    enabled: true,
    catchErrors: false, // Safety hooks should propagate errors
    source: 'built-in',
    handler: async (metadata: PreToolUseMetadata): Promise<PreToolUseResult | void> => {
      // Check tool name
      if (DESTRUCTIVE_TOOL_NAMES.has(metadata.toolName)) {
        logger.warn('[safety] Blocked destructive tool call', {
          toolName: metadata.toolName,
          toolCallId: metadata.toolCallId,
        });
        return {
          block: true,
          blockReason: `Tool "${metadata.toolName}" is blocked by safety policy. ` +
            'This tool is classified as destructive and requires manual approval.',
        };
      }

      // Check command content in tool input
      const inputStr = JSON.stringify(metadata.toolInput);
      for (const pattern of BLOCKED_TOOL_PATTERNS) {
        if (pattern.test(inputStr)) {
          logger.warn('[safety] Blocked dangerous tool input pattern', {
            toolName: metadata.toolName,
            pattern: pattern.source,
          });
          return {
            block: true,
            blockReason: 'Tool input matches dangerous pattern. ' +
              'Review and approve the operation manually.',
          };
        }
      }

      return undefined;
    },
  };
}

/**
 * Permission auto-approver for low-risk operations.
 * Automatically approves read-only operations and denies nothing
 * (just provides auto-approval for the safe defaults).
 */
function createPermissionAutoApprover(logger: HookLogger): HookRegistration<'PermissionRequest'> {
  return {
    id: 'builtin:permission-auto-approver',
    name: 'Permission Auto-Approver (Low Risk)',
    event: 'PermissionRequest',
    type: 'command',
    priority: -50, // Low priority, user hooks can override
    enabled: true,
    catchErrors: true,
    source: 'built-in',
    matcher: {
      minRiskLevel: 'low',
    },
    handler: async (metadata: PermissionRequestMetadata): Promise<PermissionRequestResult | void> => {
      if (metadata.riskLevel === 'low' && metadata.permissionType === 'read') {
        logger.debug('[permission] Auto-approved low-risk read operation', {
          toolName: metadata.toolName,
        });
        return {
          decision: 'approve',
          reason: 'Automatically approved: low-risk read operation',
        };
      }

      // Don't auto-decide for anything else
      return undefined;
    },
  };
}

/**
 * Subagent lifecycle tracker.
 * Tracks subagent spawn/stop events for monitoring and debugging.
 */
function createSubagentTracker(logger: HookLogger): [
  HookRegistration<'SubagentStart'>,
  HookRegistration<'SubagentStop'>,
] {
  const startHook: HookRegistration<'SubagentStart'> = {
    id: 'builtin:subagent-tracker-start',
    name: 'Subagent Tracker (Start)',
    event: 'SubagentStart',
    type: 'command',
    priority: -100,
    enabled: true,
    catchErrors: true,
    source: 'built-in',
    handler: async (metadata: SubagentStartMetadata) => {
      logger.info('[subagent] Subagent started', {
        subagentId: metadata.subagentId,
        parentSessionId: metadata.parentSessionId,
        task: metadata.task.substring(0, 100),
      });
    },
  };

  const stopHook: HookRegistration<'SubagentStop'> = {
    id: 'builtin:subagent-tracker-stop',
    name: 'Subagent Tracker (Stop)',
    event: 'SubagentStop',
    type: 'command',
    priority: -100,
    enabled: true,
    catchErrors: true,
    source: 'built-in',
    handler: async (metadata: SubagentStopMetadata) => {
      const level = metadata.success ? 'info' : 'warn';
      logger[level]('[subagent] Subagent stopped', {
        subagentId: metadata.subagentId,
        success: metadata.success,
        durationMs: metadata.durationMs,
        tokensUsed: metadata.tokensUsed,
        error: metadata.error,
      });
    },
  };

  return [startHook, stopHook];
}

/**
 * Task completion logger.
 * Logs task completion events with performance metrics.
 */
function createTaskCompletionLogger(logger: HookLogger): HookRegistration<'TaskCompleted'> {
  return {
    id: 'builtin:task-completion-logger',
    name: 'Task Completion Logger',
    event: 'TaskCompleted',
    type: 'command',
    priority: -100,
    enabled: true,
    catchErrors: true,
    source: 'built-in',
    handler: async (metadata: TaskCompletedMetadata) => {
      const level = metadata.success ? 'info' : 'warn';
      logger[level]('[task] Task completed', {
        taskId: metadata.taskId,
        success: metadata.success,
        durationMs: metadata.durationMs,
        tokensUsed: metadata.tokensUsed,
        toolCallsMade: metadata.toolCallsMade,
      });
    },
  };
}

/**
 * Context compaction guardrail.
 * Ensures compaction only happens when truly needed and preserves
 * system-critical messages.
 */
function createCompactionGuardrail(logger: HookLogger): HookRegistration<'PreCompact'> {
  /** Minimum message count before compaction is worthwhile */
  const MIN_MESSAGES_FOR_COMPACTION = 10;

  return {
    id: 'builtin:compaction-guardrail',
    name: 'Compaction Guardrail',
    event: 'PreCompact',
    type: 'command',
    priority: 500, // High priority, runs before user hooks
    enabled: true,
    catchErrors: true,
    source: 'built-in',
    handler: async (metadata: PreCompactMetadata): Promise<PreCompactResult | void> => {
      if (metadata.messageCount < MIN_MESSAGES_FOR_COMPACTION) {
        logger.debug('[compaction] Skipping compaction: too few messages', {
          messageCount: metadata.messageCount,
          minimum: MIN_MESSAGES_FOR_COMPACTION,
        });
        return { skipCompaction: true };
      }

      logger.debug('[compaction] Pre-compaction check passed', {
        messageCount: metadata.messageCount,
        tokenCount: metadata.tokenCount,
        strategy: metadata.compactionStrategy,
      });

      return undefined;
    },
  };
}

/**
 * Notification router.
 * Logs notifications and could be extended to route them to
 * external systems (Slack, email, etc.).
 */
function createNotificationRouter(logger: HookLogger): HookRegistration<'Notification'> {
  return {
    id: 'builtin:notification-router',
    name: 'Notification Router',
    event: 'Notification',
    type: 'command',
    priority: -100,
    enabled: true,
    catchErrors: true,
    source: 'built-in',
    handler: async (metadata: NotificationMetadata) => {
      const level = metadata.level === 'error' ? 'error' : metadata.level === 'warn' ? 'warn' : 'info';
      logger[level](`[notification] ${metadata.message}`, {
        source: metadata.source,
        sessionId: metadata.sessionId,
        data: metadata.data,
      });
    },
  };
}

/**
 * Prompt length guardrail.
 * Warns or blocks excessively long prompts that could waste tokens.
 */
function createPromptLengthGuardrail(logger: HookLogger): HookRegistration<'UserPromptSubmit'> {
  /** Maximum prompt length before warning */
  const WARN_THRESHOLD = 50_000;
  /** Maximum prompt length before blocking */
  const BLOCK_THRESHOLD = 500_000;

  return {
    id: 'builtin:prompt-length-guardrail',
    name: 'Prompt Length Guardrail',
    event: 'UserPromptSubmit',
    type: 'command',
    priority: 500,
    enabled: true,
    catchErrors: true,
    source: 'built-in',
    handler: async (metadata: UserPromptSubmitMetadata): Promise<UserPromptSubmitResult | void> => {
      if (metadata.promptLength > BLOCK_THRESHOLD) {
        logger.warn('[guardrail] Blocked excessively long prompt', {
          length: metadata.promptLength,
          threshold: BLOCK_THRESHOLD,
        });
        return {
          block: true,
          blockReason: `Prompt length (${metadata.promptLength} chars) exceeds maximum ` +
            `allowed length (${BLOCK_THRESHOLD} chars). Please shorten your prompt.`,
        };
      }

      if (metadata.promptLength > WARN_THRESHOLD) {
        logger.warn('[guardrail] Long prompt detected', {
          length: metadata.promptLength,
          threshold: WARN_THRESHOLD,
        });
      }

      return undefined;
    },
  };
}

// =============================================================================
// Registration
// =============================================================================

/**
 * Register all built-in hooks with the given registry.
 *
 * @param registry - The hook registry to register with
 * @param logger - Logger for the built-in hooks
 * @param options - Options to enable/disable specific built-in hooks
 */
export function registerBuiltInHooks(
  registry: HookRegistry,
  logger: HookLogger,
  options?: {
    /** Disable all built-in hooks. Default: false */
    disableAll?: boolean;
    /** Specific hook IDs to disable */
    disable?: string[];
  },
): void {
  if (options?.disableAll) {
    logger.info('[built-in] All built-in hooks disabled');
    return;
  }

  const disabledSet = new Set(options?.disable ?? []);

  // Collect all built-in hooks
  const allHooks: HookRegistration[] = [
    createSessionLifecycleLogger(logger),
    createSessionEndLogger(logger),
    ...createToolExecutionLogger(logger),
    createDangerousToolBlocker(logger),
    createPermissionAutoApprover(logger),
    ...createSubagentTracker(logger),
    createTaskCompletionLogger(logger),
    createCompactionGuardrail(logger),
    createNotificationRouter(logger),
    createPromptLengthGuardrail(logger),
  ];

  let registeredCount = 0;

  for (const hook of allHooks) {
    if (disabledSet.has(hook.id)) {
      logger.debug(`[built-in] Skipping disabled hook "${hook.id}"`);
      continue;
    }

    registry.register(hook);
    registeredCount++;
  }

  logger.info(
    `[built-in] Registered ${registeredCount} built-in hooks` +
      (disabledSet.size > 0 ? ` (${disabledSet.size} disabled)` : ''),
  );
}

/**
 * Get the IDs of all built-in hooks.
 * Useful for documentation and configuration.
 */
export function getBuiltInHookIds(): string[] {
  return [
    'builtin:session-lifecycle-logger-start',
    'builtin:session-lifecycle-logger-end',
    'builtin:tool-execution-logger-success',
    'builtin:tool-execution-logger-failure',
    'builtin:dangerous-tool-blocker',
    'builtin:permission-auto-approver',
    'builtin:subagent-tracker-start',
    'builtin:subagent-tracker-stop',
    'builtin:task-completion-logger',
    'builtin:compaction-guardrail',
    'builtin:notification-router',
    'builtin:prompt-length-guardrail',
  ];
}
