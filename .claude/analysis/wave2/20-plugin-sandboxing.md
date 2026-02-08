# Plugin Sandboxing System - Design Document

## Origin

Informed by OpenClaw's multi-layered sandbox architecture (`src/agents/sandbox/`,
`src/security/skill-scanner.ts`, `src/config/types.sandbox.ts`) and Wundr's existing
plugin system (`packages/@wundr/cli/src/plugins/plugin-manager.ts`).

## Problem

Wundr's current plugin system has **zero security boundaries**. When a plugin is
loaded via `PluginManager.loadPlugin()`, it:

1. Runs `require()` on arbitrary code with full Node.js privileges.
2. Receives the entire `ConfigManager` (which may contain API keys, tokens).
3. Can register commands and hooks that execute with the same permissions as the CLI.
4. Can spawn child processes, access the filesystem, make network requests, and read
   all environment variables without restriction.
5. Has no manifest validation -- any directory with a `package.json` is loadable.
6. Performs no static analysis before loading -- malicious patterns like `eval()`,
   crypto-mining, and data exfiltration are not detected.

This means a single malicious or compromised plugin can:
- Steal credentials from `process.env` or config files.
- Exfiltrate source code or proprietary data.
- Install backdoors or cryptocurrency miners.
- Modify other plugins or system files.
- Compromise MCP tool access.

## Architecture

### Security Layers (Defense in Depth)

```
Layer 1: Manifest Validation      - Zod schema enforcement, permission declaration
Layer 2: Static Code Analysis     - Pattern detection before code is loaded
Layer 3: Runtime Sandboxing       - VM isolation, worker threads, or Docker containers
Layer 4: Permission System        - Granular capability-based access control
Layer 5: Lifecycle Management     - Controlled load/enable/disable/unload transitions
```

Every layer must pass before a plugin executes. A failure at any layer blocks the plugin.

### Plugin Trust Levels

```
trusted      - First-party @wundr/ plugins. Run in-process, full access.
verified     - Third-party plugins with signature verification. Run in VM sandbox.
community    - Unverified community plugins. Run in worker thread sandbox.
untrusted    - Unknown origin. Run in Docker container sandbox.
```

### Manifest Schema

Every plugin must include a `wundr-plugin.json` manifest declaring:

```json
{
  "name": "@example/my-plugin",
  "version": "1.2.0",
  "wundrVersion": ">=1.0.0",
  "trustLevel": "community",
  "permissions": {
    "filesystem": {
      "read": [".wundr/plugins/@example/my-plugin/**"],
      "write": [".wundr/plugins/@example/my-plugin/data/**"]
    },
    "network": {
      "hosts": ["api.example.com"],
      "ports": [443]
    },
    "process": {
      "allowed": ["git", "npm"]
    },
    "env": {
      "read": ["MY_PLUGIN_API_KEY"],
      "write": []
    },
    "mcpTools": {
      "allow": ["file_read", "web_fetch"],
      "deny": ["bash_execute", "file_delete"]
    }
  },
  "entryPoint": "dist/index.js",
  "integrity": "sha384-...",
  "dependencies": {
    "plugins": ["@wundr/plugin-git"],
    "runtime": { "node": ">=18.0.0" }
  }
}
```

### Static Analysis Rules

Extends OpenClaw's `skill-scanner.ts` rule engine with plugin-specific patterns:

| Rule ID                    | Severity | Pattern                                          |
|----------------------------|----------|--------------------------------------------------|
| `dangerous-exec`           | critical | `exec/spawn` with `child_process` context        |
| `dynamic-code-execution`   | critical | `eval()`, `new Function` constructor             |
| `crypto-mining`            | critical | stratum, coinhive, xmrig references              |
| `dynamic-require`          | warn     | `require(variable)` (non-literal)                |
| `global-process-access`    | warn     | `process.exit`, `process.kill`                   |
| `native-addon`             | critical | `.node` bindings, `node-gyp`                     |
| `env-harvesting`           | critical | `process.env` + network send in same file        |
| `potential-exfiltration`   | warn     | `readFile` + `fetch/http.request` in same file   |
| `obfuscated-code`          | warn     | hex-encoded sequences, large base64 payloads     |
| `suspicious-network`       | warn     | WebSocket to non-standard port                   |
| `prototype-pollution`      | warn     | `__proto__`, `constructor.prototype` assignments  |
| `fs-outside-sandbox`       | critical | Absolute paths outside declared permissions      |
| `undeclared-network`       | warn     | Network calls to hosts not in manifest           |

### Runtime Sandbox Tiers

#### Tier 1: VM Context (verified plugins)

