/**
 * Hook Status & Diagnostics
 *
 * Provides comprehensive status reporting, diagnostic information,
 * and health checks for the hook system. Useful for debugging,
 * monitoring dashboards, and CLI status commands.
 */

import { HOOK_EVENT_GROUPS } from './hook-types';

import type { HookEngine } from './hook-engine';
import type { HookRegistry } from './hook-registry';
import type {
  HookEventName,
  HookSnapshot,
} from './hook-types';


// =============================================================================
// Status Types
// =============================================================================

/**
 * Diagnostic entry for a single issue found during health check.
 */
export interface HookDiagnostic {
  /** Severity of the diagnostic */
  level: 'info' | 'warn' | 'error';
  /** Human-readable message */
  message: string;
  /** Related hook ID, if applicable */
  hookId?: string;
  /** Source of the issue */
  source?: string;
}

/**
 * Complete status report for the hooks system.
 */
export interface HookSystemStatus {
  /** Whether the hooks system is operational */
  healthy: boolean;
  /** Summary statistics */
  summary: {
    totalHooks: number;
    enabledHooks: number;
    disabledHooks: number;
    hooksByEvent: Record<string, number>;
    hooksBySource: Record<string, number>;
    hooksByType: Record<string, number>;
  };
  /** Engine execution statistics */
  engineStats?: {
    totalFired: number;
    totalCacheHits: number;
    totalCacheMisses: number;
    totalErrors: number;
    totalTimeouts: number;
    cacheSize: number;
  };
  /** Individual hook details */
  hooks: Array<{
    id: string;
    name?: string;
    event: string;
    type: string;
    priority: number;
    enabled: boolean;
    source?: string;
    timeoutMs?: number;
    hasMatcher: boolean;
    hasHandler: boolean;
    hasCommand: boolean;
    hasPromptTemplate: boolean;
    hasAgentConfig: boolean;
  }>;
  /** Diagnostics found during health check */
  diagnostics: HookDiagnostic[];
  /** Timestamp of the status report */
  timestamp: string;
}

/**
 * Grouped view of hooks organized by lifecycle phase.
 */
export interface HookGroupedView {
  [group: string]: Array<{
    id: string;
    name?: string;
    event: string;
    type: string;
    enabled: boolean;
    priority: number;
  }>;
}

// =============================================================================
// Status Report Generation
// =============================================================================

/**
 * Generate a comprehensive status report for the hooks system.
 *
 * Includes registry summary, engine stats, individual hook details,
 * and diagnostics from health checks.
 */
