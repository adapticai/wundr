# Ruflo API Reference

Complete API reference for Ruflo CLI commands, MCP tools, and configuration options.

## Table of Contents

- [CLI Commands](#cli-commands)
- [MCP Tools](#mcp-tools)
- [Configuration API](#configuration-api)
- [Agent API](#agent-api)
- [Hook API](#hook-api)
- [Memory API](#memory-api)
- [SPARC API](#sparc-api)
- [GitHub Integration API](#github-integration-api)

## CLI Commands

### Global Options

All commands support these global options:

```bash
--verbose, -v      # Verbose output
--quiet, -q        # Minimal output
--debug           # Debug mode
--config <path>   # Custom config file
--help, -h        # Show help
--version         # Show version
```

### Core Commands

#### `init`

Initialize Ruflo in a project.

```bash
npx ruflo@latest init [options]
```

**Options**:

```bash
--template <name>      # Use template (react, nodejs, python, etc.)
--interactive         # Interactive setup
--force              # Overwrite existing configuration
--skip-hooks         # Don't install Git hooks
--skip-mcp           # Don't configure MCP server
```

**Examples**:

```bash
# Basic initialization
npx ruflo@latest init

# With template
npx ruflo@latest init --template react

# Interactive
npx ruflo@latest init --interactive

# Force overwrite
npx ruflo@latest init --force
```

#### `config`

Manage configuration.

```bash
npx ruflo@latest config <subcommand> [options]
```

**Subcommands**:

**`config init`** - Initialize configuration

```bash
npx ruflo@latest config init [--interactive]
```

**`config get`** - Get configuration value

```bash
npx ruflo@latest config get <key>

# Examples
npx ruflo@latest config get agents.defaults.timeout
npx ruflo@latest config get hooks.pre-commit.enabled
```

**`config set`** - Set configuration value

```bash
npx ruflo@latest config set <key> <value>

# Examples
npx ruflo@latest config set agents.defaults.timeout 600000
npx ruflo@latest config set hooks.pre-commit.enabled true
```

**`config validate`** - Validate configuration

```bash
npx ruflo@latest config validate [--fix]
```

**`config schema`** - Show configuration schema

```bash
npx ruflo@latest config schema [--format json|yaml]
```

**`config merge`** - Merge configuration files

```bash
npx ruflo@latest config merge <source> [--output <path>]
```

### SPARC Commands

#### `sparc modes`

List available SPARC modes.

```bash
npx ruflo@latest sparc modes [--format table|json]
```

**Output**:

```
Available SPARC Modes:
┌─────────────────────┬──────────────────────────────────────┐
│ Mode                │ Description                          │
├─────────────────────┼──────────────────────────────────────┤
│ spec-pseudocode     │ Specification and Pseudocode         │
│ architect           │ Architecture Design                  │
│ refinement          │ TDD Refinement                       │
│ integration         │ Integration and Completion           │
│ api-docs            │ API Documentation                    │
│ code-review         │ Code Review                          │
└─────────────────────┴──────────────────────────────────────┘
```

#### `sparc run`

Run specific SPARC mode.

```bash
npx ruflo@latest sparc run <mode> "<task>" [options]
```

**Options**:

```bash
--output <path>       # Output directory
--format <format>     # Output format
--agents <list>       # Agents to use
--timeout <ms>        # Timeout in milliseconds
```

**Examples**:

```bash
# Run specification
npx ruflo@latest sparc run spec-pseudocode "Build user authentication"

# Run with specific agents
npx ruflo@latest sparc run architect "Design microservices" \
  --agents architect,backend-dev

# Run with timeout
npx ruflo@latest sparc run refinement "Implement API" \
  --timeout 900000
```

#### `sparc tdd`

Run complete TDD workflow.

```bash
npx ruflo@latest sparc tdd "<feature>" [options]
```

**Options**:

```bash
--agents <list>       # Agents to use
--coverage <num>      # Min coverage percentage
--output <path>       # Output directory
--worktree-mode <mode> # Use worktrees (parallel|sequential|none)
```

**Examples**:

```bash
# Basic TDD
npx ruflo@latest sparc tdd "Add user login"

# With coverage requirement
npx ruflo@latest sparc tdd "Add payment processing" \
  --coverage 90

# With worktrees
npx ruflo@latest sparc tdd "Build dashboard" \
  --worktree-mode parallel
```

#### `sparc batch`

Run multiple modes in parallel.

```bash
npx ruflo@latest sparc batch <modes> "<task>" [options]
```

**Examples**:

```bash
# Run spec and architect in parallel
npx ruflo@latest sparc batch spec-pseudocode,architect \
  "Design authentication system"

# Run with all modes
npx ruflo@latest sparc batch all "Complete feature implementation"
```

#### `sparc pipeline`

Run full SPARC pipeline.

```bash
npx ruflo@latest sparc pipeline "<task>" [options]
```

**Examples**:

```bash
# Full pipeline
npx ruflo@latest sparc pipeline "Build payment system"

# With custom agents
npx ruflo@latest sparc pipeline "Create admin dashboard" \
  --agents backend-dev,frontend-dev,tester
```

### Agent Commands

#### `agent types`

List available agent types.

```bash
npx ruflo@latest agent types [--format table|json]
```

#### `agent list`

List active agents.

```bash
npx ruflo@latest agent list [options]
```

**Options**:

```bash
--all                 # Include inactive agents
--custom              # Only custom agents
--format <format>     # Output format
```

#### `agent spawn`

Spawn new agent.

```bash
npx ruflo@latest agent spawn --type <type> [options]
```

**Options**:

```bash
--type <type>         # Agent type (required)
--name <name>         # Custom name
--config <path>       # Custom config
--worktree <path>     # Assign to worktree
```

**Examples**:

```bash
# Spawn coder
npx ruflo@latest agent spawn --type coder

# Spawn with custom config
npx ruflo@latest agent spawn --type backend-dev \
  --config .ruflo/agents/custom-backend.json

# Spawn in worktree
npx ruflo@latest agent spawn --type tester \
  --worktree .worktrees/testing
```

#### `agent metrics`

Get agent metrics.

```bash
npx ruflo@latest agent metrics [agent-id] [options]
```

**Options**:

```bash
--all                 # All agents
--format <format>     # Output format
--period <period>     # Time period (1h, 1d, 7d, 30d)
```

**Examples**:

```bash
# Single agent
npx ruflo@latest agent metrics coder-123

# All agents
npx ruflo@latest agent metrics --all

# Last 7 days
npx ruflo@latest agent metrics --all --period 7d
```

#### `agent configure`

Configure agent.

```bash
npx ruflo@latest agent configure <type> [options]
```

**Options**:

```bash
--timeout <ms>        # Timeout
--retries <num>       # Max retries
--languages <list>    # Programming languages
--frameworks <list>   # Frameworks
--[key] <value>       # Custom options
```

**Examples**:

```bash
# Configure coder
npx ruflo@latest agent configure coder \
  --timeout 600000 \
  --languages typescript,python \
  --frameworks react,express

# Configure tester
npx ruflo@latest agent configure tester \
  --framework jest \
  --coverage-min 80
```

### Swarm Commands

#### `swarm init`

Initialize agent swarm.

```bash
npx ruflo@latest swarm init [options]
```

**Options**:

```bash
--topology <type>     # Topology (hierarchical|mesh|adaptive)
--max-agents <num>    # Maximum agents
--coordinator <type>  # Coordinator type
```

**Examples**:

```bash
# Basic swarm
npx ruflo@latest swarm init

# Hierarchical
npx ruflo@latest swarm init --topology hierarchical

# With limits
npx ruflo@latest swarm init \
  --topology mesh \
  --max-agents 10
```

#### `swarm start`

Start swarm for task.

```bash
npx ruflo@latest swarm start [options]
```

**Options**:

```bash
--topology <type>     # Swarm topology
--agents <list>       # Agent types to spawn
--task "<description>" # Task description
--timeout <ms>        # Timeout
```

**Examples**:

```bash
# Basic swarm
npx ruflo@latest swarm start \
  --topology mesh \
  --task "Build authentication system"

# With specific agents
npx ruflo@latest swarm start \
  --topology hierarchical \
  --agents backend-dev,tester,reviewer \
  --task "Implement payment processing"
```

#### `swarm status`

Get swarm status.

```bash
npx ruflo@latest swarm status [--format json|table]
```

#### `swarm reset`

Reset swarm state.

```bash
npx ruflo@latest swarm reset [--confirm]
```

### Hook Commands

#### `hooks list`

List hooks.

```bash
npx ruflo@latest hooks list [options]
```

**Options**:

```bash
--all                 # Include disabled hooks
--custom              # Only custom hooks
--type <type>         # Filter by type
```

#### `hooks install`

Install Git hooks.

```bash
npx ruflo@latest hooks install [--force]
```

#### `hooks register`

Register custom hook.

```bash
npx ruflo@latest hooks register --file <path>
```

**Example**:

```bash
npx ruflo@latest hooks register \
  --file .ruflo/hooks/my-hook.js
```

#### `hooks enable/disable`

Enable or disable hook.

```bash
npx ruflo@latest hooks enable <hook-name>
npx ruflo@latest hooks disable <hook-name>
```

#### `hooks test`

Test hook execution.

```bash
npx ruflo@latest hooks test <hook-name> [options]
```

**Options**:

```bash
--context <path>      # Context JSON file
--verbose             # Verbose output
```

### Memory Commands

#### `memory store`

Store value in memory.

```bash
npx ruflo@latest memory store [options]
```

**Options**:

```bash
--key <key>           # Memory key (required)
--value <value>       # Value to store (required)
--scope <scope>       # Scope (global|agent|worktree)
--ttl <ms>            # Time to live
```

**Examples**:

```bash
# Store global value
npx ruflo@latest memory store \
  --key "project/status" \
  --value "In progress"

# Store with TTL
npx ruflo@latest memory store \
  --key "temp/data" \
  --value "..." \
  --ttl 3600000

# Store agent-scoped
npx ruflo@latest memory store \
  --key "coder/preferences" \
  --value '{"style": "airbnb"}' \
  --scope agent
```

#### `memory retrieve`

Retrieve value from memory.

```bash
npx ruflo@latest memory retrieve --key <key> [options]
```

**Options**:

```bash
--format <format>     # Output format (json|text)
--default <value>     # Default if not found
```

**Examples**:

```bash
# Retrieve value
npx ruflo@latest memory retrieve --key "project/status"

# With default
npx ruflo@latest memory retrieve \
  --key "missing/key" \
  --default "Not found"
```

#### `memory list`

List memory entries.

```bash
npx ruflo@latest memory list [options]
```

**Options**:

```bash
--scope <scope>       # Filter by scope
--pattern <pattern>   # Key pattern
--format <format>     # Output format
```

#### `memory cleanup`

Clean up old memory entries.

```bash
npx ruflo@latest memory cleanup [options]
```

**Options**:

```bash
--older-than <period> # Delete older than (7d, 30d, etc.)
--scope <scope>       # Scope to clean
--confirm             # Skip confirmation
```

### Worktree Commands

#### `worktree create`

Create new worktree.

```bash
npx ruflo@latest worktree create [options]
```

**Options**:

```bash
--name <name>         # Worktree name (required)
--branch <branch>     # Branch name
--agent <type>        # Assign agent
```

**Examples**:

```bash
# Basic worktree
npx ruflo@latest worktree create \
  --name backend \
  --branch feature/api

# With agent
npx ruflo@latest worktree create \
  --name testing \
  --branch feature/tests \
  --agent tester
```

#### `worktree list`

List worktrees.

```bash
npx ruflo@latest worktree list [--format table|json]
```

#### `worktree merge`

Merge worktree.

```bash
npx ruflo@latest worktree merge [options]
```

**Options**:

```bash
--from <worktree>     # Source worktree (required)
--to <branch>         # Target branch (default: main)
--strategy <strategy> # Merge strategy
```

### GitHub Commands

#### `github repo-analyze`

Analyze repository.

```bash
npx ruflo@latest github repo-analyze [options]
```

**Options**:

```bash
--repo <owner/repo>   # Repository (default: current)
--output <path>       # Output file
```

#### `github review-pr`

Review pull request.

```bash
npx ruflo@latest github review-pr <pr-number> [options]
```

**Options**:

```bash
--repo <owner/repo>   # Repository
--agents <list>       # Reviewers
--auto-approve        # Auto-approve if passes
```

**Examples**:

```bash
# Review PR
npx ruflo@latest github review-pr 123

# With specific reviewers
npx ruflo@latest github review-pr 123 \
  --agents security-manager,reviewer
```

#### `github pr-enhance`

Enhance pull request.

```bash
npx ruflo@latest github pr-enhance <pr-number> [options]
```

**Options**:

```bash
--add-tests           # Add test coverage
--add-docs            # Add documentation
--fix-issues          # Fix identified issues
```

### Utility Commands

#### `diagnostics`

Run diagnostics.

```bash
npx ruflo@latest diagnostics [options]
```

**Options**:

```bash
--full                # Full diagnostics
--quick               # Quick check
--output <path>       # Save to file
```

#### `health-check`

Quick health check.

```bash
npx ruflo@latest health-check
```

#### `metrics`

Show metrics.

```bash
npx ruflo@latest metrics [options]
```

**Options**:

```bash
--type <type>         # Metric type (performance|quality|usage)
--period <period>     # Time period
--format <format>     # Output format
```

#### `benchmark`

Run benchmarks.

```bash
npx ruflo@latest benchmark [options]
```

**Options**:

```bash
--suite <suite>       # Benchmark suite
--iterations <num>    # Number of iterations
--output <path>       # Results file
```

## MCP Tools

### Swarm Management

#### `swarm_init`

Initialize agent swarm.

**Parameters**:

```typescript
{
  topology?: 'hierarchical' | 'mesh' | 'adaptive';
  maxAgents?: number;
  coordinator?: string;
}
```

#### `agent_spawn`

Spawn new agent.

**Parameters**:

```typescript
{
  type: string;
  name?: string;
  config?: object;
  worktree?: string;
}
```

#### `task_orchestrate`

Orchestrate task across agents.

**Parameters**:

```typescript
{
  task: string;
  agents?: string[];
  topology?: string;
  timeout?: number;
}
```

### Monitoring

#### `swarm_status`

Get swarm status.

**Returns**:

```typescript
{
  active: boolean;
  topology: string;
  agents: Agent[];
  tasks: Task[];
}
```

#### `agent_metrics`

Get agent metrics.

**Parameters**:

```typescript
{
  agentId?: string;
  period?: string;
}
```

**Returns**:

```typescript
{
  agentId: string;
  tasksCompleted: number;
  avgDuration: number;
  successRate: number;
  performance: PerformanceMetrics;
}
```

### Memory

#### `memory_store`

Store in memory.

**Parameters**:

```typescript
{
  key: string;
  value: any;
  scope?: 'global' | 'agent' | 'worktree';
  ttl?: number;
}
```

#### `memory_retrieve`

Retrieve from memory.

**Parameters**:

```typescript
{
  key: string;
  scope?: string;
  default?: any;
}
```

### GitHub Integration

#### `github_swarm`

GitHub swarm operations.

**Parameters**:

```typescript
{
  operation: 'analyze' | 'review' | 'enhance';
  repo?: string;
  prNumber?: number;
  options?: object;
}
```

## Configuration API

### Configuration File Structure

```json
{
  "version": "2.0.0",
  "agents": {
    "defaults": {
      "timeout": 300000,
      "retries": 3,
      "memory": {
        "enabled": true,
        "scope": "agent"
      }
    },
    "overrides": {
      "coder": {
        "timeout": 600000,
        "languages": ["typescript", "python"],
        "autoFormat": true
      }
    }
  },
  "hooks": {
    "pre-commit": {
      "enabled": true,
      "hooks": ["format", "lint", "test"],
      "critical": true
    }
  },
  "sparc": {
    "enabled": true,
    "modes": ["spec-pseudocode", "architect", "refinement"],
    "defaultTimeout": 900000
  },
  "memory": {
    "enabled": true,
    "backend": "file",
    "path": ".ruflo/memory",
    "ttl": 2592000000
  },
  "performance": {
    "maxConcurrentAgents": 10,
    "resourceLimits": {
      "cpu": 80,
      "memory": 75
    }
  }
}
```

### Configuration Schema

See full schema:

```bash
npx ruflo@latest config schema --format json
```

## Summary

This API reference covers:

- ✅ **CLI Commands**: All command-line operations
- ✅ **MCP Tools**: Integration tools for Claude Code
- ✅ **Configuration**: All configuration options
- ✅ **Examples**: Real-world usage examples

**Next Steps**:

- [Quick Start Guide](../guides/QUICK_START.md)
- [Migration Guide](../guides/MIGRATION.md)
- [Examples](../examples/)

---

**For detailed examples and tutorials, see the guides section.**
