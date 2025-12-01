# Delegation Response Schema Fix

## Problem

The `delegationResponseSchema` in `orchestrator-coordination.ts` did not match how it was used in
the `delegate-orchestrator` route. Specifically:

1. The service function signature didn't match how it was called in the route
2. The `delegatedAt` field was defined as `z.string().datetime()` but the service returned a `Date`
   object
3. The service function was missing proper return type definitions

## Changes Made

### 1. Updated Service Function (`orchestrator-coordination-service.ts`)

**Before:**

```typescript
export async function delegateTask(
  sourceOrchestrator: string,
  targetOrchestrator: string,
  taskData: {
    taskId: string;
    priority?: string;
    context?: Record<string, unknown>;
  }
): Promise<{ delegationId: string; status: string }> {
  // ...
}
```

**After:**

```typescript
export interface DelegateTaskResult {
  success: boolean;
  error?: string;
  delegatedAt: Date;
  taskId: string;
  fromOrchestratorId: string;
  toOrchestratorId: string;
  message?: string;
}

export async function delegateTask(
  sourceOrchestrator: string,
  targetOrchestrator: string,
  taskId: string,
  options?: {
    note?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dueDate?: Date;
  }
): Promise<DelegateTaskResult> {
  // ...
  return {
    success: true,
    delegatedAt: new Date(),
    taskId,
    fromOrchestratorId: sourceOrchestrator,
    toOrchestratorId: targetOrchestrator,
    message: 'Task delegated successfully',
  };
}
```

### 2. Updated Validation Schema (`orchestrator-coordination.ts`)

**Before:**

```typescript
export const delegationResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  delegatedAt: z.string().datetime(),
  taskId: z.string(),
  fromOrchestratorId: z.string(),
  toOrchestratorId: z.string(),
  message: z.string().optional(),
});
```

**After:**

```typescript
export const delegationResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  delegatedAt: z.union([z.string().datetime(), z.date()]),
  taskId: z.string(),
  fromOrchestratorId: z.string(),
  toOrchestratorId: z.string(),
  message: z.string().optional(),
});
```

## Route Usage Alignment

The route now correctly calls the service function:

```typescript
const result = await delegateTask(orchestratorId, toOrchestratorId, taskId, {
  note,
  priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined,
  dueDate: dueDate ? new Date(dueDate) : undefined,
});
```

And uses the result properties as expected:

```typescript
return NextResponse.json({
  data: {
    success: true,
    taskId: result.taskId,
    fromOrchestratorId: result.fromOrchestratorId,
    toOrchestratorId: result.toOrchestratorId,
    delegatedAt: result.delegatedAt, // Date object
    message: result.message,
    compatibility: {
      sourceDiscipline: sourceOrchestrator.discipline,
      targetDiscipline: targetOrchestrator.discipline,
      sourceRole: sourceOrchestrator.role,
      targetRole: targetOrchestrator.role,
    },
  },
  message: 'Task delegated successfully',
});
```

## Files Modified

1. `/Users/granfar/wundr/packages/@wundr/neolith/apps/web/lib/services/orchestrator-coordination-service.ts`
2. `/Users/granfar/wundr/packages/@wundr/neolith/apps/web/lib/validations/orchestrator-coordination.ts`

## Verification

- TypeScript compilation shows no errors for the delegation-related files
- Service function signature matches route usage
- Return type properly typed with `DelegateTaskResult` interface
- Validation schema accepts both Date objects and datetime strings for flexibility
