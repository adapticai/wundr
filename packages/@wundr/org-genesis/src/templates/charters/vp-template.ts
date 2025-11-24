/**
 * @fileoverview VP Charter Template
 *
 * This module provides default templates and factory functions for creating
 * Virtual Persona (VP) charters. VPs are Tier 1 supervisory agents responsible
 * for context compilation, resource management, and coordinating Session Managers.
 *
 * The VP acts as a facilitator and orchestrator - it does NOT write code directly.
 * Instead, it compiles contexts, manages resources, and delegates execution to
 * specialized Session Managers and their subordinate agents.
 *
 * @module @wundr/org-genesis/templates/charters/vp-template
 * @version 1.0.0
 */

import { generateVpId, generateSlug } from '../../utils/index.js';

import type {
  VPCharter,
  VPCapability,
  ResourceLimits,
  MeasurableObjectives,
  HardConstraints,
  AgentIdentity,
} from '../../types/index.js';

// ============================================================================
// Template Version
// ============================================================================

/**
 * Version of the VP charter template.
 * Used for migration and compatibility checks.
 */
export const VP_CHARTER_TEMPLATE_VERSION = '1.0.0';

// ============================================================================
// Default VP Capabilities
// ============================================================================

/**
 * Default capabilities granted to VP agents.
 *
 * These capabilities define the operational permissions for a VP:
 * - `context_compilation`: Gather and synthesize context from multiple sources
 * - `resource_management`: Allocate and manage computational resources
 * - `slack_operations`: Interact with Slack workspaces for communication
 * - `session_spawning`: Create and terminate Session Manager instances
 * - `task_triage`: Analyze, prioritize, and route incoming tasks
 * - `memory_management`: Manage persistent and episodic memory stores
 *
 * @remarks
 * VPs are designed to facilitate and coordinate - they do NOT write code directly.
 */
export const VP_TEMPLATE_CAPABILITIES: VPCapability[] = [
  'context_compilation',
  'resource_management',
  'slack_operations',
  'session_spawning',
  'task_triage',
  'memory_management',
];

// ============================================================================
// Default MCP Tools
// ============================================================================

/**
 * Default MCP tools available to VP agents.
 *
 * These tools enable the VP to perform its coordination duties:
 * - `slack`: Communication with team via Slack integration
 * - `filesystem`: Read-only access for context compilation
 * - `shell`: Limited shell access for system queries (not code execution)
 * - `orchestrator`: Spawn and manage Session Manager agents
 * - `memory_store`: Access to persistent memory storage
 * - `memory_retrieve`: Query historical context and decisions
 * - `agent_spawn`: Create specialized agents on demand
 * - `task_orchestrate`: Distribute and track tasks across agents
 * - `swarm_status`: Monitor agent swarm health and metrics
 *
 * @remarks
 * VPs have broad tool access for coordination but should delegate
 * actual code execution to subordinate agents.
 */
export const VP_TEMPLATE_MCP_TOOLS: string[] = [
  'slack',
  'filesystem',
  'shell',
  'orchestrator',
  'memory_store',
  'memory_retrieve',
  'agent_spawn',
  'task_orchestrate',
  'swarm_status',
  'agent_metrics',
];

// ============================================================================
// Default Resource Limits
// ============================================================================

/**
 * Default resource limits for VP agents.
 *
 * These limits ensure VPs operate within reasonable bounds:
 * - `maxConcurrentSessions`: Maximum Session Managers that can be active
 * - `tokenBudgetPerHour`: LLM tokens available per hour (higher for VPs)
 * - `maxMemoryMB`: Memory allocation in megabytes
 * - `maxCpuPercent`: CPU usage ceiling as percentage
 *
 * @remarks
 * VPs have higher resource limits than Session Managers as they
 * coordinate multiple disciplines and manage broader context.
 */
export const VP_DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxConcurrentSessions: 10,
  tokenBudgetPerHour: 500000,
  maxMemoryMB: 1024,
  maxCpuPercent: 50,
};

// ============================================================================
// Default Objectives
// ============================================================================

