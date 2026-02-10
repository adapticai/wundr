/**
 * Config Watcher: File Watching with Debounced Hot Reload
 *
 * Ported from OpenClaw's gateway/config-reload.ts. Watches the config file
 * for changes and applies a hybrid reload strategy: hot-reload safe changes
 * (hooks, agents, channels) without restart, while queuing daemon restarts
 * for structural changes (port, host, plugins).
 *
 * @module @wundr/orchestrator-daemon/config/config-watcher
 */

import { diffConfigPaths } from './config-merger';

import type { ConfigSnapshot } from './config-loader';
import type { WundrConfig } from './schemas';

// =============================================================================
// Types
// =============================================================================

export type ReloadMode = 'off' | 'hot' | 'restart' | 'hybrid';

export interface ReloadSettings {
  mode: ReloadMode;
  debounceMs: number;
}

export interface ReloadPlan {
  /** All dot-paths that changed between old and new config */
  changedPaths: string[];
  /** Whether the daemon must fully restart */
  restartDaemon: boolean;
  /** Paths that require a daemon restart */
  restartReasons: string[];
  /** Paths that can be hot-reloaded */
  hotReasons: string[];
  /** Paths that require no action (read at use-site) */
  noopPaths: string[];
  /** Whether hooks should be re-registered */
  reloadHooks: boolean;
  /** Whether the agent registry should be refreshed */
  reloadAgents: boolean;
  /** Channels that need per-channel restart */
  reloadChannels: Set<string>;
  /** Whether memory config changed */
  reloadMemory: boolean;
  /** Whether security config changed (re-init auth middleware) */
  reloadSecurity: boolean;
}

type ReloadAction =
  | 'reload-hooks'
  | 'reload-agents'
  | 'reload-memory'
  | 'reload-security'
  | `reload-channel:${string}`;

interface ReloadRule {
  prefix: string;
  kind: 'restart' | 'hot' | 'none';
  actions?: ReloadAction[];
}

export interface ConfigWatcherLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

export interface ConfigWatcherOptions {
  /** The initial config to diff against */
  initialConfig: WundrConfig;
  /** Read a fresh config snapshot */
  readSnapshot: () => Promise<ConfigSnapshot>;
  /** Callback for hot-reloadable changes */
  onHotReload: (plan: ReloadPlan, nextConfig: WundrConfig) => Promise<void>;
  /** Callback for changes that require daemon restart */
  onRestart: (plan: ReloadPlan, nextConfig: WundrConfig) => void;
  /** Path to watch for changes */
  watchPath: string;
  /** Logger */
  log: ConfigWatcherLogger;
}

export interface ConfigWatcher {
  /** Stop watching and release resources */
  stop: () => Promise<void>;
}

// =============================================================================
// Reload Rules
// =============================================================================

/**
 * Classification rules for config path changes.
 *
 * Rules are evaluated in order; the first matching rule wins.
 * Paths not matching any rule default to "restart" (safe fallback).
 */
const RELOAD_RULES: ReloadRule[] = [
  // --- Hot-reloadable ---
  { prefix: 'hooks', kind: 'hot', actions: ['reload-hooks'] },
  { prefix: 'agents', kind: 'hot', actions: ['reload-agents'] },
  { prefix: 'memory', kind: 'hot', actions: ['reload-memory'] },
  { prefix: 'channels.slack', kind: 'hot', actions: ['reload-channel:slack'] },
  { prefix: 'channels.discord', kind: 'hot', actions: ['reload-channel:discord'] },
  { prefix: 'channels.telegram', kind: 'hot', actions: ['reload-channel:telegram'] },
  { prefix: 'channels.webhook', kind: 'hot', actions: ['reload-channel:webhook'] },
  { prefix: 'security.rateLimit', kind: 'hot', actions: ['reload-security'] },
  { prefix: 'security.cors', kind: 'hot', actions: ['reload-security'] },
  { prefix: 'security.audit', kind: 'hot', actions: ['reload-security'] },
  { prefix: 'tokenBudget', kind: 'hot' },

  // --- No-op (read at use-site) ---
  { prefix: 'daemon.reload', kind: 'none' },
  { prefix: 'monitoring', kind: 'none' },
  { prefix: 'logging', kind: 'none' },
  { prefix: 'models', kind: 'none' },
  { prefix: 'meta', kind: 'none' },
  { prefix: 'nodeEnv', kind: 'none' },
  { prefix: 'debug', kind: 'none' },
  { prefix: 'env', kind: 'none' },

  // --- Restart required ---
  { prefix: 'daemon', kind: 'restart' },
  { prefix: 'security.jwt', kind: 'restart' },
  { prefix: 'security.mtls', kind: 'restart' },
  { prefix: 'security.apiKeys', kind: 'restart' },
  { prefix: 'plugins', kind: 'restart' },
  { prefix: 'redis', kind: 'restart' },
  { prefix: 'database', kind: 'restart' },
  { prefix: 'distributed', kind: 'restart' },
  { prefix: 'neolith', kind: 'restart' },
  { prefix: 'openai', kind: 'restart' },
  { prefix: 'anthropic', kind: 'restart' },
];

