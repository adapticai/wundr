/**
 * @fileoverview Charter Types for VP and Session Manager agents
 *
 * This module defines the comprehensive TypeScript types for supervisory agent charters
 * in the Wundr organizational hierarchy. Charters serve as the foundational identity
 * and capability definitions for Tier 1 (VP) and Tier 2 (Session Manager) agents.
 *
 * @module @wundr/org-genesis/types/charter
 * @version 1.0.0
 */

// ============================================================================
// Agent Tier Definition
// ============================================================================

/**
 * Agent tier in the organizational hierarchy.
 *
 * The hierarchy follows a three-tier structure:
 * - **Tier 1 (VP)**: Virtual Persona - Top-level supervisory agent responsible for
 *   context compilation, resource management, and session spawning
 * - **Tier 2 (Session Manager)**: Discipline-specific coordinator managing
 *   specialized agents within a domain
 * - **Tier 3 (Agent)**: Specialized execution agents performing atomic tasks
 *
 * @example
 * ```typescript
 * const vpTier: AgentTier = 1;
 * const sessionManagerTier: AgentTier = 2;
 * const agentTier: AgentTier = 3;
 * ```
 */
export type AgentTier = 1 | 2 | 3;

// ============================================================================
// VP Capabilities
// ============================================================================

/**
 * Enumeration of capabilities available to Virtual Persona (VP) agents.
 *
 * Each capability grants the VP specific operational permissions:
 *
 * - `context_compilation`: Ability to gather and synthesize context from multiple sources
 * - `resource_management`: Authority to allocate and manage computational resources
 * - `slack_operations`: Permission to interact with Slack workspaces
 * - `session_spawning`: Authority to create and terminate Session Manager instances
 * - `task_triage`: Ability to analyze, prioritize, and route incoming tasks
 * - `memory_management`: Permission to manage persistent and episodic memory stores
 *
 * @example
 * ```typescript
 * const vpCapabilities: VPCapability[] = [
 *   'context_compilation',
 *   'session_spawning',
 *   'task_triage',
 * ];
 * ```
 */
export type VPCapability =
  | 'context_compilation'
  | 'resource_management'
  | 'slack_operations'
  | 'session_spawning'
  | 'task_triage'
  | 'memory_management';

// ============================================================================
// Identity Configuration
// ============================================================================

/**
 * Identity configuration for an agent.
 *
 * Defines the human-readable and machine-readable identifiers for an agent,
 * along with optional communication and display properties.
 *
 * @property name - Human-readable display name (e.g., "Engineering VP")
 * @property slug - URL-safe identifier (e.g., "engineering-vp")
 * @property persona - Description of the agent's personality and communication style
 * @property slackHandle - Optional Slack username for notifications (without @)
 * @property email - Optional email address for external communications
 * @property avatarUrl - Optional URL to the agent's avatar image
 *
 * @example
 * ```typescript
 * const identity: AgentIdentity = {
 *   name: 'Engineering VP',
 *   slug: 'engineering-vp',
 *   persona: 'A methodical and detail-oriented technical leader focused on code quality',
 *   slackHandle: 'eng-vp-bot',
 *   avatarUrl: 'https://example.com/avatars/eng-vp.png',
 * };
 * ```
 */
export interface AgentIdentity {
  /** Human-readable display name for the agent */
  name: string;

  /** URL-safe unique identifier (lowercase, hyphenated) */
  slug: string;

  /** Description of the agent's personality, tone, and communication style */
  persona: string;

  /** Optional Slack handle for workspace integration (without @ prefix) */
  slackHandle?: string;

  /** Optional email address for external notification routing */
  email?: string;

  /** Optional URL to the agent's avatar image for UI display */
  avatarUrl?: string;
}

// ============================================================================
// Resource Limits
// ============================================================================

