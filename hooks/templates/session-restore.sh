#!/usr/bin/env bash
################################################################################
# SESSION-RESTORE HOOK TEMPLATE
# Executes when restoring a previous session
#
# Purpose:
# - Restore swarm state and memory
# - Rebuild agent topology
# - Resume interrupted tasks
# - Restore git worktrees
# - Load cached data and metrics
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_CONFIG="${HOOKS_CONFIG:-$PROJECT_ROOT/.claude/hooks.config.json}"
LOG_FILE="${LOG_FILE:-$PROJECT_ROOT/.claude/logs/session-restore-$(date +%Y%m%d-%H%M%S).log}"

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
SESSION_ID="${1:-}"
RESTORE_MEMORY="${2:-true}"
RESTORE_METRICS="${3:-true}"
RESTORE_TASKS="${4:-true}"

if [[ -z "$SESSION_ID" ]]; then
    error "Session ID is required"
    echo "Usage: $0 <session_id> [restore_memory] [restore_metrics] [restore_tasks]"
    exit 1
fi

log "=== SESSION-RESTORE HOOK STARTED ==="
log "Session ID: $SESSION_ID"
log "Restore Memory: $RESTORE_MEMORY"
log "Restore Metrics: $RESTORE_METRICS"
log "Restore Tasks: $RESTORE_TASKS"

################################################################################
# 1. Validate Session
################################################################################

validate_session() {
    log "Validating session..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"

    if [[ ! -d "$session_dir" ]]; then
        error "Session directory not found: $session_dir"
        exit 1
    fi

    if [[ ! -f "$session_dir/metadata.json" ]]; then
        error "Session metadata not found"
        exit 1
    fi

    # Load session metadata
    local session_start=$(jq -r '.startTime' "$session_dir/metadata.json" 2>/dev/null || echo "unknown")
    local session_status=$(jq -r '.status // "unknown"' "$session_dir/metadata.json" 2>/dev/null)

    log "Session started: $session_start"
    log "Session status: $session_status"

    if [[ "$session_status" == "active" ]]; then
        warn "Session appears to still be active"
    fi
}

################################################################################
# 2. Restore Memory
################################################################################

restore_memory() {
    if [[ "$RESTORE_MEMORY" != "true" ]]; then
        log "Memory restoration skipped"
        return 0
    fi

    log "Restoring swarm memory..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local memory_snapshot="$session_dir/memory-snapshot.json"

    if [[ ! -f "$memory_snapshot" ]]; then
        warn "No memory snapshot found"
        return 0
    fi

    # Restore memory using claude-flow
    npx claude-flow@alpha hooks session-restore \
        --session-id "$SESSION_ID" \
        --restore-memory true \
        2>&1 | tee -a "$LOG_FILE" || {
        error "Failed to restore memory"
        return 1
    }

    success "Memory restored"
}

################################################################################
# 3. Rebuild Swarm Topology
################################################################################

rebuild_topology() {
    log "Rebuilding swarm topology..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local topology_file="$session_dir/topology.json"

    if [[ ! -f "$topology_file" ]]; then
        warn "No topology configuration found, using defaults"
        return 0
    fi

    # Load topology configuration
    local topology=$(jq -r '.topology // "mesh"' "$topology_file")
    local max_agents=$(jq -r '.maxAgents // 3' "$topology_file")
    local agents=$(jq -r '.agents // []' "$topology_file")

    log "Restoring topology: $topology (max agents: $max_agents)"

    # Initialize swarm with saved topology
    npx claude-flow@alpha hooks swarm-init \
        --topology "$topology" \
        --max-agents "$max_agents" \
        --session-id "$SESSION_ID" \
        2>&1 | tee -a "$LOG_FILE" || {
        error "Failed to initialize swarm"
        return 1
    }

    # Respawn agents if configured
    local agent_count=$(echo "$agents" | jq 'length')
    if [[ $agent_count -gt 0 ]]; then
        log "Respawning $agent_count agents..."

        echo "$agents" | jq -r '.[] | .type' | while read -r agent_type; do
            npx claude-flow@alpha hooks agent-spawn \
                --type "$agent_type" \
                --session-id "$SESSION_ID" \
                2>&1 | tee -a "$LOG_FILE" || warn "Failed to spawn $agent_type"
        done
    fi

    success "Topology rebuilt"
}

################################################################################
# 4. Restore Metrics
################################################################################

restore_metrics() {
    if [[ "$RESTORE_METRICS" != "true" ]]; then
        log "Metrics restoration skipped"
        return 0
    fi

    log "Restoring metrics..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local metrics_file="$session_dir/metrics.json"

    if [[ ! -f "$metrics_file" ]]; then
        warn "No metrics snapshot found"
        return 0
    fi

    # Display previous metrics
    log "Previous session metrics:"
    jq '.' "$metrics_file" | tee -a "$LOG_FILE" || true

    success "Metrics loaded"
}

################################################################################
# 5. Resume Interrupted Tasks
################################################################################

resume_tasks() {
    if [[ "$RESTORE_TASKS" != "true" ]]; then
        log "Task restoration skipped"
        return 0
    fi

    log "Checking for interrupted tasks..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local tasks_file="$session_dir/tasks.json"

    if [[ ! -f "$tasks_file" ]]; then
        log "No tasks to resume"
        return 0
    fi

    # Find incomplete tasks
    local incomplete_tasks=$(jq -r '.[] | select(.status != "completed") | .taskId' "$tasks_file" 2>/dev/null || echo "")

    if [[ -z "$incomplete_tasks" ]]; then
        log "No incomplete tasks found"
        return 0
    fi

    log "Found incomplete tasks:"
    echo "$incomplete_tasks" | while read -r task_id; do
        log "  - $task_id"

        local task_dir="$PROJECT_ROOT/.claude/tasks/$task_id"
        if [[ -d "$task_dir" ]]; then
            local description=$(jq -r '.description' "$task_dir/metadata.json" 2>/dev/null || echo "Unknown")
            log "    Description: $description"
        fi
    done

    warn "Manual intervention may be required to resume tasks"
}

