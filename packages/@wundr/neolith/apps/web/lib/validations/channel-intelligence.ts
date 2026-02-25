/**
 * Channel Intelligence Validation Schemas
 *
 * Zod validation schemas for Orchestrator channel intelligence operations.
 * These schemas ensure type safety for channel recommendations,
 * activity tracking, and relevance scoring.
 *
 * @module lib/validations/channel-intelligence
 */

import { z } from 'zod';

/**
 * Channel activity event types
 */
export const channelActivityEventEnum = z.enum([
  'message_sent',
  'task_created',
  'task_completed',
  'joined_channel',
  'left_channel',
  'mentioned',
  'reacted',
]);

export type ChannelActivityEventType = z.infer<typeof channelActivityEventEnum>;

/**
 * Schema for tracking Orchestrator channel activity
 */
export const trackChannelActivitySchema = z.object({
  /** Type of activity event */
  eventType: channelActivityEventEnum,

  /** Optional metadata about the event */
  metadata: z.record(z.unknown()).optional(),

  /** Timestamp of the event (defaults to now) */
  timestamp: z.string().datetime().optional(),
});

export type TrackChannelActivityInput = z.infer<
  typeof trackChannelActivitySchema
>;

/**
 * Schema for Orchestrator channel membership filters
 */
export const vpChannelFiltersSchema = z.object({
  /** Include archived channels */
  includeArchived: z.coerce.boolean().optional().default(false),

  /** Filter by channel type */
  channelType: z.enum(['PUBLIC', 'PRIVATE', 'DM', 'HUDDLE']).optional(),

  /** Only return active memberships (not left) */
  activeOnly: z.coerce.boolean().optional().default(true),

  /** Pagination: page number (1-indexed) */
  page: z.coerce.number().int().positive().default(1),

  /** Pagination: items per page */
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type VPChannelFiltersInput = z.infer<typeof vpChannelFiltersSchema>;

/**
 * Schema for auto-joining Orchestrator to channels
 */
export const autoJoinChannelsSchema = z.object({
  /** Minimum relevance score (0-1) to auto-join */
  minRelevanceScore: z.number().min(0).max(1).optional().default(0.7),

  /** Maximum number of channels to join */
  maxChannels: z.number().int().positive().max(20).optional().default(5),

  /** Channel IDs to explicitly include (override score) */
  explicitChannelIds: z.array(z.string().min(1)).optional().default([]),

  /** Channel IDs to explicitly exclude */
  excludeChannelIds: z.array(z.string().min(1)).optional().default([]),
});

export type AutoJoinChannelsInput = z.infer<typeof autoJoinChannelsSchema>;

/**
 * Schema for leaving a channel
 */
export const leaveChannelSchema = z.object({
  /** Reason for leaving the channel */
  reason: z
    .string()
    .max(500, 'Reason must be less than 500 characters')
    .optional(),

  /** Whether this is a temporary leave (can rejoin automatically) */
  isTemporary: z.boolean().optional().default(false),
});

export type LeaveChannelInput = z.infer<typeof leaveChannelSchema>;

/**
 * Schema for channel recommendation filters
 */
export const channelRecommendationFiltersSchema = z.object({
  /** Minimum relevance score to return (0-1) */
  minScore: z.coerce.number().min(0).max(1).optional().default(0.5),

  /** Maximum number of recommendations */
  limit: z.coerce.number().int().positive().max(50).default(10),

  /** Include channels Orchestrator previously left */
  includePreviouslyLeft: z.coerce.boolean().optional().default(false),

  /** Filter by channel type */
  channelType: z.enum(['PUBLIC', 'PRIVATE', 'DM', 'HUDDLE']).optional(),

  /** Only include channels with recent activity (last N days) */
  recentActivityDays: z.coerce.number().int().positive().max(90).optional(),
});

export type ChannelRecommendationFiltersInput = z.infer<
  typeof channelRecommendationFiltersSchema
>;

/**
 * Schema for activity metrics filters
 */
export const activityMetricsFiltersSchema = z.object({
  /** Start date for activity range */
  startDate: z.string().datetime().optional(),

  /** End date for activity range */
  endDate: z.string().datetime().optional(),

  /** Include channels Orchestrator has left */
  includeLeftChannels: z.coerce.boolean().optional().default(false),

  /** Minimum message count to include channel */
  minMessageCount: z.coerce.number().int().nonnegative().optional().default(0),

  /** Sort by field */
  sortBy: z
    .enum(['messageCount', 'taskCount', 'lastActive', 'relevance'])
    .default('lastActive'),

  /** Sort direction */
  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  /** Pagination: page number (1-indexed) */
  page: z.coerce.number().int().positive().default(1),

  /** Pagination: items per page */
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ActivityMetricsFiltersInput = z.infer<
  typeof activityMetricsFiltersSchema
>;

/**
 * Schema for channel relevance calculation
 */
export const calculateRelevanceSchema = z.object({
  /** OrchestratorID to calculate relevance for */
  orchestratorId: z.string().min(1, 'Invalid OrchestratorID'),

  /** Optional: Override Orchestrator discipline for calculation */
  disciplineOverride: z.string().max(100).optional(),

  /** Include explanation of score calculation */
  includeExplanation: z.coerce.boolean().optional().default(true),
});

export type CalculateRelevanceInput = z.infer<typeof calculateRelevanceSchema>;

/**
 * Standard error response schema for channel intelligence
 */
export const channelIntelligenceErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type ChannelIntelligenceError = z.infer<
  typeof channelIntelligenceErrorSchema
>;

/**
 * Helper function to create standardized error response
 */
export function createChannelIntelligenceError(
  error: string,
  code: string,
  details?: Record<string, unknown>
): ChannelIntelligenceError {
  return {
    error,
    code,
    ...(details && { details }),
  };
}

/**
 * Common error codes for channel intelligence API
 */
export const CHANNEL_INTELLIGENCE_ERROR_CODES = {
  ORCHESTRATOR_NOT_FOUND: 'ORCHESTRATOR_NOT_FOUND',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  NOT_MEMBER: 'NOT_MEMBER',
  CANNOT_LEAVE_REQUIRED_CHANNEL: 'CANNOT_LEAVE_REQUIRED_CHANNEL',
  AUTO_JOIN_FAILED: 'AUTO_JOIN_FAILED',
  CALCULATION_ERROR: 'CALCULATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ChannelIntelligenceErrorCode =
  (typeof CHANNEL_INTELLIGENCE_ERROR_CODES)[keyof typeof CHANNEL_INTELLIGENCE_ERROR_CODES];

/**
 * Response schema for channel with relevance
 */
export const channelWithRelevanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  type: z.enum(['PUBLIC', 'PRIVATE', 'DM', 'HUDDLE']),
  relevanceScore: z.number().min(0).max(1),
  reasoning: z.string(),
  memberCount: z.number().int().nonnegative(),
  recentActivityCount: z.number().int().nonnegative().optional(),
  isArchived: z.boolean(),
});

export type ChannelWithRelevance = z.infer<typeof channelWithRelevanceSchema>;

/**
 * Response schema for Orchestrator channel activity metrics
 */
export const channelActivityMetricsSchema = z.object({
  channelId: z.string(),
  channelName: z.string(),
  channelSlug: z.string(),
  messagesSent: z.number().int().nonnegative(),
  tasksFromChannel: z.number().int().nonnegative(),
  lastActiveAt: z.string().datetime().nullable(),
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().nullable(),
  relevanceScore: z.number().min(0).max(1).optional(),
});

export type ChannelActivityMetrics = z.infer<
  typeof channelActivityMetricsSchema
>;
