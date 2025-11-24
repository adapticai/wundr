/**
 * @fileoverview Operations Discipline Template
 * @module @wundr/org-genesis/templates/disciplines/operations
 *
 * Defines standard operations roles, capabilities, and organizational structure
 * for business operations. This discipline pack provides process optimization,
 * resource management, scheduling, and operational excellence capabilities.
 *
 * @example
 * ```typescript
 * import { OPERATIONS_DISCIPLINE } from '@wundr/org-genesis/templates/disciplines/operations.js';
 *
 * // Use in organization configuration
 * const org = await engine.createOrganization({
 *   name: 'Acme Corp',
 *   disciplines: [OPERATIONS_DISCIPLINE],
 * });
 * ```
 */

import type { DisciplinePack, MCPServerConfig, HookConfig, ClaudeMdConfig } from '../../types/index.js';

/**
 * Unique identifier for the operations discipline.
 */
export const OPERATIONS_DISCIPLINE_ID = 'disc_operations_001';

/**
 * URL-safe slug for the operations discipline.
 */
export const OPERATIONS_DISCIPLINE_SLUG = 'operations';

/**
 * CLAUDE.md configuration for operations discipline agents.
 *
 * @description
 * Defines the role, context, rules, objectives, and constraints
 * for Claude when operating in a business operations capacity.
 * The configuration emphasizes efficiency, reliability, continuous improvement,
 * and cross-functional coordination.
 */
export const OPERATIONS_CLAUDE_MD: ClaudeMdConfig = {
  role: 'Operations Excellence Specialist',
  context: `You operate within a business operations department supporting process optimization,
resource management, and operational efficiency. You assist operations professionals
with workflow design, capacity planning, and continuous improvement initiatives.

Your expertise spans:
- Process design and optimization
- Resource allocation and capacity planning
- Supply chain and vendor management
- Project and program management
- Quality assurance and continuous improvement
- Operational metrics and KPI tracking
- Risk management and business continuity
- Cross-functional coordination and communication

You work across multiple departments to ensure smooth business operations
and drive efficiency improvements throughout the organization.`,

  rules: [
    'Base recommendations on data and measurable outcomes',
    'Document all process changes with before/after metrics',
    'Coordinate changes with affected stakeholders before implementation',
    'Maintain comprehensive operational runbooks and documentation',
    'Monitor service level agreements and escalate breaches promptly',
    'Track resource utilization and optimize allocation',
    'Apply lean principles to eliminate waste and inefficiency',
    'Ensure business continuity plans are current and tested',
    'Report on operational metrics regularly and transparently',
    'Balance short-term efficiency with long-term sustainability',
  ],

  objectives: [
    'Design and optimize business processes and workflows',
    'Manage resource allocation and capacity planning',
    'Monitor operational metrics and generate status reports',
    'Coordinate cross-functional projects and initiatives',
    'Identify and implement continuous improvement opportunities',
    'Maintain vendor relationships and service agreements',
    'Support incident management and problem resolution',
    'Develop and maintain operational documentation',
  ],

  constraints: [
    'Never approve expenditures without proper authorization',
    'Do not modify production systems without change management',
    'Avoid committing to vendor contracts without legal review',
    'Do not access systems outside of defined scope',
    'Refrain from making staffing decisions without HR involvement',
    'Never bypass safety or compliance procedures',
    'Do not share confidential operational data externally',
    'Avoid implementing changes during critical business periods without approval',
  ],
};

/**
 * MCP server configurations for the operations discipline.
 *
 * @description
 * Provides monitoring, scheduling, and operational management
 * capabilities for business operations.
 */
export const OPERATIONS_MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'monitoring-datadog',
    command: 'npx',
    args: ['@wundr/mcp-monitoring', '--provider=datadog'],
    env: {
      DATADOG_API_KEY: '${DATADOG_API_KEY}',
      DATADOG_APP_KEY: '${DATADOG_APP_KEY}',
    },
    description: 'Datadog integration for infrastructure and application monitoring',
  },
  {
    name: 'scheduling-calendar',
    command: 'npx',
    args: ['@wundr/mcp-scheduling'],
    env: {
      CALENDAR_PROVIDER: '${CALENDAR_PROVIDER}',
      CALENDAR_CREDENTIALS: '${CALENDAR_CREDENTIALS}',
    },
    description: 'Scheduling and calendar management for operations coordination',
  },
  {
    name: 'project-management',
    command: 'npx',
    args: ['@wundr/mcp-project-tools'],
    env: {
      JIRA_API_URL: '${JIRA_API_URL}',
      JIRA_API_TOKEN: '${JIRA_API_TOKEN}',
      ASANA_ACCESS_TOKEN: '${ASANA_ACCESS_TOKEN}',
    },
    description: 'Project management tools integration for task and initiative tracking',
  },
  {
    name: 'inventory-management',
    command: 'npx',
    args: ['@wundr/mcp-inventory'],
    env: {
      INVENTORY_API_URL: '${INVENTORY_API_URL}',
      INVENTORY_API_KEY: '${INVENTORY_API_KEY}',
    },
    description: 'Inventory and asset management system integration',
  },
  {
    name: 'communication-slack',
    command: 'npx',
    args: ['@wundr/mcp-slack'],
    env: {
      SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}',
      SLACK_SIGNING_SECRET: '${SLACK_SIGNING_SECRET}',
    },
    description: 'Slack integration for operational communications and alerts',
  },
];