/**
 * Default measurable objectives for VP agents.
 *
 * These objectives define success criteria and KPIs:
 * - `responseTimeTarget`: Target acknowledgment time in seconds
 * - `taskCompletionRate`: Target completion rate as percentage
 * - `qualityScore`: Target quality score based on reviews
 * - `customMetrics`: VP-specific metrics for performance tracking
 *
 * @remarks
 * VP objectives focus on coordination efficiency and throughput
 * rather than direct implementation metrics.
 */
export const VP_DEFAULT_OBJECTIVES: MeasurableObjectives = {
  responseTimeTarget: 10,
  taskCompletionRate: 90,
  qualityScore: 85,
  customMetrics: {
    sessionSpawnLatency: 5, // Seconds to spawn a new session
    contextCompilationTime: 30, // Seconds to compile full context
    taskTriageAccuracy: 95, // Percentage of correctly routed tasks
    resourceUtilizationEfficiency: 80, // Percentage of optimal resource use
  },
};

// ============================================================================
// Default Constraints
// ============================================================================

/**
 * Default hard constraints for VP agents.
 *
 * These constraints prevent VPs from performing dangerous operations:
 * - `forbiddenCommands`: Shell commands that must never be executed
 * - `forbiddenPaths`: File paths that must not be accessed
 * - `forbiddenActions`: High-level actions that are prohibited
 * - `requireApprovalFor`: Actions requiring human approval
 *
 * @remarks
 * VPs have additional constraints focused on coordination safety.
 * They should not modify code directly or make production changes.
 */
export const VP_DEFAULT_CONSTRAINTS: HardConstraints = {
  forbiddenCommands: [
    'rm -rf /',
    'rm -rf /*',
    'rm -rf ~',
    'sudo rm',
    'chmod 777',
    'mkfs',
    'dd if=/dev/zero',
    ':(){:|:&};:',
    'DROP TABLE',
    'DROP DATABASE',
    'TRUNCATE TABLE',
    'DELETE FROM',
    'git push --force',
    'git reset --hard origin',
  ],
  forbiddenPaths: [
    '/etc/passwd',
    '/etc/shadow',
    '/root',
    '~/.ssh',
    '.env',
    '.env.local',
    '.env.production',
    '.env.secrets',
    'credentials.json',
    'secrets.yaml',
    'secrets.json',
    '*.pem',
    '*.key',
    'id_rsa',
    'id_ed25519',
  ],
  forbiddenActions: [
    'delete_production_database',
    'modify_authentication_config',
    'disable_security_features',
    'expose_secrets',
    'bypass_approval_workflow',
    'modify_billing_config',
    'delete_audit_logs',
    'escalate_own_permissions',
  ],
  requireApprovalFor: [
    'deploy_to_production',
    'merge_to_main',
    'modify_infrastructure',
    'change_billing',
    'delete_user_data',
    'modify_access_control',
    'create_api_keys',
    'modify_rate_limits',
    'change_resource_quotas',
  ],
};

// ============================================================================
// Default VP Charter Template
// ============================================================================

/**
 * Default VP Charter template with sensible defaults.
 *
 * This template provides the foundational structure for VP agents.
 * It includes all standard capabilities, tools, and constraints
 * appropriate for a Tier 1 supervisory agent.
 *
 * @remarks
 * The `id` and `identity` fields must be provided when creating
 * a VP charter, as they are unique to each VP instance.
 *
 * The VP's core directive emphasizes facilitation over execution:
 * VPs compile context, manage resources, and coordinate Session
 * Managers - they do NOT write code directly.
 *
 * @example
 * ```typescript
 * const myVpCharter: VPCharter = {
 *   ...DEFAULT_VP_CHARTER,
 *   id: generateVpId(),
 *   identity: {
 *     name: 'Engineering VP',
 *     slug: 'engineering-vp',
 *     persona: 'A methodical technical leader focused on code quality',
 *   },
 * };
 * ```
 */
