# Wave 2 Analysis: Input Validation Framework

**Date**: 2026-02-09
**Scope**: Wundr input validation, command injection prevention, safe execution
**Reference**: OpenClaw `exec-approvals.ts` (1,542 lines), Wundr `batch.ts`, `plugin-manager.ts`, `websocket-server.ts`

---

## Executive Summary

Wundr has **9 confirmed `shell: true` call sites** across the CLI, MCP server, and installer packages. The most critical is `batch.ts`, which executes arbitrary YAML-defined commands through a shell interpreter without any sanitization. Combined with the absence of WebSocket message validation, plugin sandboxing, and path traversal checks, this represents a systemic input validation gap.

This document specifies a unified validation framework implemented via Zod schemas and a safe command execution layer, modeled after OpenClaw's battle-tested `exec-approvals.ts` approach.

---

## 1. Threat Model

### 1.1 Command Injection (CRITICAL)

**Affected files (9 sites):**

| File | Line | Risk | Vector |
|------|------|------|--------|
| `cli/src/commands/batch.ts` | 669 | CRITICAL | YAML-defined commands run through `shell: true` with user-supplied variables interpolated via `{{var}}` |
| `cli/src/plugins/plugin-manager.ts` | 735 | HIGH | Plugin install/test commands run with `shell: true` |
| `cli/src/commands/watch.ts` | 599 | HIGH | File watcher commands with `{{file}}` placeholder injection |
| `cli/src/commands/test.ts` | 216 | MEDIUM | Test runner commands with shell |
| `cli/src/interactive/interactive-mode.ts` | 86 | LOW | Hardcoded `wundr` binary, but still uses shell |
| `cli/src/commands/claude-setup.ts` | 449 | MEDIUM | Runs installer scripts via bash with shell |
| `mcp-server/src/tools/cli-commands.ts` | 101 | HIGH | MCP tool runs arbitrary CLI commands with shell |
| `computer-setup/src/installers/node-tools-installer.ts` | 157 | HIGH | Pipes curl output to bash |
| `computer-setup/src/installers/node-tools-installer.ts` | 410 | HIGH | Shell execution for tool install |

**Attack scenario (batch.ts):**

A malicious YAML batch file can embed shell metacharacters in commands. Since the command string is passed directly to `spawn()` with `shell: true`, the shell interprets these metacharacters, allowing arbitrary command execution.

The `{{var}}` template system in `processJobVariables` is equally dangerous -- variables are injected into the command string via regex replacement, then the entire string is passed to `spawn()` with `shell: true`. A semicolon in a variable value breaks out of the intended command boundary.

### 1.2 WebSocket Message Injection (HIGH)

**File:** `orchestrator-daemon/src/core/websocket-server.ts`

The WebSocket server at line 120 does `JSON.parse(data.toString()) as WSMessage` -- a type assertion with **zero runtime validation**. The `WSMessage` type union is only a TypeScript compile-time check. At runtime, the message object passes through unchecked. A connected client can send arbitrary payloads with unexpected types, oversized strings, or injection payloads in task descriptions.

### 1.3 Path Traversal (MEDIUM)

**Affected locations:**

- `batch.ts` line 240: `listBatchJobs` uses `options.path` directly as a directory path
- `plugin-manager.ts` line 88: `getPluginPath(pluginName)` -- if `pluginName` contains `../`, it escapes the plugins directory
- `batch.ts` line 807: `createJobFromTemplate` uses `template` in a path join without validation

### 1.4 Plugin Arbitrary Code Execution (HIGH)

**File:** `plugin-manager.ts` line 93

Dynamic `import()` of user-supplied plugin paths with no integrity check, no sandboxing, and no capability restriction. A malicious plugin has full Node.js access.

### 1.5 Variable Injection via Template Processing (MEDIUM)

**File:** `batch.ts` line 592

Variable values are interpolated directly into JSON-stringified job definitions. A value containing a double quote can break out of the JSON structure, altering the job definition itself.

---

## 2. Design: Validation Framework

### 2.1 Architecture

```
validation.ts
  |
  +-- Zod Schemas (compile-time + runtime)
  |     +-- WSMessageSchema (WebSocket messages)
  |     +-- BatchJobSchema (YAML batch jobs)
  |     +-- PluginMetadataSchema (plugin manifests)
  |     +-- APIRequestSchemas (HTTP endpoints)
  |
  +-- SafeCommandBuilder (shell-free execution)
  |     +-- buildCommand() -> { file, args } (no shell)
  |     +-- CommandAllowlist (binary allowlist)
  |     +-- validateCommandTokens() (injection detection)
  |
  +-- PathValidator (traversal prevention)
  |     +-- safePath() -> resolved canonical path
  |     +-- isWithinBoundary() -> boolean
  |
  +-- InputSanitizer (XSS/injection)
  |     +-- sanitizeForHTML() -> escaped string
  |     +-- sanitizeForSQL() -> parameterized query
  |     +-- stripControlChars() -> clean string
  |
  +-- PluginSandbox (capability restriction)
        +-- validateManifest() -> PluginCapabilities
        +-- restrictImports() -> proxy module
```

### 2.2 Key Design Decisions

