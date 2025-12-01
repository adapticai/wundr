# API Key Schema Fix Summary

## Issue

The `generateApiKeySchema` in `/packages/@wundr/neolith/apps/web/lib/validations/orchestrator.ts`
had mismatched property names compared to its usage in the API route handler.

## Changes Made

### File: `/packages/@wundr/neolith/apps/web/lib/validations/orchestrator.ts`

**Before:**

```typescript
export const generateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  orchestratorId: z.string().uuid(),
  expiresIn: z.number().int().positive().optional(), // in seconds
  permissions: z.array(z.enum(['read', 'write', 'execute', 'admin'])).min(1),
  metadata: z.record(z.unknown()).optional(),
});
```

**After:**

```typescript
export const generateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  orchestratorId: z.string().uuid().optional(),
  expiresInDays: z.number().int().positive().optional(),
  scopes: z
    .array(z.enum(['read', 'write', 'execute', 'admin']))
    .min(1)
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});
```

## Property Changes

1. **orchestratorId**: Made optional (was required)
   - Reason: The orchestrator ID comes from the route parameter, not the request body

2. **expiresIn → expiresInDays**: Renamed property
   - Route handler uses `input.expiresInDays` (lines 199-200)
   - Calculates expiration in days, not seconds

3. **permissions → scopes**: Renamed property
   - Route handler uses `input.scopes` (lines 212, 232)
   - Made optional to allow default behavior

## Route Usage (Verified)

Location:
`/packages/@wundr/neolith/apps/web/app/api/orchestrators/[orchestratorId]/api-key/route.ts`

```typescript
// Line 199-200
const expiresAt = input.expiresInDays
  ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
  : null;

// Line 212, 232
scopes: input.scopes,
```

## Status

✅ Schema properties now match the route handler usage ✅ All properties (orchestratorId, scopes)
are present and correctly typed
