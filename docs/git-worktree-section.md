## 🌳 Git Worktree Integration for Parallel Agents

### Why Use Git Worktrees for Agent Coordination

**Critical Benefits:**
- **Conflict Prevention**: Each agent works in isolated filesystem directories
- **True Parallelism**: Multiple agents can modify the same logical file simultaneously
- **Clean Contexts**: Each worktree has its own HEAD, staging area, and working directory
- **Safe Experimentation**: Agents can fail without affecting main workspace
- **Atomic Integration**: Merge verified changes only after agent completion

**Problem Without Worktrees:**
```bash
# ❌ CONFLICT: Two agents editing same file in main workspace
Agent 1: Edit src/api/users.ts     # Working...
Agent 2: Edit src/api/users.ts     # COLLISION! File locked/overwritten
```

**Solution With Worktrees:**
```bash
# ✅ ISOLATED: Each agent in separate worktree
Agent 1: Edit ../worktrees/agent-coder-1/src/api/users.ts
Agent 2: Edit ../worktrees/agent-coder-2/src/api/users.ts
# Merge conflicts resolved during integration, not during development
```

### When to Use Git Worktrees

**ALWAYS Use Worktrees When:**
- Spawning 2+ agents that may touch overlapping files
- Running parallel SPARC modes (architect + coder + tester)
- Conducting concurrent experiments/refactorings
- Performing long-running agent tasks (keep main workspace clean)
- Agent tasks require different git branches

**NEVER Use Worktrees When:**
- Single agent working sequentially
- Agent only reads files (no modifications)
- Agent works in completely isolated directories (e.g., `/tmp`)
- Quick, single-file edits

**Decision Matrix:**
| Scenario | Use Worktrees? | Reason |
|----------|----------------|--------|
| 3 agents: researcher (read), coder (write), tester (write) | YES | 2+ writers |
| 1 agent: coder implementing feature | NO | Single agent |
| 5 agents: all analyzing codebase | NO | Read-only |
| 2 agents: refactoring same module | YES | Write conflicts likely |

### Standardized Naming Conventions

**Worktree Directory Structure:**
```
/Users/iroselli/wundr/              # Main repository
├── .git/
├── src/
└── ../worktrees/                    # Parallel to main repo
    ├── agent-coder-{timestamp}/     # Implementation agent
    ├── agent-tester-{timestamp}/    # Testing agent
    ├── agent-reviewer-{timestamp}/  # Review agent
    └── sparc-{mode}-{timestamp}/    # SPARC mode execution
```

**Naming Pattern:**
```
agent-{type}-{timestamp}
sparc-{mode}-{timestamp}
swarm-{id}-agent-{type}-{index}

Examples:
agent-coder-20231121-143052
agent-tester-20231121-143053
sparc-architect-20231121-143100
swarm-mesh-1-agent-coder-1
```

**Branch Naming:**
```
worktree/{agent-type}/{task-id}
worktree/{sparc-mode}/{timestamp}

Examples:
worktree/coder/feature-auth
worktree/architect/system-redesign
worktree/tester/integration-tests
```

### Complete Agent Lifecycle Workflow

#### 1. Initialization Phase

```bash
# Setup worktree environment for parallel agent execution
AGENT_TYPE="coder"
TASK_ID="feature-auth"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
WORKTREE_NAME="agent-${AGENT_TYPE}-${TIMESTAMP}"
WORKTREE_PATH="/Users/iroselli/wundr/../worktrees/${WORKTREE_NAME}"
BRANCH_NAME="worktree/${AGENT_TYPE}/${TASK_ID}"

# Create worktree directory (if first time)
mkdir -p /Users/iroselli/wundr/../worktrees

# Create new worktree with dedicated branch
cd /Users/iroselli/wundr
git worktree add -b "${BRANCH_NAME}" "${WORKTREE_PATH}" master

# Verify worktree creation
git worktree list
```

