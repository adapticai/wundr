/**
 * @fileoverview Session Manager Charter Template
 *
 * This module provides default templates and factory functions for creating
 * Session Manager charters. Session Managers are Tier 2 coordination agents
 * responsible for managing specialized agents within a discipline domain.
 *
 * Session Managers act as the operational bridge between Orchestrator-level strategy
 * and Tier 3 agent execution. They coordinate task distribution, maintain
 * discipline-specific context, and ensure quality within their domain.
 *
 * @module @wundr/org-genesis/templates/charters/session-manager-template
 * @version 1.0.0
 */

import { generateSessionManagerId, generateSlug } from '../../utils/index.js';

import type {
  SessionManagerCharter,
  ResourceLimits,
  MeasurableObjectives,
  HardConstraints,
  AgentIdentity,
} from '../../types/index.js';

// ============================================================================
// Template Version
// ============================================================================

/**
 * Version of the Session Manager charter template.
 * Used for migration and compatibility checks.
 */
export const SESSION_MANAGER_TEMPLATE_VERSION = '1.0.0';

// ============================================================================
// Default MCP Tools
// ============================================================================

/**
 * Default MCP tools available to Session Manager agents.
 *
 * These tools enable Session Managers to perform their coordination duties:
 * - `agent_spawn`: Create and manage subordinate agents
 * - `task_orchestrate`: Distribute tasks to agents and track progress
 * - `code_review`: Initiate and manage code review workflows
 * - `memory_store`: Store discipline-specific context and learnings
 * - `memory_retrieve`: Query historical context for informed decisions
 * - `agent_metrics`: Monitor agent performance and health
 * - `filesystem`: Read access for context compilation
 *
 * @remarks
 * Session Managers have focused tool access for their discipline domain.
 * They coordinate agents but delegate actual execution to Tier 3 agents.
 */
export const DEFAULT_SM_MCP_TOOLS: string[] = [
  'agent_spawn',
  'task_orchestrate',
  'code_review',
  'memory_store',
  'memory_retrieve',
  'agent_metrics',
  'filesystem',
  'task_status',
  'task_results',
];

// ============================================================================
// Default Resource Limits
// ============================================================================

/**
 * Default resource limits for Session Manager agents.
 *
 * These limits are lower than Orchestrator limits, appropriate for discipline-scoped coordination:
 * - `maxConcurrentSessions`: Maximum Tier 3 agents that can be active
 * - `tokenBudgetPerHour`: LLM tokens available per hour
 * - `maxMemoryMB`: Memory allocation in megabytes
 * - `maxCpuPercent`: CPU usage ceiling as percentage
 *
 * @remarks
 * Session Managers operate within a single discipline, so resource
 * requirements are proportionally lower than Orchestrator agents.
 */
export const SM_DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxConcurrentSessions: 5,
  tokenBudgetPerHour: 200000,
  maxMemoryMB: 512,
  maxCpuPercent: 25,
};

// ============================================================================
// Default Objectives
// ============================================================================

/**
 * Default measurable objectives for Session Manager agents.
 *
 * These objectives define success criteria and KPIs:
 * - `responseTimeTarget`: Target acknowledgment time in seconds (faster than VPs)
 * - `taskCompletionRate`: Target completion rate as percentage (higher than VPs)
 * - `qualityScore`: Target quality score based on reviews (higher than VPs)
 * - `customMetrics`: SM-specific metrics for performance tracking
 *
 * @remarks
 * Session Manager objectives focus on operational efficiency and
 * quality within their discipline domain.
 */
export const SM_DEFAULT_OBJECTIVES: MeasurableObjectives = {
  responseTimeTarget: 5,
  taskCompletionRate: 95,
  qualityScore: 90,
  customMetrics: {
    agentUtilization: 80, // Percentage of agent time productively used
    taskRoutingAccuracy: 95, // Percentage of tasks routed to correct agent
    contextRetentionScore: 90, // Quality of maintained discipline context
    escalationRate: 5, // Percentage of tasks requiring Orchestrator escalation
  },
};

// ============================================================================
// Default Constraints
// ============================================================================

