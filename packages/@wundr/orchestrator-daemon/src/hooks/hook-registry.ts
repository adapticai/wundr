/**
 * Hook Registry
 *
 * Manages the lifecycle of hook registrations: adding, removing,
 * enabling/disabling, and querying hooks by event type.
 *
 * Supports loading from config files and programmatic registration.
 * Hooks are stored in a flat map keyed by ID, with secondary indexes
 * by event name for fast lookup.
 */

import type {
  HookEventName,
  HookRegistration,
  HookSource,
  HooksConfig,
  HookOverrideConfig,
  IHookRegistry,
  HookLogger,
} from './hook-types';

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
// Registry Implementation
// =============================================================================

export class HookRegistry implements IHookRegistry {
  /** All registrations keyed by hook ID */
  private readonly hooks = new Map<string, HookRegistration>();

  /** Secondary index: event name -> set of hook IDs */
  private readonly eventIndex = new Map<HookEventName, Set<string>>();

  private readonly logger: HookLogger;

  constructor(options?: { logger?: HookLogger }) {
    this.logger = options?.logger ?? noopLogger;
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Register a hook. If a hook with the same ID already exists,
   * it is replaced and a warning is logged.
   */
  register<E extends HookEventName>(registration: HookRegistration<E>): void {
    if (!registration.id) {
      throw new Error('[HookRegistry] Hook registration must have an id');
    }
    if (!registration.event) {
      throw new Error(
        `[HookRegistry] Hook "${registration.id}" must have an event`
      );
    }
    if (!registration.type && !registration.handler) {
      throw new Error(
        `[HookRegistry] Hook "${registration.id}" must have a type (command/prompt/agent) or a handler function`
      );
    }

    // Validate type-specific fields
    if (
      registration.type === 'command' &&
      !registration.command &&
      !registration.handler
    ) {
      throw new Error(
        `[HookRegistry] Hook "${registration.id}" of type "command" must have a command string or handler`
      );
    }
    if (
      registration.type === 'prompt' &&
      !registration.promptTemplate &&
      !registration.handler
    ) {
      throw new Error(
        `[HookRegistry] Hook "${registration.id}" of type "prompt" must have a promptTemplate or handler`
      );
    }

    // Warn on replacement
    if (this.hooks.has(registration.id)) {
      this.logger.warn(
        `[HookRegistry] Replacing existing hook "${registration.id}"`
      );
      this.removeFromEventIndex(registration.id);
    }

    // Apply defaults
    const normalized: HookRegistration<E> = {
      priority: 0,
      enabled: true,
      catchErrors: true,
      source: 'programmatic' as HookSource,
      ...registration,
    };

    // Apply default timeouts based on type
    if (normalized.timeoutMs === undefined) {
      switch (normalized.type) {
        case 'command':
          normalized.timeoutMs = 10_000;
          break;
        case 'prompt':
          normalized.timeoutMs = 30_000;
          break;
        case 'agent':
          normalized.timeoutMs = 60_000;
          break;
        default:
          normalized.timeoutMs = 10_000;
      }
    }

    this.hooks.set(normalized.id, normalized as HookRegistration);
    this.addToEventIndex(normalized.event, normalized.id);

    this.logger.debug(
      `[HookRegistry] Registered hook "${normalized.id}" for event "${normalized.event}" ` +
        `(type=${normalized.type || 'handler'}, priority=${normalized.priority}, source=${normalized.source})`
    );
  }

  /**
   * Unregister a hook by ID.
   * Returns true if the hook was found and removed.
   */
  unregister(hookId: string): boolean {
    const registration = this.hooks.get(hookId);
    if (!registration) {
      return false;
    }

    this.hooks.delete(hookId);
    this.removeFromEventIndex(hookId);

    this.logger.debug(`[HookRegistry] Unregistered hook "${hookId}"`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Querying
  // ---------------------------------------------------------------------------

  /**
   * Get all enabled registrations for an event, sorted by priority (higher first).
   */
  getHooksForEvent<E extends HookEventName>(
    event: E
  ): Array<HookRegistration<E>> {
    const hookIds = this.eventIndex.get(event);
    if (!hookIds || hookIds.size === 0) {
      return [];
    }

    const results: Array<HookRegistration<E>> = [];
    for (const id of hookIds) {
      const registration = this.hooks.get(id);
      if (registration && registration.enabled !== false) {
        results.push(registration as HookRegistration<E>);
      }
    }

    // Sort by priority descending (higher priority runs first)
    results.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return results;
  }

  /**
   * Get a registration by ID (regardless of enabled state).
   */
  getHookById(hookId: string): HookRegistration | undefined {
    return this.hooks.get(hookId);
  }

  /**
   * Get all registered hooks (including disabled ones).
   */
  getAllHooks(): HookRegistration[] {
    return Array.from(this.hooks.values());
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  /**
   * Enable or disable a hook by ID.
   * Returns true if the hook was found.
   */
  setEnabled(hookId: string, enabled: boolean): boolean {
    const registration = this.hooks.get(hookId);
    if (!registration) {
      return false;
    }

    registration.enabled = enabled;
    this.logger.debug(
      `[HookRegistry] Hook "${hookId}" ${enabled ? 'enabled' : 'disabled'}`
    );
    return true;
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this.hooks.clear();
    this.eventIndex.clear();
    this.logger.debug('[HookRegistry] All hooks cleared');
  }

  // ---------------------------------------------------------------------------
  // Config Loading
  // ---------------------------------------------------------------------------

  /**
   * Load hooks from a HooksConfig object (e.g., parsed from a config file).
   * Existing hooks are NOT cleared; new hooks are added/replaced.
   *
   * After loading hook definitions, applies any per-hook overrides from
   * `config.hookOverrides`. Overrides can modify enabled state, timeout,
   * priority, and environment variables without redefining the hook.
   */
  loadFromConfig(config: HooksConfig): void {
    if (config.enabled === false) {
      this.logger.info(
        '[HookRegistry] Hooks config has enabled=false; skipping load'
      );
      return;
    }

    let loadedCount = 0;
    let errorCount = 0;

    // Load hook definitions
    if (config.hooks && Array.isArray(config.hooks)) {
      for (const hookDef of config.hooks) {
        try {
          this.register({
            ...hookDef,
            source: 'config-file',
            // Apply global defaults from config
            timeoutMs: hookDef.timeoutMs ?? config.defaultTimeoutMs,
          } as HookRegistration);
          loadedCount++;
        } catch (err) {
          errorCount++;
          this.logger.error(
            `[HookRegistry] Failed to load hook from config: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    // Apply per-hook overrides
    if (config.hookOverrides) {
      this.applyOverrides(config.hookOverrides);
    }

    this.logger.info(
      `[HookRegistry] Loaded ${loadedCount} hooks from config` +
        (errorCount > 0 ? ` (${errorCount} errors)` : '')
    );
  }

  /**
   * Apply per-hook configuration overrides.
   * Overrides are matched by hook ID. Unknown IDs are silently ignored
   * (the hook might be registered later by discovery or programmatic code).
   */
  applyOverrides(overrides: Record<string, HookOverrideConfig>): void {
    for (const [hookId, override] of Object.entries(overrides)) {
      const registration = this.hooks.get(hookId);
      if (!registration) {
        // Try matching by hook name (for discovered hooks with auto-generated IDs)
        let matched = false;
        for (const hook of this.hooks.values()) {
          if (hook.name === hookId) {
            this.applyOverride(hook, override);
            matched = true;
          }
        }
        if (!matched) {
          this.logger.debug(
            `[HookRegistry] Override for "${hookId}" did not match any registered hook`
          );
        }
        continue;
      }
      this.applyOverride(registration, override);
    }
  }

  /**
   * Apply a single override to a registration, mutating it in place.
   */
  private applyOverride(
    registration: HookRegistration,
    override: HookOverrideConfig
  ): void {
    if (override.enabled !== undefined) {
      registration.enabled = override.enabled;
    }
    if (override.timeoutMs !== undefined) {
      registration.timeoutMs = override.timeoutMs;
    }
    if (override.priority !== undefined) {
      registration.priority = override.priority;
    }
    if (override.env) {
      registration.env = {
        ...registration.env,
        ...override.env,
      };
    }
    this.logger.debug(
      `[HookRegistry] Applied override to hook "${registration.id}"`
    );
  }

  // ---------------------------------------------------------------------------
  // Diagnostics
  // ---------------------------------------------------------------------------

  /**
   * Get a summary of registered hooks for debugging.
   */
  getSummary(): {
    totalHooks: number;
    enabledHooks: number;
    disabledHooks: number;
    hooksByEvent: Record<string, number>;
    hooksBySource: Record<string, number>;
  } {
    let enabledCount = 0;
    let disabledCount = 0;
    const byEvent: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const hook of this.hooks.values()) {
      if (hook.enabled !== false) {
        enabledCount++;
      } else {
        disabledCount++;
      }

      byEvent[hook.event] = (byEvent[hook.event] ?? 0) + 1;
      const source = hook.source ?? 'unknown';
      bySource[source] = (bySource[source] ?? 0) + 1;
    }

    return {
      totalHooks: this.hooks.size,
      enabledHooks: enabledCount,
      disabledHooks: disabledCount,
      hooksByEvent: byEvent,
      hooksBySource: bySource,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal Index Management
  // ---------------------------------------------------------------------------

  private addToEventIndex(event: HookEventName, hookId: string): void {
    let ids = this.eventIndex.get(event);
    if (!ids) {
      ids = new Set();
      this.eventIndex.set(event, ids);
    }
    ids.add(hookId);
  }

  private removeFromEventIndex(hookId: string): void {
    for (const [, ids] of this.eventIndex) {
      ids.delete(hookId);
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new HookRegistry instance.
 */
export function createHookRegistry(options?: {
  logger?: HookLogger;
  config?: HooksConfig;
}): HookRegistry {
  const registry = new HookRegistry({ logger: options?.logger });

  if (options?.config) {
    registry.loadFromConfig(options.config);
  }

  return registry;
}
