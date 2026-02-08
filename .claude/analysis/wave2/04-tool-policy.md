# Tool Policy System - Design Document

## Origin

Ported from OpenClaw's multi-layer tool policy system (`src/agents/pi-tools.policy.ts`,
`src/agents/tool-policy.ts`, `src/agents/sandbox/tool-policy.ts`, `src/config/group-policy.ts`).

## Problem

Wundr's orchestrator-daemon currently has a flat `McpToolRegistry` that registers and executes
tools without any access-control layer. Every registered tool is available to every agent, every
provider, and every session. There is no mechanism to:

- Restrict dangerous tools (e.g. `bash_execute`, `file_delete`) for specific agent types.
- Apply provider-level restrictions (e.g. limit tools when using a less-trusted LLM provider).
- Enforce subagent isolation (prevent spawned subagents from calling session-management tools).
- Configure group/team-level policies (different teams get different tool sets).
- Use wildcard patterns to manage tool families efficiently.

## Architecture

### Policy Layers (Evaluated in Precedence Order)

```
1. Global Policy         - System-wide allow/deny lists
2. Provider Policy       - Per LLM provider (e.g. "openai", "anthropic", "openai/gpt-4")
3. Agent Policy          - Per agent type (e.g. "coder", "researcher", "reviewer")
4. Group Policy          - Per agent group/team with optional per-member overrides
5. Subagent Policy       - Inherited from parent + additional restrictions
```

A tool must be allowed by ALL layers to be accessible. Any single layer denying a tool
blocks it (conjunctive evaluation / AND semantics).

### Pattern Matching

Tool names support three pattern kinds:

| Pattern     | Example       | Matches                          |
|-------------|---------------|----------------------------------|
| `*`         | `*`           | All tools                        |
| Exact       | `file_read`   | Only `file_read`                 |
| Wildcard    | `file_*`      | `file_read`, `file_write`, etc.  |

Patterns are compiled once and cached for efficient repeated evaluation.

### Tool Groups

Named groups allow referring to families of tools:

```typescript
"group:fs"       -> ["file_read", "file_write", "file_list", "file_delete"]
"group:runtime"  -> ["bash_execute"]
"group:web"      -> ["web_fetch", "web_search"]
"group:sessions" -> ["session_spawn", "session_list", "session_status"]
"group:memory"   -> ["memory_search", "memory_get"]
"group:analysis" -> ["dependency_analyze", "codebase_analysis", "drift_detection"]
```

Groups are expanded before pattern compilation.

### Deny-Before-Allow Evaluation

For each policy layer:

1. If the tool name matches any `deny` pattern, the tool is **blocked**.
2. If there are no `allow` patterns, the tool is **permitted** (open by default).
3. If the tool name matches any `allow` pattern, the tool is **permitted**.
4. Otherwise, the tool is **blocked** (allowlist is restrictive).

### alsoAllow Semantics

The `alsoAllow` field is additive. When a base policy has an allowlist, `alsoAllow` entries
are merged into it. When no allowlist exists, `alsoAllow` creates an implicit `["*", ...alsoAllow]`
policy (everything plus the extras -- primarily used for profile-level additions).

### Profiles

Named profiles provide preset tool configurations:

| Profile     | Tools Allowed                                     |
|-------------|---------------------------------------------------|
| `minimal`   | `session_status` only                              |
| `coding`    | `group:fs`, `group:runtime`, `group:sessions`, `group:memory` |
| `analysis`  | `group:analysis`, `group:fs` (read-only subset)    |
| `full`      | All tools (no restrictions)                         |

### Subagent Default Deny List

Subagents inherit their parent's policies plus additional restrictions:

```typescript
DEFAULT_SUBAGENT_TOOL_DENY = [
  "session_list", "session_status", "session_spawn",  // parent orchestrates
  "bash_execute",                                      // dangerous in subagent
  "file_delete",                                       // dangerous in subagent
  "memory_search", "memory_get",                       // parent passes context
]
```

## Data Flow

```
WundrConfig
  |
  +-- tools.allow / tools.deny              --> Global Policy
  +-- tools.byProvider["openai"].allow/deny  --> Provider Policy
  +-- agents["coder"].tools.allow/deny       --> Agent Policy
  +-- groups["team-a"].tools.allow/deny      --> Group Policy
  |     +-- groups["team-a"].toolsByMember    --> Per-member overrides
  +-- tools.subagents.tools.allow/deny       --> Subagent Policy
  |
  v
resolveEffectiveToolPolicy(config, context)
  |
  v
{ globalPolicy, providerPolicy, agentPolicy, groupPolicy, subagentPolicy, profile }
  |
  v
isToolAllowedByPolicies(toolName, [policy1, policy2, ...])
  |
  v
boolean (tool is accessible or blocked)
```

## Integration with Existing Wundr Systems

### McpToolRegistry Integration

The `tool-policy.ts` module does NOT modify the registry. Instead, it provides a filtering
layer that sits between the registry and tool execution:

```typescript
// Before executing a tool:
const policies = resolveEffectiveToolPolicy({ config, agentId, providerId });
if (!isToolAllowedByPolicies(toolName, allPolicies)) {
  throw new ToolPolicyDeniedError(toolName, deniedByLayer);
}
await registry.executeTool(toolId, operation, params);
```

### McpTool Definition Filtering

When listing available tools for an agent, policies filter the visible set:

```typescript
const allTools = registry.listTools();
const visibleTools = filterToolsByPolicy(allTools, effectivePolicy);
```

## Key Design Decisions

1. **Conjunctive (AND) evaluation**: A tool must pass ALL policy layers. This ensures
   that a restrictive global policy cannot be overridden by a permissive agent policy.

2. **Deny takes precedence over allow within a layer**: If a tool matches both deny and
   allow patterns in the same layer, it is denied.

3. **Empty allow = open**: A layer with no allow patterns permits everything (minus denies).
   This avoids accidentally blocking all tools when only deny rules are configured.

4. **Compiled patterns**: Glob patterns are compiled to RegExp once and reused, avoiding
   repeated string manipulation on every tool call.

5. **Normalized names**: All tool names are lowercased and trimmed before comparison,
   with alias resolution (e.g. `bash` -> `bash_execute`).

6. **Policy source tracking**: Each resolved policy carries metadata about where it came
   from (global, agent, provider, group) for debugging and audit logging.

## Files

| File | Purpose |
|------|---------|
| `src/security/tool-policy.ts` | Core policy engine, pattern matching, evaluation |
| `.claude/analysis/wave2/04-tool-policy.md` | This design document |

## Testing Strategy

- Unit tests for pattern compilation (exact, wildcard, all).
- Unit tests for deny-before-allow evaluation logic.
- Unit tests for multi-layer conjunctive evaluation.
- Unit tests for tool group expansion.
- Unit tests for subagent default deny inheritance.
- Unit tests for provider key normalization and lookup.
- Unit tests for alsoAllow merging semantics.
- Integration tests with McpToolRegistry filtering.
