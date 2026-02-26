/**
 * Plugin Permission System
 *
 * Provides runtime permission enforcement for sandboxed plugins. Every API
 * call from a plugin passes through a PermissionGuard that checks the
 * declared manifest permissions against the actual operation.
 *
 * All permission decisions are logged to an audit trail for post-incident
 * investigation.
 *
 * Architecture:
 *   PluginManifest.permissions  -->  PermissionGuard  -->  allow / deny + audit
 */

import * as path from 'path';

import { minimatch } from 'minimatch';

import type { PluginManifest, PluginPermissions } from './plugin-manifest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The categories of operations that can be permission-checked. */
export type PermissionDomain =
  | 'filesystem:read'
  | 'filesystem:write'
  | 'network'
  | 'process'
  | 'env:read'
  | 'env:write'
  | 'mcpTool';

export type PermissionDecision = 'allow' | 'deny';

export type PermissionCheckResult = {
  decision: PermissionDecision;
  domain: PermissionDomain;
  target: string;
  pluginName: string;
  reason: string;
};

export type AuditEntry = {
  timestamp: number;
  pluginName: string;
  domain: PermissionDomain;
  target: string;
  decision: PermissionDecision;
  reason: string;
};

export type AuditListener = (entry: AuditEntry) => void;

// ---------------------------------------------------------------------------
// MCP Tool Pattern Matching
// ---------------------------------------------------------------------------

type CompiledPattern =
  | { kind: 'all' }
  | { kind: 'exact'; value: string }
  | { kind: 'glob'; value: string };

function compileToolPattern(pattern: string): CompiledPattern {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) {
    return { kind: 'exact', value: '' };
  }
  if (normalized === '*') {
    return { kind: 'all' };
  }
  if (normalized.includes('*')) {
    return { kind: 'glob', value: normalized };
  }
  return { kind: 'exact', value: normalized };
}

function matchesToolPattern(name: string, pattern: CompiledPattern): boolean {
  if (pattern.kind === 'all') {
    return true;
  }
  if (pattern.kind === 'exact') {
    return name === pattern.value;
  }
  return minimatch(name, pattern.value);
}

// ---------------------------------------------------------------------------
// Permission Guard
// ---------------------------------------------------------------------------

/**
 * A PermissionGuard is created per-plugin and enforces the permissions
 * declared in that plugin's manifest. It is the single chokepoint through
 * which all plugin API calls must pass.
 */
export class PermissionGuard {
  private pluginName: string;
  private permissions: PluginPermissions;
  private pluginRoot: string;
  private cwd: string;

  /** Pre-compiled MCP tool allow/deny patterns. */
  private mcpAllow: CompiledPattern[];
  private mcpDeny: CompiledPattern[];

  /** Audit listeners. */
  private auditListeners: AuditListener[] = [];

  /** In-memory audit log (bounded). */
  private auditLog: AuditEntry[] = [];
  private maxAuditEntries: number;

  constructor(params: {
    pluginName: string;
    permissions: PluginPermissions;
    pluginRoot: string;
    cwd?: string;
    maxAuditEntries?: number;
  }) {
    this.pluginName = params.pluginName;
    this.permissions = params.permissions;
    this.pluginRoot = path.resolve(params.pluginRoot);
    this.cwd = params.cwd ? path.resolve(params.cwd) : process.cwd();
    this.maxAuditEntries = params.maxAuditEntries ?? 10_000;

    this.mcpAllow = params.permissions.mcpTools.allow.map(compileToolPattern);
    this.mcpDeny = params.permissions.mcpTools.deny.map(compileToolPattern);
  }

  // -----------------------------------------------------------------------
  // Audit
  // -----------------------------------------------------------------------

  /**
   * Register a listener that will be called for every permission decision.
   */
  onAudit(listener: AuditListener): void {
    this.auditListeners.push(listener);
  }

  /**
   * Get the in-memory audit log.
   */
  getAuditLog(): ReadonlyArray<AuditEntry> {
    return this.auditLog;
  }

