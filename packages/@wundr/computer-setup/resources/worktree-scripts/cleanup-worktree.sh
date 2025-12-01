#!/bin/bash
# cleanup-worktree.sh
# Cleans up agent worktree and associated branch after merge

set -euo pipefail

# Input parameters
WORKTREE_NAME="${1}"
FORCE_CLEANUP="${2:-false}"  # Set to "true" to cleanup unmerged work

# Configuration
REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"
WORKTREE_PATH="${WORKTREE_BASE}/${WORKTREE_NAME}"

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

# Validate inputs
if [ -z "${WORKTREE_NAME}" ]; then
    log_error "Usage: cleanup-worktree.sh <worktree-name> [force]"
    log_info "Example: cleanup-worktree.sh coder-auth-001"
    log_info "         cleanup-worktree.sh coder-auth-001 true  # Force cleanup unmerged work"
    exit 1
fi

# Verify worktree exists
if [ ! -d "${WORKTREE_PATH}" ]; then
    log_warning "Worktree '${WORKTREE_NAME}' not found at ${WORKTREE_PATH}"

    # Check if it's in git worktree list
    if git worktree list | grep -q "${WORKTREE_NAME}"; then
        log_info "Worktree registered in git but directory missing"
        log_info "Running git worktree prune..."
        git worktree prune
    fi

    log_info "Nothing to clean up"
    exit 0
fi

# Get branch name before removal
cd "${WORKTREE_PATH}"
BRANCH_NAME=$(git branch --show-current)

if [ -z "${BRANCH_NAME}" ]; then
    log_warning "Could not determine branch name (detached HEAD?)"
    BRANCH_NAME=""
fi

log_info "Cleaning up worktree: ${WORKTREE_NAME}"
if [ -n "${BRANCH_NAME}" ]; then
    log_info "Branch: ${BRANCH_NAME}"
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    log_warning "Uncommitted changes detected:"
    git status --short

    if [ "${FORCE_CLEANUP}" != "true" ]; then
        log_error "Cannot cleanup worktree with uncommitted changes"
        log_info "Either commit the changes or use force cleanup:"
        log_info "  cleanup-worktree.sh ${WORKTREE_NAME} true"
        exit 1
    else
        log_warning "Force cleanup: Discarding uncommitted changes"
    fi
fi

# Check if branch is merged
cd "${REPO_ROOT}"
MERGED="false"
if [ -n "${BRANCH_NAME}" ]; then
    if git branch --merged master | grep -q "^[* +]*${BRANCH_NAME}$"; then
        MERGED="true"
        log_success "Branch is merged into master"
    else
        log_warning "Branch is NOT merged into master"
    fi
fi

# Safety check for unmerged work
if [ "${MERGED}" = "false" ] && [ "${FORCE_CLEANUP}" != "true" ] && [ -n "${BRANCH_NAME}" ]; then
    log_error "Branch '${BRANCH_NAME}' is not merged"
    log_warning "This will DELETE unmerged work!"
    echo ""
    log_info "Options:"
    echo "  1. Merge first: ./merge-agent-work.sh ${WORKTREE_NAME}"
    echo "  2. Force cleanup: ./cleanup-worktree.sh ${WORKTREE_NAME} true"
    exit 1
fi

# Check for unpushed commits
if [ -n "${BRANCH_NAME}" ]; then
    UNPUSHED=$(git rev-list --count "origin/master..${BRANCH_NAME}" 2>/dev/null || echo "unknown")
    if [ "${UNPUSHED}" != "0" ] && [ "${UNPUSHED}" != "unknown" ]; then
        log_warning "Branch has ${UNPUSHED} unpushed commits"
    fi
fi

# Confirmation for force cleanup
if [ "${FORCE_CLEANUP}" = "true" ] && [ "${MERGED}" = "false" ]; then
    log_warning "FORCE CLEANUP - Unmerged work will be lost!"
    read -p "Are you sure? Type 'yes' to confirm: " -r
    if [ "${REPLY}" != "yes" ]; then
        log_info "Cleanup cancelled"
        exit 0
    fi
fi

# Remove worktree
log_info "Removing worktree..."
if git worktree remove "${WORKTREE_PATH}" --force; then
    log_success "Worktree removed"
else
    log_error "Failed to remove worktree"
    log_info "Attempting manual cleanup..."
    rm -rf "${WORKTREE_PATH}"
    git worktree prune
    log_success "Manual cleanup complete"
fi

# Delete branch if appropriate
if [ -n "${BRANCH_NAME}" ]; then
    if [ "${FORCE_CLEANUP}" = "true" ] || [ "${MERGED}" = "true" ]; then
        log_info "Deleting branch: ${BRANCH_NAME}"

        if [ "${MERGED}" = "true" ]; then
            # Use -d for merged branches (safe delete)
            if git branch -d "${BRANCH_NAME}" 2>/dev/null; then
                log_success "Branch deleted (merged)"
            else
                # Fallback to force delete
                git branch -D "${BRANCH_NAME}"
                log_success "Branch deleted (forced)"
            fi
        else
            # Force delete for unmerged branches
            git branch -D "${BRANCH_NAME}"
            log_success "Branch deleted (forced, unmerged)"
        fi
    else
        log_info "Keeping branch: ${BRANCH_NAME}"
        log_info "Delete manually with: git branch -D ${BRANCH_NAME}"
    fi
fi

# Update registry
if [ -f "${WORKTREE_BASE}/.worktree-registry.jsonl" ]; then
    TEMP_FILE="${WORKTREE_BASE}/.worktree-registry.jsonl.tmp"
    awk -v name="${WORKTREE_NAME}" -v timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")" '
        /"name":"'${WORKTREE_NAME}'"/ {
            gsub(/"status":"[^"]*"/, "\"status\":\"cleaned\"")
            gsub(/}$/, ",\"cleaned\":\"" timestamp "\"}")
        }
        {print}
    ' "${WORKTREE_BASE}/.worktree-registry.jsonl" > "${TEMP_FILE}"
    mv "${TEMP_FILE}" "${WORKTREE_BASE}/.worktree-registry.jsonl"

    log_info "Updated worktree registry"
fi

log_success "Cleanup complete for ${WORKTREE_NAME}"

# Show remaining worktrees
REMAINING=$(git worktree list | tail -n +2 | wc -l | tr -d ' ')
if [ "${REMAINING}" -gt 0 ]; then
    log_info "Remaining worktrees: ${REMAINING}"
else
    log_success "No worktrees remaining"
fi
