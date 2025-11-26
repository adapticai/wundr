/**
 * VP Scheduling Service
 *
 * Business logic for VP work rhythm, scheduling, and capacity management.
 *
 * @module lib/services/vp-scheduling-service
 */

import { prisma } from '@neolith/database';

import type {
  WorkScheduleConfig,
  CapacityConfig,
  RecurringTask,
} from '@/lib/validations/vp-scheduling';
import type { Prisma } from '@prisma/client';

/**
 * Get VP's work schedule configuration
 *
 * @param vpId - VP ID
 * @returns Work schedule configuration
 */
export async function getWorkSchedule(vpId: string): Promise<WorkScheduleConfig | null> {
  const vp = await prisma.vP.findUnique({
    where: { id: vpId },
    select: {
      user: {
        select: {
          vpConfig: true,
        },
      },
    },
  });

  if (!vp?.user.vpConfig) {
    return null;
  }

  const config = vp.user.vpConfig as Record<string, unknown>;
  return (config.workSchedule as WorkScheduleConfig) || null;
}

/**
 * Update VP's work schedule configuration
 *
 * @param vpId - VP ID
 * @param schedule - Work schedule configuration to update
 * @returns Updated work schedule configuration
 */
export async function updateWorkSchedule(
  vpId: string,
  schedule: Partial<WorkScheduleConfig>,
): Promise<WorkScheduleConfig> {
  const vp = await prisma.vP.findUnique({
    where: { id: vpId },
    select: {
      userId: true,
      user: {
        select: {
          vpConfig: true,
        },
      },
    },
  });

  if (!vp) {
    throw new Error('VP not found');
  }

  const currentConfig = (vp.user.vpConfig as Record<string, unknown>) || {};
  const currentSchedule = (currentConfig.workSchedule as WorkScheduleConfig) || {};

  const updatedSchedule: WorkScheduleConfig = {
    ...currentSchedule,
    ...schedule,
  };

  await prisma.user.update({
    where: { id: vp.userId },
    data: {
      vpConfig: {
        ...currentConfig,
        workSchedule: updatedSchedule,
      },
    },
  });

  return updatedSchedule;
}

/**
 * Get VP's capacity and workload configuration
 *
 * @param vpId - VP ID
 * @returns Capacity configuration and current utilization
 */
export async function getCapacity(vpId: string): Promise<{
  config: CapacityConfig;
  utilization: {
    activeTasks: number;
    queuedTasks: number;
    utilizationPercentage: number;
    energyUsed: number;
    energyRemaining: number;
  };
} | null> {
  const vp = await prisma.vP.findUnique({
    where: { id: vpId },
    select: {
      user: {
        select: {
          vpConfig: true,
        },
      },
    },
  });

  if (!vp?.user.vpConfig) {
    return null;
  }

  const config = vp.user.vpConfig as Record<string, unknown>;
  const capacityConfig = (config.capacity as CapacityConfig) || {
    maxConcurrentTasks: 5,
    energyBudget: 100,
    currentEnergy: 100,
    maxQueueSize: 50,
  };

  // Calculate current utilization
  const [activeTasks, queuedTasks] = await Promise.all([
    prisma.task.count({
      where: {
        vpId,
        status: 'IN_PROGRESS',
      },
    }),
    prisma.task.count({
      where: {
        vpId,
        status: 'TODO',
      },
    }),
  ]);

  const utilizationPercentage =
    capacityConfig.maxConcurrentTasks
      ? Math.round((activeTasks / capacityConfig.maxConcurrentTasks) * 100)
      : 0;

  const energyUsed = capacityConfig.energyBudget
    ? Math.max(0, capacityConfig.energyBudget - (capacityConfig.currentEnergy || 0))
    : 0;

  const energyRemaining = capacityConfig.currentEnergy || 0;

  return {
    config: capacityConfig,
    utilization: {
      activeTasks,
      queuedTasks,
      utilizationPercentage,
      energyUsed,
      energyRemaining,
    },
  };
}

/**
 * Update VP's capacity configuration
 *
 * @param vpId - VP ID
 * @param capacity - Capacity configuration to update
 * @returns Updated capacity configuration
 */
