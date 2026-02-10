/**
 * Plugin Lifecycle Management
 *
 * Orchestrates the full lifecycle of a plugin through a strict state machine:
 *
 *   uninstalled -> installed -> validated -> loaded -> active
 *                                 |                     |
 *                            quarantined           disabled -> unloaded -> uninstalled
 *
 * Also handles:
 *   - Dependency resolution with topological sorting and cycle detection.
 *   - Safe plugin updates with rollback on failure.
 *   - Cascading disable/unload when a dependency is removed.
 *   - Metrics emission for monitoring integration.
 *   - Hot-reload support (unload, reload without daemon restart).
 *   - Plugin signature verification.
 *   - IPC bus integration for inter-plugin communication.
 *   - Graceful shutdown with configurable timeout.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { PluginIpcBus } from './plugin-ipc';
import {
  type PluginManifest,
  type SystemPluginPolicy,
  DEFAULT_SYSTEM_POLICY,
  loadManifest,
  verifyPluginIntegrity,
} from './plugin-manifest';
import { type ScanSummary, scanPluginDirectory, formatScanReport } from './plugin-scanner';
import {
  type SignatureVerificationResult,
  TrustedKeyStore,
} from './plugin-signature';
import {
  type PluginHandle,
  type SandboxConfig,
  createSandboxedPlugin,
  destroyAllHandles,
  getMetricsRegistry,
} from './sandbox';
import { Logger } from '../utils/logger';

import type { PluginMetricsSnapshot } from './sandbox-metrics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PluginState =
  | 'uninstalled'
  | 'installed'
  | 'validated'
  | 'quarantined'
  | 'loaded'
  | 'active'
  | 'disabled'
  | 'unloaded';

export type PluginEntry = {
  name: string;
  state: PluginState;
  pluginDir: string;
  manifest?: PluginManifest;
  scanSummary?: ScanSummary;
  signatureResult?: SignatureVerificationResult;
  handle?: PluginHandle;
  error?: string;
  loadedAt?: number;
  disabledAt?: number;
  reloadCount: number;
};

export type LifecycleEvent = {
  type:
    | 'state_change'
    | 'scan_complete'
    | 'load_complete'
    | 'permission_violation'
    | 'update_started'
    | 'update_complete'
    | 'update_rollback'
    | 'hot_reload'
    | 'signature_verified'
    | 'crash_detected'
    | 'shutdown_started'
    | 'shutdown_complete';
  pluginName: string;
  details: Record<string, unknown>;
  timestamp: number;
};

export type LifecycleEventListener = (event: LifecycleEvent) => void;

export type PluginLifecycleConfig = {
  pluginsDir: string;
  systemPolicy: SystemPluginPolicy;
  sandboxConfig: Partial<SandboxConfig>;
  /** Maximum time to wait for a plugin health check (ms). */
  healthCheckTimeoutMs: number;
  /** Maximum time to wait for shutdown to complete (ms). */
  shutdownTimeoutMs: number;
  /** Whether to verify plugin signatures. */
  verifySignatures: boolean;
  /** Maximum number of automatic restarts for a crashed plugin. */
  maxAutoRestarts: number;
  /** Delay before auto-restart (ms). */
  autoRestartDelayMs: number;
};

const DEFAULT_LIFECYCLE_CONFIG: PluginLifecycleConfig = {
  pluginsDir: '.wundr/plugins',
  systemPolicy: DEFAULT_SYSTEM_POLICY,
  sandboxConfig: {},
  healthCheckTimeoutMs: 10_000,
  shutdownTimeoutMs: 30_000,
  verifySignatures: false,
  maxAutoRestarts: 3,
  autoRestartDelayMs: 2_000,
};

// ---------------------------------------------------------------------------
// Dependency Graph
// ---------------------------------------------------------------------------

type DepGraph = Map<string, Set<string>>;

/**
 * Build a dependency graph from all installed plugin manifests.
 */
function buildDependencyGraph(entries: Map<string, PluginEntry>): DepGraph {
  const graph: DepGraph = new Map();
  for (const [name, entry] of entries) {
    const deps = new Set(entry.manifest?.dependencies.plugins ?? []);
    graph.set(name, deps);
  }
  return graph;
}

