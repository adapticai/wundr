/**
 * @packageDocumentation
 * Zod validation schemas for the Org Genesis system.
 *
 * This module provides runtime validation schemas that match the TypeScript types
 * used across organization generation, context compilation, and registry management.
 *
 * @remarks
 * All schemas are designed to validate against the types defined in the types module.
 * The validation helper functions provide type-safe runtime validation with
 * comprehensive error messages.
 */

import { z } from 'zod';

import type {
  AgentCapabilities,
  // Agent types
  AgentDefinition,
  AgentIdentity,
  AgentScope,
  AgentTool,
  AgentToolType,
  ClaudeMdConfig,
  CompiledSessionConfig,
  // Session types
  CompileSessionRequest,
  CreateAgentConfig,
  CreateDisciplineConfig,
  CreateOrchestratorConfig,
  CreateOrgConfig,
  CreateSessionManagerConfig,
  // Discipline types
  DisciplineCategory,
  DisciplinePack,
  HardConstraints,
  HookConfig,
  MCPServerConfig,
  MeasurableObjectives,
  MemoryBank,
  ModelAssignment,
  OrchestratorCapability,
  // Charter types
  OrchestratorCharter,
  OrchestratorNodeStatus,
  OrchestratorResourceAllocation,
  OrganizationManifest,
  OrgCommunicationConfig,
  OrgGovernanceConfig,
  OrgIndustry,
  OrgLifecycleState,
  OrgSecurityConfig,
  // Organization types
  OrgSize,
  // Registry types
  RegistryEntry,
  RegistryEntryType,
  RegistryQuery,
  RegistryQueryResult,
  ResourceLimits,
  SessionContext,
  SessionManagerCharter,
  SessionStatus,
  VPNodeMapping,
} from '../types/index.js';

// =============================================================================
// Common Schema Utilities
// =============================================================================

/**
 * Schema for JSON primitive values
 */
const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/**
 * Schema for JSON values (recursive)
 */
const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    JsonPrimitiveSchema,
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

/**
 * Schema for Record<string, unknown>
 */
const RecordUnknownSchema = z.record(z.string(), z.unknown());

// =============================================================================
// Organization Schemas
// =============================================================================

/**
 * Schema for OrgSize
 */
export const OrgSizeSchema = z.enum(['small', 'medium', 'large', 'enterprise'], {
  errorMap: () => ({
    message: 'Organization size must be one of: small, medium, large, enterprise',
  }),
}) satisfies z.ZodType<OrgSize>;

/**
 * Schema for OrgIndustry
 */
export const OrgIndustrySchema = z.enum(
  [
    'technology',
    'finance',
    'healthcare',
    'legal',
    'marketing',
    'manufacturing',
    'retail',
    'gaming',
    'media',
    'custom',
  ],
  {
    errorMap: () => ({
      message: 'Invalid industry. Must be one of the supported industry types.',
    }),
  },
) satisfies z.ZodType<OrgIndustry>;

/**
 * Schema for OrgLifecycleState
 */
export const OrgLifecycleStateSchema = z.enum(['draft', 'active', 'suspended', 'archived'], {
  errorMap: () => ({
    message: 'Lifecycle state must be one of: draft, active, suspended, archived',
  }),
}) satisfies z.ZodType<OrgLifecycleState>;

/**
 * Schema for OrchestratorNodeStatus
 */
export const OrchestratorNodeStatusSchema = z.enum(
  ['active', 'inactive', 'provisioning', 'error', 'maintenance'],
  {
    errorMap: () => ({
      message: 'Orchestrator node status must be one of: active, inactive, provisioning, error, maintenance',
    }),
  },
) satisfies z.ZodType<OrchestratorNodeStatus>;

/**
 * Schema for OrchestratorResourceAllocation
 */
export const OrchestratorResourceAllocationSchema = z.object({
  cpuCores: z.number().int().min(1, 'CPU cores must be at least 1'),
  memoryMb: z.number().int().min(256, 'Memory must be at least 256MB'),
  maxConcurrentTasks: z.number().int().min(1, 'Must allow at least 1 concurrent task'),
  tokenBudgetPerHour: z.number().int().min(1000, 'Token budget must be at least 1000'),
}) satisfies z.ZodType<OrchestratorResourceAllocation>;

