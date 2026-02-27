/**
 * Task Service Tests
 *
 * @module lib/services/__tests__/task-service.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTask,
  getTask,
  updateTask,
  deleteTask,
  listTasks,
  executeTask,
  cancelTask,
  getTaskStatus,
  retryTask,
  canTransitionToStatus,
  validateTaskDependencies,
  getTaskMetrics,
} from '../task-service';

// Mock Prisma
vi.mock('@neolith/database', () => ({
  prisma: {
    task: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

describe('Task Service', () => {
  let mockPrisma: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@neolith/database');
    mockPrisma = (mod as any).prisma;
  });

  // --------------------------------------------------------------------------
  // CRUD operations
  // --------------------------------------------------------------------------

  describe('createTask', () => {
    it('should create a task via prisma and return it', async () => {
      const taskData = { title: 'Build widget', status: 'pending' };
      const created = { id: 'task_1', ...taskData };
      mockPrisma.task.create.mockResolvedValue(created);

      const result = await createTask(taskData);

      expect(result).toEqual(created);
      expect(mockPrisma.task.create).toHaveBeenCalledWith({ data: taskData });
    });

    it('should propagate errors from prisma', async () => {
      mockPrisma.task.create.mockRejectedValue(new Error('DB error'));

      await expect(createTask({})).rejects.toThrow('DB error');
    });
  });

  describe('getTask', () => {
    it('should return a task by id', async () => {
      const task = { id: 'task_1', title: 'Test' };
      mockPrisma.task.findUnique.mockResolvedValue(task);

      const result = await getTask('task_1');

      expect(result).toEqual(task);
      expect(mockPrisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: 'task_1' },
      });
    });

    it('should return null when prisma throws', async () => {
      mockPrisma.task.findUnique.mockRejectedValue(new Error('Not found'));

      const result = await getTask('missing');
      expect(result).toBeNull();
    });
  });

  describe('updateTask', () => {
    it('should update a task and return the updated record', async () => {
      const updated = { id: 'task_1', title: 'Updated' };
      mockPrisma.task.update.mockResolvedValue(updated);

      const result = await updateTask('task_1', { title: 'Updated' });

      expect(result).toEqual(updated);
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_1' },
        data: { title: 'Updated' },
      });
    });

    it('should return null on error', async () => {
      mockPrisma.task.update.mockRejectedValue(new Error('fail'));

      const result = await updateTask('bad', {});
      expect(result).toBeNull();
    });
  });

  describe('deleteTask', () => {
    it('should soft-delete a task by setting status to deleted', async () => {
      mockPrisma.task.update.mockResolvedValue({});

      await deleteTask('task_1');

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_1' },
        data: { status: 'deleted' },
      });
    });

    it('should propagate errors on delete failure', async () => {
      mockPrisma.task.update.mockRejectedValue(new Error('Cannot delete'));

      await expect(deleteTask('task_1')).rejects.toThrow('Cannot delete');
    });
  });

  describe('listTasks', () => {
    it('should return tasks ordered by createdAt desc', async () => {
      const tasks = [{ id: 't1' }, { id: 't2' }];
      mockPrisma.task.findMany.mockResolvedValue(tasks);

      const result = await listTasks({ status: 'pending' });

      expect(result).toEqual(tasks);
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array on error', async () => {
      mockPrisma.task.findMany.mockRejectedValue(new Error('fail'));

      const result = await listTasks();
      expect(result).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // Execution lifecycle
  // --------------------------------------------------------------------------

  describe('executeTask', () => {
    it('should set task status to in_progress', async () => {
      const updated = { id: 'task_1', status: 'in_progress' };
      mockPrisma.task.update.mockResolvedValue(updated);

      const result = await executeTask('task_1');

      expect(result).toEqual(updated);
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_1' },
        data: { status: 'in_progress' },
      });
    });

    it('should return null on error', async () => {
      mockPrisma.task.update.mockRejectedValue(new Error('fail'));

      const result = await executeTask('task_1');
      expect(result).toBeNull();
    });
  });

  describe('cancelTask', () => {
    it('should set task status to cancelled', async () => {
      mockPrisma.task.update.mockResolvedValue({});

      await cancelTask('task_1');

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_1' },
        data: { status: 'cancelled' },
      });
    });

    it('should propagate errors', async () => {
      mockPrisma.task.update.mockRejectedValue(new Error('fail'));

      await expect(cancelTask('task_1')).rejects.toThrow('fail');
    });
  });

  describe('getTaskStatus', () => {
    it('should return id, status, and updatedAt', async () => {
      const status = {
        id: 'task_1',
        status: 'completed',
        updatedAt: new Date(),
      };
      mockPrisma.task.findUnique.mockResolvedValue(status);

      const result = await getTaskStatus('task_1');

      expect(result).toEqual(status);
      expect(mockPrisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: 'task_1' },
        select: { id: true, status: true, updatedAt: true },
      });
    });

    it('should return null on error', async () => {
      mockPrisma.task.findUnique.mockRejectedValue(new Error('fail'));

      const result = await getTaskStatus('task_1');
      expect(result).toBeNull();
    });
  });

  describe('retryTask', () => {
    it('should increment retryCount and reset status to pending', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ retryCount: 2 });
      const retried = { id: 'task_1', status: 'pending', retryCount: 3 };
      mockPrisma.task.update.mockResolvedValue(retried);

      const result = await retryTask('task_1');

      expect(result).toEqual(retried);
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_1' },
        data: { status: 'pending', retryCount: 3 },
      });
    });

    it('should default retryCount to 0 when task has no retryCount', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({});
      mockPrisma.task.update.mockResolvedValue({});

      await retryTask('task_1');

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_1' },
        data: { status: 'pending', retryCount: 1 },
      });
    });

    it('should return null on error', async () => {
      mockPrisma.task.findUnique.mockRejectedValue(new Error('fail'));

      const result = await retryTask('task_1');
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // State machine: canTransitionToStatus
  // --------------------------------------------------------------------------

  describe('canTransitionToStatus', () => {
    it('should allow pending -> in_progress', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ status: 'pending' });

      const result = await canTransitionToStatus('task_1', 'in_progress');

      expect(result).toEqual({ allowed: true });
    });

    it('should allow pending -> cancelled', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ status: 'pending' });

      const result = await canTransitionToStatus('task_1', 'cancelled');

      expect(result).toEqual({ allowed: true });
    });

    it('should allow in_progress -> completed', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ status: 'in_progress' });

      const result = await canTransitionToStatus('task_1', 'completed');

      expect(result).toEqual({ allowed: true });
    });

    it('should allow failed -> pending (retry)', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ status: 'failed' });

      const result = await canTransitionToStatus('task_1', 'pending');

      expect(result).toEqual({ allowed: true });
    });

    it('should reject completed -> pending (terminal state)', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ status: 'completed' });

      const result = await canTransitionToStatus('task_1', 'pending');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        "Cannot transition from 'completed' to 'pending'"
      );
    });

    it('should reject cancelled -> in_progress (terminal state)', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ status: 'cancelled' });

      const result = await canTransitionToStatus('task_1', 'in_progress');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Cannot transition from 'cancelled'");
    });

    it('should return not-found when task does not exist', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      const result = await canTransitionToStatus('missing', 'in_progress');

      expect(result).toEqual({ allowed: false, reason: 'Task not found' });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.task.findUnique.mockRejectedValue(new Error('DB down'));

      const result = await canTransitionToStatus('task_1', 'in_progress');

      expect(result).toEqual({
        allowed: false,
        reason: 'Failed to fetch task status',
      });
    });
  });

  // --------------------------------------------------------------------------
  // Dependency validation
  // --------------------------------------------------------------------------

  describe('validateTaskDependencies', () => {
    it('should detect self-dependency', async () => {
      const result = await validateTaskDependencies(
        'task_1',
        ['task_1'],
        'ws1'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Task cannot depend on itself');
      expect(result.circularDependencies).toContain('task_1');
    });

    it('should detect missing (unresolved) dependencies', async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 'dep_1', dependencies: [] },
      ]);

      const result = await validateTaskDependencies(
        'task_1',
        ['dep_1', 'dep_missing'],
        'ws1'
      );

      expect(result.valid).toBe(false);
      expect(result.unresolvedDependencies).toContain('dep_missing');
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("'dep_missing' does not exist"),
        ])
      );
    });

    it('should detect circular dependencies via transitive deps', async () => {
      // task_1 depends on dep_A, dep_A depends on task_1
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 'dep_A', dependencies: ['task_1'] },
      ]);

      const result = await validateTaskDependencies('task_1', ['dep_A'], 'ws1');

      expect(result.valid).toBe(false);
      expect(result.circularDependencies).toContain('dep_A');
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Circular dependency detected'),
        ])
      );
    });

    it('should pass when all dependencies exist and no cycles', async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 'dep_1', dependencies: [] },
        { id: 'dep_2', dependencies: [] },
      ]);

      const result = await validateTaskDependencies(
        'task_1',
        ['dep_1', 'dep_2'],
        'ws1'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.circularDependencies).toBeUndefined();
      expect(result.unresolvedDependencies).toBeUndefined();
    });

    it('should pass for empty dependency list', async () => {
      const result = await validateTaskDependencies('task_1', [], 'ws1');

      expect(result.valid).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.task.findMany.mockRejectedValue(new Error('DB fail'));

      const result = await validateTaskDependencies('task_1', ['dep_1'], 'ws1');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Failed to validate dependencies against the database'
      );
    });
  });

  // --------------------------------------------------------------------------
  // Metrics
  // --------------------------------------------------------------------------

  describe('getTaskMetrics', () => {
    it('should aggregate counts by status and compute completionRate', async () => {
      mockPrisma.task.groupBy.mockResolvedValue([
        { status: 'completed', _count: { status: 7 } },
        { status: 'pending', _count: { status: 2 } },
        { status: 'failed', _count: { status: 1 } },
      ]);
      mockPrisma.task.aggregate.mockResolvedValue({
        _avg: { durationMs: 1500 },
      });

      const result = await getTaskMetrics({ orchestratorId: 'orch_1' });

      expect(result.total).toBe(10);
      expect(result.byStatus.completed).toBe(7);
      expect(result.byStatus.pending).toBe(2);
      expect(result.byStatus.failed).toBe(1);
      expect(result.completionRate).toBeCloseTo(0.7);
      expect(result.avgDuration).toBe(1500);
    });

    it('should return zero completionRate when total is 0', async () => {
      mockPrisma.task.groupBy.mockResolvedValue([]);
      mockPrisma.task.aggregate.mockResolvedValue({
        _avg: { durationMs: null },
      });

      const result = await getTaskMetrics();

      expect(result.total).toBe(0);
      expect(result.completionRate).toBe(0);
      expect(result.avgDuration).toBe(0);
    });

    it('should return default metrics on database error', async () => {
      mockPrisma.task.groupBy.mockRejectedValue(new Error('DB fail'));

      const result = await getTaskMetrics();

      expect(result).toEqual({
        total: 0,
        byStatus: {
          pending: 0,
          in_progress: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
        },
        avgDuration: 0,
        completionRate: 0,
      });
    });

    it('should apply date filters to the where clause', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');

      mockPrisma.task.groupBy.mockResolvedValue([]);
      mockPrisma.task.aggregate.mockResolvedValue({
        _avg: { durationMs: null },
      });

      await getTaskMetrics({ startDate, endDate });

      expect(mockPrisma.task.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: startDate, lte: endDate },
          }),
        })
      );
    });

    it('should handle aggregate failure gracefully and default avgDuration to 0', async () => {
      mockPrisma.task.groupBy.mockResolvedValue([
        { status: 'completed', _count: { status: 5 } },
      ]);
      mockPrisma.task.aggregate.mockRejectedValue(
        new Error('no durationMs column')
      );

      const result = await getTaskMetrics();

      expect(result.total).toBe(5);
      expect(result.avgDuration).toBe(0);
    });
  });
});
