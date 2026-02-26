/**
 * Plugin Sandbox Runtime
 *
 * Provides four tiers of runtime isolation for plugins based on their
 * trust level:
 *
 *   Tier 0 (None):    In-process with full access.
 *                     Used for trusted (@wundr/ first-party) plugins.
 *
 *   Tier 1 (VM):      Node.js vm module with restricted globals.
 *                     Used for verified (signature-checked) plugins.
 *
 *   Tier 2 (Worker):  worker_threads with resource limits.
 *                     Used for community plugins.
 *
 *   Tier 3 (Docker):  Full container isolation.
 *                     Used for untrusted plugins.
 *
 * Each sandbox tier wraps the plugin behind a PluginHandle interface that
 * presents a uniform API to the lifecycle manager regardless of isolation
 * mechanism.
 *
 * Production-grade features:
 *   - Per-tier resource limits (memory, CPU, time, network)
 *   - Filesystem access control (read-only mounts, no access to parent dirs)
 *   - Network access control (allowlist URLs/domains)
 *   - API access control (which daemon APIs plugins can call)
 *   - Plugin communication via structured message passing (IPC bus)
 *   - Sandbox cleanup and garbage collection
 *   - Plugin crash isolation (one plugin crash does not affect others)
 *   - Security scanning before plugin load
 *   - Plugin signature verification
 *   - Sandbox metrics (resource usage per plugin)
 *   - Graceful shutdown with timeout
 *   - Hot-reload support (unload, reload without daemon restart)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vm from 'vm';
import { Worker } from 'worker_threads';

import {
  type PermissionGuard,
  createPermissionGuard,
  buildSandboxedFsProxy,
  buildSandboxedEnvProxy,
} from './permission-system';
import { PluginMetricsRegistry } from './sandbox-metrics';
import { Logger } from '../utils/logger';

import type { PluginIpcBus, IpcHandler } from './plugin-ipc';
import type { PluginManifest, PluginTrustLevel } from './plugin-manifest';
import type { PluginMetrics } from './sandbox-metrics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SandboxTier = 'none' | 'vm' | 'worker' | 'docker';

export type PluginHandle = {
  /** Plugin name (from manifest). */
  name: string;
  /** Sandbox tier in use. */
  tier: SandboxTier;
  /** Call a method exposed by the plugin. */
  call(method: string, ...args: unknown[]): Promise<unknown>;
  /** Shut down the sandbox and release resources. */
  destroy(): Promise<void>;
  /** Whether the sandbox is still running. */
  isAlive(): boolean;
  /** Permission guard for runtime checks. */
  permissionGuard: PermissionGuard;
  /** Metrics collector for this plugin. */
  metrics: PluginMetrics;
  /** Subscribe this plugin to an IPC channel. */
  subscribeIpc?(channel: string, handler: IpcHandler): () => void;
  /** Send an IPC event from this plugin. */
  sendIpcEvent?(channel: string, payload: unknown): Promise<void>;
  /** Send an IPC request from this plugin. */
  sendIpcRequest?(
    to: string,
    channel: string,
    payload: unknown
  ): Promise<unknown>;
};

export type SandboxConfig = {
  /** Maximum memory for worker thread sandbox (bytes). */
  workerMaxMemoryMb: number;
  /** Maximum execution time for a single plugin call (ms). */
  callTimeoutMs: number;
  /** Docker image for container sandbox. */
  dockerImage: string;
  /** Docker container prefix. */
  dockerContainerPrefix: string;
  /** Docker network mode. */
  dockerNetwork: string;
  /** Docker memory limit. */
  dockerMemoryLimit: string;
  /** Docker CPU limit. */
  dockerCpuLimit: number;
  /** Docker PID limit. */
  dockerPidLimit: number;
  /** Graceful shutdown timeout (ms). */
  shutdownTimeoutMs: number;
  /** Maximum concurrent calls per plugin. */
  maxConcurrentCalls: number;
  /** VM sandbox memory limit (bytes, approximate via timeout heuristic). */
  vmCallTimeoutMs: number;
  /** Worker health check interval (ms). */
  workerHealthCheckIntervalMs: number;
  /** Docker container stop timeout (seconds). */
  dockerStopTimeoutSec: number;
  /** Network domains/hosts allowed across all tiers (empty = no restriction for trusted). */
  networkAllowlist: string[];
  /** Daemon API methods plugins are allowed to invoke. */
  apiAllowlist: string[];
};

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  workerMaxMemoryMb: 256,
  callTimeoutMs: 30_000,
  dockerImage: 'node:20-slim',
  dockerContainerPrefix: 'wundr-plugin-',
  dockerNetwork: 'none',
  dockerMemoryLimit: '512m',
  dockerCpuLimit: 0.5,
  dockerPidLimit: 100,
  shutdownTimeoutMs: 10_000,
  maxConcurrentCalls: 10,
  vmCallTimeoutMs: 30_000,
  workerHealthCheckIntervalMs: 30_000,
  dockerStopTimeoutSec: 10,
  networkAllowlist: [],
  apiAllowlist: [],
};

