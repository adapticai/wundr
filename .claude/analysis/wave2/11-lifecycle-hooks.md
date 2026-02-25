# Wave 2 Analysis: Lifecycle Hooks System

**Document**: 11-lifecycle-hooks.md **Status**: Implementation Complete **Priority**: P1 -- Core
infrastructure for extensibility **Depends on**: orchestrator-daemon core, session management, tool
execution

---

## 1. Executive Summary

This document describes the design and implementation of Wundr's lifecycle hooks system for the
orchestrator daemon. The system is modeled after Claude Code's (OpenClaw) hooks architecture,
adapted for Wundr's multi-session, multi-agent orchestration model.

The hooks system provides 14 lifecycle events spanning session management, tool execution, subagent
coordination, permission handling, context compaction, and notifications. Hooks can be registered
via configuration files or programmatically and executed via three mechanisms: shell commands, LLM
prompts, or sub-agent invocations.

## 2. Reference Architecture Analysis

### 2.1 OpenClaw Hook System (Source of Truth)

OpenClaw implements hooks at two levels:

**Internal Hooks** (`src/hooks/`):

- Event-driven system with `type:action` event keys (e.g., `command:new`, `session:start`)
- In-memory handler registry (`Map<string, InternalHookHandler[]>`)
- Sequential execution with error catching
- Handlers loaded from directory-based discovery (HOOK.md + handler.ts)
- Supports bundled, managed, workspace, and plugin sources
- Eligibility filtering (OS, binaries, env vars, config paths)

**Plugin Hooks** (`src/plugins/hooks.ts`):

- Typed hook system with explicit hook names (14 hook types)
- Priority-ordered execution
- Two execution strategies: void (parallel) and modifying (sequential with merge)
- Synchronous fast path for hot-path hooks (tool_result_persist)
- Global singleton pattern via `hook-runner-global.ts`

**Key Design Patterns Adopted**:

1. **Dual execution strategy**: Void hooks run in parallel; modifying hooks run sequentially
2. **Priority ordering**: Higher priority runs first
3. **Error isolation**: Errors in one hook do not prevent others from running
4. **Type-safe handler maps**: Each event has a typed metadata and result contract
5. **Registry + Engine separation**: Registration is separate from execution

### 2.2 Existing Wundr Hooks

Wundr already has informal hook touchpoints:

- `.claude/commands/hooks/` -- CLI-level hook commands (pre-edit, post-edit, etc.)
- `.claude/helpers/standard-checkpoint-hooks.sh` -- Shell-based checkpoint hooks
- `templates/consumer-integration/advanced-setup/hooks.config.js` -- Config-driven hooks
- `OrchestratorDaemon` uses EventEmitter for internal events

The new system formalizes and unifies these into a single typed architecture.

## 3. Hook Event Catalog

### 3.1 All 14 Lifecycle Events

| #   | Event                | Phase        | Strategy   | Can Modify? | Description                                            |
| --- | -------------------- | ------------ | ---------- | ----------- | ------------------------------------------------------ |
| 1   | `SessionStart`       | Session      | Parallel   | No          | Fired when a new session begins                        |
| 2   | `UserPromptSubmit`   | Prompt       | Sequential | Yes         | Before user prompt is processed; can rewrite or block  |
| 3   | `PreToolUse`         | Tool         | Sequential | Yes         | Before any tool is executed; can modify input or block |
| 4   | `PermissionRequest`  | Permission   | Sequential | Yes         | When permission is needed; can auto-approve/deny       |
| 5   | `PostToolUse`        | Tool         | Parallel   | No          | After tool execution succeeds                          |
| 6   | `PostToolUseFailure` | Tool         | Parallel   | No          | After tool execution fails                             |
| 7   | `Notification`       | Notification | Parallel   | No          | For user notifications (routable to external systems)  |
| 8   | `SubagentStart`      | Subagent     | Parallel   | No          | When a subagent is spawned                             |
| 9   | `SubagentStop`       | Subagent     | Parallel   | No          | When a subagent completes                              |
| 10  | `Stop`               | Session      | Parallel   | No          | When session is stopping (before cleanup)              |
| 11  | `TeammateIdle`       | Subagent     | Parallel   | No          | When a teammate in Agent Teams finishes                |
| 12  | `TaskCompleted`      | Task         | Parallel   | No          | When a task is marked complete                         |
| 13  | `PreCompact`         | Context      | Sequential | Yes         | Before context compaction; can skip or customize       |
| 14  | `SessionEnd`         | Session      | Parallel   | No          | When session ends (after cleanup)                      |

### 3.2 Modifying vs. Void Hooks

**Modifying hooks** (4 events) run sequentially in priority order. Each handler can return a result
that is merged into the accumulated result:

- `UserPromptSubmit` -> `{ prompt?, block?, blockReason? }`
- `PreToolUse` -> `{ toolInput?, block?, blockReason? }`
- `PermissionRequest` -> `{ decision?, reason? }`
- `PreCompact` -> `{ skipCompaction?, strategy?, preserveMessageIndices? }`

**Void hooks** (10 events) run in parallel (bounded by `maxConcurrency`). They cannot modify
behavior, only observe and react.