/**
 * Detect cycles in the dependency graph using DFS.
 * Returns the first cycle found as an array of names, or null if no cycles.
 */
function detectCycle(graph: DepGraph): string[] | null {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const parentMap = new Map<string, string>();

  for (const node of graph.keys()) {
    if (visited.has(node)) {
continue;
}

    const stack = [node];
    while (stack.length > 0) {
      const current = stack[stack.length - 1]!;

      if (!visited.has(current)) {
        visited.add(current);
        inStack.add(current);
      }

      const deps = graph.get(current) ?? new Set();
      let pushed = false;

      for (const dep of deps) {
        if (!visited.has(dep)) {
          parentMap.set(dep, current);
          stack.push(dep);
          pushed = true;
          break;
        } else if (inStack.has(dep)) {
          // Cycle detected -- reconstruct
          const cycle = [dep];
          let curr = current;
          while (curr !== dep) {
            cycle.push(curr);
            curr = parentMap.get(curr) ?? dep;
          }
          cycle.push(dep);
          return cycle.reverse();
        }
      }

      if (!pushed) {
        inStack.delete(current);
        stack.pop();
      }
    }
  }

  return null;
}

/**
 * Topological sort of the dependency graph (Kahn's algorithm).
 * Returns plugins in load order (dependencies first).
 * Throws if the graph has cycles.
 */
function topologicalSort(graph: DepGraph): string[] {
  // Queue starts with nodes that have no dependencies (or whose
  // deps are outside the graph)
  const queue: string[] = [];
  for (const [name] of graph) {
    const deps = graph.get(name) ?? new Set();
    let effectiveDeps = 0;
    for (const dep of deps) {
      if (graph.has(dep)) {
effectiveDeps++;
}
    }
    if (effectiveDeps === 0) {
      queue.push(name);
    }
  }

  const sorted: string[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
continue;
}
    visited.add(current);
    sorted.push(current);

    // Find dependants of current (plugins that depend ON current)
    for (const [name, deps] of graph) {
      if (visited.has(name)) {
continue;
}
      if (!deps.has(current)) {
continue;
}

      // Check if all deps of `name` are now visited
      let allDepsReady = true;
      for (const dep of deps) {
        if (graph.has(dep) && !visited.has(dep)) {
          allDepsReady = false;
          break;
        }
      }
      if (allDepsReady) {
        queue.push(name);
      }
    }
  }

  return sorted;
}

/**
 * Find all plugins that depend on a given plugin (direct and transitive).
 */
function findDependants(graph: DepGraph, pluginName: string): Set<string> {
  const dependants = new Set<string>();
  const stack = [pluginName];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const [name, deps] of graph) {
      if (deps.has(current) && !dependants.has(name)) {
        dependants.add(name);
        stack.push(name);
      }
    }
  }

  return dependants;
}

// ---------------------------------------------------------------------------
// Plugin Lifecycle Manager
// ---------------------------------------------------------------------------

export class PluginLifecycleManager {
  private plugins: Map<string, PluginEntry> = new Map();
  private config: PluginLifecycleConfig;
  private logger: Logger;
  private eventListeners: LifecycleEventListener[] = [];
  private ipcBus: PluginIpcBus;
  private keyStore: TrustedKeyStore;
  private autoRestartCounts = new Map<string, number>();
  private shutdownInProgress = false;

  constructor(config?: Partial<PluginLifecycleConfig>) {
    this.config = { ...DEFAULT_LIFECYCLE_CONFIG, ...config };
    this.logger = new Logger('PluginLifecycle');
    this.ipcBus = new PluginIpcBus();
    this.keyStore = new TrustedKeyStore();
  }

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  /**
   * Get the IPC bus for inter-plugin communication.
   */
  getIpcBus(): PluginIpcBus {
    return this.ipcBus;
  }

  /**
   * Get the trusted key store for signature verification.
   */
  getKeyStore(): TrustedKeyStore {
    return this.keyStore;
  }

  // -----------------------------------------------------------------------
  // Event System
  // -----------------------------------------------------------------------

  onEvent(listener: LifecycleEventListener): void {
    this.eventListeners.push(listener);
  }

  private emit(event: Omit<LifecycleEvent, 'timestamp'>): void {
    const fullEvent: LifecycleEvent = { ...event, timestamp: Date.now() };
    for (const listener of this.eventListeners) {
      try {
        listener(fullEvent);
      } catch {
        // Event listeners must not break lifecycle operations
      }
    }
  }

