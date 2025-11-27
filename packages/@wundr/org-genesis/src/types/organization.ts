/**
 * Organization Types for the Org Genesis System
 * Based on: Architectural Framework for Autonomous High-Density Agentic Clusters
 *
 * This module defines the core type system for organizational manifests,
 * Orchestrator (Orchestrator) node mappings, and configuration structures used
 * throughout the org-genesis package.
 *
 * @packageDocumentation
 */

// =============================================================================
// ENUMS & LITERAL TYPES
// =============================================================================

/**
 * Organization size presets that determine default configurations.
 *
 * Each size tier comes with recommended defaults for Orchestrator count,
 * discipline structure, and agent allocation:
 *
 * - `small`: 1-5 VPs, 2-4 disciplines, suited for startups/small teams
 * - `medium`: 5-15 VPs, 4-8 disciplines, suited for mid-size organizations
 * - `large`: 15-50 VPs, 8-15 disciplines, suited for large enterprises
 * - `enterprise`: 50+ VPs, 15+ disciplines, suited for global organizations
 */
export type OrgSize = 'small' | 'medium' | 'large' | 'enterprise';

/**
 * Organization industry/domain classification.
 *
 * The industry type influences:
 * - Default discipline configurations
 * - Recommended agent specializations
 * - Compliance and security defaults
 * - Communication patterns and workflows
 *
 * Use `custom` for industries not covered by predefined options.
 */
export type OrgIndustry =
  | 'technology'
  | 'finance'
  | 'healthcare'
  | 'legal'
  | 'marketing'
  | 'manufacturing'
  | 'retail'
  | 'gaming'
  | 'media'
  | 'custom';

/**
 * Status of a Orchestrator (Orchestrator) node within the organization cluster.
 *
 * - `active`: Node is fully operational and accepting tasks
 * - `inactive`: Node exists but is not currently processing
 * - `provisioning`: Node is being set up and not yet ready
 * - `error`: Node encountered an error and requires attention
 * - `maintenance`: Node is undergoing scheduled maintenance
 */
export type OrchestratorNodeStatus =
  | 'active'
  | 'inactive'
  | 'provisioning'
  | 'error'
  | 'maintenance';

/**
 * Lifecycle state of an organization.
 *
 * - `draft`: Initial configuration, not yet deployed
 * - `active`: Fully operational organization
 * - `suspended`: Temporarily halted operations
 * - `archived`: Permanently deactivated but retained for records
 */
export type OrgLifecycleState = 'draft' | 'active' | 'suspended' | 'archived';

// =============================================================================
// Orchestrator NODE TYPES
// =============================================================================

/**
 * Resource allocation configuration for a Orchestrator node.
 *
 * Defines computational resources available to a Orchestrator.
 */
export interface OrchestratorResourceAllocation {
  /**
   * Maximum CPU cores allocated to this Orchestrator.
   * @default 2
   */
  cpuCores: number;

  /**
   * Maximum memory in megabytes allocated to this Orchestrator.
   * @default 4096
   */
  memoryMb: number;

  /**
   * Maximum concurrent task capacity.
   * @default 10
   */
  maxConcurrentTasks: number;

  /**
   * Token budget per hour for LLM operations.
   * @default 100000
   */
  tokenBudgetPerHour: number;
}

/**
 * Health metrics for a Orchestrator node.
 *
 * Used for monitoring and alerting on Orchestrator performance.
 */
export interface OrchestratorHealthMetrics {
  /**
   * Percentage of time the Orchestrator has been operational (0-100).
   */
  uptime: number;

  /**
   * Average response time in milliseconds for task completion.
   */
  avgResponseTimeMs: number;

  /**
   * Number of errors in the last 24 hours.
   */
  errorCountLast24h: number;

  /**
   * Timestamp of the last successful health check.
   */
  lastHealthCheck: Date;

  /**
   * Current CPU utilization percentage (0-100).
   */
  cpuUtilization: number;