function matchRule(configPath: string): ReloadRule | null {
  for (const rule of RELOAD_RULES) {
    if (configPath === rule.prefix || configPath.startsWith(`${rule.prefix}.`)) {
      return rule;
    }
  }
  return null;
}

// =============================================================================
// Reload Settings Resolution
// =============================================================================

/**
 * Extract reload settings from a config object.
 */
export function resolveReloadSettings(config: WundrConfig): ReloadSettings {
  const mode = config.daemon?.reload?.mode ?? 'hybrid';
  const validModes: ReloadMode[] = ['off', 'hot', 'restart', 'hybrid'];
  const resolvedMode = validModes.includes(mode as ReloadMode)
    ? (mode as ReloadMode)
    : 'hybrid';

  const debounceRaw = config.daemon?.reload?.debounceMs;
  const debounceMs =
    typeof debounceRaw === 'number' && Number.isFinite(debounceRaw)
      ? Math.max(0, Math.floor(debounceRaw))
      : 300;

  return { mode: resolvedMode, debounceMs };
}

// =============================================================================
// Reload Plan Builder
// =============================================================================

/**
 * Build a reload plan from a list of changed config paths.
 *
 * Classifies each changed path into restart/hot/noop based on the reload
 * rules, then aggregates the results into a single plan.
 */
export function buildReloadPlan(changedPaths: string[]): ReloadPlan {
  const plan: ReloadPlan = {
    changedPaths,
    restartDaemon: false,
    restartReasons: [],
    hotReasons: [],
    noopPaths: [],
    reloadHooks: false,
    reloadAgents: false,
    reloadChannels: new Set(),
    reloadMemory: false,
    reloadSecurity: false,
  };

  const applyAction = (action: ReloadAction) => {
    if (action.startsWith('reload-channel:')) {
      const channel = action.slice('reload-channel:'.length);
      plan.reloadChannels.add(channel);
      return;
    }
    switch (action) {
      case 'reload-hooks':
        plan.reloadHooks = true;
        break;
      case 'reload-agents':
        plan.reloadAgents = true;
        break;
      case 'reload-memory':
        plan.reloadMemory = true;
        break;
      case 'reload-security':
        plan.reloadSecurity = true;
        break;
      default:
        break;
    }
  };

  for (const configPath of changedPaths) {
    const rule = matchRule(configPath);
    if (!rule) {
      // Unknown path: default to restart for safety
      plan.restartDaemon = true;
      plan.restartReasons.push(configPath);
      continue;
    }
    if (rule.kind === 'restart') {
      plan.restartDaemon = true;
      plan.restartReasons.push(configPath);
      continue;
    }
    if (rule.kind === 'none') {
      plan.noopPaths.push(configPath);
      continue;
    }
    // Hot-reload
    plan.hotReasons.push(configPath);
    for (const action of rule.actions ?? []) {
      applyAction(action);
    }
  }

  return plan;
}

// =============================================================================
// Config Watcher
// =============================================================================

/**
 * Start watching the config file for changes.
 *
 * Uses chokidar (or a polling fallback) to detect file modifications.
 * Changes are debounced, validated, and then dispatched to either the
 * hot-reload or restart callback based on the reload plan.
 *
 * The watcher handles:
 * - File modifications (content changes)
 * - File creation (new config file)
 * - File deletion (revert to defaults)
 * - Debouncing rapid successive changes
 * - Validation before applying (invalid configs are skipped)
 * - Concurrent reload protection (serialized execution)
 */
