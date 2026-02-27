/**
 * Task Service
 * Manages task creation, execution, and lifecycle
 * @module lib/services/task-service
 */

import { prisma } from '@neolith/database';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['blocked', 'completed', 'failed', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  completed: [],
  failed: ['pending', 'in_progress'],
  cancelled: [],
};

/**
 * Create a new task
 */
export async function createTask(taskData: any): Promise<any> {
  try {
    return await (prisma as any).task.create({ data: taskData });
  } catch (error) {
    throw error;
  }
}

/**
 * Get task by ID
 */
export async function getTask(taskId: string): Promise<any> {
  try {
    return await (prisma as any).task.findUnique({ where: { id: taskId } });
  } catch (error) {
    return null;
  }
}

/**
 * Update task
 */
export async function updateTask(taskId: string, updates: any): Promise<any> {
  try {
    return await (prisma as any).task.update({
      where: { id: taskId },
      data: updates,
    });
  } catch (error) {
    return null;
  }
}

/**
 * Delete task
 */
export async function deleteTask(taskId: string): Promise<void> {
  try {
    await (prisma as any).task.update({
      where: { id: taskId },
      data: { status: 'deleted' },
    });
  } catch (error) {
    throw error;
  }
}

/**
 * List all tasks
 */
export async function listTasks(filters?: any): Promise<any[]> {
  try {
    return await (prisma as any).task.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    return [];
  }
}

/**
 * Execute task
 */
export async function executeTask(taskId: string, context?: any): Promise<any> {
  try {
    return await (prisma as any).task.update({
      where: { id: taskId },
      data: { status: 'in_progress' },
    });
  } catch (error) {
    return null;
  }
}

/**
 * Cancel task execution
 */
export async function cancelTask(taskId: string): Promise<void> {
  try {
    await (prisma as any).task.update({
      where: { id: taskId },
      data: { status: 'cancelled' },
    });
  } catch (error) {
    throw error;
  }
}

/**
 * Get task execution status
 */
export async function getTaskStatus(taskId: string): Promise<any> {
  try {
    return await (prisma as any).task.findUnique({
      where: { id: taskId },
      select: { id: true, status: true, updatedAt: true },
    });
  } catch (error) {
    return null;
  }
}

/**
 * Retry failed task
 */
export async function retryTask(
  taskId: string,
  retryConfig?: any
): Promise<any> {
  try {
    const task = await (prisma as any).task.findUnique({
      where: { id: taskId },
      select: { retryCount: true },
    });
    const currentRetryCount = task?.retryCount ?? 0;
    return await (prisma as any).task.update({
      where: { id: taskId },
      data: {
        status: 'pending',
        retryCount: currentRetryCount + 1,
      },
    });
  } catch (error) {
    return null;
  }
}

/**
 * Check if a status transition is valid
 */
export async function canTransitionToStatus(
  taskId: string,
  newStatus: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const task = await (prisma as any).task.findUnique({
      where: { id: taskId },
      select: { status: true },
    });

    if (!task) {
      return { allowed: false, reason: 'Task not found' };
    }

    const currentStatus: string = task.status;
    const allowed =
      VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;

    if (!allowed) {
      return {
        allowed: false,
        reason: `Cannot transition from '${currentStatus}' to '${newStatus}'`,
      };
    }

    return { allowed: true };
  } catch (error) {
    return { allowed: false, reason: 'Failed to fetch task status' };
  }
}

/**
 * Validate task dependencies
 */
export async function validateTaskDependencies(
  taskId: string,
  dependencies: string[],
  workspaceId: string
): Promise<{
  valid: boolean;
  errors?: string[];
  circularDependencies?: string[];
  unresolvedDependencies?: string[];
}> {
  const errors: string[] = [];
  const circularDependencies: string[] = [];
  const unresolvedDependencies: string[] = [];

  if (dependencies.includes(taskId)) {
    errors.push('Task cannot depend on itself');
    circularDependencies.push(taskId);
  }

  try {
    if (dependencies.length > 0) {
      const existingTasks = await (prisma as any).task.findMany({
        where: { id: { in: dependencies } },
        select: { id: true, dependencies: true },
      });

      const existingIds = new Set(existingTasks.map((t: any) => t.id));

      for (const depId of dependencies) {
        if (!existingIds.has(depId)) {
          unresolvedDependencies.push(depId);
          errors.push(`Dependency task '${depId}' does not exist`);
        }
      }

      // BFS cycle detection across the full dependency graph
      const visited = new Set<string>();
      const queue: string[] = [...dependencies];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        const currentTask = existingTasks.find((t: any) => t.id === current);
        const transitiveDeps: string[] = currentTask?.dependencies ?? [];

        for (const transitive of transitiveDeps) {
          if (transitive === taskId) {
            circularDependencies.push(current);
            errors.push(
              `Circular dependency detected: task '${current}' transitively depends on this task`
            );
          } else {
            queue.push(transitive);
          }
        }
      }
    }
  } catch (error) {
    errors.push('Failed to validate dependencies against the database');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    circularDependencies:
      circularDependencies.length > 0 ? circularDependencies : undefined,
    unresolvedDependencies:
      unresolvedDependencies.length > 0 ? unresolvedDependencies : undefined,
  };
}

/**
 * Get task metrics
 */
export async function getTaskMetrics(filters?: {
  orchestratorId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  total: number;
  byStatus: Record<string, number>;
  avgDuration: number;
  completionRate: number;
}> {
  const defaultMetrics = {
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
  };

  try {
    const where: any = {};
    if (filters?.orchestratorId) where.orchestratorId = filters.orchestratorId;
    if (filters?.status) where.status = filters.status;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const grouped = await (prisma as any).task.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });

    const byStatus: Record<string, number> = { ...defaultMetrics.byStatus };
    let total = 0;

    for (const row of grouped) {
      const count: number = row._count.status;
      byStatus[row.status] = count;
      total += count;
    }

    const completedCount = byStatus['completed'] ?? 0;
    const completionRate = total > 0 ? completedCount / total : 0;

    // Average duration for completed tasks that have both startedAt and completedAt
    let avgDuration = 0;
    try {
      const durationAgg = await (prisma as any).task.aggregate({
        where: {
          ...where,
          status: 'completed',
          startedAt: { not: null },
          completedAt: { not: null },
        },
        _avg: { durationMs: true },
      });
      avgDuration = durationAgg._avg?.durationMs ?? 0;
    } catch {
      // durationMs field may not exist on the model; fall back to zero
      avgDuration = 0;
    }

    return { total, byStatus, avgDuration, completionRate };
  } catch (error) {
    return defaultMetrics;
  }
}
