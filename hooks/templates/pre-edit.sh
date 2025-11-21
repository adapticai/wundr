#!/usr/bin/env bash
################################################################################
# PRE-EDIT HOOK TEMPLATE
# Executes before file editing operations
#
# Purpose:
# - Validate file permissions and locks
# - Create backup of file
# - Check out file in worktree if needed
# - Load file context from memory
# - Verify syntax and formatting
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_CONFIG="${HOOKS_CONFIG:-$PROJECT_ROOT/.claude/hooks.config.json}"
LOG_FILE="${LOG_FILE:-$PROJECT_ROOT/.claude/logs/pre-edit-$(date +%Y%m%d-%H%M%S).log}"

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
FILE_PATH="${1:-}"
EDIT_TYPE="${2:-modify}"  # modify, create, delete
SESSION_ID="${3:-}"
TASK_ID="${4:-}"

if [[ -z "$FILE_PATH" ]]; then
    error "File path is required"
    echo "Usage: $0 <file_path> [edit_type] [session_id] [task_id]"
    exit 1
fi

# Resolve to absolute path
FILE_PATH=$(cd "$(dirname "$FILE_PATH")" 2>/dev/null && pwd)/$(basename "$FILE_PATH") || FILE_PATH="$FILE_PATH"

log "=== PRE-EDIT HOOK STARTED ==="
log "File: $FILE_PATH"
log "Edit Type: $EDIT_TYPE"
log "Session: $SESSION_ID"
log "Task: $TASK_ID"

################################################################################
# 1. File Validation
################################################################################

validate_file() {
    log "Validating file access..."

    local file_dir=$(dirname "$FILE_PATH")

    # Check if directory exists for new files
    if [[ "$EDIT_TYPE" == "create" ]]; then
        if [[ ! -d "$file_dir" ]]; then
            error "Directory does not exist: $file_dir"
            exit 1
        fi

        if [[ -f "$FILE_PATH" ]]; then
            warn "File already exists, changing edit type to modify"
            EDIT_TYPE="modify"
        fi
    fi

    # Check if file exists for modify/delete
    if [[ "$EDIT_TYPE" == "modify" ]] || [[ "$EDIT_TYPE" == "delete" ]]; then
        if [[ ! -f "$FILE_PATH" ]]; then
            error "File does not exist: $FILE_PATH"
            exit 1
        fi

        if [[ ! -r "$FILE_PATH" ]]; then
            error "File is not readable: $FILE_PATH"
            exit 1
        fi

        if [[ ! -w "$FILE_PATH" ]]; then
            error "File is not writable: $FILE_PATH"
            exit 1
        fi
    fi
}

################################################################################
# 2. File Lock Check
################################################################################

check_locks() {
    log "Checking file locks..."

    local lock_dir="$PROJECT_ROOT/.claude/locks"
    mkdir -p "$lock_dir"

    local lock_file="$lock_dir/$(echo "$FILE_PATH" | md5sum | cut -d' ' -f1).lock"

    if [[ -f "$lock_file" ]]; then
        local lock_holder=$(cat "$lock_file")
        local lock_age=$(($(date +%s) - $(stat -f %m "$lock_file" 2>/dev/null || stat -c %Y "$lock_file")))

        # Stale lock detection (older than 5 minutes)
        if [[ $lock_age -gt 300 ]]; then
            warn "Stale lock detected (${lock_age}s old), removing..."
            rm -f "$lock_file"
        else
            error "File is locked by: $lock_holder"
            exit 1
        fi
    fi

    # Create lock
    echo "${SESSION_ID:-unknown}-${TASK_ID:-unknown}" > "$lock_file"
    log "File locked for editing"
}

################################################################################
# 3. Create Backup
################################################################################

create_backup() {
    if [[ "$EDIT_TYPE" == "create" ]]; then
        log "Skipping backup for new file"
        return 0
    fi

    log "Creating file backup..."

    local backup_dir="$PROJECT_ROOT/.claude/backups/$(date +%Y%m%d)"
    mkdir -p "$backup_dir"

    local timestamp=$(date +%H%M%S)
    local filename=$(basename "$FILE_PATH")
    local backup_path="$backup_dir/${filename}.${timestamp}.bak"

    if cp "$FILE_PATH" "$backup_path" 2>&1 | tee -a "$LOG_FILE"; then
        log "Backup created: $backup_path"
        echo "$backup_path" > "$PROJECT_ROOT/.claude/last-backup"
    else
        error "Failed to create backup"
        exit 1
    fi
}

################################################################################
# 4. Worktree Handling
################################################################################

handle_worktree() {
    log "Checking worktree status..."

    if ! git -C "$PROJECT_ROOT" rev-parse --git-dir &> /dev/null; then
        log "Not a git repository, skipping worktree handling"
        return 0
    fi

    # Check if we're in a worktree
    local worktree_path=""
    if [[ -f "$PROJECT_ROOT/.claude/current-worktree" ]]; then
        worktree_path=$(cat "$PROJECT_ROOT/.claude/current-worktree")
    fi

    if [[ -n "$worktree_path" ]] && [[ -d "$worktree_path" ]]; then
        log "Working in worktree: $worktree_path"

        # Ensure file is in worktree
        if [[ ! "$FILE_PATH" =~ ^"$worktree_path" ]]; then
            warn "File is outside current worktree"
        fi
    fi
}

