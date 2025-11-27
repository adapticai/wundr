/**
 * OrchestratorType Definitions
 *
 * Comprehensive TypeScript types for Orchestrator provisioning, configuration,
 * and management within the Genesis App platform.
 *
 * @module @genesis/api-types/types/orchestrator
 */

// =============================================================================
// ORCHESTRATOR STATUS TYPES
// =============================================================================

/**
 * Orchestrator operational status enumeration
 */
export const OrchestratorStatus = {
  /** Orchestrator is actively running and responding */
  Active: 'ACTIVE',
  /** Orchestrator is provisioned but not currently active */
  Inactive: 'INACTIVE',
  /** Orchestrator is being set up or configured */
  Provisioning: 'PROVISIONING',
  /** Orchestrator encountered an error during operation or setup */
  Error: 'ERROR',
  /** Orchestrator has been soft-deleted */
  Deleted: 'DELETED',
} as const;

export type OrchestratorStatus = (typeof OrchestratorStatus)[keyof typeof OrchestratorStatus];

/**
 * Orchestrator online/presence status
 */
export const OrchestratorPresenceStatus = {
  Online: 'ONLINE',
  Offline: 'OFFLINE',
  Busy: 'BUSY',
  Away: 'AWAY',
} as const;

export type OrchestratorPresenceStatus =
  (typeof OrchestratorPresenceStatus)[keyof typeof OrchestratorPresenceStatus];

// =============================================================================
// PERSONALITY & CONFIGURATION TYPES
// =============================================================================

/**
 * Formality level for Orchestrator communication
 */
export type FormalityLevel = 'casual' | 'professional' | 'formal';

/**
 * Verbosity level for Orchestrator responses
 */
export type VerbosityLevel = 'concise' | 'balanced' | 'detailed';

/**
 * Tone for Orchestrator communication style
 */
export type ToneType = 'friendly' | 'neutral' | 'authoritative';

/**
 * Orchestrator personality configuration
 */
export interface PersonalityTraits {
  /** How formal the Orchestrator's communication style should be */
  formality: FormalityLevel;
  /** How verbose the Orchestrator's responses should be */
  verbosity: VerbosityLevel;
  /** The tone the Orchestrator should use */
  tone: ToneType;
}

/**
 * Communication style configuration
 */
export interface CommunicationStyle {
  /** Primary language for communication */
  primaryLanguage: string;
  /** Whether to use technical jargon */
  useTechnicalTerms: boolean;
  /** Whether to include examples in responses */
  includeExamples: boolean;
  /** Maximum response length in tokens (optional) */
  maxResponseLength?: number;
  /** Signature or sign-off style */
  signatureStyle?: string;
}

/**
 * Time range for operational hours
 */
export interface TimeRange {
  /** Start time in HH:MM format (24-hour) */
  start: string;
  /** End time in HH:MM format (24-hour) */
  end: string;
}

/**
 * Operational hours configuration
 */
export interface OperationalHours {
  /** Whether the Orchestrator is always available */
  alwaysAvailable: boolean;
  /** Timezone for operational hours (IANA format) */
  timezone: string;
  /** Hours for each day (0 = Sunday, 6 = Saturday) */
  schedule: {
    [day: number]: TimeRange[] | null;
  };
}

/**
 * Complete Orchestrator configuration
 */