1. **No `shell: true` anywhere.** All command execution uses `spawn(file, args)` in array form. OpenClaw's `analyzeShellCommand()` shows the complexity of safe shell parsing (700+ lines). We avoid it entirely.

2. **Allowlist over blocklist.** Following OpenClaw's pattern, we maintain a set of approved binaries. Unknown binaries require explicit approval.

3. **Zod at every boundary.** Every external input -- WebSocket messages, YAML files, CLI arguments, plugin manifests -- is validated through Zod schemas before processing.

4. **Defense in depth.** Even if schema validation passes, command execution applies additional token-level checks (no shell metacharacters in arguments).

---

## 3. Implementation Specification

### 3.1 WebSocket Message Validation Schemas

Replace the type-assertion-only `as WSMessage` with runtime Zod parsing:

```typescript
const SpawnSessionPayloadSchema = z.object({
  orchestratorId: z.string().uuid(),
  task: z.object({
    type: z.enum(['code', 'research', 'analysis', 'custom', 'general']),
    description: z.string().min(1).max(10000),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    status: z.enum([...]).default('pending'),
  }),
  sessionType: z.enum(['claude-code', 'claude-flow']),
  memoryProfile: z.string().optional(),
});
```

### 3.2 Safe Command Builder

The `SafeCommandBuilder` replaces all `shell: true` patterns:

```typescript
// BEFORE (vulnerable):
spawn(command, finalArgs, { shell: true });

// AFTER (safe):
const safe = SafeCommandBuilder.build(cmd.command, cmd.args);
spawn(safe.file, safe.args, { stdio: ['ignore', 'pipe', 'pipe'] });
// Note: no shell: true
```

The builder:
1. Parses the command string into a binary and argument array
2. Resolves the binary to an absolute path via `PATH` lookup
3. Checks the binary against an allowlist
4. Validates each argument for shell metacharacters
5. Returns a `{ file, args }` tuple ready for `spawn()`

### 3.3 Path Traversal Prevention

All path operations resolve the path to a canonical absolute form and then verify it falls within an expected boundary directory. The `safePath()` utility rejects any path that resolves outside the boundary after symlink resolution.

### 3.4 Batch Job Variable Sanitization

Replace the regex-based `{{var}}` interpolation with a safe template engine that:
1. Validates variable names against `^[a-zA-Z_][a-zA-Z0-9_]*$`
2. Escapes variable values for the target context (shell argument vs. string literal)
3. Never interpolates variables directly into command strings -- instead passes them as separate arguments or environment variables

### 3.5 Plugin Input Sanitization

Plugins must declare a manifest with:
- Required capabilities (filesystem, network, command execution)
- Allowed binary list (for command execution capability)
- Allowed path prefixes (for filesystem capability)

The plugin loader validates this manifest before `import()` and wraps the plugin context to enforce declared capabilities.

---

## 4. Migration Plan

### Phase 1: Critical Fixes (Immediate)

1. Fix `batch.ts` `executeCommand()` -- remove `shell: true`, use argument array
2. Fix `watch.ts` `{{file}}` injection -- pass as separate argument
3. Add Zod validation to WebSocket `handleMessage()`

### Phase 2: Framework Rollout (Week 1)

4. Implement `validation.ts` with all schemas and builders
5. Migrate `plugin-manager.ts` `runCommand()` to `SafeCommandBuilder`
6. Migrate `test.ts` `runCommand()` to `SafeCommandBuilder`
7. Migrate `interactive-mode.ts` to use direct `spawn` without shell
8. Migrate `mcp-server/cli-commands.ts` to `SafeCommandBuilder`

### Phase 3: Hardening (Week 2)

9. Implement plugin manifest validation and capability restriction
10. Add path traversal prevention to all file operations
11. Add input sanitization to all user-facing output (XSS prevention)
12. Add audit logging for all command executions

---

## 5. OpenClaw Patterns Applied

| OpenClaw Pattern | Wundr Application |
|---|---|
| `analyzeShellCommand()` with quote-aware tokenizer | `SafeCommandBuilder.tokenize()` for parsing existing commands |
| `matchAllowlist()` with glob patterns | `CommandAllowlist.isAllowed()` for binary validation |
| `isSafeBinUsage()` checks for path-like args | `validateCommandArgs()` detects suspicious arguments |
| `evaluateExecAllowlist()` per-segment chain analysis | Not needed -- we eliminate `shell: true` entirely |
| `resolveCommandResolution()` with PATH lookup | `SafeCommandBuilder.resolveBinary()` for absolute path resolution |
| `DEFAULT_SAFE_BINS` curated set | `DEFAULT_ALLOWED_BINARIES` for Wundr's command set |
| `splitCommandChain()` for `&&`/`||`/`;` | Rejected at validation time -- these are shell metacharacters |

---

## 6. Test Plan

1. **Command injection tests**: Verify that shell metacharacters in batch variables, file paths, and plugin names are rejected
2. **WebSocket fuzzing**: Send malformed/oversized/type-confused messages and verify clean rejection
3. **Path traversal tests**: Attempt `../` escape from batch directory, plugins directory, and template directory
4. **Allowlist tests**: Verify unknown binaries are rejected; verify known binaries pass
5. **Integration tests**: Run a valid batch job end-to-end without `shell: true` and verify identical behavior