  private recordAudit(entry: AuditEntry): void {
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditEntries) {
      // Drop oldest 10%
      this.auditLog = this.auditLog.slice(
        Math.floor(this.maxAuditEntries * 0.1)
      );
    }
    for (const listener of this.auditListeners) {
      try {
        listener(entry);
      } catch {
        // Audit listeners must not break the permission check
      }
    }
  }

  private makeResult(
    domain: PermissionDomain,
    target: string,
    decision: PermissionDecision,
    reason: string
  ): PermissionCheckResult {
    const entry: AuditEntry = {
      timestamp: Date.now(),
      pluginName: this.pluginName,
      domain,
      target,
      decision,
      reason,
    };
    this.recordAudit(entry);
    return { decision, domain, target, pluginName: this.pluginName, reason };
  }

  // -----------------------------------------------------------------------
  // Filesystem Checks
  // -----------------------------------------------------------------------

  /**
   * Resolve a possibly-relative path against the plugin root and cwd,
   * then normalize it.
   */
  private resolveTargetPath(targetPath: string): string {
    if (path.isAbsolute(targetPath)) {
      return path.normalize(targetPath);
    }
    return path.normalize(path.resolve(this.cwd, targetPath));
  }

  /**
   * Check if a target path matches any of the declared glob patterns.
   * Patterns are resolved relative to the cwd.
   */
  private pathMatchesPatterns(targetPath: string, patterns: string[]): boolean {
    const resolved = this.resolveTargetPath(targetPath);

    for (const pattern of patterns) {
      // Resolve the pattern relative to the cwd
      const resolvedPattern = path.isAbsolute(pattern)
        ? pattern
        : path.join(this.cwd, pattern);

      if (minimatch(resolved, resolvedPattern, { dot: true })) {
        return true;
      }

      // Also check if the path is inside the pattern directory
      const patternDir = resolvedPattern.replace(/\/?\*\*.*$/, '');
      if (patternDir && resolved.startsWith(patternDir)) {
        return true;
      }
    }

    // Always allow access within the plugin's own directory
    if (resolved.startsWith(this.pluginRoot)) {
      return true;
    }

    return false;
  }

  /**
   * Check filesystem read permission for a given path.
   */
  checkFilesystemRead(targetPath: string): PermissionCheckResult {
    const domain: PermissionDomain = 'filesystem:read';

    // Path traversal check
    if (targetPath.includes('..')) {
      return this.makeResult(
        domain,
        targetPath,
        'deny',
        'Path contains ".." traversal'
      );
    }

    const patterns = this.permissions.filesystem.read;
    if (patterns.length === 0) {
      // No read patterns declared -- only allow plugin's own directory
      const resolved = this.resolveTargetPath(targetPath);
      if (resolved.startsWith(this.pluginRoot)) {
        return this.makeResult(
          domain,
          targetPath,
          'allow',
          'Within plugin root (default)'
        );
      }
      return this.makeResult(
        domain,
        targetPath,
        'deny',
        'No filesystem.read permissions declared'
      );
    }

    if (this.pathMatchesPatterns(targetPath, patterns)) {
      return this.makeResult(
        domain,
        targetPath,
        'allow',
        'Matches declared read pattern'
      );
    }
    return this.makeResult(
      domain,
      targetPath,
      'deny',
      'Does not match any declared read pattern'
    );
  }

  /**
   * Check filesystem write permission for a given path.
   */
  checkFilesystemWrite(targetPath: string): PermissionCheckResult {
    const domain: PermissionDomain = 'filesystem:write';

    if (targetPath.includes('..')) {
      return this.makeResult(
        domain,
        targetPath,
        'deny',
        'Path contains ".." traversal'
      );
    }

    const patterns = this.permissions.filesystem.write;
    if (patterns.length === 0) {
      return this.makeResult(
        domain,
        targetPath,
        'deny',
        'No filesystem.write permissions declared'
      );
    }

    if (this.pathMatchesPatterns(targetPath, patterns)) {
      return this.makeResult(
        domain,
        targetPath,
        'allow',
        'Matches declared write pattern'
      );
    }
    return this.makeResult(
      domain,
      targetPath,
      'deny',
      'Does not match any declared write pattern'
    );
  }

  // -----------------------------------------------------------------------
  // Network Checks
  // -----------------------------------------------------------------------

  /**
   * Check network access permission for a given host and optional port.
   */
  checkNetwork(host: string, port?: number): PermissionCheckResult {
    const domain: PermissionDomain = 'network';
    const target = port ? `${host}:${port}` : host;

    const normalizedHost = host.toLowerCase().trim();
    const allowedHosts = this.permissions.network.hosts.map(h =>
      h.toLowerCase().trim()
    );
    const allowedPorts = this.permissions.network.ports;

    // Localhost is always allowed for local development
    if (
      normalizedHost === 'localhost' ||
      normalizedHost === '127.0.0.1' ||
      normalizedHost === '::1'
    ) {
      return this.makeResult(
        domain,
        target,
        'allow',
        'Localhost always allowed'
      );
    }

    // Check host
    const hostAllowed = allowedHosts.some(allowed => {
      if (allowed === '*') {
        return true;
      }
      if (allowed === normalizedHost) {
        return true;
      }
      // Wildcard subdomain: *.example.com matches foo.example.com
      if (
        allowed.startsWith('*.') &&
        normalizedHost.endsWith(allowed.slice(1))
      ) {
        return true;
      }
      return false;
    });

    if (!hostAllowed) {
      return this.makeResult(
        domain,
        target,
        'deny',
        `Host "${normalizedHost}" not in declared permissions.network.hosts`
      );
    }

    // Check port (if any ports are declared and a port is provided)
    if (port && allowedPorts.length > 0 && !allowedPorts.includes(port)) {
      return this.makeResult(
        domain,
        target,
        'deny',
        `Port ${port} not in declared permissions.network.ports`
      );
    }

    return this.makeResult(
      domain,
      target,
      'allow',
      'Host and port match declared permissions'
    );
  }

  // -----------------------------------------------------------------------
  // Process Execution Checks
  // -----------------------------------------------------------------------

  /**
   * Check whether the plugin is allowed to spawn a process.
   */
  checkProcess(executable: string): PermissionCheckResult {
    const domain: PermissionDomain = 'process';
    const basename = path.basename(executable);
    const allowed = this.permissions.process.allowed;

    if (allowed.length === 0) {
      return this.makeResult(
        domain,
        executable,
        'deny',
        'No process execution permissions declared'
      );
    }

    const isAllowed = allowed.some(a => {
      if (a === '*') {
        return true;
      }
      if (a === basename) {
        return true;
      }
      if (a === executable) {
        return true;
      }
      return false;
    });

    if (isAllowed) {
      return this.makeResult(
        domain,
        executable,
        'allow',
        'Executable in declared allow list'
      );
    }
    return this.makeResult(
      domain,
      executable,
      'deny',
      `"${basename}" not in declared permissions.process.allowed`
    );
  }

  // -----------------------------------------------------------------------
  // Environment Variable Checks
  // -----------------------------------------------------------------------

  /**
   * Check environment variable read permission.
   */
  checkEnvRead(varName: string): PermissionCheckResult {
    const domain: PermissionDomain = 'env:read';
    const allowed = this.permissions.env.read;

    if (allowed.length === 0) {
      return this.makeResult(
        domain,
        varName,
        'deny',
        'No env.read permissions declared'
      );
    }

    const isAllowed = allowed.some(a => {
      if (a === '*') {
        return true;
      }
      if (a === varName) {
        return true;
      }
      // Prefix match: PLUGIN_* matches PLUGIN_KEY, PLUGIN_SECRET
      if (a.endsWith('*') && varName.startsWith(a.slice(0, -1))) {
        return true;
      }
      return false;
    });

    if (isAllowed) {
      return this.makeResult(
        domain,
        varName,
        'allow',
        'Env var in declared read list'
      );
    }
    return this.makeResult(
      domain,
      varName,
      'deny',
      `"${varName}" not in declared permissions.env.read`
    );
  }

  /**
   * Check environment variable write permission.
   */
  checkEnvWrite(varName: string): PermissionCheckResult {
    const domain: PermissionDomain = 'env:write';
    const allowed = this.permissions.env.write;

    if (allowed.length === 0) {
      return this.makeResult(
        domain,
        varName,
        'deny',
        'No env.write permissions declared'
      );
    }

    const isAllowed = allowed.some(a => {
      if (a === '*') {
        return true;
      }
      if (a === varName) {
        return true;
      }
      if (a.endsWith('*') && varName.startsWith(a.slice(0, -1))) {
        return true;
      }
      return false;
    });

    if (isAllowed) {
      return this.makeResult(
        domain,
        varName,
        'allow',
        'Env var in declared write list'
      );
    }
    return this.makeResult(
      domain,
      varName,
      'deny',
      `"${varName}" not in declared permissions.env.write`
    );
  }

  // -----------------------------------------------------------------------
  // MCP Tool Checks
  // -----------------------------------------------------------------------

  /**
   * Check whether the plugin is allowed to use or register an MCP tool.
   */
  checkMcpTool(toolName: string): PermissionCheckResult {
    const domain: PermissionDomain = 'mcpTool';
    const normalized = toolName.trim().toLowerCase();

    // Deny list takes precedence
    for (const pattern of this.mcpDeny) {
      if (matchesToolPattern(normalized, pattern)) {
        return this.makeResult(
          domain,
          toolName,
          'deny',
          `Tool "${toolName}" matches deny pattern`
        );
      }
    }

    // If no allow patterns, default to deny-all for MCP tools
    if (this.mcpAllow.length === 0) {
      return this.makeResult(
        domain,
        toolName,
        'deny',
        'No mcpTools.allow permissions declared'
      );
    }

    for (const pattern of this.mcpAllow) {
      if (matchesToolPattern(normalized, pattern)) {
        return this.makeResult(
          domain,
          toolName,
          'allow',
          `Tool "${toolName}" matches allow pattern`
        );
      }
    }

    return this.makeResult(
      domain,
      toolName,
      'deny',
      `Tool "${toolName}" does not match any allow pattern`
    );
  }

  // -----------------------------------------------------------------------
  // Convenience: Throw on Deny
  // -----------------------------------------------------------------------

  /**
   * Perform a check and throw a PermissionDeniedError if the result is 'deny'.
   */
  requireFilesystemRead(targetPath: string): void {
    const result = this.checkFilesystemRead(targetPath);
    if (result.decision === 'deny') {
      throw new PermissionDeniedError(result);
    }
  }

  requireFilesystemWrite(targetPath: string): void {
    const result = this.checkFilesystemWrite(targetPath);
    if (result.decision === 'deny') {
      throw new PermissionDeniedError(result);
    }
  }

  requireNetwork(host: string, port?: number): void {
    const result = this.checkNetwork(host, port);
    if (result.decision === 'deny') {
      throw new PermissionDeniedError(result);
    }
  }

  requireProcess(executable: string): void {
    const result = this.checkProcess(executable);
    if (result.decision === 'deny') {
      throw new PermissionDeniedError(result);
    }
  }

  requireEnvRead(varName: string): void {
    const result = this.checkEnvRead(varName);
    if (result.decision === 'deny') {
      throw new PermissionDeniedError(result);
    }
  }

  requireEnvWrite(varName: string): void {
    const result = this.checkEnvWrite(varName);
    if (result.decision === 'deny') {
      throw new PermissionDeniedError(result);
    }
  }

  requireMcpTool(toolName: string): void {
    const result = this.checkMcpTool(toolName);
    if (result.decision === 'deny') {
      throw new PermissionDeniedError(result);
    }
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------

  /**
   * Return audit statistics.
   */
  getAuditStats(): {
    total: number;
    allowed: number;
    denied: number;
    byDomain: Record<string, { allowed: number; denied: number }>;
  } {
    let allowed = 0;
    let denied = 0;
    const byDomain: Record<string, { allowed: number; denied: number }> = {};

    for (const entry of this.auditLog) {
      if (entry.decision === 'allow') {
        allowed++;
      } else {
        denied++;
      }

      if (!byDomain[entry.domain]) {
        byDomain[entry.domain] = { allowed: 0, denied: 0 };
      }
      if (entry.decision === 'allow') {
        byDomain[entry.domain]!.allowed++;
      } else {
        byDomain[entry.domain]!.denied++;
      }
    }

    return { total: this.auditLog.length, allowed, denied, byDomain };
  }
}

