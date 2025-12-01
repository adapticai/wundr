#!/bin/bash
# create-agent-worktree.sh
# Creates an isolated git worktree for a Claude Code subagent

set -euo pipefail

# Input parameters
AGENT_TYPE="${1}"           # e.g., "coder", "tester", "reviewer"
TASK_ID="${2}"              # e.g., "auth-001", "suite-002"
BASE_BRANCH="${3:-master}"  # Branch to base work on

# Configuration
REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"
WORKTREE_NAME="${AGENT_TYPE}-${TASK_ID}"
WORKTREE_PATH="${WORKTREE_BASE}/${WORKTREE_NAME}"
BRANCH_NAME="agents/${AGENT_TYPE}/${TASK_ID}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  ${1}${NC}"
}

log_success() {
    echo -e "${GREEN}✅ ${1}${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  ${1}${NC}"
}

log_error() {
    echo -e "${RED}❌ ${1}${NC}"
}

# Validate inputs
if [ -z "${AGENT_TYPE}" ] || [ -z "${TASK_ID}" ]; then
    log_error "Usage: create-agent-worktree.sh <agent-type> <task-id> [base-branch]"
    log_info "Example: create-agent-worktree.sh coder auth-001 master"
    exit 1
fi

# Validate base branch exists
if ! git rev-parse --verify "${BASE_BRANCH}" >/dev/null 2>&1; then
    log_error "Base branch '${BASE_BRANCH}' does not exist"
    git branch -a
    exit 1
fi

# Create worktree base directory if it doesn't exist
mkdir -p "${WORKTREE_BASE}"

# Initialize registry if it doesn't exist
if [ ! -f "${WORKTREE_BASE}/.worktree-registry.jsonl" ]; then
    touch "${WORKTREE_BASE}/.worktree-registry.jsonl"
    log_info "Created worktree registry"
fi

# Check if worktree already exists
if [ -d "${WORKTREE_PATH}" ]; then
    log_warning "Worktree '${WORKTREE_NAME}' already exists"
    log_info "Path: ${WORKTREE_PATH}"

    # Check if it's a valid worktree
    if git worktree list | grep -q "${WORKTREE_PATH}"; then
        log_info "Worktree is still registered in git"
        echo "WORKTREE_PATH=${WORKTREE_PATH}"
        echo "WORKTREE_BRANCH=${BRANCH_NAME}"
        exit 0
    else
        log_warning "Directory exists but not in git worktree list - cleaning up"
        rm -rf "${WORKTREE_PATH}"
    fi
fi

# Check if branch already exists
if git rev-parse --verify "${BRANCH_NAME}" >/dev/null 2>&1; then
    log_warning "Branch '${BRANCH_NAME}' already exists"

    # Check if it's in use by another worktree
    if git worktree list | grep -q "${BRANCH_NAME}"; then
        log_error "Branch in use by another worktree"
        git worktree list | grep "${BRANCH_NAME}"
        exit 1
    fi

    # Check if merged
    if git branch --merged "${BASE_BRANCH}" | grep -q "${BRANCH_NAME}"; then
        log_info "Branch is merged, deleting and recreating"
        git branch -D "${BRANCH_NAME}"
    else
        # Backup existing branch
        BACKUP_NAME="${BRANCH_NAME}-backup-$(date +%s)"
        git branch -m "${BRANCH_NAME}" "${BACKUP_NAME}"
        log_warning "Existing branch backed up to: ${BACKUP_NAME}"
    fi
fi

# Check disk space
AVAILABLE=$(df -k "${REPO_ROOT}" | tail -1 | awk '{print $4}')
REQUIRED=$((100 * 1024))  # 100MB minimum

if [ "${AVAILABLE}" -lt "${REQUIRED}" ]; then
    log_error "Insufficient disk space"
    log_info "Available: $((AVAILABLE / 1024))MB"
    log_info "Required: $((REQUIRED / 1024))MB"
    exit 1
fi

# Create worktree with new branch
log_info "Creating worktree for ${AGENT_TYPE} agent..."
log_info "Task: ${TASK_ID}"
log_info "Base: ${BASE_BRANCH}"

if git worktree add -b "${BRANCH_NAME}" "${WORKTREE_PATH}" "${BASE_BRANCH}"; then
    log_success "Worktree created successfully"

    # Verify creation
    if [ -d "${WORKTREE_PATH}" ]; then
        log_info "Name: ${WORKTREE_NAME}"
        log_info "Path: ${WORKTREE_PATH}"
        log_info "Branch: ${BRANCH_NAME}"

        # Update registry
        TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        echo "{\"name\":\"${WORKTREE_NAME}\",\"path\":\"${WORKTREE_PATH}\",\"branch\":\"${BRANCH_NAME}\",\"agent\":\"${AGENT_TYPE}\",\"task\":\"${TASK_ID}\",\"base\":\"${BASE_BRANCH}\",\"created\":\"${TIMESTAMP}\",\"status\":\"active\"}" >> "${WORKTREE_BASE}/.worktree-registry.jsonl"

        # Create agent metadata file
        cat > "${WORKTREE_PATH}/.agent-metadata.json" << EOF
{
  "worktree_name": "${WORKTREE_NAME}",
  "agent_type": "${AGENT_TYPE}",
  "task_id": "${TASK_ID}",
  "branch": "${BRANCH_NAME}",
  "base_branch": "${BASE_BRANCH}",
  "created": "${TIMESTAMP}",
  "repo_root": "${REPO_ROOT}"
}
EOF

        # Export environment variables for agent use
        echo ""
        log_success "Environment variables:"
        echo "export WORKTREE_PATH=\"${WORKTREE_PATH}\""
        echo "export WORKTREE_BRANCH=\"${BRANCH_NAME}\""
        echo "export AGENT_TYPE=\"${AGENT_TYPE}\""
        echo "export TASK_ID=\"${TASK_ID}\""

        # Output for programmatic use
        echo ""
        echo "WORKTREE_PATH=${WORKTREE_PATH}"
        echo "WORKTREE_BRANCH=${BRANCH_NAME}"

    else
        log_error "Worktree directory not found after creation"
        exit 1
    fi
else
    log_error "Failed to create worktree"
    exit 1
fi