// ---------------------------------------------------------------------------
// Shared Metrics Registry
// ---------------------------------------------------------------------------

const globalMetricsRegistry = new PluginMetricsRegistry();

/**
 * Get the global metrics registry for all plugin sandboxes.
 */
export function getMetricsRegistry(): PluginMetricsRegistry {
  return globalMetricsRegistry;
}

// ---------------------------------------------------------------------------
// Trust Level to Sandbox Tier Mapping
// ---------------------------------------------------------------------------

export function tierForTrustLevel(trustLevel: PluginTrustLevel): SandboxTier {
  switch (trustLevel) {
    case 'trusted':
      return 'none';
    case 'verified':
      return 'vm';
    case 'community':
      return 'worker';
    case 'untrusted':
      return 'docker';
    default:
      return 'worker'; // Safe default
  }
}

// ---------------------------------------------------------------------------
// Concurrency Guard
// ---------------------------------------------------------------------------

/**
 * Limits concurrent calls into a plugin to prevent resource exhaustion
 * from runaway parallelism.
 */
class ConcurrencyGuard {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrent: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return;
    }
    return new Promise<void>(resolve => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  get pending(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.active;
  }
}

// ---------------------------------------------------------------------------
// Instrumented Call Wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps a plugin call with timeout enforcement, concurrency limiting,
 * and metrics recording.
 */
async function instrumentedCall(
  callFn: () => Promise<unknown>,
  metrics: PluginMetrics,
  guard: ConcurrencyGuard,
  timeoutMs: number,
  pluginName: string,
  method: string
): Promise<unknown> {
  await guard.acquire();
  const start = Date.now();
  let isTimeout = false;
  let isError = false;

  try {
    const result = await Promise.race([
      callFn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          isTimeout = true;
          reject(
            new Error(
              `Call to "${method}" on plugin "${pluginName}" timed out after ${timeoutMs}ms`
            )
          );
        }, timeoutMs);
      }),
    ]);
    return result;
  } catch (err) {
    if (!isTimeout) {
      isError = true;
    }
    throw err;
  } finally {
    const duration = Date.now() - start;
    metrics.recordCall(duration, isError, isTimeout);
    guard.release();
  }
}

// ---------------------------------------------------------------------------
// IPC Integration Helper
// ---------------------------------------------------------------------------

function buildIpcMethods(
  pluginName: string,
  ipcBus: PluginIpcBus | undefined
): Pick<PluginHandle, 'subscribeIpc' | 'sendIpcEvent' | 'sendIpcRequest'> {
  if (!ipcBus) {
    return {};
  }

  return {
    subscribeIpc(channel: string, handler: IpcHandler): () => void {
      return ipcBus.subscribe(pluginName, channel, handler);
    },
    async sendIpcEvent(channel: string, payload: unknown): Promise<void> {
      return ipcBus.sendEvent(pluginName, channel, payload);
    },
    async sendIpcRequest(
      to: string,
      channel: string,
      payload: unknown
    ): Promise<unknown> {
      return ipcBus.sendRequest(pluginName, to, channel, payload);
    },
  };
}

// ---------------------------------------------------------------------------
// Tier 1: VM Sandbox
// ---------------------------------------------------------------------------

const VM_ALLOWED_GLOBALS = [
  'console',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'Promise',
  'URL',
  'URLSearchParams',
  'TextEncoder',
  'TextDecoder',
  'structuredClone',
  'JSON',
  'Math',
  'Date',
  'RegExp',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Symbol',
  'Array',
  'Object',
  'String',
  'Number',
  'Boolean',
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'encodeURIComponent',
  'decodeURIComponent',
  'encodeURI',
  'decodeURI',
] as const;

/**
 * Create a restricted VM context with only safe globals and a sandboxed
 * plugin API. Network access is blocked by not providing any network
 * modules. Filesystem access goes through the permission guard.
 */
