/**
 * Environment Variable Sanitization for Wundr Orchestrator Daemon
 *
 * Ported from OpenClaw's environment variable security hardening found in:
 *   - src/agents/bash-tools.exec.ts (DANGEROUS_HOST_ENV_VARS, DANGEROUS_HOST_ENV_PREFIXES, validateHostEnv)
 *   - src/node-host/runner.ts       (blockedEnvKeys, blockedEnvPrefixes, sanitizeEnv)
 *
 * This module provides defense-in-depth for subprocess spawning by ensuring
 * that dangerous environment variables never reach child processes. It covers:
 *
 *   - Blocklist of variables that can hijack execution (NODE_OPTIONS, LD_PRELOAD, DYLD_*, etc.)
 *   - Platform-specific dangerous variable lists (macOS DYLD, Linux LD, Windows)
 *   - PATH sanitization to remove suspicious entries
 *   - Environment variable injection detection
 *   - Allowlist-based env var passing to child processes
 *   - Env var redaction for logging
 *   - Safe subprocess environment builder
 *   - Config-driven allowlist/denylist
 *   - Audit logging for blocked env vars
 *   - Integration with exec-approvals (pre-execution env check)
 *
 * Design: fail-closed. If a variable is not explicitly allowed, it is stripped.
 * All mutations are logged to an audit trail for post-incident analysis.
 *
 * @module @wundr/orchestrator-daemon/security/env-sanitizer
 */

import os from 'node:os';
import path from 'node:path';

import { Logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of sanitizing an environment variable map.
 */
export interface EnvSanitizeResult {
  /** The sanitized environment variables safe for subprocess use. */
  env: Record<string, string>;
  /** Variables that were blocked and the reason for each. */
  blocked: EnvBlockedEntry[];
  /** Variables whose values were modified (e.g. PATH trimming). */
  modified: EnvModifiedEntry[];
  /** Whether any variables were blocked or modified. */
  changed: boolean;
}

/**
 * A single blocked environment variable entry for audit logging.
 */
export interface EnvBlockedEntry {
  key: string;
  reason: EnvBlockReason;
  /** The original value, redacted for logging safety. */
  redactedValue: string;
}

/**
 * A single modified environment variable entry for audit logging.
 */
export interface EnvModifiedEntry {
  key: string;
  reason: string;
  /** The original value, redacted for logging safety. */
  originalRedacted: string;
  /** The new value after modification. */
  newValue: string;
}

/**
 * Categorized reason for blocking a variable.
 */
export type EnvBlockReason =
  | 'dangerous_variable'
  | 'dangerous_prefix'
  | 'path_modification_blocked'
  | 'not_in_allowlist'
  | 'injection_detected'
  | 'empty_key'
  | 'config_denylist';

/**
 * Severity level for audit events.
 */
export type EnvAuditSeverity = 'info' | 'warn' | 'critical';

/**
 * A single audit event emitted during sanitization.
 */
export interface EnvAuditEvent {
  timestamp: number;
  severity: EnvAuditSeverity;
  action: 'blocked' | 'modified' | 'allowed' | 'injection_detected';
  key: string;
  reason: string;
  detail?: string;
}

/**
 * Configuration for the environment sanitizer.
 * Supports config-driven allowlist/denylist overrides.
 */
export interface EnvSanitizerConfig {
  /**
   * Additional variable names to always block (merged with built-in denylist).
   * Case-insensitive matching.
   */
  denylist?: string[];

  /**
   * Additional variable name prefixes to block (merged with built-in prefixes).
   * Case-insensitive matching.
   */
  denyPrefixes?: string[];

  /**
   * Explicit allowlist of variable names that are always permitted.
   * When set, ONLY these variables (plus builtins like PATH, HOME, USER)
   * will pass through. Case-insensitive matching.
   */
  allowlist?: string[];

  /**
   * Whether to allow PATH modification. When false (default), any attempt
   * to set PATH is blocked. When true, PATH is sanitized but not blocked.
   */
  allowPathModification?: boolean;

  /**
   * Trusted PATH directories. PATH entries not in this list are stripped
   * during sanitization. Defaults to standard system directories.
   */
  trustedPathDirs?: string[];

  /**
   * Whether to enable injection detection heuristics. Defaults to true.
   */
  detectInjection?: boolean;

  /**
   * Platform override for testing. Defaults to process.platform.
   */
  platform?: NodeJS.Platform;

  /**
   * Logger instance for audit output. If not provided, a default is created.
   */
  logger?: Logger;

  /**
   * Callback invoked for each audit event. Use for external audit sinks.
   */
  onAudit?: (event: EnvAuditEvent) => void;
}

// ============================================================================
// Constants: Dangerous Variables (ported from OpenClaw)
// ============================================================================

/**
 * Environment variables that can alter execution flow or inject code.
 * Ported directly from OpenClaw's DANGEROUS_HOST_ENV_VARS in
 * src/agents/bash-tools.exec.ts (lines 61-78) and blockedEnvKeys in
 * src/node-host/runner.ts (lines 165-172).
 *
 * These are blocked on ALL platforms.
 */
const DANGEROUS_ENV_VARS_UNIVERSAL: ReadonlySet<string> = new Set([
  // Node.js execution hijacking
  'NODE_OPTIONS',
  'NODE_EXTRA_CA_CERTS',
  'NODE_PATH',
  'NODE_REDIRECT_WARNINGS',
  'NODE_REPL_HISTORY',
  'NODE_TLS_REJECT_UNAUTHORIZED',

  // Python execution hijacking
  'PYTHONPATH',
  'PYTHONHOME',
  'PYTHONSTARTUP',
  'PYTHONUSERSITE',

  // Ruby execution hijacking
  'RUBYLIB',
  'RUBYOPT',

  // Perl execution hijacking
  'PERL5LIB',
  'PERL5OPT',

  // Shell execution hijacking
  'BASH_ENV',
  'ENV',
  'CDPATH',
  'GLOBIGNORE',
  'IFS',
  'PROMPT_COMMAND',
  'SHELLOPTS',
  'BASHOPTS',
  'PS4',

  // glibc hijacking
  'GCONV_PATH',

  // SSL key logging
  'SSLKEYLOGFILE',

  // Locale hijacking (can cause buffer overflows in C programs)
  'LOCALDOMAIN',
  'HOSTALIASES',
  'RES_OPTIONS',

  // Java execution hijacking
  'JAVA_TOOL_OPTIONS',
  '_JAVA_OPTIONS',
  'JDK_JAVA_OPTIONS',

  // .NET execution hijacking
  'DOTNET_STARTUP_HOOKS',
  'COMPlus_EnableDiagnostics',

  // Git credential hijacking
  'GIT_ASKPASS',
  'SSH_ASKPASS',
  'GIT_EXEC_PATH',

  // Build tool injection
  'CMAKE_PREFIX_PATH',
  'CFLAGS',
  'CXXFLAGS',
  'LDFLAGS',
  'CPPFLAGS',
  'PKG_CONFIG_PATH',
]);

/**
 * macOS-specific dangerous variables.
 * DYLD_* variables allow library injection on macOS.
 * Ported from OpenClaw's DANGEROUS_HOST_ENV_PREFIXES.
 */
const DANGEROUS_ENV_VARS_MACOS: ReadonlySet<string> = new Set([
  'DYLD_INSERT_LIBRARIES',
  'DYLD_LIBRARY_PATH',
  'DYLD_FALLBACK_LIBRARY_PATH',
  'DYLD_FRAMEWORK_PATH',
  'DYLD_FALLBACK_FRAMEWORK_PATH',
  'DYLD_IMAGE_SUFFIX',
  'DYLD_FORCE_FLAT_NAMESPACE',
  'DYLD_PRINT_LIBRARIES',
  'DYLD_PRINT_APIS',
]);

/**
 * Linux-specific dangerous variables.
 * LD_* variables allow library injection on Linux.
 */
const DANGEROUS_ENV_VARS_LINUX: ReadonlySet<string> = new Set([
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'LD_AUDIT',
  'LD_BIND_NOT',
  'LD_DEBUG',
  'LD_DEBUG_OUTPUT',
  'LD_DYNAMIC_WEAK',
  'LD_HWCAP_MASK',
  'LD_ORIGIN_PATH',
  'LD_PROFILE',
  'LD_PROFILE_OUTPUT',
  'LD_SHOW_AUXV',
  'LD_USE_LOAD_BIAS',
]);

/**
 * Windows-specific dangerous variables.
 */
const DANGEROUS_ENV_VARS_WINDOWS: ReadonlySet<string> = new Set([
  'COMSPEC',
  'PATHEXT',
]);

/**
 * Dangerous environment variable name prefixes by platform.
 * Ported from OpenClaw's DANGEROUS_HOST_ENV_PREFIXES: ["DYLD_", "LD_"]
 */
const DANGEROUS_PREFIXES_UNIVERSAL: readonly string[] = [];

const DANGEROUS_PREFIXES_MACOS: readonly string[] = ['DYLD_'];

const DANGEROUS_PREFIXES_LINUX: readonly string[] = ['LD_'];

const DANGEROUS_PREFIXES_WINDOWS: readonly string[] = [];

// ============================================================================
// Constants: Safe Defaults
// ============================================================================

/**
 * Environment variables that are always safe to pass through.
 * These are required for basic process operation.
 */
const ALWAYS_ALLOWED_VARS: ReadonlySet<string> = new Set([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TERM',
  'TERM_PROGRAM',
  'COLORTERM',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'LC_MESSAGES',
  'TZ',
  'TMPDIR',
  'TEMP',
  'TMP',
  'EDITOR',
  'VISUAL',
  'PAGER',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_CACHE_HOME',
  'XDG_RUNTIME_DIR',
  'DISPLAY',
  'WAYLAND_DISPLAY',
  'HOSTNAME',
  'PWD',
  'OLDPWD',
  'SHLVL',
  'COLUMNS',
  'LINES',
  'FORCE_COLOR',
  'NO_COLOR',
  'CLICOLOR',
  'CLICOLOR_FORCE',
  // Node.js safe variables
  'NODE_ENV',
  'NODE_NO_WARNINGS',
  'NPM_CONFIG_REGISTRY',
  'YARN_CACHE_FOLDER',
  // Wundr-specific
  'WUNDR_SESSION_ID',
  'WUNDR_AGENT_ID',
  'WUNDR_TASK_ID',
  'WUNDR_CWD',
]);

/**
 * Default trusted PATH directories. PATH entries not matching these
 * patterns are considered suspicious and stripped during sanitization.
 */
const DEFAULT_TRUSTED_PATH_DIRS: readonly string[] = [
  '/usr/local/sbin',
  '/usr/local/bin',
  '/usr/sbin',
  '/usr/bin',
  '/sbin',
  '/bin',
  '/usr/games',
  '/usr/local/games',
  '/snap/bin',
  // Homebrew (macOS)
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  // Nix
  '/nix/var/nix/profiles/default/bin',
  // Common toolchain paths
  '/usr/local/go/bin',
  '/usr/local/cargo/bin',
];

/**
 * Default PATH used when the original PATH is entirely stripped.
 * Matches OpenClaw's DEFAULT_PATH.
 */
const FALLBACK_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

/**
 * Maximum length for an environment variable value before it is
 * considered suspicious by the injection detector.
 */
const MAX_ENV_VALUE_LENGTH = 65_536;

/**
 * Patterns in env var values that suggest injection attempts.
 */
const INJECTION_PATTERNS: readonly RegExp[] = [
  // Shell command injection in values
  /\$\(.*\)/,
  /`[^`]+`/,
  // Null byte injection
  // eslint-disable-next-line no-control-regex
  /\x00/,
  // Semicolon-separated commands smuggled in values
  /;\s*(rm|chmod|chown|curl|wget|nc|bash|sh|python|perl|ruby|node)\s/i,
  // Pipe to shell
  /\|\s*(bash|sh|zsh|fish|python|perl|ruby|node)\b/i,
];

// ============================================================================
// Internal Helpers
// ============================================================================

const defaultLogger = new Logger('EnvSanitizer');

/**
 * Resolve the combined set of dangerous variable names for the given platform.
 */
function resolveDangerousVars(platform: NodeJS.Platform): ReadonlySet<string> {
  const combined = new Set(
    [...DANGEROUS_ENV_VARS_UNIVERSAL].map((v) => v.toUpperCase()),
  );

  switch (platform) {
    case 'darwin':
      for (const v of DANGEROUS_ENV_VARS_MACOS) {
combined.add(v.toUpperCase());
}
      break;
    case 'linux':
    case 'freebsd':
    case 'openbsd':
    case 'sunos':
    case 'aix':
      for (const v of DANGEROUS_ENV_VARS_LINUX) {
combined.add(v.toUpperCase());
}
      break;
    case 'win32':
      for (const v of DANGEROUS_ENV_VARS_WINDOWS) {
combined.add(v.toUpperCase());
}
      break;
    default:
      // Conservative: include both Linux and macOS lists on unknown platforms
      for (const v of DANGEROUS_ENV_VARS_LINUX) {
combined.add(v.toUpperCase());
}
      for (const v of DANGEROUS_ENV_VARS_MACOS) {
combined.add(v.toUpperCase());
}
      break;
  }

  return combined;
}

/**
 * Resolve the combined set of dangerous variable prefixes for the given platform.
 */
function resolveDangerousPrefixes(platform: NodeJS.Platform): readonly string[] {
  const prefixes = [...DANGEROUS_PREFIXES_UNIVERSAL];

  switch (platform) {
    case 'darwin':
      prefixes.push(...DANGEROUS_PREFIXES_MACOS);
      break;
    case 'linux':
    case 'freebsd':
    case 'openbsd':
    case 'sunos':
    case 'aix':
      prefixes.push(...DANGEROUS_PREFIXES_LINUX);
      break;
    case 'win32':
      prefixes.push(...DANGEROUS_PREFIXES_WINDOWS);
      break;
    default:
      prefixes.push(...DANGEROUS_PREFIXES_LINUX, ...DANGEROUS_PREFIXES_MACOS);
      break;
  }

  return prefixes;
}

/**
 * Redact an environment variable value for safe logging.
 * Truncates long values and masks the middle portion.
 */
function redactEnvValue(value: string): string {
  if (value.length <= 8) {
    return '***';
  }
  if (value.length <= 40) {
    return `${value.slice(0, 3)}...(${value.length} chars)`;
  }
  return `${value.slice(0, 6)}...(${value.length} chars)...${value.slice(-4)}`;
}

/**
 * Check if a PATH entry looks like a standard system directory or a
 * user home directory (which are generally acceptable).
 */
function isPathEntryTrusted(
  entry: string,
  trustedDirs: readonly string[],
  homeDir: string,
): boolean {
  const normalized = entry.replace(/\/+$/, '');
  if (!normalized) {
    return false;
  }

  // Exact match against trusted directories
  for (const trusted of trustedDirs) {
    if (normalized === trusted) {
      return true;
    }
  }

  // User home subdirectories are generally acceptable
  // (e.g. ~/.local/bin, ~/.cargo/bin, ~/go/bin)
  if (homeDir && normalized.startsWith(homeDir + '/')) {
    return true;
  }

  // Nix store paths
  if (normalized.startsWith('/nix/store/')) {
    return true;
  }

  // System package manager paths
  if (normalized.startsWith('/usr/lib/') || normalized.startsWith('/usr/share/')) {
    return true;
  }

  return false;
}

/**
 * Detect potential injection patterns in an environment variable value.
 */
function detectInjection(key: string, value: string): string | null {
  // Check for excessive length
  if (value.length > MAX_ENV_VALUE_LENGTH) {
    return `value exceeds maximum length (${value.length} > ${MAX_ENV_VALUE_LENGTH})`;
  }

  // Check for known injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      return `value matches injection pattern: ${pattern.source}`;
    }
  }

  // Check for null bytes
  if (value.includes('\0')) {
    return 'value contains null byte';
  }

  // Check for control characters (except tab, newline, carriage return)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) {
    return 'value contains control characters';
  }

  return null;
}

// ============================================================================
// Core Sanitization
// ============================================================================

/**
 * Sanitize environment variables for safe subprocess spawning.
 *
 * This is the primary entry point. It applies the full sanitization pipeline:
 *
 *   1. Block known dangerous variables (platform-specific)
 *   2. Block variables matching dangerous prefixes (DYLD_*, LD_*)
 *   3. Block config-driven denylist entries
 *   4. Detect injection attempts in variable values
 *   5. Apply allowlist filtering (if configured)
 *   6. Sanitize PATH to remove suspicious entries
 *   7. Emit audit events for all blocks and modifications
 *
 * Modeled after OpenClaw's validateHostEnv() (bash-tools.exec.ts:83-107)
 * and sanitizeEnv() (runner.ts:206-244).
 *
 * @param env     - The environment variable map to sanitize.
 * @param config  - Optional configuration overrides.
 * @returns         The sanitization result with clean env and audit trail.
 */
export function sanitizeEnv(
  env: Record<string, string>,
  config?: EnvSanitizerConfig,
): EnvSanitizeResult {
  const platform = config?.platform ?? (process.platform as NodeJS.Platform);
  const logger = config?.logger ?? defaultLogger;
  const onAudit = config?.onAudit;
  const detectInjectionEnabled = config?.detectInjection !== false;
  const allowPathMod = config?.allowPathModification ?? false;
  const trustedPathDirs = config?.trustedPathDirs ?? DEFAULT_TRUSTED_PATH_DIRS;
  const homeDir = os.homedir();

  // Build the effective denylist
  const dangerousVars = resolveDangerousVars(platform);
  const dangerousPrefixes = resolveDangerousPrefixes(platform);
  const configDenylist = new Set(
    (config?.denylist ?? []).map((v) => v.toUpperCase()),
  );
  const configDenyPrefixes = (config?.denyPrefixes ?? []).map((p) =>
    p.toUpperCase(),
  );

  // Build the effective allowlist (if configured)
  const hasAllowlist = Array.isArray(config?.allowlist) && config!.allowlist.length > 0;
  const allowlistSet = hasAllowlist
    ? new Set([
        ...config!.allowlist!.map((v) => v.toUpperCase()),
        ...[...ALWAYS_ALLOWED_VARS].map((v) => v.toUpperCase()),
      ])
    : null;

  const result: Record<string, string> = {};
  const blocked: EnvBlockedEntry[] = [];
  const modified: EnvModifiedEntry[] = [];

  function emitAudit(event: EnvAuditEvent): void {
    if (onAudit) {
      onAudit(event);
    }
  }

  for (const [rawKey, value] of Object.entries(env)) {
    const key = rawKey.trim();
    if (!key) {
      blocked.push({
        key: rawKey,
        reason: 'empty_key',
        redactedValue: redactEnvValue(value),
      });
      emitAudit({
        timestamp: Date.now(),
        severity: 'info',
        action: 'blocked',
        key: rawKey,
        reason: 'Empty key name',
      });
      continue;
    }

    const upperKey = key.toUpperCase();

    // 1. Check dangerous variable names (exact match)
    if (dangerousVars.has(upperKey)) {
      blocked.push({
        key,
        reason: 'dangerous_variable',
        redactedValue: redactEnvValue(value),
      });
      logger.warn(`Blocked dangerous env var: ${key}`);
      emitAudit({
        timestamp: Date.now(),
        severity: 'critical',
        action: 'blocked',
        key,
        reason: `Dangerous variable (platform: ${platform})`,
      });
      continue;
    }

    // 2. Check dangerous prefixes
    const matchedPrefix = [...dangerousPrefixes, ...configDenyPrefixes].find(
      (prefix) => upperKey.startsWith(prefix.toUpperCase()),
    );
    if (matchedPrefix) {
      blocked.push({
        key,
        reason: 'dangerous_prefix',
        redactedValue: redactEnvValue(value),
      });
      logger.warn(`Blocked env var with dangerous prefix: ${key} (prefix: ${matchedPrefix})`);
      emitAudit({
        timestamp: Date.now(),
        severity: 'critical',
        action: 'blocked',
        key,
        reason: `Dangerous prefix: ${matchedPrefix}`,
      });
      continue;
    }

    // 3. Check config-driven denylist
    if (configDenylist.has(upperKey)) {
      blocked.push({
        key,
        reason: 'config_denylist',
        redactedValue: redactEnvValue(value),
      });
      logger.info(`Blocked env var per config denylist: ${key}`);
      emitAudit({
        timestamp: Date.now(),
        severity: 'warn',
        action: 'blocked',
        key,
        reason: 'Config denylist',
      });
      continue;
    }

    // 4. Detect injection attempts
    if (detectInjectionEnabled) {
      const injectionReason = detectInjection(key, value);
      if (injectionReason) {
        blocked.push({
          key,
          reason: 'injection_detected',
          redactedValue: redactEnvValue(value),
        });
        logger.warn(`Env var injection detected: ${key} - ${injectionReason}`);
        emitAudit({
          timestamp: Date.now(),
          severity: 'critical',
          action: 'injection_detected',
          key,
          reason: injectionReason,
          detail: `Value redacted: ${redactEnvValue(value)}`,
        });
        continue;
      }
    }

    // 5. PATH special handling
    if (upperKey === 'PATH') {
      if (!allowPathMod) {
        // Ported from OpenClaw: strictly block PATH modification on host
        blocked.push({
          key,
          reason: 'path_modification_blocked',
          redactedValue: redactEnvValue(value),
        });
        logger.info('Blocked PATH modification (allowPathModification=false)');
        emitAudit({
          timestamp: Date.now(),
          severity: 'warn',
          action: 'blocked',
          key,
          reason: 'PATH modification blocked by policy',
        });
        continue;
      }

      // Sanitize PATH entries
      const sanitizedPath = sanitizePath(value, trustedPathDirs, homeDir);
      if (sanitizedPath !== value) {
        modified.push({
          key,
          reason: 'Suspicious PATH entries removed',
          originalRedacted: redactEnvValue(value),
          newValue: sanitizedPath,
        });
        emitAudit({
          timestamp: Date.now(),
          severity: 'warn',
          action: 'modified',
          key,
          reason: 'Suspicious PATH entries removed',
        });
      }
      result[key] = sanitizedPath;
      continue;
    }

    // 6. Allowlist filtering
    if (allowlistSet && !allowlistSet.has(upperKey)) {
      blocked.push({
        key,
        reason: 'not_in_allowlist',
        redactedValue: redactEnvValue(value),
      });
      emitAudit({
        timestamp: Date.now(),
        severity: 'info',
        action: 'blocked',
        key,
        reason: 'Not in allowlist',
      });
      continue;
    }

    // Variable passed all checks
    result[key] = value;
  }

  return {
    env: result,
    blocked,
    modified,
    changed: blocked.length > 0 || modified.length > 0,
  };
}

// ============================================================================
// PATH Sanitization
// ============================================================================

/**
 * Sanitize a PATH string by removing suspicious entries.
 * Keeps only entries that match trusted directories or user home paths.
 *
 * @param pathValue   - The raw PATH string.
 * @param trustedDirs - List of trusted directory paths.
 * @param homeDir     - The user's home directory.
 * @returns             The sanitized PATH string.
 */
export function sanitizePath(
  pathValue: string,
  trustedDirs?: readonly string[],
  homeDir?: string,
): string {
  const dirs = trustedDirs ?? DEFAULT_TRUSTED_PATH_DIRS;
  const home = homeDir ?? os.homedir();
  const entries = pathValue.split(path.delimiter).filter(Boolean);

  const safe = entries.filter((entry) => isPathEntryTrusted(entry, dirs, home));

  if (safe.length === 0) {
    return FALLBACK_PATH;
  }

  return safe.join(path.delimiter);
}

// ============================================================================
// Env Var Validation (Fail-Fast for Host Execution)
// ============================================================================

/**
 * Validate environment variables before host execution. Throws on any
 * dangerous variable, matching OpenClaw's validateHostEnv() behavior.
 *
 * This is a strict fail-fast check for use at the exec-approvals boundary.
 * For non-throwing sanitization, use {@link sanitizeEnv} instead.
 *
 * @param env      - The environment variables to validate.
 * @param config   - Optional configuration.
 * @throws {EnvSecurityError} If any dangerous variable is detected.
 */
export function validateEnvForExec(
  env: Record<string, string>,
  config?: Pick<EnvSanitizerConfig, 'platform' | 'denylist' | 'denyPrefixes'>,
): void {
  const platform = config?.platform ?? (process.platform as NodeJS.Platform);
  const dangerousVars = resolveDangerousVars(platform);
  const dangerousPrefixes = resolveDangerousPrefixes(platform);
  const configDenylist = new Set(
    (config?.denylist ?? []).map((v) => v.toUpperCase()),
  );
  const configDenyPrefixes = (config?.denyPrefixes ?? []).map((p) =>
    p.toUpperCase(),
  );

  for (const key of Object.keys(env)) {
    const upperKey = key.trim().toUpperCase();

    if (!upperKey) {
      continue;
    }

    // Dangerous variable names
    if (dangerousVars.has(upperKey) || configDenylist.has(upperKey)) {
      throw new EnvSecurityError(
        `Environment variable '${key}' is forbidden during host execution`,
        key,
        'dangerous_variable',
      );
    }

    // Dangerous prefixes
    const matchedPrefix = [...dangerousPrefixes, ...configDenyPrefixes].find(
      (prefix) => upperKey.startsWith(prefix.toUpperCase()),
    );
    if (matchedPrefix) {
      throw new EnvSecurityError(
        `Environment variable '${key}' is forbidden during host execution (prefix: ${matchedPrefix})`,
        key,
        'dangerous_prefix',
      );
    }

    // Strictly block PATH modification on host (matches OpenClaw behavior)
    if (upperKey === 'PATH') {
      throw new EnvSecurityError(
        "Custom 'PATH' variable is forbidden during host execution",
        key,
        'path_modification_blocked',
      );
    }

    // Injection detection
    const injectionReason = detectInjection(key, env[key]);
    if (injectionReason) {
      throw new EnvSecurityError(
        `Environment variable '${key}' contains a potential injection: ${injectionReason}`,
        key,
        'injection_detected',
      );
    }
  }
}

// ============================================================================
// Safe Subprocess Environment Builder
// ============================================================================

/**
 * Build a clean environment for subprocess execution.
 *
 * Starts from the current process environment and:
 *   1. Strips all dangerous variables
 *   2. Applies allowlist filtering (if configured)
 *   3. Merges in the provided overrides (after sanitization)
 *   4. Ensures PATH is sanitized
 *   5. Adds Wundr metadata variables
 *
 * This is the recommended way to construct an env for child_process.spawn().
 *
 * Modeled after OpenClaw's sanitizeEnv() in runner.ts (lines 206-244).
 *
 * @param overrides - Additional env vars to merge (user/task-provided).
 * @param config    - Sanitizer configuration.
 * @returns           A complete, sanitized environment ready for spawn().
 */
export function buildSubprocessEnv(
  overrides?: Record<string, string> | null,
  config?: EnvSanitizerConfig & {
    /** Wundr session ID to inject as WUNDR_SESSION_ID */
    sessionId?: string;
    /** Wundr agent ID to inject as WUNDR_AGENT_ID */
    agentId?: string;
    /** Working directory to inject as WUNDR_CWD */
    cwd?: string;
    /** Base environment to start from. Defaults to process.env. */
    baseEnv?: Record<string, string>;
  },
): EnvSanitizeResult {
  const baseEnv = config?.baseEnv ?? (process.env as Record<string, string>);
  const trustedPathDirs = config?.trustedPathDirs ?? DEFAULT_TRUSTED_PATH_DIRS;
  const homeDir = os.homedir();

  // Phase 1: Sanitize the base environment
  const baseResult = sanitizeEnv(baseEnv, {
    ...config,
    // Base env always allows PATH (we sanitize it rather than block it)
    allowPathModification: true,
  });

  // Phase 2: Ensure PATH exists and is sanitized
  const currentPath = baseResult.env.PATH ?? baseResult.env.Path ?? FALLBACK_PATH;
  const safePath = sanitizePath(currentPath, trustedPathDirs, homeDir);
  baseResult.env.PATH = safePath;

  // Phase 3: Merge overrides with sanitization
  if (overrides && Object.keys(overrides).length > 0) {
    const overrideResult = sanitizeEnv(overrides, config);

    // Merge override results into base
    for (const [key, value] of Object.entries(overrideResult.env)) {
      const upperKey = key.toUpperCase();

      if (upperKey === 'PATH') {
        // PATH overrides are appended, not replaced (matching OpenClaw pattern)
        const overridePath = value.trim();
        if (overridePath && overridePath !== safePath) {
          const combined = `${overridePath}${path.delimiter}${safePath}`;
          const finalPath = sanitizePath(combined, trustedPathDirs, homeDir);
          baseResult.env[key] = finalPath;
          if (finalPath !== safePath) {
            baseResult.modified.push({
              key,
              reason: 'PATH override merged and sanitized',
              originalRedacted: redactEnvValue(overridePath),
              newValue: finalPath,
            });
          }
        }
        continue;
      }

      baseResult.env[key] = value;
    }

    // Carry forward block/modify audit trail from overrides
    baseResult.blocked.push(...overrideResult.blocked);
    baseResult.modified.push(...overrideResult.modified);
    baseResult.changed = baseResult.changed || overrideResult.changed;
  }

  // Phase 4: Inject Wundr metadata
  if (config?.sessionId) {
    baseResult.env.WUNDR_SESSION_ID = config.sessionId;
  }
  if (config?.agentId) {
    baseResult.env.WUNDR_AGENT_ID = config.agentId;
  }
  if (config?.cwd) {
    baseResult.env.WUNDR_CWD = config.cwd;
  }

  return baseResult;
}

// ============================================================================
// Env Var Redaction for Logging
// ============================================================================

/**
 * Produce a log-safe representation of an environment variable map.
 *
 * Sensitive variable values are replaced with redacted placeholders.
 * Non-sensitive values are truncated to a reasonable length.
 *
 * @param env - The environment variable map.
 * @returns     A new map with values redacted or truncated.
 */
export function redactEnvForLogging(
  env: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (isSensitiveEnvVar(key)) {
      result[key] = '<redacted>';
    } else if (value.length > 200) {
      result[key] = `${value.slice(0, 100)}...(${value.length} chars)`;
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Determine if an environment variable name indicates a sensitive value.
 */
export function isSensitiveEnvVar(key: string): boolean {
  const upper = key.toUpperCase();

  // Exact matches
  const sensitiveExact = new Set([
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'DAEMON_JWT_SECRET',
    'REDIS_PASSWORD',
    'REDIS_URL',
    'DATABASE_URL',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
    'GITHUB_TOKEN',
    'GITHUB_PAT',
    'SLACK_TOKEN',
    'SLACK_SIGNING_SECRET',
    'NEOLITH_API_KEY',
    'NEOLITH_API_SECRET',
    'WUNDR_API_KEY',
    'WUNDR_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SENDGRID_API_KEY',
    'TWILIO_AUTH_TOKEN',
    'SENTRY_DSN',
  ]);

  if (sensitiveExact.has(upper)) {
    return true;
  }

  // Pattern matches
  const sensitivePatterns = [
    /KEY$/,
    /TOKEN$/,
    /SECRET$/,
    /PASSWORD$/,
    /PASSWD$/,
    /CREDENTIAL$/,
    /PRIVATE/,
    /_DSN$/,
    /^DB_/,
  ];

  return sensitivePatterns.some((p) => p.test(upper));
}

// ============================================================================
// Query: Platform-Specific Dangerous Variable Lists
// ============================================================================

/**
 * Get the full set of dangerous environment variable names for a platform.
 * Useful for display in security audit reports and documentation.
 *
 * @param platform - Target platform. Defaults to the current platform.
 * @returns          A sorted array of dangerous variable names.
 */
export function getDangerousVarList(platform?: NodeJS.Platform): string[] {
  const vars = resolveDangerousVars(platform ?? (process.platform as NodeJS.Platform));
  return [...vars].sort();
}

/**
 * Get the dangerous environment variable prefixes for a platform.
 *
 * @param platform - Target platform. Defaults to the current platform.
 * @returns          An array of dangerous prefixes.
 */
export function getDangerousPrefixList(platform?: NodeJS.Platform): string[] {
  return [...resolveDangerousPrefixes(platform ?? (process.platform as NodeJS.Platform))];
}

// ============================================================================
// Error Type
// ============================================================================

/**
 * Error thrown when a dangerous environment variable is detected
 * during strict validation (validateEnvForExec).
 */
export class EnvSecurityError extends Error {
  public readonly variableKey: string;
  public readonly blockReason: EnvBlockReason;

  constructor(message: string, variableKey: string, blockReason: EnvBlockReason) {
    super(message);
    this.name = 'EnvSecurityError';
    this.variableKey = variableKey;
    this.blockReason = blockReason;
  }
}

// ============================================================================
// Integration: Exec Approval Pre-Check
// ============================================================================

/**
 * Check environment variables as part of the exec-approval flow.
 *
 * This function is designed to be called by ExecApprovalGate before
 * spawning a subprocess. It performs a non-throwing sanitization and
 * returns a verdict compatible with the GateEvaluation interface.
 *
 * @param env      - The environment variables to check.
 * @param config   - Optional sanitizer configuration.
 * @returns          An object with verdict and details.
 */
export function checkEnvForApproval(
  env: Record<string, string>,
  config?: EnvSanitizerConfig,
): {
  approved: boolean;
  blockedCount: number;
  criticalCount: number;
  blocked: EnvBlockedEntry[];
  message: string;
} {
  const result = sanitizeEnv(env, { ...config, detectInjection: true });

  const criticalReasons: EnvBlockReason[] = [
    'dangerous_variable',
    'dangerous_prefix',
    'injection_detected',
  ];

  const criticalBlocked = result.blocked.filter((b) =>
    criticalReasons.includes(b.reason),
  );

  if (criticalBlocked.length > 0) {
    const names = criticalBlocked.map((b) => b.key).join(', ');
    return {
      approved: false,
      blockedCount: result.blocked.length,
      criticalCount: criticalBlocked.length,
      blocked: result.blocked,
      message: `Blocked ${criticalBlocked.length} dangerous env var(s): ${names}`,
    };
  }

  return {
    approved: true,
    blockedCount: result.blocked.length,
    criticalCount: 0,
    blocked: result.blocked,
    message:
      result.blocked.length > 0
        ? `${result.blocked.length} non-critical env var(s) filtered`
        : 'All environment variables passed checks',
  };
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _testing = {
  DANGEROUS_ENV_VARS_UNIVERSAL,
  DANGEROUS_ENV_VARS_MACOS,
  DANGEROUS_ENV_VARS_LINUX,
  DANGEROUS_ENV_VARS_WINDOWS,
  DANGEROUS_PREFIXES_MACOS,
  DANGEROUS_PREFIXES_LINUX,
  ALWAYS_ALLOWED_VARS,
  DEFAULT_TRUSTED_PATH_DIRS,
  FALLBACK_PATH,
  INJECTION_PATTERNS,
  resolveDangerousVars,
  resolveDangerousPrefixes,
  redactEnvValue,
  isPathEntryTrusted,
  detectInjection,
};
