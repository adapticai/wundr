/**
 * VP Scheduling Validation Schemas
 *
 * Zod validation schemas for VP scheduling and work rhythm operations.
 * These schemas ensure type safety and input validation for scheduling endpoints.
 *
 * @module lib/validations/vp-scheduling
 */

import { z } from 'zod';

/**
 * Day of week enum
 */
export const dayOfWeekEnum = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);
export type DayOfWeek = z.infer<typeof dayOfWeekEnum>;

/**
 * Recurring task frequency enum
 */
export const recurringFrequencyEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);
export type RecurringFrequency = z.infer<typeof recurringFrequencyEnum>;

/**
 * Time slot schema (24-hour format)
 */
export const timeSlotSchema = z.object({
  /** Start hour (0-23) */
  startHour: z.number().int().min(0).max(23),
  /** Start minute (0-59) */
  startMinute: z.number().int().min(0).max(59),
  /** End hour (0-23) */
  endHour: z.number().int().min(0).max(23),
  /** End minute (0-59) */
  endMinute: z.number().int().min(0).max(59),
});

export type TimeSlot = z.infer<typeof timeSlotSchema>;

/**
 * Work schedule configuration schema
 */
export const workScheduleConfigSchema = z.object({
  /** Work hours per day */
  workHours: timeSlotSchema.optional(),
  /** Active work days */
  activeDays: z.array(dayOfWeekEnum).optional(),
  /** Timezone (e.g., "America/New_York") */
  timezone: z.string().optional(),
  /** Break times during the day */
  breakTimes: z.array(timeSlotSchema).optional(),
  /** Batch processing windows for heavy tasks */
  batchWindows: z.array(timeSlotSchema).optional(),
  /** Office hours when VP responds to mentions */
  officeHours: timeSlotSchema.optional(),
});

export type WorkScheduleConfig = z.infer<typeof workScheduleConfigSchema>;

/**
 * Schema for getting work schedule
 */
export const getWorkScheduleSchema = z.object({
  /** Include detailed breakdown */
  detailed: z.coerce.boolean().optional().default(false),
});

export type GetWorkScheduleInput = z.infer<typeof getWorkScheduleSchema>;

/**
 * Schema for updating work schedule
 */
export const updateWorkScheduleSchema = z.object({
  /** Work hours per day */
  workHours: timeSlotSchema.optional(),
  /** Active work days */
  activeDays: z.array(dayOfWeekEnum).min(1, 'At least one active day required').optional(),
  /** Timezone */
  timezone: z
    .string()
    .regex(/^[A-Za-z_]+\/[A-Za-z_]+$/, 'Invalid timezone format (e.g., America/New_York)')
    .optional(),
  /** Break times */
  breakTimes: z.array(timeSlotSchema).max(10, 'Maximum 10 break times allowed').optional(),
  /** Batch processing windows */
  batchWindows: z
    .array(timeSlotSchema)
    .max(5, 'Maximum 5 batch windows allowed')
    .optional(),
  /** Office hours */
  officeHours: timeSlotSchema.optional(),
});

export type UpdateWorkScheduleInput = z.infer<typeof updateWorkScheduleSchema>;

/**
 * Capacity configuration schema
 */
export const capacityConfigSchema = z.object({
  /** Maximum concurrent tasks */
  maxConcurrentTasks: z.number().int().min(1).max(50).optional(),
  /** Energy budget (arbitrary units per day) */
  energyBudget: z.number().int().min(1).max(1000).optional(),
  /** Current energy level */
  currentEnergy: z.number().int().min(0).optional(),
  /** Maximum task queue size */
  maxQueueSize: z.number().int().min(0).max(200).optional(),
});

export type CapacityConfig = z.infer<typeof capacityConfigSchema>;

/**
 * Schema for getting capacity
 */
export const getCapacitySchema = z.object({
  /** Include utilization metrics */
  includeMetrics: z.coerce.boolean().optional().default(true),
});

export type GetCapacityInput = z.infer<typeof getCapacitySchema>;

/**
 * Schema for updating capacity
 */
export const updateCapacitySchema = z.object({
  /** Maximum concurrent tasks */
  maxConcurrentTasks: z
    .number()
    .int()
    .min(1, 'Must allow at least 1 concurrent task')
    .max(50, 'Maximum 50 concurrent tasks allowed')
    .optional(),
  /** Energy budget */
  energyBudget: z
    .number()
    .int()
    .min(1, 'Energy budget must be at least 1')
    .max(1000, 'Energy budget cannot exceed 1000')
    .optional(),
  /** Maximum queue size */
  maxQueueSize: z.number().int().min(0).max(200).optional(),
});

