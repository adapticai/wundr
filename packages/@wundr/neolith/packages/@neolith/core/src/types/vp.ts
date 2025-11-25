/**
 * @genesis/core - VP (Virtual Person) Type Definitions
 *
 * Type definitions for VP service operations including CRUD,
 * service account management, and configuration.
 *
 * @packageDocumentation
 */

import type { VP, User, VPStatus } from '@genesis/database';

// =============================================================================
// VP Core Types
// =============================================================================

/**
 * VP entity with associated user data.
 * Represents the complete VP profile including the linked User record.
 */
export interface VPWithUser extends VP {
  user: User;
}

/**
 * VP charter configuration stored as JSON.
 * Defines the AI agent's personality, expertise, and operational parameters.
 */
export interface VPCharter {
  /** System prompt defining the VP's role and behavior */
  systemPrompt: string;

  /** Personality traits and characteristics */
  personality: VPPersonality;

  /** Areas of expertise and knowledge domains */
  expertise: string[];

  /** Communication preferences and style */
  communication: VPCommunicationPreferences;

  /** Operational parameters */
  operational: VPOperationalConfig;
}

/**
 * VP personality configuration.
 */
export interface VPPersonality {
  /** Communication tone (e.g., professional, friendly, formal) */
  tone: string;

  /** Decision-making approach */
  decisionStyle: string;

  /** Background narrative for context */
  background: string;

  /** Key personality traits */
  traits: string[];

  /** Preferred interaction patterns */
  interactionStyle: string;
}

/**
 * VP communication preferences.
 */
export interface VPCommunicationPreferences {
  /** Preferred response length (concise, moderate, detailed) */
  responseLength: 'concise' | 'moderate' | 'detailed';

  /** Use of technical jargon */
  technicalLevel: 'basic' | 'intermediate' | 'advanced' | 'expert';

  /** Formality level */
  formality: 'casual' | 'professional' | 'formal';

  /** Languages supported */
  languages: string[];

  /** Preferred communication channels */
  preferredChannels: string[];
}

/**
 * VP operational configuration.
 */
export interface VPOperationalConfig {
  /** Working hours (timezone-aware) */
  workHours: VPWorkHours;

  /** Target response time in seconds */
  targetResponseTimeSeconds: number;

  /** Maximum concurrent conversations */
  maxConcurrentConversations: number;

  /** Auto-response when offline */
  offlineMessage?: string;

  /** Escalation rules */
  escalation: VPEscalationConfig;
}

/**
 * VP work hours configuration.
 */
export interface VPWorkHours {
  /** Timezone identifier (e.g., 'America/New_York') */
  timezone: string;

  /** Schedule per day of week (0 = Sunday) */
  schedule: Record<number, { start: string; end: string } | null>;

  /** Whether to operate 24/7 regardless of schedule */
  always24x7: boolean;
}

/**
 * VP escalation configuration.
 */
export interface VPEscalationConfig {
  /** Enable automatic escalation */
  enabled: boolean;

  /** User IDs to escalate to */
  escalateTo: string[];

  /** Conditions that trigger escalation */
  triggers: string[];
}

// =============================================================================
// VP Input Types
// =============================================================================

/**
 * Input for creating a new VP.
 */
export interface CreateVPInput {
  /** Display name for the VP */
  name: string;

  /** Discipline/department the VP belongs to */
  discipline: string;

  /** Role title (e.g., "VP of Engineering") */
  role: string;

  /** Organization ID the VP belongs to */
  organizationId: string;

  /** Optional discipline ID for categorization */
  disciplineId?: string;

  /** Email address for the VP's user account */
  email?: string;

  /** VP capabilities as JSON-serializable array */
  capabilities?: string[];

  /** Optional daemon endpoint URL */
  daemonEndpoint?: string;

  /** Initial VP status */
  status?: VPStatus;

  /** Charter configuration */
  charter?: Partial<VPCharter>;

  /** Bio/description */
  bio?: string;

  /** Avatar URL */
  avatarUrl?: string;
}

/**
 * Input for updating an existing VP.
 */
export interface UpdateVPInput {
  /** Updated display name */
  name?: string;

  /** Updated discipline */
  discipline?: string;

  /** Updated role */
  role?: string;

  /** Updated capabilities */
  capabilities?: string[];

  /** Updated daemon endpoint */
  daemonEndpoint?: string;

  /** Updated charter configuration */
  charter?: Partial<VPCharter>;

  /** Updated bio */
  bio?: string;

  /** Updated avatar URL */
  avatarUrl?: string;
}

// =============================================================================
// Service Account Types
// =============================================================================

/**
 * Service account credentials for API authentication.
 */
export interface ServiceAccountCredentials {
  /** The API key (only returned once upon creation) */
  key: string;

  /** Hash of the API key for storage */
  keyHash: string;

  /** Key prefix for identification (first 8 chars) */
  keyPrefix: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Expiration timestamp (if applicable) */
  expiresAt?: Date;
}

/**
 * Result of API key generation.
 */