  private setState(entry: PluginEntry, newState: PluginState): void {
    const oldState = entry.state;
    entry.state = newState;
    this.emit({
      type: 'state_change',
      pluginName: entry.name,
      details: { from: oldState, to: newState },
    });
    this.logger.info(`Plugin "${entry.name}": ${oldState} -> ${newState}`);
  }

  // -----------------------------------------------------------------------
  // Install
  // -----------------------------------------------------------------------

  /**
   * Register a plugin directory as installed.
   */
  async install(pluginDir: string): Promise<PluginEntry> {
    const absoluteDir = path.resolve(pluginDir);

    // Validate manifest
    const result = await loadManifest(absoluteDir, this.config.systemPolicy);
    if (!result.valid || !result.manifest) {
      const errorMsg = result.errors.map(e => `${e.path}: ${e.message}`).join('; ');
      const entry: PluginEntry = {
        name: path.basename(absoluteDir),
        state: 'uninstalled',
        pluginDir: absoluteDir,
        error: `Manifest validation failed: ${errorMsg}`,
        reloadCount: 0,
      };
      return entry;
    }

    for (const warning of result.warnings) {
      this.logger.warn(`Plugin "${result.manifest.name}": ${warning}`);
    }

    const entry: PluginEntry = {
      name: result.manifest.name,
      state: 'installed',
      pluginDir: absoluteDir,
      manifest: result.manifest,
      reloadCount: 0,
    };
    this.plugins.set(entry.name, entry);
    this.setState(entry, 'installed');

    return entry;
  }

  // -----------------------------------------------------------------------
  // Validate (Scan + Integrity + Signature)
  // -----------------------------------------------------------------------

  /**
   * Run static analysis, integrity checks, and optional signature
   * verification on an installed plugin.
   */
  async validate(pluginName: string): Promise<ScanSummary> {
    const entry = this.plugins.get(pluginName);
    if (!entry) {
throw new Error(`Plugin "${pluginName}" is not installed`);
}
    if (entry.state !== 'installed') {
      throw new Error(`Plugin "${pluginName}" must be in "installed" state to validate (current: ${entry.state})`);
    }
    if (!entry.manifest) {
      throw new Error(`Plugin "${pluginName}" has no manifest`);
    }

    // Integrity check
    const integrityResult = await verifyPluginIntegrity(entry.pluginDir, entry.manifest);
    if (!integrityResult.valid) {
      const errorMsg = `Integrity check failed: expected ${integrityResult.expected}, got ${integrityResult.actual}`;
      entry.error = errorMsg;
      this.setState(entry, 'quarantined');
      return {
        scannedFiles: 0,
        critical: 1,
        warn: 0,
        info: 0,
        findings: [{
          ruleId: 'integrity-mismatch',
          severity: 'critical',
          file: entry.manifest.entryPoint,
          line: 0,
          message: errorMsg,
          evidence: `Expected: ${integrityResult.expected ?? 'none'}`,
        }],
        passed: false,
      };
    }

    // Signature verification (if enabled)
    if (this.config.verifySignatures) {
      const sigResult = await this.keyStore.verifyPlugin(entry.pluginDir, this.logger);
      entry.signatureResult = sigResult;

      this.emit({
        type: 'signature_verified',
        pluginName,
        details: {
          valid: sigResult.valid,
          trusted: sigResult.trusted,
          reason: sigResult.reason,
        },
      });

      if (!sigResult.valid && entry.manifest.trustLevel === 'verified') {
        // Downgrade trust level if signature is invalid for a "verified" plugin
        this.logger.warn(
          `Plugin "${pluginName}" claims verified trust but signature check failed: ${sigResult.reason}. Downgrading to community.`,
        );
        entry.manifest.trustLevel = 'community';
      }
    }

    // Static analysis scan
    const summary = await scanPluginDirectory(entry.pluginDir, {
      manifest: entry.manifest,
    });
    entry.scanSummary = summary;

    this.emit({
      type: 'scan_complete',
      pluginName,
      details: {
        scannedFiles: summary.scannedFiles,
        critical: summary.critical,
        warn: summary.warn,
        passed: summary.passed,
      },
    });

    if (summary.passed) {
      this.setState(entry, 'validated');
    } else {
      entry.error = `Scan failed: ${summary.critical} critical, ${summary.warn} warnings`;
      this.setState(entry, 'quarantined');
      this.logger.error(`Plugin "${pluginName}" quarantined:\n${formatScanReport(summary)}`);
    }

    return summary;
  }

