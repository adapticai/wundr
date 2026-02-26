/**
 * Session Manager Validation Schemas
 * @module lib/validations/session-manager
 */

import { z } from 'zod';

export const SESSION_MANAGER_ERROR_CODES = {
  INVALID_SESSION: 'SESSION_INVALID',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  INVALID_TOKEN: 'SESSION_INVALID_TOKEN',
  UNAUTHORIZED: 'SESSION_UNAUTHORIZED',
  MAX_SESSIONS_EXCEEDED: 'SESSION_MAX_EXCEEDED',
  VALIDATION_ERROR: 'SESSION_VALIDATION_ERROR',
  NOT_FOUND: 'SESSION_MANAGER_NOT_FOUND',
  ORCHESTRATOR_NOT_FOUND: 'ORCHESTRATOR_NOT_FOUND',
  INTERNAL_ERROR: 'SESSION_MANAGER_INTERNAL_ERROR',
  FORBIDDEN: 'SESSION_MANAGER_FORBIDDEN',
  ALREADY_EXISTS: 'SESSION_MANAGER_ALREADY_EXISTS',
  HAS_DEPENDENCIES: 'SESSION_MANAGER_HAS_DEPENDENCIES',
} as const;

export type SessionManagerErrorCode =
  (typeof SESSION_MANAGER_ERROR_CODES)[keyof typeof SESSION_MANAGER_ERROR_CODES];

export const sessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  token: z.string(),
  deviceInfo: z.object({
    userAgent: z.string(),
    ip: z.string(),
    platform: z.string().optional(),
    browser: z.string().optional(),
  }),
  status: z.enum(['active', 'expired', 'revoked']),
  lastActivity: z.string().datetime(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export const createSessionSchema = z.object({
  userId: z.string(),
  deviceInfo: sessionSchema.shape.deviceInfo,
  duration: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const sessionActivitySchema = z.object({
  sessionId: z.string(),
  type: z.enum(['api_call', 'page_view', 'action']),
  resource: z.string().optional(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export const sessionRefreshSchema = z.object({
  token: z.string(),
  extendDuration: z.number().positive().optional(),
});

export const sessionRevokeSchema = z.object({
  sessionIds: z.array(z.string()),
  reason: z.string().optional(),
});

/**
 * Create standardized session manager error response
 */
export function createErrorResponse(
  message: string,
  code: SessionManagerErrorCode,
  details?: Record<string, unknown>
): {
  error: SessionManagerErrorCode;
  message: string;
  details?: Record<string, unknown>;
} {
  return {
    error: code,
    message,
    ...(details && { details }),
  };
}

/**
 * Orchestrator ID param schema (for session manager routes)
 */
export const orchestratorIdParamSchema = z.object({
  orchestratorId: z.string().min(1),
});

export type OrchestratorIdParam = z.infer<typeof orchestratorIdParamSchema>;

/**
 * Session Manager ID param schema
 */
export const sessionManagerIdParamSchema = z.object({
  id: z.string().min(1),
});

export type SessionManagerIdParam = z.infer<typeof sessionManagerIdParamSchema>;

// Plugin type enum
export const pluginTypeEnum = z.enum([
  'MEMORY',
  'TOOL',
  'SKILL',
  'CONTEXT',
  'INTEGRATION',
  'MONITORING',
  'SECURITY',
]);

export type PluginType = z.infer<typeof pluginTypeEnum>;

// Plugin config schema
export const pluginConfigSchema = z.object({
  name: z.string().min(1, 'Plugin name is required'),
  type: pluginTypeEnum,
  version: z.string().optional(),
  configuration: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(50),
});

export type PluginConfig = z.infer<typeof pluginConfigSchema>;

// Skill capability level
export const capabilityLevelEnum = z.enum([
  'beginner',
  'intermediate',
  'advanced',
  'expert',
]);

export type CapabilityLevel = z.infer<typeof capabilityLevelEnum>;

// Skill definition schema
export const skillDefinitionSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  description: z.string().min(1),
  functionName: z.string().min(1),
  parameters: z.record(z.unknown()).default({}),
  capabilityLevel: capabilityLevelEnum.default('intermediate'),
  requiredTools: z.array(z.string()).default([]),
  estimatedTokens: z.number().int().positive().optional(),
});

export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;

// Context config schema
export const contextConfigSchema = z.object({
  systemPrompt: z.string().max(10000).optional(),
  claudeMdContent: z.string().max(50000).optional(),
  workspaceContext: z.string().max(10000).optional(),
  customInstructions: z.string().max(10000).optional(),
  environmentVariables: z.record(z.string()).optional(),
  filePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
});

export type ContextConfig = z.infer<typeof contextConfigSchema>;

/**
 * Create session manager schema
 */
export const createSessionManagerSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  charterId: z.string().optional(),
  charterData: z.record(z.unknown()).optional(),
  disciplineId: z.string().optional(),
  orchestratorId: z.string().min(1).optional(), // Made optional since it comes from route params
  isGlobal: z.boolean().optional().default(false),
  globalConfig: z.record(z.unknown()).optional(),
  maxConcurrentSubagents: z.number().positive().optional().default(20),
  tokenBudgetPerHour: z.number().positive().optional().default(100000),
  worktreeConfig: z.record(z.unknown()).optional(),
  config: z
    .object({
      maxConcurrentSessions: z.number().positive().default(100),
      sessionTimeout: z.number().positive().default(3600000), // 1 hour
      enablePersistence: z.boolean().default(true),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
  pluginConfigs: z.array(pluginConfigSchema).default([]),
  skillDefinitions: z.array(skillDefinitionSchema).default([]),
  contextConfig: contextConfigSchema.optional(),
  mcpTools: z.array(z.string()).default([]),
});

export type CreateSessionManagerInput = z.infer<
  typeof createSessionManagerSchema
>;

/**
 * Update session manager schema
 */
export const updateSessionManagerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  charterId: z.string().optional(),
  charterData: z.record(z.unknown()).optional(),
  disciplineId: z.string().optional(),
  isGlobal: z.boolean().optional(),
  globalConfig: z.record(z.unknown()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED', 'ERROR']).optional(),
  maxConcurrentSubagents: z.number().positive().optional(),
  tokenBudgetPerHour: z.number().positive().optional(),
  worktreeConfig: z.record(z.unknown()).optional(),
  config: z
    .object({
      maxConcurrentSessions: z.number().positive().optional(),
      sessionTimeout: z.number().positive().optional(),
      enablePersistence: z.boolean().optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateSessionManagerInput = z.infer<
  typeof updateSessionManagerSchema
>;
