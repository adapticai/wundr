/**
 * Config Loader: File + Environment Loading, Validation, Caching, Snapshots
 *
 * Ported from OpenClaw's io.ts. Supports both JSON5 file-based configuration
 * and environment variable overrides. Provides a validated, cached singleton
 * config with snapshot support for the config watcher.
 *
 * @module @wundr/orchestrator-daemon/config/config-loader
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  resolveConfigIncludes,
  resolveEnvVars,
  applyOverrides,
  deepMerge,
  type IncludeResolver,
  ConfigIncludeError,
  MissingEnvVarError,
} from './config-merger';
import {
  type WundrConfig,
  type ConfigValidationIssue,
  WundrConfigSchema,
  CURRENT_CONFIG_VERSION,
  validateConfig,
} from './schemas';

// Re-export error types for consumer convenience
export { ConfigIncludeError, MissingEnvVarError } from './config-merger';

// =============================================================================
// Types
// =============================================================================

export interface ConfigSnapshot {
  /** Resolved config file path */
  path: string;
  /** Whether the config file exists */
  exists: boolean;
  /** Raw file content (null if file does not exist) */
  raw: string | null;
  /** Parsed JSON before validation */
  parsed: unknown;
  /** Whether the config is valid */
  valid: boolean;
  /** The validated + defaulted config object */
  config: WundrConfig;
  /** SHA-256 hash of the raw content (for change detection) */
  hash: string;
  /** Validation issues (empty if valid) */
  issues: ConfigValidationIssue[];
  /** Non-fatal warnings */
  warnings: ConfigValidationIssue[];
}

export interface ConfigLoadOptions {
  /** Override config file path */
  configPath?: string;
  /** Override environment variables */
  env?: NodeJS.ProcessEnv;
  /** Override home directory resolver */
  homedir?: () => string;
  /** Override filesystem */
  fs?: typeof fs;
  /** Override JSON parser (for JSON5 support) */
  jsonParser?: { parse: (raw: string) => unknown };
  /** Logger for warnings/errors */
  logger?: Pick<typeof console, 'error' | 'warn'>;
}

export interface ConfigMigration {
  /** Version this migration upgrades FROM */
  fromVersion: number;
  /** Version this migration upgrades TO */
  toVersion: number;
  /** Human-readable description */
  description: string;
  /** Migration function (pure: returns new config, does not mutate) */
  migrate: (config: unknown) => unknown;
}

// =============================================================================
// Constants
// =============================================================================

const CONFIG_FILE_NAMES = [
  'wundr.config.json5',
  'wundr.config.json',
  '.wundr/config.json5',
  '.wundr/config.json',
];

const DEFAULT_STATE_DIR_NAME = '.wundr';
const CONFIG_BACKUP_COUNT = 5;
const DEFAULT_CONFIG_CACHE_MS = 200;

// =============================================================================
// Migration Registry
// =============================================================================

const migrations: ConfigMigration[] = [
  // Example migration: version 1 -> 2
  // {
  //   fromVersion: 1,
  //   toVersion: 2,
  //   description: 'Rename daemon.shutdownTimeout to daemon.shutdownTimeoutMs',
  //   migrate: (config: unknown) => {
  //     if (!config || typeof config !== 'object') return config;
  //     const c = config as Record<string, unknown>;
  //     const daemon = c.daemon as Record<string, unknown> | undefined;
  //     if (daemon && 'shutdownTimeout' in daemon) {
  //       daemon.shutdownTimeoutMs = daemon.shutdownTimeout;
  //       delete daemon.shutdownTimeout;
  //     }
  //     return c;
  //   },
  // },
];

/**
 * Register a config migration. Migrations must be registered in order
 * (fromVersion must match the previous migration's toVersion).
 */
export function registerMigration(migration: ConfigMigration): void {
  migrations.push(migration);
  migrations.sort((a, b) => a.fromVersion - b.fromVersion);
}

/**
 * Apply all applicable migrations to a config object.
 * Returns the migrated config and a list of applied migration descriptions.
 */
