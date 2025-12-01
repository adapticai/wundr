# Orchestrator to Orchestrator Migration Summary

This document outlines the renaming of VP-related hooks and types to use Orchestrator naming
conventions.

## New Files Created

### 1. `/hooks/use-orchestrator.ts`

**Replaced:** `/hooks/use-vp.ts`

**New Hook Exports:**

- `useOrchestrator(id: string)` - Fetch single orchestrator by ID
- `useOrchestrators(workspaceId: string, filters?: OrchestratorFilters)` - Fetch list of
  orchestrators with filtering
- `useOrchestratorMutations()` - CRUD operations for orchestrators

**API Endpoints Used:**

- `GET /api/orchestrators/{id}` (was `/api/orchestrators/{id}`)
- `GET /api/workspaces/{workspaceId}/orchestrators` (was
  `/api/workspaces/{workspaceId}/orchestrators`)
- `POST /api/orchestrators` (was `/api/orchestrators`)
- `PATCH /api/orchestrators/{id}` (was `/api/orchestrators/{id}`)
- `DELETE /api/orchestrators/{id}` (was `/api/orchestrators/{id}`)
- `POST /api/orchestrators/{id}/api-key` (was `/api/orchestrators/{id}/api-key`)

### 2. `/types/orchestrator.ts`

**Replaced:** `/types/vp.ts`

**New Type Exports:**

- `Orchestrator` (was `VP`)
- `OrchestratorStatus` (was `VPStatus`)
- `OrchestratorCharter` (was `VPCharter`)
- `OrchestratorPersonality` (was `VPPersonality`)
- `OrchestratorModelConfig` (was `VPModelConfig`)
- `CreateOrchestratorInput` (was `CreateVPInput`)
- `UpdateOrchestratorInput` (was `UpdateVPInput`)
- `OrchestratorFilters` (was `VPFilters`)
- `OrchestratorDiscipline` (was `VPDiscipline`)
- `ORCHESTRATOR_DISCIPLINES` (was `VP_DISCIPLINES`)
- `ORCHESTRATOR_STATUS_CONFIG` (was `VP_STATUS_CONFIG`)

### 3. `/types/orchestrator-analytics.ts`

**Replaced:** `/types/orchestrator-analytics.ts`

**New Type Exports:**

- `OrchestratorMetrics` (was `VPMetrics`)
- `OrchestratorAnalytics` (was `VPAnalytics`)
- `OrchestratorMetricsSummary` (was `VPMetricsSummary`)
- `OrchestratorAnalyticsResponse` (was `VPAnalyticsResponse`)
- `OrchestratorAnalyticsQuery` (was `VPAnalyticsQuery`)

**Field Changes:**

- `orchestratorId` (was `vpId`)

## Updated Files

### `/types/api.ts`

**Changes:**

1. Added deprecation notice to `VPApiResponse`
2. Added new `OrchestratorApiResponse` interface (identical structure to VPApiResponse)
3. Updated `PrismaWhereClause`:
   - Added `orchestratorId?: string` field
   - Deprecated `vpId` field with comment
4. Updated `MemoryAccessResponse` documentation to reference "Orchestrator" instead of "VP"

## Type Mapping Reference

| Old Type (VP)   | New Type (Orchestrator)   |
| --------------- | ------------------------- |
| `VP`            | `Orchestrator`            |
| `VPStatus`      | `OrchestratorStatus`      |
| `VPCharter`     | `OrchestratorCharter`     |
| `VPPersonality` | `OrchestratorPersonality` |
| `VPModelConfig` | `OrchestratorModelConfig` |
| `CreateVPInput` | `CreateOrchestratorInput` |
| `UpdateVPInput` | `UpdateOrchestratorInput` |
| `VPFilters`     | `OrchestratorFilters`     |
| `VPDiscipline`  | `OrchestratorDiscipline`  |
| `VPMetrics`     | `OrchestratorMetrics`     |
| `VPAnalytics`   | `OrchestratorAnalytics`   |
| `VPApiResponse` | `OrchestratorApiResponse` |

## Hook Mapping Reference

| Old Hook (VP)                  | New Hook (Orchestrator)                  |
| ------------------------------ | ---------------------------------------- |
| `useVP(id)`                    | `useOrchestrator(id)`                    |
| `useVPs(workspaceId, filters)` | `useOrchestrators(workspaceId, filters)` |
| `useVPMutations()`             | `useOrchestratorMutations()`             |

## Return Type Mapping

| Old Return Type        | New Return Type                  |
| ---------------------- | -------------------------------- |
| `UseVPReturn`          | `UseOrchestratorReturn`          |
| `UseVPsReturn`         | `UseOrchestratorsReturn`         |
| `UseVPMutationsReturn` | `UseOrchestratorMutationsReturn` |

## Migration Checklist

### Completed

- [x] Created new hook file: `hooks/use-orchestrator.ts`
- [x] Created new type file: `types/orchestrator.ts`
- [x] Created new analytics type file: `types/orchestrator-analytics.ts`
- [x] Updated `types/api.ts` with OrchestratorApiResponse
- [x] Updated API endpoints in hooks to use `/orchestrators` instead of `/orchestrators`
- [x] Renamed all hook exports (useVP → useOrchestrator, useVPs → useOrchestrators)
- [x] Renamed all type interfaces and exports

### Pending (Component Updates)

- [ ] Update components importing `use-vp` to import `use-orchestrator`
- [ ] Update components using Orchestrator types to use Orchestrator types
- [ ] Update API routes from `/api/orchestrators` to `/api/orchestrators`
- [ ] Update database queries to use orchestrator terminology
- [ ] Update workflow types to use Orchestrator instead of VP
- [ ] Update integration types to use Orchestrator instead of VP
- [ ] Remove deprecated `use-vp.ts` hook file
- [ ] Remove deprecated `vp.ts` type file
- [ ] Remove deprecated `orchestrator-analytics.ts` type file

## Example Usage Changes

### Before (VP):

```typescript
import { useVP, useVPs, useVPMutations } from '@/hooks/use-orchestrator';
import type { VP, VPStatus, CreateVPInput } from '@/types/orchestrator';

function MyComponent() {
  const { vp, isLoading } = useVP(vpId);
  const { orchestrators } = useVPs(workspaceId);
  const { createVP } = useVPMutations();
}
```

### After (Orchestrator):

```typescript
import {
  useOrchestrator,
  useOrchestrators,
  useOrchestratorMutations,
} from '@/hooks/use-orchestrator';
import type {
  Orchestrator,
  OrchestratorStatus,
  CreateOrchestratorInput,
} from '@/types/orchestrator';

function MyComponent() {
  const { orchestrator, isLoading } = useOrchestrator(orchestratorId);
  const { orchestrators } = useOrchestrators(workspaceId);
  const { createOrchestrator } = useOrchestratorMutations();
}
```

## Notes

1. All API endpoint paths have been updated to use `/orchestrators` instead of `/orchestrators`
2. The old Orchestrator types are marked as deprecated but not removed for backward compatibility
3. The database schema field mappings remain the same (role → title, etc.)
4. All transformation logic from API responses to frontend types is preserved
