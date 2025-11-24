/**
 * VP GraphQL Input Types
 *
 * Codegen-friendly input types that match the GraphQL schema.
 * These types are designed to work with Apollo Client and graphql-codegen.
 *
 * @module @genesis/api-types/types/vp-inputs
 */

import type {
  FormalityLevel,
  ToneType,
  VerbosityLevel,
  VPStatus,
} from './vp.js';

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
 * GraphQL input for VP configuration
 */
export interface VPConfigurationInput {
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
 * GraphQL input for creating a VP
 * Matches CreateVPInput in schema.graphql
 */
export interface CreateVPInputGQL {
  /** Display name for the VP (required) */
  name: string;
  /** Optional custom slug (auto-generated from name if not provided) */
  slug?: InputMaybe<string>;
  /** Associated discipline ID (required) */
  disciplineId: string;
  /** Organization to create VP in (required) */
  organizationId: string;
  /** VP's role or title */
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
  configuration?: InputMaybe<VPConfigurationInput>;
}

/**
 * GraphQL input for updating a VP
 * Matches UpdateVPInput in schema.graphql
 */
export interface UpdateVPInputGQL {
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
  configuration?: InputMaybe<VPConfigurationInput>;
}

/**
 * GraphQL input for activating a VP
 */
export interface ActivateVPInputGQL {
  /** VP ID to activate */
  vpId: UUID;
  /** Optional daemon endpoint to set during activation */
  daemonEndpoint?: InputMaybe<string>;
}

/**
 * GraphQL input for deactivating a VP
 */
export interface DeactivateVPInputGQL {
  /** VP ID to deactivate */
  vpId: UUID;
  /** Optional reason for deactivation */
  reason?: InputMaybe<string>;
}

/**
 * GraphQL input for creating a VP API key
 */
export interface CreateVPApiKeyInputGQL {
  /** VP ID to create key for */
  vpId: UUID;
  /** Optional name/description for the key */
  name?: InputMaybe<string>;
  /** Optional expiration date */
  expiresAt?: InputMaybe<DateTime>;
}

/**
 * GraphQL input for revoking a VP API key
 */
export interface RevokeVPApiKeyInputGQL {
  /** API key ID to revoke */
  keyId: UUID;
}

// =============================================================================
// QUERY INPUT TYPES
// =============================================================================

/**
 * GraphQL input for filtering VP queries
 */
export interface VPFilterInputGQL {
  /** Filter by status */
  status?: InputMaybe<VPStatus>;
  /** Filter by organization ID */
  organizationId?: InputMaybe<UUID>;
  /** Filter by discipline */
  discipline?: InputMaybe<string>;
  /** Search by name (partial match) */
  search?: InputMaybe<string>;
  /** Include deleted VPs */
  includeDeleted?: InputMaybe<boolean>;
}

/**
 * Sortable fields for VP list queries
 */
export const VPSortFieldGQL = {
  Name: 'NAME',
  CreatedAt: 'CREATED_AT',
  UpdatedAt: 'UPDATED_AT',
  LastActiveAt: 'LAST_ACTIVE_AT',
} as const;

export type VPSortFieldGQL =
  (typeof VPSortFieldGQL)[keyof typeof VPSortFieldGQL];

/**
 * Sort direction for VP queries
 */
export const SortDirectionGQL = {
  Asc: 'ASC',
  Desc: 'DESC',
} as const;

export type SortDirectionGQL =
  (typeof SortDirectionGQL)[keyof typeof SortDirectionGQL];

/**
 * GraphQL input for sorting VP queries
 */
export interface VPSortInputGQL {
  field: VPSortFieldGQL;
  direction: SortDirectionGQL;
}

/**
 * GraphQL input for paginated VP list query
 */
export interface VPListInputGQL {
  /** Number of items to fetch (forward pagination) */
  first?: InputMaybe<number>;
  /** Cursor for forward pagination */
  after?: InputMaybe<string>;
  /** Number of items to fetch (backward pagination) */
  last?: InputMaybe<number>;
  /** Cursor for backward pagination */
  before?: InputMaybe<string>;
  /** Filter options */
  filter?: InputMaybe<VPFilterInputGQL>;
  /** Sort options */
  sort?: InputMaybe<VPSortInputGQL[]>;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

/**
 * Arguments for VP query (single VP by ID)
 */
export interface QueryVPArgs {
  id: UUID;
}

/**
 * Arguments for VPs query (list with pagination)
 */
export interface QueryVPsArgs {
  input?: InputMaybe<VPListInputGQL>;
}

/**
 * Arguments for VP by slug query
 */
export interface QueryVPBySlugArgs {
  slug: string;
  organizationId: UUID;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

/**
 * Arguments for createVP mutation
 */
export interface MutationCreateVPArgs {
  input: CreateVPInputGQL;
}

/**
 * Arguments for updateVP mutation
 */
export interface MutationUpdateVPArgs {
  id: UUID;
  input: UpdateVPInputGQL;
}

/**
 * Arguments for deleteVP mutation
 */
export interface MutationDeleteVPArgs {
  id: UUID;
}

/**
 * Arguments for activateVP mutation
 */
export interface MutationActivateVPArgs {
  input: ActivateVPInputGQL;
}

/**
 * Arguments for deactivateVP mutation
 */
export interface MutationDeactivateVPArgs {
  input: DeactivateVPInputGQL;
}

/**
 * Arguments for createVPApiKey mutation
 */
export interface MutationCreateVPApiKeyArgs {
  input: CreateVPApiKeyInputGQL;
}

/**
 * Arguments for revokeVPApiKey mutation
 */
export interface MutationRevokeVPApiKeyArgs {
  input: RevokeVPApiKeyInputGQL;
}

// =============================================================================
// SUBSCRIPTION ARGUMENT TYPES
// =============================================================================

/**
 * Arguments for vpUpdated subscription
 */
export interface SubscriptionVPUpdatedArgs {
  vpId: UUID;
}

/**
 * Arguments for organizationVPsUpdated subscription
 */
export interface SubscriptionOrganizationVPsUpdatedArgs {
  organizationId: UUID;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if input is a valid CreateVPInputGQL
 */
export function isCreateVPInputGQL(
  input: unknown
): input is CreateVPInputGQL {
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
 * Type guard to check if input is a valid UpdateVPInputGQL
 */
export function isUpdateVPInputGQL(
  input: unknown
): input is UpdateVPInputGQL {
  if (typeof input !== 'object' || input === null) {
    return false;
  }
  // Update input can have any combination of optional fields
  return true;
}