/**
 * Resource limits configuration for agent operations.
 *
 * Defines hard limits on computational resources an agent can consume.
 * These limits prevent runaway processes and ensure fair resource allocation
 * across the system.
 *
 * @property maxConcurrentSessions - Maximum number of child sessions that can run simultaneously
 * @property tokenBudgetPerHour - Maximum LLM tokens the agent can consume per hour
 * @property maxMemoryMB - Maximum memory allocation in megabytes
 * @property maxCpuPercent - Maximum CPU usage as a percentage (0-100)
 *
 * @example
 * ```typescript
 * const limits: ResourceLimits = {
 *   maxConcurrentSessions: 5,
 *   tokenBudgetPerHour: 100000,
 *   maxMemoryMB: 512,
 *   maxCpuPercent: 25,
 * };
 * ```
 */
export interface ResourceLimits {
  /** Maximum number of concurrent child sessions/agents this agent can spawn */
  maxConcurrentSessions: number;

  /** Maximum LLM tokens this agent can consume per hour */
  tokenBudgetPerHour: number;

  /** Maximum memory allocation in megabytes */
  maxMemoryMB: number;

  /** Maximum CPU utilization as a percentage (0-100) */
  maxCpuPercent: number;
}

/**
 * Default resource limits for VP agents.
 *
 * @remarks
 * These defaults are suitable for production VP agents managing
 * multiple disciplines and session managers.
 */
export const DEFAULT_VP_RESOURCE_LIMITS: ResourceLimits = {
  maxConcurrentSessions: 10,
  tokenBudgetPerHour: 500000,
  maxMemoryMB: 1024,
  maxCpuPercent: 50,
};

/**
 * Default resource limits for Session Manager agents.
 *
 * @remarks
 * These defaults are suitable for Session Managers coordinating
 * multiple specialized agents within a single discipline.
 */
export const DEFAULT_SESSION_MANAGER_RESOURCE_LIMITS: ResourceLimits = {
  maxConcurrentSessions: 5,
  tokenBudgetPerHour: 200000,
  maxMemoryMB: 512,
  maxCpuPercent: 25,
};

// ============================================================================
// Measurable Objectives
// ============================================================================

/**
 * Measurable objectives and KPIs for agent performance evaluation.
 *
 * Defines quantifiable targets that agents should strive to achieve.
 * These metrics are used for performance monitoring, alerting, and
 * continuous improvement.
 *
 * @property responseTimeTarget - Target response time in seconds for task acknowledgment
 * @property taskCompletionRate - Target task completion rate as a percentage (0-100)
 * @property qualityScore - Target quality score based on review feedback (0-100)
 * @property customMetrics - Optional custom metrics specific to the agent's domain
 *
 * @example
 * ```typescript
 * const objectives: MeasurableObjectives = {
 *   responseTimeTarget: 5, // 5 seconds
 *   taskCompletionRate: 95, // 95%
 *   qualityScore: 85, // 85/100
 *   customMetrics: {
 *     codeReviewTurnaround: 30, // 30 minutes
 *     testCoverage: 80, // 80%
 *   },
 * };
 * ```
 */
export interface MeasurableObjectives {
  /** Target response time in seconds for initial task acknowledgment */
  responseTimeTarget: number;

  /** Target task completion rate as a percentage (0-100) */
  taskCompletionRate: number;

  /** Target quality score based on peer review and validation (0-100) */
  qualityScore: number;

  /** Optional domain-specific custom metrics */
  customMetrics?: Record<string, number>;
}

/**
 * Default measurable objectives for VP agents.
 */
export const DEFAULT_VP_OBJECTIVES: MeasurableObjectives = {
  responseTimeTarget: 10,
  taskCompletionRate: 90,
  qualityScore: 85,
};

/**
 * Default measurable objectives for Session Manager agents.
 */
export const DEFAULT_SESSION_MANAGER_OBJECTIVES: MeasurableObjectives = {
  responseTimeTarget: 5,
  taskCompletionRate: 95,
  qualityScore: 90,
};