  // -----------------------------------------------------------------------
  // Load
  // -----------------------------------------------------------------------

  /**
   * Load a validated plugin into a sandbox.
   */
  async load(pluginName: string): Promise<PluginHandle> {
    const entry = this.plugins.get(pluginName);
    if (!entry) {
throw new Error(`Plugin "${pluginName}" is not installed`);
}
    if (entry.state !== 'validated' && entry.state !== 'disabled') {
      throw new Error(
        `Plugin "${pluginName}" must be in "validated" or "disabled" state to load (current: ${entry.state})`,
      );
    }
    if (!entry.manifest) {
throw new Error(`Plugin "${pluginName}" has no manifest`);
}

    // Check dependencies are active
    const depGraph = buildDependencyGraph(this.plugins);
    const deps = depGraph.get(pluginName) ?? new Set();
    for (const dep of deps) {
      const depEntry = this.plugins.get(dep);
      if (!depEntry || depEntry.state !== 'active') {
        throw new Error(
          `Plugin "${pluginName}" depends on "${dep}" which is not active (state: ${depEntry?.state ?? 'not installed'})`,
        );
      }
    }

    // Create sandbox with IPC bus integration
    const handle = await createSandboxedPlugin({
      manifest: entry.manifest,
      pluginDir: entry.pluginDir,
      config: this.config.sandboxConfig,
      logger: this.logger,
      ipcBus: this.ipcBus,
    });

    entry.handle = handle;
    entry.loadedAt = Date.now();
    this.setState(entry, 'loaded');

    this.emit({
      type: 'load_complete',
      pluginName,
      details: { tier: handle.tier },
    });

    return handle;
  }

  // -----------------------------------------------------------------------
  // Activate
  // -----------------------------------------------------------------------

