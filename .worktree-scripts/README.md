# Git Worktree Management Scripts

This directory contains bash scripts for managing git worktrees for Claude Code subagents, enabling
isolated parallel development without file conflicts.

## Quick Start

```bash
# Create an agent worktree
./.worktree-scripts/create-agent-worktree.sh coder my-feature-001 master

# Work in the worktree
cd .worktrees/coder-my-feature-001
# ... make changes ...
git commit -am "feat: Implement feature"

# Merge back to master
cd /path/to/repo
./.worktree-scripts/merge-agent-work.sh coder-my-feature-001 master

# Cleanup
./.worktree-scripts/cleanup-worktree.sh coder-my-feature-001
```

## Scripts Overview

### create-agent-worktree.sh

Creates an isolated git worktree for an agent to work in.

**Usage:**

```bash
./create-agent-worktree.sh <agent-type> <task-id> [base-branch]
```

**Examples:**

```bash
# Create worktree for coder agent
./create-agent-worktree.sh coder auth-feature-001 master

# Create worktree for tester agent based on coder's branch
./create-agent-worktree.sh tester auth-tests-002 agents/coder/auth-feature-001

# Create worktree for reviewer
./create-agent-worktree.sh reviewer code-review-003 master
```

**Output:**

- Creates `.worktrees/<agent-type>-<task-id>/` directory
- Creates new branch `agents/<agent-type>/<task-id>`
- Initializes worktree registry
- Exports environment variables for agent use

### merge-agent-work.sh

Merges completed agent work from worktree back to target branch.

**Usage:**

```bash
./merge-agent-work.sh <worktree-name> [target-branch] [merge-strategy]
```

**Merge Strategies:**

- `no-ff` (default): Creates merge commit preserving branch history
- `squash`: Squashes all commits into single commit
- `rebase`: Rebases before fast-forward merge

**Examples:**

```bash
# Standard merge with merge commit
./merge-agent-work.sh coder-auth-001 master no-ff

# Squash all commits into one
./merge-agent-work.sh coder-feature-002 master squash

# Rebase for linear history
./merge-agent-work.sh tester-tests-003 master rebase
```

**Features:**

- Validates uncommitted changes
- Updates target branch from remote
- Handles merge conflicts
- Updates worktree registry
- Provides cleanup instructions

### cleanup-worktree.sh

Removes worktree and optionally deletes associated branch.

**Usage:**

```bash
./cleanup-worktree.sh <worktree-name> [force]
```

**Examples:**

```bash
# Safe cleanup (only if merged)
./cleanup-worktree.sh coder-auth-001

# Force cleanup (deletes unmerged work)
./cleanup-worktree.sh coder-failed-experiment-001 true
```

**Safety Features:**

- Checks if branch is merged
- Warns about uncommitted changes
- Requires confirmation for unmerged work
- Updates worktree registry
- Prunes stale git metadata

### worktree-status.sh

Comprehensive status report for all agent worktrees.

**Usage:**

```bash
./worktree-status.sh
```

**Report Includes:**

- Repository information
- Registry summary (total, active, merged, cleaned)
- Agent type breakdown
- Active worktree details
- Uncommitted changes warnings
- Commit counts ahead of base
- Merge status
- Disk usage statistics
- Maintenance recommendations

### cleanup-all-merged.sh

Bulk cleanup of all merged agent worktrees and branches.

**Usage:**

```bash
# Dry run (see what would be cleaned)
./cleanup-all-merged.sh true

# Execute cleanup
./cleanup-all-merged.sh false
```

**Examples:**

```bash
# Preview cleanup
./cleanup-all-merged.sh true master

# Execute cleanup for merged branches
./cleanup-all-merged.sh false master
```

**Features:**

- Finds all merged agent branches
- Removes associated worktrees
- Deletes merged branches
- Prunes stale metadata
- Shows summary statistics

## Workflow Patterns

### Pattern 1: Single Agent Development

```bash
# 1. Create worktree
./create-agent-worktree.sh coder feature-x master

# 2. Work in isolation
cd .worktrees/coder-feature-x
# ... develop feature ...
git commit -am "feat: Implement feature X"

# 3. Merge and cleanup
cd /path/to/repo
./merge-agent-work.sh coder-feature-x master
./cleanup-worktree.sh coder-feature-x
```

### Pattern 2: Parallel Multi-Agent

```bash
# Create multiple worktrees in parallel
./create-agent-worktree.sh coder auth master &
./create-agent-worktree.sh coder payment master &
./create-agent-worktree.sh coder ui master &
wait

# Agents work independently...

# Sequential merge (prevents conflicts)
./merge-agent-work.sh coder-auth
./merge-agent-work.sh coder-payment
./merge-agent-work.sh coder-ui

# Bulk cleanup
./cleanup-all-merged.sh false
```

### Pattern 3: Sequential Pipeline (SPARC)