export function applyMigrations(config: unknown): {
  config: unknown;
  applied: string[];
} {
  if (!config || typeof config !== 'object') {
    return { config, applied: [] };
  }

  const configObj = config as Record<string, unknown>;
  const meta = configObj.meta as Record<string, unknown> | undefined;
  let version = typeof meta?.$version === 'number' ? meta.$version : 1;
  let current: unknown = config;
  const applied: string[] = [];

  for (const migration of migrations) {
    if (migration.fromVersion === version) {
      current = migration.migrate(current);
      version = migration.toVersion;
      applied.push(
        `v${migration.fromVersion} -> v${migration.toVersion}: ${migration.description}`
      );
    }
  }

  // Stamp the current version
  if (applied.length > 0 && current && typeof current === 'object') {
    const c = current as Record<string, unknown>;
    c.meta = {
      ...((c.meta as Record<string, unknown>) ?? {}),
      $version: CURRENT_CONFIG_VERSION,
    };
  }

  return { config: current, applied };
}

// =============================================================================
// Path Resolution
// =============================================================================

function resolveStateDir(
  env: NodeJS.ProcessEnv,
  homedir: () => string
): string {
  if (env.WUNDR_STATE_DIR?.trim()) {
    return env.WUNDR_STATE_DIR.trim();
  }
  return path.join(homedir(), DEFAULT_STATE_DIR_NAME);
}

function resolveConfigPath(env: NodeJS.ProcessEnv, stateDir: string): string {
  if (env.WUNDR_CONFIG_PATH?.trim()) {
    return env.WUNDR_CONFIG_PATH.trim();
  }
  return path.join(stateDir, 'config.json5');
}

function resolveConfigCandidates(
  env: NodeJS.ProcessEnv,
  homedir: () => string
): string[] {
  const stateDir = resolveStateDir(env, homedir);
  const candidates: string[] = [resolveConfigPath(env, stateDir)];

  // Check workspace-local configs
  const cwd = env.WUNDR_WORKSPACE ?? process.cwd();
  for (const name of CONFIG_FILE_NAMES) {
    candidates.push(path.join(cwd, name));
  }

  return candidates;
}

// =============================================================================
// Hash Utility
// =============================================================================

function hashConfigRaw(raw: string | null): string {
  return crypto
    .createHash('sha256')
    .update(raw ?? '')
    .digest('hex');
}