**Expected Output:**
```
/Users/iroselli/wundr              f7cd045 [master]
/Users/iroselli/worktrees/agent-coder-20231121-143052  f7cd045 [worktree/coder/feature-auth]
```

#### 2. Agent Execution Phase

```bash
# Agent hooks: Pre-task setup
cd "${WORKTREE_PATH}"
npx claude-flow@alpha hooks pre-task --description "Implement ${TASK_ID}"
npx claude-flow@alpha hooks session-restore --session-id "worktree-${WORKTREE_NAME}"

# Agent performs work in isolated worktree
# All file operations happen in WORKTREE_PATH, not main repo
npm install  # Dependencies installed in worktree
npm run build
npm run test

# Agent hooks: Track progress
npx claude-flow@alpha hooks post-edit --file "${WORKTREE_PATH}/src/auth.ts" \
  --memory-key "worktree/${AGENT_TYPE}/${TASK_ID}/implementation"
npx claude-flow@alpha hooks notify --message "Authentication module implemented"

# Commit changes in worktree
git add .
git commit -m "feat(auth): Implement user authentication

Implemented in worktree: ${WORKTREE_NAME}
Task: ${TASK_ID}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Agent hooks: Post-task cleanup
npx claude-flow@alpha hooks post-task --task-id "${TASK_ID}"
npx claude-flow@alpha hooks session-end --export-metrics true
```

#### 3. Integration & Merge Phase

```bash
# Return to main repository
cd /Users/iroselli/wundr

# Review changes before merging
git diff master...${BRANCH_NAME}
git log master..${BRANCH_NAME} --oneline

# Run integration tests from main workspace
npm run test -- --coverage

# Merge worktree branch into master
git merge --no-ff ${BRANCH_NAME} -m "Merge ${TASK_ID} from ${WORKTREE_NAME}

Completed by agent: ${AGENT_TYPE}
Worktree: ${WORKTREE_NAME}
Branch: ${BRANCH_NAME}"

# Verify merge success
git log -1 --stat
```

#### 4. Cleanup Phase

```bash
# Remove worktree after successful merge
git worktree remove "${WORKTREE_PATH}"

# Delete remote branch (if pushed)
git branch -d "${BRANCH_NAME}"

# Verify cleanup
git worktree list  # Should not show removed worktree
git branch         # Should not show deleted branch

# Optional: Prune stale worktree references
git worktree prune
```

### Multi-Agent Parallel Execution

**Scenario: 3 Agents Working Simultaneously**

```bash
# Coordinator spawns 3 agents in parallel
TASK="Implement user management system"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Setup all worktrees in single operation
git worktree add -b "worktree/coder/user-api" \
  "/Users/iroselli/wundr/../worktrees/agent-coder-${TIMESTAMP}" master &

git worktree add -b "worktree/tester/user-tests" \
  "/Users/iroselli/wundr/../worktrees/agent-tester-${TIMESTAMP}" master &

git worktree add -b "worktree/reviewer/user-review" \
  "/Users/iroselli/wundr/../worktrees/agent-reviewer-${TIMESTAMP}" master &

wait  # Wait for all worktrees to be created

# Verify all worktrees ready
git worktree list

# Now spawn agents with isolated contexts
# Agent 1: Implementation
cd "/Users/iroselli/wundr/../worktrees/agent-coder-${TIMESTAMP}"
# ... agent work ...

# Agent 2: Testing
cd "/Users/iroselli/wundr/../worktrees/agent-tester-${TIMESTAMP}"
# ... agent work ...

# Agent 3: Review
cd "/Users/iroselli/wundr/../worktrees/agent-reviewer-${TIMESTAMP}"
# ... agent work ...
```

### Best Practices

#### ✅ DO:

1. **Always Use Absolute Paths**
   ```bash
   # ✅ CORRECT
   WORKTREE_PATH="/Users/iroselli/wundr/../worktrees/agent-coder-123"

   # ❌ WRONG
   WORKTREE_PATH="../worktrees/agent-coder-123"
   ```

2. **Create Worktrees from Clean State**
   ```bash
   # ✅ Verify main workspace is clean before creating worktrees
   cd /Users/iroselli/wundr
   git status  # Should show "working tree clean"
   git worktree add ...
   ```

3. **Use Descriptive Branch Names**
   ```bash
   # ✅ Clear purpose
   worktree/coder/feature-auth
   worktree/refactor/api-redesign

   # ❌ Unclear
   worktree/temp
   worktree/test
   ```

4. **Verify Before Cleanup**
   ```bash
   # ✅ Check merge success before removing worktree
   git log --oneline --graph --all -10
   git diff master ${BRANCH_NAME}  # Should show no differences
   git worktree remove ...
   ```

5. **Use Worktree-Specific Dependencies**
   ```bash
   # ✅ Each worktree has own node_modules
   cd "${WORKTREE_PATH}"
   npm install  # Installs in worktree, not main repo
   ```

6. **Track Worktree Metadata**
   ```bash
   # ✅ Store worktree info for debugging
   git worktree list > /tmp/active-worktrees.txt
   npx claude-flow@alpha hooks notify --message "Created worktree: ${WORKTREE_NAME}"
   ```

#### ❌ DON'T:

1. **Don't Create Nested Worktrees**
   ```bash
   # ❌ WRONG: Worktree inside repo
   git worktree add ./worktrees/agent-1

   # ✅ CORRECT: Worktree parallel to repo
   git worktree add ../worktrees/agent-1
   ```

2. **Don't Reuse Worktree Paths**
   ```bash
   # ❌ WRONG: Overwriting existing worktree
   git worktree add /same/path/agent-1  # Path already exists!

   # ✅ CORRECT: Unique timestamps
   git worktree add "/path/agent-$(date +%Y%m%d-%H%M%S)"
   ```

3. **Don't Skip Cleanup**
   ```bash
   # ❌ WRONG: Leaving orphaned worktrees
   # (worktrees accumulate, waste disk space)

   # ✅ CORRECT: Always cleanup after merge
   git worktree remove "${WORKTREE_PATH}"
   git worktree prune
   ```

4. **Don't Modify Same Files Manually**
   ```bash
   # ❌ WRONG: Editing files in both main repo and worktree
   # (creates merge conflicts)

   # ✅ CORRECT: All work in worktree, merge when done
   ```

5. **Don't Create Worktrees Without Branches**
   ```bash
   # ❌ WRONG: Detached HEAD state
   git worktree add /path/worktree HEAD

   # ✅ CORRECT: Named branch
   git worktree add -b worktree/coder/task /path/worktree master
   ```

6. **Don't Push Worktree Branches to Remote**
   ```bash
   # ❌ WRONG: Polluting remote with temp branches
   git push origin worktree/coder/temp

   # ✅ CORRECT: Keep worktree branches local
   # Merge to main branch, then push main
   ```

### Real-World Use Cases

#### Use Case 1: SPARC TDD Workflow (3 Parallel Agents)

**Scenario**: Running complete TDD cycle with isolated agents

