/**
 * @fileoverview Legal/Compliance Discipline Template
 * @module @wundr/org-genesis/templates/disciplines/legal
 *
 * Defines standard legal roles, capabilities, and organizational structure
 * for legal and compliance operations. This discipline pack provides
 * contract review, compliance auditing, and regulatory analysis capabilities.
 *
 * @example
 * ```typescript
 * import { LEGAL_DISCIPLINE } from '@wundr/org-genesis/templates/disciplines/legal.js';
 *
 * // Use in organization configuration
 * const org = await engine.createOrganization({
 *   name: 'Acme Corp',
 *   disciplines: [LEGAL_DISCIPLINE],
 * });
 * ```
 */

import type { DisciplinePack, MCPServerConfig, HookConfig, ClaudeMdConfig } from '../../types/index.js';

/**
 * Unique identifier for the legal discipline.
 */
export const LEGAL_DISCIPLINE_ID = 'disc_legal_001';

/**
 * URL-safe slug for the legal discipline.
 */
export const LEGAL_DISCIPLINE_SLUG = 'legal';

/**
 * CLAUDE.md configuration for legal discipline agents.
 *
 * @description
 * Defines the role, context, rules, objectives, and constraints
 * for Claude when operating in a legal/compliance capacity.
 * The configuration emphasizes regulatory compliance, due diligence,
 * and attorney-client privilege awareness.
 */
export const LEGAL_CLAUDE_MD: ClaudeMdConfig = {
  role: 'Legal Counsel Assistant',
  context: `You operate within a corporate legal department supporting contract review,
compliance auditing, and regulatory analysis. You assist legal professionals
with document analysis, research, and preparation of legal materials.

Your expertise spans:
- Contract law and commercial agreements
- Regulatory compliance (SEC, GDPR, SOX, HIPAA)
- Corporate governance and fiduciary duties
- Intellectual property and licensing
- Employment law and HR compliance
- Data privacy and security regulations

You work with sensitive confidential information and must maintain
the highest standards of professionalism and discretion.`,

  rules: [
    'Always cite specific regulations, statutes, or case law when providing analysis',
    'Flag potential compliance risks immediately with severity assessment',
    'Maintain strict confidentiality and attorney-client privilege awareness',
    'Document all analysis with clear reasoning and supporting references',
    'Distinguish between facts, legal interpretations, and recommendations',
    'Use precise legal terminology while providing plain-language summaries',
    'Track regulatory deadlines and filing requirements diligently',
    'Cross-reference multiple jurisdictions when applicable',
    'Preserve original document versions before any modifications',
    'Log all document access and modifications for audit trail',
  ],

  objectives: [
    'Review and analyze contracts for risks, obligations, and compliance',
    'Monitor regulatory changes and assess impact on operations',
    'Support due diligence processes for transactions and partnerships',
    'Prepare compliance reports and audit documentation',
    'Research legal precedents and regulatory guidance',
    'Draft and review legal correspondence and memoranda',
    'Maintain contract database and obligation tracking',
    'Assist with policy development and procedure documentation',
  ],

  constraints: [
    'Never provide final legal advice without human attorney review',
    'Do not execute contracts or binding agreements autonomously',
    'Avoid accessing opposing counsel communications without authorization',
    'Do not make representations to regulators without approval',
    'Refrain from modifying executed documents without proper authorization',
    'Never disclose privileged information to unauthorized parties',
    'Do not speculate on litigation outcomes or settlement values',
    'Avoid unauthorized practice of law in any jurisdiction',
  ],
};

/**
 * MCP server configurations for the legal discipline.
 *
 * @description
 * Provides read-only filesystem access for document analysis
 * and knowledge base access for regulatory information.
 */
export const LEGAL_MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'filesystem-readonly',
    command: 'npx',
    args: ['@modelcontextprotocol/server-filesystem', '--read-only'],
    env: {
      MCP_ALLOWED_PATHS: '${LEGAL_DOCS_PATH}',
    },
    description: 'Read-only filesystem access for contract and legal document review',
  },
  {
    name: 'knowledge-base-sec',
    command: 'npx',
    args: ['@wundr/mcp-knowledge-base', '--domain=sec-regulations'],
    env: {
      KNOWLEDGE_BASE_URL: '${KNOWLEDGE_BASE_URL}',
      SEC_API_KEY: '${SEC_API_KEY}',
    },
    description: 'SEC regulations, filings, and compliance guidance knowledge base',
  },
  {
    name: 'knowledge-base-gdpr',
    command: 'npx',
    args: ['@wundr/mcp-knowledge-base', '--domain=gdpr-compliance'],
    env: {
      KNOWLEDGE_BASE_URL: '${KNOWLEDGE_BASE_URL}',
    },
    description: 'GDPR regulations, guidance, and compliance requirements',
  },
  {
    name: 'knowledge-base-contracts',
    command: 'npx',
    args: ['@wundr/mcp-knowledge-base', '--domain=contract-templates'],
    env: {
      KNOWLEDGE_BASE_URL: '${KNOWLEDGE_BASE_URL}',
    },
    description: 'Contract templates, clause library, and negotiation playbooks',
  },
  {
    name: 'legal-research',
    command: 'npx',
    args: ['@wundr/mcp-legal-research'],
    env: {
      WESTLAW_API_KEY: '${WESTLAW_API_KEY}',
      LEXIS_API_KEY: '${LEXIS_API_KEY}',
    },
    description: 'Legal research tools for case law and statute lookup',
  },
];

