/**
 * Presence Validation Schemas
 * @module lib/validations/presence
 */

import { z } from 'zod';

export const PRESENCE_ERROR_CODES = {
  INVALID_STATUS: 'PRESENCE_INVALID_STATUS',
  USER_NOT_FOUND: 'PRESENCE_USER_NOT_FOUND',
  UPDATE_FAILED: 'PRESENCE_UPDATE_FAILED',
  TIMEOUT: 'PRESENCE_TIMEOUT',
  UNAUTHORIZED: 'PRESENCE_UNAUTHORIZED',
  VALIDATION_ERROR: 'PRESENCE_VALIDATION_ERROR',
  FORBIDDEN: 'PRESENCE_FORBIDDEN',
  ORCHESTRATOR_NOT_FOUND: 'PRESENCE_ORCHESTRATOR_NOT_FOUND',
  INTERNAL_ERROR: 'PRESENCE_INTERNAL_ERROR',
  RATE_LIMITED: 'PRESENCE_RATE_LIMITED',
  CHANNEL_NOT_FOUND: 'PRESENCE_CHANNEL_NOT_FOUND',
} as const;

export type PresenceErrorCode =
  (typeof PRESENCE_ERROR_CODES)[keyof typeof PRESENCE_ERROR_CODES];

export const presenceStatusSchema = z.enum([
  'online',
  'away',
  'busy',
  'offline',
  'do_not_disturb',
]);

// Inferred type from presenceStatusSchema
export type PresenceStatusType = z.infer<typeof presenceStatusSchema>;

export const presenceSchema = z.object({
  userId: z.string(),
  status: presenceStatusSchema,
  lastSeen: z.string().datetime(),
  currentLocation: z
    .object({
      workspaceId: z.string().optional(),
      taskId: z.string().optional(),
      conversationId: z.string().optional(),
    })
    .optional(),
  customStatus: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
  isOnline: z.boolean().optional(),
});

export const updatePresenceSchema = presenceSchema
  .partial()
  .required({ userId: true });

export const presenceActivitySchema = z.object({
  userId: z.string(),
  type: z.enum(['typing', 'viewing', 'editing', 'idle']),
  resourceId: z.string().optional(),
  timestamp: z.string().datetime(),
});

export const presenceSubscriptionSchema = z.object({
  subscriberId: z.string(),
  targetUserIds: z.array(z.string()),
  workspaceId: z.string().optional(),
  events: z.array(z.enum(['status_change', 'activity', 'location_change'])),
});

// Batch presence schema for updating multiple presences
export const batchPresenceSchema = z.object({
  updates: z.array(updatePresenceSchema),
  userIds: z.array(z.string()).optional(),
});

// Batch presence query schema
export const batchPresenceQuerySchema = z.object({
  userIds: z.array(z.string()),
});

export type BatchPresenceInput = z.infer<typeof batchPresenceQuerySchema>;

// Channel ID parameter schema
export const channelIdParamSchema = z.object({
  channelId: z.string(),
});

// Heartbeat schema for maintaining presence
export const heartbeatSchema = z.object({
  userId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  channelId: z.string().optional(),
});

// Orchestrator ID parameter schema
export const orchestratorIdParamSchema = z.object({
  orchestratorId: z.string(),
});

// Organization ID query schema
export const organizationIdQuerySchema = z.object({
  organizationId: z.string(),
});

// Set status schema
export const setStatusSchema = z.object({
  userId: z.string().optional(),
  status: presenceStatusSchema,
  customStatus: z.string().max(100).optional(),
});

// Inferred input types
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
export type SetStatusInput = z.infer<typeof setStatusSchema>;

// Response types for API routes
export type UserPresenceResponse = z.infer<typeof presenceSchema>;
export type ChannelPresenceResponse = {
  channelId: string;
  presence: UserPresenceResponse[];
  totalOnline?: number;
};
export type OrchestratorPresenceResponse = {
  orchestratorId: string;
  userId: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';
  lastActivity: string | null;
  isHealthy: boolean;
  messageCount: number;
};

// Stream query schema
export const streamQuerySchema = z.object({
  stream: z.boolean().optional().default(false),
  channelIds: z.array(z.string()).optional(),
  userIds: z.array(z.string()).optional(),
});

// User ID parameter schema
export const userIdParamSchema = z.object({
  userId: z.string(),
});

// Create presence error response helper
export const createPresenceErrorResponse = (
  message: string,
  code: PresenceErrorCode,
  details?: Record<string, unknown>
) => ({
  error: {
    code,
    message,
    details,
  },
});