/**
 * Schema for VPNodeMapping
 */
export const VPNodeMappingSchema = z.object({
  vpId: z.string().min(1, 'Orchestrator ID is required'),
  nodeId: z.string().min(1, 'Node ID is required'),
  hostname: z.string().min(1, 'Hostname is required'),
  status: OrchestratorNodeStatusSchema,
  assignedDisciplineId: z.string().optional(),
  resources: OrchestratorResourceAllocationSchema.optional(),
  healthMetrics: z
    .object({
      uptime: z.number().min(0).max(100),
      avgResponseTimeMs: z.number().min(0),
      errorCountLast24h: z.number().int().min(0),
      lastHealthCheck: z.coerce.date(),
      cpuUtilization: z.number().min(0).max(100),
      memoryUtilization: z.number().min(0).max(100),
    })
    .optional(),
  port: z.number().int().min(1).max(65535).optional(),
  tags: z.array(z.string()).optional(),
  provisionedAt: z.coerce.date().optional(),
  lastStatusChange: z.coerce.date().optional(),
}) satisfies z.ZodType<OrchestratorNodeMapping>;

/**
 * Schema for OrgGovernanceConfig
 */
export const OrgGovernanceConfigSchema = z.object({
  requireHumanApproval: z.boolean(),
  approvalThresholdUsd: z.number().min(0),
  escalationTimeoutMinutes: z.number().int().min(1),
  executiveVpIds: z.array(z.string()),
  auditLoggingEnabled: z.boolean(),
}) satisfies z.ZodType<OrgGovernanceConfig>;

/**
 * Schema for OrgSecurityConfig
 */
export const OrgSecurityConfigSchema = z.object({
  encryptionAtRest: z.enum(['AES-256', 'AES-128', 'none']),
  encryptionInTransit: z.enum(['TLS-1.3', 'TLS-1.2', 'mTLS']),
  mfaRequired: z.boolean(),
  sessionTimeoutMinutes: z.number().int().min(1),
  complianceFrameworks: z.array(z.string()),
  ipAllowlist: z.array(z.string()),
}) satisfies z.ZodType<OrgSecurityConfig>;

/**
 * Schema for OrgCommunicationConfig
 */
export const OrgCommunicationConfigSchema = z.object({
  protocol: z.enum(['grpc', 'rest', 'websocket', 'mqtt']),
  messageQueue: z.enum(['redis', 'rabbitmq', 'kafka', 'sqs', 'none']),
  maxMessageSizeKb: z.number().int().min(1),
  compressionEnabled: z.boolean(),
  retryPolicy: z.object({
    maxRetries: z.number().int().min(0),
    initialDelayMs: z.number().int().min(0),
    maxDelayMs: z.number().int().min(0),
    backoffMultiplier: z.number().min(1),
  }),
}) satisfies z.ZodType<OrgCommunicationConfig>;

/**
 * Schema for CreateOrgConfig
 */
export const CreateOrgConfigSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(100, 'Organization name must be 100 characters or less'),
  slug: z.string().optional(),
  mission: z
    .string()
    .min(10, 'Mission statement must be at least 10 characters')
    .max(500, 'Mission statement must be 500 characters or less'),
  description: z.string().optional(),
  industry: OrgIndustrySchema,
  size: OrgSizeSchema,
  orchestratorCount: z
    .number()
    .int('Orchestrator count must be a whole number')
    .min(1, 'Organization must have at least 1 VP')
    .max(100, 'Organization cannot have more than 100 VPs')
    .optional(),
  generateDisciplines: z.boolean().optional(),
  generateAgents: z.boolean().optional(),
  initialDisciplines: z.array(z.string()).optional(),
  governance: OrgGovernanceConfigSchema.partial().optional(),
  security: OrgSecurityConfigSchema.partial().optional(),
  communication: OrgCommunicationConfigSchema.partial().optional(),
  metadata: RecordUnknownSchema.optional(),
  dryRun: z.boolean().optional(),
}) satisfies z.ZodType<CreateOrgConfig>;

/**
 * Schema for OrganizationManifest
 */
