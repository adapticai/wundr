/**
 * Orchestrator types for the Genesis App
 *
 * This module provides comprehensive type definitions for the Orchestrator system,
 * including core entities, configuration, and operational settings.
 *
 * @module types/orchestrator
 */

/**
 * Orchestrator status values
 *
 * @constant
 */
export const ORCHESTRATOR_STATUS_VALUES = [
  'ONLINE',
  'OFFLINE',
  'BUSY',
  'AWAY',
] as const;

/**
 * Orchestrator availability status
 *
 * Maps to database schema statuses and provides frontend-friendly display values.
 *
 * @remarks
 * - ONLINE: Orchestrator is active and available
 * - OFFLINE: Orchestrator is not available
 * - BUSY: Orchestrator is engaged in active work
 * - AWAY: Orchestrator is temporarily unavailable
 */
export type OrchestratorStatus = (typeof ORCHESTRATOR_STATUS_VALUES)[number];

/**
 * Core Orchestrator entity
 *
 * Represents an AI orchestrator with its configuration, charter, and operational state.
 *
 * @interface
 * @property {string} id - Unique identifier (UUID)
 * @property {string} userId - Owner user ID
 * @property {string} title - Display name
 * @property {string | null} description - Optional description
 * @property {string | null} discipline - Professional discipline/domain
 * @property {OrchestratorStatus} status - Current availability status
 * @property {OrchestratorCharter | null} charter - Operational charter defining mission and values
 * @property {readonly string[]} capabilities - List of orchestrator capabilities
 * @property {OrchestratorModelConfig | null} modelConfig - LLM model configuration
 * @property {string | null} systemPrompt - Custom system prompt override
 * @property {string | null} organizationId - Optional organization association
 * @property {string | null} avatarUrl - Optional avatar image URL
 * @property {Date | null} lastActivityAt - Timestamp of last activity
 * @property {number} messageCount - Total messages processed
 * @property {number} agentCount - Number of associated agents
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */
export interface Orchestrator {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  discipline: string | null;
  status: OrchestratorStatus;
  charter: OrchestratorCharter | null;
  capabilities: readonly string[];
  modelConfig: OrchestratorModelConfig | null;
  systemPrompt: string | null;
  organizationId: string | null;
  avatarUrl: string | null;
  lastActivityAt: Date | null;
  messageCount: number;
  agentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Orchestrator Charter
 *
 * Defines the core mission, values, and operational parameters for an orchestrator.
 *
 * @interface
 * @property {string} mission - Primary mission statement
 * @property {string} vision - Long-term vision
 * @property {readonly string[]} values - Core values guiding behavior
 * @property {OrchestratorPersonality} personality - Personality configuration
 * @property {readonly string[]} expertise - Areas of expertise
 * @property {CommunicationPreferences} communicationPreferences - Communication style settings
 * @property {OperationalSettings} operationalSettings - Operational parameters
 */
export interface OrchestratorCharter {
  mission: string;
  vision: string;
  values: readonly string[];
  personality: OrchestratorPersonality;
  expertise: readonly string[];
  communicationPreferences: CommunicationPreferences;
  operationalSettings: OperationalSettings;
}

/**
 * Orchestrator Personality Configuration
 *
 * Defines personality traits and behavioral characteristics.
 *
 * @interface
 * @property {readonly string[]} traits - Personality traits
 * @property {string} communicationStyle - Preferred communication approach
 * @property {string} decisionMakingStyle - Decision-making methodology
 * @property {string} background - Contextual background information
 */
export interface OrchestratorPersonality {
  traits: readonly string[];
  communicationStyle: string;
  decisionMakingStyle: string;
  background: string;
}

/**
 * Communication tone preference
 */
export type CommunicationTone =
  | 'formal'
  | 'casual'
  | 'professional'
  | 'friendly';

/**
 * Response length preference
 */
export type ResponseLength = 'concise' | 'detailed' | 'balanced';

/**
 * Formality level
 */
export type FormalityLevel = 'high' | 'medium' | 'low';

/**
 * Communication Preferences
 *
 * Configures how the orchestrator communicates with users.
 *
 * @interface
 * @property {CommunicationTone} tone - Overall communication tone
 * @property {ResponseLength} responseLength - Preferred response verbosity
 * @property {FormalityLevel} formality - Formality level
 * @property {boolean} useEmoji - Whether to use emoji in responses
 */
export interface CommunicationPreferences {
  tone: CommunicationTone;
  responseLength: ResponseLength;
  formality: FormalityLevel;
  useEmoji: boolean;
}

/**
 * Work hours configuration
 *
 * @interface
 * @property {string} start - Start time in HH:mm format (e.g., "09:00")
 * @property {string} end - End time in HH:mm format (e.g., "17:00")
 * @property {string} timezone - IANA timezone identifier (e.g., "America/New_York")
 */
export interface WorkHours {
  start: string;
  end: string;
  timezone: string;
}

/**
 * Operational Settings
 *
 * Configures operational parameters and escalation rules.
 *
 * @interface
 * @property {WorkHours} workHours - Active working hours
 * @property {number} responseTimeTarget - Target response time in minutes
 * @property {boolean} autoEscalation - Whether to auto-escalate issues
 * @property {number} escalationThreshold - Escalation threshold in minutes
 */
export interface OperationalSettings {
  workHours: WorkHours;
  responseTimeTarget: number;
  autoEscalation: boolean;
  escalationThreshold: number;
}

/**
 * LLM Model Configuration
 *
 * Configures the underlying language model parameters.
 *
 * @interface
 * @property {string} modelId - Model identifier (e.g., "claude-3-opus-20240229")
 * @property {number} temperature - Sampling temperature (0.0-1.0)
 * @property {number} maxTokens - Maximum tokens in response
 * @property {number} topP - Nucleus sampling parameter (0.0-1.0)
 */
export interface OrchestratorModelConfig {
  modelId: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

/**
 * Input for creating a new orchestrator
 *
 * @interface
 * @property {string} title - Display name (required)
 * @property {string} discipline - Professional discipline (required)
 * @property {string} [description] - Optional description
 * @property {Partial<OrchestratorCharter>} [charter] - Optional charter configuration
 * @property {readonly string[]} [capabilities] - Optional capabilities list
 * @property {string} [systemPrompt] - Optional custom system prompt
 * @property {string} [organizationId] - Optional organization association
 */
export interface CreateOrchestratorInput {
  title: string;
  discipline: string;
  description?: string;
  charter?: Partial<OrchestratorCharter>;
  capabilities?: readonly string[];
  systemPrompt?: string;
  organizationId?: string;
}

/**
 * Input for updating an existing orchestrator
 *
 * All fields are optional, only provided fields will be updated.
 *
 * @interface
 * @property {string} [title] - Updated display name
 * @property {string} [description] - Updated description
 * @property {string} [discipline] - Updated discipline
 * @property {OrchestratorStatus} [status] - Updated status
 * @property {Partial<OrchestratorCharter>} [charter] - Updated charter (partial merge)
 * @property {readonly string[]} [capabilities] - Updated capabilities list
 * @property {Partial<OrchestratorModelConfig>} [modelConfig] - Updated model config (partial merge)
 * @property {string} [systemPrompt] - Updated system prompt
 */
export interface UpdateOrchestratorInput {
  title?: string;
  description?: string;
  discipline?: string;
  status?: OrchestratorStatus;
  charter?: Partial<OrchestratorCharter>;
  capabilities?: readonly string[];
  modelConfig?: Partial<OrchestratorModelConfig>;
  systemPrompt?: string;
}

/**
 * Filters for querying orchestrators
 *
 * @interface
 * @property {string} [discipline] - Filter by discipline
 * @property {OrchestratorStatus} [status] - Filter by status
 * @property {string} [search] - Search query for title/description
 * @property {number} [page] - Page number (1-indexed)
 * @property {number} [limit] - Results per page
 */
export interface OrchestratorFilters {
  discipline?: string;
  status?: OrchestratorStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Available orchestrator disciplines
 *
 * Predefined list of professional disciplines for orchestrator specialization.
 *
 * @constant
 */
export const ORCHESTRATOR_DISCIPLINES = [
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'Operations',
  'Finance',
  'Human Resources',
  'Customer Success',
  'Legal',
  'Research',
  'Data Science',
] as const;

/**
 * Type representing valid orchestrator disciplines
 */
export type OrchestratorDiscipline = (typeof ORCHESTRATOR_DISCIPLINES)[number];

/**
 * Status display configuration
 *
 * @interface
 * @property {string} label - Human-readable label
 * @property {string} color - Tailwind text color class
 * @property {string} bgColor - Tailwind background color class
 */
export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

/**
 * Status configuration mapping
 *
 * Maps each orchestrator status to its display configuration including
 * labels and Tailwind CSS classes.
 *
 * @constant
 */
export const ORCHESTRATOR_STATUS_CONFIG: Record<
  OrchestratorStatus,
  StatusConfig
> = {
  ONLINE: { label: 'Online', color: 'text-green-700', bgColor: 'bg-green-100' },
  OFFLINE: { label: 'Offline', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  BUSY: { label: 'Busy', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  AWAY: { label: 'Away', color: 'text-orange-700', bgColor: 'bg-orange-100' },
};

/**
 * Available personality traits
 *
 * Predefined list of personality traits for orchestrator configuration.
 *
 * @constant
 */
export const PERSONALITY_TRAITS = [
  'Analytical',
  'Creative',
  'Detail-oriented',
  'Empathetic',
  'Innovative',
  'Methodical',
  'Persuasive',
  'Proactive',
  'Strategic',
  'Supportive',
  'Technical',
  'Visionary',
] as const;

/**
 * Type representing valid personality traits
 */
export type PersonalityTrait = (typeof PERSONALITY_TRAITS)[number];

/**
 * Paginated response for orchestrator queries
 *
 * @interface
 * @template T - The type of items in the response
 * @property {T[]} items - Array of orchestrators
 * @property {number} total - Total count of matching orchestrators
 * @property {number} page - Current page number
 * @property {number} limit - Items per page
 * @property {number} totalPages - Total number of pages
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Type alias for paginated orchestrator response
 */
export type OrchestratorListResponse = PaginatedResponse<Orchestrator>;

/**
 * Type guard to check if a value is a valid OrchestratorStatus
 *
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is a valid OrchestratorStatus
 *
 * @example
 * ```typescript
 * const status = apiResponse.status;
 * if (isOrchestratorStatus(status)) {
 *   // TypeScript now knows status is OrchestratorStatus
 *   console.log(`Status is ${status}`);
 * }
 * ```
 */
export function isOrchestratorStatus(
  value: unknown,
): value is OrchestratorStatus {
  return (
    typeof value === 'string' &&
    (ORCHESTRATOR_STATUS_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Type guard to check if a value is a valid OrchestratorDiscipline
 *
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is a valid OrchestratorDiscipline
 */
export function isOrchestratorDiscipline(
  value: unknown,
): value is OrchestratorDiscipline {
  return (
    typeof value === 'string' &&
    ORCHESTRATOR_DISCIPLINES.includes(value as OrchestratorDiscipline)
  );
}