```bash
TASK="User authentication module"
TS=$(date +%Y%m%d-%H%M%S)

# Create 3 worktrees for SPARC phases
git worktree add -b "worktree/sparc/architect-${TS}" \
  "/Users/iroselli/wundr/../worktrees/sparc-architect-${TS}" master

git worktree add -b "worktree/sparc/coder-${TS}" \
  "/Users/iroselli/wundr/../worktrees/sparc-coder-${TS}" master

git worktree add -b "worktree/sparc/tester-${TS}" \
  "/Users/iroselli/wundr/../worktrees/sparc-tester-${TS}" master

# Architect: Design system
cd "/Users/iroselli/wundr/../worktrees/sparc-architect-${TS}"
npx claude-flow sparc run architect "${TASK}"
git commit -am "docs: Architecture design for auth module"

# Coder: Implement (based on architecture)
cd "/Users/iroselli/wundr/../worktrees/sparc-coder-${TS}"
git merge "worktree/sparc/architect-${TS}"  # Get architecture docs
npx claude-flow sparc run coder "${TASK}"
git commit -am "feat: Implement authentication module"

# Tester: Create tests (parallel to implementation)
cd "/Users/iroselli/wundr/../worktrees/sparc-tester-${TS}"
npx claude-flow sparc run tester "${TASK}"
git commit -am "test: Add auth module test suite"

# Integration: Merge all changes
cd /Users/iroselli/wundr
git merge --no-ff "worktree/sparc/coder-${TS}"
git merge --no-ff "worktree/sparc/tester-${TS}"
npm run test  # Verify all tests pass

# Cleanup all worktrees
git worktree remove "/Users/iroselli/wundr/../worktrees/sparc-architect-${TS}"
git worktree remove "/Users/iroselli/wundr/../worktrees/sparc-coder-${TS}"
git worktree remove "/Users/iroselli/wundr/../worktrees/sparc-tester-${TS}"
```

#### Use Case 2: Competing Implementations (A/B Testing)

**Scenario**: Two agents try different approaches, pick best one

```bash
TASK="Optimize database query performance"
TS=$(date +%Y%m%d-%H%M%S)

# Create 2 worktrees for competing approaches
git worktree add -b "worktree/optimize/approach-a-${TS}" \
  "/Users/iroselli/wundr/../worktrees/optimize-a-${TS}" master

git worktree add -b "worktree/optimize/approach-b-${TS}" \
  "/Users/iroselli/wundr/../worktrees/optimize-b-${TS}" master

# Agent A: Indexing optimization
cd "/Users/iroselli/wundr/../worktrees/optimize-a-${TS}"
# Implement indexing strategy
git commit -am "perf: Add database indexes"
npm run benchmark > /tmp/benchmark-a.txt

# Agent B: Query caching
cd "/Users/iroselli/wundr/../worktrees/optimize-b-${TS}"
# Implement caching layer
git commit -am "perf: Add query caching"
npm run benchmark > /tmp/benchmark-b.txt

# Compare results
cd /Users/iroselli/wundr
diff /tmp/benchmark-a.txt /tmp/benchmark-b.txt

# Merge winning approach (let's say approach B)
git merge --no-ff "worktree/optimize/approach-b-${TS}"

# Discard losing approach
git worktree remove "/Users/iroselli/wundr/../worktrees/optimize-a-${TS}"
git branch -D "worktree/optimize/approach-a-${TS}"

# Cleanup winner worktree
git worktree remove "/Users/iroselli/wundr/../worktrees/optimize-b-${TS}"
```

#### Use Case 3: Concurrent Refactoring (Multiple Modules)

**Scenario**: 4 agents refactoring different parts of codebase

```bash
MODULES=("auth" "api" "database" "ui")
TS=$(date +%Y%m%d-%H%M%S)

# Create worktrees for each module
for MODULE in "${MODULES[@]}"; do
  git worktree add -b "worktree/refactor/${MODULE}-${TS}" \
    "/Users/iroselli/wundr/../worktrees/refactor-${MODULE}-${TS}" master
done

# Verify all worktrees created
git worktree list

# Each agent works independently
# Agent 1: Refactor auth
cd "/Users/iroselli/wundr/../worktrees/refactor-auth-${TS}"
# ... refactoring work ...
git commit -am "refactor(auth): Modernize authentication logic"

# Agent 2: Refactor API
cd "/Users/iroselli/wundr/../worktrees/refactor-api-${TS}"
# ... refactoring work ...
git commit -am "refactor(api): Improve API structure"

# Agent 3: Refactor database
cd "/Users/iroselli/wundr/../worktrees/refactor-database-${TS}"
# ... refactoring work ...
git commit -am "refactor(db): Optimize database layer"

# Agent 4: Refactor UI
cd "/Users/iroselli/wundr/../worktrees/refactor-ui-${TS}"
# ... refactoring work ...
git commit -am "refactor(ui): Update UI components"

# Sequential integration (to handle potential conflicts)
cd /Users/iroselli/wundr
for MODULE in "${MODULES[@]}"; do
  echo "Merging ${MODULE} refactoring..."
  git merge --no-ff "worktree/refactor/${MODULE}-${TS}"
  npm run test  # Verify no regressions
done

# Cleanup all worktrees
for MODULE in "${MODULES[@]}"; do
  git worktree remove "/Users/iroselli/wundr/../worktrees/refactor-${MODULE}-${TS}"
done
```

