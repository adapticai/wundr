/**
 * OrchestratorGraphQL Input Types
 *
 * Codegen-friendly input types that match the GraphQL schema.
 * These types are designed to work with Apollo Client and graphql-codegen.
 *
 * @module @genesis/api-types/types/orchestrator-inputs
 */

import type {
  FormalityLevel,
  ToneType,
  VerbosityLevel,
  OrchestratorStatus,
} from './orchestrator.js';

// =============================================================================
// SCALAR TYPES (matching GraphQL)
// =============================================================================

export type DateTime = string;
export type JSON = Record<string, unknown>;
export type UUID = string;

export type InputMaybe<T> = T | null | undefined;

// =============================================================================
// CONFIGURATION INPUT TYPES
// =============================================================================

/**
 * GraphQL input for personality traits
 */
export interface PersonalityTraitsInput {
  formality?: InputMaybe<FormalityLevel>;
  verbosity?: InputMaybe<VerbosityLevel>;
  tone?: InputMaybe<ToneType>;
}

/**
 * GraphQL input for communication style
 */
export interface CommunicationStyleInput {
  primaryLanguage?: InputMaybe<string>;
  useTechnicalTerms?: InputMaybe<boolean>;
  includeExamples?: InputMaybe<boolean>;
  maxResponseLength?: InputMaybe<number>;
  signatureStyle?: InputMaybe<string>;
}

/**
 * GraphQL input for time range
 */
export interface TimeRangeInput {
  start: string;
  end: string;
}

/**
 * GraphQL input for operational hours
 */
export interface OperationalHoursInput {
  alwaysAvailable?: InputMaybe<boolean>;
  timezone?: InputMaybe<string>;
  schedule?: InputMaybe<JSON>;
}

/**
 * GraphQL input for Orchestrator configuration
 */
export interface OrchestratorConfigurationInput {
  systemPrompt?: InputMaybe<string>;
  personality?: InputMaybe<PersonalityTraitsInput>;
  expertise?: InputMaybe<string[]>;
  communicationStyle?: InputMaybe<CommunicationStyleInput>;
  operationalHours?: InputMaybe<OperationalHoursInput>;
  metadata?: InputMaybe<JSON>;
}

// =============================================================================
// MUTATION INPUT TYPES
// =============================================================================

/**
 * GraphQL input for creating an Orchestrator
 * Matches CreateOrchestratorInput in schema.graphql
 */
export interface CreateOrchestratorInputGQL {
  /** Display name for the Orchestrator (required) */
  name: string;
  /** Optional custom slug (auto-generated from name if not provided) */
  slug?: InputMaybe<string>;
  /** Associated discipline ID (required) */
  disciplineId: string;
  /** Organization to create Orchestrator in (required) */
  organizationId: string;
  /** Orchestrator's role or title */
  role?: InputMaybe<string>;
  /** Description or bio */
  description?: InputMaybe<string>;
  /** Avatar URL */
  avatarUrl?: InputMaybe<string>;
  /** Initial capabilities list */
  capabilities?: InputMaybe<string[]>;
  /** Initial charter content */
  charter?: InputMaybe<string>;
  /** Initial configuration */
  configuration?: InputMaybe<OrchestratorConfigurationInput>;
}

/**
 * GraphQL input for updating an Orchestrator
 * Matches UpdateOrchestratorInput in schema.graphql
 */
export interface UpdateOrchestratorInputGQL {
  /** Updated display name */
  name?: InputMaybe<string>;
  /** Updated description */
  description?: InputMaybe<string>;
  /** Updated avatar URL */
  avatarUrl?: InputMaybe<string>;
  /** Updated role */
  role?: InputMaybe<string>;
  /** Updated capabilities list */
  capabilities?: InputMaybe<string[]>;
  /** Updated daemon endpoint */
  daemonEndpoint?: InputMaybe<string>;
  /** Updated charter content */
  charter?: InputMaybe<string>;
  /** Updated configuration (merged with existing) */
  configuration?: InputMaybe<OrchestratorConfigurationInput>;
}

/**
 * GraphQL input for activating an Orchestrator
 */
export interface ActivateOrchestratorInputGQL {
  /** OrchestratorID to activate */
  orchestratorId: UUID;
  /** Optional daemon endpoint to set during activation */
  daemonEndpoint?: InputMaybe<string>;
}

/**
 * GraphQL input for deactivating an Orchestrator
 */
export interface DeactivateOrchestratorInputGQL {
  /** OrchestratorID to deactivate */
  orchestratorId: UUID;
  /** Optional reason for deactivation */
  reason?: InputMaybe<string>;
}

/**
 * GraphQL input for creating an OrchestratorAPI key
 */
export interface CreateOrchestratorApiKeyInputGQL {
  /** OrchestratorID to create key for */
  orchestratorId: UUID;
  /** Optional name/description for the key */
  name?: InputMaybe<string>;
  /** Optional expiration date */
  expiresAt?: InputMaybe<DateTime>;
}

/**
 * GraphQL input for revoking an OrchestratorAPI key
 */
export interface RevokeOrchestratorApiKeyInputGQL {
  /** API key ID to revoke */
  keyId: UUID;
}

