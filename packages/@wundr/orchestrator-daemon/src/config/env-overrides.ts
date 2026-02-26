/**
 * WUNDR_* Environment Variable Override System
 *
 * Maps WUNDR_* prefixed environment variables to config paths using a
 * structured naming convention. This allows any config value to be
 * overridden via environment variables without a config file.
 *
 * Naming Convention:
 *   WUNDR_{SECTION}_{KEY} -> config.{section}.{key}
 *
 * Examples:
 *   WUNDR_DAEMON_PORT=9090           -> daemon.port = 9090
 *   WUNDR_DAEMON_HOST=0.0.0.0       -> daemon.host = "0.0.0.0"
 *   WUNDR_SECURITY_JWT_SECRET=xxx   -> security.jwt.secret = "xxx"
 *   WUNDR_MEMORY_MAX_HEAP_MB=4096   -> memory.maxHeapMB = 4096
 *   WUNDR_LOGGING_LEVEL=debug       -> logging.level = "debug"
 *
 * Type coercion:
 *   - "true" / "false" -> boolean
 *   - Numeric strings -> number (when the schema expects a number)
 *   - Comma-separated strings -> array (when the schema expects an array)
 *
 * @module @wundr/orchestrator-daemon/config/env-overrides
 */

// =============================================================================
// Types
// =============================================================================

export interface EnvOverrideMapping {
  /** Environment variable name (e.g. WUNDR_DAEMON_PORT) */
  envKey: string;
  /** Dot-path in the config (e.g. daemon.port) */
  configPath: string;
  /** Type coercion hint */
  type: 'string' | 'number' | 'boolean' | 'string[]';
}

// =============================================================================
// Static Mappings
// =============================================================================

/**
 * Well-known WUNDR_* environment variable mappings.
 *
 * These provide explicit, documented override points. Variables not in this
 * list are handled by the dynamic prefix-stripping algorithm below.
 */
