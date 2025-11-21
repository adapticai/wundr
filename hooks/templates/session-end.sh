#!/usr/bin/env bash
################################################################################
# SESSION-END HOOK TEMPLATE
# Executes when ending a session
#
# Purpose:
# - Generate session summary
# - Export metrics and analytics
# - Save memory snapshots
# - Cleanup temporary resources
# - Archive session data
# - Shutdown swarm gracefully
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_CONFIG="${HOOKS_CONFIG:-$PROJECT_ROOT/.claude/hooks.config.json}"
LOG_FILE="${LOG_FILE:-$PROJECT_ROOT/.claude/logs/session-end-$(date +%Y%m%d-%H%M%S).log}"

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
SESSION_ID="${1:-session-$(date +%s)}"
EXPORT_METRICS="${2:-true}"
ARCHIVE_SESSION="${3:-true}"
CLEANUP_WORKTREES="${4:-true}"

log "=== SESSION-END HOOK STARTED ==="
log "Session ID: $SESSION_ID"
log "Export Metrics: $EXPORT_METRICS"
log "Archive Session: $ARCHIVE_SESSION"
log "Cleanup Worktrees: $CLEANUP_WORKTREES"

################################################################################
# 1. Session Validation
################################################################################

validate_session() {
    log "Validating session..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    mkdir -p "$session_dir"

    if [[ ! -f "$session_dir/metadata.json" ]]; then
        warn "No existing session metadata, creating new"
        cat > "$session_dir/metadata.json" <<EOF
{
  "sessionId": "$SESSION_ID",
  "startTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "ending"
}
EOF
    fi
}

################################################################################
# 2. Collect Final Metrics
################################################################################

collect_metrics() {
    log "Collecting final session metrics..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local metrics_file="$session_dir/metrics.json"

    # Get swarm metrics
    local agent_metrics=$(npx claude-flow@alpha hooks agent-metrics --session-id "$SESSION_ID" 2>/dev/null || echo "{}")
    local memory_usage=$(npx claude-flow@alpha hooks memory-usage 2>/dev/null || echo "{}")

    # Collect task statistics
    local total_tasks=0
    local completed_tasks=0
    local failed_tasks=0

    if [[ -d "$PROJECT_ROOT/.claude/tasks" ]]; then
        total_tasks=$(find "$PROJECT_ROOT/.claude/tasks" -name "metadata.json" | wc -l)
        completed_tasks=$(find "$PROJECT_ROOT/.claude/tasks" -name "metadata.json" -exec jq -r 'select(.status == "completed") | .taskId' {} \; | wc -l)
        failed_tasks=$(find "$PROJECT_ROOT/.claude/tasks" -name "metadata.json" -exec jq -r 'select(.status == "failed") | .taskId' {} \; | wc -l)
    fi

    # Create comprehensive metrics
    cat > "$metrics_file" <<EOF
{
  "sessionId": "$SESSION_ID",
  "endTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "tasks": {
    "total": $total_tasks,
    "completed": $completed_tasks,
    "failed": $failed_tasks,
    "successRate": $(echo "scale=2; $completed_tasks * 100 / ($total_tasks + 0.01)" | bc)
  },
  "agentMetrics": $agent_metrics,
  "memoryUsage": $memory_usage
}
EOF

    log "Metrics collected: $metrics_file"
}

################################################################################
# 3. Save Memory Snapshot
################################################################################

save_memory() {
    log "Saving memory snapshot..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local memory_snapshot="$session_dir/memory-snapshot.json"

    # Export memory state
    npx claude-flow@alpha hooks memory-export \
        --session-id "$SESSION_ID" \
        --output "$memory_snapshot" \
        2>&1 | tee -a "$LOG_FILE" || {
        warn "Failed to export memory snapshot"
    }

    if [[ -f "$memory_snapshot" ]]; then
        local memory_size=$(stat -f %z "$memory_snapshot" 2>/dev/null || stat -c %s "$memory_snapshot")
        log "Memory snapshot saved: ${memory_size} bytes"
    fi
}

################################################################################
# 4. Save Swarm Topology
################################################################################

save_topology() {
    log "Saving swarm topology..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local topology_file="$session_dir/topology.json"

    # Get current topology
    npx claude-flow@alpha hooks swarm-status \
        --session-id "$SESSION_ID" \
        --output "$topology_file" \
        2>&1 | tee -a "$LOG_FILE" || {
        warn "Failed to save topology"
    }
}

################################################################################
# 5. Save Neural Patterns
################################################################################

