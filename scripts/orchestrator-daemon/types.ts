/**
 * Type definitions for Orchestrator Daemon system
 * Virtual Principal (VP) orchestration and session management
 */

// ============================================================================
// PTY Controller Configuration
// ============================================================================

/**
 * Configuration for PTY (Pseudo-Terminal) controller
 */
export interface PTYControllerConfig {
  /** Shell executable path or name */
  shell: string;
  /** Current working directory for the PTY session */
  cwd: string;
  /** Environment variables to set in the PTY session */
  env: Record<string, string>;
  /** Safety heuristics for command approval */
  safetyHeuristics: SafetyHeuristics;
}

/**
 * Safety heuristics for automatic command approval/rejection
 */
export interface SafetyHeuristics {
  /** Patterns for commands that are automatically approved */
  autoApprovePatterns: RegExp[];
  /** Patterns for commands that are always rejected */
  alwaysRejectPatterns: RegExp[];
  /** Patterns that trigger escalation to guardian */
  escalationPatterns: RegExp[];
}

// ============================================================================
// Triage System
// ============================================================================

/**
 * Detected intent from triage analysis
 */
export type TriageIntent =
  | 'status_query'
  | 'new_task'
  | 'modify_task'
  | 'escalation'
  | 'unknown';

/**
 * Incoming request for triage processing
 */
export interface TriageRequest {
  /** Origin of the request (e.g., 'slack', 'api', 'cli') */
  source: string;
  /** Identifier of the sender (user ID, bot ID, etc.) */
  sender: string;
  /** Content of the request message */
  content: string;
  /** Channel identifier for the request source */
  channelId: string;
  /** Thread identifier for threaded conversations */
  threadId?: string;
}

/**
 * Result of triage analysis
 */
