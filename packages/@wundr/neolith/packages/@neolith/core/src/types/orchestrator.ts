/**
 * @genesis/core - Orchestrator (Virtual Person) Type Definitions
 *
 * Type definitions for Orchestrator service operations including CRUD,
 * service account management, and configuration.
 *
 * @packageDocumentation
 */

import type { User, Orchestrator, OrchestratorStatus } from '@neolith/database';

// =============================================================================
// OrchestratorCore Types
// =============================================================================

/**
 * Orchestrator entity with associated user data.
 * Represents the complete Orchestrator profile including the linked User record.
 */
export interface OrchestratorWithUser extends Orchestrator {
  /** The associated user record */
  user: User;
  /** The user ID (foreign key) */
  userId: string;
}

/**
 * Orchestrator charter configuration stored as JSON.
 * Defines the AI agent's personality, expertise, and operational parameters.
 */
export interface OrchestratorCharter {
  /** System prompt defining the Orchestrator's role and behavior */
  systemPrompt: string;

  /** Personality traits and characteristics */
  personality: OrchestratorPersonality;

  /** Areas of expertise and knowledge domains */
  expertise: string[];

  /** Communication preferences and style */
  communication: OrchestratorCommunicationPreferences;

  /** Operational parameters */
  operational: OrchestratorOperationalConfig;
}

/**
 * Orchestrator personality configuration.
 */
export interface OrchestratorPersonality {
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
 * Orchestrator communication preferences.
 */
export interface OrchestratorCommunicationPreferences {
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
 * Orchestrator operational configuration.
 */
export interface OrchestratorOperationalConfig {
  /** Working hours (timezone-aware) */
  workHours: OrchestratorWorkHours;

  /** Target response time in seconds */
  targetResponseTimeSeconds: number;

  /** Maximum concurrent conversations */
  maxConcurrentConversations: number;

  /** Auto-response when offline */
  offlineMessage?: string;

  /** Escalation rules */
  escalation: OrchestratorEscalationConfig;
}

/**
 * Orchestrator work hours configuration.
 */
export interface OrchestratorWorkHours {
  /** Timezone identifier (e.g., 'America/New_York') */
  timezone: string;

  /** Schedule per day of week (0 = Sunday) */
  schedule: Record<number, { start: string; end: string } | null>;

  /** Whether to operate 24/7 regardless of schedule */
  always24x7: boolean;
}

/**
 * Orchestrator escalation configuration.
 */
export interface OrchestratorEscalationConfig {
  /** Enable automatic escalation */
  enabled: boolean;

  /** User IDs to escalate to */
  escalateTo: string[];

  /** Conditions that trigger escalation */
  triggers: string[];
}

// =============================================================================
// OrchestratorInput Types
// =============================================================================

/**
 * Input for creating a new Orchestrator.
 */
export interface CreateOrchestratorInput {
  /** Display name for the Orchestrator */
  name: string;

  /** Discipline/department the Orchestrator belongs to */
  discipline: string;

  /** Role title (e.g., "VP of Engineering") */
  role: string;

  /** Organization ID the Orchestrator belongs to */
  organizationId: string;

  /** Optional discipline ID for categorization */
  disciplineId?: string;

  /** Email address for the Orchestrator's user account */
  email?: string;

  /** Orchestrator capabilities as JSON-serializable array */
  capabilities?: string[];

  /** Optional daemon endpoint URL */
  daemonEndpoint?: string;

  /** Initial Orchestrator status */
  status?: OrchestratorStatus;

  /** Charter configuration */
  charter?: Partial<OrchestratorCharter>;

  /** Bio/description */
  bio?: string;

  /** Avatar URL */
  avatarUrl?: string;
}

/**
 * Input for updating an existing Orchestrator.
 */
export interface UpdateOrchestratorInput {
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
  charter?: Partial<OrchestratorCharter>;

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

  /** The Orchestrator associated with the key (if valid) */
  orchestrator?: OrchestratorWithUser;

  /** Reason for invalidity (if invalid) */
  reason?: 'invalid' | 'expired' | 'revoked' | 'not_found';
}

// =============================================================================
// OrchestratorService Account Configuration
// =============================================================================

/**
 * Orchestrator service account stored configuration.
 * Stored in the User.orchestratorConfig JSON field.
 */
export interface OrchestratorServiceAccountConfig {
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
  charter?: OrchestratorCharter;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// OrchestratorQuery Types
// =============================================================================

/**
 * Options for listing Orchestrators.
 */
export interface ListOrchestratorsOptions {
  /** Filter by organization ID */
  organizationId?: string;

  /** Filter by discipline */
  discipline?: string;

  /** Filter by status */
  status?: OrchestratorStatus;

  /** Include inactive Orchestrators */
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
 * Paginated Orchestrator list result.
 */
export interface PaginatedOrchestratorResult {
  /** List of Orchestrators */
  data: OrchestratorWithUser[];

  /** Total count of matching Orchestrators */
  total: number;

  /** Whether there are more results */
  hasMore: boolean;

  /** Cursor for next page (if applicable) */
  nextCursor?: string;
}

// =============================================================================
// OrchestratorEvent Types
// =============================================================================

/**
 * Orchestrator lifecycle events for auditing and webhooks.
 */
export type OrchestratorEventType =
  | 'orchestrator.created'
  | 'orchestrator.updated'
  | 'orchestrator.activated'
  | 'orchestrator.deactivated'
  | 'orchestrator.deleted'
  | 'orchestrator.api_key.generated'
  | 'orchestrator.api_key.rotated'
  | 'orchestrator.api_key.revoked';

/**
 * Orchestrator event payload.
 */
export interface OrchestratorEvent {
  /** Event type */
  type: OrchestratorEventType;

  /** OrchestratorID */
  orchestratorId: string;

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
// OrchestratorUtility Types
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
 * Type guard to check if a JSON value is an OrchestratorCharter.
 */
export function isOrchestratorCharter(value: unknown): value is OrchestratorCharter {
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
 * Type guard to check if a JSON value is an OrchestratorServiceAccountConfig.
 */
export function isOrchestratorServiceAccountConfig(value: unknown): value is OrchestratorServiceAccountConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // OrchestratorServiceAccountConfig can be an empty object
  return true;
}

/**
 * Default Orchestrator charter template.
 */
export const DEFAULT_ORCHESTRATOR_CHARTER: OrchestratorCharter = {
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
