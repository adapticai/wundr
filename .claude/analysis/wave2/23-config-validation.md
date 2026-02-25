# Wave 2 Analysis: Comprehensive Configuration Validation System

## Status: Implementation

## Overview

A production-grade configuration validation system for the Wundr orchestrator daemon with live
reload support. This system draws heavily from OpenClaw's battle-tested config architecture
(`src/config/`) while adapting it for Wundr's orchestrator-centric domain.

## Problem Statement

The current orchestrator-daemon config system (`src/config/index.ts`) is a basic env-var-only loader
with a flat Zod schema. It lacks:

1. **File-based configuration** -- no JSON/JSON5 config file support
2. **Live reload** -- daemon must restart for any config change
3. **Config composition** -- no `$include` or multi-file merging
4. **Secret redaction** -- no safe UI editing workflow
5. **Runtime overrides** -- no way to override config at runtime without env vars
6. **Migration support** -- no versioned config upgrades
7. **Comprehensive validation** -- missing schemas for agents, channels, plugins, hooks, security
8. **Default generation** -- no `wundr config init` workflow

## Architecture

### Components

```
src/config/
  schemas.ts          -- Zod schemas for ALL config domains
  config-loader.ts    -- File + env loading, validation, caching, snapshot
  config-watcher.ts   -- chokidar file watcher + debounced hot reload
  config-merger.ts    -- Deep merge, $include resolution, env var substitution
  config-redactor.ts  -- Secret masking for UI round-trips
  index.ts            -- Public API re-exports (updated)
```

### Data Flow

```
                   config.json5
                       |
              $include resolution
                       |
                env var substitution
                       |
                deep merge (overrides)
                       |
              Zod schema validation
                       |
             apply defaults pipeline
                       |
         runtime overrides (in-memory)
                       |
               Validated Config (frozen)
                       |
          +-----------+-----------+
          |                       |
   config-watcher.ts       config-redactor.ts
   (file change -> diff    (UI read/write with
    -> reload plan)         sentinel replacement)
```

## Design Decisions

### 1. Dual-Source Configuration (File + Env)

Like OpenClaw, the system supports both JSON5 file config AND environment variables. Env vars always
win (highest precedence), matching the existing behavior. The precedence order is:

1. Runtime overrides (in-memory, via API or CLI)
2. Environment variables
3. Config file values
4. Schema defaults

### 2. Config File Format: JSON5

JSON5 is used (like OpenClaw) because it supports comments, trailing commas, and unquoted keys. This
makes the config file human-friendly. The file is located at:

- `$WUNDR_CONFIG_PATH` (env var override)
- `~/.wundr/config.json5` (default)
- `./wundr.config.json5` (workspace-local)

### 3. Reload Strategy: Hybrid (from OpenClaw)

OpenClaw's `config-reload.ts` implements a sophisticated hybrid reload strategy:

- **"off"**: No auto-reload
- **"hot"**: Apply changes that don't require restart (hooks, channels, etc.)
- **"restart"**: Always restart on any change
- **"hybrid"** (default): Hot-reload what is safe, restart for structural changes

The daemon classifies each config path change into a reload action:

| Config Path Prefix           | Action                           |
| ---------------------------- | -------------------------------- |
| `daemon.port`, `daemon.host` | Restart                          |
| `security.jwtSecret`         | Restart                          |
| `hooks.*`                    | Hot reload (re-register hooks)   |
| `agents.*`                   | Hot reload (re-index agents)     |
| `memory.*`                   | Hot reload                       |
| `channels.*`                 | Hot reload (per-channel restart) |
| `plugins.*`                  | Restart                          |
| `monitoring.*`               | No-op (read at use site)         |
| `logging.*`                  | No-op                            |

### 4. Redaction: Sentinel-Based (from OpenClaw)

OpenClaw's `redact-snapshot.ts` uses a `__OPENCLAW_REDACTED__` sentinel value to mask secrets in UI
responses. On write-back, the sentinel is detected and the original value is restored from disk.
This prevents credential corruption during round-trips.

Wundr uses `__WUNDR_REDACTED__` as its sentinel. Sensitive keys are detected by regex patterns:
`/token/i`, `/password/i`, `/secret/i`, `/api.?key/i`.

### 5. Config Includes (from OpenClaw)

OpenClaw's `includes.ts` implements `$include` directives for composable configs:

```json5
{
  $include: './base-config.json5',
  daemon: { port: 9000 },
}
```

Features:

- Single file or array of files
- Circular include detection
- Max depth limit (10)
- Relative path resolution from parent file

### 6. Env Var Substitution (from OpenClaw)

Config values can reference env vars: `${OPENAI_API_KEY}`. Only uppercase env var names are matched.
Escape with `$${}` for literal output. Missing vars throw `MissingEnvVarError`.

### 7. Config Migration System

Versioned config with automatic migration:

```json5
{
  "$version": 2,
  "daemon": { ... }
}
```

Each migration is a pure function `(config: unknown) => unknown` with a description. The loader runs
migrations in sequence from the file version to the current version.

## Schema Design

### Domain Coverage

The Zod schemas cover every configuration domain:

1. **Daemon** -- port, host, name, sessions, verbose, shutdown
2. **Agent** -- per-type configs with identity, model, tools, memory, heartbeat
3. **Memory** -- backend selection, compaction, context limits, embedding config
4. **Security** -- JWT, CORS, rate limiting, audit logging, mTLS
5. **Channel** -- per-channel configs (Slack, Discord, Telegram, etc.)
6. **Model/Provider** -- multi-provider routing with fallbacks, pricing
7. **Plugin** -- enabled/disabled, per-plugin config payloads, load paths
8. **Hook** -- event registrations, matchers, timeouts, types
9. **Monitoring** -- metrics, health checks, tracing
10. **Logging** -- level, format, rotation, structured output
11. **Distributed** -- clustering, load balancing, session migration
12. **Token Budget** -- daily/weekly/monthly limits with alerts

### Validation Features

- Cross-field validation (e.g., weekly budget >= daily budget)
- URL format validation for endpoints
- Port range validation (1024-65535)
- JWT secret minimum length (32 chars)
- Enum validation for strategy/mode fields
- Optional sections that are fully validated when present

## API Surface

### Config Loader

```typescript
// Load + validate (cached singleton)
getConfig(): WundrConfig

// Load fresh (no cache)
loadConfig(opts?: ConfigLoadOptions): WundrConfig

// Read raw snapshot with metadata
readConfigSnapshot(): Promise<ConfigSnapshot>

// Write validated config to disk
writeConfig(config: WundrConfig): Promise<void>

// Reset singleton cache
resetConfig(): void

// Generate default config file
generateDefaultConfig(): WundrConfig
```

### Config Watcher

```typescript
// Start watching for config changes
startConfigWatcher(opts: ConfigWatcherOptions): ConfigWatcher

interface ConfigWatcher {
  stop(): Promise<void>
}

interface ConfigWatcherOptions {
  initialConfig: WundrConfig
  readSnapshot: () => Promise<ConfigSnapshot>
  onHotReload: (plan: ReloadPlan, next: WundrConfig) => Promise<void>
  onRestart: (plan: ReloadPlan, next: WundrConfig) => void
  watchPath: string
  log: Logger
}
```

### Config Redactor

```typescript
// Redact sensitive values for UI display
redactConfig<T>(value: T): T

// Redact a full snapshot (config + raw text)
redactSnapshot(snapshot: ConfigSnapshot): ConfigSnapshot

// Restore redacted sentinel values from original
restoreRedactedValues(incoming: unknown, original: unknown): unknown
```

### Config Merger

```typescript
// Deep merge with $include resolution
resolveConfigIncludes(obj: unknown, configPath: string): unknown

// Substitute ${VAR} references
resolveEnvVars(obj: unknown, env?: NodeJS.ProcessEnv): unknown

// Deep merge two configs
deepMerge(target: unknown, source: unknown): unknown

// Apply runtime overrides
applyOverrides(config: WundrConfig, overrides: Record<string, unknown>): WundrConfig
```

## Reload Plan System

The reload plan (from OpenClaw's `buildGatewayReloadPlan`) classifies each changed config path into
an action:

```typescript
interface ReloadPlan {
  changedPaths: string[];
  restartDaemon: boolean;
  restartReasons: string[];
  hotReasons: string[];
  noopPaths: string[];
  reloadHooks: boolean;
  reloadAgents: boolean;
  reloadChannels: Set<string>;
  reloadMemory: boolean;
  reloadSecurity: boolean;
}
```

## File Locations

| File                            | Purpose                                 |
| ------------------------------- | --------------------------------------- |
| `src/config/schemas.ts`         | All Zod schemas and types               |
| `src/config/config-loader.ts`   | File + env loading, validation, caching |
| `src/config/config-watcher.ts`  | chokidar watcher, debounce, reload plan |
| `src/config/config-merger.ts`   | Deep merge, $include, env substitution  |
| `src/config/config-redactor.ts` | Secret masking and restoration          |
| `src/config/index.ts`           | Public API re-exports                   |

## Testing Strategy

- Unit tests for each schema with valid/invalid inputs
- Unit tests for deep merge with edge cases
- Unit tests for env var substitution (including escapes)
- Unit tests for redaction round-trips
- Unit tests for include resolution (including circular detection)
- Unit tests for reload plan classification
- Integration test for full load -> watch -> reload cycle

## Migration Path

1. The existing `src/config/index.ts` continues to work (backward compatible)
2. New schemas extend the existing `ConfigSchema` with comprehensive coverage
3. File-based config is opt-in (env vars still work as before)
4. Live reload is opt-in via `daemon.reload.mode` setting

## Dependencies

- `zod` (already in use)
- `json5` (new -- for JSON5 config file parsing)
- `chokidar` (new -- for file watching)
- `node:crypto` (built-in -- for hash comparison)
- `node:fs` (built-in)
- `node:path` (built-in)

## References

- OpenClaw `src/config/io.ts` -- Config I/O with backup rotation and snapshot
- OpenClaw `src/config/includes.ts` -- $include directive resolution
- OpenClaw `src/config/redact-snapshot.ts` -- Sentinel-based secret redaction
- OpenClaw `src/config/runtime-overrides.ts` -- In-memory override layer
- OpenClaw `src/config/env-substitution.ts` -- ${VAR} substitution
- OpenClaw `src/config/merge-config.ts` -- Section-level merging
- OpenClaw `src/gateway/config-reload.ts` -- Hybrid hot reload with chokidar
- OpenClaw `src/config/legacy-migrate.ts` -- Legacy config migration
- OpenClaw `src/config/schema.ts` -- UI hints and JSON schema generation