// ---------------------------------------------------------------------------
// Permission Denied Error
// ---------------------------------------------------------------------------

export class PermissionDeniedError extends Error {
  public readonly domain: PermissionDomain;
  public readonly target: string;
  public readonly pluginName: string;
  public readonly reason: string;

  constructor(result: PermissionCheckResult) {
    super(
      `Plugin "${result.pluginName}" denied ${result.domain} access to "${result.target}": ${result.reason}`
    );
    this.name = 'PermissionDeniedError';
    this.domain = result.domain;
    this.target = result.target;
    this.pluginName = result.pluginName;
    this.reason = result.reason;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a PermissionGuard for a loaded plugin.
 */
export function createPermissionGuard(params: {
  manifest: PluginManifest;
  pluginRoot: string;
  cwd?: string;
  auditListener?: AuditListener;
}): PermissionGuard {
  const guard = new PermissionGuard({
    pluginName: params.manifest.name,
    permissions: params.manifest.permissions,
    pluginRoot: params.pluginRoot,
    cwd: params.cwd,
  });

  if (params.auditListener) {
    guard.onAudit(params.auditListener);
  }

  return guard;
}

// ---------------------------------------------------------------------------
// Sandboxed API Proxy Builder
// ---------------------------------------------------------------------------

/**
 * Build a sandboxed `fs` proxy that routes read/write calls through
 * the permission guard. This is injected into VM and Worker contexts
 * instead of the real `fs` module.
 */
export function buildSandboxedFsProxy(
  guard: PermissionGuard
): Record<string, (...args: any[]) => any> {
  return {
    readFile: async (filePath: string, ...rest: any[]) => {
      guard.requireFilesystemRead(filePath);
      const realFs = await import('fs/promises');
      return realFs.readFile(filePath, ...rest);
    },
    readFileSync: (filePath: string, ...rest: any[]) => {
      guard.requireFilesystemRead(filePath);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const realFs = require('fs');
      return realFs.readFileSync(filePath, ...rest);
    },
    writeFile: async (filePath: string, data: any, ...rest: any[]) => {
      guard.requireFilesystemWrite(filePath);
      const realFs = await import('fs/promises');
      return realFs.writeFile(filePath, data, ...rest);
    },
    writeFileSync: (filePath: string, data: any, ...rest: any[]) => {
      guard.requireFilesystemWrite(filePath);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const realFs = require('fs');
      return realFs.writeFileSync(filePath, data, ...rest);
    },
    readdir: async (dirPath: string, ...rest: any[]) => {
      guard.requireFilesystemRead(dirPath);
      const realFs = await import('fs/promises');
      return realFs.readdir(dirPath, ...rest);
    },
    stat: async (filePath: string, ...rest: any[]) => {
      guard.requireFilesystemRead(filePath);
      const realFs = await import('fs/promises');
      return realFs.stat(filePath, ...rest);
    },
    mkdir: async (dirPath: string, ...rest: any[]) => {
      guard.requireFilesystemWrite(dirPath);
      const realFs = await import('fs/promises');
      return realFs.mkdir(dirPath, ...rest);
    },
    unlink: async (filePath: string) => {
      guard.requireFilesystemWrite(filePath);
      const realFs = await import('fs/promises');
      return realFs.unlink(filePath);
    },
  };
}

/**
 * Build a sandboxed environment variable proxy.
 */
export function buildSandboxedEnvProxy(
  guard: PermissionGuard
): Record<string, string | undefined> {
  return new Proxy({} as Record<string, string | undefined>, {
    get(_target, prop: string) {
      const result = guard.checkEnvRead(prop);
      if (result.decision === 'deny') {
        return undefined;
      }
      return process.env[prop];
    },
    set(_target, prop: string, value: string) {
      guard.requireEnvWrite(prop);
      process.env[prop] = value;
      return true;
    },
    has(_target, prop: string) {
      const result = guard.checkEnvRead(prop);
      return result.decision === 'allow' && prop in process.env;
    },
    ownKeys() {
      // Only expose env vars the plugin is allowed to read
      return Object.keys(process.env).filter(key => {
        const result = guard.checkEnvRead(key);
        return result.decision === 'allow';
      });
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      const result = guard.checkEnvRead(prop);
      if (result.decision === 'deny' || !(prop in process.env)) {
        return undefined;
      }
      return {
        value: process.env[prop],
        writable: true,
        enumerable: true,
        configurable: true,
      };
    },
  });
}