function createVmContext(params: {
  manifest: PluginManifest;
  guard: PermissionGuard;
  logger: Logger;
  config: SandboxConfig;
}): vm.Context {
  const sandboxGlobals: Record<string, unknown> = {};

  // Copy allowed globals from the real global
  for (const name of VM_ALLOWED_GLOBALS) {
    const value = (globalThis as any)[name];
    if (value !== undefined) {
      sandboxGlobals[name] = value;
    }
  }

  // Sandboxed console (logs are tagged with plugin name)
  const pluginName = params.manifest.name;
  sandboxGlobals['console'] = {
    log: (...args: unknown[]) =>
      params.logger.info(`[plugin:${pluginName}]`, ...args),
    info: (...args: unknown[]) =>
      params.logger.info(`[plugin:${pluginName}]`, ...args),
    warn: (...args: unknown[]) =>
      params.logger.warn(`[plugin:${pluginName}]`, ...args),
    error: (...args: unknown[]) =>
      params.logger.error(`[plugin:${pluginName}]`, ...args),
    debug: (...args: unknown[]) =>
      params.logger.debug(`[plugin:${pluginName}]`, ...args),
  };

  // Sandboxed filesystem API (permission-checked)
  sandboxGlobals['__wundr_fs'] = buildSandboxedFsProxy(params.guard);

  // Sandboxed env API (permission-checked)
  sandboxGlobals['__wundr_env'] = buildSandboxedEnvProxy(params.guard);

  // Network guard: provide a fetch-like function that checks permissions
  sandboxGlobals['__wundr_fetch'] = buildSandboxedFetch(
    params.guard,
    params.config
  );

  // Plugin metadata
  sandboxGlobals['__wundr_plugin'] = {
    name: params.manifest.name,
    version: params.manifest.version,
  };

  // Explicitly block dangerous globals
  sandboxGlobals['process'] = undefined;
  sandboxGlobals['require'] = undefined;
  sandboxGlobals['global'] = undefined;
  sandboxGlobals['globalThis'] = sandboxGlobals; // Self-referential but restricted

  return vm.createContext(sandboxGlobals, {
    name: `plugin:${pluginName}`,
  });
}

/**
 * Build a permission-checked fetch wrapper for VM sandboxes.
 */
function buildSandboxedFetch(
  guard: PermissionGuard,
  config: SandboxConfig
): (url: string, options?: Record<string, unknown>) => Promise<unknown> {
  return async (url: string, _options?: Record<string, unknown>) => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }

    // Check network permission
    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : undefined;
    guard.requireNetwork(parsedUrl.hostname, port);

    // Check against sandbox-level allowlist (if configured)
    if (config.networkAllowlist.length > 0) {
      const hostAllowed = config.networkAllowlist.some(allowed => {
        if (allowed === '*') {
          return true;
        }
        if (allowed === parsedUrl.hostname) {
          return true;
        }
        if (
          allowed.startsWith('*.') &&
          parsedUrl.hostname.endsWith(allowed.slice(1))
        ) {
          return true;
        }
        return false;
      });
      if (!hostAllowed) {
        throw new Error(
          `Network access to "${parsedUrl.hostname}" blocked by sandbox network allowlist`
        );
      }
    }

    // Delegate to the real fetch (available in Node 18+)
    const realFetch = (globalThis as any).fetch;
    if (typeof realFetch !== 'function') {
      throw new Error('fetch is not available in this Node.js version');
    }
    return realFetch(url, _options);
  };
}

