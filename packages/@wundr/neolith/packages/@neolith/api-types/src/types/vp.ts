/**
 * VP (Virtual Person) Type Definitions
 *
 * Comprehensive TypeScript types for VP provisioning, configuration,
 * and management within the Genesis App platform.
 *
 * @module @genesis/api-types/types/vp
 */

// =============================================================================
// VP STATUS TYPES
// =============================================================================

/**
 * VP operational status enumeration
 */
export const VPStatus = {
  /** VP is actively running and responding */
  Active: 'ACTIVE',
  /** VP is provisioned but not currently active */
  Inactive: 'INACTIVE',
  /** VP is being set up or configured */
  Provisioning: 'PROVISIONING',
  /** VP encountered an error during operation or setup */
  Error: 'ERROR',
  /** VP has been soft-deleted */
  Deleted: 'DELETED',
} as const;

export type VPStatus = (typeof VPStatus)[keyof typeof VPStatus];

/**
 * VP online/presence status
 */
export const VPPresenceStatus = {
  Online: 'ONLINE',
  Offline: 'OFFLINE',
  Busy: 'BUSY',
  Away: 'AWAY',
} as const;

export type VPPresenceStatus =
  (typeof VPPresenceStatus)[keyof typeof VPPresenceStatus];

// =============================================================================
// PERSONALITY & CONFIGURATION TYPES
// =============================================================================

/**
 * Formality level for VP communication
 */
export type FormalityLevel = 'casual' | 'professional' | 'formal';

/**
 * Verbosity level for VP responses
 */
export type VerbosityLevel = 'concise' | 'balanced' | 'detailed';

/**
 * Tone for VP communication style
 */
export type ToneType = 'friendly' | 'neutral' | 'authoritative';

/**
 * VP personality configuration
 */
export interface PersonalityTraits {
  /** How formal the VP's communication style should be */
  formality: FormalityLevel;
  /** How verbose the VP's responses should be */
  verbosity: VerbosityLevel;
  /** The tone the VP should use */
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
  /** Whether the VP is always available */
  alwaysAvailable: boolean;
  /** Timezone for operational hours (IANA format) */
  timezone: string;
  /** Hours for each day (0 = Sunday, 6 = Saturday) */
  schedule: {
    [day: number]: TimeRange[] | null;
  };
}

/**
 * Complete VP configuration
 */