  /**
   * Activate a loaded plugin (calls its activate method).
   */
  async activate(pluginName: string): Promise<void> {
    const entry = this.plugins.get(pluginName);
    if (!entry) {
throw new Error(`Plugin "${pluginName}" is not installed`);
}
    if (entry.state !== 'loaded') {
      throw new Error(`Plugin "${pluginName}" must be in "loaded" state to activate (current: ${entry.state})`);
    }
    if (!entry.handle) {
throw new Error(`Plugin "${pluginName}" has no handle`);
}

    try {
      await entry.handle.call('activate', {
        name: entry.name,
        version: entry.manifest?.version,
      });
    } catch (err) {
      // Activation failure: Plugin provided an activate method that threw.
      // We still consider the plugin "loaded" (not active).
      this.logger.warn(
        `Plugin "${pluginName}" activation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }

    this.setState(entry, 'active');
  }

  // -----------------------------------------------------------------------
  // Disable
  // -----------------------------------------------------------------------

  /**
   * Disable an active plugin (and cascade to dependants).
   */
  async disable(pluginName: string): Promise<string[]> {
    const entry = this.plugins.get(pluginName);
    if (!entry) {
throw new Error(`Plugin "${pluginName}" is not installed`);
}
    if (entry.state !== 'active' && entry.state !== 'loaded') {
      throw new Error(`Plugin "${pluginName}" must be "active" or "loaded" to disable (current: ${entry.state})`);
    }

    // Cascade disable to dependants
    const depGraph = buildDependencyGraph(this.plugins);
    const dependants = findDependants(depGraph, pluginName);
    const cascaded: string[] = [];

    // Disable dependants first (reverse dependency order)
    for (const depName of dependants) {
      const depEntry = this.plugins.get(depName);
      if (depEntry && (depEntry.state === 'active' || depEntry.state === 'loaded')) {
        await this.disableSingle(depName);
        cascaded.push(depName);
      }
    }

    await this.disableSingle(pluginName);

    return cascaded;
  }

  private async disableSingle(pluginName: string): Promise<void> {
    const entry = this.plugins.get(pluginName);
    if (!entry) {
return;
}

    if (entry.handle) {
      try {
        await entry.handle.call('deactivate');
      } catch {
        // Best effort
      }
      await entry.handle.destroy();
      entry.handle = undefined;
    }

    entry.disabledAt = Date.now();
    this.setState(entry, 'disabled');
  }

  // -----------------------------------------------------------------------
  // Unload
  // -----------------------------------------------------------------------

  /**
   * Unload a disabled plugin (release all resources).
   */
  async unload(pluginName: string): Promise<void> {
    const entry = this.plugins.get(pluginName);
    if (!entry) {
throw new Error(`Plugin "${pluginName}" is not installed`);
}
    if (entry.state !== 'disabled') {
      throw new Error(`Plugin "${pluginName}" must be "disabled" to unload (current: ${entry.state})`);
    }

    if (entry.handle) {
      await entry.handle.destroy();
      entry.handle = undefined;
    }

    this.setState(entry, 'unloaded');
  }

  // -----------------------------------------------------------------------
  // Uninstall
  // -----------------------------------------------------------------------

  /**
   * Remove a plugin entirely.
   */
  async uninstall(pluginName: string): Promise<void> {
    const entry = this.plugins.get(pluginName);
    if (!entry) {
return;
}

    // Must be unloaded or never loaded
    if (entry.state === 'active' || entry.state === 'loaded') {
      await this.disable(pluginName);
      await this.unload(pluginName);
    } else if (entry.state === 'disabled') {
      await this.unload(pluginName);
    }

    // Clean up IPC subscriptions
    this.ipcBus.unsubscribeAll(pluginName);

    // Clean up metrics
    getMetricsRegistry().remove(pluginName);

    this.setState(entry, 'uninstalled');
    this.plugins.delete(pluginName);
  }

  // -----------------------------------------------------------------------
  // Hot Reload
  // -----------------------------------------------------------------------

  /**
   * Hot-reload a plugin: disable -> unload -> re-validate -> load -> activate.
   * This supports live plugin updates without restarting the daemon.
   *
   * Returns information about the reload outcome.
   */
  async hotReload(pluginName: string): Promise<{
    success: boolean;
    previousState: PluginState;
    error?: string;
  }> {
    const entry = this.plugins.get(pluginName);
    if (!entry) {
      return { success: false, previousState: 'uninstalled', error: 'Plugin not installed' };
    }

    const previousState = entry.state;

    this.emit({
      type: 'hot_reload',
      pluginName,
      details: { phase: 'start', previousState },
    });

    try {
      // Phase 1: Teardown
      if (entry.state === 'active' || entry.state === 'loaded') {
        await this.disable(pluginName);
      }
      if (entry.state === 'disabled') {
        await this.unload(pluginName);
      }

      // Phase 2: Reset to installed state for re-validation
      this.setState(entry, 'installed');

      // Phase 3: Re-validate (re-reads manifest, re-scans)
      const summary = await this.validate(pluginName);
      if (!summary.passed) {
        const error = `Re-validation failed after hot reload: ${summary.critical} critical findings`;
        this.emit({
          type: 'hot_reload',
          pluginName,
          details: { phase: 'failed', error },
        });
        return { success: false, previousState, error };
      }

      // Phase 4: Re-load and activate if previously active
      if (previousState === 'active' || previousState === 'loaded') {
        await this.load(pluginName);
        if (previousState === 'active') {
          await this.activate(pluginName);
        }
      }

      entry.reloadCount++;

      this.emit({
        type: 'hot_reload',
        pluginName,
        details: {
          phase: 'complete',
          reloadCount: entry.reloadCount,
          newState: entry.state,
        },
      });

      return { success: true, previousState };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);

      this.emit({
        type: 'hot_reload',
        pluginName,
        details: { phase: 'failed', error },
      });

      return { success: false, previousState, error };
    }
  }

  // -----------------------------------------------------------------------
  // Full Lifecycle: Install -> Validate -> Load -> Activate
  // -----------------------------------------------------------------------

  /**
   * Perform the full lifecycle from installation through activation.
   * Returns the plugin handle if successful.
   */
  async installAndActivate(pluginDir: string): Promise<PluginHandle> {
    const entry = await this.install(pluginDir);
    if (entry.state !== 'installed') {
      throw new Error(`Plugin installation failed: ${entry.error}`);
    }

    const summary = await this.validate(entry.name);
    if (!summary.passed) {
      throw new Error(`Plugin scan failed:\n${formatScanReport(summary)}`);
    }

    const handle = await this.load(entry.name);
    await this.activate(entry.name);

    return handle;
  }

  // -----------------------------------------------------------------------
  // Dependency-Ordered Bulk Load
  // -----------------------------------------------------------------------

  /**
   * Load and activate all installed+validated plugins in dependency order.
   */
  async loadAll(): Promise<{ loaded: string[]; failed: Array<{ name: string; error: string }> }> {
    const depGraph = buildDependencyGraph(this.plugins);

    // Check for cycles
    const cycle = detectCycle(depGraph);
    if (cycle) {
      throw new Error(`Circular plugin dependency detected: ${cycle.join(' -> ')}`);
    }

    const loadOrder = topologicalSort(depGraph);
    const loaded: string[] = [];
    const failed: Array<{ name: string; error: string }> = [];

    for (const name of loadOrder) {
      const entry = this.plugins.get(name);
      if (!entry) {
continue;
}
      if (entry.state !== 'validated' && entry.state !== 'disabled') {
continue;
}

      try {
        await this.load(name);
        await this.activate(name);
        loaded.push(name);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        failed.push({ name, error: errorMsg });
        this.logger.error(`Failed to load plugin "${name}": ${errorMsg}`);
      }
    }

    return { loaded, failed };
  }

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------

  /**
   * Update a plugin to a new version from a staging directory.
   *
   * Steps:
   * 1. Validate the new version.
   * 2. Detect permission escalations.
   * 3. Snapshot the current version.
   * 4. Disable the old version.
   * 5. Replace with new version.
   * 6. Load and activate.
   * 7. Rollback on failure.
   */
  async update(
    pluginName: string,
    newPluginDir: string,
  ): Promise<{ success: boolean; permissionChanges: string[]; error?: string }> {
    const entry = this.plugins.get(pluginName);
    if (!entry) {
throw new Error(`Plugin "${pluginName}" is not installed`);
}
    if (!entry.manifest) {
throw new Error(`Plugin "${pluginName}" has no manifest`);
}

    this.emit({
      type: 'update_started',
      pluginName,
      details: { newDir: newPluginDir },
    });

    // Step 1: Validate new version
    const newManifestResult = await loadManifest(
      path.resolve(newPluginDir),
      this.config.systemPolicy,
    );
    if (!newManifestResult.valid || !newManifestResult.manifest) {
      return {
        success: false,
        permissionChanges: [],
        error: `New version manifest validation failed: ${newManifestResult.errors.map(e => e.message).join('; ')}`,
      };
    }

    const newScan = await scanPluginDirectory(path.resolve(newPluginDir), {
      manifest: newManifestResult.manifest,
    });
    if (!newScan.passed) {
      return {
        success: false,
        permissionChanges: [],
        error: `New version scan failed:\n${formatScanReport(newScan)}`,
      };
    }

    // Step 2: Detect permission escalations
    const permissionChanges = detectPermissionChanges(
      entry.manifest.permissions,
      newManifestResult.manifest.permissions,
    );

    // Step 3: Snapshot current directory name for rollback
    const snapshotDir = `${entry.pluginDir}.wundr-backup-${Date.now()}`;
    try {
      await fs.cp(entry.pluginDir, snapshotDir, { recursive: true });
    } catch (err) {
      return {
        success: false,
        permissionChanges,
        error: `Failed to create backup: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Step 4: Disable old version
    const wasActive = entry.state === 'active' || entry.state === 'loaded';
    if (wasActive) {
      try {
        await this.disable(pluginName);
        await this.unload(pluginName);
      } catch {
        // Continue with update
      }
    }

    // Step 5: Replace plugin directory
    try {
      await fs.rm(entry.pluginDir, { recursive: true, force: true });
      await fs.cp(path.resolve(newPluginDir), entry.pluginDir, { recursive: true });
    } catch (err) {
      // Rollback
      await this.rollback(entry, snapshotDir);
      return {
        success: false,
        permissionChanges,
        error: `Failed to replace plugin: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Step 6: Reinstall, validate, load, activate
    try {
      // Re-read manifest from updated directory
      entry.manifest = newManifestResult.manifest;
      entry.scanSummary = newScan;
      this.setState(entry, 'validated');

      if (wasActive) {
        await this.load(pluginName);
        await this.activate(pluginName);

        // Health check
        if (entry.handle) {
          try {
            const healthResult = await Promise.race([
              entry.handle.call('healthCheck'),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeoutMs),
              ),
            ]);
            this.logger.info(`Plugin "${pluginName}" health check passed: ${JSON.stringify(healthResult)}`);
          } catch {
            // healthCheck is optional
          }
        }
      }
    } catch (err) {
      // Rollback
      await this.rollback(entry, snapshotDir);
      return {
        success: false,
        permissionChanges,
        error: `Failed to activate new version: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Clean up snapshot
    await fs.rm(snapshotDir, { recursive: true, force: true }).catch(() => {});

    this.emit({
      type: 'update_complete',
      pluginName,
      details: {
        newVersion: newManifestResult.manifest.version,
        permissionChanges,
      },
    });

    return { success: true, permissionChanges };
  }

  private async rollback(entry: PluginEntry, snapshotDir: string): Promise<void> {
    this.logger.warn(`Rolling back plugin "${entry.name}" to previous version`);

    this.emit({
      type: 'update_rollback',
      pluginName: entry.name,
      details: { snapshotDir },
    });

    try {
      await fs.rm(entry.pluginDir, { recursive: true, force: true }).catch(() => {});
      await fs.rename(snapshotDir, entry.pluginDir);

      // Attempt to re-load the old version
      const oldManifest = await loadManifest(entry.pluginDir, this.config.systemPolicy);
      if (oldManifest.valid && oldManifest.manifest) {
        entry.manifest = oldManifest.manifest;
        this.setState(entry, 'validated');
        await this.load(entry.name);
        await this.activate(entry.name);
      }
    } catch (rollbackErr) {
      this.logger.error(
        `Rollback failed for plugin "${entry.name}": ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`,
      );
      this.setState(entry, 'quarantined');
      entry.error = 'Update and rollback both failed';
    }
  }

  // -----------------------------------------------------------------------
  // Query
  // -----------------------------------------------------------------------

  getPlugin(name: string): PluginEntry | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): PluginEntry[] {
    return Array.from(this.plugins.values());
  }

  getActivePlugins(): PluginEntry[] {
    return this.getAllPlugins().filter(p => p.state === 'active');
  }

  getLoadOrder(): string[] {
    const depGraph = buildDependencyGraph(this.plugins);
    const cycle = detectCycle(depGraph);
    if (cycle) {
      throw new Error(`Circular dependency: ${cycle.join(' -> ')}`);
    }
    return topologicalSort(depGraph);
  }

  // -----------------------------------------------------------------------
  // Metrics
  // -----------------------------------------------------------------------

  /**
   * Get metrics snapshots for all loaded plugins.
   */
  getPluginMetrics(): PluginMetricsSnapshot[] {
    return getMetricsRegistry().allSnapshots();
  }

  /**
   * Get metrics for a specific plugin.
   */
  getPluginMetric(pluginName: string): PluginMetricsSnapshot | undefined {
    const metrics = getMetricsRegistry().get(pluginName);
    return metrics?.snapshot();
  }

  // -----------------------------------------------------------------------
  // IPC Diagnostics
  // -----------------------------------------------------------------------

  /**
   * Get IPC bus diagnostics for debugging.
   */
  getIpcDiagnostics(): ReturnType<PluginIpcBus['diagnostics']> {
    return this.ipcBus.diagnostics();
  }

  // -----------------------------------------------------------------------
  // Shutdown
  // -----------------------------------------------------------------------

  /**
   * Gracefully shut down all active plugins with a timeout.
   *
   * Shutdown order is the reverse of load order (dependants shut down first).
   */
  async shutdown(): Promise<void> {
    if (this.shutdownInProgress) {
      this.logger.warn('Shutdown already in progress');
      return;
    }

    this.shutdownInProgress = true;

    this.emit({
      type: 'shutdown_started',
      pluginName: '*',
      details: { timeoutMs: this.config.shutdownTimeoutMs },
    });

    const shutdownPromise = (async () => {
      // Determine reverse load order for orderly shutdown
      try {
        const depGraph = buildDependencyGraph(this.plugins);
        const cycle = detectCycle(depGraph);
        if (!cycle) {
          const order = topologicalSort(depGraph);
          // Shutdown in reverse order (dependants first)
          for (const name of order.reverse()) {
            const entry = this.plugins.get(name);
            if (entry?.handle) {
              try {
                await entry.handle.destroy();
              } catch (err) {
                this.logger.warn(
                  `Error shutting down plugin "${name}": ${
                    err instanceof Error ? err.message : String(err)
                  }`,
                );
              }
              entry.handle = undefined;
              entry.state = 'unloaded';
            }
          }
        } else {
          // If there are cycles, just destroy all handles
          const activeHandles = this.getAllPlugins()
            .filter(p => p.handle)
            .map(p => p.handle!);
          await destroyAllHandles(activeHandles);
        }
      } catch {
        // Fallback: destroy everything
        const activeHandles = this.getAllPlugins()
          .filter(p => p.handle)
          .map(p => p.handle!);
        await destroyAllHandles(activeHandles);
      }
    })();

    // Race shutdown against timeout
    await Promise.race([
      shutdownPromise,
      new Promise<void>((resolve) => {
        setTimeout(() => {
          this.logger.warn(
            `Shutdown timeout (${this.config.shutdownTimeoutMs}ms) reached. Force-killing remaining plugins.`,
          );
          resolve();
        }, this.config.shutdownTimeoutMs);
      }),
    ]);

    // Ensure all handles are cleaned up
    for (const entry of this.plugins.values()) {
      if (entry.state === 'active' || entry.state === 'loaded') {
        if (entry.handle) {
          try {
            await entry.handle.destroy();
          } catch {
            // Already tried gracefully
          }
        }
        entry.state = 'unloaded';
        entry.handle = undefined;
      }
    }

    this.shutdownInProgress = false;

    this.emit({
      type: 'shutdown_complete',
      pluginName: '*',
      details: {},
    });

    this.logger.info('All plugins shut down');
  }
}

// ---------------------------------------------------------------------------
// Permission Change Detection
// ---------------------------------------------------------------------------

type PermissionSet = PluginManifest['permissions'];

function detectPermissionChanges(
  oldPerms: PermissionSet,
  newPerms: PermissionSet,
): string[] {
  const changes: string[] = [];

  // Filesystem read additions
  for (const p of newPerms.filesystem.read) {
    if (!oldPerms.filesystem.read.includes(p)) {
      changes.push(`+filesystem.read: ${p}`);
    }
  }
  // Filesystem write additions
  for (const p of newPerms.filesystem.write) {
    if (!oldPerms.filesystem.write.includes(p)) {
      changes.push(`+filesystem.write: ${p}`);
    }
  }
  // Network host additions
  for (const h of newPerms.network.hosts) {
    if (!oldPerms.network.hosts.includes(h)) {
      changes.push(`+network.host: ${h}`);
    }
  }
  // Network port additions
  for (const p of newPerms.network.ports) {
    if (!oldPerms.network.ports.includes(p)) {
      changes.push(`+network.port: ${p}`);
    }
  }
  // Process additions
  for (const p of newPerms.process.allowed) {
    if (!oldPerms.process.allowed.includes(p)) {
      changes.push(`+process: ${p}`);
    }
  }
  // Env read additions
  for (const e of newPerms.env.read) {
    if (!oldPerms.env.read.includes(e)) {
      changes.push(`+env.read: ${e}`);
    }
  }
  // Env write additions
  for (const e of newPerms.env.write) {
    if (!oldPerms.env.write.includes(e)) {
      changes.push(`+env.write: ${e}`);
    }
  }
  // MCP tool allow additions
  for (const t of newPerms.mcpTools.allow) {
    if (!oldPerms.mcpTools.allow.includes(t)) {
      changes.push(`+mcpTools.allow: ${t}`);
    }
  }
  // MCP tool deny removals (escalation: previously denied, now allowed)
  for (const t of oldPerms.mcpTools.deny) {
    if (!newPerms.mcpTools.deny.includes(t)) {
      changes.push(`-mcpTools.deny: ${t} (escalation: previously denied tool is now allowed)`);
    }
  }

  return changes;
}