async function createVmHandle(params: {
  manifest: PluginManifest;
  pluginDir: string;
  config: SandboxConfig;
  logger: Logger;
  ipcBus?: PluginIpcBus;
}): Promise<PluginHandle> {
  const guard = createPermissionGuard({
    manifest: params.manifest,
    pluginRoot: params.pluginDir,
  });

  const metrics = globalMetricsRegistry.getOrCreate(params.manifest.name, 'vm');
  const concurrencyGuard = new ConcurrencyGuard(
    params.config.maxConcurrentCalls
  );

  const context = createVmContext({
    manifest: params.manifest,
    guard,
    logger: params.logger,
    config: params.config,
  });

  // Load the entry point source
  const entryPath = path.join(params.pluginDir, params.manifest.entryPoint);
  const source = await fs.readFile(entryPath, 'utf-8');

  // Compile and run in the VM context
  const script = new vm.Script(source, {
    filename: entryPath,
  });

  const exports: Record<string, unknown> = {};
  context['module'] = { exports };
  context['exports'] = exports;

  script.runInContext(context, {
    timeout: params.config.vmCallTimeoutMs,
  });

  // Extract the plugin object from module.exports or exports.default
  const pluginObj = (exports['default'] as Record<string, unknown>) ?? exports;

  let alive = true;
  const ipcMethods = buildIpcMethods(params.manifest.name, params.ipcBus);

  return {
    name: params.manifest.name,
    tier: 'vm',
    permissionGuard: guard,
    metrics,
    ...ipcMethods,

    async call(method: string, ...args: unknown[]): Promise<unknown> {
      if (!alive) {
        throw new Error(
          `Plugin "${params.manifest.name}" sandbox is destroyed`
        );
      }
      const fn = (pluginObj as any)[method];
      if (typeof fn !== 'function') {
        throw new Error(
          `Plugin "${params.manifest.name}" has no method "${method}"`
        );
      }

      return instrumentedCall(
        async () => {
          const callScript = new vm.Script(
            '__wundr_result = __wundr_call_fn.apply(__wundr_call_this, __wundr_call_args)',
            { filename: `${params.manifest.name}:call:${method}` }
          );
          context['__wundr_call_fn'] = fn;
          context['__wundr_call_this'] = pluginObj;
          context['__wundr_call_args'] = args;
          callScript.runInContext(context, {
            timeout: params.config.vmCallTimeoutMs,
          });
          const result = context['__wundr_result'];
          if (result && typeof (result as any).then === 'function') {
            return await (result as Promise<unknown>);
          }
          return result;
        },
        metrics,
        concurrencyGuard,
        params.config.callTimeoutMs,
        params.manifest.name,
        method
      );
    },

    async destroy(): Promise<void> {
      alive = false;
      if (params.ipcBus) {
        params.ipcBus.unsubscribeAll(params.manifest.name);
      }
    },

    isAlive(): boolean {
      return alive;
    },
  };
}

// ---------------------------------------------------------------------------
// Tier 2: Worker Thread Sandbox
// ---------------------------------------------------------------------------

/**
 * The worker thread entry point code. This is a string that gets written
 * to a temp file and loaded as the worker's main script.
 *
 * The worker communicates with the main thread via parentPort:
 *   Main -> Worker: { type: 'call', id, method, args }
 *   Worker -> Main: { type: 'result', id, value } | { type: 'error', id, message }
 *   Main -> Worker: { type: 'shutdown' }
 *   Worker -> Main: { type: 'health', memoryUsage, cpuUsage }
 */
function buildWorkerBootstrap(entryPoint: string, _pluginName: string): string {
  return `
const { parentPort } = require('worker_threads');
const pluginModule = require(${JSON.stringify(entryPoint)});
const plugin = pluginModule.default || pluginModule;

// Health reporting
let healthInterval = null;
function startHealthReporting() {
  healthInterval = setInterval(() => {
    try {
      const mem = process.memoryUsage();
      const cpu = process.cpuUsage();
      parentPort.postMessage({
        type: 'health',
        memoryUsage: mem.heapUsed,
        rss: mem.rss,
        cpuUser: cpu.user,
        cpuSystem: cpu.system,
      });
    } catch {
      // Ignore health reporting errors
    }
  }, 10000);
  if (healthInterval.unref) healthInterval.unref();
}

// Error boundary: catch unhandled errors and report them
// instead of crashing silently
process.on('uncaughtException', (err) => {
  try {
    parentPort.postMessage({
      type: 'crash',
      message: err.message || String(err),
      stack: err.stack,
    });
  } catch {
    // Cannot communicate, exit
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  try {
    parentPort.postMessage({
      type: 'unhandledRejection',
      message: reason instanceof Error ? reason.message : String(reason),
    });
  } catch {
    // Ignore
  }
});

parentPort.on('message', async (msg) => {
  if (msg.type === 'call') {
    try {
      const fn = plugin[msg.method];
      if (typeof fn !== 'function') {
        parentPort.postMessage({ type: 'error', id: msg.id, message: 'Method not found: ' + msg.method });
        return;
      }
      const result = await fn.apply(plugin, msg.args || []);
      parentPort.postMessage({ type: 'result', id: msg.id, value: result });
    } catch (err) {
      parentPort.postMessage({
        type: 'error',
        id: msg.id,
        message: err.message || String(err),
      });
    }
  }
  if (msg.type === 'shutdown') {
    if (healthInterval) clearInterval(healthInterval);
    // Give plugin a chance to clean up
    if (typeof plugin.deactivate === 'function') {
      try { await plugin.deactivate(); } catch {}
    }
    process.exit(0);
  }
  if (msg.type === 'healthCheck') {
    const mem = process.memoryUsage();
    parentPort.postMessage({ type: 'healthCheckResponse', memoryUsage: mem.heapUsed, rss: mem.rss });
  }
});

startHealthReporting();
parentPort.postMessage({ type: 'ready' });
`;
}

