/**
 * Plugin Sandbox Runtime
 *
 * Provides three tiers of runtime isolation for plugins based on their
 * trust level:
 *
 *   Tier 1 (VM):     Node.js vm module with restricted globals.
 *                     Used for verified (signature-checked) plugins.
 *
 *   Tier 2 (Worker):  worker_threads with resource limits.
 *                     Used for community plugins.
 *
 *   Tier 3 (Docker):  Full container isolation.
 *                     Used for untrusted plugins.
 *
 * Trusted (@wundr/ first-party) plugins skip sandboxing and run
 * in-process with full access.
 *
 * Each sandbox tier wraps the plugin behind a PluginHandle interface that
 * presents a uniform API to the lifecycle manager regardless of isolation
 * mechanism.
 */

import * as vm from 'vm';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Worker, MessageChannel } from 'worker_threads';
import type { PluginManifest, PluginTrustLevel } from './plugin-manifest';
import {
  type PermissionGuard,
  createPermissionGuard,
  buildSandboxedFsProxy,
  buildSandboxedEnvProxy,
} from './permission-system';
import { Logger } from '../utils/logger';

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
};

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
 * plugin API.
 */
function createVmContext(params: {
  manifest: PluginManifest;
  guard: PermissionGuard;
  logger: Logger;
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
    log: (...args: unknown[]) => params.logger.info(`[plugin:${pluginName}]`, ...args),
    info: (...args: unknown[]) => params.logger.info(`[plugin:${pluginName}]`, ...args),
    warn: (...args: unknown[]) => params.logger.warn(`[plugin:${pluginName}]`, ...args),
    error: (...args: unknown[]) => params.logger.error(`[plugin:${pluginName}]`, ...args),
    debug: (...args: unknown[]) => params.logger.debug(`[plugin:${pluginName}]`, ...args),
  };

  // Sandboxed filesystem API (permission-checked)
  sandboxGlobals['__wundr_fs'] = buildSandboxedFsProxy(params.guard);

  // Sandboxed env API (permission-checked)
  sandboxGlobals['__wundr_env'] = buildSandboxedEnvProxy(params.guard);

  // Plugin metadata
  sandboxGlobals['__wundr_plugin'] = {
    name: params.manifest.name,
    version: params.manifest.version,
  };

  return vm.createContext(sandboxGlobals, {
    name: `plugin:${pluginName}`,
  });
}

