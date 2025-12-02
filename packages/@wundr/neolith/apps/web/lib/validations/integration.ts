/**
 * Integration Validation Schemas
 * @module lib/validations/integration
 */

import { z } from 'zod';

export const INTEGRATION_ERROR_CODES = {
  INVALID_CONFIG: 'INTEGRATION_INVALID_CONFIG',
  CONNECTION_FAILED: 'INTEGRATION_CONNECTION_FAILED',
  AUTH_FAILED: 'INTEGRATION_AUTH_FAILED',
  INVALID_PROVIDER: 'INTEGRATION_INVALID_PROVIDER',
  MISSING_CREDENTIALS: 'INTEGRATION_MISSING_CREDENTIALS',
  SYNC_FAILED: 'INTEGRATION_SYNC_FAILED',
  INTEGRATION_OAUTH_FAILED: 'INTEGRATION_OAUTH_FAILED',
  OAUTH_PROVIDER_ERROR: 'OAUTH_PROVIDER_ERROR',
  WEBHOOK_NOT_FOUND: 'WEBHOOK_NOT_FOUND',
  WEBHOOK_SECRET_MISMATCH: 'WEBHOOK_SECRET_MISMATCH',
  WEBHOOK_DELIVERY_FAILED: 'WEBHOOK_DELIVERY_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  INTEGRATION_NOT_FOUND: 'INTEGRATION_NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type IntegrationErrorCode =
  (typeof INTEGRATION_ERROR_CODES)[keyof typeof INTEGRATION_ERROR_CODES];

export const integrationProviderSchema = z.enum([
  'github',
  'gitlab',
  'slack',
  'discord',
  'jira',
  'linear',
  'notion',
  'custom',
]);

export const integrationSchema = z.object({
  id: z.string(),
  provider: integrationProviderSchema,
  name: z.string(),
  status: z.enum(['connected', 'disconnected', 'error', 'pending']),
  config: z.record(z.unknown()),
  credentials: z.record(z.string()).optional(),
  lastSyncAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createIntegrationSchema = integrationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true,
});

export const integrationWebhookSchema = z.object({
  event: z.string(),
  payload: z.record(z.unknown()),
  signature: z.string().optional(),
  timestamp: z.string().datetime(),
});

export const integrationSyncSchema = z.object({
  integrationId: z.string(),
  resources: z.array(z.string()).optional(),
  fullSync: z.boolean().optional(),
});

export const integrationFiltersSchema = z.object({
  provider: integrationProviderSchema.optional(),
  status: z.enum(['connected', 'disconnected', 'error', 'pending']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z
    .enum([
      'name',
      'provider',
      'status',
      'createdAt',
      'updatedAt',
      'lastSyncAt',
    ])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type IntegrationFiltersInput = z.infer<typeof integrationFiltersSchema>;

export const updateIntegrationSchema = integrationSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial();

export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;

// =============================================================================
// WEBHOOK SCHEMAS
// =============================================================================

/**
 * Webhook filters schema
 */
export const webhookFiltersSchema = z.object({
  status: z.enum(['active', 'inactive', 'error']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z
    .enum(['name', 'createdAt', 'updatedAt', 'lastTriggered'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type WebhookFiltersInput = z.infer<typeof webhookFiltersSchema>;

/**
 * Create webhook schema
 */
export const createWebhookSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url('Must be a valid URL'),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  secret: z.string().optional(),
  active: z.boolean().default(true),
  headers: z.record(z.string()).optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

/**
 * Update webhook schema
 */
export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url('Must be a valid URL').optional(),
  events: z.array(z.string()).optional(),
  secret: z.string().optional(),
  active: z.boolean().optional(),
  headers: z.record(z.string()).optional(),
});

export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

/**
 * Webhook delivery filters schema
 */
export const webhookDeliveryFiltersSchema = z.object({
  status: z.enum(['pending', 'success', 'failed']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type WebhookDeliveryFiltersInput = z.infer<
  typeof webhookDeliveryFiltersSchema
>;
