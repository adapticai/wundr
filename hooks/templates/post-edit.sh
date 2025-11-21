#!/usr/bin/env bash
################################################################################
# POST-EDIT HOOK TEMPLATE
# Executes after file editing operations
#
# Purpose:
# - Validate edited file syntax
# - Auto-format code
# - Update file metadata
# - Store changes in memory
# - Run linters and type checkers
# - Stage changes in git
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_CONFIG="${HOOKS_CONFIG:-$PROJECT_ROOT/.claude/hooks.config.json}"
LOG_FILE="${LOG_FILE:-$PROJECT_ROOT/.claude/logs/post-edit-$(date +%Y%m%d-%H%M%S).log}"

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
FILE_PATH="${1:-}"
EDIT_TYPE="${2:-modify}"
SESSION_ID="${3:-}"
TASK_ID="${4:-}"
MEMORY_KEY="${5:-}"

if [[ -z "$FILE_PATH" ]]; then
    error "File path is required"
    echo "Usage: $0 <file_path> [edit_type] [session_id] [task_id] [memory_key]"
    exit 1
fi

# Resolve to absolute path
FILE_PATH=$(cd "$(dirname "$FILE_PATH")" 2>/dev/null && pwd)/$(basename "$FILE_PATH") || FILE_PATH="$FILE_PATH"

log "=== POST-EDIT HOOK STARTED ==="
log "File: $FILE_PATH"
log "Edit Type: $EDIT_TYPE"
log "Session: $SESSION_ID"
log "Task: $TASK_ID"

################################################################################
# 1. Verify File Changes
################################################################################

verify_changes() {
    log "Verifying file changes..."

    if [[ "$EDIT_TYPE" == "delete" ]]; then
        if [[ -f "$FILE_PATH" ]]; then
            error "File still exists after delete operation"
            exit 1
        fi
        log "File successfully deleted"
        return 0
    fi

    if [[ ! -f "$FILE_PATH" ]]; then
        error "File does not exist after edit: $FILE_PATH"
        exit 1
    fi

    log "File exists and is accessible"
}

################################################################################
# 2. Syntax Validation
################################################################################

validate_syntax() {
    log "Validating syntax after edit..."

    local extension="${FILE_PATH##*.}"
    local validation_passed=true

    case "$extension" in
        js|jsx)
            if command -v npx &> /dev/null; then
                log "Validating JavaScript syntax..."
                if npx eslint "$FILE_PATH" --no-eslintrc --parser-options=ecmaVersion:latest 2>&1 | tee -a "$LOG_FILE"; then
                    success "JavaScript syntax valid"
                else
                    warn "ESLint validation failed"
                    validation_passed=false
                fi
            fi
            ;;
        ts|tsx)
            if command -v npx &> /dev/null; then
                log "Validating TypeScript syntax..."
                if npx tsc --noEmit "$FILE_PATH" 2>&1 | tee -a "$LOG_FILE"; then
                    success "TypeScript syntax valid"
                else
                    warn "TypeScript validation failed"
                    validation_passed=false
                fi
            fi
            ;;
        json)
            log "Validating JSON syntax..."
            if jq empty "$FILE_PATH" 2>&1 | tee -a "$LOG_FILE"; then
                success "JSON syntax valid"
            else
                error "Invalid JSON syntax"
                validation_passed=false
            fi
            ;;
        yaml|yml)
            if command -v yamllint &> /dev/null; then
                log "Validating YAML syntax..."
                if yamllint "$FILE_PATH" 2>&1 | tee -a "$LOG_FILE"; then
                    success "YAML syntax valid"
                else
                    warn "YAML validation failed"
                    validation_passed=false
                fi
            fi
            ;;
        sh|bash)
            log "Validating shell script syntax..."
            if bash -n "$FILE_PATH" 2>&1 | tee -a "$LOG_FILE"; then
                success "Shell script syntax valid"
            else
                error "Invalid shell script syntax"
                validation_passed=false
            fi
            ;;
    esac

    if [[ "$validation_passed" == "false" ]]; then
        warn "Syntax validation failed, but continuing"
    fi
}

################################################################################
# 3. Auto-Formatting
################################################################################

