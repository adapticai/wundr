# Security Audit Framework -- Port from OpenClaw to Wundr

## 1. Executive Summary

This document describes the design and implementation of a comprehensive security
audit CLI framework for Wundr's orchestrator-daemon, adapted from OpenClaw's
`security/audit.ts` (993 lines) and `security/skill-scanner.ts` (442 lines).

The port is not a direct copy. OpenClaw's audit is shaped around its gateway/channel
model (Discord, Slack, Telegram). Wundr's orchestrator-daemon has a fundamentally
different architecture: a daemon that manages LLM sessions over WebSockets, exposes
MCP tools, loads plugins, and federates across a distributed cluster. The security
surface is therefore different, and the audit checks have been redesigned accordingly.

### Deliverables

| File | Purpose | Approximate Size |
|------|---------|-----------------|
| `security/audit.ts` | Main audit engine with 60+ checks | ~900 lines |
| `security/skill-scanner.ts` | Plugin/skill code scanner | ~450 lines |

## 2. Mapping: OpenClaw Concepts to Wundr Concepts

| OpenClaw Domain | Wundr Equivalent | Notes |
|-----------------|------------------|-------|
| Gateway (bind, auth, tailscale) | WebSocket server (host, port, JWT) | Wundr uses ws:// on configurable host/port with JWT auth |
| Channel plugins (Discord, Slack, Telegram) | MCP tool registry + plugin system | Wundr registers tools programmatically |
| Channel DM policies / allowlists | RBAC + session access control | Wundr has RoleBasedAccessControl in @wundr/security |
| Browser control (CDP) | N/A for initial port | Wundr does not expose browser control |
| Tailscale serve/funnel | Distributed cluster federation | Wundr federates nodes via Redis |
| Skills (installed code) | MCP tools + registered plugins | Dynamic tool registration in McpToolRegistryImpl |
| gateway.auth.token | security.jwtSecret | Wundr uses JWT-based auth |
| Config file permissions | Config file + .env permissions | Same concept, different paths |
| State directory | Daemon data directory | Logs, audit trail, memory state |
| Elevated exec allowlist | RBAC permissions + tool safety | McpToolRegistryImpl.isCommandDangerous |
| Hooks hardening | N/A (no hook system yet) | Skipped |
| Secrets in config | Secrets in config + .env | Same concept extended |
| Logging redaction | logging.level + format | Similar but different config shape |

## 3. Architecture

### 3.1 Audit Engine (`security/audit.ts`)

```
runSecurityAudit(opts)
  |
  +-- collectDaemonConfigFindings(cfg)         // Host binding, max sessions
  +-- collectWebSocketSecurityFindings(cfg)     // WS auth, origin validation
  +-- collectJwtSecurityFindings(cfg, env)      // JWT secret strength, expiration
  +-- collectCorsFindings(cfg)                  // CORS configuration
  +-- collectRateLimitFindings(cfg)             // Rate limiting
  +-- collectTlsFindings(cfg, env)              // TLS/HTTPS configuration
  +-- collectEnvSecurityFindings(env)           // Env var hygiene
  +-- collectLoggingFindings(cfg)               // Log level, format, redaction
  +-- collectApiKeyFindings(cfg, env)           // API key presence and strength
  +-- collectRedisSecurityFindings(cfg)         // Redis auth, TLS
  +-- collectDatabaseSecurityFindings(cfg)      // DB connection security
  +-- collectMcpToolSafetyFindings(cfg)         // Tool safety checks enabled
  +-- collectDistributedSecurityFindings(cfg)   // Cluster auth, migration
  +-- collectNeolithSecurityFindings(cfg)       // API integration security
  +-- collectDependencyFindings(projectPath)    // package.json vulnerability scan
  +-- collectFilesystemFindings(paths)          // File/dir permission checks
  +-- collectPluginCodeSafetyFindings(dir)      // Deep: scan plugin source
  +-- maybeProbeWebSocket(cfg)                  // Deep: live WS probe
```

### 3.2 Skill Scanner (`security/skill-scanner.ts`)

The skill scanner is a static analysis engine that scans plugin/tool source
code for malicious patterns. It operates with two rule categories:

1. **Line Rules** - Patterns matched per-line with optional full-source context:
   - Shell command execution (child_process)
   - Dynamic code execution (eval, constructor-based code gen)
   - Crypto-mining references
   - Suspicious network connections (non-standard ports)
   - Command injection patterns
   - File system manipulation with network send
   - Prototype pollution vectors

2. **Source Rules** - Patterns matched against full file content:
   - Data exfiltration (file read + network send)
   - Obfuscated code (hex sequences, large base64 payloads)
   - Environment variable harvesting
   - DNS rebinding patterns
   - Reverse shell signatures
   - Package install scripts with network calls

## 4. Check Inventory (60+ Checks)

### Category: Daemon Configuration (6 checks)
1. `daemon.host_not_loopback` - Daemon binds beyond 127.0.0.1
2. `daemon.host_all_interfaces` - Daemon binds to 0.0.0.0
3. `daemon.max_sessions_unlimited` - No session limit configured
4. `daemon.max_sessions_excessive` - Session limit above 500
5. `daemon.default_name` - Using default daemon name
6. `daemon.verbose_production` - Verbose mode in production

### Category: WebSocket Security (8 checks)
7. `ws.no_auth` - WebSocket server has no authentication
8. `ws.no_origin_validation` - No origin check on WS connections
9. `ws.no_message_size_limit` - No message size limit
10. `ws.no_rate_limit` - No per-client rate limiting
11. `ws.no_heartbeat_timeout` - No client heartbeat timeout
12. `ws.broadcast_unrestricted` - Broadcasts reach all clients
13. `ws.no_tls` - WebSocket not using WSS/TLS
14. `ws.session_fixation` - Session IDs predictable

### Category: JWT / Authentication (8 checks)
15. `jwt.secret_default` - JWT secret is the hardcoded default
16. `jwt.secret_too_short` - JWT secret under 32 characters
17. `jwt.secret_low_entropy` - JWT secret has low entropy
18. `jwt.expiration_too_long` - Token expiration above 24h
19. `jwt.no_expiration` - Token has no expiration
20. `jwt.no_refresh_rotation` - No refresh token rotation
21. `jwt.algorithm_none` - JWT allows "none" algorithm
22. `jwt.secret_in_config_file` - Secret hardcoded in config (not env)

### Category: CORS (4 checks)
23. `cors.wildcard_origin` - CORS allows all origins (*)
24. `cors.disabled_in_production` - CORS disabled but may be needed
25. `cors.localhost_in_production` - localhost in CORS origins in prod
26. `cors.missing_credentials` - CORS allows credentials with wildcard

### Category: Rate Limiting (3 checks)
27. `rate_limit.disabled` - Rate limiting is off
28. `rate_limit.too_permissive` - Rate limit above 1000/min
29. `rate_limit.window_too_large` - Rate limit window above 5 min

### Category: TLS / Transport (4 checks)
30. `tls.no_https` - No TLS termination configured
31. `tls.self_signed` - Self-signed certificate detected
32. `tls.weak_protocol` - TLS version below 1.2
33. `tls.weak_cipher` - Weak cipher suite detected

### Category: Environment Variables (6 checks)
34. `env.api_key_missing` - OPENAI_API_KEY not set
35. `env.secrets_in_dotenv` - .env file exists with secrets
36. `env.dotenv_world_readable` - .env file is world-readable
37. `env.debug_enabled_production` - DEBUG=true in production
38. `env.node_env_missing` - NODE_ENV not set
39. `env.sensitive_vars_logged` - Sensitive env vars potentially logged

### Category: Logging (3 checks)
40. `logging.debug_in_production` - Debug log level in production
41. `logging.no_file_logging` - No file logging configured
42. `logging.no_rotation` - Log rotation disabled

### Category: API Key Security (4 checks)
43. `api.openai_key_exposed` - OpenAI key in config file
44. `api.anthropic_key_exposed` - Anthropic key in config file
45. `api.neolith_secret_exposed` - Neolith API secret in config
46. `api.key_in_source` - API key found in source code

### Category: Redis Security (3 checks)
47. `redis.no_password` - Redis has no password
48. `redis.no_tls` - Redis connection without TLS
49. `redis.default_port_exposed` - Redis on default port exposed

