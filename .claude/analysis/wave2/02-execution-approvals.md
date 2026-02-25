# Execution Approval System - Design Document

## 1. Overview

This document describes the execution approval system ported from OpenClaw and adapted to Wundr's
orchestrator-daemon architecture. The system controls which commands and tools an AI agent session
is permitted to execute, preventing destructive or unauthorized operations.

### Origin

OpenClaw's `exec-approvals.ts` (1,542 lines) implements a complete execution gating layer with shell
command parsing, allowlist matching, safe-binary detection, glob-based path patterns, and a
Unix-domain-socket approval workflow. Wundr's port retains the core security model while adapting to
Wundr's MCP tool registry, charter safety heuristics, and session-scoped execution context.

## 2. Problem Statement

Wundr's current tool registry (`McpToolRegistryImpl`) has minimal safety checks:

- A hardcoded list of dangerous command substrings (`rm -rf /`, fork bombs, etc.)
- Simple path-traversal detection for file operations
- No allowlist/denylist system
- No shell command parsing or binary resolution
- No per-agent or per-session policies
- No interactive approval workflow

These checks are insufficient for a production orchestrator that runs arbitrary agent sessions with
access to bash execution, file writes, and network operations.

## 3. Architecture

```
                                +-----------------------+
                                |   Charter Safety      |
                                |   Heuristics          |
                                |  (autoApprove,        |
                                |   alwaysReject,       |
                                |   escalate)           |
                                +-----------+-----------+
                                            |
                                            v
+----------------+     +-------------------+-------------------+
|  Session       |---->| ExecApprovalGate                      |
|  Executor      |     |                                       |
|  / Tool        |     |  1. Analyze command (parse shell)     |
|  Executor      |     |  2. Resolve executable paths          |
|                |     |  3. Check denylist                    |
|                |     |  4. Check allowlist + safe bins        |
|                |     |  5. Apply policy (auto/prompt/deny)   |
|                |     |  6. Record decision                   |
+----------------+     +-------------------+-------------------+
                                            |
                              +-------------+-------------+
                              |             |             |
                              v             v             v
                         ALLOW          PROMPT         DENY
                       (execute)    (await user     (reject with
                                    decision via     reason)
                                    IPC/socket)
```

### Key Components

| Component              | Responsibility                                                         |
| ---------------------- | ---------------------------------------------------------------------- |
| `ExecApprovalGate`     | Top-level orchestrator; composes analysis, policy lookup, and decision |
| `ShellCommandAnalyzer` | Parses shell strings into segments, handling pipes, chains, quoting    |
| `ExecutableResolver`   | Resolves binary names to absolute paths via PATH lookup                |
| `AllowlistMatcher`     | Glob-pattern matching against resolved binary paths                    |
| `SafeBinDetector`      | Identifies read-only binaries that are safe without approval           |
| `ToolPolicyEngine`     | Per-tool execution policies integrated with charter heuristics         |
| `ApprovalStore`        | Persists allowlist entries, usage timestamps, and session decisions    |

## 4. Concepts Ported from OpenClaw

### 4.1 Security Modes (`ExecSecurity`)

| Mode        | Behavior                                                                 |
| ----------- | ------------------------------------------------------------------------ |
| `deny`      | Block all tool/command execution (safest default)                        |
| `allowlist` | Permit only commands whose binaries match allowlist entries or safe bins |
| `full`      | Permit all commands (development/testing only)                           |

### 4.2 Ask Modes (`ExecAsk`)

| Mode      | Behavior                                                  |
| --------- | --------------------------------------------------------- |
| `off`     | Never prompt the user; apply security policy silently     |
| `on-miss` | Prompt only when a command does not satisfy the allowlist |
| `always`  | Prompt for every command regardless of allowlist status   |

### 4.3 Shell Command Analysis

The analyzer handles:

- **Pipelines**: `cmd1 | cmd2 | cmd3` -- each segment validated independently
- **Chains**: `cmd1 && cmd2 || cmd3; cmd4` -- split by chain operators, each part analyzed as a
  pipeline
- **Quoting**: Single quotes, double quotes, escape sequences respected during splitting
- **Rejection of dangerous tokens**: Redirections (`>`, `<`), subshells (`$()`), backticks, process
  substitution

### 4.4 Safe Binary Detection

A configurable set of read-only binaries (e.g. `jq`, `grep`, `head`, `sort`, `wc`) that are
auto-approved when:

1. The binary name matches the safe-bins set
2. The binary resolves to an actual executable on PATH
3. No arguments reference file paths (prevents `grep` from being used to read secrets)

### 4.5 Allowlist Pattern Matching

- Patterns support glob syntax (`*`, `**`, `?`)
- Patterns with path separators match against the resolved absolute path
- Case-insensitive matching with home-directory expansion

### 4.6 Approval Recording

Every allowlist match records:

- `lastUsedAt` timestamp
- `lastUsedCommand` for audit trail
- `lastResolvedPath` for debugging

## 5. Wundr-Specific Adaptations

### 5.1 Integration with Charter Safety Heuristics

The `CharterSafetyHeuristics` type already defines:

```typescript
interface CharterSafetyHeuristics {
  autoApprove: string[]; // patterns for auto-approval
  requireConfirmation: string[]; // patterns requiring user prompt
  alwaysReject: string[]; // patterns always denied
  escalate: string[]; // patterns escalated to higher tier
}
```

The `ToolPolicyEngine` maps these patterns to tool-level and command-level policies:

- `autoApprove` entries feed into the allowlist for the session's agent
- `alwaysReject` entries populate the denylist
- `requireConfirmation` forces `ask: "always"` for matching tools
- `escalate` entries trigger inter-orchestrator escalation (future work)

### 5.2 Tool-Level Policies

Beyond shell commands, Wundr executes MCP tools (`file_read`, `file_write`, `file_delete`,
`bash_execute`, `web_fetch`, `file_list`). Each tool gets an execution policy:

| Tool           | Default Policy           | Rationale                           |
| -------------- | ------------------------ | ----------------------------------- |
| `file_read`    | `allowlist` (path-based) | Read-only but may expose secrets    |
| `file_write`   | `prompt`                 | Modifies filesystem                 |
| `file_delete`  | `prompt`                 | Destructive operation               |
| `bash_execute` | `allowlist`              | Full shell command analysis applies |
| `web_fetch`    | `allow`                  | Read-only network call              |
| `file_list`    | `allow`                  | Read-only directory listing         |

### 5.3 Session-Scoped Approvals

Unlike OpenClaw's global file-based storage, Wundr tracks approvals per session:

- Each `Session` gets an `ExecApprovalState` in its context
- "Allow always" decisions persist for the session lifetime
- Cross-session allowlists can be configured at the charter level

### 5.4 No Unix Socket Workflow (Phase 1)

OpenClaw uses a Unix domain socket for interactive approval prompts between the CLI frontend and the
backend. Wundr's daemon communicates via WebSocket, so approval requests will be sent as
`WSResponse` messages:

```typescript
| { type: 'approval_required'; sessionId: string; request: ApprovalRequest }
| { type: 'approval_response'; sessionId: string; decision: ExecApprovalDecision }
```

## 6. Data Structures

### 6.1 Core Types

```typescript
type ExecSecurity = 'deny' | 'allowlist' | 'full';
type ExecAsk = 'off' | 'on-miss' | 'always';
type ExecApprovalDecision = 'allow-once' | 'allow-always' | 'deny';

interface ExecPolicy {
  security: ExecSecurity;
  ask: ExecAsk;
  askFallback: ExecSecurity;
}

interface AllowlistEntry {
  id: string;
  pattern: string;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
}

interface ToolPolicy {
  toolName: string;
  security: ExecSecurity;
  ask: ExecAsk;
  pathRestrictions?: string[]; // glob patterns for allowed paths
  argRestrictions?: string[]; // denied argument patterns
}
```

### 6.2 Command Analysis Types

```typescript
interface CommandResolution {
  rawExecutable: string;
  resolvedPath?: string;
  executableName: string;
}

interface CommandSegment {
  raw: string;
  argv: string[];
  resolution: CommandResolution | null;
}

interface CommandAnalysis {
  ok: boolean;
  reason?: string;
  segments: CommandSegment[];
  chains?: CommandSegment[][];
}
```

### 6.3 Session Approval State

```typescript
interface ExecApprovalState {
  policy: ExecPolicy;
  allowlist: AllowlistEntry[];
  toolPolicies: Map<string, ToolPolicy>;
  safeBins: Set<string>;
  decisions: Map<string, ExecApprovalDecision>; // keyed by command hash
}
```

## 7. Integration Points

### 7.1 ToolExecutor Integration

The `ToolExecutor.executeToolCall()` method is wrapped with approval gating:

```
executeToolCall(toolCall)
  -> ExecApprovalGate.evaluate(toolCall)
    -> if bash_execute: analyze shell command, check allowlist
    -> if file_write/delete: check path policy
    -> if other tool: check tool policy
  -> decision: allow | prompt | deny
  -> if allow: proceed with execution
  -> if prompt: emit approval_required, await response
  -> if deny: return rejection result
```

### 7.2 McpToolRegistry Integration

The `McpToolRegistryImpl.executeTool()` method gains an optional `approvalGate` parameter. When set,
every tool execution passes through the gate before reaching the tool's `execute()` function.

### 7.3 SessionExecutor Integration

The `SessionExecutor` manages the approval state lifecycle:

- Creates `ExecApprovalState` when starting a session
- Passes it to the `ToolExecutor` for each tool call
- Handles `approval_required` events from the gate
- Updates state with `allow-always` decisions

## 8. Security Properties

1. **Deny by default**: Unknown commands and tools are denied unless explicitly allowed
2. **Full command parsing**: Shell metacharacters, pipes, chains are analyzed; dangerous tokens are
   rejected before execution
3. **Binary verification**: Allowlist entries match against resolved absolute paths, not just
   command names, preventing PATH manipulation attacks
4. **Safe-bin argument scanning**: Even safe binaries are rejected if arguments reference file
   paths, preventing data exfiltration via `grep /etc/shadow`
5. **Audit trail**: All allowlist matches and approval decisions are recorded with timestamps
6. **Session isolation**: Approval state does not leak between sessions unless configured at the
   charter level

## 9. File Layout

```
packages/@wundr/orchestrator-daemon/src/security/
  exec-approvals.ts      -- Main implementation (this document's subject)
  __tests__/
    exec-approvals.test.ts -- Unit tests (future)
```

## 10. Migration Path

### Phase 1 (This Implementation)

- Core types and shell command analysis
- Allowlist matching and safe-bin detection
- Tool-level policies
- Integration with ToolExecutor
- In-memory session-scoped approval state

### Phase 2

- WebSocket-based interactive approval prompts
- Persistent allowlist storage (file-backed or DB-backed)
- Charter-level cross-session allowlists
- Metrics and audit log integration

### Phase 3

- Escalation to higher-tier orchestrators
- Dynamic policy updates via federation
- ML-based command risk scoring