#### Use Case 4: Long-Running Migration (Keep Main Clean)

**Scenario**: Multi-day TypeScript migration while maintaining main workspace

```bash
TASK="Migrate to TypeScript"
TS=$(date +%Y%m%d-%H%M%S)

# Create long-lived worktree for migration
git worktree add -b "worktree/migration/typescript-${TS}" \
  "/Users/iroselli/wundr/../worktrees/migration-ts-${TS}" master

# Day 1: Convert core files
cd "/Users/iroselli/wundr/../worktrees/migration-ts-${TS}"
# ... migration work ...
git commit -am "refactor: Convert core to TypeScript (day 1)"

# Meanwhile: Main workspace stays on master for hotfixes
cd /Users/iroselli/wundr
git checkout master  # Main workspace always on master
# ... urgent bug fix ...
git commit -am "fix: Critical production bug"
git push origin master

# Day 2: Continue migration, sync with master
cd "/Users/iroselli/wundr/../worktrees/migration-ts-${TS}"
git merge master  # Get latest hotfixes
# ... more migration work ...
git commit -am "refactor: Convert API to TypeScript (day 2)"

# Day 3: Complete migration
# ... final migration work ...
git commit -am "refactor: Complete TypeScript migration (day 3)"
npm run build
npm run test

# Integration: Merge multi-day work
cd /Users/iroselli/wundr
git merge --no-ff "worktree/migration/typescript-${TS}"

# Cleanup
git worktree remove "/Users/iroselli/wundr/../worktrees/migration-ts-${TS}"
```

#### Use Case 5: Emergency Hotfix (While Agents Working)

**Scenario**: Urgent fix needed while agents are mid-task

```bash
# Agents already working in worktrees
# Agent 1: /Users/iroselli/wundr/../worktrees/agent-coder-123
# Agent 2: /Users/iroselli/wundr/../worktrees/agent-tester-456

# URGENT: Production bug needs immediate fix
cd /Users/iroselli/wundr  # Main workspace

# Create hotfix worktree
git worktree add -b "hotfix/critical-bug-$(date +%Y%m%d-%H%M%S)" \
  "/Users/iroselli/wundr/../worktrees/hotfix-critical" master

# Fix in hotfix worktree
cd "/Users/iroselli/wundr/../worktrees/hotfix-critical"
# ... implement fix ...
git commit -am "fix: Critical production bug"
npm run test

# Merge hotfix immediately
cd /Users/iroselli/wundr
git merge --no-ff hotfix/critical-bug-*
git push origin master

# Notify agents to rebase on new master
# Agent 1 & 2 will merge master into their worktrees when ready
cd "/Users/iroselli/wundr/../worktrees/agent-coder-123"
git merge master  # Get hotfix

cd "/Users/iroselli/wundr/../worktrees/agent-tester-456"
git merge master  # Get hotfix

# Cleanup hotfix worktree
cd /Users/iroselli/wundr
git worktree remove "/Users/iroselli/wundr/../worktrees/hotfix-critical"
```