export const DEFAULT_VP_CHARTER: Omit<VPCharter, 'id' | 'identity'> = {
  tier: 1,
  coreDirective:
    'You facilitate. You do not code; you compile contexts and manage Session Managers. ' +
    'Your role is to orchestrate, prioritize, and ensure information flows efficiently ' +
    'between disciplines. Delegate all implementation tasks to appropriate Session Managers.',
  capabilities: VP_TEMPLATE_CAPABILITIES,
  mcpTools: VP_TEMPLATE_MCP_TOOLS,
  resourceLimits: VP_DEFAULT_RESOURCE_LIMITS,
  objectives: VP_DEFAULT_OBJECTIVES,
  constraints: VP_DEFAULT_CONSTRAINTS,
  disciplineIds: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================================================
// VP Charter Creation Options
// ============================================================================

/**
 * Options for creating a VP charter from the template.
 *
 * All fields are optional except `name` - defaults from the template
 * will be used for any omitted fields.
 *
 * @property name - Required: Human-readable name for the VP
 * @property persona - Optional: Description of personality and communication style
 * @property slackHandle - Optional: Slack handle for notifications
 * @property email - Optional: Email for external communications
 * @property avatarUrl - Optional: URL to avatar image
 * @property coreDirective - Optional: Override the default core directive
 * @property capabilities - Optional: Override default capabilities
 * @property mcpTools - Optional: Additional MCP tools beyond defaults
 * @property resourceLimits - Optional: Override resource limits
 * @property objectives - Optional: Override measurable objectives
 * @property constraints - Optional: Override hard constraints
 * @property disciplineIds - Optional: IDs of disciplines to oversee
 * @property nodeId - Optional: Node ID for distributed deployment
 */
export interface CreateVPCharterOptions {
  /** Human-readable name for the VP (required) */
  name: string;

  /** Description of the VP's personality and communication style */
  persona?: string;

  /** Slack handle for workspace integration (without @ prefix) */
  slackHandle?: string;

  /** Email address for external notification routing */
  email?: string;

  /** URL to the VP's avatar image for UI display */
  avatarUrl?: string;

  /** Override the default core directive */
  coreDirective?: string;

  /** Override default capabilities (replaces defaults) */
  capabilities?: VPCapability[];

  /** Additional MCP tools beyond defaults (merged with defaults) */
  mcpTools?: string[];

  /** Override resource limits (merged with defaults) */
  resourceLimits?: Partial<ResourceLimits>;

  /** Override measurable objectives (merged with defaults) */
  objectives?: Partial<MeasurableObjectives>;

  /** Override hard constraints (merged with defaults) */
  constraints?: Partial<HardConstraints>;

  /** IDs of disciplines this VP will oversee */
  disciplineIds?: string[];

  /** Node ID for distributed deployment */
  nodeId?: string;
}

// ============================================================================
// VP Charter Factory Function
// ============================================================================

/**
 * Create a new VP Charter with the provided options.
 *
 * This factory function creates a complete VPCharter by merging
 * the provided options with sensible defaults from the template.
 *
 * @param options - Configuration options for the VP charter
 * @returns A complete VPCharter ready for registration
 *
 * @remarks
 * - A unique ID is automatically generated using `generateVpId()`
 * - The slug is derived from the name using `generateSlug()`
 * - Resource limits and objectives are merged with defaults
 * - Constraints are merged (arrays are concatenated, not replaced)
 * - MCP tools are merged with defaults (additional tools are appended)
 *
 * @example
 * ```typescript
 * // Minimal creation - uses all defaults
 * const minimalVp = createVPCharter({ name: 'Engineering VP' });
 *
 * // Full customization
 * const customVp = createVPCharter({
 *   name: 'Legal VP',
 *   persona: 'A meticulous compliance expert focused on regulatory requirements',
 *   slackHandle: 'legal-vp',
 *   capabilities: ['context_compilation', 'task_triage', 'memory_management'],
 *   resourceLimits: { tokenBudgetPerHour: 300000 },
 *   disciplineIds: ['contracts', 'compliance', 'ip-protection'],
 * });
 *
 * // Override core directive
 * const specializedVp = createVPCharter({
 *   name: 'Security VP',
 *   coreDirective: 'Monitor and coordinate security operations across all disciplines.',
 *   mcpTools: ['security_scanner', 'vulnerability_tracker'],
 * });
 * ```
 */
export function createVPCharter(options: CreateVPCharterOptions): VPCharter {
  const now = new Date();
  const slug = generateSlug(options.name);

  // Build identity
  const identity: AgentIdentity = {
    name: options.name,
    slug,
    persona:
      options.persona ||
      `A capable and efficient Virtual Persona responsible for coordinating ${options.name} operations.`,
    slackHandle: options.slackHandle,
    email: options.email,
    avatarUrl: options.avatarUrl,
  };

  // Merge resource limits with defaults
  const resourceLimits: ResourceLimits = {
    ...VP_DEFAULT_RESOURCE_LIMITS,
    ...options.resourceLimits,
  };

  // Merge objectives with defaults
  const objectives: MeasurableObjectives = {
    ...VP_DEFAULT_OBJECTIVES,
    ...options.objectives,
    customMetrics: {
      ...VP_DEFAULT_OBJECTIVES.customMetrics,
      ...options.objectives?.customMetrics,
    },
  };

  // Merge constraints with defaults (concatenate arrays)
  const constraints: HardConstraints = {
    forbiddenCommands: [
      ...VP_DEFAULT_CONSTRAINTS.forbiddenCommands,
      ...(options.constraints?.forbiddenCommands || []),
    ],
    forbiddenPaths: [
      ...VP_DEFAULT_CONSTRAINTS.forbiddenPaths,
      ...(options.constraints?.forbiddenPaths || []),
    ],
    forbiddenActions: [
      ...VP_DEFAULT_CONSTRAINTS.forbiddenActions,
      ...(options.constraints?.forbiddenActions || []),
    ],
    requireApprovalFor: [
      ...VP_DEFAULT_CONSTRAINTS.requireApprovalFor,
      ...(options.constraints?.requireApprovalFor || []),
    ],
  };

  // Deduplicate constraint arrays
  constraints.forbiddenCommands = [...new Set(constraints.forbiddenCommands)];
  constraints.forbiddenPaths = [...new Set(constraints.forbiddenPaths)];
  constraints.forbiddenActions = [...new Set(constraints.forbiddenActions)];
  constraints.requireApprovalFor = [...new Set(constraints.requireApprovalFor)];

  // Merge MCP tools (append additional tools to defaults)
  const mcpTools = [
    ...VP_TEMPLATE_MCP_TOOLS,
    ...(options.mcpTools || []).filter((tool) => !VP_TEMPLATE_MCP_TOOLS.includes(tool)),
  ];

  return {
    id: generateVpId(),
    tier: 1,
    identity,
    coreDirective: options.coreDirective || DEFAULT_VP_CHARTER.coreDirective,
    capabilities: options.capabilities || VP_TEMPLATE_CAPABILITIES,
    mcpTools,
    resourceLimits,
    objectives,
    constraints,
    disciplineIds: options.disciplineIds || [],
    nodeId: options.nodeId,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// VP Charter from Partial
// ============================================================================

/**
 * Create a VP Charter from partial data, filling in missing fields with defaults.
 *
 * This function is useful when loading partial charter data from storage
 * or when migrating from older charter formats.
 *
 * @param partial - Partial VP charter data
 * @returns A complete VPCharter with defaults applied to missing fields
 *
 * @example
 * ```typescript
 * // Restore from storage with missing fields
 * const storedData = JSON.parse(storedJson);
 * const charter = createVPCharterFromPartial(storedData);
 * ```
 */
export function createVPCharterFromPartial(partial: Partial<VPCharter>): VPCharter {
  const now = new Date();

  // Ensure required identity fields
  const identity: AgentIdentity = {
    name: partial.identity?.name || 'Unnamed VP',
    slug: partial.identity?.slug || generateSlug(partial.identity?.name || 'unnamed-vp'),
    persona: partial.identity?.persona || 'A Virtual Persona agent.',
    slackHandle: partial.identity?.slackHandle,
    email: partial.identity?.email,
    avatarUrl: partial.identity?.avatarUrl,
  };

  return {
    id: partial.id || generateVpId(),
    tier: 1,
    identity,
    coreDirective: partial.coreDirective || DEFAULT_VP_CHARTER.coreDirective,
    capabilities: partial.capabilities || VP_TEMPLATE_CAPABILITIES,
    mcpTools: partial.mcpTools || VP_TEMPLATE_MCP_TOOLS,
    resourceLimits: {
      ...VP_DEFAULT_RESOURCE_LIMITS,
      ...partial.resourceLimits,
    },
    objectives: {
      ...VP_DEFAULT_OBJECTIVES,
      ...partial.objectives,
      customMetrics: {
        ...VP_DEFAULT_OBJECTIVES.customMetrics,
        ...partial.objectives?.customMetrics,
      },
    },
    constraints: {
      forbiddenCommands:
        partial.constraints?.forbiddenCommands || VP_DEFAULT_CONSTRAINTS.forbiddenCommands,
      forbiddenPaths: partial.constraints?.forbiddenPaths || VP_DEFAULT_CONSTRAINTS.forbiddenPaths,
      forbiddenActions:
        partial.constraints?.forbiddenActions || VP_DEFAULT_CONSTRAINTS.forbiddenActions,
      requireApprovalFor:
        partial.constraints?.requireApprovalFor || VP_DEFAULT_CONSTRAINTS.requireApprovalFor,
    },
    disciplineIds: partial.disciplineIds || [],
    nodeId: partial.nodeId,
    createdAt: partial.createdAt ? new Date(partial.createdAt) : now,
    updatedAt: now,
  };
}

// ============================================================================
// Specialized VP Templates
// ============================================================================

/**
 * Create an Engineering VP charter with engineering-focused defaults.
 *
 * @param options - Configuration options for the VP charter
 * @returns An Engineering VP charter
 *
 * @example
 * ```typescript
 * const engVp = createEngineeringVPCharter({
 *   slackHandle: 'eng-vp',
 *   disciplineIds: ['frontend', 'backend', 'devops'],
 * });
 * ```
 */
export function createEngineeringVPCharter(
  options: Partial<Omit<CreateVPCharterOptions, 'name'>> = {},
): VPCharter {
  return createVPCharter({
    name: 'Engineering VP',
    persona:
      'A methodical and detail-oriented technical leader focused on code quality, ' +
      'best practices, and efficient delivery. Communicates clearly with technical ' +
      'precision while remaining approachable.',
    ...options,
    mcpTools: [
      ...(options.mcpTools || []),
      'github_swarm',
      'code_review',
      'repo_analyze',
      'pr_enhance',
    ],
    constraints: {
      ...options.constraints,
      requireApprovalFor: [
        ...(options.constraints?.requireApprovalFor || []),
        'modify_ci_pipeline',
        'change_dependency_versions',
        'modify_security_config',
      ],
    },
  });
}

/**
 * Create a Product VP charter with product management focused defaults.
 *
 * @param options - Configuration options for the VP charter
 * @returns A Product VP charter
 *
 * @example
 * ```typescript
 * const productVp = createProductVPCharter({
 *   disciplineIds: ['product', 'ux', 'analytics'],
 * });
 * ```
 */
export function createProductVPCharter(
  options: Partial<Omit<CreateVPCharterOptions, 'name'>> = {},
): VPCharter {
  return createVPCharter({
    name: 'Product VP',
    persona:
      'A strategic product leader focused on user value, market fit, and roadmap ' +
      'prioritization. Balances stakeholder needs with technical feasibility and ' +
      'communicates product vision clearly.',
    ...options,
    mcpTools: [...(options.mcpTools || []), 'analytics', 'user_feedback', 'roadmap_tracker'],
  });
}

/**
 * Create an Operations VP charter with operations focused defaults.
 *
 * @param options - Configuration options for the VP charter
 * @returns An Operations VP charter
 *
 * @example
 * ```typescript
 * const opsVp = createOperationsVPCharter({
 *   disciplineIds: ['infrastructure', 'security', 'compliance'],
 * });
 * ```
 */
export function createOperationsVPCharter(
  options: Partial<Omit<CreateVPCharterOptions, 'name'>> = {},
): VPCharter {
  return createVPCharter({
    name: 'Operations VP',
    persona:
      'A reliability-focused operations leader prioritizing system stability, ' +
      'security, and operational excellence. Communicates incident status and ' +
      'risk assessments with clarity and urgency.',
    ...options,
    mcpTools: [
      ...(options.mcpTools || []),
      'monitoring',
      'alerting',
      'incident_tracker',
      'deploy_status',
    ],
    constraints: {
      ...options.constraints,
      requireApprovalFor: [
        ...(options.constraints?.requireApprovalFor || []),
        'modify_monitoring_rules',
        'change_alerting_config',
        'modify_backup_policy',
      ],
    },
  });
}