export interface APIKeyGenerationResult {
  /** The generated API key (only shown once) */
  key: string;

  /** Hash of the key for verification */
  keyHash: string;

  /** Key prefix for identification */
  keyPrefix: string;
}

/**
 * Result of API key rotation.
 */
export interface APIKeyRotationResult {
  /** The new API key */
  key: string;

  /** Hash of the new key */
  keyHash: string;

  /** Key prefix for identification */
  keyPrefix: string;

  /** Timestamp of the old key revocation */
  previousKeyRevokedAt: Date;
}

/**
 * API key validation result.
 */
export interface APIKeyValidationResult {
  /** Whether the key is valid */
  valid: boolean;

  /** The VP associated with the key (if valid) */
  vp?: VPWithUser;

  /** Reason for invalidity (if invalid) */
  reason?: 'invalid' | 'expired' | 'revoked' | 'not_found';
}

// =============================================================================
// VP Service Account Configuration
// =============================================================================

/**
 * VP service account stored configuration.
 * Stored in the User.vpConfig JSON field.
 */
export interface VPServiceAccountConfig {
  /** Hash of the current API key */
  apiKeyHash?: string;

  /** Prefix of the current API key (for display) */
  apiKeyPrefix?: string;

  /** When the API key was created */
  apiKeyCreatedAt?: string;

  /** When the API key expires (ISO string) */
  apiKeyExpiresAt?: string;

  /** Whether the API key has been revoked */
  apiKeyRevoked?: boolean;

  /** Charter configuration */
  charter?: VPCharter;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// VP Query Types
// =============================================================================

/**
 * Options for listing VPs.
 */
export interface ListVPsOptions {
  /** Filter by organization ID */
  organizationId?: string;

  /** Filter by discipline */
  discipline?: string;

  /** Filter by status */
  status?: VPStatus;

  /** Include inactive VPs */
  includeInactive?: boolean;

  /** Pagination: number of records to skip */
  skip?: number;

  /** Pagination: number of records to take */
  take?: number;

  /** Order by field */
  orderBy?: 'createdAt' | 'name' | 'discipline' | 'status';

  /** Order direction */
  orderDirection?: 'asc' | 'desc';
}

/**
 * Paginated VP list result.
 */
export interface PaginatedVPResult {
  /** List of VPs */
  data: VPWithUser[];

  /** Total count of matching VPs */
  total: number;

  /** Whether there are more results */
  hasMore: boolean;

  /** Cursor for next page (if applicable) */
  nextCursor?: string;
}

// =============================================================================
// VP Event Types
// =============================================================================

/**
 * VP lifecycle events for auditing and webhooks.
 */
export type VPEventType =
  | 'vp.created'
  | 'vp.updated'
  | 'vp.activated'
  | 'vp.deactivated'
  | 'vp.deleted'
  | 'vp.api_key.generated'
  | 'vp.api_key.rotated'
  | 'vp.api_key.revoked';

/**
 * VP event payload.
 */
export interface VPEvent {
  /** Event type */
  type: VPEventType;

  /** VP ID */
  vpId: string;

  /** Organization ID */
  organizationId: string;

  /** Event timestamp */
  timestamp: Date;

  /** Additional event data */
  data?: Record<string, unknown>;

  /** Actor who triggered the event */
  actorId?: string;
}

// =============================================================================
// VP Utility Types
// =============================================================================

/**
 * Slug generation options.
 */
export interface SlugOptions {
  /** Maximum length of the slug */
  maxLength?: number;

  /** Separator character */
  separator?: string;

  /** Whether to append a unique suffix */
  appendUniqueSuffix?: boolean;
}

/**
 * Type guard to check if a JSON value is a VPCharter.
 */
export function isVPCharter(value: unknown): value is VPCharter {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.systemPrompt === 'string' &&
    typeof obj.personality === 'object' &&
    Array.isArray(obj.expertise)
  );
}

/**
 * Type guard to check if a JSON value is a VPServiceAccountConfig.
 */
export function isVPServiceAccountConfig(value: unknown): value is VPServiceAccountConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // VPServiceAccountConfig can be an empty object
  return true;
}

/**
 * Default VP charter template.
 */
export const DEFAULT_VP_CHARTER: VPCharter = {
  systemPrompt: 'You are an AI assistant representing a Virtual Person in an organization.',
  personality: {
    tone: 'professional',
    decisionStyle: 'analytical',
    background: 'AI-powered organizational agent',
    traits: ['helpful', 'knowledgeable', 'responsive'],
    interactionStyle: 'collaborative',
  },
  expertise: [],
  communication: {
    responseLength: 'moderate',
    technicalLevel: 'intermediate',
    formality: 'professional',
    languages: ['en'],
    preferredChannels: ['chat'],
  },
  operational: {
    workHours: {
      timezone: 'UTC',
      schedule: {},
      always24x7: true,
    },
    targetResponseTimeSeconds: 30,
    maxConcurrentConversations: 10,
    escalation: {
      enabled: false,
      escalateTo: [],
      triggers: [],
    },
  },
};
