#!/usr/bin/env bash
################################################################################
# PRE-TASK HOOK TEMPLATE
# Executes before any task begins
#
# Purpose:
# - Validate environment and dependencies
# - Assign agents based on task requirements
# - Prepare resources and worktrees
# - Optimize topology for task complexity
# - Restore session context
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_CONFIG="${HOOKS_CONFIG:-$PROJECT_ROOT/.claude/hooks.config.json}"
LOG_FILE="${LOG_FILE:-$PROJECT_ROOT/.claude/logs/pre-task-$(date +%Y%m%d-%H%M%S).log}"

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

# Parse arguments
TASK_DESCRIPTION="${1:-}"
TASK_ID="${2:-task-$(date +%s)}"
SESSION_ID="${3:-swarm-$(date +%s)}"
AGENT_TYPE="${4:-auto}"
COMPLEXITY="${5:-auto}"

if [[ -z "$TASK_DESCRIPTION" ]]; then
    error "Task description is required"
    echo "Usage: $0 <task_description> [task_id] [session_id] [agent_type] [complexity]"
    exit 1
fi

log "=== PRE-TASK HOOK STARTED ==="
log "Task: $TASK_DESCRIPTION"
log "Task ID: $TASK_ID"
log "Session ID: $SESSION_ID"

################################################################################
# 1. Environment Validation
################################################################################

validate_environment() {
    log "Validating environment..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi

    # Check npm packages
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
        warn "node_modules not found, running npm install..."
        cd "$PROJECT_ROOT" && npm install
    fi

    # Check claude-flow
    if ! npx claude-flow@alpha --version &> /dev/null; then
        error "claude-flow is not available"
        exit 1
    fi

    # Check git
    if ! git -C "$PROJECT_ROOT" rev-parse --git-dir &> /dev/null; then
        warn "Not a git repository"
    fi

    log "Environment validation complete"
}

################################################################################
# 2. Task Analysis and Agent Assignment
################################################################################

analyze_task() {
    log "Analyzing task requirements..."

    local task_lower=$(echo "$TASK_DESCRIPTION" | tr '[:upper:]' '[:lower:]')

    # Auto-detect agent type if not specified
    if [[ "$AGENT_TYPE" == "auto" ]]; then
        if [[ "$task_lower" =~ test|testing|tdd ]]; then
            AGENT_TYPE="tester"
        elif [[ "$task_lower" =~ review|audit|analyze ]]; then
            AGENT_TYPE="reviewer"
        elif [[ "$task_lower" =~ plan|design|architect ]]; then
            AGENT_TYPE="planner"
        elif [[ "$task_lower" =~ research|investigate|explore ]]; then
            AGENT_TYPE="researcher"
        elif [[ "$task_lower" =~ implement|code|develop|build ]]; then
            AGENT_TYPE="coder"
        elif [[ "$task_lower" =~ github|pr|issue|release ]]; then
            AGENT_TYPE="github-modes"
        else
            AGENT_TYPE="smart-agent"
        fi
        log "Auto-assigned agent type: $AGENT_TYPE"
    fi

    # Auto-detect complexity if not specified
    if [[ "$COMPLEXITY" == "auto" ]]; then
        local word_count=$(echo "$TASK_DESCRIPTION" | wc -w)
        if [[ $word_count -lt 10 ]]; then
            COMPLEXITY="simple"
        elif [[ $word_count -lt 30 ]]; then
            COMPLEXITY="medium"
        else
            COMPLEXITY="complex"
        fi
        log "Auto-detected complexity: $COMPLEXITY"
    fi
}

################################################################################
# 3. Topology Optimization
################################################################################

optimize_topology() {
    log "Optimizing swarm topology..."

    local topology="mesh"  # default
    local max_agents=3

    case "$COMPLEXITY" in
        simple)
            topology="mesh"
            max_agents=1
            ;;
        medium)
            topology="mesh"
            max_agents=3
            ;;
        complex)
            topology="hierarchical"
            max_agents=6
            ;;
    esac

    log "Selected topology: $topology (max agents: $max_agents)"

    # Initialize swarm with optimized topology
    npx claude-flow@alpha hooks swarm-init \
        --topology "$topology" \
        --max-agents "$max_agents" \
        --session-id "$SESSION_ID" 2>&1 | tee -a "$LOG_FILE" || {
        error "Failed to initialize swarm"
        exit 1
    }
}

################################################################################
# 4. Git Worktree Preparation
################################################################################

