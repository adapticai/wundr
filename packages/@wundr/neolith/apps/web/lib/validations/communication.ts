import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const communicationChannelEnum = z.enum([
  'email',
  'sms',
  'whatsapp',
  'voice',
  'slack',
  'internal',
]);

export const communicationDirectionEnum = z.enum(['inbound', 'outbound']);

export const communicationStatusEnum = z.enum([
  'pending',
  'sent',
  'delivered',
  'failed',
  'bounced',
]);

export const notificationLevelEnum = z.enum([
  'all',
  'mentions',
  'urgent',
  'none',
]);

// ============================================================================
// Communication Log Schemas
// ============================================================================

export const createCommunicationLogSchema = z.object({
  orchestratorId: z.string().min(1),
  channel: communicationChannelEnum,
  direction: communicationDirectionEnum,
  recipientAddress: z.string().min(1).max(500),
  senderAddress: z.string().min(1).max(500),
  subject: z.string().max(500).optional(),
  content: z.string().min(1).max(50000),
  externalId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateCommunicationLogSchema = z.object({
  status: communicationStatusEnum.optional(),
  externalId: z.string().optional(),
  sentAt: z.string().datetime().optional(),
  deliveredAt: z.string().datetime().optional(),
  errorMessage: z.string().optional(),
});

export const communicationLogFilterSchema = z.object({
  orchestratorId: z.string().optional(),
  channel: communicationChannelEnum.optional(),
  direction: communicationDirectionEnum.optional(),
  status: communicationStatusEnum.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'sentAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const communicationLogResponseSchema = z.object({
  id: z.string(),
  orchestratorId: z.string(),
  channel: communicationChannelEnum,
  direction: communicationDirectionEnum,
  externalId: z.string().nullable(),
  recipientAddress: z.string(),
  senderAddress: z.string(),
  subject: z.string().nullable(),
  content: z.string(),
  status: communicationStatusEnum,
  metadata: z.record(z.unknown()),
  sentAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
});

// ============================================================================
// Communication Preferences Schemas
// ============================================================================

export const channelPreferenceSchema = z.object({
  channel: communicationChannelEnum,
  enabled: z.boolean(),
  notificationLevel: notificationLevelEnum,
  address: z.string().optional(),
});

export const updateCommunicationPreferenceSchema = z.object({
  channelRanking: z.array(communicationChannelEnum).optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  slackEnabled: z.boolean().optional(),
  internalEnabled: z.boolean().optional(),
  notificationRules: z.record(notificationLevelEnum).optional(),
});

export const communicationPreferenceResponseSchema = z.object({
  id: z.string(),
  orchestratorId: z.string(),
  channelRanking: z.array(communicationChannelEnum),
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
  voiceEnabled: z.boolean(),
  slackEnabled: z.boolean(),
  internalEnabled: z.boolean(),
  notificationRules: z.record(z.unknown()),
});

// ============================================================================
// Communication Stats Schema
// ============================================================================

export const communicationStatsFilterSchema = z.object({
  orchestratorId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const communicationStatsResponseSchema = z.object({
  totalMessages: z.number().int(),
  byChannel: z.record(z.number().int()),
  byDirection: z.record(z.number().int()),
  byStatus: z.record(z.number().int()),
  deliveryRate: z.number().min(0).max(1),
  averageDeliveryTimeMs: z.number().nullable(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateCommunicationLogInput = z.infer<
  typeof createCommunicationLogSchema
>;
export type UpdateCommunicationLogInput = z.infer<
  typeof updateCommunicationLogSchema
>;
export type CommunicationLogFilterInput = z.infer<
  typeof communicationLogFilterSchema
>;
export type UpdateCommunicationPreferenceInput = z.infer<
  typeof updateCommunicationPreferenceSchema
>;
export type CommunicationStatsFilterInput = z.infer<
  typeof communicationStatsFilterSchema
>;

// ============================================================================
// Error Codes & Helpers
// ============================================================================

export const COMMUNICATION_ERROR_CODES = {
  UNAUTHORIZED: 'COMMUNICATION_UNAUTHORIZED',
  VALIDATION_ERROR: 'COMMUNICATION_VALIDATION_ERROR',
  LOG_NOT_FOUND: 'COMMUNICATION_LOG_NOT_FOUND',
  PREFERENCE_NOT_FOUND: 'COMMUNICATION_PREFERENCE_NOT_FOUND',
  DELIVERY_FAILED: 'COMMUNICATION_DELIVERY_FAILED',
  CHANNEL_NOT_CONFIGURED: 'COMMUNICATION_CHANNEL_NOT_CONFIGURED',
  INTERNAL_ERROR: 'COMMUNICATION_INTERNAL_ERROR',
} as const;

export function createErrorResponse(
  message: string,
  code: string,
  details?: Record<string, unknown>
) {
  return { error: { message, code, ...(details && { details }) } };
}

// Param schemas
export const logIdParamSchema = z.object({
  logId: z.string().min(1),
});