save_patterns() {
    log "Saving neural patterns..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local patterns_file="$session_dir/neural-patterns.json"

    # Export neural patterns
    npx claude-flow@alpha hooks neural-export \
        --session-id "$SESSION_ID" \
        --output "$patterns_file" \
        2>&1 | tee -a "$LOG_FILE" || {
        warn "Failed to export neural patterns"
    }
}

################################################################################
# 6. Generate Session Summary
################################################################################

generate_summary() {
    log "Generating session summary..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local summary_file="$session_dir/SUMMARY.md"

    # Load metadata
    local start_time="Unknown"
    local end_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    if [[ -f "$session_dir/metadata.json" ]]; then
        start_time=$(jq -r '.startTime // "Unknown"' "$session_dir/metadata.json")
    fi

    # Calculate duration
    local duration="Unknown"
    if [[ "$start_time" != "Unknown" ]]; then
        local start_seconds=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$start_time" +%s 2>/dev/null || echo 0)
        local end_seconds=$(date +%s)
        local duration_seconds=$((end_seconds - start_seconds))
        duration="${duration_seconds}s"
    fi

    # Load metrics
    local total_tasks=0
    local completed_tasks=0
    local success_rate=0

    if [[ -f "$session_dir/metrics.json" ]]; then
        total_tasks=$(jq -r '.tasks.total // 0' "$session_dir/metrics.json")
        completed_tasks=$(jq -r '.tasks.completed // 0' "$session_dir/metrics.json")
        success_rate=$(jq -r '.tasks.successRate // 0' "$session_dir/metrics.json")
    fi

    # Create summary
    cat > "$summary_file" <<EOF
# Session Summary: $SESSION_ID

## Overview
- **Session ID**: $SESSION_ID
- **Started**: $start_time
- **Ended**: $end_time
- **Duration**: $duration

## Statistics
- **Total Tasks**: $total_tasks
- **Completed Tasks**: $completed_tasks
- **Success Rate**: ${success_rate}%

## Metrics
EOF

    if [[ -f "$session_dir/metrics.json" ]]; then
        echo '```json' >> "$summary_file"
        jq '.' "$session_dir/metrics.json" >> "$summary_file" 2>/dev/null || true
        echo '```' >> "$summary_file"
    fi

    # Add task list
    echo "" >> "$summary_file"
    echo "## Tasks Completed" >> "$summary_file"

    if [[ -d "$PROJECT_ROOT/.claude/tasks" ]]; then
        find "$PROJECT_ROOT/.claude/tasks" -name "metadata.json" -exec jq -r 'select(.sessionId == "'$SESSION_ID'") | "- [\(.status)] \(.description)"' {} \; >> "$summary_file" 2>/dev/null || true
    fi

    # Add file changes
    if git -C "$PROJECT_ROOT" rev-parse --git-dir &> /dev/null; then
        echo "" >> "$summary_file"
        echo "## Repository Changes" >> "$summary_file"
        echo '```' >> "$summary_file"
        git -C "$PROJECT_ROOT" diff --stat >> "$summary_file" 2>/dev/null || true
        echo '```' >> "$summary_file"
    fi

    log "Summary generated: $summary_file"
}

################################################################################
# 7. Cleanup Worktrees
################################################################################

cleanup_worktrees() {
    if [[ "$CLEANUP_WORKTREES" != "true" ]]; then
        log "Worktree cleanup skipped"
        return 0
    fi

    log "Cleaning up worktrees..."

    if ! git -C "$PROJECT_ROOT" rev-parse --git-dir &> /dev/null; then
        log "Not a git repository, skipping worktree cleanup"
        return 0
    fi

    local worktrees_dir="$PROJECT_ROOT/.worktrees"

    if [[ ! -d "$worktrees_dir" ]]; then
        log "No worktrees directory found"
        return 0
    fi

    # List and remove worktrees
    local removed=0
    git worktree list | grep "$worktrees_dir" | awk '{print $1}' | while read -r worktree_path; do
        if git worktree remove "$worktree_path" --force 2>&1 | tee -a "$LOG_FILE"; then
            log "Removed worktree: $worktree_path"
            ((removed++)) || true
        else
            warn "Failed to remove worktree: $worktree_path"
        fi
    done

    log "Cleaned up worktrees"
}

################################################################################
# 8. Export Analytics
################################################################################

