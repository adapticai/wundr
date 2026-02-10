/* eslint-disable @typescript-eslint/consistent-type-imports */
/**
 * Tests for the security audit engine (src/security/audit.ts).
 *
 * Covers:
 *  - Individual check category functions (20 categories, 87+ checks)
 *  - Daemon configuration findings
 *  - WebSocket security findings
 *  - JWT / authentication findings (including Shannon entropy)
 *  - CORS findings
 *  - Rate limiting findings
 *  - TLS / transport findings
 *  - Environment variable findings
 *  - Logging findings
 *  - API key findings
 *  - Redis security findings
 *  - Database security findings
 *  - MCP tool safety findings
 *  - Distributed / federation findings
 *  - Neolith integration findings
 *  - Monitoring security findings
 *  - Memory / resource limit findings
 *  - Token budget findings
 *  - Filesystem permission findings (mocked)
 *  - Dependency scanning findings (mocked)
 *  - Report formatting (text, Markdown, HTML)
 *  - runSecurityAudit orchestrator (progress callbacks, deep mode)
 *  - Auto-fix suggestions on every finding
 *  - Risk scoring / severity counts
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  collectDaemonConfigFindings,
  collectWebSocketSecurityFindings,
  collectJwtSecurityFindings,
  collectCorsFindings,
  collectRateLimitFindings,
  collectTlsFindings,
  collectEnvSecurityFindings,
  collectLoggingFindings,
  collectApiKeyFindings,
  collectRedisSecurityFindings,
  collectDatabaseSecurityFindings,
  collectMcpToolSafetyFindings,
  collectDistributedSecurityFindings,
  collectNeolithSecurityFindings,
  collectMonitoringSecurityFindings,
  collectMemorySecurityFindings,
  collectTokenBudgetFindings,
  collectFilesystemFindings,
  collectDependencyFindings,
  formatAuditReportText,
  formatAuditReportMarkdown,
  formatAuditReportHtml,
  runSecurityAudit,
  type SecurityAuditFinding,
  type SecurityAuditReport,
  type ProgressPhase,
} from '../../../security/audit';

import type { Config } from '../../../config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Config object with sane defaults for testing.
 * Each test can override individual fields.
 */
function makeConfig(overrides?: Record<string, unknown>): Config {
  const base: Config = {
    openai: { apiKey: 'sk-test-key-for-unit-tests', model: 'gpt-4o-mini' },
    daemon: {
      name: 'orchestrator-daemon',
      port: 8787,
      host: '127.0.0.1',
      maxSessions: 100,
      verbose: false,
    },
    health: {
      heartbeatInterval: 30000,
      healthCheckInterval: 60000,
      shutdownTimeout: 10000,
    },
    logging: {
      level: 'info',
      format: 'json',
      rotation: { enabled: true, maxSize: 10, maxFiles: 5 },
    },
    security: {
      jwtSecret: 'change-this-in-production-to-a-random-secure-string',
      jwtExpiration: '24h',
      cors: { enabled: false, origins: [] },
      rateLimit: { enabled: true, max: 100, windowMs: 60000 },
    },
    monitoring: {
      metrics: { enabled: true, port: 9090, path: '/metrics' },
      healthCheck: { enabled: true, path: '/health' },
    },
    memory: {
      maxHeapMB: 2048,
      maxContextTokens: 128000,
      compaction: { enabled: true, threshold: 0.8 },
    },
    tokenBudget: {
      daily: 1000000,
      weekly: 5000000,
      monthly: 20000000,
      alerts: { enabled: true, threshold: 0.8 },
    },
    env: 'development',
    debug: false,
  };

  // Simple top-level merge for test convenience.
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        (base as Record<string, unknown>)[key] = {
          ...((base as Record<string, unknown>)[key] as Record<string, unknown>),
          ...(value as Record<string, unknown>),
        };
      } else {
        (base as Record<string, unknown>)[key] = value;
      }
    }
  }

  return base;
}

/** Every finding MUST have an autoFix field. */
function assertAutoFixPresent(findings: SecurityAuditFinding[]): void {
  for (const f of findings) {
    expect(f.autoFix).toBeDefined();
    expect(typeof f.autoFix).toBe('string');
    expect(f.autoFix!.length).toBeGreaterThan(0);
  }
}

/** Assert that a check ID appears among findings. */
function hasCheck(findings: SecurityAuditFinding[], checkId: string): boolean {
  return findings.some((f) => f.checkId === checkId);
}

// ---------------------------------------------------------------------------
// Daemon Configuration (checks 01-07)
// ---------------------------------------------------------------------------