/**
 * Hook configurations for the legal discipline.
 *
 * @description
 * Generates compliance report entries and maintains audit trails
 * for all legal document operations.
 */
export const LEGAL_HOOKS: HookConfig[] = [
  {
    event: 'PostToolUse',
    command: 'node scripts/legal/generate-compliance-entry.js --tool="${TOOL_NAME}" --action="${TOOL_ACTION}"',
    description: 'Generate compliance report entry after each tool operation',
    blocking: false,
  },
  {
    event: 'PreToolUse',
    command: 'node scripts/legal/validate-access-permissions.js --document="${TARGET_FILE}"',
    description: 'Validate access permissions before accessing legal documents',
    blocking: true,
  },
  {
    event: 'PostToolUse',
    command: 'node scripts/legal/audit-log.js --action="${TOOL_NAME}" --target="${TARGET_FILE}" --timestamp="${TIMESTAMP}"',
    description: 'Log document access to audit trail for compliance',
    blocking: false,
  },
  {
    event: 'PreCommit',
    command: 'node scripts/legal/verify-no-pii-exposure.js',
    description: 'Verify no PII or privileged information is exposed in commits',
    blocking: true,
  },
  {
    event: 'PostCommit',
    command: 'node scripts/legal/update-document-registry.js --commit="${COMMIT_SHA}"',
    description: 'Update legal document registry after commits',
    blocking: false,
  },
];

/**
 * Agent IDs associated with the legal discipline.
 *
 * @description
 * Specialized agents for contract review, compliance auditing,
 * regulatory research, and legal documentation.
 */
export const LEGAL_AGENT_IDS: string[] = [
  'agent-contract-reviewer-001',
  'agent-compliance-auditor-001',
  'agent-regulatory-analyst-001',
  'agent-legal-researcher-001',
  'agent-policy-drafter-001',
  'agent-due-diligence-001',
  'agent-ip-specialist-001',
];

/**
 * Complete Legal Discipline Pack.
 *
 * @description
 * A comprehensive configuration bundle for legal and compliance operations.
 * Includes contract review, compliance auditing, regulatory analysis,
 * and due diligence capabilities with appropriate MCP servers and hooks.
 *
 * @example
 * ```typescript
 * import { LEGAL_DISCIPLINE } from '@wundr/org-genesis/templates/disciplines/legal.js';
 *
 * // Register with discipline registry
 * registry.register(LEGAL_DISCIPLINE);
 *
 * // Assign to Orchestrator
 * await engine.assignDisciplineToVp({
 *   disciplineId: LEGAL_DISCIPLINE.id,
 *   vpId: 'orchestrator-legal-001',
 * });
 * ```
 */
export const LEGAL_DISCIPLINE: DisciplinePack = {
  id: LEGAL_DISCIPLINE_ID,
  name: 'Legal & Compliance',
  slug: LEGAL_DISCIPLINE_SLUG,
  category: 'legal',
  description: 'Contract review, compliance auditing, regulatory analysis, and legal research operations with emphasis on risk identification and regulatory compliance.',
  claudeMd: LEGAL_CLAUDE_MD,
  mcpServers: LEGAL_MCP_SERVERS,
  hooks: LEGAL_HOOKS,
  agentIds: LEGAL_AGENT_IDS,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Factory function to create a customized legal discipline pack.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns A new DisciplinePack with merged configurations
 *
 * @example
 * ```typescript
 * const customLegalDiscipline = createLegalDiscipline({
 *   description: 'Specialized IP law discipline',
 *   agentIds: ['agent-ip-specialist-001', 'agent-patent-analyst-001'],
 * });
 * ```
 */
export function createLegalDiscipline(
  overrides: Partial<Omit<DisciplinePack, 'id' | 'slug' | 'category' | 'createdAt'>> = {},
): DisciplinePack {
  return {
    ...LEGAL_DISCIPLINE,
    ...overrides,
    claudeMd: {
      ...LEGAL_CLAUDE_MD,
      ...(overrides.claudeMd ?? {}),
    },
    mcpServers: overrides.mcpServers ?? LEGAL_MCP_SERVERS,
    hooks: overrides.hooks ?? LEGAL_HOOKS,
    agentIds: overrides.agentIds ?? LEGAL_AGENT_IDS,
    updatedAt: new Date(),
  };
}