// ============================================================================
// Hard Constraints
// ============================================================================

/**
 * Hard constraints defining forbidden actions and approval requirements.
 *
 * These constraints act as guardrails to prevent agents from performing
 * dangerous, destructive, or unauthorized operations. Violations of hard
 * constraints should trigger immediate alerts and action termination.
 *
 * @property forbiddenCommands - Shell commands that must never be executed
 * @property forbiddenPaths - File system paths that must not be accessed
 * @property forbiddenActions - High-level actions that are prohibited
 * @property requireApprovalFor - Actions requiring human approval before execution
 *
 * @example
 * ```typescript
 * const constraints: HardConstraints = {
 *   forbiddenCommands: ['rm -rf /', 'sudo', 'chmod 777'],
 *   forbiddenPaths: ['/etc/passwd', '/root', '~/.ssh'],
 *   forbiddenActions: ['delete_production_data', 'modify_billing'],
 *   requireApprovalFor: ['deploy_to_production', 'merge_to_main'],
 * };
 * ```
 */
export interface HardConstraints {
  /** Shell commands that must never be executed by this agent */
  forbiddenCommands: string[];

  /** File system paths that must not be read, written, or accessed */
  forbiddenPaths: string[];

  /** High-level actions that are strictly prohibited */
  forbiddenActions: string[];

  /** Actions that require explicit human approval before execution */
  requireApprovalFor: string[];
}

/**
 * Default hard constraints for all supervisory agents.
 *
 * @remarks
 * These defaults provide baseline security. Additional constraints
 * should be added based on the agent's specific domain and permissions.
 */
export const DEFAULT_HARD_CONSTRAINTS: HardConstraints = {
  forbiddenCommands: [
    'rm -rf /',
    'rm -rf /*',
    'sudo rm',
    'chmod 777',
    'mkfs',
    'dd if=/dev/zero',
    ':(){:|:&};:',
  ],
  forbiddenPaths: [
    '/etc/passwd',
    '/etc/shadow',
    '/root',
    '~/.ssh',
    '.env',
    '.env.local',
    '.env.production',
    'credentials.json',
    'secrets.yaml',
  ],
  forbiddenActions: [
    'delete_production_database',
    'modify_authentication_config',
    'disable_security_features',
    'expose_secrets',
  ],
  requireApprovalFor: [
    'deploy_to_production',
    'merge_to_main',
    'modify_infrastructure',
    'change_billing',
    'delete_user_data',
  ],
};

// ============================================================================
// VP Charter (Tier 1)
// ============================================================================

/**
 * Virtual Persona (VP) Charter - Tier 1 Supervisory Agent.
 *
 * A VP Charter defines the complete identity, capabilities, and operational
 * parameters for a top-level supervisory agent. VPs are responsible for:
 *
 * - Compiling context from multiple sources (codebase, docs, user requests)
 * - Managing resources across their discipline domains
 * - Spawning and coordinating Session Manager agents
 * - Triaging incoming tasks and routing them appropriately
 * - Managing long-term memory and organizational knowledge
 *
 * @example
 * ```typescript
 * const vpCharter: VPCharter = {
 *   id: 'vp-engineering-001',
 *   tier: 1,
 *   identity: {
 *     name: 'Engineering VP',
 *     slug: 'engineering-vp',
 *     persona: 'A methodical technical leader focused on code quality and best practices',
 *   },
 *   coreDirective: 'Ensure high-quality software delivery through effective coordination',
 *   capabilities: ['context_compilation', 'session_spawning', 'task_triage'],
 *   mcpTools: ['github_swarm', 'code_review', 'agent_spawn'],
 *   resourceLimits: DEFAULT_VP_RESOURCE_LIMITS,
 *   objectives: DEFAULT_VP_OBJECTIVES,
 *   constraints: DEFAULT_HARD_CONSTRAINTS,
 *   disciplineIds: ['frontend', 'backend', 'devops'],
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface VPCharter {
  /** Unique identifier for this VP charter */
  id: string;

  /** Tier level - always 1 for VP agents */
  tier: 1;

  /** Identity configuration including name, persona, and contact info */
  identity: AgentIdentity;

  /** Core directive summarizing the VP's primary mission and purpose */
  coreDirective: string;

  /** List of capabilities granted to this VP */
  capabilities: VPCapability[];

  /** List of MCP tools this VP is authorized to use */
  mcpTools: string[];

  /** Resource consumption limits */
  resourceLimits: ResourceLimits;

  /** Measurable performance objectives */
  objectives: MeasurableObjectives;

  /** Hard constraints on forbidden actions */
  constraints: HardConstraints;

  /** IDs of disciplines this VP oversees */
  disciplineIds: string[];

  /** Optional node ID for distributed deployment */
  nodeId?: string;

  /** Timestamp when this charter was created */
  createdAt: Date;

  /** Timestamp when this charter was last updated */
  updatedAt: Date;
}