// =============================================================================
// QUERY INPUT TYPES
// =============================================================================

/**
 * GraphQL input for filtering Orchestrator queries
 */
export interface OrchestratorFilterInputGQL {
  /** Filter by status */
  status?: InputMaybe<OrchestratorStatus>;
  /** Filter by organization ID */
  organizationId?: InputMaybe<UUID>;
  /** Filter by discipline */
  discipline?: InputMaybe<string>;
  /** Search by name (partial match) */
  search?: InputMaybe<string>;
  /** Include deleted Orchestrators */
  includeDeleted?: InputMaybe<boolean>;
}

/**
 * Sortable fields for Orchestrator list queries
 */
export const OrchestratorSortFieldGQL = {
  Name: 'NAME',
  CreatedAt: 'CREATED_AT',
  UpdatedAt: 'UPDATED_AT',
  LastActiveAt: 'LAST_ACTIVE_AT',
} as const;

export type OrchestratorSortFieldGQL =
  (typeof OrchestratorSortFieldGQL)[keyof typeof OrchestratorSortFieldGQL];

/**
 * Sort direction for Orchestrator queries
 */
export const SortDirectionGQL = {
  Asc: 'ASC',
  Desc: 'DESC',
} as const;

export type SortDirectionGQL =
  (typeof SortDirectionGQL)[keyof typeof SortDirectionGQL];

/**
 * GraphQL input for sorting Orchestrator queries
 */
export interface OrchestratorSortInputGQL {
  field: OrchestratorSortFieldGQL;
  direction: SortDirectionGQL;
}

/**
 * GraphQL input for paginated Orchestrator list query
 */
export interface OrchestratorListInputGQL {
  /** Number of items to fetch (forward pagination) */
  first?: InputMaybe<number>;
  /** Cursor for forward pagination */
  after?: InputMaybe<string>;
  /** Number of items to fetch (backward pagination) */
  last?: InputMaybe<number>;
  /** Cursor for backward pagination */
  before?: InputMaybe<string>;
  /** Filter options */
  filter?: InputMaybe<OrchestratorFilterInputGQL>;
  /** Sort options */
  sort?: InputMaybe<OrchestratorSortInputGQL[]>;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

/**
 * Arguments for Orchestrator query (single Orchestrator by ID)
 */
export interface QueryOrchestratorArgs {
  id: UUID;
}

/**
 * Arguments for Orchestrators query (list with pagination)
 */
export interface QueryOrchestratorsArgs {
  input?: InputMaybe<OrchestratorListInputGQL>;
}

/**
 * Arguments for Orchestrator by slug query
 */
export interface QueryOrchestratorBySlugArgs {
  slug: string;
  organizationId: UUID;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

/**
 * Arguments for createOrchestrator mutation
 */
export interface MutationCreateOrchestratorArgs {
  input: CreateOrchestratorInputGQL;
}

/**
 * Arguments for updateOrchestrator mutation
 */
export interface MutationUpdateOrchestratorArgs {
  id: UUID;
  input: UpdateOrchestratorInputGQL;
}

/**
 * Arguments for deleteOrchestrator mutation
 */
export interface MutationDeleteOrchestratorArgs {
  id: UUID;
}

/**
 * Arguments for activateOrchestrator mutation
 */
export interface MutationActivateOrchestratorArgs {
  input: ActivateOrchestratorInputGQL;
}

/**
 * Arguments for deactivateOrchestrator mutation
 */
export interface MutationDeactivateOrchestratorArgs {
  input: DeactivateOrchestratorInputGQL;
}

/**
 * Arguments for createOrchestratorApiKey mutation
 */
export interface MutationCreateOrchestratorApiKeyArgs {
  input: CreateOrchestratorApiKeyInputGQL;
}

/**
 * Arguments for revokeOrchestratorApiKey mutation
 */
export interface MutationRevokeOrchestratorApiKeyArgs {
  input: RevokeOrchestratorApiKeyInputGQL;
}

// =============================================================================
// SUBSCRIPTION ARGUMENT TYPES
// =============================================================================

/**
 * Arguments for orchestratorUpdated subscription
 */
export interface SubscriptionOrchestratorUpdatedArgs {
  orchestratorId: UUID;
}

/**
 * Arguments for organizationOrchestratorsUpdated subscription
 */
export interface SubscriptionOrganizationOrchestratorsUpdatedArgs {
  organizationId: UUID;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if input is a valid CreateOrchestratorInputGQL
 */
export function isCreateOrchestratorInputGQL(
  input: unknown
): input is CreateOrchestratorInputGQL {
  if (typeof input !== 'object' || input === null) {
    return false;
  }
  const obj = input as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    typeof obj.disciplineId === 'string' &&
    typeof obj.organizationId === 'string'
  );
}

/**
 * Type guard to check if input is a valid UpdateOrchestratorInputGQL
 */
export function isUpdateOrchestratorInputGQL(
  input: unknown
): input is UpdateOrchestratorInputGQL {
  if (typeof input !== 'object' || input === null) {
    return false;
  }
  // Update input can have any combination of optional fields
  return true;
}
