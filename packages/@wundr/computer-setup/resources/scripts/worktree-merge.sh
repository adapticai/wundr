#!/bin/bash
###############################################################################
# worktree-merge.sh - Merge agent worktree changes back to base branch
#
# Supports multiple merge strategies:
# - auto:    Fast-forward or clean merge (fails on conflicts)
# - squash:  Squash all commits into one
# - pr:      Create a pull request (requires gh cli)
# - manual:  Just report status, let user handle merge
#
# Usage:
#   worktree-merge.sh <worktree-id> [--strategy <auto|squash|pr|manual>]
#   worktree-merge.sh --list              # List pending merges
#   worktree-merge.sh --merge-all         # Merge all completed worktrees
#   worktree-merge.sh --cleanup           # Cleanup merged worktrees
#
# Installed by: wundr computer-setup resource-manager
###############################################################################

set -euo pipefail

VERSION="1.0.0"
WUNDR_DIR="${HOME}/.wundr"
WORKTREE_MANAGER_DIR="${WUNDR_DIR}/resource-manager/worktrees"
WORKTREE_REGISTRY="${WORKTREE_MANAGER_DIR}/active-worktrees.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✅${NC} $*"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}❌${NC} $*"; }

# Ensure jq is available (or use simple grep/sed fallback)
has_jq() {
    command -v jq &>/dev/null
}

# Get worktree entry from registry
get_worktree_entry() {
    local worktree_id="$1"

    if [ ! -f "${WORKTREE_REGISTRY}" ]; then
        echo ""
        return
    fi

    if has_jq; then
        jq -r ".[] | select(.id == \"${worktree_id}\")" "${WORKTREE_REGISTRY}"
    else
        # Simple grep fallback (less reliable)
        grep -A 20 "\"id\": \"${worktree_id}\"" "${WORKTREE_REGISTRY}" | head -20
    fi
}

# Update worktree status in registry
update_worktree_status() {
    local worktree_id="$1"
    local new_status="$2"

    if [ ! -f "${WORKTREE_REGISTRY}" ]; then
        return
    fi

    if has_jq; then
        local tmp_file="${WORKTREE_REGISTRY}.tmp"
        jq "map(if .id == \"${worktree_id}\" then .status = \"${new_status}\" else . end)" \
            "${WORKTREE_REGISTRY}" > "${tmp_file}"
        mv "${tmp_file}" "${WORKTREE_REGISTRY}"
    else
        # Simple sed fallback (fragile, but works for basic cases)
        sed -i.bak "s/\"status\": \"[^\"]*\"/\"status\": \"${new_status}\"/" "${WORKTREE_REGISTRY}"
    fi
}

# List pending worktrees
list_pending() {
    echo -e "${BOLD}${CYAN}Pending Worktree Merges${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if [ ! -f "${WORKTREE_REGISTRY}" ]; then
        log_info "No worktree registry found"
        return
    fi

    if has_jq; then
        local count=0
        while IFS= read -r entry; do
            if [ -n "$entry" ]; then
                local id=$(echo "$entry" | jq -r '.id')
                local status=$(echo "$entry" | jq -r '.status')
                local branch=$(echo "$entry" | jq -r '.branch')
                local agent=$(echo "$entry" | jq -r '.agentType')
                local created=$(echo "$entry" | jq -r '.created')
                local task=$(echo "$entry" | jq -r '.taskDescription' | head -c 60)

                local status_color="${YELLOW}"
                case "$status" in
                    completed) status_color="${GREEN}" ;;
                    merged) status_color="${BLUE}" ;;
                    abandoned) status_color="${RED}" ;;
                esac

                echo -e "${BOLD}${id}${NC}"
                echo -e "  Status:  ${status_color}${status}${NC}"
                echo -e "  Agent:   ${agent}"
                echo -e "  Branch:  ${branch}"
                echo -e "  Created: ${created}"
                echo -e "  Task:    ${task}..."
                echo ""
                ((count++))
            fi
        done < <(jq -c '.[] | select(.status == "active" or .status == "completed")' "${WORKTREE_REGISTRY}")

        if [ $count -eq 0 ]; then
            log_info "No pending worktrees"
        else
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo -e "Total: ${count} pending worktrees"
        fi
    else
        cat "${WORKTREE_REGISTRY}"
    fi
}