// ============================================================================
// Session Manager Charter (Tier 2)
// ============================================================================

/**
 * Session Manager Charter - Tier 2 Coordination Agent.
 *
 * A Session Manager Charter defines the identity and operational parameters
 * for a discipline-specific coordination agent. Session Managers are responsible for:
 *
 * - Coordinating specialized agents within their discipline domain
 * - Managing task distribution and agent workloads
 * - Maintaining discipline-specific memory and context
 * - Reporting status and metrics to their parent VP
 * - Ensuring quality and consistency within their domain
 *
 * @example
 * ```typescript
 * const sessionManagerCharter: SessionManagerCharter = {
 *   id: 'sm-frontend-001',
 *   tier: 2,
 *   identity: {
 *     name: 'Frontend Session Manager',
 *     slug: 'frontend-sm',
 *     persona: 'A detail-oriented coordinator specializing in React and UI development',
 *   },
 *   coreDirective: 'Coordinate frontend development tasks with focus on UX quality',
 *   disciplineId: 'frontend',
 *   parentVpId: 'vp-engineering-001',
 *   mcpTools: ['code_review', 'agent_spawn', 'task_orchestrate'],
 *   agentIds: ['react-dev-001', 'css-specialist-001', 'a11y-expert-001'],
 *   objectives: DEFAULT_SESSION_MANAGER_OBJECTIVES,
 *   constraints: DEFAULT_HARD_CONSTRAINTS,
 *   memoryBankPath: '/memory/frontend',
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface SessionManagerCharter {
  /** Unique identifier for this Session Manager charter */
  id: string;

  /** Tier level - always 2 for Session Manager agents */
  tier: 2;

  /** Identity configuration including name, persona, and contact info */
  identity: AgentIdentity;

  /** Core directive summarizing the Session Manager's primary mission */
  coreDirective: string;

  /** ID of the discipline this Session Manager coordinates */
  disciplineId: string;

  /** ID of the parent VP this Session Manager reports to */
  parentVpId: string;

  /** List of MCP tools this Session Manager is authorized to use */
  mcpTools: string[];

  /** IDs of Tier 3 agents managed by this Session Manager */
  agentIds: string[];

  /** Measurable performance objectives */
  objectives: MeasurableObjectives;

  /** Hard constraints on forbidden actions */
  constraints: HardConstraints;

  /** File system path to this Session Manager's memory bank */
  memoryBankPath: string;

  /** Timestamp when this charter was created */
  createdAt: Date;

  /** Timestamp when this charter was last updated */
  updatedAt: Date;
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * Union type representing any valid charter (VP or Session Manager).
 *
 * Use type guards to narrow the type when working with charters:
 *
 * @example
 * ```typescript
 * function processCharter(charter: Charter): void {
 *   if (isVPCharter(charter)) {
 *     console.log(`VP ${charter.identity.name} has ${charter.capabilities.length} capabilities`);
 *   } else {
 *     console.log(`SM ${charter.identity.name} manages ${charter.agentIds.length} agents`);
 *   }
 * }
 * ```
 */
