# Git Worktree Best Practices for Multi-Agent Automation

## Executive Summary

This document provides comprehensive best practices for using git worktrees in automated multi-agent scenarios, based on research conducted in 2024 and analysis of the Wundr codebase. Git worktrees enable true parallel execution by providing isolated filesystem contexts for concurrent agent operations.

**Key Findings:**
- Worktrees have minimal performance overhead when properly configured
- Cleanup automation is critical for long-running agent systems
- Filesystem choice significantly impacts performance in multi-agent scenarios
- Edge cases exist that can break agent coordination if not handled
- CI/CD integration requires specific strategies for conflict resolution

---

## Table of Contents

1. [Performance Implications](#1-performance-implications)
2. [Filesystem Considerations](#2-filesystem-considerations)
3. [Cleanup Strategies](#3-cleanup-strategies)
4. [Conflict Resolution](#4-conflict-resolution)
5. [When NOT to Use Worktrees](#5-when-not-to-use-worktrees)
6. [CI/CD Integration](#6-cicd-integration)
7. [Monitoring and Debugging](#7-monitoring-and-debugging)
8. [Multi-Agent Coordination Patterns](#8-multi-agent-coordination-patterns)
9. [Implementation Checklist](#9-implementation-checklist)

---

## 1. Performance Implications

### 1.1 Core Performance Characteristics

**Shared Repository Architecture:**
- All worktrees share the same `.git` directory containing objects and references
- History is NOT duplicated, so additional worktrees consume minimal storage
- Each worktree only adds working directory files, not repository metadata

**Performance Metrics (from 2024 research):**
```
Storage Overhead: ~5-10% per worktree (working files only)
Memory Impact: Minimal (shared object database)
Git Operations: Comparable to single workspace
Status Checks: Potential cache eviction in concurrent scenarios
```

### 1.2 Known Performance Issues and Mitigations

#### Cache Metadata Eviction
**Problem:** Running `git status` in one worktree evicts cached metadata about other worktrees.

**Impact:**
- Slower `git status` when working across multiple worktrees simultaneously
- More pronounced with 10+ concurrent worktrees

**Mitigation:**
```bash
# Enable fsmonitor to reduce stat() calls
git config core.fsmonitor true
git config core.untrackedCache true

# For agent scenarios, disable status checks in background workers
git config --worktree status.showUntrackedFiles no
```

#### Git Fetch Performance (Pre-Git 2.37)
**Problem:** `git fetch` was mysteriously slower proportionate to the number of worktrees.

**Solution:**
- Upgrade to Git 2.37+ (fixed in June 2022)
- Verify version: `git --version` should show 2.37.0 or higher

#### Large Working Tree Optimization (Git 2.5+)
**Features Available:**
```bash
# Enable untracked cache (speeds up git status significantly)
git config core.untrackedCache true

# Enable split-index (faster index operations)
git config core.splitIndex true

# Enable parallel checkout (faster checkouts on multi-core systems)
git config checkout.workers 0  # 0 = auto-detect CPU cores
git config checkout.thresholdForParallelism 100
```

### 1.3 Performance Best Practices

**Optimal Configuration for Multi-Agent Scenarios:**
```bash
#!/bin/bash
# Apply these settings to main repository before creating worktrees

# Performance optimizations
git config core.untrackedCache true
git config core.fsmonitor true
git config core.preloadIndex true
git config core.splitIndex true

# Parallel operations (Git 2.36+)
git config checkout.workers 0  # Auto-detect cores
git config checkout.thresholdForParallelism 50
git config fetch.parallel 0  # Parallel fetch

# Reduce unnecessary work
git config diff.autoRefreshIndex true
git config status.submoduleSummary false  # If no submodules

# Agent-specific: Disable interactive prompts
git config advice.detachedHead false
git config advice.statusHints false
```

**Agent Worktree Creation Pattern:**
```bash
# Create worktree with optimal settings
create_agent_worktree() {
    local agent_type="$1"
    local task_id="$2"
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local worktree_path="/Users/iroselli/wundr/../worktrees/agent-${agent_type}-${timestamp}"
    local branch_name="worktree/${agent_type}/${task_id}"

    # Create worktree
    git worktree add -b "${branch_name}" "${worktree_path}" master

    # Configure worktree-specific settings
    cd "${worktree_path}"

    # Disable features that slow down automated operations
    git config --worktree advice.detachedHead false
    git config --worktree gc.autoDetach false  # Prevent auto-gc during agent work

    # Enable faster operations
    git config --worktree core.preloadIndex true

    echo "Worktree created: ${worktree_path}"
}
```

### 1.4 Scalability Limits

**Tested Limits (2024 research):**
- **1-5 worktrees:** No noticeable performance impact
- **6-20 worktrees:** Minimal impact (~5-10% slower status checks)
- **21-50 worktrees:** Moderate impact (~15-25% slower operations)
- **51+ worktrees:** Significant impact, consider alternative architectures

**Recommended Maximums:**
```
Single Machine: 20 concurrent worktrees
Network Storage: 10 concurrent worktrees
CI/CD Runners: 5 concurrent worktrees per job
```

**When to Scale Horizontally Instead:**
If your multi-agent system requires more than 20 concurrent worktrees, consider:
- Multiple repository clones on different machines
- Distributed agent coordination with separate repos
- Ephemeral containers with full clones
- Cloud-based CI/CD runners with isolated workspaces

---

## 2. Filesystem Considerations

### 2.1 Filesystem Performance Characteristics

**Recommended Filesystems:**
| Filesystem | Performance | Notes | Multi-Agent Suitability |
|------------|-------------|-------|-------------------------|
| **APFS** (macOS) | Excellent | Native cloning support, fast metadata | ⭐⭐⭐⭐⭐ Ideal |
| **ext4** (Linux) | Excellent | Mature, well-tested, fast I/O | ⭐⭐⭐⭐⭐ Ideal |
| **XFS** (Linux) | Excellent | Great for large files and parallel I/O | ⭐⭐⭐⭐⭐ Ideal |
| **Btrfs** (Linux) | Good | Copy-on-write, snapshots, but slower metadata | ⭐⭐⭐⭐ Good |
| **NTFS** (Windows) | Moderate | Slower than Linux/macOS options | ⭐⭐⭐ Acceptable |
| **NFS** (Network) | Poor-Fair | High latency, caching issues | ⭐⭐ Use with caution |
| **CIFS/SMB** (Network) | Poor | Not recommended for git operations | ⭐ Avoid |

### 2.2 APFS-Specific Considerations (macOS)

**Advantages:**
- Fast directory creation (important for worktree creation)
- Copy-on-write reduces duplicate file overhead
- Native time machine integration for backups

**Configuration:**
```bash
# Verify APFS
diskutil info / | grep "File System Personality"

# Optimal APFS settings for worktrees
# (Already configured by default on modern macOS)

# Check available space (APFS shares space efficiently)
df -h /Users/iroselli/wundr
```

**Known Issues:**
- Cloud-synced folders (iCloud, Dropbox) can corrupt git repositories
- Solution: **ALWAYS** place worktrees outside cloud-synced directories

**Recommended Directory Structure:**
```
/Users/iroselli/wundr/              # Main repo (can be in cloud sync)
/Users/iroselli/worktrees/          # Worktrees (MUST be outside cloud sync)
    ├── agent-coder-20231121-143052/
    ├── agent-tester-20231121-143053/
    └── sparc-architect-20231121-143100/
```

### 2.3 Network Filesystem Considerations (NFS)

**WARNING:** NFS has significant performance implications for git operations.

**Performance Issues:**
- High latency on metadata operations (git status is slow)
- File locking can be unreliable
- Stat() calls are expensive over network

**If NFS is Required:**

```bash
# Optimize NFS mount options for git
# Add to /etc/fstab or mount command:
server:/export/worktrees /mnt/worktrees nfs \
    rw,async,noatime,nodiratime,nolock,\
    nfsvers=4.2,rsize=1048576,wsize=1048576,\
    hard,timeo=600,retrans=2,_netdev 0 0

# Explanation:
# async          - Don't wait for write confirmation (faster, less safe)
# noatime        - Don't update access times (reduces writes)
# nodiratime     - Don't update directory access times
# nolock         - Disable file locking (git doesn't need it)
# nfsvers=4.2    - Use latest NFS version
# rsize/wsize    - Large read/write buffers (1MB)
# hard           - Keep trying on network failures
# timeo=600      - 60 second timeout (adjust for network)
```

**NFS Best Practices:**
```bash
# 1. Keep .git directory on LOCAL filesystem
# 2. Only place working directories on NFS
git worktree add /mnt/nfs/worktree-1 -b branch-1

# 3. Enable aggressive caching
git config core.preloadIndex true
git config core.fscache true  # Windows only

# 4. Reduce stat() calls
git config core.ignoreStat true
git config status.showUntrackedFiles no

# 5. Use local temp directory
export TMPDIR=/tmp/git-tmp
mkdir -p $TMPDIR
```

**When to Avoid NFS:**
- Real-time agent coordination (latency too high)
- High-frequency git operations (status, add, commit)
- CI/CD pipelines (use local storage instead)

### 2.4 Filesystem Space Management

**Calculate Space Requirements:**
```bash
#!/bin/bash
# Estimate space needed for N worktrees

REPO_SIZE=$(du -sh /Users/iroselli/wundr | awk '{print $1}')
WORKING_TREE_SIZE=$(du -sh --exclude=.git /Users/iroselli/wundr | awk '{print $1}')
NUM_WORKTREES=10

echo "Repository size (with .git): $REPO_SIZE"
echo "Working tree size (no .git): $WORKING_TREE_SIZE"
echo "Estimated space for $NUM_WORKTREES worktrees:"
echo "  = 1 main repo + ($NUM_WORKTREES * working tree size)"
echo "  = $REPO_SIZE + ($NUM_WORKTREES * $WORKING_TREE_SIZE)"
```

**Monitoring Disk Usage:**
```bash
# Monitor worktree disk usage
worktree_disk_usage() {
    echo "=== Worktree Disk Usage ==="
    du -sh /Users/iroselli/worktrees/* 2>/dev/null | sort -h
    echo ""
    echo "Total worktrees space:"
    du -sh /Users/iroselli/worktrees 2>/dev/null
}

# Add to monitoring cron job
# 0 */6 * * * /path/to/worktree_disk_usage.sh | mail -s "Worktree Usage Report" admin@example.com
```

### 2.5 Inode Considerations

**Linux Systems:**
```bash
# Check inode usage (worktrees create many files)
df -i /Users/iroselli/worktrees

# If running low on inodes, adjust filesystem
# (Requires recreation with more inodes)
mkfs.ext4 -N 10000000 /dev/sdX  # 10M inodes

# Monitor inode usage
inode_usage() {
    df -i | awk 'NR==1 || /worktrees/ {print $0}'
}
```

**macOS (APFS):**
- APFS does not have fixed inode limits
- Inodes allocated dynamically
- No special configuration needed

---

## 3. Cleanup Strategies

### 3.1 Manual Cleanup Commands

**Basic Cleanup:**
```bash
# Remove a specific worktree
git worktree remove /Users/iroselli/worktrees/agent-coder-123

# Remove worktree and delete branch
git worktree remove /Users/iroselli/worktrees/agent-coder-123
git branch -D worktree/coder/task-123

# Prune stale worktree references
git worktree prune

# List all worktrees to verify
git worktree list
```

**Force Cleanup (when worktree directory is manually deleted):**
```bash
# Error: fatal: 'remove' cannot be used on locked working tree
# Solution:
git worktree unlock /Users/iroselli/worktrees/agent-coder-123
git worktree remove /Users/iroselli/worktrees/agent-coder-123

# If directory is already gone:
git worktree prune
```

### 3.2 Automated Cleanup for Failed Agents

**Scenario:** Agent crashes or times out, leaving orphaned worktree.

**Detection Script:**
```bash
#!/bin/bash
# detect-stale-worktrees.sh
# Finds worktrees from failed/timed-out agents

WORKTREE_DIR="/Users/iroselli/worktrees"
MAX_AGE_HOURS=24
CURRENT_TIME=$(date +%s)

echo "=== Scanning for stale worktrees (older than ${MAX_AGE_HOURS}h) ==="

for worktree in "${WORKTREE_DIR}"/agent-*; do
    if [ ! -d "$worktree" ]; then
        continue
    fi

    # Extract timestamp from directory name
    # Format: agent-coder-20231121-143052
    timestamp=$(basename "$worktree" | grep -oE '[0-9]{8}-[0-9]{6}')

    if [ -z "$timestamp" ]; then
        echo "⚠️  Cannot parse timestamp: $worktree"
        continue
    fi

    # Convert to epoch
    worktree_date=$(date -j -f "%Y%m%d-%H%M%S" "$timestamp" +%s 2>/dev/null)

    if [ -z "$worktree_date" ]; then
        echo "⚠️  Invalid timestamp: $worktree"
        continue
    fi

    # Calculate age
    age_seconds=$((CURRENT_TIME - worktree_date))
    age_hours=$((age_seconds / 3600))

    if [ $age_hours -gt $MAX_AGE_HOURS ]; then
        echo "🗑️  STALE ($age_hours hours): $worktree"

        # Check if still has active processes
        if pgrep -f "$worktree" > /dev/null; then
            echo "   ⚠️  WARNING: Active processes still using this worktree!"
        else
            echo "   ✓ No active processes, safe to remove"
        fi
    fi
done
```

**Automated Cleanup Script:**
```bash
#!/bin/bash
# cleanup-stale-worktrees.sh
# Automatically removes stale worktrees from failed agents

WORKTREE_DIR="/Users/iroselli/worktrees"
MAX_AGE_HOURS=24
DRY_RUN=false
CURRENT_TIME=$(date +%s)

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --max-age)
            MAX_AGE_HOURS="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "=== Automated Worktree Cleanup ==="
echo "Max age: ${MAX_AGE_HOURS} hours"
echo "Dry run: ${DRY_RUN}"
echo ""

cleanup_count=0
error_count=0

for worktree in "${WORKTREE_DIR}"/agent-*; do
    if [ ! -d "$worktree" ]; then
        continue
    fi

    # Extract timestamp
    timestamp=$(basename "$worktree" | grep -oE '[0-9]{8}-[0-9]{6}')
    worktree_date=$(date -j -f "%Y%m%d-%H%M%S" "$timestamp" +%s 2>/dev/null)

    if [ -z "$worktree_date" ]; then
        continue
    fi

    age_hours=$(( (CURRENT_TIME - worktree_date) / 3600 ))

    if [ $age_hours -gt $MAX_AGE_HOURS ]; then
        # Check for active processes
        if pgrep -f "$worktree" > /dev/null; then
            echo "⏭️  Skipping (active processes): $worktree"
            continue
        fi

        if [ "$DRY_RUN" = true ]; then
            echo "🔍 Would remove: $worktree (age: ${age_hours}h)"
            cleanup_count=$((cleanup_count + 1))
        else
            echo "🗑️  Removing: $worktree (age: ${age_hours}h)"

            # Remove from git
            if git worktree remove "$worktree" 2>/dev/null; then
                cleanup_count=$((cleanup_count + 1))
                echo "   ✅ Removed successfully"
            else
                # Try force removal
                rm -rf "$worktree"
                git worktree prune

                if [ ! -d "$worktree" ]; then
                    cleanup_count=$((cleanup_count + 1))
                    echo "   ✅ Force removed successfully"
                else
                    error_count=$((error_count + 1))
                    echo "   ❌ Failed to remove"
                fi
            fi
        fi
    fi
done

echo ""
echo "=== Cleanup Summary ==="
echo "Removed: $cleanup_count"
echo "Errors: $error_count"

# Prune stale references
if [ "$DRY_RUN" = false ]; then
    git worktree prune
    echo "✅ Pruned stale worktree references"
fi
```

**Schedule Automated Cleanup:**
```bash
# Add to crontab (every 6 hours)
# 0 */6 * * * cd /Users/iroselli/wundr && /path/to/cleanup-stale-worktrees.sh --max-age 24

# Or use launchd on macOS
# Create: ~/Library/LaunchAgents/com.wundr.worktree-cleanup.plist
```

### 3.3 Git GC Integration

**Automatic Cleanup via Git GC:**
```bash
# Git gc automatically calls git worktree prune
# Default: prune worktrees not accessed in 3 months

# Configure grace period
git config gc.worktreePruneExpire "30.days.ago"  # Default: 3.months.ago
git config gc.worktreePruneExpire "now"          # Aggressive: prune immediately
git config gc.worktreePruneExpire "never"        # Never auto-prune

# Manual gc with worktree pruning
git gc --auto

# Aggressive gc (use sparingly)
git gc --aggressive --prune=now
```

**Production-Safe GC Configuration:**
```bash
# Conservative settings for multi-agent scenarios
git config gc.auto 1000                        # Run gc after 1000 loose objects
git config gc.autoPackLimit 50                 # Repack after 50 pack files
git config gc.worktreePruneExpire "7.days.ago" # Keep worktrees for 7 days
git config gc.pruneExpire "2.weeks.ago"        # Keep unreachable objects 2 weeks
git config gc.autoDetach false                 # Don't run gc in background (safer)
```

### 3.4 Emergency Cleanup Procedures

**Scenario: Disk space critical, need immediate cleanup**

```bash
#!/bin/bash
# emergency-cleanup.sh
# WARNING: Aggressive cleanup, may interrupt running agents

echo "⚠️  EMERGENCY CLEANUP STARTING ⚠️"
echo "This will remove ALL worktrees older than 1 hour"
read -p "Continue? (yes/no) " -n 3 -r
echo
if [[ ! $REPLY =~ ^yes$ ]]; then
    exit 1
fi

# Stop all agent processes
echo "Stopping agent processes..."
pkill -f "agent-coder"
pkill -f "agent-tester"
pkill -f "sparc"

# Remove all worktrees
echo "Removing worktrees..."
REMOVED=0
for worktree in /Users/iroselli/worktrees/*; do
    if [ -d "$worktree" ]; then
        echo "  Removing: $worktree"
        git worktree remove "$worktree" --force 2>/dev/null || rm -rf "$worktree"
        REMOVED=$((REMOVED + 1))
    fi
done

# Prune references
git worktree prune

# Clean up branches
echo "Removing worktree branches..."
git branch -D $(git branch | grep "worktree/") 2>/dev/null

# Run aggressive gc
echo "Running git gc..."
git gc --aggressive --prune=now

echo ""
echo "✅ Emergency cleanup complete"
echo "   Removed worktrees: $REMOVED"
echo "   Freed space: $(df -h /Users/iroselli/worktrees | tail -1 | awk '{print $4}')"
```

### 3.5 Graceful Agent Shutdown with Cleanup

**Agent Wrapper Script:**
```bash
#!/bin/bash
# agent-wrapper.sh
# Ensures cleanup on agent exit (success or failure)

AGENT_TYPE="$1"
TASK_ID="$2"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
WORKTREE_PATH="/Users/iroselli/worktrees/agent-${AGENT_TYPE}-${TIMESTAMP}"
BRANCH_NAME="worktree/${AGENT_TYPE}/${TASK_ID}"

# Trap exit signals for cleanup
cleanup() {
    exit_code=$?
    echo "🧹 Cleanup triggered (exit code: $exit_code)"

    # Return to main repo
    cd /Users/iroselli/wundr

    # If agent succeeded, merge changes
    if [ $exit_code -eq 0 ]; then
        echo "✅ Agent succeeded, merging changes..."
        git merge --no-ff "${BRANCH_NAME}" -m "Merge ${TASK_ID} from ${AGENT_TYPE}"
    else
        echo "❌ Agent failed, preserving worktree for debugging"
        # Create debug snapshot
        tar -czf "/tmp/failed-agent-${TIMESTAMP}.tar.gz" "${WORKTREE_PATH}"
        echo "   Debug snapshot: /tmp/failed-agent-${TIMESTAMP}.tar.gz"
    fi

    # Remove worktree (unless debugging flag is set)
    if [ -z "$DEBUG_PRESERVE_WORKTREE" ]; then
        echo "🗑️  Removing worktree: ${WORKTREE_PATH}"
        git worktree remove "${WORKTREE_PATH}" 2>/dev/null
        git branch -d "${BRANCH_NAME}" 2>/dev/null
    else
        echo "🔍 DEBUG: Preserving worktree for inspection"
    fi

    exit $exit_code
}

trap cleanup EXIT INT TERM

# Create worktree
echo "🌳 Creating worktree: ${WORKTREE_PATH}"
git worktree add -b "${BRANCH_NAME}" "${WORKTREE_PATH}" master

# Run agent
cd "${WORKTREE_PATH}"
echo "🤖 Running agent: ${AGENT_TYPE} on task: ${TASK_ID}"

# Execute agent command
npx claude-flow sparc run "${AGENT_TYPE}" "${TASK_ID}"

# cleanup() will be called automatically on exit
```

---

## 4. Conflict Resolution

### 4.1 Understanding Worktree Conflicts

**Types of Conflicts:**

1. **Branch Conflicts:** Same branch checked out in multiple worktrees (NOT ALLOWED by Git)
2. **File Conflicts:** Multiple worktrees modifying the same files (resolved during merge)
3. **Index Conflicts:** Concurrent staging operations (rare, usually auto-resolved)
4. **Reference Conflicts:** Multiple worktrees creating same tags/branches (preventable)

### 4.2 Preventing Branch Conflicts

**Problem:**
```bash
# ❌ ERROR: Not allowed
git worktree add ../worktree-1 -b feature-auth
git worktree add ../worktree-2 -b feature-auth
# fatal: 'feature-auth' is already checked out at '../worktree-1'
```

**Solution: Unique Branch Per Worktree**
```bash
# ✅ CORRECT: Each worktree gets unique branch
git worktree add -b "worktree/coder/auth-$(date +%s)" ../worktree-1 master
git worktree add -b "worktree/tester/auth-$(date +%s)" ../worktree-2 master
```

**Agent Naming Convention:**
```bash
# Pattern: worktree/{agent-type}/{task-id}-{timestamp}
create_unique_branch() {
    local agent_type="$1"
    local task_id="$2"
    local timestamp=$(date +%Y%m%d-%H%M%S)
    echo "worktree/${agent_type}/${task_id}-${timestamp}"
}

# Usage
BRANCH=$(create_unique_branch "coder" "feature-auth")
git worktree add -b "$BRANCH" ../worktree-1 master
```

### 4.3 Detecting File Conflicts Early

**Pre-Merge Conflict Detection:**
```bash
#!/bin/bash
# check-merge-conflicts.sh
# Detect conflicts BEFORE merging worktree

SOURCE_BRANCH="$1"  # e.g., worktree/coder/task-123
TARGET_BRANCH="${2:-master}"

echo "Checking for conflicts: $SOURCE_BRANCH -> $TARGET_BRANCH"

# Create temporary merge (no commit)
git merge --no-commit --no-ff "$SOURCE_BRANCH" 2>&1 | tee /tmp/merge-check.log

# Check for conflicts
if git diff --name-only --diff-filter=U | grep -q .; then
    echo "❌ CONFLICTS DETECTED:"
    git diff --name-only --diff-filter=U

    # Show conflict details
    echo ""
    echo "=== Conflict Details ==="
    git diff --check

    # Abort merge
    git merge --abort

    exit 1
else
    echo "✅ No conflicts detected"

    # Abort merge (we were just checking)
    git merge --abort

    exit 0
fi
```

**Use in Agent Pipeline:**
```bash
# Before merging agent changes
if ! ./check-merge-conflicts.sh "worktree/coder/task-123"; then
    echo "Conflicts detected! Notifying coordinator..."
    # Trigger conflict resolution workflow
    handle_merge_conflict "worktree/coder/task-123"
fi
```

### 4.4 Automated Conflict Resolution Strategies

**Strategy 1: Last-Writer-Wins (Simple)**
```bash
# Automatically accept changes from agent worktree
merge_with_theirs() {
    local branch="$1"

    git merge --no-commit --no-ff "$branch"

    # Resolve conflicts by accepting their changes
    git diff --name-only --diff-filter=U | while read file; do
        git checkout --theirs "$file"
        git add "$file"
    done

    git commit -m "Merge $branch (auto-resolved: theirs)"
}
```

**Strategy 2: Semantic Merge (Advanced)**
```bash
# Use semantic merge tools for specific file types
merge_with_semantic_resolution() {
    local branch="$1"

    git merge --no-commit --no-ff "$branch"

    # Resolve conflicts using file-type-specific strategies
    git diff --name-only --diff-filter=U | while read file; do
        case "$file" in
            *.json)
                # JSON: Merge objects, prefer newer values
                merge-json-conflict "$file"
                ;;
            *.md)
                # Markdown: Concatenate changes
                merge-markdown-conflict "$file"
                ;;
            *.ts|*.js)
                # Code: Fail and require manual resolution
                echo "❌ Manual resolution required for: $file"
                return 1
                ;;
            *)
                # Default: Accept theirs
                git checkout --theirs "$file"
                ;;
        esac
        git add "$file"
    done

    git commit -m "Merge $branch (auto-resolved: semantic)"
}
```

**Strategy 3: Multi-Agent Consensus (Sophisticated)**
```bash
# When multiple agents modified same file, take consensus
merge_with_consensus() {
    local branches=("$@")

    # Collect all versions of conflicted files
    local conflict_dir="/tmp/merge-consensus-$(date +%s)"
    mkdir -p "$conflict_dir"

    for branch in "${branches[@]}"; do
        git show "$branch:path/to/file" > "$conflict_dir/$(basename $branch)"
    done

    # Use LLM to determine consensus (Claude Code integration)
    consensus_resolution=$(npx claude-flow resolve-conflict \
        --files "$conflict_dir"/* \
        --strategy "consensus")

    # Apply consensus
    echo "$consensus_resolution" > "path/to/file"
    git add "path/to/file"
}
```

### 4.5 Conflict Resolution Workflows

**Workflow 1: Sequential Integration (Safest)**
```bash
#!/bin/bash
# sequential-merge.sh
# Merge worktrees one at a time, resolving conflicts incrementally

WORKTREES=(
    "worktree/coder/task-1"
    "worktree/tester/task-1"
    "worktree/reviewer/task-1"
)

for branch in "${WORKTREES[@]}"; do
    echo "Merging: $branch"

    # Attempt merge
    if git merge --no-ff "$branch" -m "Merge $branch"; then
        echo "✅ Merged successfully: $branch"
    else
        echo "❌ Conflict in: $branch"

        # Show conflicts
        git diff --name-only --diff-filter=U

        # Trigger resolution
        echo "Resolving conflicts..."
        ./resolve-conflicts.sh "$branch"

        # Verify resolution
        if git diff --cached --quiet; then
            echo "❌ No changes staged, resolution failed"
            git merge --abort
            exit 1
        fi

        # Complete merge
        git commit -m "Merge $branch (conflicts resolved)"
    fi

    # Run tests after each merge
    npm run test || {
        echo "❌ Tests failed after merging $branch"
        git reset --hard HEAD~1
        exit 1
    }
done

echo "✅ All worktrees merged successfully"
```

**Workflow 2: Parallel Integration with Conflict Detection**
```bash
#!/bin/bash
# parallel-merge.sh
# Merge all worktrees, detect conflicts, resolve in batch

WORKTREES=(
    "worktree/coder/task-1"
    "worktree/tester/task-1"
    "worktree/reviewer/task-1"
)

# Phase 1: Detect all conflicts
echo "=== Phase 1: Conflict Detection ==="
CONFLICTS=()

for branch in "${WORKTREES[@]}"; do
    if ! ./check-merge-conflicts.sh "$branch"; then
        CONFLICTS+=("$branch")
    fi
done

if [ ${#CONFLICTS[@]} -eq 0 ]; then
    echo "✅ No conflicts detected, proceeding with merge"

    # Merge all branches
    git merge --no-ff "${WORKTREES[@]}" -m "Merge all agent worktrees"

else
    echo "❌ Conflicts detected in:"
    printf '  - %s\n' "${CONFLICTS[@]}"

    # Phase 2: Resolve conflicts
    echo ""
    echo "=== Phase 2: Conflict Resolution ==="

    for branch in "${CONFLICTS[@]}"; do
        echo "Resolving: $branch"
        ./resolve-conflicts.sh "$branch"
    done

    # Phase 3: Merge after resolution
    echo ""
    echo "=== Phase 3: Final Merge ==="
    git merge --no-ff "${WORKTREES[@]}" -m "Merge all agent worktrees (conflicts resolved)"
fi
```

### 4.6 Merge Conflict Monitoring

**Track Conflict Frequency:**
```bash
#!/bin/bash
# conflict-metrics.sh
# Track merge conflict statistics

METRICS_FILE=".claude/metrics/merge-conflicts.json"
mkdir -p "$(dirname $METRICS_FILE)"

log_conflict() {
    local branch="$1"
    local files="$2"
    local resolution_time="$3"

    jq -n \
        --arg branch "$branch" \
        --arg files "$files" \
        --arg time "$resolution_time" \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{
            branch: $branch,
            conflicted_files: ($files | split("\n")),
            resolution_time_seconds: ($time | tonumber),
            timestamp: $timestamp
        }' >> "$METRICS_FILE"
}

# Usage in resolution script
start_time=$(date +%s)
# ... resolve conflicts ...
end_time=$(date +%s)
resolution_time=$((end_time - start_time))

conflicted_files=$(git diff --name-only --diff-filter=U | tr '\n' ' ')
log_conflict "worktree/coder/task-123" "$conflicted_files" "$resolution_time"
```

**Generate Conflict Report:**
```bash
#!/bin/bash
# conflict-report.sh
# Analyze merge conflict patterns

jq -s '
    group_by(.branch) |
    map({
        branch: .[0].branch,
        total_conflicts: length,
        avg_resolution_time: (map(.resolution_time_seconds) | add / length),
        most_conflicted_files: (
            map(.conflicted_files[]) |
            group_by(.) |
            map({file: .[0], count: length}) |
            sort_by(.count) |
            reverse |
            .[0:5]
        )
    })
' .claude/metrics/merge-conflicts.json
```

---

## 5. When NOT to Use Worktrees

### 5.1 Single Agent Scenarios

**DON'T use worktrees when:**
- Only one agent is active
- Agent tasks are strictly sequential
- No parallelism required

**Why:** Overhead without benefit
- Worktree creation/deletion adds latency
- Simple branch switching is faster
- Less complexity in error handling

**Alternative:**
```bash
# Simple branch workflow (no worktrees)
git checkout -b feature-branch
# ... do work ...
git commit -am "Implement feature"
git checkout master
git merge feature-branch
git branch -d feature-branch
```

### 5.2 Read-Only Operations

**DON'T use worktrees when:**
- Agents only read/analyze code
- No file modifications occur
- No commits needed

**Why:** Unnecessary isolation
- Read operations don't conflict
- Shared workspace is sufficient
- Wastes disk space

**Alternative:**
```bash
# All agents read from main workspace
cd /Users/iroselli/wundr
npx claude-flow sparc run researcher "analyze codebase"
npx claude-flow sparc run reviewer "review architecture"
# No worktrees needed
```

### 5.3 Completely Isolated Directories

**DON'T use worktrees when:**
- Agent works in `/tmp` or isolated directory
- No git integration required
- Ephemeral work (deleted after completion)

**Why:** Git overhead for non-git use case
- Worktrees are for git-tracked work
- Simpler to use plain directories
- Faster creation/deletion

**Alternative:**
```bash
# Use temporary directory
WORK_DIR=$(mktemp -d)
cd "$WORK_DIR"
# ... agent work ...
rm -rf "$WORK_DIR"
```

### 5.4 Short-Lived Tasks (< 5 minutes)

**DON'T use worktrees when:**
- Task completes in seconds/minutes
- Overhead of worktree creation exceeds task duration
- Simple file edits

**Why:** Performance overhead
- Worktree creation: ~1-2 seconds
- Cleanup: ~1-2 seconds
- Total overhead: 2-4 seconds per task

**Threshold Analysis:**
```
Task Duration    Worktree Overhead    Overhead %    Recommendation
< 10 seconds     3 seconds           30%+          ❌ Don't use
10-60 seconds    3 seconds           5-30%         ⚠️  Maybe
1-5 minutes      3 seconds           1-5%          ✅ OK
5+ minutes       3 seconds           <1%           ✅ Recommended
```

**Alternative:**
```bash
# Quick edits without worktrees
git stash  # Save current work
git checkout -b quick-fix
# ... make quick change ...
git commit -am "Quick fix"
git checkout master
git merge quick-fix
git branch -d quick-fix
git stash pop  # Restore work
```

### 5.5 Cloud-Synced Directories

**NEVER use worktrees in:**
- iCloud Drive
- Dropbox
- Google Drive
- OneDrive
- Any cloud-synced folder

**Why:** Git repository corruption
- Cloud sync interferes with `.git` operations
- File locks cause conflicts
- Partial syncs break repository
- Data loss risk

**Symptoms of corruption:**
```
fatal: bad object HEAD
error: object file .git/objects/... is empty
fatal: loose object ... is corrupt
```

**Safe Configuration:**
```bash
# ✅ CORRECT
Main Repo: /Users/iroselli/wundr        # Can be in cloud sync
Worktrees: /Users/iroselli/worktrees    # MUST be outside cloud sync

# ❌ WRONG
Main Repo: ~/iCloud/wundr               # Dangerous
Worktrees: ~/iCloud/worktrees           # Extremely dangerous
```

### 5.6 Network-Mounted Git Repositories

**DON'T use worktrees when:**
- Main repository is on NFS/CIFS
- High network latency (>50ms)
- Unreliable network connection

**Why:** Performance and reliability issues
- Slow metadata operations
- File locking problems
- Network failures cause corruption

**Alternative:**
```bash
# Clone repository locally, use worktrees on local disk
git clone user@server:/repo.git /local/path/repo
cd /local/path/repo
git worktree add /local/path/worktrees/agent-1 -b branch-1
```

### 5.7 Very Large Repositories (Monorepos)

**Consider alternatives when:**
- Repository > 10GB
- > 100k files in working tree
- Worktree creation takes > 30 seconds

**Why:** Resource constraints
- Large disk space per worktree
- Slow checkout operations
- Memory pressure

**Alternatives:**
1. **Sparse Checkout:**
```bash
git sparse-checkout init --cone
git sparse-checkout set src/module-A
```

2. **Partial Clone:**
```bash
git clone --filter=blob:none --depth=1 url repo
```

3. **Multiple Smaller Repos:**
```bash
# Split monorepo into multiple repos
# Use git submodules or separate clones
```

### 5.8 Edge Cases and Known Limitations

**1. Submodules:**
```bash
# ⚠️  WARNING: Submodules are NOT copied to worktrees
# Each worktree needs separate submodule init

git worktree add ../worktree-1 -b branch-1
cd ../worktree-1
git submodule update --init --recursive  # Required in each worktree
```

**2. Git LFS (Large File Storage):**
```bash
# ⚠️  WARNING: LFS files are downloaded per worktree
# Can consume significant bandwidth and disk space

# Alternative: Use reference repository
git clone --reference /path/to/main/repo url worktree-1
```

**3. Detached HEAD State:**
```bash
# ❌ AVOID: Worktrees with detached HEAD
git worktree add ../worktree-1 abc123  # Detached HEAD

# ✅ BETTER: Always use named branch
git worktree add -b temp-branch ../worktree-1 abc123
```

**4. Nested Worktrees:**
```bash
# ❌ NOT SUPPORTED: Worktree inside another worktree
cd /worktree-1
git worktree add ./nested  # Error: not allowed

# ✅ CORRECT: All worktrees at same level
/worktrees/worktree-1/
/worktrees/worktree-2/
/worktrees/worktree-3/
```

**5. Cross-Platform Worktrees:**
```bash
# ⚠️  WARNING: Moving worktrees between Windows/Linux/macOS breaks paths
# Absolute paths are stored in .git/worktrees/*/gitdir

# Solution: Recreate worktrees on target platform
git worktree remove /old/path/worktree-1
git worktree add /new/path/worktree-1 -b branch-1
```

---

## 6. CI/CD Integration

### 6.1 GitHub Actions Integration

**Basic Workflow with Worktrees:**
```yaml
name: Multi-Agent Testing with Worktrees

on:
  pull_request:
    branches: [ master ]

jobs:
  parallel-agent-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        agent: [coder, tester, reviewer]
      fail-fast: false

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for worktrees

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Create agent worktree
        run: |
          AGENT_TYPE="${{ matrix.agent }}"
          WORKTREE_PATH="${GITHUB_WORKSPACE}/../worktree-${AGENT_TYPE}"
          BRANCH_NAME="worktree/${AGENT_TYPE}/${{ github.run_id }}"

          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"

          git worktree add -b "${BRANCH_NAME}" "${WORKTREE_PATH}" HEAD
          echo "WORKTREE_PATH=${WORKTREE_PATH}" >> $GITHUB_ENV
          echo "BRANCH_NAME=${BRANCH_NAME}" >> $GITHUB_ENV

      - name: Install dependencies in worktree
        working-directory: ${{ env.WORKTREE_PATH }}
        run: npm ci

      - name: Run agent task
        working-directory: ${{ env.WORKTREE_PATH }}
        run: |
          npx claude-flow sparc run ${{ matrix.agent }} "${{ github.event.pull_request.title }}"

      - name: Commit agent changes
        working-directory: ${{ env.WORKTREE_PATH }}
        run: |
          git add .
          git commit -m "Agent ${{ matrix.agent }} results for run ${{ github.run_id }}" || echo "No changes"

      - name: Cleanup worktree
        if: always()
        run: |
          cd "${GITHUB_WORKSPACE}"
          git worktree remove "${WORKTREE_PATH}" --force || true
          git branch -D "${BRANCH_NAME}" || true
          git worktree prune
```

**Advanced: Merge Agent Results**
```yaml
  merge-agent-results:
    needs: parallel-agent-tests
    runs-on: ubuntu-latest
    if: success()

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Fetch all agent branches
        run: |
          git fetch origin "refs/heads/worktree/*:refs/remotes/origin/worktree/*"

      - name: Merge agent results
        run: |
          AGENT_BRANCHES=$(git branch -r | grep "worktree.*${{ github.run_id }}")

          for branch in $AGENT_BRANCHES; do
            echo "Merging: $branch"

            if git merge --no-ff "$branch" -m "Merge agent results: $branch"; then
              echo "✅ Merged: $branch"
            else
              echo "❌ Conflict in: $branch"
              # Resolve conflicts automatically
              git diff --name-only --diff-filter=U | while read file; do
                git checkout --theirs "$file"
                git add "$file"
              done
              git commit -m "Merge $branch (auto-resolved conflicts)"
            fi
          done

      - name: Run integration tests
        run: npm run test:integration

      - name: Push merged results
        if: success()
        run: |
          git push origin HEAD:${{ github.head_ref }}
```

### 6.2 GitLab CI Integration

```yaml
# .gitlab-ci.yml
stages:
  - setup
  - parallel-agents
  - integration
  - cleanup

variables:
  WORKTREE_BASE: "${CI_PROJECT_DIR}/../worktrees"

setup-worktrees:
  stage: setup
  script:
    - mkdir -p "${WORKTREE_BASE}"
    - git config --global user.name "GitLab CI"
    - git config --global user.email "ci@gitlab.com"
  artifacts:
    paths:
      - .git/
    expire_in: 1 hour

agent-coder:
  stage: parallel-agents
  dependencies:
    - setup-worktrees
  script:
    - |
      WORKTREE_PATH="${WORKTREE_BASE}/agent-coder-${CI_JOB_ID}"
      git worktree add -b "worktree/coder/${CI_PIPELINE_ID}" "${WORKTREE_PATH}" HEAD

      cd "${WORKTREE_PATH}"
      npm ci
      npx claude-flow sparc run coder "${CI_COMMIT_MESSAGE}"

      git add .
      git commit -m "Coder agent results" || true

      # Push branch for later merge
      git push origin "worktree/coder/${CI_PIPELINE_ID}"
  after_script:
    - git worktree remove "${WORKTREE_PATH}" --force || true
  parallel:
    matrix:
      - AGENT: [coder, tester, reviewer]

merge-results:
  stage: integration
  dependencies:
    - agent-coder
  script:
    - |
      for agent in coder tester reviewer; do
        BRANCH="worktree/${agent}/${CI_PIPELINE_ID}"
        git merge --no-ff "origin/${BRANCH}" -m "Merge ${agent} results"
      done
    - npm run test:integration
    - git push origin HEAD:${CI_COMMIT_REF_NAME}

cleanup-worktrees:
  stage: cleanup
  when: always
  script:
    - git worktree prune
    - git branch -D $(git branch | grep "worktree/${CI_PIPELINE_ID}") || true
    - rm -rf "${WORKTREE_BASE}"
```

### 6.3 Jenkins Pipeline Integration

```groovy
// Jenkinsfile
pipeline {
    agent any

    environment {
        WORKTREE_BASE = "${WORKSPACE}/../worktrees"
    }

    stages {
        stage('Setup') {
            steps {
                sh 'mkdir -p ${WORKTREE_BASE}'
                sh 'git config user.name "Jenkins"'
                sh 'git config user.email "jenkins@example.com"'
            }
        }

        stage('Parallel Agents') {
            parallel {
                stage('Coder Agent') {
                    steps {
                        script {
                            runAgent('coder')
                        }
                    }
                }
                stage('Tester Agent') {
                    steps {
                        script {
                            runAgent('tester')
                        }
                    }
                }
                stage('Reviewer Agent') {
                    steps {
                        script {
                            runAgent('reviewer')
                        }
                    }
                }
            }
        }

        stage('Integration') {
            steps {
                sh '''
                    for agent in coder tester reviewer; do
                        BRANCH="worktree/${agent}/${BUILD_ID}"
                        git merge --no-ff "${BRANCH}" -m "Merge ${agent} results" || {
                            # Handle conflicts
                            git diff --name-only --diff-filter=U | while read file; do
                                git checkout --theirs "$file"
                                git add "$file"
                            done
                            git commit -m "Merge ${agent} (resolved)"
                        }
                    done
                '''

                sh 'npm run test:integration'
            }
        }
    }

    post {
        always {
            sh '''
                git worktree prune
                git branch -D $(git branch | grep "worktree/${BUILD_ID}") || true
                rm -rf ${WORKTREE_BASE}
            '''
        }
    }
}

def runAgent(agentType) {
    def worktreePath = "${env.WORKTREE_BASE}/agent-${agentType}-${env.BUILD_ID}"
    def branchName = "worktree/${agentType}/${env.BUILD_ID}"

    sh """
        git worktree add -b "${branchName}" "${worktreePath}" HEAD
        cd "${worktreePath}"
        npm ci
        npx claude-flow sparc run ${agentType} "${env.GIT_COMMIT_MSG}"
        git add .
        git commit -m "Agent ${agentType} results" || true
    """
}
```

### 6.4 CI/CD Best Practices

**1. Always Cleanup Worktrees**
```yaml
# Use always() or after_script to ensure cleanup
after_script:
  - git worktree remove "${WORKTREE_PATH}" --force || true
  - git worktree prune
```

**2. Use Shallow Clones When Possible**
```yaml
# Faster checkout, less disk usage
- uses: actions/checkout@v4
  with:
    fetch-depth: 1  # Only latest commit

# But for worktrees, need more history:
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Full history (required for worktrees)
```

**3. Cache Dependencies Per Worktree**
```yaml
# Don't share node_modules between worktrees
- name: Cache dependencies
  uses: actions/cache@v3
  with:
    path: |
      ${{ env.WORKTREE_PATH }}/node_modules
    key: ${{ runner.os }}-${{ matrix.agent }}-${{ hashFiles('**/package-lock.json') }}
```

**4. Limit Concurrent Worktrees**
```yaml
# Prevent resource exhaustion
strategy:
  matrix:
    agent: [coder, tester, reviewer]
  max-parallel: 3  # Limit concurrent jobs
```

**5. Handle Merge Conflicts Gracefully**
```yaml
- name: Merge with conflict handling
  run: |
    if ! git merge --no-ff "${BRANCH}"; then
      # Log conflict for debugging
      echo "::warning::Merge conflict in ${BRANCH}"
      git diff --name-only --diff-filter=U > conflicts.txt

      # Auto-resolve or fail
      ./resolve-conflicts.sh || exit 1
    fi
```

### 6.5 Performance Optimization for CI/CD

**1. Reuse Worktrees Across Jobs (Advanced)**
```yaml
# Cache worktree directories between runs
- name: Restore worktree cache
  uses: actions/cache@v3
  with:
    path: ${{ runner.temp }}/worktrees
    key: worktrees-${{ github.sha }}
    restore-keys: worktrees-

- name: Create or reuse worktree
  run: |
    if [ -d "${WORKTREE_PATH}" ]; then
      echo "Reusing cached worktree"
      cd "${WORKTREE_PATH}"
      git checkout -B "${BRANCH_NAME}" HEAD
    else
      echo "Creating new worktree"
      git worktree add -b "${BRANCH_NAME}" "${WORKTREE_PATH}" HEAD
    fi
```

**2. Parallel Git Operations**
```bash
# Enable parallel fetch/checkout (Git 2.36+)
git config --global fetch.parallel 4
git config --global checkout.workers 4
```

**3. Minimize Git History**
```yaml
# For CI, don't need full history in worktrees
- name: Create shallow worktree
  run: |
    git worktree add --detach "${WORKTREE_PATH}"
    cd "${WORKTREE_PATH}"
    git checkout -b "${BRANCH_NAME}"
```

---

## 7. Monitoring and Debugging

### 7.1 Monitoring Active Worktrees

**Real-Time Dashboard Script:**
```bash
#!/bin/bash
# worktree-dashboard.sh
# Live monitoring of worktree status

watch -n 5 '
echo "=== Worktree Status Dashboard ==="
echo "Time: $(date)"
echo ""

echo "=== Active Worktrees ==="
git worktree list --porcelain | grep -E "^worktree|^branch" | \
    sed "s/worktree /🌳 /g" | sed "s/branch /  📍 /g"

echo ""
echo "=== Disk Usage ==="
du -sh /Users/iroselli/worktrees/* 2>/dev/null | sort -h | \
    awk "{print \"📊 \" \$2 \" - \" \$1}"

echo ""
echo "=== Active Processes ==="
ps aux | grep -E "agent-|sparc" | grep -v grep | \
    awk "{print \"🤖 \" \$11 \" (PID: \" \$2 \")\"}"

echo ""
echo "=== Recent Git Activity ==="
git log --oneline --all -5 | sed "s/^/📝 /"
'
```

**Structured Monitoring Data:**
```bash
#!/bin/bash
# collect-worktree-metrics.sh
# Export metrics in JSON for monitoring systems

METRICS_FILE="/var/log/worktree-metrics.json"

# Collect data
WORKTREE_COUNT=$(git worktree list | wc -l)
WORKTREE_COUNT=$((WORKTREE_COUNT - 1))  # Subtract main worktree

DISK_USAGE=$(du -sb /Users/iroselli/worktrees 2>/dev/null | awk '{print $1}')

ACTIVE_AGENTS=$(ps aux | grep -E "agent-|sparc" | grep -v grep | wc -l)

# Export as JSON
cat > "$METRICS_FILE" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "worktree_count": $WORKTREE_COUNT,
  "disk_usage_bytes": ${DISK_USAGE:-0},
  "active_agents": $ACTIVE_AGENTS,
  "worktrees": $(git worktree list --porcelain | jq -Rs '
    split("\n") |
    map(select(length > 0)) |
    reduce .[] as $line (
      {current: null, worktrees: []};
      if ($line | startswith("worktree ")) then
        .current = {path: ($line | sub("worktree "; ""))}
      elif ($line | startswith("branch ")) then
        .current.branch = ($line | sub("branch "; ""))
      elif ($line | startswith("HEAD ")) then
        .current.head = ($line | sub("HEAD "; ""))
        | .worktrees += [.current]
        | .current = null
      else . end
    ) | .worktrees
  ')
}
EOF

# Send to monitoring system (example: Prometheus pushgateway)
# curl -X POST -d @"$METRICS_FILE" http://pushgateway:9091/metrics/job/worktree-monitor
```

### 7.2 Debugging Worktree Issues

**Diagnostic Script:**
```bash
#!/bin/bash
# diagnose-worktree.sh
# Comprehensive worktree health check

echo "=== Worktree Diagnostics ==="
echo ""

# 1. Check Git version
echo "1. Git Version:"
git --version
echo ""

# 2. List all worktrees
echo "2. Registered Worktrees:"
git worktree list
echo ""

# 3. Check for orphaned worktrees
echo "3. Orphaned Worktrees (directory exists but not in git):"
for dir in /Users/iroselli/worktrees/*; do
    if [ -d "$dir" ]; then
        if ! git worktree list | grep -q "$dir"; then
            echo "  ⚠️  Orphaned: $dir"
        fi
    fi
done
echo ""

# 4. Check for missing worktrees
echo "4. Missing Worktrees (in git but directory gone):"
git worktree list | tail -n +2 | awk '{print $1}' | while read path; do
    if [ ! -d "$path" ]; then
        echo "  ⚠️  Missing: $path"
    fi
done
echo ""

# 5. Check for locked worktrees
echo "5. Locked Worktrees:"
for worktree in .git/worktrees/*; do
    if [ -f "$worktree/locked" ]; then
        echo "  🔒 Locked: $(basename $worktree)"
        cat "$worktree/locked"
    fi
done
echo ""

# 6. Check disk space
echo "6. Disk Space:"
df -h /Users/iroselli/worktrees
echo ""

# 7. Check for stale branches
echo "7. Stale Worktree Branches (not modified in 7 days):"
git for-each-ref --sort=-committerdate refs/heads/worktree/ \
    --format='%(committerdate:relative)|%(refname:short)' | \
    while IFS='|' read date branch; do
        if [[ "$date" == *"week"* ]] || [[ "$date" == *"month"* ]]; then
            echo "  ⏰ $branch - last commit: $date"
        fi
    done
echo ""

# 8. Check for git gc status
echo "8. Git GC Status:"
git config --get gc.worktreePruneExpire
echo ""

# 9. Check for file descriptor usage
echo "9. Open File Descriptors:"
lsof +D /Users/iroselli/worktrees 2>/dev/null | wc -l
echo ""

# 10. Check for common errors in git logs
echo "10. Recent Git Errors:"
git worktree list --porcelain 2>&1 | grep -i "error\|fatal\|warning" || echo "  ✅ No errors"
```

**Common Issues and Solutions:**

```bash
#!/bin/bash
# fix-worktree-issues.sh
# Automated fixes for common worktree problems

fix_orphaned_worktrees() {
    echo "Fixing orphaned worktrees..."

    # Find directories not registered with git
    for dir in /Users/iroselli/worktrees/*; do
        if [ -d "$dir" ]; then
            if ! git worktree list | grep -q "$dir"; then
                echo "  Removing orphaned: $dir"
                rm -rf "$dir"
            fi
        fi
    done
}

fix_missing_worktrees() {
    echo "Fixing missing worktrees..."

    # Prune references to non-existent worktrees
    git worktree prune
}

fix_locked_worktrees() {
    echo "Unlocking locked worktrees..."

    for worktree in .git/worktrees/*; do
        if [ -f "$worktree/locked" ]; then
            echo "  Unlocking: $(basename $worktree)"
            rm "$worktree/locked"
        fi
    done
}

fix_stale_branches() {
    echo "Removing stale worktree branches..."

    # Delete branches not modified in 30 days
    git for-each-ref --sort=-committerdate refs/heads/worktree/ \
        --format='%(committerdate:unix)|%(refname:short)' | \
        while IFS='|' read timestamp branch; do
            current_time=$(date +%s)
            age_days=$(( (current_time - timestamp) / 86400 ))

            if [ $age_days -gt 30 ]; then
                echo "  Deleting stale branch: $branch (${age_days} days old)"
                git branch -D "$branch"
            fi
        done
}

# Run all fixes
fix_orphaned_worktrees
fix_missing_worktrees
fix_locked_worktrees
fix_stale_branches

echo "✅ All fixes applied"
```

### 7.3 Logging and Tracing

**Enable Git Tracing for Worktrees:**
```bash
# Enable detailed git tracing
export GIT_TRACE=1
export GIT_TRACE_PERFORMANCE=1
export GIT_TRACE_SETUP=1

# Run worktree command with tracing
git worktree add /path/to/worktree -b branch 2>&1 | tee worktree-trace.log

# Analyze performance bottlenecks
grep -E "performance:|trace:" worktree-trace.log
```

**Structured Logging:**
```bash
#!/bin/bash
# log-worktree-operation.sh
# Log all worktree operations for auditing

LOG_FILE="/var/log/worktree-operations.log"

log_operation() {
    local operation="$1"
    local worktree="$2"
    local status="$3"
    local details="$4"

    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | $operation | $worktree | $status | $details" >> "$LOG_FILE"
}

# Usage examples
log_operation "CREATE" "/worktrees/agent-coder-123" "SUCCESS" "Branch: worktree/coder/task-1"
log_operation "REMOVE" "/worktrees/agent-coder-123" "SUCCESS" "Merged to master"
log_operation "PRUNE" "N/A" "SUCCESS" "Removed 3 stale references"
```

### 7.4 Performance Profiling

**Benchmark Worktree Operations:**
```bash
#!/bin/bash
# benchmark-worktrees.sh
# Measure performance of worktree operations

ITERATIONS=10

benchmark() {
    local operation="$1"
    local total_time=0

    for i in $(seq 1 $ITERATIONS); do
        start=$(date +%s%N)
        eval "$operation"
        end=$(date +%s%N)

        duration=$(( (end - start) / 1000000 ))  # Convert to milliseconds
        total_time=$(( total_time + duration ))
    done

    avg_time=$(( total_time / ITERATIONS ))
    echo "Average time: ${avg_time}ms"
}

echo "=== Worktree Performance Benchmark ==="
echo ""

echo "1. Creating worktree:"
benchmark "git worktree add /tmp/bench-wt-\$RANDOM -b bench-\$RANDOM HEAD >/dev/null 2>&1"

echo ""
echo "2. Listing worktrees:"
benchmark "git worktree list >/dev/null 2>&1"

echo ""
echo "3. Removing worktree:"
benchmark "git worktree remove /tmp/bench-wt-* --force >/dev/null 2>&1"

echo ""
echo "4. Pruning worktrees:"
benchmark "git worktree prune >/dev/null 2>&1"
```

### 7.5 Alert System

**Automated Alerts for Worktree Issues:**
```bash
#!/bin/bash
# worktree-alerts.sh
# Send alerts when worktree issues detected

ALERT_EMAIL="admin@example.com"
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

send_alert() {
    local severity="$1"  # INFO, WARNING, CRITICAL
    local message="$2"

    # Email alert
    echo "$message" | mail -s "[$severity] Worktree Alert" "$ALERT_EMAIL"

    # Slack alert
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"[$severity] $message\"}" \
        "$SLACK_WEBHOOK"
}

# Check for issues
WORKTREE_COUNT=$(git worktree list | wc -l)
DISK_USAGE=$(df /Users/iroselli/worktrees | tail -1 | awk '{print $5}' | sed 's/%//')

# Alert conditions
if [ $WORKTREE_COUNT -gt 50 ]; then
    send_alert "WARNING" "High worktree count: $WORKTREE_COUNT (threshold: 50)"
fi

if [ $DISK_USAGE -gt 90 ]; then
    send_alert "CRITICAL" "Disk usage critical: ${DISK_USAGE}% (threshold: 90%)"
fi

# Check for orphaned worktrees
ORPHANED=$(find /Users/iroselli/worktrees -type d -maxdepth 1 -mtime +7 | wc -l)
if [ $ORPHANED -gt 10 ]; then
    send_alert "WARNING" "Many orphaned worktrees: $ORPHANED (older than 7 days)"
fi
```

---

## 8. Multi-Agent Coordination Patterns

### 8.1 Pattern: Fan-Out/Fan-In

**Use Case:** Distribute work across agents, merge results.

```bash
#!/bin/bash
# fan-out-fan-in.sh
# Distribute task to multiple agents, merge results

TASK="Implement user management system"
AGENTS=("coder" "tester" "documenter")
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
WORKTREES=()

echo "=== Fan-Out Phase ==="

# Create worktrees for all agents
for agent in "${AGENTS[@]}"; do
    WORKTREE_PATH="/Users/iroselli/worktrees/agent-${agent}-${TIMESTAMP}"
    BRANCH_NAME="worktree/${agent}/${TIMESTAMP}"

    echo "Creating worktree for: $agent"
    git worktree add -b "${BRANCH_NAME}" "${WORKTREE_PATH}" master

    WORKTREES+=("$WORKTREE_PATH")

    # Spawn agent in background
    (
        cd "${WORKTREE_PATH}"
        npx claude-flow sparc run "$agent" "$TASK"
        git add .
        git commit -m "Agent $agent results" || true
    ) &
done

# Wait for all agents to complete
echo "Waiting for agents to complete..."
wait

echo ""
echo "=== Fan-In Phase ==="

# Merge all results
cd /Users/iroselli/wundr

for i in "${!AGENTS[@]}"; do
    agent="${AGENTS[$i]}"
    branch="worktree/${agent}/${TIMESTAMP}"

    echo "Merging results from: $agent"

    if git merge --no-ff "$branch" -m "Merge $agent results"; then
        echo "✅ Merged successfully: $agent"
    else
        echo "⚠️  Conflicts detected, resolving..."
        ./resolve-conflicts.sh "$branch"
        git commit -m "Merge $agent (resolved conflicts)"
    fi
done

# Cleanup
echo ""
echo "=== Cleanup Phase ==="

for worktree in "${WORKTREES[@]}"; do
    echo "Removing: $worktree"
    git worktree remove "$worktree"
done

git worktree prune

echo "✅ Fan-Out/Fan-In complete"
```

### 8.2 Pattern: Pipeline (Sequential with Handoff)

**Use Case:** Agent A → Agent B → Agent C (sequential dependencies).

```bash
#!/bin/bash
# pipeline.sh
# Sequential agent pipeline with worktree handoff

TASK="Implement authentication feature"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Stage 1: Architect
echo "=== Stage 1: Architecture ==="
ARCH_WORKTREE="/Users/iroselli/worktrees/architect-${TIMESTAMP}"
ARCH_BRANCH="worktree/architect/${TIMESTAMP}"

git worktree add -b "${ARCH_BRANCH}" "${ARCH_WORKTREE}" master

cd "${ARCH_WORKTREE}"
npx claude-flow sparc run architect "$TASK"
git add .
git commit -m "Architecture design"

# Merge architecture back to master
cd /Users/iroselli/wundr
git merge --no-ff "${ARCH_BRANCH}" -m "Architecture complete"
git worktree remove "${ARCH_WORKTREE}"

# Stage 2: Coder (uses architecture from master)
echo ""
echo "=== Stage 2: Implementation ==="
CODER_WORKTREE="/Users/iroselli/worktrees/coder-${TIMESTAMP}"
CODER_BRANCH="worktree/coder/${TIMESTAMP}"

git worktree add -b "${CODER_BRANCH}" "${CODER_WORKTREE}" master

cd "${CODER_WORKTREE}"
npx claude-flow sparc run coder "$TASK"
git add .
git commit -m "Implementation complete"

# Merge implementation back to master
cd /Users/iroselli/wundr
git merge --no-ff "${CODER_BRANCH}" -m "Implementation complete"
git worktree remove "${CODER_WORKTREE}"

# Stage 3: Tester (tests implementation from master)
echo ""
echo "=== Stage 3: Testing ==="
TESTER_WORKTREE="/Users/iroselli/worktrees/tester-${TIMESTAMP}"
TESTER_BRANCH="worktree/tester/${TIMESTAMP}"

git worktree add -b "${TESTER_BRANCH}" "${TESTER_WORKTREE}" master

cd "${TESTER_WORKTREE}"
npx claude-flow sparc run tester "$TASK"
git add .
git commit -m "Tests complete"

# Final merge
cd /Users/iroselli/wundr
git merge --no-ff "${TESTER_BRANCH}" -m "Testing complete"
git worktree remove "${TESTER_WORKTREE}"

echo "✅ Pipeline complete"
```

### 8.3 Pattern: Hierarchical (Coordinator + Workers)

**Use Case:** Coordinator agent spawns and manages worker agents.

```bash
#!/bin/bash
# hierarchical.sh
# Coordinator spawns worker agents in worktrees

TASK="Refactor codebase"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Coordinator worktree
COORD_WORKTREE="/Users/iroselli/worktrees/coordinator-${TIMESTAMP}"
COORD_BRANCH="worktree/coordinator/${TIMESTAMP}"

echo "=== Coordinator Phase ==="
git worktree add -b "${COORD_BRANCH}" "${COORD_WORKTREE}" master

cd "${COORD_WORKTREE}"

# Coordinator analyzes task and creates work plan
WORK_PLAN=$(npx claude-flow sparc run planner "$TASK" --output json)

# Extract subtasks (example: 4 modules to refactor)
SUBTASKS=$(echo "$WORK_PLAN" | jq -r '.subtasks[]')

echo "Coordinator identified subtasks:"
echo "$SUBTASKS"

# Spawn worker agents
WORKER_PIDS=()

for subtask in $SUBTASKS; do
    WORKER_WORKTREE="/Users/iroselli/worktrees/worker-${subtask}-${TIMESTAMP}"
    WORKER_BRANCH="worktree/worker/${subtask}-${TIMESTAMP}"

    echo "Spawning worker for: $subtask"

    # Create worker worktree from coordinator's state
    git worktree add -b "${WORKER_BRANCH}" "${WORKER_WORKTREE}" "${COORD_BRANCH}"

    # Run worker in background
    (
        cd "${WORKER_WORKTREE}"
        npx claude-flow sparc run coder "$subtask"
        git add .
        git commit -m "Worker: $subtask complete" || true
    ) &

    WORKER_PIDS+=($!)
done

# Wait for all workers
echo "Waiting for workers to complete..."
for pid in "${WORKER_PIDS[@]}"; do
    wait $pid
done

# Coordinator merges worker results
echo "Coordinator merging worker results..."
for subtask in $SUBTASKS; do
    WORKER_BRANCH="worktree/worker/${subtask}-${TIMESTAMP}"
    git merge --no-ff "$WORKER_BRANCH" -m "Merge worker: $subtask"
done

# Finalize coordinator work
git add .
git commit -m "Coordinator: All workers merged" || true

# Merge coordinator back to main
cd /Users/iroselli/wundr
git merge --no-ff "${COORD_BRANCH}" -m "Hierarchical workflow complete"

# Cleanup
echo "Cleaning up worktrees..."
git worktree remove "${COORD_WORKTREE}"

for subtask in $SUBTASKS; do
    git worktree remove "/Users/iroselli/worktrees/worker-${subtask}-${TIMESTAMP}"
done

git worktree prune

echo "✅ Hierarchical workflow complete"
```

### 8.4 Pattern: Competitive (Best-Of-N)

**Use Case:** Multiple agents try different approaches, select best result.

```bash
#!/bin/bash
# competitive.sh
# Run N agents with different approaches, pick best

TASK="Optimize database query performance"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
APPROACHES=("indexing" "caching" "query-rewrite" "denormalization")

echo "=== Competitive Phase: Spawning $${#APPROACHES[@]} agents ==="

WORKTREES=()
BRANCHES=()

for approach in "${APPROACHES[@]}"; do
    WORKTREE_PATH="/Users/iroselli/worktrees/approach-${approach}-${TIMESTAMP}"
    BRANCH_NAME="worktree/${approach}/${TIMESTAMP}"

    echo "Starting agent with approach: $approach"

    git worktree add -b "${BRANCH_NAME}" "${WORKTREE_PATH}" master

    WORKTREES+=("$WORKTREE_PATH")
    BRANCHES+=("$BRANCH_NAME")

    # Run agent in background
    (
        cd "${WORKTREE_PATH}"
        npx claude-flow sparc run coder "$TASK --approach $approach"

        # Run performance benchmark
        npm run benchmark > "/tmp/benchmark-${approach}.txt"

        git add .
        git commit -m "Approach: $approach" || true
    ) &
done

# Wait for all agents
echo "Waiting for all approaches to complete..."
wait

echo ""
echo "=== Evaluation Phase ==="

# Compare benchmark results
BEST_APPROACH=""
BEST_SCORE=0

for approach in "${APPROACHES[@]}"; do
    SCORE=$(grep "Total time:" "/tmp/benchmark-${approach}.txt" | awk '{print $3}')

    echo "Approach: $approach - Score: $SCORE"

    # Lower score is better (assuming time-based metric)
    if [ -z "$BEST_APPROACH" ] || (( $(echo "$SCORE < $BEST_SCORE" | bc -l) )); then
        BEST_APPROACH="$approach"
        BEST_SCORE="$SCORE"
    fi
done

echo ""
echo "🏆 Winner: $BEST_APPROACH (Score: $BEST_SCORE)"

# Merge winning approach
echo ""
echo "=== Merge Phase ==="

WINNING_BRANCH="worktree/${BEST_APPROACH}/${TIMESTAMP}"

cd /Users/iroselli/wundr
git merge --no-ff "$WINNING_BRANCH" -m "Merge winning approach: $BEST_APPROACH"

# Cleanup all worktrees (winners and losers)
echo ""
echo "=== Cleanup Phase ==="

for worktree in "${WORKTREES[@]}"; do
    echo "Removing: $worktree"
    git worktree remove "$worktree"
done

# Delete losing branches
for i in "${!APPROACHES[@]}"; do
    approach="${APPROACHES[$i]}"
    if [ "$approach" != "$BEST_APPROACH" ]; then
        git branch -D "worktree/${approach}/${TIMESTAMP}"
    fi
done

git worktree prune

echo "✅ Competitive workflow complete"
```

---

## 9. Implementation Checklist

### 9.1 Pre-Implementation

- [ ] Verify Git version >= 2.37 (`git --version`)
- [ ] Confirm filesystem type (APFS/ext4/XFS preferred)
- [ ] Ensure worktree directory is outside cloud-synced folders
- [ ] Check available disk space (estimate: main repo size × expected worktrees)
- [ ] Review team's multi-agent architecture requirements
- [ ] Document expected worktree lifecycle (creation → work → merge → cleanup)

### 9.2 Configuration

- [ ] Apply performance optimizations:
  ```bash
  git config core.untrackedCache true
  git config core.fsmonitor true
  git config checkout.workers 0
  git config fetch.parallel 0
  ```
- [ ] Configure GC settings:
  ```bash
  git config gc.worktreePruneExpire "7.days.ago"
  git config gc.auto 1000
  ```
- [ ] Set up worktree naming conventions (document in team wiki)
- [ ] Create worktree directory structure:
  ```bash
  mkdir -p /Users/iroselli/worktrees
  ```

### 9.3 Automation Scripts

- [ ] Implement worktree creation wrapper (`create-agent-worktree.sh`)
- [ ] Implement cleanup script (`cleanup-stale-worktrees.sh`)
- [ ] Implement conflict resolution script (`resolve-conflicts.sh`)
- [ ] Implement monitoring dashboard (`worktree-dashboard.sh`)
- [ ] Schedule automated cleanup (cron/launchd)
- [ ] Set up logging for all worktree operations

### 9.4 CI/CD Integration

- [ ] Update CI/CD pipelines to use worktrees for parallel jobs
- [ ] Implement worktree cleanup in `always` / `after_script` sections
- [ ] Configure merge conflict handling in pipelines
- [ ] Set maximum parallel worktrees limit
- [ ] Test pipeline with multiple concurrent agents

### 9.5 Monitoring & Alerting

- [ ] Set up disk usage monitoring
- [ ] Create alerts for high worktree count (> 50)
- [ ] Create alerts for disk usage (> 90%)
- [ ] Implement metrics collection (Prometheus/Grafana)
- [ ] Set up Slack/email notifications for failures

### 9.6 Documentation

- [ ] Document worktree workflows in team wiki
- [ ] Create troubleshooting guide for common issues
- [ ] Document naming conventions and standards
- [ ] Create runbook for emergency cleanup procedures
- [ ] Train team on worktree best practices

### 9.7 Testing

- [ ] Test worktree creation with 1, 5, 10, 20 agents
- [ ] Test merge conflict scenarios
- [ ] Test cleanup scripts with orphaned worktrees
- [ ] Test failure scenarios (disk full, agent crash, etc.)
- [ ] Benchmark performance vs. traditional branching
- [ ] Verify CI/CD integration end-to-end

### 9.8 Production Rollout

- [ ] Start with 1-2 agent types using worktrees
- [ ] Monitor for 1 week, collect metrics
- [ ] Gradually increase to 5 agents
- [ ] Monitor for 1 month, refine scripts
- [ ] Full rollout to all agents
- [ ] Continuous monitoring and optimization

---

## 10. References and Resources

### Official Documentation
- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Git 2.5 Release Notes (Worktree Introduction)](https://github.blog/open-source/git/git-2-5-including-multiple-worktrees-and-triangular-workflows/)

### Performance Research (2024)
- [Git Worktree Performance Impact - Stack Overflow](https://stackoverflow.com/questions/71339338/git-worktree-performance-impact)
- [Parallel Git Checkout Optimization](https://matheustavares.dev/posts/parallel-checkout)

### Best Practices Guides
- [Git Worktree Best Practices and Tools](https://gist.github.com/ChristopherA/4643b2f5e024578606b9cd5d2e6815cc)
- [Mastering Git Worktree (2024)](https://mskadu.medium.com/mastering-git-worktree-a-developers-guide-to-multiple-working-directories-c30f834f79a5)

### Wundr-Specific Documentation
- `/Users/iroselli/wundr/docs/git-worktree-section.md` - Original worktree integration guide
- `/Users/iroselli/wundr/CLAUDE.md` - SPARC development environment configuration

### Tools and Utilities
- [gwq - Git Worktree Manager with Fuzzy Finder](https://github.com/d-kuro/gwq)
- [agenttools/worktree - CLI tool for managing Git worktrees](https://github.com/agenttools/worktree)

---

## Conclusion

Git worktrees provide a robust foundation for multi-agent automation when properly configured and managed. Key takeaways:

1. **Performance:** Minimal overhead with proper configuration (Git 2.37+, optimized settings)
2. **Cleanup:** Automated cleanup is critical for long-running systems
3. **Conflicts:** Preventable with proper naming and mergeable with automated strategies
4. **Edge Cases:** Know when NOT to use worktrees (single agent, read-only, cloud sync)
5. **CI/CD:** Excellent for parallel testing, requires careful resource management
6. **Monitoring:** Essential for production deployments, prevents resource exhaustion

**Recommended Limits:**
- Maximum concurrent worktrees: 20 per machine
- Cleanup frequency: Every 6 hours
- Stale worktree threshold: 24 hours
- Disk usage alert threshold: 90%

**Next Steps:**
1. Implement automated cleanup scripts
2. Configure monitoring and alerting
3. Test with small number of agents (1-5)
4. Gradually scale to production workloads
5. Continuously refine based on metrics

For questions or issues, refer to the troubleshooting section or consult the Wundr development team.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-21
**Maintained By:** Wundr Research Team
**Status:** Production Ready