## 4. Architecture

### 4.1 Component Diagram

```
+-------------------+     +------------------+     +------------------+
|   HooksConfig     |     | HookRegistry     |     | HookEngine       |
| (config file)     |---->| - register()     |---->| - fire()         |
+-------------------+     | - unregister()   |     | - hasHooks()     |
                          | - getForEvent()  |     | - getHookCount() |
+-------------------+     | - loadFromConfig |     | - dispose()      |
| Programmatic API  |---->| - setEnabled()   |     +--------+---------+
| registry.register |     +------------------+              |
+-------------------+                                       |
                                                            v
+-------------------+     +------------------+     +------------------+
| Built-in Hooks    |     | Command Executor |     | Matcher Filter   |
| - safety          |     | (child_process)  |     | - toolName glob  |
| - logging         |     +------------------+     | - sessionId glob |
| - guardrails      |     | Prompt Executor  |     | - riskLevel      |
+-------------------+     | (LLM client)     |     | - etc.           |
                          +------------------+     +------------------+
                          | Agent Executor   |
                          | (sub-session)    |
                          +------------------+
```

### 4.2 File Layout

```
packages/@wundr/orchestrator-daemon/src/hooks/
  index.ts            -- Barrel exports
  hook-types.ts       -- All type definitions (events, metadata, results, config)
  hook-registry.ts    -- Registration management (add, remove, query, config load)
  hook-engine.ts      -- Execution engine (fire, timeout, dispatch, merge)
  built-in-hooks.ts   -- Shipped hooks (logging, safety, guardrails)
```

## 5. Implementation Details

### 5.1 Hook Registration

Hooks can be registered two ways:

**Config file** (`wundr.config.ts` or `hooks.config.ts`):

```ts
const hooksConfig: HooksConfig = {
  enabled: true,
  defaultTimeoutMs: 15000,
  hooks: [
    {
      id: 'log-all-tools',
      event: 'PostToolUse',
      type: 'command',
      command:
        'echo "{{metadata.toolName}} completed in {{metadata.durationMs}}ms" >> /tmp/tools.log',
    },
    {
      id: 'block-dangerous-writes',
      event: 'PermissionRequest',
      type: 'command',
      matcher: { minRiskLevel: 'high' },
      command: 'echo \'{"decision":"deny","reason":"Blocked by policy"}\'',
    },
  ],
};
```

**Programmatic API**:

```ts
registry.register({
  id: 'my-plugin-hook',
  event: 'PreToolUse',
  type: 'command',
  priority: 100,
  source: 'plugin',
  handler: async metadata => {
    if (metadata.toolName === 'dangerous_tool') {
      return { block: true, blockReason: 'Blocked by plugin policy' };
    }
  },
});
```

### 5.2 Hook Execution Types

**Command hooks**: Spawn a child process. Metadata is passed via:

1. `WUNDR_HOOK_EVENT`, `WUNDR_HOOK_ID`, `WUNDR_HOOK_METADATA` env vars
2. Flattened top-level metadata fields as `WUNDR_HOOK_*` env vars
3. `{{metadata.fieldName}}` template interpolation in the command string

If the command writes JSON to stdout, it is parsed as the hook result.

**Prompt hooks**: Interpolate a template with metadata and send to the LLM. The response is parsed
as the hook result. Useful for AI-powered guardrails.

**Agent hooks**: Spawn a sub-session with a specific agent configuration. The agent's output is the
hook result. Useful for complex multi-step hooks.

### 5.3 Timeout and Error Handling

- Every hook has a timeout (configurable, defaults vary by type)
- Command hooks: 10s, Prompt hooks: 30s, Agent hooks: 60s
- Timeout produces a rejected promise with descriptive error
- `catchErrors` (default: true) catches handler errors and logs them
- Safety hooks (like dangerous tool blocker) set `catchErrors: false`

### 5.4 Matcher Filtering

Hooks can optionally specify a `matcher` to filter when they fire:

```ts
matcher: {
  toolName: 'bash_*',        // Glob pattern on tool name
  sessionId: 'sess_prod_*',  // Glob pattern on session ID
  minRiskLevel: 'high',      // Minimum risk level for permission hooks
  notificationLevel: 'error', // Minimum notification level
}
```

Matchers are evaluated before the hook handler runs. If a matcher does not match, the hook is
skipped (with `skipReason` in the result).

### 5.5 Priority Ordering

- Higher priority numbers run first
- Built-in safety hooks use priority 500-1000
- Default priority is 0
- Built-in logging hooks use priority -100 (run last)
- User hooks should use priority 0-100

### 5.6 Result Merging (Modifying Hooks)

For sequential modifying hooks, results are merged field-by-field:

- Non-undefined fields from later hooks override earlier ones
- This allows hooks to progressively refine the result
- Example: Hook A returns `{ prompt: "modified" }`, Hook B returns `{ block: true }` -> merged
  result: `{ prompt: "modified", block: true }`

## 6. Built-in Hooks