export const OrganizationManifestSchema = z.object({
  id: z.string().min(1, 'Organization ID is required'),
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  mission: z.string().min(10).max(500),
  description: z.string().optional(),
  industry: OrgIndustrySchema,
  size: OrgSizeSchema,
  lifecycleState: OrgLifecycleStateSchema,
  vpRegistry: z.array(VPNodeMappingSchema),
  disciplineIds: z.array(z.string()),
  governance: OrgGovernanceConfigSchema.optional(),
  security: OrgSecurityConfigSchema.optional(),
  communication: OrgCommunicationConfigSchema.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  schemaVersion: z.string().optional(),
  metadata: RecordUnknownSchema,
}) satisfies z.ZodType<OrganizationManifest>;

// =============================================================================
// Discipline Schemas
// =============================================================================

/**
 * Schema for DisciplineCategory
 */
export const DisciplineCategorySchema = z.enum(
  [
    'engineering',
    'legal',
    'hr',
    'marketing',
    'finance',
    'operations',
    'design',
    'research',
    'sales',
    'support',
    'custom',
  ],
  {
    errorMap: () => ({
      message: 'Invalid discipline category',
    }),
  },
) satisfies z.ZodType<DisciplineCategory>;

/**
 * Schema for MCPServerConfig
 */
export const MCPServerConfigSchema = z.object({
  name: z.string().min(1, 'MCP server name is required'),
  command: z.string().min(1, 'Command is required'),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  description: z.string().min(1, 'Description is required'),
}) satisfies z.ZodType<MCPServerConfig>;

/**
 * Schema for HookConfig
 */
export const HookConfigSchema = z.object({
  event: z.enum(['PreToolUse', 'PostToolUse', 'PreCommit', 'PostCommit']),
  command: z.string().min(1, 'Hook command is required'),
  description: z.string().min(1, 'Description is required'),
  blocking: z.boolean().optional(),
}) satisfies z.ZodType<HookConfig>;

/**
 * Schema for ClaudeMdConfig
 */
export const ClaudeMdConfigSchema = z.object({
  role: z.string().min(1, 'Role is required'),
  context: z.string().min(1, 'Context is required'),
  rules: z.array(z.string()),
  objectives: z.array(z.string()),
  constraints: z.array(z.string()),
}) satisfies z.ZodType<ClaudeMdConfig>;

/**
 * Schema for CreateDisciplineConfig
 */
export const CreateDisciplineConfigSchema = z.object({
  name: z
    .string()
    .min(1, 'Discipline name is required')
    .max(100, 'Discipline name must be 100 characters or less'),
  category: DisciplineCategorySchema,
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be 500 characters or less'),
  parentVpId: z.string().optional(),
  claudeMd: ClaudeMdConfigSchema.partial().optional(),
  mcpServers: z.array(MCPServerConfigSchema).optional(),
  hooks: z.array(HookConfigSchema).optional(),
}) satisfies z.ZodType<CreateDisciplineConfig>;

/**
 * Schema for DisciplinePack
 */
export const DisciplinePackSchema = z.object({
  id: z.string().min(1, 'Discipline ID is required'),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  category: DisciplineCategorySchema,
  description: z.string().min(10).max(500),
  claudeMd: ClaudeMdConfigSchema,
  mcpServers: z.array(MCPServerConfigSchema),
  hooks: z.array(HookConfigSchema),
  agentIds: z.array(z.string()),
  parentVpId: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}) satisfies z.ZodType<DisciplinePack>;

// =============================================================================
// Charter Schemas (Orchestrator and Session Manager)
// =============================================================================

/**
 * Schema for OrchestratorCapability
 */
export const OrchestratorCapabilitySchema = z.enum([
  'context_compilation',
  'resource_management',
  'slack_operations',
  'session_spawning',
  'task_triage',
  'memory_management',
]) satisfies z.ZodType<OrchestratorCapability>;

/**
 * Schema for AgentIdentity
 */
export const AgentIdentitySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  persona: z.string().min(1, 'Persona is required'),
  slackHandle: z.string().optional(),
  email: z.string().email().optional(),
  avatarUrl: z.string().url().optional(),
}) satisfies z.ZodType<AgentIdentity>;

/**
 * Schema for ResourceLimits
 */
