/**
 * Security Audit Engine for Wundr Orchestrator Daemon
 *
 * Ported and adapted from OpenClaw's security/audit.ts.
 * Provides 60+ automated security checks covering daemon configuration,
 * WebSocket security, JWT validation, CORS, rate limiting, TLS, environment
 * variables, API keys, Redis, database, MCP tool safety, distributed cluster
 * security, filesystem permissions, dependency scanning, plugin code safety,
 * monitoring, memory/resource limits, and token budget controls.
 *
 * Severity levels: critical, high, medium, low, info
 * Report formats: JSON, plain text, Markdown, HTML
 * Progress callbacks for long-running audits.
 * Auto-fix suggestions for every finding.
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

export type SecurityAuditSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info';

export type SecurityAuditFinding = {
  checkId: string;
  severity: SecurityAuditSeverity;
  title: string;
  detail: string;
  remediation: string;
  autoFix?: string;
};

export type SecurityAuditSummary = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
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

export type ProgressPhase =
  | 'config'
  | 'websocket'
  | 'jwt'
  | 'cors'
  | 'rateLimit'
  | 'tls'
  | 'env'
  | 'logging'
  | 'apiKeys'
  | 'redis'
  | 'database'
  | 'mcp'
  | 'distributed'
  | 'neolith'
  | 'monitoring'
  | 'memory'
  | 'tokenBudget'
  | 'filesystem'
  | 'dependencies'
  | 'plugins'
  | 'wsProbe'
  | 'complete';

export type ProgressCallback = (
  phase: ProgressPhase,
  done: number,
  total: number
) => void;

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
  probeWebSocketFn?: (
    url: string,
    timeoutMs: number
  ) => Promise<WebSocketProbeResult>;
  /** Override fs.stat for testing. */
  statFn?: typeof fs.stat;
  /** Override fs.access for testing. */
  accessFn?: typeof fs.access;
  /** Override fs.readFile for testing. */
  readFileFn?: typeof fs.readFile;
  /** Progress callback for long-running audits. */
  onProgress?: ProgressCallback;
};

const AUDIT_VERSION = '2.0.0';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countBySeverity(
  findings: SecurityAuditFinding[]
): SecurityAuditSummary {
  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;
  let info = 0;
  for (const f of findings) {
    switch (f.severity) {
      case 'critical':
        critical += 1;
        break;
      case 'high':
        high += 1;
        break;
      case 'medium':
        medium += 1;
        break;
      case 'low':
        low += 1;
        break;
      case 'info':
        info += 1;
        break;
    }
  }
  return { critical, high, medium, low, info, total: findings.length };
}

/**
 * Compute Shannon entropy of a string (bits per character).
 * Used for JWT secret strength validation.
 */
function shannonEntropy(s: string): number {
  if (s.length === 0) {
    return 0;
  }
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
  if (!match) {
    return null;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 3600 * 1000;
    case 'd':
      return value * 86400 * 1000;
    default:
      return null;
  }
}

/** Default JWT secret string from the config loader. */
const DEFAULT_JWT_SECRET =
  'change-this-in-production-to-a-random-secure-string';

const SEVERITY_ORDER: Record<SecurityAuditSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// ---------------------------------------------------------------------------
// Check 01-06: Daemon Configuration
// ---------------------------------------------------------------------------