### Category: Database Security (3 checks)
50. `database.credentials_in_url` - DB credentials in connection URL
51. `database.no_ssl` - Database connection without SSL
52. `database.pool_unlimited` - No connection pool limit

### Category: MCP Tool Safety (4 checks)
53. `mcp.safety_checks_disabled` - Tool safety checks disabled
54. `mcp.dangerous_commands_allowed` - Dangerous commands not blocked
55. `mcp.path_traversal_possible` - Path traversal not prevented
56. `mcp.no_tool_allowlist` - No tool execution allowlist

### Category: Distributed/Federation (4 checks)
57. `distributed.no_cluster_auth` - No inter-node auth
58. `distributed.migration_timeout_long` - Long migration timeout
59. `distributed.rebalance_aggressive` - Too-frequent rebalancing
60. `distributed.no_node_verification` - No node identity verification

### Category: Filesystem (6 checks)
61. `fs.state_dir_world_writable` - State dir is world-writable
62. `fs.state_dir_group_writable` - State dir is group-writable
63. `fs.config_file_writable` - Config file writable by others
64. `fs.config_file_world_readable` - Config file world-readable
65. `fs.dotenv_permissions` - .env file has loose permissions
66. `fs.log_dir_permissions` - Log directory has loose permissions

### Category: Dependency Scanning (2 checks)
67. `deps.known_vulnerabilities` - Known vulnerable packages
68. `deps.outdated_critical` - Critically outdated dependencies

### Category: Plugin Code Safety (Deep scan, 4+ checks)
69. `plugin.dangerous_exec` - Shell execution in plugin code
70. `plugin.dynamic_code` - eval/constructor-based code gen in plugin code
71. `plugin.data_exfiltration` - File read + network send
72. `plugin.env_harvesting` - process.env + network send

## 5. Severity Classification

| Severity | Meaning | Action |
|----------|---------|--------|
| `critical` | Active exploit vector or credential exposure | Must fix before deployment |
| `warn` | Hardening gap or risky configuration | Should fix soon |
| `info` | Informational, best-practice suggestion | Nice to have |

## 6. Report Format

```typescript
interface SecurityAuditReport {
  ts: number;                          // Timestamp
  version: string;                     // Audit engine version
  summary: SecurityAuditSummary;       // Count by severity
  findings: SecurityAuditFinding[];    // All findings
  deep?: {                             // Optional deep-probe results
    websocket?: WebSocketProbeResult;
    pluginScan?: PluginScanSummary;
  };
}
```

Reports can be output as:
- JSON (machine-readable, for CI/CD)
- Text (human-readable, for terminal)
- Markdown (for documentation)

## 7. Integration Points

### CLI Integration
The audit runs via the orchestrator-daemon CLI:
```
wundr security audit              # Standard audit
wundr security audit --deep       # + WS probe + plugin source scan
wundr security audit --json       # JSON output for CI
wundr security audit --fix        # Suggest remediations
```

### CI/CD Integration
- Exit code 1 if any critical finding
- Exit code 0 if only warn/info
- JSON output parseable by GitHub Actions, GitLab CI

### Monitoring Integration
- Emit audit findings as metrics via the existing MetricsCollector
- Alert on new critical findings

## 8. Key Design Decisions

1. **Pure functions over classes**: Following OpenClaw's pattern, each check
   category is a standalone function returning `SecurityAuditFinding[]`. This
   makes checks easy to test in isolation.

2. **Dependency injection**: The audit accepts overrides for env, platform,
   filesystem probes, and WS connectivity. This enables deterministic testing.

3. **No external dependencies**: The audit engine uses only Node.js built-ins
   and the existing Wundr config types. The skill scanner uses only `node:fs`
   and `node:path`.

4. **Incremental by default**: Standard audit is fast (no I/O beyond config).
   Deep audit adds filesystem scans, WS probes, and plugin code analysis.

5. **Stable check IDs**: Each finding has a stable `checkId` like
   `jwt.secret_too_short`. This allows suppression, tracking, and diffing
   across audit runs.

## 9. Testing Strategy

- Unit tests for each `collect*Findings` function with fixture configs
- Unit tests for `scanSource` with crafted malicious snippets
- Integration test running full `runSecurityAudit` against a test config
- Snapshot tests for report output format stability