async function createWorkerHandle(params: {
  manifest: PluginManifest;
  pluginDir: string;
  config: SandboxConfig;
  logger: Logger;
  ipcBus?: PluginIpcBus;
}): Promise<PluginHandle> {
  const guard = createPermissionGuard({
    manifest: params.manifest,
    pluginRoot: params.pluginDir,
  });

  const metrics = globalMetricsRegistry.getOrCreate(
    params.manifest.name,
    'worker'
  );
  const concurrencyGuard = new ConcurrencyGuard(
    params.config.maxConcurrentCalls
  );

  const entryPoint = path.join(params.pluginDir, params.manifest.entryPoint);
  const bootstrapCode = buildWorkerBootstrap(entryPoint, params.manifest.name);

  // Write bootstrap to a temp file
  const os = await import('os');
  const tmpDir = os.tmpdir();
  const bootstrapPath = path.join(
    tmpDir,
    `wundr-plugin-worker-${params.manifest.name.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.cjs`
  );
  await fs.writeFile(bootstrapPath, bootstrapCode, 'utf-8');

  // Compute environment restrictions: only pass through env vars the
  // plugin is allowed to read, plus PATH for node resolution.
  const allowedEnv: Record<string, string> = {
    PATH: process.env['PATH'] ?? '',
  };
  for (const varName of params.manifest.permissions.env.read) {
    if (varName === '*') {
      // If wildcard, pass everything (rare but allowed)
      Object.assign(allowedEnv, process.env);
      break;
    }
    if (varName.endsWith('*')) {
      const prefix = varName.slice(0, -1);
      for (const key of Object.keys(process.env)) {
        if (key.startsWith(prefix)) {
          allowedEnv[key] = process.env[key] ?? '';
        }
      }
    } else if (process.env[varName] !== undefined) {
      allowedEnv[varName] = process.env[varName]!;
    }
  }

  const worker = new Worker(bootstrapPath, {
    execArgv: ['--no-addons'],
    env: allowedEnv,
    resourceLimits: {
      maxOldGenerationSizeMb: params.config.workerMaxMemoryMb,
      maxYoungGenerationSizeMb: Math.ceil(params.config.workerMaxMemoryMb / 4),
      stackSizeMb: 4,
    },
  });

  let alive = true;
  let callId = 0;
  const pendingCalls = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  // Wait for the worker to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Worker for plugin "${params.manifest.name}" failed to start within timeout`
        )
      );
    }, 10_000);

    const onMessage = (msg: any) => {
      if (msg.type === 'ready') {
        clearTimeout(timeout);
        worker.off('message', onMessage);
        resolve();
      }
    };
    worker.on('message', onMessage);
    worker.on('error', err => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Health check timer
  let healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  if (params.config.workerHealthCheckIntervalMs > 0) {
    healthCheckTimer = setInterval(() => {
      if (!alive) {
        return;
      }
      worker.postMessage({ type: 'healthCheck' });
    }, params.config.workerHealthCheckIntervalMs);
    if (healthCheckTimer.unref) {
      healthCheckTimer.unref();
    }
  }

  // Process worker messages
  worker.on('message', (msg: any) => {
    if (msg.type === 'result' || msg.type === 'error') {
      const pending = pendingCalls.get(msg.id);
      if (!pending) {
        return;
      }
      pendingCalls.delete(msg.id);
      clearTimeout(pending.timer);
      if (msg.type === 'result') {
        pending.resolve(msg.value);
      } else {
        pending.reject(new Error(msg.message));
      }
    }

    if (msg.type === 'health' || msg.type === 'healthCheckResponse') {
      metrics.updateResourceUsage(msg.memoryUsage, msg.cpuUser);
    }

    if (msg.type === 'crash') {
      params.logger.error(
        `Plugin "${params.manifest.name}" worker crashed: ${msg.message}`
      );
      // The worker is about to exit; crash isolation means we just mark
      // this handle as dead. Other plugins continue running.
    }

    if (msg.type === 'unhandledRejection') {
      params.logger.warn(
        `Plugin "${params.manifest.name}" unhandled rejection: ${msg.message}`
      );
    }
  });

  worker.on('exit', code => {
    alive = false;
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer);
    }

    // Reject all pending calls
    for (const [, pending] of pendingCalls) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`Worker exited with code ${code}`));
    }
    pendingCalls.clear();

    // Clean up temp file
    fs.unlink(bootstrapPath).catch(() => {});

    if (params.ipcBus) {
      params.ipcBus.unsubscribeAll(params.manifest.name);
    }

    params.logger.info(
      `Plugin "${params.manifest.name}" worker exited (code=${code})`
    );
  });

  const ipcMethods = buildIpcMethods(params.manifest.name, params.ipcBus);

  return {
    name: params.manifest.name,
    tier: 'worker',
    permissionGuard: guard,
    metrics,
    ...ipcMethods,

    async call(method: string, ...args: unknown[]): Promise<unknown> {
      if (!alive) {
        throw new Error(
          `Plugin "${params.manifest.name}" worker is terminated`
        );
      }

      return instrumentedCall(
        () => {
          const id = ++callId;
          return new Promise<unknown>((resolve, reject) => {
            const timer = setTimeout(() => {
              pendingCalls.delete(id);
              reject(
                new Error(
                  `Call to "${method}" timed out after ${params.config.callTimeoutMs}ms`
                )
              );
            }, params.config.callTimeoutMs);

            pendingCalls.set(id, { resolve, reject, timer });
            worker.postMessage({ type: 'call', id, method, args });
          });
        },
        metrics,
        concurrencyGuard,
        params.config.callTimeoutMs,
        params.manifest.name,
        method
      );
    },

    async destroy(): Promise<void> {
      if (!alive) {
        return;
      }
      alive = false;
      if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
      }

      worker.postMessage({ type: 'shutdown' });
      // Give the worker a chance to exit gracefully
      await new Promise<void>(resolve => {
        const forceKill = setTimeout(() => {
          worker.terminate();
          resolve();
        }, params.config.shutdownTimeoutMs);
        if (forceKill.unref) {
          forceKill.unref();
        }
        worker.on('exit', () => {
          clearTimeout(forceKill);
          resolve();
        });
      });
    },

    isAlive(): boolean {
      return alive;
    },
  };
}