describe('Security Audit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('collectDaemonConfigFindings', () => {
    it('should flag host=0.0.0.0 as critical', () => {
      const cfg = makeConfig({ daemon: { host: '0.0.0.0', port: 8787, name: 'test', maxSessions: 100, verbose: false } });
      const findings = collectDaemonConfigFindings(cfg);

      expect(hasCheck(findings, 'daemon.host_all_interfaces')).toBe(true);
      const f = findings.find((x) => x.checkId === 'daemon.host_all_interfaces')!;
      expect(f.severity).toBe('critical');
      assertAutoFixPresent(findings);
    });

    it('should flag non-loopback host as high', () => {
      const cfg = makeConfig({ daemon: { host: '10.0.0.1', port: 8787, name: 'test', maxSessions: 100, verbose: false } });
      const findings = collectDaemonConfigFindings(cfg);

      expect(hasCheck(findings, 'daemon.host_not_loopback')).toBe(true);
      expect(findings.find((x) => x.checkId === 'daemon.host_not_loopback')!.severity).toBe('high');
    });

    it('should not flag loopback host', () => {
      const cfg = makeConfig();
      const findings = collectDaemonConfigFindings(cfg);

      expect(hasCheck(findings, 'daemon.host_all_interfaces')).toBe(false);
      expect(hasCheck(findings, 'daemon.host_not_loopback')).toBe(false);
    });

    it('should flag maxSessions=0 as critical', () => {
      const cfg = makeConfig({ daemon: { host: '127.0.0.1', port: 8787, name: 'test', maxSessions: 0, verbose: false } });
      const findings = collectDaemonConfigFindings(cfg);

      expect(hasCheck(findings, 'daemon.max_sessions_unlimited')).toBe(true);
      expect(findings.find((x) => x.checkId === 'daemon.max_sessions_unlimited')!.severity).toBe('critical');
    });

    it('should flag negative maxSessions as critical', () => {
      const cfg = makeConfig({ daemon: { host: '127.0.0.1', port: 8787, name: 'test', maxSessions: -1, verbose: false } });
      const findings = collectDaemonConfigFindings(cfg);

      expect(hasCheck(findings, 'daemon.max_sessions_unlimited')).toBe(true);
    });

    it('should flag maxSessions>500 as low', () => {
      const cfg = makeConfig({ daemon: { host: '127.0.0.1', port: 8787, name: 'test', maxSessions: 1000, verbose: false } });
      const findings = collectDaemonConfigFindings(cfg);

      expect(hasCheck(findings, 'daemon.max_sessions_excessive')).toBe(true);
      expect(findings.find((x) => x.checkId === 'daemon.max_sessions_excessive')!.severity).toBe('low');
    });

    it('should flag default daemon name as info', () => {
      const cfg = makeConfig();
      const findings = collectDaemonConfigFindings(cfg);

      expect(hasCheck(findings, 'daemon.default_name')).toBe(true);
      expect(findings.find((x) => x.checkId === 'daemon.default_name')!.severity).toBe('info');
    });

    it('should flag verbose=true in production as medium', () => {
      const cfg = makeConfig({
        daemon: { host: '127.0.0.1', port: 8787, name: 'node-01', maxSessions: 100, verbose: true },
        env: 'production',
      });
      const findings = collectDaemonConfigFindings(cfg);

      expect(hasCheck(findings, 'daemon.verbose_production')).toBe(true);
      expect(findings.find((x) => x.checkId === 'daemon.verbose_production')!.severity).toBe('medium');
    });

    it('should not flag verbose in development', () => {
      const cfg = makeConfig({
        daemon: { host: '127.0.0.1', port: 8787, name: 'node-01', maxSessions: 100, verbose: true },
        env: 'development',
      });
      const findings = collectDaemonConfigFindings(cfg);

      expect(hasCheck(findings, 'daemon.verbose_production')).toBe(false);
    });

    it('should flag default port in production as low', () => {
      const cfg = makeConfig({
        daemon: { host: '127.0.0.1', port: 8787, name: 'node-01', maxSessions: 100, verbose: false },
        env: 'production',
      });
      const findings = collectDaemonConfigFindings(cfg);

      expect(hasCheck(findings, 'daemon.default_port')).toBe(true);
    });

    it('should have autoFix on every daemon finding', () => {
      const cfg = makeConfig({
        daemon: { host: '0.0.0.0', port: 8787, name: 'orchestrator-daemon', maxSessions: 0, verbose: true },
        env: 'production',
      });
      assertAutoFixPresent(collectDaemonConfigFindings(cfg));
    });
  });

  // -------------------------------------------------------------------------
  // WebSocket Security (checks 08-16)
  // -------------------------------------------------------------------------

  describe('collectWebSocketSecurityFindings', () => {
    it('should flag no auth on non-loopback host as critical', () => {
      const cfg = makeConfig({
        daemon: { host: '10.0.0.1', port: 8787, name: 'test', maxSessions: 100, verbose: false },
        security: {
          jwtSecret: 'change-this-in-production-to-a-random-secure-string',
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectWebSocketSecurityFindings(cfg);

      expect(hasCheck(findings, 'ws.no_auth')).toBe(true);
      expect(findings.find((x) => x.checkId === 'ws.no_auth')!.severity).toBe('critical');
    });

    it('should not flag auth when JWT secret is set and host is non-loopback', () => {
      const cfg = makeConfig({
        daemon: { host: '10.0.0.1', port: 8787, name: 'test', maxSessions: 100, verbose: false },
        security: {
          jwtSecret: 'a-very-strong-random-secret-that-is-not-the-default-placeholder',
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectWebSocketSecurityFindings(cfg);

      expect(hasCheck(findings, 'ws.no_auth')).toBe(false);
    });

    it('should flag no origin validation when CORS is disabled', () => {
      const cfg = makeConfig();
      const findings = collectWebSocketSecurityFindings(cfg);

      expect(hasCheck(findings, 'ws.no_origin_validation')).toBe(true);
    });

    it('should always include ws.no_message_size_limit', () => {
      const findings = collectWebSocketSecurityFindings(makeConfig());

      expect(hasCheck(findings, 'ws.no_message_size_limit')).toBe(true);
    });

    it('should flag disabled rate limiting', () => {
      const cfg = makeConfig({
        security: {
          jwtSecret: 'change-this-in-production-to-a-random-secure-string',
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: false, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectWebSocketSecurityFindings(cfg);

      expect(hasCheck(findings, 'ws.no_rate_limit')).toBe(true);
    });

    it('should flag excessive heartbeat interval', () => {
      const cfg = makeConfig({
        health: { heartbeatInterval: 150000, healthCheckInterval: 60000, shutdownTimeout: 10000 },
      });
      const findings = collectWebSocketSecurityFindings(cfg);

      expect(hasCheck(findings, 'ws.no_heartbeat_timeout')).toBe(true);
    });

    it('should flag no TLS on non-loopback', () => {
      const cfg = makeConfig({
        daemon: { host: '10.0.0.1', port: 8787, name: 'test', maxSessions: 100, verbose: false },
      });
      const findings = collectWebSocketSecurityFindings(cfg);

      expect(hasCheck(findings, 'ws.no_tls')).toBe(true);
    });

    it('should not flag TLS on loopback', () => {
      const cfg = makeConfig();
      const findings = collectWebSocketSecurityFindings(cfg);

      expect(hasCheck(findings, 'ws.no_tls')).toBe(false);
    });

    it('should flag excessive shutdown timeout', () => {
      const cfg = makeConfig({
        health: { heartbeatInterval: 30000, healthCheckInterval: 60000, shutdownTimeout: 90000 },
      });
      const findings = collectWebSocketSecurityFindings(cfg);

      expect(hasCheck(findings, 'ws.connection_timeout_excessive')).toBe(true);
    });

    it('should always include session fixation and broadcast info checks', () => {
      const findings = collectWebSocketSecurityFindings(makeConfig());

      expect(hasCheck(findings, 'ws.session_fixation')).toBe(true);
      expect(hasCheck(findings, 'ws.broadcast_unrestricted')).toBe(true);
    });

    it('should have autoFix on every WebSocket finding', () => {
      const cfg = makeConfig({
        daemon: { host: '10.0.0.1', port: 8787, name: 'test', maxSessions: 100, verbose: false },
        health: { heartbeatInterval: 150000, healthCheckInterval: 60000, shutdownTimeout: 90000 },
        security: {
          jwtSecret: 'change-this-in-production-to-a-random-secure-string',
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: false, max: 100, windowMs: 60000 },
        },
      });
      assertAutoFixPresent(collectWebSocketSecurityFindings(cfg));
    });
  });

  // -------------------------------------------------------------------------
  // JWT / Authentication (checks 17-24)
  // -------------------------------------------------------------------------

  describe('collectJwtSecurityFindings', () => {
    it('should flag default JWT secret as critical', () => {
      const cfg = makeConfig();
      const findings = collectJwtSecurityFindings(cfg, {});

      expect(hasCheck(findings, 'jwt.secret_default')).toBe(true);
      expect(findings.find((x) => x.checkId === 'jwt.secret_default')!.severity).toBe('critical');
    });

    it('should flag short JWT secret as critical', () => {
      const cfg = makeConfig({
        security: {
          jwtSecret: 'short',
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectJwtSecurityFindings(cfg, {});

      expect(hasCheck(findings, 'jwt.secret_too_short')).toBe(true);
    });

    it('should flag low-entropy JWT secret (Shannon entropy)', () => {
      // Repeating character has very low entropy
      const lowEntropySecret = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const cfg = makeConfig({
        security: {
          jwtSecret: lowEntropySecret,
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectJwtSecurityFindings(cfg, {});

      expect(hasCheck(findings, 'jwt.secret_low_entropy')).toBe(true);
      expect(findings.find((x) => x.checkId === 'jwt.secret_low_entropy')!.severity).toBe('high');
    });

    it('should not flag high-entropy JWT secret', () => {
      const highEntropySecret = 'aB3$kL9!mN2@pQ5#rT8&vX1*yZ4^cF7+';
      const cfg = makeConfig({
        security: {
          jwtSecret: highEntropySecret,
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectJwtSecurityFindings(cfg, { DAEMON_JWT_SECRET: highEntropySecret });

      expect(hasCheck(findings, 'jwt.secret_low_entropy')).toBe(false);
      expect(hasCheck(findings, 'jwt.secret_too_short')).toBe(false);
      expect(hasCheck(findings, 'jwt.secret_default')).toBe(false);
    });

    it('should flag expiration > 24h as medium', () => {
      const cfg = makeConfig({
        security: {
          jwtSecret: 'change-this-in-production-to-a-random-secure-string',
          jwtExpiration: '7d',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectJwtSecurityFindings(cfg, {});

      expect(hasCheck(findings, 'jwt.expiration_too_long')).toBe(true);
    });

    it('should flag no expiration as critical', () => {
      const cfg = makeConfig({
        security: {
          jwtSecret: 'change-this-in-production-to-a-random-secure-string',
          jwtExpiration: '0',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectJwtSecurityFindings(cfg, {});

      expect(hasCheck(findings, 'jwt.no_expiration')).toBe(true);
    });

    it('should flag secret not from env var as high', () => {
      const customSecret = 'aB3$kL9!mN2@pQ5#rT8&vX1*yZ4^cF7+';
      const cfg = makeConfig({
        security: {
          jwtSecret: customSecret,
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
      });
      // No DAEMON_JWT_SECRET in env -- implies hardcoded
      const findings = collectJwtSecurityFindings(cfg, {});

      expect(hasCheck(findings, 'jwt.secret_in_config_file')).toBe(true);
    });

    it('should not flag secret when it comes from env var', () => {
      const secret = 'aB3$kL9!mN2@pQ5#rT8&vX1*yZ4^cF7+';
      const cfg = makeConfig({
        security: {
          jwtSecret: secret,
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectJwtSecurityFindings(cfg, { DAEMON_JWT_SECRET: secret });

      expect(hasCheck(findings, 'jwt.secret_in_config_file')).toBe(false);
    });

    it('should always include algorithm_none and no_refresh_rotation info checks', () => {
      const findings = collectJwtSecurityFindings(makeConfig(), {});

      expect(hasCheck(findings, 'jwt.algorithm_none')).toBe(true);
      expect(hasCheck(findings, 'jwt.no_refresh_rotation')).toBe(true);
    });

    it('should have autoFix on every JWT finding', () => {
      assertAutoFixPresent(collectJwtSecurityFindings(makeConfig(), {}));
    });
  });

  // -------------------------------------------------------------------------
  // CORS (checks 25-28)
  // -------------------------------------------------------------------------

  describe('collectCorsFindings', () => {
    it('should flag wildcard origin as critical', () => {
      const cfg = makeConfig({
        security: {
          jwtSecret: 'x'.repeat(32),
          jwtExpiration: '24h',
          cors: { enabled: true, origins: ['*'] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectCorsFindings(cfg);

      expect(hasCheck(findings, 'cors.wildcard_origin')).toBe(true);
      expect(hasCheck(findings, 'cors.missing_credentials')).toBe(true);
    });

    it('should flag CORS disabled in production as info', () => {
      const cfg = makeConfig({ env: 'production' });
      const findings = collectCorsFindings(cfg);

      expect(hasCheck(findings, 'cors.disabled_in_production')).toBe(true);
    });

    it('should flag localhost in production origins', () => {
      const cfg = makeConfig({
        security: {
          jwtSecret: 'x'.repeat(32),
          jwtExpiration: '24h',
          cors: { enabled: true, origins: ['https://localhost:3000'] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
        env: 'production',
      });
      const findings = collectCorsFindings(cfg);

      expect(hasCheck(findings, 'cors.localhost_in_production')).toBe(true);
    });

    it('should not flag localhost in development', () => {
      const cfg = makeConfig({
        security: {
          jwtSecret: 'x'.repeat(32),
          jwtExpiration: '24h',
          cors: { enabled: true, origins: ['http://localhost:3000'] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
        env: 'development',
      });
      const findings = collectCorsFindings(cfg);

      expect(hasCheck(findings, 'cors.localhost_in_production')).toBe(false);
    });

    it('should have autoFix on every CORS finding', () => {
      const cfg = makeConfig({
        security: {
          jwtSecret: 'x'.repeat(32),
          jwtExpiration: '24h',
          cors: { enabled: true, origins: ['*'] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
        env: 'production',
      });
      assertAutoFixPresent(collectCorsFindings(cfg));
    });
  });

  // -------------------------------------------------------------------------
  // Rate Limiting (checks 29-31)
  // -------------------------------------------------------------------------

  describe('collectRateLimitFindings', () => {
    it('should flag disabled rate limiting as high', () => {
      const cfg = makeConfig({
        security: {
          jwtSecret: 'x'.repeat(32),
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: false, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectRateLimitFindings(cfg);

      expect(hasCheck(findings, 'rate_limit.disabled')).toBe(true);
      expect(findings.find((x) => x.checkId === 'rate_limit.disabled')!.severity).toBe('high');
    });

    it('should flag max>1000 as medium', () => {
      const cfg = makeConfig({
        security: {
          jwtSecret: 'x'.repeat(32),
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 2000, windowMs: 60000 },
        },
      });
      const findings = collectRateLimitFindings(cfg);

      expect(hasCheck(findings, 'rate_limit.too_permissive')).toBe(true);
    });

    it('should flag window > 300000ms as low', () => {
      const cfg = makeConfig({
        security: {
          jwtSecret: 'x'.repeat(32),
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 100, windowMs: 600000 },
        },
      });
      const findings = collectRateLimitFindings(cfg);

      expect(hasCheck(findings, 'rate_limit.window_too_large')).toBe(true);
    });

    it('should not flag reasonable rate limit config', () => {
      const cfg = makeConfig();
      const findings = collectRateLimitFindings(cfg);

      expect(hasCheck(findings, 'rate_limit.disabled')).toBe(false);
      expect(hasCheck(findings, 'rate_limit.too_permissive')).toBe(false);
      expect(hasCheck(findings, 'rate_limit.window_too_large')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // TLS / Transport (checks 32-35)
  // -------------------------------------------------------------------------

  describe('collectTlsFindings', () => {
    it('should flag no HTTPS in production on non-loopback', () => {
      const cfg = makeConfig({
        daemon: { host: '10.0.0.1', port: 8787, name: 'test', maxSessions: 100, verbose: false },
        env: 'production',
      });
      const findings = collectTlsFindings(cfg, {});

      expect(hasCheck(findings, 'tls.no_https')).toBe(true);
      expect(findings.find((x) => x.checkId === 'tls.no_https')!.severity).toBe('critical');
    });

    it('should not flag HTTPS on loopback', () => {
      const cfg = makeConfig({ env: 'production' });
      const findings = collectTlsFindings(cfg, {});

      expect(hasCheck(findings, 'tls.no_https')).toBe(false);
    });

    it('should note self-signed cert check when TLS paths set', () => {
      const cfg = makeConfig();
      const findings = collectTlsFindings(cfg, {
        TLS_CERT_PATH: '/etc/ssl/cert.pem',
        TLS_KEY_PATH: '/etc/ssl/key.pem',
      });

      expect(hasCheck(findings, 'tls.self_signed')).toBe(true);
    });

    it('should flag weak TLS protocol (1.0 or 1.1)', () => {
      const cfg = makeConfig();
      const findings = collectTlsFindings(cfg, {
        NODE_OPTIONS: '--tls-min-v1.0',
      });

      expect(hasCheck(findings, 'tls.weak_protocol')).toBe(true);
      expect(findings.find((x) => x.checkId === 'tls.weak_protocol')!.severity).toBe('critical');
    });

    it('should flag weak cipher suites', () => {
      const cfg = makeConfig();
      const findings = collectTlsFindings(cfg, {
        NODE_OPTIONS: '--tls-cipher-list=RC4-SHA:AES128',
      });

      expect(hasCheck(findings, 'tls.weak_cipher')).toBe(true);
    });

    it('should not flag when no NODE_OPTIONS set', () => {
      const cfg = makeConfig();
      const findings = collectTlsFindings(cfg, {});

      expect(hasCheck(findings, 'tls.weak_protocol')).toBe(false);
      expect(hasCheck(findings, 'tls.weak_cipher')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Environment Variables (checks 36-41)
  // -------------------------------------------------------------------------

  describe('collectEnvSecurityFindings', () => {
    it('should flag missing OPENAI_API_KEY as info', () => {
      const cfg = makeConfig();
      const findings = collectEnvSecurityFindings({}, cfg);

      expect(hasCheck(findings, 'env.api_key_missing')).toBe(true);
    });

    it('should always include dotenv gitignore reminder', () => {
      const cfg = makeConfig();
      const findings = collectEnvSecurityFindings({}, cfg);

      expect(hasCheck(findings, 'env.secrets_in_dotenv')).toBe(true);
    });

    it('should flag DEBUG in production as high', () => {
      const cfg = makeConfig({ env: 'production', debug: true });
      const findings = collectEnvSecurityFindings({ NODE_ENV: 'production', DEBUG: 'true' }, cfg);

      expect(hasCheck(findings, 'env.debug_enabled_production')).toBe(true);
    });

    it('should flag missing NODE_ENV as medium', () => {
      const cfg = makeConfig();
      const findings = collectEnvSecurityFindings({}, cfg);

      expect(hasCheck(findings, 'env.node_env_missing')).toBe(true);
    });

    it('should flag sensitive vars with debug logging in production', () => {
      const cfg = makeConfig({
        logging: { level: 'debug', format: 'json', rotation: { enabled: true, maxSize: 10, maxFiles: 5 } },
        env: 'production',
      });
      const findings = collectEnvSecurityFindings(
        { NODE_ENV: 'production', OPENAI_API_KEY: 'sk-real' },
        cfg,
      );

      expect(hasCheck(findings, 'env.sensitive_vars_logged')).toBe(true);
    });

    it('should flag NODE_PATH containing /tmp as high', () => {
      const cfg = makeConfig();
      const findings = collectEnvSecurityFindings({ NODE_PATH: '/tmp/evil', NODE_ENV: 'production' }, cfg);

      expect(hasCheck(findings, 'env.path_manipulation')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Logging (checks 42-44)
  // -------------------------------------------------------------------------

  describe('collectLoggingFindings', () => {
    it('should flag debug in production as medium', () => {
      const cfg = makeConfig({
        logging: { level: 'debug', format: 'json', rotation: { enabled: true, maxSize: 10, maxFiles: 5 } },
        env: 'production',
      });
      const findings = collectLoggingFindings(cfg);

      expect(hasCheck(findings, 'logging.debug_in_production')).toBe(true);
    });

    it('should flag no file logging in production', () => {
      const cfg = makeConfig({ env: 'production' });
      const findings = collectLoggingFindings(cfg);

      expect(hasCheck(findings, 'logging.no_file_logging')).toBe(true);
    });

    it('should flag disabled rotation when file logging is active', () => {
      const cfg = makeConfig({
        logging: { level: 'info', format: 'json', file: '/var/log/daemon.log', rotation: { enabled: false, maxSize: 10, maxFiles: 5 } },
      });
      const findings = collectLoggingFindings(cfg);

      expect(hasCheck(findings, 'logging.no_rotation')).toBe(true);
    });

    it('should not flag when config is reasonable', () => {
      const cfg = makeConfig({
        logging: { level: 'info', format: 'json', file: '/var/log/daemon.log', rotation: { enabled: true, maxSize: 10, maxFiles: 5 } },
        env: 'production',
      });
      const findings = collectLoggingFindings(cfg);

      expect(hasCheck(findings, 'logging.debug_in_production')).toBe(false);
      expect(hasCheck(findings, 'logging.no_file_logging')).toBe(false);
      expect(hasCheck(findings, 'logging.no_rotation')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // API Key Security (checks 45-48)
  // -------------------------------------------------------------------------

  describe('collectApiKeyFindings', () => {
    it('should flag hardcoded OpenAI key as critical', () => {
      const cfg = makeConfig({ openai: { apiKey: 'sk-live-abc123', model: 'gpt-4' } });
      const findings = collectApiKeyFindings(cfg, {});

      expect(hasCheck(findings, 'api.openai_key_exposed')).toBe(true);
    });

    it('should not flag OpenAI key when env var is set', () => {
      const cfg = makeConfig({ openai: { apiKey: 'sk-live-abc123', model: 'gpt-4' } });
      const findings = collectApiKeyFindings(cfg, { OPENAI_API_KEY: 'sk-live-abc123' });

      expect(hasCheck(findings, 'api.openai_key_exposed')).toBe(false);
    });

    it('should flag hardcoded Anthropic key', () => {
      const cfg = makeConfig({
        anthropic: { apiKey: 'sk-ant-live-abc123', model: 'claude' },
      });
      const findings = collectApiKeyFindings(cfg, {});

      expect(hasCheck(findings, 'api.anthropic_key_exposed')).toBe(true);
    });

    it('should flag hardcoded Neolith secret', () => {
      const cfg = makeConfig({
        neolith: { apiUrl: 'https://api.neolith.io', apiKey: 'key', apiSecret: 'secret123' },
      });
      const findings = collectApiKeyFindings(cfg, {});

      expect(hasCheck(findings, 'api.neolith_secret_exposed')).toBe(true);
    });

    it('should detect API key patterns in loaded config', () => {
      const cfg = makeConfig({ openai: { apiKey: 'sk-real-key', model: 'gpt-4' } });
      const findings = collectApiKeyFindings(cfg, {});

      expect(hasCheck(findings, 'api.key_in_source')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Redis Security (checks 49-51)
  // -------------------------------------------------------------------------

  describe('collectRedisSecurityFindings', () => {
    it('should return empty when no Redis configured', () => {
      const cfg = makeConfig();
      const findings = collectRedisSecurityFindings(cfg);

      expect(findings).toHaveLength(0);
    });

    it('should flag no password on Redis', () => {
      const cfg = makeConfig({
        redis: { url: 'redis://redis-host:6379', db: 0, connectTimeout: 5000 },
      });
      const findings = collectRedisSecurityFindings(cfg);

      expect(hasCheck(findings, 'redis.no_password')).toBe(true);
    });

    it('should flag non-TLS Redis to remote host', () => {
      const cfg = makeConfig({
        redis: { url: 'redis://redis-host:6379', password: 'pass', db: 0, connectTimeout: 5000 },
      });
      const findings = collectRedisSecurityFindings(cfg);

      expect(hasCheck(findings, 'redis.no_tls')).toBe(true);
    });

    it('should not flag TLS Redis', () => {
      const cfg = makeConfig({
        redis: { url: 'rediss://redis-host:6379', password: 'pass', db: 0, connectTimeout: 5000 },
      });
      const findings = collectRedisSecurityFindings(cfg);

      expect(hasCheck(findings, 'redis.no_tls')).toBe(false);
    });

    it('should flag default port on remote host', () => {
      const cfg = makeConfig({
        redis: { url: 'redis://redis-host:6379', password: 'pass', db: 0, connectTimeout: 5000 },
      });
      const findings = collectRedisSecurityFindings(cfg);

      expect(hasCheck(findings, 'redis.default_port_exposed')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Database Security (checks 52-54)
  // -------------------------------------------------------------------------

  describe('collectDatabaseSecurityFindings', () => {
    it('should return empty when no database configured', () => {
      const cfg = makeConfig();
      const findings = collectDatabaseSecurityFindings(cfg);

      expect(findings).toHaveLength(0);
    });

    it('should flag credentials in database URL', () => {
      const cfg = makeConfig({
        database: { url: 'postgresql://user:pass@db-host:5432/mydb', poolSize: 10, connectTimeout: 5000 },
      });
      const findings = collectDatabaseSecurityFindings(cfg);

      expect(hasCheck(findings, 'database.credentials_in_url')).toBe(true);
    });

    it('should flag missing SSL on remote host', () => {
      const cfg = makeConfig({
        database: { url: 'postgresql://db-host:5432/mydb', poolSize: 10, connectTimeout: 5000 },
      });
      const findings = collectDatabaseSecurityFindings(cfg);

      expect(hasCheck(findings, 'database.no_ssl')).toBe(true);
    });

    it('should not flag SSL when sslmode=require present', () => {
      const cfg = makeConfig({
        database: { url: 'postgresql://db-host:5432/mydb?sslmode=require', poolSize: 10, connectTimeout: 5000 },
      });
      const findings = collectDatabaseSecurityFindings(cfg);

      expect(hasCheck(findings, 'database.no_ssl')).toBe(false);
    });

    it('should flag excessive pool size', () => {
      const cfg = makeConfig({
        database: { url: 'postgresql://localhost/mydb', poolSize: 200, connectTimeout: 5000 },
      });
      const findings = collectDatabaseSecurityFindings(cfg);

      expect(hasCheck(findings, 'database.pool_unlimited')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // MCP Tool Safety (checks 55-58)
  // -------------------------------------------------------------------------

  describe('collectMcpToolSafetyFindings', () => {
    it('should return at least 4 findings (all advisory)', () => {
      const findings = collectMcpToolSafetyFindings(makeConfig());

      expect(findings.length).toBeGreaterThanOrEqual(4);
      expect(hasCheck(findings, 'mcp.safety_checks_disabled')).toBe(true);
      expect(hasCheck(findings, 'mcp.dangerous_commands_allowed')).toBe(true);
      expect(hasCheck(findings, 'mcp.path_traversal_possible')).toBe(true);
      expect(hasCheck(findings, 'mcp.no_tool_allowlist')).toBe(true);
    });

    it('should have autoFix on every MCP finding', () => {
      assertAutoFixPresent(collectMcpToolSafetyFindings(makeConfig()));
    });
  });

  // -------------------------------------------------------------------------
  // Distributed / Federation (checks 59-62)
  // -------------------------------------------------------------------------

  describe('collectDistributedSecurityFindings', () => {
    it('should return empty when no distributed config', () => {
      const cfg = makeConfig();
      const findings = collectDistributedSecurityFindings(cfg);

      expect(findings).toHaveLength(0);
    });

    it('should flag no cluster auth and no node verification', () => {
      const cfg = makeConfig({
        distributed: {
          clusterName: 'test-cluster',
          loadBalancingStrategy: 'round-robin',
          rebalanceInterval: 300000,
          migrationTimeout: 30000,
        },
      });
      const findings = collectDistributedSecurityFindings(cfg);

      expect(hasCheck(findings, 'distributed.no_cluster_auth')).toBe(true);
      expect(hasCheck(findings, 'distributed.no_node_verification')).toBe(true);
    });

    it('should flag long migration timeout', () => {
      const cfg = makeConfig({
        distributed: {
          clusterName: 'test-cluster',
          loadBalancingStrategy: 'round-robin',
          rebalanceInterval: 300000,
          migrationTimeout: 180000,
        },
      });
      const findings = collectDistributedSecurityFindings(cfg);

      expect(hasCheck(findings, 'distributed.migration_timeout_long')).toBe(true);
    });

    it('should flag aggressive rebalancing', () => {
      const cfg = makeConfig({
        distributed: {
          clusterName: 'test-cluster',
          loadBalancingStrategy: 'round-robin',
          rebalanceInterval: 30000,
          migrationTimeout: 30000,
        },
      });
      const findings = collectDistributedSecurityFindings(cfg);

      expect(hasCheck(findings, 'distributed.rebalance_aggressive')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Neolith Integration (checks 63-64)
  // -------------------------------------------------------------------------

  describe('collectNeolithSecurityFindings', () => {
    it('should return empty when no Neolith configured', () => {
      const cfg = makeConfig();
      const findings = collectNeolithSecurityFindings(cfg);

      expect(findings).toHaveLength(0);
    });

    it('should flag HTTP Neolith URL as high', () => {
      const cfg = makeConfig({
        neolith: { apiUrl: 'http://api.neolith.io', apiKey: 'key' },
      });
      const findings = collectNeolithSecurityFindings(cfg);

      expect(hasCheck(findings, 'neolith.no_tls')).toBe(true);
    });

    it('should flag missing secret when key is present', () => {
      const cfg = makeConfig({
        neolith: { apiUrl: 'https://api.neolith.io', apiKey: 'key' },
      });
      const findings = collectNeolithSecurityFindings(cfg);

      expect(hasCheck(findings, 'neolith.missing_secret')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Monitoring Security (checks 65-68)
  // -------------------------------------------------------------------------

  describe('collectMonitoringSecurityFindings', () => {
    it('should return empty when no monitoring configured', () => {
      const cfg = makeConfig();
      (cfg as Record<string, unknown>).monitoring = undefined;
      const findings = collectMonitoringSecurityFindings(cfg);

      expect(findings).toHaveLength(0);
    });

    it('should flag metrics on non-loopback interface', () => {
      const cfg = makeConfig({
        daemon: { host: '10.0.0.1', port: 8787, name: 'test', maxSessions: 100, verbose: false },
      });
      const findings = collectMonitoringSecurityFindings(cfg);

      expect(hasCheck(findings, 'monitoring.metrics_exposed')).toBe(true);
    });

    it('should always flag metrics endpoint lacking auth', () => {
      const findings = collectMonitoringSecurityFindings(makeConfig());

      expect(hasCheck(findings, 'monitoring.metrics_no_auth')).toBe(true);
    });

    it('should flag verbose health endpoint', () => {
      const cfg = makeConfig({
        daemon: { host: '127.0.0.1', port: 8787, name: 'test', maxSessions: 100, verbose: true },
      });
      const findings = collectMonitoringSecurityFindings(cfg);

      expect(hasCheck(findings, 'monitoring.health_verbose')).toBe(true);
    });

    it('should flag default metrics port in production', () => {
      const cfg = makeConfig({ env: 'production' });
      const findings = collectMonitoringSecurityFindings(cfg);

      expect(hasCheck(findings, 'monitoring.default_metrics_port')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Memory / Resource Limits (checks 69-72)
  // -------------------------------------------------------------------------

  describe('collectMemorySecurityFindings', () => {
    it('should return empty when no memory config', () => {
      const cfg = makeConfig();
      (cfg as Record<string, unknown>).memory = undefined;
      const findings = collectMemorySecurityFindings(cfg);

      expect(findings).toHaveLength(0);
    });

    it('should flag heap > 8192MB as medium', () => {
      const cfg = makeConfig({
        memory: { maxHeapMB: 16384, maxContextTokens: 128000, compaction: { enabled: true, threshold: 0.8 } },
      });
      const findings = collectMemorySecurityFindings(cfg);

      expect(hasCheck(findings, 'memory.heap_too_large')).toBe(true);
    });

    it('should flag disabled compaction', () => {
      const cfg = makeConfig({
        memory: { maxHeapMB: 2048, maxContextTokens: 128000, compaction: { enabled: false, threshold: 0.8 } },
      });
      const findings = collectMemorySecurityFindings(cfg);

      expect(hasCheck(findings, 'memory.no_compaction')).toBe(true);
    });

    it('should flag excessive context tokens', () => {
      const cfg = makeConfig({
        memory: { maxHeapMB: 2048, maxContextTokens: 500000, compaction: { enabled: true, threshold: 0.8 } },
      });
      const findings = collectMemorySecurityFindings(cfg);

      expect(hasCheck(findings, 'memory.context_tokens_excessive')).toBe(true);
    });

    it('should flag low compaction threshold', () => {
      const cfg = makeConfig({
        memory: { maxHeapMB: 2048, maxContextTokens: 128000, compaction: { enabled: true, threshold: 0.1 } },
      });
      const findings = collectMemorySecurityFindings(cfg);

      expect(hasCheck(findings, 'memory.compaction_threshold_low')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Token Budget (checks 73-76)
  // -------------------------------------------------------------------------

  describe('collectTokenBudgetFindings', () => {
    it('should return empty when no budget config', () => {
      const cfg = makeConfig();
      (cfg as Record<string, unknown>).tokenBudget = undefined;
      const findings = collectTokenBudgetFindings(cfg);

      expect(findings).toHaveLength(0);
    });

    it('should flag disabled alerts', () => {
      const cfg = makeConfig({
        tokenBudget: {
          daily: 1000000, weekly: 5000000, monthly: 20000000,
          alerts: { enabled: false, threshold: 0.8 },
        },
      });
      const findings = collectTokenBudgetFindings(cfg);

      expect(hasCheck(findings, 'token_budget.no_alerts')).toBe(true);
    });

    it('should flag excessive daily budget', () => {
      const cfg = makeConfig({
        tokenBudget: {
          daily: 50000000, weekly: 50000000, monthly: 200000000,
          alerts: { enabled: true, threshold: 0.8 },
        },
      });
      const findings = collectTokenBudgetFindings(cfg);

      expect(hasCheck(findings, 'token_budget.excessive_daily')).toBe(true);
    });

    it('should flag high alert threshold', () => {
      const cfg = makeConfig({
        tokenBudget: {
          daily: 1000000, weekly: 5000000, monthly: 20000000,
          alerts: { enabled: true, threshold: 0.99 },
        },
      });
      const findings = collectTokenBudgetFindings(cfg);

      expect(hasCheck(findings, 'token_budget.alert_threshold_high')).toBe(true);
    });

    it('should flag extremely high monthly budget', () => {
      const cfg = makeConfig({
        tokenBudget: {
          daily: 1000000, weekly: 5000000, monthly: 500000000,
          alerts: { enabled: true, threshold: 0.8 },
        },
      });
      const findings = collectTokenBudgetFindings(cfg);

      expect(hasCheck(findings, 'token_budget.no_monthly_limit')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Filesystem Permissions (checks 77-82) -- mocked
  // -------------------------------------------------------------------------

  describe('collectFilesystemFindings', () => {
    it('should skip on Windows', async () => {
      const findings = await collectFilesystemFindings({
        platform: 'win32',
      });

      expect(hasCheck(findings, 'fs.windows_skipped')).toBe(true);
      expect(findings).toHaveLength(1);
    });

    it('should flag world-writable config file as critical', async () => {
      const mockStat = vi.fn().mockResolvedValue({
        mode: 0o100666, // rw-rw-rw-
        isSymbolicLink: () => false,
      });

      const findings = await collectFilesystemFindings({
        configPath: '/etc/wundr/config.json',
        statFn: mockStat as unknown as typeof import('node:fs/promises').stat,
        platform: 'linux',
      });

      expect(hasCheck(findings, 'fs.config_file_writable')).toBe(true);
      expect(findings.find((x) => x.checkId === 'fs.config_file_writable')!.severity).toBe('critical');
    });

    it('should flag world-readable config file as high', async () => {
      const mockStat = vi.fn().mockResolvedValue({
        mode: 0o100644, // rw-r--r--
        isSymbolicLink: () => false,
      });

      const findings = await collectFilesystemFindings({
        configPath: '/etc/wundr/config.json',
        statFn: mockStat as unknown as typeof import('node:fs/promises').stat,
        platform: 'linux',
      });

      expect(hasCheck(findings, 'fs.config_file_world_readable')).toBe(true);
    });

    it('should flag config file symlink as medium', async () => {
      const mockStat = vi.fn().mockResolvedValue({
        mode: 0o100600, // rw-------
        isSymbolicLink: () => true,
      });

      const findings = await collectFilesystemFindings({
        configPath: '/etc/wundr/config.json',
        statFn: mockStat as unknown as typeof import('node:fs/promises').stat,
        platform: 'linux',
      });

      expect(hasCheck(findings, 'fs.config_file_symlink')).toBe(true);
    });

    it('should flag world-readable .env file as critical', async () => {
      const mockStat = vi.fn().mockResolvedValue({
        mode: 0o100644, // rw-r--r--
        isSymbolicLink: () => false,
      });

      const findings = await collectFilesystemFindings({
        dotenvPath: '/workspace/.env',
        statFn: mockStat as unknown as typeof import('node:fs/promises').stat,
        platform: 'linux',
      });

      expect(hasCheck(findings, 'fs.dotenv_world_readable')).toBe(true);
      expect(findings.find((x) => x.checkId === 'fs.dotenv_world_readable')!.severity).toBe('critical');
    });

    it('should flag group-readable .env file as high', async () => {
      const mockStat = vi.fn().mockResolvedValue({
        mode: 0o100640, // rw-r-----
        isSymbolicLink: () => false,
      });

      const findings = await collectFilesystemFindings({
        dotenvPath: '/workspace/.env',
        statFn: mockStat as unknown as typeof import('node:fs/promises').stat,
        platform: 'linux',
      });

      expect(hasCheck(findings, 'fs.dotenv_group_readable')).toBe(true);
    });

    it('should handle stat failure gracefully', async () => {
      const mockStat = vi.fn().mockRejectedValue(new Error('ENOENT'));

      const findings = await collectFilesystemFindings({
        configPath: '/nonexistent/config.json',
        statFn: mockStat as unknown as typeof import('node:fs/promises').stat,
        platform: 'linux',
      });

      // Should not crash, should return empty findings for the missing file
      expect(findings).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Dependency Scanning (checks 83-84) -- mocked
  // -------------------------------------------------------------------------

  describe('collectDependencyFindings', () => {
    it('should detect known vulnerable dependencies', async () => {
      const mockReadFile = vi.fn().mockResolvedValue(
        JSON.stringify({
          dependencies: {
            lodash: '^4.17.20',
            express: '^4.18.0',
          },
        }),
      );

      const findings = await collectDependencyFindings({
        projectDir: '/workspace',
        readFileFn: mockReadFile as unknown as typeof import('node:fs/promises').readFile,
      });

      expect(hasCheck(findings, 'deps.known_vulnerabilities')).toBe(true);
    });

    it('should detect pre-1.0 security-critical packages', async () => {
      const mockReadFile = vi.fn().mockResolvedValue(
        JSON.stringify({
          dependencies: {
            jsonwebtoken: '^0.9.0',
            ws: '^8.16.0',
          },
        }),
      );

      const findings = await collectDependencyFindings({
        projectDir: '/workspace',
        readFileFn: mockReadFile as unknown as typeof import('node:fs/promises').readFile,
      });

      expect(hasCheck(findings, 'deps.outdated_critical')).toBe(true);
    });

    it('should return empty when package.json cannot be read', async () => {
      const mockReadFile = vi.fn().mockRejectedValue(new Error('ENOENT'));

      const findings = await collectDependencyFindings({
        projectDir: '/nonexistent',
        readFileFn: mockReadFile as unknown as typeof import('node:fs/promises').readFile,
      });

      expect(findings).toHaveLength(0);
    });

    it('should handle package.json with no known vulnerable deps', async () => {
      const mockReadFile = vi.fn().mockResolvedValue(
        JSON.stringify({
          dependencies: {
            'safe-package': '^2.0.0',
          },
        }),
      );

      const findings = await collectDependencyFindings({
        projectDir: '/workspace',
        readFileFn: mockReadFile as unknown as typeof import('node:fs/promises').readFile,
      });

      expect(hasCheck(findings, 'deps.known_vulnerabilities')).toBe(false);
    });

    it('should check devDependencies as well', async () => {
      const mockReadFile = vi.fn().mockResolvedValue(
        JSON.stringify({
          devDependencies: {
            lodash: '4.17.10',
          },
        }),
      );

      const findings = await collectDependencyFindings({
        projectDir: '/workspace',
        readFileFn: mockReadFile as unknown as typeof import('node:fs/promises').readFile,
      });

      expect(hasCheck(findings, 'deps.known_vulnerabilities')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Report Formatting: Text
  // -------------------------------------------------------------------------

  describe('formatAuditReportText', () => {
    const sampleReport: SecurityAuditReport = {
      ts: 1700000000000,
      version: '2.0.0',
      summary: { critical: 1, high: 1, medium: 0, low: 0, info: 1, total: 3 },
      findings: [
        {
          checkId: 'daemon.host_all_interfaces',
          severity: 'critical',
          title: 'Daemon binds to all interfaces',
          detail: 'daemon.host="0.0.0.0"',
          remediation: 'Set daemon.host to 127.0.0.1',
          autoFix: 'DAEMON_HOST=127.0.0.1',
        },
        {
          checkId: 'ws.no_rate_limit',
          severity: 'high',
          title: 'No per-client rate limiting',
          detail: 'Rate limiting is disabled',
          remediation: 'Enable rate limiting',
          autoFix: 'DAEMON_RATE_LIMIT_ENABLED=true',
        },
        {
          checkId: 'daemon.default_name',
          severity: 'info',
          title: 'Default name',
          detail: 'Using default name',
          remediation: 'Set a unique name',
          autoFix: 'DAEMON_NAME=node-01',
        },
      ],
    };

    it('should include header, summary, and findings', () => {
      const text = formatAuditReportText(sampleReport);

      expect(text).toContain('Wundr Security Audit Report');
      expect(text).toContain('Version: 2.0.0');
      expect(text).toContain('1 critical');
      expect(text).toContain('1 high');
      expect(text).toContain('3 total');
    });

    it('should group findings by category', () => {
      const text = formatAuditReportText(sampleReport);

      expect(text).toContain('--- DAEMON ---');
      expect(text).toContain('--- WS ---');
    });

    it('should include remediation and auto-fix', () => {
      const text = formatAuditReportText(sampleReport);

      expect(text).toContain('Fix:');
      expect(text).toContain('Auto-fix:');
      expect(text).toContain('DAEMON_HOST=127.0.0.1');
    });

    it('should include WebSocket probe info when present', () => {
      const report: SecurityAuditReport = {
        ...sampleReport,
        deep: {
          websocket: {
            attempted: true,
            url: 'ws://127.0.0.1:8787',
            ok: true,
            error: null,
            latencyMs: 42,
          },
        },
      };
      const text = formatAuditReportText(report);

      expect(text).toContain('DEEP: WEBSOCKET PROBE');
      expect(text).toContain('42ms');
    });

    it('should include plugin scan summary when present', () => {
      const report: SecurityAuditReport = {
        ...sampleReport,
        deep: {
          pluginScan: {
            scannedFiles: 10,
            critical: 0,
            warn: 2,
            info: 1,
            findings: [],
          },
        },
      };
      const text = formatAuditReportText(report);

      expect(text).toContain('DEEP: PLUGIN SCAN');
      expect(text).toContain('10 files');
    });
  });

  // -------------------------------------------------------------------------
  // Report Formatting: Markdown
  // -------------------------------------------------------------------------

  describe('formatAuditReportMarkdown', () => {
    it('should produce valid Markdown structure', () => {
      const report: SecurityAuditReport = {
        ts: 1700000000000,
        version: '2.0.0',
        summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0, total: 1 },
        findings: [
          {
            checkId: 'daemon.host_all_interfaces',
            severity: 'critical',
            title: 'Daemon binds to all interfaces',
            detail: 'daemon.host="0.0.0.0"',
            remediation: 'Fix it',
            autoFix: 'DAEMON_HOST=127.0.0.1',
          },
        ],
      };
      const md = formatAuditReportMarkdown(report);

      expect(md).toContain('# Wundr Security Audit Report');
      expect(md).toContain('## Summary');
      expect(md).toContain('| Critical | 1 |');
      expect(md).toContain('## Critical Findings');
      expect(md).toContain('### Daemon binds to all interfaces');
      expect(md).toContain('**Remediation:**');
      expect(md).toContain('**Auto-fix:**');
    });

    it('should omit empty severity sections', () => {
      const report: SecurityAuditReport = {
        ts: 1700000000000,
        version: '2.0.0',
        summary: { critical: 0, high: 0, medium: 0, low: 0, info: 1, total: 1 },
        findings: [
          {
            checkId: 'test.info',
            severity: 'info',
            title: 'Info finding',
            detail: 'Detail',
            remediation: 'None',
            autoFix: 'none',
          },
        ],
      };
      const md = formatAuditReportMarkdown(report);

      expect(md).not.toContain('## Critical Findings');
      expect(md).not.toContain('## High Severity Findings');
      expect(md).toContain('## Informational');
    });

    it('should use bullet format for low/info findings', () => {
      const report: SecurityAuditReport = {
        ts: 1700000000000,
        version: '2.0.0',
        summary: { critical: 0, high: 0, medium: 0, low: 1, info: 0, total: 1 },
        findings: [
          {
            checkId: 'test.low',
            severity: 'low',
            title: 'Low finding',
            detail: 'Some detail',
            remediation: 'Fix',
            autoFix: 'auto',
          },
        ],
      };
      const md = formatAuditReportMarkdown(report);

      expect(md).toContain('- **Low finding**');
    });
  });

  // -------------------------------------------------------------------------
  // Report Formatting: HTML
  // -------------------------------------------------------------------------

  describe('formatAuditReportHtml', () => {
    it('should produce valid HTML document', () => {
      const report: SecurityAuditReport = {
        ts: 1700000000000,
        version: '2.0.0',
        summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0, total: 1 },
        findings: [
          {
            checkId: 'daemon.host_all_interfaces',
            severity: 'critical',
            title: 'Daemon binds to all interfaces',
            detail: 'daemon.host="0.0.0.0"',
            remediation: 'Fix it',
            autoFix: 'DAEMON_HOST=127.0.0.1',
          },
        ],
      };
      const html = formatAuditReportHtml(report);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
      expect(html).toContain('<title>Wundr Security Audit Report</title>');
      expect(html).toContain('badge-critical');
      expect(html).toContain('CRITICAL');
    });

    it('should escape HTML special characters', () => {
      const report: SecurityAuditReport = {
        ts: 1700000000000,
        version: '2.0.0',
        summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0, total: 1 },
        findings: [
          {
            checkId: 'test.xss',
            severity: 'critical',
            title: 'Test <script>alert("xss")</script>',
            detail: 'Contains & and "quotes"',
            remediation: 'Fix <it>',
            autoFix: 'do & fix',
          },
        ],
      };
      const html = formatAuditReportHtml(report);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;');
      expect(html).toContain('&quot;');
    });

    it('should include summary table', () => {
      const report: SecurityAuditReport = {
        ts: 1700000000000,
        version: '2.0.0',
        summary: { critical: 2, high: 3, medium: 1, low: 4, info: 5, total: 15 },
        findings: [],
      };
      const html = formatAuditReportHtml(report);

      expect(html).toContain('<th>Severity</th>');
      expect(html).toContain('<td>2</td>');
      expect(html).toContain('<th>15</th>');
    });

    it('should include WebSocket probe and plugin scan in deep mode', () => {
      const report: SecurityAuditReport = {
        ts: 1700000000000,
        version: '2.0.0',
        summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
        findings: [],
        deep: {
          websocket: {
            attempted: true,
            url: 'ws://127.0.0.1:8787',
            ok: false,
            error: 'Connection refused',
            latencyMs: null,
          },
          pluginScan: {
            scannedFiles: 5,
            critical: 1,
            warn: 2,
            info: 0,
            findings: [],
          },
        },
      };
      const html = formatAuditReportHtml(report);

      expect(html).toContain('Deep: WebSocket Probe');
      expect(html).toContain('Connection refused');
      expect(html).toContain('Deep: Plugin Scan');
      expect(html).toContain('5 files');
    });
  });

  // -------------------------------------------------------------------------
  // runSecurityAudit - orchestrator
  // -------------------------------------------------------------------------

  describe('runSecurityAudit', () => {
    it('should return a complete report with all sections', async () => {
      const report = await runSecurityAudit({
        config: makeConfig(),
        env: { NODE_ENV: 'development' },
        platform: 'linux',
        includeFilesystem: false,
      });

      expect(report.version).toBe('2.0.0');
      expect(report.ts).toBeGreaterThan(0);
      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.findings.length).toBe(report.summary.total);
      expect(
        report.summary.critical +
          report.summary.high +
          report.summary.medium +
          report.summary.low +
          report.summary.info,
      ).toBe(report.summary.total);
    });

    it('should invoke progress callback for all phases', async () => {
      const phases: ProgressPhase[] = [];

      await runSecurityAudit({
        config: makeConfig(),
        env: {},
        platform: 'linux',
        includeFilesystem: false,
        onProgress: (phase, done, total) => {
          phases.push(phase);
          expect(done).toBeLessThanOrEqual(total);
          expect(done).toBeGreaterThan(0);
        },
      });

      expect(phases).toContain('config');
      expect(phases).toContain('websocket');
      expect(phases).toContain('jwt');
      expect(phases).toContain('cors');
      expect(phases).toContain('rateLimit');
      expect(phases).toContain('tls');
      expect(phases).toContain('env');
      expect(phases).toContain('logging');
      expect(phases).toContain('apiKeys');
      expect(phases).toContain('redis');
      expect(phases).toContain('database');
      expect(phases).toContain('mcp');
      expect(phases).toContain('distributed');
      expect(phases).toContain('neolith');
      expect(phases).toContain('monitoring');
      expect(phases).toContain('memory');
      expect(phases).toContain('tokenBudget');
      expect(phases).toContain('filesystem');
      expect(phases).toContain('dependencies');
      expect(phases).toContain('plugins');
      expect(phases).toContain('wsProbe');
      expect(phases).toContain('complete');
    });

    it('should include dependency scan when projectDir is set', async () => {
      const mockReadFile = vi.fn().mockResolvedValue(
        JSON.stringify({
          dependencies: { lodash: '4.17.20' },
        }),
      );

      const report = await runSecurityAudit({
        config: makeConfig(),
        env: {},
        platform: 'linux',
        includeFilesystem: false,
        projectDir: '/workspace',
        readFileFn: mockReadFile as unknown as typeof import('node:fs/promises').readFile,
      });

      expect(report.findings.some((f) => f.checkId.startsWith('deps.'))).toBe(true);
    });

    it('should include filesystem findings when enabled', async () => {
      const mockStat = vi.fn().mockResolvedValue({
        mode: 0o100666,
        isSymbolicLink: () => false,
      });

      const report = await runSecurityAudit({
        config: makeConfig(),
        env: {},
        platform: 'linux',
        includeFilesystem: true,
        configPath: '/etc/wundr/config.json',
        statFn: mockStat as unknown as typeof import('node:fs/promises').stat,
      });

      expect(report.findings.some((f) => f.checkId.startsWith('fs.'))).toBe(true);
    });

    it('should not include deep mode results when deep=false', async () => {
      const report = await runSecurityAudit({
        config: makeConfig(),
        env: {},
        platform: 'linux',
        deep: false,
        includeFilesystem: false,
      });

      expect(report.deep).toBeUndefined();
    });

    it('should include deep WebSocket probe when deep=true', async () => {
      const mockProbe = vi.fn().mockResolvedValue({
        attempted: true,
        url: 'ws://127.0.0.1:8787',
        ok: false,
        error: 'Connection refused',
        latencyMs: null,
      });

      const report = await runSecurityAudit({
        config: makeConfig(),
        env: {},
        platform: 'linux',
        deep: true,
        includeFilesystem: false,
        probeWebSocketFn: mockProbe,
      });

      expect(report.deep).toBeDefined();
      expect(report.deep!.websocket).toBeDefined();
      expect(report.deep!.websocket!.attempted).toBe(true);
      expect(mockProbe).toHaveBeenCalled();
    });

    it('should add ws.probe_failed finding when probe fails', async () => {
      const mockProbe = vi.fn().mockResolvedValue({
        attempted: true,
        url: 'ws://127.0.0.1:8787',
        ok: false,
        error: 'ECONNREFUSED',
        latencyMs: null,
      });

      const report = await runSecurityAudit({
        config: makeConfig(),
        env: {},
        platform: 'linux',
        deep: true,
        includeFilesystem: false,
        probeWebSocketFn: mockProbe,
      });

      expect(report.findings.some((f) => f.checkId === 'ws.probe_failed')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Risk Scoring / Severity Counts
  // -------------------------------------------------------------------------

  describe('severity counting and risk scoring', () => {
    it('should correctly count findings by severity', async () => {
      const report = await runSecurityAudit({
        config: makeConfig(),
        env: {},
        platform: 'linux',
        includeFilesystem: false,
      });

      let critical = 0;
      let high = 0;
      let medium = 0;
      let low = 0;
      let info = 0;

      for (const f of report.findings) {
        switch (f.severity) {
          case 'critical': critical++; break;
          case 'high': high++; break;
          case 'medium': medium++; break;
          case 'low': low++; break;
          case 'info': info++; break;
        }
      }

      expect(report.summary.critical).toBe(critical);
      expect(report.summary.high).toBe(high);
      expect(report.summary.medium).toBe(medium);
      expect(report.summary.low).toBe(low);
      expect(report.summary.info).toBe(info);
      expect(report.summary.total).toBe(report.findings.length);
    });

    it('should have a total that equals the sum of all severities', async () => {
      const report = await runSecurityAudit({
        config: makeConfig({
          daemon: { host: '0.0.0.0', port: 8787, name: 'orchestrator-daemon', maxSessions: 0, verbose: true },
          env: 'production',
        }),
        env: { DEBUG: 'true', NODE_ENV: 'production' },
        platform: 'linux',
        includeFilesystem: false,
      });

      const sum =
        report.summary.critical +
        report.summary.high +
        report.summary.medium +
        report.summary.low +
        report.summary.info;

      expect(report.summary.total).toBe(sum);
    });
  });

  // -------------------------------------------------------------------------
  // Auto-fix suggestions
  // -------------------------------------------------------------------------

  describe('auto-fix suggestions', () => {
    it('should provide autoFix on all findings from a comprehensive audit', async () => {
      const report = await runSecurityAudit({
        config: makeConfig({
          daemon: { host: '0.0.0.0', port: 8787, name: 'orchestrator-daemon', maxSessions: 0, verbose: true },
          env: 'production',
          distributed: {
            clusterName: 'test',
            loadBalancingStrategy: 'round-robin',
            rebalanceInterval: 10000,
            migrationTimeout: 180000,
          },
          neolith: { apiUrl: 'http://api.neolith.io', apiKey: 'key' },
        }),
        env: { DEBUG: 'true', NODE_ENV: 'production', NODE_PATH: '/tmp/evil' },
        platform: 'linux',
        includeFilesystem: false,
      });

      for (const f of report.findings) {
        expect(f.autoFix, `Finding ${f.checkId} missing autoFix`).toBeDefined();
        expect(typeof f.autoFix).toBe('string');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Shannon Entropy (used by JWT check)
  // -------------------------------------------------------------------------

  describe('Shannon entropy analysis (via JWT checks)', () => {
    it('should accept high-entropy secrets', () => {
      // A base64-encoded random string has entropy ~5.5-6.0 bits/char
      const secret = 'aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8gH9iJ0kL';
      const cfg = makeConfig({
        security: {
          jwtSecret: secret,
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectJwtSecurityFindings(cfg, { DAEMON_JWT_SECRET: secret });

      expect(hasCheck(findings, 'jwt.secret_low_entropy')).toBe(false);
    });

    it('should reject low-entropy secrets (all same char)', () => {
      const secret = 'x'.repeat(64);
      const cfg = makeConfig({
        security: {
          jwtSecret: secret,
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectJwtSecurityFindings(cfg, {});

      expect(hasCheck(findings, 'jwt.secret_low_entropy')).toBe(true);
    });

    it('should reject low-entropy secrets (two chars alternating)', () => {
      const secret = 'abababababababababababababababababababababababababab';
      const cfg = makeConfig({
        security: {
          jwtSecret: secret,
          jwtExpiration: '24h',
          cors: { enabled: false, origins: [] },
          rateLimit: { enabled: true, max: 100, windowMs: 60000 },
        },
      });
      const findings = collectJwtSecurityFindings(cfg, {});

      expect(hasCheck(findings, 'jwt.secret_low_entropy')).toBe(true);
    });
  });
});
