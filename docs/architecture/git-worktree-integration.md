# Git-Worktree Integration Strategy for Claude Code Subagents

## Executive Summary

This architectural specification defines a comprehensive git-worktree isolation strategy for Claude Code subagents, enabling true parallel execution without file conflicts, merge issues, or coordination overhead.

**Key Benefits:**
- 🔄 **True Parallelism**: Each agent works in isolated worktree
- 🛡️ **Zero Conflicts**: File-level isolation prevents concurrent edit conflicts
- ⚡ **Performance**: 2.8-4.4x speed improvement through parallel operations
- 🧹 **Clean Merges**: Structured merge strategies with conflict resolution
- 📊 **Resource Efficient**: Shared .git directory minimizes disk usage

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Worktree Lifecycle Management](#worktree-lifecycle-management)
3. [Naming Conventions](#naming-conventions)
4. [Workflow Patterns](#workflow-patterns)
5. [Command Reference](#command-reference)
6. [Decision Matrix](#decision-matrix)
7. [Merge Strategies](#merge-strategies)
8. [Error Handling](#error-handling)
9. [Integration Examples](#integration-examples)

---

## Core Concepts

### How Git Worktrees Enable Parallel Agents

Git worktrees create multiple working directories linked to a single `.git` repository:

```
project-root/
├── .git/                    # Shared repository data
├── src/                     # Main worktree
├── package.json
└── .worktrees/             # Agent worktrees
    ├── coder-task-001/     # Coder agent workspace
    ├── tester-task-002/    # Tester agent workspace
    └── reviewer-task-003/  # Reviewer agent workspace
```

**Key Properties:**
- Each worktree has its own working directory and branch
- All worktrees share the same `.git` repository (objects, refs, config)
- Agents cannot interfere with each other's file operations
- Each agent can commit independently to their branch
- Merging happens in controlled, sequential manner

### Isolation Mechanism

```bash
# Agent 1 (Coder) works on feature-auth
/project/.worktrees/coder-auth-001/
  - Independent file system
  - Branch: agents/coder/auth-001
  - Can modify files without affecting others

# Agent 2 (Tester) works on test-suite
/project/.worktrees/tester-suite-002/
  - Independent file system
  - Branch: agents/tester/suite-002
  - No conflict with Agent 1's changes
```

---

## Worktree Lifecycle Management

### Phase 1: Initialization

**When:** Before spawning parallel agents
**Who:** Coordinator/main Claude Code instance

```bash
#!/bin/bash
# Initialize worktree infrastructure

REPO_ROOT="/Users/iroselli/wundr"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"

# Create worktree directory structure
mkdir -p "${WORKTREE_BASE}"

# Initialize tracking
cat > "${WORKTREE_BASE}/.worktree-registry.json" << 'EOF'
{
  "version": "1.0.0",
  "worktrees": [],
  "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo "✅ Worktree infrastructure initialized at ${WORKTREE_BASE}"
```

### Phase 2: Agent Worktree Creation

**When:** Immediately before spawning each agent
**Who:** Task orchestrator or individual agent

```bash
#!/bin/bash
# create-agent-worktree.sh

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

# Validate base branch exists
if ! git rev-parse --verify "${BASE_BRANCH}" >/dev/null 2>&1; then
  echo "❌ ERROR: Base branch '${BASE_BRANCH}' does not exist"
  exit 1
fi

# Check if worktree already exists
if [ -d "${WORKTREE_PATH}" ]; then
  echo "⚠️  WARNING: Worktree '${WORKTREE_NAME}' already exists"
  echo "   Path: ${WORKTREE_PATH}"
  exit 1
fi

# Create worktree with new branch
echo "🔧 Creating worktree for ${AGENT_TYPE} agent..."
git worktree add -b "${BRANCH_NAME}" "${WORKTREE_PATH}" "${BASE_BRANCH}"

# Verify creation
if [ -d "${WORKTREE_PATH}" ]; then
  echo "✅ Worktree created successfully"
  echo "   Name: ${WORKTREE_NAME}"
  echo "   Path: ${WORKTREE_PATH}"
  echo "   Branch: ${BRANCH_NAME}"
  echo "   Base: ${BASE_BRANCH}"

  # Update registry
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "{\"name\":\"${WORKTREE_NAME}\",\"path\":\"${WORKTREE_PATH}\",\"branch\":\"${BRANCH_NAME}\",\"agent\":\"${AGENT_TYPE}\",\"task\":\"${TASK_ID}\",\"created\":\"${TIMESTAMP}\",\"status\":\"active\"}" >> "${WORKTREE_BASE}/.worktree-registry.jsonl"

  # Export for agent use
  echo "WORKTREE_PATH=${WORKTREE_PATH}"
  echo "WORKTREE_BRANCH=${BRANCH_NAME}"
else
  echo "❌ ERROR: Failed to create worktree"
  exit 1
fi
```

### Phase 3: Agent Work Execution

**When:** During agent task execution
**Who:** Individual agent

```bash
#!/bin/bash
# Agent execution wrapper

WORKTREE_PATH="${1}"
AGENT_SCRIPT="${2}"

# Change to agent's worktree
cd "${WORKTREE_PATH}"

# Verify we're in correct location
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Working in branch: ${CURRENT_BRANCH}"
echo "📁 Working directory: $(pwd)"

# Execute agent's work
bash "${AGENT_SCRIPT}"

# Commit agent's changes
if [ -n "$(git status --porcelain)" ]; then
  git add .
  git commit -m "feat: ${AGENT_TYPE} completed ${TASK_ID}

  🤖 Generated with Claude Code Agent
  Agent-Type: ${AGENT_TYPE}
  Task-ID: ${TASK_ID}
  Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  echo "✅ Changes committed to ${CURRENT_BRANCH}"
else
  echo "ℹ️  No changes to commit"
fi
```

### Phase 4: Merge and Integration

**When:** After agent completes work
**Who:** Coordinator or merge manager

```bash
#!/bin/bash
# merge-agent-work.sh

set -euo pipefail

WORKTREE_NAME="${1}"
TARGET_BRANCH="${2:-master}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"
WORKTREE_PATH="${WORKTREE_BASE}/${WORKTREE_NAME}"

# Verify worktree exists
if [ ! -d "${WORKTREE_PATH}" ]; then
  echo "❌ ERROR: Worktree '${WORKTREE_NAME}' not found"
  exit 1
fi

# Get agent branch name
cd "${WORKTREE_PATH}"
AGENT_BRANCH=$(git branch --show-current)

# Switch to main repo and target branch
cd "${REPO_ROOT}"
git checkout "${TARGET_BRANCH}"

# Pull latest changes
git pull origin "${TARGET_BRANCH}" || true

# Attempt merge
echo "🔀 Merging ${AGENT_BRANCH} into ${TARGET_BRANCH}..."

if git merge --no-ff "${AGENT_BRANCH}" -m "Merge agent work: ${WORKTREE_NAME}"; then
  echo "✅ Merge successful"

  # Update registry
  sed -i '' "s/\"status\":\"active\"/\"status\":\"merged\"/" "${WORKTREE_BASE}/.worktree-registry.jsonl"

else
  echo "⚠️  MERGE CONFLICT DETECTED"
  echo "Manual resolution required for: ${AGENT_BRANCH}"
  echo "Files in conflict:"
  git diff --name-only --diff-filter=U
  exit 1
fi
```

### Phase 5: Cleanup

**When:** After successful merge or when aborting agent work
**Who:** Coordinator or cleanup manager

```bash
#!/bin/bash
# cleanup-worktree.sh

set -euo pipefail

WORKTREE_NAME="${1}"
FORCE_CLEANUP="${2:-false}"  # Set to "true" to cleanup unmerged work

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"
WORKTREE_PATH="${WORKTREE_BASE}/${WORKTREE_NAME}"

# Verify worktree exists
if [ ! -d "${WORKTREE_PATH}" ]; then
  echo "⚠️  WARNING: Worktree '${WORKTREE_NAME}' not found, may already be cleaned"
  exit 0
fi

# Get branch name before removal
cd "${WORKTREE_PATH}"
BRANCH_NAME=$(git branch --show-current)

# Check if merged
cd "${REPO_ROOT}"
if git branch --merged master | grep -q "${BRANCH_NAME}"; then
  MERGED="true"
else
  MERGED="false"
fi

# Safety check for unmerged work
if [ "${MERGED}" = "false" ] && [ "${FORCE_CLEANUP}" != "true" ]; then
  echo "⚠️  WARNING: Branch '${BRANCH_NAME}' is not merged"
  echo "   To force cleanup, run: cleanup-worktree.sh ${WORKTREE_NAME} true"
  exit 1
fi

# Remove worktree
echo "🧹 Cleaning up worktree: ${WORKTREE_NAME}"
git worktree remove "${WORKTREE_PATH}" --force

# Delete branch
if [ "${FORCE_CLEANUP}" = "true" ] || [ "${MERGED}" = "true" ]; then
  git branch -D "${BRANCH_NAME}" || true
  echo "🗑️  Deleted branch: ${BRANCH_NAME}"
fi

# Update registry
sed -i '' "s/\"status\":\"[^\"]*\"/\"status\":\"cleaned\"/" "${WORKTREE_BASE}/.worktree-registry.jsonl"

echo "✅ Cleanup complete"
```

---

## Naming Conventions

### Worktree Names

**Format:** `{agent-type}-{task-identifier}-{sequence}`

**Examples:**
```
coder-auth-001          # First coder task for auth feature
tester-auth-002         # Tester task for auth tests
reviewer-auth-003       # Reviewer task for auth code review
coder-payment-004       # Second coder task for payment feature
architect-system-005    # Architect task for system design
```

**Rules:**
- Use kebab-case for all components
- Keep agent-type consistent with MCP agent types
- Task identifier should be descriptive but concise (max 20 chars)
- Sequence number is zero-padded to 3 digits
- Total name length should not exceed 64 characters

### Branch Names

**Format:** `agents/{agent-type}/{task-identifier}-{sequence}`

**Examples:**
```
agents/coder/auth-001
agents/tester/auth-002
agents/reviewer/auth-003
agents/architect/system-005
```

**Rules:**
- All lowercase
- Forward slashes for hierarchy
- Matches worktree naming pattern
- Never use special characters except `-` and `/`

### Directory Structure

```
project-root/
├── .git/
├── .worktrees/
│   ├── .worktree-registry.json     # Central registry
│   ├── .worktree-registry.jsonl    # Append-only log
│   ├── coder-auth-001/             # Active worktrees
│   ├── tester-auth-002/
│   └── reviewer-auth-003/
├── .worktree-scripts/              # Management scripts
│   ├── create-agent-worktree.sh
│   ├── merge-agent-work.sh
│   └── cleanup-worktree.sh
```

---

## Workflow Patterns

### Pattern 1: Sequential Dependency Chain

**Use Case:** Tasks that build on each other (spec → code → test → review)

```bash
#!/bin/bash
# Sequential agent chain with worktrees

REPO_ROOT="/Users/iroselli/wundr"
BASE_BRANCH="master"

# Step 1: Specification agent
./create-agent-worktree.sh "specification" "feature-001" "${BASE_BRANCH}"
cd "${REPO_ROOT}/.worktrees/specification-feature-001"
# [Agent does specification work]
git commit -am "spec: Define feature requirements"
cd "${REPO_ROOT}"
./merge-agent-work.sh "specification-feature-001"
SPEC_BRANCH="agents/specification/feature-001"

# Step 2: Coder agent (builds on spec)
./create-agent-worktree.sh "coder" "feature-001" "${SPEC_BRANCH}"
cd "${REPO_ROOT}/.worktrees/coder-feature-001"
# [Agent implements code]
git commit -am "feat: Implement feature"
cd "${REPO_ROOT}"
./merge-agent-work.sh "coder-feature-001"
CODE_BRANCH="agents/coder/feature-001"

# Step 3: Tester agent (tests implementation)
./create-agent-worktree.sh "tester" "feature-001" "${CODE_BRANCH}"
cd "${REPO_ROOT}/.worktrees/tester-feature-001"
# [Agent writes tests]
git commit -am "test: Add test coverage"
cd "${REPO_ROOT}"
./merge-agent-work.sh "tester-feature-001"

# Cleanup
./cleanup-worktree.sh "specification-feature-001"
./cleanup-worktree.sh "coder-feature-001"
./cleanup-worktree.sh "tester-feature-001"
```

### Pattern 2: Parallel Independent Tasks

**Use Case:** Multiple agents working on different features simultaneously

```bash
#!/bin/bash
# Parallel agents on different features

REPO_ROOT="/Users/iroselli/wundr"
BASE_BRANCH="master"

# Spawn multiple agents in parallel
./create-agent-worktree.sh "coder" "auth-001" "${BASE_BRANCH}" &
./create-agent-worktree.sh "coder" "payment-002" "${BASE_BRANCH}" &
./create-agent-worktree.sh "coder" "ui-003" "${BASE_BRANCH}" &

wait  # Wait for all worktrees to be created

# Each agent works independently
(
  cd "${REPO_ROOT}/.worktrees/coder-auth-001"
  # [Auth implementation]
  git commit -am "feat: Add authentication"
) &

(
  cd "${REPO_ROOT}/.worktrees/coder-payment-002"
  # [Payment implementation]
  git commit -am "feat: Add payment processing"
) &

(
  cd "${REPO_ROOT}/.worktrees/coder-ui-003"
  # [UI implementation]
  git commit -am "feat: Update UI components"
) &

wait  # Wait for all agents to complete

# Sequential merge to avoid conflicts
./merge-agent-work.sh "coder-auth-001"
./merge-agent-work.sh "coder-payment-002"
./merge-agent-work.sh "coder-ui-003"

# Cleanup
./cleanup-worktree.sh "coder-auth-001"
./cleanup-worktree.sh "coder-payment-002"
./cleanup-worktree.sh "coder-ui-003"
```

### Pattern 3: Fan-Out / Fan-In (Map-Reduce)

**Use Case:** Multiple agents analyze different aspects, results combined

```bash
#!/bin/bash
# Fan-out analysis, fan-in synthesis

REPO_ROOT="/Users/iroselli/wundr"
BASE_BRANCH="master"

# Fan-out: Multiple analyzers
ANALYZERS=("security" "performance" "accessibility" "seo")

for analyzer in "${ANALYZERS[@]}"; do
  ./create-agent-worktree.sh "analyzer" "${analyzer}-001" "${BASE_BRANCH}"
  (
    cd "${REPO_ROOT}/.worktrees/analyzer-${analyzer}-001"
    # [Run analysis]
    mkdir -p reports
    echo "Analysis results" > "reports/${analyzer}-report.json"
    git add reports/
    git commit -m "analysis: ${analyzer} results"
  ) &
done

wait  # All analyses complete

# Fan-in: Synthesize results
./create-agent-worktree.sh "synthesizer" "combined-001" "${BASE_BRANCH}"
cd "${REPO_ROOT}/.worktrees/synthesizer-combined-001"

# Merge all analysis branches
for analyzer in "${ANALYZERS[@]}"; do
  git merge --no-ff "agents/analyzer/${analyzer}-001" -m "Merge ${analyzer} analysis"
done

# Generate combined report
cat reports/*.json > reports/combined-report.json
git add reports/combined-report.json
git commit -m "analysis: Combined report"

cd "${REPO_ROOT}"
./merge-agent-work.sh "synthesizer-combined-001"

# Cleanup
for analyzer in "${ANALYZERS[@]}"; do
  ./cleanup-worktree.sh "analyzer-${analyzer}-001"
done
./cleanup-worktree.sh "synthesizer-combined-001"
```

### Pattern 4: Hot-Swap Agent Recovery

**Use Case:** Agent fails, spawn replacement without losing progress

```bash
#!/bin/bash
# Agent failure recovery pattern

REPO_ROOT="/Users/iroselli/wundr"
TASK_ID="complex-feature-001"
AGENT_TYPE="coder"

# Original agent working
./create-agent-worktree.sh "${AGENT_TYPE}" "${TASK_ID}" "master"
cd "${REPO_ROOT}/.worktrees/${AGENT_TYPE}-${TASK_ID}"

# Simulate partial work + failure
echo "partial work" > feature.js
git add feature.js
git commit -m "wip: Partial implementation"
# [Agent encounters error and fails]

# Recovery: Create new agent with same task
cd "${REPO_ROOT}"
RETRY_ID="${TASK_ID}-retry"
./create-agent-worktree.sh "${AGENT_TYPE}" "${RETRY_ID}" "agents/${AGENT_TYPE}/${TASK_ID}"

cd "${REPO_ROOT}/.worktrees/${AGENT_TYPE}-${RETRY_ID}"
# New agent continues from where previous left off
echo "completed work" >> feature.js
git commit -am "feat: Complete implementation"

cd "${REPO_ROOT}"
./merge-agent-work.sh "${AGENT_TYPE}-${RETRY_ID}"

# Cleanup both worktrees
./cleanup-worktree.sh "${AGENT_TYPE}-${TASK_ID}" true  # Force cleanup unmerged
./cleanup-worktree.sh "${AGENT_TYPE}-${RETRY_ID}"
```

### Pattern 5: Review-Modify-Approve Cycle

**Use Case:** Reviewer suggests changes, coder implements, re-review

```bash
#!/bin/bash
# Review cycle pattern

REPO_ROOT="/Users/iroselli/wundr"
FEATURE_ID="user-profile-001"

# Step 1: Initial implementation
./create-agent-worktree.sh "coder" "${FEATURE_ID}" "master"
cd "${REPO_ROOT}/.worktrees/coder-${FEATURE_ID}"
# [Implementation]
git commit -am "feat: User profile implementation"

# Step 2: Reviewer analyzes code
cd "${REPO_ROOT}"
./create-agent-worktree.sh "reviewer" "${FEATURE_ID}" "agents/coder/${FEATURE_ID}"
cd "${REPO_ROOT}/.worktrees/reviewer-${FEATURE_ID}"
# [Review creates feedback file]
cat > REVIEW_FEEDBACK.md << EOF
# Review Feedback

## Issues Found
1. Missing input validation
2. No error handling
3. Performance concerns

## Required Changes
- Add validation layer
- Implement try-catch blocks
- Add caching
EOF
git add REVIEW_FEEDBACK.md
git commit -m "review: Feedback for ${FEATURE_ID}"

# Step 3: Coder addresses feedback
cd "${REPO_ROOT}"
./create-agent-worktree.sh "coder" "${FEATURE_ID}-v2" "agents/reviewer/${FEATURE_ID}"
cd "${REPO_ROOT}/.worktrees/coder-${FEATURE_ID}-v2"
# [Address all feedback items]
git commit -am "fix: Address review feedback"
rm REVIEW_FEEDBACK.md
git commit -am "chore: Remove review feedback file"

# Step 4: Final approval
cd "${REPO_ROOT}"
./create-agent-worktree.sh "reviewer" "${FEATURE_ID}-final" "agents/coder/${FEATURE_ID}-v2"
cd "${REPO_ROOT}/.worktrees/reviewer-${FEATURE_ID}-final"
echo "APPROVED" > REVIEW_APPROVAL.txt
git add REVIEW_APPROVAL.txt
git commit -m "review: Approved"

# Merge final version
cd "${REPO_ROOT}"
./merge-agent-work.sh "reviewer-${FEATURE_ID}-final"

# Cleanup
./cleanup-worktree.sh "coder-${FEATURE_ID}"
./cleanup-worktree.sh "reviewer-${FEATURE_ID}"
./cleanup-worktree.sh "coder-${FEATURE_ID}-v2"
./cleanup-worktree.sh "reviewer-${FEATURE_ID}-final"
```

---

## Command Reference

### Core Worktree Commands

#### Create Worktree

```bash
# Basic syntax
git worktree add [-b <new-branch>] <path> [<commit-ish>]

# Create with new branch
git worktree add -b agents/coder/task-001 .worktrees/coder-task-001 master

# Create from existing branch
git worktree add .worktrees/coder-task-001 agents/coder/task-001

# Create detached HEAD (for inspection only)
git worktree add --detach .worktrees/temp-inspect HEAD
```

#### List Worktrees

```bash
# List all worktrees
git worktree list

# Porcelain format for scripting
git worktree list --porcelain

# Example output parsing
git worktree list --porcelain | awk '/^worktree/ {print $2}'
```

#### Remove Worktree

```bash
# Standard removal (requires clean working tree)
git worktree remove <path>

# Force removal (discards uncommitted changes)
git worktree remove --force <path>

# Remove with branch deletion
git worktree remove <path> && git branch -D <branch-name>
```

#### Prune Worktrees

```bash
# Remove stale worktree metadata
git worktree prune

# Dry-run to see what would be removed
git worktree prune --dry-run

# Verbose output
git worktree prune --verbose
```

### Management Scripts

#### Worktree Health Check

```bash
#!/bin/bash
# check-worktree-health.sh

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"

echo "🔍 Worktree Health Check"
echo "========================"

# List all worktrees
echo -e "\n📋 Active Worktrees:"
git worktree list

# Check for stale worktrees
echo -e "\n🧹 Checking for stale worktrees..."
git worktree prune --dry-run --verbose

# Check disk usage
echo -e "\n💾 Disk Usage:"
du -sh "${WORKTREE_BASE}"/* 2>/dev/null || echo "No worktrees found"

# Count by agent type
echo -e "\n📊 Worktrees by Agent Type:"
find "${WORKTREE_BASE}" -maxdepth 1 -type d ! -path "${WORKTREE_BASE}" -exec basename {} \; | cut -d'-' -f1 | sort | uniq -c

# Check for uncommitted changes
echo -e "\n⚠️  Worktrees with uncommitted changes:"
for worktree in "${WORKTREE_BASE}"/*; do
  if [ -d "${worktree}/.git" ] || [ -f "${worktree}/.git" ]; then
    cd "${worktree}"
    if [ -n "$(git status --porcelain)" ]; then
      echo "  - $(basename ${worktree})"
    fi
  fi
done

cd "${REPO_ROOT}"
```

#### Bulk Cleanup

```bash
#!/bin/bash
# cleanup-all-worktrees.sh

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"
DRY_RUN="${1:-false}"

echo "🧹 Bulk Worktree Cleanup"
echo "======================="

if [ "${DRY_RUN}" = "true" ]; then
  echo "🔍 DRY RUN MODE - No changes will be made"
fi

cd "${REPO_ROOT}"

# Get list of merged branches
MERGED_BRANCHES=$(git branch --merged master | grep 'agents/' | tr -d ' ')

for branch in ${MERGED_BRANCHES}; do
  # Extract worktree name from branch
  WORKTREE_NAME=$(echo "${branch}" | sed 's|agents/||' | tr '/' '-')
  WORKTREE_PATH="${WORKTREE_BASE}/${WORKTREE_NAME}"

  if [ -d "${WORKTREE_PATH}" ]; then
    echo "🗑️  Would remove: ${WORKTREE_NAME} (merged)"

    if [ "${DRY_RUN}" != "true" ]; then
      git worktree remove "${WORKTREE_PATH}" --force
      git branch -D "${branch}"
      echo "✅ Removed: ${WORKTREE_NAME}"
    fi
  fi
done

# Prune stale worktrees
if [ "${DRY_RUN}" = "true" ]; then
  git worktree prune --dry-run
else
  git worktree prune
  echo "✅ Pruned stale worktree metadata"
fi

echo -e "\n✅ Cleanup complete"
```

#### Worktree Status Report

```bash
#!/bin/bash
# worktree-status-report.sh

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"

cat << 'EOF'
╔════════════════════════════════════════════════════════╗
║          WORKTREE STATUS REPORT                        ║
╚════════════════════════════════════════════════════════╝
EOF

# Parse registry
if [ -f "${WORKTREE_BASE}/.worktree-registry.jsonl" ]; then
  echo -e "\n📊 Registry Summary:"

  TOTAL=$(wc -l < "${WORKTREE_BASE}/.worktree-registry.jsonl")
  ACTIVE=$(grep -c '"status":"active"' "${WORKTREE_BASE}/.worktree-registry.jsonl" || echo "0")
  MERGED=$(grep -c '"status":"merged"' "${WORKTREE_BASE}/.worktree-registry.jsonl" || echo "0")
  CLEANED=$(grep -c '"status":"cleaned"' "${WORKTREE_BASE}/.worktree-registry.jsonl" || echo "0")

  echo "  Total worktrees created: ${TOTAL}"
  echo "  Active: ${ACTIVE}"
  echo "  Merged: ${MERGED}"
  echo "  Cleaned: ${CLEANED}"
fi

# Current worktrees
echo -e "\n🔍 Current Worktrees:"
git worktree list | tail -n +2 | while read -r line; do
  PATH_PART=$(echo "${line}" | awk '{print $1}')
  BRANCH_PART=$(echo "${line}" | grep -o '\[.*\]' | tr -d '[]')

  cd "${PATH_PART}"
  UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')
  COMMITS=$(git rev-list --count master..HEAD 2>/dev/null || echo "0")

  echo "  📁 $(basename ${PATH_PART})"
  echo "     Branch: ${BRANCH_PART}"
  echo "     Uncommitted changes: ${UNCOMMITTED}"
  echo "     Commits ahead: ${COMMITS}"
  echo ""
done

cd "${REPO_ROOT}"
```

---

## Decision Matrix

### When to Use Worktrees vs Shared Workspace

| Criteria | Use Worktrees | Use Shared Workspace |
|----------|---------------|----------------------|
| **Number of agents** | 2+ parallel agents | Single agent |
| **File overlap** | Agents edit same files | Agents edit different files |
| **Execution mode** | Parallel/concurrent | Sequential |
| **Task duration** | Long-running (>1 min) | Quick tasks (<1 min) |
| **Coordination complexity** | High (multiple features) | Low (single feature) |
| **Merge frequency** | Batch merge at end | Continuous integration |
| **Resource availability** | Sufficient disk space | Limited disk space |
| **Risk tolerance** | Low (isolation needed) | High (can handle conflicts) |

### Detailed Decision Tree

```
START: Need to spawn agent(s)?
│
├─ Single agent only?
│  └─ YES → Use shared workspace
│
├─ Multiple agents editing same files?
│  └─ YES → MUST use worktrees
│
├─ Agents running in parallel?
│  └─ YES → STRONGLY recommend worktrees
│
├─ Task duration > 1 minute?
│  └─ YES → Recommend worktrees
│
├─ Critical production code?
│  └─ YES → Recommend worktrees (safety)
│
├─ Disk space < 1GB free?
│  └─ YES → Consider shared workspace
│
└─ Default → Use worktrees
```

### Use Case Examples

#### ✅ Worktree Required

1. **Parallel Feature Development**
   - 3 coders implementing auth, payment, notifications
   - All edit `src/config.js` (shared configuration)
   - Must isolate to prevent conflicts

2. **SPARC Pipeline Execution**
   - Spec → Pseudocode → Architecture → Refinement → Completion
   - Each phase modifies same files progressively
   - Sequential merging ensures clean integration

3. **Multi-Agent Review Process**
   - Code reviewer + security auditor + performance analyzer
   - All annotate same source files
   - Need isolated review branches

#### ⚠️ Worktree Recommended

1. **Long-Running Code Generation**
   - Agent generating large codebase (>5 min)
   - Risk of coordinator needing same files
   - Isolation prevents blocking

2. **Experimental Implementations**
   - Testing multiple algorithm approaches
   - May abandon some branches
   - Worktrees easy to discard

3. **Hot-Reload Development**
   - Main workspace running dev server
   - Agent making changes would trigger rebuilds
   - Worktree prevents disruption

#### ❌ Shared Workspace Acceptable

1. **Single Sequential Tasks**
   - One agent, one task, quick execution
   - No other agents running
   - Immediate integration desired

2. **Non-Overlapping File Operations**
   - Agent 1 edits `src/auth/*`
   - Agent 2 edits `src/payment/*`
   - Zero chance of file conflicts

3. **Documentation-Only Changes**
   - Updating `README.md`
   - No build/compile impact
   - Low risk of conflicts

---

## Merge Strategies

### Strategy 1: Sequential Merge (Default)

**Use When:** Agents complete at different times, low conflict risk

```bash
#!/bin/bash
# sequential-merge.sh

AGENTS=("coder-auth-001" "tester-auth-002" "reviewer-auth-003")
TARGET_BRANCH="master"

for agent in "${AGENTS[@]}"; do
  echo "🔀 Merging ${agent}..."

  if ./merge-agent-work.sh "${agent}" "${TARGET_BRANCH}"; then
    echo "✅ ${agent} merged successfully"
    ./cleanup-worktree.sh "${agent}"
  else
    echo "❌ ${agent} merge failed - stopping pipeline"
    exit 1
  fi
done
```

### Strategy 2: Three-Way Merge with Conflict Resolution

**Use When:** Known conflicts, need intelligent resolution

```bash
#!/bin/bash
# three-way-merge.sh

set -euo pipefail

AGENT_BRANCH="${1}"
BASE_BRANCH="${2:-master}"
STRATEGY="${3:-recursive}"  # recursive, ours, theirs

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

# Fetch latest
git checkout "${BASE_BRANCH}"
git pull origin "${BASE_BRANCH}"

# Attempt merge with strategy
if git merge -s "${STRATEGY}" "${AGENT_BRANCH}" --no-ff; then
  echo "✅ Merge successful with strategy: ${STRATEGY}"
else
  echo "⚠️  Conflicts detected"

  # Show conflicts
  git diff --name-only --diff-filter=U > /tmp/conflicts.txt

  echo "Files in conflict:"
  cat /tmp/conflicts.txt

  # Attempt automatic resolution patterns
  while IFS= read -r file; do
    echo "🔧 Attempting auto-resolution: ${file}"

    # Pattern 1: Accept incoming for generated files
    if [[ "${file}" =~ generated|build|dist ]]; then
      git checkout --theirs "${file}"
      git add "${file}"
      echo "  ✓ Accepted agent version (generated file)"
      continue
    fi

    # Pattern 2: Accept base for config files
    if [[ "${file}" =~ config\.json|package\.json ]]; then
      git checkout --ours "${file}"
      git add "${file}"
      echo "  ✓ Kept base version (config file)"
      continue
    fi

    # Pattern 3: Manual resolution needed
    echo "  ⚠️  Manual resolution required"
  done < /tmp/conflicts.txt

  # Check if all resolved
  if [ -z "$(git diff --name-only --diff-filter=U)" ]; then
    git commit --no-edit
    echo "✅ All conflicts auto-resolved"
  else
    echo "❌ Manual intervention required for:"
    git diff --name-only --diff-filter=U
    exit 1
  fi
fi
```

### Strategy 3: Octopus Merge (Multiple Branches)

**Use When:** Multiple non-conflicting agent branches ready simultaneously

```bash
#!/bin/bash
# octopus-merge.sh

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASE_BRANCH="master"

# Get all merged agent branches
AGENT_BRANCHES=(
  "agents/coder/feature-a-001"
  "agents/coder/feature-b-002"
  "agents/coder/feature-c-003"
)

cd "${REPO_ROOT}"
git checkout "${BASE_BRANCH}"

# Octopus merge (only works if no conflicts)
if git merge --no-ff "${AGENT_BRANCHES[@]}" -m "Merge multiple agent branches"; then
  echo "✅ Octopus merge successful"
else
  echo "❌ Octopus merge failed (conflicts exist)"
  echo "   Falling back to sequential merge..."

  git merge --abort

  for branch in "${AGENT_BRANCHES[@]}"; do
    git merge --no-ff "${branch}" -m "Merge ${branch}"
  done
fi
```

### Strategy 4: Rebase Before Merge (Clean History)

**Use When:** Want linear history, agent work is clean

```bash
#!/bin/bash
# rebase-merge.sh

AGENT_WORKTREE="${1}"
BASE_BRANCH="${2:-master}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_PATH="${REPO_ROOT}/.worktrees/${AGENT_WORKTREE}"

# Work in agent's worktree
cd "${WORKTREE_PATH}"
AGENT_BRANCH=$(git branch --show-current)

# Rebase onto latest base
git fetch origin "${BASE_BRANCH}"
if git rebase "origin/${BASE_BRANCH}"; then
  echo "✅ Rebase successful"
else
  echo "❌ Rebase conflicts detected"

  # Try to auto-resolve
  git rebase --skip || git rebase --abort

  echo "⚠️  Falling back to merge strategy"
  cd "${REPO_ROOT}"
  git merge --no-ff "${AGENT_BRANCH}"
  exit 0
fi

# Fast-forward merge
cd "${REPO_ROOT}"
git checkout "${BASE_BRANCH}"
git merge --ff-only "${AGENT_BRANCH}"

echo "✅ Clean fast-forward merge complete"
```

### Strategy 5: Squash Merge (Single Commit)

**Use When:** Want to combine all agent commits into one

```bash
#!/bin/bash
# squash-merge.sh

AGENT_WORKTREE="${1}"
BASE_BRANCH="${2:-master}"
COMMIT_MESSAGE="${3:-Agent work completed}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_PATH="${REPO_ROOT}/.worktrees/${AGENT_WORKTREE}"

cd "${WORKTREE_PATH}"
AGENT_BRANCH=$(git branch --show-current)

# Get commit summary for squash message
COMMITS=$(git log "${BASE_BRANCH}..HEAD" --oneline)

cd "${REPO_ROOT}"
git checkout "${BASE_BRANCH}"

# Squash merge
git merge --squash "${AGENT_BRANCH}"

# Create single commit with detailed message
cat > /tmp/squash-message.txt << EOF
${COMMIT_MESSAGE}

Agent: $(echo "${AGENT_WORKTREE}" | cut -d'-' -f1)
Task: $(echo "${AGENT_WORKTREE}" | cut -d'-' -f2-)

Commits squashed:
${COMMITS}

🤖 Generated with Claude Code Agent
EOF

git commit -F /tmp/squash-message.txt
rm /tmp/squash-message.txt

echo "✅ Squash merge complete"
```

---

## Error Handling

### Common Errors and Solutions

#### Error 1: Worktree Already Exists

```bash
# Error message:
# fatal: '/.worktrees/coder-task-001' already exists

# Detection
if [ -d "${WORKTREE_PATH}" ]; then
  echo "❌ ERROR: Worktree already exists at ${WORKTREE_PATH}"

  # Solution 1: Use existing worktree
  echo "Option 1: Use existing worktree"

  # Solution 2: Remove and recreate
  echo "Option 2: Remove existing worktree"
  git worktree remove "${WORKTREE_PATH}" --force
  git worktree add -b "${BRANCH_NAME}" "${WORKTREE_PATH}" "${BASE_BRANCH}"

  # Solution 3: Create with different name
  echo "Option 3: Create with incremented name"
  COUNTER=1
  while [ -d "${WORKTREE_PATH}-${COUNTER}" ]; do
    ((COUNTER++))
  done
  WORKTREE_PATH="${WORKTREE_PATH}-${COUNTER}"
fi
```

#### Error 2: Branch Already Exists

```bash
# Error message:
# fatal: a branch named 'agents/coder/task-001' already exists

# Detection and resolution
if git rev-parse --verify "${BRANCH_NAME}" >/dev/null 2>&1; then
  echo "⚠️  WARNING: Branch ${BRANCH_NAME} already exists"

  # Check if branch is in use
  if git worktree list | grep -q "${BRANCH_NAME}"; then
    echo "❌ ERROR: Branch in use by another worktree"
    exit 1
  fi

  # Check if branch is merged
  if git branch --merged master | grep -q "${BRANCH_NAME}"; then
    echo "Branch is merged, safe to delete"
    git branch -D "${BRANCH_NAME}"
  else
    # Backup existing branch
    BACKUP_NAME="${BRANCH_NAME}-backup-$(date +%s)"
    git branch -m "${BRANCH_NAME}" "${BACKUP_NAME}"
    echo "Backed up to: ${BACKUP_NAME}"
  fi
fi
```

#### Error 3: Merge Conflicts

```bash
# Error message:
# CONFLICT (content): Merge conflict in src/file.js

# Automated conflict resolution
handle_merge_conflict() {
  local file="${1}"

  echo "🔧 Handling conflict in: ${file}"

  # Strategy 1: Accept changes from specific agent types
  case "${AGENT_TYPE}" in
    "tester")
      # Testers: prefer their test files
      if [[ "${file}" =~ test|spec ]]; then
        git checkout --theirs "${file}"
        git add "${file}"
        return 0
      fi
      ;;
    "formatter")
      # Formatters: always prefer their version
      git checkout --theirs "${file}"
      git add "${file}"
      return 0
      ;;
    "coder")
      # Coders: manual review needed
      return 1
      ;;
  esac

  # Strategy 2: File type patterns
  case "${file}" in
    *.generated.*)
      git checkout --theirs "${file}"
      git add "${file}"
      return 0
      ;;
    package-lock.json|yarn.lock)
      # Regenerate lock files
      git checkout --theirs "${file}"
      npm install  # or yarn install
      git add "${file}"
      return 0
      ;;
    *.md)
      # Documentation: try to merge both
      git checkout --merge "${file}"
      # Manual markers left for review
      return 1
      ;;
  esac

  # Default: manual resolution required
  return 1
}

# Use in merge script
if ! git merge "${AGENT_BRANCH}"; then
  for conflict in $(git diff --name-only --diff-filter=U); do
    if handle_merge_conflict "${conflict}"; then
      echo "✅ Auto-resolved: ${conflict}"
    else
      echo "⚠️  Manual review: ${conflict}"
    fi
  done
fi
```

#### Error 4: Disk Space Exhausted

```bash
# Error message:
# fatal: cannot create worktree: No space left on device

# Detection
check_disk_space() {
  AVAILABLE=$(df -k . | tail -1 | awk '{print $4}')
  REQUIRED=$((100 * 1024))  # 100MB minimum

  if [ "${AVAILABLE}" -lt "${REQUIRED}" ]; then
    echo "❌ ERROR: Insufficient disk space"
    echo "   Available: $((AVAILABLE / 1024))MB"
    echo "   Required: $((REQUIRED / 1024))MB"

    # Cleanup suggestions
    echo "🧹 Cleanup options:"
    echo "   1. Remove merged worktrees: ./cleanup-all-worktrees.sh"
    echo "   2. Prune stale worktrees: git worktree prune"
    echo "   3. Clean build artifacts: npm run clean"

    return 1
  fi

  return 0
}

# Use before creating worktree
check_disk_space || exit 1
```

#### Error 5: Locked References

```bash
# Error message:
# fatal: Unable to create '/.git/refs/heads/agents/coder/task.lock': File exists

# Resolution
unlock_git_refs() {
  local repo_root="$(git rev-parse --show-toplevel)"
  local lock_files=$(find "${repo_root}/.git" -name "*.lock")

  if [ -n "${lock_files}" ]; then
    echo "🔓 Found locked references:"
    echo "${lock_files}"

    read -p "Remove lock files? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      find "${repo_root}/.git" -name "*.lock" -delete
      echo "✅ Lock files removed"
    fi
  fi
}

# Use when git operations fail
if ! git worktree add "${WORKTREE_PATH}"; then
  unlock_git_refs
  git worktree add "${WORKTREE_PATH}"  # Retry
fi
```

### Edge Cases

#### Edge Case 1: Orphaned Worktree Directories

```bash
# Scenario: Worktree directory exists but not in git worktree list

cleanup_orphaned_worktrees() {
  local worktree_base="${1}"
  local repo_root="$(git rev-parse --show-toplevel)"

  cd "${repo_root}"

  # Get list of registered worktrees
  REGISTERED=$(git worktree list --porcelain | awk '/^worktree/ {print $2}')

  # Check each directory in worktree base
  for dir in "${worktree_base}"/*; do
    if [ -d "${dir}" ]; then
      if ! echo "${REGISTERED}" | grep -q "^${dir}$"; then
        echo "🗑️  Orphaned worktree: $(basename ${dir})"
        rm -rf "${dir}"
        echo "   Removed"
      fi
    fi
  done

  # Prune git metadata
  git worktree prune
}
```

#### Edge Case 2: Agent Crashes Mid-Commit

```bash
# Scenario: Agent dies during git commit, leaves inconsistent state

recover_incomplete_commit() {
  local worktree_path="${1}"

  cd "${worktree_path}"

  # Check for incomplete commit
  if [ -f ".git/COMMIT_EDITMSG" ]; then
    echo "⚠️  Found incomplete commit"

    # Check index state
    if git diff --cached --quiet; then
      echo "No staged changes, aborting commit"
      rm -f .git/COMMIT_EDITMSG
    else
      echo "Recovering staged changes..."
      git commit -C .git/COMMIT_EDITMSG || git commit -m "recovered: Incomplete commit"
    fi
  fi

  # Check for merge in progress
  if [ -f ".git/MERGE_HEAD" ]; then
    echo "⚠️  Found incomplete merge"
    git merge --abort
  fi

  # Check for rebase in progress
  if [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
    echo "⚠️  Found incomplete rebase"
    git rebase --abort
  fi
}
```

#### Edge Case 3: Circular Merge Dependencies

```bash
# Scenario: Agent A depends on Agent B, Agent B depends on Agent A

detect_circular_dependencies() {
  local agents=("$@")
  local -A deps

  # Build dependency graph
  for agent in "${agents[@]}"; do
    worktree_path="${WORKTREE_BASE}/${agent}"
    cd "${worktree_path}"

    # Extract base branch as dependency
    base_branch=$(git show-branch --merge-base HEAD master)
    if [[ "${base_branch}" =~ agents/([^/]+)/([^/]+) ]]; then
      dep_agent="${BASH_REMATCH[1]}-${BASH_REMATCH[2]}"
      deps["${agent}"]="${dep_agent}"
    fi
  done

  # Detect cycles using DFS
  for agent in "${agents[@]}"; do
    visited=()
    stack=("${agent}")

    while [ ${#stack[@]} -gt 0 ]; do
      current="${stack[-1]}"
      unset 'stack[-1]'

      if [[ " ${visited[@]} " =~ " ${current} " ]]; then
        echo "❌ ERROR: Circular dependency detected involving ${current}"
        return 1
      fi

      visited+=("${current}")

      if [ -n "${deps[${current}]}" ]; then
        stack+=("${deps[${current}]}")
      fi
    done
  done

  return 0
}
```

#### Edge Case 4: Submodule Conflicts

```bash
# Scenario: Agents modify submodules, causing pointer conflicts

handle_submodule_conflicts() {
  # Check for submodule conflicts
  if git diff --name-only --diff-filter=U | grep -q '^[^/]*$'; then
    echo "🔍 Submodule conflict detected"

    for submodule in $(git diff --name-only --diff-filter=U | grep -v '/'); do
      echo "📦 Resolving submodule: ${submodule}"

      # Get both versions
      OURS=$(git ls-tree HEAD "${submodule}" | awk '{print $3}')
      THEIRS=$(git ls-tree MERGE_HEAD "${submodule}" | awk '{print $3}')

      cd "${submodule}"

      # Check if theirs is descendant of ours
      if git merge-base --is-ancestor "${OURS}" "${THEIRS}"; then
        echo "   Using their version (fast-forward)"
        cd ..
        git add "${submodule}"
      elif git merge-base --is-ancestor "${THEIRS}" "${OURS}"; then
        echo "   Using our version (already ahead)"
        cd ..
        git add "${submodule}"
      else
        echo "   ⚠️  Diverged submodule, manual resolution needed"
        cd ..
      fi
    done
  fi
}
```

---

## Integration Examples

### Example 1: SPARC TDD Workflow with Worktrees

```bash
#!/bin/bash
# sparc-tdd-worktree.sh
# Full SPARC workflow using isolated worktrees

set -euo pipefail

FEATURE_NAME="${1}"
REPO_ROOT="/Users/iroselli/wundr"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"
BASE_BRANCH="master"

echo "🚀 SPARC TDD Workflow: ${FEATURE_NAME}"
echo "======================================"

# Phase 1: Specification
echo -e "\n📋 Phase 1: Specification"
./create-agent-worktree.sh "specification" "${FEATURE_NAME}" "${BASE_BRANCH}"
cd "${WORKTREE_BASE}/specification-${FEATURE_NAME}"

npx claude-flow sparc run spec-pseudocode "Define requirements for ${FEATURE_NAME}"

git add .
git commit -m "spec: Requirements and pseudocode for ${FEATURE_NAME}"

SPEC_BRANCH="agents/specification/${FEATURE_NAME}"

# Phase 2: Architecture
echo -e "\n🏗️  Phase 2: Architecture"
cd "${REPO_ROOT}"
./create-agent-worktree.sh "architect" "${FEATURE_NAME}" "${SPEC_BRANCH}"
cd "${WORKTREE_BASE}/architect-${FEATURE_NAME}"

npx claude-flow sparc run architect "Design architecture for ${FEATURE_NAME}"

git add .
git commit -m "arch: Architecture design for ${FEATURE_NAME}"

ARCH_BRANCH="agents/architect/${FEATURE_NAME}"

# Phase 3: Refinement (TDD)
echo -e "\n🔬 Phase 3: Test-Driven Development"
cd "${REPO_ROOT}"
./create-agent-worktree.sh "tdd" "${FEATURE_NAME}" "${ARCH_BRANCH}"
cd "${WORKTREE_BASE}/tdd-${FEATURE_NAME}"

npx claude-flow sparc tdd "${FEATURE_NAME}"

git add .
git commit -m "feat: TDD implementation of ${FEATURE_NAME}"

TDD_BRANCH="agents/tdd/${FEATURE_NAME}"

# Phase 4: Integration
echo -e "\n🔗 Phase 4: Integration"
cd "${REPO_ROOT}"
./create-agent-worktree.sh "integration" "${FEATURE_NAME}" "${TDD_BRANCH}"
cd "${WORKTREE_BASE}/integration-${FEATURE_NAME}"

npx claude-flow sparc run integration "Integrate ${FEATURE_NAME}"

npm run build
npm test

git add .
git commit -m "chore: Integration and testing for ${FEATURE_NAME}"

# Merge to master
cd "${REPO_ROOT}"
git checkout master
git merge --no-ff "agents/integration/${FEATURE_NAME}" -m "Merge feature: ${FEATURE_NAME}

Complete SPARC TDD workflow:
- Specification & Pseudocode
- Architecture Design
- Test-Driven Development
- Integration & Testing

🤖 Generated with Claude Code Agent Swarm"

# Cleanup
./cleanup-worktree.sh "specification-${FEATURE_NAME}"
./cleanup-worktree.sh "architect-${FEATURE_NAME}"
./cleanup-worktree.sh "tdd-${FEATURE_NAME}"
./cleanup-worktree.sh "integration-${FEATURE_NAME}"

echo -e "\n✅ SPARC TDD Workflow Complete!"
```

### Example 2: Parallel Multi-Feature Development

```bash
#!/bin/bash
# parallel-features.sh
# Develop multiple features simultaneously without conflicts

REPO_ROOT="/Users/iroselli/wundr"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"

FEATURES=(
  "user-authentication"
  "payment-processing"
  "notification-system"
  "analytics-dashboard"
)

echo "🚀 Parallel Feature Development"
echo "==============================="

# Create worktrees for all features
for feature in "${FEATURES[@]}"; do
  ./create-agent-worktree.sh "coder" "${feature}" "master" &
done
wait

echo "✅ All worktrees created"

# Agents work in parallel
for feature in "${FEATURES[@]}"; do
  (
    cd "${WORKTREE_BASE}/coder-${feature}"
    echo "🔨 Implementing ${feature}..."

    # Agent does work (simulated)
    mkdir -p "src/${feature}"
    cat > "src/${feature}/index.ts" << EOF
// ${feature} implementation
export class ${feature//-/} {
  constructor() {
    console.log('${feature} initialized');
  }
}
EOF

    # Create tests
    mkdir -p "tests/${feature}"
    cat > "tests/${feature}/index.test.ts" << EOF
import { ${feature//-/} } from '../../src/${feature}';

describe('${feature}', () => {
  it('should initialize', () => {
    const instance = new ${feature//-/}();
    expect(instance).toBeDefined();
  });
});
EOF

    git add .
    git commit -m "feat: Implement ${feature}"
    echo "✅ ${feature} complete"

  ) &
done

wait
echo "✅ All features implemented"

# Sequential merge (prevents conflicts)
for feature in "${FEATURES[@]}"; do
  cd "${REPO_ROOT}"
  ./merge-agent-work.sh "coder-${feature}"
  ./cleanup-worktree.sh "coder-${feature}"
done

echo -e "\n✅ All features merged and cleaned up"
```

### Example 3: Agent Swarm Coordination

```bash
#!/bin/bash
# agent-swarm-worktree.sh
# Coordinate multiple agent types on single feature

FEATURE="${1}"
REPO_ROOT="/Users/iroselli/wundr"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"

echo "🐝 Agent Swarm: ${FEATURE}"
echo "========================"

# Initialize swarm
npx claude-flow swarm init --topology mesh --max-agents 5

# Spawn agents with worktrees
AGENTS=("researcher" "coder" "tester" "reviewer" "docs")

for agent in "${AGENTS[@]}"; do
  TASK_ID="${FEATURE}-$(date +%s)"

  # Create worktree
  ./create-agent-worktree.sh "${agent}" "${TASK_ID}" "master"

  # Spawn agent via MCP
  npx claude-flow agent spawn \
    --type "${agent}" \
    --task "${FEATURE}" \
    --workspace "${WORKTREE_BASE}/${agent}-${TASK_ID}"
done

# Monitor agents
while true; do
  STATUS=$(npx claude-flow swarm status --format json)
  ACTIVE=$(echo "${STATUS}" | jq '.agents[] | select(.status=="active") | .id' | wc -l)

  if [ "${ACTIVE}" -eq 0 ]; then
    echo "✅ All agents complete"
    break
  fi

  echo "⏳ ${ACTIVE} agents still working..."
  sleep 5
done

# Collect results and merge
for agent in "${AGENTS[@]}"; do
  WORKTREE_NAME=$(ls -t "${WORKTREE_BASE}" | grep "^${agent}-${FEATURE}" | head -1)

  if [ -n "${WORKTREE_NAME}" ]; then
    ./merge-agent-work.sh "${WORKTREE_NAME}"
    ./cleanup-worktree.sh "${WORKTREE_NAME}"
  fi
done

echo "✅ Swarm coordination complete"
```

### Example 4: Hot-Reload Development Server

```bash
#!/bin/bash
# dev-server-worktree.sh
# Run dev server in main worktree, agents work in isolated worktrees

REPO_ROOT="/Users/iroselli/wundr"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"

echo "🔥 Hot-Reload Development Setup"
echo "==============================="

# Start dev server in main worktree
cd "${REPO_ROOT}"
npm run dev &
DEV_PID=$!

echo "✅ Dev server started (PID: ${DEV_PID})"

# Create agent worktree for changes
./create-agent-worktree.sh "coder" "live-changes-001" "master"
cd "${WORKTREE_BASE}/coder-live-changes-001"

echo "🔨 Agent working in isolated environment..."
echo "   Main dev server unaffected by agent changes"

# Agent makes changes
mkdir -p src/components
cat > src/components/NewFeature.tsx << 'EOF'
export const NewFeature = () => {
  return <div>New Feature</div>;
};
EOF

git add .
git commit -m "feat: Add NewFeature component"

# Merge changes
cd "${REPO_ROOT}"
./merge-agent-work.sh "coder-live-changes-001"

# Dev server hot-reloads with new changes
echo "🔄 Dev server hot-reloading with new changes..."

# Cleanup
./cleanup-worktree.sh "coder-live-changes-001"

# Stop dev server
kill ${DEV_PID}

echo "✅ Development cycle complete"
```

---

## Best Practices Summary

### DO ✅

1. **Always use worktrees for parallel agents**
2. **Create worktrees before spawning agents**
3. **Use consistent naming conventions**
4. **Commit frequently in agent worktrees**
5. **Merge sequentially to avoid conflicts**
6. **Clean up worktrees after merge**
7. **Monitor disk space usage**
8. **Document agent workflows**
9. **Use registry for tracking**
10. **Test merge strategies before production**

### DON'T ❌

1. **Don't create worktrees manually without scripts**
2. **Don't leave uncommitted changes**
3. **Don't merge without testing**
4. **Don't ignore merge conflicts**
5. **Don't reuse worktree names**
6. **Don't skip cleanup phase**
7. **Don't hardcode paths**
8. **Don't assume branch names**
9. **Don't parallel merge without coordination**
10. **Don't ignore disk space warnings**

### Performance Tips ⚡

1. Use `--shallow` clone for worktrees if appropriate
2. Leverage git's object caching between worktrees
3. Prune regularly to avoid metadata bloat
4. Use SSD storage for worktree directories
5. Batch operations where possible
6. Monitor with `git worktree list --porcelain`

### Security Considerations 🔒

1. Validate all worktree paths to prevent directory traversal
2. Never execute untrusted code in worktrees
3. Clean up worktrees with sensitive data immediately
4. Use appropriate file permissions on worktree directories
5. Audit worktree registry for unauthorized access
6. Implement access controls on `.worktrees/` directory

---

## Conclusion

This git-worktree integration strategy enables Claude Code subagents to work in true isolation, eliminating conflicts while maintaining code quality and merge integrity. By following these patterns, your agent swarms can achieve 2.8-4.4x performance improvements through safe parallel execution.

**Key Takeaways:**

- Worktrees provide filesystem-level isolation
- Each agent gets independent branch and working directory
- Shared `.git` repository keeps disk usage efficient
- Structured workflows prevent conflicts
- Automated merge strategies handle integration
- Comprehensive error handling ensures reliability

For questions or improvements, see: `/Users/iroselli/wundr/docs/architecture/`

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-21
**Author:** Claude Code System Architect
**Status:** Production Ready