const STATIC_MAPPINGS: EnvOverrideMapping[] = [
  // --- Daemon ---
  { envKey: 'WUNDR_DAEMON_NAME', configPath: 'daemon.name', type: 'string' },
  { envKey: 'WUNDR_DAEMON_PORT', configPath: 'daemon.port', type: 'number' },
  { envKey: 'WUNDR_DAEMON_HOST', configPath: 'daemon.host', type: 'string' },
  {
    envKey: 'WUNDR_DAEMON_MAX_SESSIONS',
    configPath: 'daemon.maxSessions',
    type: 'number',
  },
  {
    envKey: 'WUNDR_DAEMON_VERBOSE',
    configPath: 'daemon.verbose',
    type: 'boolean',
  },
  {
    envKey: 'WUNDR_DAEMON_SHUTDOWN_TIMEOUT_MS',
    configPath: 'daemon.shutdownTimeoutMs',
    type: 'number',
  },
  {
    envKey: 'WUNDR_DAEMON_HEARTBEAT_INTERVAL_MS',
    configPath: 'daemon.heartbeatIntervalMs',
    type: 'number',
  },
  {
    envKey: 'WUNDR_DAEMON_HEALTH_CHECK_INTERVAL_MS',
    configPath: 'daemon.healthCheckIntervalMs',
    type: 'number',
  },
  {
    envKey: 'WUNDR_DAEMON_RELOAD_MODE',
    configPath: 'daemon.reload.mode',
    type: 'string',
  },
  {
    envKey: 'WUNDR_DAEMON_RELOAD_DEBOUNCE_MS',
    configPath: 'daemon.reload.debounceMs',
    type: 'number',
  },

  // --- Security ---
  {
    envKey: 'WUNDR_SECURITY_JWT_SECRET',
    configPath: 'security.jwt.secret',
    type: 'string',
  },
  {
    envKey: 'WUNDR_SECURITY_JWT_EXPIRATION',
    configPath: 'security.jwt.expiration',
    type: 'string',
  },
  {
    envKey: 'WUNDR_SECURITY_JWT_ISSUER',
    configPath: 'security.jwt.issuer',
    type: 'string',
  },
  {
    envKey: 'WUNDR_SECURITY_JWT_AUDIENCE',
    configPath: 'security.jwt.audience',
    type: 'string',
  },
  {
    envKey: 'WUNDR_SECURITY_CORS_ENABLED',
    configPath: 'security.cors.enabled',
    type: 'boolean',
  },
  {
    envKey: 'WUNDR_SECURITY_CORS_ORIGINS',
    configPath: 'security.cors.origins',
    type: 'string[]',
  },
  {
    envKey: 'WUNDR_SECURITY_RATE_LIMIT_ENABLED',
    configPath: 'security.rateLimit.enabled',
    type: 'boolean',
  },
  {
    envKey: 'WUNDR_SECURITY_RATE_LIMIT_MAX',
    configPath: 'security.rateLimit.max',
    type: 'number',
  },
  {
    envKey: 'WUNDR_SECURITY_RATE_LIMIT_WINDOW_MS',
    configPath: 'security.rateLimit.windowMs',
    type: 'number',
  },
  {
    envKey: 'WUNDR_SECURITY_AUDIT_ENABLED',
    configPath: 'security.audit.enabled',
    type: 'boolean',
  },

  // --- Memory ---
  {
    envKey: 'WUNDR_MEMORY_BACKEND',
    configPath: 'memory.backend',
    type: 'string',
  },
  {
    envKey: 'WUNDR_MEMORY_MAX_HEAP_MB',
    configPath: 'memory.maxHeapMB',
    type: 'number',
  },
  {
    envKey: 'WUNDR_MEMORY_MAX_CONTEXT_TOKENS',
    configPath: 'memory.maxContextTokens',
    type: 'number',
  },
  {
    envKey: 'WUNDR_MEMORY_COMPACTION_ENABLED',
    configPath: 'memory.compaction.enabled',
    type: 'boolean',
  },
  {
    envKey: 'WUNDR_MEMORY_COMPACTION_THRESHOLD',
    configPath: 'memory.compaction.threshold',
    type: 'number',
  },
  {
    envKey: 'WUNDR_MEMORY_COMPACTION_STRATEGY',
    configPath: 'memory.compaction.strategy',
    type: 'string',
  },
  {
    envKey: 'WUNDR_MEMORY_CITATIONS',
    configPath: 'memory.citations',
    type: 'string',
  },

  // --- Logging ---
  {
    envKey: 'WUNDR_LOGGING_LEVEL',
    configPath: 'logging.level',
    type: 'string',
  },
  {
    envKey: 'WUNDR_LOGGING_FORMAT',
    configPath: 'logging.format',
    type: 'string',
  },
  { envKey: 'WUNDR_LOGGING_FILE', configPath: 'logging.file', type: 'string' },
  {
    envKey: 'WUNDR_LOGGING_STRUCTURED',
    configPath: 'logging.structured',
    type: 'boolean',
  },

  // --- Monitoring ---
  {
    envKey: 'WUNDR_MONITORING_METRICS_ENABLED',
    configPath: 'monitoring.metrics.enabled',
    type: 'boolean',
  },
  {
    envKey: 'WUNDR_MONITORING_METRICS_PORT',
    configPath: 'monitoring.metrics.port',
    type: 'number',
  },
  {
    envKey: 'WUNDR_MONITORING_HEALTH_CHECK_ENABLED',
    configPath: 'monitoring.healthCheck.enabled',
    type: 'boolean',
  },
  {
    envKey: 'WUNDR_MONITORING_HEALTH_CHECK_PATH',
    configPath: 'monitoring.healthCheck.path',
    type: 'string',
  },

  // --- Hooks ---
  {
    envKey: 'WUNDR_HOOKS_ENABLED',
    configPath: 'hooks.enabled',
    type: 'boolean',
  },
  {
    envKey: 'WUNDR_HOOKS_DEFAULT_TIMEOUT_MS',
    configPath: 'hooks.defaultTimeoutMs',
    type: 'number',
  },
  {
    envKey: 'WUNDR_HOOKS_MAX_CONCURRENCY',
    configPath: 'hooks.maxConcurrency',
    type: 'number',
  },

  // --- Plugins ---
  {
    envKey: 'WUNDR_PLUGINS_ENABLED',
    configPath: 'plugins.enabled',
    type: 'boolean',
  },

  // --- Token Budget ---
  {
    envKey: 'WUNDR_TOKEN_BUDGET_DAILY',
    configPath: 'tokenBudget.daily',
    type: 'number',
  },
  {
    envKey: 'WUNDR_TOKEN_BUDGET_WEEKLY',
    configPath: 'tokenBudget.weekly',
    type: 'number',
  },
  {
    envKey: 'WUNDR_TOKEN_BUDGET_MONTHLY',
    configPath: 'tokenBudget.monthly',
    type: 'number',
  },

  // --- Global ---
  { envKey: 'WUNDR_NODE_ENV', configPath: 'nodeEnv', type: 'string' },
  { envKey: 'WUNDR_DEBUG', configPath: 'debug', type: 'boolean' },
];

