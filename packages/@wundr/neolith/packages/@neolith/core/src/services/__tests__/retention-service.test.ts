/**
 * @fileoverview Tests for RetentionService
 *
 * Comprehensive test suite covering:
 * - Retention policy CRUD operations
 * - Retention job execution
 * - Legal hold management
 * - Data export functionality
 * - Statistics retrieval
 *
 * @module @genesis/core/services/__tests__/retention-service.test
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  createMockPrisma,
  createRetentionMockRedis,
  createMockPolicyRecord,
  createMockJobRecord,
  createMockLegalHoldRecord,
  createMockDataExportRecord,
  createMockRetentionRule,
  resetRetentionIdCounters,
  generateWorkspaceId,
  generateRetentionUserId,
  generatePolicyId,
  generateHoldId,
} from '../../test-utils/retention-factories';
import { RetentionService } from '../retention-service';

// Aliases for easier use in tests
const generateUserId = generateRetentionUserId;
const createMockRedis = createRetentionMockRedis;

describe('RetentionService', () => {
  let retentionService: RetentionService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    resetRetentionIdCounters();
    mockPrisma = createMockPrisma();
    mockRedis = createMockRedis();

    retentionService = new RetentionService({
      prisma: mockPrisma as unknown as Parameters<
        typeof RetentionService
      >[0]['prisma'],
      redis: mockRedis,
      batchSize: 10,
    });
  });

  // ===========================================================================
  // Policy Management Tests
  // ===========================================================================

  describe('createPolicy', () => {
    it('should create a retention policy', async () => {
      const workspaceId = generateWorkspaceId();
      const userId = generateUserId();

      mockPrisma.retentionPolicy.create.mockResolvedValue(
        createMockPolicyRecord({
          workspaceId,
          name: 'Test Policy',
          description: 'Test description',
          createdBy: userId,
        })
      );

      const policy = await retentionService.createPolicy(
        workspaceId,
        'Test Policy',
        [
          {
            resourceType: 'message',
            action: 'delete',
            retentionDays: 90,
            priority: 1,
          },
        ],
        userId,
        'Test description'
      );

      expect(policy.name).toBe('Test Policy');
      expect(policy.rules).toHaveLength(1);
      expect(mockPrisma.retentionPolicy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId,
          name: 'Test Policy',
          description: 'Test description',
          isEnabled: true,
        }),
      });
    });

    it('should create policy with multiple rules', async () => {
      const workspaceId = generateWorkspaceId();
      const userId = generateUserId();
      const rules = [
        {
          resourceType: 'message' as const,
          action: 'delete' as const,
          retentionDays: 90,
          priority: 1,
        },
        {
          resourceType: 'file' as const,
          action: 'archive' as const,
          retentionDays: 180,
          priority: 2,
        },
      ];

      mockPrisma.retentionPolicy.create.mockResolvedValue(
        createMockPolicyRecord({
          workspaceId,
          name: 'Multi-rule Policy',
          rules: rules.map((r, i) => ({ ...r, id: `rule-${i}` })),
        })
      );

      const policy = await retentionService.createPolicy(
        workspaceId,
        'Multi-rule Policy',
        rules,
        userId
      );

      expect(policy.rules).toHaveLength(2);
    });
  });

  describe('updatePolicy', () => {
    it('should update policy name', async () => {
      const policyId = generatePolicyId();

      mockPrisma.retentionPolicy.update.mockResolvedValue(
        createMockPolicyRecord({
          id: policyId,
          name: 'Updated Name',
        })
      );

      const policy = await retentionService.updatePolicy(policyId, {
        name: 'Updated Name',
      });

      expect(policy.name).toBe('Updated Name');
      expect(mockPrisma.retentionPolicy.update).toHaveBeenCalledWith({
        where: { id: policyId },
        data: { name: 'Updated Name' },
      });
    });

    it('should update policy enabled status', async () => {
      const policyId = generatePolicyId();

      mockPrisma.retentionPolicy.update.mockResolvedValue(
        createMockPolicyRecord({
          id: policyId,
          isEnabled: false,
        })
      );

      const policy = await retentionService.updatePolicy(policyId, {
        isEnabled: false,
      });

      expect(policy.isEnabled).toBe(false);
    });
  });

  describe('getPolicies', () => {
    it('should return policies for workspace', async () => {
      const workspaceId = generateWorkspaceId();

      mockPrisma.retentionPolicy.findMany.mockResolvedValue([
        createMockPolicyRecord({
          workspaceId,
          name: 'Policy 1',
          isDefault: true,
        }),
        createMockPolicyRecord({
          workspaceId,
          name: 'Policy 2',
          isDefault: false,
        }),
      ]);

      const policies = await retentionService.getPolicies(workspaceId);

      expect(policies).toHaveLength(2);
      expect(policies[0].name).toBe('Policy 1');
      expect(policies[1].name).toBe('Policy 2');
      expect(mockPrisma.retentionPolicy.findMany).toHaveBeenCalledWith({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array for workspace without policies', async () => {
      mockPrisma.retentionPolicy.findMany.mockResolvedValue([]);

      const policies = await retentionService.getPolicies('ws-no-policies');

      expect(policies).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Retention Job Tests
  // ===========================================================================

  describe('runRetentionJob', () => {
    it('should create and run a retention job', async () => {
      const workspaceId = generateWorkspaceId();
      const policyId = generatePolicyId();

      mockPrisma.retentionPolicy.findUnique.mockResolvedValue(
        createMockPolicyRecord({
          id: policyId,
          workspaceId,
          rules: [
            createMockRetentionRule({
              resourceType: 'message',
              action: 'delete',
              retentionDays: 90,
            }),
          ],
        })
      );
      mockPrisma.legalHold.findMany.mockResolvedValue([]);
      mockPrisma.retentionJob.create.mockResolvedValue(
        createMockJobRecord({
          workspaceId,
          policyId,
          status: 'running',
          itemsProcessed: 0,
        })
      );
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.retentionJob.update.mockResolvedValue(
        createMockJobRecord({
          workspaceId,
          policyId,
          status: 'completed',
          itemsProcessed: 0,
        })
      );

      const job = await retentionService.runRetentionJob(policyId);

      expect(job.status).toBe('completed');
      expect(mockPrisma.retentionJob.create).toHaveBeenCalled();
      expect(mockPrisma.retentionJob.update).toHaveBeenCalled();
    });

    it('should throw error if policy not found', async () => {
      mockPrisma.retentionPolicy.findUnique.mockResolvedValue(null);

      await expect(
        retentionService.runRetentionJob('non-existent')
      ).rejects.toThrow('Retention policy not found');
    });

    it('should skip items under legal hold', async () => {
      const workspaceId = generateWorkspaceId();
      const policyId = generatePolicyId();
      const channelId = 'ch-protected';

      mockPrisma.retentionPolicy.findUnique.mockResolvedValue(
        createMockPolicyRecord({
          id: policyId,
          workspaceId,
          rules: [
            createMockRetentionRule({
              resourceType: 'message',
              action: 'delete',
              retentionDays: 90,
            }),
          ],
        })
      );
      mockPrisma.legalHold.findMany.mockResolvedValue([
        createMockLegalHoldRecord({
          workspaceId,
          isActive: true,
          scope: { channelIds: [channelId] },
        }),
      ]);
      mockPrisma.retentionJob.create.mockResolvedValue(
        createMockJobRecord({ workspaceId, policyId, status: 'running' })
      );
      mockPrisma.message.findMany.mockResolvedValue([
        { id: 'msg-1', channelId, createdAt: new Date('2020-01-01') },
      ]);
      mockPrisma.retentionJob.update.mockResolvedValue(
        createMockJobRecord({ status: 'completed', itemsProcessed: 0 })
      );

      const job = await retentionService.runRetentionJob(policyId);

      // Item should be skipped due to legal hold
      expect(job.itemsProcessed).toBe(0);
      expect(mockPrisma.message.update).not.toHaveBeenCalled();
    });

    it('should process items in batches', async () => {
      const workspaceId = generateWorkspaceId();
      const policyId = generatePolicyId();

      mockPrisma.retentionPolicy.findUnique.mockResolvedValue(
        createMockPolicyRecord({
          id: policyId,
          workspaceId,
          rules: [
            createMockRetentionRule({
              resourceType: 'message',
              action: 'delete',
              retentionDays: 90,
            }),
          ],
        })
      );
      mockPrisma.legalHold.findMany.mockResolvedValue([]);
      mockPrisma.retentionJob.create.mockResolvedValue(
        createMockJobRecord({ workspaceId, policyId, status: 'running' })
      );

      // First batch returns items, second batch returns empty
      mockPrisma.message.findMany
        .mockResolvedValueOnce(
          Array.from({ length: 10 }, (_, i) => ({
            id: `msg-${i}`,
            channelId: 'ch-1',
            createdAt: new Date('2020-01-01'),
          }))
        )
        .mockResolvedValueOnce([]);

      mockPrisma.message.update.mockResolvedValue({ id: 'msg-1' });
      mockPrisma.retentionJob.update.mockResolvedValue(
        createMockJobRecord({ status: 'completed', itemsProcessed: 10 })
      );

      const job = await retentionService.runRetentionJob(policyId);

      expect(job.status).toBe('completed');
    });
  });

  // ===========================================================================
  // Statistics Tests
  // ===========================================================================

  describe('getStats', () => {
    it('should return retention statistics', async () => {
      const workspaceId = generateWorkspaceId();

      mockPrisma.message.count.mockResolvedValue(1000);
      mockPrisma.attachment.count.mockResolvedValue(500);
      mockPrisma.channel.count.mockResolvedValue(50);
      mockPrisma.attachment.aggregate.mockResolvedValue({
        _sum: { fileSize: 1000000 },
      });
      mockPrisma.retentionJob.findFirst.mockResolvedValue(null);

      const stats = await retentionService.getStats(workspaceId);

      expect(stats.itemCounts.message).toBe(1000);
      expect(stats.itemCounts.file).toBe(500);
      expect(stats.itemCounts.channel).toBe(50);
      expect(stats.totalStorageBytes).toBe(1000000);
    });

    it('should include last job run date', async () => {
      const workspaceId = generateWorkspaceId();
      const lastRunDate = new Date('2024-01-01');

      mockPrisma.message.count.mockResolvedValue(0);
      mockPrisma.attachment.count.mockResolvedValue(0);
      mockPrisma.channel.count.mockResolvedValue(0);
      mockPrisma.attachment.aggregate.mockResolvedValue({
        _sum: { fileSize: 0 },
      });
      mockPrisma.retentionJob.findFirst.mockResolvedValue({
        completedAt: lastRunDate,
      });

      const stats = await retentionService.getStats(workspaceId);

      expect(stats.lastJobRun).toEqual(lastRunDate);
    });
  });

  // ===========================================================================
  // Legal Hold Tests
  // ===========================================================================

  describe('legal holds', () => {
    describe('createLegalHold', () => {
      it('should create a legal hold', async () => {
        const workspaceId = generateWorkspaceId();
        const userId = generateUserId();

        mockPrisma.legalHold.create.mockResolvedValue(
          createMockLegalHoldRecord({
            workspaceId,
            name: 'Investigation Hold',
            isActive: true,
            scope: { userIds: ['user-1'] },
            createdBy: userId,
          })
        );

        const hold = await retentionService.createLegalHold(
          workspaceId,
          'Investigation Hold',
          { userIds: ['user-1'] },
          userId
        );

        expect(hold.name).toBe('Investigation Hold');
        expect(hold.isActive).toBe(true);
        expect(hold.scope.userIds).toContain('user-1');
      });

      it('should create legal hold with date range', async () => {
        const workspaceId = generateWorkspaceId();
        const userId = generateUserId();
        const dateRange = {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        };

        mockPrisma.legalHold.create.mockResolvedValue(
          createMockLegalHoldRecord({
            workspaceId,
            name: 'Date Range Hold',
            scope: { dateRange },
          })
        );

        const hold = await retentionService.createLegalHold(
          workspaceId,
          'Date Range Hold',
          { dateRange },
          userId
        );

        expect(hold.scope.dateRange).toBeDefined();
      });
    });

    describe('releaseLegalHold', () => {
      it('should release a legal hold', async () => {
        const holdId = generateHoldId();
        const releasedBy = generateUserId();
        const releasedAt = new Date();

        mockPrisma.legalHold.update.mockResolvedValue(
          createMockLegalHoldRecord({
            id: holdId,
            isActive: false,
            releasedAt,
            releasedBy,
          })
        );

        const hold = await retentionService.releaseLegalHold(
          holdId,
          releasedBy
        );

        expect(hold.isActive).toBe(false);
        expect(hold.releasedBy).toBe(releasedBy);
        expect(hold.releasedAt).toBeDefined();
      });
    });

    describe('getActiveLegalHolds', () => {
      it('should return only active legal holds', async () => {
        const workspaceId = generateWorkspaceId();

        mockPrisma.legalHold.findMany.mockResolvedValue([
          createMockLegalHoldRecord({
            workspaceId,
            isActive: true,
            name: 'Active Hold',
          }),
        ]);

        const holds = await retentionService.getActiveLegalHolds(workspaceId);

        expect(holds).toHaveLength(1);
        expect(holds[0].isActive).toBe(true);
        expect(mockPrisma.legalHold.findMany).toHaveBeenCalledWith({
          where: { workspaceId, isActive: true },
        });
      });
    });
  });

  // ===========================================================================
  // Data Export Tests
  // ===========================================================================

  describe('data export', () => {
    describe('requestExport', () => {
      it('should request a data export', async () => {
        const workspaceId = generateWorkspaceId();
        const userId = generateUserId();

        mockPrisma.dataExport.create.mockResolvedValue(
          createMockDataExportRecord({
            workspaceId,
            requestedBy: userId,
            type: 'full',
            status: 'pending',
            format: 'zip',
          })
        );

        const dataExport = await retentionService.requestExport(
          workspaceId,
          userId,
          'full',
          {},
          'zip'
        );

        expect(dataExport.status).toBe('pending');
        expect(dataExport.format).toBe('zip');
        expect(mockRedis.lpush).toHaveBeenCalledWith(
          'retention:export:queue',
          expect.any(String)
        );
      });

      it('should create export with scope', async () => {
        const workspaceId = generateWorkspaceId();
        const userId = generateUserId();
        const scope = {
          channelIds: ['ch-1', 'ch-2'],
          includeMessages: true,
          includeFiles: false,
        };

        mockPrisma.dataExport.create.mockResolvedValue(
          createMockDataExportRecord({
            workspaceId,
            requestedBy: userId,
            type: 'partial',
            scope,
          })
        );

        const dataExport = await retentionService.requestExport(
          workspaceId,
          userId,
          'partial',
          scope,
          'json'
        );

        expect(dataExport.scope.channelIds).toEqual(['ch-1', 'ch-2']);
      });
    });

    describe('getExport', () => {
      it('should return export by ID', async () => {
        const exportId = 'export-1';

        mockPrisma.dataExport.findUnique.mockResolvedValue(
          createMockDataExportRecord({
            id: exportId,
            status: 'completed',
            fileUrl: 'https://example.com/export.zip',
          })
        );

        const dataExport = await retentionService.getExport(exportId);

        expect(dataExport).not.toBeNull();
        expect(dataExport?.status).toBe('completed');
        expect(dataExport?.fileUrl).toBe('https://example.com/export.zip');
      });

      it('should return null for non-existent export', async () => {
        mockPrisma.dataExport.findUnique.mockResolvedValue(null);

        const dataExport = await retentionService.getExport('non-existent');

        expect(dataExport).toBeNull();
      });
    });

    describe('getExports', () => {
      it('should return all exports for workspace', async () => {
        const workspaceId = generateWorkspaceId();

        mockPrisma.dataExport.findMany.mockResolvedValue([
          createMockDataExportRecord({ workspaceId, status: 'completed' }),
          createMockDataExportRecord({ workspaceId, status: 'pending' }),
        ]);

        const exports = await retentionService.getExports(workspaceId);

        expect(exports).toHaveLength(2);
      });
    });
  });

  // ===========================================================================
  // Resource Processing Tests
  // ===========================================================================

  describe('resource processing', () => {
    it('should process message deletion', async () => {
      const workspaceId = generateWorkspaceId();
      const policyId = generatePolicyId();

      mockPrisma.retentionPolicy.findUnique.mockResolvedValue(
        createMockPolicyRecord({
          id: policyId,
          workspaceId,
          rules: [
            createMockRetentionRule({
              resourceType: 'message',
              action: 'delete',
            }),
          ],
        })
      );
      mockPrisma.legalHold.findMany.mockResolvedValue([]);
      mockPrisma.retentionJob.create.mockResolvedValue(
        createMockJobRecord({ workspaceId, policyId, status: 'running' })
      );
      mockPrisma.message.findMany
        .mockResolvedValueOnce([
          { id: 'msg-1', createdAt: new Date('2020-01-01') },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.message.update.mockResolvedValue({
        id: 'msg-1',
        isDeleted: true,
      });
      mockPrisma.retentionJob.update.mockResolvedValue(
        createMockJobRecord({ status: 'completed', itemsProcessed: 1 })
      );

      await retentionService.runRetentionJob(policyId);

      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({
          isDeleted: true,
        }),
      });
    });

    it('should process file deletion', async () => {
      const workspaceId = generateWorkspaceId();
      const policyId = generatePolicyId();

      mockPrisma.retentionPolicy.findUnique.mockResolvedValue(
        createMockPolicyRecord({
          id: policyId,
          workspaceId,
          rules: [
            createMockRetentionRule({ resourceType: 'file', action: 'delete' }),
          ],
        })
      );
      mockPrisma.legalHold.findMany.mockResolvedValue([]);
      mockPrisma.retentionJob.create.mockResolvedValue(
        createMockJobRecord({ workspaceId, policyId, status: 'running' })
      );
      mockPrisma.attachment.findMany
        .mockResolvedValueOnce([
          { id: 'file-1', createdAt: new Date('2020-01-01') },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.attachment.update.mockResolvedValue({ id: 'file-1' });
      mockPrisma.retentionJob.update.mockResolvedValue(
        createMockJobRecord({ status: 'completed', itemsProcessed: 1 })
      );

      await retentionService.runRetentionJob(policyId);

      expect(mockPrisma.attachment.update).toHaveBeenCalled();
    });

    it('should process channel archival', async () => {
      const workspaceId = generateWorkspaceId();
      const policyId = generatePolicyId();

      mockPrisma.retentionPolicy.findUnique.mockResolvedValue(
        createMockPolicyRecord({
          id: policyId,
          workspaceId,
          rules: [
            createMockRetentionRule({
              resourceType: 'channel',
              action: 'archive',
            }),
          ],
        })
      );
      mockPrisma.legalHold.findMany.mockResolvedValue([]);
      mockPrisma.retentionJob.create.mockResolvedValue(
        createMockJobRecord({ workspaceId, policyId, status: 'running' })
      );
      mockPrisma.channel.findMany
        .mockResolvedValueOnce([
          { id: 'ch-1', isArchived: true, createdAt: new Date('2020-01-01') },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.channel.update.mockResolvedValue({
        id: 'ch-1',
        isArchived: true,
      });
      mockPrisma.retentionJob.update.mockResolvedValue(
        createMockJobRecord({ status: 'completed', itemsProcessed: 1 })
      );

      await retentionService.runRetentionJob(policyId);

      expect(mockPrisma.channel.update).toHaveBeenCalledWith({
        where: { id: 'ch-1' },
        data: expect.objectContaining({
          isArchived: true,
        }),
      });
    });

    it('should handle message anonymization', async () => {
      const workspaceId = generateWorkspaceId();
      const policyId = generatePolicyId();

      mockPrisma.retentionPolicy.findUnique.mockResolvedValue(
        createMockPolicyRecord({
          id: policyId,
          workspaceId,
          rules: [
            createMockRetentionRule({
              resourceType: 'message',
              action: 'anonymize',
            }),
          ],
        })
      );
      mockPrisma.legalHold.findMany.mockResolvedValue([]);
      mockPrisma.retentionJob.create.mockResolvedValue(
        createMockJobRecord({ workspaceId, policyId, status: 'running' })
      );
      mockPrisma.message.findMany
        .mockResolvedValueOnce([
          { id: 'msg-1', createdAt: new Date('2020-01-01') },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.message.update.mockResolvedValue({ id: 'msg-1' });
      mockPrisma.retentionJob.update.mockResolvedValue(
        createMockJobRecord({ status: 'completed', itemsProcessed: 1 })
      );

      await retentionService.runRetentionJob(policyId);

      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({
          content: '[Content removed due to retention policy]',
          userId: null,
        }),
      });
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should capture processing errors in job', async () => {
      const workspaceId = generateWorkspaceId();
      const policyId = generatePolicyId();

      mockPrisma.retentionPolicy.findUnique.mockResolvedValue(
        createMockPolicyRecord({
          id: policyId,
          workspaceId,
          rules: [
            createMockRetentionRule({
              resourceType: 'message',
              action: 'delete',
            }),
          ],
        })
      );
      mockPrisma.legalHold.findMany.mockResolvedValue([]);
      mockPrisma.retentionJob.create.mockResolvedValue(
        createMockJobRecord({ workspaceId, policyId, status: 'running' })
      );
      mockPrisma.message.findMany
        .mockResolvedValueOnce([
          { id: 'msg-1', createdAt: new Date('2020-01-01') },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.message.update.mockRejectedValue(new Error('Database error'));
      mockPrisma.retentionJob.update.mockResolvedValue(
        createMockJobRecord({
          status: 'completed',
          itemsProcessed: 0,
          itemsFailed: 1,
          errors: [
            {
              resourceId: 'msg-1',
              resourceType: 'message',
              error: 'Database error',
              timestamp: new Date(),
            },
          ],
        })
      );

      const job = await retentionService.runRetentionJob(policyId);

      expect(job.itemsFailed).toBe(1);
      expect(job.errors).toHaveLength(1);
    });
  });
});
