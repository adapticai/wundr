/**
 * Orchestrator Scheduling Service
 * Handles scheduling and timing of orchestrator workflows
 * @module lib/services/orchestrator-scheduling-service
 */

import { prisma } from '@neolith/database';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Derive a next-run timestamp from a schedule config. */
function computeNextRunAt(scheduleConfig: any): Date {
  if (scheduleConfig?.runAt) {
    // One-shot schedule: run at a specific datetime
    return new Date(scheduleConfig.runAt);
  }

  if (
    scheduleConfig?.intervalMs &&
    typeof scheduleConfig.intervalMs === 'number'
  ) {
    return new Date(Date.now() + scheduleConfig.intervalMs);
  }

  // Default: 1 hour from now
  return new Date(Date.now() + 3600000);
}

// ---------------------------------------------------------------------------
// Core CRUD operations (backed by orchestratorMemory)
// ---------------------------------------------------------------------------

/**
 * Schedule orchestrator execution
 */
export async function scheduleExecution(
  orchestratorId: string,
  scheduleConfig: any
): Promise<any> {
  console.log(
    '[OrchestratorSchedulingService] scheduleExecution called with:',
    {
      orchestratorId,
      scheduleConfig,
    }
  );

  try {
    const scheduleId = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nextRunAt = computeNextRunAt(scheduleConfig);
    const createdAt = new Date();

    const record = {
      scheduleId,
      orchestratorId,
      config: scheduleConfig,
      status: 'active',
      nextRunAt: nextRunAt.toISOString(),
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      cancelledAt: null,
    };

    await prisma.orchestratorMemory.create({
      data: {
        orchestratorId,
        memoryType: 'scheduled_execution',
        content: JSON.stringify(record),
        importance: 0.9,
        metadata: {
          scheduleId,
          status: 'active',
          nextRunAt: nextRunAt.toISOString(),
        } as never,
      },
    });

    return record;
  } catch (error) {
    console.error('[scheduleExecution] Error:', error);
    return null;
  }
}

/**
 * Cancel scheduled execution
 */
