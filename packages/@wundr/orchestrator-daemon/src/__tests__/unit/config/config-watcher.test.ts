/**
 * Tests for the Config Watcher module (src/config/config-watcher.ts).
 *
 * Covers:
 *  - resolveReloadSettings (mode resolution, debounceMs clamping)
 *  - buildReloadPlan (classify paths into restart/hot/noop, action flags)
 *  - describeReloadPlan (human-readable summary)
 *  - startConfigWatcher (debounced reload, hot vs restart dispatch,
 *    invalid config skip, mode=off, concurrent reload protection)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  resolveReloadSettings,
  buildReloadPlan,
  describeReloadPlan,
  startConfigWatcher,
  type ConfigWatcherOptions,
  type ConfigWatcherLogger,
} from '../../../config/config-watcher';

import type { ConfigSnapshot } from '../../../config/config-loader';
import type { WundrConfig } from '../../../config/schemas';

// ---------------------------------------------------------------------------
// Chokidar mock -- vi.hoisted + vi.mock to intercept dynamic import('chokidar')
// ---------------------------------------------------------------------------

/**
 * vi.hoisted runs before any imports/mocks are set up, allowing us to
 * define shared state that both the mock factory and the tests can reference.
 */
const { chokidarState } = vi.hoisted(() => {
  const state = {
    callbacks: {} as Record<string, (...args: any[]) => void>,
  };
  return { chokidarState: state };
});