export interface VPConfiguration {
  /** System prompt for the VP's behavior */
  systemPrompt: string;
  /** Personality traits configuration */
  personality: PersonalityTraits;
  /** Areas of expertise */
  expertise: string[];
  /** Communication style settings */
  communicationStyle: CommunicationStyle;
  /** When the VP is operational */
  operationalHours: OperationalHours;
  /** Custom metadata for extensions */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// CORE VP TYPES
// =============================================================================

/**
 * API key information for VP authentication
 */
export interface VPApiKey {
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
 * VP discipline/department information
 */
export interface VPDiscipline {
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
 * Main VP entity type
 */
export interface VP {
  /** Unique identifier */
  id: string;
  /** URL-friendly unique slug */
  slug: string;
  /** Display name */
  name: string;
  /** VP operational status */
  status: VPStatus;
  /** VP presence/online status */
  presenceStatus: VPPresenceStatus;
  /** Associated discipline/department */
  discipline: string;
  /** VP's role or title */
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
  configuration: VPConfiguration;
  /** Associated user ID */
  userId: string;
  /** Organization ID */
  organizationId: string;
  /** Charter document content */
  charter?: string;
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  /** Last time VP was active */
  lastActiveAt?: string;
}

/**
 * VP with related user information
 */
export interface VPWithUser extends VP {
  user: {
    id: string;
    email: string;
    name?: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

/**
 * VP with full relations
 */
export interface VPWithRelations extends VPWithUser {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  apiKeys?: VPApiKey[];
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a new VP
 */
export interface CreateVPInput {
  /** Display name for the VP */
  name: string;
  /** Associated discipline ID */
  disciplineId: string;
  /** Organization to create VP in */
  organizationId: string;
  /** Optional custom slug (auto-generated if not provided) */
  slug?: string;
  /** VP's role or title */
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
  configuration?: Partial<VPConfiguration>;
}

/**
 * Input for updating an existing VP
 */
export interface UpdateVPInput {
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
  configuration?: Partial<VPConfiguration>;
}

/**
 * Input for activating a VP
 */
export interface ActivateVPInput {
  /** VP ID to activate */
  vpId: string;
  /** Optional daemon endpoint to set during activation */
  daemonEndpoint?: string;
}

/**
 * Input for deactivating a VP
 */
export interface DeactivateVPInput {
  /** VP ID to deactivate */
  vpId: string;
  /** Reason for deactivation */
  reason?: string;
}

/**
 * Input for creating a VP API key
 */
export interface CreateVPApiKeyInput {
  /** VP ID to create key for */
  vpId: string;
  /** Optional name/description for the key */
  name?: string;
  /** Optional expiration date */
  expiresAt?: string;
}

// =============================================================================
// FILTER & QUERY TYPES
// =============================================================================

/**
 * Filter options for VP queries
 */
export interface VPFilterInput {
  /** Filter by status */
  status?: VPStatus;
  /** Filter by presence status */
  presenceStatus?: VPPresenceStatus;
  /** Filter by organization ID */
  organizationId?: string;
  /** Filter by discipline */
  discipline?: string;
  /** Search by name */
  search?: string;
  /** Include deleted VPs */
  includeDeleted?: boolean;
}

/**
 * Sortable fields for VP queries
 */
export type VPSortField = 'name' | 'createdAt' | 'updatedAt' | 'lastActiveAt';

/**
 * Sort direction
 */
export type SortDirection = 'ASC' | 'DESC';

/**
 * Sort options for VP queries
 */
export interface VPSortInput {
  field: VPSortField;
  direction: SortDirection;
}

// =============================================================================
// RESPONSE/PAYLOAD TYPES
// =============================================================================

/**
 * VP creation result
 */
export interface CreateVPPayload {
  /** Created VP (null if errors occurred) */
  vp: VP | null;
  /** Associated user created for the VP */
  user: { id: string; email: string } | null;
  /** Generated API key (only available on creation) */
  apiKey: { key: string; id: string } | null;
  /** Any errors that occurred */
  errors: VPError[];
}

/**
 * VP update result
 */
export interface UpdateVPPayload {
  /** Updated VP (null if errors occurred) */
  vp: VP | null;
  /** Any errors that occurred */
  errors: VPError[];
}

/**
 * VP activation result
 */
export interface ActivateVPPayload {
  /** Activated VP (null if errors occurred) */
  vp: VP | null;
  /** Whether activation was successful */
  success: boolean;
  /** Any errors that occurred */
  errors: VPError[];
}

/**
 * VP deletion result
 */
export interface DeleteVPPayload {
  /** Whether deletion was successful */
  success: boolean;
  /** Any errors that occurred */
  errors: VPError[];
}

/**
 * API key creation result
 */
export interface CreateVPApiKeyPayload {
  /** Created API key (key value only available here) */
  apiKey: VPApiKey | null;
  /** Any errors that occurred */
  errors: VPError[];
}

/**
 * API key validation result
 */
export interface ValidateVPApiKeyResult {
  /** Whether the key is valid */
  isValid: boolean;
  /** VP associated with the key (if valid) */
  vp: VP | null;
  /** Reason for invalidity (if invalid) */
  reason?: 'INVALID_KEY' | 'REVOKED' | 'EXPIRED' | 'VP_DELETED';
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * VP-specific error codes
 */
export const VPErrorCode = {
  /** VP not found */
  NotFound: 'VP_NOT_FOUND',
  /** VP already exists with given slug */
  DuplicateSlug: 'VP_DUPLICATE_SLUG',
  /** Invalid VP status transition */
  InvalidStatusTransition: 'VP_INVALID_STATUS_TRANSITION',
  /** VP is deleted */
  Deleted: 'VP_DELETED',
  /** Invalid configuration */
  InvalidConfiguration: 'VP_INVALID_CONFIGURATION',
  /** Invalid API key */
  InvalidApiKey: 'VP_INVALID_API_KEY',
  /** API key revoked */
  ApiKeyRevoked: 'VP_API_KEY_REVOKED',
  /** API key expired */
  ApiKeyExpired: 'VP_API_KEY_EXPIRED',
  /** Organization not found */
  OrganizationNotFound: 'VP_ORGANIZATION_NOT_FOUND',
  /** Discipline not found */
  DisciplineNotFound: 'VP_DISCIPLINE_NOT_FOUND',
  /** Permission denied */
  PermissionDenied: 'VP_PERMISSION_DENIED',
  /** Validation error */
  ValidationError: 'VP_VALIDATION_ERROR',
} as const;

export type VPErrorCode = (typeof VPErrorCode)[keyof typeof VPErrorCode];

/**
 * VP error structure
 */
export interface VPError {
  /** Error code */
  code: VPErrorCode;
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
 * VP event types for real-time updates
 */
export const VPEventType = {
  Created: 'VP_CREATED',
  Updated: 'VP_UPDATED',
  Deleted: 'VP_DELETED',
  StatusChanged: 'VP_STATUS_CHANGED',
  PresenceChanged: 'VP_PRESENCE_CHANGED',
  ApiKeyCreated: 'VP_API_KEY_CREATED',
  ApiKeyRevoked: 'VP_API_KEY_REVOKED',
} as const;

export type VPEventType = (typeof VPEventType)[keyof typeof VPEventType];

/**
 * VP event structure
 */
export interface VPEvent {
  /** Event type */
  type: VPEventType;
  /** VP ID */
  vpId: string;
  /** Organization ID */
  organizationId: string;
  /** Event timestamp */
  timestamp: string;
  /** Event payload */
  payload: {
    /** Previous state (for updates) */
    previous?: Partial<VP>;
    /** Current state */
    current?: Partial<VP>;
    /** Actor who triggered the event */
    actor?: {
      id: string;
      type: 'USER' | 'SYSTEM' | 'VP';
    };
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * VP list connection type for pagination
 */
export interface VPConnection {
  edges: VPEdge[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
  totalCount: number;
}

/**
 * VP edge for cursor-based pagination
 */
export interface VPEdge {
  cursor: string;
  node: VP;
}

/**
 * Default VP configuration factory
 */
export function createDefaultVPConfiguration(): VPConfiguration {
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
