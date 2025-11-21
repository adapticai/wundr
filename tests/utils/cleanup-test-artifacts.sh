#!/usr/bin/env bash
set -euo pipefail

# Cleanup Test Artifacts Script
# Removes test-generated files and validates cleanup

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[DONE]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Cleanup counters
FILES_REMOVED=0
DIRS_REMOVED=0
BYTES_FREED=0

# Common test artifacts patterns
TEST_ARTIFACTS=(
    "*.test.tmp"
    "*.test.log"
    ".test-*"
    "test-*.tmp"
    "*.spec.tmp"
    ".coverage-tmp"
    ".jest-cache"
    "node_modules/.cache"
)

# Temporary test directories
TEST_TEMP_DIRS=(
    "/tmp/wundr-test-*"
    "/tmp/test-worktree-*"
    "/tmp/agent-test-*"
)

# ============================================================================
# CLEANUP FUNCTIONS
# ============================================================================

cleanup_test_files() {
    log_info "Cleaning up test artifact files..."

    for pattern in "${TEST_ARTIFACTS[@]}"; do
        while IFS= read -r file; do
            if [[ -f "$file" ]]; then
                local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
                BYTES_FREED=$((BYTES_FREED + size))

                rm -f "$file"
                ((FILES_REMOVED++))
            fi
        done < <(find "$PROJECT_ROOT" -name "$pattern" -type f 2>/dev/null || true)
    done

    log_success "Removed $FILES_REMOVED test files"
}

cleanup_test_dirs() {
    log_info "Cleaning up test directories..."

    # Project-local test dirs
    find "$PROJECT_ROOT" -type d -name ".test-*" 2>/dev/null | while read -r dir; do
        if [[ -d "$dir" ]]; then
            rm -rf "$dir"
            ((DIRS_REMOVED++))
        fi
    done

    # System temp dirs
    for pattern in "${TEST_TEMP_DIRS[@]}"; do
        find /tmp -maxdepth 1 -type d -name "$(basename "$pattern")" 2>/dev/null | while read -r dir; do
            if [[ -d "$dir" ]]; then
                rm -rf "$dir"
                ((DIRS_REMOVED++))
            fi
        done
    done

    log_success "Removed $DIRS_REMOVED test directories"
}

cleanup_git_worktrees() {
    log_info "Cleaning up orphaned git worktrees..."

    cd "$PROJECT_ROOT"

    if git worktree list >/dev/null 2>&1; then
        # Prune orphaned worktrees
        git worktree prune -v 2>&1 | while read -r line; do
            if [[ "$line" =~ "Removing" ]]; then
                log_info "$line"
            fi
        done
    fi

    log_success "Git worktrees cleaned"
}

cleanup_node_artifacts() {
    log_info "Cleaning up Node.js test artifacts..."

    # Clean test coverage
    if [[ -d "$PROJECT_ROOT/.nyc_output" ]]; then
        rm -rf "$PROJECT_ROOT/.nyc_output"
        ((DIRS_REMOVED++))
    fi

    if [[ -d "$PROJECT_ROOT/coverage" ]]; then
        # Only remove if it looks like a test coverage dir
        if [[ -f "$PROJECT_ROOT/coverage/lcov.info" ]]; then
            rm -rf "$PROJECT_ROOT/coverage"
            ((DIRS_REMOVED++))
        fi
    fi

    # Clean Jest cache
    if [[ -d "$PROJECT_ROOT/.jest" ]]; then
        rm -rf "$PROJECT_ROOT/.jest"
        ((DIRS_REMOVED++))
    fi

    log_success "Node.js artifacts cleaned"
}

cleanup_build_artifacts() {
    log_info "Cleaning up build artifacts..."

    local build_dirs=("dist" "build" "out" ".next" ".nuxt")

    for dir in "${build_dirs[@]}"; do
        if [[ -d "$PROJECT_ROOT/$dir" ]]; then
            # Only remove if it looks like a build directory
            if [[ -f "$PROJECT_ROOT/$dir/.gitignore" ]] || \
               [[ ! -f "$PROJECT_ROOT/$dir/README.md" ]]; then
                log_warning "Skipping $dir (might be source directory)"
            else
                rm -rf "$PROJECT_ROOT/$dir"
                ((DIRS_REMOVED++))
            fi
        fi
    done

    log_success "Build artifacts cleaned"
}

cleanup_log_files() {
    log_info "Cleaning up old log files..."

    find "$PROJECT_ROOT" -name "*.log" -type f -mtime +7 2>/dev/null | while read -r logfile; do
        # Only remove logs older than 7 days
        local size=$(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null || echo 0)
        BYTES_FREED=$((BYTES_FREED + size))

        rm -f "$logfile"
        ((FILES_REMOVED++))
    done

    log_success "Old log files cleaned"
}

# ============================================================================
# VERIFICATION FUNCTIONS
# ============================================================================

verify_no_test_artifacts() {
    log_info "Verifying cleanup..."

    local remaining_artifacts=0

    for pattern in "${TEST_ARTIFACTS[@]}"; do
        local count=$(find "$PROJECT_ROOT" -name "$pattern" -type f 2>/dev/null | wc -l)
        remaining_artifacts=$((remaining_artifacts + count))
    done

    if [[ $remaining_artifacts -gt 0 ]]; then
        log_warning "$remaining_artifacts test artifacts still present"
        return 1
    else
        log_success "No test artifacts remaining"
        return 0
    fi
}

verify_git_status_clean() {
    log_info "Verifying git status..."

    cd "$PROJECT_ROOT"

    if git status --porcelain | grep -q '^??'; then
        log_warning "Untracked files present after cleanup:"
        git status --porcelain | grep '^??'
        return 1
    else
        log_success "No untracked files"
        return 0
    fi
}

# ============================================================================
# REPORTING
# ============================================================================

print_summary() {
    echo ""
    echo "======================================================================"
    echo "  Cleanup Summary"
    echo "======================================================================"
    echo -e "Files removed:       $FILES_REMOVED"
    echo -e "Directories removed: $DIRS_REMOVED"
    echo -e "Space freed:         $(numfmt --to=iec $BYTES_FREED 2>/dev/null || echo $BYTES_FREED bytes)"
    echo ""
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    local dry_run=false
    local verify_only=false

    # Parse arguments
    for arg in "$@"; do
        case $arg in
            --dry-run)
                dry_run=true
                ;;
            --verify)
                verify_only=true
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --dry-run    Show what would be cleaned without removing"
                echo "  --verify     Only verify cleanup, don't clean"
                echo "  --help       Show this help message"
                echo ""
                exit 0
                ;;
        esac
    done

    echo "======================================================================"
    echo "  Test Artifacts Cleanup Script"
    echo "======================================================================"
    echo ""

    if [[ "$verify_only" == true ]]; then
        verify_no_test_artifacts
        verify_git_status_clean
        exit 0
    fi

    if [[ "$dry_run" == true ]]; then
        log_warning "DRY RUN MODE - No files will be removed"
        echo ""
    fi

    # Run cleanup
    cleanup_test_files
    cleanup_test_dirs
    cleanup_git_worktrees
    cleanup_node_artifacts
    cleanup_build_artifacts
    cleanup_log_files

    # Print summary
    print_summary

    # Verify
    echo "======================================================================"
    echo "  Verification"
    echo "======================================================================"
    verify_no_test_artifacts
    verify_git_status_clean

    echo ""
    log_success "Cleanup complete!"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