export function startConfigWatcher(opts: ConfigWatcherOptions): ConfigWatcher {
  let currentConfig = opts.initialConfig;
  let settings = resolveReloadSettings(currentConfig);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;
  let running = false;
  let stopped = false;
  let restartQueued = false;

  // Lazily import chokidar to avoid hard dependency
  let watcher: {
    on: (event: string, cb: (...args: any[]) => void) => void;
    close: () => Promise<void>;
  } | null = null;

  const schedule = () => {
    if (stopped) {
      return;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    const wait = settings.debounceMs;
    debounceTimer = setTimeout(() => {
      void runReload();
    }, wait);
  };

  const runReload = async () => {
    if (stopped) {
      return;
    }
    if (running) {
      pending = true;
      return;
    }
    running = true;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    try {
      const snapshot = await opts.readSnapshot();
      if (!snapshot.valid) {
        const issues = snapshot.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join(', ');
        opts.log.warn(`config reload skipped (invalid config): ${issues}`);
        return;
      }

      const nextConfig = snapshot.config;
      const changedPaths = diffConfigPaths(currentConfig, nextConfig);
      currentConfig = nextConfig;
      settings = resolveReloadSettings(nextConfig);

      if (changedPaths.length === 0) {
        return;
      }

      opts.log.info(
        `config change detected; evaluating reload (${changedPaths.join(', ')})`,
      );
      const plan = buildReloadPlan(changedPaths);

      if (settings.mode === 'off') {
        opts.log.info('config reload disabled (daemon.reload.mode=off)');
        return;
      }

      if (settings.mode === 'restart') {
        if (!restartQueued) {
          restartQueued = true;
          opts.onRestart(plan, nextConfig);
        }
        return;
      }

      if (plan.restartDaemon) {
        if (settings.mode === 'hot') {
          opts.log.warn(
            `config reload requires daemon restart; hot mode ignoring (${plan.restartReasons.join(', ')})`,
          );
          return;
        }
        // hybrid mode
        if (!restartQueued) {
          restartQueued = true;
          opts.onRestart(plan, nextConfig);
        }
        return;
      }

      // Hot-reload
      await opts.onHotReload(plan, nextConfig);
    } catch (err) {
      opts.log.error(`config reload failed: ${String(err)}`);
    } finally {
      running = false;
      if (pending) {
        pending = false;
        schedule();
      }
    }
  };

  // Initialize the file watcher
  const initWatcher = async () => {
    try {
      // Dynamic import for chokidar (may not be available in all environments)
      const chokidar = await import('chokidar');
      const w = chokidar.watch(opts.watchPath, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
        usePolling: Boolean(process.env.VITEST),
      });

      w.on('add', schedule);
      w.on('change', schedule);
      w.on('unlink', schedule);

      let watcherClosed = false;
      w.on('error', (err: unknown) => {
        if (watcherClosed) {
          return;
        }
        watcherClosed = true;
        opts.log.warn(`config watcher error: ${String(err)}`);
        void w.close().catch(() => {});
      });

      watcher = w as unknown as NonNullable<typeof watcher>;
    } catch (err) {
      opts.log.warn(
        `chokidar not available; config file watching disabled. Install chokidar for live reload support. Error: ${String(err)}`,
      );

      // Fallback: poll every debounceMs * 10 for changes
      const pollInterval = Math.max(settings.debounceMs * 10, 3000);
      const poll = setInterval(() => {
        if (stopped) {
          clearInterval(poll);
          return;
        }
        schedule();
      }, pollInterval);

      watcher = {
        on: () => {},
        close: async () => {
          clearInterval(poll);
        },
      };
    }
  };

  // Start watching
  void initWatcher();

  return {
    stop: async () => {
      stopped = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = null;
      if (watcher) {
        await watcher.close().catch(() => {});
      }
    },
  };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Describe a reload plan as a human-readable summary.
 * Useful for logging and CLI output.
 */
export function describeReloadPlan(plan: ReloadPlan): string {
  const lines: string[] = [];

  if (plan.changedPaths.length === 0) {
    return 'No config changes detected.';
  }

  lines.push(`Config changes: ${plan.changedPaths.length} path(s)`);

  if (plan.restartDaemon) {
    lines.push(
      `  RESTART required: ${plan.restartReasons.join(', ')}`,
    );
  }

  if (plan.hotReasons.length > 0) {
    lines.push(`  Hot-reload: ${plan.hotReasons.join(', ')}`);
  }

  if (plan.reloadHooks) {
lines.push('    - Re-register hooks');
}
  if (plan.reloadAgents) {
lines.push('    - Refresh agent registry');
}
  if (plan.reloadMemory) {
lines.push('    - Reconfigure memory');
}
  if (plan.reloadSecurity) {
lines.push('    - Reinitialize security middleware');
}
  if (plan.reloadChannels.size > 0) {
    lines.push(
      `    - Restart channels: ${Array.from(plan.reloadChannels).join(', ')}`,
    );
  }

  if (plan.noopPaths.length > 0) {
    lines.push(`  No action needed: ${plan.noopPaths.join(', ')}`);
  }

  return lines.join('\n');
}