export_analytics() {
    if [[ "$EXPORT_METRICS" != "true" ]]; then
        log "Analytics export skipped"
        return 0
    fi

    log "Exporting analytics..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local analytics_dir="$session_dir/analytics"
    mkdir -p "$analytics_dir"

    # Export task performance data
    if [[ -d "$PROJECT_ROOT/.claude/tasks" ]]; then
        find "$PROJECT_ROOT/.claude/tasks" -name "performance.json" -exec cp {} "$analytics_dir/" \; 2>/dev/null || true
    fi

    # Generate analytics summary
    cat > "$analytics_dir/summary.json" <<EOF
{
  "sessionId": "$SESSION_ID",
  "exportedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "analytics": {
    "exported": true
  }
}
EOF

    log "Analytics exported to: $analytics_dir"
}

################################################################################
# 9. Archive Session
################################################################################

archive_session() {
    if [[ "$ARCHIVE_SESSION" != "true" ]]; then
        log "Session archival skipped"
        return 0
    fi

    log "Archiving session..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local archive_dir="$PROJECT_ROOT/.claude/archive/sessions"
    mkdir -p "$archive_dir"

    local archive_file="$archive_dir/${SESSION_ID}.tar.gz"

    if tar -czf "$archive_file" -C "$PROJECT_ROOT/.claude/sessions" "$SESSION_ID" 2>&1 | tee -a "$LOG_FILE"; then
        local archive_size=$(stat -f %z "$archive_file" 2>/dev/null || stat -c %s "$archive_file")
        success "Session archived: $archive_file (${archive_size} bytes)"
    else
        error "Failed to archive session"
    fi
}

################################################################################
# 10. Cleanup Temporary Files
################################################################################

cleanup_temp() {
    log "Cleaning up temporary files..."

    # Remove lock files
    rm -f "$PROJECT_ROOT/.claude/task.lock"
    rm -f "$PROJECT_ROOT/.claude/current-worktree"

    # Clean up old lock files
    if [[ -d "$PROJECT_ROOT/.claude/locks" ]]; then
        find "$PROJECT_ROOT/.claude/locks" -name "*.lock" -mtime +1 -delete 2>/dev/null || true
    fi

    # Clean up old backups (keep last 7 days)
    if [[ -d "$PROJECT_ROOT/.claude/backups" ]]; then
        find "$PROJECT_ROOT/.claude/backups" -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
    fi

    # Clean up old logs (keep last 30 days)
    if [[ -d "$PROJECT_ROOT/.claude/logs" ]]; then
        find "$PROJECT_ROOT/.claude/logs" -name "*.log" -mtime +30 -delete 2>/dev/null || true
    fi

    log "Temporary files cleaned"
}

################################################################################
# 11. Shutdown Swarm
################################################################################

shutdown_swarm() {
    log "Shutting down swarm..."

    npx claude-flow@alpha hooks swarm-shutdown \
        --session-id "$SESSION_ID" \
        --graceful true \
        2>&1 | tee -a "$LOG_FILE" || {
        warn "Failed to shutdown swarm gracefully"
    }
}

################################################################################
# 12. Update Session Status
################################################################################

finalize_session() {
    log "Finalizing session..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"

    if [[ -f "$session_dir/metadata.json" ]]; then
        jq --arg time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            '.endTime = $time | .status = "ended"' \
            "$session_dir/metadata.json" > "$session_dir/metadata.json.tmp" && \
            mv "$session_dir/metadata.json.tmp" "$session_dir/metadata.json"
    fi

    # Save environment snapshot
    cat > "$session_dir/environment.json" <<EOF
{
  "nodeVersion": "$(node --version 2>/dev/null || echo "unknown")",
  "npmVersion": "$(npm --version 2>/dev/null || echo "unknown")",
  "platform": "$(uname -s)",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
}

################################################################################
# Main Execution
################################################################################

main() {
    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"

    # Execute all session-end steps
    validate_session
    collect_metrics
    save_memory
    save_topology
    save_patterns
    generate_summary
    export_analytics
    cleanup_worktrees
    cleanup_temp
    shutdown_swarm
    finalize_session
    archive_session

    log "=== SESSION-END HOOK COMPLETED SUCCESSFULLY ==="

    # Display summary
    if [[ -f "$session_dir/SUMMARY.md" ]]; then
        echo ""
        cat "$session_dir/SUMMARY.md"
    fi

    success "Session $SESSION_ID ended successfully"
    log "Session data: $session_dir"

    exit 0
}

# Error handler
trap 'error "Session-end hook failed at line $LINENO"; exit 1' ERR

# Run main function
main "$@"