export async function cancelSchedule(scheduleId: string): Promise<void> {
  console.log('[OrchestratorSchedulingService] cancelSchedule called with:', {
    scheduleId,
  });

  try {
    // Find the memory record that holds this schedule
    const records = await prisma.orchestratorMemory.findMany({
      where: { memoryType: 'scheduled_execution' },
      select: { id: true, content: true },
    });

    for (const record of records) {
      let parsed: any;
      try {
        parsed =
          typeof record.content === 'string'
            ? JSON.parse(record.content)
            : record.content;
      } catch {
        continue;
      }

      if (parsed?.scheduleId === scheduleId) {
        const updatedContent = JSON.stringify({
          ...parsed,
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await prisma.orchestratorMemory.update({
          where: { id: record.id },
          data: {
            content: updatedContent,
            metadata: {
              scheduleId,
              status: 'cancelled',
              cancelledAt: new Date().toISOString(),
            } as never,
          },
        });
        break;
      }
    }
  } catch (error) {
    console.error('[cancelSchedule] Error:', error);
  }
}

/**
 * Update schedule configuration
 */
export async function updateSchedule(
  scheduleId: string,
  newConfig: any
): Promise<any> {
  console.log('[OrchestratorSchedulingService] updateSchedule called with:', {
    scheduleId,
    newConfig,
  });

  try {
    const records = await prisma.orchestratorMemory.findMany({
      where: { memoryType: 'scheduled_execution' },
      select: { id: true, content: true },
    });

    for (const record of records) {
      let parsed: any;
      try {
        parsed =
          typeof record.content === 'string'
            ? JSON.parse(record.content)
            : record.content;
      } catch {
        continue;
      }

      if (parsed?.scheduleId === scheduleId) {
        const nextRunAt = computeNextRunAt(newConfig);
        const updated = {
          ...parsed,
          config: newConfig,
          nextRunAt: nextRunAt.toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await prisma.orchestratorMemory.update({
          where: { id: record.id },
          data: {
            content: JSON.stringify(updated),
            metadata: {
              scheduleId,
              status: updated.status,
              nextRunAt: nextRunAt.toISOString(),
            } as never,
          },
        });

        return updated;
      }
    }

    return null;
  } catch (error) {
    console.error('[updateSchedule] Error:', error);
    return null;
  }
}

/**
 * Get upcoming scheduled executions
 */
export async function getUpcomingExecutions(
  orchestratorId?: string,
  limit?: number
): Promise<any[]> {
  console.log(
    '[OrchestratorSchedulingService] getUpcomingExecutions called with:',
    {
      orchestratorId,
      limit,
    }
  );

  try {
    const records = await prisma.orchestratorMemory.findMany({
      where: {
        memoryType: 'scheduled_execution',
        ...(orchestratorId ? { orchestratorId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        orchestratorId: true,
        content: true,
        createdAt: true,
      },
    });

    const now = Date.now();
    const upcoming: any[] = [];

    for (const record of records) {
      let parsed: any;
      try {
        parsed =
          typeof record.content === 'string'
            ? JSON.parse(record.content)
            : record.content;
      } catch {
        continue;
      }

      if (
        parsed?.status === 'active' &&
        parsed?.nextRunAt &&
        new Date(parsed.nextRunAt).getTime() >= now
      ) {
        upcoming.push({
          ...parsed,
          orchestratorId: record.orchestratorId,
        });
      }
    }

    // Sort ascending by nextRunAt
    upcoming.sort(
      (a, b) =>
        new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()
    );

    return limit ? upcoming.slice(0, limit) : upcoming;
  } catch (error) {
    console.error('[getUpcomingExecutions] Error:', error);
    return [];
  }
}

/**
 * Create recurring schedule
 */
export async function createRecurringSchedule(
  orchestratorId: string,
  cronExpression: string,
  config?: any
): Promise<any> {
  console.log(
    '[OrchestratorSchedulingService] createRecurringSchedule called with:',
    {
      orchestratorId,
      cronExpression,
      config,
    }
  );

  const scheduleConfig = {
    ...(config ?? {}),
    cronExpression,
    recurring: true,
  };

  return scheduleExecution(orchestratorId, scheduleConfig);
}

/**
 * Pause scheduled execution
 */
export async function pauseSchedule(scheduleId: string): Promise<void> {
  console.log('[OrchestratorSchedulingService] pauseSchedule called with:', {
    scheduleId,
  });

  try {
    const records = await prisma.orchestratorMemory.findMany({
      where: { memoryType: 'scheduled_execution' },
      select: { id: true, content: true },
    });

    for (const record of records) {
      let parsed: any;
      try {
        parsed =
          typeof record.content === 'string'
            ? JSON.parse(record.content)
            : record.content;
      } catch {
        continue;
      }

      if (parsed?.scheduleId === scheduleId && parsed?.status === 'active') {
        const updated = {
          ...parsed,
          status: 'paused',
          pausedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await prisma.orchestratorMemory.update({
          where: { id: record.id },
          data: {
            content: JSON.stringify(updated),
            metadata: {
              scheduleId,
              status: 'paused',
            } as never,
          },
        });
        break;
      }
    }
  } catch (error) {
    console.error('[pauseSchedule] Error:', error);
  }
}

/**
 * Resume scheduled execution
 */
export async function resumeSchedule(scheduleId: string): Promise<void> {
  console.log('[OrchestratorSchedulingService] resumeSchedule called with:', {
    scheduleId,
  });

  try {
    const records = await prisma.orchestratorMemory.findMany({
      where: { memoryType: 'scheduled_execution' },
      select: { id: true, content: true },
    });

    for (const record of records) {
      let parsed: any;
      try {
        parsed =
          typeof record.content === 'string'
            ? JSON.parse(record.content)
            : record.content;
      } catch {
        continue;
      }

      if (parsed?.scheduleId === scheduleId && parsed?.status === 'paused') {
        const nextRunAt = computeNextRunAt(parsed.config);
        const updated = {
          ...parsed,
          status: 'active',
          nextRunAt: nextRunAt.toISOString(),
          resumedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await prisma.orchestratorMemory.update({
          where: { id: record.id },
          data: {
            content: JSON.stringify(updated),
            metadata: {
              scheduleId,
              status: 'active',
              nextRunAt: nextRunAt.toISOString(),
            } as never,
          },
        });
        break;
      }
    }
  } catch (error) {
    console.error('[resumeSchedule] Error:', error);
  }
}

// ============================================================================
// RECURRING TASKS
// ============================================================================

/**
 * Add a recurring task
 */
export async function addRecurringTask(
  orchestratorId: string,
  taskData: {
    name: string;
    cronExpression: string;
    taskConfig: Record<string, unknown>;
  }
): Promise<{ id: string; nextRunAt: Date }> {
  console.log('[OrchestratorSchedulingService] addRecurringTask called with:', {
    orchestratorId,
    taskData,
  });

  try {
    const id = `recurring_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nextRunAt = new Date(Date.now() + 3600000);

    await prisma.orchestratorMemory.create({
      data: {
        orchestratorId,
        memoryType: 'recurring_task',
        content: JSON.stringify({
          id,
          orchestratorId,
          name: taskData.name,
          cronExpression: taskData.cronExpression,
          taskConfig: taskData.taskConfig,
          nextRunAt: nextRunAt.toISOString(),
          status: 'active',
          createdAt: new Date().toISOString(),
        }),
        importance: 0.85,
        metadata: {
          recurringTaskId: id,
          name: taskData.name,
          cronExpression: taskData.cronExpression,
        } as never,
      },
    });

    return { id, nextRunAt };
  } catch (error) {
    console.error('[addRecurringTask] Error:', error);
    return {
      id: `recurring_${Date.now()}`,
      nextRunAt: new Date(Date.now() + 3600000),
    };
  }
}

/**
 * Remove a recurring task
 */
export async function removeRecurringTask(
  orchestratorId: string,
  taskIndex: number
): Promise<any[]> {
  console.log(
    '[OrchestratorSchedulingService] removeRecurringTask called with:',
    {
      orchestratorId,
      taskIndex,
    }
  );

  try {
    const records = await prisma.orchestratorMemory.findMany({
      where: {
        orchestratorId,
        memoryType: 'recurring_task',
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, content: true },
    });

    if (taskIndex >= 0 && taskIndex < records.length) {
      await prisma.orchestratorMemory.delete({
        where: { id: records[taskIndex].id },
      });
    }

    // Return remaining tasks
    const remaining = records
      .filter((_, idx) => idx !== taskIndex)
      .map(r => {
        try {
          return typeof r.content === 'string'
            ? JSON.parse(r.content)
            : r.content;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return remaining;
  } catch (error) {
    console.error('[removeRecurringTask] Error:', error);
    return [];
  }
}

/**
 * Get all recurring tasks for an orchestrator
 */
export async function getRecurringTasks(
  orchestratorId: string
): Promise<any[]> {
  console.log(
    '[OrchestratorSchedulingService] getRecurringTasks called with:',
    {
      orchestratorId,
    }
  );

  try {
    const records = await prisma.orchestratorMemory.findMany({
      where: {
        orchestratorId,
        memoryType: 'recurring_task',
      },
      orderBy: { createdAt: 'asc' },
      select: { content: true },
    });

    return records
      .map(r => {
        try {
          return typeof r.content === 'string'
            ? JSON.parse(r.content)
            : r.content;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    console.error('[getRecurringTasks] Error:', error);
    return [];
  }
}

// ============================================================================
// WORK SCHEDULE MANAGEMENT
// ============================================================================

/**
 * Get work schedule for an orchestrator
 */
export async function getWorkSchedule(orchestratorId: string): Promise<any> {
  console.log('[OrchestratorSchedulingService] getWorkSchedule called with:', {
    orchestratorId,
  });

  try {
    const record = await prisma.orchestratorMemory.findFirst({
      where: {
        orchestratorId,
        memoryType: 'work_schedule',
      },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });

    if (record) {
      try {
        const parsed =
          typeof record.content === 'string'
            ? JSON.parse(record.content)
            : record.content;
        return parsed;
      } catch {
        // Fall through to default
      }
    }

    return {
      orchestratorId,
      workingHours: { start: '09:00', end: '17:00' },
      timezone: 'UTC',
      workDays: [1, 2, 3, 4, 5], // Monday to Friday
    };
  } catch (error) {
    console.error('[getWorkSchedule] Error:', error);
    return {
      orchestratorId,
      workingHours: { start: '09:00', end: '17:00' },
      timezone: 'UTC',
      workDays: [1, 2, 3, 4, 5],
    };
  }
}

/**
 * Update work schedule for an orchestrator
 */
export async function updateWorkSchedule(
  orchestratorId: string,
  schedule: {
    workingHours?: { start: string; end: string };
    timezone?: string;
    workDays?: number[];
  }
): Promise<any> {
  console.log(
    '[OrchestratorSchedulingService] updateWorkSchedule called with:',
    {
      orchestratorId,
      schedule,
    }
  );

  try {
    const existing = await getWorkSchedule(orchestratorId);
    const updated = {
      ...existing,
      ...schedule,
      orchestratorId,
      updatedAt: new Date().toISOString(),
    };

    const existingRecord = await prisma.orchestratorMemory.findFirst({
      where: {
        orchestratorId,
        memoryType: 'work_schedule',
      },
      select: { id: true },
    });

    if (existingRecord) {
      await prisma.orchestratorMemory.update({
        where: { id: existingRecord.id },
        data: {
          content: JSON.stringify(updated),
          metadata: {
            timezone: updated.timezone,
            workDays: updated.workDays,
          } as never,
        },
      });
    } else {
      await prisma.orchestratorMemory.create({
        data: {
          orchestratorId,
          memoryType: 'work_schedule',
          content: JSON.stringify(updated),
          importance: 0.7,
          metadata: {
            timezone: updated.timezone,
            workDays: updated.workDays,
          } as never,
        },
      });
    }

    return updated;
  } catch (error) {
    console.error('[updateWorkSchedule] Error:', error);
    return { orchestratorId, ...schedule };
  }
}

// ============================================================================
// CAPACITY MANAGEMENT
// ============================================================================

/**
 * Get current capacity for an orchestrator
 */
export async function getCapacity(orchestratorId: string): Promise<{
  current: number;
  max: number;
  available: number;
}> {
  console.log('[OrchestratorSchedulingService] getCapacity called with:', {
    orchestratorId,
  });

  try {
    // Current capacity = active/in-progress tasks
    const [activeTasks, config] = await Promise.all([
      prisma.task.count({
        where: {
          orchestratorId,
          status: 'IN_PROGRESS',
        },
      }),
      prisma.orchestratorConfig.findUnique({
        where: { orchestratorId },
        select: { maxDailyActions: true },
      }),
    ]);

    const max = config?.maxDailyActions ?? 20;
    const current = activeTasks;
    const available = Math.max(0, max - current);

    return { current, max, available };
  } catch (error) {
    console.error('[getCapacity] Error:', error);
    return { current: 5, max: 20, available: 15 };
  }
}

/**
 * Update capacity for an orchestrator
 */
export async function updateCapacity(
  orchestratorId: string,
  capacity: { max?: number; reserved?: number }
): Promise<void> {
  console.log('[OrchestratorSchedulingService] updateCapacity called with:', {
    orchestratorId,
    capacity,
  });

  try {
    if (capacity.max !== undefined) {
      const existing = await prisma.orchestratorConfig.findUnique({
        where: { orchestratorId },
        select: { id: true },
      });

      if (existing) {
        await prisma.orchestratorConfig.update({
          where: { orchestratorId },
          data: { maxDailyActions: capacity.max },
        });
      }
      // If no config record exists, silently skip — config is optional
    }
  } catch (error) {
    console.error('[updateCapacity] Error:', error);
  }
}

/**
 * Check availability for a time slot
 */
export async function checkAvailability(
  orchestratorId: string,
  timeSlot: { start: Date; end: Date }
): Promise<{ available: boolean; conflicts?: string[] }> {
  console.log(
    '[OrchestratorSchedulingService] checkAvailability called with:',
    {
      orchestratorId,
      timeSlot,
    }
  );

  try {
    // Look for existing scheduled executions that overlap with the requested slot
    const records = await prisma.orchestratorMemory.findMany({
      where: {
        orchestratorId,
        memoryType: 'scheduled_execution',
      },
      select: { content: true },
    });

    const conflicts: string[] = [];
    const slotStart = new Date(timeSlot.start).getTime();
    const slotEnd = new Date(timeSlot.end).getTime();

    for (const record of records) {
      let parsed: any;
      try {
        parsed =
          typeof record.content === 'string'
            ? JSON.parse(record.content)
            : record.content;
      } catch {
        continue;
      }

      if (parsed?.status !== 'active') continue;

      const runAt = parsed?.nextRunAt
        ? new Date(parsed.nextRunAt).getTime()
        : null;

      if (runAt !== null && runAt >= slotStart && runAt <= slotEnd) {
        conflicts.push(parsed.scheduleId);
      }
    }

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  } catch (error) {
    console.error('[checkAvailability] Error:', error);
    return { available: true };
  }
}

/**
 * Reserve a time slot
 */
export async function reserveTimeSlot(
  orchestratorId: string,
  timeSlot: { start: Date; end: Date; taskId: string }
): Promise<{ reservationId: string }> {
  console.log('[OrchestratorSchedulingService] reserveTimeSlot called with:', {
    orchestratorId,
    timeSlot,
  });

  try {
    const reservationId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await prisma.orchestratorMemory.create({
      data: {
        orchestratorId,
        memoryType: 'time_slot_reservation',
        content: JSON.stringify({
          reservationId,
          orchestratorId,
          taskId: timeSlot.taskId,
          start: new Date(timeSlot.start).toISOString(),
          end: new Date(timeSlot.end).toISOString(),
          createdAt: new Date().toISOString(),
        }),
        importance: 0.75,
        metadata: {
          reservationId,
          taskId: timeSlot.taskId,
        } as never,
      },
    });

    return { reservationId };
  } catch (error) {
    console.error('[reserveTimeSlot] Error:', error);
    return { reservationId: `res_${Date.now()}` };
  }
}