### Troubleshooting & Recovery

#### Problem: Worktree Path Already Exists

```bash
# Error: "fatal: '/path/to/worktree' already exists"

# Solution 1: Remove stale directory
rm -rf /Users/iroselli/wundr/../worktrees/agent-coder-123
git worktree add ...

# Solution 2: Use different timestamp
TS=$(date +%Y%m%d-%H%M%S-%N)  # Add nanoseconds for uniqueness
git worktree add "/path/agent-${TS}" ...
```

#### Problem: Branch Already Exists

```bash
# Error: "fatal: a branch named 'worktree/coder/task' already exists"

# Solution: Use unique branch name
git worktree add -b "worktree/coder/task-${TS}" ...

# Or delete old branch if truly orphaned
git branch -D worktree/coder/task
git worktree add -b "worktree/coder/task" ...
```

#### Problem: Worktree Locked

```bash
# Error: "fatal: 'remove' cannot be used on locked working tree"

# Solution: Unlock and remove
git worktree unlock /Users/iroselli/wundr/../worktrees/agent-coder-123
git worktree remove /Users/iroselli/wundr/../worktrees/agent-coder-123
```

#### Problem: Merge Conflicts

```bash
# Conflict when merging worktree branch

# Solution: Resolve in main workspace
cd /Users/iroselli/wundr
git merge worktree/coder/task  # Conflict detected
git status  # See conflicting files
# ... resolve conflicts manually ...
git add .
git commit -m "Merge worktree/coder/task (resolved conflicts)"
```

### Integration with Agent Coordination Protocol

**Complete Example: Worktree + Hooks + Coordination**

```bash
#!/bin/bash
# Complete agent execution with worktree isolation

AGENT_TYPE="coder"
TASK_ID="feature-payment"
TASK_DESC="Implement payment processing module"
TS=$(date +%Y%m%d-%H%M%S)
WORKTREE_NAME="agent-${AGENT_TYPE}-${TS}"
WORKTREE_PATH="/Users/iroselli/wundr/../worktrees/${WORKTREE_NAME}"
BRANCH_NAME="worktree/${AGENT_TYPE}/${TASK_ID}"

# 1. Initialize swarm and worktree
cd /Users/iroselli/wundr
npx claude-flow@alpha hooks pre-task --description "${TASK_DESC}"
git worktree add -b "${BRANCH_NAME}" "${WORKTREE_PATH}" master

# 2. Agent execution in worktree
cd "${WORKTREE_PATH}"
npx claude-flow@alpha hooks session-restore --session-id "worktree-${WORKTREE_NAME}"

# Agent work happens here
# ... implementation ...

# 3. Track progress
npx claude-flow@alpha hooks post-edit \
  --file "${WORKTREE_PATH}/src/payment.ts" \
  --memory-key "worktree/${AGENT_TYPE}/${TASK_ID}/implementation"

# 4. Commit in worktree
git add .
git commit -m "feat(payment): Implement payment module

Worktree: ${WORKTREE_NAME}
Task: ${TASK_ID}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 5. Notify completion
npx claude-flow@alpha hooks notify --message "Payment module complete in ${WORKTREE_NAME}"
npx claude-flow@alpha hooks post-task --task-id "${TASK_ID}"

# 6. Integration
cd /Users/iroselli/wundr
npm run test  # Verify tests pass
git merge --no-ff "${BRANCH_NAME}"

# 7. Cleanup
npx claude-flow@alpha hooks session-end --export-metrics true
git worktree remove "${WORKTREE_PATH}"
git branch -d "${BRANCH_NAME}"

echo "✅ Agent task complete: ${TASK_ID}"
echo "✅ Worktree cleaned: ${WORKTREE_NAME}"
```

---

**Remember**: Git worktrees enable true parallel agent execution by providing isolated filesystem contexts. Use them whenever multiple agents might conflict, and always clean up after integration!