/**
 * Default hard constraints for Session Manager agents.
 *
 * These constraints are similar to Orchestrator constraints but may include
 * discipline-specific restrictions:
 * - `forbiddenCommands`: Shell commands that must never be executed
 * - `forbiddenPaths`: File paths that must not be accessed
 * - `forbiddenActions`: High-level actions that are prohibited
 * - `requireApprovalFor`: Actions requiring human or Orchestrator approval
 *
 * @remarks
 * Session Managers have constraints focused on their operational domain.
 * They should escalate cross-discipline concerns to their parent Orchestrator.
 */
export const SM_DEFAULT_CONSTRAINTS: HardConstraints = {
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
  ],
  forbiddenActions: [
    'delete_production_database',
    'modify_authentication_config',
    'disable_security_features',
    'expose_secrets',
    'bypass_approval_workflow',
    'modify_cross_discipline_resources',
  ],
  requireApprovalFor: [
    'deploy_to_production',
    'merge_to_main',
    'delete_user_data',
    'modify_shared_dependencies',
    'escalate_to_vp',
    'spawn_cross_discipline_agent',
  ],
};

// ============================================================================
// Default Session Manager Charter Template
// ============================================================================

/**
 * Default Session Manager Charter template with sensible defaults.
 *
 * This template provides the foundational structure for Session Manager agents.
 * It includes all standard tools and constraints appropriate for a Tier 2
 * coordination agent.
 *
 * @remarks
 * The `id`, `identity`, `disciplineId`, and `parentVpId` fields must be
 * provided when creating a Session Manager charter, as they are unique
 * to each instance.
 *
 * Session Managers coordinate within a single discipline domain and
 * report to their parent Orchestrator for cross-discipline concerns.
 *
 * @example
 * ```typescript
 * const mySmCharter: SessionManagerCharter = {
 *   ...DEFAULT_SESSION_MANAGER_CHARTER,
 *   id: generateSessionManagerId(),
 *   identity: {
 *     name: 'Frontend Session Manager',
 *     slug: 'frontend-sm',
 *     persona: 'A detail-oriented React specialist',
 *   },
 *   disciplineId: 'frontend',
 *   parentVpId: 'vp_abc123',
 * };
 * ```
 */
export const DEFAULT_SESSION_MANAGER_CHARTER: Omit<
  SessionManagerCharter,
  'id' | 'identity' | 'disciplineId' | 'parentVpId'
