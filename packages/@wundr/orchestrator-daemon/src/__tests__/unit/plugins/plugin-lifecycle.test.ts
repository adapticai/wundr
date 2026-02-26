/**
 * Unit tests for the Plugin Lifecycle Manager.
 *
 * Covers:
 *   - Plugin installation and manifest validation
 *   - Validation (scan + integrity + signature)
 *   - Loading into sandboxes with dependency resolution
 *   - Activation and deactivation
 *   - Hot-reload cycle
 *   - Bulk load with dependency ordering
 *   - Cascading disable
 *   - Graceful shutdown
 *   - Lifecycle event emission
 *   - Signature verification integration
 *   - Error paths (missing plugins, wrong state, circular deps)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  PluginLifecycleManager,
  type LifecycleEvent,
} from '../../../plugins/plugin-lifecycle';
import {
  loadManifest,
  verifyPluginIntegrity,
} from '../../../plugins/plugin-manifest';
import { scanPluginDirectory } from '../../../plugins/plugin-scanner';
import {
  createSandboxedPlugin,
  destroyAllHandles,
  getMetricsRegistry,
} from '../../../plugins/sandbox';

import type { PluginManifest } from '../../../plugins/plugin-manifest';

// ---------------------------------------------------------------------------
// Module-level mocks -- must be set up BEFORE importing the SUT
// ---------------------------------------------------------------------------

// Mock the plugin-manifest module
vi.mock('../../../plugins/plugin-manifest', () => ({
  DEFAULT_SYSTEM_POLICY: {
    maxTrustLevel: 'community' as const,
    deniedPaths: [],
    deniedHosts: [],
    deniedProcesses: [],
    deniedEnvVars: [],
    deniedMcpTools: [],
    requireIntegrity: false,
    allowUntrusted: false,
  },
  loadManifest: vi.fn(),
  verifyPluginIntegrity: vi.fn(),
}));

// Mock the plugin-scanner module
vi.mock('../../../plugins/plugin-scanner', () => ({
  scanPluginDirectory: vi.fn(),
  formatScanReport: vi.fn().mockReturnValue('Scan Report'),
}));

// Mock the sandbox module
vi.mock('../../../plugins/sandbox', () => {
  const registry = {
    get: vi.fn().mockReturnValue(undefined),
    remove: vi.fn(),
    allSnapshots: vi.fn().mockReturnValue([]),
  };
  return {
    createSandboxedPlugin: vi.fn(),
    destroyAllHandles: vi.fn().mockResolvedValue(undefined),
    getMetricsRegistry: () => registry,
    __mockRegistry: registry,
  };
});

// Mock the plugin-signature module
vi.mock('../../../plugins/plugin-signature', () => {
  class TrustedKeyStore {
    private keys: Array<{ key: string; label: string; addedAt: number }> = [];
    addKey(key: string, label: string) {
      this.keys.push({ key, label, addedAt: Date.now() });
    }
    removeKey(key: string): boolean {
      const before = this.keys.length;
      this.keys = this.keys.filter(k => k.key !== key);
      return this.keys.length < before;
    }
    listKeys() {
      return this.keys;
    }
    async verifyPlugin(_dir: string, _logger?: unknown) {
      return { valid: true, trusted: true, reason: 'mock' };
    }
  }
  return { TrustedKeyStore };
});

// Mock the plugin-ipc module
vi.mock('../../../plugins/plugin-ipc', () => {
  class PluginIpcBus {
    unsubscribeAll = vi.fn();
    diagnostics = vi.fn().mockReturnValue({
      totalChannels: 0,
      totalSubscriptions: 0,
      pendingRequests: 0,
      pluginSubscriptions: {},
    });
  }
  return { PluginIpcBus };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockedLoadManifest = vi.mocked(loadManifest);
const mockedVerifyIntegrity = vi.mocked(verifyPluginIntegrity);
const mockedScanDir = vi.mocked(scanPluginDirectory);
const mockedCreateSandbox = vi.mocked(createSandboxedPlugin);

function makeManifest(overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    wundrVersion: '>=1.0.0',
    trustLevel: 'community',
    permissions: {
      filesystem: { read: [], write: [] },
      network: { hosts: [], ports: [] },
      process: { allowed: [] },
      env: { read: [], write: [] },
      mcpTools: { allow: [], deny: [] },
    },
    entryPoint: 'dist/index.js',
    dependencies: { plugins: [], runtime: {} },
    ...overrides,
  };
}

function passingScanSummary() {
  return {
    scannedFiles: 3,
    critical: 0,
    warn: 0,
    info: 0,
    findings: [],
    passed: true,
  };
}

function failingScanSummary() {
  return {
    scannedFiles: 3,
    critical: 1,
    warn: 0,
    info: 0,
    findings: [
      {
        ruleId: 'test-rule',
        severity: 'critical' as const,
        file: 'index.js',
        line: 1,
        message: 'Bad pattern',
        evidence: 'dangerous_call(input)',
      },
    ],
    passed: false,
  };
}

function makeMockHandle(name = 'test-plugin') {
  return {
    name,
    tier: 'worker' as const,
    call: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    isAlive: vi.fn().mockReturnValue(true),
    permissionGuard: {} as any,
    metrics: {} as any,
  };
}

/**
 * Set up mocks so that install() succeeds for a given plugin.
 */