export function collectDaemonConfigFindings(
  cfg: Config
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const host = cfg.daemon?.host ?? '127.0.0.1';
  const maxSessions = cfg.daemon?.maxSessions ?? 100;
  const verbose = cfg.daemon?.verbose ?? false;
  const name = cfg.daemon?.name ?? 'orchestrator-daemon';
  const env = cfg.env ?? 'development';
  const port = cfg.daemon?.port ?? 8787;

  // 01. daemon.host_all_interfaces
  if (host === '0.0.0.0') {
    findings.push({
      checkId: 'daemon.host_all_interfaces',
      severity: 'critical',
      title: 'Daemon binds to all interfaces',
      detail:
        'daemon.host="0.0.0.0" exposes the daemon on every network interface, including public ones.',
      remediation:
        'Set daemon.host to "127.0.0.1" or a specific private interface address.',
      autoFix: 'DAEMON_HOST=127.0.0.1',
    });
  } else if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
    // 02. daemon.host_not_loopback
    findings.push({
      checkId: 'daemon.host_not_loopback',
      severity: 'high',
      title: 'Daemon binds beyond loopback',
      detail: `daemon.host="${host}" is not loopback; ensure network-level access control is in place.`,
      remediation:
        'Prefer "127.0.0.1" unless remote access is intentional; add firewall rules.',
      autoFix: 'DAEMON_HOST=127.0.0.1',
    });
  }

  // 03. daemon.max_sessions_unlimited
  if (maxSessions <= 0) {
    findings.push({
      checkId: 'daemon.max_sessions_unlimited',
      severity: 'critical',
      title: 'No session limit configured',
      detail:
        'daemon.maxSessions is zero or negative, allowing unlimited sessions.',
      remediation: 'Set daemon.maxSessions to a positive integer (e.g., 100).',
      autoFix: 'DAEMON_MAX_SESSIONS=100',
    });
  } else if (maxSessions > 500) {
    // 04. daemon.max_sessions_excessive
    findings.push({
      checkId: 'daemon.max_sessions_excessive',
      severity: 'low',
      title: 'Session limit is very high',
      detail: `daemon.maxSessions=${maxSessions} may cause resource exhaustion under load.`,
      remediation:
        'Consider lowering maxSessions unless your hardware can sustain this load.',
      autoFix: 'DAEMON_MAX_SESSIONS=200',
    });
  }

  // 05. daemon.default_name
  if (name === 'orchestrator-daemon') {
    findings.push({
      checkId: 'daemon.default_name',
      severity: 'info',
      title: 'Daemon uses default name',
      detail:
        'daemon.name is the default "orchestrator-daemon"; consider a unique identifier for multi-node setups.',
      remediation: 'Set DAEMON_NAME to a unique identifier for this node.',
      autoFix: 'DAEMON_NAME=wundr-node-01',
    });
  }

  // 06. daemon.verbose_production
  if (verbose && env === 'production') {
    findings.push({
      checkId: 'daemon.verbose_production',
      severity: 'medium',
      title: 'Verbose mode enabled in production',
      detail: 'daemon.verbose=true in production may log sensitive data.',
      remediation: 'Set daemon.verbose=false in production.',
      autoFix: 'DAEMON_VERBOSE=false',
    });
  }

  // 07. daemon.default_port
  if (port === 8787 && env === 'production') {
    findings.push({
      checkId: 'daemon.default_port',
      severity: 'low',
      title: 'Daemon uses default port in production',
      detail: `daemon.port=${port} is the well-known default; scanners may target it.`,
      remediation: 'Consider using a non-default port in production.',
      autoFix: 'DAEMON_PORT=9443',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 08-16: WebSocket Security
// ---------------------------------------------------------------------------

export function collectWebSocketSecurityFindings(
  cfg: Config
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const host = cfg.daemon?.host ?? '127.0.0.1';
  const jwtSecret = cfg.security?.jwtSecret;
  const hasAuth =
    typeof jwtSecret === 'string' &&
    jwtSecret.trim().length > 0 &&
    jwtSecret !== DEFAULT_JWT_SECRET;
  const isLoopback =
    host === '127.0.0.1' || host === 'localhost' || host === '::1';

  // 08. ws.no_auth
  if (!hasAuth && !isLoopback) {
    findings.push({
      checkId: 'ws.no_auth',
      severity: 'critical',
      title: 'WebSocket server has no authentication',
      detail:
        'The daemon binds beyond loopback but has no JWT secret configured (or uses the default).',
      remediation:
        'Set DAEMON_JWT_SECRET to a strong random value (at least 32 characters).',
      autoFix: 'DAEMON_JWT_SECRET=$(openssl rand -base64 64)',
    });
  }

  // 09. ws.no_origin_validation
  const corsEnabled = cfg.security?.cors?.enabled ?? false;
  const corsOrigins = cfg.security?.cors?.origins ?? [];
  if (!corsEnabled || corsOrigins.length === 0) {
    findings.push({
      checkId: 'ws.no_origin_validation',
      severity: 'medium',
      title: 'No origin validation on WebSocket connections',
      detail:
        'CORS is disabled or has no origins configured; WebSocket upgrades will not validate the Origin header.',
      remediation: 'Enable CORS and configure specific allowed origins.',
      autoFix:
        'DAEMON_CORS_ENABLED=true\nDAEMON_CORS_ORIGINS=https://your-app.example.com',
    });
  }

  // 10. ws.no_message_size_limit
  findings.push({
    checkId: 'ws.no_message_size_limit',
    severity: 'medium',
    title: 'No WebSocket message size limit configured',
    detail:
      'The WebSocket server does not set maxPayload; a malicious client could send very large messages.',
    remediation:
      'Configure ws.Server with maxPayload (e.g., 1 MB) to prevent memory exhaustion.',
    autoFix: 'Set maxPayload: 1048576 in ws.Server options.',
  });

  // 11. ws.no_rate_limit
  const rateLimitEnabled = cfg.security?.rateLimit?.enabled ?? true;
  if (!rateLimitEnabled) {
    findings.push({
      checkId: 'ws.no_rate_limit',
      severity: 'high',
      title: 'No per-client rate limiting on WebSocket',
      detail:
        'Rate limiting is disabled; clients can flood the server with messages.',
      remediation:
        'Enable security.rateLimit and configure appropriate max/windowMs values.',
      autoFix: 'DAEMON_RATE_LIMIT_ENABLED=true',
    });
  }

  // 12. ws.no_heartbeat_timeout
  const heartbeatInterval = cfg.health?.heartbeatInterval ?? 30000;
  if (heartbeatInterval > 120000) {
    findings.push({
      checkId: 'ws.no_heartbeat_timeout',
      severity: 'low',
      title: 'WebSocket heartbeat interval is very long',
      detail: `health.heartbeatInterval=${heartbeatInterval}ms; stale connections may persist.`,
      remediation:
        'Keep heartbeat interval under 60s for timely detection of dead connections.',
      autoFix: 'DAEMON_HEARTBEAT_INTERVAL=30000',
    });
  }

  // 13. ws.broadcast_unrestricted
  findings.push({
    checkId: 'ws.broadcast_unrestricted',
    severity: 'info',
    title: 'WebSocket broadcasts reach all session subscribers',
    detail:
      'Any client subscribed to a session receives all messages for that session. Ensure session IDs are not guessable.',
    remediation:
      'Use crypto.randomUUID() for session identifiers and validate subscription requests.',
    autoFix: 'Verify session ID generation uses crypto.randomUUID().',
  });

  // 14. ws.no_tls
  if (!isLoopback) {
    findings.push({
      checkId: 'ws.no_tls',
      severity: 'critical',
      title: 'WebSocket not using TLS',
      detail:
        'The daemon serves unencrypted ws:// connections on a non-loopback interface.',
      remediation:
        'Terminate TLS in front of the daemon (reverse proxy or direct wss://).',
      autoFix: 'Configure nginx/Caddy reverse proxy with TLS termination.',
    });
  }

  // 15. ws.session_fixation
  findings.push({
    checkId: 'ws.session_fixation',
    severity: 'info',
    title: 'Ensure session IDs are cryptographically random',
    detail:
      'Session identifiers must be generated with crypto.randomUUID() or equivalent to prevent session fixation.',
    remediation: 'Audit session ID generation code for use of CSPRNG.',
    autoFix: 'Replace any Math.random()-based IDs with crypto.randomUUID().',
  });

  // 16. ws.connection_timeout_missing
  const shutdownTimeout = cfg.health?.shutdownTimeout ?? 10000;
  if (shutdownTimeout > 60000) {
    findings.push({
      checkId: 'ws.connection_timeout_excessive',
      severity: 'low',
      title: 'WebSocket shutdown timeout is very long',
      detail: `health.shutdownTimeout=${shutdownTimeout}ms; hanging connections delay graceful shutdown.`,
      remediation: 'Keep shutdown timeout under 30 seconds.',
      autoFix: 'DAEMON_SHUTDOWN_TIMEOUT=10000',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 17-24: JWT / Authentication
// ---------------------------------------------------------------------------

export function collectJwtSecurityFindings(
  cfg: Config,
  env: NodeJS.ProcessEnv
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const secret = cfg.security?.jwtSecret ?? '';
  const expiration = cfg.security?.jwtExpiration ?? '24h';

  // 17. jwt.secret_default
  if (secret === DEFAULT_JWT_SECRET) {
    findings.push({
      checkId: 'jwt.secret_default',
      severity: 'critical',
      title: 'JWT secret is the hardcoded default',
      detail:
        'security.jwtSecret is the placeholder default from the codebase. Anyone with source access can forge tokens.',
      remediation:
        'Set DAEMON_JWT_SECRET to a unique random string of at least 64 characters.',
      autoFix: 'DAEMON_JWT_SECRET=$(openssl rand -base64 64)',
    });
  }

  // 18. jwt.secret_too_short
  if (
    secret.length > 0 &&
    secret.length < 32 &&
    secret !== DEFAULT_JWT_SECRET
  ) {
    findings.push({
      checkId: 'jwt.secret_too_short',
      severity: 'critical',
      title: 'JWT secret is too short',
      detail: `security.jwtSecret is ${secret.length} characters; secrets under 32 chars are brute-forceable.`,
      remediation:
        'Use a JWT secret of at least 64 characters generated with a CSPRNG.',
      autoFix: 'DAEMON_JWT_SECRET=$(openssl rand -base64 64)',
    });
  }

  // 19. jwt.secret_low_entropy
  if (secret.length >= 32 && secret !== DEFAULT_JWT_SECRET) {
    const entropy = shannonEntropy(secret);
    if (entropy < 3.0) {
      findings.push({
        checkId: 'jwt.secret_low_entropy',
        severity: 'high',
        title: 'JWT secret has low entropy',
        detail: `security.jwtSecret has Shannon entropy of ${entropy.toFixed(2)} bits/char; consider a more random value.`,
        remediation:
          "Generate a secret with: node -e \"console.log(require('crypto').randomBytes(64).toString('base64'))\"",
        autoFix:
          "DAEMON_JWT_SECRET=$(node -e \"console.log(require('crypto').randomBytes(64).toString('base64'))\")",
      });
    }
  }

  // 20. jwt.expiration_too_long
  const expirationMs = parseDurationMs(expiration);
  const twentyFourHoursMs = 24 * 3600 * 1000;
  if (expirationMs !== null && expirationMs > twentyFourHoursMs) {
    findings.push({
      checkId: 'jwt.expiration_too_long',
      severity: 'medium',
      title: 'JWT expiration is longer than 24 hours',
      detail: `security.jwtExpiration="${expiration}" means stolen tokens remain valid for a long time.`,
      remediation:
        'Set jwtExpiration to "1h" or less and implement refresh token rotation.',
      autoFix: 'DAEMON_JWT_EXPIRATION=1h',
    });
  }

  // 21. jwt.no_expiration
  if (!expiration || expiration.trim() === '' || expiration === '0') {
    findings.push({
      checkId: 'jwt.no_expiration',
      severity: 'critical',
      title: 'JWT tokens have no expiration',
      detail: 'security.jwtExpiration is empty or zero; tokens never expire.',
      remediation:
        'Set jwtExpiration to a reasonable duration like "1h" or "24h".',
      autoFix: 'DAEMON_JWT_EXPIRATION=24h',
    });
  }

  // 22. jwt.no_refresh_rotation
  findings.push({
    checkId: 'jwt.no_refresh_rotation',
    severity: 'low',
    title: 'No refresh token rotation configured',
    detail:
      'The daemon does not implement refresh token rotation; long-lived tokens increase risk.',
    remediation: 'Implement refresh token rotation for production deployments.',
    autoFix:
      'Implement a /auth/refresh endpoint with one-time-use refresh tokens.',
  });

  // 23. jwt.algorithm_none
  findings.push({
    checkId: 'jwt.algorithm_none',
    severity: 'info',
    title: 'Verify JWT library rejects "none" algorithm',
    detail:
      'Ensure the JWT verification code explicitly specifies allowed algorithms and rejects "none".',
    remediation: 'Pass { algorithms: ["HS256"] } to jwt.verify() calls.',
    autoFix: 'Add algorithms: ["HS256"] to all jwt.verify() option objects.',
  });

  // 24. jwt.secret_in_config_file
  const secretFromEnv = env.DAEMON_JWT_SECRET;
  if (secret !== DEFAULT_JWT_SECRET && secret.length > 0 && !secretFromEnv) {
    findings.push({
      checkId: 'jwt.secret_in_config_file',
      severity: 'high',
      title: 'JWT secret may be hardcoded in config',
      detail:
        'DAEMON_JWT_SECRET environment variable is not set; the secret may be hardcoded in source.',
      remediation:
        'Set DAEMON_JWT_SECRET as an environment variable rather than in source code.',
      autoFix:
        'export DAEMON_JWT_SECRET="<your-secret>" in your shell profile or .env file.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 25-28: CORS
// ---------------------------------------------------------------------------

export function collectCorsFindings(cfg: Config): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const corsEnabled = cfg.security?.cors?.enabled ?? false;
  const origins = cfg.security?.cors?.origins ?? [];
  const envMode = cfg.env ?? 'development';

  // 25. cors.wildcard_origin
  if (corsEnabled && origins.includes('*')) {
    findings.push({
      checkId: 'cors.wildcard_origin',
      severity: 'critical',
      title: 'CORS allows all origins',
      detail:
        'security.cors.origins contains "*", allowing any website to make cross-origin requests.',
      remediation: 'Replace "*" with specific allowed origins.',
      autoFix: 'DAEMON_CORS_ORIGINS=https://your-app.example.com',
    });
  }

  // 26. cors.disabled_in_production
  if (!corsEnabled && envMode === 'production') {
    findings.push({
      checkId: 'cors.disabled_in_production',
      severity: 'info',
      title: 'CORS is disabled in production',
      detail:
        'CORS is disabled. This is fine if no browser clients connect directly.',
      remediation: 'Enable CORS if browser-based clients need to connect.',
      autoFix: 'DAEMON_CORS_ENABLED=true (only if browser clients connect)',
    });
  }

  // 27. cors.localhost_in_production
  if (corsEnabled && envMode === 'production') {
    const hasLocalhost = origins.some(
      o => o.includes('localhost') || o.includes('127.0.0.1')
    );
    if (hasLocalhost) {
      findings.push({
        checkId: 'cors.localhost_in_production',
        severity: 'medium',
        title: 'CORS allows localhost in production',
        detail:
          'security.cors.origins includes a localhost origin in production mode.',
        remediation:
          'Remove localhost origins from production CORS configuration.',
        autoFix: 'Remove localhost entries from DAEMON_CORS_ORIGINS.',
      });
    }
  }

  // 28. cors.missing_credentials
  if (corsEnabled && origins.includes('*')) {
    findings.push({
      checkId: 'cors.missing_credentials',
      severity: 'medium',
      title: 'CORS wildcard with potential credentials',
      detail:
        'Wildcard origin ("*") combined with credentials is rejected by browsers but indicates a misconfiguration.',
      remediation:
        'Use specific origins when credentials (cookies, auth headers) are required.',
      autoFix: 'DAEMON_CORS_ORIGINS=https://your-app.example.com',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 29-31: Rate Limiting
// ---------------------------------------------------------------------------

export function collectRateLimitFindings(cfg: Config): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const enabled = cfg.security?.rateLimit?.enabled ?? true;
  const max = cfg.security?.rateLimit?.max ?? 100;
  const windowMs = cfg.security?.rateLimit?.windowMs ?? 60000;

  // 29. rate_limit.disabled
  if (!enabled) {
    findings.push({
      checkId: 'rate_limit.disabled',
      severity: 'high',
      title: 'Rate limiting is disabled',
      detail:
        'security.rateLimit.enabled=false; the daemon is vulnerable to denial-of-service.',
      remediation:
        'Enable rate limiting with reasonable limits (e.g., 100 requests per 60 seconds).',
      autoFix: 'DAEMON_RATE_LIMIT_ENABLED=true',
    });
  }

  // 30. rate_limit.too_permissive
  if (enabled && max > 1000) {
    findings.push({
      checkId: 'rate_limit.too_permissive',
      severity: 'medium',
      title: 'Rate limit is very permissive',
      detail: `security.rateLimit.max=${max}; allowing over 1000 requests per window is likely too generous.`,
      remediation: 'Lower max to 100-500 depending on expected traffic.',
      autoFix: 'DAEMON_RATE_LIMIT_MAX=200',
    });
  }

  // 31. rate_limit.window_too_large
  if (enabled && windowMs > 300000) {
    findings.push({
      checkId: 'rate_limit.window_too_large',
      severity: 'low',
      title: 'Rate limit window is very large',
      detail: `security.rateLimit.windowMs=${windowMs}ms (${(windowMs / 60000).toFixed(1)} min); bursts within the window may be harmful.`,
      remediation:
        'Consider a shorter window (e.g., 60 seconds) for more responsive limiting.',
      autoFix: 'DAEMON_RATE_LIMIT_WINDOW=60000',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 32-35: TLS / Transport
// ---------------------------------------------------------------------------

export function collectTlsFindings(
  cfg: Config,
  env: NodeJS.ProcessEnv
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const host = cfg.daemon?.host ?? '127.0.0.1';
  const isLoopback =
    host === '127.0.0.1' || host === 'localhost' || host === '::1';
  const nodeEnv = cfg.env ?? 'development';

  // 32. tls.no_https
  if (!isLoopback && nodeEnv === 'production') {
    findings.push({
      checkId: 'tls.no_https',
      severity: 'critical',
      title: 'No TLS configured for production',
      detail:
        'The daemon serves plain HTTP/WS on a non-loopback interface in production.',
      remediation:
        'Terminate TLS via a reverse proxy (nginx, Caddy) or configure HTTPS directly.',
      autoFix:
        'Deploy behind a reverse proxy with TLS termination (e.g., Caddy with automatic HTTPS).',
    });
  }

  // 33. tls.self_signed
  const tlsCert = env.TLS_CERT_PATH;
  const tlsKey = env.TLS_KEY_PATH;
  if (tlsCert && tlsKey) {
    findings.push({
      checkId: 'tls.self_signed',
      severity: 'info',
      title: 'Verify TLS certificate is not self-signed',
      detail: `TLS_CERT_PATH is set to "${tlsCert}"; ensure this is a valid CA-signed certificate for production.`,
      remediation: "Use a certificate from Let's Encrypt or a trusted CA.",
      autoFix: 'Use certbot or Caddy for automatic CA-signed certificates.',
    });
  }

  // 34. tls.weak_protocol
  const nodeOptions = env.NODE_OPTIONS ?? '';
  const hasWeakTls =
    nodeOptions.includes('--tls-min-v1.0') ||
    nodeOptions.includes('--tls-min-v1.1');
  if (hasWeakTls) {
    findings.push({
      checkId: 'tls.weak_protocol',
      severity: 'critical',
      title: 'Weak TLS protocol version allowed',
      detail:
        'NODE_OPTIONS allows TLS 1.0 or 1.1 which are deprecated and insecure.',
      remediation:
        'Remove --tls-min-v1.0 and --tls-min-v1.1 from NODE_OPTIONS; require TLS 1.2+.',
      autoFix:
        'Remove --tls-min-v1.0 and --tls-min-v1.1 from NODE_OPTIONS environment variable.',
    });
  }

  // 35. tls.weak_cipher
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
        autoFix: `Remove ${weak} from --tls-cipher-list in NODE_OPTIONS.`,
      });
      break;
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 36-41: Environment Variables
// ---------------------------------------------------------------------------

export function collectEnvSecurityFindings(
  env: NodeJS.ProcessEnv,
  cfg: Config
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const nodeEnv = cfg.env ?? env.NODE_ENV ?? 'development';

  // 36. env.api_key_missing
  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.trim().length === 0) {
    findings.push({
      checkId: 'env.api_key_missing',
      severity: 'info',
      title: 'OPENAI_API_KEY is not set',
      detail:
        'The primary LLM API key is missing; the daemon will fail to process tasks.',
      remediation: 'Set OPENAI_API_KEY in your environment or .env file.',
      autoFix: 'export OPENAI_API_KEY="sk-..."',
    });
  }

  // 37. env.secrets_in_dotenv
  findings.push({
    checkId: 'env.secrets_in_dotenv',
    severity: 'info',
    title: 'Ensure .env files are excluded from version control',
    detail:
      'If a .env file exists, verify it is listed in .gitignore to prevent secret leakage.',
    remediation: 'Add .env and .env.* to your .gitignore file.',
    autoFix: 'echo ".env\\n.env.*" >> .gitignore',
  });

  // 38. env.debug_enabled_production
  if (
    nodeEnv === 'production' &&
    (env.DEBUG === 'true' || env.DEBUG === '1' || cfg.debug === true)
  ) {
    findings.push({
      checkId: 'env.debug_enabled_production',
      severity: 'high',
      title: 'Debug mode enabled in production',
      detail:
        'DEBUG is enabled in production; debug output may leak sensitive information.',
      remediation: 'Unset DEBUG or set it to false in production environments.',
      autoFix: 'unset DEBUG',
    });
  }

  // 39. env.node_env_missing
  if (!env.NODE_ENV) {
    findings.push({
      checkId: 'env.node_env_missing',
      severity: 'medium',
      title: 'NODE_ENV is not set',
      detail:
        'NODE_ENV is missing; the daemon defaults to "development" which may enable unsafe behaviors.',
      remediation: 'Set NODE_ENV=production for production deployments.',
      autoFix: 'export NODE_ENV=production',
    });
  }

  // 40. env.sensitive_vars_logged
  const sensitiveVars = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'DAEMON_JWT_SECRET',
    'REDIS_PASSWORD',
    'DATABASE_URL',
    'NEOLITH_API_SECRET',
  ];
  const logLevel = cfg.logging?.level ?? 'info';
  if (logLevel === 'debug' && nodeEnv === 'production') {
    const present = sensitiveVars.filter(
      v => env[v] && env[v]!.trim().length > 0
    );
    if (present.length > 0) {
      findings.push({
        checkId: 'env.sensitive_vars_logged',
        severity: 'high',
        title: 'Sensitive env vars may appear in debug logs',
        detail: `Log level is "debug" in production with ${present.length} sensitive env vars set (${present.join(', ')}).`,
        remediation: 'Set logging.level to "info" or higher in production.',
        autoFix: 'LOG_LEVEL=info',
      });
    }
  }

  // 41. env.path_manipulation
  const nodeEnvPath = env.NODE_PATH;
  if (nodeEnvPath && nodeEnvPath.includes('/tmp')) {
    findings.push({
      checkId: 'env.path_manipulation',
      severity: 'high',
      title: 'NODE_PATH includes a world-writable directory',
      detail: `NODE_PATH="${nodeEnvPath}" includes /tmp; attackers could plant malicious modules.`,
      remediation:
        'Remove /tmp and other world-writable directories from NODE_PATH.',
      autoFix: 'Remove /tmp entries from NODE_PATH environment variable.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 42-44: Logging
// ---------------------------------------------------------------------------

export function collectLoggingFindings(cfg: Config): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const level = cfg.logging?.level ?? 'info';
  const file = cfg.logging?.file;
  const rotationEnabled = cfg.logging?.rotation?.enabled ?? true;
  const envMode = cfg.env ?? 'development';

  // 42. logging.debug_in_production
  if (level === 'debug' && envMode === 'production') {
    findings.push({
      checkId: 'logging.debug_in_production',
      severity: 'medium',
      title: 'Debug log level in production',
      detail:
        'logging.level="debug" in production can leak sensitive request/response data.',
      remediation: 'Set logging.level to "info" or "warn" in production.',
      autoFix: 'LOG_LEVEL=info',
    });
  }

  // 43. logging.no_file_logging
  if (!file && envMode === 'production') {
    findings.push({
      checkId: 'logging.no_file_logging',
      severity: 'low',
      title: 'No file logging configured in production',
      detail:
        'logging.file is not set; logs go only to stdout which may be lost.',
      remediation: 'Configure logging.file for persistent audit trail.',
      autoFix: 'LOG_FILE=/var/log/wundr/daemon.log',
    });
  }

  // 44. logging.no_rotation
  if (file && !rotationEnabled) {
    findings.push({
      checkId: 'logging.no_rotation',
      severity: 'medium',
      title: 'Log rotation is disabled',
      detail: 'logging.rotation.enabled=false; log files will grow unbounded.',
      remediation: 'Enable log rotation with appropriate maxSize and maxFiles.',
      autoFix: 'LOG_ROTATION_ENABLED=true',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 45-48: API Key Security
// ---------------------------------------------------------------------------

export function collectApiKeyFindings(
  cfg: Config,
  env: NodeJS.ProcessEnv
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];

  // 45. api.openai_key_exposed
  const openaiKey = cfg.openai?.apiKey ?? '';
  if (
    openaiKey.length > 0 &&
    openaiKey.startsWith('sk-') &&
    !env.OPENAI_API_KEY
  ) {
    findings.push({
      checkId: 'api.openai_key_exposed',
      severity: 'critical',
      title: 'OpenAI API key appears hardcoded',
      detail:
        'openai.apiKey contains what looks like a real API key not sourced from an env var.',
      remediation:
        'Set OPENAI_API_KEY as an environment variable and remove it from config.',
      autoFix:
        'export OPENAI_API_KEY="<your-key>" and remove apiKey from config files.',
    });
  }

  // 46. api.anthropic_key_exposed
  const anthropicKey = cfg.anthropic?.apiKey ?? '';
  if (
    anthropicKey.length > 0 &&
    anthropicKey.startsWith('sk-ant-') &&
    !env.ANTHROPIC_API_KEY
  ) {
    findings.push({
      checkId: 'api.anthropic_key_exposed',
      severity: 'critical',
      title: 'Anthropic API key appears hardcoded',
      detail:
        'anthropic.apiKey contains what looks like a real API key not sourced from an env var.',
      remediation:
        'Set ANTHROPIC_API_KEY as an environment variable and remove it from config.',
      autoFix:
        'export ANTHROPIC_API_KEY="<your-key>" and remove apiKey from config files.',
    });
  }

  // 47. api.neolith_secret_exposed
  const neolithSecret = cfg.neolith?.apiSecret ?? '';
  if (neolithSecret.length > 0 && !env.NEOLITH_API_SECRET) {
    findings.push({
      checkId: 'api.neolith_secret_exposed',
      severity: 'high',
      title: 'Neolith API secret appears hardcoded',
      detail:
        'neolith.apiSecret is set but NEOLITH_API_SECRET env var is not; secret may be in source.',
      remediation: 'Set NEOLITH_API_SECRET as an environment variable.',
      autoFix: 'export NEOLITH_API_SECRET="<your-secret>"',
    });
  }

  // 48. api.key_in_source
  if (openaiKey.startsWith('sk-') || anthropicKey.startsWith('sk-ant-')) {
    findings.push({
      checkId: 'api.key_in_source',
      severity: 'info',
      title: 'API keys detected in loaded config',
      detail:
        'API keys matching known provider prefixes are present in the running config.',
      remediation:
        'Ensure API keys come from environment variables, not hardcoded values.',
      autoFix:
        'Move all API keys to environment variables or a secret manager.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 49-51: Redis Security
// ---------------------------------------------------------------------------

export function collectRedisSecurityFindings(
  cfg: Config
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const redis = cfg.redis;

  if (!redis?.url) {
    return findings;
  }

  // 49. redis.no_password
  if (!redis.password && !redis.url.includes('@')) {
    findings.push({
      checkId: 'redis.no_password',
      severity: 'high',
      title: 'Redis has no password configured',
      detail:
        'redis.password is empty and the URL has no credentials; Redis is unauthenticated.',
      remediation:
        'Set REDIS_PASSWORD or include credentials in the Redis URL.',
      autoFix: 'export REDIS_PASSWORD="<strong-password>"',
    });
  }

  // 50. redis.no_tls
  if (
    redis.url.startsWith('redis://') &&
    !redis.url.includes('localhost') &&
    !redis.url.includes('127.0.0.1')
  ) {
    findings.push({
      checkId: 'redis.no_tls',
      severity: 'high',
      title: 'Redis connection without TLS',
      detail:
        'redis.url uses redis:// (not rediss://) to a non-local host; data is sent in cleartext.',
      remediation: 'Use rediss:// for TLS-encrypted Redis connections.',
      autoFix: 'Change redis:// to rediss:// in REDIS_URL.',
    });
  }

  // 51. redis.default_port_exposed
  try {
    const url = new URL(redis.url);
    if (
      (url.port === '6379' || url.port === '') &&
      url.hostname !== 'localhost' &&
      url.hostname !== '127.0.0.1'
    ) {
      findings.push({
        checkId: 'redis.default_port_exposed',
        severity: 'low',
        title: 'Redis uses default port on non-local host',
        detail: `Redis is on ${url.hostname}:${url.port || '6379'}; the default port is a common scan target.`,
        remediation: 'Consider using a non-default port and firewall rules.',
        autoFix:
          'Configure Redis to listen on a non-default port (e.g., 16379).',
      });
    }
  } catch {
    // Invalid URL; skip this check.
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 52-54: Database Security
// ---------------------------------------------------------------------------

export function collectDatabaseSecurityFindings(
  cfg: Config
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const db = cfg.database;

  if (!db?.url) {
    return findings;
  }

  // 52. database.credentials_in_url
  try {
    const url = new URL(db.url);
    if (url.password && url.password.length > 0) {
      findings.push({
        checkId: 'database.credentials_in_url',
        severity: 'medium',
        title: 'Database credentials embedded in URL',
        detail:
          'database.url contains a password; prefer separate credential management.',
        remediation:
          'Use environment variables for database credentials rather than embedding them in the URL.',
        autoFix:
          'Use separate DATABASE_USER and DATABASE_PASSWORD environment variables.',
      });
    }
  } catch {
    // Not a standard URL format; skip.
  }

  // 53. database.no_ssl
  if (
    db.url &&
    !db.url.includes('sslmode=require') &&
    !db.url.includes('ssl=true') &&
    !db.url.includes('sslmode=verify')
  ) {
    const isLocal =
      db.url.includes('localhost') || db.url.includes('127.0.0.1');
    if (!isLocal) {
      findings.push({
        checkId: 'database.no_ssl',
        severity: 'high',
        title: 'Database connection may lack SSL',
        detail:
          'database.url does not include sslmode=require or ssl=true for a non-local host.',
        remediation: 'Add sslmode=require to the database connection string.',
        autoFix: 'Append ?sslmode=require to DATABASE_URL.',
      });
    }
  }

  // 54. database.pool_unlimited
  const poolSize = db.poolSize ?? 10;
  if (poolSize > 100) {
    findings.push({
      checkId: 'database.pool_unlimited',
      severity: 'low',
      title: 'Database pool size is very large',
      detail: `database.poolSize=${poolSize}; large pools can exhaust database connection limits.`,
      remediation:
        'Keep poolSize reasonable (10-50) and monitor connection usage.',
      autoFix: 'DATABASE_POOL_SIZE=20',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 55-58: MCP Tool Safety
// ---------------------------------------------------------------------------

export function collectMcpToolSafetyFindings(
  _cfg: Config
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];

  // 55. mcp.safety_checks_disabled
  findings.push({
    checkId: 'mcp.safety_checks_disabled',
    severity: 'info',
    title: 'Verify MCP tool safety checks are enabled',
    detail:
      'The McpToolRegistryImpl has safetyChecks; ensure they are not overridden to false.',
    remediation: 'Audit McpToolRegistryImpl and confirm safetyChecks=true.',
    autoFix: 'Set safetyChecks: true in McpToolRegistryImpl constructor.',
  });

  // 56. mcp.dangerous_commands_allowed
  findings.push({
    checkId: 'mcp.dangerous_commands_allowed',
    severity: 'medium',
    title: 'Review dangerous command blocklist',
    detail:
      'The bash_execute tool blocks a small set of dangerous commands; review isCommandDangerous() for completeness.',
    remediation:
      'Extend the blocklist or use an allowlist approach for production.',
    autoFix:
      'Add rm -rf /, mkfs, dd, format to isCommandDangerous() blocklist.',
  });

  // 57. mcp.path_traversal_possible
  findings.push({
    checkId: 'mcp.path_traversal_possible',
    severity: 'medium',
    title: 'Review path traversal prevention',
    detail:
      'The isPathDangerous() check blocks ".." but allows home directory access; verify this is intentional.',
    remediation:
      'Implement a strict allowlist of accessible paths for file operations.',
    autoFix:
      'Add path.resolve() normalization and allowlist check to all file I/O tools.',
  });

  // 58. mcp.no_tool_allowlist
  findings.push({
    checkId: 'mcp.no_tool_allowlist',
    severity: 'high',
    title: 'No MCP tool execution allowlist',
    detail:
      'All registered MCP tools can be invoked by any authenticated client; there is no per-tool authorization.',
    remediation:
      'Implement tool-level access control or an allowlist of tools per role.',
    autoFix:
      'Add a toolAllowlist config section mapping roles to permitted tool names.',
  });

  return findings;
}

// ---------------------------------------------------------------------------
// Check 59-62: Distributed / Federation
// ---------------------------------------------------------------------------

export function collectDistributedSecurityFindings(
  cfg: Config
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const dist = cfg.distributed;

  if (!dist) {
    return findings;
  }

  // 59. distributed.no_cluster_auth
  findings.push({
    checkId: 'distributed.no_cluster_auth',
    severity: 'high',
    title: 'No inter-node authentication configured',
    detail:
      'The distributed cluster does not have an authentication mechanism between nodes.',
    remediation:
      'Implement shared secret or mTLS for inter-node communication.',
    autoFix:
      'Add CLUSTER_SECRET environment variable and validate it during node registration.',
  });

  // 60. distributed.migration_timeout_long
  const migrationTimeout = dist.migrationTimeout ?? 30000;
  if (migrationTimeout > 120000) {
    findings.push({
      checkId: 'distributed.migration_timeout_long',
      severity: 'low',
      title: 'Session migration timeout is very long',
      detail: `distributed.migrationTimeout=${migrationTimeout}ms; long timeouts may leave sessions in limbo.`,
      remediation: 'Keep migration timeout under 60 seconds.',
      autoFix: 'MIGRATION_TIMEOUT=30000',
    });
  }

  // 61. distributed.rebalance_aggressive
  const rebalanceInterval = dist.rebalanceInterval ?? 300000;
  if (rebalanceInterval < 60000) {
    findings.push({
      checkId: 'distributed.rebalance_aggressive',
      severity: 'medium',
      title: 'Cluster rebalancing is very frequent',
      detail: `distributed.rebalanceInterval=${rebalanceInterval}ms (${(rebalanceInterval / 1000).toFixed(0)}s); frequent rebalancing can cause session disruptions.`,
      remediation: 'Set rebalanceInterval to at least 300000ms (5 min).',
      autoFix: 'REBALANCE_INTERVAL=300000',
    });
  }

  // 62. distributed.no_node_verification
  findings.push({
    checkId: 'distributed.no_node_verification',
    severity: 'high',
    title: 'No node identity verification',
    detail:
      "Cluster nodes do not verify each other's identity; a rogue node could join the cluster.",
    remediation:
      'Implement node identity verification via certificates or shared secrets.',
    autoFix:
      'Implement mTLS between cluster nodes using self-signed CA certificates.',
  });

  return findings;
}

// ---------------------------------------------------------------------------
// Check 63-64: Neolith Integration
// ---------------------------------------------------------------------------

export function collectNeolithSecurityFindings(
  cfg: Config
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const neolith = cfg.neolith;

  if (!neolith?.apiUrl) {
    return findings;
  }

  // 63. neolith.no_tls
  try {
    const url = new URL(neolith.apiUrl);
    if (url.protocol === 'http:') {
      findings.push({
        checkId: 'neolith.no_tls',
        severity: 'high',
        title: 'Neolith API connection uses HTTP',
        detail: `neolith.apiUrl="${neolith.apiUrl}" uses unencrypted HTTP.`,
        remediation: 'Use https:// for the Neolith API URL.',
        autoFix: 'Change http:// to https:// in NEOLITH_API_URL.',
      });
    }
  } catch {
    // Invalid URL.
  }

  // 64. neolith.missing_secret
  if (neolith.apiKey && !neolith.apiSecret) {
    findings.push({
      checkId: 'neolith.missing_secret',
      severity: 'medium',
      title: 'Neolith API key set without secret',
      detail:
        'neolith.apiKey is set but neolith.apiSecret is empty; authentication may be incomplete.',
      remediation: 'Set NEOLITH_API_SECRET for full authentication.',
      autoFix: 'export NEOLITH_API_SECRET="<your-secret>"',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 65-68: Monitoring Security
// ---------------------------------------------------------------------------

export function collectMonitoringSecurityFindings(
  cfg: Config
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const monitoring = cfg.monitoring;

  if (!monitoring) {
    return findings;
  }

  // 65. monitoring.metrics_exposed
  const metricsEnabled = monitoring.metrics?.enabled ?? true;
  const metricsPort = monitoring.metrics?.port ?? 9090;
  const host = cfg.daemon?.host ?? '127.0.0.1';
  const isLoopback =
    host === '127.0.0.1' || host === 'localhost' || host === '::1';

  if (metricsEnabled && !isLoopback) {
    findings.push({
      checkId: 'monitoring.metrics_exposed',
      severity: 'medium',
      title: 'Metrics endpoint exposed on non-loopback interface',
      detail: `Prometheus metrics on port ${metricsPort} are accessible from the network; metrics may reveal internal state.`,
      remediation:
        'Restrict metrics endpoint to loopback or add authentication.',
      autoFix:
        'Bind metrics server to 127.0.0.1 or use a separate METRICS_HOST variable.',
    });
  }

  // 66. monitoring.metrics_no_auth
  if (metricsEnabled) {
    findings.push({
      checkId: 'monitoring.metrics_no_auth',
      severity: 'low',
      title: 'Metrics endpoint has no authentication',
      detail:
        'The /metrics endpoint is publicly accessible without token or basic auth.',
      remediation: 'Add basic auth or bearer token to the metrics endpoint.',
      autoFix:
        'Add a METRICS_AUTH_TOKEN environment variable and validate it in the metrics handler.',
    });
  }

  // 67. monitoring.health_endpoint_verbose
  const healthEnabled = monitoring.healthCheck?.enabled ?? true;
  if (healthEnabled && cfg.daemon?.verbose) {
    findings.push({
      checkId: 'monitoring.health_verbose',
      severity: 'low',
      title: 'Health endpoint may leak verbose data',
      detail:
        'Verbose mode is enabled and health checks are active; health responses may include internal details.',
      remediation:
        'Keep health check responses minimal (status + uptime only).',
      autoFix: 'DAEMON_VERBOSE=false',
    });
  }

  // 68. monitoring.default_metrics_port
  if (metricsEnabled && metricsPort === 9090 && cfg.env === 'production') {
    findings.push({
      checkId: 'monitoring.default_metrics_port',
      severity: 'info',
      title: 'Metrics uses default Prometheus port',
      detail:
        'METRICS_PORT=9090 is the well-known Prometheus default; automated scanners may probe it.',
      remediation: 'Consider using a non-default metrics port in production.',
      autoFix: 'METRICS_PORT=9191',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 69-72: Memory / Resource Limits
// ---------------------------------------------------------------------------

export function collectMemorySecurityFindings(
  cfg: Config
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const memory = cfg.memory;

  if (!memory) {
    return findings;
  }

  // 69. memory.heap_too_large
  const maxHeapMB = memory.maxHeapMB ?? 2048;
  if (maxHeapMB > 8192) {
    findings.push({
      checkId: 'memory.heap_too_large',
      severity: 'medium',
      title: 'Maximum heap size is very large',
      detail: `memory.maxHeapMB=${maxHeapMB}; excessively large heaps may cause long GC pauses or OOM kills.`,
      remediation:
        'Keep maxHeapMB under 4096 for most workloads; monitor actual usage.',
      autoFix: 'DAEMON_MAX_HEAP_MB=4096',
    });
  }

  // 70. memory.no_compaction
  const compactionEnabled = memory.compaction?.enabled ?? true;
  if (!compactionEnabled) {
    findings.push({
      checkId: 'memory.no_compaction',
      severity: 'low',
      title: 'Memory compaction is disabled',
      detail:
        'memory.compaction.enabled=false; context memory will grow without bounds.',
      remediation: 'Enable compaction with a reasonable threshold (e.g., 0.8).',
      autoFix: 'MEMORY_COMPACTION_ENABLED=true',
    });
  }

  // 71. memory.context_tokens_excessive
  const maxContextTokens = memory.maxContextTokens ?? 128000;
  if (maxContextTokens > 256000) {
    findings.push({
      checkId: 'memory.context_tokens_excessive',
      severity: 'low',
      title: 'Max context tokens is very high',
      detail: `memory.maxContextTokens=${maxContextTokens}; this may lead to excessive API costs and memory usage per session.`,
      remediation:
        'Set maxContextTokens to 128000 or lower unless specific models require more.',
      autoFix: 'DAEMON_MAX_CONTEXT_TOKENS=128000',
    });
  }

  // 72. memory.compaction_threshold_low
  const threshold = memory.compaction?.threshold ?? 0.8;
  if (compactionEnabled && threshold < 0.3) {
    findings.push({
      checkId: 'memory.compaction_threshold_low',
      severity: 'info',
      title: 'Memory compaction threshold is very aggressive',
      detail: `memory.compaction.threshold=${threshold}; aggressive compaction may discard useful context too early.`,
      remediation: 'Set compaction threshold to 0.7-0.9 for a good balance.',
      autoFix: 'MEMORY_COMPACTION_THRESHOLD=0.8',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 73-76: Token Budget Security
// ---------------------------------------------------------------------------

export function collectTokenBudgetFindings(
  cfg: Config
): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const budget = cfg.tokenBudget;

  if (!budget) {
    return findings;
  }

  // 73. token_budget.no_alerts
  const alertsEnabled = budget.alerts?.enabled ?? true;
  if (!alertsEnabled) {
    findings.push({
      checkId: 'token_budget.no_alerts',
      severity: 'medium',
      title: 'Token budget alerts are disabled',
      detail:
        'tokenBudget.alerts.enabled=false; runaway consumption will go unnoticed.',
      remediation: 'Enable token budget alerts with a threshold of 80%.',
      autoFix: 'TOKEN_BUDGET_ALERTS_ENABLED=true',
    });
  }

  // 74. token_budget.excessive_daily
  const daily = budget.daily ?? 1000000;
  if (daily > 10000000) {
    findings.push({
      checkId: 'token_budget.excessive_daily',
      severity: 'medium',
      title: 'Daily token budget is very high',
      detail: `tokenBudget.daily=${daily.toLocaleString()} tokens; this represents significant API cost exposure.`,
      remediation:
        'Set a daily budget that matches expected usage plus a safety margin.',
      autoFix: 'TOKEN_BUDGET_DAILY=2000000',
    });
  }

  // 75. token_budget.alert_threshold_high
  const alertThreshold = budget.alerts?.threshold ?? 0.8;
  if (alertsEnabled && alertThreshold > 0.95) {
    findings.push({
      checkId: 'token_budget.alert_threshold_high',
      severity: 'low',
      title: 'Token budget alert threshold is very high',
      detail: `tokenBudget.alerts.threshold=${alertThreshold}; alerts will fire too late to prevent overspend.`,
      remediation: 'Set alert threshold to 0.7-0.8 for earlier warning.',
      autoFix: 'TOKEN_BUDGET_ALERT_THRESHOLD=0.8',
    });
  }

  // 76. token_budget.no_monthly_limit
  const monthly = budget.monthly ?? 20000000;
  if (monthly > 100000000) {
    findings.push({
      checkId: 'token_budget.no_monthly_limit',
      severity: 'low',
      title: 'Monthly token budget is extremely high',
      detail: `tokenBudget.monthly=${monthly.toLocaleString()} tokens; consider whether this is intentional.`,
      remediation:
        'Set a monthly budget that reflects your expected consumption.',
      autoFix: 'TOKEN_BUDGET_MONTHLY=20000000',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 77-82: Filesystem Permissions
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
  statFn: typeof fs.stat = fs.stat
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

  // 77. fs.windows_skipped
  if (platform === 'win32') {
    findings.push({
      checkId: 'fs.windows_skipped',
      severity: 'info',
      title: 'Filesystem permission checks skipped on Windows',
      detail:
        'POSIX permission checks are not applicable on Windows; use NTFS ACLs.',
      remediation:
        'Run icacls checks or use Windows Security Center to verify file permissions.',
      autoFix: 'Use icacls to restrict file permissions on Windows.',
    });
    return findings;
  }

  const statFn = params.statFn ?? fs.stat;

  // 78. fs.config_file_writable
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
          autoFix: `chmod 600 ${params.configPath}`,
        });
      } else if (perms.worldReadable) {
        // 79. fs.config_file_world_readable
        findings.push({
          checkId: 'fs.config_file_world_readable',
          severity: 'high',
          title: 'Config file is world-readable',
          detail: `${params.configPath} has mode ${formatMode(perms.mode)}; config may contain secrets.`,
          remediation: `chmod 600 ${params.configPath}`,
          autoFix: `chmod 600 ${params.configPath}`,
        });
      }
      // 80. fs.config_file_symlink
      if (perms.isSymlink) {
        findings.push({
          checkId: 'fs.config_file_symlink',
          severity: 'medium',
          title: 'Config file is a symlink',
          detail: `${params.configPath} is a symlink; make sure you trust its target.`,
          remediation:
            'Resolve the symlink or verify the target is in a trusted directory.',
          autoFix: `readlink -f ${params.configPath} && verify the target.`,
        });
      }
    }
  }

  // 81-82. fs.dotenv_permissions
  if (params.dotenvPath) {
    const perms = await inspectPathPermissions(params.dotenvPath, statFn);
    if (perms?.ok) {
      if (perms.worldReadable) {
        findings.push({
          checkId: 'fs.dotenv_world_readable',
          severity: 'critical',
          title: '.env file is world-readable',
          detail: `${params.dotenvPath} has mode ${formatMode(perms.mode)}; .env files contain secrets.`,
          remediation: `chmod 600 ${params.dotenvPath}`,
          autoFix: `chmod 600 ${params.dotenvPath}`,
        });
      } else if (perms.groupReadable) {
        findings.push({
          checkId: 'fs.dotenv_group_readable',
          severity: 'high',
          title: '.env file is group-readable',
          detail: `${params.dotenvPath} has mode ${formatMode(perms.mode)}; restrict to owner-only.`,
          remediation: `chmod 600 ${params.dotenvPath}`,
          autoFix: `chmod 600 ${params.dotenvPath}`,
        });
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 83-84: Dependency Scanning
// ---------------------------------------------------------------------------

export async function collectDependencyFindings(params: {
  projectDir: string;
  readFileFn?: typeof fs.readFile;
}): Promise<SecurityAuditFinding[]> {
  const findings: SecurityAuditFinding[] = [];
  const readFile = params.readFileFn ?? fs.readFile;

  let packageJson: Record<string, unknown>;
  try {
    const raw = await readFile(
      path.join(params.projectDir, 'package.json'),
      'utf-8'
    );
    packageJson = JSON.parse(raw as string);
  } catch {
    return findings;
  }

  const deps = {
    ...(packageJson.dependencies as Record<string, string> | undefined),
    ...(packageJson.devDependencies as Record<string, string> | undefined),
  };

  // 83. deps.known_vulnerabilities
  const riskyVersions: Array<{ pkg: string; version: string; reason: string }> =
    [];
  const knownRisky: Record<string, { vulnerable: string; reason: string }> = {
    lodash: {
      vulnerable: '<4.17.21',
      reason: 'Prototype Pollution (CVE-2021-23337)',
    },
    minimist: {
      vulnerable: '<1.2.6',
      reason: 'Prototype Pollution (CVE-2021-44906)',
    },
    'node-fetch': {
      vulnerable: '<2.6.7',
      reason: 'Exposure of Sensitive Information (CVE-2022-0235)',
    },
    jsonwebtoken: {
      vulnerable: '<9.0.0',
      reason: 'Algorithm confusion (CVE-2022-23529)',
    },
    axios: {
      vulnerable: '<0.21.1',
      reason: 'SSRF vulnerability (CVE-2021-3749)',
    },
    express: {
      vulnerable: '<4.18.2',
      reason: 'Open redirect (CVE-2022-24999)',
    },
    ws: {
      vulnerable: '<8.11.0',
      reason: 'ReDoS in Sec-WebSocket-Protocol (CVE-2024-37890)',
    },
  };

  for (const [pkgName, versionRange] of Object.entries(deps)) {
    const known = knownRisky[pkgName];
    if (!known) {
      continue;
    }
    const cleanVersion = (versionRange ?? '').replace(/^[\^~>=<]*/g, '');
    if (cleanVersion) {
      riskyVersions.push({
        pkg: pkgName,
        version: cleanVersion,
        reason: known.reason,
      });
    }
  }

  if (riskyVersions.length > 0) {
    findings.push({
      checkId: 'deps.known_vulnerabilities',
      severity: 'high',
      title: 'Dependencies with known vulnerabilities detected',
      detail: riskyVersions
        .map(r => `${r.pkg}@${r.version}: ${r.reason}`)
        .join('; '),
      remediation:
        'Run "npm audit" and update affected packages. Consider using "npm audit fix".',
      autoFix: 'npm audit fix',
    });
  }

  // 84. deps.outdated_critical
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
      severity: 'medium',
      title: 'Security-critical dependencies may be outdated',
      detail: `Pre-1.0 versions of security packages: ${outdatedHints.join(', ')}`,
      remediation: 'Update these packages to their latest stable releases.',
      autoFix: `npm install ${outdatedHints.map(h => h.split('@')[0]).join(' ')}@latest`,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check 85-87: Plugin Code Safety (deep mode)
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
    // 85. plugin.scan_failed
    findings.push({
      checkId: 'plugin.scan_failed',
      severity: 'medium',
      title: 'Plugin code scan failed',
      detail: `Could not scan ${params.pluginDir}; ensure the directory exists.`,
      remediation: 'Verify the plugin directory exists and is readable.',
      autoFix: `mkdir -p ${params.pluginDir}`,
    });
    return findings;
  }

  // 86. plugin.critical_findings
  if (scanSummary.critical > 0) {
    findings.push({
      checkId: 'plugin.critical_findings',
      severity: 'critical',
      title: `Plugin code scan found ${scanSummary.critical} critical issue(s)`,
      detail: scanSummary.findings
        .filter(f => f.severity === 'critical')
        .map(f => `${f.file}:${f.line} - ${f.message}`)
        .join('\n'),
      remediation:
        'Review and fix critical findings before loading these plugins.',
      autoFix: 'Remove or sandbox plugins with critical security findings.',
    });
  }

  // 87. plugin.warn_findings
  if (scanSummary.warn > 0) {
    findings.push({
      checkId: 'plugin.warn_findings',
      severity: 'medium',
      title: `Plugin code scan found ${scanSummary.warn} warning(s)`,
      detail: scanSummary.findings
        .filter(f => f.severity === 'warn')
        .map(f => `${f.file}:${f.line} - ${f.message}`)
        .join('\n'),
      remediation: 'Review warnings and address any that pose a security risk.',
      autoFix: 'Audit flagged patterns and refactor away from dangerous APIs.',
    });
  }

  if (
    scanSummary.scannedFiles > 0 &&
    scanSummary.critical === 0 &&
    scanSummary.warn === 0
  ) {
    findings.push({
      checkId: 'plugin.scan_clean',
      severity: 'info',
      title: `Plugin code scan: ${scanSummary.scannedFiles} files clean`,
      detail: `Scanned ${scanSummary.scannedFiles} files with no critical or warning findings.`,
      remediation: 'No action required; continue periodic scanning.',
      autoFix: 'No action needed.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Deep: WebSocket Probe
// ---------------------------------------------------------------------------

async function defaultProbeWebSocket(
  url: string,
  timeoutMs: number
): Promise<WebSocketProbeResult> {
  return new Promise(resolve => {
    try {
      // Use dynamic import to avoid hard dependency on ws at module load time.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
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
// Report Formatting: Plain Text
// ---------------------------------------------------------------------------

const SEVERITY_LABEL: Record<SecurityAuditSeverity, string> = {
  critical: 'CRITICAL',
  high: 'HIGH    ',
  medium: 'MEDIUM  ',
  low: 'LOW     ',
  info: 'INFO    ',
};

export function formatAuditReportText(report: SecurityAuditReport): string {
  const lines: string[] = [];
  lines.push('=== Wundr Security Audit Report ===');
  lines.push(`Version: ${report.version}`);
  lines.push(`Timestamp: ${new Date(report.ts).toISOString()}`);
  lines.push('');
  lines.push(
    `Summary: ${report.summary.critical} critical, ${report.summary.high} high, ` +
      `${report.summary.medium} medium, ${report.summary.low} low, ${report.summary.info} info ` +
      `(${report.summary.total} total)`
  );
  lines.push('');

  const grouped = new Map<string, SecurityAuditFinding[]>();
  for (const f of report.findings) {
    const category = f.checkId.split('.')[0];
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(f);
  }

  for (const [category, categoryFindings] of grouped) {
    lines.push(`--- ${category.toUpperCase()} ---`);
    const sorted = [...categoryFindings].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    );
    for (const f of sorted) {
      lines.push(`  [${SEVERITY_LABEL[f.severity]}] ${f.title}`);
      lines.push(`    ${f.detail}`);
      if (f.remediation) {
        lines.push(`    Fix: ${f.remediation}`);
      }
      if (f.autoFix) {
        lines.push(`    Auto-fix: ${f.autoFix}`);
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
    lines.push(
      `  Scanned ${ps.scannedFiles} files: ${ps.critical} critical, ${ps.warn} warn, ${ps.info} info`
    );
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Report Formatting: Markdown
// ---------------------------------------------------------------------------

export function formatAuditReportMarkdown(report: SecurityAuditReport): string {
  const lines: string[] = [];
  lines.push('# Wundr Security Audit Report');
  lines.push('');
  lines.push(`**Version:** ${report.version}`);
  lines.push(`**Generated:** ${new Date(report.ts).toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  lines.push(`| Critical | ${report.summary.critical} |`);
  lines.push(`| High     | ${report.summary.high} |`);
  lines.push(`| Medium   | ${report.summary.medium} |`);
  lines.push(`| Low      | ${report.summary.low} |`);
  lines.push(`| Info     | ${report.summary.info} |`);
  lines.push(`| **Total** | **${report.summary.total}** |`);
  lines.push('');

  const severityGroups: Array<{
    label: string;
    severity: SecurityAuditSeverity;
    heading: string;
  }> = [
    { label: 'Critical', severity: 'critical', heading: 'Critical Findings' },
    { label: 'High', severity: 'high', heading: 'High Severity Findings' },
    {
      label: 'Medium',
      severity: 'medium',
      heading: 'Medium Severity Findings',
    },
    { label: 'Low', severity: 'low', heading: 'Low Severity Findings' },
    { label: 'Info', severity: 'info', heading: 'Informational' },
  ];

  for (const group of severityGroups) {
    const groupFindings = report.findings.filter(
      x => x.severity === group.severity
    );
    if (groupFindings.length === 0) {
      continue;
    }

    lines.push(`## ${group.heading}`);
    lines.push('');

    if (group.severity === 'critical' || group.severity === 'high') {
      for (const f of groupFindings) {
        lines.push(`### ${f.title}`);
        lines.push(`**Check:** \`${f.checkId}\``);
        lines.push('');
        lines.push(f.detail);
        if (f.remediation) {
          lines.push('');
          lines.push(`**Remediation:** ${f.remediation}`);
        }
        if (f.autoFix) {
          lines.push('');
          lines.push(`**Auto-fix:** \`${f.autoFix}\``);
        }
        lines.push('');
      }
    } else {
      for (const f of groupFindings) {
        lines.push(`- **${f.title}** (\`${f.checkId}\`): ${f.detail}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Report Formatting: HTML
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function severityColorClass(severity: SecurityAuditSeverity): string {
  switch (severity) {
    case 'critical':
      return 'color: #dc2626; font-weight: bold;';
    case 'high':
      return 'color: #ea580c; font-weight: bold;';
    case 'medium':
      return 'color: #ca8a04;';
    case 'low':
      return 'color: #2563eb;';
    case 'info':
      return 'color: #6b7280;';
  }
}

export function formatAuditReportHtml(report: SecurityAuditReport): string {
  const lines: string[] = [];
  lines.push('<!DOCTYPE html>');
  lines.push('<html lang="en"><head><meta charset="UTF-8">');
  lines.push(
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
  );
  lines.push('<title>Wundr Security Audit Report</title>');
  lines.push('<style>');
  lines.push(
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 960px; margin: 0 auto; padding: 2rem; background: #fafafa; color: #1a1a1a; }'
  );
  lines.push(
    'h1 { border-bottom: 2px solid #e5e5e5; padding-bottom: 0.5rem; }'
  );
  lines.push(
    'table { border-collapse: collapse; width: 100%; margin: 1rem 0; }'
  );
  lines.push(
    'th, td { border: 1px solid #d1d5db; padding: 0.5rem 1rem; text-align: left; }'
  );
  lines.push('th { background: #f3f4f6; }');
  lines.push(
    '.finding { border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; margin: 0.75rem 0; background: #fff; }'
  );
  lines.push('.finding-title { font-size: 1.1rem; margin: 0 0 0.5rem 0; }');
  lines.push('.finding-detail { margin: 0.25rem 0; }');
  lines.push(
    '.badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: bold; color: #fff; }'
  );
  lines.push('.badge-critical { background: #dc2626; }');
  lines.push('.badge-high { background: #ea580c; }');
  lines.push('.badge-medium { background: #ca8a04; }');
  lines.push('.badge-low { background: #2563eb; }');
  lines.push('.badge-info { background: #6b7280; }');
  lines.push(
    'code { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 0.2rem; font-size: 0.9em; }'
  );
  lines.push('</style></head><body>');

  lines.push('<h1>Wundr Security Audit Report</h1>');
  lines.push(
    `<p><strong>Version:</strong> ${escapeHtml(report.version)} | <strong>Generated:</strong> ${escapeHtml(new Date(report.ts).toISOString())}</p>`
  );

  lines.push('<h2>Summary</h2>');
  lines.push('<table>');
  lines.push('<tr><th>Severity</th><th>Count</th></tr>');
  lines.push(
    `<tr><td style="${severityColorClass('critical')}">Critical</td><td>${report.summary.critical}</td></tr>`
  );
  lines.push(
    `<tr><td style="${severityColorClass('high')}">High</td><td>${report.summary.high}</td></tr>`
  );
  lines.push(
    `<tr><td style="${severityColorClass('medium')}">Medium</td><td>${report.summary.medium}</td></tr>`
  );
  lines.push(
    `<tr><td style="${severityColorClass('low')}">Low</td><td>${report.summary.low}</td></tr>`
  );
  lines.push(
    `<tr><td style="${severityColorClass('info')}">Info</td><td>${report.summary.info}</td></tr>`
  );
  lines.push(`<tr><th>Total</th><th>${report.summary.total}</th></tr>`);
  lines.push('</table>');

  lines.push('<h2>Findings</h2>');

  const sorted = [...report.findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  for (const f of sorted) {
    const badgeClass = `badge badge-${f.severity}`;
    lines.push('<div class="finding">');
    lines.push(
      `<p class="finding-title"><span class="${badgeClass}">${escapeHtml(f.severity.toUpperCase())}</span> ${escapeHtml(f.title)}</p>`
    );
    lines.push(
      `<p class="finding-detail"><code>${escapeHtml(f.checkId)}</code></p>`
    );
    lines.push(`<p class="finding-detail">${escapeHtml(f.detail)}</p>`);
    if (f.remediation) {
      lines.push(
        `<p class="finding-detail"><strong>Remediation:</strong> ${escapeHtml(f.remediation)}</p>`
      );
    }
    if (f.autoFix) {
      lines.push(
        `<p class="finding-detail"><strong>Auto-fix:</strong> <code>${escapeHtml(f.autoFix)}</code></p>`
      );
    }
    lines.push('</div>');
  }

  if (report.deep?.websocket) {
    const ws = report.deep.websocket;
    lines.push('<h2>Deep: WebSocket Probe</h2>');
    if (ws.ok) {
      lines.push(
        `<p>WebSocket reachable at ${escapeHtml(ws.url ?? '')} (${ws.latencyMs}ms)</p>`
      );
    } else {
      lines.push(
        `<p>WebSocket probe failed: ${escapeHtml(ws.error ?? 'unknown')}</p>`
      );
    }
  }

  if (report.deep?.pluginScan) {
    const ps = report.deep.pluginScan;
    lines.push('<h2>Deep: Plugin Scan</h2>');
    lines.push(
      `<p>Scanned ${ps.scannedFiles} files: ${ps.critical} critical, ${ps.warn} warn, ${ps.info} info</p>`
    );
  }

  lines.push('</body></html>');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main Audit Entry Point
// ---------------------------------------------------------------------------

export async function runSecurityAudit(
  opts: SecurityAuditOptions
): Promise<SecurityAuditReport> {
  const findings: SecurityAuditFinding[] = [];
  const cfg = opts.config;
  const env = opts.env ?? process.env;
  const platform = opts.platform ?? process.platform;
  const onProgress = opts.onProgress;

  const totalPhases = 22;
  let completedPhases = 0;

  function emitProgress(phase: ProgressPhase): void {
    completedPhases += 1;
    if (onProgress) {
      onProgress(phase, completedPhases, totalPhases);
    }
  }

  // --- Configuration checks (always run, no I/O) ---
  findings.push(...collectDaemonConfigFindings(cfg));
  emitProgress('config');

  findings.push(...collectWebSocketSecurityFindings(cfg));
  emitProgress('websocket');

  findings.push(...collectJwtSecurityFindings(cfg, env));
  emitProgress('jwt');

  findings.push(...collectCorsFindings(cfg));
  emitProgress('cors');

  findings.push(...collectRateLimitFindings(cfg));
  emitProgress('rateLimit');

  findings.push(...collectTlsFindings(cfg, env));
  emitProgress('tls');

  findings.push(...collectEnvSecurityFindings(env, cfg));
  emitProgress('env');

  findings.push(...collectLoggingFindings(cfg));
  emitProgress('logging');

  findings.push(...collectApiKeyFindings(cfg, env));
  emitProgress('apiKeys');

  findings.push(...collectRedisSecurityFindings(cfg));
  emitProgress('redis');

  findings.push(...collectDatabaseSecurityFindings(cfg));
  emitProgress('database');

  findings.push(...collectMcpToolSafetyFindings(cfg));
  emitProgress('mcp');

  findings.push(...collectDistributedSecurityFindings(cfg));
  emitProgress('distributed');

  findings.push(...collectNeolithSecurityFindings(cfg));
  emitProgress('neolith');

  findings.push(...collectMonitoringSecurityFindings(cfg));
  emitProgress('monitoring');

  findings.push(...collectMemorySecurityFindings(cfg));
  emitProgress('memory');

  findings.push(...collectTokenBudgetFindings(cfg));
  emitProgress('tokenBudget');

  // --- Filesystem checks (may involve I/O) ---
  if (opts.includeFilesystem !== false) {
    findings.push(
      ...(await collectFilesystemFindings({
        configPath: opts.configPath,
        dotenvPath: opts.dotenvPath,
        statFn: opts.statFn,
        platform,
      }))
    );
  }
  emitProgress('filesystem');

  // --- Dependency scanning (reads package.json) ---
  if (opts.projectDir) {
    findings.push(
      ...(await collectDependencyFindings({
        projectDir: opts.projectDir,
        readFileFn: opts.readFileFn,
      }))
    );
  }
  emitProgress('dependencies');

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
  emitProgress('plugins');

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
        severity: 'medium',
        title: 'WebSocket probe failed (deep)',
        detail: wsProbe.error ?? 'WebSocket unreachable',
        remediation:
          'Verify the daemon is running and accessible, then re-run with --deep.',
        autoFix: 'Ensure the daemon is started before running deep audit.',
      });
    }
  }
  emitProgress('wsProbe');

  emitProgress('complete');

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