  /**
   * Current memory utilization percentage (0-100).
   */
  memoryUtilization: number;
}

/**
 * Orchestrator-to-Node mapping configuration.
 *
 * Maps a Orchestrator to a specific compute node
 * within the organization's infrastructure. This is the core
 * building block for distributed agentic clusters.
 *
 * @example
 * ```typescript
 * const vpMapping: VPNodeMapping = {
 *   vpId: 'orchestrator-cto-001',
 *   nodeId: 'node-us-east-1a',
 *   hostname: 'orchestrator-cto.cluster.internal',
 *   status: 'active',
 *   assignedDisciplineId: 'disc-engineering',
 *   resources: {
 *     cpuCores: 4,
 *     memoryMb: 8192,
 *     maxConcurrentTasks: 20,
 *     tokenBudgetPerHour: 200000,
 *   },
 * };
 * ```
 */
export interface VPNodeMapping {
  /**
   * Unique identifier for the Orchestrator.
   * Format: `orchestrator-{role}-{sequence}`
   */
  vpId: string;

  /**
   * Identifier of the compute node hosting this Orchestrator.
   * Format: `node-{region}-{zone}`
   */
  nodeId: string;

  /**
   * Fully qualified hostname or IP address of the node.
   */
  hostname: string;

  /**
   * Current operational status of the Orchestrator node.
   */
  status: OrchestratorNodeStatus;

  /**
   * ID of the discipline this Orchestrator belongs to.
   * @optional
   */
  assignedDisciplineId?: string;

  /**
   * Resource allocation for this Orchestrator.
   * @optional - Uses defaults if not specified
   */
  resources?: OrchestratorResourceAllocation;

  /**
   * Current health metrics for monitoring.
   * @optional - Populated by monitoring systems
   */
  healthMetrics?: OrchestratorHealthMetrics;

  /**
   * Port number for inter-Orchestrator communication.
   * @default 8080
   */
  port?: number;

  /**
   * Tags for filtering and grouping VPs.
   */
  tags?: string[];

  /**
   * Timestamp when this Orchestrator was provisioned.
   */
  provisionedAt?: Date;

  /**
   * Timestamp of the last status change.
   */
  lastStatusChange?: Date;
}

// =============================================================================
// ORGANIZATION MANIFEST
// =============================================================================

/**
 * Governance configuration for the organization.
 *
 * Defines approval workflows, decision-making authority,
 * and escalation paths within the organization.
 */
export interface OrgGovernanceConfig {
  /**
   * Whether human approval is required for high-impact decisions.
   * @default true
   */
  requireHumanApproval: boolean;

  /**
   * Threshold amount (in USD) above which human approval is required.
   * @default 10000
   */
  approvalThresholdUsd: number;

  /**
   * Maximum time in minutes before auto-escalation occurs.
   * @default 60
   */
  escalationTimeoutMinutes: number;

  /**
   * IDs of VPs with executive decision-making authority.
   */
  executiveVpIds: string[];

  /**
   * Whether to enable audit logging for all decisions.
   * @default true
   */
  auditLoggingEnabled: boolean;
}

/**
 * Security configuration for the organization.
 *
 * Defines access controls, encryption settings, and
 * compliance requirements.
 */
export interface OrgSecurityConfig {
  /**
   * Encryption standard for data at rest.
   * @default 'AES-256'
   */
  encryptionAtRest: 'AES-256' | 'AES-128' | 'none';

  /**
   * Encryption standard for data in transit.
   * @default 'TLS-1.3'
   */
  encryptionInTransit: 'TLS-1.3' | 'TLS-1.2' | 'mTLS';

  /**
   * Multi-factor authentication requirement.
   * @default true
   */
  mfaRequired: boolean;

  /**
   * Session timeout in minutes.
   * @default 480
   */
  sessionTimeoutMinutes: number;

  /**
   * Compliance frameworks the organization adheres to.
   */
  complianceFrameworks: string[];