async function createVmHandle(params: {
  manifest: PluginManifest;
  pluginDir: string;
  config: SandboxConfig;
  logger: Logger;
}): Promise<PluginHandle> {
  const guard = createPermissionGuard({
    manifest: params.manifest,
    pluginRoot: params.pluginDir,
  });

  const context = createVmContext({
    manifest: params.manifest,
    guard,
    logger: params.logger,
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
    timeout: params.config.callTimeoutMs,
  });

  // Extract the plugin object from module.exports or exports.default
  const pluginObj =
    (exports['default'] as Record<string, unknown>) ?? exports;

  let alive = true;

  return {
    name: params.manifest.name,
    tier: 'vm',
    permissionGuard: guard,

    async call(method: string, ...args: unknown[]): Promise<unknown> {
      if (!alive) throw new Error(`Plugin "${params.manifest.name}" sandbox is destroyed`);
      const fn = (pluginObj as any)[method];
      if (typeof fn !== 'function') {
        throw new Error(`Plugin "${params.manifest.name}" has no method "${method}"`);
      }
      // Run the call in the VM context with a timeout
      const callScript = new vm.Script(
        `__wundr_result = __wundr_call_fn.apply(__wundr_call_this, __wundr_call_args)`,
        { filename: `${params.manifest.name}:call:${method}` },
      );
      context['__wundr_call_fn'] = fn;
      context['__wundr_call_this'] = pluginObj;
      context['__wundr_call_args'] = args;
      callScript.runInContext(context, { timeout: params.config.callTimeoutMs });
      const result = context['__wundr_result'];
      // Await if promise
      if (result && typeof (result as any).then === 'function') {
        return await (result as Promise<unknown>);
      }
      return result;
    },

    async destroy(): Promise<void> {
      alive = false;
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
 * The worker communicates with the main thread via a MessagePort:
 *   Main -> Worker: { type: 'call', id, method, args }
 *   Worker -> Main: { type: 'result', id, value } | { type: 'error', id, message }
 */
function buildWorkerBootstrap(entryPoint: string, pluginName: string): string {
  return `
const { parentPort } = require('worker_threads');
const pluginModule = require(${JSON.stringify(entryPoint)});
const plugin = pluginModule.default || pluginModule;

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
      parentPort.postMessage({ type: 'error', id: msg.id, message: err.message || String(err) });
    }
  }
  if (msg.type === 'shutdown') {
    process.exit(0);
  }
});

parentPort.postMessage({ type: 'ready' });
`;
}

async function createWorkerHandle(params: {
  manifest: PluginManifest;
  pluginDir: string;
  config: SandboxConfig;
  logger: Logger;
}): Promise<PluginHandle> {
  const guard = createPermissionGuard({
    manifest: params.manifest,
    pluginRoot: params.pluginDir,
  });

  const entryPoint = path.join(params.pluginDir, params.manifest.entryPoint);
  const bootstrapCode = buildWorkerBootstrap(entryPoint, params.manifest.name);

  // Write bootstrap to a temp file
  const os = await import('os');
  const tmpDir = os.tmpdir();
  const bootstrapPath = path.join(
    tmpDir,
    `wundr-plugin-worker-${params.manifest.name.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.cjs`,
  );
  await fs.writeFile(bootstrapPath, bootstrapCode, 'utf-8');

  const worker = new Worker(bootstrapPath, {
    execArgv: ['--no-addons'],
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
    { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();

  // Wait for the worker to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Worker for plugin "${params.manifest.name}" failed to start within timeout`));
    }, 10_000);

    const onMessage = (msg: any) => {
      if (msg.type === 'ready') {
        clearTimeout(timeout);
        worker.off('message', onMessage);
        resolve();
      }
    };
    worker.on('message', onMessage);
    worker.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  worker.on('message', (msg: any) => {
    if (msg.type === 'result' || msg.type === 'error') {
      const pending = pendingCalls.get(msg.id);
      if (!pending) return;
      pendingCalls.delete(msg.id);
      clearTimeout(pending.timer);
      if (msg.type === 'result') {
        pending.resolve(msg.value);
      } else {
        pending.reject(new Error(msg.message));
      }
    }
  });

  worker.on('exit', (code) => {
    alive = false;
    // Reject all pending calls
    for (const [id, pending] of pendingCalls) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`Worker exited with code ${code}`));
    }
    pendingCalls.clear();
    // Clean up temp file
    fs.unlink(bootstrapPath).catch(() => {});
  });

  return {
    name: params.manifest.name,
    tier: 'worker',
    permissionGuard: guard,

    async call(method: string, ...args: unknown[]): Promise<unknown> {
      if (!alive) throw new Error(`Plugin "${params.manifest.name}" worker is terminated`);

      const id = ++callId;
      return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingCalls.delete(id);
          reject(new Error(`Call to "${method}" timed out after ${params.config.callTimeoutMs}ms`));
        }, params.config.callTimeoutMs);

        pendingCalls.set(id, { resolve, reject, timer });
        worker.postMessage({ type: 'call', id, method, args });
      });
    },

    async destroy(): Promise<void> {
      if (!alive) return;
      alive = false;
      worker.postMessage({ type: 'shutdown' });
      // Give the worker a chance to exit gracefully
      await new Promise<void>((resolve) => {
        const forceKill = setTimeout(() => {
          worker.terminate();
          resolve();
        }, 5_000);
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
 */
async function createDockerHandle(params: {
  manifest: PluginManifest;
  pluginDir: string;
  config: SandboxConfig;
  logger: Logger;
}): Promise<PluginHandle> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  const guard = createPermissionGuard({
    manifest: params.manifest,
    pluginRoot: params.pluginDir,
  });

  const containerName = `${params.config.dockerContainerPrefix}${params.manifest.name.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;

  // Build docker create args (modeled on OpenClaw's buildSandboxCreateArgs)
  const createArgs = [
    'create',
    '--name', containerName,
    '--label', 'wundr.plugin=1',
    '--label', `wundr.plugin.name=${params.manifest.name}`,
    '--read-only',
    '--tmpfs', '/tmp',
    '--tmpfs', '/var/tmp',
    '--network', params.config.dockerNetwork,
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--pids-limit', String(params.config.dockerPidLimit),
    '--memory', params.config.dockerMemoryLimit,
    '--cpus', String(params.config.dockerCpuLimit),
    '-v', `${path.resolve(params.pluginDir)}:/plugin:ro`,
    '--workdir', '/plugin',
    params.config.dockerImage,
    'sleep', 'infinity',
  ];

  // Create and start the container
  await execFileAsync('docker', createArgs);
  await execFileAsync('docker', ['start', containerName]);

  // Install node in the container if not already present, then verify
  try {
    await execFileAsync('docker', ['exec', containerName, 'node', '--version']);
  } catch {
    params.logger.warn(`Node.js not found in Docker image ${params.config.dockerImage}. Plugin calls may fail.`);
  }

  let alive = true;

  return {
    name: params.manifest.name,
    tier: 'docker',
    permissionGuard: guard,

    async call(method: string, ...args: unknown[]): Promise<unknown> {
      if (!alive) throw new Error(`Plugin "${params.manifest.name}" container is stopped`);

      // Execute the plugin method inside the container via a one-shot node command
      const invokeScript = `
        const m = require('./${params.manifest.entryPoint}');
        const p = m.default || m;
        const fn = p['${method}'];
        if (typeof fn !== 'function') { process.stderr.write('Method not found'); process.exit(1); }
        Promise.resolve(fn.apply(p, ${JSON.stringify(args)}))
          .then(r => { process.stdout.write(JSON.stringify({ ok: true, value: r })); })
          .catch(e => { process.stdout.write(JSON.stringify({ ok: false, error: e.message })); });
      `;

      const { stdout, stderr } = await execFileAsync(
        'docker',
        ['exec', containerName, 'node', '-e', invokeScript],
        { timeout: params.config.callTimeoutMs },
      );

      if (stderr && stderr.trim()) {
        params.logger.warn(`[plugin:${params.manifest.name}:docker:stderr] ${stderr.trim()}`);
      }

      try {
        const result = JSON.parse(stdout);
        if (result.ok) return result.value;
        throw new Error(result.error || 'Unknown plugin error');
      } catch (parseErr) {
        if (parseErr instanceof SyntaxError) {
          throw new Error(`Invalid response from plugin container: ${stdout.slice(0, 200)}`);
        }
        throw parseErr;
      }
    },

    async destroy(): Promise<void> {
      if (!alive) return;
      alive = false;
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

// ---------------------------------------------------------------------------
// Tier 0: No Sandbox (Trusted Plugins)
// ---------------------------------------------------------------------------

async function createInProcessHandle(params: {
  manifest: PluginManifest;
  pluginDir: string;
  logger: Logger;
}): Promise<PluginHandle> {
  const guard = createPermissionGuard({
    manifest: params.manifest,
    pluginRoot: params.pluginDir,
  });

  const entryPath = path.join(params.pluginDir, params.manifest.entryPoint);
  const pluginModule = require(entryPath);
  const plugin = pluginModule.default ?? pluginModule;

  let alive = true;

  return {
    name: params.manifest.name,
    tier: 'none',
    permissionGuard: guard,

    async call(method: string, ...args: unknown[]): Promise<unknown> {
      if (!alive) throw new Error(`Plugin "${params.manifest.name}" is unloaded`);
      const fn = (plugin as any)[method];
      if (typeof fn !== 'function') {
        throw new Error(`Plugin "${params.manifest.name}" has no method "${method}"`);
      }
      return await fn.apply(plugin, args);
    },

    async destroy(): Promise<void> {
      alive = false;
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
}): Promise<PluginHandle> {
  const config: SandboxConfig = { ...DEFAULT_SANDBOX_CONFIG, ...params.config };
  const logger = params.logger ?? new Logger('PluginSandbox');
  const tier = params.tierOverride ?? tierForTrustLevel(params.manifest.trustLevel);

  logger.info(
    `Creating sandbox for plugin "${params.manifest.name}" (trust=${params.manifest.trustLevel}, tier=${tier})`,
  );

  switch (tier) {
    case 'none':
      return createInProcessHandle({
        manifest: params.manifest,
        pluginDir: params.pluginDir,
        logger,
      });

    case 'vm':
      return createVmHandle({
        manifest: params.manifest,
        pluginDir: params.pluginDir,
        config,
        logger,
      });

    case 'worker':
      return createWorkerHandle({
        manifest: params.manifest,
        pluginDir: params.pluginDir,
        config,
        logger,
      });

    case 'docker':
      return createDockerHandle({
        manifest: params.manifest,
        pluginDir: params.pluginDir,
        config,
        logger,
      });

    default:
      throw new Error(`Unknown sandbox tier: ${tier}`);
  }
}

/**
 * Destroy all handles in a collection (convenience for shutdown).
 */
export async function destroyAllHandles(handles: PluginHandle[]): Promise<void> {
  await Promise.allSettled(handles.map(h => h.destroy()));
}
