# Recurring Tasks Schema Mismatch Fix

## Issue

The recurring task creation endpoint had a schema mismatch between the validation layer and service
layer:

**Validation Schema Expected:**

```typescript
{
  taskId: string;
  recurrencePattern: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    startDate: string;
    endDate?: string;
    occurrences?: number;
  };
  taskDefinition: {
    name: string;
    priority: number;
    estimatedDuration?: number;
    constraints?: Record<string, unknown>;
  };
}
```

**Service Function Expected:**

```typescript
{
  name: string;
  cronExpression: string;
  taskConfig: Record<string, unknown>;
}
```

## Solution

### 1. Updated Validation Schema

Updated `/lib/validations/orchestrator-scheduling.ts`:

```typescript
export const createRecurringTaskSchema = z.object({
  name: z.string().min(1, 'Task name is required'),
  cronExpression: z.string().min(1, 'Cron expression is required'),
  taskConfig: z.record(z.unknown()).default({}),
});
```

**Benefits:**

- Matches service function signature exactly
- Simpler and more flexible (uses standard cron expressions)
- Allows arbitrary task configuration via `taskConfig`

### 2. Updated Service Function Signature

Updated `removeRecurringTask` in `/lib/services/orchestrator-scheduling-service.ts`:

**Before:**

```typescript
export async function removeRecurringTask(taskId: string): Promise<void>;
```

**After:**

```typescript
export async function removeRecurringTask(
  orchestratorId: string,
  taskIndex: number
): Promise<any[]>;
```

**Benefits:**

- Matches the route's usage pattern
- Returns remaining tasks for immediate UI update
- Supports index-based task removal

## API Usage

### Create Recurring Task

```bash
POST /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/recurring-tasks
Content-Type: application/json

{
  "name": "Daily standup summary",
  "cronExpression": "0 9 * * *",
  "taskConfig": {
    "priority": 5,
    "notify": true,
    "channels": ["general"]
  }
}
```

### Delete Recurring Task

```bash
DELETE /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/recurring-tasks?index=0
```

## Files Changed

1. `/lib/validations/orchestrator-scheduling.ts` - Updated `createRecurringTaskSchema`
2. `/lib/services/orchestrator-scheduling-service.ts` - Updated `removeRecurringTask` signature

## Verification

Run TypeScript type checking to verify no type errors:

```bash
npm run typecheck
```

The changes maintain type safety while aligning the validation and service layers.