  /**
   * IP allowlist for external access.
   * Empty array means no restrictions.
   */
  ipAllowlist: string[];
}

/**
 * Communication configuration for the organization.
 *
 * Defines how VPs and agents communicate within the cluster.
 */
export interface OrgCommunicationConfig {
  /**
   * Primary communication protocol between VPs.
   * @default 'grpc'
   */
  protocol: 'grpc' | 'rest' | 'websocket' | 'mqtt';

  /**
   * Message queue system for async communication.
   * @default 'redis'
   */
  messageQueue: 'redis' | 'rabbitmq' | 'kafka' | 'sqs' | 'none';

  /**
   * Maximum message size in kilobytes.
   * @default 1024
   */
  maxMessageSizeKb: number;

  /**
   * Enable message compression.
   * @default true
   */
  compressionEnabled: boolean;

  /**
   * Retry policy for failed communications.
   */
  retryPolicy: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
}

/**
 * Organization manifest - the root configuration document.
 *
 * This is the primary configuration structure for an organization
 * in the Org Genesis system. It defines the organization's identity,
 * structure, and operational parameters.
 *
 * @example
 * ```typescript
 * const manifest: OrganizationManifest = {
 *   id: 'org-acme-corp',
 *   name: 'ACME Corporation',
 *   slug: 'acme-corp',
 *   mission: 'Innovate solutions for a better tomorrow',
 *   industry: 'technology',
 *   size: 'medium',
 *   lifecycleState: 'active',
 *   vpRegistry: [...],
 *   disciplineIds: ['disc-engineering', 'disc-product'],
 *   createdAt: new Date('2024-01-15'),
 *   updatedAt: new Date('2024-06-20'),
 *   metadata: { region: 'us-west-2' },
 * };
 * ```
 */
export interface OrganizationManifest {
  /**
   * Unique identifier for the organization.
   * Format: `org-{slug}` or UUID
   */
  id: string;

  /**
   * Human-readable name of the organization.
   */
  name: string;

  /**
   * URL-safe slug for the organization.
   * Used in URLs, file paths, and identifiers.
   */
  slug: string;

  /**
   * Organization's mission statement.
   * Guides agent decision-making and priorities.
   */
  mission: string;

  /**
   * Extended description of the organization's goals and values.
   * @optional
   */
  description?: string;

  /**
   * Industry classification for the organization.
   * Influences default configurations and compliance requirements.
   */
  industry: OrgIndustry;

  /**
   * Size tier of the organization.
   * Determines default resource allocations and structure.
   */
  size: OrgSize;

  /**
   * Current lifecycle state of the organization.
   * @default 'draft'
   */
  lifecycleState: OrgLifecycleState;

  /**
   * Registry of all Orchestrator-to-node mappings.
   * Defines the compute infrastructure for the organization.
   */
  vpRegistry: VPNodeMapping[];

  /**
   * IDs of disciplines (departments/teams) within the organization.
   * References DisciplineManifest documents.
   */
  disciplineIds: string[];

  /**
   * Governance configuration for decision-making.
   * @optional - Uses defaults if not specified
   */
  governance?: OrgGovernanceConfig;

  /**
   * Security configuration for the organization.
   * @optional - Uses defaults if not specified
   */
  security?: OrgSecurityConfig;

  /**
   * Communication configuration between VPs and agents.
   * @optional - Uses defaults if not specified
   */
  communication?: OrgCommunicationConfig;

  /**
   * Timestamp when the organization was created.
   */
  createdAt: Date;

  /**
   * Timestamp of the last update to the manifest.
   */
  updatedAt: Date;

  /**
   * Version of the manifest schema.
   * Used for migration and compatibility.
   * @default '1.0.0'
   */
  schemaVersion?: string;

  /**
   * Flexible metadata for custom extensions.
   * Use for org-specific configuration that doesn't fit elsewhere.
   */
  metadata: Record<string, unknown>;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Default values for Orchestrator resource allocation by organization size.
 */
export interface VPResourceDefaults {
  /**
   * Defaults for small organizations.
   */
  small: OrchestratorResourceAllocation;

