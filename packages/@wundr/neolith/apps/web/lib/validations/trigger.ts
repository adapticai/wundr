/**
 * Workflow Trigger Validation Schemas
 *
 * @module lib/validations/trigger
 */

import { z } from 'zod';

/**
 * Webhook trigger configuration schema
 */
export const webhookTriggerConfigSchema = z.object({
  url: z.string().url().optional(),
  token: z.string().optional(),
  secret: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  headers: z.record(z.string()).optional(),
  requireSignature: z.boolean().default(true),
});

export type WebhookTriggerConfig = z.infer<typeof webhookTriggerConfigSchema>;

/**
 * Schedule trigger configuration schema
 */
export const scheduleTriggerConfigSchema = z.object({
  cron: z.string().min(1, 'Cron expression is required'),
  timezone: z.string().default('UTC'),
  enabled: z.boolean().default(true),
  nextRun: z.date().optional(),
  lastRun: z.date().optional(),
});

export type ScheduleTriggerConfig = z.infer<typeof scheduleTriggerConfigSchema>;

/**
 * Event trigger configuration schema
 */
export const eventTriggerConfigSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  filters: z.record(z.unknown()).optional(),
  conditions: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum([
          'equals',
          'not_equals',
          'contains',
          'not_contains',
          'greater_than',
          'less_than',
          'exists',
          'not_exists',
          'in',
          'not_in',
        ]),
        value: z
          .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
          .optional(),
      }),
    )
    .optional(),
});

export type EventTriggerConfig = z.infer<typeof eventTriggerConfigSchema>;

/**
 * Trigger webhook request schema
 */
export const triggerWebhookSchema = z.object({
  token: z.string().min(1, 'Webhook token is required'),
  data: z.record(z.unknown()).optional(),
  signature: z.string().optional(),
  timestamp: z.number().optional(),
});

export type TriggerWebhookInput = z.infer<typeof triggerWebhookSchema>;

/**
 * Trigger with API key schema
 */
export const triggerWithApiKeySchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  data: z.record(z.unknown()).optional(),
  dryRun: z.boolean().optional(),
});

export type TriggerWithApiKeyInput = z.infer<typeof triggerWithApiKeySchema>;

/**
 * Create trigger configuration schema
 */
export const createTriggerConfigSchema = z.object({
  type: z.enum(['webhook', 'schedule', 'event', 'manual']),
  enabled: z.boolean().default(true),
  config: z.union([
    webhookTriggerConfigSchema,
    scheduleTriggerConfigSchema,
    eventTriggerConfigSchema,
    z.record(z.unknown()),
  ]),
  rateLimit: z
    .object({
      maxRequests: z.number().int().positive(),
      windowMs: z.number().int().positive(),
    })
    .optional(),
});

export type CreateTriggerConfigInput = z.infer<typeof createTriggerConfigSchema>;

/**
 * Update trigger configuration schema
 */
export const updateTriggerConfigSchema = createTriggerConfigSchema.partial();

export type UpdateTriggerConfigInput = z.infer<typeof updateTriggerConfigSchema>;

/**
 * Trigger log filters schema
 */
export const triggerLogFiltersSchema = z.object({
  status: z.enum(['success', 'failure', 'rate_limited', 'unauthorized']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type TriggerLogFiltersInput = z.infer<typeof triggerLogFiltersSchema>;

/**
 * Trigger history entry
 */
export interface TriggerHistoryEntry {
  id: string;
  workflowId: string;
  triggerType: 'webhook' | 'schedule' | 'event' | 'api' | 'manual';
  status: 'success' | 'failure' | 'rate_limited' | 'unauthorized';
  data: Record<string, unknown>;
  error?: string;
  executionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  duration?: number;
}
