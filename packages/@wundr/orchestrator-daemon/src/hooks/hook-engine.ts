/**
 * Hook Execution Engine
 *
 * Executes registered hooks with proper timeout handling, error recovery,
 * priority ordering, matcher filtering, and result merging.
 *
 * Supports three execution mechanisms:
 * - command: Spawns a child process, passes metadata via env + stdin JSON
 * - prompt:  Sends an interpolated prompt to the LLM (placeholder for integration)
 * - agent:   Spawns a sub-orchestrator invocation (placeholder for integration)
 *
 * Also supports direct handler functions for programmatic hooks.
 *
 * Void hooks run in parallel for performance.
 * Modifying hooks run sequentially in priority order, merging results.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  HookEventName,
  HookExecutionResult,
  HookFireResult,
  HookLogger,
  HookMetadataMap,
  HookMatcher,
  HookRegistration,
  HookResultMap,
  IHookEngine,
  ModifyingHookEvent,
} from './hook-types';
import type { HookRegistry } from './hook-registry';

const execFileAsync = promisify(execFile);

// =============================================================================
// Constants
// =============================================================================

/** Events whose hooks can return modifying results */
const MODIFYING_EVENTS = new Set<string>([
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PreCompact',
]);

/** Default max concurrency for parallel void hooks */
const DEFAULT_MAX_CONCURRENCY = 20;

// =============================================================================
// Default Logger
// =============================================================================

const noopLogger: HookLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

// =============================================================================
// Engine Options
// =============================================================================

export interface HookEngineOptions {
  /** The hook registry to draw registrations from */
  registry: HookRegistry;
  /** Logger instance */
  logger?: HookLogger;
  /** Maximum concurrency for parallel void hooks */
  maxConcurrency?: number;
  /** Global error catching override. If false, hook errors propagate. */
  catchErrors?: boolean;
  /** Shell to use for command hooks (default: /bin/sh on Unix, cmd.exe on Windows) */
  shell?: string;
}

// =============================================================================
// Engine Implementation
// =============================================================================

export class HookEngine implements IHookEngine {
  private readonly registry: HookRegistry;
  private readonly logger: HookLogger;
  private readonly maxConcurrency: number;
  private readonly globalCatchErrors: boolean;
  private readonly shell: string;
  private disposed = false;

