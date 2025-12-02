/**
 * Orchestrator Scheduling Validation Schemas
 * @module lib/validations/orchestrator-scheduling
 */

import { z } from 'zod';

export const ORCHESTRATOR_SCHEDULING_ERROR_CODES = {
  INVALID_SCHEDULE: 'SCHEDULING_INVALID_SCHEDULE',
  SCHEDULE_CONFLICT: 'SCHEDULING_CONFLICT',
  NO_AVAILABLE_AGENTS: 'SCHEDULING_NO_AGENTS',
  PRIORITY_VIOLATION: 'SCHEDULING_PRIORITY_VIOLATION',
  DEADLINE_MISSED: 'SCHEDULING_DEADLINE_MISSED',
} as const;

export type OrchestratorSchedulingErrorCode =
  (typeof ORCHESTRATOR_SCHEDULING_ERROR_CODES)[keyof typeof ORCHESTRATOR_SCHEDULING_ERROR_CODES];

export const schedulingStrategySchema = z.enum([
  'fifo',
  'lifo',
  'priority',
  'deadline',
  'shortest_job_first',
  'round_robin',
]);

export const taskScheduleSchema = z.object({
  taskId: z.string(),
  priority: z.number().min(0).max(10),
  scheduledAt: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),
  estimatedDuration: z.number().positive().optional(),
  dependencies: z.array(z.string()).optional(),
  constraints: z.record(z.unknown()).optional(),
});

export const schedulerConfigSchema = z.object({
  strategy: schedulingStrategySchema,
  maxQueueSize: z.number().positive(),
  preemptionEnabled: z.boolean(),
  fairnessWeight: z.number().min(0).max(1).optional(),
  defaultPriority: z.number().min(0).max(10),
});

export const schedulingEventSchema = z.object({
  type: z.enum([
    'queued',
    'scheduled',
    'started',
    'completed',
    'failed',
    'cancelled',
  ]),
  taskId: z.string(),
  agentId: z.string().optional(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export const queueStatsSchema = z.object({
  queuedTasks: z.number().nonnegative(),
  runningTasks: z.number().nonnegative(),
  completedTasks: z.number().nonnegative(),
  failedTasks: z.number().nonnegative(),
  averageWaitTime: z.number().nonnegative(),
  averageExecutionTime: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

export const SCHEDULING_ERROR_CODES = {
  INVALID_AVAILABILITY: 'SCHEDULING_INVALID_AVAILABILITY',
  TIME_SLOT_CONFLICT: 'SCHEDULING_TIME_SLOT_CONFLICT',
  CAPACITY_EXCEEDED: 'SCHEDULING_CAPACITY_EXCEEDED',
  INVALID_RECURRENCE: 'SCHEDULING_INVALID_RECURRENCE',
  INVALID_TIME_ESTIMATE: 'SCHEDULING_INVALID_TIME_ESTIMATE',
  WORK_SCHEDULE_CONFLICT: 'SCHEDULING_WORK_SCHEDULE_CONFLICT',
  INVALID_TIME_RANGE: 'SCHEDULING_INVALID_TIME_RANGE',
} as const;

export type SchedulingErrorCode =
  (typeof SCHEDULING_ERROR_CODES)[keyof typeof SCHEDULING_ERROR_CODES];

export const checkAvailabilitySchema = z.object({
  agentId: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  taskType: z.string().optional(),
  requiredCapacity: z.number().positive().optional(),
});

export const createRecurringTaskSchema = z.object({
  name: z.string().min(1, 'Task name is required'),
  cronExpression: z.string().min(1, 'Cron expression is required'),
  taskConfig: z.record(z.unknown()).default({}),
});

export const getCapacitySchema = z.object({
  includeMetrics: z
    .string()
    .optional()
    .transform(val => val === 'true'),
});

export const getTimeEstimatesSchema = z.object({
  taskType: z.string().optional(),
  agentId: z.string().optional(),
  limit: z.coerce.number().positive().default(10),
  includeHistorical: z.boolean().default(true),
  includeMetrics: z.boolean().default(false),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

export const getWorkScheduleSchema = z.object({
  detailed: z
    .string()
    .optional()
    .transform(val => val === 'true'),
});

export const recordTimeEstimateSchema = z.object({
  taskId: z.string(),
  taskType: z.string(),
  estimatedDuration: z.number().positive(),
  actualDuration: z.number().positive().optional(),
  agentId: z.string().optional(),
  accuracy: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
  estimatedHours: z.number().positive().optional(),
  actualHours: z.number().positive().optional(),
  completedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const reserveTimeSlotSchema = z.object({
  agentId: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  taskId: z.string(),
  priority: z.number().min(0).max(10).default(5),
  allowOverlap: z.boolean().default(false),
  durationMinutes: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateCapacitySchema = z.object({
  max: z.number().positive().optional(),
  reserved: z.number().nonnegative().optional(),
});

export const updateWorkScheduleSchema = z.object({
  workingHours: z
    .object({
      start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    })
    .optional(),
  timezone: z.string().optional(),
  workDays: z.array(z.number().min(0).max(6)).optional(),
});
