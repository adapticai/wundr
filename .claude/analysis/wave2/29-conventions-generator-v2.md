# Wave 2: Conventions Generator v2 - Claude Code v2.1.37 Alignment

**Date**: 2026-02-09 **Status**: Implementation Ready **Priority**: High **Based on**: Claude Code
v2.1.37 official documentation (code.claude.com/docs)

---

## 1. Overview

The Conventions Generator v2 overhauls the `.claude/` directory structure generation to align with
the actual Claude Code v2.1.37 feature surface. The existing generator (v1) was built around
speculative abstractions (swarm topologies, MemGPT memory, custom orchestration frameworks) that do
not correspond to Claude Code's actual configuration schema. This update replaces those with the
real primitives: subagent frontmatter, SKILL.md format, settings.json hooks, auto-memory, agent
teams, and permission modes.

### Design Goals

1. **Schema fidelity** - Generated files match the actual Claude Code configuration format exactly
2. **All 14 lifecycle hooks** - Support every hook event in the settings.json hooks section
3. **Full subagent frontmatter** - All 11 frontmatter fields: name, description, tools,
   disallowedTools, model, permissionMode, maxTurns, skills, mcpServers, hooks, memory
4. **SKILL.md compliance** - Skills follow the Agent Skills open standard with Claude Code
   extensions
5. **Auto-memory support** - MEMORY.md template generation for
   `~/.claude/projects/<project>/memory/`
6. **Agent teams readiness** - Configuration for experimental agent teams feature
7. **MCP server definitions** - Proper mcpServers configuration in agents and settings
8. **Backward compatibility** - Existing EnhancedProjectOptions interface extended, not replaced

---

## 2. Gap Analysis: v1 vs Claude Code v2.1.37

### 2.1 Agent Definition Gaps

| Feature            | v1 Generator                             | Claude Code v2.1.37                                                                                           |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Frontmatter fields | id, name, category, project, projectType | name, description, tools, disallowedTools, model, permissionMode, maxTurns, skills, mcpServers, hooks, memory |
| File location      | `.claude/agents/<category>/<id>.md`      | `.claude/agents/<name>.md` (flat) or nested                                                                   |
| Model selection    | Not supported                            | sonnet, opus, haiku, inherit                                                                                  |
| Permission modes   | Not supported                            | default, acceptEdits, delegate, dontAsk, bypassPermissions, plan                                              |
| Tool restrictions  | Listed as "capabilities"                 | Proper tools allowlist/denylist with Task(agent) syntax                                                       |
| Hooks in agent     | Not supported                            | Full PreToolUse/PostToolUse/Stop hooks in frontmatter                                                         |
| Memory persistence | Not supported                            | user, project, local scopes                                                                                   |
| Skills preloading  | Not supported                            | skills field loads skill content at startup                                                                   |
| MCP server access  | Boolean flag only                        | Named server references or inline definitions                                                                 |

### 2.2 Skills System Gaps

| Feature               | v1 Generator                      | Claude Code v2.1.37                              |
| --------------------- | --------------------------------- | ------------------------------------------------ |
| File format           | `<id>.md` with custom frontmatter | `<name>/SKILL.md` with standard frontmatter      |
| Invocation control    | Not supported                     | disable-model-invocation, user-invocable         |
| Subagent execution    | Not supported                     | context: fork, agent field                       |
| Dynamic context       | Not supported                     | `!`command`` syntax                              |
| Argument substitution | Not supported                     | $ARGUMENTS, $ARGUMENTS[N], $N                    |
| Supporting files      | Not supported                     | Directory with reference.md, examples/, scripts/ |
| Tool restrictions     | Not supported                     | allowed-tools field                              |
| Model override        | Not supported                     | model field                                      |

### 2.3 Hooks System Gaps

| Feature                | v1 Generator                              | Claude Code v2.1.37                                 |
| ---------------------- | ----------------------------------------- | --------------------------------------------------- |
| Hook events            | 6 custom events (preTask, postTask, etc.) | 14 lifecycle events with proper schema              |
| Hook types             | Shell commands only                       | command, prompt, agent                              |
| Configuration location | Custom settings.json schema               | Standard settings.json hooks section                |
| Matchers               | Not supported                             | Regex matchers per event type                       |
| Async hooks            | Not supported                             | async: true for background execution                |
| Decision control       | Not supported                             | JSON output with permissionDecision, continue, etc. |
| MCP tool matching      | Not supported                             | mcp**<server>**<tool> pattern                       |

