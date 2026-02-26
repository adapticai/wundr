/**
 * Org Genesis Validation Schemas
 *
 * Zod schemas for the organization genesis wizard flow.
 *
 * @module lib/validations/org-genesis
 */

import { z } from 'zod';

// =============================================================================
// WIZARD TYPES
// =============================================================================

/**
 * Wizard step identifier
 */
export type WizardStep =
  | 'basic'
  | 'description'
  | 'charter'
  | 'config'
  | 'preview';

// =============================================================================
// BASIC INFO SCHEMAS
// =============================================================================

/**
 * Organization type enum
 */
export const orgTypeEnum = z.enum([
  'startup',
  'enterprise',
  'agency',
  'nonprofit',
  'government',
  'education',
  'other',
]);

export type OrgType = z.infer<typeof orgTypeEnum>;

/**
 * Organization basic info schema
 */
export const orgBasicInfoSchema = z.object({
  name: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must be less than 100 characters'),
  type: orgTypeEnum,
});

export type OrgBasicInfo = z.infer<typeof orgBasicInfoSchema>;

// =============================================================================
// DESCRIPTION SCHEMAS
// =============================================================================

/**
 * Organization description schema
 */
export const orgDescriptionSchema = z.object({
  description: z
    .string()
    .min(
      50,
      'Please provide at least 50 characters describing your organization'
    )
    .max(2000, 'Description must be less than 2000 characters'),
  strategy: z
    .string()
    .max(1000, 'Strategy must be less than 1000 characters')
    .optional(),
  goals: z.array(z.string()).optional(),
});

export type OrgDescription = z.infer<typeof orgDescriptionSchema>;

// =============================================================================
// CONFIGURATION SCHEMAS
// =============================================================================

/**
 * Team size range enum
 */
export const teamSizeEnum = z.enum([
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '500+',
]);

export type TeamSize = z.infer<typeof teamSizeEnum>;

/**
 * Risk tolerance enum
 */
export const riskToleranceEnum = z.enum(['low', 'medium', 'high']);

export type RiskTolerance = z.infer<typeof riskToleranceEnum>;

/**
 * Organization configuration schema
 */
export const orgConfigSchema = z.object({
  teamSize: teamSizeEnum,
  riskTolerance: riskToleranceEnum,
  assets: z.array(z.string()).optional(),
  budget: z.string().optional(),
  timeline: z.string().optional(),
});

export type OrgConfig = z.infer<typeof orgConfigSchema>;

// =============================================================================
// GENERATION REQUEST/RESPONSE SCHEMAS
// =============================================================================

/**
 * Input for org generation API
 */
const charterDataSchema = z.object({
  mission: z.string(),
  vision: z.string(),
  values: z.array(z.string()),
  principles: z.array(z.string()),
  governanceStyle: z.string(),
  communicationStyle: z.string(),
});

export const generateOrgInputSchema = z.object({
  basicInfo: orgBasicInfoSchema,
  description: orgDescriptionSchema,
  config: orgConfigSchema,
  charterData: charterDataSchema.optional(),
});

export type GenerateOrgInput = z.infer<typeof generateOrgInputSchema>;

/**
 * Generated department type
 */
export interface GeneratedDepartment {
  id: string;
  name: string;
  description: string;
  headCount: number;
  roles: GeneratedRole[];
  parentId?: string;
}

/**
 * Generated role type
 */
export interface GeneratedRole {
  id: string;
  title: string;
  description: string;
  skills: string[];
  isLeadership: boolean;
}

/**
 * Generated workflow type
 */
export interface GeneratedWorkflow {
  id: string;
  name: string;
  description: string;
  steps: string[];
  departmentIds: string[];
}

/**
 * Organization manifest - mirrors structure from org-genesis
 */
export interface OrganizationManifest {
  id: string;
  name: string;
  description: string;
  type: string;
  mission: string;
  vision: string;
  values: string[];
  createdAt: string;
  schemaVersion: string;
}

/**
 * Orchestrator persona definition
 */
export interface OrchestratorPersona {
  communicationStyle: string;
  decisionMakingStyle: string;
  background: string;
  traits: string[];
}

/**
 * Orchestrator definition
 */
export interface OrchestratorDefinition {
  id: string;
  name: string;
  title: string;
  responsibilities: string[];
  disciplines: string[];
  persona: OrchestratorPersona;
  kpis: string[];
}

/**
 * Discipline definition
 */
export interface DisciplineDefinition {
  id: string;
  name: string;
  description: string;
  orchestratorId: string;
  slug: string;
  purpose: string;
  activities: string[];
  capabilities: string[];
}

/**
 * Agent definition
 */
export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  disciplineId: string;
  capabilities: string[];
  instructions: string;
}

/**
 * Generation metadata
 */
export interface GenerationMetadata {
  generatedAt: string;
  generatorVersion: string;
  configHash: string;
  durationMs: number;
}

/**
 * Channel summary for preview display
 */
export interface ChannelSummary {
  id: string;
  name: string;
  slug: string;
  type: string;
  memberCount: number;
}

/**
 * Organization generation response
 */
export interface OrgGenerationResponse {
  success: boolean;
  workspaceId?: string;

  /** Generated organization manifest */
  manifest: OrganizationManifest;

  /** List of generated Orchestrator definitions */
  orchestrators: OrchestratorDefinition[];

  /** List of generated discipline definitions */
  disciplines: DisciplineDefinition[];

  /** List of generated agent definitions */
  agents: AgentDefinition[];

  /** Generation metadata */
  metadata: GenerationMetadata;

  /** Auto-created channels summary */
  channels?: ChannelSummary[];

  /** Legacy organization structure (deprecated) */
  organization?: {
    name: string;
    type: OrgType;
    mission: string;
    vision: string;
    departments: GeneratedDepartment[];
    workflows: GeneratedWorkflow[];
    recommendations: string[];
  };

  error?: string;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate basic info step
 */
export function validateBasicInfo(data: unknown): {
  success: boolean;
  data?: OrgBasicInfo;
  errors?: z.ZodError;
} {
  const result = orgBasicInfoSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validate description step
 */
export function validateDescription(data: unknown): {
  success: boolean;
  data?: OrgDescription;
  errors?: z.ZodError;
} {
  const result = orgDescriptionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validate config step
 */
export function validateConfig(data: unknown): {
  success: boolean;
  data?: OrgConfig;
  errors?: z.ZodError;
} {
  const result = orgConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validate full generation input
 */
export function validateGenerateOrgInput(data: unknown): {
  success: boolean;
  data?: GenerateOrgInput;
  errors?: z.ZodError;
} {
  const result = generateOrgInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
