# Wave 2: Task Management System Design

**Date**: 2026-02-09
**Status**: Implementation Ready
**Priority**: High
**Based on**: Claude Code's TodoWrite/TodoRead pattern, crew-orchestrator TaskManager, federation TaskDelegator

---

## 1. Overview

The Task Management System provides a centralized, persistent, dependency-aware task tracking
layer for Wundr's orchestrator daemon. It replaces the ad-hoc in-memory task tracking scattered
across the crew-orchestrator TaskManager and federation TaskDelegator with a unified system
backed by SQLite for durability, WebSocket notifications for real-time updates, and a scheduler
for intelligent assignment.

### Design Goals

1. **Claude Code parity** - Supports the full `subject`/`status`/`activeForm` pattern from
   Claude Code's task tools, enabling spinner displays and progress tracking
2. **Dependency graph** - First-class `blocks`/`blockedBy` relationships with circular
   dependency detection and automatic unblocking on completion
3. **Multi-agent coordination** - Owner tracking, capability-based auto-assignment, and load
   balancing across agents in a team
4. **Persistence** - SQLite storage survives daemon restarts; in-memory mode for tests
5. **Real-time** - WebSocket broadcast on every task mutation for UI reactivity
6. **Composable** - Clean separation of types, store, manager, and scheduler layers

### Non-Goals (for now)

- Cross-daemon task federation (handled by existing TaskDelegator)
- Recurring/cron task scheduling (future enhancement)
- Task templates or blueprints

---

## 2. Architecture

```
                     +------------------+
                     |  TaskManager     |  <-- Public API
                     |  (CRUD + events) |
                     +--------+---------+
                              |
              +---------------+---------------+
              |                               |
    +---------v----------+        +-----------v---------+
    |   TaskStore        |        |  TaskScheduler      |
    |   (SQLite/Memory)  |        |  (Assignment logic) |
    +--------------------+        +---------------------+
              |                               |
              v                               v
    +--------------------+        +---------------------+
    |  task-types.ts     |        |  WebSocket Server   |
    |  (Type defs)       |        |  (Notifications)    |
    +--------------------+        +---------------------+
```

### 2.1 File Layout

```
packages/@wundr/orchestrator-daemon/src/tasks/
  index.ts              # Re-exports
  task-types.ts         # All type definitions and Zod schemas
  task-store.ts         # SQLite-backed persistent store
  task-manager.ts       # Business logic, events, coordination
  task-scheduler.ts     # Auto-assignment, load balancing, dependency resolution
```

---

## 3. Data Model

### 3.1 Task Fields

| Field       | Type                          | Description                                   |
|-------------|-------------------------------|-----------------------------------------------|
| id          | string (UUID)                 | Auto-generated unique identifier              |
| subject     | string                        | Brief title (for list views)                  |
| description | string                        | Detailed description of the work              |
| status      | TaskStatus                    | pending, in_progress, completed, deleted       |
| owner       | string or null                | Agent name/ID that owns this task             |
| activeForm  | string or null                | Present-continuous verb for spinner display    |
| priority    | TaskPriority                  | low, medium, high, critical                   |
| blocks      | string[]                      | Task IDs this task blocks (downstream)        |
| blockedBy   | string[]                      | Task IDs blocking this task (upstream)        |
| metadata    | Record<string, unknown>       | Arbitrary key-value store                     |
| createdAt   | Date                          | Creation timestamp                            |
| updatedAt   | Date                          | Last modification timestamp                   |

### 3.2 Status Transitions

```
pending --> in_progress --> completed
    |           |              |
    |           v              |
    |        pending (retry)   |
    |                          |
    +--------> deleted <-------+
```

### 3.3 Dependency Model

Tasks form a directed acyclic graph (DAG) via `blocks` and `blockedBy` arrays.

- `taskA.blocks = ['taskB']` means taskA must complete before taskB can start
- `taskB.blockedBy = ['taskA']` is the inverse relationship
- When taskA completes, the system automatically removes taskA from taskB's `blockedBy`
- A task with non-empty `blockedBy` (all entries are active) cannot transition to `in_progress`

**Circular dependency detection**: Before adding any dependency, a DFS traversal checks
for cycles. If adding A -> B would create a cycle, the operation is rejected.

---

## 4. Component Specifications

### 4.1 TaskTypes (`task-types.ts`)

Zod schemas for validation plus TypeScript interfaces:

```typescript
TaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted'
TaskPriority = 'low' | 'medium' | 'high' | 'critical'

interface ManagedTask {
  id: string;
  subject: string;
  description: string;
  status: TaskStatus;
  owner: string | null;
  activeForm: string | null;
  priority: TaskPriority;
  blocks: string[];
  blockedBy: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateTaskInput {
  subject: string;
  description?: string;
  owner?: string;
  activeForm?: string;
  priority?: TaskPriority;
  blocks?: string[];
  blockedBy?: string[];
  metadata?: Record<string, unknown>;
}

interface UpdateTaskInput {
  subject?: string;
  description?: string;
  status?: TaskStatus;
  owner?: string | null;
  activeForm?: string | null;
  priority?: TaskPriority;
  addBlocks?: string[];
  removeBlocks?: string[];
  addBlockedBy?: string[];
  removeBlockedBy?: string[];
  metadata?: Record<string, unknown>;
}

interface TaskQuery {
  status?: TaskStatus | TaskStatus[];
  owner?: string;
  priority?: TaskPriority | TaskPriority[];
  isBlocked?: boolean;
  hasOwner?: boolean;
  limit?: number;
  offset?: number;
}
```

### 4.2 TaskStore (`task-store.ts`)

Pure data access layer with two implementations:

1. **InMemoryTaskStore** - Map-based, used in tests
2. **SqliteTaskStore** - better-sqlite3 backed, used in production

Both implement `ITaskStore`:

```typescript
interface ITaskStore {
  initialize(): Promise<void>;
  create(task: ManagedTask): Promise<void>;
  get(id: string): Promise<ManagedTask | null>;
  update(id: string, updates: Partial<ManagedTask>): Promise<ManagedTask | null>;
  delete(id: string): Promise<boolean>;
  query(query: TaskQuery): Promise<ManagedTask[]>;
  getAll(): Promise<ManagedTask[]>;
  count(query?: TaskQuery): Promise<number>;
  close(): Promise<void>;
}
```

**SQLite Schema**:

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  owner TEXT,
  active_form TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  blocks TEXT NOT NULL DEFAULT '[]',      -- JSON array of task IDs
  blocked_by TEXT NOT NULL DEFAULT '[]',  -- JSON array of task IDs
  metadata TEXT NOT NULL DEFAULT '{}',    -- JSON object
  created_at TEXT NOT NULL,               -- ISO 8601
  updated_at TEXT NOT NULL                -- ISO 8601
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
```

### 4.3 TaskManager (`task-manager.ts`)

Business logic layer that coordinates the store, enforces invariants, manages dependency
graphs, and emits events.

**Key behaviors**:

- `createTask(input)` - Validates input, generates ID, persists, emits `task:created`
- `getTask(id)` - Retrieves by ID
- `updateTask(id, updates)` - Validates transitions, manages dependency arrays, emits `task:updated`
- `deleteTask(id)` - Soft-delete (sets status to 'deleted'), cleans up dependency refs
- `queryTasks(query)` - Filtered list
- `completeTask(id)` - Sets status=completed, auto-unblocks dependent tasks
- `claimTask(id, owner)` - Sets owner, transitions to in_progress
- `releaseTask(id)` - Clears owner, transitions back to pending
- `addDependency(blockerId, blockedId)` - Adds blocks/blockedBy with cycle detection
- `removeDependency(blockerId, blockedId)` - Removes blocks/blockedBy

**Events emitted** (via EventEmitter):

| Event            | Payload                                    |
|------------------|--------------------------------------------|
| `task:created`   | `{ task: ManagedTask }`                    |
| `task:updated`   | `{ task: ManagedTask, changes: string[] }` |
| `task:deleted`   | `{ taskId: string }`                       |
| `task:completed` | `{ task: ManagedTask, unblocked: string[] }` |
| `task:claimed`   | `{ task: ManagedTask, owner: string }`     |
| `task:released`  | `{ task: ManagedTask }`                    |
| `task:blocked`   | `{ taskId: string, blockedBy: string[] }`  |
| `task:unblocked` | `{ taskId: string }`                       |

### 4.4 TaskScheduler (`task-scheduler.ts`)

Assignment and scheduling logic:

```typescript
interface AgentInfo {
  id: string;
  name: string;
  capabilities: string[];
  currentLoad: number;
  maxLoad: number;
  available: boolean;
}

