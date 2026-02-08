/**
 * Security Audit Engine for Wundr Orchestrator Daemon
 *
 * Ported and adapted from OpenClaw's security/audit.ts.
 * Provides 60+ automated security checks covering daemon configuration,
 * WebSocket security, JWT validation, CORS, rate limiting, TLS, environment
 * variables, API keys, Redis, database, MCP tool safety, distributed cluster
 * security, filesystem permissions, dependency scanning, and plugin code safety.
 *
 * Design: pure functions per check category, dependency-injected for testability.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { Config } from '../config';
import type { SkillScanSummary } from './skill-scanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecurityAuditSeverity = 'info' | 'warn' | 'critical';

export type SecurityAuditFinding = {
  checkId: string;
  severity: SecurityAuditSeverity;
  title: string;
  detail: string;
  remediation?: string;
};

export type SecurityAuditSummary = {
  critical: number;
  warn: number;
  info: number;
};

export type WebSocketProbeResult = {
  attempted: boolean;
  url: string | null;
  ok: boolean;
  error: string | null;
  latencyMs: number | null;
};

export type SecurityAuditReport = {
  ts: number;
  version: string;
  summary: SecurityAuditSummary;
  findings: SecurityAuditFinding[];
  deep?: {
    websocket?: WebSocketProbeResult;
    pluginScan?: SkillScanSummary;
  };
};

export type SecurityAuditOptions = {
  config: Config;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  deep?: boolean;
  includeFilesystem?: boolean;
  /** Project root for dependency scanning. */
  projectDir?: string;
  /** Override .env file path for checks. */
  dotenvPath?: string;
  /** Override config file path for permission checks. */
  configPath?: string;
  /** Directory to scan for plugin source code (deep mode). */
  pluginDir?: string;
  /** Time limit for deep WebSocket probe. */
  deepTimeoutMs?: number;
  /** Override WebSocket probe for testing. */
  probeWebSocketFn?: (url: string, timeoutMs: number) => Promise<WebSocketProbeResult>;
  /** Override fs.stat for testing. */
  statFn?: typeof fs.stat;
  /** Override fs.access for testing. */
  accessFn?: typeof fs.access;
  /** Override fs.readFile for testing. */
  readFileFn?: typeof fs.readFile;
};

const AUDIT_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countBySeverity(findings: SecurityAuditFinding[]): SecurityAuditSummary {
  let critical = 0;
  let warn = 0;
  let info = 0;
  for (const f of findings) {
    if (f.severity === 'critical') {
      critical += 1;
    } else if (f.severity === 'warn') {
      warn += 1;
    } else {
      info += 1;
    }
  }
  return { critical, warn, info };
}

/**
 * Compute Shannon entropy of a string (bits per character).
 * Used for JWT secret strength validation.
 */
function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

/**
 * Parse a duration string like "24h", "7d", "30m" into milliseconds.
 */
function parseDurationMs(duration: string): number | null {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(duration.trim());
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'ms': return value;
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 3600 * 1000;
    case 'd': return value * 86400 * 1000;
    default: return null;
  }
}

/**
 * Default JWT secret string from the config loader.
 */
const DEFAULT_JWT_SECRET = 'change-this-in-production-to-a-random-secure-string';

// ---------------------------------------------------------------------------
// Check: Daemon Configuration (6 checks)
// ---------------------------------------------------------------------------