export const ResourceLimitsSchema = z.object({
  maxConcurrentSessions: z.number().int().min(1).max(100),
  tokenBudgetPerHour: z.number().int().min(1000),
  maxMemoryMB: z.number().int().min(128),
  maxCpuPercent: z.number().min(1).max(100),
}) satisfies z.ZodType<ResourceLimits>;

/**
 * Schema for MeasurableObjectives
 */
export const MeasurableObjectivesSchema = z.object({
  responseTimeTarget: z.number().min(0),
  taskCompletionRate: z.number().min(0).max(100),
  qualityScore: z.number().min(0).max(100),
  customMetrics: z.record(z.string(), z.number()).optional(),
}) satisfies z.ZodType<MeasurableObjectives>;

/**
 * Schema for HardConstraints
 */
export const HardConstraintsSchema = z.object({
  forbiddenCommands: z.array(z.string()),
  forbiddenPaths: z.array(z.string()),
  forbiddenActions: z.array(z.string()),
  requireApprovalFor: z.array(z.string()),
}) satisfies z.ZodType<HardConstraints>;

/**
 * Schema for CreateOrchestratorConfig
 */
export const CreateOrchestratorConfigSchema = z.object({
  name: z.string().min(1, 'Orchestrator name is required').max(100),
  persona: z.string().min(1, 'Persona is required'),
  slackHandle: z.string().optional(),
  capabilities: z.array(OrchestratorCapabilitySchema).optional(),
  resourceLimits: ResourceLimitsSchema.partial().optional(),
  mcpTools: z.array(z.string()).optional(),
  objectives: MeasurableObjectivesSchema.partial().optional(),
  constraints: HardConstraintsSchema.partial().optional(),
  disciplineIds: z.array(z.string()).optional(),
}) satisfies z.ZodType<CreateOrchestratorConfig>;

/**
 * Schema for OrchestratorCharter
 */
export const OrchestratorCharterSchema = z.object({
  id: z.string().min(1, 'Orchestrator ID is required'),
  tier: z.literal(1),
  identity: AgentIdentitySchema,
  coreDirective: z.string().min(10),
  capabilities: z.array(OrchestratorCapabilitySchema),
  mcpTools: z.array(z.string()),
  resourceLimits: ResourceLimitsSchema,
  objectives: MeasurableObjectivesSchema,
  constraints: HardConstraintsSchema,
  disciplineIds: z.array(z.string()),
  nodeId: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}) satisfies z.ZodType<OrchestratorCharter>;

/**
 * Schema for CreateSessionManagerConfig
 */
export const CreateSessionManagerConfigSchema = z.object({
  name: z.string().min(1, 'Session Manager name is required').max(100),
  disciplineId: z.string().min(1, 'Discipline ID is required'),
  parentVpId: z.string().min(1, 'Parent Orchestrator ID is required'),
  persona: z.string().optional(),
  mcpTools: z.array(z.string()).optional(),
  agentIds: z.array(z.string()).optional(),
  objectives: MeasurableObjectivesSchema.partial().optional(),
  constraints: HardConstraintsSchema.partial().optional(),
  memoryBankPath: z.string().optional(),
}) satisfies z.ZodType<CreateSessionManagerConfig>;

/**
 * Schema for SessionManagerCharter
 */