export async function updateCapacity(
  vpId: string,
  capacity: Partial<CapacityConfig>,
): Promise<CapacityConfig> {
  const vp = await prisma.vP.findUnique({
    where: { id: vpId },
    select: {
      userId: true,
      user: {
        select: {
          vpConfig: true,
        },
      },
    },
  });

  if (!vp) {
    throw new Error('VP not found');
  }

  const currentConfig = (vp.user.vpConfig as Record<string, unknown>) || {};
  const currentCapacity = (currentConfig.capacity as CapacityConfig) || {};

  const updatedCapacity: CapacityConfig = {
    ...currentCapacity,
    ...capacity,
  };

  // If energy budget is updated and current energy is not set, initialize it
  if (capacity.energyBudget && !capacity.currentEnergy) {
    updatedCapacity.currentEnergy = capacity.energyBudget;
  }

  await prisma.user.update({
    where: { id: vp.userId },
    data: {
      vpConfig: {
        ...currentConfig,
        capacity: updatedCapacity,
      },
    },
  });

  return updatedCapacity;
}

/**
 * Get VP's recurring tasks
 *
 * @param vpId - VP ID
 * @returns List of recurring tasks
 */
export async function getRecurringTasks(vpId: string): Promise<RecurringTask[]> {
  const vp = await prisma.vP.findUnique({
    where: { id: vpId },
    select: {
      user: {
        select: {
          vpConfig: true,
        },
      },
    },
  });

  if (!vp?.user.vpConfig) {
    return [];
  }

  const config = vp.user.vpConfig as Record<string, unknown>;
  return (config.recurringTasks as RecurringTask[]) || [];
}

/**
 * Add recurring task to VP's schedule
 *
 * @param vpId - VP ID
 * @param task - Recurring task to add
 * @returns Updated list of recurring tasks
 */
export async function addRecurringTask(
  vpId: string,
  task: RecurringTask,
): Promise<RecurringTask[]> {
  const vp = await prisma.vP.findUnique({
    where: { id: vpId },
    select: {
      userId: true,
      user: {
        select: {
          vpConfig: true,
        },
      },
    },
  });

  if (!vp) {
    throw new Error('VP not found');
  }

  const currentConfig = (vp.user.vpConfig as Record<string, unknown>) || {};
  const currentTasks = (currentConfig.recurringTasks as RecurringTask[]) || [];

  const updatedTasks = [...currentTasks, task];

  await prisma.user.update({
    where: { id: vp.userId },
    data: {
      vpConfig: {
        ...currentConfig,
        recurringTasks: updatedTasks,
      } as Prisma.InputJsonValue,
    },
  });

  return updatedTasks;
}

/**
 * Remove recurring task from VP's schedule
 *
 * @param vpId - VP ID
 * @param taskIndex - Index of task to remove
 * @returns Updated list of recurring tasks
 */
export async function removeRecurringTask(
  vpId: string,
  taskIndex: number,
): Promise<RecurringTask[]> {
  const vp = await prisma.vP.findUnique({
    where: { id: vpId },
    select: {
      userId: true,
      user: {
        select: {
          vpConfig: true,
        },
      },
    },
  });

  if (!vp) {
    throw new Error('VP not found');
  }

  const currentConfig = (vp.user.vpConfig as Record<string, unknown>) || {};
  const currentTasks = (currentConfig.recurringTasks as RecurringTask[]) || [];

  if (taskIndex < 0 || taskIndex >= currentTasks.length) {
    throw new Error('Invalid task index');
  }

  const updatedTasks = currentTasks.filter((_, index) => index !== taskIndex);

  await prisma.user.update({
    where: { id: vp.userId },
    data: {
      vpConfig: {
        ...currentConfig,
        recurringTasks: updatedTasks,
      } as Prisma.InputJsonValue,
    },
  });

  return updatedTasks;
}

/**
 * Check VP availability for a time range
 *
 * @param vpId - VP ID
 * @param startTime - Start of time range
 * @param endTime - End of time range
 * @returns Availability status and available slots
 */
