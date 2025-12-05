/**
 * Status and Availability Validation Schemas
 * @module lib/validations/status
 */

import { z } from 'zod';

export const STATUS_LIMITS = {
  MESSAGE_MAX: 100,
  AUTO_REPLY_MAX: 500,
} as const;

export const STATUS_TYPES = [
  'available',
  'busy',
  'away',
  'dnd', // Do Not Disturb
] as const;

export type StatusType = (typeof STATUS_TYPES)[number];

/**
 * Status update schema
 */
export const statusUpdateSchema = z.object({
  emoji: z.string().min(1, 'Emoji is required').max(10),
  message: z
    .string()
    .max(STATUS_LIMITS.MESSAGE_MAX, {
      message: `Status message must be at most ${STATUS_LIMITS.MESSAGE_MAX} characters`,
    })
    .optional()
    .or(z.literal('')),
  type: z.enum(STATUS_TYPES),
  expiresAt: z.string().datetime().optional().nullable(),
  clearAt: z.number().optional(), // minutes until clear
});

export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;

/**
 * Working hours schema
 */
export const workingHoursSchema = z.object({
  enabled: z.boolean(),
  timezone: z.string(),
  monday: z
    .object({
      enabled: z.boolean(),
      start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    })
    .optional(),
  tuesday: z
    .object({
      enabled: z.boolean(),
      start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    })
    .optional(),
  wednesday: z
    .object({
      enabled: z.boolean(),
      start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    })
    .optional(),
  thursday: z
    .object({
      enabled: z.boolean(),
      start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    })
    .optional(),
  friday: z
    .object({
      enabled: z.boolean(),
      start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    })
    .optional(),
  saturday: z
    .object({
      enabled: z.boolean(),
      start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    })
    .optional(),
  sunday: z
    .object({
      enabled: z.boolean(),
      start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    })
    .optional(),
});

export type WorkingHoursInput = z.infer<typeof workingHoursSchema>;

/**
 * Out of office schema
 */
export const outOfOfficeSchema = z.object({
  enabled: z.boolean(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  autoReply: z
    .string()
    .max(STATUS_LIMITS.AUTO_REPLY_MAX, {
      message: `Auto-reply must be at most ${STATUS_LIMITS.AUTO_REPLY_MAX} characters`,
    })
    .optional()
    .or(z.literal('')),
  forwardTo: z.string().email().optional().or(z.literal('')),
});

export type OutOfOfficeInput = z.infer<typeof outOfOfficeSchema>;

/**
 * Scheduled status change schema
 */
export const scheduledStatusSchema = z.object({
  id: z.string().optional(),
  emoji: z.string().min(1).max(10),
  message: z
    .string()
    .max(STATUS_LIMITS.MESSAGE_MAX)
    .optional()
    .or(z.literal('')),
  type: z.enum(STATUS_TYPES),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional().nullable(),
  recurring: z
    .object({
      enabled: z.boolean(),
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      days: z.array(z.number().min(0).max(6)).optional(), // 0 = Sunday
    })
    .optional(),
});

export type ScheduledStatusInput = z.infer<typeof scheduledStatusSchema>;

/**
 * Availability settings schema
 */
export const availabilitySettingsSchema = z.object({
  workingHours: workingHoursSchema.optional(),
  outOfOffice: outOfOfficeSchema.optional(),
  scheduledStatuses: z.array(scheduledStatusSchema).optional(),
  workspaceVisibility: z.record(z.string(), z.boolean()).optional(),
});

export type AvailabilitySettingsInput = z.infer<
  typeof availabilitySettingsSchema
>;