export type UpdateCapacityInput = z.infer<typeof updateCapacitySchema>;

/**
 * Recurring task schema
 */
export const recurringTaskSchema = z.object({
  /** Task title */
  title: z.string().min(1, 'Title is required').max(200),
  /** Task description */
  description: z.string().max(2000).optional(),
  /** Recurrence frequency */
  frequency: recurringFrequencyEnum,
  /** Day of week for WEEKLY (required for weekly tasks) */
  dayOfWeek: dayOfWeekEnum.optional(),
  /** Day of month for MONTHLY (1-31, required for monthly tasks) */
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  /** Scheduled time of day */
  scheduledTime: z
    .object({
      hour: z.number().int().min(0).max(23),
      minute: z.number().int().min(0).max(59),
    })
    .optional(),
  /** Task priority */
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  /** Estimated hours */
  estimatedHours: z.number().int().min(1).max(100).optional(),
  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type RecurringTask = z.infer<typeof recurringTaskSchema>;

/**
 * Schema for creating recurring task
 */
export const createRecurringTaskSchema = recurringTaskSchema.refine(
  (data) => {
    // For WEEKLY tasks, dayOfWeek is required
    if (data.frequency === 'WEEKLY' && !data.dayOfWeek) {
      return false;
    }
    // For MONTHLY tasks, dayOfMonth is required
    if (data.frequency === 'MONTHLY' && !data.dayOfMonth) {
      return false;
    }
    return true;
  },
  {
    message: 'dayOfWeek required for WEEKLY tasks, dayOfMonth required for MONTHLY tasks',
  },
);

export type CreateRecurringTaskInput = z.infer<typeof createRecurringTaskSchema>;

/**
 * Schema for checking availability
 */
export const checkAvailabilitySchema = z.object({
  /** Start of time range to check */
  startTime: z.string().datetime('Invalid ISO 8601 datetime'),
  /** End of time range to check */
  endTime: z.string().datetime('Invalid ISO 8601 datetime'),
  /** Include available time slots */
  includeSlots: z.coerce.boolean().optional().default(false),
});

export type CheckAvailabilityInput = z.infer<typeof checkAvailabilitySchema>;

/**
 * Schema for reserving time slot
 */
export const reserveTimeSlotSchema = z.object({
  /** Task ID to reserve time for */
  taskId: z.string().cuid('Invalid task ID'),
  /** Start time */
  startTime: z.string().datetime('Invalid ISO 8601 datetime'),
  /** Duration in minutes */
  durationMinutes: z.number().int().min(1).max(480), // Max 8 hours
  /** Optional note */
  note: z.string().max(500).optional(),
});

export type ReserveTimeSlotInput = z.infer<typeof reserveTimeSlotSchema>;

/**
 * Schema for recording time estimates
 */
export const recordTimeEstimateSchema = z.object({
  /** Task ID */
  taskId: z.string().cuid('Invalid task ID'),
  /** Estimated time in hours */
  estimatedHours: z.number().positive(),
  /** Actual time in hours */
  actualHours: z.number().positive(),
  /** Completion timestamp */
  completedAt: z.string().datetime('Invalid ISO 8601 datetime').optional(),
  /** Additional context */
  notes: z.string().max(1000).optional(),
});

export type RecordTimeEstimateInput = z.infer<typeof recordTimeEstimateSchema>;

/**
 * Schema for getting time estimates
 */
export const getTimeEstimatesSchema = z.object({
  /** Limit number of results */
  limit: z.coerce.number().int().positive().max(100).default(50),
  /** Include accuracy metrics */
  includeMetrics: z.coerce.boolean().optional().default(true),
  /** Filter by time range */
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

export type GetTimeEstimatesInput = z.infer<typeof getTimeEstimatesSchema>;

/**
 * Common error codes for scheduling API
 */
export const SCHEDULING_ERROR_CODES = {
  TIME_SLOT_CONFLICT: 'TIME_SLOT_CONFLICT',
  INVALID_SCHEDULE: 'INVALID_SCHEDULE',
  CAPACITY_EXCEEDED: 'CAPACITY_EXCEEDED',
  RECURRING_TASK_EXISTS: 'RECURRING_TASK_EXISTS',
  INVALID_TIME_RANGE: 'INVALID_TIME_RANGE',
  TIMEZONE_ERROR: 'TIMEZONE_ERROR',
} as const;

export type SchedulingErrorCode =
  (typeof SCHEDULING_ERROR_CODES)[keyof typeof SCHEDULING_ERROR_CODES];
