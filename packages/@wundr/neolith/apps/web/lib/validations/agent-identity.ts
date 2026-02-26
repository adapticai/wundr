/**
 * Agent Identity Validation Schemas
 *
 * Zod schemas for agent identity and communication provisioning API endpoints.
 *
 * @module lib/validations/agent-identity
 */

import { z } from 'zod';

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Agent identity-related error codes
 */
export const AGENT_IDENTITY_ERROR_CODES = {
  NOT_FOUND: 'IDENTITY_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  ALREADY_EXISTS: 'IDENTITY_ALREADY_EXISTS',
  PROVISIONING_FAILED: 'PROVISIONING_FAILED',
} as const;

export type AgentIdentityErrorCode =
  (typeof AGENT_IDENTITY_ERROR_CODES)[keyof typeof AGENT_IDENTITY_ERROR_CODES];

/**
 * Create a standardized error response object for JSON responses
 */
export function createErrorResponse(
  message: string,
  code: string,
  extraData?: Record<string, unknown>
): { error: string; message: string } & Record<string, unknown> {
  return { error: code, message, ...extraData };
}

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Communication channel enum
 */
export const communicationChannelEnum = z.enum([
  'EMAIL',
  'SMS',
  'VOICE',
  'WHATSAPP',
  'SLACK',
  'DISCORD',
  'TELEGRAM',
]);

export type CommunicationChannel = z.infer<typeof communicationChannelEnum>;

/**
 * Provisioning status enum
 */
export const provisioningStatusEnum = z.enum([
  'pending',
  'provisioning',
  'active',
  'failed',
  'suspended',
]);

export type ProvisioningStatus = z.infer<typeof provisioningStatusEnum>;

// =============================================================================
// AGENT IDENTITY SCHEMAS
// =============================================================================

/**
 * Create agent identity input schema
 */
export const createAgentIdentitySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  corporateEmail: z.string().email('Invalid email address').optional(),
  emailDomain: z.string().min(1).optional(),
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format')
    .optional(),
  whatsappEnabled: z.boolean().default(false),
  voiceEnabled: z.boolean().default(false),
  smsEnabled: z.boolean().default(false),
  communicationChannels: z.array(communicationChannelEnum).default([]),
  externalIdentifiers: z.record(z.string()).optional(),
});

export type CreateAgentIdentityInput = z.infer<
  typeof createAgentIdentitySchema
>;

/**
 * Update agent identity input schema
 */
export const updateAgentIdentitySchema = createAgentIdentitySchema
  .partial()
  .omit({ userId: true });

export type UpdateAgentIdentityInput = z.infer<
  typeof updateAgentIdentitySchema
>;

// =============================================================================
// PROVISIONING SCHEMAS
// =============================================================================

/**
 * Provision email input schema
 */
export const provisionEmailSchema = z.object({
  orchestratorId: z.string().min(1, 'Orchestrator ID is required'),
  emailDomain: z.string().min(1, 'Email domain is required'),
  preferredUsername: z.string().min(1).optional(),
});

export type ProvisionEmailInput = z.infer<typeof provisionEmailSchema>;

/**
 * Provision phone number input schema
 */
export const provisionPhoneNumberSchema = z.object({
  orchestratorId: z.string().min(1, 'Orchestrator ID is required'),
  countryCode: z.string().length(2).default('US'),
  areaCode: z.string().optional(),
  capabilities: z
    .array(z.enum(['voice', 'sms', 'whatsapp']))
    .default(['voice', 'sms']),
});

export type ProvisionPhoneNumberInput = z.infer<
  typeof provisionPhoneNumberSchema
>;

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

/**
 * Agent identity response schema
 */
export const agentIdentityResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  corporateEmail: z.string().nullable(),
  emailDomain: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneNumber: z.string().nullable(),
  twilioPhoneSid: z.string().nullable(),
  whatsappNumber: z.string().nullable(),
  whatsappEnabled: z.boolean(),
  voiceEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  communicationChannels: z.array(z.string()),
  provisioningStatus: provisioningStatusEnum,
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type AgentIdentityResponse = z.infer<typeof agentIdentityResponseSchema>;