export const SessionManagerCharterSchema = z.object({
  id: z.string().min(1),
  tier: z.literal(2),
  identity: AgentIdentitySchema,
  coreDirective: z.string().min(10),
  disciplineId: z.string().min(1),
  parentVpId: z.string().min(1),
  mcpTools: z.array(z.string()),
  agentIds: z.array(z.string()),
  objectives: MeasurableObjectivesSchema,
  constraints: HardConstraintsSchema,
  memoryBankPath: z.string().min(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}) satisfies z.ZodType<SessionManagerCharter>;

// =============================================================================
// Agent Schemas
// =============================================================================

/**
 * Schema for ModelAssignment
 */
export const ModelAssignmentSchema = z.enum(['opus', 'sonnet', 'haiku'], {
  errorMap: () => ({
    message: 'Model must be one of: opus, sonnet, haiku',
  }),
}) satisfies z.ZodType<ModelAssignment>;

/**
 * Schema for AgentScope
 */
export const AgentScopeSchema = z.enum(['universal', 'discipline-specific'], {
  errorMap: () => ({
    message: 'Scope must be one of: universal, discipline-specific',
  }),
}) satisfies z.ZodType<AgentScope>;

/**
 * Schema for AgentToolType
 */
export const AgentToolTypeSchema = z.enum(['mcp', 'builtin', 'custom']) satisfies z.ZodType<AgentToolType>;

/**
 * Schema for AgentTool
 */
export const AgentToolSchema = z.object({
  name: z.string().min(1, 'Tool name is required'),
  type: AgentToolTypeSchema,
  config: RecordUnknownSchema.optional(),
}) satisfies z.ZodType<AgentTool>;

/**
 * Schema for AgentCapabilities
 */
export const AgentCapabilitiesSchema = z.object({
  canReadFiles: z.boolean(),
  canWriteFiles: z.boolean(),
  canExecuteCommands: z.boolean(),
  canAccessNetwork: z.boolean(),
  canSpawnSubAgents: z.boolean(),
  customCapabilities: z.array(z.string()).optional(),
}) satisfies z.ZodType<AgentCapabilities>;

/**
 * Schema for CreateAgentConfig
 */
export const CreateAgentConfigSchema = z.object({
  name: z
    .string()
    .min(1, 'Agent name is required')
    .max(100, 'Agent name must be 100 characters or less'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be 500 characters or less'),
  charter: z.string().min(10, 'Charter must be at least 10 characters'),
  scope: AgentScopeSchema.optional(),
  model: ModelAssignmentSchema.optional(),
  tools: z.array(AgentToolSchema).optional(),
  capabilities: AgentCapabilitiesSchema.partial().optional(),
  tags: z.array(z.string()).optional(),
}) satisfies z.ZodType<CreateAgentConfig>;

/**
 * Schema for AgentDefinition
 */
export const AgentDefinitionSchema = z.object({
  id: z.string().min(1, 'Agent ID is required'),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  tier: z.literal(3),
  scope: AgentScopeSchema,
  description: z.string().min(10).max(500),
  charter: z.string().min(10),
  model: ModelAssignmentSchema,
  tools: z.array(AgentToolSchema),
  capabilities: AgentCapabilitiesSchema,
  usedByDisciplines: z.array(z.string()),
  usedByVps: z.array(z.string()).optional(),
  tags: z.array(z.string()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}) satisfies z.ZodType<AgentDefinition>;

// =============================================================================
// Session Schemas
// =============================================================================

/**
 * Schema for SessionStatus
 */
export const SessionStatusSchema = z.enum(
  ['pending', 'compiling', 'ready', 'active', 'paused', 'completed', 'failed'],
  {
    errorMap: () => ({
      message: 'Status must be one of: pending, compiling, ready, active, paused, completed, failed',
    }),
  },
) satisfies z.ZodType<SessionStatus>;

/**
 * Schema for MemoryBank
 */
export const MemoryBankSchema = z.object({
  activeContextPath: z.string().min(1),
  progressPath: z.string().min(1),
  productContextPath: z.string().min(1),
  decisionLogPath: z.string().min(1),
}) satisfies z.ZodType<MemoryBank>;

/**
 * Schema for CompiledSessionConfig
 */
export const CompiledSessionConfigSchema = z.object({
  claudeMdContent: z.string().min(1, 'CLAUDE.md content is required'),
  claudeConfigJson: RecordUnknownSchema,
  settingsJson: RecordUnknownSchema,
  agentDefinitions: z.array(z.string()),
}) satisfies z.ZodType<CompiledSessionConfig>;

/**
 * Schema for CompileSessionRequest
 */
export const CompileSessionRequestSchema = z.object({
  discipline: z.string().min(1, 'Discipline is required'),
  taskDescription: z
    .string()
    .min(1, 'Task description is required')
    .max(2000, 'Task description must be 2000 characters or less'),
  vpId: z.string().min(1, 'Orchestrator ID is required'),
  worktreeBasePath: z.string().optional(),
  warmStartContext: z.string().optional(),
  additionalAgents: z.array(z.string()).optional(),
  mcpOverrides: RecordUnknownSchema.optional(),
}) satisfies z.ZodType<CompileSessionRequest>;

/**
 * Schema for SessionContext
 */
export const SessionContextSchema = z.object({
  id: z.string().min(1, 'Session ID is required'),
  disciplineId: z.string().min(1),
  parentVpId: z.string().min(1),
  sessionManagerId: z.string().optional(),
  worktreePath: z.string().min(1),
  status: SessionStatusSchema,
  compiledConfig: CompiledSessionConfigSchema,
  memoryBank: MemoryBankSchema,
  activeAgentIds: z.array(z.string()),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  metadata: RecordUnknownSchema,
}) satisfies z.ZodType<SessionContext>;

// =============================================================================
// Registry Schemas
// =============================================================================

/**
 * Schema for RegistryEntryType
 */
export const RegistryEntryTypeSchema = z.enum(
  ['organization', 'vp', 'discipline', 'session-manager', 'agent', 'tool', 'hook'],
  {
    errorMap: () => ({
      message: 'Invalid registry entry type',
    }),
  },
) satisfies z.ZodType<RegistryEntryType>;

/**
 * Schema for RegistryEntry
 */
export const RegistryEntrySchema = z.object({
  id: z.string().min(1, 'Entry ID is required'),
  type: RegistryEntryTypeSchema,
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  metadata: RecordUnknownSchema.optional(),
}) satisfies z.ZodType<RegistryEntry>;

/**
 * Schema for RegistryQuery
 */
export const RegistryQuerySchema = z.object({
  type: RegistryEntryTypeSchema.optional(),
  ids: z.array(z.string()).optional(),
  slugs: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
}) satisfies z.ZodType<RegistryQuery>;

/**
 * Schema for RegistryQueryResult
 */
export const RegistryQueryResultSchema = <T>(itemSchema: z.ZodType<T>) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().min(0),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
    hasMore: z.boolean(),
  }) as z.ZodType<RegistryQueryResult<T>>;

// =============================================================================
// Validation Helper Functions
// =============================================================================

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: z.ZodError,
  ) {
    super(message);
    this.name = 'ValidationError';
  }

  /**
   * Get formatted error messages
   */
  getFormattedErrors(): string[] {
    return this.errors.errors.map((err) => {
      const path = err.path.join('.');
      return path ? `${path}: ${err.message}` : err.message;
    });
  }
}

