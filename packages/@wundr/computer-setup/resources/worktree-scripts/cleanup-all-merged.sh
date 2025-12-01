#!/bin/bash
# cleanup-all-merged.sh
# Bulk cleanup of all merged agent worktrees

set -euo pipefail

# Configuration
REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"
DRY_RUN="${1:-false}"
TARGET_BRANCH="${2:-master}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}ℹ️  ${1}${NC}"; }
log_success() { echo -e "${GREEN}✅ ${1}${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  ${1}${NC}"; }
log_error() { echo -e "${RED}❌ ${1}${NC}"; }

echo "🧹 Bulk Worktree Cleanup"
echo "======================="
echo ""

if [ "${DRY_RUN}" = "true" ]; then
    log_warning "DRY RUN MODE - No changes will be made"
    echo ""
fi

cd "${REPO_ROOT}"

# Update target branch
log_info "Updating ${TARGET_BRANCH} branch..."
git checkout "${TARGET_BRANCH}"
git pull origin "${TARGET_BRANCH}" 2>/dev/null || log_warning "Could not pull from remote"

# Get list of merged branches
log_info "Finding merged agent branches..."
MERGED_BRANCHES=$(git branch --merged "${TARGET_BRANCH}" | grep 'agents/' | sed 's/^[ *]*//' || echo "")

if [ -z "${MERGED_BRANCHES}" ]; then
    log_info "No merged agent branches found"
    exit 0
fi

# Count branches
BRANCH_COUNT=$(echo "${MERGED_BRANCHES}" | wc -l | tr -d ' ')
log_info "Found ${BRANCH_COUNT} merged agent branches"
echo ""

# Process each merged branch
CLEANED=0
FAILED=0

while IFS= read -r branch; do
    # Extract worktree name from branch
    # Format: agents/agent-type/task-id -> agent-type-task-id
    AGENT_TYPE=$(echo "${branch}" | cut -d'/' -f2)
    TASK_ID=$(echo "${branch}" | cut -d'/' -f3)
    WORKTREE_NAME="${AGENT_TYPE}-${TASK_ID}"
    WORKTREE_PATH="${WORKTREE_BASE}/${WORKTREE_NAME}"

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log_info "Processing: ${WORKTREE_NAME}"
    log_info "Branch: ${branch}"

    # Check if worktree exists
    if [ -d "${WORKTREE_PATH}" ]; then
        log_info "Worktree exists at: ${WORKTREE_PATH}"

        # Check for uncommitted changes
        cd "${WORKTREE_PATH}"
        UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')

        if [ "${UNCOMMITTED}" -gt 0 ]; then
            log_warning "Uncommitted changes: ${UNCOMMITTED} files"

            if [ "${DRY_RUN}" = "true" ]; then
                log_info "Would skip due to uncommitted changes"
            else
                log_warning "Skipping due to uncommitted changes"
                ((FAILED++))
                cd "${REPO_ROOT}"
                continue
            fi
        fi

        cd "${REPO_ROOT}"

        # Remove worktree and branch
        if [ "${DRY_RUN}" = "true" ]; then
            log_info "Would remove worktree: ${WORKTREE_PATH}"
            log_info "Would delete branch: ${branch}"
        else
            if git worktree remove "${WORKTREE_PATH}" --force 2>/dev/null; then
                log_success "Removed worktree"

                if git branch -d "${branch}" 2>/dev/null; then
                    log_success "Deleted branch"
                    ((CLEANED++))
                else
                    log_error "Failed to delete branch"
                    ((FAILED++))
                fi
            else
                log_error "Failed to remove worktree"
                ((FAILED++))
            fi
        fi
    else
        # Worktree doesn't exist, just delete branch
        log_info "No worktree found, cleaning up branch only"

        if [ "${DRY_RUN}" = "true" ]; then
            log_info "Would delete branch: ${branch}"
        else
            if git branch -d "${branch}" 2>/dev/null; then
                log_success "Deleted branch"
                ((CLEANED++))
            else
                log_error "Failed to delete branch"
                ((FAILED++))
            fi
        fi
    fi

    echo ""

done <<< "${MERGED_BRANCHES}"

# Prune stale worktree metadata
log_info "Pruning stale worktree metadata..."
if [ "${DRY_RUN}" = "true" ]; then
    git worktree prune --dry-run
else
    git worktree prune
    log_success "Pruned stale metadata"
fi

# Update registry
if [ "${DRY_RUN}" != "true" ] && [ -f "${WORKTREE_BASE}/.worktree-registry.jsonl" ]; then
    log_info "Updating worktree registry..."

    TEMP_FILE="${WORKTREE_BASE}/.worktree-registry.jsonl.tmp"
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    awk -v timestamp="${TIMESTAMP}" '
        /"status":"merged"/ && !/"cleaned":/ {
            gsub(/}$/, ",\"cleaned\":\"" timestamp "\"}")
        }
        {print}
    ' "${WORKTREE_BASE}/.worktree-registry.jsonl" > "${TEMP_FILE}"
    mv "${TEMP_FILE}" "${WORKTREE_BASE}/.worktree-registry.jsonl"

    log_success "Registry updated"
fi

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Cleanup Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "${DRY_RUN}" = "true" ]; then
    log_info "DRY RUN - No changes were made"
    log_info "Total branches that would be cleaned: ${BRANCH_COUNT}"
else
    log_success "Successfully cleaned: ${CLEANED}"
    if [ "${FAILED}" -gt 0 ]; then
        log_warning "Failed to clean: ${FAILED}"
    fi
fi

# Show remaining worktrees
REMAINING=$(git worktree list | tail -n +2 | wc -l | tr -d ' ')
log_info "Remaining active worktrees: ${REMAINING}"

echo ""
log_success "Bulk cleanup complete"

if [ "${DRY_RUN}" = "true" ]; then
    log_info "To execute cleanup, run without dry-run flag:"
    log_info "  ./.worktree-scripts/cleanup-all-merged.sh false"
fi