/**
 * Hook configurations for the operations discipline.
 *
 * @description
 * Implements status reporting, change tracking, and operational
 * monitoring workflows.
 */
export const OPERATIONS_HOOKS: HookConfig[] = [
  {
    event: 'PostToolUse',
    command: 'node scripts/operations/update-status-report.js --action="${ACTION}" --resource="${RESOURCE}" --status="${STATUS}"',
    description: 'Update operational status report after resource changes',
    blocking: false,
  },
  {
    event: 'PreToolUse',
    command: 'node scripts/operations/check-change-window.js --system="${TARGET_SYSTEM}"',
    description: 'Verify change is within approved change window',
    blocking: true,
  },
  {
    event: 'PostToolUse',
    command: 'node scripts/operations/log-operational-activity.js --type="${ACTIVITY_TYPE}" --details="${DETAILS}"',
    description: 'Log operational activities for tracking and reporting',
    blocking: false,
  },
  {
    event: 'PostToolUse',
    command: 'node scripts/operations/update-capacity-tracker.js --resource="${RESOURCE}" --utilization="${UTILIZATION}"',
    description: 'Update capacity tracking after resource allocation changes',
    blocking: false,
  },
  {
    event: 'PostCommit',
    command: 'node scripts/operations/notify-stakeholders.js --change="${CHANGE_SUMMARY}" --commit="${COMMIT_SHA}"',
    description: 'Notify relevant stakeholders of operational changes',
    blocking: false,
  },
];

/**
 * Agent IDs associated with the operations discipline.
 *
 * @description
 * Specialized agents for process optimization, resource management,
 * monitoring, and operational coordination.
 */
export const OPERATIONS_AGENT_IDS: string[] = [
  'agent-process-optimizer-001',
  'agent-resource-manager-001',
  'agent-capacity-planner-001',
  'agent-incident-coordinator-001',
  'agent-quality-analyst-001',
  'agent-vendor-manager-001',
  'agent-ops-reporter-001',
];

/**
 * Complete Operations Discipline Pack.
 *
 * @description
 * A comprehensive configuration bundle for business operations.
 * Includes process optimization, resource management, monitoring,
 * and operational excellence capabilities with appropriate MCP servers and hooks.
 *
 * @example
 * ```typescript
 * import { OPERATIONS_DISCIPLINE } from '@wundr/org-genesis/templates/disciplines/operations.js';
 *
 * // Register with discipline registry
 * registry.register(OPERATIONS_DISCIPLINE);
 *
 * // Assign to VP
 * await engine.assignDisciplineToVp({
 *   disciplineId: OPERATIONS_DISCIPLINE.id,
 *   vpId: 'vp-operations-001',
 * });
 * ```
 */
export const OPERATIONS_DISCIPLINE: DisciplinePack = {
  id: OPERATIONS_DISCIPLINE_ID,
  name: 'Operations',
  slug: OPERATIONS_DISCIPLINE_SLUG,
  category: 'operations',
  description: 'Process optimization, resource management, and operational excellence with emphasis on efficiency, reliability, and continuous improvement.',
  claudeMd: OPERATIONS_CLAUDE_MD,
  mcpServers: OPERATIONS_MCP_SERVERS,
  hooks: OPERATIONS_HOOKS,
  agentIds: OPERATIONS_AGENT_IDS,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Factory function to create a customized operations discipline pack.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns A new DisciplinePack with merged configurations
 *
 * @example
 * ```typescript
 * const customOperationsDiscipline = createOperationsDiscipline({
 *   description: 'DevOps and SRE operations discipline',
 *   agentIds: ['agent-sre-001', 'agent-devops-engineer-001'],
 * });
 * ```
 */
export function createOperationsDiscipline(
  overrides: Partial<Omit<DisciplinePack, 'id' | 'slug' | 'category' | 'createdAt'>> = {},
): DisciplinePack {
  return {
    ...OPERATIONS_DISCIPLINE,
    ...overrides,
    claudeMd: {
      ...OPERATIONS_CLAUDE_MD,
      ...(overrides.claudeMd ?? {}),
    },
    mcpServers: overrides.mcpServers ?? OPERATIONS_MCP_SERVERS,
    hooks: overrides.hooks ?? OPERATIONS_HOOKS,
    agentIds: overrides.agentIds ?? OPERATIONS_AGENT_IDS,
    updatedAt: new Date(),
  };
}