vi.mock('chokidar', () => ({
  watch: () => {
    const watcher = {
      on(event: string, cb: (...args: any[]) => void) {
        chokidarState.callbacks[event] = cb;
        return watcher;
      },
      close: () => Promise.resolve(),
    };
    return watcher;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal WundrConfig-compatible object with optional daemon.reload
 * overrides. We only include fields the watcher actually inspects.
 */
function createMinimalConfig(overrides?: {
  daemon?: { reload?: { mode?: string; debounceMs?: number } };
}): WundrConfig {
  return {
    daemon: {
      reload: {
        mode: 'hybrid',
        debounceMs: 300,
        ...overrides?.daemon?.reload,
      },
      ...overrides?.daemon,
    },
  } as unknown as WundrConfig;
}

function createMockLogger(): ConfigWatcherLogger & {
  calls: { info: string[]; warn: string[]; error: string[] };
} {
  const calls = {
    info: [] as string[],
    warn: [] as string[],
    error: [] as string[],
  };
  return {
    calls,
    info: (msg: string) => calls.info.push(msg),
    warn: (msg: string) => calls.warn.push(msg),
    error: (msg: string) => calls.error.push(msg),
  };
}

// ---------------------------------------------------------------------------
// resolveReloadSettings
// ---------------------------------------------------------------------------

describe('resolveReloadSettings', () => {
  it('should return default settings for empty daemon config', () => {
    const config = createMinimalConfig();
    const settings = resolveReloadSettings(config);
    expect(settings.mode).toBe('hybrid');
    expect(settings.debounceMs).toBe(300);
  });

  it.each(['off', 'hot', 'restart', 'hybrid'] as const)(
    'should accept valid mode "%s"',
    mode => {
      const config = createMinimalConfig({ daemon: { reload: { mode } } });
      const settings = resolveReloadSettings(config);
      expect(settings.mode).toBe(mode);
    }
  );

  it('should fall back to hybrid for invalid mode string', () => {
    const config = createMinimalConfig({
      daemon: { reload: { mode: 'invalid-mode' } },
    });
    const settings = resolveReloadSettings(config);
    expect(settings.mode).toBe('hybrid');
  });

  it('should clamp negative debounceMs to 0', () => {
    const config = createMinimalConfig({
      daemon: { reload: { debounceMs: -100 } },
    });
    const settings = resolveReloadSettings(config);
    expect(settings.debounceMs).toBe(0);
  });

  it('should floor fractional debounceMs', () => {
    const config = createMinimalConfig({
      daemon: { reload: { debounceMs: 150.9 } },
    });
    const settings = resolveReloadSettings(config);
    expect(settings.debounceMs).toBe(150);
  });

  it('should default debounceMs to 300 for non-numeric value', () => {
    const config = createMinimalConfig({
      daemon: { reload: { debounceMs: NaN } },
    });
    const settings = resolveReloadSettings(config);
    expect(settings.debounceMs).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// buildReloadPlan
// ---------------------------------------------------------------------------

describe('buildReloadPlan', () => {
  it('should return empty plan for no changes', () => {
    const plan = buildReloadPlan([]);
    expect(plan.changedPaths).toEqual([]);
    expect(plan.restartDaemon).toBe(false);
    expect(plan.restartReasons).toEqual([]);
    expect(plan.hotReasons).toEqual([]);
    expect(plan.noopPaths).toEqual([]);
  });

  // --- Restart-required paths ---

  it('should classify "daemon.port" as restart', () => {
    const plan = buildReloadPlan(['daemon.port']);
    expect(plan.restartDaemon).toBe(true);
    expect(plan.restartReasons).toContain('daemon.port');
  });

  it('should classify "plugins" as restart', () => {
    const plan = buildReloadPlan(['plugins']);
    expect(plan.restartDaemon).toBe(true);
    expect(plan.restartReasons).toContain('plugins');
  });

  it('should classify "redis.url" as restart', () => {
    const plan = buildReloadPlan(['redis.url']);
    expect(plan.restartDaemon).toBe(true);
  });

  it('should classify "security.jwt" as restart', () => {
    const plan = buildReloadPlan(['security.jwt.secret']);
    expect(plan.restartDaemon).toBe(true);
  });

  // --- Hot-reloadable paths ---

  it('should classify "hooks" as hot-reload with reload-hooks action', () => {
    const plan = buildReloadPlan(['hooks.onMessage']);
    expect(plan.restartDaemon).toBe(false);
    expect(plan.hotReasons).toContain('hooks.onMessage');
    expect(plan.reloadHooks).toBe(true);
  });

  it('should classify "agents" as hot-reload with reload-agents action', () => {
    const plan = buildReloadPlan(['agents.default.model']);
    expect(plan.reloadAgents).toBe(true);
    expect(plan.restartDaemon).toBe(false);
  });

  it('should classify "memory" as hot-reload with reload-memory action', () => {
    const plan = buildReloadPlan(['memory.compaction']);
    expect(plan.reloadMemory).toBe(true);
  });

  it('should classify channel changes and track channel names', () => {
    const plan = buildReloadPlan([
      'channels.slack.token',
      'channels.discord.botId',
    ]);
    expect(plan.restartDaemon).toBe(false);
    expect(plan.reloadChannels.has('slack')).toBe(true);
    expect(plan.reloadChannels.has('discord')).toBe(true);
  });

  it('should classify "security.rateLimit" as hot-reload with security action', () => {
    const plan = buildReloadPlan(['security.rateLimit.max']);
    expect(plan.reloadSecurity).toBe(true);
    expect(plan.restartDaemon).toBe(false);
  });

  // --- No-op paths ---

  it('should classify "monitoring" as no-op', () => {
    const plan = buildReloadPlan(['monitoring.enabled']);
    expect(plan.noopPaths).toContain('monitoring.enabled');
    expect(plan.restartDaemon).toBe(false);
    expect(plan.hotReasons).toHaveLength(0);
  });

  it('should classify "logging.level" as no-op', () => {
    const plan = buildReloadPlan(['logging.level']);
    expect(plan.noopPaths).toContain('logging.level');
  });

  it('should classify "daemon.reload" as no-op', () => {
    const plan = buildReloadPlan(['daemon.reload.mode']);
    expect(plan.noopPaths).toContain('daemon.reload.mode');
    expect(plan.restartDaemon).toBe(false);
  });

  // --- Unknown paths ---

  it('should classify unknown paths as restart (safe fallback)', () => {
    const plan = buildReloadPlan(['unknownSection.foo']);
    expect(plan.restartDaemon).toBe(true);
    expect(plan.restartReasons).toContain('unknownSection.foo');
  });

  // --- Mixed changes ---

  it('should combine hot and restart paths correctly', () => {
    const plan = buildReloadPlan([
      'hooks.beforeSend', // hot
      'daemon.host', // restart
      'monitoring.interval', // noop
    ]);
    expect(plan.restartDaemon).toBe(true);
    expect(plan.reloadHooks).toBe(true);
    expect(plan.noopPaths).toContain('monitoring.interval');
    expect(plan.restartReasons).toContain('daemon.host');
    expect(plan.hotReasons).toContain('hooks.beforeSend');
  });
});

// ---------------------------------------------------------------------------
// describeReloadPlan
// ---------------------------------------------------------------------------

describe('describeReloadPlan', () => {
  it('should describe empty plan as no changes', () => {
    const plan = buildReloadPlan([]);
    expect(describeReloadPlan(plan)).toBe('No config changes detected.');
  });

  it('should include restart reasons in description', () => {
    const plan = buildReloadPlan(['daemon.port']);
    const desc = describeReloadPlan(plan);
    expect(desc).toContain('RESTART');
    expect(desc).toContain('daemon.port');
  });

  it('should include hot-reload actions in description', () => {
    const plan = buildReloadPlan(['hooks.onMessage', 'channels.slack.token']);
    const desc = describeReloadPlan(plan);
    expect(desc).toContain('Hot-reload');
    expect(desc).toContain('Re-register hooks');
    expect(desc).toContain('Restart channels');
    expect(desc).toContain('slack');
  });

  it('should include noop paths in description', () => {
    const plan = buildReloadPlan(['monitoring.enabled']);
    const desc = describeReloadPlan(plan);
    expect(desc).toContain('No action needed');
  });
});

// ---------------------------------------------------------------------------
// startConfigWatcher
// ---------------------------------------------------------------------------

describe('startConfigWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset chokidar callback state before each test
    for (const key of Object.keys(chokidarState.callbacks)) {
      delete chokidarState.callbacks[key];
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * Sets up a watcher instance with the module-level chokidar mock.
   * The mock is registered via vi.mock (hoisted) so that the dynamic
   * import('chokidar') inside startConfigWatcher resolves to our stub.
   */
  function setupWatcher(opts?: {
    initialConfig?: WundrConfig;
    nextSnapshot?: Partial<ConfigSnapshot>;
    reloadMode?: string;
  }) {
    const initialConfig =
      opts?.initialConfig ??
      createMinimalConfig({
        daemon: {
          reload: { mode: opts?.reloadMode ?? 'hybrid', debounceMs: 100 },
        },
      });

    const nextConfig = createMinimalConfig({
      daemon: { reload: { mode: 'hybrid', debounceMs: 100 } },
    });

    const defaultSnapshot: ConfigSnapshot = {
      path: '/test/config.json',
      exists: true,
      raw: '{}',
      parsed: {},
      valid: true,
      config: nextConfig,
      hash: 'abc123',
      issues: [],
      warnings: [],
    };

    const snapshot = { ...defaultSnapshot, ...opts?.nextSnapshot };

    const log = createMockLogger();
    const onHotReload = vi.fn().mockResolvedValue(undefined);
    const onRestart = vi.fn();
    const readSnapshot = vi.fn().mockResolvedValue(snapshot);

    const watcherOpts: ConfigWatcherOptions = {
      initialConfig,
      readSnapshot,
      onHotReload,
      onRestart,
      watchPath: '/test/config.json',
      log,
    };

    const watcher = startConfigWatcher(watcherOpts);

    return {
      watcher,
      log,
      onHotReload,
      onRestart,
      readSnapshot,
      snapshot,
      initialConfig,
      nextConfig,
    };
  }

  /**
   * Helper: wait for the async initWatcher() (which calls
   * `await import('chokidar')`) to complete and register .on() callbacks.
   *
   * The dynamic import resolves as a microtask chain that is difficult to
   * flush reliably under fake timers. We briefly switch to real timers
   * and poll until the 'change' callback appears, then re-enable fake
   * timers for the rest of the test.
   */
  async function waitForWatcherInit() {
    vi.useRealTimers();
    // Poll until the dynamic import('chokidar') promise chain has
    // resolved and the mock's .on('change', ...) callback is registered.
    const deadline = Date.now() + 2000;
    while (!chokidarState.callbacks['change'] && Date.now() < deadline) {
      await new Promise<void>(resolve => setTimeout(resolve, 2));
    }
    if (!chokidarState.callbacks['change']) {
      throw new Error(
        'waitForWatcherInit: chokidar change callback was not registered within 2s'
      );
    }
    vi.useFakeTimers();
  }

  it('should debounce file change events', async () => {
    const { watcher, readSnapshot } = setupWatcher();
    await waitForWatcherInit();

    const cbs = chokidarState.callbacks;

    // Trigger multiple rapid changes via the captured chokidar callbacks
    cbs['change']('/test/config.json');
    cbs['change']('/test/config.json');
    cbs['change']('/test/config.json');

    // Advance time partially -- should not have triggered yet
    await vi.advanceTimersByTimeAsync(50);
    expect(readSnapshot).not.toHaveBeenCalled();

    // Advance past debounce
    await vi.advanceTimersByTimeAsync(100);

    // Should have been called once (debounced)
    expect(readSnapshot).toHaveBeenCalledTimes(1);

    await watcher.stop();
  });

  it('should skip invalid config snapshots', async () => {
    const { watcher, log, onHotReload, onRestart } = setupWatcher({
      nextSnapshot: {
        valid: false,
        issues: [{ path: 'daemon.port', message: 'must be a number' }],
      },
    });
    await waitForWatcherInit();

    chokidarState.callbacks['change']('/test/config.json');

    await vi.advanceTimersByTimeAsync(200);

    expect(onHotReload).not.toHaveBeenCalled();
    expect(onRestart).not.toHaveBeenCalled();
    expect(log.calls.warn.some(m => m.includes('invalid config'))).toBe(true);

    await watcher.stop();
  });

  it('should not trigger reload when config is unchanged', async () => {
    // Use same config for initial and snapshot
    const sameConfig = createMinimalConfig({
      daemon: { reload: { mode: 'hybrid', debounceMs: 100 } },
    });

    const { watcher, onHotReload, onRestart } = setupWatcher({
      initialConfig: sameConfig,
      nextSnapshot: { config: sameConfig },
    });
    await waitForWatcherInit();

    chokidarState.callbacks['change']('/test/config.json');

    await vi.advanceTimersByTimeAsync(200);

    expect(onHotReload).not.toHaveBeenCalled();
    expect(onRestart).not.toHaveBeenCalled();

    await watcher.stop();
  });

  it('should call onRestart for restart-required changes in hybrid mode', async () => {
    const nextConfig = {
      ...createMinimalConfig({
        daemon: { reload: { mode: 'hybrid', debounceMs: 100 } },
      }),
      plugins: { newPlugin: {} },
    } as unknown as WundrConfig;

    const { watcher, onRestart, onHotReload } = setupWatcher({
      nextSnapshot: { config: nextConfig },
    });
    await waitForWatcherInit();

    chokidarState.callbacks['change']('/test/config.json');

    await vi.advanceTimersByTimeAsync(200);

    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onHotReload).not.toHaveBeenCalled();

    await watcher.stop();
  });

  it('should not trigger reload when mode is off', async () => {
    const nextConfig = createMinimalConfig({
      daemon: { reload: { mode: 'off', debounceMs: 100 } },
    });
    // Make it slightly different from initial to trigger a diff
    const initialConfig = createMinimalConfig({
      daemon: { reload: { mode: 'off', debounceMs: 100 } },
    });
    (initialConfig as any).__diffMarker = true;

    const { watcher, onHotReload, onRestart } = setupWatcher({
      initialConfig,
      nextSnapshot: { config: nextConfig },
    });
    await waitForWatcherInit();

    chokidarState.callbacks['change']('/test/config.json');

    await vi.advanceTimersByTimeAsync(200);

    expect(onHotReload).not.toHaveBeenCalled();
    expect(onRestart).not.toHaveBeenCalled();

    await watcher.stop();
  });

  it('should stop watching on stop()', async () => {
    const { watcher, readSnapshot } = setupWatcher();
    await waitForWatcherInit();

    await watcher.stop();

    // Trigger a change after stop -- schedule() will return early
    chokidarState.callbacks['change']('/test/config.json');

    await vi.advanceTimersByTimeAsync(500);

    expect(readSnapshot).not.toHaveBeenCalled();
  });
});