> = {
  tier: 2,
  coreDirective:
    'Coordinate specialized agents within your discipline to deliver high-quality outcomes. ' +
    'Maintain discipline-specific context, distribute tasks efficiently, and ensure ' +
    'quality standards are met. Escalate cross-discipline concerns to your parent Orchestrator.',
  mcpTools: DEFAULT_SM_MCP_TOOLS,
  agentIds: [],
  objectives: SM_DEFAULT_OBJECTIVES,
  constraints: SM_DEFAULT_CONSTRAINTS,
  memoryBankPath: '/memory/sessions',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================================================
// Session Manager Charter Creation Options
// ============================================================================

/**
 * Options for creating a Session Manager charter from the template.
 *
 * Required fields are `name`, `disciplineId`, and `parentVpId`.
 * Defaults from the template will be used for any omitted optional fields.
 *
 * @property name - Required: Human-readable name for the Session Manager
 * @property disciplineId - Required: ID of the discipline this SM coordinates
 * @property parentVpId - Required: ID of the parent Orchestrator this SM reports to
 * @property persona - Optional: Description of personality and communication style
 * @property slackHandle - Optional: Slack handle for notifications
 * @property email - Optional: Email for external communications
 * @property avatarUrl - Optional: URL to avatar image
 * @property coreDirective - Optional: Override the default core directive
 * @property mcpTools - Optional: Additional MCP tools beyond defaults
 * @property agentIds - Optional: Initial list of agent IDs to manage
 * @property objectives - Optional: Override measurable objectives
 * @property constraints - Optional: Override hard constraints
 * @property memoryBankPath - Optional: Custom memory bank path
 */
export interface CreateSessionManagerCharterOptions {
  /** Human-readable name for the Session Manager (required) */
  name: string;

  /** ID of the discipline this Session Manager coordinates (required) */
  disciplineId: string;

  /** ID of the parent Orchestrator this Session Manager reports to (required) */
  parentVpId: string;

  /** Description of the SM's personality and communication style */
  persona?: string;

  /** Slack handle for workspace integration (without @ prefix) */
  slackHandle?: string;

  /** Email address for external notification routing */
  email?: string;

  /** URL to the SM's avatar image for UI display */
  avatarUrl?: string;

  /** Override the default core directive */
  coreDirective?: string;

  /** Additional MCP tools beyond defaults (merged with defaults) */
  mcpTools?: string[];

  /** Initial list of agent IDs this SM will manage */
  agentIds?: string[];

  /** Override measurable objectives (merged with defaults) */
  objectives?: Partial<MeasurableObjectives>;

  /** Override hard constraints (merged with defaults) */
  constraints?: Partial<HardConstraints>;

  /** Custom memory bank path (defaults to /memory/{disciplineId}) */
  memoryBankPath?: string;
}

// ============================================================================
// Session Manager Charter Factory Function
// ============================================================================

/**
 * Create a new Session Manager Charter with the provided options.
 *
 * This factory function creates a complete SessionManagerCharter by merging
 * the provided options with sensible defaults from the template.
 *
 * @param options - Configuration options for the Session Manager charter
 * @returns A complete SessionManagerCharter ready for registration
 *
 * @remarks
 * - A unique ID is automatically generated using `generateSessionManagerId()`
 * - The slug is derived from the name using `generateSlug()`
 * - Objectives are merged with defaults
 * - Constraints are merged (arrays are concatenated, not replaced)
 * - MCP tools are merged with defaults (additional tools are appended)
 * - Memory bank path defaults to `/memory/{disciplineId}` if not specified
 *
 * @example
 * ```typescript
 * // Basic creation
 * const frontendSm = createSessionManagerCharter({
 *   name: 'Frontend Session Manager',
 *   disciplineId: 'frontend',
 *   parentVpId: 'vp_engineering_001',
 * });
 *
 * // Full customization
 * const customSm = createSessionManagerCharter({
 *   name: 'Backend Session Manager',
 *   disciplineId: 'backend',
 *   parentVpId: 'vp_engineering_001',
 *   persona: 'A systematic architect focused on API design and performance',
 *   agentIds: ['api-dev-001', 'db-specialist-001'],
 *   mcpTools: ['database_query', 'api_tester'],
 *   objectives: { taskCompletionRate: 98 },
 * });
 * ```
 */
export function createSessionManagerCharter(
  options: CreateSessionManagerCharterOptions,
): SessionManagerCharter {
  const now = new Date();
  const slug = generateSlug(options.name);

  // Build identity
  const identity: AgentIdentity = {
    name: options.name,
    slug,
    persona:
      options.persona ||
      'A capable Session Manager coordinating ' + options.disciplineId + ' operations ' +
        'with focus on quality and efficiency.',
    slackHandle: options.slackHandle,
    email: options.email,
    avatarUrl: options.avatarUrl,
  };

  // Merge objectives with defaults
  const objectives: MeasurableObjectives = {
    ...SM_DEFAULT_OBJECTIVES,
    ...options.objectives,
    customMetrics: {
      ...SM_DEFAULT_OBJECTIVES.customMetrics,
      ...options.objectives?.customMetrics,
    },
  };

  // Merge constraints with defaults (concatenate arrays)
  const constraints: HardConstraints = {
    forbiddenCommands: [
      ...SM_DEFAULT_CONSTRAINTS.forbiddenCommands,
      ...(options.constraints?.forbiddenCommands || []),
    ],
    forbiddenPaths: [
      ...SM_DEFAULT_CONSTRAINTS.forbiddenPaths,
      ...(options.constraints?.forbiddenPaths || []),
    ],
    forbiddenActions: [
      ...SM_DEFAULT_CONSTRAINTS.forbiddenActions,
      ...(options.constraints?.forbiddenActions || []),
    ],
    requireApprovalFor: [
      ...SM_DEFAULT_CONSTRAINTS.requireApprovalFor,
      ...(options.constraints?.requireApprovalFor || []),
    ],
  };

  // Deduplicate constraint arrays
  constraints.forbiddenCommands = Array.from(new Set(constraints.forbiddenCommands));
  constraints.forbiddenPaths = Array.from(new Set(constraints.forbiddenPaths));
  constraints.forbiddenActions = Array.from(new Set(constraints.forbiddenActions));
  constraints.requireApprovalFor = Array.from(new Set(constraints.requireApprovalFor));

  // Merge MCP tools (append additional tools to defaults)
  const mcpTools = [
    ...DEFAULT_SM_MCP_TOOLS,
    ...(options.mcpTools || []).filter((tool) => !DEFAULT_SM_MCP_TOOLS.includes(tool)),
  ];

  // Default memory bank path based on discipline
  const memoryBankPath = options.memoryBankPath || `/memory/${options.disciplineId}`;

  return {
    id: generateSessionManagerId(),
    tier: 2,
    identity,
    coreDirective: options.coreDirective || DEFAULT_SESSION_MANAGER_CHARTER.coreDirective,
    disciplineId: options.disciplineId,
    parentVpId: options.parentVpId,
    mcpTools,
    agentIds: options.agentIds || [],
    objectives,
    constraints,
    memoryBankPath,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// Session Manager Charter from Partial
// ============================================================================

/**
 * Create a Session Manager Charter from partial data, filling in missing fields with defaults.
 *
 * This function is useful when loading partial charter data from storage
 * or when migrating from older charter formats.
 *
 * @param partial - Partial Session Manager charter data
 * @returns A complete SessionManagerCharter with defaults applied to missing fields
 *
 * @remarks
 * If `disciplineId` or `parentVpId` are missing, placeholder values are used.
 * These should be updated before the charter is registered.
 *
 * @example
 * ```typescript
 * // Restore from storage with missing fields
 * const storedData = JSON.parse(storedJson);
 * const charter = createSessionManagerCharterFromPartial(storedData);
 * ```
 */
export function createSessionManagerCharterFromPartial(
  partial: Partial<SessionManagerCharter>,
): SessionManagerCharter {
  const now = new Date();
  const disciplineId = partial.disciplineId || 'unknown';

  // Ensure required identity fields
  const identity: AgentIdentity = {
    name: partial.identity?.name || 'Unnamed Session Manager',
    slug: partial.identity?.slug || generateSlug(partial.identity?.name || 'unnamed-sm'),
    persona: partial.identity?.persona || 'A Session Manager agent.',
    slackHandle: partial.identity?.slackHandle,
    email: partial.identity?.email,
    avatarUrl: partial.identity?.avatarUrl,
  };

  return {
    id: partial.id || generateSessionManagerId(),
    tier: 2,
    identity,
    coreDirective: partial.coreDirective || DEFAULT_SESSION_MANAGER_CHARTER.coreDirective,
    disciplineId,
    parentVpId: partial.parentVpId || 'unknown',
    mcpTools: partial.mcpTools || DEFAULT_SM_MCP_TOOLS,
    agentIds: partial.agentIds || [],
    objectives: {
      ...SM_DEFAULT_OBJECTIVES,
      ...partial.objectives,
      customMetrics: {
        ...SM_DEFAULT_OBJECTIVES.customMetrics,
        ...partial.objectives?.customMetrics,
      },
    },
    constraints: {
      forbiddenCommands:
        partial.constraints?.forbiddenCommands || SM_DEFAULT_CONSTRAINTS.forbiddenCommands,
      forbiddenPaths: partial.constraints?.forbiddenPaths || SM_DEFAULT_CONSTRAINTS.forbiddenPaths,
      forbiddenActions:
        partial.constraints?.forbiddenActions || SM_DEFAULT_CONSTRAINTS.forbiddenActions,
      requireApprovalFor:
        partial.constraints?.requireApprovalFor || SM_DEFAULT_CONSTRAINTS.requireApprovalFor,
    },
    memoryBankPath: partial.memoryBankPath || `/memory/${disciplineId}`,
    createdAt: partial.createdAt ? new Date(partial.createdAt) : now,
    updatedAt: now,
  };
}

// ============================================================================
// Specialized Session Manager Templates
// ============================================================================

/**
 * Create a Frontend Session Manager charter with frontend-focused defaults.
 *
 * @param parentVpId - ID of the parent Orchestrator
 * @param options - Additional configuration options
 * @returns A Frontend Session Manager charter
 *
 * @example
 * ```typescript
 * const frontendSm = createFrontendSessionManagerCharter('vp_eng_001', {
 *   agentIds: ['react-dev-001', 'css-specialist-001'],
 * });
 * ```
 */
export function createFrontendSessionManagerCharter(
  parentVpId: string,
  options: Partial<Omit<CreateSessionManagerCharterOptions, 'name' | 'disciplineId' | 'parentVpId'>> = {},
): SessionManagerCharter {
  return createSessionManagerCharter({
    name: 'Frontend Session Manager',
    disciplineId: 'frontend',
    parentVpId,
    persona:
      'A detail-oriented frontend specialist focused on React, TypeScript, ' +
      'and modern UI/UX patterns. Ensures accessibility and performance standards.',
    ...options,
    mcpTools: [...(options.mcpTools || []), 'component_analyzer', 'accessibility_checker'],
  });
}

/**
 * Create a Backend Session Manager charter with backend-focused defaults.
 *
 * @param parentVpId - ID of the parent Orchestrator
 * @param options - Additional configuration options
 * @returns A Backend Session Manager charter
 *
 * @example
 * ```typescript
 * const backendSm = createBackendSessionManagerCharter('vp_eng_001', {
 *   agentIds: ['api-dev-001', 'db-specialist-001'],
 * });
 * ```
 */
export function createBackendSessionManagerCharter(
  parentVpId: string,
  options: Partial<Omit<CreateSessionManagerCharterOptions, 'name' | 'disciplineId' | 'parentVpId'>> = {},
): SessionManagerCharter {
  return createSessionManagerCharter({
    name: 'Backend Session Manager',
    disciplineId: 'backend',
    parentVpId,
    persona:
      'A systematic backend architect focused on API design, database optimization, ' +
      'and scalable service patterns. Prioritizes reliability and performance.',
    ...options,
    mcpTools: [...(options.mcpTools || []), 'database_query', 'api_tester', 'perf_profiler'],
    constraints: {
      ...options.constraints,
      requireApprovalFor: [
        ...(options.constraints?.requireApprovalFor || []),
        'modify_database_schema',
        'change_api_contracts',
      ],
    },
  });
}

/**
 * Create a DevOps Session Manager charter with DevOps-focused defaults.
 *
 * @param parentVpId - ID of the parent Orchestrator
 * @param options - Additional configuration options
 * @returns A DevOps Session Manager charter
 *
 * @example
 * ```typescript
 * const devopsSm = createDevOpsSessionManagerCharter('vp_eng_001', {
 *   agentIds: ['infra-agent-001', 'deploy-agent-001'],
 * });
 * ```
 */
export function createDevOpsSessionManagerCharter(
  parentVpId: string,
  options: Partial<Omit<CreateSessionManagerCharterOptions, 'name' | 'disciplineId' | 'parentVpId'>> = {},
): SessionManagerCharter {
  return createSessionManagerCharter({
    name: 'DevOps Session Manager',
    disciplineId: 'devops',
    parentVpId,
    persona:
      'A reliability-focused DevOps specialist managing CI/CD pipelines, ' +
      'infrastructure as code, and deployment automation. Prioritizes stability and observability.',
    ...options,
    mcpTools: [
      ...(options.mcpTools || []),
      'deploy_status',
      'monitoring',
      'alerting',
      'terraform_plan',
    ],
    constraints: {
      ...options.constraints,
      requireApprovalFor: [
        ...(options.constraints?.requireApprovalFor || []),
        'modify_infrastructure',
        'change_deployment_config',
        'modify_secrets_manager',
      ],
    },
  });
}

/**
 * Create a QA Session Manager charter with QA-focused defaults.
 *
 * @param parentVpId - ID of the parent Orchestrator
 * @param options - Additional configuration options
 * @returns A QA Session Manager charter
 *
 * @example
 * ```typescript
 * const qaSm = createQASessionManagerCharter('vp_eng_001', {
 *   agentIds: ['test-automation-001', 'manual-tester-001'],
 * });
 * ```
 */
export function createQASessionManagerCharter(
  parentVpId: string,
  options: Partial<Omit<CreateSessionManagerCharterOptions, 'name' | 'disciplineId' | 'parentVpId'>> = {},
): SessionManagerCharter {
  return createSessionManagerCharter({
    name: 'QA Session Manager',
    disciplineId: 'qa',
    parentVpId,
    persona:
      'A meticulous quality assurance specialist focused on test coverage, ' +
      'regression prevention, and quality metrics. Advocates for user experience.',
    ...options,
    mcpTools: [
      ...(options.mcpTools || []),
      'test_runner',
      'coverage_reporter',
      'bug_tracker',
      'regression_analyzer',
    ],
    objectives: {
      ...options.objectives,
      customMetrics: {
        testCoverageTarget: 80,
        regressionDetectionRate: 95,
        bugEscapeRate: 2,
        ...options.objectives?.customMetrics,
      },
    },
  });
}

/**
 * Create a Data Session Manager charter with data engineering focused defaults.
 *
 * @param parentVpId - ID of the parent Orchestrator
 * @param options - Additional configuration options
 * @returns A Data Session Manager charter
 *
 * @example
 * ```typescript
 * const dataSm = createDataSessionManagerCharter('vp_eng_001', {
 *   agentIds: ['data-pipeline-001', 'analytics-agent-001'],
 * });
 * ```
 */
export function createDataSessionManagerCharter(
  parentVpId: string,
  options: Partial<Omit<CreateSessionManagerCharterOptions, 'name' | 'disciplineId' | 'parentVpId'>> = {},
): SessionManagerCharter {
  return createSessionManagerCharter({
    name: 'Data Session Manager',
    disciplineId: 'data',
    parentVpId,
    persona:
      'A data-driven specialist focused on pipeline reliability, data quality, ' +
      'and analytics accuracy. Ensures data governance and compliance.',
    ...options,
    mcpTools: [
      ...(options.mcpTools || []),
      'data_catalog',
      'pipeline_monitor',
      'quality_validator',
      'lineage_tracker',
    ],
    constraints: {
      ...options.constraints,
      forbiddenActions: [
        ...(options.constraints?.forbiddenActions || []),
        'delete_production_data',
        'modify_data_retention_policy',
      ],
      requireApprovalFor: [
        ...(options.constraints?.requireApprovalFor || []),
        'modify_pii_handling',
        'change_data_access_policy',
      ],
    },
  });
}

/**
 * Create a Security Session Manager charter with security-focused defaults.
 *
 * @param parentVpId - ID of the parent Orchestrator
 * @param options - Additional configuration options
 * @returns A Security Session Manager charter
 *
 * @example
 * ```typescript
 * const securitySm = createSecuritySessionManagerCharter('vp_ops_001', {
 *   agentIds: ['vuln-scanner-001', 'compliance-checker-001'],
 * });
 * ```
 */
export function createSecuritySessionManagerCharter(
  parentVpId: string,
  options: Partial<Omit<CreateSessionManagerCharterOptions, 'name' | 'disciplineId' | 'parentVpId'>> = {},
): SessionManagerCharter {
  return createSessionManagerCharter({
    name: 'Security Session Manager',
    disciplineId: 'security',
    parentVpId,
    persona:
      'A vigilant security specialist focused on vulnerability assessment, ' +
      'compliance verification, and threat mitigation. Prioritizes defense in depth.',
    ...options,
    mcpTools: [
      ...(options.mcpTools || []),
      'vulnerability_scanner',
      'compliance_checker',
      'threat_analyzer',
      'audit_logger',
    ],
    constraints: {
      ...options.constraints,
      forbiddenActions: [
        ...(options.constraints?.forbiddenActions || []),
        'disable_audit_logging',
        'modify_security_controls',
        'grant_admin_access',
      ],
      requireApprovalFor: [
        ...(options.constraints?.requireApprovalFor || []),
        'modify_firewall_rules',
        'change_access_controls',
        'update_security_policy',
        'manage_certificates',
      ],
    },
  });
}
