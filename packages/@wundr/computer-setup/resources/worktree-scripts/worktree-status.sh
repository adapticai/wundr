#!/bin/bash
# worktree-status.sh
# Comprehensive status report for all agent worktrees

set -euo pipefail

# Configuration
REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Print header
echo -e "${BOLD}${CYAN}"
cat << 'EOF'
╔════════════════════════════════════════════════════════════════╗
║          GIT WORKTREE STATUS REPORT                            ║
║          Claude Code Agent Coordination                        ║
╚════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Repository information
echo -e "${BOLD}📁 Repository Information${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Root: ${REPO_ROOT}"
echo "Worktree Base: ${WORKTREE_BASE}"
echo "Current Branch: $(git branch --show-current)"
echo ""

# Registry summary
if [ -f "${WORKTREE_BASE}/.worktree-registry.jsonl" ]; then
    echo -e "${BOLD}📊 Registry Summary${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    TOTAL=$(wc -l < "${WORKTREE_BASE}/.worktree-registry.jsonl" | tr -d ' ')
    ACTIVE=$(grep -c '"status":"active"' "${WORKTREE_BASE}/.worktree-registry.jsonl" 2>/dev/null || echo "0")
    MERGED=$(grep -c '"status":"merged"' "${WORKTREE_BASE}/.worktree-registry.jsonl" 2>/dev/null || echo "0")
    CLEANED=$(grep -c '"status":"cleaned"' "${WORKTREE_BASE}/.worktree-registry.jsonl" 2>/dev/null || echo "0")

    echo "Total Created: ${TOTAL}"
    echo -e "${GREEN}Active: ${ACTIVE}${NC}"
    echo -e "${BLUE}Merged: ${MERGED}${NC}"
    echo -e "${YELLOW}Cleaned: ${CLEANED}${NC}"

    # Agent type breakdown
    echo ""
    echo "By Agent Type:"
    grep -o '"agent":"[^"]*"' "${WORKTREE_BASE}/.worktree-registry.jsonl" | \
        cut -d'"' -f4 | sort | uniq -c | while read count agent; do
        echo "  ${agent}: ${count}"
    done

    echo ""
else
    echo -e "${YELLOW}⚠️  No registry file found${NC}"
    echo ""
fi

# Current worktrees
echo -e "${BOLD}🔍 Active Worktrees${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if git worktree list | tail -n +2 | grep -q .; then
    git worktree list | tail -n +2 | while read -r line; do
        # Parse worktree list output
        WORKTREE_PATH=$(echo "${line}" | awk '{print $1}')
        COMMIT=$(echo "${line}" | awk '{print $2}')
        BRANCH=$(echo "${line}" | grep -o '\[.*\]' | tr -d '[]' || echo "detached")

        WORKTREE_NAME=$(basename "${WORKTREE_PATH}")

        echo ""
        echo -e "${BOLD}📁 ${WORKTREE_NAME}${NC}"
        echo "   Path: ${WORKTREE_PATH}"
        echo "   Branch: ${BRANCH}"
        echo "   Commit: ${COMMIT:0:7}"

        # Get details from worktree
        if [ -d "${WORKTREE_PATH}" ]; then
            cd "${WORKTREE_PATH}"

            # Check for uncommitted changes
            UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')
            if [ "${UNCOMMITTED}" -gt 0 ]; then
                echo -e "   ${YELLOW}⚠️  Uncommitted changes: ${UNCOMMITTED} files${NC}"
            else
                echo -e "   ${GREEN}✓ Clean working tree${NC}"
            fi

            # Commits ahead of base
            if [ "${BRANCH}" != "detached" ]; then
                BASE_BRANCH=$(git show-branch | grep '\*' | grep -v "$(git rev-parse --abbrev-ref HEAD)" | head -1 | sed 's/.*\[\(.*\)\].*/\1/' | sed 's/[\^~].*//' || echo "master")
                COMMITS_AHEAD=$(git rev-list --count "${BASE_BRANCH}..HEAD" 2>/dev/null || echo "0")

                if [ "${COMMITS_AHEAD}" -gt 0 ]; then
                    echo -e "   ${BLUE}ℹ️  Commits ahead: ${COMMITS_AHEAD}${NC}"
                else
                    echo "   Commits ahead: 0"
                fi
            fi

            # Check if merged
            if [ "${BRANCH}" != "detached" ]; then
                if git branch --merged master 2>/dev/null | grep -q "^[* ]*${BRANCH}$"; then
                    echo -e "   ${GREEN}✓ Merged into master${NC}"
                else
                    echo -e "   ${YELLOW}⚠️  Not yet merged${NC}"
                fi
            fi

            # Agent metadata if available
            if [ -f ".agent-metadata.json" ]; then
                AGENT_TYPE=$(grep -o '"agent_type":"[^"]*"' .agent-metadata.json | cut -d'"' -f4)
                TASK_ID=$(grep -o '"task_id":"[^"]*"' .agent-metadata.json | cut -d'"' -f4)
                CREATED=$(grep -o '"created":"[^"]*"' .agent-metadata.json | cut -d'"' -f4)

                echo "   Agent: ${AGENT_TYPE}"
                echo "   Task: ${TASK_ID}"
                echo "   Created: ${CREATED}"
            fi

            cd "${REPO_ROOT}"
        else
            echo -e "   ${RED}❌ Directory not found${NC}"
        fi
    done
else
    echo "No active worktrees"
fi

echo ""

# Disk usage
echo -e "${BOLD}💾 Disk Usage${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -d "${WORKTREE_BASE}" ]; then
    TOTAL_SIZE=$(du -sh "${WORKTREE_BASE}" 2>/dev/null | cut -f1)
    echo "Total worktree disk usage: ${TOTAL_SIZE}"

    # Individual worktree sizes
    if git worktree list | tail -n +2 | grep -q .; then
        echo ""
        echo "By worktree:"
        find "${WORKTREE_BASE}" -maxdepth 1 -type d ! -path "${WORKTREE_BASE}" -exec du -sh {} \; | \
            sort -hr | while read size path; do
            echo "  $(basename ${path}): ${size}"
        done
    fi
else
    echo "No worktree directory"
fi

echo ""

# Stale worktrees check
echo -e "${BOLD}🧹 Maintenance${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for stale worktree metadata
STALE=$(git worktree prune --dry-run 2>&1 || echo "")
if [ -n "${STALE}" ]; then
    echo -e "${YELLOW}⚠️  Stale worktree metadata detected${NC}"
    echo "Run: git worktree prune"
else
    echo -e "${GREEN}✓ No stale worktrees${NC}"
fi

# Check for merged branches that can be cleaned
MERGED_COUNT=$(git branch --merged master | grep 'agents/' | wc -l | tr -d ' ')
if [ "${MERGED_COUNT}" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  ${MERGED_COUNT} merged agent branches can be cleaned${NC}"
    echo "Run: ./.worktree-scripts/cleanup-all-merged.sh"
else
    echo -e "${GREEN}✓ No merged branches to clean${NC}"
fi

# Git repository health
echo ""
echo "Repository health:"
GIT_SIZE=$(du -sh "${REPO_ROOT}/.git" 2>/dev/null | cut -f1)
echo "  .git size: ${GIT_SIZE}"

OBJECT_COUNT=$(git rev-list --objects --all | wc -l | tr -d ' ')
echo "  Object count: ${OBJECT_COUNT}"

echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Report generated: $(date)${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
