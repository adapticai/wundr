# Claude Code Master Configuration - Enterprise SPARC Development Environment

> **Version**: 3.0.0 **Last Updated**: 2025-01-21 **Status**: Production Ready

## Table of Contents

1. [Critical Protocols](#critical-protocols)
2. [Git Worktree Integration](#git-worktree-integration)
3. [Agent Orchestration](#agent-orchestration)
4. [Concurrent Execution Patterns](#concurrent-execution-patterns)
5. [File Organization](#file-organization)
6. [All Agent Types](#all-agent-types)
7. [MCP Tools Integration](#mcp-tools-integration)
8. [Claude Code Best Practices](#claude-code-best-practices)
9. [Performance Optimization](#performance-optimization)
10. [Quality Assurance](#quality-assurance)

---

## 🚨 CRITICAL PROTOCOLS

### VERIFICATION PROTOCOL & REALITY CHECKS

**MANDATORY: ALWAYS VERIFY, NEVER ASSUME**

After EVERY code change or implementation:

1. **TEST IT**: Run the actual command and show real output
2. **PROVE IT**: Show file contents, build results, test output
3. **FAIL LOUDLY**: If something fails, say "❌ FAILED:" immediately
4. **VERIFY SUCCESS**: Only claim "complete" after showing it working

**NEVER claim completion without:**

- Actual terminal output proving it works
- Build command succeeding (`npm run build`, etc.)
- Tests passing (if applicable)
- The feature demonstrably working

**When something fails:**

1. Report immediately: "❌ FAILURE: [specific error]"
2. Show the actual error message
3. Do NOT continue pretending it worked
4. Do NOT claim partial success without verification

### VERIFICATION CHECKPOINTS

Before claiming ANY task complete:

- [ ] Does the build succeed? (show `npm run build` output)
- [ ] Do tests pass? (show test output)
- [ ] Can you run it? (show execution)
- [ ] Did you verify, not assume? (show proof)
- [ ] Are all worktrees in sync? (if using git-worktree)
- [ ] Did agents complete their tasks? (show status)

### HONESTY REQUIREMENTS

**You MUST:**

- Test every claim with actual commands
- Show real terminal output (not fictional)
- Say "I cannot verify this" if you can't test it
- Report failures immediately and clearly
- Track all failures in a list
- Verify cross-worktree consistency

**You MUST NOT:**

- Assume code works without testing
- Create fictional success messages
- Claim completion without verification
- Hide, minimize, or gloss over failures
- Generate imaginary terminal output
- Skip worktree validation steps

---

## 🌳 GIT WORKTREE INTEGRATION

### Overview

Git worktrees enable parallel development by allowing multiple working directories from a single
repository. This is essential for agent-based concurrent workflows.

### Core Worktree Commands

```bash
# List all worktrees
git worktree list

# Create new worktree
git worktree add <path> <branch>

# Create worktree with new branch
git worktree add -b <new-branch> <path> <base-branch>

# Remove worktree
git worktree remove <path>

# Prune stale worktree entries
git worktree prune
```

### Worktree Workflow Protocol

#### 1. Initialize Multi-Agent Worktree Environment

```bash
# Create base worktree structure
mkdir -p .worktrees
git worktree add .worktrees/agent-coder -b feature/coder-$(date +%s) main
git worktree add .worktrees/agent-tester -b feature/tester-$(date +%s) main
git worktree add .worktrees/agent-reviewer -b feature/reviewer-$(date +%s) main

# Verify creation
git worktree list
```

#### 2. Agent-Specific Worktree Assignment

Each agent MUST:

- Work in its own dedicated worktree
- Create feature branches from the appropriate base
- Never directly modify other agent worktrees
- Sync with main branch regularly

**Agent Worktree Mapping:**

```
.worktrees/
├── agent-coder/          # Development work
├── agent-tester/         # Test creation
├── agent-reviewer/       # Code review & refactoring
├── agent-architect/      # Design & architecture
├── agent-researcher/     # Research & analysis
└── integration/          # Final integration workspace
```

#### 3. Worktree Coordination Protocol

**BEFORE starting work:**

```bash
# Agent initialization
cd .worktrees/agent-[name]
git fetch origin
git rebase origin/main
npx claude-flow@alpha hooks pre-task --description "[task]" --worktree "agent-[name]"
```

**DURING work:**

```bash
# Regular commits within worktree
git add .
git commit -m "[agent]: [description]"
npx claude-flow@alpha hooks post-edit --file "[file]" --worktree "agent-[name]"
```

**AFTER completing work:**

```bash
# Push worktree branch
git push -u origin HEAD

# Create PR from worktree branch
gh pr create --title "[Agent] Feature implementation" \
  --body "Completed in worktree: agent-[name]"

# Notify coordination system
npx claude-flow@alpha hooks post-task --task-id "[task]" --worktree "agent-[name]"
```

#### 4. Worktree Merge & Integration Strategy

**Integration Workflow:**

```bash
# 1. All agents complete in their worktrees
# 2. Integration agent validates all branches
cd .worktrees/integration
git fetch --all

# 3. Merge agent branches sequentially
git merge origin/feature/coder-*
git merge origin/feature/tester-*
git merge origin/feature/reviewer-*

# 4. Resolve conflicts
# 5. Run full test suite
npm test

# 6. Create integration PR
git push -u origin feature/integration-[timestamp]
gh pr create --title "Integration: Multi-agent feature" --body "[summary]"
```

### Worktree Best Practices

1. **Isolation**: Each agent works in complete isolation
2. **Naming**: Use descriptive, timestamped branch names
3. **Cleanup**: Remove worktrees after merging
4. **Sync**: Regularly rebase from main
5. **Verification**: Always test before pushing

### Worktree Cleanup Protocol

```bash
# After successful merge
git worktree remove .worktrees/agent-[name]
git worktree prune
git branch -d feature/[agent]-[timestamp]
git push origin --delete feature/[agent]-[timestamp]
```

---

## 🤖 AGENT ORCHESTRATION

### Agent Coordination Protocol

Every agent MUST follow this protocol for proper coordination:

#### Phase 1: Pre-Work Setup

```bash
# Initialize worktree
git worktree add .worktrees/agent-[name] -b feature/[name]-[task] main

# Move to worktree
cd .worktrees/agent-[name]

# Register with coordination system
npx claude-flow@alpha hooks pre-task \
  --description "[task description]" \
  --agent "[agent-type]" \
  --worktree "agent-[name]"

# Restore session context
npx claude-flow@alpha hooks session-restore \
  --session-id "swarm-[id]" \
  --agent "[agent-type]"
```

#### Phase 2: Active Work

```bash
# During implementation
npx claude-flow@alpha hooks post-edit \
  --file "[file-path]" \
  --memory-key "swarm/[agent]/[step]" \
  --worktree "agent-[name]"

# Progress notifications
npx claude-flow@alpha hooks notify \
  --message "[what was done]" \
  --agent "[agent-type]" \
  --progress "[percentage]"
```

#### Phase 3: Completion & Handoff

```bash
# Complete task
npx claude-flow@alpha hooks post-task \
  --task-id "[task]" \
  --agent "[agent-type]" \
  --worktree "agent-[name]" \
  --status "complete"

# Export session metrics
npx claude-flow@alpha hooks session-end \
  --export-metrics true \
  --agent "[agent-type]"

# Create handoff PR
git push -u origin HEAD
gh pr create --title "[Agent] Task completion" \
  --body "$(cat <<'EOF'
## Agent: [agent-type]
## Task: [description]
## Worktree: agent-[name]

### Changes
- [change 1]
- [change 2]

### Verification
- [x] Tests pass
- [x] Build succeeds
- [x] Linting clean

### Next Steps
[handoff instructions]
EOF
)"
```

### Multi-Agent Coordination Patterns

#### Pattern 1: Sequential Pipeline

```javascript
// Agent 1: Researcher
Task("Research agent: Analyze requirements and create specification")
  → Worktree: .worktrees/agent-researcher
  → Output: docs/specification.md

// Agent 2: Architect (waits for Agent 1)
Task("Architect agent: Design system based on specification")
  → Worktree: .worktrees/agent-architect
  → Input: docs/specification.md
  → Output: docs/architecture.md

// Agent 3: Coder (waits for Agent 2)
Task("Coder agent: Implement based on architecture")
  → Worktree: .worktrees/agent-coder
  → Input: docs/architecture.md
  → Output: src/implementation/*

// Agent 4: Tester (parallel with Agent 3)
Task("Tester agent: Create test suite")
  → Worktree: .worktrees/agent-tester
  → Input: docs/architecture.md
  → Output: tests/*
```

#### Pattern 2: Parallel Swarm

```javascript
// Initialize swarm with worktrees
mcp__claude -
  flow__swarm_init({
    topology: 'mesh',
    maxAgents: 6,
    worktreeEnabled: true,
    worktreeBase: '.worktrees',
  })[
    // Spawn agents in parallel
    (Task('Backend agent: Implement API → .worktrees/agent-backend'),
    Task('Frontend agent: Implement UI → .worktrees/agent-frontend'),
    Task('Database agent: Design schema → .worktrees/agent-database'),
    Task('Test agent: Create E2E tests → .worktrees/agent-test'),
    Task('Docs agent: Write documentation → .worktrees/agent-docs'))
  ];

// Integration agent merges all
Task('Integration agent: Merge and verify all branches → .worktrees/integration');
```

#### Pattern 3: Hierarchical Coordination

```javascript
// Coordinator spawns sub-agents
mcp__claude-flow__agent_spawn({
  type: "hierarchical-coordinator",
  worktree: ".worktrees/coordinator"
})

// Coordinator delegates to specialists
→ Spawns: coder (worktree: .worktrees/coder)
→ Spawns: tester (worktree: .worktrees/tester)
→ Spawns: reviewer (worktree: .worktrees/reviewer)

// Coordinator monitors and integrates
→ Collects: All agent outputs
→ Validates: Cross-agent consistency
→ Integrates: Final merge to main
```

---

## ⚡ CONCURRENT EXECUTION PATTERNS

### GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**

- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
- **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message
- **Worktree operations**: ALWAYS create ALL worktrees in ONE message

### ✅ CORRECT: Single Message Multi-Operation

```javascript
// Initialize complete swarm environment
[BatchOperations]:
  // 1. Initialize swarm
  mcp__claude-flow__swarm_init({
    topology: "mesh",
    maxAgents: 6,
    worktreeEnabled: true
  })

  // 2. Create all worktrees
  Bash("git worktree add .worktrees/agent-coder -b feature/coder-$(date +%s) main")
  Bash("git worktree add .worktrees/agent-tester -b feature/tester-$(date +%s) main")
  Bash("git worktree add .worktrees/agent-reviewer -b feature/reviewer-$(date +%s) main")

  // 3. Spawn all agents
  mcp__claude-flow__agent_spawn({ type: "researcher", worktree: ".worktrees/agent-researcher" })
  mcp__claude-flow__agent_spawn({ type: "coder", worktree: ".worktrees/agent-coder" })
  mcp__claude-flow__agent_spawn({ type: "tester", worktree: ".worktrees/agent-tester" })

  // 4. Create comprehensive todo list
  TodoWrite({
    todos: [
      {content: "Initialize worktrees", status: "completed", activeForm: "Initializing worktrees"},
      {content: "Research requirements", status: "in_progress", activeForm: "Researching requirements"},
      {content: "Design architecture", status: "pending", activeForm: "Designing architecture"},
      {content: "Implement features", status: "pending", activeForm: "Implementing features"},
      {content: "Write tests", status: "pending", activeForm: "Writing tests"},
      {content: "Review code", status: "pending", activeForm: "Reviewing code"},
      {content: "Integrate branches", status: "pending", activeForm: "Integrating branches"},
      {content: "Run full test suite", status: "pending", activeForm: "Running full test suite"},
      {content: "Create PR", status: "pending", activeForm: "Creating PR"},
      {content: "Clean up worktrees", status: "pending", activeForm: "Cleaning up worktrees"}
    ]
  })

  // 5. Setup file structure in parallel
  Bash("mkdir -p .worktrees/{src,tests,docs,config}")
  Write(".worktrees/agent-coder/src/index.ts")
  Write(".worktrees/agent-tester/tests/index.test.ts")
  Write(".worktrees/agent-researcher/docs/requirements.md")
```

### ❌ WRONG: Multiple Messages

```javascript
// DON'T DO THIS - Multiple sequential messages
Message 1: mcp__claude-flow__swarm_init
Message 2: Bash("git worktree add...")
Message 3: mcp__claude-flow__agent_spawn
Message 4: TodoWrite
Message 5: Write file
// This breaks parallel coordination and slows everything down!
```

### Advanced Concurrent Patterns

#### Pattern: Parallel File Operations

```javascript
// Read all relevant files at once
[ParallelReads]:
  Read("/path/to/config.ts")
  Read("/path/to/types.ts")
  Read("/path/to/utils.ts")
  Read("/path/to/tests/main.test.ts")

// Process and write all changes at once
[ParallelWrites]:
  Edit("/path/to/config.ts", oldContent, newContent)
  Edit("/path/to/types.ts", oldContent, newContent)
  Write("/path/to/new-feature.ts", content)
  Write("/path/to/tests/new-feature.test.ts", testContent)
```

#### Pattern: Multi-Worktree Setup

```javascript
// Create entire worktree environment in one message
[WorktreeSetup]:
  Bash(`
    git worktree add .worktrees/feature-a -b feature/a main &&
    git worktree add .worktrees/feature-b -b feature/b main &&
    git worktree add .worktrees/feature-c -b feature/c main &&
    git worktree add .worktrees/integration -b integration main &&
    git worktree list
  `)

  // Initialize each worktree
  Bash("cd .worktrees/feature-a && npm install")
  Bash("cd .worktrees/feature-b && npm install")
  Bash("cd .worktrees/feature-c && npm install")
```

---

## 📁 FILE ORGANIZATION

### Directory Structure

**NEVER save to root folder. Use these directories:**

```
project-root/
├── .worktrees/                 # Git worktrees (DO NOT commit)
│   ├── agent-coder/
│   ├── agent-tester/
│   ├── agent-reviewer/
│   └── integration/
├── src/                        # Source code files
│   ├── core/
│   ├── features/
│   ├── utils/
│   └── types/
├── tests/                      # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/                       # Documentation and markdown files
│   ├── architecture/
│   ├── api/
│   └── guides/
├── config/                     # Configuration files
│   ├── environments/
│   └── workflows/
├── scripts/                    # Utility scripts
│   ├── build/
│   └── deploy/
├── examples/                   # Example code
└── .claude/                    # Claude-specific files
    ├── commands/
    ├── templates/
    └── workflows/
```

### File Organization Rules

1. **Source Code** → `/src`
   - Implementation files
   - Business logic
   - Type definitions

2. **Tests** → `/tests`
   - Unit tests
   - Integration tests
   - E2E tests

3. **Documentation** → `/docs`
   - Markdown files
   - API documentation
   - Architecture diagrams

4. **Configuration** → `/config`
   - Environment configs
   - Build configurations
   - CI/CD workflows

5. **Scripts** → `/scripts`
   - Build scripts
   - Deployment scripts
   - Utility scripts

6. **Worktrees** → `/.worktrees`
   - Agent workspaces
   - Feature branches
   - Integration workspace
   - **Add to .gitignore**

### File Naming Conventions

```typescript
// Components
MyComponent.tsx;
MyComponent.test.tsx;
MyComponent.styles.ts;

// Utils
stringUtils.ts;
stringUtils.test.ts;

// Types
userTypes.ts;
apiTypes.ts;

// Configs
jest.config.ts;
webpack.config.ts;

// Documentation
API_REFERENCE.md;
ARCHITECTURE.md;
CONTRIBUTING.md;
```

---

## 🤖 ALL AGENT TYPES

### Complete Agent Registry (54 Agents)

#### Core Development Agents (5)

1. **coder** - Primary implementation agent
   - Purpose: Write production code
   - Specializes in: Implementation, refactoring, optimization
   - Worktree: `.worktrees/agent-coder`

2. **reviewer** - Code quality and review agent
   - Purpose: Review code for quality, security, performance
   - Specializes in: Code review, best practices, standards
   - Worktree: `.worktrees/agent-reviewer`

3. **tester** - Testing and quality assurance agent
   - Purpose: Create and run tests
   - Specializes in: Unit tests, integration tests, E2E tests
   - Worktree: `.worktrees/agent-tester`

4. **planner** - Project planning and task breakdown agent
   - Purpose: Break down complex tasks
   - Specializes in: Planning, estimation, task decomposition
   - Worktree: `.worktrees/agent-planner`

5. **researcher** - Research and analysis agent
   - Purpose: Investigate solutions and approaches
   - Specializes in: Research, documentation, feasibility analysis
   - Worktree: `.worktrees/agent-researcher`

#### Swarm Coordination Agents (5)

6. **hierarchical-coordinator** - Top-down coordination
   - Purpose: Manage hierarchical agent structures
   - Specializes in: Command chain, delegation, oversight

7. **mesh-coordinator** - Peer-to-peer coordination
   - Purpose: Coordinate equal peer agents
   - Specializes in: Distributed work, consensus

8. **adaptive-coordinator** - Dynamic coordination
   - Purpose: Adapt strategy based on progress
   - Specializes in: Strategy adjustment, optimization

9. **collective-intelligence-coordinator** - Swarm intelligence
   - Purpose: Leverage collective agent intelligence
   - Specializes in: Pattern recognition, emergent solutions

10. **swarm-memory-manager** - Shared memory management
    - Purpose: Manage shared knowledge across agents
    - Specializes in: Context sharing, knowledge persistence

#### Consensus & Distributed Agents (7)

11. **byzantine-coordinator** - Byzantine fault tolerance
    - Purpose: Handle unreliable or malicious agents
    - Specializes in: Fault tolerance, consensus in adversarial conditions

12. **raft-manager** - Raft consensus protocol
    - Purpose: Implement Raft consensus for distributed agents
    - Specializes in: Leader election, log replication

13. **gossip-coordinator** - Gossip protocol coordination
    - Purpose: Distribute information via gossip protocol
    - Specializes in: Eventually consistent communication

14. **consensus-builder** - General consensus building
    - Purpose: Build consensus among agents
    - Specializes in: Agreement protocols, voting

15. **crdt-synchronizer** - CRDT-based synchronization
    - Purpose: Conflict-free replicated data types
    - Specializes in: Merge conflicts, distributed state

16. **quorum-manager** - Quorum-based decisions
    - Purpose: Manage quorum-based voting
    - Specializes in: Majority consensus, voting protocols

17. **security-manager** - Security and access control
    - Purpose: Manage agent security and permissions
    - Specializes in: Authentication, authorization, security

#### Performance & Optimization Agents (5)

18. **perf-analyzer** - Performance analysis
    - Purpose: Analyze and optimize performance
    - Specializes in: Profiling, bottleneck detection

19. **performance-benchmarker** - Benchmarking
    - Purpose: Run performance benchmarks
    - Specializes in: Load testing, metrics collection

20. **task-orchestrator** - Task optimization
    - Purpose: Orchestrate task execution
    - Specializes in: Task scheduling, resource allocation

21. **memory-coordinator** - Memory optimization
    - Purpose: Optimize memory usage
    - Specializes in: Memory profiling, garbage collection

22. **smart-agent** - AI-powered optimization
    - Purpose: Apply ML to optimize workflows
    - Specializes in: Pattern learning, prediction

#### GitHub & Repository Agents (9)

23. **github-modes** - GitHub workflow modes
    - Purpose: Manage GitHub workflow modes
    - Specializes in: Workflow automation, mode switching

24. **pr-manager** - Pull request management
    - Purpose: Create and manage pull requests
    - Specializes in: PR creation, review requests

25. **code-review-swarm** - Distributed code review
    - Purpose: Coordinate multiple reviewers
    - Specializes in: Review distribution, consensus

26. **issue-tracker** - Issue management
    - Purpose: Track and manage issues
    - Specializes in: Issue triage, prioritization

27. **release-manager** - Release coordination
    - Purpose: Manage releases and versioning
    - Specializes in: Changelog, versioning, deployment

28. **workflow-automation** - CI/CD automation
    - Purpose: Automate workflows
    - Specializes in: GitHub Actions, automation

29. **project-board-sync** - Project board sync
    - Purpose: Sync with GitHub project boards
    - Specializes in: Board management, status updates

30. **repo-architect** - Repository structure
    - Purpose: Design repository architecture
    - Specializes in: Monorepo, structure, conventions

31. **multi-repo-swarm** - Multi-repository coordination
    - Purpose: Coordinate across multiple repositories
    - Specializes in: Cross-repo changes, dependencies

#### SPARC Methodology Agents (6)

32. **sparc-coord** - SPARC coordinator
    - Purpose: Coordinate SPARC workflow
    - Specializes in: SPARC phases, orchestration

33. **sparc-coder** - SPARC-specific coder
    - Purpose: Implement following SPARC methodology
    - Specializes in: SPARC-compliant implementation

34. **specification** - Requirements specification
    - Purpose: Create detailed specifications
    - Specializes in: Requirements gathering, documentation

35. **pseudocode** - Algorithm design
    - Purpose: Design algorithms in pseudocode
    - Specializes in: Algorithm design, logic planning

36. **architecture** - System architecture
    - Purpose: Design system architecture
    - Specializes in: Architecture patterns, system design

37. **refinement** - Code refinement
    - Purpose: Refine and optimize code
    - Specializes in: Optimization, refactoring, cleanup

#### Specialized Development Agents (8)

38. **backend-dev** - Backend development
    - Purpose: Implement backend services
    - Specializes in: APIs, databases, services

39. **mobile-dev** - Mobile development
    - Purpose: Implement mobile applications
    - Specializes in: iOS, Android, cross-platform

40. **ml-developer** - Machine learning development
    - Purpose: Implement ML models and pipelines
    - Specializes in: ML, data science, training

41. **cicd-engineer** - CI/CD engineering
    - Purpose: Build and maintain CI/CD pipelines
    - Specializes in: DevOps, automation, deployment

42. **api-docs** - API documentation
    - Purpose: Create API documentation
    - Specializes in: OpenAPI, docs generation

43. **system-architect** - System architecture
    - Purpose: Design system-level architecture
    - Specializes in: Infrastructure, scalability

44. **code-analyzer** - Static code analysis
    - Purpose: Analyze code quality and patterns
    - Specializes in: Linting, static analysis, metrics

45. **base-template-generator** - Template generation
    - Purpose: Generate base templates and boilerplate
    - Specializes in: Templates, scaffolding, standards

#### Testing & Validation Agents (2)

46. **tdd-london-swarm** - London-style TDD
    - Purpose: Implement London school TDD
    - Specializes in: Mock-heavy TDD, isolation

47. **production-validator** - Production validation
    - Purpose: Validate production readiness
    - Specializes in: Smoke tests, health checks

#### Migration & Planning Agents (2)

48. **migration-planner** - Migration planning
    - Purpose: Plan and execute migrations
    - Specializes in: Data migration, code migration

49. **swarm-init** - Swarm initialization
    - Purpose: Initialize swarm environments
    - Specializes in: Setup, configuration, bootstrap

#### Additional Specialized Agents (5)

50. **database-architect** - Database design
    - Purpose: Design database schemas and queries
    - Specializes in: SQL, NoSQL, optimization

51. **security-auditor** - Security auditing
    - Purpose: Audit code for security vulnerabilities
    - Specializes in: Security, penetration testing

52. **performance-optimizer** - Performance tuning
    - Purpose: Optimize application performance
    - Specializes in: Profiling, caching, optimization

53. **documentation-writer** - Documentation
    - Purpose: Write comprehensive documentation
    - Specializes in: Technical writing, tutorials

54. **integration-agent** - Integration coordination
    - Purpose: Integrate work from multiple agents
    - Specializes in: Merging, conflict resolution

---

## 🔧 MCP TOOLS INTEGRATION

### MCP vs Claude Code Division of Responsibilities

**Claude Code Handles:**

- File operations (Read, Write, Edit, Glob, Grep)
- Code generation and programming
- Bash commands and system operations
- Implementation work
- Project navigation and analysis
- TodoWrite and task management
- Git operations
- Package management
- Testing and debugging
- Worktree management

**MCP Tools Handle:**

- Coordination and planning
- Memory management
- Neural features
- Performance tracking
- Swarm orchestration
- GitHub integration
- Cross-agent communication
- Metrics collection

### Core MCP Tools

#### Coordination Tools

1. **swarm_init** - Initialize swarm

   ```javascript
   mcp__claude -
     flow__swarm_init({
       topology: 'mesh' | 'hierarchical' | 'adaptive',
       maxAgents: 6,
       worktreeEnabled: true,
       worktreeBase: '.worktrees',
     });
   ```

2. **agent_spawn** - Spawn new agent

   ```javascript
   mcp__claude-flow__agent_spawn({
     type: "coder" | "tester" | "reviewer" | ...,
     worktree: ".worktrees/agent-[name]",
     config: { ... }
   })
   ```

3. **task_orchestrate** - Orchestrate tasks
   ```javascript
   mcp__claude-flow__task_orchestrate({
     tasks: [...],
     mode: "parallel" | "sequential",
     worktrees: true
   })
   ```

#### Monitoring Tools

4. **swarm_status** - Check swarm status

   ```javascript
   mcp__claude - flow__swarm_status();
   ```

5. **agent_list** - List active agents

   ```javascript
   mcp__claude - flow__agent_list();
   ```

6. **agent_metrics** - Get agent metrics

   ```javascript
   mcp__claude -
     flow__agent_metrics({
       agentId: 'agent-coder',
       includeWorktree: true,
     });
   ```

7. **task_status** - Check task status

   ```javascript
   mcp__claude -
     flow__task_status({
       taskId: 'task-123',
     });
   ```

8. **task_results** - Get task results
   ```javascript
   mcp__claude -
     flow__task_results({
       taskId: 'task-123',
       includeMetrics: true,
     });
   ```

#### Memory & Neural Tools

9. **memory_usage** - Check memory usage

   ```javascript
   mcp__claude -
     flow__memory_usage({
       scope: 'swarm' | 'agent' | 'global',
     });
   ```

10. **neural_status** - Neural network status

    ```javascript
    mcp__claude - flow__neural_status();
    ```

11. **neural_train** - Train neural patterns

    ```javascript
    mcp__claude-flow__neural_train({
      patterns: [...],
      mode: "incremental" | "batch"
    })
    ```

12. **neural_patterns** - Get learned patterns
    ```javascript
    mcp__claude -
      flow__neural_patterns({
        category: 'performance' | 'quality' | 'patterns',
      });
    ```

#### GitHub Integration Tools

13. **github_swarm** - GitHub swarm operations

    ```javascript
    mcp__claude-flow__github_swarm({
      operation: "pr" | "issue" | "review",
      config: { ... }
    })
    ```

14. **repo_analyze** - Analyze repository

    ```javascript
    mcp__claude -
      flow__repo_analyze({
        repo: 'owner/repo',
        depth: 'full' | 'shallow',
      });
    ```

15. **pr_enhance** - Enhance pull requests

    ```javascript
    mcp__claude -
      flow__pr_enhance({
        prNumber: 123,
        enhancements: ['description', 'tests', 'docs'],
      });
    ```

16. **issue_triage** - Triage issues

    ```javascript
    mcp__claude -
      flow__issue_triage({
        repo: 'owner/repo',
        labels: true,
        priority: true,
      });
    ```

17. **code_review** - Automated code review
    ```javascript
    mcp__claude -
      flow__code_review({
        prNumber: 123,
        depth: 'full' | 'shallow',
        focus: ['security', 'performance', 'style'],
      });
    ```

#### System Tools

18. **benchmark_run** - Run benchmarks

    ```javascript
    mcp__claude -
      flow__benchmark_run({
        suite: 'performance' | 'load' | 'stress',
        worktrees: true,
      });
    ```

19. **features_detect** - Detect features

    ```javascript
    mcp__claude -
      flow__features_detect({
        scope: 'hardware' | 'software' | 'environment',
      });
    ```

20. **swarm_monitor** - Monitor swarm
    ```javascript
    mcp__claude -
      flow__swarm_monitor({
        interval: 1000,
        metrics: ['performance', 'memory', 'agents'],
      });
    ```

### Wundr MCP Tools

21. **drift_detection** - Monitor code quality drift

    ```javascript
    mcp__wundr__drift_detection({
      operation: 'check' | 'baseline' | 'trends',
    });
    ```

22. **pattern_standardize** - Auto-fix code patterns

    ```javascript
    mcp__wundr__pattern_standardize({
      patterns: ['error-handling', 'imports', 'naming'],
      autoFix: true,
    });
    ```

23. **monorepo_manage** - Monorepo management

    ```javascript
    mcp__wundr__monorepo_manage({
      operation: 'init' | 'add' | 'check-circular',
    });
    ```

24. **governance_report** - Generate governance reports

    ```javascript
    mcp__wundr__governance_report({
      type: 'weekly' | 'monthly' | 'compliance',
      includeMetrics: true,
    });
    ```

25. **dependency_analyze** - Analyze dependencies

    ```javascript
    mcp__wundr__dependency_analyze({
      type: 'circular' | 'unused' | 'outdated',
    });
    ```

26. **test_baseline** - Manage test coverage baseline

    ```javascript
    mcp__wundr__test_baseline({
      operation: 'create' | 'compare' | 'update',
    });
    ```

27. **claude_config** - Configure Claude Code
    ```javascript
    mcp__wundr__claude_config({
      operation: 'generate' | 'setup-hooks' | 'conventions',
    });
    ```

### MCP Setup

```bash
# Install Claude Flow MCP
claude mcp add claude-flow npx claude-flow@alpha mcp start

# Install Wundr MCP tools
cd mcp-tools && ./install.sh

# Verify installation
claude mcp list
```

---

## 💡 CLAUDE CODE BEST PRACTICES

### Code Style & Quality

1. **Modular Design**
   - Keep files under 500 lines
   - Single responsibility principle
   - Clear separation of concerns

2. **Type Safety**
   - Use TypeScript for all new code
   - Strict type checking enabled
   - No implicit any

3. **Error Handling**
   - Always handle errors explicitly
   - Use custom error types
   - Provide meaningful error messages

4. **Testing**
   - Write tests before implementation (TDD)
   - Maintain > 80% code coverage
   - Include unit, integration, and E2E tests

5. **Documentation**
   - JSDoc comments for public APIs
   - README for each major module
   - Keep documentation up to date

### SPARC Methodology

#### Specification Phase

```typescript
/**
 * Feature: User Authentication
 *
 * Requirements:
 * - Secure password hashing
 * - JWT token generation
 * - Session management
 * - Rate limiting
 *
 * Success Criteria:
 * - Authentication in < 200ms
 * - 99.9% uptime
 * - OWASP compliant
 */
```

#### Pseudocode Phase

```typescript
/**
 * Algorithm: Authenticate User
 *
 * Input: email, password
 * Output: JWT token or error
 *
 * Steps:
 * 1. Validate input format
 * 2. Find user by email
 * 3. Verify password hash
 * 4. Check account status
 * 5. Generate JWT token
 * 6. Update last login
 * 7. Return token
 */
```

#### Architecture Phase

```typescript
/**
 * Architecture: Authentication Service
 *
 * Components:
 * - AuthController: Handle HTTP requests
 * - AuthService: Business logic
 * - UserRepository: Data access
 * - TokenService: JWT management
 * - HashService: Password hashing
 *
 * Dependencies:
 * - bcrypt: Password hashing
 * - jsonwebtoken: JWT tokens
 * - express: HTTP framework
 */
```

#### Refinement Phase

- Implement following TDD
- Write tests first
- Refactor for performance
- Optimize for readability

#### Completion Phase

- Integration testing
- Documentation
- Code review
- Deployment preparation

### Build & Development Commands

```bash
# Development
npm run dev              # Start development server
npm run watch            # Watch mode for changes

# Building
npm run build            # Build for production
npm run build:dev        # Build for development
npm run clean            # Clean build artifacts

# Testing
npm test                 # Run all tests
npm run test:unit        # Run unit tests
npm run test:integration # Run integration tests
npm run test:e2e         # Run E2E tests
npm run test:coverage    # Run with coverage

# Quality
npm run lint             # Run linter
npm run lint:fix         # Fix linting issues
npm run typecheck        # TypeScript type checking
npm run format           # Format code with Prettier

# Worktree management
npm run worktree:create  # Create new worktree
npm run worktree:list    # List all worktrees
npm run worktree:clean   # Clean up worktrees
```

---

## 🚀 PERFORMANCE OPTIMIZATION

### Performance Metrics

Target metrics for all implementations:

- **Build Time**: < 30 seconds
- **Test Suite**: < 2 minutes
- **Code Coverage**: > 80%
- **Bundle Size**: < 500KB (gzipped)
- **First Load**: < 3 seconds
- **Time to Interactive**: < 5 seconds

### Optimization Strategies

#### 1. Code Splitting

```typescript
// Dynamic imports
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Route-based splitting
const routes = [{ path: '/dashboard', component: lazy(() => import('./Dashboard')) }];
```

#### 2. Memoization

```typescript
// React memoization
const MemoizedComponent = memo(Component);

// useMemo for expensive calculations
const result = useMemo(() => expensiveCalculation(data), [data]);

// useCallback for stable references
const handler = useCallback(() => doSomething(), []);
```

#### 3. Lazy Loading

```typescript
// Lazy load images
<img loading="lazy" src={imageUrl} alt={alt} />

// Intersection Observer for components
const [isVisible, setIsVisible] = useState(false)
useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) setIsVisible(true)
  })
  observer.observe(ref.current)
}, [])
```

#### 4. Caching

```typescript
// Service worker caching
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// In-memory caching
const cache = new Map();
function getCached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}
```

#### 5. Database Optimization

```typescript
// Index critical fields
db.collection.createIndex({ email: 1 });

// Use projection to limit fields
db.collection.find({}, { projection: { name: 1, email: 1 } });

// Batch operations
db.collection.bulkWrite([{ insertOne: { document: doc1 } }, { insertOne: { document: doc2 } }]);
```

### Performance Monitoring

```bash
# Lighthouse audit
npx lighthouse https://your-app.com --view

# Bundle analysis
npx webpack-bundle-analyzer

# Performance profiling
npm run profile

# Load testing
npx artillery quick --count 100 --num 10 https://your-app.com
```

---

## ✅ QUALITY ASSURANCE

### Quality Gates

Every commit MUST pass:

1. **Linting**: No linting errors
2. **Type Checking**: No TypeScript errors
3. **Unit Tests**: All tests pass
4. **Integration Tests**: All tests pass
5. **Code Coverage**: Meets minimum threshold
6. **Build**: Successful production build

### Pre-Commit Checklist

```bash
# Run all quality checks
npm run lint && \
npm run typecheck && \
npm test && \
npm run build
```

### Code Review Standards

#### Reviewer Checklist

- [ ] Code follows style guide
- [ ] Tests are comprehensive
- [ ] Error handling is proper
- [ ] Documentation is updated
- [ ] Performance is acceptable
- [ ] Security best practices followed
- [ ] No hardcoded secrets
- [ ] Breaking changes are documented

#### Security Checklist

- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Authentication is secure
- [ ] Authorization is proper
- [ ] Sensitive data is encrypted
- [ ] Dependencies are up to date
- [ ] OWASP Top 10 addressed

### Testing Standards

#### Test Coverage Requirements

- **Overall**: > 80%
- **Critical Paths**: > 95%
- **Business Logic**: > 90%
- **Utils**: > 85%

#### Test Types

1. **Unit Tests**
   - Test individual functions/methods
   - Mock external dependencies
   - Fast execution (< 10ms each)

2. **Integration Tests**
   - Test component interactions
   - Use real dependencies when possible
   - Moderate execution (< 100ms each)

3. **E2E Tests**
   - Test complete user flows
   - Use production-like environment
   - Slower execution (< 10s each)

#### Test Structure

```typescript
describe('Feature', () => {
  describe('Component', () => {
    beforeEach(() => {
      // Setup
    });

    afterEach(() => {
      // Cleanup
    });

    it('should handle normal case', () => {
      // Arrange
      const input = createInput();

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe(expectedOutput);
    });

    it('should handle edge case', () => {
      // Test edge case
    });

    it('should handle error case', () => {
      // Test error handling
    });
  });
});
```

### Documentation Standards

#### Required Documentation

1. **README.md** - Project overview
2. **API.md** - API documentation
3. **ARCHITECTURE.md** - System architecture
4. **CONTRIBUTING.md** - Contribution guidelines
5. **CHANGELOG.md** - Version history

#### Code Comments

````typescript
/**
 * Function description
 *
 * @param param1 - Parameter description
 * @param param2 - Parameter description
 * @returns Return value description
 * @throws ErrorType - When error occurs
 * @example
 * ```typescript
 * const result = myFunction('input', 123)
 * ```
 */
function myFunction(param1: string, param2: number): Result {
  // Implementation
}
````

---

## 🎯 SPARC COMMANDS REFERENCE

### Core Commands

```bash
# List available modes
npx claude-flow sparc modes

# Execute specific mode
npx claude-flow sparc run <mode> "<task>"

# Run complete TDD workflow
npx claude-flow sparc tdd "<feature>"

# Get mode details
npx claude-flow sparc info <mode>
```

### Batch Commands

```bash
# Parallel execution
npx claude-flow sparc batch <modes> "<task>"

# Full pipeline processing
npx claude-flow sparc pipeline "<task>"

# Multi-task processing
npx claude-flow sparc concurrent <mode> "<tasks-file>"
```

### Hooks Commands

```bash
# Pre-task hook
npx claude-flow@alpha hooks pre-task --description "[task]"

# Post-edit hook
npx claude-flow@alpha hooks post-edit --file "[file]"

# Post-task hook
npx claude-flow@alpha hooks post-task --task-id "[task]"

# Session restore
npx claude-flow@alpha hooks session-restore --session-id "[id]"

# Session end
npx claude-flow@alpha hooks session-end --export-metrics true

# Notify
npx claude-flow@alpha hooks notify --message "[message]"
```

---

## 📊 PERFORMANCE BENEFITS

With proper implementation of this configuration:

- **84.8% SWE-Bench solve rate**
- **32.3% token reduction**
- **2.8-4.4x speed improvement**
- **27+ neural models** available
- **Parallel agent execution**
- **Cross-session memory**
- **Self-healing workflows**

---

## 🔗 INTEGRATION TIPS

1. **Start Small**: Begin with basic swarm initialization
2. **Scale Gradually**: Add agents as needed
3. **Use Memory**: Leverage cross-session memory
4. **Monitor Progress**: Regular status checks
5. **Train Patterns**: Learn from successful workflows
6. **Enable Hooks**: Automate repetitive tasks
7. **Worktree Isolation**: Use worktrees for complex features
8. **GitHub First**: Use GitHub tools for repository operations

---

## 📚 ADDITIONAL RESOURCES

- **Documentation**: https://github.com/ruvnet/claude-flow
- **Issues**: https://github.com/ruvnet/claude-flow/issues
- **Wundr MCP Guide**: docs/CLAUDE_CODE_MCP_INTEGRATION.md
- **SPARC Methodology**: docs/SPARC_METHODOLOGY.md
- **Agent Patterns**: docs/AGENT_PATTERNS.md

---

## 🎓 IMPORTANT INSTRUCTION REMINDERS

**CRITICAL RULES:**

1. **Do What's Asked**: Nothing more, nothing less
2. **Minimize File Creation**: Only create absolutely necessary files
3. **Prefer Editing**: Always prefer editing existing files
4. **No Proactive Docs**: Never create documentation files unless explicitly requested
5. **No Root Files**: Never save working files, texts, or tests to root folder
6. **Always Verify**: Test and verify everything before claiming completion
7. **Use Worktrees**: For complex features, use git worktrees
8. **Batch Operations**: Always batch related operations in one message
9. **Show Proof**: Always show real terminal output as proof

---

**Remember**: Claude Flow coordinates, Claude Code creates, Wundr ensures quality, Git worktrees
enable parallel development!

---

**Template Version**: 3.0.0 **Date**: 2025-01-21 **Status**: Production Ready **License**: MIT