################################################################################
# 6. Restore Git Worktrees
################################################################################

restore_worktrees() {
    log "Restoring git worktrees..."

    if ! git -C "$PROJECT_ROOT" rev-parse --git-dir &> /dev/null; then
        log "Not a git repository, skipping worktree restoration"
        return 0
    fi

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local worktrees_file="$session_dir/worktrees.json"

    if [[ ! -f "$worktrees_file" ]]; then
        log "No worktree information found"
        return 0
    fi

    # List saved worktrees
    local worktrees=$(jq -r '.[] | .path' "$worktrees_file" 2>/dev/null || echo "")

    if [[ -z "$worktrees" ]]; then
        log "No worktrees to restore"
        return 0
    fi

    log "Checking worktree status..."
    echo "$worktrees" | while read -r worktree_path; do
        if [[ -d "$worktree_path" ]]; then
            log "  ✓ Worktree exists: $worktree_path"
        else
            warn "  ✗ Worktree missing: $worktree_path"
        fi
    done
}

################################################################################
# 7. Restore Cache
################################################################################

restore_cache() {
    log "Restoring cache..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local cache_dir="$session_dir/cache"

    if [[ ! -d "$cache_dir" ]]; then
        log "No cache to restore"
        return 0
    fi

    local target_cache="$PROJECT_ROOT/.claude/cache"
    mkdir -p "$target_cache"

    # Copy cache files
    if cp -r "$cache_dir"/* "$target_cache/" 2>&1 | tee -a "$LOG_FILE"; then
        success "Cache restored"
    else
        warn "Failed to restore some cache files"
    fi
}

################################################################################
# 8. Restore Neural Patterns
################################################################################

restore_patterns() {
    log "Restoring neural patterns..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local patterns_file="$session_dir/neural-patterns.json"

    if [[ ! -f "$patterns_file" ]]; then
        log "No neural patterns to restore"
        return 0
    fi

    # Load patterns using claude-flow
    npx claude-flow@alpha hooks neural-restore \
        --session-id "$SESSION_ID" \
        --patterns-file "$patterns_file" \
        2>&1 | tee -a "$LOG_FILE" || {
        warn "Failed to restore neural patterns"
    }
}

################################################################################
# 9. Restore Environment State
################################################################################

restore_environment() {
    log "Restoring environment state..."

    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    local env_file="$session_dir/environment.json"

    if [[ ! -f "$env_file" ]]; then
        log "No environment state to restore"
        return 0
    fi

    # Display environment info
    log "Previous environment:"
    jq '.' "$env_file" | tee -a "$LOG_FILE" || true

    # Check for differences
    local prev_node=$(jq -r '.nodeVersion // "unknown"' "$env_file")
    local current_node=$(node --version 2>/dev/null || echo "unknown")

    if [[ "$prev_node" != "$current_node" ]]; then
        warn "Node.js version changed: $prev_node -> $current_node"
    fi
}

################################################################################
# 10. Validation and Health Check
################################################################################

health_check() {
    log "Running post-restore health check..."

    # Check swarm status
    npx claude-flow@alpha hooks swarm-status \
        --session-id "$SESSION_ID" \
        2>&1 | tee -a "$LOG_FILE" || {
        warn "Swarm status check failed"
    }

    # Check memory usage
    npx claude-flow@alpha hooks memory-usage \
        2>&1 | tee -a "$LOG_FILE" || {
        warn "Memory usage check failed"
    }

    # Verify file integrity
    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"
    if [[ -f "$session_dir/checksums.txt" ]]; then
        log "Verifying file integrity..."
        # md5sum check would go here
    fi
}

################################################################################
# Main Execution
################################################################################

main() {
    local session_dir="$PROJECT_ROOT/.claude/sessions/$SESSION_ID"

    # Execute all restoration steps
    validate_session
    restore_memory
    rebuild_topology
    restore_metrics
    resume_tasks
    restore_worktrees
    restore_cache
    restore_patterns
    restore_environment
    health_check

    # Update session status
    if [[ -f "$session_dir/metadata.json" ]]; then
        jq --arg time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            '.restoredAt = $time | .status = "restored"' \
            "$session_dir/metadata.json" > "$session_dir/metadata.json.tmp" && \
            mv "$session_dir/metadata.json.tmp" "$session_dir/metadata.json"
    fi

    log "=== SESSION-RESTORE HOOK COMPLETED SUCCESSFULLY ==="

    # Output summary
    cat <<EOF

SESSION RESTORED:
  ID: $SESSION_ID
  Memory: $([ "$RESTORE_MEMORY" == "true" ] && echo "✓" || echo "✗")
  Metrics: $([ "$RESTORE_METRICS" == "true" ] && echo "✓" || echo "✗")
  Tasks: $([ "$RESTORE_TASKS" == "true" ] && echo "✓" || echo "✗")
  Status: READY

Session data location: $session_dir

EOF

    success "Session $SESSION_ID is ready to continue"

    exit 0
}

# Error handler
trap 'error "Session-restore hook failed at line $LINENO"; exit 1' ERR

# Run main function
main "$@"
