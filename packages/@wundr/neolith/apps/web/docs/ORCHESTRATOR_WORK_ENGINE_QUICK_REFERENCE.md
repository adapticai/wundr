# Orchestrator Work Engine - Quick Reference

## Service Location

```
/apps/web/lib/services/orchestrator-work-engine-service.ts
```

## Core Functions

### 1. selectNextTask

**Purpose:** Select the highest priority task for a Orchestrator

```typescript
function selectNextTask(
  vpId: string,
  criteria?: {
    excludeTaskIds?: string[];
    maxPriority?: TaskPriority;
    requireTags?: string[];
    limit?: number;
  }
): Promise<Task | null>;
```

**Returns:** Next task to execute or null if no eligible tasks

**Algorithm:**

- Filters by Orchestrator availability (ONLINE/BUSY)
- Checks dependency resolution
- Scores by priority + deadline urgency
- Returns highest scoring task

---

### 2. prepareTaskContext

**Purpose:** Gather comprehensive context for task execution

```typescript
function prepareTaskContext(vpId: string, taskId: string): Promise<TaskExecutionContext>;
```

**Returns:** Complete execution context including:

- Task details
- Orchestrator charter and capabilities
- Dependency status
- Related tasks
- Workspace/channel info

---

### 3. executeTask

**Purpose:** Start task execution (main entry point for daemon)

```typescript
function executeTask(vpId: string, taskId: string): Promise<TaskExecutionResult>;
```

**Flow:**

1. Validates task can transition to IN_PROGRESS
2. Prepares execution context
3. Updates task status
4. Returns context for daemon execution

---

### 4. updateTaskProgress

**Purpose:** Update task progress during execution

```typescript
function updateTaskProgress(update: TaskProgressUpdate): Promise<void>;

interface TaskProgressUpdate {
  taskId: string;
  progress: number; // 0-100
  status?: TaskStatus;
  message?: string;
  metadata?: Record<string, any>;
}
```

**Usage:** Call periodically during execution to track progress

---

### 5. completeTask

**Purpose:** Mark task as complete with results

```typescript
function completeTask(
  taskId: string,
  result: {
    status: 'completed' | 'failed' | 'blocked' | 'in_progress';
    output?: any;
    error?: string;
    metrics: {
      startedAt: Date;
      completedAt?: Date;
      duration?: number;
    };
    artifacts?: { type: string; content: any }[];
  }
): Promise<void>;
```

**Side Effects:**

- Updates task status (DONE/BLOCKED)
- Stores execution result
- Unblocks dependent tasks if completed

---

### 6. getVPExecutionStats

**Purpose:** Get execution statistics for a Orchestrator

```typescript
function getVPExecutionStats(
  vpId: string,
  timeRange?: { start: Date; end: Date }
): Promise<{
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  successRate: string;
  averageCompletionTime: number;
}>;
```

---

## Priority Weights

```typescript
CRITICAL: 1000;
HIGH: 100;
MEDIUM: 10;
LOW: 1;
```

## Deadline Boost Multipliers

```typescript
Overdue:        10x
Due today:      5x
Due in 3 days:  2x
Other:          1x
```

## Task Status Transitions

```
TODO → IN_PROGRESS → DONE
  ↓         ↓
BLOCKED  BLOCKED → TODO (deps met)
  ↓
CANCELLED
```

## Example: Complete Workflow

```typescript
import {
  selectNextTask,
  executeTask,
  updateTaskProgress,
  completeTask,
} from '@/lib/services/orchestrator-work-engine-service';

// 1. Select next task
const task = await selectNextTask('vp_123');
if (!task) {
  console.log('No tasks available');
  return;
}

// 2. Start execution
const execution = await executeTask('vp_123', task.id);
if (execution.status !== 'in_progress') {
  console.error('Failed to start:', execution.error);
  return;
}

const context = execution.output as TaskExecutionContext;

// 3. Execute work (daemon logic here)
const startTime = new Date();

// Update progress during work
await updateTaskProgress({
  taskId: task.id,
  progress: 25,
  message: 'Started implementation',
});

// ... do work ...

await updateTaskProgress({
  taskId: task.id,
  progress: 75,
  message: 'Testing complete',
});

// 4. Complete task
await completeTask(task.id, {
  status: 'completed',
  output: { result: 'success' },
  metrics: {
    startedAt: startTime,
    completedAt: new Date(),
    duration: Date.now() - startTime.getTime(),
  },
  artifacts: [{ type: 'code', content: 'path/to/file.ts' }],
});
```

## Error Handling

### Common Errors

| Error                    | Cause                                  | Solution                   |
| ------------------------ | -------------------------------------- | -------------------------- |
| `VP not found`           | Invalid Orchestrator ID                | Verify Orchestrator exists |
| `Task not found`         | Invalid task ID                        | Verify task exists         |
| `not assigned to VP`     | Task belongs to different Orchestrator | Check task ownership       |
| `Dependencies not met`   | Blocked dependencies                   | Wait for dependencies      |
| `Progress must be 0-100` | Invalid progress value                 | Validate range             |

## Integration with Daemon

```typescript
// Daemon polling loop
async function daemonLoop(vpId: string) {
  while (true) {
    try {
      // 1. Get next task
      const task = await selectNextTask(vpId);
      if (!task) {
        await sleep(5000); // Wait 5s
        continue;
      }

      // 2. Execute
      const result = await executeTask(vpId, task.id);
      if (result.status !== 'in_progress') {
        console.error('Failed:', result.error);
        continue;
      }

      // 3. Do work with context
      const context = result.output as TaskExecutionContext;
      await performWork(context);

      // 4. Complete
      await completeTask(task.id, {
        status: 'completed',
        metrics: { startedAt: new Date() },
      });
    } catch (error) {
      console.error('Daemon error:', error);
      await sleep(10000); // Wait 10s on error
    }
  }
}
```

## Testing

### Run Tests

```bash
cd apps/web
npm test lib/services/__tests__/orchestrator-work-engine-service.test.ts
```

### Type Check

```bash
npx tsc --noEmit lib/services/orchestrator-work-engine-service.ts
```

## Database Indexes Used

- `tasks.orchestratorId`
- `tasks.status`
- `tasks.priority`
- `tasks.dueDate`
- `tasks.updatedAt`

## Performance Tips

1. **Limit candidate tasks** - Use `limit` parameter in selectNextTask
2. **Filter by tags** - Use `requireTags` to narrow selection
3. **Batch stats queries** - Use Promise.all for statistics
4. **Index metadata** - Consider indexing frequently queried metadata fields

---

**Quick Import:**

```typescript
import {
  selectNextTask,
  prepareTaskContext,
  executeTask,
  updateTaskProgress,
  completeTask,
  getVPExecutionStats,
  type TaskExecutionContext,
  type TaskExecutionResult,
  type TaskProgressUpdate,
} from '@/lib/services/orchestrator-work-engine-service';
```
