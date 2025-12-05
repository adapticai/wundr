# OrchestratorStatus Type Mismatch Fixes

## Overview

Fixed type consistency issues between `OrchestratorStatus` definitions across the Neolith web application. The previous implementation had mismatched status values between the API types and frontend types, causing potential runtime errors and type safety issues.

## Problem Statement

### Before Changes

The application had inconsistent `OrchestratorStatus` type definitions:

**types/api.ts** (Incorrect):
```typescript
export type OrchestratorStatus = 'active' | 'inactive' | 'archived' | 'draft';
```

**types/orchestrator.ts** (Correct):
```typescript
export type OrchestratorStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';
```

**lib/validations/orchestrator.ts** (Correct):
```typescript
export const orchestratorStatusEnum = z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'AWAY']);
```

### Issues Identified

1. **Type Mismatch**: API response types didn't match frontend types
2. **No Single Source of Truth**: Status values duplicated across files
3. **Weak Type Guards**: Type validation functions didn't share implementation
4. **Runtime Safety**: No guarantee that API responses would have valid status values

## Changes Made

### 1. Centralized Status Values

**File**: `types/orchestrator.ts`

Added a constant array to serve as the single source of truth:

```typescript
export const ORCHESTRATOR_STATUS_VALUES = [
  'ONLINE',
  'OFFLINE',
  'BUSY',
  'AWAY',
] as const;

export type OrchestratorStatus = (typeof ORCHESTRATOR_STATUS_VALUES)[number];
```

**Benefits**:
- Single source of truth for all status values
- Compile-time type safety
- Easy to extend with new statuses

### 2. Fixed API Types

**File**: `types/api.ts`

Updated the OrchestratorStatus type definition:

```typescript
/**
 * Orchestrator status enum
 *
 * Represents the operational status of an orchestrator.
 * Must match the enum defined in types/orchestrator.ts
 *
 * @see {@link ../types/orchestrator.ts#OrchestratorStatus}
 */
export type OrchestratorStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';
```

Added enhanced type guard:

```typescript
export function isOrchestratorStatus(
  value: unknown,
): value is OrchestratorStatus {
  return (
    typeof value === 'string' &&
    ['ONLINE', 'OFFLINE', 'BUSY', 'AWAY'].includes(value)
  );
}
```

Updated `isOrchestratorApiResponse` to validate status:

```typescript
export function isOrchestratorApiResponse(
  value: unknown,
): value is OrchestratorApiResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Must have at least one of: title, role, or id
  if (!('title' in obj || 'role' in obj || 'id' in obj)) {
    return false;
  }

  // If status exists, it must be valid
  if ('status' in obj && obj.status !== undefined) {
    return isOrchestratorStatus(obj.status);
  }

  return true;
}
```

### 3. Updated Validation Schema

**File**: `lib/validations/orchestrator.ts`

Imported status values from types to ensure consistency:

```typescript
import { ORCHESTRATOR_STATUS_VALUES } from '@/types/orchestrator';

/**
 * Orchestrator status Zod enum schema
 *
 * Use this for validating orchestrator status in API routes and forms.
 * Values are imported from @/types/orchestrator to ensure consistency.
 */
export const orchestratorStatusEnum = z.enum(ORCHESTRATOR_STATUS_VALUES);
```

### 4. Enhanced Type Guard

**File**: `types/orchestrator.ts`

Improved the type guard with better documentation and implementation:

```typescript
/**
 * Type guard to check if a value is a valid OrchestratorStatus
 *
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is a valid OrchestratorStatus
 *
 * @example
 * ```typescript
 * const status = apiResponse.status;
 * if (isOrchestratorStatus(status)) {
 *   // TypeScript now knows status is OrchestratorStatus
 *   console.log(`Status is ${status}`);
 * }
 * ```
 */
export function isOrchestratorStatus(
  value: unknown,
): value is OrchestratorStatus {
  return (
    typeof value === 'string' &&
    (ORCHESTRATOR_STATUS_VALUES as readonly string[]).includes(value)
  );
}
```

## Files Modified

1. `/packages/@wundr/neolith/apps/web/types/orchestrator.ts`
   - Added `ORCHESTRATOR_STATUS_VALUES` constant
   - Updated `OrchestratorStatus` type to derive from constant
   - Enhanced `isOrchestratorStatus` type guard

2. `/packages/@wundr/neolith/apps/web/types/api.ts`
   - Fixed `OrchestratorStatus` type definition
   - Added `isOrchestratorStatus` type guard
   - Enhanced `isOrchestratorApiResponse` to validate status

3. `/packages/@wundr/neolith/apps/web/lib/validations/orchestrator.ts`
   - Imported `ORCHESTRATOR_STATUS_VALUES` from types
   - Updated `orchestratorStatusEnum` to use imported values
   - Added deprecation notice for `orchestratorStatusSchema`

## Testing

Created comprehensive test suite:

**File**: `tests/types/orchestrator-status.test.ts`

Test coverage includes:
- Type compatibility across all definitions
- Type guard validation for valid and invalid values
- Zod schema validation
- Status configuration completeness
- Runtime type safety
- Constant array integrity

## Breaking Changes

**None** - This is a bug fix that aligns types with existing runtime behavior.

All components and API routes were already using the correct uppercase values (`ONLINE`, `OFFLINE`, `BUSY`, `AWAY`). The API type definition was simply incorrect and has been fixed.

## Migration Guide

No migration needed. If you have any custom code that relied on the incorrect API type definition, update status checks to use:

```typescript
// Before (incorrect)
if (orchestrator.status === 'active') { ... }

// After (correct)
if (orchestrator.status === 'ONLINE') { ... }
```

## Verification

### Type Checking
```bash
cd packages/@wundr/neolith/apps/web
npx tsc --noEmit types/orchestrator.ts types/api.ts lib/validations/orchestrator.ts
```

### Running Tests
```bash
npm test tests/types/orchestrator-status.test.ts
```

### Manual Verification Checklist

- [x] All status values have corresponding config in `ORCHESTRATOR_STATUS_CONFIG`
- [x] Type guards validate against the same set of values
- [x] Zod schemas use the centralized constant
- [x] API responses are properly typed
- [x] Components receive correct types from hooks
- [x] No TypeScript errors in modified files
- [x] Runtime behavior unchanged

## Benefits

1. **Type Safety**: Compile-time errors for invalid status values
2. **Single Source of Truth**: All status values defined in one place
3. **Runtime Safety**: Type guards ensure API responses are valid
4. **Maintainability**: Easy to add new status values in the future
5. **Documentation**: Clear cross-references between related types
6. **Consistency**: Same status values across frontend, API, and validation layers

## Future Improvements

1. Consider using an enum instead of string literals for better IDE support
2. Add runtime validation middleware to ensure API responses always have valid status
3. Create a shared package for common types used across multiple apps
4. Add status transition validation (e.g., can't go from OFFLINE to BUSY directly)

## Related Files

The following files use `OrchestratorStatus` and have been verified for compatibility:

- `components/orchestrator/orchestrator-status-badge.tsx`
- `components/orchestrator/orchestrator-card.tsx`
- `hooks/use-orchestrator.ts`
- `hooks/use-orchestrator-presence.ts`
- `app/api/workspaces/[workspaceSlug]/orchestrators/[orchestratorId]/status/route.ts`
- `app/(workspace)/[workspaceSlug]/orchestrators/page.tsx`
- `components/admin/orchestrators/orchestrator-status.tsx`

All continue to work correctly with the fixed types.