  constructor(options: HookEngineOptions) {
    this.registry = options.registry;
    this.logger = options.logger ?? noopLogger;
    this.maxConcurrency = options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
    this.globalCatchErrors = options.catchErrors ?? true;
    this.shell = options.shell ?? (process.platform === 'win32' ? 'cmd.exe' : '/bin/sh');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Fire a hook event.
   *
   * For modifying events (UserPromptSubmit, PreToolUse, PermissionRequest, PreCompact):
   *   Hooks run sequentially in priority order. Results are merged.
   *
   * For void events (everything else):
   *   Hooks run in parallel, bounded by maxConcurrency.
   */
  async fire<E extends HookEventName>(
    event: E,
    metadata: HookMetadataMap[E],
  ): Promise<HookFireResult<E>> {
    if (this.disposed) {
      return this.emptyResult(event);
    }

    const startTime = Date.now();
    const hooks = this.registry.getHooksForEvent(event);

    if (hooks.length === 0) {
      return this.emptyResult(event);
    }

    this.logger.debug(
      `[HookEngine] Firing "${event}" (${hooks.length} hooks)`,
      { hookIds: hooks.map((h) => h.id) },
    );

    // Filter by matchers
    const eligible = hooks.filter((hook) => this.matchesFilter(hook, event, metadata));
    const skippedByMatcher = hooks.length - eligible.length;

    let results: Array<HookExecutionResult<E>>;
    let mergedResult: HookFireResult<E>['mergedResult'];

    if (MODIFYING_EVENTS.has(event)) {
      // Sequential execution with result merging
      const { results: seqResults, merged } = await this.executeSequential(
        eligible as unknown as Array<HookRegistration<ModifyingHookEvent>>,
        event as unknown as ModifyingHookEvent,
        metadata as unknown as HookMetadataMap[ModifyingHookEvent],
      );
      results = seqResults as unknown as Array<HookExecutionResult<E>>;
      mergedResult = merged as HookFireResult<E>['mergedResult'];
    } else {
      // Parallel execution (fire-and-forget)
      results = await this.executeParallel(eligible, event, metadata);
    }

    // Add skipped-by-matcher entries
    const skippedResults: Array<HookExecutionResult<E>> = [];
    for (const hook of hooks) {
      if (!eligible.includes(hook)) {
        skippedResults.push({
          hookId: hook.id,
          success: true,
          durationMs: 0,
          skipped: true,
          skipReason: 'Matcher did not match',
        });
      }
    }

    const allResults = [...results, ...skippedResults];
    const totalDurationMs = Date.now() - startTime;

    const successCount = allResults.filter((r) => r.success && !r.skipped).length;
    const failureCount = allResults.filter((r) => !r.success).length;
    const skippedCount = allResults.filter((r) => r.skipped).length;

    this.logger.debug(
      `[HookEngine] "${event}" completed in ${totalDurationMs}ms ` +
        `(${successCount} ok, ${failureCount} failed, ${skippedCount} skipped)`,
    );

    return {
      event,
      results: allResults,
      totalDurationMs,
      successCount,
      failureCount,
      skippedCount,
      mergedResult,
    };
  }

  /**
   * Check if any enabled hooks are registered for the given event.
   */
  hasHooks(event: HookEventName): boolean {
    return this.registry.getHooksForEvent(event).length > 0;
  }

  /**
   * Get the count of enabled hooks for the given event.
   */
  getHookCount(event: HookEventName): number {
    return this.registry.getHooksForEvent(event).length;
  }

  /**
   * Dispose of engine resources.
   */
  async dispose(): Promise<void> {
    this.disposed = true;
    this.logger.info('[HookEngine] Disposed');
  }

  // ---------------------------------------------------------------------------
  // Sequential Execution (Modifying Hooks)
  // ---------------------------------------------------------------------------

  private async executeSequential<E extends ModifyingHookEvent>(
    hooks: Array<HookRegistration<E>>,
    event: E,
    metadata: HookMetadataMap[E],
  ): Promise<{
    results: Array<HookExecutionResult<E>>;
    merged: HookResultMap[E] | undefined;
  }> {
    const results: Array<HookExecutionResult<E>> = [];
    let merged: HookResultMap[E] | undefined;

    for (const hook of hooks) {
      const result = await this.executeSingle(hook, event, metadata);
      results.push(result);

      // Merge result if the hook returned one
      if (result.success && result.result !== undefined) {
        merged = this.mergeResult(event, merged, result.result as HookResultMap[E]);
      }
    }

    return { results, merged };
  }

  // ---------------------------------------------------------------------------
  // Parallel Execution (Void Hooks)
  // ---------------------------------------------------------------------------

  private async executeParallel<E extends HookEventName>(
    hooks: Array<HookRegistration<E>>,
    event: E,
    metadata: HookMetadataMap[E],
  ): Promise<Array<HookExecutionResult<E>>> {
    // Execute in batches of maxConcurrency
    const results: Array<HookExecutionResult<E>> = [];

    for (let i = 0; i < hooks.length; i += this.maxConcurrency) {
      const batch = hooks.slice(i, i + this.maxConcurrency);
      const batchResults = await Promise.all(
        batch.map((hook) => this.executeSingle(hook, event, metadata)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Single Hook Execution
  // ---------------------------------------------------------------------------

  private async executeSingle<E extends HookEventName>(
    hook: HookRegistration<E>,
    event: E,
    metadata: HookMetadataMap[E],
  ): Promise<HookExecutionResult<E>> {
    const startTime = Date.now();
    const shouldCatch = hook.catchErrors ?? this.globalCatchErrors;

    try {
      let result: unknown;

      // Execute with timeout
      const timeoutMs = hook.timeoutMs ?? 10_000;

      result = await Promise.race([
        this.executeHandler(hook, event, metadata),
        this.createTimeout(timeoutMs, hook.id),
      ]);

      const durationMs = Date.now() - startTime;

      return {
        hookId: hook.id,
        success: true,
        durationMs,
        result: result as HookExecutionResult<E>['result'],
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;

      this.logger.error(
        `[HookEngine] Hook "${hook.id}" failed for "${event}": ${errorMessage}`,
      );

      if (!shouldCatch) {
        throw err;
      }

      return {
        hookId: hook.id,
        success: false,
        durationMs,
        error: {
          message: errorMessage,
          stack: errorStack,
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Handler Dispatch
  // ---------------------------------------------------------------------------

  private async executeHandler<E extends HookEventName>(
    hook: HookRegistration<E>,
    event: E,
    metadata: HookMetadataMap[E],
  ): Promise<unknown> {
    // Direct handler function takes precedence
    if (hook.handler) {
      return hook.handler(metadata as any);
    }

    // Dispatch by type
    switch (hook.type) {
      case 'command':
        return this.executeCommandHook(hook, event, metadata);
      case 'prompt':
        return this.executePromptHook(hook, event, metadata);
      case 'agent':
        return this.executeAgentHook(hook, event, metadata);
      default:
        throw new Error(
          `[HookEngine] Hook "${hook.id}" has unknown type "${hook.type}" and no handler`,
        );
    }
  }

  /**
   * Execute a command hook by spawning a child process.
   *
   * Metadata is passed two ways:
   * 1. As JSON on stdin
   * 2. As flattened environment variables prefixed with WUNDR_HOOK_
   *
   * If the command writes JSON to stdout, it is parsed as the hook result.
   */
  private async executeCommandHook<E extends HookEventName>(
    hook: HookRegistration<E>,
    event: E,
    metadata: HookMetadataMap[E],
  ): Promise<unknown> {
    if (!hook.command) {
      throw new Error(`[HookEngine] Command hook "${hook.id}" has no command`);
    }

    // Interpolate metadata placeholders in command string
    const interpolatedCommand = this.interpolateTemplate(hook.command, metadata as unknown as Record<string, unknown>);

    // Build environment
    const env: Record<string, string | undefined> = {
      ...process.env,
      ...hook.env,
      WUNDR_HOOK_EVENT: event,
      WUNDR_HOOK_ID: hook.id,
      WUNDR_HOOK_METADATA: JSON.stringify(metadata),
    };

    // Flatten top-level metadata fields into env vars
    if (metadata && typeof metadata === 'object') {
      for (const [key, value] of Object.entries(metadata as unknown as Record<string, unknown>)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          env[`WUNDR_HOOK_${key.toUpperCase()}`] = String(value);
        }
      }
    }

    this.logger.debug(
      `[HookEngine] Executing command hook "${hook.id}": ${interpolatedCommand.substring(0, 200)}`,
    );

    const shellFlag = process.platform === 'win32' ? '/c' : '-c';

    const { stdout } = await execFileAsync(this.shell, [shellFlag, interpolatedCommand], {
      env: env as Record<string, string | undefined>,
      cwd: hook.cwd ?? process.cwd(),
      timeout: hook.timeoutMs ?? 10_000,
      maxBuffer: 1024 * 1024, // 1MB
    });

    // Try to parse stdout as JSON result
    const trimmed = stdout.trim();
    if (trimmed) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Not JSON; return as string
        return trimmed;
      }
    }

    return undefined;
  }

  /**
   * Execute a prompt hook by interpolating the template and calling the LLM.
   *
   * This is a placeholder implementation. In production, this would integrate
   * with the orchestrator's LLM client to send the interpolated prompt and
   * parse the response.
   */
  private async executePromptHook<E extends HookEventName>(
    hook: HookRegistration<E>,
    _event: E,
    metadata: HookMetadataMap[E],
  ): Promise<unknown> {
    if (!hook.promptTemplate) {
      throw new Error(`[HookEngine] Prompt hook "${hook.id}" has no promptTemplate`);
    }

    const interpolatedPrompt = this.interpolateTemplate(hook.promptTemplate, metadata as unknown as Record<string, unknown>);

    this.logger.debug(
      `[HookEngine] Prompt hook "${hook.id}" would send: ${interpolatedPrompt.substring(0, 200)}...`,
    );

    // Placeholder: In production, this calls the LLM client.
    // The actual integration point is:
    //   const response = await this.llmClient.chat({ messages: [{ role: 'user', content: interpolatedPrompt }], model: hook.model });
    //   return response;

    this.logger.warn(
      `[HookEngine] Prompt hook "${hook.id}" executed in placeholder mode. ` +
        'Wire up LLM client integration for production use.',
    );

    return { prompt: interpolatedPrompt, placeholderMode: true };
  }

  /**
   * Execute an agent hook by spawning a sub-orchestrator invocation.
   *
   * This is a placeholder implementation. In production, this would
   * use the SessionManager to spawn a sub-session with the agent config.
   */
  private async executeAgentHook<E extends HookEventName>(
    hook: HookRegistration<E>,
    _event: E,
    metadata: HookMetadataMap[E],
  ): Promise<unknown> {
    this.logger.debug(
      `[HookEngine] Agent hook "${hook.id}" would spawn sub-agent`,
      { agentConfig: hook.agentConfig },
    );

    // Placeholder: In production, this spawns a sub-session.
    // const session = await this.sessionManager.spawnSession(agentConfig, { metadata });
    // return session.result;

    this.logger.warn(
      `[HookEngine] Agent hook "${hook.id}" executed in placeholder mode. ` +
        'Wire up SessionManager integration for production use.',
    );

    return { agentConfig: hook.agentConfig, metadata, placeholderMode: true };
  }

  // ---------------------------------------------------------------------------
  // Matcher Filtering
  // ---------------------------------------------------------------------------

  private matchesFilter<E extends HookEventName>(
    hook: HookRegistration<E>,
    event: E,
    metadata: HookMetadataMap[E],
  ): boolean {
    const matcher = hook.matcher;
    if (!matcher) {
      return true; // No matcher = always match
    }

    const metadataObj = metadata as unknown as Record<string, unknown>;

    // Tool name matching
    if (matcher.toolName && 'toolName' in metadataObj) {
      if (!this.globMatch(String(metadataObj.toolName), matcher.toolName)) {
        return false;
      }
    }

    // Session ID matching
    if (matcher.sessionId && 'sessionId' in metadataObj) {
      if (!this.globMatch(String(metadataObj.sessionId), matcher.sessionId)) {
        return false;
      }
    }

    // Subagent ID matching
    if (matcher.subagentId && 'subagentId' in metadataObj) {
      if (!this.globMatch(String(metadataObj.subagentId), matcher.subagentId)) {
        return false;
      }
    }

    // Risk level matching (for PermissionRequest)
    if (matcher.minRiskLevel && 'riskLevel' in metadataObj) {
      const levels = ['low', 'medium', 'high', 'critical'];
      const minIndex = levels.indexOf(matcher.minRiskLevel);
      const actualIndex = levels.indexOf(String(metadataObj.riskLevel));
      if (actualIndex < minIndex) {
        return false;
      }
    }

    // Notification level matching
    if (matcher.notificationLevel && 'level' in metadataObj) {
      const levels = ['info', 'warn', 'error'];
      const minIndex = levels.indexOf(matcher.notificationLevel);
      const actualIndex = levels.indexOf(String(metadataObj.level));
      if (actualIndex < minIndex) {
        return false;
      }
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Result Merging
  // ---------------------------------------------------------------------------

  /**
   * Merge two results for modifying hooks.
   * Later results override earlier ones (field-level merge).
   */
  private mergeResult<E extends ModifyingHookEvent>(
    event: E,
    accumulated: HookResultMap[E] | undefined,
    next: HookResultMap[E],
  ): HookResultMap[E] {
    if (!accumulated) {
      return next;
    }

    // Field-level merge: non-undefined fields from `next` override `accumulated`
    const merged = { ...accumulated } as Record<string, unknown>;
    for (const [key, value] of Object.entries(next as Record<string, unknown>)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }

    return merged as HookResultMap[E];
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Simple glob matching supporting * and ** patterns.
   */
  private globMatch(value: string, pattern: string): boolean {
    // Convert glob to regex
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars (except *)
      .replace(/\*\*/g, '{{GLOBSTAR}}')       // Placeholder for **
      .replace(/\*/g, '[^/]*')                 // * matches anything except /
      .replace(/\{\{GLOBSTAR\}\}/g, '.*');     // ** matches anything

    try {
      const regex = new RegExp(`^${regexStr}$`);
      return regex.test(value);
    } catch {
      // Fallback: exact match
      return value === pattern;
    }
  }

  /**
   * Interpolate {{metadata.fieldName}} placeholders in a template string.
   */
  private interpolateTemplate(
    template: string,
    metadata: Record<string, unknown>,
  ): string {
    return template.replace(/\{\{metadata\.(\w+(?:\.\w+)*)\}\}/g, (_match, path: string) => {
      const parts = path.split('.');
      let current: unknown = metadata;

      for (const part of parts) {
        if (current === null || current === undefined || typeof current !== 'object') {
          return '';
        }
        current = (current as Record<string, unknown>)[part];
      }

      if (current === null || current === undefined) {
        return '';
      }

      return typeof current === 'object' ? JSON.stringify(current) : String(current);
    });
  }

  /**
   * Create a timeout promise that rejects after the specified duration.
   */
  private createTimeout(ms: number, hookId: string): Promise<never> {
    return new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[HookEngine] Hook "${hookId}" timed out after ${ms}ms`));
      }, ms);

      // Allow the process to exit even if this timer is pending
      if (timer.unref) {
        timer.unref();
      }
    });
  }

  /**
   * Create an empty result for when there are no hooks.
   */
  private emptyResult<E extends HookEventName>(event: E): HookFireResult<E> {
    return {
      event,
      results: [],
      totalDurationMs: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
    };
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new HookEngine instance.
 */
export function createHookEngine(options: HookEngineOptions): HookEngine {
  return new HookEngine(options);
}