export async function checkAvailability(
  vpId: string,
  startTime: Date,
  endTime: Date,
): Promise<{
  isAvailable: boolean;
  availableSlots: Array<{ start: Date; end: Date }>;
  conflicts: Array<{ taskId: string; taskTitle: string; start: Date; end: Date }>;
}> {
  // Get tasks scheduled in the time range
  const scheduledTasks = await prisma.task.findMany({
    where: {
      vpId,
      status: { in: ['TODO', 'IN_PROGRESS'] },
      OR: [
        {
          metadata: {
            path: ['scheduledStart'],
            gte: startTime.toISOString(),
            lte: endTime.toISOString(),
          },
        },
        {
          AND: [
            {
              metadata: {
                path: ['scheduledStart'],
                lte: endTime.toISOString(),
              },
            },
            {
              metadata: {
                path: ['scheduledEnd'],
                gte: startTime.toISOString(),
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      title: true,
      metadata: true,
    },
  });

  const conflicts = scheduledTasks
    .map((task) => {
      const metadata = task.metadata as Record<string, unknown>;
      const scheduledStart = metadata.scheduledStart
        ? new Date(metadata.scheduledStart as string)
        : null;
      const scheduledEnd = metadata.scheduledEnd
        ? new Date(metadata.scheduledEnd as string)
        : null;

      if (scheduledStart && scheduledEnd) {
        return {
          taskId: task.id,
          taskTitle: task.title,
          start: scheduledStart,
          end: scheduledEnd,
        };
      }
      return null;
    })
    .filter((conflict): conflict is NonNullable<typeof conflict> => conflict !== null);

  // Calculate available slots (simplified - in production, consider work hours, breaks, etc.)
  const availableSlots: Array<{ start: Date; end: Date }> = [];
  let currentTime = new Date(startTime);

  conflicts.sort((a, b) => a.start.getTime() - b.start.getTime());

  conflicts.forEach((conflict) => {
    if (currentTime < conflict.start) {
      availableSlots.push({
        start: new Date(currentTime),
        end: new Date(conflict.start),
      });
    }
    currentTime = new Date(Math.max(currentTime.getTime(), conflict.end.getTime()));
  });

  if (currentTime < endTime) {
    availableSlots.push({
      start: new Date(currentTime),
      end: new Date(endTime),
    });
  }

  return {
    isAvailable: conflicts.length === 0,
    availableSlots,
    conflicts,
  };
}

/**
 * Reserve time slot for a task
 *
 * @param vpId - VP ID
 * @param taskId - Task ID
 * @param startTime - Start time
 * @param durationMinutes - Duration in minutes
 * @returns Success status
 */
export async function reserveTimeSlot(
  vpId: string,
  taskId: string,
  startTime: Date,
  durationMinutes: number,
): Promise<{ success: boolean; scheduledStart: Date; scheduledEnd: Date }> {
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

  // Check for conflicts
  const availability = await checkAvailability(vpId, startTime, endTime);

  if (!availability.isAvailable) {
    throw new Error('Time slot conflict detected');
  }

  // Update task metadata with scheduled time
  await prisma.task.update({
    where: { id: taskId },
    data: {
      metadata: {
        scheduledStart: startTime.toISOString(),
        scheduledEnd: endTime.toISOString(),
      },
    },
  });

  return {
    success: true,
    scheduledStart: startTime,
    scheduledEnd: endTime,
  };
}

/**
 * Calculate VP's current capacity utilization
 *
 * @param vpId - VP ID
 * @returns Capacity metrics
 */
export async function calculateCapacity(vpId: string): Promise<{
  maxConcurrent: number;
  currentActive: number;
  utilizationPercentage: number;
  availableSlots: number;
}> {
  const capacity = await getCapacity(vpId);

  if (!capacity) {
    return {
      maxConcurrent: 5,
      currentActive: 0,
      utilizationPercentage: 0,
      availableSlots: 5,
    };
  }

  return {
    maxConcurrent: capacity.config.maxConcurrentTasks || 5,
    currentActive: capacity.utilization.activeTasks,
    utilizationPercentage: capacity.utilization.utilizationPercentage,
    availableSlots: Math.max(
      0,
      (capacity.config.maxConcurrentTasks || 5) - capacity.utilization.activeTasks,
    ),
  };
}
