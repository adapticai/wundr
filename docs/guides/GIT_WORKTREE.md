# Git-Worktree Guide: Parallel Development with Claude Flow

Learn how to leverage Git worktrees with Claude Flow for ultra-efficient parallel development workflows.

## Table of Contents

- [What are Git Worktrees?](#what-are-git-worktrees)
- [Why Use Worktrees with Claude Flow?](#why-use-worktrees-with-claude-flow)
- [Setup and Configuration](#setup-and-configuration)
- [Basic Workflows](#basic-workflows)
- [Advanced Patterns](#advanced-patterns)
- [Agent Coordination](#agent-coordination)
- [Real-World Examples](#real-world-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## What are Git Worktrees?

Git worktrees allow you to have multiple working directories from a single repository, each on a different branch. This enables true parallel development without branch switching.

### Traditional Git Flow
```bash
# Switch branches (slow, loses context)
git checkout feature-a    # Work on feature A
git checkout feature-b    # Work on feature B
git checkout main         # Back to main
```

### Worktree Flow
```bash
# All branches available simultaneously
cd ~/project/main         # Main branch
cd ~/project/feature-a    # Feature A branch
cd ~/project/feature-b    # Feature B branch
```

## Why Use Worktrees with Claude Flow?

### 1. True Parallel Agent Execution
```bash
# Each agent gets its own workspace
/project/
├── main/                 # Main development
├── worktrees/
│   ├── agent-backend/   # Backend agent workspace
│   ├── agent-frontend/  # Frontend agent workspace
│   ├── agent-testing/   # Testing agent workspace
│   └── agent-docs/      # Documentation agent workspace
```

### 2. Performance Benefits

- **2.8-4.4x Speed**: Agents work simultaneously
- **No Context Switching**: Each agent maintains state
- **Parallel Testing**: Run tests while coding
- **Continuous Integration**: Build in parallel

### 3. Memory Isolation

Each worktree has independent:
- Memory context
- Session state
- Metrics tracking
- Agent assignments

## Setup and Configuration

### Initial Setup

```bash
# Navigate to your repository
cd /path/to/your/project

# Create worktrees directory
mkdir -p .worktrees

# Configure Git to use worktrees
git config worktree.guessRemote true
```

### Claude Flow Worktree Configuration

Create `.claude-flow/worktree.config.json`:

```json
{
  "worktrees": {
    "enabled": true,
    "basePath": ".worktrees",
    "autoCleanup": true,
    "agentMapping": {
      "backend-dev": "backend",
      "frontend-dev": "frontend",
      "tester": "testing",
      "api-docs": "docs"
    }
  },
  "isolation": {
    "memory": true,
    "metrics": true,
    "sessions": true
  },
  "synchronization": {
    "enabled": true,
    "strategy": "merge-main",
    "interval": 300000
  }
}
```

### Automated Worktree Setup

```bash
# Initialize worktree-enabled project
npx claude-flow@alpha worktree init

# Create agent-specific worktrees
npx claude-flow@alpha worktree create --agent backend-dev --branch feature/api
npx claude-flow@alpha worktree create --agent frontend-dev --branch feature/ui
npx claude-flow@alpha worktree create --agent tester --branch feature/tests
```

## Basic Workflows

### Workflow 1: Feature Development with Parallel Agents

```bash
# 1. Create feature branch
git checkout -b feature/user-management

# 2. Initialize worktrees for agents
npx claude-flow@alpha worktree setup-feature "user-management"
```

This creates:
```
project/
├── main/                           # Your main workspace
└── .worktrees/
    ├── user-management-backend/   # feature/user-management-backend
    ├── user-management-frontend/  # feature/user-management-frontend
    ├── user-management-tests/     # feature/user-management-tests
    └── user-management-docs/      # feature/user-management-docs
```

### Workflow 2: SPARC TDD with Worktrees

```bash
# Run SPARC TDD across multiple worktrees
npx claude-flow@alpha sparc tdd "Add user authentication" \
  --worktree-mode parallel \
  --agents backend-dev,tester,api-docs
```

**What happens:**

1. **Specification Phase** (main worktree)
   - Analyze requirements
   - Create specification document

2. **Pseudocode Phase** (main worktree)
   - Design algorithms
   - Plan architecture

3. **Architecture Phase** (main worktree)
   - Design system structure
   - Define interfaces

4. **Refinement Phase** (parallel worktrees)
   - `backend/`: Implement authentication logic
   - `tests/`: Write test suite
   - `docs/`: Create API documentation

5. **Completion Phase** (main worktree)
   - Merge all changes
   - Integration testing
   - Final documentation

### Workflow 3: Code Review Across Worktrees

```bash
# Start review process
npx claude-flow@alpha worktree review \
  --branch feature/user-auth \
  --reviewers reviewer,tester,security-manager
```

Each reviewer gets isolated workspace:
```
.worktrees/
├── review-security/    # Security review
├── review-tests/       # Test coverage review
└── review-code/        # Code quality review
```

## Advanced Patterns

### Pattern 1: Hierarchical Agent Coordination

```json
// .claude-flow/worktree-topology.json
{
  "topology": "hierarchical",
  "coordinator": {
    "type": "hierarchical-coordinator",
    "worktree": "main"
  },
  "teams": [
    {
      "name": "backend-team",
      "lead": "backend-dev",
      "members": ["coder", "tester"],
      "worktree": ".worktrees/backend"
    },
    {
      "name": "frontend-team",
      "lead": "frontend-dev",
      "members": ["mobile-dev", "tester"],
      "worktree": ".worktrees/frontend"
    }
  ]
}
```

Run hierarchical coordination:
```bash
npx claude-flow@alpha swarm start \
  --topology hierarchical \
  --config .claude-flow/worktree-topology.json \
  --task "Build complete user management system"
```

### Pattern 2: Consensus-Based Development

```bash
# Initialize consensus swarm
npx claude-flow@alpha worktree consensus \
  --task "Design authentication architecture" \
  --agents architect,security-manager,backend-dev,reviewer \
  --consensus-threshold 0.75
```

**Process:**

1. Each agent analyzes in isolated worktree
2. Proposals submitted to consensus coordinator
3. Byzantine fault tolerance ensures agreement
4. Final design merged to main worktree

### Pattern 3: Continuous Integration Worktree

```bash
# Create CI worktree
npx claude-flow@alpha worktree create --name ci --branch main

# Watch for changes and test
npx claude-flow@alpha worktree watch \
  --worktree ci \
  --on-change "npm test && npm run build" \
  --notify-on-failure true
```

### Pattern 4: Multi-Repository Coordination

```bash
# Initialize multi-repo swarm
npx claude-flow@alpha worktree multi-repo \
  --repos "frontend,backend,shared" \
  --task "Update authentication across all services"
```

Creates:
```
projects/
├── frontend/
│   └── .worktrees/auth-update/
├── backend/
│   └── .worktrees/auth-update/
└── shared/
    └── .worktrees/auth-update/
```

## Agent Coordination

### Automatic Agent Assignment

Claude Flow automatically assigns agents to worktrees based on file types and task context.

```javascript
// .claude-flow/agent-assignment.js
module.exports = {
  rules: [
    {
      pattern: "**/*.{ts,js}",
      agents: ["coder", "reviewer"],
      worktree: "backend"
    },
    {
      pattern: "**/*.test.{ts,js}",
      agents: ["tester"],
      worktree: "testing"
    },
    {
      pattern: "**/docs/**/*.md",
      agents: ["api-docs"],
      worktree: "docs"
    }
  ]
};
```

### Inter-Worktree Communication

Agents communicate via shared memory:

```bash
# Agent in backend worktree stores result
npx claude-flow@alpha memory store \
  --key "auth/backend/implementation" \
  --value "Completed JWT implementation" \
  --worktree backend

# Agent in testing worktree retrieves
npx claude-flow@alpha memory retrieve \
  --key "auth/backend/implementation" \
  --worktree testing
```

### Synchronization Points

Define when worktrees sync:

```json
{
  "sync": {
    "events": [
      "pre-commit",
      "post-test",
      "agent-complete"
    ],
    "strategy": "rebase",
    "conflictResolution": "coordinator-decides"
  }
}
```

## Real-World Examples

### Example 1: Microservices Development

**Scenario**: Build user service with API, database, tests, and docs

```bash
# 1. Initialize project
npx claude-flow@alpha worktree init-microservice "user-service"

# Creates worktrees:
# - api/         (API endpoints)
# - database/    (Schema and migrations)
# - tests/       (Integration tests)
# - docs/        (API documentation)

# 2. Spawn agents
npx claude-flow@alpha swarm start \
  --topology mesh \
  --agents backend-dev,tester,api-docs \
  --task "Build user CRUD service with PostgreSQL"

# 3. Agents work in parallel
# backend-dev  → api/         (Implements endpoints)
# backend-dev  → database/    (Creates schema)
# tester       → tests/       (Writes integration tests)
# api-docs     → docs/        (Generates OpenAPI spec)

# 4. Continuous integration
# CI worktree runs tests as code changes

# 5. Merge when complete
npx claude-flow@alpha worktree merge-all --to main
```

### Example 2: Frontend Refactoring

**Scenario**: Refactor React app to TypeScript

```bash
# 1. Create refactor worktrees
npx claude-flow@alpha worktree refactor \
  --base feature/typescript-migration \
  --split-by module

# Creates:
# - components/  (Refactor components)
# - hooks/       (Refactor hooks)
# - utils/       (Refactor utilities)
# - types/       (Create type definitions)

# 2. Assign specialized agents
npx claude-flow@alpha agent spawn \
  --type coder \
  --specialization typescript \
  --worktree components

npx claude-flow@alpha agent spawn \
  --type coder \
  --specialization typescript \
  --worktree hooks

# 3. Run migration in parallel
# Each worktree refactors independently

# 4. Type checking across all worktrees
npx claude-flow@alpha worktree exec-all "npm run typecheck"

# 5. Incremental merge
npx claude-flow@alpha worktree merge \
  --from types --to main  # Merge types first
npx claude-flow@alpha worktree merge \
  --from utils --to main  # Then utilities
# ... continue incrementally
```

### Example 3: Performance Optimization

**Scenario**: Optimize application performance

```bash
# 1. Create optimization worktrees
npx claude-flow@alpha worktree create --name benchmark --branch main
npx claude-flow@alpha worktree create --name optimize --branch optimize/performance

# 2. Baseline in benchmark worktree
cd .worktrees/benchmark
npx claude-flow@alpha benchmark run --suite full --save-baseline

# 3. Optimize in separate worktree
cd .worktrees/optimize
npx claude-flow@alpha agent spawn --type perf-analyzer

# Agent analyzes and optimizes:
# - Database queries
# - API response times
# - Frontend rendering
# - Memory usage

# 4. Compare performance
npx claude-flow@alpha worktree compare \
  --baseline benchmark \
  --current optimize \
  --metric performance

# 5. Merge if improved
if [ $PERFORMANCE_GAIN -gt 20 ]; then
  npx claude-flow@alpha worktree merge --from optimize --to main
fi
```

### Example 4: Multi-Feature Development

**Scenario**: Develop 3 features simultaneously

```bash
# 1. Create feature worktrees
npx claude-flow@alpha worktree batch-create \
  --features "payment-gateway,notification-system,user-dashboard"

# Creates:
# .worktrees/
# ├── payment-gateway/
# ├── notification-system/
# └── user-dashboard/

# 2. Spawn agent teams for each
npx claude-flow@alpha swarm start \
  --topology hierarchical \
  --task "Develop all three features in parallel" \
  --assign-teams-to-worktrees true

# Team assignments:
# payment-gateway/      → backend-dev, tester, security-manager
# notification-system/  → backend-dev, mobile-dev, tester
# user-dashboard/       → frontend-dev, mobile-dev, tester

# 3. Each team works independently

# 4. Integration worktree
npx claude-flow@alpha worktree create --name integration --branch integration/all-features

# 5. Merge features to integration
npx claude-flow@alpha worktree merge-strategy \
  --strategy feature-toggle \
  --features payment-gateway,notification-system,user-dashboard \
  --target integration

# 6. Integration testing
cd .worktrees/integration
npm run test:integration

# 7. Merge to main
git checkout main
git merge integration/all-features
```

## Best Practices

### 1. Worktree Naming Convention

```bash
# Format: <type>/<feature>-<agent>
.worktrees/
├── feature/auth-backend/
├── feature/auth-frontend/
├── feature/auth-tests/
├── bugfix/login-issue-coder/
├── refactor/api-architect/
└── docs/api-reference-docs/
```

### 2. Memory Management

```bash
# Use worktree-scoped memory
npx claude-flow@alpha memory store \
  --key "feature/auth/status" \
  --value "Backend complete, tests pending" \
  --scope worktree \
  --worktree backend

# Global memory for coordination
npx claude-flow@alpha memory store \
  --key "project/status" \
  --value "3/5 features complete" \
  --scope global
```

### 3. Cleanup Strategy

```bash
# Auto-cleanup merged worktrees
npx claude-flow@alpha worktree cleanup \
  --merged-only \
  --older-than 7d

# Manual cleanup
npx claude-flow@alpha worktree list --merged
npx claude-flow@alpha worktree remove feature/auth-backend
```

### 4. Conflict Resolution

```json
{
  "conflicts": {
    "strategy": "coordinator-mediates",
    "autoResolve": {
      "whitespace": true,
      "imports": true,
      "formatting": true
    },
    "manualReview": [
      "business-logic",
      "security",
      "performance-critical"
    ]
  }
}
```

### 5. Performance Monitoring

```bash
# Monitor all worktrees
npx claude-flow@alpha worktree monitor \
  --dashboard \
  --metrics "cpu,memory,disk,build-time,test-time"

# Set alerts
npx claude-flow@alpha worktree alert \
  --condition "build-time > 5min" \
  --action "notify-coordinator"
```

### 6. Backup and Recovery

```bash
# Snapshot all worktrees
npx claude-flow@alpha worktree snapshot \
  --all \
  --output .snapshots/$(date +%Y%m%d)

# Restore worktree
npx claude-flow@alpha worktree restore \
  --snapshot .snapshots/20250121/backend \
  --to .worktrees/backend
```

## Troubleshooting

### Issue: Worktree Creation Fails

```bash
# Check Git version (needs 2.15+)
git --version

# Check for locked worktrees
git worktree list
git worktree prune

# Force cleanup
rm -rf .git/worktrees/*
git worktree prune
```

### Issue: Agents Not Coordinating

```bash
# Check agent assignments
npx claude-flow@alpha agent list --show-worktrees

# Verify communication
npx claude-flow@alpha agent ping --all

# Reset coordination
npx claude-flow@alpha swarm reset
npx claude-flow@alpha swarm start --topology mesh
```

### Issue: Memory Conflicts

```bash
# Check memory state
npx claude-flow@alpha memory list --scope all

# Clear worktree memory
npx claude-flow@alpha memory clear --worktree backend

# Reset all memory
npx claude-flow@alpha memory reset --confirm
```

### Issue: Sync Failures

```bash
# Manual sync
cd .worktrees/backend
git fetch origin
git rebase origin/main

# Force sync all
npx claude-flow@alpha worktree sync-all --force --strategy rebase
```

### Issue: Build Failures in Worktree

```bash
# Check node_modules
cd .worktrees/backend
rm -rf node_modules package-lock.json
npm install

# Verify configuration
npx claude-flow@alpha worktree validate --worktree backend

# Run diagnostics
npx claude-flow@alpha diagnostics --worktree backend
```

## Advanced Configuration

### Custom Worktree Hooks

Create `.claude-flow/hooks/worktree-hooks.js`:

```javascript
module.exports = {
  async onWorktreeCreate({ worktree, branch, agent }) {
    // Custom initialization
    console.log(`Creating worktree ${worktree} for ${agent}`);

    // Install dependencies
    await exec(`cd ${worktree} && npm install`);

    // Setup agent environment
    await exec(`cp .env.template ${worktree}/.env`);

    // Initialize agent memory
    await memory.store(`worktree/${worktree}/created`, Date.now());
  },

  async onWorktreeMerge({ from, to, conflicts }) {
    // Pre-merge validation
    const testsPassed = await exec(`cd ${from} && npm test`);
    if (!testsPassed) {
      throw new Error('Tests must pass before merge');
    }

    // Log merge
    await memory.store(`merge/${from}-to-${to}`, {
      timestamp: Date.now(),
      conflicts: conflicts.length
    });
  },

  async onWorktreeCleanup({ worktree, preserved }) {
    // Archive before cleanup
    if (!preserved) {
      await exec(`tar -czf .archives/${worktree}.tar.gz ${worktree}`);
    }

    // Clear memory
    await memory.clearScope(`worktree/${worktree}`);
  }
};
```

### Performance Tuning

```json
{
  "performance": {
    "maxConcurrentWorktrees": 5,
    "resourceLimits": {
      "cpu": 80,
      "memory": 75,
      "disk": 90
    },
    "throttling": {
      "enabled": true,
      "strategy": "adaptive",
      "minInterval": 100
    }
  }
}
```

## Summary

Git worktrees with Claude Flow enable:

- ✅ **True Parallelism**: 2.8-4.4x speed improvement
- ✅ **Agent Isolation**: Independent workspaces
- ✅ **Memory Efficiency**: Scoped context management
- ✅ **Flexible Coordination**: Multiple topology options
- ✅ **Quality Assurance**: Parallel testing and review
- ✅ **Rapid Development**: Simultaneous feature work

**Next Steps**:
- [Agent Configuration Guide](./AGENT_CONFIGURATION.md)
- [Hook Development Guide](./HOOK_DEVELOPMENT.md)
- [Template Customization](./TEMPLATE_CUSTOMIZATION.md)

---

**Pro Tip**: Start with 2-3 worktrees, master the workflow, then scale to full parallel development.