export function resolveConfigSnapshotHash(snapshot: {
  hash?: string;
  raw?: string | null;
}): string | null {
  if (typeof snapshot.hash === 'string') {
    const trimmed = snapshot.hash.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  if (typeof snapshot.raw !== 'string') {
    return null;
  }
  return hashConfigRaw(snapshot.raw);
}

// =============================================================================
// Env-Based Config Building (backward compat)
// =============================================================================

function parseBoolean(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseArray(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map(v => v.trim())
    .filter(v => v.length > 0);
}

/**
 * Build a raw config object from environment variables.
 * This provides backward compatibility with the existing env-var-based config.
 */
function buildConfigFromEnv(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const raw: Record<string, unknown> = {};

  // OpenAI (required)
  if (env.OPENAI_API_KEY) {
    raw.openai = {
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      organization: env.OPENAI_ORG_ID || undefined,
      baseUrl: env.OPENAI_BASE_URL || undefined,
    };
  }

  // Anthropic (optional)
  if (env.ANTHROPIC_API_KEY) {
    raw.anthropic = {
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
    };
  }

  // Daemon
  raw.daemon = {
    name: env.DAEMON_NAME || undefined,
    port: env.DAEMON_PORT ? parseNumber(env.DAEMON_PORT, 8787) : undefined,
    host: env.DAEMON_HOST || undefined,
    maxSessions: env.DAEMON_MAX_SESSIONS
      ? parseNumber(env.DAEMON_MAX_SESSIONS, 100)
      : undefined,
    verbose: env.DAEMON_VERBOSE
      ? parseBoolean(env.DAEMON_VERBOSE, false)
      : undefined,
    shutdownTimeoutMs: env.DAEMON_SHUTDOWN_TIMEOUT
      ? parseNumber(env.DAEMON_SHUTDOWN_TIMEOUT, 10000)
      : undefined,
    heartbeatIntervalMs: env.DAEMON_HEARTBEAT_INTERVAL
      ? parseNumber(env.DAEMON_HEARTBEAT_INTERVAL, 30000)
      : undefined,
    healthCheckIntervalMs: env.DAEMON_HEALTH_CHECK_INTERVAL
      ? parseNumber(env.DAEMON_HEALTH_CHECK_INTERVAL, 60000)
      : undefined,
  };

  // Security
  if (
    env.DAEMON_JWT_SECRET ||
    env.DAEMON_CORS_ENABLED ||
    env.DAEMON_RATE_LIMIT_ENABLED
  ) {
    raw.security = {
      jwt: env.DAEMON_JWT_SECRET
        ? {
            secret: env.DAEMON_JWT_SECRET,
            expiration: env.DAEMON_JWT_EXPIRATION || '24h',
          }
        : undefined,
      cors: {
        enabled: parseBoolean(env.DAEMON_CORS_ENABLED, false),
        origins: parseArray(env.DAEMON_CORS_ORIGINS),
      },
      rateLimit: {
        enabled: parseBoolean(env.DAEMON_RATE_LIMIT_ENABLED, true),
        max: parseNumber(env.DAEMON_RATE_LIMIT_MAX, 100),
        windowMs: parseNumber(env.DAEMON_RATE_LIMIT_WINDOW, 60000),
      },
    };
  }

  // Logging
  if (env.LOG_LEVEL || env.LOG_FORMAT || env.LOG_FILE) {
    raw.logging = {
      level: env.LOG_LEVEL || undefined,
      format: env.LOG_FORMAT || undefined,
      file: env.LOG_FILE || undefined,
      rotation: {
        enabled: parseBoolean(env.LOG_ROTATION_ENABLED, true),
        maxSizeMB: parseNumber(env.LOG_MAX_SIZE, 10),
        maxFiles: parseNumber(env.LOG_MAX_FILES, 5),
      },
    };
  }

  // Monitoring
  if (env.METRICS_ENABLED || env.METRICS_PORT || env.HEALTH_CHECK_ENABLED) {
    raw.monitoring = {
      metrics: {
        enabled: parseBoolean(env.METRICS_ENABLED, true),
        port: parseNumber(env.METRICS_PORT, 9090),
        path: env.METRICS_PATH || '/metrics',
      },
      healthCheck: {
        enabled: parseBoolean(env.HEALTH_CHECK_ENABLED, true),
        path: env.HEALTH_CHECK_PATH || '/health',
      },
    };
  }

  // Memory
  if (
    env.DAEMON_MAX_HEAP_MB ||
    env.DAEMON_MAX_CONTEXT_TOKENS ||
    env.MEMORY_COMPACTION_ENABLED
  ) {
    raw.memory = {
      maxHeapMB: parseNumber(env.DAEMON_MAX_HEAP_MB, 2048),
      maxContextTokens: parseNumber(env.DAEMON_MAX_CONTEXT_TOKENS, 128000),
      compaction: {
        enabled: parseBoolean(env.MEMORY_COMPACTION_ENABLED, true),
        threshold: parseFloat(env.MEMORY_COMPACTION_THRESHOLD || '0.8'),
      },
    };
  }

  // Token Budget
  if (
    env.TOKEN_BUDGET_DAILY ||
    env.TOKEN_BUDGET_WEEKLY ||
    env.TOKEN_BUDGET_MONTHLY
  ) {
    raw.tokenBudget = {
      daily: parseNumber(env.TOKEN_BUDGET_DAILY, 1000000),
      weekly: parseNumber(env.TOKEN_BUDGET_WEEKLY, 5000000),
      monthly: parseNumber(env.TOKEN_BUDGET_MONTHLY, 20000000),
      alerts: {
        enabled: parseBoolean(env.TOKEN_BUDGET_ALERTS_ENABLED, true),
        threshold: parseFloat(env.TOKEN_BUDGET_ALERT_THRESHOLD || '0.8'),
      },
    };
  }

  // Redis (optional)
  if (env.REDIS_URL) {
    raw.redis = {
      url: env.REDIS_URL,
      password: env.REDIS_PASSWORD || undefined,
      db: parseNumber(env.REDIS_DB, 0),
      connectTimeoutMs: parseNumber(env.REDIS_CONNECT_TIMEOUT, 5000),
    };
  }

  // Database (optional)
  if (env.DATABASE_URL) {
    raw.database = {
      url: env.DATABASE_URL,
      poolSize: parseNumber(env.DATABASE_POOL_SIZE, 10),
      connectTimeoutMs: parseNumber(env.DATABASE_CONNECT_TIMEOUT, 5000),
    };
  }

  // Distributed (optional)
  if (env.CLUSTER_NAME || env.REDIS_URL) {
    raw.distributed = {
      clusterName: env.CLUSTER_NAME || 'orchestrator-cluster',
      loadBalancingStrategy: env.LOAD_BALANCING_STRATEGY || 'least-loaded',
      rebalanceIntervalMs: parseNumber(env.REBALANCE_INTERVAL, 300000),
      migrationTimeoutMs: parseNumber(env.MIGRATION_TIMEOUT, 30000),
    };
  }

  // Neolith (optional)
  if (env.NEOLITH_API_URL) {
    raw.neolith = {
      apiUrl: env.NEOLITH_API_URL,
      apiKey: env.NEOLITH_API_KEY || undefined,
      apiSecret: env.NEOLITH_API_SECRET || undefined,
    };
  }

  // Global
  if (env.NODE_ENV) {
    raw.nodeEnv = env.NODE_ENV;
  }
  if (env.DEBUG) {
    raw.debug = parseBoolean(env.DEBUG, false);
  }

  // Remove undefined top-level keys
  for (const key of Object.keys(raw)) {
    if (raw[key] === undefined) {
      delete raw[key];
    }
    if (typeof raw[key] === 'object' && raw[key] !== null) {
      const obj = raw[key] as Record<string, unknown>;
      for (const k of Object.keys(obj)) {
        if (obj[k] === undefined) {
          delete obj[k];
        }
      }
    }
  }

  return raw;
}

// =============================================================================
// Backup Rotation
// =============================================================================

async function rotateConfigBackups(
  configPath: string,
  ioFs: typeof fs.promises
): Promise<void> {
  if (CONFIG_BACKUP_COUNT <= 1) {
    return;
  }
  const backupBase = `${configPath}.bak`;
  const maxIndex = CONFIG_BACKUP_COUNT - 1;

  await ioFs.unlink(`${backupBase}.${maxIndex}`).catch(() => {});
  for (let index = maxIndex - 1; index >= 1; index -= 1) {
    await ioFs
      .rename(`${backupBase}.${index}`, `${backupBase}.${index + 1}`)
      .catch(() => {});
  }
  await ioFs.rename(backupBase, `${backupBase}.1`).catch(() => {});
}

// =============================================================================
// Config IO Factory
// =============================================================================

function normalizeDeps(
  overrides: ConfigLoadOptions = {}
): Required<Omit<ConfigLoadOptions, 'configPath'> & { configPath: string }> {
  const env = overrides.env ?? process.env;
  const homedir = overrides.homedir ?? os.homedir;
  const ioFs = overrides.fs ?? fs;
  const jsonParser = overrides.jsonParser ?? JSON;
  const logger = overrides.logger ?? console;

  // Resolve config path
  let configPath = overrides.configPath ?? '';
  if (!configPath) {
    const candidates = resolveConfigCandidates(env, homedir);
    configPath =
      candidates.find(c => ioFs.existsSync(c)) ??
      resolveConfigPath(env, resolveStateDir(env, homedir));
  }

  return { configPath, env, homedir, fs: ioFs, jsonParser, logger };
}

/**
 * Create a config I/O interface with dependency injection.
 *
 * The returned object provides loadConfig, readConfigSnapshot, and writeConfig
 * methods bound to the resolved config file path.
 */
export function createConfigIO(overrides: ConfigLoadOptions = {}) {
  const deps = normalizeDeps(overrides);
  const { configPath } = deps;

  /**
   * Load and validate the config. Merges file config + env overrides.
   */
  function loadConfig(): WundrConfig {
    try {
      // Build env-based config
      const envConfig = buildConfigFromEnv(deps.env);

      // Load file config if it exists
      let fileConfig: Record<string, unknown> = {};
      if (deps.fs.existsSync(configPath)) {
        const raw = deps.fs.readFileSync(configPath, 'utf-8');
        const parsed = deps.jsonParser.parse(raw);

        // Resolve $include directives
        const resolver: IncludeResolver = {
          readFile: p => deps.fs.readFileSync(p, 'utf-8'),
          parseJson: r => deps.jsonParser.parse(r),
        };
        const resolved = resolveConfigIncludes(parsed, configPath, resolver);

        // Apply migrations
        const { config: migrated } = applyMigrations(resolved);

        // Substitute env vars
        const substituted = resolveEnvVars(migrated, deps.env);

        if (substituted && typeof substituted === 'object') {
          fileConfig = substituted as Record<string, unknown>;
        }
      }

      // Merge: file config as base, env config as override
      const merged = deepMerge(fileConfig, envConfig);

      // Validate
      const result = validateConfig(merged);
      if (!result.ok) {
        const details = result.issues
          .map(iss => `- ${iss.path}: ${iss.message}`)
          .join('\n');
        deps.logger.error(`Invalid config at ${configPath}:\n${details}`);
        const error = new Error(
          `Configuration validation failed:\n${details}\n\n` +
            'Please check your config file or environment variables.'
        );
        (error as { code?: string }).code = 'INVALID_CONFIG';
        throw error;
      }

      if (result.warnings.length > 0) {
        const details = result.warnings
          .map(w => `- ${w.path}: ${w.message}`)
          .join('\n');
        deps.logger.warn(`Config warnings:\n${details}`);
      }

      // Apply runtime overrides
      return applyOverrides(result.config);
    } catch (err) {
      if ((err as { code?: string })?.code === 'INVALID_CONFIG') {
        throw err;
      }
      deps.logger.error(`Failed to read config at ${configPath}`, err);
      throw err;
    }
  }

  /**
   * Read the config file and return a full snapshot with metadata.
   * Used by the config watcher for change detection.
   */
  async function readConfigSnapshot(): Promise<ConfigSnapshot> {
    const exists = deps.fs.existsSync(configPath);

    if (!exists) {
      const hash = hashConfigRaw(null);
      const config = WundrConfigSchema.parse({
        openai: { apiKey: deps.env.OPENAI_API_KEY || 'not-set' },
      });
      return {
        path: configPath,
        exists: false,
        raw: null,
        parsed: {},
        valid: true,
        config: applyOverrides(config),
        hash,
        issues: [],
        warnings: [],
      };
    }

    try {
      const raw = deps.fs.readFileSync(configPath, 'utf-8');
      const hash = hashConfigRaw(raw);

      // Parse
      let parsed: unknown;
      try {
        parsed = deps.jsonParser.parse(raw);
      } catch (parseErr) {
        return {
          path: configPath,
          exists: true,
          raw,
          parsed: {},
          valid: false,
          config: WundrConfigSchema.parse({
            openai: { apiKey: deps.env.OPENAI_API_KEY || 'not-set' },
          }),
          hash,
          issues: [
            {
              path: '',
              message: `JSON parse failed: ${String(parseErr)}`,
            },
          ],
          warnings: [],
        };
      }

      // Resolve includes
      let resolved: unknown;
      try {
        const resolver: IncludeResolver = {
          readFile: p => deps.fs.readFileSync(p, 'utf-8'),
          parseJson: r => deps.jsonParser.parse(r),
        };
        resolved = resolveConfigIncludes(parsed, configPath, resolver);
      } catch (includeErr) {
        const message =
          includeErr instanceof ConfigIncludeError
            ? includeErr.message
            : `Include resolution failed: ${String(includeErr)}`;
        return {
          path: configPath,
          exists: true,
          raw,
          parsed,
          valid: false,
          config: WundrConfigSchema.parse({
            openai: { apiKey: deps.env.OPENAI_API_KEY || 'not-set' },
          }),
          hash,
          issues: [{ path: '', message }],
          warnings: [],
        };
      }

      // Apply migrations
      const { config: migrated } = applyMigrations(resolved);

      // Env var substitution
      let substituted: unknown;
      try {
        substituted = resolveEnvVars(migrated, deps.env);
      } catch (envErr) {
        const message =
          envErr instanceof MissingEnvVarError
            ? envErr.message
            : `Env var substitution failed: ${String(envErr)}`;
        return {
          path: configPath,
          exists: true,
          raw,
          parsed,
          valid: false,
          config: WundrConfigSchema.parse({
            openai: { apiKey: deps.env.OPENAI_API_KEY || 'not-set' },
          }),
          hash,
          issues: [{ path: '', message }],
          warnings: [],
        };
      }

      // Merge with env config
      const envConfig = buildConfigFromEnv(deps.env);
      const merged = deepMerge(substituted, envConfig);

      // Validate
      const validated = validateConfig(merged);
      if (!validated.ok) {
        return {
          path: configPath,
          exists: true,
          raw,
          parsed,
          valid: false,
          config: validated.config,
          hash,
          issues: validated.issues,
          warnings: validated.warnings,
        };
      }

      return {
        path: configPath,
        exists: true,
        raw,
        parsed,
        valid: true,
        config: applyOverrides(validated.config),
        hash,
        issues: [],
        warnings: validated.warnings,
      };
    } catch (err) {
      return {
        path: configPath,
        exists: true,
        raw: null,
        parsed: {},
        valid: false,
        config: WundrConfigSchema.parse({
          openai: { apiKey: deps.env.OPENAI_API_KEY || 'not-set' },
        }),
        hash: hashConfigRaw(null),
        issues: [{ path: '', message: `read failed: ${String(err)}` }],
        warnings: [],
      };
    }
  }

  /**
   * Write a validated config to disk with backup rotation.
   */
  async function writeConfig(cfg: WundrConfig): Promise<void> {
    clearConfigCache();

    const result = validateConfig(cfg);
    if (!result.ok) {
      const issue = result.issues[0];
      const pathLabel = issue?.path || '<root>';
      throw new Error(
        `Config validation failed: ${pathLabel}: ${issue?.message ?? 'invalid'}`
      );
    }

    if (result.warnings.length > 0) {
      const details = result.warnings
        .map(w => `- ${w.path}: ${w.message}`)
        .join('\n');
      deps.logger.warn(`Config warnings:\n${details}`);
    }

    const dir = path.dirname(configPath);
    await deps.fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });

    // Stamp version
    const stamped = {
      ...cfg,
      meta: {
        ...cfg.meta,
        $version: CURRENT_CONFIG_VERSION,
        lastTouchedAt: new Date().toISOString(),
      },
    };

    const json = JSON.stringify(stamped, null, 2).trimEnd().concat('\n');

    // Atomic write via temp file
    const tmp = path.join(
      dir,
      `${path.basename(configPath)}.${process.pid}.${crypto.randomUUID()}.tmp`
    );

    await deps.fs.promises.writeFile(tmp, json, {
      encoding: 'utf-8',
      mode: 0o600,
    });

    // Rotate backups
    if (deps.fs.existsSync(configPath)) {
      await rotateConfigBackups(configPath, deps.fs.promises);
      await deps.fs.promises
        .copyFile(configPath, `${configPath}.bak`)
        .catch(() => {});
    }

    // Atomic rename
    try {
      await deps.fs.promises.rename(tmp, configPath);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'EPERM' || code === 'EEXIST') {
        await deps.fs.promises.copyFile(tmp, configPath);
        await deps.fs.promises.chmod(configPath, 0o600).catch(() => {});
        await deps.fs.promises.unlink(tmp).catch(() => {});
        return;
      }
      await deps.fs.promises.unlink(tmp).catch(() => {});
      throw err;
    }
  }

  return {
    configPath,
    loadConfig,
    readConfigSnapshot,
    writeConfig,
  };
}