# Check for merge conflicts
check_conflicts() {
    local worktree_path="$1"
    local base_branch="$2"

    cd "${worktree_path}"

    # Try a merge dry-run
    if git merge --no-commit --no-ff "${base_branch}" 2>/dev/null; then
        git merge --abort 2>/dev/null || true
        return 0  # No conflicts
    else
        git merge --abort 2>/dev/null || true
        return 1  # Has conflicts
    fi
}

# Perform auto merge (fast-forward or clean merge)
do_auto_merge() {
    local worktree_id="$1"
    local worktree_path="$2"
    local branch="$3"
    local base_branch="$4"
    local repo_root="$5"

    log_info "Attempting auto-merge of ${branch} into ${base_branch}..."

    # Check for conflicts first
    if ! check_conflicts "${worktree_path}" "${base_branch}"; then
        log_error "Conflicts detected. Use --strategy manual or resolve conflicts."
        return 1
    fi

    # Go to repo root and merge
    cd "${repo_root}"

    # Checkout base branch
    git checkout "${base_branch}"

    # Try fast-forward first
    if git merge --ff-only "${branch}" 2>/dev/null; then
        log_success "Fast-forward merge successful"
    else
        # Fall back to regular merge
        git merge "${branch}" -m "Merge ${branch} (agent worktree ${worktree_id})"
        log_success "Merge successful"
    fi

    # Update registry
    update_worktree_status "${worktree_id}" "merged"

    return 0
}

# Perform squash merge
do_squash_merge() {
    local worktree_id="$1"
    local worktree_path="$2"
    local branch="$3"
    local base_branch="$4"
    local repo_root="$5"
    local agent_type="$6"

    log_info "Performing squash merge of ${branch} into ${base_branch}..."

    cd "${repo_root}"
    git checkout "${base_branch}"

    # Squash merge
    if git merge --squash "${branch}"; then
        # Get commit count and summary
        local commit_count=$(git log "${base_branch}..${branch}" --oneline | wc -l | tr -d ' ')

        # Create commit message
        local commit_msg="feat(${agent_type}): merge agent worktree ${worktree_id}

Squashed ${commit_count} commits from ${branch}

Agent: ${agent_type}
Worktree ID: ${worktree_id}
"
        git commit -m "${commit_msg}"
        log_success "Squash merge successful (${commit_count} commits squashed)"

        # Update registry
        update_worktree_status "${worktree_id}" "merged"
        return 0
    else
        log_error "Squash merge failed. Resolve conflicts manually."
        git merge --abort 2>/dev/null || true
        return 1
    fi
}

# Create pull request (requires gh cli)
do_pr_merge() {
    local worktree_id="$1"
    local worktree_path="$2"
    local branch="$3"
    local base_branch="$4"
    local agent_type="$5"
    local task_description="$6"

    if ! command -v gh &>/dev/null; then
        log_error "GitHub CLI (gh) not found. Install with: brew install gh"
        return 1
    fi

    log_info "Creating pull request for ${branch}..."

    cd "${worktree_path}"

    # Push branch to remote
    git push -u origin "${branch}" 2>/dev/null || git push origin "${branch}"

    # Create PR
    local pr_title="[${agent_type}] Agent worktree ${worktree_id}"
    local pr_body="## Agent Worktree Merge

**Agent Type:** ${agent_type}
**Worktree ID:** ${worktree_id}
**Base Branch:** ${base_branch}

### Task Description
${task_description}

### Commits
$(git log "${base_branch}..HEAD" --oneline)

---
🤖 Created by Claude Code Resource Manager
"

    local pr_url=$(gh pr create \
        --title "${pr_title}" \
        --body "${pr_body}" \
        --base "${base_branch}" \
        --head "${branch}" \
        2>&1)

    if [ $? -eq 0 ]; then
        log_success "Pull request created: ${pr_url}"
        update_worktree_status "${worktree_id}" "pr-pending"
        return 0
    else
        log_error "Failed to create PR: ${pr_url}"
        return 1
    fi
}

