/**
 * @fileoverview Finance Discipline Template
 * @module @wundr/org-genesis/templates/disciplines/finance
 *
 * Defines standard finance roles, capabilities, and organizational structure
 * for financial operations. This discipline pack provides financial analysis,
 * reporting, budgeting, and treasury management capabilities.
 *
 * @example
 * ```typescript
 * import { FINANCE_DISCIPLINE } from '@wundr/org-genesis/templates/disciplines/finance.js';
 *
 * // Use in organization configuration
 * const org = await engine.createOrganization({
 *   name: 'Acme Corp',
 *   disciplines: [FINANCE_DISCIPLINE],
 * });
 * ```
 */

import type { DisciplinePack, MCPServerConfig, HookConfig, ClaudeMdConfig } from '../../types/index.js';

/**
 * Unique identifier for the finance discipline.
 */
export const FINANCE_DISCIPLINE_ID = 'disc_finance_001';

/**
 * URL-safe slug for the finance discipline.
 */
export const FINANCE_DISCIPLINE_SLUG = 'finance';

/**
 * CLAUDE.md configuration for finance discipline agents.
 *
 * @description
 * Defines the role, context, rules, objectives, and constraints
 * for Claude when operating in a finance capacity.
 * The configuration emphasizes accuracy, compliance, audit trails,
 * and fiduciary responsibility.
 */
export const FINANCE_CLAUDE_MD: ClaudeMdConfig = {
  role: 'Financial Operations Analyst',
  context: `You operate within a finance department supporting financial analysis,
reporting, budgeting, and treasury management. You assist finance professionals
with data analysis, report generation, and financial planning.

Your expertise spans:
- Financial statement analysis and interpretation
- Budget planning and variance analysis
- Cash flow management and forecasting
- Cost accounting and profitability analysis
- Financial modeling and scenario planning
- GAAP/IFRS compliance and reporting
- Internal controls and audit support
- Investment analysis and capital allocation

You work with sensitive financial data and must maintain the highest standards
of accuracy, confidentiality, and regulatory compliance.`,

  rules: [
    'Verify all calculations with double-entry reconciliation',
    'Document assumptions and methodologies for all analyses',
    'Maintain strict adherence to GAAP/IFRS standards',
    'Flag discrepancies and anomalies immediately',
    'Ensure audit trail for all financial data modifications',
    'Cross-reference multiple data sources for accuracy',
    'Apply materiality thresholds consistently',
    'Separate duties appropriately for internal controls',
    'Preserve original data before any transformations',
    'Report financial data with appropriate precision and rounding',
  ],

  objectives: [
    'Prepare and analyze financial statements and reports',
    'Support budget planning and variance analysis',
    'Generate cash flow forecasts and projections',
    'Conduct cost-benefit and ROI analyses',
    'Prepare audit documentation and schedules',
    'Support month-end and year-end close processes',
    'Create financial models and scenario analyses',
    'Monitor key financial metrics and KPIs',
  ],

  constraints: [
    'Never authorize financial transactions without human approval',
    'Do not access banking credentials or initiate transfers',
    'Avoid making forward-looking statements without disclaimers',
    'Do not modify historical financial records',
    'Refrain from sharing non-public financial information externally',
    'Never bypass internal control procedures',
    'Do not provide tax or investment advice without qualification',
    'Avoid accessing personal financial data of employees',
  ],
};

/**
 * MCP server configurations for the finance discipline.
 *
 * @description
 * Provides spreadsheet manipulation and database access
 * capabilities for financial operations.
 */
export const FINANCE_MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'spreadsheet-excel',
    command: 'npx',
    args: ['@wundr/mcp-spreadsheet', '--provider=excel'],
    env: {
      EXCEL_API_CREDENTIALS: '${EXCEL_API_CREDENTIALS}',
      SHAREPOINT_SITE_URL: '${SHAREPOINT_SITE_URL}',
    },
    description: 'Excel and spreadsheet manipulation for financial modeling',
  },
  {
    name: 'database-finance',
    command: 'npx',
    args: ['@wundr/mcp-database', '--read-only'],
    env: {
      FINANCE_DB_CONNECTION: '${FINANCE_DB_CONNECTION}',
      DB_READ_REPLICA: '${FINANCE_DB_READ_REPLICA}',
    },
    description: 'Read-only access to financial database for reporting and analysis',
  },
  {
    name: 'erp-connector',
    command: 'npx',
    args: ['@wundr/mcp-erp', '--mode=read'],
    env: {
      ERP_API_URL: '${ERP_API_URL}',
      ERP_API_KEY: '${ERP_API_KEY}',
    },
    description: 'ERP system integration for financial data access',
  },
  {
    name: 'reporting-bi',
    command: 'npx',
    args: ['@wundr/mcp-bi-tools'],
    env: {
      POWERBI_CLIENT_ID: '${POWERBI_CLIENT_ID}',
      POWERBI_CLIENT_SECRET: '${POWERBI_CLIENT_SECRET}',
      TABLEAU_API_TOKEN: '${TABLEAU_API_TOKEN}',
    },
    description: 'Business intelligence and reporting tools integration',
  },
  {
    name: 'market-data',
    command: 'npx',
    args: ['@wundr/mcp-market-data'],
    env: {
      BLOOMBERG_API_KEY: '${BLOOMBERG_API_KEY}',
      REFINITIV_API_KEY: '${REFINITIV_API_KEY}',
    },
    description: 'Market data feeds for investment analysis and benchmarking',
  },
];