  /**
   * Defaults for medium organizations.
   */
  medium: OrchestratorResourceAllocation;

  /**
   * Defaults for large organizations.
   */
  large: OrchestratorResourceAllocation;

  /**
   * Defaults for enterprise organizations.
   */
  enterprise: OrchestratorResourceAllocation;
}

/**
 * Configuration for creating a new organization.
 *
 * Provides all necessary inputs for the organization genesis process,
 * with sensible defaults for optional fields.
 *
 * @example
 * ```typescript
 * const config: CreateOrgConfig = {
 *   name: 'Startup AI Labs',
 *   mission: 'Democratize AI for small businesses',
 *   industry: 'technology',
 *   size: 'small',
 *   orchestratorCount: 3,
 *   generateDisciplines: true,
 *   generateAgents: true,
 *   initialDisciplines: ['engineering', 'product'],
 * };
 * ```
 */
export interface CreateOrgConfig {
  /**
   * Human-readable name for the organization.
   * @required
   */
  name: string;

  /**
   * Custom slug for the organization.
   * If not provided, generated from the name.
   * @optional
   */
  slug?: string;

  /**
   * Organization's mission statement.
   * @required
   */
  mission: string;

  /**
   * Extended description of the organization.
   * @optional
   */
  description?: string;

  /**
   * Industry classification.
   * @required
   */
  industry: OrgIndustry;

  /**
   * Size tier of the organization.
   * @required
   */
  size: OrgSize;

  /**
   * Number of VPs to provision.
   * If not specified, uses size-based defaults.
   * @optional
   */
  orchestratorCount?: number;

  /**
   * Whether to auto-generate discipline structures.
   * @default true
   */
  generateDisciplines?: boolean;

  /**
   * Whether to auto-generate agents for each discipline.
   * @default true
   */
  generateAgents?: boolean;

  /**
   * Initial disciplines to create.
   * If not provided and generateDisciplines is true,
   * creates industry-appropriate defaults.
   * @optional
   */
  initialDisciplines?: string[];

  /**
   * Override default governance configuration.
   * @optional
   */
  governance?: Partial<OrgGovernanceConfig>;

  /**
   * Override default security configuration.
   * @optional
   */
  security?: Partial<OrgSecurityConfig>;

  /**
   * Override default communication configuration.
   * @optional
   */
  communication?: Partial<OrgCommunicationConfig>;

  /**
   * Custom metadata to include in the manifest.
   * @optional
   */
  metadata?: Record<string, unknown>;

  /**
   * Whether to run in dry-run mode (no actual provisioning).
   * @default false
   */
  dryRun?: boolean;
}

/**
 * Configuration for updating an existing organization.
 *
 * All fields are optional; only specified fields will be updated.
 */
export interface UpdateOrgConfig {
  /**
   * New name for the organization.
   */
  name?: string;

  /**
   * Updated mission statement.
   */
  mission?: string;

  /**
   * Updated description.
   */
  description?: string;

  /**
   * New size tier (may trigger resource reallocation).
   */
  size?: OrgSize;

  /**
   * New lifecycle state.
   */
  lifecycleState?: OrgLifecycleState;

  /**
   * Updated governance configuration.
   */
  governance?: Partial<OrgGovernanceConfig>;

  /**
   * Updated security configuration.
   */
  security?: Partial<OrgSecurityConfig>;

  /**
   * Updated communication configuration.
   */
  communication?: Partial<OrgCommunicationConfig>;