### 2.4 Memory System Gaps

| Feature             | v1 Generator  | Claude Code v2.1.37                               |
| ------------------- | ------------- | ------------------------------------------------- |
| Auto-memory         | Not supported | MEMORY.md in ~/.claude/projects/<project>/memory/ |
| CLAUDE.md hierarchy | Not supported | Project, user, local, managed policy levels       |
| Rules directory     | Not supported | .claude/rules/\*.md with path-scoping             |
| CLAUDE.local.md     | Not supported | Personal project preferences, auto-gitignored     |
| Imports             | Not supported | @path/to/import syntax                            |

---

## 3. Updated Type Definitions

### 3.1 AgentConfig v2

```typescript
/**
 * Claude Code v2.1.37 subagent configuration
 * Maps directly to YAML frontmatter fields
 */
export interface AgentConfigV2 {
  /** Unique identifier, lowercase letters and hyphens */
  name: string;
  /** When Claude should delegate to this subagent */
  description: string;
  /** Organizational category (not part of Claude Code schema, used for file organization) */
  category?: string;
  /** Tools the subagent can use. Inherits all if omitted */
  tools?: string[];
  /** Tools to deny, removed from inherited or specified list */
  disallowedTools?: string[];
  /** Model: sonnet, opus, haiku, or inherit */
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  /** Permission mode for the subagent */
  permissionMode?:
    | 'default'
    | 'acceptEdits'
    | 'delegate'
    | 'dontAsk'
    | 'bypassPermissions'
    | 'plan';
  /** Maximum agentic turns before stopping */
  maxTurns?: number;
  /** Skills to preload into context at startup */
  skills?: string[];
  /** MCP servers available to this subagent */
  mcpServers?: Record<string, McpServerConfig> | string[];
  /** Lifecycle hooks scoped to this subagent */
  hooks?: AgentHooksConfig;
  /** Persistent memory scope */
  memory?: 'user' | 'project' | 'local';
  /** System prompt (markdown body after frontmatter) */
  systemPrompt?: string;
}
```

### 3.2 SkillConfigV2

```typescript
/**
 * Claude Code v2.1.37 skill configuration
 * Maps directly to SKILL.md frontmatter fields
 */
export interface SkillConfigV2 {
  /** Skill identifier, lowercase letters, numbers, hyphens */
  name: string;
  /** What the skill does and when to use it */
  description: string;
  /** Hint for autocomplete arguments */
  argumentHint?: string;
  /** Prevent Claude from auto-loading this skill */
  disableModelInvocation?: boolean;
  /** Hide from the / menu */
  userInvocable?: boolean;
  /** Tools allowed without permission when skill is active */
  allowedTools?: string[];
  /** Model to use when skill is active */
  model?: string;
  /** Run in a forked subagent context */
  context?: 'fork';
  /** Subagent type for context: fork */
  agent?: string;
  /** Lifecycle hooks scoped to this skill */
  hooks?: AgentHooksConfig;
  /** Skill instructions (markdown body) */
  instructions: string;
  /** Supporting files to generate */
  supportingFiles?: Record<string, string>;
}
```

### 3.3 HooksConfig

```typescript
/**
 * All 14 Claude Code v2.1.37 lifecycle hook events
 */
export interface HooksConfig {
  SessionStart?: HookMatcherGroup[];
  UserPromptSubmit?: HookMatcherGroup[];
  PreToolUse?: HookMatcherGroup[];
  PermissionRequest?: HookMatcherGroup[];
  PostToolUse?: HookMatcherGroup[];
  PostToolUseFailure?: HookMatcherGroup[];
  Notification?: HookMatcherGroup[];
  SubagentStart?: HookMatcherGroup[];
  SubagentStop?: HookMatcherGroup[];
  Stop?: HookMatcherGroup[];
  TeammateIdle?: HookMatcherGroup[];
  TaskCompleted?: HookMatcherGroup[];
  PreCompact?: HookMatcherGroup[];
  SessionEnd?: HookMatcherGroup[];
}

export interface HookMatcherGroup {
  /** Regex matcher to filter when hooks fire */
  matcher?: string;
  /** Hook handlers to run when matched */
  hooks: HookHandler[];
}

export interface HookHandler {
  /** Hook type */
  type: 'command' | 'prompt' | 'agent';
  /** Shell command (for type: command) */
  command?: string;
  /** Prompt text (for type: prompt or agent) */
  prompt?: string;
  /** Model override */
  model?: string;
  /** Timeout in seconds */
  timeout?: number;
  /** Custom spinner message */
  statusMessage?: string;
  /** Run in background without blocking */
  async?: boolean;
  /** Run only once per session (skills only) */
  once?: boolean;
}
```