/**
 * Generic validation function
 */
function validate<T>(schema: z.ZodSchema<T>, data: unknown, entityName: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `Invalid ${entityName}: ${result.error.errors.map((e) => e.message).join(', ')}`,
      result.error,
    );
  }
  return result.data;
}

/**
 * Validate CreateOrgConfig
 */
export function validateCreateOrgConfig(data: unknown): CreateOrgConfig {
  return validate(CreateOrgConfigSchema, data, 'CreateOrgConfig');
}

/**
 * Validate OrganizationManifest
 */
export function validateOrganizationManifest(data: unknown): OrganizationManifest {
  return validate(OrganizationManifestSchema, data, 'OrganizationManifest');
}

/**
 * Validate CreateDisciplineConfig
 */
export function validateCreateDisciplineConfig(data: unknown): CreateDisciplineConfig {
  return validate(CreateDisciplineConfigSchema, data, 'CreateDisciplineConfig');
}

/**
 * Validate DisciplinePack
 */
export function validateDisciplinePack(data: unknown): DisciplinePack {
  return validate(DisciplinePackSchema, data, 'DisciplinePack');
}

/**
 * Validate CreateOrchestratorConfig
 */
export function validateCreateOrchestratorConfig(data: unknown): CreateOrchestratorConfig {
  return validate(CreateOrchestratorConfigSchema, data, 'CreateOrchestratorConfig');
}

/**
 * Validate OrchestratorCharter
 */
export function validateOrchestratorCharter(data: unknown): OrchestratorCharter {
  return validate(OrchestratorCharterSchema, data, 'OrchestratorCharter');
}

/**
 * Validate CreateSessionManagerConfig
 */
export function validateCreateSessionManagerConfig(
  data: unknown,
): CreateSessionManagerConfig {
  return validate(CreateSessionManagerConfigSchema, data, 'CreateSessionManagerConfig');
}

/**
 * Validate SessionManagerCharter
 */
export function validateSessionManagerCharter(data: unknown): SessionManagerCharter {
  return validate(SessionManagerCharterSchema, data, 'SessionManagerCharter');
}

/**
 * Validate CreateAgentConfig
 */