export type Charter = VPCharter | SessionManagerCharter;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a charter is a VP Charter.
 *
 * @param charter - The charter to check
 * @returns True if the charter is a VPCharter
 *
 * @example
 * ```typescript
 * if (isVPCharter(charter)) {
 *   // charter is narrowed to VPCharter
 *   console.log(charter.capabilities);
 * }
 * ```
 */
export function isVPCharter(charter: Charter): charter is VPCharter {
  return charter.tier === 1;
}

/**
 * Type guard to check if a charter is a Session Manager Charter.
 *
 * @param charter - The charter to check
 * @returns True if the charter is a SessionManagerCharter
 *
 * @example
 * ```typescript
 * if (isSessionManagerCharter(charter)) {
 *   // charter is narrowed to SessionManagerCharter
 *   console.log(charter.disciplineId);
 * }
 * ```
 */
export function isSessionManagerCharter(charter: Charter): charter is SessionManagerCharter {
  return charter.tier === 2;
}

// ============================================================================
// Configuration Types for Creating Charters
// ============================================================================

/**
 * Configuration options for creating a new VP.
 *
 * This interface provides a simplified configuration surface for VP creation,
 * with sensible defaults applied for omitted properties.
 *
 * @property name - Human-readable name for the VP
 * @property persona - Description of the VP's personality and communication style
 * @property slackHandle - Optional Slack handle for notifications
 * @property capabilities - Optional list of capabilities (defaults to all)
 * @property resourceLimits - Optional resource limits (defaults applied)
 *
 * @example
 * ```typescript
 * const config: CreateVPConfig = {
 *   name: 'Engineering VP',
 *   persona: 'A methodical leader focused on code quality',
 *   slackHandle: 'eng-vp',
 *   capabilities: ['context_compilation', 'session_spawning'],
 * };
 * ```
 */
export interface CreateVPConfig {
  /** Human-readable name for the VP */
  name: string;

  /** Description of the VP's personality and communication style */
  persona: string;

  /** Optional Slack handle for workspace integration */
  slackHandle?: string;

  /** Optional list of capabilities (defaults to all capabilities) */
  capabilities?: VPCapability[];

  /** Optional resource limits (defaults applied for omitted properties) */
  resourceLimits?: Partial<ResourceLimits>;

  /** Optional custom MCP tools beyond defaults */
  mcpTools?: string[];

  /** Optional custom objectives */
  objectives?: Partial<MeasurableObjectives>;

  /** Optional additional constraints */
  constraints?: Partial<HardConstraints>;

  /** Optional discipline IDs this VP will oversee */
  disciplineIds?: string[];
}

/**
 * Configuration options for creating a new Session Manager.
 *
 * This interface provides a simplified configuration surface for Session Manager
 * creation, requiring only the essential properties.
 *
 * @property name - Human-readable name for the Session Manager
 * @property disciplineId - ID of the discipline this Session Manager will coordinate
 * @property parentVpId - ID of the parent VP
 * @property persona - Optional custom persona (defaults based on discipline)
 *
 * @example
 * ```typescript
 * const config: CreateSessionManagerConfig = {
 *   name: 'Frontend Session Manager',
 *   disciplineId: 'frontend',
 *   parentVpId: 'vp-engineering-001',
 *   persona: 'A detail-oriented React specialist',
 * };
 * ```
 */
export interface CreateSessionManagerConfig {
  /** Human-readable name for the Session Manager */
  name: string;

  /** ID of the discipline this Session Manager will coordinate */
  disciplineId: string;

  /** ID of the parent VP this Session Manager reports to */
  parentVpId: string;

  /** Optional custom persona (defaults based on discipline if omitted) */
  persona?: string;

  /** Optional custom MCP tools beyond defaults */
  mcpTools?: string[];