### 3.4 SettingsConfig v2

```typescript
/**
 * Claude Code v2.1.37 settings.json schema
 */
export interface ClaudeSettingsV2 {
  /** Environment variables */
  env?: Record<string, string>;
  /** Permission configuration */
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  /** Lifecycle hooks */
  hooks?: HooksConfig;
  /** Include co-authored-by in commits */
  includeCoAuthoredBy?: boolean;
  /** Enabled MCP servers from mcpjson */
  enabledMcpjsonServers?: string[];
  /** Agent teams display mode */
  teammateMode?: 'auto' | 'in-process' | 'tmux';
  /** Disable all hooks */
  disableAllHooks?: boolean;
}
```

---

## 4. Generator Architecture

### 4.1 Directory Structure (v2)

```
.claude/
  agents/                   # Subagent definitions
    <name>.md               # Flat structure (recommended)
    <category>/             # Optional nesting for organization
      <name>.md
  skills/                   # Skill definitions
    <skill-name>/
      SKILL.md              # Required entry point
      reference.md          # Optional supporting files
      examples/
      scripts/
  rules/                    # Modular project rules
    code-style.md
    testing.md
    security.md
  settings.json             # Main configuration
  settings.local.json       # Local overrides (gitignored)
  CLAUDE.md                 # Project memory
CLAUDE.md                   # Root project memory
CLAUDE.local.md             # Personal project memory (gitignored)
```

### 4.2 Generated Agent Format

```markdown
---
name: code-reviewer
description: >-
  Expert code review specialist. Reviews code for quality, security, and maintainability. Use
  proactively after writing or modifying code.
tools: Read, Grep, Glob, Bash
model: inherit
permissionMode: default
maxTurns: 50
skills:
  - api-conventions
  - error-handling-patterns
memory: project
hooks:
  PostToolUse:
    - matcher: 'Read'
      hooks:
        - type: command
          command: "echo 'File analyzed' >> /tmp/review-log.txt"
---

You are a senior code reviewer ensuring high standards of code quality and security.

When invoked:

1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately

Review checklist:

- Code is clear and readable
- Functions and variables are well-named
- No duplicated code
- Proper error handling
- No exposed secrets or API keys
- Input validation implemented
- Good test coverage
- Performance considerations addressed

Provide feedback organized by priority:

- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (consider improving)

Include specific examples of how to fix issues.
```

### 4.3 Generated Skill Format

```
.claude/skills/deploy/
  SKILL.md
  scripts/
    validate-deploy.sh
```

```yaml
---
name: deploy
description: Deploy the application to production
disable-model-invocation: true
context: fork
allowed-tools: Bash, Read
---

Deploy $ARGUMENTS to production:

1. Run the test suite: !`npm test`
2. Build the application: !`npm run build`
3. Push to the deployment target
4. Verify the deployment succeeded
```