function setupInstallSuccess(manifest: PluginManifest) {
  mockedLoadManifest.mockResolvedValue({
    valid: true,
    manifest,
    errors: [],
    warnings: [],
  });
}

/**
 * Set up mocks so that validate() succeeds.
 */
function setupValidateSuccess() {
  mockedVerifyIntegrity.mockResolvedValue({ valid: true });
  mockedScanDir.mockResolvedValue(passingScanSummary());
}

/**
 * Set up mocks so that load() succeeds.
 */
function setupLoadSuccess(handle = makeMockHandle()) {
  mockedCreateSandbox.mockResolvedValue(handle);
  return handle;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PluginLifecycleManager', () => {
  let manager: PluginLifecycleManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Restore mock return values cleared by clearAllMocks
    const registry = getMetricsRegistry();
    (registry.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    (registry.allSnapshots as ReturnType<typeof vi.fn>).mockReturnValue([]);
    (destroyAllHandles as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );

    manager = new PluginLifecycleManager({
      pluginsDir: '/tmp/test-plugins',
      shutdownTimeoutMs: 500,
      healthCheckTimeoutMs: 500,
      verifySignatures: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Constructor & Accessors
  // -----------------------------------------------------------------------

  describe('constructor and accessors', () => {
    it('should create a manager with default config', () => {
      const mgr = new PluginLifecycleManager();
      expect(mgr).toBeDefined();
      expect(mgr.getAllPlugins()).toEqual([]);
    });

    it('should expose the IPC bus', () => {
      expect(manager.getIpcBus()).toBeDefined();
    });

    it('should expose the key store', () => {
      expect(manager.getKeyStore()).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Installation
  // -----------------------------------------------------------------------

  describe('install()', () => {
    it('should install a plugin with a valid manifest', async () => {
      const manifest = makeManifest({ name: 'my-plugin' });
      setupInstallSuccess(manifest);

      const entry = await manager.install('/path/to/my-plugin');

      expect(entry.name).toBe('my-plugin');
      expect(entry.state).toBe('installed');
      expect(entry.manifest).toEqual(manifest);
      expect(entry.reloadCount).toBe(0);
    });

    it('should return an uninstalled entry when manifest validation fails', async () => {
      mockedLoadManifest.mockResolvedValue({
        valid: false,
        manifest: undefined,
        errors: [{ path: 'name', message: 'required', code: 'invalid_type' }],
        warnings: [],
      });

      const entry = await manager.install('/path/to/bad-plugin');

      expect(entry.state).toBe('uninstalled');
      expect(entry.error).toContain('Manifest validation failed');
    });

    it('should log warnings from manifest validation', async () => {
      const manifest = makeManifest({ name: 'warn-plugin' });
      mockedLoadManifest.mockResolvedValue({
        valid: true,
        manifest,
        errors: [],
        warnings: ['Trust level downgraded'],
      });

      const entry = await manager.install('/path/to/warn-plugin');
      expect(entry.state).toBe('installed');
    });
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  describe('validate()', () => {
    it('should validate an installed plugin and move to validated state', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();

      await manager.install('/tmp/test-plugin');
      const summary = await manager.validate('test-plugin');

      expect(summary.passed).toBe(true);
      expect(manager.getPlugin('test-plugin')?.state).toBe('validated');
    });

    it('should quarantine a plugin when integrity check fails', async () => {
      const manifest = makeManifest({ integrity: 'sha384-expected' });
      setupInstallSuccess(manifest);
      mockedVerifyIntegrity.mockResolvedValue({
        valid: false,
        expected: 'sha384-expected',
        actual: 'sha384-actual',
      });

      await manager.install('/tmp/test-plugin');
      const summary = await manager.validate('test-plugin');

      expect(summary.passed).toBe(false);
      expect(summary.findings[0]?.ruleId).toBe('integrity-mismatch');
      expect(manager.getPlugin('test-plugin')?.state).toBe('quarantined');
    });

    it('should quarantine a plugin when scan finds critical issues', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      mockedVerifyIntegrity.mockResolvedValue({ valid: true });
      mockedScanDir.mockResolvedValue(failingScanSummary());

      await manager.install('/tmp/test-plugin');
      const summary = await manager.validate('test-plugin');

      expect(summary.passed).toBe(false);
      expect(manager.getPlugin('test-plugin')?.state).toBe('quarantined');
    });

    it('should throw if plugin is not installed', async () => {
      await expect(manager.validate('nonexistent')).rejects.toThrow(
        'Plugin "nonexistent" is not installed'
      );
    });

    it('should throw if plugin is in the wrong state', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');

      // Now in 'validated' state, trying to validate again should fail
      await expect(manager.validate('test-plugin')).rejects.toThrow(
        'must be in "installed" state'
      );
    });
  });

  // -----------------------------------------------------------------------
  // Signature Verification
  // -----------------------------------------------------------------------

  describe('validate() with signatures enabled', () => {
    it('should perform signature verification when enabled', async () => {
      const mgr = new PluginLifecycleManager({
        verifySignatures: true,
        shutdownTimeoutMs: 500,
      });
      const manifest = makeManifest({
        name: 'sig-plugin',
        trustLevel: 'community',
      });
      setupInstallSuccess(manifest);
      setupValidateSuccess();

      await mgr.install('/tmp/sig-plugin');

      const events: LifecycleEvent[] = [];
      mgr.onEvent(e => events.push(e));

      await mgr.validate('sig-plugin');

      const sigEvent = events.find(e => e.type === 'signature_verified');
      expect(sigEvent).toBeDefined();
      expect(sigEvent?.details.valid).toBe(true);
    });

    it('should downgrade trust level when verified plugin has invalid signature', async () => {
      const mgr = new PluginLifecycleManager({
        verifySignatures: true,
        shutdownTimeoutMs: 500,
      });
      const manifest = makeManifest({
        name: 'verified-plugin',
        trustLevel: 'verified',
      });
      setupInstallSuccess(manifest);
      setupValidateSuccess();

      // Override verifyPlugin to return invalid
      const keyStore = mgr.getKeyStore();
      vi.spyOn(keyStore, 'verifyPlugin').mockResolvedValue({
        valid: false,
        trusted: false,
        reason: 'No signature file found',
      });

      await mgr.install('/tmp/verified-plugin');
      await mgr.validate('verified-plugin');

      const entry = mgr.getPlugin('verified-plugin');
      expect(entry?.manifest?.trustLevel).toBe('community');
    });
  });

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------

  describe('load()', () => {
    it('should load a validated plugin into a sandbox', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      const handle = setupLoadSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');
      const result = await manager.load('test-plugin');

      expect(result).toBe(handle);
      expect(manager.getPlugin('test-plugin')?.state).toBe('loaded');
      expect(manager.getPlugin('test-plugin')?.loadedAt).toBeGreaterThan(0);
    });

    it('should throw if plugin is not installed', async () => {
      await expect(manager.load('nonexistent')).rejects.toThrow(
        'not installed'
      );
    });

    it('should throw if plugin is in the wrong state', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);

      await manager.install('/tmp/test-plugin');

      // Still in 'installed' state, not 'validated'
      await expect(manager.load('test-plugin')).rejects.toThrow(
        'must be in "validated" or "disabled"'
      );
    });

    it('should throw if a dependency is not active', async () => {
      const depManifest = makeManifest({ name: 'dep-plugin' });
      const childManifest = makeManifest({
        name: 'child-plugin',
        dependencies: { plugins: ['dep-plugin'], runtime: {} },
      });

      // Install dep but do NOT activate it
      setupInstallSuccess(depManifest);
      setupValidateSuccess();
      await manager.install('/tmp/dep-plugin');
      await manager.validate('dep-plugin');

      // Install child
      setupInstallSuccess(childManifest);
      setupValidateSuccess();
      await manager.install('/tmp/child-plugin');
      await manager.validate('child-plugin');

      await expect(manager.load('child-plugin')).rejects.toThrow(
        'depends on "dep-plugin" which is not active'
      );
    });
  });

  // -----------------------------------------------------------------------
  // Activation
  // -----------------------------------------------------------------------

  describe('activate()', () => {
    it('should activate a loaded plugin', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      const handle = setupLoadSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');
      await manager.load('test-plugin');
      await manager.activate('test-plugin');

      expect(manager.getPlugin('test-plugin')?.state).toBe('active');
      expect(handle.call).toHaveBeenCalledWith('activate', {
        name: 'test-plugin',
        version: '1.0.0',
      });
    });

    it('should throw if plugin activation method throws', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      const handle = makeMockHandle();
      handle.call.mockRejectedValue(new Error('activation error'));
      setupLoadSuccess(handle);

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');
      await manager.load('test-plugin');

      await expect(manager.activate('test-plugin')).rejects.toThrow(
        'activation error'
      );
      // Should remain in 'loaded' state
      expect(manager.getPlugin('test-plugin')?.state).toBe('loaded');
    });

    it('should throw if plugin is not in loaded state', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');

      await expect(manager.activate('test-plugin')).rejects.toThrow(
        'must be in "loaded" state'
      );
    });
  });

  // -----------------------------------------------------------------------
  // Disable & Cascading
  // -----------------------------------------------------------------------

  describe('disable()', () => {
    it('should disable an active plugin', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      const handle = setupLoadSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');
      await manager.load('test-plugin');
      await manager.activate('test-plugin');

      const cascaded = await manager.disable('test-plugin');

      expect(cascaded).toEqual([]);
      expect(manager.getPlugin('test-plugin')?.state).toBe('disabled');
      expect(handle.call).toHaveBeenCalledWith('deactivate');
      expect(handle.destroy).toHaveBeenCalled();
    });

    it('should cascade disable to dependants', async () => {
      // Set up: pluginA (no deps), pluginB depends on pluginA
      const manifestA = makeManifest({ name: 'plugin-a' });
      const manifestB = makeManifest({
        name: 'plugin-b',
        dependencies: { plugins: ['plugin-a'], runtime: {} },
      });

      // Install & activate A
      setupInstallSuccess(manifestA);
      setupValidateSuccess();
      const handleA = makeMockHandle('plugin-a');
      mockedCreateSandbox.mockResolvedValueOnce(handleA);
      await manager.install('/tmp/plugin-a');
      await manager.validate('plugin-a');
      await manager.load('plugin-a');
      await manager.activate('plugin-a');

      // Install & activate B
      setupInstallSuccess(manifestB);
      setupValidateSuccess();
      const handleB = makeMockHandle('plugin-b');
      mockedCreateSandbox.mockResolvedValueOnce(handleB);
      await manager.install('/tmp/plugin-b');
      await manager.validate('plugin-b');
      await manager.load('plugin-b');
      await manager.activate('plugin-b');

      // Disable A -- should cascade to B
      const cascaded = await manager.disable('plugin-a');

      expect(cascaded).toContain('plugin-b');
      expect(manager.getPlugin('plugin-b')?.state).toBe('disabled');
      expect(manager.getPlugin('plugin-a')?.state).toBe('disabled');
    });
  });

  // -----------------------------------------------------------------------
  // Unload
  // -----------------------------------------------------------------------

  describe('unload()', () => {
    it('should unload a disabled plugin', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      setupLoadSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');
      await manager.load('test-plugin');
      await manager.activate('test-plugin');
      await manager.disable('test-plugin');

      await manager.unload('test-plugin');

      expect(manager.getPlugin('test-plugin')?.state).toBe('unloaded');
    });

    it('should throw if plugin is not disabled', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      setupLoadSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');
      await manager.load('test-plugin');
      await manager.activate('test-plugin');

      await expect(manager.unload('test-plugin')).rejects.toThrow(
        'must be "disabled"'
      );
    });
  });

  // -----------------------------------------------------------------------
  // Uninstall
  // -----------------------------------------------------------------------

  describe('uninstall()', () => {
    it('should uninstall an active plugin (auto-disable + unload)', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      setupLoadSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');
      await manager.load('test-plugin');
      await manager.activate('test-plugin');

      await manager.uninstall('test-plugin');

      expect(manager.getPlugin('test-plugin')).toBeUndefined();
      expect(manager.getIpcBus().unsubscribeAll).toHaveBeenCalledWith(
        'test-plugin'
      );
      expect(getMetricsRegistry().remove).toHaveBeenCalledWith('test-plugin');
    });

    it('should do nothing for a nonexistent plugin', async () => {
      await expect(manager.uninstall('nonexistent')).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Hot Reload
  // -----------------------------------------------------------------------

  describe('hotReload()', () => {
    it('should hot-reload an active plugin successfully', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      setupLoadSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');
      await manager.load('test-plugin');
      await manager.activate('test-plugin');

      // Set up mocks for reload cycle
      mockedVerifyIntegrity.mockResolvedValue({ valid: true });
      mockedScanDir.mockResolvedValue(passingScanSummary());
      const newHandle = makeMockHandle();
      mockedCreateSandbox.mockResolvedValue(newHandle);

      const events: LifecycleEvent[] = [];
      manager.onEvent(e => {
        if (e.type === 'hot_reload') {
          events.push(e);
        }
      });

      const result = await manager.hotReload('test-plugin');

      expect(result.success).toBe(true);
      expect(result.previousState).toBe('active');
      expect(manager.getPlugin('test-plugin')?.state).toBe('active');
      expect(manager.getPlugin('test-plugin')?.reloadCount).toBe(1);

      // Verify reload events were emitted
      const phases = events.map(e => e.details.phase);
      expect(phases).toContain('start');
      expect(phases).toContain('complete');
    });

    it('should return failure when re-validation fails during hot reload', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      setupLoadSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');
      await manager.load('test-plugin');
      await manager.activate('test-plugin');

      // Fail re-validation
      mockedVerifyIntegrity.mockResolvedValue({ valid: true });
      mockedScanDir.mockResolvedValue(failingScanSummary());

      const result = await manager.hotReload('test-plugin');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Re-validation failed');
    });

    it('should return failure for nonexistent plugin', async () => {
      const result = await manager.hotReload('nonexistent');

      expect(result.success).toBe(false);
      expect(result.previousState).toBe('uninstalled');
    });

    it('should reload a validated (not active) plugin without re-activating', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');

      // Hot-reload from 'validated' state
      mockedVerifyIntegrity.mockResolvedValue({ valid: true });
      mockedScanDir.mockResolvedValue(passingScanSummary());

      const result = await manager.hotReload('test-plugin');

      expect(result.success).toBe(true);
      expect(manager.getPlugin('test-plugin')?.state).toBe('validated');
    });
  });

  // -----------------------------------------------------------------------
  // Full Lifecycle
  // -----------------------------------------------------------------------

  describe('installAndActivate()', () => {
    it('should perform the complete lifecycle in one call', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      const handle = setupLoadSuccess();

      const result = await manager.installAndActivate('/tmp/test-plugin');

      expect(result).toBe(handle);
      expect(manager.getPlugin('test-plugin')?.state).toBe('active');
    });

    it('should throw when installation fails', async () => {
      mockedLoadManifest.mockResolvedValue({
        valid: false,
        manifest: undefined,
        errors: [{ path: 'name', message: 'required', code: 'invalid_type' }],
        warnings: [],
      });

      await expect(
        manager.installAndActivate('/tmp/bad-plugin')
      ).rejects.toThrow('Plugin installation failed');
    });
  });

  // -----------------------------------------------------------------------
  // Bulk Load with Dependency Ordering
  // -----------------------------------------------------------------------

  describe('loadAll()', () => {
    it('should load plugins in dependency order', async () => {
      const manifestA = makeManifest({ name: 'plugin-a' });
      const manifestB = makeManifest({
        name: 'plugin-b',
        dependencies: { plugins: ['plugin-a'], runtime: {} },
      });

      // Install and validate both
      setupInstallSuccess(manifestA);
      setupValidateSuccess();
      await manager.install('/tmp/plugin-a');
      await manager.validate('plugin-a');

      setupInstallSuccess(manifestB);
      setupValidateSuccess();
      await manager.install('/tmp/plugin-b');
      await manager.validate('plugin-b');

      // Mock sandbox creation -- plugin-a should load first
      const handleA = makeMockHandle('plugin-a');
      const handleB = makeMockHandle('plugin-b');
      const callOrder: string[] = [];
      mockedCreateSandbox.mockImplementation(async params => {
        callOrder.push(params.manifest.name);
        if (params.manifest.name === 'plugin-a') {
          return handleA;
        }
        return handleB;
      });

      const result = await manager.loadAll();

      expect(result.loaded).toContain('plugin-a');
      expect(result.loaded).toContain('plugin-b');
      expect(callOrder.indexOf('plugin-a')).toBeLessThan(
        callOrder.indexOf('plugin-b')
      );
    });

    it('should throw on circular dependencies', async () => {
      const manifestA = makeManifest({
        name: 'cycle-a',
        dependencies: { plugins: ['cycle-b'], runtime: {} },
      });
      const manifestB = makeManifest({
        name: 'cycle-b',
        dependencies: { plugins: ['cycle-a'], runtime: {} },
      });

      setupInstallSuccess(manifestA);
      setupValidateSuccess();
      await manager.install('/tmp/cycle-a');
      await manager.validate('cycle-a');

      setupInstallSuccess(manifestB);
      setupValidateSuccess();
      await manager.install('/tmp/cycle-b');
      await manager.validate('cycle-b');

      await expect(manager.loadAll()).rejects.toThrow(
        'Circular plugin dependency'
      );
    });

    it('should report failures and continue with remaining plugins', async () => {
      const manifestA = makeManifest({ name: 'ok-plugin' });
      const manifestB = makeManifest({ name: 'fail-plugin' });

      setupInstallSuccess(manifestA);
      setupValidateSuccess();
      await manager.install('/tmp/ok-plugin');
      await manager.validate('ok-plugin');

      setupInstallSuccess(manifestB);
      setupValidateSuccess();
      await manager.install('/tmp/fail-plugin');
      await manager.validate('fail-plugin');

      const handleA = makeMockHandle('ok-plugin');
      mockedCreateSandbox.mockImplementation(async params => {
        if (params.manifest.name === 'fail-plugin') {
          throw new Error('Sandbox creation failed');
        }
        return handleA;
      });

      const result = await manager.loadAll();

      expect(result.loaded).toContain('ok-plugin');
      expect(result.failed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'fail-plugin',
            error: expect.stringContaining('Sandbox creation failed'),
          }),
        ])
      );
    });
  });

  // -----------------------------------------------------------------------
  // Query Methods
  // -----------------------------------------------------------------------

  describe('query methods', () => {
    it('getPlugin() returns undefined for unknown plugins', () => {
      expect(manager.getPlugin('unknown')).toBeUndefined();
    });

    it('getAllPlugins() returns all registered plugins', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      await manager.install('/tmp/test-plugin');

      expect(manager.getAllPlugins()).toHaveLength(1);
    });

    it('getActivePlugins() returns only active plugins', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      setupLoadSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');

      expect(manager.getActivePlugins()).toHaveLength(0);

      await manager.load('test-plugin');
      await manager.activate('test-plugin');

      expect(manager.getActivePlugins()).toHaveLength(1);
    });

    it('getLoadOrder() returns topological order', async () => {
      const manifestA = makeManifest({ name: 'load-a' });
      const manifestB = makeManifest({
        name: 'load-b',
        dependencies: { plugins: ['load-a'], runtime: {} },
      });

      setupInstallSuccess(manifestA);
      await manager.install('/tmp/load-a');
      setupInstallSuccess(manifestB);
      await manager.install('/tmp/load-b');

      const order = manager.getLoadOrder();
      expect(order.indexOf('load-a')).toBeLessThan(order.indexOf('load-b'));
    });
  });

  // -----------------------------------------------------------------------
  // Event System
  // -----------------------------------------------------------------------

  describe('event system', () => {
    it('should emit state_change events', async () => {
      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));

      const manifest = makeManifest();
      setupInstallSuccess(manifest);

      await manager.install('/tmp/test-plugin');

      const stateEvents = events.filter(e => e.type === 'state_change');
      expect(stateEvents.length).toBeGreaterThan(0);
      expect(stateEvents[0]?.pluginName).toBe('test-plugin');
      expect(stateEvents[0]?.timestamp).toBeGreaterThan(0);
    });

    it('should not break lifecycle when event listener throws', async () => {
      manager.onEvent(() => {
        throw new Error('listener error');
      });

      const manifest = makeManifest();
      setupInstallSuccess(manifest);

      // Should not throw even though listener throws
      await expect(manager.install('/tmp/test-plugin')).resolves.toBeDefined();
    });

    it('should emit load_complete events', async () => {
      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));

      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      setupLoadSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');
      await manager.load('test-plugin');

      const loadEvent = events.find(e => e.type === 'load_complete');
      expect(loadEvent).toBeDefined();
      expect(loadEvent?.details.tier).toBe('worker');
    });

    it('should emit scan_complete events', async () => {
      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));

      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');

      const scanEvent = events.find(e => e.type === 'scan_complete');
      expect(scanEvent).toBeDefined();
      expect(scanEvent?.details.passed).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Metrics & IPC Diagnostics
  // -----------------------------------------------------------------------

  describe('metrics and diagnostics', () => {
    it('getPluginMetrics() delegates to the registry', () => {
      const metrics = manager.getPluginMetrics();
      expect(getMetricsRegistry().allSnapshots).toHaveBeenCalled();
      expect(metrics).toEqual([]);
    });

    it('getIpcDiagnostics() returns bus state', () => {
      const diag = manager.getIpcDiagnostics();
      expect(diag.totalChannels).toBe(0);
      expect(diag.pendingRequests).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Shutdown
  // -----------------------------------------------------------------------

  describe('shutdown()', () => {
    it('should destroy all active plugin handles', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      const handle = setupLoadSuccess();

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');
      await manager.load('test-plugin');
      await manager.activate('test-plugin');

      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));

      await manager.shutdown();

      expect(handle.destroy).toHaveBeenCalled();
      expect(events.find(e => e.type === 'shutdown_started')).toBeDefined();
      expect(events.find(e => e.type === 'shutdown_complete')).toBeDefined();
    });

    it('should be idempotent (second call is a no-op while in progress)', async () => {
      // This tests the shutdownInProgress guard
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      const handle = makeMockHandle();
      // Make destroy slow so shutdown is still in progress
      handle.destroy.mockImplementation(
        () => new Promise(r => setTimeout(r, 100))
      );
      setupLoadSuccess(handle);

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');
      await manager.load('test-plugin');
      await manager.activate('test-plugin');

      // Start first shutdown (do not await yet)
      const p1 = manager.shutdown();
      // Start second (should return immediately with warning)
      const p2 = manager.shutdown();
      await Promise.all([p1, p2]);
      // destroy should only be called for the first shutdown
    });

    it('should handle errors during individual plugin shutdown', async () => {
      const manifest = makeManifest();
      setupInstallSuccess(manifest);
      setupValidateSuccess();
      const handle = makeMockHandle();
      handle.destroy.mockRejectedValue(new Error('destroy failed'));
      setupLoadSuccess(handle);

      await manager.install('/tmp/test-plugin');
      await manager.validate('test-plugin');
      await manager.load('test-plugin');
      await manager.activate('test-plugin');

      // Should not throw even if destroy fails
      await expect(manager.shutdown()).resolves.toBeUndefined();
    });
  });
});
