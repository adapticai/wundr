# Git-Worktree Architecture Visual Diagrams

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLAUDE CODE COORDINATOR                       │
│                  (Main Claude Code Instance)                     │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ Spawns agents with isolated worktrees
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     WORKTREE MANAGER                             │
│                (.worktree-scripts/*.sh)                          │
├─────────────────────────────────────────────────────────────────┤
│  • create-agent-worktree.sh   - Create isolation                │
│  • merge-agent-work.sh        - Integrate results               │
│  • cleanup-worktree.sh        - Remove worktree                 │
│  • worktree-status.sh         - Monitor status                  │
│  • cleanup-all-merged.sh      - Bulk cleanup                    │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ Creates isolated environments
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GIT REPOSITORY STRUCTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  project-root/                                                   │
│  ├── .git/                    ◄─── Shared (efficient)           │
│  │   ├── objects/             ◄─── All worktrees share          │
│  │   ├── refs/                ◄─── Branch references            │
│  │   └── config               ◄─── Repository config            │
│  │                                                               │
│  ├── src/                     ◄─── Main worktree                │
│  ├── tests/                                                      │
│  ├── package.json                                                │
│  │                                                               │
│  └── .worktrees/              ◄─── Agent worktrees               │
│      ├── .worktree-registry.jsonl  ◄─── Event log               │
│      │                                                           │
│      ├── coder-auth-001/      ◄─── Agent 1 isolation            │
│      │   ├── .agent-metadata.json                               │
│      │   ├── src/             ◄─── Independent copy             │
│      │   └── ...              ◄─── Full workspace               │
│      │                                                           │
│      ├── tester-auth-002/     ◄─── Agent 2 isolation            │
│      │   └── ...                                                │
│      │                                                           │
│      └── reviewer-auth-003/   ◄─── Agent 3 isolation            │
│          └── ...                                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Lifecycle State Machine

```
┌──────────┐
│  START   │
└────┬─────┘
     │
     │ 1. INITIALIZATION
     ▼
┌──────────────────────┐
│ Infrastructure Setup │
│ • Create .worktrees/ │
│ • Init registry      │
└──────┬───────────────┘
       │
       │ 2. CREATION
       ▼
┌──────────────────────────────┐
│  Create Agent Worktree       │
│  • New branch: agents/*      │
│  • Worktree dir created      │
│  • Metadata file added       │
│  • Registry updated          │
└──────┬───────────────────────┘
       │
       │ 3. EXECUTION
       ▼
┌──────────────────────────────┐
│  Agent Works in Isolation    │
│  • File modifications        │
│  • Git commits               │
│  • No conflicts possible     │
└──────┬───────────────────────┘
       │
       │ 4. MERGE
       ▼
┌──────────────────────────────┐
│  Integrate to Target Branch  │
│  • Strategy: no-ff/squash    │
│  • Conflict resolution       │
│  • Registry: status=merged   │
└──────┬───────────────────────┘
       │
       │ 5. CLEANUP
       ▼
┌──────────────────────────────┐
│  Remove Worktree & Branch    │
│  • Directory removed         │
│  • Branch deleted            │
│  • Registry: status=cleaned  │
│  • Prune metadata            │
└──────┬───────────────────────┘
       │
       ▼
   ┌───────┐
   │  END  │
   └───────┘
```

## Parallel Execution Flow

```
                    COORDINATOR
                         │
           ┌─────────────┼─────────────┐
           │             │             │
           ▼             ▼             ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │  AGENT 1   │ │  AGENT 2   │ │  AGENT 3   │
    │   (coder)  │ │  (tester)  │ │ (reviewer) │
    └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
          │              │              │
          │ Create       │ Create       │ Create
          │ Worktree     │ Worktree     │ Worktree
          ▼              ▼              ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │ worktree/  │ │ worktree/  │ │ worktree/  │
    │ coder-001  │ │ tester-002 │ │reviewer-003│
    └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
          │              │              │
          │ Work in      │ Work in      │ Work in
          │ Isolation    │ Isolation    │ Isolation
          │ (Parallel)   │ (Parallel)   │ (Parallel)
          │              │              │
          ▼              ▼              ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │ Commits    │ │ Commits    │ │ Commits    │
    │ to branch  │ │ to branch  │ │ to branch  │
    └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
          │              │              │
          └──────────────┴──────────────┘
                         │
                         │ Sequential Merge
                         │ (Prevents conflicts)
                         ▼
                  ┌────────────┐
                  │   MASTER   │
                  │   BRANCH   │
                  └────────────┘
```

## SPARC Workflow with Worktrees

```
  BASE: master
      │
      │ Phase 1: SPECIFICATION
      ▼
  ┌─────────────────────────┐
  │ worktree/               │
  │ specification-feat-001  │
  └───────────┬─────────────┘
              │ commits
              ▼
        agents/specification/feat-001
              │
              │ merge
              ▼
         master (updated)
              │
              │ Phase 2: ARCHITECTURE
              ▼
  ┌─────────────────────────┐
  │ worktree/               │
  │ architect-feat-001      │
  └───────────┬─────────────┘
              │ commits
              ▼
        agents/architect/feat-001
              │
              │ merge
              ▼
         master (updated)
              │
              │ Phase 3: TDD
              ▼
  ┌─────────────────────────┐
  │ worktree/               │
  │ tdd-feat-001            │
  └───────────┬─────────────┘
              │ commits
              ▼
        agents/tdd/feat-001
              │
              │ merge
              ▼
         master (updated)
              │
              │ Phase 4: INTEGRATION
              ▼
  ┌─────────────────────────┐
  │ worktree/               │
  │ integration-feat-001    │
  └───────────┬─────────────┘
              │ commits
              ▼
        agents/integration/feat-001
              │
              │ merge
              ▼
         master (COMPLETE)
```

## Merge Strategy Decision Tree

```
                  Need to merge?
                       │
              ┌────────┴────────┐
              │                 │
           YES                 NO
              │                 │
              ▼                 ▼
      Preserve history?      Continue work
              │
      ┌───────┴───────┐
      │               │
     YES              NO
      │               │
      ▼               ▼
  Want full       Single commit
  commit log?     preferred?
      │               │
  ┌───┴───┐          │
  │       │          │
 YES     NO          │
  │       │          │
  ▼       ▼          ▼
NO-FF  REBASE     SQUASH
merge   then      merge
       FF merge

NO-FF Strategy:
├─ Preserves branch history
├─ Creates merge commit
└─ Best for: Feature branches

REBASE Strategy:
├─ Linear history
├─ Fast-forward merge
└─ Best for: Clean history

SQUASH Strategy:
├─ Single commit
├─ Condensed history
└─ Best for: Small changes
```

## Error Handling Flow

```
              Operation Start
                     │
                     ▼
              ┌─────────────┐
              │ Validation  │
              │   Checks    │
              └──────┬──────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
         ▼           ▼           ▼
    ┌────────┐  ┌────────┐  ┌────────┐
    │  Path  │  │  Disk  │  │ Branch │
    │  Valid │  │ Space  │  │ Exists │
    └───┬────┘  └───┬────┘  └───┬────┘
        │           │           │
        │ PASS      │ PASS      │ PASS
        └───────────┴───────────┘
                    │
                    ▼
             Execute Operation
                    │
            ┌───────┴───────┐
            │               │
         SUCCESS          FAIL
            │               │
            ▼               ▼
      ┌──────────┐   ┌──────────────┐
      │  Update  │   │ Error        │
      │ Registry │   │ Recovery     │
      └──────────┘   └──────┬───────┘
            │               │
            │          ┌────┴────┐
            │          │         │
            │    Recoverable  Fatal
            │          │         │
            │          ▼         ▼
            │    ┌─────────┐ ┌──────┐
            │    │ Retry   │ │ Abort│
            │    │ Logic   │ │ & Log│
            │    └────┬────┘ └──────┘
            │         │
            └─────────┴─────────────►  Complete
```

## Registry Event Log Structure

```
Time ─────────────────────────────────────────────►

Event 1: CREATE
┌─────────────────────────────────────────────────┐
│ {                                               │
│   "name": "coder-auth-001",                     │
│   "status": "active",                           │
│   "created": "2025-11-21T10:00:00Z"             │
│ }                                               │
└─────────────────────────────────────────────────┘

Event 2: MERGE
┌─────────────────────────────────────────────────┐
│ {                                               │
│   "name": "coder-auth-001",                     │
│   "status": "merged",                           │
│   "merged": "2025-11-21T11:00:00Z"              │
│ }                                               │
└─────────────────────────────────────────────────┘

Event 3: CLEANUP
┌─────────────────────────────────────────────────┐
│ {                                               │
│   "name": "coder-auth-001",                     │
│   "status": "cleaned",                          │
│   "cleaned": "2025-11-21T11:30:00Z"             │
│ }                                               │
└─────────────────────────────────────────────────┘

Append-only log enables:
• Audit trail
• Status tracking
• Performance metrics
• Debugging history
```

## Component Interaction Diagram

```
┌──────────────┐
│ Claude Code  │
│ Coordinator  │
└──────┬───────┘
       │
       │ 1. spawn_agent()
       ▼
┌──────────────────────┐
│ create-agent-        │
│ worktree.sh          │
└──────┬───────────────┘
       │
       │ 2. git worktree add
       ▼
┌──────────────────────┐      ┌──────────────┐
│   Git Worktree       │◄─────┤ .git/        │
│   System             │      │ (shared)     │
└──────┬───────────────┘      └──────────────┘
       │
       │ 3. creates
       ▼
┌──────────────────────┐
│ .worktrees/          │
│   agent-task-001/    │
└──────┬───────────────┘
       │
       │ 4. agent_work()
       ▼
┌──────────────────────┐
│ Agent executes in    │
│ isolated worktree    │
└──────┬───────────────┘
       │
       │ 5. git commit
       ▼
┌──────────────────────┐
│ agents/agent/task    │
│ (branch)             │
└──────┬───────────────┘
       │
       │ 6. merge_agent_work()
       ▼
┌──────────────────────┐
│ merge-agent-work.sh  │
└──────┬───────────────┘
       │
       │ 7. git merge
       ▼
┌──────────────────────┐
│ master               │
│ (target branch)      │
└──────┬───────────────┘
       │
       │ 8. cleanup_worktree()
       ▼
┌──────────────────────┐
│ cleanup-worktree.sh  │
└──────┬───────────────┘
       │
       │ 9. git worktree remove
       ▼
┌──────────────────────┐
│ Worktree removed     │
│ Branch deleted       │
└──────────────────────┘
```

## File System Isolation Visualization

```
BEFORE Worktree Creation:
┌────────────────────────────────┐
│  Main Workspace                │
│  /project/                     │
│  ├── src/file.js               │
│  └── tests/file.test.js        │
└────────────────────────────────┘
           │
           │ All agents compete for same files
           │ = CONFLICTS!
           ▼

AFTER Worktree Creation:
┌────────────────────────────────┐
│  Main Workspace                │
│  /project/                     │
│  ├── src/file.js               │
│  └── tests/file.test.js        │
└────────────────────────────────┘

┌────────────────────────────────┐
│  Agent 1 Workspace             │
│  /project/.worktrees/agent-1/  │
│  ├── src/file.js ◄── ISOLATED  │
│  └── tests/file.test.js        │
└────────────────────────────────┘

┌────────────────────────────────┐
│  Agent 2 Workspace             │
│  /project/.worktrees/agent-2/  │
│  ├── src/file.js ◄── ISOLATED  │
│  └── tests/file.test.js        │
└────────────────────────────────┘

Result: Zero conflicts, parallel work
```

## Performance Comparison

```
WITHOUT Worktrees:                WITH Worktrees:
═════════════════                 ═════════════════

Agent 1 ──►┐                      Agent 1 ──► Worktree 1
           │                                    │
Agent 2 ──►├─► Shared Files       Agent 2 ──► Worktree 2
           │    (Conflicts!)                   │
Agent 3 ──►┘                      Agent 3 ──► Worktree 3
                                               │
Sequential execution              ▼            ▼           ▼
Time: 10 minutes                  Parallel execution
                                  Time: 3-4 minutes

                                  Speedup: 2.8-4.4x
```

---

**Note:** These diagrams provide a visual understanding of the git-worktree integration
architecture. For detailed implementation, see `/docs/architecture/git-worktree-integration.md`.
