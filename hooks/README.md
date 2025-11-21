# Claude Code Hooks Templates

Complete set of production-ready hook templates for Claude Code with claude-flow integration.

## Quick Start

```bash
# 1. Make hooks executable (already done)
chmod +x hooks/templates/*.sh

# 2. Copy configuration
cp hooks/hooks.config.json .claude/hooks.config.json

# 3. Test hooks
./hooks/examples/usage-example.sh
```

## Available Hooks

### 1. Pre-Task Hook (`pre-task.sh`)
**Executes before task begins**

```bash
./hooks/templates/pre-task.sh \
    "Implement login feature" \
    "task-123" \
    "swarm-456" \
    "auto" \
    "complex"
```

**Features:**
- ✅ Environment validation
- ✅ Auto-detect agent type and complexity
- ✅ Topology optimization
- ✅ Git worktree creation
- ✅ Session context restoration
- ✅ Memory preparation
- ✅ Resource allocation
- ✅ Pre-flight checks

### 2. Post-Task Hook (`post-task.sh`)
**Executes after task completion**

```bash
./hooks/templates/post-task.sh \
    "task-123" \
    "swarm-456" \
    "completed"
```

**Features:**
- ✅ Task validation
- ✅ Results collection
- ✅ Memory update
- ✅ Neural pattern training
- ✅ Worktree merge and cleanup
- ✅ Performance analysis
- ✅ Summary generation
- ✅ Notifications

### 3. Pre-Edit Hook (`pre-edit.sh`)
**Executes before file editing**

```bash
./hooks/templates/pre-edit.sh \
    "/path/to/file.js" \
    "modify" \
    "swarm-456" \
    "task-123"
```

**Features:**
- ✅ File validation
- ✅ Lock checking (prevents conflicts)
- ✅ Automatic backup creation
- ✅ Worktree handling
- ✅ Context loading from memory
- ✅ Syntax validation
- ✅ Metadata collection

### 4. Post-Edit Hook (`post-edit.sh`)
**Executes after file editing**

```bash
./hooks/templates/post-edit.sh \
    "/path/to/file.js" \
    "modify" \
    "swarm-456" \
    "task-123"
```

**Features:**
- ✅ Change verification
- ✅ Syntax validation
- ✅ Auto-formatting (Prettier, ESLint)
- ✅ Metadata update
- ✅ Memory storage
- ✅ Git staging (optional)
- ✅ Linter execution
- ✅ Pattern learning
- ✅ Lock release

### 5. Session-Restore Hook (`session-restore.sh`)
**Restores previous session state**

```bash
./hooks/templates/session-restore.sh \
    "swarm-456" \
    "true" \
    "true" \
    "true"
```

**Features:**
- ✅ Session validation
- ✅ Memory restoration
- ✅ Topology rebuild
- ✅ Metrics restoration
- ✅ Task resumption
- ✅ Worktree restoration
- ✅ Cache restoration
- ✅ Neural pattern restoration
- ✅ Health check

### 6. Session-End Hook (`session-end.sh`)
**Clean shutdown and archival**

```bash
./hooks/templates/session-end.sh \
    "swarm-456" \
    "true" \
    "true" \
    "true"
```

**Features:**
- ✅ Metrics collection and export
- ✅ Memory snapshot
- ✅ Topology save
- ✅ Neural patterns save
- ✅ Summary generation
- ✅ Worktree cleanup
- ✅ Analytics export
- ✅ Session archival
- ✅ Temporary file cleanup
- ✅ Graceful swarm shutdown

## Configuration

All hooks are configured via `hooks.config.json`:

```json
{
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
    "ttl": 604800000
  },
  "neural": {
    "autoTrain": true,
    "patternTypes": ["task-completion", "file-edit"]
  }
}
```

## Integration with Claude Flow

### Initialize Swarm
```bash
npx claude-flow@alpha hooks swarm-init \
    --topology mesh \
    --max-agents 6 \
    --session-id "swarm-123"
```

### Spawn Agents
```bash
npx claude-flow@alpha hooks agent-spawn \
    --type "coder" \
    --session-id "swarm-123"
```

### Store Memory
```bash
npx claude-flow@alpha hooks memory-store \
    --key "swarm/123/custom" \
    --value '{"data": "value"}'
```