export function validateCreateAgentConfig(data: unknown): CreateAgentConfig {
  return validate(CreateAgentConfigSchema, data, 'CreateAgentConfig');
}

/**
 * Validate AgentDefinition
 */
export function validateAgentDefinition(data: unknown): AgentDefinition {
  return validate(AgentDefinitionSchema, data, 'AgentDefinition');
}

/**
 * Validate CompileSessionRequest
 */
export function validateCompileSessionRequest(data: unknown): CompileSessionRequest {
  return validate(CompileSessionRequestSchema, data, 'CompileSessionRequest');
}

/**
 * Validate SessionContext
 */
export function validateSessionContext(data: unknown): SessionContext {
  return validate(SessionContextSchema, data, 'SessionContext');
}

/**
 * Validate RegistryQuery
 */
export function validateRegistryQuery(data: unknown): RegistryQuery {
  return validate(RegistryQuerySchema, data, 'RegistryQuery');
}

/**
 * Validate RegistryEntry
 */
export function validateRegistryEntry(data: unknown): RegistryEntry {
  return validate(RegistryEntrySchema, data, 'RegistryEntry');
}

/**
 * Safe parse function that returns a result object instead of throwing
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: z.ZodError } {
  return schema.safeParse(data);
}

/**
 * Partial validation - validate only provided fields
 */
export function validatePartial<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  data: unknown,
): Partial<z.infer<z.ZodObject<T>>> {
  const partialSchema = schema.partial();
  const result = partialSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `Invalid partial data: ${result.error.errors.map((e) => e.message).join(', ')}`,
      result.error,
    );
  }
  return result.data;
}

// =============================================================================
// Schema Export Map
// =============================================================================

/**
 * Map of all schemas for dynamic access
 */
export const schemas = {
  // Organization
  OrgSize: OrgSizeSchema,
  OrgIndustry: OrgIndustrySchema,
  OrgLifecycleState: OrgLifecycleStateSchema,
  CreateOrgConfig: CreateOrgConfigSchema,
  OrganizationManifest: OrganizationManifestSchema,
  VPNodeMapping: VPNodeMappingSchema,
  OrchestratorResourceAllocation: OrchestratorResourceAllocationSchema,
  OrgGovernanceConfig: OrgGovernanceConfigSchema,
  OrgSecurityConfig: OrgSecurityConfigSchema,
  OrgCommunicationConfig: OrgCommunicationConfigSchema,

  // Discipline
  DisciplineCategory: DisciplineCategorySchema,
  CreateDisciplineConfig: CreateDisciplineConfigSchema,
  DisciplinePack: DisciplinePackSchema,
  MCPServerConfig: MCPServerConfigSchema,
  HookConfig: HookConfigSchema,
  ClaudeMdConfig: ClaudeMdConfigSchema,

  // Charter (Orchestrator and Session Manager)
  OrchestratorCapability: OrchestratorCapabilitySchema,
  AgentIdentity: AgentIdentitySchema,
  ResourceLimits: ResourceLimitsSchema,
  MeasurableObjectives: MeasurableObjectivesSchema,
  HardConstraints: HardConstraintsSchema,
  CreateOrchestratorConfig: CreateOrchestratorConfigSchema,
  OrchestratorCharter: OrchestratorCharterSchema,
  CreateSessionManagerConfig: CreateSessionManagerConfigSchema,
  SessionManagerCharter: SessionManagerCharterSchema,

  // Agent
  ModelAssignment: ModelAssignmentSchema,
  AgentScope: AgentScopeSchema,
  AgentToolType: AgentToolTypeSchema,
  AgentTool: AgentToolSchema,
  AgentCapabilities: AgentCapabilitiesSchema,
  CreateAgentConfig: CreateAgentConfigSchema,
  AgentDefinition: AgentDefinitionSchema,

  // Session
  SessionStatus: SessionStatusSchema,
  MemoryBank: MemoryBankSchema,
  CompiledSessionConfig: CompiledSessionConfigSchema,
  CompileSessionRequest: CompileSessionRequestSchema,
  SessionContext: SessionContextSchema,

  // Registry
  RegistryEntryType: RegistryEntryTypeSchema,
  RegistryEntry: RegistryEntrySchema,
  RegistryQuery: RegistryQuerySchema,
} as const;
