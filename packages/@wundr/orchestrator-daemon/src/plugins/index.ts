/**
 * Plugin System
 *
 * Provides plugin lifecycle management with multi-tier sandboxing,
 * manifest validation, static analysis scanning, permission enforcement,
 * inter-plugin communication, signature verification, and metrics.
 *
 * @module @wundr/orchestrator-daemon/plugins
 */

// Lifecycle Manager
export {
  PluginLifecycleManager,
} from './plugin-lifecycle';
export type {
  PluginState,
  PluginEntry,
  LifecycleEvent,
  LifecycleEventListener,
  PluginLifecycleConfig,
} from './plugin-lifecycle';

// Manifest
export {
  loadManifest,
  verifyPluginIntegrity,
  DEFAULT_SYSTEM_POLICY,
} from './plugin-manifest';
export type {
  PluginManifest,
  SystemPluginPolicy,
} from './plugin-manifest';

// Scanner
export {
  scanPluginDirectory,
  formatScanReport,
} from './plugin-scanner';
export type {
  ScanSummary,
} from './plugin-scanner';

// Sandbox
export {
  createSandboxedPlugin,
  destroyAllHandles,
  getMetricsRegistry,
} from './sandbox';
export type {
  PluginHandle,
  SandboxConfig,
  SandboxTier,
} from './sandbox';

// Permission System
export {
  PermissionGuard,
  PermissionDeniedError,
  createPermissionGuard,
  buildSandboxedFsProxy,
  buildSandboxedEnvProxy,
} from './permission-system';
export type {
  PermissionDomain,
  PermissionDecision,
  PermissionCheckResult,
  AuditEntry,
  AuditListener,
} from './permission-system';

// Metrics
export {
  PluginMetrics,
  PluginMetricsRegistry,
} from './sandbox-metrics';
export type {
  PluginMetricsSnapshot,
  MetricsUpdatePayload,
} from './sandbox-metrics';

// IPC
export {
  PluginIpcBus,
} from './plugin-ipc';
export type {
  IpcMessage,
  IpcMessageKind,
  IpcHandler,
  IpcSubscription,
  IpcBusConfig,
} from './plugin-ipc';

// Signature Verification
export {
  verifyPluginSignature,
  TrustedKeyStore,
} from './plugin-signature';
export type {
  SignatureFile,
  SignatureVerificationResult,
  TrustedPublicKey,
} from './plugin-signature';