# Manual merge - just show status and instructions
do_manual_merge() {
    local worktree_id="$1"
    local worktree_path="$2"
    local branch="$3"
    local base_branch="$4"
    local repo_root="$5"

    echo ""
    echo -e "${BOLD}Manual Merge Instructions${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "Worktree: ${CYAN}${worktree_path}${NC}"
    echo -e "Branch:   ${CYAN}${branch}${NC}"
    echo -e "Base:     ${CYAN}${base_branch}${NC}"
    echo ""

    # Show commits
    echo -e "${BOLD}Commits to merge:${NC}"
    cd "${worktree_path}"
    git log "${base_branch}..HEAD" --oneline 2>/dev/null || echo "  (no commits)"
    echo ""

    # Show changed files
    echo -e "${BOLD}Changed files:${NC}"
    git diff "${base_branch}..HEAD" --stat 2>/dev/null || echo "  (no changes)"
    echo ""

    # Check for conflicts
    if check_conflicts "${worktree_path}" "${base_branch}"; then
        echo -e "${GREEN}✓ No conflicts detected - clean merge possible${NC}"
    else
        echo -e "${YELLOW}⚠ Conflicts detected - manual resolution required${NC}"
    fi
    echo ""

    echo -e "${BOLD}To merge manually:${NC}"
    echo "  cd ${repo_root}"
    echo "  git checkout ${base_branch}"
    echo "  git merge ${branch}"
    echo ""
    echo -e "${BOLD}To squash merge:${NC}"
    echo "  cd ${repo_root}"
    echo "  git checkout ${base_branch}"
    echo "  git merge --squash ${branch}"
    echo "  git commit -m 'Merge agent worktree ${worktree_id}'"
    echo ""
}

# Cleanup merged worktrees
cleanup_merged() {
    log_info "Cleaning up merged worktrees..."

    if [ ! -f "${WORKTREE_REGISTRY}" ]; then
        log_info "No worktree registry found"
        return
    fi

    local cleaned=0

    if has_jq; then
        while IFS= read -r entry; do
            if [ -n "$entry" ]; then
                local id=$(echo "$entry" | jq -r '.id')
                local path=$(echo "$entry" | jq -r '.path')
                local branch=$(echo "$entry" | jq -r '.branch')

                log_info "Cleaning up ${id}..."

                # Remove worktree
                if [ -d "$path" ]; then
                    local repo_root=$(dirname "$(dirname "$path")")
                    cd "$repo_root"
                    git worktree remove "$path" --force 2>/dev/null || rm -rf "$path"
                fi

                # Delete branch
                git branch -D "$branch" 2>/dev/null || true

                ((cleaned++))
            fi
        done < <(jq -c '.[] | select(.status == "merged")' "${WORKTREE_REGISTRY}")

        # Remove merged entries from registry
        jq '[.[] | select(.status != "merged")]' "${WORKTREE_REGISTRY}" > "${WORKTREE_REGISTRY}.tmp"
        mv "${WORKTREE_REGISTRY}.tmp" "${WORKTREE_REGISTRY}"
    fi

    # Also run git worktree prune
    git worktree prune 2>/dev/null || true

    log_success "Cleaned up ${cleaned} merged worktrees"
}

# Merge all completed worktrees
merge_all() {
    local strategy="${1:-auto}"

    log_info "Merging all completed worktrees with strategy: ${strategy}"

    if [ ! -f "${WORKTREE_REGISTRY}" ]; then
        log_info "No worktree registry found"
        return
    fi

    local merged=0
    local failed=0

    if has_jq; then
        while IFS= read -r entry; do
            if [ -n "$entry" ]; then
                local id=$(echo "$entry" | jq -r '.id')
                log_info "Processing ${id}..."

                if merge_worktree "${id}" "${strategy}"; then
                    ((merged++))
                else
                    ((failed++))
                fi
            fi
        done < <(jq -c '.[] | select(.status == "completed")' "${WORKTREE_REGISTRY}")
    fi

    echo ""
    log_success "Merged: ${merged}, Failed: ${failed}"
}