// =============================================================================
// Singleton / Cache
// =============================================================================

let configCache: {
  configPath: string;
  expiresAt: number;
  config: WundrConfig;
} | null = null;

function resolveConfigCacheMs(env: NodeJS.ProcessEnv): number {
  const raw = env.WUNDR_CONFIG_CACHE_MS?.trim();
  if (raw === '' || raw === '0') {
    return 0;
  }
  if (!raw) {
    return DEFAULT_CONFIG_CACHE_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONFIG_CACHE_MS;
  }
  return Math.max(0, parsed);
}

function shouldUseConfigCache(env: NodeJS.ProcessEnv): boolean {
  if (env.WUNDR_DISABLE_CONFIG_CACHE?.trim()) {
    return false;
  }
  return resolveConfigCacheMs(env) > 0;
}

function clearConfigCache(): void {
  configCache = null;
}

/**
 * Load the config with caching.
 *
 * Uses a short-lived cache (200ms by default) to avoid re-reading the file
 * on every access. Disable with WUNDR_DISABLE_CONFIG_CACHE=1.
 */
export function loadConfig(opts?: ConfigLoadOptions): WundrConfig {
  const io = createConfigIO(opts);
  const now = Date.now();

  if (shouldUseConfigCache(opts?.env ?? process.env)) {
    const cached = configCache;
    if (
      cached &&
      cached.configPath === io.configPath &&
      cached.expiresAt > now
    ) {
      return cached.config;
    }
  }

  const config = io.loadConfig();

  if (shouldUseConfigCache(opts?.env ?? process.env)) {
    const cacheMs = resolveConfigCacheMs(opts?.env ?? process.env);
    if (cacheMs > 0) {
      configCache = {
        configPath: io.configPath,
        expiresAt: now + cacheMs,
        config,
      };
    }
  }

  return config;
}

