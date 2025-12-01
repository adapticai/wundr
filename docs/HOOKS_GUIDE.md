# Claude Code Hooks - Complete Guide

## Overview

Claude Code hooks provide lifecycle automation for development workflows, integrating seamlessly
with claude-flow for swarm coordination, memory management, and neural pattern learning.

## Table of Contents

- [Installation](#installation)
- [Hook Types](#hook-types)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Integration with Claude Flow](#integration-with-claude-flow)
- [Git Worktree Integration](#git-worktree-integration)
- [Memory Management](#memory-management)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Installation

### Prerequisites

```bash
# Node.js and npm
node --version  # v16+ required
npm --version

# Claude Flow (optional but recommended)
npm install -g claude-flow@alpha

# Git (for worktree features)
git --version

# Additional tools (optional)
npm install -g prettier eslint
```

### Setup

1. **Copy hooks templates to your project:**

```bash
mkdir -p .claude/hooks
cp hooks/templates/* .claude/hooks/
chmod +x .claude/hooks/*.sh
```

2. **Configure hooks:**

```bash
cp hooks/hooks.config.json .claude/hooks.config.json
# Edit configuration as needed
```

3. **Verify installation:**

```bash
.claude/hooks/pre-task.sh --help
```

## Hook Types

### 1. Pre-Task Hook

**Purpose:** Prepare environment before task execution

**Features:**

- Environment validation
- Agent assignment (auto-detect or manual)
- Topology optimization based on complexity
- Git worktree preparation
- Session context restoration
- Memory preparation
- Resource allocation
- Pre-flight checks

**Usage:**

```bash
./hooks/templates/pre-task.sh \
    "Implement user authentication" \
    "task-123" \
    "swarm-456" \
    "auto" \
    "complex"
```

**Parameters:**

- `task_description` (required): Task description
- `task_id` (optional): Unique task identifier
- `session_id` (optional): Session identifier
- `agent_type` (optional): Agent type or "auto"
- `complexity` (optional): simple/medium/complex or "auto"

### 2. Post-Task Hook

**Purpose:** Cleanup and finalization after task completion

**Features:**

- Task validation
- Results collection
- Memory update
- Neural pattern training
- Worktree cleanup and merge
- Performance analysis
- Summary generation
- Notification

**Usage:**

```bash
./hooks/templates/post-task.sh \
    "task-123" \
    "swarm-456" \
    "completed" \
    "/path/to/results.json"
```

**Parameters:**

- `task_id` (required): Task identifier
- `session_id` (optional): Session identifier
- `status` (optional): completed/failed/cancelled
- `results_file` (optional): Path to results file

### 3. Pre-Edit Hook

**Purpose:** Prepare file for editing

**Features:**

- File validation
- Lock checking
- Backup creation
- Worktree handling
- Context loading from memory
- Syntax validation
- Metadata collection

**Usage:**

```bash
./hooks/templates/pre-edit.sh \
    "/path/to/file.js" \
    "modify" \
    "swarm-456" \
    "task-123"
```

**Parameters:**

- `file_path` (required): File to edit
- `edit_type` (optional): modify/create/delete
- `session_id` (optional): Session identifier
- `task_id` (optional): Task identifier

### 4. Post-Edit Hook

**Purpose:** Finalize file after editing

**Features:**

- Change verification
- Syntax validation
- Auto-formatting (Prettier, etc.)
- Metadata update
- Memory storage
- Git operations
- Linter execution
- Pattern learning
- Lock release

**Usage:**

```bash
./hooks/templates/post-edit.sh \
    "/path/to/file.js" \
    "modify" \
    "swarm-456" \
    "task-123" \
    "swarm/456/files/file-hash"
```

**Parameters:**

- `file_path` (required): Edited file
- `edit_type` (optional): modify/create/delete
- `session_id` (optional): Session identifier
- `task_id` (optional): Task identifier
- `memory_key` (optional): Custom memory key

### 5. Session-Restore Hook

**Purpose:** Restore previous session state

**Features:**

- Session validation
- Memory restoration
- Topology rebuild
- Metrics restoration
- Task resumption
- Worktree restoration
- Cache restoration
- Neural pattern restoration
- Environment state restoration
- Health check

**Usage:**

```bash
./hooks/templates/session-restore.sh \
    "swarm-456" \
    "true" \
    "true" \
    "true"
```

**Parameters:**

- `session_id` (required): Session to restore
- `restore_memory` (optional): true/false
- `restore_metrics` (optional): true/false
- `restore_tasks` (optional): true/false

### 6. Session-End Hook

**Purpose:** Clean shutdown and session archival

**Features:**

- Session validation
- Metrics collection
- Memory snapshot
- Topology save
- Neural patterns save
- Summary generation
- Worktree cleanup
- Analytics export
- Session archival
- Temporary file cleanup
- Swarm shutdown

**Usage:**

```bash
./hooks/templates/session-end.sh \
    "swarm-456" \
    "true" \
    "true" \
    "true"
```

**Parameters:**

- `session_id` (required): Session identifier
- `export_metrics` (optional): true/false
- `archive_session` (optional): true/false
- `cleanup_worktrees` (optional): true/false

## Configuration

### hooks.config.json

Complete configuration file:

```json
{
  "version": "1.0.0",
  "enabled": true,
  "hooks": {
    "preTask": {
      "enabled": true,
      "timeout": 60000,
      "autoDetect": {
        "agentType": true,
        "complexity": true,
        "topology": true
      }
    },
    "postTask": {
      "enabled": true,
      "timeout": 120000
    },
    "preEdit": {
      "enabled": true,
      "timeout": 30000
    },
    "postEdit": {
      "enabled": true,
      "timeout": 60000
    }
  },
  "autoFormat": true,
  "autoStage": false,
  "archiveTasks": true,
  "git": {
    "autoWorktree": true,
    "autoCommit": false,
    "branchPrefix": "task/",
    "cleanupOnComplete": true
  },
  "memory": {
    "autoStore": true,
    "keyPrefix": "swarm/",
    "ttl": 604800000,
    "compression": true
  },
  "neural": {
    "autoTrain": true,
    "patternTypes": ["task-completion", "file-edit"],
    "learningRate": 0.1
  },
  "backup": {
    "enabled": true,
    "retention": 7,
    "compression": true
  },
  "logging": {
    "level": "info",
    "retention": 30,
    "maxSize": "10MB"
  }
}
```

## Usage Examples

### Example 1: Complete Task Workflow

```bash
#!/usr/bin/env bash

# 1. Start task
SESSION_ID="swarm-$(date +%s)"
TASK_ID="task-$(date +%s)"

# Pre-task preparation
./hooks/templates/pre-task.sh \
    "Implement login feature" \
    "$TASK_ID" \
    "$SESSION_ID"

# Do your work here...

# Post-task cleanup
./hooks/templates/post-task.sh \
    "$TASK_ID" \
    "$SESSION_ID" \
    "completed"
```

### Example 2: File Editing with Hooks

```bash
#!/usr/bin/env bash

FILE_PATH="src/auth/login.js"
SESSION_ID="swarm-123"
TASK_ID="task-456"

# Before editing
./hooks/templates/pre-edit.sh "$FILE_PATH" "modify" "$SESSION_ID" "$TASK_ID"

# Edit file
echo "export const login = () => {};" >> "$FILE_PATH"

# After editing
./hooks/templates/post-edit.sh "$FILE_PATH" "modify" "$SESSION_ID" "$TASK_ID"
```

### Example 3: Session Management

```bash
#!/usr/bin/env bash

SESSION_ID="swarm-789"

# Start session
./hooks/templates/pre-task.sh "Start new session" "task-1" "$SESSION_ID"

# ... do work ...

# End session
./hooks/templates/session-end.sh "$SESSION_ID" true true true

# Later, restore session
./hooks/templates/session-restore.sh "$SESSION_ID" true true true
```

## Integration with Claude Flow

### Swarm Initialization

```bash
# Initialize swarm before pre-task
npx claude-flow@alpha hooks swarm-init \
    --topology mesh \
    --max-agents 6 \
    --session-id "swarm-123"

# Run pre-task hook (will use existing swarm)
./hooks/templates/pre-task.sh "Task description" "task-123" "swarm-123"
```

### Memory Management

```bash
# Store data in memory
npx claude-flow@alpha hooks memory-store \
    --key "swarm/123/custom-data" \
    --value '{"important": "data"}'

# Retrieve in hook
npx claude-flow@alpha hooks memory-retrieve \
    --key "swarm/123/custom-data"
```

### Neural Pattern Training

```bash
# Train patterns from successful task
npx claude-flow@alpha hooks neural-train \
    --pattern-type "task-completion" \
    --input "./results.json" \
    --auto-learn true
```

## Git Worktree Integration

### Automatic Worktree Creation

Pre-task hook automatically creates isolated worktrees:

```bash
# Creates: .worktrees/task/task-123
./hooks/templates/pre-task.sh "Feature work" "task-123" "swarm-456"

# Work in isolation
cd .worktrees/task/task-123
# Make changes...

# Auto-merged on completion
./hooks/templates/post-task.sh "task-123" "swarm-456" "completed"
```

### Manual Worktree Management

```bash
# Check current worktree
if [ -f .claude/current-worktree ]; then
    WORKTREE=$(cat .claude/current-worktree)
    echo "Working in: $WORKTREE"
fi

# List all worktrees
git worktree list

# Clean up manually
git worktree remove .worktrees/task/task-123
```

## Memory Management

### Memory Key Structure

```
swarm/
  {session-id}/
    task/
      {task-id}/
        description
        completion
        results
    files/
      {file-hash}/
        metadata
        content
    agents/
      {agent-id}/
        metrics
        state
```

### Storing Custom Data

```bash
# In your scripts
SESSION_ID="swarm-123"
TASK_ID="task-456"

# Store task-specific data
npx claude-flow@alpha hooks memory-store \
    --key "swarm/$SESSION_ID/task/$TASK_ID/custom" \
    --value '{"step": "in-progress", "percentage": 50}'
```

### Retrieving Data

```bash
# Retrieve data
DATA=$(npx claude-flow@alpha hooks memory-retrieve \
    --key "swarm/$SESSION_ID/task/$TASK_ID/custom" \
    --format json)

echo "$DATA"
```

## Error Handling

### Hook Failures

All hooks return proper exit codes:

```bash
# Check hook success
if ./hooks/templates/pre-task.sh "Task" "task-1" "swarm-1"; then
    echo "Pre-task successful"
    # Continue with task
else
    echo "Pre-task failed"
    # Handle error
fi
```

### Logging

All hooks log to `.claude/logs/`:

```bash
# View logs
tail -f .claude/logs/pre-task-*.log
tail -f .claude/logs/post-edit-*.log

# Search logs
grep "ERROR" .claude/logs/*.log
```

### Lock File Handling

Stale lock detection and cleanup:

```bash
# Manual lock cleanup
rm -f .claude/locks/*.lock
rm -f .claude/task.lock
```

## Best Practices

### 1. Always Use Hooks in Pairs

```bash
# ✓ Good
pre-task.sh && do_work && post-task.sh

# ✗ Bad - Missing post-task
pre-task.sh && do_work
```

### 2. Use Consistent Session IDs

```bash
# ✓ Good - Same session throughout
SESSION_ID="swarm-123"
pre-task.sh "Task 1" "t1" "$SESSION_ID"
pre-task.sh "Task 2" "t2" "$SESSION_ID"

# ✗ Bad - Different sessions
pre-task.sh "Task 1" "t1" "swarm-123"
pre-task.sh "Task 2" "t2" "swarm-456"
```

### 3. Handle Errors Gracefully

```bash
#!/usr/bin/env bash
set -euo pipefail

trap 'cleanup_on_error' ERR

cleanup_on_error() {
    echo "Error occurred, cleaning up..."
    ./hooks/templates/post-task.sh "$TASK_ID" "$SESSION_ID" "failed"
}
```

### 4. Archive Important Sessions

```bash
# Enable archival in config
{
  "archiveTasks": true,
  "sessionArchival": true
}

# Sessions saved to .claude/archive/
```

## Troubleshooting

### Hook Not Executing

```bash
# Check permissions
chmod +x .claude/hooks/*.sh

# Check for errors
bash -x .claude/hooks/pre-task.sh "Test"
```

### Claude Flow Connection Issues

```bash
# Verify installation
npx claude-flow@alpha --version

# Test connection
npx claude-flow@alpha hooks swarm-status
```

### Worktree Issues

```bash
# List worktrees
git worktree list

# Clean all
git worktree prune

# Remove specific
git worktree remove .worktrees/task/task-123 --force
```

### Memory Issues

```bash
# Check memory usage
npx claude-flow@alpha hooks memory-usage

# Clear old entries
npx claude-flow@alpha hooks memory-clear --older-than "7d"
```

### Lock File Issues

```bash
# Remove all locks
rm -rf .claude/locks

# Check for active tasks
cat .claude/task.lock
```

## Directory Structure

```
.claude/
├── hooks/
│   ├── pre-task.sh
│   ├── post-task.sh
│   ├── pre-edit.sh
│   ├── post-edit.sh
│   ├── session-restore.sh
│   └── session-end.sh
├── hooks.config.json
├── logs/
│   ├── pre-task-*.log
│   └── post-edit-*.log
├── tasks/
│   └── task-{id}/
│       ├── metadata.json
│       ├── results.json
│       └── SUMMARY.md
├── sessions/
│   └── swarm-{id}/
│       ├── metadata.json
│       ├── memory-snapshot.json
│       └── SUMMARY.md
├── backups/
├── metadata/
├── locks/
└── cache/
```

## Advanced Usage

### Custom Hook Scripts

Create custom hooks that call templates:

```bash
#!/usr/bin/env bash
# custom-workflow.sh

source ./hooks/templates/pre-task.sh
# Custom logic here
source ./hooks/templates/post-task.sh
```

### Programmatic Integration

```javascript
// Node.js integration
const { exec } = require('child_process');

function runWithHooks(taskDescription, work) {
  const sessionId = `swarm-${Date.now()}`;
  const taskId = `task-${Date.now()}`;

  // Pre-task
  exec(`./hooks/templates/pre-task.sh "${taskDescription}" ${taskId} ${sessionId}`);

  // Work
  work();

  // Post-task
  exec(`./hooks/templates/post-task.sh ${taskId} ${sessionId} completed`);
}
```

## Support

- Documentation: [CLAUDE.md](/CLAUDE.md)
- Issues: https://github.com/ruvnet/claude-flow/issues
- Examples: [hooks/examples/](/hooks/examples/)

---

**Remember:** Hooks are powerful automation tools. Always test in a safe environment before
production use.
