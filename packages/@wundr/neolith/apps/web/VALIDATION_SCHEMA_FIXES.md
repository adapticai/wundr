# Validation Schema Fixes - Capacity and Schedule

## Summary

Fixed scheduling schema type mismatches between validation schemas and service layer implementations.

## Problem

The validation schemas in `/lib/validations/orchestrator-scheduling.ts` were defining incorrect types that didn't match:
1. What the service layer expected
2. What Prisma schema supports

### Before (Incorrect)

**Capacity Schema:**
```typescript
export const updateCapacitySchema = z.object({
  agentId: z.string(),
  capacity: z.number().min(0).max(100),
  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().optional(),
  reason: z.string().optional(),
});
```

**Schedule Schema:**
```typescript
export const updateWorkScheduleSchema = z.object({
  agentId: z.string(),
  schedule: z.object({
    timezone: z.string().default('UTC'),
    workHours: z.array(
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      })
    ),
    breaks: z.array(...).optional(),
    holidays: z.array(z.string().datetime()).optional(),
  }),
  effectiveFrom: z.string().datetime().optional(),
});
```

## Solution

Updated schemas to match service layer expectations:

### After (Correct)

**Capacity Schema:**
```typescript
export const updateCapacitySchema = z.object({
  max: z.number().positive().optional(),
  reserved: z.number().nonnegative().optional(),
});
```

**Schedule Schema:**
```typescript
export const updateWorkScheduleSchema = z.object({
  workingHours: z
    .object({
      start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    })
    .optional(),
  timezone: z.string().optional(),
  workDays: z.array(z.number().min(0).max(6)).optional(),
});
```

### Query Parameter Schemas

Also fixed the GET endpoint query parameter schemas:

**Before:**
```typescript
export const getCapacitySchema = z.object({
  agentId: z.string().optional(),
  timeRange: z.object({...}).optional(),
  includeReserved: z.boolean().default(false),
});

export const getWorkScheduleSchema = z.object({
  agentId: z.string(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  includeBreaks: z.boolean().default(true),
});
```

**After:**
```typescript
export const getCapacitySchema = z.object({
  includeMetrics: z
    .string()
    .optional()
    .transform(val => val === 'true'),
});

export const getWorkScheduleSchema = z.object({
  detailed: z
    .string()
    .optional()
    .transform(val => val === 'true'),
});
```

## Service Layer Signatures

The service layer expects these types:

```typescript
// updateCapacity
capacity: { max?: number; reserved?: number }

// updateWorkSchedule
schedule: {
  workingHours?: { start: string; end: string };
  timezone?: string;
  workDays?: number[];
}
```

## Affected Files

- `/lib/validations/orchestrator-scheduling.ts` - Fixed validation schemas
- `/app/api/workspaces/[workspaceSlug]/orchestrators/[orchestratorId]/capacity/route.ts` - Uses updateCapacitySchema
- `/app/api/workspaces/[workspaceSlug]/orchestrators/[orchestratorId]/schedule/route.ts` - Uses updateWorkScheduleSchema
- `/lib/services/orchestrator-scheduling-service.ts` - Service implementations

## Testing

To test the fix:

1. **Capacity Update:**
```bash
curl -X PATCH \
  http://localhost:3000/api/workspaces/ws_123/orchestrators/orch_456/capacity \
  -H "Content-Type: application/json" \
  -d '{"max": 20, "reserved": 5}'
```

2. **Schedule Update:**
```bash
curl -X PATCH \
  http://localhost:3000/api/workspaces/ws_123/orchestrators/orch_456/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "workingHours": {"start": "09:00", "end": "17:00"},
    "timezone": "America/New_York",
    "workDays": [1, 2, 3, 4, 5]
  }'
```

## Status

✅ **FIXED** - Schemas now correctly match service layer expectations and Prisma types.
