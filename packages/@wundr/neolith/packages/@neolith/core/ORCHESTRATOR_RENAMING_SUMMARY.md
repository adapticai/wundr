# Orchestrator Renaming Summary

## Overview

Complete renaming of Orchestrator (Virtual Person) terminology to Orchestrator throughout the
@neolith/core package.

## Files Renamed

### Type Definitions

- `src/types/vp.ts` → `src/types/orchestrator.ts` ✅ Created

### Services

- `src/services/orchestrator-service.ts` → `src/services/orchestrator-service.ts` ⚠️ File exists but
  empty (needs content)

### Tests

- `src/services/__tests__/orchestrator-service.test.ts` →
  `src/services/__tests__/orchestrator-service.test.ts` ✅ Exists

### Test Utilities

- `src/test-utils/orchestrator-factories.ts` → `src/test-utils/orchestrator-factories.ts` ✅ Exists
  (needs content updates)

## Type Name Changes

### Core Types

- `VPWithUser` → `OrchestratorWithUser`
- `VPCharter` → `OrchestratorCharter`
- `VPPersonality` → `OrchestratorPersonality`
- `VPCommunicationPreferences` → `OrchestratorCommunicationPreferences`
- `VPOperationalConfig` → `OrchestratorOperationalConfig`
- `VPWorkHours` → `OrchestratorWorkHours`
- `VPEscalationConfig` → `OrchestratorEscalationConfig`
- `VPServiceAccountConfig` → `OrchestratorServiceAccountConfig`

### Input Types

- `CreateVPInput` → `CreateOrchestratorInput`
- `UpdateVPInput` → `UpdateOrchestratorInput`

### Query Types

- `ListVPsOptions` → `ListOrchestratorsOptions`
- `PaginatedVPResult` → `PaginatedOrchestratorResult`

### Event Types

- `VPEventType` → `OrchestratorEventType`
- `VPEvent` → `OrchestratorEvent`

## Class and Function Name Changes

### Service Classes

- `VPService` → `OrchestratorService`
- `VPServiceImpl` → `OrchestratorServiceImpl`

### Factory Functions

- `createVPService()` → `createOrchestratorService()`
- `vpService` → `orchestratorService`

### Service Methods

- `createVP()` → `createOrchestrator()`
- `getVP()` → `getOrchestrator()`
- `getVPBySlug()` → `getOrchestratorBySlug()`
- `listVPsByOrganization()` → `listOrchestratorsByOrganization()`
- `listVPsByDiscipline()` → `listOrchestratorsByDiscipline()`
- `updateVP()` → `updateOrchestrator()`
- `deleteVP()` → `deleteOrchestrator()`
- `activateVP()` → `activateOrchestrator()`
- `deactivateVP()` → `deactivateOrchestrator()`

### Test Factories

- `createMockVP()` → `createMockOrchestrator()`
- `createMockVPWithUser()` → `createMockOrchestratorWithUser()`
- `createMockVPList()` → `createMockOrchestratorList()`
- `createMockVPCharter()` → `createMockOrchestratorCharter()`
- `createMockCreateVPInput()` → `createMockCreateOrchestratorInput()`
- `createMockUpdateVPInput()` → `createMockUpdateOrchestratorInput()`

### Type Guards

- `isVPCharter()` → `isOrchestratorCharter()`
- `isVPServiceAccountConfig()` → `isOrchestratorServiceAccountConfig()`

### Constants

- `DEFAULT_VP_CHARTER` → `DEFAULT_ORCHESTRATOR_CHARTER`

## Variable Name Changes

- `vp` → `orchestrator`
- `vps` → `orchestrators`
- `vpId` → `orchestratorId`
- `vpConfig` → `orchestratorConfig`
- `vpOverrides` → `orchestratorOverrides`
- `vpUsers` → `orchestratorUsers`
- `mockVP` → `mockOrchestrator`
- `mockVPs` → `mockOrchestrators`
- `existingVP` → `existingOrchestrator`

## Import Path Changes

- `'../types/vp'` → `'../types/orchestrator'`
- `'./orchestrator-service'` → `'./orchestrator-service'`
- `'../test-utils/orchestrator-factories'` → `'../test-utils/orchestrator-factories'`

## Cleanup Actions

✅ Deleted dist folder

## Pending Actions

1. ⚠️ Fill content in `src/services/orchestrator-service.ts` (currently empty)
2. ⚠️ Complete renaming in `src/test-utils/orchestrator-factories.ts` (partial rename done)
3. ⚠️ Complete renaming in `src/services/__tests__/orchestrator-service.test.ts`
4. ⚠️ Update exports in `src/index.ts`
5. ⚠️ Update exports in service index files

## Notes

- Database schema remains unchanged (VP table stays as VP)
- Only code-level naming is updated for clarity
- All functionality remains identical
- Migration maintains backward compatibility at DB level