export function generateHookStatus(
  registry: HookRegistry,
  engine?: HookEngine,
): HookSystemStatus {
  const allHooks = registry.getAllHooks();
  const diagnostics = runHealthChecks(registry);

  // Build summary
  const hooksByEvent: Record<string, number> = {};
  const hooksBySource: Record<string, number> = {};
  const hooksByType: Record<string, number> = {};
  let enabledCount = 0;
  let disabledCount = 0;

  for (const hook of allHooks) {
    if (hook.enabled !== false) {
      enabledCount++;
    } else {
      disabledCount++;
    }

    hooksByEvent[hook.event] = (hooksByEvent[hook.event] ?? 0) + 1;
    const source = hook.source ?? 'unknown';
    hooksBySource[source] = (hooksBySource[source] ?? 0) + 1;
    const type = hook.type ?? 'handler';
    hooksByType[type] = (hooksByType[type] ?? 0) + 1;
  }

  // Build engine stats
  let engineStats: HookSystemStatus['engineStats'];
  if (engine) {
    const stats = engine.getStats();
    engineStats = {
      ...stats,
      cacheSize: engine.getCacheSize(),
    };
  }

  // Build hook details
  const hooks = allHooks.map((hook) => ({
    id: hook.id,
    name: hook.name,
    event: hook.event,
    type: hook.type ?? 'handler',
    priority: hook.priority ?? 0,
    enabled: hook.enabled !== false,
    source: hook.source,
    timeoutMs: hook.timeoutMs,
    hasMatcher: !!hook.matcher,
    hasHandler: !!hook.handler,
    hasCommand: !!hook.command,
    hasPromptTemplate: !!hook.promptTemplate,
    hasAgentConfig: !!hook.agentConfig,
  }));

  const hasErrors = diagnostics.some((d) => d.level === 'error');

  return {
    healthy: !hasErrors,
    summary: {
      totalHooks: allHooks.length,
      enabledHooks: enabledCount,
      disabledHooks: disabledCount,
      hooksByEvent,
      hooksBySource,
      hooksByType,
    },
    engineStats,
    hooks,
    diagnostics,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate a grouped view of hooks organized by lifecycle phase.
 */
export function generateGroupedView(registry: HookRegistry): HookGroupedView {
  const groups: HookGroupedView = {};

  for (const [groupName, events] of Object.entries(HOOK_EVENT_GROUPS)) {
    const groupHooks: HookGroupedView[string] = [];

    for (const event of events) {
      const hooks = registry.getHooksForEvent(event as HookEventName);
      for (const hook of hooks) {
        groupHooks.push({
          id: hook.id,
          name: hook.name,
          event: hook.event,
          type: hook.type ?? 'handler',
          enabled: hook.enabled !== false,
          priority: hook.priority ?? 0,
        });
      }
    }

    if (groupHooks.length > 0) {
      groups[groupName] = groupHooks;
    }
  }

  return groups;
}

// =============================================================================
// Health Checks
// =============================================================================

/**
 * Run health checks on the hook registry and return diagnostics.
 *
 * Checks for:
 * - Hooks with no execution mechanism (no handler, command, prompt, or agent config)
 * - Duplicate hook IDs
 * - Events with no registered hooks
 * - Hooks with suspiciously high or low priority values
 * - Command hooks without a command string
 * - Prompt hooks without a template
 * - Hooks with zero timeout
 */
function runHealthChecks(registry: HookRegistry): HookDiagnostic[] {
  const diagnostics: HookDiagnostic[] = [];
  const allHooks = registry.getAllHooks();
  const seenIds = new Set<string>();

  for (const hook of allHooks) {
    // Check for duplicate IDs
    if (seenIds.has(hook.id)) {
      diagnostics.push({
        level: 'warn',
        message: `Duplicate hook ID: "${hook.id}"`,
        hookId: hook.id,
      });
    }
    seenIds.add(hook.id);

    // Check for missing execution mechanism
    if (!hook.handler && !hook.command && !hook.promptTemplate && !hook.agentConfig) {
      diagnostics.push({
        level: 'error',
        message: `Hook "${hook.id}" has no execution mechanism (handler, command, prompt, or agent config)`,
        hookId: hook.id,
      });
    }

    // Check command hooks
    if (hook.type === 'command' && !hook.command && !hook.handler) {
      diagnostics.push({
        level: 'error',
        message: `Command hook "${hook.id}" has neither a command string nor a handler function`,
        hookId: hook.id,
      });
    }

    // Check prompt hooks
    if (hook.type === 'prompt' && !hook.promptTemplate && !hook.handler) {
      diagnostics.push({
        level: 'error',
        message: `Prompt hook "${hook.id}" has neither a prompt template nor a handler function`,
        hookId: hook.id,
      });
    }

    // Check zero timeout
    if (hook.timeoutMs !== undefined && hook.timeoutMs <= 0) {
      diagnostics.push({
        level: 'warn',
        message: `Hook "${hook.id}" has a non-positive timeout (${hook.timeoutMs}ms)`,
        hookId: hook.id,
      });
    }

    // Check extreme priorities
    if (hook.priority !== undefined) {
      if (hook.priority > 10_000) {
        diagnostics.push({
          level: 'info',
          message: `Hook "${hook.id}" has an unusually high priority (${hook.priority})`,
          hookId: hook.id,
        });
      }
      if (hook.priority < -10_000) {
        diagnostics.push({
          level: 'info',
          message: `Hook "${hook.id}" has an unusually low priority (${hook.priority})`,
          hookId: hook.id,
        });
      }
    }
  }

  // Check for events with no hooks
  const allEvents: HookEventName[] = [
    'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest',
    'PostToolUse', 'PostToolUseFailure', 'Notification', 'SubagentStart',
    'SubagentStop', 'Stop', 'TeammateIdle', 'TaskCompleted', 'PreCompact',
    'SessionEnd',
  ];

  for (const event of allEvents) {
    const hooks = registry.getHooksForEvent(event);
    if (hooks.length === 0) {
      diagnostics.push({
        level: 'info',
        message: `No hooks registered for event "${event}"`,
      });
    }
  }

  return diagnostics;
}

// =============================================================================
// Snapshot Comparison
// =============================================================================

/**
 * Compare two hook snapshots and report the differences.
 * Useful for detecting hook configuration drift.
 */
export function compareSnapshots(
  before: HookSnapshot,
  after: HookSnapshot,
): {
  added: string[];
  removed: string[];
  changed: string[];
} {
  const beforeNames = new Set(before.hooks.map((h) => h.name));
  const afterNames = new Set(after.hooks.map((h) => h.name));

  const added = [...afterNames].filter((name) => !beforeNames.has(name));
  const removed = [...beforeNames].filter((name) => !afterNames.has(name));

  const changed: string[] = [];
  for (const afterHook of after.hooks) {
    if (!beforeNames.has(afterHook.name)) {
continue;
}
    const beforeHook = before.hooks.find((h) => h.name === afterHook.name);
    if (!beforeHook) {
continue;
}

    const beforeEvents = new Set(beforeHook.events);
    const afterEvents = new Set(afterHook.events);
    const eventsChanged =
      beforeEvents.size !== afterEvents.size ||
      [...beforeEvents].some((e) => !afterEvents.has(e));

    if (eventsChanged) {
      changed.push(afterHook.name);
    }
  }

  return { added, removed, changed };
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Format the hook status as a human-readable string for CLI output.
 */
export function formatHookStatus(status: HookSystemStatus): string {
  const lines: string[] = [];

  lines.push(`Hook System Status: ${status.healthy ? 'HEALTHY' : 'DEGRADED'}`);
  lines.push(`Timestamp: ${status.timestamp}`);
  lines.push('');
  lines.push(`Total hooks: ${status.summary.totalHooks}`);
  lines.push(`  Enabled:  ${status.summary.enabledHooks}`);
  lines.push(`  Disabled: ${status.summary.disabledHooks}`);
  lines.push('');

  lines.push('By event:');
  for (const [event, count] of Object.entries(status.summary.hooksByEvent)) {
    lines.push(`  ${event}: ${count}`);
  }
  lines.push('');

  lines.push('By source:');
  for (const [source, count] of Object.entries(status.summary.hooksBySource)) {
    lines.push(`  ${source}: ${count}`);
  }
  lines.push('');

  lines.push('By type:');
  for (const [type, count] of Object.entries(status.summary.hooksByType)) {
    lines.push(`  ${type}: ${count}`);
  }

  if (status.engineStats) {
    lines.push('');
    lines.push('Engine stats:');
    lines.push(`  Total fired:    ${status.engineStats.totalFired}`);
    lines.push(`  Cache hits:     ${status.engineStats.totalCacheHits}`);
    lines.push(`  Cache misses:   ${status.engineStats.totalCacheMisses}`);
    lines.push(`  Cache size:     ${status.engineStats.cacheSize}`);
    lines.push(`  Total errors:   ${status.engineStats.totalErrors}`);
    lines.push(`  Total timeouts: ${status.engineStats.totalTimeouts}`);
  }

  if (status.diagnostics.length > 0) {
    lines.push('');
    lines.push('Diagnostics:');
    for (const diag of status.diagnostics) {
      const prefix = diag.level === 'error' ? 'ERROR' : diag.level === 'warn' ? 'WARN' : 'INFO';
      const hookSuffix = diag.hookId ? ` [${diag.hookId}]` : '';
      lines.push(`  [${prefix}]${hookSuffix} ${diag.message}`);
    }
  }

  return lines.join('\n');
}