```bash
# Phase 1: Specification
./create-agent-worktree.sh specification feature-001 master
# ... spec work ...
./merge-agent-work.sh specification-feature-001

# Phase 2: Architecture (builds on spec)
./create-agent-worktree.sh architect feature-001 agents/specification/feature-001
# ... architecture work ...
./merge-agent-work.sh architect-feature-001

# Phase 3: TDD (builds on architecture)
./create-agent-worktree.sh tdd feature-001 agents/architect/feature-001
# ... implementation ...
./merge-agent-work.sh tdd-feature-001

# Cleanup all
./cleanup-all-merged.sh false
```

## Directory Structure

```
.worktrees/
├── .worktree-registry.jsonl        # Append-only event log
├── coder-auth-001/                 # Active worktree
│   ├── .agent-metadata.json        # Agent metadata
│   └── ... (full repo copy)
└── tester-auth-002/                # Another worktree
    └── ...
```

## Registry Format

The `.worktree-registry.jsonl` file tracks all worktrees:

```json
{"name":"coder-auth-001","path":"/path/.worktrees/coder-auth-001","branch":"agents/coder/auth-001","agent":"coder","task":"auth-001","base":"master","created":"2025-11-21T12:00:00Z","status":"active"}
{"name":"coder-auth-001","path":"/path/.worktrees/coder-auth-001","branch":"agents/coder/auth-001","agent":"coder","task":"auth-001","base":"master","created":"2025-11-21T12:00:00Z","status":"merged"}
{"name":"coder-auth-001","path":"/path/.worktrees/coder-auth-001","branch":"agents/coder/auth-001","agent":"coder","task":"auth-001","base":"master","created":"2025-11-21T12:00:00Z","status":"cleaned","cleaned":"2025-11-21T13:00:00Z"}
```

## Agent Metadata

Each worktree contains `.agent-metadata.json`:

```json
{
  "worktree_name": "coder-auth-001",
  "agent_type": "coder",
  "task_id": "auth-001",
  "branch": "agents/coder/auth-001",
  "base_branch": "master",
  "created": "2025-11-21T12:00:00Z",
  "repo_root": "/path/to/repo"
}
```

## Environment Variables

After creating a worktree, these variables are available:

```bash
WORKTREE_PATH=/path/.worktrees/coder-auth-001
WORKTREE_BRANCH=agents/coder/auth-001
AGENT_TYPE=coder
TASK_ID=auth-001
```

## Naming Conventions

### Worktree Names

Format: `{agent-type}-{task-id}`

Examples:

- `coder-auth-001`
- `tester-integration-002`
- `reviewer-security-003`

### Branch Names

Format: `agents/{agent-type}/{task-id}`

Examples:

- `agents/coder/auth-001`
- `agents/tester/integration-002`
- `agents/reviewer/security-003`

## Error Handling

All scripts include comprehensive error handling:

- Input validation
- Disk space checks
- Branch conflict detection
- Uncommitted changes warnings
- Merge conflict resolution guidance
- Stale worktree cleanup

## Best Practices

1. **Always create worktrees for parallel agents** to avoid conflicts
2. **Commit frequently** in worktrees to enable recovery
3. **Merge sequentially** to prevent merge conflicts
4. **Clean up regularly** using `cleanup-all-merged.sh`
5. **Check status** with `worktree-status.sh` before operations
6. **Use appropriate merge strategy** based on history requirements
7. **Monitor disk space** for large monorepos
8. **Keep registry** for audit trail

## Troubleshooting

### Worktree already exists

```bash
# List existing worktrees
git worktree list

# Remove stale worktree
git worktree remove .worktrees/name --force
```

### Branch already exists

```bash
# Check if branch is in use
git worktree list | grep branch-name

# Delete unused branch
git branch -D agents/agent/task
```

### Merge conflicts

```bash
# Show conflicted files
git diff --name-only --diff-filter=U

# Resolve manually
git add resolved-file
git commit
```

### Stale worktree metadata

```bash
# Clean up metadata
git worktree prune

# Verify cleanup
git worktree list
```

## Integration with Claude Code

These scripts integrate seamlessly with Claude Code MCP tools:

```javascript
// Initialize swarm
mcp__claude - flow__swarm_init({ topology: 'mesh' });

// Create worktrees for each agent
const agents = ['coder', 'tester', 'reviewer'];
agents.forEach(agent => {
  Bash(`./create-agent-worktree.sh ${agent} feature-001 master`);
});

// Spawn agents with worktree isolation
Task('Coder agent: Work in .worktrees/coder-feature-001');
Task('Tester agent: Work in .worktrees/tester-feature-001');
Task('Reviewer agent: Work in .worktrees/reviewer-feature-001');

// Merge results
Bash('./merge-agent-work.sh coder-feature-001');
Bash('./cleanup-all-merged.sh false');
```

## Performance

Git worktrees are efficient:

- Shared `.git` repository (no duplication of history)
- Fast worktree creation (~1-2 seconds)
- Minimal disk overhead (working tree only)
- Parallel agent speedup: 2.8-4.4x

## See Also

- [Git Worktree Integration Architecture](../docs/architecture/git-worktree-integration.md)
- [CLAUDE.md](../CLAUDE.md) - Main Claude Code configuration
- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)

## Support

For issues or questions:

- Check the [architectural specification](../docs/architecture/git-worktree-integration.md)
- Review the [error handling section](#error-handling)
- Run `worktree-status.sh` for diagnostics