  /** Optional initial list of agent IDs to manage */
  agentIds?: string[];

  /** Optional custom objectives */
  objectives?: Partial<MeasurableObjectives>;

  /** Optional additional constraints */
  constraints?: Partial<HardConstraints>;

  /** Optional custom memory bank path (defaults to /memory/{disciplineId}) */
  memoryBankPath?: string;
}

// ============================================================================
// Charter Update Types
// ============================================================================

/**
 * Partial update configuration for VP charters.
 *
 * All fields are optional, allowing selective updates to charter properties.
 */
export interface UpdateVPCharterConfig {
  /** Updated identity properties */
  identity?: Partial<AgentIdentity>;

  /** Updated core directive */
  coreDirective?: string;

  /** Updated capabilities list */
  capabilities?: VPCapability[];

  /** Updated MCP tools list */
  mcpTools?: string[];

  /** Updated resource limits */
  resourceLimits?: Partial<ResourceLimits>;

  /** Updated objectives */
  objectives?: Partial<MeasurableObjectives>;

  /** Updated constraints */
  constraints?: Partial<HardConstraints>;

  /** Updated discipline IDs */
  disciplineIds?: string[];

  /** Updated node ID */
  nodeId?: string;
}

/**
 * Partial update configuration for Session Manager charters.
 *
 * All fields are optional, allowing selective updates to charter properties.
 */
export interface UpdateSessionManagerCharterConfig {
  /** Updated identity properties */
  identity?: Partial<AgentIdentity>;

  /** Updated core directive */
  coreDirective?: string;

  /** Updated MCP tools list */
  mcpTools?: string[];

  /** Updated agent IDs */
  agentIds?: string[];

  /** Updated objectives */
  objectives?: Partial<MeasurableObjectives>;

  /** Updated constraints */
  constraints?: Partial<HardConstraints>;

  /** Updated memory bank path */
  memoryBankPath?: string;
}

// ============================================================================
// Charter Validation Types
// ============================================================================

/**
 * Result of charter validation.
 */
export interface CharterValidationResult {
  /** Whether the charter is valid */
  valid: boolean;

  /** List of validation errors (empty if valid) */
  errors: CharterValidationError[];

  /** List of validation warnings (non-blocking issues) */
  warnings: CharterValidationWarning[];
}

/**
 * A validation error that prevents charter acceptance.
 */
export interface CharterValidationError {
  /** Error code for programmatic handling */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Path to the invalid field (e.g., "identity.name") */
  field?: string;
}

/**
 * A validation warning that does not prevent acceptance but should be addressed.
 */
export interface CharterValidationWarning {
  /** Warning code for programmatic handling */
  code: string;

  /** Human-readable warning message */
  message: string;

  /** Path to the concerning field */
  field?: string;

  /** Suggested fix or improvement */
  suggestion?: string;
}

// ============================================================================
// Charter Event Types
// ============================================================================

/**
 * Events emitted during charter lifecycle.
 */
export type CharterEventType =
  | 'charter:created'
  | 'charter:updated'
  | 'charter:deleted'
  | 'charter:activated'
  | 'charter:deactivated'
  | 'charter:suspended'
  | 'charter:constraint_violated';

/**
 * Base interface for charter events.
 */
export interface CharterEvent {
  /** Type of the event */
  type: CharterEventType;

  /** ID of the affected charter */
  charterId: string;

  /** Timestamp of the event */
  timestamp: Date;

  /** Optional metadata about the event */
  metadata?: Record<string, unknown>;
}

/**
 * Event emitted when a charter constraint is violated.
 */
export interface CharterConstraintViolationEvent extends CharterEvent {
  type: 'charter:constraint_violated';

  /** The constraint that was violated */
  constraint: {
    type: 'command' | 'path' | 'action';
    value: string;
  };

  /** The action that triggered the violation */
  attemptedAction: string;

  /** Whether the action was blocked */
  blocked: boolean;
}