// Build lookup map for O(1) access
const STATIC_MAP = new Map<string, EnvOverrideMapping>();
for (const mapping of STATIC_MAPPINGS) {
  STATIC_MAP.set(mapping.envKey, mapping);
}

// =============================================================================
// Type Coercion
// =============================================================================

function coerceValue(raw: string, type: EnvOverrideMapping['type']): unknown {
  switch (type) {
    case 'boolean':
      return raw.toLowerCase() === 'true' || raw === '1';
    case 'number': {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        return raw; // Let Zod catch the type error
      }
      return parsed;
    }
    case 'string[]':
      return raw
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    case 'string':
    default:
      return raw;
  }
}

// =============================================================================
// Path Setting
// =============================================================================

function setNestedValue(
  obj: Record<string, unknown>,
  dotPath: string,
  value: unknown
): void {
  const parts = dotPath.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (
      typeof current[key] !== 'object' ||
      current[key] === null ||
      Array.isArray(current[key])
    ) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

// =============================================================================
// Dynamic Mapping (for WUNDR_* vars not in the static list)
// =============================================================================

/**
 * Convert a WUNDR_* env var name to a config dot-path using conventions:
 *
 * 1. Strip WUNDR_ prefix
 * 2. Split on _ boundaries
 * 3. Use first segment as the top-level config key (lowercased)
 * 4. Remaining segments form the nested path, converted to camelCase
 *
 * Example:
 *   WUNDR_DAEMON_SHUTDOWN_TIMEOUT_MS -> daemon.shutdownTimeoutMs
 *   WUNDR_SECURITY_JWT_SECRET -> security.jwt.secret (via static map)
 */
function envKeyToConfigPath(envKey: string): string | null {
  if (!envKey.startsWith('WUNDR_')) {
    return null;
  }

  const withoutPrefix = envKey.slice('WUNDR_'.length);
  const segments = withoutPrefix.split('_');

  if (segments.length < 2) {
    return null;
  }

  // First segment is the top-level key
  const topLevel = segments[0].toLowerCase();
  const remaining = segments.slice(1);

  // Convert remaining segments to camelCase
  const camelCase = remaining
    .map((seg, index) =>
      index === 0
        ? seg.toLowerCase()
        : seg.charAt(0) + seg.slice(1).toLowerCase()
    )
    .join('');

  return `${topLevel}.${camelCase}`;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Build a config override object from WUNDR_* environment variables.
 *
 * Scans the provided env for keys starting with WUNDR_ and maps them to
 * config paths using the static mapping table. Returns a partial config
 * object that can be deep-merged on top of the file config.
 */
export function buildWundrEnvOverrides(
  env: NodeJS.ProcessEnv = process.env
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(env)) {
    if (
      !key.startsWith('WUNDR_') ||
      rawValue === undefined ||
      rawValue === ''
    ) {
      continue;
    }

    // Skip internal control variables
    if (
      key === 'WUNDR_CONFIG_PATH' ||
      key === 'WUNDR_STATE_DIR' ||
      key === 'WUNDR_WORKSPACE' ||
      key === 'WUNDR_CONFIG_CACHE_MS' ||
      key === 'WUNDR_DISABLE_CONFIG_CACHE'
    ) {
      continue;
    }

    const staticMapping = STATIC_MAP.get(key);
    if (staticMapping) {
      const value = coerceValue(rawValue, staticMapping.type);
      setNestedValue(result, staticMapping.configPath, value);
      continue;
    }

    // Dynamic mapping for unmapped WUNDR_* keys (treat as string)
    const dynamicPath = envKeyToConfigPath(key);
    if (dynamicPath) {
      setNestedValue(result, dynamicPath, rawValue);
    }
  }

  return result;
}

/**
 * Get all known WUNDR_* environment variable mappings.
 * Useful for documentation and CLI help output.
 */
export function getStaticMappings(): readonly EnvOverrideMapping[] {
  return STATIC_MAPPINGS;
}

/**
 * List of config paths that are considered sensitive (contain secrets).
 * Used by the redactor and for documentation.
 */
export const SENSITIVE_CONFIG_PATHS: readonly string[] = [
  'openai.apiKey',
  'anthropic.apiKey',
  'security.jwt.secret',
  'security.apiKeys',
  'channels.slack.botToken',
  'channels.slack.appToken',
  'channels.slack.userToken',
  'channels.discord.token',
  'channels.telegram.botToken',
  'channels.webhook.secret',
  'redis.password',
  'database.url',
  'neolith.apiKey',
  'neolith.apiSecret',
  'models.providers.*.apiKey',
];