| ID                                       | Event              | Priority | Description                            |
| ---------------------------------------- | ------------------ | -------- | -------------------------------------- |
| `builtin:session-lifecycle-logger-start` | SessionStart       | -100     | Logs session start events              |
| `builtin:session-lifecycle-logger-end`   | SessionEnd         | -100     | Logs session end events with metrics   |
| `builtin:tool-execution-logger-success`  | PostToolUse        | -100     | Logs successful tool calls             |
| `builtin:tool-execution-logger-failure`  | PostToolUseFailure | -100     | Logs failed tool calls                 |
| `builtin:dangerous-tool-blocker`         | PreToolUse         | 1000     | Blocks known-destructive tool patterns |
| `builtin:permission-auto-approver`       | PermissionRequest  | -50      | Auto-approves low-risk read operations |
| `builtin:subagent-tracker-start`         | SubagentStart      | -100     | Tracks subagent spawning               |
| `builtin:subagent-tracker-stop`          | SubagentStop       | -100     | Tracks subagent completion             |
| `builtin:task-completion-logger`         | TaskCompleted      | -100     | Logs task completions with metrics     |
| `builtin:compaction-guardrail`           | PreCompact         | 500      | Prevents premature context compaction  |
| `builtin:notification-router`            | Notification       | -100     | Routes notifications to logger         |
| `builtin:prompt-length-guardrail`        | UserPromptSubmit   | 500      | Blocks excessively long prompts        |

All built-in hooks can be disabled individually or collectively via the `registerBuiltInHooks`
options.

## 7. Integration Points

### 7.1 OrchestratorDaemon

The hook engine should be initialized during daemon startup and integrated into:

```ts
// In OrchestratorDaemon.start()
this.hookRegistry = createHookRegistry({ logger: this.logger });
registerBuiltInHooks(this.hookRegistry, this.logger);
this.hookRegistry.loadFromConfig(config.hooks);
this.hookEngine = createHookEngine({ registry: this.hookRegistry, logger: this.logger });

// Fire session hooks
await this.hookEngine.fire('SessionStart', { sessionId, orchestratorId, startedAt });
```

### 7.2 SessionExecutor

Tool execution hooks should be wired into the session executor's tool call loop:

```ts
// Before tool call
const preResult = await this.hookEngine.fire('PreToolUse', { toolName, toolInput, ... });
if (preResult.mergedResult?.block) {
  return { blocked: true, reason: preResult.mergedResult.blockReason };
}

// Apply modified input
const finalInput = preResult.mergedResult?.toolInput ?? toolInput;

// Execute tool...

// After tool call
await this.hookEngine.fire('PostToolUse', { toolName, toolOutput, durationMs, ... });
```

### 7.3 ToolExecutor

Tool failure hooks:

```ts
try {
  result = await this.executeTool(toolCall);
  await this.hookEngine.fire('PostToolUse', { ... });
} catch (error) {
  await this.hookEngine.fire('PostToolUseFailure', { error: error.message, ... });
}
```

## 8. Comparison with OpenClaw

| Aspect             | OpenClaw                  | Wundr                                   |
| ------------------ | ------------------------- | --------------------------------------- |
| Event system       | `type:action` strings     | Typed enum (14 events)                  |
| Handler loading    | Directory-based (HOOK.md) | Config file + programmatic              |
| Execution types    | JS module handlers        | Command, Prompt, Agent                  |
| Priority           | Number (plugin hooks)     | Number (all hooks)                      |
| Void strategy      | Parallel (Promise.all)    | Parallel (batched by concurrency)       |
| Modifying strategy | Sequential with merge     | Sequential with field-level merge       |
| Error handling     | Catch and log             | Configurable per-hook                   |
| Matchers           | N/A                       | Glob patterns on metadata fields        |
| Metadata passing   | Event object              | Typed per-event metadata + env vars     |
| Built-in hooks     | 4 bundled handlers        | 12 built-in hooks                       |
| Plugin system      | Full plugin API           | Source tagging (built-in/config/plugin) |

## 9. Future Work

1. **LLM Prompt Executor Integration**: Wire up the prompt hook type to the actual LLM client
2. **Agent Hook Executor Integration**: Wire up the agent hook type to SessionManager
3. **Hook Marketplace**: Allow installing hook packs from a registry (like OpenClaw's npm/git hooks)
4. **Hook Hot-Reload**: Watch config files for changes and reload hooks without restart
5. **Hook Metrics Dashboard**: Expose hook execution metrics via the monitoring system
6. **Webhook Routing**: Add webhook-type hooks that POST to external URLs
7. **Hook Chaining**: Allow hooks to pass data to subsequent hooks in the chain
8. **Conditional Hooks**: Add more complex condition expressions (AND/OR/NOT)

## 10. Testing Strategy

1. **Unit tests for HookRegistry**: Register, unregister, query, config loading, priority ordering
2. **Unit tests for HookEngine**: Fire void/modifying events, timeout handling, matcher filtering,
   result merging
3. **Unit tests for built-in hooks**: Each built-in hook's behavior (blocking, logging,
   auto-approval)
4. **Integration tests**: End-to-end hook firing from OrchestratorDaemon through SessionExecutor
5. **Command hook tests**: Verify child process spawning, env var passing, JSON stdout parsing