export function collectDaemonConfigFindings(cfg: Config): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const host = cfg.daemon?.host ?? '127.0.0.1';
  const maxSessions = cfg.daemon?.maxSessions ?? 100;
  const verbose = cfg.daemon?.verbose ?? false;
  const name = cfg.daemon?.name ?? 'orchestrator-daemon';
  const env = cfg.env ?? 'development';

  // 1. daemon.host_all_interfaces
  if (host === '0.0.0.0') {
    findings.push({
      checkId: 'daemon.host_all_interfaces',
      severity: 'critical',
      title: 'Daemon binds to all interfaces',
      detail: `daemon.host="0.0.0.0" exposes the daemon on every network interface, including public ones.`,
      remediation: 'Set daemon.host to "127.0.0.1" or a specific private interface address.',
    });
  }
  // 2. daemon.host_not_loopback
  else if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
    findings.push({
      checkId: 'daemon.host_not_loopback',
      severity: 'warn',
      title: 'Daemon binds beyond loopback',
      detail: `daemon.host="${host}" is not loopback; ensure network-level access control is in place.`,
      remediation: 'Prefer "127.0.0.1" unless remote access is intentional; add firewall rules.',
    });
  }

  // 3. daemon.max_sessions_unlimited
  if (maxSessions <= 0) {
    findings.push({
      checkId: 'daemon.max_sessions_unlimited',
      severity: 'critical',
      title: 'No session limit configured',
      detail: 'daemon.maxSessions is zero or negative, allowing unlimited sessions.',
      remediation: 'Set daemon.maxSessions to a positive integer (e.g., 100).',
    });
  }
  // 4. daemon.max_sessions_excessive
  else if (maxSessions > 500) {
    findings.push({
      checkId: 'daemon.max_sessions_excessive',
      severity: 'warn',
      title: 'Session limit is very high',
      detail: `daemon.maxSessions=${maxSessions} may cause resource exhaustion under load.`,
      remediation: 'Consider lowering maxSessions unless your hardware can sustain this load.',
    });
  }

  // 5. daemon.default_name
  if (name === 'orchestrator-daemon') {
    findings.push({
      checkId: 'daemon.default_name',
      severity: 'info',
      title: 'Daemon uses default name',
      detail: 'daemon.name is the default "orchestrator-daemon"; consider a unique identifier for multi-node setups.',
    });
  }

  // 6. daemon.verbose_production
  if (verbose && env === 'production') {
    findings.push({
      checkId: 'daemon.verbose_production',
      severity: 'warn',
      title: 'Verbose mode enabled in production',
      detail: 'daemon.verbose=true in production may log sensitive data.',
      remediation: 'Set daemon.verbose=false in production.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check: WebSocket Security (8 checks)
// ---------------------------------------------------------------------------

export function collectWebSocketSecurityFindings(cfg: Config): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const host = cfg.daemon?.host ?? '127.0.0.1';
  const jwtSecret = cfg.security?.jwtSecret;
  const hasAuth = typeof jwtSecret === 'string'
    && jwtSecret.trim().length > 0
    && jwtSecret !== DEFAULT_JWT_SECRET;
  const isLoopback = host === '127.0.0.1' || host === 'localhost' || host === '::1';

  // 7. ws.no_auth
  if (!hasAuth && !isLoopback) {
    findings.push({
      checkId: 'ws.no_auth',
      severity: 'critical',
      title: 'WebSocket server has no authentication',
      detail: 'The daemon binds beyond loopback but has no JWT secret configured (or uses the default).',
      remediation: 'Set DAEMON_JWT_SECRET to a strong random value (at least 32 characters).',
    });
  }

  // 8. ws.no_origin_validation
  const corsEnabled = cfg.security?.cors?.enabled ?? false;
  const corsOrigins = cfg.security?.cors?.origins ?? [];
  if (!corsEnabled || corsOrigins.length === 0) {
    findings.push({
      checkId: 'ws.no_origin_validation',
      severity: 'warn',
      title: 'No origin validation on WebSocket connections',
      detail: 'CORS is disabled or has no origins configured; WebSocket upgrades will not validate the Origin header.',
      remediation: 'Enable CORS and configure specific allowed origins.',
    });
  }

  // 9. ws.no_message_size_limit
  findings.push({
    checkId: 'ws.no_message_size_limit',
    severity: 'warn',
    title: 'No WebSocket message size limit configured',
    detail: 'The WebSocket server does not set maxPayload; a malicious client could send very large messages.',
    remediation: 'Configure ws.Server with maxPayload (e.g., 1 MB) to prevent memory exhaustion.',
  });

  // 10. ws.no_rate_limit
  const rateLimitEnabled = cfg.security?.rateLimit?.enabled ?? true;
  if (!rateLimitEnabled) {
    findings.push({
      checkId: 'ws.no_rate_limit',
      severity: 'warn',
      title: 'No per-client rate limiting on WebSocket',
      detail: 'Rate limiting is disabled; clients can flood the server with messages.',
      remediation: 'Enable security.rateLimit and configure appropriate max/windowMs values.',
    });
  }

  // 11. ws.no_heartbeat_timeout
  const heartbeatInterval = cfg.health?.heartbeatInterval ?? 30000;
  if (heartbeatInterval > 120000) {
    findings.push({
      checkId: 'ws.no_heartbeat_timeout',
      severity: 'info',
      title: 'WebSocket heartbeat interval is very long',
      detail: `health.heartbeatInterval=${heartbeatInterval}ms; stale connections may persist.`,
      remediation: 'Keep heartbeat interval under 60s for timely detection of dead connections.',
    });
  }

  // 12. ws.broadcast_unrestricted
  findings.push({
    checkId: 'ws.broadcast_unrestricted',
    severity: 'info',
    title: 'WebSocket broadcasts reach all session subscribers',
    detail: 'Any client subscribed to a session receives all messages for that session. Ensure session IDs are not guessable.',
  });

  // 13. ws.no_tls
  if (!isLoopback) {
    findings.push({
      checkId: 'ws.no_tls',
      severity: 'critical',
      title: 'WebSocket not using TLS',
      detail: 'The daemon serves unencrypted ws:// connections on a non-loopback interface.',
      remediation: 'Terminate TLS in front of the daemon (reverse proxy or direct wss://).',
    });
  }

  // 14. ws.session_fixation
  findings.push({
    checkId: 'ws.session_fixation',
    severity: 'info',
    title: 'Ensure session IDs are cryptographically random',
    detail: 'Session identifiers must be generated with crypto.randomUUID() or equivalent to prevent session fixation.',
  });

  return findings;
}

// ---------------------------------------------------------------------------
// Check: JWT / Authentication (8 checks)
// ---------------------------------------------------------------------------

export function collectJwtSecurityFindings(
  cfg: Config,
  env: NodeJS.ProcessEnv,
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const secret = cfg.security?.jwtSecret ?? '';
  const expiration = cfg.security?.jwtExpiration ?? '24h';

  // 15. jwt.secret_default
  if (secret === DEFAULT_JWT_SECRET) {
    findings.push({
      checkId: 'jwt.secret_default',
      severity: 'critical',
      title: 'JWT secret is the hardcoded default',
      detail: 'security.jwtSecret is the placeholder default from the codebase. Anyone with source access can forge tokens.',
      remediation: 'Set DAEMON_JWT_SECRET to a unique random string of at least 64 characters.',
    });
  }

  // 16. jwt.secret_too_short
  if (secret.length > 0 && secret.length < 32 && secret !== DEFAULT_JWT_SECRET) {
    findings.push({
      checkId: 'jwt.secret_too_short',
      severity: 'critical',
      title: 'JWT secret is too short',
      detail: `security.jwtSecret is ${secret.length} characters; secrets under 32 chars are brute-forceable.`,
      remediation: 'Use a JWT secret of at least 64 characters generated with a CSPRNG.',
    });
  }

  // 17. jwt.secret_low_entropy
  if (secret.length >= 32 && secret !== DEFAULT_JWT_SECRET) {
    const entropy = shannonEntropy(secret);
    if (entropy < 3.0) {
      findings.push({
        checkId: 'jwt.secret_low_entropy',
        severity: 'warn',
        title: 'JWT secret has low entropy',
        detail: `security.jwtSecret has Shannon entropy of ${entropy.toFixed(2)} bits/char; consider a more random value.`,
        remediation: 'Generate a secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'base64\'))"',
      });
    }
  }

  // 18. jwt.expiration_too_long
  const expirationMs = parseDurationMs(expiration);
  const twentyFourHoursMs = 24 * 3600 * 1000;
  if (expirationMs !== null && expirationMs > twentyFourHoursMs) {
    findings.push({
      checkId: 'jwt.expiration_too_long',
      severity: 'warn',
      title: 'JWT expiration is longer than 24 hours',
      detail: `security.jwtExpiration="${expiration}" means stolen tokens remain valid for a long time.`,
      remediation: 'Set jwtExpiration to "1h" or less and implement refresh token rotation.',
    });
  }

  // 19. jwt.no_expiration
  if (!expiration || expiration.trim() === '' || expiration === '0') {
    findings.push({
      checkId: 'jwt.no_expiration',
      severity: 'critical',
      title: 'JWT tokens have no expiration',
      detail: 'security.jwtExpiration is empty or zero; tokens never expire.',
      remediation: 'Set jwtExpiration to a reasonable duration like "1h" or "24h".',
    });
  }

  // 20. jwt.no_refresh_rotation
  findings.push({
    checkId: 'jwt.no_refresh_rotation',
    severity: 'info',
    title: 'No refresh token rotation configured',
    detail: 'The daemon does not implement refresh token rotation; long-lived tokens increase risk.',
    remediation: 'Implement refresh token rotation for production deployments.',
  });

  // 21. jwt.algorithm_none
  findings.push({
    checkId: 'jwt.algorithm_none',
    severity: 'info',
    title: 'Verify JWT library rejects "none" algorithm',
    detail: 'Ensure the JWT verification code explicitly specifies allowed algorithms and rejects "none".',
  });

  // 22. jwt.secret_in_config_file
  const secretFromEnv = env.DAEMON_JWT_SECRET;
  if (secret !== DEFAULT_JWT_SECRET && secret.length > 0 && !secretFromEnv) {
    findings.push({
      checkId: 'jwt.secret_in_config_file',
      severity: 'warn',
      title: 'JWT secret may be hardcoded in config',
      detail: 'DAEMON_JWT_SECRET environment variable is not set; the secret may be hardcoded in source.',
      remediation: 'Set DAEMON_JWT_SECRET as an environment variable rather than in source code.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check: CORS (4 checks)
// ---------------------------------------------------------------------------

export function collectCorsFindings(cfg: Config): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const corsEnabled = cfg.security?.cors?.enabled ?? false;
  const origins = cfg.security?.cors?.origins ?? [];
  const envMode = cfg.env ?? 'development';

  // 23. cors.wildcard_origin
  if (corsEnabled && origins.includes('*')) {
    findings.push({
      checkId: 'cors.wildcard_origin',
      severity: 'critical',
      title: 'CORS allows all origins',
      detail: 'security.cors.origins contains "*", allowing any website to make cross-origin requests.',
      remediation: 'Replace "*" with specific allowed origins.',
    });
  }

  // 24. cors.disabled_in_production
  if (!corsEnabled && envMode === 'production') {
    findings.push({
      checkId: 'cors.disabled_in_production',
      severity: 'info',
      title: 'CORS is disabled in production',
      detail: 'CORS is disabled. This is fine if no browser clients connect directly.',
    });
  }

  // 25. cors.localhost_in_production
  if (corsEnabled && envMode === 'production') {
    const hasLocalhost = origins.some(
      (o) => o.includes('localhost') || o.includes('127.0.0.1'),
    );
    if (hasLocalhost) {
      findings.push({
        checkId: 'cors.localhost_in_production',
        severity: 'warn',
        title: 'CORS allows localhost in production',
        detail: 'security.cors.origins includes a localhost origin in production mode.',
        remediation: 'Remove localhost origins from production CORS configuration.',
      });
    }
  }

  // 26. cors.missing_credentials
  if (corsEnabled && origins.includes('*')) {
    findings.push({
      checkId: 'cors.missing_credentials',
      severity: 'warn',
      title: 'CORS wildcard with potential credentials',
      detail: 'Wildcard origin ("*") combined with credentials is rejected by browsers but indicates a misconfiguration.',
      remediation: 'Use specific origins when credentials (cookies, auth headers) are required.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check: Rate Limiting (3 checks)
// ---------------------------------------------------------------------------

export function collectRateLimitFindings(cfg: Config): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const enabled = cfg.security?.rateLimit?.enabled ?? true;
  const max = cfg.security?.rateLimit?.max ?? 100;
  const windowMs = cfg.security?.rateLimit?.windowMs ?? 60000;

  // 27. rate_limit.disabled
  if (!enabled) {
    findings.push({
      checkId: 'rate_limit.disabled',
      severity: 'warn',
      title: 'Rate limiting is disabled',
      detail: 'security.rateLimit.enabled=false; the daemon is vulnerable to denial-of-service.',
      remediation: 'Enable rate limiting with reasonable limits (e.g., 100 requests per 60 seconds).',
    });
  }

  // 28. rate_limit.too_permissive
  if (enabled && max > 1000) {
    findings.push({
      checkId: 'rate_limit.too_permissive',
      severity: 'warn',
      title: 'Rate limit is very permissive',
      detail: `security.rateLimit.max=${max}; allowing over 1000 requests per window is likely too generous.`,
      remediation: 'Lower max to 100-500 depending on expected traffic.',
    });
  }

  // 29. rate_limit.window_too_large
  if (enabled && windowMs > 300000) {
    findings.push({
      checkId: 'rate_limit.window_too_large',
      severity: 'info',
      title: 'Rate limit window is very large',
      detail: `security.rateLimit.windowMs=${windowMs}ms (${(windowMs / 60000).toFixed(1)} min); bursts within the window may be harmful.`,
      remediation: 'Consider a shorter window (e.g., 60 seconds) for more responsive limiting.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check: TLS / Transport (4 checks)
// ---------------------------------------------------------------------------

export function collectTlsFindings(
  cfg: Config,
  env: NodeJS.ProcessEnv,
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const host = cfg.daemon?.host ?? '127.0.0.1';
  const isLoopback = host === '127.0.0.1' || host === 'localhost' || host === '::1';
  const nodeEnv = cfg.env ?? 'development';

  // 30. tls.no_https
  if (!isLoopback && nodeEnv === 'production') {
    findings.push({
      checkId: 'tls.no_https',
      severity: 'critical',
      title: 'No TLS configured for production',
      detail: 'The daemon serves plain HTTP/WS on a non-loopback interface in production.',
      remediation: 'Terminate TLS via a reverse proxy (nginx, Caddy) or configure HTTPS directly.',
    });
  }

  // 31. tls.self_signed
  const tlsCert = env.TLS_CERT_PATH;
  const tlsKey = env.TLS_KEY_PATH;
  if (tlsCert && tlsKey) {
    findings.push({
      checkId: 'tls.self_signed',
      severity: 'info',
      title: 'Verify TLS certificate is not self-signed',
      detail: `TLS_CERT_PATH is set to "${tlsCert}"; ensure this is a valid CA-signed certificate for production.`,
    });
  }

  // 32. tls.weak_protocol
  const nodeOptions = env.NODE_OPTIONS ?? '';
  const hasWeakTls = nodeOptions.includes('--tls-min-v1.0') || nodeOptions.includes('--tls-min-v1.1');
  if (hasWeakTls) {
    findings.push({
      checkId: 'tls.weak_protocol',
      severity: 'critical',
      title: 'Weak TLS protocol version allowed',
      detail: 'NODE_OPTIONS allows TLS 1.0 or 1.1 which are deprecated and insecure.',
      remediation: 'Remove --tls-min-v1.0 and --tls-min-v1.1 from NODE_OPTIONS; require TLS 1.2+.',
    });
  }

  // 33. tls.weak_cipher
  const cipherMatch = nodeOptions.match(/--tls-cipher-list=([^\s]+)/);
  const ciphers = cipherMatch ? cipherMatch[1] : '';
  const weakCiphers = ['RC4', 'DES', 'MD5', '3DES', 'NULL', 'EXPORT'];
  for (const weak of weakCiphers) {
    if (ciphers.toUpperCase().includes(weak)) {
      findings.push({
        checkId: 'tls.weak_cipher',
        severity: 'critical',
        title: 'Weak TLS cipher suite detected',
        detail: `NODE_OPTIONS --tls-cipher-list includes "${weak}" which is insecure.`,
        remediation: `Remove ${weak} from the cipher list; use modern cipher suites only.`,
      });
      break;
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check: Environment Variables (6 checks)
// ---------------------------------------------------------------------------

export function collectEnvSecurityFindings(
  env: NodeJS.ProcessEnv,
  cfg: Config,
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const nodeEnv = cfg.env ?? env.NODE_ENV ?? 'development';

  // 34. env.api_key_missing
  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.trim().length === 0) {
    findings.push({
      checkId: 'env.api_key_missing',
      severity: 'info',
      title: 'OPENAI_API_KEY is not set',
      detail: 'The primary LLM API key is missing; the daemon will fail to process tasks.',
    });
  }

  // 35. env.secrets_in_dotenv
  findings.push({
    checkId: 'env.secrets_in_dotenv',
    severity: 'info',
    title: 'Ensure .env files are excluded from version control',
    detail: 'If a .env file exists, verify it is listed in .gitignore to prevent secret leakage.',
  });

  // 37. env.debug_enabled_production
  if (nodeEnv === 'production' && (env.DEBUG === 'true' || env.DEBUG === '1' || cfg.debug === true)) {
    findings.push({
      checkId: 'env.debug_enabled_production',
      severity: 'warn',
      title: 'Debug mode enabled in production',
      detail: 'DEBUG is enabled in production; debug output may leak sensitive information.',
      remediation: 'Unset DEBUG or set it to false in production environments.',
    });
  }

  // 38. env.node_env_missing
  if (!env.NODE_ENV) {
    findings.push({
      checkId: 'env.node_env_missing',
      severity: 'warn',
      title: 'NODE_ENV is not set',
      detail: 'NODE_ENV is missing; the daemon defaults to "development" which may enable unsafe behaviors.',
      remediation: 'Set NODE_ENV=production for production deployments.',
    });
  }

  // 39. env.sensitive_vars_logged
  const sensitiveVars = [
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DAEMON_JWT_SECRET',
    'REDIS_PASSWORD', 'DATABASE_URL', 'NEOLITH_API_SECRET',
  ];
  const logLevel = cfg.logging?.level ?? 'info';
  if (logLevel === 'debug' && nodeEnv === 'production') {
    const present = sensitiveVars.filter((v) => env[v] && env[v]!.trim().length > 0);
    if (present.length > 0) {
      findings.push({
        checkId: 'env.sensitive_vars_logged',
        severity: 'warn',
        title: 'Sensitive env vars may appear in debug logs',
        detail: `Log level is "debug" in production with ${present.length} sensitive env vars set (${present.join(', ')}).`,
        remediation: 'Set logging.level to "info" or higher in production.',
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check: Logging (3 checks)
// ---------------------------------------------------------------------------

export function collectLoggingFindings(cfg: Config): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const level = cfg.logging?.level ?? 'info';
  const file = cfg.logging?.file;
  const rotationEnabled = cfg.logging?.rotation?.enabled ?? true;
  const envMode = cfg.env ?? 'development';

  // 40. logging.debug_in_production
  if (level === 'debug' && envMode === 'production') {
    findings.push({
      checkId: 'logging.debug_in_production',
      severity: 'warn',
      title: 'Debug log level in production',
      detail: 'logging.level="debug" in production can leak sensitive request/response data.',
      remediation: 'Set logging.level to "info" or "warn" in production.',
    });
  }

  // 41. logging.no_file_logging
  if (!file && envMode === 'production') {
    findings.push({
      checkId: 'logging.no_file_logging',
      severity: 'info',
      title: 'No file logging configured in production',
      detail: 'logging.file is not set; logs go only to stdout which may be lost.',
      remediation: 'Configure logging.file for persistent audit trail.',
    });
  }

  // 42. logging.no_rotation
  if (file && !rotationEnabled) {
    findings.push({
      checkId: 'logging.no_rotation',
      severity: 'warn',
      title: 'Log rotation is disabled',
      detail: 'logging.rotation.enabled=false; log files will grow unbounded.',
      remediation: 'Enable log rotation with appropriate maxSize and maxFiles.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check: API Key Security (4 checks)
// ---------------------------------------------------------------------------

export function collectApiKeyFindings(
  cfg: Config,
  env: NodeJS.ProcessEnv,
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];

  // 43. api.openai_key_exposed
  const openaiKey = cfg.openai?.apiKey ?? '';
  if (openaiKey.length > 0 && openaiKey.startsWith('sk-') && !env.OPENAI_API_KEY) {
    findings.push({
      checkId: 'api.openai_key_exposed',
      severity: 'critical',
      title: 'OpenAI API key appears hardcoded',
      detail: 'openai.apiKey contains what looks like a real API key not sourced from an env var.',
      remediation: 'Set OPENAI_API_KEY as an environment variable and remove it from config.',
    });
  }

  // 44. api.anthropic_key_exposed
  const anthropicKey = cfg.anthropic?.apiKey ?? '';
  if (anthropicKey.length > 0 && anthropicKey.startsWith('sk-ant-') && !env.ANTHROPIC_API_KEY) {
    findings.push({
      checkId: 'api.anthropic_key_exposed',
      severity: 'critical',
      title: 'Anthropic API key appears hardcoded',
      detail: 'anthropic.apiKey contains what looks like a real API key not sourced from an env var.',
      remediation: 'Set ANTHROPIC_API_KEY as an environment variable and remove it from config.',
    });
  }

  // 45. api.neolith_secret_exposed
  const neolithSecret = cfg.neolith?.apiSecret ?? '';
  if (neolithSecret.length > 0 && !env.NEOLITH_API_SECRET) {
    findings.push({
      checkId: 'api.neolith_secret_exposed',
      severity: 'warn',
      title: 'Neolith API secret appears hardcoded',
      detail: 'neolith.apiSecret is set but NEOLITH_API_SECRET env var is not; secret may be in source.',
      remediation: 'Set NEOLITH_API_SECRET as an environment variable.',
    });
  }

  // 46. api.key_in_source
  if (openaiKey.startsWith('sk-') || anthropicKey.startsWith('sk-ant-')) {
    findings.push({
      checkId: 'api.key_in_source',
      severity: 'info',
      title: 'API keys detected in loaded config',
      detail: 'API keys matching known provider prefixes are present in the running config.',
      remediation: 'Ensure API keys come from environment variables, not hardcoded values.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check: Redis Security (3 checks)
// ---------------------------------------------------------------------------

export function collectRedisSecurityFindings(cfg: Config): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const redis = cfg.redis;

  if (!redis?.url) {
    return findings;
  }

  // 47. redis.no_password
  if (!redis.password && !redis.url.includes('@')) {
    findings.push({
      checkId: 'redis.no_password',
      severity: 'warn',
      title: 'Redis has no password configured',
      detail: 'redis.password is empty and the URL has no credentials; Redis is unauthenticated.',
      remediation: 'Set REDIS_PASSWORD or include credentials in the Redis URL.',
    });
  }

  // 48. redis.no_tls
  if (redis.url.startsWith('redis://') && !redis.url.includes('localhost') && !redis.url.includes('127.0.0.1')) {
    findings.push({
      checkId: 'redis.no_tls',
      severity: 'warn',
      title: 'Redis connection without TLS',
      detail: 'redis.url uses redis:// (not rediss://) to a non-local host; data is sent in cleartext.',
      remediation: 'Use rediss:// for TLS-encrypted Redis connections.',
    });
  }

  // 49. redis.default_port_exposed
  try {
    const url = new URL(redis.url);
    if ((url.port === '6379' || url.port === '') && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      findings.push({
        checkId: 'redis.default_port_exposed',
        severity: 'info',
        title: 'Redis uses default port on non-local host',
        detail: `Redis is on ${url.hostname}:${url.port || '6379'}; the default port is a common scan target.`,
        remediation: 'Consider using a non-default port and firewall rules.',
      });
    }
  } catch {
    // Invalid URL; skip this check.
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check: Database Security (3 checks)
// ---------------------------------------------------------------------------

export function collectDatabaseSecurityFindings(cfg: Config): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const db = cfg.database;

  if (!db?.url) {
    return findings;
  }

  // 50. database.credentials_in_url
  try {
    const url = new URL(db.url);
    if (url.password && url.password.length > 0) {
      findings.push({
        checkId: 'database.credentials_in_url',
        severity: 'warn',
        title: 'Database credentials embedded in URL',
        detail: 'database.url contains a password; prefer separate credential management.',
        remediation: 'Use environment variables for database credentials rather than embedding them in the URL.',
      });
    }
  } catch {
    // Not a standard URL format; skip.
  }

  // 51. database.no_ssl
  if (db.url && !db.url.includes('sslmode=require') && !db.url.includes('ssl=true') && !db.url.includes('sslmode=verify')) {
    const isLocal = db.url.includes('localhost') || db.url.includes('127.0.0.1');
    if (!isLocal) {
      findings.push({
        checkId: 'database.no_ssl',
        severity: 'warn',
        title: 'Database connection may lack SSL',
        detail: 'database.url does not include sslmode=require or ssl=true for a non-local host.',
        remediation: 'Add sslmode=require to the database connection string.',
      });
    }
  }

  // 52. database.pool_unlimited
  const poolSize = db.poolSize ?? 10;
  if (poolSize > 100) {
    findings.push({
      checkId: 'database.pool_unlimited',
      severity: 'info',
      title: 'Database pool size is very large',
      detail: `database.poolSize=${poolSize}; large pools can exhaust database connection limits.`,
      remediation: 'Keep poolSize reasonable (10-50) and monitor connection usage.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check: MCP Tool Safety (4 checks)
// ---------------------------------------------------------------------------

export function collectMcpToolSafetyFindings(_cfg: Config): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];

  // 53. mcp.safety_checks_disabled
  findings.push({
    checkId: 'mcp.safety_checks_disabled',
    severity: 'info',
    title: 'Verify MCP tool safety checks are enabled',
    detail: 'The McpToolRegistryImpl has safetyChecks; ensure they are not overridden to false.',
  });

  // 54. mcp.dangerous_commands_allowed
  findings.push({
    checkId: 'mcp.dangerous_commands_allowed',
    severity: 'info',
    title: 'Review dangerous command blocklist',
    detail: 'The bash_execute tool blocks a small set of dangerous commands; review isCommandDangerous() for completeness.',
    remediation: 'Extend the blocklist or use an allowlist approach for production.',
  });

  // 55. mcp.path_traversal_possible
  findings.push({
    checkId: 'mcp.path_traversal_possible',
    severity: 'info',
    title: 'Review path traversal prevention',
    detail: 'The isPathDangerous() check blocks ".." but allows home directory access; verify this is intentional.',
  });

  // 56. mcp.no_tool_allowlist
  findings.push({
    checkId: 'mcp.no_tool_allowlist',
    severity: 'warn',
    title: 'No MCP tool execution allowlist',
    detail: 'All registered MCP tools can be invoked by any authenticated client; there is no per-tool authorization.',
    remediation: 'Implement tool-level access control or an allowlist of tools per role.',
  });

  return findings;
}

// ---------------------------------------------------------------------------
// Check: Distributed / Federation (4 checks)
// ---------------------------------------------------------------------------

export function collectDistributedSecurityFindings(cfg: Config): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const dist = cfg.distributed;

  if (!dist) {
    return findings;
  }

  // 57. distributed.no_cluster_auth
  findings.push({
    checkId: 'distributed.no_cluster_auth',
    severity: 'warn',
    title: 'No inter-node authentication configured',
    detail: 'The distributed cluster does not have an authentication mechanism between nodes.',
    remediation: 'Implement shared secret or mTLS for inter-node communication.',
  });

  // 58. distributed.migration_timeout_long
  const migrationTimeout = dist.migrationTimeout ?? 30000;
  if (migrationTimeout > 120000) {
    findings.push({
      checkId: 'distributed.migration_timeout_long',
      severity: 'info',
      title: 'Session migration timeout is very long',
      detail: `distributed.migrationTimeout=${migrationTimeout}ms; long timeouts may leave sessions in limbo.`,
      remediation: 'Keep migration timeout under 60 seconds.',
    });
  }

  // 59. distributed.rebalance_aggressive
  const rebalanceInterval = dist.rebalanceInterval ?? 300000;
  if (rebalanceInterval < 60000) {
    findings.push({
      checkId: 'distributed.rebalance_aggressive',
      severity: 'warn',
      title: 'Cluster rebalancing is very frequent',
      detail: `distributed.rebalanceInterval=${rebalanceInterval}ms (${(rebalanceInterval / 1000).toFixed(0)}s); frequent rebalancing can cause session disruptions.`,
      remediation: 'Set rebalanceInterval to at least 300000ms (5 min).',
    });
  }

  // 60. distributed.no_node_verification
  findings.push({
    checkId: 'distributed.no_node_verification',
    severity: 'warn',
    title: 'No node identity verification',
    detail: 'Cluster nodes do not verify each other\'s identity; a rogue node could join the cluster.',
    remediation: 'Implement node identity verification via certificates or shared secrets.',
  });

  return findings;
}

// ---------------------------------------------------------------------------
// Check: Neolith Integration (2 checks)
// ---------------------------------------------------------------------------

export function collectNeolithSecurityFindings(cfg: Config): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const neolith = cfg.neolith;

  if (!neolith?.apiUrl) {
    return findings;
  }

  try {
    const url = new URL(neolith.apiUrl);
    if (url.protocol === 'http:') {
      findings.push({
        checkId: 'neolith.no_tls',
        severity: 'warn',
        title: 'Neolith API connection uses HTTP',
        detail: `neolith.apiUrl="${neolith.apiUrl}" uses unencrypted HTTP.`,
        remediation: 'Use https:// for the Neolith API URL.',
      });
    }
  } catch {
    // Invalid URL.
  }

  if (neolith.apiKey && !neolith.apiSecret) {
    findings.push({
      checkId: 'neolith.missing_secret',
      severity: 'warn',
      title: 'Neolith API key set without secret',
      detail: 'neolith.apiKey is set but neolith.apiSecret is empty; authentication may be incomplete.',
      remediation: 'Set NEOLITH_API_SECRET for full authentication.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check: Filesystem Permissions (6 checks)
// ---------------------------------------------------------------------------

type PathPermissions = {
  ok: boolean;
  mode: number;
  isSymlink: boolean;
  worldWritable: boolean;
  groupWritable: boolean;
  worldReadable: boolean;
  groupReadable: boolean;
};

async function inspectPathPermissions(
  targetPath: string,
  statFn: typeof fs.stat = fs.stat,
): Promise<PathPermissions | null> {
  try {
    const stats = await statFn(targetPath);
    const mode = stats.mode;
    return {
      ok: true,
      mode,
      isSymlink: stats.isSymbolicLink(),
      worldWritable: (mode & 0o002) !== 0,
      groupWritable: (mode & 0o020) !== 0,
      worldReadable: (mode & 0o004) !== 0,
      groupReadable: (mode & 0o040) !== 0,
    };
  } catch {
    return null;
  }
}

function formatMode(mode: number): string {
  return `0o${(mode & 0o7777).toString(8)}`;
}

export async function collectFilesystemFindings(params: {
  configPath?: string;
  dotenvPath?: string;
  statFn?: typeof fs.stat;
  platform?: NodeJS.Platform;
}): Promise<SecurityAuditFinding[]> {
  const findings: SecurityAuditFinding[] = [];
  const platform = params.platform ?? process.platform;

  // Skip filesystem permission checks on Windows (different permission model).
  if (platform === 'win32') {
    findings.push({
      checkId: 'fs.windows_skipped',
      severity: 'info',
      title: 'Filesystem permission checks skipped on Windows',
      detail: 'POSIX permission checks are not applicable on Windows; use NTFS ACLs.',
    });
    return findings;
  }

  const statFn = params.statFn ?? fs.stat;

  // 63. fs.config_file_writable / 64. fs.config_file_world_readable
  if (params.configPath) {
    const perms = await inspectPathPermissions(params.configPath, statFn);
    if (perms?.ok) {
      if (perms.worldWritable || perms.groupWritable) {
        findings.push({
          checkId: 'fs.config_file_writable',
          severity: 'critical',
          title: 'Config file is writable by others',
          detail: `${params.configPath} has mode ${formatMode(perms.mode)}; another user could modify daemon configuration.`,
          remediation: `chmod 600 ${params.configPath}`,
        });
      } else if (perms.worldReadable) {
        findings.push({
          checkId: 'fs.config_file_world_readable',
          severity: 'warn',
          title: 'Config file is world-readable',
          detail: `${params.configPath} has mode ${formatMode(perms.mode)}; config may contain secrets.`,
          remediation: `chmod 600 ${params.configPath}`,
        });
      }
    }
  }

  // 65. fs.dotenv_permissions
  if (params.dotenvPath) {
    const perms = await inspectPathPermissions(params.dotenvPath, statFn);
    if (perms?.ok) {
      if (perms.worldReadable) {
        findings.push({
          checkId: 'env.dotenv_world_readable',
          severity: 'critical',
          title: '.env file is world-readable',
          detail: `${params.dotenvPath} has mode ${formatMode(perms.mode)}; .env files contain secrets.`,
          remediation: `chmod 600 ${params.dotenvPath}`,
        });
      } else if (perms.groupReadable) {
        findings.push({
          checkId: 'fs.dotenv_permissions',
          severity: 'warn',
          title: '.env file is group-readable',
          detail: `${params.dotenvPath} has mode ${formatMode(perms.mode)}; restrict to owner-only.`,
          remediation: `chmod 600 ${params.dotenvPath}`,
        });
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check: Dependency Scanning (2 checks)
// ---------------------------------------------------------------------------

export async function collectDependencyFindings(params: {
  projectDir: string;
  readFileFn?: typeof fs.readFile;
}): Promise<SecurityAuditFinding[]> {
  const findings: SecurityAuditFinding[] = [];
  const readFile = params.readFileFn ?? fs.readFile;

  let packageJson: Record<string, unknown>;
  try {
    const raw = await readFile(path.join(params.projectDir, 'package.json'), 'utf-8');
    packageJson = JSON.parse(raw as string);
  } catch {
    return findings;
  }

  const deps = {
    ...(packageJson.dependencies as Record<string, string> | undefined),
    ...(packageJson.devDependencies as Record<string, string> | undefined),
  };

  // 67. deps.known_vulnerabilities
  const riskyVersions: Array<{ pkg: string; version: string; reason: string }> = [];
  const knownRisky: Record<string, { vulnerable: string; reason: string }> = {
    'lodash': { vulnerable: '<4.17.21', reason: 'Prototype Pollution (CVE-2021-23337)' },
    'minimist': { vulnerable: '<1.2.6', reason: 'Prototype Pollution (CVE-2021-44906)' },
    'node-fetch': { vulnerable: '<2.6.7', reason: 'Exposure of Sensitive Information (CVE-2022-0235)' },
    'jsonwebtoken': { vulnerable: '<9.0.0', reason: 'Algorithm confusion (CVE-2022-23529)' },
    'axios': { vulnerable: '<0.21.1', reason: 'SSRF vulnerability (CVE-2021-3749)' },
  };

  for (const [pkgName, versionRange] of Object.entries(deps)) {
    const known = knownRisky[pkgName];
    if (!known) continue;
    const cleanVersion = (versionRange ?? '').replace(/^[\^~>=<]*/g, '');
    if (cleanVersion) {
      riskyVersions.push({ pkg: pkgName, version: cleanVersion, reason: known.reason });
    }
  }

  if (riskyVersions.length > 0) {
    findings.push({
      checkId: 'deps.known_vulnerabilities',
      severity: 'warn',
      title: 'Dependencies with known vulnerabilities detected',
      detail: riskyVersions
        .map((r) => `${r.pkg}@${r.version}: ${r.reason}`)
        .join('; '),
      remediation: 'Run "npm audit" and update affected packages. Consider using "npm audit fix".',
    });
  }

  // 68. deps.outdated_critical
  const securityCritical = ['jsonwebtoken', 'ws', 'helmet', 'cors'];
  const outdatedHints: string[] = [];
  for (const pkg of securityCritical) {
    if (deps[pkg]) {
      const version = deps[pkg].replace(/^[\^~>=<]*/g, '');
      const major = parseInt(version.split('.')[0], 10);
      if (!isNaN(major) && major === 0) {
        outdatedHints.push(`${pkg}@${version} (pre-1.0)`);
      }
    }
  }

  if (outdatedHints.length > 0) {
    findings.push({
      checkId: 'deps.outdated_critical',
      severity: 'warn',
      title: 'Security-critical dependencies may be outdated',
      detail: `Pre-1.0 versions of security packages: ${outdatedHints.join(', ')}`,
      remediation: 'Update these packages to their latest stable releases.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check: Plugin Code Safety (deep mode)
// ---------------------------------------------------------------------------

export async function collectPluginCodeSafetyFindings(params: {
  pluginDir: string;
}): Promise<SecurityAuditFinding[]> {
  const findings: SecurityAuditFinding[] = [];

  let scanSummary: SkillScanSummary;
  try {
    const { scanDirectoryWithSummary } = await import('./skill-scanner');
    scanSummary = await scanDirectoryWithSummary(params.pluginDir);
  } catch {
    findings.push({
      checkId: 'plugin.scan_failed',
      severity: 'warn',
      title: 'Plugin code scan failed',
      detail: `Could not scan ${params.pluginDir}; ensure the directory exists.`,
    });
    return findings;
  }

  if (scanSummary.critical > 0) {
    findings.push({
      checkId: 'plugin.critical_findings',
      severity: 'critical',
      title: `Plugin code scan found ${scanSummary.critical} critical issue(s)`,
      detail: scanSummary.findings
        .filter((f) => f.severity === 'critical')
        .map((f) => `${f.file}:${f.line} - ${f.message}`)
        .join('\n'),
      remediation: 'Review and fix critical findings before loading these plugins.',
    });
  }

  if (scanSummary.warn > 0) {
    findings.push({
      checkId: 'plugin.warn_findings',
      severity: 'warn',
      title: `Plugin code scan found ${scanSummary.warn} warning(s)`,
      detail: scanSummary.findings
        .filter((f) => f.severity === 'warn')
        .map((f) => `${f.file}:${f.line} - ${f.message}`)
        .join('\n'),
    });
  }

  if (scanSummary.scannedFiles > 0 && scanSummary.critical === 0 && scanSummary.warn === 0) {
    findings.push({
      checkId: 'plugin.scan_clean',
      severity: 'info',
      title: `Plugin code scan: ${scanSummary.scannedFiles} files clean`,
      detail: `Scanned ${scanSummary.scannedFiles} files with no critical or warning findings.`,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Deep: WebSocket Probe
// ---------------------------------------------------------------------------

async function defaultProbeWebSocket(
  url: string,
  timeoutMs: number,
): Promise<WebSocketProbeResult> {
  return new Promise((resolve) => {
    try {
      // Use dynamic import to avoid hard dependency on ws at module load time.
      const WebSocketLib = require('ws');
      const WS = WebSocketLib.WebSocket ?? WebSocketLib;
      const startTime = Date.now();
      const ws = new WS(url, { handshakeTimeout: timeoutMs });

      const timer = setTimeout(() => {
        ws.terminate();
        resolve({
          attempted: true,
          url,
          ok: false,
          error: `Connection timed out after ${timeoutMs}ms`,
          latencyMs: null,
        });
      }, timeoutMs);

      ws.on('open', () => {
        clearTimeout(timer);
        const latencyMs = Date.now() - startTime;
        ws.close();
        resolve({
          attempted: true,
          url,
          ok: true,
          error: null,
          latencyMs,
        });
      });

      ws.on('error', (err: Error) => {
        clearTimeout(timer);
        resolve({
          attempted: true,
          url,
          ok: false,
          error: err.message,
          latencyMs: null,
        });
      });
    } catch (err) {
      resolve({
        attempted: true,
        url,
        ok: false,
        error: String(err),
        latencyMs: null,
      });
    }
  });
}

async function maybeProbeWebSocket(params: {
  cfg: Config;
  timeoutMs: number;
  probe: (url: string, timeoutMs: number) => Promise<WebSocketProbeResult>;
}): Promise<WebSocketProbeResult> {
  const host = params.cfg.daemon?.host ?? '127.0.0.1';
  const port = params.cfg.daemon?.port ?? 8787;
  const url = `ws://${host}:${port}`;

  return params.probe(url, params.timeoutMs);
}

// ---------------------------------------------------------------------------
// Report Formatting
// ---------------------------------------------------------------------------

export function formatAuditReportText(report: SecurityAuditReport): string {
  const lines: string[] = [];
  lines.push('=== Wundr Security Audit Report ===');
  lines.push(`Version: ${report.version}`);
  lines.push(`Timestamp: ${new Date(report.ts).toISOString()}`);
  lines.push('');
  lines.push(`Summary: ${report.summary.critical} critical, ${report.summary.warn} warning, ${report.summary.info} info`);
  lines.push('');

  const grouped = new Map<string, SecurityAuditFinding[]>();
  for (const f of report.findings) {
    const category = f.checkId.split('.')[0];
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(f);
  }

  const severityOrder: Record<SecurityAuditSeverity, number> = {
    critical: 0,
    warn: 1,
    info: 2,
  };

  const severityLabel: Record<SecurityAuditSeverity, string> = {
    critical: 'CRITICAL',
    warn: 'WARNING ',
    info: 'INFO    ',
  };

  for (const [category, categoryFindings] of grouped) {
    lines.push(`--- ${category.toUpperCase()} ---`);
    const sorted = [...categoryFindings].sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
    );
    for (const f of sorted) {
      lines.push(`  [${severityLabel[f.severity]}] ${f.title}`);
      lines.push(`    ${f.detail}`);
      if (f.remediation) {
        lines.push(`    Fix: ${f.remediation}`);
      }
      lines.push('');
    }
  }

  if (report.deep?.websocket) {
    const ws = report.deep.websocket;
    lines.push('--- DEEP: WEBSOCKET PROBE ---');
    if (ws.ok) {
      lines.push(`  WebSocket reachable at ${ws.url} (${ws.latencyMs}ms)`);
    } else {
      lines.push(`  WebSocket probe failed: ${ws.error}`);
    }
    lines.push('');
  }

  if (report.deep?.pluginScan) {
    const ps = report.deep.pluginScan;
    lines.push('--- DEEP: PLUGIN SCAN ---');
    lines.push(`  Scanned ${ps.scannedFiles} files: ${ps.critical} critical, ${ps.warn} warn, ${ps.info} info`);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatAuditReportMarkdown(report: SecurityAuditReport): string {
  const lines: string[] = [];
  lines.push('# Wundr Security Audit Report');
  lines.push('');
  lines.push(`**Version:** ${report.version}`);
  lines.push(`**Generated:** ${new Date(report.ts).toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Severity | Count |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Critical | ${report.summary.critical} |`);
  lines.push(`| Warning  | ${report.summary.warn} |`);
  lines.push(`| Info     | ${report.summary.info} |`);
  lines.push('');

  if (report.summary.critical > 0) {
    lines.push('## Critical Findings');
    lines.push('');
    for (const f of report.findings.filter((x) => x.severity === 'critical')) {
      lines.push(`### ${f.title}`);
      lines.push(`**Check:** \`${f.checkId}\``);
      lines.push('');
      lines.push(f.detail);
      if (f.remediation) {
        lines.push('');
        lines.push(`**Remediation:** ${f.remediation}`);
      }
      lines.push('');
    }
  }

  if (report.summary.warn > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const f of report.findings.filter((x) => x.severity === 'warn')) {
      lines.push(`- **${f.title}** (\`${f.checkId}\`): ${f.detail}`);
    }
    lines.push('');
  }

  if (report.summary.info > 0) {
    lines.push('## Informational');
    lines.push('');
    for (const f of report.findings.filter((x) => x.severity === 'info')) {
      lines.push(`- **${f.title}** (\`${f.checkId}\`): ${f.detail}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main Audit Entry Point
// ---------------------------------------------------------------------------

export async function runSecurityAudit(
  opts: SecurityAuditOptions,
): Promise<SecurityAuditReport> {
  const findings: SecurityAuditFinding[] = [];
  const cfg = opts.config;
  const env = opts.env ?? process.env;
  const platform = opts.platform ?? process.platform;

  // --- Configuration checks (always run, no I/O) ---
  findings.push(...collectDaemonConfigFindings(cfg));
  findings.push(...collectWebSocketSecurityFindings(cfg));
  findings.push(...collectJwtSecurityFindings(cfg, env));
  findings.push(...collectCorsFindings(cfg));
  findings.push(...collectRateLimitFindings(cfg));
  findings.push(...collectTlsFindings(cfg, env));
  findings.push(...collectEnvSecurityFindings(env, cfg));
  findings.push(...collectLoggingFindings(cfg));
  findings.push(...collectApiKeyFindings(cfg, env));
  findings.push(...collectRedisSecurityFindings(cfg));
  findings.push(...collectDatabaseSecurityFindings(cfg));
  findings.push(...collectMcpToolSafetyFindings(cfg));
  findings.push(...collectDistributedSecurityFindings(cfg));
  findings.push(...collectNeolithSecurityFindings(cfg));

  // --- Filesystem checks (may involve I/O) ---
  if (opts.includeFilesystem !== false) {
    findings.push(
      ...(await collectFilesystemFindings({
        configPath: opts.configPath,
        dotenvPath: opts.dotenvPath,
        statFn: opts.statFn,
        platform,
      })),
    );
  }

  // --- Dependency scanning (reads package.json) ---
  if (opts.projectDir) {
    findings.push(
      ...(await collectDependencyFindings({
        projectDir: opts.projectDir,
        readFileFn: opts.readFileFn,
      })),
    );
  }

  // --- Deep mode: plugin source scanning ---
  let pluginScan: SkillScanSummary | undefined;
  if (opts.deep === true && opts.pluginDir) {
    const pluginFindings = await collectPluginCodeSafetyFindings({
      pluginDir: opts.pluginDir,
    });
    findings.push(...pluginFindings);

    try {
      const { scanDirectoryWithSummary } = await import('./skill-scanner');
      pluginScan = await scanDirectoryWithSummary(opts.pluginDir);
    } catch {
      // Already reported via collectPluginCodeSafetyFindings.
    }
  }

  // --- Deep mode: WebSocket probe ---
  let wsProbe: WebSocketProbeResult | undefined;
  if (opts.deep === true) {
    wsProbe = await maybeProbeWebSocket({
      cfg,
      timeoutMs: Math.max(250, opts.deepTimeoutMs ?? 5000),
      probe: opts.probeWebSocketFn ?? defaultProbeWebSocket,
    });

    if (wsProbe.attempted && !wsProbe.ok) {
      findings.push({
        checkId: 'ws.probe_failed',
        severity: 'warn',
        title: 'WebSocket probe failed (deep)',
        detail: wsProbe.error ?? 'WebSocket unreachable',
        remediation: 'Verify the daemon is running and accessible, then re-run with --deep.',
      });
    }
  }

  const summary = countBySeverity(findings);

  return {
    ts: Date.now(),
    version: AUDIT_VERSION,
    summary,
    findings,
    deep:
      opts.deep === true
        ? {
            websocket: wsProbe,
            pluginScan,
          }
        : undefined,
  };
}