export interface OrchestratorConfiguration {
  /** System prompt for the Orchestrator's behavior */
  systemPrompt: string;
  /** Personality traits configuration */
  personality: PersonalityTraits;
  /** Areas of expertise */
  expertise: string[];
  /** Communication style settings */
  communicationStyle: CommunicationStyle;
  /** When the Orchestrator is operational */
  operationalHours: OperationalHours;
  /** Custom metadata for extensions */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// CORE ORCHESTRATOR TYPES
// =============================================================================

/**
 * API key information for Orchestrator authentication
 */
export interface OrchestratorApiKey {
  /** Unique identifier for the API key */
  id: string;
  /** The key value (only shown on creation) */
  key?: string;
  /** Hashed version of the key stored in database */
  keyHash: string;
  /** Optional name/description for the key */
  name?: string;
  /** Whether the key has been revoked */
  isRevoked: boolean;
  /** When the key was created */
  createdAt: string;
  /** When the key was last used */
  lastUsedAt?: string;
  /** When the key expires (optional) */
  expiresAt?: string;
}

/**
 * Orchestrator discipline/department information
 */
export interface OrchestratorDiscipline {
  /** Unique identifier */
  id: string;
  /** Discipline name */
  name: string;
  /** Discipline slug for URL-friendly references */
  slug: string;
  /** Description of the discipline */
  description?: string;
  /** Icon or avatar URL */
  iconUrl?: string;
}

/**
 * Main Orchestrator entity type
 */
export interface Orchestrator {
  /** Unique identifier */
  id: string;
  /** URL-friendly unique slug */
  slug: string;
  /** Display name */
  name: string;
  /** Orchestrator operational status */
  status: OrchestratorStatus;
  /** Orchestrator presence/online status */
  presenceStatus: OrchestratorPresenceStatus;
  /** Associated discipline/department */
  discipline: string;
  /** Orchestrator's role or title */
  role: string;
  /** Description or bio */
  description?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** List of capabilities */
  capabilities: string[];
  /** Endpoint for daemon communication */
  daemonEndpoint?: string;
  /** Full configuration */
  configuration: OrchestratorConfiguration;
  /** Associated user ID */
  userId: string;
  /** Organization ID */
  organizationId: string;
  /** Charter document content */
  charter?: string;
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  /** Last time Orchestrator was active */
  lastActiveAt?: string;
}

/**
 * Orchestrator with related user information
 */
export interface OrchestratorWithUser extends Orchestrator {
  user: {
    id: string;
    email: string;
    name?: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

/**
 * Orchestrator with full relations
 */
export interface OrchestratorWithRelations extends OrchestratorWithUser {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  apiKeys?: OrchestratorApiKey[];
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a new Orchestrator
 */
export interface CreateOrchestratorInput {
  /** Display name for the Orchestrator */
  name: string;
  /** Associated discipline ID */
  disciplineId: string;
  /** Organization to create Orchestrator in */
  organizationId: string;
  /** Optional custom slug (auto-generated if not provided) */
  slug?: string;
  /** Orchestrator's role or title */
  role?: string;
  /** Description or bio */
  description?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Initial capabilities */
  capabilities?: string[];
  /** Initial charter content */
  charter?: string;
  /** Initial configuration (uses defaults if not provided) */
  configuration?: Partial<OrchestratorConfiguration>;
}

/**
 * Input for updating an existing Orchestrator
 */
export interface UpdateOrchestratorInput {
  /** Updated display name */
  name?: string;
  /** Updated description */
  description?: string;
  /** Updated avatar URL */
  avatarUrl?: string;
  /** Updated role */
  role?: string;
  /** Updated capabilities */
  capabilities?: string[];
  /** Updated daemon endpoint */
  daemonEndpoint?: string;
  /** Updated charter */
  charter?: string;
  /** Updated configuration (partial update supported) */
  configuration?: Partial<OrchestratorConfiguration>;
}

/**
 * Input for activating an Orchestrator
 */
export interface ActivateOrchestratorInput {
  /** OrchestratorID to activate */
  orchestratorId: string;
  /** Optional daemon endpoint to set during activation */
  daemonEndpoint?: string;
}

/**
 * Input for deactivating an Orchestrator
 */
export interface DeactivateOrchestratorInput {
  /** OrchestratorID to deactivate */
  orchestratorId: string;
  /** Reason for deactivation */
  reason?: string;
}

/**
 * Input for creating an OrchestratorAPI key
 */
export interface CreateOrchestratorApiKeyInput {
  /** OrchestratorID to create key for */
  orchestratorId: string;
  /** Optional name/description for the key */
  name?: string;
  /** Optional expiration date */
  expiresAt?: string;
}

// =============================================================================
// FILTER & QUERY TYPES
// =============================================================================

/**
 * Filter options for Orchestrator queries
 */
export interface OrchestratorFilterInput {
  /** Filter by status */
  status?: OrchestratorStatus;
  /** Filter by presence status */
  presenceStatus?: OrchestratorPresenceStatus;
  /** Filter by organization ID */
  organizationId?: string;
  /** Filter by discipline */
  discipline?: string;
  /** Search by name */
  search?: string;
  /** Include deleted Orchestrators */
  includeDeleted?: boolean;
}

/**
 * Sortable fields for Orchestrator queries
 */
export type OrchestratorSortField = 'name' | 'createdAt' | 'updatedAt' | 'lastActiveAt';

/**
 * Sort direction
 */
export type SortDirection = 'ASC' | 'DESC';

/**
 * Sort options for Orchestrator queries
 */
export interface OrchestratorSortInput {
  field: OrchestratorSortField;
  direction: SortDirection;
}

// =============================================================================
// RESPONSE/PAYLOAD TYPES
// =============================================================================

/**
 * Orchestrator creation result
 */
export interface CreateOrchestratorPayload {
  /** Created Orchestrator (null if errors occurred) */
  orchestrator: Orchestrator | null;
  /** Associated user created for the Orchestrator */
  user: { id: string; email: string } | null;
  /** Generated API key (only available on creation) */
  apiKey: { key: string; id: string } | null;
  /** Any errors that occurred */
  errors: OrchestratorError[];
}

/**
 * Orchestrator update result
 */
export interface UpdateOrchestratorPayload {
  /** Updated Orchestrator (null if errors occurred) */
  orchestrator: Orchestrator | null;
  /** Any errors that occurred */
  errors: OrchestratorError[];
}

/**
 * Orchestrator activation result
 */
export interface ActivateOrchestratorPayload {
  /** Activated Orchestrator (null if errors occurred) */
  orchestrator: Orchestrator | null;
  /** Whether activation was successful */
  success: boolean;
  /** Any errors that occurred */
  errors: OrchestratorError[];
}

/**
 * Orchestrator deletion result
 */
export interface DeleteOrchestratorPayload {
  /** Whether deletion was successful */
  success: boolean;
  /** Any errors that occurred */
  errors: OrchestratorError[];
}

/**
 * API key creation result
 */
export interface CreateOrchestratorApiKeyPayload {
  /** Created API key (key value only available here) */
  apiKey: OrchestratorApiKey | null;
  /** Any errors that occurred */
  errors: OrchestratorError[];
}

/**
 * API key validation result
 */
export interface ValidateOrchestratorApiKeyResult {
  /** Whether the key is valid */
  isValid: boolean;
  /** Orchestrator associated with the key (if valid) */
  orchestrator: Orchestrator | null;
  /** Reason for invalidity (if invalid) */
  reason?: 'INVALID_KEY' | 'REVOKED' | 'EXPIRED' | 'ORCHESTRATOR_DELETED';
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Orchestrator-specific error codes
 */
export const OrchestratorErrorCode = {
  /** Orchestrator not found */
  NotFound: 'ORCHESTRATOR_NOT_FOUND',
  /** Orchestrator already exists with given slug */
  DuplicateSlug: 'ORCHESTRATOR_DUPLICATE_SLUG',
  /** Invalid Orchestrator status transition */
  InvalidStatusTransition: 'ORCHESTRATOR_INVALID_STATUS_TRANSITION',
  /** Orchestrator is deleted */
  Deleted: 'ORCHESTRATOR_DELETED',
  /** Invalid configuration */
  InvalidConfiguration: 'ORCHESTRATOR_INVALID_CONFIGURATION',
  /** Invalid API key */
  InvalidApiKey: 'ORCHESTRATOR_INVALID_API_KEY',
  /** API key revoked */
  ApiKeyRevoked: 'ORCHESTRATOR_API_KEY_REVOKED',
  /** API key expired */
  ApiKeyExpired: 'ORCHESTRATOR_API_KEY_EXPIRED',
  /** Organization not found */
  OrganizationNotFound: 'ORCHESTRATOR_ORGANIZATION_NOT_FOUND',
  /** Discipline not found */
  DisciplineNotFound: 'ORCHESTRATOR_DISCIPLINE_NOT_FOUND',
  /** Permission denied */
  PermissionDenied: 'ORCHESTRATOR_PERMISSION_DENIED',
  /** Validation error */
  ValidationError: 'ORCHESTRATOR_VALIDATION_ERROR',
} as const;

export type OrchestratorErrorCode = (typeof OrchestratorErrorCode)[keyof typeof OrchestratorErrorCode];

/**
 * Orchestrator error structure
 */
export interface OrchestratorError {
  /** Error code */
  code: OrchestratorErrorCode;
  /** Human-readable error message */
  message: string;
  /** Path to the field that caused the error (for validation errors) */
  path?: string[];
  /** Additional error details */
  extensions?: Record<string, unknown>;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * Orchestrator event types for real-time updates
 */
export const OrchestratorEventType = {
  Created: 'ORCHESTRATOR_CREATED',
  Updated: 'ORCHESTRATOR_UPDATED',
  Deleted: 'ORCHESTRATOR_DELETED',
  StatusChanged: 'ORCHESTRATOR_STATUS_CHANGED',
  PresenceChanged: 'ORCHESTRATOR_PRESENCE_CHANGED',
  ApiKeyCreated: 'ORCHESTRATOR_API_KEY_CREATED',
  ApiKeyRevoked: 'ORCHESTRATOR_API_KEY_REVOKED',
} as const;

export type OrchestratorEventType = (typeof OrchestratorEventType)[keyof typeof OrchestratorEventType];

/**
 * Orchestrator event structure
 */
export interface OrchestratorEvent {
  /** Event type */
  type: OrchestratorEventType;
  /** OrchestratorID */
  orchestratorId: string;
  /** Organization ID */
  organizationId: string;
  /** Event timestamp */
  timestamp: string;
  /** Event payload */
  payload: {
    /** Previous state (for updates) */
    previous?: Partial<Orchestrator>;
    /** Current state */
    current?: Partial<Orchestrator>;
    /** Actor who triggered the event */
    actor?: {
      id: string;
      type: 'USER' | 'SYSTEM' | 'ORCHESTRATOR';
    };
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Orchestrator list connection type for pagination
 */
export interface OrchestratorConnection {
  edges: OrchestratorEdge[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
  totalCount: number;
}

/**
 * Orchestrator edge for cursor-based pagination
 */
export interface OrchestratorEdge {
  cursor: string;
  node: Orchestrator;
}

/**
 * Default Orchestrator configuration factory
 */
export function createDefaultOrchestratorConfiguration(): OrchestratorConfiguration {
  return {
    systemPrompt: '',
    personality: {
      formality: 'professional',
      verbosity: 'balanced',
      tone: 'friendly',
    },
    expertise: [],
    communicationStyle: {
      primaryLanguage: 'en',
      useTechnicalTerms: true,
      includeExamples: true,
    },
    operationalHours: {
      alwaysAvailable: true,
      timezone: 'UTC',
      schedule: {},
    },
  };
}
