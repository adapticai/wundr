/**
 * Traffic Manager Validation Schemas
 *
 * Zod schemas for traffic manager API inputs/outputs including routing rules,
 * agent status, and traffic metrics.
 *
 * @module lib/validations/traffic-manager
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const messagePriorityEnum = z.enum([
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
  'CRITICAL',
]);

export const agentSeniorityEnum = z.enum([
  'ic',
  'manager',
  'director',
  'vp',
  'ceo',
]);

export const agentStatusEnum = z.enum([
  'available',
  'busy',
  'offline',
  'maintenance',
]);

export const routingMethodEnum = z.enum([
  'direct_mention',
  'thread_continuity',
  'binding_rule',
  'discipline_match',
  'seniority_escalation',
  'load_balance',
  'fallback',
]);

export const fallbackBehaviorEnum = z.enum([
  'default_agent',
  'round_robin',
  'queue',
]);

// ============================================================================
// Routing Rule Schemas
// ============================================================================

export const routingRuleConditionsSchema = z.object({
  channelPattern: z.string().max(200).optional(),
  senderPattern: z.string().max(200).optional(),
  contentKeywords: z.array(z.string().max(100)).max(20).optional(),
  messageTypes: z
    .array(z.enum(['direct', 'group', 'channel', 'thread']))
    .optional(),
  minPriority: messagePriorityEnum.optional(),
});

export const routingRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  priority: z.number().int().min(1).max(100),
  enabled: z.boolean().default(true),
  conditions: routingRuleConditionsSchema,
  targetAgentId: z.string().min(1),
  fallbackAgentId: z.string().optional(),
});

// ============================================================================
// Config Schemas
// ============================================================================

export const trafficManagerConfigSchema = z.object({
  defaultAgentId: z.string().min(1),
  routingRules: z.array(routingRuleSchema).default([]),
  escalationThreshold: messagePriorityEnum.default('HIGH'),
  enableContentAnalysis: z.boolean().default(true),
  enableLoadBalancing: z.boolean().default(true),
  maxRoutingLatencyMs: z
    .number()
    .int()
    .min(100)
    .max(30000)
    .default(5000),
  fallbackBehavior: fallbackBehaviorEnum.default('default_agent'),
});

export const updateTrafficManagerConfigSchema =
  trafficManagerConfigSchema.partial();

// ============================================================================
// API Input Schemas
// ============================================================================

export const routeMessageInputSchema = z.object({
  channelId: z.string().min(1),
  messageContent: z.string().min(1).max(10000),
  senderId: z.string().min(1),
  threadId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const routingDecisionResponseSchema = z.object({
  agentId: z.string(),
  agentName: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  matchedBy: routingMethodEnum,
  fallbackChain: z.array(z.string()),
  escalated: z.boolean(),
  routingLatencyMs: z.number().int().optional(),
});

export const agentStatusResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  discipline: z.string(),
  seniority: agentSeniorityEnum,
  status: agentStatusEnum,
  currentLoad: z.number().min(0).max(1),
  messagesHandled: z.number().int(),
  lastActiveAt: z.string().datetime().nullable().optional(),
});

export const trafficMetricsResponseSchema = z.object({
  totalMessagesRouted: z.number().int(),
  averageRoutingLatencyMs: z.number(),
  messagesPerMinute: z.number(),
  escalationRate: z.number().min(0).max(1),
  fallbackRate: z.number().min(0).max(1),
  routingMethodDistribution: z.record(z.number()),
  agentUtilization: z.record(z.number()),
  windowStartedAt: z.string().datetime().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type MessagePriority = z.infer<typeof messagePriorityEnum>;
export type AgentSeniority = z.infer<typeof agentSeniorityEnum>;
export type AgentStatus = z.infer<typeof agentStatusEnum>;
export type RoutingMethod = z.infer<typeof routingMethodEnum>;
export type RoutingRuleInput = z.infer<typeof routingRuleSchema>;
export type TrafficManagerConfigInput = z.infer<
  typeof trafficManagerConfigSchema
>;
export type RouteMessageInput = z.infer<typeof routeMessageInputSchema>;
export type RoutingDecisionResponse = z.infer<
  typeof routingDecisionResponseSchema
>;
export type AgentStatusResponse = z.infer<typeof agentStatusResponseSchema>;
export type TrafficMetricsResponse = z.infer<
  typeof trafficMetricsResponseSchema
>;

// ============================================================================
// Error Codes & Helpers
// ============================================================================

export const TRAFFIC_MANAGER_ERROR_CODES = {
  UNAUTHORIZED: 'TRAFFIC_MANAGER_UNAUTHORIZED',
  VALIDATION_ERROR: 'TRAFFIC_MANAGER_VALIDATION_ERROR',
  AGENT_NOT_FOUND: 'TRAFFIC_MANAGER_AGENT_NOT_FOUND',
  ROUTING_FAILED: 'TRAFFIC_MANAGER_ROUTING_FAILED',
  CONFIG_NOT_FOUND: 'TRAFFIC_MANAGER_CONFIG_NOT_FOUND',
  INTERNAL_ERROR: 'TRAFFIC_MANAGER_INTERNAL_ERROR',
} as const;

export function createErrorResponse(
  message: string,
  code: string,
  details?: Record<string, unknown>
) {
  return {
    error: { message, code, ...(details && { details }) },
  };
}
