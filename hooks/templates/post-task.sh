#!/usr/bin/env bash
################################################################################
# POST-TASK HOOK TEMPLATE
# Executes after task completion
#
# Purpose:
# - Validate task completion
# - Update memory with results
# - Train neural patterns
# - Cleanup resources
# - Generate task summary
# - Merge worktree changes
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_CONFIG="${HOOKS_CONFIG:-$PROJECT_ROOT/.claude/hooks.config.json}"
LOG_FILE="${LOG_FILE:-$PROJECT_ROOT/.claude/logs/post-task-$(date +%Y%m%d-%H%M%S).log}"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging functions
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $*" | tee -a "$LOG_FILE"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" | tee -a "$LOG_FILE" >&2
}

warn() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] $*" | tee -a "$LOG_FILE"
}

success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $*" | tee -a "$LOG_FILE"
}

# Parse arguments
TASK_ID="${1:-}"
SESSION_ID="${2:-}"
STATUS="${3:-completed}"
RESULTS_FILE="${4:-}"

if [[ -z "$TASK_ID" ]]; then
    error "Task ID is required"
    echo "Usage: $0 <task_id> [session_id] [status] [results_file]"
    exit 1
fi

log "=== POST-TASK HOOK STARTED ==="
log "Task ID: $TASK_ID"
log "Session ID: $SESSION_ID"
log "Status: $STATUS"

################################################################################
# 1. Task Validation
################################################################################

validate_task() {
    log "Validating task completion..."

    local task_dir="$PROJECT_ROOT/.claude/tasks/$TASK_ID"

    if [[ ! -d "$task_dir" ]]; then
        error "Task directory not found: $task_dir"
        exit 1
    fi

    # Load task metadata
    if [[ -f "$task_dir/metadata.json" ]]; then
        local start_time=$(jq -r '.startTime' "$task_dir/metadata.json" 2>/dev/null || echo "unknown")
        local end_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
        log "Task started: $start_time"
        log "Task ended: $end_time"
    fi
}

################################################################################
# 2. Results Collection
################################################################################

collect_results() {
    log "Collecting task results..."

    local task_dir="$PROJECT_ROOT/.claude/tasks/$TASK_ID"
    local results_path="$task_dir/results.json"

    # Collect file changes
    local files_changed=0
    if git -C "$PROJECT_ROOT" rev-parse --git-dir &> /dev/null; then
        files_changed=$(git -C "$PROJECT_ROOT" diff --name-only | wc -l)
        git -C "$PROJECT_ROOT" diff --stat > "$task_dir/artifacts/git-diff.txt" 2>&1 || true
    fi

    # Collect metrics
    local memory_usage=$(npx claude-flow@alpha hooks memory-usage 2>/dev/null || echo "{}")

    # Create results summary
    cat > "$results_path" <<EOF
{
  "taskId": "$TASK_ID",
  "sessionId": "$SESSION_ID",
  "status": "$STATUS",
  "completedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "filesChanged": $files_changed,
  "memoryUsage": $memory_usage,
  "resultsFile": "$RESULTS_FILE"
}
EOF

    log "Results collected: $results_path"
}

################################################################################
# 3. Memory Update
################################################################################

update_memory() {
    log "Updating swarm memory..."

    local memory_key="swarm/${SESSION_ID}/${TASK_ID}"
    local task_dir="$PROJECT_ROOT/.claude/tasks/$TASK_ID"

    # Store task completion
    npx claude-flow@alpha hooks memory-store \
        --key "$memory_key/completion" \
        --value "{\"status\":\"$STATUS\",\"completedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
        2>&1 | tee -a "$LOG_FILE" || {
        warn "Failed to update memory"
    }

    # Store results if available
    if [[ -f "$task_dir/results.json" ]]; then
        npx claude-flow@alpha hooks memory-store \
            --key "$memory_key/results" \
            --file "$task_dir/results.json" \
            2>&1 | tee -a "$LOG_FILE" || {
            warn "Failed to store results in memory"
        }
    fi
}

################################################################################
# 4. Neural Pattern Training
################################################################################

train_patterns() {
    log "Training neural patterns..."

    if [[ "$STATUS" != "completed" ]]; then
        warn "Skipping pattern training for non-completed task"
        return 0
    fi

    local task_dir="$PROJECT_ROOT/.claude/tasks/$TASK_ID"

    # Extract patterns from successful task
    if [[ -f "$task_dir/results.json" ]]; then
        npx claude-flow@alpha hooks neural-train \
            --pattern-type "task-completion" \
            --input "$task_dir/results.json" \
            --auto-learn true \
            2>&1 | tee -a "$LOG_FILE" || {
            warn "Neural training failed"
        }
    fi
}

################################################################################
# 5. Worktree Cleanup
################################################################################

cleanup_worktree() {
    log "Cleaning up worktree..."

    if ! git -C "$PROJECT_ROOT" rev-parse --git-dir &> /dev/null; then
        log "Not a git repository, skipping worktree cleanup"
        return 0
    fi

    local branch_name="task/${TASK_ID}"
    local worktree_path="$PROJECT_ROOT/.worktrees/$branch_name"

    if [[ ! -d "$worktree_path" ]]; then
        log "No worktree to cleanup"
        return 0
    fi

    # Merge changes if task completed successfully
    if [[ "$STATUS" == "completed" ]]; then
        log "Merging worktree changes..."

        cd "$worktree_path"

        # Commit any pending changes
        if [[ -n $(git status --porcelain) ]]; then
            git add .
            git commit -m "Task $TASK_ID: Auto-commit from post-task hook" || true
        fi

        # Switch back to main branch and merge
        cd "$PROJECT_ROOT"
        local current_branch=$(git symbolic-ref --short HEAD)

        if git merge --no-ff "$branch_name" -m "Merge task/$TASK_ID: Completed successfully" 2>&1 | tee -a "$LOG_FILE"; then
            success "Merged worktree changes"
        else
            error "Failed to merge worktree"
            return 1
        fi
    fi

    # Remove worktree
    if git worktree remove "$worktree_path" --force 2>&1 | tee -a "$LOG_FILE"; then
        log "Removed worktree: $worktree_path"
    else
        warn "Failed to remove worktree"
    fi

    # Delete branch if task completed
    if [[ "$STATUS" == "completed" ]]; then
        git branch -d "$branch_name" 2>&1 | tee -a "$LOG_FILE" || warn "Failed to delete branch"
    fi

    # Clear current worktree marker
    rm -f "$PROJECT_ROOT/.claude/current-worktree"
}