# Main merge function
merge_worktree() {
    local worktree_id="$1"
    local strategy="${2:-auto}"

    # Get worktree entry
    if [ ! -f "${WORKTREE_REGISTRY}" ]; then
        log_error "Worktree registry not found"
        return 1
    fi

    if ! has_jq; then
        log_error "jq is required for merge operations. Install with: brew install jq"
        return 1
    fi

    local entry=$(jq -c ".[] | select(.id == \"${worktree_id}\")" "${WORKTREE_REGISTRY}")

    if [ -z "$entry" ]; then
        log_error "Worktree ${worktree_id} not found in registry"
        return 1
    fi

    local worktree_path=$(echo "$entry" | jq -r '.path')
    local branch=$(echo "$entry" | jq -r '.branch')
    local base_branch=$(echo "$entry" | jq -r '.baseBranch')
    local agent_type=$(echo "$entry" | jq -r '.agentType')
    local task_description=$(echo "$entry" | jq -r '.taskDescription')
    local status=$(echo "$entry" | jq -r '.status')

    # Validate worktree exists
    if [ ! -d "${worktree_path}" ]; then
        log_error "Worktree directory not found: ${worktree_path}"
        update_worktree_status "${worktree_id}" "abandoned"
        return 1
    fi

    # Get repo root
    local repo_root=$(cd "${worktree_path}" && git rev-parse --show-toplevel 2>/dev/null)
    if [ -z "$repo_root" ]; then
        repo_root=$(dirname "$(dirname "${worktree_path}")")
    fi

    echo ""
    echo -e "${BOLD}Merging Worktree: ${worktree_id}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "Strategy: ${CYAN}${strategy}${NC}"
    echo -e "Branch:   ${branch} → ${base_branch}"
    echo ""

    case "$strategy" in
        auto)
            do_auto_merge "${worktree_id}" "${worktree_path}" "${branch}" "${base_branch}" "${repo_root}"
            ;;
        squash)
            do_squash_merge "${worktree_id}" "${worktree_path}" "${branch}" "${base_branch}" "${repo_root}" "${agent_type}"
            ;;
        pr)
            do_pr_merge "${worktree_id}" "${worktree_path}" "${branch}" "${base_branch}" "${agent_type}" "${task_description}"
            ;;
        manual)
            do_manual_merge "${worktree_id}" "${worktree_path}" "${branch}" "${base_branch}" "${repo_root}"
            ;;
        *)
            log_error "Unknown strategy: ${strategy}"
            log_info "Valid strategies: auto, squash, pr, manual"
            return 1
            ;;
    esac
}

# Show help
show_help() {
    echo "worktree-merge.sh v${VERSION}"
    echo ""
    echo "Merge agent worktree changes back to base branch"
    echo ""
    echo "Usage:"
    echo "  worktree-merge.sh <worktree-id> [--strategy <auto|squash|pr|manual>]"
    echo "  worktree-merge.sh --list"
    echo "  worktree-merge.sh --merge-all [--strategy <strategy>]"
    echo "  worktree-merge.sh --cleanup"
    echo ""
    echo "Strategies:"
    echo "  auto     Fast-forward or clean merge (default, fails on conflicts)"
    echo "  squash   Squash all commits into one"
    echo "  pr       Create a pull request (requires gh cli)"
    echo "  manual   Show status and instructions for manual merge"
    echo ""
    echo "Options:"
    echo "  --list       List pending worktree merges"
    echo "  --merge-all  Merge all completed worktrees"
    echo "  --cleanup    Remove merged worktrees and branches"
    echo "  --help       Show this help"
    echo ""
}

# Main entry point
main() {
    case "${1:-}" in
        --help|-h)
            show_help
            ;;
        --list|-l)
            list_pending
            ;;
        --merge-all)
            shift
            local strategy="auto"
            if [ "${1:-}" = "--strategy" ]; then
                strategy="${2:-auto}"
            fi
            merge_all "${strategy}"
            ;;
        --cleanup)
            cleanup_merged
            ;;
        --version)
            echo "worktree-merge.sh v${VERSION}"
            ;;
        "")
            show_help
            ;;
        *)
            local worktree_id="$1"
            shift
            local strategy="auto"

            while [ $# -gt 0 ]; do
                case "$1" in
                    --strategy|-s)
                        strategy="${2:-auto}"
                        shift 2
                        ;;
                    --auto)
                        strategy="auto"
                        shift
                        ;;
                    *)
                        shift
                        ;;
                esac
            done

            merge_worktree "${worktree_id}" "${strategy}"
            ;;
    esac
}

main "$@"