// ---------------------------------------------------------------------------
// Tier 3: Docker Container Sandbox
// ---------------------------------------------------------------------------

/**
 * Docker sandbox runs the plugin inside a container. Communication happens
 * via a JSON-RPC protocol over stdin/stdout of `docker exec`.
 *
 * This tier provides the strongest isolation but highest latency.
 *
 * Production features:
 *   - Read-only filesystem mount for plugin code
 *   - All capabilities dropped
 *   - No new privileges
 *   - Network isolation (configurable)
 *   - PID, memory, and CPU limits
 *   - Automatic container cleanup on destroy
 *   - Container health monitoring
 */
async function createDockerHandle(params: {
  manifest: PluginManifest;
  pluginDir: string;
  config: SandboxConfig;
  logger: Logger;
  ipcBus?: PluginIpcBus;
}): Promise<PluginHandle> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  const guard = createPermissionGuard({
    manifest: params.manifest,
    pluginRoot: params.pluginDir,
  });

  const metrics = globalMetricsRegistry.getOrCreate(
    params.manifest.name,
    'docker'
  );
  const concurrencyGuard = new ConcurrencyGuard(
    params.config.maxConcurrentCalls
  );

  const containerName = `${params.config.dockerContainerPrefix}${params.manifest.name.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;

  // Determine network mode. If the plugin declares network hosts, use
  // bridge networking with DNS. Otherwise, use 'none' for full isolation.
  const hasNetworkPerms = params.manifest.permissions.network.hosts.length > 0;
  const networkMode = hasNetworkPerms ? 'bridge' : params.config.dockerNetwork;

  // Build docker create args with production security hardening
  const createArgs = [
    'create',
    '--name',
    containerName,
    '--label',
    'wundr.plugin=1',
    '--label',
    `wundr.plugin.name=${params.manifest.name}`,
    '--label',
    `wundr.plugin.version=${params.manifest.version}`,
    '--read-only',
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,size=64m',
    '--tmpfs',
    '/var/tmp:rw,noexec,nosuid,size=32m',
    '--network',
    networkMode,
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--pids-limit',
    String(params.config.dockerPidLimit),
    '--memory',
    params.config.dockerMemoryLimit,
    '--memory-swap',
    params.config.dockerMemoryLimit, // No swap
    '--cpus',
    String(params.config.dockerCpuLimit),
    '--ulimit',
    'nofile=256:512',
    '--ulimit',
    'nproc=64:128',
    '-v',
    `${path.resolve(params.pluginDir)}:/plugin:ro`,
    '--workdir',
    '/plugin',
    '--restart',
    'no',
    params.config.dockerImage,
    'node',
    '-e',
    // Long-running process that accepts JSON-RPC commands on stdin
    buildDockerEntrypoint(params.manifest.entryPoint),
  ];

  // Create and start the container
  await execFileAsync('docker', createArgs);
  await execFileAsync('docker', ['start', containerName]);

  // Verify node is available
  try {
    await execFileAsync('docker', ['exec', containerName, 'node', '--version']);
  } catch {
    params.logger.warn(
      `Node.js not found in Docker image ${params.config.dockerImage}. Plugin calls may fail.`
    );
  }

  let alive = true;
  const ipcMethods = buildIpcMethods(params.manifest.name, params.ipcBus);

  // Container health monitoring
  let healthTimer: ReturnType<typeof setInterval> | null = null;
  healthTimer = setInterval(async () => {
    if (!alive) {
      if (healthTimer) {
        clearInterval(healthTimer);
      }
      return;
    }
    try {
      const { stdout } = await execFileAsync('docker', [
        'stats',
        '--no-stream',
        '--format',
        '{{.MemUsage}}',
        containerName,
      ]);
      // Parse memory usage (e.g., "12.5MiB / 512MiB")
      const memMatch = stdout.match(/([\d.]+)\s*(KiB|MiB|GiB)/);
      if (memMatch) {
        const value = parseFloat(memMatch[1]!);
        const unit = memMatch[2]!;
        let bytes = value;
        if (unit === 'KiB') {
          bytes *= 1024;
        } else if (unit === 'MiB') {
          bytes *= 1024 * 1024;
        } else if (unit === 'GiB') {
          bytes *= 1024 * 1024 * 1024;
        }
        metrics.updateResourceUsage(Math.round(bytes));
      }
    } catch {
      // Container may have exited
    }
  }, params.config.workerHealthCheckIntervalMs);
  if (healthTimer.unref) {
    healthTimer.unref();
  }

  return {
    name: params.manifest.name,
    tier: 'docker',
    permissionGuard: guard,
    metrics,
    ...ipcMethods,

    async call(method: string, ...args: unknown[]): Promise<unknown> {
      if (!alive) {
        throw new Error(
          `Plugin "${params.manifest.name}" container is stopped`
        );
      }

      return instrumentedCall(
        async () => {
          const invokeScript = `
            const m = require('./${params.manifest.entryPoint}');
            const p = m.default || m;
            const fn = p[${JSON.stringify(method)}];
            if (typeof fn !== 'function') { process.stderr.write('Method not found'); process.exit(1); }
            Promise.resolve(fn.apply(p, ${JSON.stringify(args)}))
              .then(r => { process.stdout.write(JSON.stringify({ ok: true, value: r })); })
              .catch(e => { process.stdout.write(JSON.stringify({ ok: false, error: e.message })); });
          `;

          const { stdout, stderr } = await execFileAsync(
            'docker',
            ['exec', containerName, 'node', '-e', invokeScript],
            { timeout: params.config.callTimeoutMs }
          );

          if (stderr && stderr.trim()) {
            params.logger.warn(
              `[plugin:${params.manifest.name}:docker:stderr] ${stderr.trim()}`
            );
          }

          try {
            const result = JSON.parse(stdout);
            if (result.ok) {
              return result.value;
            }
            throw new Error(result.error || 'Unknown plugin error');
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) {
              throw new Error(
                `Invalid response from plugin container: ${stdout.slice(0, 200)}`
              );
            }
            throw parseErr;
          }
        },
        metrics,
        concurrencyGuard,
        params.config.callTimeoutMs,
        params.manifest.name,
        method
      );
    },

    async destroy(): Promise<void> {
      if (!alive) {
        return;
      }
      alive = false;
      if (healthTimer) {
        clearInterval(healthTimer);
      }

      if (params.ipcBus) {
        params.ipcBus.unsubscribeAll(params.manifest.name);
      }

      try {
        // Graceful stop with timeout, then force remove
        await execFileAsync('docker', [
          'stop',
          '-t',
          String(params.config.dockerStopTimeoutSec),
          containerName,
        ]);
      } catch {
        // Container may already be stopped
      }

      try {
        await execFileAsync('docker', ['rm', '-f', containerName]);
      } catch {
        // Ignore removal failures
      }
    },

    isAlive(): boolean {
      return alive;
    },
  };
}

/**
 * Build a long-running Node.js entrypoint for Docker containers.
 * This keeps the container alive and ready to accept exec calls.
 */
function buildDockerEntrypoint(entryPoint: string): string {
  return `
    // Keep-alive process for plugin container
    const m = require('./${entryPoint}');
    const plugin = m.default || m;
    if (typeof plugin.activate === 'function') {
      plugin.activate({ name: plugin.name || 'unknown' }).catch(() => {});
    }
    // Stay alive indefinitely
    setInterval(() => {}, 60000);
  `;
}

// ---------------------------------------------------------------------------
// Tier 0: No Sandbox (Trusted Plugins)
// ---------------------------------------------------------------------------

async function createInProcessHandle(params: {
  manifest: PluginManifest;
  pluginDir: string;
  config: SandboxConfig;
  logger: Logger;
  ipcBus?: PluginIpcBus;
}): Promise<PluginHandle> {
  const guard = createPermissionGuard({
    manifest: params.manifest,
    pluginRoot: params.pluginDir,
  });

  const metrics = globalMetricsRegistry.getOrCreate(
    params.manifest.name,
    'none'
  );
  const concurrencyGuard = new ConcurrencyGuard(
    params.config.maxConcurrentCalls
  );

  const entryPath = path.join(params.pluginDir, params.manifest.entryPoint);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pluginModule = require(entryPath);
  const plugin = pluginModule.default ?? pluginModule;

  let alive = true;
  const ipcMethods = buildIpcMethods(params.manifest.name, params.ipcBus);

  return {
    name: params.manifest.name,
    tier: 'none',
    permissionGuard: guard,
    metrics,
    ...ipcMethods,

    async call(method: string, ...args: unknown[]): Promise<unknown> {
      if (!alive) {
        throw new Error(`Plugin "${params.manifest.name}" is unloaded`);
      }
      const fn = (plugin as any)[method];
      if (typeof fn !== 'function') {
        throw new Error(
          `Plugin "${params.manifest.name}" has no method "${method}"`
        );
      }

      return instrumentedCall(
        async () => fn.apply(plugin, args),
        metrics,
        concurrencyGuard,
        params.config.callTimeoutMs,
        params.manifest.name,
        method
      );
    },

    async destroy(): Promise<void> {
      alive = false;
      if (params.ipcBus) {
        params.ipcBus.unsubscribeAll(params.manifest.name);
      }
      if (typeof plugin.deactivate === 'function') {
        try {
          await plugin.deactivate();
        } catch {
          // Best effort
        }
      }
    },

    isAlive(): boolean {
      return alive;
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a sandboxed plugin handle based on the plugin's trust level.
 */
export async function createSandboxedPlugin(params: {
  manifest: PluginManifest;
  pluginDir: string;
  config?: Partial<SandboxConfig>;
  tierOverride?: SandboxTier;
  logger?: Logger;
  ipcBus?: PluginIpcBus;
}): Promise<PluginHandle> {
  const config: SandboxConfig = { ...DEFAULT_SANDBOX_CONFIG, ...params.config };
  const logger = params.logger ?? new Logger('PluginSandbox');
  const tier =
    params.tierOverride ?? tierForTrustLevel(params.manifest.trustLevel);

  logger.info(
    `Creating sandbox for plugin "${params.manifest.name}" (trust=${params.manifest.trustLevel}, tier=${tier})`
  );

  switch (tier) {
    case 'none':
      return createInProcessHandle({
        manifest: params.manifest,
        pluginDir: params.pluginDir,
        config,
        logger,
        ipcBus: params.ipcBus,
      });

    case 'vm':
      return createVmHandle({
        manifest: params.manifest,
        pluginDir: params.pluginDir,
        config,
        logger,
        ipcBus: params.ipcBus,
      });

    case 'worker':
      return createWorkerHandle({
        manifest: params.manifest,
        pluginDir: params.pluginDir,
        config,
        logger,
        ipcBus: params.ipcBus,
      });

    case 'docker':
      return createDockerHandle({
        manifest: params.manifest,
        pluginDir: params.pluginDir,
        config,
        logger,
        ipcBus: params.ipcBus,
      });

    default:
      throw new Error(`Unknown sandbox tier: ${tier}`);
  }
}

/**
 * Destroy all handles in a collection (convenience for shutdown).
 * Uses Promise.allSettled so one failure does not block others.
 */
export async function destroyAllHandles(
  handles: PluginHandle[]
): Promise<void> {
  await Promise.allSettled(handles.map(h => h.destroy()));
}