prepare_worktree() {
    log "Preparing git worktree..."

    if ! git -C "$PROJECT_ROOT" rev-parse --git-dir &> /dev/null; then
        warn "Not a git repository, skipping worktree setup"
        return 0
    fi

    local branch_name="task/${TASK_ID}"
    local worktree_path="$PROJECT_ROOT/.worktrees/$branch_name"

    # Check if worktree already exists
    if [[ -d "$worktree_path" ]]; then
        log "Worktree already exists: $worktree_path"
        return 0
    fi

    # Create worktree for task isolation
    mkdir -p "$PROJECT_ROOT/.worktrees"

    if git -C "$PROJECT_ROOT" worktree add "$worktree_path" -b "$branch_name" 2>&1 | tee -a "$LOG_FILE"; then
        log "Created worktree: $worktree_path"
        echo "$worktree_path" > "$PROJECT_ROOT/.claude/current-worktree"
    else
        warn "Failed to create worktree, continuing without isolation"
    fi
}

################################################################################
# 5. Session Context Restoration
################################################################################

restore_session() {
    log "Restoring session context..."

    npx claude-flow@alpha hooks session-restore \
        --session-id "$SESSION_ID" \
        --restore-memory true \
        --restore-metrics true 2>&1 | tee -a "$LOG_FILE" || {
        warn "Session restoration failed, starting fresh"
    }
}

################################################################################
# 6. Memory and Cache Preparation
################################################################################

prepare_memory() {
    log "Preparing memory and cache..."

    # Create memory key structure
    local memory_key="swarm/${SESSION_ID}/${TASK_ID}"

    # Store task context
    npx claude-flow@alpha hooks memory-store \
        --key "$memory_key/task" \
        --value "{\"description\":\"$TASK_DESCRIPTION\",\"agent\":\"$AGENT_TYPE\",\"complexity\":\"$COMPLEXITY\",\"started\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
        2>&1 | tee -a "$LOG_FILE" || {
        warn "Failed to store task context in memory"
    }

    # Retrieve relevant patterns
    npx claude-flow@alpha hooks neural-patterns \
        --pattern-type "task" \
        --filter "$AGENT_TYPE" 2>&1 | tee -a "$LOG_FILE" || {
        warn "Failed to retrieve neural patterns"
    }
}

################################################################################
# 7. Resource Allocation
################################################################################

allocate_resources() {
    log "Allocating resources..."

    # Create task-specific directories
    local task_dir="$PROJECT_ROOT/.claude/tasks/$TASK_ID"
    mkdir -p "$task_dir"/{logs,artifacts,checkpoints}

    # Store task metadata
    cat > "$task_dir/metadata.json" <<EOF
{
  "taskId": "$TASK_ID",
  "sessionId": "$SESSION_ID",
  "description": "$TASK_DESCRIPTION",
  "agentType": "$AGENT_TYPE",
  "complexity": "$COMPLEXITY",
  "startTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "in_progress"
}
EOF

    log "Resources allocated: $task_dir"
}

################################################################################
# 8. Pre-flight Checks
################################################################################

preflight_checks() {
    log "Running pre-flight checks..."

    # Check for uncommitted changes if git available
    if git -C "$PROJECT_ROOT" rev-parse --git-dir &> /dev/null; then
        if [[ -n $(git -C "$PROJECT_ROOT" status --porcelain) ]]; then
            warn "Uncommitted changes detected"
        fi
    fi

    # Check disk space
    local available_space=$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $4}')
    log "Available disk space: $available_space"

    # Check for existing lock files
    if [[ -f "$PROJECT_ROOT/.claude/task.lock" ]]; then
        warn "Task lock file exists, another task may be running"
    fi

    # Create lock file
    echo "$TASK_ID" > "$PROJECT_ROOT/.claude/task.lock"
}

################################################################################
# Main Execution
################################################################################

main() {
    # Create required directories
    mkdir -p "$PROJECT_ROOT/.claude"/{logs,tasks,cache,worktrees}

    # Execute all preparation steps
    validate_environment
    analyze_task
    optimize_topology
    prepare_worktree
    restore_session
    prepare_memory
    allocate_resources
    preflight_checks

    log "=== PRE-TASK HOOK COMPLETED SUCCESSFULLY ==="

    # Output task metadata for Claude Code
    cat <<EOF

TASK INITIALIZED:
  ID: $TASK_ID
  Session: $SESSION_ID
  Agent: $AGENT_TYPE
  Complexity: $COMPLEXITY
  Status: READY

Next steps:
  1. Execute task with assigned agent
  2. Use post-edit hooks for file changes
  3. Complete with post-task hook

EOF

    exit 0
}

# Error handler
trap 'error "Pre-task hook failed at line $LINENO"; exit 1' ERR

# Run main function
main "$@"