################################################################################
# 5. Load File Context
################################################################################

load_context() {
    log "Loading file context from memory..."

    if [[ -z "$SESSION_ID" ]]; then
        log "No session ID, skipping context load"
        return 0
    fi

    local file_hash=$(echo "$FILE_PATH" | md5sum | cut -d' ' -f1)
    local memory_key="swarm/${SESSION_ID}/files/${file_hash}"

    # Retrieve previous edit history
    npx claude-flow@alpha hooks memory-retrieve \
        --key "$memory_key" \
        --output "$PROJECT_ROOT/.claude/cache/file-context-${file_hash}.json" \
        2>&1 | tee -a "$LOG_FILE" || {
        log "No previous context found for file"
    }
}

################################################################################
# 6. Syntax Validation
################################################################################

validate_syntax() {
    if [[ "$EDIT_TYPE" == "create" ]]; then
        log "Skipping syntax validation for new file"
        return 0
    fi

    log "Validating file syntax..."

    local extension="${FILE_PATH##*.}"
    local valid=true

    case "$extension" in
        js|jsx|ts|tsx)
            if command -v npx &> /dev/null; then
                npx eslint "$FILE_PATH" --no-eslintrc --parser-options=ecmaVersion:latest 2>&1 | tee -a "$LOG_FILE" || valid=false
            fi
            ;;
        json)
            if ! jq empty "$FILE_PATH" 2>&1 | tee -a "$LOG_FILE"; then
                error "Invalid JSON syntax"
                valid=false
            fi
            ;;
        yaml|yml)
            if command -v yamllint &> /dev/null; then
                yamllint "$FILE_PATH" 2>&1 | tee -a "$LOG_FILE" || valid=false
            fi
            ;;
        sh|bash)
            if ! bash -n "$FILE_PATH" 2>&1 | tee -a "$LOG_FILE"; then
                error "Invalid shell syntax"
                valid=false
            fi
            ;;
    esac

    if [[ "$valid" == "false" ]]; then
        warn "Syntax validation failed, but continuing with edit"
    else
        log "Syntax validation passed"
    fi
}

################################################################################
# 7. File Metadata Collection
################################################################################

collect_metadata() {
    log "Collecting file metadata..."

    local metadata_dir="$PROJECT_ROOT/.claude/metadata"
    mkdir -p "$metadata_dir"

    local file_hash=$(echo "$FILE_PATH" | md5sum | cut -d' ' -f1)
    local metadata_file="$metadata_dir/${file_hash}.json"

    # Collect current file stats
    local size=0
    local lines=0
    local modified=""

    if [[ -f "$FILE_PATH" ]]; then
        size=$(stat -f %z "$FILE_PATH" 2>/dev/null || stat -c %s "$FILE_PATH")
        lines=$(wc -l < "$FILE_PATH" 2>/dev/null || echo 0)
        modified=$(stat -f %Sm "$FILE_PATH" 2>/dev/null || stat -c %y "$FILE_PATH")
    fi

    cat > "$metadata_file" <<EOF
{
  "filePath": "$FILE_PATH",
  "editType": "$EDIT_TYPE",
  "sessionId": "$SESSION_ID",
  "taskId": "$TASK_ID",
  "preEdit": {
    "size": $size,
    "lines": $lines,
    "modified": "$modified",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }
}
EOF

    log "Metadata collected: $metadata_file"
}

################################################################################
# 8. Pre-edit Hooks Configuration
################################################################################

apply_custom_hooks() {
    log "Applying custom pre-edit hooks..."

    if [[ ! -f "$HOOKS_CONFIG" ]]; then
        log "No hooks configuration found"
        return 0
    fi

    # Check for custom pre-edit commands
    local custom_hooks=$(jq -r '.hooks.preEdit // []' "$HOOKS_CONFIG" 2>/dev/null || echo "[]")

    if [[ "$custom_hooks" != "[]" ]]; then
        log "Executing custom pre-edit hooks..."
        # Execute custom hooks (implementation depends on config format)
    fi
}

################################################################################
# Main Execution
################################################################################

main() {
    # Create required directories
    mkdir -p "$PROJECT_ROOT/.claude"/{locks,backups,metadata,cache}

    # Execute all pre-edit steps
    validate_file
    check_locks
    create_backup
    handle_worktree
    load_context
    validate_syntax
    collect_metadata
    apply_custom_hooks

    log "=== PRE-EDIT HOOK COMPLETED SUCCESSFULLY ==="

    # Output metadata for Claude Code
    cat <<EOF

FILE READY FOR EDIT:
  Path: $FILE_PATH
  Type: $EDIT_TYPE
  Backup: $(cat "$PROJECT_ROOT/.claude/last-backup" 2>/dev/null || echo "none")
  Status: READY

EOF

    exit 0
}

# Error handler
trap 'error "Pre-edit hook failed at line $LINENO"; exit 1' ERR

# Run main function
main "$@"