Uses Node.js `vm.createContext()` with restricted globals:

```
Allowed globals:  console, setTimeout, setInterval, clearTimeout,
                  clearInterval, Promise, URL, TextEncoder, TextDecoder,
                  structuredClone, crypto (subset)
Blocked globals:  process, require, __dirname, __filename, global,
                  globalThis (replaced), Buffer (proxied)
```

The VM context receives a sandboxed API object instead of raw Node.js APIs.

#### Tier 2: Worker Thread (community plugins)

Runs in a separate `worker_threads.Worker` with:
- `execArgv: ['--no-addons']` to block native modules.
- Communication only through `MessagePort` (structured-clone boundary).
- Resource limits via `resourceLimits` (max memory, max stack size).
- No shared memory (`SharedArrayBuffer` disabled).
- File system access mediated through the main thread.

#### Tier 3: Docker Container (untrusted plugins)

Based on OpenClaw's container sandbox pattern:
- Read-only root filesystem.
- Network mode `none` by default (explicit allowlist via manifest).
- All Linux capabilities dropped.
- `no-new-privileges` security option.
- PID limit, memory limit, CPU limit.
- Seccomp and AppArmor profiles.
- Communication via Unix socket or TCP to host.

### Permission Enforcement

Permissions are checked at three points:

1. **Load time** -- Manifest permissions are validated against system policy.
   Plugins cannot request permissions beyond what the system administrator allows.

2. **Call time** -- Every API call from a plugin passes through a permission
   proxy that checks the declared permissions against the actual operation.

3. **Audit time** -- All permission-gated operations are logged with plugin ID,
   operation, target, and allow/deny decision for post-incident analysis.

### Lifecycle State Machine

```
                    manifest_valid
  [uninstalled] ────────────────────> [installed]
                                         │
                   scan_passed           │
                  ┌──────────────────────┤
                  │                      │ scan_failed
                  v                      v
             [validated]            [quarantined]
                  │
           load + sandbox
                  │
                  v
              [loaded] <────────────── [disabled]
                  │         enable         ^
           activate                        │
                  │                    disable
                  v                        │
              [active] ────────────────────┘
                  │
              unload
                  │
                  v
            [unloaded] ────> [uninstalled]
                     uninstall
```

### Plugin Dependency Resolution

Plugins may declare dependencies on other plugins. The system:

1. Builds a dependency graph from all installed plugin manifests.
2. Detects circular dependencies and rejects them.
3. Determines load order via topological sort.
4. Ensures dependent plugins are loaded and active before dependants.
5. Cascades disable/unload to dependant plugins.

### Plugin Update Mechanism

Updates follow a safe rollback pattern:

1. Download new version to staging directory.
2. Validate manifest schema.
3. Run static analysis scan on new code.
4. Compare permission changes (flag escalations for user approval).
5. Snapshot current version for rollback.
6. Hot-swap: unload old, load new.
7. Run health check (plugin's `healthCheck()` if present).
8. On failure: rollback to snapshot automatically.

## File Structure

```
packages/@wundr/orchestrator-daemon/src/plugins/
  plugin-manifest.ts     - Zod manifest schemas + validation
  plugin-scanner.ts      - Static code analysis engine
  permission-system.ts   - Runtime permission enforcement
  sandbox.ts             - VM / Worker / Docker sandbox runtime
  plugin-lifecycle.ts    - Lifecycle state machine + dependency resolution
```

## Integration Points

- **McpToolRegistry** -- Plugin-registered tools pass through the tool policy
  system (wave2/04-tool-policy.md). Plugins can only register tools within
  their declared `mcpTools.allow` set.

- **Charter System** -- Plugin permissions can be further restricted by charter
  alignment checks at the orchestrator level.

- **Monitoring** -- Plugin sandbox events (load, scan, permission check, violation)
  are emitted as metrics to the monitoring collector.

- **Budget System** -- Plugin resource usage (CPU, memory, network) is tracked
  against per-plugin budgets.

## Security Considerations

1. **No eval in scan rules** -- The scanner itself never evaluates plugin code.
   All pattern matching is regex-based against source text.

2. **Time-of-check vs time-of-use** -- After scan, the plugin directory is made
   read-only (or integrity-checked via hash) before loading.

3. **Sandbox escape** -- VM sandboxes have known escape vectors. The permission
   proxy serves as a second line of defense even if the VM is compromised.

4. **Supply chain** -- Manifest integrity hashes and optional signature
   verification prevent tampering between install and load.

5. **Denial of service** -- Resource limits (memory, CPU, PID, timeout) prevent
   plugins from starving the host process.
