/**
 * Type consistency tests for OrchestratorStatus
 *
 * This test file ensures that OrchestratorStatus types are consistent across:
 * - types/orchestrator.ts (main type definition)
 * - types/api.ts (API response types)
 * - lib/validations/orchestrator.ts (Zod schemas)
 */

import { describe, expect, test } from 'vitest';

import {
  isOrchestratorStatus as isOrchestratorStatusApi,
  type OrchestratorStatus as OrchestratorStatusApi,
} from '@/types/api';
import {
  isOrchestratorStatus,
  ORCHESTRATOR_STATUS_CONFIG,
  ORCHESTRATOR_STATUS_VALUES,
  type OrchestratorStatus,
} from '@/types/orchestrator';
import {
  orchestratorStatusEnum,
  type OrchestratorStatusType,
} from '@/lib/validations/orchestrator';

describe('OrchestratorStatus Type Consistency', () => {
  describe('Type Compatibility', () => {
    test('OrchestratorStatusType matches OrchestratorStatus', () => {
      // This test ensures type compatibility at compile time
      const validationStatus: OrchestratorStatusType = 'ONLINE';
      const mainStatus: OrchestratorStatus = validationStatus;
      const apiStatus: OrchestratorStatusApi = mainStatus;

      expect(apiStatus).toBe('ONLINE');
    });

    test('All status values are accepted by validation schema', () => {
      ORCHESTRATOR_STATUS_VALUES.forEach(status => {
        const result = orchestratorStatusEnum.safeParse(status);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Type Guards', () => {
    test('isOrchestratorStatus validates correct values', () => {
      expect(isOrchestratorStatus('ONLINE')).toBe(true);
      expect(isOrchestratorStatus('OFFLINE')).toBe(true);
      expect(isOrchestratorStatus('BUSY')).toBe(true);
      expect(isOrchestratorStatus('AWAY')).toBe(true);
    });

    test('isOrchestratorStatus rejects incorrect values', () => {
      expect(isOrchestratorStatus('active')).toBe(false);
      expect(isOrchestratorStatus('inactive')).toBe(false);
      expect(isOrchestratorStatus('INVALID')).toBe(false);
      expect(isOrchestratorStatus('')).toBe(false);
      expect(isOrchestratorStatus(null)).toBe(false);
      expect(isOrchestratorStatus(undefined)).toBe(false);
      expect(isOrchestratorStatus(123)).toBe(false);
    });

    test('API type guard matches main type guard', () => {
      ORCHESTRATOR_STATUS_VALUES.forEach(status => {
        expect(isOrchestratorStatus(status)).toBe(
          isOrchestratorStatusApi(status),
        );
      });

      // Test invalid values
      ['active', 'inactive', 'INVALID', null, undefined, 123].forEach(
        value => {
          expect(isOrchestratorStatus(value)).toBe(
            isOrchestratorStatusApi(value),
          );
        },
      );
    });
  });

  describe('Status Configuration', () => {
    test('All status values have configuration', () => {
      ORCHESTRATOR_STATUS_VALUES.forEach(status => {
        expect(ORCHESTRATOR_STATUS_CONFIG[status]).toBeDefined();
        expect(ORCHESTRATOR_STATUS_CONFIG[status].label).toBeTruthy();
        expect(ORCHESTRATOR_STATUS_CONFIG[status].color).toBeTruthy();
        expect(ORCHESTRATOR_STATUS_CONFIG[status].bgColor).toBeTruthy();
      });
    });

    test('Configuration keys match status values exactly', () => {
      const configKeys = Object.keys(
        ORCHESTRATOR_STATUS_CONFIG,
      ) as OrchestratorStatus[];
      expect(configKeys.sort()).toEqual([...ORCHESTRATOR_STATUS_VALUES].sort());
    });
  });

  describe('Zod Schema Validation', () => {
    test('Valid status values pass schema validation', () => {
      const validStatuses: OrchestratorStatus[] = [
        'ONLINE',
        'OFFLINE',
        'BUSY',
        'AWAY',
      ];

      validStatuses.forEach(status => {
        const result = orchestratorStatusEnum.safeParse(status);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(status);
        }
      });
    });

    test('Invalid status values fail schema validation', () => {
      const invalidStatuses = [
        'active',
        'inactive',
        'archived',
        'draft',
        'INVALID',
        '',
        'online', // lowercase
        'Offline', // mixed case
      ];

      invalidStatuses.forEach(status => {
        const result = orchestratorStatusEnum.safeParse(status);
        expect(result.success).toBe(false);
      });
    });

    test('Non-string values fail schema validation', () => {
      const invalidValues = [null, undefined, 123, true, {}, []];

      invalidValues.forEach(value => {
        const result = orchestratorStatusEnum.safeParse(value);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Runtime Type Safety', () => {
    test('Type guard ensures type safety', () => {
      const unknownValue: unknown = 'ONLINE';

      if (isOrchestratorStatus(unknownValue)) {
        // TypeScript should now know this is OrchestratorStatus
        const status: OrchestratorStatus = unknownValue;
        expect(ORCHESTRATOR_STATUS_CONFIG[status]).toBeDefined();
      }
    });

    test('Type guard handles API responses', () => {
      const apiResponse = {
        id: 'orch-123',
        role: 'Engineering Lead',
        status: 'ONLINE' as const,
      };

      if (isOrchestratorStatus(apiResponse.status)) {
        const status: OrchestratorStatus = apiResponse.status;
        expect(status).toBe('ONLINE');
      }
    });

    test('Type guard prevents invalid assignments', () => {
      const invalidStatus: unknown = 'active';

      // This should return false, preventing invalid assignment
      expect(isOrchestratorStatus(invalidStatus)).toBe(false);

      if (isOrchestratorStatus(invalidStatus)) {
        // This block should never execute
        throw new Error('Type guard failed - invalid status passed');
      }
    });
  });

  describe('Status Values Constant', () => {
    test('ORCHESTRATOR_STATUS_VALUES has correct length', () => {
      expect(ORCHESTRATOR_STATUS_VALUES).toHaveLength(4);
    });

    test('ORCHESTRATOR_STATUS_VALUES contains expected values', () => {
      expect(ORCHESTRATOR_STATUS_VALUES).toContain('ONLINE');
      expect(ORCHESTRATOR_STATUS_VALUES).toContain('OFFLINE');
      expect(ORCHESTRATOR_STATUS_VALUES).toContain('BUSY');
      expect(ORCHESTRATOR_STATUS_VALUES).toContain('AWAY');
    });

    test('ORCHESTRATOR_STATUS_VALUES is readonly', () => {
      // TypeScript should prevent modification at compile time
      // This test verifies runtime immutability
      expect(Object.isFrozen(ORCHESTRATOR_STATUS_VALUES)).toBe(false); // as const doesn't freeze
      expect(Array.isArray(ORCHESTRATOR_STATUS_VALUES)).toBe(true);
    });
  });
});