  /**
   * Metadata updates (merged with existing).
   */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// STATISTICS & METRICS
// =============================================================================

/**
 * Organization statistics and metrics.
 *
 * Provides a snapshot of the organization's current state
 * for dashboards and monitoring.
 *
 * @example
 * ```typescript
 * const stats: OrgStats = {
 *   orchestratorCount: 12,
 *   activeVpCount: 10,
 *   disciplineCount: 5,
 *   agentCount: 45,
 *   activeSessionCount: 23,
 *   taskCompletedLast24h: 156,
 *   avgTaskDurationMs: 2340,
 *   tokenUsageLast24h: 1250000,
 * };
 * ```
 */
export interface OrgStats {
  /**
   * Total number of VPs registered in the organization.
   */
  orchestratorCount: number;

  /**
   * Number of VPs currently in 'active' status.
   */
  activeVpCount: number;

  /**
   * Number of VPs in 'inactive' status.
   */
  inactiveVpCount: number;

  /**
   * Number of VPs currently being provisioned.
   */
  provisioningVpCount: number;

  /**
   * Number of VPs in error state.
   */
  errorVpCount: number;

  /**
   * Total number of disciplines in the organization.
   */
  disciplineCount: number;

  /**
   * Total number of agents across all disciplines.
   */
  agentCount: number;

  /**
   * Number of currently active sessions.
   */
  activeSessionCount: number;

  /**
   * Number of tasks completed in the last 24 hours.
   */
  taskCompletedLast24h: number;

  /**
   * Average task duration in milliseconds.
   */
  avgTaskDurationMs: number;

  /**
   * Total tokens consumed in the last 24 hours.
   */
  tokenUsageLast24h: number;

  /**
   * Timestamp when these stats were calculated.
   */
  calculatedAt: Date;
}

/**
 * Historical metrics for trend analysis.
 */
export interface OrgMetricsHistory {
  /**
   * Organization ID these metrics belong to.
   */
  orgId: string;

  /**
   * Time period for this metrics entry.
   */
  period: 'hour' | 'day' | 'week' | 'month';

  /**
   * Start of the metrics period.
   */
  periodStart: Date;

  /**
   * End of the metrics period.
   */
  periodEnd: Date;

  /**
   * Tasks completed during this period.
   */
  tasksCompleted: number;

  /**
   * Tasks failed during this period.
   */
  tasksFailed: number;

  /**
   * Average Orchestrator utilization percentage.
   */
  avgVpUtilization: number;

  /**
   * Total tokens consumed.
   */
  tokenUsage: number;

  /**
   * Estimated cost in USD.
   */
  estimatedCostUsd: number;

  /**
   * P95 latency in milliseconds.
   */
  p95LatencyMs: number;

  /**
   * Error rate as a percentage.
   */
  errorRate: number;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * Types of events that can occur in an organization.
 */
export type OrgEventType =
  | 'org.created'
  | 'org.updated'
  | 'org.archived'
  | 'vp.provisioned'
  | 'vp.activated'
  | 'vp.deactivated'
  | 'vp.error'
  | 'discipline.added'
  | 'discipline.removed'
  | 'agent.spawned'
  | 'agent.terminated'
  | 'task.completed'
  | 'task.failed'
  | 'governance.approval_required'
  | 'governance.approval_granted'
  | 'governance.approval_denied'
  | 'security.alert'
  | 'security.audit';

/**
 * Organization event for audit logging and event streaming.
 */
export interface OrgEvent {
  /**
   * Unique identifier for this event.
   */
  eventId: string;

  /**
   * Type of event that occurred.
   */
  eventType: OrgEventType;

  /**
   * Organization ID this event belongs to.
   */
  orgId: string;

  /**
   * Timestamp when the event occurred.
   */
  timestamp: Date;

  /**
   * ID of the actor (Orchestrator, agent, or user) that triggered the event.
   */
  actorId: string;

  /**
   * Type of actor.
   */
  actorType: 'vp' | 'agent' | 'user' | 'system';

  /**
   * ID of the resource affected by this event.
   * @optional
   */
  resourceId?: string;

  /**
   * Type of resource affected.
   * @optional
   */
  resourceType?: 'org' | 'vp' | 'discipline' | 'agent' | 'task';

  /**
   * Event-specific payload data.
   */
  payload: Record<string, unknown>;