### Train Patterns
```bash
npx claude-flow@alpha hooks neural-train \
    --pattern-type "task-completion" \
    --input "./results.json"
```

## Git Worktree Integration

Hooks automatically manage git worktrees for task isolation:

```bash
# Pre-task creates: .worktrees/task/task-123
./hooks/templates/pre-task.sh "Feature work" "task-123" "swarm-456"

# Work in isolation
cd .worktrees/task/task-123
# Make changes...

# Post-task merges and cleans up
./hooks/templates/post-task.sh "task-123" "swarm-456" "completed"
```

## Examples

### Complete Task Workflow
```bash
#!/usr/bin/env bash
SESSION_ID="swarm-$(date +%s)"
TASK_ID="task-$(date +%s)"

# 1. Pre-task
./hooks/templates/pre-task.sh \
    "Implement authentication" \
    "$TASK_ID" \
    "$SESSION_ID"

# 2. Do work
echo "// Authentication code" > src/auth.js

# 3. Edit with hooks
./hooks/templates/pre-edit.sh src/auth.js modify "$SESSION_ID" "$TASK_ID"
echo "export const login = () => {};" >> src/auth.js
./hooks/templates/post-edit.sh src/auth.js modify "$SESSION_ID" "$TASK_ID"

# 4. Post-task
./hooks/templates/post-task.sh "$TASK_ID" "$SESSION_ID" "completed"
```

### Session Management
```bash
# End session with full archival
./hooks/templates/session-end.sh "swarm-123" true true true

# Later, restore session
./hooks/templates/session-restore.sh "swarm-123" true true true
```

## File Structure

```
hooks/
├── templates/               # Hook scripts
│   ├── pre-task.sh         # 9.9K - Task preparation
│   ├── post-task.sh        # 12K - Task completion
│   ├── pre-edit.sh         # 10K - File edit prep
│   ├── post-edit.sh        # 14K - File edit finalization
│   ├── session-restore.sh  # 13K - Session restoration
│   └── session-end.sh      # 14K - Session cleanup
├── examples/
│   └── usage-example.sh    # Complete examples
├── hooks.config.json       # Configuration
└── README.md              # This file

.claude/                    # Created by hooks
├── logs/                  # Hook execution logs
├── tasks/                 # Task data and results
├── sessions/              # Session snapshots
├── backups/               # File backups
├── metadata/              # File metadata
├── locks/                 # File locks
└── cache/                 # Cached data

.worktrees/                # Git worktrees (optional)
└── task/                  # Task-specific branches
```

## Verification Status

✅ All bash scripts validated (syntax check passed)
✅ Configuration JSON validated
✅ All hooks executable
✅ Error handling implemented
✅ Logging configured
✅ Git worktree integration working
✅ Memory management integrated
✅ Neural pattern learning enabled

## Documentation

- **Complete Guide**: See [/Users/iroselli/wundr/docs/HOOKS_GUIDE.md](/Users/iroselli/wundr/docs/HOOKS_GUIDE.md)
- **Project Config**: See [/Users/iroselli/wundr/CLAUDE.md](/Users/iroselli/wundr/CLAUDE.md)
- **Examples**: Run `./hooks/examples/usage-example.sh`

## Key Features

1. **Auto-Detection**: Agent type, complexity, and topology
2. **Memory Management**: Automatic storage and retrieval
3. **Neural Learning**: Pattern training from successful tasks
4. **Git Integration**: Worktree isolation and auto-merge
5. **Error Handling**: Comprehensive error detection and recovery
6. **Logging**: Full audit trail in `.claude/logs/`
7. **Backups**: Automatic file backup before edits
8. **Locking**: Prevent concurrent file modifications
9. **Formatting**: Auto-format with Prettier/ESLint
10. **Analytics**: Performance tracking and metrics

## Requirements

- Bash 4.0+
- Node.js 16+
- Git 2.25+ (for worktree features)
- jq (JSON processing)
- Claude Flow (optional but recommended)

## Support

For issues or questions:
- Documentation: [HOOKS_GUIDE.md](/Users/iroselli/wundr/docs/HOOKS_GUIDE.md)
- Claude Flow: https://github.com/ruvnet/claude-flow
- Project Issues: https://github.com/adapticai/wundr/issues

---

**Production Ready**: All hooks are tested, validated, and ready for immediate use.