export interface TriageResult {
  /** Detected intent of the request */
  intent: TriageIntent;
  /** Target session ID for the request (if applicable) */
  targetSession?: string;
  /** Priority level (1 = highest, 5 = lowest) */
  priority: number;
  /** Confidence score of the triage analysis (0.0 - 1.0) */
  confidence: number;
  /** Whether this request requires guardian approval */
  requiresGuardian: boolean;
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Status of a session slot
 */
export type SessionSlotStatus = 'available' | 'running' | 'paused' | 'crashed';

/**
 * Represents a slot in the session pool
 */
export interface SessionSlot {
  /** Unique identifier for the slot */
  id: string;
  /** Claude session ID (if active) */
  sessionId?: string;
  /** Current status of the slot */
  status: SessionSlotStatus;
  /** Priority level of the current task */
  priority: number;
  /** Path to the git worktree for this session */
  worktreePath?: string;
  /** Timestamp when the session started */
  startedAt?: Date;
  /** Timestamp of last activity in the session */
  lastActivity?: Date;
}

/**
 * Request waiting in the queue for processing
 */
export interface QueuedRequest {
  /** Unique identifier for the queued request */
  id: string;
  /** The triage request awaiting processing */
  request: TriageRequest;
  /** Priority level for queue ordering */
  priority: number;
  /** Timestamp when the request was queued */
  queuedAt: Date;
  /** Estimated wait time in milliseconds */
  estimatedWait: number;
}

// ============================================================================
// Decision Telemetry & Intervention
// ============================================================================

/**
 * Telemetry record for agent decisions
 */
export interface DecisionTelemetry {
  /** Timestamp of the decision */
  timestamp: Date;
  /** Session ID where the decision occurred */
  sessionId: string;
  /** Agent identifier that made the decision */
  agentId: string;
  /** Action that was taken or attempted */
  action: string;
  /** Rationale provided for the decision */
  rationale: string;
  /** Reward scores from RLHF/evaluation */
  rewardScores: Record<string, number>;
  /** Results of policy compliance checks */
  policyChecks: Record<string, boolean>;
  /** Triggers that caused escalation (if any) */
  escalationTriggers: string[];
}

/**
 * Types of intervention that can be triggered
 */
export type InterventionType =
  | 'reduce_autonomy'
  | 'trigger_audit'
  | 'pause_execution'
  | 'notify_guardian'
  | 'rollback';

/**
 * Threshold configuration for intervention levels
 */
export interface InterventionThreshold {
  /** Threshold value that triggers this intervention */
  threshold: number;
  /** Whether this intervention is enabled */
  enabled: boolean;
  /** Optional cooldown period in milliseconds */
  cooldownMs?: number;
}

/**
 * Configuration for intervention system
 */
export interface InterventionConfig {
  /** Thresholds for each intervention type */
  thresholds: Record<InterventionType, InterventionThreshold>;
  /** Whether to automatically rollback on critical policy violations */
  autoRollbackOnCriticalPolicy: boolean;
}

// ============================================================================
// Token Budget & Resource Management
// ============================================================================

/**
 * Subscription-based token limits
 */
export interface SubscriptionLimits {
  /** Maximum tokens per day */
  daily: number;
  /** Maximum tokens per hour */
  hourly: number;
  /** Maximum tokens per five-hour window */
  perFiveHours: number;
}

/**
 * API-based token limits
 */
export interface APILimits {
  /** Total budget for API tokens */
  budget: number;
  /** Soft limit that triggers warnings */
  softLimit: number;
  /** Hard limit that stops execution */
  hardLimit: number;
}

/**
 * Token budget configuration
 */
export interface TokenBudget {
  /** Subscription-based limits */
  subscription: SubscriptionLimits;
  /** API-based limits */
  api: APILimits;
}

// ============================================================================
// Model Configuration
// ============================================================================

/**
 * Model assignment for a tier
 */
export interface ModelAssignment {
  /** Model identifier (e.g., 'claude-sonnet-4-5-20250929') */
  model: string;
  /** Maximum tokens for this tier */
  maxTokens: number;
  /** Temperature setting for model responses */
  temperature?: number;
}

/**
 * Tiered model configuration for different agent levels
 */
export interface TieredModelConfig {
  /** Model configuration for Orchestrator (Tier 1) */
  tier1VP: ModelAssignment;
  /** Model configuration for Session Manager (Tier 2) */
  tier2SessionManager: ModelAssignment;
  /** Model configuration for Sub-Agents (Tier 3) */
  tier3SubAgent: ModelAssignment;
}

// ============================================================================
// Orchestrator Identity & Charter
// ============================================================================

/**
 * Identity information for the Virtual Principal
 */
export interface VPIdentity {
  /** Display name of the Orchestrator */
  name: string;
  /** Email address associated with the Orchestrator */
  email: string;
  /** Avatar URL or path */
  avatar?: string;
  /** Slack handle for the Orchestrator */
  slackHandle: string;
}

/**
 * Resource limits for Orchestrator operations
 */
export interface VPResourceLimits {
  /** Maximum concurrent sessions */
  maxConcurrentSessions: number;
  /** Maximum queue depth */
  maxQueueDepth: number;
  /** Token budget configuration */
  tokenBudget: TokenBudget;
  /** Model configuration per tier */
  modelConfig: TieredModelConfig;
}

/**
 * Measurable objectives for Orchestrator performance
 */
export interface MeasurableObjectives {
  /** Target task completion rate (0.0 - 1.0) */
  taskCompletionRate: number;
  /** Maximum acceptable response time in milliseconds */
  maxResponseTimeMs: number;
  /** Target policy compliance rate (0.0 - 1.0) */
  policyComplianceRate: number;
  /** Maximum escalation rate (0.0 - 1.0) */
  maxEscalationRate: number;
}

/**
 * Hard constraints that cannot be violated
 */
export interface HardConstraints {
  /** Patterns for files that must never be modified */
  forbiddenFilePatterns: RegExp[];
  /** Commands that are never allowed */
  forbiddenCommands: string[];
  /** Whether production deployments are allowed */
  allowProductionDeployments: boolean;
  /** Whether force pushes to protected branches are allowed */
  allowForcePush: boolean;
  /** Required approval patterns for certain operations */
  requiredApprovalPatterns: RegExp[];
}

/**
 * Orchestrator Charter defining role, responsibilities, and constraints
 */
export interface VPCharter {
  /** Name of the charter */
  name: string;
  /** Role description */
  role: string;
  /** Orchestrator identity information */
  identity: VPIdentity;
  /** List of responsibilities */
  responsibilities: string[];
  /** Resource limits */
  resourceLimits: VPResourceLimits;
  /** Measurable objectives */
  measurableObjectives: MeasurableObjectives;
  /** Hard constraints */
  hardConstraints: HardConstraints;
}

// ============================================================================
// Observability & Metrics
// ============================================================================

/**
 * Configuration for observability backend
 */
export interface ObservabilityConfig {
  /** Backend URL for telemetry data */
  backendUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Batch size for telemetry uploads */
  batchSize: number;
  /** Flush interval in milliseconds */
  flushIntervalMs: number;
}

/**
 * Metrics for detecting alignment drift
 */
export interface AlignmentDriftMetrics {
  /** Rate of policy violations (0.0 - 1.0) */
  policyViolationRate: number;
  /** Gap between intended and actual outcomes (0.0 - 1.0) */
  intentOutcomeGap: number;
  /** Disagreement rate between evaluators (0.0 - 1.0) */
  evaluatorDisagreement: number;
  /** Rate of suppressed escalations (0.0 - 1.0) */
  escalationSuppression: number;
  /** Detected reward hacking score (0.0 - 1.0) */
  rewardHacking: number;
}

// ============================================================================
// System Resource Limits
// ============================================================================

/**
 * System resource limits for the Orchestrator daemon
 */
export interface ResourceLimits {
  /** Maximum number of file descriptors */
  fileDescriptors: number;
  /** Minimum required disk space in GB */
  diskSpaceMinGB: number;
  /** Maximum number of worktrees per machine */
  maxWorktreesPerMachine: number;
}

// ============================================================================
// Composite Types for Full Configuration
// ============================================================================

/**
 * Complete Orchestrator Daemon configuration
 */
export interface VPDaemonConfig {
  /** Orchestrator Charter defining identity and constraints */
  charter: VPCharter;
  /** PTY controller configuration */
  ptyConfig: PTYControllerConfig;
  /** Intervention configuration */
  interventionConfig: InterventionConfig;
  /** Observability configuration */
  observability: ObservabilityConfig;
  /** System resource limits */
  resourceLimits: ResourceLimits;
}

/**
 * Orchestrator Daemon runtime state
 */
export interface VPDaemonState {
  /** Current session slots */
  sessionSlots: SessionSlot[];
  /** Queued requests awaiting processing */
  requestQueue: QueuedRequest[];
  /** Recent decision telemetry records */
  recentDecisions: DecisionTelemetry[];
  /** Current alignment drift metrics */
  alignmentMetrics: AlignmentDriftMetrics;
  /** Daemon start timestamp */
  startedAt: Date;
  /** Last health check timestamp */
  lastHealthCheck: Date;
}
