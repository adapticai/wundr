# Wave 2: Skills System Design

**Date**: 2026-02-09 **Status**: Implementation Ready **Priority**: High **Based on**: OpenClaw
skills system analysis (52 bundled skills, SKILL.md metadata, auto-discovery)

---

## 1. Overview

The Skills System provides a modular, extensible mechanism for packaging domain-specific knowledge,
workflows, and tool instructions into discoverable units. Skills are defined as SKILL.md files with
YAML frontmatter and Markdown instruction bodies, following a progressive disclosure model that
minimizes context window consumption.

### Design Goals

1. **OpenClaw compatibility** - SKILL.md format compatible with OpenClaw's established convention
2. **Progressive disclosure** - Three-level loading: metadata (always) -> body (on trigger) ->
   resources (on demand)
3. **Security first** - All skills scanned for malicious patterns before loading
4. **Auto-discovery** - Skills loaded from multiple directories with configurable precedence
5. **Subagent execution** - Skills with `context: fork` run in isolated subagent sessions
6. **Dynamic context** - `!command` syntax for runtime context injection
7. **Argument substitution** - `$ARGUMENTS` placeholder replaced at invocation time

---

## 2. SKILL.md File Format

### 2.1 Frontmatter Schema

```yaml
---
# Required fields
name: review-pr # Unique skill identifier (lowercase, hyphens)
description: >- # Triggering description - determines when skill activates
  Review GitHub pull requests with structured feedback. Use when asked to review a PR, assess
  readiness to land, or provide code review.

# Optional fields
context: fork # Execution context: 'inline' (default) or 'fork' (subagent)
model: claude-sonnet-4-20250514 # Override model for this skill
tools: # Required tools (eligibility check)
  - Bash
  - Read
  - Grep
allowed_tools: # Restrict available tools when skill runs
  - Bash
  - Read
  - Grep
  - Write

# Invocation control
user-invocable: true # Whether users can invoke via /skill-name (default: true)
disable-model-invocation: false # Prevent auto-triggering by model (default: false)

# Wundr metadata
metadata:
  wundr:
    emoji: "\U0001F41B"
    category: development
    requires:
      bins: # All must be present
        - gh
      anyBins: # At least one must be present
        - claude
        - codex
      env: # Required env vars
        - GITHUB_TOKEN
      config: # Required config paths
        - github.enabled
    install: # Installation instructions
      - id: brew
        kind: brew
        formula: gh
        bins: [gh]
        label: 'Install GitHub CLI (brew)'
      - id: apt
        kind: apt
        package: gh
        bins: [gh]
        label: 'Install GitHub CLI (apt)'
    os: # OS restrictions
      - darwin
      - linux
    always: false # Always include regardless of requirements
    primaryEnv: GITHUB_TOKEN # Primary env var for API key mapping
---
```

### 2.2 Body Format

The Markdown body contains instructions loaded only after the skill triggers.

```markdown
# Review PR

## Overview

Perform a thorough review-only PR assessment.

## Inputs

- Ask for PR number or URL.
- If missing, always ask. Never auto-detect from conversation.

## Dynamic Context

!gh pr view $ARGUMENTS --json number,title,state,body

## Steps

1. Identify PR meta and context
2. Read the diff thoroughly
3. Evaluate implementation quality ...

## Guardrails

- Do not push. Review only.
- Do not delete the worktree after review.
```

### 2.3 Special Syntax

| Syntax       | Description                                         | Example                                  |
| ------------ | --------------------------------------------------- | ---------------------------------------- |
| `$ARGUMENTS` | Replaced with user-provided arguments at invocation | `/review-pr 123` -> `$ARGUMENTS` = `123` |
| `!command`   | Execute shell command and inject output as context  | `!gh pr view 123 --json title`           |
| `!read path` | Read file contents into context                     | `!read ./references/schema.md`           |

---

## 3. Architecture

### 3.1 Module Structure

```
packages/@wundr/orchestrator-daemon/src/skills/
  types.ts              # Type definitions and interfaces
  skill-loader.ts       # SKILL.md discovery and parsing
  skill-scanner.ts      # Security scanning for malicious patterns
  skill-registry.ts     # Centralized skill registry with lifecycle
  skill-executor.ts     # Skill invocation and argument handling
  index.ts              # Public API
```

### 3.2 Data Flow

```
Discovery                 Registration              Invocation
---------                 ------------              ----------

1. Scan directories  -->  2. Parse frontmatter -->  5. Match skill by name
   - bundled/                Parse body               or description
   - managed/            3. Security scan     -->  6. Substitute $ARGUMENTS
   - workspace/          4. Register in       -->  7. Execute !commands
   - extra dirs              registry               8. Build prompt
                                                   9. Execute (inline/fork)
```

### 3.3 Directory Precedence (lowest to highest)

1. **Extra dirs** - Configured via `skills.load.extraDirs`
2. **Bundled** - Ships with Wundr (`packages/@wundr/orchestrator-daemon/skills/`)
3. **Managed** - User's global skills (`~/.wundr/skills/`)
4. **Workspace** - Project-local skills (`./skills/` or `./.claude/skills/`)

Higher precedence overwrites lower by skill name. This allows workspace skills to override bundled
defaults.

### 3.4 Eligibility Resolution

A skill is eligible for loading when ALL of the following are satisfied:

1. Not explicitly disabled in config (`skills.entries.<name>.enabled !== false`)
2. If bundled, passes allowlist filter (if configured)
3. OS restriction matches current platform (if specified)
4. All required binaries are available in PATH
5. At least one `anyBins` binary is available (if specified)
6. All required environment variables are set
7. All required config paths are truthy
8. Security scan passes (no critical findings)