################################################################################
# 6. Performance Analysis
################################################################################

analyze_performance() {
    log "Analyzing task performance..."

    local task_dir="$PROJECT_ROOT/.claude/tasks/$TASK_ID"

    # Calculate duration
    if [[ -f "$task_dir/metadata.json" ]]; then
        local start_time=$(jq -r '.startTime' "$task_dir/metadata.json" 2>/dev/null)
        local end_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

        # Store performance metrics
        cat > "$task_dir/performance.json" <<EOF
{
  "startTime": "$start_time",
  "endTime": "$end_time",
  "status": "$STATUS"
}
EOF
    fi

    # Get swarm metrics
    npx claude-flow@alpha hooks agent-metrics \
        --session-id "$SESSION_ID" \
        --output "$task_dir/swarm-metrics.json" \
        2>&1 | tee -a "$LOG_FILE" || {
        warn "Failed to collect swarm metrics"
    }
}

################################################################################
# 7. Generate Summary
################################################################################

generate_summary() {
    log "Generating task summary..."

    local task_dir="$PROJECT_ROOT/.claude/tasks/$TASK_ID"
    local summary_file="$task_dir/SUMMARY.md"

    # Load metadata
    local description="Unknown"
    local agent_type="Unknown"
    if [[ -f "$task_dir/metadata.json" ]]; then
        description=$(jq -r '.description' "$task_dir/metadata.json" 2>/dev/null || echo "Unknown")
        agent_type=$(jq -r '.agentType' "$task_dir/metadata.json" 2>/dev/null || echo "Unknown")
    fi

    # Create summary
    cat > "$summary_file" <<EOF
# Task Summary: $TASK_ID

## Overview
- **Status**: $STATUS
- **Agent**: $agent_type
- **Completed**: $(date)

## Task Description
$description

## Results
EOF

    if [[ -f "$task_dir/results.json" ]]; then
        echo '```json' >> "$summary_file"
        jq '.' "$task_dir/results.json" >> "$summary_file" 2>/dev/null || true
        echo '```' >> "$summary_file"
    fi

    # Add file changes
    if [[ -f "$task_dir/artifacts/git-diff.txt" ]]; then
        echo "" >> "$summary_file"
        echo "## Changed Files" >> "$summary_file"
        echo '```' >> "$summary_file"
        cat "$task_dir/artifacts/git-diff.txt" >> "$summary_file"
        echo '```' >> "$summary_file"
    fi

    log "Summary generated: $summary_file"
}

################################################################################
# 8. Cleanup and Finalization
################################################################################

finalize_task() {
    log "Finalizing task..."

    local task_dir="$PROJECT_ROOT/.claude/tasks/$TASK_ID"

    # Update metadata with completion status
    if [[ -f "$task_dir/metadata.json" ]]; then
        jq --arg status "$STATUS" --arg time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            '.status = $status | .endTime = $time' \
            "$task_dir/metadata.json" > "$task_dir/metadata.json.tmp" && \
            mv "$task_dir/metadata.json.tmp" "$task_dir/metadata.json"
    fi

    # Remove task lock
    rm -f "$PROJECT_ROOT/.claude/task.lock"

    # Archive task if configured
    if [[ -f "$HOOKS_CONFIG" ]] && [[ $(jq -r '.archiveTasks // true' "$HOOKS_CONFIG") == "true" ]]; then
        local archive_dir="$PROJECT_ROOT/.claude/archive/tasks"
        mkdir -p "$archive_dir"

        if tar -czf "$archive_dir/${TASK_ID}.tar.gz" -C "$PROJECT_ROOT/.claude/tasks" "$TASK_ID" 2>&1 | tee -a "$LOG_FILE"; then
            log "Task archived: $archive_dir/${TASK_ID}.tar.gz"
        fi
    fi
}

################################################################################
# 9. Notification
################################################################################

send_notification() {
    log "Sending completion notification..."

    npx claude-flow@alpha hooks notify \
        --message "Task $TASK_ID completed with status: $STATUS" \
        --level "info" \
        --session-id "$SESSION_ID" \
        2>&1 | tee -a "$LOG_FILE" || {
        warn "Failed to send notification"
    }
}

################################################################################
# Main Execution
################################################################################

main() {
    # Execute all post-task steps
    validate_task
    collect_results
    update_memory
    train_patterns
    analyze_performance
    generate_summary
    cleanup_worktree
    finalize_task
    send_notification

    log "=== POST-TASK HOOK COMPLETED SUCCESSFULLY ==="

    # Output summary
    local task_dir="$PROJECT_ROOT/.claude/tasks/$TASK_ID"
    if [[ -f "$task_dir/SUMMARY.md" ]]; then
        echo ""
        cat "$task_dir/SUMMARY.md"
    fi

    success "Task $TASK_ID finished: $STATUS"

    exit 0
}

# Error handler
trap 'error "Post-task hook failed at line $LINENO"; exit 1' ERR

# Run main function
main "$@"
