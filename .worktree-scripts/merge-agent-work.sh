#!/bin/bash
# merge-agent-work.sh
# Merges completed agent work from worktree back to target branch

set -euo pipefail

# Input parameters
WORKTREE_NAME="${1}"
TARGET_BRANCH="${2:-master}"
MERGE_STRATEGY="${3:-no-ff}"  # no-ff, squash, rebase

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
    log_error "Usage: merge-agent-work.sh <worktree-name> [target-branch] [merge-strategy]"
    log_info "Example: merge-agent-work.sh coder-auth-001 master no-ff"
    exit 1
fi

# Verify worktree exists
if [ ! -d "${WORKTREE_PATH}" ]; then
    log_error "Worktree '${WORKTREE_NAME}' not found at ${WORKTREE_PATH}"
    log_info "Available worktrees:"
    git worktree list
    exit 1
fi

# Get agent branch name
cd "${WORKTREE_PATH}"
AGENT_BRANCH=$(git branch --show-current)

if [ -z "${AGENT_BRANCH}" ]; then
    log_error "Could not determine current branch in worktree"
    exit 1
fi

log_info "Merging agent work"
log_info "Worktree: ${WORKTREE_NAME}"
log_info "Branch: ${AGENT_BRANCH}"
log_info "Target: ${TARGET_BRANCH}"
log_info "Strategy: ${MERGE_STRATEGY}"

# Check for uncommitted changes in worktree
if [ -n "$(git status --porcelain)" ]; then
    log_warning "Uncommitted changes detected in worktree"
    git status --short

    read -p "Commit these changes before merging? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "chore: Auto-commit before merge

🤖 Generated with Claude Code Agent
Worktree: ${WORKTREE_NAME}
Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
        log_success "Changes committed"
    else
        log_error "Cannot merge with uncommitted changes"
        exit 1
    fi
fi

# Get commit count and summary
COMMIT_COUNT=$(git rev-list --count "${TARGET_BRANCH}..HEAD")
log_info "Commits to merge: ${COMMIT_COUNT}"

if [ "${COMMIT_COUNT}" -eq 0 ]; then
    log_warning "No new commits to merge"
    exit 0
fi

# Switch to main repo and target branch
cd "${REPO_ROOT}"

# Stash any uncommitted changes in main repo
STASH_NEEDED=false
if [ -n "$(git status --porcelain)" ]; then
    log_warning "Stashing uncommitted changes in main repo"
    git stash push -m "Auto-stash before agent merge"
    STASH_NEEDED=true
fi

git checkout "${TARGET_BRANCH}"

# Pull latest changes
log_info "Updating target branch..."
if git pull origin "${TARGET_BRANCH}" 2>/dev/null; then
    log_success "Target branch updated"
else
    log_warning "Could not pull from remote (may not exist or no network)"
fi

# Perform merge based on strategy
log_info "Executing merge strategy: ${MERGE_STRATEGY}"

case "${MERGE_STRATEGY}" in
    "no-ff")
        if git merge --no-ff "${AGENT_BRANCH}" -m "Merge agent work: ${WORKTREE_NAME}

Agent: $(echo "${WORKTREE_NAME}" | cut -d'-' -f1)
Task: $(echo "${WORKTREE_NAME}" | cut -d'-' -f2-)
Commits: ${COMMIT_COUNT}

🤖 Generated with Claude Code Agent Swarm"; then
            log_success "Merge successful (no-ff)"
            MERGE_SUCCESS=true
        else
            MERGE_SUCCESS=false
        fi
        ;;

    "squash")
        if git merge --squash "${AGENT_BRANCH}"; then
            # Get commit summary for squash message
            COMMITS=$(cd "${WORKTREE_PATH}" && git log "${TARGET_BRANCH}..HEAD" --oneline)

            git commit -m "feat: ${WORKTREE_NAME}

$(echo "${COMMITS}" | sed 's/^/  - /')

🤖 Generated with Claude Code Agent
Worktree: ${WORKTREE_NAME}
Commits squashed: ${COMMIT_COUNT}"

            log_success "Squash merge successful"
            MERGE_SUCCESS=true
        else
            MERGE_SUCCESS=false
        fi
        ;;

    "rebase")
        # Rebase in worktree first
        cd "${WORKTREE_PATH}"
        if git rebase "${TARGET_BRANCH}"; then
            cd "${REPO_ROOT}"
            if git merge --ff-only "${AGENT_BRANCH}"; then
                log_success "Fast-forward merge after rebase successful"
                MERGE_SUCCESS=true
            else
                log_error "Fast-forward merge failed after rebase"
                MERGE_SUCCESS=false
            fi
        else
            log_error "Rebase failed"
            git rebase --abort
            cd "${REPO_ROOT}"
            MERGE_SUCCESS=false
        fi
        ;;

    *)
        log_error "Unknown merge strategy: ${MERGE_STRATEGY}"
        log_info "Valid strategies: no-ff, squash, rebase"
        exit 1
        ;;
esac

# Handle merge result
if [ "${MERGE_SUCCESS}" = true ]; then
    log_success "Merge completed successfully"

    # Update worktree registry
    if [ -f "${WORKTREE_BASE}/.worktree-registry.jsonl" ]; then
        # Mark as merged in registry (macOS compatible)
        TEMP_FILE="${WORKTREE_BASE}/.worktree-registry.jsonl.tmp"
        awk -v name="${WORKTREE_NAME}" '
            /"name":"'${WORKTREE_NAME}'"/ {
                gsub(/"status":"active"/, "\"status\":\"merged\"")
            }
            {print}
        ' "${WORKTREE_BASE}/.worktree-registry.jsonl" > "${TEMP_FILE}"
        mv "${TEMP_FILE}" "${WORKTREE_BASE}/.worktree-registry.jsonl"

        log_info "Updated worktree registry"
    fi

    # Restore stash if needed
    if [ "${STASH_NEEDED}" = true ]; then
        log_info "Restoring stashed changes"
        git stash pop
    fi

    echo ""
    log_success "Agent work merged into ${TARGET_BRANCH}"
    log_info "You can now cleanup the worktree with:"
    log_info "  ./cleanup-worktree.sh ${WORKTREE_NAME}"

    exit 0
else
    log_error "MERGE CONFLICT DETECTED"
    log_warning "Manual resolution required for: ${AGENT_BRANCH}"
    echo ""
    log_info "Files in conflict:"
    git diff --name-only --diff-filter=U | while read file; do
        echo "  - ${file}"
    done

    echo ""
    log_info "Resolution steps:"
    echo "  1. Resolve conflicts manually"
    echo "  2. git add <resolved-files>"
    echo "  3. git commit"
    echo "  4. Re-run this script or cleanup worktree"

    exit 1
fi