---

## 4. Security Scanner

### 4.1 Scan Rules

The scanner checks all `.js`, `.ts`, `.mjs`, `.cjs`, `.mts`, `.cts`, `.jsx`, `.tsx` files within a
skill directory for malicious patterns.

**Critical (blocks loading):**

- Shell command execution via child_process (exec, spawn, execFile)
- Dynamic code execution (eval, Function constructor)
- Crypto-mining references (stratum, coinhive, cryptonight, xmrig)
- Environment variable access combined with network requests (credential harvesting)

**Warning (logged but allowed):**

- File read combined with network send (potential exfiltration)
- Obfuscated code (hex sequences, large base64 payloads)
- WebSocket connections to non-standard ports

### 4.2 Scan Limits

- Max 500 files per skill directory
- Max 1MB per file
- Skip `.git/`, `node_modules/`, `dist/`

### 4.3 SKILL.md Body Scanner

Additionally, the Markdown body is scanned for:

- Prompt injection attempts (system prompt overrides)
- Instructions to ignore previous context
- Attempts to access files outside the skill directory
- Encoded/obfuscated instructions

---

## 5. Skill Execution

### 5.1 Inline Execution (default)

The skill's instructions are injected into the current conversation context. The model receives the
skill body as additional system context and proceeds within the existing session.

```
User: /review-pr 123
  |
  v
Skill Executor:
  1. Find "review-pr" in registry
  2. Replace $ARGUMENTS with "123"
  3. Execute !commands (e.g., !gh pr view 123)
  4. Build prompt = body + command outputs
  5. Inject into current session context
```

### 5.2 Fork Execution (context: fork)

The skill runs in an isolated subagent session with its own context window. Results are returned to
the parent session upon completion.

```
User: /coding-agent "build a snake game"
  |
  v
Skill Executor:
  1. Find "coding-agent" in registry
  2. context: fork -> spawn subagent
  3. Subagent receives: skill body + arguments
  4. Subagent executes independently
  5. Result returned to parent session
```

### 5.3 Argument Substitution

All occurrences of `$ARGUMENTS` in the skill body are replaced with the user-provided string. If no
arguments are provided, `$ARGUMENTS` is replaced with an empty string.

### 5.4 Dynamic Context (!command)

Lines starting with `!` are executed as shell commands, and their stdout replaces the line in the
rendered prompt.

```markdown
## Current PR Status

!gh pr view $ARGUMENTS --json title,state,body --jq '.title + " (" + .state + ")"'
```

Becomes:

```markdown
## Current PR Status

Fix authentication bug (OPEN)
```

Security constraints for !commands:

- Max execution time: 30 seconds
- Max output size: 64KB
- Runs in skill's base directory
- No access to parent process env beyond configured allowlist

---

## 6. Configuration

### 6.1 Daemon Config Extension

```typescript
// Added to Config schema
skills: {
  enabled: boolean;              // Master switch (default: true)
  load: {
    extraDirs: string[];         // Additional skill directories
    watch: boolean;              // Watch for changes (default: true)
    watchDebounceMs: number;     // Debounce interval (default: 250)
  };
  entries: Record<string, {      // Per-skill config
    enabled: boolean;
    env: Record<string, string>; // Env var overrides
    apiKey: string;              // Primary API key
  }>;
  allowBundled: string[];        // Allowlist for bundled skills
  security: {
    scanOnLoad: boolean;         // Scan skills on load (default: true)
    blockCritical: boolean;      // Block skills with critical findings (default: true)
    allowedCommandPrefixes: string[]; // Allowed !command prefixes
  };
}
```

### 6.2 Environment Variable Overrides

Skills can specify environment variables that are set before execution and restored afterward. This
supports API key injection without polluting the global process environment.

---

## 7. Integration Points

### 7.1 Orchestrator Daemon

The SkillRegistry is initialized during daemon startup and registered as a subsystem. Skills are
loaded from all configured directories and made available to session executors.

### 7.2 MCP Server

A `skill-execute` MCP tool is exposed that allows Claude Code or other MCP clients to invoke skills
programmatically.

### 7.3 WebSocket API

New message types:

- `list_skills` -> `skills_list` (returns registered skills with metadata)
- `execute_skill` -> `skill_result` (invokes a skill by name)
- `scan_skill` -> `scan_result` (security scan a skill directory)

### 7.4 Session Executor

The SessionExecutor receives the skills prompt (formatted skill metadata) as part of the system
context. When a skill triggers, the full body is loaded and injected.

---

## 8. Implementation Phases

### Phase 1: Core (This Wave)

- [x] Type definitions
- [x] SKILL.md parser with YAML frontmatter
- [x] Skill loader with multi-directory discovery
- [x] Security scanner (port from OpenClaw)
- [x] Skill registry with lifecycle management
- [x] Skill executor with argument substitution

### Phase 2: Advanced Features

- [ ] File watcher for hot-reload
- [ ] !command dynamic context execution
- [ ] Fork execution via subagent sessions
- [ ] WebSocket API integration
- [ ] MCP tool exposure
- [ ] Skill installation/uninstallation CLI

### Phase 3: Ecosystem

- [ ] Skill marketplace/registry (remote)
- [ ] Skill packaging (.skill files)
- [ ] Skill validation CLI
- [ ] Community skill repository integration

---

## 9. Testing Strategy

- Unit tests for frontmatter parsing (valid, malformed, edge cases)
- Unit tests for security scanner rules
- Integration tests for multi-directory loading with precedence
- Integration tests for argument substitution and rendering
- E2E tests for skill invocation via WebSocket
- Security tests for scanner bypass attempts