  /**
   * Correlation ID for tracing related events.
   * @optional
   */
  correlationId?: string;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Result of manifest validation.
 */
export interface ManifestValidationResult {
  /**
   * Whether the manifest is valid.
   */
  valid: boolean;

  /**
   * List of validation errors, if any.
   */
  errors: ManifestValidationError[];

  /**
   * List of validation warnings (non-blocking).
   */
  warnings: ManifestValidationWarning[];
}

/**
 * A validation error that prevents manifest acceptance.
 */
export interface ManifestValidationError {
  /**
   * Error code for programmatic handling.
   */
  code: string;

  /**
   * Human-readable error message.
   */
  message: string;

  /**
   * JSON path to the invalid field.
   */
  path: string;

  /**
   * The invalid value, if applicable.
   */
  value?: unknown;
}

/**
 * A validation warning that doesn't prevent acceptance.
 */
export interface ManifestValidationWarning {
  /**
   * Warning code for programmatic handling.
   */
  code: string;

  /**
   * Human-readable warning message.
   */
  message: string;

  /**
   * JSON path to the concerning field.
   */
  path: string;

  /**
   * Suggested improvement or fix.
   */
  suggestion?: string;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a value is a valid OrgSize.
 *
 * @param value - The value to check
 * @returns True if the value is a valid OrgSize
 *
 * @example
 * ```typescript
 * const size = 'medium';
 * if (isOrgSize(size)) {
 *   // size is typed as OrgSize here
 * }
 * ```
 */
export function isOrgSize(value: unknown): value is OrgSize {
  return (
    typeof value === 'string' &&
    ['small', 'medium', 'large', 'enterprise'].includes(value)
  );
}

/**
 * Type guard to check if a value is a valid OrgIndustry.
 *
 * @param value - The value to check
 * @returns True if the value is a valid OrgIndustry
 */
export function isOrgIndustry(value: unknown): value is OrgIndustry {
  const validIndustries: OrgIndustry[] = [
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
  ];
  return typeof value === 'string' && validIndustries.includes(value as OrgIndustry);
}

/**
 * Type guard to check if a value is a valid OrchestratorNodeStatus.
 *
 * @param value - The value to check
 * @returns True if the value is a valid OrchestratorNodeStatus
 */
export function isOrchestratorNodeStatus(value: unknown): value is OrchestratorNodeStatus {
  const validStatuses: OrchestratorNodeStatus[] = [
    'active',
    'inactive',
    'provisioning',
    'error',
    'maintenance',
  ];
  return typeof value === 'string' && validStatuses.includes(value as OrchestratorNodeStatus);
}

/**
 * Type guard to check if an object is a valid VPNodeMapping.
 *
 * @param value - The value to check
 * @returns True if the value is a valid VPNodeMapping
 */
export function isVPNodeMapping(value: unknown): value is VPNodeMapping {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.orchestratorId === 'string' &&
    typeof obj.nodeId === 'string' &&
    typeof obj.hostname === 'string' &&
    isOrchestratorNodeStatus(obj.status)
  );
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Deep partial type for partial updates.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Organization manifest with all optional fields filled with defaults.
 */
export type ResolvedOrganizationManifest = Required<OrganizationManifest>;

/**
 * Serialized version of OrganizationManifest (dates as strings).
 * Used for JSON serialization/deserialization.
 */
export interface SerializedOrganizationManifest
  extends Omit<OrganizationManifest, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

/**
 * Options for serializing an organization manifest.
 */
export interface SerializationOptions {
  /**
   * Whether to include computed/derived fields.
   * @default false
   */
  includeComputed?: boolean;

  /**
   * Whether to include health metrics.
   * @default false
   */
  includeHealthMetrics?: boolean;

  /**
   * Whether to pretty-print JSON output.
   * @default true
   */
  prettyPrint?: boolean;

  /**
   * Fields to exclude from serialization.
   */
  excludeFields?: string[];
}