auto_format() {
    log "Auto-formatting file..."

    local extension="${FILE_PATH##*.}"
    local formatted=false

    # Check if auto-format is enabled
    if [[ -f "$HOOKS_CONFIG" ]]; then
        local auto_format_enabled=$(jq -r '.autoFormat // true' "$HOOKS_CONFIG")
        if [[ "$auto_format_enabled" != "true" ]]; then
            log "Auto-format disabled in config"
            return 0
        fi
    fi

    case "$extension" in
        js|jsx|ts|tsx|json)
            if command -v npx &> /dev/null; then
                if npx prettier --write "$FILE_PATH" 2>&1 | tee -a "$LOG_FILE"; then
                    success "File formatted with Prettier"
                    formatted=true
                fi
            fi
            ;;
        sh|bash)
            if command -v shfmt &> /dev/null; then
                if shfmt -w "$FILE_PATH" 2>&1 | tee -a "$LOG_FILE"; then
                    success "Shell script formatted"
                    formatted=true
                fi
            fi
            ;;
    esac

    if [[ "$formatted" == "true" ]]; then
        log "Auto-formatting applied"
    else
        log "No auto-formatting available for this file type"
    fi
}

################################################################################
# 4. Update Metadata
################################################################################

update_metadata() {
    log "Updating file metadata..."

    local metadata_dir="$PROJECT_ROOT/.claude/metadata"
    mkdir -p "$metadata_dir"

    local file_hash=$(echo "$FILE_PATH" | md5sum | cut -d' ' -f1)
    local metadata_file="$metadata_dir/${file_hash}.json"

    # Collect post-edit stats
    local size=0
    local lines=0
    local modified=""
    local checksum=""

    if [[ -f "$FILE_PATH" ]]; then
        size=$(stat -f %z "$FILE_PATH" 2>/dev/null || stat -c %s "$FILE_PATH")
        lines=$(wc -l < "$FILE_PATH" 2>/dev/null || echo 0)
        modified=$(stat -f %Sm "$FILE_PATH" 2>/dev/null || stat -c %y "$FILE_PATH")
        checksum=$(md5sum "$FILE_PATH" | cut -d' ' -f1)
    fi

    # Update or create metadata
    if [[ -f "$metadata_file" ]]; then
        jq --arg size "$size" \
           --arg lines "$lines" \
           --arg modified "$modified" \
           --arg checksum "$checksum" \
           --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
           '.postEdit = {size: ($size | tonumber), lines: ($lines | tonumber), modified: $modified, checksum: $checksum, timestamp: $timestamp}' \
           "$metadata_file" > "$metadata_file.tmp" && mv "$metadata_file.tmp" "$metadata_file"
    else
        cat > "$metadata_file" <<EOF
{
  "filePath": "$FILE_PATH",
  "editType": "$EDIT_TYPE",
  "sessionId": "$SESSION_ID",
  "taskId": "$TASK_ID",
  "postEdit": {
    "size": $size,
    "lines": $lines,
    "modified": "$modified",
    "checksum": "$checksum",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }
}
EOF
    fi

    log "Metadata updated: $metadata_file"
}

################################################################################
# 5. Memory Storage
################################################################################

store_in_memory() {
    log "Storing file changes in memory..."

    if [[ -z "$SESSION_ID" ]]; then
        log "No session ID, skipping memory storage"
        return 0
    fi

    local file_hash=$(echo "$FILE_PATH" | md5sum | cut -d' ' -f1)
    local default_memory_key="swarm/${SESSION_ID}/files/${file_hash}"
    local effective_memory_key="${MEMORY_KEY:-$default_memory_key}"

    local metadata_dir="$PROJECT_ROOT/.claude/metadata"
    local metadata_file="$metadata_dir/${file_hash}.json"

    if [[ -f "$metadata_file" ]]; then
        npx claude-flow@alpha hooks memory-store \
            --key "$effective_memory_key" \
            --file "$metadata_file" \
            2>&1 | tee -a "$LOG_FILE" || {
            warn "Failed to store in memory"
        }
    fi

    # Store file content snapshot for small files
    if [[ -f "$FILE_PATH" ]]; then
        local file_size=$(stat -f %z "$FILE_PATH" 2>/dev/null || stat -c %s "$FILE_PATH")
        if [[ $file_size -lt 10240 ]]; then  # Less than 10KB
            npx claude-flow@alpha hooks memory-store \
                --key "${effective_memory_key}/content" \
                --file "$FILE_PATH" \
                2>&1 | tee -a "$LOG_FILE" || {
                warn "Failed to store file content"
            }
        fi
    fi
}

################################################################################
# 6. Git Operations
################################################################################