### 4.4 Generated settings.json Format

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run test *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git add *)",
      "Bash(git commit *)"
    ],
    "deny": ["Bash(rm -rf /)", "Bash(curl * | bash)"]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/validate-bash.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/post-edit.sh",
            "timeout": 30
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Check if all tasks are complete: $ARGUMENTS",
            "timeout": 30
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "matcher": "auto",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Review CLAUDE.md for project context before compacting'"
          }
        ]
      }
    ]
  },
  "includeCoAuthoredBy": true
}
```

---

## 5. Migration Strategy

### 5.1 Type Evolution

The existing `AgentConfig`, `SkillConfig`, and `CommandConfig` types in `enhanced-options.ts` are
preserved for backward compatibility. New `AgentConfigV2`, `SkillConfigV2`, and `HooksConfig` types
are added alongside them. The generator detects which version to use based on the presence of
v2-specific fields.

### 5.2 Agent File Migration

- **v1**: `.claude/agents/<category>/<id>.md` with custom frontmatter
- **v2**: `.claude/agents/<name>.md` with standard Claude Code frontmatter
- Category subdirectories are optional organizational aids, not required by Claude Code

### 5.3 Skill File Migration

- **v1**: `.claude/skills/<id>.md` flat files
- **v2**: `.claude/skills/<name>/SKILL.md` directory structure

### 5.4 Settings Migration

- **v1**: Custom schema with `version`, `project`, `hooks.enabled`, `memory`, `orchestration`
- **v2**: Standard Claude Code schema with `env`, `permissions`, `hooks` (14 events)

---

## 6. Wundr-Specific Generators

### 6.1 Default Agents for Wundr Projects

| Agent          | Model   | Tools                                 | Permission  | Memory  |
| -------------- | ------- | ------------------------------------- | ----------- | ------- |
| code-reviewer  | inherit | Read, Grep, Glob, Bash                | default     | project |
| debugger       | inherit | Read, Edit, Bash, Grep, Glob          | default     | project |
| test-writer    | sonnet  | Read, Write, Edit, Bash               | acceptEdits | local   |
| researcher     | haiku   | Read, Grep, Glob, WebFetch, WebSearch | plan        | user    |
| deploy-monitor | inherit | Bash, Read                            | default     | -       |

### 6.2 Default Skills for Wundr Projects

| Skill           | Invocation  | Context | Description                                   |
| --------------- | ----------- | ------- | --------------------------------------------- |
| code-review     | Both        | inline  | Structured code review with priority feedback |
| deploy          | User only   | fork    | Deploy to production with validation          |
| fix-issue       | User only   | inline  | Fix GitHub issue by number                    |
| test-gen        | Both        | inline  | Generate comprehensive test suites            |
| api-conventions | Claude only | inline  | API design patterns and conventions           |

### 6.3 Default Hooks for Wundr Projects

All 14 lifecycle events configured with appropriate handlers:

- **SessionStart**: Load project context, check for pending tasks
- **UserPromptSubmit**: Validate prompt safety
- **PreToolUse[Bash]**: Validate shell command safety
- **PreToolUse[Write|Edit]**: Check file path safety
- **PostToolUse[Write|Edit]**: Run linting, format check
- **PostToolUse[Bash]**: Track command metrics
- **PostToolUseFailure**: Log failures for debugging
- **Notification**: Custom notification handling
- **SubagentStart**: Log agent spawning
- **SubagentStop**: Collect agent results
- **Stop**: Verify task completion (prompt hook)
- **PreCompact**: Preserve critical context
- **TeammateIdle**: Verify quality gates
- **TaskCompleted**: Run test suite before marking complete
- **SessionEnd**: Persist session state, export metrics

---

## 7. Implementation Plan

### Phase 1: Type Definitions

- Add `AgentConfigV2`, `SkillConfigV2`, `HooksConfig`, `ClaudeSettingsV2` to enhanced-options.ts
- Add `McpServerConfig`, `AgentHooksConfig` supporting types
- Preserve all existing types for backward compatibility

### Phase 2: Generator Functions

- `generateAgentMarkdownV2()` - Proper YAML frontmatter with all 11 fields
- `generateSkillDirectory()` - SKILL.md with supporting file structure
- `generateSettingsV2()` - Standard Claude Code settings.json schema
- `generateMemoryTemplate()` - MEMORY.md and CLAUDE.md templates
- `generateRulesDirectory()` - .claude/rules/ with path-scoped rules
- `generateHookScripts()` - Shell scripts for hook commands

### Phase 3: Wundr Integration

- Update `generateClaudeCodeStructure()` to use v2 generators
- Create Wundr-specific default agents, skills, and hooks
- Generate .claude/rules/ for Wundr coding standards

### Phase 4: Testing

- Unit tests for all generator functions
- Snapshot tests for generated file content
- Integration test: generate full .claude/ directory and validate

---

## 8. File Inventory

### Files Modified

- `packages/@wundr/computer-setup/src/project-init/enhanced-options.ts` - Add v2 type definitions
- `packages/@wundr/computer-setup/src/project-init/claude-code-conventions.ts` - Rewrite generator

### Files Created

- `.claude/analysis/wave2/29-conventions-generator-v2.md` - This design doc

---

## 9. References

- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Memory Documentation](https://code.claude.com/docs/en/memory)
- [Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Settings Documentation](https://code.claude.com/docs/en/settings)