/**
 * Read a config snapshot (no caching).
 */
export async function readConfigSnapshot(
  opts?: ConfigLoadOptions
): Promise<ConfigSnapshot> {
  return createConfigIO(opts).readConfigSnapshot();
}

/**
 * Write config to disk (clears cache).
 */
export async function writeConfig(
  cfg: WundrConfig,
  opts?: ConfigLoadOptions
): Promise<void> {
  clearConfigCache();
  return createConfigIO(opts).writeConfig(cfg);
}

// =============================================================================
// Singleton
// =============================================================================

let singletonInstance: WundrConfig | null = null;

/**
 * Get the singleton config instance (lazy-loaded on first access).
 */
export function getConfig(): WundrConfig {
  if (!singletonInstance) {
    singletonInstance = loadConfig();
  }
  return singletonInstance;
}

/**
 * Reset the singleton config instance (useful for testing).
 */
export function resetConfig(): void {
  singletonInstance = null;
  clearConfigCache();
}

/**
 * Validate that the minimum required environment variables are set.
 * Useful for early startup validation before loading the full config.
 */
export function validateRequiredEnv(
  env: NodeJS.ProcessEnv = process.env
): void {
  const required = ['OPENAI_API_KEY'];
  const missing: string[] = [];

  for (const key of required) {
    if (!env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  - ${missing.join('\n  - ')}\n\n` +
        'Please set these in your environment or create a .env file.\n' +
        'See .env.example for reference.'
    );
  }
}