/**
 * Hook configurations for the finance discipline.
 *
 * @description
 * Implements comprehensive audit logging, calculation verification,
 * and compliance checks for financial operations.
 */
export const FINANCE_HOOKS: HookConfig[] = [
  {
    event: 'PostToolUse',
    command: 'node scripts/finance/audit-log.js --action="${TOOL_NAME}" --data="${DATA_ACCESSED}" --timestamp="${TIMESTAMP}" --user="${USER_ID}"',
    description: 'Log all financial data access and modifications for audit trail',
    blocking: false,
  },
  {
    event: 'PreToolUse',
    command: 'node scripts/finance/validate-access-period.js --period="${FISCAL_PERIOD}"',
    description: 'Validate that fiscal period is open for modifications',
    blocking: true,
  },
  {
    event: 'PostToolUse',
    command: 'node scripts/finance/verify-calculations.js --report="${REPORT_ID}"',
    description: 'Verify calculation accuracy and cross-foot totals',
    blocking: false,
  },
  {
    event: 'PreCommit',
    command: 'node scripts/finance/check-sensitive-data.js',
    description: 'Verify no sensitive financial data is exposed in commits',
    blocking: true,
  },
  {
    event: 'PostToolUse',
    command: 'node scripts/finance/update-audit-schedule.js --report="${REPORT_TYPE}" --status="${STATUS}"',
    description: 'Update audit schedule status after report completion',
    blocking: false,
  },
];

/**
 * Agent IDs associated with the finance discipline.
 *
 * @description
 * Specialized agents for financial analysis, reporting, budgeting,
 * and audit support.
 */
export const FINANCE_AGENT_IDS: string[] = [
  'agent-financial-analyst-001',
  'agent-budget-analyst-001',
  'agent-report-generator-001',
  'agent-audit-support-001',
  'agent-treasury-analyst-001',
  'agent-cost-accountant-001',
  'agent-fp-and-a-001',
];

/**
 * Complete Finance Discipline Pack.
 *
 * @description
 * A comprehensive configuration bundle for finance operations.
 * Includes financial analysis, reporting, budgeting, and treasury
 * capabilities with appropriate MCP servers and hooks.
 *
 * @example
 * ```typescript
 * import { FINANCE_DISCIPLINE } from '@wundr/org-genesis/templates/disciplines/finance.js';
 *
 * // Register with discipline registry
 * registry.register(FINANCE_DISCIPLINE);
 *
 * // Assign to VP
 * await engine.assignDisciplineToVp({
 *   disciplineId: FINANCE_DISCIPLINE.id,
 *   vpId: 'vp-finance-001',
 * });
 * ```
 */
export const FINANCE_DISCIPLINE: DisciplinePack = {
  id: FINANCE_DISCIPLINE_ID,
  name: 'Finance',
  slug: FINANCE_DISCIPLINE_SLUG,
  category: 'finance',
  description: 'Financial analysis, reporting, budgeting, and treasury management with emphasis on accuracy, compliance, and audit trails.',
  claudeMd: FINANCE_CLAUDE_MD,
  mcpServers: FINANCE_MCP_SERVERS,
  hooks: FINANCE_HOOKS,
  agentIds: FINANCE_AGENT_IDS,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Factory function to create a customized finance discipline pack.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns A new DisciplinePack with merged configurations
 *
 * @example
 * ```typescript
 * const customFinanceDiscipline = createFinanceDiscipline({
 *   description: 'Investment analysis discipline',
 *   agentIds: ['agent-investment-analyst-001', 'agent-portfolio-manager-001'],
 * });
 * ```
 */
export function createFinanceDiscipline(
  overrides: Partial<Omit<DisciplinePack, 'id' | 'slug' | 'category' | 'createdAt'>> = {},
): DisciplinePack {
  return {
    ...FINANCE_DISCIPLINE,
    ...overrides,
    claudeMd: {
      ...FINANCE_CLAUDE_MD,
      ...(overrides.claudeMd ?? {}),
    },
    mcpServers: overrides.mcpServers ?? FINANCE_MCP_SERVERS,
    hooks: overrides.hooks ?? FINANCE_HOOKS,
    agentIds: overrides.agentIds ?? FINANCE_AGENT_IDS,
    updatedAt: new Date(),
  };
}