handle_git() {
    log "Handling git operations..."

    if ! git -C "$PROJECT_ROOT" rev-parse --git-dir &> /dev/null; then
        log "Not a git repository, skipping git operations"
        return 0
    fi

    # Check if auto-stage is enabled
    local auto_stage=false
    if [[ -f "$HOOKS_CONFIG" ]]; then
        auto_stage=$(jq -r '.autoStage // false' "$HOOKS_CONFIG")
    fi

    if [[ "$auto_stage" == "true" ]]; then
        log "Auto-staging file changes..."

        if [[ "$EDIT_TYPE" == "delete" ]]; then
            git -C "$PROJECT_ROOT" rm "$FILE_PATH" 2>&1 | tee -a "$LOG_FILE" || warn "Failed to stage deletion"
        else
            git -C "$PROJECT_ROOT" add "$FILE_PATH" 2>&1 | tee -a "$LOG_FILE" || warn "Failed to stage file"
        fi

        success "File staged in git"
    else
        log "Auto-stage disabled, file not staged"
    fi
}

################################################################################
# 7. Run Linters
################################################################################

run_linters() {
    log "Running linters..."

    local extension="${FILE_PATH##*.}"

    case "$extension" in
        js|jsx|ts|tsx)
            if command -v npx &> /dev/null; then
                log "Running ESLint..."
                npx eslint "$FILE_PATH" --fix 2>&1 | tee -a "$LOG_FILE" || warn "ESLint failed"
            fi
            ;;
        py)
            if command -v pylint &> /dev/null; then
                log "Running pylint..."
                pylint "$FILE_PATH" 2>&1 | tee -a "$LOG_FILE" || warn "pylint failed"
            fi
            ;;
    esac
}

################################################################################
# 8. Neural Pattern Learning
################################################################################

learn_patterns() {
    log "Learning edit patterns..."

    if [[ -z "$SESSION_ID" ]]; then
        log "No session ID, skipping pattern learning"
        return 0
    fi

    local metadata_dir="$PROJECT_ROOT/.claude/metadata"
    local file_hash=$(echo "$FILE_PATH" | md5sum | cut -d' ' -f1)
    local metadata_file="$metadata_dir/${file_hash}.json"

    if [[ -f "$metadata_file" ]]; then
        npx claude-flow@alpha hooks neural-train \
            --pattern-type "file-edit" \
            --input "$metadata_file" \
            --auto-learn true \
            2>&1 | tee -a "$LOG_FILE" || {
            warn "Pattern learning failed"
        }
    fi
}

################################################################################
# 9. Release File Lock
################################################################################

release_lock() {
    log "Releasing file lock..."

    local lock_dir="$PROJECT_ROOT/.claude/locks"
    local lock_file="$lock_dir/$(echo "$FILE_PATH" | md5sum | cut -d' ' -f1).lock"

    if [[ -f "$lock_file" ]]; then
        rm -f "$lock_file"
        log "File lock released"
    fi
}

################################################################################
# 10. Notification
################################################################################

send_notification() {
    log "Sending edit notification..."

    if [[ -z "$SESSION_ID" ]]; then
        return 0
    fi

    npx claude-flow@alpha hooks notify \
        --message "File edited: $(basename "$FILE_PATH") ($EDIT_TYPE)" \
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
    # Execute all post-edit steps
    verify_changes

    if [[ "$EDIT_TYPE" != "delete" ]]; then
        validate_syntax
        auto_format
        run_linters
    fi

    update_metadata
    store_in_memory
    learn_patterns
    handle_git
    release_lock
    send_notification

    log "=== POST-EDIT HOOK COMPLETED SUCCESSFULLY ==="

    # Output summary
    if [[ "$EDIT_TYPE" != "delete" ]] && [[ -f "$FILE_PATH" ]]; then
        local lines=$(wc -l < "$FILE_PATH" 2>/dev/null || echo 0)
        local size=$(stat -f %z "$FILE_PATH" 2>/dev/null || stat -c %s "$FILE_PATH")

        cat <<EOF

FILE EDIT COMPLETE:
  Path: $FILE_PATH
  Type: $EDIT_TYPE
  Lines: $lines
  Size: $size bytes
  Status: SUCCESS

EOF
    else
        echo "FILE DELETED: $FILE_PATH"
    fi

    exit 0
}

# Error handler
trap 'error "Post-edit hook failed at line $LINENO"; release_lock; exit 1' ERR

# Run main function
main "$@"