interface SchedulerConfig {
  maxTasksPerAgent?: number;
  assignmentStrategy?: 'round-robin' | 'least-loaded' | 'capability-match';
  autoAssignInterval?: number;       // ms, 0 to disable
  unblockCheckInterval?: number;     // ms, 0 to disable
}
```

**Key behaviors**:

- `selectBestAgent(task, agents)` - Scores agents by capability match, load, and availability
- `getReadyTasks()` - Returns tasks that are pending and have no active blockers
- `autoAssign(agents)` - Assigns ready tasks to best available agents
- `rebalance(agents)` - Redistributes tasks when agent pool changes
- `checkAndUnblock()` - Scans for completed blockers and unblocks downstream tasks
- `getExecutionOrder()` - Returns topologically sorted task list respecting dependencies

**Auto-assignment scoring** (0-100):

| Factor              | Weight | Description                          |
|---------------------|--------|--------------------------------------|
| Capability match    | 40     | How well agent capabilities match    |
| Load factor         | 30     | Inverse of current load percentage   |
| Availability        | 20     | Whether agent is available           |
| Priority bonus      | 10     | Higher-priority tasks get preference |

---

## 5. WebSocket Integration

Task events are broadcast to connected clients through the existing
`OrchestratorWebSocketServer`. New message types are added to `WSResponse`:

```typescript
| { type: 'task_created'; task: ManagedTask }
| { type: 'task_updated'; task: ManagedTask; changes: string[] }
| { type: 'task_deleted'; taskId: string }
| { type: 'task_list'; tasks: ManagedTask[] }
```

The TaskManager wires its EventEmitter events to the WebSocket server's `broadcast` method,
so all connected clients receive real-time task updates.

---

## 6. Integration with Agent Teams

The TaskManager serves as the **shared task list** for agent teams:

1. **Orchestrator creates tasks** with dependencies reflecting the work breakdown
2. **Agents claim tasks** via `claimTask(taskId, agentId)` setting `owner` and `activeForm`
3. **Agents update progress** via `updateTask(taskId, { activeForm: 'analyzing code...' })`
4. **Agents complete tasks** via `completeTask(taskId)` which auto-unblocks downstream
5. **Scheduler re-assigns** unblocked tasks to available agents

The `activeForm` field is specifically designed for spinner/progress display:
- "Analyzing codebase..."
- "Writing implementation..."
- "Running tests..."

---

## 7. Compatibility with Existing Systems

### 7.1 Federation TaskDelegator

The federation `TaskDelegator` handles *cross-orchestrator* delegation. The new TaskManager
handles *intra-orchestrator* task tracking. They integrate as follows:

- When a task is delegated to another orchestrator, the local TaskManager creates a
  "proxy" task with metadata `{ delegationId: '...' }` to track it
- The TaskDelegator's completion callback updates the proxy task in the local TaskManager
- This keeps the local task graph consistent even when work is remote

### 7.2 Crew-Orchestrator TaskManager

The existing `@wundr/crew-orchestrator` TaskManager is an in-memory task queue with
priority scheduling. The new system supersedes it with:

- Persistent storage (SQLite)
- Richer dependency model (blocks/blockedBy vs flat dependencies array)
- The `activeForm` field for UI display
- WebSocket notifications
- Separate scheduler with pluggable strategies

### 7.3 Existing Task Type

The existing `Task` interface in `types/index.ts` is preserved for backward compatibility.
The new `ManagedTask` type is a superset. A utility function `toTask(managedTask)` converts
between them for code that still expects the old interface.

---

## 8. Error Handling

| Error Case                     | Behavior                                     |
|--------------------------------|----------------------------------------------|
| Task not found                 | Throws `TaskNotFoundError` with task ID      |
| Circular dependency detected   | Throws `CircularDependencyError` with cycle  |
| Invalid status transition      | Throws `InvalidTransitionError`              |
| Blocked task claim attempt     | Throws `TaskBlockedError` with blocker IDs   |
| SQLite write failure           | Wraps in `TaskStoreError`, logs, re-throws   |
| Duplicate task ID              | Throws `DuplicateTaskError`                  |

All errors extend a base `TaskError` class with a `code` discriminator for programmatic
handling.

---

## 9. Testing Strategy

- **Unit tests**: TaskStore (both InMemory and SQLite), TaskManager business logic,
  TaskScheduler scoring algorithms
- **Integration tests**: Full lifecycle (create -> claim -> progress -> complete -> unblock),
  circular dependency detection, concurrent access
- **Performance tests**: 10K tasks in SQLite, bulk dependency resolution

---

## 10. Migration Path

1. Ship new `tasks/` module alongside existing code
2. Wire TaskManager into OrchestratorDaemon as a subsystem
3. Migrate federation proxy tracking to use TaskManager
4. Deprecate crew-orchestrator's in-memory TaskManager
5. Add UI integration via WebSocket task events
